// @ts-nocheck
/**
 * RoleRoomMobilePlannerView — mobile + iPad Planner feed.
 *
 * Covers backlog items:
 *  - 076: card-based feed with "I dag" / "Neste" / "Blokkert" / "Over frist"
 *  - 077: single primary CTA "Opprett" in a floating FAB
 *  - 083: compact phase progress ring
 *  - 084: blockers shown as own group at the top
 *  - 092: due dates rendered as chips, not table columns
 *  - 093: "Neste beslutning" card (from pending reviews)
 *  - 095: "Mangler fra klient" card (from missing brief fields)
 *  - 096: auto-refresh suspended while user scrolls (via isScrollingRef)
 *  - 097: pull-to-refresh alternative as explicit reload button
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Fab,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Block as BlockIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { useProducerTimeline } from '../../hooks/useProducerTimeline';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import { useClientIntake } from '../../hooks/useClientIntake';
import type { RoleRoomViewportMode } from '../../hooks/useRoleRoomViewportMode';
import {
  bucketTimeline,
  phaseProgress,
  PHASE_LABELS,
} from './plannerBuckets';
import MobilePlannerCreateSheet from './MobilePlannerCreateSheet';
import { getMissingFields } from '../mobile-brief/briefStepDefinitions';

interface RoleRoomMobilePlannerViewProps {
  projectId: string | null;
  mode: RoleRoomViewportMode;
}

function formatDue(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('nb-NO', { day: '2-digit', month: 'short' }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}

export const RoleRoomMobilePlannerView: React.FC<RoleRoomMobilePlannerViewProps> = ({
  projectId,
  mode,
}) => {
  const { items, loading, error, reload, createItem } = useProducerTimeline(projectId ?? undefined);
  const { items: reviewItems } = useProducerReviews(projectId ?? undefined);
  const { intake } = useClientIntake(projectId ?? undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [createAnchor, setCreateAnchor] = useState<HTMLElement | null>(null);
  const isScrollingRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);

  // Item 096: mark "scrolling" for a short window after scroll events.
  useEffect(() => {
    const handleScroll = () => {
      isScrollingRef.current = true;
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      scrollTimerRef.current = window.setTimeout(() => {
        isScrollingRef.current = false;
        scrollTimerRef.current = null;
      }, 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    };
  }, []);

  // Background poll every 90s, but pause while scrolling (item 096).
  useEffect(() => {
    if (!projectId) return;
    const interval = window.setInterval(() => {
      if (!isScrollingRef.current) void reload();
    }, 90_000);
    return () => window.clearInterval(interval);
  }, [projectId, reload]);

  const buckets = useMemo(() => bucketTimeline(items ?? []), [items]);
  const phases = useMemo(() => phaseProgress(items ?? []), [items]);

  const pendingReview = useMemo(() => {
    const pending = (reviewItems ?? []).filter((r) => r.status === 'pending' || r.status === 'changes_requested');
    return pending.sort((a, b) => {
      const aT = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bT = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aT - bT;
    })[0] ?? null;
  }, [reviewItems]);

  const missingBriefFields = useMemo(() => getMissingFields(intake), [intake]);

  const handleOpenCreate = (event: React.MouseEvent<HTMLElement>) => {
    setCreateAnchor(event.currentTarget);
    setCreateOpen(true);
  };

  const handleCreate = useCallback(
    async (payload: Parameters<typeof createItem>[0]) => {
      await createItem(payload);
    },
    [createItem],
  );

  if (!projectId) {
    return (
      <Alert severity="info" variant="outlined">
        Velg et prosjekt for å åpne Planner.
      </Alert>
    );
  }

  if (loading && items.length === 0) {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={80} />
        <Skeleton variant="rounded" height={120} />
        <Skeleton variant="rounded" height={120} />
      </Stack>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  const hasAnyItems = items.length > 0;

  return (
    <Box sx={{ position: 'relative', pb: 10 }}>
      <Stack spacing={2}>
        {/* Item 083: phase progress */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            p: 1.25,
            borderRadius: 'var(--rr-card-radius, 12px)',
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          {phases.map((p) => (
            <Box
              key={p.phase}
              sx={{ flex: 1, textAlign: 'center' }}
              aria-label={`${PHASE_LABELS[p.phase]}: ${p.completed} av ${p.total} fullført`}
            >
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <CircularProgress
                  variant="determinate"
                  value={p.percent}
                  size={44}
                  thickness={4}
                  sx={{ color: '#6366f1' }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="caption" fontWeight={700}>
                    {p.percent}%
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" display="block" color="text.secondary">
                {PHASE_LABELS[p.phase]}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Item 093: Neste beslutning */}
        {pendingReview ? (
          <DecisionCard
            title="Neste beslutning"
            body={pendingReview.title}
            subtext={pendingReview.due_at ? `Frist ${formatDue(pendingReview.due_at)}` : 'Ingen frist satt'}
            severity="info"
          />
        ) : null}

        {/* Item 095: Mangler fra klient */}
        {missingBriefFields.length > 0 ? (
          <DecisionCard
            title="Mangler fra klient"
            body={missingBriefFields.map((f) => f.label).join(', ')}
            subtext={`${missingBriefFields.length} felt gjenstår i klientbriefen`}
            severity="warning"
          />
        ) : null}

        {!hasAnyItems ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Ingen planner-oppføringer ennå.
            </Typography>
          </Box>
        ) : (
          <>
            {buckets.overdue.length > 0 ? (
              <PlannerSection title="Over frist" items={buckets.overdue} tone="overdue" />
            ) : null}
            {buckets.blockedItems.length > 0 ? (
              <PlannerSection title="Blokkert" items={buckets.blockedItems} tone="blocked" />
            ) : null}
            {buckets.today.length > 0 ? (
              <PlannerSection title="I dag" items={buckets.today} tone="today" />
            ) : null}
            <PlannerSection
              title="Neste"
              items={buckets.next}
              tone="next"
              emptyLabel="Ingen kommende oppgaver."
            />
          </>
        )}

        {/* Item 097: explicit reload until pull-to-refresh is implemented */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
          <Button
            size="small"
            variant="text"
            startIcon={<RefreshIcon />}
            onClick={() => reload()}
            sx={{ minHeight: 'var(--rr-touch-target-min, 44px)' }}
          >
            Oppdater
          </Button>
        </Box>
      </Stack>

      {/* Item 077: single primary CTA */}
      <Fab
        color="primary"
        onClick={handleOpenCreate}
        aria-label="Opprett oppføring"
        sx={{
          position: 'fixed',
          right: 'calc(var(--rr-spacing-comfortable, 16px) + var(--rr-safe-right, 0px))',
          bottom: 'calc(var(--rr-spacing-comfortable, 16px) + var(--rr-safe-bottom, 0px))',
        }}
      >
        <AddIcon />
      </Fab>

      <MobilePlannerCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        mode={mode}
        anchorEl={createAnchor}
        onCreate={handleCreate}
      />
    </Box>
  );
};

interface PlannerSectionProps {
  title: string;
  items: any[];
  tone: 'overdue' | 'blocked' | 'today' | 'next';
  emptyLabel?: string;
}

const TONE_COLORS: Record<string, { label: string; bg: string }> = {
  overdue: { label: '#b91c1c', bg: 'rgba(239,68,68,0.08)' },
  blocked: { label: '#b45309', bg: 'rgba(245,158,11,0.08)' },
  today: { label: '#047857', bg: 'rgba(16,185,129,0.08)' },
  next: { label: '#334155', bg: 'transparent' },
};

const PlannerSection: React.FC<PlannerSectionProps> = ({ title, items, tone, emptyLabel }) => {
  const toneStyle = TONE_COLORS[tone];
  return (
    <Box>
      <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="overline" sx={{ fontWeight: 700, color: toneStyle.label }}>
          {title}
        </Typography>
        {items.length > 0 ? (
          <Typography variant="caption" color="text.secondary">
            {items.length}
          </Typography>
        ) : null}
      </Stack>
      {items.length === 0 ? (
        emptyLabel ? (
          <Typography variant="body2" color="text.secondary">
            {emptyLabel}
          </Typography>
        ) : null
      ) : (
        <Stack spacing={1}>
          {items.map((item) => (
            <PlannerCard key={item.id} item={item} tone={tone} />
          ))}
        </Stack>
      )}
    </Box>
  );
};

const PHASE_SHORT: Record<string, string> = {
  preproduction: 'Pre',
  production: 'Prod',
  postproduction: 'Post',
};

const PlannerCard: React.FC<{ item: any; tone: string }> = ({ item, tone }) => {
  const toneStyle = TONE_COLORS[tone];
  const dueLabel = formatDue(item.due_at);
  const isBlocked = item.status === 'blocked';
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 'var(--rr-card-radius, 12px)',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: toneStyle.bg,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {item.title}
          </Typography>
          {item.description ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item.description}
            </Typography>
          ) : null}
        </Box>
        {isBlocked ? <BlockIcon fontSize="small" sx={{ color: '#b45309' }} /> : null}
      </Stack>
      <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
        {dueLabel ? (
          <Chip
            size="small"
            label={dueLabel}
            sx={{ bgcolor: 'rgba(99,102,241,0.1)', color: '#4338ca', fontWeight: 600 }}
          />
        ) : null}
        <Chip
          size="small"
          variant="outlined"
          label={PHASE_SHORT[item.phase] || item.phase}
        />
      </Stack>
    </Box>
  );
};

interface DecisionCardProps {
  title: string;
  body: string;
  subtext?: string;
  severity: 'info' | 'warning';
}

const DecisionCard: React.FC<DecisionCardProps> = ({ title, body, subtext, severity }) => {
  const color = severity === 'info' ? '#6d28d9' : '#b45309';
  const bg = severity === 'info' ? 'rgba(124,58,237,0.08)' : 'rgba(245,158,11,0.1)';
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 'var(--rr-card-radius, 12px)',
        border: '1px solid',
        borderColor: severity === 'info' ? 'rgba(124,58,237,0.24)' : 'rgba(245,158,11,0.32)',
        bgcolor: bg,
      }}
    >
      <Typography variant="overline" sx={{ color, fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {body}
      </Typography>
      {subtext ? (
        <Typography variant="caption" color="text.secondary">
          {subtext}
        </Typography>
      ) : null}
    </Box>
  );
};

export default RoleRoomMobilePlannerView;
