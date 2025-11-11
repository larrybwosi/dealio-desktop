"use client"

import { Settings } from "lucide-react"
import { usePosStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"

export function NotificationSettingsDialog() {
  const notificationSettings = usePosStore((state) => state.settings.notificationSettings)
  const updateNotificationSettings = usePosStore((state) => state.updateNotificationSettings)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>Configure how you receive notifications</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable Notifications</Label>
            <Switch
              id="enabled"
              checked={notificationSettings?.enabled}
              onCheckedChange={(checked) => updateNotificationSettings({ enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="sound">Enable Sound</Label>
            <Switch
              id="sound"
              checked={notificationSettings?.soundEnabled}
              onCheckedChange={(checked) => updateNotificationSettings({ soundEnabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="online-orders">Show Online Orders</Label>
            <Switch
              id="online-orders"
              checked={notificationSettings?.showOnlineOrders}
              onCheckedChange={(checked) => updateNotificationSettings({ showOnlineOrders: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="low-stock">Show Low Stock Alerts</Label>
            <Switch
              id="low-stock"
              checked={notificationSettings?.showLowStock}
              onCheckedChange={(checked) => updateNotificationSettings({ showLowStock: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="system-alerts">Show System Alerts</Label>
            <Switch
              id="system-alerts"
              checked={notificationSettings?.showSystemAlerts}
              onCheckedChange={(checked) => updateNotificationSettings({ showSystemAlerts: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Toast Position</Label>
            <Select
              value={notificationSettings?.position}
              onValueChange={(value: any) => updateNotificationSettings({ position: value })}
            >
              <SelectTrigger id="position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-close">Auto Close Delay (ms)</Label>
            <Input
              id="auto-close"
              type="number"
              min="1000"
              step="1000"
              value={notificationSettings?.autoCloseDelay}
              onChange={(e) => updateNotificationSettings({ autoCloseDelay: Number.parseInt(e.target.value) })}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
