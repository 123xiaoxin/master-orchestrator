# 🧠 Master Orchestrator (v5.1)

> 为 OpenClaw 打造的企业级、微内核 AI 工作流编排引擎。
> 逻辑与执行物理分离，思考与脏活各司其职。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-2.1+-blue.svg)](https://github.com/openclaw/openclaw)

## 📂 目录

```
master-orchestrator/
├── README.md   ← 🔴 本文件：总览 + 快速入门 + helpers 详解
├── prompts/    ← 🧠 大脑：提示词模块
│   ├── 🧠 01-core 主控框架.md         ← 永久常驻，5 Phase 核心流程
│   ├── 🎭 02-agency 专家调度.md        ← 按需加载：144+ 专家调度
│   ├── 🔄 03-quality 质量飞轮.md       ← 按需加载：质量总评
│   └── 📚 04-skillcraft 技能锻造.md    ← 按需加载：经验沉淀
├── helpers/    ← 🦾 肌肉：PowerShell 执行脚本
│   ├── create_temp_expert.ps1          ← 动态创建临时专家 Agent
│   └── cleanup_temp.ps1                ← 安全销毁沙盒（内置白名单）
├── examples/   ← 📖 示例：端到端任务演示
│   └── web-landing-page.md
└── LICENSE     ← MIT
```

---

# 第一部分：依赖与安装

## ⚙️ 环境依赖

| 依赖 | 版本/说明 |
|------|-----------|
| **OpenClaw** | 需已安装并完成模型配置（`openclaw models status` 可用） |
| **PowerShell** | 5.1+（Windows 内置，macOS/Linux 可安装 PowerShell Core） |
| **PowerShell 执行策略** | `RemoteSigned`（推荐）或 `Bypass`（仅限当前会话） |
| **agency-agents 专家库** | 外挂兵器库，需克隆到本地 `~/.openclaw/agency-agents/` |
| **Git** | 用于克隆专家库 |

> ⚠️ 本项目依赖 OpenClaw 的 `chat_with_agent`、`submit_to_agent`、`execute_shell_command` 等工具。请确保你的 OpenClaw 版本支持这些能力（推荐 2.1+）。

## 🚀 安装

```bash
# 1. 克隆本仓库
git clone https://github.com/123xiaoxin/master-orchestrator.git
cd master-orchestrator

# 2. 克隆外部专家库（必需）
git clone https://github.com/msitarzewski/agency-agents.git ~/.openclaw/agency-agents/

# 3. 设置 PowerShell 执行策略（如未设置）
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# 4. 验证模型就绪
openclaw models status
```

---

# 第二部分：快速开始

将本项目的 `prompts/🧠 01-core 主控框架.md` 内容作为系统提示词（或上传为 Skill）加载至你的主 Agent 会话中，然后输入：

```
启动 Master Orchestrator。严格执行 Phase 0 和 Phase 1，
展示专家阵容表格后暂停，等我确认执行模式。
```

系统将：
1. 扫描本地可用 Agent、模型和专家库
2. 拆解你的任务，输出一张"兵力部署表"（含负责人、模型、工具）
3. 询问你选择"步步为营"还是"一键托管"模式
4. 按你的选择执行，并在最后总评、归档

---

# 第三部分：核心特性与运行机制

## 🌟 核心特性

- **五阶段纯净工作流** — Phase 0-4 严格分离，底层铁律禁止重构/跳跃/合并
- **微内核架构** — 01-core 永久常驻，02/03/04 按需加载
- **外挂兵器库** — 144+ 领域专家 `read_file` 按需懒加载，零冗余
- **智能算力路由** — 自动扫描本地模型，按专家类型分配，无匹配五级 Fallback
- **无情垃圾回收** — 临时 Agent 用完即焚，安全白名单不波及生产

## ⚙️ 五阶段引擎

| Phase | 名称 | 核心动作 | 断点 |
|-------|------|---------|------|
| 🔍 0 | 战场全景感知 | 模型扫描 + 专家库检测 | ❌ |
| 📋 1 | 任务拆解与资源规划 | 拆解表（含模型列）+ 匹配专家 | ⚠️ 强制输出兵力部署表 |
| 🚦 2 | 模式选择 | A（步步为营）/ B（专家托管） | 🛑 等待用户确认 |
| 🛠️ 3 | 调度执行（纯执行） | helpers 拉起专家 → 调度 → 记录 | ❌ |
| 🧹 4 | 资源回收与归档 | helpers 批量回收 + 总评 | ❌ |

---

# 第四部分：端到端示例

下面是一个使用 Master Orchestrator 完成"**为公司设计并开发一个产品 Landing Page**"的完整演示。
*（假设用户已加载 Core 提示词，且专家库已就位）*

### 用户输入

```
启动 Master Orchestrator。
需要为我们的 SaaS 产品 "CloudDesk" 设计并开发一个响应式 Landing Page，
包含导航、Hero 区、功能卡片和页脚。先出设计稿再编码。
```

### Phase 0：战场感知

```
🔍 扫描本地资源...
✅ CoPaw Agent: main, coding, rag-memory
✅ 可用模型: deepseek-chat, gpt-4o, claude-3.5-sonnet
✅ 专家库已检测: ~/.openclaw/agency-agents/ (engineering/, design/, marketing/ ...)
🛡️ 已锁定战场全景图。进入 Phase 1。
```

### Phase 1：兵力部署表（强制输出）

| 子任务 | 负责人 | 推荐模型 | 核心工具 | 依赖 | 预估轮次 |
|--------|-------|---------|---------|------|---------|
| A. 生成 PRD 摘要 | `product-manager` | gpt-4o | read_file, memory_search | — | 2 |
| B. UI 设计稿 | `ui-designer` | claude-3.5-sonnet | 浏览器、设计工具 | A | 3 |
| C. 前端开发 | `frontend-developer` | deepseek-chat | 代码工具, 浏览器 | B | 4 |
| D. 自动化测试 | `evidence-collector` | gpt-4o | 浏览器、截图 | C | 2 |
| E. 最终演示 | `main` 自执行 | — | 浏览器 | D | 1 |

```
⚠️ 兵力部署表已生成。请选择执行模式：
【A】步步为营  【B】专家托管
🛑 等待你的确认...
```

### 用户选择：B（专家托管）

### Phase 3：纯执行（摘要）

```
📋 Step A: 创建临时 product-manager，生成 PRD 摘要...
✅ PRD 摘要已生成，关键需求：单页、响应式、品牌色#2563eb。

🎨 Step B: 创建临时 ui-designer，基于 PRD 设计...
✅ 桌面端/移动端线框图 + 高保真设计已输出，风格简洁科技。

💻 Step C: 创建临时 frontend-developer，启动编码...
✅ 生成 index.html + style.css + script.js，所有资源内嵌，可直接打开。

🧪 Step D: 创建临时 evidence-collector，测试多分辨率...
✅ 桌面/平板/手机截图验证通过，性能评分 92。

📊 Step E: 汇总所有产物，生成演示报告。
```

### Phase 4：总评与回收

```markdown
## 🧹 质量总评
- 完成度：全部完成
- 质量评分：⭐⭐⭐⭐ (良好)
- 整体评价：设计还原度高，响应式表现优秀，交互可进一步增加动效。

### 经验沉淀
- 🆕 新增 skill：`ui-to-code-pipeline`（PRD → 设计 → 前端）
- 临时 Agent 已全部安全回收

📁 最终交付物：`landing-page-demo/` 目录
📄 记忆归档：`memory/2026-04-28.md`
```

---

# 第五部分：Helpers 脚本详解

## create_temp_expert.ps1 — 创建临时专家

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `ExpertName` | ✅ | 专家标识，如 `frontend-developer` |
| `ExpertFile` | ✅ | 专家 `.md` 文件的绝对路径 |
| `Model` | ❌ | 覆盖自动模型分配 |

### 标准调用

```powershell
$r = & .\helpers\create_temp_expert.ps1 `
  -ExpertName frontend-developer `
  -ExpertFile "$env:USERPROFILE\.openclaw\agency-agents\engineering\frontend-developer.md"
```

### 输出

```json
{"agentId":"temp-frontend-developer-1713992400","model":"deepseek/deepseek-chat","workspace":"C:\\Users\\...\\.openclaw\\temp\\..."}
```

### 模型分配策略

自动扫描本地 `openclaw models status --json`，按命名规律分类：

- **代码类**：ID 含 `code/coder/coding` → 分配给代码专家
- **高速类**：ID 含 `highspeed/fast/turbo` 等或后缀 `-mini` → 分配给高速任务
- **通用类**：以上之外的 → 分配给其他专家

五级 Fallback 链：自动匹配 → 系统默认 → fallbacks[0] → allowed[0] → 报错

---

## cleanup_temp.ps1 — 回收临时专家

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `AgentId` | ✅ | 要回收的临时 Agent ID（如 `temp-frontend-developer-1713992400`） |

### 调用

```powershell
.\helpers\cleanup_temp.ps1 -AgentId "temp-frontend-developer-1713992400"
```

### 安全机制

内置白名单：**只允许回收 `temp-` 开头的 Agent**。传入 `main` 或 `frontend-developer` 直接拒绝。

---

# 第六部分：插件体系

| 插件 | 触发关键词 | 加载时机 |
|------|-----------|---------|
| 🎭 **02-agency** 专家调度 | 前端/后端/代码/架构/设计/测试/数据分析/项目 | Phase 0 检测到领域关键词 |
| 🔄 **03-quality** 质量飞轮 | 质量/报告/改进/复盘/评估 | 用户明确要求质量输出时 |
| 📚 **04-skillcraft** 技能沉淀 | 沉淀/复用/模板/最佳实践 | 发现可复用模式且任务接近完成 |

详细说明见各插件文件内的注释。

---

# 第七部分：贡献与许可

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！如果发现了更好的专家调度模式或安全性改进，请务必分享。大改动前建议先开 Issue 讨论。

## 📄 许可证

本项目采用 [MIT License](LICENSE)。你可以自由使用、修改和分发，但需保留版权声明。

> **注意**：本项目引用的外部专家库 [`agency-agents`](https://github.com/msitarzewski/agency-agents) 由第三方维护，其许可证请参考其源仓库。

---

*Built with logic, decoupling, and strict execution guardrails.*
