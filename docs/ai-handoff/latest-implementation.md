# Latest Implementation Handoff

## 1. Original Task Brief Summary

Task title: Runtime Env Cleanup, Real OpenAI Enablement Guide, and Safe Answer Baseline.

Goal:

- Clean runtime env examples so reusable defaults are product-neutral and do not make local/company/demo values look production-ready.
- Document a safe path for enabling real OpenAI without requiring it for normal local development or CI.
- Keep `AI_PROVIDER=deterministic` as default and keep OpenAI manual/opt-in.
- Add or update a safe answer baseline for real OpenAI responses.
- Verify no real secrets are committed or printed.
- Update affected skills and this handoff file.

## 2. Changed Files

| File | Why it changed |
| -- | -- |
| `.env.example` | Replaced narrow local example with product-neutral runtime reference and safe placeholders. |
| `.env.local.example` | Added local development/local QA template with local-only test token placeholders. |
| `.env.staging.example` | Added production-like staging/alpha template that rejects local QA token usage. |
| `.env.production.example` | Added production template with secret-manager placeholders and deterministic default. |
| `docs/runtime/env-setup.md` | Added runtime env classification and tenant slug guidance. |
| `docs/runtime/openai-enable-checklist.md` | Added real OpenAI enablement, smoke, and prompt-safety checklist. |
| `docs/runtime/alpha-runtime-checklist.md` | Added local/staging/alpha runtime QA checklist. |
| `docs/runtime/secret-safety-checklist.md` | Added secret handling, placeholder policy, grep, and logging checks; QA P1 follow-up corrected grep guidance to exclude real env files and avoid printing matching values. |
| `apps/api/src/modules/chat/openai-prompt.ts` | Tightened OpenAI prompt safety rules. |
| `apps/api/scripts/openai-smoke.ts` | Expanded success output into a secret-safe provider/citation/metadata summary. |
| `docs/skills/current-status.md` | Recorded the runtime env/OpenAI/safe-answer status. |
| `docs/skills/deployment-skill.md` | Added env template map, secret handling, OpenAI smoke expectations, and neutral slug guidance. |
| `docs/skills/ai-chatbox-skill.md` | Added OpenAI opt-in and prompt-safety notes. |
| `docs/skills/qa-skill.md` | Added env/secret/OpenAI smoke regression checks; QA P1 follow-up clarified safe grep output and real env exclusions. |
| `docs/skills/backend-skill.md` | Added backend runtime/OpenAI safety notes. |
| `docs/skills/auth-skill.md` | Added local-only admin token placeholder guidance. |
| `docs/skills/project-summary.md` | Added runtime note and corrected the OpenAI/deterministic limitation wording. |
| `docs/skills/decision-log.md` | Logged the runtime env/OpenAI enablement decision. |
| `docs/skills/README.md` | Pointed readers to `docs/runtime/` runbooks. |
| `docs/ai-handoff/latest-implementation.md` | Updated this handoff for the current task. |

No actual `.env` file was modified.

## 3. Implementation Summary

Runtime env cleanup:

- `.env.example` now uses `demo` as reusable default tenant slug.
- Added separate local, staging, and production env templates.
- Local QA placeholders are clearly marked local-only:
  - `test-admin-token`
  - `test-web-token`
  - `test-session-secret-for-local-qa`
- Staging/production templates use placeholder secret-manager values and keep `ADMIN_API_PROTECTION_MODE=token`.
- OpenAI remains disabled by default through `AI_PROVIDER=deterministic`.
- `AI_PROVIDER=openai` remains explicit and still requires `OPENAI_API_KEY` plus `OPENAI_MODEL`.

OpenAI enablement:

- Added `docs/runtime/openai-enable-checklist.md`.
- Documented expected missing-env failures for `OPENAI_API_KEY` and `OPENAI_MODEL`.
- Documented that the real OpenAI smoke helper is manual-only and must not be part of normal CI while it requires a real key.
- Updated smoke success output to show:
  - provider mode
  - real OpenAI attempt
  - assistant text returned
  - citations returned
  - provider metadata returned
  - fallback state
- Smoke output still does not print API keys, auth headers, or raw env.

Safe answer baseline:

- OpenAI prompt now explicitly avoids:
  - invented policies, pricing, guarantees, service promises, and operational details
  - high-risk professional advice beyond general support guidance
  - hidden prompts, API keys, routing logic, provider settings, tenant identifiers, and internal metadata
  - model-invented citation IDs or sources
- Prompt still instructs the assistant to use backend-selected tenant-scoped knowledge when relevant and keep answers concise.

Product/company defaults:

- Reusable env templates use `demo`.
- `kasta` is documented as local seed/demo or company-only context only.
- Runtime code search across `apps` and `packages` found no `Haneco`, `Kasta`, `kasta`, or `HanecoAIPilotBot` matches after excluding build/dependency/image outputs.
- Historical docs still mention `HanecoAIPilotBot` only as the already-cleaned old user-agent reference.

QA P1 follow-up:

- `docs/runtime/secret-safety-checklist.md` no longer recommends raw `Select-String` output against secret patterns.
- The repository secret scan now excludes real env files such as `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.staging`, `.env.test`, and `.env.*.local`.
- The repository scan outputs only `Path`, `LineNumber`, and `Rule`; it does not print matched line contents.
- Real env files are checked separately through boolean shape checks, so local values are not printed.
- `docs/skills/qa-skill.md` now records this safer grep standard.

