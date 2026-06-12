# Latest Implementation Handoff

## Latest P1 QA Follow-Up: Absolute URL Import Request Deadline

### Required Fix

- Replace the URL import socket inactivity timeout with a true 15-second absolute request deadline.
- Terminate requests even when a remote server continuously sends small chunks.
- Clear the deadline timer on every resolve/reject path and add a focused slow-trickle regression.

### Changed Files

| File | Change |
| --- | --- |
| `apps/api/src/modules/knowledge/knowledge-url-import.service.ts` | Adds an absolute per-request deadline, single-settle timer cleanup, and request/response destruction on deadline. |
| `apps/api/scripts/provider-behavior.test.ts` | Adds a local slow-trickle HTTP regression proving continuous chunks cannot bypass the total deadline. |
| `docs/skills/backend-skill.md`, `qa-skill.md`, `api-contract-skill.md`, `current-status.md` | Clarifies that URL import uses an absolute deadline rather than an inactivity timeout. |
| `docs/ai-handoff/latest-implementation.md` | Adds this P1 follow-up handoff. |

### Behavior Notes

- Every URL import outbound request has a 15-second deadline measured from immediately before the request is sent.
- Deadline expiry destroys both the active response and request, then returns the existing safe URL-fetch error through `KnowledgeUrlImportService`.
- Success, request error, response error, size-limit failure, deadline expiry, synchronous request creation failure, and synchronous request-send failure all settle once and clear the deadline timer.
- Existing URL validation, redirect validation, DNS pinning, response-size limit, API shape, admin protection, tenant scoping, and safe public import behavior remain unchanged.

### Verification

| Command / Check | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @platform/api typecheck` | Passed | Absolute deadline implementation compiles. |
| `pnpm --filter @platform/api lint` | Passed | Current lightweight TypeScript lint/sanity check. |
| `pnpm --filter @platform/api test` | Passed | Includes slow-trickle absolute-deadline regression. |
| `pnpm --filter @platform/api build` | Passed | Production API compilation passed. |
| `pnpm typecheck` | Passed | 11/11 workspace packages. |
| `pnpm lint` | Passed | 11/11 workspace packages. |
| `pnpm test` | Passed | 11/11 workspace tasks. |
| `pnpm build` | Passed | 11/11 workspace packages, including Admin-Web production build. |
| `git diff --check` | Passed with warnings | No whitespace errors; existing Windows LF-to-CRLF warnings remain. |

### Remaining Manual QA

- Import a known public HTTP(S) HTML/text URL in a normal network environment.
- Confirm a deliberately slow endpoint returns a safe failure after about 15 seconds.

## Latest P1 QA Fix: Knowledge URL Import SSRF Protection

### Required Fix

- Fix the P1 URL-import SSRF risk identified in `docs/ai-handoff/latest-qa.md`.
- Validate the initial target and every redirect server-side.
- Reject loopback/private/link-local/cloud-metadata and other non-public targets while preserving safe public HTTP(S) imports.

### Changed Files

| File | Change |
| --- | --- |
| `apps/api/src/modules/knowledge/knowledge-url-safety.service.ts` | Adds URL parsing, hostname/DNS validation, restricted IPv4/IPv6 detection, and validated public-address resolution. |
| `apps/api/src/modules/knowledge/knowledge-url-import.service.ts` | Adds manual redirect handling, per-hop validation, DNS-pinned HTTP(S) requests, response-size/timeout limits, safe errors, and existing HTML/text extraction. |
| `apps/api/src/modules/knowledge/knowledge.service.ts` | Routes URL import through the new safe import service instead of unrestricted global `fetch`. |
| `apps/api/src/modules/knowledge/knowledge.module.ts` | Registers the URL safety/import services. |
| `apps/api/scripts/provider-behavior.test.ts` | Adds focused SSRF and safe-public-import regressions. |
| `docs/skills/backend-skill.md`, `qa-skill.md`, `deployment-skill.md`, `api-contract-skill.md`, `current-status.md` | Records the URL import security contract, regression gate, and current status. |
| `docs/runtime/alpha-knowledge-qa-checklist.md` | Adds manual public/restricted URL import checks. |
| `docs/ai-handoff/latest-implementation.md` | Adds this P1 fix handoff. |

### Behavior And Security Notes

- URL import accepts only public `http:` and `https:` URLs and rejects embedded credentials.
- Initial URL and every redirect target are validated before requesting.
- Local/internal/metadata hostnames, loopback, RFC1918 private, carrier-grade NAT, link-local/cloud-metadata, reserved/documentation IPv4, non-public/special IPv6, and any DNS hostname returning a restricted address are rejected.
- Each outbound request is pinned to an address returned by the successful safety validation, avoiding a second unvalidated DNS lookup.
- Redirects are handled manually and limited to five.
- URL responses are limited to 2 MB and each outbound request has a true 15-second absolute deadline.
- Raw network errors are not returned to the caller.
- Existing safe public HTML/text parsing, URL import API shapes, admin protection, tenant scoping, and product-neutral user-agent remain unchanged.
- No new dependency, Prisma schema change, or migration was added.

### Focused Regression Coverage

- Rejects localhost, IPv4/IPv6 loopback, IPv4-mapped loopback, RFC1918, carrier-grade NAT, link-local/cloud metadata, Azure platform IP, metadata hostname, private DNS result, mixed public/private DNS result, embedded credentials, and non-HTTP(S).
- Rejects a public URL redirecting to link-local cloud metadata before sending the restricted request.
- Preserves a safe public redirect and HTML import.
- Confirms representative public IPv4/IPv6 remain allowed and restricted IPv4/IPv6 remain blocked.
- Confirms DNS-pinned requests support Node's all-address lookup mode used by the current runtime.

### Verification

| Command / Check | Result | Notes |
| --- | --- | --- |
| Initial focused API typecheck | Failed, then fixed | Node DNS address family needed explicit 4/6 validation/type narrowing; corrected before final verification. |
| `pnpm --filter @platform/api typecheck` | Passed | New services and integration compile. |
| `pnpm --filter @platform/api lint` | Passed | Current lightweight TypeScript lint/sanity check. |
| `pnpm --filter @platform/api test` | Passed | Includes focused SSRF regressions and all existing provider/retrieval/handoff tests. |
| `pnpm --filter @platform/api build` | Passed | Safe URL import services compile for production. |
| `pnpm typecheck` | Passed | 11/11 workspace packages. |
| `pnpm lint` | Passed | 11/11 workspace packages. |
| `pnpm test` | Passed | 11/11 workspace tasks; several packages remain placeholder tests. |
| Protected URL-import route smoke | Passed | Protected knowledge-base list returned `200`; importing `http://127.0.0.1:4000/...` was rejected with `400`. No token or response body was printed. |
| Direct external safe-public import smoke | Blocked by environment | The sandbox denied outbound `https://example.com` with `EACCES`; native `fetch` failed the same way. Safe public redirect/HTML and Node multi-address lookup remain covered by focused regressions. |
| `git diff --check` | Passed with warnings | No whitespace errors; existing Windows LF-to-CRLF warnings remain. |
| Full workspace/Admin-Web build | Not run | Active local dev listeners on ports 3000/4000; skipped because this backend-only P1 does not change Admin-Web and to avoid Next `.next` dev/build interference. |

### Remaining Manual QA

- Import a known public HTTP(S) HTML/text URL and confirm normal ingestion.
- Confirm localhost/private/link-local/metadata and restricted redirect attempts return a safe error.
- Keep deployment-level egress denial for internal/metadata networks as defense in depth.

## Latest Task: Knowledge Answer Debug Panel And Knowledge Base UX Polish

### Original Task Brief Summary

- Add an admin-protected, tenant-scoped Answer Debug capability that explains current retrieval/provider/citation/fallback behavior without exposing secrets or creating customer-visible conversations.
- Add a practical Admin-Web Answer Debug panel through the existing server-side `/api/admin/...` proxy.
- Improve Knowledge Base document/source/status/chunk/action visibility for alpha QA.
- Keep deterministic as default, OpenAI opt-in, automated OpenAI tests mocked, and existing chat/handoff/customer scope unchanged.
- Update affected skills, runtime QA docs, and this handoff.

### Changed Files

