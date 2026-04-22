export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type ConversationChannel = "widget" | "email" | "phone" | "api";
export type MessageAuthorType = "customer" | "assistant" | "agent" | "system";
export type ChatMessageType = "text" | "system_event" | "handoff_event" | "internal_note";

export interface TenantBranding {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  supportEmail?: string;
}

export interface Citation {
  documentId: string;
  title: string;
  url?: string;
  excerpt?: string;
}

export interface WidgetTheme {
  title?: string;
  headerBackground?: string;
}

export interface WidgetBootstrapOptions {
  tenantSlug: string;
  apiBaseUrl: string;
  visitorId?: string;
  theme?: WidgetTheme;
}

export interface ConversationSummary {
  id: string;
  status: string;
  channel: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
}

export interface ChatMessageRecord {
  id: string;
  conversationId: string;
  authorType: MessageAuthorType;
  messageType: ChatMessageType;
  content: string;
  createdAt: string;
  authorUserId?: string | null;
}

export interface SendChatMessageRequest {
  message: string;
  conversationId?: string;
  visitorId?: string;
}

export interface SendChatMessageResponse {
  visitorId: string;
  customerId: string;
  conversation: ConversationSummary;
  customerMessage: ChatMessageRecord;
  assistantMessage: ChatMessageRecord;
  messages: ChatMessageRecord[];
}
