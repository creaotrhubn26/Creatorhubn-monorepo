import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Stop from "@mui/icons-material/Stop";
import CheckCircle from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  cancelCopySession,
  CopyDestDisabledEvent,
  CopyFileCompletedEvent,
  CopyFileProgressEvent,
  CopyFileStartedEvent,
  CopySessionCompletedEvent,
  CopySessionStartedEvent,
  listCopySessions,
  macosNotification,
  SessionStatus,
  setTrayStatus,
} from "../api";
import { bytesToHumanGb } from "../utils/capacity";

interface FileState {
  source_path: string;
  size: number;
  perDest: Record<
    string,
    { bytes_copied: number; bytes_total: number; status: "running" | "done" | "failed" | "skipped" }
  >;
  completedDests: number;
  totalDests: number;
}

interface MountDisappearedEvent {
  session_id: string;
  mount_path: string;
  files_skipped: number;
  succeeded: number;
  failed: number;
}

interface ThroughputSample {
  ts_ms: number;
  bytes_done: number;
}

const ETA_WINDOW_MS = 30_000;
const ETA_MAX_SAMPLES = 20;

function formatEta(secondsRemaining: number): string {
  if (!Number.isFinite(secondsRemaining) || secondsRemaining < 0) return "—";
  if (secondsRemaining < 60) return `~${Math.round(secondsRemaining)} sek igjen`;
  const mins = Math.round(secondsRemaining / 60);
  if (mins < 60) return `~${mins} min igjen`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (rem === 0) return `~${hours} t igjen`;
  return `~${hours} t ${rem} min igjen`;
}

interface DisabledDestInfo {
  dest_id: string;
  dest_label: string;
  reason_code: string;
  reason_message: string;
}

