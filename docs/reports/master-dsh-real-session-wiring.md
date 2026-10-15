# Master × DSH 真实会话接线与安全准入验收

验收日期：2026-10-15（Asia/Shanghai）。结论：**BLOCKED**。

已经建立真实 DSH Agent 的受控装配入口，接通统一 Skill、现有 Adapter、
宿主授权能力、累计预算、真实工具派发和独立验证回流；未获授权时可靠阻断。
**尚不具备启动一次真实模型试验的全部工程条件**。剩余工程缺口只有：

1. 实际模型提供方的请求准备、输入/输出上界、价格上界、用量与取消链路尚未接通验收。
2. Windows 生产文件系统隔离尚未通过可靠的操作系统边界验证。

真实模型调用和生产写操作保持关闭。Level 2、Level 3 均为 **BLOCKED**。
没有将本阶段的组件接线描述为模型遵循规则或自主纠偏能力提升。

## 1. 基线、范围与 Git

实际分支：`codex/master-integration`。
修改前核验 HEAD 为 `dfe3f1b3d2d04569dede637f3021d993ad6d79e9`，工作区干净。
实现提交：`eb6f42c80867de8c18ef31ee7532538f64c17902`。
本报告及机器证据随后单独本地提交；报告提交的完整 SHA 见交付消息及 Git 历史，
避免在文件中声称记录自身提交哈希。

未修改 Master 核心阶段、统一 Skill、原生 DSH v2.1 Schema 或现有 Adapter。
对旧 Sidecar 的唯一行为扩展是显式选择的测试文件读取：`readFiles` 必须是
已授权 `writeFiles` 的子集，契约动作必须逐项一致。默认仍为旧的只写行为。
全局框架、Trace Plugin、Ledger 和 Preset 共 10 个既有文件的哈希均未改变。
无新依赖，无付费调用，无 SkillOpt，无 Push/Merge/Tag/Release。

修改文件清单：

- `adapters/dsh-session/README.md`、`authority.mjs`、`budget.mjs`、`file-tools.mjs`、
  `ingress.mjs`、`native-host.mjs`、`native-runtime-source-lock.json`、`router.mjs`。
- `adapters/dsh-runtime/bridge.mjs`。
- `scripts/dsh_session_wiring.cjs`、`tests/dsh_session.test.mjs`。
- `local-ci.ps1`、`docs/ci-cd.md`。
- 本报告与 `docs/reports/master-dsh-real-session-wiring-evidence.json`。

## 2. 实际安装与接口调查

只读调查实际安装：
`D:\tongk\Deeoseek Harness work\Deepseek harness packages\DeepSeek Harness.exe`。
FileVersion 为 `0.2.0-rc.2`，ProductVersion 为 `0.2.0.0`。
安装包内 DSH 组件为 `0.2.0-rc.2`，Cordis 为 `4.0.4`，本机 Node 为 `26.8.1`。
真实组件探针使用安装的 Electron Node 模式和 `--expose-internals` 读取 app.asar。
源码锁记录九个实际入口文件版本与 SHA256；不是整个依赖树的签名保证。

已从安装源码核实并实际调用：

| 接口 | 本轮用途 |
| --- | --- |
| `await ctx.plugin(...)` | 固定七组件的 Cordis 装配及配置校验 |
| `ctx.agents.create({sessionId, meta, agentOptions, setup})` | 创建完整实际 Agent 和 Session |
| `agent.followup`、`agent.whenIdle` | 初始请求及独立验证消息进入实际 Agent inbox |
| `SessionStore.get`、`session/event` | 实际对象与提交事件身份核对 |
| `agent/pre-step` | 在 provider 请求准备前拒绝模型步骤 |
| `llm/stream` | 拒绝直接调用绕过 Agent；仅组件模式转发本地用量夹具 |
| `ToolRuntime.register/guard/execute`、`tools/result` | 实际工具边界及结果对象身份关联 |
| `FileSystemSkillProvider.list/get/dispose` | 隔离根发现与加载打包 Skill |
| `sessions.flush` | 等待本宿主监听器持久化并回读校验 |
| `handle.dispose`、`ctx.fiber.dispose` | 实际组件清理与最终快照 |

