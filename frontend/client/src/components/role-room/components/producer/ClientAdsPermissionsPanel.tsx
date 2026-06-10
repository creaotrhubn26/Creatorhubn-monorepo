/**
 * ClientAdsPermissionsPanel.tsx
 *
 * Plattform-agnostisk versjon av ClientTiktokPermissionsPanel —
 * dekker TikTok, Meta, LinkedIn og Google i samme UI.
 *
 * Klient skrur av/på handlinger per plattform. Hver bryter er klart
 * forklart på norsk. Vilkår-teksten dekker alle 4 plattformer.
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
  meta: '#1877f2',
  linkedin: '#0a66c2',
  google: '#fbbc05',
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

interface Action {
  key: string;
  platform: 'tiktok' | 'meta' | 'linkedin' | 'google';
  title: string;
  body: string;
}

const ACTIONS: Action[] = [
  // TikTok
  { key: 'tiktok_audience_upload', platform: 'tiktok',
    title: 'TikTok: Bygge målgrupper fra e-postlister',
    body: 'Producer kan laste opp e-postlister fra deres CRM som TikTok-målgrupper. Alle e-poster SHA256-krypteres før send — TikTok ser bare hashen.' },
  { key: 'tiktok_crm_event_sync', platform: 'tiktok',
    title: 'TikTok: Sende konverteringer (CRM Events API)',
    body: 'Når noen registrerer seg eller betaler hos dere, sender vi hendelsen til TikTok for ad-optimalisering.' },
  { key: 'tiktok_plugin_install', platform: 'tiktok',
    title: 'TikTok: Binde nettside/butikk til TikTok Business',
    body: 'Domenet deres bindes som plugin slik at annonser kan sende folk rett til kassen.' },
  { key: 'tiktok_creator_invitation', platform: 'tiktok',
    title: 'TikTok: Invitere creators på deres vegne',
    body: 'Producer kan invitere TikTok-skapere til samarbeid. Endelig avtale går alltid gjennom dere.' },

  // Meta
  { key: 'meta_audience_upload', platform: 'meta',
    title: 'Meta: Bygge Custom Audiences fra e-postlister',
    body: 'Producer kan laste opp e-postlister som Facebook/Instagram Custom Audiences. SHA256-kryptert før send.' },
  { key: 'meta_capi_sync', platform: 'meta',
    title: 'Meta: Sende konverteringer (Conversions API)',
    body: 'Server-side events sendes til Meta Conversions API for å forbedre annonse-optimalisering i Facebook + Instagram.' },
  { key: 'meta_lead_sync', platform: 'meta',
    title: 'Meta: Hente leads fra Meta Lead Ads',
    body: 'Vi henter automatisk inn leads fra Facebook- og Instagram Lead Ads til deres CRM.' },

  // LinkedIn
  { key: 'linkedin_audience_upload', platform: 'linkedin',
    title: 'LinkedIn: Bygge Matched Audiences',
    body: 'Producer kan laste opp e-postlister som LinkedIn Matched Audiences. SHA256-kryptert før send.' },
  { key: 'linkedin_capi_sync', platform: 'linkedin',
    title: 'LinkedIn: Sende konverteringer (Conversions API)',
    body: 'Server-side events sendes til LinkedIn for å forbedre B2B-annonse-optimalisering.' },
  { key: 'linkedin_lead_sync', platform: 'linkedin',
    title: 'LinkedIn: Hente leads fra Lead Gen Forms',
    body: 'Vi henter automatisk inn leads fra LinkedIn Lead Gen Forms til deres CRM.' },

  // Google
  { key: 'google_customer_match', platform: 'google',
    title: 'Google Ads: Bygge Customer Match Audiences',
    body: 'Producer kan laste opp e-postlister som Google Customer Match-målgrupper for retargeting på Search + YouTube. SHA256-kryptert.' },
  { key: 'google_offline_conversions', platform: 'google',
    title: 'Google Ads: Sende offline-konverteringer',
    body: 'Konverteringer som skjer utenfor nettsiden (telefon, butikk) importeres til Google Ads for ad-optimalisering.' },
  { key: 'google_enhanced_conversions', platform: 'google',
    title: 'Google Ads: Enhanced Conversions',
    body: 'Sender hashed kundedata (e-post/telefon) sammen med konverteringer for bedre attribution i iOS-tid.' },
];

const PLATFORM_LABEL: Record<string, { name: string; color: string }> = {
  tiktok: { name: 'TikTok', color: palette.tiktok },
  meta: { name: 'Meta (Facebook + Instagram)', color: palette.meta },
  linkedin: { name: 'LinkedIn', color: palette.linkedin },
  google: { name: 'Google Ads', color: palette.google },
};

interface Props {
  configId: string;
  /** Hvilke plattformer er aktive — bestemmer hvilke seksjoner som vises. */
  platforms?: { tiktok?: boolean; meta?: boolean; linkedin?: boolean; google?: boolean };
}

