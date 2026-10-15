# Master × DSH Provider 受控接入与试验预备

日期：2026-10-15（Asia/Shanghai）。本轮判定：**PROVIDER_OFFLINE_PASS**。

实际安装的 DSH LlmRuntime 已接入受控 Adapter 边界，38 项无网络正反例通过，
完整 Agent 也经过授权、准备、预算预留、假 Provider、用量结算和 Session 事件。
这是实际 DSH 接口与无网络 Provider 的工程验收，不是收费服务的验收。
生产网络 Provider 仍拒绝准入，Windows 隔离状态为 **CONDITIONAL_NOT_READY**。
真实试验仍 **BLOCKED**，Level 2、Level 3 均保持 BLOCKED。

实际模型调用 **0**，真实 Provider 网络请求 **0**，收费调用 **0**，实际费用 **0**。
未读取、复制、输出 API Key，未安装依赖或虚拟机，未更改全局 DSH、核心 Prompt、
Schema、生命周期、既有 Adapter 或 Sidecar，未启动 SkillOpt，未推送或发布。

## 1. 基线与本地提交

初始实际分支 `codex/master-integration`，HEAD
`a22d5d367754b6fd331bec9b1ea08b3768cebed3`，工作区干净，修改前已汇报。
实现提交完整 SHA：`a61dfce6d89c4134a01d7812798ce87056faaf81`。
本报告及机器证据随后单独本地提交，报告提交自身完整 SHA 见最终交付消息和 Git 历史。

变更仅涉及：`adapters/dsh-session/controlled-provider.mjs`、`native-host.mjs`、
`README.md`，`scripts/dsh_provider_probe.cjs`，`tests/provider-cases.mjs`、
`tests/dsh_provider.test.mjs`，`local-ci.ps1`、`docs/ci-cd.md` 及本报告和机器证据。
原 BudgetLedger、HostAuthority、Adapter 和 Sidecar 继续复用，没有第二个账本或 Runtime。
既有全局框架与 Preset 的 10 个锁定文件哈希全部保持不变。

## 2. 实际源码依据与调用顺序

读取当前实际安装 app.asar 内的源码，未依赖旧报告推断接口。
安装位置：`D:\tongk\Deeoseek Harness work\Deepseek harness packages`。
DSH `0.2.0-rc.2`、Cordis `4.0.4`；本机 Node `26.8.1`。
14 个相关模块的当前源码路径、版本和 SHA256 记录在机器证据 `nativeSources`。
源码摘取保留于 `.local/dsh-provider-investigation/`，未加载实际凭据服务或收费插件。

下表行号相对于实际包的 `lib/index.js`：

| 模块与位置 | 已核实事实 |
| --- | --- |
| dsh-agent-loop：904、1036–1072、1162–1190 | pre-step 后进入 step；prepareRequest 先调用 llm.prepareCall，再 buildRequest、prepared.stream |
| dsh-llm：1833、2203–2233 | registerAdapter 注册路由；prepareCall 先调用 adapter.prepareCall，绑定 registration 并返回一次性句柄 |
| dsh-llm：2283–2371 | direct stream 也能触发 adapter.prepareCall；llm/stream 包裹流派发，异常可归一化为 error/aborted finish chunk |
| dsh-llm-deepseek：2094–2106 | 当前 resolveModel/prepareCall 读取连接配置和模型元数据，绑定该连接；此实现不是 HTTP 请求 |
| dsh-llm-deepseek：2146–2212 | prepareImages、鉴权、Files API、扩展准备均先于 messages fetch；Files 失败恢复可内部重试 |
| dsh-llm-deepseek：1706、1808、1993 | 使用 max_tokens；usage 映射输入、输出、缓存读写并计算总量 |
| dsh-llm-pi-ai：1810–1881、2313 | 固定配置快照，streamSimple 延迟调用实际服务；另有模型发现 fetch |
| dsh-llm-retry | agent/request-error 可请求再次尝试，normal/always 策略不同；本宿主未挂载此插件 |
| dsh-token-meter：7–16 | 文本默认按 CHARS_PER_TOKEN=4 的 heuristic 估计，不是收费 Token 的硬上界证明 |

原生实际顺序：

```text
Agent inbox / SystemPrompt assemble
  → agent/pre-step
  → agent/request / provider-model 选择
  → LlmRuntime.prepareCall → adapter.prepareCall
  → SystemPrompt/用户输入提交、buildRequest
  → prepared.stream → llm/stream
  → Adapter 流准备、鉴权/附件/扩展、网络派发
  → Usage/finish → assistant/message / step/end / turn/end
```

