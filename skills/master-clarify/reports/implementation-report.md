# Master Clarify 实施与验证报告

初始实施日期：2026-10-28。包版本 0.1.0；任务书 `Master_Clarify_Codex_Implementation_Plan_v0.1.md`。
第 1–9 节保留该日历史记录；2026-11-19 修正见第 10 节，当前验证见第 11 节。
任务书 SHA-256：`e5efa5d72c0239b5fe539678b4ae20a0b0e785724d43d0255b9aafe7233418b3`。
本报告可随包复制，不包含用户私人目录。原始执行日志仅在源仓库 `.local/` 留存，
没有作为 Git 或分发包附件提供；日志哈希不能替代日志内容，也不能证明读者已复核它们。

## 1. 仓库与改动边界

源仓库为 workspace 内 `master-orchestrator-recovered`，分支 `codex/master-integration`，
起始 HEAD `645e2c28d5f339899be9008d62bdb2e4604eaa01`。
开始 P0 时工作区干净；取得任务书后，仅有本轮此前新增的两份 P0 审计报告未跟踪。
它们保留原历史核查结果。本轮在 `skills/master-clarify/` 隔离新增，未修改已有实现。
没有切分支、commit、push、merge、部署或默认入口切换。

P0 已阅读适用 AGENTS、README、implementation-status、06-intent、Clarity Gate、
三个相关 Schema、helper、CI/编码检查、旧评测与预算入口。初次附件缺失时只做了
P0；取得明确路径后已读取完整任务书，继续实施独立模块。

| 对象 | 决定 | 依据 |
| --- | --- | --- |
| 取证、未知、专业视角、场景与反例、反馈校准 | 复用方法 | 不依赖旧字段或全套流程 |
| 旧 06 四层 + 0.75、一轮一问 | 保持旧实现；新包不用 | 该接口有特定旧交接语义 |
| requirement_clarity / master_output_contract | 保持不动 | 强制执行契约，不适合独立需求状态 |
| clarify_input.v1 / clarify_state.v1 | 新建独立版本 | 来源、需求充分性、确认、执行条件分别表达 |
| 验证器、修订与呈现 CLI | 新建小工具 | 旧 helper 局部检查不足；严格 Schema + 语义一致性 |
| Master 入口、授权、预算、DSH 接线 | 保持不动 | P6 仅独立行为验收后允许 |

## 2. 阶段结论

P0 核查、P1 契约/案例、P2 Skill、P3 工具、P4 离线及独立包验证均完成。
P5 已准备输入包、冻结集、成对比较计划和空白回收格式；真实模型评测未执行。
P6 未进入。结论为 `ENGINEERING_OFFLINE_PASS`、`BEHAVIOR_NOT_VERIFIED`、
`INTEGRATION_NOT_STARTED`。这不是独立澄清行为最终验收。

## 3. 文件及用途

| 文件/目录 | 用途 |
| --- | --- |
| `SKILL.md`、`references/` | 独立入口、条件方法、三类专业检查及旧契约/CR 映射 |
| `README.md`、`requirements.txt` | 独立加载、已声明的小型依赖及复现命令 |
| `contracts/` | 独立输入/输出 JSON Schema 与语义契约 |
| `examples/` | 完整、歧义、局部修订的输入、候选状态及真实渲染摘要 |
| `tools/clarify.py` | 结构/来源校验、下一步推导、修订检查、统一摘要和 CLI |
| `tools/package.py` | 相对引用/私人路径特征检查、自包含复制和 SHA-256 清单 |
| `tests/` | T01–T26 合成机制 fixture、独立复制及确定性正反例 |
| `evals/` | 全部行为案例、冻结集、覆盖计划、评审、待运行输入与回收格式 |
| `reports/` | 当前工程与行为证据界限、实际验证结果 |

## 4. 独立使用

