# Master × DSH 单一 DeepSeek 只读意图会话准入

日期：2026-10-15，Asia/Shanghai。

离线验收：**READONLY_OFFLINE_PASS**。
真实只读试验准入：**BLOCKED**，不是 READY_FOR_AUTHORIZED_READONLY_PILOT。

已完成单一模型代码适配、真实 DSH 请求序列化/流解析、只读宿主、双轮 Mock 回流、
独立语义评测入口与全量回归。真实模型调用 0，Provider 网络请求 0，收费请求 0，费用 0。
用户提供预算后仍不能直接启动真实试验：实际序列化请求的输入 Token 上界尚无可靠证明，
Messages 原始用量完整性/包含关系与远端取消、账户消费限制仍未验收。
Level 2、Level 3 均 BLOCKED；没有宣称模型理解、澄清或纠偏能力已经提高。

## 1. 基线、范围与提交

修改前实际分支 `codex/master-integration`，HEAD
`363d866a14f01e151935cc687c9248dbd87b2860`，工作区干净，已在修改前汇报。
本轮实现提交：`602f5a957303a74c214cdd3787de0b0993d1b423`。
报告与机器证据单独本地提交；报告提交的完整 SHA 在最终交付消息和 Git 历史中记录。

修改清单：`adapters/dsh-session/deepseek-readonly.mjs`、`controlled-provider.mjs`、
`native-host.mjs`、`README.md`；`evals/readonly-intent/README.md`、`review.mjs`、
`samples.json`；`scripts/dsh_readonly_probe.cjs`、`review_readonly_intent.mjs`；
`tests/dsh_readonly.test.mjs`；`local-ci.ps1`、`docs/ci-cd.md`；本报告与同名机器证据 JSON。

没有修改规范 Skill、Prompt、Schema、Adapter、原 Sidecar、旧评测数据或运行规则。
继续复用 BudgetLedger、HostAuthority、LlmRuntime 和真实 Agent，没有第二套预算或模型 SDK。
既有全局框架、Trace 和 Preset 共 10 个文件的来源哈希未改变。
未读凭据，未安装依赖，未部署 VM，未调用工具执行业务操作，未启动 SkillOpt，未 Push/Merge/发布。

## 2. 唯一模型目标与官方资料

| 项目 | 选择/观察 |
| --- | --- |
| Provider ID | `deepseek-official`，与现有 DSH API-key 路由一致；不加载该凭据插件 |
| Model ID | **`deepseek-flash`**，唯一适配目标 |
| 官方当前版本 | DeepSeek-V4.1-Flash；这是观察值，ID 不是不可变版本锁 |
| API | Messages，`https://api.deepseek.com/anthropic/v1/messages` |
| 模式 | thinking disabled / reasoning effort off，只允许文本 |
| 模型能力元数据 | context 1048576，最大输出 393216；不是用户批准的运行额度 |

官方价格页当前将 `deepseek-flash` 对应到 V4.1-Flash，旧 Flash ID 会重定向至该版本。
截至获取日 2026-10-15，USD／百万 Token 价格如下；本轮未取得任何费用批准：

| 类别 | 高峰 | 非高峰 |
| --- | --- | --- |
| 缓存命中输入 | 0.006 | 0.003 |
| 缓存未命中输入 | 0.30 | 0.15 |
| 输出 | 1.20 | 0.60 |

