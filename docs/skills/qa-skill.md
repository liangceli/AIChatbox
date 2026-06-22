# QA Skill

## 2026-06-19 Admin Global Search QA

- `/v1/search` must reject missing/invalid admin auth and missing tenant scope, and every Prisma resource query must use the resolved tenant ID.
- Validate 2-100 character queries, 1-10 limits, safe truncated previews, and no raw prompts/metadata/secrets in responses.
- Admin search must cover navigation, conversations, knowledge bases, and documents with loading/error/empty states, Ctrl/Cmd+K focus, and keyboard selection.
- Clicking a conversation result should open that exact conversation; clicking a document should open its exact knowledge base/document detail.
- Wrong-tenant search results must never be returned.

## 2026-06-19 Dashboard Metric Navigation QA

- Clicking Conversations on `/admin` should navigate to `/admin/conversations?status=all` and show the All filter.
- Clicking Pending Human should navigate to `/admin/conversations?status=pending_human` and show the Alerts filter.
- Clicking Knowledge Bases should navigate to `/admin/knowledge-base`.
- All three metric cards must remain keyboard-focusable and expose a visible focus state.

## 2026-06-18 Admin Light Dark Theme QA

- The admin topbar theme button should be icon-only and toggle `document.documentElement.dataset.theme` between `light` and `dark`.
- Reloading `/admin`, `/admin/knowledge-base`, `/admin/conversations`, `/agent`, `/chat`, or `/sign-in` should preserve the saved `admin-color-scheme` value.
- In dark mode, page backgrounds and admin surfaces should become dark through CSS variables while text remains readable and primary-color accents still follow AI Profile primary color.
- Avatar and Logo upload controls should show only a large upload icon, no "Choose image" text, and the icon color should use `--on-primary-container` for contrast against the button background.

## 2026-06-18 Admin Theme Primary Color QA

- Change AI Profile Primary color to a non-default value such as `#15803d` and confirm admin shell accents update without saving/reloading.
- Reload `/admin`, `/admin/knowledge-base`, and `/admin/conversations`; each route should load the selected tenant primary color from AI Profile.
- Avatar and Logo upload actions must not render black rectangles/buttons; their action fills should use the tenant primary color while Remove remains visibly destructive.
- Drawer active item, drawer CTA, Deploy, Reload, Save AI Profile, Ingest, Answer Debug run, selected rows, focus rings, and Human Reply dark surface should follow `--primary-*` theme variables.
- White content cards/forms should remain white or near-white; only non-white component backgrounds, borders, accents, and action fills should change with the primary color.

## 2026-06-17 Admin Conversations Route QA

- `/admin` should not render the Active Chats / ConversationOps workspace inline.
- `/admin` should not render the Knowledge Bases / Ingest Data / Answer Debug workspace inline.
- `/admin/knowledge-base` should render the knowledge workspace with Knowledge Bases, Ingest Data, document chunks, and Answer Debug.
- `/admin/conversations` should render the conversation operations page with Active Chats, metadata, human mode, and Human Reply.
- The left drawer `Knowledge Base` item should navigate to `/admin/knowledge-base`.
- The left drawer `Conversations` item should navigate to `/admin/conversations`.
- The drawer `Dashboard` item should navigate back to `/admin` when opened from `/admin/knowledge-base` or `/admin/conversations`.
- `/admin`, `/admin/knowledge-base`, and `/admin/conversations` remain protected by the same Clerk/legacy admin-web route gate.
- Local smoke for this change should check `http://localhost:3000/admin`, `http://localhost:3000/admin/knowledge-base`, `http://localhost:3000/admin/conversations`, and `http://localhost:4000/v1/health`.

## 2026-06-17 Clerk Alpha Auth QA Gate

- Code-level Clerk alpha auth closeout is complete when:
  - `/api/auth/clerk/session` rejects forged JWTs with 401 and no cookie.
  - missing verification config returns 500 and no cookie.
  - invalid verification key fails closed and no cookie is set.
  - `/admin` and `/agent` reject forged Clerk cookies by redirecting to sign-in.
  - `/api/admin/...` rejects forged Clerk cookies before upstream fetch.
  - proxy forwards `Authorization: Bearer <Clerk JWT>` only after server-side verification.
  - legacy fallback uses server-only `x-admin-api-token` and does not forward Clerk bearer for forged cookies.
  - backend `AdminApiGuard` rejects forged signatures, missing expiration, invalid JWT key, issuer mismatch, authorized-party mismatch, unmapped users, and wrong-tenant users.
  - backend accepts valid mapped tenant users and requires `isPlatformAdmin=true` for platform tenant list/create.
  - customer widget/chat routes remain public customer-scoped and Clerk-free.
