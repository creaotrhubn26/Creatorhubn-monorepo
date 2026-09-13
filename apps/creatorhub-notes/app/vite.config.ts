import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // To kopier av `@codemirror/state` i treet gir to sett `StateField`-id-er,
  // og da finner ikke `undo` historikkfeltet: ⌘Z blir en stille no-op. Det har
  // skjedd her før (`@codemirror/commands` dro med seg sin egen 6.7.4 mot en
  // toppnivåpinne på 6.5.2), og versjonene er nå like — dette holder det slik
  // også i bunten om et nytt ledd i treet drar inn en tredje.
  resolve: { dedupe: ["@codemirror/state", "@codemirror/view"] },
  clearScreen: false,
  server: {
    port: 1426,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
