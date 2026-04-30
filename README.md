# 🧠 Master Orchestrator (v5.2 draft)

> 为 OpenClaw 打造的微内核 AI 工作流编排框架。
> 冷专家库长期保留，运行时只按任务创建 1-5 个临时专家 Agent。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-2.1+-blue.svg)](https://github.com/openclaw/openclaw)

## 目录

```
master-orchestrator/
├── README.md
├── prompts/
│   ├── 🧠 01-core 主控框架.md
│   ├── 🎭 02-agency 专家调度.md
│   ├── 🔄 03-quality 质量飞轮.md
│   └── 📚 04-skillcraft 技能锻造.md
├── helpers/
│   ├── create_temp_expert.ps1
│   ├── cleanup_temp.ps1
│   ├── create_agent_pack.ps1
│   ├── finalize_agent_pack.ps1
│   ├── check_env.ps1
│   └── validate_templates.ps1
├── templates/
│   ├── README.md
│   ├── webapp-build.json
│   └── content-campaign.json
├── examples/
│   └── web-landing-page.md
└── LICENSE
```

## 核心想法

- **专家库是冷数据**：`agency-agents` 长期放在 `~/.openclaw/agency-agents/`，不把 100+ 专家全部注册成常驻 Agent。
- **运行时按需拉起**：每个任务只选择 1-5 个专家创建临时 Agent；简单任务可以不创建专家。
- **实例和模板分离**：运行实例带上下文和临时 workspace，用完后可销毁或短期保留；长期沉淀的是干净的 Agent Pack 模板。
- **五阶段编排**：Phase 0-4 保持独立，先感知和规划，再让用户确认执行模式，最后集中回收与沉淀。

## 依赖

| 依赖 | 说明 |
|------|------|
| OpenClaw | 已安装并配置模型，`openclaw agents add` 可用 |
| PowerShell | Windows PowerShell 5.1+ 或 PowerShell Core |
| Git | 用于克隆外部专家库 |
| agency-agents | 外部专家库，克隆到 `~/.openclaw/agency-agents/` |

安装：

```bash
git clone https://github.com/123xiaoxin/master-orchestrator.git
cd master-orchestrator

git clone https://github.com/msitarzewski/agency-agents.git ~/.openclaw/agency-agents/

openclaw models status
```

当前脚本已尽量保持 ASCII 输出，以降低 Windows PowerShell 5.1 下 UTF-8 无 BOM 的解析风险。

## 专家库路径契约

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

## OpenClaw 多智能体边界

OpenClaw 官方多智能体机制强调隔离：每个 agent 都有自己的 workspace、agentDir 和 sessions。本项目遵循这个模型，但默认创建的是短生命周期的 `temp-*` 专家实例。

| OpenClaw 概念 | 本项目中的用法 |
|---------------|----------------|
| `workspace` | 临时任务工作区：`~/.openclaw/temp/<agent-id>` |
| `agentDir` | 临时 Agent 状态目录：`~/.openclaw/agents/<agent-id>/agent` |
| `sessions` | 由 OpenClaw 写入对应 agent 状态目录 |
| channel bindings | 默认不绑定；只有长期服务型 Agent 才建议绑定渠道 |
| credentials | 不假设自动共享；需要独立授权时再处理 |

注意：workspace 隔离不是强安全沙箱。涉及敏感文件或外部凭据时，应单独授权并限制任务范围。

## OpenClaw 原始创建格式

Helper 脚本只是封装层。需要直接使用 OpenClaw 官方 CLI 时，底层格式是：

```powershell
$agentId = "temp-frontend-developer-1713992400000"
$workspace = "$env:USERPROFILE\.openclaw\temp\$agentId"
$agentDir = "$env:USERPROFILE\.openclaw\agents\$agentId\agent"

New-Item -ItemType Directory -Path $workspace -Force | Out-Null
New-Item -ItemType Directory -Path $agentDir -Force | Out-Null
Copy-Item "$env:USERPROFILE\.openclaw\agency-agents\frontend-developer\AGENTS.md" "$workspace\AGENTS.md"

openclaw agents add $agentId `
  --workspace $workspace `
  --agent-dir $agentDir `
  --model "<model-id>" `
  --non-interactive `
  --json
```

清理时：

```powershell
openclaw agents delete $agentId --force --json
```

对应的 OpenClaw CLI 参数含义：

| 参数 | 说明 |
|------|------|
| `name` | Agent id，例如 `temp-frontend-developer-1713992400000` |
| `--workspace <dir>` | 新 Agent 的工作区目录；`--non-interactive` 时必填 |
| `--agent-dir <dir>` | 新 Agent 的状态目录，显式传入可让临时实例边界更清楚 |
| `--model <id>` | 新 Agent 使用的模型 |
| `--non-interactive` | 禁用交互式确认，适合脚本调用 |
| `--json` | 输出 JSON，方便主控解析 |

## Agent Pack 模板

模板用于保存一组可复用专家组合。示例：

```json
{
  "name": "webapp-build",
  "maxAgents": 5,
  "execution": "serial_then_parallel",
  "cleanupPolicy": "ask",
  "agents": [
    { "name": "product-manager", "role": "提炼需求", "dependsOn": [] },
    { "name": "ui-designer", "role": "输出界面结构", "dependsOn": ["product-manager"] },
    { "name": "frontend-developer", "role": "实现前端", "dependsOn": ["ui-designer"] }
  ]
}
```

从模板创建 1-5 个临时 Agent：

```powershell
$pack = & .\helpers\create_agent_pack.ps1 -TemplateFile .\templates\webapp-build.json
$pack | ConvertFrom-Json
```

先预览、不创建 Agent：

```powershell
.\helpers\create_agent_pack.ps1 -TemplateFile .\templates\webapp-build.json -DryRun
```

创建前会先校验模板：

- Agent 数量必须在 1-5 范围内。
- 每个专家必须存在于 `~/.openclaw/agency-agents/<expert-name>/AGENTS.md`。
- `dependsOn` 只能引用同一模板内的专家。
- 禁止自依赖和循环依赖。

脚本会生成运行清单：

```text
~/.openclaw/temp/packs/<pack-id>/manifest.json
```

任务结束后选择收尾方式：

```powershell
# 销毁临时 Agent 和 workspace
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action destroy

# 保留运行实例，方便继续同一项目
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action keep

# 从本次运行清单沉淀一个干净模板
.\helpers\finalize_agent_pack.ps1 -PackId "<pack-id>" -Action archive-template
```

默认安全网：`create_agent_pack.ps1` 如果创建中途失败，会自动回滚并清理已经创建的临时 Agent。只有显式传入 `-KeepOnFailure` 时才会保留失败现场，适合调试。

## 五阶段引擎

| Phase | 名称 | 核心动作 | 断点 |
|-------|------|---------|------|
| 0 | 战场全景感知 | 模型、Agent、专家库、模板检查 | 否 |
| 1 | 任务拆解与资源规划 | 拆出 1-5 个专家位，输出兵力部署表 | 强制输出 |
| 2 | 模式选择 | A 步步为营 / B 专家托管 | 等待用户确认 |
| 3 | 调度执行 | 创建临时 Agent 或 Agent Pack，执行任务 | 否 |
| 4 | 回收与沉淀 | destroy / keep / archive-template，总评归档 | 否 |

## 快速开始提示词

将 `prompts/🧠 01-core 主控框架.md` 作为主控提示词加载，然后输入：

```text
启动 Master Orchestrator。严格执行 Phase 0 和 Phase 1。
根据任务只选择必要的 1-5 个专家，不要创建全部专家。
展示兵力部署表后暂停，等我确认执行模式和收尾策略。
```

## Helper 脚本

| 脚本 | 用途 |
|------|------|
| `helpers/check_env.ps1` | Phase 0 只读环境检查，输出专家、模板、OpenClaw agents 和模型状态 JSON |
| `helpers/validate_templates.ps1` | 批量 dry-run 校验所有 Agent Pack 模板 |
| `helpers/create_temp_expert.ps1` | 按专家名创建单个临时 Agent |
| `helpers/cleanup_temp.ps1` | 安全删除单个 `temp-*` Agent 和 workspace |
| `helpers/create_agent_pack.ps1` | 按模板创建 1-5 个临时 Agent，并写入 manifest |
| `helpers/finalize_agent_pack.ps1` | 对一个 Agent Pack 执行 `destroy`、`keep` 或 `archive-template` |

Phase 0 推荐先运行：

```powershell
.\helpers\check_env.ps1
.\helpers\validate_templates.ps1
```

`create_temp_expert.ps1` 输出中包含 `modelSelectionReason`，用于解释自动选模原因，方便 Phase 4 审计。

## 第三方依赖归属

本项目引用外部专家库：

| 项目 | 作者 | 仓库 | 说明 |
|------|------|------|------|
| agency-agents | @msitarzewski | https://github.com/msitarzewski/agency-agents | 独立维护的第三方专家库 |

本仓库不复制 `agency-agents` 的专家定义，只在运行时从本地克隆读取。使用时请遵守原项目许可证。

## 许可证

MIT License。
