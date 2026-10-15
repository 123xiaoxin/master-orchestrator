# 首次 DeepSeek 只读试验：计费边界与最终准入

日期：2026-10-15（Asia/Shanghai）。最终结论：**PARTIAL**。
真实模型／账户网络 Gate 继续 **BLOCKED**，未给出 ENGINEERING_READY_AUTHORIZATION_PENDING。

已经完成本轮可独立落地的原始请求、Usage 假设、余额对账与授权审阅方案，未扩建
Provider SDK、预算账本、Master 核心或训练系统。没有发现并放行不受控收费路径；
当前不足是完整 Messages Token 上界和真实协议用量解释尚无充分依据，不能以人工
风险接受取代强制准入。真实请求、余额查询、费用均为 **0**，SkillOpt 未启动。

## 1. Git 与保护范围

初始实际分支 `codex/master-integration`，HEAD
`f080104a649d9f4109acd9ae49925099408458f7`，工作区干净，修改前已汇报。
本轮实现完整 SHA：`17308b2be14c8c146ef642667bcbb69df2481a7b`。
报告及证据另行本地提交，最终报告提交完整 SHA 见交付消息/Git 历史，文件不伪造自身哈希。

变更：`adapters/dsh-session/pilot-audit.mjs`、`pilot-authorization.template.json`、
`README.md`；`scripts/dsh_readonly_probe.cjs`；`tests/dsh_pilot_admission.test.mjs`；
`local-ci.ps1`、`docs/ci-cd.md`；本报告、授权单及机器证据。
既有 BudgetLedger、HostAuthority、Ingress、受控 Provider、原生宿主、核心 Prompt、
Schema、Adapter、Sidecar 和 18 条留出评测样本均未修改。
全局 DSH 框架/Trace/Preset 的 10 个锁定文件哈希未变，无依赖安装、VM、Push/Merge/发布。

## 2. 实际模型、源码与官方资料

继续唯一目标 `deepseek-official/deepseek-flash`，观察版本 DeepSeek‑V4.1‑Flash，
DSH 0.2.0-rc.2、Cordis 4.0.4，Messages endpoint
`https://api.deepseek.com/anthropic/v1/messages`。只读 text-only、thinking disabled。
实际 native DeepSeekAdapter 源码哈希仍为
`226e2047b843f954d8478207613f3e44448671c6f98f8edee77008d0fe005484`，探针启动前复核。

官方资料均于 2026-10-15 重新查询：

