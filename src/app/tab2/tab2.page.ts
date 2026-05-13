import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList,
  IonItem, IonLabel, IonButton, IonIcon, IonBadge,
  IonProgressBar, IonSpinner, IonItemGroup, IonListHeader,
  ToastController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudDownloadOutline, playCircleOutline, stopCircleOutline,
  trashOutline, closeCircleOutline, keyOutline, folderOpenOutline
} from 'ionicons/icons';
import { Observable, Subscription } from 'rxjs';
import { LlmService } from '../services/llm.service';
import { GgufService } from '../services/gguf.service';
import { ModelsCatalogService } from '../services/models-catalog.service';
import { SettingsService } from '../services/settings.service';
import { LocalGgufModel, ManagedModel } from '../interfaces/models';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    CommonModule, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonButton, IonIcon, IonBadge,
    IonProgressBar, IonSpinner, IonItemGroup, IonListHeader
  ],
})
export class Tab2Page implements OnInit, OnDestroy {

  @ViewChild('ggufFileInput') ggufFileInputRef!: ElementRef<HTMLInputElement>;

  models$!: Observable<ManagedModel[]>;
  ggufModels$!: Observable<LocalGgufModel[]>;
  hfToken = '';
  private subs = new Subscription();

  constructor(
    private catalog: ModelsCatalogService,
    private llm: LlmService,
    public gguf: GgufService,
    private settings: SettingsService,
    private toast: ToastController,
    private alert: AlertController,
    private router: Router,
    private titleService: Title
  ) {
    addIcons({ cloudDownloadOutline, playCircleOutline, stopCircleOutline, trashOutline, closeCircleOutline, keyOutline, folderOpenOutline });
  }

  ionViewWillEnter(): void {
    this.titleService.setTitle('Models — CamilaAI');
  }

  ngOnInit(): void {
    this.models$ = this.catalog.models$;
    this.ggufModels$ = this.gguf.models$;

    this.subs.add(this.settings.settings$.subscribe(s => {
      this.hfToken = s.hfToken ?? '';
    }));

    // Reflect LLM loading progress into catalog
    this.subs.add(this.llm.progress$.subscribe(p => {
      if (p?.name && p.progress != null) {
        this.catalog.markLoading(p.name, p.progress);
      }
    }));

    this.subs.add(this.llm.status$.subscribe(async s => {
      if (s === 'ready' && this.llm.loadedModel) {
        await this.catalog.markCached(this.llm.loadedModel);
        this.catalog.markLoaded(this.llm.loadedModel);
      }
    }));

    this.subs.add(this.llm.error$.subscribe(async msg => {
      const isAuthError = /authentication|authorization|401|403|unauthorized|forbidden|gated/i.test(msg);
      if (isAuthError) {
        const tokenIsSet = !!this.hfToken?.trim();
        const a = await this.alert.create({
          header: 'Authentication Required',
          message: tokenIsSet
            ? 'Your Hugging Face token was rejected. It may be expired, invalid, or lack access to this model. Check your token in Settings.'
            : 'This model requires a Hugging Face access token. Add your token in Settings to download gated models.',
          buttons: [
            { text: 'Dismiss', role: 'cancel' },
            {
              text: 'Open Settings',
              handler: () => { this.openSettings(); }
            }
          ]
        });
        await a.present();
      } else {
        const t = await this.toast.create({ message: msg, duration: 3000, color: 'danger', position: 'bottom' });
        await t.present();
      }
    }));
  }

  openSettings(): void {
    this.router.navigateByUrl('/tabs/tab4');
  }

  // ── Local GGUF helpers ────────────────────────────────────────────────────

  openGgufPicker(): void {
    this.ggufFileInputRef.nativeElement.click();
  }

  onGgufFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) { return; }
    this.gguf.addModel(file);
    // Reset so the same file can be picked again if needed
    input.value = '';
  }

  async loadGgufModel(id: string): Promise<void> {
    // Unload any ONNX model first
    if (this.llm.loadedModel) { this.llm.unloadModel(); }
    await this.gguf.loadModel(id);
  }

  async removeGgufModel(id: string): Promise<void> {
    await this.gguf.removeModel(id);
    const t = await this.toast.create({ message: 'GGUF model removed', duration: 2000, color: 'medium', position: 'bottom' });
    await t.present();
  }

  downloadAndLoad(modelId: string, dtype: string): void {
    this.settings.save({ modelId });
    this.llm.loadModel(modelId, dtype);
  }

  loadModel(modelId: string, dtype: string): void {
    this.settings.save({ modelId });
    this.llm.loadModel(modelId, dtype);
  }

  unloadModel(): void {
    this.llm.unloadModel();
    this.catalog.models$.next(
      this.catalog.models$.value.map(m => ({ ...m, isLoaded: false }))
    );
  }

  cancelDownload(modelId: string): void {
    this.llm.cancelLoad();
    this.catalog.markIdle(modelId);
  }

  async removeFromCache(modelId: string): Promise<void> {
    await this.catalog.removeFromCache(modelId);
    const t = await this.toast.create({ message: 'Model removed from cache', duration: 2000, color: 'medium', position: 'bottom' });
    await t.present();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
