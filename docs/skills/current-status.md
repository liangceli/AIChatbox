# Current Status

## 2026-06-04 Split Readiness And Admin Protection Update

- Latest commit reviewed: `10229ff Add admin protection boundary and split-readiness docs`.
- Split-readiness documentation now exists under `docs/split-readiness/`.
- Long-term direction is the user's personal/commercial Level 3 AI support + lead capture product.
- Haneco/Kasta/company-specific work must remain seed/demo/company-only and must not drive platform core.
- Minimal admin API token guard now protects tenant management, knowledge management, and key admin/agent conversation operations.
- Guard accepts `x-admin-api-token` or `Authorization: Bearer`; missing token returns 401 and invalid token returns 403.
- Customer chat/widget, customer handoff, conversation detail/read, and realtime SSE remain public but tenant-scoped under the current alpha contract.
- `GET /v1/realtime/conversations` currently returns public alpha tenant-scoped snapshots with conversation list, `pendingHumanCount`, and active conversation detail; this must be narrowed or protected before production.
- `apps/admin-web` is still browser-only and has no safe admin token/session/proxy path. Do not expose `ADMIN_API_TOKEN` to the browser; local alpha usage requires explicit dev disable mode or a future server-side auth/proxy.
- Route-map QA expectation: protected admin/agent/platform routes must reject missing/invalid tokens and accept valid tokens, while public customer/widget/realtime alpha routes must stay reachable for now.
- Accepted QA found no required fixes after the docs follow-up.

## 2026-06-03 Stabilization Update

- Dependency reproducibility policy updated: `pnpm-lock.yaml` should be tracked and is no longer ignored.
- OpenAI real-key smoke helper added: `pnpm --filter @platform/api smoke:openai`; it is manual-only and not part of normal tests.
- Short keyword retrieval now uses normalized exact-token scoring and stricter one-token thresholds to reduce weak substring matches.
- API provider tests now cover retrieval short-query behavior, OpenAI citation preservation, safe provider metadata, fallback metadata, and `PENDING_HUMAN` blocking.
- Real OpenAI smoke remains pending until a valid API key is available.

## Current Code State

This project is a TypeScript monorepo for a reusable white-label, multi-tenant AI support platform.

- `apps/admin-web`: Next.js admin console, agent inbox, and local chat test surface.
- `apps/customer-widget`: embeddable React customer support widget.
- `apps/api`: NestJS API with tenant resolution, chat, knowledge, conversation handoff, realtime snapshot, admin protection, and provider resolution.
- `apps/ai-worker`: worker boundary and env/logging placeholder; no real async jobs yet.
- `packages/database`: Prisma schema, migrations, and seed data.
- `packages/types`: shared frontend/backend API shapes.
- `packages/config`: runtime env parsing and validation.
- `packages/ai-core`: reusable LLM provider contracts.

## Workflow State

- This project uses the repository-based AI handoff workflow.
- Codex Chat 1 is Project Context & Docs: maintain `docs/skills`, project memory, and handoff docs.
- Do not use this chat for Project Director decisions, implementation, or QA execution unless explicitly asked.
- Current handoff directory: `docs/ai-handoff/`.
- After each accepted and committed task, update docs from `docs/ai-handoff/latest-implementation.md`, `docs/ai-handoff/latest-qa.md`, `git log -1`, and `git show HEAD`.
- After each handoff sync, refresh `docs/ai-handoff/director-update.md` for ChatGPT Project Director.

## Latest Accepted Task

