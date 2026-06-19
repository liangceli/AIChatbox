import type { SendChatMessageResponse } from "@platform/types";
import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { ChatService } from "./chat.service";
import { SendChatMessageDto } from "./dto/send-chat-message.dto";
import { CurrentWidgetSession } from "../widget-session/current-widget-session.decorator";
import { WidgetSessionGuard } from "../widget-session/widget-session.guard";
import type { WidgetSessionContext } from "../widget-session/widget-session.types";

@Controller("chat")
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @Post("messages")
  @UseGuards(WidgetSessionGuard)
  async sendMessage(
    @CurrentTenant() tenant: ResolvedTenant,
    @Body() body: SendChatMessageDto,
    @CurrentWidgetSession() session: WidgetSessionContext
  ): Promise<SendChatMessageResponse> {
    return this.chatService.sendMessage(tenant, { ...body, visitorId: session.visitorId });
  }
}
