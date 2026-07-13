import type {
  KnowledgeChunk,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeDocumentSourceType,
  KnowledgeDocumentStatus
} from "@platform/database";
import type {
  KnowledgeBaseRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentDetail,
  KnowledgeDocumentRecord,
  KnowledgeStructuredMetadata
} from "@platform/types";

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
    checksum: document.checksum ?? null,
    chunkCount: document.chunkCount,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    ingestedAt: document.ingestedAt?.toISOString() ?? null,
    knowledgeMetadata: readKnowledgeMetadata(document.metadata)
  };
}

export function toKnowledgeChunkRecord(chunk: KnowledgeChunk): KnowledgeChunkRecord {
  return {
    id: chunk.id,
    knowledgeDocumentId: chunk.knowledgeDocumentId,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
    tokenCount: chunk.tokenCount,
    sourceLocator: chunk.sourceLocator ?? undefined,
    knowledgeMetadata: readKnowledgeMetadata(chunk.metadata),
    createdAt: chunk.createdAt.toISOString()
  };
}

export function toKnowledgeDocumentDetail(
  document: KnowledgeDocument & { chunks: KnowledgeChunk[] }
): KnowledgeDocumentDetail {
  return {
    ...toKnowledgeDocumentRecord(document),
    metadata: document.metadata ?? undefined,
    chunks: document.chunks.map(toKnowledgeChunkRecord)
  };
}

function readKnowledgeMetadata(value: unknown): KnowledgeStructuredMetadata | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const candidate = isPlainObject(value.knowledge)
    ? value.knowledge
    : isPlainObject(value.knowledgeMetadata)
      ? value.knowledgeMetadata
      : value;
  const metadata: KnowledgeStructuredMetadata = {};

  for (const key of [
    "productSeries",
    "productName",
    "modelNumber",
    "deviceType",
    "documentType",
    "language",
    "version",
    "sectionTitle"
  ] as const) {
    if (typeof candidate[key] === "string" && candidate[key].trim()) {
      metadata[key] = candidate[key].trim();
    }
  }

  if (typeof candidate.pageNumber === "number" && Number.isFinite(candidate.pageNumber)) {
    metadata.pageNumber = candidate.pageNumber;
  }

  if (Array.isArray(candidate.aliases)) {
    metadata.aliases = candidate.aliases.filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim())
    );
  }

  if (Array.isArray(candidate.intentHints)) {
    metadata.intentHints = candidate.intentHints.filter(
      (item): item is string => typeof item === "string" && Boolean(item.trim())
    );
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
