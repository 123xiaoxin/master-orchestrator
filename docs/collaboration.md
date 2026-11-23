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
| 更新时间 | 2026-11-23（北京时间） |
| 当前任务 | Clarify「少轮做对」宿主规程与必要离线检查已实现；本轮只交审，不暂存、不 commit |
| 当前分支 / 基线 | `codex/master-integration` / `0eb6019` |
| 当前写入方 / 记录维护方 | Codex 实现与验证；Cursor 只读审查 |
| Cursor 既有审查结论 | 用户确认上一轮默认额外修复 2 次、最小追问与每份 65,536 UTF-8 字节检查已通过只读审查；本轮宿主规程尚待新审查 |
| 实际修改范围 | 下列 13 文件（12 个已跟踪修改、1 个新规程文件）；不包含任何暂停工程 |
| 核心约束 | 先生成候选，再做契约及交互检查；无效最多额外修复 2 次，仍无效保留错误停止；有效后才按推导状态追问或交接；失败输出计字节 |
| 两臂加载 | baseline 只加载三份公共契约；skill 再加载入口、方法、兼容边界三份说明；主持人协议与评测答案不发给模型 |
| 计费与运输 | 暂停；E4 PARTIAL / LIVE_ADMISSION_BLOCKED；不补计费上界，不调用模型或查询账户，不进 P6，不改 Master 默认入口 |
| 既有工作 | 开始时 16 项未跟踪工程（含既存 pycache）保持原字节；不运行或修改 admission/eval 运输工程及 P5/E4 报告 |
| 验证 | 包内 91/91、材料 8/8，freeze、14 个准备包、CLI 修复/零问及 digest 对照、格式检查通过；四项基础与包检查记录在 currentVerification.checks；BEHAVIOR_NOT_VERIFIED |
| Git 操作 | 暂存区为空；没有本轮暂存/commit 授权，不 push |
| 下一步 | 交 Cursor 只读审查本轮 13 文件；等待用户另行明确「可以 commit」，当前不暂存 |

### 本轮文件清单（13 项）

- `skills/master-clarify/SKILL.md`
- `skills/master-clarify/README.md`
- `skills/master-clarify/references/clarification-method.md`
- `skills/master-clarify/evals/README.md`
- `skills/master-clarify/evals/host-protocol.md`（新增）
- `skills/master-clarify/evals/rubric.md`
- `skills/master-clarify/evals/prepare.py`
- `skills/master-clarify/evals/interaction_checks.py`
- `skills/master-clarify/evals/test_materials.py`
- `skills/master-clarify/tests/test_interaction_checks.py`
- `skills/master-clarify/reports/implementation-report.md`
- `skills/master-clarify/reports/verification.json`
- `docs/collaboration.md`

