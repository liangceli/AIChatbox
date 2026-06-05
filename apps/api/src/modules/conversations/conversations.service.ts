import {
  ConversationStatus,
  MessageAuthor,
  MessageType,
  Prisma,
  type Conversation,
  type Customer,
  type Message,
  type User
} from "@platform/database";
import type {
  ChatMessageRecord,
  ConversationDetail,
  ConversationListItem,
  ConversationSummary,
  SupportUserRecord
} from "@platform/types";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { toChatMessageRecord, toConversationSummary } from "../chat/chat.presenter";

type ConversationWithRelations = Conversation & {
  customer: Customer;
  assignedUser: User | null;
  messages?: (Message & {
    authorUser: Pick<User, "name"> | null;
  })[];
};

@Injectable()
export class ConversationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listConversations(
    tenant: ResolvedTenant,
    status?: string
  ): Promise<ConversationListItem[]> {
    const normalizedStatus = status?.trim().toUpperCase();
    const where: Prisma.ConversationWhereInput = {
      tenantId: tenant.id
    };

    if (normalizedStatus && normalizedStatus !== "ALL") {
      if (!(normalizedStatus in ConversationStatus)) {
        throw new BadRequestException(`Unsupported conversation status filter: ${status}`);
      }

      where.status = normalizedStatus as ConversationStatus;
    }

    const conversations = await this.prisma.client.conversation.findMany({
      where,
      include: {
        customer: true,
        assignedUser: true
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }]
    });

    return conversations.map((conversation) => this.toConversationListItem(conversation));
  }

  async listSupportUsers(tenant: ResolvedTenant): Promise<SupportUserRecord[]> {
    const roles = await this.prisma.client.role.findMany({
      where: {
        tenantId: tenant.id
      },
      include: {
        user: true
      },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }]
    });

    return roles.map((role) => ({
      id: role.user.id,
      email: role.user.email,
      name: role.user.name,
      roleName: role.name
    }));
  }

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

  async getConversationDetail(
    tenant: ResolvedTenant,
    conversationId: string
  ): Promise<ConversationDetail> {
    const conversation = await this.loadConversationDetail(tenant.id, conversationId);

    return this.toConversationDetail(conversation);
  }

  async getCustomerConversationDetail(
    tenant: ResolvedTenant,
    conversationId: string,
    visitorId?: string
  ): Promise<ConversationDetail> {
    const conversation = await this.loadCustomerConversationDetail(tenant.id, conversationId, visitorId);

    return this.toConversationDetail(conversation);
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
      include: {
        authorUser: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    return messages.map((message) => toChatMessageRecord(message));
  }

  async listCustomerMessages(
    tenant: ResolvedTenant,
    conversationId: string,
    visitorId?: string
  ): Promise<ChatMessageRecord[]> {
    await this.loadCustomerConversationDetail(tenant.id, conversationId, visitorId);

    return this.listMessages(tenant, conversationId);
  }

  async requestHandoff(
    tenant: ResolvedTenant,
    conversationId: string,
    visitorId?: string,
    reason?: string
  ): Promise<ConversationDetail> {
    const normalizedVisitorId = visitorId?.trim();

    if (!normalizedVisitorId) {
      throw new BadRequestException("visitorId is required for customer handoff.");
    }

    const normalizedReason = reason?.trim() || null;

    await this.prisma.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
        where: {
          id_tenantId: {
            id: conversationId,
            tenantId: tenant.id
          }
        },
        include: {
          customer: {
            select: {
              visitorId: true
            }
          }
        }
      });

      if (!conversation) {
        throw new NotFoundException("Conversation not found.");
      }

      if (conversation.customer.visitorId !== normalizedVisitorId) {
        throw new ForbiddenException("Conversation does not belong to this visitor.");
      }

      if (conversation.status === ConversationStatus.PENDING_HUMAN) {
        if (normalizedReason) {
          await tx.conversation.update({
            where: {
              id_tenantId: {
                id: conversation.id,
                tenantId: tenant.id
              }
            },
            data: {
              handoffReason: normalizedReason
            }
          });
        }

        return;
      }

      const eventMessage = await tx.message.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          authorType: MessageAuthor.SYSTEM,
          messageType: MessageType.HANDOFF_EVENT,
          content: normalizedReason
            ? `Customer requested human support. Reason: ${normalizedReason}`
            : "Customer requested human support.",
          payload: {
            requestedBy: "customer",
            reason: normalizedReason
          }
        }
      });

      await tx.conversation.update({
        where: {
          id_tenantId: {
            id: conversation.id,
            tenantId: tenant.id
          }
        },
        data: {
          status: ConversationStatus.PENDING_HUMAN,
          handoffRequestedAt: eventMessage.createdAt,
          handoffReason: normalizedReason,
          lastMessageAt: eventMessage.createdAt
        }
      });
    });

    return this.getConversationDetail(tenant, conversationId);
  }

  async assignConversation(
    tenant: ResolvedTenant,
    conversationId: string,
    userId: string
  ): Promise<ConversationDetail> {
    await this.ensureTenantUser(tenant.id, userId);

    const existingConversation = await this.prisma.client.conversation.findUnique({
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

    if (!existingConversation) {
      throw new NotFoundException("Conversation not found.");
    }

    await this.prisma.client.conversation.update({
      where: {
        id_tenantId: {
          id: conversationId,
          tenantId: tenant.id
        }
      },
      data: {
        assignedUserId: userId
      }
    });

    return this.getConversationDetail(tenant, conversationId);
  }

  async sendAgentReply(
    tenant: ResolvedTenant,
    conversationId: string,
    userId: string,
    message: string
  ): Promise<ConversationDetail> {
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      throw new BadRequestException("Agent reply cannot be empty.");
    }

    await this.ensureTenantUser(tenant.id, userId);

    await this.prisma.client.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({
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

      const agentMessage = await tx.message.create({
        data: {
          tenantId: tenant.id,
          conversationId,
          authorType: MessageAuthor.AGENT,
          authorUserId: userId,
          messageType: MessageType.TEXT,
          content: normalizedMessage
        }
      });

      await tx.conversation.update({
        where: {
          id_tenantId: {
            id: conversationId,
            tenantId: tenant.id
          }
        },
        data: {
          assignedUserId: userId,
          status: ConversationStatus.AWAITING_CUSTOMER,
          lastMessageAt: agentMessage.createdAt
        }
      });
    });

    return this.getConversationDetail(tenant, conversationId);
  }

  async clearMessageHistory(
    tenant: ResolvedTenant,
    conversationId: string
  ): Promise<ConversationDetail> {
    await this.ensureConversation(tenant.id, conversationId);

    await this.prisma.client.$transaction([
      this.prisma.client.message.deleteMany({
        where: {
          tenantId: tenant.id,
          conversationId
        }
      }),
      this.prisma.client.conversation.update({
        where: {
          id_tenantId: {
            id: conversationId,
            tenantId: tenant.id
          }
        },
        data: {
          status: ConversationStatus.OPEN,
          handoffRequestedAt: null,
          handoffReason: null,
          lastMessageAt: null
        }
      })
    ]);

    return this.getConversationDetail(tenant, conversationId);
  }

  async deleteConversation(tenant: ResolvedTenant, conversationId: string): Promise<void> {
    await this.ensureConversation(tenant.id, conversationId);

    await this.prisma.client.conversation.delete({
      where: {
        id_tenantId: {
          id: conversationId,
          tenantId: tenant.id
        }
      }
    });
  }

  private async loadConversationDetail(
    tenantId: string,
    conversationId: string
  ): Promise<ConversationWithRelations> {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: {
        id_tenantId: {
          id: conversationId,
          tenantId
        }
      },
      include: {
        customer: true,
        assignedUser: true,
        messages: {
          include: {
            authorUser: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }

    return conversation;
  }

  private async loadCustomerConversationDetail(
    tenantId: string,
    conversationId: string,
    visitorId?: string
  ): Promise<ConversationWithRelations> {
    const normalizedVisitorId = visitorId?.trim();

    if (!normalizedVisitorId) {
      throw new BadRequestException("visitorId is required for customer conversation reads.");
    }

    const conversation = await this.prisma.client.conversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
        customer: {
          visitorId: normalizedVisitorId
        }
      },
      include: {
        customer: true,
        assignedUser: true,
        messages: {
          include: {
            authorUser: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found for this tenant and visitor.");
    }

    return conversation;
  }

  private async ensureTenantUser(tenantId: string, userId: string): Promise<void> {
    const membership = await this.prisma.client.role.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId
        }
      }
    });

    if (!membership) {
      throw new BadRequestException("Assigned user is not a member of this tenant.");
    }
  }

  private async ensureConversation(tenantId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.client.conversation.findUnique({
      where: {
        id_tenantId: {
          id: conversationId,
          tenantId
        }
      },
      select: {
        id: true
      }
    });

    if (!conversation) {
      throw new NotFoundException("Conversation not found.");
    }
  }

  private toConversationListItem(conversation: ConversationWithRelations): ConversationListItem {
    return {
      ...toConversationSummary(conversation),
      customer: {
        id: conversation.customer.id,
        visitorId: conversation.customer.visitorId ?? null,
        email: conversation.customer.email ?? null,
        name: conversation.customer.name ?? null
      },
      assignedUser: conversation.assignedUser
        ? {
            id: conversation.assignedUser.id,
            email: conversation.assignedUser.email,
            name: conversation.assignedUser.name,
            roleName: null
          }
        : null,
      handoffRequestedAt: conversation.handoffRequestedAt?.toISOString() ?? null,
      handoffReason: conversation.handoffReason ?? null,
      isHandoffPending: conversation.status === ConversationStatus.PENDING_HUMAN
    };
  }

  private toConversationDetail(conversation: ConversationWithRelations): ConversationDetail {
    return {
      ...this.toConversationListItem(conversation),
      messages: (conversation.messages ?? []).map((message) => toChatMessageRecord(message))
    };
  }
}
