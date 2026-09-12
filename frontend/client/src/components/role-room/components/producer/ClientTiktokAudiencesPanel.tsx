/**
 * ClientTiktokAudiencesPanel.tsx
 *
 * Bestemor-vennlig UI for å lage TikTok custom audiences fra
 * e-postlister (klient-CRM eller The Role Rooms egen abonnentbase).
 *
 * Designprinsipper:
 *   - "Last opp en liste" som primær handling (ingen API-jargon)
 *   - Sammendrag-først: vis eksisterende audiences først
 *   - Steg-for-steg-veiledning når man oppretter ny
 *
 * Backend-endepunkter:
 *   GET  /api/admin-room/agent/ads/tiktok/audiences?advertiserId=X
 *   POST /api/admin-room/agent/ads/configs/:id/tiktok/create-audience
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

interface Audience {
  audienceId: string;
  name: string;
  type: string;
  size?: number;
  matchRate?: number;
  status: string;
}

export default function ClientTiktokAudiencesPanel({
  configId,
  advertiserId: providedAdvertiserId,
  isOwnAccount = false,
}: {
  configId: string;
  advertiserId?: string | null;
  isOwnAccount?: boolean;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'overview' | 'upload'>('overview');
  const [audienceName, setAudienceName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdAudience, setCreatedAudience] = useState<{ audienceId: string; uploadCount: number } | null>(null);

  const effectiveConfigId = isOwnAccount ? 'self' : configId;
  const ownerLabel = isOwnAccount ? 'The Role Room' : 'klienten';

  useEffect(() => {
    if (advertiserId || isOwnAccount) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.config?.tiktok_advertiser_id) setAdvertiserId(data.config.tiktok_advertiser_id);
      })
      .catch(() => {});
  }, [configId, advertiserId, isOwnAccount]);

  const loadAudiences = async () => {
    if (!advertiserId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/tiktok/audiences?advertiserId=${advertiserId}`, { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Kunne ikke hente mottakerlister');
      setAudiences(data.audiences ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å hente lister');
    } finally {
      setLoading(false);
    }
  };

  const createAudience = async () => {
    if (!audienceName || !csvText) return;
    // Parse CSV — én rad per linje, format "email,phone" eller bare "email"
    const rows = csvText.split(/\r?\n/).map((line) => line.trim()).filter((l) => l && !l.toLowerCase().startsWith('email'));
    const identifiers = rows.map((line) => {
      const [a, b] = line.split(',').map((x) => x.trim());
      if (a?.includes('@')) return { email: a, phone: b };
      if (a?.match(/^\+?\d/)) return { phone: a };
      return { email: a };
    }).filter((id) => id.email || id.phone);

    if (identifiers.length === 0) {
      setError('Fant ingen e-poster eller telefonnumre i listen. Sjekk formatet.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${effectiveConfigId}/tiktok/create-audience`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          advertiserId,
          name: audienceName,
          identifiers,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Opprettelse feilet');
      setCreatedAudience({ audienceId: data.audienceId, uploadCount: data.uploadCount });
      // Refresh audiences
      setTimeout(() => loadAudiences(), 800);
      // Reset form
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
  }, [advertiserId, configId]);

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GroupsOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              Mottakerlister på TikTok
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Last opp en e-postliste — vi gjør den om til en målgruppe på TikTok.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        {step === 'overview' ? (
          <>
            {/* Bestemor-sammendrag */}
            <Box sx={{
              bgcolor: 'rgba(255,0,80,0.06)',
              border: `1px solid rgba(255,0,80,0.20)`,
              borderRadius: 1.6,
              p: 2.2,
              mb: 2,
            }}>
              <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
                {audiences.length}
              </Typography>
              <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mt: 0.5 }}>
                {audiences.length === 0 ? 'Ingen mottakerlister opprettet ennå' : audiences.length === 1 ? 'mottakerliste klar til bruk' : 'mottakerlister klare til bruk'}
              </Typography>
            </Box>

            {/* Primær CTA */}
            <Button
              onClick={() => setStep('upload')}
              startIcon={<UploadFileOutlinedIcon />}
              sx={{
                background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)',
                color: '#fff',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                px: 4, py: 1.4,
                borderRadius: 1.6,
                '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' },
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
                  {audiences.map((a) => (
                    <Box key={a.audienceId} sx={{
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
                            {a.size ? `${a.size.toLocaleString('nb-NO')} personer i målgruppen` : 'Behandles…'}
                            {a.matchRate ? ` · ${a.matchRate.toFixed(0)}% gjenkjent` : ''}
                          </Typography>
                        </Box>
                        <Chip
                          label={a.status === 'ready' || a.status === 'READY' ? 'KLAR' : a.status === 'processing' || a.status === 'PROCESSING' ? 'BEHANDLES' : a.status}
                          size="small"
                          sx={{
                            bgcolor: (a.status === 'ready' || a.status === 'READY') ? 'rgba(52,211,153,0.18)' : 'rgba(96,165,250,0.18)',
                            color: (a.status === 'ready' || a.status === 'READY') ? '#34d399' : '#60a5fa',
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
          // Upload-flow
          <Box>
            {createdAudience ? (
              <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
                ✓ Liste lastet opp! {createdAudience.uploadCount} rader sendt til TikTok.
                TikTok bruker noen minutter på å gjenkjenne brukerne. Du finner listen under "Eksisterende lister" om litt.
              </Alert>
            ) : null}

            <Typography sx={{ color: palette.textPrimary, fontSize: '1rem', fontWeight: 700, mb: 0.6 }}>
              Steg 1 — Gi listen et navn
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.86rem', mb: 1.4 }}>
              Et navn du selv kjenner igjen. F.eks. "Nyhetsbrev-abonnenter Q2 2026".
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
              Én e-postadresse per linje. Vi kryptererer alt før det sendes til TikTok — ingen rå-data lagres.
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'maria@example.no\nandreas@example.no\nsara@example.no'}
              InputProps={{ sx: { color: palette.textPrimary, fontFamily: 'monospace', fontSize: '0.86rem' } }}
              sx={{ mb: 3 }}
            />

            <Stack direction="row" spacing={1.4}>
              <Button
                onClick={createAudience}
                disabled={!audienceName || !csvText || creating}
                startIcon={creating ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <UploadFileOutlinedIcon />}
                sx={{
                  background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)',
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  px: 4, py: 1.4,
                  borderRadius: 1.6,
                  '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' },
                }}
              >
                {creating ? 'Sender til TikTok…' : 'Send listen til TikTok'}
              </Button>
              <Button
                onClick={() => { setStep('overview'); setCreatedAudience(null); }}
                sx={{ color: palette.textMuted, textTransform: 'none' }}
              >
                Avbryt
              </Button>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
