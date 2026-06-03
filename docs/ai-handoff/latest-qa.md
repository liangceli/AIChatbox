# Latest QA Handoff

## 1. Overall Conclusion

人工验收已通过

The current implementation matches the task brief: it introduces a shared LLM provider boundary, keeps the deterministic assistant as the only active provider, and does not add external API calls, API keys, Prisma schema changes, UI changes, or tenant-specific hardcoding.

No blocking implementation issue was found. The repository owner manually tested the chat flow and reported the remaining checks passed. The observed inability to keep sending customer messages after requesting human support is expected for the current `PENDING_HUMAN` behavior.

## 2. Scope Check

The implementation stayed within the original task scope.

Scope notes:

- Added provider contracts in `@platform/ai-core`.
- Wired `apps/api` to resolve and call a provider instead of directly calling the deterministic reply method.
- Kept `AssistantReplyService` as the deterministic default provider.
- Preserved current retrieval, citation generation, message persistence, tenant scoping, and `PENDING_HUMAN` guard behavior.
- Did not add real OpenAI/Anthropic calls, API keys, env switches, UI changes, Prisma schema changes, or tenant-specific logic.
- `apps/api/src/modules/chat/llm-provider-resolver.service.ts` is a new untracked file and was reviewed separately because plain `git diff` does not show untracked file contents.

## 3. File-Level Diff Review

| File | Reasonable? | Risk | Notes |
| -- | -- | -- | -- |
| `packages/ai-core/src/index.ts` | Yes | Low | Adds shared LLM provider types, request/response metadata, retrieved chunk contract, and provider interface. This is the right package boundary for reusable AI contracts. |
| `apps/api/package.json` | Yes | Low | Adds `@platform/ai-core` dependency because API now imports provider contracts. |
| `apps/api/src/modules/chat/assistant-reply.service.ts` | Yes | Medium | Converts deterministic reply service into `LlmProvider` while preserving response text/citation behavior. Medium only because this is the core assistant generation path. |
| `apps/api/src/modules/chat/llm-provider-resolver.service.ts` | Yes | Low | New resolver returns the deterministic provider only. No inactive external mode is exposed at runtime. |
| `apps/api/src/modules/chat/chat.module.ts` | Yes | Low | Registers `LlmProviderResolverService` with the Chat module. |
| `apps/api/src/modules/chat/chat.service.ts` | Yes | Medium | Chat orchestration now calls the provider boundary and stores additive provider metadata. Existing retrieval metadata is preserved. |
| `apps/api/src/modules/knowledge/knowledge-retrieval.service.ts` | Yes | Low | Moves provider-facing chunk type to `@platform/ai-core`; retrieval query and scoring behavior remain unchanged. |
| `docs/ai-handoff/latest-implementation.md` | Yes | Low | Handoff accurately summarizes changed files, verification results, risks, and docs update suggestions. |
| `docs/ai-handoff/latest-qa.md` | Yes | Low | Updated by QA for the current review. |

## 4. Issues Found

| Issue | Severity | Must Fix? | Suggested Handling |
| -- | -- | -- | -- |
| No automated behavioral tests cover the provider boundary | P2 nice to fix | No | Current typecheck/build/lint passed, but API and ai-core tests are placeholders. Consider adding service tests later for deterministic provider behavior and metadata persistence. |
| New provider metadata is persisted but not exposed through `ChatMessageRecord` | P2 nice to fix | No | This is acceptable because it is additive internal metadata. Manual QA can inspect DB records if needed. |
| `apps/api/src/modules/chat/llm-provider-resolver.service.ts` is untracked | P1 should fix before commit | Yes before commit/stage | Ensure the new resolver file is included when staging the implementation. This is not a code defect, but the build would fail if omitted from the commit. |
| Deterministic retrieval can return weak semantic matches | P2 nice to fix | No | Manual examples such as short questions matching unrelated knowledge are consistent with the current keyword/substring retrieval scaffold, not a regression from the provider-boundary change. Track as a known retrieval-quality limitation. |

## 5. Regression Risks

Possible regression areas:

- `POST /v1/chat/messages`: now awaits `llmProvider.generateReply(...)` instead of calling `AssistantReplyService.generateReply(...)` directly.
- Assistant fallback behavior: still deterministic, but `usedFallback` moved into provider metadata and is then copied into `metadata.retrieval.usedFallback`.
- Citation persistence: citations are still generated from retrieved chunks, but this path now flows through `LlmProviderResponse`.
- Message metadata consumers: assistant messages now include an additive `metadata.provider` object.

No API response shape change was found. `ChatMessageRecord` still returns citations but not metadata.

