import SetupPage from './pages/set-up';
import CheckinPage from './pages/checkin';
import { useAuth, useSessionActivityListener } from './hooks/use-auth';
import Home from './pages';
import { useAuthStore } from './store/pos-auth-store';

const DynamicRenderer = () => {
  const { deviceKey } = useAuthStore();
  const { isAuthenticated } = useAuth();
  useSessionActivityListener();

  // Render logic based on states
  if (!deviceKey) {
    return <SetupPage />;
  }

  if (!isAuthenticated) {
    return <CheckinPage />;
  }

  return <Home />;
};

export default DynamicRenderer;
