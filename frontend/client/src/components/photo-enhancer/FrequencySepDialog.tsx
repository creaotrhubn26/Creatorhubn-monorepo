import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { FrequencySepEditor } from './FrequencySepEditor';
import {
  decodeToRgba8Buffer,
  encodeRgba8BufferToFile,
} from '../../lib/frequency-sep/image-io';
import type { Rgba8Buffer } from '../../lib/frequency-sep/decomposition';

export interface FrequencySepDialogProps {
  open: boolean;
  /** Source to load into the editor on open. Re-decoded whenever it
   *  changes; null/undefined renders an idle state. */
  source: File | Blob | string | null | undefined;
  /** Original filename, used to build the retouched file's name. */
  originalFilename?: string;
  /** Fires when the user presses "Bruk endringer". Parent should swap
   *  this File into the enhance pipeline's input slot. */
  onApply: (retouchedFile: File) => void;
  onClose: () => void;
}

/**
 * Full-screen dialog that decodes the active enhancer image, hosts the
 * frequency-sep brush editor, and hands a retouched `File` back to the
 * parent on commit. The parent wires that file into the same upload
 * slot it already uses for fresh images, so the enhance pipeline sees
 * the retouch as the new "source of truth" with zero route changes.
 */
export function FrequencySepDialog(props: FrequencySepDialogProps) {
  const { open, source, originalFilename, onApply, onClose } = props;
  const [buffer, setBuffer] = useState<Rgba8Buffer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBuffer(null);
    decodeToRgba8Buffer(source)
      .then((decoded) => {
        if (!cancelled) setBuffer(decoded);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, source]);

  const handleCommit = async (edited: Rgba8Buffer) => {
    try {
      const file = await encodeRgba8BufferToFile(
        edited,
        originalFilename ?? 'retouch',
      );
      onApply(file);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      aria-labelledby="frequency-sep-dialog-title"
    >
      <DialogTitle id="frequency-sep-dialog-title">
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Frekvens-separert retusj</Typography>
          <IconButton onClick={onClose} aria-label="Lukk">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
        {loading && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
            }}
          >
            <Stack alignItems="center" spacing={2}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">
                Dekoder bilde …
              </Typography>
            </Stack>
          </Box>
        )}
        {buffer && !loading && (
          <Box sx={{ flex: 1, display: 'flex', p: 2, gap: 2 }}>
            <FrequencySepEditor source={buffer} onCommit={handleCommit} />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
