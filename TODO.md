# TODO / Roadmap

## v5.2 draft 已落地

- [x] 修正专家库路径契约：`~/.openclaw/agency-agents/<expert-name>/AGENTS.md`
- [x] `create_temp_expert.ps1` 支持只传 `-ExpertName` 自动解析专家文件
- [x] 新增 Agent Pack 模板目录 `templates/`
- [x] 新增 `create_agent_pack.ps1`：按模板创建 1-5 个临时 Agent
- [x] 新增 `finalize_agent_pack.ps1`：支持 `destroy` / `keep` / `archive-template`
- [x] README 改为“冷专家库 + 运行时 1-5 Agent Pack + 模板沉淀”的叙述
- [x] 新增 `check_env.ps1`：Phase 0 只读环境检查
- [x] `create_agent_pack.ps1` 增加模板校验：专家存在、依赖存在、无自依赖、无循环依赖
- [x] `create_temp_expert.ps1` 输出 `modelSelectionReason`
- [x] Prompt 明确 Phase 1-2 禁止创建/清理临时 Agent

## 下一步建议

- [ ] 为 helper 脚本添加 Pester 单元测试，mock `openclaw`
- [ ] 添加 GitHub Actions：PowerShell 语法检查、JSON 模板校验、README 路径一致性检查
- [ ] 增加 `templates/code-review.json` 和 `templates/research-report.json`
- [ ] 为 manifest 增加任务标题、用户确认记录和最终收尾状态
- [ ] 补充 `CONTRIBUTING.md`

## 暂不建议

- [ ] 不建议把 `agency-agents` 作为 submodule 引入，除非要锁定具体版本
- [ ] 不建议默认保留运行实例，长期复用应优先沉淀模板
