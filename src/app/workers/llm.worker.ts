/// <reference lib="webworker" />
import { pipeline, TextStreamer, env } from '@huggingface/transformers';

// Allow remote models, disable local model lookup
env.allowLocalModels = false;
env.allowRemoteModels = true;

// Use all available CPU cores for WASM (capped at 4 to avoid diminishing returns)
env.backends.onnx.wasm.numThreads = Math.min((navigator as Navigator).hardwareConcurrency ?? 2, 4);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipe: any = null;
let currentModelId: string | null = null;

interface LoadModelMsg   { type: 'LOAD_MODEL';  modelId: string; dtype: string; hfToken?: string; }
interface GenerateMsg    { type: 'GENERATE';    messages: Array<{ role: string; content: string }>; temperature: number; maxNewTokens: number; topP: number; }
interface UnloadMsg      { type: 'UNLOAD'; }

type InMessage = LoadModelMsg | GenerateMsg | UnloadMsg;

/** Map a dtype to the best equivalent for a given execution device. */
function resolveDeviceDtype(dtype: string, device: 'webgpu' | 'wasm'): string {
  if (device === 'webgpu') {
    // GPU prefers fp16 activations; map q4→q4f16, fp32→fp16
    if (dtype === 'q4')   return 'q4f16';
    if (dtype === 'fp32') return 'fp16';
    return dtype;
  }
  // WASM: fp16 is not well-supported, fall back to q4
  if (dtype === 'fp16' || dtype === 'q4f16') return 'q4';
  return dtype;
}

self.onmessage = async (event: MessageEvent<InMessage>) => {
  const { data } = event;

  switch (data.type) {

    case 'LOAD_MODEL': {
      try {
        if (pipe && currentModelId === data.modelId) {
          self.postMessage({ type: 'MODEL_LOADED', modelId: data.modelId });
          return;
        }
        // Release previous model
        pipe = null;
        currentModelId = null;

        // Inject HF access token into fetch requests.
        // transformers.js v4 only reads process.env.HF_TOKEN in Node.js —
        // in browser/web-worker context the else-branch adds no auth headers.
        // We override env.fetch so every HuggingFace request carries the token.
        const hfToken = data.hfToken?.trim() ?? '';
        (env as unknown as Record<string, unknown>)['fetch'] = hfToken
          ? async (url: string, init?: RequestInit) => {
              if (url.includes('huggingface.co') || url.includes('hf.co')) {
                const headers = new Headers(init?.headers);
                headers.set('Authorization', `Bearer ${hfToken}`);
                return fetch(url, { ...init, headers });
              }
              return fetch(url, init);
            }
          : fetch;

        // Determine starting device: prefer WebGPU when the browser supports it
        const hasWebGPU = 'gpu' in navigator;
        let device: 'webgpu' | 'wasm' = hasWebGPU ? 'webgpu' : 'wasm';
        let gpuFallbackDone = false;

        const MAX_RETRIES = 10;
        const BASE_DELAY_MS = 2000;
        let lastErr: unknown;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            // Exponential backoff: 2s, 4s, 8s … capped at 60s
            const delay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), 60_000);
            self.postMessage({
              type: 'PROGRESS',
              status: 'retrying',
              attempt,
              maxRetries: MAX_RETRIES,
              delayMs: delay,
              name: `Network interrupted – retrying (${attempt}/${MAX_RETRIES}) in ${delay / 1000}s…`,
            });
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          const effectiveDtype = resolveDeviceDtype(data.dtype, device);

          try {
            pipe = await pipeline('text-generation', data.modelId, {
              dtype: effectiveDtype,
              device,
              progress_callback: (progress: unknown) => {
                self.postMessage({ type: 'PROGRESS', ...(progress as object) });
              },
            });

            currentModelId = data.modelId;
            self.postMessage({ type: 'MODEL_LOADED', modelId: data.modelId, device });
            lastErr = null;
            break; // success
          } catch (err: unknown) {
            lastErr = err;

            // If WebGPU failed and we haven't fallen back yet, switch to WASM and retry immediately
            if (!gpuFallbackDone && device === 'webgpu') {
              gpuFallbackDone = true;
              device = 'wasm';
              self.postMessage({
                type: 'PROGRESS',
                status: 'info',
                name: 'GPU not available for this model — switching to CPU…',
              });
              attempt--; // don't count as a network retry
              continue;
            }

            const isAuthError = err instanceof Error && (
              err.message.includes('401') ||
              err.message.includes('403') ||
              err.message.includes('Unauthorized') ||
              err.message.includes('Forbidden') ||
              err.message.toLowerCase().includes('authentication') ||
              err.message.toLowerCase().includes('authorization')
            );
            if (isAuthError) {
              throw new Error(
                `Authentication required for model "${data.modelId}". ` +
                `Add a Hugging Face token in Settings to access gated models.`
              );
            }

            const isNetworkError = err instanceof Error && (
              err.message.includes('fetch') ||
              err.message.includes('network') ||
              err.message.includes('NetworkError') ||
              err.message.includes('Failed to fetch') ||
              err.message.includes('Load failed') ||
              err.message.includes('net::') ||
              err.name === 'TypeError'
            );
            if (!isNetworkError || attempt === MAX_RETRIES) {
              throw err; // non-network error or retries exhausted
            }
          }
        }

        if (lastErr) {
          throw lastErr;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load model';
        self.postMessage({ type: 'ERROR', message: msg });
      }
      break;
    }

    case 'GENERATE': {
      if (!pipe) {
        self.postMessage({ type: 'ERROR', message: 'No model loaded' });
        return;
      }
      try {
        // TextStreamer streams decoded tokens back to the main thread
        const streamer = new TextStreamer(pipe.tokenizer, {
          skip_prompt: true,
          skip_special_tokens: true,
          callback_function: (text: string) => {
            self.postMessage({ type: 'TOKEN', token: text });
          },
        });

        await pipe(data.messages, {
          max_new_tokens: data.maxNewTokens,
          temperature: data.temperature,
          top_p: data.topP,
          do_sample: data.temperature > 0,
          streamer,
        });

        self.postMessage({ type: 'DONE' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Generation failed';
        self.postMessage({ type: 'ERROR', message: msg });
      }
      break;
    }

    case 'UNLOAD': {
      pipe = null;
      currentModelId = null;
      self.postMessage({ type: 'DONE' });
      break;
    }
  }
};
