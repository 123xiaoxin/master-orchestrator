# AGENTS.md — master-orchestrator 项目行为准则

> 约束爱丽丝在 master-orchestrator 仓库中的行为。每次对话时系统自动加载为项目上下文。

---

## 1. 项目定位

- **项目名称**：master-orchestrator / Master Skill / Master Orchestrator
- **类型**：OpenClaw Master Orchestrator 技能包
- **仓库**：`https://github.com/123xiaoxin/master-orchestrator`
- **工作分支**：以实际 `git branch --show-current` 为准；整合工作使用独立非主分支。
- **类型边界**：仓库治理规范、契约和验证框架；规范性 Skill 入口为 `skills/master-skill/SKILL.md`，不自动实现 Runtime。

---

## 2. Git 安全规则

- **禁止操作** `main` / `master` 分支
- **禁止未经确认**切换分支
- **禁止未经确认**创建新分支
- **禁止未经确认** commit
- **禁止未经确认** push
- **禁止 force push**
- **禁止删除文件**，除非用户明确授权
- **修改前必须汇报**：当前分支 + `git status --short`

---

## 3. 修改规则

- 保持最小改动——只改必要的，不扩散
- 不做无关重构
- 不破坏现有 v5.4 结构
- 不破坏以下目录的现有约定：`prompts/` `schemas/` `templates/` `examples/` `evals/` `helpers/` `scripts/`
- 保留 Phase -1 到 Phase 5 和既有契约；新增治理内容按统一入口及模块依赖处理，不因版本号机械覆盖。

---

## 4. 验证规则

修改后尽量运行以下验证脚本（PowerShell）：

```powershell
./scripts/check_encoding.ps1
./helpers/validate_templates.ps1
./helpers/validate_task_analysis.ps1
./evals/run_prompt_evals.ps1
```

- 如果脚本不存在或无法运行，**必须说明原因**
- 验证失败时**不得声称完成**

---

## 5. Cursor / Codex 共用工作区

- 两端使用此仓库的同一份本地目录；外层 `master.code-workspace` 是 Cursor 的打开入口。
- 每项任务开始前读取 [协作与交接记录](docs/collaboration.md)，检查实际 Git 根目录、分支和未提交改动。
- 默认 Codex 负责修改与整合，Cursor 负责审查；按用户明确指派可以交换分工。未经分工，不同时修改相同文件。
- 并行修改需要先明确互不重叠的文件范围；交接记录串行时由当前写入方维护，并行时仅由指定整合方维护。该约定不提供自动锁或消息同步。
- 修改前重新读取目标文件；发现计划范围内出现另一方的新改动时先核对，保留已有工作。
- 完成或交接时记录当前任务、修改文件、已运行验证、未完成事项。仓库原有 Git 安全规则继续适用。

---

## 6. 最终汇报格式

每次修改完成后，必须汇报以下内容：

| 项目 | 内容 |
|------|------|
| **完成情况** | 简要说明 |
| **当前分支** | 实际分支名 |
| **修改文件** | 列出所有被修改的文件 |
| **核心变更** | 一句话描述 |
| **验证命令** | 实际运行了哪些脚本 |
| **验证结果** | 通过 / 失败 / 跳过（需说明） |
| **是否 commit** | 否（待用户确认）|
| **是否 push** | 否（待用户确认）|
| **剩余风险** | 如有 |
| **下一步建议** | 下一步操作建议 |

---

> 爱丽丝 🌸 — 遵循上述规则，在用户明确授权前保持只读。
