# Alpha Runtime Checklist

Use this before alpha demos or staging-like QA.

## Local Deterministic Baseline

- `AI_PROVIDER=deterministic`
- `ADMIN_API_PROTECTION_MODE=token`
- `ADMIN_API_TOKEN` uses a local-only placeholder or strong local secret
- `ADMIN_WEB_ACCESS_TOKEN` and `ADMIN_WEB_SESSION_SECRET` are set for admin-web access
- `NEXT_PUBLIC_DEFAULT_TENANT_SLUG` and `WIDGET_DEFAULT_TENANT_SLUG` match the seeded tenant you are testing

The current seed/demo tenant may be `kasta`; treat it as local demo/company-only context.

## Local OpenAI Smoke

- Set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` only in the current shell or uncommitted local env.
- Run `pnpm --filter @platform/api smoke:openai`.
- Return to `AI_PROVIDER=deterministic` after the smoke unless the whole session intentionally tests OpenAI.

## Staging / Alpha

- Use `NODE_ENV=production` for production-like validation.
- Keep `ADMIN_API_PROTECTION_MODE=token`.
- Do not use `test-admin-token`, `test-web-token`, or `test-session-secret-for-local-qa`.
- Use deployment secret manager values for all secrets.
- Keep OpenAI deterministic by default unless staging is explicitly testing real OpenAI.
- Fake/test/local-only tokens validate only local QA paths. They are not online/alpha acceptance evidence.

## Production Readiness Gate

Do not treat the current alpha runtime as production-ready until:

- alpha admin-web token gate is replaced with real auth/RBAC
- customer visitor identity is signed or session-backed
- secret manager and log redaction are confirmed
- CI verifies typecheck, lint, test, and build
- OpenAI real-key smoke passes in staging if OpenAI will be enabled

## Route Smoke

- Public customer chat can create/continue its own conversation.
- Public customer tenant profile returns only widget-safe display fields.
- Public customer handoff requires the correct `visitorId`.
- Public customer conversation read and realtime only expose the current visitor/conversation.
- Protected tenant, knowledge, admin conversation, and admin realtime routes reject missing/invalid admin token.
- Protected tenant AI profile read/update routes reject missing/invalid admin token and accept a valid token.
- Protected routes accept a valid admin token through the admin-web server-side proxy.
