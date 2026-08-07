Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-BodamProductionReadinessToken {
  param([Parameter(Mandatory)][pscustomobject]$Contract)

  $directory = Get-Item -LiteralPath $Contract.RoamingAppData -Force `
    -ErrorAction SilentlyContinue
  $database = Get-Item -LiteralPath $Contract.DatabasePath -Force `
    -ErrorAction SilentlyContinue
  $backupDirectory = Get-Item -LiteralPath $Contract.BackupDirectory -Force `
    -ErrorAction SilentlyContinue
  $workspace = Get-Item -LiteralPath $Contract.WorkspaceDirectory -Force `
    -ErrorAction SilentlyContinue
  if ($null -eq $directory -or $null -eq $database -or
      $null -eq $backupDirectory -or $null -eq $workspace) {
    return $null
  }
  if (-not $directory.PSIsContainer -or
      ($directory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    return $null
  }
  if ($database.PSIsContainer -or
      ($database.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      $database.Length -le 0) {
    return $null
  }
  if (-not $backupDirectory.PSIsContainer -or
      ($backupDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      -not $workspace.PSIsContainer -or
      ($workspace.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    return $null
  }
  try {
    $backupChildren = @(Get-ChildItem -LiteralPath $Contract.BackupDirectory -Force)
    $workspaceChildren = @(Get-ChildItem -LiteralPath $Contract.WorkspaceDirectory -Force)
  } catch {
    return $null
  }
  if ($backupChildren.Count -ne 1 -or $workspaceChildren.Count -ne 0) { return $null }
  $dailyBackup = $backupChildren[0]
  if ($dailyBackup.PSIsContainer -or $dailyBackup.Length -le 0 -or
      ($dailyBackup.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      $dailyBackup.Name -cnotmatch '^BODAM-daily-\d{8}T\d{9}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.bodam-backup$') {
    return $null
  }
  "$($database.Length):$($dailyBackup.Name):$($dailyBackup.Length)"
}

function Test-BodamProductionDataReady {
  param([Parameter(Mandatory)][pscustomobject]$Contract)
  $null -ne (Get-BodamProductionReadinessToken -Contract $Contract)
}

Export-ModuleMember -Function @(
  "Get-BodamProductionReadinessToken", "Test-BodamProductionDataReady"
)
