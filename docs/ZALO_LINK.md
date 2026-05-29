# Zalo Link

Zalo Link lets a self-hosted install connect one Zalo personal chat or group to a Codex Desktop thread. It is built into this repo and does not depend on IDE Admin.

## How It Works

1. The server logs in to a dedicated Zalo personal account by QR.
2. A trusted Zalo chat sends `/link <setup code>`.
3. The bridge allowlists that sender/thread and optionally links it to the selected Codex thread.
4. Plain text from Zalo creates a normal `codex.thread.send` command.
5. The Windows bridge handles the command with Codex Desktop.
6. The Zalo watcher sends the final Codex response back to the linked Zalo chat.

The bridge never runs shell commands directly from Zalo. Zalo only creates commands in the same relay queue used by Codex Mobile.

## Setup

1. Open the mobile web app.
2. Go to `Zalo Link`.
3. Press `QR Login`.
4. Scan the QR from the Zalo mobile app of the bridge account.
5. Pick a default Codex thread.
6. Copy the setup code shown in the tab.
7. From the Zalo chat or private group that should control Codex, send:

```text
/link SETUPCODE
```

Then test:

```text
/status
/threads
/use 1
hello Codex
```

## Commands

```text
/threads
/use <index-or-thread-id>
/unlink
/status
/help
```

Plain text is sent to the linked Codex thread.

## Notes

- Use a dedicated bridge Zalo account when possible. If the same Zalo account sends commands to itself, self-message filtering may prevent messages from being received.
- For groups, linking a group thread means that group can send messages to the linked Codex thread. Use a private group.
- Runtime cookies and IMEI are stored under `TICMIRO_DATA_DIR/zalo/state.json`, which is gitignored by default. Back this data up privately if you want the login to survive container rebuilds.
- The implementation uses `zalo-api-final`, an unofficial personal Zalo Web API package. If Zalo changes its Web login flow, QR login may need a package update.
