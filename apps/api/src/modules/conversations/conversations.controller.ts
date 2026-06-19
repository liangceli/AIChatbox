import type {
  ChatMessageRecord,
  ConversationDetail,
  ConversationListItem,
  ConversationSummary,
  SupportUserRecord
} from "@platform/types";
import { TenantRole } from "@platform/database";
import { Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { AdminApiGuard } from "../../common/admin-protection/admin-api.guard";
import { RequireTenantRoles } from "../../common/admin-protection/access-policy.decorator";
import { CurrentAdminAuth } from "../../common/admin-protection/current-admin-auth.decorator";
import { CurrentTenant } from "../../common/tenant/current-tenant.decorator";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { AssignConversationDto } from "./dto/assign-conversation.dto";
import { ListConversationsQueryDto } from "./dto/list-conversations-query.dto";
import { RequestHandoffDto } from "./dto/request-handoff.dto";
import { SendAgentReplyDto } from "./dto/send-agent-reply.dto";
import { UpdateHumanSupportDto } from "./dto/update-human-support.dto";
import { ConversationsService } from "./conversations.service";
import { CurrentWidgetSession } from "../widget-session/current-widget-session.decorator";
import { WidgetSessionGuard } from "../widget-session/widget-session.guard";
import type { WidgetSessionContext } from "../widget-session/widget-session.types";

@Controller("conversations")
export class ConversationsController {
  constructor(
    @Inject(ConversationsService) private readonly conversationsService: ConversationsService
  ) {}

  @Get()
  @UseGuards(AdminApiGuard)
  async listConversations(
    @CurrentTenant() tenant: ResolvedTenant,
    @Query() query: ListConversationsQueryDto,
    @CurrentAdminAuth() adminAuth: AdminAuthContext
  ): Promise<ConversationListItem[]> {
    return this.conversationsService.listConversations(tenant, query.status, adminAuth);
  }

  @Get("support-users")
  @UseGuards(AdminApiGuard)
  @RequireTenantRoles(TenantRole.OWNER)
  async listSupportUsers(@CurrentTenant() tenant: ResolvedTenant): Promise<SupportUserRecord[]> {
    return this.conversationsService.listSupportUsers(tenant);
  }

  @Get(":conversationId")
  @UseGuards(AdminApiGuard)
  async getConversation(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @CurrentAdminAuth() adminAuth: AdminAuthContext
  ): Promise<ConversationSummary> {
    return this.conversationsService.getConversation(tenant, conversationId, adminAuth);
  }

  @Get(":conversationId/detail")
  @UseGuards(AdminApiGuard)
  async getConversationDetail(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @CurrentAdminAuth() adminAuth: AdminAuthContext
  ): Promise<ConversationDetail> {
    return this.conversationsService.getConversationDetail(tenant, conversationId, adminAuth);
  }

  @Get(":conversationId/customer-detail")
  @UseGuards(WidgetSessionGuard)
  async getCustomerConversationDetail(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @CurrentWidgetSession() session: WidgetSessionContext
  ): Promise<ConversationDetail> {
    return this.conversationsService.getCustomerConversationDetail(tenant, conversationId, session.visitorId);
  }

  @Get(":conversationId/messages")
  @UseGuards(AdminApiGuard)
  async listMessages(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @CurrentAdminAuth() adminAuth: AdminAuthContext
  ): Promise<ChatMessageRecord[]> {
    return this.conversationsService.listMessages(tenant, conversationId, adminAuth);
  }

  @Get(":conversationId/customer-messages")
  @UseGuards(WidgetSessionGuard)
  async listCustomerMessages(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @CurrentWidgetSession() session: WidgetSessionContext
  ): Promise<ChatMessageRecord[]> {
    return this.conversationsService.listCustomerMessages(tenant, conversationId, session.visitorId);
  }

  @Post(":conversationId/handoff")
  @UseGuards(WidgetSessionGuard)
  async requestHandoff(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @Body() body: RequestHandoffDto,
    @CurrentWidgetSession() session: WidgetSessionContext
  ): Promise<ConversationDetail> {
    return this.conversationsService.requestHandoff(
      tenant,
      conversationId,
      session.visitorId,
      body.reason
    );
  }

  @Post(":conversationId/handoff/end")
  @UseGuards(WidgetSessionGuard)
  async endCustomerHandoff(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @Body() body: RequestHandoffDto,
    @CurrentWidgetSession() session: WidgetSessionContext
  ): Promise<ConversationDetail> {
    return this.conversationsService.endCustomerHandoff(
      tenant,
      conversationId,
      session.visitorId,
      body.reason
    );
  }

  @Post(":conversationId/human-support/start")
  @UseGuards(AdminApiGuard)
  async startHumanSupport(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @Body() body: UpdateHumanSupportDto,
    @CurrentAdminAuth() adminAuth?: AdminAuthContext
  ): Promise<ConversationDetail> {
    return this.conversationsService.startHumanSupport(
      tenant,
      conversationId,
      resolveActingUserId(adminAuth, body.userId),
      body.reason,
      adminAuth
    );
  }

  @Post(":conversationId/human-support/end")
  @UseGuards(AdminApiGuard)
  async endHumanSupport(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string,
    @Body() body: UpdateHumanSupportDto,
    @CurrentAdminAuth() adminAuth?: AdminAuthContext
  ): Promise<ConversationDetail> {
    return this.conversationsService.endHumanSupport(
      tenant,
      conversationId,
      resolveActingUserId(adminAuth, body.userId),
      body.reason,
      adminAuth
    );
  }

  @Post(":conversationId/assign")
  @UseGuards(AdminApiGuard)
  @RequireTenantRoles(TenantRole.OWNER)
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
    @Body() body: SendAgentReplyDto,
    @CurrentAdminAuth() adminAuth?: AdminAuthContext
  ): Promise<ConversationDetail> {
    return this.conversationsService.sendAgentReply(
      tenant,
      conversationId,
      resolveActingUserId(adminAuth, body.userId),
      body.message,
      adminAuth
    );
  }

  @Delete(":conversationId/messages")
  @UseGuards(AdminApiGuard)
  @RequireTenantRoles(TenantRole.OWNER)
  async clearMessageHistory(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<ConversationDetail> {
    return this.conversationsService.clearMessageHistory(tenant, conversationId);
  }

  @Delete(":conversationId")
  @UseGuards(AdminApiGuard)
  @RequireTenantRoles(TenantRole.OWNER)
  async deleteConversation(
    @CurrentTenant() tenant: ResolvedTenant,
    @Param("conversationId") conversationId: string
  ): Promise<{ deleted: true }> {
    await this.conversationsService.deleteConversation(tenant, conversationId);
    return { deleted: true };
  }
}

function resolveActingUserId(adminAuth: AdminAuthContext | undefined, bodyUserId: string | undefined): string {
  return adminAuth?.userId ?? bodyUserId?.trim() ?? "";
}
