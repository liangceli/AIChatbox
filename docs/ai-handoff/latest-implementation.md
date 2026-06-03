# Latest Implementation Handoff

## 1. Original Task Brief

Task title: Add LLM Provider Boundary While Preserving Deterministic Assistant Fallback

Summary:

- Create a clean backend/provider boundary for future real LLM integrations.
- Do not call any real external LLM API.
- Keep the current deterministic/template assistant behavior as the default.
- Preserve tenant-scoped chat flow, message persistence, citations, retrieval metadata, and `PENDING_HUMAN` behavior.
- Avoid new large AI dependencies, Prisma schema changes, UI changes, and tenant-specific hardcoding.
- Update this handoff file after implementation.

## 2. Changed Files

| File | Why it changed |
| -- | -- |
| `packages/ai-core/src/index.ts` | Added shared LLM provider request/response, retrieved chunk, tenant/conversation/agent context, metadata, provider mode, and provider interface contracts. |
| `apps/api/package.json` | Added `@platform/ai-core` as an API workspace dependency because API now imports the shared provider contract. |
| `apps/api/src/modules/chat/assistant-reply.service.ts` | Converted the existing deterministic reply service into the default `LlmProvider` implementation while preserving its reply and citation behavior. |
| `apps/api/src/modules/chat/llm-provider-resolver.service.ts` | Added a small resolver that currently returns the deterministic provider and prepares the API for future provider selection. |
| `apps/api/src/modules/chat/chat.module.ts` | Registered the provider resolver in the Chat module. |
| `apps/api/src/modules/chat/chat.service.ts` | Updated chat orchestration to call the provider boundary instead of directly calling hardcoded deterministic generation, and persisted provider metadata alongside retrieval metadata. |
| `apps/api/src/modules/knowledge/knowledge-retrieval.service.ts` | Updated retrieval output typing to use the shared `LlmRetrievedKnowledgeChunk` contract after moving the provider-facing type out of chat internals. |
| `docs/ai-handoff/latest-implementation.md` | Updated this implementation handoff for Codex Chat 3 and Project Context & Docs. |

## 3. Implementation Summary

Introduced a small LLM provider boundary in `@platform/ai-core` and wired `apps/api` to use it. The existing `AssistantReplyService` remains the deterministic implementation, now implementing `LlmProvider`. `ChatService` resolves a provider through `LlmProviderResolverService`, awaits `generateReply`, and stores the same assistant content/citations as before.

No external provider integration was added. No API key is required. No Prisma schema, UI, tenant resolution, handoff, or customer-widget behavior was changed.

## 4. User-Visible Changes

There should be no material user-visible change. Chat responses continue to use the existing deterministic fallback/retrieval behavior. Citations should still appear when matching knowledge chunks are retrieved, and fallback messages should remain deterministic when there is not enough matching evidence.

## 5. Technical Notes

- `LlmProviderRequest` carries only tenant-scoped data selected by the existing API flow: tenant context, conversation id, agent config, latest customer message, and retrieved chunks.
- `LlmProviderResponse` returns response content, citations, and provider metadata.
- Deterministic metadata currently records:
  - `providerName: "deterministic"`
  - `mode: "deterministic"`
  - `deterministic: true`
  - `usedFallback`
- Assistant message metadata now includes:
  - existing `retrieval.usedFallback`, `retrievedChunkCount`, and `chunkIds`
  - new `provider.name`, `provider.mode`, and `provider.deterministic`
- Citation persistence is preserved because citations are still derived from retrieved knowledge chunks and written to `Message.citations`.
- The resolver currently has no env/config switch. This avoids introducing inactive modes that could fail at runtime before real provider support exists.
- `pnpm install --lockfile-only` was run after adding the workspace dependency; it produced no git diff in `pnpm-lock.yaml`, and the lockfile already contains the `@platform/ai-core` entry.

## 6. Verification Results

