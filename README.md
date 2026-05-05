# Master Orchestrator (v5.4 / v5.5-phase-1)

> 为 OpenClaw 打造的微内核运行时治理器。它不是多 Agent 群聊系统，而是把模糊用户意图编译成安全、可执行、可追溯调度蓝图的 Master 主控层。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-2.1+-blue.svg)](https://github.com/openclaw/openclaw)

## Current Positioning

Master Orchestrator 的现行阶段目标是建立调度纪律，而不是追求 Agent 数量。

**v5.4 turns Master Orchestrator's governance rules into enforceable contracts: schemas, examples, validators, encoding checks, and offline prompt eval cases.**

**v5.5 adds an Agent Capability Imitation Layer that codifies mature Agent engineering habits:**

- Repository Execution Mode
- Context Retrieval Mode
- Conservative Editing Mode
- Verify/Repair Loop
- Phase 4 Internal State Machine
- Final Engineering Report

**v5.4 将 Master Orchestrator 的治理规则固化为可执行契约：Schema、示例、校验器、编码检查和离线 Prompt 评估用例。**

- **Master-First**: 默认由主代理执行。只有任务确实需要专业能力、独立验证、并行分工或受控隔离时，才创建临时 Agent / Sub-agent。
- **Analysis as Compilation**: 主控先把自然语言请求编译成 `task_analysis.v1` 和 `agent_pack.v1`，再决定路由。
- **Cold Expert Library**: `agency-agents` 长期放在 `~/.openclaw/agency-agents/`，不把 100+ 专家全部注册成常驻 Agent。
- **Strict Override**: 用户自建 Agent 默认不进入自动调度池；只有通过能力校验和任务契约匹配后，未来才可作为候选。
- **Default Minimalism**: 默认不创建代理、不启用 heartbeat、不保留临时对象。任务结束后优先销毁，长期沉淀模板。

## Repository Layout

```text
master-orchestrator/
├── README.md
├── TODO.md
├── prompts/
│   ├── 01-core-master-framework.md
│   ├── 02-agency-dispatch.md
│   ├── 03-quality-flywheel.md
│   ├── 04-skillcraft.md
│   └── 05-agent-capability-imitation.md
├── helpers/
│   ├── check_env.ps1
│   ├── validate_templates.ps1
│   ├── validate_task_analysis.ps1
│   ├── create_temp_expert.ps1
│   ├── cleanup_temp.ps1
│   ├── create_agent_pack.ps1
│   └── finalize_agent_pack.ps1
├── scripts/
│   └── check_encoding.ps1
├── schemas/
│   ├── task_analysis.v1.schema.json
│   ├── agent_pack.v1.schema.json
│   └── micro_sop.v1.schema.json
├── templates/
│   ├── README.md
│   ├── webapp-build.json
│   └── content-campaign.json
├── examples/
│   ├── web-landing-page.md
│   └── task-analysis/
├── evals/
│   ├── README.md
│   ├── run_prompt_evals.ps1
│   └── cases/
└── LICENSE
```

## Execution Pipeline

整个系统被划分为 Phase -1 到 Phase 5。严禁跳步、合并或在确认前创建临时 Agent。

| Phase | 名称 | 核心动作 | 产物 / 断点 |
|-------|------|---------|-------------|
| -1 | 需求澄清 | 模糊请求进入 3-5 轮漏斗式追问；丰满请求直接放行 | 当前假设快照 |
| 0 | 环境快照 | 只读检查模型、工具权限、专家库、模板、OpenClaw agents | `check_env.ps1` JSON |
| 1 | 剖面与转码 | 输出 Intent、Deliverables、Constraints、Success Criteria、Non-Goals | `task_analysis.v1` |
| 2 | 能力匹配 | 在冷专家库硬匹配能力；缺失则降级协商，不捏造专家 | capability mapping |
| 3 | 契约确认 | 输出路由决策和兵力部署表，等待用户确认模式 | 执行断点 |
| 4 | 调度执行 | Master Only / Temp Agent / Sub-agent / Agent Pack；下发 Micro-SOP | runtime manifest |
| 5 | 回收与沉淀 | destroy / keep / archive-template；输出 run summary 与质量教训 | cleanup + archive |

## Data Contracts

### `task_analysis.v1`

`schemas/task_analysis.v1.schema.json` 描述任务分析产物。它用于把自然语言请求压缩成确定边界：

- `intent`: 核心意图
- `goal`: 真正目标
- `nonGoals`: 本轮明确不做什么
- `deliverables`: 具体物理产物
- `constraints`: 权限、路径、预算、时间和技术限制
- `successCriteria`: 可验证退出断言
- `environmentSnapshot`: 当前 OpenClaw / 模型 / 专家库状态
- `capabilityMapping`: 所需能力、匹配结果和降级方案
- `routingDecision`: `master_only` / `create_temp_agent` / `create_subagent` / `create_agent_pack` / `staged_execution` / `downgrade_or_clarify`

### `agent_pack.v1`

`schemas/agent_pack.v1.schema.json` 描述可复用专家组合。每个 Agent 条目可以携带 `microSop`：

- `context`: 第一阶段必须读取或依赖的上下文
- `deliverable`: 具体交付物
- `negativeConstraints`: 禁止操作
- `exitCondition`: 何时停止
- `budget`: `tokenBudget`、`maxRounds`、`timeoutMinutes`、`heartbeat: 0`

### `micro_sop.v1`

`schemas/micro_sop.v1.schema.json` 固化每个临时 Agent/Sub-agent 的派工契约。所有 `microSop` 必须声明 `schemaVersion: "micro_sop.v1"`，并保持 `budget.heartbeat: 0`。

## v5.4 Validation Layer

v5.4 增加发布前可执行检查：

```powershell
.\scripts\check_encoding.ps1
.\helpers\validate_templates.ps1
.\helpers\validate_task_analysis.ps1 -File .\examples\task-analysis\*.json
.\evals\run_prompt_evals.ps1
```

这些检查只验证契约、示例和离线 eval case，不调用真实 LLM，不生成自动环境快照，也不启动 Python CLI。

## v5.5 Extension Layer

v5.5 adds `prompts/05-agent-capability-imitation.md` — an Agent Capability Imitation Layer that runs alongside the v5.4 execution engine without modifying it.

### v5.5 Capabilities

| 模式 | 说明 |
|------|------|
| Repository Execution Mode | 对仓库操作前先只读检查，写操作需用户明确授权 |
| Context Retrieval Mode | 修改前先读文件、理解上下文，不猜 |
| Conservative Editing Mode | 大范围修改收敛为最小改动，不破坏 v5.4 结构 |
| Verify / Repair Loop | 验证失败必须进入 repair 或明确报告，不得声称完成 |
| Phase 4 Internal State Machine | Phase 4 期间追踪子任务状态，明确汇报 |
| Final Engineering Report | 每个任务结束后输出标准化工程报告 |

### v5.5 Eval Cases

```powershell
.\evals\run_prompt_evals.ps1
```

Cases: `repository-readonly`, `conservative-edit`, `verify-repair-loop`

## Agent vs Sub-agent

| 类型 | 适用场景 | 生命周期 |
|------|----------|----------|
| Agent | 完整领域能力，如安全审查、Windows 打包、代码审查；未来可复用或沉淀为模板 | 临时创建，必要时归档模板 |
| Sub-agent | 一次性、小范围、明确边界的局部工单，如读取配置、总结日志、验证一个文件 | 执行完销毁，不能继续创建下级代理 |

判断规则：

- 需要长期复用的完整专业判断 -> 创建 Agent。
- 只服务当前任务的局部检查 -> 创建 Sub-agent。
- 简单 1-2 步任务 -> Master 自执行。
- 超过 5 个角色 -> 分阶段，不在一轮里强行拉满。

## OpenClaw Mapping

| OpenClaw 概念 | 本项目中的用法 |
|---------------|----------------|
| Depth 0 Main Agent | Master 主控，拥有唯一调度权 |
| Depth 1 Orchestrator Sub-agent | 需要进一步分解任务的临时编排者 |
| Depth 2 Leaf Worker | 执行原子任务的临时专家 |
| `workspace` | `~/.openclaw/temp/<agent-id>` |
| `agentDir` | `~/.openclaw/agents/<agent-id>/agent` |
| `sessions` | OpenClaw 写入对应 agent 状态目录 |
| channel bindings | 默认不绑定；长期服务型 Agent 才考虑 |

推荐运行边界：`maxSpawnDepth=2`，`maxChildrenPerAgent=5`。

## Install

```bash
git clone https://github.com/123xiaoxin/master-orchestrator.git
cd master-orchestrator

git clone https://github.com/msitarzewski/agency-agents.git ~/.openclaw/agency-agents/

openclaw models status
```

当前脚本尽量保持 ASCII 控制台输出，以降低 Windows PowerShell 5.1 下 UTF-8 无 BOM 的解析风险。

## Expert Library Contract

本项目按当前 `agency-agents` 目录结构读取专家：

```text
~/.openclaw/agency-agents/
├── frontend-developer/
│   ├── AGENTS.md
│   ├── IDENTITY.md
│   └── SOUL.md
├── product-manager/
│   └── AGENTS.md
└── ...
```

创建专家时只需要传专家名：

```powershell
$r = & .\helpers\create_temp_expert.ps1 -ExpertName frontend-developer
$agent = $r | ConvertFrom-Json
```

如果你有自定义专家文件，也可以显式传入：

```powershell
$r = & .\helpers\create_temp_expert.ps1 `
  -ExpertName frontend-developer `
  -ExpertFile "$env:USERPROFILE\.openclaw\agency-agents\frontend-developer\AGENTS.md"
```

## Agent Pack Usage

先预览、不创建 Agent：

```powershell
.\helpers\create_agent_pack.ps1 -TemplateFile .\templates\webapp-build.json -DryRun
```

创建 1-5 个临时 Agent，并把确认和成功标准写入 manifest：

```powershell
$pack = & .\helpers\create_agent_pack.ps1 `
  -TemplateFile .\templates\webapp-build.json `
  -TaskTitle "Build landing page MVP" `
  -ExecutionMode expert-hosted `
  -SuccessCriteria "App runs without errors" `
  -SuccessCriteria "Desktop and mobile screenshots verified" `
  -UserConfirmed

$pack | ConvertFrom-Json
```

运行清单写入：

```text
~/.openclaw/temp/packs/<pack-id>/manifest.json
```

任务结束后选择收尾方式：

```powershell
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action destroy
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action keep
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action archive-template
```

## Helper Scripts

| 脚本 | 用途 |
|------|------|
| `helpers/check_env.ps1` | Phase 0 只读环境检查，输出专家、模板、OpenClaw agents 和模型状态 JSON |
| `helpers/validate_templates.ps1` | 批量 dry-run 校验所有 Agent Pack 模板 |
| `helpers/validate_task_analysis.ps1` | 校验 `task_analysis.v1` 示例和治理语义 |
| `helpers/create_temp_expert.ps1` | 按专家名创建单个临时 Agent |
| `helpers/cleanup_temp.ps1` | 安全删除单个 `temp-*` Agent、workspace 和 agent state |
| `helpers/create_agent_pack.ps1` | 按模板创建 1-5 个临时 Agent，并写入执行契约 manifest |
| `helpers/finalize_agent_pack.ps1` | 对一个 Agent Pack 执行 `destroy`、`keep` 或 `archive-template` 并记录最终状态 |
| `scripts/check_encoding.ps1` | 检查 UTF-8 无 BOM 和 ASCII prompt 文件名 |

Phase 0 推荐先运行：

```powershell
.\helpers\check_env.ps1
.\helpers\validate_templates.ps1
```

## Quick Start Prompt

```text
启动 Master Orchestrator。严格执行 Phase -1 到 Phase 3。
如果需求模糊，先用 3-5 轮短问答澄清 Goal、Non-Goal 和 Success Criteria。
不要默认使用用户自建代理；只在必要时选择 1-5 个临时专家。
展示 task_analysis、能力匹配和兵力部署表后暂停，等我确认执行模式和收尾策略。
```

## Third-party Dependency

| 项目 | 作者 | 仓库 | 说明 |
|------|------|------|------|
| agency-agents | @msitarzewski | https://github.com/msitarzewski/agency-agents | 独立维护的第三方专家库 |

本仓库不复制 `agency-agents` 的专家定义，只在运行时从本地克隆读取。使用时请遵守原项目许可证。

## License

MIT License.