| File | Change |
| --- | --- |
| `apps/api/src/modules/chat/answer-debug.controller.ts` | Adds protected `POST /v1/chat/answer-debug`. |
| `apps/api/src/modules/chat/answer-debug.service.ts` | Adds non-persistent tenant-scoped retrieval/provider debug orchestration and explicit response sanitization. |
| `apps/api/src/modules/chat/dto/run-answer-debug.dto.ts` | Validates debug question length/content. |
| `apps/api/src/modules/chat/chat.module.ts` | Registers Answer Debug controller/service and `AdminApiGuard`. |
| `apps/api/src/modules/knowledge/knowledge.presenter.ts` | Returns the existing document checksum in admin knowledge records. |
| `apps/api/scripts/provider-behavior.test.ts` | Adds guard, tenant-scope, hit/miss, non-persistence, citation, and secret-sanitization regressions. |
| `packages/types/src/index.ts` | Adds Answer Debug request/result contracts and optional knowledge document checksum. |
| `apps/admin-web/app/components/answer-debug-panel.tsx` | Adds the practical Answer Debug admin UI with idle/loading/error/success states. |
| `apps/admin-web/app/components/knowledge-base-panel.tsx` | Adds document list/detail/chunk inspection, URL import, and reprocess/archive/delete feedback. |
| `apps/admin-web/app/globals.css` | Adds responsive focused styles and interaction feedback for knowledge/debug surfaces. |
| `apps/admin-web/scripts/admin-access.test.cjs` | Adds lightweight source smoke checks for debug/knowledge UI and browser-secret exclusions. |
| `docs/runtime/alpha-knowledge-qa-checklist.md` | Adds alpha knowledge and real OpenAI manual QA checklist. |
| `docs/runtime/openai-enable-checklist.md`, `docs/runtime/alpha-runtime-checklist.md` | Adds Answer Debug real-provider and alpha route/knowledge smoke flow. |
| `docs/skills/*` affected AI/backend/frontend/API/QA/deployment/status/decision/summary files | Records current Answer Debug, knowledge UX, safety, and manual real-provider gate. |
| `docs/ai-handoff/latest-implementation.md` | Adds this implementation handoff. |

### Implementation Summary

- `POST /v1/chat/answer-debug` uses the existing `/v1/chat` tenant middleware and class-level `AdminApiGuard`.
- `AnswerDebugService` reads the resolved tenant's AgentConfig, calls `KnowledgeRetrievalService`, resolves the configured provider through `LlmProviderResolverService`, and generates a test answer using a non-persistent debug conversation context.
- No customer, conversation, message, or debug database record is created.
- Provider metadata and citations are rebuilt through explicit allowlists before returning.
- Debug response includes tenant slug/display name, question, answer, answer source, knowledge hit/miss reason/counts, requested/used provider mode, fallback state, safe provider metadata, bounded chunk previews/scores, and sanitized backend citations.
- Knowledge document checksum visibility uses the existing Prisma field; no schema or migration changed.

### User-Visible Changes

- `/admin` Knowledge Base now shows selected knowledge base documents with source, status, chunk count, and latest ingestion/update time.
- Selecting a document shows checksum, lifecycle actions, and admin-only chunk previews.
- File upload and URL import are explicit supported ingestion choices.
- Reprocess/archive/delete show loading, success, safe error, empty, and confirmation feedback.
- Answer Debug lets the admin run a tenant test question and inspect generated answer, knowledge hit/miss reason, chunks/scores, citations, provider mode, fallback state, and safe provider metadata.

### API And Security Notes

- New protected route: `POST /v1/chat/answer-debug`.
- Admin-Web path: browser calls same-origin `POST /api/admin/chat/answer-debug`; existing server proxy injects backend admin protection server-side.
- The response intentionally omits tenant IDs, raw prompts, hidden instructions/rules, auth headers, OpenAI/API/admin/access/session tokens, provider secret config, full provider request bodies, and citation `sourceLocator`.
- Retrieved chunk content is bounded to a 600-character admin-only preview; citation excerpts are bounded to 240 characters.
- Existing customer chat/widget, customer-scoped realtime/read, provider fallback, citation, tenant profile, handoff, and `PENDING_HUMAN` behavior were not changed.

### External And Manual Requirements

To intentionally verify real OpenAI, the user must set these only in local uncommitted `.env` or a secret manager, never in chat or Git:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=<real key>
OPENAI_MODEL=<chosen real model>
```

Then run:

```bash
pnpm --filter @platform/api smoke:openai
```

After smoke success, run a knowledge-backed question in `/admin` Answer Debug and verify OpenAI mode, answer, retrieved chunks, citations, safe metadata, and fallback state. Fake/test/local-only tokens are not alpha acceptance evidence.

The current local runtime Answer Debug smoke returned a successful OpenAI-mode answer with retrieved chunks and citations, without returning configured secrets. The dedicated `smoke:openai` command and final manual real-provider acceptance still remain user/QA actions.

### Verification Results

| Command / Check | Result | Notes |
| --- | --- | --- |
| `pnpm typecheck` | Passed | 11/11 workspace packages. |
| `pnpm lint` | Passed | 11/11 workspace packages; current lint remains TypeScript sanity checks. |
| `pnpm test` | Passed | 11/11 tasks; API includes new focused Answer Debug regressions, several packages remain placeholders. |
| `pnpm --filter @platform/api build` | Passed | New controller/service/DTO compile. |
| `pnpm --filter @platform/types build` | Passed | Shared Answer Debug/checksum contracts compile. |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Knowledge/debug UI compiles after archive response-shape fix. |
| `pnpm --filter @platform/admin-web lint` | Passed | Current lightweight lint/TypeScript check. |
| `pnpm --filter @platform/admin-web test` | Passed | Includes debug panel/knowledge feature source smoke and browser-secret exclusions. |
| Initial focused API test run | Failed, then fixed | Task-introduced classification order returned `provider_fallback` instead of `knowledge_miss` for a no-chunk deterministic fallback; logic was corrected and final focused/workspace tests pass. |
| Direct API missing token smoke | Passed | `POST /v1/chat/answer-debug` returned 401. |
| Direct API valid token smoke | Passed | Returned 201; response comparison found no configured Admin/OpenAI secret. |
| Admin-Web access/proxy smoke | Passed | Access route returned 200 and `/api/admin/chat/answer-debug` returned 201. |
| Live debug safe-field smoke | Passed | Answer/chunks/citations/provider fields present; no tenant ID/raw prompt/auth header/configured secret in response. |
| Live `/admin` HTML smoke | Passed | Returned 200, includes Answer Debug/Knowledge Bases, excludes configured Admin/OpenAI secrets. |
| `git diff --check` | Passed with warnings | No whitespace errors; existing Windows LF-to-CRLF warnings remain. |
| Admin-Web/full workspace build | Not run | Ports 3000/4000 had active dev services; skipped to avoid Next dev/build `.next` corruption. |
| Browser visual smoke | Blocked | In-app browser was unavailable in the current environment. |
| `pnpm --filter @platform/api smoke:openai` | Not run | Must remain an explicit user/manual real-key acceptance step. |

Two initial local HTTP smoke command forms could not start because root `node` could not resolve `dotenv` and a root `tsx.CMD` shim was absent. The smoke was rerun successfully through `pnpm --filter @platform/api exec tsx`; these were local invocation issues, not application failures.

### Manual QA Suggestions

- On desktop and mobile, open `/admin`, inspect knowledge documents/chunks, and confirm no overlap or broken responsive layout.
- Test file upload and URL import success/error states.
- Reprocess a READY document, archive it, confirm it no longer retrieves, and delete a disposable document.
- Run a deterministic knowledge-hit and knowledge-miss Answer Debug question.
- Confirm browser network responses never contain admin/OpenAI secrets, raw prompts, hidden rules, tenant IDs, or auth headers.
- Complete `docs/runtime/alpha-knowledge-qa-checklist.md`.
- Run the dedicated real OpenAI smoke and repeat a knowledge-backed Answer Debug question under manual QA.

### Risks / Notes

- Retrieval is still deterministic keyword/phrase scoring, not embeddings/vector search/reranking.
- Chunk previews expose tenant knowledge to admin users by design; production auth/RBAC must replace the alpha token gate before production.
- Knowledge actions are synchronous and can take time for large documents/URLs.
- No frontend component/browser automation framework exists; Admin-Web tests remain lightweight and visual/mobile acceptance is manual.
- Full admin-web production build remains to be rerun after stopping active dev services.

### Docs Update Suggestions

- Affected skills and runtime docs were updated in this task.
- Codex Chat 3 should review this handoff/current diff, run the manual knowledge checklist, and guide the user through the dedicated real OpenAI smoke without requesting any secret value.

## Latest P1 QA Follow-Up: Branding Logo Clear And Handoff Activity Time

### Task Summary

- Fix explicit-null Logo removal so a saved clear operation stops tenant-branding Logo fallback after reload.
- Fix provider-time human handoff suppression so it preserves the newer handoff activity timestamp instead of moving `lastMessageAt` backwards.
- Add focused regressions and sync affected skills.

### Changed Files

| File | Change |
| --- | --- |
| `apps/api/src/modules/tenants/tenant-ai-profile.ts` | Logo and Avatar resolution now distinguish `undefined` from explicit `null`; `undefined` continues fallback, while `null` stops fallback and preserves the clear operation. |
| `apps/api/src/modules/chat/chat.service.ts` | Post-provider `PENDING_HUMAN` suppression now returns the latest persisted conversation without updating it, preserving handoff status and its newer `lastMessageAt`. |
| `apps/api/scripts/provider-behavior.test.ts` | Adds tenant-branding Logo clear/reload coverage and asserts provider-time handoff suppression does not update the conversation or move `lastMessageAt` backwards. |
| `docs/skills/ai-chatbox-skill.md` | Records the post-provider handoff activity-time invariant. |
| `docs/skills/backend-skill.md` | Records nullable media fallback and monotonic `lastMessageAt` behavior. |
| `docs/skills/frontend-skill.md` | Clarifies that Remove remains cleared after all backend fallback sources are considered. |
| `docs/skills/api-contract-skill.md` | Clarifies explicit-null media behavior. |
| `docs/skills/qa-skill.md` | Adds both focused regression expectations. |
| `docs/ai-handoff/latest-implementation.md` | Adds this final P1 follow-up record. |

### Behavior Notes

- `logoUrl: null` and `avatarUrl: null` are explicit clear values. They stop older AgentConfig/widget/tenant-branding media fallback after save and reload.
- Missing/`undefined` media values still allow normal fallback to compatible older sources.
- If human support starts while an AI provider is running, the generated AI result is discarded and the latest persisted `PENDING_HUMAN` conversation is returned unchanged.
- The post-provider suppression branch no longer writes the earlier customer-message timestamp over the later handoff event timestamp.
- No auth, route, Prisma schema, provider selection, retrieval, citation, or widget request contract changed.

### Verification

| Command / Check | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @platform/api test` | Passed | Includes tenant-branding Logo clear/reload and provider-time handoff `lastMessageAt` regression assertions. |
| `pnpm --filter @platform/api typecheck` | Passed | Nullable fallback helper and chat suppression changes compile. |
| `pnpm --filter @platform/api lint` | Passed | Current lightweight lint/TypeScript sanity check succeeds. |
| `pnpm --filter @platform/api build` | Passed | API production TypeScript build succeeds. |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Existing profile UI contract remains compatible. |
| `pnpm --filter @platform/admin-web lint` | Passed | Current lightweight lint/TypeScript sanity check succeeds. |
| `pnpm --filter @platform/admin-web test` | Passed | Existing admin-web access regressions remain green. |
| `pnpm --filter @platform/admin-web build` | Passed | Next.js production build succeeds. |
| `git diff --check` | Passed with line-ending warnings | No whitespace errors; existing Windows LF-to-CRLF warnings remain. |

