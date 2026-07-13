import {
  KnowledgeChunkStatus,
  KnowledgeDocumentSourceType,
  KnowledgeDocumentStatus,
  KnowledgeEmbeddingStatus,
  Prisma
} from "@platform/database";
import type {
  KnowledgeBaseRecord,
  KnowledgeChunkRecord,
  KnowledgeDocumentDetail,
  KnowledgeDocumentRecord,
  ImportKnowledgeFileResult,
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
import { KnowledgeMetadataService } from "./knowledge-metadata.service";
import { KnowledgeUrlImportService } from "./knowledge-url-import.service";
import { KnowledgeTableImportService, type UploadedKnowledgeFile } from "./knowledge-table-import.service";
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
    @Inject(KnowledgeMetadataService)
    private readonly knowledgeMetadataService: KnowledgeMetadataService,
    @Inject(KnowledgeUrlImportService)
    private readonly knowledgeUrlImportService: KnowledgeUrlImportService,
    @Inject(KnowledgeTableImportService)
    private readonly knowledgeTableImportService: KnowledgeTableImportService
  ) {}

  async listKnowledgeBases(tenant: ResolvedTenant): Promise<KnowledgeBaseRecord[]> {
    const knowledgeBases = await this.prisma.client.knowledgeBase.findMany({
      where: {
        tenantId: tenant.id
      },
      include: {
        _count: {
          select: {
            documents: {
              where: {
                status: {
                  not: KnowledgeDocumentStatus.DELETED
                }
              }
            }
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
            documents: {
              where: {
                status: {
                  not: KnowledgeDocumentStatus.DELETED
                }
              }
            }
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
            documents: {
              where: {
                status: {
                  not: KnowledgeDocumentStatus.DELETED
                }
              }
            }
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
            documents: {
              where: {
                status: {
                  not: KnowledgeDocumentStatus.DELETED
                }
              }
            }
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
        knowledgeBaseId,
        status: {
          not: KnowledgeDocumentStatus.DELETED
        }
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
    const knowledgeMetadata = this.knowledgeMetadataService.buildDocumentMetadata({
      title: input.title.trim(),
      content: normalizedContent,
      sourceUri: input.sourceUri?.trim() || null,
      currentMetadata: input.metadata
    });
    const mergedMetadata = this.knowledgeMetadataService.mergeIntoMetadata(
      input.metadata,
      knowledgeMetadata
    );
    const checksum = this.createChecksum(normalizedContent);
    const existingDocument = await this.findActiveDocumentBySource(
      tenant.id,
      knowledgeBaseId,
      sourceType,
      input.sourceUri?.trim() || null
    );

    if (existingDocument) {
      await this.processDocumentContent(
        tenant.id,
        existingDocument.id,
        normalizedContent,
        mergedMetadata
      );

      const updatedDocument = await this.prisma.client.knowledgeDocument.findUnique({
        where: {
          id_tenantId: {
            id: existingDocument.id,
            tenantId: tenant.id
          }
        }
      });

      if (!updatedDocument) {
        throw new NotFoundException("Knowledge document not found after update.");
      }

      return toKnowledgeDocumentRecord(updatedDocument);
    }

    const document = await this.prisma.client.knowledgeDocument.create({
      data: {
        tenantId: tenant.id,
        knowledgeBaseId,
        title: input.title.trim(),
        sourceType,
        sourceUri: input.sourceUri?.trim() || null,
        content: normalizedContent,
        checksum,
        status: KnowledgeDocumentStatus.INDEXING,
        metadata: mergedMetadata as Prisma.InputJsonValue
      }
    });

    await this.processDocumentContent(tenant.id, document.id, normalizedContent, mergedMetadata);

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

  async importFileDocument(
    tenant: ResolvedTenant,
    knowledgeBaseId: string,
    file?: UploadedKnowledgeFile
  ): Promise<ImportKnowledgeFileResult> {
    await this.ensureKnowledgeBase(tenant, knowledgeBaseId);

    if (!file) {
      throw new BadRequestException("Choose a CSV or XLSX file to import.");
    }

    const parsed = await this.knowledgeTableImportService.parse(file);
    const safeFileName = file.originalname.replace(/[\\/\u0000-\u001f]+/g, "_").slice(0, 180);
    const document = await this.createManualDocument(tenant, knowledgeBaseId, {
      title: safeFileName,
      content: parsed.content,
      sourceType: "file",
      sourceUri: safeFileName,
      metadata: {
        fileName: safeFileName,
        fileType: file.mimetype || "application/octet-stream",
        fileSize: file.size,
        ingestionMethod: "table-file",
        tableExtraction: parsed.summary
      }
    });

    return { document, extraction: parsed.summary };
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
        knowledgeBaseId,
        status: {
          not: KnowledgeDocumentStatus.DELETED
        }
      },
      include: {
        chunks: {
          where: {
            status: KnowledgeChunkStatus.READY
          },
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
        knowledgeDocumentId: documentId,
        status: KnowledgeChunkStatus.READY,
        knowledgeDocument: {
          status: KnowledgeDocumentStatus.READY
        }
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

    if (document.status === KnowledgeDocumentStatus.DELETED) {
      throw new BadRequestException("Deleted knowledge documents cannot be reprocessed.");
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
      await tx.knowledgeChunk.updateMany({
        where: {
          tenantId: tenant.id,
          knowledgeDocumentId: documentId
        },
        data: {
          status: KnowledgeChunkStatus.ARCHIVED
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
          chunkCount: 0,
          archivedAt: new Date()
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

    await this.prisma.client.$transaction(async (tx) => {
      await tx.knowledgeChunk.updateMany({
        where: {
          tenantId: tenant.id,
          knowledgeDocumentId: documentId
        },
        data: {
          status: KnowledgeChunkStatus.DELETED
        }
      });

      await tx.knowledgeDocument.update({
        where: {
          id_tenantId: {
            id: documentId,
            tenantId: tenant.id
          }
        },
        data: {
          status: KnowledgeDocumentStatus.DELETED,
          chunkCount: 0,
          deletedAt: new Date()
        }
      });
    });
  }

  private async findActiveDocumentBySource(
    tenantId: string,
    knowledgeBaseId: string,
    sourceType: KnowledgeDocumentSourceType,
    sourceUri: string | null
  ): Promise<{ id: string } | null> {
    if (
      !sourceUri ||
      (sourceType !== KnowledgeDocumentSourceType.FILE && sourceType !== KnowledgeDocumentSourceType.URL)
    ) {
      return null;
    }

    return this.prisma.client.knowledgeDocument.findFirst({
      where: {
        tenantId,
        knowledgeBaseId,
        sourceType,
        sourceUri,
        status: {
          notIn: [KnowledgeDocumentStatus.ARCHIVED, KnowledgeDocumentStatus.DELETED]
        }
      },
      select: {
        id: true
      },
      orderBy: {
        updatedAt: "desc"
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
        knowledgeBaseId,
        status: {
          not: KnowledgeDocumentStatus.DELETED
        }
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
    const checksum = this.createChecksum(content);
    const storedDocument = await this.prisma.client.knowledgeDocument.findUnique({
      where: {
        id_tenantId: {
          id: documentId,
          tenantId
        }
      },
      select: {
        checksum: true,
        chunkCount: true,
        metadata: true,
        status: true,
        title: true,
        sourceUri: true,
        version: true
      }
    });

    if (!storedDocument) {
      throw new NotFoundException("Knowledge document not found.");
    }

    const previousReady = storedDocument.status === KnowledgeDocumentStatus.READY;
    const previousMetadata = this.isPlainObject(storedDocument.metadata) ? storedDocument.metadata : {};
    const nextVersion =
      previousReady && storedDocument.checksum !== checksum
        ? storedDocument.version + 1
        : storedDocument.version;

    if (previousReady && storedDocument.checksum === checksum) {
      await this.prisma.client.knowledgeDocument.update({
        where: {
          id_tenantId: {
            id: documentId,
            tenantId
          }
        },
        data: {
          processingError: null,
          metadata: {
            ...previousMetadata,
            ingestion: {
              ...(this.isPlainObject(previousMetadata.ingestion) ? previousMetadata.ingestion : {}),
              checksum,
              skippedAt: new Date().toISOString(),
              skipReason: "content_hash_unchanged"
            }
          } as Prisma.InputJsonValue
        }
      });

      return;
    }

    const documentMetadata =
      this.knowledgeMetadataService.readKnowledgeMetadata(currentMetadata) ??
      this.knowledgeMetadataService.buildDocumentMetadata({
        title: storedDocument.title,
        content,
        sourceUri: storedDocument.sourceUri ?? null,
        currentMetadata
      });
    const baseMetadata = this.knowledgeMetadataService.mergeIntoMetadata(
      currentMetadata,
      documentMetadata
    );

    try {
      const chunks = this.knowledgeChunkingService.chunkText(content);

      if (chunks.length === 0) {
        throw new BadRequestException("Document content did not produce any chunks.");
      }

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
            chunkCount: 0,
            processingError: null
          }
        });

        await tx.knowledgeChunk.updateMany({
          where: {
            tenantId,
            knowledgeDocumentId: documentId
          },
          data: {
            status: KnowledgeChunkStatus.INACTIVE
          }
        });

        await tx.knowledgeChunk.createMany({
          data: chunks.map((chunk) => ({
            tenantId,
            knowledgeDocumentId: documentId,
            version: nextVersion,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            contentHash: this.createChecksum(chunk.content),
            tokenCount: chunk.tokenCount,
            status: KnowledgeChunkStatus.READY,
            embeddingStatus: KnowledgeEmbeddingStatus.DISABLED,
            sourceLocator: chunk.sourceLocator,
            metadata: this.knowledgeMetadataService.mergeIntoMetadata(
              { checksum },
              this.knowledgeMetadataService.buildChunkMetadata({
                documentMetadata,
                content: chunk.content,
                sourceLocator: chunk.sourceLocator
              })
            ) as Prisma.InputJsonValue
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
            version: nextVersion,
            ingestedAt: new Date(),
            processingError: null,
            metadata: {
              ...baseMetadata,
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
      const errorMessage = error instanceof Error ? error.message : "Unknown ingestion error";
      const failureMetadata = {
        ...(this.isPlainObject(currentMetadata) ? currentMetadata : previousMetadata),
        ingestionError: errorMessage,
        failedAt: new Date().toISOString()
      } as Prisma.InputJsonValue;

      await this.prisma.client.knowledgeDocument.update({
        where: {
          id_tenantId: {
            id: documentId,
            tenantId
          }
        },
        data: {
          status: previousReady ? KnowledgeDocumentStatus.READY : KnowledgeDocumentStatus.FAILED,
          chunkCount: previousReady ? storedDocument.chunkCount : 0,
          processingError: errorMessage,
          metadata: failureMetadata
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
