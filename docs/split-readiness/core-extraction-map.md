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

## Personal Product App

- tenant onboarding and configuration surfaces;
- admin/agent web surfaces after removing demo-only assumptions;
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

## Needs Later Review

- `apps/api/src/modules/knowledge/knowledge.service.ts` URL import user-agent naming.
- Admin-web local demo components and copy before a public personal product launch.
- Existing docs/skills and handoff files should be reset or rewritten for the new repo at split time.
- Any Kasta/Haneco references in README should either move to company-only deployment docs or remain clearly labeled demo/reference content.
