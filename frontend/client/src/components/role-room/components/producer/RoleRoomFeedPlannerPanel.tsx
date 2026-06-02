import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Skeleton, Stack, Typography } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AutoAwesome as AutoAwesomeIcon,
  PictureAsPdf as PictureAsPdfIcon,
  RestartAlt as RestartAltIcon,
} from '@mui/icons-material';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import type {
  RoleRoomAgentBrandColor,
  RoleRoomAgentProducerBootstrapResult,
  RoleRoomFeedBrandSnapshot,
  RoleRoomFeedPlatform,
  RoleRoomFeedPost,
} from '../../services/roleRoomAgentService';
import {
  FEED_POST_CONCEPT_ORDER,
  buildDefaultSchedule,
  deriveBrandSnapshot,
  generateFeedPostsFromBootstrap,
} from '../../utils/feedPlanner';
import roleRoomAgentService from '../../services/roleRoomAgentService';
import { downloadFeedPlanPdf, generateFeedPlanPdf } from '../../utils/feedPlannerPdf';
import {
  fetchAgentEntitlement,
  type EntitlementBundle,
} from '../../services/roleRoomAgentEntitlementApi';
import AgentPaywallDialog from '../ai/AgentPaywallDialog';
import RoleRoomTierIcon, { ROLE_ROOM_TIERS, tierForEntitlementSource, type RoleRoomTierSlug } from './RoleRoomTierIcon';
import InstagramConnectionCard from './InstagramConnectionCard';
import YouTubeChannelSetup from './YouTubeChannelSetup';
import LinkedInConnectionCard from './LinkedInConnectionCard';
import TikTokConnectionCard from './TikTokConnectionCard';
import type { RoleRoomInstagramConnection } from '../../services/roleRoomAgentService';
import FeedPostDetailPanel from './FeedPostDetailPanel';
import FeedPlanTimeline from './FeedPlanTimeline';
import SocialBrandLogo, { InstagramBrandLogo } from './SocialBrandLogo';
import { buildFeedPost } from '../../utils/feedPlanner';
import { describeProducerError } from '../../utils/producerErrorMessage';
import SortableFeedPostTile from './SortableFeedPostTile';

type RoleRoomFeedPlannerPanelProps = {
  projectId: string;
  bootstrap: RoleRoomAgentProducerBootstrapResult | null;
  onRequestBootstrap?: () => void;
};

type PlatformOption = {
  id: RoleRoomFeedPlatform;
  label: string;
  /** Lavest tier-nivå som kan aktivere plattformen. */
  minimumTierLevel: number;
};

const PLATFORM_OPTIONS: PlatformOption[] = [
  { id: 'instagram', label: 'Instagram', minimumTierLevel: 1 },
  { id: 'tiktok', label: 'TikTok', minimumTierLevel: 2 },
  { id: 'linkedin', label: 'LinkedIn', minimumTierLevel: 2 },
];

