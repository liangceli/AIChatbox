import type {
  Conversation,
  ConversationChannel,
  ConversationStatus,
  Message,
  MessageAuthor,
  MessageType
} from "@platform/database";
import type { ChatMessageRecord, ConversationSummary } from "@platform/types";

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

export function toChatMessageRecord(message: Message): ChatMessageRecord {
  return {
    id: message.id,
    conversationId: message.conversationId,
    authorType: mapAuthorType(message.authorType),
    messageType: mapMessageType(message.messageType),
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    authorUserId: message.authorUserId ?? null
  };
}
