import { ConversationStatus } from "@platform/database";
import { loadServerEnv, type ServerEnv } from "@platform/config";
import assert from "node:assert/strict";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AdminApiGuard } from "../src/common/admin-protection/admin-api.guard";
import { createTenantResolutionMiddleware } from "../src/common/tenant/tenant-resolution.middleware";
import { AssistantReplyService } from "../src/modules/chat/assistant-reply.service";
import { ChatService } from "../src/modules/chat/chat.service";
import { LlmProviderResolverService } from "../src/modules/chat/llm-provider-resolver.service";
import { OpenAiLlmProviderService } from "../src/modules/chat/openai-llm-provider.service";
import { ConversationsService } from "../src/modules/conversations/conversations.service";
import { KnowledgeRetrievalService } from "../src/modules/knowledge/knowledge-retrieval.service";
import { RealtimeController } from "../src/modules/realtime/realtime.controller";
import { RealtimeService } from "../src/modules/realtime/realtime.service";

const baseInput = {
  tenant: {
    id: "tenant-1",
    slug: "demo",
    name: "Demo"
  },
  conversation: {
    id: "conversation-1"
  },
  agent: {
    displayName: "Demo Assistant",
    fallbackMessage: "Fallback reply.",
    handoffEnabled: true
  },
  latestCustomerMessage: "What is the warranty?",
  retrievedChunks: [
    {
      knowledgeDocumentId: "doc-1",
      chunkId: "chunk-1",
      title: "Warranty",
      chunkIndex: 0,
      sourceUri: "https://example.test/warranty",
      relevanceScore: 12,
      content: "Warranty coverage lasts 12 months for eligible purchases."
    }
  ]
};

type RetrievalCandidate = {
  id: string;
  content: string;
  chunkIndex: number;
  sourceLocator?: unknown;
  knowledgeDocument: {
    id: string;
    title: string;
    sourceUri?: string | null;
  };
};

function createOpenAiEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return loadServerEnv({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-test",
    ...overrides
  });
}

function createRetrievalService(candidates: RetrievalCandidate[]): KnowledgeRetrievalService {
  return new KnowledgeRetrievalService({
    client: {
      knowledgeChunk: {
        findMany: async (query: {
          where?: {
            OR?: Array<
              | { content?: { contains?: string } }
              | { knowledgeDocument?: { title?: { contains?: string } } }
            >;
          };
        }) => {
          const candidateTerms =
            query.where?.OR?.flatMap((condition) => [
              "content" in condition ? condition.content?.contains : undefined,
              "knowledgeDocument" in condition
                ? condition.knowledgeDocument?.title?.contains
                : undefined
            ]).filter((term): term is string => Boolean(term)) ?? [];

          if (candidateTerms.length === 0) {
            return candidates;
          }

          return candidates.filter((candidate) =>
            candidateTerms.some((term) => {
              const normalizedTerm = term.toLowerCase();

              return (
                candidate.content.toLowerCase().includes(normalizedTerm) ||
                candidate.knowledgeDocument.title.toLowerCase().includes(normalizedTerm)
              );
            })
          );
        }
      }
    }
  } as never);
}

function createGuardContext(headers: Record<string, string | undefined>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers
      })
    })
  } as never;
}

async function testDefaultConfigUsesDeterministic() {
  const env = loadServerEnv({});

  assert.equal(env.AI_PROVIDER, "deterministic");
  assert.equal(env.OPENAI_API_KEY, undefined);
}

async function testDeterministicConfigDoesNotNeedOpenAi() {
  const env = loadServerEnv({
    AI_PROVIDER: "deterministic"
  });

  assert.equal(env.AI_PROVIDER, "deterministic");
}

async function testOpenAiConfigRequiresKeyAndModel() {
  assert.throws(
    () =>
      loadServerEnv({
        AI_PROVIDER: "openai",
        OPENAI_MODEL: "gpt-test"
      }),
    /OPENAI_API_KEY/
  );

  assert.throws(
    () =>
      loadServerEnv({
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key"
      }),
    /OPENAI_MODEL/
  );
}

