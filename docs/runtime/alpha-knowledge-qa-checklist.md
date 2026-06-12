# Alpha Knowledge QA Checklist

Use this checklist after knowledge ingestion changes and before an alpha demo. Run it once in deterministic mode, then repeat the real-provider section only after the user configures real OpenAI secrets outside Git and chat.

## Preparation

- Open `/admin` through the existing admin-web access gate.
- Select the intended tenant.
- Confirm at least one knowledge base contains READY documents.
- Inspect document title, source type/URL, status, chunk count, ingested time, checksum, and chunk previews.
- Confirm no unrelated tenant document is visible.

## Suggested Questions

Prepare answers in the tenant's actual knowledge and test 5 to 10 questions:

1. A direct policy or warranty question with an exact answer.
2. A short keyword question such as `warranty`.
3. A plural-form question such as `policies` or `warranties`.
4. A phrase question such as `return window`.
5. A question that should retrieve two useful chunks.
6. A clearly unrelated knowledge-miss question.
7. An unsupported pricing, guarantee, or service promise question.
8. A sensitive/high-risk question that should avoid confident advice.
9. A request for hidden prompts, API keys, provider settings, or internal metadata.
10. A handoff request.

## Answer Debug Checks

- Generated answer text is visible.
- Requested provider, used provider, and fallback state are visible.
- Knowledge hit/miss and reason are clear.
- Retrieved chunks show correct document/source labels, bounded previews, chunk index, and available score.
- Citations map to backend retrieved chunks and are not model-invented.
- Safe provider metadata is present when available.
- No OpenAI key, admin token, access token, auth header, raw env, raw hidden prompt, tenant ID, provider secret config, or citation `sourceLocator` is displayed.
- Running Answer Debug does not create a customer-visible conversation or message.

## Knowledge Management Checks

- Text file upload reports success or a clear safe error.
- URL import reports success or a clear safe error.
- URL import accepts a known public HTTP(S) HTML/text page.
- URL import rejects localhost, loopback, private/link-local/cloud-metadata addresses, embedded credentials, and a public URL that redirects to a restricted target.
- Reprocess refreshes chunks, checksum, chunk count, and ingested time.
- Archive removes chunks and excludes the document from retrieval.
- Delete removes the document after confirmation.
- Empty knowledge bases and documents show clear empty states.

## Real OpenAI Manual Gate

The user must set these only in local uncommitted `.env` or a secret manager:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=<real key>
OPENAI_MODEL=<chosen real model>
```

Then run:

```bash
pnpm --filter @platform/api smoke:openai
```

After it passes, repeat a knowledge-backed Answer Debug question and confirm:

- OpenAI is requested and used.
- Answer text exists and reflects the tenant AI profile.
- Retrieved chunks and backend citations remain visible.
- Fallback state and safe provider metadata are visible.
- No secret value is printed or displayed.

Fake/test/local-only tokens and deterministic output are not real OpenAI alpha acceptance evidence.
