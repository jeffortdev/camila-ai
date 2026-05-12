import { Component, OnInit, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonList, IonItem, IonLabel, IonIcon, IonButtons,
  IonButton, IonItemSliding, IonItemOptions, IonItemOption,
  AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { trashOutline, trash, chatbubblesOutline } from 'ionicons/icons';
import { Observable } from 'rxjs';
import { ChatService } from '../services/chat.service';
import { ChatSession } from '../interfaces/models';
import { AVAILABLE_MODELS } from '../services/models-catalog.service';

@Pipe({ name: 'modelName', standalone: true })
export class ModelNamePipe implements PipeTransform {
  transform(modelId: string): string {
    return AVAILABLE_MODELS.find(m => m.id === modelId)?.name ?? modelId;
  }
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [
    CommonModule, ModelNamePipe,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonIcon, IonButtons,
    IonButton, IonItemSliding, IonItemOptions, IonItemOption
  ],
})
export class Tab3Page implements OnInit {

  sessions$!: Observable<ChatSession[]>;

  constructor(
    private chatService: ChatService,
    private router: Router,
    private alert: AlertController,
    private titleService: Title
  ) {
    addIcons({ trashOutline, trash, chatbubblesOutline });
  }

  ngOnInit(): void {
    this.titleService.setTitle('History — CamilaAI');
    this.sessions$ = this.chatService.sessions$;
  }

  openSession(id: string): void {
    this.chatService.loadSession(id);
    this.router.navigate(['/tabs/tab1']);
  }

  deleteSession(id: string): void {
    this.chatService.deleteSession(id);
  }

  async clearAll(): Promise<void> {
    const a = await this.alert.create({
      header: 'Clear all history',
      message: 'Delete all saved conversations?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete All', role: 'destructive',
          handler: () => {
            const sessions = this.chatService.sessions$.value;
            sessions.forEach(s => this.chatService.deleteSession(s.id));
          }
        }
      ]
    });
    await a.present();
  }
}
