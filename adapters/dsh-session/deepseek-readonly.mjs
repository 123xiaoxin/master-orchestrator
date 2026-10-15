// One reviewed target; no credential lookup and no live-network entry point.
const boundaries=new WeakSet()
export const TARGET=Object.freeze({provider:'deepseek-official',model:'deepseek-flash',modelVersionObserved:'DeepSeek-V4.1-Flash',
  baseURL:'https://api.deepseek.com/anthropic',contextWindow:1048576,maxOutputTokens:393216,thinking:'disabled'})
export const PRICE_OBSERVATION=Object.freeze({observedAt:'2026-10-15',source:'https://api-docs.deepseek.com/quick_start/pricing/',
  currency:'USD',unit:'USD-per-million-tokens',peak:{cacheHit:'0.006',cacheMiss:'0.30',output:'1.20'},
  offPeak:{cacheHit:'0.003',cacheMiss:'0.15',output:'0.60'},approved:false})
export const isDeepSeekBoundary=b=>boundaries.has(b)

export function readonlyPolicy(){return {provider:TARGET.provider,model:TARGET.model,transport:'deepseek-messages-readonly',networkAllowed:false,
  inputUpperBound:200000,outputUpperBound:256,contextWindow:TARGET.contextWindow,protocolOverheadTokens:64,internalRetries:0,
  price:{provider:TARGET.provider,model:TARGET.model,currency:'USD',unit:'micro-per-token',version:'observed-2026-10-15-peak-rounded-up',
    source:PRICE_OBSERVATION.source,validFrom:'2026-10-15T00:00:00Z',validUntil:'2026-10-16T00:00:00Z',
    input:'1',output:'2',cacheRead:'1',cacheWrite:'1',otherCharges:'text-only-no-attachments-no-extra-services'}}}

export function createDeepSeekBoundary({DeepSeekAdapter,resolveAdapterOptions,componentTest=false}) {
  const policy=readonlyPolicy()
  // Trusted-layer environment is deliberately empty: no ambient endpoint/key.
  const connection=resolveAdapterOptions({baseURL:TARGET.baseURL,thinking:'disabled',reasoningEffort:'off',
    maxTokens:policy.outputUpperBound,defaultContextWindow:TARGET.contextWindow,
    models:[{id:TARGET.model,name:TARGET.modelVersionObserved,contextWindow:TARGET.contextWindow,maxTokens:TARGET.maxOutputTokens,inputModalities:['text']}],
    retryPolicy:{mode:'normal',maxRetries:0}}, {get:()=>undefined})
  const native=new DeepSeekAdapter({options:()=>connection,resolveUserId:()=> 'readonly-offline-component',
    prepareExtensions:async()=>({fields:{},accept:async()=>{}}),
    resolveAuth:async()=>{if(!componentTest)throw new Error('Live credentials and network admission are closed');return {headers:{'x-api-key':'OFFLINE-NOT-A-CREDENTIAL'}}}})
  const boundary={
    policy,
    componentTest,
    validate(p){
      if(p.provider!==TARGET.provider||p.model!==TARGET.model||p.transport!==policy.transport||p.networkAllowed!==false)throw new Error('Wrong single DeepSeek route or network gate')
      if(p.outputUpperBound>TARGET.maxOutputTokens||p.contextWindow!==TARGET.contextWindow)throw new Error('Unsupported model bounds')
    },
    normalize(request){
      for(const m of request.messages??[])if(m.source?.replayState!==undefined){
        if(m.role!=='assistant'||m.source.kind!=='model'||m.source.provider!==TARGET.provider||m.source.model!==TARGET.model)throw new Error('Foreign replay source')
        delete m.source.replayState
      }
      return request
    },
    measure(request,p){
      if(!componentTest)throw new Error('No certified real-provider preflight token bound; live request blocked')
      if(request.tools?.length||request.toolHistory?.length||request.reasoningEffort!==undefined&&request.reasoningEffort!=='off'||request.purpose&&request.purpose!=='intent-evaluation')throw new Error('Only text intent evaluation is admitted')
      for(const m of request.messages??[]) {
        if(!['system','user','assistant'].includes(m.role)||!Array.isArray(m.content)||m.source?.replayState)throw new Error('Unapproved message/replay')
        for(const c of m.content)if(c.type!=='text'||typeof c.text!=='string')throw new Error('Non-text readonly content')
      }
      // Test-only framing bound. This is NOT a real DeepSeek tokenizer proof.
      return Buffer.byteLength(JSON.stringify({system:request.system??'',messages:request.messages}),'utf8')+p.protocolOverheadTokens
    },
    validateUsage(usage){
      // Native translation defaults missing fields to zero. A nonempty text
      // conversation must not silently settle missing input/output as free.
      // Reject even a potentially legitimate zero-uncached-input response;
      // raw field-presence semantics still require actual-provider acceptance.
      if(!Number.isSafeInteger(usage?.inputTokens)||usage.inputTokens<=0||!Number.isSafeInteger(usage?.outputTokens)||usage.outputTokens<=0)throw new Error('Unverifiable zero/missing native text usage')
    },
    delegate:{async prepareCall(provider,model,signal){
      if(!componentTest)throw new Error('Real network admission remains closed')
      if(provider!==TARGET.provider||model!==TARGET.model)throw new Error('Wrong delegate route')
      const prepared=await native.prepareCall(provider,model,signal)
      return {model:prepared.model,stream:request=>prepared.stream({...request,tools:undefined,toolHistory:undefined,reasoningEffort:'off',purpose:'intent-evaluation'})}
    }},
    readiness:()=>({status:'BLOCKED',engineeringMissing:['Certified input-token upper bound for actual serialized Messages requests',
      'Verified actual Messages cache/usage billing and remote cancellation/account spend limits'],realNetworkEnabled:false,realUserApproved:false})
  }
  boundaries.add(boundary)
  return Object.freeze(boundary)
}
