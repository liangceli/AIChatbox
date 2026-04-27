# White-Label AI Support Platform

Production-minded starter monorepo for a reusable, white-label, multi-tenant AI customer support platform.

The first tenant can be Kasta, but the platform core is intentionally tenant-agnostic. Branding, prompts, retrieval behavior, handoff policy, and integrations are expected to be configured per tenant rather than embedded in shared platform code.

## Stack

- `pnpm` workspaces
- `turbo` monorepo orchestration
- TypeScript across apps and packages
- `Next.js` admin app
- `React` embeddable customer widget
- `NestJS` API
- `Prisma` + PostgreSQL
- Redis-ready worker boundary

## Repository Layout

- `apps/admin-web` - internal admin dashboard shell
- `apps/customer-widget` - embeddable chat widget package
- `apps/api` - NestJS HTTP API
- `apps/ai-worker` - async worker entrypoint for future ingestion, retrieval, and handoff jobs
- `packages/ai-core` - shared AI and retrieval contracts
- `packages/database` - Prisma schema and database client
- `packages/types` - shared domain types
- `packages/utils` - small shared utilities
- `packages/config` - runtime environment helpers
- `packages/tenant-core` - tenant boundary contracts and helpers
- `packages/logging` - shared logging primitives
- `docs` - architecture and tenancy notes
- `infra` - local infrastructure bootstrap

## Quick Start

1. Install dependencies:

```bash
corepack pnpm install
```

2. Create a local `.env` file from `.env.example`.

3. Start local Postgres and Redis.

Use Docker if you have it:

```bash
docker compose -f infra/docker-compose.yml up -d
```

If you already run PostgreSQL or Redis locally, point `.env` at those services instead.

4. Generate Prisma client:

```bash
corepack pnpm db:generate
```

5. Apply the migrations:

```bash
corepack pnpm --filter @platform/database exec dotenv -e ../../.env -- prisma migrate deploy
```

6. Seed local data:

```bash
corepack pnpm db:seed
```

7. Start the workspace:

```bash
corepack pnpm dev
```

## Local Services

The default local environment expects:

- PostgreSQL at `localhost:5432`
- Redis at `localhost:6379`
- API at `http://localhost:4000/v1`
- Admin web at `http://localhost:3000`

If those ports are already taken on your machine, adjust `.env` before running Prisma or the apps.

## Seeded Demo Data

The seed creates tenant-scoped demo data only:

- tenant slug: `kasta`
- support admin email: `support@kasta.example`
- one `AgentConfig`
- one tenant membership row in `Role`
- one default knowledge base

This keeps Kasta-specific data isolated to development seed data, not platform core.

## Knowledge Loop

The knowledge loop is still intentionally lightweight, but now behaves more like a commercial support RAG workflow:

- knowledge bases and documents are tenant-scoped
- manual document content is stored on `KnowledgeDocument.content` so documents can be reprocessed
- ingestion sets document status to `INDEXING`, replaces stale chunks, writes deterministic `KnowledgeChunk` rows, then marks the document `READY`
- failed ingestion marks the document `FAILED` and stores lightweight error metadata
- archived documents are marked `ARCHIVED`, have their chunks removed, and are excluded from retrieval
- chunking is deterministic and prefers paragraph/sentence boundaries with overlap
- retrieval is tenant-scoped keyword ranking with phrase matching, title boosts, token coverage, and relevance scores
- assistant replies use retrieved evidence only when matching chunks are strong enough
- weak or missing evidence produces a cautious fallback response and can point users toward human handoff
- citations are stored directly on `Message.citations` with document id, chunk id, title, chunk index, source URI, source locator, relevance score, and excerpt

This is not a vector or embedding pipeline yet. Retrieval is isolated in `KnowledgeRetrievalService` so a future embedding-backed implementation can replace it without rewriting chat or admin flows.

## Minimal Chat + Knowledge Flow

1. Start the workspace with `corepack pnpm dev`
2. Open `http://localhost:3000`
3. Use the "Knowledge loop" panel to confirm the default knowledge base exists
4. Create a manual document with known content, for example:
   `Returns policy: Kasta allows returns within 30 days with the original receipt.`
5. Confirm the document shows `status: ready` and a non-zero chunk count
6. Open the document detail to inspect chunks
7. Click `Reprocess document` to replace chunks from the stored document content
8. Use `Archive document` to remove it from retrieval when it should no longer answer customer questions
9. Use the "Live local test" panel to ask a matching question, such as:
   `What is the returns policy?`
