import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircleOutline as CheckIcon,
  TaskAlt as DoneIcon,
  Refresh as RefreshIcon,
  Edit as NeedsChangesIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomPendingApproval,
} from '../../services/roleRoomAgentService';

interface ProjectGroup {
  projectId: string;
  platform: string;
  posts: RoleRoomPendingApproval[];
}

function groupByProject(pending: RoleRoomPendingApproval[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const p of pending) {
    const key = `${p.projectId}::${p.platform}`;
    let group = map.get(key);
    if (!group) {
      group = { projectId: p.projectId, platform: p.platform, posts: [] };
      map.set(key, group);
    }
    group.posts.push(p);
  }
  return Array.from(map.values());
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'akkurat nå';
  if (minutes < 60) return `${minutes}m siden`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d siden`;
  return new Date(iso).toLocaleDateString('nb-NO');
}

/**
 * Approvals-widget for Plan-fasen.
 *
 * Designkrav (Daniel: 'ryddig, ikke kognitivt belastende'):
 *   - 0 pending → diskret success-badge, INGEN handling kreves
 *   - >0 pending → tydelig prioritet, ÉN primær handling per prosjekt
 *   - Posts gruppert per prosjekt — bruker tenker i prosjekter
 *   - Ingen filter, tabs eller statusvelger inni widgeten
 *   - Audit-detaljer skjult bak hover/utvidelse
 */
export default function RoleRoomAgentApprovalsWidget(): React.ReactElement | null {
  const [pending, setPending] = useState<RoleRoomPendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkBusyProject, setBulkBusyProject] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await roleRoomAgentService.listPendingApprovals();
    setPending(result.pending);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => groupByProject(pending), [pending]);
  const total = pending.length;

  const approveAllInProject = async (group: ProjectGroup) => {
    setBulkBusyProject(`${group.projectId}::${group.platform}`);
    try {
      const result = await roleRoomAgentService.setFeedPostApproval({
        projectId: group.projectId,
        platform: group.platform,
        postIds: group.posts.map((p) => p.postId),
        approvalState: 'approved',
      });
      if (result.success) {
        // Fjern den godkjente gruppen lokalt for umiddelbar feedback
        setPending((prev) =>
          prev.filter(
            (p) => !(p.projectId === group.projectId && p.platform === group.platform),
          ),
        );
      }
    } finally {
      setBulkBusyProject(null);
    }
  };

  const approveOne = async (item: RoleRoomPendingApproval) => {
    const result = await roleRoomAgentService.setFeedPostApproval({
      projectId: item.projectId,
      platform: item.platform,
      postIds: [item.postId],
      approvalState: 'approved',
    });
    if (result.success) {
      setPending((prev) => prev.filter((p) => p.postId !== item.postId));
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <CircularProgress size={14} />
      </Box>
    );
  }

  // Tom-tilstand: rolig + diskret. Ingen call-out, ingen rødt, ingen
  // panikk. Bare en grønn linje som forteller at alt er ryddet.
  if (total === 0) {
    return (
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        data-testid="approvals-widget-empty"
        sx={{
          p: 1,
          borderRadius: 1.4,
          bgcolor: 'rgba(134,239,172,0.08)',
          border: '1px solid rgba(134,239,172,0.25)',
        }}
      >
        <DoneIcon sx={{ color: '#86efac', fontSize: '1.1rem' }} />
        <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 600, flex: 1 }}>
          Alt er godkjent — ingenting venter
        </Typography>
        <IconButton
          size="small"
          onClick={() => {
            setRefreshing(true);
            void refresh();
          }}
          sx={{ color: 'rgba(134,239,172,0.7)' }}
        >
          {refreshing ? <CircularProgress size={12} sx={{ color: '#86efac' }} /> : <RefreshIcon fontSize="inherit" />}
        </IconButton>
      </Stack>
    );
  }

  // Med pending: én tydelig topplinje som teller, og deretter ett kort
  // per prosjekt med ÉN primær handling. Detaljer skjult i kompakt liste.
  return (
    <Stack
      spacing={1.2}
      data-testid="approvals-widget"
      sx={{
        p: 1.4,
        borderRadius: 2,
        bgcolor: 'rgba(34,211,238,0.06)',
        border: '1px solid rgba(34,211,238,0.25)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            bgcolor: '#22d3ee',
            color: '#0f172a',
            fontWeight: 800,
            fontSize: '0.85rem',
          }}
          data-testid="approvals-widget-count"
        >
          {total}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.86rem' }}>
            {total === 1 ? '1 post venter på godkjenning' : `${total} posts venter på godkjenning`}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.72rem' }}>
            Godkjenn for å låse opp publisering
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={() => {
            setRefreshing(true);
            void refresh();
          }}
          sx={{ color: 'rgba(226,232,240,0.6)' }}
        >
          {refreshing ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Stack spacing={0.8}>
        {groups.map((group) => {
          const groupKey = `${group.projectId}::${group.platform}`;
          const isBusy = bulkBusyProject === groupKey;
          // Vis maks 3 post-titler på linje, flere skjules ("+ N andre")
          const visibleTitles = group.posts.slice(0, 3).map((p) => p.title || 'Uten tittel');
          const hiddenCount = group.posts.length - visibleTitles.length;
          return (
            <Stack
              key={groupKey}
              direction="row"
              spacing={1.2}
              alignItems="center"
              data-testid="approvals-widget-project"
              sx={{
                p: 1,
                borderRadius: 1.6,
                bgcolor: 'rgba(15,23,42,0.55)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mb: 0.2 }}>
                  <Typography
                    sx={{
                      color: '#e2e8f0',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Prosjekt {group.projectId.slice(0, 10)}…
                  </Typography>
                  <Chip
                    size="small"
                    label={`${group.posts.length}`}
                    sx={{
                      height: 18,
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      bgcolor: 'rgba(34,211,238,0.18)',
                      color: '#22d3ee',
                      '& .MuiChip-label': { px: 0.7 },
                    }}
                  />
                  <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.66rem' }}>
                    {group.platform}
                  </Typography>
                </Stack>
                <Typography
                  sx={{
                    color: 'rgba(226,232,240,0.65)',
                    fontSize: '0.72rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {visibleTitles.join(' · ')}
                  {hiddenCount > 0 ? ` · +${hiddenCount} andre` : ''}
                </Typography>
                {/* Hvis noen er needs_changes, varsel diskret — én linje, ingen knapp */}
                {group.posts.some((p) => p.approvalState === 'needs_changes') ? (
                  <Stack direction="row" spacing={0.4} alignItems="center" sx={{ mt: 0.2 }}>
                    <NeedsChangesIcon sx={{ fontSize: '0.78rem', color: '#fbbf24' }} />
                    <Typography sx={{ color: '#fde68a', fontSize: '0.66rem' }}>
                      Inkluderer poster som trenger endring
                    </Typography>
                  </Stack>
                ) : null}
              </Box>
              <Button
                size="small"
                variant="contained"
                disabled={isBusy}
                onClick={() => approveAllInProject(group)}
                data-testid="approvals-widget-approve-all"
                sx={{
                  flexShrink: 0,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  bgcolor: '#22c55e',
                  color: '#0f172a',
                  '&:hover': { bgcolor: '#16a34a' },
                }}
                startIcon={
                  isBusy ? <CircularProgress size={12} color="inherit" /> : <CheckIcon fontSize="small" />
                }
              >
                {isBusy ? 'Godkjenner…' : 'Godkjenn alle'}
              </Button>
            </Stack>
          );
        })}
      </Stack>

      {/* Hvis kun én post per gruppe, eller hvis bruker vil approve én-og-én,
          tilbyr vi en kompakt "godkjenn enkelt"-rute som ekspanderer ved klikk.
          Foreløpig holder vi oss til bulk-handlingen for å unngå støy.
          (En "se enkeltvis"-link kan legges til senere uten å forstyrre layouten.) */}
    </Stack>
  );
}
