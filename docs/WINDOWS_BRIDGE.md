# Windows Bridge

The Windows bridge runs on the PC that owns Codex Desktop and local files.

It does not expose public inbound ports. It only polls the user's self-host server, plus it listens on local-only `127.0.0.1` callback ports so OAuth login can auto-confirm on the same PC.

In the mobile app this is the `Agent` tab plus the `Codex Chat -> Desktop Thread Sync` mode. It reports bridge status, syncs local Codex Desktop threads, relays OAuth localhost callbacks, and can run queued `codex.exec` commands through Codex CLI on this Windows PC.

If this Windows PC already has Codex installed, you can ask the local Codex agent to repair everything with [`CODEX_DESKTOP_AGENT_REPAIR.md`](CODEX_DESKTOP_AGENT_REPAIR.md).

For a full beginner A-Z flow from VPS install to Desktop thread send, read [`CODEX_MOBILE_DESKTOP_A_TO_Z.md`](CODEX_MOBILE_DESKTOP_A_TO_Z.md).

## Install

Do not create an empty folder and paste only `scripts\install-windows-bridge.ps1`.

The installer must be run from a full checkout or downloaded copy of this repo. It needs these files:

```text
scripts\install-windows-bridge.ps1
scripts\start-windows-bridge.ps1
apps\windows-bridge\src\index.js
```

## Local prerequisites

The Windows bridge is not a replacement for Codex on the PC. It is a small host agent that controls the local Codex installation already present on that machine.

Install or verify these on the Windows PC:

```powershell
winget install OpenJS.NodeJS.LTS
node -v
npm -v
```

Install Codex CLI if `codex --version` does not work:

```powershell
npm i -g @openai/codex
codex --version
codex app-server --help
```

If the user already installed Codex Desktop, the CLI may be bundled as a real executable under:

```text
C:\Users\<you>\AppData\Local\OpenAI\Codex\bin\<version>\codex.exe
```

The installer now tries to detect that binary and writes `TICMIRO_CODEX_BIN` automatically. If mobile sends fail with `codex is not recognized` or a `codex.cmd` quoting error, set it manually:

```env
TICMIRO_CODEX_BIN=C:\Users\<you>\AppData\Local\OpenAI\Codex\bin\<version>\codex.exe
```

Open Codex once and sign in before testing mobile thread send. The bridge can read `CODEX_HOME\sessions`, but `codex.thread.send`, `codex.exec`, and `codex app-server` still require a working local Codex CLI/Desktop installation.

## Option A: one-command bootstrap

Use this when the Windows PC does not have the repo folder yet.

Requirement: Node.js 22 LTS must be installed and available as `node`.

```powershell
$Bootstrap = "$env:TEMP\ticproxy-bootstrap-windows-bridge.ps1"
Invoke-WebRequest `
  -Uri "https://raw.githubusercontent.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/main/scripts/bootstrap-windows-bridge.ps1" `
  -OutFile $Bootstrap
powershell -ExecutionPolicy Bypass -File $Bootstrap -RunNow
```

The bootstrap script downloads the full repo to:

```text
%USERPROFILE%\codex-mobile-app-one-api-to-rule-them-all
```

Then it runs:

```text
scripts\install-windows-bridge.ps1
```

## Option B: clone with Git

Use this when Git is installed:

```powershell
git clone https://github.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all.git
cd codex-mobile-app-one-api-to-rule-them-all
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows-bridge.ps1 -RunNow
```

## Option C: existing repo folder

