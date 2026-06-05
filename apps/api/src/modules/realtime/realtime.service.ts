import { ConversationStatus } from "@platform/database";
import type { ConversationDetail, ConversationListItem } from "@platform/types";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { ConversationsService } from "../conversations/conversations.service";

@Injectable()
export class RealtimeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConversationsService) private readonly conversationsService: ConversationsService
  ) {}

  async createSnapshot(tenant: ResolvedTenant, status?: string): Promise<{
    conversations: ConversationListItem[];
    pendingHumanCount: number;
    activeConversation: ConversationDetail | null;
  }> {
    const conversations = await this.conversationsService.listConversations(tenant, status || "all");
    const pendingHumanCount = await this.prisma.client.conversation.count({
      where: {
        tenantId: tenant.id,
        status: ConversationStatus.PENDING_HUMAN
      }
    });
    const activeConversation = conversations[0]
      ? await this.conversationsService.getConversationDetail(tenant, conversations[0].id)
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
