import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { LLMSettings } from '../interfaces/models';

const SETTINGS_KEY = 'camila_settings';

const DEFAULTS: LLMSettings = {
  modelId: 'Xenova/TinyLlama-1.1B-Chat-v1.0',
  systemPrompt: 'You are CamilaAI, a helpful on-device assistant. Be concise and friendly.',
  temperature: 0.7,
  maxNewTokens: 256,
  topP: 0.9,
  hfToken: '',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {

  readonly settings$ = new BehaviorSubject<LLMSettings>({ ...DEFAULTS });

  constructor() {
    this.load();
  }

  get snapshot(): LLMSettings { return this.settings$.value; }

  private async load(): Promise<void> {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (value) {
      try {
        const saved = JSON.parse(value) as Partial<LLMSettings>;
        this.settings$.next({ ...DEFAULTS, ...saved });
      } catch { /* use defaults */ }
    }
  }

  async save(patch: Partial<LLMSettings>): Promise<void> {
    const next = { ...this.settings$.value, ...patch };
    this.settings$.next(next);
    await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(next) });
  }

  async reset(): Promise<void> {
    this.settings$.next({ ...DEFAULTS });
    await Preferences.remove({ key: SETTINGS_KEY });
  }
}
