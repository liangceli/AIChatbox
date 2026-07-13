ALTER TYPE "KnowledgeDocumentStatus" ADD VALUE IF NOT EXISTS 'DELETED';

DO $$
BEGIN
  CREATE TYPE "KnowledgeChunkStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'INACTIVE', 'ARCHIVED', 'DELETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "KnowledgeEmbeddingStatus" AS ENUM ('DISABLED', 'PENDING', 'READY', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "KnowledgeDocument"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "processingError" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "KnowledgeChunk"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "contentHash" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "KnowledgeChunkStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN IF NOT EXISTS "embeddingStatus" "KnowledgeEmbeddingStatus" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "KnowledgeChunk" DROP CONSTRAINT IF EXISTS "KnowledgeChunk_tenantId_knowledgeDocumentId_chunkIndex_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'KnowledgeChunk_tenantId_knowledgeDocumentId_version_chunkIndex_key'
  ) THEN
    ALTER TABLE "KnowledgeChunk"
      ADD CONSTRAINT "KnowledgeChunk_tenantId_knowledgeDocumentId_version_chunkIndex_key"
      UNIQUE ("tenantId", "knowledgeDocumentId", "version", "chunkIndex");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "KnowledgeChunk_tenantId_status_idx" ON "KnowledgeChunk"("tenantId", "status");
