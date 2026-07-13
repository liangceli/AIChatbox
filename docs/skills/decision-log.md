# Decision Log

## 2026-07-13 - Repair applied lifecycle schema with a forward migration

Decision: add `20260713000000_fix_knowledge_chunk_version_index` instead of rewriting the already-applied lifecycle migration, and require rollback-safe real PostgreSQL proof for chunk version coexistence.

Reason: the initial schema created a unique index, while the later lifecycle migration attempted to drop a constraint. Mock tests passed but the real database still rejected version 2 chunks at existing chunk indexes.

Trade-off: migration history keeps the earlier mismatch visible, but every existing and fresh environment converges through a safe forward migration. A database integration command is required in addition to source-level tests.

Affected areas: Prisma migrations, database tests/scripts, lifecycle deployment/QA docs, current stage and handoff.

## 2026-07-13 - Treat explicit null product context as a state-clearing command

Decision: distinguish omitted product context from explicit null in `ConversationStateService`.

Reason: chat already clears legacy metadata with null. Ignoring the same null in explicit state allowed a later follow-up to revive stale product context.

Trade-off: unrelated new questions now clear active product state. Genuine follow-ups continue to preserve or replace context through non-null retrieval decisions.

Affected areas: conversation state persistence, regression tests, AI chat/backend/data-flow docs.

## 2026-07-08 - Use active knowledge lifecycle for answer grounding

Decision: Knowledge answers must be grounded only in active READY documents and READY chunks. Knowledge updates now use lifecycle state and chunk versions instead of hard-deleting or exposing partial processing.

Reason: Admins need to upload, replace, archive, and delete knowledge without the chatbot answering from stale chunks, deleted files, failed processing attempts, or duplicated conversation state.

Accepted boundary:

- `ConversationState` decides search context only; it does not become copied product knowledge.
- `KnowledgeDocument.status = READY` and `KnowledgeChunk.status = READY` are mandatory retrieval filters.
- Repeated FILE/URL imports update the active source document by source URI.
- Failed reprocess keeps the previous READY version searchable and records `processingError`.
- Archive/delete are soft lifecycle transitions first; retrieval/search excludes ARCHIVED/DELETED chunks.
- Embedding status is tracked as metadata now, but no external embedding/vector index is introduced in this step.

Trade-off: This keeps the current synchronous ingestion shape and DB-backed text chunks. It does not yet add async worker queues, object storage, pgvector, or document-level product foreign keys.

Affected areas: Prisma schema/migration, API knowledge service/retrieval/search, lifecycle tests, architecture/status/QA/skills docs.

## 2026-07-03 - Promote product context to explicit persisted state

Decision: Add `ConversationState` and `ProductCatalog` as the first production-RAG state layer while keeping legacy `Conversation.metadata.rag` synchronized during migration.

Reason: Product context, pending clarification, and pronoun/coreference behavior must be durable, auditable, and independent of prompt luck. A dedicated state table lets retrieval use active product context before ranking global evidence, while `ProductCatalog` gives tenant-specific products a stable semantic key.

Accepted boundary:

- `ConversationState` is retrieval context only; it is never authorization data.
- `ProductCatalog` is tenant-scoped and populated from resolved product metadata or explicit backfill, not hardcoded product names.
- Existing chunk/document JSON metadata remains the current evidence source; this step does not add pgvector, FTS, reranker, or parser dependencies.
- `Conversation.metadata.rag` remains a compatibility mirror until the UI/API no longer need the old shape.

Trade-off: The first phase creates durable state and product catalog records but does not yet add database-level product foreign keys on chunks or a persisted vector index.

Affected areas: Prisma schema/migration, API conversation state service, chat state read/write path, product-aware tests, architecture/status/QA/skills docs.

## 2026-07-03 - Context-safe Hybrid Search without external vector infrastructure

Decision: Use a bounded tenant-scoped Hybrid Search pipeline now: scored Keyword Top-20 plus dependency-free local sparse-semantic Vector Top-20, metadata/exact weighting, product-scope filtering, confidence threshold, and Final Top-3.

Reason: The current alpha needs better semantic recall and reliable multi-product clarification without introducing an external vector database, embedding bill, heavy framework, or new license surface before corpus size and deployment requirements justify them.

Accepted boundary:

- Every candidate query requires the resolved `tenantId` and READY document status.
- Product ambiguity discovery may inspect the bounded keyword pool, while answer evidence remains limited to merged Keyword/Vector Top-K and Final Top-3.
- Conversation state classifies clarification replies, follow-ups, new questions, greetings, and thanks; old product context is not applied to an unrelated new question.
- OpenAI returns `answer + usedChunkIds`; citations are created only from valid selected IDs.
- No evidence bypasses OpenAI and returns a deterministic knowledge miss.
- AnythingLLM remains read-only MIT architectural reference material; all implementation in this repository is original.

