import type {
  Conversation,
  ConversationChannel,
  ConversationStatus,
  Message,
  MessageAuthor,
  MessageType
} from "@platform/database";
import type { ChatMessageRecord, Citation, ConversationSummary } from "@platform/types";

function mapAuthorType(authorType: MessageAuthor): ChatMessageRecord["authorType"] {
  return authorType.toLowerCase() as ChatMessageRecord["authorType"];
}

function mapMessageType(messageType: MessageType): ChatMessageRecord["messageType"] {
  return messageType.toLowerCase() as ChatMessageRecord["messageType"];
}

function mapChannel(channel: ConversationChannel): ConversationSummary["channel"] {
  return channel.toLowerCase();
}

function mapStatus(status: ConversationStatus): ConversationSummary["status"] {
  return status.toLowerCase();
}

function mapCitations(citations: Message["citations"]): Citation[] | null {
  if (!Array.isArray(citations)) {
    return null;
  }

  const mapped = citations.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }

    const citation = value as Record<string, unknown>;

    if (
      typeof citation.knowledgeDocumentId !== "string" ||
      typeof citation.chunkId !== "string" ||
      typeof citation.title !== "string" ||
      typeof citation.chunkIndex !== "number"
    ) {
      return [];
    }

    return [
      {
        knowledgeDocumentId: citation.knowledgeDocumentId,
        chunkId: citation.chunkId,
        title: citation.title,
        chunkIndex: citation.chunkIndex,
        sourceUri: typeof citation.sourceUri === "string" ? citation.sourceUri : null,
        excerpt: typeof citation.excerpt === "string" ? citation.excerpt : undefined
      }
    ];
  });

  return mapped.length > 0 ? mapped : null;
}

export function toConversationSummary(conversation: Conversation): ConversationSummary {
  return {
    id: conversation.id,
    status: mapStatus(conversation.status),
    channel: mapChannel(conversation.channel),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null
  };
}

type MessageWithOptionalAuthor = Message & {
  authorUser?: {
    name: string | null;
  } | null;
};

export function toChatMessageRecord(message: MessageWithOptionalAuthor): ChatMessageRecord {
  return {
    id: message.id,
    conversationId: message.conversationId,
    authorType: mapAuthorType(message.authorType),
    messageType: mapMessageType(message.messageType),
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    authorUserId: message.authorUserId ?? null,
    authorName: message.authorUser?.name ?? null,
    citations: mapCitations(message.citations)
  };
}
