import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { Wllama, LoggerWithoutDebug } from '@wllama/wllama/esm/index.js';
import { LocalGgufModel, LLMStatus } from '../interfaces/models';

/** Path to bundled wllama WASM binary (copied to src/assets/wllama/). */
const WASM_PATH = { default: 'assets/wllama/wllama.wasm' };

@Injectable({ providedIn: 'root' })
export class GgufService {

  private wllama: Wllama | null = null;
  private abortController: AbortController | null = null;

  readonly models$ = new BehaviorSubject<LocalGgufModel[]>([]);
  readonly status$ = new BehaviorSubject<LLMStatus>('idle');
  readonly token$ = new Subject<string>();
  readonly done$ = new Subject<void>();
  readonly error$ = new Subject<string>();

  get loadedModelId(): string | null {
    return this.models$.value.find(m => m.isLoaded)?.id ?? null;
  }

  constructor(private zone: NgZone) {}

  /** Register a file picked by the user without loading it yet. */
  addModel(file: File): void {
    const id = file.name;
    const existing = this.models$.value.find(m => m.id === id);
    if (existing) { return; }
    this.models$.next([
      ...this.models$.value,
      { id, name: file.name.replace(/\.gguf$/i, ''), file, isLoaded: false, isLoading: false, loadProgress: 0 },
    ]);
  }

  removeModel(id: string): void {
    if (this.loadedModelId === id) {
      this.unload();
    }
    this.models$.next(this.models$.value.filter(m => m.id !== id));
  }

  async loadModel(id: string): Promise<void> {
    const model = this.models$.value.find(m => m.id === id);
    if (!model) { return; }

    // Unload any currently loaded model first
    if (this.wllama) {
      await this.unload();
    }

    this.status$.next('loading');
    this.patch(id, { isLoading: true, loadProgress: 0 });

    try {
      this.wllama = new Wllama(WASM_PATH, {
        logger: LoggerWithoutDebug,
        suppressNativeLog: true,
      });

      await this.wllama.loadModel([model.file], {
        n_ctx: 2048,
      });

      this.zone.run(() => {
        this.patch(id, { isLoaded: true, isLoading: false, loadProgress: 100 });
        this.status$.next('ready');
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load GGUF model';
      this.wllama = null;
      this.zone.run(() => {
        this.patch(id, { isLoading: false, loadProgress: 0 });
        this.status$.next('error');
        this.error$.next(msg);
      });
    }
  }

  async generate(
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    maxNewTokens: number,
    topP: number,
  ): Promise<void> {
    if (!this.wllama) {
      this.error$.next('No GGUF model loaded');
      return;
    }

    this.status$.next('generating');
    this.abortController = new AbortController();

    try {
      const iter = await this.wllama.createChatCompletion({
        messages: messages as never,
        max_tokens: maxNewTokens,
        temperature,
        top_p: topP,
        stream: true,
        onData: (chunk) => {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            this.zone.run(() => this.token$.next(delta));
          }
        },
        abortSignal: this.abortController.signal,
      });

      // Consume any remaining items in the async iterator (wllama resolves it internally)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of iter) { /* tokens delivered via onData */ }

      this.zone.run(() => {
        this.status$.next('ready');
        this.done$.next();
      });
    } catch (err: unknown) {
      const isDone = err instanceof Error && err.name === 'AbortError';
      this.zone.run(() => {
        this.status$.next('ready');
        if (isDone) {
          this.done$.next();
        } else {
          const msg = err instanceof Error ? err.message : 'Generation failed';
          this.error$.next(msg);
        }
      });
    } finally {
      this.abortController = null;
    }
  }

  stopGeneration(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  async unload(): Promise<void> {
    this.wllama = null;
    this.status$.next('idle');
    this.models$.next(
      this.models$.value.map(m => ({ ...m, isLoaded: false, isLoading: false, loadProgress: 0 }))
    );
  }

  private patch(id: string, changes: Partial<LocalGgufModel>): void {
    this.models$.next(
      this.models$.value.map(m => m.id === id ? { ...m, ...changes } : m)
    );
  }
}
