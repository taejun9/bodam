Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "windows-nsis-dependency-contract.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "windows-nsis-rendered-contract.psm1") -Force
$utf8 = [Text.UTF8Encoding]::new($false)
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ("bodam-nsis-contract-" + [guid]::NewGuid())
$scriptPath = Join-Path $fixtureRoot "installer.nsi"
$languagePath = Join-Path $fixtureRoot "English.nsh"
$pluginDirectory = Join-Path $fixtureRoot "NSIS/Plugins/x86-unicode/additional"
$includeSha256 = @{}
$pluginSha1 = ""
$pluginJunctionCreated = $false

function Write-Contract {
  param([Parameter(Mandatory)][AllowEmptyString()][string]$ScriptText)
  [IO.File]::WriteAllText($scriptPath, $ScriptText, $utf8)
}

function Assert-RejectedContract {
  param([AllowEmptyString()][string]$ScriptText)
  Write-Contract $ScriptText
  $rejected = $false
  try {
    Assert-BodamRenderedNsisContract $scriptPath "currentUser" "" $includeSha256 $pluginSha1
  } catch {
    if ($_.Exception.Message -cne "rendered NSIS contract is not the exact approved form") { throw }
    $rejected = $true
  }
  if (-not $rejected) { throw "rendered NSIS negative control was accepted" }
}

