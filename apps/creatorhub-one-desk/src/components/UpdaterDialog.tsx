import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";

type UpdaterStage = "available" | "downloading" | "installed" | "error";

interface Props {
  version: string;
  notes: string | null;
  /** Starter download. Callback får progress (0..1) og status. */
  onDownload: (
    onProgress: (fraction: number, status: "downloading" | "finished") => void,
  ) => Promise<void>;
  onDismiss: () => void;
}

export default function UpdaterDialog({ version, notes, onDownload, onDismiss }: Props) {
  const [stage, setStage] = useState<UpdaterStage>("available");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const downloadRef = useRef<Promise<void> | null>(null);

  const handleDownload = useCallback(() => {
    if (downloadRef.current) return;
    setStage("downloading");
    setProgress(0);
    setError(null);
    downloadRef.current = onDownload((fraction, status) => {
      setProgress(fraction);
      if (status === "finished") {
        setStage("installed");
      }
    }).catch((err) => {
      setStage("error");
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [onDownload]);

  // Auto-lukk 8s etter "installed" — den nye versjonen er på disk, restart
  // kan skje når brukeren er klar.
  useEffect(() => {
    if (stage !== "installed") return;
    const timer = window.setTimeout(() => onDismiss(), 8000);
    return () => window.clearTimeout(timer);
  }, [stage, onDismiss]);

  const closeable = stage !== "downloading";

  return (
    <Dialog
      open
      onClose={closeable ? onDismiss : undefined}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <AutoAwesome color="primary" />
          <Typography variant="h6" component="span">
            Oppdatering tilgjengelig
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {stage === "available" && (
          <Stack spacing={2}>
            <Typography variant="body2">
              Creatorhub One Desk <strong>v{version}</strong> er klar.
            </Typography>
            {notes && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  fontSize: 13,
                  maxHeight: 200,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                }}
              >
                {notes}
              </Box>
            )}
          </Stack>
        )}

        {stage === "downloading" && (
          <Stack spacing={1.5}>
            <Typography variant="body2">Laster ned v{version}…</Typography>
            <LinearProgress variant="determinate" value={Math.round(progress * 100)} />
            <Typography variant="caption" color="text.secondary">
              {Math.round(progress * 100)}%
            </Typography>
          </Stack>
        )}

        {stage === "installed" && (
          <Alert severity="success">
            v{version} er installert. Lukk Creatorhub One Desk (⌘Q) og åpne på nytt
            for å aktivere den nye versjonen.
          </Alert>
        )}

        {stage === "error" && (
          <Alert severity="error">{error || "Kunne ikke laste ned oppdateringen."}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        {stage === "available" && (
          <>
            <Button onClick={onDismiss}>Senere</Button>
            <Button variant="contained" onClick={handleDownload}>
              Last ned og installer
            </Button>
          </>
        )}
        {stage === "installed" && (
          <Button variant="contained" onClick={onDismiss}>
            Forstått
          </Button>
        )}
        {stage === "error" && (
          <Button variant="contained" onClick={onDismiss}>
            Lukk
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
