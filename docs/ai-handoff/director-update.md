# Director Update

## 2026-07-13 Reproducible Knowledge Lifecycle Closeout

- Took over the current handoff and reconciled the documentation against the working tree, live processes, migrations, and database indexes.
- Found that the lifecycle migration dropped a constraint even though the initial schema created a unique index. The live database therefore still blocked version 2 chunks despite green mock tests.
- Added and applied a forward-only migration that removes the legacy version-blind index.
- Added real PostgreSQL verification with automatic rollback; version 1 INACTIVE and version 2 READY chunks can now coexist at identical chunk indexes without changing existing business data.
- Fixed explicit ConversationState clearing so stale product context cannot survive after legacy metadata is cleared.
- Removed full Redis URL logging from AI Worker startup and replaced the placeholder Worker/Database tests with focused regressions.
- Workspace typecheck/lint/test/build/diff checks pass across all 11 packages. The authenticated browser business loop is the remaining acceptance gate.
- Director conclusion remains RETURN FOR FIXES until browser acceptance is complete, but the previously identified database P1 is closed.

## 2026-07-08 Knowledge Lifecycle Hardening

- Audited the current knowledge upload/update/delete/retrieval lifecycle against the requirement that answers must come only from current active knowledge chunks.
- Added document/chunk lifecycle hardening: document `DELETED`, document version/error timestamps, chunk status/version/content hash, and embedding status fields.
- Repeated FILE/URL imports now update the active source document by source URI, instead of leaving duplicate active documents for retrieval.
- Reprocess uses a safer replacement model: new chunks are created as a new chunk version and old chunks become INACTIVE only after the new version succeeds. If processing fails, the old READY document remains searchable.
- Archive/delete no longer physically remove chunks first. They mark documents and chunks ARCHIVED/DELETED, and retrieval/search filters exclude them.
- Retrieval active filter is now explicit in both keyword and local semantic paths: tenantId + READY document + READY chunk.
- Local migration `20260703030000_harden_knowledge_lifecycle` was applied successfully after repairing a local failed migration attempt caused by an absent legacy unique constraint.
- API typecheck/tests passed. Browser QA should restart API/Admin/Web before verifying live chat context and knowledge replacement behavior.

## 2026-07-03 ConversationState and ProductCatalog Phase 1

- Added explicit `ConversationState` and `ProductCatalog` tables as the first production-RAG state layer.
- `ConversationStateService` now hydrates active product context from persisted state first, then falls back to legacy `Conversation.metadata.rag`.
- Chat turns now persist resolved product context and pending clarification into `ConversationState`; resolved product scopes are upserted into tenant-scoped `ProductCatalog`.
- Legacy `Conversation.metadata.rag` remains synchronized for compatibility while the new state table becomes the primary retrieval context source.
- Added `backfill:product-catalog` script for existing knowledge metadata, with optional `TENANT_SLUG` scoping.
- API tests and API typecheck passed. Local database migration/backfill still needs to be applied before browser acceptance.

## 2026-07-03 Product Context Follow-Up Scoping

- Fixed the observed failure where a customer selected `KMDIM400`, then `Which ecosystems support it?` could answer from `KMREM`.
- Follow-up retrieval now carries stored `rag.productContext` into the hidden retrieval query, so pronoun questions search inside the current product scope before ranking global evidence.
- When a pending product clarification is resolved and selected evidence has one product scope, the backend persists that scope for later `it/this/that` turns.
- Added API regression coverage for `how do I pair a device?` -> `KMDIM400` -> `Which ecosystems support it?`; the follow-up must retrieve KMDIM400 compatibility evidence and exclude KMREM.
- No product-specific or tenant-specific logic was added.

## 2026-07-03 Repair/Pair Intent and Pending-Loop Fix

- Fixed substring intent detection where `repair` was incorrectly classified as `pairing`.
- Added word/phrase-boundary intent matching and generic troubleshooting terms.
- Added controlled short-model transposition lookup/scoring so `KMERM` resolves to `KMREM` and exits pending clarification.
- Added intent-aware scoped evidence filtering; pairing instructions cannot be reused as repair evidence.
- API tests/typecheck and real Kasta runtime sequence pass. With no KMREM repair document, the safe final response has zero citations.

## 2026-07-03 Professional Knowledge-Gap Reply

