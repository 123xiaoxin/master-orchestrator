# 端到端示例：产品 Landing Page

## 用户指令

```text
启动 Master Orchestrator。为 "CloudDesk" 设计并开发一个响应式 Landing Page。
包含导航、Hero 区、功能卡片和页脚。先出设计稿再编码。
根据任务只创建必要专家，用完后询问是否销毁或沉淀模板。
```

## Phase 1：兵力部署表

| 子任务 | 负责人 | 是否创建 Agent | 推荐模型/模板 | 依赖 | 收尾建议 |
|--------|--------|----------------|----------------|------|----------|
| A. PRD 摘要 | `product-manager` | 是 | `webapp-build` | — | destroy |
| B. UI 设计稿 | `ui-designer` | 是 | `webapp-build` | A | destroy |
| C. 前端开发 | `frontend-developer` | 是 | `webapp-build` | A, B | destroy |
| D. 多分辨率验证 | `evidence-collector` | 是 | `webapp-build` | C | destroy |
| E. 最终代码审查 | `code-reviewer` | 是 | `webapp-build` | C, D | archive-template |

本例使用 5 个专家，达到单阶段上限；如果还需要后端、SEO 或投放，应拆到下一阶段。

## Phase 3：创建 Agent Pack

```powershell
$pack = & .\helpers\create_agent_pack.ps1 -TemplateFile .\templates\webapp-build.json
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

## Phase 4：收尾

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
