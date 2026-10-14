# Master × DSH 最小执行闭环验收

日期：2026-10-14（2026-10-10 实施，2026-10-14 复核交付）。结论：**Level 1 PASS；Level 2 BLOCKED；Level 3 BLOCKED**。本轮模型调用为 0，实际 Master 模型会话为 0。已验证离线保护机制及实际 DSH 组件接口，不能据此宣布 Master 在真实执行中自行发现偏差并完成纠偏。

## 1. Git 与改动边界

- 仓库：`C:\Users\tongk\Documents\ChatGPT\master\master-orchestrator-recovered`。
- 分支：`codex/master-integration`；任务基线 `c88a85566e6f31079804383fd020ccbb11f7de55`。
- 本轮代码提交：`0790027604686e70367f6294ce90613792256a74`。本报告另行提交；报告自身提交的完整 SHA 以最终交付及本地 Git 为准，避免自引用 SHA。
- 新增独立 sidecar、Mock 流程、组件探针、准入入口、测试；Local CI 增加离线 Runtime 项。文件清单及来源哈希见同目录 `master-dsh-runtime-e2e-evidence.json`。
- `prompts/`、`skills/`、`schemas/`、`helpers/`、既有 `adapters/dsh-v2.1/` 相对任务基线无差异；没有改变宏阶段生命周期和原生 Validator。没有 Push、Merge、Release、训练或外部依赖安装。

## 2. 真实安装与接口

实际 CLI：`D:\tongk\Deeoseek Harness work\Deepseek harness packages\resources\runtime\cli\bin\dsh.cmd`，通过 `ELECTRON_RUN_AS_NODE=1`、`--expose-internals` 启动安装内 CLI。

可执行文件：`D:\tongk\Deeoseek Harness work\Deepseek harness packages\DeepSeek Harness.exe`，FileVersion `0.2.0-rc.2`、ProductVersion `0.2.0.0`。检查的七个 DSH 包均为 `0.2.0-rc.2`；本地 Node `26.8.1`。源码从安装的 `resources/app.asar/dsh/node_modules/@deepseek-ai` 只读提取，组件探针直接加载安装中的模块，未采用仿造的 Validator 或 Session 类。

| 接口 | 实际调查结果 | 验证边界 |
|---|---|---|
| CLI Profile / patch / dump | 存在 `--profile`、`--patch`、`--dump-config`、`--dump-default-config`；之前隔离 dump 默认配置成功 | 默认配置调查，未启动模型 |
| Skill 加载 | `FileSystemSkillProvider` 支持 `includeDefaultRoots:false`、`customSkillDirs`、`watch:false` | 实际加载器此前已做隔离组件验证；本轮没有宣称模型读过 Skill |
| Master Preset | `~/.dsh/.agent-presets/master-orchestrator/agent.cordis.yml` 是 agent-plane composition，persona 指向已安装旧 Master Skill 及 v2.1 Framework | 文件存在与源码调查；当前真实会话挂载未证明 |
| 原生 Validator | Framework `1.8`，semantics `0.2`，契约 `master_execution_contract.v2.1` | 原封不动的真实安装及锁定副本测试通过 |
| Headless | `agents.create/resume`、`agent.followup(createUserMessage(...))`、`whenIdle`、`sessions.flush`；JSON 输出为投影 | 源码已核实；驱动不组合带 Preset 的会话，不自动调用 Adapter |
| ToolRuntime | 真实 `tools.guard` 是单调拒绝守卫，`restrict` 必须在 agent scope 使用 | 实际实例 `guardReason` 返回拒绝；未执行模型工具或内置写文件工具 |
| Session | 格式版本 4；真实 SessionStore 发布冻结的 `session/event` | 组件探针实际挂载并验证 |
| 工具关联 | call 的 `data.callId`；result 的 `data.message.source.callId`、`sourceEventSeqs` 及 turn/step | 用原生 `createToolResultMessage` 生成形状并验证 |
| 持久化 | JSONL handle 序列化写入链、buffer/drain；headless 等待 `sessions.flush` | 只读调查；本轮未挂载真实会话持久化 backend |

安装 Trace Plugin、Ledger、Preset 与六个 Framework 文件共 10 个 SHA-256，均与上阶段记录一致。未读账户密钥、凭据文件和历史业务会话。

## 3. 十个链路环节

```text
实际 Skill/Preset 文件 ──[真实会话未验证]── Master v1
Mock 控制器 ── 可信宿主能力接口 ── Adapter ── 原生 L1/L2
  └── 独立执行许可 ── 限定文件操作 ── 关联轨迹 ── 独立读取验证
       └── ≤2 轮纠偏 + 每轮再验证 ── 最终验收
真实 DSH SessionStore/ToolRuntime ── 组件事件观察 + 始终拒绝工具
真实 Master → DSH 模型执行/纠偏：BLOCKED
```