- Confirmed `where can I buy it?` correctly retained KMREM context, but the current Kasta knowledge base contains no verified KMREM retailer or purchase-channel record.
- Replaced tenant fallback-message concatenation in the no-evidence safety path with professional platform copy; unsupported purchase questions now return zero citations and offer human support without inventing a retailer.
- API typecheck/tests and the live four-turn Kasta conversation passed.

## 2026-07-03 Context-Safe Hybrid Retrieval and Widget Hardening

### Delivered

- Replaced final-answer lexical-only retrieval with tenant-scoped Hybrid Search: scored Keyword Top-20, local sparse-semantic Vector Top-20, metadata/exact boosts, confidence threshold, and Final Top-3.
- Fixed the observed multi-turn failure. `how to pair?` now creates persisted product clarification; `KMREM` restores the original pairing intent and returns the QR-code/11-digit setup-code answer from the correct document.
- Product discovery scans the bounded matching pool, so products in one spreadsheet do not collapse under the spreadsheet name. CSV/XLSX file names are not offered as products.
- OpenAI output is evidence-bound structured JSON. Backend validates `usedChunkIds` and creates citations only from selected chunks actually used by the answer. No evidence means no OpenAI call and no citation.
- Added signed-session tenant resolution, wrong-tenant rejection, tenant/visitor rate limiting, message idempotency, and explicit pending-versus-assigned human-support states.
- Answer Debug exposes Hybrid component scores and Top-K diagnostics without exposing prompts, secrets, or cross-tenant data.
- Updated the canonical current architecture diagram under `docs/architecture/current-chat-system-flow.mmd` and its Markdown mirror.

### Verification

