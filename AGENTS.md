# AGENTS.md — master-orchestrator 项目行为准则

> 约束爱丽丝在 master-orchestrator 仓库中的行为。每次对话时系统自动加载为项目上下文。

---

## 1. 项目定位

- **项目名称**：master-orchestrator / Master Skill / Master Orchestrator
- **类型**：OpenClaw Master Orchestrator 技能包
- **仓库**：`https://github.com/123xiaoxin/master-orchestrator`
- **工作分支**：`upgrade/v5.4-validation-foundation`

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
- 新增 v5.5 内容时优先作为**扩展层**，不要推翻 v5.4

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

## 5. 最终汇报格式

每次修改完成后，必须汇报以下内容：

| 项目 | 内容 |
|------|------|
| **完成情况** | 简要说明 |
| **当前分支** | `upgrade/v5.4-validation-foundation` |
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