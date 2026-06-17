# Clerk Alpha Auth Checklist

This checklist is for alpha admin/agent authentication. It is not full enterprise RBAC.

## Manual Clerk Setup

Create and configure a Clerk project outside this repository:

- Create a Clerk application for the alpha environment.
- Configure allowed redirect URLs for the deployed admin-web domain, for example `/sign-in`, `/sign-up`, and `/admin`.
- Configure allowed origins for the deployed admin-web origin.
- Create or choose a JWT template for the API. The token must include a stable `sub`; including `email` is recommended for bootstrap/mapping.
- Copy only into local `.env` or deployment secret managers:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY` if future server-side Clerk API calls are added
  - `CLERK_JWT_KEY`
  - `CLERK_ISSUER`
  - `CLERK_AUTHORIZED_PARTIES`

Do not paste real Clerk keys, JWTs, auth headers, or dashboard screenshots containing secrets into chat.

## API Auth Mode

For alpha Clerk auth, set:

```env
ADMIN_API_PROTECTION_MODE=clerk
CLERK_JWT_KEY=<server-side Clerk JWT verification public key>
CLERK_ISSUER=<expected Clerk issuer>
CLERK_AUTHORIZED_PARTIES=<admin-web origin>
```

`ADMIN_API_PROTECTION_MODE=token` remains a local/service fallback. It is not the primary staging/production admin auth path.

## Admin-Web Auth Path

- `/sign-in` and `/sign-up` load Clerk using `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- Browser obtains a Clerk session token and posts it to `/api/auth/clerk/session`.
- Admin-web verifies the token signature and configured claims server-side before storing it in an httpOnly, sameSite cookie named by `ADMIN_WEB_CLERK_SESSION_COOKIE_NAME`.
- Browser calls protected admin operations through same-origin `/api/admin/...`.
- The admin-web server proxy forwards `Authorization: Bearer <Clerk JWT>` to the API.
- The backend verifies the JWT and checks tenant membership before allowing protected data access.

The legacy `/admin/access` token gate may remain for local dev fallback only.

## Bootstrap First Alpha Admin

After the user signs in with Clerk, map that Clerk user to a tenant role using env-managed values:

```bash
CLERK_BOOTSTRAP_TENANT_SLUG=<tenant slug>
CLERK_BOOTSTRAP_EMAIL=<admin email>
CLERK_BOOTSTRAP_USER_ID=<Clerk user id>
CLERK_BOOTSTRAP_ROLE=ADMIN
CLERK_BOOTSTRAP_PLATFORM_ADMIN=true
pnpm --filter @platform/api bootstrap:clerk-admin
```

Do not paste the real Clerk user ID or email into chat unless you intentionally want it visible in the conversation.

Use `CLERK_BOOTSTRAP_PLATFORM_ADMIN=true` only for the first trusted alpha owner who needs platform-level tenant list/create access. Tenant support agents should normally be mapped to a tenant role without platform admin.

## Manual Local QA

1. Configure Clerk local dev values in `.env`.
2. Start local services with `pnpm dev`.
3. Visit `http://localhost:3000/admin`.
4. Confirm unauthenticated users redirect to `/sign-in`.
5. Sign in through Clerk.
6. Confirm unmapped users cannot load tenant data.
7. Run the bootstrap mapping command.
8. Confirm mapped users can access the intended tenant.
9. Confirm the same user cannot access another tenant unless mapped.
10. Confirm a forged token-shaped JWT cannot establish `/api/auth/clerk/session` and cannot render `/admin` or `/agent`.
11. Confirm browser Network output does not expose `ADMIN_API_TOKEN`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, OpenAI key, database URL, or raw auth headers in API responses.