### Remaining Manual QA

- For a tenant with `tenant.branding.logoUrl`, remove Logo in `/admin`, save, reload, and confirm the old branding Logo does not return.
- With a slow provider request in flight, enable Human Mode and confirm no AI reply appears and the conversation remains at the handoff event's latest activity position.

## Latest P1 Follow-Up: Provider-Time Human Handoff And Media Removal Persistence

### Task Summary

- Fix the in-flight race where human support can start while an AI provider is generating a reply.
- Fix Avatar/Logo Remove so clearing saved media persists instead of retaining the previous value.
- Add focused regressions and sync affected skills.

### Changed Files

| File | Change |
| --- | --- |
| `apps/api/src/modules/chat/chat.service.ts` | Re-checks persisted conversation status after provider completion and before assistant-message persistence. If human mode started during generation, the customer message remains saved, no assistant message is written, and `PENDING_HUMAN` is preserved. |
| `apps/api/src/modules/tenants/dto/update-tenant-ai-profile.dto.ts` | Declares `logoUrl` and `avatarUrl` as nullable optional update fields so explicit removal is part of the API contract. |
| `apps/admin-web/app/components/tenant-ai-profile-panel.tsx` | Sends `null` for cleared Logo/Avatar fields instead of converting empty form values to `undefined`. |
| `apps/api/scripts/provider-behavior.test.ts` | Adds provider-time handoff and explicit media-clear regressions. |
| `docs/skills/ai-chatbox-skill.md` | Records the provider-completion human-mode recheck. |
| `docs/skills/backend-skill.md` | Records the backend persistence invariant and nullable media clearing. |
| `docs/skills/frontend-skill.md` | Records Remove-to-`null` behavior. |
| `docs/skills/api-contract-skill.md` | Records explicit `null` media-clear semantics. |
| `docs/skills/qa-skill.md` | Adds focused regression expectations. |
| `docs/ai-handoff/latest-implementation.md` | Adds this implementation handoff. |

### Behavior Notes

- A customer message that began while AI mode was active can still trigger provider generation, but if the conversation becomes `PENDING_HUMAN` before the provider returns, the generated AI reply is discarded and never persisted.
- The post-provider human-mode branch updates only `lastMessageAt`; it does not overwrite the human-support status.
- Removing an uploaded or URL-based Avatar/Logo now sends explicit `null`, which the existing profile merge and AgentConfig persistence paths store as cleared media.
- No auth, route, Prisma schema, provider-selection, retrieval, citation, or customer-widget contract was changed.

### Verification

