# Master Runtime 整合验收与 SkillOpt 训练前检查

日期：2026-10-10，Asia/Shanghai。结论：**仓库整合已提交；DSH 加载组件通过，协议尚不兼容；第二轮 SkillOpt 暂不具备启动条件。**

## 1. 版本、审查及授权范围

- 分支：`codex/master-integration`。
- 原始 main：`a6c2d0c48fb22f1bf8e9522c3e27270049c95267`。
- 已验收的整合提交：`032aa7fa123e5ae50262033cbad7af173e45e14e`，消息为 `refactor: consolidate master skill integration and contracts`。
- 后续评测与隔离检查实现提交：`4674ee17786a6747ad0dfbcb9a6f4c02df2af1e6`。
- 最终候选的完整 SHA 以最终清洁工作区生成的 `source-lock.json.sourceCommit` 为准；报告自身的提交不写入自身，避免循环引用。
- GitHub 公共 API 再查四个分支 SHA 与上轮一致，Tag/Release 为 0；不是成功执行 git fetch。原始恢复历史 `git fsck --full` 通过。
- 本轮明确授权本地提交；使用 `Codex <codex@localhost>` 标识实际工程代理提交者，不代填用户身份。没有 push、merge、Tag、Release、训练或模型费用调用。

复核上一轮全部 39 个变更文件及已记录的来源：统一入口、八模块修订、四个复用验证器、CI、测试及文档。未发现文件删除、无关功能扩张、Schema wire identity 改动或需要撤回的授权规则。减少的是重复 Skill 正文；有效原则已迁到 01 并由入口引用。保留历史审计报告，其“未提交”描述属于上一轮时点，不代表当前状态。

提交前保存文件 SHA-256 清单和二进制 Diff 到 `.local/runtime-review/`。再次通过 CI 14/14、Pester 62/62、12 Schema/38 示例后才提交。没有提交原始压缩包、其他工作副本、全局配置或凭据。凭据形状模式扫描未发现匹配，仅是模式检查，不是穷尽证明。

## 2. 已发现及修复的问题

1. 评测空输出可能触发必填字符串绑定异常。允许空字符串进入检查并明确返回 `empty_output`。
2. 旧 JSON 检查仅解析语法。现在所有输出都由 PowerShell `Test-Json -SchemaFile schemas/master_output_contract.v1.schema.json` 检查完整结构，包含嵌套类型、必需字段与禁止多余字段。
3. 旧评测用词命中代替字段判断。新增解析后字段 `equals` / `in` / `nonEmpty` 检查，旧 19 案例的字符串断言保留为历史诊断；未补充结构行为检查的历史案例不能证明治理行为正确。
4. 旧错误消息直接暴露期望文本。改为通用失败码，不输出期待值、路径或候选答案；没有把每例评测反馈发送给优化器。完整模型输出仍是评审日志，不能传给留出集之外的候选生成过程。
5. 旧评测不记录 finish reason。现在区分 `truncation`、`empty_output`、`json_error`、`schema_error`、`behavior_error`，保存 finish reason、可用性及 token usage。提供方不返回这些字段时记为未知，不能认定未截断。
6. 秒级结果目录可能冲突。增加随机 run ID 后缀。
7. 来源清单把 main 基线当作唯一基线。现区分 `upstreamBaselineSha` 与 `acceptedIntegrationSha`；构建仍捕获实际 HEAD、dirty 和文件/生成器/产物哈希。

规则评测没有独立语义 Judge：字段一致不证明理解正确、两轮历史真实或目标达成。`semanticBehaviorVerified` 固定为 false，结构/规则结果与语义结论分开。未实现 SkillOpt 优化器反馈通道，因此不能声称历史第一轮实验泄漏已被实证修复；本轮 runner 的精确答案反馈路径已移除。

一次测试失败是 Pester Mock 在 runner 的作用域中读不到测试脚本变量，输出了 `null`；改为完整独立契约 fixture，保留结构断言，随后通过。另有文件读取默认 Windows 编码导致文档更新脚本停止，改为显式 UTF-8；未改核心规则。换行统一为 LF，消除 `git diff --check` 的 CRLF 提示。打包整合测试曾拒绝 docs 到未随包分发的 evals 配置链接；将其改成明确的仓库文件说明后通过，未削弱包内引用检查。

## 3. DSH v2.1 真实来源及映射

读取本机实际安装文件，未修改：

