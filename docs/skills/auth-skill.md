# Auth Skill

## 2026-06-17 Clerk Alpha Auth Code-Level Closeout

- Clerk alpha auth code-level closeout is complete, but real local Clerk login smoke is still pending user-owned Clerk Dashboard/env setup.
- Admin-web `verifyClerkSessionToken()` must require:
  - RS256 signature verification against server-side `CLERK_JWT_KEY`
  - string `sub`
  - numeric unexpired `exp`
  - valid optional `nbf`
  - configured `CLERK_ISSUER` match when present
  - configured `CLERK_AUTHORIZED_PARTIES` / `azp` match when present
- `/api/auth/clerk/session` must return 500 when verification config is missing, 401 for invalid/forged tokens or invalid verification key, and must not set the Clerk session cookie on any rejected token.
- `/admin`, `/agent`, and `/api/admin/...` must reverify the Clerk cookie server-side. Middleware can only be a quick redirect helper.
- Admin-web proxy may forward `Authorization: Bearer <Clerk JWT>` only after verification succeeds. Legacy fallback may inject `x-admin-api-token` only server-side after a valid legacy admin-web session.
- Backend `AdminApiGuard` in Clerk mode must reject forged signatures, missing/expired `exp`, invalid `CLERK_JWT_KEY`, issuer mismatch, authorized-party mismatch, signed-in but unmapped users, and wrong-tenant users.
- Platform-level tenant list/create requires `User.isPlatformAdmin=true`.
- Customer widget/chat/customer conversation routes remain public customer-scoped and must not require Clerk.
- Only `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` may be browser-visible. Keep `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, raw JWTs, auth headers, database URLs, OpenAI keys, admin tokens, and session secrets out of chat, Git, browser bundles, localStorage, logs, responses, and docs examples with real values.

## 2026-06-12 Clerk Alpha Auth Boundary

- Clerk alpha auth is now implemented for admin/agent access, but it is still not full enterprise RBAC.
- Admin-web primary path:
  - `/sign-in` and `/sign-up` use Clerk with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
  - `/api/auth/clerk/session` verifies the Clerk JWT signature and configured claims before storing it in an httpOnly sameSite cookie.
  - `/api/admin/...` forwards `Authorization: Bearer <Clerk JWT>` server-side.
- `/admin`, `/agent`, and the admin-web proxy must reject forged token-shaped JWT cookies; token structure/expiry checks alone are not enough.
- API primary alpha path:
  - `ADMIN_API_PROTECTION_MODE=clerk`
  - `CLERK_JWT_KEY`
  - optional `CLERK_ISSUER`
  - optional `CLERK_AUTHORIZED_PARTIES`
- API authorization maps Clerk users to existing `User` records by email or `metadata.clerkUserId` / `metadata.clerkSubject`, then requires a tenant `Role` for tenant routes.
- Platform-level tenant list/create requires `User.isPlatformAdmin=true`.
- `ADMIN_API_TOKEN` and `/admin/access` remain local/dev or service fallback only. They are not the primary staging/production auth path.
- First alpha admin mapping is manual through `pnpm --filter @platform/api bootstrap:clerk-admin`; real Clerk IDs and secrets must stay in env/secret managers, not chat or Git.
- Customer widget/chat routes remain public customer-scoped and do not require Clerk.
- Never expose `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, Clerk JWTs, auth headers, `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, OpenAI keys, database URLs, or session secrets in browser bundles, localStorage, logs, docs examples with real values, or API responses.

## 2026-06-04 Minimal Admin Protection Boundary

- Full authentication is still not implemented.
- A minimal alpha guard now protects admin/agent/platform operations with an internal token.
- Config keys:
  - `ADMIN_API_PROTECTION_MODE`: `token` by default, or `disabled` for explicit local development only.
  - `ADMIN_API_TOKEN`: required for protected requests when mode is `token`.
  - `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV=true`: required when mode is `disabled`.
- Accepted request headers:
  - `x-admin-api-token: <token>`
  - `Authorization: Bearer <token>`
- Missing protection returns 401; invalid protection returns 403.
- `apps/admin-web` now has an alpha server-side access path. Browser code calls same-origin `/api/admin/...`; the Next route handler checks an httpOnly admin-web session cookie and injects `x-admin-api-token` server-side.
- Admin-web access env keys: `API_INTERNAL_BASE_URL`, `ADMIN_WEB_ACCESS_TOKEN`, `ADMIN_WEB_SESSION_COOKIE_NAME`, `ADMIN_WEB_SESSION_SECRET`, `ADMIN_WEB_SESSION_TTL_SECONDS`.
- Admin-web server routes load the repository-root `.env` before validating access/proxy config. Local login should accept the exact configured `ADMIN_WEB_ACCESS_TOKEN`, for example `test-web-token` only in local placeholder QA.
- Do not expose `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, or `ADMIN_WEB_SESSION_SECRET` through `NEXT_PUBLIC_*`, bundled browser code, local storage, responses, or logs.
- `.env.local.example` may use `test-admin-token`, `test-web-token`, and `test-session-secret-for-local-qa` only as local QA placeholders. Staging/production must use strong secret-manager values.
- `GET /v1/realtime/conversations` is now admin-protected and returns tenant-wide conversation list, `pendingHumanCount`, and active conversation detail only for admin/agent paths.
- Tenant AI profile admin read/update routes are admin-protected and should be accessed by admin-web through `/api/admin/...`.
- Public `GET /v1/tenant-profile` remains reachable without admin token but returns only widget-safe display fields.
- Public customer chat, customer handoff, customer conversation detail/read, and customer realtime remain public but are tenant + visitor/conversation scoped.
- This is not production auth/RBAC. Browser-exposed permanent admin tokens are not production-ready.

