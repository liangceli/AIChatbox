# 前端 Skill

## 2026-06-12 Answer Debug RAG Indicators

- Admin Answer Debug shows safe retrieval confidence, source diversity, and warning text from the backend.
- Do not expose raw prompts, hidden rules, provider secrets, tenant IDs, `sourceLocator`, admin tokens, or OpenAI keys in the browser.
- Keep the Knowledge/Answer Debug UI practical; do not redesign the dashboard for RAG diagnostics.

## 2026-06-12 Knowledge Debug And Management UX

- `/admin` Knowledge Base includes an Answer Debug panel that calls protected `/api/admin/chat/answer-debug` through the existing server-side proxy.
- The panel has idle/loading/error/success states and displays generated answer, knowledge hit/miss reason, retrieved chunk previews/scores, backend citations, fallback state, and safe provider metadata.
- Knowledge management now exposes document status/source/chunk count/ingested time/checksum, admin-only chunk previews, URL import, and clear reprocess/archive/delete feedback.
- Browser code never receives `ADMIN_API_TOKEN`, `OPENAI_API_KEY`, raw prompts, or hidden tenant profile rules.

## 2026-06-12 Chat Restore And Latest-Message UX

- `/chat` is force-dynamic and fetches the public tenant profile server-side with `x-tenant-slug`, then passes it to `CustomerWidget` as `initialProfile`.
- `CustomerWidget` still refreshes the public profile client-side, but keeps the initial server profile while that request runs.
- Customer conversation ID is persisted in browser localStorage under a tenant-scoped key and restored through the customer-scoped detail endpoint after reload.
- Stored conversation IDs are removed when restore returns 403 or 404; transient request failures keep the ID so a later refresh can retry.
- Customer widget message history and admin/agent Human Reply history auto-scroll to the latest message when selection or message content changes.

## 2026-06-10 Admin Interaction And Profile Media Notes

- Admin topbar is a viewport-fixed sibling of the scrolling `.admin-screen`, not nested inside it; both use the shared `--admin-topbar-height` value so the menu remains fixed and content is not covered.
- Main dashboard modules, cards, conversation rows, history messages, controls, and agent surfaces provide hover/active/entry feedback while respecting `prefers-reduced-motion`.
- The selected conversation's complete chronological customer/AI/agent/system history renders inside the Human Reply card for every conversation status, not only during handoff.
- AI Profile Primary Color uses a visible current-color preview, eight clickable preset swatches, a native custom color picker, and an editable hex value.
- AI Profile Avatar and Logo are upload-first controls with preview/remove actions; an always-visible http/https URL input remains available as a secondary option.
- AI Profile Avatar/Logo Remove keeps an empty form value locally and sends explicit `null` on save so previously persisted media is actually cleared after reload.
- Explicit media removal remains cleared even when older widget settings or tenant branding contain a Logo/Avatar fallback.
- Frontend image uploads accept PNG/JPEG/WebP/GIF up to 1 MB and send a data image URL through the existing protected AI Profile save path.

## 2026-06-05 Persistent Human Support UI Notes

- Customer widget no longer disables the composer during `pending_human`; customer messages continue to send to `POST /v1/chat/messages`, are saved for the agent, and do not receive an AI reply.
- During `pending_human`, the widget Human button becomes an explicit `End human` action that calls `POST /v1/conversations/:conversationId/handoff/end` with the current `visitorId`.
- `/chat` local demo mirrors the widget behavior for manual QA.
- `ConversationOpsPanel` exposes a Human Mode control for `/admin` and `/agent`; it calls protected `/api/admin/conversations/:conversationId/human-support/start|end` through the existing admin-web server-side proxy.
- Agent replies keep human mode active until the customer or an admin/agent ends it.

## 前端组成

前端由两个主要 surface 组成：

- `apps/admin-web`: Next.js App Router 管理后台。
- `apps/customer-widget`: React embeddable customer widget package。

