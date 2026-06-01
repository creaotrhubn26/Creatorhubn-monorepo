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
  CopyFileCompletedEvent,
  CopyFileProgressEvent,
  CopyFileStartedEvent,
  CopySessionCompletedEvent,
  CopySessionStartedEvent,
  listCopySessions,
  SessionStatus,
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

export default function CopyProgressView() {
  const [sessions, setSessions] = useState<SessionStatus[]>([]);
  const [currentFiles, setCurrentFiles] = useState<Record<string, FileState>>({});
  const [recentErrors, setRecentErrors] = useState<string[]>([]);
  const [mountDisappeared, setMountDisappeared] = useState<MountDisappearedEvent | null>(null);

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
      void listCopySessions().then(setSessions);
    }).then((un) => unlisteners.push(un));

    listen<CopySessionCompletedEvent>("copy-session-completed", () => {
      void listCopySessions().then(setSessions);
    }).then((un) => unlisteners.push(un));

    listen<MountDisappearedEvent>("copy-session-mount-disappeared", (e) => {
      setMountDisappeared(e.payload);
      void listCopySessions().then(setSessions);
    }).then((un) => unlisteners.push(un));

    return () => {
      for (const un of unlisteners) un();
    };
  }, []);

  if (sessions.length === 0 && Object.keys(currentFiles).length === 0) {
    return null;
  }

  const activeSessions = sessions.filter((s) => s.state === "running");
  const completedSessions = sessions.filter((s) => s.state !== "running");
  const activeFiles = Object.values(currentFiles).filter(
    (f) => f.completedDests < Math.max(1, Object.keys(f.perDest).length),
  );

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
              <Typography variant="caption" color="text.secondary">
                {s.succeeded} ✓ · {s.failed} ✗ · {bytesToHumanGb(s.total_bytes)} totalt
              </Typography>
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
            {recentErrors.map((err, i) => (
              <Typography
                key={i}
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", fontFamily: "monospace", fontSize: 11 }}
              >
                {err}
              </Typography>
            ))}
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
