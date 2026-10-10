import { createHostPort, TraceObserver } from './bridge.mjs'
import { resolve } from 'node:path'

export const name = 'master-runtime-isolated-observer'
export const inject = ['sessions','tools']

/** Mount only in a disposable composition. All tools remain denied. No model
 * route or JSON config can lift this guard. Readiness requires a separately
 * reviewed host executor which is deliberately not guessed here.
 */
export function apply(ctx, config) {
  if (!config?.sessionId || !config.taskId || !config.workspace || !config.candidateHash)
    throw new Error('Explicit isolated observer configuration required')
  const port = createHostPort({sessionId:config.sessionId,taskId:config.taskId,evidenceLevel:'DSH component'})
  const observer = new TraceObserver({sessionId:config.sessionId,taskId:config.taskId,candidateHash:config.candidateHash,evidenceLevel:'DSH component'})
  let receipt = null
  const rejected = []
  ctx.tools.guard(() => 'Master runtime execution blocked: reviewed host routing and model authorization required')
  ctx.on('session/event', (session,event) => {
    if (session.id !== config.sessionId) return
    // The actual live Session object and canonical committed event must match.
    // eventAt is currently available but deprecated by DSH: replacement needs
    // review on migration; no undocumented synchronous replacement is guessed.
    if (ctx.sessions.get(session.id) !== session || session.eventAt(event.seq) !== event || resolve(session.header.cwd) !== resolve(config.workspace)) {
      rejected.push('forged_session_event')
      return
    }
    observer.observe(event)
    if (event.type === 'user/message') {
      try { receipt = port.admitUserEvent(event) }
      catch (error) { rejected.push(error.message) }
    }
  }, {global:true})
  // Controller-owned in-process capability; not a model tool or config field.
  return Object.freeze({observer, receipt:()=>receipt,rejected:()=>[...rejected],executionAuthorized:false})
}