- `C:/Users/tongk/.dsh/skills/master-orchestrator/framework/master_execution_contract.v2.1.schema.json`
- 同目录 `validate-contract.mjs`、`schema-validate.mjs`、`MASTER-EXECUTION-FRAMEWORK.md`、`SEMANTIC-DEFINITIONS.md`、真实 v2.1 示例。
- `C:/Users/tongk/.dsh/.agent-presets/master-orchestrator/agent.cordis.yml`、`preset.yml`、`runtime-trace-plugin.mjs`、`trace-ledger.mjs`。
- 安装程序 `resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-skill-filesystem/lib/index.js` 的实际加载实现。

这些外部文件按原字节快照到 `.local/dsh-contract-verification/`，保存 SHA-256，不导入仓库成为第二份规范核心。框架正文有 v2/v2.1 名称不一致；实际 Schema/默认验证器使用 v2.1。其 `additionalProperties:false`，22 个必需字段，`intentEvidence` 可选。契约检查包括结构层与内部治理层，明确不负责现实执行正确性。

| 仓库能力/字段 | DSH 真实字段/接口 | 转换及差异 |
|---|---|---|
| v1 version / decision / phase | schemaVersion / decision / phase | version 常量不同；require_more_information 不是 v2.1 decision，需要显式澄清映射 |
| realGoal / nonGoals | goal / nonGoals / goalStatus | 目标文字可对应；v1 没有 goalStatus，不能从 execute 或高分补造 confirmed |
| executionContract.allowedActions | taskScope、constraints | 动作许可不等于完整任务范围；原字段须独立保留，不能丢弃 |
| forbiddenActions / riskBoundaries | constraints / risks | 是相关概念但不是无损等价；禁止动作必须显式带入经确认的约束 |
| clarity.score/rationale | executionClarity.score/rationale | 同形；都不能当用户授权或客观概率 |
| minimumPrototype 字符串/null | minimumTaskModel、minimumPrototype 对象/null | v1 无任务模型、无原型类型；DSH execute 要求两者非 null，不能凭空生成 |
| validationPlan | verificationRequired、validationCriteria、definitions | DSH 还需要如何验证及 correct/usable/done；必须由真实契约证据提供 |
| v1 未有的明确决策所有权 | userDecisions、agentDecisions、assumptions[].confirmed | 必须声明问题/依据/影响/可逆性/验证，不能静默补默认确认 |
| degrade / block | degradePlan、blockReason | DSH 有专门必需字段；v1 nextAction 不能替代完整降级损失与阻断条件 |
| shouldCreateAgent / nextAction | 同名字段；subagent/workflow/subagent_fork | 字段可对应；工具和委派规则是 DSH 自有实现，不用 OpenClaw helper 代调 |
| Phase 3 同范围既有明确授权 | framework 的确认断点 | 安装变体更强制澄清→原型→验证→执行；与 clear/direct execute 路径有差异，尚未裁定统一权威 |
| state_machine.v1 Phase 4 状态 | trace events 与 result.status | pending/in_progress/blocked/repaired/verified/completed 非 DSH 终态枚举；需要显式关联记录，不可只按 succeeded 认定完成 |
| intent_elicitation.v1 / 意图变化 | intentEvidence、clarification.v1、contract_update_request.v1.1 | 独立取证 vs 内联证据有差异；回流记录保留用户新信息与契约裁定，未自动实现关联 |
| verify_repair_loop.v1 最多两轮 | 外部治理规则及单元协议 | v2.1 没有 repairCount 字段；硬上限须由 sidecar/真实历史检查执行，尚无 repo→DSH runtime enforcement |
| observed→audited→declared / final_report | session/event、runtime_trace、trace_bundle、acceptance | 事实取证与目标验收必须分别核对；不能把模型手工 event 当 observed |

**没有实现自动 v1→v2.1 Adapter**：不能在现有输入缺少确认、任务模型、定义、风险证据时进行安全无损转换。隔离包是仓库统一 Skill 的加载候选，不是原 DSH Framework 的替换产品；不得宣称外部契约兼容通过。后续 Adapter 必须额外消费真实确认/任务模型/验证依据，保留 v1 原字段，缺项返回阻断，不自动执行工具；这仍是未实现要求。

## 4. DSH 验证及 trace 限制

`scripts/verify_dsh_candidate.py` 的 5 项离线检查全部通过：原生 v2.1 示例通过；仓库 v1 被原生 v2.1 验证器拒绝；execute 的未确认目标、缺少原型分别被拒绝；trace 插件可导入并对 Mock 事件返回预期结果。最后一项有 7 条断言，属于 Mock，不是 DSH 对话。