未使用标准 Headless/Preset 路径：当前标准 headless 不装配 Master Preset，
不能将它当成已接通的 Master 会话入口。这里的 JSON Profile 是固定宿主装配输入，
不冒充原生 CLI Profile 格式。没有修改或加载当前全局用户 Preset。
`agents.resume` 依赖持久化后端，本轮未挂载原生 JSONL 后端、未验收恢复。
事件身份检查使用的 `Session.eventAt` 在当前版本已弃用，升级时必须重新审查。

## 3. Agent、Skill 与 Adapter 接线

固定装配 SystemPrompt、SessionStore、SessionProjectionRegistry、ToolRuntime、
LlmRuntime、AgentRegistry、AgentLoop。不开凭据服务、付费 provider、网络网关、
shell、PTC 或子 Agent 工具。工具及 Agent 并行配置为 1。

实际 Skill Provider 仅查看 `.local` 中隔离打包目录，关闭默认根与监听。
校验 `source-lock.json` 的规范源哈希、包内文件哈希以及统一 `modules.json`。
统一入口与必需模块 **01、05、07、08** 被加入实际 Agent 作用域的 SystemPrompt；
实际 assemble 事件记录 section 名称与哈希。此证据说明规则确实到达装配层，
不说明任何模型已经理解或遵循规则。

Router 仅接收现有 `master_output_contract.v1`，复用旧 `prepareExecution`
和现有 v2.1 Adapter、原生 L1/L2，没有新契约标准。模型输出捕获要求实际
Session 的规范 assistant 事件身份；声明与执行事实分开。该模型捕获分支尚无真实
模型输出验收。本轮正例使用明确标记的测试控制器契约，经私有宿主能力投影进入
原 Adapter，实际返回 READY 且原生 L1/L2 passed，`executionAuthorized` 仍为 false。
BLOCKED、INVALID、缺失任务模型、范围不一致均不能产生可执行许可。

## 4. 用户来源与授权生命周期

实现私有 `127.0.0.1` POST `/operator` 通道，不声称存在新的 DSH RPC。
宿主启动时创建内存中的 256-bit bearer capability，仅实际交互 TTY 才能登记
operator 并在该终端显示凭据。非交互启动不能冒充真人；本轮未执行真人登记。
日志只记录来源、请求 ID 与 principal 哈希，不保存 bearer、原始账户信息或密钥。
本通道依赖可信本地启动器，不防御相同操作系统用户下任意恶意进程。

通道绑定实际 Session 对象、Task ID、五分钟有效期、唯一 request ID；
认证后签发不可序列化的私有 proof，绑定原始 action 与深拷贝 payload。
模型、工具、普通文件或 `trusted:true` 均不能创建 proof。
组件控制器签名与 operator 签名分离，生产入口无法使用测试签名器。
本轮 HTTP 正例来自组件控制器，不能作为真实用户同意的证据。

`message` 进入真实 Agent inbox；`budget` 批准显式 provider/model/goal/config，
不产生工具权限；`confirm` 另行绑定目标、完整契约哈希、动作、禁令、风险范围、
任务与会话；`revoke` 撤销该会话授权并停止预算。
授权支持过期、撤销、Session close 与同范围复用。仅 nextAction 等非范围字段变化
可以在范围哈希一致时重绑定并留下审计；改变范围不能复用旧授权。
确认和重试不能重新初始化累计预算。

## 5. 累计预算与仍然关闭的真实调用

