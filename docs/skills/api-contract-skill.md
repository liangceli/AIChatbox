# API Contract Skill

## 2026-06-04 Admin Protection Header

Protected admin/agent/platform endpoints require one of:

- `x-admin-api-token: <ADMIN_API_TOKEN>`
- `Authorization: Bearer <ADMIN_API_TOKEN>`

Missing protection returns 401. Invalid protection returns 403. Customer chat/widget endpoints remain public but tenant-scoped.

Route map smoke expectation:

- Protected admin/platform endpoints, including tenants, knowledge management, admin conversation list/support-users/detail/messages, assignment, agent replies, message clearing, conversation deletion, and admin realtime snapshots, must reject missing tokens with 401, reject invalid tokens with 403, and accept a valid admin token.
- Public customer/widget endpoints, including customer chat, customer handoff, customer-scoped conversation detail/messages, and customer-scoped realtime SSE, must remain reachable without an admin token under the current alpha contract.
- `GET /v1/realtime/conversations` is admin-protected and returns tenant-scoped conversation snapshots containing the conversation list, `pendingHumanCount`, and `activeConversation` detail.
- `GET /v1/realtime/customer-conversation` is public but requires tenant slug, conversationId, and visitorId, and only returns that customer conversation snapshot.

## 基础规则

- API base: `http://localhost:4000/v1`
- 全局 prefix: `/v1`
- Tenant-scoped endpoints 必须带 `x-tenant-slug` header。
- Realtime SSE routes support query `tenantSlug` because EventSource cannot easily set custom headers.
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

返回 `TenantOverviewRecord[]`。当前没有 tenant middleware，但需要 admin protection token。

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
- `GET /v1/conversations/:conversationId`: admin-protected，返回 `ConversationSummary`。
- `GET /v1/conversations/:conversationId/detail`: admin-protected，返回 `ConversationDetail`。
- `GET /v1/conversations/:conversationId/customer-detail?visitorId=...`: public customer-scoped，返回 `ConversationDetail`。
- `GET /v1/conversations/:conversationId/messages`: admin-protected，返回 `ChatMessageRecord[]`。
- `GET /v1/conversations/:conversationId/customer-messages?visitorId=...`: public customer-scoped，返回 `ChatMessageRecord[]`。
- `POST /v1/conversations/:conversationId/handoff`: 请求人工。
- `POST /v1/conversations/:conversationId/assign`: 分配 support user。
- `POST /v1/conversations/:conversationId/agent-replies`: 发送人工回复。
- `DELETE /v1/conversations/:conversationId/messages`: 清空消息并重置 conversation 状态。
- `DELETE /v1/conversations/:conversationId`: 删除 conversation。

Handoff body:

- `visitorId`: required string; public customer handoff rejects missing/blank visitorId and rejects conversations that do not belong to that visitor
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

Current protection status: admin-protected. Admin-web consumes it through the server-side `/api/admin/...` proxy so the browser never receives `ADMIN_API_TOKEN`.

Data shape:

- `conversations`: `ConversationListItem[]`
- `pendingHumanCount`: number
- `activeConversation`: `ConversationDetail | null`

### `GET /v1/realtime/customer-conversation?tenantSlug=...&conversationId=...&visitorId=...`

Public customer-scoped SSE endpoint. Emits event type `customer_conversation_snapshot` every 2 seconds.

Data shape:

- `conversation`: `ConversationDetail | null`
