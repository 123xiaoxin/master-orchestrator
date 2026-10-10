// Run with the installed Electron Node host (--expose-internals); never mounts
// agent/model/network/credentials services. Actual Session/ToolRuntime components
// are exercised with controller-injected events, not an actual Master session.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { pathToFileURL } = require('node:url')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')

async function main() {
  const [packages, output] = process.argv.slice(2)
  const root = path.resolve(__dirname,'..')
  const local = fs.realpathSync(path.join(root,'.local'))
  const target = path.resolve(output)
  const within = (a,b) => { const r=path.relative(a,b); return r && r !== '..' && !r.startsWith('..'+path.sep) && !path.isAbsolute(r) }
  const parent=fs.realpathSync(path.dirname(target))
  assert.ok(within(local,target) && (parent === local || within(local,parent)), 'Fresh output below repository .local required')
  fs.mkdirSync(target) // refuse overwrite
  const workspace = path.join(target,'workspace');fs.mkdirSync(workspace)
  const { Context } = require(path.join(packages,'cordis'))
  const { SystemPrompt } = require(path.join(packages,'dsh-system-prompt'))
  const { SessionStore } = require(path.join(packages,'dsh-session'))
  const { ToolRuntime } = require(path.join(packages,'dsh-tools'))
  const { createUserMessage,createToolResultMessage } = require(path.join(packages,'dsh-llm'))
  const { apply } = await import(pathToFileURL(path.join(root,'adapters/dsh-runtime/observer-plugin.mjs')).href)
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(SessionStore)
  await ctx.plugin(ToolRuntime)
  try {
    assert.ok(ctx.sessions && ctx.tools)
    const config = {sessionId:'component-probe',taskId:'probe',workspace,candidateHash:'a'.repeat(64)}
    const bridge = apply(ctx,config)
    const session = ctx.sessions.create(config.sessionId,{meta:{cwd:workspace}})
    assert.match(ctx.tools.guardReason({name:'write',args:{file_path:'hello.txt'}}),/blocked/)
    const confirmation = {version:'master_runtime_confirmation.v1',taskId:'probe',goalConfirmation:{goal:'component probe only',status:'confirmed'},
      authorization:{contractSha256:'b'.repeat(64)},execution:{authorized:true}}
    // Controller-injected host event, NEVER real user model-execution authority.
    const event = session.append('user/message',createUserMessage({source:{kind:'user'},content:[{type:'text',text:JSON.stringify(confirmation)}]}),{surfaceOp:'append'})
    assert.ok(bridge.receipt())
    const forged=JSON.parse(JSON.stringify(event))
    ctx.emit('session/event',session,forged)
    assert.deepEqual(bridge.rejected(),['forged_session_event'])
    const call = session.append('tool/call',{turn:1,step:1,callId:'probe-call',name:'write',arguments:'{"file_path":"hello.txt"}'})
    session.append('tool/result',{turn:1,step:1,message:createToolResultMessage({callId:'probe-call',isError:false,content:[{type:'text',text:'controller injected result; tool NOT executed'}]})},{surfaceOp:'append',sourceEventSeqs:[call.seq]})
    session.append('turn/end',{turn:1,reason:{kind:'completed'}})
    const trace = bridge.observer.snapshot()
    assert.equal(trace.complete,true)
    assert.equal(trace.calls[0].result.data.message.source.callId,'probe-call')
    const traceSha256=await bridge.observer.flush(path.join(target,'component-trace.json'))
    const sources = {}
    for(const name of ['dsh-desktop-host','dsh-headless','dsh-session','dsh-agent-loop','dsh-tools','dsh-skill-filesystem','dsh-agent-preset']) {
      const dir=path.join(packages,name)
      const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'))
      sources[name]={version:pkg.version,entryPath:path.join(dir,'lib/index.js'),sha256:hash(fs.readFileSync(path.join(dir,'lib/index.js')))}
    }
    const report={evidenceLevel:'Actual isolated DSH components; controller-injected events',modelCalls:0,fullDshSession:false,masterModelBehaviorObserved:false,
      toolExecuted:false,checks:{actualCordisMounted:true,actualSessionPublication:true,forgedEventRejected:true,actualToolGuardDenies:true,actualCallResultShapeMatched:true,awaitedTraceWritten:true},
      sessionFormat:session.header.version,sources,traceSha256,executionAuthorized:bridge.executionAuthorized}
    fs.writeFileSync(path.join(target,'probe.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'})
    console.log(JSON.stringify({output:target,...report}))
  } finally { await ctx.fiber.dispose() }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1})
