import { Module } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { AnswerDebugController } from "./answer-debug.controller";
import { AnswerDebugService } from "./answer-debug.service";
import { ChatController } from "./chat.controller";
import { AssistantReplyService } from "./assistant-reply.service";
import { ChatService } from "./chat.service";
import { LlmProviderResolverService } from "./llm-provider-resolver.service";
import { OpenAiLlmProviderService } from "./openai-llm-provider.service";

@Module({
  imports: [KnowledgeModule],
  controllers: [ChatController, AnswerDebugController],
  providers: [
    AdminApiGuard,
    AssistantReplyService,
    OpenAiLlmProviderService,
    LlmProviderResolverService,
    ChatService,
    AnswerDebugService
  ]
})
export class ChatModule {}
