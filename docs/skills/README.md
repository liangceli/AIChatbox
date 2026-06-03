# HanecoAIPilot Skills

这些 skill 文档是项目内的长期上下文，用来记录 HanecoAIPilot 的当前形态、边界、开发约定和后续演进方向。

后续每次推进项目后，都要检查本目录中相关 skill 是否需要同步更新。如果发生了架构、前端、后端、AI、数据模型、运行方式或重要业务流程变化，必须更新对应文档。

## Skill 索引

- [项目汇总](./project-summary.md)
- [当前状态](./current-status.md)
- [前端 Skill](./frontend-skill.md)
- [后端 Skill](./backend-skill.md)
- [AI Chatbox Skill](./ai-chatbox-skill.md)
- [AI 与数据流 Skill](./ai-data-skill.md)
- [API Contract Skill](./api-contract-skill.md)
- [Data Model Skill](./data-model-skill.md)
- [Auth Skill](./auth-skill.md)
- [Deployment Skill](./deployment-skill.md)
- [UI/UX Skill](./ui-ux-skill.md)
- [QA Skill](./qa-skill.md)
- [Decision Log](./decision-log.md)

## Repository Handoff Workflow

本项目使用 repository-based AI handoff workflow。Project Context & Docs 角色维护：

- `docs/skills/`: 长期项目记忆和任务上下文。
- `docs/ai-handoff/latest-implementation.md`: Implementation Codex 的最新已接受实现报告。
- `docs/ai-handoff/latest-qa.md`: QA Codex 的最新验证报告。
- `docs/ai-handoff/director-update.md`: 给 ChatGPT Project Director 的日常交接输入。

当用户要求 `Update docs/skills using docs/ai-handoff/latest-implementation.md, docs/ai-handoff/latest-qa.md, and the latest commit.` 时，必须读取 handoff 文件、`git log -1`、`git show HEAD`，必要时再读取相关源码和 skill 文件，然后只更新受影响的 docs/skills 与 `director-update.md`。

## 维护规则

- 保持这些文档描述当前真实代码，而不是理想设计。
- 不把 Kasta 写成平台核心逻辑；Kasta 只能作为 demo/seed tenant 示例。
- 每次功能推进完成后，更新受影响的 skill 文档。
- `current-status.md` 记录已完成任务、接受变更、验证摘要、剩余风险和建议下一步。
- `decision-log.md` 只记录重要技术/流程决策，不记录琐碎实现细节。
- `qa-skill.md` 记录非 watch 的自动验证命令和人工 QA 清单；不要把 `pnpm dev`、`next dev`、`tsx watch` 等长运行命令作为 blocking verification。
- 如果 handoff 文件缺失、不完整或与 latest commit 不一致，先说明风险并直接检查仓库，不要虚构状态。
- 每次给用户的最终回复末尾追加：`【此次更新已完成 skills已经同步】`
