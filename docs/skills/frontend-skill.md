# 前端 Skill

## 2026-06-19 Admin Global Search

- The admin topbar search is a tenant-scoped resource search, not an AI question box.
- Empty input shows common navigation; queries of at least two characters debounce calls to protected `/api/admin/search` with the active `x-tenant-slug`.
- Results are grouped into Navigation, Conversations, and Knowledge and support Ctrl/Cmd+K focus, Arrow Up/Down, Enter, Escape, pointer selection, loading/error/empty states, and click-outside dismissal.
- Conversation results deep-link with `conversationId`; knowledge results deep-link with `knowledgeBaseId` and optional `documentId`, and destination panels initialize the selected resource from the URL.

## 2026-06-19 Dashboard Metric Navigation

- Dashboard metric cards are navigation links: Conversations opens `/admin/conversations?status=all`, Pending Human opens `/admin/conversations?status=pending_human`, and Knowledge Bases opens `/admin/knowledge-base`.
- `/admin/conversations` resolves its initial All/Alerts filter from the `status` query and passes it through `AdminConsole` to `ConversationOpsPanel`.
- Keep metric cards keyboard-focusable with a visible focus ring; do not replace them with click-only non-semantic containers.

## 2026-06-18 Admin Light Dark Theme Toggle

- Admin web has a persistent light/dark mode stored in `localStorage` under `admin-color-scheme`; `app/layout.tsx` applies it to `document.documentElement.dataset.theme` before rendering children.
- The admin topbar owns the icon-only theme toggle. New admin-web surfaces should use CSS variables instead of hardcoded light backgrounds so the saved mode applies across routes.
- AI Profile Avatar/Logo upload controls are icon-only buttons. Do not reintroduce visible "Choose image" text; keep accessible labels/titles, keep ordinary button text suppressed with `font-size: 0`, use `--on-primary-container` for automatic contrast against the primary-color button background, and avoid hover transforms on the upload label so the transparent file input does not jitter.

## 2026-06-18 Admin Theme Primary Color

- AdminConsole now loads the selected tenant AI Profile primary color and applies it as page-level CSS variables, so `/admin`, `/admin/knowledge-base`, and `/admin/conversations` share the same tenant theme.
- `TenantAiProfilePanel` pushes valid primary color changes to the shell immediately while keeping the saved AI Profile as the source of truth.
- Admin interactive fills, selected states, focus rings, upload controls, ingest/debug actions, drawer CTA, and human reply dark surfaces should use `--primary-*` variables instead of hardcoded black or static Solaris yellow values.
- Keep white content surfaces white; only non-white component backgrounds, borders, accents, and action fills should follow the tenant primary color.

## 2026-06-17 Admin Conversations Route Split

- `/admin` is now the dashboard-only admin workspace for stats and AI Profile work.
- Active Chats / conversation operations live on the dedicated `/admin/conversations` route instead of being embedded under `/admin`.
- Knowledge Bases, Ingest Data, document chunks, and Answer Debug live on the dedicated `/admin/knowledge-base` route instead of being embedded under `/admin`.
- The left drawer `Knowledge Base` item navigates to `/admin/knowledge-base`; `Conversations` navigates to `/admin/conversations`; `Dashboard` navigates back to `/admin`.
- `ConversationOpsPanel` remains the shared operations surface for admin/agent conversation lists, metadata, human mode, and Human Reply history.

## 2026-06-17 Clerk Alpha Auth Frontend Notes

- Admin-web Clerk auth is code-level closed out, but real local Clerk login smoke is pending user Dashboard/env setup.
- `/sign-in` and `/sign-up` may pass only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to browser code.
- Browser code posts the Clerk session token to `/api/auth/clerk/session`; it must not store Clerk/admin/backend tokens in localStorage.
- `/api/auth/clerk/session` sets the httpOnly Clerk session cookie only after server-side verification. Rejected tokens must not set cookies.
- `/admin`, `/agent`, and `/api/admin/...` reverify the Clerk cookie server-side. A forged cookie should redirect to sign-in or return 401; middleware cookie presence is not final auth proof.
- Admin operations continue to call same-origin `/api/admin/...`; the proxy forwards `Authorization: Bearer <Clerk JWT>` only after verification, or uses server-only legacy `x-admin-api-token` fallback after a valid legacy session.
- Customer `/chat` and embeddable widget routes remain public customer-scoped and do not require Clerk.
- Browser-visible env remains limited to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_BASE_URL`, and `NEXT_PUBLIC_DEFAULT_TENANT_SLUG`. Do not expose `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `ADMIN_API_TOKEN`, `OPENAI_API_KEY`, database URLs, raw auth headers, or session secrets.

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
- `/admin/knowledge-base`: admin knowledge workspace for Knowledge Bases, Ingest Data, document chunks, and Answer Debug.
- `/admin/conversations`: admin conversation operations workspace for Active Chats, metadata, human mode, and Human Reply.
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
  - Route-aware shell: `/admin` renders dashboard/profile sections; `/admin/knowledge-base` renders the standalone knowledge workspace; `/admin/conversations` renders the standalone conversation workspace.
  - 加载 tenant 列表。
  - 创建 tenant。
  - 选择当前 tenant。
  - 展示 conversation、pending human、knowledge base 统计。
  - 在 `/admin/knowledge-base` 嵌入 `KnowledgeBasePanel`，在 `/admin/conversations` 嵌入 `ConversationOpsPanel`。
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

