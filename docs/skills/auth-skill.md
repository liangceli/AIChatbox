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
- Public customer chat, customer handoff, conversation detail/read, and realtime SSE flows remain public but tenant-scoped under the current alpha contract.
- `GET /v1/realtime/conversations` is currently public alpha behavior. It returns tenant-scoped conversation snapshots, including the conversation list, `pendingHumanCount`, and `activeConversation` detail, and must be narrowed or protected before production.
- `apps/admin-web` is currently a browser-only app and does not have a safe token/session/proxy path. Do not expose `ADMIN_API_TOKEN` directly to browser code. Local alpha admin-web usage either needs explicit `ADMIN_API_PROTECTION_MODE=disabled` plus `ALLOW_UNPROTECTED_ADMIN_API_IN_DEV=true`, or a future server-side auth/proxy implementation.
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
- Safe admin-web session, server action, BFF, or proxy path for admin API calls.

## Implemented Permission Checks

`apps/api/src/modules/conversations/conversations.service.ts` validates tenant membership through `Role` before:

- assigning a conversation to a user;
- sending an agent reply as a user.

These checks confirm a user belongs to the current tenant, but they do not authenticate who is making the request.

## Known Risks

- `GET /v1/tenants` and `POST /v1/tenants` are platform-level and protected only by the alpha admin API guard, not production auth/RBAC.
- Admin and agent actions rely on request body `userId`; production code must not trust client-supplied identity.
- Tenant isolation is enforced mainly by tenant resolution and Prisma query scoping, not by authenticated principal permissions.
- Realtime conversation snapshots are tenant-scoped but currently public alpha behavior and expose conversation list, pending human count, and active detail for that tenant.

## Future Auth Direction

- Add API authentication before production use.
- Derive acting user from auth context, not request body.
- Protect tenant management with platform-admin authorization.
- Protect admin/agent surfaces with tenant membership checks.
- Keep auth generic and tenant-aware; do not add client-specific auth rules to platform core.
