# 行为评测材料与离线准备

状态：**BEHAVIOR_NOT_VERIFIED**。没有真实模型调用或已通过行为案例。这里只准备、检查输入，不提供付费接口或可绕过授权的执行器。

2026-11-23：计费/运输主线按用户要求暂停。以下真实宿主流程保留为未来协议，
本轮只运行合成候选的离线检查；不打开真实入口或 P6。方法修订后旧 prepared
快照不能代表当前包，重新准备不会改变未授权状态或冻结案例。

从能力包根目录运行：

```powershell
python evals/prepare.py check
python evals/prepare.py prepare --output ../clarify-eval-packets
python -B -m unittest discover -s evals -p test_materials.py -v
python -B -X utf8 evals/interaction_checks.py --input examples/clear.input.json --candidate examples/clear.state.json
python -B -X utf8 -m unittest discover -s tests -p test_interaction_checks.py -v
```

输出目录必须尚不存在且位于能力包之外，防止覆盖旧证据。需要换一次评测时使用新目录。Python 3.10+ 标准库即可完成材料检查与准备；候选输出的确定性检查使用能力包已声明的 jsonschema 依赖及 `tools/clarify.py`。退出 0 表示准备/完整性检查成功，2 表示材料或冻结约束错误，3 表示文件读取/写入失败。准备器不认证任何真实对话，也不会自动把状态改为已验证。

`interaction_checks.py` 对同一 input/previous 的原始候选文件回放；重复传
`--candidate` 保留首次和修复顺序。默认最多 2 次额外修复、每份 65,536 字节，
可用 `--max-repairs` / `--max-output-bytes` 指定预登记的更低值，不允许扩大上限；两臂一致且服从更低的
总资源限制。失败与成功都计字节；不得改换 ID、删失败记录或改输入来清零同轮计数。
stdout 报告另存到新的日志文件，并将路径填入 `interactionCheckArtifact`。
退出 2 也包括 NEEDS_REPAIR、上限耗尽及 TRACE_VIOLATION，不自动重试或改写规范状态。
该检查器未连接运输/模型，不能证明语义最少问题或活动级费用。口径见 [rubric](rubric.md)。
hostDirective 给出修复/停止/人工复核/有效下一步及规范结果 digest；不是额外授权。
完整操作顺序与每臂精确文件加载表见[操作者宿主规程](host-protocol.md)，其副本仅放
operator-only，并由 manifest 记录哈希；模型只能收到 modelFilesByArm 白名单中的文件。

## 冻结与覆盖

[cases.jsonl](cases.jsonl) 包含 T01–T26 的 synthetic 输入、上下文、材料、CL 能力关联、具体期望、禁行行为、分支响应与评审依据。[freeze.json](freeze.json) 冻结全部定义及四个保留案例 T05/T14/T22/T25；保留纪律见 [rubric.md](rubric.md)。

[plan.json](plan.json) 选择 14 个初轮案例，覆盖 CL-01…CL-12 和软件/流程、内容/文档、设备只读三领域。T12/T22/T25 两组各重复一次，共需至少 34 个独立会话；每次追问、种子轮和重复都消耗请求预算，34 不是批准的请求数或费用上限。额度不足时只完成允许的部分并报告缺项。准备计划的 approved=false，额度均未知，不能凭计划自行调用。

## 输入分发和真实宿主执行

