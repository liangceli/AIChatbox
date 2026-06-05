# QA Skill

## Verification Commands

Use from repository root.

- Install dependencies: `pnpm install`
- Generate Prisma client: `pnpm db:generate`
- Start local infra: `docker compose -f infra/docker-compose.yml up -d`
- Apply migrations: `pnpm --filter @platform/database exec dotenv -e ../../.env -- prisma migrate deploy`
- Seed database: `pnpm db:seed`
- Typecheck workspace: `pnpm typecheck`
- Lint workspace: `pnpm lint`
- Build workspace: `pnpm build`
- Workspace tests: `pnpm test`
- API provider/retrieval tests: `pnpm --filter @platform/api test`
- Manual OpenAI real-key smoke helper: `pnpm --filter @platform/api smoke:openai`

Current scripts are still lightweight. API now has provider behavior tests, while some other packages still use placeholders.

Do not use long-running dev/watch commands as blocking verification commands. Examples that must stay out of blocking verification: `pnpm dev`, `npm run dev`, `next dev`, `vite`, `nodemon`, `tsx watch`.

## Manual Smoke Test

1. Start database/Redis infra.
2. Run migrations and seed.
3. Start `pnpm dev` only as a manual local server for browser testing.
4. Open admin web at `http://localhost:3000`.
5. Confirm tenant list loads.
6. Open `/admin` and select tenant.
7. Create or inspect a knowledge base.
8. Add a manual document and verify chunks are created.
9. Open `/chat`, send a question matching the document.
10. Confirm assistant response includes source citations when retrieval matches.
11. Click Human in the widget.
12. Confirm conversation enters `pending_human`.
13. Open `/agent`, assign a support user, send an agent reply.
14. Confirm widget refreshes through SSE and shows the agent message.

## Regression Checklist

- Protected tenant/knowledge/admin-agent endpoints reject missing admin token with 401.
- Protected tenant/knowledge/admin-agent endpoints reject invalid admin token with 403.
- Protected tenant/knowledge/admin-agent endpoints accept `x-admin-api-token` or bearer token when valid.
- Customer chat and customer handoff remain public but tenant-scoped.
- Admin conversation detail/read endpoints reject missing/invalid admin token and accept valid admin token.
- Customer conversation detail/read endpoints require visitorId and only return that visitor/conversation scope.
- Admin realtime SSE rejects missing/invalid admin token and accepts valid admin token.
- Customer realtime SSE remains reachable without admin token but only returns one visitor/conversation snapshot.
- Admin-web local alpha testing must not expose `ADMIN_API_TOKEN` in browser code. Use `/admin/access` and same-origin `/api/admin/...` proxy with httpOnly cookie.
- Tenant-scoped endpoints reject missing `x-tenant-slug`.
- Tenant-scoped reads/writes never expose another tenant's records.
- `POST /chat/messages` refuses empty messages and max-length violations.
- Existing `PENDING_HUMAN` conversation cannot receive another AI reply.
- Chat provider resolution returns deterministic provider by default and does not require external API keys.
- `AI_PROVIDER=openai` requires `OPENAI_API_KEY` and `OPENAI_MODEL`; config validation should fail clearly when missing.
- Assistant messages preserve retrieval metadata and add internal provider metadata.
- Knowledge-hit messages still produce deterministic grounded responses and citations.
- Knowledge-miss messages still produce deterministic fallback.
- OpenAI success preserves backend-generated citations from retrieved chunks even when deterministic grounded sentence scoring would return `citations: null`.
- Short keyword retrieval matches obvious title/content evidence and avoids substring-only weak matches.
- `policies` and `warranties` raw plural candidate lookup should return relevant policy/warranty chunks.
- `case` should not match `showcase` by substring alone; current Kasta manual smoke can still return real `Case Studies` citations when independent case evidence exists.
- OpenAI smoke helper is not part of normal tests and requires explicit OpenAI env.
- OpenAI provider failure falls back to deterministic content/citations behavior and records fallback metadata.
- Handoff rejects mismatched visitorId.
- Public handoff rejects missing/blank visitorId.
- Public handoff succeeds with the correct visitorId.
- Assign/reply rejects users without current tenant Role.
- Knowledge document archive removes chunks and excludes the document from retrieval.
- Reprocess replaces old chunks and updates `chunkCount`, `checksum`, `ingestedAt`.
- URL import rejects unsupported content types and too-short content.
- SSE endpoint sends `conversation_snapshot` and supports query `tenantSlug`.

## Known Test Gaps

- No real OpenAI success smoke test has run yet because no OpenAI API key is currently available.
- No service tests for tenant isolation.
- No API e2e tests for chat, knowledge, handoff, realtime.
- No frontend component tests.
- No browser automation for admin/agent/widget flows.

## Known QA Observations

- Manual QA for `fb3ca66 Add LLM provider boundary with deterministic fallback` passed.
- QA for `355e5f6 Add OpenAI provider with deterministic fallback` passed shell-verifiable checks and accepted the citation preservation fix.
- Retrieval candidate lookup now uses raw + normalized terms, while final scoring uses exact normalized tokens.
- `policies` / `warranties` and `case` / `showcase` regression checks passed in API tests and QA smoke.
- Short keyword-style retrieval now uses normalized exact-token scoring and targeted regression tests, but it is still deterministic keyword retrieval rather than semantic search.
- `pnpm-lock.yaml` should be tracked for dependency reproducibility in this pnpm monorepo.

## OpenAI Provider QA Notes

- Mocked OpenAI provider tests live in `apps/api/scripts/provider-behavior.test.ts`.
- Regression scenario: retrieved chunks exist, deterministic grounding would produce `citations: null`, mocked OpenAI success still returns retrieved chunk citations.
- Manual real-key smoke helper lives in `apps/api/scripts/openai-smoke.ts` and runs with `pnpm --filter @platform/api smoke:openai`.
- Smoke helper requires `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`; missing env fails clearly without printing API keys.
- Manual real-key smoke test remains pending until an OpenAI API key is available.
