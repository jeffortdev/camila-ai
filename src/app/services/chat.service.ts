import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Preferences } from '@capacitor/preferences';
import { ChatSession, ChatMessage } from '../interfaces/models';

const SESSIONS_KEY = 'camila_sessions';

@Injectable({ providedIn: 'root' })
export class ChatService {

  private sessions: ChatSession[] = [];
  readonly sessions$ = new BehaviorSubject<ChatSession[]>([]);

  private activeSession: ChatSession | null = null;
  readonly activeSession$ = new BehaviorSubject<ChatSession | null>(null);

  constructor() {
    this.loadSessions();
  }

  private async loadSessions(): Promise<void> {
    const { value } = await Preferences.get({ key: SESSIONS_KEY });
    if (value) {
      try {
        this.sessions = JSON.parse(value) as ChatSession[];
        this.sessions$.next([...this.sessions]);
      } catch {
        this.sessions = [];
      }
    }
  }

  private async persistSessions(): Promise<void> {
    await Preferences.set({ key: SESSIONS_KEY, value: JSON.stringify(this.sessions) });
  }

  newSession(modelId: string): ChatSession {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      modelId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.sessions.unshift(session);
    this.sessions$.next([...this.sessions]);
    this.activeSession = session;
    this.activeSession$.next(session);
    this.persistSessions();
    return session;
  }

  loadSession(id: string): void {
    const session = this.sessions.find(s => s.id === id) ?? null;
    this.activeSession = session;
    this.activeSession$.next(session);
  }

  addMessage(message: ChatMessage): void {
    if (!this.activeSession) return;
    this.activeSession.messages.push(message);
    this.activeSession.updatedAt = new Date().toISOString();

    // Auto-title from first user message
    if (this.activeSession.messages.length === 1 && message.role === 'user') {
      this.activeSession.title = message.content.slice(0, 40) + (message.content.length > 40 ? '…' : '');
    }

    this.activeSession$.next({ ...this.activeSession });
    const idx = this.sessions.findIndex(s => s.id === this.activeSession!.id);
    if (idx !== -1) this.sessions[idx] = { ...this.activeSession };
    this.sessions$.next([...this.sessions]);
    this.persistSessions();
  }

  appendToLastAssistantMessage(token: string): void {
    if (!this.activeSession) return;
    const msgs = this.activeSession.messages;
    const last = msgs[msgs.length - 1];
    if (last?.role === 'assistant') {
      last.content += token;
      this.activeSession$.next({ ...this.activeSession });
    }
  }

  deleteSession(id: string): void {
    this.sessions = this.sessions.filter(s => s.id !== id);
    this.sessions$.next([...this.sessions]);
    if (this.activeSession?.id === id) {
      this.activeSession = null;
      this.activeSession$.next(null);
    }
    this.persistSessions();
  }

  clearActiveSession(): void {
    this.activeSession = null;
    this.activeSession$.next(null);
  }
}
