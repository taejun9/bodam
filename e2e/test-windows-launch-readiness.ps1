Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "windows-host-safety.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "windows-launch-readiness.psm1") -Force
Assert-BodamHostedWindows

function Assert-ReadinessResult {
  param([pscustomobject]$Contract, [bool]$Expected, [string]$Label)
  if ((Test-BodamProductionDataReady -Contract $Contract) -ne $Expected) {
    throw "production launch readiness control failed: $Label"
  }
}

$testRoot = Join-Path $env:RUNNER_TEMP "bodam-launch-readiness-$([Guid]::NewGuid())"
$local = Join-Path $testRoot "local"
$roaming = Join-Path $testRoot "roaming"
$foreign = Join-Path $testRoot "foreign"
$database = Join-Path $roaming "bodam.sqlite3"
$backups = Join-Path $roaming "backups"
$workspace = Join-Path $roaming "backup-work"
$dailyName = "BODAM-daily-20260807T010203004Z-12345678-1234-4123-8123-123456789abc.bodam-backup"
$dailyBackup = Join-Path $backups $dailyName
$contract = [pscustomobject]@{
  LocalAppData = $local
  RoamingAppData = $roaming
  DatabasePath = $database
  BackupDirectory = $backups
  WorkspaceDirectory = $workspace
}

try {
  Assert-ReadinessResult $contract $false "absent"
  New-Item -ItemType Directory -Path $local -Force | Out-Null
  [IO.File]::WriteAllBytes((Join-Path $local "bodam.sqlite3"), [byte[]]@(1, 2, 3, 4))
  Assert-ReadinessResult $contract $false "local-only"

  New-Item -ItemType Directory -Path $roaming -Force | Out-Null
  Assert-ReadinessResult $contract $false "directory-only"
  [IO.File]::WriteAllBytes((Join-Path $roaming "wrong.sqlite3"), [byte[]]@(1))
  Assert-ReadinessResult $contract $false "wrong-basename"
  [IO.File]::WriteAllBytes($database, [byte[]]@())
  Assert-ReadinessResult $contract $false "zero-byte"
  [IO.File]::WriteAllBytes($database, [byte[]]@(1, 2, 3, 4))
  Assert-ReadinessResult $contract $false "database-only"
  New-Item -ItemType Directory -Path $backups -Force | Out-Null
  [IO.File]::WriteAllBytes($dailyBackup, [byte[]]@())
  Assert-ReadinessResult $contract $false "zero-byte-daily-backup"
  [IO.File]::WriteAllBytes($dailyBackup, [byte[]]@(1, 2, 3, 4))
  Assert-ReadinessResult $contract $false "missing-workspace"
  New-Item -ItemType Directory -Path $workspace -Force | Out-Null
  Assert-ReadinessResult $contract $true "database-and-daily-backup"
  [IO.File]::WriteAllBytes($database, [byte[]]@())
  Assert-ReadinessResult $contract $false "ready-zero-byte-database"
  [IO.File]::WriteAllBytes($database, [byte[]]@(1, 2, 3, 4))
  [IO.File]::WriteAllBytes($dailyBackup, [byte[]]@())
  Assert-ReadinessResult $contract $false "ready-zero-byte-daily-backup"
  [IO.File]::WriteAllBytes($dailyBackup, [byte[]]@(1, 2, 3, 4))
  Assert-ReadinessResult $contract $true "restored-database-and-daily-backup"
  [IO.File]::WriteAllBytes((Join-Path $workspace "unfinished"), [byte[]]@(1))
  Assert-ReadinessResult $contract $false "nonempty-workspace"
  [IO.File]::Delete((Join-Path $workspace "unfinished"))

  [IO.File]::Delete($database)
  [IO.Directory]::CreateDirectory($database) | Out-Null
  Assert-ReadinessResult $contract $false "database-directory"
  [IO.Directory]::Delete($database)
  Remove-BodamOwnedTree -Root $testRoot -Path $roaming
  New-Item -ItemType Directory -Path $foreign -Force | Out-Null
  [IO.File]::WriteAllBytes((Join-Path $foreign "bodam.sqlite3"), [byte[]]@(1, 2, 3, 4))
  $foreignBackups = Join-Path $foreign "backups"
  New-Item -ItemType Directory -Path $foreignBackups -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $foreign "backup-work") -Force | Out-Null
  [IO.File]::WriteAllBytes(
    (Join-Path $foreignBackups $dailyName),
    [byte[]]@(1, 2, 3, 4)
  )
  $command = "mklink /J `"$roaming`" `"$foreign`""
  & cmd.exe /D /C $command 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "launch readiness junction setup failed" }
  Assert-ReadinessResult $contract $false "roaming-reparse"
} finally {
  $roamingItem = Get-Item -LiteralPath $roaming -Force -ErrorAction SilentlyContinue
  if ($null -ne $roamingItem -and
      ($roamingItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    [IO.Directory]::Delete($roaming)
  }
  Remove-BodamOwnedTree -Root $env:RUNNER_TEMP -Path $testRoot
}

Write-Output "BODAM production launch readiness controls: PASS"
