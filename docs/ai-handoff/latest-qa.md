# 中文 Diff Review & QA Report

## 2026-07-13 Migration Reproducibility and State Safety QA

- PASS: local migration `20260713000000_fix_knowledge_chunk_version_index` applied successfully; Prisma reports 10 applied migrations.
- PASS: the legacy `(tenantId, knowledgeDocumentId, chunkIndex)` unique index is absent after migration.
- PASS: rollback-safe real PostgreSQL test writes two version 1 chunks, inactivates them, and writes two version 2 READY chunks using the same chunk indexes.
- PASS: integration rollback preserved the existing local counts of 3 tenants, 31 knowledge documents, and 335 chunks.
- PASS: explicit null product context clears persisted JSON context, active catalog relation, active confidence/source, and legacy metadata; no product catalog upsert occurs during clearing.
- PASS: AI Worker source regression prevents raw `REDIS_URL` logging and requires a safe configured boolean.
- PASS: workspace typecheck, lint, test, build, and diff checks pass across all 11 packages. Database and AI Worker now have real tests; six packages retain explicit placeholders.
- PASS: Admin Web production build and Customer Widget standard lifecycle build pass after controlled dev shutdown.
- PENDING: authenticated multi-role browser acceptance remains required before READY.

## 2026-07-08 Knowledge Lifecycle QA

- PASS: API typecheck passed after adding document/chunk lifecycle fields and filters.
- PASS: API tests passed, including `knowledge-lifecycle.test.ts`.
- PASS: retrieval queries now require `KnowledgeChunk.status = READY` and `KnowledgeDocument.status = READY`.
- PASS: reprocess failure preserves a previous READY document and records the processing error instead of making the old answer unavailable.
- PASS: delete uses soft lifecycle state and marks chunks DELETED rather than hard-deleting first.
- PASS: local migration `20260703030000_harden_knowledge_lifecycle` was applied successfully after marking the initial failed attempt rolled back.
- PENDING: browser QA should restart services and verify upload same file -> replacement, failed reprocess -> old answer remains, delete/archive -> no stale citation, and context follow-up after product clarification.
- WATCH: the current runtime may still show old behavior until API/Admin Web are restarted after migration and Prisma generate.

## 2026-07-03 ConversationState / ProductCatalog Phase 1 QA

- PASS: API typecheck passed after adding `ConversationState`, `ProductCatalog`, and state-service chat integration.
- PASS: API tests passed, including new `conversation-state.test.ts`.
- PASS: persisted `ConversationState.activeProductContext` takes priority over legacy `Conversation.metadata.rag.productContext`.
- PASS: resolved product context upserts a tenant-scoped `ProductCatalog` entry and writes `ConversationState` with active product, confidence, and source.
- PASS: legacy metadata remains synchronized for compatibility while retrieval uses the new persisted state first.
- PENDING: run Prisma migration and optional product catalog backfill against the local database before browser QA.

## 2026-07-03 Product Context Follow-Up QA

- PASS: `how do I pair a device?` creates product clarification instead of guessing.
- PASS: `KMDIM400` resolves the pending clarification and persists KMDIM400 as the product context.
- PASS: `Which ecosystems support it?` reuses the stored product context as a hidden retrieval constraint.
- PASS: the follow-up retrieves `KMDIM400 compatibility` and does not return the stronger global `KMREM` ecosystem chunk.
- PASS: `pnpm --filter @platform/api test` passed with the new regression.

## 2026-07-03 Repair Intent and Clarification Exit QA

- PASS: `how to repair it?` is troubleshooting, never pairing; intent matching uses complete word/phrase boundaries.
- PASS: a stale pairing clarification is treated as a new troubleshooting question rather than repeated.
- PASS: `KMERM` uses one controlled adjacent-character transposition to resolve KMREM and exits pending clarification.
- PASS: KMREM pairing-only chunks are excluded from a repair answer by intent-aware scope filtering.
- PASS: absent KMREM repair evidence returns professional fallback with zero citations, not a guessed repair method.
- PASS: API typecheck/tests and real local three-turn runtime smoke passed.

