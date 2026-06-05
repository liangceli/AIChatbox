# Personal Product Boundary

## Direction

The future personal/commercial product is a reusable Level 3 AI customer support and lead capture platform. It is not a Haneco, Kasta, or single-company implementation.

The product core should support:

- tenant-specific branding and widget configuration;
- tenant knowledge bases and document ingestion;
- tenant AI profile and prompt configuration;
- deterministic fallback plus configurable LLM providers;
- customer support conversation handling;
- human handoff and agent reply workflows;
- lead capture workflow as a future configurable product module;
- optional integrations as isolated tenant-scoped modules.

## Core Rules

- Keep platform core tenant-agnostic.
- Do not hardcode company names, prompts, product facts, escalation rules, lead workflows, branding, or integration behavior in reusable runtime code.
- Put tenant behavior in tenant-scoped data, configuration, seed/demo fixtures, or isolated integration modules.
- Keep AI provider contracts reusable and independent of a single tenant or company deployment.
- Treat company-specific deployments as downstream configuration or separate app/deployment layers.

## Must Split Now If

Create the new personal product repo before any of these happen:

- company-specific integration implementation begins;
- company-specific business rules enter runtime code;
- Level 3 lead capture workflow implementation begins;
- public personal product demo, naming, or branding begins;
- company/customer data separation becomes legally, commercially, or operationally sensitive;
- Haneco/Kasta deployment requirements start driving shared architecture decisions.

## Current Decision

After the 2026-06-04 alpha-safe access round, the repo is conditionally ready for the user to create a personal/commercial product repo before the next major product-direction step.

Recommended gate:

- If the next task is Level 3 lead capture, public personal branding/demo, or company-specific integration work, split first.
- If the next task is small shared-platform hardening, this repo can continue briefly as long as company-specific behavior remains seed/demo/company-only.

The future personal repo should start from reusable core, admin-web with server-side protected API access, customer widget, API, shared packages, and neutral docs. It should exclude Haneco/Kasta seed/customer/company content and reset handoff/skills docs.
