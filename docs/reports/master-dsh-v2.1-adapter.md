# Master → DSH v2.1 Contract Adapter 离线验收

日期：2026-10-10（Asia/Shanghai）。**实现并通过离线 Adapter 验收。**
真实本机原生 Validator 对正常候选返回 `PASS (L1 + L2)`；缺项、冲突与原生拒绝均不会输出候选。此结论不包含完整 DSH 会话、真实 Agent 行为、执行授权发放或目标完成。

## 1. 工作区与真实来源

起始分支 `codex/master-integration`，HEAD 为指定的 `6681ce92879e1c5ca4d003e447457d636ac25209`，工作区 clean。保留原历史和安装，不切分支，不 push/merge/release，不安装依赖，不调用模型、不启动 SkillOpt。

读取仓库实际 v1 Schema、统一 SKILL、01/05/07/08、原验证器和示例。Master 输出为 `master_output_contract.v1`，同范围明确授权持续有效，清晰度不能提供权限；Phase -1..5 不变。

读取本机 `C:/Users/tongk/.dsh/skills/master-orchestrator/framework/` 的六份实际文件：

| 来源 | 标识 / 用途 |
|---|---|
| master_execution_contract.v2.1.schema.json | 真正的目标 Schema，22 个必需字段，additionalProperties=false |
| validate-contract.mjs | checkContract 执行 L1；只有 L1 无错误才执行 L2 治理一致性 |
| schema-validate.mjs | 原生结构解释器，支持当前 Schema 使用的字段约束 |
| MASTER-EXECUTION-FRAMEWORK.md | Framework 1.8；正文另有 v2/v2.1 名称不一致，本 Adapter 按实际 Schema/Validator v2.1 |
| SEMANTIC-DEFINITIONS.md | 语义层 0.2；Observed 与 Inference 分开 |
| example-contract.v2.1.json | 原生示例，不能当作本轮用户授权来源 |

全部路径、版本与 SHA-256 记录于 `adapters/dsh-v2.1/native-source-lock.json`。三个目标 Schema/Validator 文件原字节保存到同目录 `native/`，用于可移植离线回归；没有修改其定义。真实安装与快照的三份哈希相同，六份安装文件复核均未变。Master Schema 的哈希也被锁定，变更后不能静默继续适配。

## 2. 完整字段映射

| DSH v2.1 必需字段 | Master / 额外证据来源与规则 |
|---|---|
| schemaVersion | 明确目标常量 master_execution_contract.v2.1，原 version 留在 audit |
| decision | 原值；require_more_information 仅映射为非执行 clarify，依据 Core 的澄清语义 |
| phase | 原 phase 字符串逐字保留，不转入下一宏阶段 |
| goal | realGoal 逐字保留，外部 confirmation.goal 必须相等 |
| goalStatus | 外部 goalConfirmation.status；confirmed 需要宿主准入的 user 来源，execute 不接受 working |
| nonGoals | 原 nonGoals 完整保留 |
| constraints | 每项 allowedActions、forbiddenActions、riskBoundaries 分别加明确 Allowed action/Forbidden action/Risk boundary 前缀；不丢弃禁止条款或条件文本 |
| taskScope | 原 allowedActions 完整、有序复制；不另扩任务范围 |
| userDecisions | 外部来源中的原生 question/whyUser/impactIfUnknown 数组 |
| agentDecisions | 外部来源中的原生 decision/rationale 数组 |
| verificationRequired | 外部 item/howToVerify 数组；行动型契约每个 validationPlan 项都要有匹配且非空的方法 |
| risks | 原 riskBoundaries 全部保留；行动型契约不接受空风险边界 |
| assumptions | 外部原生数组；confirmed=true 的条目必须另有准入 user 来源的明确文本匹配 |
| minimumTaskModel | 外部结构化 type/description；不从文字雏形推造模型 |
| minimumPrototype | 外部结构化 type/description；原 v1 非 null 字符串须逐字等于 description；原 null 不代表已存在原型 |
| definitions | 外部 correct/usable/done；execute 要求三者非空，done/correct 一致性仍由真实 L2 检查 |
| validationCriteria | 原 validationPlan 全部复制，保持次序与重复项；真实字段不是 verificationCriteria |
| executionClarity | score/rationale 原样保留；原生低分 WARNING 不变成 ERROR |
| blockReason | 外部明确 string/null，原生检查 block 时非空及风险要求 |
| degradePlan | 外部明确 goal/loss/rationale 或 null；改变退化目标须 user 来源准入 |
| shouldCreateAgent | 原布尔值；行动型契约的授权记录必须逐字匹配 |
| nextAction | 原 nextAction 逐字保留，不触发任何执行 |

可选 intentEvidence 不自动生成：v1 没有该字段，Adapter 不拼接另一份意图协议。完整 v1、证据包及解析后的来源字段保存在结果的独立 `audit` 中；不塞入禁止多余字段的目标契约。

## 3. 外部证据规范与信任边界

输入 `master_dsh_evidence.v1` 由四项组成：version、masterSha256、sources、fieldRefs。Schema 位于 `adapters/dsh-v2.1/evidence.schema.json`；接口详细规范在同目录 README。