## 2026-07-03 Knowledge-Gap Copy QA

- PASS: `where can I buy it?` is classified as a KMREM follow-up after the ecosystem question.
- PASS: no verified KMREM purchase document exists; navigation-only `Where To Buy` text is not treated as purchasing evidence.
- PASS: no-evidence response does not include tenant fallback text such as `bro`.
- PASS: unsupported purchasing response has zero citations and does not invent retailers, stockists, prices, or availability.
- PASS: API typecheck, API tests, and live Kasta four-turn runtime smoke passed.

## 2026-07-03 Hybrid Retrieval, Context, and Widget Security QA

- PASS: Keyword candidates are scored before Keyword Top-20 truncation, preventing arbitrary database order from dropping an exact model chunk.
- PASS: Local sparse-semantic Vector Top-20 and Keyword Top-20 are deduplicated and weighted with metadata/exact boosts before Final Top-3.
- PASS: `how to pair?` against the real Kasta corpus asks for a product and does not list spreadsheet/file names.
- PASS: Follow-up `KMREM` answers with QR-code or 11-digit setup-code evidence and a citation from `matter_thread_devices.xlsx`.
- PASS: unrelated payroll-tax question returns the tenant fallback/knowledge-miss answer with zero citations.
- PASS: duplicate `clientMessageId` returns the same persisted customer message; first-message retries cannot create a second conversation because uniqueness is tenant-scoped.
- PASS: signed Widget token reused with a different tenant slug returns 401.
- PASS: OpenAI citations are restricted to validated `usedChunkIds` from the selected evidence; malformed, unknown, or empty evidence IDs fall back safely.
- PASS: `PENDING_HUMAN` and `ASSIGNED` both pause AI; assignment and agent replies remain tenant/user scoped.
- PASS: full workspace `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` completed within the five-minute limit.
- PASS: API, Admin Web, and Customer Widget have real source/behavior test tasks. Config, database, logging, types, ai-worker, tenant-core, and ai-core still report placeholder test scripts and are not counted as behavioral coverage.
- PASS: runtime health returned 200 in Clerk/OpenAI mode and the two Prisma migrations were applied.
- PENDING: authenticated browser click-through for Admin Answer Debug, Widget refresh, handoff, Agent reply, and sign-out. The in-app browser could list the localhost tab but DOM/evaluate timed out, so no visual acceptance is claimed.
- SCALE RISK: semantic vectors and rate-limit buckets are process-local. Production scale requires a persisted neural embedding/vector index and shared rate-limit store.

## 2026-07-03 Transposed Model Clarification QA

- PASS: `how do I pair a device?` followed by `KMERM` resolves to the tenant-scoped `KMREM` product evidence instead of repeating the clarification.
- PASS: The same transposition resolves when `pendingClarification.options` is empty and product scope must be recovered from retrieved metadata.
- PASS: Product-scoped evidence is not suppressed by generic original-question words after the scope has been strongly resolved.
- PASS: `Hi` during a pending product clarification is handled as an interruption, does not repeat the clarification, and does not consume the pending state.
- PASS: After the greeting, a later `KMERM` reply resumes the original pairing intent and retrieves KMREM evidence.
- PASS: API test, API typecheck, and focused `git diff --check` completed successfully.
- PENDING: Browser QA should repeat the exact live Widget sequence and verify the resulting answer cites only the KMREM source.

## 2026-06-25 Customer Widget Composer QA

- PASS: Customer widget source smoke now asserts the textarea draft is cleared immediately after a valid send starts.
- PASS: Customer widget source smoke asserts failed sends restore the submitted draft for retry.
- PENDING: Browser QA should verify `/chat` no longer leaves the sent text in the composer while the assistant response is loading.

## 2026-06-25 Product Clarification Context QA

