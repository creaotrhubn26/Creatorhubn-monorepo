/**
 * MarketingPlanPanel — The Role Room's Marketing Plan Engine surface.
 *
 * Slice 1: shows readiness gate (flagger manglende bootstrap-felter),
 * "Generer plan"-knapp, og rendret strategi + pillars når en plan
 * finnes. Aktiver-knapp flipper draft → active.
 *
 * Slice 2+ kobler pillars til feed-planner-posts, legger til 30-dagers
 * post-generering og KPI-tracking.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Fade,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type ClientPortalInvite,
  type MarketingPlan,
  type MarketingPlanPost,
  type MarketingPlanReadiness,
  MarketingPlanReadinessError,
  RoleRoomFeedEntitlementError,
} from '../../services/roleRoomAgentService';
import {
  exportMarketingPlanAsPdf,
  exportMarketingPlanAsIcs,
} from '../../utils/marketingPlanExport';
import {
  validateMarketingPlanPosts,
  groupFlagsByPost,
  type PostFlag,
} from '../../utils/marketingPlanPostValidators';
import {
  suggestPublishTime,
  resolveCrosspostSchedule,
  suggestHashtags,
  suggestCtaTemplate,
} from '../../utils/marketingPlanPostHints';
import {
  scoreAllPosts,
  buildDistribution,
  emojiForLabel,
  colorForLabel,
  type PostSentiment,
} from '../../utils/marketingPlanPostSentiment';
import MarketingPlanPostPreview from './MarketingPlanPostPreview';
import { Visibility as VisibilityIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import {
  buildStockSearchLinks,
} from '../../utils/marketingPlanPostExternal';
import {
  Download as DownloadIcon,
  CalendarMonth as CalendarIcon,
  Share as ShareIcon,
  ContentCopy as ContentCopyIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ToggleOn as ToggleOnIcon,
  ToggleOff as ToggleOffIcon,
} from '@mui/icons-material';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import type { RoleRoomAgentProducerBootstrapResult } from '../../services/roleRoomAgentService';
import RoleRoomAgentInsightsBanner from './RoleRoomAgentInsightsBanner';
import RoleRoomAgentApprovalsWidget from './RoleRoomAgentApprovalsWidget';

interface MarketingPlanPanelProps {
  projectId: string;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  onEntitlementBlocked?: (message: string) => void;
}

const HUMAN_FIELD: Record<string, string> = {
  'companyProfile.companyName': 'Firmanavn',
  'companyProfile.industry': 'Bransje',
  'companyProfile.targetAudience': 'Målgruppe',
  'companyProfile.toneAndBrandSignals (minst 3)': 'Tone of voice (minst 3 signaler)',
  'storyLogicDraft.contentStoryLogic.businessObjective': 'Forretningsmål',
  'storyLogicDraft.contentStoryLogic.audienceProblem': 'Publikumsbehov',
  'storyLogicDraft.contentStoryLogic.keyPromise': 'Hovedløfte',
};

function humaniseField(field: string): string {
  return HUMAN_FIELD[field] ?? field;
}

export default function MarketingPlanPanel({
  projectId,
  bootstrap,
  onEntitlementBlocked,
}: MarketingPlanPanelProps) {
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [posts, setPosts] = useState<MarketingPlanPost[]>([]);
  const [readiness, setReadiness] = useState<MarketingPlanReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingPosts, setGeneratingPosts] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // #129 — three-tab restructure. Default to strategi-fanen; deeplink via
  // URL hash (#marketing-plan/pillars) supported via useEffect below.
  const [activeTab, setActiveTab] = useState<'strategy' | 'pillars' | 'posts'>('strategy');
  // #126 — Plan Reveal animation: tracks whether the currently shown plan
  // was just generated this session. Resets on plan-id change so re-mount
  // doesn't re-animate. Sections opacity-fade in with staggered delays.
  const [revealForPlanId, setRevealForPlanId] = useState<string | null>(null);
  // #150 — Plan Activated-banner: shows for 3s after handleActivate
  // resolves successfully, then auto-dismisses.
  const [activatedBannerVisible, setActivatedBannerVisible] = useState(false);
  // #29 — Sticky CTA: only show after header scrolls out of view.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [stickyCtaVisible, setStickyCtaVisible] = useState(false);
  // #130 — share-link state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Pull current plan (if any) on mount + whenever projectId changes.
  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setPlan(null);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const existing = await roleRoomAgentService.getMarketingPlan(projectId);
        if (cancelled) return;
        setPlan(existing);
        if (existing) {
          const existingPosts = await roleRoomAgentService.listMarketingPlanPosts(existing.id);
          if (!cancelled) setPosts(existingPosts);
        } else {
          setPosts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Evaluate readiness whenever bootstrap changes — lets the button
  // enable/disable in sync with the Research-tab state without a round-
  // trip on every keystroke.
  useEffect(() => {
    if (!bootstrap) {
      setReadiness({ ready: false, missingFields: ['Kjør research-analysen først'], hasInstagramConnection: false });
      return;
    }
    let cancelled = false;
    (async () => {
      const check = await roleRoomAgentService.checkMarketingPlanReadiness(bootstrap);
      if (!cancelled && check) setReadiness(check);
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap]);

  // #129 — sync activeTab with URL hash for shareable deep-links.
  useEffect(() => {
    const m = /[#&]plan-tab=(strategy|pillars|posts)/.exec(window.location.hash);
    if (m) setActiveTab(m[1] as typeof activeTab);
  }, []);

  // #29 — observe header to drive sticky CTA visibility. When the header
  // scrolls out of view AND the plan is in draft, show the bottom bar.
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setStickyCtaVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [plan?.id]);

  // #150 — auto-dismiss activated banner after 3s.
  useEffect(() => {
    if (!activatedBannerVisible) return;
    const t = setTimeout(() => setActivatedBannerVisible(false), 3000);
    return () => clearTimeout(t);
  }, [activatedBannerVisible]);

  const handleShare = useCallback(async () => {
    if (!plan) return;
    setSharing(true);
    setError(null);
    try {
      const result = await roleRoomAgentService.sharePlanPreview({ planId: plan.id, projectId });
      if (!result) {
        setError('Kunne ikke generere share-link (sjekk admin-session og at ROLE_ROOM_SHARE_SECRET er satt).');
        return;
      }
      setShareUrl(result.shareUrl);
      try {
        await navigator.clipboard.writeText(result.shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch {
        // Clipboard kan være blokkert — URL er synlig i UI uansett
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ukjent feil ved share.');
    } finally {
      setSharing(false);
    }
  }, [plan, projectId]);

  const handleGenerate = useCallback(async () => {
    if (!bootstrap) return;
    setGenerating(true);
    setError(null);
    try {
      const generated = await roleRoomAgentService.generateMarketingPlan({
        projectId,
        bootstrap,
      });
      setPlan(generated);
      setPosts([]); // new plan = old posts archived with it
      // #126 — mark this plan for the reveal animation. Sections fade
      // in sequentially the first time the user sees them.
      setRevealForPlanId(generated.id);
      // Jump to strategi-tab so reveal starts at the top.
      setActiveTab('strategy');
    } catch (caught) {
      if (caught instanceof MarketingPlanReadinessError) {
        setReadiness(caught.readiness);
        setError('Bootstrap mangler felter — se listen under.');
      } else if (caught instanceof RoleRoomFeedEntitlementError) {
        const message = caught.message || 'Markedsplan krever aktiv Role Room-pakke.';
        setError(message);
        onEntitlementBlocked?.(message);
      } else {
        setError(caught instanceof Error ? caught.message : 'Ukjent feil.');
      }
    } finally {
      setGenerating(false);
    }
  }, [bootstrap, projectId, onEntitlementBlocked]);

  const handleGeneratePosts = useCallback(async () => {
    if (!plan) return;
    setGeneratingPosts(true);
    setError(null);
    try {
      const generated = await roleRoomAgentService.generateMarketingPlanPosts({
        planId: plan.id,
        projectId,
      });
      setPosts(generated);
    } catch (caught) {
      if (caught instanceof RoleRoomFeedEntitlementError) {
        const message = caught.message || 'Post-generering krever aktiv Role Room-pakke.';
        setError(message);
        onEntitlementBlocked?.(message);
      } else {
        setError(caught instanceof Error ? caught.message : 'Ukjent feil.');
      }
    } finally {
      setGeneratingPosts(false);
    }
  }, [plan, projectId, onEntitlementBlocked]);

  const handleActivate = useCallback(async () => {
    if (!plan) return;
    setActivating(true);
    setError(null);
    try {
      const activated = await roleRoomAgentService.activateMarketingPlan(plan.id, projectId);
      if (activated) {
        setPlan(activated);
        // #150 — trigger 3s success banner with confetti.
        setActivatedBannerVisible(true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kunne ikke aktivere planen.');
    } finally {
      setActivating(false);
    }
  }, [plan, projectId]);

  const gateMessage = useMemo(() => {
    if (!readiness) return null;
    if (readiness.ready) return null;
    return (
      <Alert
        severity="warning"
        sx={{ bgcolor: 'rgba(250,204,21,0.08)', color: '#fde68a', border: '1px solid rgba(250,204,21,0.25)' }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', mb: 0.6 }}>
          Fyll ut disse før planen kan genereres:
        </Typography>
        <Stack component="ul" spacing={0.3} sx={{ m: 0, pl: 2.4 }}>
          {readiness.missingFields.map((f) => (
            <Typography key={f} component="li" sx={{ fontSize: '0.82rem', color: '#fde68a' }}>
              {humaniseField(f)}
            </Typography>
          ))}
        </Stack>
        {!readiness.hasInstagramConnection ? (
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(253,230,138,0.78)', mt: 1 }}>
            Tips: Instagram-konto er ikke koblet ennå — planen genereres for IG som primær kanal,
            men cross-post-reglene blir degraderte til du kobler en konto.
          </Typography>
        ) : null}
      </Alert>
    );
  }, [readiness]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress sx={{ color: '#22d3ee' }} />
      </Stack>
    );
  }

  return (
    <Stack spacing={1.6}>
      <RoleRoomAgentInsightsBanner />
      <RoleRoomAgentApprovalsWidget />
      <Stack
        ref={headerRef}
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'flex-start' }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.1rem' }}>
            Markedsplan
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.84rem', mt: 0.2 }}>
            Jeg lager en komplett plan for kunden — temaer å poste om, hvilke kanaler, mål, og en 30-dagers plan — basert på det vi fant i Research.
          </Typography>
        </Box>
        <Tooltip
          title={
            plan?.status === 'active'
              ? 'Planen er aktivert og låst. Arkivér den først for å generere en ny.'
              : !readiness?.ready
                ? 'Fullfør Research først, så kan jeg lage planen.'
                : ''
          }
        >
          <span>
            <Button
              variant="contained"
              startIcon={generating ? <CircularProgress size={16} color="inherit" /> : plan?.status === 'active' ? <LockIcon /> : <AutoAwesomeIcon />}
              onClick={handleGenerate}
              disabled={generating || !readiness?.ready || plan?.status === 'active'}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
                flexShrink: 0,
              }}
            >
              {generating
                ? 'Genererer…'
                : plan?.status === 'active'
                  ? 'Planen er låst'
                  : plan
                    ? 'Regenerer'
                    : 'Generer plan'}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {generating ? <LinearProgress sx={{ height: 2 }} /> : null}

      {error ? (
        <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.24)' }}>
          {error}
        </Alert>
      ) : null}

      {gateMessage}

      {shareUrl ? (
        <Alert
          severity="success"
          icon={<ShareIcon fontSize="inherit" />}
          action={
            <Tooltip title={shareCopied ? 'Kopiert' : 'Kopier URL'}>
              <Button
                size="small"
                startIcon={<ContentCopyIcon fontSize="inherit" />}
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl).then(() => {
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2500);
                  });
                }}
                sx={{ textTransform: 'none', color: shareCopied ? '#34d399' : '#cbd5e1' }}
              >
                {shareCopied ? 'Kopiert' : 'Kopier'}
              </Button>
            </Tooltip>
          }
          sx={{ bgcolor: 'rgba(34,197,94,0.08)', color: '#bbf7d0', border: '1px solid rgba(34,197,94,0.32)' }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.84rem' }}>
            Delbar lenke (24t) {shareCopied ? '· kopiert til utklippstavle' : ''}
          </Typography>
          <Typography
            component="code"
            sx={{
              display: 'block',
              fontFamily: 'monospace',
              fontSize: '0.74rem',
              color: 'rgba(226,232,240,0.78)',
              mt: 0.4,
              wordBreak: 'break-all',
            }}
          >
            {shareUrl}
          </Typography>
        </Alert>
      ) : null}

      {plan ? (
        <Stack spacing={1.4}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                icon={plan.status === 'active' ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : undefined}
                label={plan.status === 'active' ? 'Aktiv' : plan.status === 'draft' ? 'Utkast' : 'Arkivert'}
                sx={{
                  bgcolor: plan.status === 'active' ? 'rgba(34,197,94,0.16)' : 'rgba(250,204,21,0.12)',
                  color: plan.status === 'active' ? '#86efac' : '#fde68a',
                  fontWeight: 700,
                }}
              />
              <Chip
                size="small"
                label={`${plan.horizonDays} dager`}
                sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#a5f3fc' }}
              />
              {/* Model name + token/cost telemetry removed from the user-facing
                  card (internal noise); cost is still tracked server-side. */}
            </Stack>
            <Stack direction="row" spacing={0.6} alignItems="center">
              {/* #137 / #139 — eksport-knapper, alltid synlige uavhengig av status. */}
              <Tooltip title="Last ned plan som PDF">
                <Button
                  size="small"
                  startIcon={<DownloadIcon fontSize="small" />}
                  onClick={() =>
                    exportMarketingPlanAsPdf({
                      plan,
                      posts,
                      companyName: bootstrap?.companyProfile?.companyName,
                      brandPrimaryHex: bootstrap?.planningDraft?.brandGuide?.colors?.[0]?.hex,
                      brandAccentHex: bootstrap?.planningDraft?.brandGuide?.colors?.[1]?.hex,
                    })
                  }
                  sx={{ textTransform: 'none', color: '#cbd5e1', fontSize: '0.78rem', minWidth: 0, px: 0.8 }}
                >
                  PDF
                </Button>
              </Tooltip>
              <Tooltip title="Lag delbar lenke (24t TTL) — read-only preview">
                <Button
                  size="small"
                  startIcon={sharing ? <CircularProgress size={12} /> : <ShareIcon fontSize="small" />}
                  onClick={handleShare}
                  disabled={sharing}
                  sx={{ textTransform: 'none', color: '#cbd5e1', fontSize: '0.78rem', minWidth: 0, px: 0.8 }}
                >
                  Del
                </Button>
              </Tooltip>
              <Tooltip title="Eksporter post-roadmap som .ics for Google Calendar / Outlook">
                <Button
                  size="small"
                  startIcon={<CalendarIcon fontSize="small" />}
                  onClick={() =>
                    exportMarketingPlanAsIcs({
                      plan,
                      posts,
                      companyName: bootstrap?.companyProfile?.companyName,
                    })
                  }
                  disabled={posts.length === 0}
                  sx={{ textTransform: 'none', color: '#cbd5e1', fontSize: '0.78rem', minWidth: 0, px: 0.8 }}
                >
                  Kalender
                </Button>
              </Tooltip>
              {plan.status === 'draft' ? (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={activating ? <CircularProgress size={14} /> : <PlayArrowIcon />}
                  onClick={handleActivate}
                  disabled={activating}
                  sx={{
                    textTransform: 'none',
                    color: '#86efac',
                    borderColor: 'rgba(134,239,172,0.4)',
                    '&:hover': { borderColor: '#86efac', bgcolor: 'rgba(34,197,94,0.08)' },
                  }}
                >
                  Aktiver planen
                </Button>
              ) : null}
            </Stack>
          </Stack>

          {/* #129 — three-tab restructure with deep-link support */}
          <Tabs
            value={activeTab}
            onChange={(_, next) => {
              setActiveTab(next);
              try {
                history.replaceState(null, '', `#plan-tab=${next}`);
              } catch {
                // ignore — non-fatal
              }
            }}
            sx={{
              borderBottom: '1px solid rgba(148,163,184,0.12)',
              minHeight: 36,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.86rem',
                minHeight: 36,
                color: 'rgba(226,232,240,0.6)',
                '&.Mui-selected': { color: '#22d3ee' },
              },
              '& .MuiTabs-indicator': { backgroundColor: '#22d3ee' },
            }}
          >
            <Tab value="strategy" label="Strategi" />
            <Tab
              value="pillars"
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <span>Pillars</span>
                  <Chip
                    size="small"
                    label={plan.pillars.length}
                    sx={{ height: 16, fontSize: '0.66rem', bgcolor: 'rgba(34,211,238,0.16)', color: '#a5f3fc' }}
                  />
                </Stack>
              }
            />
            <Tab
              value="posts"
              label={
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <span>Post-roadmap</span>
                  {posts.length > 0 ? (
                    <Chip
                      size="small"
                      label={`${posts.filter((p) => p.feedPlanPostId !== null).length}/${posts.length}`}
                      sx={{ height: 16, fontSize: '0.66rem', bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0', fontFamily: 'monospace' }}
                    />
                  ) : null}
                </Stack>
              }
            />
          </Tabs>

          {/* #126 — Plan Reveal-animasjon: hver fane fade-in når aktiv.
              Stagger delay 0/120/240ms gir en "lag-for-lag"-avsløring av
              planen den første gangen brukeren ser den. */}
          {activeTab === 'strategy' ? (
            <Fade in timeout={400} style={{ transitionDelay: revealForPlanId === plan.id ? '0ms' : '0ms' }}>
              <div>
                <StrategySection strategy={plan.strategy} />
              </div>
            </Fade>
          ) : null}
          {activeTab === 'pillars' ? (
            <Fade in timeout={400} style={{ transitionDelay: revealForPlanId === plan.id ? '120ms' : '0ms' }}>
              <div>
                <PillarsSection
                  pillars={plan.pillars}
                  targetAudience={bootstrap?.companyProfile?.targetAudience}
                  planId={plan.id}
                  locked={plan.status === 'active'}
                  onPillarChanged={(updatedPillars) => {
                    setPlan((curr) => (curr ? { ...curr, pillars: updatedPillars } : curr));
                  }}
                />
              </div>
            </Fade>
          ) : null}
          {activeTab === 'posts' ? (
            <Fade in timeout={400} style={{ transitionDelay: revealForPlanId === plan.id ? '240ms' : '0ms' }}>
              <div>
                <PostsSection
                  plan={plan}
                  posts={posts}
                  projectId={projectId}
                  bootstrap={bootstrap}
                  generating={generatingPosts}
                  onGenerate={handleGeneratePosts}
                  onPostAccepted={(updated) => {
                    // Håndter både update (eksisterende post) og insert
                    // (ny variant). Insert sorteres på sortOrder.
                    setPosts((current) => {
                      const idx = current.findIndex((p) => p.id === updated.id);
                      if (idx >= 0) {
                        const next = [...current];
                        next[idx] = updated;
                        return next;
                      }
                      // Ny post — sett inn på riktig sort_order-posisjon
                      const next = [...current, updated];
                      next.sort((a, b) => a.sortOrder - b.sortOrder);
                      return next;
                    });
                  }}
                  onError={setError}
                />
              </div>
            </Fade>
          ) : null}
          <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
          <ClientPortalSection projectId={projectId} onError={setError} />
        </Stack>
      ) : !readiness?.ready ? null : (
        <Alert
          severity="info"
          sx={{ bgcolor: 'rgba(34,211,238,0.06)', color: '#cbd5e1', border: '1px solid rgba(34,211,238,0.2)' }}
        >
          Ingen markedsplan ennå. Klikk "Generer plan" — Claude bruker research-outputen og
          bygger 3–5 content pillars + kanalstrategi + KPI-mål.
        </Alert>
      )}

      {/* #127 — Sticky CTA-bar: kun synlig når header er ute av syne OG
          planen er i draft-modus. Plassert fixed-bottom over hele panel-
          viewporten. z-index over post-grid, under modals. */}
      {plan && plan.status === 'draft' && stickyCtaVisible ? (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 10,
            mx: -2,
            px: 2,
            py: 1,
            bgcolor: 'rgba(11,18,38,0.94)',
            borderTop: '1px solid rgba(99,102,241,0.32)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Stack spacing={0.2} sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.86rem' }}>
              Planen er klar — ikke aktivert ennå
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.74rem' }}>
              {plan.pillars.length} pillars · {plan.horizonDays} dager · aktiver for å låse og dele
            </Typography>
          </Stack>
          <Button
            variant="contained"
            size="small"
            startIcon={activating ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
            onClick={handleActivate}
            disabled={activating}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
              flexShrink: 0,
            }}
          >
            {activating ? 'Aktiverer…' : 'Aktiver planen'}
          </Button>
        </Box>
      ) : null}

      {/* #150 — Plan Activated-banner med 3s auto-dismiss. Konfetti er
          en pure-CSS shower (samme mønster som ResearchCompleteOverlay). */}
      {activatedBannerVisible ? (
        <Fade in timeout={300}>
          <Box
            sx={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1400,
              px: 2.4,
              py: 1.4,
              borderRadius: 3,
              bgcolor: 'rgba(34,197,94,0.18)',
              border: '1px solid rgba(52,211,153,0.5)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 12px 40px rgba(34,197,94,0.32)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              overflow: 'hidden',
              '@keyframes planActivatedConfetti': {
                '0%': { transform: 'translate3d(0,-10px,0) rotate(0deg)', opacity: 1 },
                '100%': { transform: 'translate3d(var(--drift),50vh,0) rotate(540deg)', opacity: 0 },
              },
            }}
          >
            <CheckCircleIcon sx={{ color: '#34d399', fontSize: 26 }} />
            <Stack spacing={0.1}>
              <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.92rem' }}>
                Planen er aktivert
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.78rem' }}>
                Låst som versjon {plan?.id?.slice(0, 8) ?? '—'} · klar til posting
              </Typography>
            </Stack>
            {/* Lett konfetti — 12 partikler i grønnskala for å passe stilen */}
            {Array.from({ length: 12 }, (_, i) => {
              const colors = ['#34d399', '#bbf7d0', '#86efac', '#22c55e'];
              const left = (i * 11) % 100;
              const drift = `${((i * 13) % 60) - 30}px`;
              const delay = (i % 6) * 0.08;
              return (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: `${left}%`,
                    width: 6,
                    height: 10,
                    bgcolor: colors[i % colors.length],
                    borderRadius: '2px',
                    animation: `planActivatedConfetti 2.4s linear ${delay}s forwards`,
                    '--drift': drift,
                    pointerEvents: 'none',
                  } as React.CSSProperties}
                />
              );
            })}
          </Box>
        </Fade>
      ) : null}
    </Stack>
  );
}

