#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# A fresh OAuth session avoids sharing a rotating refresh token with another proxy.
docker compose --env-file .env -f infra/litellm/compose.yaml exec litellm \
  python -c 'import os; os.umask(0o077); from litellm.llms.chatgpt.authenticator import Authenticator; auth = Authenticator(); auth._login_device_code(); os.chmod(auth.auth_file, 0o600); print("ChatGPT subscription connected.")'
