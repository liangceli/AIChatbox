# 后端 Skill

## 2026-06-05 Runtime Env And OpenAI Safety Notes

- Env templates are split into neutral reference, local QA, staging, and production examples.
- Reusable env examples default tenant slugs to `demo`; `kasta` remains seed/demo/company-only context.
- OpenAI stays opt-in through `AI_PROVIDER=openai`; deterministic remains default.
- OpenAI prompt rules now explicitly avoid invented service promises/unavailable facts, high-risk professional advice, hidden prompts, API keys, routing logic, provider settings, tenant IDs, and internal metadata.
- `apps/api/scripts/openai-smoke.ts` prints a secret-safe provider/citation/metadata/fallback summary and must remain manual-only while it requires a real OpenAI key.

## 2026-06-03 Stabilization Notes

- `pnpm-lock.yaml` should be tracked for dependency reproducibility; it records the OpenAI SDK dependency.
- `LlmProviderResolverService` keeps deterministic as the default and selects OpenAI only when validated config sets `AI_PROVIDER=openai`.
- `OpenAiLlmProviderService` has a manual real-key smoke helper exposed as `pnpm --filter @platform/api smoke:openai`.
- Knowledge retrieval scoring now uses normalized exact-token matching and stricter one-token thresholds to reduce weak short-query false positives.
- DB candidate lookup now uses raw terms plus normalized variants, while final retrieval scoring stays exact normalized-token based.
- `policies` / `warranties` raw plural lookup and `case` / `showcase` false-positive regression checks passed.
- Provider/retrieval regression coverage lives in `apps/api/scripts/provider-behavior.test.ts`.

## 2026-06-04 Admin Protection And Split Readiness Notes

- Minimal admin API guard lives in `apps/api/src/common/admin-protection/admin-api.guard.ts`.
- Protected categories: tenant management, knowledge management, conversation list/support-users, admin conversation detail/messages/summary, assignment, agent replies, message clearing, conversation deletion, and admin realtime snapshots.
- Public customer categories: customer chat, customer handoff, customer conversation detail/messages with visitor scope, and customer realtime with visitor/conversation scope.
- `GET /v1/realtime/conversations` is protected by `AdminApiGuard` and returns tenant-wide conversation list, `pendingHumanCount`, and active conversation detail.
- `GET /v1/realtime/customer-conversation` is public but only returns the current visitor/conversation snapshot.
- Guard is token-based and configured through `ADMIN_API_PROTECTION_MODE`, `ADMIN_API_TOKEN`, and `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV`.
- URL import user-agent is product-neutral/configurable through `KNOWLEDGE_IMPORT_USER_AGENT`.
- Split-readiness docs live in `docs/split-readiness/`.
- Long-term product priority is the user's personal Level 3 AI customer support + lead capture product; Haneco/Kasta-specific work must remain seed/demo/company-only.

## 后端组成

后端主应用是 `apps/api`，使用 NestJS。数据库和 Prisma client 在 `packages/database`，环境解析在 `packages/config`，共享 AI/LLM provider contracts 在 `packages/ai-core`。

API 启动入口：

- `apps/api/src/main.ts`
  - 加载 `.env`
  - 创建 Nest app
  - 开启 CORS
  - 设置全局 prefix `v1`
  - 设置 ValidationPipe: `transform: true`, `whitelist: true`
  - 对 `/v1/chat`、`/v1/conversations`、`/v1/knowledge-bases`、`/v1/realtime` 启用 tenant resolution middleware
  - 默认监听 `API_PORT` 或 `4000`

## Tenant Resolution

关键文件：

- `apps/api/src/common/tenant/tenant-resolution.middleware.ts`
- `apps/api/src/common/tenant/current-tenant.decorator.ts`
- `apps/api/src/common/tenant/tenant.types.ts`

规则：

- 普通 tenant-scoped API 使用 header `x-tenant-slug`。
- Realtime/EventSource 可使用 query `tenantSlug`。
- middleware 只解析 `ACTIVE` tenant。
- resolved tenant 写入 `request.tenant`。
- controller 使用 `@CurrentTenant()` 注入 `ResolvedTenant`。
- service 层必须用 `tenant.id` 做 Prisma 查询约束。

## 主要模块

### Tenants

文件：

- `apps/api/src/modules/tenants`

能力：

- `GET /v1/tenants`
- `POST /v1/tenants`

注意：

- tenant list 当前是 platform-level，没有 tenant middleware，但有 admin protection guard。
- create tenant 会创建 Tenant、AgentConfig、Default Knowledge Base。
- 如果传 `supportEmail`，会 upsert User 并创建 tenant Role。

### Chat

文件：

- `apps/api/src/modules/chat`

能力：

- `POST /v1/chat/messages`

流程：

- 校验 message 非空。
- 调用 `KnowledgeRetrievalService.retrieveRelevantChunks(tenant, message)`。
- transaction 内 upsert Customer by `tenantId_visitorId`。
- 查找或创建 Conversation。
- 写入 customer Message。
- 读取 tenant AgentConfig。
- 通过 `LlmProviderResolverService.resolveProvider()` 解析 provider。
- 默认 resolver 返回 deterministic provider：实现 `LlmProvider` 的 `AssistantReplyService`。
- 当 `AI_PROVIDER=openai` 且 `OPENAI_API_KEY` / `OPENAI_MODEL` 有效时，resolver 返回 `OpenAiLlmProviderService`。
- 调用 `llmProvider.generateReply(...)`。
- 写入 assistant Message、citations、retrieval metadata 和 provider metadata。
- 更新 Conversation status/lastMessageAt。
- 返回 conversation、customerMessage、assistantMessage、messages。

