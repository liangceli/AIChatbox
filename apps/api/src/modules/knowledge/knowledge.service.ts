import { KnowledgeDocumentSourceType, KnowledgeDocumentStatus, Prisma } from "@platform/database";
import type {
  KnowledgeBaseRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentDetail,
  KnowledgeDocumentRecord,
  ImportUrlKnowledgeDocumentResult
} from "@platform/types";
import { slugify } from "@platform/utils";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { CreateKnowledgeBaseDto } from "./dto/create-knowledge-base.dto";
import { CreateManualKnowledgeDocumentDto } from "./dto/create-manual-knowledge-document.dto";
import { ImportUrlKnowledgeDocumentDto } from "./dto/import-url-knowledge-document.dto";
import { KnowledgeChunkingService } from "./knowledge-chunking.service";
import { KnowledgeUrlImportService } from "./knowledge-url-import.service";
import {
  toKnowledgeBaseRecord,
  toKnowledgeChunkRecord,
  toKnowledgeDocumentDetail,
  toKnowledgeDocumentRecord
} from "./knowledge.presenter";

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KnowledgeChunkingService)
    private readonly knowledgeChunkingService: KnowledgeChunkingService,
    @Inject(KnowledgeUrlImportService)
    private readonly knowledgeUrlImportService: KnowledgeUrlImportService
  ) {}

  async listKnowledgeBases(tenant: ResolvedTenant): Promise<KnowledgeBaseRecord[]> {
    const knowledgeBases = await this.prisma.client.knowledgeBase.findMany({
      where: {
        tenantId: tenant.id
      },
      include: {
        _count: {
          select: {
            documents: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return knowledgeBases.map(toKnowledgeBaseRecord);
  }

  async getKnowledgeBase(tenant: ResolvedTenant, knowledgeBaseId: string): Promise<KnowledgeBaseRecord> {
    const knowledgeBase = await this.prisma.client.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        tenantId: tenant.id
      },
      include: {
        _count: {
          select: {
            documents: true
          }
        }
      }
    });

    if (!knowledgeBase) {
      throw new NotFoundException("Knowledge base not found.");
    }

    return toKnowledgeBaseRecord(knowledgeBase);
  }

  async createKnowledgeBase(
    tenant: ResolvedTenant,
    input: CreateKnowledgeBaseDto
  ): Promise<KnowledgeBaseRecord> {
    const slug = slugify(input.slug?.trim() || input.name);

    if (!slug) {
      throw new BadRequestException("Knowledge base slug cannot be empty.");
    }

    const existing = await this.prisma.client.knowledgeBase.findUnique({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug
        }
      },
      include: {
        _count: {
          select: {
            documents: true
          }
        }
      }
    });

    if (existing) {
      throw new ConflictException(`Knowledge base slug already exists: ${slug}`);
    }

    const knowledgeBase = await this.prisma.client.knowledgeBase.create({
      data: {
        tenantId: tenant.id,
        slug,
        name: input.name.trim(),
        description: input.description?.trim() || null
      },
      include: {
        _count: {
          select: {
            documents: true
          }
        }
      }
    });

    return toKnowledgeBaseRecord(knowledgeBase);
  }

  async listKnowledgeDocuments(
    tenant: ResolvedTenant,
    knowledgeBaseId: string
  ): Promise<KnowledgeDocumentRecord[]> {
    await this.ensureKnowledgeBase(tenant, knowledgeBaseId);

    const documents = await this.prisma.client.knowledgeDocument.findMany({
      where: {
        tenantId: tenant.id,
        knowledgeBaseId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return documents.map(toKnowledgeDocumentRecord);
  }

  async createManualDocument(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    input: CreateManualKnowledgeDocumentDto
  ): Promise<KnowledgeDocumentRecord> {
    await this.ensureKnowledgeBase(tenant, knowledgeBaseId);

    const normalizedContent = input.content.trim();

    if (!normalizedContent) {
      throw new BadRequestException("Document content cannot be empty.");
    }

    const sourceType = this.resolveSourceType(input.sourceType);
    const document = await this.prisma.client.knowledgeDocument.create({
      data: {
        tenantId: tenant.id,
        knowledgeBaseId,
        title: input.title.trim(),
        sourceType,
        sourceUri: input.sourceUri?.trim() || null,
        content: normalizedContent,
        checksum: this.createChecksum(normalizedContent),
        status: KnowledgeDocumentStatus.INDEXING,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined
      }
    });

    await this.processDocumentContent(tenant.id, document.id, normalizedContent, input.metadata);

    const storedDocument = await this.prisma.client.knowledgeDocument.findUnique({
      where: {
        id_tenantId: {
          id: document.id,
          tenantId: tenant.id
        }
      }
    });

    if (!storedDocument) {
      throw new NotFoundException("Knowledge document not found after ingestion.");
    }

    return toKnowledgeDocumentRecord(storedDocument);
  }

  async importUrlDocument(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    input: ImportUrlKnowledgeDocumentDto
  ): Promise<KnowledgeDocumentRecord> {
    await this.ensureKnowledgeBase(tenant, knowledgeBaseId);

    const url = input.url.trim();
    const fetched = await this.knowledgeUrlImportService.fetchContent(url);
    const title = input.title?.trim() || fetched.title || url;

    return this.createManualDocument(tenant, knowledgeBaseId, {
      title,
      content: fetched.content,
      sourceType: "url",
      sourceUri: url,
      metadata: {
        importedFromUrl: true,
        importedAt: new Date().toISOString()
      }
    });
  }

  async importUrlDocuments(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    urls: string[]
  ): Promise<ImportUrlKnowledgeDocumentResult[]> {
    await this.ensureKnowledgeBase(tenant, knowledgeBaseId);

    const uniqueUrls = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
    const results: ImportUrlKnowledgeDocumentResult[] = [];

    for (const url of uniqueUrls) {
      try {
        const document = await this.importUrlDocument(tenant, knowledgeBaseId, { url });

        results.push({
          url,
          status: "ready",
          document
        });
      } catch (error: unknown) {
        results.push({
          url,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown URL import error"
        });
      }
    }

    return results;
  }

  async getKnowledgeDocument(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    documentId: string
  ): Promise<KnowledgeDocumentDetail> {
    const document = await this.prisma.client.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
        knowledgeBaseId
      },
      include: {
        chunks: {
          orderBy: {
            chunkIndex: "asc"
          }
        }
      }
    });

    if (!document) {
      throw new NotFoundException("Knowledge document not found.");
    }

    return toKnowledgeDocumentDetail(document);
  }

  async listKnowledgeDocumentChunks(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    documentId: string
  ): Promise<KnowledgeChunkRecord[]> {
    await this.ensureKnowledgeDocument(tenant.id, knowledgeBaseId, documentId);

    const chunks = await this.prisma.client.knowledgeChunk.findMany({
      where: {
        tenantId: tenant.id,
        knowledgeDocumentId: documentId
      },
      orderBy: {
        chunkIndex: "asc"
      }
    });

    return chunks.map(toKnowledgeChunkRecord);
  }

  async reprocessKnowledgeDocument(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    documentId: string,
    replacementContent?: string
  ): Promise<KnowledgeDocumentDetail> {
    const document = await this.prisma.client.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        tenantId: tenant.id,
        knowledgeBaseId
      }
    });

    if (!document) {
      throw new NotFoundException("Knowledge document not found.");
    }

    if (document.status === KnowledgeDocumentStatus.ARCHIVED) {
      throw new BadRequestException("Archived knowledge documents cannot be reprocessed.");
    }

    const normalizedContent = replacementContent?.trim() || document.content?.trim();

    if (!normalizedContent) {
      throw new BadRequestException("No stored document content is available to reprocess.");
    }

    await this.processDocumentContent(tenant.id, document.id, normalizedContent, document.metadata);

    return this.getKnowledgeDocument(tenant, knowledgeBaseId, documentId);
  }

  async archiveKnowledgeDocument(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    documentId: string
  ): Promise<KnowledgeDocumentRecord> {
    await this.ensureKnowledgeDocument(tenant.id, knowledgeBaseId, documentId);

    const document = await this.prisma.client.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({
        where: {
          tenantId: tenant.id,
          knowledgeDocumentId: documentId
        }
      });

      return tx.knowledgeDocument.update({
        where: {
          id_tenantId: {
            id: documentId,
            tenantId: tenant.id
          }
        },
        data: {
          status: KnowledgeDocumentStatus.ARCHIVED,
          chunkCount: 0
        }
      });
    });

    return toKnowledgeDocumentRecord(document);
  }

  async deleteKnowledgeDocument(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    documentId: string
  ): Promise<void> {
    await this.ensureKnowledgeDocument(tenant.id, knowledgeBaseId, documentId);

    await this.prisma.client.knowledgeDocument.delete({
      where: {
        id_tenantId: {
          id: documentId,
          tenantId: tenant.id
        }
      }
    });
  }

  private async ensureKnowledgeBase(tenant: ResolvedTenant, knowledgeBaseId: string): Promise<void> {
    const knowledgeBase = await this.prisma.client.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        tenantId: tenant.id
      },
      select: {
        id: true
      }
    });

    if (!knowledgeBase) {
      throw new NotFoundException("Knowledge base not found.");
    }
  }

  private async ensureKnowledgeDocument(
    tenantId: string,
    knowledgeBaseId: string,
    documentId: string
  ): Promise<void> {
    const document = await this.prisma.client.knowledgeDocument.findFirst({
      where: {
        id: documentId,
        tenantId,
        knowledgeBaseId
      },
      select: {
        id: true
      }
    });

    if (!document) {
      throw new NotFoundException("Knowledge document not found.");
    }
  }

  private async processDocumentContent(
    tenantId: string,
    documentId: string,
    content: string,
    currentMetadata?: Prisma.JsonValue | Record<string, unknown> | null
  ): Promise<void> {
    const chunks = this.knowledgeChunkingService.chunkText(content);

    if (chunks.length === 0) {
      throw new BadRequestException("Document content did not produce any chunks.");
    }

    const checksum = this.createChecksum(content);

    try {
      await this.prisma.client.$transaction(async (tx) => {
        await tx.knowledgeDocument.update({
          where: {
            id_tenantId: {
              id: documentId,
              tenantId
            }
          },
          data: {
            status: KnowledgeDocumentStatus.INDEXING,
            content,
            checksum,
            chunkCount: 0
          }
        });

        await tx.knowledgeChunk.deleteMany({
          where: {
            tenantId,
            knowledgeDocumentId: documentId
          }
        });

        await tx.knowledgeChunk.createMany({
          data: chunks.map((chunk) => ({
            tenantId,
            knowledgeDocumentId: documentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            sourceLocator: chunk.sourceLocator,
            metadata: {
              checksum
            }
          }))
        });

        await tx.knowledgeDocument.update({
          where: {
            id_tenantId: {
              id: documentId,
              tenantId
            }
          },
          data: {
            chunkCount: chunks.length,
            status: KnowledgeDocumentStatus.READY,
            ingestedAt: new Date(),
            metadata: {
              ...(this.isPlainObject(currentMetadata) ? currentMetadata : {}),
              ingestion: {
                chunkCount: chunks.length,
                checksum,
                processedAt: new Date().toISOString()
              }
            } as Prisma.InputJsonValue
          }
        });
      });

      this.logger.log(
        `Processed knowledge document ${documentId} for tenant ${tenantId}: ${chunks.length} chunks`
      );
    } catch (error: unknown) {
      await this.prisma.client.knowledgeDocument.update({
        where: {
          id_tenantId: {
            id: documentId,
            tenantId
          }
        },
        data: {
          status: KnowledgeDocumentStatus.FAILED,
          metadata: {
            ...(this.isPlainObject(currentMetadata) ? currentMetadata : {}),
            ingestionError: error instanceof Error ? error.message : "Unknown ingestion error",
            failedAt: new Date().toISOString()
          } as Prisma.InputJsonValue
        }
      });

      throw error;
    }
  }

  private createChecksum(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  private resolveSourceType(sourceType?: string): KnowledgeDocumentSourceType {
    switch (sourceType?.trim().toUpperCase()) {
      case "FILE":
        return KnowledgeDocumentSourceType.FILE;
      case "URL":
        return KnowledgeDocumentSourceType.URL;
      case "INTEGRATION":
        return KnowledgeDocumentSourceType.INTEGRATION;
      default:
        return KnowledgeDocumentSourceType.MANUAL;
    }
  }

}
