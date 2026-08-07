Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$hostModule = Import-Module (Join-Path $PSScriptRoot "windows-host-safety.psm1") `
  -Force -PassThru
Assert-BodamHostedWindows

$testRoot = Join-Path $env:RUNNER_TEMP "bodam-cleanup-retry-$([Guid]::NewGuid())"
$persistentTree = Join-Path $testRoot "persistent"
$persistentFile = Join-Path $persistentTree "Rules/000003.log"
$transientTree = Join-Path $testRoot "transient"
$transientFile = Join-Path $transientTree "Rules/000003.log"
$readyFile = Join-Path $testRoot "transient-ready"
$foreignSentinel = Join-Path $testRoot "foreign-sentinel.txt"
$stream = $null
$holder = $null
$boundedFailure = $false
$providerErrorRejected = $false

try {
  New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
  $missingProbe = & $hostModule {
    param([string]$Path)
    Get-BodamCleanupItem -Path $Path
  } (Join-Path $testRoot "missing")
  if ($null -ne $missingProbe) { throw "missing cleanup probe returned an item" }
  try {
    & $hostModule {
      Get-BodamCleanupItem -Path "BodamMissingProviderDrive:\synthetic"
    } | Out-Null
  } catch [Management.Automation.DriveNotFoundException] {
    $providerErrorRejected = $true
  }
  if (-not $providerErrorRejected) {
    throw "cleanup probe accepted a non-not-found provider error"
  }
  [IO.File]::WriteAllText($foreignSentinel, "synthetic foreign sentinel")
  New-Item -ItemType Directory -Path (Split-Path $persistentFile -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($persistentFile, "synthetic persistent lock")
  $stream = [IO.File]::Open(
    $persistentFile,
    [IO.FileMode]::Open,
    [IO.FileAccess]::Read,
    [IO.FileShare]::None
  )
  $started = [DateTime]::UtcNow
  try {
    Remove-BodamOwnedTree -Root $testRoot -Path $persistentTree
  } catch {
    if ($_.Exception.Message -cne "CI cleanup target remained locked after bounded retries") {
      throw
    }
    $boundedFailure = $true
  }
  $boundedSeconds = ([DateTime]::UtcNow - $started).TotalSeconds
  if (-not $boundedFailure -or $boundedSeconds -lt 3 -or $boundedSeconds -gt 8) {
    throw "persistent cleanup lock control did not fail within its bound"
  }
  if (-not (Test-Path -LiteralPath $persistentFile -PathType Leaf)) {
    throw "persistent cleanup lock control did not preserve the locked file"
  }
  $stream.Dispose()
  $stream = $null
  Remove-BodamOwnedTree -Root $testRoot -Path $persistentTree

  New-Item -ItemType Directory -Path (Split-Path $transientFile -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($transientFile, "synthetic transient lock")
  $holder = Start-Job -ScriptBlock {
    param([string]$Path, [string]$ReadyPath)
    $held = [IO.File]::Open(
      $Path,
      [IO.FileMode]::Open,
      [IO.FileAccess]::Read,
      [IO.FileShare]::None
    )
    try {
      [IO.File]::WriteAllText($ReadyPath, "ready")
      Start-Sleep -Milliseconds 750
    } finally {
      $held.Dispose()
    }
  } -ArgumentList $transientFile, $readyFile
  $readyDeadline = [DateTime]::UtcNow.AddSeconds(10)
  while (-not (Test-Path -LiteralPath $readyFile -PathType Leaf) -and
      [DateTime]::UtcNow -lt $readyDeadline -and $holder.State -notin @("Failed", "Stopped")) {
    Start-Sleep -Milliseconds 50
  }
  if (-not (Test-Path -LiteralPath $readyFile -PathType Leaf)) {
    throw "transient cleanup lock control did not acquire its synthetic lock"
  }
  Remove-BodamOwnedTree -Root $testRoot -Path $transientTree
  Wait-Job -Job $holder -Timeout 10 | Out-Null
  if ($holder.State -cne "Completed" -or (Test-Path -LiteralPath $transientTree)) {
    throw "transient cleanup lock control did not recover after handle release"
  }
  if ([IO.File]::ReadAllText($foreignSentinel) -cne "synthetic foreign sentinel") {
    throw "transient cleanup lock control changed a sibling sentinel"
  }
} finally {
  if ($null -ne $stream) { $stream.Dispose() }
  if ($null -ne $holder) {
    if ($holder.State -notin @("Completed", "Failed", "Stopped")) {
      Stop-Job -Job $holder -ErrorAction SilentlyContinue
    }
    Remove-Job -Job $holder -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $testRoot) {
    Remove-BodamOwnedTree -Root $env:RUNNER_TEMP -Path $testRoot
  }
}

Write-Output "BODAM Windows bounded cleanup retry controls: PASS"
