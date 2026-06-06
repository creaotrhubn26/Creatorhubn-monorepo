import { useEffect, useState } from "react";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { desktopLogout, deviceTokenStatus, listProjects, loadStoredConfig, StoredConfig } from "./api";
import TokenSetupScreen from "./components/TokenSetupScreen";
import ProjectInfoScreen from "./components/ProjectInfoScreen";
import ProjectPickerScreen from "./components/ProjectPickerScreen";
import LoginScreen from "./components/LoginScreen";
import NoProjectsScreen from "./components/NoProjectsScreen";
import UpdaterDialog from "./components/UpdaterDialog";

type Status =
  | "loading"
  | "needs-login"
  | "needs-token"
  | "no-projects"
  | "picker"
  | "connected";

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

  /// Hoved-rute-logikk. Tilstander etter loading:
  ///   - needs-login: ingen device-token + ingen lagrede prosjekter → LoginScreen
  ///   - needs-token: bruker velger "manuelt token" fra LoginScreen → TokenSetupScreen
  ///   - picker: flere prosjekter konfigurert OG bruker har valgt
  ///     "bytt prosjekt" (eller etter logout) → ProjectPickerScreen
  ///   - connected: aktivt prosjekt valgt → ProjectInfoScreen
  /// Migration fra single-project handles automatically i ProjectStore.
  const refresh = async () => {
    setStatus("loading");
    try {
      const projs = await listProjects();
      const cfg = await loadStoredConfig();
      const deviceToken = await deviceTokenStatus().catch(() => null);

      if (projs.length === 0) {
        setConfig(null);
        // Skill mellom «ingen device-token» (vis login) og «innlogget men
        // ingen prosjekter» (vis welcome-skjerm m/ forklaring + link).
        // Tidligere logikk sendte alltid til login → opplevdes som at
        // ingenting skjedde etter Google-login fordi UI returnerte til
        // samme skjermbilde.
        setStatus(deviceToken ? "no-projects" : "needs-login");
        return;
      }
      if (cfg && cfg.has_token) {
        setConfig(cfg);
        setStatus("connected");
      } else {
        setConfig(null);
        setStatus("picker");
      }
    } catch {
      setConfig(null);
      setStatus("needs-login");
    }
  };

  const handleSwitchProject = () => {
    setStatus("picker");
    setConfig(null);
  };

  const handleAddNew = () => {
    setStatus("needs-login");
  };

  const handleManualToken = () => {
    setStatus("needs-token");
  };

  const handleLogout = async () => {
    try {
      await desktopLogout();
    } catch {
      // best-effort — fortsetter til login uansett
    }
    setConfig(null);
    setStatus("needs-login");
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

  if (status === "needs-login") {
    return <LoginScreen onLoggedIn={refresh} onManualToken={handleManualToken} />;
  }

  if (status === "needs-token") {
    return <TokenSetupScreen onSaved={refresh} onBack={() => setStatus("needs-login")} />;
  }

  if (status === "picker") {
    return <ProjectPickerScreen onProjectSelected={refresh} onAddNew={handleAddNew} />;
  }

  if (status === "no-projects") {
    return <NoProjectsScreen onRefresh={refresh} onLogout={handleLogout} />;
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
