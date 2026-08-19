#!/usr/bin/env bash
# Serve the site locally and open it in your browser.
#   ./serve.sh          -> http://localhost:8000
#   ./serve.sh 3000     -> http://localhost:3000
set -euo pipefail

PORT="${1:-8000}"
URL="http://localhost:$PORT"

cd "$(dirname "$0")"

echo "Serving $(pwd) at $URL"
echo "Press Ctrl+C to stop."

# Open the browser once the server is actually up.
(
  for _ in $(seq 1 40); do
    if curl -sfo /dev/null "$URL"; then break; fi
    sleep 0.25
  done
  if command -v open >/dev/null 2>&1; then open "$URL"          # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" # Linux
  fi
) >/dev/null 2>&1 &

exec python3 -m http.server "$PORT"