async function testAdminProtectionConfigRequiresExplicitDevDisable() {
  assert.throws(
    () =>
      loadServerEnv({
        ADMIN_API_PROTECTION_MODE: "disabled"
      }),
    /ALLOW_UNPROTECTED_ADMIN_API_IN_DEV/
  );

  const env = loadServerEnv({
    ADMIN_API_PROTECTION_MODE: "disabled",
    ALLOW_UNPROTECTED_ADMIN_API_IN_DEV: "true"
  });

  assert.equal(env.ADMIN_API_PROTECTION_MODE, "disabled");
}

async function testAdminProtectionGuardRejectsMissingAndInvalidTokens() {
  const guard = AdminApiGuard.createForTest(
    loadServerEnv({
      ADMIN_API_TOKEN: "test-admin-token"
    })
  );

  assert.throws(
    () => guard.canActivate(createGuardContext({})),
    UnauthorizedException
  );
  assert.throws(
    () => guard.canActivate(createGuardContext({ "x-admin-api-token": "wrong-token" })),
    ForbiddenException
  );
}

async function testAdminProtectionGuardAcceptsValidTokens() {
  const guard = AdminApiGuard.createForTest(
    loadServerEnv({
      ADMIN_API_TOKEN: "test-admin-token"
    })
  );
  const bearerGuard = AdminApiGuard.createForTest(
    loadServerEnv({
      ADMIN_API_TOKEN: "bearer-token"
    })
  );

  assert.equal(
    guard.canActivate(createGuardContext({ "x-admin-api-token": "test-admin-token" })),
    true
  );
  assert.equal(
    bearerGuard.canActivate(createGuardContext({ authorization: "Bearer bearer-token" })),
    true
  );
}

async function testAdminProtectionGuardDisabledOnlyWhenExplicitlyAllowed() {
  const guard = AdminApiGuard.createForTest(
    loadServerEnv({
      ADMIN_API_PROTECTION_MODE: "disabled",
      ALLOW_UNPROTECTED_ADMIN_API_IN_DEV: "true"
    })
  );

  assert.equal(guard.canActivate(createGuardContext({})), true);
}

async function testAdminRealtimeControllerUsesAdminGuard() {
  const guards =
    Reflect.getMetadata(GUARDS_METADATA, RealtimeController.prototype.streamConversations) ?? [];

  assert.ok(guards.includes(AdminApiGuard));
}

async function testTenantResolutionStillRequiresTenantSlug() {
  const middleware = createTenantResolutionMiddleware({
    tenant: {
      findFirst: async () => null
    }
  } as never);
  let capturedError: unknown;

  await middleware(
    {
      method: "GET",
      headers: {},
      query: {}
    } as never,
    {} as never,
    (error?: unknown) => {
      capturedError = error;
    }
  );

  assert.ok(capturedError instanceof BadRequestException);
}

async function testCustomerConversationReadRequiresVisitorScope() {
  const conversationsService = new ConversationsService({
    client: {
      conversation: {
        findFirst: async (query: {
          where?: {
            customer?: {
              visitorId?: string;
            };
          };
        }) => {
          if (query.where?.customer?.visitorId !== "visitor-1") {
            return null;
          }

          return {
            id: "conversation-1",
            tenantId: "tenant-1",
            customerId: "customer-1",
            assignedUserId: null,
            channel: "WIDGET",
            status: ConversationStatus.AWAITING_CUSTOMER,
            handoffRequestedAt: null,
            handoffReason: null,
            lastMessageAt: new Date("2026-01-01T00:00:00.000Z"),
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            customer: {
              id: "customer-1",
              tenantId: "tenant-1",
              visitorId: "visitor-1",
              externalId: "visitor-1",
              email: null,
              name: null,
              metadata: null,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z")
            },
            assignedUser: null,
            messages: []
          };
        }
      }
    }
  } as never);

  await assert.rejects(
    () => conversationsService.getCustomerConversationDetail(baseInput.tenant, "conversation-1"),
    BadRequestException
  );
  await assert.rejects(
    () =>
      conversationsService.getCustomerConversationDetail(
        baseInput.tenant,
        "conversation-1",
        "visitor-2"
      ),
    /Conversation not found/
  );

  const detail = await conversationsService.getCustomerConversationDetail(
    baseInput.tenant,
    "conversation-1",
    "visitor-1"
  );

  assert.equal(detail.id, "conversation-1");
  assert.equal(detail.customer.visitorId, "visitor-1");
}

