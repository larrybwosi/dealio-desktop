"use client"

import { useEffect, useState } from "react"
import { Bell, CheckCheck, Trash2, X, AlertCircle, Package, ShoppingCart, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { notificationService, type AppNotification, type NotificationType } from "@/lib/notification-service"
import { listen } from "@tauri-apps/api/event"

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    // Load initial notifications
    loadNotifications()

    // Listen for new notifications
    const unsubscribe = notificationService.subscribe(() => {
      loadNotifications()
    })

    // Listen for badge updates
    const badgeListener = listen<number>('notification-badge-update', (event) => {
      setUnreadCount(event.payload)
    })

    return () => {
      unsubscribe()
      badgeListener.then(unlisten => unlisten())
    }
  }, [])

  const loadNotifications = async () => {
    const history = await notificationService.getHistory()
    setNotifications(history)
    const count = await notificationService.getUnreadCount()
    setUnreadCount(count)
  }

  const markAsRead = async (id: string) => {
    await notificationService.markRead(id)
    loadNotifications()
  }

  const markAllAsRead = async () => {
    await notificationService.markAllRead()
    loadNotifications()
  }

  const deleteNotification = async (id: string) => {
    await notificationService.delete(id)
    loadNotifications()
  }

  const clearAll = async () => {
    await notificationService.clearAll()
    loadNotifications()
  }

  const getNotificationIcon = (type: NotificationType) => {
    const iconClass = "h-5 w-5"
    switch (type) {
      case "sale":
        return <ShoppingCart className={cn(iconClass, "text-blue-500")} />
      case "sync":
        return <Package className={cn(iconClass, "text-purple-500")} />
      case "warning":
        return <AlertTriangle className={cn(iconClass, "text-yellow-500")} />
      case "error":
        return <XCircle className={cn(iconClass, "text-red-500")} />
      case "success":
        return <CheckCircle className={cn(iconClass, "text-green-500")} />
      case "system":
        return <AlertCircle className={cn(iconClass, "text-gray-500")} />
      default:
        return <Info className={cn(iconClass, "text-blue-500")} />
    }
  }

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case "error":
        return "bg-red-50 dark:bg-red-950/20"
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-950/20"
      case "success":
        return "bg-green-50 dark:bg-green-950/20"
      case "sale":
        return "bg-blue-50 dark:bg-blue-950/20"
      default:
        return "bg-gray-50 dark:bg-gray-900/20"
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[420px]">
        <DropdownMenuLabel className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 text-xs px-2">
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-8 text-xs px-2">
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[500px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-16 w-16 mb-3 opacity-20" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "group relative rounded-xl p-4 transition-all duration-200",
                    "hover:shadow-md cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700",
                    !notification.read && "shadow-sm",
                    !notification.read ? getNotificationColor(notification.notificationType) : "hover:bg-accent/50"
                  )}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex gap-3">
                    {/* Icon with avatar-like styling */}
                    <div className={cn(
                      "flex-shrink-0 mt-0.5 rounded-full p-2",
                      !notification.read ? "bg-white dark:bg-gray-900 shadow-sm" : "bg-gray-100 dark:bg-gray-800"
                    )}>
                      {getNotificationIcon(notification.notificationType)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className={cn(
                            "text-sm leading-tight",
                            !notification.read ? "font-semibold text-gray-900 dark:text-gray-100" : "font-medium text-gray-700 dark:text-gray-300"
                          )}>
                            {notification.title}
                          </p>
                          <p className={cn(
                            "text-sm mt-1 leading-relaxed",
                            !notification.read ? "text-gray-700 dark:text-gray-300" : "text-muted-foreground"
                          )}>
                            {notification.body}
                          </p>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      
                      {/* Timestamp and status */}
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>

                      {/* Action button if available */}
                      {notification.action && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Handle action
                            console.log('Action clicked:', notification.action)
                          }}
                        >
                          {notification.action.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
