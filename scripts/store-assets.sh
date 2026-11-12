#!/bin/sh
# Renders the Chrome Web Store images into store/ using headless Chrome (macOS path).
set -e
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT=8799

python3 scripts/make-icons.py

# The real popup, with fake data injected, served next to the extension files.
sed 's#<head>#<head><base href="/extension/"><script src="/store/src/stub.js"></script>#' \
  extension/popup.html > store/src/popup-demo.html

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -f store/src/popup-demo.html' EXIT
sleep 1

shot() { # out width height url [extra flags]
  out=$1 w=$2 h=$3 url=$4; shift 4
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$w,$h" --virtual-time-budget=3000 --no-proxy-server "$@" --screenshot="$out" "$url" >/dev/null 2>&1
  echo "$out"
}

# 127.0.0.1, not localhost: some sandboxes and proxies treat them differently.
URL="http://127.0.0.1:$PORT/store/src/screenshot.html"
shot store/screenshot-1-1280x800.png 1280 800 "$URL?v=1"
shot store/screenshot-2-1280x800.png 1280 800 "$URL?v=2" --force-dark-mode --force-prefers-reduced-motion
shot store/screenshot-3-1280x800.png 1280 800 "$URL?v=3"
shot store/screenshot-4-1280x800.png 1280 800 "$URL?v=4" --force-dark-mode
shot store/promo-small-440x280.png 440 280 "http://127.0.0.1:$PORT/store/src/promo.html"
