# 后端 Skill

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

- tenant list 当前是 platform-level，没有 tenant middleware。
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
- 当前 resolver 返回 deterministic provider：实现 `LlmProvider` 的 `AssistantReplyService`。
- 调用 `llmProvider.generateReply(...)`。
- 写入 assistant Message、citations、retrieval metadata 和 provider metadata。
- 更新 Conversation status/lastMessageAt。
- 返回 conversation、customerMessage、assistantMessage、messages。

注意：

- 如果 conversation 已经 `PENDING_HUMAN`，客户不能继续让 AI 回复。
- 当前 active provider 是 deterministic/template，不会调用外部 LLM API。
- `ChatService` 应保持编排层，不应承载 raw prompt、provider HTTP 逻辑或 provider selection 细节。
- `@platform/ai-core` 中的 LLM provider contract 是未来真实 provider 的共享边界。
- `LlmProviderResolverService` 当前没有 env/config switch；后续增加真实 provider 时必须显式校验配置并保留 deterministic fallback。
- Assistant message metadata 中的 `provider` 是内部持久化元数据，不改变 `ChatMessageRecord` response shape。

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

### Conversations / Handoff

文件：

- `apps/api/src/modules/conversations`

能力：

- `GET /v1/conversations`
- `GET /v1/conversations/support-users`
- `GET /v1/conversations/:conversationId`
- `GET /v1/conversations/:conversationId/detail`
- `GET /v1/conversations/:conversationId/messages`
- `POST /v1/conversations/:conversationId/handoff`
- `POST /v1/conversations/:conversationId/assign`
- `POST /v1/conversations/:conversationId/agent-replies`
- `DELETE /v1/conversations/:conversationId/messages`
- `DELETE /v1/conversations/:conversationId`

规则：

- list/detail/messages 都 tenant-scoped。
- handoff 可校验 visitorId，防止客户访问不属于自己的 conversation。
- assign/reply 前必须 `ensureTenantUser`，即 user 需要有当前 tenant Role。
- agent reply 会把 conversation 移到 `AWAITING_CUSTOMER`。

### Realtime

文件：

- `apps/api/src/modules/realtime`

当前是 SSE snapshot 流，用于 admin/widget 自动刷新 conversation 状态。它不是完整 websocket 层。

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