- masterSha256 是递归排序对象键、保留数组顺序的紧凑 UTF-8 JSON SHA-256，绑定当前完整 Master 契约。
- sources 为 `{id,path,sha256,kind}`。文件必须为 evidenceRoot 内的 JSON，原字节哈希匹配；越界、绝对路径、symlink 逃逸、来源重复或篡改拒绝。
- fieldRefs 为 `{field,sourceId,pointer}`；JSON Pointer 查找 own property，重复字段拒绝。十二项值都必须明确给出，包括真实空数组/null，而不是 Adapter 填默认值。
- 十二项为 goalConfirmation、authorization、userDecisions、agentDecisions、assumptions、assumptionConfirmations、minimumTaskModel、minimumPrototype、definitions、verificationRequired、blockReason、degradePlan。
- `authorization` 同时绑定 contractSha256，并要求 allowedActions/forbiddenActions/riskBoundaries 及 shouldCreateAgent 与 Master 完全一致。

**user 标签和文件哈希不能自证用户身份或同意。** 宿主通过 API 的 trustedUserSources 或 CLI 的 --trusted-user-source，独立准入真实用户来源；证据体不能自我提升权限。宿主负责确认来源真实、条件授权尚有效、未撤销且语义范围一致；不得把模型自写确认文件准入为用户记录。

正常 fixture 仅对应这轮用户明确要求的离线 Adapter 任务：目标逐字来自“本轮唯一目标”，5 项允许动作、10 项禁止事项和8项验收标准来自原任务。user-authority.json 保存原附件路径/原字节 SHA-256、目标与授权/禁止原文摘录，宿主以该任务记录进行显式准入；验收脚本对真实附件哈希与全部摘录再次核对。该结构化投影不是用户新增回复。

agent-record.json 中任务模型、契约草图、实现判断与验收方法明确标为 agent-authored，是计划和类型说明，不伪装用户已确认细节或已观察到执行。其 prototype 是保存到记录内的真实契约流程草图。负例通过隔离目录修改 fixture，是合成缺项/冲突记录，不是新的真实用户决定。

权限冲突检查是确定性的：同一文字动作及明确 Do not/Must not/禁止/不得 前缀不可同时允许和禁止；授权列表与委派标志不得扩大或改变。Adapter 不推断同义词、路径作用域、例外或任意自然语言矛盾；有歧义的权限须由可信宿主先审核/规范化，不能把这里的机械检查当完整权限策略引擎。

## 4. 实现与结果

实现：`adapters/dsh-v2.1/adapter.mjs`，只使用已有 Node 内置模块和哈希锁定的原生校验器。没有额外依赖，没有装入现有 Master Skill 或 DSH profile。

顺序：输入版本/结构 → 来源哈希及契约绑定 → 用户来源准入 → 目标/权限/风险/模型/验证证据检查 → 映射 → 原生 L1 → 原生 L2 → 结果。原生的结构和治理结果分别记录；L1 错误不声明 L2 通过。两个输入均不修改。

| 结果 | 条件及输出 |
|---|---|
| READY | 证据完整、绑定及边界检查通过、原生 L1/L2 通过；仅生成候选。clarify READY 是澄清契约，并不是可执行契约 |
| BLOCKED | 缺确认/授权/来源/任务模型/原型/风险/验收条件/依赖，未获宿主准入，或未审查的原生/source Schema 版本变更 |
| INVALID | 原契约版本/结构错误、格式错误、目标/原型/权限冲突、来源篡改或逃逸、重复引用，以及原生 L1/L2 拒绝 |

拒绝时 candidate=null，没有候选文件。诊断区分 unsupported_contract_version、master_schema_error、goal_conflict、permission_conflict、permission_scope_conflict、missing_user_confirmation、missing_authorization、missing_verification、missing_task_model、native_schema_rejection、native_governance_rejection 等，不把缺项改成 execute。

READY 也始终返回 executionAuthorized=false、executionPerformed=false、goalCompleted=false：指 Adapter 本身没有发放权限、执行任务或接受目标，不否认独立来源中已存在的授权。CLI 新输出目录只允许位于仓库 `.local`，不覆盖已有结果；退出码 READY=0、INVALID=1、BLOCKED=2。

本轮代码审查发现原生解释器用 `key in properties` 判断多余字段，可能漏过 Object.prototype 名字。只在 Adapter 加了 Schema 驱动的 own-key 防护，拒绝 toString/constructor 等额外字段；原生文件保持原字节。该补充结果单列 mappedOwnKeys，不伪称原生 Validator 自己捕获了问题。

## 5. 实际命令与验收

```powershell
node --test tests/dsh_adapter.test.mjs
pwsh -NoProfile -File local-ci.ps1 -AgencyRoot .ci-stubs/agency-agents -OutputReport
python -X utf8 ../validate_all_schemas.py
pwsh -NoProfile -File helpers/validate_master_output_contract.ps1 -File tests/fixtures/dsh-adapter/master.v1.json -Json
```

