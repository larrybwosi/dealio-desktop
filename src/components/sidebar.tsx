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
  Clock,
  Plus,
  Banknote,
  Wallet,
  LogOut,
  QrCode,
  LayoutGrid,
  MapPin
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { usePosStore } from '@/store/store';
import { useAuth } from '@/hooks/use-auth';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { ScanOrderDialog } from "./scan-order-dialog";

// Map sidebar item IDs to their respective routes
const routeMap: Record<string, string> = {
  order: '/',
  'create-order': '/create-order',
  'pending-transactions': '/pending-transactions',
  history: '/history',
  analytics: '/analytics',
  customers: '/customers',
  'manage-table': '/manage-tables',
  'cash-drawer': '/cash-drawer',
  'till-management': '/till-management',
  'receipt-settings': '/receipt-settings',
  settings: '/settings',
};

// Map sidebar items to icons
const iconMap: Record<string, any> = {
  ShoppingBag: ShoppingBag,
  Package: Package,
  History: History,
  BarChart3: BarChart3,
  CreditCard: CreditCard,
  DollarSign: DollarSign,
  Table: Table,
  Users: Users,
  UserCheck: UserCheck,
  Calculator: Calculator,
  Clock: Clock,
  Plus: Plus,
  Receipt: Receipt,
  Settings: Settings,
  BankNote: Banknote,
  LayoutGrid: LayoutGrid, 
  QrCode: QrCode,
  Wallet: Wallet,
};

interface SidebarProps {
  onCheckout?: () => void;
}

export function Sidebar({ onCheckout }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  
  const sidebarItems = usePosStore(state => state.settings.sidebarItems.filter(item => item.enabled));
  const businessName = usePosStore(state => state.settings.businessName);
  const { currentMember, currentLocation } = useAuth();
  const location = useLocation();

  // Function to get active tab based on current route
  const getActiveTab = () => {
    const path = location.pathname;
    
    // First pass: exact match
    for (const [key, route] of Object.entries(routeMap)) {
      if (route === path) return key;
    }
    
    // Second pass: starts with (excluding root '/')
    for (const [key, route] of Object.entries(routeMap)) {
      if (route !== '/' && path.startsWith(route)) return key;
    }
    
    return 'order'; // default to order
  };

  const activeTab = getActiveTab();

  return (
    <>
      <div
        className={cn(
          'border-r bg-card h-screen flex flex-col transition-all duration-300',
          isCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className="p-6 border-b flex items-center gap-3 relative">
          {!isCollapsed && (
            <Link to="/" className="flex items-center gap-3 no-underline hover:opacity-80 transition-opacity overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-bold text-sm">
                  {(businessName || "Dealio").substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-lg truncate text-foreground leading-tight">{businessName}</span>
                {currentLocation && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    <MapPin className="w-2.5 h-2.5" />
                    <span className="truncate">{currentLocation.name}</span>
                  </div>
                )}
              </div>
            </Link>
          )}
          {isCollapsed && (
            <Link to="/" className="mx-auto flex flex-col items-center gap-1">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
                  {(businessName || "Dealio").substring(0, 2).toUpperCase()}
                </span>
              </div>
              {currentLocation && (
                <span className="text-[8px] text-muted-foreground font-bold uppercase truncate max-w-[48px]">
                  {currentLocation.name}
                </span>
              )}
            </Link>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              'absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border bg-background flex items-center justify-center hover:bg-accent transition-colors z-10 shadow-sm',
              isCollapsed && 'right-1/2 translate-x-1/2'
            )}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <SidebarOpen className="w-4 h-4" /> : <SidebarClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          {/* Dynamic sidebar items from store */}
          {sidebarItems.map(item => {
            const Icon = iconMap[item.icon] || ShoppingBag;
            const route = routeMap[item.id] || `/${item.id}`;
            const isActive = activeTab === item.id;
            
            return (
              <Button
                key={item.id}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  'w-full justify-start gap-3 mb-1',
                  isCollapsed && 'justify-center px-0'
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Link to={route}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </Button>
            );
          })}
          
          {/* Validate Order Button */}
          <Button
            variant={isScanOpen ? "secondary" : "ghost"}
            className={cn(
              'w-full justify-start gap-3 mb-1',
              isCollapsed && 'justify-center px-0'
            )}
            onClick={() => setIsScanOpen(true)}
            title={isCollapsed ? 'Validate Order' : undefined}
          >
            <QrCode className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Validate Order</span>}
          </Button>

          {/* Additional fixed navigation items */}
          <Button
            asChild
            variant={activeTab === 'pending-transactions' ? "secondary" : "ghost"}
            className={cn(
              'w-full justify-start gap-3 mb-1',
              isCollapsed && 'justify-center px-0'
            )}
            title={isCollapsed ? 'Pending Transactions' : undefined}
          >
            <Link to="/pending-transactions">
              <Clock className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">Pending Transactions</span>}
            </Link>
          </Button>

          <Button
            asChild
            variant={activeTab === 'create-order' ? "secondary" : "ghost"}
            className={cn(
              'w-full justify-start gap-3 mb-1',
              isCollapsed && 'justify-center px-0'
            )}
            title={isCollapsed ? 'Create Order' : undefined}
          >
            <Link to="/create-order">
              <Plus className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">Create Order</span>}
            </Link>
          </Button>

          <Button
            asChild
            variant={activeTab === 'cash-drawer' ? "secondary" : "ghost"}
            className={cn(
              'w-full justify-start gap-3 mb-1',
              isCollapsed && 'justify-center px-0'
            )}
            title={isCollapsed ? 'Cash Drawer' : undefined}
          >
            <Link to="/cash-drawer">
              <Wallet className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">Cash Drawer</span>}
            </Link>
          </Button>
        </nav>

        <div className="p-4 border-t space-y-2">
          <Button
            asChild
            variant={activeTab === 'receipt-settings' ? "secondary" : "ghost"}
            className={cn(
              'w-full justify-start gap-3',
              isCollapsed && 'justify-center px-0'
            )}
            title={isCollapsed ? 'Receipt Settings' : undefined}
          >
            <Link to="/receipt-settings">
              <Receipt className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">Receipt Settings</span>}
            </Link>
          </Button>

          <Button
            asChild
            variant={activeTab === 'settings' ? "secondary" : "ghost"}
            className={cn(
              'w-full justify-start gap-3',
              isCollapsed && 'justify-center px-0'
            )}
            title={isCollapsed ? 'Settings' : undefined}
          >
            <Link to="/settings">
              <Settings className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">Settings</span>}
            </Link>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start gap-3',
              isCollapsed && 'justify-center px-0'
            )}
            title={isCollapsed ? 'Help Center' : undefined}
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="truncate">Help Center</span>}
          </Button>

          {/* User profile section */}
          {!isCollapsed && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted mt-4">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={currentMember?.image} />
                <AvatarFallback>{currentMember?.name?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{currentMember?.name || 'User'}</div>
                <div className="text-xs text-muted-foreground truncate">{currentMember?.email || ''}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={onCheckout}
                title="Check Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          {isCollapsed && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <div className="flex justify-center p-3 rounded-lg bg-muted w-full">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={currentMember?.image} />
                  <AvatarFallback>{currentMember?.name?.substring(0, 1).toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={onCheckout}
                title="Check Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <ScanOrderDialog open={isScanOpen} onOpenChange={setIsScanOpen} />
    </>
  );
}