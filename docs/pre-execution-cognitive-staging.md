# Pre-Execution Cognitive Staging：执行前认知分阶段机制

## 定位

Pre-Execution Cognitive Staging 是复杂任务进入执行前的认知分阶段机制。

它修正一种过度简化的理解：

```text
用户需求 -> Master 拆任务 -> 创建 Agent -> 执行
```

这个流程对简单任务可以成立，但对复杂任务不完整。

复杂任务在执行前必须先完成：

```text
信息收集 -> 背景分析 -> 任务框架设定 -> 初版执行契约
-> 独立反推审查 -> 契约融合修正 -> 能力选择 -> 执行
```

这不是默认创建执行 Agent，而是复杂任务默认引入前置认知阶段和独立反推审查。

## 为什么直接拆任务执行不完整

“用户需求 -> 任务拆分 -> 多 Agent 执行”存在几个问题：

- 用户需求通常不是完整任务定义；
- 任务拆分可能建立在错误背景上；
- 多 Agent 会放大模糊性，而不是消除模糊性；
- 缺少上下文分析时，步骤看似合理但现场不可执行；
- 缺少反推审查时，Execution Contract 容易自洽但不现实；
- 过早进入执行，会把认知缺口转化为执行返工。

复杂任务真正需要的不是更快拆分，而是先把任务变清楚、变现实、变可验证。

## Investigation Before Execution：先调查，后执行

复杂任务必须遵循 Investigation Before Execution。

“没有调查，没有发言权”在这里不是口号，而是工程规则：

- 没有信息收集和背景分析，就没有 Execution Contract 定稿权；
- 没有任务框架，就不应拆分复杂任务；
- 没有独立反推，就不应让复杂任务进入真实执行；
- 调查不是额外步骤，而是可靠执行的前提。

调查必须服务于 Execution Contract 定稿，不允许为了收集信息而无限扩展范围。
调查阶段应以足够形成可执行契约为停止条件，而不是以信息完整为停止条件。

对 Master 来说，调查不等于无限研究。它只要求在进入执行前，完成足够的事实收集、
背景分析、任务框架设定和风险识别。

简单任务可以直接最小执行；复杂任务必须先调查，再定约，再执行。

## 简单任务和复杂任务

### 简单任务

简单任务通常满足：

- 边界清楚；
- 风险低；
- 影响范围小；
- 不需要多路径决策；
- 可直接验证；
- 不涉及权限、成本、生产环境或客户交付；
- Master 可独立完成。

示例：

- 简单总结、翻译、改写；
- 简单文章；
- 简单 PPT / Excel；
- 单文件低风险修改；
- 低风险只读检查；
- 用户只要求初步想法。

简单任务可以跳过完整认知分阶段，直接进入最小雏形或最小执行。
简单任务可跳过完整认知分阶段，但不能跳过基本的目标确认、边界判断和结果验证。

### 复杂任务

复杂任务通常包含：

- 完整项目；
- 市场调研；
- 产品方案；
- 代码开发；
- 多文件修改；
- 客户交付；
- 多步骤自动化；
- 长任务 / 分阶段任务；
- 高风险操作；
- 多路径方案选择且选错代价高；
- CLI + MCP + Skill + Agent 混合执行；
- 生产环境、数据、权限、安全风险。

复杂任务必须完成 Pre-Execution Cognitive Staging。

## 最小认知阶段

### 1. Information Gathering：信息收集

目标：收集足够的事实和上下文，避免基于空想拆任务。

输入：

- 用户需求；
- 已有仓库 / 文件 / 文档；
- 可只读检查的环境信息；
- 用户已提供的限制和目标。

输出：

- known facts；
- missing facts；
- available context；
- constraints；
- initial assumptions。

最小退出条件：

- 已收集当前可通过只读方式获得的关键事实；
- 已区分已知事实、缺失事实和假设；
- 已能判断任务是否简单、复杂或需要用户补充关键约束。

禁止事项：

- 不执行写操作；
- 不创建执行 Agent；
- 不把缺失信息全部丢给用户；
- 不用猜测替代可读取事实。

### 2. Context Analysis：背景分析

目标：判断任务所处环境、约束、风险和真实目标。

输入：

- Information Gathering 输出；
- 用户目标；
- 当前系统状态；
- 相关文档和事实。

输出：

- real goal；
- domain context；
- risk boundaries；
- environment constraints；
- user-visible success conditions；
- possible failure modes。

最小退出条件：

- 已识别真实目标和任务背景；
- 已识别主要风险边界和环境约束；
- 已能说明成功结果如何被用户或系统验证。

禁止事项：

- 不急于拆执行步骤；
- 不扩大用户目标；
- 不引入未经确认的行业假设；
- 不把工具能力当成任务目标。

### 3. Task Framing：任务框架设定

目标：把复杂需求压缩为可执行的任务框架。

输入：

- Context Analysis 输出；
- 已知边界；
- 风险约束；
- 预期交付物。

输出：

- task boundary；
- non-goals；
- deliverables；
- candidate phases；
- validation points；
- open decisions。

最小退出条件：

- 已定义任务边界和非目标；
- 已明确交付物和基本验证点；
- 已识别仍待决的问题，并区分 Master 可解决和必须用户确认的问题。

禁止事项：

- 不默认创建 Agent；
- 不默认生成大计划；
- 不把多个互斥目标硬塞进同一任务；
- 不进入执行。

### 4. Draft Execution Contract：初版执行契约

目标：生成可被审查和修订的初版 Execution Contract。

输入：

- Task Framing 输出；
- validation points；
- risk boundaries；
- known assumptions。

输出：

