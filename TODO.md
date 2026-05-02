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
- [x] 新增 `validate_templates.ps1` 批量模板校验

## v5.3 draft 已落地

- [x] README 升级为“Runtime Governor + Analysis as Compilation”定位
- [x] Core prompt 从 Phase 0-4 升级为 Phase -1 到 Phase 5
- [x] 明确 Master-First、用户自建 Agent 默认旁路、默认无 heartbeat、临时对象默认销毁
- [x] 补充 Agent / Sub-agent 区分与创建判断规则
- [x] 新增 `schemas/task_analysis.v1.schema.json`
- [x] 新增 `schemas/agent_pack.v1.schema.json`
- [x] Agent Pack 模板补充 `schemaVersion` 与 `microSop`
- [x] `create_agent_pack.ps1` manifest 增加任务标题、执行模式、用户确认记录、成功标准和 Micro-SOP
- [x] `finalize_agent_pack.ps1` manifest 增加 lifecycle / finalStatus
- [x] Quality / Skillcraft 调整到 Phase 5 集中处理

## 下一步建议

- [ ] 为 helper 脚本添加 Pester 单元测试，mock `openclaw`
- [ ] 添加 GitHub Actions：PowerShell 语法检查、JSON 模板校验、README 路径一致性检查
- [ ] 增加 `templates/code-review.json` 和 `templates/research-report.json`
- [ ] 补充 `CONTRIBUTING.md`
- [ ] 为 `schemas/*.json` 添加 CI 校验
- [ ] 为用户自建 Agent 设计 `agent_spec.v1` 和胜任力评分机制

## 暂不建议

- [ ] 不建议把 `agency-agents` 作为 submodule 引入，除非要锁定具体版本
- [ ] 不建议默认保留运行实例，长期复用应优先沉淀模板
