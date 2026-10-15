import assert from 'node:assert/strict'
import { BudgetLedger } from '../adapters/dsh-session/budget.mjs'
import { HostAuthority } from '../adapters/dsh-session/authority.mjs'
import { createIngress } from '../adapters/dsh-session/ingress.mjs'
import { controlledProvider } from '../adapters/dsh-session/controlled-provider.mjs'
import { contractHash } from '../adapters/dsh-v2.1/adapter.mjs'

export const fixturePolicy=()=>({provider:'controlled-offline',model:'text-fixture',transport:'offline-fixture',networkAllowed:false,
  inputUpperBound:1000,outputUpperBound:20,contextWindow:2000,protocolOverheadTokens:32,internalRetries:0,
  price:{provider:'controlled-offline',model:'text-fixture',currency:'TEST',unit:'micro-per-token',version:'fixture-v1',
    source:'Deterministic fixture, not vendor pricing',validFrom:'2026-01-01',validUntil:'2099-01-01',input:'1',output:'2',cacheRead:'1',cacheWrite:'3',otherCharges:'none-in-offline-fixture'}})

export async function providerCase(runtimeFactory,options={}) {
  const policy={...fixturePolicy(),...options.policy},session={id:'provider-case-session'},taskId='provider-case'
  const config={maxCalls:5,maxSessions:1,maxSteps:20,maxInputTokens:10000,maxOutputTokens:100,maxCostMicros:'50000',maxRuntimeMs:60000,
    price:{currency:'TEST',inputMicrosPerToken:'3',outputMicrosPerToken:'2',approvedConservativeUpperBound:true},providerPolicyHash:contractHash(policy),...options.config}
  const authority=new HostAuthority({mode:'component-test'}),channel=authority.registerSession(session,taskId)
  let grant
  const binding={provider:policy.provider,model:policy.model,goal:'offline-provider-test',budgetConfig:config}
  const ingress=await createIngress({session,taskId,componentTest:true,onAuthenticated:(_message,proof)=>{grant=authority.authorizeModelBudget(channel,proof);return {approved:true}}})
  if(options.authorized!==false) {
    const accepted=await ingress.requestForComponentTest({sessionId:session.id,taskId,requestId:'budget',action:'budget',payload:{...binding,expiresAt:Date.now()+60000}})
    assert.equal(accepted.httpStatus,200)
  }
  const authorize=({provider,model,policyHash})=>provider===binding.provider&&model===binding.model&&policyHash===config.providerPolicyHash&&authority.liveModelBudget(grant,session,binding)
  const ledger=new BudgetLedger(config,{authorize:()=>authority.liveModelBudget(grant,session,binding)})
  if(options.authorized!==false)ledger.openSession(session.id)
  const calls={prepare:0,dispatch:0,cancelObserved:0,maxTokens:[],events:[]},audit=[]
  const delegate={
    async prepareCall(provider,model,signal){
      calls.prepare++;calls.events.push('prepare')
      if(options.prepareFailure)throw new Error('fixture preparation failure')
      if(options.waitInPrepare)await wait(signal,calls)
      return {model:{provider:options.wrongModel?'wrong':provider,id:model,name:model},stream:request=>({async *[Symbol.asyncIterator](){
        calls.dispatch++;calls.maxTokens.push(request.maxTokens);calls.events.push('dispatch')
        if(options.waitInStream)await wait(request.signal,calls)
        if(options.failure)throw new Error('fixture transport error')
        if(options.midStreamFailure){yield {type:'usage',usage:{inputTokens:1,outputTokens:1,totalTokens:2}};throw new Error('fixture interrupted stream')}
        const usage=options.usage??{inputTokens:10,outputTokens:5,totalTokens:15}
        if(!options.noUsage)yield {type:'usage',usage}
        if(options.duplicateUsage)yield {type:'usage',usage}
        if(options.terminalFailure)yield {type:'finish',reason:{kind:'error',failure:{code:'TRANSPORT',message:'fixture terminal error'}}}
        else yield {type:'finish',reason:{kind:'stop'}}
      }})}
    }
  }
  const runtime=await runtimeFactory(({LlmAdapter})=>controlledProvider({LlmAdapter,delegate,policy,getBudget:()=>ledger,getBudgetConfig:()=>config,authorize,sessionId:session.id,audit}))
  const request=(overrides={})=>({provider:policy.provider,model:policy.model,maxTokens:20,sessionId:session.id,messages:[{role:'system',content:[{type:'text',text:'Master Skill fixture'}]},{role:'user',content:[{type:'text',text:'hello'}]}],tools:[],...overrides})
  const collect=async stream=>{const chunks=[];for await(const c of stream)chunks.push(c);return chunks}
  // Native LlmRuntime can normalize adapter throws to terminal failure chunks.
  const attempt=async(overrides={},prepared=false)=>{try{const r=request(overrides);const h=prepared?await runtime.llm.prepareCall(r,r.signal):null;const chunks=await collect(h?h.stream(r):runtime.llm.stream(r));return {ok:!chunks.some(c=>c.type==='finish'&&['error','aborted'].includes(c.reason?.kind)),chunks}}catch(error){return {ok:false,error:error.message}}}
  return {policy,config,session,ledger,calls,audit,runtime,request,collect,attempt,revoke:()=>authority.revoke(channel),
    close:async()=>{ledger.stop('test_closed');await ingress.close();authority.close(channel);await runtime.close()}}
}
function wait(signal,calls){return new Promise((resolve,reject)=>{const abort=()=>{calls.cancelObserved++;reject(signal.reason??new Error('aborted'))};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true})})}
const denied=async c=>{assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.prepare,0);assert.equal(c.calls.dispatch,0)}
export const providerCases=[
  ['unauthorized prepared and direct routes never touch delegate',{authorized:false},async c=>{await denied(c);assert.equal((await c.attempt({},true)).ok,false);assert.equal(c.calls.prepare,0)}],
  ['plain approved JSON cannot replace private grant',{authorized:false},async c=>{await denied(c)}],
  ['unknown pricing prevents provider preparation',{policy:{price:null}},denied],
  ['provider model mismatch in price is denied',{policy:{price:{...fixturePolicy().price,model:'other'}}},denied],
  ['expired price is denied',{policy:{price:{...fixturePolicy().price,validUntil:'2026-01-01'}}},denied],
  ['cache write price must be covered by approved upper rate',{config:{price:{currency:'TEST',inputMicrosPerToken:'1',outputMicrosPerToken:'2',approvedConservativeUpperBound:true}}},denied],
  ['unknown network provider stays closed even with approval',{policy:{transport:'network',networkAllowed:true}},denied],
  ['hidden provider retries are not admitted',{policy:{internalRetries:1}},denied],
  ['prepared metadata is local; delegate starts only after reservation',{},async c=>{
    const h=await c.runtime.llm.prepareCall(c.request());assert.equal(c.calls.prepare,0)
    assert.equal(c.ledger.snapshot().calls,0);await c.collect(h.stream(c.request()))
    assert.equal(c.calls.prepare,1);assert.equal(c.calls.dispatch,1);assert.equal(c.audit.find(x=>x.type==='reserved').budget.pendingRequests,1)
    assert.deepEqual(c.calls.events,['prepare','dispatch']);assert.deepEqual(c.calls.maxTokens,[20])
  }],
  ['direct actual interface also goes through reservation',{},async c=>{assert.equal((await c.attempt()).ok,true);assert.equal(c.ledger.snapshot().calls,1);assert.equal(c.calls.dispatch,1)}],
  ['complete input including history tool result and tools is bounded',{},async c=>{assert.equal((await c.attempt({messages:[{role:'tool',content:[{type:'text',text:'x'.repeat(1000)}]}],tools:[{name:'write',description:'x'.repeat(1000)}]})).ok,false);assert.equal(c.calls.prepare,0)}],
  ['attachments are blocked rather than guessed',{},async c=>{assert.equal((await c.attempt({messages:[{role:'user',content:[{type:'image',url:'not fetched'}]}]})).ok,false);assert.equal(c.calls.prepare,0)}],
  ['per request output must be enforced explicitly',{},async c=>{assert.equal((await c.attempt({maxTokens:21})).ok,false);assert.equal((await c.attempt({maxTokens:undefined})).ok,false);assert.equal(c.calls.prepare,0)}],
  ['insufficient cumulative output denies before prepare',{config:{maxOutputTokens:10}},denied],
  ['insufficient cumulative input denies before prepare',{config:{maxInputTokens:999}},denied],
  ['insufficient cumulative fee denies before prepare',{config:{maxCostMicros:'3039'}},denied],
  ['cumulative call limit denies retry',{config:{maxCalls:1}},async c=>{assert.equal((await c.attempt()).ok,true);assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.dispatch,1)}],
  ['concurrent requests reserve before either can dispatch',{config:{maxInputTokens:1000}},async c=>{const result=await Promise.all([c.attempt(),c.attempt()]);assert.equal(result.filter(x=>x.ok).length<=1,true);assert.equal(c.calls.dispatch<=1,true);assert.equal(c.ledger.snapshot().calls,1)}],
  ['normal cache usage settles all billed input classes',{usage:{inputTokens:8,cacheReadTokens:2,cacheWriteTokens:3,outputTokens:5,totalTokens:18}},async c=>{assert.equal((await c.attempt()).ok,true);const s=c.ledger.snapshot();assert.equal(s.observedInputTokens,13);assert.equal(s.chargedCostUpperBoundMicros,'49');assert.equal(s.actualBilledCost,null)}],
  ['unknown usage conservatively charges full reservation',{noUsage:true},async c=>{await c.attempt();const s=c.ledger.snapshot();assert.equal(s.chargedInputUpperBound,1000);assert.equal(s.chargedOutputUpperBound,20);assert.equal(s.chargedCostUpperBoundMicros,'3040');assert.equal(s.observedInputTokens,null);assert.equal((await c.attempt()).ok,false)}],
  ['usage over bound is observed and stops subsequent calls',{usage:{inputTokens:1001,outputTokens:5,totalTokens:1006}},async c=>{await c.attempt();assert.equal(c.ledger.snapshot().stopped,'provider_exceeded_reserved_bound');assert.equal(c.ledger.snapshot().observedInputTokens,1001);assert.equal((await c.attempt()).ok,false)}],
  ['provider transport error retains conservative occupancy',{failure:true},async c=>{assert.equal((await c.attempt()).ok,false);assert.equal(c.ledger.snapshot().chargedCostUpperBoundMicros,'3040');assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.dispatch,1)}],
  ['preparation error is charged conservatively',{prepareFailure:true},async c=>{assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.dispatch,0);assert.equal(c.ledger.snapshot().chargedCostUpperBoundMicros,'3040')}],
  ['interrupted stream cannot settle partial usage as final',{midStreamFailure:true},async c=>{await c.attempt();assert.equal(c.ledger.snapshot().observedInputTokens,null);assert.equal(c.ledger.snapshot().chargedCostUpperBoundMicros,'3040')}],
  ['terminal provider error stops automatic retry',{terminalFailure:true},async c=>{await c.attempt();assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.dispatch,1)}],
  ['duplicate usage is ambiguous and stops',{duplicateUsage:true},async c=>{await c.attempt();assert.equal(c.ledger.snapshot().observedInputTokens,null);assert.equal((await c.attempt()).ok,false)}],
  ['user cancellation reaches outstanding provider read',{waitInStream:true},async c=>{const abort=new AbortController();const pending=c.attempt({signal:abort.signal});while(c.calls.dispatch===0)await new Promise(r=>setTimeout(r,1));abort.abort(new Error('user_cancel'));assert.equal((await pending).ok,false);assert.equal(c.calls.cancelObserved,1);assert.equal((await c.attempt()).ok,false);assert.equal(c.ledger.snapshot().chargedCostUpperBoundMicros,'3040')}],
  ['runtime deadline cancels provider preparation',{waitInPrepare:true,config:{maxRuntimeMs:150}},async c=>{assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.cancelObserved,1);assert.equal(c.calls.dispatch,0);assert.equal(c.ledger.snapshot().stopped,'runtime_limit')}],
  ['revoked grant is not reusable by direct or prepared path',{},async c=>{c.revoke();await denied(c);assert.equal((await c.attempt({},true)).ok,false)}],
  ['route switching and wrong Session cannot bypass approval',{},async c=>{for(const change of [{provider:'other'},{model:'other'},{sessionId:'other'}])assert.equal((await c.attempt(change)).ok,false);assert.equal(c.calls.prepare,0)}],
  ['delegate route changes after preparation are rejected',{wrongModel:true},async c=>{assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.dispatch,0);assert.equal(c.ledger.snapshot().pendingRequests,0)}],
  ['successful explicit retry consumes another cumulative reservation',{},async c=>{assert.equal((await c.attempt()).ok,true);assert.equal((await c.attempt()).ok,true);assert.equal(c.calls.prepare,2);assert.equal(c.ledger.snapshot().calls,2)}],
  ['reported output over enforced bound stops future calls',{usage:{inputTokens:10,outputTokens:21,totalTokens:31}},async c=>{await c.attempt();assert.equal(c.ledger.snapshot().observedOutputTokens,21);assert.equal(c.ledger.snapshot().stopped,'provider_exceeded_reserved_bound');assert.equal((await c.attempt()).ok,false)}],
  ['inconsistent total usage is unknown',{usage:{inputTokens:10,outputTokens:5,totalTokens:1}},async c=>{await c.attempt();assert.equal(c.ledger.snapshot().observedInputTokens,null);assert.equal(c.ledger.snapshot().stopped,'usage_unverifiable')}],
  ['runtime deadline cancels outstanding stream read',{waitInStream:true,config:{maxRuntimeMs:150}},async c=>{assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.cancelObserved,1);assert.equal(c.ledger.snapshot().stopped,'runtime_limit');assert.equal(c.ledger.snapshot().chargedCostUpperBoundMicros,'3040')}],
  ['prepared handle cannot dispatch after revocation',{},async c=>{const h=await c.runtime.llm.prepareCall(c.request());c.revoke();try{await c.collect(h.stream(c.request()))}catch{}assert.equal(c.calls.prepare,0)}],
  ['consumer early return retains conservative request charge',{},async c=>{const iterator=c.runtime.llm.stream(c.request())[Symbol.asyncIterator]();await iterator.next();await iterator.return();assert.equal(c.ledger.snapshot().chargedCostUpperBoundMicros,'3040');assert.equal(c.ledger.snapshot().observedInputTokens,null);assert.equal((await c.attempt()).ok,false)}],
  ['step ceiling prevents further provider dispatch',{config:{maxSteps:1}},async c=>{assert.equal((await c.attempt()).ok,true);assert.equal((await c.attempt()).ok,false);assert.equal(c.calls.prepare,1);assert.equal(c.ledger.snapshot().stopped,'step_limit')}]
]
