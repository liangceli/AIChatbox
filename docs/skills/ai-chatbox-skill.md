# AI Chatbox Skill

## 范围

本文件描述当前 customer chatbox/widget 的真实实现。它不是完整 LLM chat product；当前回复由 API 中的 deterministic retrieval + deterministic assistant reply 生成。

## 前端入口

- Widget package: `apps/customer-widget/src/widget.tsx`
- Widget mount helper: `apps/customer-widget/src/mount.tsx`
- Admin-web 本地测试 surface: `apps/admin-web/app/components/customer-chat-surface.tsx`
- 本地测试 route: `apps/admin-web/app/chat/page.tsx`

`CustomerWidget` 接收：

- `tenantSlug`
- `apiBaseUrl`
- optional `visitorId`
- optional `theme.title`
- optional `theme.headerBackground`

## Visitor 与 Conversation

- Widget 使用 `@platform/utils` 的 `resolveAnonymousVisitorId` / `persistAnonymousVisitorId`。
- visitorId 按 tenant 持久化到 browser localStorage。
- 首次发送消息时，API 会按 `tenantId + visitorId` upsert `Customer`。
- 后续消息带上 `conversationId`，API 会校验 conversation 属于当前 tenant 和 visitor。

## Message Flow

1. 用户在 widget 输入消息。
2. Widget 调用 `POST /v1/chat/messages`。
3. 请求 header 必须包含 `x-tenant-slug`。
4. 请求 body 包含 `message`、可选 `conversationId`、可选 `visitorId`。
5. API 保存 customer message。
6. API 检索 tenant-scoped READY knowledge chunks。
7. `AssistantReplyService` 生成 deterministic assistant reply。
8. API 保存 assistant message、citations、retrieval metadata。
9. API 返回完整 messages 数组。
10. Widget 更新 conversation state 并持久化 visitorId。

## Handoff Flow

- Widget 中的 Human 按钮调用 `POST /v1/conversations/:conversationId/handoff`。
- body 包含 `visitorId` 和固定 reason。
- API 校验 visitorId 与 conversation customer 匹配。
- conversation 进入 `PENDING_HUMAN`。
- 系统写入 `HANDOFF_EVENT` message。
- Widget 在 pending 状态下禁用继续发送给 AI。

## Realtime Flow

- 有 conversation 后，widget 打开 `EventSource`：
  - `GET /v1/realtime/conversations?tenantSlug=...`
- API 每 2 秒发送 `conversation_snapshot` event。
- Widget 如果 snapshot 中包含当前 conversation，就拉取：
  - `GET /v1/conversations/:conversationId/detail`
- 这是 snapshot polling over SSE，不是 websocket。

## Prompt / Provider 状态

- 当前没有真实 prompt assembly。
- 当前没有 OpenAI 或其他 LLM provider 调用。
- `AgentConfig.systemPrompt` 已存在于数据模型，但当前 deterministic reply 没有真正使用它生成模型 prompt。
- `AgentConfig.fallbackMessage`、`welcomeMessage`、`handoffEnabled` 会影响 fallback 文案。

## Conversation History

- API 会返回当前 conversation 的完整 messages。
- 当前 deterministic assistant reply 不使用历史上下文生成回答。
- Conversation history 主要用于 UI 展示和 agent handoff，不是模型上下文。

## Safety / Privacy Notes

- Tenant isolation 必须由 API Prisma 查询中的 `tenantId` 保证，不交给前端或模型判断。
- Citation 必须来自 retrieved KnowledgeChunk，不能由模型发明。
- 生产化前需要加入认证、权限、PII handling、日志脱敏策略。

