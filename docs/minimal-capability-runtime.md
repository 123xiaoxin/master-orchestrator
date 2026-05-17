# Minimal Capability Runtime：最小能力运行层

## 定位

v5.5 Phase 2B 的第二能力模块不是 **Skill Library**，而是
**Skill Capability Runtime**。

它不负责收集大量 Skill，也不默认生成业务 Skill。它负责让 Master 在已有
Execution Contract 之后判断：

- 当前任务需要什么能力；
- 当前环境已有多少能力；
- 应该使用 CLI / MCP / 本地工具 / 已有 Skill / 临时脚本 / 人工接管；
- 哪些操作需要安全授权；
- 哪些稳定流程值得沉淀成 Skill。

执行层不得直接消费用户原始模糊需求，只能消费 Master 核心层生成的
Execution Contract。

## 为什么不做大规模 GitHub Skill 收集

大规模 Skill 收集会把问题从“任务是否清楚”转移成“仓库里有没有某个 Skill”。

这会带来：

- 匹配噪音：大量 Skill 反而增加选择成本；
- 质量风险：外部 Skill 的维护状态、权限边界、验证标准不一致；
- 安全风险：未知 Skill 可能扩大文件、网络、凭据和系统操作风险；
- 复杂度倒挂：简单任务被迫进入不必要的 Skill 路由；
- 沉淀失真：一次性流程被包装成长期能力。

Master 的能力增强不应靠堆积 Skill，而应靠稳定的能力判断、最小工具选择和
可验证执行。

## 为什么 PPT / Word / Excel 不优先做单点 Skill

PPT、Word、Excel 这类任务首先是工具能力问题，不是 Master 核心机制问题。

优先路径应是：

1. 使用现有 CLI、Python 库、MCP、插件或本地工具；
2. 通过 Execution Contract 限定输入、输出、格式和验证标准；
3. 仅当某类文档流程反复出现、边界稳定、验证标准明确时，再沉淀为 Skill。

不应因为一个文件类型常见，就直接创建一个单点 Skill。

## 能力选择优先级

默认优先级：

1. **Direct / Local**
   Master 直接用本地文件、Git、PowerShell、Python、系统工具完成。
2. **CLI**
   当工具已有命令行接口，优先读取 `--help` 或文档，生成最小命令并验证结果。
3. **MCP / Connector**
   当任务需要访问结构化外部系统或应用上下文时使用。
4. **Existing Skill**
   只有当已有 Skill 与 Execution Contract 明确匹配，且边界和验证方式清楚时使用。
5. **Temporary Script**
   一次性批处理、转换、校验可以使用临时脚本，但不默认沉淀。
6. **Manual Handoff**
   权限不清、风险过高、上下文不足或无法验证时，交给用户决策。

原则：能直接完成就不调用 Skill；能用已有工具就不写脚本；能不创建 Agent 就不创建 Agent。

## 五个最小能力原型

这些是能力运行层的最小原型，不是业务 Skill，也不是大规模 Skill registry。
这些原型不要求立刻实现为 OpenClaw Skill；它们先用于定义能力运行层的最小职责边界。

### 1. Tool Discovery Skill

目标：发现当前环境可用能力。

输入：

- Execution Contract
- 当前仓库上下文
- 本地环境状态

输出：

- `availableTools`
- `missingTools`
- `riskyTools`

发现范围：

- CLI / PowerShell / Python
- MCP / connector
- OpenClaw skills
- 仓库已有 helpers / scripts
- Windows 本地程序
- 已安装开发工具

限制：

- 不自动安装未知工具；
- 不批量拉取 GitHub Skill；
- 不把工具存在本身当成使用理由。

### 2. Capability Matching Skill

目标：从 Execution Contract 推导所需能力，并选择执行路线。

输入：

- Execution Contract
- Tool Discovery 输出

输出：

- `requiredCapabilities`
- `recommendedRoute`: `direct` / `cli` / `mcp` / `skill` / `script` / `manual`
- `riskLevel`
- `verificationPlan`

规则：

- 执行层只能消费 Execution Contract；
- 不能把用户原始模糊需求直接交给工具、Skill 或 Agent；
- 推荐路线必须是最小充分路线；
- 如果缺少关键能力，应降级、澄清或人工接管。

### 3. CLI Adapter Skill

目标：把 CLI / PowerShell / Python / Windows 本地工具变成可审计、可授权、可验证的执行通道。

最小流程：

1. 读取工具说明，如 `--help`、README、内置文档；
2. 生成最小命令；
3. 执行前判断风险；
4. 必要时请求用户授权；
5. 执行命令；
6. 根据验证点检查结果；
7. 失败时进入有限 Verify / Repair Loop。

