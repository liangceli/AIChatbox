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

  console.log("OpenAI smoke test passed: real assistant text, preserved citation, safe metadata.");
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown OpenAI smoke test failure.";

  console.error(`OpenAI smoke test failed: ${message}`);
  process.exitCode = 1;
});
