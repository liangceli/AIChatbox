import { ConversationStatus } from "@platform/database";
import { loadAdminWebEnv, loadServerEnv, type ServerEnv } from "@platform/config";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext
} from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AdminApiGuard } from "../src/common/admin-protection/admin-api.guard";
import { createTenantResolutionMiddleware } from "../src/common/tenant/tenant-resolution.middleware";
import { AnswerDebugController } from "../src/modules/chat/answer-debug.controller";
import { AnswerDebugService } from "../src/modules/chat/answer-debug.service";
import { AssistantReplyService } from "../src/modules/chat/assistant-reply.service";
import { buildBackendCitations } from "../src/modules/chat/citation-builder";
import { ChatService } from "../src/modules/chat/chat.service";
import { LlmProviderResolverService } from "../src/modules/chat/llm-provider-resolver.service";
import { OpenAiLlmProviderService } from "../src/modules/chat/openai-llm-provider.service";
import { buildOpenAiPrompt } from "../src/modules/chat/openai-prompt";
import { ConversationsController } from "../src/modules/conversations/conversations.controller";
import { ConversationsService } from "../src/modules/conversations/conversations.service";
import { KnowledgeChunkingService } from "../src/modules/knowledge/knowledge-chunking.service";
import { KnowledgeRetrievalService } from "../src/modules/knowledge/knowledge-retrieval.service";
import {
  createPinnedLookup,
  KnowledgeUrlImportService,
  requestPinnedPublicUrl
} from "../src/modules/knowledge/knowledge-url-import.service";
import {
  isPublicNetworkAddress,
  KnowledgeUrlSafetyService
} from "../src/modules/knowledge/knowledge-url-safety.service";
import { RealtimeController } from "../src/modules/realtime/realtime.controller";
import { RealtimeService } from "../src/modules/realtime/realtime.service";
import { TenantsController } from "../src/modules/tenants/tenants.controller";
import { UpdateTenantAiProfileDto } from "../src/modules/tenants/dto/update-tenant-ai-profile.dto";
import {
  buildAgentConfigPersistence,
  buildTenantAiProfile,
  mergeTenantAiProfile,
  toPublicTenantAiProfile
} from "../src/modules/tenants/tenant-ai-profile";

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

async function testAdminWebConfigUsesOnlyAdminWebRuntimeKeys() {
  const env = loadAdminWebEnv({
    AI_PROVIDER: "openai",
    API_INTERNAL_BASE_URL: "http://localhost:4000/v1",
    ADMIN_API_TOKEN: "test-admin-token",
    ADMIN_WEB_ACCESS_TOKEN: "test-web-token",
    ADMIN_WEB_SESSION_SECRET: "test-session-secret-for-local-qa"
  });

  assert.equal(env.API_INTERNAL_BASE_URL, "http://localhost:4000/v1");
  assert.equal(env.ADMIN_API_TOKEN, "test-admin-token");
  assert.equal(env.ADMIN_WEB_ACCESS_TOKEN, "test-web-token");
  assert.equal(env.ADMIN_WEB_SESSION_COOKIE_NAME, "platform_admin_session");
  assert.equal(env.ADMIN_WEB_SESSION_TTL_SECONDS, 43200);
}

