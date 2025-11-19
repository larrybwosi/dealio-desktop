import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { OrdersList } from "@/components/orders-list";
import { MenuList } from "@/components/menu-list";
import { OrderDetails } from "@/components/order-details";
import { SettingsPage } from "@/components/settings-page";
import { HistoryPage } from "@/components/history-page";
import { ReceiptSettingsPage } from "@/components/receipt-settings-page";
import { ManageTablesPage } from "@/components/manage-tables-page";
import { Input } from "@/components/ui/input";
import { Calendar, Search, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/store/store";
import { AnalyticsPage } from "@/components/analytics-page";
import { CustomersPage } from "@/components/customers-page";
import { CashDrawerPage } from "@/components/cash-drawer-page";
import { InventoryPage } from "@/components/inventory-page";
import { NotificationCenter } from "@/components/notification-center";
import { NotificationSettingsDialog } from "@/components/notification-settings-dialog";
import { MemberCheckinPage } from "@/components/member-checkin-page";
import { TillManagementPage } from "@/components/till-management-page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePosAuth } from "@/hooks/use-auth";

export default function Home() {
  const [activeTab, setActiveTab] = useState("menu-order");
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);

  const businessConfig = usePosStore((state) => state.getBusinessConfig());
  const simulateOnlineOrder = usePosStore((state) => state.simulateOnlineOrder);
  const addNotification = usePosStore((state) => state.addNotification);
    const { checkOut,currentMember } = usePosAuth();

  const handleCheckout = () => {
    checkOut();
    setShowCheckoutDialog(false);
  };

  const showSidebar = true;
  const showOrderDetails = activeTab === "menu-order";

  return (
    <div className="flex h-screen overflow-hidden">
      {showSidebar && <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border px-6 flex items-center justify-between bg-background">
          <div className="flex items-center gap-6 flex-1">
            <h1 className="text-lg">
              <span className="text-muted-foreground">Welcome, </span>
              <span className="font-semibold">{currentMember?.name || 'User'}</span>
            </h1>

            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search anything" className="pl-10" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationCenter />
            <NotificationSettingsDialog />

            <Button variant="outline" size="sm" onClick={simulateOnlineOrder} className="hidden md:flex bg-transparent">
              Test Order
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                addNotification({
                  type: 'success',
                  priority: 'medium',
                  title: 'Test Notification',
                  message: 'This is a test notification from the system',
                  soundEnabled: true,
                  autoClose: true,
                })
              }
              className="hidden md:flex"
            >
              Test Alert
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCheckoutDialog(true)}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              Check Out
            </Button>

            <Button variant="ghost" size="icon">
              <Calendar className="w-5 h-5" />
            </Button>
            <Button variant="outline" className="gap-2 bg-transparent">
              <Calendar className="w-4 h-4" />
              07 Mei 2025
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-auto">
          {activeTab === 'menu-order' && (
            <>
              {businessConfig.features.showOrdersList && <OrdersList />}
              <MenuList />
            </>
          )}
          {activeTab === 'settings' && <SettingsPage />}
          {activeTab === 'history' && <HistoryPage />}
          {activeTab === 'receipt-settings' && <ReceiptSettingsPage />}
          {activeTab === 'analytic' && <AnalyticsPage />}
          {activeTab === 'customers' && <CustomersPage />}
          {activeTab === 'withdrawl' && <CashDrawerPage />}
          {activeTab === 'inventory' && <InventoryPage />}
          {activeTab === 'manage-table' && <ManageTablesPage />}
          {activeTab === 'member-checkin' && <MemberCheckinPage />}
          {activeTab === 'till-management' && <TillManagementPage />}
          {activeTab !== 'menu-order' &&
            activeTab !== 'settings' &&
            activeTab !== 'history' &&
            activeTab !== 'receipt-settings' &&
            activeTab !== 'analytic' &&
            activeTab !== 'customers' &&
            activeTab !== 'withdrawl' &&
            activeTab !== 'inventory' &&
            activeTab !== 'manage-table' &&
            activeTab !== 'member-checkin' &&
            activeTab !== 'till-management' && (
              <div className="p-6">
                <h2 className="text-2xl font-bold capitalize">{activeTab.replace('-', ' ')}</h2>
                <p className="text-muted-foreground mt-2">This section is under development.</p>
              </div>
            )}
        </div>
      </div>

      {showOrderDetails && <OrderDetails />}

      <AlertDialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to check out? This will end your current session and return you to the check-in
              screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCheckout} className="bg-destructive hover:bg-destructive/90">
              Check Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
