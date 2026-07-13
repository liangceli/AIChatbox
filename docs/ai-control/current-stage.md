# Current Stage

Date: 2026-07-13

Stage: Alpha hardening reconciliation and end-to-end acceptance.

Active goal: turn the current large uncommitted working tree into a reproducible, tenant-safe Alpha baseline, then complete the real Clerk Knowledge -> Widget -> human handoff -> Agent reply browser loop.

Current implementation focus:
- Knowledge replacement is versioned and retrieval is restricted to READY documents and READY chunks.
- Forward migration `20260713000000_fix_knowledge_chunk_version_index` removes the legacy version-blind unique index that blocked version 2 chunks.
- `ConversationState` is the primary product-context store, with legacy conversation metadata synchronized during migration; explicit null now clears both stores.
- Widget chat uses signed tenant/visitor sessions, required idempotency keys, tenant/visitor rate limits, Hybrid Retrieval, evidence-bound OpenAI output, and persistent human-support states.
- Clerk remains the admin/agent identity boundary and backend tenant-role mapping remains the authorization boundary.
- AI Worker startup logs only whether Redis is configured, never the full Redis connection URL.

Current verification:
- Workspace typecheck, lint, test, build, and diff checks pass across all 11 packages.
- All 10 local database migrations are applied.
- A real PostgreSQL version 1 -> version 2 chunk write test passes inside an automatically rolled-back transaction.
- API and Admin Web health endpoints return 200 in Clerk/OpenAI mode.

Current acceptance status: RETURN FOR FIXES until the authenticated multi-role browser loop is completed. The working tree remains intentionally uncommitted and must not be partially reset.
