# Current Status

## 2026-06-17 Admin Conversations Page Split

- Active Chats / conversation operations have been moved out of the main `/admin` dashboard.
- New protected admin route: `/admin/conversations`.
- The left drawer `Conversations` item now navigates to `/admin/conversations`; `Dashboard` returns to `/admin`.
- `/admin` now keeps the dashboard/profile/knowledge workspace separate from the conversation operations workspace.
- Local route checks returned 200 for `/admin`, `/admin/conversations`, and API health at `/v1/health`.

## 2026-06-17 Clerk Alpha Auth Code-Level Closeout

- Current repo root confirmed: `C:\Users\liangceli\HanecoAIPilot`.
- Latest commit at the start of this task: `0fd2603 Add Clerk alpha auth and deployment readiness docs & update skill files`; this task adds new uncommitted Clerk hardening/test/docs changes.
- Current stage: Clerk alpha auth code-level closeout is complete; real local Clerk login smoke is blocked until the user configures Clerk Dashboard and local env values directly.
- Admin-web Clerk verification now requires RS256 signature, string `sub`, numeric unexpired `exp`, valid optional `nbf`, optional issuer, and optional authorized party before a Clerk JWT is accepted as the httpOnly admin-web Clerk session cookie.
- `/api/auth/clerk/session` rejects missing verification config, invalid verification key, forged token-shaped JWTs, and invalid JWTs without setting cookies.
- `/admin`, `/agent`, and `/api/admin/...` reverify Clerk cookies server-side; forged cookies redirect or return 401 safely.
- Admin-web proxy forwards `Authorization: Bearer <Clerk JWT>` only after server-side verification. Legacy `/admin/access` and `ADMIN_API_TOKEN` remain local/dev or server-only fallback paths.
- Backend `AdminApiGuard` in Clerk mode verifies signature/claims, fails safely on invalid `CLERK_JWT_KEY`, requires mapped `User` + tenant `Role`, rejects wrong tenant and unmapped users, and requires `User.isPlatformAdmin=true` for platform tenant list/create.
- Customer widget/chat/customer conversation routes remain public customer-scoped and do not require Clerk.
- Added/strengthened tests:
  - Admin-web handler-style tests for forged JWT POST 401/no cookie, missing config 500/no cookie, invalid key rejection, forged `/admin` and `/agent` cookie redirect, forged proxy 401/no upstream fetch, verified bearer forwarding, and legacy fallback no bearer forwarding.
  - API tests for forged signature, missing expiration, invalid JWT key, issuer mismatch, authorized-party mismatch, valid issuer/authorized-party, wrong tenant, unmapped user, and platform admin gate.
