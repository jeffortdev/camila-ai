#!/usr/bin/env bash
# generate-keystore.sh — Create a new Android signing keystore
set -euo pipefail

KEYSTORE_PATH="${1:-camila-ai-release.keystore}"
ALIAS="${2:-camila-ai}"
STORE_PASSWORD="${3:-}"
KEY_PASSWORD="${4:-}"
VALIDITY="${5:-10000}"
DNAME="${6:-CN=CamilaAI, OU=Mobile, O=CamilaAI, L=Unknown, ST=Unknown, C=US}"

if [ -f "$KEYSTORE_PATH" ]; then
  echo "⚠️  Keystore already exists at '$KEYSTORE_PATH'. Skipping generation."
  exit 0
fi

if [ -z "$STORE_PASSWORD" ]; then
  read -rsp "Enter keystore password: " STORE_PASSWORD; echo
fi
if [ -z "$KEY_PASSWORD" ]; then
  read -rsp "Enter key password: " KEY_PASSWORD; echo
fi

echo "Generating keystore at $KEYSTORE_PATH …"
keytool -genkeypair \
  -v \
  -keystore "$KEYSTORE_PATH" \
  -alias "$ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$VALIDITY" \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname "$DNAME"

echo ""
echo "✅ Keystore created: $KEYSTORE_PATH"
echo ""
echo "Fingerprint:"
keytool -list -v -keystore "$KEYSTORE_PATH" -alias "$ALIAS" -storepass "$STORE_PASSWORD" | grep "SHA256:"
