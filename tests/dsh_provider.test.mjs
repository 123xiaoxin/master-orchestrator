import test from 'node:test'
import { providerCase, providerCases } from './provider-cases.mjs'

// Portable decorator unit harness. Actual installed LlmRuntime coverage uses
// the SAME cases through scripts/dsh_provider_probe.cjs, separately labelled.
const runtimeFactory=async make=>{
  class LlmAdapter {}
  const adapter=make({LlmAdapter})
  return {llm:{prepareCall:request=>adapter.prepareCall(request.provider,request.model,request.signal),stream:request=>adapter.stream(request)},close:async()=>{}}
}
for(const [name,options,check] of providerCases)test(name,async()=>{
  const c=await providerCase(runtimeFactory,options)
  try{await check(c)}finally{await c.close()}
})
