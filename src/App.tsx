import SetupPage from './pages/set-up';
import CheckinPage from './pages/checkin';
import { usePosAuth } from './hooks/use-auth';
import Home from './pages';
import { usePosAuthStore } from './store/pos-auth-store';

const DynamicRenderer = () => {
  const { deviceKey } = usePosAuthStore();
  const { isAuthenticated } = usePosAuth();

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
