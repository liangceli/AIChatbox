# Repo Split Checklist

Use this when the user manually creates the future personal product repo.

## Current Split Gate

Status after the 2026-06-04 alpha-safe access round: conditionally ready for the user to create a personal/commercial product repo when the next work item is personal Level 3 lead capture, public personal branding, or company-specific integration work.

The repo no longer has a known company-specific runtime blocker in reusable core. The previous `HanecoAIPilotBot/0.1 knowledge-import` runtime user-agent is now product-neutral/configurable through `KNOWLEDGE_IMPORT_USER_AGENT`.

Create the personal repo before the next task if it starts:

- Level 3 lead capture workflow implementation;
- public personal product branding, landing page, demo, or sales positioning;
- Haneco/Kasta/company-specific SAP, Salesforce, invoice, warehouse, ATP, ERP, CRM, or internal workflow integration.

## Copy Candidates

- `apps/api`
- `apps/customer-widget`
- `apps/admin-web`, including the alpha server-side admin proxy/access gate, after demo copy review
- `apps/ai-worker`
- `packages/*`
- `infra/`
- `docs/architecture.md`
- `docs/tenancy.md`
- selected `docs/skills`, rewritten for the new repo

## Review Before Copying

- `packages/database/prisma/seed.ts`
- README demo examples
- `docs/skills/*`
- `docs/ai-handoff/*`
- local `.env` files and deployment notes
- app names, demo tenant slugs, screenshots/assets, and any remaining demo copy

## Exclude

- real secrets and `.env` files;
- company customer data;
- company knowledge base content;
- company deployment credentials;
- company-only integration code;
- stale handoff files from this repository.
- Haneco/Kasta seed knowledge, customer records, screenshots, and operational notes unless they remain in a separate company-only deployment repo.

## Recreate

- fresh `pnpm-lock.yaml` or verify the copied lockfile after install;
- new `.env.example` for the personal product;
- personal product README and product positioning;
- Project Director workflow instructions;
- Codex thread roles and repository-specific `AGENTS.md`;
- smoke-test fixtures that do not contain company data.
- non-public admin access secrets:
  - `ADMIN_API_TOKEN`
  - `ADMIN_WEB_ACCESS_TOKEN`
  - `ADMIN_WEB_SESSION_SECRET`
  - `API_INTERNAL_BASE_URL`
  - `KNOWLEDGE_IMPORT_USER_AGENT` if the default should be branded later.

## Smoke Tests After Split

- `pnpm install`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- deterministic chat smoke;
- knowledge ingestion smoke;
- OpenAI smoke only with a valid personal product key;
- admin/agent protected endpoint smoke;
- admin-web access gate and server-side proxy smoke;
- protected admin realtime snapshot smoke;
- customer-scoped realtime/read smoke;
- widget embed smoke.

## Docs / Skills Reset

- Rewrite `AGENTS.md` for the new repo role and product direction.
- Reset `docs/ai-handoff/*` so old implementation/QA handoffs do not become product memory.
- Rewrite `docs/skills/current-status.md`, `project-summary.md`, `deployment-skill.md`, and `decision-log.md` for the new repo.
- Keep only reusable architecture notes from existing docs; move company context into company-only deployment docs.

## Must Split Now If

- company-specific integration implementation begins;
- company-specific business rules enter runtime code;
- personal Level 3 lead capture workflow begins;
- public personal product branding/demo begins;
- customer/company data separation becomes legally or operationally sensitive.
