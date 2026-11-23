# Master Clarify — P0 实际仓库核查（历史归档）

> 归档说明（2026-11-19）：下文记录 2026-10-28 尚未取得指定任务书时的 P0 前置核查，
> 其中“本轮”“当前”“待实施”均指该历史时点，不代表现行开发状态。后来已取得任务书并
> 完成 P1–P4，独立包已在 `99bb2ce` 入库；后续实施与验证见
> 独立包实施报告见 `skills/master-clarify/reports/implementation-report.md`，
> 验证记录见 `skills/master-clarify/reports/verification.json` 的 `currentVerification`。
> 行为状态仍为 `BEHAVIOR_NOT_VERIFIED`，P6 仍未开始。
>
> 本次只补充历史说明并将本机绝对路径改为仓库相对路径，不重跑或改写当时的结果。
> 机器证据内 `archiveMetadata` 说明路径变换；源文件及日志哈希仍对应原始历史内容。
> `.local/` 原始日志未随这两份材料提交，日志指纹不能替代可复查的日志附件。

日期：2026-10-28（Asia/Shanghai）。状态：P0 仓库核查已完成，指定任务书核对待补；P1–P4 未实施。独立模块行为状态：**BEHAVIOR_NOT_VERIFIED**。

## 任务输入与阶段边界

本轮用户要求读取 `Master_Clarify_Codex_Implementation_Plan_v0.1.md`，先完成 P0，再连续实施独立澄清 Skill 的 P1–P4；P5 仅限已有、获授权且有费用上限的入口，独立行为验收通过后才考虑 P6。

当前聊天未提供可读的任务书正文或附件路径。在工作区、Documents、Downloads、`.codex` 及随后用户目录的文件名检索中，未找到指定文件。已向用户索取完整路径或正文。找到并读取的是 Downloads 下另一份《Master 澄清标准与任务划分标准草案 v0.1.md》；该文件自称设计草案、未实现，不能替代指定任务书，也不能据其猜测任务书第 9 节。

因此先完成不依赖该正文的仓库核查和离线基线。P1 的最终最小契约、验收案例及 P2–P4 实现需在取得任务书后继续。本报告按用户消息列出的汇报项目记录，未声称符合尚未读到的第 9 节全部要求。

## 仓库、分支与已有改动

- 实际工作仓库：`master-orchestrator-recovered`；本材料中的 `.` 表示该仓库根目录。
- 当前分支：`codex/master-integration`。
- 当前 HEAD：`645e2c28d5f339899be9008d62bdb2e4604eaa01`，来自本轮 `git rev-parse HEAD`；仅作版本定位，未借用历史验证结论。
- 修改前 `git status --short`：无输出，工作区干净。
- 外层 `..`（原工作区的 `master` 目录）是另一个尚无提交的 `master` 仓库，含两个副本及用户已有未跟踪文件。`master-orchestrator-offline` 没有独立 Git 根，不能据其旧 AGENTS 中的分支名定位当前工作。
- 已读取 recovered 根 `AGENTS.md`，并读取现有 `skills/master-skill/AGENTS.md` 及其入口了解既有模块规则。其他副本的 AGENTS 不用于支配 recovered 的修改。
- 本轮开发授权来自用户明确指令；没有切换/创建分支，没有 commit、push、merge 或部署。

## 现有入口与契约

| 对象 | 本轮实际读取结论 | 独立模块边界 |
| --- | --- | --- |
| `skills/master-skill/SKILL.md`、`modules.json` | 现有 Master 入口选择 01/05/07/08 必需模块；06 是条件模块，依赖 01。历史 Clarity Gate 文档不是第二入口 | 不改默认入口，不通过改清单提前接回 Master |
| `prompts/06-intent-elicitation.md` | Phase -1a 意图证据模块；每轮一个问题；保留用户原话和意图变化；仅向 Phase -1b 交接 | 可复用证据与变化记录原则；不能照搬成独立规划就绪契约 |
| `schemas/intent_elicitation.v1.schema.json`、`helpers/validate_intent_elicitation.ps1` | 字段包括四层 imagery、`executionClarityEstimate`、`recommendedNextPhase`；验证器要求四层 concrete 且估计 ≥ 0.75 才能交接 | 这是旧记录约束；不得编造四层证据或评分来满足接口 |
| `docs/Master-Skill-v0.1-Clarity-Gate/02-clarity-gate.md` | 无固定澄清轮数；75%–80% 是启发式；决策为 execute/clarify/prototype | 不能把该执行决策直接用于独立澄清输出 |
| `schemas/requirement_clarity.v1.schema.json` | snake_case，必需评分、最小原型和 execution_contract；决策仅 execute/clarify/prototype | 与独立澄清及另一输出 Schema 不可混用；仓库未提供同名专用 helper |
| `schemas/master_output_contract.v1.schema.json`、`helpers/validate_master_output_contract.ps1` | camelCase，必需 executionClarity、executionContract、shouldCreateAgent；另含 require_more_information/degrade/block 决策 | `ready_for_planning` 不能映射为执行许可；缺少证据、授权或能力时保留未知 |
| `scripts/master_skill.py`、`tests/test_master_skill.py` | 现有打包器依赖 Master 模块清单、必需闭包及仓库资源 | 独立包须自行验证依赖闭包，不能把现有 Master 包成功当作独立包成功 |

