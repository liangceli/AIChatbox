# Status

Date: 2026-07-15

Latest completed capability: editable current chat architecture documentation.
- Re-audited the end-to-end Widget-to-answer flow against the current working tree.
- Updated the synchronized Mermaid source/preview and added a three-page editable diagrams.net file covering the clean online spine, detailed RAG/provider grounding, and component/data boundaries. Long cross-phase return lines were removed to keep the editable diagram legible.
- The diagram records the actual security, idempotency, conversation-state, hybrid retrieval, confidence, provider fallback, citation validation, human-mode concurrency, persistence, SSE, and restore paths.
- Planned worker queues, neural embeddings, and an external vector database are not shown as implemented.

Latest completed capability: reproducible knowledge versioning and state/log safety closeout.
- Added and locally applied forward migration `20260713000000_fix_knowledge_chunk_version_index`.
- The migration drops the legacy `(tenantId, knowledgeDocumentId, chunkIndex)` unique index created by the initial schema; that index incorrectly blocked version 2 chunks even though the Prisma schema and lifecycle service use version-aware uniqueness.
- Added a database schema regression and an explicit real-PostgreSQL lifecycle test. The integration test writes version 1 chunks, marks them INACTIVE, writes version 2 READY chunks with the same chunk indexes, asserts both generations, and rolls the whole transaction back.
- Verified the legacy index is absent after migration and that tenant/document/chunk counts remain unchanged after the rollback test.
- Explicit `productContext: null` now clears `ConversationState.activeProductContext`, confidence, source, catalog relation, state JSON, and legacy conversation metadata, preventing an unrelated later follow-up from reviving stale product context.
- AI Worker startup now logs `redisConfigured` only and has a source regression preventing the full `REDIS_URL` from entering logs.
- Database and AI Worker package tests are no longer placeholders. Six support packages still have explicit placeholder tests.
- Workspace typecheck, lint, test, build, and `git diff --check` pass across all 11 packages after the controlled Admin Web dev shutdown.

Latest completed capability: knowledge lifecycle hardening for active answers.
- Added lifecycle fields for knowledge documents/chunks: document `DELETED`, document `version`, processing error timestamps, chunk `status`, chunk `version`, `contentHash`, and `embeddingStatus`.
- Knowledge upload/update now treats repeated FILE/URL `sourceUri` as a replacement target instead of creating unlimited duplicate active documents.
- Reprocessing keeps the old READY version searchable if the new processing attempt fails; only a first-time failed document becomes FAILED.
- Archive/delete are now soft lifecycle transitions: documents become ARCHIVED/DELETED and related chunks become ARCHIVED/DELETED instead of being physically removed first.
- Retrieval now requires `tenantId`, `KnowledgeDocument.status = READY`, and `KnowledgeChunk.status = READY` for both keyword and local semantic pools, so OpenAI and deterministic modes use the same active filtered chunk set.
- Admin document lists hide DELETED documents; global search excludes DELETED documents and uses READY chunks for previews.
- Applied local migration `20260703030000_harden_knowledge_lifecycle` after resolving a local failed migration record caused by a missing legacy unique constraint name.
- API typecheck and API tests passed, including new lifecycle regression coverage. Browser QA remains pending after service restart.

Latest completed capability: explicit ConversationState and ProductCatalog phase 1.
- Added `ProductCatalog` and `ConversationState` Prisma models plus migration `20260703020000_add_product_catalog_conversation_state`.
- Added `ConversationStateService` to read persisted active product context before legacy `Conversation.metadata.rag`, persist pending clarification, and upsert resolved product scopes into `ProductCatalog`.
- `ChatService` now passes the persisted retrieval context into product-aware retrieval and synchronizes state after clarification/answer turns while keeping legacy metadata for compatibility.
- Added `pnpm --filter @platform/api backfill:product-catalog`; optional `TENANT_SLUG=<slug>` scopes the backfill. The script scans existing knowledge metadata and upserts tenant-scoped product catalog entries without printing content or secrets.
- Added API regression coverage for persisted state priority and catalog/state upsert behavior. API test and typecheck passed.
- Full DB migration/backfill was not run in this turn; apply the migration before browser testing this phase against the local database.