function StrategySection({ strategy }: { strategy: MarketingPlan['strategy'] }) {
  return (
    <Box
      sx={{
        p: 1.4,
        borderRadius: 2.2,
        border: '1px solid rgba(148,163,184,0.16)',
        bgcolor: 'rgba(15,23,42,0.52)',
      }}
    >
      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', mb: 1 }}>
        Strategi
      </Typography>

      <Stack spacing={1.2}>
        <KeyValueRow label="Posisjonering">
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', lineHeight: 1.55 }}>
            <strong style={{ color: '#a5f3fc' }}>Verditilbud:</strong> {strategy.positioning.valueProp}
          </Typography>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', lineHeight: 1.55 }}>
            <strong style={{ color: '#a5f3fc' }}>Differensiering:</strong> {strategy.positioning.differentiator}
          </Typography>
        </KeyValueRow>

        <KeyValueRow label={`Kanal (${strategy.channelStrategy.cadencePerWeek}/uke)`}>
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`Primær: ${strategy.channelStrategy.primary}`} sx={{ bgcolor: 'rgba(34,211,238,0.16)', color: '#a5f3fc' }} />
            {strategy.channelStrategy.secondary.map((s) => (
              <Chip key={s} size="small" label={s} variant="outlined" sx={{ color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.28)' }} />
            ))}
          </Stack>
          <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.82rem', lineHeight: 1.5 }}>
            {strategy.channelStrategy.reasoning}
          </Typography>
        </KeyValueRow>

        <KeyValueRow label="Tone of voice">
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', lineHeight: 1.55 }}>
            {strategy.toneOfVoice.voice}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#86efac', fontSize: '0.76rem', fontWeight: 700, mb: 0.4 }}>DO</Typography>
              <Stack component="ul" spacing={0.2} sx={{ m: 0, pl: 2.2 }}>
                {strategy.toneOfVoice.dos.map((d, i) => (
                  <Typography key={i} component="li" sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.82rem', lineHeight: 1.5 }}>{d}</Typography>
                ))}
              </Stack>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#fecaca', fontSize: '0.76rem', fontWeight: 700, mb: 0.4 }}>DON'T</Typography>
              <Stack component="ul" spacing={0.2} sx={{ m: 0, pl: 2.2 }}>
                {strategy.toneOfVoice.donts.map((d, i) => (
                  <Typography key={i} component="li" sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.82rem', lineHeight: 1.5 }}>{d}</Typography>
                ))}
              </Stack>
            </Box>
          </Stack>
        </KeyValueRow>

        <KeyValueRow label="KPI-mål">
          <Stack spacing={0.6}>
            {strategy.kpiTargets.map((kpi, i) => (
              <Box
                key={`${kpi.metric}-${i}`}
                sx={{
                  p: 0.8,
                  borderRadius: 1.4,
                  bgcolor: 'rgba(15,23,42,0.62)',
                  border: '1px solid rgba(148,163,184,0.14)',
                }}
              >
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.86rem' }}>
                    {kpi.target.toLocaleString('nb-NO')}
                  </Typography>
                  <Typography sx={{ color: '#a5f3fc', fontSize: '0.82rem' }}>
                    {kpi.metric.replace(/_/g, ' ')} per {kpi.per}
                  </Typography>
                </Stack>
                <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.78rem', mt: 0.3, lineHeight: 1.45 }}>
                  {kpi.rationale}
                </Typography>
              </Box>
            ))}
          </Stack>
        </KeyValueRow>
      </Stack>
    </Box>
  );
}