实际 trace 插件代码存在下列验收局限，本轮不修改安装文件：

- 自动 bundle 的 `contractEnvelope.goal` 为空、successCriteria 为空、acceptance 为 null。turn completed 只表示轮次结束，不表示 Master 目标已验收。
- shell 命令包含 test/check/validate 就分类为 validation_completed；`isError=false` 写 passed，未独立检查命令输出或业务目标。
- tool/result 关联最后一次 call，没有稳定 call ID；并行结果可能错配。
- 自动写盘 fire-and-forget，失败只记错误；文件存在/内容完整必须另行核对。

因此只能说外部接口存在且离线函数可调用；权限 enforcement、并行证据关联、断点恢复、预算停止与目标验收仍需真实会话测试。

## 5. 隔离加载

没有覆盖 `~/.dsh/skills`、`~/.dsh/.agent-presets` 或任一现有 profile。DSH_HOME 临时指向仓库 `.local`，`headless --dump-default-config` 返回 0，随后恢复进程环境；没有启动模型调用。该命令只检查默认配置，并不证明 Master preset 被挂载。

`scripts/test_dsh_loader.cjs` 使用 DSH 自带 Electron Node 主机及实际 FileSystemSkillProvider，设置 `includeDefaultRoots:false`、明确 customSkillDirs、`watch:false`。实际发现一个 `master-skill`，加载其 SKILL 正文及 resourceBase，探针再按 manifest 读取 01/05/07/08/06，全部哈希可核对，没有 YAML 警告。它是实际加载组件 + 隔离宿主 Mock，不是完整 Cordis agent 会话，也不是模型主动读取模块的行为证据。

初次探针包标为开发快照；最终交付重新从清洁提交构建 `.local/runtime-verification/skills/master-skill/`，导出 `.local/runtime-verification/skillopt-baseline/`，再次对最终包运行加载探针。报告机器证据见 `runtime-verification-evidence.json`；完整锁、外部快照及探针日志在 `.local`，不入 Git。

## 6. 十二个行为案例与证据层

新增案例不替换历史 19 案例。train/validation/test 各 4，输入 SHA-256 唯一，12 个 ID 唯一，集合不相交；四项 Pester 检查证明定义/拆分及结构断言完整。下表**均为案例准备及静态检查通过，模型/真实 DSH 行为未运行**，不是 12/12 行为通过。

| 能力 | 案例 | split | 仍需验证的真实行为 |
|---|---|---|---|
| 意图 | intent-clear | train | 明确同范围请求不额外确认 |
| 意图 | intent-vague | validation | 提取关键未知、只问关键问题 |
| 意图 | intent-nonexpert | test | 认知补全、避免工具/术语锚定 |
| 意图 | intent-conflict | train | 发现互相矛盾的约束 |
| 意图 | intent-means-goal | validation | 区分指定手段与真实目标 |
| 意图 | intent-update | test | 按新信息更新契约与边界 |
| 纠偏 | correction-agent-failed | train | 处理 Agent 失败，不假报交付 |
| 纠偏 | correction-tool-error | validation | 处理报错、重验且不越权安装 |
| 纠偏 | correction-wrong-goal | test | 工具成功仍检查目标是否正确 |
| 纠偏 | correction-scope | train | 不越权上传用户信息 |
| 纠偏 | correction-understanding | validation | 修正原意误解并回流契约 |
| 纠偏 | correction-budget | test | 两轮重验失败后停止自动修复 |

新增 field checks 只检查输出 decision/委派标志，不是上述所有行为的充分判据。repairCount、观察证据、语义目标与权限依据不在 v1 输出字段内，必须额外检查历史/工具轨迹和独立语义评审。没有为了评分而更改核心规则或删除历史断言。

## 7. SkillOpt 输入与独立评测

最终快照选择 01/05/07/08 + 06，无 02/03/04 正文；入口仍保留它们的条件引用，触发时必须提供模块或报告加载缺口。完整包包含八模块。训练快照是单一规范入口的依赖闭包导出，不是另一份维护核心；SOURCE 边界提供文件和修订回映。

可优化部分仅为 01 清晰度表达/原型指引、06 提问和取证策略、08 Dynamic Adjustment。05/07、安全授权、宏阶段、四层 handoff、Schema、最多两轮、证据真值和 Final Report Gate 全部冻结。候选只能落 `.local/skillopt-candidates/<experiment>/<step>`，不能直接改生产入口。当前还没有自动强制这些分段编辑边界的 SkillOpt 集成，训练前必须验证优化器与 diff gate。

