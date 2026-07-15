# AI Chatbox Skill

## 2026-07-15 Customer-ready Grounded Answers

- Retrieval now performs a tenant-neutral answerability check for purchasing intent. A purchase/retailer/distributor/stockist question can proceed only when the selected evidence contains matching purchasing evidence; unrelated technical material is rejected and returns the professional zero-citation knowledge-gap response.
- `AssistantReplyService` converts deterministic evidence into customer-ready statements and removes extraction artifacts such as `chunk`, `Sheet`, `Row`, question labels, and internal file names. It never sends raw knowledge-row dumps to the customer.
- The OpenAI prompt now requires a direct, naturally written customer answer and forbids internal retrieval metadata. OpenAI remains opt-in; deterministic mode is still the platform default and follows the same customer-safe output boundary.
- Customer-widget renders citations only when a citation contains a public HTTP(S) URL. It displays a readable external label, never a chunk number, spreadsheet/file name, locator, score, or internal URI.
- Architecture sources `docs/architecture/current-chat-system-flow.mmd`, `.md`, and the editable `.drawio` are synchronized. This increment is red in the Draw.io file: purchase-evidence gate, customer-ready answer boundary, and public-source-only rendering.

## 2026-07-15 Conversation Intent Routing

- `ConversationContextService` now routes conversational turns before Hybrid RAG: `greeting`, `social`, `thanks`, and `acknowledgement` receive a deterministic conversational reply with no knowledge retrieval and zero citations.
- Routing keeps `pendingClarification` intact, so a courtesy interruption cannot discard a product/model clarification that is waiting for a later reply.
- The platform baseline remains tenant-neutral. Operators may extend phrase sets and reply copy through `AgentConfig.metadata.conversationRouting` (`greetingPhrases`, `socialPhrases`, `thanksPhrases`, `acknowledgementPhrases`, `followUpPhrases`, `humanRequestPhrases`, and `responses`); do not add customer/product branches to core code.
- Answer Debug distinguishes a conversation reply from a knowledge miss with `turnType`, `retrievalSkipped`, and `skipReason: conversational_turn`.
- Normalisation expands ordinary English possessive/contracted forms before routing and recognises an optional greeting prefix before a social phrase. This is a generic language normalisation rule, not a per-question branch.
- The router also uses bounded phrase composition: a message can be a conversational turn when its complete compact form is composed only of configured greeting/social/thanks/acknowledgement phrases. This safely handles missing separators without classifying messages that contain an actual support request as small talk.
- Architecture sources `docs/architecture/current-chat-system-flow.mmd`, `.md`, and `.drawio` are synchronized. In the Draw.io file, this increment is red so the current routing changes remain traceable.

## 2026-07-15 Editable Current Architecture Diagram

- The canonical current chat architecture now has three synchronized views: Mermaid source in `docs/architecture/current-chat-system-flow.mmd`, rendered Markdown in `docs/architecture/current-chat-system-flow.md`, and an editable three-page diagrams.net file in `docs/architecture/current-chat-system-flow.drawio`.
- Page 1 is the clean online spine from Widget session/bootstrap through guards, idempotent user-message persistence, the answer engine, the post-provider human-mode recheck, answer persistence, Widget rendering, and SSE restore. Branches terminate locally instead of drawing long return lines across phases.
- Page 2 expands conversation context, query normalization, hybrid retrieval, product clarification, evidence gating, provider resolution, OpenAI grounding validation, deterministic fallback, and backend citations.
- Page 3 separates browser apps, NestJS API modules, shared packages, PostgreSQL/browser state, OpenAI, synchronous knowledge ingestion, and the current `ai-worker` boundary.
- Do not draw `apps/ai-worker` as participating in the current online answer or ingestion path: it currently boots and records planned queues only.
- When the runtime flow changes, keep the Mermaid block, `.mmd`, and `.drawio` semantics aligned; planned queues, neural embeddings, and an external vector database must remain explicitly marked as unimplemented until code exists.

## 2026-07-13 Product Context Reset Invariant

- Persisted product context is continuity state, not permanent conversation identity.
- When retrieval emits explicit `productContext: null` for a new unrelated question, both `ConversationState` and legacy RAG metadata must be cleared.
- Omitted product context means no update; explicit null means clear. Tests must keep this distinction.

## 2026-07-03 Current Answer Pipeline