禁止：

- 直接运行未知脚本；
- 拼接高风险命令后立即执行；
- 未验证就声称完成；
- 超出 Execution Contract 授权范围。

### 4. Security Capability Skill

目标：对操作做风险分级，并判断是否必须授权。

风险等级：

- **L0 Readonly**：只读查看、列目录、读取状态。
- **L1 Local Safe Write**：小范围文件新增或编辑，可 diff 验证。
- **L2 Local Batch Change**：批量格式化、批量重命名、生成文件。
- **L3 External or Process Impact**：网络请求、启动/停止进程、修改运行状态。
- **L4 Destructive or Persistent Change**：删除、覆盖、修改配置、安装依赖。
- **L5 Irreversible / Sensitive**：force push、上传敏感数据、生产环境操作、凭据相关操作。

gateway restart / doctor --fix 默认至少 L4；force restart 属于 L5。

必须等待用户授权的操作：

- `git push`
- force push
- 删除文件或目录
- gateway restart
- `doctor --fix`
- kill process
- 修改配置
- 上传敏感数据
- 安装未知依赖
- 执行来源不明脚本

授权请求必须说明：

- 将执行什么；
- 影响范围；
- 风险等级；
- 是否可回滚；
- 验证方式。

### 5. Skill Deposition Skill

目标：判断一个流程是否值得沉淀成 Skill。

准入标准：

- 重复出现；
- 流程稳定；
- 输入输出明确；
- 验证标准明确；
- 封装后能减少上下文和错误率；
- 权限边界清楚；
- 失败路径可描述；
- 不依赖单个项目的偶然结构。

不应沉淀为 Skill 的情况：

- 一次性任务；
- 需求仍模糊；
- 验证方式不明确；
- 只是为了包装某个工具；
- 会增加执行复杂度；
- 需要频繁人工判断才能完成。

## Tool Discovery 规则

Tool Discovery 只回答“当前任务可用什么最小能力”，不做泛化收集。

顺序：

1. 查看仓库已有脚本和文档；
2. 查看本地 CLI / PowerShell / Python 能力；
3. 查看 MCP / connector；
4. 查看已安装 Skill；
5. 判断缺口；
6. 必要时请求用户确认。

## Capability Matching 规则

匹配时必须至少判断：

- 任务所需能力；
- 当前可用能力；
- 推荐路线；
- 风险等级；
- 授权需求；
- 验证方式；
- 失败后的降级路径。

匹配结果应服务于最小执行，而不是最大能力调用。

## Execution Adapter 规则

Adapter 负责把 Execution Contract 转成具体工具调用。

它必须保持：

- 输入来源清楚；
- 操作范围清楚；
- 风险等级清楚；
- 验证信号清楚；
- 失败处理清楚。

Adapter 不负责重新解释用户需求，也不允许扩大任务目标。

## 与 Master Skill Foundation 三原则的关系

### 系统建模

Minimal Capability Runtime 把工具环境建模为能力集合：

- 当前任务需要什么；
- 当前环境有什么；
- 哪些能力缺失；
- 哪些操作高风险；
- 哪些结果可验证。

### 信息降熵

Execution Contract 先降低需求不确定性，Capability Runtime 再降低能力选择不确定性。

未降熵的需求不能外包给 Skill、CLI、MCP 或临时脚本。

### 反馈控制

所有能力调用都必须有验证信号和失败路径。

高风险操作必须授权。失败修复必须有限。不能无限搜索工具、无限安装 Skill、无限重试命令。

## 与 v5.5 Phase 2A 的关系

Phase 2A 提供 Long Task Runtime Contracts：

- `state_machine.v1`
- `verify_repair_loop.v1`
- long task resume eval

Phase 2B 使用这些纪律约束能力运行：

- 长任务能力选择应记录当前执行坐标；
- 工具失败应进入有限 Verify / Repair Loop；
- 恢复任务时不重新完整拆解；
- 能力调用结果应能进入 Final Engineering Report。

Phase 2A 是长任务状态和修复边界。Phase 2B 是能力选择和工具运行边界。

## 后续可能需要的 Schema

本轮不设计具体 schema。

如果后续工程化，可能需要：

- capability discovery result
- capability matching result
- execution adapter plan
- security risk assessment
- skill deposition candidate

这些 schema 只有在流程稳定后才应加入，不应提前设计大而全 registry。

## 准入标准

任何 Phase 2B 后续扩展必须至少满足一项：

- 改善系统建模；
- 降低信息熵；
- 增强反馈控制。

如果一个扩展只是增加 Skill 数量、工具数量或流程复杂度，而不能让执行更清晰、更可控、
更可验证，就不应进入 Minimal Capability Runtime。
