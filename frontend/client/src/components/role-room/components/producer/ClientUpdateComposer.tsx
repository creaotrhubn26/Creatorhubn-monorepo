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
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

/**
 * Producer-facing "Send oppdatering til klient" action. Sends a data-driven
 * marketing update (published + scheduled + best-time insight + optional note)
 * to the client via email + their portal. Self-contained so it can drop into
 * the marketing-plan panel without threading state.
 */
export default function ClientUpdateComposer({ planId }: { planId: string }) {
  const { t } = useT();
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
          msg: t('clientUpdate.s002'),
        });
      } else {
        setToast({
          severity: 'success',
          msg: t('clientUpdate.p01', { v0: res.sent, v1: res.total, v2: res.total === 1 ? '' : t('clientUpdate.s009') }),
        });
      }
    } catch (err) {
      setToast({
        severity: 'error',
        msg: t('clientUpdate.p00', { v0: err instanceof Error ? err.message : t('clientUpdate.s010') }),
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
        {t('clientUpdate.s006')}
      </Button>

      <Dialog open={open} onClose={() => !sending && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('clientUpdate.s006')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('clientUpdate.s008')}
          </DialogContentText>
          <Box sx={{ mb: 2 }}>
            <Chip
              icon={<AutoAwesomeIcon />}
              label={t('clientUpdate.s004')}
              size="small"
              color="secondary"
              variant="outlined"
            />
          </Box>
          <TextField
            label={t('clientUpdate.s003')}
            placeholder={t('clientUpdate.s001')}
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
            {t('clientUpdate.s000')}
          </Button>
          <Button onClick={handleSend} variant="contained" disabled={sending} startIcon={<CampaignIcon />}>
            {sending ? t('clientUpdate.s007') : t('clientUpdate.s005')}
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
