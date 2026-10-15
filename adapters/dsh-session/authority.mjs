import { timingSafeEqual, randomBytes } from 'node:crypto'
import { contractHash } from '../dsh-v2.1/adapter.mjs'
import { ingressProof } from './ingress.mjs'

const capabilities=new WeakMap()
const scopeHash=master=>contractHash({goal:master.realGoal,executionContract:master.executionContract,shouldCreateAgent:master.shouldCreateAgent})
/** Private local-host ingress. The constructor belongs to the trusted launcher,
 * never a model tool. Operator proofs come from the private loopback channel;
 * a DSH GUI/RPC source is not claimed. Production execution stays gated.
 */
export class HostAuthority {
  #sessions=new Map()
  #requests=new Set()
  #audit=[]
  #clock
  #mode
  #realIngress=false
  constructor({clock=()=>Date.now(),mode='unverified'}={}) {
    if(!['unverified','component-test'].includes(mode))throw new Error('No verified real-user ingress available')
    this.#clock=clock;this.#mode=mode
  }
  registerSession(session,taskId) {
    if(!session?.id || !taskId || this.#sessions.has(session.id))throw new Error('Unique live session required')
    const secret=randomBytes(32)
    this.#sessions.set(session.id,{session,taskId,secret,generation:0})
    // Opaque host channel, never serialized into the Agent prompt or workspace.
    const channel=Object.freeze({})
    capabilities.set(channel,{owner:this,type:'channel',sessionId:session.id,secret})
    return channel
  }
  confirm(channel,{requestId,master,confirmation,expiresAt}) {
    if(this.#mode!=='component-test')throw new Error('Actual external-user ingress remains unverified')
    return this.#confirm(channel,{requestId,master,confirmation,expiresAt},'host-controller/component-test')
  }
  confirmFromIngress(channel,input,proof) {
    const c=capabilities.get(channel),s=c&&this.#sessions.get(c.sessionId)
    if(!s)throw new Error('Missing live host session')
    const verified=ingressProof(proof,s.session,s.taskId)
    if(verified.action!=='confirm'||verified.requestId!==input.requestId || verified.origin!== (this.#mode==='component-test'?'component-test':'operator'))throw new Error('Wrong authenticated caller origin')
    if(contractHash(verified.payload?.confirmation)!==contractHash(input.confirmation)||verified.payload?.expiresAt!==input.expiresAt)throw new Error('Confirmation differs from authenticated payload')
    if(verified.origin==='operator')this.#realIngress=true
    return this.#confirm(channel,input,`authenticated-loopback/${verified.origin}`)
  }
  authorizeModelBudget(channel,proof) {
    const c=capabilities.get(channel),s=c&&this.#sessions.get(c.sessionId)
    if(!s)throw new Error('Missing live host session')
    const actor=ingressProof(proof,s.session,s.taskId),p=actor.payload
    if(actor.action!=='budget'||actor.origin!==(this.#mode==='component-test'?'component-test':'operator')||
      ['provider','model','goal'].some(k=>typeof p?.[k]!=='string'||!p[k].trim())||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=this.#clock())throw new Error('No explicit authenticated model budget request')
    if(this.#requests.has(actor.requestId))throw new Error('Replayed budget approval')
    this.#requests.add(actor.requestId)
    const grant=Object.freeze({})
    capabilities.set(grant,{owner:this,type:'model-budget',sessionId:c.sessionId,taskId:s.taskId,generation:s.generation,
      provider:p.provider,model:p.model,goal:p.goal,budgetHash:contractHash(p.budgetConfig),expiresAt:Math.min(p.expiresAt,actor.expiresAt)})
    this.#audit.push({type:'model_budget_approved',sessionId:c.sessionId,taskId:s.taskId,provider:p.provider,model:p.model,
      source:`authenticated-loopback/${actor.origin}`,budgetHash:contractHash(p.budgetConfig),executionPermission:false})
    return grant
  }
  liveModelBudget(grant,session,{provider,model,goal,budgetConfig}) {
    const c=capabilities.get(grant),s=c&&this.#sessions.get(c.sessionId)
    return !!(c&&c.owner===this&&c.type==='model-budget'&&s&&s.session===session&&c.generation===s.generation&&c.expiresAt>this.#clock()&&
      c.provider===provider&&c.model===model&&c.goal===goal&&c.budgetHash===contractHash(budgetConfig))
  }
  #confirm(channel,{requestId,master,confirmation,expiresAt},source) {
    const c=capabilities.get(channel),s=c&&this.#sessions.get(c.sessionId)
    if(!c||c.owner!==this||c.type!=='channel'||!s||!timingSafeEqual(c.secret,s.secret))throw new Error('Unauthenticated host channel')
    if(!requestId||this.#requests.has(requestId))throw new Error('Replayed user request')
    if(!Number.isSafeInteger(expiresAt)||expiresAt<=this.#clock())throw new Error('Authorization expired')
    if(confirmation.taskId!==s.taskId||confirmation.goalConfirmation?.status!=='confirmed'||confirmation.goalConfirmation.goal!==master.realGoal||
      confirmation.authorization?.contractSha256!==contractHash(master))throw new Error('Goal/session/task/contract mismatch')
    for(const field of ['allowedActions','forbiddenActions','riskBoundaries'])
      if(contractHash(confirmation.authorization[field])!==contractHash(master.executionContract[field]))throw new Error('Authorization scope mismatch')
    if(confirmation.authorization.shouldCreateAgent!==master.shouldCreateAgent)throw new Error('Delegation mismatch')
    this.#requests.add(requestId)
    const grant=Object.freeze({})
    capabilities.set(grant,{owner:this,type:'grant',sessionId:c.sessionId,taskId:s.taskId,generation:s.generation,
      expiresAt,masterHash:contractHash(master),scopeHash:scopeHash(master),confirmation:structuredClone(confirmation),source})
    this.#audit.push({type:'confirmed',sessionId:c.sessionId,taskId:s.taskId,requestId,masterHash:contractHash(master),expiresAt,source})
    return grant
  }
  live(grant,session,master) {
    const c=capabilities.get(grant),s=c&&this.#sessions.get(c.sessionId)
    return !!(c&&c.owner===this&&c.type==='grant'&&s&&s.session===session&&c.taskId===s.taskId&&c.generation===s.generation&&
      c.expiresAt>this.#clock()&&c.scopeHash===scopeHash(master))
  }
  projection(grant,session,master) {
    if(!this.live(grant,session,master))throw new Error('Revoked, expired, forged or stale authorization')
    const record=capabilities.get(grant),projection=structuredClone(record.confirmation)
    projection.authorization.contractSha256=contractHash(master)
    if(record.masterHash!==projection.authorization.contractSha256)this.#audit.push({type:'same_scope_rebound',originalMasterHash:record.masterHash,masterHash:projection.authorization.contractSha256})
    return projection
  }
  revoke(channel) {
    const c=capabilities.get(channel)
    if(!c||c.owner!==this||c.type!=='channel')throw new Error('Unauthenticated revocation')
    const s=this.#sessions.get(c.sessionId);if(!s)throw new Error('Session closed')
    s.generation++;this.#audit.push({type:'revoked',sessionId:c.sessionId,generation:s.generation})
  }
  close(channel) {const c=capabilities.get(channel);if(!c||c.owner!==this||c.type!=='channel')throw new Error('Unauthenticated close');this.#sessions.delete(c.sessionId);this.#audit.push({type:'session_closed',sessionId:c.sessionId})}
  audit() {return structuredClone(this.#audit)}
  get realIngressVerified() {return this.#realIngress}
}
