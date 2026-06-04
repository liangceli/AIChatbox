# Director Update

## 1. Completed Task

Completed accepted admin protection boundary and split-readiness work.

Latest commit reviewed: `10229ff Add admin protection boundary and split-readiness docs`.

## 2. Accepted Changes

- Added minimal backend `AdminApiGuard` for admin/agent/platform operations.
- Guard accepts `x-admin-api-token` or `Authorization: Bearer <token>`.
- Missing token returns 401; invalid token returns 403.
- Guard uses timing-safe comparison and does not log or return token values.
- Config now supports `ADMIN_API_PROTECTION_MODE`, `ADMIN_API_TOKEN`, and `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV`.
- `ADMIN_API_PROTECTION_MODE=disabled` is local/dev-only, requires explicit `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV=true`, and is rejected in production.
- Protected endpoint categories now include tenant management, all knowledge management, conversation list/support-users, assignment, agent replies, message clearing, and conversation deletion.
- Public alpha endpoint categories remain customer chat, customer handoff, conversation detail/read, and realtime SSE.
- `GET /v1/realtime/conversations` remains public alpha and returns tenant-scoped snapshots with conversation list, `pendingHumanCount`, and active conversation detail.
- `apps/admin-web` was not changed. It is browser-only and has no safe token/session/proxy path, so `ADMIN_API_TOKEN` must not be exposed to browser code.
- Added split-readiness docs under `docs/split-readiness/` for personal product boundary, company-only boundary, core extraction map, and repo split checklist.
- Company-specific Haneco/Kasta behavior is classified as seed/demo/company-only and must not define reusable platform core.

## 3. Verification Summary

- Latest QA result: accepted; no required fixes after documentation follow-up.
- QA confirmed the docs now cover realtime public alpha classification, admin-web browser-token limitation, and route-map smoke expectations.
- Implementation verification passed for API/config/ai-core typecheck/lint/build where applicable.
- API tests covered admin guard missing/invalid/valid token behavior, explicit dev disable config, tenant slug regression, provider/retrieval regressions, and `PENDING_HUMAN`.
- Public customer chat/widget behavior, OpenAI provider behavior, deterministic fallback, retrieval, citations, handoff, and Prisma schema were not changed.

## 4. Remaining Risks

- This is not production auth/RBAC. Production must derive identity from auth context and apply tenant-aware authorization.
- `GET /v1/realtime/conversations` is still public alpha and exposes tenant conversation snapshots; narrow or protect it before production.
- Browser-only `apps/admin-web` cannot safely call protected admin APIs in token mode until a server-side auth/proxy/session layer exists.
- Do not expose `ADMIN_API_TOKEN` through `NEXT_PUBLIC_*`, bundled browser code, local storage, or direct browser requests.
- Conversation read/detail endpoints remain unguarded for current widget/realtime assumptions and need a future customer/session auth decision.
- Split-review item remains: `apps/api/src/modules/knowledge/knowledge.service.ts` uses `HanecoAIPilotBot/0.1 knowledge-import` as URL import user-agent and should become product-neutral before or during repo split.

## 5. Updated Docs

- `docs/skills/current-status.md`: reconciled latest accepted task, route-map QA expectations, production hardening risks, and next tasks.
- `docs/skills/api-contract-skill.md`: already documents admin protection header, protected/public route map, and realtime public alpha payload.
- `docs/skills/auth-skill.md`: already documents minimal guard behavior, dev disable config, admin-web token limitation, and non-production auth status.
- `docs/skills/backend-skill.md`: already records protected categories, public alpha categories, realtime risk, and split-readiness direction.
- `docs/skills/frontend-skill.md`: already records browser-only admin-web limitation and no `ADMIN_API_TOKEN` exposure.
- `docs/skills/qa-skill.md`: already records route-map smoke checks for protected and public alpha routes.
- `docs/ai-handoff/director-update.md`: refreshed for the latest accepted commit and QA result.

## 6. Recommended Next Tasks

1. Decide whether the next alpha cycle should keep admin-web local testing in explicit dev-disable mode or implement a server-side admin auth/proxy path.
2. Before production, narrow or protect `GET /v1/realtime/conversations` and decide the customer/session auth model for conversation read/detail endpoints.
3. Keep company-specific work out of reusable core; use `docs/split-readiness/` as the boundary checklist.
4. Rename product-specific split-review items before or during any personal product repo split.