async function testAdminWebConfigRejectsInvalidSessionTtl() {
  assert.throws(
    () =>
      loadAdminWebEnv({
        ADMIN_WEB_SESSION_TTL_SECONDS: "0"
      }),
    /ADMIN_WEB_SESSION_TTL_SECONDS/
  );
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

async function testAnswerDebugControllerUsesAdminGuard() {
  const guards = Reflect.getMetadata(GUARDS_METADATA, AnswerDebugController) ?? [];

  assert.ok(guards.includes(AdminApiGuard));
}

async function testAnswerDebugKnowledgeHitIsTenantScopedAndSecretSafe() {
  let retrievalTenantId: string | undefined;
  let agentConfigTenantId: string | undefined;
  const answerDebugService = new AnswerDebugService(
    {
      client: {
        agentConfig: {
          findUnique: async (query: { where: { tenantId: string } }) => {
            agentConfigTenantId = query.where.tenantId;

            return {
              displayName: "Debug Assistant",
              fallbackMessage: "Safe fallback.",
              handoffEnabled: true,
              systemPrompt: "raw hidden prompt that must not be returned",
              metadata: {
                secretConfig: "admin-token-must-not-be-returned"
              }
            };
          }
        }
      }
    } as never,
    {
      retrieveRelevantChunks: async (tenant: { id: string }) => {
        retrievalTenantId = tenant.id;

        return baseInput.retrievedChunks;
      }
    } as never,
    {
      resolveProvider: () => ({
        name: "openai",
        generateReply: async () => ({
          content: "Safe debug answer.",
          citations: [
            {
              knowledgeDocumentId: "doc-1",
              chunkId: "chunk-1",
              title: "Warranty",
              chunkIndex: 0,
              sourceUri: "https://example.test/warranty",
              relevanceScore: 12,
              sourceLocator: {
                rawInternalValue: "must-not-be-returned"
              },
              excerpt: "Warranty coverage lasts 12 months."
            }
          ],
          metadata: {
            providerName: "openai",
            mode: "openai",
            deterministic: false,
            usedFallback: false,
            model: "gpt-test",
            latencyMs: 15,
            responseId: "response-safe",
            apiKey: "openai-key-must-not-be-returned",
            rawPrompt: "raw hidden prompt that must not be returned",
            authorization: "Bearer admin-token-must-not-be-returned"
          }
        })
      })
    } as never
  );

  const result = await answerDebugService.run(
    {
      id: "tenant-secret-id",
      slug: "demo",
      name: "Demo",
      status: "ACTIVE"
    } as never,
    "What is the warranty?"
  );
  const serialized = JSON.stringify(result);

  assert.equal(retrievalTenantId, "tenant-secret-id");
  assert.equal(agentConfigTenantId, "tenant-secret-id");
  assert.equal(result.answerSource, "knowledge_hit");
  assert.equal(result.knowledge.outcome, "hit");
  assert.equal(result.knowledge.retrievalConfidence, "strong");
  assert.equal(result.knowledge.sourceDiversity, 1);
  assert.deepEqual(result.knowledge.warnings, []);
  assert.equal(result.retrievedChunks.length, 1);
  assert.equal(result.citations.length, 1);
  assert.equal(result.provider.requestedMode, "openai");
  assert.equal(result.provider.usedMode, "openai");
  assert.equal(result.provider.usedFallback, false);
  assert.equal(result.provider.metadata.model, "gpt-test");
  assert.equal("sourceLocator" in result.citations[0]!, false);
  assert.equal(serialized.includes("tenant-secret-id"), false);
  assert.equal(serialized.includes("openai-key-must-not-be-returned"), false);
  assert.equal(serialized.includes("admin-token-must-not-be-returned"), false);
  assert.equal(serialized.includes("raw hidden prompt"), false);
  assert.equal(serialized.includes("authorization"), false);
}

async function testAnswerDebugKnowledgeMissIsSafeAndNonPersistent() {
  const writeCalls: string[] = [];
  const trackWrite = (name: string) => async () => {
    writeCalls.push(name);
  };
  const answerDebugService = new AnswerDebugService(
    {
      client: {
        agentConfig: {
          findUnique: async () => null
        },
        customer: {
          create: trackWrite("customer.create"),
          update: trackWrite("customer.update"),
          upsert: trackWrite("customer.upsert")
        },
        conversation: {
          create: trackWrite("conversation.create"),
          update: trackWrite("conversation.update"),
          upsert: trackWrite("conversation.upsert"),
          deleteMany: trackWrite("conversation.deleteMany")
        },
        message: {
          create: trackWrite("message.create"),
          update: trackWrite("message.update"),
          upsert: trackWrite("message.upsert"),
          deleteMany: trackWrite("message.deleteMany")
        }
      }
    } as never,
    {
      retrieveRelevantChunks: async () => []
    } as never,
    {
      resolveProvider: () => ({
        name: "deterministic",
        generateReply: (input: Parameters<AssistantReplyService["generateReply"]>[0]) =>
          new AssistantReplyService().generateReply(input)
      })
    } as never
  );

  const result = await answerDebugService.run(
    {
      id: "tenant-1",
      slug: "demo",
      name: "Demo",
      status: "ACTIVE"
    } as never,
    "Question with no matching knowledge"
  );

  assert.deepEqual(writeCalls, []);
  assert.equal(result.answerSource, "knowledge_miss");
  assert.equal(result.knowledge.outcome, "miss");
  assert.equal(result.knowledge.retrievalConfidence, "none");
  assert.equal(result.knowledge.retrievedChunkCount, 0);
  assert.deepEqual(result.knowledge.warnings, ["No READY knowledge chunks met the retrieval threshold."]);
  assert.equal(result.citations.length, 0);
  assert.equal(result.provider.requestedMode, "deterministic");
  assert.equal(result.provider.usedMode, "deterministic");
  assert.match(result.knowledge.reason, /No relevant READY knowledge chunks/i);
}

async function testKnowledgeUrlSafetyRejectsRestrictedTargets() {
  const safetyService = KnowledgeUrlSafetyService.createForTest(async (hostname) => {
    if (hostname === "private.example.com") {
      return [{ address: "10.0.0.8", family: 4 }];
    }

    if (hostname === "mixed.example.com") {
      return [
        { address: "93.184.216.34", family: 4 },
        { address: "192.168.1.8", family: 4 }
      ];
    }

    return [{ address: "93.184.216.34", family: 4 }];
  });
  const blockedUrls = [
    "http://localhost/support",
    "http://127.0.0.1/support",
    "http://[::1]/support",
    "http://[::ffff:127.0.0.1]/support",
    "http://10.0.0.8/support",
    "http://172.16.0.8/support",
    "http://192.168.1.8/support",
    "http://169.254.169.254/latest/meta-data",
    "http://100.100.100.200/latest/meta-data",
    "http://168.63.129.16/metadata",
    "http://metadata.google.internal/computeMetadata/v1",
    "http://private.example.com/support",
    "http://mixed.example.com/support",
    "http://user:password@public.example.com/support",
    "ftp://public.example.com/support"
  ];

  for (const url of blockedUrls) {
    await assert.rejects(
      () => safetyService.resolveSafePublicUrl(url),
      BadRequestException,
      `Expected URL import safety to reject ${url}`
    );
  }

  assert.equal(isPublicNetworkAddress("93.184.216.34"), true);
  assert.equal(isPublicNetworkAddress("2606:4700:4700::1111"), true);
  assert.equal(isPublicNetworkAddress("127.0.0.1"), false);
  assert.equal(isPublicNetworkAddress("::ffff:127.0.0.1"), false);
  assert.equal(isPublicNetworkAddress("fc00::1"), false);
  assert.equal(isPublicNetworkAddress("fe80::1"), false);
}

async function testKnowledgeUrlImportRejectsRestrictedRedirectTarget() {
  let metadataRequestCount = 0;
  const safetyService = KnowledgeUrlSafetyService.createForTest(async (hostname) => {
    if (hostname === "private.example.com") {
      return [{ address: "10.0.0.8", family: 4 }];
    }

    return [{ address: "93.184.216.34", family: 4 }];
  });
  const importService = KnowledgeUrlImportService.createForTest(
    safetyService,
    async () => {
      metadataRequestCount += 1;

      return {
        status: 302,
        contentType: "text/plain",
        location: "http://169.254.169.254/latest/meta-data",
        body: ""
      };
    }
  );

  await assert.rejects(
    () => importService.fetchContent("https://public.example.com/support"),
    BadRequestException
  );
  assert.equal(metadataRequestCount, 1);

  let privateDnsRequestCount = 0;
  const privateDnsRedirectService = KnowledgeUrlImportService.createForTest(
    safetyService,
    async () => {
      privateDnsRequestCount += 1;

      return {
        status: 302,
        contentType: "text/plain",
        location: "http://private.example.com/support",
        body: ""
      };
    }
  );

  await assert.rejects(
    () => privateDnsRedirectService.fetchContent("https://public.example.com/support"),
    BadRequestException
  );
  assert.equal(privateDnsRequestCount, 1);
}

async function testKnowledgeUrlImportPreservesSafePublicRedirectAndHtml() {
  const requestedUrls: string[] = [];
  const resolvedHostnames: string[] = [];
  const safetyService = KnowledgeUrlSafetyService.createForTest(async (hostname) => {
    resolvedHostnames.push(hostname);
    return [{ address: "93.184.216.34", family: 4 }];
  });
  const importService = KnowledgeUrlImportService.createForTest(
    safetyService,
    async (resolution) => {
      requestedUrls.push(resolution.url.toString());

      if (resolution.url.hostname === "public.example.com") {
        return {
          status: 302,
          contentType: "text/plain",
          location: "https://docs.example.com/support",
          body: ""
        };
      }

      return {
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<html><head><title>Support Guide</title></head><body><p>Warranty coverage lasts twelve months for eligible purchases and registered products.</p></body></html>"
      };
    }
  );

  const content = await importService.fetchContent("https://public.example.com/start");

  assert.deepEqual(resolvedHostnames, ["public.example.com", "docs.example.com"]);
  assert.deepEqual(requestedUrls, [
    "https://public.example.com/start",
    "https://docs.example.com/support"
  ]);
  assert.equal(content.title, "Support Guide");
  assert.match(content.content, /Warranty coverage lasts twelve months/);
}

async function testKnowledgeUrlImportRemovesCommonPageNoiseAndDuplicateLines() {
  const safetyService = KnowledgeUrlSafetyService.createForTest(async () => [
    { address: "93.184.216.34", family: 4 }
  ]);
  const importService = KnowledgeUrlImportService.createForTest(
    safetyService,
    async () => ({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: [
        "<html><head><title>Returns Help</title><style>.hidden{}</style></head><body>",
        "<header>Main navigation</header><nav>Products Pricing Support</nav>",
        "<main><h1>Return Policy</h1><p>Customers can request a refund within thirty days of purchase.</p>",
        "<p>Customers can request a refund within thirty days of purchase.</p></main>",
        "<footer>Cookie settings and copyright footer</footer><script>alert('x')</script>",
        "</body></html>"
      ].join("")
    })
  );

  const content = await importService.fetchContent("https://public.example.com/returns");

  assert.equal(content.title, "Returns Help");
  assert.match(content.content, /Return Policy/);
  assert.match(content.content, /refund within thirty days/);
  assert.equal(content.content.includes("Main navigation"), false);
  assert.equal(content.content.includes("Cookie settings"), false);
  assert.equal(
    content.content.match(/refund within thirty days/g)?.length,
    1
  );
}

async function testKnowledgeUrlPinnedLookupSupportsNodeAllMode() {
  const selectedAddresses = [
    {
      address: "2606:2800:220:1:248:1893:25c8:1946",
      family: 6 as const
    },
    {
      address: "93.184.216.34",
      family: 4 as const
    }
  ];
  const lookup = createPinnedLookup(selectedAddresses);
  const addresses = await new Promise<unknown>((resolve, reject) => {
    lookup("public.example.com", { all: true }, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });

  assert.deepEqual(addresses, selectedAddresses);
}

async function testKnowledgeUrlImportEnforcesAbsoluteDeadlineDuringSlowTrickle() {
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "text/plain"
    });
    response.write("initial response chunk");
    const trickle = setInterval(() => {
      response.write(".");
    }, 5);

    response.on("close", () => {
      clearInterval(trickle);
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address() as AddressInfo;
    const startedAt = Date.now();

    await assert.rejects(
      () =>
        requestPinnedPublicUrl(
          {
            url: new URL(`http://public.example.test:${address.port}/slow`),
            addresses: [{ address: "127.0.0.1", family: 4 }]
          },
          "url-import-deadline-test",
          60
        ),
      /absolute deadline/i
    );
    assert.ok(Date.now() - startedAt < 1_000);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function testKnowledgeUrlImportEnforcesOverallRedirectFlowDeadline() {
  const safetyService = KnowledgeUrlSafetyService.createForTest(async () => [
    { address: "93.184.216.34", family: 4 }
  ]);
  const importService = KnowledgeUrlImportService.createForTest(
    safetyService,
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));

      return {
        status: 302,
        contentType: "text/plain",
        location: "https://docs.example.com/next",
        body: ""
      };
    },
    { flowDeadlineMs: 10 }
  );

  await assert.rejects(
    () => importService.fetchContent("https://public.example.com/start"),
    /overall import deadline/i
  );
}

