# Cursor 与 Codex 共用开发目录

## 打开同一份代码

- 当前开发目录：外层 `master/` 工作区下的 `master-orchestrator-recovered/`；以该目录内 `git rev-parse --show-toplevel` 的结果为准。
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

## 历史报告中的路径表示

2026-11-19 对历史 DSH 报告及证据 JSON 整理了路径。下列标记只用于描述位置，
不是环境变量或已验证可用的目录；命令中的占位路径须由读者按自己的环境替换。
本仓库的相对路径均以仓库根目录为基准。

| 表示 | 含义 |
| --- | --- |
| `.` / `./...` | 当前仓库根目录及其内部文件；`.local/` 产物仍保持相对定位 |
| `<INSTALLED_DSH_HOME>` | 原始安装使用的 DSH 用户配置目录（通常为用户目录下的 `.dsh`）；区别于隔离试验临时设置的 `DSH_HOME` |
| `<DSH_INSTALL_ROOT>` | 外部 DSH 应用安装根目录，保留其下 `resources/`、`app.asar` 和程序文件结构 |
| `<PROGRAM_FILES>` | Windows 的 Program Files 目录 |
| `<PROGRAM_FILES_X86>` | Windows 的 Program Files (x86) 目录 |

历史日期、结论、计数、布尔值、费用/授权状态、摘要、签名及哈希值均保留原值。
JSON 的 `pathNormalization` 标明本次整理及对应整理前提交；路径键名也按同一规则
变换，键对应的原始哈希不重算。命令、错误摘录及带路径的证据对象是规范化后的展示，
不再是逐字原始记录，不应作为原始运行时输入重新验证签名或重放。
需要核对原始字节或绑定关系时，应使用原始产物；`.local/` 日志和外部安装文件未因
本次整理而进入仓库。原始哈希不是日志附件，本次也不重跑历史模型或运行时验证。

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
| 当前任务 | 历史 DSH 报告及交接记录的路径整理与验证已完成；本轮独立提交以 Git 记录为准 |
| 当前分支 / 基线 | `codex/master-integration`；本轮起始提交 `ae8bcf7`，实时 HEAD 以 `git rev-parse HEAD` 为准 |
| 当前写入方 | 本轮由 Codex 完成整理与验证，提交后交回只读复核；Cursor 继续只读审查 |
| 记录维护方 | Codex |
| Cursor 分工 | 只读核对本轮路径清理、历史证据边界和提交范围 |
| 本次写入范围 | 下表列出的 12 份 DSH/runtime 历史报告和证据，以及本文件，共 13 文件 |
| 已知既有工作 | 本轮开始时仓库干净。Clarify `99bb2ce`、协作配置 `e3451bc`、通用代理说明 `d9b29bf`、P0 归档 `ae8bcf7` 均已提交 |
| 核心变更 | 仓库内路径相对化，外部安装目录使用明确占位符；历史报告与当前交接状态分别说明 |
| 验证 | 50 个 JSON 路径键、81 个路径值及 13 行历史 Markdown 路径已规范化；329 个 JSON SHA-256 值及全部非路径值不变。编码 257/0、模板 6/0、任务分析 4/0、离线定义 19/0 通过；报告目录及本文件无本机绝对路径；差异检查通过 |
| Git 操作 | 用户已授权本轮单独提交；不 push，不修改运行实现、授权单、Clarify 包或 P0 归档 |
| 下一步 | Cursor 只读审查本轮独立提交；P5 仍待明确授权与费用边界，P6 未启动 |

本轮历史材料范围（每份报告的原始时点及结论保持不变）：

| Markdown 报告 | 对应证据 JSON |
| --- | --- |
| `docs/reports/master-dsh-v2.1-adapter.md` | `docs/reports/master-dsh-v2.1-adapter-evidence.json` |
| `docs/reports/master-dsh-runtime-e2e-verification.md` | `docs/reports/master-dsh-runtime-e2e-evidence.json` |
| `docs/reports/master-dsh-real-session-wiring.md` | `docs/reports/master-dsh-real-session-wiring-evidence.json` |
| `docs/reports/master-dsh-provider-safety.md` | `docs/reports/master-dsh-provider-safety-evidence.json` |
| `docs/reports/master-runtime-integration-verification.md` | `docs/reports/runtime-verification-evidence.json` |
| 未修改 Markdown（无本机路径） | `docs/reports/master-dsh-readonly-model-readiness-evidence.json` |
| 未修改 Markdown（无本机路径） | `docs/reports/master-dsh-readonly-pilot-admission-evidence.json` |

## 协作配置提交快照（`e3451bc`）

该历史提交在当前仓库仅纳入以下文件，括号内为当时提交前的状态：

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