| Command / Check | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @platform/api typecheck` | Passed | Chat race fix, nullable DTO fields, and focused tests compile. |
| `pnpm --filter @platform/api test` | Passed | Includes provider-time switch to `PENDING_HUMAN` and media save/remove persistence regressions. |
| `pnpm --filter @platform/api build` | Passed | API production TypeScript build succeeds. |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Explicit-null profile update payload compiles. |
| `pnpm --filter @platform/admin-web test` | Passed | Existing admin access tests remain green. |
| `pnpm --filter @platform/admin-web build` | Passed | Next.js production build succeeds. |
| `pnpm --filter @platform/api lint` | Blocked by local tool sandbox | Command could not start: `windows sandbox: spawn setup refresh`; this is an execution-environment failure, not a reported lint finding. |
| `pnpm --filter @platform/admin-web lint` | Blocked by local tool sandbox | Command could not start: `windows sandbox: spawn setup refresh`; this is an execution-environment failure, not a reported lint finding. |
| `git diff --check` | Passed with line-ending warnings | No whitespace errors; existing Windows LF-to-CRLF warnings remain. |

### Remaining Manual QA

- Start a customer send against a deliberately slow provider, enable human mode before the provider completes, and confirm no assistant reply appears and status remains `pending_human`.
- Save an Avatar and Logo, remove each, save, reload `/admin`, and confirm both remain empty.
- Confirm a normal AI-mode conversation still persists assistant replies when no handoff occurs during generation.

### Risks / Notes

- The post-provider protection follows the accepted QA requirement to re-read persisted state immediately before assistant persistence. A future high-concurrency hardening pass may use an atomic conditional state claim if stronger database-level serialization is required.
- Media clearing intentionally uses `null`; omitted/`undefined` fields continue to mean no update.

## Latest Follow-Up: Viewport-Fixed Admin Top Menu

Task request:

- Keep the top admin menu fixed to the top of the page while the user scrolls.

Changed files:

| File | Why it changed |
| -- | -- |
| `apps/admin-web/app/components/admin-console.tsx` | Moved the top menu outside the scroll-content container so content scrolling and future container transforms cannot affect its viewport-fixed position. |
| `apps/admin-web/app/globals.css` | Added one shared topbar-height variable, viewport inset/width rules, and matching content offset for desktop and mobile. |
| `docs/skills/frontend-skill.md` | Documented the fixed-menu structural invariant. |
| `docs/skills/qa-skill.md` | Added fixed-menu desktop/mobile scroll checks. |
| `docs/ai-handoff/latest-implementation.md` | Added this follow-up summary. |

Behavior:

- `.admin-topbar` is a viewport-level sibling of `.admin-screen`, not a child of the scrolling content container.
- The menu uses `position: fixed`, `inset: 0 0 auto`, full viewport width, and a stable `64px` height.
- `.admin-screen` reserves the same shared height so content never slides under the fixed menu.
- Desktop and mobile use the same fixed positioning behavior.

Verification:

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Updated component structure compiles. |
| `pnpm --filter @platform/admin-web test` | Passed | Existing admin access tests remain green. |
| `pnpm --filter @platform/admin-web build` | Passed | Production build passed. |
| Live local `/admin` structure/CSS smoke | Passed | Topbar renders before `.admin-screen`; live CSS contains fixed viewport inset and matching content offset. |
| `git diff --check` | Passed | No whitespace errors; repository line-ending warnings remain. |

Manual QA remaining:

- Open `/admin`, scroll to AI Profile, Knowledge Base, and Conversations, and confirm the menu remains at the viewport top.
- Repeat on a narrow mobile viewport and while opening/closing the navigation drawer.
- Confirm the first content section is not covered by the fixed menu.

## Latest Follow-Up: Visible Brand Palette And Upload-First Media Controls

Task request:

- Make Primary Color understandable without requiring customers to know a hex code.
- Let Logo and Avatar use either uploaded images or URLs, with upload as the primary action.

Changed files:

| File | Why it changed |
| -- | -- |
| `apps/admin-web/app/components/tenant-ai-profile-panel.tsx` | Added a visible custom-color preview, eight clickable color presets, upload-first Logo/Avatar cards, previews/remove actions, and always-visible secondary URL inputs. |
| `apps/admin-web/app/globals.css` | Added responsive palette, selected/hover swatch feedback, larger color preview, and clear upload-primary/URL-secondary layout styling. |
| `docs/skills/frontend-skill.md` | Synced the refined AI Profile media UI behavior. |
| `docs/skills/qa-skill.md` | Added manual checks for presets, custom color, upload, preview, remove, and URL fallback. |
| `docs/ai-handoff/latest-implementation.md` | Added this follow-up summary. |

User-visible behavior:

- Primary Color now shows the currently selected color, a native custom color picker, eight visible preset swatches, and an editable hex value.
- Avatar and Logo each show an upload card as the main action, including image preview and remove controls.
- The secondary image URL input is always visible beneath each upload card instead of being hidden in a collapsed control.
- Mobile layouts reduce the palette to four swatches per row.

Verification:

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/admin-web typecheck` | Passed | New palette and upload-first controls compile. |
| `pnpm --filter @platform/admin-web test` | Passed | Existing admin access tests remain green. |
| `pnpm --filter @platform/admin-web build` | Passed | Production build contains the new palette, upload, and URL fallback labels. |
| Live local `/admin` HTML smoke | Passed | After restarting only admin-web on port 3000, the live page contains `Primary color presets`, `Choose image`, and `Or use image URL`. |
| `git diff --check` | Passed | No whitespace errors; repository line-ending warning remains. |
| Browser visual smoke | Pending manual QA | In-app browser control could not start in the current Windows sandbox. |

Manual QA remaining:

- Refresh `http://localhost:3000/admin` after restarting `pnpm dev` if the old layout remains cached.
- Click preset swatches and the custom picker; confirm the visible color and hex value stay synchronized.
- Upload, preview, remove, save, and reload both Avatar and Logo.
- Enter an http/https image URL and confirm it replaces the uploaded preview after save.
- Check the palette and upload cards on desktop and mobile.

## Latest Follow-Up: Human Mode Status Recheck After Agent Reply

Task request:

- After a customer transfers to human support, an agent reply must not allow the next customer message to receive an AI reply.
- Human support must remain active until the customer or an admin/agent explicitly ends it.

Changed files:

| File | Why it changed |
| -- | -- |
| `apps/api/src/modules/chat/chat.service.ts` | Re-reads the latest conversation status after saving the customer message, so an in-flight agent reply or human-mode start cannot leave chat using a stale pre-handoff status. |
| `apps/api/scripts/provider-behavior.test.ts` | Updated the pending-human regression to simulate a stale initial status followed by the latest `PENDING_HUMAN` state after an agent reply; asserts the customer message is saved and no provider/AI reply runs. |
| `docs/skills/ai-chatbox-skill.md` | Documented the latest-status recheck invariant. |
| `docs/skills/backend-skill.md` | Documented the backend stale-status protection. |
| `docs/skills/qa-skill.md` | Added the exact agent-reply-then-customer-message regression check. |
| `docs/ai-handoff/latest-implementation.md` | Added this follow-up summary. |

Behavior:

- Agent replies continue to keep the conversation in `PENDING_HUMAN`.
- After a customer message is saved, `ChatService` checks the latest persisted conversation status before resolving or calling an AI provider.
- If the latest status is `PENDING_HUMAN`, the customer message remains visible to the agent, `assistantMessage` is `null`, and AI stays paused.
- AI resumes only after the customer uses `handoff/end` or an admin/agent uses protected `human-support/end`.
- Existing customer and admin/agent start/end controls remain unchanged.

