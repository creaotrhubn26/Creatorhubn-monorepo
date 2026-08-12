/**
 * ClientTiktokPermissionsPanel.tsx
 *
 * Bestemor-vennlig: klient leser vilkår, slår av/på fire spesifikke
 * handlinger producer kan gjøre på deres vegne, og signerer elektronisk.
 *
 * Backend:
 *   GET  /api/role-room/ads-configs/:id/permissions
 *   POST /api/role-room/ads-configs/:id/permissions/accept
 *   POST /api/role-room/ads-configs/:id/permissions/revoke
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControlLabel, Stack, Switch, Typography,
} from '@mui/material';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

const palette = {
  bg: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  tiktok: '#ff0050',
};

type Status = 'pending' | 'approved' | 'rejected';

interface State {
  termsVersion: string;
  termsText: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  permissions: Record<string, Status>;
  needsReaccept: boolean;
}

const buildACTIONS = (t: TFn): Array<{ key: string; title: string; body: string }> => ([
  {
    key: 'audience_upload',
    title: t('tiktokPerm.s006'),
    body: t('tiktokPerm.s019'),
  },
  {
    key: 'crm_event_sync',
    title: t('tiktokPerm.s021'),
    body: t('tiktokPerm.s016'),
  },
  {
    key: 'plugin_install',
    title: t('tiktokPerm.s005'),
    body: t('tiktokPerm.s017'),
  },
  {
    key: 'creator_invitation',
    title: t('tiktokPerm.s008'),
    body: t('tiktokPerm.s018'),
  },
]);

export default function ClientTiktokPermissionsPanel({ configId }: { configId: string }) {
  const { t } = useT();
  const ACTIONS = useMemo(() => buildACTIONS(t), [t]);
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [termsOpen, setTermsOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/role-room/ads-configs/${configId}/permissions`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || t('tiktokPerm.s010'));
      setState(d);
      const next: Record<string, boolean> = {};
      for (const a of ACTIONS) next[a.key] = d.permissions?.[a.key] === 'approved';
      setPerms(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Henting feilet');
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const permissions: Record<string, Status> = {};
      for (const a of ACTIONS) permissions[a.key] = perms[a.key] ? 'approved' : 'rejected';
      const r = await fetch(`/api/role-room/ads-configs/${configId}/permissions/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ permissions }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Lagring feilet');
      setSuccess(t('tiktokPerm.s022'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lagring feilet');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/role-room/ads-configs/${configId}/permissions/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Tilbaketrekking feilet');
      setSuccess(t('tiktokPerm.s020'));
      setRevokeOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tilbaketrekking feilet');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [configId]);

  const accepted = !!state?.acceptedAt && !state?.revokedAt && !state?.needsReaccept;
  const activeCount = Object.values(perms).filter(Boolean).length;

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GavelOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              {t('tiktokPerm.s023')}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              {t('tiktokPerm.s004')}
            </Typography>
          </Box>
          {accepted ? (
            <Chip
              icon={<VerifiedUserOutlinedIcon sx={{ color: '#34d399 !important' }} />}
              label={t('tiktokPerm.s007')}
              sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700 }}
            />
          ) : (
            <Chip
              label={state?.revokedAt ? t('tiktokPerm.s024') : t('tiktokPerm.s025')}
              sx={{
                bgcolor: state?.revokedAt ? 'rgba(248,113,113,0.18)' : 'rgba(251,191,36,0.18)',
                color: state?.revokedAt ? '#f87171' : '#fbbf24',
                fontWeight: 700,
              }}
            />
          )}
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}
        {success ? <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 1.6 }}>{success}</Alert> : null}

        {/* Bestemor-sammendrag */}
        <Box sx={{
          bgcolor: 'rgba(255,0,80,0.06)',
          border: `1px solid rgba(255,0,80,0.20)`,
          borderRadius: 1.6,
          p: 2.2,
          mb: 2,
        }}>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
            {activeCount} {t('tiktokPerm.s029')} {ACTIONS.length}
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mt: 0.5 }}>
            {t('tiktokPerm.s030')}
          </Typography>
          {accepted && state?.acceptedAt ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem', mt: 1.2 }}>
              {t('tiktokPerm.s007')} {new Date(state.acceptedAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })} · versjon {state.termsVersion}
            </Typography>
          ) : null}
        </Box>

        {/* Permissions-togglene */}
        <Stack spacing={1.4} sx={{ mb: 2 }}>
          {ACTIONS.map((a) => (
            <Box key={a.key} sx={{
              bgcolor: perms[a.key] ? 'rgba(52,211,153,0.06)' : 'rgba(168,85,247,0.04)',
              border: `1px solid ${perms[a.key] ? 'rgba(52,211,153,0.30)' : palette.border}`,
              borderRadius: 1.4,
              p: 1.8,
            }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!perms[a.key]}
                    onChange={(e) => setPerms((p) => ({ ...p, [a.key]: e.target.checked }))}
                    sx={{
                      '& .MuiSwitch-thumb': { color: perms[a.key] ? '#34d399' : palette.textMuted },
                      '& .Mui-checked + .MuiSwitch-track': { backgroundColor: '#34d399 !important' },
                    }}
                  />
                }
                label={
                  <Box sx={{ ml: 1 }}>
                    <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.98rem' }}>
                      {a.title}
                    </Typography>
                    <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', mt: 0.4 }}>
                      {a.body}
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', m: 0 }}
              />
            </Box>
          ))}
        </Stack>

        {/* Vilkår-lenke */}
        <Box sx={{
          bgcolor: 'rgba(168,85,247,0.06)',
          border: `1px solid ${palette.border}`,
          borderRadius: 1.4,
          p: 1.6,
          mb: 2,
        }}>
          <Typography sx={{ color: palette.textPrimary, fontSize: '0.92rem', fontWeight: 600, mb: 0.6 }}>
            {t('tiktokPerm.s028')} {state?.termsVersion ?? '—'})
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', mb: 1 }}>
            {t('tiktokPerm.s015')}
          </Typography>
          <Button
            onClick={() => setTermsOpen(true)}
            size="small"
            sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600, px: 0 }}
          >
            {t('tiktokPerm.s013')}
          </Button>
        </Box>

        {/* Lagre / Avslutt */}
        <Stack direction="row" spacing={1.4}>
          <Button
            onClick={save}
            disabled={saving || loading}
            startIcon={saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <VerifiedUserOutlinedIcon />}
            sx={{
              background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)',
              color: '#fff', textTransform: 'none', fontWeight: 700, fontSize: '1rem',
              px: 4, py: 1.4, borderRadius: 1.6,
              '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' },
            }}
          >
            {accepted ? t('tiktokPerm.s011') : t('tiktokPerm.s000')}
          </Button>
          {accepted ? (
            <Button
              onClick={() => setRevokeOpen(true)}
              disabled={saving}
              startIcon={<HighlightOffOutlinedIcon />}
              sx={{ color: '#f87171', textTransform: 'none', fontWeight: 700 }}
            >
              {t('tiktokPerm.s003')}
            </Button>
          ) : null}
        </Stack>
      </CardContent>

      {/* Vilkår-dialog */}
      <Dialog
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: palette.bg, color: palette.textPrimary } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>{t('tiktokPerm.s027')} {state?.termsVersion ?? '—'})</DialogTitle>
        <DialogContent>
          <Box sx={{
            whiteSpace: 'pre-wrap',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: '0.92rem',
            lineHeight: 1.7,
            color: palette.textSecondary,
            maxHeight: '60vh',
            overflow: 'auto',
            pr: 1,
          }}>
            {state?.termsText ?? t('tiktokPerm.s012')}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTermsOpen(false)} sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600 }}>
            {t('tiktokPerm.s014')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Avslutt-bekreftelse */}
      <Dialog open={revokeOpen} onClose={() => setRevokeOpen(false)} PaperProps={{ sx: { bgcolor: palette.bg, color: palette.textPrimary } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{t('tiktokPerm.s026')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: palette.textSecondary }}>
            {t('tiktokPerm.s001')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeOpen(false)} sx={{ color: palette.textMuted, textTransform: 'none' }}>
            {t('tiktokPerm.s002')}
          </Button>
          <Button
            onClick={revoke}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <HighlightOffOutlinedIcon />}
            sx={{ bgcolor: 'rgba(248,113,113,0.2)', color: '#f87171', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: 'rgba(248,113,113,0.3)' } }}
          >
            {t('tiktokPerm.s009')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
