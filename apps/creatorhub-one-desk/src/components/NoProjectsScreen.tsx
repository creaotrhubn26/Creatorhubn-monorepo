import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import LogoutIcon from "@mui/icons-material/Logout";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { openUrl } from "@tauri-apps/plugin-opener";
import { deviceTokenStatus, refreshProjectsFromApi } from "../api";
import AuthSurface from "./AuthSurface";
import DeskIcon from "./DeskIcon";
import PluginsCatalog from "./PluginsCatalog";

interface Props {
  onRefresh: () => void;
  onLogout: () => void;
}

export default function NoProjectsScreen({ onRefresh, onLogout }: Props) {
  const [userEmail, setUserEmail] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void deviceTokenStatus()
      .then((s) => setUserEmail(s?.user_email || ""))
      .catch(() => {});
  }, []);

  const handleRefetch = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const count = await refreshProjectsFromApi();
      if (count > 0) {
        onRefresh();
      } else {
        // Ingen prosjekter funnet — fortell brukeren tydelig
        setError(
          "Ingen prosjekter funnet på kontoen. Opprett ditt første prosjekt i din workspace og prøv igjen.",
        );
      }
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AuthSurface>
      <Stack spacing={3} sx={{ alignItems: "stretch", textAlign: "center" }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <DeskIcon size={80} />
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">
            Innlogget{userEmail ? ` som ${userEmail}` : ""}
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, mt: 1, mb: 2, lineHeight: 1.2 }}
          >
            Ingen prosjekter ennå
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Når du oppretter et prosjekt i din workspace, dukker det opp her
            automatisk. Klikk «Hent på nytt» etter at du har laget prosjektet.
          </Typography>
        </Box>

        {error && (
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderRadius: 1,
              border: "1px solid",
              borderColor: "warning.light",
              bgcolor: "warning.50",
              color: "warning.dark",
            }}
          >
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}

        <Stack spacing={1.5}>
          <Button
            variant="contained"
            size="large"
            startIcon={
              refreshing ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <RefreshIcon />
              )
            }
            onClick={handleRefetch}
            disabled={refreshing}
          >
            {refreshing ? "Henter…" : "Hent prosjekter på nytt"}
          </Button>

          <Button
            variant="outlined"
            size="large"
            startIcon={<OpenInNewIcon />}
            onClick={() =>
              void openUrl("https://www.creatorhubn.com/workspace?new=1")
            }
          >
            Opprett prosjekt i din workspace
          </Button>

          <Button
            variant="text"
            size="small"
            startIcon={<LogoutIcon />}
            onClick={onLogout}
            sx={{ mt: 2 }}
          >
            Logg ut
          </Button>

          <PluginsCatalog compact />
        </Stack>

        <Box sx={{ pt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Tips: bruk{" "}
            <Link
              component="button"
              onClick={() =>
                void openUrl("https://www.creatorhubn.com/workspace?new=1")
              }
            >
              prosjektwizarden i din workspace
            </Link>{" "}
            for å sette opp prosjektets memory cards og destinasjoner.
          </Typography>
        </Box>
      </Stack>
    </AuthSurface>
  );
}
