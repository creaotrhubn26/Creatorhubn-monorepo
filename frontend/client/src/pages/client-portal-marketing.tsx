/**
 * /client/portal/:token — klient-dashboardet.
 *
 * Dette er det første (og eneste) klienten ser: en read-only
 * marketing-plan-oversikt med fremdrift, pillars, neste handlinger og
 * hele 30-dagers planen. Autentisering = token-i-URL (magic-link).
 *
 * Klienten kan kommentere direkte på hver post (PostCommentLayer)
 * via magic-link-sessionToken. Kommentarene lagres i samme tabell
 * (role_room_editor_comments) som Bjarne ser i Post Agent's
 * CollaborationSidebar — én delt strøm, to UI-er.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'wouter';
import ClientPortalRequestsSection from '@/components/role-room/client-portal/ClientPortalRequestsSection';
import ClientPortalRegisterCard from '@/components/role-room/client-portal/ClientPortalRegisterCard';
import PostCommentLayer from '@/components/role-room/components/PostCommentLayer';
import PostVideoPreview from '@/components/role-room/components/PostVideoPreview';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Container,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';

interface DashboardPost {
  id: string;
  pillarId: string | null;
  dayOffset: number | null;
  hook: string;
  format: 'reel' | 'carousel' | 'image' | 'story' | 'tiktok' | 'linkedin_post' | 'youtube_short';
  script: string | null;
  callToAction: string | null;
  primaryPlatform: string | null;
  crossPostPlan: Array<{ platform: string; delayDays: number }>;
  status: 'proposed' | 'scheduled' | 'published' | 'skipped';
  scheduledFor: string | null;
  // Preview-video — Stream primær (HLS-playback), R2 fallback (mp4).
  previewStreamPlaybackUrl?: string | null;
  previewStreamThumbnailUrl?: string | null;
  previewStreamReady?: boolean;
  previewStreamDurationSec?: number | null;
  previewVideoR2Url?: string | null;
  // Klient-review (settes når klient klikker Godkjenn / Be om endring)
  clientReviewStatus?: 'pending' | 'approved' | 'changes_requested';
  clientReviewAt?: string | null;
  clientReviewNote?: string | null;
}

interface DashboardPillar {
  id: string;
  name: string;
  description: string;
  rationale: string;
  targetKpi?: { metric: string; target: number; per: string } | null;
  sortOrder: number;
}

interface DashboardPlan {
  id: string;
  projectId: string;
  status: string;
  strategy: {
    channelStrategy: { primary: string; cadencePerWeek: number; secondary: string[]; reasoning: string };
    toneOfVoice: { voice: string; dos: string[]; donts: string[] };
    positioning: { valueProp: string; differentiator: string };
    kpiTargets: Array<{ metric: string; target: number; per: string; rationale: string }>;
  };
  pillars: DashboardPillar[];
  startDate: string | null;
  horizonDays: number;
}

interface DashboardProgress {
  dayIntoPlan: number | null;
  daysRemaining: number | null;
  publishedCount: number;
  scheduledCount: number;
  proposedCount: number;
  skippedCount: number;
}

interface DashboardResponse {
  status: 'ok' | 'no_plan_yet';
  clientName: string | null;
  sessionExpiresAt: string;
  project?: { id: string; title: string | null };
  plan?: DashboardPlan;
  posts?: DashboardPost[];
  progress?: DashboardProgress;
  upcoming?: DashboardPost[];
}

const FORMAT_LABEL: Record<DashboardPost['format'], string> = {
  reel: 'Reel',
  carousel: 'Carousel',
  image: 'Image',
  story: 'Story',
  tiktok: 'TikTok',
  linkedin_post: 'LinkedIn',
  youtube_short: 'YT Short',
};

const FORMAT_COLOR: Record<DashboardPost['format'], string> = {
  reel: '#DD2A7B',
  carousel: '#f58529',
  image: '#22d3ee',
  story: '#a855f7',
  tiktok: '#ec4899',
  linkedin_post: '#3b82f6',
  youtube_short: '#ef4444',
};

export default function ClientPortalMarketingPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Deep-link via ?request=<id> — leses fra window.location ved mount
  // (wouter useSearch er ikke i bruk her). Highlight + auto-expand i
  // ClientPortalRequestsSection bruker denne id-en.
  const highlightRequestId = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('request');
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setError('Mangler lenke-token.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const response = await fetch(
          `/api/client/portal/marketing-plan?token=${encodeURIComponent(token)}`,
        );
        if (response.status === 404) {
          if (!cancelled) setError('Lenken er utløpt eller ikke gyldig. Be produsenten om en ny.');
          return;
        }
        if (!response.ok) {
          if (!cancelled) setError('Noe gikk galt under lasting av dashbordet.');
          return;
        }
        const payload = (await response.json()) as DashboardResponse;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setError('Nettverksfeil — sjekk tilkoblingen.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0b1220', color: '#e2e8f0', display: 'grid', placeItems: 'center' }}>
        <CircularProgress sx={{ color: '#22d3ee' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0b1220', color: '#e2e8f0', display: 'grid', placeItems: 'center', p: 3 }}>
        <Alert severity="error" sx={{ maxWidth: 520 }}>{error}</Alert>
      </Box>
    );
  }

  if (!data) return null;

  if (data.status === 'no_plan_yet') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0b1220', color: '#e2e8f0', p: 3 }}>
        <Container maxWidth="md">
          <Stack spacing={3} sx={{ py: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ color: '#f8fafc', fontWeight: 800, mb: 1 }}>
                Markedsplanen er under utforming
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Hei{data.clientName ? ` ${data.clientName}` : ''} — produsenten din jobber med
                planen akkurat nå. Du får beskjed her så fort den er klar.
              </Typography>
            </Box>
            <ClientPortalRegisterCard token={token} />
            {/* Forespørsler kan likevel vises mens vi venter på plan */}
            <ClientPortalRequestsSection token={token} highlightRequestId={highlightRequestId} />
          </Stack>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b1220', color: '#e2e8f0', pb: 8 }}>
      <HeroHeader data={data} />
      <Container maxWidth="lg" sx={{ mt: 3 }}>
        <Stack spacing={3}>
          <ClientPortalRegisterCard token={token} />
          {/* Forespørsler øverst — viser kun seksjonen hvis det finnes noen */}
          <ClientPortalRequestsSection token={token} highlightRequestId={highlightRequestId} />
          <ProgressSection progress={data.progress!} plan={data.plan!} />
          <UpcomingSection upcoming={data.upcoming!} projectId={data.project?.id ?? null} clientToken={token} />
          <StrategyCard plan={data.plan!} />
          <PillarsCard pillars={data.plan!.pillars} />
          <AllPostsCard posts={data.posts!} pillars={data.plan!.pillars} projectId={data.project?.id ?? null} clientToken={token} />
        </Stack>
      </Container>
      <Typography
        sx={{
          textAlign: 'center',
          color: 'rgba(148,163,184,0.6)',
          fontSize: '0.78rem',
          mt: 4,
        }}
      >
        Lenken utløper {new Date(data.sessionExpiresAt).toLocaleDateString('nb-NO')}. Ikke del
        denne URL-en utenfor teamet ditt — alle som har lenken ser det samme du ser.
      </Typography>
    </Box>
  );
}