- Latest commit: `10229ff Add admin protection boundary and split-readiness docs`.
- Accepted task: prepared split-readiness documentation for the future personal/commercial Level 3 AI support + lead capture product and added a minimal backend admin/agent/platform protection boundary.
- Main changes: tenant management, all knowledge management, and admin/agent conversation list/support-users/assign/reply/clear/delete routes are protected by `AdminApiGuard`.
- Public alpha map: customer chat, customer handoff, conversation detail/read, and `GET /v1/realtime/conversations` remain reachable without admin token under the current alpha contract.
- Admin-web limitation: `apps/admin-web` is browser-only and must not receive or expose `ADMIN_API_TOKEN`; local browser testing needs explicit dev disable mode or a future server-side auth/proxy path.
- Split-readiness: `docs/split-readiness/` records personal product boundary, company-only boundary, core extraction map, and repo split checklist. Haneco/Kasta/company-specific behavior is classified as seed/demo/company-only and must not define reusable platform core.
- QA result: accepted QA found no required fixes after the docs follow-up. Route-map expectations now cover protected 401/403/valid-token behavior and public alpha customer/widget/realtime reachability.
- Verification summary: API/config/ai-core typecheck/lint/build checks passed where applicable; API tests covered admin guard/config behavior, tenant slug regression, provider/retrieval regressions, and `PENDING_HUMAN`.

## Implemented Capabilities

- Tenant resolution through `x-tenant-slug`; SSE/EventSource supports query `tenantSlug`.
- Tenant-scoped chat message persistence, conversation creation/resume, and anonymous visitor ID persistence.
- Deterministic knowledge retrieval plus deterministic/OpenAI LLM provider reply.
- `@platform/ai-core` provides the LLM provider boundary; API resolves deterministic/OpenAI through `LlmProviderResolverService`.
- `AI_PROVIDER=deterministic` is default. `AI_PROVIDER=openai` requires `OPENAI_API_KEY` and `OPENAI_MODEL`.
- No external LLM API is called under the deterministic default.
- Assistant message citations, retrieval metadata, and provider metadata persist to `Message`.
- Knowledge retrieval DB candidate lookup uses raw + normalized terms; final scoring uses exact normalized tokens.
- `pnpm-lock.yaml` is part of dependency reproducibility policy.
- Knowledge base supports create, manual text, file text, single/batch URL import, chunking, reprocess, archive, and delete.
- Handoff supports customer human-support request, support user assignment, and agent reply.
- Realtime is currently a 2-second SSE snapshot flow, not a websocket collaboration layer.

## Current Limitations

- This is not production auth/RBAC; `AdminApiGuard` is only an alpha token boundary.
- `apps/admin-web` has no safe token/session/proxy path for protected admin endpoints.
- `GET /v1/realtime/conversations` is public alpha and exposes tenant-scoped conversation snapshots.
- Conversation read/detail endpoints remain public alpha for current widget/realtime assumptions.
- Real OpenAI success smoke has not run because no OpenAI API key is currently available.
- Embeddings, vector database, and reranker are not implemented.
- Short keyword-style questions can still produce weak deterministic retrieval matches.
- `apps/ai-worker` has no queue, async ingestion, or background job yet.
- Most lint/test scripts are still TypeScript sanity checks or placeholders.
- Frontend uses many inline styles and does not yet have a formal design system.
- URL import uses simple HTML text extraction, not a full webpage parsing pipeline.

## Observed Risks

- Production auth must derive identity from auth context and apply tenant-aware authorization.
- Realtime snapshots should be narrowed or protected before production.
- Never expose `ADMIN_API_TOKEN` through `NEXT_PUBLIC_*`, browser bundles, local storage, or direct browser requests.
- `apps/api/src/modules/knowledge/knowledge.service.ts` uses `HanecoAIPilotBot/0.1 knowledge-import` as URL import user-agent; rename it to product-neutral wording before or during repo split.
- Real-key OpenAI smoke helper is manual-only and must not become a normal blocking automated test.
- Customer widget uses `/images/logo.png` as avatar path; external embed static asset strategy still needs review.
- Realtime snapshot load should be reevaluated as conversation volume grows.

## Recommended Next Tasks

1. Decide whether the next alpha cycle should keep admin-web local testing in explicit dev-disable mode or implement a server-side admin auth/proxy path.
2. Narrow or protect `GET /v1/realtime/conversations` before production.
3. Decide the customer/session auth model for conversation read/detail endpoints.
4. Rename product-specific split-review items before or during repo split.
5. Run manual real-key OpenAI smoke when an API key is available.
6. Continue monitoring deterministic retrieval quality for short keyword-style questions.
7. Move knowledge ingestion from synchronous API requests toward worker/queue when product need is clear.
8. Plan embeddings/vector retrieval only when there is an explicit product need.