| Command / Check | Result | Notes |
| -- | -- | -- |
| `Get-Content docs\skills\ai-chatbox-skill.md` | Passed | Read current chatbox/message flow guidance before code changes. |
| `Get-Content docs\skills\backend-skill.md` | Passed | Read backend/provider boundary guidance before code changes. |
| `Get-Content docs\skills\api-contract-skill.md` | Passed | Confirmed no API contract change was required. |
| `pnpm --filter @platform/api typecheck` | Failed before verification | Global `pnpm` was not recognized in the shell. Retried with local `node_modules/.bin/pnpm.CMD`. Not caused by this task. |
| `pnpm.cmd --filter @platform/api typecheck` | Failed before verification | Global `pnpm.cmd` was not recognized in the shell. Retried with local `node_modules/.bin/pnpm.CMD`. Not caused by this task. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api typecheck` through full PowerShell path | Passed after fix | First run exposed the old `RetrievedKnowledgeChunk` import in knowledge retrieval; fixed by importing `LlmRetrievedKnowledgeChunk` from `@platform/ai-core`. Final run passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/ai-core typecheck` through full PowerShell path | Passed | TypeScript provider contract compiles. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api lint` through full PowerShell path | Passed | Current lint script is `tsc --noEmit`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/ai-core lint` through full PowerShell path | Passed | Current lint script is `tsc --noEmit`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api test` through full PowerShell path | Passed | Placeholder test command: `No tests configured for api yet`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/ai-core test` through full PowerShell path | Passed | Placeholder test command: `No tests configured for ai-core yet`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api build` through full PowerShell path | Passed | API TypeScript build passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/ai-core build` through full PowerShell path | Passed | ai-core TypeScript build passed. |
| `.\node_modules\.bin\pnpm.CMD install --lockfile-only` through full PowerShell path | Passed | No lockfile git diff resulted. |
| `git diff` / `git status --short` | Passed | Reviewed changed files and confirmed scope. |

## 7. Manual QA Suggestions

- Send `POST /v1/chat/messages` with `x-tenant-slug` and a normal message; confirm customer and assistant messages are persisted.
- Send a message that matches READY knowledge content; confirm deterministic grounded response and citations still appear.
- Send a message that does not match knowledge content; confirm deterministic fallback still appears.
- Confirm a `PENDING_HUMAN` conversation still rejects further AI replies.
- Confirm no OpenAI/Anthropic/API key configuration is needed.
- Confirm tenant slug scoping still prevents access to another tenant's conversation or knowledge data.
- Inspect persisted assistant `metadata` to confirm `retrieval` remains present and `provider` metadata is added.

## 8. Risks / Notes

- This introduces a provider abstraction but no real external provider implementation.
- Provider metadata is newly stored in assistant message metadata. This should be low risk because it is additive, but QA should confirm any metadata consumers tolerate the extra `provider` object.
- There are no real unit tests yet for the chat provider boundary; current API and ai-core tests are placeholders.
- The resolver always returns deterministic mode. Future provider modes should be added carefully with explicit config validation and no cross-tenant data access.
- Some direct shell invocations produced Windows sandbox spawn errors. Verification succeeded by using the full PowerShell path and local `node_modules/.bin/pnpm.CMD`.

## 9. Docs Update Suggestions

- `docs/skills/ai-chatbox-skill.md`: update the message flow to say ChatService now calls an LLM provider boundary, with deterministic provider as default.
- `docs/skills/backend-skill.md`: record the new `@platform/ai-core` provider contract and `LlmProviderResolverService` in the Chat section.
- `docs/skills/ai-data-skill.md`: note that retrieval chunks now use the shared provider-facing chunk contract.
- `docs/skills/current-status.md`: record completion of the provider boundary task and verification summary.
- `docs/skills/decision-log.md`: optionally record the architecture decision that real LLM providers will plug into `@platform/ai-core` contracts instead of ChatService directly.
