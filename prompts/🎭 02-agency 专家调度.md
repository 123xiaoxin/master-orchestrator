# 🎭 MasterOrchestrator — Agency 专家调度

> **版本**：v2.2 draft | **定位**：系列插件，需搭配 Core 使用
> **核心规则**：按任务只创建必要的 1-5 个临时专家 Agent，不常驻注册全部专家。
> **数据源**：`~/.openclaw/agency-agents/<expert-name>/AGENTS.md`

---

## 加载条件

任务包含以下特征时加载本插件：

| 触发 | 示例 |
|------|------|
| 多角色协作 | 产品、设计、开发、测试、评审 |
| 明确专业分工 | 前端、后端、运维、数据、营销、法务 |
| 可沉淀组合模板 | Web App 构建、内容营销、代码审查 |

简单的一步任务不需要创建专家，由主 Agent 自执行。

---

## 架构原则

```text
Cold Expert Library
  ~/.openclaw/agency-agents/<expert-name>/AGENTS.md
  长期保留，不全部注册。

Runtime Agent Pack
  根据任务创建 1-5 个 temp-* Agent。
  运行清单写入 ~/.openclaw/temp/packs/<pack-id>/manifest.json。

OpenClaw Isolation
  workspace: ~/.openclaw/temp/<agent-id>
  agentDir: ~/.openclaw/agents/<agent-id>/agent
  sessions: 由 OpenClaw 写入对应 agent 状态目录

Lifecycle
  Phase 4 选择 destroy / keep / archive-template。
```

### 反模式

- ❌ 一次性注册全部专家。
- ❌ 直接调用 `chat_with_agent(to_agent="frontend-developer")`，因为专家定义不是已注册 Agent。
- ❌ 长期保留运行 workspace 当作模板。
- ❌ 为了凑阵容创建无必要专家。
- ❌ 默认给临时专家绑定外部渠道。channel bindings 更适合长期服务型 Agent。

---

## Phase 0 补充：资源检测

检查专家库：

```powershell
Test-Path "$env:USERPROFILE\.openclaw\agency-agents"
Get-ChildItem "$env:USERPROFILE\.openclaw\agency-agents" -Directory | Select-Object -First 20 Name
```

推荐直接调用只读环境检查：

```powershell
.\helpers\check_env.ps1
```

检查模板：

```powershell
Get-ChildItem .\templates\*.json
```

检查模型：

```powershell
openclaw models status
```

如缺少专家库，只提示用户安装，不自动 clone。

---

## Phase 1 补充：选择 1-5 个专家

### 决策规则

| 复杂度 | 建议专家数 | 处理方式 |
|--------|------------|----------|
| 简单 | 0 | 主 Agent 自执行 |
| 中等 | 1-3 | 创建必要专家 |
| 复杂 | 3-5 | 创建 Agent Pack |
| 超过 5 个角色 | 分阶段 | 不在同一轮创建超过 5 个 |

### 专家速查表

| 领域 | 推荐专家 |
|------|----------|
| 产品/需求 | `product-manager`, `senior-project-manager` |
| 前端/UI | `frontend-developer`, `ui-designer`, `ux-architect` |
| 后端/架构 | `backend-architect`, `software-architect`, `senior-developer` |
| DevOps | `devops-automator`, `infrastructure-maintainer`, `sre-site-reliability-engineer` |
| 测试/证据 | `evidence-collector`, `reality-checker`, `api-tester` |
| 代码质量 | `code-reviewer`, `minimal-change-engineer`, `performance-benchmarker` |
| 数据/分析 | `data-engineer`, `analytics-reporter`, `database-optimizer` |
| 营销/内容 | `growth-hacker`, `seo-specialist`, `content-creator`, `trend-researcher` |
| 中国市场 | `china-e-commerce-operator`, `douyin-strategist`, `xiaohongshu-specialist` |
| 安全/合规 | `security-engineer`, `compliance-auditor`, `legal-compliance-checker` |
| 文档 | `document-generator`, `technical-writer`, `executive-summary-generator` |