1. 由可信操作者核验当前已有宿主、模型、累计调用/Token/费用/时间上限及数据范围；未满足时保留材料即可。记录模型配置、Skill 快照与输入哈希，不新增供应商或服务。每对随机确定组别顺序并在运行前登记。
2. 为每个案例、组别和重复建立新会话。两组都读取 `contracts/contract.md` 与两个 v1 Schema；skill 组另外读取 `SKILL.md`、`references/clarification-method.md` 和 `references/compatibility.md`，baseline 不收到这三份。按 manifest.modelFilesByArm 从准备目录 `skill/` 精确分发，不能加载整个目录。相同通用候选指令与检查流程见宿主规程；不带入当前主聊天、其他案例或另一组历史。确定性工具仍用完整独立包，不需要 Master Core。
3. `inputs/Txx.json` 仅含原始场景包和契约输入，不含标题、能力 ID、期望、禁行行为或回应脚本。将其中 `input` 原样作为首轮可信 envelope，供模型读取并产生 candidate state。`excludedBackground` 是明确不适用于本项目的背景，可以展示其项目标签用于隔离能力评审，但绝不能合并到本项目 sources。`scenarioSeedContext` 的处理见下一节。
4. `operator-only/` 仅给主持人/评审者：响应分支、空模板、计划和清单不提供给被测模型。完整 cases.jsonl 的期望也不得加入模型提示。模型不得改写 input.sources；候选必须与原始宿主输入一起校验。
5. 每轮先完整留存候选原始 bytes，再运行 `interaction_checks.py`（内部调用 `tools/clarify.py` 并增加交互检查）。同一 input/previous 下无效最多额外修复 2 次；失败也计字节，每份不超过 65,536 字节。达到修复/输出上限、越界或工具错误则停止保错，不能提问。首次、种子、修复和后续澄清共用每会话四个助手轮次，剩余额度更低时提前停止；不能重新开轮抹掉消耗。
6. 只有两层检查通过，才用同一候选运行 `tools/clarify.py run` 生成规范结果，核对 hostDirective.resultDigest 后按获准请求 ID 展示；review_required 先人工复核。ready_for_planning 可零追问交接，其余状态按规程分流。有效问题后才按含义选择未用过且适用的脚本分支，禁止关键词猜答案；超出脚本交真人或 incomplete，不让模型自问自答。留存原始日志及 script/human 来源。准备输入为 synthetic，真实收集时另存 host_output envelope 与原始日志映射，并在本轮检查前固定，不事后换标签；标签不证明真实性，脚本用户不构成真人授权。
7. 每个会话复制并填写 [run-record.template.json](run-record.template.json)，逐例评审后填 [comparison.template.json](comparison.template.json)。模型自评不替代独立复核。准备器不自动计算行为通过，更不启用 P6。

## 多轮种子和局部更新

T21/T25/T26 的 previous_state_summary 是预设场景材料，**不是历史模型输出，也不是可伪造的 `--previous` 结果**。评测时先在对应新会话提供该种子材料，使用相同的预设种子指令：“请将提供的既有需求摘要整理为首版候选状态，保留已有事项标识；没有来源的确认状态保持未知。暂不处理后续变更。”暂扣案例的当前变更消息，记录真实首版输出并校验。若无法形成合法首版，记录基线/模块首版失败，不补造结果。

随后加入本案例当前用户消息，保留源材料且增添新消息 ID；使用实际上一轮 `result.json` 作为 `--previous`，由宿主将 input.previousStateId 设为其 stateId。保留同一会话只限此案例同一组内的续轮，两组彼此隔离。对 T21/T25/T26 必须评审真正的前后状态、稳定 ID、旧项失效和未变化边界，不凭一份自称有历史的结果通过。初版所需额外请求计入累计授权上限。

## 本轮评测报告模板

下列是未完成记录框架，不能当成结果：

- 宿主/模型/配置/版本：未运行，NOT VERIFIED。
- 已批准预算及可信来源：未取得；不得填计划建议为批准值。
- 真实案例/成对会话/重复数：0 / 0 / 0。
- transcript、候选、摘要、检查报告及原始日志：尚无。
- 目标忠实、必要补全、范围控制、证据诚实、交互成本、交接质量：未评审。
- 相对基线提升：NOT EVALUATED；无证据不得声称改善。
- 未完成原因：现有入口缺少本次可复用授权与费用上限，部分真实网络入口仍关闭；具体环境状态以实施报告实际核查为准。
- 结论：BEHAVIOR_NOT_VERIFIED；INTEGRATION_NOT_STARTED。

在实际评测结束后用真实证据替换相应空项，保留失败与未完成项及理由。未满足 [rubric.md](rubric.md) 的全部门槛前不得声明独立行为验收通过。
