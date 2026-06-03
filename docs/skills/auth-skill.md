# Auth Skill

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
- API guards for tenant management.
- Full RBAC permission matrix.

## Implemented Permission Checks

`apps/api/src/modules/conversations/conversations.service.ts` validates tenant membership through `Role` before:

- assigning a conversation to a user;
- sending an agent reply as a user.

These checks confirm a user belongs to the current tenant, but they do not authenticate who is making the request.

## Known Risks

- `GET /v1/tenants` and `POST /v1/tenants` are platform-level and currently unauthenticated.
- Admin and agent actions rely on request body `userId`; production code must not trust client-supplied identity.
- Tenant isolation is enforced mainly by tenant resolution and Prisma query scoping, not by authenticated principal permissions.

## Future Auth Direction

- Add API authentication before production use.
- Derive acting user from auth context, not request body.
- Protect tenant management with platform-admin authorization.
- Protect admin/agent surfaces with tenant membership checks.
- Keep auth generic and tenant-aware; do not add client-specific auth rules to platform core.

