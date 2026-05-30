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
import {
  DestinationSpec,
  DetectedMount,
  DitDestination,
  startCopySession,
} from "../api";

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

  // Pre-velg alle planlagte destinasjoner med en path satt (in-place "original"
  // destinasjoner uten path er ikke relevante for Desk)
  useEffect(() => {
    if (isOpen) {
      const initial = new Set(
        plannedDestinations.filter((d) => d.path && d.destination_type !== "original").map((d) => d.id),
      );
      setCheckedPlanned(initial);
    }
  }, [isOpen, plannedDestinations]);

  const reset = () => {
    setLocalDests([]);
    setCheckedPlanned(new Set());
    setStarting(false);
    setError(null);
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

  const handleStart = async () => {
    if (!mount || finalSpecs.length === 0) return;
    setStarting(true);
    setError(null);
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

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={starting}>
          Avbryt
        </Button>
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={starting || finalSpecs.length === 0 || !mount}
        >
          {starting
            ? "Starter…"
            : `Start backup (${finalSpecs.length} destinasjoner)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