- PASS: API tests pass with a new regression for `how to pair?` followed by short model reply `KMREN`, preserving the original pairing intent and scoping retrieval to the closest matching model/product.
- PASS: API tests now cover open pending clarification when `how to pair?` only has generic evidence and no clean product options.
- PASS: Generic short clarification replies such as `matter product` continue to repeat clarification instead of forcing weak product scope.
- PASS: API typecheck passes after adding model-code typo matching and short clarification continuation handling.
- PASS: Admin-web source smoke still passes; this backend retrieval change did not alter the admin UI contract.
- PASS: Full workspace build passes after routing admin-web build through the `.next` cleanup wrapper; the prior stale `/_document` Next cache failure is resolved.
- PENDING: Browser QA should verify the live `/chat` sequence `how to pair?` -> `KMREN` returns a scoped pairing answer with citations, and `matter product` still asks for a more specific product/model.

## 2026-06-24 Product Entity Cleanup and Confidence QA

- PASS: API typecheck passed after adding retrieval confidence diagnostics.
- PASS: API tests passed after product/entity candidate cleanup and confidence threshold changes.
- PASS: Product-aware regressions now cover noisy title filtering so `FAQ KASTA`, `matter qa`, and long case-study style titles are not clarification options.
- PASS: Pending clarification with an unmatched short reply repeats the clarification and returns no retrieved chunks.
- PASS: Admin-web Answer Debug source smoke and typecheck pass with the new retrieval detection display.
- PENDING: Browser QA should confirm `/chat` no longer suggests FAQ/case-study titles in clarification options and Answer Debug shows confidence reason.

## 2026-06-24 Product-Aware RAG QA

- PASS: AnythingLLM reference license checked as MIT; root third-party notice documents read-only architectural review and no copied source.
- PASS: No new dependency, schema migration, GPL/AGPL/SSPL/non-commercial package, copied UI, or copied AnythingLLM module was introduced.
- PASS: API typecheck passed after adding structured knowledge metadata, product-aware retrieval decisions, chat clarification handling, Answer Debug clarification reporting, and prompt scope hints.
- PASS: API test passed, including new product-aware regressions for ambiguous "how to pair?", clarification follow-up scoping, persisted product context scoping, and explicit metadata extraction.
- PASS: Existing provider, table/avatar, tenant-scope, handoff race, and safe debug tests remain green.
- PENDING: Full workspace typecheck/lint/test/build and browser QA are not completed yet in this round.
- PENDING: Embedding/vector hybrid retrieval and reranking are future phases, not accepted capabilities from this pass.

## 2026-06-22 Avatar and Table Knowledge QA

- Follow-up PASS: controlled file selection, visible filename/size, drag/drop, remove action, client extension/size validation, and multipart path source assertions.
- Follow-up PASS: CSP contains `worker-src 'self' blob:`; clean Admin build/typecheck/test pass and runtime headers expose the updated policy.
- Follow-up PASS: stale Next process/cache was removed; 3000 and 4000 are healthy and 3001 is unused.
- Follow-up PASS: logs proved Clerk session creation and `/account/me` were both 200 before a middleware redirect loop. Middleware mode inference was removed, source regression added, and final page/proxy verification remains unchanged.

Code, contract, security boundary, automated regression, production build, and service health checks pass. Authenticated browser interaction and the exact referenced workbook remain manual evidence.

- PASS: Avatar target is exclusively `auth.userId`; client cannot provide another user ID.
- PASS: Image allowlist, base64/size/signature checks, rate limit, audit event, crop output, and Admin/Agent rendering paths.
- PASS: Table route is OWNER-protected and resolved-tenant scoped.
- PASS: Multi-sheet XLSX Q&A, descriptive answer headers, quoted CSV, generic labelled records, sheet/row locators, and invalid signatures.
- PASS: Existing TXT/Markdown/JSON and URL ingestion paths remain unchanged.
- PASS: Cross-origin writes return 403; same-origin unauthenticated writes return 401.
- PASS: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `git diff --check`, health checks, and zero-match diff secret scan.

Manual checks: crop/update as each role, upload the actual `thread_qa.xlsx`, run Answer Debug against several rows, inspect citation sheet/row, test non-Q&A fallback, and confirm Agent/wrong-tenant upload denial.

## 2026-06-19 Tenant-Scoped Admin Global Search QA

## 1. Conclusion

