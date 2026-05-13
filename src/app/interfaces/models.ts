export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HFModel {
  id: string;
  name: string;
  description: string;
  sizeLabel: string;
  dtype: 'q4' | 'q4f16' | 'fp16' | 'fp32';
  tags: string[];
}

export interface ManagedModel extends HFModel {
  isCached: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  downloadProgress: number;
}

export interface LLMSettings {
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxNewTokens: number;
  topP: number;
  hfToken: string;
}

export interface LocalGgufModel {
  /** Unique key used to identify the model in the UI (e.g. the file name). */
  id: string;
  /** Display name shown to the user. */
  name: string;
  /** Original File object selected by the user. */
  file: File;
  /** Whether this model is currently loaded in wllama. */
  isLoaded: boolean;
  /** Whether loading is in progress. */
  isLoading: boolean;
  /** 0-100 loading progress. */
  loadProgress: number;
}

export type LLMStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export interface LLMProgress {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  // retry metadata
  attempt?: number;
  maxRetries?: number;
  delayMs?: number;
}

export type WorkerMessageType =
  | 'LOAD_MODEL'
  | 'GENERATE'
  | 'UNLOAD'
  | 'MODEL_LOADED'
  | 'PROGRESS'
  | 'TOKEN'
  | 'DONE'
  | 'ERROR'
  | 'UNLOADED';

export interface WorkerMessage {
  type: WorkerMessageType;
  payload?: any;
}
