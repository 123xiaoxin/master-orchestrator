# Master Orchestrator 工程审计与整合报告

审计起始：2026-10-09；继续整理：2026-10-10（Asia/Shanghai）。
范围：仓库审计、最小规则整合、开发者 Skill 包与本地验证。
不包含安装替换、运行时实现、付费模型评测、SkillOpt 训练、提交或远程发布。

## 1. 状态与可信边界

**整合状态：部分完成。** 仓库内统一入口、模块选择、版本对应和训练来源
已形成可审查改动；安装副本迁移、独立模型行为与真实运行时验收尚未完成。
“源码可以打包读取”不等于“已在 DSH/OpenClaw 实际生效”。

- 分支：`codex/master-integration`，跟踪 `origin/main`。
- HEAD / 远程 main 基线：`a6c2d0c48fb22f1bf8e9522c3e27270049c95267`。
- 项目：`5.8-draft`；开发者 Skill 包：`0.2.0-draft`；不是正式发布。
- 当前改动未提交。HEAD 仅标识基线，不能标识整合后的规则内容；构建/导出
  的 `source-lock.json` 同时记录 dirty 状态和源文件/产物 SHA-256。
- 原始工作目录是无提交的 Git 仓库，仅有未追踪压缩包；未改动该压缩包、
  原始 `.git`、已安装 Skills 或运行环境配置。另建工作副本安全隔离。

常规 Git HTTPS 克隆和远程查询连接失败，包括本机代理路径。改用 GitHub
API 查询 refs/提交元数据、SHA 定址 codeload 归档取得内容，并恢复原始 Git
对象。每个恢复的 Commit 和 Tree 都与 API 给出的原始 SHA 一致；包含
签名合并提交，未产生新提交。main 有 48 条提交，加上未合入验证分支共
49 个原始提交；`git fsck --full` 通过。`origin/*` 是 API 观测后恢复的 refs，
**不是一次成功的 git fetch**。常规后续 fetch 仍依赖网络恢复。

紧凑来源证据见 [integration-source-evidence.json](integration-source-evidence.json)。

## 2. Git 历史与历史体系整合程度

| 远程分支 | SHA | main 中的状态 |
|---|---|---|
| main | `a6c2d0c48fb22f1bf8e9522c3e27270049c95267` | 当前基线 |
| upgrade/v5.7-merge-optimization | `52258dfd72a6557a5561911df2e1541873b18f15` | `merge-base --is-ancestor` 返回 0；经 `9d92e4a` 合并 |
| upgrade/v5.8-contract-validation | `041a5075673a91c89a1e7b9e5e1a2351efb24eb6` | 返回 0；经 `3a379ca` 合并 |
| upgrade/v5.8-validator-coverage | `d88ef43a4c9cbb5b79e5089bb0cf4f3741a6e43f` | 返回 1；未合入，相关验证文件本次保守复用到工作区 |

API 查询 Tag 和 Release 均为空。README 的 v5.8 draft 不代表有 v5.8 Tag
或 Release。原始 AGENTS 固定写 v5.4 开发分支，不能代表真实 Git 状态。

| 历史体系 | Git 已合并 | 文件已包含 | 规则已整合（整合前 → 后） | Skill 入口接入（前 → 后） | 运行时验证 |
|---|---|---|---|---|---|
| v0.1 Clarity Gate | 是；`8eaec11` 文档、`c28f09e` Skill、`33a8771` 对齐 | 是 | 与 01 重复，独立定义 → 核心原则集中在 01，历史说明保留 | v0.1 独立入口 → 统一入口包含 | 本次未验证真实行为 |
| v5.4 Core / 执行契约 | 是；`0006657` Validation Foundation | 是 | 阶段规则存在旧语义 → 宏阶段保留，执行中验证和授权明确 | 01 与 v0.1 分离 → 必读 Core | 本次未验证真实行为 |
| v5.5–v5.8 验证/纠偏/取证 | 是；`c7d3bdb`、`a030e6d`、`56c4ec0`、`ff345c7`、`d8e2310`、`c05e301`、`041a507` | 是；部分验证器仅在未合入分支 | 扩展并存，加载缺口 → 依赖闭包与冲突处理明确 | 05/07/08 没进 v0.1 安装包 → 必读；06 条件读取 | Prompt 规则、静态与 Mock 层，非 live harness |

结论：历史三套体系此前在 Git/文件层面共存，不等于架构与安装入口全部
整合。此次完成仓库规则和可分发资源层的统一；没有把未验证运行时能力
宣布为已实现。DSH 本机另有 Framework v1.8/v2.1，是额外的外部变体，
不能仅凭“v5.8 完整版”文字视为这三套规则的等价适配。

