#!/usr/bin/env bash
# Build a new release from origin/main and switch /opt/sales-engine/current.
# Intended to run on the Azure VM as the deploy user (azureuser).
set -euo pipefail

APP=/opt/sales-engine
CONTROL="$APP/control"
RELEASES="$APP/releases"
SHARED="$APP/shared"
KEEP_RELEASES=5
HEALTH_PORT="${PORT:-3000}"

if [[ ! -d "$CONTROL/.git" ]]; then
  echo "Expected a git checkout at $CONTROL"
  exit 1
fi

mkdir -p "$RELEASES" "$SHARED/data"

exec 9>"$SHARED/deploy.lock"
if ! flock -n 9; then
  echo "Another deploy is already running."
  exit 1
fi

load_node() {
  # GitHub Actions SSH is a non-login shell; nvm/fnm are not on PATH otherwise.
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    nvm use --silent 22 >/dev/null 2>&1 || nvm use --silent default >/dev/null 2>&1 || true
  fi
  if [[ -s "$HOME/.fnm/fnm" ]] || command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --use-on-cd 2>/dev/null || true)"
  fi
  export PATH="/usr/local/bin:/usr/bin:$PATH"
}

git_ok() {
  command git -c "safe.directory=${CONTROL}" "$@"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1"
    exit 1
  }
}

echo "==> Loading Node/npm"
load_node
require_cmd git
require_cmd npm
require_cmd node
require_cmd rsync
require_cmd curl
require_cmd flock

echo "node $(node -v)  npm $(npm -v)"

cd "$CONTROL"

echo "==> Syncing $CONTROL to origin/main"
git_ok fetch origin main

if git_ok rev-parse --verify origin/main >/dev/null 2>&1; then
  local_ahead="$(git_ok rev-list --count origin/main..HEAD 2>/dev/null || echo 0)"
  if [[ "${local_ahead}" != "0" ]]; then
    echo "Discarding ${local_ahead} local commit(s) not on origin/main:"
    git_ok log --oneline origin/main..HEAD || true
  fi
fi

git_ok reset --hard origin/main

if [[ ! -f "$SHARED/.env" ]]; then
  if [[ -f "$CONTROL/.env" ]]; then
    echo "==> One-time copy of $CONTROL/.env -> $SHARED/.env"
    cp "$CONTROL/.env" "$SHARED/.env"
    chmod 600 "$SHARED/.env"
  else
    echo "Missing $SHARED/.env (production secrets). Create it once on the VM."
    exit 1
  fi
fi

if [[ -d "$CONTROL/data" && -z "$(ls -A "$SHARED/data" 2>/dev/null || true)" ]]; then
  echo "==> One-time copy of $CONTROL/data -> $SHARED/data"
  rsync -a "$CONTROL/data/" "$SHARED/data/"
fi

echo "==> Installing dependencies and building"
# tsx is a devDependency; NODE_ENV=production would skip it and break `npm start`.
env NODE_ENV=development npm ci
npm run build

RELEASE="$RELEASES/$(date -u +%Y%m%d%H%M%S)"
echo "==> Creating release $RELEASE"
mkdir -p "$RELEASE"

rsync -a \
  --exclude .git \
  --exclude .env \
  --exclude data \
  --exclude .firecrawl \
  --exclude test-results \
  --exclude playwright-report \
  --exclude coverage \
  "$CONTROL/" "$RELEASE/"

ln -sfn "$SHARED/.env" "$RELEASE/.env"
ln -sfn "$SHARED/data" "$RELEASE/data"
ln -sfn "$RELEASE" "$APP/current"

echo "==> Restarting sales-engine (tunnel service left running)"
sudo systemctl restart sales-engine
sudo systemctl is-active sales-engine

echo "==> Waiting for health checks"
live_ok=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${HEALTH_PORT}/health/live" >/dev/null; then
    live_ok=1
    break
  fi
  sleep 2
done
if [[ "$live_ok" -ne 1 ]]; then
  echo "Liveness check failed on :${HEALTH_PORT}"
  sudo systemctl status sales-engine --no-pager -l || true
  exit 1
fi

curl -fsS "http://127.0.0.1:${HEALTH_PORT}/health/live"
echo
curl -fsS "http://127.0.0.1:${HEALTH_PORT}/health/ready"
echo

echo "==> Pruning old releases (keeping ${KEEP_RELEASES})"
shopt -s nullglob
old_releases=("$RELEASES"/*)
if (( ${#old_releases[@]} > KEEP_RELEASES )); then
  mapfile -t stale < <(printf '%s\n' "${old_releases[@]}" | sort -r | tail -n "+$((KEEP_RELEASES + 1))")
  for old in "${stale[@]}"; do
    echo "Removing $old"
    rm -rf "$old"
  done
fi

echo "==> Deployed $(git_ok -C "$CONTROL" rev-parse --short HEAD) -> $APP/current -> $RELEASE"
