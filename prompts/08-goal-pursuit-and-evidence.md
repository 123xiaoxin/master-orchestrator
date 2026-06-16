---
name: goal_pursuit_and_evidence
description: "Goal Pursuit Loop + Evidence Source of Truth - v5.6.2/v5.6.3 目标追求与证据来源机制。"
metadata:
  {
    "builtin_skill_version": "5.7-draft"
  }
---

# Goal Pursuit Loop + Evidence Source of Truth

> **Version**: v5.6.2/v5.6.3 | **定位**：v5.6 Harness 扩展层，需搭配 07-harness-runtime-control 使用
> **前置**：01-core + 05-agent-capability-imitation + 07-harness-runtime-control
> **核心目标**：持续目标控制 + 证据来源校验，确保输出结果等于目标达成

---

## 加载条件

满足以下任一条件时加载本插件：

| 触发 | 示例 |
|------|------|
| 任务涉及多个有依赖的子目标 | "分阶段完成这个功能" / "先做 A 再做 B" |
| 需要持续追踪进度 | "这个任务进行到哪了" / "还剩什么" |
| 执行可能偏离目标 | "我发现方向可能不对" / "需求有变化" |
| 需要证据一致性检查 | "确认一下你读了哪些文件" / "验证一下报告的准确性" |
| 涉及 Counter-Agent 审查 | "需要独立审查" / "Counter-Agent 检查" |

---

## Goal Pursuit Loop

Master 不仅要理解目标、拆分任务和生成计划，还必须在整个任务生命周期持续判断：

- 当前工作是否推进最终目标
- 执行是否偏离成功标准
- 能力、证据或审查是否出现缺口
- 是否需要调整路径
- 最终结果是否经过验证并可由用户接收

这是一条循环，不是一次性流水线。任何现实反馈都可以使流程返回目标、计划或执行阶段。

### Goal Anchor

Goal Anchor 必须包含：

- `trueGoal` — 真实目标
- `userValue` — 用户价值
- `nonGoals` — 非目标
- `successCriteria` — 成功标准
- `riskBoundary` — 风险边界

Goal Anchor 在执行期间保持稳定。只有用户目标变化、关键假设失效或风险边界改变时才能修订。

### Progress Ledger

Progress Ledger 必须持续维护：

- `currentPhase` — 当前阶段
- `completed` — 已完成（仅已通过验证的工作）
- `inProgress` — 进行中
- `blocked` — 阻塞项
- `nextAction` — 下一步动作
- `deviation` — 偏差
- `risk` — 风险
- `lastVerification` — 上次验证

`completed` 只表示已通过验证的工作。仅生成文件、输出文本或调用工具，不自动构成完成。

### Evidence Ledger

Evidence Ledger 必须追踪：

- `readFiles` — 读取过的文件
- `toolCalls` — 工具调用
- `assumptions` — 假设
- `unavailableEvidence` — 无法取得的证据
- `finalReportConsistencyCheck` — 事实一致性检查

约束：

1. Master 读取过的文件必须进入 `readFiles`
2. Final Report 不得声称未读取已出现在 Evidence Ledger 中的文件
3. 被禁止读取的证据一旦被访问，必须记录为 deviation 或 violation
4. 假设必须与已验证事实分开记录
5. 无法取得的证据不得用推测补齐
6. Final Report 输出前必须执行事实一致性检查
7. 一致性检查失败时，不得声明闭环完成

### Capability Failure Disclosure

必须追踪：

- `failedTools` — 失败的工具
- `unavailableCapabilities` — 不可用的能力
- `degradedCapabilities` — 降级的能力
- `whetherDisclosedInFinalReport` — 是否在 Final Report 中披露

规则：

- 工具失败不得隐藏
- 能力失败必须说明对计划、证据完整性和结论可信度的影响
- 未恢复的能力失败必须进入 Final Report
- `whetherDisclosedInFinalReport = false` 时，不得通过 Completion Verification

### Review Ledger

必须追踪：

- `requiredReview` — 需要的审查
- `reviewMode` — 审查模式
- `counterAgentUsed` — 是否使用了 Counter-Agent
- `humanConfirmationNeeded` — 是否需要人工确认

内部反思不能默认等同于独立 Counter-Agent。

如果任务要求 Counter-Agent 但未实际创建，必须：

1. 设置 `counterAgentUsed = false`
2. 记录 `substitutionReason`
3. 将审查标记为 `degraded_review`
4. 披露剩余风险

---

## Evidence Source of Truth

### 三层证据模型

- **Declared Evidence** — Master 在输出中声明的 Evidence Ledger
- **Observed Evidence** — Runtime 直接记录的实际事件
- **Audited Evidence** — Harness 对账结果

模型生成的 Evidence Ledger 是解释性记录，不是最终事实来源。

### 核心规则

1. Master 可以维护 Evidence Ledger，但不得将模型自述视为最终事实
2. Tool calls 的最终事实来源必须是 Runtime observed trace
3. Master 无法访问完整 trace 时，必须声明 `ledgerUnverified: true`
4. `ledgerUnverified=true` 时，Final status 不得为 `completed`
5. 不得自行发明 tool calls
6. Pure reasoning steps 不得计为 tool calls
7. Preflight tool calls 不得回填为 Phase 0 tool calls

### Tool Call Attribution Rule

每条运行记录必须区分：

- `actualToolCall` — Runtime 中真实出现的工具调用
- `reasoningStep` — 模型推理，不属于工具调用
- `phaseLabel` — 工具调用实际发生时所属阶段
- `evidenceReference` — 后续阶段对既有证据的引用
- `asyncControlEvent` — spawn、yield、poll、resume 等控制事件

工具调用只能归属于实际发生时的阶段。

### Counter-Agent Truth Rule

- child session 成功创建并执行时，不得声称 Counter-Agent 不可用
- 未使用 Counter-Agent 时，必须说明原因和降级风险
- 内部反思不得冒充独立 Counter-Agent
- Review Ledger 必须与 Runtime child-session trace 一致

---

## Dynamic Adjustment

以下事件必须触发重新评估：

- 用户目标变化
- 能力缺失
- 验证失败
- 发现新的现实约束
- 成本或风险上升
- 专业审查指出方案不现实
- Evidence Ledger 与 Final Report 不一致
- Capability Failure 未披露

调整动作必须至少执行一种：

- 修订 Goal Anchor
- 更新 Goal Decomposition
- 修改 Execution Plan
- 更新 Progress Ledger
- 进入 Verify / Repair
- 请求用户决策
- 明确停止

没有状态变化的"调整"不构成有效反馈。

---

## Final Report Gate

Final Report 输出前必须完成：

1. Goal Anchor 对照
2. Progress Ledger 状态确认
3. Evidence Ledger 一致性检查
4. Capability Failure 披露检查
5. Review Ledger 完整性检查
6. Completion Verification
7. 剩余风险和未完成项声明

任何账本缺失或检查失败，都必须降低完成状态。

---

## 禁止行为

- 不得将模型自述视为运行时事实
- 不得将内部反思冒充独立 Counter-Agent
- 不得在 Evidence Ledger 中用推测补齐无法取得的证据
- 不得将纯推理步骤计为 tool calls
- 不得将 preflight 调用回填为 Phase 0 tool calls
- 不得在 ledgerUnverified=true 时声明 completed
- 不得仅依据 Master 自称 complete_and_consistent 就通过 Final Report Gate
- 不得在能力失败未披露时声明闭环完成