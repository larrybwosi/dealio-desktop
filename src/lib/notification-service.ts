import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'sale' | 'sync' | 'system';
export type NotificationPriority = 'low' | 'medium' | 'high';

export interface NotificationAction {
  label: string;
  actionType: string;
  payload?: any;
}

export interface AppNotification {
  id: string;
  notificationType: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  persistent: boolean;
  action?: NotificationAction;
  soundEnabled: boolean;
}

export interface NotificationOptions {
  title: string;
  body: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  persistent?: boolean;
  action?: NotificationAction;
  soundEnabled?: boolean;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  soundVolume: number;
  infoSoundEnabled: boolean;
  successSoundEnabled: boolean;
  warningSoundEnabled: boolean;
  errorSoundEnabled: boolean;
  saleSoundEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  soundVolume: 0.5,
  infoSoundEnabled: true,
  successSoundEnabled: true,
  warningSoundEnabled: true,
  errorSoundEnabled: true,
  saleSoundEnabled: true,
};

class NotificationService {
  private settings: NotificationSettings = DEFAULT_SETTINGS;
  private listeners: Array<(notification: AppNotification) => void> = [];
  private isWindowVisible: boolean = true;

  constructor() {
    this.init();
  }

  private async init() {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('notification-settings');
    if (savedSettings) {
      this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    }

    // Monitor window visibility
    const currentWindow = getCurrentWindow();
    currentWindow.onFocusChanged(({ payload: focused }) => {
      this.isWindowVisible = focused;
    });

    // Listen for notifications from backend
    await listen<AppNotification>('notification-received', (event) => {
      this.handleIncomingNotification(event.payload);
    });
  }

  private handleIncomingNotification(notification: AppNotification) {
    // Play sound if enabled
    if (this.settings.soundEnabled && notification.soundEnabled) {
      this.playNotificationSound(notification.notificationType);
    }

    // Notify all listeners
    this.listeners.forEach(listener => listener(notification));
  }

  /**
   * Send a notification
   */
  async send(options: NotificationOptions): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    const notification: AppNotification = {
      id,
      notificationType: options.type || 'info',
      priority: options.priority || 'medium',
      title: options.title,
      body: options.body,
      timestamp,
      read: false,
      persistent: options.persistent !== undefined ? options.persistent : true,
      action: options.action,
      soundEnabled: options.soundEnabled !== undefined ? options.soundEnabled : true,
    };

    try {
      // Send to backend
      await invoke<string>('send_native_notification', { notification });
      
      // If window is visible, also show in-app toast
      if (this.isWindowVisible) {
        this.showInAppToast(notification);
      }

      return id;
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  /**
   * Convenience methods for different notification types
   */
  async info(title: string, body: string, options?: Partial<NotificationOptions>) {
    return this.send({ title, body, type: 'info', ...options });
  }

  async success(title: string, body: string, options?: Partial<NotificationOptions>) {
    return this.send({ title, body, type: 'success', ...options });
  }

  async warning(title: string, body: string, options?: Partial<NotificationOptions>) {
    return this.send({ title, body, type: 'warning', priority: 'medium', ...options });
  }

  async error(title: string, body: string, options?: Partial<NotificationOptions>) {
    return this.send({ title, body, type: 'error', priority: 'high', ...options });
  }

  async sale(title: string, body: string, options?: Partial<NotificationOptions>) {
    return this.send({ title, body, type: 'sale', priority: 'medium', ...options });
  }

  /**
   * Get notification history
   */
  async getHistory(): Promise<AppNotification[]> {
    try {
      return await invoke<AppNotification[]>('get_notification_history');
    } catch (error) {
      console.error('Failed to get notification history:', error);
      return [];
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    try {
      return await invoke<number>('get_unread_notification_count');
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markRead(id: string): Promise<boolean> {
    try {
      return await invoke<boolean>('mark_notification_read', { id });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllRead(): Promise<void> {
    try {
      await invoke('mark_all_notifications_read');
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }

  /**
   * Delete notification
   */
  async delete(id: string): Promise<boolean> {
    try {
      return await invoke<boolean>('delete_notification', { id });
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    try {
      await invoke('clear_all_notifications');
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<NotificationSettings>) {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem('notification-settings', JSON.stringify(this.settings));
  }

  /**
   * Get current settings
   */
  getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  /**
   * Subscribe to notification events
   */
  subscribe(callback: (notification: AppNotification) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Play notification sound based on type
   */
  private playNotificationSound(type: NotificationType) {
    const soundMap: Record<NotificationType, { file: string; enabled: keyof NotificationSettings }> = {
      info: { file: '/sounds/notification-info.mp3', enabled: 'infoSoundEnabled' },
      success: { file: '/sounds/notification-success.mp3', enabled: 'successSoundEnabled' },
      warning: { file: '/sounds/notification-warning.mp3', enabled: 'warningSoundEnabled' },
      error: { file: '/sounds/notification-error.mp3', enabled: 'errorSoundEnabled' },
      sale: { file: '/sounds/notification-sale.mp3', enabled: 'saleSoundEnabled' },
      sync: { file: '/sounds/notification-info.mp3', enabled: 'infoSoundEnabled' },
      system: { file: '/sounds/notification-info.mp3', enabled: 'infoSoundEnabled' },
    };

    const sound = soundMap[type];
    if (!sound || !this.settings[sound.enabled]) {
      return;
    }

    try {
      const audio = new Audio(sound.file);
      audio.volume = this.settings.soundVolume;
      audio.play().catch(e => console.error('Failed to play sound:', e));
    } catch (error) {
      console.error('Failed to create audio:', error);
    }
  }

  /**
   * Show in-app toast notification (uses existing toast system)
   */
  private showInAppToast(notification: AppNotification) {
    // This will be handled by the NotificationToast component
    // We'll emit a custom event that the component can listen to
    window.dispatchEvent(new CustomEvent('show-notification-toast', { detail: notification }));
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
