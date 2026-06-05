# Current Status

## 2026-06-04 Split Readiness And Admin Protection Update

- Latest commit reviewed: `8ddc85d Add secure admin access and customer-scoped realtime`.
- Split-readiness documentation now exists under `docs/split-readiness/`.
- Long-term direction is the user's personal/commercial Level 3 AI support + lead capture product.
- Haneco/Kasta/company-specific work must remain seed/demo/company-only and must not drive platform core.
- Minimal admin API token guard now protects tenant management, knowledge management, key admin/agent conversation operations, admin conversation reads, and admin realtime snapshots.
- Guard accepts `x-admin-api-token` or `Authorization: Bearer`; missing token returns 401 and invalid token returns 403.
- `apps/admin-web` now has `/admin/access` alpha access gate and a same-origin `/api/admin/...` server-side proxy. The browser never receives `ADMIN_API_TOKEN`.
- Customer chat/widget and customer handoff remain public but tenant-scoped.
- Customer conversation read/realtime is now visitor/conversation-scoped.
- `GET /v1/realtime/conversations` is admin-protected and no longer broadly public alpha.
- Product-specific runtime URL import user-agent was replaced by product-neutral/configurable `KNOWLEDGE_IMPORT_USER_AGENT`.
- Split gate: the repo is conditionally ready for a personal product repo split if the next work starts Level 3 lead capture, public personal branding, or company-specific integrations.
- Manual QA acceptance: latest QA found the admin access open-redirect fix and required-visitorId handoff fix acceptable, with no required follow-up fixes.

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

- Latest commit: `8ddc85d Add secure admin access and customer-scoped realtime`.
- Accepted task: added secure admin-web server-side access/proxy, protected tenant-wide realtime/conversation reads, added customer-scoped realtime/read endpoints, required `visitorId` for public handoff, and replaced the runtime knowledge import user-agent with a product-neutral configurable value.
- Main changes: tenant management, all knowledge management, admin/agent conversation list/support-users/detail/messages/assign/reply/clear/delete, and admin realtime routes are protected by `AdminApiGuard`.
- Public customer map: customer chat, customer handoff, customer detail/messages with visitorId, and customer realtime for one visitor/conversation remain reachable without admin token.
- Admin-web access: `apps/admin-web` uses `/admin/access` and `/api/admin/...`; backend `ADMIN_API_TOKEN` is injected only server-side.
- Split-readiness: `docs/split-readiness/` records personal product boundary, company-only boundary, core extraction map, and repo split checklist. Haneco/Kasta/company-specific behavior is classified as seed/demo/company-only and must not define reusable platform core.
- QA result: manual QA acceptance passed after the P1 follow-up for admin access redirect sanitization and required handoff `visitorId`.
- Verification summary: `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build` passed. Focused API/admin-web tests covered admin access next-path sanitization, protected admin realtime, customer-scoped conversation read/realtime, required handoff `visitorId`, wrong-visitor rejection, provider/retrieval regressions, and `PENDING_HUMAN`.

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
- Realtime is currently a 2-second SSE snapshot flow, not a websocket collaboration layer. Admin snapshots are protected; customer snapshots are visitor/conversation-scoped.

## Current Limitations

- This is not production auth/RBAC; `AdminApiGuard` is only an alpha token boundary.
- Admin-web access gate is alpha token/session-cookie protection, not real user identity or RBAC.
- Customer conversation read/detail endpoints require visitorId but do not yet use signed customer sessions.
- Real OpenAI success smoke has not run because no OpenAI API key is currently available.
- Embeddings, vector database, and reranker are not implemented.
- Short keyword-style questions can still produce weak deterministic retrieval matches.
- `apps/ai-worker` has no queue, async ingestion, or background job yet.
- Most lint/test scripts are still TypeScript sanity checks or placeholders.
- Frontend uses many inline styles and does not yet have a formal design system.
- URL import uses simple HTML text extraction, not a full webpage parsing pipeline.

## Observed Risks

- Production auth must derive identity from auth context and apply tenant-aware authorization.
- Never expose `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, or `ADMIN_WEB_SESSION_SECRET` through `NEXT_PUBLIC_*`, browser bundles, local storage, responses, or logs.
- Customer visitorId is still bearer-like anonymous identity; production customer-session hardening remains future work.
- Real-key OpenAI smoke helper is manual-only and must not become a normal blocking automated test.
- Customer widget uses `/images/logo.png` as avatar path; external embed static asset strategy still needs review.
- Realtime snapshot load should be reevaluated as conversation volume grows.

## Recommended Next Tasks

1. If the next task begins Level 3 lead capture, public personal branding, or company-specific integrations, create the personal product repo first.
2. Replace alpha admin-web access with production auth/RBAC before production.
3. Decide the signed customer/session auth model for public customer conversation reads.
4. Run manual real-key OpenAI smoke when an API key is available.
5. Continue monitoring deterministic retrieval quality for short keyword-style questions.
6. Move knowledge ingestion from synchronous API requests toward worker/queue when product need is clear.
7. Plan embeddings/vector retrieval only when there is an explicit product need.
