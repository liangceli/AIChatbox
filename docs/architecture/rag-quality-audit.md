# RAG Quality Audit

Last updated: 2026-06-12

## Scope

This audit covers the current tenant-scoped knowledge pipeline for manual text, file text, URL import, chunking, retrieval, citations, OpenAI context assembly, and Answer Debug visibility. It is grounded in the current `apps/api` and `apps/admin-web` implementation.

## Current Pipeline

- Manual and file ingestion call `KnowledgeService.createManualDocument`, store trimmed content, checksum, source type, optional source URI, and metadata, then synchronously process chunks.
- URL ingestion calls `KnowledgeUrlImportService.fetchContent`, which enforces public HTTP(S), SSRF-safe DNS/redirect checks, DNS-pinned requests, a 2 MB response cap, a per-request 15-second absolute deadline, and an overall 45-second import flow deadline.
- URL HTML extraction removes scripts, styles, noscript, common layout/noise tags, comments, hidden/aria-hidden blocks, normalizes whitespace, preserves headings as line breaks, and deduplicates repeated lines.
- Chunking normalizes line endings, removes duplicate repeated blocks, targets roughly 900 characters with paragraph/sentence/whitespace boundaries, and uses overlap for continuity.
- Retrieval uses raw plus normalized candidate lookup, common support synonym variants for lookup/scoring, exact normalized token scoring, phrase boosts, title weighting, READY-document filtering, and a per-document diversity cap.
- Citations are backend-generated from retrieved chunks. OpenAI does not invent citation IDs; OpenAI success maps retrieved chunks into backend citations.
- OpenAI context includes source title, chunk ID, safe source URL, retrieval score, and chunk content.
- Answer Debug is admin-protected, non-persistent, tenant-scoped, and returns safe retrieval confidence, source diversity, warnings, chunks, citations, provider mode, fallback state, and allowlisted provider metadata.

## Strengths

- Tenant scope is enforced through tenant middleware and tenant-aware Prisma filters.
- Archived documents delete chunks and are excluded from retrieval.
- URL import SSRF defenses are strong enough for alpha, with deployment egress denial still recommended.
- Citation generation is backend-controlled and tied to retrieved chunks.
- Answer Debug now gives enough safe visibility to diagnose hit/miss, weak retrieval, source diversity, citations, fallback, and provider mode.
- Normal automated tests do not require real OpenAI or real secrets.

## Gaps By Priority

### Must Fix Before Alpha

- Real production/staging env, admin secrets, OpenAI key/model, database/Redis, CORS/domain, and deployment egress policy must be configured outside the repo and manually verified.
- Manual alpha QA must run the knowledge question set against real tenant content. Fake/local tokens are not alpha evidence.

### Should Fix Soon After Alpha

- Knowledge operations are synchronous; large imports can tie up API requests.
- Admin-Web interaction coverage is still mostly source smoke, not full browser automation.
- Answer Debug non-persistence tests now cover common customer/conversation/message writes, but not every future Prisma write method automatically.
- Retrieval is deterministic lexical matching; it will miss semantic matches outside the small support synonym map.

### RAG 2.0 Future Improvement

- Add embeddings/hybrid retrieval, source-aware reranking, chunk-level freshness scoring, async ingestion jobs, and crawler/sitemap ingestion only after alpha basics are stable.
- Add document-level quality reports persisted in metadata if the UI needs richer warnings.

### Not Worth Doing Now

- Full crawler, vector database, LangChain/LangGraph, provider-dependent automated CI, and broad schema redesign are too large for this alpha hardening round.

## Alpha QA Question Set

- Direct exact: ask about a policy sentence that appears verbatim in a READY document.
- Short keyword: ask one strong keyword such as `warranty`, `returns`, or `shipping`.
- Synonym: ask `refund policy` when the document says `return policy`.
- Phrase: ask a two-word phrase such as `return window`.
- Miss: ask for a topic absent from READY documents.
- Sensitive/unsupported: ask for legal/medical/financial advice and confirm safe fallback or human-support guidance.
- Noisy URL: import a page with nav/footer/cookie text and confirm chunks focus on main content.
- Archived exclusion: archive a document and confirm its content no longer appears in Answer Debug retrieval/citations.

## Manual Requirements

Do not paste secrets into chat. Real OpenAI QA requires the user to set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` only in local `.env` or a secret manager, then run the manual smoke and Answer Debug checks.