Verification:

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/api typecheck` | Passed | Latest-status recheck compiles. |
| `pnpm --filter @platform/api test` | Passed | Includes stale initial status followed by latest `PENDING_HUMAN`; provider is not called and `assistantMessage` is null. |
| `pnpm --filter @platform/api build` | Passed | API production build passed. |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Existing admin/agent Human Mode controls remain valid. |
| `pnpm --filter @platform/customer-widget typecheck` | Passed | Existing customer End human control remains valid. |
| `pnpm --filter @platform/types typecheck` | Passed | Nullable human-mode assistant response contract remains valid. |
| `git diff --check` | Passed | No whitespace errors; repository line-ending warnings remain. |

Manual QA remaining:

- Restart `pnpm dev` if an older API process is still running.
- Customer sends a message, requests human support, and confirms status is `pending_human`.
- Agent replies once; confirm status remains `pending_human`.
- Customer sends another message; confirm the message appears for the agent and no new AI message appears.
- Customer clicks End human, then sends another message; confirm AI can reply again.
- Repeat using the admin/agent Human Mode Start and End controls.

## 0. Latest Follow-Up: Admin Interaction, Human Reply History, And Profile Media UX

Task request:

- Add visible hover/animation feedback to admin modules and controls.
- Keep the top menu fixed while the page scrolls.
- Render the selected conversation's complete customer/AI/agent/system history inside Human Reply regardless of handoff status.
- Replace the Primary Color text-only experience with a visible color picker.
- Make Logo and Avatar upload-first while preserving URL input.

Changed files:

| File | Why it changed |
| -- | -- |
| `apps/admin-web/app/components/conversation-ops-panel.tsx` | Moved complete chronological history into Human Reply and disabled reply controls until a conversation is selected. |
| `apps/admin-web/app/components/tenant-ai-profile-panel.tsx` | Added native color picker and upload-first Avatar/Logo controls with preview, remove, URL fallback, image type checks, and 1 MB client limit. |
| `apps/admin-web/app/globals.css` | Added fixed topbar layout, module hover/active/entry feedback, reduced-motion handling, upload/color styles, and dark Human Reply history styling. |
| `apps/api/src/main.ts` | Added an explicit 2 MB JSON/urlencoded request-body limit so validated image data URLs up to the frontend's 1 MB file limit reach DTO validation. |
| `apps/api/src/modules/tenants/dto/update-tenant-ai-profile.dto.ts` | Allows validated http/https image URLs or PNG/JPEG/WebP/GIF data URLs while rejecting unsafe/oversized sources. |
| `apps/api/scripts/provider-behavior.test.ts` | Added valid image data URL and invalid non-image data URL validation cases. |
| `docs/skills/*` | Synced frontend/backend/API/QA behavior notes. |
| `docs/ai-handoff/latest-implementation.md` | Added this follow-up summary. |

Implementation summary:

- `.admin-topbar` is now fixed; `.admin-screen` reserves its height so page content does not slide behind it.
- Dashboard modules, cards, tables, conversation rows, history messages, buttons, and agent surfaces have restrained hover/active/entry feedback.
- `prefers-reduced-motion` disables meaningful animation.
- Human Reply now contains the full selected conversation history and displays it for all conversation statuses.
- Primary Color uses a native browser palette plus hex input.
- Avatar/Logo upload supports PNG/JPEG/WebP/GIF up to 1 MB, previews the selected media, and persists it through the existing protected AI Profile endpoint as a validated data image URL.
- API request parsing uses an explicit bounded 2 MB limit so those validated image data URLs are not rejected by the framework's smaller default body limit.
- Existing http/https Avatar/Logo URL input remains available as a secondary option.
- No new dependency, object storage, Prisma schema, or migration was added.

Verification:

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/api test` | Passed | Includes valid image data URL and invalid non-image data URL checks. |
| `pnpm --filter @platform/api typecheck` | Passed | Tenant profile image validation compiles. |
| `pnpm --filter @platform/api build` | Passed | API production build passed. |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Profile upload/color controls and Human Reply history compile. |
| `pnpm --filter @platform/admin-web test` | Passed | Existing admin access tests remain green. |
| `pnpm --filter @platform/admin-web build` | Passed | Next production build passed. |
| Local dev readiness | Passed | `http://localhost:3000/admin/access` and `http://localhost:4000/v1/health` returned 200. |
| `scripts/smoke-admin-web-access.ps1 -Port 3000` | Passed | Returned only `admin-access-status=200`. |
| Browser visual/hover smoke | Pending manual QA | Browser/Playwright tooling was not available in this Codex session. |

Manual QA remaining:

- Start `pnpm dev`, unlock `/admin/access`, and open `/admin`.
- Scroll the page and confirm the topbar remains fixed without covering content.
- Hover statistics, AI Profile, knowledge, conversation, metadata, Human Mode, Human Reply, list rows, and buttons; confirm visible feedback without layout shifts or overlap.
- Select both normal and `pending_human` conversations and confirm Human Reply shows the complete chronological history.
- Use the Primary Color palette and confirm the hex value/widget profile save update.
- Upload valid Avatar/Logo images, save/reload, and confirm previews persist.
- Confirm invalid/oversized uploads fail clearly and URL fallback still works.
- Check desktop/mobile layouts and reduced-motion behavior.

## 0A. Previous Follow-Up: Persistent Human Support Mode

Task request:

- After customer handoff, agent replies must not automatically return the conversation to AI.
- Human support should remain active until the customer explicitly ends it.
- Admin/agent console also needs explicit start/end human support controls.
- Keep existing admin token/proxy behavior unchanged and do not redesign auth/RBAC.

Changed files for this follow-up:

| File | Why it changed |
| -- | -- |
| `apps/api/src/modules/chat/chat.service.ts` | During `PENDING_HUMAN`, customer messages are saved, `assistantMessage` is `null`, and deterministic/OpenAI providers are not called. |
| `apps/api/src/modules/conversations/conversations.service.ts` | Agent replies keep `PENDING_HUMAN`; added customer end-handoff and admin/agent start/end human support service methods. |
| `apps/api/src/modules/conversations/conversations.controller.ts` | Added public customer `handoff/end` endpoint and protected `human-support/start|end` endpoints. |
| `apps/api/src/modules/conversations/dto/update-human-support.dto.ts` | Added small DTO for admin/agent human-support controls. |
| `apps/api/scripts/provider-behavior.test.ts` | Added regression checks for persistent human mode, customer end-handoff, admin start/end controls, and no provider call during pending human messages. |
| `packages/types/src/index.ts` | Made `SendChatMessageResponse.assistantMessage` nullable/optional during human support and added `UpdateHumanSupportRequest`. |
| `apps/customer-widget/src/widget.tsx` | Widget composer stays enabled in human mode; Human button becomes explicit End human action. |
| `apps/admin-web/app/components/local-chat-demo.tsx` | Local chat demo mirrors widget human-mode send/end behavior. |
| `apps/admin-web/app/components/conversation-ops-panel.tsx` | Added Human Mode start/end control for admin/agent via existing server-side proxy. |
| `apps/admin-web/app/globals.css` | Added styles for the Human Mode control card. |
| `docs/skills/*` | Synced backend/frontend/API/chatbox/QA/current status/project summary notes for persistent human support. |
| `docs/ai-handoff/latest-implementation.md` | Added this follow-up summary. |

Implementation summary:

- `PENDING_HUMAN` is now a persistent human-support state.
- Customer messages during `PENDING_HUMAN` continue to be stored and returned in `messages`, but no assistant message is generated.
- `ConversationsService.sendAgentReply` now keeps the conversation in `PENDING_HUMAN` instead of setting `AWAITING_CUSTOMER`.
- Customer-controlled end path: `POST /v1/conversations/:conversationId/handoff/end`, tenant-scoped and visitor-scoped.
- Admin/agent-controlled paths: `POST /v1/conversations/:conversationId/human-support/start` and `/end`, protected by `AdminApiGuard`.
- Admin-web continues to use same-origin `/api/admin/...` proxy; no backend admin token is exposed to the browser.
- No Prisma schema or migration was added.

Verification for this follow-up:

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/api typecheck` | Passed | API TypeScript check passed. |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Admin-web TypeScript check passed. |
| `pnpm --filter @platform/customer-widget typecheck` | Passed | Widget TypeScript check passed. |
| `pnpm --filter @platform/types typecheck` | Passed | Shared types TypeScript check passed. |
| `pnpm --filter @platform/api test` | Passed | Provider behavior tests now cover persistent human mode and no provider call during pending-human customer messages. |
| `pnpm --filter @platform/admin-web test` | Passed | Existing admin access smoke test passed. |
| `pnpm --filter @platform/customer-widget test` | Passed | Package currently has placeholder test only. |
| `pnpm --filter @platform/api lint` | Passed | API lint script is TypeScript sanity check. |
| `pnpm --filter @platform/admin-web lint` | Passed | Admin-web lint script is TypeScript sanity check. |
| `pnpm --filter @platform/customer-widget lint` | Passed | Widget lint script is TypeScript sanity check. |
| `pnpm --filter @platform/api build` | Passed | API build passed. |
| `pnpm --filter @platform/admin-web build` | Passed | Next build passed. |
| `pnpm --filter @platform/types build` | Passed | Shared types build passed. |
| `pnpm --filter @platform/customer-widget build` | Failed in current sandbox | `tsup` under pnpm lifecycle tried to read `../../..` and could not resolve `./src/index.ts`; direct package-directory command `.\node_modules\.bin\tsup.CMD src/index.ts --format esm,cjs --dts` from `apps/customer-widget` passed. Likely pnpm lifecycle/sandbox path issue, not this task's source change. |

Manual QA remaining:

- Start `pnpm dev`, unlock `/admin/access`, and open `/chat`, `/admin`, and `/agent`.
- In widget/local chat, send a message, click Human, confirm status becomes `pending_human`.
- Send an agent reply from `/agent`; confirm the customer sees it and the conversation stays `pending_human`.
- Send another customer message while `pending_human`; confirm it appears in admin/agent history and no AI reply appears.
- Click customer `End human`; confirm status returns to `open` and later customer messages can receive AI replies.
- From `/admin` or `/agent`, use Human Mode Start/End and confirm the control calls `/api/admin/conversations/:id/human-support/start|end` without exposing `ADMIN_API_TOKEN`.
- Check browser Network/console output for absence of `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, OpenAI key, raw `.env`, auth headers, or session secret.

## 0B. Previous Follow-Up: Admin Handoff UX And Sidebar Feedback

Task request:

- In `/admin` and `/agent`, selected pending-human conversations should show full conversation history near the Human Reply box, using existing `ConversationOpsPanel` detail data.
- Message history should show customer, assistant, agent, and system/handoff messages in chronological order, including citations when present.
- Admin sidebar tabs for existing page sections should scroll/focus those sections.
- Unimplemented sidebar actions should show non-destructive coming-soon/disabled feedback.
- Keep admin token/proxy behavior unchanged and do not build major new features.

Changed files for this follow-up:

| File | Why it changed |
| -- | -- |
| `apps/admin-web/app/components/conversation-ops-panel.tsx` | Added visible chronological conversation history with roles, timestamps, message type labels, author names, and citations before the Human Reply form. |
| `apps/admin-web/app/components/agent-console.tsx` | Removed the obsolete newest-first message prop so agent history stays chronological. |
| `apps/admin-web/app/components/admin-console.tsx` | Added section refs, drawer click handlers, scroll/focus behavior for implemented sections, and coming-soon feedback for unimplemented actions. |
| `apps/admin-web/app/globals.css` | Added styles for message history, citations, drawer buttons, coming-soon labels, section focus, and info feedback toast. |
| `docs/skills/frontend-skill.md` | Synced admin handoff UX/sidebar behavior notes. |
| `docs/skills/qa-skill.md` | Added admin handoff history and sidebar interaction regression checks. |
| `docs/ai-handoff/latest-implementation.md` | Added this follow-up summary. |

Implementation summary:

- `ConversationOpsPanel` still uses the existing admin-web proxy/API flow and still loads `conversationDetail.messages`; the new UI simply renders those messages in the selected conversation detail column before Human Reply.
- Chronological sorting is local and defensive, using `createdAt`; backend already returns ascending messages.
- Citations render per message using existing `message.citations` fields. No API contract changed.
- Sidebar implemented-section behavior:
  - Dashboard -> stats section
  - Knowledge Base -> knowledge base panel
  - Conversations -> conversation panel
  - Settings -> AI Profile/settings panel
- Sidebar unimplemented behavior:
  - Analytics, Support, Account, and New Chatbot show coming-soon feedback and do not navigate to a dead anchor.
- `ADMIN_API_TOKEN` remains server-only; no auth/proxy behavior changed.

Verification for this follow-up:

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Admin-web TypeScript check passed after UI changes. |
| `pnpm --filter @platform/admin-web test` | Passed | Existing admin access smoke test passed. |
| Local `pnpm dev` HTTP smoke | Passed | Started `pnpm dev`, posted `/api/admin/access`, fetched `/admin`; statuses were `200` and returned HTML did not match `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, `OPENAI_API_KEY`, or `sk-...` secret shape. |
| Browser visual/click smoke | Pending manual QA | Current Codex session did not expose a usable browser automation tool. Manual browser click checks remain below. |

Manual QA remaining:

- Start `pnpm dev`, open `http://localhost:3000/admin/access`, and unlock admin-web.
- Open `/admin`, select a pending-human conversation, and confirm Conversation History appears above/near Human Reply.
- Confirm customer/assistant/agent/system-handoff messages are chronological and citations render when present.
- Send an agent reply and confirm reply still works and the new message appears in history.
- Click Dashboard, Knowledge Base, Conversations, and Settings in the drawer; each should scroll/focus its existing section.
- Click Analytics, Support, Account, and New Chatbot; each should show coming-soon feedback without destructive navigation.
- Check browser Network/console output for absence of `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, OpenAI key, raw `.env`, auth headers, or session secret.

## 0C. Previous Follow-Up: Admin-Web Access Smoke Port Determinism

Task request:

- Fix `scripts/smoke-admin-web-access.ps1` when ports such as 3000/3001 are occupied and Next auto-selects another port while the script keeps checking the requested port.
- Make the smoke deterministic by using the requested `-Port` only or clearly failing on conflict.
- Add clear failure messages for port conflicts/readiness failures.
- Keep token values out of output.
- Update local dev documentation if command or troubleshooting changes.

Changed files for this follow-up:

| File | Why it changed |
| -- | -- |
| `scripts/smoke-admin-web-access.ps1` | Uses deterministic requested-port behavior, starts admin-web with `pnpm exec next dev --port <Port>`, detects occupied non-admin-web ports before startup, emits clear failure messages, and kills the started process tree so ports are not left occupied. |
| `docs/runtime/local-dev-checklist.md` | Documented `-Port`, expected output, and deterministic port-conflict behavior. |
| `docs/skills/qa-skill.md` | Synced the deterministic local admin access smoke behavior and `-Port` usage. |
| `docs/skills/deployment-skill.md` | Synced the local admin access smoke `-Port` note. |
| `docs/ai-handoff/latest-implementation.md` | Added this follow-up summary and verification record. |

Implementation summary:

- The smoke now treats the requested `-Port` as the only valid admin-web port for the run.
- If `http://localhost:<Port>/admin/access` is already ready, the script uses that existing admin-web instance.
- If the TCP port is open but `/admin/access` is not admin-web-ready, the script fails with a clear conflict message instead of following Next's fallback port.
- If the port is free, the script starts Next from `apps/admin-web` with `pnpm exec next dev --port <Port>`. This avoids the prior `pnpm --filter ... dev -- --port` argument issue where `--port` was treated as a project directory.
- Readiness failures include stdout/stderr tails for diagnosis. The script never prints `ADMIN_WEB_ACCESS_TOKEN`; success output remains only `admin-access-status=200`.
- The script now uses `taskkill /T /F` on the process tree it starts so a successful smoke does not leave a child Next process occupying the test port.

Verification for this follow-up:

| Command / Check | Result | Notes |
| -- | -- | -- |
| `powershell -ExecutionPolicy Bypass -File scripts/smoke-admin-web-access.ps1 -Port 3100` | Passed | Output `admin-access-status=200`; no token value printed. |
| Post-smoke port check for `3100` | Passed | No listener remained after the smoke; process tree cleanup worked. |
| Simulated occupied port `3101` then ran smoke with `-Port 3101` | Passed | Failed clearly with `Port 3101 is already in use...`; no token value printed. |
| Occupied-port direct exit check | Passed | Inner smoke exit code was `1` for the expected conflict case. |
| `pnpm --filter @platform/admin-web test` | Passed | Existing admin-web smoke tests passed. |
| `git diff --check` | Passed | Only Windows LF/CRLF warnings; no whitespace errors. |

Manual QA remaining:

- If you intentionally run admin-web on a non-3000 port, run the smoke with that same port, for example `powershell -ExecutionPolicy Bypass -File scripts/smoke-admin-web-access.ps1 -Port 3002`.
- If the smoke says the requested port is in use, stop the process using that port or pass a known free `-Port`.
- Do not paste token values, raw `.env`, cookies, or auth headers into chat/QA reports.

## 0A. Previous Follow-Up: Local Dev Startup And Admin Access Ergonomics

Task request:

- Make normal root `pnpm dev` usable without `.\node_modules\.bin\pnpm.CMD` or manual PowerShell env-loading snippets.
- Ensure runtime apps, especially admin-web `/admin/access` and `/api/admin/[...path]`, reliably load the repository-root `.env`.
- Fix local `/admin/access` 500 when root `.env` contains admin-web/admin-api/OpenAI/tenant values.
- Keep alpha token protection and keep secrets out of browser bundles, logs, docs, QA reports, and error responses.
- Clarify local URL architecture and add focused tests/smoke checks.

Changed files for this follow-up:

| File | Why it changed |
| -- | -- |
| `packages/config/src/index.ts` | Added `adminWebEnvSchema` and `loadAdminWebEnv()` so admin-web validates only the server-only keys it needs instead of the full API/OpenAI env schema. |
| `apps/admin-web/app/lib/admin-access.ts` | Loads repository-root `.env` before reading admin-web config and uses `loadAdminWebEnv()`. |
| `apps/admin-web/package.json` | Declares `@platform/config` as an explicit workspace dependency because admin-web imports it at runtime. |
| `pnpm-lock.yaml` | Updated admin-web importer metadata for the workspace config dependency. |
| `apps/admin-web/scripts/admin-access.test.cjs` | Added smoke checks that admin-web depends on `@platform/config`, loads workspace env, and does not use the full server env parser for access. |
| `apps/api/scripts/provider-behavior.test.ts` | Added focused `loadAdminWebEnv()` regression tests: OpenAI-mode unrelated env does not block admin-web config, and invalid session TTL is rejected. |
| `scripts/smoke-admin-web-access.ps1` | Added a local Windows smoke that reads root `.env` without printing token values, starts admin-web if needed, posts to `/api/admin/access`, and outputs only status. |
| `docs/runtime/local-dev-checklist.md` | Added normal local startup, Corepack/pnpm setup, URL map, required local env keys, proxy behavior, and troubleshooting. |
| `docs/runtime/env-setup.md` | Linked the local dev checklist and documented root `.env` loading for admin-web server routes. |
| `docs/skills/auth-skill.md` | Synced admin-web root `.env` loading and local token behavior. |
| `docs/skills/deployment-skill.md` | Synced Corepack/pnpm startup, URL map, and admin access smoke. |
| `docs/skills/qa-skill.md` | Synced admin access env regression and smoke command. |
| `docs/skills/current-status.md` | Recorded the local dev/admin access ergonomics fix. |

Implementation summary:

- `/admin/access` 500 root cause: admin-web server routes called `loadServerEnv(process.env)` without first loading repository-root `.env`. They also validated the full API/OpenAI server schema even though admin-web access only needs admin-web/proxy keys.
- Fix: admin-web now calls `loadWorkspaceEnv()` server-side before parsing config, then uses the new `loadAdminWebEnv()` subset parser.
- Local login remains token-gated. If root `.env` has `ADMIN_WEB_ACCESS_TOKEN=test-web-token`, entering `test-web-token` at `/admin/access` is expected to work.
- Browser code still never receives `ADMIN_API_TOKEN`. Protected browser calls go to same-origin `/api/admin/...`; the Next route handler validates the httpOnly admin-web session cookie and injects `x-admin-api-token` server-side.
- Normal local architecture:
  - `http://localhost:3000`: `apps/admin-web`
  - `http://localhost:3000/admin/access`: admin-web alpha access gate
  - `http://localhost:3000/admin` and `/agent`: protected admin/agent UI after access cookie
  - `http://localhost:3000/chat`: local customer chat/test page
  - `http://localhost:4000/v1`: `apps/api`
  - `http://localhost:3000/api/admin/...`: admin-web server-side proxy to protected backend API
- Package manager ergonomics: Corepack was used to activate pnpm 9.15.0. Direct `corepack enable` to `C:\Program Files\nodejs` failed with EPERM on this Windows machine, so Corepack shims were enabled into the user npm directory instead: `corepack enable --install-directory "$env:APPDATA\npm"`. After that, `pnpm --version` returned `9.15.0`.

Verification for this follow-up:

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --version` | Passed | Returned `9.15.0` after user-level Corepack shim enablement. |
| `pnpm --filter @platform/admin-web test` | Passed | Includes admin access path/static env loader smoke. |
| `pnpm --filter @platform/api test` | Passed | Includes `loadAdminWebEnv()` focused regression tests plus existing provider/retrieval tests. |
| `pnpm --filter @platform/config typecheck` | Passed | Config package typecheck passed. |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Admin-web typecheck passed. |
| `pnpm typecheck` | Passed | Workspace typecheck passed across 11 packages. |
| `pnpm lint` | Passed | Workspace TS sanity lint passed across 11 packages. |
| `pnpm test` | Passed | Workspace tests passed; several packages still have placeholder tests. |
| `pnpm build` | Passed | Workspace build passed, including Next admin-web build. |
| `powershell -ExecutionPolicy Bypass -File scripts/smoke-admin-web-access.ps1` | Passed | Confirmed `admin-access-status=200`; token value was not printed. |
| `git diff --check` | Passed | Only Windows LF/CRLF warnings; no whitespace errors. |

Manual QA remaining:

- From a fresh PowerShell terminal at repo root, run `pnpm dev`.
- Open `http://localhost:3000/admin/access`.
- Enter the exact local `ADMIN_WEB_ACCESS_TOKEN` from root `.env`; with placeholder local config, use `test-web-token`.
- Confirm redirect to `/admin` and that admin API calls go through `http://localhost:3000/api/admin/...`.
- Confirm browser Network does not expose `ADMIN_API_TOKEN`, `ADMIN_WEB_ACCESS_TOKEN`, auth headers, OpenAI key, raw `.env`, or session secret.
- Confirm API is reachable at `http://localhost:4000/v1` and admin-web proxy uses `API_INTERNAL_BASE_URL=http://localhost:4000/v1`.

Risks / notes:

- This did not replace auth/RBAC; it keeps the alpha admin-web token gate.
- This did not disable backend admin protection outside local configuration.
- The smoke script is Windows-focused because the reported blocker is PowerShell/local Windows startup.
- If another terminal still cannot find `pnpm`, close and reopen it after Corepack user-directory enablement, or rerun the checklist commands in `docs/runtime/local-dev-checklist.md`.

## 1. Original Task Brief Summary

Task title: Tenant AI Profile, Prompt Customization, Widget Branding Basics, and Real OpenAI Manual Activation Gate.

Goal:

- Add tenant-level AI/profile settings so each tenant can have its own assistant identity, company display name, tone, support boundaries, messages, and basic widget branding.
- Let admin users view and edit the profile through the protected admin flow.
- Let the customer widget consume only display-safe profile fields.
- Make OpenAI prompt assembly use tenant profile context while keeping platform safety rules higher priority.
- Preserve deterministic default, OpenAI opt-in behavior, citations, provider metadata, handoff, customer-scoped realtime, and `PENDING_HUMAN`.
- Add a real OpenAI manual activation gate so the user can configure a real key locally or in a secret manager without sharing secrets.

## 2. Changed Files

| File | Why it changed |
| -- | -- |
| `packages/types/src/index.ts` | Added shared `TenantAiProfile`, `UpdateTenantAiProfileRequest`, and `PublicTenantAiProfile` types. |
| `packages/ai-core/src/index.ts` | Extended `LlmAgentContext` with tenant profile and handoff message fields. |
| `apps/api/src/modules/tenants/tenant-ai-profile.ts` | Added profile defaults, storage mapping, public-safe projection, and merge helpers. |
| `apps/api/src/modules/tenants/dto/update-tenant-ai-profile.dto.ts` | Added validation for profile updates. |
| `apps/api/src/modules/tenants/public-tenant-profile.controller.ts` | Added public widget-safe tenant profile endpoint. |
| `apps/api/src/modules/tenants/tenants.controller.ts` | Added protected admin read/update profile endpoints. |
| `apps/api/src/modules/tenants/tenants.service.ts` | Added profile read/update/public-safe profile logic using existing `AgentConfig` storage. |
| `apps/api/src/modules/tenants/tenants.module.ts` | Registered the public profile controller. |
| `apps/api/src/main.ts` | Added `/v1/tenant-profile` to tenant-resolution middleware. |
| `apps/api/src/modules/chat/chat.service.ts` | Passed tenant AI profile into LLM provider requests. |
| `apps/api/src/modules/chat/openai-prompt.ts` | Added tenant profile prompt context while keeping platform safety rules first. |
| `apps/api/src/modules/chat/assistant-reply.service.ts` | Deterministic fallback now uses tenant handoff message when available. |
| `apps/api/scripts/provider-behavior.test.ts` | Added profile defaults, validation, public-safe projection, prompt priority, admin guard, and deterministic handoff regressions. |
| `apps/api/scripts/openai-smoke.ts` | Added tenant profile context to manual OpenAI smoke input. |
| `apps/admin-web/app/api/admin/[...path]/route.ts` | Added `PATCH` support for protected admin profile updates through the server-side proxy. |
| `apps/admin-web/app/components/tenant-ai-profile-panel.tsx` | Added admin AI Profile management form. |
| `apps/admin-web/app/components/admin-console.tsx` | Mounted the AI Profile panel in `/admin`. |
| `apps/admin-web/app/globals.css` | Added responsive styles for the AI Profile panel. |
| `apps/admin-web/app/admin/page.tsx` | Changed fallback tenant slug from `kasta` to `demo`. |
| `apps/admin-web/app/chat/page.tsx` | Changed fallback tenant slug from `kasta` to `demo`. |
| `apps/customer-widget/src/widget.tsx` | Loads public tenant profile and uses safe display fields for widget branding/messaging. |
| `docs/runtime/openai-enable-checklist.md` | Added tenant-profile real-model smoke gate and exact user manual steps. |
| `docs/runtime/alpha-runtime-checklist.md` | Added profile route smoke and reminder that fake/test tokens are not alpha evidence. |
| `docs/skills/*` relevant files | Updated current-status, AI chatbox, frontend, backend, API contract, auth, data model, deployment, QA, decision log, and project summary. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for the current task. |

## 3. Data Model / Storage Decision

No Prisma schema change or migration was added.

Storage uses existing `AgentConfig`:

- `displayName`: `assistantName`
- `welcomeMessage`: profile welcome message
- `fallbackMessage`: profile fallback message
- `widgetSettings`: widget-safe display fields such as company display name, handoff message, primary color, logo URL, and avatar URL
- `metadata.aiProfile`: full internal profile, including business type, tone, safe answer instructions, sensitive topic instructions, and do-not-answer instructions

Reason: `AgentConfig` already represents tenant-specific assistant settings. Reusing it keeps the change small and avoids a migration. Future reporting/searching over individual profile fields may justify promoting fields to explicit columns.

## 4. API Changes

Protected admin endpoints:

- `GET /v1/tenants/:tenantSlug/ai-profile`
- `PATCH /v1/tenants/:tenantSlug/ai-profile`

These remain protected by the existing `AdminApiGuard` because `TenantsController` is guarded.

Public widget-safe endpoint:

- `GET /v1/tenant-profile`

This route is tenant-scoped through `x-tenant-slug` via tenant resolution middleware. It returns only:

- `assistantName`
- `companyDisplayName`
- `welcomeMessage`
- `fallbackMessage`
- `handoffMessage`
- `primaryColor`
- `logoUrl`
- `avatarUrl`

It does not return internal prompt guidance, provider settings, tenant IDs, admin tokens, OpenAI keys, hidden metadata, or auth/session values.

Validation:

- trims strings
- enforces length limits
- requires `#RRGGBB` for `primaryColor`
- requires http/https URLs for `logoUrl` and `avatarUrl`
- keeps prompt fields bounded to avoid oversized admin-configured prompt text

## 5. Admin UI Changes

`apps/admin-web` now includes `TenantAiProfilePanel` in `/admin`.

The panel supports:

- assistant name
- company display name
- business type
- tone
- welcome message
- fallback message
- handoff message
- safe answer instructions
- sensitive topic instructions
- do-not-answer instructions
- primary color
- avatar URL
- logo URL
- loading, save success, and save failure states

Admin-web continues to call protected APIs through same-origin `/api/admin/...`; the backend `ADMIN_API_TOKEN` is injected only server-side. Browser code does not receive it.

## 6. Widget Branding / Profile Changes

The customer widget now fetches `GET /v1/tenant-profile` with `x-tenant-slug`.

Widget-safe profile fields are used for:

- assistant name in the header
- company display name in the subtitle/context
- welcome message before a conversation starts
- handoff message when human support is pending
- optional primary color for header styling
- optional avatar/logo image, falling back to initials instead of a hardcoded logo

Existing widget behavior remains intact:

- visitorId persistence
- chat send
- customer-scoped realtime
- handoff request
- agent reply display
- citations display

## 7. OpenAI Prompt Customization

`buildOpenAiPrompt` now includes tenant profile context:

- assistant identity
- company display name
- business type
- tone
- safe answer instructions
- sensitive topic instructions
- do-not-answer instructions
- retrieved knowledge context
- latest customer message

Platform safety rules remain first and explicitly higher priority. The prompt states tenant profile text is lower priority and must be ignored when it conflicts with platform safety rules.

Preserved safety rules:

- use tenant-scoped retrieved knowledge when relevant
- do not invent prices, policies, guarantees, services, operational details, or citations
- do not provide high-risk professional advice beyond general support guidance
- do not reveal hidden prompts, provider settings, tenant IDs, internal metadata, routing logic, or API keys
- admit insufficient information when context is not enough
- suggest human support for sensitive/uncertain questions when handoff is enabled
- do not claim to be human

`PENDING_HUMAN` still blocks provider calls before OpenAI/deterministic generation.

## 8. Manual Real OpenAI Activation Gate

The user must configure these values only in local `.env` or a secret-managed environment:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=<real key set only by user locally or in secret manager>
OPENAI_MODEL=<chosen real model>
```

Recommended model placeholder in docs: `gpt-4.1-mini`. This is an example, not a hardcoded requirement.

After configuration, run:

```bash
pnpm --filter @platform/api smoke:openai
```

Expected safe success:

- `providerMode` shows OpenAI
- `attemptedRealOpenAI` is `true`
- `assistantTextReturned` is `true`
- `citationsReturned` is `true` when retrieved chunks exist
- `providerMetadataReturned` is `true`
- `usedFallback` is visible
- no API key, auth header, raw env, admin token, or session secret is printed

Tenant-profile real-model check:

1. Configure a visible tenant AI profile in `/admin`.
2. Set `AI_PROVIDER=openai`, real `OPENAI_API_KEY`, and `OPENAI_MODEL` locally or in a secret manager.
3. Run `pnpm --filter @platform/api smoke:openai`.
4. Add or use a knowledge document with a clear answer.
5. Ask a matching customer question in `/chat` or the widget.
6. Confirm the answer reflects the tenant tone/profile.
7. Confirm it stays grounded, does not invent unsupported details, and preserves citations.

What must not be shared back into chat:

- OpenAI API key
- auth headers
- raw `.env` contents
- admin tokens
- admin-web access token
- session secret
- database/Redis credentials

Fake/test/local-only tokens are local QA path validation only. They are not online/alpha acceptance evidence.

## 9. Verification Results

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/api typecheck` | Passed | Focused API typecheck passed. |
| `pnpm --filter @platform/admin-web typecheck` | Passed | Focused admin-web typecheck passed. |
| `pnpm --filter @platform/customer-widget typecheck` | Passed | Focused widget typecheck passed. |
| `pnpm --filter @platform/ai-core typecheck` | Passed | Focused ai-core typecheck passed. |
| `pnpm --filter @platform/api test` | Passed | Includes new tenant profile/prompt/public-safe regressions. |
| `pnpm typecheck` | Passed | Workspace typecheck passed across 11 packages. |
| `pnpm lint` | Passed | Workspace lint passed; scripts are still TS sanity checks. |
| `pnpm test` | Passed | Workspace tests passed; several packages still have placeholder tests. |
| `pnpm build` | Passed | Workspace build passed, including admin-web and customer-widget. |
| `pnpm --filter @platform/api smoke:openai` without `AI_PROVIDER=openai` | Expected failure | Failed safely with `OpenAI smoke test requires AI_PROVIDER=openai.` |
| `AI_PROVIDER=openai` smoke with no key/model | Expected failure | Failed safely with missing `OPENAI_API_KEY` and `OPENAI_MODEL` validation messages. |
| Safe secret scan | Passed | Output only path/line/rule metadata; `contains-real-env=False`. |
| Real `.env` boolean shape check | Passed | Output booleans only; no env values printed. |
| Runtime company-string search in `apps` and `packages` | Passed | No runtime code matches for Haneco/Kasta/HanecoAIPilotBot after excluding build/dependency/image outputs. |
| `git diff --check` | Passed | Only Windows LF/CRLF warnings. |

## 10. Manual QA Suggestions

Local deterministic QA:

- Start infra, migrations, seed, and local servers as usual.
- Open `/admin` through the admin-web access gate.
- Select a tenant and edit AI Profile fields.
- Save and reload the profile.
- Open `/chat` or widget and confirm assistant name, company display name, welcome message, handoff message, color, and avatar/logo behavior.
- Send a normal chat message and confirm customer chat still works.
- Request handoff and confirm `PENDING_HUMAN` still blocks further AI replies.
- Confirm public `GET /v1/tenant-profile` does not include internal prompt/safety fields.
- Confirm browser network does not send `ADMIN_API_TOKEN` directly to `apps/api`.

Real OpenAI manual gate:

- Configure real OpenAI env only locally or in a secret manager.
- Run `pnpm --filter @platform/api smoke:openai`.
- Run the tenant-profile real-model check from section 8.
- Do not paste secrets or raw env output into chat.

## 11. Risks / Notes

- This is not Level 3 lead capture; no lead schema, CRM, email, booking, or intent workflow was added.
- This is not production auth/RBAC; admin profile editing is protected by the existing alpha admin token guard.
- Profile prompt customization reduces generic behavior but cannot replace product-specific policy/legal review.
- Public widget profile uses display-safe URL fields only, but production should still apply CSP/image-domain policy at deployment.
- Real OpenAI success remains pending until the user configures a real key outside the repository.
- No Prisma migration was added.

## 12. Docs Update Suggestions

- Docs/skills were updated directly because the task explicitly requested it.
- After QA acceptance and commit, Project Context & Docs chat should reconcile skills with `latest-qa.md` and the final commit.
- If future work promotes profile fields from JSON to explicit columns, update data model and migration docs.

## 13. Input For Review & QA Chat

Review the current implementation using `docs/ai-handoff/latest-implementation.md` and the current git diff. Update `docs/ai-handoff/latest-qa.md`. Also guide me through the required manual real OpenAI activation and tenant-profile smoke test without asking me to paste secrets into chat. Confirm exactly what I must set in local `.env` or secret manager, what command to run, what success output to check, and whether fake/test tokens are still only local QA placeholders.
