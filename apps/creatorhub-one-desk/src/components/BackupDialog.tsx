import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import { DestinationSpec, DetectedMount, startCopySession } from "../api";

interface Props {
  open: boolean;
  mount: DetectedMount | null;
  onClose: () => void;
  onStarted: (sessionId: string) => void;
}

interface PendingDest {
  id: string;
  label: string;
  path: string;
}

let destCounter = 0;

export default function BackupDialog({ open: isOpen, mount, onClose, onStarted }: Props) {
  const [destinations, setDestinations] = useState<PendingDest[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setDestinations([]);
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
    setDestinations((prev) => [
      ...prev,
      { id: `local_${destCounter}`, label, path },
    ]);
  };

  const handleRemove = (id: string) => {
    setDestinations((prev) => prev.filter((d) => d.id !== id));
  };

  const handleStart = async () => {
    if (!mount || destinations.length === 0) return;
    setStarting(true);
    setError(null);
    try {
      const specs: DestinationSpec[] = destinations.map((d) => ({
        id: d.id,
        label: d.label,
        path: d.path,
      }));
      const sessionId = await startCopySession({
        mountPath: mount.mount_path,
        volumeLabel: mount.volume_label,
        destinations: specs,
      });
      onStarted(sessionId);
      reset();
      onClose();
    } catch (e) {
      setError(typeof e === "string" ? e : String(e));
      setStarting(false);
    }
  };

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
              Velg én eller flere mapper å kopiere til. Hver fil hashes med
              xxHash64 og verifiseres etter skriving. Kildens innhold endres
              aldri.
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
          </Box>

          {destinations.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              Ingen destinasjoner valgt ennå.
            </Typography>
          ) : (
            <List dense>
              {destinations.map((d) => (
                <ListItem
                  key={d.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => handleRemove(d.id)}
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
          disabled={starting || destinations.length === 0 || !mount}
        >
          {starting ? "Starter…" : "Start backup"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
