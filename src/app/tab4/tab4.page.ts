import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonList,
  IonItem, IonLabel, IonTextarea, IonRange,
  IonNote, IonButton, IonIcon, IonListHeader, IonSelect,
  IonSelectOption, IonButtons, IonInput, ToastController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { refreshOutline, saveOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { SettingsService } from '../services/settings.service';
import { LLMSettings } from '../interfaces/models';
import { AVAILABLE_MODELS } from '../services/models-catalog.service';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonList,
    IonItem, IonLabel, IonTextarea, IonRange,
    IonNote, IonButton, IonIcon, IonListHeader, IonSelect,
    IonSelectOption, IonButtons, IonInput
  ],
})
export class Tab4Page implements OnInit, OnDestroy {

  models = AVAILABLE_MODELS;

  form: LLMSettings = {
    modelId: '',
    systemPrompt: '',
    temperature: 0.7,
    maxNewTokens: 256,
    topP: 0.9,
    hfToken: '',
  };

  private subs = new Subscription();

  constructor(
    private settingsService: SettingsService,
    private toast: ToastController,
    private alert: AlertController,
    private titleService: Title
  ) {
    addIcons({ refreshOutline, saveOutline });
  }

  ngOnInit(): void {
    this.titleService.setTitle('Settings — CamilaAI');
    this.subs.add(
      this.settingsService.settings$.subscribe(s => {
        this.form = { ...s };
      })
    );
  }

  async save(): Promise<void> {
    await this.settingsService.save({ ...this.form });
    const t = await this.toast.create({
      message: 'Settings saved',
      duration: 1500,
      color: 'success',
      position: 'bottom'
    });
    await t.present();
  }

  async reset(): Promise<void> {
    const a = await this.alert.create({
      header: 'Reset Settings',
      message: 'Restore all settings to defaults?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reset', role: 'destructive',
          handler: async () => {
            await this.settingsService.reset();
            const t = await this.toast.create({
              message: 'Settings reset to defaults',
              duration: 1500,
              color: 'medium',
              position: 'bottom'
            });
            await t.present();
          }
        }
      ]
    });
    await a.present();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
