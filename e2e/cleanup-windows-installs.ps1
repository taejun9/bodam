Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Import-Module (Join-Path $PSScriptRoot "windows-installer-contract.psm1") -Force
Import-Module (Join-Path $PSScriptRoot "windows-host-safety.psm1") -Force
Assert-BodamHostedWindows

foreach ($flavor in @("Production", "E2E")) {
  $contract = Get-BodamInstallerContract -Flavor $flavor
  Remove-BodamCiResidue -Contract $contract
  Assert-BodamUninstalled -Contract $contract
  foreach ($path in @($contract.LocalAppData, $contract.RoamingAppData)) {
    if (Test-Path -LiteralPath $path) { throw "hosted Windows cleanup left app-owned state" }
  }
}
