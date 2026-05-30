import { useEffect, useState } from "react";
import { Box, CircularProgress, Container, Typography } from "@mui/material";
import { loadStoredConfig, StoredConfig } from "./api";
import TokenSetupScreen from "./components/TokenSetupScreen";
import ProjectInfoScreen from "./components/ProjectInfoScreen";

type Status = "loading" | "needs-token" | "connected";

export default function App() {
  const [status, setStatus] = useState<Status>("loading");
  const [config, setConfig] = useState<StoredConfig | null>(null);

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
    </Box>
  );
}
