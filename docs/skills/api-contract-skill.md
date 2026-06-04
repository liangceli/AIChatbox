# API Contract Skill

## 2026-06-04 Admin Protection Header

Protected admin/agent/platform endpoints require one of:

- `x-admin-api-token: <ADMIN_API_TOKEN>`
- `Authorization: Bearer <ADMIN_API_TOKEN>`

Missing protection returns 401. Invalid protection returns 403. Customer chat/widget endpoints remain public but tenant-scoped.

Route map smoke expectation:

- Protected admin/platform endpoints, including tenants, knowledge management, admin conversation list/support-users, assignment, agent replies, message clearing, and conversation deletion, must reject missing tokens with 401, reject invalid tokens with 403, and accept a valid admin token.
- Public alpha customer/widget endpoints, including customer chat, customer handoff, conversation detail/read, and realtime SSE, must remain reachable without an admin token under the current alpha contract.
- `GET /v1/realtime/conversations` is currently public alpha behavior. It returns tenant-scoped conversation snapshots containing the conversation list, `pendingHumanCount`, and `activeConversation` detail. This endpoint must be narrowed or protected before production.

## 基础规则

- API base: `http://localhost:4000/v1`
- 全局 prefix: `/v1`
- Tenant-scoped endpoints 必须带 `x-tenant-slug` header。
- `GET /realtime/conversations` 也支持 query `tenantSlug`，因为 EventSource 不方便设置自定义 header。
- DTO 使用 `class-validator`，全局 `ValidationPipe` 开启 `transform: true` 和 `whitelist: true`。
- 共享 request/response 类型定义在 `packages/types/src/index.ts`。

## Platform-level Endpoints

### `GET /v1/health`

返回：

- `status`
- `service`
- `mode`
- `timestamp`

### `GET /v1/tenants`

返回 `TenantOverviewRecord[]`。当前没有 tenant middleware，也没有 auth。

### `POST /v1/tenants`

Body:

- `name`: string, 1-120
- `slug`: string, 2-80, lowercase slug pattern
- `supportEmail?`: email, max 200
- `defaultLocale?`: string, max 20

创建 Tenant、AgentConfig、Default Knowledge Base；如果有 `supportEmail`，会 upsert User 并创建 Role。

## Chat

### `POST /v1/chat/messages`

Tenant-scoped。

Body:

- `message`: string, 1-4000
- `conversationId?`: string
- `visitorId?`: string

Response: `SendChatMessageResponse`

- `visitorId`
- `customerId`
- `conversation`
- `customerMessage`
- `assistantMessage`
- `messages`

规则：

- 空消息返回 400。
- 如果传入 conversationId，但不属于当前 tenant + visitor，返回 404。
- 如果 conversation 为 `PENDING_HUMAN`，不再生成 AI reply，返回 400。

## Conversations

所有 conversations endpoint 都是 tenant-scoped。

- `GET /v1/conversations?status=...`: 返回 `ConversationListItem[]`。
- `GET /v1/conversations/support-users`: 返回 `SupportUserRecord[]`。
- `GET /v1/conversations/:conversationId`: 返回 `ConversationSummary`。
- `GET /v1/conversations/:conversationId/detail`: 返回 `ConversationDetail`。
- `GET /v1/conversations/:conversationId/messages`: 返回 `ChatMessageRecord[]`。
- `POST /v1/conversations/:conversationId/handoff`: 请求人工。
- `POST /v1/conversations/:conversationId/assign`: 分配 support user。
- `POST /v1/conversations/:conversationId/agent-replies`: 发送人工回复。
- `DELETE /v1/conversations/:conversationId/messages`: 清空消息并重置 conversation 状态。
- `DELETE /v1/conversations/:conversationId`: 删除 conversation。

Handoff body:

- `visitorId?`: string
- `reason?`: string, max 500

Assign body:

- `userId`: string

Agent reply body:

- `userId`: string
- `message`: string, 1-4000

## Knowledge Bases

所有 knowledge endpoint 都是 tenant-scoped。

- `GET /v1/knowledge-bases`: list。
- `POST /v1/knowledge-bases`: create。
- `GET /v1/knowledge-bases/:knowledgeBaseId`: detail summary。
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents`: list documents。
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents`: create manual/file/url/integration source document from provided text.
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/import-url`: fetch and import one URL.
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/import-urls`: fetch and import up to 50 URLs.
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId`: document detail with chunks.
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/chunks`: chunks only.
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/reprocess`: rebuild chunks.
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/archive`: archive and remove chunks.
- `DELETE /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId`: delete document.

Create knowledge base body:

- `name`: string, 1-120
- `slug?`: string, max 120
- `description?`: string, max 500

Create document body:

- `title`: string, 1-200
- `content`: string, 1-50000
- `sourceType?`: string
- `sourceUri?`: string, max 1000
- `metadata?`: object

Import URL body:

- `url`: http/https URL, max 1000
- `title?`: string, max 200

Import URLs body:

- `urls`: 1-50 http/https URLs

Reprocess body:

- `content?`: string, 1-50000

## Realtime

### `GET /v1/realtime/conversations?tenantSlug=...&status=...`

SSE endpoint. Emits event type `conversation_snapshot` every 2 seconds.

Current protection status: public alpha behavior. It is tenant-scoped through `tenantSlug`, but does not require the admin API token because current browser/widget realtime flows depend on direct `EventSource` access. Before production, narrow this endpoint to the minimum widget-safe payload or protect/admin-split it with a server-side auth/proxy model.

Data shape:

- `conversations`: `ConversationListItem[]`
- `pendingHumanCount`: number
- `activeConversation`: `ConversationDetail | null`
