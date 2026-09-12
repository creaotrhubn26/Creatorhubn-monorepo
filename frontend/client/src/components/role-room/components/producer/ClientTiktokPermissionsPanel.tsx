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

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControlLabel, Stack, Switch, Typography,
} from '@mui/material';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import HighlightOffOutlinedIcon from '@mui/icons-material/HighlightOffOutlined';

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

const ACTIONS: Array<{ key: string; title: string; body: string }> = [
  {
    key: 'audience_upload',
    title: 'Bygge målgrupper fra e-postlister',
    body: 'Producer kan laste opp e-postlister fra deres CRM til TikTok som målgrupper. Alle e-poster krypteres (SHA256) før de sendes — TikTok ser bare hashen, aldri rådata.',
  },
  {
    key: 'crm_event_sync',
    title: 'Sende konverteringer til TikTok',
    body: 'Når noen registrerer seg, betaler eller avbryter hos dere, sender vi en hendelse til TikTok så annonsealgoritmen lærer hvilke annonser som faktisk gir salg.',
  },
  {
    key: 'plugin_install',
    title: 'Binde nettside/butikk til TikTok',
    body: 'Producer kan binde domenet deres (f.eks. example.no) til TikTok Business som plugin — slik at annonser kan sende folk rett til kassen.',
  },
  {
    key: 'creator_invitation',
    title: 'Invitere creators på deres vegne',
    body: 'Producer kan invitere TikTok-skapere til samarbeid med deres merkevare. Hver avtale går ALLTID gjennom dere for endelig godkjenning av pris og innhold.',
  },
];

export default function ClientTiktokPermissionsPanel({ configId }: { configId: string }) {
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
      if (!r.ok) throw new Error(d.error || 'Kunne ikke hente tillatelser');
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
      setSuccess('Tillatelser lagret. Producer kan nå utføre handlinger du har godkjent.');
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
      setSuccess('Samarbeidet er avsluttet. Alle automatiske handlinger har stoppet.');
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
              Tillatelser og vilkår
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Bestem hva producer får lov til å gjøre på deres vegne mot TikTok.
            </Typography>
          </Box>
          {accepted ? (
            <Chip
              icon={<VerifiedUserOutlinedIcon sx={{ color: '#34d399 !important' }} />}
              label="Godkjent"
              sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700 }}
            />
          ) : (
            <Chip
              label={state?.revokedAt ? 'Trukket tilbake' : 'Venter på godkjenning'}
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
            {activeCount} av {ACTIONS.length}
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mt: 0.5 }}>
            handlinger producer har lov til å utføre
          </Typography>
          {accepted && state?.acceptedAt ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem', mt: 1.2 }}>
              Godkjent {new Date(state.acceptedAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })} · versjon {state.termsVersion}
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
            Vilkår for fullmakt (versjon {state?.termsVersion ?? '—'})
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', mb: 1 }}>
            Når du lagrer tillatelsene, signerer du elektronisk at du har lest og forstått hele vilkåravtalen.
          </Typography>
          <Button
            onClick={() => setTermsOpen(true)}
            size="small"
            sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600, px: 0 }}
          >
            Les hele vilkåravtalen
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
            {accepted ? 'Lagre endringer + bekreft vilkår' : 'Aksepter vilkår og lagre tillatelser'}
          </Button>
          {accepted ? (
            <Button
              onClick={() => setRevokeOpen(true)}
              disabled={saving}
              startIcon={<HighlightOffOutlinedIcon />}
              sx={{ color: '#f87171', textTransform: 'none', fontWeight: 700 }}
            >
              Avslutt samarbeid
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
        <DialogTitle sx={{ fontWeight: 800 }}>Vilkår (versjon {state?.termsVersion ?? '—'})</DialogTitle>
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
            {state?.termsText ?? 'Laster vilkår…'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTermsOpen(false)} sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600 }}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>

      {/* Avslutt-bekreftelse */}
      <Dialog open={revokeOpen} onClose={() => setRevokeOpen(false)} PaperProps={{ sx: { bgcolor: palette.bg, color: palette.textPrimary } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Vil du virkelig avslutte samarbeidet?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: palette.textSecondary }}>
            Alle automatiske handlinger stoppes umiddelbart. Producer kan ikke lenger laste opp lister, sende konverteringer eller installere plugins på deres vegne. Eksisterende annonser i TikTok påvirkes ikke.
            Du kan starte samarbeidet igjen når som helst ved å akseptere vilkårene på nytt.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeOpen(false)} sx={{ color: palette.textMuted, textTransform: 'none' }}>
            Avbryt
          </Button>
          <Button
            onClick={revoke}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <HighlightOffOutlinedIcon />}
            sx={{ bgcolor: 'rgba(248,113,113,0.2)', color: '#f87171', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: 'rgba(248,113,113,0.3)' } }}
          >
            Ja, avslutt samarbeidet
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
