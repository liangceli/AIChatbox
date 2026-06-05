# Latest Implementation Handoff

## 1. Original Task Brief Summary

Task title: Add Admin-Web Server-Side Access Path, Narrow Realtime Exposure, and Finalize Personal Product Split Gate.

Goal:

- Give `apps/admin-web` a safe server-side path to call protected admin/agent/platform APIs without exposing `ADMIN_API_TOKEN` to browser code.
- Protect tenant-wide realtime/conversation snapshots and keep customer public reads scoped to the current visitor/conversation.
- Replace product/company-specific runtime strings that should not enter reusable product core.
- Update split-readiness docs so the Project Director can decide whether a personal/commercial product repo split is now appropriate.

## 2. Changed Files

| File | Why it changed |
| -- | -- |
| `apps/admin-web/app/lib/admin-access.ts` | Added server-only alpha access/session helper for admin-web. |
| `apps/admin-web/app/lib/admin-next-path.cjs` | Added safe admin access redirect sanitizer. |
| `apps/admin-web/scripts/admin-access.test.cjs` | Added regression test for admin access `next` path sanitization. |
| `apps/admin-web/package.json` | Replaced placeholder test script with the admin access sanitizer regression test. |
| `apps/admin-web/app/api/admin/access/route.ts` | Added access-token login endpoint that sets an httpOnly sameSite session cookie. |
| `apps/admin-web/app/api/admin/[...path]/route.ts` | Added same-origin server-side proxy that injects `x-admin-api-token` only on the server. |
| `apps/admin-web/app/admin/access/page.tsx` | Added alpha admin access page. |
| `apps/admin-web/app/components/admin-access-form.tsx` | Added access-token form for `/admin/access`. |
| `apps/admin-web/app/admin/page.tsx` | Added server-side session gate and changed protected API base to `/api/admin`. |
| `apps/admin-web/app/agent/page.tsx` | Added server-side session gate and changed protected API base to `/api/admin`. |
| `apps/admin-web/app/components/local-chat-demo.tsx` | Switched local customer refresh to customer-scoped conversation detail with `visitorId`. |
| `apps/customer-widget/src/widget.tsx` | Switched widget refresh to customer-scoped detail and customer-scoped SSE. |
| `apps/api/src/modules/conversations/conversations.controller.ts` | Protected admin conversation read routes and added customer-scoped read routes. |
| `apps/api/src/modules/conversations/conversations.service.ts` | Added visitor-scoped customer conversation detail/messages helpers. |
| `apps/api/src/modules/conversations/dto/request-handoff.dto.ts` | Made public customer handoff `visitorId` required. |
| `apps/api/src/modules/realtime/realtime.controller.ts` | Protected tenant-wide realtime stream and added customer-scoped realtime stream. |
| `apps/api/src/modules/realtime/realtime.service.ts` | Added customer-scoped realtime snapshot generation. |
| `apps/api/src/modules/realtime/realtime.module.ts` | Registered `AdminApiGuard` for realtime controller usage. |
| `apps/api/src/modules/knowledge/knowledge.service.ts` | Replaced company-specific URL import user-agent with configurable product-neutral env. |
| `packages/config/src/index.ts` | Added admin-web proxy/access env fields and `KNOWLEDGE_IMPORT_USER_AGENT`. |
| `apps/api/scripts/provider-behavior.test.ts` | Added regression coverage for admin realtime guard metadata and customer-scoped read/realtime behavior. |
| `docs/split-readiness/*` | Updated final split gate, copy/exclude checklist, extraction categories, and cleaned/company-only classifications. |
| `docs/skills/*` relevant files | Updated auth/frontend/backend/API/deployment/QA/current-status/project-summary/decision-log skills. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for the current task. |

## 3. Implementation Summary

Admin-web access path:

- Added `/admin/access` for alpha admin-web access.
- Browser submits `ADMIN_WEB_ACCESS_TOKEN` to same-origin `/api/admin/access`.
- On success, admin-web sets an httpOnly sameSite cookie signed with `ADMIN_WEB_SESSION_SECRET`.
- `/admin` and `/agent` server components require a valid admin-web session cookie before rendering.
- Browser protected calls now target same-origin `/api/admin/...`.
- The admin-web server proxy forwards to `API_INTERNAL_BASE_URL` and injects `x-admin-api-token: <ADMIN_API_TOKEN>` server-side.
- Browser code never receives `ADMIN_API_TOKEN` and does not send it directly to `apps/api`.
- QA follow-up: `/admin/access?next=...` now sanitizes redirect targets. Only safe same-origin relative paths are accepted; protocol-relative, absolute, and backslash URLs fall back to `/admin`.