export default function CopyProgressView() {
  const [sessions, setSessions] = useState<SessionStatus[]>([]);
  const [currentFiles, setCurrentFiles] = useState<Record<string, FileState>>({});
  const [recentErrors, setRecentErrors] = useState<string[]>([]);
  const [mountDisappeared, setMountDisappeared] = useState<MountDisappearedEvent | null>(null);
  const [throughput, setThroughput] = useState<Record<string, ThroughputSample[]>>({});
  const [disabledDests, setDisabledDests] = useState<Record<string, DisabledDestInfo[]>>({});

  useEffect(() => {
    void listCopySessions().then(setSessions).catch(() => {});

    const unlisteners: UnlistenFn[] = [];

    listen<CopySessionStartedEvent>("copy-session-started", () => {
      void listCopySessions().then(setSessions);
    }).then((un) => unlisteners.push(un));

    listen<CopyFileStartedEvent>("copy-file-started", (e) => {
      setCurrentFiles((prev) => ({
        ...prev,
        [e.payload.source_path]: {
          source_path: e.payload.source_path,
          size: e.payload.size,
          perDest: {},
          completedDests: 0,
          totalDests: 0,
        },
      }));
    }).then((un) => unlisteners.push(un));

    listen<CopyFileProgressEvent>("copy-file-progress", (e) => {
      setCurrentFiles((prev) => {
        const existing = prev[e.payload.source_path];
        if (!existing) return prev;
        return {
          ...prev,
          [e.payload.source_path]: {
            ...existing,
            perDest: {
              ...existing.perDest,
              [e.payload.dest_id]: {
                bytes_copied: e.payload.bytes_copied,
                bytes_total: e.payload.bytes_total,
                status: "running",
              },
            },
          },
        };
      });
    }).then((un) => unlisteners.push(un));

    listen<CopyFileCompletedEvent>("copy-file-completed", (e) => {
      setCurrentFiles((prev) => {
        const existing = prev[e.payload.source_path];
        if (!existing) {
          // File completed but we never saw start — track anyway
          return prev;
        }
        const next = { ...existing };
        next.perDest = {
          ...existing.perDest,
          [e.payload.dest_id]: {
            bytes_copied: existing.size,
            bytes_total: existing.size,
            status: e.payload.skipped
              ? "skipped"
              : e.payload.success
              ? "done"
              : "failed",
          },
        };
        next.completedDests = Object.values(next.perDest).filter(
          (d) => d.status !== "running",
        ).length;
        return { ...prev, [e.payload.source_path]: next };
      });
      if (!e.payload.success && !e.payload.skipped && e.payload.error) {
        setRecentErrors((prev) =>
          [`${e.payload.source_path}: ${e.payload.error}`, ...prev].slice(0, 10),
        );
      }
      void listCopySessions().then((newSessions) => {
        setSessions(newSessions);
        // Sample bytes/sec for ETA. Vi bruker sessionens succeeded
        // som proxy for bytes-progress — det er litt grovt men presist
        // nok for et estimat-tall. Mer presist ville krevd at backend
        // emit'er bytes per fil i FileCompleted-eventet.
        const session = newSessions.find((s) => s.session_id === e.payload.session_id);
        if (session) {
          const bytesPerFile = session.file_count > 0
            ? session.total_bytes / session.file_count
            : 0;
          const bytesDone = bytesPerFile * (session.succeeded + session.failed);
          setThroughput((prev) => {
            const existing = prev[session.session_id] ?? [];
            const now = Date.now();
            const sample: ThroughputSample = { ts_ms: now, bytes_done: bytesDone };
            // Trim samples: behold de siste ETA_MAX_SAMPLES eller
            // de innenfor ETA_WINDOW_MS — det som blir kortest.
            const trimmed = [...existing, sample]
              .filter((s) => now - s.ts_ms <= ETA_WINDOW_MS)
              .slice(-ETA_MAX_SAMPLES);
            return { ...prev, [session.session_id]: trimmed };
          });
        }
      });
    }).then((un) => unlisteners.push(un));

    listen<CopySessionCompletedEvent>("copy-session-completed", (e) => {
      void listCopySessions().then(setSessions);
      // Frigjør throughput-samples for ferdig sesjon — ingen grunn til
      // å holde dem i minne, og hvis Fredrik starter ny session med
      // samme ID (resume-flow) blir det forvirrende.
      setThroughput((prev) => {
        const next = { ...prev };
        delete next[e.payload.session_id];
        return next;
      });

      // macOS Notification Center: vis ferdig-melding så Fredrik vet
      // når backup er klar uten å åpne hovedvinduet.
      const { succeeded, failed, cancelled } = e.payload;
      if (!cancelled && succeeded > 0) {
        const title = failed > 0
          ? "Backup ferdig med advarsler"
          : "Backup ferdig";
        const body = failed > 0
          ? `${succeeded} filer kopiert, ${failed} feilet`
          : `${succeeded} filer kopiert`;
        void macosNotification(title, body).catch(() => {
          // osascript ikke tilgjengelig (web preview/non-Mac) — ikke kritisk
        });
      }
    }).then((un) => unlisteners.push(un));

    listen<CopyDestDisabledEvent>("copy-dest-disabled", (e) => {
      setDisabledDests((prev) => {
        const existing = prev[e.payload.session_id] ?? [];
        // Idempotent — backend emit'er bare én gang per (session, dest)
        // men dobbelt-sikring her i tilfelle reconnect/replay.
        if (existing.some((d) => d.dest_id === e.payload.dest_id)) return prev;
        return {
          ...prev,
          [e.payload.session_id]: [
            ...existing,
            {
              dest_id: e.payload.dest_id,
              dest_label: e.payload.dest_label,
              reason_code: e.payload.reason_code,
              reason_message: e.payload.reason_message,
            },
          ],
        };
      });
      // Også vis i recentErrors så det er synlig fra log-strømmen
      setRecentErrors((prev) =>
        [
          `[${e.payload.dest_label}] DEAKTIVERT for resten av sesjonen: ${e.payload.reason_message}`,
          ...prev,
        ].slice(0, 10),
      );
    }).then((un) => unlisteners.push(un));

    listen<MountDisappearedEvent>("copy-session-mount-disappeared", (e) => {
      setMountDisappeared(e.payload);
      void listCopySessions().then(setSessions);
    }).then((un) => unlisteners.push(un));

    return () => {
      for (const un of unlisteners) un();
    };
  }, []);

  // Oppdater Mac-tray-tooltip når sessions endrer state. La oss
  // Fredrik se "2 aktive · 87/240" uten å åpne hovedvinduet.
  // Hopper over hvis Tauri-API ikke er tilgjengelig (web-preview/dev).
  useEffect(() => {
    const active = sessions.filter((s) => s.state === "running");
    let tooltip: string;
    if (active.length === 0) {
      tooltip = "Creatorhub One Desk";
    } else {
      const totalDone = active.reduce((sum, s) => sum + s.succeeded + s.failed, 0);
      const totalFiles = active.reduce((sum, s) => sum + s.file_count, 0);
      tooltip =
        active.length === 1
          ? `Backup: ${totalDone}/${totalFiles} filer`
          : `${active.length} aktive · ${totalDone}/${totalFiles} filer`;
    }
    void setTrayStatus(tooltip).catch(() => {
      // Tray-API ikke tilgjengelig (web preview eller mobile target)
      // — ikke kritisk, ignorér.
    });
  }, [sessions]);

  if (sessions.length === 0 && Object.keys(currentFiles).length === 0) {
    return null;
  }

  const activeSessions = sessions.filter((s) => s.state === "running");
  const completedSessions = sessions.filter((s) => s.state !== "running");
  const activeFiles = Object.values(currentFiles).filter(
    (f) => f.completedDests < Math.max(1, Object.keys(f.perDest).length),
  );

  /// Beregn ETA fra throughput-samples. Returnerer sekunder gjenstående
  /// (Infinity hvis vi ikke har nok data eller hastigheten er 0).
  const computeEta = (sessionId: string, totalBytes: number, doneBytes: number): number => {
    const samples = throughput[sessionId] ?? [];
    if (samples.length < 2) return Infinity;
    const oldest = samples[0];
    const newest = samples[samples.length - 1];
    const deltaMs = newest.ts_ms - oldest.ts_ms;
    const deltaBytes = newest.bytes_done - oldest.bytes_done;
    if (deltaMs <= 0 || deltaBytes <= 0) return Infinity;
    const bytesPerSec = (deltaBytes / deltaMs) * 1000;
    const remainingBytes = Math.max(0, totalBytes - doneBytes);
    return remainingBytes / bytesPerSec;
  };

  /// Forenkler en backend-feilmelding til en kort, klar UI-streng som
  /// forklarer HVA klienten kan gjøre. Backend-meldingen beholdes som
  /// tooltip (eller log) — denne er for at Fredrik skal forstå hva som
  /// foregår uten å lese Rust-stack-traces.
  const friendlyError = (raw: string): { title: string; suggestion: string | null } => {
    const lower = raw.toLowerCase();
    if (lower.includes("no space") || lower.includes("dest_no_space") || lower.includes("enospc") || lower.includes("ingen plass")) {
      return {
        title: "Destinasjonen er full",
        suggestion: "Frigjør plass eller bytt til en annen disk — denne dest deaktiveres for resten av sesjonen.",
      };
    }
    if (lower.includes("permission denied") || lower.includes("dest_perm_denied") || lower.includes("eacces")) {
      return {
        title: "Manglende skrivetillatelse",
        suggestion: "Sjekk at disken er skrivbar (ikke skrivebeskyttet) og at One Desk har tilgang i macOS Personvern-innstillinger.",
      };
    }
    if (lower.includes("hash mismatch")) {
      return {
        title: "Hash-mismatch ved verifisering",
        suggestion: "Bytene som ble skrevet matchet ikke kilden. Disk-feil eller transient I/O — prøv samme fil igjen.",
      };
    }
    if (lower.includes("source_read_failed") || lower.includes("les fra") || lower.includes("åpne kilde")) {
      return {
        title: "Kunne ikke lese fra kortet",
        suggestion: "Kan skyldes at kortet ble fjernet eller har korrupte sektorer. Sjekk at det fortsatt er montert.",
      };
    }
    if (lower.includes("mount") && (lower.includes("forsvant") || lower.includes("disappeared"))) {
      return {
        title: "Minnekortet ble fjernet",
        suggestion: "Sett inn kortet igjen og start backup på nytt — fullførte filer hoppes over automatisk.",
      };
    }
    return { title: "Kopi-feil", suggestion: null };
  };

  return (
    <Card variant="outlined" sx={{ borderColor: activeSessions.length > 0 ? "primary.main" : undefined }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Backup-økter ({sessions.length})
        </Typography>

        {activeSessions.length === 0 && completedSessions.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Ingen pågående backup.
          </Typography>
        )}

        {activeSessions.map((s) => {
          const totalFiles = s.file_count;
          const doneFiles = s.succeeded + s.failed;
          const pct = totalFiles > 0 ? Math.round((doneFiles / totalFiles) * 100) : 0;
          return (
            <Box key={s.session_id} sx={{ mb: 2 }}>
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.5 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {s.volume_label} → {doneFiles}/{totalFiles} filer
                </Typography>
                <Button
                  size="small"
                  color="error"
                  startIcon={<Stop />}
                  onClick={() => cancelCopySession(s.session_id)}
                >
                  Avbryt
                </Button>
              </Stack>
              <LinearProgress variant="determinate" value={pct} />
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between", mt: 0.25 }}
              >
                <Typography variant="caption" color="text.secondary">
                  {s.succeeded} ✓ · {s.failed} ✗ · {bytesToHumanGb(s.total_bytes)} totalt
                </Typography>
                {(() => {
                  // ETA-rendering: vis bare når vi har minst 2 samples
                  // OG sesjonen ikke er nesten ferdig (>95% — da blir
                  // estimatet støyete pga få gjenværende filer).
                  if (pct >= 95) return null;
                  const bytesPerFile = totalFiles > 0 ? s.total_bytes / totalFiles : 0;
                  const doneBytes = bytesPerFile * doneFiles;
                  const eta = computeEta(s.session_id, s.total_bytes, doneBytes);
                  if (!Number.isFinite(eta)) return null;
                  return (
                    <Typography variant="caption" color="text.secondary">
                      {formatEta(eta)}
                    </Typography>
                  );
                })()}
              </Stack>
              {/* Per-dest-recovery: vis hvilke destinasjoner som ble
                  deaktivert pga vedvarende feil. Andre destinasjoner
                  fortsetter — sesjonen er IKKE død bare fordi én disk
                  ble full. */}
              {(disabledDests[s.session_id] ?? []).map((d) => (
                <Chip
                  key={d.dest_id}
                  size="small"
                  color="warning"
                  variant="outlined"
                  label={`${d.dest_label} — ${d.reason_code === "DEST_NO_SPACE" ? "full" : "ingen tilgang"}`}
                  sx={{ mt: 0.5, mr: 0.5 }}
                />
              ))}
            </Box>
          );
        })}

        {activeFiles.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Aktive filer ({activeFiles.length}):
            </Typography>
            <List dense>
              {activeFiles.slice(0, 5).map((f) => {
                const dests = Object.entries(f.perDest);
                const filename = f.source_path.split("/").pop() || f.source_path;
                return (
                  <ListItem key={f.source_path} sx={{ flexDirection: "column", alignItems: "flex-start" }}>
                    <ListItemText
                      primary={
                        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                          {filename}
                        </Typography>
                      }
                    />
                    {dests.map(([destId, d]) => {
                      const pct = d.bytes_total > 0 ? (d.bytes_copied / d.bytes_total) * 100 : 0;
                      return (
                        <Box key={destId} sx={{ width: "100%", mb: 0.5 }}>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Typography variant="caption" sx={{ minWidth: 80 }}>
                              {destId}
                            </Typography>
                            <Box sx={{ flexGrow: 1 }}>
                              <LinearProgress variant="determinate" value={pct} />
                            </Box>
                            {d.status === "done" && <CheckCircle color="success" fontSize="small" />}
                            {d.status === "failed" && <ErrorIcon color="error" fontSize="small" />}
                            {d.status === "skipped" && <Chip size="small" label="hopp" />}
                          </Stack>
                        </Box>
                      );
                    })}
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}

        {completedSessions.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Ferdige økter:
            </Typography>
            <Stack spacing={0.5}>
              {completedSessions.map((s) => (
                <Stack key={s.session_id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  {s.state === "completed" ? (
                    <CheckCircle color="success" fontSize="small" />
                  ) : s.state === "cancelled" ? (
                    <Chip size="small" label="avbrutt" />
                  ) : s.state === "mount_disappeared" ? (
                    <WarningAmberIcon color="warning" fontSize="small" />
                  ) : (
                    <ErrorIcon color="error" fontSize="small" />
                  )}
                  <Typography variant="caption">
                    {s.volume_label}: {s.succeeded} ✓ / {s.failed} ✗ av {s.file_count}
                    {s.state === "mount_disappeared" && " — kort fjernet"}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}

        {recentErrors.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="error.main" sx={{ display: "block", mb: 0.5 }}>
              Siste feil:
            </Typography>
            {recentErrors.map((err, i) => {
              const { title, suggestion } = friendlyError(err);
              return (
                <Box key={i} sx={{ mb: 0.75 }}>
                  <Typography variant="caption" sx={{ display: "block", fontWeight: 600 }}>
                    {title}
                  </Typography>
                  {suggestion && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {suggestion}
                    </Typography>
                  )}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: "block",
                      fontFamily: "monospace",
                      fontSize: 10,
                      opacity: 0.6,
                      wordBreak: "break-all",
                    }}
                  >
                    {err}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>

      {/* Mount-disappeared modal — vises som blocking dialog så Fredrik
          ikke får inntrykk av at backup gikk gjennom. Klar action: sett
          inn kortet igjen + rerun, eller bekreft som "vil ikke fortsette". */}
      <Dialog
        open={!!mountDisappeared}
        onClose={() => setMountDisappeared(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <WarningAmberIcon color="warning" />
          Kortet ble fjernet før backup var ferdig
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>{mountDisappeared?.files_skipped ?? 0}</strong> filer rakk
            ikke å bli kopiert. <strong>{mountDisappeared?.succeeded ?? 0}</strong>{" "}
            ble fullført, <strong>{mountDisappeared?.failed ?? 0}</strong> feilet.
          </Alert>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Mount-sti: <code>{mountDisappeared?.mount_path}</code>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sett inn kortet på nytt og start backup igjen for den samme volumen —
            allerede kopierte filer hoppes over automatisk.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMountDisappeared(null)}>OK, jeg har sett det</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
