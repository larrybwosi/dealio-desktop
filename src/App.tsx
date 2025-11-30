import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import SetupPage from '@/pages/set-up';
import CheckinPage from '@/pages/checkin';
import { useAuth, useSessionActivityListener } from '@/hooks/use-auth';
import Home from '@/pages';
import { useAuthStore } from '@/store/pos-auth-store';
import { UpdaterProvider } from '@/lib/UpdateProvider';

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
      <Route path="/" element={<Home />} />
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
      <UpdaterProvider autoDownload={true} checkInterval={60 * 60 * 1000 * 4}> {/* 4 hours */}
        <AppRoutes />
      </UpdaterProvider>
    </Router>
  );
};

export default DynamicRenderer;