- Full `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.
- Real local HTTP/OpenAI smoke passed: clarification, scoped KMREM answer, citation, zero-citation miss, duplicate idempotency, and wrong-tenant 401.
- Database migrations for `ASSIGNED` and tenant-scoped `clientMessageId` uniqueness were applied successfully.
- AnythingLLM remained read-only MIT architectural reference material; no source code or branding was copied.

### Acceptance Boundary

- The current semantic component is local sparse vector similarity, not neural embeddings or pgvector. It is suitable for the current alpha corpus but not presented as production-scale vector infrastructure.
- Authenticated browser click-through QA remains pending because the in-app browser DOM/evaluate command timed out; automated checks and direct runtime smoke are complete.

## 2026-07-03 Product Clarification Transposition Repair

- Fixed the observed `how do I pair a device?` -> `KMERM` loop when the knowledge model is `KMREM`.
- Short model-code matching now treats one adjacent character swap as one controlled edit; the tolerance remains restricted to likely model codes.
- Reliably resolved product scope is no longer rejected solely because generic words from the original question lower token coverage.
- A greeting or acknowledgement no longer traps the customer in a repeated product clarification loop; it receives a normal provider response while the pending clarification is preserved.
- Added regressions for both explicit clarification candidates and open clarification state with no candidate options.
- API tests and typecheck pass. Live browser confirmation remains part of manual acceptance.

## 2026-06-25 Customer Widget Composer Cleanup

### Completed capability

- The customer widget textarea now clears immediately after a valid send starts, so sent text does not remain visible while the assistant response is still loading.
- If the send request fails, the exact submitted draft is restored for retry.
- Added a customer-widget source smoke test to lock this behavior.

### Verification

- `pnpm --filter @platform/customer-widget test` passed.
- `pnpm --filter @platform/customer-widget typecheck` passed.
- `pnpm --filter @platform/customer-widget build` passed.

## 2026-06-25 Product Clarification Context Repair

### Completed capability

- Product-aware retrieval now treats short replies to a pending clarification as continuation context rather than a standalone new question.
- Example behavior: `how to pair?` followed by `KMREN` is resolved as a pairing question scoped to the closest matching model/product, instead of asking what the user wants to do with KMREN.
- Short product-action questions with only generic evidence now create an open pending clarification with no options, so follow-up replies still preserve the original intent.
- Small typo matching is limited to short model-code-like labels so generic text does not become fuzzy product scope.
- Generic replies such as `matter product` still repeat/narrow clarification when there is no strong product/model match.
- Existing chat conversation metadata continues to persist the resolved `rag.productContext` for later follow-up questions.
- Follow-up build hardening: admin-web build now clears only local `.next` before `next build`, fixing a stale Next app-router cache failure observed during full workspace build.

### Verification

- `pnpm --filter @platform/api test` passed, including the new short model-code pending-clarification regression.
- `pnpm --filter @platform/api typecheck` passed.
- `pnpm --filter @platform/admin-web test` passed to confirm the admin-web source smoke was not affected.
- Full workspace `pnpm build` passed after the admin-web build wrapper fix.

## 2026-06-24 Product Entity Cleanup and Confidence Threshold

### Completed capability

- Retrieval now filters noisy product/entity candidates such as FAQ/Q&A labels, case-study titles, policy/warranty categories, example domains, and long title-like phrases without product/model signals.
- Existing legacy metadata that stored a document title as `productName` is filtered at retrieval time before it can appear as a clarification option.
- Pending clarification responses that do not match the offered options now repeat the clarification instead of passing a weak phrase into the provider.
- Retrieval decisions now carry a safe confidence object with level, reason, best score, coverage, and optional score gap.
- Chat message metadata stores retrieval confidence for later debugging; Answer Debug displays detection/confidence details without exposing prompts, tenant IDs, or secrets.

### Verification

- `pnpm --filter @platform/api typecheck` passed.
- `pnpm --filter @platform/api test` passed, including noisy-title and unresolved-clarification product-aware regressions.
- `pnpm --filter @platform/admin-web test` and typecheck passed for the Answer Debug UI surface.

## 2026-06-24 Product-Aware RAG Direction and First Implementation

### Reference and license boundary

- Reviewed `reference/anything-llm-master` only as a read-only architectural reference.
- Confirmed AnythingLLM license is MIT, copyright Mintplex Labs Inc.
- No AnythingLLM source code, UI branding, names, logos, screenshots, or marketing text was copied or substantially adapted.
- Added root `THIRD_PARTY_NOTICES.md` documenting architectural review only and no copied source.

### Completed capability

- Knowledge ingestion now writes generic structured knowledge metadata into existing JSON metadata fields for documents and chunks: product series, product name, model number, device type, document type, language, version, section/page hints, aliases, and intent hints.
- Retrieval now has a product-aware decision layer while keeping the existing `retrieveRelevantChunks()` compatibility API.
- Short product-action questions such as "how to pair?" can trigger a clarification question when multiple product scopes match instead of guessing from the nearest chunk.
- Customer chat stores pending clarification and product context on the conversation metadata, then scopes the next answer to the clarified product.
- Answer Debug now reports clarification outcomes, ambiguity options, product scope metadata, and safe retrieval warnings.
- OpenAI prompt context now includes safe product-scope metadata for selected chunks and explicitly instructs the model not to mix unrelated product series/models/device types.

### Architecture notes

- No Prisma schema migration was added in this pass; the implementation uses existing JSON metadata fields for a safe first step.
- No new dependency was added.
- Embedding/vector search, pgvector, reranking, and background indexing remain future phases; they were not represented as completed in this update.

### Verification

- `pnpm --filter @platform/api typecheck` passed.
- `pnpm --filter @platform/api test` passed, including the new `product-aware-rag.test.ts`.
- Full workspace verification is still pending in this round.

## 2026-06-22 User Avatars and Structured Knowledge Imports

### Upload control follow-up

- Knowledge file selection is now controlled state with an explicit Select file action, drag/drop, selected filename/size, remove action, extension validation, and 5 MB client limit.
- CSP now explicitly permits only same-origin/blob workers so Clerk no longer falls back to blocked `script-src` worker handling.
- A clean Next build/cache reset removed the stale manifest error; runtime is back on ports 3000/4000 only.

### Clerk redirect-loop follow-up

- Fixed a middleware mode-detection bug that redirected a valid Clerk session back to `/sign-in` after both session verification and account lookup returned 200.
- Middleware is now only a cookie-presence fast gate. Protected pages and the same-origin proxy remain the authoritative Clerk signature/mode verification boundaries.
- Admin typecheck, auth regression tests, production build, clean restart, and 3000/4000 health checks pass.

### Completed capability

- Every mapped Clerk user can upload, crop, and replace their own profile photo from `/account` or `/admin/account`.
- The saved user avatar replaces the former hardcoded admin image and is also shown in the Agent header.
- Knowledge Base file ingestion now accepts `.csv` and `.xlsx` in addition to the existing text formats.
- Server-side extraction detects common and descriptive Question/Answer columns, preserves quoted CSV values, imports other layouts as labelled structured records, and records sheet/row locators for chunk citations.

### Security and tenant boundary

- Avatar mutation derives the target user exclusively from verified auth context. The request cannot supply a user ID.
- Avatar data is format/signature checked, cropped to 512x512, capped at 512 KB, rate-limited, and audit logged.
- Table upload remains protected by `AdminApiGuard`, resolved tenant scope, and OWNER policy.
- XLSX/CSV uploads are capped at 5 MB, 25 sheets, 10,000 rows per sheet, 100 columns, and 5 million extracted characters.

### Verification and remaining acceptance

- Full workspace `typecheck`, `lint`, `test`, and `build` passed; `git diff --check` and targeted secret scan passed.
- Admin/API health checks pass on ports 3000/4000; port 3001 is unused.
- Authenticated visual crop/upload and real Knowledge UI upload remain manual because the browser controller was unavailable.
- The referenced `thread_qa.xlsx` is missing from the supplied Downloads path and attachment cache, so generated equivalent fixtures passed but that exact workbook was not inspected.

## 2026-06-19 Tenant-Scoped Admin Global Search

## 1. Completed Capability

The admin topbar search is now functional instead of decorative. It searches the active tenant across navigation, conversations, knowledge bases, and knowledge documents, then deep-links to the selected resource.

## 2. Security and Runtime Contract

- Added protected GET /v1/search with 2-100 character query validation and a capped per-resource limit.
- Search is protected by AdminApiGuard and tenant resolution middleware.
- Every conversation, knowledge-base, and knowledge-document Prisma query includes the resolved tenant ID.
- Responses contain safe truncated summaries only and do not expose prompts, raw metadata, source locators, auth data, or secrets.
- Admin Web calls the endpoint through the existing same-origin /api/admin proxy with the active x-tenant-slug.

## 3. User Workflow

- Empty search shows common admin destinations.
- Two or more characters trigger a 250 ms debounced tenant resource search.
- Results are grouped into Navigation, Conversations, and Knowledge.
- Ctrl/Cmd+K, Arrow Up/Down, Enter, Escape, click selection, click-outside dismissal, loading, error, and empty states are supported.
- Conversation results open the exact conversation; knowledge results open the exact knowledge base/document.

## 4. Verification

Passed:

- Full workspace typecheck, lint, test, and build.
- Admin Web typecheck, test, and production build after the final shortcut change.
- API search guard, validation, tenant-scope, safe-preview, and result-shape regression tests.
- Admin Web source regressions for endpoint usage, tenant header, keyboard controls, and deep-link parameters.
- Runtime API health returned 200 and unauthenticated /v1/search returned 401 rather than 404/500.
- git diff --check passed with Windows LF/CRLF warnings only.

Authenticated visual search acceptance remains a manual browser check because the automated browser does not own the user Clerk session.

## 5. Overall Project Conclusion

Global search is implemented and code-verified. The broader project remains RETURN FOR FIXES until the previously listed Knowledge -> Widget -> human handoff -> agent reply browser loop is fully accepted.

## 2026-06-18 Clerk Local Business Loop Progress

## 1. Current Outcome

The local Clerk integration moved from code-level readiness into real local use. The user configured the Clerk Dashboard and local env, signed in with a real Clerk account, and the admin session bridge reached the protected admin workspace.

This is not yet a full READY state for the original business-loop goal. Clerk local auth and tenant-role mapping are working, but the complete Knowledge Base -> Answer Debug -> Widget grounded answer -> human handoff -> agent reply -> widget refresh recovery loop still needs one final browser QA pass.

## 2. Accepted Change

- Real Clerk sign-in redirects to Clerk Account Portal and returns to local admin-web.
- Admin-web establishes a verified httpOnly Clerk-backed session before protected admin access.
- Unmapped/unauthorized access produced 401/403 behavior instead of silently exposing tenant data.
- The first mapped admin path was completed for the company user liangceli@kasta.com.au with Clerk user id user_3FFi1oexYzioOpimfG1ExJcIDOc.
- After mapping, the admin dashboard loaded tenant-scoped data without the earlier 403 spam.
- Active Chats / conversation operations now live on /admin/conversations.
- Knowledge Bases, Ingest Data, document chunks, and Answer Debug now live on /admin/knowledge-base.
- Admin Web continues to call the API through same-origin /api/admin/... proxy.

## 3. Verification Completed

Passed during the local closeout work:

- pnpm --filter @platform/admin-web typecheck
- pnpm --filter @platform/admin-web test
- pnpm --filter @platform/admin-web build
- pnpm --filter @platform/api typecheck
- pnpm --filter @platform/api test
- pnpm --filter @platform/api build
- git diff --check passed with Windows LF/CRLF warnings only.
- Local admin-web was restored on http://localhost:3000 after build/dev chunk resets.

Manual evidence observed:

- Real Clerk login page opened from local /sign-in.
- Signed-in but unmapped user could not establish admin tenant access.
- After Clerk user mapping, protected admin data requests stopped returning 403.

## 4. Not Yet Final-Accepted

The following original completion criteria still need final browser QA before claiming READY:

- Wrong-tenant isolation check after mapped login.
- Knowledge Base create/import, document/chunk inspection, and Answer Debug regression.
- Real OpenAI-backed answer path, if OpenAI mode is required for acceptance.
- Customer Widget grounded answer with citation.
- No-citation behavior for knowledge misses.
- Customer human-support request.
- Admin/agent sees pending conversation and sends reply.
- Customer sees agent reply in the original widget session after refresh.
- Sign-out protection check.
- Full workspace pnpm typecheck, pnpm lint, pnpm test, pnpm build, secret scan.

## 5. Director-Level Conclusion

Current conclusion: RETURN FOR FIXES.

Reason: real Clerk local auth and admin mapping are now working, but the full customer support business loop has not yet been re-run end to end after the auth setup.

## 2026-06-17 Admin Conversations Page Split

## 1. Completed Task

Moved the Active Chats / conversation operations workspace out of the `/admin` dashboard and into its own protected admin route: `/admin/conversations`.

## 2. Accepted Change

- `/admin` now remains the dashboard/profile/knowledge workspace.
- `/admin/conversations` renders `ConversationOpsPanel` as the standalone conversation operations page.
- The left drawer `Conversations` item navigates to `/admin/conversations`.
- The drawer `Dashboard` item navigates back to `/admin`.
- The new route reuses the existing Clerk/legacy protected route gate and existing `/api/admin/...` proxy behavior.

## 3. Verification

Passed:

- `pnpm --filter @platform/admin-web test`
- `pnpm --filter @platform/admin-web typecheck`
- `pnpm --filter @platform/admin-web build`
- Local route checks returned 200 for `/admin`, `/admin/conversations`, and `/v1/health`.

Note: in-app Browser visual verification was blocked by the Browser plugin security policy for `localhost:3000`.

## 2026-06-17 Clerk Alpha Auth Code-Level Closeout

## 1. Completed Task

Clerk alpha auth code-level closeout is complete for current local code. Real local Clerk login smoke remains pending user-owned Clerk Dashboard and local env configuration.

Latest commit at task start: `0fd2603 Add Clerk alpha auth and deployment readiness docs & update skill files`.

Current working tree now contains uncommitted hardening changes in admin-web/API auth verification, tests, and docs.

## 2. Accepted Change

- Admin-web Clerk session verifier now requires RS256 signature verification plus `sub`, numeric unexpired `exp`, valid optional `nbf`, optional `CLERK_ISSUER`, and optional `CLERK_AUTHORIZED_PARTIES`.
- `/api/auth/clerk/session` rejects missing config, invalid config, forged JWTs, invalid token-shaped JWTs, and does not set cookies for rejected tokens.
- `/admin` and `/agent` reject forged Clerk session cookies and redirect safely to sign-in.
- `/api/admin/...` rejects forged Clerk cookies before upstream fetch, and forwards `Authorization: Bearer <Clerk JWT>` only after verification.
- Backend `AdminApiGuard` fails safely on invalid `CLERK_JWT_KEY`, rejects forged signatures/missing expiration/issuer mismatch/authorized-party mismatch, and still requires mapped `User` + tenant `Role`.
- Platform tenant list/create path still requires `User.isPlatformAdmin=true`.
- Legacy `/admin/access` + `ADMIN_API_TOKEN` remains server-only local/dev or service fallback.
- Customer widget/chat routes remain public customer-scoped and do not require Clerk.

## 3. Verification

Passed:

- `node --check apps/admin-web/scripts/admin-access.test.cjs`
- `pnpm --filter @platform/admin-web test`
- `pnpm --filter @platform/api test`
- `pnpm --filter @platform/admin-web typecheck`
- `pnpm --filter @platform/api typecheck`
- `pnpm --filter @platform/config typecheck`
- `pnpm --filter @platform/admin-web build`
- `pnpm --filter @platform/api build`
- `pnpm --filter @platform/config build`
- `git diff --check` passed with Windows LF/CRLF warnings only.

## 4. Manual Gate

The user must configure Clerk directly in Clerk Dashboard and local env without pasting secrets into chat:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_JWT_KEY`
- optional `CLERK_ISSUER`
- optional `CLERK_AUTHORIZED_PARTIES`
- sign-in/sign-up/after-auth URL env
- allowed redirect URLs and allowed origins for local admin-web
- `ADMIN_API_PROTECTION_MODE=clerk`

