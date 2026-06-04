# Latest Implementation Handoff

## 1. Original Task Brief

Task title: Prepare Personal Product Split Readiness and Add Minimal Admin/Agent Protection Boundary

Summary:

- Prepare the repo for a future split between the user's personal/commercial Level 3 AI support + lead capture product and any company-specific Haneco/Kasta deployment.
- Do not create a new repo or remove current demo/company functionality.
- Audit company-specific coupling and classify findings.
- Add split-readiness documentation.
- Add a minimal backend protection boundary for admin/agent/platform operations without breaking public customer chat/widget usage.
- Update relevant docs/skills and this handoff.

## 2. Changed Files

| File | Why it changed |
| -- | -- |
| `apps/api/src/common/admin-protection/admin-api.guard.ts` | Added minimal token-based admin API guard. |
| `packages/config/src/index.ts` | Added admin protection env parsing: `ADMIN_API_PROTECTION_MODE`, `ADMIN_API_TOKEN`, `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV`. |
| `apps/api/src/modules/tenants/tenants.controller.ts` | Protected tenant management endpoints. |
| `apps/api/src/modules/tenants/tenants.module.ts` | Registered admin guard provider. |
| `apps/api/src/modules/knowledge/knowledge.controller.ts` | Protected knowledge management endpoints. |
| `apps/api/src/modules/knowledge/knowledge.module.ts` | Registered admin guard provider. |
| `apps/api/src/modules/conversations/conversations.controller.ts` | Protected admin/agent conversation list, support users, assignment, agent replies, clearing, and deletion. |
| `apps/api/src/modules/conversations/conversations.module.ts` | Registered admin guard provider. |
| `apps/api/scripts/provider-behavior.test.ts` | Added admin guard/config tests and tenant-resolution regression coverage. |
| `docs/split-readiness/personal-product-boundary.md` | Defined personal Level 3 AI support + lead capture product boundary. |
| `docs/split-readiness/company-only-boundary.md` | Defined company-only boundary and classified audit findings. |
| `docs/split-readiness/core-extraction-map.md` | Mapped current repo areas into future split categories. |
| `docs/split-readiness/repo-split-checklist.md` | Added practical future repo split checklist and split triggers. |
| `docs/skills/*` relevant files | Updated auth/backend/API/QA/deployment/current-status/decision/project-summary docs. |
| `docs/ai-handoff/latest-implementation.md` | Updated implementation handoff for this task. |
| `docs/skills/api-contract-skill.md` | QA follow-up: documented public alpha realtime SSE behavior and route-map smoke expectations. |
| `docs/skills/auth-skill.md` | QA follow-up: documented admin-web token limitation and public alpha realtime exposure. |
| `docs/skills/backend-skill.md` | QA follow-up: classified realtime conversation snapshots as public alpha limitation. |
| `docs/skills/frontend-skill.md` | QA follow-up: documented browser-only admin-web limitation and no browser token exposure. |
| `docs/skills/qa-skill.md` | QA follow-up: added lightweight route-map smoke notes for protected and public alpha routes. |
| `docs/skills/current-status.md` | QA follow-up: updated current alpha status and remaining production risks. |

## 3. Implementation Summary

Split readiness:

- Added `docs/split-readiness/` with personal product boundary, company-only boundary, core extraction map, and repo split checklist.
- Documented the future personal product as a Level 3 AI customer support + lead capture product.
- Documented split triggers such as company-specific integrations, company business rules entering runtime code, lead capture workflow implementation, public personal branding, and sensitive customer/company data separation.

Audit findings:

- Safe demo/seed/reference: Kasta in README examples, Prisma seed data, docs boundary reminders, and local demo references.
- Reusable core: tenant-scoped API modules, shared packages, AI provider contracts, retrieval/provider tests.
- Split-review/company-only item: `apps/api/src/modules/knowledge/knowledge.service.ts` uses `HanecoAIPilotBot/0.1 knowledge-import` as URL import user-agent. It is not business logic, but should become product-neutral before or during split.

Admin protection:

- Added `AdminApiGuard`.
- Supports `x-admin-api-token` or `Authorization: Bearer`.
- Missing token returns 401.
- Invalid token returns 403.
- Token comparison uses `timingSafeEqual`.
- Guard does not log or return token values.

Protected categories:

- Tenant management: `GET /v1/tenants`, `POST /v1/tenants`.
- Knowledge management: all `knowledge-bases` controller endpoints.
- Conversation admin/agent operations: list conversations, support users, assign, agent reply, clear messages, delete conversation.

Intentionally public:

- Customer chat: `POST /v1/chat/messages`.
- Customer handoff request: `POST /v1/conversations/:conversationId/handoff`.
- Conversation read/detail endpoints remain unguarded for now because current widget/realtime flows may depend on them. This is documented as an alpha limitation.
- Realtime snapshots: `GET /v1/realtime/conversations` is currently public alpha behavior. It returns tenant-scoped conversation snapshots, including the conversation list, `pendingHumanCount`, and `activeConversation` detail. This must be narrowed or protected before production.

QA follow-up documentation:

