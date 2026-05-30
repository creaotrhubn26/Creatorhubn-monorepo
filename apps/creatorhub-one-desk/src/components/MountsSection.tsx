import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Refresh from "@mui/icons-material/Refresh";
import CloudUpload from "@mui/icons-material/CloudUpload";
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
    </Card>
  );
}