async function testChunkingDropsDuplicateChunks() {
  const repeatedParagraph = "Warranty coverage lasts twelve months for eligible purchases. ".repeat(20);
  const chunker = new KnowledgeChunkingService();
  const singleChunks = chunker.chunkText(repeatedParagraph);
  const duplicatedChunks = chunker.chunkText(
    `${repeatedParagraph}\n\n${repeatedParagraph}`
  );

  assert.equal(duplicatedChunks.length, singleChunks.length);
  assert.deepEqual(
    duplicatedChunks.map((chunk) => chunk.content),
    singleChunks.map((chunk) => chunk.content)
  );
  assert.ok(duplicatedChunks.every((chunk) => chunk.sourceLocator === undefined));
}

async function testChunkingSourceLocatorsMatchPersistedContentWhenReliable() {
  const persistedContent = [
    "Warranty coverage lasts twelve months for eligible purchases.",
    "",
    "Return requests must include the original order number."
  ].join("\n");
  const chunks = new KnowledgeChunkingService().chunkText(persistedContent);

  assert.ok(chunks.length > 0);

  for (const chunk of chunks) {
    assert.ok(chunk.sourceLocator);
    assert.equal(
      persistedContent.slice(chunk.sourceLocator.startOffset, chunk.sourceLocator.endOffset),
      chunk.content
    );
  }
}