## 3. 全量审查范围与规则对照

扫描全部 8 个 Prompt、12 个 Schema、helpers、templates、examples、evals、
tests、CI、安装入口、历史 Clarity Gate、foundation、Harness、Goal Pursuit、
Evidence、Capability Gap、Cognitive Staging、外部研究和设计计划。
区分执行规范、序列化契约、确定性辅助代码、Mock 与设计说明；没有将
文档中的 Runtime 建议当作现成 Runtime。

| 机制 | 实际位置 | 可证明来源 | 原始实现状态 | 原加载关系/重复或冲突 | 本次处理 |
|---|---|---|---|---|---|
| 清晰度闸门/原型 | prompts/01；skills/master-skill；docs/Master-Skill-v0.1-Clarity-Gate | `8eaec11`、`c28f09e`、`33a8771` | 规则、Schema、案例 | v0.1/01 重复定义 | 01 定义，Skill 只选入和解释映射，历史文档保留 |
| 第一性原理/认知补全/专业视角 | 原 Skill、历史 docs/01/06 | `47f256c`、`33a8771` | 文档/规则 | 缩短 Skill 可能丢失视角与 Progress Map | 把决策要点纳入 01，保留按需视觉能力与禁止展示内部推理 |
| 意图取证 | prompts/06；intent_elicitation.v1；validator/tests | `c05e301` | 规则/确定性验证 | Core 引用但原复制包不含 06；0.75 手续易混同全局阈值 | 条件模块；四层 + 0.75 是该记录 handoff 约束；不授权执行 |
| 执行契约 | master_output_contract.v1、requirement_clarity.v1、task_analysis.v1 | `0006657`、`8eaec11`、`041a507` | Schema/示例/helper | 概念字段与 JSON 名称易混用 | 入口明确映射，不改 v1 wire identity |
| 授权闸门 | 01 Phase 3；07 Authorization；05 Repository Mode | `0006657`、`c7d3bdb`、`041a507` | 规则 | 无条件再确认与已经明确授权的工作冲突 | 记录既有同范围明确授权；缺失/实质变化才停等 |
| 执行中验证 | 01、03、04、05、07 | `c7d3bdb`、`a030e6d`、`041a507` | 规则/测试 | 旧 Core/Quality 声称 Phase 4 纯执行、全部质检 Phase 5 | Phase 4 验证；Phase 5 总评/沉淀；宏生命周期不改 |
| 有限修复 | 05/07；verify_repair_loop.v1；helper/tests | `c1595de`、`a030e6d` | 规则/代码/测试 | 重复但上限一致 | 保留最多两轮、每轮重验与停止条件 |
| 状态机 | 05/07；state_machine.v1；helper/tests | `a030e6d`、`d6db017` | Schema/helper/Mock | repaired 被说成重验成功；07 的泛 phase 与固定 phase_4 不一致 | repaired=修复已应用待验；跨阶段进度写 Goal ledger |
| Goal Anchor/偏移纠正 | prompts/08；docs/goal-pursuit-loop | `ff345c7`、`041a507` | 规则/设计/Schema | 原安装入口没有引用 08 | 必读；复杂/审计任务完整账本，简单任务轻量验证 |
| 三层证据/最终真值 | prompts/08；docs/runtime-evidence-source-of-truth | `d8e2310`、`041a507` | 规则/设计，非 runtime hooks | 自述账本可能被误当事实 | 维持 observed trace 真值；不可完整核对则 ledgerUnverified、不得 completed |
| Final Report | 05/07/08；final_report.v1 | `c7d3bdb`、`041a507` | 规则/Schema | main 没有独立 v5.8 helper | 复用 d88ef43 helper/测试；字段检查不冒充 runtime audit |
| Capability Gap | 07；capability_gap.v1；docs/decision-tree | `30867e8`、`041a507` | 设计/Schema | main 缺 helper，非自动装工具 | 复用 d88ef43 验证；保留授权和安全路由 |
| 五层快照 | docs/agent-performance-stack；five_layer_snapshot.v1 | `cc3965a`、`041a507` | 诊断设计/Schema | 不代表自动 snapshot runtime | 保留兼容，复用现有验证分支 |
| Agent 调度 | 02；create_temp_expert/create_agent_pack/finalize | `c14718f`、`0006657` | 辅助代码 + Mock/DryRun | 用户自建 Agent 旁路；DSh 不用 OpenClaw helper | 选入仍为可选、受权限限制；不扩张调度 |
| 质量/沉淀 | 03/04 | 历史初始模块 + 后续 Core | 规则 | Phase 4 “不操作”不应阻止其他模块验证 | 保留 Phase 5 评估定位，不另定义验证规则 |
| 可移植 CI/评测 | local-ci、run-tests、evals | `c05e301`、`29ec7ee`、`041a507` | 静态定义/Mock；另有付费 runner | 静态评测只检查案例；LLM runner 默认只 01 | 增加入口整合检查；取消隐式 01-only 默认 |

