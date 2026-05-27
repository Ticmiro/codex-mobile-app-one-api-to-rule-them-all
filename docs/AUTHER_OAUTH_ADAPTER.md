# Auther / OAuth Adapter

The server includes a clean-room Auther layer for provider login, token refresh, account quota, and multi-account routing behind one `/v1` proxy key.

## Current status

Auther is installed in the product surface. The server can generate OAuth login URLs out of the box for:

- `Codex / ChatGPT`

`Gemini CLI` and `Antigravity` presets are present, but their Google OAuth client values must be supplied through environment variables or `data/providers.json` because GitHub push protection blocks shipping them in a public repo.

Optional environment variables for those presets:

```env
TICMIRO_GEMINI_OAUTH_CLIENT_ID=
TICMIRO_GEMINI_OAUTH_CLIENT_SECRET=
TICMIRO_ANTIGRAVITY_OAUTH_CLIENT_ID=
TICMIRO_ANTIGRAVITY_OAUTH_CLIENT_SECRET=
```

Custom provider account login still needs real OAuth settings:

- authorization URL
- token URL
- client ID
- required scopes and extra provider params

The API-key account flow is still available for OpenAI-compatible providers. After adding one or more accounts, apps use only one TicProxy proxy key against `/v1`.

## TicProxy management endpoints

TicProxy includes management endpoints for provider login, callback relay, auth import, quota, and account routing:

```text
GET  /admin/codex-auth-url
GET  /admin/gemini-cli-auth-url
GET  /admin/antigravity-auth-url
GET  /admin/get-auth-status?state=<oauth-state>
GET  /admin/oauth/status?state=<oauth-state>
POST /admin/oauth-callback
GET  /admin/auth-files
POST /admin/auth-files
```

All endpoints require the same `x-control-token: <Admin token>` header as the other admin APIs.

For helper compatibility, the short aliases also work with the same admin token header: `/codex-auth-url`, `/gemini-cli-auth-url`, `/antigravity-auth-url`, `/get-auth-status`, `/oauth-callback`, and `/auth-files`.

The auth URL endpoints pick the provider whose `routing.platform` is `codex`, `gemini-cli`, or `antigravity`, then call the generic PKCE adapter. They return both `authUrl` and `statusUrl`.

The status endpoint returns:

```json
{
  "ok": true,
  "flow": {
    "state": "oauth-...",
    "providerId": "codex-oauth",
    "status": "waiting",
    "accountId": "",
    "error": ""
  }
}
```

After callback succeeds, `status` becomes `completed` and includes the saved `accountId`.

For IDE Admin style local relay, request the auth URL with a local callback URL:

```bash
curl 'https://codex.example.com/codex-auth-url?callbackUrl=http%3A%2F%2Flocalhost%3A1455%2Fauth%2Fcallback' \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN"
```

The web app fills this automatically for common platforms so normal users do not need to see it:

- Codex / ChatGPT: `http://localhost:1455/auth/callback`
- Gemini CLI: `http://localhost:8085/oauth2callback`
- Antigravity: `http://localhost:51121/oauth-callback`

After the provider redirects the browser to localhost, forward the whole redirect URL back to TicProxy:

```bash
curl -X POST https://codex.example.com/oauth-callback \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "provider": "codex",
    "redirect_url": "http://localhost:1455/auth/callback?code=CODE_FROM_PROVIDER&state=oauth-..."
  }'
```

TicProxy returns JSON:

```json
{
  "ok": true,
  "status": "ok",
  "message": "OAuth login saved.",
  "account": {
    "id": "acct-...",
    "label": "Codex account",
    "refreshConfigured": true
  }
}
```

Direct public callback still works at `/oauth/callback`. Add `?format=json` or send `Accept: application/json` if a JSON confirmation is needed instead of the plain browser success text.

## Import auth JSON from a local helper

Some provider login helpers are designed for a local desktop callback, not a public VPS callback. TicProxy supports provider-specific localhost ports such as Codex `1455`, Gemini CLI `8085`, and Antigravity `51121`.

For that shape, let the Windows-side helper or Codex agent do the local browser login, then import the resulting trusted token JSON into TicProxy:

```bash
curl -X POST https://codex.example.com/admin/auth-files \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "providerId": "codex-oauth",
    "label": "Desktop login import",
    "models": ["gpt-5.5"],
    "content": {
      "access_token": "provider-access-token",
      "refresh_token": "provider-refresh-token",
      "expires_in": 3600,
      "scope": "openid profile email"
    }
  }'
```

The web app exposes the same flow in `Auther Login` -> `Import Auth JSON`.

## Goal

Users should be able to:

1. Open their self-host Mobile Control server.
2. Click an Auther/OAuth login button.
3. Login to their own account.
4. Store that account on their own VPS.
5. Use one proxy API key from `/v1` to route requests across many accounts/models.

## Web app flow

The normal setup path is now the built-in app:

1. Open the server domain.
2. Paste `Mobile token`, `Admin token`, and `Proxy API key`.
3. Use `Auther Platforms` to pick the target surface: `Codex / ChatGPT`, `Antigravity`, `Gemini CLI`, or `OpenRouter`.
4. Use `AI Providers` to save the provider and OAuth adapter settings.
5. Use `Auther Login` to start OAuth or add an API-key account.
6. Use `Quota & Routing` to view usage and edit routes.
7. Use `Codex Chat` to test `/v1/chat/completions`, or `Agent` to run queued Codex CLI prompts through the Windows bridge.

See `docs/APP_AUTHER_SETUP.md` for the non-technical walkthrough.

## Current generic API flow

Admin starts OAuth:

```bash
curl -X POST https://codex.example.com/admin/oauth/start \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"providerId":"openai-main"}'
```

Server returns:

```json
{
  "ok": true,
  "authUrl": "https://provider.example/oauth/authorize?...",
  "state": "oauth-...",
  "callbackUrl": "https://codex.example.com/oauth/callback"
}
```

The callback exchanges the code and stores an account in `data/providers.json`.

## Provider adapter requirements

Each provider needs:

```json
{
  "oauth": {
    "adapter": "generic-oauth-pkce",
    "authorizationUrl": "https://provider.example/oauth/authorize",
    "tokenUrl": "https://provider.example/oauth/token",
    "profileUrl": "https://provider.example/userinfo",
    "clientId": "client-id",
    "clientSecret": "optional-client-secret",
    "tokenAuth": "client_secret_post",
    "scopeSeparator": " ",
    "scopes": ["scope-a", "scope-b"],
    "authorizationParams": {},
    "tokenParams": {},
    "profileFieldMap": {
      "email": "email",
      "name": "name"
    },
    "accountModels": ["provider-model-a"]
  }
}
```

Supported adapter config today:

- `generic-oauth-pkce`: Authorization Code + PKCE with configurable auth/token/profile URLs.
- `tokenAuth`: `client_secret_post`, `client_secret_basic`, or `none`.
- `scopeSeparator`: use `" "` for a single OAuth scope string or `"repeat"` for repeated `scope` params.
- `authorizationParams` and `tokenParams`: provider-specific extra form/query values.
- `profileFieldMap`: dot-path mapping used to label accounts after callback.

## API-key account flow

For providers that do not expose OAuth, add an API-key account:

```bash
curl -X POST https://codex.example.com/admin/accounts \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "providerId": "openai-main",
    "label": "Primary API key account",
    "type": "api-key",
    "apiKeyEnv": "OPENAI_API_KEY_PRIMARY",
    "models": ["gpt-5.4-mini"],
    "quota": {"requestsPerDay": 500, "tokensPerDay": 1000000}
  }'
```

## Routing and quota

Routes may pin a provider, upstream model, account, or strategy:

```json
{
  "routes": {
    "default-fast": {
      "provider": "openai-main",
      "model": "gpt-5.4-mini",
      "accountStrategy": "least-used"
    }
  }
}
```

Available account strategies:

- `least-used`: prefer lower priority, then the account with fewer requests today.
- `round-robin`: cycle among active accounts for the requested provider/model.

Accounts can limit models and daily usage:

```json
{
  "models": ["gpt-5.4-mini"],
  "quota": {
    "requestsPerDay": 500,
    "tokensPerDay": 1000000
  }
}
```

The proxy records daily counters under `state.json` for providers, accounts, and proxy API keys. Set `TICMIRO_PROXY_KEY_DAILY_REQUEST_LIMIT` or `TICMIRO_PROXY_KEY_DAILY_TOKEN_LIMIT` to apply a global daily limit to each user-facing proxy key.

## Refresh behavior

OAuth accounts refresh automatically when a request arrives near expiry. The refresh window defaults to 180 seconds and can be changed with:

```env
TICMIRO_TOKEN_REFRESH_SKEW_SECONDS=180
```

Manual refresh is also available:

```bash
curl -X POST https://codex.example.com/admin/accounts/acct-id/refresh \
  -H "x-control-token: $TICMIRO_ADMIN_TOKEN"
```

## Remaining hardening

- Add encrypted-at-rest token storage for `providers.json`, or keep the data volume on an encrypted/private VPS disk.
- Add provider-specific health checks where the provider exposes quota or account status APIs.
- Keep each provider adapter clean-room and based on public docs or user-owned configs.

## Clean-room rule

Reimplement provider flows from public docs or user-owned configs only.