读取包根 SKILL.md 及其包内契约即可，不要求 Core。候选状态由已有模型宿主生成；
Python 工具不调用模型。Python 3.10+ 和 jsonschema >=4.18,<5 是全部工具依赖；
本轮已有 Python 3.12.10、jsonschema 4.26.0，未安装依赖。
三条实际流程命令与完整用法见 [README](../README.md)。真实宿主日志必须另存，
host_output 标记和 digest 都不是来源身份认证或行为验收。

## 5. 确定性验证与回归

P0 实测基线：Python Master 集成 10/10；Pester 在关闭本机不可用的 TestRegistry
和 XML 导出后 75/75；模板 6、任务分析 4、prompt 案例定义 19、意图示例 5、
输出契约示例 3 均通过。三个相关 Schema 的 9 个示例严格验证通过。

既有失败：标准 run-tests.ps1 受注册表/CIM 权限限制，返回 0 也不能算通过；
Node 全套两次无最终汇总。额外两次有时限诊断确认 provider fixture 连接本机回环
EACCES 后初始化清理未执行，残留 TCPServerWrap；诊断进程已回收，未修既有源码。
这些均为新增模块前的环境/测试基线问题，不借旧报告的历史通过数替代本轮执行。

独立审查已经修复：模型来源关闭用户决策缺口、本地来源原文漂移、改变交接引用
绕过重评三类问题，并补对应测试。

以下是本轮新增后实际执行结果，均退出 0（命令以仓库根为工作目录，另有说明除外）：

| 命令 | 实际结果 |
| --- | --- |
| `python -B -m unittest discover -s skills/master-clarify/tests -p 'test_*.py' -v` | 52/52；其中一个测试包含 T01–T26 合成机制子案例，不重复累加为测试总数 |
| `python -B -m unittest discover -s skills/master-clarify/evals -p test_materials.py -v` | 7/7；冻结、覆盖、答案隔离和空模板验证 |
| `python skills/master-clarify/evals/prepare.py check` | 26 案例、12 能力、14 待评测案例、4 保留案例、至少 34 会话 |
| `python skills/master-clarify/evals/prepare.py prepare --output .local/clarify-eval-inputs-20261028` | 14 输入包；14/14 输入 Schema 有效；0 模型调用 |
| `python tools/clarify.py run ...`（在包根，三组完整参数见 README） | clear=ready_for_planning；ambiguous=clarify；revised=ready_for_planning，H1=needs_review；均 synthetic |
| `python tools/package.py`（包根） | 必需资源、模块内引用、私人路径/密钥特征检查通过 |
| `python scripts/master_skill.py check --root .` | 旧 Master 8 模块闭包通过 |
| `python tests/test_master_skill.py` | 旧 Python 回归 10/10 |
| `pwsh -NoProfile -File .local/clarify-final-regression/run-pester-portable.ps1` | 旧 Pester 75/75，0 跳过，TestRegistry 和 XML 导出关闭 |
| `pwsh -NoProfile -File ./helpers/validate_templates.ps1` | 6/6 |
| `pwsh -NoProfile -File ./helpers/validate_task_analysis.ps1 -File examples/task-analysis/*.json -Json` | 4/4 |
| `pwsh -NoProfile -File ./evals/run_prompt_evals.ps1 -Json` | 19/19 案例定义 |
| `pwsh -NoProfile -File ./scripts/check_encoding.ps1 -Json` | 回归时 255 文件、0 问题；新增机器记录后的最终结果见 verification.json |

Skill-creator 的现成 quick_validate.py 在 UTF-8 模式下执行，退出 0，Skill is valid。
最初不加 UTF-8 模式受 Windows 默认 GBK 解码影响；未修改系统语言配置。
评测输入包不允许输出到能力包内部，曾执行该无效路径返回 2，已修正 README 并实际
运行到能力包之外；保护规则未绕过。早期测试临时目录受本机权限限制，改为自有
临时目录后通过全部断言，无跳过。