function HeroHeader({ data }: { data: DashboardResponse }) {
  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, rgba(34,211,238,0.12) 0%, rgba(168,85,247,0.12) 100%)',
        borderBottom: '1px solid rgba(148,163,184,0.14)',
        pt: 5,
        pb: 3,
      }}
    >
      <Container maxWidth="lg">
        <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', mb: 0.5 }}>
          MARKEDSPLAN
        </Typography>
        <Typography variant="h4" sx={{ color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
          {data.project?.title ?? data.plan?.strategy.positioning.valueProp ?? 'Din markedsplan'}
        </Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.95rem', mt: 0.5 }}>
          {data.clientName ? `Velkommen ${data.clientName}.` : 'Velkommen.'} Her er hvor prosjektet står nå.
        </Typography>
      </Container>
    </Box>
  );
}

function ProgressSection({ progress, plan }: { progress: DashboardProgress; plan: DashboardPlan }) {
  const total = progress.publishedCount + progress.scheduledCount + progress.proposedCount + progress.skippedCount;
  const percentPublished = total === 0 ? 0 : (progress.publishedCount / total) * 100;
  return (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.16)' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
        <Box>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.04rem' }}>
            {progress.dayIntoPlan !== null
              ? `Dag ${progress.dayIntoPlan} av ${plan.horizonDays}`
              : 'Planen er klar — ikke aktivert ennå'}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.86rem' }}>
            {progress.dayIntoPlan !== null
              ? `${progress.daysRemaining} dager igjen på horisonten.`
              : 'Produsenten starter tellingen når dere trykker aktiver.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
          <StatChip label="Publisert" value={progress.publishedCount} color="#22c55e" />
          <StatChip label="Planlagt" value={progress.scheduledCount} color="#22d3ee" />
          <StatChip label="Forslag" value={progress.proposedCount} color="#a855f7" />
          {progress.skippedCount > 0 ? (
            <StatChip label="Hoppet over" value={progress.skippedCount} color="#94a3b8" />
          ) : null}
        </Stack>
      </Stack>
      <Box sx={{ mt: 2 }}>
        <LinearProgress
          variant="determinate"
          value={percentPublished}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(148,163,184,0.16)',
            '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' },
          }}
        />
        <Typography sx={{ color: 'rgba(226,232,240,0.64)', fontSize: '0.76rem', mt: 0.6 }}>
          {progress.publishedCount} av {total} posts publisert ({percentPublished.toFixed(0)}%).
        </Typography>
      </Box>
    </Box>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box
      sx={{
        px: 1.2,
        py: 0.6,
        borderRadius: 1.6,
        bgcolor: 'rgba(15,23,42,0.6)',
        border: `1px solid ${color}33`,
        minWidth: 90,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ color, fontWeight: 800, fontSize: '1.1rem' }}>{value}</Typography>
      <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </Typography>
    </Box>
  );
}

