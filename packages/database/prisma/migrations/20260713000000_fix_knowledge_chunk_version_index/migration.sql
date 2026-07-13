-- The initial schema created this object as a unique index, not a table
-- constraint. Keeping it would block version 2 chunks that reuse chunkIndex.
DROP INDEX IF EXISTS "KnowledgeChunk_tenantId_knowledgeDocumentId_chunkIndex_key";
