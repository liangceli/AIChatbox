# Director Update

## 1. Completed Task

Completed OpenAI provider integration with deterministic fallback and accepted the QA fix for OpenAI success citation preservation.

Latest commit reviewed: `355e5f6 Add OpenAI provider with deterministic fallback`.

## 2. Accepted Changes

- `OpenAiLlmProviderService` was added behind the existing LLM provider boundary.
- `LlmProviderResolverService` now selects deterministic by default and OpenAI when `AI_PROVIDER=openai`.
- `packages/config` now validates OpenAI mode: `OPENAI_API_KEY` and `OPENAI_MODEL` are required when `AI_PROVIDER=openai`.
- `openai-prompt.ts` builds the OpenAI prompt from `LlmProviderRequest` support rules, retrieved knowledge context, and latest customer message.
- `citation-builder.ts` centralizes backend citation mapping from retrieved chunks.
- OpenAI success responses now preserve backend-generated citations from retrieved chunks, independent of deterministic sentence scoring.
- OpenAI provider failure/empty response/error paths fall back to deterministic behavior.
- API request/response contracts, Prisma schema, UI, tenant scoping, `PENDING_HUMAN`, and deterministic fallback behavior are unchanged.

## 3. Verification Summary

- Latest QA result: 可以进入人工验收; no blocking issue found.
- QA reran shell-verifiable checks: `@platform/api` test/typecheck/lint/build passed; `@platform/config` typecheck/lint/build passed; `@platform/ai-core` typecheck/lint/build passed.
- `@platform/api` test now includes mocked provider behavior tests, including OpenAI success citation preservation when deterministic grounding would return `citations: null`.
- Manual checks recorded by QA passed for health, deterministic knowledge hit/miss, handoff, `PENDING_HUMAN`, deterministic startup without OpenAI env, and OpenAI config validation failure when key/model are missing.
- Real OpenAI success smoke test was not run because no OpenAI API key is currently available.

## 4. Remaining Risks

- Real OpenAI success smoke testing remains pending until a valid OpenAI API key is available.
- `pnpm-lock.yaml` is ignored/untracked despite the new OpenAI dependency; confirm dependency reproducibility policy.
- Short keyword-style questions can still produce weak deterministic retrieval matches.
- Provider metadata remains additive and should continue to be tolerated by downstream metadata consumers.

## 5. Updated Docs

- `docs/skills/ai-chatbox-skill.md`: updated provider status, OpenAI mode, env requirements, prompt/citation behavior.
- `docs/skills/backend-skill.md`: documented OpenAI provider selection, env validation, citation helper, and fallback behavior.
- `docs/skills/ai-data-skill.md`: documented OpenAI provider behavior, shared citation helper, metadata, and citation preservation.
- `docs/skills/current-status.md`: recorded latest OpenAI provider/citation fix task, verification summary, risks, and next tasks.
- `docs/skills/qa-skill.md`: added OpenAI provider regression checks, mocked test location, and real-key smoke test gap.
- `docs/skills/deployment-skill.md`: updated runtime env docs for `AI_PROVIDER`, OpenAI key/model/tokens/timeout.
- `docs/skills/decision-log.md`: recorded OpenAI provider and OpenAI success citation decisions.
- `docs/ai-handoff/director-update.md`: refreshed for latest commit and QA handoff.

## 6. Recommended Next Tasks

1. When an OpenAI API key is available, run a real OpenAI success smoke test for retrieved chunks, citations, provider metadata, and retrieval metadata.
2. Confirm repository policy for `pnpm-lock.yaml` because ignored/untracked lockfile weakens dependency reproducibility with the new OpenAI dependency.
3. Improve deterministic retrieval quality for short keyword-style questions or tighten retrieval thresholds before embedding/vector work.
