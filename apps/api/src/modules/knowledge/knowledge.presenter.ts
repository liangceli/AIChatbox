import type {
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeDocumentSourceType,
  KnowledgeDocumentStatus
} from "@platform/database";
import type { KnowledgeBaseRecord, KnowledgeDocumentRecord } from "@platform/types";

function mapDocumentStatus(status: KnowledgeDocumentStatus): KnowledgeDocumentRecord["status"] {
  return status.toLowerCase();
}

function mapSourceType(sourceType: KnowledgeDocumentSourceType): KnowledgeDocumentRecord["sourceType"] {
  return sourceType.toLowerCase();
}

export function toKnowledgeBaseRecord(
  knowledgeBase: KnowledgeBase & { _count?: { documents: number } }
): KnowledgeBaseRecord {
  return {
    id: knowledgeBase.id,
    slug: knowledgeBase.slug,
    name: knowledgeBase.name,
    description: knowledgeBase.description ?? null,
    documentCount: knowledgeBase._count?.documents ?? 0,
    createdAt: knowledgeBase.createdAt.toISOString(),
    updatedAt: knowledgeBase.updatedAt.toISOString()
  };
}

export function toKnowledgeDocumentRecord(document: KnowledgeDocument): KnowledgeDocumentRecord {
  return {
    id: document.id,
    knowledgeBaseId: document.knowledgeBaseId,
    title: document.title,
    status: mapDocumentStatus(document.status),
    sourceType: mapSourceType(document.sourceType),
    sourceUri: document.sourceUri ?? null,
    chunkCount: document.chunkCount,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    ingestedAt: document.ingestedAt?.toISOString() ?? null
  };
}
