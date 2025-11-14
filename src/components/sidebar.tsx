"use client"

import { cn } from "@/lib/utils"
import {
  ShoppingBag,
  Package,
  History,
  BarChart3,
  CreditCard,
  DollarSign,
  Table,
  Settings,
  HelpCircle,
  Receipt,
  Users,
  UserCheck,
  Calculator,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePosStore } from "@/store/store"

interface SidebarProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const iconMap: Record<string, any> = {
  ShoppingBag,
  Package,
  History,
  BarChart3,
  CreditCard,
  DollarSign,
  Table,
  Users,
  UserCheck,
  Calculator,
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const sidebarItems = usePosStore((state) => state.settings.sidebarItems.filter((item) => item.enabled))
  const businessName = usePosStore((state) => state.settings.businessName)

  return (
    <div className="w-64 border-r border-border bg-sidebar h-screen flex flex-col">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">
            {businessName.substring(0, 2).toUpperCase()}
          </span>
        </div>
        <span className="font-semibold text-lg">{businessName}</span>
      </div>

      <nav className="flex-1 p-4">
        {sidebarItems.map((item) => {
          const Icon = iconMap[item.icon] || ShoppingBag
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors",
                activeTab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={() => onTabChange("receipt-settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            activeTab === "receipt-settings"
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent",
          )}
        >
          <Receipt className="w-4 h-4" />
          Receipt Settings
        </button>
        <button
          onClick={() => onTabChange("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            activeTab === "settings"
              ? "bg-primary text-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent",
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors">
          <HelpCircle className="w-4 h-4" />
          Help Center
        </button>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent mt-4">
          <Avatar className="w-8 h-8">
            <AvatarImage src="/placeholder.svg?height=32&width=32" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="text-sm font-medium">Jennie doe</div>
            <div className="text-xs text-muted-foreground">jenniedoe@gmail.com</div>
          </div>
        </div>
      </div>
    </div>
  )
}
