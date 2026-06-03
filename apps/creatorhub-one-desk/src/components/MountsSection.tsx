import { useEffect, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import Refresh from "@mui/icons-material/Refresh";
import CloudUpload from "@mui/icons-material/CloudUpload";
import AutoModeIcon from "@mui/icons-material/AutoMode";
import {
  autoStartBackupEnabled,
  DetectedMount,
  DitDestination,
  listCopySessions,
  listDetectedMounts,
  MemoryCardConfig,
  rescanMounts,
  setAutoStartBackup,
  startCopySession,
} from "../api";
import BackupDialog from "./BackupDialog";
import {
  bytesToHumanGb,
  nearestStandardGb,
  parseCapacityLabelGb,
} from "../utils/capacity";

interface Props {
  plannedCards: MemoryCardConfig[];
  plannedDestinations: DitDestination[];
}

function matchConfig(
  mount: DetectedMount,
  plannedCards: MemoryCardConfig[],
): MemoryCardConfig | null {
  const mountGb = nearestStandardGb(mount.total_bytes_capacity ?? 0);
  if (!mountGb) return null;
  for (const c of plannedCards) {
    const plannedGb = parseCapacityLabelGb(c.capacity);
    if (plannedGb && Math.round(plannedGb) === mountGb) {
      return c;
    }
  }
  return null;
}

export default function MountsSection({ plannedCards, plannedDestinations }: Props) {
  const [mounts, setMounts] = useState<DetectedMount[]>([]);
  const [busy, setBusy] = useState(false);
  const [backupMount, setBackupMount] = useState<DetectedMount | null>(null);
  const [autoStart, setAutoStart] = useState(false);
  const [autoFeedback, setAutoFeedback] = useState<string | null>(null);

  // Sett av mount-paths vi allerede har auto-triggret backup for i denne
  // app-livssyklusen, så vi ikke fyrer av igjen ved hvert mount-event.
  const autoTriggeredRef = useRef<Set<string>>(new Set());
  // Holder live referanse til auto-start-flagget for bruk i event-callback.
  const autoStartRef = useRef(false);
  const destinationsRef = useRef<DitDestination[]>([]);
  const cardsRef = useRef<MemoryCardConfig[]>([]);

  useEffect(() => {
    autoStartRef.current = autoStart;
  }, [autoStart]);
  useEffect(() => {
    destinationsRef.current = plannedDestinations;
  }, [plannedDestinations]);
  useEffect(() => {
    cardsRef.current = plannedCards;
  }, [plannedCards]);

  useEffect(() => {
    void autoStartBackupEnabled()
      .then(setAutoStart)
      .catch(() => {});
  }, []);

  const tryAutoStart = async (mount: DetectedMount) => {
    if (!autoStartRef.current) return;
    if (autoTriggeredRef.current.has(mount.mount_path)) return;
    const match = matchConfig(mount, cardsRef.current);
    if (!match) return;
    const dests = destinationsRef.current.filter(
      (d) => d.destination_type !== "original" && (d.path?.length ?? 0) > 0,
    );
    if (dests.length === 0) return;
    // Ikke trigg hvis det allerede finnes en aktiv session for samme mount
    try {
      const sessions = await listCopySessions();
      if (sessions.some((s) => s.mount_path === mount.mount_path && s.state === "running")) {
        return;
      }
    } catch {
      return;
    }
    autoTriggeredRef.current.add(mount.mount_path);
    try {
      await startCopySession({
        mountPath: mount.mount_path,
        volumeLabel: mount.volume_label,
        destinations: dests.map((d) => ({
          id: d.id,
          label: d.label,
          path: d.path ?? "",
          backend_id: d.id,
        })),
      });
      setAutoFeedback(
        `Auto-start: ${mount.volume_label} → ${dests.length} destinasjon${
          dests.length === 1 ? "" : "er"
        }`,
      );
      window.setTimeout(() => setAutoFeedback(null), 4000);
    } catch (e) {
      // Hvis start feilet, slipp opp så bruker kan re-trigge manuelt
      autoTriggeredRef.current.delete(mount.mount_path);
      console.warn("[auto-start] failed:", e);
    }
  };

  useEffect(() => {
    void listDetectedMounts().then((ms) => {
      setMounts(ms);
      for (const m of ms) void tryAutoStart(m);
    }).catch(() => setMounts([]));

    let cleanup: UnlistenFn | undefined;
    void listen<DetectedMount[]>("mounts-changed", (e) => {
      setMounts(e.payload);
      // Rydd ut auto-triggret-set for mounts som er borte (kort
      // tatt ut + satt inn igjen skal kunne trigge på nytt).
      const present = new Set(e.payload.map((m) => m.mount_path));
      for (const p of Array.from(autoTriggeredRef.current)) {
        if (!present.has(p)) autoTriggeredRef.current.delete(p);
      }
      for (const m of e.payload) void tryAutoStart(m);
    }).then((un) => {
      cleanup = un;
    });
    return () => {
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAutoStartChange = async (checked: boolean) => {
    setAutoStart(checked);
    try {
      await setAutoStartBackup(checked);
    } catch (e) {
      // Rull tilbake hvis lagring feilet
      setAutoStart(!checked);
      console.warn("[auto-start toggle] failed:", e);
    }
  };

  const handleRescan = async () => {
    setBusy(true);
    try {
      setMounts(await rescanMounts());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Detekterte minnekort ({mounts.length})
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoStart}
                  onChange={(_, v) => void handleAutoStartChange(v)}
                />
              }
              label={
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                  <AutoModeIcon fontSize="small" />
                  <Typography variant="caption">Auto-start</Typography>
                </Stack>
              }
              sx={{ mr: 0 }}
            />
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={handleRescan}
              disabled={busy}
            >
              {busy ? "Skanner…" : "Skann på nytt"}
            </Button>
          </Stack>
        </Stack>

        {autoFeedback && (
          <Alert severity="success" sx={{ mb: 1 }} onClose={() => setAutoFeedback(null)}>
            {autoFeedback}
          </Alert>
        )}

        {mounts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Ingen kamera-kort montert akkurat nå. Sett inn et SD/CF-kort så
            dukker det opp her automatisk.
          </Typography>
        ) : (
          <List dense>
            {mounts.map((m) => {
              const match = matchConfig(m, plannedCards);
              return (
                <ListItem
                  key={m.mount_path}
                  divider
                  sx={{ alignItems: "flex-start", flexDirection: "column" }}
                  secondaryAction={
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<CloudUpload />}
                      onClick={() => setBackupMount(m)}
                    >
                      Start backup
                    </Button>
                  }
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.5 }}>
                    <Chip
                      size="small"
                      color="primary"
                      label={bytesToHumanGb(m.total_bytes_capacity)}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {m.volume_label}
                    </Typography>
                    {match && (
                      <Chip
                        size="small"
                        color="success"
                        label={`Match: ${match.label || "?"} (${match.dayName || "ukjent dag"})`}
                      />
                    )}
                    {!match && plannedCards.length > 0 && (
                      <Chip size="small" variant="outlined" label="Ingen plan-match" />
                    )}
                  </Stack>
                  <ListItemText
                    primary={
                      <Typography variant="caption" color="text.secondary">
                        {m.mount_path}
                      </Typography>
                    }
                    secondary={
                      <Box component="span" sx={{ display: "block" }}>
                        <Typography variant="caption" component="span" color="text.secondary">
                          {m.photo_count} foto ({bytesToHumanGb(m.photo_bytes)})
                          {" · "}
                          {m.video_count} video ({bytesToHumanGb(m.video_bytes)})
                          {m.camera_guess ? ` · ${m.camera_guess}` : ""}
                          {m.layout_signals.length > 0 ? ` · ${m.layout_signals.join(", ")}` : ""}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
      <BackupDialog
        open={backupMount !== null}
        mount={backupMount}
        plannedDestinations={plannedDestinations}
        onClose={() => setBackupMount(null)}
        onStarted={() => {
          /* CopyProgressView lytter via event-API */
        }}
      />
    </Card>
  );
}
