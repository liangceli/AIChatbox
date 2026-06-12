# 中文 Diff Review & QA Report

## 1. 总体结论

可以进入人工验收

上一轮 P1 已准确修复。URL Import 现在使用从请求发送前开始计算的 15 秒绝对 deadline，不再依赖 socket inactivity timeout。Deadline 到期会销毁 active response/request，single-settle 逻辑确保成功、错误、大小超限、deadline 和同步异常路径只完成一次并清理 timer。

Slow-trickle regression 使用真实本地 HTTP server 持续发送小 chunk，验证持续数据无法延长绝对时限。未发现新的必须修问题。

本轮 5 项人工验收已全部通过：公网 URL Import、受限 URL 安全拒绝、桌面/移动端布局、真实 OpenAI smoke、真实 OpenAI Answer Debug。当前可以进入 commit。

## 2. Scope 检查

| 检查项 | 结果 | 说明 |
| --- | -- | -- |
| Absolute 15-second deadline | 通过 | 使用独立 deadline timer，从 outbound request 发送前开始计算。 |
| Slow-trickle bypass prevention | 通过 | 持续收到小 chunk 时仍会在绝对 deadline 到期后终止。 |
| Timer cleanup / single settle | 通过 | Resolve/reject、request/response error、大小超限、deadline 和同步异常均通过 single-settle 清理 timer。 |
| Existing SSRF protection | 通过 | 初始 URL、redirect、DNS 结果、DNS pinning 和受限网络校验未被削弱。 |
| Existing API/admin/tenant scope | 通过 | API shape、Admin guard、tenant scope 和持久化合同未改变。 |
| Customer chat/widget behavior | 通过 | 最新 follow-up 未修改 customer chat/widget、provider、handoff 或 conversation history。 |
| Scope creep / unrelated files | 通过 | 最新增量仅涉及 absolute deadline、focused regression 和对应 docs。 |

## 3. 文件级 Diff Review

| 文件 | 改动是否合理 | 风险等级 | 说明 |
| -- | ------ | ---- | -- |
| `apps/api/src/modules/knowledge/knowledge-url-import.service.ts` | 合理 | Medium | Absolute deadline、request/response destruction、single-settle 和 timer cleanup 实现正确。 |
| `apps/api/scripts/provider-behavior.test.ts` | 合理 | Medium | 使用真实本地 HTTP slow-trickle response 验证绝对 deadline；现有 SSRF regressions 保持通过。 |
| `docs/skills/backend-skill.md` | 合理 | Low | 已明确 absolute deadline 和持续流响应行为。 |
| `docs/skills/qa-skill.md` | 合理 | Low | 已记录 slow-trickle regression gate。 |
| `docs/skills/api-contract-skill.md` | 合理 | Low | 已明确每个 outbound request 的绝对 15 秒时限。 |
| `docs/skills/current-status.md` | 合理 | Low | 与当前实现状态一致。 |
| `docs/ai-handoff/latest-implementation.md` | 合理 | Low | 最新 follow-up、验证结果和剩余人工 QA 与实际一致。 |
| Answer Debug / Admin-Web / shared contracts 累计 diff | 合理 | Medium | 上轮审查结论不变；未发现新增安全或合同回归。 |

## 4. 发现的问题

| 问题 | 严重程度 | 是否必须修 | 建议处理方式 |
| -- | ---- | ----- | ------ |
| Admin-Web 新交互测试仍主要为 source smoke | P2 nice to fix | 否 | 后续引入组件或浏览器自动化，覆盖 loading/error、document actions 和移动端布局。 |
| Answer Debug non-persistent test 未监控所有可能 Prisma write API | P2 nice to fix | 否 | 后续扩展为 customer/conversation/message create/update/upsert 全面无写入断言。 |

## 5. Regression 风险

- Safe public URL Import 已在当前正常网络环境人工通过；不同部署环境仍需配置并验证 egress policy。
- Deadline 是每个 outbound request 的 15 秒时限；最多五次 redirects 的整条导入流程总时间可能超过 15 秒，符合当前文档合同。
- URL Import 与知识文档 lifecycle 操作为同步流程，慢请求期间需人工确认 Admin-Web loading/error feedback。
- Deployment egress denial 仍应作为 defense in depth。

## 6. AI Chatbox 专项检查

- message flow：本轮未修改。
- conversation history：本轮未修改；Answer Debug 仍为 non-persistent。
- prompt handling：本轮未修改。
- streaming：Not applicable for this task.
- error handling：URL Import deadline/network error 会转换为安全错误，不返回原始网络异常。
- API key exposure：未发现 OpenAI/admin token 或 auth header 暴露。
- sensitive data/privacy：SSRF 内网访问风险已通过 URL/DNS/redirect 校验和 DNS pinning 防护。
- user input validation：仅允许安全公网 HTTP(S)，拒绝 credentials 和受限目标。

## 7. 验证建议

QA 本轮已执行并通过：

- `pnpm --filter @platform/api test`
- `pnpm --filter @platform/api typecheck`
- `pnpm --filter @platform/api lint`
- `pnpm --filter @platform/api build`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `git diff --check`：无 whitespace error，仅有 Windows LF/CRLF warning。

自动化已确认：

- Slow-trickle response 无法绕过 absolute deadline。
- Deadline 到期会安全终止 request/response。
- Localhost、private/link-local/cloud metadata、mixed DNS、embedded credentials 和受限 redirects 被拒绝。
- Safe public redirect、HTML extraction、DNS pinning 和 Node all-address lookup 保持通过。
- Workspace 11/11 packages 的 typecheck、lint、test、build 均通过；部分 package tests 仍为 placeholder。

人工验收结果：

1. 公网 URL Import：通过。成功 ingestion，并显示文档/chunks。
2. 受限 URL Import：通过。Localhost target 被安全拒绝，未创建文档或暴露内部信息。
3. 桌面/移动端布局：通过。Knowledge Base、document inspector、Answer Debug 无重叠或溢出。
4. 真实 OpenAI smoke：通过。`providerMode: openai`、`attemptedRealOpenAI: true`、assistant/citations/provider metadata 均返回，`usedFallback: false`。
5. 真实 OpenAI Answer Debug：通过。Requested/Used Provider 均为 `openai`，Fallback 为 `No`，返回 3 个 chunks 和 3 个 citations；未发现 API key、admin token、raw prompt 或 tenant ID。

## 8. 是否需要更新 docs/skills

本轮 absolute deadline 和 SSRF 相关 docs/skills 已同步，无必须补写项。人工验收结果已记录在本 QA 报告。

## 9. 给 Implementation Chat 的修复请求

No fix request required.