相关离线测试包括 `IntentElicitation.Tests.ps1`、`MasterOutputContract.Tests.ps1`、`PromptContract.Tests.ps1`、`EvalOutput.Tests.ps1`、`SchemaDocumentation.Tests.ps1`，以及 `evals/cases/` 中 ambiguous-input、no-fixed-clarification-rounds、clarity-gate 和 elicit 类案例。测试中的构造记录与词句/规则断言只证明对应离线检查，不证明真实模型行为。

进一步核查发现：

- 两个旧 helper 都未调用完整 JSON Schema 校验。意图 helper 依赖字符串/数值强转和数组包装，`fallbackUsed` 只检查存在，未拒绝额外属性；输出契约 helper 未检查必需的 `minimumPrototype`。这些局部检查不能直接作为独立模块的严格验证器。
- 本轮实际负例探针把 bakery 示例的 `fallbackUsed` 改成字符串，并添加未知属性。意图 helper 退出码为 0、`ok=true`，而 `Test-Json -SchemaFile` 返回 false。该负例是构造的离线测试，只证明校验接受范围不同，不是用户记录或模型行为证据。原示例未修改，探针及输出保存在 `.local/clarify-p0-20261028/`。
- `evals/EvaluateOutput.ps1` 使用 Schema，但明确 `semanticJudgment=not_performed`。`evals/legacy-case-audit.json` 将四个 elicit 案例标为与旧 v1-only runner 不兼容；检查其当前案例定义通过也不能说明独立行为通过。
- `adapters/dsh-v2.1/adapter.mjs` 要求宿主在证据正文之外接纳真实用户权限，并将授权绑定具体合同摘要。不能伪造 goalConfirmation、authorization、能力或证据引用以通过适配器。
- 仓库目前未提供独立澄清状态更新器、用户呈现器或专用打包器；这些仍属于本轮待实施范围。

## P5 条件核查

现有 `docs/reports/first-readonly-pilot-authorization.md` 明确：未批准模型调用，批准额度未填写，网络闸门关闭。对应 `adapters/dsh-session/pilot-authorization.template.json` 是审阅模板，不是授权能力。不得用模板的布尔值、测试控制器签名、历史试验或当前聊天权限代替本次预算与模型调用授权。

`evals/run_llm_evals.ps1` 会实际调用兼容接口，并要求 Master 输出契约；“offline” 注释不代表无网络，也不代表它满足本次独立评测的费用上限。未运行它。

本轮目标模块真实模型评测请求：0。没有真实行为轨迹，没有行为通过结论。**BEHAVIOR_NOT_VERIFIED**。P6 未进入，默认入口未切换。

源码进一步确认 `adapters/dsh-session/deepseek-readonly.mjs` 的 `networkAllowed=false`，真实凭证、输入 Token 上界和 delegate 请求的路径仍主动拒绝真实调用；即使只补一个 approved 布尔值也不构成可用评测入口。

## 实际验证

以下均在 recovered 仓库运行，工具版本为 PowerShell 7.6.9、Python 3.12.10、Node v26.12.1、Pester 5.7.1。不引用历史通过数；这是现有实现的 P0 基线，不是尚未实现的独立模块 P4 结果。

| 实际命令 | 本轮结果 |
| --- | --- |
| `python scripts/master_skill.py check --root .` | 通过：当前 Master 入口、8 个模块、必需闭包 01/05/07/08 |
| `python tests/test_master_skill.py` | 10/10 通过 |
| `pwsh -NoProfile -File ./scripts/check_encoding.ps1 -Json` | 216 文件，0 问题（包含本报告初稿） |
| `pwsh -NoProfile -File ./helpers/validate_templates.ps1` | 6/6 通过，使用本机既有 agency-agents 目录 |
| `pwsh -NoProfile -File ./helpers/validate_task_analysis.ps1 -File examples/task-analysis/*.json -Json` | 4/4 通过 |
| `pwsh -NoProfile -File ./evals/run_prompt_evals.ps1 -Json` | 19/19 案例定义通过；没有模型调用 |
| `pwsh -NoProfile -File ./helpers/validate_intent_elicitation.ps1 -File examples/intent-elicit/*.json -Json` | 5/5 通过 |
| `pwsh -NoProfile -File ./helpers/validate_master_output_contract.ps1 -File examples/master-output-contract/*.json -Json` | 3/3 通过 |

标准命令 `pwsh -NoProfile -File ./run-tests.ps1 -OutputFile .local/clarify-p0-20261028/pester-results.xml` 受到 Pester TestRegistry 注册表访问和 NUnit 导出所需 CIM 访问限制，14 个容器、75 项测试受阻；脚本仍返回 0，因此该次不能记为通过。独立测试配置禁用 TestRegistry 和 XML 输出后，同一 `tests` 目录 75/75 通过、0 跳过、0 失败容器、0 失败区块；未改测试源码或断言。实际在 PowerShell 直接执行以下配置（完整含日志输出的脚本体存于 `.local/clarify-p0-20261028/pester-portable-command.ps1`，并非另行运行该文件）：

