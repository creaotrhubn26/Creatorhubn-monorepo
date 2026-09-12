import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Alert,
  TextField,
  Chip,
} from '@mui/material';
import { Campaign as CampaignIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import roleRoomAgentService from '../../services/roleRoomAgentService';

/**
 * Producer-facing "Send oppdatering til klient" action. Sends a data-driven
 * marketing update (published + scheduled + best-time insight + optional note)
 * to the client via email + their portal. Self-contained so it can drop into
 * the marketing-plan panel without threading state.
 */
export default function ClientUpdateComposer({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ severity: 'success' | 'warning' | 'error'; msg: string } | null>(
    null,
  );

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await roleRoomAgentService.sendClientUpdate(planId, note.trim() || undefined);
      setOpen(false);
      setNote('');
      if (res.total === 0) {
        setToast({
          severity: 'warning',
          msg: 'Oppdateringen ble lagret, men klienten har ingen aktiv portal-tilgang ennå. Inviter klienten til portalen for å nå dem på e-post.',
        });
      } else {
        setToast({
          severity: 'success',
          msg: `Oppdatering sendt til ${res.sent} av ${res.total} klient${res.total === 1 ? '' : 'er'} — også synlig i klientportalen.`,
        });
      }
    } catch (err) {
      setToast({
        severity: 'error',
        msg: `Kunne ikke sende oppdatering: ${err instanceof Error ? err.message : 'ukjent feil'}`,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<CampaignIcon />}
        onClick={() => setOpen(true)}
      >
        Send oppdatering til klient
      </Button>

      <Dialog open={open} onClose={() => !sending && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send oppdatering til klient</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Vi setter automatisk sammen en oppsummering av det som er publisert og planlagt,
            og legger ved den datadrevne innsikten om beste tid å poste. Klienten får den på
            e-post og i sin egen portal.
          </DialogContentText>
          <Box sx={{ mb: 2 }}>
            <Chip
              icon={<AutoAwesomeIcon />}
              label="Publisert + planlagt + beste tid å poste legges til automatisk"
              size="small"
              color="secondary"
              variant="outlined"
            />
          </Box>
          <TextField
            label="Personlig melding til klienten (valgfritt)"
            placeholder="F.eks. «Vi tester en ny stil denne uken — gi oss gjerne en tilbakemelding.»"
            multiline
            minRows={3}
            fullWidth
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={sending}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={sending}>
            Avbryt
          </Button>
          <Button onClick={handleSend} variant="contained" disabled={sending} startIcon={<CampaignIcon />}>
            {sending ? 'Sender…' : 'Send oppdatering'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} variant="filled">
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
