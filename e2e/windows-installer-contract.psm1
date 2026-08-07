Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:ProjectRoot = Split-Path $PSScriptRoot -Parent

function Get-BodamInstallerContract {
  param([Parameter(Mandatory)][ValidateSet("Production", "E2E")][string]$Flavor)

  $production = $Flavor -eq "Production"
  $productName = if ($production) { "BODAM" } else { "BODAM E2E" }
  $identifier = if ($production) { "app.bodam.desktop" } else { "app.bodam.desktop.e2e" }
  $targetRoot = if ($production) {
    Join-Path $script:ProjectRoot "src-tauri/target/release"
  } else {
    Join-Path $script:ProjectRoot "src-tauri/target/e2e/release"
  }
  $installerName = "${productName}_0.1.0_x64-setup.exe"
  [pscustomobject]@{
    Flavor = $Flavor
    ProductName = $productName
    Identifier = $identifier
    Version = "0.1.0"
    WebViewMode = if ($production) { "offlineInstaller" } else { "skip" }
    TargetRoot = $targetRoot
    SourceBinary = Join-Path $targetRoot "bodam.exe"
    InstallerName = $installerName
    InstallerPath = Join-Path $targetRoot "bundle/nsis/$installerName"
    NsisScript = Join-Path $targetRoot "nsis/x64/installer.nsi"
    InstallDirectory = Join-Path $env:LOCALAPPDATA $productName
    InstalledBinary = Join-Path $env:LOCALAPPDATA "$productName/bodam.exe"
    Uninstaller = Join-Path $env:LOCALAPPDATA "$productName/uninstall.exe"
    UninstallKey = "Software\Microsoft\Windows\CurrentVersion\Uninstall\$productName"
    ManufacturerKey = "Software\bodam\$productName"
    LocalAppData = Join-Path $env:LOCALAPPDATA $identifier
    RoamingAppData = Join-Path $env:APPDATA $identifier
    ShortcutName = "$productName.lnk"
  }
}

function Test-BodamSamePath {
  param([Parameter(Mandatory)][string]$Left, [Parameter(Mandatory)][string]$Right)
  [string]::Equals(
    [IO.Path]::GetFullPath($Left),
    [IO.Path]::GetFullPath($Right),
    [StringComparison]::OrdinalIgnoreCase
  )
}

function Assert-BodamRegularPath {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][bool]$Directory)
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw "installer contract path must not be a reparse point"
  }
  if ($Directory -and -not $item.PSIsContainer) { throw "expected installer directory" }
  if (-not $Directory -and $item.PSIsContainer) { throw "expected installer file" }
}

