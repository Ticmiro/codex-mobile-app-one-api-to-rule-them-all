#!/usr/bin/env sh
set -eu

REPO_URL="${REPO_URL:-https://github.com/Ticmiro/codex-mobile-app-one-api-to-rule-them-all.git}"
REF="${REF:-main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/codex-mobile-app-one-api-to-rule-them-all}"
DOMAIN="${DOMAIN:-}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-}"
INSTALL_DOCKER="${INSTALL_DOCKER:-1}"
INSTALL_CADDY="${INSTALL_CADDY:-1}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

as_root() {
  if [ "$(id -u)" = "0" ]; then
    "$@"
  elif need_cmd sudo; then
    sudo "$@"
  else
    echo "Root permission is required. Re-run as root or install sudo." >&2
    exit 1
  fi
}

random_token() {
  if need_cmd openssl; then
    openssl rand -hex 24
  else
    date +%s | sha256sum | awk '{print $1}'
  fi
}

read_existing_env() {
  key="$1"
  env_file="$INSTALL_DIR/.env"
  if [ ! -f "$env_file" ]; then
    return
  fi
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
}

token_value() {
  key="$1"
  current="$(eval "printf '%s' \"\${$key:-}\"")"
  if [ -n "$current" ]; then
    printf '%s' "$current"
    return
  fi
  existing="$(read_existing_env "$key")"
  if [ -n "$existing" ]; then
    printf '%s' "$existing"
    return
  fi
  random_token
}

install_caddy() {
  if need_cmd caddy; then
    return
  fi
  if ! need_cmd apt-get; then
    echo "Caddy auto-install needs apt-get. Install Caddy manually or set INSTALL_CADDY=0." >&2
    exit 1
  fi

  echo "==> Installing Caddy"
  as_root apt-get update
  as_root apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg

  key_tmp="$(mktemp)"
  list_tmp="$(mktemp)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' -o "$key_tmp"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o "$list_tmp"
  as_root gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg "$key_tmp"
  as_root cp "$list_tmp" /etc/apt/sources.list.d/caddy-stable.list
  rm -f "$key_tmp" "$list_tmp"

  as_root chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  as_root chmod o+r /etc/apt/sources.list.d/caddy-stable.list
  as_root apt-get update
  as_root apt-get install -y caddy
}

configure_caddy() {
  caddy_tmp="$(mktemp)"
  cat > "$caddy_tmp" <<EOF
$DOMAIN {
  reverse_proxy 127.0.0.1:4899
}
EOF
  as_root mkdir -p /etc/caddy
  as_root cp "$caddy_tmp" /etc/caddy/Caddyfile
  rm -f "$caddy_tmp"

  if need_cmd systemctl; then
    as_root systemctl reload caddy || as_root systemctl restart caddy
  else
    as_root caddy reload --config /etc/caddy/Caddyfile || as_root caddy start --config /etc/caddy/Caddyfile
  fi
}

if [ -z "$PUBLIC_BASE_URL" ] && [ -n "$DOMAIN" ]; then
  PUBLIC_BASE_URL="https://$DOMAIN"
fi
if [ -z "$PUBLIC_BASE_URL" ]; then
  echo "Set DOMAIN=codex.example.com or PUBLIC_BASE_URL=https://codex.example.com" >&2
  exit 1
fi

echo "==> Codex Mobile App deploy"

if ! need_cmd docker; then
  if [ "$INSTALL_DOCKER" = "1" ]; then
    echo "==> Installing Docker"
    curl -fsSL https://get.docker.com | as_root sh
  else
    echo "Docker is required." >&2
    exit 1
  fi
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required." >&2
  exit 1
fi

if ! need_cmd git; then
  as_root apt-get update
  as_root apt-get install -y git
fi

MOBILE_TOKEN="$(token_value TICMIRO_MOBILE_TOKEN)"
AGENT_TOKEN="$(token_value TICMIRO_AGENT_TOKEN)"
ADMIN_TOKEN="$(token_value TICMIRO_ADMIN_TOKEN)"
PROXY_KEY="$(token_value TICMIRO_PROXY_API_KEY)"

echo "==> Installing source to $INSTALL_DIR"
if [ -d "$INSTALL_DIR/.git" ]; then
  git -C "$INSTALL_DIR" fetch --all --tags
  git -C "$INSTALL_DIR" checkout "$REF"
  git -C "$INSTALL_DIR" pull --ff-only || true
else
  as_root mkdir -p "$INSTALL_DIR"
  as_root chown "$(id -u):$(id -g)" "$INSTALL_DIR"
  git clone --branch "$REF" "$REPO_URL" "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR/data"
cat > "$INSTALL_DIR/.env" <<EOF
TICMIRO_PORT=4899
TICMIRO_HOST=0.0.0.0
TICMIRO_PUBLIC_BASE_URL=$PUBLIC_BASE_URL
TICMIRO_DATA_DIR=/app/data
TICMIRO_MOBILE_TOKEN=$MOBILE_TOKEN
TICMIRO_AGENT_TOKEN=$AGENT_TOKEN
TICMIRO_ADMIN_TOKEN=$ADMIN_TOKEN
TICMIRO_PROXY_API_KEYS=$PROXY_KEY
EOF

if [ ! -f "$INSTALL_DIR/data/providers.json" ]; then
  cp "$INSTALL_DIR/examples/providers.example.json" "$INSTALL_DIR/data/providers.json"
fi

echo "==> Starting server"
cd "$INSTALL_DIR"
docker compose up -d --build

if [ -n "$DOMAIN" ] && [ "$INSTALL_CADDY" = "1" ]; then
  install_caddy
  echo "==> Configuring Caddy for $DOMAIN"
  configure_caddy
fi

echo ""
echo "Server installed."
echo "Public URL: $PUBLIC_BASE_URL"
echo "Mobile token: $MOBILE_TOKEN"
echo "Windows bridge token: $AGENT_TOKEN"
echo "Admin token: $ADMIN_TOKEN"
echo "Proxy API key for Codex: $PROXY_KEY"
echo ""
echo "Use this in the Windows bridge:"
echo "  Server URL: $PUBLIC_BASE_URL"
echo "  Bridge token: $AGENT_TOKEN"
echo "  Proxy API key: $PROXY_KEY"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "Important:"
  echo "  The Docker app is listening on this VPS only at http://127.0.0.1:4899."
  echo "  127.0.0.1 means this VPS itself, not your home PC and not the public VPS IP."
  echo "  External users reach the app through HTTPS on your domain, then Caddy/Nginx forwards to 127.0.0.1:4899."
  echo ""
  if [ "$INSTALL_CADDY" = "1" ]; then
    echo "Caddy was installed/configured at /etc/caddy/Caddyfile."
    echo "Test it with:"
    echo "  curl $PUBLIC_BASE_URL/health"
  else
    echo "INSTALL_CADDY=0 was set, so Caddy was not installed/configured."
    echo "Apply this reverse proxy manually:"
    echo "$DOMAIN {"
    echo "  reverse_proxy 127.0.0.1:4899"
    echo "}"
  fi
fi
