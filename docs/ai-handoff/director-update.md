# Director Update

## 1. Current Reconciliation

Latest commit reviewed: `906440b small fix`.

Latest accepted QA report primarily covers the preceding P1 fix commit:

- `e499c45 fix: preserve human handoff state and profile media clearing`

The latest commit was created after that QA report and therefore still needs focused/manual validation.

## 2. Latest Commit Changes

`906440b` changes only admin-web chat/conversation UI and the customer widget:

- `/chat` is now force-dynamic and server-fetches the public tenant profile before rendering.
- The initial public profile is passed into `CustomerWidget`, reducing initial branding/message fallback before the client refresh completes.
- Customer widget persists the active conversation ID in tenant-scoped browser localStorage.
- On reload, the widget restores the conversation through the customer-scoped detail endpoint using the resolved visitor ID.
- Restore responses with 403 or 404 clear the stale/unauthorized stored conversation ID.
- Transient restore failures retain the stored ID for a later retry.
- Customer widget message history auto-scrolls to the newest message.
- Admin/agent Human Reply conversation history auto-scrolls to the newest message after selection/message changes.

No API route, auth boundary, Prisma schema, provider selection, retrieval, citation, or public tenant-profile contract changed in `906440b`.

## 3. Accepted P1 QA Context

Latest QA accepted the P1 fixes in `e499c45`:

- `logoUrl: null` and `avatarUrl: null` are explicit clear values that stop older AgentConfig/widget/tenant-branding media fallback after save and reload.
- Missing/`undefined` media values still allow normal fallback.
- If human mode starts while an AI provider is running, the generated AI result is discarded.
- The latest persisted `PENDING_HUMAN` conversation is returned unchanged.
- Post-provider suppression does not persist an assistant message or move `lastMessageAt` backwards from the newer handoff activity.

QA found no required fixes for these P1 items.

## 4. Verification Status

Accepted P1 verification passed:

- `pnpm --filter @platform/api test`
- `pnpm --filter @platform/api typecheck`
- `pnpm --filter @platform/api build`
- `pnpm --filter @platform/admin-web test`
- `pnpm --filter @platform/admin-web typecheck`
- `pnpm --filter @platform/admin-web build`
- workspace `pnpm typecheck`, `pnpm test`, and `pnpm lint`
- `git diff --check` with only Windows line-ending warnings

`906440b` is not covered by the current latest QA report. No focused test result for its profile prefetch, conversation restore, or auto-scroll behavior is recorded in the supplied handoff/QA files.

## 5. Current Risks

- Non-blocking P2: the earlier pre-provider pending-human branch may still move `lastMessageAt` backwards in a narrow concurrency window.
- Customer conversation ID is stored in localStorage and remains tied to bearer-like anonymous visitor identity; signed customer sessions are still future hardening.
- Latest commit restore and auto-scroll behavior needs manual/browser validation.
- Real OpenAI success smoke remains pending until a real key is configured outside the repository.
- Alpha admin-web access remains token/session-cookie protection, not production auth/RBAC.

## 6. Updated Docs

- `docs/skills/current-status.md`: reconciled latest commit with the latest accepted QA boundary.
- `docs/skills/frontend-skill.md`: documented server profile prefetch, conversation restore, and auto-scroll behavior.
- `docs/skills/ai-chatbox-skill.md`: documented tenant-scoped conversation persistence/restore and initial profile behavior.
- `docs/skills/qa-skill.md`: added latest commit manual checks, accepted P1 QA context, and the remaining P2 risk.
- `docs/ai-handoff/director-update.md`: refreshed for `906440b` and the latest accepted QA report.

## 7. Recommended Next Tasks

1. Run focused manual/browser QA for `906440b`: profile-first `/chat` render, same-visitor conversation restore, stale ID clearing, and latest-message auto-scroll.
2. After that validation, update `docs/ai-handoff/latest-qa.md` so it explicitly covers `906440b`.
3. Decide whether to address the non-blocking pre-provider `lastMessageAt` monotonicity risk.
4. Continue production hardening with signed customer sessions and real auth/RBAC when prioritized.
