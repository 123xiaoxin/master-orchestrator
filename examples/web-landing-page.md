# 端到端示例：产品 Landing Page

## 用户指令

```text
启动 Master Orchestrator。为 "CloudDesk" 设计并开发一个响应式 Landing Page。
包含导航、Hero 区、功能卡片和页脚。先出设计稿再编码。
根据任务只创建必要专家，用完后询问是否销毁或沉淀模板。
```

## Phase -1 到 Phase 1：任务剖面

```json
{
  "schemaVersion": "task_analysis.v1",
  "intent": "为 CloudDesk 构建响应式 Landing Page",
  "goal": "交付可运行、可验收的第一版 Landing Page",
  "nonGoals": ["不做后台管理", "不做支付", "不做登录注册"],
  "deliverables": ["PRD 摘要", "UI 结构", "前端实现", "验证证据", "代码审查"],
  "constraints": ["只创建必要临时专家", "单阶段最多 5 个 Agent", "heartbeat=0"],
  "successCriteria": ["页面可启动", "桌面和移动端布局无明显溢出", "关键区域完整呈现"]
}
```

## Phase 3：兵力部署表

| 子任务 | 负责人 | 类型 | 是否创建 Agent | 推荐模板 | Micro-SOP 摘要 | 依赖 | 收尾建议 |
|--------|--------|------|----------------|----------|----------------|------|----------|
| A. PRD 摘要 | `product-manager` | Agent | 是 | `webapp-build` | 明确 goal/nonGoals/successCriteria | — | destroy |
| B. UI 设计稿 | `ui-designer` | Agent | 是 | `webapp-build` | 输出页面结构和视觉约束 | A | destroy |
| C. 前端开发 | `frontend-developer` | Agent | 是 | `webapp-build` | 实现响应式前端 | A, B | destroy |
| D. 多分辨率验证 | `evidence-collector` | Agent | 是 | `webapp-build` | 收集桌面/移动证据 | C | destroy |
| E. 最终代码审查 | `code-reviewer` | Agent | 是 | `webapp-build` | 找高风险缺陷 | C, D | archive-template |

本例使用 5 个专家，达到单阶段上限；如果还需要后端、SEO 或投放，应拆到下一阶段。

## Phase 4：创建 Agent Pack

```powershell
$pack = & .\helpers\create_agent_pack.ps1 `
  -TemplateFile .\templates\webapp-build.json `
  -TaskTitle "CloudDesk Landing Page" `
  -ExecutionMode expert-hosted `
  -SuccessCriteria "页面可启动" `
  -SuccessCriteria "桌面和移动端布局无明显溢出" `
  -SuccessCriteria "关键区域完整呈现" `
  -UserConfirmed

$manifest = ($pack | ConvertFrom-Json).manifest
```

脚本会从以下路径读取专家定义：

```text
~/.openclaw/agency-agents/product-manager/AGENTS.md
~/.openclaw/agency-agents/ui-designer/AGENTS.md
~/.openclaw/agency-agents/frontend-developer/AGENTS.md
~/.openclaw/agency-agents/evidence-collector/AGENTS.md
~/.openclaw/agency-agents/code-reviewer/AGENTS.md
```

然后生成运行清单：

```text
~/.openclaw/temp/packs/<pack-id>/manifest.json
```

## Phase 5：收尾

默认清理：

```powershell
.\helpers\finalize_agent_pack.ps1 -ManifestFile $manifest -Action destroy
```

如果这次组合值得长期复用：

```powershell
.\helpers\finalize_agent_pack.ps1 -ManifestFile $manifest -Action archive-template
```

## 关键学习

- 专家库保持冷态，不把所有专家注册成常驻 Agent。
- 单次任务只创建 1-5 个专家，避免资源和上下文膨胀。
- 保留模板比保留运行 workspace 更干净，长期复用成本更低。
