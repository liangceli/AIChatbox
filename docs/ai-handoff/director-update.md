# Director Update

## 1. Completed Task

Completed the reliable citation `sourceLocator` P1 follow-up.

Latest commit reviewed: `49962f7 Fix reliable citation locator omission`.

Latest QA aligns with this commit and found no required fixes.

## 2. Accepted Change

- `buildBackendCitations()` now builds citation objects without `sourceLocator` by default.
- `sourceLocator` is added only when the retrieved chunk has a reliable `chunk.sourceLocator`.
- Citations without reliable locators omit the key entirely.
- Backend citation JSON no longer risks containing nested `sourceLocator: undefined` values when persisted through Prisma JSON.
- Reliable locators are still preserved when present.
- Deterministic and OpenAI success paths continue to use the shared backend citation helper.

## 3. Contract

- Citation `sourceLocator` is optional and reliable-only.
- Normal chunks may include `sourceLocator` when offsets map back to persisted `KnowledgeDocument.content`.
- Chunks created after repeated-block dedupe or other text changes omit `sourceLocator` if offsets are not reliable.
- Customer/admin citations still include backend-controlled document/chunk/source/excerpt/score data.
- Answer Debug continues to omit citation `sourceLocator` from its sanitized debug response.

## 4. Verification

QA passed:

- `pnpm --filter @platform/api test`
- `pnpm --filter @platform/api typecheck`
- `git diff --check` with only Windows LF/CRLF warnings

Focused regression added:

- A retrieved chunk with no reliable locator produces a backend citation where `"sourceLocator" in citation === false`.

QA confirmed this is a locator-only fix. It does not change provider requests, retrieval scoring, model output, message flow, handoff, or conversation history.

## 5. Remaining Risks

- URL import 45-second flow deadline does not cover DNS/safety resolution time itself; this is P2 nice-to-fix, not blocking this citation fix.
- Real OpenAI does not need to be rerun for this locator-only change, but should still be rerun before alpha for broader RAG hardening validation.
- Frontend or downstream consumers must treat `sourceLocator` as optional.

## 6. Updated Docs

- `docs/skills/current-status.md`: updated latest commit, accepted task, QA result, and next tasks.
- `docs/skills/qa-skill.md`: recorded latest accepted P1 citation omission fix and corrected real OpenAI smoke status.
- `docs/skills/ai-data-skill.md`: clarified optional reliable-only `sourceLocator` and no `sourceLocator: undefined` persistence.
- Existing committed backend/API/QA docs already record reliable-only locator behavior.
- `docs/ai-handoff/director-update.md`: refreshed for `49962f7` and latest QA.

## 7. Recommended Next Tasks

1. Continue alpha knowledge QA using `docs/runtime/alpha-knowledge-qa-checklist.md`, including optional citation locator checks.
2. Add a deadline wrapper around DNS/safety resolution if URL import resolution latency becomes a practical risk.
3. Keep frontend/admin displays tolerant of citations without `sourceLocator`.
4. Rerun real OpenAI smoke and Answer Debug before alpha when broader RAG behavior changes again.
