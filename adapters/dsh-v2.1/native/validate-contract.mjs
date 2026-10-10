// Master Execution Contract Validator —— 三层职责分离
//
//   Layer 1  Structural   : 由 master_execution_contract.*.schema.json 驱动（唯一结构事实来源）
//   Layer 2  Governance   : 本文件内的契约内部一致性规则（可机械检查）
//   Layer 3  Execution    : 现实结果是否正确 —— 不在本文件职责内，由 Execution/Verification 承担
//
// 边界纪律：Validator 不判断"设计好不好"，只判断"契约是否自洽、是否违反硬约束"。
// 用法: node validate-contract.mjs [--schema <path>] <contract.json> [...]
// 退出码: 0 = 无 ERROR; 1 = 存在 ERROR（驱动 Repair 回路）
import { readFileSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSchema, validateAgainstSchema } from './schema-validate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
let schemaPath = join(HERE, 'master_execution_contract.v2.1.schema.json')
const files = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--schema') { schemaPath = argv[++i]; continue }
  files.push(argv[i])
}

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const arr = (v) => (Array.isArray(v) ? v : [])

// ── Layer 2：治理一致性规则 ────────────────────────────────────────────────
function governance(o, err, warn) {
  const d = o.decision
  const ud = arr(o.userDecisions)
  const vr = arr(o.verificationRequired)
  const vc = arr(o.validationCriteria)
  const asm = arr(o.assumptions)
  const risks = arr(o.risks)
  const defs = o.definitions && typeof o.definitions === 'object' ? o.definitions : {}
  const score = o.executionClarity && typeof o.executionClarity === 'object' ? o.executionClarity.score : undefined
  const highUser = ud.filter((x) => x && x.impactIfUnknown === 'high')
  // 风险边界由"实际作用范围"决定，不由 decision 名字决定：prototype 与 execute 同样受约束
  const riskyAssumptions = asm.filter((a) => a && a.impact === 'high' && a.reversible === false && a.confirmed !== true)

  // ── 时序 Gate：clarify → prototype → execute ──
  if (d === 'clarify') {
    if (o.minimumPrototype !== null) err.push('[L2] clarify: minimumPrototype 必须为 null（雏形是收敛工具，不是澄清起点）')
    if (o.goalStatus !== 'working') err.push('[L2] clarify: goalStatus 必须为 "working"（当前最佳理解，不得假装已确认）')
    if (ud.length === 0) err.push('[L2] clarify: 必须至少有一个当前仍可向用户提出的决策问题；若用户已拒绝且无法安全假设，应改用 block')
    if (o.blockReason !== null) warn.push('[L2] clarify: blockReason 应为 null（非阻断状态）')
    if (o.degradePlan !== null) warn.push('[L2] clarify: degradePlan 应为 null（非降级状态）')
  }

  if (d === 'prototype') {
    if (o.minimumTaskModel === null) err.push('[L2] prototype: 必须先有 minimumTaskModel（不得跳过发散→收敛直接造雏形）')
    if (o.minimumPrototype === null) err.push('[L2] prototype: minimumPrototype 不得为 null')
    if (vr.length === 0) err.push('[L2] prototype: verificationRequired 不得为空（雏形必须可验证）')
    if (vc.length === 0) err.push('[L2] prototype: validationCriteria 不得为空')
    if (riskyAssumptions.length > 0) err.push(`[L2] prototype: 存在 ${riskyAssumptions.length} 项高影响不可逆且未确认的假设（风险由作用范围决定，不由 decision 名字决定）`)
  }

  if (d === 'execute') {
    if (o.minimumTaskModel === null) err.push('[L2] execute: minimumTaskModel 不得为 null（未收敛不得执行）')
    if (o.minimumPrototype === null) err.push('[L2] execute: minimumPrototype 不得为 null')
    if (o.goalStatus !== 'confirmed') err.push('[L2] execute: goalStatus 必须为 "confirmed"（执行前目标须经用户确认）')
    for (const f of ['correct', 'usable', 'done']) {
      if (!isStr(defs[f])) err.push(`[L2] execute: definitions.${f} 不得为空（执行前必须定义正确/可用/完成）`)
    }
    if (vc.length === 0) err.push('[L2] execute: validationCriteria 不得为空')
    if (vr.length === 0) err.push('[L2] execute: verificationRequired 不得为空')
    if (highUser.length > 0) err.push(`[L2] execute: 仍有 ${highUser.length} 项高影响 USER 决策未解决`)
    if (riskyAssumptions.length > 0) err.push(`[L2] execute: 存在 ${riskyAssumptions.length} 项高影响不可逆且未确认的假设`)
    // score 是决策辅助指标，不是硬阈值：低于启发式区间只给 WARNING
    if (typeof score === 'number' && score < 75) {
      warn.push(`[L2] execute: executionClarity.score=${score} 低于启发式就绪区间（仅提示；score 非概率、非测量值，不得作为硬阈值）`)
    }
  }

  if (d === 'degrade') {
    const p = o.degradePlan
    if (p === null || typeof p !== 'object') err.push('[L2] degrade: degradePlan 不得为 null（须说明降级后的目标、损失与理由）')
    else for (const f of ['goal', 'loss', 'rationale']) {
      if (!isStr(p[f])) err.push(`[L2] degrade: degradePlan.${f} 不得为空`)
    }
  }

  if (d === 'block') {
    if (!isStr(o.blockReason)) err.push('[L2] block: blockReason 不得为空（须说明为何不能执行、什么条件可解除）')
    if (risks.length === 0) err.push('[L2] block: risks 不得为空（须说明阻断所针对的风险）')
  }

  // ── Decision Ownership Consistency（启发式，仅 WARNING）──
  const tokens = (s) => {
    const t = new Set()
    for (const w of String(s).toLowerCase().match(/[a-z0-9]{3,}/g) || []) t.add(w)
    for (const c of String(s).match(/[\u4e00-\u9fa5]{2,}/g) || []) t.add(c)
    return t
  }
  for (const u of ud) {
    if (!u || !isStr(u.question)) continue
    const ut = tokens(u.question)
    for (const a of arr(o.agentDecisions)) {
      if (!a || !isStr(a.decision)) continue
      const at = tokens(a.decision)
      const overlap = [...ut].filter((x) => at.has(x))
      if (overlap.length > 0) {
        warn.push(`[L2] ownership-consistency: userDecisions 与 agentDecisions 可能重叠（共同 token: ${overlap.slice(0, 3).join(', ')}）——同一决策不得同时归属用户与 Agent`)
      }
    }
  }

  // ── definitions 一致性 ──
  if (isStr(defs.correct) && isStr(defs.done)) {
    if (defs.correct.trim() === defs.done.trim()) {
      err.push('[L2] definitions.done 与 definitions.correct 完全相同：Done 必须额外包含可用/完成条件')
    } else if (defs.done.trim().length < defs.correct.trim().length / 2) {
      warn.push('[L2] definitions.done 明显短于 definitions.correct —— 仅启发式提示，长度不等于强弱')
    }
  }

  // ── 单一协议纪律 ──
  const ie = o.intentEvidence
  if (ie && typeof ie === 'object' && 'schemaVersion' in ie) {
    err.push('[L2] intentEvidence 内含独立 schemaVersion：模块只能添加证据，最终状态只能由 Master Contract 定义')
  }
}

