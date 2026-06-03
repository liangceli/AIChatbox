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
- OpenAI provider failure falls back to deterministic content/citations behavior and records fallback metadata.
- Handoff rejects mismatched visitorId.
- Assign/reply rejects users without current tenant Role.
- Knowledge document archive removes chunks and excludes the document from retrieval.
- Reprocess replaces old chunks and updates `chunkCount`, `checksum`, `ingestedAt`.
- URL import rejects unsupported content types and too-short content.
- SSE endpoint sends `conversation_snapshot` and supports query `tenantSlug`.

## Known Test Gaps

- No dedicated unit tests for retrieval scoring.
- No real OpenAI success smoke test has run yet because no OpenAI API key is currently available.
- No service tests for tenant isolation.
- No API e2e tests for chat, knowledge, handoff, realtime.
- No frontend component tests.
- No browser automation for admin/agent/widget flows.

## Known QA Observations

- Manual QA for `fb3ca66 Add LLM provider boundary with deterministic fallback` passed.
- QA for `355e5f6 Add OpenAI provider with deterministic fallback` passed shell-verifiable checks and accepted the citation preservation fix.
- Short keyword-style questions can still produce weak deterministic retrieval matches; this is a known retrieval-quality limitation, not a provider-boundary regression.
- `pnpm-lock.yaml` is currently ignored/untracked despite an OpenAI dependency; confirm repository dependency reproducibility policy.

## OpenAI Provider QA Notes

- Mocked OpenAI provider tests live in `apps/api/scripts/provider-behavior.test.ts`.
- Regression scenario: retrieved chunks exist, deterministic grounding would produce `citations: null`, mocked OpenAI success still returns retrieved chunk citations.
- Manual real-key smoke test remains pending until an OpenAI API key is available.
