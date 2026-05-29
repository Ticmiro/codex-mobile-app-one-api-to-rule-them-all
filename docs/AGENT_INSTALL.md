# Agent Install Prompt

Use this file when you want an AI agent, server assistant, or DevOps helper to install TicProxy Codex Mobile on a VPS from one GitHub repo link.

Do not paste real tokens into public chat or GitHub issues. The server installer prints secrets locally on the VPS. Store them in a private password manager.

## Give this to the agent

```text
Install this self-hosted TicProxy Codex Mobile repo on my Ubuntu/Debian VPS:

https://github.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all

Goal:
- One server install only.
- Public HTTPS domain points to the mobile UI and TicProxy /v1 API.
- Keep generated tokens private.
- After install, give me the Mobile URL, Windows bridge token, Proxy API key, and update command.

Inputs I will provide privately:
- SSH access to the VPS.
- Domain or subdomain to use.
- Confirmation that the DNS A record points to the VPS public IPv4.

Install command:
export DOMAIN=<my-domain>
curl -fsSL https://raw.githubusercontent.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/main/scripts/deploy-server-one-shot.sh | sh

Verify:
- curl https://<my-domain>/health
- docker compose ps in /opt/codex-mobile-app-one-api-to-rule-them-all
- Open https://<my-domain>/?token=<mobile-token>

Then guide my Windows PC agent through:
https://github.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/blob/main/docs/CODEX_DESKTOP_AGENT_REPAIR.md
```

## What the agent should install

- `apps/server`: mobile console, relay endpoints, OAuth callback, admin API, and OpenAI-compatible `/v1`.
- `docker-compose.yml`: the server container published on `127.0.0.1:4899`.
- Caddy HTTPS reverse proxy when `DOMAIN` is set.
- Persistent server data under `/opt/codex-mobile-app-one-api-to-rule-them-all/data`.

## What the agent should not do

- Do not publish `.env`, tokens, auth JSON, or provider account files.
- Do not expose port `4899` directly to the public internet.
- Do not replace the user's existing DNS records without confirmation.
- Do not delete the `data` folder during updates.

## One-time install checklist

1. Confirm the domain points to the VPS public IPv4.
2. Run the one-shot deploy command with `DOMAIN`.
3. Save the printed secrets privately.
4. Verify `/health`.
5. Open the mobile URL with the printed mobile token.
6. Install the Windows bridge on the PC that owns Codex Desktop.
7. Use `TicProxy -> OAuth` to add accounts.
8. Use `TicProxy -> API ONE KEY` to configure Codex Desktop.
9. Test `/v1/models` with the proxy API key.

## Update later

```bash
cd /opt/codex-mobile-app-one-api-to-rule-them-all
git pull --ff-only
docker compose up -d --build
```
