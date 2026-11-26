#!/usr/bin/env bash
set -euo pipefail

APK="${1:?Usage: verify-apk-certificate.sh path/to/app.apk}"
EXPECTED='d43b44d31392824a09641bfbaf829cd1d77d9843c8206e8dc2b44eba937072d8'
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$SDK" ]]; then
  echo 'Set ANDROID_HOME or ANDROID_SDK_ROOT to locate apksigner.' >&2
  exit 1
fi
SIGNER="$SDK/build-tools/36.0.0/apksigner"
if [[ ! -x "$SIGNER" || ! -f "$APK" ]]; then
  echo 'Missing apksigner 36.0.0 or APK.' >&2
  exit 1
fi
verification="$("$SIGNER" verify --print-certs "$APK")"
mapfile -t digests < <(printf '%s\n' "$verification" | sed -nE 's/^Signer #[0-9]+ certificate SHA-256 digest: ([0-9a-fA-F]+)$/\1/p')
if [[ ${#digests[@]} -ne 1 || "${digests[0],,}" != "$EXPECTED" ]]; then
  echo 'APK signature does not match the v64/v65 certificate; refusing to publish it as an update.' >&2
  exit 1
fi
echo 'APK certificate matches v64/v65. This check does not verify runtime functionality.'
