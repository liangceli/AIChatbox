# Director Update

## 1. Completed Task

Completed secure admin-web access/proxy, customer-scoped realtime/conversation reads, required visitor handoff scope, product-neutral knowledge import user-agent, and split-readiness final gate.

Latest commit reviewed: `8ddc85d Add secure admin access and customer-scoped realtime`.

## 2. Accepted Changes

- Added `/admin/access` alpha admin-web access gate.
- Browser submits `ADMIN_WEB_ACCESS_TOKEN` to same-origin `/api/admin/access`.
- Successful access sets an httpOnly sameSite admin-web session cookie signed by `ADMIN_WEB_SESSION_SECRET`.
- `/admin` and `/agent` require a valid admin-web session before rendering.
- Protected admin-web browser calls now go to same-origin `/api/admin/...`.
- The admin-web server proxy forwards to `API_INTERNAL_BASE_URL` and injects `x-admin-api-token: <ADMIN_API_TOKEN>` only on the server.
- Browser code never receives or directly sends `ADMIN_API_TOKEN`.
- `/admin/access?next=...` is sanitized; only safe same-origin relative paths are accepted, while protocol-relative, absolute, backslash, and non-slash paths fall back to `/admin`.
- `GET /v1/realtime/conversations` is now admin-protected and keeps tenant-wide snapshots limited to admin/agent paths.
- Admin conversation summary/detail/messages reads are now protected.
- Added customer-scoped public reads:
  - `GET /v1/conversations/:conversationId/customer-detail?visitorId=...`
  - `GET /v1/conversations/:conversationId/customer-messages?visitorId=...`
  - `GET /v1/realtime/customer-conversation?tenantSlug=...&conversationId=...&visitorId=...`
- Public customer realtime emits only one visitor/conversation snapshot and no longer exposes tenant-wide `conversations[]` or `pendingHumanCount`.
- Public customer handoff now requires non-blank `visitorId`, rejects wrong visitor scope, and still succeeds for the correct visitor.
- Replaced `HanecoAIPilotBot/0.1 knowledge-import` with configurable product-neutral `KNOWLEDGE_IMPORT_USER_AGENT`, defaulting to `PlatformKnowledgeImporter/0.1 knowledge-import`.
- Split-readiness docs now mark the repo conditionally ready for personal product repo split if the next work is Level 3 lead capture, public personal branding/demo, or company-specific integrations.

## 3. Verification Summary

- Latest QA result: manual QA acceptance passed; no required follow-up fixes remain.
- QA specifically accepted the P1 fixes for admin access open-redirect sanitization and missing/blank public handoff `visitorId`.
- Focused checks passed:
  - `pnpm --filter @platform/admin-web test`
  - `pnpm --filter @platform/api test`
  - `pnpm --filter @platform/admin-web typecheck`
  - `pnpm --filter @platform/api typecheck`
  - `pnpm --filter @platform/admin-web build`
- Implementation handoff also records passing workspace `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- Secret search passed: no `ADMIN_API_TOKEN` exposure through browser client files.
- Company runtime search passed: no remaining Haneco/Kasta runtime core references in `apps/api/src` or selected shared package source.

## 4. Remaining Risks

- Admin-web access remains alpha protection with one shared access token, not production user identity or RBAC.
- Customer `visitorId` is still bearer-like anonymous identity; production should add signed customer/session protection.
- Admin and agent actions still need production auth context and tenant-aware authorization before production.
- Existing demo `kasta` defaults remain in local admin/chat page env fallbacks and seed/demo context; rename or exclude them during a personal repo split.
- OpenAI real-key smoke remains pending until a valid key is available.
- Embeddings/vector retrieval, queued ingestion, and production deployment/CI are still future work.

## 5. Updated Docs

- `docs/skills/current-status.md`: updated latest commit, accepted task, route/security status, split gate, and manual QA acceptance.
- `docs/skills/qa-skill.md`: added latest QA observation for `8ddc85d`.
- `docs/skills/api-contract-skill.md`: already documents protected admin routes, customer-scoped reads, customer realtime, and required handoff `visitorId`.
- `docs/skills/auth-skill.md`: already documents admin-web server-side proxy/session cookie path and secret handling.
- `docs/skills/frontend-skill.md`: already documents `/admin/access`, `/api/admin/...`, next-path sanitizer, and customer widget scoped realtime/read flow.
- `docs/skills/backend-skill.md`: already documents protected admin realtime/conversation reads, public customer scoped routes, and `KNOWLEDGE_IMPORT_USER_AGENT`.
- `docs/skills/deployment-skill.md`: already documents new admin-web and knowledge import env keys.
- `docs/split-readiness/*`: already records split gate, copy/exclude checklist, product-neutral cleanup, and docs reset expectations.
- `docs/ai-handoff/director-update.md`: refreshed for the latest accepted commit and QA result.

## 6. Recommended Next Tasks

1. If the next work is Level 3 lead capture, public personal branding/demo, or company-specific integrations, create the personal product repo before implementation.
2. Replace alpha admin-web access with production auth/RBAC before production use.
3. Add signed customer/session protection for public customer conversation read/realtime paths.
4. Rename or exclude local `kasta` demo defaults during personal repo split.
5. Run real-key OpenAI smoke when a valid key is available.
