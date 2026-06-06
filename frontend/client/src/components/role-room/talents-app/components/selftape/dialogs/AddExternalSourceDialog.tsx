/**
 * AddExternalSourceDialog — lim inn YouTube/Google Drive/Vimeo-lenke.
 *
 * Backend parser URL strikt og lagrer take med source_provider satt
 * til riktig provider. Viser tydelig disclaimer om at audit/watermark
 * + AI-feedback IKKE fungerer for eksterne kilder.
 */
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import YouTubeIcon from '@mui/icons-material/YouTube';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo';
import { useState } from 'react';

import { palette, radius } from '../../../theme';
import { addExternalTake } from '../../../../services/roleRoomSelfTapesService';

interface Props {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
  onAdded: () => Promise<void> | void;
}

export default function AddExternalSourceDialog({
  open, projectId, onClose, onAdded,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!projectId || !url.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await addExternalTake(projectId, { url: url.trim() });
      setUrl('');
      onClose();
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å lagre lenken');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: palette.bgShell,
          color: palette.textPrimary,
          border: isMobile ? 'none' : `1px solid ${palette.border}`,
          borderRadius: isMobile ? 0 : radius.lg,
          ...(isMobile && {
            paddingTop: 'env(safe-area-inset-top, 0)',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
          }),
        },
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
          Lenke til ekstern video
        </Typography>
        <IconButton
          onClick={onClose}
          disabled={saving}
          sx={{ position: 'absolute', right: 12, top: 12, color: palette.textMuted }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem' }}>
            Hvis du allerede har self-tapen på YouTube (unlisted), Google Drive eller
            Vimeo — lim inn lenken her. Vi bygger en sikker embed-visning som
            byråene kan se uten å laste filen.
          </Typography>

          <Stack direction="row" spacing={1.4} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <ProviderChip Icon={YouTubeIcon} label="YouTube" color="#ff0000" />
            <ProviderChip Icon={CloudOutlinedIcon} label="Google Drive" color="#1a73e8" />
            <ProviderChip Icon={OndemandVideoIcon} label="Vimeo" color="#1ab7ea" />
          </Stack>

          <TextField
            label="Video-lenke"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            fullWidth
            autoFocus
            placeholder="https://www.youtube.com/watch?v=..."
            InputLabelProps={{ sx: { color: palette.textMuted } }}
            sx={{
              '& .MuiInputBase-input': { color: palette.textPrimary },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderSubtle },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: palette.accentBright },
            }}
          />

          <Alert
            severity="info"
            sx={{
              bgcolor: 'rgba(168,85,247,0.10)',
              color: palette.textSecondary,
              border: `1px solid ${palette.borderSubtle}`,
              '& .MuiAlert-icon': { color: palette.accentBright },
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', mb: 0.4 }}>
              Hva eksterne lenker IKKE gir deg
            </Typography>
            <Box component="ul" sx={{ pl: 2, m: 0, '& li': { mb: 0.4, fontSize: '0.82rem' } }}>
              <li>AI-feedback (Claude Opus 4.7 trenger video-tilgang)</li>
              <li>Watermark + signed URLs (vi kan ikke kontrollere YouTube/Drive)</li>
              <li>Detaljert view-audit (kun spilte-i-vår-app teller)</li>
              <li>YouTubes/Googles vilkår gjelder for filen din</li>
            </Box>
          </Alert>

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: palette.textMuted, textTransform: 'none' }}>
          Avbryt
        </Button>
        <Button
          onClick={handleAdd}
          disabled={saving || !url.trim()}
          sx={{
            background: palette.accentGradient,
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            px: 2.4,
            '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            '&.Mui-disabled': { background: 'rgba(168,85,247,0.32)', color: 'rgba(255,255,255,0.6)' },
          }}
        >
          {saving ? 'Lagrer …' : 'Bruk denne videoen'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ProviderChip({
  Icon, label, color,
}: {
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  label: string;
  color: string;
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        bgcolor: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        px: 1.2,
        py: 0.5,
        borderRadius: 999,
        fontWeight: 700,
        fontSize: '0.78rem',
      }}
    >
      <Icon sx={{ fontSize: 14 }} />
      {label}
    </Box>
  );
}
