import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // 3D-device-mesh (.glb) importeres som asset-URL (mockup3d glTF-slot).
  assetsInclude: ["**/*.glb"],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    // 5001 er allowlistet backend-CORS-origin (index.ts KNOWN_ORIGINS). Dev-
    // webview-fetch mot /api/post-agent/pairing/* trenger en allowlistet origin
    // ellers «TypeError: Load failed». (1420 er nå også lagt til backend-lista.)
    port: Number(process.env.PLAYWRIGHT_PORT || 5001),
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
