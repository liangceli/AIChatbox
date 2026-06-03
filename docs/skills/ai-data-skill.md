# AI 与数据流 Skill

## 当前 AI 状态

当前系统是 RAG 数据流 scaffold，不是真正 LLM-powered RAG。

现状：

- Retrieval: deterministic keyword/phrase retrieval。
- Generation: `AssistantReplyService` deterministic/template response。
- Citations: 后端根据 retrieved chunks 生成。
- Persistence: assistant message 内容、citations、retrieval metadata 都写入 Message。

## Knowledge Retrieval

文件：

- `apps/api/src/modules/knowledge/knowledge-retrieval.service.ts`

流程：

- 从用户问题提取 search terms，过滤 stop words。
- 提取相邻 phrase。
- 查询当前 tenant 的 READY KnowledgeChunk。
- 匹配 chunk content 和 document title。
- 计算 score 与 coverage。
- 过滤低分或低 coverage 候选。
- 按 score、coverage、title、chunkIndex 排序。
- 默认返回前 3 个 chunks。

关键限制：

- 没有 embeddings。
- 没有 vector DB。
- 没有 reranker。
- tenant scope 由 Prisma query 的 `tenantId: tenant.id` 保证。

## Assistant Reply

文件：

- `apps/api/src/modules/chat/assistant-reply.service.ts`

当前输入：

- displayName
- welcomeMessage
- fallbackMessage
- handoffEnabled
- userMessage
- retrievedChunks

当前输出：

- content
- citations
- usedFallback

当前行为：

- 空消息返回 fallback。
- 有 retrieved chunks 时，根据问题 term 在 chunks 中选择 grounded sentences。
- 如果没有可用 grounded sentence，走 fallback。
- 有可用 grounded sentence 时，拼接 support knowledge base 风格回答。
- citations 从 retrieved chunks 直接构造，不要求模型生成。

## Citations

共享类型：

- `packages/types/src/index.ts` 中的 `Citation`

字段：

- knowledgeDocumentId
- chunkId
- title
- chunkIndex
- sourceUri
- sourceLocator
- relevanceScore
- excerpt

规则：

- citation 必须由后端基于已检索 chunk 生成。
- LLM 不应该发明 citation id。
- `Message.citations` 是 Json 字段。
- 前端 admin/widget 都会展示 citations。

## AgentConfig

Prisma 模型：

- `AgentConfig`

当前字段：

- displayName
- systemPrompt
- welcomeMessage
- fallbackMessage
- handoffEnabled
- escalationRules
- retrievalSettings
- widgetSettings
- metadata

规则：

- tenant-specific prompt/文案/策略优先放 AgentConfig。
- 不要把 prompt 写死为 Kasta。
- 后续真实 LLM prompt 应使用 AgentConfig 作为输入之一。

## 推荐的 LLM 增量方向

下一步实现真实 LLM 回复时，应保持小步、可回退：

- 增加 LLM provider boundary，例如 `generateGroundedReply(input): Promise<GeneratedAssistantReply>`。
- 输入包含 tenant 信息、user message、AgentConfig、retrieved chunks、轻量 conversation context、provider/model config。
- 输出包含 content、metadata、是否 fallback；citations 仍由后端生成。
- 首个 provider 可用 OpenAI。
- `OPENAI_API_KEY` 缺失时继续使用 deterministic fallback。
- 增加 `OPENAI_MODEL` 到 config 和 `.env.example`。
- 不引入 LangGraph。
- 不引入 multi-agent orchestration。
- 不引入 embeddings/vector search，除非后续明确要求。

## Worker 边界

`apps/ai-worker` 当前只是 ready boundary：

- 加载 workspace env。
- 使用 shared logging。
- 未来可承载异步 ingestion、embedding indexing、retrieval refresh、summarization、handoff jobs。

在没有实际队列/异步需求前，不要把复杂 orchestration 提前加入。

## AI/数据流开发规则

- tenant isolation 永远由后端数据查询保证，不交给模型判断。
- 生成逻辑失败时必须有 deterministic fallback。
- 引用和证据链必须可追踪到 KnowledgeChunk。
- provider-specific 代码隔离，避免污染 ChatService。
- AI、retrieval、citation、AgentConfig 变更后同步更新本 skill。