function Get-BodamSha256 {
  param([Parameter(Mandatory)][string]$Path)
  (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-BodamX64Pe {
  param([Parameter(Mandatory)][string]$Path)
  $bytes = [IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 70 -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) {
    throw "installed executable is not a PE file"
  }
  $offset = [BitConverter]::ToInt32($bytes, 0x3C)
  if ($offset -lt 0 -or $offset + 6 -gt $bytes.Length) { throw "invalid PE header offset" }
  if ($bytes[$offset] -ne 0x50 -or $bytes[$offset + 1] -ne 0x45 -or
      $bytes[$offset + 2] -ne 0 -or $bytes[$offset + 3] -ne 0) {
    throw "invalid PE signature"
  }
  if ([BitConverter]::ToUInt16($bytes, $offset + 4) -ne 0x8664) {
    throw "BODAM Windows executable must be x64"
  }
}

function Get-BodamRegistryRecord {
  param(
    [Parameter(Mandatory)][Microsoft.Win32.RegistryHive]$Hive,
    [Parameter(Mandatory)][Microsoft.Win32.RegistryView]$View,
    [Parameter(Mandatory)][string]$Path
  )
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($Hive, $View)
  $key = $null
  try {
    $key = $base.OpenSubKey($Path)
    $values = @{}
    if ($null -ne $key) {
      foreach ($name in $key.GetValueNames()) { $values[$name] = $key.GetValue($name) }
    }
    [pscustomobject]@{ Hive = $Hive; View = $View; Exists = $null -ne $key; Values = $values }
  } finally {
    if ($null -ne $key) { $key.Dispose() }
    $base.Dispose()
  }
}

function Get-BodamUninstallRecords {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  Get-BodamRegistryRecord -Hive CurrentUser -View Registry64 -Path $Contract.UninstallKey
  foreach ($view in @(
    [Microsoft.Win32.RegistryView]::Registry32,
    [Microsoft.Win32.RegistryView]::Registry64
  )) {
    Get-BodamRegistryRecord -Hive LocalMachine -View $view -Path $Contract.UninstallKey
  }
}

function Assert-BodamRegistryInstalled {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  $records = @(Get-BodamUninstallRecords -Contract $Contract)
  $current = @($records | Where-Object {
    $_.Hive -eq [Microsoft.Win32.RegistryHive]::CurrentUser -and $_.Exists
  })
  $machine = @($records | Where-Object {
    $_.Hive -eq [Microsoft.Win32.RegistryHive]::LocalMachine -and $_.Exists
  })
  if ($current.Count -ne 1 -or $machine.Count -ne 0) {
    throw "current-user NSIS registry scope is invalid"
  }
  $values = $current[0].Values
  if ($values["DisplayName"] -cne $Contract.ProductName -or
      $values["DisplayVersion"] -cne $Contract.Version) {
    throw "installed product registry identity is invalid"
  }
  $location = ([string]$values["InstallLocation"]).Trim('"')
  $uninstaller = ([string]$values["UninstallString"]).Trim('"')
  if (-not (Test-BodamSamePath $location $Contract.InstallDirectory) -or
      -not (Test-BodamSamePath $uninstaller $Contract.Uninstaller)) {
    throw "installed product registry paths are invalid"
  }
}

function Get-BodamExactProcesses {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  foreach ($process in @(Get-Process -Name "bodam" -ErrorAction SilentlyContinue)) {
    try { $path = $process.Path } catch { continue }
    if ($path -and (Test-BodamSamePath $path $Contract.InstalledBinary)) { $process }
  }
}

function Invoke-BodamNsisInstall {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  Assert-BodamRegularPath -Path $Contract.InstallerPath -Directory $false
  $process = Start-Process -FilePath $Contract.InstallerPath -ArgumentList @("/S", "/NS") -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "NSIS silent install failed with exit code $($process.ExitCode)" }
  $process.ExitCode
}

function Assert-BodamInstalled {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  Assert-BodamRegularPath -Path $Contract.InstallDirectory -Directory $true
  Assert-BodamRegularPath -Path $Contract.InstalledBinary -Directory $false
  Assert-BodamRegularPath -Path $Contract.Uninstaller -Directory $false
  Assert-BodamX64Pe -Path $Contract.InstalledBinary
  if ((Get-BodamSha256 $Contract.SourceBinary) -cne (Get-BodamSha256 $Contract.InstalledBinary)) {
    throw "installed executable does not match the bundled executable"
  }
  $items = @(Get-ChildItem -LiteralPath $Contract.InstallDirectory -Force -Recurse)
  if (@($items | Where-Object {
    ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
  }).Count -ne 0 -or @($items | Where-Object PSIsContainer).Count -ne 0) {
    throw "install directory contains an unexpected directory or reparse entry"
  }
  $files = @(
    $items | Where-Object { -not $_.PSIsContainer } |
      ForEach-Object { [IO.Path]::GetRelativePath($Contract.InstallDirectory, $_.FullName) }
  ) | Sort-Object
  $difference = @(Compare-Object @("bodam.exe", "uninstall.exe") $files)
  if ($difference.Count -ne 0) { throw "install directory contains unexpected files" }
  Assert-BodamRegistryInstalled -Contract $Contract
}

function Invoke-BodamLaunchSmoke {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  $process = Start-Process -FilePath $Contract.InstalledBinary -WorkingDirectory $Contract.InstallDirectory -PassThru
  try {
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
      Start-Sleep -Milliseconds 250
      $process.Refresh()
      if ($process.HasExited) { throw "installed production executable exited before opening a window" }
    } while ($process.MainWindowHandle -eq 0 -and [DateTime]::UtcNow -lt $deadline)
    if ($process.MainWindowHandle -eq 0 -or -not (Test-BodamSamePath $process.Path $Contract.InstalledBinary)) {
      throw "installed production window smoke check failed"
    }
  } finally {
    if (-not $process.HasExited -and (Test-BodamSamePath $process.Path $Contract.InstalledBinary)) {
      Stop-Process -Id $process.Id -Force
      $process.WaitForExit(15000) | Out-Null
    }
  }
  if (-not (Test-Path -LiteralPath $Contract.RoamingAppData -PathType Container)) {
    throw "production launch did not create its required roaming app-data"
  }
  @($Contract.RoamingAppData, $Contract.LocalAppData) |
    Where-Object { Test-Path -LiteralPath $_ -PathType Container }
}

function Invoke-BodamNsisUninstall {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  $process = Start-Process -FilePath $Contract.Uninstaller -ArgumentList @("/S", "/NS") -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "NSIS silent uninstall failed with exit code $($process.ExitCode)" }
  $process.ExitCode
}

function Assert-BodamUninstalled {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  if (@(Get-BodamExactProcesses $Contract).Count -ne 0) { throw "installed BODAM process remains" }
  if (Test-Path -LiteralPath $Contract.InstallDirectory) { throw "install directory remains after uninstall" }
  if (@(Get-BodamUninstallRecords $Contract | Where-Object Exists).Count -ne 0) {
    throw "uninstall registry metadata remains"
  }
  $desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) $Contract.ShortcutName
  $programs = Join-Path ([Environment]::GetFolderPath("Programs")) $Contract.ShortcutName
  if ((Test-Path -LiteralPath $desktop) -or (Test-Path -LiteralPath $programs)) {
    throw "BODAM shortcut remains after no-shortcut install"
  }
}

Export-ModuleMember -Function @(
  "Get-BodamInstallerContract", "Get-BodamSha256",
  "Assert-BodamX64Pe", "Invoke-BodamNsisInstall", "Assert-BodamInstalled",
  "Invoke-BodamLaunchSmoke", "Invoke-BodamNsisUninstall", "Assert-BodamUninstalled",
  "Get-BodamExactProcesses"
)
