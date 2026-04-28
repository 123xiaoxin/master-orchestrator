# TODO — 上线前还需要你手动完成的步骤

## ✅ 已完成（仓库已建好）

- [x] README.md（含端到端示例 + MIT License 声明）
- [x] prompts/ 全部 4 个插件文件
- [x] helpers/ 两个 PowerShell 脚本
- [x] examples/ 一个演示文件
- [x] LICENSE（MIT，版权人：123xiaoxin）
- [x] Git 初始化并提交

---

## ⬜ 还需要你手动完成

### 1. 创建 GitHub 仓库

```
访问：https://github.com/new
Repository name: master-orchestrator
Description: 为 OpenClaw 打造的企业级、微内核 AI 工作流编排引擎
选择 Public（公开）/ Private（私有）
不要勾选 Initialize this repository with any template
点击 Create repository
```

### 2. 绑定远程仓库并推送

```bash
cd ~\github\master-orchestrator
git remote add origin https://github.com/123xiaoxin/master-orchestrator.git
git branch -M main
git push -u origin main
```

### 3. 补充 agency-agents 外部依赖说明（可选）

如果你希望用户一站式完成安装，可以考虑在仓库里放一个 `SETUP.md`，写清楚：

```bash
# 克隆专家库（必需依赖）
git clone https://github.com/msitarzewski/agency-agents.git ~/.openclaw/agency-agents/
```

---

## 🔜 可选的后续优化

- [ ] 添加 CONTRIBUTING.md（贡献指南）
- [ ] 录制一个 GIF 演示，放在 README 里
- [ ] 添加 GitHub Actions CI（自动检查 PowerShell 语法）
- [ ] 考虑把 agency-agents 作为 submodule 引入