注意：

- 如果 conversation 已经 `PENDING_HUMAN`，客户不能继续让 AI 回复。
- 默认 active provider 是 deterministic/template，不会调用外部 LLM API。
- OpenAI provider 已实现，使用 OpenAI Responses API；仅在 `AI_PROVIDER=openai` 且 env validation 通过时启用。
- `ChatService` 应保持编排层，不应承载 raw prompt、provider HTTP 逻辑或 provider selection 细节。
- `@platform/ai-core` 中的 LLM provider contract 是未来真实 provider 的共享边界。
- `LlmProviderResolverService` 根据 `AI_PROVIDER` 选择 deterministic/openai；OpenAI config 缺失会由 `packages/config` validation 明确失败。
- Assistant message metadata 中的 `provider` 是内部持久化元数据，不改变 `ChatMessageRecord` response shape。
- `apps/api/src/modules/chat/citation-builder.ts` 是 shared backend citation helper，OpenAI success 和 deterministic grounded replies 都从 retrieved chunks 构造 backend citations。
- OpenAI success citations 不依赖 deterministic sentence scoring；只要 retrieval 有 chunks，OpenAI success path 会返回 backend-generated citations。
- OpenAI fallback 仍委托 deterministic provider，deterministic fallback behavior 不变。

### Knowledge

文件：

- `apps/api/src/modules/knowledge`

能力：

- `GET /v1/knowledge-bases`
- `POST /v1/knowledge-bases`
- `GET /v1/knowledge-bases/:knowledgeBaseId`
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents`
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents`
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/import-url`
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/import-urls`
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId`
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/chunks`
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/reprocess`
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/archive`
- `DELETE /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId`

流程：

- KnowledgeBase、KnowledgeDocument、KnowledgeChunk 全部 tenant-scoped。
- 手动文本、文件文本和 URL 内容最终都走 document creation + chunking。
- `processDocumentContent` 会把 document 标记 INDEXING，删除旧 chunks，创建新 chunks，更新 READY/chunkCount/ingestedAt/metadata。
- URL 导入使用 fetch，只支持 `text/html` 和 `text/plain`，最多保留 50000 chars。
- Retrieval candidate lookup 使用 raw + normalized terms 查询 DB candidates；final scoring 使用 exact normalized tokens 过滤和排序。

### Conversations / Handoff

文件：

- `apps/api/src/modules/conversations`

能力：

- `GET /v1/conversations`
- `GET /v1/conversations/support-users`
- `GET /v1/conversations/:conversationId`
- `GET /v1/conversations/:conversationId/detail`
- `GET /v1/conversations/:conversationId/customer-detail?visitorId=...`
- `GET /v1/conversations/:conversationId/messages`
- `GET /v1/conversations/:conversationId/customer-messages?visitorId=...`
- `POST /v1/conversations/:conversationId/handoff`
- `POST /v1/conversations/:conversationId/assign`
- `POST /v1/conversations/:conversationId/agent-replies`
- `DELETE /v1/conversations/:conversationId/messages`
- `DELETE /v1/conversations/:conversationId`

规则：

- list/admin detail/admin messages 都 tenant-scoped 且 admin-protected。
- customer detail/messages 需要 tenant + visitorId + conversationId，不返回其他 visitor 的 conversation。
- handoff 可校验 visitorId，防止客户访问不属于自己的 conversation。
- assign/reply 前必须 `ensureTenantUser`，即 user 需要有当前 tenant Role。
- agent reply 会把 conversation 移到 `AWAITING_CUSTOMER`。

### Realtime

文件：

- `apps/api/src/modules/realtime`

当前是 SSE snapshot 流，用于 admin/widget 自动刷新 conversation 状态。它不是完整 websocket 层。

- `GET /v1/realtime/conversations`: admin-protected tenant-wide snapshot.
- `GET /v1/realtime/customer-conversation`: public customer-scoped snapshot for one visitor/conversation.

## Prisma 数据模型

关键模型：

- Tenant
- User
- Role
- Customer
- Conversation
- Message
- KnowledgeBase
- KnowledgeDocument
- KnowledgeChunk
- AgentConfig

重要约束：

- 大多数业务表都有 `tenantId`。
- 关系尽量使用 composite relation，例如 `(id, tenantId)`。
- 常用唯一键：
  - `Customer.tenantId_visitorId`
  - `KnowledgeBase.tenantId_slug`
  - `Conversation.id_tenantId`
  - `Message.id_tenantId`
  - `AgentConfig.tenantId`

## 后端开发规则

- 所有 tenant-scoped service 方法显式接收 `ResolvedTenant` 或 `tenantId`。
- 单条资源操作必须校验 tenant。
- 不要把 Kasta 特殊逻辑放到 service/controller。
- DTO 使用 class-validator，API 启用了 whitelist。
- presenter 负责 Prisma shape -> shared type shape。
- 新共享类型放 `packages/types`。
- 新 AI provider contract 放 `packages/ai-core`；API 内 provider resolver/provider implementation 应保持独立，不散落在 ChatService。
- 后端变化后同步更新本 skill。