Accepted at code, contract, and unauthenticated runtime-route level. Authenticated visual interaction remains a manual browser check with the real Clerk session.

No P0/P1 issue was found in the global search implementation.

## 2. Passed Checks

| Check | Result | Notes |
| --- | --- | --- |
| Admin auth boundary | Passed | SearchController is protected by AdminApiGuard. |
| Tenant resolution | Passed | /v1/search is included in tenant resolution middleware. |
| Tenant isolation | Passed | Conversation, knowledge-base, and knowledge-document queries each use the resolved tenant ID. |
| Query validation | Passed | q is 2-100 characters and limit is 1-10. |
| Safe response | Passed | Content previews are truncated to 160 characters and omit prompts, metadata, source locators, and secrets. |
| Frontend request | Passed | Admin Web uses /api/admin/search with active x-tenant-slug and 250 ms debounce. |
| Keyboard UX | Passed | Ctrl/Cmd+K, Arrow Up/Down, Enter, and Escape are covered by source regression. |
| Conversation deep link | Passed | Result URL carries status=all and conversationId; destination initializes the selected conversation. |
| Knowledge deep link | Passed | Result URL carries knowledgeBaseId/documentId; destination initializes the selected resource. |
| Runtime route | Passed | API health is 200 and unauthenticated search returns expected 401, proving route registration and auth enforcement. |

## 3. Automation

Passed full workspace typecheck, lint, test, build, and git diff --check. API provider-behavior contains the real search scope/guard/validation regression; several unrelated packages still report existing placeholder tests.

## 4. Remaining Manual Check

With the real mapped Clerk browser session, search a known conversation message and knowledge document, confirm grouped results render correctly in light/dark themes, and confirm each result opens the exact resource without console errors.


## 2026-06-18 Clerk Local Business Loop QA Status

## 1. Conclusion

Partial acceptance only. Real Clerk local login and mapped admin tenant access are working, but the original end-to-end business loop is not yet fully accepted.

Current QA conclusion: RETURN FOR FIXES.

## 2. Passed / Observed

| Check | Result | Notes |
| --- | --- | --- |
| Real Clerk login redirect | Passed | Local /sign-in opened the real Clerk Account Portal sign-in page and returned to local admin-web. |
| Server-side session establishment | Passed | Admin-web attempted to persist a Clerk-backed httpOnly admin session after token verification. |
| Unmapped access denial | Passed | Signed-in but unmapped state could not establish tenant admin access and returned 401/403 behavior. |
| First admin mapping | Passed | liangceli@kasta.com.au was mapped to Clerk user user_3FFi1oexYzioOpimfG1ExJcIDOc. |
| Mapped tenant admin access | Passed | After mapping, admin tenant API calls stopped returning repeated 403 responses. |
| Admin conversations route | Passed | Conversation operations moved to /admin/conversations. |
| Admin knowledge route | Passed | Knowledge Base, Ingest Data, chunks, and Answer Debug moved to /admin/knowledge-base. |

## 3. Automation Passed In This Round

- pnpm --filter @platform/admin-web typecheck
- pnpm --filter @platform/admin-web test
- pnpm --filter @platform/admin-web build
- pnpm --filter @platform/api typecheck
- pnpm --filter @platform/api test
- pnpm --filter @platform/api build
- git diff --check passed with Windows LF/CRLF warnings only.

## 4. Still Required Before READY

- Wrong-tenant access denial after mapped login.
- Knowledge Base create/import/read/chunk inspection on /admin/knowledge-base.
- Answer Debug hit/miss regression.
- Real OpenAI answer path if OpenAI mode is required for acceptance.
- Customer Widget grounded answer with citation.
- Customer Widget knowledge miss without fake citation.
- Customer requests human support.
- Admin/agent sees pending conversation and replies.
- Customer sees agent reply in the original widget session after refresh.
- Sign-out clears protected access.
- Full workspace pnpm typecheck, pnpm lint, pnpm test, pnpm build, git diff --check, and secret scan.

## 5. Risk Notes

- Clerk local auth is no longer the primary blocker.
- Final acceptance is blocked by incomplete end-to-end browser QA across Knowledge, Widget, handoff, and agent reply.
- Do not describe the project as READY until the full business loop is re-run and observed in the browser.


