import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { LLMStatus, LLMProgress } from '../interfaces/models';

@Injectable({ providedIn: 'root' })
export class LlmService implements OnDestroy {

  private worker!: Worker;
  private tokenSubject = new Subject<string>();
  private doneSubject  = new Subject<void>();
  private errorSubject = new Subject<string>();

  readonly status$   = new BehaviorSubject<LLMStatus>('idle');
  readonly progress$ = new BehaviorSubject<LLMProgress | null>(null);
  readonly token$    = this.tokenSubject.asObservable();
  readonly done$     = this.doneSubject.asObservable();
  readonly error$    = this.errorSubject.asObservable();

  private loadedModelId: string | null = null;

  constructor(private zone: NgZone) {
    this.initWorker();
  }

  get loadedModel(): string | null { return this.loadedModelId; }

  private initWorker(): void {
    this.worker = new Worker(
      new URL('../workers/llm.worker', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = ({ data }) => {
      this.zone.run(() => this.handleMessage(data));
    };

    this.worker.onerror = (e) => {
      this.zone.run(() => {
        this.status$.next('error');
        this.errorSubject.next(e.message ?? 'Worker error');
      });
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMessage(data: any): void {
    switch (data.type) {
      case 'MODEL_LOADED':
        this.loadedModelId = data.modelId;
        this.progress$.next(null);
        this.status$.next('ready');
        break;
      case 'PROGRESS':
        this.progress$.next(data as LLMProgress);
        break;
      case 'TOKEN':
        this.status$.next('generating');
        this.tokenSubject.next(data.token as string);
        break;
      case 'DONE':
        this.status$.next('ready');
        this.doneSubject.next();
        break;
      case 'ERROR':
        this.status$.next('error');
        this.errorSubject.next(data.message as string);
        break;
    }
  }

  loadModel(modelId: string): void {
    this.status$.next('loading');
    this.progress$.next(null);
    this.worker.postMessage({ type: 'LOAD_MODEL', modelId });
  }

  generate(
    messages: Array<{ role: string; content: string }>,
    temperature: number,
    maxNewTokens: number,
    topP: number
  ): void {
    this.status$.next('generating');
    this.worker.postMessage({ type: 'GENERATE', messages, temperature, maxNewTokens, topP });
  }

  unloadModel(): void {
    this.worker.postMessage({ type: 'UNLOAD' });
    this.loadedModelId = null;
    this.status$.next('idle');
  }

  ngOnDestroy(): void {
    this.worker.terminate();
  }
}