try {
  [void](New-Item -ItemType Directory -Path $fixtureRoot)
  [void](New-Item -ItemType Directory -Path $pluginDirectory)
  $pluginPath = Join-Path $pluginDirectory "nsis_tauri_utils.dll"
  [IO.File]::WriteAllText($pluginPath, "synthetic plugin", $utf8)
  $pluginSha1 = (Get-FileHash -LiteralPath $pluginPath -Algorithm SHA1).Hash.ToLowerInvariant()
  foreach ($name in @("utils.nsh", "FileAssociation.nsh", "English.nsh")) {
    $path = Join-Path $fixtureRoot $name
    [IO.File]::WriteAllText($path, "synthetic $name`n", $utf8)
    $includeSha256[$name] = Get-BodamNormalizedUtf8Sha256 $path
  }
  $includePrefix = @(
    '!include MUI2.nsh', '!include FileFunc.nsh', '!include x64.nsh', '!include WordFunc.nsh',
    '!include "utils.nsh"', '!include "FileAssociation.nsh"', '!include "Win\COM.nsh"',
    '!include "Win\Propkey.nsh"', '!include "StrFunc.nsh"'
  )
  $includeSuffix = @(
    '!if "${INSTALLMODE}" == "both"', '!include MultiUser.nsh', '!endif',
    '!insertmacro MUI_LANGUAGE "English"', '!insertmacro MUI_RESERVEFILE_LANGDLL',
    "!include `"$languagePath`""
  )
  function New-RenderedContract {
    param(
      [Parameter(Mandatory)][AllowEmptyCollection()][string[]]$Body,
      [string[]]$BeforeEnglish = @()
    )
    $suffix = @($includeSuffix[0..4]) + @($BeforeEnglish) + @($includeSuffix[5])
    [string]::Join("`n", @($includePrefix) + @($Body) + $suffix)
  }

  $validBody = @(
    '!if "none" == "none"', '!define UNRELATED "/* literal ; # */"', '!endif',
    '!define INSTALLMODE "currentUser"', "!define ADDITIONALPLUGINSPATH `"$pluginDirectory`"",
    '!define INSTALLWEBVIEW2MODE ""', '!define UNINSTALLERSIGNCOMMAND ""',
    '!addplugindir "${ADDITIONALPLUGINSPATH}"', '!if "${UNINSTALLERSIGNCOMMAND}" != ""',
    "!uninstfinalize '`${UNINSTALLERSIGNCOMMAND}'", '!endif',
    '!define /ifndef WS_EX_LAYOUTRTL 0x00400000', '${If} 1 = 1', '${EndIf}'
  )
  $valid = New-RenderedContract -Body $validBody
  foreach ($text in @($valid, $valid.Replace("`n", "`r`n") + "`r`n",
      $valid.Replace("`n", "`r") + "`r")) {
    Write-Contract $text
    Assert-BodamRenderedNsisContract $scriptPath "currentUser" "" $includeSha256 $pluginSha1
  }
  Write-Contract ($valid.Replace('INSTALLWEBVIEW2MODE ""',
    'INSTALLWEBVIEW2MODE "offlineInstaller"'))
  Assert-BodamRenderedNsisContract $scriptPath "currentUser" "offlineInstaller" `
    $includeSha256 $pluginSha1

  $mode = '!define INSTALLMODE "currentUser"'
  $webView = '!define INSTALLWEBVIEW2MODE ""'
  $invalidContracts = @(
    (New-RenderedContract -Body @($webView, $mode)),
    (New-RenderedContract -Body @($mode, '!define INSTALLWEBVIEW2MODE "skip"')),
    (New-RenderedContract -Body @($mode, '!define INSTALLWEBVIEW2MODE "downloadBootstrapper"')),
    (New-RenderedContract -Body @($mode)),
    (New-RenderedContract -Body @($mode, $webView, $webView)),
    (New-RenderedContract -Body @($mode, $webView,
      '!define /redef INSTALLWEBVIEW2MODE "offlineInstaller"')),
    (New-RenderedContract -Body @($mode, $webView, '!undef INSTALLWEBVIEW2MODE')),
    (New-RenderedContract -Body @('!define OTHER "x"', $mode, $webView,
      '!undef /noerrors OTHER INSTALLWEBVIEW2MODE')),
    (New-RenderedContract -Body @($mode, '!define /ifndef INSTALLWEBVIEW2MODE ""')),
    (New-RenderedContract -Body @($mode, '!define /file INSTALLWEBVIEW2MODE "value.txt"')),
    (New-RenderedContract -Body @($mode, '!define /math INSTALLWEBVIEW2MODE 1 + 1')),
    (New-RenderedContract -Body @($mode, '; !define INSTALLWEBVIEW2MODE ""',
      '!define INSTALLWEBVIEW2MODE "offlineInstaller"')),
    (New-RenderedContract -Body @($mode, '# comment \', $webView)),
    (New-RenderedContract -Body @($mode, '; comment \', $webView)),
    (New-RenderedContract -Body @($mode, '/*', $webView, '*/')),
    (New-RenderedContract -Body @($mode, '!if 0', $webView, '!endif')),
    (New-RenderedContract -Body @($mode, '!macro Decoy', $webView, '!macroend')),
    (New-RenderedContract -Body @($mode, $webView, '!define ALIAS INSTALLWEBVIEW2MODE',
      '!define ${ALIAS} "offlineInstaller"')),
    (New-RenderedContract -Body @($mode, $webView, '!define OP "!define /redef"',
      '${OP} INSTALLWEBVIEW2MODE "offlineInstaller"')),
    (New-RenderedContract -Body @($mode, $webView,
      '!searchreplace INSTALLWEBVIEW2MODE "safe" "safe" "unsafe"')),
    (New-RenderedContract -Body @($mode, $webView, '!addincludedir "C:\evil"')),
    (New-RenderedContract -Body @($mode, $webView, '!cd "C:\evil"')),
    (New-RenderedContract -Body @($mode, $webView, '!addplugindir "C:\evil"')),
    (New-RenderedContract -Body @($mode, $webView, '!finalize "cmd.exe"')),
    (New-RenderedContract -Body @($mode, $webView, '!uninstfinalize "cmd.exe"')),
    (New-RenderedContract -Body @($mode, '!define INSTALLWEBVIEW2MODE "" ; suffix')),
    (New-RenderedContract -Body @($mode, '!define INSTALLWEBVIEW2MODE "" \')),
    (New-RenderedContract -Body @($mode, '!define installwebview2mode ""')),
    (New-RenderedContract -Body @($mode, '!if 1', $webView)),
    (New-RenderedContract -Body @($mode, $webView) -BeforeEnglish @('!include "mutate.nsh"')),
    $valid.Replace('!include MUI2.nsh', '!include "mutate.nsh"'),
    $valid.Replace($languagePath, 'C:\evil\English.nsh'),
    $valid.Replace("!define ADDITIONALPLUGINSPATH `"$pluginDirectory`"",
      '!define ADDITIONALPLUGINSPATH "C:\evil"'),
    $valid.Replace('!define UNINSTALLERSIGNCOMMAND ""',
      '!define UNINSTALLERSIGNCOMMAND "cmd.exe /c exit 0"')
  )
  foreach ($scriptText in $invalidContracts) { Assert-RejectedContract $scriptText }

  [IO.File]::AppendAllText($languagePath, "tampered", $utf8)
  Assert-RejectedContract $valid
  [IO.File]::WriteAllText($languagePath, "synthetic English.nsh`n", $utf8)
  $shadowPath = Join-Path $fixtureRoot "MUI2.nsh"
  [IO.File]::WriteAllText($shadowPath, "shadow", $utf8)
  Assert-RejectedContract $valid
  Remove-Item -LiteralPath $shadowPath -Force

  [IO.File]::WriteAllText($pluginPath, "tampered plugin", $utf8)
  Assert-RejectedContract $valid
  [IO.File]::WriteAllText($pluginPath, "synthetic plugin", $utf8)
  $extraPlugin = Join-Path $pluginDirectory "unexpected.dll"
  [IO.File]::WriteAllText($extraPlugin, "synthetic extra", $utf8)
  Assert-RejectedContract $valid
  Remove-Item -LiteralPath $extraPlugin -Force

  $pluginTarget = Join-Path $fixtureRoot "plugin-target"
  [void](New-Item -ItemType Directory -Path $pluginTarget)
  [IO.File]::WriteAllText(
    (Join-Path $pluginTarget "nsis_tauri_utils.dll"), "synthetic plugin", $utf8
  )
  Remove-Item -LiteralPath $pluginDirectory -Recurse -Force
  $command = "mklink /J `"$pluginDirectory`" `"$pluginTarget`""
  & cmd.exe /D /C $command 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "plugin junction negative-control setup failed" }
  $pluginJunctionCreated = $true
  Assert-RejectedContract $valid
  [IO.Directory]::Delete($pluginDirectory)
  $pluginJunctionCreated = $false
  Write-Output "BODAM rendered NSIS controls: PASS"
} finally {
  if ($pluginJunctionCreated -and
      $null -ne (Get-Item -LiteralPath $pluginDirectory -Force -ErrorAction SilentlyContinue)) {
    [IO.Directory]::Delete($pluginDirectory)
  }
  if (Test-Path -LiteralPath $fixtureRoot) {
    Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
  }
}
