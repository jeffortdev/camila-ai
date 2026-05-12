#!/usr/bin/env bash
# sign-apk.sh — Zipalign + sign a release APK with apksigner
set -euo pipefail

UNSIGNED_APK="${1:?Usage: sign-apk.sh <unsigned-apk> <keystore-path> <alias> <store-pass> <key-pass> [output-apk]}"
KEYSTORE_PATH="${2:?}"
ALIAS="${3:?}"
STORE_PASSWORD="${4:?}"
KEY_PASSWORD="${5:?}"
OUTPUT_APK="${6:-${UNSIGNED_APK%.apk}-signed.apk}"

ZIPALIGN="${ANDROID_HOME}/build-tools/$(ls "${ANDROID_HOME}/build-tools" | sort -V | tail -1)/zipalign"
APKSIGNER="${ANDROID_HOME}/build-tools/$(ls "${ANDROID_HOME}/build-tools" | sort -V | tail -1)/apksigner"

ALIGNED_APK="${UNSIGNED_APK%.apk}-aligned.apk"

echo "▶ Zipaligning…"
"$ZIPALIGN" -v 4 "$UNSIGNED_APK" "$ALIGNED_APK"

echo "▶ Signing with apksigner…"
"$APKSIGNER" sign \
  --ks "$KEYSTORE_PATH" \
  --ks-key-alias "$ALIAS" \
  --ks-pass "pass:$STORE_PASSWORD" \
  --key-pass "pass:$KEY_PASSWORD" \
  --out "$OUTPUT_APK" \
  "$ALIGNED_APK"

echo "▶ Verifying signature…"
"$APKSIGNER" verify --verbose "$OUTPUT_APK"

# Cleanup intermediate
rm -f "$ALIGNED_APK"

echo ""
echo "✅ Signed APK: $OUTPUT_APK"
