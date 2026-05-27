# Security Policy

This project stores sensitive tokens on the user's own server and Windows PC.

## Secrets

Never commit:

- `.env`
- `.env.local`
- `data/providers.json`
- `runtime/`
- OAuth access or refresh tokens
- Proxy API keys

## Server exposure

Expose only HTTPS through a reverse proxy. The app itself should listen on `127.0.0.1:4899` behind Caddy/Nginx unless you know what you are doing.

Use different values for:

- `TICMIRO_MOBILE_TOKEN`
- `TICMIRO_AGENT_TOKEN`
- `TICMIRO_ADMIN_TOKEN`
- `TICMIRO_PROXY_API_KEYS`

## Windows bridge

The Windows bridge should not expose inbound ports. It should only make outbound requests to the user's server.

## Reporting

For public forks, use GitHub Security Advisories or private email listed by the maintainer.
