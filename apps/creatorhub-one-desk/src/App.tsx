import { useEffect, useState } from "react";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { loadStoredConfig, StoredConfig } from "./api";
import TokenSetupScreen from "./components/TokenSetupScreen";
import ProjectInfoScreen from "./components/ProjectInfoScreen";
import UpdaterDialog from "./components/UpdaterDialog";

type Status = "loading" | "needs-token" | "connected";

interface PendingUpdate {
  version: string;
  notes: string | null;
  runDownload: (
    onProgress: (fraction: number, status: "downloading" | "finished") => void,
  ) => Promise<void>;
}

export default function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [config, setConfig] = useState<StoredConfig | null>(null);
  const [updateInfo, setUpdateInfo] = useState<PendingUpdate | null>(null);

  // Auto-updater: sjekk én gang 4s etter mount slik at hovedflyten ikke
  // blokkes av en tung GitHub-fetch. Hvis funnet, vises UpdaterDialog.
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const updater = await import("@tauri-apps/plugin-updater");
        const update = await updater.check();
        if (!update) return;
        setUpdateInfo({
          version: update.version,
          notes: update.body ?? null,
          runDownload: async (onProgress) => {
            let total = 0;
            let downloaded = 0;
            await update.downloadAndInstall((event) => {
              if (event.event === "Started") {
                total = event.data.contentLength ?? 0;
                onProgress(0, "downloading");
              } else if (event.event === "Progress") {
                downloaded += event.data.chunkLength;
                if (total > 0) onProgress(downloaded / total, "downloading");
              } else if (event.event === "Finished") {
                onProgress(1, "finished");
              }
            });
          },
        });
      } catch (e) {
        // Updater ikke konfigurert (manglende endpoint/pubkey) — vanlig i dev
        console.warn("[updater] ikke tilgjengelig:", e);
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  const refresh = async () => {
    setStatus("loading");
    try {
      const cfg = await loadStoredConfig();
      if (cfg && cfg.has_token) {
        setConfig(cfg);
        setStatus("connected");
      } else {
        setConfig(null);
        setStatus("needs-token");
      }
    } catch {
      setConfig(null);
      setStatus("needs-token");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (status === "loading") {
    return (
      <Container maxWidth="md" sx={{ py: 10, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Laster lagret config…
        </Typography>
      </Container>
    );
  }

  if (status === "needs-token") {
    return <TokenSetupScreen onSaved={refresh} />;
  }

  return (
    <Box>
      {config && <ProjectInfoScreen config={config} onLoggedOut={refresh} />}
      {updateInfo && (
        <UpdaterDialog
          version={updateInfo.version}
          notes={updateInfo.notes}
          onDownload={updateInfo.runDownload}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}
    </Box>
  );
}
