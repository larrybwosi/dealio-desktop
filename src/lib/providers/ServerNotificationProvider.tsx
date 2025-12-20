import { createContext, useContext, useCallback, useState, useEffect } from "react"
import { notify } from "@/lib/notify"
import { ServerNotification } from "@/types/notifications"
import { useAuthStore } from "@/store/pos-auth-store"
import { ably } from "../ably"

// Audio files for different alerts
const SOUNDS = {
  ping: "/sounds/ping.mp3",
  alert: "/sounds/alert.mp3",
  kitchen: "/sounds/kitchen_bell.mp3",
}

interface ServerNotificationContextType {
  lastNotification: ServerNotification | null;
  history: ServerNotification[];
  clearHistory: () => void;
}

const ServerNotificationContext = createContext<ServerNotificationContextType | undefined>(undefined)

export function ServerNotificationProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<ServerNotification[]>([])
  const [lastNotification, setLastNotification] = useState<ServerNotification | null>(null)
  
  // Get the ably instance directly
  const { currentLocation } = useAuthStore();
  const storeId = currentLocation?.id;

  // Audio Player Helper
  const playSound = useCallback((type: string) => {
    const audio = new Audio(SOUNDS[type as keyof typeof SOUNDS] || SOUNDS.ping)
    audio.volume = 0.5
    audio.play().catch(e => console.error("Audio play failed", e))
  }, [])

  // Handle Incoming Message Logic
  const handleIncomingMessage = useCallback((msg: any) => {
    const notification: ServerNotification = msg.data;

    // 1. Update State
    setLastNotification(notification)
    setHistory(prev => [notification, ...prev].slice(0, 50)) // Keep last 50

    // 2. Play Sound based on priority/type
    if (notification.type === 'error' || notification.priority === 'high') {
      playSound('alert')
    } else if (notification.type === 'order_ready') {
      playSound('kitchen')
    } else {
      playSound('ping')
    }

    // 3. Trigger Visual Toast via our `notify` lib
    switch (notification.type) {
      case "order_ready":
        notify.success(`Order #${notification.action?.payload?.orderId} is Ready!`)
        break;
      case "announcement":
        notify.info(notification.title, { 
          description: notification.message,
          duration: 10000 
        })
        break;
      case "error":
        notify.error(notification.message)
        break;
      case "warning":
        notify.warning(notification.title, { description: notification.message })
        break;
      default:
        notify.success(notification.title)
    }

    // 4. Handle Auto-Actions
    if (notification.action?.actionType === 'refresh_data') {
      console.log("Server requested data refresh...")
    }

  }, [playSound])

  // --- CHANGED SECTION: Manual Subscription via useEffect ---
  useEffect(() => {
    // 1. Guard clauses: Ensure ably and storeId exist before subscribing
    if (!ably || !storeId) return;

    // 2. Get Channel instances
    const storeChannel = ably.channels.get(`store:${storeId}`);
    const systemChannel = ably.channels.get(`system:global`);

    // 3. Subscribe
    // We pass the handleIncomingMessage callback directly
    storeChannel.subscribe(handleIncomingMessage);
    systemChannel.subscribe(handleIncomingMessage);

    console.log(`Subscribed to Ably channels: store:${storeId} and system:global`);

    // 4. Cleanup Function (Crucial)
    // When component unmounts or storeId changes, we must unsubscribe
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