Real local Clerk smoke cannot be claimed until that is done and verified.

## 5. Remaining Risks

- P0: none known.
- P1: real Clerk local login smoke blocked pending user setup.
- P2: handler-style tests are not full browser/e2e tests.
- P2: future production auth should derive acting user IDs from verified auth context rather than body fields.

## 6. Recommended Next Tasks

1. Pause for user Clerk Dashboard/env setup.
2. After confirmation, run local env presence checks without printing values, start services, complete first owner bootstrap, and run real Clerk local smoke.
3. If local smoke passes, proceed to Alpha Online Deployment + External Widget Smoke.

## 1. Completed Task

Accepted QA context: Clerk alpha auth boundary and Admin-Web Clerk session verification P1 fix.

Latest commit reviewed for this docs sync: `0c6fc17 update skill files`.

Important reconciliation note: `0c6fc17` is a docs-only sync commit and does not contain the Clerk auth implementation described in `latest-implementation.md` and `latest-qa.md`. The current handoff/QA describes newer uncommitted working-tree changes.

## 2. Accepted Change

- Admin-web Clerk session bridge now verifies Clerk JWT signature and configured claims before setting the httpOnly sameSite Clerk session cookie.
- `/api/auth/clerk/session` returns 500 when required verification config is missing, returns 401 for invalid/forged tokens, and must not set a cookie for rejected tokens.
- `/admin`, `/agent`, and `/api/admin/...` must reject forged token-shaped Clerk JWT cookies.
- Admin-web proxy forwards `Authorization: Bearer <Clerk JWT>` only after server-side verification.
- Backend `AdminApiGuard` remains the API enforcement boundary in Clerk mode. Signed-in Clerk users must still map to an existing `User` and tenant `Role`.
- Platform-level tenant list/create requires `User.isPlatformAdmin=true`.
- Legacy `/admin/access` and `ADMIN_API_TOKEN` remain server-only local/dev or service fallback paths.
- Browser-visible Clerk config is limited to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; backend/admin/OpenAI/database/session secrets must not be exposed to browser code, logs, responses, or docs examples with real values.