Trade-off: the current semantic vectors are process-local sparse vectors over at most 400 tenant chunks, not neural embeddings or pgvector. This controls cost and migration risk for alpha but requires a persisted vector index for production-scale corpora.

Affected areas: API retrieval/context/prompt/provider/chat/widget security/handoff, Prisma conversation/message schema, Answer Debug, Widget idempotency, shared contracts, architecture/status/QA/skills docs.

## 2026-06-24 - Product-aware RAG first step without vector dependency

Decision: Implement product-aware retrieval and ambiguity handling using existing JSON metadata fields before adding embeddings/vector search.

Reason: The immediate quality problem is ambiguous product-action queries such as "how to pair?" across multiple tenant products. Structured metadata, conversation product context, and clarification questions solve that failure mode without a migration, new dependency, external embedding cost, or license risk.

Accepted boundary:

- AnythingLLM is reviewed only as an architectural reference under MIT; no source or branding is copied.
- `KnowledgeDocument.metadata`, `KnowledgeChunk.metadata`, and `Conversation.metadata.rag` hold structured retrieval context for this phase.
- Chat and Answer Debug use `resolveRetrievalDecision()` for clarification/scoped retrieval; `retrieveRelevantChunks()` remains compatible.
- LLM providers receive only backend-selected tenant-scoped chunks and safe product-scope metadata.
- Embeddings, vector DB, reranking, and async indexing remain future phases and are not current accepted capability.

Trade-off: Retrieval is still lexical plus metadata scoring, not semantic vector search. This keeps the change safe and reviewable but does not solve all semantic recall problems.

Affected areas: API knowledge metadata/retrieval/chat/Answer Debug/OpenAI prompt, shared types/AI chunk contract, Admin Answer Debug UI, product-aware RAG tests, third-party notices, AI/backend/data-model/QA/status docs.

## 2026-06-17 - Clerk alpha auth code-level closeout

Decision: Tighten the existing Clerk alpha auth boundary without changing provider, architecture, or RBAC model.

Reason: The alpha auth implementation already used Clerk, admin-web cookie bridging, backend `AdminApiGuard`, and existing `User` + `Role` mapping. The remaining risk was incomplete code-level proof around forged JWTs/cookies, missing/invalid verification config, issuer/authorized-party rejection, and platform-admin gating.

Accepted boundary:

- Admin-web accepts Clerk session cookies only after RS256 signature and claim verification.
- Verification requires `sub`, numeric unexpired `exp`, optional `nbf`, optional issuer, and optional authorized party.
- Admin-web pages and proxy reverify cookies server-side.
- Backend Clerk mode keeps authorization in `AdminApiGuard`, mapped `User`, tenant `Role`, and `isPlatformAdmin`.
- Legacy token access remains local/dev or server-only fallback.
- Customer widget/chat routes remain public customer-scoped and Clerk-free.

Trade-off: Tests now include stronger handler-style and guard-level coverage, but not full browser/e2e Clerk login. Real smoke remains a user-owned setup gate because secrets and dashboard configuration must not be pasted into chat or committed.

Affected areas: admin-web auth verifier/session route/proxy tests, API admin guard/tests, handoff docs, auth/frontend/backend/API/QA/status skill docs.

## 2026-06-12 - RAG quality hardening

Decision: Harden current deterministic RAG for alpha with safer URL cleaning, repeated-block chunk cleanup, support synonym retrieval, source diversity, Answer Debug RAG indicators, architecture audit docs, and a deferred RAG 2.0 path.

Reason: These are low-risk, testable improvements that improve answer quality without introducing embeddings, vector infrastructure, new dependencies, migrations, or real-provider CI coupling.

Affected areas: API knowledge import/chunking/retrieval/debug tests, shared Answer Debug types, admin Answer Debug UI, architecture docs, and RAG-related skills.

## 2026-06-12 - Add non-persistent protected knowledge answer debug

Decision: Add a protected, tenant-scoped Answer Debug route and admin Knowledge Base debug panel that reuse current retrieval/provider behavior without persisting customer conversations or messages.

Reason: Alpha answer-quality work needs visible retrieval evidence, backend citations, provider/fallback state, and safe metadata before real OpenAI launch testing.

Trade-off: The debug surface exposes bounded admin-only chunk previews and safe provider metadata, but intentionally omits raw prompts, hidden rules, tenant IDs, provider secrets, auth values, and full analytics. Retrieval remains deterministic keyword/phrase search.

