# Company-Only Boundary

Company-specific implementation must not enter reusable product core.

## Company-Only Examples

Keep these out of platform core:

- Haneco/Kasta-specific business rules;
- company-specific prompts, escalation language, lead qualification rules, or support scripts;
- company branding, product facts, pricing, warranty/returns rules, customer data, or knowledge base content;
- SAP, Salesforce, warehouse, invoice, ATP, ERP, CRM, or internal workflow integrations;
- company-specific deployment secrets, URLs, API tokens, or operational assumptions.

## Current Repository Findings

Safe demo/seed/reference content:

- `packages/database/prisma/seed.ts` creates the `kasta` demo tenant and default support data.
- README examples mention Kasta as local demo/seed content.
- `docs/skills/*` mention Kasta as a boundary reminder, not runtime platform behavior.
- `apps/api/scripts/provider-behavior.test.ts` uses `demo` as a generic test tenant slug.

Reusable platform/core content:

- `apps/api/src/modules/chat`, `knowledge`, `conversations`, `tenants`, and common tenant resolution remain generic and tenant-scoped.
- `packages/ai-core`, `packages/config`, `packages/types`, and `packages/tenant-core` remain reusable.
- OpenAI provider selection is config-driven and not company-specific.

Company-only or split-review items:

- `apps/api/src/modules/knowledge/knowledge.service.ts` uses `HanecoAIPilotBot/0.1 knowledge-import` as the URL import user-agent. This is not tenant business logic, but should be renamed to a product-neutral user-agent during or before repo split.
- Any future SAP/Salesforce/invoice/warehouse/ATP integration must be implemented as a company-only module or downstream deployment, not in reusable core.

## Current Action

No company-specific runtime business logic was added in this task. Existing Kasta content remains seed/demo/reference material.
