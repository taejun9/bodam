Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "windows-installer-contract.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "windows-host-safety.psm1") -Force
Assert-BodamHostedWindows
$projectRoot = Split-Path $PSScriptRoot -Parent
$contract = Get-BodamInstallerContract -Flavor E2E

function Assert-ExactSet {
  param([object[]]$Actual, [string[]]$Expected, [string]$Label)
  if (@(Compare-Object @($Expected) @($Actual)).Count -ne 0) {
    throw "$Label is not the exact approved set"
  }
}

function Assert-E2eBuildContract {
  $config = Get-Content -LiteralPath (Join-Path $projectRoot "src-tauri/tauri.e2e.conf.json") -Raw |
    ConvertFrom-Json
  if ($config.productName -cne "BODAM E2E" -or
      $config.identifier -cne "app.bodam.desktop.e2e" -or
      $config.bundle.windows.webviewInstallMode.type -cne "skip" -or
      $config.bundle.windows.nsis.installMode -cne "currentUser") {
    throw "E2E Tauri installer configuration is invalid"
  }
  $capability = Get-Content -LiteralPath (Join-Path $projectRoot "src-tauri/capabilities/e2e.json") -Raw |
    ConvertFrom-Json
  if ($capability.identifier -cne "e2e") { throw "E2E capability identifier is invalid" }
  Assert-ExactSet @($capability.windows) @("main") "E2E capability windows"
  Assert-ExactSet @($capability.permissions) @(
    "core:default", "core:window:allow-close", "wdio:default", "wdio-webdriver:default"
  ) "E2E permissions"

  $bundleDirectory = Split-Path $contract.InstallerPath -Parent
  $installers = @(Get-ChildItem -LiteralPath $bundleDirectory -File -Filter "*-setup.exe")
  if ($installers.Count -ne 1 -or
      -not [string]::Equals($installers[0].FullName, $contract.InstallerPath,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw "E2E NSIS output must contain the exact single private installer"
  }
  $scriptText = Get-Content -LiteralPath $contract.NsisScript -Raw
  if (-not $scriptText.Contains('!define INSTALLMODE "currentUser"') -or
      -not $scriptText.Contains('!define INSTALLWEBVIEW2MODE "skip"')) {
    throw "rendered E2E NSIS configuration is invalid"
  }
  if ((Get-AuthenticodeSignature -LiteralPath $contract.InstallerPath).Status.ToString() -cne "NotSigned") {
    throw "private E2E installer must remain unsigned"
  }
  Assert-BodamX64Pe -Path $contract.SourceBinary
}

function Assert-FixedNtfsTemp {
  $tempRoot = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($env:TEMP))
  if ($tempRoot -notmatch '^[A-Za-z]:\\$') { throw "E2E TEMP must be a local drive" }
  $device = $tempRoot.Substring(0, 2)
  $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$device'"
  if ($null -eq $disk -or $disk.DriveType -ne 3 -or $disk.FileSystem -cne "NTFS") {
    throw "installed backup E2E requires a fixed local NTFS TEMP volume"
  }
}

Assert-E2eBuildContract
Assert-FixedNtfsTemp
Assert-BodamUninstalled -Contract $contract
foreach ($path in @($contract.LocalAppData, $contract.RoamingAppData)) {
  if (Test-Path -LiteralPath $path) { throw "hosted runner contains stale BODAM E2E app-data" }
}

$installed = $false
$testPassed = $false
try {
  Invoke-BodamNsisInstall -Contract $contract | Out-Null
  $installed = $true
  Assert-BodamInstalled -Contract $contract
  $env:BODAM_E2E_APP_BINARY_PATH = $contract.InstalledBinary
  Push-Location $projectRoot
  try {
    & npm.cmd run test:e2e
    if ($LASTEXITCODE -ne 0) { throw "installed BODAM E2E suite failed" }
  } finally {
    Pop-Location
    Remove-Item Env:BODAM_E2E_APP_BINARY_PATH -ErrorAction SilentlyContinue
  }
  $residue = @(Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter "bodam-e2e-*" -ErrorAction SilentlyContinue)
  if ($residue.Count -ne 0) { throw "installed E2E left a synthetic runtime directory" }
  Invoke-BodamNsisUninstall -Contract $contract | Out-Null
  $installed = $false
  Assert-BodamUninstalled -Contract $contract
  $testPassed = $true
} finally {
  Remove-Item Env:BODAM_E2E_APP_BINARY_PATH -ErrorAction SilentlyContinue
  Remove-BodamCiResidue -Contract $contract
}
if (-not $testPassed -or $installed) { throw "installed E2E lifecycle did not complete" }
foreach ($path in @($contract.InstallDirectory, $contract.LocalAppData, $contract.RoamingAppData)) {
  if (Test-Path -LiteralPath $path) { throw "BODAM E2E cleanup left app-owned state" }
}