实现细节见[宿主规程](../skills/master-clarify/evals/host-protocol.md)，本轮结果与局限见
[实施报告第 12 节](../skills/master-clarify/reports/implementation-report.md#12-2026-11-23-少轮做对宿主规程基线-0eb6019)
及 [verification.json](../skills/master-clarify/reports/verification.json) 的 currentVerification。
本轮日志保存在 `.local/clarify-host-protocol-20261123-n4z8dutp/`，不随包分发。
源文件封印 34 项，分发包 36 项（含两份报告）；此前 currentVerification 完整追加到
priorVerifications，历史日志与源码哈希不改写。此处 Codex 内部只读复审不代替 Cursor 新一轮审查。

本轮新增检查覆盖失败不放行、修复后绑定同轮规范结果、零问分流、混合请求优先级、
重叠请求先人工复核、previous 绑定与错误保留；材料测试锁定两臂白名单及操作者文件隔离。
准备器并未实现真实宿主隔离或会话累计控制，checks 的 hostDirective 不是调用许可。

本轮实际验证命令（仓库根目录，日志/输出使用新目录）：

```powershell
python -B -X utf8 -m unittest discover -s skills/master-clarify/tests -p 'test_*.py' -v
python -B -X utf8 -m unittest discover -s skills/master-clarify/evals -p test_materials.py -v
python -B -X utf8 skills/master-clarify/evals/prepare.py check
python -B -X utf8 skills/master-clarify/evals/prepare.py prepare --output .local/clarify-host-protocol-20261123-n4z8dutp/packets
python -B -X utf8 skills/master-clarify/tools/package.py
pwsh -NoProfile -File ./scripts/check_encoding.ps1 -Json
pwsh -NoProfile -File ./helpers/validate_templates.ps1 -AgencyRoot ./.ci-stubs/agency-agents
pwsh -NoProfile -File ./helpers/validate_task_analysis.ps1 -File './examples/task-analysis/*.json' -Json
pwsh -NoProfile -File ./evals/run_prompt_evals.ps1 -Json
git diff --check
```

CLI 初次失败、修复后有效、单次规范结果及 clear 零问回放的精确参数和退出码另见
currentVerification.checks；初次无效返回 2 是预期结果。模板检查使用离线 stub，
不证明真实专家库可用。原生 DSH、暂停工程、真实模型与账户相关检查没有运行。

## 方法轮次提交准备历史（已提交 `0eb6019`）

以下保留上一轮提交前快照；其后用户授权提交了恰好 11 项，形成 `0eb6019`，未 push。
表中 `aec69bd`、待批准和未提交口径只描述当时准备阶段，不代表当前 HEAD 或本轮权限。


| 项目 | 内容 |
| --- | --- |
| 更新时间 | 2026-11-23（北京时间） |
| 当前任务 | 单独整理「少轮做对」方法轮次的 11 文件，复跑验证并预览提交范围；等待用户明确授权后才可暂存、commit |
| 当前分支 / 基线 | `codex/master-integration`；离线工程基线 `aec69bd`，实时 HEAD 以 `git rev-parse HEAD` 为准 |
| 当前写入方 | Codex 负责整理与验证；Cursor 继续只读审查 |
| 记录维护方 | Codex |
| Cursor 分工 | 只读核对 Clarify 文档、离线检查及快照证据；不修改、不启动真实评测 |
| Cursor 审查结论 | 用户已确认 Cursor 审查通过「少轮做对」离线改动：默认额外修复 2 次、最小追问检查、每份输出 65,536 UTF-8 字节；这不是 P5 行为验收或真实调用批准 |
| 拟提交范围 | 仅下方列出的 11 文件；本次整理更新本交接记录，包内已审查内容保持原样，验证日志留在忽略的 `.local/` |
| 已知既有工作 | 上两轮共 16 个工程文件未提交（含本文件），另有既存 `adapters/clarify-eval/__pycache__/messages.cpython-312.pyc`；保留计费/运输源码和历史报告原字节，缓存排除提交 |
| 核心变更 | 固定输入修复链默认额外 2 次；最小追问保留关键缺口覆盖、拒绝重复并标记语义待审；按原始 UTF-8 字节检查每次及累计输出，默认每份 65,536 字节；原 v1 契约/单次工具不改 |
| 验证 | 本轮复跑包单测 85/0、材料 7/0、prepare check、35 文件包检查通过；编码 276/0、模板 6/0（离线 stub）、任务分析 4/0、离线定义 19/0、diff check 通过；包内 10 个拟提交文件及源码封印 33 项保持原样 |
| 计费与运输 | 继续暂停；E4 仍 PARTIAL，真实准入仍 BLOCKED；不补计费上界，不运行真实模型/账户查询，不进 P6，不改 Master 默认入口 |
| Git 操作 | HEAD 保持 `aec69bd`；当前只允许 `git add --dry-run` 范围预览，未获暂存或 commit 授权，不 push |
| 提交范围预览 | 逐文件执行 `git add --dry-run --`，输出恰好下方 11 项（9 个已修改、2 个未跟踪），与白名单完全相等；预览前后暂存区均为空 |
| 下一步 | 向用户汇报本轮验证与恰好 11 项的 dry-run 结果，等待明确「可以 commit」后再执行提交；期间保持暂存区为空 |

### 拟提交文件（恰好 11 项）

- `skills/master-clarify/SKILL.md`
- `skills/master-clarify/references/clarification-method.md`
- `skills/master-clarify/evals/rubric.md`
- `skills/master-clarify/README.md`
- `skills/master-clarify/evals/README.md`
- `skills/master-clarify/evals/run-record.template.json`
- `skills/master-clarify/evals/interaction_checks.py`
- `skills/master-clarify/tests/test_interaction_checks.py`
- `skills/master-clarify/reports/implementation-report.md`
- `skills/master-clarify/reports/verification.json`
- `docs/collaboration.md`

排除 `adapters/clarify-admission/`、`adapters/clarify-eval/`、E4/P5 工程报告、
`scripts/clarify_native_probe.cjs`、仓库根 `tests/test_clarify_*.py` 及任何 `__pycache__`。
预览逐文件指定上述白名单，不用整个仓库或整个目录作暂存范围。

本次提交准备的复跑记录在 `.local/clarify-precommit-20261123-8y64b1ci/checks.json`，
dry-run 参数、输出清单及摘要在同目录 `dry-run.json`；原始日志不随提交分发。
本轮没有改写包内已审查报告；它们的历史验证和源码封印仍有效，新复跑结果单独记录。

实际验证命令（仓库根目录）：

```powershell
python -B -X utf8 -m unittest discover -s skills/master-clarify/tests -p 'test_*.py' -v
python -B -X utf8 -m unittest discover -s skills/master-clarify/evals -p test_materials.py -v
python -B -X utf8 skills/master-clarify/evals/prepare.py check
python -B -X utf8 skills/master-clarify/tools/package.py
pwsh -NoProfile -File ./scripts/check_encoding.ps1 -Json
pwsh -NoProfile -File ./helpers/validate_templates.ps1 -AgencyRoot ./.ci-stubs/agency-agents
pwsh -NoProfile -File ./helpers/validate_task_analysis.ps1 -File './examples/task-analysis/*.json' -Json
pwsh -NoProfile -File ./evals/run_prompt_evals.ps1 -Json
git diff --check
```

拟提交说明：`feat(master-clarify): add bounded offline interaction checks`。
内容为方法/rubric、离线检查与测试及交接整理；行为未验证，Master 默认入口不变。
这只是待用户批准的提交准备，未执行真实暂存、commit 或 push。

本轮说明与证据见 [Clarify 实施报告第 11 节](../skills/master-clarify/reports/implementation-report.md#11-2026-11-23-方法与离线交互检查)
及 [verification.json](../skills/master-clarify/reports/verification.json)。当前包 35 文件：
33 个非 reports 文件和两份报告；2026-11-19 原验证对象完整移入 priorVerifications，
26 个冻结案例与 plan 原字节不变。离线检查不能证明语义最少追问或真实行为改善。

上轮未提交工程记录：`docs/reports/master-clarify-e4-review-2026-11-23.md` 及同名
`.json`；仍在本机，不随本次方法提交分发。历史条件预算按整窗输入计算为
2.162688 元/请求、136 请求 294.125568 元，均未批准，不是所有失败路径的账单保证。
新组件仅支持每登记会话一次确切请求；不声称完整 P5 多轮运行器已经接通。
实际模型调用、账户/余额/模型列表查询、费用及 P6 均为 0。本轮未再检索供应商或计费资料。

## 历史路径整理快照（`ceb19ed`）

此前的路径整理共 13 文件，50 个 JSON 路径键、81 个路径值及 13 行 Markdown 路径
已规范化；329 个 SHA-256 值及全部非路径值不变。该轮编码 257/0、模板 6/0、
任务分析 4/0、离线定义 19/0 通过，已提交，未推送；Cursor 已只读复核。
以下清单属于该历史提交，不是当前 P5 准备的写入范围。

历史材料范围（每份报告的原始时点及结论保持不变）：

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
- 当时验证依据：包内 `reports/verification.json` 原 `currentVerification`，现完整保存在 `priorVerifications` 的 2026-11-19 对象；当前验证另见 2026-11-23 `currentVerification`。顶层旧字段属于 2026-10-28 历史快照。
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
