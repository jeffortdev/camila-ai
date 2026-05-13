import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonTextarea, IonButton, IonIcon, IonSpinner, IonBadge,
  IonButtons, IonProgressBar, IonCard, IonCardContent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { send, addCircleOutline, cogOutline, stopCircleOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { LlmService } from '../services/llm.service';
import { GgufService } from '../services/gguf.service';
import { ChatService } from '../services/chat.service';
import { SettingsService } from '../services/settings.service';
import { ChatMessage, LLMStatus } from '../interfaces/models';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
    IonTextarea, IonButton, IonIcon, IonSpinner, IonBadge,
    IonButtons, IonProgressBar, IonCard, IonCardContent
  ],
})
export class Tab1Page implements OnInit, OnDestroy {
  @ViewChild('messageList') messageListRef!: ElementRef<HTMLElement>;

  messages: ChatMessage[] = [];
  inputText = '';
  status: LLMStatus = 'idle';
  progressLabel = '';
  progressValue = 0;
  device: string | null = null;

  private subs = new Subscription();

  constructor(
    public llm: LlmService,
    public gguf: GgufService,
    public chatService: ChatService,
    public settings: SettingsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private titleService: Title
  ) {
    addIcons({ send, addCircleOutline, cogOutline, stopCircleOutline });
  }

  ionViewWillEnter(): void {
    this.titleService.setTitle('Chat — CamilaAI');
  }

  ngOnInit(): void {
    // Mirror status from whichever service is active
    this.subs.add(this.llm.status$.subscribe(s => {
      if (!this.gguf.loadedModelId) {
        this.status = s;
        this.cdr.markForCheck();
      }
    }));

    this.subs.add(this.gguf.status$.subscribe(s => {
      if (this.gguf.loadedModelId || s !== 'idle') {
        this.status = s;
        this.cdr.markForCheck();
      }
    }));

    this.subs.add(this.llm.device$.subscribe(d => {
      this.device = d;
      this.cdr.markForCheck();
    }));

    this.subs.add(this.llm.progress$.subscribe(p => {
      if (p) {
        if (p.status === 'retrying') {
          this.progressLabel = p.name ?? 'Network interrupted – retrying…';
          this.progressValue = 0;
        } else {
          this.progressLabel = p.file ? `Loading ${p.file}…` : (p.name ?? p.status);
          this.progressValue = (p.progress ?? 0) / 100;
        }
      } else {
        this.progressLabel = '';
        this.progressValue = 0;
      }
      this.cdr.markForCheck();
    }));

    this.subs.add(this.llm.token$.subscribe(token => {
      this.chatService.appendToLastAssistantMessage(token);
      this.scrollToBottom();
    }));

    this.subs.add(this.gguf.token$.subscribe(token => {
      this.chatService.appendToLastAssistantMessage(token);
      this.scrollToBottom();
    }));

    this.subs.add(this.chatService.activeSession$.subscribe(session => {
      this.messages = session?.messages ?? [];
      this.cdr.markForCheck();
      this.scrollToBottom();
    }));
  }

  get isReady(): boolean { return this.status === 'ready'; }
  get isLoading(): boolean { return this.status === 'loading'; }
  get isGenerating(): boolean { return this.status === 'generating'; }
  get noModel(): boolean {
    return (this.status === 'idle' || this.status === 'error') && !this.gguf.loadedModelId;
  }

  newChat(): void {
    const s = this.settings.snapshot;
    this.chatService.newSession(s.modelId);
  }

  async send(): Promise<void> {
    const text = this.inputText.trim();
    if (!text || !this.isReady) return;
    this.inputText = '';

    // Ensure active session
    if (!this.chatService.activeSession$.value) {
      this.chatService.newSession(this.settings.snapshot.modelId);
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    this.chatService.addMessage(userMsg);

    // Placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    this.chatService.addMessage(assistantMsg);
    this.scrollToBottom();

    const s = this.settings.snapshot;
    const session = this.chatService.activeSession$.value!;
    const history = session.messages
      .filter(m => m.role !== 'assistant' || m.content.length > 0)
      .slice(0, -1) // exclude the empty placeholder
      .map(m => ({ role: m.role, content: m.content }));

    const prompt = [
      { role: 'system', content: s.systemPrompt },
      ...history,
    ];

    if (this.gguf.loadedModelId) {
      this.gguf.generate(prompt, s.temperature, s.maxNewTokens, s.topP);
    } else {
      this.llm.generate(prompt, s.temperature, s.maxNewTokens, s.topP);
    }
  }

  goToModels(): void {
    this.router.navigate(['/tabs/tab2']);
  }

  onEnter(event: Event): void {
    const ke = event as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send();
    }
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messageListRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