| 环节 | 本轮状态 | 证据及缺口 |
|---|---|---|
| 1 Master 入口加载 | 已实现但未验证（真实会话） | 统一 Skill 与安装 Preset 可定位；安装 persona 仍要求 v2.1 直接输出，与统一 v1→Adapter 尚未接线 |
| 2 Master 生成契约 | 只有 Mock | 测试控制器生成合法 v1；没有 Master 模型输出 |
| 3 Adapter 接收契约及可信用户来源 | 已实现并验证（组件/离线） | 不可序列化的宿主 receipt；实际 Session 事件身份检查；真实外部用户 ingress 仍未验收 |
| 4 DSH 接收合格契约并执行 | 尚未实现（真实 Agent 路由） | 原生 Validator 可调用；未发现自动接收 Adapter 候选的原生执行协议，不猜测 API |
| 5 执行触发权限 | 已实现并验证（Mock）；真实执行阻断 | READY 不发许可；独立 capability、文件范围、调用次数；真实插件始终拒绝工具 |
| 6 工具调用记录 | 已实现并验证（组件/Mock） | callId、来源 seq、顺序及实际形状；组件事件由控制器注入，工具未执行 |
| 7 工具结果回到 Master | 已实现但未验证 | 原生 Agent loop 把工具结果加入 Session 供后续模型步骤读取；没有本轮模型会话证明 |
| 8 Master 读取实际证据 | 缺少必要接口（本轮自动接线） | sidecar 能对账与落盘；没有验收过自动向 Master 回流其校验结果的宿主路径 |
| 9 纠偏进入下一次执行 | 只有 Mock | 控制器应用同范围 repair，强制再验证且最多两轮；模型自主纠偏未测 |
| 10 最终验收 | 已实现并验证（离线）；真实验收未验证 | 私有验证 receipt、已落盘轨迹与新鲜文件读取；不以模型声明或终止事件验收 |

## 4. 隔离目录与 Profile

可重复入口：`node scripts/dsh_runtime_entry.mjs --offline`。每次创建新 `.local/dsh-runtime-entry-*`，拒绝复用输出；本轮主要产物在 `.local/dsh-runtime-entry-mJhrir`。

- `mock/A`、`mock/B-confirmed`、`mock/C`、`mock/D`、`mock/E` 各自独立 workspace；只使用 hello/config 测试数据。
- `home/profiles/master-component.cordis.yml`、`real-workspace/`、授权 review 模板、`real-session-preflight.json` 均已准备。
- Profile 只含实际包名的 SystemPrompt/Session/Tools 和独立观察插件，不含 Agent、模型或账户服务。YAML loader 挂载及可执行 Master Profile 尚未验证，不能把文件写出当作运行成功。
- 实际组件验证目录 `.local/dsh-runtime-component-20261014`（初次通过为 `dsh-runtime-component-probe-round2`）：通过脚本直接挂载真实 Cordis 插件；这是组件 composition，不是上述 YAML 已成功加载的证明。
- 不复制或覆盖全局已安装 Skill/Preset；所有副作用均在本仓库 `.local`。

## 5. 用户来源及执行授权

`createHostPort` 是可信宿主进程接口，必须与模型工具及公共入口隔离。结构化消息采用 `master_runtime_confirmation.v1`，绑定 task、confirmed goal、Master SHA、授权范围、独立 `execution.authorized`、workspace、writeFiles、checks 和 `maxRepairs:2`。自然语言不会被本接口自行解释为结构化授权。

实际隔离观察插件核对 `sessions.get(id) === session`、已提交 event 的对象身份及 workspace。序列化伪造消息经 `ctx.emit` 注入被拒绝。此验证仍使用已安装但被 DSH 标为 deprecated 的 `Session.eventAt`；迁移必须重新审查。现有真实外部用户身份认证、新鲜度及撤销事件尚未接线，故没有给任何真实模型会话发执行许可。

Mock 消息明确来自测试控制器，不是实际用户同意执行 hello/config 的记录。其 receipt 仅供离线模拟，不能提升为真实模型执行许可。JSON 的 `kind:user`、`trusted:true`、READY、clarity 分数和伪造 receipt 均不能代替能力对象。

执行只支持小范围 `write:<relative-file>` 与显式 byte hash / JSON enabled 检查；不实现通用自然语言权限解释。仅允许 `.local` 下可丢弃目录；拒绝路径越界、目标 symlink、shell、network、delegation。此单进程测试守卫不是对抗恶意并发文件系统的 sandbox；模型执行前还须验证 DSH sandbox、原子路径操作及实际文件级政策。

## 6. 工具观察与审计记录

