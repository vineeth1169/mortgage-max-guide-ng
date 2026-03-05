import { Injectable, signal } from '@angular/core';
import { Notification } from '../models/byol.model';

/**
 * NotificationService - Show toast notifications to users
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  readonly notifications = signal<Notification[]>([]);

  constructor() {}

  /**
   * Add a success notification
   */
  success(message: string, duration = 3000): void {
    this.notify('success', message, duration);
  }

  /**
   * Add an error notification
   */
  error(message: string, duration = 5000): void {
    this.notify('error', message, duration);
  }

  /**
   * Add an info notification
   */
  info(message: string, duration = 3000): void {
    this.notify('info', message, duration);
  }

  /**
   * Add a warning notification
   */
  warning(message: string, duration = 4000): void {
    this.notify('warning', message, duration);
  }

  /**
   * Internal: Add and auto-remove notification
   */
  private notify(
    type: 'success' | 'error' | 'info' | 'warning',
    message: string,
    duration: number
  ): void {
    const id = Math.random().toString(36).substring(2, 11);
    const notification: Notification = { id, type, message, duration };

    this.notifications.update((prev) => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }

  /**
   * Remove a notification by ID
   */
  remove(id: string): void {
    this.notifications.update((prev) => prev.filter((n) => n.id !== id));
  }
}