Realtime/conversation exposure:

- `GET /v1/realtime/conversations` is now protected by `AdminApiGuard`.
- Tenant-wide realtime snapshots still include `conversations`, `pendingHumanCount`, and `activeConversation`, but only for protected admin/agent access.
- Added public customer-scoped `GET /v1/realtime/customer-conversation?tenantSlug=...&conversationId=...&visitorId=...`.
- Customer realtime only emits `customer_conversation_snapshot` with `conversation: ConversationDetail | null`.
- Protected admin conversation reads now include:
  - `GET /v1/conversations/:conversationId`
  - `GET /v1/conversations/:conversationId/detail`
  - `GET /v1/conversations/:conversationId/messages`
- Public customer reads now use:
  - `GET /v1/conversations/:conversationId/customer-detail?visitorId=...`
  - `GET /v1/conversations/:conversationId/customer-messages?visitorId=...`
- Customer read helpers verify tenant + conversationId + visitorId before returning data.

Product-neutral cleanup:

- Replaced `HanecoAIPilotBot/0.1 knowledge-import` with `KNOWLEDGE_IMPORT_USER_AGENT`.
- Default value is `PlatformKnowledgeImporter/0.1 knowledge-import`.
- Runtime search of `apps/api/src` and selected shared packages found no remaining Haneco/Kasta runtime core references.
- Remaining `kasta` references observed in admin-web page defaults are local demo/seed defaults and documented for split review.

## 4. User-Visible Changes

- Visiting `/admin` or `/agent` now requires alpha admin-web access first.
- Admin/agent UI calls protected APIs through the admin-web server proxy.
- Customer widget chat, handoff, refresh, and agent-reply visibility are preserved, but refresh now uses customer-scoped endpoints.
- Public routes no longer expose tenant-wide conversation lists or `pendingHumanCount`.

## 5. Admin-Web Access Path Design

Env added or used:

- `API_INTERNAL_BASE_URL`: server-side API base for admin-web proxy, default `http://localhost:4000/v1`.
- `ADMIN_API_TOKEN`: backend admin guard token, server-only.
- `ADMIN_WEB_ACCESS_TOKEN`: alpha admin-web access token, server-only.
- `ADMIN_WEB_SESSION_COOKIE_NAME`: defaults to `platform_admin_session`.
- `ADMIN_WEB_SESSION_SECRET`: signs admin-web session cookie, server-only.
- `ADMIN_WEB_SESSION_TTL_SECONDS`: defaults to `43200`.

Security notes:

- `ADMIN_API_TOKEN` is read only in `apps/admin-web/app/lib/admin-access.ts` and injected only in the server route handler.
- No `NEXT_PUBLIC_*` admin secret was added.
- No localStorage or browser-visible token storage was added.
- API responses and login responses do not return either admin token.
- This is alpha protection, not production auth/RBAC.

## 6. Realtime / Conversation Exposure Changes

Protected:

- Tenant management.
- Knowledge management.
- Admin conversation list/support-users/summary/detail/messages.
- Assignment, agent replies, clear messages, delete conversation.
- Tenant-wide realtime snapshots at `GET /v1/realtime/conversations`.

Public:

- `POST /v1/chat/messages`.
- `POST /v1/conversations/:conversationId/handoff` with required `visitorId`.
- `GET /v1/conversations/:conversationId/customer-detail?visitorId=...`.
- `GET /v1/conversations/:conversationId/customer-messages?visitorId=...`.
- `GET /v1/realtime/customer-conversation?tenantSlug=...&conversationId=...&visitorId=...`.

Public customer routes are still tenant-scoped and now require visitor/conversation scope for reads.

QA follow-up: public customer handoff now requires a non-blank `visitorId`, rejects wrong visitor scope, and still succeeds for the correct visitor.

## 7. Split-Readiness Conclusion

