import { constants, lstatSync, realpathSync } from 'node:fs'
import { open, realpath } from 'node:fs/promises'
import { resolve, join, basename } from 'node:path'

/** Deliberately narrow application-level capability, NOT an OS sandbox.
 * Only flat, named test files. Exclusive creation never overwrites existing
 * files; no shell, network, links, directories, delete, plugin, or Agent tools.
 */
export class IsolatedFiles {
  #root
  #allow
  #audit=[]
  constructor(workspace,{writeFiles=[],readFiles=[]}={}) {
    this.#root=realpathSync(workspace)
    this.#allow={write:new Set(writeFiles),read:new Set(readFiles)}
    for(const name of [...writeFiles,...readFiles])this.#name(name)
  }
  #name(file) {
    if(typeof file!=='string'||!file||basename(file)!==file||!/^[-a-zA-Z0-9_.]+$/u.test(file)||['.','..'].includes(file)||/[.:]$/u.test(file)||file.includes(':')||/^con(?:\.|$)|^nul(?:\.|$)|^prn(?:\.|$)|^aux(?:\.|$)|^(com|lpt)[1-9](?:\.|$)/iu.test(file))throw new Error('Only safe flat filenames supported')
  }
  check(operation,file) {
    try {
      this.#name(file)
      if(!this.#allow[operation]?.has(file))throw new Error('File operation not explicitly authorized')
      if(realpathSync(this.#root)!==this.#root)throw new Error('Workspace identity changed')
      const filename=join(this.#root,file)
      if(resolve(filename)!==filename)throw new Error('Noncanonical target')
      try {const st=lstatSync(filename);if(st.isSymbolicLink()||!st.isFile()||st.nlink!==1)throw new Error('Links or nonregular files refused')}
      catch(error){if(!(operation==='write'&&error.code==='ENOENT'))throw error}
      return {allowed:true}
    }catch(error){return {allowed:false,reason:error.message}}
  }
  async execute(operation,file,content) {
    const admitted=this.check(operation,file)
    this.#audit.push({operation,file,...admitted,source:'host file capability; actual IO when successful'})
    if(!admitted.allowed)throw new Error(admitted.reason)
    const filename=join(this.#root,file)
    if(operation==='write') {
      if(typeof content!=='string'||Buffer.byteLength(content)>4096)throw new Error('Bounded text content required')
      const handle=await open(filename,'wx',0o600)
      try {await handle.writeFile(content);await handle.sync()}finally{await handle.close()}
      return {file,bytes:Buffer.byteLength(content),operation:'exclusive_create'}
    }
    const handle=await open(filename,constants.O_RDONLY | (constants.O_NOFOLLOW??0))
    try {
      const stat=await handle.stat()
      if(!stat.isFile()||stat.nlink!==1||stat.size>4096||await realpath(filename)!==filename)throw new Error('Unsafe or oversized read')
      return {file,content:await handle.readFile('utf8'),operation:'read'}
    }finally{await handle.close()}
  }
  audit(){return structuredClone(this.#audit)}
}
