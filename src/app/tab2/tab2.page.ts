import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Title } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList,
  IonItem, IonLabel, IonButton, IonIcon, IonBadge,
  IonProgressBar, IonSpinner, IonItemGroup, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cloudDownloadOutline, playCircleOutline, stopCircleOutline,
  trashOutline, closeCircleOutline
} from 'ionicons/icons';
import { Observable, Subscription } from 'rxjs';
import { LlmService } from '../services/llm.service';
import { ModelsCatalogService } from '../services/models-catalog.service';
import { SettingsService } from '../services/settings.service';
import { ManagedModel } from '../interfaces/models';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [
    CommonModule, DecimalPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonButton, IonIcon, IonBadge,
    IonProgressBar, IonSpinner, IonItemGroup
  ],
})
export class Tab2Page implements OnInit, OnDestroy {

  models$!: Observable<ManagedModel[]>;
  private subs = new Subscription();

  constructor(
    private catalog: ModelsCatalogService,
    private llm: LlmService,
    private settings: SettingsService,
    private toast: ToastController,
    private titleService: Title
  ) {
    addIcons({ cloudDownloadOutline, playCircleOutline, stopCircleOutline, trashOutline, closeCircleOutline });
  }

  ionViewWillEnter(): void {
    this.titleService.setTitle('Models — CamilaAI');
  }

  ngOnInit(): void {
    this.models$ = this.catalog.models$;

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
      const t = await this.toast.create({ message: msg, duration: 3000, color: 'danger', position: 'bottom' });
      await t.present();
    }));
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
