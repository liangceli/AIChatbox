# Decision Log

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
