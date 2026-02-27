import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import ClientLayout from "./lib/providers";
import DynamicRenderer from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { setupGlobalErrorCapture } from "./lib/logger";
import * as Sentry from "@sentry/browser";
import { defaultOptions } from "tauri-plugin-sentry-api";
import './index.css';

// Initialize Sentry for frontend error tracking in production
if (!import.meta.env.DEV) {
  Sentry.init({
    ...defaultOptions,
    dsn: "https://0046d7a07863014fa04415aa9bfcbcf7@o4508136465956864.ingest.de.sentry.io/4510945689075792",
  });
}

// Capture unhandled errors and promise rejections → persisted to log files
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
