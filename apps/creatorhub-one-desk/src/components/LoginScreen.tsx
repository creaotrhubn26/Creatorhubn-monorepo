import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { startGoogleLogin } from "../api";
import DeskIcon from "./DeskIcon";

interface Props {
  /** Trigget når brukeren har fullført Google-login og prosjekter er hentet. */
  onLoggedIn: () => void;
  /** Fallback for power-users som vil legge inn helper-token manuelt. */
  onManualToken: () => void;
}

export default function LoginScreen({ onLoggedIn, onManualToken }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let cleanup: UnlistenFn | null = null;
    let cleanupFail: UnlistenFn | null = null;
    void listen<string>("desktop-auth-completed", () => {
      setWaiting(false);
      onLoggedIn();
    }).then((un) => {
      cleanup = un;
    });
    void listen<string>("desktop-auth-failed", (e) => {
      setWaiting(false);
      setError(`Innlogging feilet: ${e.payload}`);
    }).then((un) => {
      cleanupFail = un;
    });
    return () => {
      cleanup?.();
      cleanupFail?.();
    };
  }, [onLoggedIn]);

  const handleLogin = async () => {
    setError(null);
    setWaiting(true);
    try {
      const url = await startGoogleLogin();
      // Åpne i system-nettleser. Bruker logger inn → backend redirecter
      // til creatorhub-one-desk:// → vår deep-link-handler tar over.
      await openUrl(url);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
      setWaiting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={4} sx={{ alignItems: "stretch", textAlign: "center" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
          <DeskIcon size={96} />
        </Box>

        <Box>
          <Typography variant="overline" color="text.secondary">
            Creatorhub One Desk
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 700, mt: 1, mb: 2, lineHeight: 1.1 }}>
            Logg inn for å komme i gang
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Logg inn med Google-kontoen som er knyttet til Creatorhub.
            Alle prosjekter du har tilgang til dukker opp automatisk
            — ingen tokens å lime inn.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          startIcon={waiting ? <CircularProgress size={18} color="inherit" /> : <GoogleIcon />}
          onClick={handleLogin}
          disabled={waiting}
          sx={{ py: 1.5, fontSize: 16 }}
        >
          {waiting ? "Venter på Google…" : "Logg inn med Google"}
        </Button>

        {waiting && (
          <Typography variant="body2" color="text.secondary">
            En nettleser-fane er åpnet. Logg inn der — appen oppdaterer
            seg automatisk når du er ferdig.
          </Typography>
        )}

        <Divider />

        <Box>
          <Typography variant="caption" color="text.secondary">
            Har du et helper-token fra Admin Room?{" "}
            <Link component="button" variant="caption" onClick={onManualToken}>
              Lim inn token manuelt
            </Link>
          </Typography>
        </Box>
      </Stack>
    </Container>
  );
}
