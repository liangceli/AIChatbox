import assert from "node:assert/strict";
import {
  KnowledgeChunkStatus,
  KnowledgeDocumentSourceType,
  KnowledgeDocumentStatus,
  PrismaClient,
  TenantStatus
} from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
const rollbackMarker = new Error("ROLLBACK_KNOWLEDGE_LIFECYCLE_TEST");

async function run() {
  try {
    await prisma.$transaction(async (tx) => {
      const suffix = randomUUID().replace(/-/g, "");
      const tenant = await tx.tenant.create({
        data: {
          slug: `lifecycle-db-${suffix}`,
          name: "Knowledge Lifecycle DB Test",
          status: TenantStatus.ACTIVE
        }
      });
      const knowledgeBase = await tx.knowledgeBase.create({
        data: {
          tenantId: tenant.id,
          slug: "default",
          name: "Default"
        }
      });
      const document = await tx.knowledgeDocument.create({
        data: {
          tenantId: tenant.id,
          knowledgeBaseId: knowledgeBase.id,
          title: "Versioned document",
          sourceType: KnowledgeDocumentSourceType.MANUAL,
          content: "Version one",
          status: KnowledgeDocumentStatus.READY,
          chunkCount: 2,
          version: 1
        }
      });

      await tx.knowledgeChunk.createMany({
        data: [0, 1].map((chunkIndex) => ({
          tenantId: tenant.id,
          knowledgeDocumentId: document.id,
          version: 1,
          chunkIndex,
          content: `Version one chunk ${chunkIndex}`,
          status: KnowledgeChunkStatus.READY
        }))
      });
      await tx.knowledgeChunk.updateMany({
        where: {
          tenantId: tenant.id,
          knowledgeDocumentId: document.id,
          version: 1
        },
        data: {
          status: KnowledgeChunkStatus.INACTIVE
        }
      });
      await tx.knowledgeChunk.createMany({
        data: [0, 1].map((chunkIndex) => ({
          tenantId: tenant.id,
          knowledgeDocumentId: document.id,
          version: 2,
          chunkIndex,
          content: `Version two chunk ${chunkIndex}`,
          status: KnowledgeChunkStatus.READY
        }))
      });

      const versions = await tx.knowledgeChunk.groupBy({
        by: ["version", "status"],
        where: {
          tenantId: tenant.id,
          knowledgeDocumentId: document.id
        },
        _count: {
          _all: true
        },
        orderBy: {
          version: "asc"
        }
      });

      assert.deepEqual(
        versions.map((version) => ({
          version: version.version,
          status: version.status,
          count: version._count._all
        })),
        [
          { version: 1, status: KnowledgeChunkStatus.INACTIVE, count: 2 },
          { version: 2, status: KnowledgeChunkStatus.READY, count: 2 }
        ]
      );

      throw rollbackMarker;
    });

    assert.fail("Knowledge lifecycle integration transaction should roll back.");
  } catch (error) {
    if (error !== rollbackMarker) {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void run();
