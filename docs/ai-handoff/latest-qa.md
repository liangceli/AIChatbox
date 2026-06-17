# 中文 Diff Review & QA Report

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
