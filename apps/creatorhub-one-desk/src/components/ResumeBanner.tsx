import { useEffect, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import RestoreIcon from "@mui/icons-material/Restore";
import {
  discardInterruptedSession,
  InterruptedSession,
  listInterruptedSessions,
  resumeInterruptedSession,
} from "../api";

function formatRelative(tsMs: number): string {
  const diff = Date.now() - tsMs;
  if (diff < 60_000) return "akkurat nå";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min siden`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} t siden`;
  return `${Math.round(diff / 86_400_000)} d siden`;
}

/// Vises ved app-startup hvis det finnes interrupted sessions. Lar Fredrik
/// resume eller forkaste. Henter listen i en useEffect — banneret skjules
/// hvis listen er tom (typisk hyppigste case).
export default function ResumeBanner() {
  const [sessions, setSessions] = useState<InterruptedSession[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const list = await listInterruptedSessions();
      setSessions(list);
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (sessions.length === 0 && !error) return null;

  const handleResume = async (id: string) => {
    setBusy((b) => ({ ...b, [id]: true }));
    setError(null);
    try {
      await resumeInterruptedSession(id);
      // Etter resume er sesjonen "running" igjen — fjern fra banneret;
      // run_session vil skrive SessionEnded når den er ferdig.
      setSessions((s) => s.filter((x) => x.session_id !== id));
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const handleDiscard = async (id: string) => {
    setBusy((b) => ({ ...b, [id]: true }));
    setError(null);
    try {
      await discardInterruptedSession(id);
      setSessions((s) => s.filter((x) => x.session_id !== id));
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: "warning.main",
        bgcolor: "rgba(245, 166, 35, 0.06)",
        mb: 2,
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <RestoreIcon color="warning" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              {sessions.length === 1
                ? "1 backup-økt ble avbrutt før den var ferdig"
                : `${sessions.length} backup-økter ble avbrutt før de var ferdige`}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Appen krasjet eller ble lukket midt i. Sett inn kortet/disken
              igjen og fortsett — kopierte filer hoppes over automatisk.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                <AlertTitle>Feil</AlertTitle>
                {error}
              </Alert>
            )}

            <Stack spacing={1.5}>
              {sessions.map((s) => {
                const completed = s.files_completed_per_dest.reduce(
                  (acc, [, n]) => Math.max(acc, n),
                  0,
                );
                const pct = s.total_files
                  ? Math.round((completed / s.total_files) * 100)
                  : 0;
                return (
                  <Box
                    key={s.session_id}
                    sx={{
                      p: 1.5,
                      bgcolor: "background.paper",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1.5}
                      sx={{ alignItems: { sm: "center" } }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {s.volume_label || "Ukjent volum"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.mount_path} · {completed} av {s.total_files} filer
                          fullført ({pct}%) · sist aktivitet{" "}
                          {formatRelative(s.last_event_ms)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => handleDiscard(s.session_id)}
                          disabled={busy[s.session_id]}
                        >
                          Forkast
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="warning"
                          startIcon={<RestoreIcon />}
                          onClick={() => handleResume(s.session_id)}
                          disabled={busy[s.session_id]}
                        >
                          Fortsett
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