## 4. 整合前后架构与实际加载

整合前：v0.1 Skill 有自己的行为定义，README 复制该文件夹；Core 与 05–08
位于仓库 prompts，分别宣称加载条件；动态拼装明确未来规划。没有可证明的
统一依赖闭包或自包含安装产物。部分本机安装自行复制模块，但也不等于
原仓库安装逻辑已经完整。

整合后：

```text
skills/master-skill/SKILL.md  唯一规范性入口
  modules.json              版本 / 依赖 / 条件 / SkillOpt 边界
  Core/Intent/Contract      01
  Correction               05 + 07 + 08（必读）
  Intent evidence          06（条件；只交给 Phase -1b）
  Extensions               02 / 03 / 04（条件）
  build/export             资源包 / 选定闭包快照 + source lock
  runtime adapter          外部；未在本次实现或部署
```

依赖：05→01；07→01,05；08→07；06→01；02→01,07；03/04→01,08。
有向依赖无环；“参考 Core”的说明不是递归调用 Skill 入口。所有被选择模块
按前置顺序显式读取一次。所需资源无法读取就停止依赖它的执行，不回退成
01-only。打包只是复制资源和改写相对链接，不会自动启动或注册 runtime。

源入口使用仓库相对路径；安装包的同一入口重写为本地 references 路径。
源码不维护第二套模块副本，生成包不作为另一个核心编辑。完整包保留全部
可选模块，训练快照按所选依赖闭包导出，不把八个源文件拼成新的规范文件。

权限优先级：Host/User 授权约束 → 统一入口的选择/冲突约定 → 01 宏生命周期
与 Phase -1b → 05/07/08 执行细化与验收；06 是用户证据而非授权；03/04 不
覆盖执行验证。序列化按对应 Schema，历史文档解释来源不另发最高优先规则。

## 5. 关键冲突与处理依据

1. **Phase 4 纯执行 vs Verify/Repair**：来自 01/03/04 与 05/07；后者有
   两轮限制的 Schema、案例、Pester 验证。采用执行中验证与最终总评分离，
   不改 Phase -1..5；没有删除有效断言。
2. **双 Skill 核心**：v0.1 SKILL/AGENTS 重述 Clarity，01 为另一核心。
   原则集中到 01，SKILL 负责路由/权威/契约映射，AGENTS/IDENTITY 成指针。
   保留历史文件与能力，不删除旧版设计。
3. **反复授权**：01 的“必须等待回复”与明确同范围授权的任务冲突。
   核对记录现有授权；任何新增权限、范围或风险仍需确认。未确认推测不
   可授权。这不是撤掉 Phase 3 Gate。
4. **阈值冲突表象**：Phase -1b 75%-80% 是启发式；06 的四层具体 +0.75
   是已测试的 evidence handoff 限制。保持限制，预算耗尽/部分证据不能
   伪造 handoff；新具体请求可另由 Phase -1b 评估，保存旧部分记录。
5. **repaired 状态**：05 的释义与下一步重验不一致；改为应用修复后待验，
   verified 必须有实际验证。07 的跨阶段 phase 改为使用 Goal ledger，
   state_machine.v1 仍严格 phase_4。
6. **版本混用**：README v5.8、Skill v0.1、Prompt v5.4/v5.5/v5.7 等分别
   指不同产物。保留来源版本，新增修订标记和包版本，不机械全改 v5.8。
7. **序列化 vs 事实验收**：final_report 的 sourceOfTruthGate 在 v1 Schema
   是可选的，复用验证器仅在字段存在时检查声明；这兼容历史示例，但不能
   单独证明实际完成。入口明确：真实验收仍必须消费 observed/audited 证据。
   更严格 wire contract 的版本迁移另需兼容评审，本次没有擅自改 v1。

## 6. 本机运行环境调查与停止的相关修改

- `dsh --help` 成功，证明 CLI 可用，不证明已加载 Master。
- `~/.dsh/skills/master-orchestrator/SKILL.md` 实际包含八模块读入表，另有
  Framework v1.8、semantic definitions、v2.1 Schema 和 Node 验证器。
  八个 prompts 与本次修改前 main 的文本相同，但入口并非仓库入口。