- Current verification passed:
  - `node --check apps/admin-web/scripts/admin-access.test.cjs`
  - `pnpm --filter @platform/admin-web test`
  - `pnpm --filter @platform/api test`
  - `pnpm --filter @platform/admin-web typecheck`
  - `pnpm --filter @platform/api typecheck`
  - `pnpm --filter @platform/config typecheck`
  - `pnpm --filter @platform/admin-web build`
  - `pnpm --filter @platform/api build`
  - `pnpm --filter @platform/config build`
  - `git diff --check` with Windows LF/CRLF warnings only
- Real local Clerk smoke remains pending until the user configures Clerk Dashboard, allowed redirects/origins, and local env. Do not ask the user to paste secrets into chat.
- Fake/local tokens, source-transpiled handler tests, mocked Clerk JWTs, and localhost-only tests are code-level evidence only; they are not online alpha evidence.

## 2026-06-12 RAG Quality Regression Gate

- URL import cleaning must remove common page chrome/noise and duplicate lines while preserving useful title/heading/content.
- Chunking must not create extra chunks for repeated identical blocks.
- Chunking tests must prove reliable source locators slice back to persisted document content and that locators are omitted when repeated-block cleanup would make offsets unreliable.
- Retrieval must preserve raw plural candidate lookup, avoid substring-only weak matches, support common support synonyms such as refund/return, and apply source diversity when multiple documents match.
- Answer Debug must show safe retrieval confidence/source diversity/warnings and must not persist customer/conversation/message records.
- Manual alpha QA should use direct, short keyword, synonym, phrase, miss, sensitive, noisy URL, and archived-document questions.

## 2026-06-12 URL Import SSRF Regression Gate

- URL import must reject `localhost`, loopback, RFC1918 private ranges, carrier-grade NAT, link-local/cloud metadata targets, reserved/documentation addresses, non-public IPv6, embedded credentials, and hostnames resolving to any restricted address.
- Every redirect target must be revalidated before a request is sent; a safe public URL redirecting to a restricted target must stop after the public request.
- Safe public HTTP(S) redirects and HTML/text imports must continue to work.
- DNS resolution used for safety validation must be pinned into the outbound request to avoid a second unvalidated DNS lookup.
- Pinned DNS lookup regressions must cover Node's all-address lookup mode so safe public imports remain usable.
- URL import must keep redirect, absolute-deadline, response-size, and safe error-message limits.
- Slow-trickle regression coverage must prove continuous small response chunks cannot extend URL import beyond its absolute request deadline.

## 2026-06-12 Answer Debug Regression Gate

- Protected Answer Debug controller must use `AdminApiGuard`; missing/invalid/valid token behavior follows the existing protected route map.
- Answer Debug retrieval and AgentConfig reads must use the resolved tenant ID, while the response must not return that tenant ID.
- Knowledge-hit debug must return retrieved chunk previews, scores, backend citations, answer text, provider requested/used mode, fallback state, and safe provider metadata.
- Knowledge-miss debug must explain that no relevant READY chunk met the threshold and must not create a conversation or message.
- Tests must assert debug output drops injected API key/admin token/auth header/raw prompt/provider secret fields and citation `sourceLocator`.
- Admin-web manual QA must cover deterministic hit/miss, document/chunk inspection, URL import, and reprocess/archive/delete feedback.
- Real OpenAI acceptance is manual-only: user-managed secret config, `pnpm --filter @platform/api smoke:openai`, then a knowledge-backed Answer Debug question. Fake/test tokens are not alpha evidence.

## Verification Commands

Use from repository root.

