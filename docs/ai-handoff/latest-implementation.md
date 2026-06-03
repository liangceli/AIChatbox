# Latest Implementation Handoff

## 1. Original Task Brief

QA fix request:

- DB candidate query should include both raw terms and normalized variants.
- Final scoring should continue using exact normalized tokens.
- Add a regression test covering `policies` / `warranties` raw plural candidate lookup.
- Keep the existing `case` vs `showcase` test that must not return a weak match.

## 2. Changed Files

| File | Why it changed |
| -- | -- |
| `apps/api/src/modules/knowledge/knowledge-retrieval.service.ts` | Candidate lookup now uses raw terms plus normalized variants; final scoring still uses normalized exact tokens. Removed `policy` from stop words so `policies` can normalize to a meaningful retrieval token. |
| `apps/api/scripts/provider-behavior.test.ts` | Test mock now filters candidates using the Prisma-style OR query terms, and regression coverage now checks plural raw queries `policies` and `warranties`; existing `case` vs `showcase` false-positive test remains. |
| `docs/ai-handoff/latest-implementation.md` | Updated implementation handoff for this QA fix. |

## 3. Implementation Summary

Updated retrieval to separate candidate lookup terms from final scoring terms:

- `extractCandidateSearchTerms(question)` returns raw query terms plus normalized variants.
- Prisma candidate query uses those raw + normalized terms for `content contains` and `title contains`.
- Final scoring still uses `extractSearchTerms(question)`, which normalizes terms and scores only exact normalized token occurrences.

This preserves the short-query false-positive hardening while ensuring plural raw queries like `policies` and `warranties` can still find DB candidates before normalized scoring runs.

## 4. User-Visible Changes

Plural keyword queries such as `policies` and `warranties` should retrieve relevant chunks when the stored content/title uses those plural forms. Weak substring matches such as `case` inside `showcase` should still be filtered out.

## 5. Technical Notes

- Candidate lookup is intentionally broader than final scoring.
- Final scoring remains exact normalized-token based.
- `policy` was removed from `STOP_WORDS` because it is a meaningful support-domain retrieval term.
- No UI, API contract, Prisma schema, provider, handoff, or `PENDING_HUMAN` behavior changed.

## 6. Verification Results

| Command / Check | Result | Notes |
| -- | -- | -- |
| `Get-Content apps\api\src\modules\knowledge\knowledge-retrieval.service.ts` | Passed | Inspected current retrieval implementation before editing. |
| `Get-Content apps\api\scripts\provider-behavior.test.ts` | Passed | Inspected existing regression tests before editing. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api test` through full PowerShell path | Passed | Covers plural raw candidate lookup, `case` vs `showcase`, exact phrase, deterministic citations, OpenAI citation preservation, metadata safety, and `PENDING_HUMAN`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api typecheck` through full PowerShell path | Passed | API typecheck passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api lint` through full PowerShell path | Passed | Current lint script is `tsc --noEmit`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api build` through full PowerShell path | Passed | API build passed. |

## 7. Manual QA Suggestions

- Search/chat with `policies` and confirm relevant policy chunks can be retrieved.
- Search/chat with `warranties` and confirm relevant warranty chunks can be retrieved.
- Search/chat with `case` where only `showcase` exists and confirm no weak citation is produced.
- Confirm normal deterministic knowledge-hit citations and knowledge-miss fallback still behave as expected.

## 8. Risks / Notes

- Candidate lookup is broader by design, but final normalized scoring should still filter weak candidates.
- Removing `policy` from stop words may allow more policy-related candidates; this is intended because policy is support-domain meaningful.
- This fix does not change semantic limitations of deterministic retrieval.

## 9. Docs Update Suggestions

- Project Context & Docs chat may update retrieval notes to clarify that DB candidate lookup uses raw + normalized terms while final scoring uses exact normalized tokens.
