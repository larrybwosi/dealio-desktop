import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router';
import SetupPage from '@/pages/set-up';
import CheckinPage from '@/pages/checkin';
import { useAuth, useSessionActivityListener } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/pos-auth-store';
import { UpdaterProvider } from '@/lib/UpdateProvider';
import AppLayout from '@/components/app.layout';
import { HistoryPage } from '@/components/history-page';
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

// Layout wrapper component that uses AppLayout
const LayoutWrapper = () => {
  return (
    <AppLayout>
      <Outlet /> {/* This renders the nested routes */}
    </AppLayout>
  );
};

const AppRoutes = () => {
  const { deviceKey, currentLocation } = useAuthStore();
  const { isAuthenticated } = useAuth();

  if (!deviceKey || !currentLocation?.id) {
    return <SetupPage />;
  }

  if (!isAuthenticated) {
    return <CheckinPage />;
  }

  return (
    <Routes>
      {/* Routes with AppLayout wrapper */}
      <Route element={<LayoutWrapper />}>
        <Route index path='/' element={<POS />} />
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
      </Route>
      
      {/* Routes without AppLayout */}
      <Route path="/checkin" element={<CheckinPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const DynamicRenderer = () => {
  useSessionActivityListener();

  return (
    <Router>
      <UpdaterProvider autoDownload={false} checkInterval={60 * 60 * 1000 * 4}>
        <AppRoutes />
      </UpdaterProvider>
    </Router>
  );
};

export default DynamicRenderer;