- Verification passed: admin-web test/typecheck/build, API test/typecheck/build, config typecheck/build, `node --check apps/admin-web/scripts/admin-access.test.cjs`, and `git diff --check` with Windows LF/CRLF warnings only.
- Real Clerk smoke result: not run yet; waiting for user to configure Clerk project, allowed redirects/origins, and env values without sharing secrets.
- Never paste or expose `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, raw Clerk JWTs, auth headers, database URLs, OpenAI keys, admin tokens, session secrets, or raw env files in chat, browser code, logs, responses, or committed docs.
- Next stage after user setup: local real Clerk smoke, first alpha owner bootstrap via `pnpm --filter @platform/api bootstrap:clerk-admin`, then Alpha Online Deployment + External Widget Smoke.

## 2026-06-17 Clerk Alpha Auth QA Reconciliation

- Latest Git commit reviewed for this sync: `0c6fc17 update skill files`.
- Important reconciliation note: `0c6fc17` is a documentation sync commit and does not contain the Clerk alpha auth implementation described by the latest implementation/QA handoff. The current working tree contains newer uncommitted Clerk alpha auth and deployment-readiness changes.
- Latest accepted QA context: Admin-Web Clerk session verification P1 fix accepted with no P0/P1 findings.
- Admin-web Clerk session bridge now must verify Clerk JWT signature and configured claims before setting the httpOnly Clerk session cookie.
- `/admin`, `/agent`, and `/api/admin/...` must reject forged token-shaped Clerk JWT cookies; token shape/expiry checks alone are not sufficient.
- Admin-web proxy forwards `Authorization: Bearer <Clerk JWT>` only after server-side verification. Legacy `/admin/access` and `ADMIN_API_TOKEN` remain local/dev or service fallback paths and must stay server-only.
- `packages/config` now includes Clerk verification config fields: `CLERK_JWT_KEY`, optional `CLERK_ISSUER`, and optional `CLERK_AUTHORIZED_PARTIES`.
- API Clerk mode still relies on backend `AdminApiGuard`, mapped `User`, tenant `Role`, and platform-admin checks; signed-in Clerk users are not automatically authorized for tenant data.
- Latest QA found two non-blocking P2 gaps: admin-web forged JWT coverage is mostly source-smoke rather than runtime route-handler tests, and backend Clerk issuer/authorized-party tests can be strengthened.
- Real online alpha readiness is still not proven until user-owned Clerk, hosting, database, CORS, OpenAI-if-enabled, and external widget smoke checks pass on deployed URLs.

## 2026-06-12 Reliable Citation Locator Omission

- Latest commit: `49962f7 Fix reliable citation locator omission`.
- Backend citations now omit the `sourceLocator` key entirely when a retrieved chunk has no reliable locator.
- Reliable locators are still preserved when present on retrieved chunks.
- This avoids persisting nested `sourceLocator: undefined` values into Prisma JSON fields.
- Latest QA accepted this P1 fix with no required follow-up fixes.
- This locator-only fix does not change provider requests, retrieval scoring, model output, message flow, handoff, or conversation history.

## 2026-06-12 RAG Quality Hardening

- Knowledge URL import now removes common HTML noise, hidden blocks, duplicate lines, and preserves heading breaks before chunking.
- Chunking removes repeated blocks before splitting and still uses paragraph/sentence/overlap boundaries.
- Retrieval keeps raw plural candidate lookup, normalized exact-token final scoring, common support synonym matching, title weighting, and a per-document diversity cap.
- Answer Debug now exposes safe retrieval confidence, source diversity, and warnings without raw prompts, tenant IDs, secrets, or `sourceLocator`.
- Architecture docs `docs/architecture/rag-quality-audit.md` and `docs/architecture/rag-2-upgrade-path.md` record alpha gaps and deferred RAG 2.0 work.

## 2026-06-12 Knowledge URL Import SSRF Protection

- Latest commit: `8db4939 feat: add secure knowledge answer debug and URL import`.
- URL import now accepts only safe public HTTP(S) targets.
- Initial URLs and every redirect target are checked against local/internal/metadata hostnames, restricted IPv4/IPv6 ranges, and all DNS results.
- Outbound requests use DNS-pinned validated public addresses, a five-redirect limit, a true 15-second absolute deadline, and a 2 MB response limit.
- Continuous slow-trickle responses cannot extend a URL import request beyond the absolute deadline, and deadline timers are cleared on every completion path.
- Safe public HTML/text import behavior remains supported; no new dependency or migration was added.
- Latest QA accepted the absolute-deadline P1 fix with no required follow-up fixes.

## 2026-06-12 Knowledge Answer Debug And Alpha Knowledge UX

- Protected `POST /v1/chat/answer-debug` runs tenant-scoped retrieval and the currently configured provider without creating a customer, conversation, or message.
- Answer Debug returns only explicit safe fields: tenant slug/display name, question, answer, knowledge hit/miss reason, retrieved chunk previews/scores, backend citations, requested/used provider mode, fallback state, and allowlisted provider metadata.
- Debug output intentionally omits tenant IDs, raw prompts, hidden instructions, auth headers, API/admin tokens, provider secret config, and citation `sourceLocator`.
- Admin-web Knowledge Base now shows document source/status/chunk count/ingested time/checksum, document chunk previews, URL import, and clear reprocess/archive/delete feedback.
- Real OpenAI debug remains user-gated: configure `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` only in local `.env` or a secret manager, run `pnpm --filter @platform/api smoke:openai`, then run a knowledge-backed question in Answer Debug.
- No Prisma migration, public customer API change, provider default change, or real OpenAI automated test was introduced.
- Manual acceptance passed for public URL import, restricted URL rejection, desktop/mobile knowledge UI, real OpenAI smoke, and real OpenAI Answer Debug.

## 2026-06-12 Latest Commit And QA Reconciliation

- Latest commit and latest QA now align on `8db4939 feat: add secure knowledge answer debug and URL import`.
- Latest accepted P1 follow-up replaces URL-import socket inactivity timeout behavior with a true 15-second absolute per-request deadline.
- Latest QA found no required fixes and confirmed existing SSRF protection, DNS pinning, redirect validation, response limit, admin protection, and tenant scope remain intact.
- Manual QA passed all five acceptance items, including real OpenAI smoke and real OpenAI Answer Debug with no observed secret exposure.

## 2026-06-05 Persistent Human Support Mode

- Human handoff is now an explicit persistent mode: `PENDING_HUMAN` remains active after agent replies.
- Customer messages during `PENDING_HUMAN` are saved for the agent and return `assistantMessage: null`; deterministic/OpenAI providers are not called.
- Customers can end human support from the widget/local chat when they want AI to resume.
- Admin/agent consoles can start or end human mode through protected human-support endpoints via the admin-web proxy.

## 2026-06-05 Local Dev Startup And Admin Access Ergonomics

- Admin-web server routes now load the repository-root `.env` before validating admin access/proxy config.
- Admin-web uses an admin-web-specific env parser for `/admin/access` and `/api/admin/...`, so unrelated API/OpenAI env validation does not block local admin login.
- `apps/admin-web` explicitly declares `@platform/config` as a workspace dependency.
- Local placeholder QA remains token-gated: if `ADMIN_WEB_ACCESS_TOKEN=test-web-token`, entering `test-web-token` at `/admin/access` should unlock the admin UI.
- Production security goals are unchanged: browser code must not receive `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, or `ADMIN_WEB_SESSION_SECRET`; protected backend calls still go through the server-side proxy.
- `docs/runtime/local-dev-checklist.md` documents the normal root `pnpm dev` path, Corepack setup if `pnpm` is not on PATH, URL map, required env keys, and troubleshooting.