- The admin dashboard currently follows the Solaris AI `code.html` design reference: pale `#fbf8ff` background, white/glass surfaces, golden `#fec931` highlights, black primary text/buttons, fixed topbar, mobile drawer, statistics cards, and profile panels. Knowledge table, Ingest Data, document chunks, and Answer Debug belong to `/admin/knowledge-base`. Active Chats, metadata, and human reply panels belong to `/admin/conversations`.
- Do not use the old `/images/logo.png` mark in the admin dashboard shell; the current design uses the `Solaris AI` wordmark text and tenant initials/profile imagery instead.
- Keep future admin UI changes consistent with this responsive pattern unless a new design brief replaces it.

## 2026-06-05 Admin Handoff UX Notes

- `ConversationOpsPanel` renders selected conversation history inside the Human Reply card. History is chronological and includes customer, assistant, agent, system/handoff messages, message type labels, author names when available, and citations.
- `/admin` drawer navigation keeps dashboard sections focused; Knowledge Base navigates to `/admin/knowledge-base` and Conversations navigates to `/admin/conversations` as their own pages.
- Unimplemented drawer actions such as Analytics, Support, Account, and New Chatbot should remain non-destructive and show coming-soon feedback instead of navigating to a dead anchor.
## 2026-06-12 Clerk Alpha Auth Notes

- `/admin` and `/agent` now prefer Clerk alpha auth through `/sign-in` and `/sign-up`.
- Admin-web stores Clerk session JWTs only in an httpOnly sameSite cookie via `/api/auth/clerk/session` after server-side JWT signature/claims verification; do not use localStorage for Clerk/backend/admin tokens.
- `/admin`, `/agent`, and `/api/admin/...` must call the server-side Clerk token verifier before accepting the Clerk session cookie. Middleware can redirect quickly but is not the final auth proof.
- Browser admin operations continue to call same-origin `/api/admin/...`; the server proxy forwards Clerk Bearer auth when present and falls back to legacy `ADMIN_API_TOKEN` only for local/dev legacy access.
- `/admin/access` remains a local legacy fallback, not the primary staging/production auth path.
- Only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is browser-visible. Never expose `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, `ADMIN_API_TOKEN`, `OPENAI_API_KEY`, database URLs, or session secrets.
## Tenant Theme Propagation

- Admin and Agent surfaces must use `apps/admin-web/app/lib/tenant-theme.ts` for primary, contrast, soft, border, focus, and shadow tokens.
- Agent tenant identity must come from the active AGENT membership returned by `/api/admin/account/me`, never from a public query parameter or default tenant env value.
- Agent theme data must be read from the redacted `/tenant-profile` contract; do not grant Agent access to the Owner-only tenant AI profile endpoint.
- Agent pending-human UX must show Claim for unassigned work; reply and end-support controls remain disabled until `assignedUser.id` equals the current account user id.

## Public Entry and Account UI

- `/` is the public Solaris AI homepage and the destination after every role signs out.
- `/sign-up` does not ask for a role. Unmapped users continue to `/access-pending`, where an email-bound invitation code activates access.
- Platform Admin account UI shows per-tenant Owner, Agent, suspended member, active Agent code, and quota counts; quota controls are limited to 0-5.
- Owner account UI can create/revoke Agent invitations only for the active authorized tenant. Agent UI includes an explicit Sign out command.

## 2026-06-22 Avatar and Knowledge Upload UI

- Knowledge file selection is controlled React state. Always show selected filename and size, provide remove and drag/drop actions, and clear both state and native input after successful ingestion.
- Do not use a transparent full-dropzone file input as the only interaction signal; users need visible attachment confirmation before ingestion.
- Clerk browser workers require the explicit CSP directive `worker-src 'self' blob:`.
- After `/api/auth/clerk/session` and `/api/admin/account/me` succeed, `/admin` navigation must not be rejected by middleware solely because middleware cannot see root Clerk env values.

- `/account` and `/admin/account` reuse `UserAvatarEditor`; the client crops to 512x512 and sends through the same-origin proxy.
- Account avatar is user-owned. It must not overwrite the tenant assistant avatar from AI Profile.
- Admin topbar and Agent header read `AccountRecord.avatarUrl` with an initials fallback.
- CSV/XLSX uses multipart without manually setting the Content-Type boundary; existing text files keep their JSON ingestion path.
- Show extracted record/Q&A counts and direct operators to chunk preview when structured fallback was used.
