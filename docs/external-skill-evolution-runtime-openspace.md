# External Skill Evolution Runtime: OpenSpace Reference Analysis

## Scope

本文只读分析 [HKUDS/OpenSpace](https://github.com/HKUDS/OpenSpace/tree/main)。
未安装、未 clone、未修改仓库、未 commit、未 push。

目标：判断 OpenSpace 是否适合作为 Master Skill v5.5 Phase 2B Minimal Capability
Runtime / Skill Deposition / Capability Gap Decision Tree 的外部参考案例。

本文是参考分析，不是集成指南；不授权自动安装、复制 host skills、启用 MCP、
配置 cloud API key 或默认调用 OpenSpace。

## 1. OpenSpace 的定位

OpenSpace 不是普通 skill collection，而是 **self-evolving skill runtime**。

它的核心不是“提供很多 Skill”，而是围绕任务执行形成一个闭环：

```text
discover skill
-> apply skill
-> execute task
-> monitor quality
-> analyze outcome
-> fix / derive / capture skills
-> reuse in future tasks
```

更准确的定位：

```text
OpenSpace = self-evolving skill runtime + external capability execution layer
```

这与 Master 的区别很重要：

- OpenSpace 更偏运行时自动演化；
- Master 更偏执行前控制、能力选择、安全授权、契约治理；
- OpenSpace 可作为外部能力包参考，但不应直接成为 Master 核心机制。

## 2. 核心能力

### Self-Evolution

OpenSpace 的核心卖点是 Skill 会在使用中自动改进。其 README 将其描述为 skills
自动选择、应用、监控、分析和演化。

对应能力包括：

- broken skill 自动修复；
- 成功模式沉淀为新版本；
- 成功执行被捕获为新 Skill；
- 质量监控驱动后续演化。

对 Master 的启发：

```text
Skill 不应只是静态文件；稳定流程可以从执行经验中沉淀、修正、升级。
```

但 Master 当前阶段不能自动演化核心 Skill，只能吸收它的设计原则。

### Collective Agent Intelligence

OpenSpace 通过 local / cloud skill community 让 Agent 之间共享演化后的 Skill。

对 Master 的启发：

```text
外部能力包可以作为候选能力来源，但必须经过 Capability Matching 和安全授权。
```

不应直接照搬：

- 自动上传；
- 自动下载；
- 自动导入 cloud skill；
- 团队共享默认启用。

### Token Efficiency

OpenSpace 强调复用成功工作流，减少重复推理和 token 消耗。

对 Master 的启发：

```text
重复、稳定、可验证的流程应沉淀为 Skill，避免每次从零推理。
```

但 Master 应保持保守：

- 先用 Minimal Capability Runtime 选择最小工具；
- 再用 Skill Deposition 判断是否值得沉淀；
- 不把一次性临时能力直接变成正式 Skill。

## 3. 三种 Skill 演化模式

OpenSpace 定义了三种演化模式。

### FIX

修复破损或过时的 Skill 指令。

对应 Master：

- Verify / Repair Loop；
- Skill health repair；
- broken workflow repair。

Master 可参考：

```text
失败后不是重写全部，而是定位破损点并做最小修复。
```

不应照搬：

- 自动修改 Master 核心 Skill；
- 自动替换前任 Skill；
- 自动修复后立即进入默认路径。

### DERIVED

从父 Skill 派生增强版或专用版，新 Skill 与父 Skill 共存。

对应 Master：

- Skill Deposition；
- specialized workflow extraction；
- capability specialization。

Master 可参考：

```text
当同一流程在特定上下文反复出现，可以派生专用 Skill，而不是污染通用 Skill。
```

不应照搬：

- 自动创建大量派生 Skill；
- 未验证就加入默认能力池；
- 为单次任务派生长期能力。

### CAPTURED

从成功执行中捕获新的可复用模式，生成全新 Skill。

对应 Master：

- task-after analysis；
- Final Engineering Report；
- Skill Deposition candidate。

Master 可参考：

```text
成功任务结束后，提取可复用流程，而不是只输出结果。
```

不应照搬：

- 自动捕获所有成功任务；
- 自动把临时脚本变成 Skill；
- 自动上传或分享捕获结果。

## 4. 能力缺口处理启发

OpenSpace 有一个重要设计点：即使没有匹配 Skill，也能继续完成任务。

其 README 表达了从 discovery 到 application 到 evolution 的完整生命周期，并强调没有匹配
Skill 时仍可完成任务。这对 Master 的 Capability Gap Decision Tree 很有启发。

对应到 Master：

```text
发现缺少 Skill != 任务失败
发现缺少 Skill -> 决策树
```

Master 应选择：

- degrade；
- substitute；
- install_or_enable；
- generate_temporary_capability；
- manual_handoff。

OpenSpace 的启发是：

```text
没有匹配 Skill 时，可以先执行，再从执行中捕获经验。
```

Master 的修正是：

```text
可以继续，但必须经过 Execution Contract、风险等级、授权边界和验证计划。
```

## 5. host skills 对 Master 的启发

### delegate-task

`delegate-task` 暴露了 OpenSpace 的核心委托能力：执行任务、搜索 Skill、修复 Skill、
上传 Skill。

它的启发：

- 外部能力包可以作为 delegated capability；
- 复杂任务可以交给外部 runtime；
- 外部 runtime 可以返回 evolved skills；
- 主控层必须向用户报告结果和演化产物。

Master 应吸收：

```text
External Capability Pack 可以作为 Minimal Capability Runtime 的一个 route。
```

但必须限制：

- 不自动 delegate；
- 不自动 upload；
- 不自动 fix skill；
- 不自动把 evolved skill 纳入核心路径。

### skill-discovery

`skill-discovery` 用于搜索 local / cloud skill，并帮助判断是自己执行、读取 Skill 指令，
还是委托给 OpenSpace。

它的启发：

- Skill discovery 应服务于 route decision；
- discovery 结果只是候选，不是自动执行命令；
- 搜索后仍要由 Master 决策。

Master 应吸收：

```text
Skill Discovery 是能力发现，不是能力授权。
```

风险点：

- OpenSpace 的 `auto_import` 默认行为需要在 Master 中禁用或显式授权；
- cloud skill 搜索和导入不能自动发生；
- discovery 结果必须进入 Capability Matching，而不是直接执行。

## 6. 与 Master 当前机制的对应关系

### Minimal Capability Runtime

OpenSpace 可作为 External Capability Pack 参考。

对应关系：

| Master | OpenSpace 参考 |
|---|---|
| Tool Discovery | skill-discovery / search_skills |
| Capability Matching | decide self-handle vs delegate |
| External Capability Pack | delegate-task / execute_task |
| Verification | quality tracking / execution result |
| Skill Deposition | FIX / DERIVED / CAPTURED |

Master 不应把 OpenSpace 设为默认 route，只能作为可选外部能力。

### Capability Gap Decision Tree

OpenSpace 对“缺少匹配 Skill 仍可继续执行”的处理，对 Master 很有参考价值。

Master 可借鉴：

- search skill；
- no match 时仍可继续；
- 执行后捕获新模式；
- 失败时修复或演化。

Master 必须加上：

- degrade / substitute 优先；
- install / enable 必须授权；
- 临时能力不等于正式 Skill；
- 高风险缺口进入 manual_handoff。

### Security Capability

OpenSpace 包含安全配置、blocked commands、sandbox、危险模式检查等设计。

Master 可借鉴：

- skill loading 前的安全检查；
- tool / backend 独立安全策略；
- prompt injection / credential exfiltration 检测；
- anti-loop guard；
- confirmation gate。

Master 必须更保守：

- 不自动安装；
- 不自动启用 MCP；
- 不自动执行未知脚本；
- 不自动读取或写入 host skill 目录；
- 不自动上传 / 下载 cloud skill。

### Skill Deposition

OpenSpace 的 FIX / DERIVED / CAPTURED 是很好的 Skill Deposition 参考。

Master 可转化为：

- FIX：修复已有 Skill / workflow；
- DERIVED：从稳定父流程派生专用 Skill；
- CAPTURED：从成功任务捕获新候选 Skill。

但 Master 应先记录为 candidate，而不是自动落地正式 Skill。

### Verify / Repair Loop

OpenSpace 的 auto-fix 和 quality metrics 对 Master 的 Verify / Repair Loop 有启发。

可借鉴：

- 失败触发修复；
- 修复要基于证据；
- 最小 diff；
- retry 有边界；
- 记录 lineage / quality metrics。

Master 应保留：

- 最多有限 repair；
- 失败必须报告风险；
- 高风险修复需授权；
- 不自动替换核心机制。

## 7. 值得参考的能力

### skill discovery

值得参考。

但 Master 中必须定义为：

```text
发现候选能力，不代表授权执行。
```

### skill health metrics

值得参考。

可用于未来判断：

- skill applied rate；
- completion rate；
- fallback rate；
- failure pattern；
- repair history。

暂不工程化为 schema。

### task-after analysis

值得参考。

OpenSpace 的 post-execution analysis 对 Master 的 Final Engineering Report /
Skill Deposition 很有价值。

Master 可在任务结束后判断：

- 哪些流程可复用；
- 哪些失败值得 repair；
- 哪些临时能力值得沉淀；
- 哪些经验只保留为报告。

### captured workflow

值得参考。

但 Master 应先作为 `Skill Deposition candidate`，不自动生成正式 Skill。

### derived skill

值得参考。

适合未来处理：

- 某个通用流程在特定项目反复出现；
- 某个 Skill 需要专业化；
- 某个客户/领域需要稳定变体。

### auto-fix 思路

值得参考，但不能直接照搬。

Master 可以吸收：

```text
失败 -> 定位原因 -> 最小修复 -> 重新验证
```

但不能自动：

- 修改核心 Master Skill；
- 替换系统 prompt；
- 上传修复结果；
- 扩大修复范围。

## 8. 不应直接照搬的能力

以下能力不应直接进入 Master 核心机制：

- 自动安装；
- 自动启用 MCP；
- 自动上传 cloud skill；
- 自动下载 cloud skill；
- 自动 import cloud skill；
- 自动复制 host skills；
- 自动修改 OpenClaw config；
- 自动修改 host skill 目录；
- 自动演化核心 Master Skill；
- 自动运行长期服务；
- 自动启动 dashboard / gateway；
- 自动读取或写入 API key；
- 自动使用 team / cloud community；
- 自动执行 delegate-task；
- 自动执行 fix_skill；
- 自动执行 upload_skill。

原因：

Master 是控制层，不是自演化 runtime 本体。

OpenSpace 的强项是 autonomous evolution；Master 的强项是 governance before execution。

## 9. 安全边界

如果未来把 OpenSpace 作为隔离测试能力，必须遵守：

- 不自动安装；
- 不自动 clone；
- 不自动复制 host skills；
- 不自动写 OpenClaw config；
- 不自动启用 cloud API key；
- 不自动启动 MCP server；
- 不自动启动 dashboard；
- 不自动上传 / 下载 cloud skill；
- 不自动 import skill；
- 不自动修改 host skill 目录；
- 不自动读取凭据；
- 不自动启用长期后台服务。

允许的最低风险动作：

```text
read-only reference analysis
```

需要明确授权的动作：

- clone repo；
- install dependencies；
- start openspace-mcp；
- copy host skills；
- configure OpenClaw / MCP；
- set API key；
- search cloud skills；
- auto-import cloud skill；
- delegate task；
- fix skill；
- upload skill；
- run dashboard / gateway。

## 10. 建议结论

### 是否值得作为参考

值得。

OpenSpace 是 Master Phase 2B / Skill Deposition / Capability Gap Decision Tree 的强参考案例，
因为它展示了：

- skill discovery；
- no-match fallback；
- task-after analysis；
- skill evolution；
- quality metrics；
- captured workflow；
- derived skill；
- auto-fix；
- token efficiency。

### 是否值得作为隔离测试能力

可以，但只能作为隔离测试能力。

建议条件：

- 独立 sandbox / test repo；
- 明确用户授权；
- 不写入 Master 主仓库配置；
- 不修改 OpenClaw config；
- 不启用 cloud API key；
- 不启动长期 MCP server；
- 不上传下载 cloud skill；
- 不把 OpenSpace host skills 复制进默认 skill path；
- 所有输出只作为 reference signal。

### 是否暂不进入核心仓库机制

是，暂不进入核心仓库机制。

当前建议：

```text
OpenSpace 进入 docs 作为 external skill evolution runtime 参考；
不进入 prompts；
不新增 schema；
不新增 helper；
不新增 dependency；
不作为默认 capability route；
不作为默认 Skill Deposition runtime。
```

## 最终判断

OpenSpace 适合作为：

```text
External Skill Evolution Runtime reference
```

不适合作为：

```text
Master Skill 核心机制
默认能力运行层
默认 Skill registry
默认自演化系统
```

Master 可以学习 OpenSpace 的演化思想，但必须保留自己的控制边界：

```text
先 Execution Contract
再 Capability Matching
再 Capability Gap Decision Tree
再授权执行
最后才考虑 Skill Deposition
```

## References

- [OpenSpace README](https://github.com/HKUDS/OpenSpace/tree/main)
- [delegate-task host skill](https://raw.githubusercontent.com/HKUDS/OpenSpace/main/openspace/host_skills/delegate-task/SKILL.md)
- [skill-discovery host skill](https://raw.githubusercontent.com/HKUDS/OpenSpace/main/openspace/host_skills/skill-discovery/SKILL.md)
- [host skills integration guide](https://raw.githubusercontent.com/HKUDS/OpenSpace/main/openspace/host_skills/README.md)
- [OpenSpace config guide](https://raw.githubusercontent.com/HKUDS/OpenSpace/main/openspace/config/README.md)