BudgetLedger 在宿主同步保留并发余量，要求明确填写最大调用数、会话数、步骤数、
累计输入/输出 Token、费用与时间。请求保留输入/输出上界及整数 micro-unit
费用上界，用量结算包含 cache 计数；不存在只设置单次 `maxTokens` 的替代。
未知或不一致用量按保留上界记账并停止；提供方超出上界则记录实际观察并停止。
到限后拒绝新请求与工具，时间到限发出 AbortSignal；已发生的证据保留。
费用使用经显式批准的保守费率上界，`actualBilledCost` 保持 null，不伪造账单。

真实 provider 完全未挂载，`agent/pre-step` 无条件拒绝，直接 `llm/stream` 也拒绝。
原因是某些 `prepareCall` 可在 stream hook 之前发生网络准备，单靠后者不能证明
绝不计费。下一阶段必须先审查真实 provider 的准备、用量、缓存价格、请求上界和
取消语义，然后才考虑开 gate。发现 API Key 不构成费用批准。

生成的 `budget-authorization.template.json` 所有限额、模型与价格为 null 或未批准；
这是配置入口而非默认授权。本轮真实调用数 **0**、provider 请求 **0**、费用 **0**。
唯一的本地 LlmAdapter 夹具没有推理或网络，仅返回输入 1／输出 1 的模拟用量。
夹具预算记录调用 1、Session 1、步骤 3、Token 余量 199／199、`TEST` 上界扣记 2、
剩余 998、pending 0，最终停止原因 `host_closed`。这些数值不代表真实货币消费。

## 6. 实际工具边界与隔离限制

真实 ToolRuntime 的 `guard` 核对实际 Agent、明确 write/read、参数、预算、
路径能力、活跃授权、Adapter candidate 和单轮写入许可。
组件测试实际创建 `hello.txt`，写入 `hello master` 并读取一致内容；无执行确认时，
即使已有预算仍拒绝。撤销后读也拒绝。其他工具服务未挂载，未知 shell 工具被拒绝。

文件能力只允许平面安全文件名、明确作用域、最多 4096 bytes、小型普通单链接文件、
独占创建和同步落盘。拒绝路径遍历、绝对路径、ADS、Windows 保留名、符号/硬链接、
未授权覆盖和删除。真实 junction 与硬链接负例已执行。
这些检查不能消除 Windows 目录替换和检查/使用之间的竞态，文件 mode 也不是 ACL。
因此 **不是操作系统沙箱**，生产模式始终拒绝工具执行，不能据组件正例宣称生产写入安全。

## 7. Trace、独立验证与证据来源

实际 Session 提交事件、宿主控制器请求、实际 Runtime 工具结果、模型声明与 Mock
用量事件分别标记。工具 Call ID 唯一，核对实际 Agent 与 `tools/result` 返回对象
身份；组件测试请求 8、实际结果 8、违规 0。prepare 请求 1、结果 1。
这不是模型生成的 Tool Call，也没有伪造 Session 工具事件。对账成功仍标记
`goalAcceptance:not_evaluated`，不冒充最终真实模型目标验收。

旧 Sidecar 的独立文件检查返回实际 Agent inbox 的 system 来源消息，包含结果与
`goalCompleted:false`；后续 Agent 步骤仍被阻断，未验证模型后续决策。
`sessions.flush` 等待宿主 sidecar 写入并回读 SHA256，清理后另存最终事件快照。
prepare 实际 Session 事件 4 条，组件测试 8 条。原始证据存于下述隔离输出目录，
机器摘要记录 flush 文件路径及哈希，未用未完成写盘的 trace 宣称成功。

## 8. 验证结果与复现

