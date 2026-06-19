# Status

Date: 2026-06-19

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
