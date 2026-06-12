import type { Citation, MessageAuthorType, TenantAiProfile } from "@platform/types";
import type { TenantRuntimeConfig } from "@platform/tenant-core";

export type LlmProviderMode = "deterministic" | "disabled" | "openai";

export interface LlmTenantContext {
  id: string;
  slug: string;
  name: string;
}

export interface LlmAgentContext {
  displayName: string;
  welcomeMessage?: string | null;
  fallbackMessage?: string | null;
  handoffMessage?: string | null;
  handoffEnabled?: boolean;
  tenantAiProfile?: TenantAiProfile;
}

export interface LlmConversationContext {
  id: string;
}

export interface LlmRetrievedKnowledgeChunk {
  knowledgeDocumentId: string;
  chunkId: string;
  title: string;
  chunkIndex: number;
  sourceUri?: string | null;
  sourceLocator?: unknown;
  relevanceScore?: number;
  content: string;
}

export interface LlmProviderRequest {
  tenant: LlmTenantContext;
  conversation: LlmConversationContext;
  agent: LlmAgentContext;
  latestCustomerMessage: string;
  retrievedChunks: LlmRetrievedKnowledgeChunk[];
}

export interface LlmProviderMetadata {
  providerName: string;
  mode: LlmProviderMode;
  deterministic: boolean;
  usedFallback: boolean;
  model?: string;
  fallbackReason?: string;
  latencyMs?: number;
  responseId?: string;
}

export interface LlmProviderResponse {
  content: string;
  citations: Citation[] | null;
  metadata: LlmProviderMetadata;
}

export interface LlmProvider {
  name: string;
  generateReply(input: LlmProviderRequest): Promise<LlmProviderResponse> | LlmProviderResponse;
}

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