因此 `llm/stream` 不能覆盖此前的所有准备路径。当前 DeepSeek 的 prepareCall
本身只做本地准备，但扩展、模型发现、其他 Adapter 或未来版本不能据此推定安全。
账户发现可能解析账户 Token，pi-ai 发现会 fetch；这些插件和入口均未挂载。
内置 title、compaction、重试等可能带来额外调用的服务也未加入固定宿主。

## 3. 最小受控接入点

新增 `controlledProvider` 是原生 LlmAdapter 的薄装饰器，底层 delegate 不注册、
不暴露给 Agent。注册的只有受控对象，其 list/resolve/prepare 仅使用本地元数据。
实际底层 prepareCall 延迟到完整请求可见时执行，顺序如下：

```text
原生 prepareCall → 受控 Adapter 本地元数据（底层未接触）
  → 原生 buildRequest / llm stream / 受控 stream
  → 快照完整请求，绑定 live Session/provider/model/policy hash
  → 价格有效性、输入/输出上界、已有 pending 预算检查
  → 原 BudgetLedger.step + 原子 reserve
  → 再查撤销/过期/AbortSignal
  → 底层 prepareCall（首次可能有外部副作用的位置）
  → 再查路由及授权 → 底层 stream（强制 maxTokens）
  → 流中检查取消和活跃授权 → settle → 宿主审计与原生 Session
```

直接调用实际 `llm.stream`、先准备后撤销、绕过 AgentLoop 及错误 Session/路由的
路径均经过同一边界。metadata 默认不提供输出上限，调用者必须显式提供有效 maxTokens。
Policy 哈希写入现有 budgetConfig，并由 HostAuthority 的私有授权能力绑定。
普通 JSON approved 字段不能产生该能力，确认/重试不能清空累计账本。
实际宿主只允许组件模式安装这个无网络 route，生产 Agent 仍在 pre-step 阻断。

**真实网络准入没有开关捷径**：当前仅接受 `transport:offline-fixture` 且
`networkAllowed:false`，把配置改成 network/approved 不会放行。
这完成了实际调用接口的受控准备/派发结构；没有声称 DeepSeek 收费 delegate
已经获得真实网络、Token 或账单行为验收。后者需要额外的具体路由审查。
可信启动器仍是边界的一部分；允许任意代码修改同进程 registry 并不在威胁模型内。

## 4. Token 与上下文上界

完整请求快照包含 system prompt/Skill、用户消息、历史上下文、工具结果、工具定义
及 toolHistory。副本在 await 前固定，避免调用者在预检后扩大请求。
本轮只支持 text；图片、文件及 replay 状态拒绝，避免隐含上传、读取和未知计费。

无网络夹具协议定义输入上界为完整 JSON UTF-8 字节数加固定 framing allowance，
并另外保留整个已批准单次输入上限。此定义仅用于夹具协议，不是任意真实模型的
Tokenizer 公式；现有 DSH heuristic 也不能替代收费输入上界。
上下文与输入/输出上界必须为正安全整数且总和不超过声明 contextWindow。
实际调用 maxTokens 不得缺失或大于单次输出上限，并原样传到 delegate。

完整 Agent 探针实际测得夹具输入上界 43131，预留输入 200000、输出 20，
随后底层 prepare 与 stream 各 1 次。所有数值明确为组件测试数据，不是用户批准。
真实提供方还需证明序列化、协议附加项、思考 Token、缓存及服务端 max_tokens
语义；当前不具备依据，故真实 route 保持阻断。

## 5. 价格、缓存与结算

策略要求 exact provider/model、币种、`micro-per-token` 单位、来源、版本、有效起止日，
输入/输出/缓存命中/缓存写入费率，以及其他收费项目的明确说明。
全部费率为十进制整数字符串，金额通过现有 Ledger 的 BigInt 计算。
输入保守费率必须至少覆盖普通输入、缓存读、缓存写三者的最大值；输出也须覆盖。
未知价格、过期、币种/模型/单位不匹配或未覆盖费率时，在底层准备前拒绝。

缓存 usage 按已核实的 DSH 分项语义计入累计输入；提供方若采用不同的包含关系，
必须专门转换，不可套用。预留费用上界、报告 usage、本地保守上界扣记和最终账单
分别记录。当前 `actualBilledCost:null`，不能把本地上界当最终账单。

本轮所有价格来源为明确标注的 deterministic fixture，币种 `TEST`，无真实服务
价格或用户费用限额。完整 Agent 夹具输入 10、输出 0，上界扣记 30 TEST micro-units，
余量输入 399990、输出 40、费用 1200050，pending 0；这不是实际付费。
正常缓存分项案例输入合计 13、输出 5，上界扣记 49。

## 6. 取消、异常、重试与并发

所有 delegate 准备和派发都收到融合的用户信号及 Ledger deadline 信号。
假 Provider 的准备等待和流读取等待均实际观察到 abort，并退出；不能把这个证据
推广成远端收费已停止。撤销/过期在准备后及流中再次核查。

