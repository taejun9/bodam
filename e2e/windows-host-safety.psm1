Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:WebViewClientKey =
  "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

function Assert-BodamHostedWindows {
  if (-not $IsWindows -or $env:GITHUB_ACTIONS -cne "true" -or $env:RUNNER_OS -cne "Windows") {
    throw "Windows installer lifecycle is restricted to an ephemeral GitHub Windows runner"
  }
  if (-not [Environment]::Is64BitOperatingSystem -or -not [Environment]::Is64BitProcess) {
    throw "BODAM installer acceptance requires an x64 Windows process"
  }
}

function Test-BodamHostSamePath {
  param([Parameter(Mandatory)][string]$Left, [Parameter(Mandatory)][string]$Right)
  [string]::Equals(
    [IO.Path]::GetFullPath($Left),
    [IO.Path]::GetFullPath($Right),
    [StringComparison]::OrdinalIgnoreCase
  )
}

function Get-BodamCleanupItem {
  param([Parameter(Mandatory)][string]$Path)
  try {
    Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  } catch [Management.Automation.ItemNotFoundException] {
    return $null
  }
}

function Assert-BodamExactCleanupPath {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$Path,
    [Parameter(Mandatory)][bool]$Directory
  )
  $rootPath = ([IO.Path]::GetFullPath($Root)).TrimEnd('\')
  $targetPath = ([IO.Path]::GetFullPath($Path)).TrimEnd('\')
  $relative = [IO.Path]::GetRelativePath($rootPath, $targetPath)
  if ($relative -in @("", ".", "..") -or $relative.Contains('\') -or $relative.Contains('/')) {
    throw "CI cleanup target must be an exact direct child of its approved root"
  }
  $item = Get-BodamCleanupItem -Path $targetPath
  if ($null -ne $item) {
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "CI cleanup target must not be a reparse point"
    }
    if ($Directory -ne [bool]($item.PSIsContainer)) { throw "CI cleanup target type is invalid" }
    $resolved = (Resolve-Path -LiteralPath $targetPath).ProviderPath
    if (-not (Test-BodamHostSamePath $resolved $targetPath)) {
      throw "CI cleanup target resolves outside its approved exact path"
    }
  }
  $targetPath
}

function Assert-BodamOwnedTreeSafe {
  param([Parameter(Mandatory)][string]$Path)
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($Path)
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($child in @(Get-ChildItem -LiteralPath $directory -Force -ErrorAction Stop)) {
      if (($child.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "CI cleanup tree contains a nested reparse point"
      }
      if ($child.PSIsContainer) { $pending.Push($child.FullName) }
    }
  }
}

function Test-BodamCleanupSharingViolation {
  param([Parameter(Mandatory)][Exception]$Exception)
  $Exception -is [IO.IOException] -and $Exception.HResult -eq -2147024864
}

function Remove-BodamOwnedTree {
  param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$Path)
  Assert-BodamHostedWindows
  for ($attempt = 1; $attempt -le 20; $attempt += 1) {
    $target = Assert-BodamExactCleanupPath -Root $Root -Path $Path -Directory $true
    if ($null -eq (Get-BodamCleanupItem -Path $target)) { return }
    Assert-BodamOwnedTreeSafe -Path $target
    try {
      Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
      if ($null -ne (Get-BodamCleanupItem -Path $target)) {
        throw "CI cleanup target remains after deletion"
      }
      return
    } catch {
      if (-not (Test-BodamCleanupSharingViolation -Exception $_.Exception)) { throw }
      if ($attempt -eq 20) { throw "CI cleanup target remained locked after bounded retries" }
    }
    Start-Sleep -Milliseconds 250
  }
}

function Remove-BodamOwnedFile {
  param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$Path)
  $target = Assert-BodamExactCleanupPath -Root $Root -Path $Path -Directory $false
  if ($null -ne (Get-BodamCleanupItem -Path $target)) {
    Remove-Item -LiteralPath $target -Force
  }
}

function Get-BodamHostExactProcesses {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  foreach ($process in @(Get-Process -Name "bodam" -ErrorAction SilentlyContinue)) {
    try { $path = $process.Path } catch { continue }
    if ($path -and (Test-BodamHostSamePath $path $Contract.InstalledBinary)) { $process }
  }
}

function Remove-BodamRegistryTree {
  param([Microsoft.Win32.RegistryView]$View, [Parameter(Mandatory)][string]$Path)
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey(
    [Microsoft.Win32.RegistryHive]::CurrentUser,
    $View
  )
  try { $base.DeleteSubKeyTree($Path, $false) } finally { $base.Dispose() }
}

