# Master Skill Foundation：系统建模、信息降熵、反馈控制

Master Skill 的底层不是“多问几轮”“多建几个 Agent”或“多加工具”。
它的核心是三件事：

1. **系统建模**：先把问题、边界、状态和角色建模清楚。
2. **信息降熵**：把模糊输入压缩成可执行、可验证的契约。
3. **反馈控制**：在执行中持续观察偏差、修复偏差、沉淀结果。

这三条原则不新增机制，也不推翻 v5.4 / v5.5。
它们只是重新解释现有机制为什么成立。

## 1. 系统建模

系统建模回答的是：**我们正在操作什么系统？边界在哪里？状态是什么？谁能做什么？**

Master 不直接消费用户的表面请求，而是先建立一个可操作模型：

- 用户真实目标是什么；
- 本轮做什么，不做什么；
- 允许动作和禁止动作是什么；
- 当前环境、仓库、Agent、工具和运行态是什么；
- 任务处于哪个阶段；
- 哪些动作需要用户确认。

状态不是聊天记忆，而是可恢复、可验证、可交接的执行坐标。

对应机制：

| 机制 | 系统建模作用 |
|---|---|
| Clarity Gate | 把模糊请求建模为 `clarify / prototype / execute` 三类决策 |
| Execution Contract | 把目标、边界、动作、验证标准和风险边界固化为执行模型 |
| Repository Execution Mode | 在写仓库前先建模当前目录、分支、远程、工作区状态 |
| Phase 4 State Machine | 把执行过程建模为 `pending / in_progress / verified / failed / blocked / completed` 等状态 |
| Gateway Restart Safety Rule | 把 OpenClaw gateway 视为运行态边界；重启只能是有理由、有确认的状态同步动作，不是默认操作 |

系统建模的目标不是制造复杂度，而是防止 Master 在错误对象上执行正确动作。

## 2. 信息降熵

信息降熵回答的是：**如何把不确定输入压缩成更清晰、更小、更可执行的东西？**

用户给出的请求通常包含噪声、缺口、隐含约束和未命名风险。
Master 的职责不是立刻执行，也不是机械追问，而是降低任务的不确定性。

未降熵的需求不能外包给 Agent；否则 Agent 只是在放大模糊性。

对应机制：

| 机制 | 信息降熵作用 |
|---|---|
| Clarity Gate | 判断哪些信息已经足够，哪些缺失会阻塞下一步 |
| Execution Contract | 把自然语言请求压缩成结构化、可验证的执行契约 |
| Minimum Prototype | 用小产物替代低价值追问，让用户快速确认方向 |
| Final Engineering Report | 把执行结果、验证结论、风险和经验压缩成可复用记录 |
| Repository Execution Mode | 用只读检查减少仓库操作前的不确定性 |

信息降熵的关键判断是：

> 当继续提问的收益低于生成最小雏形的收益时，Master 应停止追问，产出可确认的最小雏形。

这也是 Clarity Gate 取代固定 3-5 轮澄清的原因。

## 3. 反馈控制

反馈控制回答的是：**执行偏了怎么办？验证失败怎么办？环境状态变化怎么办？**

Master 不是一次性计划生成器。
它必须在执行过程中观察现实反馈，并在偏差出现时暂停、修复、校准。

反馈控制必须是有限的；无限 repair、无限追问和无限重试都属于失控。

对应机制：

| 机制 | 反馈控制作用 |
|---|---|
| Dynamic Calibration | 发现理解偏差、变量缺失或风险上升时，暂停并更新执行契约 |
| Verify / Repair Loop | 验证失败后进入有限修复循环，不允许假装成功 |
| Phase 4 State Machine | 用明确状态追踪执行进度，避免任务漂移和重复劳动 |
| Final Engineering Report | 把最终反馈沉淀为下次执行的经验输入 |
| Gateway Restart Safety Rule | 当运行态与配置态可能不一致时，要求有边界、有确认地恢复一致性 |

反馈控制的核心不是“多检查”，而是：

> 每次反馈都必须改变状态、修正契约，或明确停止。

没有状态变化的反馈，只是噪声。

## 机制映射总表

| 现有机制 | 系统建模 | 信息降熵 | 反馈控制 |
|---|---:|---:|---:|
| Clarity Gate | 是 | 是 | 部分 |
| Execution Contract | 是 | 是 | 部分 |
| Minimum Prototype | 部分 | 是 | 是 |
| Dynamic Calibration | 是 | 部分 | 是 |
| Repository Execution Mode | 是 | 是 | 部分 |
| Verify / Repair Loop | 部分 | 部分 | 是 |
| Phase 4 State Machine | 是 | 部分 | 是 |
| Final Engineering Report | 部分 | 是 | 是 |
| Gateway Restart Safety Rule | 是 | 部分 | 是 |

## 对 v5.4 / v5.5 的解释

v5.4 的重点是把治理规则固化为可执行契约。
从三原则看，v5.4 主要完成了：

- 系统建模：Schema、Execution Contract、Phase 流程；
- 信息降熵：examples、validators、offline eval cases；
- 反馈控制：校验脚本和约束检查。

v5.5 的重点是把成熟工程习惯变成执行纪律。
从三原则看，v5.5 主要加强了：

- Repository Execution Mode：写前建模；
- Verify / Repair Loop：失败后闭环；
- Phase 4 State Machine：执行中控状态；
- Final Engineering Report：执行后沉淀反馈。

因此，v5.5 不是第二套主线。
它是对 v5.4 执行纪律的反馈控制增强。

## 新机制准入标准

任何新机制进入 Master Skill 前，必须满足以下条件之一：

1. **服务系统建模**
   能更清楚地定义目标、边界、状态、角色、权限或运行环境。

2. **服务信息降熵**
   能把模糊输入压缩成更小、更清晰、更可执行、更可验证的产物。

3. **服务反馈控制**
   能让 Master 更早发现偏差、更可靠地修复失败、更清楚地沉淀结果。

如果一个机制不能服务这三者之一，就不应进入 Master Skill。
如果一个机制增加了复杂度，却没有降低不确定性或增强控制力，就应拒绝。
