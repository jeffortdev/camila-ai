/// <reference lib="webworker" />
import { pipeline, TextStreamer, env } from '@huggingface/transformers';

// Allow remote models, disable local model lookup
env.allowLocalModels = false;
env.allowRemoteModels = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipe: any = null;
let currentModelId: string | null = null;

interface LoadModelMsg   { type: 'LOAD_MODEL';  modelId: string; }
interface GenerateMsg    { type: 'GENERATE';    messages: Array<{ role: string; content: string }>; temperature: number; maxNewTokens: number; topP: number; }
interface UnloadMsg      { type: 'UNLOAD'; }

type InMessage = LoadModelMsg | GenerateMsg | UnloadMsg;

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

        pipe = await pipeline('text-generation', data.modelId, {
          dtype: 'q4',
          progress_callback: (progress: unknown) => {
            self.postMessage({ type: 'PROGRESS', ...(progress as object) });
          },
        });

        currentModelId = data.modelId;
        self.postMessage({ type: 'MODEL_LOADED', modelId: data.modelId });
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