async function testBackendCitationsOmitMissingSourceLocatorKey() {
  const citations = buildBackendCitations([
    {
      knowledgeDocumentId: "doc-no-locator",
      chunkId: "chunk-no-locator",
      title: "Duplicate Warranty",
      chunkIndex: 0,
      sourceUri: "https://example.test/warranty",
      relevanceScore: 8,
      content: "Warranty coverage lasts twelve months for eligible purchases."
    }
  ]);

  assert.equal(citations.length, 1);
  assert.equal("sourceLocator" in citations[0]!, false);
}

async function testSynonymQuestionRetrievesSupportKnowledge() {
  const retrievalService = createRetrievalService([
    {
      id: "chunk-return",
      content: "Customers can return eligible purchases within thirty days of the purchase date.",
      chunkIndex: 0,
      knowledgeDocument: {
        id: "doc-return",
        title: "Returns",
        sourceUri: "https://example.test/returns"
      }
    }
  ]);

  const chunks = await retrievalService.retrieveRelevantChunks(baseInput.tenant, "refund policy");

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.chunkId, "chunk-return");
}

async function testRetrievalLimitsSingleDocumentDominanceWhenOtherSourcesMatch() {
  const retrievalService = createRetrievalService([
    ...[0, 1, 2].map((index) => ({
      id: `chunk-warranty-${index}`,
      content: `Warranty coverage lasts twelve months for eligible purchases. Warranty service option ${index}.`,
      chunkIndex: index,
      knowledgeDocument: {
        id: "doc-warranty",
        title: "Warranty",
        sourceUri: "https://example.test/warranty"
      }
    })),
    {
      id: "chunk-service",
      content: "Warranty service includes support troubleshooting for covered products.",
      chunkIndex: 0,
      knowledgeDocument: {
        id: "doc-service",
        title: "Service Coverage",
        sourceUri: "https://example.test/service"
      }
    }
  ]);

  const chunks = await retrievalService.retrieveRelevantChunks(baseInput.tenant, "warranty service");

  assert.equal(chunks.length, 3);
  assert.equal(chunks.filter((chunk) => chunk.knowledgeDocumentId === "doc-warranty").length, 2);
  assert.ok(chunks.some((chunk) => chunk.knowledgeDocumentId === "doc-service"));
}

