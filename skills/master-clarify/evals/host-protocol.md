# Clarify 宿主规程（操作者专用，离线待验证）

状态：`BEHAVIOR_NOT_VERIFIED` / `INTEGRATION_NOT_STARTED`。本规程描述宿主应如何
组织候选、检查与交接；没有模型调用器，不连接 admission/eval 运输工程。
计费/运输继续暂停，E4 PARTIAL、真实准入 BLOCKED。离线检查通过不提供调用许可。

## 两组加载清单

包内路径如下；准备目录中的这些文件统一存放在 `skill/`，目录名不代表 baseline
可以加载整个目录。按 `operator-only/manifest.json` 的 `modelFilesByArm` 精确分发，
并核对 `skillFilesSha256`；新增文件不会自动进入任一组。

| 包内文件 | baseline | skill |
| --- | --- | --- |
| `contracts/contract.md` | 加载 | 加载 |
| `contracts/clarify_input.v1.schema.json` | 加载 | 加载 |
| `contracts/clarify_state.v1.schema.json` | 加载 | 加载 |
| `SKILL.md` | 不加载 | 加载 |
| `references/clarification-method.md` | 不加载 | 加载 |
| `references/compatibility.md` | 不加载 | 加载 |

两组使用相同模型配置、原始场景输入、输出契约、回应策略、检查器版本及资源上限，
各案例/组别/重复独立新会话，组别顺序预登记；不能把另一组的输出或修复答案传入。
首轮通用宿主指令相同：“根据可信 input 与 previous（若有）生成完整 clarify_state.v1
候选 JSON，不带围栏或自由摘要；不改 input、来源或控制信息；将请求保留在候选内，
由宿主校验后决定是否展示。”只有 skill 组追加上表三份 Skill 说明。

两组模型均不得读取本规程、包 README、evals 下其他文件、工具源代码、tests、
examples 或 reports；其中的答案、评审依据和响应脚本也不进入提示。SKILL 中的
这些链接仅供操作者查阅，不授予模型递归读文件权限。宿主限制可访问文件，并留存
实际加载清单和提示原文；准备器仅生成清单，不证明宿主已实现隔离。
确定性工具由操作者在完整独立包内运行，不依赖 Master Core。

## 每轮顺序

1. 固定本轮可信 input、完整上一有效 `result.json`（若有）及来源材料快照。
   本地 file 来源保留原件和解析文本，修复期间不能改动。给每次输出登记顺序，
   首次是 index 0，之后最多 index 1、2。新的 state ID 或不同错误不重置计数。
2. 宿主取得候选后先完整留存原始 bytes，不展示其中的问题、摘要或所谓“已通过”。
   每份最多 65,536 UTF-8 字节；只能预登记更低值。中文、emoji、CRLF、转义、
   空白、失败输出和停止后误收到的输出均计长、哈希并累计，不能截断或清理后再算。
3. 以同一 input/previous，对截至当前的**全部**原始候选按序运行
   `interaction_checks.py`。它内部调用 `tools/clarify.py` 的 `process`，再检查重复
   请求、暂停和修复序列；两层检查不是两个独立的语义评审。只跑单次工具不够。
4. `NEEDS_REPAIR` 时，仅把检查器产生的错误 code/path 和原候选反馈给模型，要求
   在同一输入下返回完整修复候选；禁止附加案例答案、用户回答或伪造来源。
   只有本轮尚未用满额外 2 次，且原会话四个助手轮次和其他已批准额度仍有余量，
   才可能继续。首次、种子、修复和有效追问后续轮都占原四轮额度，不赠送请求。
   本轮离线操作仅回放合成文件，不实际执行此模型步骤。
5. `REPAIR_LIMIT` / `OUTPUT_LIMIT` / `TRACE_VIOLATION`、进程退出 3 或缺失有效报告
   均停止，保存输入、每份原始输出、错误和上一结果；没有上一结果就如实记录没有。
   不生成伪造的 ready/paused，不提问。余额/轮次不足也停止且记录 incomplete。
   不截去失败前缀重跑，不把无新增信息的修复冒充新澄清轮。