正常结算释放 pending 并记实际报告用量；缺失/重复/矛盾 usage、流提前关闭、用户取消、
超时、准备或流异常，即使已有较小的部分 usage，也以完整预留上界结算并停止后续调用。
一般夹具的未知请求保留输入 1000、输出 20、费用 3040 TEST micro-units。
超出预留的 usage 保留观察数值，保守记账并停止，不掩盖超额。

并发检查和 reserve 同步完成，包含所有 pending；不会各自消费相同剩余预算。
已准入的一步不会因后续重查又被算作下一步；下一次请求必须重新 step/reserve。
没有重试循环，公开的显式再次调用也重新准入，出错后 Ledger 停止。
策略拒绝内部重试数不为 0 的 delegate，注册 retry policy 为 maxRetries 0。
真实 DeepSeek 附件恢复内部重试不符合此要求，因此未挂载收费 delegate。

## 7. 无费用验证与证据

38 个共享用例分别经过普通 Node 装饰器单元入口，以及实际安装的 DSH LlmRuntime。
覆盖未授权、未知/过期/错价、cache 费率遗漏、network 配置伪放行、隐藏重试、
准备前预留、direct stream、全输入及附件、缺失/超大输出上限、各项累计预算、并发、
正常/缺失/超界/不一致/重复 usage、准备/流/terminal 错误、部分流、用户取消、
准备/读取超时、撤销与旧句柄、Session/provider/model 变化、delegate 路由变化、
显式再次调用、consumer 提前关闭及步骤到限。
机器摘要逐项记录调用、预留、结算、余量和停止原因，原始报告保存完整 audit。

完整 Agent 另创建真实 Cordis/DSH Session，实际加载统一 Skill 必需模块，
未授权消息阻断后，通过原私有 HTTP 控制器 budget 能力进入假 Provider。
Session 实际记录 request/header、request/context、assistant/message、step/end、turn/end，
最后等待 sidecar flush。假输出无推理内容，没有借此宣称 Master 能力或目标完成。
这依旧是控制器授权，未登记真实用户；未实现原生 JSONL resume。

Probe 进程拒绝 fetch/HTTPS/TLS/UDP 及非 loopback socket，HTTP 只允许私有
`/operator` 授权连接；实际 Provider 网络尝试观察数为 0。
真实 delegate 根本未加载，且装饰器拒绝 network policy，是本轮无费用的主要保证。
该 Node 进程限制不是通用操作系统防火墙，也不保证未审查的 SDK 无旁路。

| 检查 | 结果 |
| --- | --- |
| Adapter / Runtime / Session 既有 Node | 37 / 30 / 44 全通过 |
| 新 Provider Node | 38/38 |
| 联合 Node | 149/149，无失败或跳过 |
| Local CI | 18/18 |
| Pester / Python Skill | 75/75、10/10 |
| Schema / 示例与内嵌记录 | 12 个 / 38 条，全通过 |
| 实际 DSH Provider 接口 | 38/38，无网络夹具 |
| 完整 Agent + 假 Provider | PASS，prepare 1、dispatch 1、无真实模型 |
| 原实际 DSH prepare / component 回归 | 8/8、21/21 |
| Git diff、编码、全局 10 文件哈希 | 通过、未改变 |
| 云端 Node 22 / 真实收费服务 / 客体 DSH | 未执行，不能据本机测试声称通过 |

实际执行：`node --test tests/dsh_adapter.test.mjs tests/dsh_runtime.test.mjs tests/dsh_session.test.mjs tests/dsh_provider.test.mjs`、
`./local-ci.ps1 -OutputReport`、`python tests/test_master_skill.py`、
`python ../validate_all_schemas.py`、`./scripts/check_encoding.ps1`、`git diff --check`。
另使用安装的 Electron Node 模式运行 `scripts/dsh_provider_probe.cjs`，
并重跑 `scripts/dsh_session_wiring.cjs` 的 prepare 和 component-test。
CI 含既有模板、task-analysis、离线 prompt eval、其他契约检查及 Pester。

修复共 **2 轮**，未删除或削弱失败断言：第一轮实际 LlmRuntime 会用 metadata
defaultMaxTokens 补齐缺失上限，移除该默认值后原负例通过；第二轮步骤到限在 reserve
之后重复使用新请求准入检查，修正为后续重查授权/价格/取消、而非重复申请步骤。
最终上述全量检查通过。首轮及第二轮失败 stderr 保留。

机器证据：`docs/reports/master-dsh-provider-safety-evidence.json`。
原始 Provider 报告：`.local/dsh-provider-final-20261015-provider/verification.json`。
实际会话回归：`.local/dsh-provider-final-20261015-prepare/`、
`.local/dsh-provider-final-20261015-component-test/`。
日志、源码摘取和 Windows 清单：`.local/dsh-provider-investigation/`。
源码、实现文件、原始报告、日志与 flush 的 SHA256 均记录在机器摘要。

