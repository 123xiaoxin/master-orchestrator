# 🎭 MasterOrchestrator — Agency 专家调度

> **版本**：v2.1 | **定位**：系列插件，需搭配 Core 使用
> **前置**：🧠 01-core 主控框架
> **架构**：外挂兵器库（Provisioning/Runtime 分离）
> **数据源**：`~/.openclaw/agency-agents/`（144+ 领域专家 .md 文件）

---

## 加载条件

任务描述包含以下关键词时自动加载本插件：

| 关键词 | 示例 |
|--------|------|
| `前端/后端/开发/代码/架构/设计/测试/运维` | 开发任务 |
| `营销/文案/数据/分析/报告` | 分析任务 |
| `管理/项目/规划` | 管理任务 |
| 任何涉及多角色协作的复杂任务 | — |

---

## 🏗️ 核心架构

```
Provisioning（一次性安装）
  git clone ...agency-agents.git → ~/.openclaw/agency-agents/

Runtime（提示词调度）
  Phase 0: ls 检测 + 模型扫描
  Phase 1: 选定专家 + 分配模型
  Phase 3: 5步协议（↓ 下表）→ 调度
  Phase 4: 批量回收

Data（冷数据按需读取）
  ~/.openclaw/agency-agents/engineering/frontend-developer.md
```

---

## 🚫 反模式

- ❌ `chat_with_agent(to_agent="frontend-developer")` — 专家不在 Agent 列表里
- ❌ SKILL.md 写 git clone 链接 — 混淆 Provisioning/Runtime
- ❌ 144 个全部注册为 Agent — 白占资源

---

## 📋 专家调度协议（5 步）

| 步 | 动作 | 命令/工具 |
|----|------|----------|
| 1 | 读取专家定义 | `read_file("~/.openclaw/agency-agents/<path>/<name>.md")` |
| 2 | 创建临时 Agent | `powershell -File helpers/create_temp_expert.ps1 -ExpertName <name> -ExpertFile <path>` |
| 3 | 分派任务 | `chat_with_agent(to_agent = 返回的 agentId, text = 任务描述)` |
| 4 | 记录结果 | 写入 `memory/`，暂不清理 |
| 5 | Phase 4 统一回收 | `powershell -File helpers/cleanup_temp.ps1 -AgentId <id>` |

> 串行：Step 3 时传上一步结果 → `text = f"{上一步结果}\n\n当前任务: ..."`
> 并行：同时执行多个 Step 2 → 同时 Step 3

---

## 🔍 Phase 0 补充

### 专家库检测

```bash
ls ~/.openclaw/agency-agents/       # 检测是否存在
cat ~/.openclaw/agency-agents/README.md  # 了解目录结构
```

如缺失 → 提示用户安装，不自动执行 git clone。

### 模型预检

```powershell
openclaw models status --json       # 扫描可用模型
```

记录结果到 `memory/_models.md`（Phase 4 清理），后续模型分配由 `create_temp_expert.ps1` 自动完成，详见脚本内嵌注释。

---

## 📋 Phase 1 补充

### 专家速查表

| 领域 | 推荐专家 | 路径 |
|------|---------|------|
| 🖥️ 前端/UI | `frontend-developer`, `ui-designer`, `ux-architect` | `engineering/` |
| 🏗️ 后端/架构 | `backend-architect`, `software-architect`, `senior-developer` | `engineering/` |
| 🐳 DevOps | `devops-automator`, `infrastructure-maintainer`, `sre` | `operations/` |
| 🧪 测试/QA | `evidence-collector`, `reality-checker`, `api-tester` | `testing/` |
| 📱 移动端 | `mobile-app-builder` | `engineering/` |
| 🎨 设计 | `ui-designer`, `visual-storyteller`, `whimsy-injector` | `design/` |
| 📣 营销 | `growth-hacker`, `seo-specialist`, `content-creator` | `marketing/` |
| 📊 数据 | `data-engineer`, `analytics-reporter` | `data/` |
| 📋 项目 | `senior-project-manager`, `product-manager` | `management/` |
| 🤝 销售 | `sales-outreach`, `deal-strategist` | `sales/` |
| 🎧 客服 | `support-responder`, `customer-service` | `support/` |
| 🎮 游戏 | `game-designer`, `game-audio-engineer` | `gaming/` |
| 🇨🇳 中国市场 | `china-e-commerce-operator`, `douyin-strategist` | `china/` |
| 🔒 安全 | `security-engineer`, `compliance-auditor` | `security/` |
| 📝 文档 | `document-generator`, `technical-writer` | `documentation/` |

### 匹配规则

```
每个子任务 → 查速查表 → 记录 [专家路径, 模型（脚本自动分配）, 任务描述]
```

### 模型分配

由 `create_temp_expert.ps1` 自动完成：扫描本地模型 → 按 ID 命名规律分类 → 按专家类型匹配 → 五级 Fallback。详见脚本 `.SYNOPSIS` 注释。如需手动干预，传 `-Model` 参数。

---

## 🛠️ Phase 3 补充

按上述 5 步协议执行。以下为调用示例：

### 单个专家

```text
$r = execute_shell_command("powershell -File helpers/create_temp_expert.ps1 -ExpertName frontend-developer -ExpertFile ...")
$id = parse_json($r).agentId
chat_with_agent(to_agent=$id, text="...")
```

### 串行依赖

```text
$pm = create_temp("product-manager", ...)
prd = chat_with_agent($pm.agentId, "出 PRD")

$design = create_temp("ui-designer", ...)
ui = chat_with_agent($design.agentId, "基于 PRD 设计：\n{prd}")

$fe = create_temp("frontend-developer", ...)
code = chat_with_agent($fe.agentId, "实现：\n{ui}")
```

### 并行

```text
$fe = create_temp("frontend-developer", ...); task_a = submit_to_agent(...)
$be = create_temp("backend-architect", ...); task_b = submit_to_agent(...)
merge(check(task_a), check(task_b))
```

---

## 🧹 Phase 4 补充

```text
# 批量回收所有临时 Agent
for each id in [created_agent_ids]:
  execute_shell_command("powershell -File helpers/cleanup_temp.ps1 -AgentId <id>")

# 清理模型快照
trash memory/_models.md
```

✅ 由 `cleanup_temp.ps1` 处理安全白名单和物理销毁，不需要重复写清理逻辑。

---

## ⚠️ 注意事项

| 要点 | 说明 |
|------|------|
| 性能 | 每次创建/销毁有 I/O，频繁操作注意 |
| 命名冲突 | 脚本自动加时间戳后缀避免重复 |
| 失败恢复 | Phase 4 即使中间报错也应遍历清理已注册的 Agent |
| 高频优化 | 同一专家频繁调用时可保留 Agent 不销毁 |

---

> 🧠 基础流程：🧠 01-core 主控框架
> 🔄 质量总评：🔄 03-quality 质量飞轮
> 📚 技能沉淀：📚 04-skillcraft 技能锻造
