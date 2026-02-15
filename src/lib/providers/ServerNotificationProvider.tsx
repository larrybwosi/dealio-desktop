import { createContext, useContext, useCallback, useState, useEffect } from "react"
import { ServerNotification } from "@/types/notifications"
import { useAuthStore } from "@/store/pos-auth-store"
import { notificationService } from "@/lib/notification-service"
import { useAblyStore } from "@/store/ablyStore"

interface ServerNotificationContextType {
  lastNotification: ServerNotification | null;
  history: ServerNotification[];
  clearHistory: () => void;
}

const ServerNotificationContext = createContext<ServerNotificationContextType | undefined>(undefined)

export function ServerNotificationProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<ServerNotification[]>([])
  const [lastNotification, setLastNotification] = useState<ServerNotification | null>(null)
  const ably = useAblyStore((state) => state.client);
  
  // Get the ably instance directly
  const { currentLocation } = useAuthStore();
  const storeId = currentLocation?.id;

  // Handle Incoming Message Logic
  const handleIncomingMessage = useCallback(async (msg: any) => {
    console.log('Incoming message:', msg);
    const notification: ServerNotification = msg.data;

    // 1. Update State
    setLastNotification(notification)
    setHistory(prev => [notification, ...prev].slice(0, 50)) // Keep last 50

    // 2. Route through notification service
    const notificationType = notification.type === 'order_ready' ? 'sale' : 
                             notification.type === 'announcement' ? 'info' :
                             notification.type === 'error' ? 'error' :
                             notification.type === 'warning' ? 'warning' :
                             notification.type === 'success' ? 'success' : 'info';

    const priority = notification.priority === 'high' ? 'high' :
                     notification.priority === 'medium' ? 'medium' : 'low';

    await notificationService.send({
      title: notification.title,
      body: notification.message,
      type: notificationType,
      priority: priority,
      persistent: true,
      action: notification.action ? {
        label: notification.action.label,
        actionType: notification.action.actionType || 'custom',
        payload: notification.action.payload
      } : undefined
    });

  }, [])

  useEffect(() => {
    // 1. Guard clauses: Ensure ably and storeId exist before subscribing
    if (!ably || !storeId) return;
    console.log('Subscribing to Ably channels', storeId);

    // 2. Get Channel instances
    const storeChannel = ably.channels.get(`store:${storeId}`);
    const systemChannel = ably.channels.get(`system:global`);

    // 3. Subscribe 
    storeChannel.subscribe(handleIncomingMessage);
    systemChannel.subscribe(handleIncomingMessage);

    console.log(`Subscribed to Ably channels: store:${storeId} and system:global`);

    // 4. Cleanup Function
    return () => {
      storeChannel.unsubscribe(handleIncomingMessage);
      systemChannel.unsubscribe(handleIncomingMessage);
      console.log(`Unsubscribed from Ably channels`);
    };
  }, [ably, storeId, handleIncomingMessage]);

  return (
    <ServerNotificationContext.Provider value={{ lastNotification, history, clearHistory: () => setHistory([]) }}>
      {children}
    </ServerNotificationContext.Provider>
  )
}

// Hook for consuming notifications
export const useServerNotifications = () => {
  const context = useContext(ServerNotificationContext)
  if (!context) throw new Error("useServerNotifications must be used within ServerNotificationProvider")
  return context
}
