/**
 * SettingsPage.tsx — Innstillinger
 *
 * Phase 3 MVP: språk, varsler-preferanser (placeholder), data-eksport,
 * slett konto. Mer kommer.
 */

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import ShieldIcon from '@mui/icons-material/Shield';
import { useState } from 'react';

import { palette, radius } from '../theme';

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

export default function SettingsPage() {
  const [language, setLanguage] = useState('nb-NO');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const r = await fetch('/api/role-room/talents/me/export', { credentials: 'include' });
      if (!r.ok) {
        const payload = await r.json().catch(() => null);
        throw new Error(payload?.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `theroleroom-talents-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setInfo('Data eksportert som JSON-fil.');
    } catch (err) {
      setError(`Eksport feilet: ${err instanceof Error ? err.message : 'ukjent feil'}`);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const r = await fetch('/api/role-room/talents/me', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'SLETT MIN PROFIL' }),
      });
      const payload = await r.json().catch(() => null);
      if (!r.ok) throw new Error(payload?.error || `HTTP ${r.status}`);
      setInfo(`Profilen er slettet. ${payload?.summary?.stream_videos_deleted ?? 0} videoer og ${payload?.summary?.r2_objects_deleted ?? 0} filer fjernet.`);
      setDeleteOpen(false);
      setTimeout(() => { window.location.href = '/'; }, 3000);
    } catch (err) {
      setError(`Sletting feilet: ${err instanceof Error ? err.message : 'ukjent feil'}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 720, mx: 'auto' }}>
      <Typography sx={{ fontSize: { xs: '1.5rem', sm: '1.8rem' }, fontWeight: 800, color: palette.textPrimary, lineHeight: 1.15, mb: 3 }}>
        Innstillinger
      </Typography>

      {info ? <Alert severity="info" onClose={() => setInfo(null)} sx={{ mb: 2 }}>{info}</Alert> : null}
      {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert> : null}

      <Stack spacing={2}>
        <Box sx={cardSx}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1.4 }}>Språk</Typography>
          <TextField
            select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            fullWidth size="small"
            helperText="Endring krever ny innlogging for å oppdatere hele UI."
          >
            <MenuItem value="nb-NO">Norsk (bokmål)</MenuItem>
            <MenuItem value="en-NO">English (Norway)</MenuItem>
          </TextField>
        </Box>

        <Box sx={cardSx}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1 }}>Mine data (GDPR)</Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mb: 1.4, lineHeight: 1.5 }}>
            Du har full rett til dine egne data. Last ned alt, eller slett kontoen og alt blir borte for godt.
          </Typography>
          <Stack direction="row" spacing={1.2}>
            <Button
              startIcon={exporting ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={() => void handleExport()}
              disabled={exporting}
              sx={{
                textTransform: 'none', fontWeight: 600, px: 2, py: 1,
                borderRadius: radius.sm, color: palette.textPrimary, border: `1px solid ${palette.borderStrong}`,
                '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
              }}
            >
              Last ned mine data (JSON)
            </Button>
            <Button
              startIcon={<DeleteOutlineIcon />}
              onClick={() => setDeleteOpen(true)}
              sx={{
                textTransform: 'none', fontWeight: 600, px: 2, py: 1,
                borderRadius: radius.sm, color: '#f87171', border: '1px solid #f87171',
                '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' },
              }}
            >
              Slett kontoen min
            </Button>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ pt: 1, color: palette.textMuted, fontSize: '0.82rem' }}>
          <ShieldIcon sx={{ fontSize: 18, color: palette.success }} />
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
            EU/EEA-lagring. <Box component="a" href="/privacy" sx={{ color: palette.accentBright }}>Personvern</Box> · <Box component="a" href="/terms" sx={{ color: palette.accentBright }}>Vilkår</Box>.
          </Typography>
        </Stack>
      </Stack>

      {/* Slett-konto-bekreftelse */}
      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: palette.bgCard, color: palette.textPrimary, borderRadius: radius.lg, border: '1px solid #f87171' } }}>
        <DialogTitle sx={{ fontWeight: 800, color: '#f87171' }}>Slett kontoen din permanent</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="warning">
              Dette kan <strong>ikke angres</strong>. Alle data blir slettet:
            </Alert>
            <Box component="ul" sx={{ color: palette.textSecondary, pl: 2.4, '& li': { mb: 0.6 } }}>
              <li>Talent-profilen din (bio, headshot, demografi)</li>
              <li>Alle Cloudflare Stream-videoer (showreel)</li>
              <li>Alle Cloudflare R2-filer (headshot, CV)</li>
              <li>Alle consent-rader (partnere mister tilgang umiddelbart)</li>
              <li>Alle partner-invitasjoner du har sendt</li>
              <li>All audit-historikk</li>
            </Box>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 600 }}>
              Skriv <code style={{ background: 'rgba(168,85,247,0.18)', padding: '2px 6px', borderRadius: 4 }}>SLETT MIN PROFIL</code> for å bekrefte:
            </Typography>
            <TextField
              fullWidth size="small" value={deleteText} onChange={(e) => setDeleteText(e.target.value)}
              placeholder="SLETT MIN PROFIL"
              autoFocus
              error={!!deleteText && deleteText !== 'SLETT MIN PROFIL'}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.4 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting} sx={{ color: palette.textMuted, textTransform: 'none' }}>
            Avbryt
          </Button>
          <Button
            onClick={() => void handleDelete()}
            disabled={deleteText !== 'SLETT MIN PROFIL' || deleting}
            startIcon={deleting ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm,
              bgcolor: '#f87171', color: '#fff',
              '&:hover': { bgcolor: '#dc2626' },
              '&.Mui-disabled': { bgcolor: 'rgba(248,113,113,0.3)', color: 'rgba(255,255,255,0.5)' },
            }}
          >
            Slett permanent
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
