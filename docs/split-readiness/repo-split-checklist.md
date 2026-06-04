# Repo Split Checklist

Use this when the user manually creates the future personal product repo.

## Copy Candidates

- `apps/api`
- `apps/customer-widget`
- `apps/admin-web`, after demo copy review
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
- user-agent strings, app names, demo tenant slugs, and screenshots/assets

## Exclude

- real secrets and `.env` files;
- company customer data;
- company knowledge base content;
- company deployment credentials;
- company-only integration code;
- stale handoff files from this repository.

## Recreate

- fresh `pnpm-lock.yaml` or verify the copied lockfile after install;
- new `.env.example` for the personal product;
- personal product README and product positioning;
- Project Director workflow instructions;
- Codex thread roles and repository-specific `AGENTS.md`;
- smoke-test fixtures that do not contain company data.

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
- widget embed smoke.

## Must Split Now If

- company-specific integration implementation begins;
- company-specific business rules enter runtime code;
- personal Level 3 lead capture workflow begins;
- public personal product branding/demo begins;
- customer/company data separation becomes legally or operationally sensitive.