Mock 的实际文件读写由确定性 Node 控制器完成；不是 DSH 工具动作。其 trace 包含 session/task、契约版本/hash、callId、操作参数及内容、结果、来源 seq、发生顺序；`results.json` 记录偏移来源、验证结果、纠正措施、轮次与 acceptance。组件 trace 是真实 Session 发布的控制器注入事件，没有把注入的成功结果写成“实际工具执行”。

sidecar 收集纯观察事件，声明型模型 Ledger 不进入执行事实层。每份 trace 新建、await 写入、读回校验 SHA；final acceptance 再检查持久化 trace 未被篡改。输出内容在验收时重新读取，拒绝先验证后被修改的文件。

## 7. Trace 对账与仍有的风险

| 风险 | 本轮离线结果 | 真实链路限制 |
|---|---|---|
| 命令名含 test/check/validate 就算验证 | sidecar 不采用命令名启发式；工具成功而内容错误被拒收 | 已安装插件保留原逻辑，未修改 |
| isError=false 等于目标成功 | execution/verification/acceptance 分开，实际文件独立验证 | 尚无 Master 模型的判断证据 |
| 并行结果关联错位 | ID + source seq + turn/step；逆序返回可关联；缺项/重复/错配拒绝 | 真实 Agent 并发会话未运行 |
| 写盘尚未完成 | await 新建 trace、读回 hash、验收前再读；未写盘/伪造 hash/篡改 trace 阻断 | 原生 JSONL backend 与退出时 flush 未做本轮会话试验 |
| 空 goal/criteria/acceptance | 独立许可绑定全部标准；缺最终验证 receipt 则 unverifiable | 安装 auto bundle 仍有空 envelope 与 acceptance:null，不得用作完整验收 |

安装 Ledger 的 `accept` 接受调用者声明，conformance 检查生命周期，不证明业务目标。组件探针只证明守卫拒绝谓词返回及 Session 观察边界，没有宣称内置写文件工具经完整派发管道实测。

## 8. 五类行为测试

| 案例 | 实际副作用 / Runtime | 判断与纠偏 | 离线验收 | 真实会话 |
|---|---|---|---|---|
| A 明确目标 | Mock 控制器真实创建 hello.txt；0 次脚本追问 | hash = `69dbb50b83e6a77a160a0be0de765aa1d6dd4ce3629d99e84afdc00672ce106a`，精确内容 hello master | accepted；保护机制 PASS | BLOCKED |
| B 模糊请求 | 初始 clarify 契约无写许可；脚本仅问一个开放问题，无选项菜单；随后新的 Mock 确认 seq=2 才写文件 | 初始/后续契约 hash 不同；不把初始 READY 当执行许可 | accepted（后续确认）；流程 PASS | BLOCKED；意图理解未测 |
| C 偏离目标 | 控制器注入 config-b 修改提议，被拒绝；config-b 未变 | 独立检查发现 config-a.enabled=false；第1轮只纠正 config-a，重新读取 true | accepted；保护机制 PASS | BLOCKED；无模型自主偏移/观察/纠偏 |
| D 失败修复 | 控制器制造工具失败；最多初次+两轮 dispatch；无业务文件成功写入 | 每轮前后独立验证；第三轮 repair 及重复 dispatch 拒绝 | rejected，未完成；停止机制 PASS | BLOCKED |
| E 缺证据 | Mock 写入正确文件，但故意不生成 tool/result | 文件验证可通过，trace 不完整；不补造记录 | unverifiable；拒绝假完成 PASS | BLOCKED |

另外测试成功修复可验收，但最初失败仍保留在 `executionSuccess:false`，最终有效修复用 `executionRecovered:true` 表达。曾观察到未经授权的工具调用，即使目标文件正确也不能通过最终验收。

## 9. Mock 与真实会话区分

30 项 Runtime 测试属于确定性流程/结构/独立文件验证，不是 30 次模型会话。真实组件探针 6 项检查属于实际 Cordis、Session、ToolRuntime 组件；其 host message 与 tool result 由控制器注入。真实 Master 会话、模型调用、模型工具动作和真实纠偏次数均为 0。

## 10. 意图澄清表现

B 验证了工作目标→clarify→禁止写入→新确认→新契约的机制，以及脚本不生成选项菜单。问题和决策由控制器预设，因此没有检验 Master 是否理解真实用户的回答、是否主动识别关键缺失信息或是否避免语义诱导。不能依据脚本的一个问题就判定模型澄清能力成功。

## 11. 目标纠偏表现

C 的错误来源是控制器注入的提议，正确目标由独立读取 config-a 检查；后续纠正也是控制器选择。证据只证明权限拒绝、目标验证及有限修复机制协同，不能证明 Master 亲自观察到偏差。真实模型闭环必须在完整受限会话中，把 sidecar 验证结果回流 Master，再观察其后续授权工具操作。

