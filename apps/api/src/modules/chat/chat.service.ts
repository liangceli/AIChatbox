import {
  ConversationChannel,
  ConversationStatus,
  MessageAuthor,
  MessageType,
  Prisma
} from "@platform/database";
import type { SendChatMessageResponse } from "@platform/types";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { KnowledgeRetrievalService } from "../knowledge/knowledge-retrieval.service";
import type { SendChatMessageDto } from "./dto/send-chat-message.dto";
import { toChatMessageRecord, toConversationSummary } from "./chat.presenter";
import { LlmProviderResolverService } from "./llm-provider-resolver.service";

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KnowledgeRetrievalService)
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
    @Inject(LlmProviderResolverService)
    private readonly llmProviderResolver: LlmProviderResolverService
  ) {}

  async sendMessage(tenant: ResolvedTenant, input: SendChatMessageDto): Promise<SendChatMessageResponse> {
    const normalizedMessage = input.message.trim();

    if (!normalizedMessage) {
      throw new BadRequestException("Message content cannot be empty.");
    }

    const retrievedChunks = await this.knowledgeRetrievalService.retrieveRelevantChunks(
      tenant,
      normalizedMessage
    );

    return this.prisma.client.$transaction(async (tx) => {
      const visitorId = input.visitorId?.trim() || randomUUID();
      const customer = await tx.customer.upsert({
        where: {
          tenantId_visitorId: {
            tenantId: tenant.id,
            visitorId
          }
        },
        update: {
          visitorId,
          metadata: {
            visitorId,
            anonymous: true
          }
        },
        create: {
          tenantId: tenant.id,
          visitorId,
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

      if (existingConversation?.status === ConversationStatus.PENDING_HUMAN) {
        throw new BadRequestException(
          "This conversation is waiting for a human agent. Refresh the conversation for updates."
        );
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

      const llmProvider = this.llmProviderResolver.resolveProvider();
      const assistantReply = await llmProvider.generateReply({
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name
        },
        conversation: {
          id: conversation.id
        },
        agent: {
          displayName: agentConfig?.displayName ?? `${tenant.name} Assistant`,
          welcomeMessage: agentConfig?.welcomeMessage,
          fallbackMessage: agentConfig?.fallbackMessage,
          handoffEnabled: agentConfig?.handoffEnabled ?? false
        },
        latestCustomerMessage: customerMessage.content,
        retrievedChunks
      });

      const assistantMessage = await tx.message.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          authorType: MessageAuthor.ASSISTANT,
          messageType: MessageType.TEXT,
          content: assistantReply.content,
          citations: assistantReply.citations
            ? (assistantReply.citations as unknown as Prisma.InputJsonValue)
            : undefined,
          metadata: {
            retrieval: {
              usedFallback: assistantReply.metadata.usedFallback,
              retrievedChunkCount: retrievedChunks.length,
              chunkIds: retrievedChunks.map((chunk) => chunk.chunkId)
            },
            provider: {
              name: assistantReply.metadata.providerName,
              mode: assistantReply.metadata.mode,
              deterministic: assistantReply.metadata.deterministic,
              model: assistantReply.metadata.model,
              fallbackReason: assistantReply.metadata.fallbackReason,
              latencyMs: assistantReply.metadata.latencyMs,
              responseId: assistantReply.metadata.responseId
            }
          }
        }
      });

      this.logger.debug(
        `Assistant reply for tenant ${tenant.slug} conversation ${conversation.id}: provider=${assistantReply.metadata.providerName}, fallback=${assistantReply.metadata.usedFallback}, chunks=${retrievedChunks.length}`
      );

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
