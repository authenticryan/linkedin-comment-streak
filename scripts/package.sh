#!/bin/sh
# Builds the zip you upload to the Chrome Web Store: dist/linkedin-comment-streak-<version>.zip
set -e
cd "$(dirname "$0")/.."
VERSION=$(node -p "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8')).version")
OUT="dist/linkedin-comment-streak-$VERSION.zip"
mkdir -p dist
rm -f "$OUT"
(cd extension && zip -qr "../$OUT" . -x '.*' -x '*/.*')
echo "$OUT"
