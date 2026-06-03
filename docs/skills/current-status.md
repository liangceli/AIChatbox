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

- 最新提交：`355e5f6 Add OpenAI provider with deterministic fallback`。
- 已接受任务：增加 OpenAI provider，并修复 OpenAI success citation preservation，使 successful OpenAI replies 直接从 retrieved chunks 生成 backend citations。
- 主要变更：`OpenAiLlmProviderService`、OpenAI prompt helper、shared `buildBackendCitations`、provider behavior tests、OpenAI env validation 和 provider resolver selection。
- 保持不变：没有 Prisma schema/UI/API request/response contract 变化；tenant scoping、retrieval、deterministic fallback、`PENDING_HUMAN` guard 保持。
- QA 结果：可以进入人工验收；QA fix 已接受，无 blocking issue。QA handoff 同时记录多项人工验收通过，真实 OpenAI success smoke test 因无 OpenAI key 未执行。
- 验证摘要：`@platform/api` test/typecheck/lint/build 通过；`@platform/config` 和 `@platform/ai-core` typecheck/lint/build 通过；config/ai-core tests 通过但仍是 placeholder。

## 已实现能力

- Tenant 通过 `x-tenant-slug` header 解析；SSE/EventSource 支持 query `tenantSlug`。
- Tenant-scoped chat message 保存、conversation 创建/续接、匿名 visitorId 持久化。
- Deterministic knowledge retrieval + deterministic/OpenAI LLM provider reply。
- Assistant message citations、retrieval metadata 和 provider metadata 会持久化到 `Message`。
- `@platform/ai-core` 提供 LLM provider boundary，API 当前通过 resolver 支持 deterministic 和 OpenAI provider。
- `AI_PROVIDER=deterministic` 是默认值；`AI_PROVIDER=openai` 要求 `OPENAI_API_KEY` 和 `OPENAI_MODEL`。
- OpenAI success citations 通过 shared backend citation helper 从 retrieved chunks 生成，不依赖 deterministic grounded sentence scoring。
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
- `pnpm-lock.yaml` 当前 ignored/untracked，但最新提交引入了 `openai` dependency；需要确认依赖可复现策略。
- 短 keyword-style questions 仍可能产生弱相关 deterministic retrieval matches。
- Tenant list/create 目前是 platform-level API，没有认证或管理员校验；生产化前需要补齐权限边界。
- Customer widget 使用 `/images/logo.png` 作为头像路径；作为独立 embeddable 包接入外部站点时需要确认静态资源策略。
- Realtime snapshot 每 2 秒拉取 conversation list 和 active conversation detail；数据量扩大后需要评估负载。

## 推荐下一步

1. 有 OpenAI key 后执行 real-key smoke test，重点验证 OpenAI success citations、provider metadata、retrieval metadata。
2. 确认 `pnpm-lock.yaml` 策略；当前 QA 记录 lockfile ignored/untracked 会削弱 dependency reproducibility。
3. 改善 deterministic retrieval 对短 keyword-style questions 的弱匹配问题，或在真实 embedding work 前增加更严格阈值。
4. 为 API 增加最小 auth/RBAC 方案，至少保护 tenant management 和 admin/agent actions。
5. 将 knowledge ingestion 从同步 API 请求逐步迁移到 worker/queue。