export default function RoleRoomFeedPlannerPanel({
  projectId,
  bootstrap,
  onRequestBootstrap,
}: RoleRoomFeedPlannerPanelProps) {
  const [platform, setPlatform] = useState<RoleRoomFeedPlatform>('instagram');
  const [posts, setPosts] = useState<RoleRoomFeedPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [entitlementMessage, setEntitlementMessage] = useState<string | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [entitlementBundle, setEntitlementBundle] = useState<EntitlementBundle | null>(null);

  // Hent entitlement én gang ved mount så vi kan vise tier-badge og låse
  // platform-chips proaktivt (i stedet for å vente på et 402-svar).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bundle = await fetchAgentEntitlement();
        if (!cancelled) setEntitlementBundle(bundle);
      } catch {
        /* ignore — UI fungerer fortsatt */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentTierSlug: RoleRoomTierSlug = useMemo(
    () => tierForEntitlementSource(entitlementBundle?.entitlement?.source ?? 'none'),
    [entitlementBundle],
  );
  const currentTierLevel = ROLE_ROOM_TIERS[currentTierSlug].level;
  const isShowrunner = currentTierSlug === 'showrunner' || currentTierSlug === 'admin';
  const [instagramConnections, setInstagramConnections] = useState<RoleRoomInstagramConnection[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Tracks whether the current `posts` value is the freshly seeded baseline
  // or has user edits in it. We only persist after the user (or AI) actually
  // touches something, so reopening the dialog doesn't write a no-op.
  const [dirty, setDirty] = useState(false);

  const brandSnapshot = useMemo<RoleRoomFeedBrandSnapshot | null>(
    () => (bootstrap ? deriveBrandSnapshot(bootstrap) : null),
    [bootstrap],
  );

  const brandColors = useMemo<RoleRoomAgentBrandColor[]>(() => {
    const raw = bootstrap?.planningDraft?.brandGuide?.colors;
    return Array.isArray(raw) ? raw.filter((entry) => Boolean(entry?.hex)) : [];
  }, [bootstrap]);

  // Load any persisted plan for this (project, platform). On miss, seed from
  // the bootstrap so the user always sees a populated feed. The dirty flag is
  // reset both ways so we don't re-save a freshly loaded snapshot.
  useEffect(() => {
    if (!bootstrap) {
      setPosts([]);
      setSelectedPostId(null);
      setDirty(false);
      return;
    }
    let cancelled = false;
    setLoadingPlan(true);
    setSaveError(null);
    void (async () => {
      try {
        const persisted = await roleRoomAgentService.loadFeedPlan(projectId, platform);
        if (cancelled) return;
        if (persisted && Array.isArray(persisted.posts) && persisted.posts.length > 0) {
          setPosts(persisted.posts);
          setLastSavedAt(persisted.updatedAt ?? null);
        } else {
          setPosts(generateFeedPostsFromBootstrap(bootstrap, platform));
          setLastSavedAt(null);
        }
        setSelectedPostId(null);
        setDirty(false);
      } catch (error) {
        if (!cancelled) {
          setPosts(generateFeedPostsFromBootstrap(bootstrap, platform));
          setSelectedPostId(null);
          setDirty(false);
        }
      } finally {
        if (!cancelled) setLoadingPlan(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, platform, projectId]);

  // Debounced auto-save once the user (or AI) has modified posts. 1.5s window
  // is short enough to feel reactive, long enough to coalesce caption typing.
  useEffect(() => {
    if (!dirty || !bootstrap) return;
    const handle = window.setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      try {
        const result = await roleRoomAgentService.saveFeedPlan(
          projectId,
          platform,
          posts,
          brandSnapshot,
        );
        if (result?.updatedAt) setLastSavedAt(result.updatedAt);
        setDirty(false);
      } catch (error) {
        setSaveError(describeProducerError(error, 'lagre feed-planen'));
      } finally {
        setSaving(false);
      }
    }, 1500);
    return () => window.clearTimeout(handle);
  }, [dirty, posts, projectId, platform, brandSnapshot, bootstrap]);

  // Bulk-godkjenning: alle utkast (state='draft' eller 'needs_changes')
  // settes til 'approved'. Brukes av producer som har gått gjennom
  // forslagene én etter én og vil signere av hele batchen på én gang.
  const draftCount = useMemo(
    () =>
      posts.filter((p) => !p.approvalState || p.approvalState === 'draft' || p.approvalState === 'needs_changes')
        .length,
    [posts],
  );
  const [bulkApproving, setBulkApproving] = useState(false);
  const approveAllDrafts = async () => {
    const ids = posts
      .filter(
        (p) => !p.approvalState || p.approvalState === 'draft' || p.approvalState === 'needs_changes',
      )
      .map((p) => p.id);
    if (ids.length === 0) return;
    setBulkApproving(true);
    try {
      const result = await roleRoomAgentService.setFeedPostApproval({
        projectId,
        platform,
        postIds: ids,
        approvalState: 'approved',
      });
      if (result.success) {
        const now = new Date().toISOString();
        setPosts((current) =>
          current.map((p) =>
            ids.includes(p.id)
              ? { ...p, approvalState: 'approved', approvalChangedAt: now, approvalNote: null }
              : p,
          ),
        );
      }
    } finally {
      setBulkApproving(false);
    }
  };

  const regenerateAll = () => {
    if (!bootstrap) return;
    setPosts((current) => {
      const regenerated = generateFeedPostsFromBootstrap(bootstrap, platform, { rotate: true });
      // Preserve locked posts and their custom images; only overwrite unlocked.
      return regenerated.map((next, index) => {
        const existing = current[index];
        if (existing?.locked) {
          return existing;
        }
        if (existing?.customImageUrl) {
          return {
            ...next,
            customImageUrl: existing.customImageUrl,
            customImageName: existing.customImageName,
          };
        }
        return next;
      });
    });
    setDirty(true);
  };

  const updatePost = (postId: string, patch: Partial<RoleRoomFeedPost>) => {
    setPosts((current) =>
      current.map((post) => (post.id === postId ? { ...post, ...patch } : post)),
    );
    setDirty(true);
  };

  const regeneratePost = (post: RoleRoomFeedPost) => {
    if (!bootstrap || post.locked) return;
    const index = posts.findIndex((entry) => entry.id === post.id);
    if (index < 0) return;
    const rebuilt = buildFeedPost(bootstrap, {
      id: post.id,
      index,
      concept: post.concept as any,
      platform,
    });
    setPosts((current) =>
      current.map((entry) =>
        entry.id === post.id
          ? {
              ...rebuilt,
              customImageUrl: entry.customImageUrl ?? null,
              customImageName: entry.customImageName ?? null,
              scheduledFor: entry.scheduledFor,
            }
          : entry,
      ),
    );
    setDirty(true);
  };

  const selectedPost = selectedPostId
    ? posts.find((post) => post.id === selectedPostId) ?? null
    : null;
  const selectedPostIndex = selectedPost ? posts.findIndex((p) => p.id === selectedPost.id) : -1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setPosts((current) => {
      const fromIndex = current.findIndex((post) => post.id === active.id);
      const toIndex = current.findIndex((post) => post.id === over.id);
      if (fromIndex < 0 || toIndex < 0) return current;
      return arrayMove(current, fromIndex, toIndex);
    });
    setDirty(true);
  };

  const autoSchedule = () => {
    setPosts((current) => buildDefaultSchedule(current));
    setDirty(true);
  };

  const clearSchedule = () => {
    setPosts((current) => current.map((post) => ({ ...post, scheduledFor: null })));
    setDirty(true);
  };

  const [exportingPdf, setExportingPdf] = useState(false);
  const [refreshingStrategy, setRefreshingStrategy] = useState(false);
  const [strategyRefreshNote, setStrategyRefreshNote] = useState<string | null>(null);

  const isAdmin = currentTierSlug === 'admin';

  const refreshStrategy = async () => {
    if (!isAdmin) return;
    setRefreshingStrategy(true);
    setStrategyRefreshNote(null);
    try {
      const result = await roleRoomAgentService.refreshFeedPlanStrategy(platform);
      if (result.success) {
        setStrategyRefreshNote(`Strategi for ${platform} oppdatert.`);
      } else {
        setStrategyRefreshNote(
          result.error
            ? `Strategioppdateringen feilet: ${result.error}`
            : 'Strategioppdateringen kunne ikke fullføres. Prøv igjen.',
        );
      }
    } catch (refreshError) {
      setStrategyRefreshNote(describeProducerError(refreshError, 'oppdatere feed-strategien'));
    } finally {
      setRefreshingStrategy(false);
      window.setTimeout(() => setStrategyRefreshNote(null), 6000);
    }
  };
  const exportPdf = async () => {
    if (posts.length === 0) return;
    setExportingPdf(true);
    try {
      const blob = await generateFeedPlanPdf({
        brand: brandSnapshot,
        platform,
        posts,
      });
      const safeName = (brandSnapshot?.companyName || 'merke')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .toLowerCase()
        .slice(0, 60);
      downloadFeedPlanPdf(blob, `role-room-feed-${safeName}-${platform}.pdf`);
    } catch (error) {
      console.error('[feed-planner] PDF export failed', error);
    } finally {
      setExportingPdf(false);
    }
  };

  if (!bootstrap) {
    return (
      <Stack
        spacing={1.4}
        sx={{
          p: 3,
          minHeight: 360,
          border: '1px dashed rgba(148,163,184,0.24)',
          borderRadius: 2,
          bgcolor: 'rgba(15,23,42,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <AutoAwesomeIcon sx={{ color: '#22d3ee', fontSize: 40 }} />
        <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1.05rem' }}>
          Analyser kunden først
        </Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.9rem', maxWidth: 520 }}>
          Feed-planneren henter logo, merkefarger, tone og innholdsidéer fra research-fanen. Kjør en
          analyse for å se et brand-tilpasset Instagram-feed med forslag til innlegg.
        </Typography>
        {onRequestBootstrap ? (
          <Button
            variant="contained"
            onClick={onRequestBootstrap}
            sx={{
              mt: 0.5,
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)',
            }}
          >
            Gå til research
          </Button>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack spacing={1.8}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
      >
        <Stack spacing={0.4}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1.08rem' }}>
              Feed-planner
            </Typography>
            <Chip
              icon={
                <Box sx={{ display: 'inline-flex', ml: 0.6 }}>
                  <RoleRoomTierIcon tier={currentTierSlug} size={14} />
                </Box>
              }
              label={ROLE_ROOM_TIERS[currentTierSlug].shortName}
              size="small"
              variant="outlined"
              onClick={currentTierSlug === 'spotlight' ? () => setPaywallOpen(true) : undefined}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 700,
                color: ROLE_ROOM_TIERS[currentTierSlug].accentHex,
                borderColor: `${ROLE_ROOM_TIERS[currentTierSlug].accentHex}55`,
                bgcolor: 'transparent',
                cursor: currentTierSlug === 'spotlight' ? 'pointer' : 'default',
                '& .MuiChip-icon': { ml: 0.2 },
              }}
              title={
                currentTierSlug === 'spotlight'
                  ? 'Klikk for å oppgradere til Headliner eller Showrunner'
                  : ROLE_ROOM_TIERS[currentTierSlug].tagline
              }
            />
          </Stack>
          <Typography sx={{ color: 'rgba(226,232,240,0.64)', fontSize: '0.84rem' }}>
            Planlegg hvordan kundens feed skal se ut. Posts bruker logo, merkefarger og tone fra analysen.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
          {PLATFORM_OPTIONS.map((option) => {
            const requiredTier = option.minimumTierLevel === 2 ? ROLE_ROOM_TIERS.headliner : ROLE_ROOM_TIERS.spotlight;
            const allowed = currentTierLevel >= option.minimumTierLevel;
            const active = option.id === platform && allowed;
            const lockedHint = `Krever Role Room ${requiredTier.shortName} eller høyere`;

            return (
              <Chip
                key={option.id}
                icon={
                  <Box sx={{ display: 'inline-flex', ml: 0.5 }}>
                    <SocialBrandLogo platform={option.id} size={18} />
                  </Box>
                }
                label={allowed ? option.label : `${option.label} · ${requiredTier.shortName}`}
                onClick={() => {
                  if (allowed) {
                    setPlatform(option.id);
                  } else {
                    // Åpne paywall så bruker kan oppgradere fra Spotlight til Headliner.
                    setEntitlementMessage(lockedHint);
                    setPaywallOpen(true);
                  }
                }}
                variant={active ? 'filled' : 'outlined'}
                sx={{
                  cursor: 'pointer',
                  opacity: allowed ? 1 : 0.7,
                  color: active ? '#0b1220' : 'rgba(226,232,240,0.88)',
                  bgcolor: active ? 'rgba(34,211,238,0.95)' : 'transparent',
                  borderColor: active
                    ? 'transparent'
                    : allowed
                      ? 'rgba(148,163,184,0.32)'
                      : `${requiredTier.accentHex}55`,
                  fontWeight: 700,
                  '& .MuiChip-icon': { ml: 0.2 },
                  '&:hover': {
                    bgcolor: active
                      ? 'rgba(34,211,238,0.95)'
                      : allowed
                        ? 'rgba(34,211,238,0.08)'
                        : `${requiredTier.accentHex}18`,
                  },
                }}
                title={allowed ? option.label : lockedHint}
              />
            );
          })}
        </Stack>
      </Stack>

      <BrandSummaryStrip brandSnapshot={brandSnapshot} brandColors={brandColors} />

      {isShowrunner ? (
        <InstagramConnectionCard
          projectId={projectId}
          showrunner={isShowrunner}
          onConnectionsChange={setInstagramConnections}
        />
      ) : null}

      {platform === 'youtube' ? <YouTubeChannelSetup projectId={projectId} /> : null}
      {platform === 'linkedin' ? <LinkedInConnectionCard projectId={projectId} /> : null}
      {platform === 'tiktok' ? <TikTokConnectionCard projectId={projectId} /> : null}

      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ color: 'rgba(226,232,240,0.68)', fontSize: '0.82rem' }}>
            {posts.length} forslag
          </Typography>
          <SaveStatusBadge
            loading={loadingPlan}
            saving={saving}
            dirty={dirty}
            error={saveError}
            lastSavedAt={lastSavedAt}
          />
        </Stack>
        <Stack direction="row" spacing={0.6}>
          {isAdmin ? (
            <Button
              size="small"
              startIcon={<RestartAltIcon fontSize="small" />}
              onClick={refreshStrategy}
              disabled={refreshingStrategy}
              title={strategyRefreshNote ?? 'Tving CI-oppdatering av plattform-strategi'}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                color: '#64748b',
                '&:hover': { bgcolor: 'rgba(100,116,139,0.08)' },
              }}
            >
              {refreshingStrategy ? 'Oppdaterer…' : 'Refresh strategi'}
            </Button>
          ) : null}
          <Button
            size="small"
            startIcon={<PictureAsPdfIcon fontSize="small" />}
            onClick={exportPdf}
            disabled={exportingPdf || posts.length === 0}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: '#fbbf24',
              '&:hover': { bgcolor: 'rgba(251,191,36,0.08)' },
            }}
          >
            {exportingPdf ? 'Lager PDF…' : 'Eksporter PDF'}
          </Button>
          <Button
            size="small"
            startIcon={<RestartAltIcon fontSize="small" />}
            onClick={regenerateAll}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              color: '#22d3ee',
              '&:hover': { bgcolor: 'rgba(34,211,238,0.08)' },
            }}
          >
            Regenerer alle forslag
          </Button>
          {draftCount > 0 ? (
            <Button
              size="small"
              variant="contained"
              startIcon={
                bulkApproving ? <CircularProgress size={14} color="inherit" /> : null
              }
              onClick={approveAllDrafts}
              disabled={bulkApproving}
              data-testid="bulk-approve-button"
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: '#22c55e',
                color: '#0f172a',
                '&:hover': { bgcolor: '#16a34a' },
              }}
            >
              {bulkApproving ? 'Godkjenner…' : `Godkjenn alle (${draftCount})`}
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {entitlementMessage ? (
        <Alert
          severity="warning"
          onClose={() => setEntitlementMessage(null)}
          sx={{
            bgcolor: 'rgba(234,179,8,0.08)',
            color: '#fde68a',
            border: '1px solid rgba(234,179,8,0.25)',
            '& .MuiAlert-icon': { color: '#fbbf24' },
          }}
        >
          {entitlementMessage} Oppgrader til <strong>Role Room Headliner</strong> eller <strong>Showrunner</strong> for ubegrenset AI-tilgang.
        </Alert>
      ) : null}

      <Alert
        severity="info"
        sx={{
          bgcolor: 'rgba(34,211,238,0.06)',
          color: 'rgba(226,232,240,0.84)',
          border: '1px solid rgba(34,211,238,0.18)',
          '& .MuiAlert-icon': { color: '#22d3ee' },
        }}
      >
        Klikk på en post for å redigere, hente bilde fra Google Drive eller be AI om caption og publiseringstidspunkt. Dra for å endre rekkefølge.
      </Alert>

      <FeedPlanTimeline
        posts={posts}
        brandSnapshot={brandSnapshot}
        selectedPostId={selectedPostId}
        onSelectPost={setSelectedPostId}
        onAutoSchedule={autoSchedule}
        onClearSchedule={clearSchedule}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 440px) minmax(0, 1fr)' },
          gap: 1.8,
          alignItems: 'flex-start',
        }}
      >
        {loadingPlan ? (
          <Stack alignItems="center" spacing={1.4} sx={{ py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#22d3ee' }} />
            <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.84rem' }}>
              Henter lagret feed-plan…
            </Typography>
            <Skeleton
              variant="rectangular"
              width="100%"
              height={420}
              sx={{ maxWidth: 420, borderRadius: 4, bgcolor: 'rgba(34,211,238,0.08)' }}
            />
          </Stack>
        ) : (
          <motion.div
            key={`${projectId}:${platform}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={posts.map((post) => post.id)} strategy={rectSortingStrategy}>
                <InstagramPhoneMockup
                  posts={posts}
                  brandSnapshot={brandSnapshot}
                  selectedPostId={selectedPostId}
                  onSelectPost={setSelectedPostId}
                />
              </SortableContext>
            </DndContext>
          </motion.div>
        )}
        <AnimatePresence mode="wait" initial={false}>
          {selectedPost && selectedPostIndex >= 0 && bootstrap ? (
            <motion.div
              key={`detail-${selectedPost.id}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <FeedPostDetailPanel
                projectId={projectId}
                post={selectedPost}
                postIndex={selectedPostIndex}
                bootstrap={bootstrap}
                brandSnapshot={brandSnapshot}
                platform={platform}
                isShowrunner={isShowrunner}
                instagramConnections={instagramConnections}
                onUpdate={(patch) => updatePost(selectedPost.id, patch)}
                onRegenerate={regeneratePost}
                onClose={() => setSelectedPostId(null)}
                onEntitlementBlocked={async (message) => {
              setEntitlementMessage(message);
              try {
                const bundle = await fetchAgentEntitlement();
                setEntitlementBundle(bundle);
              } catch {
                /* dialog viser fortsatt fallback-CTAs uten config */
              }
              setPaywallOpen(true);
            }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="detail-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Stack
                spacing={0.8}
                sx={{
                  display: { xs: 'none', lg: 'flex' },
                  p: 2.4,
                  borderRadius: 2.5,
                  border: '1px dashed rgba(148,163,184,0.22)',
                  bgcolor: 'rgba(15,23,42,0.4)',
                  minHeight: 520,
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>
                  Velg en post for å redigere
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.8rem', maxWidth: 320 }}>
                  Klikk på et innlegg i feeden for å tilpasse tittel, caption, konsept og hente inn eget bilde fra Google Drive.
                </Typography>
              </Stack>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>

      <AgentPaywallDialog
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        entitlement={entitlementBundle?.entitlement ?? null}
        config={entitlementBundle?.config ?? null}
        onEntitlementChanged={async () => {
          try {
            const bundle = await fetchAgentEntitlement();
            setEntitlementBundle(bundle);
            if (bundle?.entitlement.allowed) {
              setPaywallOpen(false);
              setEntitlementMessage(null);
            }
          } catch {
            /* ignored — UI keeps existing state */
          }
        }}
      />
    </Stack>
  );
}

function SaveStatusBadge({
  loading,
  saving,
  dirty,
  error,
  lastSavedAt,
}: {
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  error: string | null;
  lastSavedAt: string | null;
}) {
  if (loading) {
    return (
      <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.74rem', fontStyle: 'italic' }}>
        Henter lagret plan…
      </Typography>
    );
  }
  if (saving) {
    return (
      <Typography sx={{ color: '#22d3ee', fontSize: '0.74rem', fontWeight: 700 }}>
        Lagrer…
      </Typography>
    );
  }
  if (error) {
    return (
      <Typography sx={{ color: '#fca5a5', fontSize: '0.74rem', fontWeight: 700 }} title={error}>
        Lagring feilet
      </Typography>
    );
  }
  if (dirty) {
    return (
      <Typography sx={{ color: 'rgba(251,191,36,0.9)', fontSize: '0.74rem' }}>
        Endringer venter…
      </Typography>
    );
  }
  if (lastSavedAt) {
    let timeLabel = '';
    try {
      const date = new Date(lastSavedAt);
      timeLabel = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      timeLabel = '';
    }
    return (
      <Typography sx={{ color: 'rgba(134,239,172,0.85)', fontSize: '0.74rem' }}>
        Lagret{timeLabel ? ` · ${timeLabel}` : ''}
      </Typography>
    );
  }
  return null;
}

function BrandSummaryStrip({
  brandSnapshot,
  brandColors,
}: {
  brandSnapshot: RoleRoomFeedBrandSnapshot | null;
  brandColors: RoleRoomAgentBrandColor[];
}) {
  if (!brandSnapshot) return null;
  const colors = brandColors.length > 0
    ? brandColors.slice(0, 5)
    : [
        brandSnapshot.primaryColor ? { label: 'Primær', hex: brandSnapshot.primaryColor } : null,
        brandSnapshot.secondaryColor ? { label: 'Sekundær', hex: brandSnapshot.secondaryColor } : null,
        brandSnapshot.accentColor ? { label: 'Accent', hex: brandSnapshot.accentColor } : null,
      ].filter((entry): entry is RoleRoomAgentBrandColor => entry !== null);

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.4}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      sx={{
        p: 1.4,
        borderRadius: 2,
        bgcolor: 'rgba(15,23,42,0.55)',
        border: '1px solid rgba(148,163,184,0.14)',
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="center">
        {brandSnapshot.logoUrl ? (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
            }}
          >
            <Box
              component="img"
              src={brandSnapshot.logoUrl}
              alt={brandSnapshot.companyName || 'logo'}
              sx={{ maxWidth: 36, maxHeight: 36, objectFit: 'contain' }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: 'rgba(34,211,238,0.2)',
              border: '1px solid rgba(34,211,238,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#22d3ee',
              fontWeight: 800,
            }}
          >
            {(brandSnapshot.companyName || '?').slice(0, 1).toUpperCase()}
          </Box>
        )}
        <Stack spacing={0.2}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.95rem' }}>
            {brandSnapshot.companyName || 'Ukjent merke'}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.78rem' }}>
            {brandSnapshot.toneOfVoice || 'Tone ikke satt'} · {brandSnapshot.visualStyle || 'Stil ikke satt'}
          </Typography>
        </Stack>
      </Stack>
      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
        {colors.map((color, index) => (
          <Box
            key={`${color.hex}-${index}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.6,
              px: 0.9,
              py: 0.4,
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.2)',
              bgcolor: 'rgba(15,23,42,0.6)',
            }}
          >
            <Box
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: color.hex,
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
            <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.72rem', fontWeight: 600 }}>
              {color.label || color.hex}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function InstagramPhoneMockup({
  posts,
  brandSnapshot,
  selectedPostId,
  onSelectPost,
}: {
  posts: RoleRoomFeedPost[];
  brandSnapshot: RoleRoomFeedBrandSnapshot | null;
  selectedPostId: string | null;
  onSelectPost: (id: string) => void;
}) {
  return (
    <Box
      sx={{
        mx: 'auto',
        width: '100%',
        maxWidth: 420,
        borderRadius: 4,
        border: '10px solid #0b1220',
        bgcolor: '#000',
        boxShadow: '0 24px 48px rgba(0,0,0,0.45)',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 1.4, py: 1, bgcolor: '#0b1220' }}
      >
        <InstagramBrandLogo size={20} />
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
          {brandSnapshot?.companyName || 'merke'}
        </Typography>
        <Box sx={{ width: 20 }} />
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2px',
          bgcolor: '#0b1220',
        }}
      >
        {posts.map((post, index) => (
          <SortableFeedPostTile
            key={post.id}
            post={post}
            index={index}
            brandSnapshot={brandSnapshot}
            selected={post.id === selectedPostId}
            onSelect={() => onSelectPost(post.id)}
          />
        ))}
      </Box>
      <Box sx={{ px: 1.4, py: 0.8, bgcolor: '#0b1220', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', textAlign: 'center' }}>
          Forhåndsvisning · {FEED_POST_CONCEPT_ORDER.length} konseptvarianter
        </Typography>
      </Box>
    </Box>
  );
}
