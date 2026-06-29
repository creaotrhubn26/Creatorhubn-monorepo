import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App";

// CreatorHub mørk/oransje (samme palett som workspace/admin — IKKE lilla).
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ff8c00" },
    background: { default: "#0e1320", paper: "#161c2c" },
    text: { primary: "#e8edf6", secondary: "#9fb0c6" },
  },
  shape: { borderRadius: 10 },
  typography: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
