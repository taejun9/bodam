Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$powershellFiles = @(
  Get-ChildItem -LiteralPath $PSScriptRoot -File -Recurse |
    Where-Object { $_.Extension -in @(".ps1", ".psm1") }
)
foreach ($path in $powershellFiles) {
  $tokens = $null
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile(
    $path.FullName,
    [ref]$tokens,
    [ref]$parseErrors
  ) | Out-Null
  if ($parseErrors.Count -ne 0) {
    throw "PowerShell syntax contract failed for $($path.Name)"
  }
}

Import-Module (Join-Path $PSScriptRoot "windows-host-safety.psm1") -Force
Assert-BodamHostedWindows

$testRoot = Join-Path $env:RUNNER_TEMP "bodam-host-safety-$([Guid]::NewGuid())"
$owned = Join-Path $testRoot "owned"
$nested = Join-Path $owned "nested"
$foreign = Join-Path $testRoot "foreign"
$junction = Join-Path $nested "linked"
$sentinel = Join-Path $foreign "sentinel.txt"
$rejected = $false

try {
  New-Item -ItemType Directory -Path $nested -Force | Out-Null
  New-Item -ItemType Directory -Path $foreign -Force | Out-Null
  [IO.File]::WriteAllText($sentinel, "synthetic sentinel")
  $command = "mklink /J `"$junction`" `"$foreign`""
  & cmd.exe /D /C $command 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "junction negative-control setup failed" }

  try {
    Remove-BodamOwnedTree -Root $testRoot -Path $owned
  } catch {
    if ($_.Exception.Message -cne "CI cleanup tree contains a nested reparse point") { throw }
    $rejected = $true
  }
  if (-not $rejected) { throw "nested reparse cleanup guard did not reject the owned tree" }
  if (-not (Test-Path -LiteralPath $sentinel -PathType Leaf) -or
      [IO.File]::ReadAllText($sentinel) -cne "synthetic sentinel") {
    throw "nested reparse cleanup guard did not preserve the foreign sentinel"
  }
} finally {
  if ($null -ne (Get-Item -LiteralPath $junction -Force -ErrorAction SilentlyContinue)) {
    [IO.Directory]::Delete($junction)
  }
  if ($null -ne (Get-Item -LiteralPath $owned -Force -ErrorAction SilentlyContinue)) {
    Remove-BodamOwnedTree -Root $testRoot -Path $owned
  }
  if ($null -ne (Get-Item -LiteralPath $foreign -Force -ErrorAction SilentlyContinue)) {
    Remove-BodamOwnedTree -Root $testRoot -Path $foreign
  }
  Remove-BodamOwnedTree -Root $env:RUNNER_TEMP -Path $testRoot
}

& (Join-Path $PSScriptRoot "test-windows-installer-identity.ps1")
Write-Output "BODAM hosted cleanup safety controls: PASS"