- Clarified that the new backend `AdminApiGuard` protects API endpoints, but the current browser-only `apps/admin-web` has no safe token/session/proxy path.
- Documented that `ADMIN_API_TOKEN` must not be exposed directly to browser code.
- Documented local alpha admin-web options: explicitly disable protection with `ADMIN_API_PROTECTION_MODE=disabled` and `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV=true`, or add a future server-side auth/proxy implementation.
- Added lightweight route-map smoke guidance: protected tenants/knowledge/admin conversation endpoints should reject missing/invalid tokens and accept valid tokens; public customer chat, customer handoff, conversation detail/read, and realtime SSE should remain reachable under the current alpha contract.

## 4. User-Visible Changes

Public customer chat/widget message flow should remain usable without admin token.

Admin/agent/platform API calls now need the admin protection token unless protection is explicitly disabled for local development. Admin-web was not changed; for local browser-based admin testing, use explicit dev disable mode or a future server-side proxy/auth layer.

`GET /v1/realtime/conversations` remains public alpha behavior and continues to return tenant-scoped conversation snapshots without admin token. This preserves current browser/widget flows but is a production hardening item.

## 5. Technical Notes

Config:

- `ADMIN_API_PROTECTION_MODE`: defaults to `token`.
- `ADMIN_API_TOKEN`: expected token for protected requests in token mode.
- `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV=true`: required when `ADMIN_API_PROTECTION_MODE=disabled`.
- `ADMIN_API_PROTECTION_MODE=disabled` is rejected in production.

This is not full auth/RBAC. It is an alpha protection boundary only. Production must derive identity from auth context and apply tenant-aware role authorization instead of trusting browser-exposed tokens or request-body `userId`.

Tenant resolution remains unchanged. The guard does not replace `x-tenant-slug` or tenant-scoped Prisma queries.

No Prisma schema, migration, customer-widget UI, public chat contract, OpenAI provider behavior, deterministic fallback, retrieval, citations, handoff, or `PENDING_HUMAN` behavior was changed.

QA follow-up changed documentation only. It did not refactor auth architecture, did not add frontend token passing, and did not change customer chat/widget behavior.

## 6. Verification Results

| Command / Check | Result | Notes |
| -- | -- | -- |
| `rg` company-specific audit | Passed | Found Kasta mostly in README/seed/docs/demo; found `HanecoAIPilotBot` user-agent as split-review item. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api test` | Passed | Covers admin guard missing/invalid/valid token, explicit dev disable, tenant slug requirement, provider/retrieval regressions, and `PENDING_HUMAN`. Expected OpenAI fallback warning remains. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api typecheck` | Passed | API typecheck passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/config typecheck` | Passed | Config typecheck passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/ai-core typecheck` | Passed | ai-core typecheck passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api lint` | Passed | Current lint script is `tsc --noEmit`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/config lint` | Passed | Current lint script is `tsc --noEmit`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/ai-core lint` | Passed | Current lint script is `tsc --noEmit`. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/api build` | Passed | API build passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/config build` | Passed | Config build passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/ai-core build` | Passed | ai-core build passed. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/config test` | Passed | Placeholder test command still passes. |
| `.\node_modules\.bin\pnpm.CMD --filter @platform/ai-core test` | Passed | Placeholder test command still passes. |
| `git status --short --untracked-files=all` / `git diff --stat` | Passed | Reviewed scope and new files. |
| QA follow-up docs review | Passed | `docs/ai-handoff/latest-qa.md` findings were reflected in latest implementation handoff and relevant skills. |

## 7. Manual QA Suggestions

- Call `POST /v1/chat/messages` without admin token and confirm public chat still works with `x-tenant-slug`.
- Call `GET /v1/tenants` without token and confirm 401.
- Call `GET /v1/tenants` with invalid token and confirm 403.
- Call `GET /v1/tenants` with `x-admin-api-token: <ADMIN_API_TOKEN>` and confirm success.
- Call a knowledge mutation without/with invalid/with valid token and confirm consistent behavior.
- Call conversation assign/agent reply without/with invalid/with valid token and confirm consistent behavior.
- Confirm tenant slug is still required on tenant-scoped protected endpoints.
- Confirm customer handoff still works without admin token.
- Confirm `GET /v1/conversations/:conversationId/detail`, `GET /v1/conversations/:conversationId/messages`, and `GET /v1/realtime/conversations?tenantSlug=...` remain reachable according to the current public alpha contract.
- Confirm realtime SSE snapshot payload includes only the currently expected alpha fields: conversation list, `pendingHumanCount`, and active conversation detail.
- Review `docs/split-readiness/*` and confirm split triggers are clear enough for the Project Director.

## 8. Risks / Notes

- This is not production auth. It is an internal alpha guard.
- Admin-web was not updated to pass a token. Browser-exposed permanent admin tokens are not production-ready; use explicit dev disable for local UI testing or add a server-side admin auth/proxy layer later.
- Conversation read/detail endpoints remain unguarded to avoid breaking current widget/realtime assumptions. This should be revisited when proper customer/session auth exists.
- `GET /v1/realtime/conversations` remains public alpha behavior and exposes tenant-scoped conversation list, pending human count, and active conversation detail. It should be narrowed or protected before production.
- Repo is not ready for the user to create the new personal product repo immediately unless a split trigger has been reached. It is now better prepared for one or two more cycles; remaining blockers include product-neutral naming cleanup, production auth/RBAC, and separating company/demo seed/docs at split time.

## 9. Docs Update Suggestions

- Docs/skills were updated directly in this task as requested.
- Project Context & Docs chat should reconcile these docs with QA results and the latest commit after acceptance.
