#!/bin/sh
# Link this plugin into the DSH desktop profile and enable its bundle.
#
# The official `dsh` CLI refuses profiles owned by the Electron App
# ("profile desktop is managed exclusively by the Electron application"), so this
# script performs the same two steps the App's plugin manager performs:
#   1. `pnpm add link:<plugin dir>` inside the profile (uses the App's own runtime);
#   2. append the bundle name to package.json's dsh.profile.bundles.
# The running host picks the change up through profile HMR; refresh the page.
set -eu

PROFILE="${1:-desktop}"
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP="/Applications/DeepSeek Harness.app/Contents/Resources"
NODE="$APP/runtime/primary-runtime/dependencies/node/bin/node"
PNPM="$APP/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs"
PROFILE_DIR="${DSH_HOME:-$HOME/.dsh}/profiles/$PROFILE"

if [ ! -x "$NODE" ]; then
  echo "desktop runtime not found at: $NODE" >&2
  echo "run instead: dsh plugin --profile $PROFILE add $PLUGIN_DIR" >&2
  exit 1
fi
if [ ! -d "$PROFILE_DIR" ]; then
  echo "profile directory not found: $PROFILE_DIR" >&2
  exit 1
fi

echo "[dsh-pdf-panel] linking $PLUGIN_DIR into $PROFILE_DIR"
cd "$PROFILE_DIR"
"$NODE" "$PNPM" add --ignore-scripts "link:$PLUGIN_DIR"

"$NODE" - "$PROFILE_DIR/package.json" <<'NODE'
const { readFileSync, writeFileSync, renameSync } = require('node:fs')
const file = process.argv[2]
const manifest = JSON.parse(readFileSync(file, 'utf8'))
const bundles = manifest?.dsh?.profile?.bundles
if (!Array.isArray(bundles)) {
  console.error('profile manifest has no dsh.profile.bundles list'); process.exit(1)
}
if (!bundles.includes('dsh-pdf-panel')) {
  bundles.push('dsh-pdf-panel')
  const tmp = `${file}.dsh-pdf-panel.tmp`
  writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`)
  renameSync(tmp, file)
  console.log('[dsh-pdf-panel] added "dsh-pdf-panel" to dsh.profile.bundles')
} else {
  console.log('[dsh-pdf-panel] bundle already enabled')
}
NODE

echo "[dsh-pdf-panel] installed. Refresh the DSH page (Cmd+R on desktop) to load the UI."
