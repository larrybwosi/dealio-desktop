import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import ClientLayout from "./lib/providers";
import DynamicRenderer from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import { setupGlobalErrorCapture } from "./lib/logger";
import * as Sentry from "@sentry/browser";
import { defaultOptions } from "tauri-plugin-sentry-api";
import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react';
import { captureEvent } from "tauri-plugin-better-posthog";
import './index.css';

// Initialize Sentry for frontend error tracking in production
if (!import.meta.env.DEV) {
  Sentry.init({
    ...defaultOptions,
    dsn: import.meta.env.VITE_PUBLIC_SENTRY_DSN,
  });
}

// Initialize PostHog
posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: '2026-01-30',
  // Route ALL events through the Rust backend
  before_send: [
    (captureResult) => {
      if (captureResult) {
        const { event, properties } = captureResult;
        
        // Pass to Rust via Tauri IPC
        captureEvent(event, properties).catch(console.error);
      }
      
      // CRITICAL: Return `null` to stop posthog-js from sending a network request
      return null;
    },
  ],
});

if(!import.meta.env.Dev){
  Sentry.getCurrentScope().setTag('posthog_session_id', posthog.get_session_id())
}


// Capture unhandled errors and promise rejections → persisted to log files
setupGlobalErrorCapture();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <ClientLayout>
        <ErrorBoundary>
          <DynamicRenderer />
        </ErrorBoundary>
      </ClientLayout>
    </PostHogProvider>
  </StrictMode>
);
