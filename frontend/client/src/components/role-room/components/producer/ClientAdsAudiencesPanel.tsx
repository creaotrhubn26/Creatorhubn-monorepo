/**
 * ClientAdsAudiencesPanel.tsx
 *
 * Plattform-agnostisk audience-uploader. Speil av ClientTiktokAudiencesPanel
 * men med en `platform`-prop som styrer:
 *   - Hvilken backend-endepunkt som brukes
 *   - Hvilken plattform-ID som hentes fra config (tiktok_advertiser_id /
 *     meta_ad_account_id / linkedin_account_urn / google_ads_customer_id)
 *   - Farge + plattform-navn i UI
 *
 * Bestemor-vennlig UX gjenbrukt 1:1 fra TikTok-versjonen.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Stack, TextField, Typography,
} from '@mui/material';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

type Platform = 'meta' | 'linkedin' | 'google';

const PLATFORM_META: Record<Platform, {
  name: string;
  color: string;
  bg: string;
  border: string;
  idField: string;            // config-feltnavn for advertiser/account-ID
  idParam: string;            // POST body-param-navn
  listEndpoint?: (id: string) => string;
  createEndpoint: (configId: string) => string;
  audienceLabel: string;
}> = {
  meta: {
    name: 'Meta (Facebook + Instagram)',
    color: '#1877f2',
    bg: 'rgba(24,119,242,0.06)',
    border: 'rgba(24,119,242,0.30)',
    idField: 'meta_ad_account_id',
    idParam: 'adAccountId',
    listEndpoint: (id) => `/api/admin-room/agent/ads/meta/audiences?adAccountId=${encodeURIComponent(id)}`,
    createEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/meta/create-audience`,
    audienceLabel: 'Meta Custom Audience',
  },
  linkedin: {
    name: 'LinkedIn',
    color: '#0a66c2',
    bg: 'rgba(10,102,194,0.06)',
    border: 'rgba(10,102,194,0.30)',
    idField: 'linkedin_account_urn',
    idParam: 'adAccountUrn',
    createEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/linkedin/create-audience`,
    audienceLabel: 'LinkedIn Matched Audience',
  },
  google: {
    name: 'Google Ads',
    color: '#fbbc05',
    bg: 'rgba(251,188,5,0.06)',
    border: 'rgba(251,188,5,0.30)',
    idField: 'google_ads_customer_id',
    idParam: 'customerId',
    listEndpoint: (id) => `/api/admin-room/agent/ads/google/audiences?customerId=${encodeURIComponent(id)}`,
    createEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/google/create-audience`,
    audienceLabel: 'Google Customer Match',
  },
};

const palette = {
  bg: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
};

interface ExistingAudience {
  id?: string;
  audienceId?: string;
  resourceName?: string;
  name: string;
  size?: number;
  status: string;
}

interface Props {
  configId: string;
  platform: Platform;
  /** Override hvis vi vil sende advertiser/account-ID direkte. */
  platformAccountId?: string | null;
  isOwnAccount?: boolean;
}

