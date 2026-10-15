import { sha256,contractHash } from '../dsh-v2.1/adapter.mjs'
import { TARGET } from './deepseek-readonly.mjs'

/** Audit the EXACT native serialized body. Estimates never authorize a send. */
export function inspectMessages(raw,{previous,expectedSystemSha256,inputBudget=null}={}) {
  if(typeof raw!=='string')throw new Error('Original serialized request string required')
  const b=JSON.parse(raw),issues=[]
  if(b.model!==TARGET.model||b.stream!==true||b.thinking?.type!=='disabled'||!Number.isSafeInteger(b.max_tokens)||b.max_tokens<=0||b.max_tokens>TARGET.maxOutputTokens)issues.push('route_or_controls')
  if(typeof b.system!=='string'||!b.system.trim()||!Array.isArray(b.messages)||!b.messages.length)issues.push('missing_input')
  if(Object.keys(b).some(k=>!['model','stream','thinking','system','messages','max_tokens'].includes(k)))issues.push('unreviewed_wire_fields')
  const texts=[b.system??'']
  for(const m of b.messages??[]){
    if(!['user','assistant'].includes(m.role)||!Array.isArray(m.content))issues.push('message_shape')
    for(const c of m.content??[]){if(c.type!=='text'||typeof c.text!=='string')issues.push('non_text');else texts.push(c.text)}
  }
  const systemHash=sha256(b.system??'')
  if(expectedSystemSha256&&systemHash!==expectedSystemSha256)issues.push('system_source_changed')
  if((b.messages??[]).some(m=>m.content?.some(c=>c.text===b.system)))issues.push('system_duplicated_in_history')
  if(previous){
    if(previous.systemSha256!==systemHash)issues.push('system_changed_between_turns')
    if((b.messages??[]).length!==previous.messageCount+2||contractHash((b.messages??[]).slice(0,previous.messageCount))!==previous.messageHistorySha256)issues.push('history_not_preserved')
  }
  let ascii=0,han=0,other=0
  for(const c of texts.join('')){if(c.codePointAt(0)<128)ascii++;else if(/\p{Script=Han}/u.test(c))han++;else other++}
  const approximateTextTokens=Math.ceil((ascii*3+han*6)/10)
  return {bodySha256:sha256(raw),serializedUtf8Bytes:Buffer.byteLength(raw,'utf8'),systemSha256:systemHash,systemUtf8Bytes:Buffer.byteLength(b.system??'','utf8'),
    roles:(b.messages??[]).map(m=>m.role),messageCount:b.messages?.length??0,messageHistorySha256:contractHash(b.messages??[]),
    controls:{model:b.model,maxTokens:b.max_tokens,thinking:b.thinking,stream:b.stream},
    textEstimate:{asciiCharacters:ascii,hanCharacters:han,unmodelledCharacters:other,approximateTextTokens,
      source:'https://api-docs.deepseek.com/quick_start/token_usage/',covers:'text only; no server role/template/special-token guarantee',
      safetyMarginTokens:null,strictUpperBound:null},
    inputBudgetExceeded:Number.isSafeInteger(inputBudget)?approximateTextTokens>inputBudget:null,
    structurePassed:issues.length===0,issues,liveAdmission:'BLOCKED',reason:'No certified full Messages token bound; approximation is audit data only'}
}

/** Preserve raw presence; stream usage values REPLACE prior values, never sum.
 * relation is an explicit OFFLINE hypothesis, not a proven DeepSeek policy.
 */
