import { useEffect, useMemo, useRef, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import Refresh from "@mui/icons-material/Refresh";
import CloudUpload from "@mui/icons-material/CloudUpload";
import Close from "@mui/icons-material/Close";
import {
  DetectedMount,
  DitDestination,
  listDetectedMounts,
  MemoryCardConfig,
  rescanMounts,
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
  // Auto-trigger: når en NY mount detekteres som matcher en planned-card-
  // konfig, vis en snackbar med "Start backup nå?". Dismissed paths
  // huskes for resten av app-sesjonen så Fredrik ikke får samme prompt
  // hver gang mount-listen oppdateres.
  const [autoPromptMount, setAutoPromptMount] = useState<DetectedMount | null>(null);
  const [autoPromptMatch, setAutoPromptMatch] = useState<MemoryCardConfig | null>(null);
  const dismissedPathsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void listDetectedMounts().then(setMounts).catch(() => setMounts([]));

    let cleanup: UnlistenFn | undefined;
    void listen<DetectedMount[]>("mounts-changed", (e) => {
      setMounts(e.payload);
    }).then((un) => {
      cleanup = un;
    });
    return () => {
      cleanup?.();
    };
  }, []);

  // Auto-trigger-detektor: trigger snackbar når en ny mount matcher
  // planned-card. Reagerer på mounts-state-endringer.
  useEffect(() => {
    if (plannedCards.length === 0) return;
    // Allerede åpen prompt eller backup-dialog → ikke trigge ny
    if (autoPromptMount !== null || backupMount !== null) return;
    for (const m of mounts) {
      if (dismissedPathsRef.current.has(m.mount_path)) continue;
      const match = matchConfig(m, plannedCards);
      if (match) {
        setAutoPromptMount(m);
        setAutoPromptMatch(match);
        return;
      }
    }
  }, [mounts, plannedCards, autoPromptMount, backupMount]);

  const handleAutoPromptDismiss = () => {
    if (autoPromptMount) {
      dismissedPathsRef.current.add(autoPromptMount.mount_path);
    }
    setAutoPromptMount(null);
    setAutoPromptMatch(null);
  };

  const handleAutoPromptStart = () => {
    if (autoPromptMount) {
      setBackupMount(autoPromptMount);
      dismissedPathsRef.current.add(autoPromptMount.mount_path);
    }
    setAutoPromptMount(null);
    setAutoPromptMatch(null);
  };

  // Når en mount fjernes (ejected/disappeared), tøm dismissed-set for
  // den banen så neste innsetning gir ny prompt. Bruker useMemo for å
  // diff på paths-listen.
  const mountPathsKey = useMemo(() => mounts.map((m) => m.mount_path).sort().join("|"), [mounts]);
  useEffect(() => {
    const currentPaths = new Set(mounts.map((m) => m.mount_path));
    for (const dismissed of Array.from(dismissedPathsRef.current)) {
      if (!currentPaths.has(dismissed)) {
        dismissedPathsRef.current.delete(dismissed);
      }
    }
  }, [mountPathsKey, mounts]);

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
          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={handleRescan}
            disabled={busy}
          >
            {busy ? "Skanner…" : "Skann på nytt"}
          </Button>
        </Stack>

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

      {/* Auto-trigger-snackbar: vises bunn-senter når et matchende kort
          detekteres. Auto-dismiss etter 30s hvis Fredrik er ute av rommet;
          klikke "Start backup" eller "Ikke nå" lukker den manuelt. */}
      <Snackbar
        open={autoPromptMount !== null}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        autoHideDuration={30_000}
        onClose={handleAutoPromptDismiss}
      >
        <Alert
          severity="info"
          sx={{ width: "100%", maxWidth: 500, alignItems: "center" }}
          icon={<CloudUpload fontSize="small" />}
          action={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Button
                size="small"
                color="inherit"
                onClick={handleAutoPromptDismiss}
                sx={{ textTransform: "none" }}
              >
                Ikke nå
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleAutoPromptStart}
                sx={{ textTransform: "none" }}
              >
                Start backup
              </Button>
              <IconButton size="small" color="inherit" onClick={handleAutoPromptDismiss}>
                <Close fontSize="small" />
              </IconButton>
            </Stack>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {autoPromptMount?.volume_label} matcher planlagt{" "}
            {autoPromptMatch?.capacity} {autoPromptMatch?.type ?? "kort"}
            {autoPromptMatch?.dayName ? ` (${autoPromptMatch.dayName})` : ""}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {autoPromptMount?.photo_count ?? 0} foto +{" "}
            {autoPromptMount?.video_count ?? 0} video oppdaget. Klar for backup?
          </Typography>
        </Alert>
      </Snackbar>
    </Card>
  );
}