## 2026-06-17 Admin Conversations Page Split QA

## 1. Conclusion

Accepted for local route-level QA. Active Chats / ConversationOps has been moved from inline `/admin` dashboard content to the dedicated protected `/admin/conversations` route.

## 2. Scope Check

| Check | Result | Notes |
| --- | --- | --- |
| `/admin` dashboard separation | Passed | `AdminConsole` dashboard view renders dashboard/profile/knowledge content and no longer mounts `ConversationOpsPanel` inline. |
| `/admin/conversations` route | Passed | New protected route renders `AdminConsole` with `view="conversations"`. |
| Drawer navigation | Passed | `Conversations` navigates to `/admin/conversations`; `Dashboard` navigates back to `/admin`. |
| Auth boundary | Passed | The new route reuses existing Clerk/legacy protected route logic before rendering. |
| API contract | Passed | No backend API route or request/response contract changed. |

## 3. Verification

Passed:

- `pnpm --filter @platform/admin-web test`
- `pnpm --filter @platform/admin-web typecheck`
- `pnpm --filter @platform/admin-web build`
- `http://localhost:3000/admin` returned 200.
- `http://localhost:3000/admin/conversations` returned 200.
- `http://localhost:4000/v1/health` returned 200.

Note: in-app Browser visual verification was blocked by the Browser plugin security policy for `localhost:3000`, so this QA evidence is route/build/check based.

## 2026-06-17 Clerk Alpha Auth Code-Level QA

## 1. 总体结论

代码级 Clerk alpha auth 可以进入真实 Clerk 本地 smoke 前的人工配置阶段。

本轮补强后，admin-web Clerk session verifier 不再只依赖 token shape / exp 检查，而是要求 RS256 signature、`sub`、数值型未过期 `exp`、有效 optional `nbf`、optional issuer 和 authorized-party claims。`/api/auth/clerk/session` 的 forged JWT / invalid key / missing config 行为已用 handler-style 测试覆盖，rejected token 不会 set cookie。`/admin`、`/agent` 和 `/api/admin/...` 的 forged Clerk cookie 行为也已覆盖。

后端 `AdminApiGuard` 已补 forged signature、missing expiration、invalid `CLERK_JWT_KEY`、issuer mismatch、authorized-party mismatch、valid issuer/authorized-party、tenant role mapping、wrong tenant、platform admin gate 覆盖。

真实 Clerk local login smoke 尚未完成，阻塞点是用户还需要在 Clerk Dashboard 和本地 env 中配置真实项目值。不要把 secret 发到聊天。

## 2. Scope 检查

| 检查项 | 结果 | 说明 |
| --- | --- | --- |
| 当前 repo root | 通过 | `C:\Users\liangceli\HanecoAIPilot`。 |
| Git 状态 | 通过 | 进入本轮时 working tree clean，最新提交为 `0fd2603 Add Clerk alpha auth and deployment readiness docs & update skill files`。本轮产生新的未提交改动。 |
| `/api/auth/clerk/session` forged JWT 拒绝 | 通过 | Handler-style test 覆盖 401，且无 cookie set。 |
| missing Clerk verification config | 通过 | Session route 返回 500，且无 cookie set。 |
| invalid Clerk verification key | 通过 | Session route/API guard 安全失败，不输出 raw crypto error 或 secret。 |
| rejected token no cookie | 通过 | forged/missing/invalid config tests 均断言 no `Set-Cookie` call。 |
| `/admin` forged cookie | 通过 | Handler-style page test 确认 redirect `/sign-in?redirect_url=/admin`。 |
| `/agent` forged cookie | 通过 | Handler-style page test 确认 redirect `/sign-in?redirect_url=/agent`。 |
| `/api/admin/...` forged cookie | 通过 | Proxy returns 401 and does not call upstream fetch. |
| proxy Authorization forwarding | 通过 | Only verified Clerk cookie forwards `Authorization: Bearer <Clerk JWT>`; legacy fallback uses `x-admin-api-token` and no Authorization header. |
| backend Clerk guard | 通过 | Signature/claims verification and User + tenant Role mapping covered. |
| platform tenant list/create gate | 通过 | Platform-level no-tenant guard path rejects non-platform user and accepts `isPlatformAdmin=true`. |
| customer widget/chat public scope | 通过 | Code route map unchanged; customer routes remain outside Clerk/AdminApiGuard path. |
| secret exposure | 通过 | Browser code exposes only publishable Clerk key path; tests/source smoke reject secret env references in Clerk auth panel and debug panels. |