6. `ACCEPTED_OFFLINE` 后，`hostDirective` 才可用于选择下一步。它只绑定本次被接受
   候选的 index、规范 result digest 和请求 IDs，不是模型调用或业务动作的授权。
   使用该候选与相同 input/previous 运行 `tools/clarify.py run`，将结果写到新目录；
   核对 result.digest 与 `hostDirective.resultDigest`、候选原始 SHA-256、inputSha256
   及 previousDigest。任何不一致均保留诊断并停止，不能用另一轮的通过报告放行。
   工具失败同样停止；不要发布仅通过某一层的临时产物。
7. 按下表展示已校验的请求或交接，再收集新的真实/脚本来源。新信息开启下一轮，
   previous 使用本轮真实规范结果，累计轮次和输出字节仍保留。禁止为凑字段或轮数
   追问；请求的语义必要性、事实忠实性仍需独立评审。

| hostDirective.action | 宿主处理 |
| --- | --- |
| `repair_candidate` | 仅指本轮可能尚有修复次数；仍须检查会话剩余限额，不能向用户展示候选请求 |
| `stop` | 保留错误停止，无可发布请求或本轮规范交接 |
| `review_required` | 重叠请求等情况先人工复核；requestIds 为空，不自动展示、不追加“修复”或伪造通过报告；无法消除疑义则 incomplete |
| `ask_user` | 仅展示 requestIds 对应的 user 请求 |
| `request_evidence` | 仅展示对应的 evidence 取证需求，不自动取证或授予外部工具权限 |
| `present_example` | 仅展示对应的 example 请求及候选表达样例，不实际构建 |
| `handoff_to_planning` | 仅在 ready_for_planning 时交接规范状态和同源摘要，允许零追问；executionAuthorized 始终 false |
| `preserve_paused` | 保存暂停状态和未决事项，不追问 |

重叠标记人工复核若确认确有独立必要性，单独留存决定、依据、获准请求 ID 与同一
result.digest，再按 computed nextStep 的类别展示；这不是检查器自动批准。
summary.md 含完整请求清单，作为审计件保留；追问时不能直接整份发送来绕过
requestIds 或人工复核。只从 digest 匹配的 result.state.requests 提取对应文本，
不再调用模型改写一份新的问题。零 user 问题不等于可交接，取证/样例/暂停各走其分支。

## 离线回放示例与证据

在包根目录回放现有 synthetic 文件（实际目录用未存在的新目录替换）：

```powershell
python -B -X utf8 evals/interaction_checks.py --input examples/clear.input.json --candidate examples/clear.state.json
python -B -X utf8 tools/clarify.py run --input examples/clear.input.json --candidate examples/clear.state.json --output .local/host-clear-new
```

首次失败时逐步追加 `--candidate initial.raw --candidate repair-1.raw`，必要时再加
`--candidate repair-2.raw`；每次保留新的报告，不能把错误文件替换成成功文件。
局部修订在两条命令都加相同 `--previous <完整上一结果>`。stdout 检查报告和
canonical result 都保留；不能仅凭退出 0 跳过 hostDirective 和 digest 核对。
检查报告只统计本轮，宿主另按会话汇总所有轮次、失败输出和资源停止原因。
字节限制不证明 Token、账单或远程取消界限。

回收仍使用 [run-record.template.json](run-record.template.json) 的 transcript、
interactionCheckArtifact、限制和失败记录；检查报告本身包含 hostDirective，
原始候选与规范结果在 transcript/产物位置关联，不另造行为通过数据。

T21/T25/T26 的种子仍按 [评测 README](README.md#多轮种子和局部更新) 暂扣后续
变更消息；种子输出也必须走上述检查，首版失败保留失败，不补造 previous。
有效问题后才按实际含义选未使用的响应脚本分支；意外问题交真人或 incomplete，
不得让被测模型充当用户。合成种子/用户脚本不能成为真实授权。
`cases.jsonl` / `freeze.json` / `plan.json` 保持原值；恢复评测前重新准备当前包快照。
