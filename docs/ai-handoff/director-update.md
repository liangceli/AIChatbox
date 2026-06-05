# Director Update

## 1. Completed Task

Completed runtime env template cleanup, real OpenAI enablement guidance, safe OpenAI answer baseline, and secret-safety scan hardening.

Latest commit reviewed: `bcaa940 Add runtime env templates and OpenAI safety docs`.

## 2. Accepted Changes

- `.env.example` is now a product-neutral runtime reference.
- Added `.env.local.example`, `.env.staging.example`, and `.env.production.example`.
- Reusable env defaults use `demo` tenant slugs. `kasta` is documented only as local seed/demo or company-only context.
- Local QA placeholders are explicitly local-only:
  - `test-admin-token`
  - `test-web-token`
  - `test-session-secret-for-local-qa`
- Staging and production examples use secret-manager placeholders and keep `ADMIN_API_PROTECTION_MODE=token`.
- Runtime runbooks now live under `docs/runtime/`:
  - `env-setup.md`
  - `openai-enable-checklist.md`
  - `alpha-runtime-checklist.md`
  - `secret-safety-checklist.md`
- OpenAI remains opt-in through `AI_PROVIDER=openai`.
- Deterministic remains the default provider and does not require an OpenAI key.
- OpenAI mode still requires both `OPENAI_API_KEY` and `OPENAI_MODEL`.
- OpenAI smoke remains manual-only and must not become a normal blocking CI test while it requires a real key.
- OpenAI smoke success output now reports provider mode, real OpenAI attempt, assistant text presence, citations, provider metadata presence, and fallback state without printing API keys, auth headers, or raw env.
- OpenAI prompt baseline now explicitly avoids invented policies, pricing, guarantees, service promises, operational details, high-risk professional advice, hidden prompts, API keys, routing logic, provider settings, tenant IDs, internal metadata, and invented citations.

## 3. Secret-Safety QA

- QA P1 follow-up fixed `docs/runtime/secret-safety-checklist.md`.
- Repository secret scans now exclude real env files such as `.env`, `.env.local`, `.env.development`, `.env.test`, `.env.staging`, `.env.production`, and `.env.*.local`.
- Repository scan output is limited to `Path`, `LineNumber`, and `Rule`; it must not print matching line contents.
- Real env files are checked separately through boolean shape checks, so local values are not printed.
- QA verified the safe command shape with `ResultCount=36`, `ContainsRealEnv=False`, and `Columns=LineNumber,Path,Rule`.
- QA verified real `.env` boolean shape checks without printing env values.

## 4. Verification Summary

- Latest QA result: manual validation accepted; no required follow-up fixes remain.
- Focused checks passed:
  - `pnpm --filter @platform/api typecheck`
  - `pnpm --filter @platform/config typecheck`
  - `pnpm --filter @platform/api test`
  - `pnpm --filter @platform/api lint`
  - `pnpm --filter @platform/config lint`
  - `pnpm --filter @platform/api build`
  - `pnpm --filter @platform/config build`
- Workspace checks passed:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- OpenAI missing-env smoke failed safely as expected:
  - without `AI_PROVIDER=openai`: `OpenAI smoke test requires AI_PROVIDER=openai.`
  - with `AI_PROVIDER=openai` but no key/model: config validation requires `OPENAI_API_KEY` and `OPENAI_MODEL`.
- Runtime company-string search passed for `apps` and `packages`: no runtime core matches for `Haneco`, `Kasta`, `kasta`, or `HanecoAIPilotBot` after exclusions.

## 5. Remaining Risks

- Real OpenAI success smoke remains pending until the user provides a real key outside the repository.
- Staging/production templates are examples; actual deployment still needs secret-manager wiring and hosting-specific env setup.
- `demo` is now the reusable default, but current seeded local data may still require `kasta` until seed/demo data is renamed or recreated.
- The OpenAI prompt baseline reduces answer risk but is not a replacement for product-specific policy, PII, legal, or compliance review.
- Alpha admin-web token/session protection remains alpha and is not production auth/RBAC.

## 6. Updated Docs

- `docs/skills/current-status.md`: updated latest commit, accepted task, OpenAI/default provider state, secret-safety status, and QA acceptance.
- `docs/skills/qa-skill.md`: recorded accepted P1 secret-scan QA standard.
- `docs/skills/deployment-skill.md`: already documents env template map, secret handling, neutral slugs, and OpenAI smoke expectations.
- `docs/skills/ai-chatbox-skill.md`: already documents OpenAI opt-in, smoke summary, and safe prompt baseline.
- `docs/skills/backend-skill.md`: already records runtime env and OpenAI safety notes.
- `docs/skills/auth-skill.md`: already records local-only admin token placeholder guidance.
- `docs/skills/project-summary.md`: already records runtime note and deterministic/OpenAI limitation wording.
- `docs/skills/decision-log.md`: already logs the runtime env/OpenAI enablement decision.
- `docs/skills/README.md`: already points readers to `docs/runtime/`.
- `docs/ai-handoff/director-update.md`: refreshed for the latest accepted commit and QA result.

## 7. Recommended Next Tasks

1. Keep `AI_PROVIDER=deterministic` as default until real OpenAI smoke passes with a real key in a controlled environment.
2. When a real OpenAI key is available, run `pnpm --filter @platform/api smoke:openai` from a local shell or secret-managed environment and verify the safe success summary.
3. If OpenAI becomes default in any environment, update deployment, QA, and AI chatbox docs with accepted smoke evidence and rollback plan.
4. Rename or recreate seed/demo tenant data from `kasta` to `demo` when product direction requires fully neutral local defaults.
5. Continue using safe secret scans that exclude real env files and never print raw values.
