param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
trap {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$adminWebRoot = Join-Path $repoRoot "apps/admin-web"
$envPath = Join-Path $repoRoot ".env"

if (-not (Test-Path $envPath)) {
  throw "Root .env was not found. Create an uncommitted .env before running this smoke check."
}

$tokenLine = Get-Content -Path $envPath |
  Where-Object { $_ -match "^\s*ADMIN_WEB_ACCESS_TOKEN=" } |
  Select-Object -First 1

if (-not $tokenLine) {
  throw "ADMIN_WEB_ACCESS_TOKEN is missing from root .env."
}

$accessToken = ($tokenLine -replace "^\s*ADMIN_WEB_ACCESS_TOKEN=", "").Trim().Trim('"').Trim("'")

if (-not $accessToken) {
  throw "ADMIN_WEB_ACCESS_TOKEN is empty in root .env."
}

$pnpmCommand = Get-Command pnpm.cmd -ErrorAction SilentlyContinue

if (-not $pnpmCommand) {
  $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
}

if (-not $pnpmCommand) {
  throw "pnpm is not available. Run Corepack setup from docs/runtime/local-dev-checklist.md, then retry."
}

$baseUrl = "http://localhost:$Port"
$accessPageUrl = "$baseUrl/admin/access"
$accessApiUrl = "$baseUrl/api/admin/access"
$startedProcess = $null
$stdoutPath = Join-Path $env:TEMP "admin-web-smoke.out.log"
$stderrPath = Join-Path $env:TEMP "admin-web-smoke.err.log"

function Test-AdminWebReady {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $accessPageUrl -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-TcpPortOpen {
  param(
    [int]$TargetPort
  )

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connect = $client.BeginConnect("127.0.0.1", $TargetPort, $null, $null)
    if (-not $connect.AsyncWaitHandle.WaitOne(500, $false)) {
      return $false
    }

    $client.EndConnect($connect)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Get-LogTail {
  param(
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return "(log file not created)"
  }

  $tail = Get-Content -Path $Path -Tail 20 -ErrorAction SilentlyContinue
  if (-not $tail) {
    return "(log file is empty)"
  }

  return ($tail -join [Environment]::NewLine)
}

function Stop-StartedProcessTree {
  param(
    [System.Diagnostics.Process]$Process
  )

  if (-not $Process -or $Process.HasExited) {
    return
  }

  & taskkill.exe /PID $Process.Id /T /F > $null 2>&1
  if ($LASTEXITCODE -ne 0 -and -not $Process.HasExited) {
    Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
  }
}

try {
  if (-not (Test-AdminWebReady)) {
    if (Test-TcpPortOpen -TargetPort $Port) {
      throw "Port $Port is already in use, but $accessPageUrl did not return the admin-web access page. Stop the process using port $Port or rerun this smoke with a free -Port value. This smoke intentionally does not follow Next.js auto-selected fallback ports."
    }

    Remove-Item -Force $stdoutPath, $stderrPath -ErrorAction SilentlyContinue

    $startedProcess = Start-Process `
      -FilePath $pnpmCommand.Source `
      -ArgumentList @("exec", "next", "dev", "--port", "$Port") `
      -WorkingDirectory $adminWebRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath `
      -PassThru

    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
      Start-Sleep -Milliseconds 750
      if ($startedProcess.HasExited) {
        $stdoutTail = Get-LogTail -Path $stdoutPath
        $stderrTail = Get-LogTail -Path $stderrPath
        throw "Admin-web dev server exited before $accessPageUrl became ready. ExitCode=$($startedProcess.ExitCode). StdoutTail=$stdoutTail StderrTail=$stderrTail"
      }

      if (Test-AdminWebReady) {
        $ready = $true
        break
      }
    }

    if (-not $ready) {
      $portOpen = Test-TcpPortOpen -TargetPort $Port
      $stdoutTail = Get-LogTail -Path $stdoutPath
      $stderrTail = Get-LogTail -Path $stderrPath
      throw "Admin-web did not become ready at $accessPageUrl after 30 seconds. PortOpen=$portOpen. StdoutTail=$stdoutTail StderrTail=$stderrTail"
    }
  }

  $body = @{ token = $accessToken } | ConvertTo-Json -Compress
  $unlockResponse = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Post `
    -Uri $accessApiUrl `
    -ContentType "application/json" `
    -Body $body `
    -TimeoutSec 5

  Write-Output "admin-access-status=$($unlockResponse.StatusCode)"
} finally {
  Stop-StartedProcessTree -Process $startedProcess
}
