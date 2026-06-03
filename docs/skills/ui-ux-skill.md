# UI/UX Skill

## Current UI Surfaces

- `apps/admin-web/app/page.tsx`: project landing/entry surface.
- `apps/admin-web/app/admin/page.tsx`: admin console.
- `apps/admin-web/app/agent/page.tsx`: agent inbox.
- `apps/admin-web/app/chat/page.tsx`: local customer chat test surface.
- `apps/customer-widget/src/widget.tsx`: embeddable customer chat widget.

## Styling Approach

- Admin web global shell styles live in `apps/admin-web/app/globals.css`.
- Several complex components still use inline styles.
- There is no formal component library or design token package yet.
- The current visual language is utilitarian internal tooling: sidebar layout, panels, lists, forms, and chat surfaces.

## Interaction Patterns

- Admin console selects a tenant and shows operational panels.
- Knowledge panel supports knowledge base/document management.
- Conversation panel supports filtering, detail view, assignment, agent reply, clear messages, and delete conversation in admin mode.
- Agent console reuses conversation operations with agent-focused defaults.
- Customer widget supports message sending, citation display, human handoff request, and SSE refresh.

## UI Rules For Future Work

- Keep admin-facing and widget-facing concerns separate.
- Do not hardcode Kasta branding into reusable UI.
- Tenant branding should come from tenant config or AgentConfig/widget settings.
- Keep operational UI dense, clear, and scannable rather than marketing-style.
- If a UI change affects routes, components, state management, styling conventions, or interaction behavior, update this file and `frontend-skill.md`.

## Current Gaps

- No formal responsive QA matrix.
- No accessibility audit.
- No reusable UI component system.
- Widget uses `/images/logo.png`, which may need a configurable asset strategy for external embedding.

