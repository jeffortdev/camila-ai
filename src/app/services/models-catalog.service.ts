import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { HFModel, ManagedModel } from '../interfaces/models';

const CACHED_KEY = 'camila_cached_models';

const HF_API_URL =
  'https://huggingface.co/api/models' +
  '?library=transformers.js&pipeline_tag=text-generation&sort=downloads&limit=30';

/** Raw shape returned by the HF Hub REST API for a model listing entry. */
interface HFApiModel {
  id: string;
  tags: string[];
  downloads?: number;
}

const SKIP_TAGS = new Set([
  'transformers', 'onnx', 'safetensors', 'pytorch', 'text-generation',
  'transformers.js', 'endpoints_compatible', 'region:us', 'has_space',
  'autotrain_compatible',
]);

function mapApiModel(m: HFApiModel): HFModel {
  const namePart = m.id.split('/').pop() ?? m.id;
  const name = namePart.replace(/[-_]/g, ' ');
  const sizeMatch = namePart.match(/(\d+(?:\.\d+)?[BbMm])/);
  const sizeLabel = sizeMatch ? sizeMatch[0].toUpperCase() : '';
  const dtype: HFModel['dtype'] =
    m.tags.includes('fp32') ? 'fp32' :
    m.tags.includes('fp16') ? 'fp16' : 'q4';
  const tags = m.tags
    .filter(t => !SKIP_TAGS.has(t) && !t.includes(':') && t.length < 30)
    .slice(0, 5);
  const dl = m.downloads ?? 0;
  const description = dl >= 1_000
    ? `${(dl / 1_000).toFixed(0)}K downloads`
    : `${dl} downloads`;
  return { id: m.id, name, description, sizeLabel, dtype, tags };
}

/** Fallback list used when the HF API is unreachable. */
const FALLBACK_MODELS: HFModel[] = [
  {
    id: 'onnx-community/SmolLM2-135M-Instruct',
    name: 'SmolLM2 135M Instruct',
    description: 'Ultra-tiny 135M instruction model. Blazing fast even on CPU.',
    sizeLabel: '~90 MB (q4)',
    dtype: 'q4',
    tags: ['chat', 'tiny', 'fast'],
  },
  {
    id: 'onnx-community/SmolLM2-360M-Instruct',
    name: 'SmolLM2 360M Instruct',
    description: 'Small 360M instruction model. Good speed/quality on-device.',
    sizeLabel: '~230 MB (q4)',
    dtype: 'q4',
    tags: ['chat', 'small', 'fast'],
  },
  {
    id: 'onnx-community/Qwen2.5-0.5B-Instruct',
    name: 'Qwen 2.5 0.5B Instruct',
    description: 'Alibaba Qwen 0.5B — fast, multilingual, solid quality for its size.',
    sizeLabel: '~350 MB (q4)',
    dtype: 'q4',
    tags: ['chat', 'multilingual', 'fast'],
  },
  {
    id: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
    name: 'TinyLlama 1.1B Chat',
    description: 'Compact 1.1B chat model. Good quality for on-device use.',
    sizeLabel: '~670 MB (q4)',
    dtype: 'q4',
    tags: ['chat', 'small'],
  },
  {
    id: 'Xenova/Qwen1.5-0.5B-Chat',
    name: 'Qwen 1.5 0.5B Chat',
    description: 'Ultra-compact 0.5B multilingual chat model by Alibaba.',
    sizeLabel: '~350 MB (q4)',
    dtype: 'q4',
    tags: ['chat', 'multilingual', 'tiny'],
  },
  {
    id: 'Xenova/gpt2',
    name: 'GPT-2 (117M)',
    description: 'Classic GPT-2 base — very fast, minimal quality. Good for testing inference.',
    sizeLabel: '~130 MB (q4)',
    dtype: 'q4',
    tags: ['text-generation', 'tiny'],
  },
  {
    id: 'Xenova/phi-1_5',
    name: 'Phi-1.5 (1.3B)',
    description: 'Microsoft Phi-1.5 — strong reasoning for its size.',
    sizeLabel: '~800 MB (q4)',
    dtype: 'q4',
    tags: ['reasoning', 'small'],
  },
];

@Injectable({ providedIn: 'root' })
export class ModelsCatalogService {

  private cachedIds = new Set<string>();
  private availableModels: HFModel[] = [...FALLBACK_MODELS];

  readonly models$ = new BehaviorSubject<ManagedModel[]>([]);
  readonly isCatalogLoading$ = new BehaviorSubject<boolean>(false);

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.loadCachedState();
    await this.fetchCatalog();
  }

  private async loadCachedState(): Promise<void> {
    const { value } = await Preferences.get({ key: CACHED_KEY });
    if (value) {
      try {
        const ids = JSON.parse(value) as string[];
        ids.forEach(id => this.cachedIds.add(id));
      } catch { /* ignore */ }
    }
    this.emit();
  }

  /** Fetch the list of compatible models from the HF Hub API.
   *  Falls back silently to the built-in list on any network error. */
  async fetchCatalog(): Promise<void> {
    this.isCatalogLoading$.next(true);
    try {
      const res = await fetch(HF_API_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as HFApiModel[];
      if (Array.isArray(data) && data.length > 0) {
        this.availableModels = data.map(mapApiModel);
        this.emit();
      }
    } catch { /* keep fallback list already emitted */ }
    finally {
      this.isCatalogLoading$.next(false);
    }
  }

  private emit(): void {
    const current = this.models$.value;
    this.models$.next(
      this.availableModels.map(m => {
        const prev = current.find(c => c.id === m.id);
        return {
          ...m,
          isCached: this.cachedIds.has(m.id),
          isLoaded: prev?.isLoaded ?? false,
          isLoading: prev?.isLoading ?? false,
          downloadProgress: prev?.downloadProgress ?? 0,
        };
      })
    );
  }

  markLoading(modelId: string, progress: number): void {
    this.models$.next(
      this.models$.value.map(m =>
        m.id === modelId
          ? { ...m, isLoading: true, downloadProgress: progress }
          : m
      )
    );
  }

  async markCached(modelId: string): Promise<void> {
    this.cachedIds.add(modelId);
    await Preferences.set({ key: CACHED_KEY, value: JSON.stringify([...this.cachedIds]) });
    this.emit();
  }

  markLoaded(modelId: string): void {
    this.models$.next(
      this.models$.value.map(m =>
        m.id === modelId
          ? { ...m, isLoaded: true, isLoading: false, isCached: true, downloadProgress: 100 }
          : { ...m, isLoaded: false }
      )
    );
  }

  async removeFromCache(modelId: string): Promise<void> {
    this.cachedIds.delete(modelId);
    await Preferences.set({ key: CACHED_KEY, value: JSON.stringify([...this.cachedIds]) });
    this.emit();
  }

  markIdle(modelId: string): void {
    this.models$.next(
      this.models$.value.map(m =>
        m.id === modelId
          ? { ...m, isLoading: false, downloadProgress: 0 }
          : m
      )
    );
  }
}
