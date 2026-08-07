Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:NsisContractError = "rendered NSIS contract is not the exact approved form"
$script:NsisRegexOptions = [Text.RegularExpressions.RegexOptions]::CultureInvariant -bor
  [Text.RegularExpressions.RegexOptions]::IgnoreCase
$script:ApprovedDirectives = @(
  "addplugindir", "define", "else", "endif", "if", "ifmacrodef", "include",
  "insertmacro", "uninstfinalize"
)
$script:ApprovedLineMacros = @(
  "AndIf", "Else", "ElseIf", "EndIf", "GetOptions", "GetSize", "If", "IfNot", "IfThen",
  "NSD_CreateLabel", "NSD_CreateRadioButton", "NSD_GetState", "NSD_OnClick", "NSD_SetFocus",
  "OrIf", "StrCase", "StrLoc", "VersionCompare"
)
$script:ApprovedInsertMacros = @(
  "APP_ASSOCIATE", "APP_UNASSOCIATE", "CheckIfAppIsRunning", "DeleteAppUserModelId",
  "IsShortcutTarget", "MUI_HEADER_TEXT", "MUI_LANGDLL_DISPLAY", "MUI_LANGUAGE",
  "MUI_PAGE_DIRECTORY", "MUI_PAGE_FINISH", "MUI_PAGE_INSTFILES", "MUI_PAGE_LICENSE",
  "MUI_PAGE_STARTMENU", "MUI_PAGE_WELCOME", "MUI_RESERVEFILE_LANGDLL",
  "MUI_STARTMENU_GETFOLDER", "MUI_STARTMENU_WRITE_BEGIN", "MUI_STARTMENU_WRITE_END",
  "MUI_UNGETLANGUAGE", "MUI_UNPAGE_CONFIRM", "MUI_UNPAGE_INSTFILES", "MULTIUSER_INIT",
  "MULTIUSER_PAGE_INSTALLMODE", "MULTIUSER_UNINIT", "NSIS_HOOK_POSTINSTALL",
  "NSIS_HOOK_POSTUNINSTALL", "NSIS_HOOK_PREINSTALL", "NSIS_HOOK_PREUNINSTALL", "SetContext",
  "SetLnkAppUserModelId", "SetShortcutTarget", "UnpinShortcut"
)
$script:ApprovedIncludes = @(
  "!include MUI2.nsh", "!include FileFunc.nsh", "!include x64.nsh", "!include WordFunc.nsh",
  '!include "utils.nsh"', '!include "FileAssociation.nsh"', '!include "Win\COM.nsh"',
  '!include "Win\Propkey.nsh"', '!include "StrFunc.nsh"', "!include MultiUser.nsh"
)

function Throw-BodamNsisContractError {
  throw $script:NsisContractError
}

function Read-BodamNsisPhysicalLine {
  param([Parameter(Mandatory)][AllowEmptyString()][string]$Line)
  $builder = [Text.StringBuilder]::new()
  $quote = [char]0
  $comment = ""
  for ($index = 0; $index -lt $Line.Length; $index += 1) {
    $character = $Line[$index]
    $escapedQuote = $index -ge 2 -and $Line[$index - 2] -eq [char]36 -and
      $Line[$index - 1] -eq [char]92
    if ($quote -ne [char]0) {
      [void]$builder.Append($character)
      if ($character -eq $quote -and -not $escapedQuote) { $quote = [char]0 }
      continue
    }
    if (($character -eq [char]34 -or $character -eq [char]39 -or $character -eq [char]96) -and
        -not $escapedQuote) {
      $quote = $character
      [void]$builder.Append($character)
      continue
    }
    if ($index + 1 -lt $Line.Length -and
        (($character -eq [char]47 -and $Line[$index + 1] -eq [char]42) -or
         ($character -eq [char]42 -and $Line[$index + 1] -eq [char]47))) {
      Throw-BodamNsisContractError
    }
    if ($character -eq [char]59 -or $character -eq [char]35) {
      $comment = $Line.Substring($index + 1)
      break
    }
    [void]$builder.Append($character)
  }
  if ($quote -ne [char]0) { Throw-BodamNsisContractError }
  [pscustomobject]@{
    Code = $builder.ToString()
    HasComment = $comment.Length -gt 0 -or $builder.Length -lt $Line.Length
    Comment = $comment
  }
}

