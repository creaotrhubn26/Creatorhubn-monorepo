/**
 * MarketingCockpitTab — Marketing cockpit for The Role Room brand Page.
 *
 * Fetches /api/role-room/marketing-cockpit/summary which aggregates the 8
 * Meta Graph API permissions we own: page profile, mentions, CTA, IG
 * profile, upcoming events, leads, hashtag stats.
 *
 * Per-section graceful degradation: if Meta returns an error for one
 * section, that section shows an error chip while the rest renders.
 *
 * data-testid attributes on every actionable element so the Playwright
 * e2e test can drive this deterministically.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress, Stack, Typography,
  Button, Divider, Link as MuiLink, TextField, MenuItem,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import TagIcon from '@mui/icons-material/Tag';
import CampaignIcon from '@mui/icons-material/Campaign';
import EventIcon from '@mui/icons-material/Event';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CompetitorsPanel from './CompetitorsPanel';
import B2BAcquisitionPanel from './B2BAcquisitionPanel';
import AgencyAcquisitionDashboard from './AgencyAcquisitionDashboard';
import MarketingCockpitTiktokSection from '../../components/admin-room/marketing-cockpit/MarketingCockpitTiktokSection';
import CompetitorReportPanel from './CompetitorReportPanel';
import PostDraftsPanel from './PostDraftsPanel';
import SocialConnectionsPanel from './SocialConnectionsPanel';

interface Section<T> { ok: boolean; data: T | null; error?: string; status?: number; }

interface CockpitSummary {
  ok: boolean;
  generatedAt: string;
  durationMs: number;
  configured: {
    pageId: boolean;
    pageToken: boolean;
    igUserId: boolean;
    trackedHashtags: string[];
  };
  profile: Section<{
    id: string;
    name: string | null;
    about: string | null;
    fanCount: number;
    category: string | null;
    website: string | null;
    phone: string | null;
    pictureUrl: string | null;
  }>;
  mentions: Section<{
    count: number;
    recent: Array<{
      id: string;
      fromName: string | null;
      message: string;
      createdTime: string | null;
      permalinkUrl: string | null;
    }>;
  }>;
  cta: Section<{
    inferred: { type: string; link: string } | null;
    rawFields: { phone: string | null; website: string | null };
  }>;
  ig: Section<{
    userId: string;
    username: string | null;
    name: string | null;
    biography: string | null;
    followersCount: number;
    mediaCount: number;
    upcomingEvents: Array<{ id: string; title: string; startTime: string | null }>;
    upcomingEventsOk: boolean;
  }>;
  leads: Section<{
    formCount: number;
    forms: Array<{ id: string; name: string | null; status: string | null; leadsCount: number }>;
  }>;
  hashtags: Section<{
    tracked: Array<{ tag: string; hashtagId: string | null; recentMediaCount: number; ok?: boolean; error?: string }>;
  }>;
}

const PANEL_SX = {
  background: 'rgba(2,6,23,0.42)',
  border: '1px solid rgba(148,163,184,0.18)',
  color: '#e2e8f0',
} as const;

function SectionHeader({
  icon, title, sectionOk, testid,
}: { icon: React.ReactNode; title: string; sectionOk: boolean; testid: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }} data-testid={`${testid}-header`}>
      {icon}
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e2e8f0' }}>{title}</Typography>
      {sectionOk ? (
        <Chip size="small" label="LIVE" data-testid={`${testid}-status`}
          sx={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', fontSize: '0.65rem', height: 18 }} />
      ) : (
        <Chip size="small" icon={<ReportProblemIcon sx={{ color: '#f87171 !important', fontSize: '0.7rem' }} />}
          label="DEGRADED" data-testid={`${testid}-status`}
          sx={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontSize: '0.65rem', height: 18 }} />
      )}
    </Stack>
  );
}

function ErrorBody({ section }: { section: Section<unknown> }) {
  return (
    <Box sx={{ p: 1.5, background: 'rgba(239,68,68,0.08)', borderRadius: 1, fontSize: '0.78rem', color: '#fca5a5' }}>
      {section.error || 'Section failed.'}
      {section.status ? ` (status ${section.status})` : ''}
    </Box>
  );
}

const CTA_TYPES = [
  'BOOK_NOW', 'CALL_NOW', 'CONTACT_US', 'LEARN_MORE',
  'MESSAGE_PAGE', 'SHOP_NOW', 'SIGN_UP', 'USE_APP', 'WATCH_NOW',
] as const;

function CampaignActionsPanel({ onAction }: { onAction: () => void }) {
  // CTA-flipper state
  const [ctaType, setCtaType] = useState<string>('LEARN_MORE');
  const [ctaUrl, setCtaUrl] = useState<string>('https://theroleroom.com');
  const [ctaBusy, setCtaBusy] = useState(false);
  const [ctaNotice, setCtaNotice] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  // Event-publisher state
  const defaultStart = useMemo(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setMinutes(0, 0, 0);
    return d.toISOString().slice(0, 16);
  }, []);
  const [evtTitle, setEvtTitle] = useState<string>('');
  const [evtStart, setEvtStart] = useState<string>(defaultStart);
  const [evtEnd, setEvtEnd] = useState<string>('');
  const [evtVenue, setEvtVenue] = useState<string>('');
  const [evtDescription, setEvtDescription] = useState<string>('');
  const [evtBusy, setEvtBusy] = useState(false);
  const [evtNotice, setEvtNotice] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const applyCta = useCallback(async () => {
    setCtaBusy(true); setCtaNotice(null);
    try {
      const r = await fetch('/api/role-room/marketing-cockpit/actions/set-cta', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctaType, ctaUrl }),
      });
      const d = await r.json();
      if (d.ok) {
        setCtaNotice({ kind: 'success', msg: `CTA ${ctaType} → ${ctaUrl} satt på Page-en. ${d.note || ''}` });
        onAction();
      } else {
        setCtaNotice({ kind: 'error', msg: d.error || d.note || 'Set CTA failed' });
      }
    } catch (err) {
      setCtaNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setCtaBusy(false);
    }
  }, [ctaType, ctaUrl, onAction]);

  const publishEvent = useCallback(async () => {
    if (!evtTitle.trim() || !evtStart) {
      setEvtNotice({ kind: 'error', msg: 'Title + start-time påkrevd.' });
      return;
    }
    setEvtBusy(true); setEvtNotice(null);
    try {
      const r = await fetch('/api/role-room/marketing-cockpit/actions/publish-event', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: evtTitle.trim(),
          startTime: new Date(evtStart).toISOString(),
          endTime: evtEnd ? new Date(evtEnd).toISOString() : undefined,
          venueName: evtVenue.trim() || undefined,
          description: evtDescription.trim() || undefined,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setEvtNotice({ kind: 'success', msg: `Event publisert på @theroleroom IG. ID: ${d.eventId}` });
        setEvtTitle(''); setEvtVenue(''); setEvtDescription('');
        onAction();
      } else {
        setEvtNotice({ kind: 'error', msg: d.error || 'Publish event failed' });
      }
    } catch (err) {
      setEvtNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setEvtBusy(false);
    }
  }, [evtTitle, evtStart, evtEnd, evtVenue, evtDescription, onAction]);

  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      {/* CTA-flipper */}
      <Card sx={{ background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(251,191,36,0.32)', color: '#e2e8f0' }} data-testid="panel-cta-action">
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <CampaignIcon sx={{ color: '#fbbf24', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Sett CTA på Page</Typography>
          </Stack>
          <Stack spacing={1.5}>
            <TextField
              select size="small" label="CTA-type" value={ctaType} onChange={(e) => setCtaType(e.target.value)}
              data-testid="cta-type-select" SelectProps={{ inputProps: { 'data-testid': 'cta-type-input' } }}
              sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: 'rgba(203,213,225,0.6)' } }}
            >
              {CTA_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <TextField
              size="small" label="CTA-link" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://theroleroom.com/audition/lead"
              data-testid="cta-url-input"
              sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: 'rgba(203,213,225,0.6)' } }}
            />
            <Button
              variant="contained" startIcon={<RocketLaunchIcon />}
              onClick={() => void applyCta()} disabled={ctaBusy}
              data-testid="cta-apply-button"
              sx={{ background: 'rgba(251,191,36,0.25)', color: '#fde68a', '&:hover': { background: 'rgba(251,191,36,0.4)' } }}
            >
              {ctaBusy ? 'Setter…' : 'Sett CTA på The Role Room Page'}
            </Button>
          </Stack>
          {ctaNotice && (
            <Alert severity={ctaNotice.kind} sx={{ mt: 1.5 }} onClose={() => setCtaNotice(null)} data-testid="cta-notice">
              {ctaNotice.msg}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Event-publisher */}
      <Card sx={{ background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(249,115,22,0.32)', color: '#e2e8f0' }} data-testid="panel-event-action">
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <EventIcon sx={{ color: '#f97316', fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Publiser IG event</Typography>
          </Stack>
          <Stack spacing={1.2}>
            <TextField
              size="small" label="Event title" value={evtTitle} onChange={(e) => setEvtTitle(e.target.value)}
              placeholder="Open Casting Call — Nordlys Lead"
              data-testid="event-title-input"
              sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: 'rgba(203,213,225,0.6)' } }}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                size="small" type="datetime-local" label="Start" value={evtStart}
                onChange={(e) => setEvtStart(e.target.value)} fullWidth
                InputLabelProps={{ shrink: true }} data-testid="event-start-input"
                sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: 'rgba(203,213,225,0.6)' } }}
              />
              <TextField
                size="small" type="datetime-local" label="End (optional)" value={evtEnd}
                onChange={(e) => setEvtEnd(e.target.value)} fullWidth
                InputLabelProps={{ shrink: true }} data-testid="event-end-input"
                sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: 'rgba(203,213,225,0.6)' } }}
              />
            </Stack>
            <TextField
              size="small" label="Venue (optional)" value={evtVenue} onChange={(e) => setEvtVenue(e.target.value)}
              placeholder="Filmens Hus, Oslo"
              data-testid="event-venue-input"
              sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: 'rgba(203,213,225,0.6)' } }}
            />
            <TextField
              size="small" multiline minRows={2} label="Description (optional)"
              value={evtDescription} onChange={(e) => setEvtDescription(e.target.value)}
              data-testid="event-description-input"
              sx={{ '& .MuiInputBase-root': { color: '#e2e8f0' }, '& .MuiInputLabel-root': { color: 'rgba(203,213,225,0.6)' } }}
            />
            <Button
              variant="contained" startIcon={<RocketLaunchIcon />}
              onClick={() => void publishEvent()} disabled={evtBusy}
              data-testid="event-publish-button"
              sx={{ background: 'rgba(249,115,22,0.25)', color: '#fed7aa', '&:hover': { background: 'rgba(249,115,22,0.4)' } }}
            >
              {evtBusy ? 'Publiserer…' : 'Publiser til @theroleroom IG'}
            </Button>
          </Stack>
          {evtNotice && (
            <Alert severity={evtNotice.kind} sx={{ mt: 1.5 }} onClose={() => setEvtNotice(null)} data-testid="event-notice">
              {evtNotice.msg}
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default function MarketingCockpitTab() {
  const [data, setData] = useState<CockpitSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Browser-side cookie-auth carries admin session.
      const resp = await fetch('/api/role-room/marketing-cockpit/summary', { credentials: 'include' });
      if (!resp.ok) throw new Error(`Status ${resp.status}: ${await resp.text()}`);
      const body = await resp.json();
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const topMetrics = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: 'fans',
        label: 'Page-følgere',
        value: data.profile.ok ? data.profile.data?.fanCount ?? 0 : '?',
        ok: data.profile.ok,
      },
      {
        key: 'mentions',
        label: 'Tagged mentions',
        value: data.mentions.ok ? data.mentions.data?.count ?? 0 : '?',
        ok: data.mentions.ok,
      },
      {
        key: 'ig-followers',
        label: 'IG-følgere',
        value: data.ig.ok ? data.ig.data?.followersCount ?? 0 : '?',
        ok: data.ig.ok,
      },
      {
        key: 'leads',
        label: 'Lead-former',
        value: data.leads.ok ? data.leads.data?.formCount ?? 0 : '?',
        ok: data.leads.ok,
      },
    ];
  }, [data]);

  return (
    <Stack spacing={2} data-testid="marketing-cockpit-root">
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="h6" sx={{ color: '#e2e8f0' }}>Marketing Cockpit — The Role Room</Typography>
        <Button
          size="small" startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
          data-testid="cockpit-refresh"
          sx={{ color: '#7dd3fc' }}
        >
          {loading ? 'Henter…' : 'Refresh'}
        </Button>
        {data && (
          <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)', ml: 'auto' }}>
            Sist oppdatert {new Date(data.generatedAt).toLocaleTimeString('nb-NO')} ({data.durationMs}ms)
          </Typography>
        )}
      </Stack>

      {error && (
        <Alert severity="error" data-testid="cockpit-error">{error}</Alert>
      )}

      {!data && loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }} data-testid="cockpit-loading">
          <CircularProgress size={32} />
        </Box>
      )}

      {/* SocialConnectionsPanel — hoistet ut av {data && ...}-blokken slik
          at den vises selv om cockpit-summary feiler (auth, network). Panelet
          gjør sine egne fetches og er ikke avhengig av parent-data. */}
      <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }}>
        <Chip label="SOSIALE KOBLINGER" size="small"
          sx={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', fontSize: '0.7rem' }} />
      </Divider>
      <SocialConnectionsPanel />

      {data && (
        <>
          {!data.configured.pageId && (
            <Alert severity="warning" data-testid="cockpit-not-configured">
              THEROLERROOM_PAGE_ID/TOKEN/IG_USER_ID må settes på Render. Cockpit kjører i degradert modus.
            </Alert>
          )}

          {/* TOP METRICS */}
          <Box
            sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' } }}
            data-testid="cockpit-top-metrics"
          >
            {topMetrics.map((m) => (
              <Card key={m.key} sx={PANEL_SX} data-testid={`metric-${m.key}`}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>{m.label}</Typography>
                  <Typography variant="h4" sx={{ color: m.ok ? '#e2e8f0' : '#fca5a5', fontWeight: 700, mt: 0.5 }}>
                    {m.value}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>

          {/* PROFILE + CTA */}
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
            <Card sx={PANEL_SX} data-testid="panel-profile">
              <CardContent sx={{ p: 2 }}>
                <SectionHeader icon={<FacebookIcon sx={{ color: '#60a5fa', fontSize: 20 }} />}
                  title="Facebook Page" sectionOk={data.profile.ok} testid="profile" />
                {!data.profile.ok ? <ErrorBody section={data.profile} /> : data.profile.data && (
                  <Stack spacing={0.5}>
                    <Typography sx={{ fontWeight: 600 }}>{data.profile.data.name}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>
                      Kategori: {data.profile.data.category || '–'} · Fan count: {data.profile.data.fanCount}
                    </Typography>
                    {data.profile.data.website && (
                      <MuiLink href={data.profile.data.website} target="_blank" rel="noopener"
                        sx={{ color: '#7dd3fc', fontSize: '0.82rem' }} data-testid="profile-website">
                        {data.profile.data.website}
                      </MuiLink>
                    )}
                    {data.profile.data.about && (
                      <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.8)', mt: 1 }}>
                        {data.profile.data.about}
                      </Typography>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card sx={PANEL_SX} data-testid="panel-cta">
              <CardContent sx={{ p: 2 }}>
                <SectionHeader icon={<CampaignIcon sx={{ color: '#fbbf24', fontSize: 20 }} />}
                  title="Page-CTA" sectionOk={data.cta.ok} testid="cta" />
                {!data.cta.ok ? <ErrorBody section={data.cta} /> : (
                  <Stack spacing={0.5}>
                    {data.cta.data?.inferred ? (
                      <>
                        <Chip label={data.cta.data.inferred.type}
                          sx={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontWeight: 700, alignSelf: 'flex-start' }} />
                        <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)', mt: 0.5 }}>
                          → {data.cta.data.inferred.link}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.6)' }}>
                        Ingen CTA satt. Legg til phone eller website på Page-en.
                      </Typography>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* MENTIONS + LEADS */}
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <Card sx={PANEL_SX} data-testid="panel-mentions">
              <CardContent sx={{ p: 2 }}>
                <SectionHeader icon={<TagIcon sx={{ color: '#a78bfa', fontSize: 20 }} />}
                  title="Mentions" sectionOk={data.mentions.ok} testid="mentions" />
                {!data.mentions.ok ? <ErrorBody section={data.mentions} /> :
                  data.mentions.data && data.mentions.data.recent.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.5)' }}>
                      Ingen mentions ennå. Når noen tagger @theroleroom-Page-en, vises de her.
                    </Typography>
                  ) : data.mentions.data?.recent.map((m) => (
                    <Box key={m.id} sx={{ py: 1, borderBottom: '1px solid rgba(148,163,184,0.10)' }} data-testid="mention-row">
                      <Typography variant="caption" sx={{ color: '#a78bfa', fontWeight: 600 }}>
                        {m.fromName || '(unknown)'} · {m.createdTime ? new Date(m.createdTime).toLocaleDateString('nb-NO') : ''}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.85)', mt: 0.3 }}>
                        {m.message.slice(0, 160)}{m.message.length > 160 ? '…' : ''}
                      </Typography>
                    </Box>
                  ))}
              </CardContent>
            </Card>

            <Card sx={PANEL_SX} data-testid="panel-leads">
              <CardContent sx={{ p: 2 }}>
                <SectionHeader icon={<CampaignIcon sx={{ color: '#22d3ee', fontSize: 20 }} />}
                  title="Lead-former" sectionOk={data.leads.ok} testid="leads" />
                {!data.leads.ok ? <ErrorBody section={data.leads} /> :
                  data.leads.data && data.leads.data.forms.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.5)' }}>
                      Ingen Lead Ad-former. Når du kjører Lead Ads på The Role Room Page, vises de her.
                    </Typography>
                  ) : data.leads.data?.forms.map((f) => (
                    <Stack key={f.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }} data-testid="lead-form-row">
                      <Chip size="small" label={f.status || 'unknown'}
                        sx={{
                          background: f.status === 'ACTIVE' ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                          color: f.status === 'ACTIVE' ? '#86efac' : '#cbd5e1',
                          fontSize: '0.62rem', height: 16,
                        }} />
                      <Typography variant="body2" sx={{ color: '#e2e8f0', flex: 1 }}>{f.name || '(unnamed)'}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>{f.leadsCount} leads</Typography>
                    </Stack>
                  ))}
              </CardContent>
            </Card>
          </Box>

          {/* IG + EVENTS */}
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            <Card sx={PANEL_SX} data-testid="panel-ig">
              <CardContent sx={{ p: 2 }}>
                <SectionHeader icon={<InstagramIcon sx={{ color: '#ec4899', fontSize: 20 }} />}
                  title="Instagram Business" sectionOk={data.ig.ok} testid="ig" />
                {!data.ig.ok ? <ErrorBody section={data.ig} /> : data.ig.data && (
                  <Stack spacing={0.5}>
                    <Typography sx={{ fontWeight: 600 }}>@{data.ig.data.username || '?'}</Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>
                      {data.ig.data.followersCount} følgere · {data.ig.data.mediaCount} posts
                    </Typography>
                    {data.ig.data.biography && (
                      <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.8)', mt: 1, whiteSpace: 'pre-wrap' }}>
                        {data.ig.data.biography}
                      </Typography>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card sx={PANEL_SX} data-testid="panel-events">
              <CardContent sx={{ p: 2 }}>
                <SectionHeader icon={<EventIcon sx={{ color: '#f97316', fontSize: 20 }} />}
                  title="IG upcoming events" sectionOk={data.ig.ok} testid="events" />
                {!data.ig.ok ? <ErrorBody section={data.ig} /> :
                  data.ig.data && data.ig.data.upcomingEvents.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.5)' }}>
                      Ingen kommende IG-events. Publiser kasting-events, demo-dager eller premiere-screenings her.
                    </Typography>
                  ) : data.ig.data?.upcomingEvents.map((e) => (
                    <Stack key={e.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }} data-testid="event-row">
                      <Typography variant="body2" sx={{ color: '#e2e8f0', flex: 1 }}>{e.title}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)' }}>
                        {e.startTime ? new Date(e.startTime).toLocaleDateString('nb-NO') : '?'}
                      </Typography>
                    </Stack>
                  ))}
              </CardContent>
            </Card>
          </Box>

          {/* HASHTAGS */}
          <Card sx={PANEL_SX} data-testid="panel-hashtags">
            <CardContent sx={{ p: 2 }}>
              <SectionHeader icon={<TagIcon sx={{ color: '#22c55e', fontSize: 20 }} />}
                title="Hashtag-tracker" sectionOk={data.hashtags.ok} testid="hashtags" />
              {!data.hashtags.ok ? <ErrorBody section={data.hashtags} /> : data.hashtags.data && (
                <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
                  {data.hashtags.data.tracked.map((t) => (
                    <Stack key={t.tag} direction="row" alignItems="center" spacing={1}
                      sx={{ p: 1, background: 'rgba(2,6,23,0.40)', borderRadius: 1 }} data-testid="hashtag-row">
                      <Typography sx={{ color: '#22c55e', fontWeight: 600, fontSize: '0.85rem' }}>#{t.tag}</Typography>
                      <Box sx={{ flex: 1 }} />
                      {t.hashtagId ? (
                        <Chip size="small" label={`${t.recentMediaCount} posts`}
                          sx={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', fontSize: '0.65rem', height: 18 }} />
                      ) : (
                        <Chip size="small" label={t.error ? 'error' : 'no posts'}
                          sx={{ background: 'rgba(148,163,184,0.15)', color: 'rgba(203,213,225,0.7)', fontSize: '0.65rem', height: 18 }} />
                      )}
                    </Stack>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }}>
            <Chip label="KONKURRENT-INTELLIGENCE" size="small"
              sx={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd', fontSize: '0.7rem' }} />
          </Divider>

          <CompetitorReportPanel />
          <PostDraftsPanel />
          <CompetitorsPanel />

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }}>
            <Chip label="CAMPAIGN ACTIONS" size="small"
              sx={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: '0.7rem' }} />
          </Divider>

          <CampaignActionsPanel onAction={() => void load()} />

          {/* TikTok — The Role Rooms egen markedsføring */}
          <MarketingCockpitTiktokSection />

          <Divider sx={{ borderColor: 'rgba(168,85,247,0.32)' }}>
            <Chip label="B2B-AKKVISISJON" size="small"
              sx={{ background: 'rgba(217,70,239,0.18)', color: '#e879f9', fontSize: '0.7rem', fontWeight: 700 }} />
          </Divider>

          <AgencyAcquisitionDashboard />
          <B2BAcquisitionPanel />

          <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.4)', textAlign: 'center' }}>
            Konfigurasjon: pageId={data.configured.pageId ? '✓' : '✗'} · pageToken={data.configured.pageToken ? '✓' : '✗'} ·
            igUserId={data.configured.igUserId ? '✓' : '✗'} · {data.configured.trackedHashtags.length} hashtags trackes
          </Typography>
        </>
      )}
    </Stack>
  );
}
