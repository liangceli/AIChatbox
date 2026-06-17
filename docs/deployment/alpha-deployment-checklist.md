# Alpha Deployment Checklist

Do not treat local fake tokens or mocked services as online alpha evidence.

## Required User-Owned Setup

The project owner must configure these in hosting dashboards or secret managers:

- Clerk project, publishable key, JWT verification key, issuer, authorized parties, redirect URLs, and allowed origins.
- Database `DATABASE_URL`.
- API URL and admin-web URL.
- OpenAI `OPENAI_API_KEY` and `OPENAI_MODEL` if alpha uses real OpenAI.
- `CORS_ALLOWED_ORIGINS` or equivalent hosting/API CORS configuration for admin-web and the external widget test domain.
- Strong admin/session secrets for any retained local/service fallback.
- Deployment provider settings for Vercel/admin-web and Render/API, or equivalent hosts.

Never commit or paste real secret values into docs, Git, logs, or chat.

## Admin-Web Env

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<public Clerk key>
CLERK_SIGN_IN_URL=/sign-in
CLERK_SIGN_UP_URL=/sign-up
CLERK_AFTER_SIGN_IN_URL=/admin
CLERK_AFTER_SIGN_UP_URL=/admin
ADMIN_WEB_CLERK_SESSION_COOKIE_NAME=platform_clerk_session
API_INTERNAL_BASE_URL=<deployed API /v1 base URL>
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=<alpha tenant slug>
```

Legacy local fallback only:

```env
ADMIN_API_TOKEN=<server-only fallback token>
ADMIN_WEB_ACCESS_TOKEN=<local-only access token>
ADMIN_WEB_SESSION_SECRET=<local-only session secret>
```

## API Env

```env
DATABASE_URL=<secret database URL>
REDIS_URL=<secret Redis URL if used>
ADMIN_API_PROTECTION_MODE=clerk
CLERK_JWT_KEY=<server-side public verification key>
CLERK_ISSUER=<expected Clerk issuer>
CLERK_AUTHORIZED_PARTIES=<admin-web origin>
AI_PROVIDER=openai
OPENAI_API_KEY=<secret OpenAI key>
OPENAI_MODEL=<chosen model>
NEXT_PUBLIC_API_BASE_URL=<public API /v1 base URL>
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=<alpha tenant slug>
WIDGET_DEFAULT_TENANT_SLUG=<alpha tenant slug>
```

## Deployment Steps

1. Provision database and run migrations.
2. Seed or create the alpha tenant.
3. Configure Clerk app redirect URLs and origins.
4. Configure admin-web env in Vercel or equivalent.
5. Configure API env in Render or equivalent.
6. Deploy API and confirm `/v1/health`.
7. Deploy admin-web and confirm `/sign-in` loads Clerk.
8. Sign in with Clerk.
9. Bootstrap/map the first trusted alpha owner with `pnpm --filter @platform/api bootstrap:clerk-admin`; set `CLERK_BOOTSTRAP_PLATFORM_ADMIN=true` only if that user needs platform tenant list/create access.
10. Confirm mapped tenant access.
11. Configure CORS for the external widget test domain.
12. Run the online smoke checklist.

Codex cannot complete real deployment without the project owner's hosting and Clerk dashboard access. Do not mark alpha online until the deployed URLs and external widget smoke have passed.
