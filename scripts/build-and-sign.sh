#!/usr/bin/env bash
# build-and-sign.sh — Full pipeline: build release APK → sign → verify
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# ── Load .env ────────────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Missing $ENV_FILE. Copy scripts/.env.example to scripts/.env and fill in your keystore credentials."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${KEYSTORE_PATH:?KEYSTORE_PATH must be set in scripts/.env}"
: "${KEY_ALIAS:?KEY_ALIAS must be set in scripts/.env}"
: "${STORE_PASSWORD:?STORE_PASSWORD must be set in scripts/.env}"
: "${KEY_PASSWORD:?KEY_PASSWORD must be set in scripts/.env}"

# ── Build release APK ────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════"
echo " CamilaAI — Build & Sign Pipeline"
echo "═══════════════════════════════════════════════"

bash "$SCRIPT_DIR/build-apk.sh" --release

PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ANDROID_DIR="$PROJECT_ROOT/android"
UNSIGNED_APK=$(find "$ANDROID_DIR/app/build/outputs/apk/release" -name "*-unsigned*.apk" -o -name "*release*.apk" | head -1)
OUTPUT_APK="$ANDROID_DIR/app/build/outputs/apk/release/camila-ai-release-signed.apk"

# ── Sign ─────────────────────────────────────────────────────────────────────
bash "$SCRIPT_DIR/sign-apk.sh" \
  "$UNSIGNED_APK" \
  "$KEYSTORE_PATH" \
  "$KEY_ALIAS" \
  "$STORE_PASSWORD" \
  "$KEY_PASSWORD" \
  "$OUTPUT_APK"

echo ""
echo "🚀 Final APK ready: $OUTPUT_APK"
