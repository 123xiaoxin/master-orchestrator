import { contractHash } from '../dsh-v2.1/adapter.mjs'

const positive=n=>Number.isSafeInteger(n)&&n>0
const money=n=>typeof n==='string'&&/^(0|[1-9][0-9]*)$/u.test(n)
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}

/** Only the local fixture protocol has an established preflight bound here.
 * Its input vocabulary is UTF-8 JSON bytes plus a fixed framing allowance.
 * This is NOT an estimate/certification for DeepSeek or other real tokenizers.
 */
export function fixtureInputBound(request,policy) {
  if(!Array.isArray(request.messages)||!Array.isArray(request.tools??[]))throw new Error('Complete messages/tools required')
  for(const message of request.messages) {
    if(!['system','user','assistant','tool'].includes(message.role)||!Array.isArray(message.content))throw new Error('Unsupported message shape')
    for(const c of message.content)if(c.type!=='text'||typeof c.text!=='string')throw new Error('Only bounded text fixture input admitted; images/files/replay denied')
    if(message.source?.replayState!==undefined)throw new Error('Unbounded replay state denied')
  }
  const serialized=JSON.stringify({messages:request.messages,tools:request.tools??[],toolHistory:request.toolHistory??null})
  const bound=Buffer.byteLength(serialized,'utf8')+policy.protocolOverheadTokens
  if(!positive(bound))throw new Error('Unsafe input bound')
  return bound
}

/** An adapter decorator for the existing native LlmRuntime, not another runtime.
 * The delegate is PRIVATE and never registered. prepare/resolve/list use local
 * metadata only. Every delegate prepare and stream is behind one admission.
 * Network admission is intentionally unavailable until a real route is reviewed.
 */
