import { useEffect, useState } from "react";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { listProjects, loadStoredConfig, StoredConfig } from "./api";
import TokenSetupScreen from "./components/TokenSetupScreen";
import ProjectInfoScreen from "./components/ProjectInfoScreen";
import ProjectPickerScreen from "./components/ProjectPickerScreen";
import UpdaterDialog from "./components/UpdaterDialog";

type Status = "loading" | "needs-token" | "picker" | "connected";

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

  /// Hoved-rute-logikk. Vi har tre tilstander etter loading:
  ///   - needs-token: ingen prosjekter konfigurert ennå → TokenSetupScreen
  ///   - picker: flere prosjekter konfigurert OG bruker har valgt
  ///     "bytt prosjekt" (eller etter logout) → ProjectPickerScreen
  ///   - connected: aktivt prosjekt valgt → ProjectInfoScreen
  /// Migration fra single-project handles automatically i ProjectStore
  /// første gang load skjer.
  const refresh = async () => {
    setStatus("loading");
    try {
      // listProjects() trigger lazy migration fra config.json
      const projs = await listProjects();
      const cfg = await loadStoredConfig();
      if (projs.length === 0) {
        // Ingen prosjekt konfigurert
        setConfig(null);
        setStatus("needs-token");
        return;
      }
      if (cfg && cfg.has_token) {
        // Aktivt prosjekt → connected
        setConfig(cfg);
        setStatus("connected");
      } else {
        // Prosjekter finnes men ingen aktiv → picker
        setConfig(null);
        setStatus("picker");
      }
    } catch {
      setConfig(null);
      setStatus("needs-token");
    }
  };

  const handleSwitchProject = () => {
    setStatus("picker");
    setConfig(null);
  };

  const handleAddNew = () => {
    setStatus("needs-token");
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

  if (status === "picker") {
    return <ProjectPickerScreen onProjectSelected={refresh} onAddNew={handleAddNew} />;
  }

  return (
    <Box>
      {config && (
        <ProjectInfoScreen
          config={config}
          onLoggedOut={refresh}
          onSwitchProject={handleSwitchProject}
        />
      )}
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
