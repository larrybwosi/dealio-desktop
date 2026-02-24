import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import ClientLayout from "./lib/providers";
import DynamicRenderer from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { setupGlobalErrorCapture } from "./lib/logger";
import './index.css';

// Capture unhandled errors and promise rejections → persisted to log files

// APTABASE = A-EU-2394517177
setupGlobalErrorCapture();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ClientLayout>
      <ErrorBoundary>
        <DynamicRenderer />
      </ErrorBoundary>
    </ClientLayout>
  </StrictMode>
);
