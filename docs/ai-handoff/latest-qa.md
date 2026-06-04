# 中文 Diff Review & QA Report

## 1. 总体结论

可以进入人工验收

本轮 QA follow-up 覆盖了上一版 QA 指出的三个文档缺口：`GET /v1/realtime/conversations` public alpha 分类、`apps/admin-web` browser-only/token 限制、以及 route-map smoke note。改动集中在 handoff 和 docs/skills，没有新增实现逻辑、没有重构 auth 架构，也没有改 customer chat/widget 行为。

## 2. Scope 检查

| 检查项 | 结果 | 说明 |
| --- | -- | -- |
| 是否只处理 realtime public alpha 文档缺口 | 通过 | `latest-implementation.md`、`api-contract-skill.md`、`auth-skill.md`、`backend-skill.md`、`frontend-skill.md`、`qa-skill.md`、`current-status.md` 均明确写入 realtime snapshot 当前公开 alpha 状态。 |
| 是否只处理 admin-web token 限制文档缺口 | 通过 | 明确说明 admin-web 仍是 browser-only，不能把 `ADMIN_API_TOKEN` 暴露给浏览器，local alpha 需 dev disable 或未来 server-side auth/proxy。 |
| 是否补充 route-map smoke note | 通过 | 已记录 protected endpoints 401/403/valid-token、public customer/chat/handoff/detail/read/realtime 可达的 smoke 期望。 |
| 是否有 scope creep | 通过 | 未看到新增架构、auth 实现、frontend token 传递或 customer widget 改动。 |
| 是否有不相关文件改动 | 基本通过 | 本轮新增/修改的 docs/skills 与 QA follow-up 相关；实现文件仍是上一轮 admin guard diff 的一部分，不是本次文档 follow-up 额外扩张。 |

## 3. 文件级 Diff Review

| 文件 | 改动是否合理 | 风险等级 | 说明 |
| -- | ------ | ---- | -- |
| `docs/ai-handoff/latest-implementation.md` | 合理 | Low | 已把 realtime snapshots 明确列入 intentionally public，并说明 admin-web 没有安全 token/session/proxy path。 |
| `docs/skills/api-contract-skill.md` | 合理 | Low | 增加 admin protection header、route-map smoke expectation、realtime SSE public alpha payload 和 production hardening note。 |
| `docs/skills/auth-skill.md` | 合理 | Low | 明确 minimal guard 不是 production auth/RBAC，且 `ADMIN_API_TOKEN` 不应进入 browser code。 |
| `docs/skills/backend-skill.md` | 合理 | Low | 将 protected categories 与 public alpha categories 分开记录，包含 realtime snapshot 风险。 |
| `docs/skills/frontend-skill.md` | 合理 | Low | 记录 admin-web browser-only limitation 和 widget/realtime alpha note。 |
| `docs/skills/qa-skill.md` | 合理 | Low | 增加 route-map smoke checklist，适合后续 QA 复用。 |
| `docs/skills/current-status.md` | 合理 | Low | 当前 alpha 状态、split readiness、admin protection 残余风险记录到位。 |
| `docs/skills/decision-log.md` / `deployment-skill.md` / `project-summary.md` | 合理 | Low | 属于相关文档同步，未发现偏离。 |

## 4. 发现的问题

| 问题 | 严重程度 | 是否必须修 | 建议处理方式 |
| -- | ---- | ----- | ------ |
| 无必须修问题 | P2 nice to fix | 否 | 当前 follow-up 已覆盖 QA 指定文档缺口。 |

## 5. Regression 风险

本轮 follow-up 是文档更新，不改变运行时行为。原有残余风险仍然存在但已被正确记录：

- `GET /v1/realtime/conversations` 仍是 public alpha，会返回 tenant conversation snapshot。
- `apps/admin-web` 默认 token mode 下仍不能直接工作，除非 local dev 显式 disabled 或未来实现 server-side auth/proxy。
- 这不是 production auth/RBAC。

## 6. AI Chatbox 专项检查

本轮不涉及 AI chatbox 实现变更。

Customer chat/widget 行为保持 intact：

- 没有改 `apps/customer-widget`。
- 没有改 `POST /v1/chat/messages`。
- 没有改 handoff、conversation detail/read 或 realtime SSE 行为。
- 没有改 prompt、conversation history、provider、retrieval、citations、streaming 或 API key handling。

## 7. 验证建议

QA 本轮已执行：

- `Get-Content docs/ai-handoff/latest-qa.md`
- `Get-Content docs/ai-handoff/latest-implementation.md`
- `git diff --stat`
- `git diff --name-only`
- Focused `git diff` for `latest-implementation.md` and relevant `docs/skills/*`
- `git status --short --untracked-files=all`

由于本轮 follow-up 是文档-only，不需要重新跑 build/typecheck 作为 blocking 验证。

人工验收建议：

- 阅读 `docs/ai-handoff/latest-implementation.md` 的 “Intentionally public”、“QA follow-up documentation”、“Risks / Notes”。
- 阅读 `docs/skills/auth-skill.md` 和 `docs/skills/api-contract-skill.md`，确认 admin-web token 限制和 realtime public alpha 描述符合当前产品策略。

## 8. 是否需要更新 docs/skills

不需要额外更新。Codex 2 已经同步了相关 docs/skills：

- `docs/skills/api-contract-skill.md`
- `docs/skills/auth-skill.md`
- `docs/skills/backend-skill.md`
- `docs/skills/frontend-skill.md`
- `docs/skills/qa-skill.md`
- `docs/skills/current-status.md`
- `docs/skills/decision-log.md`
- `docs/skills/deployment-skill.md`
- `docs/skills/project-summary.md`

## 9. 给 Implementation Chat 的修复请求

No fix request required.
