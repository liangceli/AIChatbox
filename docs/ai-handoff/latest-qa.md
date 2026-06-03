# Latest QA Handoff

## 1. Overall Conclusion

可以进入人工验收

The QA fix is accepted. OpenAI success citations are now generated directly from retrieved chunks through `buildBackendCitations(input.retrievedChunks)` instead of depending on deterministic reply sentence scoring.

The previous P1 issue is resolved. QA also reran the shell-verifiable checks directly: API/config/ai-core test, typecheck, lint, and build passed. No new blocking issue was found in the QA fix.

## 2. Scope Check

The QA fix stayed within scope.

Scope notes:

- Added a shared backend citation builder for provider retrieved chunks.
- Updated deterministic provider to reuse the shared citation builder without changing its fallback behavior.
- Updated OpenAI success path to generate citations directly from retrieved chunks.
- Added a mocked regression test proving OpenAI success keeps citations even when deterministic grounding returns `citations: null`.
- Did not change frontend UI, Prisma schema, API request/response contract, retrieval scoring, OpenAI fallback behavior, or provider selection behavior.

## 3. File-Level Diff Review

| File | Reasonable? | Risk | Notes |
| -- | -- | -- | -- |
| `apps/api/src/modules/chat/citation-builder.ts` | Yes | Low | New helper maps `LlmRetrievedKnowledgeChunk[]` to backend `Citation[]`. This removes citation generation duplication and avoids coupling OpenAI success citations to deterministic sentence scoring. |
| `apps/api/src/modules/chat/assistant-reply.service.ts` | Yes | Low | Deterministic provider now uses `buildBackendCitations`. It still returns fallback with `citations: null` when no grounded points are found, preserving deterministic behavior. |
| `apps/api/src/modules/chat/openai-llm-provider.service.ts` | Yes | Low | OpenAI success path now returns `buildBackendCitations(input.retrievedChunks)` when chunks exist, otherwise `null`. This satisfies the QA fix request. |
| `apps/api/scripts/provider-behavior.test.ts` | Yes | Low | Adds regression coverage where deterministic generation returns `citations: null`, while mocked OpenAI success still returns retrieved chunk citations. |
| `docs/ai-handoff/latest-implementation.md` | Yes | Low | Accurately documents the QA fix, verification, remaining notes, and docs update suggestions. |
| `docs/ai-handoff/latest-qa.md` | Yes | Low | Updated by QA for this review. |

## 4. Issues Found

| Issue | Severity | Must Fix? | Suggested Handling |
| -- | -- | -- | -- |
| Untracked implementation files are still present | P1 should fix before commit | Yes before commit/stage | Ensure all new files are staged before commit, especially `citation-builder.ts`, OpenAI provider files, prompt helper, and provider tests. |
| Real OpenAI manual QA was not run here | P2 nice to fix | No | Mocked tests passed and QA reran shell-verifiable checks. User confirmed no real OpenAI key is currently available, so real-key smoke test remains pending/non-blocking. |
| `pnpm-lock.yaml` is ignored/untracked despite new dependency | P2 nice to fix | No | Existing repository state, but dependency reproducibility is weaker without a tracked lockfile. |

## 5. Regression Risks

The previous OpenAI citation regression risk is resolved.

Remaining possible regression areas:

- OpenAI mode still needs real-key smoke testing outside mocked tests when a key is available.
- Provider metadata persistence remains additive and should be tolerated by downstream metadata consumers.
- Dependency reproducibility depends on repository policy because `pnpm-lock.yaml` is ignored/untracked.

Default deterministic mode remains low risk. The deterministic provider still only returns citations when it produces a grounded answer, and OpenAI fallback still delegates to deterministic behavior.

## 6. Domain-Specific Check

This task touches AI chatbox/provider citation behavior.

Findings:

- OpenAI success citations are backend-generated from retrieved chunks.
- OpenAI does not invent citation IDs.
- Deterministic fallback behavior is unchanged.
- Prompt assembly remains scoped to `LlmProviderRequest`.
- `PENDING_HUMAN` behavior is not changed.
- No tenant-specific or Kasta-specific behavior was introduced.

## 7. Backend/API/Auth Check

Backend/API/Auth findings:

- Request shape: unchanged.
- Response shape: unchanged.
- Validation: unchanged.
- Auth/session behavior: unchanged.
- Data persistence: unchanged except previously added safe provider metadata.
- Security/privacy: no API keys, raw prompts, or raw provider errors are persisted by this fix.
- Citation persistence: OpenAI success now reliably preserves citations from retrieved backend chunks.

## 8. Performance and Stability Check

No new performance or stability issue was found.

The new citation helper is synchronous and maps at most the already retrieved chunks. It does not add network calls, database queries, event listeners, timers, polling, rendering work, or large state changes.

## 9. Verification Status / Manual QA

QA 本轮已直接执行的 shell 验证：

- `@platform/api` test：通过，包含 mocked OpenAI citation regression test；timeout fallback warning 是测试预期行为。
- `@platform/api` typecheck：通过。
- `@platform/config` typecheck：通过。
- `@platform/ai-core` typecheck：通过。
- `@platform/api` lint：通过。
- `@platform/config` lint：通过。
- `@platform/ai-core` lint：通过。
- `@platform/api` build：通过。
- `@platform/config` build：通过。
- `@platform/ai-core` build：通过。
- `@platform/config` test：通过，但目前是 placeholder。
- `@platform/ai-core` test：通过，但目前是 placeholder。
- `git status --short --untracked-files=all`：通过，确认仍有新增未跟踪实现文件需要提交前 stage。

人工验收结果：

- `GET http://localhost:4000/v1/health`：通过。
- deterministic mode knowledge hit：通过，assistant 正常回复并显示 citations。
- deterministic mode miss/fallback：通过，返回 fallback，citations 按 deterministic fallback 行为空。
- handoff request：通过。
- `PENDING_HUMAN` 后继续发 customer message：通过，API 拒绝继续触发 AI 回复。
- `AI_PROVIDER=openai` 且缺少 `OPENAI_API_KEY` / `OPENAI_MODEL`：通过，启动/config validation 清楚失败，未打印 key 值。
- `AI_PROVIDER=deterministic` 且无 OpenAI key/model：通过，API 正常启动。

未执行的人工项：

- 真实 OpenAI success smoke test：未执行，因为用户当前没有 OpenAI API key。该项为 non-blocking；在后续有 key 时建议补测。

后续有 OpenAI key 时建议补测：

- 在 `AI_PROVIDER=openai` 且 env 有效时，发送一个能 retrieve chunks 但用户问题和 chunk 文本不强重合的消息，确认 OpenAI 成功回复仍显示 citations。
- 确认 OpenAI success messages 仍持久化 provider metadata 和 retrieval metadata。

不建议把 `pnpm dev` 作为 blocking 验证命令；如需浏览器手动检查，再由人工启动本地 dev server。

## 10. Docs/Skills Update Needs

After manual acceptance, Project Context & Docs should update:

- `docs/skills/ai-data-skill.md`: note that OpenAI success citations are generated directly from retrieved chunks via a shared backend citation helper.
- `docs/skills/ai-chatbox-skill.md`: clarify that OpenAI success preserves citations independently from deterministic grounded sentence scoring.
- `docs/skills/backend-skill.md`: document the citation helper and OpenAI provider citation behavior.
- `docs/skills/qa-skill.md`: add the mocked OpenAI citation regression scenario and manual OpenAI citation QA check.
- `docs/skills/current-status.md`: record the QA fix and verification summary.

QA should not directly modify `docs/skills`; that remains owned by Project Context & Docs under the repository handoff workflow.

## 11. Handoff File Update

`docs/ai-handoff/latest-qa.md` was updated for this QA fix review.

This QA handoff used:

- `docs/ai-handoff/latest-implementation.md`
- `git status --short`
- `git diff --stat`
- `git diff --name-only`
- `git diff`
- direct reads of `citation-builder.ts`, `openai-llm-provider.service.ts`, `provider-behavior.test.ts`, and `assistant-reply.service.ts`

## 12. Fix Request for Implementation Chat

No fix request required for Codex Chat 2.

Before commit/staging, ensure all untracked implementation files are included:

- `apps/api/scripts/provider-behavior.test.ts`
- `apps/api/src/modules/chat/citation-builder.ts`
- `apps/api/src/modules/chat/openai-llm-provider.service.ts`
- `apps/api/src/modules/chat/openai-prompt.ts`
