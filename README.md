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

- Android Studio installed with the Android SDK
- `ANDROID_HOME` set to your Android SDK path
- `JAVA_HOME` set to your JDK install (JDK 17+)

### 1. Generate a keystore (first time only)

```bash
npm run keystore:generate
```

This runs `keytool` interactively — you will be prompted for passwords and distinguished name. Store the generated `.keystore` file securely and never commit it.

### 2. Debug APK

```bash
npm run build:apk
```

Runs: `ionic build --prod` → `cap sync android` → `cap build android`

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Signed release APK

```bash
npm run build:sign
```

Runs: `ionic build --prod` → `cap sync android` → `cap build android` with keystore flags.

You will be prompted for your keystore and key passwords by Capacitor. Output: `android/app/build/outputs/apk/release/`

Alternatively, pass passwords inline (avoid on shared machines):

```bash
npx cap build android \
  --keystorepath camila-ai-release.keystore \
  --keystorealias camila-ai \
  --keystorepassword your-store-pass \
  --keystorealiaspassword your-key-pass \
  --androidreleasetype APK
```

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
```

---

## Notes

- First model download can take several minutes depending on network speed. Progress is shown in the Models tab.
- Models are cached in browser storage. On Android, the cache persists between app restarts.
- The Web Worker uses `dtype: 'q4'` quantization for all models to reduce memory footprint.
- WASM SIMD acceleration is automatically used when available (Chrome, Edge, Firefox).
