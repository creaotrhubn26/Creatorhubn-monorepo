/**
 * End-of-session reflect modal.
 *
 * Shown only to photographers who opted into ergonomics telemetry.
 * Three short questions:
 *   1. "Hva tok lengst i denne økten?" (what took the most time?)
 *   2. "Hvor angret du deg på et valg?" (what did you second-guess?)
 *   3. "Hva ville spart deg 30 min?" (what would have saved 30 min?)
 *
 * All three are optional free-text; the modal dismisses without
 * posting if the photographer leaves everything blank. The posted
 * body is keyed by the current ergonomics sessionId so aggregation
 * can join reflect answers with the telemetry events from the same
 * session.
 *
 * The component itself is dumb — callers decide when to render it
 * (typically on "Done culling" button or after N minutes of inactivity
 * when session_end has fired). Keeps the modal from coupling to any
 * specific surface's state machine.
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

export interface ReflectPromptModalProps {
  open: boolean;
  /// Must match the sessionId the telemetry hook is emitting for the
  /// same review session — lets the backend pair answers with events.
  sessionId: string;
  onClose: () => void;
  /// Called after a successful submit (or dismissed-empty) so the
  /// parent can clear the "needs reflect" state and not re-show.
  onSubmitted?: () => void;
}

export function ReflectPromptModal({
  open,
  sessionId,
  onClose,
  onSubmitted,
}: ReflectPromptModalProps) {
  const [hardest, setHardest] = useState('');
  const [regretted, setRegretted] = useState('');
  const [wouldSave, setWouldSave] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    // All three empty → just close. We don't POST empty answers so
    // the backend's reflect table stays signal-rich.
    const anything = [hardest, regretted, wouldSave].some(
      (v) => v.trim().length > 0,
    );
    if (!anything) {
      onClose();
      onSubmitted?.();
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiRequest('/api/telemetry/reflect', {
        method: 'POST',
        body: {
          sessionId,
          hardest: hardest.trim() || undefined,
          regretted: regretted.trim() || undefined,
          wouldSave: wouldSave.trim() || undefined,
        },
      });
      onClose();
      onSubmitted?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Kunne ikke sende svar — prøv igjen',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Tre korte spørsmål (valgfritt)</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Hjelper oss å fjerne det du hater mest. Svarene blir brukt
            aggregert og anonymt. Du kan hoppe over alle felter.
          </Typography>
          <TextField
            label="Hva tok lengst i denne økten?"
            multiline
            minRows={2}
            value={hardest}
            onChange={(e) => setHardest(e.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
          <TextField
            label="Hvor angret du deg på et valg?"
            multiline
            minRows={2}
            value={regretted}
            onChange={(e) => setRegretted(e.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
          <TextField
            label="Hva ville spart deg 30 min?"
            multiline
            minRows={2}
            value={wouldSave}
            onChange={(e) => setWouldSave(e.target.value)}
            inputProps={{ maxLength: 2000 }}
          />
          {error && (
            <Typography variant="caption" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Hopp over
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting}
        >
          {submitting ? 'Sender…' : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReflectPromptModal;