- [Token 说明与参考包](https://api-docs.deepseek.com/quick_start/token_usage/)。
- [模型、价格和高峰规则](https://api-docs.deepseek.com/quick_start/pricing/)。
- [缓存行为](https://api-docs.deepseek.com/guides/kv_cache/)。
- [Messages 兼容协议](https://api-docs.deepseek.com/guides/anthropic_api/)。
- [账户余额字段](https://api-docs.deepseek.com/api/get-user-balance/)。

公开文档查询及 CDN 参考包下载不是模型或账户请求。本轮没有向 API endpoint 发送请求，
未读取任何真实密钥。部分文档浏览工具超时后，Token 页面通过公开 HTML 成功读取；
没有以超时或旧报告推断新的服务端承诺。

## 3. 完整原生 Messages 请求

继续通过实际 DeepSeekAdapter 序列化，再于内存 fetch 替身获取**原始字符串**。
审计不重新拼造近似 body；字节数与 SHA256 均基于实际字符串。
请求有 model、stream、messages、max_tokens、thinking、system，没有其他未审查字段。
system 包含统一入口及 01/05/07/08/06；正文只含 user/assistant text blocks。
无工具、文件、图片、思考历史、动态扩展或实际认证内容输出。

| 字段 | 第一轮 | 第二轮 |
| --- | --- | --- |
| 序列化 UTF-8 bytes | 46273 | 46480 |
| system bytes | 44683 | 44683 |
| 消息角色 | user | user → assistant → user |
| max_tokens | 256（夹具值，未批准） | 256（夹具值，未批准） |
| thinking / stream | disabled / true | disabled / true |
| 粗略文本 Token 估计 | 10726 | 10744 |
| 未纳入字符比例估计的字符 | 752 | 755 |

system SHA256 两轮均为
`83f3ac65e18b216106fdb7f68eda33ba9214a64b6d998d87e65214696d194970`。
第二轮保留第一轮消息前缀，再增加实际 Mock 回复及用户补充；system 未重复进入消息体。
来源模块、assembly、原始 body 与审计哈希记录在机器证据。所有文本都是合成数据。

## 4. Tokenizer 研究与预算边界

实际 Token 页面链接的文件是
`https://cdn.deepseek.com/api-docs/deepseek_v4_tokenizer.zip`，不是根据旧名称猜测下载地址。
参考包仅保存于 `.local/dsh-admission-investigation/`：1911504 bytes，SHA256
`e7310d1dafe0a86d8a5629fe78a7c763760f651db9b8682718a1781dcd6fe495`。
各成员大小和哈希另存，未向全局目录解压或执行下载的 Python。

包内有 128000 词表的 BPE、ByteLevel 预处理、chat_template。
示例依赖 transformers 并使用 trust_remote_code，演示仅 encode 纯文本；本机没有
transformers/tokenizers，本轮不安装。配置还保留 model_max_length=16384，与当前
服务声明 1M 不一致，因此不能把这个配置当当前 Messages 服务端模板和上限保证。
没有伪造“参考 Tokenizer 已运行”或“已得精确计费 Token”的证据。

审计粗估只应用官方约数：ASCII 字符×0.3、汉字×0.6，其他字符单列，不补任意倍数。
它覆盖 system 与全部消息文本，不覆盖角色模板、特殊 Token、服务端协议或版本差异；
不把 JSON 控制字段每个字节直接视为收费 Token。两轮粗估只用于比较输入变化。
`strictUpperBound`、`safetyMarginTokens` 保持 null，liveAdmission 始终 BLOCKED。
估算大于给定预算时可指出不足，估算小于预算不能据此放行。

最大上下文元数据 1048576 仅作风险参考：无法证明超长请求被拒绝前绝不收费，
也不能证明版本切换后计数不变。若采用整个上下文乘高峰普通输入费率的风险包络，
它也只能覆盖“服务按声明上下文与已知 Token 类别计费”的条件情景，不能提升为数学硬限额。
因此不添加未经证明的安全余量，不填写用户的真实金额。

## 5. 原始 SSE → Native Usage → Ledger

真实源码 `updateUsage` 按字段替换累计值，缺失字段跳过；初始化 input/output 为 0。
message_start 和 message_delta 都可能更新，message_stop 才合成最终 usage；
原生 total = input + output + cache read + cache creation。
本轮保留原始 SSE 字段及是否出现，避免原生缺失默认零掩盖未知消耗。

新增纯审计函数 `auditRawUsage`：

- 更新是覆盖，不把多个累计帧相加；缺失与零值分开。
- 对重复 start/stop、负值、缺少 input/output 或矛盾 total 拒绝映射。
- `disjoint` 假设：原 input 是未缓存部分，读写缓存另外计入。
- `input-includes-cache` 假设：原 input 已含缓存，先扣除缓存得到未缓存部分，再送旧 Ledger。
- 默认关系 unknown；无证据时 ledgerUsage=null，保留预留上界，不挑更便宜的解释。

离线例：raw input=10、cache read=2、write=3、output=5。
disjoint 总量为 20；inclusive 总量为 15。测试显式 total 可揭露重复计数。
同一输出累计帧 1、5、5 最终只计 5，不计 11。
原生双轮夹具 raw input=10、cache read=2、write=0、output=5，各轮 native total=17，
在明确声明的 disjoint 夹具假设下与映射一致；这不证明真实服务使用该假设。

官方缓存页说明命中是输入的一部分，并展示另一协议的 hit/miss 字段；它不能直接证明
Messages 的 input_tokens 包含关系。不能把 Chat/Responses 语义无条件套进 Messages。
目前原生 Mock 账本仍使用其显式夹具约定；新增审计不是已启用的生产 SSE 拦截器。
正式生产入口仍关闭，缺少真实映射证据是 PARTIAL 原因之一。

已测试 unknown 映射送入**原 BudgetLedger**：按完整预留输入/输出保守结算，
停止新请求，actualBilledCost=null。既有取消、异常、超界和重试限制保持不变。
记录区分 reservedCost、reportedUsage、estimatedCost 与 actualBilledCost；
无最终账单不能把本地上界或余额差写成实际费用。

## 6. 价格覆盖与风险清单

本次重新观察的 `deepseek-flash` 价格与上轮一致，USD／百万 Token：
高峰缓存输入 0.006、普通输入 0.30、输出 1.20；非高峰为其一半。
高峰为工作日 UTC 01–04、06–10，排除中国公共假日。预算只按高峰审查，不依赖优惠。
沿用观察值不等于延长既有策略有效期：2026-10-16 00:00 UTC 后必须重新核验。
别名不固定模型版本，当前观察不是永久承诺。

现有整数 micro-unit 上界向上取整输入/缓存至 1、输出至 2，覆盖已知普通输入和缓存
命中 Token 单价。缓存写入若只是普通输入类别可按普通输入覆盖；若另有操作收费或
未知叠加项，不能凭较高 Token 单价声称已经覆盖。尚未找到足以认证这点的 Messages
独立收费说明，记录残余风险并保持真实准入关闭。

| 风险 | 分类与控制 |
| --- | --- |
| 别名改版 | 残余风险；版本观察及 policy hash 绑定，变化重新准入 |
| 价格调整/过期 | 工程控制＋残余风险；高峰费率、版本/期限校验，执行前复核 |
| 输入估算偏差/模板未知 | 当前必须阻断；已量化字节/粗估，但没有硬上界 |
| 缓存命中差异 | 官方覆盖已知 hit/miss 价格；不依赖命中，Messages 包含关系仍待核实 |
| 缓存写入附加费 | 残余风险；不能证明覆盖的独立项目不得放行 |
| 思考输出/其他输出 | 工程关闭思考且 text-only；真实服务计数仍须核实 |
| 模型错误或无 Usage | 工程控制；停止后续请求并保留预留占用，远端实际费用未知 |
| 客户端取消后继续处理 | 残余风险；Abort 不是退款，不能宣称服务端停止计费 |
| 自动重试 | 工程控制；retry 0，无恢复插件，每次显式重试重新准入 |
| 网络断开请求未知 | 工程控制＋残余风险；停止、保留占用、等待对账 |
| 多轮累计/并发 | 工程控制；同一 Ledger、同步 reserve、会话/调用/步骤/时间限制 |
| 共享账户其他消费 | 残余风险；余额不可直接归属，独立核对，不伪造账单 |

本地可强制的是准入与停止新请求，不是远端退款或绝对消费硬顶。
风险接受不能解除认证、已审查路由、只读、未知模型和预算等强制闸门。

## 7. 余额查询与差异核对方案

只读研究 `GET https://api.deepseek.com/user/balance` 文档，未请求该地址。
官方返回 is_available、balance_infos，后者包含 currency（USD/CNY）、total_balance、
granted_balance、topped_up_balance，金额为字符串。is_available 表示余额是否足够，
不是特定试验的预算能力或实时硬配额。

`balanceSnapshot` 对离线响应要求指定币种、时间和脱敏账户 scope；精确到整数 nano-unit，
不使用浮点，不做隐式汇兑，核对赠款与充值之和。缺字段、币种不匹配或金额不一致拒绝。
`reconcileBalances` 记录余额差、本地估算差异、其他活动与结算状态，始终保留
actualBilledCost=null 和 PENDING_ATTRIBUTION。缺快照为 PENDING。
模拟其他进程消费的差异已测试，不将差额自动归到试验。

经另行明确授权后的候选流程：真实 Operator → 前余额快照 → 预算复核 → 有限请求
→ Usage/Ledger/停止原因 → 后余额快照 → 延迟结算及其他消费排查 → 费用报告与语义评审。
赠款过期、充值、共享请求与结算延迟均影响差值。余额查询不是请求级账单或硬限额。
未发现可在本轮官方资料中确证的独立硬配额 API，不添加虚构接口或自动更改账户。

## 8. Operator 与正式授权预备

复核原实现：只有实际交互 stdin/stdout TTY 可以登记 operator，capability 随机生成，
只显示于该可信终端，五分钟有效；请求绑定实际 Session/Task、request ID 和原 payload。
非交互进程/测试签名器不能冒充正式 Operator，角色 JSON 不等于身份。
这是可信启动器和本地账户边界，不对抗同用户任意恶意代码；TTY 本身也不等于用户批准。
本轮没有真人登记，不把组件通过写为正式授权通过。

HostAuthority 将 provider/model/goal/budgetConfig hash 及 generation、期限绑定；
config hash 可以包含价格、模型观察、风险策略哈希及请求/费用/并发等上限。
撤销、过期、Session close 使旧能力失效，宿主停止 Ledger；确认和重试不重置预算。
现有认证、伪造、撤销、过期、换模型、同范围复用及生命周期负例全部回归通过。

新增 `pilot-authorization.template.json` 仅为审阅数据：approved=false、executable=false，
所有正式额度 null、余额查询 false，无凭据或永久批准。它不是新授权协议，不能提交为
普通 JSON 后直接联网。用户可阅读 `first-readonly-pilot-authorization.md`，明确区分预计
与最高批准费用。暂不提供正式运行命令，避免把文件创建当成授权或绕过当前阻断。

## 9. 试验范围、证据与回归

候选只有一个会话、两轮合成文本，用于区分明确/模糊目标以及补充后的修订，次数也待批准。
18 条样本、split、语义评审规范未改，不训练、不进行文件实验或自主纠偏。
正式证据应绑定输入/回复来源、Session/Task、模块/协议/模型版本、原始请求与响应、
Token、Ledger、停止原因、Transcript hash 和独立人工评审；当前语义结果仍 NOT_RUN。

| 检查 | 结果 |
| --- | --- |
| Adapter / Runtime / Session / Provider / Readonly | 37 / 30 / 44 / 38 / 25 全通过 |
| 新审计用例 | 22/22 |
| 联合 Node | 196/196，无失败/跳过 |
| Local CI / Pester / Python | 20/20、75/75、10/10 |
| Schema 与示例 | 12 个 / 38 条，全通过 |
| 原生只读双轮及审计 | 22/22，Mock fetch，无真实收费请求 |
| 原生 Provider / 完整假 Provider Agent | 38/38、PASS |
| 原生 prepare / component | 8/8、21/21 |
| 编码、Diff、来源哈希 | 通过，保护源未改 |
| 修复轮次 | 0；首轮新增单测及原生探针即通过 |

实际执行六套 `node --test`、`./local-ci.ps1 -OutputReport`、
`python tests/test_master_skill.py`、`python ../validate_all_schemas.py`、
`./scripts/check_encoding.ps1`、`git diff --check`。CI 内执行全部模板、task-analysis、
契约、离线 prompt 定义和 Pester。另由安装的 Electron Node 运行 native readonly、
provider、prepare 和 component 探针。云端 CI 未运行，不声称已验证云端环境。

原始证据 `.local/dsh-admission-native-first/verification.json` 含原始序列化字符串、
SSE 夹具及审计；`.local/dsh-admission-investigation/` 含 Tokenizer 来源、哈希和回归日志。
可提交机器摘要为 `docs/reports/master-dsh-readonly-pilot-admission-evidence.json`。
公开参考材料与所有审计文件均在隔离目录，未涉及真实业务数据或凭据。

## 10. 最终回答

**当前尚不具备仅由用户批准模型、额度和风险便立即开展真实试验的全部工程条件。**
PARTIAL 的精确剩余项是：完整 Messages 输入的可执行预算依据，以及原始 Usage
映射与正式传输观察的证据绑定。它们不能靠风险勾选绕过。
远端取消、共享余额和结算差异则属于必须说明、保守保留占用并由用户审阅的残余风险。
本轮已经给出具体请求、假设测试和授权单，不继续扩展 Agent、安全平台或通用 SDK。
真实调用保持 0；下一次执行仍必须先解决强制闸门、重新核实价格，再取得一次性正式授权。
