# 中文 Diff Review & QA Report

## 1. 总体结论

可以进入人工验收

本轮 QA fix 准确覆盖了 `latest-qa.md` 中两个 P1：admin access open redirect 和 public handoff missing visitorId。修复范围集中，没有发现新的 scope creep。

## 2. Scope 检查

| 检查项 | 结果 | 说明 |
| --- | -- | -- |
| admin access open redirect 是否修复 | 通过 | 新增 `sanitizeAdminNextPath`，拒绝 protocol-relative、absolute URL、反斜杠路径和非 `/` 开头路径。 |
| public handoff missing visitorId 是否修复 | 通过 | DTO 将 `visitorId` 改为 required + non-empty；service 对 blank/missing visitorId 抛 `BadRequestException`。 |
| wrong visitorId 是否仍被拒绝 | 通过 | `requestHandoff` 现在用 normalized visitorId 强制比对 conversation customer visitorId，错误 visitor 抛 `ForbiddenException`。 |
| 正常 widget/local demo handoff 是否保持 | 通过 | 现有 widget/local demo 已传 `visitorId`，收紧后正常路径不应被破坏。 |
| 是否新增无关功能 | 通过 | 仅新增 sanitizer、测试、handoff visitorId required、相关 docs/handoff 更新。 |

## 3. 文件级 Diff Review

| 文件 | 改动是否合理 | 风险等级 | 说明 |
| -- | ------ | ---- | -- |
| `apps/admin-web/app/lib/admin-next-path.cjs` | 合理 | Low | Sanitizer 默认回 `/admin`，只允许 safe same-origin relative path。 |
| `apps/admin-web/app/admin/access/page.tsx` | 合理 | Low | `next` 参数改用 sanitizer，不再直接 `startsWith("/")`。 |
| `apps/admin-web/scripts/admin-access.test.cjs` | 合理 | Low | 覆盖 `/admin`、`/agent`、`//external`、absolute URL、反斜杠路径和非 slash 路径。 |
| `apps/admin-web/package.json` | 合理 | Low | `test` 脚本从 placeholder 改为 sanitizer regression test。 |
| `apps/api/src/modules/conversations/dto/request-handoff.dto.ts` | 合理 | Low | `visitorId` required + `IsNotEmpty`，符合 public handoff scope 收紧。 |
| `apps/api/src/modules/conversations/conversations.service.ts` | 合理 | Low | service 层也强制 visitorId，并校验 customer visitor 归属。 |
| `apps/api/scripts/provider-behavior.test.ts` | 合理 | Low | 增加 handoff missing/blank/wrong/correct visitorId 回归覆盖。 |
| `docs/ai-handoff/latest-implementation.md` / `docs/skills/*` | 合理 | Low | 已同步 final route behavior、admin next sanitizer、handoff visitorId required。 |

## 4. 发现的问题

| 问题 | 严重程度 | 是否必须修 | 建议处理方式 |
| -- | ---- | ----- | ------ |
| 无必须修问题 | P2 nice to fix | 否 | 两个 P1 已按要求修复。 |

## 5. Regression 风险

风险较低：

- `/admin/access?next=...` 非安全路径会 fallback 到 `/admin`，不会跳外站。
- Public handoff 现在要求 `visitorId`，任何旧客户端如果没传会收到 400；当前 widget/local demo 已传，符合预期。

## 6. AI Chatbox 专项检查

本轮只收紧 handoff scope，不改变 AI 回复生成、prompt、provider、retrieval、citations、conversation history 或 `PENDING_HUMAN` AI blocking。

检查结果：

- customer message send 未改。
- customer handoff with correct `visitorId` 仍可成功。
- missing/blank `visitorId` 被拒绝。
- wrong `visitorId` 被拒绝。
- 未发现 admin/API secret 暴露新增风险。

## 7. 验证建议

QA 已执行：

- `pnpm --filter @platform/admin-web test`：通过。
- `pnpm --filter @platform/api test`：通过。
- `pnpm --filter @platform/admin-web typecheck`：通过。
- `pnpm --filter @platform/api typecheck`：通过。
- `pnpm --filter @platform/admin-web build`：通过。

人工验收建议：

- 访问 `/admin/access?next=//example.com`，输入正确 token 后确认不跳外站。
- customer handoff 不传 `visitorId` 应 400。
- customer handoff 传错 `visitorId` 应被拒绝。
- widget 正常点击 Human 应仍成功进入 handoff。

## 8. 是否需要更新 docs/skills

不需要额外更新。本轮 diff 已同步：

- `docs/skills/api-contract-skill.md`
- `docs/skills/frontend-skill.md`
- `docs/skills/qa-skill.md`
- `docs/ai-handoff/latest-implementation.md`

## 9. 给 Implementation Chat 的修复请求

No fix request required.
