import { Module } from "@nestjs/common";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { ChatController } from "./chat.controller";
import { AssistantReplyService } from "./assistant-reply.service";
import { ChatService } from "./chat.service";
import { LlmProviderResolverService } from "./llm-provider-resolver.service";

@Module({
  imports: [KnowledgeModule],
  controllers: [ChatController],
  providers: [AssistantReplyService, LlmProviderResolverService, ChatService]
})
export class ChatModule {}