## 2026-06-05 Tenant AI Profile Implementation

- Tenant AI profile settings are implemented on top of existing `AgentConfig` storage: display fields use existing columns/widget settings, and internal prompt guidance is stored in `metadata.aiProfile`.
- No Prisma schema change or migration was introduced for the profile foundation.
- Protected admin routes: `GET /v1/tenants/:tenantSlug/ai-profile` and `PATCH /v1/tenants/:tenantSlug/ai-profile`.
- Public widget-safe route: `GET /v1/tenant-profile` with tenant resolution. It returns display fields only and does not expose safe answer rules, sensitive topic rules, do-not-answer rules, provider settings, tenant IDs, or secrets.
- Admin-web now includes an AI Profile form that uses the existing `/api/admin/...` server-side proxy. Browser code still does not receive `ADMIN_API_TOKEN`.
- Customer widget loads public tenant profile basics and displays assistant name, company display name, welcome/handoff messaging, primary color, and avatar/logo when configured.
- OpenAI prompt assembly now combines platform safety rules with tenant profile identity, business type, tone, and internal guidance. Platform safety rules remain explicitly higher priority than tenant profile text.
- Deterministic fallback remains default and uses tenant fallback/handoff messaging where low-risk.
- Real OpenAI activation remains a manual user action: configure `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` only in local `.env` or a secret manager, then run `pnpm --filter @platform/api smoke:openai`.

## 2026-06-05 Runtime Env, OpenAI Enablement, And Safe Answer Baseline

- Latest commit reviewed: `bcaa940 Add runtime env templates and OpenAI safety docs`.
- Runtime env templates now exist for neutral reference, local QA, staging, and production: `.env.example`, `.env.local.example`, `.env.staging.example`, `.env.production.example`.
- Root env examples now default tenant slugs to `demo`; `kasta` is documented as local seed/demo or company-only context, not reusable product default.
- Local-only placeholders `test-admin-token`, `test-web-token`, and `test-session-secret-for-local-qa` are documented as local QA only and must not be used in staging/production.
- Runtime docs now live under `docs/runtime/`: env setup, OpenAI enablement, alpha runtime, and secret safety checklists.
- OpenAI remains opt-in through `AI_PROVIDER=openai`; deterministic remains the default and does not require `OPENAI_API_KEY`.
- OpenAI smoke helper now prints a secret-safe pass summary for provider mode, real OpenAI attempt, assistant text, citations, metadata, and fallback state.
- OpenAI prompt baseline now explicitly avoids invented service promises/unavailable facts, high-risk professional advice, and disclosure of hidden prompts, API keys, routing logic, provider settings, tenant IDs, or internal metadata.
- Secret-safety scan guidance now excludes real env files and prints only path, line number, and rule/category. Real env files use boolean shape checks so secret values are not printed.
- QA/manual validation accepted the P1 secret-scan fix; no required follow-up fixes remain.

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
- Real OpenAI smoke and real OpenAI Answer Debug have now passed manual acceptance. OpenAI remains opt-in and real-key checks remain manual rather than normal automated CI.

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

