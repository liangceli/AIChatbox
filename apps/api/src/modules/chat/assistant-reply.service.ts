import type { Citation } from "@platform/types";
import { Injectable } from "@nestjs/common";

export interface RetrievedKnowledgeChunk {
  knowledgeDocumentId: string;
  chunkId: string;
  title: string;
  chunkIndex: number;
  sourceUri?: string | null;
  sourceLocator?: unknown;
  relevanceScore?: number;
  content: string;
}

interface ReplyInput {
  displayName: string;
  welcomeMessage?: string | null;
  fallbackMessage?: string | null;
  handoffEnabled?: boolean;
  userMessage: string;
  retrievedChunks: RetrievedKnowledgeChunk[];
}

interface ReplyOutput {
  content: string;
  citations: Citation[] | null;
  usedFallback: boolean;
}

function createExcerpt(content: string, maxLength = 220): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

@Injectable()
export class AssistantReplyService {
  generateReply(input: ReplyInput): ReplyOutput {
    const normalizedMessage = input.userMessage.trim();

    if (!normalizedMessage) {
      return {
        content: input.fallbackMessage ?? "I can help once you send a message.",
        citations: null,
        usedFallback: true
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
        usedFallback: false
      };
    }

    return this.createFallback(input, normalizedMessage);
  }

  private createFallback(input: ReplyInput, normalizedMessage: string): ReplyOutput {
    const fallbackLead = input.fallbackMessage ?? input.welcomeMessage ?? `I am ${input.displayName}.`;
    const handoffHint = input.handoffEnabled
      ? " If you need a person to take over, request human support in the chat."
      : "";

    return {
      content: `${fallbackLead} I do not have enough matching knowledge-base evidence to answer "${normalizedMessage}" confidently.${handoffHint}`,
      citations: null,
      usedFallback: true
    };
  }

  private selectGroundedSentences(
    question: string,
    chunks: RetrievedKnowledgeChunk[],
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
}
