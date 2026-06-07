# Goal Pursuit Loop

> Version: v5.6.2 Draft
> Layer: Harness Layer Supplement
> Baseline: master-orchestrator v5.6.1 + Photo Print Software Reproduction Benchmark Run A

## 1. 定位与范围

Goal Pursuit Loop 是 Master 的持续目标控制机制。

Master 不仅要理解目标、拆分任务和生成计划，还必须在整个任务生命周期持续判断：

- 当前工作是否推进最终目标；
- 执行是否偏离成功标准；
- 能力、证据或审查是否出现缺口；
- 是否需要调整路径；
- 最终结果是否经过验证并可由用户接收。

```text
Goal Anchor
-> Goal Decomposition
-> Execution Plan
-> Progress Tracking
-> Dynamic Adjustment
-> Completion Verification
-> Final Report
```

这是一条循环，而不是一次性流水线。任何现实反馈都可以使流程返回目标、计划或执行阶段。

本文是 Harness 设计文档，不是 runtime implementation；不新增 schema、helper scripts、OpenClaw hooks 或自动执行机制。

## 2. 与普通任务拆解的区别

任务拆解只回答“事情可以分成哪些步骤”。

Goal Pursuit Loop 还必须回答：

- 这些步骤是否仍服务于真实目标；
- 当前状态与成功标准相差多少；
- 新证据是否推翻了原计划；
- 能力失败是否影响结论可信度；
- 专业审查是否真实发生；
- 输出完成是否等于目标达成。

任务拆解是结构化工作；目标追求是持续反馈控制。

## 3. 核心组件

| 组件 | 职责 |
|---|---|
| Goal Anchor | 固定真实目标、用户价值、非目标和成功边界 |
| Goal Decomposition | 将目标转换为可验证的子目标与依赖 |
| Execution Plan | 定义执行路线、阶段、资源、风险和验证方式 |
| Progress Ledger | 记录阶段状态、阻塞、偏差和下一动作 |
| Dynamic Adjustment | 根据现实反馈修订目标契约或执行路径 |
| Completion Verification | 判断原始目标是否真实达成 |
| Evidence Ledger | 记录事实来源并保证 Final Report 一致 |
| Capability Failure Disclosure | 披露不可用、失败或降级的能力 |
| Review Ledger | 证明专业审查和 Counter-Agent 是否真实发生 |

## 4. Goal Anchor

Goal Anchor 必须包含：

- `trueGoal`
- `userValue`
- `nonGoals`
- `successCriteria`
- `riskBoundary`

Goal Anchor 在执行期间保持稳定。只有用户目标变化、关键假设失效或风险边界改变时才能修订。

任何修订必须记录原因、影响范围和新的验证条件。

## 5. Goal Decomposition

每个子目标必须包含：

- 可观察的交付结果；
- 前置依赖；
- `verificationSignal`；
- `completionCondition`；
- 对 `trueGoal` 的贡献。

无法说明如何推进真实目标的子任务，不应进入 Execution Plan。

## 6. Execution Plan

Execution Plan 必须把 Goal Decomposition 转换为可执行、可验证、可调整的阶段计划，至少包含：

- 推荐执行路线；
- Phase 边界与顺序；
- 文件、模块或交付物计划；
- 每个阶段的验证信号；
- 风险、授权要求和 fallback；
- 计划失败后返回 Goal Anchor 或 Goal Decomposition 的条件。

Execution Plan 不能直接消费未经确认的模糊需求，也不能通过合并 Phase 绕过 Phase Gate。

## 7. Progress Ledger

Progress Ledger 必须持续维护：

- `currentPhase`
- `completed`
- `inProgress`
- `blocked`
- `nextAction`
- `deviation`
- `risk`
- `lastVerification`

Phase 必须分别记录，禁止通过合并标题或状态绕过 Phase Gate。

`completed` 只表示已通过验证的工作。仅生成文件、输出文本或调用工具，不自动构成完成。

## 8. Evidence Ledger

Evidence Ledger 必须追踪：

- `readFiles`
- `inspectedDirectories`
- `toolCalls`
- `assumptions`
- `unavailableEvidence`
- `forbiddenEvidence`
- `finalReportConsistencyCheck`

约束：

1. Master 读取过的文件必须进入 `readFiles`。
2. Final Report 不得声称未读取已经出现在 Evidence Ledger 中的文件。
3. 被禁止读取的证据一旦被访问，必须记录为 `deviation` 或 `violation`。
4. 假设必须与已验证事实分开记录。
5. 无法取得的证据必须进入 `unavailableEvidence`，不得用推测补齐。
6. Final Report 输出前必须执行事实一致性检查。
7. 一致性检查失败时，不得声明闭环完成。

## 9. Capability Failure Disclosure

Capability Failure Disclosure 必须追踪：

- `failedTools`
- `unavailableCapabilities`
- `degradedCapabilities`
- `memorySearchFailures`
- `capabilityGapRoute`
- `whetherDisclosedInFinalReport`

规则：

