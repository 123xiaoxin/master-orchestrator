# Cursor 与 Codex 共用开发目录

## 打开同一份代码

- 当前开发目录：`C:\Users\tongk\Documents\ChatGPT\master\master-orchestrator-recovered`。
- Cursor：打开上一级的 `master.code-workspace`，工作区中只有当前开发仓库。
- Codex：本聊天可继续使用，外层 `AGENTS.md` 已指向当前仓库。以后创建本地开发聊天时直接选择上述仓库目录。
- 两端共享的是已保存到磁盘的文件。此设置不连接两端聊天，不传递未保存的编辑，也不自动派发任务。
- 这是共用同一目录的工作方式；如果某端创建了独立 worktree 或使用云端目录，需要另行交接，不能视作正在编辑这份代码。

开始每个任务，在仓库根目录核对：

```powershell
git rev-parse --show-toplevel
git branch --show-current
git status --short
```

2026-11-19 设置时，当前分支为 `codex/master-integration`，HEAD 为 `645e2c2`。
这些值只是当时快照，后续以实际命令结果为准。`master-orchestrator-offline/`
及上一级 ZIP、恢复脚本保留为历史材料，不自动复制到当前仓库。

## 分工和交接

1. 默认 Codex 修改与整合，Cursor 只读审查。用户可直接指定 Cursor 实现某个任务，再由 Codex 审查，指定后不重复请求同一授权。
2. 交接记录串行时由当前写入方维护，并行时仅由指定整合方维护。修改前由这位维护方在下表记录任务和文件范围；审查意见回复给用户，再由维护方汇入，避免两端争抢同一份记录。
3. 修改同一文件前，原写入方保存编辑、结束写入，由记录维护方更新状态；接手方重新读取磁盘文件和 Git 状态。不要用旧缓冲区覆盖新内容。
4. 用户明确分配互不重叠的文件范围后可并行修改；共同依赖、全局替换及 Git 操作仍交给一个整合方。共享文件的变更须重新交接。
5. 开始时已有的未提交内容不属于本次任务。不要删除、回滚、暂存或提交另一方的工作；遵守 `AGENTS.md` 的分支、commit 和 push 规则。
6. 完成后由记录维护方汇总实际修改、验证结果和剩余问题。验证定义、离线用例通过不等于真实模型行为验证通过。

本文件是人工和代理共同遵守的约定，不是自动文件锁。空闲记录不能证明另一端没有运行；存在冲突迹象时先核对当前分工。

## 当前交接记录

| 项目 | 内容 |
| --- | --- |
| 更新时间 | 2026-11-19（北京时间） |
| 当前任务 | Clarify 独立入库已完成（`99bb2ce`）；本轮整理并单独提交协作配置 |
| 当前分支 / HEAD | `codex/master-integration` / `99bb2ce`（以实际 `git rev-parse` 为准；协作配置提交后 HEAD 会前移） |
| 当前写入方 | Cursor（用户明确指派实现本计划）；完成后恢复默认：Codex 实现、Cursor 审查 |
| 记录维护方 | Cursor（本轮串行写入方）；完成后交回 Codex 或随下一写入方交接 |
| Cursor 分工 | 本轮：更新交接记录并提交协作配置 3 文件；提交后只读复核残留状态 |
| 本次写入范围 | `AGENTS.md`、`.cursor/rules/shared-workspace.mdc`、`docs/collaboration.md` |
| 已知既有工作 | Clarify 包已在 `99bb2ce` 入库。协作配置提交前：`AGENTS.md` 为已跟踪未提交修改（` M`）；`.cursor/rules/shared-workspace.mdc` 与本文件为未跟踪（`??`）。两份 `docs/reports/master-clarify-p0-*` 仍未跟踪，不混入本提交 |
| 核心变更 | 共用工作区规则写入 `AGENTS.md` §5；Cursor 规则与交接记录入库；交接表与 Clarify 已提交状态对齐 |
| 验证 | 拟提交 3 文件 dry-run；`check_encoding.ps1 -Json`；针对拟提交内容 `git diff --check` |
| Git 操作 | Clarify 已 commit、未 push。本轮仅暂存并 commit 上述 3 文件；不 push；不纳入 P0 |
| 下一步 | P0 材料另行处理；Clarify P5 真实行为评测仍待明确授权与费用边界；P6 未启动 |

