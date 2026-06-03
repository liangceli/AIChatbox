import type { LlmProvider } from "@platform/ai-core";
import { loadServerEnv, type ServerEnv } from "@platform/config";
import { Inject, Injectable } from "@nestjs/common";
import { AssistantReplyService } from "./assistant-reply.service";
import { OpenAiLlmProviderService } from "./openai-llm-provider.service";

@Injectable()
export class LlmProviderResolverService {
  private env: ServerEnv;

  constructor(
    @Inject(AssistantReplyService)
    private readonly deterministicProvider: AssistantReplyService,
    @Inject(OpenAiLlmProviderService)
    private readonly openAiProvider: OpenAiLlmProviderService
  ) {
    this.env = loadServerEnv(process.env);
  }

  static createForTest(
    deterministicProvider: AssistantReplyService,
    openAiProvider: OpenAiLlmProviderService,
    env: ServerEnv
  ): LlmProviderResolverService {
    const service = new LlmProviderResolverService(deterministicProvider, openAiProvider);
    service.env = env;

    return service;
  }

  resolveProvider(): LlmProvider {
    if (this.env.AI_PROVIDER === "openai") {
      return this.openAiProvider;
    }

    return this.deterministicProvider;
  }
}