runner `-Split train|validation|test` 只运行选定集；默认 train，旧未标 split 案例仅作为 train。系统消息仅包含来源快照及用例 input，不包含 behaviorChecks/期望答案。候选生成只能读取 train；validation/test 由独立 evaluator 执行，详细反馈和输出不回灌优化器。repo 中持有留出集文件不等于优化器被实际隔离；尚需验证真正的优化器访问/反馈边界。

准备配置 `evals/skillopt-preflight.json` 明确 enabled=false、targetModel/optimizerModel 待确认、费用上限未授权。建议初始输出上限 4096 token、最多 2 步仅作有授权后的 pilot 参数，不能保证不截断；记录 usage、finish_reason、来源锁、候选日志，预算耗尽停止。4/4/4 样本量只能验证流程，不能支持胜出结论。没有已安装 SkillOpt 配置 API 的可用性证据，不把规划 JSON 冒称可直接启动的训练配置。

## 8. 实际验证命令与对照

| 检查 | 实际命令 | 本轮结果 / 上轮 |
|---|---|---|
| 全部 CI | `pwsh -NoProfile -File local-ci.ps1 -AgencyRoot .ci-stubs/agency-agents -OutputReport` | 14/14；不新增 CI 总项，只扩展自动发现测试 |
| Pester | `pwsh -NoProfile -File run-tests.ps1`，也由 CI 调用 | 74/74；上轮 62/62，新增 8 个 evaluator + 4 个 split 测试 |
| Python 整合 | `python tests/test_master_skill.py`，CI 内执行 | 10/10，与上轮相同 |
| 全 Schema | `python -X utf8 ../validate_all_schemas.py` | 12 Schema / 38 示例；与上轮相同；外部辅助文件此前已保留 |
| 入口/编码/Prompt | `python scripts/master_skill.py check`、CI encoding/offline-prompt-evals | 通过；历史定义仍 19/19，新增 12 不混入旧计数 |
| DSH 原生契约/trace | `python -X utf8 scripts/verify_dsh_candidate.py --dsh-home C:/Users/tongk/.dsh --output .local/dsh-contract-verification` | 5/5；其中插件是 Mock，v1 拒绝为预期差异证明 |
| Skill 包/闭包 | `python scripts/master_skill.py build --output .local/runtime-verification/skills/master-skill`；`export --modules 06 --output .local/runtime-verification/skillopt-baseline` | 自包含引用、闭包和新来源锁检查 |
| DSH 实际加载器 | DSH Electron 主机 `--expose-internals scripts/test_dsh_loader.cjs <实际 provider 文件> .local/runtime-verification/skills .local/runtime-verification/loader-verification.json` | 实际 provider，隔离组件；无模型 |
| Git | `git diff --check`、`git diff --cached --check`、`git fsck --full` | 通过；最后工作区 clean；无远程写入 |

最初误用不存在的 `scripts/run-tests.ps1`，返回找不到文件；改用仓库根目录现有 `run-tests.ps1`，没有新增重复 runner。Pester Mock 和 UTF-8/换行问题见第 2 节。修复均针对实现/测试 fixture，没有放宽安全或契约断言。

## 9. 剩余阻断与训练准入

**暂不具备启动条件。** 已完成：规范入口、可追踪本地提交、依赖闭包、来源锁、基础回归、结构评测和截断分类、DSH 加载组件隔离验证。

未完成及解除条件：

1. DSH v2.1 无损契约与生命周期适配：先明确目标确认/原型政策的权威，提供缺失的真实字段来源，实现并验证拒绝缺项的 Adapter，不覆盖当前安装。
2. 独立语义评测与真实 runtime 行为：当前十二案例只有定义/静态证据；需要模型费用授权后在隔离 profile 中验证工具返回、错误、权限、回流、有限修复、观察轨迹及最终目标验收。
3. trace 的目标/验收缺项、并行事件关联及验证误分类：需要经授权的候选插件修复和真实事件测试，不能按 turn succeeded 接受任务。
4. 优化器隔离、冻结区自动 diff gate、样本扩充/重复运行：需确认真实 SkillOpt 实现，验证独立 evaluator 不回灌留出答案；现有小样本不可用作效果结论。
5. 费用与资源：目标/优化模型、账户可用性、明确金额/token 上限、最多步骤和停止条件尚未获得授权。配置保持禁用。

本轮全部能够安全落地的仓库修复、离线检查与加载探针已执行；未把上述外部协议/费用/行为缺口宣布为完成，也未自动启动第二轮 SkillOpt。
