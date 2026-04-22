import {
  ConversationChannel,
  ConversationStatus,
  MessageAuthor,
  MessageType
} from "@platform/database";
import type { SendChatMessageResponse } from "@platform/types";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import type { SendChatMessageDto } from "./dto/send-chat-message.dto";
import { toChatMessageRecord, toConversationSummary } from "./chat.presenter";
import { AssistantReplyService } from "./assistant-reply.service";

@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AssistantReplyService)
    private readonly assistantReplyService: AssistantReplyService
  ) {}

  async sendMessage(tenant: ResolvedTenant, input: SendChatMessageDto): Promise<SendChatMessageResponse> {
    const normalizedMessage = input.message.trim();

    if (!normalizedMessage) {
      throw new BadRequestException("Message content cannot be empty.");
    }

    return this.prisma.client.$transaction(async (tx) => {
      const visitorId = input.visitorId?.trim() || randomUUID();
      const customer = await tx.customer.upsert({
        where: {
          tenantId_externalId: {
            tenantId: tenant.id,
            externalId: visitorId
          }
        },
        update: {
          metadata: {
            visitorId,
            anonymous: true
          }
        },
        create: {
          tenantId: tenant.id,
          externalId: visitorId,
          metadata: {
            visitorId,
            anonymous: true
          }
        }
      });

      const existingConversation = input.conversationId
        ? await tx.conversation.findFirst({
            where: {
              id: input.conversationId,
              tenantId: tenant.id,
              customerId: customer.id
            }
          })
        : null;

      if (input.conversationId && !existingConversation) {
        throw new NotFoundException("Conversation not found for this tenant and visitor.");
      }

      const conversation =
        existingConversation ??
        (await tx.conversation.create({
          data: {
            tenantId: tenant.id,
            customerId: customer.id,
            channel: ConversationChannel.WIDGET,
            status: ConversationStatus.OPEN,
            lastMessageAt: new Date()
          }
        }));

      const customerMessage = await tx.message.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          authorType: MessageAuthor.CUSTOMER,
          messageType: MessageType.TEXT,
          content: normalizedMessage
        }
      });

      const agentConfig = await tx.agentConfig.findUnique({
        where: {
          tenantId: tenant.id
        }
      });

      const assistantReply = this.assistantReplyService.generateReply({
        displayName: agentConfig?.displayName ?? `${tenant.name} Assistant`,
        welcomeMessage: agentConfig?.welcomeMessage,
        fallbackMessage: agentConfig?.fallbackMessage,
        userMessage: customerMessage.content
      });

      const assistantMessage = await tx.message.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          authorType: MessageAuthor.ASSISTANT,
          messageType: MessageType.TEXT,
          content: assistantReply
        }
      });

      const updatedConversation = await tx.conversation.update({
        where: {
          id_tenantId: {
            id: conversation.id,
            tenantId: tenant.id
          }
        },
        data: {
          status: ConversationStatus.AWAITING_CUSTOMER,
          lastMessageAt: assistantMessage.createdAt
        }
      });

      const messages = await tx.message.findMany({
        where: {
          tenantId: tenant.id,
          conversationId: conversation.id
        },
        orderBy: {
          createdAt: "asc"
        }
      });

      return {
        visitorId,
        customerId: customer.id,
        conversation: toConversationSummary(updatedConversation),
        customerMessage: toChatMessageRecord(customerMessage),
        assistantMessage: toChatMessageRecord(assistantMessage),
        messages: messages.map(toChatMessageRecord)
      };
    });
  }
}
