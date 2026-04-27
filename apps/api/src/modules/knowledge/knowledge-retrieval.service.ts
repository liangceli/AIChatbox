import { KnowledgeDocumentStatus } from "@platform/database";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import type { RetrievedKnowledgeChunk } from "../chat/assistant-reply.service";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "from",
  "how",
  "i",
  "is",
  "of",
  "on",
  "or",
  "policy",
  "the",
  "to",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you"
]);

interface ScoredCandidate {
  score: number;
  coverage: number;
  chunk: RetrievedKnowledgeChunk;
}

@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async retrieveRelevantChunks(
    tenant: ResolvedTenant,
    question: string,
    limit = 3
  ): Promise<RetrievedKnowledgeChunk[]> {
    const tokens = this.extractSearchTerms(question);
    const phrases = this.extractSearchPhrases(question);

    if (tokens.length === 0) {
      return [];
    }

    const candidates = await this.prisma.client.knowledgeChunk.findMany({
      where: {
        tenantId: tenant.id,
        knowledgeDocument: {
          status: KnowledgeDocumentStatus.READY
        },
        OR: [
          ...tokens.map((token) => ({
            content: {
              contains: token,
              mode: "insensitive" as const
            }
          })),
          ...tokens.map((token) => ({
            knowledgeDocument: {
              title: {
                contains: token,
                mode: "insensitive" as const
              }
            }
          }))
        ]
      },
      include: {
        knowledgeDocument: {
          select: {
            id: true,
            title: true,
            sourceUri: true
          }
        }
      },
      take: 80
    });

    const normalizedQuestion = question.trim().toLowerCase();

    const minimumCoverage = tokens.length >= 4 ? 0.34 : 0.2;
    const scored = candidates
      .map((candidate) => {
        const score = this.scoreChunk(
          candidate.content,
          candidate.knowledgeDocument.title,
          normalizedQuestion,
          tokens,
          phrases
        );

        return {
          score: score.score,
          coverage: score.coverage,
          chunk: {
            knowledgeDocumentId: candidate.knowledgeDocument.id,
            chunkId: candidate.id,
            title: candidate.knowledgeDocument.title,
            chunkIndex: candidate.chunkIndex,
            sourceUri: candidate.knowledgeDocument.sourceUri ?? null,
            sourceLocator: candidate.sourceLocator ?? null,
            relevanceScore: score.score,
            content: candidate.content
          }
        } satisfies ScoredCandidate;
      })
      .filter(
        (candidate: ScoredCandidate) =>
          candidate.score >= 4 && candidate.coverage >= minimumCoverage
      )
      .sort(
        (left: ScoredCandidate, right: ScoredCandidate) =>
          right.score - left.score ||
          right.coverage - left.coverage ||
          left.chunk.title.localeCompare(right.chunk.title) ||
          left.chunk.chunkIndex - right.chunk.chunkIndex
      )
      .slice(0, limit);

    this.logger.debug(
      `Retrieved ${scored.length} chunks for tenant ${tenant.slug}: ${scored
        .slice(0, limit)
        .map((candidate) => `${candidate.chunk.knowledgeDocumentId}/${candidate.chunk.chunkIndex}:${candidate.score}`)
        .join(", ")}`
    );

    return scored.map((candidate) => candidate.chunk);
  }

  private extractSearchTerms(question: string): string[] {
    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));

    return Array.from(new Set(terms)).slice(0, 8);
  }

  private extractSearchPhrases(question: string): string[] {
    const normalized = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) {
      return [];
    }

    const words = normalized
      .split(" ")
      .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
    const phrases: string[] = [];

    for (let index = 0; index < words.length - 1; index += 1) {
      phrases.push(`${words[index]} ${words[index + 1]}`);
    }

    return phrases.slice(0, 4);
  }

  private scoreChunk(
    content: string,
    title: string,
    question: string,
    tokens: string[],
    phrases: string[]
  ): { score: number; coverage: number } {
    const normalizedContent = content.toLowerCase();
    const normalizedTitle = title.toLowerCase();
    let score = 0;
    let matchedTokens = 0;

    if (question.length > 8 && normalizedContent.includes(question)) {
      score += 16;
    }

    for (const phrase of phrases) {
      if (normalizedContent.includes(phrase)) {
        score += 8;
      }
    }

    for (const token of tokens) {
      if (normalizedContent.includes(token)) {
        matchedTokens += 1;
        score += 4 + Math.min(this.countOccurrences(normalizedContent, token), 4);
      }

      if (normalizedTitle.includes(token)) {
        score += 2;
      }
    }

    if (matchedTokens >= 2) {
      score += matchedTokens * 2;
    }

    const coverage = tokens.length > 0 ? matchedTokens / tokens.length : 0;

    return { score, coverage };
  }

  private countOccurrences(content: string, token: string): number {
    let count = 0;
    let offset = content.indexOf(token);

    while (offset >= 0) {
      count += 1;
      offset = content.indexOf(token, offset + token.length);
    }

    return count;
  }
}
