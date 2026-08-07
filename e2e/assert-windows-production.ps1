Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "windows-installer-contract.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "windows-host-safety.psm1") -Force
Assert-BodamHostedWindows
$projectRoot = Split-Path $PSScriptRoot -Parent
$contract = Get-BodamInstallerContract -Flavor Production
$markers = @(
  "BODAM_E2E_DB_PATH",
  "BODAM_E2E_BACKUP_DIRECTORY",
  "BODAM_E2E_RESTORE_FILE",
  "BODAM_E2E_IMPORT_PATH",
  "BODAM_E2E_EXPORT_PATH",
  "BODAM_E2E_PHASE_MARKER",
  "tauri-plugin-wdio",
  "wdio-webdriver",
  "127.0.0.1:4445",
  "bodam:e2e-"
)

function Assert-ExactStringArray {
  param([object[]]$Actual, [string[]]$Expected, [string]$Label)
  $difference = @(Compare-Object @($Expected) @($Actual))
  if ($difference.Count -ne 0) { throw "$Label is not the exact approved set" }
}

function Assert-ProductionSourceContract {
  $configPath = Join-Path $projectRoot "src-tauri/tauri.conf.json"
  $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if ($config.productName -cne "BODAM" -or $config.identifier -cne "app.bodam.desktop" -or
      $config.version -cne "0.1.0" -or
      $config.bundle.windows.webviewInstallMode.type -cne "offlineInstaller" -or
      $config.bundle.windows.nsis.installMode -cne "currentUser") {
    throw "production Tauri installer configuration is invalid"
  }

  $capabilityPath = Join-Path $projectRoot "src-tauri/capabilities/default.json"
  $capability = Get-Content -LiteralPath $capabilityPath -Raw | ConvertFrom-Json
  if ($capability.identifier -cne "default") { throw "production capability identifier is invalid" }
  Assert-ExactStringArray @($capability.windows) @("main") "production capability windows"
  Assert-ExactStringArray @($capability.permissions) @("core:default") "production permissions"

  $buildScript = Get-Content -LiteralPath (Join-Path $projectRoot "src-tauri/build.rs") -Raw
  foreach ($required in @(
    'CARGO_FEATURE_E2E', 'capabilities/e2e.json', 'capabilities/default.json',
    'capabilities_path_pattern(capability)'
  )) {
    if (-not $buildScript.Contains($required)) { throw "build.rs capability feature split is invalid" }
  }
}