整个能力包另复制到原仓库之外的临时目录；Python `-I` 模式和文件访问审计钩子
拒绝读取原仓库（包括 Core）。在该独立副本中，52 项测试、7 项材料测试、三个
示例、评测材料检查和包检查全部退出 0。只有已声明的 Python/jsonschema 环境。
完整审计钩子、命令、退出码和日志保存在源仓库 `.local/clarify-independent-verification/`。
模型宿主真正按 Skill 交互的能力仍需 P5，这些独立运行是工程证据。

最终回归原始记录保存在 `.local/clarify-final-regression/`，P0 原始记录在
`.local/clarify-p0-20261028/`。机器摘要见 [verification.json](verification.json)。

## 6. 真实行为评测

实际模型请求 0；真实 transcript 0；对照结果不存在；相对改善 NOT VERIFIED。
已有 DeepSeek 只读路径 networkAllowed=false、真实调用未开放，授权模板 approved=false、
额度为空；旧 LLM runner 无满足本次要求的累计费用授权保护。未读密钥、未查余额，
未新增供应商。当前聊天中的工程子代理审查只作代码审查，不冒充 P5 模型评测。

准备的计划包含 14 个不同案例，覆盖 12 项能力、三类领域、4 个冻结保留案例；
3 个关键案例各重复一次，双臂共至少 34 个独立会话（多轮种子/回答另计请求）。
这些数量是待评测需求，不是授权。限额优先；不够就保留未完成。保留案例未用真实
输出调提示词；如未来用于调优须移入开发集并补新保留案例。

## 7. 能力可追踪性

| 能力 | 实现抓手 | 案例及机制证据 |
| --- | --- | --- |
| CL-01 | 项目/任务隔离、来源关联、按需核实 | T02/T03/T23；来源与跨项目反例 |
| CL-02 | 目标/手段分开、保留明确选择 | T04/T05；目标与推断来源分层 |
| CL-03 | 按交付性质专业检查 | T06/T24；不强制软件字段 |
| CL-04 | 原始材料请求、未知条件 | T07/T08；await_evidence 与不可访问来源 |
| CL-05 | 必需/建议/推断分开 | T07/T09；item kind、confirmation |
| CL-06 | 当前/执行/未来影响分开 | T10/T11/T12；执行缺口不阻断规划 |
| CL-07 | 来源/原话/冲突/假设 | T13/T14/T22；伪造确认、引用、冲突反例 |
| CL-08 | 关键缺口驱动、零追问 | T01/T03/T15；请求关联与就绪/暂停 |
| CL-09 | 低成本表达性样例 | T16/T17；sideEffects=false、sample许可 |
| CL-10 | 可观察标准、人工判断 | T18/T24；criterion verification 校验 |
| CL-11 | 固定优先级、规划与执行分离 | T01/T19/T20；复合状态与授权提升反例 |
| CL-12 | 稳定 ID、局部修订与失效 | T21/T25/T26；来源追加、旧记录保留、交接重评 |

表中是规则实现和合成机制测试的可追踪性，不是十二项真实语义能力已验证。
目标忠实、必要补全、诱导性、语义一致性还需按 evals 的原始材料与评审标准判断。

## 8. 边界与剩余工作

没有改 Master 默认入口，没有外部业务动作，没有付费调用。模块只处理澄清结果，
ready_for_planning 不映射 execute/Runtime READY。所有报告 executionAuthorized=false。
没有桥接或回退配置可交付，因为 P6 未启动，原入口始终保留。

最小下一步：用已可用且获授权、有累计费用上限的宿主
运行准备好的成对评测，保留真实输入、追问、用户回答来源和输出，由独立评审判断。
缺少真实入口/授权/限额时保持 BEHAVIOR_NOT_VERIFIED，不因离线通过进入 P6。

## 9. 差异与提交状态