## Current Auth State

Clerk alpha authentication is implemented for admin/agent surfaces. Full production RBAC, SSO, invite flows, billing-aware roles, and signed customer sessions are still future work.

Current code has:

- Clerk admin/agent sign-in bridge in admin-web.
- Clerk JWT verification in API admin guard.
- `User`: platform-global user identity data.
- `Role`: tenant-scoped membership with a simple role name.
- `isPlatformAdmin`: boolean on User.
- Support user membership checks for assignment and agent replies.

Current code does not have:

- Password, SSO, OAuth, or magic-link auth.
- Clerk Organizations or invite/approval workflow.
- Full RBAC permission matrix.
- Production-grade customer identity/session provider.

## Implemented Permission Checks

`apps/api/src/modules/conversations/conversations.service.ts` validates tenant membership through `Role` before:

- assigning a conversation to a user;
- sending an agent reply as a user.

These checks confirm a user belongs to the current tenant. Admin API access in Clerk mode now authenticates the request, but some action bodies still carry `userId`; future hardening should derive acting user IDs directly from auth context.

## Known Risks

- `GET /v1/tenants` and `POST /v1/tenants` are platform-level and require platform admin when Clerk mode is enabled, but still do not implement a full permission matrix.
- Admin and agent actions rely on request body `userId`; production code must not trust client-supplied identity.
- Tenant isolation is enforced mainly by tenant resolution and Prisma query scoping, not by authenticated principal permissions.
- Admin-web legacy alpha access remains a local fallback and must not be treated as production auth.

## Future Auth Direction

- Add API authentication before production use.
- Derive acting user from auth context, not request body.
- Protect tenant management with platform-admin authorization.
- Protect admin/agent surfaces with tenant membership checks.
- Keep auth generic and tenant-aware; do not add client-specific auth rules to platform core.
## Current Role Model

- Platform administration is `User.isPlatformAdmin`; tenant roles are typed OWNER or AGENT memberships with ACTIVE/SUSPENDED/REVOKED state.
- Registration never grants a user-selected role. Access is established through a hashed, expiring tenant invitation or the controlled Clerk bootstrap command.
- `/account/me` is the source of truth for client routing and allowed tenant display, but every API still enforces its own role and tenant policy.
- When Clerk verification is configured, legacy cookies must never satisfy protected page or proxy authentication. Admin/Agent clients renew the Clerk JWT through the same-origin session route and redirect on 401.

## Public Registration and Invitation Binding

- Public Clerk sign-up creates identity only; never present a client-side role selector.
- Ordinary Clerk requests map by `clerkUserId` or explicitly retained legacy subject metadata, never by unbound matching email.
- Invitation acceptance requires the verified Clerk email to match the invitation email before binding `clerkUserId`.
- Platform Admin creation remains an explicit bootstrap operation; never grant platform status through public registration.
- Sign-out must call Clerk sign-out, clear the local httpOnly session, and redirect to `/`.
