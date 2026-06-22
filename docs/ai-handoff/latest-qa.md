# 中文 Diff Review & QA Report

## 2026-06-22 Avatar and Table Knowledge QA

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
