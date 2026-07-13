import {
  ConversationChannel,
  ConversationStatus,
  MessageAuthor,
  MessageType,
  Prisma
} from "@platform/database";
import type { KnowledgeStructuredMetadata, SendChatMessageResponse } from "@platform/types";
import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";
import { ConversationStateService } from "../knowledge/conversation-state.service";
import { KnowledgeRetrievalService } from "../knowledge/knowledge-retrieval.service";
import { isHumanSupportActive } from "../conversations/conversation-status";
import { buildTenantAiProfile } from "../tenants/tenant-ai-profile";
import type { SendChatMessageDto } from "./dto/send-chat-message.dto";
import { toChatMessageRecord, toConversationSummary } from "./chat.presenter";
import { LlmProviderResolverService } from "./llm-provider-resolver.service";
import { AssistantReplyService } from "./assistant-reply.service";

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(KnowledgeRetrievalService)
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
    @Inject(LlmProviderResolverService)
    private readonly llmProviderResolver: LlmProviderResolverService,
    @Inject(AssistantReplyService)
    private readonly safeReplyProvider: AssistantReplyService,
    @Optional()
    @Inject(ConversationStateService)
    private readonly conversationStateService?: ConversationStateService
  ) {}

  async sendMessage(tenant: ResolvedTenant, input: SendChatMessageDto): Promise<SendChatMessageResponse> {
    const normalizedMessage = input.message.trim();

    if (!normalizedMessage) {
      throw new BadRequestException("Message content cannot be empty.");
    }

    const visitorId = input.visitorId?.trim() || randomUUID();
    const preparedMessage = await this.prisma.client.$transaction(async (tx) => {
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
      const buildDuplicateResponse = async (
        duplicateMessage: Prisma.MessageGetPayload<object>,
        duplicateConversation: Prisma.ConversationGetPayload<object>
      ) => {
        const messages = await tx.message.findMany({
          where: {
            tenantId: tenant.id,
            conversationId: duplicateConversation.id
          },
          orderBy: {
            createdAt: "asc"
          }
        });
        const assistantMessage = messages.find(
          (message) =>
            message.authorType === MessageAuthor.ASSISTANT &&
            message.createdAt >= duplicateMessage.createdAt
        );

        return {
          readyForReply: false as const,
          response: {
            visitorId,
            customerId: customer.id,
            conversation: toConversationSummary(duplicateConversation),
            customerMessage: toChatMessageRecord(duplicateMessage),
            assistantMessage: assistantMessage ? toChatMessageRecord(assistantMessage) : null,
            messages: messages.map(toChatMessageRecord)
          }
        };
      };

      if (input.clientMessageId) {
        const duplicateMessage = await tx.message.findFirst({
          where: {
            tenantId: tenant.id,
            clientMessageId: input.clientMessageId,
            authorType: MessageAuthor.CUSTOMER
          }
        });

        if (duplicateMessage) {
          const duplicateConversation = await tx.conversation.findFirst({
            where: {
              id: duplicateMessage.conversationId,
              tenantId: tenant.id,
              customerId: customer.id
            }
          });

          if (!duplicateConversation) {
            throw new NotFoundException("Idempotent message does not belong to this visitor.");
          }

          return buildDuplicateResponse(duplicateMessage, duplicateConversation);
        }
      }

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

      const customerMessage = input.clientMessageId
        ? await (async () => {
            const creation = await tx.message.createMany({
              data: {
                tenantId: tenant.id,
                conversationId: conversation.id,
                authorType: MessageAuthor.CUSTOMER,
                messageType: MessageType.TEXT,
                clientMessageId: input.clientMessageId,
                content: normalizedMessage
              },
              skipDuplicates: true
            });
            const message = await tx.message.findFirst({
              where: {
                tenantId: tenant.id,
                clientMessageId: input.clientMessageId,
                authorType: MessageAuthor.CUSTOMER
              }
            });

            if (!message) {
              throw new NotFoundException("Idempotent customer message could not be loaded.");
            }

            if (creation.count === 0) {
              const duplicateConversation = await tx.conversation.findFirst({
                where: {
                  id: message.conversationId,
                  tenantId: tenant.id,
                  customerId: customer.id
                }
              });

              if (!duplicateConversation) {
                throw new NotFoundException("Idempotent message does not belong to this visitor.");
              }

              return buildDuplicateResponse(message, duplicateConversation);
            }

            return message;
          })()
        : await tx.message.create({
            data: {
              tenantId: tenant.id,
              conversationId: conversation.id,
              authorType: MessageAuthor.CUSTOMER,
              messageType: MessageType.TEXT,
              content: normalizedMessage
            }
          });

      if ("readyForReply" in customerMessage) {
        return customerMessage;
      }

      // Handoff or an agent reply can change the status while a customer send is in flight.
      const latestConversation = await tx.conversation.findUnique({
        where: {
          id_tenantId: {
            id: conversation.id,
            tenantId: tenant.id
          }
        }
      });

      if (!latestConversation) {
        throw new NotFoundException("Conversation not found for this tenant and visitor.");
      }

      if (isHumanSupportActive(latestConversation.status)) {
        const updatedConversation = await tx.conversation.update({
          where: {
            id_tenantId: {
              id: conversation.id,
              tenantId: tenant.id
            }
          },
          data: {
            status: latestConversation.status,
            lastMessageAt: customerMessage.createdAt
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
          readyForReply: false as const,
          response: {
            visitorId,
            customerId: customer.id,
            conversation: toConversationSummary(updatedConversation),
            customerMessage: toChatMessageRecord(customerMessage),
            assistantMessage: null,
            messages: messages.map(toChatMessageRecord)
          }
        };
      }

      const agentConfig = await tx.agentConfig.findUnique({
        where: {
          tenantId: tenant.id
        }
      });
      const recentMessages = await tx.message.findMany({
        where: {
          tenantId: tenant.id,
          conversationId: conversation.id
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 9
      });

      return {
        readyForReply: true as const,
        visitorId,
        customerId: customer.id,
        conversationId: conversation.id,
        conversationMetadata: latestConversation.metadata,
        customerMessage,
        agentConfig,
        recentTurns: recentMessages
          .filter((message) => message.id !== customerMessage.id)
          .reverse()
          .slice(-8)
          .map((message) => ({
            author: message.authorType.toLowerCase() as "customer" | "assistant" | "agent" | "system",
            content: message.content,
            createdAt: message.createdAt.toISOString()
          }))
      };
    });

    if (!preparedMessage.readyForReply) {
      return preparedMessage.response;
    }

    const tenantAiProfile = buildTenantAiProfile(tenant, preparedMessage.agentConfig);
    const retrievalContext = this.conversationStateService
      ? await this.conversationStateService.buildRetrievalContext(
          tenant.id,
          preparedMessage.conversationId,
          preparedMessage.conversationMetadata
        )
      : preparedMessage.conversationMetadata;
    const retrievalDecision = await this.knowledgeRetrievalService.resolveRetrievalDecision(
      tenant,
      normalizedMessage,
      retrievalContext
    );

    if (retrievalDecision.mode === "clarification") {
      return this.prisma.client.$transaction(async (tx) => {
        const currentConversation = await tx.conversation.findUnique({
          where: {
            id_tenantId: {
              id: preparedMessage.conversationId,
              tenantId: tenant.id
            }
          }
        });

        if (!currentConversation) {
          throw new NotFoundException("Conversation not found for this tenant and visitor.");
        }

        if (isHumanSupportActive(currentConversation.status)) {
          const messages = await tx.message.findMany({
            where: {
              tenantId: tenant.id,
              conversationId: preparedMessage.conversationId
            },
            orderBy: {
              createdAt: "asc"
            }
          });

          return {
            visitorId,
            customerId: preparedMessage.customerId,
            conversation: toConversationSummary(currentConversation),
            customerMessage: toChatMessageRecord(preparedMessage.customerMessage),
            assistantMessage: null,
            messages: messages.map(toChatMessageRecord)
          };
        }

        const assistantMessage = await tx.message.create({
          data: {
            tenantId: tenant.id,
            conversationId: preparedMessage.conversationId,
            authorType: MessageAuthor.ASSISTANT,
            messageType: MessageType.TEXT,
            content:
              retrievalDecision.ambiguity.clarificationQuestion ??
              "Which product are you asking about?",
            metadata: {
              retrieval: {
                mode: "clarification",
                intent: retrievalDecision.intent,
                options: retrievalDecision.ambiguity.options,
                confidence: retrievalDecision.confidence,
                warnings: retrievalDecision.warnings
              }
            } as unknown as Prisma.InputJsonValue
          }
        });

        const nextMetadata = this.conversationStateService
          ? await this.conversationStateService.persistRetrievalState(
              tx,
              tenant.id,
              preparedMessage.conversationId,
              currentConversation.metadata,
              {
                productContext: retrievalDecision.productContext ?? null,
                pendingClarification: retrievalDecision.pendingClarification ?? null,
                confidence: retrievalDecision.confidence,
                entitySource: retrievalDecision.turnType === "clarification_reply" ? "clarification" : "retrieval"
              }
            )
          : mergeConversationRagMetadata(currentConversation.metadata, {
              productContext: retrievalDecision.productContext ?? null,
              pendingClarification: retrievalDecision.pendingClarification ?? null
            });

        const updatedConversation = await tx.conversation.update({
          where: {
            id_tenantId: {
              id: preparedMessage.conversationId,
              tenantId: tenant.id
            }
          },
          data: {
            status: ConversationStatus.AWAITING_CUSTOMER,
            lastMessageAt: assistantMessage.createdAt,
            metadata: nextMetadata as Prisma.InputJsonValue
          }
        });

        const messages = await tx.message.findMany({
          where: {
            tenantId: tenant.id,
            conversationId: preparedMessage.conversationId
          },
          orderBy: {
            createdAt: "asc"
          }
        });

        return {
          visitorId,
          customerId: preparedMessage.customerId,
          conversation: toConversationSummary(updatedConversation),
          customerMessage: toChatMessageRecord(preparedMessage.customerMessage),
          assistantMessage: toChatMessageRecord(assistantMessage),
          messages: messages.map(toChatMessageRecord)
        };
      });
    }

    const retrievedChunks = retrievalDecision.retrievedChunks;

    const noKnowledgeEvidence = retrievedChunks.length === 0;
    const llmProvider = noKnowledgeEvidence
      ? this.safeReplyProvider
      : this.llmProviderResolver.resolveProvider();
    const assistantReply = await llmProvider.generateReply({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name
      },
      conversation: {
        id: preparedMessage.conversationId,
        recentTurns: preparedMessage.recentTurns
      },
      agent: {
        displayName: tenantAiProfile.assistantName,
        welcomeMessage: tenantAiProfile.welcomeMessage,
        fallbackMessage: tenantAiProfile.fallbackMessage,
        handoffMessage: tenantAiProfile.handoffMessage,
        handoffEnabled: preparedMessage.agentConfig?.handoffEnabled ?? false,
        tenantAiProfile
      },
      latestCustomerMessage: retrievalDecision.effectiveQuestion,
      retrievedChunks,
      noKnowledgeEvidence,
      turnType: retrievalDecision.turnType
    });

    return this.prisma.client.$transaction(async (tx) => {
      // Human support may start while the provider is generating a reply.
      const conversationAfterProvider = await tx.conversation.findUnique({
        where: {
          id_tenantId: {
            id: preparedMessage.conversationId,
            tenantId: tenant.id
          }
        }
      });

      if (!conversationAfterProvider) {
        throw new NotFoundException("Conversation not found for this tenant and visitor.");
      }

      if (isHumanSupportActive(conversationAfterProvider.status)) {
        const messages = await tx.message.findMany({
          where: {
            tenantId: tenant.id,
            conversationId: preparedMessage.conversationId
          },
          orderBy: {
            createdAt: "asc"
          }
        });

        return {
          visitorId,
          customerId: preparedMessage.customerId,
          conversation: toConversationSummary(conversationAfterProvider),
          customerMessage: toChatMessageRecord(preparedMessage.customerMessage),
          assistantMessage: null,
          messages: messages.map(toChatMessageRecord)
        };
      }

      const assistantMessage = await tx.message.create({
        data: {
          tenantId: tenant.id,
          conversationId: preparedMessage.conversationId,
          authorType: MessageAuthor.ASSISTANT,
          messageType: MessageType.TEXT,
          content: assistantReply.content,
          citations: assistantReply.citations
            ? (assistantReply.citations as unknown as Prisma.InputJsonValue)
            : undefined,
          metadata: {
            retrieval: {
              mode: retrievalDecision.mode,
              intent: retrievalDecision.intent,
              productContext: retrievalDecision.productContext,
              effectiveQuestion: retrievalDecision.effectiveQuestion,
              usedFallback: assistantReply.metadata.usedFallback,
              retrievedChunkCount: retrievedChunks.length,
              chunkIds: retrievedChunks.map((chunk) => chunk.chunkId),
              confidence: retrievalDecision.confidence,
              warnings: retrievalDecision.warnings,
              turnType: retrievalDecision.turnType,
              noKnowledgeEvidence,
              hybrid: retrievalDecision.retrievalMetadata
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
          } as unknown as Prisma.InputJsonValue
        }
      });

      this.logger.debug(
        `Assistant reply for tenant ${tenant.slug} conversation ${preparedMessage.conversationId}: provider=${assistantReply.metadata.providerName}, fallback=${assistantReply.metadata.usedFallback}, chunks=${retrievedChunks.length}`
      );

      const nextMetadata = this.conversationStateService
        ? await this.conversationStateService.persistRetrievalState(
            tx,
            tenant.id,
            preparedMessage.conversationId,
            conversationAfterProvider.metadata,
            {
              productContext: retrievalDecision.productContext ?? null,
              pendingClarification: retrievalDecision.pendingClarification ?? null,
              confidence: retrievalDecision.confidence,
              entitySource: retrievalDecision.turnType === "clarification_reply" ? "clarification" : "retrieval"
            }
          )
        : mergeConversationRagMetadata(conversationAfterProvider.metadata, {
            productContext: retrievalDecision.productContext ?? null,
            pendingClarification: retrievalDecision.pendingClarification ?? null
          });

      const updatedConversation = await tx.conversation.update({
        where: {
          id_tenantId: {
            id: preparedMessage.conversationId,
            tenantId: tenant.id
          }
        },
        data: {
          status: ConversationStatus.AWAITING_CUSTOMER,
          lastMessageAt: assistantMessage.createdAt,
          metadata: nextMetadata as Prisma.InputJsonValue
        }
      });

      const messages = await tx.message.findMany({
        where: {
          tenantId: tenant.id,
          conversationId: preparedMessage.conversationId
        },
        orderBy: {
          createdAt: "asc"
        }
      });

      return {
        visitorId,
        customerId: preparedMessage.customerId,
        conversation: toConversationSummary(updatedConversation),
        customerMessage: toChatMessageRecord(preparedMessage.customerMessage),
        assistantMessage: toChatMessageRecord(assistantMessage),
        messages: messages.map(toChatMessageRecord)
      };
    });
  }
}

function mergeConversationRagMetadata(
  metadata: unknown,
  updates: {
    productContext?: KnowledgeStructuredMetadata | null;
    pendingClarification?: unknown | null;
  }
): Record<string, unknown> {
  const base = isPlainObject(metadata) ? { ...metadata } : {};
  const rag = isPlainObject(base.rag) ? { ...base.rag } : {};

  if (Object.prototype.hasOwnProperty.call(updates, "productContext")) {
    if (updates.productContext) {
      rag.productContext = updates.productContext;
    } else {
      delete rag.productContext;
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, "pendingClarification")) {
    if (updates.pendingClarification) {
      rag.pendingClarification = updates.pendingClarification;
    } else {
      delete rag.pendingClarification;
    }
  }

  if (Object.keys(rag).length > 0) {
    base.rag = rag;
  } else {
    delete base.rag;
  }

  return base;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