10. Verify the assistant response includes grounded content and the cited document title/chunk
11. Ask an unsupported question and confirm the assistant uses the fallback path instead of overclaiming
12. Verify the API health endpoint at `http://localhost:4000/v1/health`

You can also test the backend directly:

Create a knowledge document in the seeded default knowledge base:

```bash
curl -X GET http://localhost:4000/v1/knowledge-bases \
  -H "x-tenant-slug: kasta"
```

```bash
curl -X POST http://localhost:4000/v1/knowledge-bases/<knowledge-base-id>/documents \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: kasta" \
  -d "{\"title\":\"Returns Policy\",\"content\":\"Kasta allows returns within 30 days with the original receipt.\",\"sourceType\":\"manual\"}"
```

Then ask a knowledge-grounded question:

```bash
curl -X POST http://localhost:4000/v1/chat/messages \
  -H "Content-Type: application/json" \
  -H "x-tenant-slug: kasta" \
  -d "{\"message\":\"What is the returns policy?\",\"visitorId\":\"local-test-visitor\"}"
```

Then fetch the conversation:

```bash
curl http://localhost:4000/v1/conversations/<conversation-id> \
  -H "x-tenant-slug: kasta"
```

And list its messages, including persisted citations on the assistant message:

```bash
curl http://localhost:4000/v1/conversations/<conversation-id>/messages \
  -H "x-tenant-slug: kasta"
```

## Knowledge API

- `GET /v1/knowledge-bases`
- `POST /v1/knowledge-bases`
- `GET /v1/knowledge-bases/:knowledgeBaseId`
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents`
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents`
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId`
- `GET /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/chunks`
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/reprocess`
- `POST /v1/knowledge-bases/:knowledgeBaseId/documents/:documentId/archive`

Reprocessing is synchronous in this milestone. It deletes old chunks for the document, recreates chunks from the stored content or provided replacement content, updates `chunkCount`, and refreshes `ingestedAt`.

Fallback behavior is deliberately conservative: when retrieval returns no sufficiently relevant chunks, the assistant says it does not have enough matching knowledge-base evidence and, if enabled for the tenant, suggests requesting human support.

Still intentionally simplified:

- no embeddings or vector database
- no async ingestion queue
- no file storage pipeline beyond storing manual document text
- no realtime widget updates
- no full analytics or retrieval evaluation dashboard

## First Human Handoff Loop

The first human support workflow is intentionally direct:

- the customer widget can request a human after a conversation has started
- handoff marks the conversation as `PENDING_HUMAN`
- the backend stores `handoffRequestedAt`, `handoffReason`, and a `HANDOFF_EVENT` message
- the admin app can list tenant-scoped conversations and focus on pending human items
- the admin app can open a conversation, assign it to a tenant support user, and send a human reply
- agent replies are stored as `Message` rows with `authorType = AGENT`
- after a human reply, the conversation moves to `AWAITING_CUSTOMER`
- the customer widget can refresh the conversation to see the handoff event and human reply

This milestone does not add auth, realtime sockets, CRM sync, or multi-channel routing. It is the first end-to-end support handoff loop.

## Minimal Handoff Test Flow

1. Start the workspace with `corepack pnpm dev`
2. Open `http://localhost:3000`
3. Use the "Live local test" panel to send a customer message
4. Click `Talk to human`
5. Confirm the conversation shows `pending_human` and includes a system handoff event
6. In the "Human handoff" panel, keep the filter on `Pending human`
7. Open the pending conversation, assign it to the seeded support user, and send a manual reply
8. Return to the local chat demo and click `Refresh conversation`
9. Confirm the human reply is now visible in the customer-visible message history

The seeded support user for local testing is still `support@kasta.example`.

## Conversation API

- `GET /v1/conversations`
- `GET /v1/conversations/support-users`
- `GET /v1/conversations/:conversationId`
- `GET /v1/conversations/:conversationId/detail`
- `GET /v1/conversations/:conversationId/messages`
- `POST /v1/conversations/:conversationId/handoff`
- `POST /v1/conversations/:conversationId/assign`
- `POST /v1/conversations/:conversationId/agent-replies`

## Multi-Tenant Intent

- Every core business record is tenant-aware.
- Shared platform capabilities live in packages and generic apps.
- Tenant-specific behavior belongs in configuration, tenant-scoped database records, or future integration modules.
- The platform can evolve toward RAG, workflow orchestration, human handoff routing, and agent supervision without rewriting the core repository shape.

More detail is in [docs/architecture.md](/c:/Users/liangceli/HanecoAIPilot/docs/architecture.md) and [docs/tenancy.md](/c:/Users/liangceli/HanecoAIPilot/docs/tenancy.md).