原有跟踪文件的 `git diff --name-only` 和暂存区 diff 均为空；新增本独立模块及此前
两份 P0 报告，均保留为可审阅的未跟踪文件。每个模块文件见最终包清单及 SHA-256。
`.gitignore` 排除运行输出与测试临时文件。没有 commit/push/merge，未改变 CI 或默认入口。

## 10. 2026-11-19 Cursor 审查跟进

本轮修改仅涉及测试、契约说明和这两份验证报告；未修改运行工具、评测冻结案例、
Master 默认入口或旧 06/Clarity Gate。P0 报告保留为前置核查历史，不与成品包混为当前状态。

新增 9 个测试方法，覆盖有效共享依赖、未知依赖、自依赖及多节点环、废弃依赖
与相关/无关/已关闭复核缺口，以及 `example` 缺口的来源类型和跨轮关闭。
样例只有收到本轮新提供且被引用的用户回复后才能关闭；模型、材料、检查结果、
宿主控制信息和旧用户原话均不能替代该回复。工具已有这些约束，本轮通过测试固定边界。

本轮从源仓库根目录实际运行：

| 命令 | 结果 |
| --- | --- |
| `python -B -m unittest discover -s skills/master-clarify/tests -p 'test_*.py' -v` | 61/61，无失败；合成确定性机制测试 |
| `python -B -m unittest discover -s skills/master-clarify/evals -p test_materials.py -v` | 7/7，无失败；评测材料一致性 |
| `python -B skills/master-clarify/evals/prepare.py check` | 26 案例、12 能力、14 待评案例、4 保留案例；至少 34 会话为计划需求，模型调用 0 |
| `pwsh -NoProfile -File ./scripts/check_encoding.ps1 -Json` | 257 文件，0 问题 |
| `pwsh -NoProfile -File ./helpers/validate_templates.ps1 -AgencyRoot ./.ci-stubs/agency-agents` | 6/6；使用离线专家占位数据 |
| `pwsh -NoProfile -File ./helpers/validate_task_analysis.ps1 -File './examples/task-analysis/*.json' -Json` | 4/4 |
| `pwsh -NoProfile -File ./evals/run_prompt_evals.ps1 -Json` | 19/19 离线定义 |
| `python -B skills/master-clarify/tools/package.py` | 包检查通过，33 文件 |
| `git diff --check` | 退出 0 |
| `git add --dry-run -- skills/master-clarify` | 仅预览包内 33 文件；没有实际暂存 |

### 当前与历史证据

[verification.json](verification.json) 顶层旧日期、测试、回归、独立副本、
`sourceSha256`、`logSha256` 等字段完整保留为 **2026-10-28 历史快照**。
`evidenceScope` 明确范围；当时的 `currentVerification` 记录 2026-11-19 实际命令、
结果和源文件哈希，现已原值保存到 `priorVerifications` 的同日对象。当前工作副本
验证见第 11 节及 `currentVerification.sourceSha256`，不能用历史哈希断言改动后的
文件仍是旧版本。

本轮未重跑完整 Pester、Node DSH、旧 Master 专项回归或原仓库外的完整审计钩子
验证。包单测中的复制检查已经执行，但不等同于上述完整独立目录验证。第 5 节的
52/7、75 项 Pester 和审计钩子结果仍只是历史结果，不提升为本轮通过。

### 31 / 33 计数与可复查范围

分发包共 33 个文件：31 个非 `reports/` 文件，以及本报告和 `verification.json`
两份证据说明。源码哈希清单排除 `reports/**`，避免报告对自身内容的循环引用。
这不是漏打包报告，也不是少算两项源码。

`python -B skills/master-clarify/tools/package.py --output <新目录>` 生成独立副本，
并在副本的 `package-manifest.json` 中记录包含两份报告的完整 33 项文件哈希；
清单自身不计入文件数量。仅运行包检查不会自动核验验证报告里的源码哈希。

