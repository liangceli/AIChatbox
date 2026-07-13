import assert from "node:assert/strict";
import { Prisma } from "@platform/database";
import { ConversationStateService } from "../src/modules/knowledge/conversation-state.service";
import { KnowledgeMetadataService } from "../src/modules/knowledge/knowledge-metadata.service";

function createService(client: unknown) {
  return new ConversationStateService(
    { client } as never,
    new KnowledgeMetadataService()
  );
}

async function testPersistedStateOverridesLegacyMetadata() {
  const service = createService({
    conversationState: {
      findFirst: async () => ({
        activeProductContext: {
          productName: "KMDIM400",
          aliases: ["KMDIM400"]
        },
        activeProductCatalog: null,
        stateJson: {
          pendingClarification: {
            originalQuestion: "how do I pair a device?",
            intent: "pairing",
            options: []
          }
        }
      })
    }
  });
  const context = await service.buildRetrievalContext("tenant-1", "conversation-1", {
    rag: {
      productContext: {
        productName: "KMREM",
        aliases: ["KMREM"]
      }
    }
  });

  assert.equal(context.rag.productContext?.productName, "KMDIM400");
  assert.deepEqual(context.rag.pendingClarification, {
    originalQuestion: "how do I pair a device?",
    intent: "pairing",
    options: []
  });
}

async function testResolvedProductContextUpsertsCatalogAndState() {
  let catalogUpsertInput: unknown;
  let stateUpsertInput: unknown;
  const tx = {
    conversationState: {
      findFirst: async () => null,
      upsert: async (input: unknown) => {
        stateUpsertInput = input;
      }
    },
    productCatalog: {
      upsert: async (input: unknown) => {
        catalogUpsertInput = input;

        return {
          id: "product-1"
        };
      }
    }
  };
  const service = createService({});
  const metadata = await service.persistRetrievalState(
    tx as never,
    "tenant-1",
    "conversation-1",
    {},
    {
      productContext: {
        deviceType: "KMDIM400",
        aliases: ["KMDIM400"],
        intentHints: ["pairing"]
      },
      pendingClarification: null,
      confidence: {
        level: "strong",
        bestScore: 0.91
      },
      entitySource: "clarification"
    }
  );

  assert.equal(
    (catalogUpsertInput as { where: { tenantId_catalogKey: { catalogKey: string } } }).where
      .tenantId_catalogKey.catalogKey,
    "kmdim400"
  );
  assert.equal(
    (stateUpsertInput as { create: { activeProductCatalogId: string } }).create.activeProductCatalogId,
    "product-1"
  );
  assert.equal(
    ((metadata.rag as { productContext: { deviceType: string } }).productContext.deviceType),
    "KMDIM400"
  );
}

async function testExplicitNullClearsPersistedAndLegacyProductContext() {
  let stateUpsertInput: unknown;
  const tx = {
    conversationState: {
      findFirst: async () => ({
        activeProductCatalogId: "product-old",
        activeProductContext: {
          productName: "KMREM"
        },
        stateJson: {
          productContext: {
            productName: "KMREM"
          }
        }
      }),
      upsert: async (input: unknown) => {
        stateUpsertInput = input;
      }
    },
    productCatalog: {
      upsert: async () => {
        throw new Error("Product catalog must not be upserted while clearing context.");
      }
    }
  };
  const service = createService({});
  const metadata = await service.persistRetrievalState(
    tx as never,
    "tenant-1",
    "conversation-1",
    {
      rag: {
        productContext: {
          productName: "KMREM"
        }
      }
    },
    {
      productContext: null,
      pendingClarification: null
    }
  );
  const update = (stateUpsertInput as {
    update: {
      activeProductContext: unknown;
      activeConfidence: number;
      activeEntitySource: unknown;
      activeProductCatalog: { disconnect: boolean };
      stateJson: Record<string, unknown>;
    };
  }).update;

  assert.equal(update.activeProductContext, Prisma.DbNull);
  assert.equal(update.activeConfidence, 0);
  assert.equal(update.activeEntitySource, null);
  assert.deepEqual(update.activeProductCatalog, { disconnect: true });
  assert.equal("productContext" in update.stateJson, false);
  assert.equal("rag" in metadata, false);
}

async function run() {
  await testPersistedStateOverridesLegacyMetadata();
  await testResolvedProductContextUpsertsCatalogAndState();
  await testExplicitNullClearsPersistedAndLegacyProductContext();
}

void run();
