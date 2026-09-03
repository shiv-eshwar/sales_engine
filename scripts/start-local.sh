#!/usr/bin/env bash
# Build the client and run the production Fastify server on PORT (default 3000).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example, fill values, then rerun."
  exit 1
fi

npm run build
echo "Starting on http://127.0.0.1:${PORT:-3000} (set APP_BASE_URL in .env for Twilio webhooks)"
exec env NODE_ENV=production npx tsx src/server/index.ts