Affected areas: API chat debug controller/service/tests, shared types, KnowledgeDocument checksum presenter, admin-web knowledge/debug UI, runtime/QA/AI/backend/frontend/API docs.

## 2026-06-05 - Add tenant AI profile foundation

Decision: Reuse existing `AgentConfig` storage for tenant AI profile settings, add protected admin profile read/update, add public widget-safe profile read, pass profile context into LLM providers, and update widget/admin surfaces to consume profile basics.

Reason: The platform needs tenant-specific assistant identity, tone, safety guidance, and widget display without introducing Level 3 lead capture, full theme building, or a new auth system.

Trade-off: Profile data is stored in existing `AgentConfig` JSON fields rather than new explicit columns. This avoids a migration and keeps the change small, but future reporting/searching over individual profile fields may require schema promotion.

Affected areas: `packages/types`, `packages/ai-core`, API tenants/chat/OpenAI prompt, admin-web AI Profile panel, customer widget profile display, provider tests, runtime/OpenAI/QA/backend/frontend/API/data-model docs.

## 2026-06-05 - Add runtime env templates and OpenAI enablement baseline

Decision: Add product-neutral env templates for local/staging/production, document local-only test tokens and seed/demo tenant slug handling, add runtime checklists, tighten OpenAI prompt safety rules, and make the OpenAI smoke helper print a clearer secret-safe summary.

Reason: The project needs a practical path from deterministic local QA to optional real OpenAI testing without leaking secrets, making company/demo defaults look like reusable product defaults, or requiring OpenAI for normal development.

Trade-off: OpenAI remains manual/opt-in and is still not a normal CI dependency. This task documents runtime safety and baseline answer behavior rather than adding production auth, signed customer identity, or a new provider architecture.

Affected areas: env examples, runtime docs, OpenAI prompt assembly, OpenAI smoke helper, deployment/AI/backend/auth/QA/current-status docs.

## 2026-06-04 - Add alpha-safe admin-web proxy and protect realtime snapshots

Decision: Add an admin-web server-side access gate and same-origin proxy for protected admin APIs, protect tenant-wide realtime snapshots with `AdminApiGuard`, add customer-scoped realtime/read routes, and replace the company-specific URL import user-agent with a product-neutral configurable value.

Reason: Admin/browser code needed a safe way to use protected APIs without exposing `ADMIN_API_TOKEN`, tenant-wide conversation snapshots should not remain public alpha, and runtime product-specific strings should not enter the future personal product core.

Trade-off: This remains alpha access protection, not production identity/RBAC. Admin-web uses a shared access token and httpOnly cookie rather than user accounts, roles, SSO, or per-user sessions.

Affected areas: `apps/admin-web`, API realtime/conversation routes, `packages/config`, knowledge URL import config, provider behavior tests, split-readiness docs, auth/frontend/backend/API/QA/deployment docs.

## 2026-06-04 - Prepare split readiness and minimal admin protection

Decision: Add split-readiness documentation for the future personal Level 3 AI customer support + lead capture product and protect admin/agent/platform operations with a minimal token guard.

Reason: The repo needs a clear boundary between reusable personal product core and company-specific Haneco/Kasta deployment work before further alpha deployment, and admin/agent/platform APIs should not remain unprotected.

Trade-off: The guard is not full auth/RBAC. It is an alpha protection boundary and should be replaced by real authenticated identity and tenant-aware authorization before production.

Affected areas: `docs/split-readiness`, `apps/api/src/common/admin-protection`, tenant/knowledge/conversation controllers, config, auth/backend/API/QA/deployment docs.

## 2026-06-03 - Stabilize OpenAI readiness and deterministic retrieval

Decision: Track `pnpm-lock.yaml`, add a manual OpenAI real-key smoke helper, and harden deterministic short-query retrieval with normalized exact-token scoring.

Reason: The OpenAI SDK dependency must be reproducible for future developers/CI, real provider success needs a safe manual verification path, and short keyword-style questions should avoid weak substring-only retrieval matches.

Trade-off: Retrieval remains deterministic keyword scoring rather than semantic search. The OpenAI smoke helper requires a real API key and is intentionally excluded from normal automated tests.

Affected areas: `.gitignore`, `pnpm-lock.yaml`, `apps/api/scripts`, `apps/api/src/modules/knowledge`, QA/deployment/AI documentation.

## 2026-06-03 - OpenAI provider added behind deterministic fallback

Decision: Add `OpenAiLlmProviderService` behind the existing LLM provider resolver, controlled by `AI_PROVIDER=openai`, while keeping deterministic as the default provider.

Reason: The platform now needs a real provider path without changing chat API contracts, tenant scoping, citation persistence, or deterministic fallback behavior.