- draft real goal；
- draft allowed actions；
- draft forbidden actions；
- draft deliverables；
- draft validation points；
- draft risk boundaries；
- draft fallback path。

最小退出条件：

- 已形成可审查的初版 Execution Contract；
- 已明确允许动作、禁止动作、验证点和风险边界；
- 已能交给独立 Counter-Agent 做反推审查。

禁止事项：

- 不把初版契约当最终契约；
- 不直接交给执行层；
- 不让执行 Agent 消费原始模糊需求；
- 不跳过审查进入复杂执行。

### 5. Counter-Agent Review：独立反推审查

目标：由独立角色审查初版任务拆分和初版 Execution Contract 的现实性。

输入：

- 初版任务拆分；
- Draft Execution Contract；
- 已知上下文和约束。

输出：

- Counter Review Report；
- likely failure points；
- missing constraints；
- unrealistic steps；
- missing verification；
- master can resolve；
- safe defaults；
- requires user confirmation；
- recommended contract changes；
- final decision。

最小退出条件：

- 已判断初版任务拆分是否现实；
- 已指出最可能失败点、缺失约束、不可执行步骤和验证缺口；
- 已将问题分类为 Master 可自行解决、安全默认值或必须用户确认；
- 已给出 `finalDecision.canProceed`。

禁止事项：

- 不执行任务；
- 不调用工具；
- 不重新规划完整任务；
- 不替代 Master 决策；
- 不创建执行 Agent；
- 不扩大用户目标；
- 不输出完整替代方案；
- 不把审查变成发散讨论。

Counter-Agent 必须作为独立审查角色运行，审查的是初版任务拆分和 Execution Contract，
而不是 Master 的同一上下文自我反思。

Counter-Agent 不需要接收 Master 的完整推理链，只需要接收可审查的方案产物。

原因是同一 Agent 在同一上下文中进行正向规划和反向审查，容易出现自洽、假反思和
上下文偏差。任务拆分可能逻辑顺，但执行不现实。

Counter-Agent 的目标不是增加人工确认，而是减少不必要的人工打断。

只有以下情况才打断用户：

- 权限操作：push / release / gateway restart / doctor --fix / 安装依赖；
- 不可逆操作：删除 / 覆盖 / 数据迁移 / 生产配置；
- 成本风险：大量 token / 付费 API / 大规模下载上传；
- 用户偏好：风格 / 品牌 / 对外口径 / 客户可见内容；
- 目标冲突：多个目标无法同时满足；
- 关键信息缺失：无法通过只读检查或安全默认值解决。

### 6. Contract Fusion：契约融合修正

目标：Master 融合 Counter Review Report，生成修订后的 Execution Contract。

输入：

- Draft Execution Contract；
- Counter Review Report；
- Master 的任务判断；
- 必要的用户确认。

输出：

- revised Execution Contract；
- accepted counter points；
- rejected counter points with reason；
- safe defaults used；
- user confirmations required or resolved；
- proceed / block decision。

最小退出条件：

- 已处理 Counter Review Report 中的关键问题；
- 已明确接受、部分接受或拒绝的反推意见；
- 已完成 Execution Contract 修订；
- 已确认可以进入 Minimal Capability Runtime，或明确阻塞原因。

禁止事项：

- 不机械接受 Counter-Agent 全部建议；
- 不忽略 `finalDecision.canProceed = false`；
- 不把可由 Master 自行解决的问题抛给用户；
- 不在契约未修订前进入执行。

如果 `finalDecision.canProceed = false`，不得进入执行。

## 进入 Minimal Capability Runtime

只有认知阶段完成后，复杂任务才进入 Minimal Capability Runtime。

此时 Master 再判断使用：

- CLI；
- MCP；
- Skill；
- 临时脚本；
- 执行 Agent；
- 人工接管。

能力选择必须消费修订后的 Execution Contract，而不是用户原始需求。

## 与“不默认创建执行 Agent”的关系

Pre-Execution Cognitive Staging 不等于默认创建执行 Agent。

它的规则是：

- 简单任务不进入完整认知分阶段；
- 复杂任务进入认知分阶段；
- 复杂任务必须进行独立 Counter-Agent Review；
- Counter-Agent 是审查角色，不是执行角色；
- 是否创建执行 Agent，要在修订后的 Execution Contract 之后再判断。

## 与 Master Skill Foundation 三原则的关系

### 系统建模

认知分阶段让 Master 在执行前明确：

- 目标；
- 边界；
- 环境；
- 权限；
- 风险；
- 状态；
- 验证点；
- 恢复路径。

Counter-Agent 检查这些建模是否完整。

### 信息降熵

复杂任务不是靠更多执行者解决，而是先降低不确定性。

认知分阶段把模糊需求压缩为：

- facts；
- constraints；
- task frame；
- execution contract；
- counter review findings；
- revised contract。

### 反馈控制

Counter-Agent Review 是执行前负反馈。

它在错误进入执行前修正偏差，减少执行中返工、无限 repair 和无效用户打断。

## 与 Manus / 通用 Agent 工具的区别

Manus 和通用 Agent 工具更偏自主推进。

Master 的重点不是更激进地自动执行，而是：

- 执行前认知更完整；
- 执行中更可控；
- 执行后可验证、可修复、可沉淀。

Master 是自主执行之上的控制层，而不是单纯更主动的执行 Agent。

## 准入边界

该机制不要求所有任务变重。

进入完整 Pre-Execution Cognitive Staging 的前提是任务复杂、风险高、路径多、
交付真实或执行成本高。

如果任务简单、低风险、边界清楚，Master 应直接进入最小雏形或最小执行。
