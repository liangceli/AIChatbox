# Tenant Separation

Tenant separation is intended to work through a combination of schema design, runtime context, and configuration boundaries.

## Data Separation

- Core business records carry `tenantId`
- Cross-tenant uniqueness is avoided unless truly platform-global
- Tenant-owned resources such as conversations, customers, knowledge bases, and agent configuration remain scoped to a single tenant

## Runtime Separation

- The widget boots with a `tenantSlug`
- The API resolves that tenant context before serving configuration or handling chat traffic
- The worker processes jobs with tenant context attached, so retrieval, prompting, and escalation logic can remain tenant-aware

## Configuration Separation

- Branding, greetings, prompts, retrieval settings, and escalation policy belong in tenant-scoped configuration
- Shared platform code provides primitives, not client-specific decisions
- New clients should usually require data and config, not a new architecture