export default function ClientAdsAudiencesPanel({
  configId,
  platform,
  platformAccountId: providedId,
  isOwnAccount = false,
}: Props) {
  const meta = PLATFORM_META[platform];

  const [accountId, setAccountId] = useState<string>(providedId ?? '');
  const [audiences, setAudiences] = useState<ExistingAudience[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'overview' | 'upload'>('overview');
  const [audienceName, setAudienceName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ uploadCount: number } | null>(null);

  const effectiveConfigId = isOwnAccount ? 'self' : configId;

  // Hent advertiser/account-ID fra config hvis ikke gitt som prop
  useEffect(() => {
    if (accountId || isOwnAccount) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const id = data?.config?.[meta.idField];
        if (id) setAccountId(id);
      })
      .catch(() => {});
  }, [configId, accountId, isOwnAccount, meta.idField]);

  const loadAudiences = async () => {
    if (!accountId || !meta.listEndpoint) {
      // LinkedIn har ikke list-endpoint ennå — viser kun cached fra DB
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(meta.listEndpoint(accountId), { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Kunne ikke hente mottakerlister');
      setAudiences(d.audiences ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å hente lister');
    } finally {
      setLoading(false);
    }
  };

  const createAudience = async () => {
    if (!audienceName || !csvText) return;
    const rows = csvText.split(/\r?\n/).map((line) => line.trim()).filter((l) => l && !l.toLowerCase().startsWith('email'));
    const identifiers = rows.map((line) => {
      const [a, b] = line.split(',').map((x) => x.trim());
      if (a?.includes('@')) return { email: a, phone: b };
      if (a?.match(/^\+?\d/)) return { phone: a };
      return { email: a };
    }).filter((id) => id.email || id.phone);

    if (identifiers.length === 0) {
      setError('Fant ingen e-poster eller telefonnumre i listen.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const r = await fetch(meta.createEndpoint(effectiveConfigId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          [meta.idParam]: accountId,
          name: audienceName,
          identifiers,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.scopeStatus) {
          throw new Error('Klienten har ikke gitt tillatelse til denne handlingen. Be klient åpne "Tillatelser og vilkår" og slå på opplasting for ' + meta.name + '.');
        }
        throw new Error(d.error || 'Opprettelse feilet');
      }
      setCreated({ uploadCount: d.uploadCount });
      setTimeout(() => loadAudiences(), 800);
      setTimeout(() => {
        setAudienceName('');
        setCsvText('');
        setStep('overview');
      }, 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å opprette listen');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    loadAudiences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, configId]);

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: `${meta.color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GroupsOutlinedIcon sx={{ color: meta.color, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              {meta.audienceLabel}
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Last opp en e-postliste — vi gjør den om til en målgruppe på {meta.name}.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        {step === 'overview' ? (
          <>
            <Box sx={{
              bgcolor: meta.bg,
              border: `1px solid ${meta.border}`,
              borderRadius: 1.6,
              p: 2.2,
              mb: 2,
            }}>
              <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: meta.color, lineHeight: 1 }}>
                {audiences.length}
              </Typography>
              <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mt: 0.5 }}>
                {audiences.length === 0 ? 'Ingen mottakerlister opprettet ennå' : audiences.length === 1 ? 'mottakerliste klar til bruk' : 'mottakerlister klare til bruk'}
              </Typography>
            </Box>

            <Button
              onClick={() => setStep('upload')}
              startIcon={<UploadFileOutlinedIcon />}
              disabled={!accountId}
              sx={{
                background: `linear-gradient(135deg, ${meta.color} 0%, ${palette.accent} 100%)`,
                color: '#fff', textTransform: 'none', fontWeight: 700, fontSize: '1rem',
                px: 4, py: 1.4, borderRadius: 1.6,
                '&.Mui-disabled': { background: 'rgba(168,85,247,0.18)', color: 'rgba(245,243,255,0.4)' },
              }}
            >
              Last opp ny mottakerliste
            </Button>

            {audiences.length > 0 ? (
              <Box sx={{ mt: 2.4 }}>
                <Divider sx={{ borderColor: palette.border, mb: 1.8 }} />
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
                  <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                    Eksisterende lister
                  </Typography>
                  <Button onClick={loadAudiences} disabled={loading} size="small" startIcon={loading ? <CircularProgress size={14} /> : <RefreshOutlinedIcon fontSize="small" />}
                    sx={{ color: palette.accent, textTransform: 'none' }}>
                    Oppdater
                  </Button>
                </Stack>
                <Stack spacing={1}>
                  {audiences.map((a, i) => (
                    <Box key={a.audienceId ?? a.resourceName ?? a.id ?? i} sx={{
                      bgcolor: 'rgba(168,85,247,0.04)',
                      border: `1px solid ${palette.border}`,
                      borderRadius: 1.4,
                      p: 1.6,
                    }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem' }}>
                            {a.name}
                          </Typography>
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mt: 0.4 }}>
                            {a.size ? `${a.size.toLocaleString('nb-NO')} personer` : 'Behandles…'}
                          </Typography>
                        </Box>
                        <Chip
                          label={a.status === 'ready' || a.status === 'READY' || a.status === 'OPEN' ? 'KLAR' : 'BEHANDLES'}
                          size="small"
                          sx={{
                            bgcolor: (a.status === 'ready' || a.status === 'READY' || a.status === 'OPEN') ? 'rgba(52,211,153,0.18)' : 'rgba(96,165,250,0.18)',
                            color: (a.status === 'ready' || a.status === 'READY' || a.status === 'OPEN') ? '#34d399' : '#60a5fa',
                            fontWeight: 700,
                            fontSize: '0.68rem',
                          }}
                        />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
          </>
        ) : (
          <Box>
            {created ? (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
                ✓ Liste lastet opp! {created.uploadCount} rader sendt til {meta.name}.
                {meta.name} bruker noen minutter på å gjenkjenne brukerne.
              </Alert>
            ) : null}

            <Typography sx={{ color: palette.textPrimary, fontSize: '1rem', fontWeight: 700, mb: 0.6 }}>
              Steg 1 — Gi listen et navn
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={audienceName}
              onChange={(e) => setAudienceName(e.target.value)}
              placeholder="Nyhetsbrev-abonnenter Q2 2026"
              InputProps={{ sx: { color: palette.textPrimary } }}
              sx={{ mb: 3 }}
            />

            <Typography sx={{ color: palette.textPrimary, fontSize: '1rem', fontWeight: 700, mb: 0.6 }}>
              Steg 2 — Lim inn e-postliste
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', mb: 1.4 }}>
              Én e-post per linje. Vi krypterer alt (SHA256) før det sendes til {meta.name}.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'maria@example.no\nandreas@example.no'}
              InputProps={{ sx: { color: palette.textPrimary, fontFamily: 'monospace', fontSize: '0.86rem' } }}
              sx={{ mb: 3 }}
            />

            <Stack direction="row" spacing={1.4}>
              <Button
                onClick={createAudience}
                disabled={!audienceName || !csvText || creating}
                startIcon={creating ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <UploadFileOutlinedIcon />}
                sx={{
                  background: `linear-gradient(135deg, ${meta.color} 0%, ${palette.accent} 100%)`,
                  color: '#fff', textTransform: 'none', fontWeight: 700, fontSize: '1rem',
                  px: 4, py: 1.4, borderRadius: 1.6,
                }}
              >
                {creating ? `Sender til ${meta.name}…` : `Send listen til ${meta.name}`}
              </Button>
              <Button onClick={() => { setStep('overview'); setCreated(null); }} sx={{ color: palette.textMuted, textTransform: 'none' }}>
                Avbryt
              </Button>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
