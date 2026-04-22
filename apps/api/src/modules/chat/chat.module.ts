import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { AssistantReplyService } from "./assistant-reply.service";
import { ChatService } from "./chat.service";

@Module({
  controllers: [ChatController],
  providers: [AssistantReplyService, ChatService]
})
export class ChatModule {}
