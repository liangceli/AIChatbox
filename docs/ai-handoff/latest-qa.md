# 中文 Diff Review & QA Report

## 1. 总体结论

可以进入人工验收

本轮 P1 follow-up 已准确修复。`buildBackendCitations()` 现在先构造不含 `sourceLocator` 的 citation object，只在 `chunk.sourceLocator !== undefined` 时才添加 `sourceLocator`。这意味着当 chunk dedupe 后 locator 不可靠或缺失时，backend citation 中不会出现 `sourceLocator` key，也不会产生 `sourceLocator: undefined` 的 Prisma JSON 持久化风险。

## 2. Scope 检查

| 检查项 | 结果 | 说明 |
| --- | -- | -- |
| Backend citation omission | 通过 | 无可靠 locator 时 citation object 真正省略 `sourceLocator` key。 |
| Reliable locator preservation | 通过 | 有可靠 `chunk.sourceLocator` 时仍会保留并传入 backend citation。 |
| Chunk dedupe locator behavior | 通过 | 上一轮 chunker 已在 dedupe 改变文本时省略 locator，本轮未破坏该行为。 |
| Prisma JSON safety | 通过 | 不再把 `sourceLocator: undefined` 放入可能持久化的 citation object。 |
| Backend citation contract | 通过 | Citations 仍由 retrieved chunks 生成，包含 document/chunk/title/source/score/excerpt；locator 为可靠时可选字段。 |
| Test coverage | 通过 | 新增 regression 断言无 locator chunk 生成的 citation 中 `"sourceLocator" in citation === false`。 |
| Scope creep / unrelated changes | 通过 | 本轮 follow-up 只涉及 citation helper、focused test 和 handoff；未扩大功能范围。 |

## 3. 文件级 Diff Review

| 文件 | 改动是否合理 | 风险等级 | 说明 |
| -- | ------ | ---- | -- |
| `apps/api/src/modules/chat/citation-builder.ts` | 合理 | Low | 通过局部 `citation` object 和条件赋值真正 omit 缺失 locator；保留 excerpt、score 和 source URI 行为。 |
| `apps/api/scripts/provider-behavior.test.ts` | 合理 | Low | 新增 `testBackendCitationsOmitMissingSourceLocatorKey()`，直接覆盖本轮 P1；现有 chunk locator reliability tests 保持覆盖。 |
| `docs/ai-handoff/latest-implementation.md` | 合理 | Low | handoff 准确记录 backend citation omission 行为和验证结果。 |
| 既有 RAG/Answer Debug/URL Import 累计 diff | 合理 | Medium | 本轮未新增问题；上一轮记录的真实 OpenAI alpha gate 和 RAG QA 仍适用。 |

## 4. 发现的问题

| 问题 | 严重程度 | 是否必须修 | 建议处理方式 |
| -- | ---- | ----- | ------ |
| URL import 45s flow deadline 未覆盖 DNS/safety resolution 本身耗时 | P2 nice to fix | 否 | 后续可给 resolver 加 deadline wrapper；不阻塞本轮 locator/citation fix。 |

未发现新的 P0/P1 问题。No fix request required.

## 5. Regression 风险

- Customer chat persisted citations：无可靠 locator 时将没有 `sourceLocator` 字段，这是预期行为；前端若显示 locator 相关能力，应按 optional 字段处理。
- Backend citations 仍可被正常持久化为 Prisma JSON，避免 nested `undefined`。
- OpenAI success path 和 deterministic grounded path 都继续通过 `buildBackendCitations()` 从 retrieved chunks 生成 citations，因此 locator omission 行为一致。
- 本轮不改变 retrieval scoring、OpenAI prompt、message flow、handoff 或 conversation history。

## 6. AI Chatbox 专项检查

- message flow：未修改。
- conversation history：未修改；assistant messages 仍持久化 citations。
- prompt handling：未修改 OpenAI prompt。
- streaming：Not applicable for this task.
- error handling：无新增错误响应路径。
- API key exposure：未发现 secret 暴露。
- sensitive data/privacy：Answer Debug 仍不返回 citation `sourceLocator`；backend persisted citations 只在 locator 可靠时包含 locator。
- user input validation：Not applicable for this locator-only follow-up.

## 7. 验证建议

QA 已执行并通过：

- `.\node_modules\.bin\pnpm.CMD --filter @platform/api test`
- `.\node_modules\.bin\pnpm.CMD --filter @platform/api typecheck`
- `git diff --check`：无 whitespace error，仅 Windows LF/CRLF warning。

人工验收建议：

1. 用普通 knowledge-backed chat 或 Answer Debug 确认 citations 仍显示 document title/source/excerpt。
2. 对重复内容文档确认回答仍有 citations，但 API 中不应出现不可靠 `sourceLocator`。
3. 对非重复普通文档，如果 API 输出包含 `sourceLocator`，它应能准确映射到 persisted document content。

这轮 backend citation omission 是 locator-only fix，不改变 provider request、retrieval scoring 或 model output，因此不需要为了本轮小修单独重跑真实 OpenAI。整个 RAG hardening 最终进入 alpha 前，仍应按 `docs/runtime/alpha-knowledge-qa-checklist.md` 跑真实 OpenAI smoke 和 Answer Debug。fake/test token、mocked OpenAI、deterministic-only 输出或旧 RAG 行为下的 smoke 不能作为 alpha-ready evidence。

## 8. 是否需要更新 docs/skills

不需要额外更新。当前 docs/skills 已记录 optional reliable-only locator 合同；本轮只是把 citation helper 的实现补齐到该合同。

## 9. 给 Implementation Chat 的修复请求

No fix request required.
