import type { Citation } from "@platform/types";
import { Injectable } from "@nestjs/common";

export interface RetrievedKnowledgeChunk {
  knowledgeDocumentId: string;
  chunkId: string;
  title: string;
  chunkIndex: number;
  sourceUri?: string | null;
  content: string;
}

interface ReplyInput {
  displayName: string;
  welcomeMessage?: string | null;
  fallbackMessage?: string | null;
  userMessage: string;
  retrievedChunks: RetrievedKnowledgeChunk[];
}

interface ReplyOutput {
  content: string;
  citations: Citation[] | null;
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
        citations: null
      };
    }

    if (input.retrievedChunks.length > 0) {
      const citations = input.retrievedChunks.map((chunk) => ({
        knowledgeDocumentId: chunk.knowledgeDocumentId,
        chunkId: chunk.chunkId,
        title: chunk.title,
        chunkIndex: chunk.chunkIndex,
        sourceUri: chunk.sourceUri ?? null,
        excerpt: createExcerpt(chunk.content, 180)
      }));
      const primary = citations[0]!;
      const supporting = citations
        .slice(1, 3)
        .map((citation) => `"${citation.excerpt}"`)
        .join(" ");

      return {
        content: [
          input.welcomeMessage ?? `I am ${input.displayName}.`,
          `Based on the current knowledge base, the most relevant guidance is: "${primary.excerpt}".`,
          supporting ? `Additional context: ${supporting}` : null
        ]
          .filter(Boolean)
          .join(" "),
        citations
      };
    }

    const fallbackLead = input.fallbackMessage ?? input.welcomeMessage ?? `I am ${input.displayName}.`;

    return {
      content: `${fallbackLead} I could not find a relevant knowledge-base match for "${normalizedMessage}".`,
      citations: null
    };
  }
}
