# Codex Desktop Agent Repair Handoff

Use this file when the Windows PC already has Codex Desktop or Codex CLI installed, and you want the local Codex agent on that PC to repair the TicProxy bridge, sync Desktop threads, and configure Codex to use the user's self-host TicProxy endpoint.

Do not paste real tokens into GitHub or public logs. Give the values to the local Codex agent only on the target PC.

## Values To Provide To The Local Agent

```text
SERVER_URL=<https://your-domain.example>
BRIDGE_TOKEN=<windows-bridge-token-from-vps-install>
PROXY_API_KEY=<proxy-api-key-from-vps-install>
OPTIONAL_ALLOWED_ROOTS=<for example: F:\WORKING;C:\Users\<you>\Documents;C:\Users\<you>\Desktop>
```

For the test server used during development, `SERVER_URL` looked like:

```text
https://codex2.ticmiro.cloud
```

## Copy This Prompt Into Codex Desktop On The Target PC

```text
You are running on the Windows PC that owns Codex Desktop/Codex CLI. Repair my Codex Mobile App bridge and configure this Codex installation to use my self-host TicProxy endpoint.

Inputs:
- SERVER_URL: <paste server URL only, no "Server URL:" label>
- BRIDGE_TOKEN: <paste Windows bridge token>
- PROXY_API_KEY: <paste proxy API key>
- OPTIONAL_ALLOWED_ROOTS: <optional, semicolon-separated folders>

Repository:
- GitHub: https://github.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all
- Preferred install dir: %USERPROFILE%\codex-mobile-app-one-api-to-rule-them-all

Rules:
- Do not print secrets in full. Mask tokens in the final report.
- Do not delete Codex sessions, Codex config, or user workspace files.
- Before editing config.toml, create a timestamped backup next to it.
- Prefer preserving existing Codex settings and adding/updating only the TicProxy provider/profile.
- If a command fails, inspect logs and repair; do not stop at the first error.

Tasks:
1. Inspect local prerequisites:
   - node -v
   - npm -v
   - where codex
   - codex --version
   - codex app-server --help
   - locate CODEX_HOME. Prefer $env:CODEX_HOME if set, else %USERPROFILE%\.codex, else %LOCALAPPDATA%\OpenAI\Codex\codex-home.
   - confirm CODEX_HOME\config.toml and CODEX_HOME\sessions if they exist.
   - If `codex` is missing, install Codex CLI with `npm i -g @openai/codex`, or locate the Codex Desktop bundled binary under `%LOCALAPPDATA%\OpenAI\Codex\bin\<version>\codex.exe`.

2. Ensure the bridge source exists:
   - If %USERPROFILE%\codex-mobile-app-one-api-to-rule-them-all exists, use it.
   - If it is a Git checkout, update with git pull --ff-only.
   - If it is a zip/bootstrap copy without .git, rerun the bootstrap download from GitHub or replace only the repo folder contents. Preserve .env.local first if it exists.
   - If the folder does not exist, run the bootstrap installer from:
     https://raw.githubusercontent.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/main/scripts/bootstrap-windows-bridge.ps1

3. Normalize and repair .env.local in the repo root:
   Required values:
   - TICMIRO_SERVER_URL=<SERVER_URL with no trailing slash and no label>
   - TICMIRO_AGENT_TOKEN=<BRIDGE_TOKEN>
   - TICMIRO_BRIDGE_ID=<COMPUTERNAME>-bridge
   - CODEX_HOME=<detected Codex home>
   - TICPROXY_BASE_URL=<SERVER_URL>/v1
   - TICPROXY_API_KEY=<PROXY_API_KEY>
   - TICMIRO_ALLOWED_ROOTS=<OPTIONAL_ALLOWED_ROOTS or Documents/Desktop plus F:\WORKING if it exists>
   - TICMIRO_LOCAL_ATTACHMENTS_DIR=<repo>\runtime\attachments
   - TICMIRO_CODEX_BIN=<detected codex.exe/codex.cmd if available>
   - TICMIRO_CODEX_APP_SERVER_MODE=per-command
   - TICMIRO_THREAD_SNAPSHOT_WAIT_MS=15000
   - TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS=3000

   Common repair:
   - If TICMIRO_SERVER_URL contains "Server URL:" or any text before https://, remove it.
   - If CODEX_HOME contains a sentence like "Codex home folder: cứ Enter...", replace it with the actual path.
   - If TICMIRO_ALLOWED_ROOTS contains a sentence like "Allowed folders: ví dụ...", extract only real Windows paths.

4. Install or restart the bridge:
   - Run scripts\install-windows-bridge.ps1 with -NonInteractive if tokens are available.
   - Stop any stale node process running apps\windows-bridge\src\index.js.
   - Start the Scheduled Task "Codex Mobile App Bridge".
   - If the Scheduled Task does not exist, run scripts\install-windows-bridge.ps1 again, or run scripts\start-windows-bridge.ps1 as fallback.

5. Verify bridge logs:
   - Read runtime\logs\windows-bridge.log.
   - The log must not repeat "Failed to parse URL".
   - The web app Agent tab should eventually show capabilities:
      bridge.snapshot, codex.exec, codex.thread.sync, codex.thread.send, codex.host.appServer, codex.desktop.restart, oauth.callback.relay.
   - Desktop Thread Sync should list recent CODEX_HOME\sessions threads.
   - Agent tab should show `Codex host` as `running` after the first mobile thread send, or `idle` before the first send.
   - If Mobile can send into a thread but the Codex Desktop window does not repaint, use `Refresh Desktop` in Mobile. Do not configure automatic Desktop restart after every message.
   - The bridge log should show local OAuth callback relay ports unless `TICMIRO_CALLBACK_RELAY=0`.

6. Configure Codex CLI/Desktop to use TicProxy:
   - Set user environment variables:
     TICPROXY_BASE_URL=<SERVER_URL>/v1
     TICPROXY_API_KEY=<PROXY_API_KEY>
   - Open CODEX_HOME\config.toml.
   - Back it up before editing.
   - Preserve existing model and profile settings.
   - Add or update a TicProxy model provider similar to:

     [model_providers.ticproxy]
     name = "TicProxy"
     base_url = "<SERVER_URL>/v1"
     env_key = "TICPROXY_API_KEY"
     wire_api = "responses"

   - Set the default provider only if the user asked for TicProxy as default:

     model_provider = "ticproxy"

   - If an existing TicProxy provider/profile already exists, update its base_url, env_key, and wire_api instead of duplicating blocks.
   - Important: never leave `wire_api = "chat"` in `config.toml`. New Codex versions reject it and the Desktop chat will fail to load. Use `wire_api = "responses"`.

7. Smoke test:
   - curl <SERVER_URL>/health
   - codex exec --skip-git-repo-check "Reply exactly: TICPROXY_OK"
   - If that fails, inspect the Codex error. Check whether the model/provider selected by config.toml exists in the server's /v1/models list.

8. Optional provider auth import:
   - If the user asks to login a provider that requires a localhost browser callback, perform that login locally on this Windows PC.
   - Prefer the relay flow when an OAuth URL can be generated. The current bridge listens locally and can submit callback to the VPS automatically, so open the auth URL on this same Windows PC:

     1. Request an auth URL with a local callback:

        curl "<SERVER_URL>/codex-auth-url?callbackUrl=http%3A%2F%2Flocalhost%3A1455%2Foauth%2Fcallback" `
          -H "x-control-token: <ADMIN_TOKEN>"

     2. Open the returned `authUrl` in the browser.
     3. If auto-submit fails, capture the final localhost redirect URL that contains `code` and `state`.
     4. Submit it to TicProxy:

        curl -X POST <SERVER_URL>/oauth-callback `
          -H "x-control-token: <ADMIN_TOKEN>" `
          -H "content-type: application/json" `
          -d "{\"provider\":\"codex\",\"redirect_url\":\"http://localhost:1455/auth/callback?code=...&state=...\"}"

   - Export only the trusted token/auth JSON produced by that provider helper.
   - If no relay URL is available, import the token JSON into TicProxy with:

     curl -X POST <SERVER_URL>/admin/auth-files `
       -H "x-control-token: <ADMIN_TOKEN>" `
       -H "content-type: application/json" `
       -d "{\"providerId\":\"<provider-id>\",\"label\":\"Desktop login import\",\"content\":<TOKEN_JSON>}"

   - Do not print the full token JSON in logs or final report.
   - Verify the new account appears in the mobile app `Auther Login` -> `Accounts Pool`.

