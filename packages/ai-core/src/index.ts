import type { Citation, MessageAuthorType } from "@platform/types";
import type { TenantRuntimeConfig } from "@platform/tenant-core";

export interface ChatTurn {
  author: MessageAuthorType;
  content: string;
  createdAt: string;
}

export interface RetrievedChunk {
  knowledgeDocumentId: string;
  chunkId: string;
  title: string;
  content: string;
  chunkIndex: number;
  score: number;
  sourceUri?: string;
}

export interface AssistantResponse {
  text: string;
  citations: Citation[];
  handoffSuggested?: boolean;
}

export interface AiRuntimeContext {
  tenant: TenantRuntimeConfig;
  conversationId: string;
  customerId?: string;
}

export function buildCitations(chunks: RetrievedChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    knowledgeDocumentId: chunk.knowledgeDocumentId,
    chunkId: chunk.chunkId,
    title: chunk.title,
    chunkIndex: chunk.chunkIndex,
    sourceUri: chunk.sourceUri,
    excerpt: chunk.content.slice(0, 240)
  }));
}