## 8. Windows 隔离可行性（单独判定）

状态：**CONDITIONAL_NOT_READY**，本轮仅只读调查，未创建或启用任何 VM。

本机实测 Windows 11 专业版 x64，build 26200；AMD Ryzen 7 7745HX，
VirtualizationFirmwareEnabled=true，HypervisorPresent=true；内存约 31.3 GiB，
调查时可用约 9.1 GiB；C/D 可用空间约 695/741 GiB。
CIM 的 SLAT/VMMonitor 字段返回 false，但存在 hypervisor 时不能据此直接判断不支持。
微软说明此时系统不再展示常规 Hyper-V requirements。
[Hyper-V 要求与检测说明](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/host-hardware-requirements)。

未发现 vmms/vmcompute/hns 服务、Hyper-V PowerShell 模块、WindowsSandbox.exe、
常规安装位置/PATH/卸载登记中的 VirtualBox 或 VMware Workstation。
这不是对整台机器所有自定义路径的穷举。两个 Windows optional feature 的只读查询均
返回“请求的操作需要提升”，没有提高权限、启用组件或改变设置。
Windows 专业版属于 Sandbox/Hyper-V 支持范围，资源量提示有技术可行性；
实际功能、客体授权、可用运行配额和 DSH 客体兼容性仍未验收。

隔离方案比较：

| 方案 | 适用性与当前缺口 |
| --- | --- |
| 一次性 Hyper-V Windows VM | 更便于限定网络与 checkpoint/恢复；当前无可用管理组件证据，需另行批准并验证 |
| Windows Sandbox | 适合一次性桌面测试，关闭即丢弃；当前入口不存在，需启用和测试；不能当持久快照 VM |
| 既有第三方 VM | 常规位置未发现，不推断已有授权或安装；本轮不安装 |
| 当前临时目录 | 可继续无网络组件测试，不能替代真实写入所需 OS 隔离 |

微软说明 Sandbox 使用独立内核、主机软件不会自动在其中可用，关闭会丢弃状态。
所以安装包为 Windows 软件不足以证明 DSH 已能在客体运行。
[Sandbox 官方说明](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/)。
共享目录、剪贴板和默认网络必须分别审查；网络默认开启且可能暴露内网。
[Sandbox 配置说明](https://learn.microsoft.com/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file)。

下一阶段较合适的候选是一次性 Windows VM：不共享真实宿主目录，不启用剪贴板、
磁盘/设备重定向或不必要的集成；准备材料用受控只读介质导入后移除，工作区位于客体盘。
先无网络验证 DSH 和工具，再考虑经审查的 API-only 出站策略，禁止内网/宿主访问。
只使用独立、短期、低权限的试验凭据，不复制日常用户凭据或环境配置；账户级硬配额
须由具体服务确认。基线 checkpoint 在加入凭据之前创建；结束撤销凭据、导出经检查
证据并恢复/丢弃客体。VM 也不等于绝对安全，仍须验证共享/网络/逃逸风险边界。

管理员检查、组件启用、客体介质/许可确认、软件部署和桥接/网络设置均需下一阶段
明确授权。本轮没有执行这些动作。最小替代是现有无网络组件环境，生产文件写入继续关闭。

## 9. 真实试验的剩余条件

本轮的无网络调用基础已通过。真实试验仍需补齐，不能只提供预算便直接启用：

1. 选择具体 provider/model，审查其完整准备/网络路径、输入 Token 保守上界、服务端
   输出限制、缓存/附加费率、用量语义、内部重试、超时与取消；未覆盖的附件/扩展拒绝。
2. 以有版本和适用日的价格及经批准的上界制定预算，核实可用账户级额度。
   客户端 abort 和 maxTokens 不天然阻止服务端继续计算或追记费用；没有最终账单时保持 unknown。
3. 经授权建立并验收隔离环境，完成 DSH 客体启动、宿主文件不可达、禁用桥接、网络
   限制、凭据暴露、撤销、快照恢复和证据导出验证。
4. 用户经真实可信通道批准 provider/model、凭据使用方式、累计费用/Token、最大
   Session/调用/步骤/时间、单次输入/输出上界、精确文件范围和授权有效期。

预算模板继续保留 null/未批准值，不填虚构的已批准价格或额度。
最小试验计划仍是创建 `hello.txt`、写入 `hello master`、读取并独立验证一致；
需要真实模型会话、Adapter L1/L2、真实用户能力、受限工具、完整落盘对账和预算结算
全部成立才可验收。当前未执行该真实试验，未证明模型自主纠偏或 SkillOpt 就绪。
