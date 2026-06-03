import type {
  LlmProvider,
  LlmProviderRequest,
  LlmProviderResponse,
  LlmRetrievedKnowledgeChunk
} from "@platform/ai-core";
import { Injectable } from "@nestjs/common";

function createExcerpt(content: string, maxLength = 220): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

@Injectable()
export class AssistantReplyService implements LlmProvider {
  readonly name = "deterministic";

  generateReply(input: LlmProviderRequest): LlmProviderResponse {
    const normalizedMessage = input.latestCustomerMessage.trim();

    if (!normalizedMessage) {
      return {
        content: input.agent.fallbackMessage ?? "I can help once you send a message.",
        citations: null,
        metadata: this.createMetadata(true)
      };
    }

    if (input.retrievedChunks.length > 0) {
      const citations = input.retrievedChunks.map((chunk) => ({
        knowledgeDocumentId: chunk.knowledgeDocumentId,
        chunkId: chunk.chunkId,
        title: chunk.title,
        chunkIndex: chunk.chunkIndex,
        sourceUri: chunk.sourceUri ?? null,
        sourceLocator: chunk.sourceLocator ?? undefined,
        relevanceScore: chunk.relevanceScore,
        excerpt: createExcerpt(chunk.content, 180)
      }));
      const groundedPoints = this.selectGroundedSentences(normalizedMessage, input.retrievedChunks);

      if (groundedPoints.length === 0) {
        return this.createFallback(input, normalizedMessage);
      }

      return {
        content: [
          `Based on the support knowledge base, ${groundedPoints[0]}`,
          groundedPoints.length > 1 ? `Also relevant: ${groundedPoints.slice(1, 3).join(" ")}` : null
        ]
          .filter(Boolean)
          .join(" "),
        citations,
        metadata: this.createMetadata(false)
      };
    }

    return this.createFallback(input, normalizedMessage);
  }

  private createFallback(input: LlmProviderRequest, normalizedMessage: string): LlmProviderResponse {
    const fallbackLead =
      input.agent.fallbackMessage ?? input.agent.welcomeMessage ?? `I am ${input.agent.displayName}.`;
    const handoffHint = input.agent.handoffEnabled
      ? " If you need a person to take over, request human support in the chat."
      : "";

    return {
      content: `${fallbackLead} I do not have enough matching knowledge-base evidence to answer "${normalizedMessage}" confidently.${handoffHint}`,
      citations: null,
      metadata: this.createMetadata(true)
    };
  }

  private selectGroundedSentences(
    question: string,
    chunks: LlmRetrievedKnowledgeChunk[],
    limit = 3
  ): string[] {
    const terms = this.extractTerms(question);

    return chunks
      .flatMap((chunk) =>
        this.splitSentences(chunk.content).map((sentence) => ({
          sentence,
          score: this.scoreSentence(sentence, terms, chunk.relevanceScore ?? 0)
        }))
      )
      .filter((candidate) => candidate.score > 0)
      .sort((left, right) => right.score - left.score)
      .filter(
        (candidate, index, candidates) =>
          candidates.findIndex((existing) => existing.sentence === candidate.sentence) === index
      )
      .slice(0, limit)
      .map((candidate) => candidate.sentence);
  }

  private splitSentences(content: string): string[] {
    return content
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 20)
      .slice(0, 12);
  }

  private extractTerms(question: string): string[] {
    return Array.from(
      new Set(
        question
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((term) => term.length >= 3)
      )
    );
  }

  private scoreSentence(sentence: string, terms: string[], chunkScore: number): number {
    const normalized = sentence.toLowerCase();
    const matchedTerms = terms.filter((term) => normalized.includes(term)).length;

    return matchedTerms * 10 + Math.min(chunkScore, 20);
  }

  private createMetadata(usedFallback: boolean): LlmProviderResponse["metadata"] {
    return {
      providerName: this.name,
      mode: "deterministic",
      deterministic: true,
      usedFallback
    };
  }
}
