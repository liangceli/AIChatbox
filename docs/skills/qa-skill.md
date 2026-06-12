# QA Skill

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
- Admin drawer navigation should scroll/focus Dashboard, Knowledge Base, Conversations, and Settings; unimplemented items should show coming-soon feedback.
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
- Manual real-key smoke test remains pending until an OpenAI API key is available.

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
