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

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type MarketingPlan,
  type MarketingPlanPost,
  type MarketingPlanReadiness,
  MarketingPlanReadinessError,
  RoleRoomFeedEntitlementError,
} from '../../services/roleRoomAgentService';
import type { RoleRoomAgentProducerBootstrapResult } from '../../services/roleRoomAgentService';

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
      if (activated) setPlan(activated);
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
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.1rem' }}>
            Marketing Plan Engine
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.84rem', mt: 0.2 }}>
            Content pillars, kanalstrategi, KPI-mål og 30-dagers handlingsplan — generert fra research + feed-planner.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={handleGenerate}
          disabled={generating || !readiness?.ready}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
            flexShrink: 0,
          }}
        >
          {generating ? 'Genererer…' : plan ? 'Regenerer' : 'Generer plan'}
        </Button>
      </Stack>

      {generating ? <LinearProgress sx={{ height: 2 }} /> : null}

      {error ? (
        <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#fecaca', border: '1px solid rgba(239,68,68,0.24)' }}>
          {error}
        </Alert>
      ) : null}

      {gateMessage}

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
              {plan.generatedWithModel ? (
                <Chip
                  size="small"
                  label={plan.generatedWithModel}
                  sx={{ bgcolor: 'rgba(148,163,184,0.14)', color: 'rgba(226,232,240,0.78)' }}
                />
              ) : null}
            </Stack>
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

          <StrategySection strategy={plan.strategy} />
          <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
          <PillarsSection pillars={plan.pillars} />
          <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)' }} />
          <PostsSection
            plan={plan}
            posts={posts}
            generating={generatingPosts}
            onGenerate={handleGeneratePosts}
          />
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

function PillarsSection({ pillars }: { pillars: MarketingPlan['pillars'] }) {
  return (
    <Box>
      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem', mb: 1 }}>
        Content pillars ({pillars.length})
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
        {pillars.map((pillar, index) => (
          <Box
            key={pillar.id}
            sx={{
              flex: '1 1 240px',
              minWidth: 0,
              p: 1.2,
              borderRadius: 2.2,
              border: '1px solid rgba(168,85,247,0.24)',
              bgcolor: 'rgba(168,85,247,0.08)',
            }}
          >
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.6 }}>
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
              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
                {pillar.name}
              </Typography>
            </Stack>
            <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.84rem', lineHeight: 1.5, mb: 0.6 }}>
              {pillar.description}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.76rem', lineHeight: 1.45, fontStyle: 'italic' }}>
              {pillar.rationale}
            </Typography>
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
        ))}
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

function PostsSection({
  plan,
  posts,
  generating,
  onGenerate,
}: {
  plan: MarketingPlan;
  posts: MarketingPlanPost[];
  generating: boolean;
  onGenerate: () => void;
}) {
  // Group by pillar so pillar → posts is easy to scan, ordered by
  // pillar sortOrder. Un-pillared posts go at the end under "Uten tag".
  const grouped = useMemo(() => {
    const groups = new Map<string | null, MarketingPlanPost[]>();
    for (const p of posts) {
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
  }, [plan.pillars, posts]);

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
        <Alert
          severity="info"
          sx={{ bgcolor: 'rgba(34,211,238,0.06)', color: '#cbd5e1', border: '1px solid rgba(34,211,238,0.2)' }}
        >
          Ingen post-forslag ennå. Klikk «Generer 30-dagers plan» — Claude bygger én post
          per dag balansert på tvers av pillars, med hook, format, script og CTA ferdig
          skrevet.
        </Alert>
      ) : (
        <Stack spacing={1.4}>
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
                  <PostCard key={post.id} post={post} />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

function PostCard({ post }: { post: MarketingPlanPost }) {
  return (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 2.2,
        border: '1px solid rgba(148,163,184,0.18)',
        bgcolor: 'rgba(15,23,42,0.58)',
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
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

          {post.crossPostPlan.length > 0 ? (
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
        </Box>
      </Stack>
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
