import { ConversationStatus } from "@platform/database";
import { loadServerEnv, type ServerEnv } from "@platform/config";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { AssistantReplyService } from "../src/modules/chat/assistant-reply.service";
import { ChatService } from "../src/modules/chat/chat.service";
import { LlmProviderResolverService } from "../src/modules/chat/llm-provider-resolver.service";
import { OpenAiLlmProviderService } from "../src/modules/chat/openai-llm-provider.service";

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

function createOpenAiEnv(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return loadServerEnv({
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-test",
    ...overrides
  });
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
  assert.match(response.content, /support knowledge base/i);
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
  await testResolverSelection();
  await testOpenAiSuccessMapsResponse();
  await testOpenAiSuccessPreservesCitationsWhenDeterministicWouldNotGround();
  await testOpenAiFailureFallsBack();
  await testPendingHumanGuardPreventsProviderCall();
}

void run();
