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

## Add an SSH key directly from an existing root shell

If you are already logged in as `root`, do not paste `user:ssh-rsa ...` into the shell. That `user:` prefix is for Google metadata only.

To create a normal Linux user named `ticmiro` and allow this repo maintainer key:

```bash
sudo useradd -m -s /bin/bash ticmiro 2>/dev/null || true
sudo usermod -aG sudo ticmiro
sudo install -d -m 700 -o ticmiro -g ticmiro /home/ticmiro/.ssh
sudo tee -a /home/ticmiro/.ssh/authorized_keys >/dev/null <<'EOF'
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDF2EF7JRpEOtJLYoXkzD6x21RisxzvGe/2c97jKvRrxj0xngxcWKvWHfeZhVZLuPqI3C/FN29KUUQbYxp/a/DSDn7fQmVi8ZRqG0EyYiDdvEqbn7ceI01Mt7B2o1DfQBQmm/sMpFd3tCdtoby09Kgo5ywWEd/1zPvTEOxYa2E1+oazgP73jhl+yHvXTzGw4jS3p2sSW7Z9Noc5U1n4Xg3tFQtq1K4EPLg/j0QKpqcZ5fJUCPCvpGwjf+PSENIlcBPqmLLlkZF5iCfCCopw74tBOqlIk3d33/7Y58Byj+8JjnEfrdcwFk/iV4xssBIYAjCxrI7rKhD0jqg7pqwvegLcuZjcdsbpZKQ+TUyEenJaFIqf5eVLK7ocKm8XqwEtVaX4m4GK1ZSNkWiwCr4/T1Y0tbsNcCtSGcXJ96ZLDznmUet7Ai+0/4/cL4ayBmfqZkB9FUem87GVpXU1Eb+Y7qIvrhLg4PI+s8zogvVyKtvIVNmE7VlDV1SgFjeyCJELcdE= ticmiro
EOF
sudo chown ticmiro:ticmiro /home/ticmiro/.ssh/authorized_keys
sudo chmod 600 /home/ticmiro/.ssh/authorized_keys
```

Then the maintainer can test:

```bash
ssh -i ~/.ssh/gcp_key ticmiro@your-server-ip
```

If your cloud image enforces Google OS Login, local `authorized_keys` may be ignored. In that case, add the key through the cloud provider metadata or temporarily disable OS Login for the instance.
