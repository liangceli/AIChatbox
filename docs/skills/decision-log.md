# Decision Log

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
