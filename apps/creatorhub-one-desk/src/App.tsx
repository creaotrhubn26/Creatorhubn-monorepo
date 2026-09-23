import { useEffect, useState } from "react";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { desktopLogout, deviceTokenStatus, listProjects, loadStoredConfig, StoredConfig } from "./api";
import TokenSetupScreen from "./components/TokenSetupScreen";
import ProjectInfoScreen from "./components/ProjectInfoScreen";
import ProjectPickerScreen from "./components/ProjectPickerScreen";
import LoginScreen from "./components/LoginScreen";
import NoProjectsScreen from "./components/NoProjectsScreen";
import DeskUpdater from "./components/DeskUpdater";

type Status =
  | "loading"
  | "needs-login"
  | "needs-token"
  | "no-projects"
  | "picker"
  | "connected";

export default function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [config, setConfig] = useState<StoredConfig | null>(null);

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

  let screen;

  if (status === "loading") {
    screen = (
      <Container maxWidth="md" sx={{ py: 10, textAlign: "center" }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }} color="text.secondary">
          Laster lagret config…
        </Typography>
      </Container>
    );
  } else if (status === "needs-login") {
    screen = <LoginScreen onLoggedIn={refresh} onManualToken={handleManualToken} />;
  } else if (status === "needs-token") {
    screen = <TokenSetupScreen onSaved={refresh} onBack={() => setStatus("needs-login")} />;
  } else if (status === "picker") {
    screen = <ProjectPickerScreen onProjectSelected={refresh} onAddNew={handleAddNew} />;
  } else if (status === "no-projects") {
    screen = <NoProjectsScreen onRefresh={refresh} onLogout={handleLogout} />;
  } else {
    screen = config ? (
      <ProjectInfoScreen
        config={config}
        onLoggedOut={refresh}
        onSwitchProject={handleSwitchProject}
      />
    ) : null;
  }

  return (
    <Box>
      {screen}
      <DeskUpdater />
    </Box>
  );
}
