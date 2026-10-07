import { CommonModule, DatePipe } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { SignalrNotificationService } from '../../services/signalr-notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.scss'],
})
export class NotificationBellComponent {
  readonly notifications = inject(SignalrNotificationService);

  toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.notifications.togglePanel();
  }

  onItemClick(id: number): void {
    this.notifications.marcarLida(id);
  }

  markAll(): void {
    this.notifications.marcarTodasLidas();
  }

  @HostListener('document:click')
  onDocClick(): void {
    if (this.notifications.panelOpen()) {
      this.notifications.closePanel();
    }
  }
}
