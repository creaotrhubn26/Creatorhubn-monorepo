import { useEffect, useRef, useState } from "react";
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
import { pollOauthCompletion, startGoogleLoginV2 } from "../api";
import DeskIcon from "./DeskIcon";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

interface Props {
  /** Trigget når brukeren har fullført Google-login og prosjekter er hentet. */
  onLoggedIn: () => void;
  /** Fallback for power-users som vil legge inn helper-token manuelt. */
  onManualToken: () => void;
}

export default function LoginScreen({ onLoggedIn, onManualToken }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const pollStartedAtRef = useRef<number>(0);

  // Stopper aktiv polling — kalles ved unmount og når completion er
  // detektert (via event eller poll).
  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    let cleanup: UnlistenFn | null = null;
    let cleanupFail: UnlistenFn | null = null;
    void listen<string>("desktop-auth-completed", () => {
      stopPolling();
      setWaiting(false);
      onLoggedIn();
    }).then((un) => {
      cleanup = un;
    });
    void listen<string>("desktop-auth-failed", (e) => {
      stopPolling();
      setWaiting(false);
      setError(`Innlogging feilet: ${e.payload}`);
    }).then((un) => {
      cleanupFail = un;
    });
    return () => {
      cleanup?.();
      cleanupFail?.();
      stopPolling();
    };
  }, [onLoggedIn]);

  const handleLogin = async () => {
    setError(null);
    setWaiting(true);
    stopPolling();
    try {
      const { authorization_url, state } = await startGoogleLoginV2();
      const apiBase = "https://creatorhubn.com";

      // Åpne i system-nettleser. Bruker logger inn → backend redirecter
      // til creatorhub-one-desk:// → deep-link-handler tar over hvis app
      // ikke kjører fra før. Hvis app-en allerede kjører, virker ikke
      // deep-link på macOS (kjent quirk) — derfor poller vi parallelt.
      await openUrl(authorization_url);

      pollStartedAtRef.current = Date.now();
      pollTimerRef.current = window.setInterval(async () => {
        const elapsed = Date.now() - pollStartedAtRef.current;
        if (elapsed > POLL_TIMEOUT_MS) {
          stopPolling();
          setError(
            "Innlogging tidsavbrutt etter 5 minutter. Lukk Google-fanen og prøv på nytt.",
          );
          setWaiting(false);
          return;
        }
        try {
          const done = await pollOauthCompletion(apiBase, state);
          if (done) {
            // poll_oauth_completion-kommandoen emitter desktop-auth-completed-
            // event som useEffect over plukker opp og kaller onLoggedIn().
            stopPolling();
          }
        } catch (e) {
          stopPolling();
          setError(typeof e === "string" ? e : String(e));
          setWaiting(false);
        }
      }, POLL_INTERVAL_MS);
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