## 3. 验证结果

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
- `git diff --check`：通过，仅 Windows LF/CRLF warnings，无 whitespace error。

## 4. 剩余风险

- P0: none known.
- P1: real local Clerk login smoke is not done until the user completes Clerk Dashboard/env configuration.
- P2: admin-web runtime coverage is handler-style/transpiled rather than full browser/Next integration e2e.
- P2: production hardening should derive admin/agent acting user identity from verified auth context instead of request body `userId`.

## 5. QA 结论

No code fix request remains for Clerk code-level closeout. Continue only after the user confirms Clerk Dashboard and local env are configured.

## 1. 总体结论

可以进入人工验收

本轮 P1 已按要求修复。`/api/auth/clerk/session` 不再接受 merely token-shaped JWT；它会在设置 httpOnly Clerk session cookie 前调用 `verifyClerkSessionToken()` 做 RS256 签名和 claims 校验。`/admin`、`/agent` 和 `/api/admin/...` 也改为只接受 verified Clerk session cookie，legacy `/admin/access` + `ADMIN_API_TOKEN` fallback 保持 server-only。

后端 Clerk guard、tenant role mapping、platform admin gate、legacy token fallback 未发现被破坏。当前仍不能把本地 mock/test/build 结果当作 online alpha-ready evidence；真实 alpha 仍需要用户自有 Clerk、hosting、DB、CORS、OpenAI 和 external widget smoke。

## 2. Scope 检查

| 检查项 | 结果 | 说明 |
| --- | -- | -- |
| `/api/auth/clerk/session` forged JWT 拒绝 | 通过 | session route 先检查 verification config，再调用 `verifyClerkSessionToken()`，invalid token 返回 401，不设置 cookie。 |
| `/admin` route protection | 通过 | server component 调用 `verifyClerkSessionToken(clerkSessionCookie)`，失败时需要 valid legacy session，否则 redirect sign-in。 |
| `/agent` route protection | 通过 | 与 `/admin` 一致，forged Clerk cookie 不能渲染 protected UI。 |
| `/api/admin/...` proxy protection | 通过 | proxy 只有在 Clerk cookie 验签通过后才转发 `Authorization: Bearer <JWT>`；否则需要 valid legacy session + server-side `ADMIN_API_TOKEN`。 |
| Backend Clerk guard | 通过 | API guard 的 RS256 JWT verification、tenant role mapping、platform-admin requirement 保持不变。 |
| Tenant / role mapping | 通过 | tenant-scoped access 仍要求 mapped Role；platform routes 仍要求 `isPlatformAdmin`。 |
| Legacy token fallback | 通过 | legacy local/service fallback 保留；browser 仍不直接获得 `ADMIN_API_TOKEN`。 |
| Secret exposure | 通过 | 未发现 Clerk secret/JWT verification key/admin token/OpenAI key 进入 browser-facing code 或 API responses。 |
| Online alpha-ready claim | 通过 | docs/handoff 仍明确 local/mock 不是 online alpha evidence。 |

## 3. 文件级 Diff Review

