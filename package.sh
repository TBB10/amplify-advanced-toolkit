#!/usr/bin/env bash
# Builds the Chrome Web Store upload: dist/amplify-advanced-toolkit-<version>.zip
#
# The repo checkout is the DEV build: orange icons and "(DEV)" in the name so
# an unpacked copy is easy to tell apart from the store copy in Chrome. This
# script stages a clean production copy — store (blue) icons, production name —
# and zips only the extension files. The snippet library (head/, body/) is
# fetched from GitHub at runtime, so it stays out of the package.
set -euo pipefail

cd "$(dirname "$0")"

version=$(node -e 'process.stdout.write(require("./manifest.json").version)')
out="dist/amplify-advanced-toolkit-${version}.zip"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

# Stage extension files.
mkdir -p "$stage/icons" "$stage/lib"
cp popup.html popup.css popup.js "$stage/"
cp lib/*.js "$stage/lib/"
cp icons/store/icon16.png icons/store/icon32.png icons/store/icon48.png icons/store/icon128.png "$stage/icons/"

# Production manifest: strip the (DEV) label, keep everything else verbatim.
node -e '
  const fs = require("fs");
  const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  m.name = m.name.replace(/\s*\(DEV\)\s*$/, "");
  if (m.action && m.action.default_title) {
    m.action.default_title = m.action.default_title.replace(/\s*\(DEV\)\s*$/, "");
  }
  const fail = (msg) => { console.error("package.sh: " + msg); process.exit(1); };
  if (m.description.length > 132) fail("manifest description is " + m.description.length + " chars (max 132)");
  if (m.name.length > 45) fail("manifest name is " + m.name.length + " chars (max 45)");
  fs.writeFileSync(process.argv[1] + "/manifest.json", JSON.stringify(m, null, 2) + "\n");
  console.log("Staged production manifest: " + m.name + " v" + m.version);
' "$stage"

mkdir -p dist
rm -f "$out"
(cd "$stage" && zip -r -X "$OLDPWD/$out" manifest.json popup.html popup.css popup.js icons lib -x '*.DS_Store' >/dev/null)

echo "Wrote $out"
unzip -l "$out"
