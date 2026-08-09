import { type FC, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  WhatsApp as WhatsAppIcon,
} from '@mui/icons-material';
import {
  roleRoomWhatsAppApi,
  type RoleRoomWhatsAppConfig,
} from '../services/castingApiService';
import { useT } from '../../../i18n';

type ConnectWhatsAppDialogProps = {
  open: boolean;
  orgKey: string;
  onClose: () => void;
  onConnected: (config: RoleRoomWhatsAppConfig | null) => void;
};

const ConnectWhatsAppDialog: FC<ConnectWhatsAppDialogProps> = ({
  open,
  orgKey,
  onClose,
  onConnected,
}) => {
  const { t } = useT();
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPhoneNumberId('');
    setAccessToken('');
    setBusinessAccountId('');
    setDisplayName('');
    setShowToken(false);
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!orgKey) {
      setError(t('connectWA.errMissingOrgKey'));
      return;
    }
    if (!phoneNumberId.trim() || !accessToken.trim() || !displayName.trim() || !businessAccountId.trim()) {
      setError(t('connectWA.errFieldsRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const config = await roleRoomWhatsAppApi.upsertConfig({
        orgKey,
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        businessAccountId: businessAccountId.trim(),
        displayName: displayName.trim(),
      });
      onConnected(config);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectWA.errConnectFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#0f1729', color: '#f1f5f9', borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#f1f5f9', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <WhatsAppIcon sx={{ color: '#22c55e' }} />
        <Typography sx={{ flex: 1, fontWeight: 700 }}>{t('connectWA.title')}</Typography>
        <IconButton onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.6)' }} disabled={submitting}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2}>
          <Alert severity="info" sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: '#bbf7d0', '& .MuiAlert-icon': { color: '#22c55e' } }}>
            <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.55 }}>
              {t('connectWA.fetchValuesFrom')}<Link href="https://business.facebook.com/wa/manage/phonenumbers" target="_blank" rel="noopener" sx={{ color: '#86efac' }}>Meta WhatsApp Manager</Link>{t('connectWA.fetchValuesAfter')}
            </Typography>
          </Alert>

          <TextField
            label="Phone Number ID"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="1083558068177309"
            disabled={submitting}
            fullWidth
            InputProps={{ sx: { color: '#f1f5f9' } }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
          />

          <TextField
            label="WhatsApp Business Account ID"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="1526002049163077"
            disabled={submitting}
            fullWidth
            InputProps={{ sx: { color: '#f1f5f9' } }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
          />

          <TextField
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="The Role Room"
            disabled={submitting}
            fullWidth
            helperText={t('connectWA.helperDisplayName')}
            FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.55)' } }}
            InputProps={{ sx: { color: '#f1f5f9' } }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
          />

          <TextField
            label="Access Token"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            type={showToken ? 'text' : 'password'}
            placeholder="EAA..."
            disabled={submitting}
            fullWidth
            helperText={t('connectWA.helperAccessToken')}
            FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.55)' } }}
            InputProps={{
              sx: { color: '#f1f5f9' },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowToken((v) => !v)} edge="end" size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {showToken ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.7)' } }}
          />

          {error ? (
            <Alert severity="error" sx={{ bgcolor: 'rgba(248,113,113,0.1)', color: '#fecaca' }}>
              {error}
            </Alert>
          ) : null}

          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.55 }}>
              {t('connectWA.verifyNoteBefore')}<strong>{t('connectWA.saveVerify')}</strong>{t('connectWA.verifyNoteAfter')}
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={handleClose} disabled={submitting} sx={{ color: 'rgba(255,255,255,0.7)' }}>
          {t('connectWA.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          variant="contained"
          startIcon={submitting ? <CircularProgress size={14} sx={{ color: '#0f1729' }} /> : <WhatsAppIcon />}
          sx={{ bgcolor: '#22c55e', color: '#0f1729', fontWeight: 700, '&:hover': { bgcolor: '#34d399' } }}
        >
          {submitting ? t('connectWA.verifying') : t('connectWA.saveVerify')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConnectWhatsAppDialog;
