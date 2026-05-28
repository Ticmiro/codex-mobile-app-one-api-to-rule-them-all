# Server Troubleshooting

Use this when the deploy script finished but the browser or Windows bridge cannot connect.

## Understand `127.0.0.1:4899`

The Docker server is intentionally published only on the VPS loopback interface:

```text
127.0.0.1:4899
```

That means only processes on the VPS can reach it directly.

Public traffic should use this path:

```text
phone/browser -> https://your-domain -> Caddy/Nginx on VPS -> 127.0.0.1:4899
```

Do not replace `127.0.0.1` in the Caddy config with your VPS public IP. The Caddy config is executed on the VPS, so `127.0.0.1` means "this same server."

## Quick checks on the VPS

Run these from SSH:

```bash
cd /opt/codex-mobile-app-one-api-to-rule-them-all

docker compose ps
docker compose logs --tail=120 ticproxy-codex-mobile
curl -sS http://127.0.0.1:4899/health
```

If local health works but the public URL fails, the issue is outside the app: Caddy/Nginx, DNS, or firewall.

## Apply Caddy config

Current versions of `scripts/deploy-server-one-shot.sh` install and configure Caddy automatically when `DOMAIN` is set. Use this section if you installed before that change, disabled it with `INSTALL_CADDY=0`, or the Caddy service is missing.

Install Caddy on Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

Replace `codex.example.com` with your real domain:

```bash
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
codex.example.com {
  reverse_proxy 127.0.0.1:4899
}
EOF

sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

Then test:

```bash
curl -sS https://codex.example.com/health
```

## Open firewall ports

The VPS must allow inbound:

```text
TCP 80
TCP 443
```

On Ubuntu `ufw`, if enabled:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

On Google Cloud, also add a VPC firewall rule for ports `80,443` or attach a network tag that already allows HTTP/HTTPS traffic.

## Add your SSH key directly from an existing root shell

If you are already logged in as `root`, do not paste `user:ssh-rsa ...` into the shell. That `user:` prefix is for Google metadata only.

To create a normal Linux user and allow your own SSH public key:

```bash
export SSH_USER=codexmobile
export SSH_PUBLIC_KEY='ssh-ed25519 AAAA... your-key-comment'
sudo useradd -m -s /bin/bash "$SSH_USER" 2>/dev/null || true
sudo usermod -aG sudo "$SSH_USER"
sudo install -d -m 700 -o "$SSH_USER" -g "$SSH_USER" "/home/$SSH_USER/.ssh"
printf '%s\n' "$SSH_PUBLIC_KEY" | sudo tee -a "/home/$SSH_USER/.ssh/authorized_keys" >/dev/null
sudo chown "$SSH_USER:$SSH_USER" "/home/$SSH_USER/.ssh/authorized_keys"
sudo chmod 600 "/home/$SSH_USER/.ssh/authorized_keys"
```

Then test:

```bash
ssh -i ~/.ssh/your_private_key codexmobile@your-server-ip
```

If your cloud image enforces Google OS Login, local `authorized_keys` may be ignored. In that case, add the key through the cloud provider metadata or temporarily disable OS Login for the instance.
