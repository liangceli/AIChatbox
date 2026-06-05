# 项目汇总 Skill

## 2026-06-04 Product Direction Note

The long-term priority is the user's personal/commercial Level 3 AI customer support + lead capture product. Current Haneco/Kasta references are seed/demo/reference or company-only context and must not define reusable platform core. After the 2026-06-04 alpha-safe access round, the repo is conditionally ready for a personal product repo split when the next work begins Level 3 lead capture, public personal branding, or company-specific integrations.

## 项目定位

HanecoAIPilot 是一个可复用、白标、多租户 AI 客服平台。它不是 Kasta 专用项目；Kasta 只是当前 seed/demo tenant。平台核心必须保持 tenant-agnostic，任何客户特定的品牌、prompt、升级规则、知识库内容、集成逻辑都应通过 tenant-scoped 数据、配置或隔离模块表达。

## 技术栈

- Monorepo: `pnpm` workspaces + `turbo`
- 语言: TypeScript
- Admin UI: Next.js App Router
- Customer Widget: React + TypeScript embeddable package
- API: NestJS
- Database: PostgreSQL + Prisma
- Worker: Redis-ready async worker boundary
- Shared packages:
  - `packages/types`: 前后端共享类型
  - `packages/database`: Prisma schema/client
  - `packages/config`: 环境变量解析
  - `packages/tenant-core`: tenant runtime 边界
  - `packages/ai-core`: AI/RAG 共享契约
  - `packages/utils`: 通用工具
  - `packages/logging`: worker/logging 基础设施

## 主要应用

- `apps/admin-web`: 内部运营管理 UI，包含 tenant 管理、知识库管理、handoff 管理、本地聊天测试入口。
- `apps/customer-widget`: 可嵌入客户聊天 widget，负责匿名访客、聊天、人工支持请求、SSE 刷新。
- `apps/api`: HTTP API，承载 tenant resolution、chat、knowledge、conversation/handoff、realtime snapshot。
- `apps/ai-worker`: 当前是 worker 边界与环境加载占位，未来用于异步 ingestion、retrieval、summarization、handoff jobs。

## 当前能力

- 多租户基础：通过 `x-tenant-slug` 或 realtime query `tenantSlug` 解析 active tenant，并在服务层使用 `tenant.id` 约束查询。
- 匿名访客：widget 使用 localStorage 持久化 visitorId，API 使用 `tenantId + visitorId` upsert Customer。
- 聊天闭环：保存 customer message、assistant message、conversation 状态与消息列表。
- 知识库闭环：tenant-scoped KnowledgeBase/KnowledgeDocument/KnowledgeChunk，支持手动文本、文件文本、URL 导入、同步 chunking、reprocess、archive/delete。
- 检索闭环：当前是 keyword/phrase deterministic retrieval，不是 embeddings/vector search。
- 引用闭环：assistant message 的 `citations` 由后端根据 retrieved chunks 生成并持久化。
- 人工 handoff：客户请求人工支持，conversation 进入 `PENDING_HUMAN`，后台可分配支持用户并发送 agent reply。
- 近实时刷新：admin/agent tenant-wide SSE snapshot 已经过 admin protection，customer widget 使用 visitor/conversation-scoped SSE，不是完整 websocket 协作层。
- Alpha admin access：`apps/admin-web` 使用 `/admin/access` + httpOnly cookie + server-side `/api/admin/...` proxy，不暴露 backend `ADMIN_API_TOKEN` 给 browser。

## 运行入口

- 安装依赖：`corepack pnpm install`
- 生成 Prisma client：`corepack pnpm db:generate`
- 启动本地 infra：`docker compose -f infra/docker-compose.yml up -d`
- 迁移数据库：`corepack pnpm --filter @platform/database exec dotenv -e ../../.env -- prisma migrate deploy`
- seed：`corepack pnpm db:seed`
- 启动全部：`corepack pnpm dev`

默认地址：

- Admin web: `http://localhost:3000`
- Admin console: `http://localhost:3000/admin`
- Agent console: `http://localhost:3000/agent`
- Customer chat: `http://localhost:3000/chat`
- API base: `http://localhost:4000/v1`
- Health: `http://localhost:4000/v1/health`

## 架构边界

- 不允许在平台核心硬编码 tenant 名称、Kasta prompt、Kasta branding 或 Kasta 业务规则。
- 业务关键数据表默认必须 tenant-aware。
- 单条资源读取/更新/删除优先使用 composite keys，例如 `id_tenantId`、`tenantId_slug`、`tenantId_visitorId`。
- `apps/*` 之间不要直接互相 import；共享类型和工具放到 `packages/*`。
- AI 相关可复用接口放 `packages/ai-core`，provider-specific 实现应隔离。
- 当前不要引入 LangGraph、multi-agent orchestration、完整 auth/RBAC，除非后续明确要求。

## 已知限制

- 当前 assistant reply 仍是 deterministic/template flow，没有真实 LLM 生成。
- 没有 embeddings/vector database。
- 没有完整 auth/RBAC；目前只有 alpha admin token guard 和 admin-web server-side access gate。
- 没有完整 realtime/websocket 协作层。
- ingestion 目前主要同步执行，还没有队列化 worker pipeline。
- lint/test 仍是轻量占位和 TypeScript sanity checks。
