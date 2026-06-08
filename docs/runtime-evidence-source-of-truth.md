# Runtime Evidence Source of Truth

Version: v5.6.3 Draft  
Layer: Harness Layer

## Scope

本文定义 Harness 层的运行时事实来源机制，用于约束 Master 的证据声明、工具调用归属和 Final Report。

本文是设计文档，不是 runtime implementation。本轮不新增 schema、helper、自动化代码或 installed skill 补丁。

## 1. 定义

Runtime Evidence Source of Truth 用于区分三类信息：

- 模型声明了什么；
- Runtime 实际执行了什么；
- Harness 审计确认了什么。

模型生成的 Evidence Ledger 是解释性记录，不是最终事实来源。OpenClaw session JSONL、从中提取的 `tool-calls.json` 以及 `harness-audit.json` 才构成可审计的运行时事实链。

## 2. 三层证据模型

### Declared Evidence

Master 在输出中声明的 Evidence Ledger，包括：

- tool calls
- read files
- phase attribution
- assumptions
- capability failures
- Counter-Agent 状态
- evidence references

Declared Evidence 可能存在遗漏、误记或错误归属，必须经过对账。

### Observed Evidence

由 Runtime 直接记录的实际事件，包括：

- OpenClaw session JSONL
- `tool-calls.json`
- tool result
- async control event
- child session
- error and completion status

Observed Evidence 是工具调用是否发生、何时发生、属于哪个执行区段的主要事实来源。

### Audited Evidence

Harness 对 Declared Evidence 和 Observed Evidence 的机械对账结果，保存于 `harness-audit.json`。

Audited Evidence 应识别：

- 未记账调用
- 虚构调用
- 阶段归属错误
- 异步边界缺口
- Counter-Agent 状态矛盾
- Final Report 与 Runtime 不一致

## 3. 核心规则

1. Master 可以维护 Evidence Ledger，但不得将模型自述视为最终事实。
2. Tool calls 的最终事实来源必须是 Runtime observed trace。
3. Master 无法访问完整 trace 时，必须声明：

   ```yaml
   ledgerUnverified: true
   ```

4. `ledgerUnverified=true` 时，Final status 不得为 `completed`，只能为 `partial`、`blocked` 或 `failed`。
5. 不得自行发明 tool calls。
6. Pure reasoning steps 不得计为 tool calls。
7. Preflight tool calls 不得回填为 Phase 0 tool calls。
8. 不得写反 `sessions_spawn`、`sessions_yield`、child session 或 Counter-Agent 的真实结果。
9. Harness 审计结论高于模型对自身账本完整性的声明。

## 4. Tool Call Attribution Rule

每条运行记录必须区分：

| 类型 | 定义 |
|---|---|
| `actualToolCall` | Runtime 中真实出现的工具调用 |
| `reasoningStep` | 模型推理或文本处理，不属于工具调用 |
| `phaseLabel` | 工具调用实际发生时所属阶段 |
| `evidenceReference` | 后续阶段对既有证据的引用 |
| `asyncControlEvent` | spawn、yield、poll、resume 等控制事件 |

工具调用只能归属于实际发生时的阶段。

后续阶段引用已有证据时，只能记录为 `evidenceReference`，不得重新归属为该阶段的 tool call。

## 5. Async Boundary Rule

以下行为构成 Async Boundary：

- `sessions_spawn`
- `sessions_yield`
- `process`
- long-running `exec`
- Counter-Agent wait
- child session resume

Async Boundary 前后均必须存在 Runtime event trace。

如果 Master 在 yield 前无法获得完整账本，必须声明：

```yaml
interimLedgerIncomplete: true
ledgerUnverified: true
finalStatus: partial
```

恢复执行后必须：

1. 读取或接收新增 observed trace；
2. 对账 yield 前后的工具调用；
3. 补充失败和未完成事件；
4. 更新 Interim Ledger Snapshot；
5. 不得把恢复后的对账结果伪装为 yield 前已经完成。

## 6. Counter-Agent Truth Rule

