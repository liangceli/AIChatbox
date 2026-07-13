import { ConversationStatus } from "@platform/database";
import type { ConversationDetail, ConversationListItem } from "@platform/types";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import type { AdminAuthContext } from "../../common/admin-protection/admin-auth-context";
import { MembershipStatus, TenantRole } from "@platform/database";
import { ConversationsService } from "../conversations/conversations.service";
import { humanSupportStatusWhere } from "../conversations/conversation-status";

@Injectable()
export class RealtimeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConversationsService) private readonly conversationsService: ConversationsService
  ) {}

  async createSnapshot(tenant: ResolvedTenant, status?: string, auth?: AdminAuthContext): Promise<{
    conversations: ConversationListItem[];
    pendingHumanCount: number;
    activeConversation: ConversationDetail | null;
  }> {
    const conversations = await this.conversationsService.listConversations(tenant, status || "all", auth);
    const pendingHumanCount = await this.prisma.client.conversation.count({
      where: {
        tenantId: tenant.id,
        status: humanSupportStatusWhere(),
        ...(auth && !auth.isPlatformAdmin && auth.roleName === TenantRole.AGENT
          ? auth.userId && auth.membershipStatus === MembershipStatus.ACTIVE
            ? { OR: [{ assignedUserId: auth.userId }, { assignedUserId: null }] }
            : { id: "__forbidden__" }
          : {})
      }
    });
    const activeConversation = conversations[0]
      ? await this.conversationsService.getConversationDetail(tenant, conversations[0].id, auth)
      : null;

    return {
      conversations,
      pendingHumanCount,
      activeConversation
    };
  }

  async createCustomerSnapshot(
    tenant: ResolvedTenant,
    conversationId?: string,
    visitorId?: string
  ): Promise<{
    conversation: ConversationDetail | null;
  }> {
    if (!conversationId?.trim() || !visitorId?.trim()) {
      return {
        conversation: null
      };
    }

    try {
      const conversation = await this.conversationsService.getCustomerConversationDetail(
        tenant,
        conversationId,
        visitorId
      );

      return {
        conversation
      };
    } catch {
      return {
        conversation: null
      };
    }
  }
}