真实安装运行：临时设 MASTER_DSH_FRAMEWORK 为 `C:/Users/tongk/.dsh/skills/master-orchestrator/framework`，执行 `node --test --test-reporter=tap tests/dsh_adapter.test.mjs`，随后恢复进程环境。全部 **37/37** 通过，无 skip。相同 37 项也在 CI 中对未修改原字节快照执行。

正常 CLI 实际执行：

```powershell
node adapters/dsh-v2.1/adapter.mjs --master tests/fixtures/dsh-adapter/master.v1.json --evidence tests/fixtures/dsh-adapter/evidence.json --evidence-root tests/fixtures/dsh-adapter --trusted-user-source tests/fixtures/dsh-adapter/user-authority.json --framework-dir C:/Users/tongk/.dsh/skills/master-orchestrator/framework --output .local/dsh-adapter/acceptance
node C:/Users/tongk/.dsh/skills/master-orchestrator/framework/validate-contract.mjs .local/dsh-adapter/acceptance/candidate.v2.1.json
```

实际原生 CLI 返回 **PASS (L1 + L2)**；Adapter 内部调用的也是真实安装导出的 checkContract，目标候选无错误、无 WARNING。独立使用本机已安装 jsonschema 4.26.0 的 Draft202012Validator，完整验证 Master fixture、evidence envelope、原生候选的三个 Schema/实例，全部通过，没有安装依赖。

| 回归 | 结果 / 与前轮比较 |
|---|---|
| Local CI | **15/15**，前轮14/14；新增 dsh-contract-adapter 一项 |
| Pester | **75/75**，与前轮一致，未删除或放宽断言 |
| Python Skill 整合 | **10/10**，与前轮一致；包内引用及导出回归保留 |
| 原有 Schema/示例 | **12 Schema / 38 示例**，与前轮一致，原 Schema 不变 |
| Adapter 正反例 | **37/37**，覆盖用户要求的八类、来源/绑定/越界、原生 L1/L2 拒绝及 CLI 隔离/拒绝覆盖 |
| 编码/Prompt/Git | CI 编码、19 个离线定义、diff --check 均通过 |

负例包括：缺确认、working 不能 execute、证据体自称 user 不获准入、目标不一致、缺授权、文字雏形不能替任务模型、权限矛盾/扩张、委派标志冲突、空风险/缺完成定义/缺验证方法、require_more_information 只到 clarify、未知版本/非法枚举/错误嵌套类型、原生 L1 缺字段拒绝、L2 definitions 冲突/高影响用户决策未解拒绝、假设确认无用户证据、prototype 冲突、过期绑定/篡改/逃逸/重复引用、原输入不变、低分 WARNING 不升级、原生源码漂移/缺失，以及 CLI 错误返回和输出不覆盖。

测试首轮32项通过；代码审查增加前缀冲突、缺依赖、CLI 格式错误、own-key 防护后最终37项通过。没有失败的测试断言，也未进入反复核心规则修复。记录到一次测试报告命令失败：Node 不提供内置 json reporter，`--test-reporter=json` 返回 ERR_MODULE_NOT_FOUND；改用内置 tap 后正常通过，失败输出记录保留，不安装 reporter 依赖。

本轮机器证据保存为 `docs/reports/master-dsh-v2.1-adapter-evidence.json`；完整 Native TAP、正常候选、原文对照及结果在 `.local/dsh-adapter/`。GitHub Actions 只增加 Node22 配置，未推送、未宣称云端运行通过。

## 6. 修改清单、Git 与后续边界

实现与配套文件：

- adapters/dsh-v2.1/：adapter.mjs、evidence.schema.json、native-source-lock.json、README.md，以及 native/ 三份原字节文件。
- tests/dsh_adapter.test.mjs 与 tests/fixtures/dsh-adapter/ 四份来源明确的 fixture。
- local-ci.ps1、scripts/check_encoding.ps1、.github/workflows/ci.yml、docs/ci-cd.md：接入离线检查及 Node/编码说明。
- 本报告与机器证据文件。

原 prompts、统一 SKILL、既有 schemas 和执行工具均未修改。实际安装六份来源哈希不变，不改 profile，不覆盖安装，不触发真实 Agent。

独立 Adapter 实现提交：`07fdcf346f0616d9c6c04fac904a0992b1ce2132`，消息 `feat: add evidence-bound Master to DSH contract adapter`；经过全部回归及 Diff 审查后创建。最终报告提交 SHA 单独在交付时报告；自身 SHA 不写入自身，完整提交关联另存 `.local/dsh-adapter/git-provenance.json`。

**已满足本轮八条离线验收标准**：合法 Master v1、明确来源及准入、原字段保留、真实额外模型/验证计划、原生候选通过、缺项/冲突阻断、测试可重跑、安装未变。READY 正常案例不是只有安全阻断的半成品；其权限仅来自本次已授权的离线工程任务。

仍未完成：任意业务任务的用户来源接入与语义权限审核；完整 DSH 生命周期/原型验证历史；真实模型意图与纠偏行为；trace 并行关联、验证误分类、执行历史与最终目标验收。Adapter 不重新设计上述 Runtime，也不把单次 native 合法性当成会话执行成功。第二轮 SkillOpt 与费用授权仍未开始。
