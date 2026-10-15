import { createHostPort, prepareExecution, executionGate, claimOperation, verifyGoal } from '../dsh-runtime/bridge.mjs'
import { contractHash } from '../dsh-v2.1/adapter.mjs'

/** Minimal same-process bridge, not a second Agent loop or contract format. */
export class ContractRouter {
  #authority
  #session
  #master=null
  #grant=null
  #prepared=null
  #audit=[]
  #captured=null
  constructor({authority,session,taskId,workspace,evidenceParent,frameworkDir}) {
    Object.assign(this,{taskId,workspace,evidenceParent,frameworkDir})
    this.#authority=authority;this.#session=session
  }
  captureModelContract(event) {
    if(event.type!=='assistant/message'||this.#session.eventAt(event.seq)!==event||event.data?.message?.source?.kind!=='model')return false
    try {
      const text=event.data.message.content.filter(c=>c.type==='text').map(c=>c.text).join('')
      const master=JSON.parse(text)
      if(master.version!=='master_output_contract.v1')return false
      this.#captured={master,eventSha256:contractHash(event),seq:event.seq}
      this.#audit.push({type:'master_output_captured',seq:event.seq,source:'canonical Session assistant declaration; not execution fact'})
      return true
    }catch{return false}
  }
  async consumeCaptured({agentRecord,grant,evidenceDirectory}) {
    if(!this.#captured)throw new Error('No canonical Master v1 output captured')
    return this.consume({master:this.#captured.master,agentRecord,grant,evidenceDirectory})
  }
  async consume({master,agentRecord,grant,evidenceDirectory}) {
    this.#prepared=null
    const confirmation=this.#authority.projection(grant,this.#session,master)
    const port=createHostPort({sessionId:this.#session.id,taskId:this.taskId,evidenceLevel:'DSH component'})
    // This projection comes only from a private host grant. It is NOT re-labelled
    // as an observed external-user Session event, nor as a real model session.
    const receipt=port.admitUserEvent({type:'user/message',seq:0,data:{source:{kind:'user'},content:[{type:'text',text:JSON.stringify(confirmation)}]}})
    const prepared=await prepareExecution({master,agentRecord,receipt,workspace:this.workspace,evidenceDirectory,frameworkDir:this.frameworkDir})
    this.#master=structuredClone(master);this.#grant=grant;this.#prepared=prepared
    this.#audit.push({type:'adapter_consumed',masterHash:contractHash(master),status:prepared.result.status,source:'admitted host projection/component-test',
      nativeL1:prepared.result.validation.nativeStructure.status,nativeL2:prepared.result.validation.nativeGovernance.status})
    return prepared.result
  }
  checkWrite(file,{claim=false}={}) {
    if(!this.#prepared?.permit || this.#prepared.result.status!=='READY')return {allowed:false,reason:'No admitted Adapter candidate'}
    if(!this.#authority.live(this.#grant,this.#session,this.#master))return {allowed:false,reason:'Authorization revoked, expired or scope changed'}
    return (claim?claimOperation:executionGate)(this.#prepared.permit,this.#prepared.result.candidate,{name:'write',file})
  }
  checkRead(file) {
    if(!this.#prepared?.permit || !this.#authority.live(this.#grant,this.#session,this.#master))return {allowed:false,reason:'No live Adapter-bound authorization'}
    return executionGate(this.#prepared.permit,this.#prepared.result.candidate,{name:'read',file})
  }
  async verifyAndReturn(agent,createUserMessage) {
    if(agent.session!==this.#session||!this.#prepared?.permit)throw new Error('Wrong live Agent or missing contract')
    if(!this.#authority.live(this.#grant,this.#session,this.#master))throw new Error('No live authorization')
    const verification=await verifyGoal(this.#prepared.permit)
    // Host verification is correctly marked system source, never user consent.
    const message=createUserMessage({source:{kind:'system',name:'master-independent-verification'},content:[{type:'text',text:JSON.stringify({
      source:'host independent file inspection',taskId:this.taskId,contractSha256:contractHash(this.#prepared.result.candidate),
      verificationSuccess:verification.passed,criteria:verification.results,goalCompleted:false})}]})
    agent.followup(message)
    this.#audit.push({type:'verification_returned',passed:verification.passed,source:'host independent verification, not model declaration'})
    return verification
  }
  audit(){return structuredClone(this.#audit)}
  get capturedMaster(){return this.#captured?structuredClone(this.#captured.master):null}
  get candidate(){return this.#prepared?.result.candidate??null}
}