- `~/.dsh/.agent-presets/master-orchestrator/` 含 schemas/helpers、preset、
  agent.cordis 和 trace 插件文件；这些存在不证明当前 profile/session
  挂载或 trace 自动对账正确。本次没有读取凭据文件或改写 profile。
- DSH Framework 强制 clarify→prototype→verification→execute，规定另一份
  唯一最终输出协议，并有候选支配、澄清/回流/委派落盘等额外规则。
  Core 则保留 clarify/prototype/execute 三路；06 的独立 evidence record
  与 DSH 内联 intentEvidence 也有协议差异。框架正文还有 v2/v2.1 表述
  不一致，不能自动推断合并权威。缺少迁移授权和完整行为证据，未改此变体。
- `~/.openclaw/skills/master-orchestrator/SKILL.md` 为旧 v0.1，副本有 01–06，
  缺 07/08；实际文件存在超出旧仓库复制包，不代表入口明确读它们。
- 仓库 `check_env.ps1 -OpenClawTimeoutSeconds 5` 只读运行；models status
  和 agents list 均超时。报告目录存在和模板数属于只读观测，不等于
  模型/Agent 状态已经可用。

本次停止的是外部安装迁移与重大协议合并；仓库内安全的整合和验证继续。
没有真实 DSH/OpenClaw 对话或付费模型调用。因此简单任务、模糊需求、执行
偏移三个情境仅可在静态/Mock 层检查选择和契约，不声明真实行为通过。

## 7. 修改文件和关键 Diff

| 文件组 | 原因 / 关键变化 |
|---|---|
| README.md、AGENTS.md | 当前入口、版本、授权与验证关系；去除固定历史分支 |
| skills/master-skill/SKILL.md、AGENTS.md、IDENTITY.md、README.md | 单一规范入口；适配指针；替换不完整复制安装说明 |
| skills/master-skill/modules.json | 必需/可选模块、无环依赖、修订与优化边界 |
| prompts/01–08 | 有证据的授权、验证、状态、取证边界冲突修订；保留模块结构 |
| scripts/master_skill.py | 确定性入口检查、自包含打包、选定快照与哈希来源锁；不调用模型 |
| tests/test_master_skill.py、EvalSource.Tests.ps1 | 缺失/循环/越界/版本/必读闭包/包引用/拒绝覆盖/基线保留；付费调用前来源拒绝与 Mock 哈希保存 |
| helpers/Common.ps1、validate_capability_gap/final_report/five_layer_snapshot/goal_pursuit_ledger.ps1 | 从 d88ef43 复用 main 已有 v5.8 契约的验证内容 |
| tests/Common.Tests.ps1、V58Validators.Tests.ps1、SchemaDocumentation.Tests.ps1 | 复用原分支断言，覆盖 12 个 Schema 和安全失败情境 |
| local-ci.ps1、scripts/check_encoding.ps1、.github/workflows/ci.yml、docs/ci-cd.md | 接入四项验证和入口整合检查；编码覆盖 Python 源；CI 显式 Python 3.12 与开发依赖说明 |
| evals/run_llm_evals.ps1、evals/README.md | 禁止隐式 01-only 输入，保留显式历史重现与完整来源路径 |
| docs/version-governance.md、skillopt-baseline.md | 分离版本身份、来源 SHA/dirty/hash、训练与评测前置条件 |
| docs/implementation-status.md、docs/Master-Skill-v0.1-Clarity-Gate/README.md | 标记规范入口与历史/运行时边界 |
| docs/reports/master-integration-audit.md、integration-source-evidence.json | 本报告与远程/本机副本来源证据 |

所有 Diff 保留在独立分支的工作区。未 commit、push、merge、release；
未删除历史提交，未 force reset。验证分支的复用是文件层整合，不能称其
Git 分支已合并；其原始提交与远程 ref 仍保留。

## 8. 测试记录

整合前基准（2026-10-09）：PowerShell 7、Pester 5.7.1；Local CI 9/9，
Pester 43/43；19 个离线评测定义、6 个模板、4 个 task analysis、5 个
intent records、各 1 个 state/repair 和3个 Master output 示例通过。
模板使用与 CI 相同的隔离专家 stub；AgentPack 创建用 Mock，不创建真实 Agent。

整合后（2026-10-10）完整 Local CI **14/14 通过，失败 0**；Pester
**62/62 通过**，入口/打包 Python 测试 **10/10 通过**，离线案例仍为
**19/19 定义通过**。原断言未删减。新增 EvalSource Mock 测试证明缺少
显式来源和过期哈希会在模型请求前失败，并验证来源锁保存；不产生付费调用。

