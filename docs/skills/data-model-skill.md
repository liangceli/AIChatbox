# Data Model Skill

## 2026-07-13 Knowledge Chunk Index Repair

- Migration `20260713000000_fix_knowledge_chunk_version_index` removes the original unique index on `(tenantId, knowledgeDocumentId, chunkIndex)`.
- The authoritative unique key is `(tenantId, knowledgeDocumentId, version, chunkIndex)` so old INACTIVE and current READY generations can coexist.
- Do not edit already-applied migration history to repair this invariant; add forward migrations and verify them against a real PostgreSQL database.
- `ConversationState.activeProductContext` is nullable JSON. Explicit context clearing uses database null and disconnects `activeProductCatalogId`.

## 2026-07-08 Knowledge Lifecycle

- Migration `20260703030000_harden_knowledge_lifecycle` adds lifecycle hardening for knowledge updates.
- `KnowledgeDocumentStatus` now includes `DELETED`; document rows also track `version`, `processingError`, `archivedAt`, and `deletedAt`.
- `KnowledgeChunk` now tracks `version`, `contentHash`, `status`, `embeddingStatus`, and `updatedAt`.
- `KnowledgeChunkStatus`: `PROCESSING`, `READY`, `FAILED`, `INACTIVE`, `ARCHIVED`, `DELETED`.
- `KnowledgeEmbeddingStatus`: `DISABLED`, `PENDING`, `READY`, `FAILED`.
- Chunk uniqueness is now `(tenantId, knowledgeDocumentId, version, chunkIndex)` so old inactive chunks can remain while a new READY version is created.
- Active answer retrieval must filter both document and chunk lifecycle state; tenant scoping alone is not sufficient.

## 2026-07-03 ConversationState and ProductCatalog

- Migration `20260703020000_add_product_catalog_conversation_state` adds `ProductCatalog` and `ConversationState`.
- `ProductCatalog` is tenant-scoped by `tenantId` and `catalogKey`; it stores productSeries, productName, modelNumber, deviceType, aliases, source, and metadata.
- `ConversationState` stores the active product context, active product catalog ID, confidence, source, revision, state JSON, and pending clarification data. It is linked to `(Conversation.id, tenantId)`.
- `ConversationState` is the primary retrieval state source; `Conversation.metadata.rag` remains a compatibility mirror during migration.
- Product catalog and conversation state are not authorization records. Tenant/user/role checks still come from auth guards and tenant-scoped Prisma queries.

## 2026-07-03 Widget Idempotency and Human Assignment

- `Message.clientMessageId` is optional for non-Widget/legacy records but required by the current Widget DTO.
- `@@unique([tenantId, clientMessageId])` prevents the same Widget send from creating multiple conversations or messages inside one tenant.
- Migration `20260703000000_add_widget_message_idempotency` adds the column and `ASSIGNED`; migration `20260703010000_scope_widget_idempotency_before_conversation` corrects uniqueness to tenant scope before conversation creation.
- `ConversationStatus.ASSIGNED` means an agent has claimed a human-support conversation. Both `PENDING_HUMAN` and `ASSIGNED` are active human-support states and pause AI.
- Retrieval context remains JSON under `Conversation.metadata.rag`; it is never authorization data.

## 数据库

- ORM: Prisma
- Provider: PostgreSQL
- Schema: `packages/database/prisma/schema.prisma`
- Client package: `packages/database`

## 2026-06-24 Structured Knowledge Metadata

- No Prisma schema migration was added for product-aware retrieval.
- `KnowledgeDocument.metadata` and `KnowledgeChunk.metadata` may contain `knowledge` plus `structuredKnowledgeVersion: 1`.
- `knowledge` can include productSeries, productName, modelNumber, deviceType, documentType, language, version, sectionTitle, pageNumber, aliases, and intentHints.
- `Conversation.metadata` may contain `rag.productContext` and `rag.pendingClarification` for customer support retrieval context.
- Conversation RAG metadata is not authorization data and must never override tenant/user/role checks.
- Future vector search may add schema changes, but this increment intentionally keeps metadata JSON-backed.

## Tenant Boundary

业务关键模型默认包含 `tenantId`。常用 composite unique/index 用于 tenant-scoped resource access：

- `Customer.tenantId_visitorId`
- `Customer.tenantId_externalId`
- `Conversation.id_tenantId`
- `Message.id_tenantId`
- `KnowledgeBase.tenantId_slug`
- `KnowledgeDocument.id_tenantId`
- `KnowledgeChunk.tenantId_knowledgeDocumentId_version_chunkIndex`
- `AgentConfig.tenantId`
- `Role.tenantId_userId`

## Enums

