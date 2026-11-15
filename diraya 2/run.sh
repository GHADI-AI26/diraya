#!/usr/bin/env bash
# Start Diraya locally: http://127.0.0.1:8000
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PYTHON="${PYTHON:-python3}"

# Thmanyah (Arabic typeface): your own copy, kept in fonts-local/ on this computer only (licence: no redistribution).
# If it is missing, import it automatically from the official package in ~/Downloads.
if ! ls "$ROOT"/fonts-local/thmanyah/*.woff2 >/dev/null 2>&1; then
  PKG="$(ls -t "$HOME"/Downloads/Thmanyah-Font-Family*.zip "$ROOT"/Thmanyah-Font-Family*.zip 2>/dev/null | head -1 || true)"
  if [ -z "$PKG" ] && [ -d "$HOME/Downloads/Thmanyah-Font-Family" ]; then PKG="$HOME/Downloads/Thmanyah-Font-Family"; fi
  if [ -n "$PKG" ]; then "$PYTHON" "$ROOT/backend/scripts/add_thmanyah.py" "$PKG"; fi
fi

cd "$ROOT/backend"
"$PYTHON" -c "import starlette, uvicorn, sklearn, pandas" 2>/dev/null || "$PYTHON" -m pip install -r requirements.txt
exec "$PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8000}"
