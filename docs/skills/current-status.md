# 当前状态

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

- 最新提交：`fb3ca66 Add LLM provider boundary with deterministic fallback`。
- 已接受任务：增加 LLM provider boundary，同时保留 deterministic assistant fallback。
- 主要变更：`@platform/ai-core` 新增共享 LLM provider contracts；API 新增 `LlmProviderResolverService`；`AssistantReplyService` 成为 deterministic `LlmProvider` implementation；`ChatService` 改为通过 provider boundary 生成回复。
- 保持不变：没有外部 LLM API 调用，没有 API key 需求，没有 Prisma schema/UI/API response shape 变化；tenant scoping、citations、retrieval metadata、message persistence、`PENDING_HUMAN` guard 保持。
- QA 结果：人工验收已通过。
- 验证摘要：`@platform/api` 和 `@platform/ai-core` 的 typecheck、lint、build 通过；test 命令通过但目前仍是 placeholder。

## 已实现能力

- Tenant 通过 `x-tenant-slug` header 解析；SSE/EventSource 支持 query `tenantSlug`。
- Tenant-scoped chat message 保存、conversation 创建/续接、匿名 visitorId 持久化。
- Deterministic knowledge retrieval + deterministic LLM provider reply。
- Assistant message citations、retrieval metadata 和 provider metadata 会持久化到 `Message`。
- `@platform/ai-core` 提供 LLM provider boundary，API 当前通过 resolver 固定使用 deterministic provider。
- Knowledge base 支持创建、手动文本、文件文本、单 URL/批量 URL 导入、chunking、reprocess、archive、delete。
- Handoff 支持 customer 请求人工、support user 分配、agent reply。
- Realtime 当前是 2 秒一次的 SSE snapshot，不是 websocket 协作层。

## 当前限制

- 尚未接入真实外部 LLM provider；`AssistantReplyService` 是 deterministic provider，仍是模板/规则回复。
- 尚未实现 embeddings、vector database、reranker。
- 短 keyword-style 问题仍可能产生弱相关 deterministic retrieval matches。
- `apps/ai-worker` 还没有队列、异步 ingestion 或后台 job。
- 没有完整 auth/RBAC；`Role` 只是 tenant-scoped membership。
- `lint`/`test` 多数仍是 TypeScript sanity check 或 placeholder。
- 前端大量使用 inline styles，尚未形成正式 design system。
- URL 导入使用简单 HTML text extraction，不是完整网页解析管线。

## 已观察风险

- 最新 workflow 提交包含 `apps/api/src/common/tenant/tenant-resolution.middleware.ts` 和 `apps/api/src/main.ts` 的注释型源码变更；QA 判定为可接受、低风险、无行为变化。
- Tenant list/create 目前是 platform-level API，没有认证或管理员校验；生产化前需要补齐权限边界。
- Customer widget 使用 `/images/logo.png` 作为头像路径；作为独立 embeddable 包接入外部站点时需要确认静态资源策略。
- Realtime snapshot 每 2 秒拉取 conversation list 和 active conversation detail；数据量扩大后需要评估负载。

## 推荐下一步

1. 为 deterministic provider boundary 增加 API/service unit tests，覆盖 fallback、citations、provider metadata persistence 和 `PENDING_HUMAN` guard。
2. 改善 deterministic retrieval 对短 keyword-style questions 的弱匹配问题，或在真实 LLM/embedding 工作前增加更严格阈值。
3. 为 API 增加最小 auth/RBAC 方案，至少保护 tenant management 和 admin/agent actions。
4. 在现有 `@platform/ai-core` contract 下规划真实 OpenAI provider，并保留 deterministic fallback。
5. 将 knowledge ingestion 从同步 API 请求逐步迁移到 worker/queue。
