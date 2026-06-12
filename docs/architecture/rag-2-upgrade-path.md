# RAG 2.0 Upgrade Path

Last updated: 2026-06-12

## Keep For Alpha

- Deterministic lexical retrieval as the safe baseline.
- Backend-generated citations from retrieved chunks.
- Answer Debug as the admin-visible diagnostic path.
- Manual real OpenAI validation, not CI-gated real provider calls.

## Next Practical Upgrades

1. Move ingestion/reprocess/URL import to an async job path with progress and retry metadata.
2. Add document quality summaries: duplicate ratio, tiny chunk count, missing title/source, stale content age, and failed import reason categories.
3. Add a curated tenant QA set stored outside prompts so admins can test common questions before publishing.
4. Add browser-level Admin-Web tests for ingestion, document actions, and Answer Debug result states.

## Hybrid Retrieval Round

- Add embeddings only after a concrete vector store choice and deployment path exist.
- Keep lexical retrieval as a fallback and candidate generator.
- Use hybrid scoring: lexical exact match, title/source weighting, semantic similarity, freshness, and source diversity.
- Add reranking only if test fixtures show measurable quality improvement.
- Keep citations tied to backend chunk IDs and never provider-invented.

## Deferred Items

- Full crawler/sitemap ingestion.
- LangChain/LangGraph or agent orchestration.
- Multi-tenant enterprise RBAC.
- Provider-specific prompt experiments without repeatable Answer Debug QA evidence.