另外使用本机已安装 jsonschema 4.26.0 的 Draft202012Validator/FormatChecker
核对全部 **12 个 Schema** 及 **38 个内联/独立/模板示例**，失败 0；该检查
不额外安装依赖，也不是 live runtime 验收。Skill Creator `quick_validate.py`
通过，`git diff --check` 通过；曾发现四个编辑文件的 Windows 换行差异，
按仓库 LF 约定修复后通过，没有变更断言或安全要求。

机器可读本地结果见 [integration-validation.json](integration-validation.json)。
实际执行命令：`local-ci.ps1 -AgencyRoot .ci-stubs/agency-agents -OutputReport`、
`python tests/test_master_skill.py`、`python scripts/master_skill.py check`、
Skill Creator 的 `quick_validate.py`、全 Schema 示例验证和 `git diff --check`。
打包和基准导出为独立新 `.local` 目录，具备来源锁和包内引用检查。
GitHub Actions 只修改配置以复用同一套检查，未推送或在云端运行。

最终可审查资源：`.local/review/master-skill-package/` 和
`.local/review/skillopt-baseline/`；各自包含 `source-lock.json`，另记录生成器
本身的 SHA-256。早期构建副本保留，但以 review 目录的锁定快照为本次交付。

| 类别 | 检查 | 证据层 |
|---|---|---|
| Git 完整性 | 全部原始 SHA/Tree 校对；git fsck --full | 原始源码与 Git 对象 |
| 编码 | check_encoding.ps1 | 静态 |
| 契约 | 现有及复用的 9 个记录验证器、模板、Schema 示例 | 结构/语义声明验证 |
| Prompt | run_prompt_evals.ps1 的 19 个 case | 定义完整性/覆盖，不是模型行为 |
| Pester | run-tests.ps1 | 静态 + 隔离 Mock |
| Skill | check + integration tests + build + export | 资源/选择/哈希；不代表模型读取 |
| 模型 | 未运行 | 无行为结论 |
| live runtime | DSH help、OpenClaw 只读查询；对话未运行 | 可用性探查，非完成验证 |

## 9. SkillOpt 来源与启动条件

下一轮来源：规范 Skill + 01/05/07/08 闭包 + 06；先导出完整选定规则，
不是单独训练 prompts/01。01 Phase -1b、06 取证策略和 08 Dynamic
Adjustment 可作限定候选；05/07 与 Schema、安全/授权/两轮停止/证据真值/
最终验收全部冻结，02–04 仅做兼容验证。生产入口不由优化器覆盖。

已有 LLM runner 的旧默认确实只读取 01；Git 树/历史没找到 SkillOpt 原始
训练配置和日志，不能据此声称复原了第一轮实验。用户报告的评分泄漏、
小样本不稳定、输出截断列为下一阶段硬前置条件；需独立留出评测、样本
与重复设计、finish reason/token 检查及匹配基准比较。当前 runner 不自动
解决这些问题；本任务没有重新实现评测系统。

**启动条件尚未全部满足**：来源导出工具具备，但需接受整合基线并生成
新来源锁，解决 DSH 的外部协议权威，确定独立评测/截断处理和费用授权。
旧 HEAD SHA 不等于整合产物版本；对照 source-lock 的实际源哈希。

## 10. 未解决限制与验收回答

1. 历史三套体系：Git/文件已共存；本次仓库架构/入口/资源层统一；运行时
   生效与外部 DSH 框架迁移未完成。
2. 生效模块：仓库定义的必读 01/05/07/08 和条件 06/02/03/04 可打包与
   显式读取；实际 session 加载没有观察证据，不能笼统声称生效。
3. 唯一规范入口：[skills/master-skill/SKILL.md](../../skills/master-skill/SKILL.md)。
4. 内部重复与明确冲突已收敛；历史文档保留，DSH v2.1 与 runtime 语义
   验收差异明确未解决，未强行覆盖。
5. 既有清晰度/原型/视角/Progress Map/契约/有限修复/证据原则保留；完整
   资源包可验证，但无“跨运行时不丢失行为”的实测保证。
6. SkillOpt 应用真实完整依赖闭包进行限定候选优化；还不满足训练启动的
   全部评测、运行时和授权条件。

剩余技术限制：传统 Git transport 失败；v1 Schema 与若干手写验证器不
完整证明 runtime acceptance（例如最终 Gate 可选，state validator 不完整
证明合法 transition）；未取得完整 observed/audited trace；无独立模型审查；
未验证模型在完整 context 下的遵循与输出预算。它们均不因静态测试通过而消失。
