# CamilaAI

A fully on-device AI chat app built with **Ionic + Angular + Capacitor**. All inference runs locally using Hugging Face models via `@huggingface/transformers` (ONNX Runtime Web) — no cloud calls, no API keys.

## Architecture

```
┌─────────────────────────────────────┐
│  Angular UI (Ionic components)      │
│  Chat | Models | History | Settings │
├─────────────────────────────────────┤
│  LlmService (main thread)           │
│  ↕ postMessage / onmessage          │
│  LLM Web Worker                     │
│  @huggingface/transformers          │
│  ONNX Runtime Web (WASM / WebGPU)   │
└─────────────────────────────────────┘
```

Inference runs in a **Web Worker** so the UI stays responsive during model loading and token generation. Tokens stream back to the main thread in real time.

## Supported Models

| Model | Size | Description |
|---|---|---|
| TinyLlama 1.1B Chat | ~670 MB (q4) | Default. Good quality for on-device. |
| Qwen 1.5 0.5B Chat | ~350 MB (q4) | Smallest option, multilingual. |
| GPT-2 (117M) | ~130 MB (fp32) | Ultra-fast, for testing only. |
| Phi-1.5 (1.3B) | ~800 MB (q4) | Strong reasoning for its size. |

Models are downloaded from Hugging Face on first use and cached in the browser's Cache Storage / IndexedDB.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20 LTS or later |
| Ionic CLI | `npm install -g @ionic/cli` |
| Angular CLI | `npm install -g @angular/cli` |
| Capacitor CLI | bundled as dev dependency |
| Android Studio | Hedgehog+ (for Android builds) |
| Xcode | 15+ (macOS, for iOS builds) |
| JDK | 17+ (for `keytool`, Gradle) |

---

## Install

```bash
cd C:\GIT\camila-ai
npm install
```

---

## Run in Browser

```bash
npx ionic serve
```

Open http://localhost:8100. Navigate to **Models**, select a model, and tap **Download & Load**. The model downloads from Hugging Face (~350–800 MB) and is cached locally. Switch to **Chat** and start talking.

---

## Run on Android

```bash
npx ionic build
npx cap sync android
npx cap open android
```

In Android Studio press **Run** (▶). Requires a connected device or emulator with at least 2 GB RAM for TinyLlama.

---

## Run on iOS

```bash
npx ionic build
npx cap sync ios
npx cap open ios
```

In Xcode select your target device and press **Run** (▶). Requires Xcode 15+ on macOS.

---

## Build & Sign APK

### Prerequisites

- `ANDROID_HOME` set to your Android SDK path
- `JAVA_HOME` set to your JDK install
- `zipalign` and `apksigner` in PATH (or in `$ANDROID_HOME/build-tools/<version>/`)
- On Windows: [Git for Windows](https://git-scm.com/download/win) installed so `bash` is available in PATH

All build and sign steps are available as **npm scripts** and can be triggered with `npm run`. The scripts call the `bash` versions of the shell scripts, which work natively on macOS/Linux and via Git Bash on Windows.

### 1. Generate a keystore (first time only)

```bash
npm run keystore:generate
```

<details><summary>Run directly instead</summary>

**Windows (PowerShell):**
```powershell
.\scripts\generate-keystore.ps1 `
  -KeystorePath camila-ai-release.keystore `
  -Alias camila-ai
```

**macOS / Linux:**
```bash
chmod +x scripts/*.sh
./scripts/generate-keystore.sh camila-ai-release.keystore camila-ai
```
</details>

### 2. Configure signing credentials

```bash
cp scripts/.env.example scripts/.env
```

Edit `scripts/.env` — never commit this file:
```
KEYSTORE_PATH=./camila-ai-release.keystore
KEY_ALIAS=camila-ai
STORE_PASSWORD=your-keystore-password
KEY_PASSWORD=your-key-password
```

### 3. Debug APK (no signing needed)

```bash
npm run build:apk
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

<details><summary>Run directly instead</summary>

**Windows:** `.\ scripts\build-apk.ps1`  
**macOS / Linux:** `./scripts/build-apk.sh`
</details>

### 4. Release APK (unsigned)

```bash
npm run build:apk:release
```

Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

<details><summary>Run directly instead</summary>

**Windows:** `.\scripts\build-apk.ps1 -Release`  
**macOS / Linux:** `./scripts/build-apk.sh --release`
</details>

### 5. Sign the release APK

`sign-apk.sh` takes explicit arguments. Call it directly:

```bash
bash scripts/sign-apk.sh \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  camila-ai-release.keystore camila-ai \
  your-store-pass your-key-pass
```

**Windows (PowerShell):**
```powershell
.\scripts\sign-apk.ps1 `
  -UnsignedApk "android\app\build\outputs\apk\release\app-release-unsigned.apk" `
  -KeystorePath camila-ai-release.keystore `
  -Alias camila-ai `
  -StorePassword "your-pass" `
  -KeyPassword "your-pass"
```

### 6. Full pipeline (build + sign in one command)

Requires `scripts/.env` to be configured (step 2).

```bash
npm run build:sign
```

Output: `android/app/build/outputs/apk/release/camila-ai-release-signed.apk`

<details><summary>Run directly instead</summary>

**Windows:** `.\scripts\build-and-sign.ps1`  
**macOS / Linux:** `./scripts/build-and-sign.sh`
</details>

---

## Project Structure

```
src/app/
  tab1/        — Chat page
  tab2/        — Models management page
  tab3/        — Conversation history page
  tab4/        — Settings page
  tabs/        — Tab bar shell
  workers/     — LLM Web Worker (llm.worker.ts)
  services/    — LlmService, ChatService, SettingsService, ModelsCatalogService
  interfaces/  — TypeScript interfaces & types

scripts/
  generate-keystore.{ps1,sh}   — Create signing keystore  (npm run keystore:generate)
  build-apk.{ps1,sh}           — Build debug or release APK (npm run build:apk / build:apk:release)
  sign-apk.{ps1,sh}            — Zipalign + sign APK
  build-and-sign.{ps1,sh}      — Full pipeline             (npm run build:sign)
  .env.example                 — Template for signing credentials
```

---

## Notes

- First model download can take several minutes depending on network speed. Progress is shown in the Models tab.
- Models are cached in browser storage. On Android, the cache persists between app restarts.
- The Web Worker uses `dtype: 'q4'` quantization for all models to reduce memory footprint.
- WASM SIMD acceleration is automatically used when available (Chrome, Edge, Firefox).
