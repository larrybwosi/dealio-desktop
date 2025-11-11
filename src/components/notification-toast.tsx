"use client"

import { useEffect } from "react"
import { usePosStore } from "@/lib/store"
import { ShoppingCart, Package, AlertCircle, CheckCircle, Info, XCircle } from "lucide-react"
import { toast } from "sonner"

export function NotificationToast() {
  const notifications = usePosStore((state) => state.notifications)
  const notificationSettings = usePosStore((state) => state.settings.notificationSettings)

  useEffect(() => {
    if (!notificationSettings?.enabled) return

    const latestNotification = notifications[0]
    if (!latestNotification) return

    // Check if this notification should be shown as toast
    const shouldShow =
      (latestNotification.type === "order" && notificationSettings.showOnlineOrders) ||
      (latestNotification.type === "stock" && notificationSettings.showLowStock) ||
      (["system", "warning", "error", "success"].includes(latestNotification.type) &&
        notificationSettings.showSystemAlerts)

    if (!shouldShow) return

    // Play sound if enabled
    if (latestNotification.soundEnabled && notificationSettings.soundEnabled) {
      const audio = new Audio("/notification-sound.mp3")
      audio.volume = 0.5
      audio.play().catch(() => {
        // Ignore if sound fails to play
      })
    }

    // Get icon based on type
    const getIcon = () => {
      switch (latestNotification.type) {
        case "order":
          return <ShoppingCart className="h-5 w-5" />
        case "stock":
          return <Package className="h-5 w-5" />
        case "warning":
          return <AlertCircle className="h-5 w-5" />
        case "error":
          return <XCircle className="h-5 w-5" />
        case "success":
          return <CheckCircle className="h-5 w-5" />
        default:
          return <Info className="h-5 w-5" />
      }
    }

    // Show toast notification using the built-in toast system
    // toast({
    //   title: (
    //     <div className="flex items-center gap-2">
    //       {getIcon()}
    //       <span>{latestNotification.title}</span>
    //     </div>
    //   ),
    //   description: latestNotification.message,
    //   variant: latestNotification.type === "error" ? "destructive" : "default",
    // })
  }, [notifications, notificationSettings])

  return null
}