## 3. Contract

- Staging/production alpha path should use `ADMIN_API_PROTECTION_MODE=clerk`.
- Required Clerk verification config includes `CLERK_JWT_KEY`; optional hardening uses `CLERK_ISSUER` and `CLERK_AUTHORIZED_PARTIES`.
- Admin-web may store and trust the Clerk session cookie only after server-side JWT signature and claim verification.
- Middleware may use cookie presence for quick redirects, but page and proxy handlers remain the final verification boundary.
- Customer widget/chat routes remain public customer-scoped and do not require Clerk.
- Real alpha-online status is not proven by local tests, mocked Clerk, fake tokens, localhost widget smoke, deterministic-only AI output, or screenshots without deployed URLs.

## 4. Verification

Accepted QA reported no P0/P1 findings.

Passed checks:

- `pnpm --filter @platform/admin-web test`
- `pnpm --filter @platform/admin-web typecheck`
- `pnpm --filter @platform/admin-web build`
- `pnpm --filter @platform/api test`
- `pnpm --filter @platform/api typecheck`
- `pnpm --filter @platform/config typecheck`
- `pnpm --filter @platform/config build`
- `git diff --check` with only Windows LF/CRLF warnings

QA acceptance confirmed:

- Forged token-shaped JWTs are no longer accepted by the admin-web Clerk session bridge.
- `/admin`, `/agent`, and the admin-web proxy require verified Clerk session cookies.
- Backend Clerk guard, tenant role mapping, platform-admin gate, and legacy token fallback remain intact.
- No secret exposure was found in the reviewed implementation/docs.

