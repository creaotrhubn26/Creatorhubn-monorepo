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
import { useCallback, useEffect, useState } from 'react';

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

  const reload = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin-room/cockpit/b2b/funnel', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as FunnelStats;
      setFunnel(data);
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
  const totalLeads = Object.values(funnel.funnel).reduce((a, b) => a + b, 0);
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

      {/* Recent leads */}
      <Section
        title={`Nyeste leads (${funnel.recent.length})`}
        Icon={AutoAwesomeOutlinedIcon}
        open={openSection === 'leads'}
        onToggle={() => toggle('leads')}
      >
        <Stack spacing={1}>
          {funnel.recent.map((lead) => (
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
          {funnel.recent.length === 0 ? (
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
function LinkedInPublishSection() {
  return (
    <Stack spacing={1.2}>
      <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.88rem', lineHeight: 1.55 }}>
        LinkedIn Company auto-publish er nå koblet til drafts-flowen. Når du
        har en draft med <code>platform=linkedin</code>, klikk «Publiser» i
        eksisterende PostDraftsPanel — den går rett til LinkedIn Company-page
        (krever <code>LINKEDIN_ACCESS_TOKEN</code> + <code>LINKEDIN_COMPANY_URN</code> env-vars).
      </Typography>
      <Typography sx={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.78rem', fontStyle: 'italic' }}>
        Endepunkt: POST /api/admin-room/cockpit/linkedin/publish/:draftId
      </Typography>
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