function Remove-BodamCiResidue {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  Assert-BodamHostedWindows
  foreach ($process in @(Get-BodamHostExactProcesses $Contract)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $Contract.Uninstaller -PathType Leaf) {
    Assert-BodamExactCleanupPath -Root $env:LOCALAPPDATA `
      -Path $Contract.InstallDirectory -Directory $true | Out-Null
    $uninstaller = Assert-BodamExactCleanupPath -Root $Contract.InstallDirectory `
      -Path $Contract.Uninstaller -Directory $false
    $result = Start-Process -FilePath $uninstaller -ArgumentList @("/S", "/NS") -Wait -PassThru
    if ($result.ExitCode -ne 0) { Write-Warning "fallback NSIS uninstall returned a nonzero code" }
  }
  foreach ($entry in @(
    [pscustomobject]@{ Root = $env:LOCALAPPDATA; Path = $Contract.InstallDirectory },
    [pscustomobject]@{ Root = $env:LOCALAPPDATA; Path = $Contract.LocalAppData },
    [pscustomobject]@{ Root = $env:APPDATA; Path = $Contract.RoamingAppData }
  )) {
    Remove-BodamOwnedTree -Root $entry.Root -Path $entry.Path
  }
  foreach ($view in @(
    [Microsoft.Win32.RegistryView]::Registry32,
    [Microsoft.Win32.RegistryView]::Registry64
  )) {
    Remove-BodamRegistryTree -View $view -Path $Contract.UninstallKey
    Remove-BodamRegistryTree -View $view -Path $Contract.ManufacturerKey
  }
  foreach ($root in @(
    [Environment]::GetFolderPath("Desktop"),
    [Environment]::GetFolderPath("Programs")
  )) {
    Remove-BodamOwnedFile -Root $root -Path (Join-Path $root $Contract.ShortcutName)
  }
}

function Get-BodamWebViewRecord {
  param(
    [Parameter(Mandatory)][Microsoft.Win32.RegistryHive]$Hive,
    [Parameter(Mandatory)][Microsoft.Win32.RegistryView]$View,
    [Parameter(Mandatory)][string]$LogicalId
  )
  $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($Hive, $View)
  $key = $null
  try {
    $key = $base.OpenSubKey($script:WebViewClientKey)
    [pscustomobject]@{
      LogicalId = $LogicalId
      Hive = $Hive
      View = $View
      Exists = $null -ne $key
      Pv = if ($null -eq $key) { $null } else { [string]$key.GetValue("pv") }
    }
  } finally {
    if ($null -ne $key) { $key.Dispose() }
    $base.Dispose()
  }
}

function Get-BodamWebViewRecords {
  Get-BodamWebViewRecord -LogicalId "CurrentUser" -Hive CurrentUser -View Registry64
  Get-BodamWebViewRecord -LogicalId "LocalMachine32" -Hive LocalMachine -View Registry32
}

function Test-BodamNonzeroWebViewPv {
  param([AllowNull()][string]$Pv)
  if ([string]::IsNullOrWhiteSpace($Pv)) { return $false }
  try { $version = [Version]::Parse($Pv) } catch { return $false }
  $version -gt [Version]::new(0, 0, 0, 0)
}

function Get-BodamSharedWebViewSnapshot {
  Assert-BodamHostedWindows
  $snapshot = @()
  foreach ($record in @(Get-BodamWebViewRecords)) {
    if (-not $record.Exists) { continue }
    if (-not (Test-BodamNonzeroWebViewPv $record.Pv)) {
      throw "observed shared WebView2 runtime has an invalid pv"
    }
    $snapshot += [pscustomobject]@{
      LogicalId = $record.LogicalId
      Hive = $record.Hive
      View = $record.View
      Pv = $record.Pv
    }
  }
  if ($snapshot.Count -eq 0) { throw "shared WebView2 runtime is not registered" }
  $snapshot
}

function Assert-BodamSharedWebViewPreserved {
  param([Parameter(Mandatory)][object[]]$Snapshot)
  Assert-BodamHostedWindows
  if ($Snapshot.Count -eq 0) { throw "shared WebView2 snapshot is empty" }
  foreach ($expected in $Snapshot) {
    $record = Get-BodamWebViewRecord -LogicalId $expected.LogicalId `
      -Hive $expected.Hive -View $expected.View
    if (-not $record.Exists -or -not (Test-BodamNonzeroWebViewPv $record.Pv) -or
        $record.Pv -cne $expected.Pv) {
      throw "observed shared WebView2 runtime was not preserved"
    }
  }
}

Export-ModuleMember -Function @(
  "Assert-BodamHostedWindows", "Remove-BodamOwnedTree", "Remove-BodamCiResidue",
  "Get-BodamSharedWebViewSnapshot", "Assert-BodamSharedWebViewPreserved"
)
