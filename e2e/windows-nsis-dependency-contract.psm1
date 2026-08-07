Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:DependencyError = "rendered NSIS dependency contract is not the exact approved form"

function Get-BodamNormalizedUtf8Sha256 {
  param([Parameter(Mandatory)][string]$Path)
  $sha256 = $null
  try {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if ($item.PSIsContainer -or
        ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return "" }
    $bytes = [IO.File]::ReadAllBytes($item.FullName)
    $offset = 0
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and
        $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { $offset = 3 }
    $utf8 = [Text.UTF8Encoding]::new($false, $true)
    $text = $utf8.GetString($bytes, $offset, $bytes.Length - $offset)
    if ($text.IndexOf([char]0xFEFF) -ge 0) { return "" }
    $normalized = $text.Replace("`r`n", "`n").Replace("`r", "`n")
    $sha256 = [Security.Cryptography.SHA256]::Create()
    $digest = $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes($normalized))
    ([BitConverter]::ToString($digest)).Replace("-", "").ToLowerInvariant()
  } catch {
    ""
  } finally {
    if ($null -ne $sha256) { $sha256.Dispose() }
  }
}

function Assert-BodamNsisDependencyContract {
  param(
    [Parameter(Mandatory)][string]$ScriptDirectory,
    [Parameter(Mandatory)][string]$LanguagePath,
    [Parameter(Mandatory)][hashtable]$ExpectedIncludeSha256,
    [Parameter(Mandatory)][string]$PluginDirectory,
    [Parameter(Mandatory)][string]$ExpectedPluginSha1
  )
  try {
    $expectedLanguage = [IO.Path]::Combine($ScriptDirectory, "English.nsh")
    if (-not [string]::Equals([IO.Path]::GetFullPath($LanguagePath), $expectedLanguage,
        [StringComparison]::OrdinalIgnoreCase)) { throw $script:DependencyError }
    $approvedGenerated = @("utils.nsh", "FileAssociation.nsh", "English.nsh")
    if ($ExpectedIncludeSha256.Count -ne $approvedGenerated.Count) {
      throw $script:DependencyError
    }
    foreach ($name in $approvedGenerated) {
      $expectedHash = $ExpectedIncludeSha256[$name]
      if ($expectedHash -isnot [string] -or
          -not [Regex]::IsMatch($expectedHash, '^[0-9a-f]{64}$') -or
          (Get-BodamNormalizedUtf8Sha256 ([IO.Path]::Combine($ScriptDirectory, $name))) -cne
            $expectedHash) { throw $script:DependencyError }
    }
    foreach ($relative in @(
        "MUI2.nsh", "FileFunc.nsh", "x64.nsh", "WordFunc.nsh", "Win\COM.nsh",
        "Win\Propkey.nsh", "StrFunc.nsh", "MultiUser.nsh"
    )) {
      if (Test-Path -LiteralPath ([IO.Path]::Combine($ScriptDirectory, $relative))) {
        throw $script:DependencyError
      }
    }
    $pluginItem = Get-Item -LiteralPath ([IO.Path]::GetFullPath($PluginDirectory)) `
      -Force -ErrorAction Stop
    foreach ($name in @("additional", "x86-unicode", "Plugins", "NSIS")) {
      if (-not $pluginItem.PSIsContainer -or $pluginItem.Name -cne $name -or
          ($pluginItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw $script:DependencyError
      }
      $pluginItem = $pluginItem.Parent
    }
    $children = @(Get-ChildItem -LiteralPath $PluginDirectory -Force -ErrorAction Stop)
    if ($children.Count -ne 1 -or $children[0].PSIsContainer -or
        $children[0].Name -cne "nsis_tauri_utils.dll" -or $children[0].Length -le 0 -or
        ($children[0].Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        -not [Regex]::IsMatch($ExpectedPluginSha1, '^[0-9a-f]{40}$') -or
        (Get-FileHash -LiteralPath $children[0].FullName -Algorithm SHA1).Hash.ToLowerInvariant() -cne
          $ExpectedPluginSha1) { throw $script:DependencyError }
  } catch {
    throw $script:DependencyError
  }
}

Export-ModuleMember -Function Assert-BodamNsisDependencyContract, Get-BodamNormalizedUtf8Sha256
