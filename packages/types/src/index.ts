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
  ownerCount: number;
  agentCount: number;
  suspendedMemberCount: number;
  activeAgentInvitationCount: number;
  agentInvitationQuota: number;
  createdAt: string;
  updatedAt: string;
}

export type TenantMemberRole = "owner" | "agent";
export type TenantMembershipStatus = "active" | "suspended" | "revoked";

export interface AccountMembershipRecord {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: TenantMemberRole;
  status: TenantMembershipStatus;
  conversationCount: number;
  pendingHumanCount: number;
  knowledgeBaseCount: number;
}

export interface AccountRecord {
  mapped: boolean;
  userId?: string;
  email?: string;
  name?: string | null;
  avatarUrl?: string | null;
  isPlatformAdmin: boolean;
  memberships: AccountMembershipRecord[];
  defaultRoute: "/admin" | "/agent" | "/access-pending";
}

export interface TenantMemberRecord {
  userId: string;
  email: string;
  name?: string | null;
  role: TenantMemberRole;
  status: TenantMembershipStatus;
}

export interface TenantInvitationRecord {
  id: string;
  email: string;
  role: TenantMemberRole;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface CreatedTenantInvitation extends TenantInvitationRecord {
  token: string;
}

export interface TenantInvitationPolicyRecord {
  agentInvitationQuota: number;
  activeAgentInvitationCount: number;
  agentInvitationExpiresInHours: 12;
}

export interface TenantAiProfile {
  assistantName: string;
  companyDisplayName: string;
  businessType: string;
  tone: string;
  welcomeMessage: string;
  fallbackMessage: string;
  handoffMessage: string;
  safeAnswerInstructions: string;
  sensitiveTopicInstructions: string;
  doNotAnswerInstructions: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  avatarUrl?: string | null;
}

export type UpdateTenantAiProfileRequest = Partial<TenantAiProfile>;

export interface PublicTenantAiProfile {
  assistantName: string;
  companyDisplayName: string;
  welcomeMessage: string;
  fallbackMessage: string;
  handoffMessage: string;
  primaryColor?: string | null;
  logoUrl?: string | null;
  avatarUrl?: string | null;
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

export interface KnowledgeStructuredMetadata {
  productSeries?: string;
  productName?: string;
  modelNumber?: string;
  deviceType?: string;
  documentType?: string;
  language?: string;
  version?: string;
  sectionTitle?: string;
  pageNumber?: number;
  aliases?: string[];
  intentHints?: string[];
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
  checksum?: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
  ingestedAt?: string | null;
  knowledgeMetadata?: KnowledgeStructuredMetadata | null;
}

export interface KnowledgeChunkRecord {
  id: string;
  knowledgeDocumentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number | null;
  sourceLocator?: unknown;
  knowledgeMetadata?: KnowledgeStructuredMetadata | null;
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

export type AdminSearchResultKind = "conversation" | "knowledge_base" | "knowledge_document";

export interface AdminSearchResult {
  id: string;
  kind: AdminSearchResultKind;
  title: string;
  subtitle: string;
  description?: string;
  status?: string;
  conversationId?: string;
  knowledgeBaseId?: string;
  documentId?: string;
}

export interface AdminSearchResponse {
  query: string;
  results: AdminSearchResult[];
}

export interface SendChatMessageRequest {
  message: string;
  clientMessageId: string;
  conversationId?: string;
  visitorId?: string;
}

export interface SendChatMessageResponse {
  visitorId: string;
  customerId: string;
  conversation: ConversationSummary;
  customerMessage: ChatMessageRecord;
  assistantMessage?: ChatMessageRecord | null;
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

export interface KnowledgeTableExtractionSummary {
  format: "csv" | "xlsx";
  sheetCount: number;
  recordCount: number;
  qaRecordCount: number;
  structuredRecordCount: number;
  warnings: string[];
}

export interface ImportKnowledgeFileResult {
  document: KnowledgeDocumentRecord;
  extraction: KnowledgeTableExtractionSummary;
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

export interface AnswerDebugRequest {
  question: string;
}

export interface AnswerDebugProviderMetadata {
  providerName: string;
  mode: string;
  deterministic: boolean;
  usedFallback: boolean;
  model?: string;
  fallbackReason?: string;
  latencyMs?: number;
  responseId?: string;
}

export interface AnswerDebugRetrievedChunk {
  knowledgeDocumentId: string;
  chunkId: string;
  title: string;
  chunkIndex: number;
  sourceUri?: string | null;
  relevanceScore?: number;
  knowledgeMetadata?: KnowledgeStructuredMetadata | null;
  contentPreview: string;
}

export interface AnswerDebugCitation {
  knowledgeDocumentId: string;
  chunkId: string;
  title: string;
  chunkIndex: number;
  sourceUri?: string | null;
  relevanceScore?: number;
  excerpt?: string;
}

export interface HybridRetrievalDebugScore {
  chunkId: string;
  keywordScore: number;
  vectorScore: number;
  metadataScore: number;
  exactMatchBoost: number;
  finalScore: number;
  reasons: string[];
}

export interface HybridRetrievalDebug {
  retrievalMode: "HYBRID";
  originalQuestion: string;
  effectiveQuestion: string;
  intent?: string;
  usedPendingClarification: boolean;
  usedProductContext: boolean;
  keywordTopK: number;
  vectorTopK: number;
  finalTopK: number;
  keywordCandidateChunkIds: string[];
  vectorCandidateChunkIds: string[];
  mergedCandidateChunkIds: string[];
  selectedChunkIds: string[];
  scores: HybridRetrievalDebugScore[];
  confidence: number;
  noKnowledgeEvidence: boolean;
  retrievalSkipped: boolean;
  skipReason?: "conversational_turn";
  ambiguity: {
    detected: boolean;
    candidateProductNames: string[];
  };
}

export interface AnswerDebugResult {
  tenant: {
    slug: string;
    displayName: string;
  };
  question: string;
  answer: string;
  answerSource:
    | "conversation"
    | "knowledge_hit"
    | "knowledge_miss"
    | "clarification"
    | "provider_fallback"
    | "retrieval_hit_without_citations";
  knowledge: {
    outcome: "hit" | "miss" | "clarification" | "skipped";
    retrievalConfidence: "strong" | "weak" | "none";
    reason: string;
    retrievedChunkCount: number;
    citationCount: number;
    sourceDiversity: number;
    warnings: string[];
    detection?: {
      intent?: string;
      productContext?: KnowledgeStructuredMetadata | null;
      confidenceReason?: string;
      confidenceBestScore?: number;
      confidenceBestCoverage?: number;
      clarificationOptions?: string[];
      turnType?: string;
      retrievalSkipped?: boolean;
      skipReason?: "conversational_turn";
    };
    ambiguity?: {
      isAmbiguous: boolean;
      intent?: string;
      productContext?: KnowledgeStructuredMetadata | null;
      clarificationQuestion?: string;
      options?: string[];
    };
    retrieval?: HybridRetrievalDebug;
  };
  provider: {
    requestedMode: string;
    usedMode: string;
    usedFallback: boolean;
    metadata: AnswerDebugProviderMetadata;
  };
  retrievedChunks: AnswerDebugRetrievedChunk[];
  citations: AnswerDebugCitation[];
}

export interface RequestConversationHandoffRequest {
  visitorId?: string;
  reason?: string;
}

export interface UpdateHumanSupportRequest {
  userId?: string;
  reason?: string;
}

export interface AssignConversationRequest {
  userId: string;
}

export interface SendAgentReplyRequest {
  userId: string;
  message: string;
}
