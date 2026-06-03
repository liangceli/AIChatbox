import type { LlmProvider } from "@platform/ai-core";
import { Inject, Injectable } from "@nestjs/common";
import { AssistantReplyService } from "./assistant-reply.service";

@Injectable()
export class LlmProviderResolverService {
  constructor(
    @Inject(AssistantReplyService)
    private readonly deterministicProvider: AssistantReplyService
  ) {}

  resolveProvider(): LlmProvider {
    return this.deterministicProvider;
  }
}