function Assert-NsisBuildContract {
  $bundleDirectory = Split-Path $contract.InstallerPath -Parent
  $installers = @(Get-ChildItem -LiteralPath $bundleDirectory -File -Filter "*-setup.exe")
  if ($installers.Count -ne 1 -or
      -not [string]::Equals($installers[0].FullName, $contract.InstallerPath,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw "production NSIS output must contain the exact single installer"
  }
  $scriptText = Get-Content -LiteralPath $contract.NsisScript -Raw
  if (-not $scriptText.Contains('!define INSTALLMODE "currentUser"') -or
      -not $scriptText.Contains('!define INSTALLWEBVIEW2MODE "offlineInstaller"')) {
    throw "rendered production NSIS configuration is invalid"
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $contract.InstallerPath
  if ($signature.Status.ToString() -cne "NotSigned") {
    throw "production acceptance expects an explicitly unsigned installer"
  }
  Assert-BodamX64Pe -Path $contract.SourceBinary
}

function Assert-NoProductionMarkers {
  param([string[]]$Paths)
  foreach ($path in $Paths) {
    $files = if ((Get-Item -LiteralPath $path).PSIsContainer) {
      @(Get-ChildItem -LiteralPath $path -File -Recurse)
    } else {
      @(Get-Item -LiteralPath $path)
    }
    foreach ($file in $files) {
      $bytes = [IO.File]::ReadAllBytes($file.FullName)
      $utf8 = [Text.Encoding]::UTF8.GetString($bytes)
      $utf16 = [Text.Encoding]::Unicode.GetString($bytes)
      foreach ($marker in $markers) {
        if ($utf8.Contains($marker) -or $utf16.Contains($marker)) {
          throw "production output contains an E2E-only marker"
        }
      }
    }
  }
}

function Assert-InitialRunnerState {
  Assert-BodamUninstalled -Contract $contract
  foreach ($path in @($contract.LocalAppData, $contract.RoamingAppData)) {
    if (Test-Path -LiteralPath $path) { throw "hosted runner contains stale BODAM app-data" }
  }
}

function Write-ReleaseEvidence {
  param(
    [int]$InstallExitCode,
    [int]$UninstallExitCode,
    [Parameter(Mandatory)][string]$InstalledBinarySha256,
    [Parameter(Mandatory)][bool]$SharedWebViewPreserved
  )
  if (-not $SharedWebViewPreserved) { throw "shared WebView2 preservation is not proven" }
  $sourceBinarySha256 = Get-BodamSha256 $contract.SourceBinary
  if ($InstalledBinarySha256 -cnotmatch '^[0-9a-f]{64}$' -or
      $InstalledBinarySha256 -ceq $sourceBinarySha256) {
    throw "installed executable evidence is invalid"
  }
  $runtimeRoot = Join-Path $projectRoot "runtime-data"
  $stage = Join-Path $runtimeRoot "windows-release"
  $runtimeItem = Get-Item -LiteralPath $runtimeRoot -Force -ErrorAction SilentlyContinue
  if ($null -eq $runtimeItem) {
    New-Item -ItemType Directory -Path $runtimeRoot | Out-Null
  } elseif (-not $runtimeItem.PSIsContainer -or
      ($runtimeItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "release staging root is not a regular directory"
  }
  Remove-BodamOwnedTree -Root $runtimeRoot -Path $stage
  New-Item -ItemType Directory -Path $stage | Out-Null

  $stagedInstaller = Join-Path $stage $contract.InstallerName
  Copy-Item -LiteralPath $contract.InstallerPath -Destination $stagedInstaller
  $installerSha = Get-BodamSha256 $contract.InstallerPath
  if ((Get-BodamSha256 $stagedInstaller) -cne $installerSha) {
    throw "staged production installer hash mismatch"
  }
  $utf8NoBom = [Text.UTF8Encoding]::new($false)
  $checksumPath = "$stagedInstaller.sha256"
  [IO.File]::WriteAllText($checksumPath, "$installerSha  $($contract.InstallerName)`n", $utf8NoBom)

  $evidence = [ordered]@{
    schemaVersion = 1
    runner = "windows-2025"
    productName = $contract.ProductName
    identifier = $contract.Identifier
    version = $contract.Version
    architecture = "x64"
    bundleType = "nsis"
    installMode = "currentUser"
    webviewInstallMode = "offlineInstaller"
    installerFile = $contract.InstallerName
    installerBytes = (Get-Item -LiteralPath $contract.InstallerPath).Length
    installerSha256 = $installerSha
    sourceBinarySha256 = $sourceBinarySha256
    installedBinarySha256 = $InstalledBinarySha256
    binaryPatchAwareMatch = $true
    authenticodeStatus = "NotSigned"
    productionMarkerMatches = 0
    launchSmokePassed = $true
    appDataPreserved = $true
    sharedWebViewPreserved = $SharedWebViewPreserved
    silentInstallExitCode = $InstallExitCode
    silentUninstallExitCode = $UninstallExitCode
    hostedRunner = $true
    offlineVmAccepted = $false
  }
  $json = $evidence | ConvertTo-Json -Depth 3
  foreach ($privateValue in @(
    $env:USERPROFILE, $env:GITHUB_WORKSPACE, $env:RUNNER_TEMP, $env:LOCALAPPDATA, $env:APPDATA
  )) {
    if ($privateValue -and $json.Contains($privateValue)) {
      throw "release evidence contains a private runner path"
    }
  }
  $evidencePath = Join-Path $stage "evidence.json"
  [IO.File]::WriteAllText($evidencePath, "$json`n", $utf8NoBom)

  $actualFiles = @(Get-ChildItem -LiteralPath $stage -File | ForEach-Object Name) | Sort-Object
  Assert-ExactStringArray $actualFiles @(
    $contract.InstallerName, "$($contract.InstallerName).sha256", "evidence.json"
  ) "release artifact allowlist"
}

Assert-ProductionSourceContract
Assert-NsisBuildContract
Assert-NoProductionMarkers @($contract.SourceBinary, (Join-Path $projectRoot "dist"))

$tree = & cargo tree --manifest-path (Join-Path $projectRoot "src-tauri/Cargo.toml") --no-default-features
if ($LASTEXITCODE -ne 0 -or ($tree -join "`n") -match "tauri-plugin-wdio") {
  throw "production Cargo graph contains an E2E-only WebDriver dependency"
}

$installed = $false
$uninstalled = $false
$installExitCode = -1
$uninstallExitCode = -1
$installedBinarySha256 = $null
$databaseSha256 = $null
$dailyBackupName = $null
$dailyBackupSha256 = $null
$observedAppData = @()
$webViewSnapshot = $null
$webViewAfterUninstall = $false
$webViewAfterCleanup = $false
try {
  Assert-InitialRunnerState
  $installExitCode = Invoke-BodamNsisInstall -Contract $contract
  $installed = $true
  Assert-BodamInstalled -Contract $contract
  $installedBinarySha256 = Get-BodamSha256 $contract.InstalledBinary
  $webViewSnapshot = @(Get-BodamSharedWebViewSnapshot)
  Assert-NoProductionMarkers @($contract.InstalledBinary)
  $observedAppData = @(Invoke-BodamLaunchSmoke -Contract $contract)
  Assert-BodamRegularPath -Path $contract.DatabasePath -Directory $false
  try { $databaseSha256 = Get-BodamSha256 $contract.DatabasePath } catch {
    throw "production database hash inspection failed"
  }
  try {
    $dailyBackups = @(Get-ChildItem -LiteralPath $contract.BackupDirectory -Force -File `
      -Filter "BODAM-daily-*.bodam-backup")
  } catch { throw "production daily backup enumeration failed" }
  if ($dailyBackups.Count -ne 1) { throw "production daily backup readiness is invalid" }
  Assert-BodamRegularPath -Path $dailyBackups[0].FullName -Directory $false
  $dailyBackupName = $dailyBackups[0].Name
  try { $dailyBackupSha256 = Get-BodamSha256 $dailyBackups[0].FullName } catch {
    throw "production daily backup hash inspection failed"
  }
  $uninstallExitCode = Invoke-BodamNsisUninstall -Contract $contract
  $installed = $false
  Assert-BodamUninstalled -Contract $contract
  Assert-BodamSharedWebViewPreserved -Snapshot $webViewSnapshot
  Assert-BodamRegularPath -Path $contract.RoamingAppData -Directory $true
  Assert-BodamRegularPath -Path $contract.DatabasePath -Directory $false
  $preservedDailyBackup = Join-Path $contract.BackupDirectory $dailyBackupName
  Assert-BodamRegularPath -Path $preservedDailyBackup -Directory $false
  try {
    $preservedDatabaseLength = (Get-Item -LiteralPath $contract.DatabasePath).Length
    $preservedDatabaseSha256 = Get-BodamSha256 $contract.DatabasePath
    $preservedDailyBackupSha256 = Get-BodamSha256 $preservedDailyBackup
  } catch { throw "production app-data preservation inspection failed" }
  if ($preservedDatabaseLength -le 0 -or
      $preservedDatabaseSha256 -cne $databaseSha256 -or
      $preservedDailyBackupSha256 -cne $dailyBackupSha256) {
    throw "NSIS uninstall did not preserve production app-data"
  }
  $webViewAfterUninstall = $true
  foreach ($path in $observedAppData) {
    if (-not (Test-Path -LiteralPath $path -PathType Container)) {
      throw "NSIS uninstall unexpectedly removed production user app-data"
    }
  }
  $uninstalled = $true
} finally {
  Remove-BodamCiResidue -Contract $contract
  if ($null -ne $webViewSnapshot) {
    Assert-BodamSharedWebViewPreserved -Snapshot $webViewSnapshot
    $webViewAfterCleanup = $true
  }
}
if (-not $uninstalled -or $installed -or
    -not $webViewAfterUninstall -or -not $webViewAfterCleanup) {
  throw "production installer lifecycle did not complete"
}
Write-ReleaseEvidence -InstallExitCode $installExitCode -UninstallExitCode $uninstallExitCode `
  -InstalledBinarySha256 $installedBinarySha256 -SharedWebViewPreserved $true
