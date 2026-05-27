$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$BridgeScript = Join-Path $Root 'apps\windows-bridge\src\index.js'
$LogFile = Join-Path $Root 'runtime\logs\windows-bridge.log'
$escaped = [Regex]::Escape($BridgeScript)
$processes = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match $escaped } |
  Select-Object ProcessId,Name,CommandLine
$task = Get-ScheduledTask -TaskName 'Codex Mobile App Bridge' -ErrorAction SilentlyContinue | Select-Object TaskName,State

[PSCustomObject]@{
  Root = $Root
  NodeProcesses = @($processes).Count
  ProcessIds = @($processes | ForEach-Object { $_.ProcessId }) -join ','
  ScheduledTask = if ($task) { "$($task.TaskName):$($task.State)" } else { '' }
  LogFile = $LogFile
  LogUpdatedAt = if (Test-Path -LiteralPath $LogFile) { (Get-Item -LiteralPath $LogFile).LastWriteTime.ToString('o') } else { '' }
} | Format-List
