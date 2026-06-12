# 中文 Diff Review & QA Report

## 1. 总体结论

可以进入人工验收

本轮要求复核的两个 P1 均已修复：

- Tenant-branding Logo explicit-null clearing：通过。`null` 会停止 AgentConfig、widget settings 和 tenant branding fallback；独立复现确认重载后仍为 `null`。
- Provider-time handoff `lastMessageAt` monotonicity：通过。Provider 返回后若 conversation 已进入 `PENDING_HUMAN`，代码直接返回最新持久化 conversation，不保存 assistant message，也不更新或回退 `lastMessageAt`。

未发现新的必须修问题。存在一个非阻塞残余风险：provider 调用前首次状态重读发现 `PENDING_HUMAN` 的旧分支仍会写入 customer message 时间，极窄并发场景下可能回退更新更晚的 handoff/agent activity 时间。

## 2. Scope 检查

| 检查项 | 结果 | 说明 |
| --- | -- | -- |
| 是否只处理最新两个 P1 | 通过 | 改动集中在 nullable media fallback、post-provider pending-human 返回路径、focused tests 和相关 docs/skills。 |
| Tenant-branding Logo explicit-null clearing | 通过 | `firstDefined` 区分 `null` 与 `undefined`；显式 `null` 停止 fallback，缺失值仍允许 fallback。 |
| Provider-time handoff suppression | 通过 | Provider 结果被丢弃，assistant message 不落库，conversation 保持 `PENDING_HUMAN`。 |
| Provider-time `lastMessageAt` monotonicity | 通过 | Post-provider pending-human 分支不再更新 conversation，直接返回 handoff 后的最新记录。 |
| Auth/API route/Prisma/provider contract | 通过 | 未改变 auth、route、schema、provider selection、retrieval、citation 或 widget request contract。 |
| 是否存在 scope creep | 通过 | 最新 follow-up 未发现无关功能扩张；当前 git diff 仍为多轮累计 diff。 |

## 3. 文件级 Diff Review

| 文件 | 改动是否合理 | 风险等级 | 说明 |
| -- | ------ | ---- | -- |
| `apps/api/src/modules/tenants/tenant-ai-profile.ts` | 合理 | Low | `firstDefined` 保留显式 `null`，同时允许 `undefined` 继续读取旧 fallback。 |
| `apps/api/src/modules/chat/chat.service.ts` | 合理 | Medium | Post-provider pending-human 分支直接返回最新记录，满足 AI suppression 与时间单调性要求。 |
| `apps/api/scripts/provider-behavior.test.ts` | 合理 | Low | 覆盖 tenant branding Logo 清除重载、无 assistant message、无 conversation update、状态与 `lastMessageAt` 保持。 |
| `docs/skills/ai-chatbox-skill.md` / `backend-skill.md` / `qa-skill.md` | 合理 | Low | 已同步 post-provider suppression 与 activity-time invariant。 |
| `docs/skills/frontend-skill.md` / `api-contract-skill.md` | 合理 | Low | 已同步显式 `null` 停止所有媒体 fallback 的语义。 |
| `docs/ai-handoff/latest-implementation.md` | 合理 | Low | 最新 handoff 与实际实现、测试结果一致。 |

## 4. 发现的问题

| 问题 | 严重程度 | 是否必须修 | 建议处理方式 |
| -- | ---- | ----- | ------ |
| Pre-provider 首次状态重读发现 pending human 时仍会把 `lastMessageAt` 写为 customer message 时间 | P2 nice to fix | 否 | 后续可让首次 pending-human 分支同样保留最新 conversation，或仅在 customer message 时间更新时才写入；增加 agent/handoff activity 晚于 customer message 的回归测试。 |

## 5. Regression 风险

- Logo clearing：已验证带 tenant branding Logo 时，显式清除后不会恢复旧 Logo。
- Human support queue：provider-time handoff 会保留较新的 handoff activity 时间，不会因 provider 返回而移动到旧位置。
- AI chat：provider-time handoff 后不会新增 assistant message，也不会退出 `PENDING_HUMAN`。
- 残余风险：极窄的 pre-provider 并发窗口仍可能影响 conversation 活动时间排序，但不影响 human mode 或 AI suppression。

## 6. AI Chatbox 专项检查

- message flow：通过。Provider 期间进入 human mode 后，customer message 保留，AI 结果丢弃。
- conversation history：通过。Suppression 路径返回已有消息，不新增 assistant message。
- prompt handling：本轮未改动。
- streaming：Not applicable for this task.
- error handling：未发现新增异常泄露。
- API key exposure：未发现 API key、admin token 或 secret 暴露。
- sensitive data/privacy：未扩大 public profile 字段。
- user input validation：未改动；显式 `null` 仅用于清除媒体。

## 7. 验证建议

QA 已执行并通过：

- `pnpm --filter @platform/api test`
- `pnpm --filter @platform/api typecheck`
- `pnpm --filter @platform/api build`
- `pnpm --filter @platform/admin-web test`
- `pnpm --filter @platform/admin-web typecheck`
- `pnpm --filter @platform/admin-web build`
- `pnpm typecheck`：11/11 packages 通过。
- `pnpm test`：11/11 tasks 通过；多个 package 仍是 placeholder tests。
- `pnpm lint`：11/11 packages 通过；当前 lint 主要是 TypeScript sanity check。
- `git diff --check`：无 whitespace error，仅有 Windows LF/CRLF warning。

独立 Logo 清除复现结果：

```json
{"current":"https://example.test/tenant-logo.png","cleared":null,"reloaded":null}
```

人工验收：

1. 在 `/admin` 使用一个带 `tenant.branding.logoUrl` 的租户，点击 Logo Remove、保存并重载，确认旧 branding Logo 不再出现。
2. 使用慢 provider 发起客户消息，在 provider 返回前开启 Human Mode，确认没有 AI 回复。
3. 确认该 conversation 保持 `pending_human`，并继续显示为 handoff event 对应的最新活动位置。
4. 在未发生 handoff 的正常 AI conversation 中发送消息，确认 assistant reply 仍正常保存。

## 8. 是否需要更新 docs/skills

最新两个 P1 对应的 docs/skills 已同步，无必须补写项。

后续若处理 P2 pre-provider 时间单调性风险，应同步 `docs/skills/ai-chatbox-skill.md`、`backend-skill.md` 和 `qa-skill.md`。

## 9. 给 Implementation Chat 的修复请求

No fix request required.
