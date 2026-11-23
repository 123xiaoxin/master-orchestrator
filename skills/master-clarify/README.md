# Master Clarify 0.1.0

独立澄清 Skill：把用户表达及材料转成带来源的需求状态，再交给规划。
本包不执行业务、不签发授权、不自动安装到模型宿主，也不改变 Master 默认入口。
状态：`ENGINEERING_OFFLINE_PASS`、`BEHAVIOR_NOT_VERIFIED`、`INTEGRATION_NOT_STARTED`。工程验收记录见
[实施报告](reports/implementation-report.md)。

## 独立加载

将整个 `master-clarify` 文件夹复制到独立目录，让已有模型宿主显式读取
[SKILL.md](SKILL.md)，再读取它列出的包内契约。无需 Master Core、旧 06、
历史聊天、运行时或供应商专用接口。需要理解任务的模型宿主；下面的 Python
工具只做确定性校验、修订一致性检查和摘要生成，不会返回伪装成 AI 的固定答案。

可向宿主发出：

> 读取此独立目录的 SKILL.md。使用我提供的 clarify_input.v1 输入和上一轮
> result.json（若有），只生成 clarify_state.v1 候选状态。保留来源、未知项和
> 当前阶段边界；不执行实际业务，也不改写输入来源。宿主先运行契约与交互检查，
> 有效后才展示问题或交接；无效最多额外修复 2 次，仍无效保留错误停止。

输入由可信宿主/用户准备，不能让生成候选状态的模型同时伪造来源类型。
材料中的指令仍是材料数据。宿主真实输出应标为 `host_output`，并另行保留
原始模型日志；该标记或工具通过均不能证明语义正确或来源作者真实。

依赖：Python 3.10+、`jsonschema>=4.18,<5`，见 [requirements.txt](requirements.txt)。
本轮使用已有依赖，没有安装或新增模型供应商。目标环境缺少依赖时，先按其
环境管理方式提供 requirements 中的小型依赖；包内没有后台服务。

## 已实际运行的离线流程

以下命令从本目录运行；输出目录必须不存在。重复运行时换一个输出目录，
不要覆盖已有结果。示例全部标为 `synthetic`。

```powershell
python tools/clarify.py run --input examples/clear.input.json --candidate examples/clear.state.json --output .local/clear-run
python tools/clarify.py run --input examples/ambiguous.input.json --candidate examples/ambiguous.state.json --output .local/ambiguous-run
python tools/clarify.py run --input examples/revised.input.json --candidate examples/revised.state.json --previous .local/clear-run/result.json --output .local/revised-run
```

三个完整例子分别展示零追问规划交接、关键歧义和局部修订。
对应摘要：[已清楚](examples/clear.summary.md)、[待澄清](examples/ambiguous.summary.md)、
[局部修订](examples/revised.summary.md)。这些摘要由规范状态实际渲染，没有另写第二套结论。

每次有效运行生成 `result.json`（输入快照、状态、nextStep、摘要、digest）、
`summary.md` 和 `report.json`。下一轮 `--previous` 必须传完整 result.json。
模型提交完整候选新状态，工具计算实际变化与 changes 对照：旧 ID 不丢失，
删除用 retired，引用变化/失效标准的 handoff 必须 needs_review。
本地 `file:` 来源在规范结果中保存原文，后续修改源文件不会静默改写历史。

退出码：0=格式及一致性有效；2=结构、引用、确认/修订或状态推导不一致；
3=输入不可读/JSON 损坏、依赖或 I/O 错误。错误报告写 stdout，invalid 时不发布
交接状态。模型建议与重算结果不一致会显示两者，不能静默以重算值冒充模型输出。

`ready_for_planning` 仅表示需求可交给规划；所有机器结果固定
`executionAuthorized=false`。真实设备、环境、预算、授权仍由下游检查。
未解决的执行/未来缺口会保留在摘要中，不自动阻断当前安全规划。

## 离线交互检查