## 协作配置的独立变更范围

本轮在当前仓库仅纳入：

- `AGENTS.md`（已跟踪修改）
- `.cursor/rules/shared-workspace.mdc`（未跟踪）
- `docs/collaboration.md`（未跟踪）

外层 `../AGENTS.md` 和 `../master.code-workspace` 是当前电脑的入口文件，
不属于这个 Git 仓库；不要为纳入它们而操作外层空仓库或把整个 `master/` 暂存。
已入库的 `skills/master-clarify/` 与两份 P0 审计材料不混入本协作配置提交。

## Clarify 独立提交快照（2026-11-19）

Clarify 独立包已提交：`99bb2ce`
（`feat(master-clarify): add standalone offline engineering snapshot`）。

- 提交范围：`skills/master-clarify/` 下 33 个文件。
- 排除：包内 `.local/`、`.test-tmp/`、缓存；协作配置与两份 P0 审计材料。
- 状态口径：独立离线工程快照；行为未验证；Master 默认入口未改变。
- 验证依据：包内 `reports/verification.json` 的 `currentVerification`；顶层旧字段属于 2026-10-28 历史快照。
- 未重跑完整 Pester、Node DSH、旧 Master 专项回归及原仓库外完整审计钩子；旧结果不算该提交轮次的新通过。
- 原始日志：本仓库 `.local/clarify-review-20261119-gnxgd47y/` 等，不随包分发。
- Push：未执行。

Clarify P5 评测、P6 集成及 DSH 真实调用均不属于工作区配置提交。
具体开发目标、评测入口及费用边界应在对应任务中明确；本记录不构成额外授权。

## 基础验证入口

使用 PowerShell 7，在本仓库根目录运行：

```powershell
pwsh -NoProfile -File ./scripts/check_encoding.ps1
pwsh -NoProfile -File ./helpers/validate_templates.ps1
pwsh -NoProfile -File ./helpers/validate_task_analysis.ps1 -File 'examples/task-analysis/*.json'
pwsh -NoProfile -File ./evals/run_prompt_evals.ps1
```

模板验证默认依赖本地专家库 `~/.openclaw/agency-agents`。缺失时报告缺失，
或者明确使用已有的离线测试目录并记录 `-AgencyRoot` 参数；不要声称验证了真实专家库。
进一步验证按改动范围参考 `local-ci.ps1` 和各子目录说明。

首次设置工作区时实际执行的命令（均退出成功）：

```powershell
pwsh -NoProfile -File ./scripts/check_encoding.ps1 -Json
pwsh -NoProfile -File ./helpers/validate_templates.ps1 -AgencyRoot ./.ci-stubs/agency-agents
pwsh -NoProfile -File ./helpers/validate_task_analysis.ps1 -File './examples/task-analysis/*.json' -Json
pwsh -NoProfile -File ./evals/run_prompt_evals.ps1 -Json
git diff --check
```

2026-11-19，用户已转贴 Cursor 的首次只读回复，确认其读取了协作规则。
后续新建 Cursor 对话时，仍可使用下面的接手提示。

## Cursor 首次接手提示

> 请读取本仓库 AGENTS.md 和 docs/collaboration.md，确认你操作的是
> master-orchestrator-recovered 的当前本地目录。现在先只读检查当前代码、
> 未提交内容和交接记录，汇报你的理解与开发建议。不要自动切换分支、提交或推送。

规则机制参考：[Cursor 项目规则](https://cursor.com/docs/rules)、
[Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)、
[Codex 本地环境](https://learn.chatgpt.com/docs/environments/modes)。
