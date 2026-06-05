# Auth Skill

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
- Do not expose `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, or `ADMIN_WEB_SESSION_SECRET` through `NEXT_PUBLIC_*`, bundled browser code, local storage, responses, or logs.
- `GET /v1/realtime/conversations` is now admin-protected and returns tenant-wide conversation list, `pendingHumanCount`, and active conversation detail only for admin/agent paths.
- Public customer chat, customer handoff, customer conversation detail/read, and customer realtime remain public but are tenant + visitor/conversation scoped.
- This is not production auth/RBAC. Browser-exposed permanent admin tokens are not production-ready.

## Current Auth State

Full authentication and authorization are not implemented yet.

Current code has:

- `User`: platform-global user identity data.
- `Role`: tenant-scoped membership with a simple role name.
- `isPlatformAdmin`: boolean on User.
- Support user membership checks for assignment and agent replies.

Current code does not have:

- Login/session flow.
- JWT/session cookie validation.
- Password, SSO, OAuth, or magic-link auth.
- Route guards for admin web.
- Production auth/RBAC guards for tenant management.
- Full RBAC permission matrix.
- Production-grade admin-web identity/session provider.

## Implemented Permission Checks

`apps/api/src/modules/conversations/conversations.service.ts` validates tenant membership through `Role` before:

- assigning a conversation to a user;
- sending an agent reply as a user.

These checks confirm a user belongs to the current tenant, but they do not authenticate who is making the request.

## Known Risks

- `GET /v1/tenants` and `POST /v1/tenants` are platform-level and protected only by the alpha admin API guard, not production auth/RBAC.
- Admin and agent actions rely on request body `userId`; production code must not trust client-supplied identity.
- Tenant isolation is enforced mainly by tenant resolution and Prisma query scoping, not by authenticated principal permissions.
- Admin-web alpha access is a minimal token gate, not user identity or RBAC.

## Future Auth Direction

- Add API authentication before production use.
- Derive acting user from auth context, not request body.
- Protect tenant management with platform-admin authorization.
- Protect admin/agent surfaces with tenant membership checks.
- Keep auth generic and tenant-aware; do not add client-specific auth rules to platform core.
