$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $Root '.env.local'
$LogDir = Join-Path $Root 'runtime\logs'
$LogFile = Join-Path $LogDir 'windows-bridge.log'
$BridgeScript = Join-Path $Root 'apps\windows-bridge\src\index.js'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (Test-Path -LiteralPath $EnvFile) {
  Get-Content -LiteralPath $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
      [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
    }
  }
}

$escapedBridgeScript = [Regex]::Escape($BridgeScript)
$existing = Get-CimInstance Win32_Process |
  Where-Object {
    $_.ProcessId -ne $PID -and
    $_.Name -eq 'node.exe' -and
    $_.CommandLine -match $escapedBridgeScript
  } |
  Select-Object -First 1

if ($existing) {
  "[$(Get-Date -Format o)] Windows bridge already running as PID $($existing.ProcessId)." | Out-File -FilePath $LogFile -Append -Encoding utf8
  return
}

while ($true) {
  "[$(Get-Date -Format o)] Starting Windows bridge" | Out-File -FilePath $LogFile -Append -Encoding utf8
  node $BridgeScript *>> $LogFile
  "[$(Get-Date -Format o)] Windows bridge exited. Restarting in 5 seconds." | Out-File -FilePath $LogFile -Append -Encoding utf8
  Start-Sleep -Seconds 5
}