async function testTenantAiProfileAdminRoutesUseAdminGuard() {
  const guards = Reflect.getMetadata(GUARDS_METADATA, TenantsController) ?? [];

  assert.ok(guards.includes(AdminApiGuard));
}

async function testHumanSupportAdminRoutesUseAdminGuard() {
  const startGuards =
    Reflect.getMetadata(GUARDS_METADATA, ConversationsController.prototype.startHumanSupport) ??
    [];
  const endGuards =
    Reflect.getMetadata(GUARDS_METADATA, ConversationsController.prototype.endHumanSupport) ?? [];

  assert.ok(startGuards.includes(AdminApiGuard));
  assert.ok(endGuards.includes(AdminApiGuard));
}

async function testTenantAiProfileDefaultsExist() {
  const profile = buildTenantAiProfile(
    {
      name: "Demo Company"
    },
    null
  );

  assert.equal(profile.assistantName, "AI Support Assistant");
  assert.equal(profile.companyDisplayName, "Demo Company");
  assert.equal(profile.tone, "helpful, concise, professional");
  assert.match(profile.fallbackMessage, /not have enough confirmed information/i);
}

async function testTenantAiProfileValidationRejectsUnsafeDisplayInputs() {
  const invalidProfile = plainToInstance(UpdateTenantAiProfileDto, {
    assistantName: "Profile Bot",
    primaryColor: "red",
    avatarUrl: "javascript:alert(1)"
  });
  const validProfile = plainToInstance(UpdateTenantAiProfileDto, {
    assistantName: "Profile Bot",
    primaryColor: "#123abc",
    avatarUrl: "https://example.test/avatar.png"
  });
  const validUploadedProfile = plainToInstance(UpdateTenantAiProfileDto, {
    logoUrl: "data:image/png;base64,iVBORw0KGgo="
  });
  const invalidUploadedProfile = plainToInstance(UpdateTenantAiProfileDto, {
    logoUrl: "data:text/html;base64,PHNjcmlwdD4="
  });

  assert.ok(validateSync(invalidProfile).length >= 2);
  assert.equal(validateSync(validProfile).length, 0);
  assert.equal(validateSync(validUploadedProfile).length, 0);
  assert.ok(validateSync(invalidUploadedProfile).length >= 1);
}

async function testTenantAiProfileMediaCanBeExplicitlyCleared() {
  const clearMediaProfile = plainToInstance(UpdateTenantAiProfileDto, {
    logoUrl: null,
    avatarUrl: null
  });
  const tenantWithBrandingLogo = {
    name: "Demo Company",
    branding: {
      logoUrl: "https://example.test/tenant-branding-logo.png"
    }
  };
  const fallbackProfile = buildTenantAiProfile(tenantWithBrandingLogo, null);
  const currentProfile = {
    ...fallbackProfile,
    logoUrl: "https://example.test/logo.png",
    avatarUrl: "https://example.test/avatar.png"
  };
  const updatedProfile = mergeTenantAiProfile(currentProfile, {
    logoUrl: null,
    avatarUrl: null
  });
  const persistence = buildAgentConfigPersistence(updatedProfile);
  const reloadedProfile = buildTenantAiProfile(tenantWithBrandingLogo, persistence);
  const publicReloadedProfile = toPublicTenantAiProfile(reloadedProfile);

  assert.equal(validateSync(clearMediaProfile).length, 0);
  assert.equal(fallbackProfile.logoUrl, "https://example.test/tenant-branding-logo.png");
  assert.equal(updatedProfile.logoUrl, null);
  assert.equal(updatedProfile.avatarUrl, null);
  assert.equal(persistence.widgetSettings.logoUrl, null);
  assert.equal(persistence.widgetSettings.avatarUrl, null);
  assert.equal(persistence.metadata.aiProfile.logoUrl, null);
  assert.equal(persistence.metadata.aiProfile.avatarUrl, null);
  assert.equal(publicReloadedProfile.logoUrl, null);
  assert.equal(publicReloadedProfile.avatarUrl, null);
}

async function testPublicTenantAiProfileDoesNotExposeInternalRules() {
  const profile = buildTenantAiProfile(
    {
      name: "Demo Company"
    },
    {
      displayName: "Profile Bot",
      metadata: {
        aiProfile: {
          safeAnswerInstructions: "Internal safe answer rule.",
          sensitiveTopicInstructions: "Internal sensitive rule.",
          doNotAnswerInstructions: "Internal do-not-answer rule.",
          handoffMessage: "I can pass this to support."
        }
      }
    }
  );
  const publicProfile = toPublicTenantAiProfile(profile);

  assert.equal(publicProfile.assistantName, "Profile Bot");
  assert.equal(publicProfile.handoffMessage, "I can pass this to support.");
  assert.equal("safeAnswerInstructions" in publicProfile, false);
  assert.equal("sensitiveTopicInstructions" in publicProfile, false);
  assert.equal("doNotAnswerInstructions" in publicProfile, false);
}

