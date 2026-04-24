import { KnowledgeDocumentSourceType, KnowledgeDocumentStatus, Prisma } from "@platform/database";
import type { KnowledgeBaseRecord, KnowledgeDocumentRecord } from "@platform/types";
import { slugify } from "@platform/utils";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { CreateKnowledgeBaseDto } from "./dto/create-knowledge-base.dto";
import { CreateManualKnowledgeDocumentDto } from "./dto/create-manual-knowledge-document.dto";
import { KnowledgeChunkingService } from "./knowledge-chunking.service";
import { toKnowledgeBaseRecord, toKnowledgeDocumentRecord } from "./knowledge.presenter";

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KnowledgeChunkingService)
    private readonly knowledgeChunkingService: KnowledgeChunkingService
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
        status: KnowledgeDocumentStatus.INDEXING,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : undefined
      }
    });

    try {
      const chunks = this.knowledgeChunkingService.chunkText(normalizedContent);

      await this.prisma.client.$transaction([
        this.prisma.client.knowledgeChunk.createMany({
          data: chunks.map((chunk) => ({
            tenantId: tenant.id,
            knowledgeDocumentId: document.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            sourceLocator: chunk.sourceLocator
          }))
        }),
        this.prisma.client.knowledgeDocument.update({
          where: {
            id_tenantId: {
              id: document.id,
              tenantId: tenant.id
            }
          },
          data: {
            chunkCount: chunks.length,
            status: KnowledgeDocumentStatus.READY,
            ingestedAt: new Date()
          }
        })
      ]);
    } catch (error: unknown) {
      await this.prisma.client.knowledgeDocument.update({
        where: {
          id_tenantId: {
            id: document.id,
            tenantId: tenant.id
          }
        },
        data: {
          status: KnowledgeDocumentStatus.FAILED,
          metadata: {
            ...(input.metadata ?? {}),
            ingestionError: error instanceof Error ? error.message : "Unknown ingestion error"
          } as Prisma.InputJsonValue
        }
      });

      throw error;
    }

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
