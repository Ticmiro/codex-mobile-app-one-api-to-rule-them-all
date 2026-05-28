# Self Hosting

This repo is designed for users who want their own server.

## Server role

The user's VPS runs:

- Codex Chat Mobile web app
- TicProxy OAuth presets for Codex/ChatGPT, with Gemini CLI and Antigravity slots configurable by env or `providers.json`
- PC Agent command queue and Codex Desktop thread sync for the Windows bridge
- Mobile Control UI
- Relay for Windows bridge commands
- OpenAI-compatible `/v1` TicProxy API
- OAuth callback endpoint
- Admin API for providers/accounts

The server is the user's private proxy. It does not depend on a managed Ticmiro proxy endpoint.

## Required ports

- Public HTTPS: 443 through Caddy/Nginx
- Internal app: `127.0.0.1:4899`

## Deploy

`DOMAIN` is not a sample value to keep. It is the real domain or subdomain users will open in the browser and use as the OAuth callback host. Before running the deploy command, point DNS to the VPS public IP:

```text
Type: A
Name: codex
Value: <your-vps-public-ip>
```

If your domain is `example.com`, the record above creates `codex.example.com`.

```bash
export DOMAIN=codex.example.com
curl -fsSL https://raw.githubusercontent.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/main/scripts/deploy-server-one-shot.sh | sh
```

To update later without changing the printed tokens:

```bash
cd /opt/codex-mobile-app-one-api-to-rule-them-all
git pull --ff-only
docker compose up -d --build
```

The one-shot script also reuses token values from the existing `.env` file when you rerun it.

See `docs/DOMAIN_DNS_GUIDE.md` when installing for a non-technical user or when guiding an AI/vibe-coding assistant through the setup.

## Data files

Docker volume path:

```text
/app/data/state.json
/app/data/providers.json
```

Host path in the default compose setup:

```text
./data/providers.json
```

`providers.json` contains provider routes, OAuth settings, and account tokens. Back it up and keep it private.

## Provider config

Most users should use the web app instead of editing JSON:

1. Open `https://codex.example.com/?token=<Mobile token>`.
2. Open `TicProxy -> OAuth`.
3. Choose `Codex / ChatGPT` for the first test.
4. Click `Start OAuth`.
5. After provider login, copy the full local callback URL with `code=...&state=...`.
6. Paste it into `Callback URL`, then click `Submit Callback`.
7. Open `TicProxy -> Info` and copy the `/v1` base URL.
8. Configure Codex/Gemini/Antigravity clients with the printed `Proxy API key`.
9. Install the Windows bridge, then use `Agent PC` and `Codex Chat` to sync and continue Codex Desktop threads.

Full app walkthrough: `docs/APP_AUTHER_SETUP.md`.

Advanced users can still start from:

```bash
cp examples/providers.example.json data/providers.json
```

Provider shape:

```json
{
  "id": "openai-main",
  "label": "OpenAI Main Account",
  "type": "openai-compatible",
  "baseUrl": "https://api.openai.com/v1",
  "routing": {"strategy": "least-used"},
  "models": [
    { "id": "gpt-5.4-mini", "upstreamModel": "gpt-5.4-mini" }
  ],
  "oauth": {
    "adapter": "generic-oauth-pkce",
    "authorizationUrl": "",
    "tokenUrl": "",
    "profileUrl": "",
    "clientId": "",
    "clientSecret": "",
    "tokenAuth": "client_secret_post",
    "scopeSeparator": " ",
    "scopes": [],
    "accountModels": ["gpt-5.4-mini"]
  }
}
```

## OAuth start

```bash
curl -X POST https://codex.example.com/admin/oauth/start \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"providerId":"openai-main"}'
```

Open the returned `authUrl`. The callback saves an account into `providers.json`.

For API-key providers or bootstrap testing, add an account with the admin API:

```bash
curl -X POST https://codex.example.com/admin/accounts \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"providerId":"openai-main","label":"Primary account","type":"api-key","apiKeyEnv":"OPENAI_API_KEY_PRIMARY","models":["gpt-5.4-mini"]}'
```

Auther routes requests across active accounts by provider, model allowlist, priority, routing strategy, and daily quota. Usage is available at:

```bash
curl https://codex.example.com/admin/usage \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN"
```

## Proxy usage

```bash
curl https://codex.example.com/v1/models \
  -H "Authorization: Bearer $TICMIRO_PROXY_API_KEY"
```

Use this base URL in Codex:

```text
https://codex.example.com/v1
```