```powershell
Import-Module Pester -MinimumVersion 5.4.1
$config = New-PesterConfiguration
$config.Run.Path = (Join-Path $PWD 'tests')
$config.Run.Exit = $false
$config.Run.PassThru = $true
$config.Output.Verbosity = 'Detailed'
$config.TestRegistry.Enabled = $false
$config.TestResult.Enabled = $false
$result = Invoke-Pester -Configuration $config
```

Node 全套基线执行以下两次命令，均未产生最终汇总；第二次的单测试时限未能结束挂起的整套运行。已通过各自执行会话的 Ctrl+C 中止，两次退出码均为 1，**均未记为通过**，未终止用户其他 Node 进程。后续有界诊断见下文；不能把已打印的若干通过条目充作整套通过数。

```powershell
node --test tests/dsh_adapter.test.mjs tests/dsh_runtime.test.mjs tests/dsh_session.test.mjs tests/dsh_provider.test.mjs tests/dsh_readonly.test.mjs tests/dsh_pilot_admission.test.mjs
node --test --test-timeout=15000 tests/dsh_adapter.test.mjs tests/dsh_runtime.test.mjs tests/dsh_session.test.mjs tests/dsh_provider.test.mjs tests/dsh_readonly.test.mjs tests/dsh_pilot_admission.test.mjs
```

原始日志保存在 `.local/clarify-p0-20261028/`（Git 忽略目录），机器证据保存命令、结果和日志哈希。负例的实际检查命令为 `./helpers/validate_intent_elicitation.ps1 -File .local/clarify-p0-20261028/intent-negative-fixture.json -Json`，以及针对同一文件的 `Test-Json -SchemaFile ./schemas/intent_elicitation.v1.schema.json`；结果和构造方式已在上文说明。

新增报告和机器证据后再次执行 `pwsh -NoProfile -File ./scripts/check_encoding.ps1 -Json`：217 文件、0 问题；`git diff --check` 退出 0。`git diff --name-only` 无输出，既有跟踪文件未修改。最终 `git status --short` 仅列出以下两个新增报告文件。

后续复核：任务书仍未在 Downloads 或工作区的文件名/Markdown 正文检索中出现。对 `examples/intent-elicit/*.json`、`examples/master-output-contract/*.json`、`examples/requirement_clarity.sample.json` 分别调用 `Test-Json -Json (Get-Content -LiteralPath $file.FullName -Raw) -SchemaFile $case.Schema -ErrorAction SilentlyContinue`，对应使用三个同名 Schema，9/9 通过，命令退出 0。结果保存于 `.local/clarify-p0-20261028/strict-schema-examples.json`。这补充了旧 helper 的局部校验，仍只属于离线结构证据。

Node 有界诊断实际执行 `python .local/clarify-p0-20261028/bounded-node.py provider` 和 `python .local/clarify-p0-20261028/bounded-node.py provider_one`，分别施加外部 20 秒与 5 秒时限，使用 `--test-isolation=none` 避免测试子进程。两次均超时、所启动 Node 退出 1，均已终止并回收自己的进程；包装脚本退出 0 只表示证据记录成功。

已确认 provider 测试存在一条挂起原因：监听成功后，本机回环请求报 `connect EACCES 127.0.0.1:<port>`。`tests/provider-cases.mjs` 的准备函数尚未返回清理对象，`tests/dsh_provider.test.mjs` 也尚未进入 `try/finally`，因此监听器未关闭。单独重现 `unknown pricing prevents provider preparation` 后，一秒时仍有 `TCPServerWrap` 活跃资源，最终由外部时限终止。完整 provider 诊断观察到 2 条通过、36 条失败事件，但没有最终汇总，不能称为整套结果。诊断未修改源码，未排除其他测试的全部问题；详情、命令和进程回收证据存于 `.local/clarify-p0-20261028/node-hang-diagnostic.md` 及对应 JSON/日志，并汇入机器证据。没有模型请求。

## 本轮交付与剩余工作

- 已交付：实际仓库定位、适用规则读取、澄清相关接口审计；测试结果见上节。
- 新增文件：`docs/reports/master-clarify-p0-audit-2026-10-28.md` 和 `docs/reports/master-clarify-p0-evidence-2026-10-28.json`；既有实现文件未修改。机器证据含当前源文件哈希、原始日志哈希、命令和测试配置。
- 独立使用方式：尚无独立 Skill 成品，不能提供不存在的安装或运行命令。
- 未验证：任务书条款符合性、P1 最小契约、P2–P4 工程及独立包、P5 真实行为、P6 接入；Node 全套未完成，标准 Pester 入口在本机环境下仍受阻。
- 最小下一步：取得指定任务书的完整路径或正文，核对阶段和第 9 节后，在现有工作分支继续 P1–P4。费用条件未满足时仍可交付独立工程与待评测材料，并保持 `BEHAVIOR_NOT_VERIFIED`。