/** 对单个已解析契约执行 Layer 1 + Layer 2 检查。 */
export function checkContract(o, schema) {
  const errors = []
  const warnings = []
  for (const e of validateAgainstSchema(schema, o)) errors.push(`[L1] ${e}`)
  if (errors.length === 0) governance(o, errors, warnings)
  return { errors, warnings }
}

// ── 执行（仅作为 CLI 时）────────────────────────────────────────────────────
const isCli = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/validate-contract.mjs')
if (isCli) {
  const schema = loadSchema(schemaPath)
  let failed = 0
  for (const f of files) {
    let o
    try {
      o = JSON.parse(readFileSync(f, 'utf8'))
    } catch (e) {
      console.log(`${basename(f)}: FAIL\n    [L1] parse: ${e.message}`)
      failed++
      continue
    }
    const { errors, warnings } = checkContract(o, schema)
    const name = basename(f)
    if (errors.length === 0 && warnings.length === 0) {
      console.log(`${name}: PASS (L1 + L2)`)
    } else if (errors.length === 0) {
      console.log(`${name}: PASS (L1 + L2, ${warnings.length} warning)`)
      for (const w of warnings) console.log(`    ${w}`)
    } else {
      failed++
      console.log(`${name}: FAIL (${errors.length} error, ${warnings.length} warning)`)
      for (const e of errors) console.log(`    ${e}`)
      for (const w of warnings) console.log(`    ${w}`)
    }
  }
  console.log(`\nschema: ${basename(schemaPath)}`)
  process.exit(failed > 0 ? 1 : 0)
}
