// VIKTIG: browser-shim FØRST (self-installerer ved import) → må evaluere før App-modulen
// leser sine module-consts (IS_BROWSER_TEST). No-op i native app (ekte Tauri finnes).
import "./lib/browserTauriShim";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* Topp-nivå ErrorBoundary: uten den white-screener ethvert render-unntak i en
        view HELE appen uten vei tilbake (kun tvangs-restart). Nå vises en fallback. */}
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