历史及本轮 `.local/` 原始日志均属于本机证据，未随包分发。读者可用上表及 README
的命令在声明的依赖环境中重新运行当前检查；没有原始日志就不能复核历史命令
输出，仅有 `logSha256` 也不构成日志附件。仓库级命令需完整仓库，独立复制包仅能
运行包内命令；私有 portable Pester 脚本及原独立审计钩子不属于分发内容。

状态保持 `ENGINEERING_OFFLINE_PASS` / `BEHAVIOR_NOT_VERIFIED` /
`INTEGRATION_NOT_STARTED`。真实模型调用、付费调用和业务操作均为 0。
后续独立提交只纳入包内 33 个文件；协作配置、两份 P0 材料和临时输出分开处理。

## 11. 2026-11-23 方法与离线交互检查

本轮按用户要求暂停计费/运输主线，修订 SKILL、方法参考和行为 rubric，新增
`evals/interaction_checks.py` 与对应离线测试；README、评测 README、回收模板同步。
未修改 Master 入口、旧 06、P6、两个 v1 Schema 或原 `tools/clarify.py`。
此前 P5/E4 的未提交工程及历史报告保持原字节；真实模型、账户查询和费用仍为 0。

修复链按同一可信 input/previous 计数，首次候选不计额外修复；默认最多修复 2 次，
成功或到限即停止，后续输出构成记录越界。全部候选重新校验，不相信自填 valid；
到限无效不会生成虚假的 ready/paused 状态。新输入另开轮不免除活动级累计要求，
本工具并不执行模型、活动预算或来源认证。

最小追问保留原契约的当前缺口覆盖；重复问题换 ID/空白仍被拒绝，重叠缺口的不同
问法标为待语义评审。允许零追问及多个独立关键缺口并列，不把固定一问当门槛。
默认每份原始输出上限 65,536 字节，中文/emoji/CRLF/转义/空白及失败输出计入，
超限不截断。规范状态与逻辑摘要长度分别报告，不能换成 Token/计费结论。

当前精确命令、结果和源码封印见 [verification.json](verification.json) 的
`currentVerification`；上一份 2026-11-19 对象原值保留在 `priorVerifications`，
顶层 2026-10-28 历史字段也保留。当前分发为 35 文件：33 个非 reports 文件和两份
报告；本节更新计数不改写第 10 节的 31/33 历史结论。原始本轮日志仍在仓库 `.local/`
留存，未随包分发，哈希不是日志附件。

本轮未修改 cases.jsonl、freeze.json 或 plan.json，不重冻保留集，不运行真实模型。
SKILL/方法已改变，旧 prepared 快照及旧 P5/E4 报告的包哈希只对应历史版本；
后续恢复评测必须重新准备并核对新快照。离线测试只验证合成机制，当前状态仍为
`ENGINEERING_OFFLINE_PASS` / `BEHAVIOR_NOT_VERIFIED` / `INTEGRATION_NOT_STARTED`。
没有切分支、暂存、commit 或 push。

本轮实际验证：包单测 85/85（既有 61 + 新增 24），材料 7/7；prepare check 与
14 个新输入包准备通过；clear/ambiguous 离线交互检查通过；包检查 35 文件通过；
skill-creator 格式检查通过。编码 276/0、模板 6/0（离线 stub）、任务分析 4/0、
离线定义 19/0 和 diff check 通过。初次包扫描与材料测试清理临时目录并行发生冲突，
已在测试结束后串行重跑通过；初次报告换行问题已修正为 LF，未改变旧验证对象值。
暂停的 P5/E4 宿主及运输测试、原生 DSH 探针、完整 Pester 和真实模型评测均未重跑。
另在验证副本中运行新增检查器，审计钩子禁止读取源仓库和连接网络，clear 合成输入
通过。副本 33 个非 reports 源文件与本轮一致；报告保留复制时快照。这不等同于
完整仓库外回归或真实行为评测。
