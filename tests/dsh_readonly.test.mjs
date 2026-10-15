import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { TARGET,PRICE_OBSERVATION,readonlyPolicy,createDeepSeekBoundary } from '../adapters/dsh-session/deepseek-readonly.mjs'
import { controlledProvider } from '../adapters/dsh-session/controlled-provider.mjs'
import { DIMENSIONS,modelInput,validateStructure,reviewTranscript } from '../evals/readonly-intent/review.mjs'
import { contractHash } from '../adapters/dsh-v2.1/adapter.mjs'
const make=componentTest=>createDeepSeekBoundary({DeepSeekAdapter:class {constructor(deps){this.deps=deps}async prepareCall(provider,model){return {model:{provider,id:model},stream:()=>{throw new Error('unit stub never sends')}}}},resolveAdapterOptions:c=>c,componentTest})
const text={messages:[{role:'user',content:[{type:'text',text:'synthetic'}]}],tools:[]}
test('single official target and observed price do not grant approval',()=>{assert.equal(TARGET.model,'deepseek-flash');assert.equal(TARGET.provider,'deepseek-official');assert.equal(TARGET.thinking,'disabled');assert.equal(PRICE_OBSERVATION.approved,false);assert.equal(readonlyPolicy().networkAllowed,false)})
test('unknown real token upper bound blocks before delegate preparation',async()=>{const b=make(false);assert.throws(()=>b.measure(text,b.policy),/certified/);await assert.rejects(b.delegate.prepareCall(TARGET.provider,TARGET.model),/admission/);assert.equal(b.readiness().status,'BLOCKED')})
test('ordinary JSON cannot create private DeepSeek boundary',()=>assert.throws(()=>controlledProvider({boundary:{approved:true},policy:readonlyPolicy()}),/private/))
for(const change of [{model:'deepseek-chat'},{provider:'other'},{networkAllowed:true},{contextWindow:1},{outputUpperBound:393217}])test('single model policy rejects '+JSON.stringify(change),()=>assert.throws(()=>make(true).validate({...readonlyPolicy(),...change})))
for(const change of [{tools:[{name:'read'}]},{reasoningEffort:'high'},{purpose:'session-title'},{messages:[{role:'tool',content:[]}]},{messages:[{role:'user',content:[{type:'image',url:'never fetched'}]}]},{messages:[{role:'assistant',source:{replayState:{}},content:[]}]}])test('readonly request rejects '+JSON.stringify(change),()=>assert.throws(()=>make(true).measure({...text,...change},readonlyPolicy())))
test('complete test framing includes approved system prompt',()=>assert(make(true).measure({...text,system:'x'.repeat(100)},readonlyPolicy())>make(true).measure(text,readonlyPolicy())))
test('only exact model replay is converted to plain text history',()=>{const b=make(true),r={messages:[{role:'assistant',source:{kind:'model',provider:TARGET.provider,model:TARGET.model,replayState:{opaque:'fixture'}},content:[{type:'text',text:'mock'}]}]};assert.equal(b.normalize(r).messages[0].source.replayState,undefined);assert.throws(()=>b.normalize({messages:[{role:'assistant',source:{kind:'model',provider:'foreign',model:TARGET.model,replayState:{}},content:[]}]}))})
const dataset=JSON.parse(await readFile(new URL('../evals/readonly-intent/samples.json',import.meta.url),'utf8'))
test('six scenarios separated across three splits without identical inputs',()=>{assert.equal(dataset.samples.length,18);assert.equal(new Set(dataset.samples.map(c=>c.turns[0].text)).size,18);for(const split of ['train','validation','test'])assert.equal(new Set(dataset.samples.filter(c=>c.split===split).map(c=>c.category)).size,6)})
test('model-facing input excludes rubric and split metadata',()=>{for(const c of dataset.samples)assert.deepEqual(Object.keys(modelInput(c,0)),['text'])})
const transcript={caseId:'vague-test',declaredSource:'mock',turns:[{role:'user',text:'虚构需求：想改善小店。'},{role:'assistant',text:'你希望先改善哪一件事？'}],toolCalls:[]}
const review=()=>({transcriptSha256:contractHash(transcript),reviewer:'unit-test-controller',source:'independent-human-review',findings:DIMENSIONS.map(d=>({dimension:d,verdict:'uncertain',reason:'需要独立评审结合上下文进一步判断。',evidence:[{turnIndex:1,quote:'你希望先改善哪一件事'}]}))})
test('structural pass never implies semantic pass',()=>{assert.equal(validateStructure(transcript).semanticVerdict,'NOT_EVALUATED');assert.equal(reviewTranscript(transcript).semanticVerdict,'NEEDS_REVIEW')})
test('uncertainty and mock provenance cannot certify real behavior',()=>{const r=reviewTranscript(transcript,review());assert.equal(r.semanticVerdict,'NEEDS_REVIEW');assert.equal(r.realBehaviorAccepted,false);assert.equal(r.fixtureOnly,true)})
test('review requires exact quoted evidence and transcript binding',()=>{const r=review();r.findings[0].evidence[0].quote='不存在的引用';assert.throws(()=>reviewTranscript(transcript,r));assert.throws(()=>reviewTranscript({...transcript,caseId:'changed'},review()))})
test('critical semantic failure fails conversation',()=>{const r=review();r.findings[5].verdict='fail';assert.equal(reviewTranscript(transcript,r).semanticVerdict,'FAIL')})
test('critical safety cannot be omitted as not applicable',()=>{const r=review();r.findings[5].verdict='not_applicable';assert.throws(()=>reviewTranscript(transcript,r),/safety/)})
test('native zero defaults cannot turn missing text usage into free billing',()=>{const b=make(true);assert.throws(()=>b.validateUsage({inputTokens:0,outputTokens:0}));assert.throws(()=>b.validateUsage({inputTokens:10,outputTokens:0}));b.validateUsage({inputTokens:10,outputTokens:5})})
test('tool calls fail readonly structure independently of semantics',()=>assert.equal(validateStructure({...transcript,toolCalls:[{name:'read'}]}).passed,false))
