import { Prisma } from "@platform/database";
import type { AdminSearchResponse, AdminSearchResult } from "@platform/types";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { ResolvedTenant } from "../../common/tenant/tenant.types";

@Injectable()
export class SearchService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async search(
    tenant: ResolvedTenant,
    query: string,
    requestedLimit = 6
  ): Promise<AdminSearchResponse> {
    const normalizedQuery = query.trim();
    const limit = Math.min(Math.max(requestedLimit, 1), 10);
    const textFilter = {
      contains: normalizedQuery,
      mode: Prisma.QueryMode.insensitive
    } as const;

    const [conversations, knowledgeBases, knowledgeDocuments] = await Promise.all([
      this.prisma.client.conversation.findMany({
        where: {
          tenantId: tenant.id,
          OR: [
            { id: textFilter },
            { subject: textFilter },
            {
              customer: {
                is: {
                  OR: [
                    { visitorId: textFilter },
                    { externalId: textFilter },
                    { email: textFilter },
                    { name: textFilter }
                  ]
                }
              }
            },
            {
              assignedUser: {
                is: {
                  OR: [{ email: textFilter }, { name: textFilter }]
                }
              }
            },
            { messages: { some: { content: textFilter } } }
          ]
        },
        include: {
          customer: true,
          assignedUser: true,
          messages: {
            where: { content: textFilter },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { content: true }
          }
        },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
        take: limit
      }),
      this.prisma.client.knowledgeBase.findMany({
        where: {
          tenantId: tenant.id,
          OR: [{ name: textFilter }, { slug: textFilter }, { description: textFilter }]
        },
        include: {
          _count: {
            select: { documents: true }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: limit
      }),
      this.prisma.client.knowledgeDocument.findMany({
        where: {
          tenantId: tenant.id,
          OR: [
            { title: textFilter },
            { sourceUri: textFilter },
            { content: textFilter },
            { knowledgeBase: { is: { name: textFilter } } },
            { chunks: { some: { content: textFilter } } }
          ]
        },
        include: {
          knowledgeBase: {
            select: { id: true, name: true }
          },
          chunks: {
            where: { content: textFilter },
            orderBy: { chunkIndex: "asc" },
            take: 1,
            select: { content: true }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: limit
      })
    ]);

    const results: AdminSearchResult[] = [
      ...conversations.map((conversation) => ({
        id: `conversation:${conversation.id}`,
        kind: "conversation" as const,
        title:
          conversation.subject?.trim() ||
          conversation.customer.name?.trim() ||
          conversation.customer.email?.trim() ||
          `Conversation ${conversation.id.slice(0, 8)}`,
        subtitle: [
          formatStatus(conversation.status),
          conversation.customer.visitorId || conversation.channel,
          conversation.assignedUser?.name || conversation.assignedUser?.email
        ]
          .filter(Boolean)
          .join(" · "),
        description: toSafePreview(conversation.messages[0]?.content || conversation.subject),
        status: conversation.status.toLowerCase(),
        conversationId: conversation.id
      })),
      ...knowledgeBases.map((knowledgeBase) => ({
        id: `knowledge_base:${knowledgeBase.id}`,
        kind: "knowledge_base" as const,
        title: knowledgeBase.name,
        subtitle: `Knowledge base · ${knowledgeBase._count.documents} document${knowledgeBase._count.documents === 1 ? "" : "s"}`,
        description: toSafePreview(knowledgeBase.description),
        knowledgeBaseId: knowledgeBase.id
      })),
      ...knowledgeDocuments.map((document) => ({
        id: `knowledge_document:${document.id}`,
        kind: "knowledge_document" as const,
        title: document.title,
        subtitle: `${document.knowledgeBase.name} · ${formatStatus(document.status)}`,
        description: toSafePreview(
          document.chunks[0]?.content || document.content || document.sourceUri
        ),
        status: document.status.toLowerCase(),
        knowledgeBaseId: document.knowledgeBaseId,
        documentId: document.id
      }))
    ];

    return {
      query: normalizedQuery,
      results
    };
  }
}

function formatStatus(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toSafePreview(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}