Latest completed capability: product-context pronoun follow-up scoping.
- Follow-up retrieval now injects the stored conversation product context as a hidden retrieval constraint, so pronoun questions such as `Which ecosystems support it?` stay scoped to the product the customer just selected.
- If a customer explicitly resolves a pending product clarification and the selected evidence has a single product scope, that scope is persisted as `rag.productContext` for later turns.
- Regression coverage now includes `how do I pair a device?` -> `KMDIM400` -> `Which ecosystems support it?`, and verifies the follow-up retrieves KMDIM400 compatibility evidence rather than KMREM evidence.
- This is a tenant-neutral state-machine fix. Do not add product-specific hardcoded branches to platform core.

Latest completed capability: repair/pair intent-boundary and clarification-loop repair.
- Intent detection now matches complete normalized words/phrases, so `repair` can no longer trigger the `pair` intent through substring overlap.
- `repair`, `fix`, `broken`, and related terms map to troubleshooting.
- Short model-code clarification replies use controlled adjacent-character transposition variants during candidate lookup and scoring; `KMERM` can resolve to `KMREM` without broad fuzzy matching.
- Resolved product scope is also checked against intent metadata, so pairing-only KMREM evidence cannot be used as a repair answer.
- Real sequence passed: CEO knowledge miss -> `how to repair it?` asks which product to troubleshoot -> `KMERM` exits pending and returns a zero-citation knowledge miss because no KMREM repair instructions exist.

Latest completed capability: professional evidence-gap replies.
- No-knowledge chat responses no longer prepend tenant-configured fallback copy, preventing informal or unsafe text such as `bro` from entering the platform evidence-safety response.
- Purchase/location questions with no grounded source now state that verified purchasing information is unavailable in the current knowledge base and optionally offer human support.
- Real Kasta sequence passed: product clarification -> KMREM pairing -> ecosystem follow-up -> purchasing follow-up. The first two grounded answers cite KMREM evidence; the unsupported purchasing answer has zero citations.

Latest completed capability: context-safe Hybrid Search and hardened widget delivery.
- Retrieval now combines scored Keyword Top-20 and local sparse-semantic Vector Top-20 candidates, then applies `45% keyword + 35% semantic + 15% metadata + 5% exact-match` weighting, product scope, confidence threshold `0.55`, source diversity, and Final Top-3 selection.
- Product ambiguity discovery runs across the bounded tenant keyword pool rather than only the final candidates. A real Kasta `how to pair?` request now asks for a product and lists `KMREM`, `KMDIM400`, and `KMREL400`; file names are excluded.
- Pending clarification, follow-up, new-question, greeting, thanks, and human-request turns are classified separately. Pending clarification expires after 20 minutes, and only genuine follow-ups reuse product context.
- OpenAI receives the last eight turns plus selected tenant evidence and must return structured `answer + usedChunkIds`; citations are emitted only for valid used IDs from the selected evidence. No-evidence requests bypass OpenAI and return a deterministic knowledge miss with zero citations.
- Widget sessions are signature-first, tenant is loaded from the signed tenant ID, wrong-tenant reuse is rejected, customer sends require a tenant-scoped idempotency key, and tenant/visitor rate limits are enforced.
- Human support now distinguishes `PENDING_HUMAN` from atomically claimed `ASSIGNED`; both states keep AI paused until human support ends.
- Real local API/OpenAI smoke passed for `how to pair? -> KMREM`, grounded citation, no-evidence refusal, duplicate-send idempotency, and wrong-tenant 401.
- The current semantic scorer is an original dependency-free local sparse vector implementation. Neural embeddings, pgvector, distributed rate limiting, and a production-scale index remain future hardening, not claimed capabilities.
- Full workspace lint, typecheck, test, and build pass. Seven package test scripts remain explicit placeholders. Authenticated click-through browser acceptance remains pending because the in-app browser DOM/evaluate operation timed out.

