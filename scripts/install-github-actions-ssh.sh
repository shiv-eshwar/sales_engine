#!/usr/bin/env bash
# One-time Azure VM setup: GitHub Actions SSH key + passwordless restart of sales-engine.
# Run on the VM as azureuser, not on a laptop.
set -euo pipefail

APP=/opt/sales-engine
KEY="${HOME}/.ssh/github_actions_sales_engine"
USER_NAME="$(id -un)"
SUDOERS_FILE=/etc/sudoers.d/sales-engine-deploy

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run as azureuser, not root. This script sudoes only for /etc/sudoers.d."
  exit 1
fi

if [[ ! -d "$APP" ]]; then
  echo "This script must run on the Azure VM (expected ${APP})."
  exit 1
fi

mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"

if [[ ! -f "$KEY" ]]; then
  ssh-keygen -t ed25519 -f "$KEY" -C "github-actions-sales-engine" -N ""
  echo "Created $KEY"
else
  echo "Reusing existing $KEY"
fi

touch "${HOME}/.ssh/authorized_keys"
chmod 600 "${HOME}/.ssh/authorized_keys"
PUB="$(cat "${KEY}.pub")"
if grep -qxF "$PUB" "${HOME}/.ssh/authorized_keys"; then
  echo "Public key already in authorized_keys"
else
  echo "$PUB" >> "${HOME}/.ssh/authorized_keys"
  echo "Appended public key to authorized_keys"
fi

SUDOERS_LINE="${USER_NAME} ALL=(root) NOPASSWD: /bin/systemctl restart sales-engine, /bin/systemctl is-active sales-engine, /bin/systemctl status sales-engine"
TMP="$(mktemp)"
printf '%s\n' "$SUDOERS_LINE" >"$TMP"
sudo install -m 440 "$TMP" "$SUDOERS_FILE"
rm -f "$TMP"
sudo visudo -cf "$SUDOERS_FILE"
echo "Wrote $SUDOERS_FILE"

HOST_GUESS="$(curl -fsS -m 3 https://ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)"

cat <<EOF

GitHub Actions can now SSH in as ${USER_NAME}. Add these repo secrets
(Settings → Secrets and variables → Actions), or from your laptop:

  gh secret set AZURE_HOST --body "${HOST_GUESS:-YOUR_VM_PUBLIC_IP_OR_DNS}"
  gh secret set AZURE_USER --body "${USER_NAME}"
  ssh ${USER_NAME}@${HOST_GUESS:-YOUR_VM} 'cat ${KEY}' | gh secret set AZURE_SSH_KEY

Do not commit the private key. Do not paste it into chat.

Then confirm the VM checkout can fetch the private GitHub repo:

  cd ${APP}/control
  git fetch origin main

If fetch asks for a password, add a GitHub deploy key (read-only) to this clone.
Local commits not on origin/main will be discarded on the next auto-deploy.

EOF