function createConversationRecord(visitorId: string) {
  return {
    id: "conversation-1",
    tenantId: "tenant-1",
    customerId: "customer-1",
    assignedUserId: null,
    channel: "WIDGET",
    status: ConversationStatus.AWAITING_CUSTOMER,
    handoffRequestedAt: null,
    handoffReason: null,
    lastMessageAt: new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    customer: {
      id: "customer-1",
      tenantId: "tenant-1",
      visitorId,
      externalId: visitorId,
      email: null,
      name: null,
      metadata: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z")
    },
    assignedUser: null,
    messages: []
  };
}

function createConversationServiceForHandoff(visitorId: string): ConversationsService {
  return new ConversationsService({
    client: {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          conversation: {
            findUnique: async () => createConversationRecord(visitorId),
            update: async () => ({})
          },
          message: {
            create: async () => ({
              id: "message-1",
              createdAt: new Date("2026-01-01T00:01:00.000Z")
            })
          }
        }),
      conversation: {
        findUnique: async () => ({
          ...createConversationRecord(visitorId),
          status: ConversationStatus.PENDING_HUMAN,
          handoffRequestedAt: new Date("2026-01-01T00:01:00.000Z"),
          handoffReason: "Need help"
        })
      }
    }
  } as never);
}

async function testCustomerHandoffRequiresCorrectVisitorScope() {
  const conversationsService = createConversationServiceForHandoff("visitor-1");

  await assert.rejects(
    () => conversationsService.requestHandoff(baseInput.tenant, "conversation-1", undefined),
    BadRequestException
  );
  await assert.rejects(
    () => conversationsService.requestHandoff(baseInput.tenant, "conversation-1", "   "),
    BadRequestException
  );
  await assert.rejects(
    () => conversationsService.requestHandoff(baseInput.tenant, "conversation-1", "visitor-2"),
    ForbiddenException
  );

  const detail = await conversationsService.requestHandoff(
    baseInput.tenant,
    "conversation-1",
    "visitor-1",
    "Need help"
  );

  assert.equal(detail.id, "conversation-1");
  assert.equal(detail.customer.visitorId, "visitor-1");
  assert.equal(detail.status, "pending_human");
}

async function testCustomerRealtimeSnapshotDoesNotExposeTenantList() {
  const realtimeService = new RealtimeService({} as never, {
    getCustomerConversationDetail: async () => ({
      id: "conversation-1",
      status: "awaiting_customer",
      channel: "widget",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastMessageAt: "2026-01-01T00:00:00.000Z",
      customer: {
        id: "customer-1",
        visitorId: "visitor-1"
      },
      assignedUser: null,
      handoffRequestedAt: null,
      handoffReason: null,
      isHandoffPending: false,
      messages: []
    })
  } as never);

  const snapshot = await realtimeService.createCustomerSnapshot(
    baseInput.tenant,
    "conversation-1",
    "visitor-1"
  );

  assert.equal(snapshot.conversation?.id, "conversation-1");
  assert.equal("conversations" in snapshot, false);
  assert.equal("pendingHumanCount" in snapshot, false);
}

async function testResolverSelection() {
  const deterministicProvider = new AssistantReplyService();
  const openAiProvider = OpenAiLlmProviderService.createForTest(
    deterministicProvider,
    createOpenAiEnv(),
    () =>
      ({
        responses: {
          create: async () => ({ id: "response-1", output_text: "AI reply." })
        }
      }) as never
  );

  const defaultResolver = LlmProviderResolverService.createForTest(
    deterministicProvider,
    openAiProvider,
    loadServerEnv({})
  );
  const openAiResolver = LlmProviderResolverService.createForTest(
    deterministicProvider,
    openAiProvider,
    createOpenAiEnv()
  );

  assert.equal(defaultResolver.resolveProvider().name, "deterministic");
  assert.equal(openAiResolver.resolveProvider().name, "openai");
}