export function controlledProvider({LlmAdapter,delegate,policy,getBudget,getBudgetConfig,authorize,sessionId,audit=[]}) {
  const p=freeze(structuredClone(policy))
  const record=(type,data={})=>audit.push({sequence:audit.length+1,type,...data,source:'controlled adapter boundary'})
  const checkRoute=(provider,model,budgetAdmission=true)=>{
    if(provider!==p.provider||model!==p.model)throw new Error('Provider/model outside approved route')
    if(p.transport!=='offline-fixture'||p.networkAllowed!==false)throw new Error('Real network provider admission not reviewed')
    if(!authorize({provider,model,policyHash:contractHash(p)}))throw new Error('No live private host provider authorization')
    const c=getBudgetConfig(),price=p.price,now=Date.now()
    if(!price||price.provider!==provider||price.model!==model||price.currency!==c.price?.currency||price.unit!=='micro-per-token'||
      !price.version||!price.source||!Number.isFinite(Date.parse(price.validFrom))||!Number.isFinite(Date.parse(price.validUntil))||
      now<Date.parse(price.validFrom)||now>=Date.parse(price.validUntil)||price.otherCharges!=='none-in-offline-fixture'||
      !['input','output','cacheRead','cacheWrite'].every(k=>money(price[k]))||
      BigInt(c.price.inputMicrosPerToken)<[price.input,price.cacheRead,price.cacheWrite].map(BigInt).reduce((a,b)=>a>b?a:b)||
      BigInt(c.price.outputMicrosPerToken)<BigInt(price.output))throw new Error('Unknown, stale, mismatched or uncovered price')
    if(!positive(p.inputUpperBound)||!positive(p.outputUpperBound)||!positive(p.contextWindow)||!positive(p.protocolOverheadTokens)||
      p.inputUpperBound+p.outputUpperBound>p.contextWindow||p.internalRetries!==0)throw new Error('Unverified request bounds/retries')
    if(budgetAdmission){
      const admission=getBudget().allowTool()
      if(!admission.allowed)throw new Error(admission.reason)
    }
  }
  const modelInfo=()=>({provider:p.provider,id:p.model,name:p.model,context:{contextWindow:p.contextWindow},inputModalities:['text']})
  return new class extends LlmAdapter {
    providerInfo(provider){return {id:provider,name:'Host-controlled offline provider'}}
    providerRetryPolicy(){return {mode:'normal',maxRetries:0,retryableCodes:['TRANSPORT'],backoff:{initialDelayMs:1,maxDelayMs:1,jitterRatio:0}}}
    async listModels(provider){checkRoute(provider,p.model);return [modelInfo()]}
    async resolveModel(provider,model,signal){signal?.throwIfAborted();checkRoute(provider,model);return modelInfo()}
    async prepareCall(provider,model,signal) {
      signal?.throwIfAborted();checkRoute(provider,model)
      record('local_preparation',{provider,model,delegateTouched:false})
      let used=false
      return {model:modelInfo(),stream:options=>{if(used)throw new Error('Delegate prepared handle already used');used=true;return this.stream(options)}}
    }
    async *stream(options) {
      let reservation,usage,completed=false,failed=false,iterator
      const ledger=getBudget()
      try {
        // Snapshot before awaits. A mutable caller cannot enlarge a checked request.
        const request=freeze(structuredClone(Object.fromEntries(Object.entries(options).filter(([key])=>key!=='signal'))))
        const signal=options.signal?AbortSignal.any([options.signal,ledger.signal]):ledger.signal
        signal.throwIfAborted();checkRoute(request.provider,request.model)
        if(request.sessionId!==undefined&&request.sessionId!==sessionId)throw new Error('Wrong budget Session')
        if(!positive(request.maxTokens)||request.maxTokens>p.outputUpperBound)throw new Error('Explicit enforced output bound required')
        const input=fixtureInputBound(request,p)
        if(input>p.inputUpperBound)throw new Error('Request input exceeds approved per-call bound')
        ledger.step(sessionId)
        reservation=ledger.reserve({sessionId,inputUpperBound:p.inputUpperBound,outputUpperBound:request.maxTokens})
        record('reserved',{provider:p.provider,model:p.model,inputMeasuredUpper:input,inputReserved:p.inputUpperBound,outputReserved:request.maxTokens,budget:ledger.snapshot()})
        signal.throwIfAborted();checkRoute(request.provider,request.model,false)
        // First delegate contact: even prepareCall may perform provider I/O.
        const prepared=await delegate.prepareCall(request.provider,request.model,signal)
        signal.throwIfAborted();checkRoute(request.provider,request.model,false)
        if(prepared.model.provider!==p.provider||prepared.model.id!==p.model)throw new Error('Delegate changed prepared route')
        record('delegate_dispatch',{provider:p.provider,model:p.model,maxTokens:request.maxTokens,network:false})
        iterator=prepared.stream({...request,signal})[Symbol.asyncIterator]()
        while(true) {
          signal.throwIfAborted()
          const item=await iterator.next()
          signal.throwIfAborted()
          checkRoute(request.provider,request.model,false)
          if(item.done){completed=true;break}
          const chunk=item.value
          if(chunk.type==='usage'){if(usage)throw new Error('Ambiguous duplicate usage');usage=structuredClone(chunk.usage)}
          if(chunk.type==='finish'&&['error','aborted'].includes(chunk.reason?.kind)){failed=true;ledger.stop('provider_terminal_failure')}
          yield chunk
        }
      }catch(error){
        record('denied_or_failed',{reason:error.message,delegateAdmitted:!!reservation})
        if(reservation)ledger.stop(options.signal?.aborted?'user_cancelled':ledger.signal.aborted?'aborted':'provider_failure')
        throw error
      }finally{
        // Failure/cancellation after send: retain the full reserved upper charge,
        // even if an earlier partial usage event looked small.
        if(reservation){
          if(!completed||failed)ledger.stop('provider_incomplete')
          ledger.settle(reservation,completed&&!failed?usage:undefined)
          record('settled',{completed,usage:completed&&!failed?usage??null:null,budget:ledger.snapshot()})
        }
        if(!completed&&iterator?.return)await iterator.return()
      }
    }
  }()
}
