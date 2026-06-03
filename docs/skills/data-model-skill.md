# Data Model Skill

## 数据库

- ORM: Prisma
- Provider: PostgreSQL
- Schema: `packages/database/prisma/schema.prisma`
- Client package: `packages/database`

## Tenant Boundary

业务关键模型默认包含 `tenantId`。常用 composite unique/index 用于 tenant-scoped resource access：

- `Customer.tenantId_visitorId`
- `Customer.tenantId_externalId`
- `Conversation.id_tenantId`
- `Message.id_tenantId`
- `KnowledgeBase.tenantId_slug`
- `KnowledgeDocument.id_tenantId`
- `KnowledgeChunk.tenantId_knowledgeDocumentId_chunkIndex`
- `AgentConfig.tenantId`
- `Role.tenantId_userId`

## Enums

- `TenantStatus`: `ACTIVE`, `SUSPENDED`, `ARCHIVED`
- `ConversationStatus`: `OPEN`, `AWAITING_CUSTOMER`, `AWAITING_AGENT`, `PENDING_HUMAN`, `RESOLVED`, `CLOSED`
- `ConversationChannel`: `WIDGET`, `EMAIL`, `PHONE`, `API`
- `MessageAuthor`: `CUSTOMER`, `ASSISTANT`, `AGENT`, `SYSTEM`
- `MessageType`: `TEXT`, `SYSTEM_EVENT`, `HANDOFF_EVENT`, `INTERNAL_NOTE`
- `KnowledgeDocumentStatus`: `DRAFT`, `INDEXING`, `READY`, `FAILED`, `ARCHIVED`
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

Tenant-scoped source document. Stores title, source type, optional source URI, raw text content, checksum, status, chunk count, metadata, ingestedAt.

Current ingestion keeps the text content in the database; no external object storage is implemented yet.

### KnowledgeChunk

Tenant-scoped chunk linked to a KnowledgeDocument. Stores chunkIndex, content, optional tokenCount, sourceLocator, metadata.

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

## Seed Data

`packages/database/prisma/seed.ts` creates/upserts a `kasta` demo tenant, support admin user, role, AgentConfig, and default knowledge base. Kasta must remain seed/demo data only, not platform core logic.

