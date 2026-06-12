import type {
  LlmProviderMetadata,
  LlmProviderResponse,
  LlmRetrievedKnowledgeChunk
} from "@platform/ai-core";
import type {
  AnswerDebugCitation,
  AnswerDebugProviderMetadata,
  AnswerDebugResult
} from "@platform/types";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { KnowledgeRetrievalService } from "../knowledge/knowledge-retrieval.service";
import { buildTenantAiProfile } from "../tenants/tenant-ai-profile";
import { LlmProviderResolverService } from "./llm-provider-resolver.service";

const CONTENT_PREVIEW_LENGTH = 600;
const CITATION_EXCERPT_LENGTH = 240;

@Injectable()
export class AnswerDebugService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KnowledgeRetrievalService)
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
    @Inject(LlmProviderResolverService)
    private readonly llmProviderResolver: LlmProviderResolverService
  ) {}

  async run(tenant: ResolvedTenant, rawQuestion: string): Promise<AnswerDebugResult> {
    const question = rawQuestion.trim();

    if (!question) {
      throw new BadRequestException("Debug question cannot be empty.");
    }

    const [retrievedChunks, agentConfig] = await Promise.all([
      this.knowledgeRetrievalService.retrieveRelevantChunks(tenant, question),
      this.prisma.client.agentConfig.findUnique({
        where: {
          tenantId: tenant.id
        }
      })
    ]);
    const tenantAiProfile = buildTenantAiProfile(tenant, agentConfig);
    const provider = this.llmProviderResolver.resolveProvider();
    const response = await provider.generateReply({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      },
      conversation: {
        id: "admin-answer-debug"
      },
      agent: {
        displayName: tenantAiProfile.assistantName,
        welcomeMessage: tenantAiProfile.welcomeMessage,
        fallbackMessage: tenantAiProfile.fallbackMessage,
        handoffMessage: tenantAiProfile.handoffMessage,
        handoffEnabled: agentConfig?.handoffEnabled ?? false,
        tenantAiProfile
      },
      latestCustomerMessage: question,
      retrievedChunks
    });

    return this.buildResult(tenant, question, provider.name, retrievedChunks, response);
  }

  private buildResult(
    tenant: ResolvedTenant,
    question: string,
    requestedMode: string,
    retrievedChunks: LlmRetrievedKnowledgeChunk[],
    response: LlmProviderResponse
  ): AnswerDebugResult {
    const citations = this.sanitizeCitations(response.citations);
    const hasKnowledge = retrievedChunks.length > 0;
    const retrievalConfidence = this.resolveRetrievalConfidence(retrievedChunks, citations.length);

    return {
      tenant: {
        slug: tenant.slug,
        displayName: tenant.name
      },
      question,
      answer: response.content,
      answerSource: this.resolveAnswerSource(hasKnowledge, citations.length, response.metadata),
      knowledge: {
        outcome: hasKnowledge ? "hit" : "miss",
        retrievalConfidence,
        reason: this.resolveKnowledgeReason(hasKnowledge, citations.length, response.metadata),
        retrievedChunkCount: retrievedChunks.length,
        citationCount: citations.length,
        sourceDiversity: new Set(retrievedChunks.map((chunk) => chunk.knowledgeDocumentId)).size,
        warnings: this.buildKnowledgeWarnings(retrievedChunks, citations.length, response.metadata)
      },
      provider: {
        requestedMode,
        usedMode: response.metadata.deterministic ? "deterministic" : response.metadata.mode,
        usedFallback: response.metadata.usedFallback,
        metadata: this.sanitizeProviderMetadata(response.metadata)
      },
      retrievedChunks: retrievedChunks.map((chunk) => ({
        knowledgeDocumentId: chunk.knowledgeDocumentId,
        chunkId: chunk.chunkId,
        title: chunk.title,
        chunkIndex: chunk.chunkIndex,
        sourceUri: chunk.sourceUri ?? null,
        relevanceScore: chunk.relevanceScore,
        contentPreview: chunk.content.slice(0, CONTENT_PREVIEW_LENGTH)
      })),
      citations
    };
  }

  private sanitizeProviderMetadata(metadata: LlmProviderMetadata): AnswerDebugProviderMetadata {
    return {
      providerName: metadata.providerName,
      mode: metadata.mode,
      deterministic: metadata.deterministic,
      usedFallback: metadata.usedFallback,
      model: metadata.model,
      fallbackReason: metadata.fallbackReason,
      latencyMs: metadata.latencyMs,
      responseId: metadata.responseId
    };
  }

  private sanitizeCitations(citations: LlmProviderResponse["citations"]): AnswerDebugCitation[] {
    return (citations ?? []).map((citation) => ({
      knowledgeDocumentId: citation.knowledgeDocumentId,
      chunkId: citation.chunkId,
      title: citation.title,
      chunkIndex: citation.chunkIndex,
      sourceUri: citation.sourceUri ?? null,
      relevanceScore: citation.relevanceScore,
      excerpt: citation.excerpt?.slice(0, CITATION_EXCERPT_LENGTH)
    }));
  }

  private resolveAnswerSource(
    hasKnowledge: boolean,
    citationCount: number,
    metadata: LlmProviderMetadata
  ): AnswerDebugResult["answerSource"] {
    if (!hasKnowledge) {
      return "knowledge_miss";
    }

    if (metadata.usedFallback) {
      return "provider_fallback";
    }

    return citationCount > 0 ? "knowledge_hit" : "retrieval_hit_without_citations";
  }

  private resolveKnowledgeReason(
    hasKnowledge: boolean,
    citationCount: number,
    metadata: LlmProviderMetadata
  ): string {
    if (!hasKnowledge) {
      return "No relevant READY knowledge chunks met the retrieval threshold.";
    }

    if (metadata.usedFallback) {
      return `Knowledge was retrieved, but the requested provider fell back${
        metadata.fallbackReason ? ` (${metadata.fallbackReason})` : ""
      }.`;
    }

    if (citationCount === 0) {
      return "Knowledge was retrieved, but the generated answer did not include backend citations.";
    }

    return "Relevant tenant-scoped knowledge was retrieved and mapped to backend citations.";
  }

  private resolveRetrievalConfidence(
    retrievedChunks: LlmRetrievedKnowledgeChunk[],
    citationCount: number
  ): AnswerDebugResult["knowledge"]["retrievalConfidence"] {
    if (retrievedChunks.length === 0) {
      return "none";
    }

    const bestScore = Math.max(...retrievedChunks.map((chunk) => chunk.relevanceScore ?? 0));

    if (bestScore >= 12 && citationCount > 0) {
      return "strong";
    }

    return "weak";
  }

  private buildKnowledgeWarnings(
    retrievedChunks: LlmRetrievedKnowledgeChunk[],
    citationCount: number,
    metadata: LlmProviderMetadata
  ): string[] {
    const warnings: string[] = [];

    if (retrievedChunks.length === 0) {
      warnings.push("No READY knowledge chunks met the retrieval threshold.");
      return warnings;
    }

    const sourceDiversity = new Set(retrievedChunks.map((chunk) => chunk.knowledgeDocumentId)).size;
    const bestScore = Math.max(...retrievedChunks.map((chunk) => chunk.relevanceScore ?? 0));

    if (bestScore < 12) {
      warnings.push("Retrieved evidence is weak; verify the answer before relying on it.");
    }

    if (sourceDiversity === 1 && retrievedChunks.length > 1) {
      warnings.push("Retrieved chunks come from one document; consider adding broader source coverage.");
    }

    if (citationCount === 0) {
      warnings.push("No backend citations were attached to the generated answer.");
    }

    if (metadata.usedFallback) {
      warnings.push("Provider fallback was used for this answer.");
    }

    return warnings;
  }
}