价格可能调整，代码记录来源和观察日期，测试策略有效期仅至 2026-10-16 00:00 UTC；
这不是提供方承诺的价格保留期。后续必须重新审查，不按本地目录或旧别名推断当前费率。
[官方模型与价格](https://api-docs.deepseek.com/quick_start/pricing/)。

官方 Anthropic 兼容说明支持 DeepSeek 模型、system、stream、max_tokens 与禁用 thinking，
cache_control 被忽略；本轮拒绝图片、附件、工具和扩展。
[官方 Messages 协议兼容说明](https://api-docs.deepseek.com/guides/anthropic_api/)。
官方 Models 接口说明 context_window 为输入输出总容量，max_output_tokens 为单响应上限；
文档示例提供上述上下文元数据。本轮只读文档，未携凭据请求 `/models`。
[模型元数据](https://api-docs.deepseek.com/api/list-models/)。
官方 Chat API 给出输出上限 384K（393216）；其规则不能替代未实测的 Messages 行为。
[输出参数说明](https://api-docs.deepseek.com/api/create-chat-completion/)。

## 3. 实际 DSH 适配与副作用前准入

实际安装仍为 DSH `0.2.0-rc.2`、Cordis `4.0.4`。
从当前 app.asar 读取并校验 `dsh-llm-deepseek/lib/index.js`，SHA256：
`226e2047b843f954d8478207613f3e44448671c6f98f8edee77008d0fe005484`。
使用其真实导出 `DeepSeekAdapter`、`resolveAdapterOptions`；不是自写 HTTP SDK。
它支持显式配置的模型目录；本轮通过真实序列化证明新 ID 可以进入该实现，
并不声称本地旧目录自动等于官方当前模型清单。

配置锁定 endpoint、唯一模型、text-only、thinking off、maxRetries 0，环境 resolver
为空，不读取 ambient base URL、密钥或账户配置。显式提供无扩展的 prepareExtensions，
不挂载附件、发现、账户、title、compaction、自动重试或动态加载服务。
测试鉴权只返回固定的 `OFFLINE-NOT-A-CREDENTIAL` 标记，绝不查询真实凭据。

```text
可信 ingress → 实际 Agent / Skill / Session
  → LlmRuntime.prepareCall → 受控本地 metadata（底层尚未接触）
  → 完整文本历史快照 / 精确模型 replay 来源核对与移除
  → scope、私有授权、Session/Task、价格有效性、类型、Token 上界、Abort 检查
  → 原 BudgetLedger step / 原子 reserve（包含 pending）
  → 再查授权和 Abort → 底层 DeepSeekAdapter.prepareCall
  → 底层 Messages 序列化 / 原生流解析 → usage / settle → 实际 Session
```

direct `llm.stream` 也进入相同装饰器，不靠 `llm/stream` 的事后拦截覆盖早期准备。
边界由模块内 WeakSet 识别，普通 JSON 不能声明自己是可信模型边界。
HostAuthority 私有 budget grant 绑定 provider/model/goal/config 和 policy hash，
实际 Session 对象及 Task 由原可信入口绑定。更换路由、失效授权或未批准价格拒绝。
输出必须显式 maxTokens；真实和测试策略均 `networkAllowed:false`，没有配置开关可直接启用。

原生回复带有 replay 状态：仅来源精确匹配本模型的 assistant 历史可以移除 replay，
再按文本检查；来源不符或包含工具/图片/思考内容则拒绝。
不携带未经审查的 provider replay 或隐藏扩展进入下轮。

## 4. Token、价格与结算边界

完整输入包含统一 Skill 的 system 文本、用户消息、历史回复和协议封装。
组件模式使用“完整 JSON UTF-8 字节数＋framing”的**测试协议**界限；真实模式
明确抛出未取得 certified input bound 的阻断，不能借测试公式发送真实请求。
官方给出的字符换算是估算用途，不能当预算硬上界。
[官方 Token 说明](https://api-docs.deepseek.com/quick_start/token_usage/)。

真实输入上界需精确 tokenizer/完整模板依据，或足够明确的提供方保证及经批准的
保守策略；不能用字符数÷4，也不能仅根据 contextWindow 假定异常请求一定不计费。
本轮没有下载 tokenizer、安装依赖或用收费请求补证。

费用仍由原 Ledger 的 BigInt 整数 micro-unit 表示。测试把高峰费率向上取整为
输入/缓存读写 1 USD micro-unit／Token，输出 2；这是保守本地价格策略示例，
不是最终费率、用户批准或实际账单。USD-per-million 原始观察值另存，未混淆单位。
cache 写入没有独立的明确价格证明，真实 Messages 包含关系仍须核实，因此不能放行。

实际 DSH translate 将 input、output、cacheRead、cacheWrite 相加产生 totalTokens。
它也会把缺失字段初始化成 0；新边界拒绝不可验证的零输入/零输出文本 usage，
即使这会拒绝某些合法的全缓存响应，也不会把缺失用量默认为免费。
此负例保护不能替代原始字段存在性和真实计费关系验收。

Ledger 区分预留费用上界、报告 usage、本地保守扣记和最终账单。
缺失、矛盾、重复用量、部分流、异常或取消保留完整占用并停止；超界保留观察并停止。
真实账单未知时 `actualBilledCost:null`，不将本地计算当账单。

原生双轮 Mock 各保留输入 200000／输出 256；测试测得输入界限 46478、46905。
Mock 最终报告输入合计 24（含 cache）、输出 10、本地扣记 44 USD micro-units，
pending 0，余量输入 599976、输出 758、费用 601492，关闭原因 host_closed。
这些是无收费测试账本数值；真实费用仍为 0，不能将 44 解释成已支付费用。

## 5. 取消、重试和残余风险

继续复用 provider 负例：准备期间取消、流读取取消、用户撤销、运行时间到限、错误、
部分内容、缺失/超界 usage、并发与再次请求均检查预算并保守结算。
信号融合至原生 Adapter；native source 将其传入 watchdog 与 fetch，源代码路径已核实。
此前假 Provider 的取消观察不能证明 DeepSeek 服务端停止计费。本轮也没有此实证。

无网络模式实际替换 fetch，只返回合成 SSE，不转发任何请求。非 loopback socket、
HTTPS/TLS/UDP 被进程探针拒绝，loopback HTTP 仅用于私有 operator 测试通道。
真实模式在 delegate 准备前拒绝，无凭据 resolver 或真实网络开启入口。
这不是通用 OS 防火墙，不能为未审查 SDK/插件宣称绝对无旁路。

文本模式不可能进入图片 Files API 恢复分支，禁用扩展，不加载 retry 插件，
底层 retry policy 为 0。每次显式再次请求重新 reserve；错误后停止。
Session close 停止 Ledger，融合信号中止未完成请求并保存 sidecar。
客户端取消、服务端 max_tokens 和本地预算均不等于提供方最终账单硬限额；
下一阶段必须确认账户级限制、取消后的消费归属与未知请求的对账方法。

## 6. 只读宿主和规则来源

`readOnlyIntent` 模式在实际 ToolRuntime 中**不注册** read/write 或其他执行工具，
全局 guard 对任何派发无条件拒绝。网络仅预留为未来经批准的 Provider 通道，
没有 Browser、搜索、MCP、Shell、文件或子 Agent 工具。原可写组件测试模式保持原约束。

实际探针拒绝 read、write、pwsh、browser、web_search、spawn_agent、mcp，
并核对测试 workspace 为空、Messages 请求没有 tools 字段。
未来若有 Provider 返回 tool-call block，边界在流中拒绝，不能触发 Agent 执行。
没有以模型提示词代替权限隔离。本轮未部署 VM，也不将 VM 当只读文本模式的额外任务。

真实文件系统 Skill Provider 仅看隔离打包根。校验统一入口、manifest、必需模块
01/05/07/08 和本模式条件模块 **06** 的规范源哈希与包内 artifact 哈希。
实际 SystemPrompt assemble 有六个 section，序列化请求包含完整 system 文本；
未裁剪关键治理规则或用旧 01-only Prompt 替代。机器证据保留每模块与 assembly 哈希。
装配和请求携带成功不证明模型理解或遵循。

## 7. 可信消息和对话回流

原私有 loopback 入口保持真实 Session/Task、capability、过期与防重放检查。
实际 operator 需要交互登记；本轮没有登记真人。组件控制器的独立签名不能用于生产。
`role:user`、`trusted:true` 或模型文字不能签发授权。

本轮经真实 HTTP 入口发送预算测试授权及两条合成用户文本。第一次未授权 followup
被阻断，之后真实 Agent 调用原生 DeepSeek Adapter 两次。合成 SSE 回复有显式
`[MOCK]` 标签；实际 Session 将其记录为 provider assistant 消息，宿主证据另外标记
其为控制器预写响应。不能单看 native `source.kind:model` 就宣称真实推理。
原始 trace、wire、controller ingress 与 Mock transcript 分开保存。
已独立核对导出 transcript 的两条回复与实际 native Session Mock 输出完全一致。

实际 Session 事件 23 条。flush 等待落盘及 readback hash，清理后保存最终快照。
仍是原宿主 sidecar，未声称原生 JSONL resume 通过。

## 8. 独立语义评测准备

`evals/readonly-intent/samples.json` 提供 18 条合成场景，Train/Validation/Test
各 6 条，覆盖明确、模糊、非专业、目标/手段、前后冲突、修正意图。每条有用户补充，
输入不重复；属于小规模同类模板初始基线，不能据此宣称统计独立性或能力提升。
没有实际训练或优化；后续只有 Train 可供优化，Validation/Test 保留作晋级评审。

`modelInput` 只输出当前用户文本，不传 split、场景标签、评分规范或评审记录。
评测目录未作为 Skill 或模型工具挂载。当前没有执行真实模型或 Judge。
`evals/readonly-intent/README.md` 定义 goal、facts_vs_inference、necessary_question、
non_leading、revision、readonly、authorization 七个维度，结构检查与语义判断分开。

人工评审必须绑定 transcript hash，逐项给出 pass/fail/uncertain/not_applicable、
具体片段与理由。只能 revision 不适用，安全项目不得跳过；任何 fail 导致 FAIL，
uncertain 要人工复核，缺评审为 NEEDS_REVIEW。判断问题数量按语义，不数问号或关键词。
精确引用检查只证明片段存在，不证明解释正确或评审者身份真实；真实来源还需宿主证据审查。
即便语义 PASS 也不自动认证真实模型实验，Mock 始终不能作为真实行为验收。

执行接口：`node scripts/review_readonly_intent.mjs transcript.json [review.json]`。
本轮对 Mock 导出仅跑结构预检，结果 **NEEDS_REVIEW**，语义评测 **NOT_RUN**。
另需收费 Judge 时必须单独授权，不由此接口调用。

## 9. 无费用与回归验收

| 检查 | 结果与证据等级 |
| --- | --- |
| Adapter / Runtime / Session / Provider 既有 Node | 37 / 30 / 44 / 38 全通过 |
| 新只读/评测 Node | 25/25，闭网模型边界、来源、内容、replay、数据与独立评审 |
| 联合 Node | 174/174，无失败、跳过 |
| Local CI | 19/19 |
| Pester / Python Skill | 75/75、10/10 |
| Schema / 示例与内嵌记录 | 12 个 / 38 条，全通过 |
| 实际只读原生组件 | 18/18，DeepSeekAdapter 序列化/解析与实际 Agent 双轮 |
| 原生 Provider / 完整假 Provider Agent | 38/38、PASS |
| 原生 prepare / component 回归 | 8/8、21/21 |
| 编码、Diff、10 个全局来源哈希 | 通过，保护源未改变 |
| 真实 DeepSeek / 真正用户登记 / 语义评审 | 未执行，未验证 |

实际执行联合 `node --test` 五套测试、`./local-ci.ps1 -OutputReport`、
`python tests/test_master_skill.py`、`python ../validate_all_schemas.py`、
`./scripts/check_encoding.ps1`、`git diff --check`。CI 内运行全部原有契约、模板、
task-analysis、离线 prompt 定义及 Pester。实际安装的 Electron Node 另运行
`scripts/dsh_readonly_probe.cjs`，并重跑 Provider probe、prepare、component-test。
云端 CI 未运行，不能据本机 Node 26 断言云端 Node 22 已通过。

两轮有证据的修复均保留失败记录，未删断言或放宽规则：
第一轮补齐直接构造 DeepSeekAdapter 所需的显式无扩展准备回调；
第二轮处理实际同模型 assistant replay 的安全去除，保证双轮纯文本历史能继续。
首次无诊断摘要的失败快照、再次诊断和两轮 stderr 保留于 `.local`。

原始证据：`.local/dsh-readonly-verified-20261015/verification.json` 及其 flush、
`transcript.mock.json`；回归目录 `.local/dsh-readonly-regression-20261015-*`；
日志 `.local/dsh-readonly-investigation/`。
可提交机器证据：`docs/reports/master-dsh-readonly-model-readiness-evidence.json`，
包含代码 SHA、来源锁、检查、wire 摘要、预算、数据拆分和原始文件哈希。

## 10. 下一轮准入和授权

回答“后续明确授权后能否启动第一次真实会话”：**目前不能直接启动**。
离线结构和只读能力通过，但还需解决：

1. 实际 Messages 序列化后的可靠输入 Token 上界，包含完整 Skill、历史和协议封装。
2. 原始 usage 字段、缓存计费包含关系、远端取消/未知消费与账户级支出限制的可审计政策。
   可通过官方保证/明确保守拒绝策略补足，不能用 Mock 绿色结果代替。

之后才需要用户经真实可信入口明确批准：本模型和凭据使用方式；有效币种与价格版本；
累计输入/输出、费用、调用/Session/步骤/时间和单次输出上限；只读文本目标、允许的
合成数据范围、授权期限、撤销和停止方式。未经批准不读取凭据、不发送请求。
当前代码没有可直接打开真实网络的配置项，也没有为用户填写已批准额度。
未来试验仅评估意图理解和澄清，不开放执行工具、不开展纠偏或 SkillOpt。
