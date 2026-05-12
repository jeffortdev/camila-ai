#!/usr/bin/env bash
# build-apk.sh — Build the Ionic web assets and assemble the Android APK
set -euo pipefail

RELEASE=false
for arg in "$@"; do
  [ "$arg" = "--release" ] && RELEASE=true
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ANDROID_DIR="$PROJECT_ROOT/android"

# ── Validate environment ─────────────────────────────────────────────────────
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "❌ ANDROID_HOME is not set. Set it to your Android SDK path."
  exit 1
fi
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is not installed or not in PATH."
  exit 1
fi

cd "$PROJECT_ROOT"

echo "▶ Building Ionic web assets (--configuration=production)…"
npx ionic build --prod

echo "▶ Syncing Capacitor…"
npx cap sync android

cd "$ANDROID_DIR"

if [ "$RELEASE" = true ]; then
  echo "▶ Assembling release APK…"
  ./gradlew assembleRelease
  APK_PATH=$(find "$ANDROID_DIR/app/build/outputs/apk/release" -name "*.apk" | head -1)
else
  echo "▶ Assembling debug APK…"
  ./gradlew assembleDebug
  APK_PATH=$(find "$ANDROID_DIR/app/build/outputs/apk/debug" -name "*.apk" | head -1)
fi

echo ""
echo "✅ APK built: $APK_PATH"
