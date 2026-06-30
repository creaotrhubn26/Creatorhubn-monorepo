import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installBackendFetchShim } from "./lib/backendFetchShim";

// MÅ kjøre før noe komponent-fetch — ruter backend-kall utenom WKWebView-CORS.
installBackendFetchShim();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