- `memory_search`、RAG、MCP、CLI、Agent 或其他工具失败不得隐藏。
- 能力失败必须说明对计划、证据完整性和结论可信度的影响。
- Master 必须选择：重试、降级、替代能力、请求用户处理或停止。
- 未恢复的能力失败必须进入 Final Report。
- `whetherDisclosedInFinalReport = false` 时，不得通过 Completion Verification。

## 10. Review Ledger

Review Ledger 必须追踪：

- `requiredReview`
- `reviewMode`
- `internalChecklist`
- `specialistPerspective`
- `counterAgentUsed`
- `humanConfirmationNeeded`
- `substitutionReason`

审查模式至少区分：

- `internal_checklist`
- `specialist_review`
- `independent_counter_agent`
- `human_review`
- `degraded_review`

内部反思不能默认等同于独立 Counter-Agent。

如果任务要求 Counter-Agent 但未实际创建，必须：

1. 设置 `counterAgentUsed = false`；
2. 记录 `substitutionReason`；
3. 将审查标记为 `degraded_review`；
4. 披露剩余风险；
5. 判断是否需要用户确认后才能继续。

## 11. Dynamic Adjustment

以下事件必须触发重新评估：

- 用户目标变化；
- 能力缺失；
- 验证失败；
- 发现新的现实约束；
- 成本或风险上升；
- 专业审查指出方案不现实；
- 用户反馈方向偏差；
- Evidence Ledger 与 Final Report 不一致；
- Capability Failure 未披露。

调整动作必须至少执行一种：

- 修订 Goal Anchor；
- 更新 Goal Decomposition；
- 修改 Execution Plan；
- 更新 Progress Ledger；
- 进入 Verify / Repair；
- 请求用户决策；
- 明确停止。

没有状态变化的“调整”不构成有效反馈。

## 12. Completion Verification

Completion Verification 必须回答：

- 原始目标是否达成；
- 子目标是否完成；
- 验证是否通过；
- 用户是否能够接收结果；
- 剩余风险是否已经说明；
- Evidence Ledger 是否与 Final Report 一致；
- Capability Failure 是否已经披露；
- Review Ledger 是否满足任务风险等级。

任何答案为“否”或“未知”时，只能报告 `partial`、`blocked` 或 `failed`，不得声明完成。

## 13. 与 Harness Runtime Control 的关系

| 机制 | 控制对象 |
|---|---|
| Phase Gate | 执行顺序与阶段纪律 |
| Goal Pursuit Loop | 最终方向和目标持续性 |
| Evidence Ledger | 事实来源与报告一致性 |
| Capability Failure Disclosure | 能力状态透明度 |
| Review Ledger | 审查真实性与独立性 |
| Verify / Repair | 局部验证失败及有限修复 |
| Final Report | 闭环收口与剩余风险披露 |

Phase Gate 防止乱序；Goal Pursuit Loop 防止方向正确但执行漂移，或步骤完成但目标未达成。

## 14. 与 Agent Performance Stack 的关系

- Goal Pursuit Loop 主要属于 **Harness Layer**。
- Evidence Ledger 连接 **Harness Layer** 与 **RAG / Memory Layer**。
- Capability Failure Disclosure 连接 **Skill Layer、RAG / Memory Layer、Harness Layer**。
- Review Ledger 连接 **Prompt Layer、Skill Layer、Harness Layer**。

Goal Pursuit Loop 不替代模型能力，但必须使模型、工具、Skill 和记忆层的失败可观察、可归因。

## 15. Photo Print Benchmark Run A 依据

| Run A baseline gap | v5.6.2 控制机制 |
|---|---|
| 读取源码后声称未读取 | Evidence Ledger + Final Report consistency check |
| 合并 Phase 1 和 Phase 2 | Phase Discipline + Progress Ledger |
| 内部反思替代 Counter-Agent | Review Ledger + degraded review disclosure |
| `memory_search` 失败未披露 | Capability Failure Disclosure |

Run A 同时证明：结构完整不等于过程合规，字段存在不等于事实可信。

## 16. Final Report Gate

Final Report 输出前必须完成：

1. Goal Anchor 对照；
2. Progress Ledger 状态确认；
3. Evidence Ledger 一致性检查；
4. Capability Failure 披露检查；
5. Review Ledger 完整性检查；
6. Completion Verification；
7. 剩余风险和未完成项声明。

任何账本缺失或检查失败，都必须降低完成状态。

如果任何必需账本缺失、不一致或未披露，Final status 必须降级为 `partial`、`blocked` 或 `failed`，不得声明 `completed`。

## 17. 最终原则

- Master 不只是执行任务，而是持续追求目标。
- 没有进度追踪，就没有长任务控制。
- 没有证据账本，就没有事实一致性。
- 没有能力失败披露，就没有可信 Final Report。
- 没有审查账本，就不能证明 Counter-Agent 或 Specialist Review 真实发生。
- 输出结果不等于目标达成。
- 阶段完成不等于目标完成。
- 只有目标、证据、能力、审查和验证形成一致闭环，才能声明完成。