- Install dependencies: `pnpm install`
- Generate Prisma client: `pnpm db:generate`
- Start local infra: `docker compose -f infra/docker-compose.yml up -d`
- Apply migrations: `pnpm --filter @platform/database exec dotenv -e ../../.env -- prisma migrate deploy`
- Seed database: `pnpm db:seed`
- Start local dev servers manually when browser QA is needed: `pnpm dev` from the repository root. Admin-web runs on `http://localhost:3000`; API runs on `http://localhost:4000/v1`.
- Typecheck workspace: `pnpm typecheck`
- Lint workspace: `pnpm lint`
- Build workspace: `pnpm build`
- Workspace tests: `pnpm test`
- API provider/retrieval tests: `pnpm --filter @platform/api test`
- Manual OpenAI real-key smoke helper: `pnpm --filter @platform/api smoke:openai`
- Local admin-web access smoke: `powershell -ExecutionPolicy Bypass -File scripts/smoke-admin-web-access.ps1`; expected output `admin-access-status=200` and no token value. The smoke uses deterministic requested-port behavior; pass `-Port <free-port>` when intentionally testing a non-3000 admin-web port.

Current scripts are still lightweight. API now has provider behavior tests, while some other packages still use placeholders.

Do not use long-running dev/watch commands as blocking verification commands. Examples that must stay out of blocking verification: `pnpm dev`, `npm run dev`, `next dev`, `vite`, `nodemon`, `tsx watch`.

## Manual Smoke Test

1. Start database/Redis infra.
2. Run migrations and seed.
3. Start `pnpm dev` only as a manual local server for browser testing.
4. Open admin web at `http://localhost:3000`.
5. Confirm tenant list loads.
6. Open `/admin` and select tenant.
7. Create or inspect a knowledge base.
8. Add a manual document and verify chunks are created.
9. Open `/chat`, send a question matching the document.
10. Confirm assistant response includes source citations when retrieval matches.
11. Click Human in the widget.
12. Confirm conversation enters `pending_human`.
13. Open `/agent`, assign a support user, send an agent reply.
14. Confirm widget refreshes through SSE and shows the agent message.

## Regression Checklist

