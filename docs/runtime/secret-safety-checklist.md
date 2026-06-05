# Secret Safety Checklist

Run this review before sharing diffs, creating a PR, or enabling OpenAI/admin protection in an environment.

## Values That Must Stay Secret

- `OPENAI_API_KEY`
- `ADMIN_API_TOKEN`
- `ADMIN_WEB_ACCESS_TOKEN`
- `ADMIN_WEB_SESSION_SECRET`
- auth headers
- bearer tokens
- database credentials outside examples/placeholders

Never expose these through:

- `NEXT_PUBLIC_*`
- browser bundles
- localStorage/sessionStorage
- API responses
- client logs
- server logs
- docs with real values

## Placeholder Policy

Allowed in templates/docs when clearly marked:

- `replace-with-strong-random-admin-api-token`
- `replace-with-strong-random-admin-web-access-token`
- `replace-with-strong-random-session-secret`
- `test-admin-token` for local QA only
- `test-web-token` for local QA only
- `test-session-secret-for-local-qa` for local QA only

Not allowed:

- real OpenAI keys
- real admin tokens
- production/staging token values
- real customer or tenant secrets

## Search Checks

From the repo root, exclude dependency/build/temp folders and real env files. This command intentionally prints only file path, line number, and rule name. It must not print matching line values:

```powershell
$rules = @(
  @{ Name = "openai-key-shape"; Pattern = "sk-[A-Za-z0-9_-]{20,}" },
  @{ Name = "openai-key-assignment"; Pattern = "OPENAI_API_KEY=" },
  @{ Name = "next-public-token"; Pattern = "NEXT_PUBLIC_.*TOKEN" },
  @{ Name = "next-public-openai"; Pattern = "NEXT_PUBLIC_OPENAI" },
  @{ Name = "admin-api-token-assignment"; Pattern = "ADMIN_API_TOKEN=" },
  @{ Name = "admin-web-access-token-assignment"; Pattern = "ADMIN_WEB_ACCESS_TOKEN=" },
  @{ Name = "admin-web-session-secret-assignment"; Pattern = "ADMIN_WEB_SESSION_SECRET=" }
)

$files = Get-ChildItem -Recurse -File |
  Where-Object {
    $_.FullName -notmatch '\\node_modules\\|\\.git\\|\\.next\\|\\dist\\|\\tmp\\|\\.turbo\\' -and
    $_.Extension -notmatch '^\.(png|jpg|jpeg|webp|gif|ico)$' -and
    $_.Name -notmatch '^\.env($|\.local$|\.(development|test|staging|production)$|\..*\.local$)'
  }

foreach ($rule in $rules) {
  $files |
    Select-String -Pattern $rule.Pattern |
    ForEach-Object {
      [pscustomobject]@{
        Path = $_.Path
        LineNumber = $_.LineNumber
        Rule = $rule.Name
      }
    }
}
```

Expected hits are limited to templates/docs with placeholders and server-side config references. Any real-looking secret must be removed and rotated before continuing.

Do not run raw `Select-String` output against real env files because it prints matching line contents by default. If real env files must be checked locally, use a boolean shape check or masked output that never prints values:

```powershell
$envFiles = @(
  ".env",
  ".env.local",
  ".env.development",
  ".env.test",
  ".env.staging",
  ".env.production",
  ".env.development.local",
  ".env.test.local",
  ".env.staging.local",
  ".env.production.local"
) | Where-Object { Test-Path $_ }

foreach ($path in $envFiles) {
  $content = Get-Content -Path $path

  [pscustomobject]@{
    Path = $path
    HasOpenAiKeyShape = [bool]($content | Where-Object { $_ -match '^OPENAI_API_KEY=sk-' })
    HasNextPublicSecret = [bool]($content | Where-Object { $_ -match '^NEXT_PUBLIC_.*(TOKEN|KEY|SECRET)=' })
    HasLocalAdminPlaceholders = [bool]($content | Where-Object {
      $_ -match '^(ADMIN_API_TOKEN=test-admin-token|ADMIN_WEB_ACCESS_TOKEN=test-web-token|ADMIN_WEB_SESSION_SECRET=test-session-secret-for-local-qa)$'
    })
  }
}
```

## Runtime Logging

OpenAI smoke, provider metadata, admin proxy, and config validation must not log raw keys, bearer tokens, auth headers, or full env dumps.

If a secret appears in output:

1. remove the log or redact the value
2. rotate the secret
3. rerun the search checks
4. document the incident in the relevant QA handoff