function Assert-BodamNsisCompilerLine {
  param(
    [Parameter(Mandatory)][string]$Code,
    [Parameter(Mandatory)][pscustomobject]$Parsed,
    [Parameter(Mandatory)][int]$ConditionalDepth,
    [Parameter(Mandatory)][hashtable]$Values,
    [Parameter(Mandatory)][hashtable]$Positions,
    [Parameter(Mandatory)][hashtable]$DefinedSymbols,
    [Parameter(Mandatory)][int]$LineNumber
  )
  $mutation = [Regex]::Match(
    $Code, '^!(?<kind>define|undef)\b(?<rest>.*)$', $script:NsisRegexOptions
  )
  if (-not $mutation.Success) { return }
  if ($mutation.Groups["kind"].Value -ine "define") { Throw-BodamNsisContractError }
  $tokens = @([Regex]::Matches($mutation.Groups["rest"].Value, '[^\s]+'))
  $tokenIndex = 0
  while ($tokenIndex -lt $tokens.Count -and $tokens[$tokenIndex].Value.StartsWith(
      "/", [StringComparison]::Ordinal)) {
    $tokenIndex += 1
  }
  if ($tokenIndex -gt 0 -and -not [Regex]::IsMatch(
      $Code, '^!define[ \t]+/ifndef[ \t]+WS_EX_LAYOUTRTL[ \t]+0x00400000[ \t]*$')) {
    Throw-BodamNsisContractError
  }
  if ($tokenIndex -ge $tokens.Count) { Throw-BodamNsisContractError }
  $symbol = $tokens[$tokenIndex].Value
  if (-not [Regex]::IsMatch($symbol, '^[A-Za-z_][A-Za-z0-9_]*$')) {
    Throw-BodamNsisContractError
  }
  if ($mutation.Groups["rest"].Value.Contains("!")) { Throw-BodamNsisContractError }
  $DefinedSymbols[$symbol] = $true
  $target = if ($symbol -ieq "INSTALLMODE") {
    "INSTALLMODE"
  } elseif ($symbol -ieq "ADDITIONALPLUGINSPATH") {
    "ADDITIONALPLUGINSPATH"
  } elseif ($symbol -ieq "INSTALLWEBVIEW2MODE") {
    "INSTALLWEBVIEW2MODE"
  } elseif ($symbol -ieq "UNINSTALLERSIGNCOMMAND") {
    "UNINSTALLERSIGNCOMMAND"
  } else {
    return
  }
  $canonical = [Regex]::Match(
    $Code,
    '^!define[ \t]+' + [Regex]::Escape($target) + '[ \t]+"([^"\r\n]*)"[ \t]*$'
  )
  if ($symbol -cne $target -or -not $canonical.Success -or $Parsed.HasComment -or
      $ConditionalDepth -ne 0 -or $Values.ContainsKey($target)) {
    Throw-BodamNsisContractError
  }
  $Values[$target] = $canonical.Groups[1].Value
  $Positions[$target] = $LineNumber
}

