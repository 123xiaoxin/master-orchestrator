# External Capability Packs: gstack Reference Analysis

## Scope

本文只读分析 [garrytan/gstack](https://github.com/garrytan/gstack)。
未安装、未 clone、未修改本地仓库、未 commit、未 push。

目标：判断 gstack 是否适合作为 Master Skill v5.5 Phase 2B Minimal Capability
Runtime 的 External Capability Pack 参考案例。

本文是参考分析，不是集成指南；不授权自动安装、自动路由、team mode 或默认调用 gstack。

## 1. gstack 的定位：Process 还是 Skill Collection

gstack 不是单纯的 Skill collection。

它表面上是大量 Claude Code slash command / skill 的集合，但其 README 明确把它定义为
一个 process：

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

更准确的定位：

```text
gstack = opinionated AI software delivery process packaged as skills
```

它的价值不在“有很多 Skill”，而在这些 Skill 被组织成一个完整交付流程：

- 前置思考；
- 计划审查；
- 架构 / 设计 / CEO 视角反推；
- 构建；
- 代码审查；
- QA；
- 发布；
- 复盘。

这点适合作为 Master 的 External Capability Pack 参考，但不适合直接并入核心机制。

## 2. 核心流程映射

gstack 流程：

```text
Think -> Plan -> Build -> Review -> Test -> Ship -> Reflect
```

对应 Master 当前结构：

| gstack 阶段 | Master 对应机制 |
|---|---|
| Think | Pre-Execution Cognitive Staging |
| Plan | Execution Contract / Counter-Agent Review |
| Build | Minimal Capability Runtime |
| Review | Verify / Repair Loop + Counter Review |
| Test | Verification / QA |
| Ship | High-risk authorized execution |
| Reflect | Final Engineering Report / Skill Deposition |

关键启发：gstack 的成熟点不是“多工具”，而是“每个工具知道前一个阶段产出了什么”。

## 3. 对应 Pre-Execution Cognitive Staging 的能力

### `/office-hours`

适合参考为：

- Information Gathering；
- Context Analysis；
- Task Framing；
- real goal 识别；
- narrowest wedge 判断。

gstack 描述它会通过 forcing questions 重新框定产品想法，并输出 design doc。
这个模式与 Master 的“先调查，后执行”一致。

Master 可吸收的原则：

```text
先逼近真实问题，再生成执行契约。
```

不应照搬的是固定问题数量和过强 YC / startup 语境。

### `/plan-ceo-review`

适合参考为：

- scope challenge；
- product direction review；
- 目标冲突识别；
- 是否该扩大、保持、缩小范围。

它适合作为 Counter-Agent Review 的一种战略审查视角。

Master 可吸收：

```text
复杂任务的目标和范围需要独立挑战。
```

不应照搬：

- “10-star product” 这种强创业产品语境；
- 默认扩大 scope 的倾向。

### `/plan-eng-review`

适合参考为：

- architecture review；
- data flow；
- edge cases；
- test plan；
- failure modes。

它高度对应 Master 的 Draft Execution Contract 审查阶段。

Master 可吸收：

```text
执行契约定稿前，必须检查架构、状态流、失败路径和验证标准。
```

### `/plan-design-review`

适合参考为：

- design constraints；
- user-facing quality review；
- AI slop 检查；
- 用户偏好确认。

它适合作为“用户可见交付物”的独立审查视角。

需要限制：

- 不应让设计审查默认变成交互式多轮确认；
- 只有用户偏好、品牌、客户可见内容才打断用户。

### `/investigate`

适合参考为：

- Investigation Before Execution；
- root cause before fix；
- hypothesis testing；
- bounded repair。

它与 Master 当前新增原则高度一致：

```text
没有调查，就没有修复权。
```

Master 可吸收：

```text
复杂问题先定位原因，再改动。
```

## 4. 对应 Minimal Capability Runtime 的能力

### `/browse`

对应：

- browser capability adapter；
- web / UI observation；
- screenshot / click / real browser verification。

适合作为外部能力包能力，不应成为核心机制。

安全要求：

- 不自动打开浏览器；
- 不自动登录；
- 不自动导入 cookies；
- 不自动访问敏感页面。

### `/qa`

对应：

- runtime verification；
- UI / staging test；
- bug detection；
- regression verification。

适合作为验证能力参考。

风险点：

- gstack 的 `/qa` 可能修复 bug、生成测试、改代码。
- Master 中应拆成两个动作：
  - `qa-only` / report；
  - repair with authorization。

### `/review`

对应：

- code review；
- adversarial review；
- production failure check；
- cross-model review。

适合参考为 Counter Review / Verify gate。

风险点：

- auto-fix 行为不能默认启用；
- review 可以作为只读能力，fix 必须走 Execution Contract 和授权边界。

### `/cso`

对应：

- Security Capability；
- threat modeling；
- OWASP / STRIDE；
- high-confidence finding gate。

适合作为高风险任务前置审查能力。

Master 中应定位为：

```text
external security review capability
```

而不是核心安全模型本身。

### `/ship`

对应：

- release adapter；
- test run；
- coverage audit；
- commit / push / PR creation。

这是高风险执行能力。

Master 中只能作为 L4/L5 授权能力调用，不能自动触发。

### `/land-and-deploy`

对应：

- merge；
- deploy；
- CI wait；
- production health verification；
- rollback / revert decision。

这是最高风险能力之一。

Master 中默认不应自动调用。只能在明确授权、明确目标分支、明确回滚策略、明确验证信号后调用。

## 5. 不应直接照搬的能力

以下内容不应直接进入 Master 核心机制：

- 自动安装 gstack；
- team mode；
- 自动修改 `CLAUDE.md` / routing rules；
- 自动 commit；
- 自动 push；
- 自动 PR；
- 自动 deploy；
- 自动打开 browser；
- 自动导入 cookies；
- 自动 telemetry / learning memory；
- 自动 proactive skill suggestion；
- parallel sprints / pair-agent；
- `/design-shotgun`、`/design-html` 这类强业务或强审美流程；
- “Boil the Lake” 式无限完整化倾向；
- 固定 YC / startup / CEO 语境；
- 将 gstack skills 作为 Master 默认依赖。

原因：

Master 的核心是控制层，不是工具栈替换层。

## 6. Master 如何把 gstack 当成外部能力包

建议定义为：

```text
External Capability Pack: gstack
```

它不是 Master 核心机制，而是 Minimal Capability Runtime 可选调用的一组外部能力。

调用前必须经过：

1. Execution Contract 已定稿；
2. Capability Matching 判断 gstack 是最小充分路线；
3. Security Capability 判断风险等级；
4. 高风险动作获得用户授权；
5. 输出可验证结果；
6. 结果进入 Final Engineering Report。

推荐路由形式：

```json
{
  "recommendedRoute": "external_capability_pack",
  "pack": "gstack",
  "capability": "review | qa | cso | browse | ship",
  "riskLevel": "L0-L5",
  "requiresUserAuthorization": true
}
```

不建议在当前阶段新增 schema，只作为文档约束。

## 7. 调用 gstack 前的安全边界

必须明确：

- 不自动安装；
- 不自动 team mode；
- 不自动修改项目配置；
- 不自动 commit；
- 不自动 push；
- 不自动 open browser；
- 不自动 deploy；
- 不自动 release；
- 不自动导入 cookies；
- 不自动启用 telemetry / memory；
- 不自动运行长期后台进程；
- 不自动让 gstack 接管 Skill routing。

高风险映射：

| 操作 | Master 风险级别 |
|---|---|
| browse readonly | L1-L2 |
| open browser / authenticated QA | L3-L4 |
| code auto-fix | L2-L4 |
| commit | L3 |
| push / PR | L4 |
| deploy / release | L5 |
| force push | L5，默认禁止 |
| cookie import | L5 |
| team mode / config injection | L4-L5 |

## 8. 与 Master Skill Foundation 三原则的关系

### 系统建模

gstack 的价值在于把软件交付建模成阶段流程，而不是把每个任务都交给一个万能 Agent。

Master 可借鉴：

- 阶段化流程；
- role-specific review；
- 每阶段产物喂给下一阶段；
- release / QA / review 的状态化输出。

### 信息降熵

gstack 的 `/office-hours`、`/plan-ceo-review`、`/plan-eng-review`、`/investigate`
都在执行前降低不确定性。

Master 可借鉴：

```text
复杂任务先压缩成清晰方向、约束、风险和验证点，再进入执行。
```

### 反馈控制

gstack 的 `/review`、`/qa`、`/cso`、`/ship`、`/land-and-deploy` 是反馈控制能力。

Master 应借鉴其验证链路，但必须加上自己的授权边界和 bounded repair 规则。

## 9. 与 Phase 2B / Phase 2C 的关系

### 对 Phase 2B Minimal Capability Runtime

gstack 是很好的 External Capability Pack 参考案例。

它说明 Phase 2B 不应只是“发现工具”，而应回答：

- 当前 Execution Contract 需要什么能力；
- gstack 是否是合适的外部能力；
- 调用哪个能力；
- 风险等级是多少；
- 是否需要授权；
- 输出如何验证。

### 对 Phase 2C Pre-Execution Cognitive Staging

gstack 的前半段非常有参考价值：

- `/office-hours`
- `/plan-ceo-review`
- `/plan-eng-review`
- `/plan-design-review`
- `/investigate`

这些能力说明复杂任务在执行前确实需要认知分阶段和独立审查。

但 Master 不能直接照搬 gstack 的固定流程。Master 应保持：

```text
简单任务轻量化，复杂任务认知分阶段。
```

## 10. 建议结论

### 是否值得作为参考

值得。

gstack 是一个成熟的“process packaged as skills”案例，尤其适合作为：

- External Capability Pack 设计参考；
- Phase 2B capability routing 参考；
- Phase 2C cognitive staging 参考；
- review / qa / security / ship 风险边界参考。

### 是否值得作为本地测试能力

可以，但只能作为手动授权的本地测试能力。

建议条件：

- 不自动安装；
- 不进入默认 Master 运行路径；
- 不写入核心仓库配置；
- 不启用 team mode；
- 不自动执行 `/ship`、`/land-and-deploy`；
- 只在测试分支或隔离仓库中手动验证。

### 是否暂不进入核心仓库机制

是，暂不进入核心仓库机制。

建议当前只写成参考文档，不引入 schema、不引入 helper、不新增依赖、不改变 prompts。

最终判断：

```text
gstack 适合作为 External Capability Pack 参考案例，
不适合作为 Master Skill 核心机制或默认依赖。
```

## References

- [gstack README](https://github.com/garrytan/gstack)
- [office-hours/SKILL.md](https://raw.githubusercontent.com/garrytan/gstack/main/office-hours/SKILL.md)
- [plan-ceo-review/SKILL.md](https://raw.githubusercontent.com/garrytan/gstack/main/plan-ceo-review/SKILL.md)
- [plan-eng-review/SKILL.md](https://raw.githubusercontent.com/garrytan/gstack/main/plan-eng-review/SKILL.md)
- [investigate/SKILL.md](https://raw.githubusercontent.com/garrytan/gstack/main/investigate/SKILL.md)
- [ship/SKILL.md](https://raw.githubusercontent.com/garrytan/gstack/main/ship/SKILL.md)
- [land-and-deploy/SKILL.md](https://raw.githubusercontent.com/garrytan/gstack/main/land-and-deploy/SKILL.md)