## 5. Remaining Risks

- Repository history is not fully synced with the handoff yet: the latest commit is `0c6fc17 update skill files`, while the Clerk alpha auth implementation appears in the uncommitted working tree.
- Admin-web forged-JWT coverage is still mostly source-smoke. Add route-handler/runtime tests proving forged POSTs return 401 and do not set cookies.
- Backend Clerk issuer and authorized-party rejection tests can be strengthened.
- Admin/agent actions still need future hardening to derive acting identity from verified auth context instead of trusting client-provided body fields.
- Online alpha readiness remains pending until user-owned Clerk, hosting, database, CORS, OpenAI-if-enabled, and external widget smoke checks pass on deployed URLs.

## 6. Updated Docs

- `docs/skills/current-status.md`: updated latest status, accepted Clerk QA context, commit mismatch, limitations, risks, and next tasks.
- `docs/skills/qa-skill.md`: added accepted Clerk session verification QA expectations and remaining P2 test gaps.
- Existing affected skills already record the Clerk alpha auth boundary:
  - `docs/skills/auth-skill.md`
  - `docs/skills/frontend-skill.md`
  - `docs/skills/backend-skill.md`
  - `docs/skills/api-contract-skill.md`
- `docs/ai-handoff/director-update.md`: refreshed for Project Director handoff.

