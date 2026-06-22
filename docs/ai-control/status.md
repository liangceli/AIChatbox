# Status

Date: 2026-06-22

Latest completed capability: user-owned cropped avatars and structured CSV/XLSX knowledge ingestion.
- Follow-up: the Knowledge upload control now visibly attaches the selected file, supports drag/drop/removal, and no longer relies on an invisible full-card input.
- Follow-up: Clerk blob workers are explicitly allowed by CSP; Next cache was rebuilt cleanly and only ports 3000/4000 remain active.
- Follow-up: valid Clerk login no longer loops from `/admin` back to `/sign-in`; middleware accepts either session-cookie presence while page/proxy still enforce full configured-mode verification.
- `/account` and `/admin/account` let the verified mapped user crop and replace only their own avatar.
- Admin and Agent surfaces render the account avatar; tenant assistant avatar remains a separate tenant setting.
- Knowledge Base accepts CSV/XLSX through a protected multipart endpoint and extracts Q&A or generic labelled records with sheet/row evidence.
- OWNER role and resolved tenant scope remain mandatory for knowledge ingestion.
- Upload limits, signature checks, avatar rate limiting, audit logging, and authenticated-user-only mutation are enforced.
- Full workspace typecheck/lint/test/build, `git diff --check`, health checks, and targeted secret scan passed.
- Manual authenticated browser acceptance remains. The supplied `thread_qa.xlsx` path is currently missing.

Latest completed capability: tenant-scoped admin global search.
- Search covers admin navigation, conversations, knowledge bases, and knowledge documents for the active tenant.
- Protected GET /v1/search uses AdminApiGuard and resolved tenant scope; all Prisma search queries include tenantId.
- Search results return safe truncated summaries and deep-link to exact conversation or knowledge resources.
- Admin UI supports debounce, grouped results, Ctrl/Cmd+K, Arrow Up/Down, Enter, Escape, loading/error/empty states, and click-outside dismissal.
- Full workspace typecheck, lint, test, and build passed; some non-core package tests remain existing placeholders.
- Runtime search route is registered: unauthenticated requests return 401 rather than 404/500.
- Authenticated visual search acceptance remains to be checked in the user browser.

Latest director-facing update:
- Real Clerk local sign-in was configured and exercised by the user.
- Local admin-web reached the protected admin workspace through Clerk after session verification.
- Unmapped/unauthorized Clerk access produced 401/403 behavior instead of exposing tenant data.
- Company user liangceli@kasta.com.au was mapped to Clerk user user_3FFi1oexYzioOpimfG1ExJcIDOc; after mapping, admin tenant API calls stopped returning 403.
- Active Chats / conversation operations are now on /admin/conversations.
- Knowledge Bases, Ingest Data, document chunks, and Answer Debug are now on /admin/knowledge-base.
- Local admin-web remains standardized on http://localhost:3000.
- Current acceptance state is still not READY because the full Knowledge -> Widget -> human handoff -> agent reply loop still needs final browser QA.

Completed in this pass:
- Audited current Clerk, tenant, knowledge, widget, conversation, and handoff code.
- Confirmed Clerk implementation exists in the working tree.
- Confirmed bootstrap command exists: `pnpm --filter @platform/api bootstrap:clerk-admin`.
- Added an API admin auth context populated only after Clerk JWT verification and tenant-role mapping.
- Updated human support start/end and agent replies to prefer the verified admin user instead of a client-supplied `userId`.
- Moved OpenAI generation outside Prisma interactive transactions to avoid local 500s when model latency exceeds transaction timeout.
- Expanded API tests for mapped context, wrong tenant denial, and legacy token fallback.
- Expanded API tests to assert provider calls run outside database transactions.
- Expanded Admin Web auth test coverage for nested `/admin` route middleware protection.
- Verified Widget API can return OpenAI-backed KASTA answers with citations.
- Verified no-citation behavior when retrieval returns zero chunks.

Required before final acceptance:
- Re-run mapped Clerk browser QA from the protected admin workspace.
- Verify wrong-tenant denial after mapped login.
- Verify Knowledge Base management and Answer Debug on /admin/knowledge-base.
- Verify customer Widget grounded answer with citation and no-citation miss behavior.
- Verify customer handoff, admin/agent reply, and original widget session recovery.
- Verify sign-out protection.
- Run full workspace typecheck, lint, test, build, `git diff --check`, and secret scan.
- Start local services safely and complete browser QA against the real Clerk project.
- Verify unmapped user denial, mapped tenant admin access, wrong-tenant denial, knowledge management, Answer Debug, widget grounded answer with citation, no-citation miss behavior, human handoff, agent reply, widget refresh recovery, and sign-out protection.

## 2026-06-19 Identity, Isolation, and Agent Theme Update

- Tenant membership is now constrained to OWNER/AGENT with ACTIVE/SUSPENDED/REVOKED status; Clerk user ids are unique first-class fields.
- Platform Admin, Tenant Owner, Agent, pending Clerk users, and anonymous Widget visitors now have distinct server-enforced access paths.
- Tenant Owner and Platform Admin invitations are one-time, hashed, expiring, and audited; public self-selected roles are not trusted.
- Agent conversation reads are row-scoped to unassigned pending-human conversations or conversations assigned to that Agent.
- Widget customer access now uses an HMAC-signed tenant/visitor session instead of trusting visitorId alone.
- Agent theme colors now come from the Agent's authorized tenant public profile and reuse the Owner admin contrast/token algorithm.
- Current Kasta public profile returns primaryColor `#dc2626`; Agent no longer falls back to the global yellow theme.
- Workspace typecheck, lint, test, and build passed before the theme follow-up. Admin Web typecheck, tests, and production build also pass after the theme follow-up.
- Real browser acceptance remains pending because this Codex session has no available browser instance; local services are running for user-side verification.
- Agent handoff UI now requires an unassigned pending conversation to be atomically claimed before reply or end-human-support controls become available.
- Clerk mode no longer accepts a legacy admin cookie as a page/proxy fallback. Admin and Agent clients refresh Clerk tokens before account bootstrap and every 45 seconds, and expired sessions redirect to sign-in instead of leaving a loading workspace.

## 2026-06-19 Public Entry and Invitation Governance

- `/` is now the public Solaris AI homepage with Sign in and Create account entry points; public sign-up does not expose a role selector.
- New Clerk identities without an accepted invitation remain on `/access-pending`; tenant and role come only from an email-bound, one-time invitation.
- Clerk authentication no longer auto-binds an existing user by matching email alone. Explicit bootstrap remains available only for controlled Platform Admin setup.
- Agent invitations expire after 12 hours. Each tenant has an enforced active-code quota from 0 to 5, default 5; quota checks run inside a serializable transaction.
- Platform Admin can see Owner, active Agent, suspended member, active invitation, and quota counts for every tenant and can adjust quota within 0-5. Tenant Owners can manage Agent invitations only in their own tenant.
- Admin, Owner, and Agent sign-out clears Clerk and local httpOnly sessions and returns to `/`.
- Migration `20260619010000_add_agent_invitation_quota` is applied locally.
- Workspace typecheck, lint, test, build, `git diff --check`, and targeted secret scan passed. Browser QA passed for homepage desktop/mobile layout, Clerk sign-in readiness, and unauthenticated `/admin` redirect.
- Real multi-account invitation acceptance, Owner/Agent routing, quota UI mutation, and sign-out remain concentrated manual acceptance items.
