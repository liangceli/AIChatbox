# AI Chatbox Skill

## 2026-06-12 RAG/Answer Debug Notes

- Answer Debug is the current safe inspection path for knowledge hits/misses, retrieval confidence, source diversity, citations, provider mode, fallback, and sanitized provider metadata.
- OpenAI context includes safe source title, chunk ID, source URL, retrieval score, and chunk content. It must not include raw hidden prompt text, tenant IDs, provider secrets, admin tokens, or auth headers.
- Real OpenAI QA remains manual and secret-managed; fake/local tokens are not alpha evidence.

## 2026-06-12 Admin Answer Debug Notes

- Admin-only `POST /v1/chat/answer-debug` uses the same tenant profile, retrieval, provider resolver, deterministic fallback, and backend citation paths as customer chat.
- It is intentionally non-persistent and does not affect customer conversation history or `PENDING_HUMAN`.
- OpenAI remains opt-in; deterministic remains the default. Automated tests use mocked providers only.
- Answer Debug never returns raw provider prompts, hidden profile rules, tenant IDs, API keys, admin tokens, auth headers, or provider secret configuration.

## 2026-06-12 Widget Restore Notes

- The customer widget persists the active conversation ID in tenant-scoped browser localStorage.
- After visitor ID resolution, the widget restores the stored conversation through `GET /v1/conversations/:conversationId/customer-detail?visitorId=...`.
- Restore remains tenant + visitor + conversation scoped. A 403 or 404 clears the stored conversation ID; transient failures keep it for a later retry.
- `/chat` provides an initial server-fetched public tenant profile so branding/messaging can render before the client profile refresh completes.
- Message history automatically scrolls to the latest message after restore, new messages, realtime updates, or status changes.

## 2026-06-05 Persistent Human Support Notes

- Handoff now persists as explicit `PENDING_HUMAN` mode until the customer or an admin/agent ends it.
- While `PENDING_HUMAN`, customer messages are still saved through `POST /v1/chat/messages`, but ChatService returns `assistantMessage: null` and does not call deterministic/OpenAI providers.
- After saving a customer message, ChatService re-reads the latest persisted conversation status before resolving an AI provider. This prevents an in-flight agent reply or human-mode start from being overwritten by a reply generated from stale pre-handoff state.
- ChatService also re-reads persisted conversation status after the provider returns and before saving an assistant message. If human mode started during provider generation, the generated reply is discarded, `assistantMessage` remains `null`, and `PENDING_HUMAN` is preserved.
- The post-provider `PENDING_HUMAN` suppression path returns the latest persisted conversation unchanged, so a newer handoff event `lastMessageAt` is never replaced by an older customer-message timestamp.
- Widget users can end human support themselves through `POST /v1/conversations/:conversationId/handoff/end`.
- Admin/agent users can start or end human mode through protected human-support endpoints; agent replies no longer automatically return the conversation to AI.

## 2026-06-05 Tenant AI Profile Notes

- Chat requests now pass a tenant AI profile into the LLM provider request.
- OpenAI prompt assembly uses assistant name, company display name, business type, tone, safe answer instructions, sensitive topic instructions, and do-not-answer instructions.
- Platform safety rules stay above tenant profile text and explicitly override conflicting tenant profile instructions.
- Public widget profile data includes only display-safe fields: assistant name, company display name, welcome/fallback/handoff messages, primary color, logo URL, and avatar URL.
- Public widget profile data must not expose internal prompt rules, provider settings, tenant IDs, API keys, admin tokens, or hidden metadata.
- Deterministic fallback still works without OpenAI and can use tenant fallback/handoff display messages.

## 2026-06-05 Runtime And OpenAI Safety Notes

- OpenAI remains opt-in; `AI_PROVIDER=deterministic` is still the safe default.
- OpenAI enablement steps live in `docs/runtime/openai-enable-checklist.md`.
- OpenAI smoke output is secret-safe and reports provider mode, real OpenAI attempt, assistant text, citations, metadata, and fallback state.
- OpenAI prompt rules explicitly prohibit invented policies/pricing/guarantees/service promises, high-risk professional advice, hidden prompt/API key/routing/provider disclosure, and model-invented citations.
- Env examples use `demo` as the reusable default tenant slug. `kasta` may be used only for local seed/demo or company-only context.

## 2026-06-03 Stabilization Notes

