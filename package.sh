#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/amplify-advanced-toolkit-<version>.zip
# Only the extension itself is included. The snippet library (head/, body/) is
# fetched from GitHub at runtime, so it stays out of the package.
set -euo pipefail

cd "$(dirname "$0")"

version=$(node -e 'process.stdout.write(require("./manifest.json").version)')
out="dist/amplify-advanced-toolkit-${version}.zip"

# The Chrome Web Store rejects uploads whose manifest description exceeds 132
# characters (and names over 45) - fail fast here instead of at upload time.
node -e '
  const m = require("./manifest.json");
  const fail = (msg) => { console.error("package.sh: " + msg); process.exit(1); };
  if (m.description.length > 132) fail("manifest description is " + m.description.length + " chars (max 132)");
  if (m.name.length > 45) fail("manifest name is " + m.name.length + " chars (max 45)");
'

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