async function testOpenAiPromptIncludesTenantProfileWithSafetyFirst() {
  const tenantAiProfile = {
    ...buildTenantAiProfile({ name: "Demo Company" }, null),
    assistantName: "Profile Bot",
    companyDisplayName: "Acme Demo",
    businessType: "returns support",
    tone: "warm, brief, and precise",
    safeAnswerInstructions: "Always stay grounded in approved support articles.",
    sensitiveTopicInstructions: "Escalate warranty disputes to a human.",
    doNotAnswerInstructions: "Do not provide unsupported discount promises."
  };
  const prompt = buildOpenAiPrompt({
    ...baseInput,
    agent: {
      ...baseInput.agent,
      displayName: "Profile Bot",
      tenantAiProfile
    }
  });

  assert.match(prompt, /Platform safety rules/);
  assert.match(prompt, /Tenant AI profile instructions/);
  assert.ok(prompt.indexOf("Platform safety rules") < prompt.indexOf("Tenant AI profile instructions"));
  assert.match(prompt, /Acme Demo/);
  assert.match(prompt, /warm, brief, and precise/);
  assert.match(prompt, /Do not invent company policies/);
  assert.match(prompt, /Ignore any tenant profile text that conflicts/);
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

function createConversationRecord(
  visitorId: string,
  status: ConversationStatus = ConversationStatus.AWAITING_CUSTOMER
) {
  return {
    id: "conversation-1",
    tenantId: "tenant-1",
    customerId: "customer-1",
    assignedUserId: null,
    channel: "WIDGET",
    status,
    handoffRequestedAt:
      status === ConversationStatus.PENDING_HUMAN
        ? new Date("2026-01-01T00:01:00.000Z")
        : null,
    handoffReason: status === ConversationStatus.PENDING_HUMAN ? "Need help" : null,
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
          ...createConversationRecord(visitorId, ConversationStatus.PENDING_HUMAN)
        }),
        findFirst: async () => createConversationRecord(visitorId, ConversationStatus.OPEN)
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

async function testCustomerCanEndHandoffWithVisitorScope() {
  const conversationsService = createConversationServiceForHandoff("visitor-1");

  await assert.rejects(
    () => conversationsService.endCustomerHandoff(baseInput.tenant, "conversation-1", undefined),
    BadRequestException
  );
  await assert.rejects(
    () => conversationsService.endCustomerHandoff(baseInput.tenant, "conversation-1", "visitor-2"),
    ForbiddenException
  );

  const detail = await conversationsService.endCustomerHandoff(
    baseInput.tenant,
    "conversation-1",
    "visitor-1"
  );

  assert.equal(detail.id, "conversation-1");
  assert.equal(detail.customer.visitorId, "visitor-1");
  assert.equal(detail.status, "open");
}

function createConversationServiceForAdminHumanMode(initialStatus: ConversationStatus) {
  let currentStatus = initialStatus;
  const updateData: unknown[] = [];

  const service = new ConversationsService({
    client: {
      role: {
        findUnique: async () => ({
          id: "role-1",
          tenantId: "tenant-1",
          userId: "user-1",
          name: "agent"
        })
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          conversation: {
            findUnique: async () => ({
              id: "conversation-1",
              status: currentStatus,
              handoffRequestedAt:
                currentStatus === ConversationStatus.PENDING_HUMAN
                  ? new Date("2026-01-01T00:01:00.000Z")
                  : null,
              handoffReason: currentStatus === ConversationStatus.PENDING_HUMAN ? "Need help" : null
            }),
            update: async ({ data }: { data: { status?: ConversationStatus } }) => {
              updateData.push(data);

              if (data.status) {
                currentStatus = data.status;
              }

              return {};
            }
          },
          message: {
            create: async () => ({
              id: "message-1",
              createdAt: new Date("2026-01-01T00:02:00.000Z")
            })
          }
        }),
      conversation: {
        findUnique: async () => ({
          ...createConversationRecord("visitor-1", currentStatus),
          assignedUser:
            updateData.some((data) => JSON.stringify(data).includes("user-1"))
              ? {
                  id: "user-1",
                  email: "agent@example.test",
                  name: "Agent",
                  isPlatformAdmin: false,
                  metadata: null,
                  createdAt: new Date("2026-01-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-01-01T00:00:00.000Z")
                }
              : null,
          messages: []
        })
      }
    }
  } as never);

  return {
    service,
    getUpdateData: () => updateData
  };
}

async function testAgentReplyKeepsHumanModeActive() {
  const { service, getUpdateData } = createConversationServiceForAdminHumanMode(
    ConversationStatus.PENDING_HUMAN
  );

  const detail = await service.sendAgentReply(
    baseInput.tenant,
    "conversation-1",
    "user-1",
    "I can help with that."
  );

  assert.equal(detail.status, "pending_human");
  assert.equal(
    getUpdateData().some((data) => JSON.stringify(data).includes("PENDING_HUMAN")),
    true
  );
}