Trade-off: The API now depends on the `openai` package and requires stricter env validation when OpenAI mode is selected. Real-key smoke testing remains pending until a valid OpenAI key is available.

Affected areas: `apps/api/src/modules/chat`, `packages/config`, `packages/ai-core`, provider behavior tests, AI/chat documentation.

## 2026-06-03 - OpenAI success citations generated from backend retrieved chunks

Decision: OpenAI success responses build citations directly from `input.retrievedChunks` via shared backend helper `buildBackendCitations`, instead of reusing deterministic reply citations.

Reason: Deterministic sentence scoring can return `citations: null` even when retrieval found chunks. OpenAI success should preserve backend evidence whenever retrieval provided chunks.

Trade-off: OpenAI success now includes citations for all retrieved chunks even if deterministic grounded sentence scoring would not choose a grounded sentence. This keeps citation IDs backend-controlled and avoids model-invented citations.

Affected areas: OpenAI provider success path, deterministic provider citation mapping, provider tests, AI/chat documentation.

## 2026-06-03 - LLM provider boundary added in `@platform/ai-core`

Decision: Define the reusable LLM provider boundary in `packages/ai-core` and have the API call providers through `LlmProviderResolverService` instead of wiring provider logic directly into `ChatService`.

Reason: Future real LLM providers need a stable tenant-aware contract while preserving current deterministic assistant behavior and avoiding premature external API integration.

Trade-off: The architecture now has an extra provider abstraction before any external provider exists. This is intentional so future OpenAI or other providers can be added behind explicit config validation while deterministic fallback remains default.

Affected areas: `packages/ai-core`, `apps/api/src/modules/chat`, `apps/api/src/modules/knowledge`, assistant message metadata, AI/chat documentation.

## 2026-06-03 - Repository-based AI handoff workflow adopted

Decision: Use repository files under `docs/ai-handoff/` as the normal handoff mechanism between Implementation, QA, Project Context & Docs, and ChatGPT Project Director.

Reason: This avoids large manually assembled paste reports and keeps accepted implementation, QA, and director handoff context versioned in the repository.

Trade-off: Documentation updates now depend on handoff files matching the latest commit. If they are missing or inconsistent, Chat 1 must inspect the repository and warn before updating docs.

Affected areas: `docs/skills`, `docs/ai-handoff`, documentation update process, Project Director handoff process.

## 2026-07-03 - Persistent incremental architecture diagram baseline

Decision: Keep the current chat architecture in `docs/architecture/current-chat-system-flow.mmd`, with an identical Mermaid preview in `current-chat-system-flow.md`, and update these files in place after meaningful architecture changes.

Reason: Reusing the existing graph reduces repeated repository analysis and token usage while making architecture changes easy to review over time.

Trade-off: The diagram must be actively reconciled with the working tree. It represents implemented runtime behavior only and must not include planned components before they exist.

Affected areas: architecture documentation, AI Chatbox skill maintenance, future implementation handoffs.

## 2026-06-01 - Project documentation skill set expanded

Decision: Add the missing documentation files required for project context maintenance: current status, AI chatbox, API contract, data model, QA, and decision log.

Reason: The repository already had partial skill docs, but the expected documentation structure was incomplete. Future Project Director and Codex Implementation tasks need stable, task-specific context without re-reading the whole repository every time.

Trade-off: This records current behavior as-is, including known limitations, rather than describing an ideal target architecture.

## Existing architecture decisions reflected in code

- Keep the platform white-label and tenant-agnostic; Kasta exists only as seed/demo tenant data.
- Use `pnpm` + `turbo` + TypeScript monorepo.
- Use NestJS for the API and Next.js App Router for admin web.
- Use Prisma/PostgreSQL for tenant-scoped relational data.
- Keep widget-facing and admin-facing concerns separate.
- Keep AI provider orchestration out of core until there is a concrete execution need.
- Use deterministic retrieval/reply as a scaffold before adding real LLM and vector search.
## 2026-06-12 Clerk Alpha Auth Boundary

Decision: Use Clerk as the fast alpha admin/agent auth boundary for admin-web and protected backend APIs.

Rationale: The project needs a real third-party identity boundary before online alpha, but does not need enterprise RBAC/SSO yet.

Implementation boundary:

- Admin-web uses Clerk sign-in/sign-up and httpOnly server cookie bridging.
- Backend verifies Clerk JWTs in `ADMIN_API_PROTECTION_MODE=clerk`.
- Tenant authorization uses existing `User` + `Role`; no new RBAC schema was introduced.
- `ADMIN_API_TOKEN` remains a documented local/service fallback and must not be the primary production/staging path.
- Real Clerk/deployment setup remains a manual gate owned by the project owner.
