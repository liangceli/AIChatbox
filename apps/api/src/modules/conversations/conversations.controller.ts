import type { ChatMessageRecord, ConversationSummary } from "@platform/types";
import { Controller, Get, Inject, Param } from "@nestjs/common";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { ConversationsService } from "./conversations.service";

@Controller("conversations")
export class ConversationsController {
  constructor(
    @Inject(ConversationsService) private readonly conversationsService: ConversationsService
  ) {}

  @Get(":conversationId")
  async getConversation(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<ConversationSummary> {
    return this.conversationsService.getConversation(tenant, conversationId);
  }

  @Get(":conversationId/messages")
  async listMessages(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<ChatMessageRecord[]> {
    return this.conversationsService.listMessages(tenant, conversationId);
  }
}
