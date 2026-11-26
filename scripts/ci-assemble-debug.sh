#!/usr/bin/env bash
set -euo pipefail

# CI only: never print the encoded secret, key bytes, or signing passwords.
if [[ -z "${PATENTE_DEBUG_KEYSTORE_B64:-}" ]]; then
  echo 'PATENTE_DEBUG_KEYSTORE_B64 is required; refusing to build with a different key.' >&2
  exit 1
fi
: "${RUNNER_TEMP:?RUNNER_TEMP must name a temporary directory}"
umask 077
keystore="$(mktemp "$RUNNER_TEMP/patente-debug-keystore.XXXXXXXX")"
trap 'rm -f -- "$keystore"' EXIT
if ! printf '%s' "$PATENTE_DEBUG_KEYSTORE_B64" | base64 --decode > "$keystore" || [[ ! -s "$keystore" ]]; then
  echo 'PATENTE_DEBUG_KEYSTORE_B64 is not a valid non-empty base64 keystore.' >&2
  exit 1
fi
unset PATENTE_DEBUG_KEYSTORE_B64
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root/android"
chmod +x ./gradlew
./gradlew --no-daemon "-PpatenteDebugKeystore=$keystore" :app:assembleDebug :app:testDebugUnitTest