Manual QA did not reveal a provider-boundary regression in the chat path.

## 6. Domain-Specific Check

This task touches AI chat response orchestration.

Domain-specific findings:

- The provider request only carries tenant-scoped data from the existing backend flow.
- Citations remain backend-generated from retrieved knowledge chunks, not invented by a model.
- The deterministic provider remains default, so no unsupported real LLM behavior is implied.
- The resolver currently returns deterministic mode only, which avoids runtime failure from unconfigured provider modes.
- No tenant branding, prompts, escalation rules, or Kasta-specific behavior were hardcoded.

## 7. Backend/API/Auth Check

Backend/API/Auth findings:

- Request shape: no change.
- Response shape: no change.
- Error handling: existing empty-message and `PENDING_HUMAN` guards are preserved.
- Validation: no DTO changes.
- Auth/session behavior: no change.
- Data persistence: assistant `metadata.provider` is added alongside existing retrieval metadata.
- Security/privacy: no API key handling, no external network call, and no cross-tenant provider path was introduced.

Residual concern:

- Future non-deterministic providers must validate config explicitly and must not receive cross-tenant data or raw unrelated conversation history.

## 8. Performance and Stability Check

No material performance issue was found.

Stability notes:

- The deterministic provider is synchronous but safely awaited by `ChatService`, which keeps the future async provider path ready.
- No frontend re-render, event listener, timer, polling, or API over-fetching changes were introduced.
- No large new dependency was added.
- Current retrieval still runs before the transaction exactly as before.

## 9. Verification Status / Manual QA

已完成的自动验证根据 implementation handoff 记录如下：

- `@platform/api` typecheck：通过
- `@platform/ai-core` typecheck：通过
- `@platform/api` lint：通过
- `@platform/ai-core` lint：通过
- `@platform/api` test：通过，但目前是 placeholder
- `@platform/ai-core` test：通过，但目前是 placeholder
- `@platform/api` build：通过
- `@platform/ai-core` build：通过

人工验收结果：已通过。

人工测试记录：

- 普通 chat 消息可以产生 customer/assistant 消息。
- knowledge 命中时仍返回 deterministic grounded response，并显示 citations。
- knowledge 未命中时仍返回 deterministic fallback。
- 请求 human support 后，conversation 进入 handoff / `PENDING_HUMAN` 路径，customer 无法继续触发 AI 回复；这是当前设计的正常行为。
- 未发现需要配置 OpenAI、Anthropic 或其他外部 LLM API key。
- 用户反馈其余手动检查均无问题。

人工观察：

- “what is ant”“can you fly” 这类短问题会命中不太相关的 FAQ/warranty/case-study 内容。这是当前 deterministic keyword/substring retrieval scaffold 的已知质量限制，不是本次 LLM provider boundary 引入的回归。

不建议把 `pnpm dev` 作为 blocking 验证命令；如需浏览器手动检查，再由人工启动本地 dev server。

## 10. Docs/Skills Update Needs

Project Context & Docs should update:

- `docs/skills/ai-chatbox-skill.md`: note that ChatService now calls an LLM provider boundary, with deterministic provider as the default.
- `docs/skills/backend-skill.md`: record `@platform/ai-core` provider contracts and `LlmProviderResolverService` in the Chat section.
- `docs/skills/ai-data-skill.md`: note that retrieved chunks now use the shared provider-facing `LlmRetrievedKnowledgeChunk` contract.
- `docs/skills/current-status.md`: record completion of the provider boundary task and verification summary.
- `docs/skills/qa-skill.md` or `docs/skills/current-status.md`: optionally record that manual QA confirmed `PENDING_HUMAN` blocks further AI replies and that short-query false positives remain a deterministic retrieval limitation.
- `docs/skills/decision-log.md`: optionally record the architecture decision that real LLM providers should plug into `@platform/ai-core` contracts instead of directly into `ChatService`.

QA should not directly modify `docs/skills`; that remains owned by Project Context & Docs under the repository handoff workflow.

## 11. Handoff File Update

`docs/ai-handoff/latest-qa.md` was updated for this review.

This QA handoff used:

- `docs/ai-handoff/latest-implementation.md`
- `git status --short`
- `git diff --stat`
- `git diff --name-only`
- `git diff`
- direct reads of the untracked resolver and related chat/AI files

## 12. Fix Request for Implementation Chat

No fix request required for Codex Chat 2.

Before commit/staging, ensure `apps/api/src/modules/chat/llm-provider-resolver.service.ts` is included, because it is currently untracked and required by `chat.module.ts` / `chat.service.ts`.
