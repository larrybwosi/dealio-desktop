import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ClientLayout from "./lib/providers";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ClientLayout>
      <App />
    </ClientLayout>
  </React.StrictMode>
);
