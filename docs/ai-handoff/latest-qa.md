# Latest QA Handoff

## 1. Overall Conclusion

人工验收已通过

The QA fix is accepted. DB candidate lookup now uses raw terms plus normalized variants, while final scoring remains exact normalized-token based. Regression coverage now verifies `policies` / `warranties` raw plural candidate lookup and keeps the `case` vs `showcase` weak substring false-positive test.

No blocking issue was found in this QA fix. User manual retrieval smoke checks passed for the available local Kasta knowledge base.

## 2. Scope Check

The fix stayed within scope.

Scope notes:

- `extractCandidateSearchTerms(question)` now returns raw query terms plus normalized variants.
- Prisma candidate lookup uses candidate terms for `content contains` and `title contains`.
- Final scoring still uses `extractSearchTerms(question)` and exact normalized token occurrences.
- `policy` was removed from stop words so policy-related support queries can retrieve meaningful candidates.
- Tests now mock the Prisma-style `where.OR` filtering instead of blindly returning candidates.
- No UI, API contract, Prisma schema, OpenAI provider selection, handoff, or `PENDING_HUMAN` behavior was changed.

## 3. File-Level Diff Review

| File | Reasonable? | Risk | Notes |
| -- | -- | -- | -- |
| `apps/api/src/modules/knowledge/knowledge-retrieval.service.ts` | Yes | Low | Candidate lookup uses raw + normalized terms; final scoring still uses normalized exact token matching. This resolves the prior plural/stem candidate lookup gap. |
| `apps/api/scripts/provider-behavior.test.ts` | Yes | Low | The retrieval test mock now respects Prisma-style `where.OR` terms and covers `policies`, `warranties`, `case` vs `showcase`, exact phrase matching, and deterministic citation preservation. |
| `docs/ai-handoff/latest-implementation.md` | Yes | Low | Handoff accurately describes the QA fix and verification results. |
| `docs/ai-handoff/latest-qa.md` | Yes | Low | Updated by QA for this review. |

## 4. Issues Found

| Issue | Severity | Must Fix? | Suggested Handling |
| -- | -- | -- | -- |
| `pnpm-lock.yaml` remains untracked | P1 should fix before commit | Yes before commit/stage | Stage `pnpm-lock.yaml` with this change so dependency reproducibility is actually committed. |
| `apps/api/scripts/openai-smoke.ts` remains untracked | P1 should fix before commit | Yes before commit/stage | Stage the smoke helper before commit because `apps/api/package.json` references it. |
| Real OpenAI smoke was not run | P2 nice to fix | No | User currently has no key available. Missing-env smoke path and mocked provider tests passed; run real-key smoke later when a key is available. |

## 5. Regression Risks

The previous plural/stem candidate lookup risk is resolved.

Remaining risks:

- Broader raw + normalized candidate lookup may return more candidates, but final scoring still filters by exact normalized token matches and the candidate list is capped.
- Removing `policy` from stop words can increase policy-related retrieval, which is intended for a support platform.
- Real OpenAI success remains unverified without a real key, but this is non-blocking for this fix.

## 6. Domain-Specific Check

This task touches deterministic retrieval quality.

Findings:

- `policies` can retrieve raw `policies` content/title before normalized scoring.
- `warranties` can retrieve raw `warranties` content/title before normalized scoring.
- `case` inside `showcase` is still filtered out by final exact normalized scoring.
- Exact phrase matches still work.
- Deterministic knowledge-hit citations remain preserved.

## 7. Backend/API/Auth Check

Backend/API/Auth findings:

- Request shape: unchanged.
- Response shape: unchanged.
- Validation/auth/session behavior: unchanged.
- Data persistence: unchanged.
- Tenant scoping: unchanged; Prisma query still filters by `tenantId: tenant.id`.
- Security/privacy: no secret-handling changes in this fix. Smoke helper still avoids printing key values.

## 8. Performance and Stability Check

No significant performance issue was found.

Notes:

- Candidate OR terms now include raw + normalized variants, capped at 16 candidate terms.
- Final candidate result still uses `take: 80`.
- Exact normalized scoring remains in-memory over the returned candidates.
- This is an acceptable tradeoff for deterministic retrieval hardening without embeddings/vector search.

## 9. Verification Status / Manual QA

QA 本轮已直接执行的 shell 验证：

- `@platform/api test`：通过。覆盖 mocked OpenAI provider tests、`policies` / `warranties` raw plural candidate lookup、`case` vs `showcase` false-positive prevention、exact phrase matching、deterministic citations、metadata safety、`PENDING_HUMAN`。
- `@platform/api typecheck`：通过。
- `@platform/api lint`：通过。
- `@platform/api build`：通过。
- `@platform/config typecheck`：通过。
- `@platform/ai-core typecheck`：通过。
- `@platform/config build`：通过。
- `@platform/ai-core build`：通过。
- `@platform/api smoke:openai` without OpenAI env：按预期失败，错误为 `OpenAI smoke test requires AI_PROVIDER=openai.`，未打印 secret。
- `pnpm-lock.yaml` secret grep：未发现 `sk-`、`OPENAI_API_KEY`、`OPENAI_MODEL`、`apiKey`、`test-key` 等明显 secret。
- `pnpm-lock.yaml` dependency grep：确认存在 `openai@6.41.0` 条目。

人工验收结果：

- `policies` chat smoke：通过。Returned citations from policy/privacy-related chunks in the local Kasta knowledge base.
- `warranties` chat smoke：通过。Returned warranty-related citations.
- `case` chat smoke：通过 for the current data set. It returned citations because the local knowledge base contains real independent `Case Studies` titles/paths/content, not because of `showcase` substring-only matching.
- OpenAI smoke without env：通过 expected-failure path, secret-free.

仍建议后续环境验证：

- 有真实 OpenAI key 时运行 `pnpm --filter @platform/api smoke:openai`。当前用户没有可用 key，因此 real-key OpenAI smoke remains pending/non-blocking.

不建议把 `pnpm dev` 作为 blocking 验证命令；如需浏览器手动检查，再由人工启动本地 dev server。

## 10. Docs/Skills Update Needs

Project Context & Docs should reconcile after acceptance:

- `docs/skills/ai-data-skill.md`: candidate lookup uses raw + normalized terms, final scoring uses exact normalized tokens.
- `docs/skills/qa-skill.md`: plural/stem candidate lookup regression coverage exists, not only scoring-after-candidates tests.
- `docs/skills/current-status.md`: record that the retrieval candidate-query QA fix passed.
- `docs/skills/backend-skill.md`: keep lockfile/smoke helper notes and final retrieval behavior.

QA should not directly modify `docs/skills`; that remains owned by Project Context & Docs unless the task explicitly asks Implementation to update them.

## 11. Handoff File Update

`docs/ai-handoff/latest-qa.md` was updated for this QA fix review.

This QA handoff used:

- `docs/ai-handoff/latest-implementation.md`
- `git status --short --untracked-files=all`
- `git diff --stat`
- `git diff --name-only`
- focused `git diff` for retrieval/test/handoff files
- direct reads of `openai-smoke.ts`, `knowledge-retrieval.service.ts`, and `provider-behavior.test.ts`
- `pnpm-lock.yaml` grep checks

## 12. Fix Request for Implementation Chat

No fix request required for Codex Chat 2.

Before commit/staging, ensure untracked required files are included:

- `apps/api/scripts/openai-smoke.ts`
- `pnpm-lock.yaml`
