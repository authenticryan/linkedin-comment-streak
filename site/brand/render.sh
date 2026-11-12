#!/bin/sh
# Renders the Relink mark (brand/mark.html) to every PNG the site and the
# Relink extension use, with headless Chrome (macOS path).
#   sh brand/render.sh                 site icons + brand/out/
#   RELINK_REPO=../../LinkedInIInbox sh brand/render.sh   also the extension icons there
set -e
cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SRC="file://$(pwd)/brand/mark.html"
mkdir -p brand/out

# shot <out.png> <size> <theme> <background RRGGBBAA>
shot() {
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-proxy-server \
    --force-device-scale-factor=1 --default-background-color="$4" --allow-file-access-from-files \
    --window-size="$2,$2" --virtual-time-budget=4000 \
    --screenshot="$1" "$SRC?size=$2&theme=$3" >/dev/null 2>&1
  echo "$1"
}

# Brand masters
shot brand/out/relink-mark-512.png 512 light 00000000
shot brand/out/relink-mark-dark-512.png 512 dark 00000000

# Site
shot public/favicon-32.png 32 light 00000000
shot public/favicon-16.png 16 light 00000000
shot public/apple-touch-icon.png 180 light FFFFFFFF
shot public/assets/relink-mark.png 256 light 00000000

# Chrome extension sizes
for s in 16 32 48 128; do shot "brand/out/extension-$s.png" "$s" light 00000000; done
if [ -n "$RELINK_REPO" ]; then
  for s in 16 32 48 128; do cp "brand/out/extension-$s.png" "$RELINK_REPO/extension/icons/$s.png"; done
  echo "copied extension icons to $RELINK_REPO/extension/icons"
fi