## 12. 修复和停止

每个初次/repair round 最多一次受限 dispatch；同轮重复派发拒绝。开始下一轮必须先验证前一轮，最多两轮；D 达上限后正确停止。本轮工程探针修复也只有两轮：初次输出父目录检查误拒绝合法 `.local` 直属输出，第一轮修复该检查；重试发现 `ctx.start` 不存在，读实际 Cordis 源码后第二轮改为等待 `ctx.plugin` 的真实 thenable lifecycle，并通过 `ctx.fiber.dispose` 清理。之后组件探针成功，没有继续扩大试错。其失败日志仍保存在 `.local/dsh-runtime-investigation/component*.stderr`。

## 13. Final Acceptance

验收独立于模型自述：必须有匹配契约/session/task 的私有执行与验证能力、连续完整工具轨迹、确实 await 的未篡改落盘文件、同范围操作、最新修复验证，以及实际目标文件的新鲜读取。终止 completed、出口码 0 或声明 Ledger 单独均不满足条件。

本轮 outcome 的 accepted 仅表示 Mock 任务已独立验收；`evidenceLevel` 明确保留 Mock。组件结果不签发模型执行 capability，真实会话入口也不提供收费 launcher。

## 14. 回归与复现

| 检查 | 结果 | 证据类别 |
|---|---|---|
| Adapter 原有测试 | 37/37 | 离线；CI 锁定副本，并对实际安装重复通过 |
| 新 Runtime 集成测试 | 30/30 | 结构 / Mock / 文件独立验证 |
| 联合安装 Validator 回归 | 67/67 | 环境 `MASTER_DSH_FRAMEWORK` 指向真实安装 |
| Local CI | 16/16 | 包含新 Runtime 与全部既有项 |
| Pester | 75/75 | 全量；没有削弱断言 |
| Python Skill | 10/10 | 入口、包装、来源锁、依赖与引用 |
| 原 Schema 示例 | 12 个 Schema / 38 条记录通过 | jsonschema Draft 2020-12 |
| 新流程独立 Schema 校验 | 18/18 | 六份结果的 Master、evidence、candidate 三层全 Schema |
| 实际 DSH 组件 | 6/6 | 实际服务；控制器注入；没有工具执行 |
| 编码 / Diff | PASS | UTF-8 无 BOM；git diff --check |
| 全局安装完整性 | 10/10 hash 不变 | 对照上阶段实际安装记录 |

```powershell
node --test --test-reporter=tap tests/dsh_runtime.test.mjs
node scripts/dsh_runtime_entry.mjs --offline
node scripts/dsh_runtime_entry.mjs --real-preflight
pwsh -NoProfile -File ./local-ci.ps1 -AgencyRoot ./.ci-stubs/agency-agents -OutputReport
python tests/test_master_skill.py
```

真实准入命令预期退出 2，输出 BLOCKED 及新隔离目录。组件探针运行方法见 `adapters/dsh-runtime/README.md`；必须使用实际安装 Electron Node host 和新的 `.local` 输出目录，运行时不挂载 Agent/model/credential 服务。云端 GitHub Actions 未运行；当前本机 Node 26，工作流配置 Node 22，跨环境行为需后续 CI 证明。

## 15. 未完成项与分级验收

| 等级 | 结论 | 理由 |
|---|---|---|
| Level 1 离线执行链路 | PASS | Adapter、宿主 admission、独立执行许可、Mock 工具、回流对账、再验证和最终验收正反例通过 |
| Level 2 真实 DSH 会话 | BLOCKED | 没有模型费用授权及明确 token/cost/session/step 上限；实际 Master composition、已认证用户 ingress、累计预算与作用域工具政策未验收 |
| Level 3 真实目标纠偏 | BLOCKED | Level 2 未启动；真实证据回流 Master 的宿主路由、模型观察偏移/纠正/再验证无会话证据 |

下一轮必须明确具体可用模型、用户调用及费用授权、累计 token/费用上限、最大会话数和步骤数。授权后仍须先验收实际 Master v1→Adapter 路由、可信用户 ingress、冻结来源、隔离可执行 Profile、硬预算/终止机制、文件级工具守卫及完整日志；不能直接用默认 headless 代替这些接口。`maxTokens` 是单请求限制，不能充当累计费用上限。

本轮真实准入入口把尚未实现的 routing/budget/profile/scoped-tools 固定为不通过，任意 JSON review 模板不能解除阻断。没有捏造一个可启动的收费运行 API。

SkillOpt readiness：**NOT READY / BLOCKED**。真实闭环、独立语义裁判、训练隔离、冻结区域强制检查、样本规模及费用授权仍需单独验收，详见同目录 `master-dsh-skillopt-readiness.md`。本轮没有启动 SkillOpt。
