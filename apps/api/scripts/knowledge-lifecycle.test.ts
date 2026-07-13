import assert from "node:assert/strict";
import {
  KnowledgeChunkStatus,
  KnowledgeDocumentSourceType,
  KnowledgeDocumentStatus
} from "@platform/database";
import { KnowledgeService } from "../src/modules/knowledge/knowledge.service";
import { KnowledgeMetadataService } from "../src/modules/knowledge/knowledge-metadata.service";
import { KnowledgeRetrievalService } from "../src/modules/knowledge/knowledge-retrieval.service";
import { ConversationContextService } from "../src/modules/knowledge/conversation-context.service";

const tenant = {
  id: "tenant-lifecycle",
  slug: "lifecycle",
  name: "Lifecycle",
  status: "ACTIVE"
} as never;

async function testRetrievalRequiresReadyDocumentAndChunk() {
  const queries: unknown[] = [];
  const service = new KnowledgeRetrievalService(
    {
      client: {
        knowledgeChunk: {
          findMany: async (query: unknown) => {
            queries.push(query);
            return [];
          }
        }
      }
    } as never,
    new KnowledgeMetadataService(),
    new ConversationContextService()
  );

  await service.retrieveRelevantChunks(tenant, "refund policy");

  assert.equal(queries.length, 2);

  for (const query of queries as Array<{
    where: {
      status?: KnowledgeChunkStatus;
      knowledgeDocument?: { status?: KnowledgeDocumentStatus };
    };
  }>) {
    assert.equal(query.where.status, KnowledgeChunkStatus.READY);
    assert.equal(query.where.knowledgeDocument?.status, KnowledgeDocumentStatus.READY);
  }
}

async function testReprocessFailureKeepsPreviousReadyVersionSearchable() {
  const updates: unknown[] = [];
  const service = new KnowledgeService(
    {
      client: {
        knowledgeDocument: {
          findFirst: async () => ({
            id: "doc-ready",
            tenantId: "tenant-lifecycle",
            knowledgeBaseId: "kb-1",
            title: "Ready Manual",
            sourceType: KnowledgeDocumentSourceType.MANUAL,
            sourceUri: null,
            content: "Old searchable content.",
            checksum: "old-checksum",
            storageKey: null,
            status: KnowledgeDocumentStatus.READY,
            chunkCount: 1,
            version: 2,
            processingError: null,
            metadata: {},
            ingestedAt: new Date(),
            archivedAt: null,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }),
          findUnique: async () => ({
            checksum: "old-checksum",
            chunkCount: 1,
            metadata: {},
            status: KnowledgeDocumentStatus.READY,
            title: "Ready Manual",
            sourceUri: null,
            version: 2
          }),
          update: async (input: unknown) => {
            updates.push(input);
            return input;
          }
        }
      }
    } as never,
    {
      chunkText: () => []
    } as never,
    new KnowledgeMetadataService(),
    {} as never,
    {} as never
  );

  await assert.rejects(
    () => service.reprocessKnowledgeDocument(tenant, "kb-1", "doc-ready", "replacement content"),
    /did not produce any chunks/
  );

  const finalUpdate = updates.at(-1) as {
    data: { status: KnowledgeDocumentStatus; chunkCount: number; processingError?: string };
  };

  assert.equal(finalUpdate.data.status, KnowledgeDocumentStatus.READY);
  assert.equal(finalUpdate.data.chunkCount, 1);
  assert.match(finalUpdate.data.processingError ?? "", /did not produce any chunks/);
}

async function testDeleteUsesSoftLifecycleState() {
  const calls: string[] = [];
  const service = new KnowledgeService(
    {
      client: {
        knowledgeDocument: {
          findFirst: async () => ({ id: "doc-delete" })
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            knowledgeChunk: {
              updateMany: async (input: { data: { status: KnowledgeChunkStatus } }) => {
                calls.push(`chunk:${input.data.status}`);
              }
            },
            knowledgeDocument: {
              update: async (input: { data: { status: KnowledgeDocumentStatus } }) => {
                calls.push(`document:${input.data.status}`);
              }
            }
          })
      }
    } as never,
    {} as never,
    new KnowledgeMetadataService(),
    {} as never,
    {} as never
  );

  await service.deleteKnowledgeDocument(tenant, "kb-1", "doc-delete");

  assert.deepEqual(calls, [
    `chunk:${KnowledgeChunkStatus.DELETED}`,
    `document:${KnowledgeDocumentStatus.DELETED}`
  ]);
}

async function run() {
  await testRetrievalRequiresReadyDocumentAndChunk();
  await testReprocessFailureKeepsPreviousReadyVersionSearchable();
  await testDeleteUsesSoftLifecycleState();
}

void run();