If you already have the full repo folder, open PowerShell in the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows-bridge.ps1 -RunNow
```

The installer asks for:

- Server URL
- Windows bridge token
- Proxy API key
- Codex home
- Allowed folders

It also auto-detects the local Codex CLI binary and writes `TICMIRO_CODEX_BIN` when possible.

Paste only the value, not the label. For example, when asked `Your server URL`, paste:

```text
https://codex.example.com
```

Do not paste:

```text
Server URL: https://codex.example.com
```

Newer installers clean this common mistake automatically, but older downloaded copies may write the label into `.env.local`.

`Allowed folders` is important. A mobile Agent command can only run with a `Workspace cwd` inside those folders. For example, if you allow:

```text
C:\Users\you\Documents;F:\WORKING
```

Then the mobile app may run Codex in `F:\WORKING\some-repo`, but not in `C:\Windows`.

## Silent install

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows-bridge.ps1 `
  -ServerUrl "https://codex.example.com" `
  -AgentToken "server-generated-agent-token" `
  -ProxyApiKey "server-generated-proxy-api-key" `
  -CodexHome "$env:USERPROFILE\.codex" `
  -AllowedRoots "$env:USERPROFILE\Documents;$env:USERPROFILE\Desktop" `
  -RunNow `
  -NonInteractive
```

## Status

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\status-windows-bridge.ps1
Get-Content .\runtime\logs\windows-bridge.log -Tail 80
```

If the log says `Failed to parse URL from Server URL: https://.../agent/heartbeat`, open `.env.local` and remove the text before `https://`. `TICMIRO_SERVER_URL` must look exactly like:

```env
TICMIRO_SERVER_URL=https://codex.example.com
```

The web app should also show:

- `Agent` tab: bridge online, host, capabilities, Codex bin, Codex home, allowed roots.
- `Codex Chat` tab: mode `PC Agent Codex CLI` can queue a prompt to the bridge.
- `Codex Chat` tab: mode `Desktop Thread Sync` can list synced Codex Desktop threads and show recent transcript messages.
- `Codex Chat` tab: button `Refresh Desktop` can reopen the Codex Desktop window through command `codex.desktop.restart`.
- `TicProxy` tab: button `API ONE KEY` can configure Codex Desktop to use TicProxy through `config.toml`.
- `Agent Command Queue`: command status changes from `pending` to `running`, then `completed` or `failed`.

## API ONE KEY

Use `TicProxy -> API ONE KEY` in the mobile UI after the Windows bridge is online.

The mobile UI only queues command `ticproxy.apiOneKey.configure`. It does not store the real proxy API key in command history. The Windows bridge fetches the key through the authenticated agent endpoint, then updates the local Codex profile on that Windows PC:

```text
%USERPROFILE%\.codex\config.toml
```

The bridge writes or updates this provider block:

```toml
[model_providers.ticproxy]
name = "TicProxy"
base_url = "https://your-domain.example/v1"
env_key = "TICPROXY_API_KEY"
wire_api = "responses"
```

By default it also sets:

```toml
model_provider = "ticproxy"
model = "gpt-5.5"
```

If `config.toml` already exists, the bridge creates a backup beside it:

```text
config.toml.bak-api-one-key-<timestamp>.toml
```

On Windows, the bridge also persists `TICPROXY_BASE_URL` and `TICPROXY_API_KEY` in the current user's environment. Restart Codex Desktop or start a new Codex CLI process after running API ONE KEY so the new environment is picked up.

## Agent command execution

The bridge supports:

```text
bridge.snapshot
codex.exec
codex.thread.sync
codex.thread.send
codex.host.appServer
codex.desktop.restart
ticproxy.apiOneKey.configure
```

`codex.exec` runs:

```text
codex exec --skip-git-repo-check "<prompt>"
```

`codex.thread.sync` reads recent files under:

```text
CODEX_HOME\sessions\**\*.jsonl
```

and publishes thread titles plus recent messages to the VPS snapshot.

Because of that, protect `data/state.json` on the VPS the same way you protect provider tokens: it may contain recent Desktop transcript snippets.

`codex.thread.send` sends into an existing Desktop thread by starting a local Codex app-server and calling JSON-RPC:

```text
thread/resume
turn/start
```

That is the Desktop-thread path. It is intentionally separate from `codex.exec`, which starts an independent CLI task.

By default on Windows, the bridge starts a fresh app-server per mobile send because this has been more stable across current Codex Desktop builds. After `turn/completed`, the bridge waits for `CODEX_HOME\sessions\**\*.jsonl` to update, then publishes a fresh snapshot back to the VPS. This is the stable host-relay path: phone -> VPS relay -> Windows host -> Codex app-server -> clean snapshot.

