#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/amplify-advanced-toolkit-<version>.zip
# Only the extension itself is included. The snippet library (head/, body/) is
# fetched from GitHub at runtime, so it stays out of the package.
set -euo pipefail

cd "$(dirname "$0")"

version=$(node -e 'process.stdout.write(require("./manifest.json").version)')
out="dist/amplify-advanced-toolkit-${version}.zip"

mkdir -p dist
rm -f "$out"

zip -r -X "$out" \
  manifest.json \
  popup.html popup.css popup.js \
  icons \
  lib \
  -x '*.DS_Store'

echo "Wrote $out"
unzip -l "$out"
