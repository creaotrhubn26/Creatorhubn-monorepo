/**
 * B2BAcquisitionPanel.tsx
 *
 * B2B-akkvisisjons-utvidelse til eksisterende Marketing Cockpit.
 *
 * 5 collapsible seksjoner som dekker 9 backend-features:
 *   1. Funnel-oversikt (agency_leads stats)
 *   2. Hot leads-liste med Claude-score
 *   3. PR-distribusjon (pressemeldinger + journalist-DB)
 *   4. Webinarer + referrals
 *   5. Case studies
 */

import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Divider,
  IconButton, Stack, TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import { useCallback, useEffect, useState } from 'react';

// Brand-logoer via Google s2 favicons (gratis, ingen API-nøkkel, alltid live).
// Clearbit Logo API ble lagt ned av HubSpot i 2024. Google s2 returnerer høy-
// kvalitets favicon for ethvert domene. Fallback til DuckDuckGo hvis Google
// returnerer null-icon, og til slutt MUI globe hvis begge feiler.
const CHANNEL_LOGO_DOMAINS: Record<string, string | null> = {
  google_ads: 'google.com',
  meta_ads: 'facebook.com',
  instagram_ads: 'instagram.com',
  instagram_organic: 'instagram.com',
  tiktok_ads: 'tiktok.com',
  tiktok_organic: 'tiktok.com',
  linkedin_ads: 'linkedin.com',
  organic_or_direct: null,
};

