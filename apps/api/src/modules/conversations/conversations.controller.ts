import type {
  ChatMessageRecord,
  ConversationDetail,
  ConversationListItem,
  ConversationSummary,
  SupportUserRecord
} from "@platform/types";
import { Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { AssignConversationDto } from "./dto/assign-conversation.dto";
import { ListConversationsQueryDto } from "./dto/list-conversations-query.dto";
import { RequestHandoffDto } from "./dto/request-handoff.dto";
import { SendAgentReplyDto } from "./dto/send-agent-reply.dto";
import { ConversationsService } from "./conversations.service";

@Controller("conversations")
export class ConversationsController {
  constructor(
    @Inject(ConversationsService) private readonly conversationsService: ConversationsService
  ) {}

  @Get()
  @UseGuards(AdminApiGuard)
  async listConversations(
    @CurrentTenant() tenant: ResolvedTenant,
    @Query() query: ListConversationsQueryDto
  ): Promise<ConversationListItem[]> {
    return this.conversationsService.listConversations(tenant, query.status);
  }

  @Get("support-users")
  @UseGuards(AdminApiGuard)
  async listSupportUsers(@CurrentTenant() tenant: ResolvedTenant): Promise<SupportUserRecord[]> {
    return this.conversationsService.listSupportUsers(tenant);
  }

  @Get(":conversationId")
  async getConversation(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<ConversationSummary> {
    return this.conversationsService.getConversation(tenant, conversationId);
  }

  @Get(":conversationId/detail")
  async getConversationDetail(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<ConversationDetail> {
    return this.conversationsService.getConversationDetail(tenant, conversationId);
  }

  @Get(":conversationId/messages")
  async listMessages(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<ChatMessageRecord[]> {
    return this.conversationsService.listMessages(tenant, conversationId);
  }

  @Post(":conversationId/handoff")
  async requestHandoff(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @Body() body: RequestHandoffDto
  ): Promise<ConversationDetail> {
    return this.conversationsService.requestHandoff(
      tenant,
      conversationId,
      body.visitorId,
      body.reason
    );
  }

  @Post(":conversationId/assign")
  @UseGuards(AdminApiGuard)
  async assignConversation(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @Body() body: AssignConversationDto
  ): Promise<ConversationDetail> {
    return this.conversationsService.assignConversation(tenant, conversationId, body.userId);
  }

  @Post(":conversationId/agent-replies")
  @UseGuards(AdminApiGuard)
  async sendAgentReply(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @Body() body: SendAgentReplyDto
  ): Promise<ConversationDetail> {
    return this.conversationsService.sendAgentReply(
      tenant,
      conversationId,
      body.userId,
      body.message
    );
  }

  @Delete(":conversationId/messages")
  @UseGuards(AdminApiGuard)
  async clearMessageHistory(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<ConversationDetail> {
    return this.conversationsService.clearMessageHistory(tenant, conversationId);
  }

  @Delete(":conversationId")
  @UseGuards(AdminApiGuard)
  async deleteConversation(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<{ deleted: true }> {
    await this.conversationsService.deleteConversation(tenant, conversationId);
    return { deleted: true };
  }
}