| 层次 | 结果 | 实际范围 |
| --- | --- | --- |
| Adapter | 37/37 | 既有正反例；另对实际未修改框架运行 |
| Runtime | 30/30 | 既有 Mock 闭环、丢失结果、残缺 trace、错误完成负例 |
| 新宿主测试 | 44/44 | 授权、HTTP 来源、预算、并发、时间、链接、权限、Adapter |
| 联合 Node 测试 | 111/111 | 上述三套，无失败/跳过 |
| Local CI | 17/17 | 含新宿主测试，非实际模型测试 |
| Pester | 75/75 | 既有契约回归 |
| Python Skill | 10/10 | 入口、依赖闭包、打包、自包含和来源锁 |
| Schema 与示例 | 12 / 38 | 全部通过 |
| 实际 DSH prepare | 8/8 | 完整 Agent、规则装配、所有关闭闸门、flush、对账 |
| 实际 DSH component | 21/21 | 另含实际 Adapter、真实工具 IO、HTTP 控制器及 Mock 用量 |
| 真实模型 / 自主纠偏 | 未执行 | Level 2 / Level 3 BLOCKED |
| 真实用户确认 / 生产写入 | 未验收 | 未登记真人，生产 Guard 保持关闭 |

实际执行的普通检查：

```powershell
$env:MASTER_DSH_FRAMEWORK = 'C:\Users\tongk\.dsh\skills\master-orchestrator\framework'
node --test tests/dsh_adapter.test.mjs tests/dsh_runtime.test.mjs tests/dsh_session.test.mjs
./local-ci.ps1 -OutputReport
python tests/test_master_skill.py
python ../validate_all_schemas.py
./scripts/check_encoding.ps1
git diff --check
```

CI 内运行模板、task-analysis、其余契约校验、离线 prompt eval、Skill 检查及 Pester。
实际 DSH 探针按 `adapters/dsh-session/README.md` 的 Electron 启动说明执行，
使用同一个打包 Skill 隔离根，模式为 `--prepare` 与 `--component-test`。
未运行 `--serve-gated`，未发起付费或真实模型试验。云端 Node 22 CI 未在本轮执行。

本轮实际失败/修复循环 **1 轮**：首次原生探针将包内 `references/prompts` 路径误当
规范源路径，出现 ENOENT。修复为使用规范 manifest 校验 source-lock 后，保留首次
stderr，重跑装配成功；最终完整回归通过。未删除断言或放松规范。

原始证据位置（本机 `.local` 保留，未纳入版本控制）：

- `.local/dsh-session-delivery-20261015-prepare/verification.json`。
- `.local/dsh-session-delivery-20261015-component-test/verification.json`。
- 各目录的 `session-flush-*.json`、`session-final-sidecar.json`、Profile、预算模板与计划。
- `.local/dsh-session-wiring-investigation/final-unit.tap`、`final-ci.log`。
- `.local/dsh-session-wiring-investigation/native-first.stderr`（首次失败记录）。
- `.local/schema-validation.json`、`local-ci-report.json`。

可提交机器摘要：`docs/reports/master-dsh-real-session-wiring-evidence.json`。
记录测试、原始证据哈希、代码提交、源码锁、实际检查项、来源分类、预算和阻断原因。

## 9. 下一轮条件与授权项

先完成上述两项工程缺口及相应负例验收，才能考虑 READY_FOR_AUTHORIZED_PILOT。
不因用户提供预算而跳过工程准入。
之后一次最小试验需要用户明确指定或批准：

- 实际提供方、模型及可信凭据使用方式。
- 最大调用、Session、步骤、累计输入/输出 Token、运行时间及费用上限。
- 币种、包含缓存/额外费用的价格或预先批准的保守上界，以及每请求输入/输出上界。
- 精确目标、隔离 Workspace、仅 `hello.txt` 创建/读取的动作范围、禁止动作与风险边界。
- 活跃会话、任务、授权有效期及撤销方式，经真实 operator 通道提交。

最小任务已准备但未执行真实模型：创建 `hello.txt`、写入 `hello master`、读取并独立
确认完全一致。必须同时具备真实模型轨迹、Adapter L1/L2、真实用户授权、受限真实
工具、已落盘可对账 trace、独立验证和实际预算记录，才能给该试验最终 PASS。
复杂目标偏移、真实模型自主纠偏及 SkillOpt 继续留待独立任务。