async function testOpenAiSuccessMapsResponse() {
  const deterministicProvider = new AssistantReplyService();
  const openAiProvider = OpenAiLlmProviderService.createForTest(
    deterministicProvider,
    createOpenAiEnv(),
    () =>
      ({
        responses: {
          create: async () => ({ id: "response-1", output_text: "AI reply from OpenAI." })
        }
      }) as never
  );

  const response = await openAiProvider.generateReply(baseInput);

  assert.equal(response.content, "AI reply from OpenAI.");
  assert.equal(response.metadata.providerName, "openai");
  assert.equal(response.metadata.mode, "openai");
  assert.equal(response.metadata.usedFallback, false);
  assert.equal(response.metadata.model, "gpt-test");
  assert.equal(response.metadata.responseId, "response-1");
  assert.equal(response.citations?.length, 1);
  assert.equal(JSON.stringify(response.metadata).includes("test-key"), false);
}

async function testOpenAiSuccessPreservesCitationsWhenDeterministicWouldNotGround() {
  const deterministicProvider = new AssistantReplyService();
  const openAiProvider = OpenAiLlmProviderService.createForTest(
    deterministicProvider,
    createOpenAiEnv(),
    () =>
      ({
        responses: {
          create: async () => ({ id: "response-2", output_text: "AI reply with context." })
        }
      }) as never
  );
  const input = {
    ...baseInput,
    latestCustomerMessage: "billing escalation",
    retrievedChunks: [
      {
        knowledgeDocumentId: "doc-2",
        chunkId: "chunk-2",
        title: "Warranty",
        chunkIndex: 0,
        sourceUri: "https://example.test/warranty",
        relevanceScore: 0,
        content: "Warranty coverage lasts 12 months for eligible purchases."
      }
    ]
  };

  assert.equal(deterministicProvider.generateReply(input).citations, null);

  const response = await openAiProvider.generateReply(input);

  assert.equal(response.content, "AI reply with context.");
  assert.equal(response.metadata.usedFallback, false);
  assert.equal(response.citations?.length, 1);
  assert.equal(response.citations?.[0]?.chunkId, "chunk-2");
}

async function testOpenAiFailureFallsBack() {
  const deterministicProvider = new AssistantReplyService();
  const openAiProvider = OpenAiLlmProviderService.createForTest(
    deterministicProvider,
    createOpenAiEnv(),
    () =>
      ({
        responses: {
          create: async () => {
            throw new Error("timeout while calling provider");
          }
        }
      }) as never
  );

  const response = await openAiProvider.generateReply(baseInput);

  assert.equal(response.metadata.providerName, "openai");
  assert.equal(response.metadata.usedFallback, true);
  assert.equal(response.metadata.deterministic, true);
  assert.equal(response.metadata.fallbackReason, "timeout");
  assert.equal(JSON.stringify(response.metadata).includes("test-key"), false);
  assert.match(response.content, /support knowledge base/i);
}

async function testShortKeywordMatchesRelevantChunk() {
  const retrievalService = createRetrievalService([
    {
      id: "chunk-warranty",
      content: "Warranty coverage lasts 12 months for eligible purchases.",
      chunkIndex: 0,
      knowledgeDocument: {
        id: "doc-warranty",
        title: "Warranty",
        sourceUri: "https://example.test/warranty"
      }
    }
  ]);

  const chunks = await retrievalService.retrieveRelevantChunks(baseInput.tenant, "warranty");

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.chunkId, "chunk-warranty");
}

async function testUnrelatedShortQueryAvoidsWeakSubstringMatch() {
  const retrievalService = createRetrievalService([
    {
      id: "chunk-showcase",
      content: "The showcase article explains how customers compare support options.",
      chunkIndex: 0,
      knowledgeDocument: {
        id: "doc-showcase",
        title: "Customer Stories",
        sourceUri: "https://example.test/stories"
      }
    }
  ]);

  const chunks = await retrievalService.retrieveRelevantChunks(baseInput.tenant, "case");

  assert.equal(chunks.length, 0);
}

async function testRawPluralCandidateLookupWithNormalizedScoring() {
  const retrievalService = createRetrievalService([
    {
      id: "chunk-policy",
      content: "Eligible policies include clear escalation and refund terms.",
      chunkIndex: 0,
      knowledgeDocument: {
        id: "doc-policy",
        title: "Support Policies",
        sourceUri: "https://example.test/policies"
      }
    },
    {
      id: "chunk-warranty",
      content: "Extended warranties cover replacement parts for eligible purchases.",
      chunkIndex: 0,
      knowledgeDocument: {
        id: "doc-warranty",
        title: "Product Warranties",
        sourceUri: "https://example.test/warranties"
      }
    }
  ]);

  const policyChunks = await retrievalService.retrieveRelevantChunks(baseInput.tenant, "policies");
  const warrantyChunks = await retrievalService.retrieveRelevantChunks(baseInput.tenant, "warranties");

  assert.equal(policyChunks.length, 1);
  assert.equal(policyChunks[0]?.chunkId, "chunk-policy");
  assert.equal(warrantyChunks.length, 1);
  assert.equal(warrantyChunks[0]?.chunkId, "chunk-warranty");
}