后台复用 widget package 来展示本地 customer chat surface，但 admin-facing 和 widget-facing 关注点仍应保持分离。

## Admin Web 路由

- `/`: 当前入口页，提供平台概览/跳转。
- `/admin`: 平台管理工作台。
- `/agent`: 人工 handoff inbox。
- `/chat`: 客户聊天测试页。

默认运行在 `http://localhost:3000`。API 默认来自 `NEXT_PUBLIC_API_BASE_URL`，tenant 默认来自 `NEXT_PUBLIC_DEFAULT_TENANT_SLUG`。

## Admin Console

Admin protection:

- The backend `AdminApiGuard` protects admin/platform API endpoints.
- `apps/admin-web` now uses a same-origin server-side proxy at `/api/admin/...` for protected admin/agent/platform calls.
- The browser authenticates to admin-web with an alpha access token through `/admin/access`; success sets an httpOnly sameSite cookie.
- `/admin/access?next=...` only accepts safe same-origin relative paths such as `/admin` and `/agent`; protocol-relative, absolute, and backslash URLs fall back to `/admin`.
- The Next route handler injects `x-admin-api-token` server-side. Browser code must not receive or send `ADMIN_API_TOKEN`.
- Required non-public env for proxy/gate: `API_INTERNAL_BASE_URL`, `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, `ADMIN_WEB_SESSION_SECRET`; optional `ADMIN_WEB_SESSION_COOKIE_NAME`, `ADMIN_WEB_SESSION_TTL_SECONDS`.
- Tenant AI Profile management lives in `app/components/tenant-ai-profile-panel.tsx` and calls protected `/api/admin/tenants/:tenantSlug/ai-profile` through the server-side proxy.
- The AI Profile panel supports loading, save success, and save failure states for assistant identity, company display name, tone/business fields, messages, safety instructions, and basic color/logo/avatar fields.

核心组件：

- `app/components/admin-console.tsx`
  - 加载 tenant 列表。
  - 创建 tenant。
  - 选择当前 tenant。
  - 展示 conversation、pending human、knowledge base 统计。
  - 嵌入 `KnowledgeBasePanel` 和 `ConversationOpsPanel`。
- `app/components/knowledge-base-panel.tsx`
  - tenant-scoped knowledge base 列表与创建。
  - manual document 创建。
  - text/markdown/json/csv 文件读取并作为 document 上传。
  - URL 单个/批量导入。
  - document detail、chunks 展示。
  - reprocess、archive、delete。
- `app/components/conversation-ops-panel.tsx`
  - conversation filter。
  - 支持用户加载。
  - conversation detail 和 messages 展示。
  - assign conversation。
  - send agent reply。
  - admin 模式下可 clear messages/delete conversation。
  - 使用 SSE `EventSource` 刷新 conversation snapshot。
- `app/components/agent-console.tsx`
  - 面向人工客服的 inbox。
  - 复用 `ConversationOpsPanel`，默认消息 newest first，不显示 admin delete 操作。
- `app/components/local-chat-demo.tsx` / `customer-chat-surface.tsx`
  - 用于本地验证客户聊天闭环。

## Customer Widget

Current realtime note: admin/agent `GET /v1/realtime/conversations` goes through the protected admin-web proxy and returns tenant-wide snapshots. Customer widget realtime uses `GET /v1/realtime/customer-conversation` with tenant slug, conversationId, and visitorId, and only receives that visitor's conversation detail.

Tenant profile note: the customer widget fetches `GET /v1/tenant-profile` with `x-tenant-slug` and uses only widget-safe profile fields for assistant name, company display name, welcome/handoff messaging, primary color, and avatar/logo. Internal prompt/safety rules are never returned to the widget.

核心文件：

- `apps/customer-widget/src/widget.tsx`
- `apps/customer-widget/src/mount.tsx`
- `apps/customer-widget/src/index.ts`

Widget 行为：

- 接收 `tenantSlug`、`apiBaseUrl`、可选 `visitorId`、可选 theme。
- 使用 `@platform/utils` 中的 anonymous visitor helper 解析/持久化 visitorId。
- 发消息到 `POST /chat/messages`，带 `x-tenant-slug`。
- 如果已有 conversation，则继续传 `conversationId`。
- 请求人工支持到 `POST /conversations/:conversationId/handoff`。
- 读取 customer-scoped conversation detail 到 `GET /conversations/:conversationId/customer-detail?visitorId=...`。
- 使用 SSE `GET /realtime/customer-conversation?tenantSlug=...&conversationId=...&visitorId=...` 检测当前 conversation 更新。
- 展示 assistant/agent/system/customer messages 和 citations。

## 前端 API 调用规则

- 除 tenant list/create 外，tenant-scoped API 请求必须带 `x-tenant-slug`。
- `realtime` 当前也支持 query `tenantSlug`，因为 EventSource 设置自定义 header 不方便。
- 共享 request/response 类型应来自 `@platform/types`。
- 不要在前端写死 Kasta，除非是在 demo seed 说明或本地默认 env。
- UI 可以内部工具优先，保持清晰、稳定、可扫描。

## 设计与维护注意点

- 目前大量组件使用 inline styles，`globals.css` 提供整体 shell 样式。
- 后续如重构 UI，优先保持 admin、agent、widget 三个 surface 的职责清晰。
- 复杂组件拆分时，不要跨 app import，公共类型/工具放 packages。
- 任何新增 tenant 配置项，都应从 API/AgentConfig/Tenant branding 流入前端，而不是硬编码到组件。
- 对话、知识库、handoff UI 变动后，同步更新本 skill。

## Admin Dashboard Visual Shell

- The admin dashboard currently follows the Solaris AI `code.html` design reference: pale `#fbf8ff` background, white/glass surfaces, golden `#fec931` highlights, black primary text/buttons, fixed topbar, mobile drawer, statistics cards, knowledge table, ingest card, active chats, metadata, and human reply panels.
- Do not use the old `/images/logo.png` mark in the admin dashboard shell; the current design uses the `Solaris AI` wordmark text and tenant initials/profile imagery instead.
- Keep future admin UI changes consistent with this responsive pattern unless a new design brief replaces it.

