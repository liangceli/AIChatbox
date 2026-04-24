import { KnowledgeDocumentStatus } from "@platform/database";
import { Inject, Injectable } from "@nestjs/common";
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

@Injectable()
export class KnowledgeRetrievalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async retrieveRelevantChunks(
    tenant: ResolvedTenant,
    question: string,
    limit = 3
  ): Promise<RetrievedKnowledgeChunk[]> {
    const tokens = this.extractSearchTerms(question);

    if (tokens.length === 0) {
      return [];
    }

    const candidates = await this.prisma.client.knowledgeChunk.findMany({
      where: {
        tenantId: tenant.id,
        knowledgeDocument: {
          status: KnowledgeDocumentStatus.READY
        },
        OR: tokens.map((token) => ({
          content: {
            contains: token,
            mode: "insensitive"
          }
        }))
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
      take: 40
    });

    const normalizedQuestion = question.trim().toLowerCase();

    type ScoredChunk = {
      score: number;
      chunk: RetrievedKnowledgeChunk;
    };

    return candidates
      .map((candidate) => ({
        score: this.scoreChunk(candidate.content, candidate.knowledgeDocument.title, normalizedQuestion, tokens),
        chunk: {
          knowledgeDocumentId: candidate.knowledgeDocument.id,
          chunkId: candidate.id,
          title: candidate.knowledgeDocument.title,
          chunkIndex: candidate.chunkIndex,
          sourceUri: candidate.knowledgeDocument.sourceUri ?? null,
          content: candidate.content
        }
      }) satisfies ScoredChunk)
      .filter((candidate: ScoredChunk) => candidate.score > 0)
      .sort(
        (left: ScoredChunk, right: ScoredChunk) =>
          right.score - left.score || left.chunk.chunkIndex - right.chunk.chunkIndex
      )
      .slice(0, limit)
      .map((candidate: ScoredChunk) => candidate.chunk);
  }

  private extractSearchTerms(question: string): string[] {
    const terms = question
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));

    return Array.from(new Set(terms)).slice(0, 8);
  }

  private scoreChunk(content: string, title: string, question: string, tokens: string[]): number {
    const normalizedContent = content.toLowerCase();
    const normalizedTitle = title.toLowerCase();
    let score = 0;

    if (question.length > 8 && normalizedContent.includes(question)) {
      score += 10;
    }

    for (const token of tokens) {
      if (normalizedContent.includes(token)) {
        score += 3;
      }

      if (normalizedTitle.includes(token)) {
        score += 1;
      }
    }

    return score;
  }
}
