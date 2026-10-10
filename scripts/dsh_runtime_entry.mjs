import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { realSessionPreflight } from '../adapters/dsh-runtime/bridge.mjs'
import { ROOT, runScenarios } from '../adapters/dsh-runtime/mock-workflow.mjs'

const mode=process.argv[2] ?? '--offline'
if (!['--offline','--real-preflight'].includes(mode)) throw new Error('Use --offline or --real-preflight [authorization-review.json]')
let reviewed={}
if (process.argv[3]) reviewed=JSON.parse(await readFile(resolve(process.argv[3]),'utf8'))
await mkdir(join(ROOT,'.local'),{recursive:true})
const directory=await mkdtemp(join(ROOT,'.local/dsh-runtime-entry-'))
await mkdir(join(directory,'home'))
await mkdir(join(directory,'home','profiles'))
await mkdir(join(directory,'real-workspace'))
const preflight=realSessionPreflight({...reviewed,
  // Public JSON flags cannot attest these unimplemented host capabilities.
  hostRoutingVerified:false,hardBudgetEnforced:false,isolatedProfile:false,scopedTools:false})
await writeFile(join(directory,'real-session-preflight.json'),JSON.stringify(preflight,null,2)+'\n',{flag:'wx'})
await writeFile(join(directory,'authorization-review.template.json'),JSON.stringify({model:null,userModelAuthorization:false,modelAvailabilityConfirmed:false,
  maxTokens:null,maxSessions:null,maxSteps:null,logsReady:false,stopConditionsReady:false,noSensitiveData:true,
  notes:'Host review input only. It cannot issue trusted user receipts, enforce cumulative costs, or mount an executable model profile.'},null,2)+'\n',{flag:'wx'})
// Actual package names were inspected. No model/provider/agent driver included.
// This is a prepared component composition; YAML loader mounting not yet tested.
const plugin=join(ROOT,'adapters/dsh-runtime/observer-plugin.mjs').replaceAll('\\','/')
const profile=[{id:'prompt',name:'@deepseek-ai/dsh-system-prompt'}, {id:'session',name:'@deepseek-ai/dsh-session'},
  {id:'tools',name:'@deepseek-ai/dsh-tools'}, {id:'master-observer',name:plugin,config:{sessionId:'real-review-required',taskId:'A',workspace:join(directory,'real-workspace'),candidateHash:'0'.repeat(64)}}]
// JSON is valid YAML, but this alone is not proof of a mounted DSH profile.
await writeFile(join(directory,'home','profiles','master-component.cordis.yml'),JSON.stringify(profile,null,2)+'\n',{flag:'wx'})
let offline=null
if(mode==='--offline') {const output=join(directory,'mock');await mkdir(output);offline=await runScenarios(output)}
console.log(JSON.stringify({directory,mode,offlineLevels:offline?.levels,realSession:preflight,modelCalls:0}))
if(mode==='--real-preflight') process.exitCode=2
