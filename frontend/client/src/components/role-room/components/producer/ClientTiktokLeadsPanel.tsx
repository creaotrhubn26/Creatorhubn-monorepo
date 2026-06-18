/**
 * ClientTiktokLeadsPanel.tsx
 *
 * Bestemor-vennlig UI for å hente TikTok Lead Ads-leads inn til
 * Admin Room (eller klient-CRM hvis vi jobber på vegne av klient).
 *
 * Designprinsipper (per project_role_room_agent_ux_redesign):
 *   - ÉN tydelig CTA per skjerm
 *   - Sammendrag-først, detaljer skjult bak "Vis flere"
 *   - Norsk språk, ingen API-/endpoint-navn synlig
 *   - Stor klar typografi
 *
 * Backend-endepunkter:
 *   GET  /api/admin-room/agent/ads/tiktok/lead-forms?advertiserId=X
 *   POST /api/admin-room/agent/ads/configs/:id/tiktok/sync-leads
 *   GET  /api/admin-room/agent/ads/configs/:id/tiktok/leads
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

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

interface LeadForm {
  formId: string;
  formName: string;
  leadCount?: number;
}

interface Lead {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  form_name: string | null;
  lead_created_at: string | null;
  pushed_to_crm: boolean;
  status: string;
}

export default function ClientTiktokLeadsPanel({
  configId,
  advertiserId: providedAdvertiserId,
  isOwnAccount = false,
}: {
  configId: string;
  advertiserId?: string | null;
  isOwnAccount?: boolean;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<{ fetched: number; inserted: number } | null>(null);

  const effectiveConfigId = isOwnAccount ? 'self' : configId;
  const ownerLabel = isOwnAccount ? 'The Role Room' : 'klienten';

  // Hent advertiser_id fra config hvis ikke gitt som prop
  useEffect(() => {
    if (advertiserId || isOwnAccount) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.config?.tiktok_advertiser_id) setAdvertiserId(data.config.tiktok_advertiser_id);
      })
      .catch(() => {});
  }, [configId, advertiserId, isOwnAccount]);

  const loadForms = async () => {
    if (!advertiserId) return;
    setLoadingForms(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/tiktok/lead-forms?advertiserId=${advertiserId}`, { credentials: 'include' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Kunne ikke hente lead-skjemaer');
      setForms(data.forms ?? []);
      if (data.forms?.length === 1) setSelectedForm(data.forms[0].formId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å hente skjemaer');
    } finally {
      setLoadingForms(false);
    }
  };

  const loadLeads = async () => {
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${effectiveConfigId}/tiktok/leads`, { credentials: 'include' });
      const data = await r.json();
      if (r.ok) setLeads(data.leads ?? []);
    } catch { /* stille */ }
  };

  const syncNow = async () => {
    if (!selectedForm || !advertiserId) return;
    setSyncing(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${effectiveConfigId}/tiktok/sync-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ advertiserId, formId: selectedForm }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Sync feilet');
      setLastSync({ fetched: data.fetched, inserted: data.inserted });
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å hente nye henvendelser');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadForms();
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advertiserId, configId]);

  // Sammendrag (bestemor-vennlig: vis først, detaljer under)
  const newCount = leads.filter((l) => l.status === 'new').length;
  const totalCount = leads.length;

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <EmailOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: palette.textPrimary }}>
              Henvendelser fra TikTok
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Folk som har sendt inn skjema fra {ownerLabel === 'klienten' ? 'klientens' : "The Role Rooms"} TikTok-annonser.
            </Typography>
          </Box>
        </Stack>

        {/* Bestemor-sammendrag */}
        <Box sx={{
          bgcolor: 'rgba(255,0,80,0.06)',
          border: `1px solid rgba(255,0,80,0.20)`,
          borderRadius: 1.6,
          p: 2.2,
          mb: 2,
        }}>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
            {newCount}
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mt: 0.5 }}>
            {newCount === 0 ? 'Ingen nye henvendelser akkurat nå' : newCount === 1 ? 'ny henvendelse å følge opp' : 'nye henvendelser å følge opp'}
          </Typography>
          {totalCount > newCount ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem', mt: 1 }}>
              Totalt {totalCount} henvendelser registrert siden start.
            </Typography>
          ) : null}
        </Box>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        {/* Skjemavalg */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: palette.textPrimary, fontSize: '0.92rem', fontWeight: 600, mb: 1 }}>
            Hvilket skjema vil du hente fra?
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Select
              size="small"
              value={selectedForm}
              onChange={(e) => setSelectedForm(e.target.value)}
              disabled={loadingForms || forms.length === 0}
              displayEmpty
              sx={{ minWidth: 320, color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
            >
              <MenuItem value=""><em style={{ color: palette.textMuted }}>
                {loadingForms ? 'Henter…' : forms.length === 0 ? 'Ingen skjemaer funnet' : 'Velg et skjema'}
              </em></MenuItem>
              {forms.map((f) => (
                <MenuItem key={f.formId} value={f.formId}>
                  {f.formName} {f.leadCount ? `(${f.leadCount} totalt)` : ''}
                </MenuItem>
              ))}
            </Select>
            <Button onClick={loadForms} size="small" sx={{ color: palette.accent, textTransform: 'none', minWidth: 0 }}>
              Last på nytt
            </Button>
          </Stack>
        </Box>

        {/* Primær CTA — én tydelig */}
        <Button
          onClick={syncNow}
          disabled={!selectedForm || syncing}
          startIcon={syncing ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <RefreshOutlinedIcon />}
          sx={{
            background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '1rem',
            px: 4, py: 1.4,
            borderRadius: 1.6,
            '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' },
            '&.Mui-disabled': { background: 'rgba(168,85,247,0.18)', color: 'rgba(245,243,255,0.4)' },
          }}
        >
          {syncing ? 'Henter nye henvendelser…' : 'Hent nye henvendelser nå'}
        </Button>

        {lastSync ? (
          <Box sx={{ mt: 1.4 }}>
            <Chip
              icon={<CheckCircleOutlineIcon sx={{ color: '#34d399 !important', fontSize: 16 }} />}
              label={lastSync.inserted === 0
                ? 'Ingen nye siden sist'
                : `${lastSync.inserted} nye lagt til`}
              sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700 }}
            />
          </Box>
        ) : null}

        {/* Vis listen (bestemor: kun de 5 nyeste, med "Vis alle"-toggle) */}
        {leads.length > 0 ? (
          <Box sx={{ mt: 2.4 }}>
            <Divider sx={{ borderColor: palette.border, mb: 1.8 }} />
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1.2 }}>
              Siste henvendelser
            </Typography>
            <Stack spacing={1}>
              {leads.slice(0, 8).map((lead) => (
                <Box
                  key={lead.id}
                  sx={{
                    bgcolor: 'rgba(168,85,247,0.04)',
                    border: `1px solid ${palette.border}`,
                    borderRadius: 1.4,
                    p: 1.6,
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" spacing={1.6}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem' }}>
                        {lead.full_name || lead.email || lead.phone || 'Ukjent navn'}
                      </Typography>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.4 }}>
                        {lead.email ? (
                          <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem' }}>
                            ✉️ {lead.email}
                          </Typography>
                        ) : null}
                        {lead.phone ? (
                          <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem' }}>
                            📞 {lead.phone}
                          </Typography>
                        ) : null}
                      </Stack>
                      {lead.lead_created_at ? (
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.5 }}>
                          Sendt inn {new Date(lead.lead_created_at).toLocaleString('nb-NO', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </Typography>
                      ) : null}
                    </Box>
                    <Chip
                      label={lead.status === 'new' ? 'NY' : lead.status === 'qualified' ? 'KVALIFISERT' : lead.status === 'contacted' ? 'KONTAKTET' : lead.status === 'converted' ? 'KUNDE' : 'TAPT'}
                      size="small"
                      sx={{
                        bgcolor: lead.status === 'new' ? 'rgba(96,165,250,0.18)' : lead.status === 'converted' ? 'rgba(52,211,153,0.18)' : 'rgba(148,163,184,0.18)',
                        color: lead.status === 'new' ? '#60a5fa' : lead.status === 'converted' ? '#34d399' : palette.textMuted,
                        fontWeight: 700,
                        fontSize: '0.68rem',
                      }}
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
            {leads.length > 8 ? (
              <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem', mt: 1.4, textAlign: 'center' }}>
                + {leads.length - 8} til. Åpne fullstendig oversikt i Admin Room.
              </Typography>
            ) : null}
          </Box>
        ) : null}
      </CardContent>
    </Card>
  );
}
