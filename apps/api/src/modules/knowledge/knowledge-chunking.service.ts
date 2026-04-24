import { Injectable } from "@nestjs/common";

export interface ChunkedKnowledgeContent {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sourceLocator: {
    startOffset: number;
    endOffset: number;
  };
}

@Injectable()
export class KnowledgeChunkingService {
  private readonly targetChunkSize = 700;
  private readonly overlapSize = 120;

  chunkText(content: string): ChunkedKnowledgeContent[] {
    const normalized = content.replace(/\r\n/g, "\n").trim();

    if (!normalized) {
      return [];
    }

    const chunks: ChunkedKnowledgeContent[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < normalized.length) {
      let end = Math.min(start + this.targetChunkSize, normalized.length);

      if (end < normalized.length) {
        const boundary = this.findBoundary(normalized, start, end);

        if (boundary > start) {
          end = boundary;
        }
      }

      const rawChunk = normalized.slice(start, end).trim();

      if (rawChunk) {
        const trimmedStartOffset = normalized.indexOf(rawChunk, start);
        const trimmedEndOffset = trimmedStartOffset + rawChunk.length;

        chunks.push({
          chunkIndex,
          content: rawChunk,
          tokenCount: rawChunk.split(/\s+/).filter(Boolean).length,
          sourceLocator: {
            startOffset: trimmedStartOffset,
            endOffset: trimmedEndOffset
          }
        });
        chunkIndex += 1;
      }

      if (end >= normalized.length) {
        break;
      }

      start = Math.max(end - this.overlapSize, start + 1);

      while (start < normalized.length && /\s/.test(normalized[start] ?? "")) {
        start += 1;
      }
    }

    return chunks;
  }

  private findBoundary(content: string, start: number, end: number): number {
    const window = content.slice(start, end);
    const whitespaceIndex = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));

    if (whitespaceIndex <= Math.floor(window.length * 0.5)) {
      return end;
    }

    return start + whitespaceIndex;
  }
}