## 7. Recommended Next Tasks

1. Ask Implementation Codex to commit or otherwise prepare the current Clerk alpha auth working-tree changes for review.
2. Ask QA Codex to run the manual Clerk alpha route-map acceptance checks: no cookie redirects, forged session POST 401/no cookie, forged cookie rejection on `/admin` and `/agent`, forged proxy request 401, legacy local `/admin/access` still works when intentionally configured.
3. Add route-handler tests for forged Clerk JWT rejection and stronger backend issuer/authorized-party tests.
4. Complete real deployed alpha smoke only after user-owned Clerk, hosting, DB, CORS, OpenAI-if-enabled, and external widget settings are configured without pasting secrets into chat.
## 2026-06-19 Security and Role Boundary Update

- Added strict Platform Admin, Tenant Owner, Agent, pending-user, and anonymous visitor boundaries.
- Owners receive only their tenant; only Platform Admin can enumerate/switch all tenants.
- Agents are routed to `/agent` and can read only unassigned pending-human work or their own assigned conversations.
- Added account identity, tenant membership, invitation acceptance, member suspension, secure sign-out, and audit persistence.
- Added signed Widget sessions bound to tenant and visitor identity, with tamper/wrong-tenant regression coverage.
- Added CSP/security headers, same-origin mutation checks, API no-store headers, production CORS validation, and targeted rate limits.
- Owner primary colors now propagate to the corresponding Agent console through a safe public tenant profile; the same contrast algorithm is shared by both surfaces.
- Automated typecheck, lint, test, and build are green. Final real-browser multi-role acceptance is still outstanding due unavailable Codex browser automation.
- Fixed Agent handoff ownership UX: unassigned alerts must be claimed before the Agent can reply or end support, matching backend row-level authorization.
- Fixed mixed-session regression: when Clerk is configured, legacy cookies cannot keep protected pages open; Clerk token renewal and explicit 401-to-sign-in recovery now cover Admin and Agent workspaces.

## 2026-06-19 Homepage and Controlled Access Update

- Added a public Solaris AI homepage at `/` with platform, workflow, security, sign-in, and sign-up entry points.
- Registration creates identity only. No user can choose Admin, Owner, or Agent in the browser; access remains pending until an email-bound invitation is accepted.
- Removed ordinary Clerk email auto-mapping and new-tenant implicit Owner creation, closing two invitation bypass paths. Controlled Platform Admin bootstrap is unchanged.
- Added per-tenant Agent invitation governance: one-time hashed codes, fixed 12-hour Agent expiry, default quota 5, hard range 0-5, transactional enforcement, revocation, and audit logging.
- Platform Admin tenant overview now reports Owner/Agent/suspended/invitation counts and allows quota adjustment. Owners remain restricted to their own tenant and Agent invitations.
- Added Agent sign-out and changed all role sign-outs to clear both sessions and return to the homepage.
- Local migration and all workspace checks passed. Browser smoke passed for public responsive layout, protected redirect, enabled Clerk sign-in, and a clean console.
- Final acceptance still requires manual real-Clerk multi-role invitation and logout QA with separate Owner and Agent accounts.