| 文件 | 改动是否合理 | 风险等级 | 说明 |
| -- | ------ | ---- | -- |
| `apps/admin-web/app/lib/admin-access.ts` | 合理 | Medium | 新增 RS256 verifier，校验 signature、`exp`、`nbf`、可选 `iss`、可选 `azp`；替代 shape-only session helper。 |
| `apps/admin-web/app/api/auth/clerk/session/route.ts` | 合理 | Medium | 缺少 verification key 时返回 500；forged/invalid token 返回 401；只有 verified token 才写 httpOnly cookie。 |
| `apps/admin-web/app/admin/page.tsx` | 合理 | Low | verified Clerk session 或 valid legacy session 才渲染 admin UI。 |
| `apps/admin-web/app/agent/page.tsx` | 合理 | Low | verified Clerk session 或 valid legacy session 才渲染 agent UI。 |
| `apps/admin-web/app/api/admin/[...path]/route.ts` | 合理 | Medium | Clerk cookie 验证通过才 forward bearer；legacy fallback 仍 server-side 注入 `x-admin-api-token`。 |
| `apps/admin-web/middleware.ts` | 可接受 | Low | middleware 仍只是 cookie presence 快速 gate，但最终页面/proxy 会强验证；不再是唯一保护层。 |
| `apps/admin-web/scripts/admin-access.test.cjs` | 合理但偏轻 | Medium | source smoke 覆盖 verifier 使用和 shape-only helper 移除；建议后续加更接近 runtime 的 forged JWT route tests。 |
| `packages/config/src/index.ts` | 合理 | Low | admin-web env parser 增加 server-side Clerk verification keys。 |
| `apps/api/src/common/admin-protection/admin-api.guard.ts` | 未破坏 | Medium | 后端 guard 未被本轮破坏；仍是最终 tenant data protection 边界。 |
| `docs/skills/*`, `docs/runtime/clerk-alpha-auth-checklist.md` | 合理 | Low | 已记录 token shape/expiry 不足，admin-web 必须验签。 |

## 4. 发现的问题

| 问题 | 严重程度 | 是否必须修 | 建议处理方式 |
| -- | ---- | ----- | ------ |
| Admin-web forged JWT coverage 主要是 source smoke，不是 runtime route test | P2 nice to fix | 否 | 后续可增加 route-handler/unit test：forged JWT POST `/api/auth/clerk/session` 返回 401 且无 `Set-Cookie`。 |
| Backend Clerk guard issuer / authorized party 覆盖仍可加强 | P2 nice to fix | 否 | 代码已实现；建议补 positive/negative tests 覆盖 `CLERK_ISSUER` 和 `CLERK_AUTHORIZED_PARTIES`。 |

未发现新的 P0/P1 问题。No fix request required.

## 5. Regression 风险

- 如果 admin-web 部署环境缺少 `CLERK_JWT_KEY`，Clerk session bridge 会返回 500，`/admin`/`/agent` 也不会接受 Clerk cookie；这是安全失败，部署时必须配置。
- Legacy fallback 仍可让 valid `/admin/access` local/session cookie 进入 UI；staging/prod 必须按文档把它作为 fallback，而不是 primary auth。
- Middleware 仍可能让带任意 Clerk cookie 的 request 进入 page render 阶段，但 page/proxy 会重新验签并 redirect/401；不能把 middleware 本身当完整 auth evidence。
- `verifyClerkSessionToken()` 未做 tenant authorization；这是预期分层，tenant data 仍由 backend guard 的 role mapping 控制。
- 真实 Clerk JWT template 必须包含稳定 `sub`，并且 issuer/authorized party 必须与部署配置一致。

## 6. AI Chatbox 专项检查

本轮不直接修改 customer chat generation。

- message flow：未修改 customer send/AI reply path。
- conversation history：未修改。
- prompt handling：未修改 OpenAI prompt。
- streaming：Not applicable for this task.
- error handling：invalid Clerk session route 返回 401；missing admin-web verification config 返回 500；admin proxy 未授权返回 401。
- API key exposure：未发现 OpenAI/admin/Clerk secret 暴露。
- sensitive data/privacy：admin-web 只转发 verified bearer server-side；browser 仍走 same-origin `/api/admin/...`。
- user input validation：Clerk session POST body 只接受 string token，invalid JSON 返回 400。

## 7. 验证建议

QA 已执行并通过：