export function auditRawUsage(events,{relation='unknown',fixtureEvidence=false}={}) {
  const fields={},present=new Set(),updates=[];let start=0,stop=0,error=null
  for(const e of events){
    if(e.type==='message_start')start++
    if(e.type==='message_stop')stop++
    const u=e.type==='message_start'?e.message?.usage:e.type==='message_delta'?e.usage:undefined
    if(u)for(const k of ['input_tokens','output_tokens','cache_read_input_tokens','cache_creation_input_tokens','total_tokens'])if(Object.hasOwn(u,k)){
      if(!Number.isSafeInteger(u[k])||u[k]<0)error='invalid_raw_count'
      updates.push({field:k,previous:fields[k]??null,value:u[k]});fields[k]=u[k];present.add(k)
    }
  }
  if(start!==1||stop!==1)error='incomplete_or_duplicate_stream'
  if(!present.has('input_tokens')||!present.has('output_tokens'))error='missing_required_raw_usage'
  const cacheRead=fields.cache_read_input_tokens??0,cacheWrite=fields.cache_creation_input_tokens??0,input=fields.input_tokens,output=fields.output_tokens
  let normalized=null
  if(!error&&fixtureEvidence&&['disjoint','input-includes-cache'].includes(relation)){
    const uncached=relation==='disjoint'?input:input-cacheRead-cacheWrite
    if(uncached<0)error='cache_exceeds_total_input'
    else{
      const total=uncached+cacheRead+cacheWrite+output
      if(!Number.isSafeInteger(total)||present.has('total_tokens')&&fields.total_tokens!==total)error='inconsistent_total'
      else normalized={inputTokens:uncached,outputTokens:output,cacheReadTokens:cacheRead,cacheWriteTokens:cacheWrite,totalTokens:total}
    }
  }
  if(relation==='unknown')error??='cache_inclusion_unverified'
  if(!fixtureEvidence)error??='no_verified_raw_mapping'
  return {rawFields:fields,presentFields:[...present],updates,relation,fixtureEvidence,error,ledgerUsage:error?null:normalized,
    actualBilledCost:null,settlement:error?'retain_reserved_upper_bound':'offline_fixture_mapping_only'}
}

const amount=s=>{
  if(typeof s!=='string'||!/^\d+(\.\d{1,9})?$/u.test(s))throw new Error('Exact nonnegative decimal balance required')
  const [whole,part='']=s.split('.');return BigInt(whole)*1000000000n+BigInt(part.padEnd(9,'0'))
}
export function balanceSnapshot(response,{currency,timestamp,accountScopeHash}) {
  if(!['USD','CNY'].includes(currency)||!Number.isFinite(Date.parse(timestamp))||!accountScopeHash||typeof response?.is_available!=='boolean')throw new Error('Explicit currency/time/account snapshot required')
  const rows=response.balance_infos?.filter(r=>r.currency===currency)
  if(rows?.length!==1)throw new Error('Missing/ambiguous currency balance')
  const row=rows[0],total=amount(row.total_balance),granted=amount(row.granted_balance),topped=amount(row.topped_up_balance)
  if(total!==granted+topped)throw new Error('Balance categories do not reconcile')
  return {currency,timestamp,accountScopeHash,isAvailable:response.is_available,totalNano:total.toString(),grantedNano:granted.toString(),toppedUpNano:topped.toString(),source:'supplied snapshot, not a performed account query'}
}
export function reconcileBalances(before,after,{estimatedCostNano=null,otherAccountActivity='unknown',settlementFinal=false}={}){
  if(!before||!after)return {status:'PENDING',reason:'missing_snapshot',actualBilledCost:null}
  if(before.currency!==after.currency||before.accountScopeHash!==after.accountScopeHash)throw new Error('Currency/account mismatch; conversion not permitted')
  if(Date.parse(after.timestamp)<Date.parse(before.timestamp))throw new Error('Reversed snapshots')
  const delta=BigInt(before.totalNano)-BigInt(after.totalNano)
  return {status:'PENDING_ATTRIBUTION',currency:before.currency,balanceDeltaNano:delta.toString(),estimatedCostNano,
    differenceFromEstimateNano:estimatedCostNano===null?null:(delta-BigInt(estimatedCostNano)).toString(),otherAccountActivity,settlementFinal,
    actualBilledCost:null,reason:'Shared balance, grants/top-ups, delayed settlement and unrelated requests prevent per-request invoice attribution'}
}
