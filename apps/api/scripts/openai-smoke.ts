import { loadServerEnv } from "@platform/config";
import assert from "node:assert/strict";
import { AssistantReplyService } from "../src/modules/chat/assistant-reply.service";
import { OpenAiLlmProviderService } from "../src/modules/chat/openai-llm-provider.service";

async function run() {
  const env = loadServerEnv(process.env);

  if (env.AI_PROVIDER !== "openai") {
    throw new Error("OpenAI smoke test requires AI_PROVIDER=openai.");
  }

  const provider = new OpenAiLlmProviderService(new AssistantReplyService());
  const response = await provider.generateReply({
    tenant: {
      id: "smoke-tenant",
      slug: "smoke",
      name: "Smoke Test Tenant"
    },
    conversation: {
      id: "smoke-conversation"
    },
    agent: {
      displayName: "Smoke Test Assistant",
      tenantAiProfile: {
        assistantName: "Smoke Test Assistant",
        companyDisplayName: "Smoke Test Tenant",
        businessType: "customer support smoke test",
        tone: "clear, concise, and careful",
        welcomeMessage: "Hi, how can I help today?",
        fallbackMessage:
          "I do not have enough confirmed information to answer that. I can connect you with the team for help.",
        handoffMessage: "I can pass this to a team member for support.",
        safeAnswerInstructions: "Answer only from the provided smoke-test support context.",
        sensitiveTopicInstructions: "For sensitive or uncertain questions, recommend human support.",
        doNotAnswerInstructions: "Do not invent unsupported warranty terms or internal details.",
        primaryColor: null,
        logoUrl: null,
        avatarUrl: null
      },
      handoffEnabled: true
    },
    latestCustomerMessage: "Can you summarize the warranty coverage?",
    retrievedChunks: [
      {
        knowledgeDocumentId: "smoke-doc",
        chunkId: "smoke-chunk",
        title: "Warranty Coverage",
        chunkIndex: 0,
        sourceUri: "https://example.test/warranty",
        relevanceScore: 12,
        content: "Warranty coverage lasts 12 months for eligible purchases."
      }
    ]
  });

  assert.equal(response.metadata.providerName, "openai");
  assert.equal(response.metadata.mode, "openai");
  assert.equal(response.metadata.usedFallback, false);
  assert.equal(response.metadata.deterministic, false);
  assert.ok(response.content.trim().length > 0, "OpenAI smoke test expected assistant text.");
  assert.equal(response.citations?.length, 1, "OpenAI smoke test expected preserved citations.");

  const metadataJson = JSON.stringify(response.metadata);
  const apiKey = env.OPENAI_API_KEY?.trim();

  if (apiKey) {
    assert.equal(metadataJson.includes(apiKey), false, "Provider metadata must not include API keys.");
  }

  console.log("OpenAI smoke test passed.");
  console.log(`- providerMode: ${response.metadata.mode}`);
  console.log(
    `- attemptedRealOpenAI: ${response.metadata.providerName === "openai" && !response.metadata.deterministic}`
  );
  console.log(`- assistantTextReturned: ${response.content.trim().length > 0}`);
  console.log(`- citationsReturned: ${(response.citations?.length ?? 0) > 0}`);
  console.log(`- providerMetadataReturned: ${Boolean(response.metadata.providerName && response.metadata.mode)}`);
  console.log(`- usedFallback: ${response.metadata.usedFallback}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OpenAI smoke test failure.";

  console.error(`OpenAI smoke test failed: ${message}`);
  process.exitCode = 1;
});
