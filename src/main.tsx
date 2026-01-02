import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import ClientLayout from "./lib/providers";
import DynamicRenderer from "./App";
import { ErrorBoundary } from "./components/error-boundary";
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ClientLayout>
      <ErrorBoundary>
        <DynamicRenderer />
      </ErrorBoundary>
    </ClientLayout>
  </StrictMode>
);