function ChannelLogo({ channel, size = 20 }: { channel: string; size?: number }) {
  const domain = CHANNEL_LOGO_DOMAINS[channel];
  const [errored, setErrored] = useState(false);
  const [fallback, setFallback] = useState(false);
  if (!domain || errored) {
    return <PublicOutlinedIcon sx={{ color: 'rgba(148,163,184,0.7)', fontSize: size }} />;
  }
  const src = fallback
    ? `https://icons.duckduckgo.com/ip3/${domain}.ico`
    : `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  return (
    <Box
      component="img"
      key={src}
      src={src}
      alt={`${channel} logo`}
      sx={{
        width: size,
        height: size,
        borderRadius: '4px',
        display: 'block',
        objectFit: 'contain',
        bgcolor: 'rgba(255,255,255,0.92)',
      }}
      onError={() => {
        if (!fallback) setFallback(true);
        else setErrored(true);
      }}
    />
  );
}

interface FunnelStats {
  funnel: Record<string, number>;
  by_segment: Array<{ segment: string; status: string; n: number }>;
  last_30d: {
    new_30d: number;
    contacted_30d: number;
    qualified: number;
    won_30d: number;
  };
  score_distribution: Record<string, number>;
  recent: Array<{
    id: string;
    agency_name: string;
    contact_name: string;
    email: string;
    segment: string;
    status: string;
    score_total: number | null;
    score_tier: string | null;
    created_at: string;
  }>;
}

// Attribusjons-data fra /api/admin-room/agency-leads.
interface AttributionData {
  by_source: Array<{
    source_key: string;
    medium: string;
    campaign: string;
    n: number;
    qualified: number;
    won: number;
  }>;
  by_paid_channel: Array<{
    channel:
      | 'google_ads'
      | 'meta_ads'
      | 'instagram_ads'
      | 'instagram_organic'
      | 'tiktok_ads'
      | 'tiktok_organic'
      | 'linkedin_ads'
      | 'organic_or_direct';
    n: number;
    won: number;
  }>;
}

const PAID_CHANNEL_LABELS: Record<AttributionData['by_paid_channel'][number]['channel'], string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads (FB)',
  instagram_ads: 'Instagram Ads',
  instagram_organic: 'Instagram organisk',
  tiktok_ads: 'TikTok Ads',
  tiktok_organic: 'TikTok organisk',
  linkedin_ads: 'LinkedIn Ads',
  organic_or_direct: 'Organisk / direkte',
};

const PAID_CHANNEL_COLORS: Record<AttributionData['by_paid_channel'][number]['channel'], string> = {
  google_ads: '#fbbf24',
  meta_ads: '#1877f2',
  instagram_ads: '#e1306c',
  instagram_organic: '#f9a826',
  tiktok_ads: '#000000',
  tiktok_organic: '#69c9d0',
  linkedin_ads: '#0a66c2',
  organic_or_direct: '#94a3b8',
};

const STATUS_LABELS: Record<string, string> = {
  new: 'Nye',
  contacted: 'Kontaktet',
  demo_booked: 'Demo booket',
  trial: 'Trial',
  customer: 'Kunder',
  disqualified: 'Avvist',
  archived: 'Arkivert',
};

const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  hot:           { bg: 'rgba(248,113,113,0.22)', fg: '#f87171' },
  warm:          { bg: 'rgba(251,191,36,0.22)',  fg: '#fbbf24' },
  cold:          { bg: 'rgba(96,165,250,0.22)',  fg: '#60a5fa' },
  disqualified:  { bg: 'rgba(148,163,184,0.18)', fg: '#94a3b8' },
};

export default function B2BAcquisitionPanel() {
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>('funnel');
  const [scoringLeadId, setScoringLeadId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [attribution, setAttribution] = useState<AttributionData | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin-room/cockpit/b2b/funnel', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as FunnelStats;
      setFunnel(data);
      // Parallel: hent attribusjons-data fra agency-leads-endepunkt.
      // Best-effort — feilen blokkerer ikke hovedflyten.
      void (async () => {
        try {
          const ar = await fetch('/api/admin-room/agency-leads?limit=500', { credentials: 'include' });
          if (ar.ok) {
            const ad = await ar.json() as { attribution?: AttributionData };
            if (ad.attribution) setAttribution(ad.attribution);
          }
        } catch { /* swallow */ }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å hente funnel');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const handleScoreLead = async (leadId: string) => {
    setScoringLeadId(leadId);
    setActionMsg(null);
    try {
      const r = await fetch(`/api/admin-room/cockpit/leads/${leadId}/score`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error ?? `HTTP ${r.status}`);
      setActionMsg(`Lead scoret: ${payload.score?.tier} (${payload.score?.total}/100)`);
      await reload();
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Scoring feilet');
    } finally {
      setScoringLeadId(null);
    }
  };

  const handleStartNurture = async (leadId: string) => {
    setActionMsg(null);
    try {
      const r = await fetch(`/api/admin-room/cockpit/leads/${leadId}/start-nurture`, {
        method: 'POST',
        credentials: 'include',
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error ?? `HTTP ${r.status}`);
      setActionMsg(`Nurture-sekvens (${payload.steps} steg) lagt i kø`);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : 'Nurture feilet');
    }
  };

  const toggle = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={22} sx={{ color: '#c084fc' }} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>;
  }

  if (!funnel) return null;

  const tierCounts = funnel.score_distribution;
  const recentLeads = Array.isArray(funnel.recent) ? funnel.recent : [];
  const totalLeads = Object.values(funnel.funnel ?? {}).reduce((a, b) => a + b, 0);
  const conversionRate = funnel.last_30d.new_30d
    ? Math.round((funnel.last_30d.won_30d / funnel.last_30d.new_30d) * 100)
    : 0;

  return (
    <Stack spacing={1.6}>
      {actionMsg ? (
        <Alert severity="info" onClose={() => setActionMsg(null)}>{actionMsg}</Alert>
      ) : null}

      {/* Quick stats */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 1.4,
        }}
      >
        <StatBox label="Totalt leads" value={String(totalLeads)} color="#c084fc" />
        <StatBox label="Siste 30d" value={String(funnel.last_30d.new_30d)} color="#60a5fa" />
        <StatBox label="Kunder" value={String(funnel.funnel.customer ?? 0)} color="#34d399" />
        <StatBox label="Konvertering" value={`${conversionRate}%`} color="#fbbf24" />
      </Box>

      {/* Funnel-stages */}
      <Section
        title="Funnel-stadier"
        Icon={GroupsOutlinedIcon}
        open={openSection === 'funnel'}
        onToggle={() => toggle('funnel')}
        right={
          <IconButton size="small" onClick={(e) => { e.stopPropagation(); void reload(); }} sx={{ color: 'rgba(203,213,225,0.7)' }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        }
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ flexWrap: 'wrap', gap: 1.2 }}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => {
            const n = funnel.funnel[key] ?? 0;
            const pct = totalLeads ? Math.round((n / totalLeads) * 100) : 0;
            return (
              <Box
                key={key}
                sx={{
                  flex: 1,
                  minWidth: 120,
                  bgcolor: 'rgba(168,85,247,0.06)',
                  border: '1px solid rgba(168,85,247,0.18)',
                  borderRadius: 1.2,
                  p: 1.2,
                }}
              >
                <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {label}
                </Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#f5f3ff' }}>
                  {n}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.7rem' }}>
                  {pct}% av total
                </Typography>
              </Box>
            );
          })}
        </Stack>

        {Object.keys(tierCounts).length ? (
          <Stack direction="row" spacing={1.2} sx={{ mt: 2, flexWrap: 'wrap' }}>
            {Object.entries(tierCounts).map(([tier, n]) => {
              const color = TIER_COLORS[tier] ?? { bg: 'rgba(168,85,247,0.18)', fg: '#c4b5fd' };
              return (
                <Chip
                  key={tier}
                  label={`${tier.toUpperCase()} · ${n}`}
                  sx={{ bgcolor: color.bg, color: color.fg, fontWeight: 700, fontSize: '0.78rem' }}
                />
              );
            })}
          </Stack>
        ) : null}
      </Section>

      {/* Attribusjon — hvor kommer leadene fra? */}
      {attribution ? (() => {
        const bySource = Array.isArray(attribution.by_source) ? attribution.by_source : [];
        const byPaidChannel = Array.isArray(attribution.by_paid_channel) ? attribution.by_paid_channel : [];
        return (
        <Section
          title={`Attribusjon (${bySource.length} kilder)`}
          Icon={CampaignOutlinedIcon}
          open={openSection === 'attribution'}
          onToggle={() => toggle('attribution')}
        >
          {/* Paid-channel-fordeling */}
          {byPaidChannel.length > 0 ? (
            <Box sx={{ mb: 2.4 }}>
              <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                Per kanal
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ flexWrap: 'wrap', gap: 1.2 }}>
                {byPaidChannel.map((c) => {
                  const total = byPaidChannel.reduce((a, b) => a + b.n, 0);
                  const pct = total ? Math.round((c.n / total) * 100) : 0;
                  const color = PAID_CHANNEL_COLORS[c.channel];
                  const winRate = c.n ? Math.round((c.won / c.n) * 100) : 0;
                  return (
                    <Box
                      key={c.channel}
                      sx={{
                        flex: 1,
                        minWidth: 160,
                        bgcolor: `${color}15`,
                        border: `1px solid ${color}40`,
                        borderRadius: 1.2,
                        p: 1.2,
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }}>
                        <ChannelLogo channel={c.channel} size={18} />
                        <Typography sx={{ color: '#f5f3ff', fontSize: '0.82rem', fontWeight: 700 }}>
                          {PAID_CHANNEL_LABELS[c.channel]}
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#f5f3ff' }}>
                        {c.n}
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.7rem' }}>
                        {pct}% · {c.won} kunder ({winRate}% win)
                      </Typography>
                      <Box sx={{ mt: 0.6, height: 4, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color }} />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          ) : null}

          {/* Source-tabell */}
          {bySource.length > 0 ? (
            <Box>
              <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', mb: 1 }}>
                Per kilde (utm-tagger / direct)
              </Typography>
              <Box
                component="table"
                sx={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  '& th': {
                    textAlign: 'left',
                    color: 'rgba(148,163,184,0.85)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    py: 0.8,
                    borderBottom: '1px solid rgba(148,163,184,0.18)',
                  },
                  '& td': {
                    color: '#f5f3ff',
                    fontSize: '0.85rem',
                    py: 1,
                    borderBottom: '1px solid rgba(148,163,184,0.08)',
                  },
                  '& td.num': { textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 },
                }}
              >
                <thead>
                  <tr>
                    <th>Kilde</th>
                    <th>Medium</th>
                    <th>Kampanje</th>
                    <th style={{ textAlign: 'right' }}>Leads</th>
                    <th style={{ textAlign: 'right' }}>Kvalifisert</th>
                    <th style={{ textAlign: 'right' }}>Kunder</th>
                    <th style={{ textAlign: 'right' }}>Win-rate</th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((s, i) => {
                    const winRate = s.n ? Math.round((s.won / s.n) * 100) : 0;
                    return (
                      <tr key={i}>
                        <td>{s.source_key || 'direct'}</td>
                        <td style={{ color: 'rgba(203,213,225,0.7)' }}>{s.medium || '—'}</td>
                        <td style={{ color: 'rgba(203,213,225,0.7)' }}>{s.campaign || '—'}</td>
                        <td className="num">{s.n}</td>
                        <td className="num" style={{ color: '#60a5fa' }}>{s.qualified}</td>
                        <td className="num" style={{ color: '#34d399' }}>{s.won}</td>
                        <td className="num" style={{ color: winRate >= 10 ? '#34d399' : 'rgba(203,213,225,0.7)' }}>
                          {winRate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Box>
            </Box>
          ) : null}

          {bySource.length === 0 && byPaidChannel.length === 0 ? (
            <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              Ingen attribusjon-data ennå. Drev trafikk fra LinkedIn/Google Ads/Meta med UTM-tagger eller click-ID-er for å se kilde-fordeling her.
            </Typography>
          ) : null}
        </Section>
        );
      })() : null}

      {/* Recent leads */}
      <Section
        title={`Nyeste leads (${recentLeads.length})`}
        Icon={AutoAwesomeOutlinedIcon}
        open={openSection === 'leads'}
        onToggle={() => toggle('leads')}
      >
        <Stack spacing={1}>
          {recentLeads.map((lead) => (
            <Box
              key={lead.id}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1.4fr 1fr auto auto' },
                gap: 1.2,
                alignItems: 'center',
                bgcolor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(168,85,247,0.10)',
                borderRadius: 1,
                p: 1.4,
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, color: '#f5f3ff', fontSize: '0.92rem' }} noWrap>
                  {lead.agency_name}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.78rem' }} noWrap>
                  {lead.contact_name} · {lead.email}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.6} alignItems="center">
                <Chip
                  label={STATUS_LABELS[lead.status] ?? lead.status}
                  size="small"
                  sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: '#c4b5fd', fontSize: '0.72rem' }}
                />
                {lead.score_tier ? (
                  <Chip
                    label={`${lead.score_tier.toUpperCase()} ${lead.score_total ?? '–'}`}
                    size="small"
                    sx={{
                      bgcolor: TIER_COLORS[lead.score_tier]?.bg ?? 'rgba(168,85,247,0.18)',
                      color: TIER_COLORS[lead.score_tier]?.fg ?? '#c4b5fd',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                    }}
                  />
                ) : null}
              </Stack>
              <Button
                size="small"
                onClick={() => handleScoreLead(lead.id)}
                disabled={scoringLeadId === lead.id}
                startIcon={scoringLeadId === lead.id
                  ? <CircularProgress size={12} sx={{ color: '#c084fc' }} />
                  : <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#c084fc',
                  border: '1px solid rgba(168,85,247,0.32)',
                  '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
                }}
              >
                Score
              </Button>
              <Button
                size="small"
                onClick={() => handleStartNurture(lead.id)}
                startIcon={<NotificationsActiveOutlinedIcon sx={{ fontSize: 14 }} />}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#fbbf24',
                  border: '1px solid rgba(251,191,36,0.32)',
                  '&:hover': { bgcolor: 'rgba(251,191,36,0.08)' },
                }}
              >
                Nurture
              </Button>
            </Box>
          ))}
          {recentLeads.length === 0 ? (
            <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.86rem', textAlign: 'center', py: 2, fontStyle: 'italic' }}>
              Ingen leads ennå. Send /for-byraer til noen byråer.
            </Typography>
          ) : null}
        </Stack>
      </Section>

      {/* PR + journalist-DB */}
      <Section
        title="PR · Pressemeldinger + journalister"
        Icon={CampaignOutlinedIcon}
        open={openSection === 'pr'}
        onToggle={() => toggle('pr')}
      >
        <PRSection />
      </Section>

      {/* Webinars + referrals */}
      <Section
        title="Webinarer + referrals"
        Icon={EventOutlinedIcon}
        open={openSection === 'webinars'}
        onToggle={() => toggle('webinars')}
      >
        <WebinarsAndReferralsSection />
      </Section>

      {/* Case studies */}
      <Section
        title="Case studies"
        Icon={ArticleOutlinedIcon}
        open={openSection === 'cases'}
        onToggle={() => toggle('cases')}
      >
        <CaseStudiesSection />
      </Section>

      {/* LinkedIn-publish shortcut */}
      <Section
        title="LinkedIn Company auto-publish"
        Icon={ShareOutlinedIcon}
        open={openSection === 'linkedin'}
        onToggle={() => toggle('linkedin')}
      >
        <LinkedInPublishSection />
      </Section>
    </Stack>
  );
}

// ──────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box
      sx={{
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(168,85,247,0.18)',
        borderRadius: 1.4,
        p: 1.6,
      }}
    >
      <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '1.8rem', color }}>
        {value}
      </Typography>
    </Box>
  );
}

function Section({
  title, Icon, open, onToggle, right, children,
}: {
  title: string;
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  open: boolean;
  onToggle: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        bgcolor: 'rgba(15,7,33,0.6)',
        border: '1px solid rgba(168,85,247,0.18)',
        borderRadius: 1.6,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={onToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.2,
          p: 1.8,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(168,85,247,0.06)' },
        }}
      >
        <Icon sx={{ color: '#c084fc' }} />
        <Typography sx={{ flex: 1, color: '#f5f3ff', fontWeight: 700, fontSize: '0.96rem' }}>
          {title}
        </Typography>
        {right}
        {open ? <ExpandLessIcon sx={{ color: 'rgba(203,213,225,0.6)' }} /> : <ExpandMoreIcon sx={{ color: 'rgba(203,213,225,0.6)' }} />}
      </Box>
      <Collapse in={open} unmountOnExit>
        <Divider sx={{ borderColor: 'rgba(168,85,247,0.10)' }} />
        <Box sx={{ p: 1.8 }}>
          {children}
        </Box>
      </Collapse>
    </Box>
  );
}

// ── PR-seksjon ────────────────────────────────────────────────────
function PRSection() {
  const [milestone, setMilestone] = useState('');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const generate = async () => {
    if (!milestone.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin-room/cockpit/pr/releases/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestone, context }),
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error ?? `HTTP ${r.status}`);
      setMsg(`Pressemelding generert: «${payload.release.headline}»`);
      setMilestone(''); setContext('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Generering feilet');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.2}>
      {msg ? <Alert severity="info" onClose={() => setMsg(null)}>{msg}</Alert> : null}
      <TextField
        label="Milestone (f.eks. 5 nye pilot-byråer)"
        value={milestone}
        onChange={(e) => setMilestone(e.target.value)}
        size="small"
        fullWidth
        sx={fieldSx}
      />
      <TextField
        label="Kontekst (valgfri — Claude bruker dette)"
        value={context}
        onChange={(e) => setContext(e.target.value)}
        size="small"
        multiline
        minRows={2}
        fullWidth
        sx={fieldSx}
      />
      <Button
        onClick={generate}
        disabled={busy || !milestone.trim()}
        startIcon={busy ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <AutoAwesomeOutlinedIcon />}
        sx={{
          background: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
          color: '#fff',
          textTransform: 'none',
          fontWeight: 700,
          alignSelf: 'flex-start',
          '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
        }}
      >
        Generer pressemelding med Claude
      </Button>
      <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.78rem' }}>
        Liste over genererte pressemeldinger + journalist-DB kommer i full UI når du har 2+ utkast.
      </Typography>
    </Stack>
  );
}

// ── Webinars + Referrals-seksjon ──────────────────────────────────
function WebinarsAndReferralsSection() {
  const [referrerEmail, setReferrerEmail] = useState('');
  const [referrerName, setReferrerName] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const createReferral = async () => {
    if (!referrerEmail.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin-room/cockpit/referrals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referrer_email: referrerEmail.trim(),
          referrer_name: referrerName.trim() || undefined,
        }),
      });
      const payload = await r.json();
      if (r.ok && payload.share_url) {
        setShareUrl(payload.share_url);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography sx={{ color: '#c084fc', fontWeight: 700, fontSize: '0.86rem' }}>
        Lag referral-link
      </Typography>
      <TextField
        label="Referrers e-post"
        value={referrerEmail}
        onChange={(e) => setReferrerEmail(e.target.value)}
        size="small"
        fullWidth
        sx={fieldSx}
      />
      <TextField
        label="Navn (valgfri)"
        value={referrerName}
        onChange={(e) => setReferrerName(e.target.value)}
        size="small"
        fullWidth
        sx={fieldSx}
      />
      <Button
        onClick={createReferral}
        disabled={busy || !referrerEmail.trim()}
        sx={{
          background: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
          color: '#fff',
          textTransform: 'none',
          fontWeight: 700,
          alignSelf: 'flex-start',
        }}
      >
        Lag link (1 mnd gratis ved konvertering)
      </Button>
      {shareUrl ? (
        <Alert severity="success">
          <Typography sx={{ fontWeight: 700, fontSize: '0.86rem' }}>
            Del-link:
          </Typography>
          <Typography sx={{ fontFamily: 'monospace', fontSize: '0.82rem', mt: 0.4 }}>
            {shareUrl}
          </Typography>
        </Alert>
      ) : null}
      <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.78rem', fontStyle: 'italic' }}>
        Webinar-organisator får full UI når du har første event. POST /api/admin-room/cockpit/webinars finnes allerede.
      </Typography>
    </Stack>
  );
}

// ── Case studies ─────────────────────────────────────────────────
function CaseStudiesSection() {
  const [agencyName, setAgencyName] = useState('');
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const generate = async () => {
    if (!agencyName.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/admin-room/cockpit/case-studies/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agency_name: agencyName.trim(),
          context_markdown: context.trim() || undefined,
        }),
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error ?? `HTTP ${r.status}`);
      setMsg(`Case study generert: «${payload.case_study.headline}»`);
      setAgencyName(''); setContext('');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Generering feilet');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1.2}>
      {msg ? <Alert severity="info" onClose={() => setMsg(null)}>{msg}</Alert> : null}
      <TextField
        label="Byrå-navn"
        value={agencyName}
        onChange={(e) => setAgencyName(e.target.value)}
        size="small"
        fullWidth
        sx={fieldSx}
      />
      <TextField
        label="Kontekst (hva har de oppnådd? hvilke utfordringer?)"
        value={context}
        onChange={(e) => setContext(e.target.value)}
        size="small"
        multiline
        minRows={2}
        fullWidth
        sx={fieldSx}
      />
      <Button
        onClick={generate}
        disabled={busy || !agencyName.trim()}
        startIcon={busy ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <AutoAwesomeOutlinedIcon />}
        sx={{
          background: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
          color: '#fff',
          textTransform: 'none',
          fontWeight: 700,
          alignSelf: 'flex-start',
        }}
      >
        Generer case study med Claude
      </Button>
    </Stack>
  );
}

// ── LinkedIn-publish-seksjon ──────────────────────────────────────
interface LinkedInStatus {
  configured: boolean;
  client_id_set: boolean;
  client_secret_set: boolean;
  redirect_uri: string;
  connections: Array<{
    id: string;
    organization_urn: string;
    vanity_name: string | null;
    display_name: string | null;
    org_type: 'company' | 'showcase';
    parent_display_name: string | null;
    expires_at: string;
    is_default: boolean;
    last_publish_at: string | null;
    last_error: string | null;
    last_error_at: string | null;
    scopes: string[];
  }>;
}

function LinkedInPublishSection() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await fetch('/api/admin-room/cockpit/linkedin/status', { credentials: 'include' });
      if (r.ok) setStatus(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // URL-callback-detect: ?linkedin=connected
    const params = new URLSearchParams(window.location.search);
    const linkedinParam = params.get('linkedin');
    if (linkedinParam === 'connected') {
      const count = params.get('count') ?? '0';
      setMsg({ tone: 'success', text: `LinkedIn koblet — ${count} org(er) lagret.` });
      void reload();
    } else if (linkedinParam === 'error') {
      const reason = params.get('reason') ?? 'ukjent';
      setMsg({ tone: 'error', text: `LinkedIn-feil: ${reason}` });
    }
  }, [reload]);

  const connect = async () => {
    setMsg(null);
    try {
      const r = await fetch('/api/admin-room/cockpit/linkedin/oauth-start', { credentials: 'include' });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error ?? `HTTP ${r.status}`);
      window.location.href = payload.redirect_url;
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'OAuth-start feilet' });
    }
  };

  const setDefault = async (id: string) => {
    setMsg(null);
    try {
      const r = await fetch(`/api/admin-room/cockpit/linkedin/orgs/${id}/default`, {
        method: 'PATCH', credentials: 'include',
      });
      if (!r.ok) {
        const p = await r.json();
        throw new Error(p.error ?? `HTTP ${r.status}`);
      }
      setMsg({ tone: 'success', text: 'Default oppdatert.' });
      await reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Feilet' });
    }
  };

  const refreshToken = async (id: string) => {
    setMsg(null);
    try {
      const r = await fetch(`/api/admin-room/cockpit/linkedin/orgs/${id}/refresh`, {
        method: 'POST', credentials: 'include',
      });
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error ?? `HTTP ${r.status}`);
      setMsg({ tone: 'success', text: `Token fornyet (${Math.round(payload.expires_in / 3600 / 24)} dager til neste utløp).` });
      await reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Refresh feilet' });
    }
  };

  const disconnect = async (id: string) => {
    if (!window.confirm('Fjerne kobling? Du kan koble på nytt senere.')) return;
    setMsg(null);
    try {
      const r = await fetch(`/api/admin-room/cockpit/linkedin/orgs/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!r.ok) {
        const p = await r.json();
        throw new Error(p.error ?? `HTTP ${r.status}`);
      }
      setMsg({ tone: 'success', text: 'Fjernet.' });
      await reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Fjern feilet' });
    }
  };

  if (loading) {
    return <CircularProgress size={20} sx={{ color: '#c084fc' }} />;
  }

  return (
    <Stack spacing={1.6}>
      {msg ? <Alert severity={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Alert> : null}

      {!status?.configured ? (
        <Alert severity="warning">
          <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', mb: 0.4 }}>
            Mangler LinkedIn-app-konfig
          </Typography>
          <Typography sx={{ fontSize: '0.84rem' }}>
            Sett <code>LINKEDIN_CLIENT_ID</code> + <code>LINKEDIN_CLIENT_SECRET</code> på Render.
            Lag en app i{' '}
            <a href="https://developer.linkedin.com/" target="_blank" rel="noreferrer"
               style={{ color: '#c084fc' }}>
              LinkedIn Developer Portal
            </a>
            {' '}med scopes: <code>r_organization_admin</code>, <code>w_organization_social</code>,
            {' '}<code>r_basicprofile</code>. Redirect-URI: <code>{status?.redirect_uri ?? ''}</code>
          </Typography>
        </Alert>
      ) : null}

      {(status?.connections ?? []).length === 0 ? (
        <Stack spacing={1.2}>
          <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.88rem', lineHeight: 1.55 }}>
            Klikk «Koble LinkedIn» for å starte OAuth-flyten. Du blir sendt til LinkedIn,
            logger inn (én gang), og kommer tilbake med Creatorhub AS + The Role Room
            Showcase Page automatisk koblet.
          </Typography>
          <Button
            onClick={connect}
            disabled={!status?.configured}
            startIcon={<ShareOutlinedIcon />}
            sx={{
              background: '#0a66c2', // LinkedIn-blå
              color: '#fff',
              textTransform: 'none',
              fontWeight: 700,
              alignSelf: 'flex-start',
              px: 2.4, py: 1.2,
              '&:hover': { background: '#085bab' },
              '&.Mui-disabled': { background: 'rgba(10,102,194,0.3)', color: 'rgba(255,255,255,0.5)' },
            }}
          >
            Koble LinkedIn
          </Button>
        </Stack>
      ) : (
        <Stack spacing={1.2}>
          {(Array.isArray(status?.connections) ? status.connections : []).map((conn) => {
            const expiresAt = new Date(conn.expires_at);
            const daysLeft = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const isExpiringSoon = daysLeft < 7;
            return (
              <Box
                key={conn.id}
                sx={{
                  bgcolor: conn.is_default ? 'rgba(168,85,247,0.10)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${conn.is_default ? 'rgba(168,85,247,0.45)' : 'rgba(168,85,247,0.18)'}`,
                  borderRadius: 1.4,
                  p: 1.8,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.2}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontWeight: 700, color: '#f5f3ff', fontSize: '0.94rem' }}>
                        {conn.display_name ?? conn.vanity_name ?? conn.organization_urn}
                      </Typography>
                      <Chip
                        label={conn.org_type === 'showcase' ? 'Showcase' : 'Company'}
                        size="small"
                        sx={{
                          bgcolor: conn.org_type === 'showcase'
                            ? 'rgba(217,70,239,0.20)' : 'rgba(96,165,250,0.20)',
                          color: conn.org_type === 'showcase' ? '#e879f9' : '#60a5fa',
                          fontWeight: 700, fontSize: '0.7rem', height: 20,
                        }}
                      />
                      {conn.is_default ? (
                        <Chip label="DEFAULT" size="small"
                          sx={{ bgcolor: 'rgba(52,211,153,0.20)', color: '#34d399',
                                fontWeight: 700, fontSize: '0.7rem', height: 20 }} />
                      ) : null}
                    </Stack>
                    {conn.parent_display_name ? (
                      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.78rem', mt: 0.3 }}>
                        Parent: {conn.parent_display_name}
                      </Typography>
                    ) : null}
                    <Typography sx={{ color: isExpiringSoon ? '#fbbf24' : 'rgba(148,163,184,0.7)', fontSize: '0.74rem', mt: 0.4 }}>
                      Token utløper {daysLeft > 0 ? `om ${daysLeft} dager` : `for ${Math.abs(daysLeft)} dager siden`}
                    </Typography>
                    {conn.last_error ? (
                      <Typography sx={{ color: '#f87171', fontSize: '0.74rem', mt: 0.4 }}>
                        Siste feil: {conn.last_error.slice(0, 100)}
                      </Typography>
                    ) : null}
                  </Box>
                  <Stack direction="row" spacing={0.6}>
                    {!conn.is_default ? (
                      <Button
                        onClick={() => setDefault(conn.id)}
                        size="small"
                        sx={{ textTransform: 'none', fontSize: '0.78rem',
                              color: '#c084fc', minWidth: 0 }}
                      >
                        Sett default
                      </Button>
                    ) : null}
                    <Button
                      onClick={() => refreshToken(conn.id)}
                      size="small"
                      sx={{ textTransform: 'none', fontSize: '0.78rem',
                            color: '#fbbf24', minWidth: 0 }}
                    >
                      Forny
                    </Button>
                    <Button
                      onClick={() => disconnect(conn.id)}
                      size="small"
                      sx={{ textTransform: 'none', fontSize: '0.78rem',
                            color: '#f87171', minWidth: 0 }}
                    >
                      Fjern
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
          <Button
            onClick={connect}
            startIcon={<ShareOutlinedIcon />}
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              color: '#0a66c2',
              border: '1px solid #0a66c2',
              fontWeight: 700,
              px: 2, py: 0.8,
              '&:hover': { bgcolor: 'rgba(10,102,194,0.10)' },
            }}
          >
            Koble en til
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

const fieldSx = {
  '& .MuiInputBase-input': { color: '#f5f3ff', fontSize: '0.86rem' },
  '& .MuiInputLabel-root': { color: 'rgba(148,163,184,0.85)', fontSize: '0.84rem' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(168,85,247,0.18)' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(168,85,247,0.40)' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#c084fc' },
} as const;
