import { Injectable } from "@nestjs/common";

export interface ChunkedKnowledgeContent {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sourceLocator?: {
    startOffset: number;
    endOffset: number;
  };
}

@Injectable()
export class KnowledgeChunkingService {
  private readonly targetChunkSize = 900;
  private readonly minimumBoundaryRatio = 0.55;
  private readonly overlapSize = 160;

  chunkText(content: string): ChunkedKnowledgeContent[] {
    const originalNormalized = content.replace(/\r\n/g, "\n").trim();
    const normalized = this.dedupeRepeatedBlocks(originalNormalized).trim();
    const canUseSourceOffsets = normalized === originalNormalized;

    if (!normalized) {
      return [];
    }

    const chunks: ChunkedKnowledgeContent[] = [];
    const seenChunkKeys = new Set<string>();
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
        const chunkKey = this.normalizeChunkKey(rawChunk);

        if (seenChunkKeys.has(chunkKey)) {
          if (end >= normalized.length) {
            break;
          }

          start = this.findOverlapStart(normalized, start, end);

          while (start < normalized.length && /\s/.test(normalized[start] ?? "")) {
            start += 1;
          }

          continue;
        }

        seenChunkKeys.add(chunkKey);
        const trimmedStartOffset = normalized.indexOf(rawChunk, start);
        const trimmedEndOffset = trimmedStartOffset + rawChunk.length;

        chunks.push({
          chunkIndex,
          content: rawChunk,
          tokenCount: rawChunk.split(/\s+/).filter(Boolean).length,
          sourceLocator:
            canUseSourceOffsets && trimmedStartOffset >= 0
              ? {
                  startOffset: trimmedStartOffset,
                  endOffset: trimmedEndOffset
                }
              : undefined
        });
        chunkIndex += 1;
      }

      if (end >= normalized.length) {
        break;
      }

      start = this.findOverlapStart(normalized, start, end);

      while (start < normalized.length && /\s/.test(normalized[start] ?? "")) {
        start += 1;
      }
    }

    return chunks;
  }

  private normalizeChunkKey(chunk: string): string {
    return chunk.replace(/\s+/g, " ").trim().toLowerCase();
  }

  private dedupeRepeatedBlocks(content: string): string {
    const blocks = content.split(/\n{2,}/);
    const seenBlocks = new Set<string>();
    const cleanedBlocks: string[] = [];

    for (const block of blocks) {
      const preservedBlock = block.trim();
      const key = preservedBlock.replace(/\s+/g, " ").trim().toLowerCase();

      if (!key || seenBlocks.has(key)) {
        continue;
      }

      seenBlocks.add(key);
      cleanedBlocks.push(preservedBlock);
    }

    return cleanedBlocks.join("\n\n");
  }

  private findBoundary(content: string, start: number, end: number): number {
    const window = content.slice(start, end);
    const paragraphIndex = window.lastIndexOf("\n\n");

    if (paragraphIndex > Math.floor(window.length * this.minimumBoundaryRatio)) {
      return start + paragraphIndex;
    }

    const sentenceBoundary = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
      window.lastIndexOf("; ")
    );

    if (sentenceBoundary > Math.floor(window.length * this.minimumBoundaryRatio)) {
      return start + sentenceBoundary + 1;
    }

    const whitespaceIndex = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));

    if (whitespaceIndex <= Math.floor(window.length * this.minimumBoundaryRatio)) {
      return end;
    }

    return start + whitespaceIndex;
  }

  private findOverlapStart(content: string, previousStart: number, previousEnd: number): number {
    const overlapFloor = Math.max(previousEnd - this.overlapSize, previousStart + 1);
    const window = content.slice(overlapFloor, previousEnd);
    const sentenceBoundary = Math.max(
      window.indexOf(". "),
      window.indexOf("? "),
      window.indexOf("! "),
      window.indexOf("\n")
    );

    let nextStart = sentenceBoundary >= 0 ? overlapFloor + sentenceBoundary + 1 : overlapFloor;

    while (nextStart < content.length && /\s/.test(content[nextStart] ?? "")) {
      nextStart += 1;
    }

    return nextStart;
  }
}