Codex assessment: conditionally ready for the user to create a new personal/commercial product repo when the next work item is Level 3 lead capture, public personal branding/demo, or company-specific integration work.

Why:

- The known company-specific runtime blocker was cleaned.
- Admin-web no longer needs unprotected backend admin APIs for local alpha usage.
- Tenant-wide realtime snapshots are no longer public alpha.
- Split docs now identify copy candidates, exclusions, env/secrets to recreate, smoke tests, and docs/skills reset work.

Remaining blockers before production, not before a repo split:

- Replace alpha admin-web access with real auth/RBAC.
- Add signed/customer session protection beyond anonymous visitorId.
- Decide personal product naming, branding, and demo tenant defaults.

## 8. Verification Results

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Used full PowerShell path because normal spawn intermittently failed in sandbox. |
| `pnpm --filter @platform/api typecheck` | Passed | API typecheck passed. |
| `pnpm --filter @platform/customer-widget typecheck` | Passed | Widget typecheck passed. |
| `pnpm --filter @platform/config typecheck` | Passed | Config typecheck passed. |
| `pnpm --filter @platform/api test` | Passed | Covers existing provider/retrieval/PENDING_HUMAN plus new admin realtime guard and customer-scoped read/realtime checks. |
| `pnpm --filter @platform/admin-web test` | Passed | Covers admin access next-path sanitizer accepting `/admin`/`/agent` and rejecting protocol-relative, absolute, and backslash URLs. |
| Admin secret search | Passed | No `ADMIN_API_TOKEN` exposure through browser client files; only server helper/proxy references it in admin-web. |
| Company runtime search | Passed | No `HanecoAIPilotBot`, Haneco, or Kasta runtime references found in `apps/api/src` or selected shared package source. |
| `pnpm typecheck` | Passed | Workspace typecheck passed across 11 packages. |
| `pnpm lint` | Passed | Current lint scripts are TypeScript sanity checks. |
| `pnpm test` | Passed | Workspace tests passed; many packages still use placeholder test scripts. |
| `pnpm build` | Passed | Workspace build passed, including Next admin-web build and customer-widget package build. |

## 9. Manual QA Suggestions

- Configure `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, `ADMIN_WEB_SESSION_SECRET`, and `API_INTERNAL_BASE_URL`.
- Visit `/admin`; confirm redirect to `/admin/access`.
- Submit wrong admin-web access token and confirm 403 with no secret leak.
- Submit valid token from `/admin/access?next=//example.com` and confirm it does not leave the site.
- Submit valid admin-web access token and confirm `/admin` loads.
- Confirm browser network requests go to `/api/admin/...`, not directly to protected `apps/api` routes with `ADMIN_API_TOKEN`.
- Confirm `/api/admin/tenants` without cookie returns 401.
- Confirm tenant/knowledge/admin conversation actions work through the proxy after valid access.
- Confirm `GET /v1/realtime/conversations` directly rejects missing/invalid admin token and accepts valid token.
- Confirm widget can send messages, request handoff, refresh its own conversation, and receive agent replies.
- Confirm customer handoff without `visitorId` returns 400, wrong `visitorId` is rejected, and correct `visitorId` succeeds.
- Confirm customer public read with wrong/missing `visitorId` does not return another visitor's conversation.
- Confirm no public route returns tenant-wide `conversations[]` or `pendingHumanCount`.

## 10. Risks / Notes

- Alpha admin-web access uses one shared access token, not per-user identity.
- The admin-web proxy currently forwards only the headers it needs: content type, tenant slug, and server-side admin token.
- Customer visitorId remains bearer-like anonymous identity; production should add signed customer/session protection.
- Existing demo `kasta` defaults remain in local admin/chat page env fallbacks and seed/demo context; they should be renamed or excluded during a personal repo split.
- No Prisma schema or migration was added.
- OpenAI provider, deterministic fallback, retrieval/citations, handoff, and `PENDING_HUMAN` behavior were not intentionally changed.

## 11. Docs Update Suggestions

- Docs/skills were updated directly in this task because the brief explicitly requested it.
- After QA acceptance and commit, Project Context & Docs chat should reconcile these docs with `latest-qa.md` and the final commit.
- If the Project Director approves a repo split, reset `docs/ai-handoff/*` and rewrite repo-specific skills in the new personal product repo.
