# API Contract Skill

## 2026-06-17 Clerk Alpha Auth Contract

- Protected admin/agent/platform APIs can run in `ADMIN_API_PROTECTION_MODE=clerk`.
- Clerk-mode requests must include `Authorization: Bearer <Clerk JWT>` from the admin-web server proxy, not directly managed browser secrets.
- Backend verification requires:
  - RS256 signature verified with `CLERK_JWT_KEY`
  - string `sub`
  - numeric unexpired `exp`
  - valid optional `nbf`
  - optional `CLERK_ISSUER` match
  - optional `CLERK_AUTHORIZED_PARTIES` / `azp` match
- Tenant-scoped protected endpoints require the Clerk user to map to an existing `User` and tenant `Role`.
- Platform tenant list/create require a mapped `User` with `isPlatformAdmin=true`.
- Legacy `x-admin-api-token` / `ADMIN_API_TOKEN` behavior remains only for documented token fallback mode and must be injected server-side, never exposed to the browser.
- Public customer routes remain Clerk-free and customer-scoped: chat messages, customer handoff, customer conversation detail/messages, customer realtime, and public tenant profile.
- Responses must not include Clerk secret key, JWT verification key, raw JWTs, auth headers, admin tokens, OpenAI keys, database URLs, session secrets, or internal tenant IDs unless already part of an explicit safe public contract.

## 2026-06-12 Answer Debug RAG Fields

- `POST /v1/chat/answer-debug` knowledge output includes safe `retrievalConfidence`, `sourceDiversity`, and `warnings`.
- These fields are diagnostic summaries only; they must not include raw prompts, tenant IDs, provider secrets, admin tokens, auth headers, or citation `sourceLocator`.
- OpenAI success still uses backend-generated citations from retrieved chunks.

## 2026-06-12 Knowledge URL Import Safety

- Protected single/batch knowledge URL import accepts only safe public HTTP(S) URLs.
- URLs with embedded credentials, local/internal/metadata hostnames, restricted/non-public IPs, DNS answers containing a restricted address, or redirects to restricted targets are rejected with a safe 400 response.
- Safe public redirects are followed up to five hops. Response bodies are limited to 2 MB and each outbound request has a true 15-second absolute deadline from request start, including continuously streaming responses.

## 2026-06-12 Protected Answer Debug

- `POST /v1/chat/answer-debug` is tenant-scoped and protected by `AdminApiGuard`.
- Body: `{ "question": string }`, length 1-4000.
- The response includes tenant slug/display name, question, answer, answer source, knowledge hit/miss reason/counts, requested/used provider mode, fallback state, allowlisted provider metadata, retrieved chunk previews/scores, and sanitized citations.
- The response must not include tenant IDs, raw prompts/hidden instructions, auth headers, API/admin tokens, provider secret config, or citation `sourceLocator`.
- Admin-web calls this route only through same-origin `/api/admin/chat/answer-debug`.
- Knowledge document records now include optional `checksum`, which was already stored in the existing Prisma model.

## 2026-06-10 Tenant Profile Image Sources

- `PATCH /v1/tenants/:tenantSlug/ai-profile` accepts `logoUrl` and `avatarUrl` as either an http/https URL up to 1000 characters or an uploaded PNG/JPEG/WebP/GIF data URL representing an image up to 1 MB.
- `PATCH /v1/tenants/:tenantSlug/ai-profile` treats explicit `logoUrl: null` or `avatarUrl: null` as a clear operation; omitted fields remain unchanged.
- Explicit media `null` also stops all older media fallback sources, including tenant branding Logo fallback; missing/`undefined` values may continue fallback.
- Other data URL MIME types, unsafe schemes, oversized sources, and malformed values are rejected.
- The route remains admin-protected and uses the existing admin-web server-side proxy.

## 2026-06-05 Persistent Human Support Mode

- `PENDING_HUMAN` is an explicit human-support mode, not a one-reply pause.
- `POST /v1/chat/messages` accepts customer messages during `PENDING_HUMAN`, saves them for the agent, returns updated `messages`, sets `assistantMessage: null`, and does not call the AI provider.
- If a conversation changes to `PENDING_HUMAN` while a provider call is already running, `POST /v1/chat/messages` discards that provider result, persists no assistant message, and returns `assistantMessage: null`.
- That provider-time suppression path preserves the latest persisted conversation activity timestamp; it must not move `lastMessageAt` backwards.
- `SendChatMessageResponse.assistantMessage` is nullable/optional when human support is active.
- Agent replies keep the conversation in `PENDING_HUMAN` until the customer or an admin/agent explicitly ends human support.
- Public customer end-human endpoint: `POST /v1/conversations/:conversationId/handoff/end` with `visitorId` and optional `reason`.
- Protected admin/agent controls:
  - `POST /v1/conversations/:conversationId/human-support/start`
  - `POST /v1/conversations/:conversationId/human-support/end`

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

## 2026-06-05 Tenant AI Profile Endpoints

Protected admin endpoints:

- `GET /v1/tenants/:tenantSlug/ai-profile`: returns full `TenantAiProfile`, including internal prompt guidance. Requires admin protection.
- `PATCH /v1/tenants/:tenantSlug/ai-profile`: updates profile fields. Requires admin protection. Validates trimmed strings, length limits, `#RRGGBB` primary color, and safe http/https or uploaded image sources for logo/avatar.

Public customer/widget endpoint:

- `GET /v1/tenant-profile`: tenant-scoped through `x-tenant-slug`, returns `PublicTenantAiProfile`.

Public profile fields:

- `assistantName`
- `companyDisplayName`
- `welcomeMessage`
- `fallbackMessage`
- `handoffMessage`
- `primaryColor`
- `logoUrl`
- `avatarUrl`

Public profile must not return safe answer instructions, sensitive topic instructions, do-not-answer instructions, provider settings, tenant IDs, admin tokens, OpenAI keys, or hidden metadata.

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
- `assistantMessage` (`null` when human support mode is active)
- `messages`

规则：

- 空消息返回 400。
- 如果传入 conversationId，但不属于当前 tenant + visitor，返回 404。
- 如果 conversation 为 `PENDING_HUMAN`，保存 customer message，不生成 AI reply，返回 `assistantMessage: null` 和最新 messages。

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
- `POST /v1/conversations/:conversationId/handoff/end`: customer-scoped 结束人工支持。
- `POST /v1/conversations/:conversationId/human-support/start`: admin-protected 开启人工模式。
- `POST /v1/conversations/:conversationId/human-support/end`: admin-protected 结束人工模式。
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

Human support control body:

- `userId?`: string
- `reason?`: string, max 500

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
## 2026-06-12 Admin Auth Contract

- Protected admin/agent endpoints can run in `ADMIN_API_PROTECTION_MODE=clerk`, where requests must include `Authorization: Bearer <Clerk JWT>`.
- The API verifies the JWT server-side and authorizes the user through tenant-scoped `Role` mapping before returning tenant data.
- Legacy `x-admin-api-token` / `Authorization: Bearer <ADMIN_API_TOKEN>` token protection remains only for the documented token fallback mode.
- Customer widget/chat/customer conversation routes remain public customer-scoped and must not require Clerk.
- API responses must not include Clerk JWTs, Clerk secret key, JWT verification key, admin tokens, auth headers, OpenAI keys, database URLs, or session secrets.