function UpcomingSection({ upcoming, projectId, clientToken }: {
  upcoming: DashboardPost[];
  projectId: string | null;
  clientToken: string;
}) {
  if (upcoming.length === 0) return null;
  return (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.24)' }}>
      <Typography sx={{ color: '#a5f3fc', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1 }}>
        Neste på planen
      </Typography>
      <Stack spacing={1}>
        {upcoming.map((post) => (
          <PostRow key={post.id} post={post} compact projectId={projectId} clientToken={clientToken} />
        ))}
      </Stack>
    </Box>
  );
}

function StrategyCard({ plan }: { plan: DashboardPlan }) {
  return (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.16)' }}>
      <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.04rem', mb: 1.5 }}>
        Strategi
      </Typography>
      <Stack spacing={1.4}>
        <Box>
          <Typography sx={{ color: '#a5f3fc', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.4 }}>
            Posisjonering
          </Typography>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.92rem', lineHeight: 1.6 }}>
            <strong>Verditilbud:</strong> {plan.strategy.positioning.valueProp}
          </Typography>
          <Typography sx={{ color: '#e2e8f0', fontSize: '0.92rem', lineHeight: 1.6 }}>
            <strong>Differensiering:</strong> {plan.strategy.positioning.differentiator}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ color: '#a5f3fc', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.4 }}>
            Kanalstrategi
          </Typography>
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mb: 0.6 }}>
            <Chip size="small" label={`Primær: ${plan.strategy.channelStrategy.primary}`} sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#a5f3fc' }} />
            <Chip size="small" label={`${plan.strategy.channelStrategy.cadencePerWeek}/uke`} sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff' }} />
            {plan.strategy.channelStrategy.secondary.map((s) => (
              <Chip key={s} size="small" label={s} variant="outlined" sx={{ color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.3)' }} />
            ))}
          </Stack>
          <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.86rem', lineHeight: 1.5 }}>
            {plan.strategy.channelStrategy.reasoning}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ color: '#a5f3fc', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.4 }}>
            KPI-mål
          </Typography>
          <Stack spacing={0.6}>
            {plan.strategy.kpiTargets.map((kpi, i) => (
              <Box key={i} sx={{ p: 1, bgcolor: 'rgba(15,23,42,0.6)', borderRadius: 1.4, border: '1px solid rgba(148,163,184,0.14)' }}>
                <Typography sx={{ color: '#f8fafc', fontSize: '0.88rem', fontWeight: 700 }}>
                  {kpi.target.toLocaleString('nb-NO')} {kpi.metric.replace(/_/g, ' ')} <span style={{ color: '#a5f3fc' }}>per {kpi.per}</span>
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.8rem', mt: 0.2 }}>
                  {kpi.rationale}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function PillarsCard({ pillars }: { pillars: DashboardPillar[] }) {
  return (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.16)' }}>
      <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.04rem', mb: 1.5 }}>
        Content pillars ({pillars.length})
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} flexWrap="wrap" useFlexGap>
        {pillars.map((pillar, index) => (
          <Box
            key={pillar.id}
            sx={{
              flex: '1 1 240px',
              minWidth: 0,
              p: 1.5,
              borderRadius: 2.2,
              border: '1px solid rgba(168,85,247,0.26)',
              bgcolor: 'rgba(168,85,247,0.06)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.6 }}>
              <Box
                sx={{
                  width: 24, height: 24, borderRadius: '50%',
                  bgcolor: 'rgba(168,85,247,0.24)', color: '#e9d5ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 800,
                }}
              >
                {index + 1}
              </Box>
              <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.96rem' }}>
                {pillar.name}
              </Typography>
            </Stack>
            <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.86rem', lineHeight: 1.5, mb: 0.4 }}>
              {pillar.description}
            </Typography>
            {pillar.targetKpi ? (
              <Chip
                size="small"
                label={`${pillar.targetKpi.target.toLocaleString('nb-NO')} ${pillar.targetKpi.metric.replace(/_/g, ' ')}/${pillar.targetKpi.per}`}
                sx={{ mt: 0.6, bgcolor: 'rgba(168,85,247,0.16)', color: '#e9d5ff', fontWeight: 700, fontSize: '0.72rem' }}
              />
            ) : null}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function AllPostsCard({ posts, pillars, projectId, clientToken }: {
  posts: DashboardPost[];
  pillars: DashboardPillar[];
  projectId: string | null;
  clientToken: string;
}) {
  const grouped = useMemo(() => {
    const byPillar = new Map<string | null, DashboardPost[]>();
    for (const p of posts) {
      const key = p.pillarId;
      if (!byPillar.has(key)) byPillar.set(key, []);
      byPillar.get(key)!.push(p);
    }
    const out: Array<{ name: string; posts: DashboardPost[] }> = [];
    for (const pillar of pillars) {
      const g = byPillar.get(pillar.id) ?? [];
      if (g.length > 0) out.push({ name: pillar.name, posts: g });
    }
    const orphans = byPillar.get(null) ?? [];
    if (orphans.length > 0) out.push({ name: 'Uten tema', posts: orphans });
    return out;
  }, [posts, pillars]);

  if (posts.length === 0) return null;

  return (
    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.16)' }}>
      <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.04rem', mb: 1.5 }}>
        Hele planen ({posts.length} posts)
      </Typography>
      <Stack spacing={2}>
        {grouped.map((group) => (
          <Box key={group.name}>
            <Typography sx={{ color: '#e9d5ff', fontWeight: 700, fontSize: '0.88rem', mb: 0.8 }}>
              {group.name} · {group.posts.length}
            </Typography>
            <Stack spacing={0.8}>
              {group.posts.map((post) => (
                <PostRow key={post.id} post={post} projectId={projectId} clientToken={clientToken} />
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function PostRow({ post, compact, projectId, clientToken }: {
  post: DashboardPost;
  compact?: boolean;
  projectId: string | null;
  clientToken: string;
}) {
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [timestampMarkers, setTimestampMarkers] = useState<Array<{ sec: number; label: string }>>([]);
  const seek = useMemo(() => (sec: number) => {
    if (videoEl) {
      videoEl.currentTime = sec;
      void videoEl.play().catch(() => { /* ignore play-restrictions */ });
    }
  }, [videoEl]);
  const statusColor = post.status === 'published'
    ? '#22c55e'
    : post.status === 'scheduled'
      ? '#22d3ee'
      : post.status === 'skipped'
        ? '#94a3b8'
        : '#a855f7';
  const statusLabel = post.status === 'published'
    ? 'Publisert'
    : post.status === 'scheduled'
      ? 'Planlagt'
      : post.status === 'skipped'
        ? 'Hoppet over'
        : 'Forslag';
  return (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(148,163,184,0.14)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 44, minHeight: 44,
            borderRadius: 1.4,
            bgcolor: 'rgba(34,211,238,0.12)',
            color: '#a5f3fc',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            px: 1,
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em' }}>DAG</Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 800 }}>
            {post.dayOffset !== null ? post.dayOffset + 1 : '—'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mb: 0.4 }}>
            <Chip size="small" label={FORMAT_LABEL[post.format]} sx={{ bgcolor: `${FORMAT_COLOR[post.format]}33`, color: '#fff', fontWeight: 700, fontSize: '0.7rem' }} />
            <Chip size="small" label={statusLabel} sx={{ bgcolor: `${statusColor}1f`, color: statusColor, fontWeight: 700, fontSize: '0.7rem' }} />
            {post.primaryPlatform ? (
              <Chip size="small" label={post.primaryPlatform} variant="outlined" sx={{ color: '#cbd5e1', borderColor: 'rgba(148,163,184,0.3)', fontSize: '0.7rem' }} />
            ) : null}
          </Stack>
          <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: compact ? '0.88rem' : '0.94rem', lineHeight: 1.4 }}>
            {post.hook}
          </Typography>
          {!compact && post.callToAction ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.82rem', mt: 0.4 }}>
              <strong style={{ color: '#86efac' }}>CTA:</strong> {post.callToAction}
            </Typography>
          ) : null}
        </Box>
      </Box>
      {!compact && (post.previewStreamPlaybackUrl || post.previewVideoR2Url) ? (
        <PostVideoPreview
          streamPlaybackUrl={post.previewStreamPlaybackUrl}
          streamThumbnailUrl={post.previewStreamThumbnailUrl}
          streamReady={post.previewStreamReady}
          r2VideoUrl={post.previewVideoR2Url}
          durationSec={post.previewStreamDurationSec}
          onCurrentTime={setCurrentTimeSec}
          onVideoEl={setVideoEl}
          timestampMarkers={timestampMarkers}
        />
      ) : null}
      {!compact && projectId ? (
        <>
          <PostReviewControls
            postId={post.id}
            clientToken={clientToken}
            currentStatus={post.clientReviewStatus ?? 'pending'}
            reviewedAt={post.clientReviewAt ?? null}
            note={post.clientReviewNote ?? null}
          />
          <PostCommentLayer
            projectId={projectId}
            anchorType="marketing_plan_post"
            anchorRef={post.id}
            auth={{ kind: 'client-portal', sessionToken: clientToken }}
            currentTimeSec={currentTimeSec}
            onSeek={seek}
            onTimestampCommentsChanged={setTimestampMarkers}
          />
        </>
      ) : null}
    </Box>
  );
}

function PostReviewControls({
  postId, clientToken,
  currentStatus, reviewedAt, note,
}: {
  postId: string;
  clientToken: string;
  currentStatus: 'pending' | 'approved' | 'changes_requested';
  reviewedAt: string | null;
  note: string | null;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [reviewedAtLocal, setReviewedAtLocal] = useState(reviewedAt);
  const [noteLocal, setNoteLocal] = useState(note);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (s: 'approved' | 'changes_requested', n: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/client/portal/marketing-plan-posts/${encodeURIComponent(postId)}/review`
        + `?token=${encodeURIComponent(clientToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: s, note: n }),
        },
      );
      if (!res.ok) {
        const detail = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(detail.error || `HTTP ${res.status}`);
      }
      const data = await res.json() as { reviewedAt: string };
      setStatus(s);
      setReviewedAtLocal(data.reviewedAt);
      setNoteLocal(n || null);
      setShowNoteForm(false);
      setNoteDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status !== 'pending') {
    const label = status === 'approved' ? 'Godkjent' : 'Be om endring sendt';
    const bg = status === 'approved' ? 'rgba(74,212,138,0.12)' : 'rgba(240,165,0,0.12)';
    const border = status === 'approved' ? 'rgba(74,212,138,0.32)' : 'rgba(240,165,0,0.32)';
    const color = status === 'approved' ? '#4ad48a' : '#f0a500';
    return (
      <Box sx={{
        mt: 1, p: 1.2, borderRadius: 1.6,
        bgcolor: bg, border: `1px solid ${border}`,
      }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ color, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {label}
          </Typography>
          {reviewedAtLocal && (
            <Typography sx={{ color: 'rgba(226,232,240,0.65)', fontSize: '0.74rem' }}>
              · {new Date(reviewedAtLocal).toLocaleString('nb', {
                day: '2-digit', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
            </Typography>
          )}
        </Stack>
        {noteLocal && (
          <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '0.82rem', mt: 0.4, fontStyle: 'italic' }}>
            "{noteLocal}"
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1 }}>
      {!showNoteForm ? (
        <Stack direction="row" spacing={1}>
          <button onClick={() => void submit('approved', '')}
                  disabled={submitting}
                  style={{
                    background: 'linear-gradient(135deg, #4ad48a, #2db66f)',
                    border: 0, color: '#0a1a14',
                    padding: '8px 14px', fontSize: 12, fontWeight: 700,
                    borderRadius: 4, cursor: submitting ? 'wait' : 'pointer',
                    flex: 1,
                  }}>
            {submitting ? 'Sender …' : 'Godkjenn'}
          </button>
          <button onClick={() => setShowNoteForm(true)}
                  disabled={submitting}
                  style={{
                    background: 'rgba(240,165,0,0.18)',
                    border: '1px solid rgba(240,165,0,0.42)',
                    color: '#f0a500',
                    padding: '8px 14px', fontSize: 12, fontWeight: 700,
                    borderRadius: 4, cursor: 'pointer',
                    flex: 1,
                  }}>
            Be om endring
          </button>
        </Stack>
      ) : (
        <Box>
          <textarea value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={3}
                    placeholder="Hva ønsker du endret?"
                    style={{
                      width: '100%',
                      background: 'rgba(15,23,42,0.7)',
                      border: '1px solid rgba(240,165,0,0.32)',
                      borderRadius: 4, padding: '8px 10px',
                      color: '#e2e8f0', fontSize: 13,
                      fontFamily: 'inherit', resize: 'vertical',
                    }} />
          <Stack direction="row" spacing={1} sx={{ mt: 0.8 }}>
            <button onClick={() => void submit('changes_requested', noteDraft.trim())}
                    disabled={submitting || !noteDraft.trim()}
                    style={{
                      background: noteDraft.trim()
                        ? 'linear-gradient(135deg, #f0a500, #d4940a)'
                        : 'rgba(240,165,0,0.18)',
                      border: 0, color: '#1a0f00',
                      padding: '6px 12px', fontSize: 12, fontWeight: 700,
                      borderRadius: 4,
                      cursor: noteDraft.trim() && !submitting ? 'pointer' : 'not-allowed',
                      opacity: noteDraft.trim() ? 1 : 0.5,
                    }}>
              Send
            </button>
            <button onClick={() => { setShowNoteForm(false); setNoteDraft(''); }}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(148,163,184,0.32)',
                      color: 'rgba(226,232,240,0.78)',
                      padding: '6px 12px', fontSize: 12, fontWeight: 600,
                      borderRadius: 4, cursor: 'pointer',
                    }}>
              Avbryt
            </button>
          </Stack>
        </Box>
      )}
      {error && (
        <Typography sx={{ color: '#ef4f6f', fontSize: '0.78rem', mt: 0.6 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
