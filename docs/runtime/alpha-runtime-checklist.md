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
- Protected `POST /v1/chat/answer-debug` rejects missing/invalid admin token and accepts a valid token through the admin-web proxy.
- Protected routes accept a valid admin token through the admin-web server-side proxy.

## Knowledge Answer Quality Smoke

- In `/admin`, inspect a selected knowledge document's source, status, chunk count, ingested time, checksum, and chunk previews.
- Run a knowledge-backed Answer Debug question and confirm answer, retrieved chunks/scores, backend citations, provider/fallback state, and safe metadata.
- Run a knowledge-miss question and confirm the result clearly explains that no relevant READY chunk met the threshold.
- Confirm reprocess/archive/delete actions show clear success or safe error feedback.
- Confirm Answer Debug does not create customer-visible conversations/messages and does not display secrets, auth headers, raw prompts, hidden rules, tenant IDs, or provider secret config.
- Before treating real OpenAI as alpha-ready, complete `docs/runtime/openai-enable-checklist.md` using user-managed real secrets and then repeat Answer Debug with a knowledge-backed question.