### 兵力部署表必须包含

| 子任务 | 专家 | 是否创建 Agent | 推荐模板/脚本 | 依赖 | 收尾建议 |
|--------|------|----------------|----------------|------|----------|
| A | `product-manager` | 是 | `create_temp_expert.ps1` | — | destroy |
| B | `frontend-developer` | 是 | `webapp-build` | A | archive-template |

---

## Phase 3 补充：创建与调度

> 🛑 Phase 1-2 禁止调用 `create_temp_expert.ps1`、`create_agent_pack.ps1`、`cleanup_temp.ps1`、`finalize_agent_pack.ps1`。只有用户确认执行模式并进入 Phase 3 后，才能创建或清理临时 Agent。

### 单个专家

```text
$r = execute_shell_command("powershell -File helpers/create_temp_expert.ps1 -ExpertName frontend-developer")
$id = parse_json($r).agentId
chat_with_agent(to_agent=$id, text="...")
```

脚本默认解析：

```text
~/.openclaw/agency-agents/frontend-developer/AGENTS.md
```

### OpenClaw 官方创建格式

`create_temp_expert.ps1` 是对 OpenClaw CLI 的封装。需要直接使用官方格式时，按以下顺序创建 workspace 并注册 Agent：

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

删除时使用：

```powershell
openclaw agents delete $agentId --force --json
```

### Agent Pack

```text
$pack = execute_shell_command("powershell -File helpers/create_agent_pack.ps1 -TemplateFile templates/webapp-build.json")
$manifest = parse_json($pack).manifest
```

`create_agent_pack.ps1` 在创建前会验证：专家存在、数量不超过 5、依赖存在、无自依赖、无循环依赖。默认失败会自动回滚已创建的临时 Agent；只有 `-KeepOnFailure` 会保留失败现场。

调度时按 `manifest.agents` 中的 `agentId` 分派任务。

### 串行依赖

```text
prd = chat_with_agent(product_manager_id, "出 PRD")
ui = chat_with_agent(ui_designer_id, "基于 PRD 设计：\n{prd}")
code = chat_with_agent(frontend_developer_id, "基于 PRD 和 UI 实现：\n{prd}\n{ui}")
```

### 并行

```text
task_a = submit_to_agent(frontend_id, "实现前端")
task_b = submit_to_agent(backend_id, "设计 API")
merge(check(task_a), check(task_b))
```

---

## Phase 4 补充：收尾策略

运行结束后必须询问或执行预先约定的收尾策略：

| 策略 | 命令 | 适用场景 |
|------|------|----------|
| destroy | `finalize_agent_pack.ps1 -PackId <id> -Action destroy` | 默认，清理临时实例 |
| keep | `finalize_agent_pack.ps1 -PackId <id> -Action keep` | 同一项目马上继续 |
| archive-template | `finalize_agent_pack.ps1 -PackId <id> -Action archive-template` | 本次组合值得复用 |

单个专家使用：

```text
execute_shell_command("powershell -File helpers/cleanup_temp.ps1 -AgentId <id>")
```

---

## 注意事项

| 要点 | 说明 |
|------|------|
| 上限 | 同一任务最多创建 5 个临时 Agent |
| 默认 | 不保留运行实例，保留模板 |
| 失败恢复 | 创建 Pack 失败时默认清理已创建 Agent，除非指定 KeepOnFailure |
| 路径 | 当前专家结构是 `<expert-name>/AGENTS.md`，不是旧式分类目录 `.md` 文件 |
| 模型 | `create_temp_expert.ps1` 可自动匹配，也可用 `-Model` 覆盖 |

---

> 基础流程：🧠 01-core 主控框架
> 质量总评：🔄 03-quality 质量飞轮
> 技能沉淀：📚 04-skillcraft 技能锻造
