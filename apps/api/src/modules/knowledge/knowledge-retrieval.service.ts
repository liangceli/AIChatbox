import type { LlmRetrievedKnowledgeChunk } from "@platform/ai-core";
import { KnowledgeDocumentStatus } from "@platform/database";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";

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
  chunk: LlmRetrievedKnowledgeChunk;
}

@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async retrieveRelevantChunks(
    tenant: ResolvedTenant,
    question: string,
    limit = 3
  ): Promise<LlmRetrievedKnowledgeChunk[]> {
    const tokens = this.extractSearchTerms(question);
    const candidateTerms = this.extractCandidateSearchTerms(question);
    const phrases = this.extractSearchPhrases(question);

    if (tokens.length === 0 || candidateTerms.length === 0) {
      return [];
    }

    const candidates = await this.prisma.client.knowledgeChunk.findMany({
      where: {
        tenantId: tenant.id,
        knowledgeDocument: {
          status: KnowledgeDocumentStatus.READY
        },
        OR: [
          ...candidateTerms.map((token) => ({
            content: {
              contains: token,
              mode: "insensitive" as const
            }
          })),
          ...candidateTerms.map((token) => ({
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

    const normalizedQuestion = this.extractNormalizedWords(question).join(" ");

    const minimumCoverage = tokens.length >= 4 ? 0.34 : 0.2;
    const minimumScore = tokens.length === 1 ? 6 : 4;
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
          candidate.score >= minimumScore && candidate.coverage >= minimumCoverage
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
    const terms = this.extractNormalizedWords(question).filter((term) => !STOP_WORDS.has(term));

    return Array.from(new Set(terms)).slice(0, 8);
  }

  private extractCandidateSearchTerms(question: string): string[] {
    const rawTerms = this.extractRawWords(question).filter((term) => !STOP_WORDS.has(this.normalizeTerm(term)));
    const normalizedTerms = rawTerms.map((term) => this.normalizeTerm(term));

    return Array.from(new Set([...rawTerms, ...normalizedTerms])).slice(0, 16);
  }

  private extractSearchPhrases(question: string): string[] {
    const words = this.extractNormalizedWords(question).filter((word) => !STOP_WORDS.has(word));
    const normalized = words.join(" ");

    if (!normalized) {
      return [];
    }

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
    const contentTerms = this.extractNormalizedWords(content);
    const titleTerms = this.extractNormalizedWords(title);
    const normalizedContent = contentTerms.join(" ");
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
      const contentOccurrences = this.countOccurrences(contentTerms, token);
      const titleOccurrences = this.countOccurrences(titleTerms, token);

      if (contentOccurrences > 0) {
        matchedTokens += 1;
        score += 4 + Math.min(contentOccurrences, 4);
      }

      if (titleOccurrences > 0) {
        if (contentOccurrences === 0) {
          matchedTokens += 1;
        }

        score += 4;
      }
    }

    if (matchedTokens >= 2) {
      score += matchedTokens * 2;
    }

    const coverage = tokens.length > 0 ? matchedTokens / tokens.length : 0;

    return { score, coverage };
  }

  private extractNormalizedWords(content: string): string[] {
    return this.extractRawWords(content)
      .map((term) => this.normalizeTerm(term))
      .filter((term) => term.length >= 3);
  }

  private extractRawWords(content: string): string[] {
    return content
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3);
  }

  private normalizeTerm(term: string): string {
    if (term.length > 4 && term.endsWith("ies")) {
      return `${term.slice(0, -3)}y`;
    }

    if (term.length > 4 && /(ses|xes|zes|ches|shes)$/.test(term)) {
      return term.slice(0, -2);
    }

    if (term.length > 3 && term.endsWith("s") && !term.endsWith("ss")) {
      return term.slice(0, -1);
    }

    return term;
  }

  private countOccurrences(terms: string[], token: string): number {
    return terms.filter((term) => term === token).length;
  }
}
