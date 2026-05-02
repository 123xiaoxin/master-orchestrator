# Agent Pack Templates

Agent Pack 模板用于保存一组可复用的专家组合。模板只引用专家名，不复制
`agency-agents` 的专家定义；运行时脚本会从
`~/.openclaw/agency-agents/<expert-name>/AGENTS.md` 读取冷数据并创建临时 Agent。

## 设计原则

- 每个任务默认创建 1-5 个临时 Agent。
- 简单任务可以不创建专家，由主 Agent 自执行。
- 运行实例默认是临时产物，任务结束后选择 `destroy`、`keep` 或 `archive-template`。
- 长期保留的是模板，不是带上下文和临时文件的运行 workspace。
- 模板默认不声明 channel bindings；需要长期对外服务时，应创建独立的长期 OpenClaw Agent。
- 每个专家条目应尽量携带 `microSop`，让派工像 SOP，而不是一句模糊任务。

## 目录

| 路径 | 说明 |
|------|------|
| `templates/*.json` | 通用 Agent Pack 模板 |
| `schemas/agent_pack.v1.schema.json` | 模板结构参考 |
| `schemas/micro_sop.v1.schema.json` | Micro-SOP 结构参考 |

## 字段

| 字段 | 说明 |
|------|------|
| `name` | 模板名，用于生成 PackId |
| `schemaVersion` | 建议使用 `agent_pack.v1` |
| `description` | 适用场景 |
| `maxAgents` | 最大 Agent 数，建议不超过 5 |
| `execution` | 协作方式说明，如 `serial_then_parallel` |
| `cleanupPolicy` | 默认收尾策略，建议 `ask` |
| `agents` | 专家列表，按执行顺序排列 |

`agents` 可以写成字符串数组，也可以写成对象数组。对象形式支持：

```json
{
  "name": "frontend-developer",
  "role": "实现前端页面",
  "dependsOn": ["ui-designer"],
  "microSop": {
    "schemaVersion": "micro_sop.v1",
    "context": "先读哪些文件 / 使用哪些上游结果",
    "deliverable": "具体交付物",
    "negativeConstraints": ["绝对不能做什么"],
    "exitCondition": "停止条件",
    "budget": {
      "tokenBudget": null,
      "maxRounds": 3,
      "timeoutMinutes": 30,
      "heartbeat": 0
    }
  }
}
```

`microSop` 字段用于 Phase 4 派工，标准含义：

| 字段 | 说明 |
|------|------|
| `context` | 先读哪些文件、依赖哪些上游结果 |
| `deliverable` | 具体可交付产物 |
| `negativeConstraints` | 禁止操作，防止越权和范围蔓延 |
| `exitCondition` | 明确停止条件 |
| `budget` | token、轮次、超时和 `heartbeat=0` |

## 调用

Phase 0 先检查环境：

```powershell
.\helpers\check_env.ps1
```

```powershell
.\helpers\create_agent_pack.ps1 `
  -TemplateFile .\templates\webapp-build.json `
  -TaskTitle "Build landing page MVP" `
  -ExecutionMode expert-hosted `
  -SuccessCriteria "App runs without errors" `
  -UserConfirmed
```

预览而不创建 Agent：

```powershell
.\helpers\create_agent_pack.ps1 -TemplateFile .\templates\webapp-build.json -DryRun
```

任务结束后：

```powershell
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action destroy
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action keep
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action archive-template
```

`create_agent_pack.ps1` 创建前会校验专家存在、依赖存在、无自依赖、无循环依赖；创建失败默认自动回滚已创建的临时 Agent。
