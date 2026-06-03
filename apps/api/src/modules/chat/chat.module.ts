import { Module } from "@nestjs/common";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { ChatController } from "./chat.controller";
import { AssistantReplyService } from "./assistant-reply.service";
import { ChatService } from "./chat.service";
import { LlmProviderResolverService } from "./llm-provider-resolver.service";
import { OpenAiLlmProviderService } from "./openai-llm-provider.service";

@Module({
  imports: [KnowledgeModule],
  controllers: [ChatController],
  providers: [AssistantReplyService, OpenAiLlmProviderService, LlmProviderResolverService, ChatService]
})
export class ChatModule {}
