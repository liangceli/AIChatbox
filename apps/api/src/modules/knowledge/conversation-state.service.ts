import type { KnowledgeStructuredMetadata } from "@platform/types";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@platform/database";
import { PrismaService } from "../../common/prisma/prisma.service";
import { KnowledgeMetadataService } from "./knowledge-metadata.service";

export interface ConversationRetrievalContext {
  rag: {
    productContext?: KnowledgeStructuredMetadata | null;
    pendingClarification?: unknown | null;
  };
}

interface PersistRetrievalStateInput {
  productContext?: KnowledgeStructuredMetadata | null;
  pendingClarification?: unknown | null;
  confidence?: {
    level?: string;
    bestScore?: number;
    bestCoverage?: number;
  };
  entitySource?: string;
}

@Injectable()
export class ConversationStateService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KnowledgeMetadataService)
    private readonly knowledgeMetadataService: KnowledgeMetadataService
  ) {}

  async buildRetrievalContext(
    tenantId: string,
    conversationId: string,
    conversationMetadata: unknown
  ): Promise<ConversationRetrievalContext> {
    const legacy = this.readLegacyRagContext(conversationMetadata);
    const state = await this.prisma.client.conversationState.findFirst({
      where: {
        tenantId,
        conversationId
      },
      include: {
        activeProductCatalog: true
      }
    });

    const stateJson = isPlainObject(state?.stateJson) ? state.stateJson : {};
    const activeProductCatalog =
      state?.activeProductCatalog?.status === "ACTIVE" ? state.activeProductCatalog : null;
    const stateProductContext =
      activeProductCatalog
        ? this.productCatalogToMetadata(activeProductCatalog) ??
          this.knowledgeMetadataService.readKnowledgeMetadata(state?.activeProductContext) ??
          legacy.productContext ??
          null
        : state?.activeProductCatalogId
          ? null
          : this.knowledgeMetadataService.readKnowledgeMetadata(state?.activeProductContext) ??
            legacy.productContext ??
            null;

    return {
      rag: {
        productContext: stateProductContext,
        pendingClarification:
          Object.prototype.hasOwnProperty.call(stateJson, "pendingClarification")
            ? stateJson.pendingClarification
            : legacy.pendingClarification
      }
    };
  }

  async persistRetrievalState(
    tx: Prisma.TransactionClient,
    tenantId: string,
    conversationId: string,
    currentMetadata: unknown,
    updates: PersistRetrievalStateInput
  ): Promise<Record<string, unknown>> {
    const mergedMetadata = this.mergeConversationRagMetadata(currentMetadata, updates);
    const existingState = await tx.conversationState.findFirst({
      where: {
        tenantId,
        conversationId
      }
    });
    const stateJson = isPlainObject(existingState?.stateJson) ? { ...existingState.stateJson } : {};
    const hasPendingUpdate = Object.prototype.hasOwnProperty.call(updates, "pendingClarification");
    const hasProductUpdate = Object.prototype.hasOwnProperty.call(updates, "productContext");
    let activeProductCatalogId: string | undefined;

    if (hasPendingUpdate) {
      if (updates.pendingClarification) {
        stateJson.pendingClarification = updates.pendingClarification;
      } else {
        delete stateJson.pendingClarification;
      }
    }

    if (updates.productContext) {
      const catalogEntry = await this.upsertProductCatalogEntry(
        tx,
        tenantId,
        updates.productContext,
        "conversation"
      );

      if (catalogEntry) {
        activeProductCatalogId = catalogEntry.id;
      }

      stateJson.productContext = toPrismaJson(updates.productContext) as Prisma.JsonValue;
    } else if (hasProductUpdate) {
      delete stateJson.productContext;
    }

    if (!existingState && !hasPendingUpdate && !hasProductUpdate) {
      return mergedMetadata;
    }

    const confidence = this.confidenceToScore(updates.confidence);
    const updateData: Prisma.ConversationStateUpdateInput = {
      revision: {
        increment: 1
      },
      stateJson: toPrismaJson(stateJson)
    };

    if (hasProductUpdate) {
      if (updates.productContext) {
        updateData.activeProductContext = toPrismaJson(updates.productContext);
        updateData.activeConfidence = confidence;
        updateData.activeEntitySource = updates.entitySource ?? "retrieval";
        updateData.activeProductCatalog = activeProductCatalogId
          ? {
              connect: {
                id: activeProductCatalogId
              }
            }
          : {
              disconnect: true
            };
      } else {
        updateData.activeProductContext = Prisma.DbNull;
        updateData.activeConfidence = 0;
        updateData.activeEntitySource = null;
        updateData.activeProductCatalog = {
          disconnect: true
        };
      }
    }

    await tx.conversationState.upsert({
      where: {
        conversationId
      },
      update: updateData,
      create: {
        conversationId,
        tenantId,
        activeProductCatalogId,
        activeProductContext: updates.productContext ? toPrismaJson(updates.productContext) : undefined,
        activeConfidence: updates.productContext ? confidence : 0,
        activeEntitySource: updates.productContext ? updates.entitySource ?? "retrieval" : undefined,
        stateJson: toPrismaJson(stateJson)
      }
    });

    return mergedMetadata;
  }

  async backfillTenantProductCatalog(tenantId: string): Promise<number> {
    const records = await this.prisma.client.knowledgeChunk.findMany({
      where: {
        tenantId
      },
      select: {
        metadata: true,
        knowledgeDocument: {
          select: {
            metadata: true
          }
        }
      }
    });
    let count = 0;

    for (const record of records) {
      const metadata =
        this.knowledgeMetadataService.readKnowledgeMetadata(record.metadata) ??
        this.knowledgeMetadataService.readKnowledgeMetadata(record.knowledgeDocument.metadata);

      if (!metadata) {
        continue;
      }

      const createdOrUpdated = await this.upsertProductCatalogEntry(
        this.prisma.client,
        tenantId,
        metadata,
        "knowledge_metadata"
      );

      if (createdOrUpdated) {
        count += 1;
      }
    }

    return count;
  }

  mergeConversationRagMetadata(
    metadata: unknown,
    updates: {
      productContext?: KnowledgeStructuredMetadata | null;
      pendingClarification?: unknown | null;
    }
  ): Record<string, unknown> {
    const base = isPlainObject(metadata) ? { ...metadata } : {};
    const rag = isPlainObject(base.rag) ? { ...base.rag } : {};

    if (Object.prototype.hasOwnProperty.call(updates, "productContext")) {
      if (updates.productContext) {
        rag.productContext = updates.productContext;
      } else {
        delete rag.productContext;
      }
    }

    if (Object.prototype.hasOwnProperty.call(updates, "pendingClarification")) {
      if (updates.pendingClarification) {
        rag.pendingClarification = updates.pendingClarification;
      } else {
        delete rag.pendingClarification;
      }
    }

    if (Object.keys(rag).length > 0) {
      base.rag = rag;
    } else {
      delete base.rag;
    }

    return stripUndefined(base) as Record<string, unknown>;
  }

  private async upsertProductCatalogEntry(
    tx: Pick<Prisma.TransactionClient, "productCatalog">,
    tenantId: string,
    metadata: KnowledgeStructuredMetadata,
    source: string
  ) {
    const labels = this.knowledgeMetadataService.buildProductLabels(metadata);
    const primaryLabel = metadata.modelNumber ?? metadata.productName ?? labels[0];

    if (!primaryLabel) {
      return null;
    }

    const catalogKey = this.knowledgeMetadataService.normalizeLabel(primaryLabel);

    if (!catalogKey) {
      return null;
    }

    const aliases = Array.from(new Set([primaryLabel, ...labels]));
    const modelNumber =
      metadata.modelNumber ??
      (/^[A-Z0-9-]{4,16}$/i.test(primaryLabel.trim()) ? primaryLabel.trim().toUpperCase() : undefined);

    return tx.productCatalog.upsert({
      where: {
        tenantId_catalogKey: {
          tenantId,
          catalogKey
        }
      },
      update: {
        productSeries: metadata.productSeries,
        productName: metadata.productName ?? primaryLabel,
        modelNumber,
        deviceType: metadata.deviceType,
        aliases: toPrismaJson(aliases),
        source,
        metadata: toPrismaJson(metadata)
      },
      create: {
        tenantId,
        catalogKey,
        productSeries: metadata.productSeries,
        productName: metadata.productName ?? primaryLabel,
        modelNumber,
        deviceType: metadata.deviceType,
        aliases: toPrismaJson(aliases),
        source,
        metadata: toPrismaJson(metadata)
      }
    });
  }

  private readLegacyRagContext(metadata: unknown): ConversationRetrievalContext["rag"] {
    if (!isPlainObject(metadata)) {
      return {};
    }

    const rag = isPlainObject(metadata.rag) ? metadata.rag : {};

    return {
      productContext: this.knowledgeMetadataService.readKnowledgeMetadata(rag.productContext) ?? null,
      pendingClarification: rag.pendingClarification
    };
  }

  private productCatalogToMetadata(
    productCatalog?: {
      productSeries: string | null;
      productName: string;
      modelNumber: string | null;
      deviceType: string | null;
      aliases: Prisma.JsonValue;
      metadata: Prisma.JsonValue;
    } | null
  ): KnowledgeStructuredMetadata | null {
    if (!productCatalog) {
      return null;
    }

    const storedMetadata = this.knowledgeMetadataService.readKnowledgeMetadata(productCatalog.metadata);

    if (storedMetadata) {
      return storedMetadata;
    }

    return {
      productSeries: productCatalog.productSeries ?? undefined,
      productName: productCatalog.productName,
      modelNumber: productCatalog.modelNumber ?? undefined,
      deviceType: productCatalog.deviceType ?? undefined,
      aliases: Array.isArray(productCatalog.aliases)
        ? productCatalog.aliases.filter((item): item is string => typeof item === "string")
        : undefined
    };
  }

  private confidenceToScore(confidence?: PersistRetrievalStateInput["confidence"]): number {
    if (!confidence) {
      return 0;
    }

    if (typeof confidence.bestScore === "number") {
      return confidence.bestScore;
    }

    switch (confidence.level) {
      case "strong":
        return 0.85;
      case "weak":
        return 0.55;
      default:
        return 0;
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return stripUndefined(value) as Prisma.InputJsonValue;
}

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stripUndefined(item)));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const cleaned: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      cleaned[key] = stripUndefined(item);
    }
  }

  return cleaned;
}