- Provider resolver defaults to deterministic and selects OpenAI only when `AI_PROVIDER=openai`.
- OpenAI mode requires `OPENAI_API_KEY` and `OPENAI_MODEL`; normal deterministic local chat does not.
- OpenAI success preserves backend citations directly from retrieved chunks.
- Manual real-key smoke helper: `pnpm --filter @platform/api smoke:openai`.
- Short keyword retrieval has been hardened with exact normalized token scoring to reduce weak substring matches.

## 范围

本文件描述当前 customer chatbox/widget 的真实实现。当前回复由 API 中的 LLM provider boundary 生成；默认是 deterministic provider，可通过 env 切换到 OpenAI provider。

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
7. `ChatService` 通过 `LlmProviderResolverService` 解析 LLM provider。
8. 默认 resolver 返回 deterministic provider；当 `AI_PROVIDER=openai` 且 OpenAI env 有效时返回 OpenAI provider。
9. API 保存 assistant message、citations、retrieval metadata 和内部 provider metadata。
10. API 返回完整 messages 数组。
11. Widget 更新 conversation state 并持久化 visitorId。

## Handoff Flow

- Widget 中的 Human 按钮调用 `POST /v1/conversations/:conversationId/handoff`。
- body 包含 `visitorId` 和固定 reason。
- API 校验 visitorId 与 conversation customer 匹配。
- conversation 进入 `PENDING_HUMAN`。
- 系统写入 `HANDOFF_EVENT` message。
- Widget 在 pending 状态下仍允许顾客继续发送消息给人工；这些消息不触发 AI。
- Widget 的 Human 按钮在 pending 状态下变为结束人工支持，由顾客显式恢复 AI。

## Realtime Flow

- 有 conversation 后，widget 打开 `EventSource`：
  - `GET /v1/realtime/conversations?tenantSlug=...`
- API 每 2 秒发送 `conversation_snapshot` event。
- Widget 如果 snapshot 中包含当前 conversation，就拉取：
  - `GET /v1/conversations/:conversationId/detail`
- 这是 snapshot polling over SSE，不是 websocket。

## Prompt / Provider 状态

- OpenAI provider 已实现，但默认不开启。
- OpenAI prompt assembly 位于 `apps/api/src/modules/chat/openai-prompt.ts`，只使用 `LlmProviderRequest` 中的 tenant-scoped backend-selected context。
- `@platform/ai-core` 已定义共享 LLM provider boundary，包括 provider request/response、provider metadata、tenant/agent/conversation context、retrieved chunk contract 和 `LlmProvider` interface。
- API 已通过 `apps/api/src/modules/chat/llm-provider-resolver.service.ts` 解析 provider。
- `AI_PROVIDER=deterministic` 是默认值，不需要 OpenAI key/model。
- `AI_PROVIDER=openai` 要求 `OPENAI_API_KEY` 和 `OPENAI_MODEL`，缺失时 config validation 会失败。
- `AgentConfig.systemPrompt` 已存在于数据模型，但当前 deterministic reply 没有真正使用它生成模型 prompt。
- `AgentConfig.fallbackMessage`、`welcomeMessage`、`handoffEnabled` 会影响 fallback 文案。
- Assistant message 内部 metadata 现在包含 `retrieval` 和 `provider` 两部分；`ChatMessageRecord` API response shape 不暴露 metadata。
- OpenAI success citations 由后端根据 retrieved chunks 通过 shared citation helper 生成，不依赖 deterministic grounded sentence scoring。
- OpenAI provider 失败、空响应、timeout、rate limit 或 auth/config 类问题会回退到 deterministic provider 行为。

## Conversation History

- API 会返回当前 conversation 的完整 messages。
- 当前 deterministic assistant reply 不使用历史上下文生成回答。
- Conversation history 主要用于 UI 展示和 agent handoff，不是模型上下文。

## Safety / Privacy Notes

- Tenant isolation 必须由 API Prisma 查询中的 `tenantId` 保证，不交给前端或模型判断。
- Citation 必须来自 retrieved KnowledgeChunk，不能由模型发明。
- 未来 external LLM provider 只能接收 tenant-scoped backend 已选择的数据，不能绕过 tenant isolation。
- 不要在 prompt 或 provider response 中暴露 internal metadata、provider settings、tenant identifiers 或 hidden instructions。
- 生产化前需要加入认证、权限、PII handling、日志脱敏策略。
