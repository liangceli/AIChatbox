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

export interface TenantOverviewRecord {
  id: string;
  slug: string;
  name: string;
  status: string;
  conversationCount: number;
  pendingHumanCount: number;
  knowledgeBaseCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  supportEmail?: string;
  defaultLocale?: string;
}

export interface Citation {
  knowledgeDocumentId: string;
  chunkId: string;
  title: string;
  chunkIndex: number;
  sourceUri?: string | null;
  sourceLocator?: unknown;
  relevanceScore?: number;
  excerpt?: string;
}

export interface KnowledgeBaseRecord {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocumentRecord {
  id: string;
  knowledgeBaseId: string;
  title: string;
  status: string;
  sourceType: string;
  sourceUri?: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  ingestedAt?: string | null;
}

export interface KnowledgeChunkRecord {
  id: string;
  knowledgeDocumentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number | null;
  sourceLocator?: unknown;
  createdAt: string;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocumentRecord {
  metadata?: unknown;
  chunks: KnowledgeChunkRecord[];
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
  authorName?: string | null;
  citations?: Citation[] | null;
}

export interface ConversationCustomerRecord {
  id: string;
  visitorId?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface SupportUserRecord {
  id: string;
  email: string;
  name?: string | null;
  roleName?: string | null;
}

export interface ConversationListItem extends ConversationSummary {
  customer: ConversationCustomerRecord;
  assignedUser?: SupportUserRecord | null;
  handoffRequestedAt?: string | null;
  handoffReason?: string | null;
  isHandoffPending: boolean;
}

export interface ConversationDetail extends ConversationListItem {
  messages: ChatMessageRecord[];
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

export interface CreateKnowledgeBaseRequest {
  name: string;
  slug?: string;
  description?: string;
}

export interface CreateKnowledgeDocumentRequest {
  title: string;
  content: string;
  sourceType?: "manual" | "file" | "url" | "integration";
  sourceUri?: string;
  metadata?: JsonObject;
}

export interface ImportUrlKnowledgeDocumentRequest {
  url: string;
  title?: string;
}

export interface ImportUrlsKnowledgeDocumentRequest {
  urls: string[];
}

export interface ImportUrlKnowledgeDocumentResult {
  url: string;
  status: "ready" | "failed";
  document?: KnowledgeDocumentRecord;
  error?: string;
}

export interface ReprocessKnowledgeDocumentRequest {
  content?: string;
}

export interface RequestConversationHandoffRequest {
  visitorId?: string;
  reason?: string;
}

export interface AssignConversationRequest {
  userId: string;
}

export interface SendAgentReplyRequest {
  userId: string;
  message: string;
}
