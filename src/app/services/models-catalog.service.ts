import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { HFModel, ManagedModel } from '../interfaces/models';

const CACHED_KEY = 'camila_cached_models';

export const AVAILABLE_MODELS: HFModel[] = [
  {
    id: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
    name: 'TinyLlama 1.1B Chat',
    description: 'Compact 1.1B chat model. Great for on-device POC. Supports chat template.',
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
    sizeLabel: '~130 MB (fp32)',
    dtype: 'fp32',
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
  readonly models$ = new BehaviorSubject<ManagedModel[]>([]);

  constructor() {
    this.loadCachedState();
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

  private emit(): void {
    this.models$.next(
      AVAILABLE_MODELS.map(m => ({
        ...m,
        isCached: this.cachedIds.has(m.id),
        isLoaded: false,
        isLoading: false,
        downloadProgress: 0,
      }))
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
}
