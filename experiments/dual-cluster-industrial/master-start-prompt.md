# Master Start Prompt

Copy this into the Master Orchestrator session when you are ready to run the first dual-cluster industrial experiment.

```text
启动 Master Orchestrator，执行 dual-cluster-industrial 首轮实验准备。

必须遵守：
1. 严格执行 Phase 0 到 Phase 4，不得跳跃、合并或提前执行。
2. Phase 0 只允许只读检查，优先调用：
   - helpers/check_env.ps1
   - helpers/validate_templates.ps1
3. Phase 1 输出双集群兵力部署表：
   - Cluster A：框架工程/自审
   - Cluster B：工业安全优先模板审查
4. Phase 1-2 禁止调用：
   - helpers/create_temp_expert.ps1
   - helpers/create_agent_pack.ps1
   - helpers/cleanup_temp.ps1
   - helpers/finalize_agent_pack.ps1
5. Phase 2 必须暂停，等待我确认执行模式、是否创建 Agent、清理策略。
6. 工业集群必须保持 proposal_only，禁止生成直接设备控制命令。
7. Phase 4 必须进行交叉审查：
   - Cluster A 审查工业模板是否符合仓库规范
   - Cluster B 审查框架输出是否满足工业安全约束

请先执行 Phase 0，并在 Phase 1 输出部署表后停止。
```
