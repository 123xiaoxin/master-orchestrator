# 端到端示例：产品 Landing Page

## 用户指令

```
启动 Master Orchestrator。为 "CloudDesk" 设计并开发一个响应式 Landing Page。
包含导航、Hero 区、功能卡片和页脚。先出设计稿再编码。
```

## 实际执行阶段摘要

1. **Phase 0**：检测到 main, coding, rag-memory Agent；可用模型 deepseek-chat, gpt-4o；专家库就绪。

2. **Phase 1**：生成兵力部署表（见 README 示例），用户选择模式 B（专家托管）。

3. **Phase 3**：按串行依赖执行 A → B → C → D，各专家独立工作，产物通过 `shared/` 传递。

   - **A. PRD 摘要**（product-manager）：关键约束：单页、响应式、品牌色 #2563eb、企业 SaaS 风格
   - **B. UI 设计稿**（ui-designer）：桌面端/移动端线框图 + 高保真设计，风格简洁科技
   - **C. 前端开发**（frontend-developer）：生成 `index.html` + `style.css` + `script.js`，所有资源内嵌
   - **D. 多分辨率测试**（evidence-collector）：桌面/平板/手机截图验证通过，性能评分 92

4. **Phase 4**：

   - 质量总评：⭐⭐⭐⭐（良好），设计还原度高，响应式表现优秀
   - 经验沉淀：新增 skill `ui-to-code-pipeline`（PRD → 设计 → 前端）
   - 临时 Agent 全部回收

## 交付物

- `landing-page-demo/index.html`
- `landing-page-demo/style.css`
- `landing-page-demo/script.js`
- 多分辨率测试截图

## 关键学习

- PRD 摘要为设计师提供了准确的约束，减少了返工
- 自动模型分配为前端任务选中了 deepseek-chat，代码生成速度令人满意
- 并行化机会：如果设计稿和 PRD 同时进行，可再节省约 20% 时间（本例中 B 依赖 A，故串行）
