import type { LlmRetrievedKnowledgeChunk } from "@platform/ai-core";
import type { Citation } from "@platform/types";

function createExcerpt(content: string, maxLength = 220): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

export function buildBackendCitations(chunks: LlmRetrievedKnowledgeChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    knowledgeDocumentId: chunk.knowledgeDocumentId,
    chunkId: chunk.chunkId,
    title: chunk.title,
    chunkIndex: chunk.chunkIndex,
    sourceUri: chunk.sourceUri ?? null,
    sourceLocator: chunk.sourceLocator ?? undefined,
    relevanceScore: chunk.relevanceScore,
    excerpt: createExcerpt(chunk.content, 180)
  }));
}