- Protected tenant/knowledge/admin-agent endpoints reject missing admin token with 401.
- Protected tenant/knowledge/admin-agent endpoints reject invalid admin token with 403.
- Protected tenant/knowledge/admin-agent endpoints accept `x-admin-api-token` or bearer token when valid.
- Customer chat and customer handoff remain public but tenant-scoped.
- Admin conversation detail/read endpoints reject missing/invalid admin token and accept valid admin token.
- Customer conversation detail/read endpoints require visitorId and only return that visitor/conversation scope.
- Admin realtime SSE rejects missing/invalid admin token and accepts valid admin token.
- Customer realtime SSE remains reachable without admin token but only returns one visitor/conversation snapshot.
- Admin-web local alpha testing must not expose `ADMIN_API_TOKEN` in browser code. Use `/admin/access` and same-origin `/api/admin/...` proxy with httpOnly cookie.
- Admin-web local access must load the repository-root `.env`; `/admin/access` should not return 500 when `API_INTERNAL_BASE_URL`, `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, and `ADMIN_WEB_SESSION_SECRET` are present. With local placeholder config, `ADMIN_WEB_ACCESS_TOKEN=test-web-token` must accept `test-web-token`.
- Tenant-scoped endpoints reject missing `x-tenant-slug`.
- Tenant-scoped reads/writes never expose another tenant's records.
- `POST /chat/messages` refuses empty messages and max-length violations.
- Existing `PENDING_HUMAN` conversation cannot receive another AI reply.
- Existing `PENDING_HUMAN` conversation should still accept customer messages, save them for the agent, return `assistantMessage: null`, and avoid provider calls.
- Agent replies must keep the conversation in `PENDING_HUMAN`; the next customer message must not be answered by AI until human support is explicitly ended.
- Regression coverage must simulate an initial stale non-human status followed by the latest `PENDING_HUMAN` status after an agent reply; the customer message must be saved, provider resolution must not run, and `assistantMessage` must be null.
- Regression coverage must also simulate human mode starting while the provider call is in progress; after provider completion, no assistant message may be persisted and `PENDING_HUMAN` must remain active.
- Provider-time handoff regression coverage must use a handoff event newer than the customer message and assert the suppression branch does not update the conversation or move `lastMessageAt` backwards.
- Customer widget should show an End human action during `pending_human`; after ending, the next customer message can receive AI again.
- Admin/agent Human Mode controls should start and end `PENDING_HUMAN` through protected proxy calls.
- Chat provider resolution returns deterministic provider by default and does not require external API keys.
- `AI_PROVIDER=openai` requires `OPENAI_API_KEY` and `OPENAI_MODEL`; config validation should fail clearly when missing.
- OpenAI enablement follows `docs/runtime/openai-enable-checklist.md`; smoke output must not print API keys, auth headers, or raw env dumps.
- Env templates must keep `demo` as reusable default slug; `kasta` is allowed only for local seed/demo or company-only context.
- Local placeholder tokens (`test-admin-token`, `test-web-token`, `test-session-secret-for-local-qa`) must not appear in staging/production templates except as documented "do not use" warnings.
- Secret grep should inspect hits for `sk-`, `OPENAI_API_KEY=`, `NEXT_PUBLIC_.*TOKEN`, `NEXT_PUBLIC_OPENAI`, admin tokens, and admin-web session secrets while excluding dependency/build/temp folders and real env files such as `.env`, `.env.local`, and `.env.*.local`.
- Secret grep guidance must output only path, line number, and rule/category. Do not print full matching lines or raw env values. Use boolean shape checks or masked output for real env files.
- Assistant messages preserve retrieval metadata and add internal provider metadata.
- Knowledge-hit messages still produce deterministic grounded responses and citations.
- Knowledge-miss messages still produce deterministic fallback.
- OpenAI success preserves backend-generated citations from retrieved chunks even when deterministic grounded sentence scoring would return `citations: null`.
- Short keyword retrieval matches obvious title/content evidence and avoids substring-only weak matches.
- `policies` and `warranties` raw plural candidate lookup should return relevant policy/warranty chunks.
- `case` should not match `showcase` by substring alone; current Kasta manual smoke can still return real `Case Studies` citations when independent case evidence exists.
- OpenAI smoke helper is not part of normal tests and requires explicit OpenAI env.
- OpenAI provider failure falls back to deterministic content/citations behavior and records fallback metadata.
- Tenant AI profile defaults exist for new/empty profiles.
- Protected tenant AI profile read/update routes require admin protection.
- Tenant AI profile update rejects invalid display inputs such as non-hex primary colors, unsafe/non-image logo/avatar sources, and oversized uploaded images.
- Public widget-safe tenant profile does not expose safe answer instructions, sensitive topic instructions, do-not-answer instructions, provider settings, tenant IDs, or secrets.
- OpenAI prompt assembly includes tenant assistant identity, company display name, business type, tone, and profile guidance while keeping platform safety rules higher priority.
- Widget displays tenant profile basics without changing visitorId persistence, chat send, handoff, customer-scoped realtime, or agent reply display.
- Admin/agent selected conversations of every status should show complete history inside the Human Reply box, including citations when present.
- Admin drawer navigation should keep Dashboard/Settings behavior clear while Knowledge Base navigates to `/admin/knowledge-base` and Conversations navigates to `/admin/conversations`; unimplemented items should show coming-soon feedback.
- Admin topbar should remain fixed at the viewport top while the page scrolls on desktop and mobile; opening the navigation drawer or focusing/scanning lower sections must not move it, and content must not render beneath it.
- Main admin modules and interactive rows/buttons should provide visible hover/active feedback without layout overlap; reduced-motion preference should disable meaningful animation.
- Selecting any conversation status should render the complete chronological customer/AI/agent/system history inside the Human Reply card.
- AI Profile Primary Color should expose a visible current-color preview, clickable preset swatches, native custom picker, and editable hex value; all color controls should stay synchronized.
- AI Profile Avatar/Logo upload should remain the primary action and should preview/save/remove PNG/JPEG/WebP/GIF files up to 1 MB; the always-visible URL fallback should remain usable.
- AI Profile Avatar/Logo removal must send explicit `null`; save and reload must not restore the previously persisted media.
- Media-clear regression coverage must include a tenant branding Logo and assert explicit `logoUrl: null` remains null after persistence and reload instead of falling back to branding.
- `/chat` should render the server-fetched public tenant profile before the client profile refresh completes.
- Customer widget reload should restore the active tenant-scoped conversation for the same visitor; 403/404 restore responses should clear the stored conversation ID.
- Customer widget and admin/agent Human Reply history should scroll to the latest message after restore, new messages, selection changes, and realtime updates.
- Tenant profile image validation should reject non-image data URLs, unsafe schemes, unsupported types, and oversized image sources.
- Handoff rejects mismatched visitorId.
- Public handoff rejects missing/blank visitorId.
- Public handoff succeeds with the correct visitorId.
- Assign/reply rejects users without current tenant Role.
- Knowledge document archive removes chunks and excludes the document from retrieval.
- Reprocess replaces old chunks and updates `chunkCount`, `checksum`, `ingestedAt`.
- URL import rejects restricted network targets, unsafe redirects, unsupported content types, oversized responses, and too-short content.
- SSE endpoint sends `conversation_snapshot` and supports query `tenantSlug`.

## Known Test Gaps

- No real OpenAI success smoke test has run yet because no OpenAI API key is currently available.
- No service tests for tenant isolation.
- No API e2e tests for chat, knowledge, handoff, realtime.
- No frontend component tests.
- No browser automation for admin/agent/widget flows.

## Known QA Observations

- QA for `49962f7 Fix reliable citation locator omission` accepted the P1 backend citation omission fix: citations without reliable locators omit the `sourceLocator` key entirely, while reliable locators are still preserved.
- QA for `8db4939 feat: add secure knowledge answer debug and URL import` accepted the absolute 15-second per-request deadline and existing SSRF protections with no required fixes.
- Manual acceptance passed for public URL import, restricted URL rejection, desktop/mobile Knowledge Base and Answer Debug layout, real OpenAI smoke, and real OpenAI Answer Debug. Real OpenAI used `openai` mode with no fallback and no observed API key/admin token/raw prompt/tenant ID exposure.
- Remaining P2 gaps: Admin-Web interaction coverage is mainly source smoke, and Answer Debug non-persistence tests do not yet monitor every possible Prisma write API.
- Latest QA accepts the P1 fixes in `e499c45 fix: preserve human handoff state and profile media clearing`; `906440b small fix` was committed afterward and is not covered by that QA report.
- Non-blocking P2 risk: the pre-provider pending-human branch can still move `lastMessageAt` backwards in a narrow concurrency window.
- QA for `bcaa940 Add runtime env templates and OpenAI safety docs` accepted the P1 secret-scan fix: repository scans exclude real env files and output only `Path`, `LineNumber`, and `Rule`; real env checks use booleans and do not print values.
- QA for `8ddc85d Add secure admin access and customer-scoped realtime` accepted the P1 fixes for admin access open-redirect sanitization and required public handoff `visitorId`; no required follow-up fixes remain.
- Manual QA for `fb3ca66 Add LLM provider boundary with deterministic fallback` passed.
- QA for `355e5f6 Add OpenAI provider with deterministic fallback` passed shell-verifiable checks and accepted the citation preservation fix.
- Retrieval candidate lookup now uses raw + normalized terms, while final scoring uses exact normalized tokens.
- `policies` / `warranties` and `case` / `showcase` regression checks passed in API tests and QA smoke.
- Short keyword-style retrieval now uses normalized exact-token scoring and targeted regression tests, but it is still deterministic keyword retrieval rather than semantic search.
- `pnpm-lock.yaml` should be tracked for dependency reproducibility in this pnpm monorepo.

## OpenAI Provider QA Notes

- Mocked OpenAI provider tests live in `apps/api/scripts/provider-behavior.test.ts`.
- Regression scenario: retrieved chunks exist, deterministic grounding would produce `citations: null`, mocked OpenAI success still returns retrieved chunk citations.
- Manual real-key smoke helper lives in `apps/api/scripts/openai-smoke.ts` and runs with `pnpm --filter @platform/api smoke:openai`.
- Smoke helper requires `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`; missing env fails clearly without printing API keys.
- Smoke helper success summary reports provider mode, real OpenAI attempt, assistant text, citations, provider metadata presence, and fallback state.
- Manual real-key OpenAI smoke passed during the `8db4939` alpha knowledge QA cycle. Future OpenAI-affecting changes should rerun the smoke with user-managed secrets.

## Tenant Profile Real OpenAI Manual Gate

- User must configure only in local `.env` or a secret-managed environment:
  - `AI_PROVIDER=openai`
  - `OPENAI_API_KEY=<real key set by user>`
  - `OPENAI_MODEL=<chosen real model>`
- User must not paste the key, auth header, raw env, admin token, or session secret into chat.
- After setting env, run `pnpm --filter @platform/api smoke:openai`.
- Expected success: provider mode is OpenAI, real OpenAI attempt occurred, assistant text exists, citations exist when retrieved chunks exist, provider metadata exists, fallback state is visible, and no secret values print.
- Then configure a distinctive tenant AI Profile, ask a knowledge-based question, and confirm the real model reflects the tenant profile while staying grounded and preserving citations.
- Fake/test/local-only tokens are not online/alpha acceptance evidence.

## 2026-06-12 Clerk Alpha Auth QA Notes

- API tests must cover missing/invalid Clerk JWT rejection, mapped tenant user acceptance, and wrong-tenant rejection without calling real Clerk network services.
- Admin-web source smoke should confirm Clerk session cookies are httpOnly, proxy forwards Bearer auth server-side, and client code does not reference secret env keys or localStorage token storage.
- Admin-web Clerk session tests/smoke must confirm token-shaped forged JWTs are not accepted by `/api/auth/clerk/session`, `/admin`, `/agent`, or `/api/admin/...`; the session bridge must verify JWT signature and claims before setting cookies.
- Latest accepted P1 QA confirms `/api/auth/clerk/session` verifies the Clerk JWT before setting the httpOnly cookie; missing verification config returns 500, invalid/forged token returns 401, and invalid tokens must not set cookies.
- `/admin`, `/agent`, and the admin-web `/api/admin/...` proxy must reverify the Clerk session cookie server-side. Middleware may redirect based on cookie presence only as a fast path, but it is not the final auth proof.
- Legacy `/admin/access` plus `ADMIN_API_TOKEN` remains a server-only local/dev fallback and should continue to work when intentionally configured.
- Non-blocking P2 follow-up: add route-handler/runtime tests for forged JWT rejection and no `Set-Cookie`, beyond source-smoke coverage.
- Non-blocking P2 follow-up: strengthen backend Clerk guard tests for issuer and authorized-party claim failures.
- Manual alpha QA must distinguish local pass, staging/online pass, external embed pass, and real alpha-ready pass.
- Fake/local test tokens, mocked Clerk, mocked OpenAI, or localhost-only flows do not count as online alpha evidence.
- Real Clerk/OpenAI/deployment smoke requires user-owned dashboard/secret-manager setup and must not involve pasting secrets into chat.
## Required Isolation Regression Set

- Cover unmapped, suspended, wrong-tenant, forged JWT, issuer, authorized-party, Owner/Agent policy, Agent row scope, invitation replay/role escalation, and Widget token tampering.
- Theme QA must compare Owner-configured primaryColor with Agent computed CSS tokens for the same authorized tenant, including readable foreground contrast in light and dark modes.
- Auth regression must include an expired/forged Clerk cookie combined with a still-valid legacy cookie and assert that page/proxy access is denied in Clerk mode.

## Invitation and Public Entry Regression Set

- Assert public sign-up has no role selector and unmapped accounts remain pending.
- Assert matching email alone does not auto-map a Clerk identity and mismatched-email invitation acceptance is forbidden.
- Assert Agent invitations expire in 12 hours, reject creation at quota, and cannot exceed five active codes per tenant.
- Assert only Platform Admin can change quota and Tenant Owners cannot invite Owners or access another tenant.
- Assert Admin/Owner/Agent sign-out clears Clerk plus local sessions and returns to `/`.
- Responsive browser smoke must cover `/` at desktop and mobile widths, protected-route redirect, Clerk button readiness, console errors, and horizontal overflow.

## Avatar and Table Import Regression Set

- File-control QA must confirm click selection and drag/drop both populate visible filename/size state, removal clears it, successful ingestion clears it, and Start Ingestion uses that controlled file.
- CSP QA must assert explicit same-origin/blob worker permission and no Clerk worker violation after a hard refresh.
- Auth redirect QA must distinguish session-route/account success from protected-page success and fail if valid Clerk login loops back to `/sign-in`.

- Avatar: allow PNG/JPEG/WebP, reject signature mismatch/oversize, assert authenticated-user-only writes, and verify Admin/Agent rendering plus reload persistence.
- Table: cover multi-sheet XLSX Q&A, descriptive headers, generic schemas, quoted CSV, sheet/row locators, corrupt XLSX, binary CSV, limits, and text-ingestion regression.
- Authorization: Owner can upload only to the resolved tenant; Agent, unmapped, wrong-tenant, and unauthenticated callers are denied.
- Manual QA must run Answer Debug against the actual uploaded workbook and verify citation evidence.