- `TenantStatus`: `ACTIVE`, `SUSPENDED`, `ARCHIVED`
- `ConversationStatus`: `OPEN`, `AWAITING_CUSTOMER`, `AWAITING_AGENT`, `PENDING_HUMAN`, `ASSIGNED`, `RESOLVED`, `CLOSED`
- `ConversationChannel`: `WIDGET`, `EMAIL`, `PHONE`, `API`
- `MessageAuthor`: `CUSTOMER`, `ASSISTANT`, `AGENT`, `SYSTEM`
- `MessageType`: `TEXT`, `SYSTEM_EVENT`, `HANDOFF_EVENT`, `INTERNAL_NOTE`
- `KnowledgeDocumentStatus`: `DRAFT`, `INDEXING`, `READY`, `FAILED`, `ARCHIVED`, `DELETED`
- `KnowledgeChunkStatus`: `PROCESSING`, `READY`, `FAILED`, `INACTIVE`, `ARCHIVED`, `DELETED`
- `KnowledgeEmbeddingStatus`: `DISABLED`, `PENDING`, `READY`, `FAILED`
- `KnowledgeDocumentSourceType`: `FILE`, `URL`, `MANUAL`, `INTEGRATION`

## Core Models

### Tenant

Platform customer/account boundary. Has `slug`, `name`, `status`, optional `defaultLocale`, `branding`, `metadata`.

Relations include roles, customers, conversations, messages, knowledge bases/docs/chunks, and one AgentConfig.

### User / Role

`User` is platform-global identity data. `Role` is tenant-scoped membership with a simple `name` label. This is not full RBAC yet.

### Customer

Tenant-scoped end customer. Anonymous widget users are stored by `visitorId`; external integrations may later use `externalId`.

### Conversation

Tenant-scoped support thread linked to a Customer. Tracks assigned user, channel, status, handoff metadata, and lastMessageAt.

### Message

Tenant-scoped conversation message. Supports customer, assistant, agent, and system authors. `citations`, `payload`, and `metadata` are JSON.

Assistant messages currently store retrieval metadata under `metadata.retrieval`.

### KnowledgeBase

Tenant-scoped container for knowledge documents. Unique by `(tenantId, slug)`.

### KnowledgeDocument

Tenant-scoped source document. Stores title, source type, optional source URI, raw text content, checksum, status, version, processingError, chunk count, metadata, ingestedAt, archivedAt, and deletedAt.

Current ingestion keeps the text content in the database; no external object storage is implemented yet.

### KnowledgeChunk

Tenant-scoped chunk linked to a KnowledgeDocument. Stores version, chunkIndex, content, contentHash, status, embeddingStatus, optional tokenCount, sourceLocator, metadata, and timestamps.

No embedding vector field exists.

### AgentConfig

Tenant-specific assistant settings:

- `displayName`
- `systemPrompt`
- `welcomeMessage`
- `fallbackMessage`
- `handoffEnabled`
- `escalationRules`
- `retrievalSettings`
- `widgetSettings`
- `metadata`

Current deterministic reply uses display/fallback/welcome/handoff fields, but not a real LLM system prompt.

Tenant AI profile foundation:

- Profile storage reuses `AgentConfig`; no new table or migration is required.
- `displayName`, `welcomeMessage`, and `fallbackMessage` store core display messages.
- `widgetSettings` stores widget-safe profile display fields such as title/company display name, handoff message, primary color, logo URL, and avatar URL.
- `metadata.aiProfile` stores full profile guidance, including business type, tone, safe answer instructions, sensitive topic instructions, and do-not-answer instructions.
- Public widget profile responses must be derived from safe display fields and must not expose `metadata.aiProfile` internal prompt guidance.

## Seed Data

`packages/database/prisma/seed.ts` creates/upserts a `kasta` demo tenant, support admin user, role, AgentConfig, and default knowledge base. Kasta must remain seed/demo data only, not platform core logic.
## Membership Security Models

- `User.clerkUserId` is unique and first-class.
- `Role` is a tenant membership with `TenantRole` and `MembershipStatus`; non-platform users are limited to one active tenant during invitation acceptance/provisioning.
- `TenantInvitation` stores only a token hash and lifecycle timestamps. `AuditLog` records membership and invitation security events without storing bearer tokens.
- `Tenant.agentInvitationQuota` is an integer with default 5 and database check range 0-5. It limits simultaneously active Agent invitations, not historical invitation records or active Agent memberships.

## User Avatar and Table Source Metadata

- User avatar currently persists as `User.metadata.avatarUrl`; it is platform-user data returned through the authenticated account shape.
- Table document metadata stores safe file facts and an extraction summary, not the uploaded binary workbook.
- Normalized CSV/XLSX content remains in `KnowledgeDocument.content`; chunks include sheet/row locator fields plus optional text offsets.