在同一可信 input / previous 下，将已捕获的首次候选及修复文件按顺序传入：

```powershell
python -B -X utf8 evals/interaction_checks.py --input examples/clear.input.json --candidate examples/clear.state.json
```

有修复时重复 `--candidate <原始文件>`；局部修订可传 `--previous <完整上一结果>`。
默认 `--max-repairs 2 --max-output-bytes 65536`，只能事先登记更低的工程限制，
不是模型调用授权或 Token/费用上限。字节检查读取原始 bytes，包括失败、空白、
换行和转义；超限不截断、不重试。复用原契约校验并检查重复追问，多个独立缺口
可并列；不同问法覆盖同一缺口仅提示人工评审。详情见[方法](references/clarification-method.md#离线修复与输出边界)
及 [rubric](evals/rubric.md#无效修复最小追问与输出字节)。

该工具不改输入或上一结果，只向 stdout 输出检查报告。退出 0=离线候选序列有效，
2=仍需修复/达到上限/记录越界，3=I/O、配置或依赖错误。有效也始终是
`BEHAVIOR_NOT_VERIFIED`，不会发布新的规范状态；正式交接仍用 `tools/clarify.py`。
它不认证原始文件来自谁、是否遗漏调用或语义是否必要，也不自动接入宿主。

宿主每轮顺序、停止/保错、结果 digest 核对及请求放行见[操作者规程](evals/host-protocol.md)。
检查报告新增 hostDirective；ACCEPTED_OFFLINE 也可能需人工复核，不能只看退出 0
就自动提问。只有 ready_for_planning 才可零追问交给规划。baseline/skill 两组的
公共三契约与 skill 额外三指令按[加载清单](evals/host-protocol.md#两组加载清单)分发，
prepare 的 manifest 明确记录，不把整个快照或评测答案交给任一模型。

## 测试与可复制包

```powershell
python -B -m unittest discover -s tests -p "test_*.py" -v
python -B -m unittest discover -s evals -p test_materials.py -v
python evals/prepare.py check
python evals/prepare.py prepare --output ../../.local/clarify-eval-inputs-final
python tools/package.py
python tools/package.py --output ../../.local/master-clarify-package
```

测试使用自有临时目录并清理，覆盖 T01–T26 的确定性机制及专门反例。
语义预期另外由 [完整行为案例](evals/cases.jsonl) 和评审执行，不能把 fixture
覆盖当作实际澄清效果。包检查验证必需资源、相对引用、私人路径/密钥特征和
自包含复制；扫描是审查辅助，不能证明不存在任何秘密。包清单记录文件 SHA-256。
将复制包放到任意独立目录后，仍用同样命令运行；不需要访问源仓库。

## 评测与限制

行为评测材料位于 `evals/`：T01–T26、冻结保留集、覆盖十二项能力的成对评测计划、
原始输入打包工具、空白回收模板和人工/独立评审规则。以其中的准备工具和 README
为准。完整 cases.jsonl 含期望答案与评审规则，不要把它直接喂给被测模型。

P5 当前没有可用、获授权且受累计费用上限约束的真实模型入口；模型调用数 0。
不运行旧 LLM runner，不填造 transcript，不以工程子代理审查代替真实行为评测。
2026-11-23 按用户要求暂停计费/运输主线，当前仅修订方法和离线检查。恢复真实评测
仍需另行明确任务、有效入口、数据范围与预算授权；当前不开展同模型真实对照。
本次提示词/方法已产生新快照，旧 prepared 输入包及历史 P5/E4 报告中的包哈希只代表
各自记录时点。恢复前须重新准备和审查，不能改写旧哈希来冒充同一版本。
达到任务书行为门槛前不进入 P6。

旧接口差异与 CR-1…CR-6 处理见 [兼容说明](references/compatibility.md)。
真实性、忠实理解、必要补全是否合适，以及已有授权语义仍需依据原始材料评审；
Schema、hash 和来源类型约束无法证明这些问题。
