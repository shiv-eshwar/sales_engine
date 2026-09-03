#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
BASE="http://127.0.0.1:${PORT}"

echo "=== ${BASE}/health/live ==="
curl -sS "${BASE}/health/live" || { echo "Server not running. Run: ./scripts/start-local.sh"; exit 1; }
echo
echo "=== ${BASE}/health/ready ==="
curl -sS "${BASE}/health/ready" | python3 -m json.tool 2>/dev/null || curl -sS "${BASE}/health/ready"
echo
if command -v ngrok >/dev/null 2>&1; then
  echo "=== ngrok ==="
  curl -sS http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for t in d.get('tunnels', []):
        if t.get('public_url', '').startswith('https'):
            print(t['public_url'])
except Exception:
    print('(no tunnel on :4040)')
" || echo "(ngrok API unavailable)"
fi
if [[ -f .local-run.txt ]]; then
  echo
  echo "=== operator notes (.local-run.txt) ==="
  head -6 .local-run.txt
fi
