/**
 * ClientAdsPerformancePanel — read-only per-kampanje-visning for klient.
 *
 * Komplementerer ClientEconomyPanel sin per-KANAL-aggregat med en
 * per-KAMPANJE-nedbryting + en kommentar-tråd der klienten kan be om
 * endringer (øk budsjett, pause, juster mål) uten å ha skrive-tilgang.
 *
 * Backed by:
 *  - GET  /api/role-room/ads/results/by-campaign?projectId=X&period=YYYY-MM
 *  - GET  /api/role-room/ads/campaigns/:campaignId/client-comments
 *  - POST /api/role-room/ads/campaigns/:campaignId/client-comments
 *  - POST /api/role-room/ads/client-comments/:commentId/resolve  (producer-only)
 *
 * Vises i ClientEconomyPanel for BÅDE klient og produsent — men knappene
 * tilpasses rollen (klient kan be om endringer, produsent kan markere som løst).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  Chat as ChatIcon,
  Send as SendIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

interface CampaignResult {
  campaignId: string;
  campaignName: string;
  platform: string;
  status: string;
  dailyBudgetNok: number | null;
  spendNok: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValueNok: number;
  roas: number | null;
  costPerConversionNok: number | null;
}

interface CampaignComment {
  id: string;
  campaignId: string;
  projectId: string;
  authorUserId: string;
  authorRole: 'client' | 'producer';
  body: string;
  intent: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
}

type CommentIntent =
  | 'increase_budget'
  | 'decrease_budget'
  | 'pause'
  | 'resume'
  | 'change_targeting'
  | 'change_creative'
  | 'general_feedback'
  | 'producer_reply';

const CARD_SX = {
  p: 1.6,
  borderRadius: 2,
  bgcolor: 'rgba(15,23,42,0.55)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;
const LABEL = { color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' } as const;
const SUBTLE = { color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' } as const;

const PLATFORM_LABEL: Record<string, string> = {
  meta: 'Meta',
  google: 'Google Ads',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
};

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: '#86efac', bg: 'rgba(134,239,172,0.12)', label: 'Aktiv' },
  paused: { color: '#fcd34d', bg: 'rgba(252,211,77,0.12)', label: 'Pauset' },
  draft: { color: '#93c5fd', bg: 'rgba(147,197,253,0.12)', label: 'Utkast' },
  ended: { color: 'rgba(226,232,240,0.6)', bg: 'rgba(148,163,184,0.12)', label: 'Avsluttet' },
  failed: { color: '#fca5a5', bg: 'rgba(252,165,165,0.12)', label: 'Feilet' },
};

const INTENT_OPTIONS: { value: CommentIntent; label: string; rolesAllowed: ('client' | 'producer')[] }[] = [
  { value: 'increase_budget', label: 'Øk budsjettet', rolesAllowed: ['client'] },
  { value: 'decrease_budget', label: 'Reduser budsjettet', rolesAllowed: ['client'] },
  { value: 'pause', label: 'Pause kampanjen', rolesAllowed: ['client'] },
  { value: 'resume', label: 'Restart kampanjen', rolesAllowed: ['client'] },
  { value: 'change_targeting', label: 'Endre målgruppe', rolesAllowed: ['client'] },
  { value: 'change_creative', label: 'Endre kreativ/tekst', rolesAllowed: ['client'] },
  { value: 'general_feedback', label: 'Tilbakemelding (info)', rolesAllowed: ['client'] },
  { value: 'producer_reply', label: 'Svar (produsent)', rolesAllowed: ['producer'] },
];

const FEE_RATE = 0.2; // 20 % påslag — matcher ClientEconomyPanel §5.3

const nok = (n: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(n || 0);

const fmtRelativeTime = (iso: string): string => {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'akkurat nå';
  if (min < 60) return `${min} min siden`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} t siden`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} dager siden`;
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' }).format(new Date(iso));
};

export default function ClientAdsPerformancePanel({
  projectId,
  period,
  userRole,
}: {
  projectId: string;
  period: string; // YYYY-MM
  userRole: 'client' | 'client_reviewer' | 'content_producer' | string | null;
}) {
  const [campaigns, setCampaigns] = useState<CampaignResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);

  const isClient = useMemo(
    () => ['client', 'client_reviewer'].includes((userRole ?? '').toLowerCase()),
    [userRole],
  );

  const fetchCampaigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/role-room/ads/results/by-campaign?projectId=${encodeURIComponent(projectId)}&period=${encodeURIComponent(period)}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `HTTP ${res.status}`);
        setCampaigns([]);
        return;
      }
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, period]);

  if (loading) {
    return (
      <Stack sx={CARD_SX} alignItems="center" spacing={1}>
        <CircularProgress size={24} sx={{ color: '#a5b4fc' }} />
        <Typography sx={SUBTLE}>Laster kampanje-resultater…</Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ '& .MuiAlert-message': { fontSize: '0.78rem' } }}>
        Klarte ikke laste kampanje-resultater: {error}
      </Alert>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Stack sx={CARD_SX} spacing={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CampaignIcon sx={{ fontSize: 20, color: '#a5b4fc' }} />
          <Typography sx={LABEL}>Aktive kampanjer</Typography>
        </Stack>
        <Typography sx={SUBTLE}>
          Ingen kampanjer er registrert for denne perioden ennå.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack sx={CARD_SX} spacing={1.2}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <CampaignIcon sx={{ fontSize: 20, color: '#a5b4fc' }} />
        <Typography sx={LABEL}>Per kampanje</Typography>
      </Stack>
      <Typography sx={SUBTLE}>
        {isClient
          ? 'Du ser hvordan hver kampanje presterer denne perioden. Be om endringer ved å åpne kommentar-tråden — produsenten får varsel og kan utføre det du ber om.'
          : 'Klient-synlig per-kampanje-nedbryting. Klient kan kommentere på en kampanje — du ser dialogen her og kan svare eller markere som løst.'}
      </Typography>

      {campaigns.map((c) => (
        <CampaignCard
          key={c.campaignId}
          campaign={c}
          isClient={isClient}
          expanded={expandedCampaignId === c.campaignId}
          onToggle={() =>
            setExpandedCampaignId((cur) => (cur === c.campaignId ? null : c.campaignId))
          }
        />
      ))}
    </Stack>
  );
}

// ─── CampaignCard ─────────────────────────────────────────────

function CampaignCard({
  campaign,
  isClient,
  expanded,
  onToggle,
}: {
  campaign: CampaignResult;
  isClient: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const status = STATUS_META[campaign.status] ?? { color: '#cbd5e1', bg: 'rgba(148,163,184,0.12)', label: campaign.status };
  const spendWithFee = campaign.spendNok * (1 + FEE_RATE);

  return (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 1.5,
        bgcolor: 'rgba(148,163,184,0.06)',
        border: '1px solid rgba(148,163,184,0.16)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>
          {campaign.campaignName}
        </Typography>
        <Chip
          label={status.label}
          size="small"
          sx={{
            bgcolor: status.bg,
            color: status.color,
            fontWeight: 700,
            fontSize: '0.7rem',
            height: 22,
          }}
        />
        <Chip
          label={PLATFORM_LABEL[campaign.platform] ?? campaign.platform}
          size="small"
          sx={{
            bgcolor: 'rgba(165,180,252,0.12)',
            color: '#c7d2fe',
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
          }}
        />
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 0.8 }}>
        <Metric label="Forbruk" value={nok(campaign.spendNok)} />
        <Metric label="+ 20 % påslag" value={nok(spendWithFee)} />
        <Metric label="Klikk" value={campaign.clicks.toLocaleString('nb-NO')} />
        <Metric label="Konv." value={campaign.conversions.toLocaleString('nb-NO')} />
        <Metric label="Konv.verdi" value={nok(campaign.conversionValueNok)} />
        <Metric
          label="ROAS"
          value={campaign.roas != null ? `${campaign.roas}×` : '—'}
          highlight
        />
        {campaign.dailyBudgetNok != null && (
          <Metric label="Daglig budsjett" value={nok(campaign.dailyBudgetNok)} />
        )}
      </Stack>

      <Stack direction="row" justifyContent="flex-end">
        <Button
          size="small"
          startIcon={<ChatIcon sx={{ fontSize: 16 }} />}
          onClick={onToggle}
          sx={{
            textTransform: 'none',
            color: '#a5b4fc',
            fontWeight: 600,
            fontSize: '0.76rem',
          }}
        >
          {expanded ? 'Lukk tråd' : isClient ? 'Be om endring' : 'Se klient-tråd'}
        </Button>
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed rgba(148,163,184,0.2)' }}>
          <CommentThread campaignId={campaign.campaignId} isClient={isClient} />
        </Box>
      </Collapse>
    </Box>
  );
}

// ─── CommentThread ──────────────────────────────────────────

function CommentThread({ campaignId, isClient }: { campaignId: string; isClient: boolean }) {
  const [comments, setComments] = useState<CampaignComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [intent, setIntent] = useState<CommentIntent | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const role: 'client' | 'producer' = isClient ? 'client' : 'producer';
  const availableIntents = INTENT_OPTIONS.filter((i) => i.rolesAllowed.includes(role));

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/role-room/ads/campaigns/${encodeURIComponent(campaignId)}/client-comments`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error || `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setComments(data.comments || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Feil ved lasting');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const submit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/role-room/ads/campaigns/${encodeURIComponent(campaignId)}/client-comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            body: body.trim(),
            intent: intent || null,
          }),
        },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b.error || `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setComments((cur) => [...cur, data.comment]);
      setBody('');
      setIntent('');
    } finally {
      setSubmitting(false);
    }
  };

  const resolve = async (commentId: string) => {
    if (isClient) return; // klient kan ikke resolve
    try {
      const res = await fetch(
        `/api/role-room/ads/client-comments/${encodeURIComponent(commentId)}/resolve`,
        { method: 'POST', credentials: 'include' },
      );
      if (res.ok) {
        setComments((cur) =>
          cur.map((c) => (c.id === commentId ? { ...c, resolvedAt: new Date().toISOString() } : c)),
        );
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 1 }}>
        <CircularProgress size={18} sx={{ color: '#a5b4fc' }} />
      </Stack>
    );
  }

  return (
    <Stack spacing={1}>
      {error && (
        <Alert severity="error" sx={{ '& .MuiAlert-message': { fontSize: '0.74rem' } }}>
          {error}
        </Alert>
      )}

      {comments.length === 0 && (
        <Typography sx={{ ...SUBTLE, fontStyle: 'italic' }}>
          Ingen kommentarer ennå. {isClient ? 'Si fra hva du ønsker endret.' : 'Klient har ikke kommentert på denne kampanjen.'}
        </Typography>
      )}

      {comments.map((c) => (
        <Stack
          key={c.id}
          direction="row"
          spacing={1}
          alignItems="flex-start"
          sx={{
            opacity: c.resolvedAt ? 0.55 : 1,
            p: 0.8,
            borderRadius: 1,
            bgcolor: c.authorRole === 'client' ? 'rgba(165,180,252,0.07)' : 'rgba(252,211,77,0.07)',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.3 }}>
              <Typography sx={{ color: '#e2e8f0', fontSize: '0.74rem', fontWeight: 700 }}>
                {c.authorRole === 'client' ? 'Klient' : 'Produsent'}
              </Typography>
              <Typography sx={{ ...SUBTLE, fontSize: '0.7rem' }}>
                {fmtRelativeTime(c.createdAt)}
              </Typography>
              {c.intent && (
                <Chip
                  label={INTENT_OPTIONS.find((i) => i.value === c.intent)?.label || c.intent}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(252,211,77,0.16)',
                    color: '#fcd34d',
                    fontWeight: 600,
                    fontSize: '0.66rem',
                    height: 18,
                  }}
                />
              )}
              {c.resolvedAt && (
                <Chip
                  icon={<CheckIcon sx={{ fontSize: 13, color: '#86efac !important' }} />}
                  label="Løst"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(134,239,172,0.14)',
                    color: '#86efac',
                    fontWeight: 600,
                    fontSize: '0.66rem',
                    height: 18,
                  }}
                />
              )}
            </Stack>
            <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
              {c.body}
            </Typography>
          </Box>
          {!isClient && c.authorRole === 'client' && !c.resolvedAt && (
            <Button
              size="small"
              onClick={() => resolve(c.id)}
              sx={{ textTransform: 'none', color: '#86efac', fontSize: '0.7rem', minWidth: 0 }}
            >
              Marker løst
            </Button>
          )}
        </Stack>
      ))}

      {/* Ny kommentar — fortsatt mulig selv etter at trådene er løst */}
      <Stack spacing={0.8} sx={{ mt: 1, pt: 1, borderTop: '1px dashed rgba(148,163,184,0.16)' }}>
        {availableIntents.length > 0 && (
          <Select
            size="small"
            value={intent}
            onChange={(e) => setIntent(e.target.value as CommentIntent | '')}
            displayEmpty
            sx={{
              fontSize: '0.78rem',
              '& .MuiSelect-select': { color: '#e2e8f0' },
              '& fieldset': { borderColor: 'rgba(148,163,184,0.2)' },
            }}
          >
            <MenuItem value="">— Velg type forespørsel (valgfritt) —</MenuItem>
            {availableIntents.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        )}
        <TextField
          multiline
          minRows={2}
          maxRows={6}
          size="small"
          placeholder={
            isClient
              ? 'Beskriv hva du ønsker endret (f.eks. «Øk budsjettet til 800 kr/dag fra mandag», eller «Pause inntil sommerkampanjen er over»)…'
              : 'Skriv et svar til klient eller dokumenter hva som er gjort…'
          }
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 4000))}
          sx={{
            '& .MuiOutlinedInput-root': {
              color: '#e2e8f0',
              fontSize: '0.82rem',
              '& fieldset': { borderColor: 'rgba(148,163,184,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(165,180,252,0.4)' },
            },
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ ...SUBTLE, fontSize: '0.68rem' }}>
            {body.length} / 4000 tegn
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<SendIcon sx={{ fontSize: 14 }} />}
            disabled={!body.trim() || submitting}
            onClick={submit}
            sx={{
              textTransform: 'none',
              bgcolor: '#6366f1',
              fontWeight: 700,
              fontSize: '0.74rem',
              '&:hover': { bgcolor: '#4f46e5' },
            }}
          >
            {submitting ? 'Sender…' : 'Send'}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}

// ─── Metric helper ───────────────────────────────────────────

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box sx={{ minWidth: 70 }}>
      <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.66rem' }}>{label}</Typography>
      <Typography
        sx={{
          color: highlight ? '#a5b4fc' : '#e2e8f0',
          fontSize: '0.84rem',
          fontWeight: highlight ? 800 : 700,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
