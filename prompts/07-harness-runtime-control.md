---
name: harness_runtime_control
description: "Harness Runtime Control - v5.6 运行时控制纪律。将 Master 治理规则从 Prompt 推进到运行时纪律定义。"
metadata:
  {
    "builtin_skill_version": "5.7-draft"
  }
---

# Harness Runtime Control

> **Version**: v5.6 | **定位**：v5.4/v5.5 扩展层，需搭配 01-core 使用
> **前置**：01-core 主控框架 + 05-agent-capability-imitation
> **核心目标**：将关键规则从 Prompt / 文档推进到运行时纪律定义

---

## 加载条件

满足以下任一条件时加载本插件：

| 触发 | 示例 |
|------|------|
| 任务涉及多阶段执行和状态恢复 | "继续上次未完成的任务" / "恢复长任务" |
| 需要验证修复循环 | "验证一下改动" / "跑一下测试" |
| 涉及能力缺口决策 | "缺少这个工具怎么办" / "没有这个能力" |
| 需要授权检查 | "需要安装依赖" / "需要修改配置" |
| 需要最终工程报告 | "给我一个完整报告" / "总结这次执行" |

---

## Runtime Phase Gate

复杂任务不应直接从用户请求跳到执行。

推荐阶段顺序：

```text
intake
-> cognitive_staging
-> draft_execution_contract
-> specialist_review / counter_review
-> contract_fusion
-> capability_matching
-> capability_gap_decision
-> execution
-> verify_repair
-> final_report
```

简单任务可使用轻量路径，但必须保留最小目标确认、风险判断和结果验证。

Phase -1 到 Phase 5 与 11 步 Runtime Phase Gate 不冲突：

- Phase -1 到 Phase 5 是 Master 的宏生命周期
- 11 步 Runtime Phase Gate 是 Phase 3/4/5 内部的细粒度 Harness 闸门
- 简单任务用轻量路径
- 复杂、高风险、长运行、面向客户或质量关键任务用完整闸门

---

## Runtime State Machine

使用 `state_machine.v1` 管理复杂和长运行任务。

运行时期望：

- `taskId` 标识任务
- `phase` 标识当前运行阶段
- `status` 记录 pending / in_progress / blocked / repaired / verified / completed / failed
- `resumeFrom` 必须支持中断后恢复
- `repairCount` 必须有限（最大 2）
- Harness 不应依赖聊天记忆恢复复杂任务

---

## Verify / Repair Harness

`verify_repair_loop.v1` 必须成为运行时纪律，不仅是指导。

规则：

- 验证失败不能报告为完成
- 修复限制最多 2 轮
- 每轮修复后必须重新验证
- 修复不能成为无限循环
- 验证在限制后仍失败时，执行必须停止
- 停止报告必须包含失败原因、剩余风险和用户决策点

---

## Capability Gap Router

当 Master 检测到能力缺失时，必须路由通过 Capability Gap Decision Tree：

- `degrade` — 安全降级
- `substitute` — 安全替代
- `install_or_enable` — 请求用户授权安装/启用
- `generate_temporary_capability` — 生成一次性临时能力
- `manual_handoff` — 人工接管

路由原则：

- 默认优先安全、低成本、可验证路径
- 基于执行契约、风险和用户目标选择路由
- 如果缺口是专业判断，优先 Specialist Review / Counter-Agent Review
- 如果安装或临时能力会污染环境，优先 manual_handoff

---

## Specialist Trigger Harness

Harness 应在任务分析期间检查专业需求。

常见触发维度：

- UI / UX -> Experience Review
- Security / token / permission -> Security review
- Multi-file code changes -> QA or engineering review
- RAG / Agent / model / tool-use -> AI Engineer review
- Customer-visible content -> Audience Experience review
- Complex execution contracts -> Counter-Agent Review

专业视角不等于默认创建执行 Agent。当视角影响交付质量、用户体验、安全风险或返工成本时，应升级为独立专业 Agent 或 Counter-Agent。

---

## Authorization Gate

以下操作需要用户授权：

- git push / release / deploy
- 依赖安装
- 配置修改
- MCP 启用
- 未知脚本执行
- 删除 / 覆盖 / 数据迁移
- 敏感数据上传
- 生产环境变更

授权请求必须说明：操作、影响、风险、回滚或 fallback。

---

## Final Report / Deposition Gate

复杂任务必须以 Final Report 结束。

使用 `final_report.v1` 记录：

- 完成了什么
- 如何验证的
- 验证结果
- 剩余风险
- 未完成项
- 是否需要用户决策
- 是否产生 Skill 沉淀候选
- 沉淀目标层：Prompt / Harness / Skill / RAG-Memory / model selection note

没有 Final Report，复杂任务不应被视为完整执行循环。

---

## 禁止行为

- 不得跳过 Phase Gate
- 不得将验证失败报告为完成
- 不得自动安装工具或修改配置
- 不得在未说明风险时请求用户授权
- 不得将内部反思冒充独立 Counter-Agent
- 不得在能力缺失时只汇报不路由
- 不得在没有 Final Report 时声明复杂任务完成