# 前端 Skill

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

- The admin dashboard currently follows the Solaris AI `code.html` design reference: pale `#fbf8ff` background, white/glass surfaces, golden `#fec931` highlights, black primary text/buttons, sticky topbar, mobile drawer, statistics cards, knowledge table, ingest card, active chats, metadata, and human reply panels.
- Do not use the old `/images/logo.png` mark in the admin dashboard shell; the current design uses the `Solaris AI` wordmark text and tenant initials/profile imagery instead.
- Keep future admin UI changes consistent with this responsive pattern unless a new design brief replaces it.
