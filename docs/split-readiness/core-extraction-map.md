# Core Extraction Map

## Reusable Core

- `packages/ai-core`
- `packages/config`
- `packages/types`
- `packages/utils`
- `packages/tenant-core`
- `packages/database` schema and migrations, after reviewing seed data
- `apps/api/src/common`
- `apps/api/src/modules/chat`
- `apps/api/src/modules/knowledge`
- `apps/api/src/modules/conversations`
- `apps/api/src/modules/realtime`
- `apps/customer-widget`
- Admin API alpha guard and server-side token-proxy pattern, after renaming any demo copy and replacing alpha access with production auth later.

## Personal Product App

- tenant onboarding and configuration surfaces;
- admin/agent web surfaces using server-side protected API access;
- future Level 3 lead capture workflow;
- prompt profile and branding management;
- optional integration marketplace or isolated integration modules.

## Company-Only App Or Deployment

- Haneco/Kasta-specific tenant seed content;
- company-specific knowledge bases;
- SAP/Salesforce/invoice/warehouse/ATP integrations;
- company-specific operational scripts, secrets, deployment variables, and internal workflow logic.

## Demo / Seed Content

- `packages/database/prisma/seed.ts`
- README local demo snippets
- default `demo` tenant env values
- current `kasta` fallback tenant slug in local admin/chat pages, until replaced by personal product defaults.

## Remove / Rename Before Split

- Admin-web local demo components and copy before a public personal product launch.
- Existing docs/skills and handoff files should be reset or rewritten for the new repo at split time.
- Any Kasta/Haneco references in README should either move to company-only deployment docs or remain clearly labeled demo/reference content.

## Cleaned In 2026-06-04 Alpha-Safe Round

- URL import runtime user-agent is now product-neutral/configurable through `KNOWLEDGE_IMPORT_USER_AGENT`.
- Tenant-wide realtime conversation snapshots are protected by `AdminApiGuard`.
- Public customer realtime/read paths are visitor/conversation-scoped.

## Uncertain / Manual Review

- Public product name, package naming, and default tenant slug for the personal repo.
- Which existing demo screenshots/assets are reusable versus company-only.
- Whether `apps/admin-web` alpha access gate should be replaced immediately by production auth in the new repo.