/** Heuristisk pillar↔audience-match. Keyword-overlap mellom pillar-tekst
 *  og audience-segment-string. Returnerer mapping pillarId → [matchingAudiences]. */
function buildPillarAudienceMatrix(
  pillars: MarketingPlan['pillars'],
  audiences: string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const pillar of pillars) {
    const text = `${pillar.name} ${pillar.description ?? ''} ${pillar.rationale ?? ''}`.toLowerCase();
    const matches = audiences.filter((segment) => {
      const segNorm = segment.toLowerCase();
      // Keyword-based overlap: pull words ≥4 chars from segment and check
      // whether at least one appears in the pillar text. Short stopwords
      // ("og", "med") aren't useful signal.
      const tokens = segNorm.split(/[\s,]+/).filter((t) => t.length >= 4);
      return tokens.some((t) => text.includes(t));
    });
    if (matches.length > 0) out[pillar.id] = matches;
  }
  return out;
}

function PillarsSection({
  pillars,
  targetAudience,
  planId,
  locked,
  onPillarChanged,
}: {
  pillars: MarketingPlan['pillars'];
  targetAudience?: string[];
  planId: string;
  locked: boolean;
  onPillarChanged: (updated: MarketingPlan['pillars']) => void;
}) {
  const matrix = useMemo(
    () => buildPillarAudienceMatrix(pillars, targetAudience ?? []),
    [pillars, targetAudience],
  );

  const handleRename = useCallback(async (pillarId: string, currentName: string) => {
    if (locked) return;
    const next = window.prompt('Nytt navn:', currentName);
    if (!next || next.trim() === currentName) return;
    const updated = await roleRoomAgentService.updatePillar({ pillarId, name: next.trim() });
    if (updated) onPillarChanged(pillars.map((p) => (p.id === pillarId ? updated : p)));
  }, [locked, onPillarChanged, pillars]);

  const handleToggle = useCallback(async (pillarId: string, currentActive: boolean) => {
    if (locked) return;
    const updated = await roleRoomAgentService.updatePillar({ pillarId, isActive: !currentActive });
    if (updated) onPillarChanged(pillars.map((p) => (p.id === pillarId ? updated : p)));
  }, [locked, onPillarChanged, pillars]);

  const handleDelete = useCallback(async (pillarId: string) => {
    if (locked) return;
    if (!window.confirm('Slett denne egendefinerte pillaren permanent?')) return;
    const ok = await roleRoomAgentService.deleteCustomPillar(pillarId);
    if (ok) onPillarChanged(pillars.filter((p) => p.id !== pillarId));
  }, [locked, onPillarChanged, pillars]);

  const handleAdd = useCallback(async () => {
    if (locked) return;
    const name = window.prompt('Navn på ny pillar:');
    if (!name || name.trim().length === 0) return;
    const description = window.prompt('Beskrivelse (valgfri):') ?? undefined;
    const added = await roleRoomAgentService.addCustomPillar({
      planId,
      name: name.trim(),
      description: description?.trim() || undefined,
    });
    if (added) onPillarChanged([...pillars, added]);
  }, [locked, onPillarChanged, pillars, planId]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
          Content pillars ({pillars.length})
        </Typography>
        {!locked ? (
          <Button
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={handleAdd}
            sx={{ textTransform: 'none', color: '#a78bfa', fontSize: '0.78rem' }}
          >
            Legg til pillar
          </Button>
        ) : null}
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
        {pillars.map((pillar, index) => {
          const isActive = pillar.isActive !== false;
          return (
          <Box
            key={pillar.id}
            sx={{
              flex: '1 1 240px',
              minWidth: 0,
              p: 1.2,
              borderRadius: 2.2,
              border: pillar.isCustom
                ? '1px dashed rgba(168,85,247,0.5)'
                : '1px solid rgba(168,85,247,0.24)',
              bgcolor: 'rgba(168,85,247,0.08)',
              opacity: isActive ? 1 : 0.45,
              transition: 'opacity 0.2s',
            }}
          >
            <Stack direction="row" spacing={0.8} alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'rgba(168,85,247,0.22)',
                    color: '#e9d5ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </Box>
                <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pillar.name}
                </Typography>
                {pillar.isCustom ? (
                  <Chip
                    size="small"
                    label="Egendefinert"
                    sx={{ height: 16, fontSize: '0.62rem', bgcolor: 'rgba(167,139,250,0.18)', color: '#ddd6fe' }}
                  />
                ) : null}
              </Stack>
              {!locked ? (
                <Stack direction="row" spacing={0.2}>
                  <Tooltip title="Endre navn">
                    <Button
                      size="small"
                      onClick={() => void handleRename(pillar.id, pillar.name)}
                      sx={{ minWidth: 0, p: 0.4, color: 'rgba(226,232,240,0.6)' }}
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </Button>
                  </Tooltip>
                  <Tooltip title={isActive ? 'Skru av denne pillaren' : 'Skru på igjen'}>
                    <Button
                      size="small"
                      onClick={() => void handleToggle(pillar.id, isActive)}
                      sx={{ minWidth: 0, p: 0.4, color: isActive ? '#34d399' : 'rgba(226,232,240,0.4)' }}
                    >
                      {isActive ? <ToggleOnIcon sx={{ fontSize: 16 }} /> : <ToggleOffIcon sx={{ fontSize: 16 }} />}
                    </Button>
                  </Tooltip>
                  {pillar.isCustom ? (
                    <Tooltip title="Slett egendefinert pillar">
                      <Button
                        size="small"
                        onClick={() => void handleDelete(pillar.id)}
                        sx={{ minWidth: 0, p: 0.4, color: 'rgba(248,113,113,0.7)' }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </Button>
                    </Tooltip>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
            <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.84rem', lineHeight: 1.5, mb: 0.6 }}>
              {pillar.description}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.76rem', lineHeight: 1.45, fontStyle: 'italic' }}>
              {pillar.rationale}
            </Typography>
            {/* #134 — pillar↔audience matrise: vis hvilke segmenter
                fra bootstrap som matcher denne pillaren. */}
            {(matrix[pillar.id] ?? []).length > 0 ? (
              <Box sx={{ mb: 0.6 }}>
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem', mb: 0.3 }}>
                  Treffer målgruppe:
                </Typography>
                <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                  {(matrix[pillar.id] ?? []).map((seg) => (
                    <Chip
                      key={seg}
                      size="small"
                      label={seg}
                      sx={{
                        bgcolor: 'rgba(167,139,250,0.16)',
                        color: '#ddd6fe',
                        height: 18,
                        fontSize: '0.7rem',
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            ) : null}
            {pillar.targetKpi ? (
              <Chip
                size="small"
                label={`${pillar.targetKpi.target.toLocaleString('nb-NO')} ${pillar.targetKpi.metric.replace(/_/g, ' ')} / ${pillar.targetKpi.per}`}
                sx={{
                  mt: 0.8,
                  bgcolor: 'rgba(168,85,247,0.16)',
                  color: '#e9d5ff',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                }}
              />
            ) : null}
          </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

const FORMAT_LABEL: Record<MarketingPlanPost['format'], string> = {
  reel: 'Reel',
  carousel: 'Carousel',
  image: 'Image',
  story: 'Story',
  tiktok: 'TikTok',
  linkedin_post: 'LinkedIn',
  youtube_short: 'YT Short',
};

const FORMAT_COLOR: Record<MarketingPlanPost['format'], string> = {
  reel: 'rgba(221,42,123,0.18)',
  carousel: 'rgba(245,133,41,0.2)',
  image: 'rgba(34,211,238,0.16)',
  story: 'rgba(168,85,247,0.2)',
  tiktok: 'rgba(236,72,153,0.2)',
  linkedin_post: 'rgba(59,130,246,0.22)',
  youtube_short: 'rgba(239,68,68,0.18)',
};

type PostPlatformFilter = MarketingPlanPost['primaryPlatform'] | 'all';
type PostFormatFilter = MarketingPlanPost['format'] | 'all';

function PostsSection({
  plan,
  posts,
  projectId,
  bootstrap,
  generating,
  onGenerate,
  onPostAccepted,
  onError,
}: {
  plan: MarketingPlan;
  posts: MarketingPlanPost[];
  projectId: string;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  generating: boolean;
  onGenerate: () => void;
  onPostAccepted: (post: MarketingPlanPost) => void;
  onError: (message: string) => void;
}) {
  // #154 — filtre per pillar / platform / format
  const [pillarFilter, setPillarFilter] = useState<string | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<PostPlatformFilter>('all');
  const [formatFilter, setFormatFilter] = useState<PostFormatFilter>('all');
  // #153 — batch select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchAccepting, setBatchAccepting] = useState(false);
  // #43 — bulk-edit menu state
  const [bulkPlatformMenuOpen, setBulkPlatformMenuOpen] = useState(false);
  // #152 — live progress når posts auto-genereres i bakgrunnen.
  // Poller bare når planen er active OG posts mangler. Stopper når
  // complete eller når posts dukker opp via parent state.
  const [autoGenProgress, setAutoGenProgress] = useState<{ generated: number; expected: number } | null>(null);
  useEffect(() => {
    if (plan.status !== 'active') return;
    if (posts.length > 0) {
      setAutoGenProgress(null);
      return;
    }
    let cancelled = false;
    const poll = async (): Promise<void> => {
      const progress = await roleRoomAgentService.checkMarketingPlanPostsProgress(plan.id);
      if (cancelled || !progress) return;
      setAutoGenProgress({ generated: progress.generated, expected: progress.expected });
      if (progress.complete) {
        // Posts er ferdige; trigg en refresh i parent.
        // (Vi har ikke direkte tilgang til parent state — bare la
        // brukeren se "Posts klare!" og oppdater via knapp.)
        return;
      }
      setTimeout(() => { if (!cancelled) void poll(); }, 4000);
    };
    void poll();
    return () => { cancelled = true; };
  }, [plan.status, plan.id, posts.length]);

  // Reset selection når posts-listen endrer seg materielt (ny generering)
  useEffect(() => {
    setSelectedIds((curr) => {
      const ids = new Set(posts.map((p) => p.id));
      const filtered = new Set([...curr].filter((id) => ids.has(id)));
      return filtered.size === curr.size ? curr : filtered;
    });
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (pillarFilter !== 'all' && p.pillarId !== pillarFilter) return false;
      if (platformFilter !== 'all' && p.primaryPlatform !== platformFilter) return false;
      if (formatFilter !== 'all' && p.format !== formatFilter) return false;
      return true;
    });
  }, [posts, pillarFilter, platformFilter, formatFilter]);

  // #161-#173 — kjør validators kun på filtrert sett (ikke skjulte posts)
  const flagsByPost = useMemo(() => groupFlagsByPost(validateMarketingPlanPosts(filteredPosts)), [filteredPosts]);
  // #163 — sentiment per post + distribusjon for header-bar
  const sentimentsByPost = useMemo(() => scoreAllPosts(filteredPosts), [filteredPosts]);
  const sentimentDistribution = useMemo(() => buildDistribution(sentimentsByPost), [sentimentsByPost]);
  const totalSentimentPosts = filteredPosts.length;

  // Group by pillar so pillar → posts is easy to scan, ordered by
  // pillar sortOrder. Un-pillared posts go at the end under "Uten tag".
  const grouped = useMemo(() => {
    const groups = new Map<string | null, MarketingPlanPost[]>();
    for (const p of filteredPosts) {
      const key = p.pillarId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    const result: Array<{ pillarId: string | null; name: string; posts: MarketingPlanPost[] }> = [];
    for (const pillar of plan.pillars) {
      const group = groups.get(pillar.id) ?? [];
      if (group.length > 0) result.push({ pillarId: pillar.id, name: pillar.name, posts: group });
    }
    const orphans = groups.get(null) ?? [];
    if (orphans.length > 0) result.push({ pillarId: null, name: 'Uten pillar-tag', posts: orphans });
    return result;
  }, [plan.pillars, filteredPosts]);

  const toggleSelect = useCallback((postId: string) => {
    setSelectedIds((curr) => {
      const next = new Set(curr);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filteredPosts.map((p) => p.id)));
  }, [filteredPosts]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // #153 — batch-accept
  const handleBatchAccept = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBatchAccepting(true);
    let succeeded = 0;
    let failed = 0;
    for (const postId of Array.from(selectedIds)) {
      try {
        const result = await roleRoomAgentService.acceptMarketingPlanPost({
          postId,
          projectId,
          planId: plan.id,
        });
        if (result?.planPost) {
          onPostAccepted(result.planPost);
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
    setBatchAccepting(false);
    setSelectedIds(new Set());
    if (failed > 0) {
      onError(`Aksepterte ${succeeded} av ${succeeded + failed} posts (${failed} feilet).`);
    }
  }, [selectedIds, projectId, plan.id, onPostAccepted, onError]);

  // #43 — bulk-edit primaryPlatform for selected posts
  const handleBulkPlatform = useCallback(async (newPlatform: NonNullable<MarketingPlanPost['primaryPlatform']>) => {
    if (selectedIds.size === 0) return;
    setBulkPlatformMenuOpen(false);
    // Backend trenger eget PATCH-endepoint for post-edit; for nå bruker vi
    // den eksisterende accept-API'en hvis tilgjengelig, ellers viser vi
    // en notice om at backend-støtte er nødvendig.
    onError(`Bulk-platform-endring til ${newPlatform} for ${selectedIds.size} posts krever en PATCH /posts/:id-endepoint (ikke implementert backend-side i denne batchen).`);
  }, [selectedIds, onError]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
        <Box>
          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
            {plan.horizonDays}-dagers plan{posts.length > 0 ? ` (${posts.length} posts)` : ''}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.78rem' }}>
            Hook + format + script + CTA per post, balansert på tvers av pillars.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          onClick={onGenerate}
          disabled={generating}
          startIcon={generating ? <CircularProgress size={14} /> : <AutoAwesomeIcon fontSize="small" />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            color: '#22d3ee',
            borderColor: 'rgba(34,211,238,0.5)',
            '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.08)' },
          }}
        >
          {generating ? 'Genererer posts…' : posts.length > 0 ? 'Regenerer posts' : 'Generer 30-dagers plan'}
        </Button>
      </Stack>

      {posts.length === 0 ? (
        autoGenProgress && autoGenProgress.expected > 0 ? (
          // #152 — live progress for auto-generation
          <Alert
            severity="info"
            icon={<CircularProgress size={18} sx={{ color: '#22d3ee' }} />}
            sx={{
              bgcolor: 'rgba(34,211,238,0.08)',
              color: '#a5f3fc',
              border: '1px solid rgba(34,211,238,0.32)',
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '0.86rem' }}>
              Genererer posts i bakgrunnen: {autoGenProgress.generated} / {autoGenProgress.expected}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(autoGenProgress.generated / autoGenProgress.expected) * 100}
              sx={{ mt: 0.6, height: 4, borderRadius: 2 }}
            />
            <Typography sx={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.6)', mt: 0.4 }}>
              Tar typisk 30-60 sekunder. Klikk «Regenerer posts» når listen er full for å oppdatere.
            </Typography>
          </Alert>
        ) : (
          <Alert
            severity="info"
            sx={{ bgcolor: 'rgba(34,211,238,0.06)', color: '#cbd5e1', border: '1px solid rgba(34,211,238,0.2)' }}
          >
            Ingen post-forslag ennå. Klikk «Generer 30-dagers plan» — Claude bygger én post
            per dag balansert på tvers av pillars, med hook, format, script og CTA ferdig
            skrevet.
          </Alert>
        )
      ) : (
        <Stack spacing={1.4}>
          {/* #154 — filter-chips for pillar/platform/format */}
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap alignItems="center">
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.74rem', mr: 0.4 }}>
              Filter:
            </Typography>
            <Chip
              size="small"
              label={`Pillar: ${pillarFilter === 'all' ? 'alle' : plan.pillars.find((p) => p.id === pillarFilter)?.name ?? '—'}`}
              onClick={() => {
                // Cycle: all → pillar1 → pillar2 → ... → all
                const ids = ['all', ...plan.pillars.map((p) => p.id)];
                const idx = ids.indexOf(pillarFilter);
                setPillarFilter(ids[(idx + 1) % ids.length] as typeof pillarFilter);
              }}
              sx={{ bgcolor: pillarFilter === 'all' ? 'rgba(148,163,184,0.14)' : 'rgba(168,85,247,0.22)', color: '#e9d5ff', cursor: 'pointer' }}
            />
            <Chip
              size="small"
              label={`Platform: ${platformFilter === 'all' ? 'alle' : platformFilter}`}
              onClick={() => {
                const ps: PostPlatformFilter[] = ['all', 'instagram', 'tiktok', 'linkedin', 'youtube', 'facebook'];
                const idx = ps.indexOf(platformFilter);
                setPlatformFilter(ps[(idx + 1) % ps.length]);
              }}
              sx={{ bgcolor: platformFilter === 'all' ? 'rgba(148,163,184,0.14)' : 'rgba(34,211,238,0.22)', color: '#a5f3fc', cursor: 'pointer' }}
            />
            <Chip
              size="small"
              label={`Format: ${formatFilter === 'all' ? 'alle' : formatFilter}`}
              onClick={() => {
                const fs: PostFormatFilter[] = ['all', 'reel', 'carousel', 'image', 'story', 'tiktok', 'linkedin_post', 'youtube_short'];
                const idx = fs.indexOf(formatFilter);
                setFormatFilter(fs[(idx + 1) % fs.length]);
              }}
              sx={{ bgcolor: formatFilter === 'all' ? 'rgba(148,163,184,0.14)' : 'rgba(251,191,36,0.22)', color: '#fde68a', cursor: 'pointer' }}
            />
            <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.74rem', ml: 'auto' }}>
              Viser {filteredPosts.length} av {posts.length}
            </Typography>
          </Stack>

          {/* #163 — sentiment-distribusjon over post-listen */}
          {totalSentimentPosts > 0 ? (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.4 }}>
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>
                  Sentiment:
                </Typography>
                {(['very_positive','positive','neutral','negative','very_negative'] as const).map((label) => {
                  const count = sentimentDistribution[label];
                  if (count === 0) return null;
                  return (
                    <Tooltip key={label} title={`${count} posts ${label.replace('_',' ')}`}>
                      <Chip
                        size="small"
                        label={`${emojiForLabel(label)} ${count}`}
                        sx={{
                          height: 18,
                          fontSize: '0.7rem',
                          bgcolor: `${colorForLabel(label)}22`,
                          color: colorForLabel(label),
                          cursor: 'help',
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Stack>
              {/* Mini-distribusjon-bar */}
              <Box sx={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', bgcolor: 'rgba(148,163,184,0.14)' }}>
                {(['very_positive','positive','neutral','negative','very_negative'] as const).map((label) => {
                  const count = sentimentDistribution[label];
                  if (count === 0) return null;
                  return (
                    <Box
                      key={label}
                      sx={{
                        flex: count,
                        bgcolor: colorForLabel(label),
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          ) : null}

          {/* #153 + #43 — batch-toolbar: vises kun når noen er valgt */}
          {selectedIds.size > 0 ? (
            <Box
              sx={{
                p: 0.8,
                borderRadius: 1.6,
                bgcolor: 'rgba(99,102,241,0.16)',
                border: '1px solid rgba(99,102,241,0.32)',
                display: 'flex',
                alignItems: 'center',
                gap: 0.8,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ color: '#e0e7ff', fontWeight: 700, fontSize: '0.84rem' }}>
                {selectedIds.size} valgt
              </Typography>
              <Button
                size="small"
                onClick={selectAllVisible}
                sx={{ textTransform: 'none', color: '#a5b4fc', fontSize: '0.76rem' }}
              >
                Velg alle synlige ({filteredPosts.length})
              </Button>
              <Button
                size="small"
                onClick={clearSelection}
                sx={{ textTransform: 'none', color: 'rgba(226,232,240,0.6)', fontSize: '0.76rem' }}
              >
                Fjern valg
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                variant="outlined"
                onClick={() => setBulkPlatformMenuOpen((v) => !v)}
                sx={{ textTransform: 'none', color: '#a5f3fc', borderColor: 'rgba(34,211,238,0.4)', fontSize: '0.76rem' }}
              >
                Endre platform…
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={batchAccepting}
                onClick={() => void handleBatchAccept()}
                startIcon={batchAccepting ? <CircularProgress size={12} color="inherit" /> : null}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
                }}
              >
                {batchAccepting ? 'Aksepterer…' : `Accept ${selectedIds.size}`}
              </Button>
            </Box>
          ) : null}

          {/* Bulk platform dropdown */}
          {bulkPlatformMenuOpen ? (
            <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
              {(['instagram', 'tiktok', 'linkedin', 'youtube', 'facebook'] as const).map((platform) => (
                <Button
                  key={platform}
                  size="small"
                  onClick={() => void handleBulkPlatform(platform)}
                  sx={{ textTransform: 'none', color: '#cbd5e1', bgcolor: 'rgba(148,163,184,0.14)' }}
                >
                  {platform}
                </Button>
              ))}
            </Stack>
          ) : null}
          {grouped.map((group) => (
            <Box key={group.pillarId ?? 'orphan'}>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#a855f7',
                  }}
                />
                <Typography sx={{ color: '#e9d5ff', fontWeight: 700, fontSize: '0.84rem' }}>
                  {group.name}
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.76rem' }}>
                  {group.posts.length} post{group.posts.length === 1 ? '' : 's'}
                </Typography>
              </Stack>
              <Stack spacing={0.8}>
                {group.posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    projectId={projectId}
                    planId={plan.id}
                    industry={bootstrap?.companyProfile?.industry ?? null}
                    companyName={bootstrap?.companyProfile?.companyName ?? null}
                    logoUrl={bootstrap?.planningDraft?.brandGuide?.logoUrl ?? bootstrap?.companyProfile?.logoUrl ?? null}
                    brandPrimaryHex={bootstrap?.planningDraft?.brandGuide?.colors?.[0]?.hex ?? null}
                    brandAccentHex={bootstrap?.planningDraft?.brandGuide?.colors?.[1]?.hex ?? null}
                    flags={flagsByPost.get(post.id) ?? []}
                    sentiment={sentimentsByPost.get(post.id) ?? null}
                    selected={selectedIds.has(post.id)}
                    onToggleSelect={toggleSelect}
                    onAccepted={onPostAccepted}
                    onVariantCreated={onPostAccepted /* parent håndterer append via samme callback (vi sjekker id ikke finnes først) */}
                    onError={onError}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function PostCard({
  post,
  projectId,
  planId,
  industry = null,
  companyName = null,
  logoUrl = null,
  brandPrimaryHex = null,
  brandAccentHex = null,
  flags = [],
  sentiment = null,
  selected = false,
  onToggleSelect,
  onAccepted,
  onError,
}: {
  post: MarketingPlanPost;
  projectId: string;
  /** Brukes for #157 regenerate-call. */
  planId?: string;
  /** #164 — brukes for bransje-spesifikke hashtag-forslag. */
  industry?: string | null;
  /** #174 — vises i platform-preview-handelen. */
  companyName?: string | null;
  /** #174 — vises som avatar i preview. */
  logoUrl?: string | null;
  /** #168 — brukes som color-hint i thumbnail-konsept. */
  brandPrimaryHex?: string | null;
  brandAccentHex?: string | null;
  /** Validator-flagg fra #161-#173. Rendres som chip-rad over kortet. */
  flags?: PostFlag[];
  /** #163 — sentiment-score for emoji-indikator. */
  sentiment?: PostSentiment | null;
  /** #153 — batch-select state. */
  selected?: boolean;
  onToggleSelect?: (postId: string) => void;
  onAccepted: (post: MarketingPlanPost) => void;
  /** #158 — kalles når A/B-variant lages. Parent appender variant til posts-listen. */
  onVariantCreated?: (post: MarketingPlanPost) => void;
  onError: (message: string) => void;
}) {
  // #174 — toggle for platform-preview
  const [previewOpen, setPreviewOpen] = useState(false);
  // Slugify company-name som fallback-handle
  const companyHandle = useMemo(() => {
    if (!companyName) return 'din_konto';
    return companyName.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
  }, [companyName]);
  // #159 — foreslå publiseringstid kun når posten ikke allerede har en
  const suggestedTime = useMemo(
    () => (post.scheduledFor ? null : suggestPublishTime(post.primaryPlatform)),
    [post.scheduledFor, post.primaryPlatform],
  );
  // #160 — utleder reelle crosspost-datoer fra scheduledFor + delayDays
  const resolvedCrossposts = useMemo(
    () => resolveCrosspostSchedule(post.scheduledFor, post.crossPostPlan),
    [post.scheduledFor, post.crossPostPlan],
  );
  // #164 + #166
  const suggestedHashtags = useMemo(
    () => suggestHashtags(post.primaryPlatform, industry),
    [post.primaryPlatform, industry],
  );
  const suggestedCta = useMemo(() => suggestCtaTemplate(post), [post]);

  // ─── State declarations — MÅ være før useMemo/useEffect som bruker dem ───
  const [accepting, setAccepting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingVariant, setGeneratingVariant] = useState(false);
  // #170 — svarmaler state
  const [replyTemplates, setReplyTemplates] = useState<{ positive: string | null; question: string | null; negative: string | null } | null>(null);
  const [generatingReplies, setGeneratingReplies] = useState(false);
  // #53 (bundle) — tools-panel for influencer/stock/thumbnail/reach.
  // Disse er nå ekte API-drevne (165 creators-DB + IG, 168 DALL-E, 169 benchmark).
  const [toolsOpen, setToolsOpen] = useState(false);
  const [creators, setCreators] = useState<Awaited<ReturnType<typeof roleRoomAgentService.fetchCreatorRecommendations>> | null>(null);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [thumbnail, setThumbnail] = useState<{ imageUrl: string; aspectRatio: string } | null>(null);
  const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
  const [reach, setReach] = useState<Awaited<ReturnType<typeof roleRoomAgentService.estimatePostReach>> | null>(null);
  const [loadingReach, setLoadingReach] = useState(false);
  const [followerInput, setFollowerInput] = useState<string>('');
  // #158 — er denne posten en variant av en annen? Vises som badge.
  const variantOf = (post.goalKpi as { variantOf?: string } | null)?.variantOf ?? null;

  // ─── useMemo/useEffect (alle kan trygt referere til state ovenfor) ───
  // Stock-links er client-side (vi har ikke Unsplash/Pexels-API-key —
  // deeplink til søk er beste UX uten ekstra cost)
  const stockLinks = useMemo(() => (toolsOpen ? buildStockSearchLinks(post) : null), [toolsOpen, post]);

  // #165 — last creator-anbefalinger første gang tools åpnes
  const loadCreators = useCallback(async () => {
    if (creators || loadingCreators) return;
    setLoadingCreators(true);
    try {
      const result = await roleRoomAgentService.fetchCreatorRecommendations({ postId: post.id, industry });
      setCreators(result);
    } finally {
      setLoadingCreators(false);
    }
  }, [creators, loadingCreators, post.id, industry]);
  useEffect(() => {
    if (toolsOpen) void loadCreators();
  }, [toolsOpen, loadCreators]);

  // #168 — DALL-E thumbnail (on-demand, ikke automatisk pga kostnad)
  const handleGenerateThumbnail = useCallback(async () => {
    setGeneratingThumbnail(true);
    try {
      const result = await roleRoomAgentService.generatePostThumbnail({
        postId: post.id,
        brandPrimaryHex,
        brandAccentHex,
      });
      if (result) setThumbnail(result);
      else onError('Thumbnail-generering returnerte ingen URL.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Thumbnail-generering feilet.');
    } finally {
      setGeneratingThumbnail(false);
    }
  }, [post.id, brandPrimaryHex, brandAccentHex, onError]);

  // #169 — reach-estimat (autoload med benchmark; opdaterer hvis bruker skriver inn followers)
  useEffect(() => {
    if (!toolsOpen) return;
    let cancelled = false;
    setLoadingReach(true);
    (async () => {
      const followers = followerInput ? Number(followerInput) : null;
      const result = await roleRoomAgentService.estimatePostReach({
        postId: post.id,
        followers: followers && followers > 0 ? followers : null,
      });
      if (!cancelled) {
        setReach(result);
        setLoadingReach(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toolsOpen, post.id, followerInput]);

  // #170 — generér svarmaler
  const handleGenerateReplies = useCallback(async () => {
    setGeneratingReplies(true);
    try {
      const templates = await roleRoomAgentService.generateReplyTemplates(post.id);
      if (templates) setReplyTemplates(templates);
      else onError('Svarmaler kunne ikke genereres.');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Svarmal-generering feilet.');
    } finally {
      setGeneratingReplies(false);
    }
  }, [post.id, onError]);
  const handleAccept = useCallback(async () => {
    setAccepting(true);
    try {
      const result = await roleRoomAgentService.acceptMarketingPlanPost({
        postId: post.id,
        projectId,
      });
      onAccepted(result.planPost);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Kunne ikke akseptere posten.');
    } finally {
      setAccepting(false);
    }
  }, [post.id, projectId, onAccepted, onError]);

  // #158 — generér A/B-variant
  const handleVariant = useCallback(async () => {
    setGeneratingVariant(true);
    try {
      const variant = await roleRoomAgentService.generateMarketingPlanPostVariant({ postId: post.id });
      if (variant) {
        onAccepted(variant); // parent håndterer både update og insert
      } else {
        onError('A/B-variant kunne ikke genereres.');
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'A/B-variant feilet.');
    } finally {
      setGeneratingVariant(false);
    }
  }, [post.id, onAccepted, onError]);

  // #155 — accept + naviger til feed-planner (pragmatisk uten DnD).
  // Aksepterer posten først; ved suksess dispatcher en window-event
  // dialogen lytter på og bytter aktiv tab.
  const handleSendToFeed = useCallback(async () => {
    setAccepting(true);
    try {
      const result = await roleRoomAgentService.acceptMarketingPlanPost({
        postId: post.id,
        projectId,
      });
      onAccepted(result.planPost);
      // Dialog lytter på 'role-room:navigate-tab' og bytter til feed-planner.
      window.dispatchEvent(new CustomEvent('role-room:navigate-tab', {
        detail: { tab: 'feed-planner', highlightPostId: result.feedPlanPostId },
      }));
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Kunne ikke sende post til feed-planner.');
    } finally {
      setAccepting(false);
    }
  }, [post.id, projectId, onAccepted, onError]);

  // #157 — regenerér én post med valgfri hint
  const handleRegenerate = useCallback(async () => {
    const hint = window.prompt(
      `Hint til Claude (valgfri, f.eks. "gjør den mer ironisk" eller "kort til 50 ord"):`,
      '',
    );
    if (hint === null) return; // bruker avbrøt
    setRegenerating(true);
    try {
      const updated = await roleRoomAgentService.regenerateMarketingPlanPost({
        postId: post.id,
        hint: hint.trim() || undefined,
      });
      if (updated) {
        onAccepted(updated); // gjenbruker onAccepted-callbacken for state-sync
      } else {
        onError('Regenerering ga ingen respons.');
      }
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Regenerering feilet.');
    } finally {
      setRegenerating(false);
    }
  }, [post.id, onAccepted, onError]);

  const isScheduled = post.status === 'scheduled';
  const isPublished = post.status === 'published';

  const hasWarnings = flags.some((f) => f.severity === 'warning');
  return (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 2.2,
        border: selected
          ? '1px solid rgba(99,102,241,0.6)'
          : hasWarnings
            ? '1px solid rgba(251,191,36,0.4)'
            : '1px solid rgba(148,163,184,0.18)',
        bgcolor: selected ? 'rgba(99,102,241,0.08)' : 'rgba(15,23,42,0.58)',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* #161-#173 validator-flagg-rad + #163 sentiment-chip + #158 variant-badge */}
      {flags.length > 0 || sentiment || variantOf ? (
        <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap sx={{ mb: 0.8 }} alignItems="center">
          {variantOf ? (
            <Tooltip title={`A/B-variant av en annen post i denne planen`}>
              <Chip
                size="small"
                label="B-variant"
                sx={{
                  height: 18,
                  fontSize: '0.66rem',
                  bgcolor: 'rgba(167,139,250,0.18)',
                  color: '#ddd6fe',
                  fontWeight: 700,
                  cursor: 'help',
                }}
              />
            </Tooltip>
          ) : null}
          {sentiment ? (
            <Tooltip
              title={`Sentiment ${sentiment.score.toFixed(2)} (${sentiment.label.replace('_', ' ')}). ${sentiment.positiveHits.length} pos / ${sentiment.negativeHits.length} neg.`}
            >
              <Chip
                size="small"
                label={`${emojiForLabel(sentiment.label)} ${sentiment.score > 0 ? '+' : ''}${sentiment.score.toFixed(2)}`}
                sx={{
                  height: 18,
                  fontSize: '0.66rem',
                  bgcolor: `${colorForLabel(sentiment.label)}22`,
                  color: colorForLabel(sentiment.label),
                  cursor: 'help',
                  fontFamily: 'monospace',
                }}
              />
            </Tooltip>
          ) : null}
          {flags.map((flag, idx) => (
            <Tooltip key={`${flag.postId}-${idx}`} title={flag.detail}>
              <Chip
                size="small"
                label={flag.title}
                sx={{
                  height: 18,
                  fontSize: '0.66rem',
                  bgcolor: flag.severity === 'warning' ? 'rgba(251,191,36,0.18)' : 'rgba(96,165,250,0.18)',
                  color: flag.severity === 'warning' ? '#fde68a' : '#bfdbfe',
                  cursor: 'help',
                }}
              />
            </Tooltip>
          ))}
        </Stack>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
        {/* #153 batch-select checkbox */}
        {onToggleSelect ? (
          <Box
            onClick={() => onToggleSelect(post.id)}
            role="checkbox"
            aria-checked={selected}
            sx={{
              width: 20,
              height: 20,
              borderRadius: 0.6,
              border: `1.5px solid ${selected ? '#6366f1' : 'rgba(148,163,184,0.4)'}`,
              bgcolor: selected ? '#6366f1' : 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mt: 0.6,
              transition: 'all 0.15s',
              '&:hover': { borderColor: '#6366f1' },
            }}
          >
            {selected ? (
              <CheckCircleIcon sx={{ fontSize: 14, color: '#fff' }} />
            ) : null}
          </Box>
        ) : null}

        {/* Day-number badge */}
        <Box
          sx={{
            flexShrink: 0,
            minWidth: 44,
            minHeight: 44,
            borderRadius: 1.4,
            bgcolor: 'rgba(34,211,238,0.14)',
            color: '#a5f3fc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            px: 1,
          }}
        >
          <Typography sx={{ fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.1em' }}>DAG</Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>
            {post.dayOffset !== null ? post.dayOffset + 1 : '—'}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mb: 0.6 }}>
            <Chip
              size="small"
              label={FORMAT_LABEL[post.format]}
              sx={{ bgcolor: FORMAT_COLOR[post.format], color: '#fff', fontWeight: 700, fontSize: '0.72rem' }}
            />
            {post.primaryPlatform ? (
              <Chip
                size="small"
                label={post.primaryPlatform}
                variant="outlined"
                sx={{ color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.3)', fontSize: '0.72rem' }}
              />
            ) : null}
            {post.goalKpi ? (
              <Chip
                size="small"
                label={`${post.goalKpi.target} ${post.goalKpi.metric.replace(/_/g, ' ')}/${post.goalKpi.per}`}
                sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#e9d5ff', fontSize: '0.72rem' }}
              />
            ) : null}
          </Stack>

          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.4 }}>
            {post.hook}
          </Typography>

          {post.script ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.8rem', lineHeight: 1.5, mt: 0.5 }}>
              <strong style={{ color: '#a5f3fc' }}>Script:</strong> {post.script}
            </Typography>
          ) : null}

          {post.callToAction ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.8rem', lineHeight: 1.5, mt: 0.3 }}>
              <strong style={{ color: '#86efac' }}>CTA:</strong> {post.callToAction}
            </Typography>
          ) : null}

          {/* #160 — crosspost-plan med faktiske datoer når scheduledFor er satt */}
          {resolvedCrossposts.length > 0 ? (
            <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.72rem', mr: 0.4 }}>
                Cross-post:
              </Typography>
              {resolvedCrossposts.map((cp, i) => (
                <Tooltip key={`${cp.platform}-${i}`} title={cp.adaptationNote ?? `Publiser ${cp.delayDays} dager etter primary`}>
                  <Chip
                    size="small"
                    label={`${cp.platform} · ${new Date(cp.isoTimestamp).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`}
                    sx={{
                      bgcolor: 'rgba(15,23,42,0.72)',
                      color: 'rgba(226,232,240,0.78)',
                      border: '1px solid rgba(148,163,184,0.22)',
                      fontSize: '0.7rem',
                      height: 20,
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
          ) : post.crossPostPlan.length > 0 ? (
            // Fallback: ingen scheduledFor satt — vis kun delay-mønsteret
            <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.72rem', mr: 0.4 }}>
                Cross-post:
              </Typography>
              {post.crossPostPlan.map((cp, i) => (
                <Chip
                  key={`${cp.platform}-${i}`}
                  size="small"
                  label={`${cp.platform} +${cp.delayDays}d`}
                  sx={{
                    bgcolor: 'rgba(15,23,42,0.72)',
                    color: 'rgba(226,232,240,0.78)',
                    border: '1px solid rgba(148,163,184,0.22)',
                    fontSize: '0.7rem',
                    height: 20,
                  }}
                />
              ))}
            </Stack>
          ) : null}

          {/* #159 — foreslått publiseringstid */}
          {suggestedTime ? (
            <Tooltip title={suggestedTime.reason}>
              <Box
                sx={{
                  mt: 0.6,
                  px: 0.8,
                  py: 0.3,
                  borderRadius: 1,
                  bgcolor: 'rgba(34,197,94,0.08)',
                  border: '1px solid rgba(52,211,153,0.32)',
                  display: 'inline-block',
                  cursor: 'help',
                }}
              >
                <Typography sx={{ color: '#bbf7d0', fontSize: '0.72rem', fontWeight: 600 }}>
                  Foreslått tid: {new Date(suggestedTime.isoTimestamp).toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </Tooltip>
          ) : null}

          {/* #164 — hashtag-forslag */}
          {suggestedHashtags.length > 0 ? (
            <Stack direction="row" spacing={0.3} flexWrap="wrap" useFlexGap sx={{ mt: 0.6 }}>
              <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem', mr: 0.3 }}>
                Tags:
              </Typography>
              {suggestedHashtags.map((tag) => (
                <Chip
                  key={tag}
                  size="small"
                  label={tag}
                  sx={{
                    bgcolor: 'rgba(34,211,238,0.08)',
                    color: '#a5f3fc',
                    fontSize: '0.66rem',
                    height: 16,
                  }}
                />
              ))}
            </Stack>
          ) : null}

          {/* #166 — CTA-template-forslag når ingen CTA er satt eller den mangler link */}
          {suggestedCta && (!post.callToAction || !/{{|http/.test(post.callToAction)) ? (
            <Tooltip title={`Detektert intent: ${suggestedCta.intent}. Klikk for å erstatte CTA med template.`}>
              <Box
                sx={{
                  mt: 0.6,
                  px: 0.8,
                  py: 0.3,
                  borderRadius: 1,
                  bgcolor: 'rgba(167,139,250,0.08)',
                  border: '1px solid rgba(167,139,250,0.32)',
                  display: 'inline-block',
                }}
              >
                <Typography sx={{ color: '#ddd6fe', fontSize: '0.72rem', fontWeight: 600 }}>
                  Foreslått CTA: {suggestedCta.cta} <code style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{suggestedCta.linkMacro}</code>
                </Typography>
              </Box>
            </Tooltip>
          ) : null}

          <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 0.9 }}>
            {isScheduled || isPublished ? (
              <Chip
                size="small"
                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                label={isPublished ? 'Publisert' : 'I feed-planneren'}
                sx={{
                  bgcolor: 'rgba(34,197,94,0.16)',
                  color: '#86efac',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                }}
              />
            ) : (
              <>
                {/* #174 — toggle platform-preview */}
                <Tooltip title={previewOpen ? 'Skjul preview' : 'Vis platform-preview (IG/TT/LI/YT/FB-stil)'}>
                  <Button
                    size="small"
                    onClick={() => setPreviewOpen((v) => !v)}
                    startIcon={<VisibilityIcon fontSize="small" />}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.76rem',
                      py: 0.3,
                      color: previewOpen ? '#22d3ee' : 'rgba(226,232,240,0.7)',
                      minWidth: 0,
                    }}
                  >
                    {previewOpen ? 'Skjul' : 'Preview'}
                  </Button>
                </Tooltip>
                {/* #158 — A/B-variant (skjuler seg på variant selv for å unngå loop) */}
                {!variantOf ? (
                  <Tooltip title="Lag en B-variant for A/B-test (Claude Haiku, høy temperature)">
                    <Button
                      size="small"
                      onClick={() => void handleVariant()}
                      disabled={generatingVariant || accepting || regenerating}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.76rem',
                        py: 0.3,
                        color: '#ddd6fe',
                        minWidth: 0,
                      }}
                    >
                      {generatingVariant ? 'Lager B…' : 'A/B'}
                    </Button>
                  </Tooltip>
                ) : null}
                {/* #157 — regenerér med hint */}
                <Tooltip title="Regenerér posten med valgfri tone-hint (Claude Haiku)">
                  <Button
                    size="small"
                    onClick={() => void handleRegenerate()}
                    disabled={regenerating || accepting}
                    startIcon={regenerating ? <CircularProgress size={12} /> : <RefreshIcon fontSize="small" />}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.76rem',
                      py: 0.3,
                      color: '#a78bfa',
                      minWidth: 0,
                    }}
                  >
                    {regenerating ? 'Regenererer…' : 'Regenerér'}
                  </Button>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => void handleSendToFeed()}
                  disabled={accepting || regenerating}
                  startIcon={accepting ? <CircularProgress size={12} /> : <ArrowForwardIcon fontSize="small" />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.76rem',
                    py: 0.3,
                    color: '#a5f3fc',
                    borderColor: 'rgba(34,211,238,0.4)',
                    '&:hover': { borderColor: '#22d3ee', bgcolor: 'rgba(34,211,238,0.08)' },
                  }}
                >
                  {accepting ? 'Aksepterer…' : 'Send → Feed-planner'}
                </Button>
              </>
            )}
          </Stack>
        </Box>
      </Stack>

      {/* #174 — platform-spesifikk preview når åpen */}
      {previewOpen ? (
        <Box sx={{ mt: 1.4, display: 'flex', justifyContent: 'center', p: 1.2, bgcolor: 'rgba(15,23,42,0.4)', borderRadius: 2 }}>
          <MarketingPlanPostPreview
            post={post}
            companyHandle={companyHandle}
            logoUrl={logoUrl}
          />
        </Box>
      ) : null}

      {/* #53-bundle — verktøy-knapp (influencer, stock, thumbnail, reach) */}
      <Box sx={{ mt: 0.6 }}>
        <Button
          size="small"
          onClick={() => setToolsOpen((v) => !v)}
          sx={{
            textTransform: 'none',
            fontSize: '0.74rem',
            color: toolsOpen ? '#22d3ee' : 'rgba(226,232,240,0.6)',
            py: 0,
            px: 0.6,
            minWidth: 0,
          }}
        >
          {toolsOpen ? '↑ Skjul verktøy' : '↓ Vis verktøy (influencer, stock, thumbnail, reach)'}
        </Button>
        {toolsOpen ? (
          <Stack
            spacing={1}
            sx={{
              mt: 0.6,
              p: 1,
              borderRadius: 1.4,
              bgcolor: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.18)',
            }}
          >
            {/* #165 ekte: kuratert norsk creator-DB + IG live-stats hvis koblet */}
            <Box>
              <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.74rem', mb: 0.4 }}>
                Anbefalte norske skapere
                {creators?.dataSource === 'curated_plus_live_ig' ? (
                  <Chip size="small" label="+ live IG-stats" sx={{ ml: 0.6, height: 14, fontSize: '0.6rem', bgcolor: 'rgba(225,48,108,0.18)', color: '#fbcfe8' }} />
                ) : null}
              </Typography>
              {loadingCreators ? (
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>Laster…</Typography>
              ) : !creators || creators.creators.length === 0 ? (
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>
                  Ingen treff for denne kombinasjonen av bransje og post-emne.
                </Typography>
              ) : (
                <Stack spacing={0.4}>
                  {creators.creators.slice(0, 6).map((c) => {
                    const live = creators.igEnriched.find((e) => e.handle === c.handle);
                    return (
                      <Box
                        key={c.handle}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.6,
                          p: 0.5,
                          borderRadius: 0.8,
                          bgcolor: 'rgba(15,23,42,0.6)',
                        }}
                      >
                        {live?.profilePictureUrl ? (
                          <Box component="img" src={live.profilePictureUrl} alt="" sx={{ width: 22, height: 22, borderRadius: '50%' }} />
                        ) : (
                          <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: 'rgba(167,139,250,0.2)' }} />
                        )}
                        <Stack spacing={0} sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ color: '#f8fafc', fontSize: '0.74rem', fontWeight: 700 }}>
                            {c.displayName} <Typography component="span" sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.68rem', fontWeight: 400 }}>@{c.handle}</Typography>
                          </Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.66rem' }}>
                            {c.platforms.join(' · ')} · {c.followerTier}
                            {live?.followersCount ? ` · ${(live.followersCount / 1000).toFixed(1)}k followers` : ''}
                            {c.matchedCategories.length > 0 ? ` · ${c.matchedCategories.join(', ')}` : ''}
                          </Typography>
                        </Stack>
                        <Button
                          size="small"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 10 }} />}
                          onClick={() => window.open(`https://instagram.com/${c.handle}`, '_blank', 'noopener,noreferrer')}
                          sx={{ textTransform: 'none', fontSize: '0.66rem', color: '#fbcfe8', minWidth: 0, py: 0, px: 0.4 }}
                        >
                          Åpne
                        </Button>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>

            {/* #167 stock-bilder (ekstern søk — vi har ikke API-key for Unsplash/Pexels) */}
            {stockLinks ? (
              <Box>
                <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.74rem', mb: 0.3 }}>
                  Finn b-roll / stock
                </Typography>
                <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                  {stockLinks.map((link) => (
                    <Button
                      key={link.platform}
                      size="small"
                      endIcon={<OpenInNewIcon sx={{ fontSize: 10 }} />}
                      onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
                      sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#bbf7d0', minWidth: 0 }}
                    >
                      {link.label}
                    </Button>
                  ))}
                </Stack>
              </Box>
            ) : null}

            {/* #168 ekte: DALL-E 3 thumbnail-generering */}
            <Box>
              <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.74rem', mb: 0.3 }}>
                Generer thumbnail (DALL-E 3)
              </Typography>
              {thumbnail ? (
                <Stack spacing={0.4}>
                  <Box
                    component="img"
                    src={thumbnail.imageUrl}
                    alt="Generated thumbnail"
                    sx={{ maxWidth: 240, borderRadius: 1, alignSelf: 'flex-start' }}
                  />
                  <Stack direction="row" spacing={0.4}>
                    <Button
                      size="small"
                      onClick={() => void handleGenerateThumbnail()}
                      disabled={generatingThumbnail}
                      sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#ddd6fe', py: 0 }}
                    >
                      {generatingThumbnail ? 'Genererer…' : 'Generer ny variant'}
                    </Button>
                    <Button
                      size="small"
                      endIcon={<OpenInNewIcon sx={{ fontSize: 10 }} />}
                      onClick={() => window.open(thumbnail.imageUrl, '_blank', 'noopener,noreferrer')}
                      sx={{ textTransform: 'none', fontSize: '0.7rem', color: '#ddd6fe', py: 0 }}
                    >
                      Last ned
                    </Button>
                  </Stack>
                  <Typography sx={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.64rem' }}>
                    OpenAI-URL utløper etter 60 min — last ned hvis du vil ha den varig.
                  </Typography>
                </Stack>
              ) : (
                <Button
                  size="small"
                  onClick={() => void handleGenerateThumbnail()}
                  disabled={generatingThumbnail}
                  startIcon={generatingThumbnail ? <CircularProgress size={12} /> : null}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    color: '#ddd6fe',
                    bgcolor: 'rgba(167,139,250,0.16)',
                    px: 1,
                    py: 0.3,
                  }}
                >
                  {generatingThumbnail ? 'Genererer (15-30s)…' : 'Generer thumbnail med AI'}
                </Button>
              )}
            </Box>

            {/* #169 ekte: reach-estimat fra industry-benchmark + valgfri follower-input */}
            <Box>
              <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.74rem', mb: 0.3 }}>
                Estimert rekkevidde
              </Typography>
              {loadingReach ? (
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>Laster…</Typography>
              ) : reach && reach.available ? (
                <Stack spacing={0.3}>
                  {reach.minReach !== undefined && reach.maxReach !== undefined ? (
                    <Typography sx={{ color: '#bbf7d0', fontSize: '0.84rem', fontWeight: 700 }}>
                      {reach.minReach.toLocaleString('nb-NO')}–{reach.maxReach.toLocaleString('nb-NO')} reach
                      {reach.followerCount ? ` (av ${reach.followerCount.toLocaleString('nb-NO')} followers)` : ''}
                    </Typography>
                  ) : reach.per1000FollowersMin !== undefined ? (
                    <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.78rem' }}>
                      Per 1000 followers: {reach.per1000FollowersMin}–{reach.per1000FollowersMax} reach.
                    </Typography>
                  ) : null}
                  <Stack direction="row" spacing={0.4} alignItems="center">
                    <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.7rem' }}>
                      Følgere:
                    </Typography>
                    <input
                      type="number"
                      placeholder="f.eks. 5000"
                      value={followerInput}
                      onChange={(e) => setFollowerInput(e.target.value)}
                      style={{
                        background: 'rgba(15,23,42,0.7)',
                        border: '1px solid rgba(148,163,184,0.3)',
                        color: '#f8fafc',
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontSize: '0.74rem',
                        width: 100,
                      }}
                    />
                  </Stack>
                  <Typography sx={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.64rem' }}>
                    Kilde: {reach.dataSource === 'connected_account' ? 'koblet konto' : reach.dataSource === 'user_input' ? 'din inntasting' : 'industry-benchmark 2025-2026'}
                    {' · '}konfidens: {reach.confidence}
                  </Typography>
                </Stack>
              ) : (
                <Typography sx={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.7rem' }}>
                  Kunne ikke beregne — sjekk konsoll.
                </Typography>
              )}
            </Box>
          </Stack>
        ) : null}
      </Box>

      {/* #170 — svarmaler-panel */}
      <Box sx={{ mt: 1 }}>
        {!replyTemplates ? (
          <Button
            size="small"
            onClick={() => void handleGenerateReplies()}
            disabled={generatingReplies}
            startIcon={generatingReplies ? <CircularProgress size={12} /> : null}
            sx={{
              textTransform: 'none',
              fontSize: '0.74rem',
              color: 'rgba(226,232,240,0.6)',
              py: 0,
              px: 0.6,
              minWidth: 0,
            }}
          >
            {generatingReplies ? 'Genererer svarmaler…' : 'Generer svarmaler'}
          </Button>
        ) : (
          <Box
            sx={{
              p: 1,
              borderRadius: 1.4,
              bgcolor: 'rgba(15,23,42,0.5)',
              border: '1px solid rgba(148,163,184,0.18)',
            }}
          >
            <Typography sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.78rem', mb: 0.6 }}>
              Svarmaler for kommentarer
            </Typography>
            <Stack spacing={0.6}>
              {(['positive', 'question', 'negative'] as const).map((kind) => {
                const text = replyTemplates[kind];
                if (!text) return null;
                const label = kind === 'positive' ? 'Positiv' : kind === 'question' ? 'Spørsmål' : 'Negativ';
                return (
                  <Box
                    key={kind}
                    sx={{
                      p: 0.6,
                      borderRadius: 1,
                      bgcolor: 'rgba(15,23,42,0.7)',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(15,23,42,0.9)' },
                    }}
                    onClick={() => void navigator.clipboard.writeText(text)}
                  >
                    <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.7rem', mb: 0.2 }}>
                      {label} (klikk for å kopiere)
                    </Typography>
                    <Typography sx={{ color: '#f8fafc', fontSize: '0.78rem', lineHeight: 1.4 }}>
                      {text}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function ClientPortalSection({ projectId, onError }: { projectId: string; onError: (message: string) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [invites, setInvites] = useState<ClientPortalInvite[]>([]);
  const [latestLink, setLatestLink] = useState<string | null>(null);
  const [copyTick, setCopyTick] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await roleRoomAgentService.listClientPortalInvites(projectId);
      if (!cancelled) setInvites(list);
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const handleInvite = useCallback(async () => {
    if (!email.trim()) return;
    setCreating(true);
    try {
      const result = await roleRoomAgentService.createClientPortalInvite({
        projectId,
        clientEmail: email.trim(),
        clientName: name.trim() || null,
      });
      setInvites((current) => [result.invite, ...current]);
      setLatestLink(result.magicLinkUrl);
      setEmail('');
      setName('');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Kunne ikke opprette invitasjon.');
    } finally {
      setCreating(false);
    }
  }, [projectId, email, name, onError]);

  const handleRevoke = useCallback(async (inviteId: string) => {
    if (!window.confirm('Revokere invitasjonen? Klientens lenke stopper å funke umiddelbart.')) return;
    const ok = await roleRoomAgentService.revokeClientPortalInvite(inviteId);
    if (ok) {
      setInvites((current) =>
        current.map((i) => (i.id === inviteId ? { ...i, status: 'revoked' } : i)),
      );
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!latestLink) return;
    try {
      await navigator.clipboard.writeText(latestLink);
      setCopyTick(true);
    } catch {
      /* clipboard may be unavailable; user can select text manually */
    }
  }, [latestLink]);

  return (
    <Box>
      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', mb: 0.4 }}>
        Klient-portal
      </Typography>
      <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem', mb: 1.2 }}>
        Send en magisk lenke til klienten — de ser dashbordet uten å opprette konto. Lenken varer 30 dager.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="stretch">
        <TextField
          placeholder="klient@firma.no"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          size="small"
          fullWidth
          sx={{
            '& .MuiInputBase-root': {
              bgcolor: 'rgba(15,23,42,0.55)',
              color: '#e2e8f0',
              fontSize: '0.88rem',
            },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.22)' },
          }}
        />
        <TextField
          placeholder="Navn (valgfritt)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          sx={{
            minWidth: { sm: 180 },
            '& .MuiInputBase-root': {
              bgcolor: 'rgba(15,23,42,0.55)',
              color: '#e2e8f0',
              fontSize: '0.88rem',
            },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.22)' },
          }}
        />
        <Button
          variant="contained"
          onClick={handleInvite}
          disabled={creating || !email.trim()}
          startIcon={creating ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
            flexShrink: 0,
          }}
        >
          {creating ? 'Lager…' : 'Send invitasjon'}
        </Button>
      </Stack>

      {latestLink ? (
        <Box
          sx={{
            mt: 1.2,
            p: 1.2,
            borderRadius: 2,
            bgcolor: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.24)',
          }}
        >
          <Typography sx={{ color: '#86efac', fontSize: '0.76rem', fontWeight: 700, mb: 0.4 }}>
            Lenken er klar — kopier og lim inn i e-post til klienten
          </Typography>
          <Stack direction="row" spacing={0.6} alignItems="center">
            <Typography
              sx={{
                flex: 1, color: '#e2e8f0', fontSize: '0.82rem',
                fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {latestLink}
            </Typography>
            <Button size="small" onClick={handleCopy} sx={{ textTransform: 'none', color: '#86efac' }}>
              Kopier
            </Button>
          </Stack>
        </Box>
      ) : null}

      {invites.length > 0 ? (
        <Box sx={{ mt: 1.6 }}>
          <Typography sx={{ color: '#cbd5e1', fontSize: '0.76rem', fontWeight: 700, mb: 0.6 }}>
            Aktive invitasjoner
          </Typography>
          <Stack spacing={0.6}>
            {invites.map((invite) => (
              <Stack
                key={invite.id}
                direction="row"
                spacing={0.8}
                alignItems="center"
                sx={{
                  p: 1,
                  borderRadius: 1.4,
                  bgcolor: 'rgba(15,23,42,0.5)',
                  border: '1px solid rgba(148,163,184,0.14)',
                  opacity: invite.status === 'active' ? 1 : 0.5,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: '#e2e8f0', fontSize: '0.86rem', fontWeight: 700 }}>
                    {invite.clientName ? `${invite.clientName} · ` : ''}{invite.clientEmail}
                  </Typography>
                  <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.72rem' }}>
                    {invite.lastSeenAt
                      ? `Sist sett ${new Date(invite.lastSeenAt).toLocaleDateString('nb-NO')}`
                      : 'Ikke besøkt ennå'} · Utløper {new Date(invite.expiresAt).toLocaleDateString('nb-NO')}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={invite.status === 'active' ? 'Aktiv' : invite.status === 'revoked' ? 'Revokert' : 'Utløpt'}
                  sx={{
                    bgcolor: invite.status === 'active' ? 'rgba(34,197,94,0.16)' : 'rgba(148,163,184,0.16)',
                    color: invite.status === 'active' ? '#86efac' : '#cbd5e1',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                  }}
                />
                {invite.status === 'active' ? (
                  <Button
                    size="small"
                    onClick={() => handleRevoke(invite.id)}
                    sx={{ textTransform: 'none', color: 'rgba(248,113,113,0.9)', fontSize: '0.76rem' }}
                  >
                    Revoker
                  </Button>
                ) : null}
              </Stack>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Snackbar
        open={copyTick}
        autoHideDuration={2000}
        onClose={() => setCopyTick(false)}
        message="Lenken er kopiert"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

function KeyValueRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography
        sx={{
          color: '#cbd5e1',
          fontSize: '0.74rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Stack spacing={0.6}>{children}</Stack>
    </Box>
  );
}