function Assert-BodamRenderedNsisContract {
  param(
    [Parameter(Mandatory)][string]$ScriptPath,
    [Parameter(Mandatory)][string]$ExpectedInstallMode,
    [Parameter(Mandatory)][AllowEmptyString()][string]$ExpectedWebViewMode,
    [Parameter(Mandatory)][hashtable]$ExpectedIncludeSha256,
    [Parameter(Mandatory)][string]$ExpectedPluginSha1
  )
  try {
    $scriptItem = Get-Item -LiteralPath $ScriptPath -Force -ErrorAction Stop
    if ($scriptItem.PSIsContainer -or
        ($scriptItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      Throw-BodamNsisContractError
    }
    $scriptPathFull = [IO.Path]::GetFullPath($scriptItem.FullName)
    $scriptDirectory = [IO.Path]::GetDirectoryName($scriptPathFull)
    $ScriptText = [IO.File]::ReadAllText($scriptPathFull)
  } catch {
    Throw-BodamNsisContractError
  }
  foreach ($invalid in @([char]0, [char]0x85, [char]0x2028, [char]0x2029)) {
    if ($ScriptText.IndexOf($invalid) -ge 0) { Throw-BodamNsisContractError }
  }
  $values = @{}
  $positions = @{}
  $definedSymbols = @{}
  $includes = @()
  $conditionalDepth = 0
  $addPluginLine = 0
  $finalizerLine = 0
  $lineNumber = 0
  foreach ($line in [Regex]::Split($ScriptText, "\r\n|\n|\r")) {
    $lineNumber += 1
    $parsed = Read-BodamNsisPhysicalLine $line
    $code = $parsed.Code.Trim()
    if ($parsed.Comment.TrimEnd().EndsWith("\", [StringComparison]::Ordinal) -or
        $code.TrimEnd().EndsWith("\", [StringComparison]::Ordinal)) {
      Throw-BodamNsisContractError
    }
    if ($code.Length -eq 0) { continue }
    if ($code[0] -eq [char]33) {
      $directive = [Regex]::Match($code, '^!(?<name>[A-Za-z]+)(?:[ \t]|$)')
      if (-not $directive.Success -or
          $script:ApprovedDirectives -cnotcontains $directive.Groups["name"].Value) {
        Throw-BodamNsisContractError
      }
      if ($directive.Groups["name"].Value -ceq "addplugindir" -and
          $code -cne '!addplugindir "${ADDITIONALPLUGINSPATH}"') {
        Throw-BodamNsisContractError
      }
      if ($directive.Groups["name"].Value -ceq "addplugindir") {
        if ($addPluginLine -ne 0) { Throw-BodamNsisContractError }
        $addPluginLine = $lineNumber
      }
      if ($directive.Groups["name"].Value -ceq "uninstfinalize" -and
          $code -cne "!uninstfinalize '`${UNINSTALLERSIGNCOMMAND}'") {
        Throw-BodamNsisContractError
      }
      if ($directive.Groups["name"].Value -ceq "uninstfinalize") {
        if ($finalizerLine -ne 0) { Throw-BodamNsisContractError }
        $finalizerLine = $lineNumber
      }
      if ($directive.Groups["name"].Value -ceq "else" -and $conditionalDepth -le 0) {
        Throw-BodamNsisContractError
      }
    }
    if ([Regex]::IsMatch($code, '^!include(?:[ \t]|$)', $script:NsisRegexOptions)) {
      $includes += $code
    }
    if ([Regex]::IsMatch($code, '^!endif(?:[ \t]|$)', $script:NsisRegexOptions)) {
      if ($conditionalDepth -le 0) { Throw-BodamNsisContractError }
      $conditionalDepth -= 1
      continue
    }
    Assert-BodamNsisCompilerLine $code $parsed $conditionalDepth `
      $values $positions $definedSymbols $lineNumber
    if ($code[0] -eq [char]36) {
      $lineMacro = [Regex]::Match(
        $code, '^\$\{(?<name>[A-Za-z_][A-Za-z0-9_]*)\}(?:[ \t]|$)'
      )
      if (-not $lineMacro.Success -or
          $script:ApprovedLineMacros -cnotcontains $lineMacro.Groups["name"].Value -or
          $definedSymbols.ContainsKey($lineMacro.Groups["name"].Value)) {
        Throw-BodamNsisContractError
      }
    }
    $insertMacro = [Regex]::Match(
      $code, '^!insertmacro[ \t]+(?<name>[^ \t]+)', $script:NsisRegexOptions
    )
    if ($insertMacro.Success -and
        $script:ApprovedInsertMacros -cnotcontains $insertMacro.Groups["name"].Value) {
      Throw-BodamNsisContractError
    }
    if ([Regex]::IsMatch(
        $code, '^!(?:if|ifmacrodef)(?:[ \t]|$)', $script:NsisRegexOptions)) {
      $conditionalDepth += 1
    }
  }
  if ($includes.Count -ne $script:ApprovedIncludes.Count + 1) {
    Throw-BodamNsisContractError
  }
  for ($index = 0; $index -lt $script:ApprovedIncludes.Count; $index += 1) {
    if ($includes[$index] -cne $script:ApprovedIncludes[$index]) {
      Throw-BodamNsisContractError
    }
  }
  $languageInclude = [Regex]::Match(
    $includes[-1], '^!include[ \t]+"(?<path>[^"\r\n]*[\\/]English\.nsh)"$'
  )
  if (-not $languageInclude.Success) {
    Throw-BodamNsisContractError
  }
  try {
    windows-nsis-dependency-contract\Assert-BodamNsisDependencyContract $scriptDirectory `
      $languageInclude.Groups["path"].Value $ExpectedIncludeSha256 `
      $values["ADDITIONALPLUGINSPATH"] $ExpectedPluginSha1
  } catch { Throw-BodamNsisContractError }
  if ($conditionalDepth -ne 0 -or
      $values.Count -ne 4 -or
      $values["INSTALLMODE"] -cne $ExpectedInstallMode -or
      $values["UNINSTALLERSIGNCOMMAND"] -cne "" -or
      $values["INSTALLWEBVIEW2MODE"] -cne $ExpectedWebViewMode -or
      $positions["INSTALLMODE"] -ge $positions["INSTALLWEBVIEW2MODE"] -or
      $positions["ADDITIONALPLUGINSPATH"] -ge $addPluginLine -or
      $positions["UNINSTALLERSIGNCOMMAND"] -ge $finalizerLine) {
    Throw-BodamNsisContractError
  }
}

Export-ModuleMember -Function Assert-BodamRenderedNsisContract