- `.\node_modules\.bin\pnpm.CMD --filter @platform/admin-web test`
- `.\node_modules\.bin\pnpm.CMD --filter @platform/admin-web typecheck`
- `.\node_modules\.bin\pnpm.CMD --filter @platform/api test`
- `.\node_modules\.bin\pnpm.CMD --filter @platform/api typecheck`
- `.\node_modules\.bin\pnpm.CMD --filter @platform/config typecheck`
- `.\node_modules\.bin\pnpm.CMD --filter @platform/admin-web build`
- `.\node_modules\.bin\pnpm.CMD --filter @platform/config build`
- `git diff --check`：无 whitespace error，仅 Windows LF/CRLF warning。

人工验收建议：

1. With no cookie，打开 `/admin` 和 `/agent`，应 redirect 到 `/sign-in`。
2. Forged token-shaped JWT POST `/api/auth/clerk/session`，应返回 401 且不设置 Clerk session cookie。
3. Forged Clerk cookie 访问 `/admin` / `/agent`，应 redirect sign-in，不能渲染 protected UI。
4. Forged Clerk cookie 调 `/api/admin/...`，应返回 401，不 forward bearer 到 API。
5. Legacy `/admin/access` local fallback 仍能在 local/dev 用 valid token 进入 UI。
6. Backend Clerk guard：unmapped user 403，mapped tenant user 只能访问 intended tenant，wrong tenant 403。

不能作为 online alpha-ready evidence：

- local `pnpm dev`
- source smoke tests
- mocked Clerk JWT tests
- fake/local admin tokens
- localhost widget smoke
- deterministic-only AI output
- 未部署 admin/API URL 的截图

online alpha-ready 必须等用户完成真实 Clerk/hosting/DB/CORS/OpenAI 配置，并通过 deployed admin-web/API、mapped tenant role、external widget embed smoke。

## 8. 是否需要更新 docs/skills

本轮 implementation 已同步相关 auth/frontend/QA/runtime docs。暂无必须补写项。

## 9. 给 Implementation Chat 的修复请求

No fix request required.
## 2026-06-19 Role Isolation and Theme QA

- PASS: Prisma migration applied for Clerk ids, typed tenant roles, membership status, invitations, and audit logs.
- PASS: API rejects suspended membership, wrong tenant, forged JWT, issuer mismatch, authorized-party mismatch, and unmapped access.
- PASS: Agent list queries include tenantId plus assigned-self/unassigned-pending row constraints.
- PASS: Widget signed sessions reject token tampering and wrong-tenant reuse.
- PASS: Tenant Owner cannot invite another Owner; only Platform Admin can issue Owner invitations.
- PASS: Admin Web same-origin session protection, CSP source assertions, account/invitation routes, and Clerk sign-out integration tests.
- PASS: Agent console resolves tenant from `/account/me`, reads `/tenant-profile`, and applies the shared theme token builder.
- PASS: Admin Web typecheck, test, and production build after theme propagation.
- PENDING: visual confirmation in a real authenticated Agent browser session; Codex browser list is empty in this session.
- PASS: Agent claim regression confirms the atomic claim predicate accepts only unassigned or already self-assigned conversations; UI disables reply/end before claim.
- PASS: expired/forged Clerk plus valid legacy session is rejected by both protected page and same-origin proxy; Admin production build and clean dev chunk checks pass.

## 2026-06-19 Public Entry and Invitation QA

Automated checks passed: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, targeted Admin/API tests, `git diff --check`, and targeted secret scan. The scan matched only the existing local PostgreSQL example default, not a real credential.

New regression coverage confirms matching Clerk email alone cannot bind an unaccepted account; invitation acceptance requires the verified Clerk email; Agent codes expire after 12 hours; creation fails at quota; quota accepts only 0-5 and is Platform Admin-only; shared sign-out clears both sessions and redirects home; and the homepage has no role control.

Browser smoke passed at 1280x720 and 390x844 with no horizontal overflow or detected control overlap. `/admin` without a valid session redirected to `/sign-in?redirect_url=%2Fadmin`; Clerk enabled the sign-in button and no browser console errors were observed.

Manual real-account QA remains required for invitation generation/acceptance, Platform Admin quota mutation, Owner-only tenant access, Agent-only inbox access, and logout from all three roles.
