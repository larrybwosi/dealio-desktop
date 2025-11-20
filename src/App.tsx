import SetupPage from './pages/set-up';
import CheckinPage from './pages/checkin';
import { useAuth } from './hooks/use-auth';
import Home from './pages';
import { useAuthStore } from './store/pos-auth-store';

const DynamicRenderer = () => {
  const { deviceKey } = useAuthStore();
  const { isAuthenticated } = useAuth();

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
