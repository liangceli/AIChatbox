import type { SendChatMessageResponse } from "@platform/types";
import { Body, Controller, Inject, Post } from "@nestjs/common";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { ChatService } from "./chat.service";
import { SendChatMessageDto } from "./dto/send-chat-message.dto";

@Controller("chat")
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post("messages")
  async sendMessage(
    @CurrentTenant() tenant: ResolvedTenant,
    @Body() body: SendChatMessageDto
  ): Promise<SendChatMessageResponse> {
    return this.chatService.sendMessage(tenant, body);
  }
}
