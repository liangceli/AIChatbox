import type { Citation, MessageAuthorType } from "@platform/types";
import type { TenantRuntimeConfig } from "@platform/tenant-core";

export interface ChatTurn {
  author: MessageAuthorType;
  content: string;
  createdAt: string;
}

export interface RetrievedChunk {
  documentId: string;
  title: string;
  content: string;
  score: number;
  sourceUrl?: string;
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
    documentId: chunk.documentId,
    title: chunk.title,
    url: chunk.sourceUrl,
    excerpt: chunk.content.slice(0, 240)
  }));
}
