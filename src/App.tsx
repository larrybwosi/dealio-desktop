import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router';
import { useEffect } from 'react';
import SetupPage from '@/pages/set-up';
import CheckinPage from '@/pages/checkin';
import { useAuth, useSessionActivityListener } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/pos-auth-store';
import { usePosStore } from '@/store/store';
import { initializeNetworkRole } from '@/lib/kds';
import posthog from 'posthog-js';
import AppLayout from '@/components/app.layout';
import { HistoryPage } from '@/pages/history-page';
import AnalyticsPage from '@/pages/analytics-page';
import CustomersPage from '@/pages/customers-page';
import ManageTablesPage from '@/pages/manage-tables-page';
import CashDrawerPage from '@/pages/cash-drawer-page';
import TillManagementPage from '@/pages/till-management-page';
import ReceiptSettingsPage from '@/pages/receipt-settings-page';
import PendingTransactionsPage from '@/pages/pending-transactions';
import CreateOrderPage from '@/pages/create-order';
import { POS } from '@/pages/pos';
import SettingsPage from '@/pages/settings-page';
import CustomerDisplay from '@/pages/customer-display';
import PricingViewPage from '@/pages/pricing-view-page';
import NotFound from '@/pages/not-found';
import ShiftManager from './components/shift-manager';
import StockDeliveryPage from './pages/stock-acceptance';
import StockTransferCreate from './pages/stock-transfers';
import KDSPage from './pages/kitchen-display';
import HubOverviewPage from './pages/hub-overview';

// Layout wrapper component that uses AppLayout
const LayoutWrapper = () => {
  return (
    <AppLayout>
      <Outlet /> {/* This renders the nested routes */}
    </AppLayout>
  );
};

const AppRoutes = () => {
  const { isConfigured, currentLocation, initializeFromBackend, isInitialized, deviceType } = useAuthStore();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    initializeFromBackend();
  }, [initializeFromBackend]);

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!isConfigured || !currentLocation?.id) {
    return <SetupPage />;
  }

  if (!isAuthenticated) {
    return <CheckinPage />;
  }

  // If KDS device, boot directly to KDS page
  if (deviceType === 'KDS') {
    return (
      <Routes>
        <Route index path="/" element={<KDSPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<KDSPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Routes with AppLayout wrapper */}
      <Route element={<LayoutWrapper />}>
        <Route index path="/" element={<POS />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/manage-tables" element={<ManageTablesPage />} />
        <Route path="/cash-drawer" element={<CashDrawerPage />} />
        <Route path="/till-management" element={<TillManagementPage />} />
        <Route path="/receipt-settings" element={<ReceiptSettingsPage />} />
        <Route path="/pending-transactions" element={<PendingTransactionsPage />} />
        <Route path="/create-order" element={<CreateOrderPage />} />
        <Route path="/pricing" element={<PricingViewPage />} />
        <Route path="/shift-manager" element={<ShiftManager />} />
        <Route path="/stock-acceptance" element={<StockDeliveryPage />} />
        <Route path="/stock-transfer" element={<StockTransferCreate />} />
        <Route path="/kds" element={<KDSPage />} />
        <Route path="/hub-overview" element={<HubOverviewPage />} />
      </Route>

      {/* Routes without AppLayout */}
      <Route path="/checkin" element={<CheckinPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/customer" element={<CustomerDisplay />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const DynamicRenderer = () => {
  useSessionActivityListener();

  const fetchTables = usePosStore(state => state.fetchTables);

  useEffect(() => {
    initializeNetworkRole();
    fetchTables();
    posthog.capture('app_started');
    // Hide and remove the splashscreen from index.html
    const splash = document.getElementById('splash-root');
    if (splash) {
      setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
          splash.remove();
        }, 500);
      }, 500);
    }
  }, []);

  return (
    <Router>
      <AppRoutes />
    </Router>
  );
};

export default DynamicRenderer;