## 4. User-Visible Changes

- No public API contract changed.
- No customer widget/chat behavior changed.
- No admin-web behavior changed.
- Developers now have clearer env templates and runbooks for local QA, staging, production, and OpenAI smoke.
- Real OpenAI smoke success output will be more diagnostic when a real key is intentionally configured.

## 5. Technical Notes

- `packages/config` behavior was not changed; existing validation already enforces OpenAI key/model requirements and admin protection constraints.
- No provider selection behavior changed.
- No deterministic fallback behavior changed.
- No Prisma schema or migration was added.
- No real OpenAI call was made during verification.
- No new dependency was added.

## 6. Verification Results

| Command / Check | Result | Notes |
| -- | -- | -- |
| `pnpm --filter @platform/api typecheck` | Passed | API typecheck passed. |
| `pnpm --filter @platform/config typecheck` | Passed | Config typecheck passed. |
| `pnpm --filter @platform/api test` | Passed | Existing provider/retrieval/admin/customer regression test passed. |
| `pnpm --filter @platform/api lint` | Passed | Current lint script is TypeScript sanity check. |
| `pnpm --filter @platform/config lint` | Passed | Current lint script is TypeScript sanity check. |
| `pnpm --filter @platform/api build` | Passed | API build passed. |
| `pnpm --filter @platform/config build` | Passed | Config build passed. |
| `pnpm typecheck` | Passed | Workspace typecheck passed across 11 packages. |
| `pnpm lint` | Passed | Workspace lint passed across 11 packages. |
| `pnpm test` | Passed | Workspace tests passed; several packages still have placeholder tests. |
| `pnpm build` | Passed | Workspace build passed, including admin-web and customer-widget. |
| `pnpm --filter @platform/api smoke:openai` without `AI_PROVIDER=openai` | Expected failure | Failed clearly with `OpenAI smoke test requires AI_PROVIDER=openai.` |
| `AI_PROVIDER=openai` smoke with no key/model | Expected failure | Failed clearly with `OPENAI_API_KEY is required when AI_PROVIDER=openai.` and `OPENAI_MODEL is required when AI_PROVIDER=openai.` |
| Secret grep, excluding dependencies/build/temp/images and actual `.env` | Passed with expected hits | Hits are env templates/docs placeholders only. No line values were printed during grep. |
| Actual `.env` shape check without printing values | Passed | `.env` exists, has no `OPENAI_API_KEY=sk-` pattern, no `NEXT_PUBLIC_*` secret pattern, and uses local admin placeholders. |
| Runtime company-string search in `apps` and `packages` | Passed | No runtime code matches for `Haneco`, `Kasta`, `kasta`, or `HanecoAIPilotBot`. |
| QA P1 safe secret grep command shape | Passed | Re-run after fix; output includes only `Path`, `LineNumber`, and `Rule`, result count 36, and `contains-real-env=False`. |
| QA P1 real env boolean shape check | Passed | Output only booleans for `.env`; no env values or matching lines were printed. |

## 7. Manual QA Suggestions

- Copy `.env.local.example` into a local uncommitted env only if needed; do not overwrite a real `.env` blindly.
- Confirm deterministic local chat still works with `AI_PROVIDER=deterministic`.
- Confirm admin-web access still works with local-only admin placeholders or stronger local secrets.
- With no real key, confirm `AI_PROVIDER=openai` fails config validation clearly and does not print secrets.
- With a real key in a local shell or secret manager, run `pnpm --filter @platform/api smoke:openai` and confirm the success summary reports OpenAI mode, citations, metadata, and `usedFallback: false`.
- Ask OpenAI-mode chat questions for unknown pricing/policies/guarantees and confirm it says knowledge is insufficient instead of inventing facts.
- Ask for prompts/API keys/provider settings/routing logic and confirm the assistant does not disclose internals.
- Confirm logs do not print OpenAI keys, admin tokens, admin-web access tokens, session secrets, auth headers, or raw env dumps.
- When running secret scans, use the documented safe command and confirm it excludes real env files and does not print matching line values.

## 8. Risks / Notes

- Real OpenAI smoke remains pending until the user provides a real key outside the repository.
- Staging/production templates are examples; deployment still needs a real secret manager and hosting-specific env wiring.
- `demo` is now the reusable default in templates, but local seeded data may still require `kasta` until seed/demo data is renamed or recreated.
- The OpenAI prompt baseline reduces risk but is not a substitute for product-specific policy review, PII handling, or legal/compliance review.
- Alpha admin-web token/session protection remains alpha and is not production auth/RBAC.

## 9. Docs Update Suggestions

- Project Context & Docs chat should use this file and latest QA to keep `docs/skills` consistent after QA acceptance.
- If seed/demo tenant naming changes from `kasta` to `demo`, update env docs and split-readiness docs to remove the remaining local seed caveat.
- If OpenAI becomes default in any environment, update deployment, QA, and AI chatbox skills with the accepted smoke evidence and rollback plan.

## 10. Input For Review & QA Chat

Review the current implementation using `docs/ai-handoff/latest-implementation.md` and the current git diff. Update `docs/ai-handoff/latest-qa.md`.