While a turn is still running, the bridge also publishes progress snapshots. This prevents the mobile UI from looking frozen while Codex is still thinking or writing a long answer.

Optional host tuning:

```env
# Default on Windows. Start a fresh app-server for each mobile send.
TICMIRO_CODEX_APP_SERVER_MODE=per-command

# Experimental. Reuse a bridge-managed app-server host.
TICMIRO_CODEX_APP_SERVER_MODE=managed

# How long to wait after turn/completed for sessions/*.jsonl to reflect the new turn.
TICMIRO_THREAD_SNAPSHOT_WAIT_MS=15000

# How often to publish snapshots while a mobile-started turn is running.
TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS=3000
```

### Refresh Codex Desktop UI from Mobile

On some Windows Codex Desktop builds, writing to an existing thread through `codex.thread.send` updates the session data, but the already-open Desktop UI does not repaint until the app is reopened.

The bridge therefore supports:

```text
codex.desktop.restart
```

The mobile `Codex Chat` screen exposes this as `Refresh Desktop`. It is a controlled close-and-reopen of Codex Desktop on the Windows PC that owns the bridge. The `Refresh TicProxy` button beside `API ONE KEY` only reloads the TicProxy management status; it does not restart Desktop.

Optional `.env.local` values:

```env
# Set this if auto-discovery cannot find the Desktop app.
TICMIRO_CODEX_DESKTOP_BIN=C:\Users\you\AppData\Local\Programs\Codex\Codex.exe

# Advanced override. If set, the bridge runs this command instead of built-in Windows discovery.
TICMIRO_CODEX_DESKTOP_RESTART_COMMAND=Stop-Process -Name Codex -Force; Start-Process "C:\Path\To\Codex.exe"
TICMIRO_CODEX_DESKTOP_RESTART_TIMEOUT_MS=30000
```

TicProxy intentionally does not reopen Codex Desktop automatically after every `codex.thread.send`. That flow is disruptive and can break the active Desktop experience. Press `Refresh Desktop` manually only when the open Desktop window does not repaint after a mobile send.

Set `TICMIRO_CODEX_BIN` in `.env.local` only if the bridge cannot find Codex automatically. Set `TICMIRO_CODEX_EXEC_EXTRA_ARGS` for optional Codex CLI flags. It accepts either normal CLI text:

```env
TICMIRO_CODEX_EXEC_EXTRA_ARGS=--profile ticproxy-gpt-5-5
```

or a JSON array when an argument contains spaces:

```env
TICMIRO_CODEX_EXEC_EXTRA_ARGS=["--profile","ticproxy-gpt-5-5"]
```

Optional thread sync tuning:

```env
TICMIRO_THREAD_SYNC_LIMIT=30
TICMIRO_THREAD_MESSAGE_LIMIT=40
TICMIRO_THREAD_TAIL_BYTES=6291456
TICMIRO_THREAD_SEND_TIMEOUT_MS=7200000
TICMIRO_THREAD_SNAPSHOT_WAIT_MS=15000
TICMIRO_THREAD_PROGRESS_SNAPSHOT_MS=3000
```

OAuth callback relay is enabled by default. The bridge listens only on localhost:

```text
Codex / ChatGPT: http://localhost:1455/auth/callback
Gemini CLI:      http://localhost:8085/oauth2callback
Antigravity:     http://localhost:51121/oauth-callback
```

To disable it:

```env
TICMIRO_CALLBACK_RELAY=0
```

If a port is already used, the bridge logs a warning and you can still paste the final localhost URL manually in `TicProxy -> OAuth -> Nhap callback thu cong`.

## Codex provider

Codex should use:

```text
base_url = "https://codex.example.com/v1"
env_key = "TICPROXY_API_KEY"
wire_api = "responses"
```

Do not use `wire_api = "chat"`. New Codex Desktop builds reject it with `wire_api = "chat" is no longer supported`; after changing it to `responses`, fully quit and reopen Codex Desktop.

The bridge `.env.local` stores:

```env
TICPROXY_BASE_URL=https://codex.example.com/v1
TICPROXY_API_KEY=server-generated-proxy-api-key
```