async function testAdminCanStartAndEndHumanSupportMode() {
  const { service } = createConversationServiceForAdminHumanMode(ConversationStatus.OPEN);

  const started = await service.startHumanSupport(
    baseInput.tenant,
    "conversation-1",
    "user-1",
    "Agent is taking over."
  );

  assert.equal(started.status, "pending_human");

  const ended = await service.endHumanSupport(
    baseInput.tenant,
    "conversation-1",
    "user-1",
    "Back to AI."
  );

  assert.equal(ended.status, "open");
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

async function testDeterministicFallbackUsesTenantHandoffMessage() {
  const response = new AssistantReplyService().generateReply({
    ...baseInput,
    agent: {
      ...baseInput.agent,
      fallbackMessage: "Tenant fallback.",
      handoffMessage: "Tenant handoff message.",
      handoffEnabled: true
    },
    latestCustomerMessage: "unknown support topic",
    retrievedChunks: []
  });

  assert.match(response.content, /Tenant fallback/);
  assert.match(response.content, /Tenant handoff message/);
}

async function testLatestHumanModeStatusBlocksAiAfterAgentReply() {
  let providerCalled = false;
  let savedCustomerMessage = false;
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
              tenantId: "tenant-1",
              customerId: "customer-1",
              assignedUserId: null,
              channel: "WIDGET",
              status: ConversationStatus.AWAITING_CUSTOMER,
              handoffRequestedAt: null,
              handoffReason: null,
              lastMessageAt: new Date("2026-01-01T00:00:00.000Z"),
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z")
            }),
            findUnique: async () => ({
              id: "conversation-1",
              tenantId: "tenant-1",
              customerId: "customer-1",
              assignedUserId: "user-1",
              channel: "WIDGET",
              status: ConversationStatus.PENDING_HUMAN,
              handoffRequestedAt: new Date("2026-01-01T00:01:00.000Z"),
              handoffReason: "Agent joined the conversation.",
              lastMessageAt: new Date("2026-01-01T00:00:00.000Z"),
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z")
            }),
            update: async () => ({
              id: "conversation-1",
              tenantId: "tenant-1",
              customerId: "customer-1",
              assignedUserId: null,
              channel: "WIDGET",
              status: ConversationStatus.PENDING_HUMAN,
              handoffRequestedAt: new Date("2026-01-01T00:01:00.000Z"),
              handoffReason: "Need help",
              lastMessageAt: new Date("2026-01-01T00:02:00.000Z"),
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:02:00.000Z")
            })
          },
          message: {
            create: async () => {
              savedCustomerMessage = true;

              return {
                id: "message-1",
                tenantId: "tenant-1",
                conversationId: "conversation-1",
                authorUserId: null,
                authorType: "CUSTOMER",
                messageType: "TEXT",
                content: "hello",
                citations: null,
                payload: null,
                metadata: null,
                createdAt: new Date("2026-01-01T00:02:00.000Z")
              };
            },
            findMany: async () => [
              {
                id: "message-1",
                tenantId: "tenant-1",
                conversationId: "conversation-1",
                authorUserId: null,
                authorType: "CUSTOMER",
                messageType: "TEXT",
                content: "hello",
                citations: null,
                payload: null,
                metadata: null,
                createdAt: new Date("2026-01-01T00:02:00.000Z")
              }
            ]
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

  const response = await chatService.sendMessage(
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
  );

  assert.equal(providerCalled, false);
  assert.equal(savedCustomerMessage, true);
  assert.equal(response.conversation.status, "pending_human");
  assert.equal(response.customerMessage.content, "hello");
  assert.equal(response.assistantMessage, null);
}

