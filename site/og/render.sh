#!/bin/sh
# Renders og/og.html to public/og.png (1200x630) with headless Chrome (macOS path).
set -e
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-proxy-server --force-device-scale-factor=1 \
  --allow-file-access-from-files --window-size=1200,630 --virtual-time-budget=5000 \
  --screenshot="public/og.png" "file://$(pwd)/og/og.html" >/dev/null 2>&1
echo public/og.png