## 2026-06-05 Admin Handoff UX Notes

- `ConversationOpsPanel` renders selected conversation history inside the Human Reply card. History is chronological and includes customer, assistant, agent, system/handoff messages, message type labels, author names when available, and citations.
- `/admin` drawer navigation is feedback-driven: Dashboard, Knowledge Base, Conversations, and Settings scroll/focus existing page sections.
- Unimplemented drawer actions such as Analytics, Support, Account, and New Chatbot should remain non-destructive and show coming-soon feedback instead of navigating to a dead anchor.
## 2026-06-12 Clerk Alpha Auth Notes

- `/admin` and `/agent` now prefer Clerk alpha auth through `/sign-in` and `/sign-up`.
- Admin-web stores Clerk session JWTs only in an httpOnly sameSite cookie via `/api/auth/clerk/session` after server-side JWT signature/claims verification; do not use localStorage for Clerk/backend/admin tokens.
- `/admin`, `/agent`, and `/api/admin/...` must call the server-side Clerk token verifier before accepting the Clerk session cookie. Middleware can redirect quickly but is not the final auth proof.
- Browser admin operations continue to call same-origin `/api/admin/...`; the server proxy forwards Clerk Bearer auth when present and falls back to legacy `ADMIN_API_TOKEN` only for local/dev legacy access.
- `/admin/access` remains a local legacy fallback, not the primary staging/production auth path.
- Only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is browser-visible. Never expose `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `ADMIN_API_TOKEN`, `OPENAI_API_KEY`, database URLs, or session secrets.
