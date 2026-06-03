# Director Update

## 1. Completed Task

Completed and QA-accepted the LLM provider boundary implementation with deterministic fallback preserved.

Latest commit reviewed: `fb3ca66 Add LLM provider boundary with deterministic fallback`.

## 2. Accepted Changes

- `packages/ai-core` now defines shared LLM provider contracts, including request/response, tenant/agent/conversation context, retrieved chunk type, provider metadata, and `LlmProvider`.
- `apps/api` now depends on `@platform/ai-core` and calls the provider boundary from `ChatService`.
- `AssistantReplyService` now implements the deterministic `LlmProvider` and remains the default active provider.
- `LlmProviderResolverService` was added and currently resolves only the deterministic provider.
- Assistant message metadata now preserves existing retrieval metadata and adds internal provider metadata.
- No external LLM API is called, no API key is required, and deterministic fallback remains default.
- No Prisma schema, UI, API request shape, or API response shape change was introduced.

## 3. Verification Summary

- Latest QA result: 人工验收已通过。
- Automated verification recorded by Implementation: `@platform/api` typecheck/lint/build passed; `@platform/ai-core` typecheck/lint/build passed.
- Test commands for `@platform/api` and `@platform/ai-core` passed, but both are currently placeholder tests.
- Manual QA confirmed normal chat persistence, knowledge-hit deterministic responses with citations, knowledge-miss deterministic fallback, and expected `PENDING_HUMAN` blocking behavior.
- Manual QA confirmed no OpenAI, Anthropic, or other external LLM API key/config is needed.

## 4. Remaining Risks

- No automated behavioral tests yet cover the LLM provider boundary, deterministic provider output, or provider metadata persistence.
- Short keyword-style questions can still produce weak deterministic retrieval matches; QA judged this a known retrieval-quality limitation, not a regression from the provider boundary.
- Future non-deterministic providers must validate config explicitly and must not receive cross-tenant data or unrelated raw conversation history.

## 5. Updated Docs

- `docs/skills/ai-chatbox-skill.md`: updated chat flow and provider status.
- `docs/skills/backend-skill.md`: documented `@platform/ai-core`, `LlmProviderResolverService`, deterministic provider, and provider metadata persistence.
- `docs/skills/ai-data-skill.md`: documented provider boundary, shared retrieved chunk contract, deterministic provider default, and short-query retrieval limitation.
- `docs/skills/current-status.md`: recorded the accepted LLM provider boundary task, verification summary, and updated next tasks.
- `docs/skills/qa-skill.md`: added provider-boundary regression checks and QA observation about weak short-query retrieval matches.
- `docs/skills/decision-log.md`: recorded the architecture decision to put LLM provider contracts in `@platform/ai-core`.
- `docs/ai-handoff/director-update.md`: refreshed for this latest accepted implementation and QA result.

## 6. Recommended Next Tasks

1. Add targeted automated tests for deterministic provider behavior, provider metadata persistence, citations, fallback, and `PENDING_HUMAN` guard.
2. Improve deterministic retrieval quality for short keyword-style questions or tighten retrieval thresholds before real embeddings/LLM retrieval work.
3. Plan the first real provider implementation, likely OpenAI, behind explicit config validation and deterministic fallback.