`counterAgentUsed` 的事实依据包括：

- `sessions_spawn` 调用结果；
- child session 是否创建；
- child session 是否完成；
- `sessions_yield` 或结果回传事件。

规则：

- child session 成功创建并执行时，不得声称 Counter-Agent 不可用；
- 未使用 Counter-Agent 时，必须说明原因和降级风险；
- Counter-Agent 已使用但审查不支持继续时，必须如实披露；
- 内部反思不得冒充独立 Counter-Agent；
- Master 的 Review Ledger 必须与 Runtime child-session trace 一致。

## 7. Phase Path Consistency Rule

Phase 路径描述必须与 observed trace 一致。

如果 Phase 0 声称采用 Path B、pure reasoning 或仅复用 Preflight 证据，则 Phase 0 不应同时发生：

- `memory_get`
- `validate_templates`
- `exec`
- 其他环境探测工具调用

如果发生这些调用，路径必须标记为 `tool-assisted path`。

如果 Phase 0 仅引用 Preflight 结果，应记录：

```yaml
phase0Status: pending
phase0EvidenceSource: preflight_probe
phase0Completed: false
evidenceReference:
  - preflight_event_id
```

不得将 Preflight 调用写成 Phase 0 tool call。

## 8. Final Report Source-of-Truth Gate

Final Report 通过前必须回答：

```yaml
sourceOfTruthGate:
  declaredEvidenceMatchesObservedEvidence: true|false
  unaccountedToolCalls: []
  inventedToolCalls: []
  phaseAttributionMismatch: []
  counterAgentTruthMismatch: []
  asyncBoundaryIncomplete: true|false
  ledgerUnverified: true|false
```

以下任一条件成立时，Final status 必须降级为 `partial`、`blocked` 或 `failed`：

- `unaccountedToolCalls` 非空；
- `inventedToolCalls` 非空；
- `phaseAttributionMismatch` 非空；
- `counterAgentTruthMismatch` 非空；
- `asyncBoundaryIncomplete=true`；
- `ledgerUnverified=true`；
- Declared Evidence 与 Observed Evidence 不一致。

不得仅依据 Master 声称 `complete_and_consistent` 就通过 Final Report Gate。

## 9. 与 v5.6.2.4 的关系

v5.6.2.4 已修复 Preflight Evidence Reuse Boundary：

- Preflight 不再自动等同于 Phase 0；
- Phase 0 可以明确标记为 pending；
- Preflight 证据可以作为 reference 使用；
- 工具调用开始按实际阶段归属。

B1.4 同时证明，仅依赖 Prompt 或 installed skill 规则仍不足以保证事实一致性：

- 实际 `read`、`process` 被漏记；
- pure reasoning 被误算为 tool calls；
- Async Boundary 前缺少账本快照；
- Counter-Agent 能力状态被写反；
- Phase 0 路径描述与实际调用不一致。

因此 Runtime Evidence Source of Truth 属于 Harness Layer 设计，不应继续被视为单纯的 prompt patch。

## 10. 后续工程化建议

1. 暂停继续追加 installed skill 补丁。
2. 将 B1、B1.1、B1.2、B1.3、B1.4 保留为 benchmark evidence。
3. 后续设计 runtime ledger schema，但本轮不新增 schema。
4. 由 Harness 从 session JSONL 自动生成 Evidence Ledger draft。
5. 自动提取 tool call、tool result、phase、child session 和 async event。
6. 自动计算 declared/observed diff。
7. Master 负责解释、确认和披露差异。
8. Master 不负责凭记忆重构完整 tool trace。
9. Final Report Gate 必须消费 Harness 审计结果后才能确定最终状态。

## Final Principle

- 模型声明不是运行时事实。
- Runtime trace 决定实际发生了什么。
- Harness audit 决定声明是否可信。
- Evidence Ledger 可以由 Master 解释，但必须由 Runtime 证据校验。
- 输出完整不等于证据完整。
- 没有 Source-of-Truth Gate，就不能可信地声明 `completed`。
