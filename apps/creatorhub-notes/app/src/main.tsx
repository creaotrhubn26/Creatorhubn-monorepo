import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { lesTema, settTema } from "./tema";
import "./styles.css";

// Temaet settes før første tegning, ellers blinker vinduet i feil farge.
settTema(lesTema());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
