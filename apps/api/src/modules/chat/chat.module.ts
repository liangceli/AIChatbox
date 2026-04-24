import { Module } from "@nestjs/common";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { ChatController } from "./chat.controller";
import { AssistantReplyService } from "./assistant-reply.service";
import { ChatService } from "./chat.service";

@Module({
  imports: [KnowledgeModule],
  controllers: [ChatController],
  providers: [AssistantReplyService, ChatService]
})
export class ChatModule {}
