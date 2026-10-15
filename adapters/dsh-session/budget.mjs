// Host-owned synchronous reservations prevent concurrent callers spending the
// same headroom. No actual price is inferred from a local API key or prompt.
const integer = n => Number.isSafeInteger(n) && n >= 0
const positive = n => integer(n) && n > 0
const money = n => typeof n === 'string' && /^(0|[1-9][0-9]*)$/u.test(n)

export class BudgetLedger {
  #config
  #authorize
  #clock
  #start
  #pending = new Map()
  #sessions = new Set()
  #calls = 0
  #steps = 0
  #input = 0
  #output = 0
  #cost = 0n
  #actualInput = 0
  #actualOutput = 0
  #unknownUsage = false
  #stop = null
  #events = []
  #abort = new AbortController()
  #timer
  constructor(config = {}, {authorize=()=>false,clock=()=>performance.now()} = {}) {
    this.#config = structuredClone(config)
    this.#authorize = authorize
    this.#clock = clock
    this.#start = clock()
    if(positive(config.maxRuntimeMs)) {
      this.#timer=setTimeout(()=>this.stop('runtime_limit'),config.maxRuntimeMs)
      this.#timer.unref?.()
    }
  }
  get signal() { return this.#abort.signal }
  #event(type,data={}) { this.#events.push({sequence:this.#events.length+1,type,...data}) }
  stop(reason) {
    if (!this.#stop) { clearTimeout(this.#timer);this.#stop=reason;this.#abort.abort(new Error(reason));this.#event('stopped',{reason}) }
  }
  #check() {
    const c=this.#config
    if (this.#stop) throw new Error(this.#stop)
    if (!this.#authorize()) throw new Error('No live host model/budget authorization')
    for (const key of ['maxCalls','maxSessions','maxSteps','maxInputTokens','maxOutputTokens','maxRuntimeMs'])
      if (!positive(c[key])) throw new Error(`Missing approved ${key}`)
    if (!money(c.maxCostMicros) || !money(c.price?.inputMicrosPerToken) || !money(c.price?.outputMicrosPerToken) || typeof c.price?.currency!=='string' || !c.price.currency.trim() || c.price.approvedConservativeUpperBound !== true)
      throw new Error('Missing approved conservative price/cost ceiling')
    if (this.#clock()-this.#start >= c.maxRuntimeMs) {this.stop('runtime_limit');throw new Error(this.#stop)}
  }
  #costFor(input,output) {return BigInt(input)*BigInt(this.#config.price.inputMicrosPerToken)+BigInt(output)*BigInt(this.#config.price.outputMicrosPerToken)}
  openSession(id) {
    this.#check()
    if (this.#sessions.has(id)) return
    if (!id || this.#sessions.size >= this.#config.maxSessions) {this.stop('session_limit');throw new Error('session_limit')}
    this.#sessions.add(id);this.#event('session_opened',{sessionId:id})
  }
  step(sessionId) {
    this.#check()
    if (!this.#sessions.has(sessionId)) throw new Error('Unknown budget session')
    if (this.#steps >= this.#config.maxSteps) {this.stop('step_limit');throw new Error('step_limit')}
    this.#steps++;this.#event('step_admitted',{sessionId,step:this.#steps})
  }
  reserve({sessionId,inputUpperBound,outputUpperBound}) {
    this.#check()
    if (!this.#sessions.has(sessionId) || !positive(inputUpperBound) || !positive(outputUpperBound)) throw new Error('Explicit request/session bounds required')
    let pendingInput=0,pendingOutput=0,pendingCost=0n
    for(const r of this.#pending.values()){pendingInput+=r.input;pendingOutput+=r.output;pendingCost+=r.cost}
    const cost=this.#costFor(inputUpperBound,outputUpperBound),c=this.#config
    const reason=this.#calls>=c.maxCalls?'call_limit':this.#input+pendingInput+inputUpperBound>c.maxInputTokens?'input_token_limit':
      this.#output+pendingOutput+outputUpperBound>c.maxOutputTokens?'output_token_limit':this.#cost+pendingCost+cost>BigInt(c.maxCostMicros)?'cost_limit':null
    if (reason) {this.stop(reason);throw new Error(reason)}
    const receipt=Object.freeze({})
    this.#calls++;this.#pending.set(receipt,{sessionId,input:inputUpperBound,output:outputUpperBound,cost})
    this.#event('request_reserved',{sessionId,call:this.#calls,inputUpperBound,outputUpperBound,costUpperBoundMicros:cost.toString()})
    return receipt
  }
  settle(receipt,usage) {
    const r=this.#pending.get(receipt)
    if (!r) throw new Error('Unknown or already settled reservation')
    this.#pending.delete(receipt)
    const valid=usage && ['inputTokens','outputTokens'].every(k=>integer(usage[k])) &&
      ['cacheReadTokens','cacheWriteTokens'].every(k=>usage[k]===undefined || integer(usage[k]))
    const input=valid ? usage.inputTokens+(usage.cacheReadTokens??0)+(usage.cacheWriteTokens??0) : null
    const output=valid ? usage.outputTokens : null
    const consistent=valid && integer(input) && (usage.totalTokens===undefined || usage.totalTokens===input+output)
    if (!consistent || input>r.input || output>r.output) {
      // Never invent zero usage after a timeout/error. Charge the reserved upper
      // bound (or observed larger value) and block further calls pending review.
      this.#input+=consistent?Math.max(input,r.input):r.input
      this.#output+=consistent?Math.max(output,r.output):r.output
      this.#cost+=consistent?this.#costFor(Math.max(input,r.input),Math.max(output,r.output)):r.cost
      this.#unknownUsage ||= !consistent
      if(consistent){this.#actualInput+=input;this.#actualOutput+=output}
      this.stop(consistent?'provider_exceeded_reserved_bound':'usage_unverifiable')
    } else {
      this.#input+=input;this.#output+=output;this.#actualInput+=input;this.#actualOutput+=output
      this.#cost+=this.#costFor(input,output)
    }
    this.#event('request_settled',{sessionId:r.sessionId,inputTokens:consistent?input:null,outputTokens:consistent?output:null,
      costBasis:'approved conservative upper rate, not an invoice'})
    const c=this.#config
    if(this.#calls>=c.maxCalls||this.#input>=c.maxInputTokens||this.#output>=c.maxOutputTokens||this.#cost>=BigInt(c.maxCostMicros))this.stop('cumulative_limit_reached')
  }
  allowTool() {try {this.#check();if(this.#steps>=this.#config.maxSteps){this.stop('step_limit');throw new Error('step_limit')}return {allowed:true}}catch(error){return {allowed:false,reason:error.message}}}
  snapshot() {
    let reservedInput=0,reservedOutput=0,reservedCost=0n
    for(const r of this.#pending.values()){reservedInput+=r.input;reservedOutput+=r.output;reservedCost+=r.cost}
    const c=this.#config
    return {calls:this.#calls,sessions:this.#sessions.size,steps:this.#steps,
      chargedInputUpperBound:this.#input,chargedOutputUpperBound:this.#output,
      observedInputTokens:this.#unknownUsage?null:this.#actualInput,observedOutputTokens:this.#unknownUsage?null:this.#actualOutput,
      chargedCostUpperBoundMicros:this.#cost.toString(),actualBilledCost:null,currency:c.price?.currency??null,
      reservedInput,reservedOutput,reservedCostMicros:reservedCost.toString(),pendingRequests:this.#pending.size,
      remainingInput:integer(c.maxInputTokens)?Math.max(0,c.maxInputTokens-this.#input-reservedInput):null,
      remainingOutput:integer(c.maxOutputTokens)?Math.max(0,c.maxOutputTokens-this.#output-reservedOutput):null,
      remainingCostMicros:money(c.maxCostMicros)?(BigInt(c.maxCostMicros)>this.#cost+reservedCost?BigInt(c.maxCostMicros)-this.#cost-reservedCost:0n).toString():null,
      stopped:this.#stop,events:structuredClone(this.#events)}
  }
}