async function testExactPhraseStrongMatchStillWorks() {
  const retrievalService = createRetrievalService([
    {
      id: "chunk-return",
      content: "The return window is 30 days from the original purchase date.",
      chunkIndex: 0,
      knowledgeDocument: {
        id: "doc-return",
        title: "Returns",
        sourceUri: "https://example.test/returns"
      }
    }
  ]);

  const chunks = await retrievalService.retrieveRelevantChunks(baseInput.tenant, "return window");

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.chunkId, "chunk-return");
}

async function testRetrievalChangesPreserveDeterministicCitations() {
  const retrievalService = createRetrievalService([
    {
      id: "chunk-warranty",
      content: "Warranty coverage lasts 12 months for eligible purchases.",
      chunkIndex: 0,
      knowledgeDocument: {
        id: "doc-warranty",
        title: "Warranty",
        sourceUri: "https://example.test/warranty"
      }
    }
  ]);
  const chunks = await retrievalService.retrieveRelevantChunks(baseInput.tenant, "warranty");
  const response = new AssistantReplyService().generateReply({
    ...baseInput,
    latestCustomerMessage: "warranty",
    retrievedChunks: chunks
  });

  assert.equal(response.citations?.length, 1);
  assert.equal(response.citations?.[0]?.chunkId, "chunk-warranty");
}

async function testPendingHumanGuardPreventsProviderCall() {
  let providerCalled = false;
  const prisma = {
    client: {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          customer: {
            upsert: async () => ({ id: "customer-1" })
          },
          conversation: {
            findFirst: async () => ({
              id: "conversation-1",
              status: ConversationStatus.PENDING_HUMAN
            })
          }
        })
    }
  };
  const knowledgeRetrieval = {
    retrieveRelevantChunks: async () => []
  };
  const providerResolver = {
    resolveProvider: () => {
      providerCalled = true;
      return new AssistantReplyService();
    }
  };
  const chatService = new ChatService(prisma as never, knowledgeRetrieval as never, providerResolver as never);

  await assert.rejects(
    () =>
      chatService.sendMessage(
        {
          id: "tenant-1",
          slug: "demo",
          name: "Demo"
        },
        {
          conversationId: "conversation-1",
          visitorId: "visitor-1",
          message: "hello"
        }
      ),
    BadRequestException
  );
  assert.equal(providerCalled, false);
}

async function run() {
  await testDefaultConfigUsesDeterministic();
  await testDeterministicConfigDoesNotNeedOpenAi();
  await testOpenAiConfigRequiresKeyAndModel();
  await testAdminProtectionConfigRequiresExplicitDevDisable();
  await testAdminProtectionGuardRejectsMissingAndInvalidTokens();
  await testAdminProtectionGuardAcceptsValidTokens();
  await testAdminProtectionGuardDisabledOnlyWhenExplicitlyAllowed();
  await testAdminRealtimeControllerUsesAdminGuard();
  await testTenantResolutionStillRequiresTenantSlug();
  await testCustomerConversationReadRequiresVisitorScope();
  await testCustomerHandoffRequiresCorrectVisitorScope();
  await testCustomerRealtimeSnapshotDoesNotExposeTenantList();
  await testResolverSelection();
  await testOpenAiSuccessMapsResponse();
  await testOpenAiSuccessPreservesCitationsWhenDeterministicWouldNotGround();
  await testOpenAiFailureFallsBack();
  await testShortKeywordMatchesRelevantChunk();
  await testUnrelatedShortQueryAvoidsWeakSubstringMatch();
  await testRawPluralCandidateLookupWithNormalizedScoring();
  await testExactPhraseStrongMatchStillWorks();
  await testRetrievalChangesPreserveDeterministicCitations();
  await testPendingHumanGuardPreventsProviderCall();
}

void run();
