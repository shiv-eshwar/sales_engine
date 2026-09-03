#!/usr/bin/env bash
# Expose local Fastify (port 3000) for Twilio webhooks. After starting, set APP_BASE_URL
# in .env to the printed https URL and restart the app.
set -euo pipefail
PORT="${1:-3000}"
if ! command -v ngrok >/dev/null 2>&1; then
  echo "ngrok not found. Install: brew install ngrok/ngrok/ngrok"
  exit 1
fi
echo "Tunneling http://127.0.0.1:${PORT} — set APP_BASE_URL to the https URL, then restart the app."
exec ngrok http "$PORT"