export default function ClientAdsPermissionsPanel({
  configId,
  platforms = { tiktok: true, meta: true, linkedin: true, google: true },
}: Props) {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [termsOpen, setTermsOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const visibleActions = ACTIONS.filter((a) => platforms[a.platform] !== false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/role-room/ads-configs/${configId}/permissions`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Kunne ikke hente tillatelser');
      setState(d);
      const next: Record<string, boolean> = {};
      for (const a of visibleActions) {
        next[a.key] = d.permissions?.[a.key] === 'approved'
          // Legacy-keys for TikTok
          || (a.key === 'tiktok_audience_upload' && d.permissions?.audience_upload === 'approved')
          || (a.key === 'tiktok_crm_event_sync' && d.permissions?.crm_event_sync === 'approved')
          || (a.key === 'tiktok_plugin_install' && d.permissions?.plugin_install === 'approved')
          || (a.key === 'tiktok_creator_invitation' && d.permissions?.creator_invitation === 'approved');
      }
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
      for (const a of visibleActions) permissions[a.key] = perms[a.key] ? 'approved' : 'rejected';
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
  const totalCount = visibleActions.length;

  // Grupper actions per plattform
  const grouped: Record<string, Action[]> = {};
  for (const a of visibleActions) {
    if (!grouped[a.platform]) grouped[a.platform] = [];
    grouped[a.platform].push(a);
  }

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(192,132,252,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GavelOutlinedIcon sx={{ color: palette.accent, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              Tillatelser og vilkår
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Bestem hva producer får lov til å gjøre på deres vegne på TikTok, Meta, LinkedIn og Google.
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

        {/* Sammendrag */}
        <Box sx={{
          bgcolor: 'rgba(192,132,252,0.06)',
          border: `1px solid rgba(192,132,252,0.30)`,
          borderRadius: 1.6,
          p: 2.2,
          mb: 2,
        }}>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: palette.accent, lineHeight: 1 }}>
            {activeCount} av {totalCount}
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

        {/* Permissions gruppert per plattform */}
        <Stack spacing={2.4} sx={{ mb: 2 }}>
          {Object.entries(grouped).map(([platform, actions]) => {
            const meta = PLATFORM_LABEL[platform];
            return (
              <Box key={platform}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.2 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: meta.color }} />
                  <Typography sx={{ color: meta.color, fontSize: '0.84rem', fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    {meta.name}
                  </Typography>
                </Stack>
                <Stack spacing={1.2}>
                  {actions.map((a) => (
                    <Box key={a.key} sx={{
                      bgcolor: perms[a.key] ? 'rgba(52,211,153,0.06)' : 'rgba(168,85,247,0.04)',
                      border: `1px solid ${perms[a.key] ? 'rgba(52,211,153,0.30)' : palette.border}`,
                      borderRadius: 1.4,
                      p: 1.6,
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
                            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.94rem' }}>
                              {a.title}
                            </Typography>
                            <Typography sx={{ color: palette.textSecondary, fontSize: '0.82rem', mt: 0.4 }}>
                              {a.body}
                            </Typography>
                          </Box>
                        }
                        sx={{ alignItems: 'flex-start', m: 0 }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            );
          })}
        </Stack>

        {/* Vilkår */}
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

        <Stack direction="row" spacing={1.4}>
          <Button
            onClick={save}
            disabled={saving || loading}
            startIcon={saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <VerifiedUserOutlinedIcon />}
            sx={{
              background: 'linear-gradient(135deg, #c084fc 0%, #d946ef 100%)',
              color: '#fff', textTransform: 'none', fontWeight: 700, fontSize: '1rem',
              px: 4, py: 1.4, borderRadius: 1.6,
              '&:hover': { background: 'linear-gradient(135deg, #a855f7 0%, #b537cc 100%)' },
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
            Alle automatiske handlinger stoppes umiddelbart på alle plattformer (TikTok, Meta, LinkedIn, Google). Producer kan ikke lenger laste opp lister, sende konverteringer eller installere plugins på deres vegne. Eksisterende annonser påvirkes ikke.
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
