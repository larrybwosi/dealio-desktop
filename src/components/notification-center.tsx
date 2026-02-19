"use client"

import { useEffect, useState, useMemo } from "react"
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  AlertCircle, 
  Package, 
  ShoppingCart, 
  Info, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Search,
  CalendarDays
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { notificationService, type AppNotification, type NotificationType } from "@/lib/notification-service"
import { listen } from "@tauri-apps/api/event"
import { isToday, isYesterday, parseISO, format } from "date-fns"

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    loadNotifications()

    const unsubscribe = notificationService.subscribe(() => {
      loadNotifications()
    })

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

  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      const matchesSearch = 
        notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notification.body.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesTab = 
        activeTab === "all" ||
        (activeTab === "unread" && !notification.read) ||
        (activeTab === "sales" && notification.notificationType === "sale") ||
        (activeTab === "alerts" && ["warning", "error"].includes(notification.notificationType))
      
      return matchesSearch && matchesTab
    })
  }, [notifications, searchQuery, activeTab])

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, AppNotification[]> = {
      "Today": [],
      "Yesterday": [],
      "Earlier": []
    }

    filteredNotifications.forEach(notification => {
      const date = parseISO(notification.timestamp)
      if (isToday(date)) {
        groups["Today"].push(notification)
      } else if (isYesterday(date)) {
        groups["Yesterday"].push(notification)
      } else {
        groups["Earlier"].push(notification)
      }
    })

    return groups
  }, [filteredNotifications])

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
        return "bg-red-50/50 dark:bg-red-950/10 border-red-100 dark:border-red-900/20"
      case "warning":
        return "bg-yellow-50/50 dark:bg-yellow-950/10 border-yellow-100 dark:border-yellow-900/20"
      case "success":
        return "bg-green-50/50 dark:bg-green-950/10 border-green-100 dark:border-green-900/20"
      case "sale":
        return "bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/20"
      default:
        return "bg-gray-50/50 dark:bg-gray-900/20 border-gray-100 dark:border-gray-800"
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = parseISO(timestamp)
    return format(date, "h:mm a")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
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
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[75vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-8 pb-6 border-b bg-muted/5">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1.5">
              <DialogTitle className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bell className="h-6 w-6 text-primary" />
                </div>
                Notifications Center
                {unreadCount > 0 && (
                  <Badge variant="default" className="ml-2 px-2.5 py-0.5 text-xs font-semibold animate-pulse">
                    {unreadCount} New
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                Stay updated with your latest sales, system alerts, and inventory updates.
              </DialogDescription>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                className="h-10 px-4 font-medium transition-all hover:bg-primary/5"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all as read
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAll}
                disabled={notifications.length === 0}
                className="h-10 px-4 font-medium text-destructive hover:text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear history
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
              <TabsList className="bg-muted/50 p-1 h-12">
                <TabsTrigger value="all" className="px-6 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">All</TabsTrigger>
                <TabsTrigger value="unread" className="px-6 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">Unread</TabsTrigger>
                <TabsTrigger value="sales" className="px-6 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">Sales</TabsTrigger>
                <TabsTrigger value="alerts" className="px-6 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">Alerts</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search through your notifications..."
                className="pl-10 h-12 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="h-10 w-10 opacity-20" />
              </div>
              <p className="text-lg font-medium">No notifications found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
              {(searchQuery || activeTab !== "all") && (
                <Button 
                  variant="link" 
                  onClick={() => { setSearchQuery(""); setActiveTab("all"); }}
                  className="mt-2"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <div className="p-8 space-y-10">
              {Object.entries(groupedNotifications).map(([group, groupNotifications]) => (
                groupNotifications.length > 0 && (
                  <div key={group} className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted p-1.5 rounded-lg">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                        {group}
                      </h3>
                      <div className="h-px flex-1 bg-border/40" />
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {groupNotifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            "group relative rounded-2xl p-5 transition-all duration-300 border",
                            "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
                            !notification.read 
                              ? cn(getNotificationColor(notification.notificationType), "border-primary/20 shadow-sm") 
                              : "bg-card hover:bg-accent/30 border-border/50"
                          )}
                          onClick={() => !notification.read && markAsRead(notification.id)}
                        >
                          <div className="flex gap-5">
                            <div className={cn(
                              "flex-shrink-0 mt-0.5 rounded-2xl p-3 h-14 w-14 flex items-center justify-center shadow-sm transition-transform group-hover:scale-110",
                              !notification.read ? "bg-background" : "bg-muted/50"
                            )}>
                              {getNotificationIcon(notification.notificationType)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-6">
                                <div className="space-y-1.5">
                                  <h4 className={cn(
                                    "text-lg leading-snug tracking-tight",
                                    !notification.read ? "font-bold text-foreground" : "font-semibold text-muted-foreground"
                                  )}>
                                    {notification.title}
                                  </h4>
                                  <p className={cn(
                                    "text-[15px] leading-relaxed",
                                    !notification.read ? "text-foreground/80" : "text-muted-foreground"
                                  )}>
                                    {notification.body}
                                  </p>
                                </div>
                                
                                <div className="flex flex-col items-end gap-3 flex-shrink-0">
                                  <span className="text-xs font-bold text-muted-foreground/70 uppercase tracking-tighter whitespace-nowrap bg-muted/50 px-2.5 py-1.5 rounded-lg border border-border/10">
                                    {formatTimestamp(notification.timestamp)}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-all rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      deleteNotification(notification.id)
                                    }}
                                  >
                                    <Trash2 className="h-4.5 w-4.5" />
                                  </Button>
                                </div>
                              </div>
                              
                              {notification.action && (
                                <div className="mt-5 pt-5 border-t border-border/10 flex justify-end">
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-10 px-6 font-semibold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      console.log('Action clicked:', notification.action)
                                    }}
                                  >
                                    {notification.action.label}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {!notification.read && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-primary rounded-r-2xl shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-4 border-t bg-muted/30 flex items-center justify-center">
           <p className="text-xs text-muted-foreground">
             Showing {filteredNotifications.length} of {notifications.length} notifications
           </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