- Latest commit reviewed for this docs sync: `0c6fc17 update skill files`.
- Accepted QA task described by current handoff: Clerk alpha auth P1 fix for Admin-Web Clerk session verification.
- Commit reconciliation: the Clerk auth handoff/QA describes newer uncommitted working-tree changes, not the latest committed `0c6fc17` docs-only commit.
- Contract: Admin-Web may set or trust its Clerk session cookie only after server-side Clerk JWT signature and claim verification. `/admin`, `/agent`, and `/api/admin/...` must reject forged token-shaped JWTs.
- QA result: no P0/P1 findings. Non-blocking P2 follow-ups remain for runtime forged-JWT route tests and stronger Clerk issuer/authorized-party guard coverage.
- Verification summary from accepted QA: admin-web test/typecheck/build, API test/typecheck, config typecheck/build, and `git diff --check` passed, with only Windows LF/CRLF warnings.

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

- Clerk alpha admin/agent auth is implemented in the current working tree, but it is not full production RBAC, SSO, invite approval, billing-aware roles, or signed customer identity.
- Latest committed HEAD is documentation-only relative to the Clerk handoff; implementation changes must be committed/reviewed before treating the repository history as synced.
- Customer conversation read/detail endpoints require visitorId but do not yet use signed customer sessions.
- Real OpenAI smoke has passed manual acceptance, but it remains opt-in/manual and must not become a normal blocking CI test while it requires a real key.
- Embeddings, vector database, and reranker are not implemented.
- Short keyword-style questions can still produce weak deterministic retrieval matches.
- `apps/ai-worker` has no queue, async ingestion, or background job yet.
- Most lint/test scripts are still TypeScript sanity checks or placeholders.
- Frontend uses many inline styles and does not yet have a formal design system.
- URL import uses simple HTML text extraction, not a full webpage parsing pipeline.

## Observed Risks

- Production auth must derive all acting user identity from verified auth context and tenant-aware authorization, not request body fields.
- Admin-web middleware may do quick cookie-presence redirects, but page/proxy handlers must remain the final Clerk verification boundary.
- Never expose `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, or `ADMIN_WEB_SESSION_SECRET` through `NEXT_PUBLIC_*`, browser bundles, local storage, responses, or logs.
- Never expose `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`, Clerk JWTs, auth headers, database URLs, OpenAI keys, or admin/session secrets in browser bundles, docs examples with real values, responses, or logs.
- Customer visitorId is still bearer-like anonymous identity; production customer-session hardening remains future work.
- Real-key OpenAI smoke helper is manual-only and must not become a normal blocking automated test.
- Customer widget uses `/images/logo.png` as avatar path; external embed static asset strategy still needs review.
- Realtime snapshot load should be reevaluated as conversation volume grows.

## Recommended Next Tasks

1. Commit or otherwise review the current Clerk alpha auth working-tree changes so repository history matches the accepted handoff/QA state.
2. Run manual Clerk alpha acceptance: no cookie redirects, forged token POST returns 401/no cookie, forged session cookie cannot render `/admin` or `/agent`, forged cookie cannot proxy `/api/admin/...`, and legacy local `/admin/access` still works when intentionally configured.
3. Add runtime route-handler coverage for forged Clerk JWT rejection and stronger backend issuer/authorized-party tests.
4. Complete deployed online alpha smoke with user-owned Clerk, hosting, DB, CORS, OpenAI-if-enabled, and external widget configuration before claiming alpha-online readiness.
5. Continue alpha knowledge QA using `docs/runtime/alpha-knowledge-qa-checklist.md`, including optional citation locator checks.

## 2026-06-12 Alpha Auth Status

- Admin/agent auth now has a Clerk alpha path: admin-web `/sign-in` / `/sign-up` establishes an httpOnly Clerk session cookie, and `/api/admin/...` forwards Bearer auth to the API.
- API `AdminApiGuard` supports `ADMIN_API_PROTECTION_MODE=clerk`, verifies Clerk JWTs, and requires a mapped `User` + tenant `Role` before tenant protected data is accessible.
- The legacy `/admin/access` token gate and `ADMIN_API_TOKEN` proxy path remain only as local/dev or service fallback, not the primary staging/production alpha path.
- First alpha owner mapping is manual via `pnpm --filter @platform/api bootstrap:clerk-admin` with env-managed Clerk user/tenant values.
- Real alpha acceptance still requires user-owned Clerk setup, deployment env setup, deployed URL verification, external widget embed smoke, and real OpenAI smoke if OpenAI is enabled.