9. Final report:
   - Repo path used.
   - CODEX_HOME used.
   - Whether .env.local was repaired.
   - Whether Scheduled Task is running.
   - Whether Desktop Thread Sync capabilities are visible.
   - Whether config.toml was backed up and updated.
   - Smoke test result.
   - Mask tokens, showing only first 4 and last 4 characters.
```

## PowerShell Reference Snippets

These snippets are for the local Codex agent to adapt. They are not a replacement for diagnosis.

### Detect Codex Home

```powershell
$Candidates = @(
  $env:CODEX_HOME,
  (Join-Path $env:USERPROFILE ".codex"),
  (Join-Path $env:LOCALAPPDATA "OpenAI\Codex\codex-home"),
  (Join-Path $env:LOCALAPPDATA "NhatNguyenIDE\codex-home")
) | Where-Object { $_ }

$CodexHome = $Candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $CodexHome) { throw "Cannot find CODEX_HOME." }

$CodexHome
Get-ChildItem -LiteralPath $CodexHome -Force | Select-Object Name,Mode,LastWriteTime
```

### Repair Existing `.env.local`

```powershell
$Repo = Join-Path $env:USERPROFILE "codex-mobile-app-one-api-to-rule-them-all"
$EnvFile = Join-Path $Repo ".env.local"
$ServerUrl = "<SERVER_URL>".Trim().TrimEnd("/")
$ProxyApiKey = "<PROXY_API_KEY>"
$BridgeToken = "<BRIDGE_TOKEN>"
$CodexHome = "<DETECTED_CODEX_HOME>"
$CodexBin = "<DETECTED_CODEX_BIN>"
$AllowedRoots = "<OPTIONAL_ALLOWED_ROOTS>"
if (-not $AllowedRoots) {
  $AllowedRoots = "$env:USERPROFILE\Documents;$env:USERPROFILE\Desktop"
  if (Test-Path "F:\WORKING") { $AllowedRoots = "F:\WORKING;$AllowedRoots" }
}
if (-not $CodexBin -or $CodexBin -like "<*") {
  $CodexBin = Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Recurse -Filter codex.exe -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

$Lines = @(
  "# Generated or repaired by Codex Desktop Agent",
  "TICMIRO_SERVER_URL=$ServerUrl",
  "TICMIRO_AGENT_TOKEN=$BridgeToken",
  "TICMIRO_BRIDGE_ID=$env:COMPUTERNAME-bridge",
  "CODEX_HOME=$CodexHome",
  "TICPROXY_BASE_URL=$ServerUrl/v1",
  "TICPROXY_API_KEY=$ProxyApiKey",
  "TICMIRO_ALLOWED_ROOTS=$AllowedRoots",
  "TICMIRO_LOCAL_ATTACHMENTS_DIR=$Repo\runtime\attachments",
  "TICMIRO_CODEX_APP_SERVER_MODE=per-command",
  "TICMIRO_THREAD_SNAPSHOT_WAIT_MS=15000",
  "TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS=3000"
)
if ($CodexBin) { $Lines += "TICMIRO_CODEX_BIN=$CodexBin" }
Set-Content -LiteralPath $EnvFile -Value $Lines -Encoding UTF8
```

### Restart Bridge

```powershell
$Repo = Join-Path $env:USERPROFILE "codex-mobile-app-one-api-to-rule-them-all"
Set-Location $Repo

Stop-ScheduledTask -TaskName "Codex Mobile App Bridge" -ErrorAction SilentlyContinue

Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like "*apps\windows-bridge\src\index.js*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Start-ScheduledTask -TaskName "Codex Mobile App Bridge" -ErrorAction SilentlyContinue

if (-not (Get-ScheduledTask -TaskName "Codex Mobile App Bridge" -ErrorAction SilentlyContinue)) {
  powershell -ExecutionPolicy Bypass -File .\scripts\start-windows-bridge.ps1
}

powershell -ExecutionPolicy Bypass -File .\scripts\status-windows-bridge.ps1
Get-Content .\runtime\logs\windows-bridge.log -Tail 120
```

### Configure `config.toml`

The local agent should parse/edit TOML carefully when possible. This simple text updater is acceptable only after a backup and visual inspection.

```powershell
$ServerUrl = "<SERVER_URL>".Trim().TrimEnd("/")
$ProxyApiKey = "<PROXY_API_KEY>"
$CodexHome = "<DETECTED_CODEX_HOME>"
$Config = Join-Path $CodexHome "config.toml"
$Backup = "$Config.bak.$(Get-Date -Format yyyyMMdd-HHmmss)"

Copy-Item -LiteralPath $Config -Destination $Backup -Force
[Environment]::SetEnvironmentVariable("TICPROXY_BASE_URL", "$ServerUrl/v1", "User")
[Environment]::SetEnvironmentVariable("TICPROXY_API_KEY", $ProxyApiKey, "User")
$env:TICPROXY_BASE_URL = "$ServerUrl/v1"
$env:TICPROXY_API_KEY = $ProxyApiKey

$Text = Get-Content -LiteralPath $Config -Raw

if ($Text -match '(?m)^model_provider\s*=') {
  $Text = [regex]::Replace($Text, '(?m)^model_provider\s*=.*$', 'model_provider = "ticproxy"', 1)
} else {
  $Text = "model_provider = `"ticproxy`"`r`n" + $Text
}

$ProviderBlock = @"

[model_providers.ticproxy]
name = "TicProxy"
base_url = "$ServerUrl/v1"
env_key = "TICPROXY_API_KEY"
wire_api = "responses"
"@

if ($Text -match '(?ms)^\[model_providers\.ticproxy\].*?(?=^\[|\z)') {
  $Text = [regex]::Replace($Text, '(?ms)^\[model_providers\.ticproxy\].*?(?=^\[|\z)', $ProviderBlock.TrimStart() + "`r`n")
} else {
  $Text = $Text.TrimEnd() + "`r`n" + $ProviderBlock + "`r`n"
}

Set-Content -LiteralPath $Config -Value $Text -Encoding UTF8
Write-Output "Backed up config to $Backup"
```

If the file already contains the old value, fix it before launching Codex Desktop:

```powershell
$Text = Get-Content -LiteralPath $Config -Raw
$Text = $Text -replace 'wire_api\s*=\s*"chat"', 'wire_api = "responses"'
Set-Content -LiteralPath $Config -Value $Text -Encoding UTF8
```

## Troubleshooting Map

| Symptom | Likely Cause | Repair |
| --- | --- | --- |
| `Failed to parse URL from Server URL: https://.../agent/heartbeat` | `.env.local` contains pasted label text | Set `TICMIRO_SERVER_URL=https://...` only |
| `fatal: not a git repository` | Bootstrap installed from zip | Rerun bootstrap with latest source or install with `git clone` |
| `Start-ScheduledTask: file not found` | Task points at missing repo path | Reinstall bridge from the actual repo folder |
| `node is not recognized` | Node.js missing | Install Node.js 22 LTS |
| `codex is not recognized` | Codex CLI not installed or not in PATH | Install Codex CLI with `npm i -g @openai/codex`, or locate Codex Desktop bundled `codex.exe`, then set `TICMIRO_CODEX_BIN` |
| `codex.cmd is not recognized` or nested quote error | Windows `.cmd` wrapper was spawned with bad quoting | Pull latest bridge; prefer real `codex.exe` via `TICMIRO_CODEX_BIN` |
| Bridge online but no Desktop threads | Wrong `CODEX_HOME` or empty sessions folder | Detect real Codex home and update `.env.local` |
| Mobile thread shows `<environment_context>` or tool/patch output | Old bridge parser published internal JSONL context | Pull latest repo, restart bridge, then Sync/Reload mobile |
| Mobile sends into thread but open Codex Desktop window does not update | Desktop UI does not live-reload changed session files on this build | Press `Refresh Desktop` in Mobile; do not auto-restart after every message |
| Mobile looks like it is waiting forever while Codex is answering | Old bridge did not publish snapshots until `turn/completed` | Pull latest repo, restart bridge, confirm `TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS=3000` |
| First send works but later sends fail through host app-server | Long-lived app-server became stale on this machine | Restart bridge; if repeated, set `TICMIRO_CODEX_APP_SERVER_MODE=per-command` and restart bridge |
| Mobile can see threads but send fails | Codex app-server JSON-RPC mismatch or active thread issue | Check bridge log; fall back to `PC Agent Codex CLI` mode while investigating |
| `wire_api = "chat" is no longer supported` | Old provider config was written into `config.toml` | Back up `config.toml`, replace with `wire_api = "responses"`, then fully restart Codex Desktop |
| Codex CLI cannot use TicProxy | `config.toml` provider mismatch or model not routed | Check `/v1/models`, update model/provider/wire_api |

## Expected Healthy State

- `.env.local` has clean URL/token/path values.
- Scheduled Task `Codex Mobile App Bridge` exists and starts.
- `runtime\logs\windows-bridge.log` shows no repeated fatal loop.
- Mobile app `Agent` tab shows the bridge online.
- Agent capabilities include `codex.thread.sync`, `codex.thread.send`, `codex.host.appServer`, and `codex.desktop.restart`.
- `Codex Chat -> Desktop Thread Sync` lists recent Codex Desktop sessions.
- `codex exec --skip-git-repo-check "Reply exactly: TICPROXY_OK"` succeeds through TicProxy after `config.toml` is repaired.
