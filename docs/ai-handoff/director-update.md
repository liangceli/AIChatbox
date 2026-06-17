# Director Update

## 1. Completed Task

Accepted QA context: Clerk alpha auth boundary and Admin-Web Clerk session verification P1 fix.

Latest commit reviewed for this docs sync: `0c6fc17 update skill files`.

Important reconciliation note: `0c6fc17` is a docs-only sync commit and does not contain the Clerk auth implementation described in `latest-implementation.md` and `latest-qa.md`. The current handoff/QA describes newer uncommitted working-tree changes.

## 2. Accepted Change

- Admin-web Clerk session bridge now verifies Clerk JWT signature and configured claims before setting the httpOnly sameSite Clerk session cookie.
- `/api/auth/clerk/session` returns 500 when required verification config is missing, returns 401 for invalid/forged tokens, and must not set a cookie for rejected tokens.
- `/admin`, `/agent`, and `/api/admin/...` must reject forged token-shaped Clerk JWT cookies.
- Admin-web proxy forwards `Authorization: Bearer <Clerk JWT>` only after server-side verification.
- Backend `AdminApiGuard` remains the API enforcement boundary in Clerk mode. Signed-in Clerk users must still map to an existing `User` and tenant `Role`.
- Platform-level tenant list/create requires `User.isPlatformAdmin=true`.
- Legacy `/admin/access` and `ADMIN_API_TOKEN` remain server-only local/dev or service fallback paths.
- Browser-visible Clerk config is limited to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; backend/admin/OpenAI/database/session secrets must not be exposed to browser code, logs, responses, or docs examples with real values.

## 3. Contract

- Staging/production alpha path should use `ADMIN_API_PROTECTION_MODE=clerk`.
- Required Clerk verification config includes `CLERK_JWT_KEY`; optional hardening uses `CLERK_ISSUER` and `CLERK_AUTHORIZED_PARTIES`.
- Admin-web may store and trust the Clerk session cookie only after server-side JWT signature and claim verification.
- Middleware may use cookie presence for quick redirects, but page and proxy handlers remain the final verification boundary.
- Customer widget/chat routes remain public customer-scoped and do not require Clerk.
- Real alpha-online status is not proven by local tests, mocked Clerk, fake tokens, localhost widget smoke, deterministic-only AI output, or screenshots without deployed URLs.

## 4. Verification

Accepted QA reported no P0/P1 findings.

Passed checks:

- `pnpm --filter @platform/admin-web test`
- `pnpm --filter @platform/admin-web typecheck`
- `pnpm --filter @platform/admin-web build`
- `pnpm --filter @platform/api test`
- `pnpm --filter @platform/api typecheck`
- `pnpm --filter @platform/config typecheck`
- `pnpm --filter @platform/config build`
- `git diff --check` with only Windows LF/CRLF warnings

QA acceptance confirmed:

- Forged token-shaped JWTs are no longer accepted by the admin-web Clerk session bridge.
- `/admin`, `/agent`, and the admin-web proxy require verified Clerk session cookies.
- Backend Clerk guard, tenant role mapping, platform-admin gate, and legacy token fallback remain intact.
- No secret exposure was found in the reviewed implementation/docs.

## 5. Remaining Risks

- Repository history is not fully synced with the handoff yet: the latest commit is `0c6fc17 update skill files`, while the Clerk alpha auth implementation appears in the uncommitted working tree.
- Admin-web forged-JWT coverage is still mostly source-smoke. Add route-handler/runtime tests proving forged POSTs return 401 and do not set cookies.
- Backend Clerk issuer and authorized-party rejection tests can be strengthened.
- Admin/agent actions still need future hardening to derive acting identity from verified auth context instead of trusting client-provided body fields.
- Online alpha readiness remains pending until user-owned Clerk, hosting, database, CORS, OpenAI-if-enabled, and external widget smoke checks pass on deployed URLs.

## 6. Updated Docs

- `docs/skills/current-status.md`: updated latest status, accepted Clerk QA context, commit mismatch, limitations, risks, and next tasks.
- `docs/skills/qa-skill.md`: added accepted Clerk session verification QA expectations and remaining P2 test gaps.
- Existing affected skills already record the Clerk alpha auth boundary:
  - `docs/skills/auth-skill.md`
  - `docs/skills/frontend-skill.md`
  - `docs/skills/backend-skill.md`
  - `docs/skills/api-contract-skill.md`
- `docs/ai-handoff/director-update.md`: refreshed for Project Director handoff.

## 7. Recommended Next Tasks

1. Ask Implementation Codex to commit or otherwise prepare the current Clerk alpha auth working-tree changes for review.
2. Ask QA Codex to run the manual Clerk alpha route-map acceptance checks: no cookie redirects, forged session POST 401/no cookie, forged cookie rejection on `/admin` and `/agent`, forged proxy request 401, legacy local `/admin/access` still works when intentionally configured.
3. Add route-handler tests for forged Clerk JWT rejection and stronger backend issuer/authorized-party tests.
4. Complete real deployed alpha smoke only after user-owned Clerk, hosting, DB, CORS, OpenAI-if-enabled, and external widget settings are configured without pasting secrets into chat.
