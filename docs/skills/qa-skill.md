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
- Placeholder tests: `pnpm test`

Current scripts are mostly TypeScript sanity checks and placeholders; they are not comprehensive automated regression tests.

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
- Handoff rejects mismatched visitorId.
- Assign/reply rejects users without current tenant Role.
- Knowledge document archive removes chunks and excludes the document from retrieval.
- Reprocess replaces old chunks and updates `chunkCount`, `checksum`, `ingestedAt`.
- URL import rejects unsupported content types and too-short content.
- SSE endpoint sends `conversation_snapshot` and supports query `tenantSlug`.

## Known Test Gaps

- No dedicated unit tests for retrieval scoring.
- No service tests for tenant isolation.
- No API e2e tests for chat, knowledge, handoff, realtime.
- No frontend component tests.
- No browser automation for admin/agent/widget flows.
