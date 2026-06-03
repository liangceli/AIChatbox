# 当前状态

## 2026-06-03 Stabilization Update

- Dependency reproducibility policy updated: `pnpm-lock.yaml` should be tracked and is no longer ignored.
- OpenAI real-key smoke helper added: `pnpm --filter @platform/api smoke:openai`; it is manual-only and not part of normal tests.
- Short keyword retrieval now uses normalized exact-token scoring and stricter one-token thresholds to reduce weak substring matches.
- API provider tests now cover retrieval short-query behavior, OpenAI citation preservation, safe provider metadata, fallback metadata, and `PENDING_HUMAN` blocking.
- Real OpenAI smoke remains pending until a valid API key is available.

## 最新代码状态

本次文档 intake 基于当前仓库源码，不修改业务逻辑。项目目前是一个 TypeScript monorepo，包含：

- `apps/admin-web`: Next.js 管理后台、agent inbox、本地 chat 测试页。
- `apps/customer-widget`: 可嵌入 React customer support widget。
- `apps/api`: NestJS API，包含 tenant resolution、chat、knowledge、conversation handoff、realtime snapshot。
- `apps/ai-worker`: worker 边界和 env/logging 占位，尚未承载真实异步任务。
- `packages/database`: Prisma schema、migrations、seed。
- `packages/types`: 前后端共享 API shape。

## 当前工作流状态

- 本项目已切换到 repository-based AI handoff workflow。
- 当前 Codex Chat 1 职责是 Project Context & Docs：维护 `docs/skills`、项目记忆和 handoff 文档，不接管 Project Director、实现或 QA。
- 新 handoff 目录为 `docs/ai-handoff/`。
- 每次任务已接受、人工验证并提交后，用户会要求基于 `docs/ai-handoff/latest-implementation.md`、`docs/ai-handoff/latest-qa.md` 和最新 commit 更新文档。
- Chat 1 更新时应读取 handoff 文件、`git log -1`、`git show HEAD`，必要时读取相关源码和既有 skill 文件。
- 每次 handoff 文档同步后，需要创建或更新 `docs/ai-handoff/director-update.md`，作为给 ChatGPT Project Director 的交接输入。

## 最新已接受任务

- 最新提交：`9a99d6f Stabilize OpenAI provider and retrieval QA`。
- 已接受任务：稳定 OpenAI provider readiness、提交 `pnpm-lock.yaml`、加入 manual OpenAI smoke helper，并修复 deterministic retrieval candidate lookup。
- 主要变更：`pnpm-lock.yaml` 现在应被跟踪；`apps/api/scripts/openai-smoke.ts` 是 manual-only、secret-safe real-key smoke helper；DB candidate lookup 使用 raw terms + normalized variants；final retrieval scoring 继续使用 exact normalized tokens。
- QA 结果：人工验收已通过。`policies` / `warranties` raw plural candidate lookup 通过；`case` / `showcase` 弱 substring 回归检查通过；real OpenAI key smoke 因无 key 仍 pending/non-blocking。
- 验证摘要：`@platform/api` test/typecheck/lint/build 通过；`@platform/config` 和 `@platform/ai-core` typecheck/build 通过；OpenAI missing-env smoke 按预期失败且不打印 secret；lockfile secret grep 通过且确认包含 `openai@6.41.0`。

## 已实现能力

- Tenant 通过 `x-tenant-slug` header 解析；SSE/EventSource 支持 query `tenantSlug`。
- Tenant-scoped chat message 保存、conversation 创建/续接、匿名 visitorId 持久化。
- Deterministic knowledge retrieval + deterministic/OpenAI LLM provider reply。
- Assistant message citations、retrieval metadata 和 provider metadata 会持久化到 `Message`。
- `@platform/ai-core` 提供 LLM provider boundary，API 当前通过 resolver 支持 deterministic 和 OpenAI provider。
- `AI_PROVIDER=deterministic` 是默认值；`AI_PROVIDER=openai` 要求 `OPENAI_API_KEY` 和 `OPENAI_MODEL`。
- OpenAI success citations 通过 shared backend citation helper 从 retrieved chunks 生成，不依赖 deterministic grounded sentence scoring。
- Knowledge retrieval 的 DB candidate lookup 使用 raw + normalized terms；final scoring 使用 exact normalized tokens，以保留 plural/stem 查询能力并减少 substring-only 弱匹配。
- `pnpm-lock.yaml` 已纳入依赖可复现策略。
- Knowledge base 支持创建、手动文本、文件文本、单 URL/批量 URL 导入、chunking、reprocess、archive、delete。
- Handoff 支持 customer 请求人工、support user 分配、agent reply。
- Realtime 当前是 2 秒一次的 SSE snapshot，不是 websocket 协作层。

## 当前限制

- OpenAI provider 已实现但真实 OpenAI success smoke test 尚未执行，因为当前没有 OpenAI API key。
- 尚未实现 embeddings、vector database、reranker。
- 短 keyword-style 问题仍可能产生弱相关 deterministic retrieval matches。
- `apps/ai-worker` 还没有队列、异步 ingestion 或后台 job。
- 没有完整 auth/RBAC；`Role` 只是 tenant-scoped membership。
- `lint`/`test` 多数仍是 TypeScript sanity check 或 placeholder。
- 前端大量使用 inline styles，尚未形成正式 design system。
- URL 导入使用简单 HTML text extraction，不是完整网页解析管线。

## 已观察风险

- 真实 OpenAI success smoke test 尚未执行；有 key 后需要补测 OpenAI success citations、provider metadata 和 retrieval metadata。
- real-key OpenAI smoke helper 是 manual-only；不要把它作为 normal/blocking automated test。
- 短 keyword-style questions 仍可能产生弱相关 deterministic retrieval matches。
- Tenant list/create 目前是 platform-level API，没有认证或管理员校验；生产化前需要补齐权限边界。
- Customer widget 使用 `/images/logo.png` 作为头像路径；作为独立 embeddable 包接入外部站点时需要确认静态资源策略。
- Realtime snapshot 每 2 秒拉取 conversation list 和 active conversation detail；数据量扩大后需要评估负载。

## 推荐下一步

1. 有 OpenAI key 后执行 manual real-key smoke test，重点验证 OpenAI success citations、provider metadata、retrieval metadata，确认不会泄露 key。
2. 继续观察 deterministic retrieval 的短 query 行为，尤其是 raw candidate lookup 扩大后是否仍被 exact normalized scoring 正确过滤。
3. 为 API 增加最小 auth/RBAC 方案，至少保护 tenant management 和 admin/agent actions。
4. 将 knowledge ingestion 从同步 API 请求逐步迁移到 worker/queue。
5. 规划 embeddings/vector retrieval，但不要在没有明确需求前引入。