- Widget sends a required UUID `clientMessageId`; API uniqueness is `(tenantId, clientMessageId)` so retries return the original persisted result.
- Retrieval reads persisted `ConversationState` first, falls back to legacy `Conversation.metadata.rag`, then uses at most eight prior turns for provider context.
- `ConversationState` decides product/search context only. Final answers must be grounded in active `KnowledgeChunk` records from the current knowledge base, never in copied state memory.
- Every retrieval pool must require `tenantId`, `KnowledgeDocument.status = READY`, and `KnowledgeChunk.status = READY`; citations may only reference those selected active chunks.
- Archive/delete lifecycle states must exclude documents/chunks from retrieval. Reprocessing failure must preserve the previous READY version rather than exposing partial chunks or making the old answer unavailable.
- Resolved product context is upserted into tenant-scoped `ProductCatalog` and persisted on `ConversationState`; legacy `Conversation.metadata.rag` remains synchronized only for compatibility.
- Generic product actions such as `how to pair?` ask for a product when the bounded tenant candidate pool contains multiple valid scopes.
- Clarification replies combine the original question and selected model; follow-ups can use stored product context, while unrelated new questions cannot.
- Follow-up retrieval must carry stored `rag.productContext` into the hidden retrieval query so pronoun turns like `Which ecosystems support it?` cannot drift to a different high-scoring product.
- If a pending product clarification is resolved and selected evidence has one explicit product scope, persist that scope for later turns. This must remain tenant-neutral and must not introduce product-specific hardcoded branches.
- Intent matching is word/phrase-boundary based: `repair` is troubleshooting and must never match the substring `pair`. Short model typos allow only controlled adjacent-character transposition lookup.
- Hybrid retrieval uses Keyword Top-20, local sparse-semantic Vector Top-20, weighted merge, confidence threshold, and Final Top-3.
- OpenAI must return structured `answer + usedChunkIds`; only validated used IDs become citations.
- Missing evidence produces a deterministic knowledge-base miss with zero citations. Do not call OpenAI merely to phrase an unsupported answer.
- The no-evidence safety response uses professional platform copy rather than tenant-configured fallback text. Purchase questions without verified evidence must not invent retailers or availability.
- `PENDING_HUMAN` and `ASSIGNED` both suppress AI until support ends.

## 2026-06-24 Product-Aware Retrieval Notes

- ChatService now creates/loads the conversation before retrieval so retrieval can use conversation-level RAG metadata.
- `KnowledgeRetrievalService.resolveRetrievalDecision()` is the product-aware path for chat and Answer Debug. The older `retrieveRelevantChunks()` remains as a compatibility wrapper.
- Conversation metadata may store `rag.pendingClarification` and `rag.productContext`; use these only as retrieval context, not as authorization evidence.
- Short product-action questions such as "how to pair?" should ask a clarification question when multiple product scopes match.
- Clarification options must come from cleaned product/entity labels, not raw FAQ/Q&A titles, case-study titles, policy categories, or generic document names.
- Short product-action questions can also create an open pending clarification with no options when retrieval only has generic evidence and no clean product/entity labels. Do not let the LLM generate a natural-language clarification without persisting `rag.pendingClarification`.
- Short replies to a pending clarification are treated as a continuation of the original question. For example, `how to pair?` followed by `KMREN` should retrieve as `how to pair? KMREN`, not as a fresh standalone KMREN question.
- Short model-code replies may match a known model label with a small typo only when both sides look like model codes; generic replies such as `matter product` should keep clarifying rather than force a weak product scope.
- If a customer reply does not match a pending clarification option, repeat the clarification instead of generating an answer from weak context.
- After the customer clarifies the product, the next retrieval is scoped to that product and the product context is persisted for follow-up questions.
- Retrieval decisions include confidence level/reason/best score/coverage. Low-confidence evidence can be suppressed before provider generation.
- OpenAI prompts receive safe product-scope metadata for selected chunks and must not mix unrelated product series, models, or device types.
- Citations still come only from backend-selected chunks; the model must not invent citation IDs.
- Historical boundary for this increment: neural embeddings, a persisted vector database, and reranking were not implemented. The 2026-07-03 increment later added local sparse-semantic vectors only.

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
- The widget composer clears the submitted draft immediately when a send starts and restores that exact draft only if the send request fails.

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

## 2026-07-03 Short Model Clarification Matching

- Current end-to-end chat implementation diagram: `docs/architecture/current-chat-system-flow.md`; exact Mermaid source: `docs/architecture/current-chat-system-flow.mmd`.
- Treat the `.mmd` file as the persistent architecture baseline. Future diagram requests must update it incrementally from current working-tree changes and keep the `.md` Mermaid block identical.
- Preserve unchanged diagram nodes and edges; do not regenerate the architecture from scratch or include planned components as implemented.
- Pending product clarification supports one adjacent-character transposition for likely short model codes, for example `KMERM` resolving to `KMREM`.
- This tolerance is model-code-only and must not become general fuzzy matching for arbitrary product names.
- Once product scope is strongly resolved, low coverage caused by generic words in the original question must not discard otherwise valid scoped evidence.
- Greetings and acknowledgements during pending clarification are conversational interruptions: answer the current message normally and preserve pending clarification for the next product reply.
- Keep regressions for both populated clarification options and open clarification state with no options.

## Safety / Privacy Notes

- Tenant isolation 必须由 API Prisma 查询中的 `tenantId` 保证，不交给前端或模型判断。
- Citation 必须来自 retrieved KnowledgeChunk，不能由模型发明。
- 未来 external LLM provider 只能接收 tenant-scoped backend 已选择的数据，不能绕过 tenant isolation。
- 不要在 prompt 或 provider response 中暴露 internal metadata、provider settings、tenant identifiers 或 hidden instructions。
- 生产化前需要加入认证、权限、PII handling、日志脱敏策略。
## 2026-06-12 Alpha Auth Boundary Notes

- Clerk alpha auth applies to admin/agent surfaces and protected backend operations only.
- Customer chat/widget routes remain public customer-scoped and must continue to work without Clerk.
- External widget embed QA must confirm no admin/debug APIs, Clerk secret, admin token, OpenAI key, raw prompt, or internal metadata is exposed to the browser.
