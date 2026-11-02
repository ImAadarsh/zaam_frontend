#!/usr/bin/env bash
# Deploy Zaam Panels (Next.js ERP UI) to Zaam Hostinger VPS.
#
# Portal: https://erp.zaamaitech.co.uk
# API:    https://erp-api.zaamaitech.co.uk  (Hostinger VPS PM2 zaam-api :4011)
#
# Edge: Traefik (:80/:443) → PM2 Next.js on :4010
# Auth: ~/.ssh/id_ed25519_hostinger (no password)
#
# Usage (from zaam-panels/):
#   ./deploy_web.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

ssh_user="${SSH_USER:-root}"
ssh_host="${SSH_HOST:-153.92.209.187}"
ssh_key="${SSH_KEY:-$HOME/.ssh/id_ed25519_hostinger}"
app_dir="${APP_DIR:-/var/www/zaam-panels}"
git_repo="${GIT_REPO:-git@github.com:ImAadarsh/zaam_frontend.git}"
branch="${BRANCH:-main}"
process_name="${PROCESS_NAME:-zaam-panels}"
api_port="${PORT:-4010}"
domain="${WEB_DOMAIN:-erp.zaamaitech.co.uk}"
traefik_dir="${TRAEFIK_DIR:-/docker/traefik-xtyj}"
# Browser-facing API origin (paths use ${NEXT_PUBLIC_API_BASE}/api/...)
next_public_api_base="${NEXT_PUBLIC_API_BASE:-https://erp-api.zaamaitech.co.uk}"
portal_origin="https://${domain}"

ssh_target="${ssh_user}@${ssh_host}"
ssh_base_opts=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 -i "$ssh_key" -o IdentitiesOnly=yes -o BatchMode=yes)

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$ssh_key" ]] || die "SSH key not found: ${ssh_key}"

remote() {
  ssh "${ssh_base_opts[@]}" "$ssh_target" "$@"
}

ensure_traefik_proxy() {
  log "Ensuring Traefik routes https://${domain} → 127.0.0.1:${api_port}…"
  remote "set -euo pipefail
mkdir -p '${traefik_dir}/dynamic'
cat > '${traefik_dir}/dynamic/zaam-panels.yml' <<'YAML'
http:
  routers:
    zaam-panels:
      rule: Host(\`${domain}\`)
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      service: zaam-panels
      priority: 10
    zaam-panels-http:
      rule: Host(\`${domain}\`)
      entryPoints:
        - web
      middlewares:
        - zaam-panels-https-redirect
      service: zaam-panels
      priority: 10
  middlewares:
    zaam-panels-https-redirect:
      redirectScheme:
        scheme: https
        permanent: true
  services:
    zaam-panels:
      loadBalancer:
        servers:
          - url: http://127.0.0.1:${api_port}
YAML
cd '${traefik_dir}'
docker compose up -d
"
}

rsync_source() {
  log "Rsyncing panels source to ${app_dir}…"
  remote "mkdir -p '${app_dir}'"
  rsync -az --delete \
    --exclude node_modules \
    --exclude .git \
    --exclude .next \
    --exclude .env \
    --exclude .env.local \
    --exclude .env.production \
    --exclude '.DS_Store' \
    -e "ssh ${ssh_base_opts[*]}" \
    "$SCRIPT_DIR/" "${ssh_target}:${app_dir}/"
}

ensure_server_env() {
  log "Writing production env on server (PORT + NEXT_PUBLIC_API_BASE)…"
  remote "set -euo pipefail
cat > '${app_dir}/.env' <<EOF
NODE_ENV=production
PORT=${api_port}
HOSTNAME=0.0.0.0
NEXT_PUBLIC_API_BASE=${next_public_api_base}
EOF
cp -a '${app_dir}/.env' '${app_dir}/.env.production'
cp -a '${app_dir}/.env' '${app_dir}/.env.local'
chmod 600 '${app_dir}/.env' '${app_dir}/.env.production' '${app_dir}/.env.local'
grep -E '^(NODE_ENV|PORT|HOSTNAME|NEXT_PUBLIC_API_BASE)=' '${app_dir}/.env'
"
}

build_and_restart() {
  log "Building Next.js and restarting PM2 (${process_name})…"
  remote "set -euo pipefail
cd '${app_dir}'
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build
mkdir -p logs

if pm2 describe '${process_name}' >/dev/null 2>&1; then
  pm2 delete '${process_name}' >/dev/null || true
fi
PORT='${api_port}' HOSTNAME=0.0.0.0 pm2 start npm --name '${process_name}' --time -- start
pm2 save
"
}

health_checks() {
  log "Waiting for local health on :${api_port}…"
  remote "set -e
for i in \$(seq 1 60); do
  code=\$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 2 'http://127.0.0.1:${api_port}/' || echo 000)
  case \"\$code\" in
    200|301|302|307|308) echo \"Local OK (HTTP \$code)\"; exit 0 ;;
  esac
  sleep 1
done
echo 'Local web failed to become ready' >&2
pm2 logs '${process_name}' --lines 40 --nostream || true
exit 1
"

  log "Checking public HTTPS https://${domain}/ …"
  sleep 5
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 25 "https://${domain}/" || echo 000)"
  case "$code" in
    200|301|302|307|308) log "Public HTTPS OK (HTTP ${code})." ;;
    *) log "WARN: public HTTPS returned HTTP ${code} (cert may still be issuing)." ;;
  esac

  log "Checking production API reachable…"
  api_code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 15 "${next_public_api_base}/api" || echo 000)"
  log "API ${next_public_api_base}/api → HTTP ${api_code}"

  log "Web deploy complete."
  log "Portal: ${portal_origin}"
  log "API:    ${next_public_api_base}"
  log "Note: zaam-api runs on this VPS at https://erp-api.zaamaitech.co.uk (PM2 zaam-api :4011)."
}

[[ "${1:-}" == "--help" ]] && { sed -n '2,16p' "$0"; exit 0; }

ensure_traefik_proxy
rsync_source
ensure_server_env
build_and_restart
health_checks
