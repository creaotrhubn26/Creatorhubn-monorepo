import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import EjectIcon from "@mui/icons-material/Eject";
import {
  DestinationSpec,
  DetectedMount,
  DitDestination,
  getAutoEjectPref,
  setAutoEjectPref,
  startCopySession,
} from "../api";

// Pre-confirm-grenser: trigger en ekstra "Er du sikker?"-dialog
// hvis total transfer over disse er stort nok til å være ulykkelig
// hvis Fredrik feilet på destinasjonsvalget. Tall valgt for å la
// vanlige shoots (1-2 dest, 50-100GB SD-kort) gå rett gjennom.
const CONFIRM_TOTAL_BYTES_THRESHOLD = 100 * 1024 * 1024 * 1024; // 100 GB
const CONFIRM_DEST_COUNT_THRESHOLD = 3;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${(bytes / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`;
}

/// Heuristisk tidsestimat for kopi. Antar 200 MB/s SSD-write som
/// konservativ baseline. Ved nett-disker eller HDD blir det tregere,
/// men UI-en understreker "estimat" så Fredrik vet det er en pekepinn.
function estimateMinutes(totalBytes: number): number {
  const bytesPerSec = 200 * 1024 * 1024;
  return Math.ceil(totalBytes / bytesPerSec / 60);
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return "under et minutt";
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `~${hours} t`;
  return `~${hours} t ${mins} min`;
}

interface Props {
  open: boolean;
  mount: DetectedMount | null;
  plannedDestinations: DitDestination[];
  onClose: () => void;
  onStarted: (sessionId: string) => void;
}

interface PendingLocalDest {
  id: string;
  label: string;
  path: string;
}

let destCounter = 0;

export default function BackupDialog({
  open: isOpen,
  mount,
  plannedDestinations,
  onClose,
  onStarted,
}: Props) {
  const [checkedPlanned, setCheckedPlanned] = useState<Set<string>>(new Set());
  const [localDests, setLocalDests] = useState<PendingLocalDest[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoEject, setAutoEject] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Pre-velg alle planlagte destinasjoner med en path satt (in-place "original"
  // destinasjoner uten path er ikke relevante for Desk)
  useEffect(() => {
    if (isOpen) {
      const initial = new Set(
        plannedDestinations.filter((d) => d.path && d.destination_type !== "original").map((d) => d.id),
      );
      setCheckedPlanned(initial);
      // Hent preferanse fra disk når dialogen åpner. Best-effort —
      // hvis prefs-fil mangler defaulter vi til false (opt-in).
      void getAutoEjectPref()
        .then(setAutoEject)
        .catch(() => setAutoEject(false));
    }
  }, [isOpen, plannedDestinations]);

  const reset = () => {
    setLocalDests([]);
    setCheckedPlanned(new Set());
    setStarting(false);
    setError(null);
    setConfirmOpen(false);
  };

  const handleClose = () => {
    if (starting) return;
    reset();
    onClose();
  };

  const handleAddFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Velg backup-destinasjon",
    });
    if (!selected || Array.isArray(selected)) return;
    const path = String(selected);
    destCounter += 1;
    const segments = path.split("/").filter(Boolean);
    const label = segments[segments.length - 1] || path;
    setLocalDests((prev) => [
      ...prev,
      { id: `local_${destCounter}`, label, path },
    ]);
  };

  const togglePlanned = (id: string, checked: boolean) => {
    setCheckedPlanned((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const removeLocal = (id: string) => {
    setLocalDests((prev) => prev.filter((d) => d.id !== id));
  };

  const finalSpecs: DestinationSpec[] = useMemo(() => {
    const planned: DestinationSpec[] = plannedDestinations
      .filter((d) => checkedPlanned.has(d.id) && d.path)
      .map((d) => ({
        id: `backend_${d.id}`,
        label: d.label,
        path: d.path!,
        backend_id: d.id,
      }));
    const local: DestinationSpec[] = localDests.map((d) => ({
      id: d.id,
      label: d.label,
      path: d.path,
      backend_id: null,
    }));
    return [...planned, ...local];
  }, [plannedDestinations, checkedPlanned, localDests]);

  // Beregner total transfer-størrelse (kilde × destinasjoner) for å
  // gi Fredrik et estimat før han trykker start. Brukes også til å
  // avgjøre om vi viser pre-confirm.
  const sourceBytes = mount ? (mount.photo_bytes + mount.video_bytes) : 0;
  const totalTransferBytes = sourceBytes * finalSpecs.length;
  const needsConfirm =
    totalTransferBytes >= CONFIRM_TOTAL_BYTES_THRESHOLD ||
    finalSpecs.length >= CONFIRM_DEST_COUNT_THRESHOLD;

  const handleStartClick = () => {
    if (!mount || finalSpecs.length === 0) return;
    if (needsConfirm) {
      setConfirmOpen(true);
      return;
    }
    void runStart();
  };

  const runStart = async () => {
    if (!mount || finalSpecs.length === 0) return;
    setConfirmOpen(false);
    setStarting(true);
    setError(null);
    // Persister auto-eject-preferansen FØR vi starter — så hvis Fredrik
    // huket den av og lukker dialogen med X mens backup kjører, neste
    // gang han åpner den er valget husket.
    try {
      await setAutoEjectPref(autoEject);
    } catch (e) {
      console.warn("auto-eject pref save failed:", e);
    }
    try {
      const sessionId = await startCopySession({
        mountPath: mount.mount_path,
        volumeLabel: mount.volume_label,
        destinations: finalSpecs,
      });
      onStarted(sessionId);
      reset();
      onClose();
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
      setStarting(false);
    }
  };

  const plannedWithPath = plannedDestinations.filter(
    (d) => d.path && d.destination_type !== "original",
  );

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Start backup
        {mount && (
          <Typography variant="caption" sx={{ display: "block", color: "text.secondary" }}>
            {mount.volume_label} · {mount.photo_count} foto · {mount.video_count} video
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Hver fil hashes med xxHash64 og verifiseres etter skriving.
              Kildens innhold endres aldri. Destinasjoner med 🔗 rapporteres
              også til CreatorHub-backend så status synes i klient-galleriet.
            </Typography>
          </Box>

          {plannedWithPath.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Planlagte destinasjoner (fra Admin Room)
              </Typography>
              <Stack spacing={0.5}>
                {plannedWithPath.map((d) => (
                  <FormControlLabel
                    key={d.id}
                    control={
                      <Checkbox
                        size="small"
                        checked={checkedPlanned.has(d.id)}
                        onChange={(e) => togglePlanned(d.id, e.target.checked)}
                        disabled={starting}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Chip size="small" label={`🔗 ${d.destination_type}`} color="primary" />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {d.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {d.path}
                        </Typography>
                      </Stack>
                    }
                  />
                ))}
              </Stack>
            </Box>
          )}

          <Divider />

          <Box>
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Ad-hoc-mapper (kun lokalt)
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Add />}
                onClick={handleAddFolder}
                disabled={starting}
              >
                Legg til mappe
              </Button>
            </Stack>

            {localDests.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                Ingen ad-hoc-mapper valgt.
              </Typography>
            ) : (
              <List dense>
                {localDests.map((d) => (
                  <ListItem
                    key={d.id}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => removeLocal(d.id)}
                        disabled={starting}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                          <Chip size="small" label={d.label} />
                        </Stack>
                      }
                      secondary={d.path}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Live transfer-summary — vises så fort minst én dest er valgt */}
          {finalSpecs.length > 0 && mount && sourceBytes > 0 && (
            <Box
              sx={{
                bgcolor: "rgba(245, 166, 35, 0.06)",
                border: "1px solid rgba(245, 166, 35, 0.20)",
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Total transfer
              </Typography>
              <Typography variant="body2">
                <strong>{formatBytes(sourceBytes)}</strong> × {finalSpecs.length} dest ={" "}
                <strong>{formatBytes(totalTransferBytes)}</strong>{" "}
                <Typography component="span" variant="caption" color="text.secondary">
                  · {formatDuration(estimateMinutes(totalTransferBytes))} ved 200 MB/s
                </Typography>
              </Typography>
            </Box>
          )}

          {/* Auto-eject-preferanse — opt-in. Vises selv uten dest så
              Fredrik kan huke av før han velger. */}
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={autoEject}
                onChange={(e) => setAutoEject(e.target.checked)}
                disabled={starting}
              />
            }
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <EjectIcon fontSize="small" />
                <Typography variant="body2">
                  Eject kortet automatisk når backup er ferdig
                </Typography>
              </Stack>
            }
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={starting}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleStartClick}
          disabled={starting || finalSpecs.length === 0 || !mount}
        >
          {starting
            ? "Starter…"
            : `Start backup (${finalSpecs.length} destinasjoner)`}
        </Button>
      </DialogActions>

      {/* Pre-confirm når total-transfer er stor nok til at en feilvalgt
          destinasjon ville kostet timer å oppdage. */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Bekreft stor backup-jobb</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Du er i ferd med å kopiere{" "}
            <strong>{formatBytes(sourceBytes)}</strong> til{" "}
            <strong>{finalSpecs.length} destinasjoner</strong> — totalt{" "}
            <strong>{formatBytes(totalTransferBytes)}</strong> som tar{" "}
            <strong>{formatDuration(estimateMinutes(totalTransferBytes))}</strong> ved
            ~200 MB/s skrivehastighet.
          </DialogContentText>
          <Box
            component="ul"
            sx={{ mt: 2, pl: 2, "& li": { fontSize: 13, lineHeight: 1.6 } }}
          >
            {finalSpecs.map((d) => (
              <li key={d.id}>
                <strong>{d.label}</strong> — <code>{d.path}</code>
              </li>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Tregere disker (HDD/nett) tar lenger tid. Sesjonen kan
            avbrytes når som helst.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Avbryt</Button>
          <Button variant="contained" color="primary" onClick={runStart}>
            Bekreft &amp; start
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
