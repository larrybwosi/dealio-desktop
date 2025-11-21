'use client';

import { cn } from '@/lib/utils';
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
  SidebarClose,
  SidebarOpen,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePosStore } from '@/store/store';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
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
};

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarItems = usePosStore(state => state.settings.sidebarItems.filter(item => item.enabled));
  const businessName = usePosStore(state => state.settings.businessName);
  const { currentMember } = useAuth();

  return (
    <div
      className={cn(
        'border-r border-border bg-sidebar h-screen flex flex-col transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="p-6 border-b border-border flex items-center gap-3 relative">
        {!isCollapsed && (
          <>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">
                {businessName.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <span className="font-semibold text-lg truncate">{businessName}</span>
          </>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-sm">
              {businessName.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-border bg-background flex items-center justify-center hover:bg-accent transition-colors',
            isCollapsed && 'right-1/2 translate-x-1/2'
          )}
        >
          {isCollapsed ? <SidebarOpen className="w-4 h-4" /> : <SidebarClose className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        {sidebarItems.map(item => {
          const Icon = iconMap[item.icon] || ShoppingBag;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mb-1 transition-colors',
                activeTab === item.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent',
                isCollapsed && 'justify-center px-0'
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={() => onTabChange('receipt-settings')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'receipt-settings'
              ? 'bg-primary text-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent',
            isCollapsed && 'justify-center px-0'
          )}
          title={isCollapsed ? 'Receipt Settings' : undefined}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">Receipt Settings</span>}
        </button>
        <button
          onClick={() => onTabChange('settings')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            activeTab === 'settings'
              ? 'bg-primary text-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent',
            isCollapsed && 'justify-center px-0'
          )}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">Settings</span>}
        </button>
        <button
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
            isCollapsed && 'justify-center px-0'
          )}
          title={isCollapsed ? 'Help Center' : undefined}
        >
          <HelpCircle className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">Help Center</span>}
        </button>

        {!isCollapsed && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent mt-4">
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarImage src={currentMember?.image} />
              <AvatarFallback>{currentMember?.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{currentMember?.name}</div>
              <div className="text-xs text-muted-foreground truncate">{currentMember?.email}</div>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="flex justify-center p-3 rounded-lg bg-sidebar-accent mt-4">
            <Avatar className="w-8 h-8">
              <AvatarImage src="/placeholder.svg?height=32&width=32" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        )}
      </div>
    </div>
  );
}
