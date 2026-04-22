import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ChatMessageRecord, ConversationSummary } from "@platform/types";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { toChatMessageRecord, toConversationSummary } from "../chat/chat.presenter";

@Injectable()
export class ConversationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getConversation(tenant: ResolvedTenant, conversationId: string): Promise<ConversationSummary> {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: {
        id_tenantId: {
          id: conversationId,
          tenantId: tenant.id
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }

    return toConversationSummary(conversation);
  }

  async listMessages(tenant: ResolvedTenant, conversationId: string): Promise<ChatMessageRecord[]> {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: {
        id_tenantId: {
          id: conversationId,
          tenantId: tenant.id
        }
      },
      select: {
        id: true
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }

    const messages = await this.prisma.client.message.findMany({
      where: {
        tenantId: tenant.id,
        conversationId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return messages.map(toChatMessageRecord);
  }
}