Latest completed capability: transposed short model-code clarification repair.
- Pending product clarification now accepts a single adjacent-character transposition in short model codes, so `KMERM` can safely resolve to `KMREM` without broad fuzzy product matching.
- Once a product scope is reliably resolved, generic words in the original question no longer cause coverage scoring to discard the correctly scoped chunk.
- Greetings and acknowledgements such as `Hi` are handled as conversational interruptions instead of invalid product replies; the pending clarification remains available for the next product response.
- Regression coverage includes `how do I pair a device?` followed by `KMERM` for both populated and open/empty clarification option states.
- API tests, API typecheck, and focused diff checks pass for this repair.

Latest completed capability: pending clarification short model replies.
- Product-aware retrieval now treats short replies to a pending clarification as continuation context, so `how to pair?` followed by `KMREN` retrieves as the original pairing question plus the short model reply.
- Short product-action questions with only generic evidence now create an open `rag.pendingClarification` even when there are no clean product options; this prevents the LLM from asking an untracked natural-language clarification.
- Short model-code replies can resolve to a known product/model with a small typo only when both sides look like model codes.
- Generic clarification replies such as `matter product` continue to ask for a stronger product/model instead of forcing a weak scope.
- Once the model/product scope is resolved, the existing conversation `rag.productContext` persistence path continues to scope later follow-up questions.
- `pnpm --filter @platform/api test`, `pnpm --filter @platform/api typecheck`, and `pnpm --filter @platform/admin-web test` passed for this focused update.

Latest completed capability: customer widget composer cleanup.
- The customer widget now clears the submitted textarea draft immediately when a valid send starts, instead of leaving stale text visible while the response is in flight.
- If the send request fails, the submitted draft is restored so the customer can retry without retyping.
- `apps/customer-widget` now has a source smoke test covering immediate draft clear and failure restore behavior.

Latest completed capability: product-aware RAG first step.
- AnythingLLM was reviewed as a read-only MIT architectural reference; no source code or branding was copied.
- `THIRD_PARTY_NOTICES.md` records the AnythingLLM review, copyright holder, MIT license type, and no copied/adapted source.
- Knowledge documents/chunks now carry structured knowledge metadata inside existing JSON metadata fields.
- Retrieval can detect product/action ambiguity, ask a clarification question, and then persist product context on the conversation for scoped follow-up answers.
- Customer chat and Answer Debug now use `resolveRetrievalDecision()`; legacy `retrieveRelevantChunks()` remains available for compatibility.
- OpenAI prompt context includes selected chunk product-scope metadata and prohibits mixing evidence across unrelated product scopes.
- No schema migration, vector database, embedding provider, reranker, or new package dependency was introduced in this pass.
- API typecheck and API test pass, including the new product-aware RAG regression script.

Latest completed capability: product/entity candidate cleanup and confidence threshold.
- Product clarification candidates now filter FAQ/Q&A/case-study/policy/generic document-title noise, including legacy title-derived metadata.
- Document titles are only inferred as product labels when they contain clear product/model signals.
- Pending clarification replies that do not match an offered product option repeat the clarification instead of generating from weak context.
- Retrieval decisions now include confidence level, reason, best score, and coverage; chat message metadata and Answer Debug expose safe confidence diagnostics.
- API product-aware regression tests cover noisy title filtering and unresolved clarification repeats.

Latest completed capability: admin-web local CSS dev reliability.
- `apps/admin-web` dev startup now runs through `scripts/dev-server.cjs`, which clears only the local `.next` compilation output before launching `next dev`.
- Follow-up: admin-web production build now runs through `scripts/build-server.cjs`, which also clears only `.next` before `next build` to avoid stale local app-router module errors such as missing `/_document`.
- This targets intermittent Windows/Next stale CSS, HMR, and app-router build artifacts without changing runtime behavior or page styling.
- Admin-web source smoke tests now assert the dev/build scripts remain wired into `package.json`.

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
