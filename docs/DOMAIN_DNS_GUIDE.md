# Domain and DNS Guide

This guide explains the `DOMAIN=codex.example.com` part of the install command.

## Short answer

Yes. `DOMAIN=codex.example.com` must be a real domain or subdomain that points to your server public IP address.

Example:

```text
VPS public IP:      203.0.113.10
Domain you own:    example.com
Subdomain to use:  codex.example.com
DNS record:        codex  A  203.0.113.10
Final server URL:  https://codex.example.com
```

Do not literally use `codex.example.com` unless you own `example.com`. Replace it with your own domain.

## Why a domain is needed

The server is meant to be opened from your phone, your Windows PC, and OAuth callback pages. A real HTTPS domain gives you:

- a stable URL for the Mobile Control UI
- an OAuth callback URL like `https://codex.example.com/oauth/callback`
- normal browser security for login flows
- a stable base URL for Codex: `https://codex.example.com/v1`

Many OAuth providers reject plain IP addresses or non-HTTPS callback URLs. Use a domain for the real setup.

## What to prepare

You need:

- a VPS with Ubuntu or Debian
- a domain or subdomain you control
- DNS access for that domain
- ports `80` and `443` open on the VPS firewall
- Docker, installed automatically by the deploy script if missing
- Caddy, installed automatically by the deploy script when `DOMAIN` is set

## Step 1: Choose a subdomain

Pick one subdomain for this service.

Good examples:

```text
codex.yourdomain.com
ticproxy.yourdomain.com
mobile.yourdomain.com
```

In the rest of this guide, replace `codex.example.com` with your real subdomain.

## Step 2: Find the VPS public IP

On the VPS:

```bash
curl -4 ifconfig.me
```

Example output:

```text
203.0.113.10
```

That is the IP address your DNS record should point to.

## Step 3: Add DNS record

In your DNS provider panel, create an `A` record:

```text
Type: A
Name: codex
Value: 203.0.113.10
TTL: Auto or 300
```

If your DNS panel asks for the full host name, use:

```text
codex.example.com
```

If your provider is Cloudflare, start with DNS only while testing. After everything works, you can enable proxy mode if you know you need it.

## Step 4: Wait for DNS

DNS can be ready in a few minutes, but sometimes it takes longer.

Check from your computer:

```bash
nslookup codex.example.com
```

Or from the VPS:

```bash
dig +short codex.example.com
```

The result should be your VPS public IP.

## Step 5: Install the server

On the VPS:

```bash
export DOMAIN=codex.example.com
curl -fsSL https://raw.githubusercontent.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/main/scripts/deploy-server-one-shot.sh | sh
```

At the end, save the printed values:

```text
Mobile token
Windows bridge token
Admin token
Proxy API key for Codex
```

These are secrets. Do not paste them into public chat, issues, screenshots, or docs.

## Step 6: Check HTTPS reverse proxy

The app listens internally on:

```text
127.0.0.1:4899
```

`127.0.0.1` means this VPS itself. It is not your laptop IP and it is not the VPS public IP. This is intentional: the app stays private on the VPS, and only Caddy/Nginx is exposed to the internet.

The public path should be:

```text
phone/browser -> https://codex.example.com -> Caddy on VPS -> 127.0.0.1:4899
```

When `DOMAIN` is set, the deploy script installs Caddy, writes `/etc/caddy/Caddyfile`, and reloads Caddy automatically on Ubuntu/Debian. Set `INSTALL_CADDY=0` only when you want to manage Caddy/Nginx yourself.

### If Caddy was not installed

Official Caddy install docs: https://caddyserver.com/docs/install

Run this only if you installed before the auto-Caddy deploy script existed, or if you set `INSTALL_CADDY=0`:

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Then create Caddy config:

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
codex.example.com {
  reverse_proxy 127.0.0.1:4899
}
EOF

sudo systemctl reload caddy
```

Caddy will request HTTPS certificates automatically when DNS is correct and ports `80` and `443` are reachable.

If you use Google Cloud, AWS, Azure, or another VPS firewall, also allow inbound TCP ports `80` and `443` to the instance. The server can be healthy locally while the public domain still fails if the cloud firewall blocks web traffic.

## Step 7: Test the server

Health check:

```bash
curl https://codex.example.com/health
```

Open the mobile UI:

```text
https://codex.example.com/?token=<Mobile token>
```

Check the proxy:

```bash
curl https://codex.example.com/v1/models \
  -H "Authorization: Bearer <Proxy API key>"
```

## Step 8: Install Windows bridge

On the Windows PC that runs Codex:

Do not paste only `install-windows-bridge.ps1` into a new empty folder. The Windows bridge needs the whole repo folder, including `scripts\start-windows-bridge.ps1` and `apps\windows-bridge\src\index.js`.

Install Node.js 22 LTS first if `node -v` does not work:

```powershell
winget install OpenJS.NodeJS.LTS
```

Beginner option, download and run from GitHub:

```powershell
$Bootstrap = "$env:TEMP\ticproxy-bootstrap-windows-bridge.ps1"
Invoke-WebRequest `
  -Uri "https://raw.githubusercontent.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all/main/scripts/bootstrap-windows-bridge.ps1" `
  -OutFile $Bootstrap
powershell -ExecutionPolicy Bypass -File $Bootstrap -RunNow
```

Developer option, clone the repo:

```powershell
git clone https://github.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all.git
cd codex-mobile-app-one-api-to-rule-them-all

powershell -ExecutionPolicy Bypass -File .\scripts\install-windows-bridge.ps1 -RunNow
```

When asked:

```text
Your server URL: https://codex.example.com
Windows bridge token: <Windows bridge token from server install>
Proxy API key: <Proxy API key from server install>
Codex home folder: usually C:\Users\<you>\.codex
Allowed folders: folders the bridge may read or operate in
```

Check bridge status:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\status-windows-bridge.ps1
Get-Content .\runtime\logs\windows-bridge.log -Tail 80
```

## Copy-paste prompt for vibe-coding assistants

Use this when asking an AI assistant or vibe-coding tool to help install the server:

```text
Install Codex Mobile App on my Ubuntu/Debian VPS.

Repo: https://github.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all
Subdomain: codex.example.com
VPS public IP: 203.0.113.10

First verify that DNS A record codex.example.com points to 203.0.113.10.
Then run the official deploy command from the repo.
Then configure Caddy to reverse_proxy 127.0.0.1:4899.
Then test:
- https://codex.example.com/health
- https://codex.example.com/?token=<Mobile token>
- https://codex.example.com/v1/models with Authorization Bearer <Proxy API key>

Do not expose or print my tokens in public logs.
```

Replace the domain and IP before using the prompt.

## Common mistakes

### Using `codex.example.com` without owning it

`example.com` is only a documentation placeholder. Use your real domain.

### DNS points to the wrong IP

Run:

```bash
nslookup codex.example.com
```

The output must match your VPS public IP.

### Caddy cannot get HTTPS

Check:

- DNS points to the VPS
- ports `80` and `443` are open
- no other process is already using those ports
- the Caddyfile domain matches the DNS name exactly

### Server works on VPS but not from phone

The app container only binds to `127.0.0.1:4899`. That is intentional. Public traffic should go through Caddy or Nginx on HTTPS.

### OAuth callback fails

Make sure the provider callback URL is exactly:

```text
https://codex.example.com/oauth/callback
```

Use the same domain in `DOMAIN`, Caddy, DNS, and provider OAuth settings.
