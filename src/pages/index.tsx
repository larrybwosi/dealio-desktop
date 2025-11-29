import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { OrdersList } from '@/components/orders-list';
import { ProductList } from '@/components/product-list';
import { Cart } from '@/components/cart';
import { SettingsPage } from '@/components/settings-page';
import { HistoryPage } from '@/components/history-page';
import { ReceiptSettingsPage } from '@/pages/receipt-settings-page';
import { ManageTablesPage } from '@/components/manage-tables-page';
import { Input } from '@/components/ui/input';
import { Calendar, Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePosStore } from '@/store/store';
import { AnalyticsPage } from '@/components/analytics-page';
import { CustomersPage } from '@/components/customers-page';
import { CashDrawerPage } from '@/components/cash-drawer-page';
import { InventoryPage } from '@/components/inventory-page';
import { NotificationCenter } from '@/components/notification-center';
import { NotificationSettingsDialog } from '@/components/notification-settings-dialog';
import { TillManagementPage } from '@/components/till-management-page';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/use-auth';
import PendingTransactionsPage from './pending-transactions';

export default function Home() {
  const [activeTab, setActiveTab] = useState('order');
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);

  const businessConfig = usePosStore(state => state.getBusinessConfig());
  const { checkOut, currentMember } = useAuth();

  const handleCheckout = () => {
    checkOut();
    setShowCheckoutDialog(false);
  };

  const showSidebar = true;
  const showCart = activeTab === 'order';

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
          {activeTab === 'order' && (
            <>
              {businessConfig.features.showOrdersList && <OrdersList />}
              <ProductList />
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
          {activeTab === 'till-management' && <TillManagementPage />}
          {activeTab === 'pending-transactions' && <PendingTransactionsPage />}
          {activeTab !== 'order' &&
            activeTab !== 'settings' &&
            activeTab !== 'history' &&
            activeTab !== 'receipt-settings' &&
            activeTab !== 'analytic' &&
            activeTab !== 'customers' &&
            activeTab !== 'withdrawl' &&
            activeTab !== 'inventory' &&
            activeTab !== 'manage-table' &&
            activeTab !== 'till-management' && (
              <div className="p-6">
                <h2 className="text-2xl font-bold capitalize">{activeTab.replace('-', ' ')}</h2>
                <p className="text-muted-foreground mt-2">This section is under development.</p>
              </div>
            )}
        </div>
      </div>

      {showCart && <Cart />}

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