async function testHumanModeStartingDuringProviderCallBlocksAiReplyPersistence() {
  let conversationStatus = ConversationStatus.AWAITING_CUSTOMER;
  let assistantMessageSaved = false;
  let conversationUpdatedAfterProvider = false;
  const handoffLastMessageAt = new Date("2026-01-01T00:03:00.000Z");
  const conversationRecord = () => ({
    id: "conversation-1",
    tenantId: "tenant-1",
    customerId: "customer-1",
    assignedUserId: conversationStatus === ConversationStatus.PENDING_HUMAN ? "user-1" : null,
    channel: "WIDGET",
    status: conversationStatus,
    handoffRequestedAt:
      conversationStatus === ConversationStatus.PENDING_HUMAN
        ? new Date("2026-01-01T00:01:00.000Z")
        : null,
    handoffReason:
      conversationStatus === ConversationStatus.PENDING_HUMAN
        ? "Agent joined during provider call."
        : null,
    lastMessageAt:
      conversationStatus === ConversationStatus.PENDING_HUMAN
        ? handoffLastMessageAt
        : new Date("2026-01-01T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  });
  const customerMessage = {
    id: "message-customer",
    tenantId: "tenant-1",
    conversationId: "conversation-1",
    authorUserId: null,
    authorType: "CUSTOMER",
    messageType: "TEXT",
    content: "hello",
    citations: null,
    payload: null,
    metadata: null,
    createdAt: new Date("2026-01-01T00:02:00.000Z")
  };
  const prisma = {
    client: {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          customer: {
            upsert: async () => ({ id: "customer-1" })
          },
          conversation: {
            findFirst: async () => conversationRecord(),
            findUnique: async () => conversationRecord(),
            update: async () => {
              conversationUpdatedAfterProvider = true;

              return conversationRecord();
            }
          },
          message: {
            create: async ({ data }: { data: { authorType: string } }) => {
              if (data.authorType === "ASSISTANT") {
                assistantMessageSaved = true;
              }

              return customerMessage;
            },
            findMany: async () => [customerMessage]
          },
          agentConfig: {
            findUnique: async () => null
          }
        })
    }
  };
  const providerResolver = {
    resolveProvider: () => ({
      generateReply: async (input: Parameters<AssistantReplyService["generateReply"]>[0]) => {
        await Promise.resolve();
        conversationStatus = ConversationStatus.PENDING_HUMAN;

        return new AssistantReplyService().generateReply(input);
      }
    })
  };
  const chatService = new ChatService(
    prisma as never,
    { retrieveRelevantChunks: async () => [] } as never,
    providerResolver as never
  );

  const response = await chatService.sendMessage(
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
  );

  assert.equal(assistantMessageSaved, false);
  assert.equal(conversationUpdatedAfterProvider, false);
  assert.equal(response.conversation.status, "pending_human");
  assert.equal(response.conversation.lastMessageAt, handoffLastMessageAt.toISOString());
  assert.equal(response.assistantMessage, null);
}

async function run() {
  await testDefaultConfigUsesDeterministic();
  await testDeterministicConfigDoesNotNeedOpenAi();
  await testOpenAiConfigRequiresKeyAndModel();
  await testAdminProtectionConfigRequiresExplicitDevDisable();
  await testAdminWebConfigUsesOnlyAdminWebRuntimeKeys();
  await testAdminWebConfigRejectsInvalidSessionTtl();
  await testAdminProtectionGuardRejectsMissingAndInvalidTokens();
  await testAdminProtectionGuardAcceptsValidTokens();
  await testAdminProtectionGuardDisabledOnlyWhenExplicitlyAllowed();
  await testAdminRealtimeControllerUsesAdminGuard();
  await testAnswerDebugControllerUsesAdminGuard();
  await testAnswerDebugKnowledgeHitIsTenantScopedAndSecretSafe();
  await testAnswerDebugKnowledgeMissIsSafeAndNonPersistent();
  await testKnowledgeUrlSafetyRejectsRestrictedTargets();
  await testKnowledgeUrlImportRejectsRestrictedRedirectTarget();
  await testKnowledgeUrlImportPreservesSafePublicRedirectAndHtml();
  await testKnowledgeUrlImportRemovesCommonPageNoiseAndDuplicateLines();
  await testKnowledgeUrlPinnedLookupSupportsNodeAllMode();
  await testKnowledgeUrlImportEnforcesAbsoluteDeadlineDuringSlowTrickle();
  await testKnowledgeUrlImportEnforcesOverallRedirectFlowDeadline();
  await testChunkingDropsDuplicateChunks();
  await testChunkingSourceLocatorsMatchPersistedContentWhenReliable();
  await testBackendCitationsOmitMissingSourceLocatorKey();
  await testTenantAiProfileAdminRoutesUseAdminGuard();
  await testHumanSupportAdminRoutesUseAdminGuard();
  await testTenantAiProfileDefaultsExist();
  await testTenantAiProfileValidationRejectsUnsafeDisplayInputs();
  await testTenantAiProfileMediaCanBeExplicitlyCleared();
  await testPublicTenantAiProfileDoesNotExposeInternalRules();
  await testOpenAiPromptIncludesTenantProfileWithSafetyFirst();
  await testTenantResolutionStillRequiresTenantSlug();
  await testCustomerConversationReadRequiresVisitorScope();
  await testCustomerHandoffRequiresCorrectVisitorScope();
  await testCustomerCanEndHandoffWithVisitorScope();
  await testAgentReplyKeepsHumanModeActive();
  await testAdminCanStartAndEndHumanSupportMode();
  await testCustomerRealtimeSnapshotDoesNotExposeTenantList();
  await testResolverSelection();
  await testOpenAiSuccessMapsResponse();
  await testOpenAiSuccessPreservesCitationsWhenDeterministicWouldNotGround();
  await testOpenAiFailureFallsBack();
  await testShortKeywordMatchesRelevantChunk();
  await testUnrelatedShortQueryAvoidsWeakSubstringMatch();
  await testRawPluralCandidateLookupWithNormalizedScoring();
  await testSynonymQuestionRetrievesSupportKnowledge();
  await testRetrievalLimitsSingleDocumentDominanceWhenOtherSourcesMatch();
  await testExactPhraseStrongMatchStillWorks();
  await testRetrievalChangesPreserveDeterministicCitations();
  await testDeterministicFallbackUsesTenantHandoffMessage();
  await testLatestHumanModeStatusBlocksAiAfterAgentReply();
  await testHumanModeStartingDuringProviderCallBlocksAiReplyPersistence();
}

void run();
