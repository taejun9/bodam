Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "windows-installer-contract.psm1") -Force

$unknownMarker = "__TAURI_BUNDLE_TYPE_VAR_UNK"
$nsisMarker = "__TAURI_BUNDLE_TYPE_VAR_NSS"
$testRoot = Join-Path ([IO.Path]::GetTempPath()) "bodam-installer-identity-$([Guid]::NewGuid())"
$sourcePath = Join-Path $testRoot "source.bin"
$installedPath = Join-Path $testRoot "installed.bin"
$tamperRejected = $false

try {
  [IO.Directory]::CreateDirectory($testRoot) | Out-Null
  $sourceText = "prefix-$nsisMarker-$unknownMarker-suffix"
  $installedText = "prefix-$nsisMarker-$nsisMarker-suffix"
  [IO.File]::WriteAllBytes($sourcePath, [Text.Encoding]::ASCII.GetBytes($sourceText))
  [IO.File]::WriteAllBytes($installedPath, [Text.Encoding]::ASCII.GetBytes($installedText))
  Assert-BodamNsisPayloadIdentity -SourcePath $sourcePath -InstalledPath $installedPath

  [byte[]]$tampered = [IO.File]::ReadAllBytes($installedPath)
  $tampered[$tampered.Length - 1] = $tampered[$tampered.Length - 1] -bxor 1
  [IO.File]::WriteAllBytes($installedPath, $tampered)
  try {
    Assert-BodamNsisPayloadIdentity -SourcePath $sourcePath -InstalledPath $installedPath
  } catch {
    if ($_.Exception.Message -cne
        "installed executable differs outside the Tauri NSIS bundle marker") { throw }
    $tamperRejected = $true
  }
  if (-not $tamperRejected) { throw "tampered NSIS payload was accepted" }
} finally {
  if (Test-Path -LiteralPath $testRoot -PathType Container) {
    [IO.Directory]::Delete($testRoot, $true)
  }
}

Write-Output "BODAM Windows installer identity controls: PASS"
