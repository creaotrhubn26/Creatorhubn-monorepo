import React from 'react';
import {
  Alert,
  Avatar,
  Box,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import {
  Favorite as FavoriteIcon,
  ChatBubble as ChatIcon,
  Description as DescriptionIcon,
  Gavel as GavelIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import {
  clientOnly,
  fetchProjectChangeLog,
  humanizeChangeLogEntry,
  type ProjectChangeKind,
  type ProjectChangeLogEntry,
} from '../../lib/project-change-log';

export interface ClientActivityBannerProps {
  /** Owner-gated — the backend enforces that the bearer matches the project owner. */
  projectId: string;
  /** How many recent entries to surface. Default 5 keeps the banner compact. */
  limit?: number;
}

/**
 * Compact "recent activity from your client" banner that sits above the
 * enhancer when a `projectId` is known. Surfaces the `asset.hearted`
 * events that were already being written to `project_change_log` but
 * had no reader on the web — photographers used to have to refresh the
 * iPad to see what the client marked.
 *
 * Intentionally read-only: no drill-in, no "open this image". Clicking
 * a chip is out of scope for this pass; the banner is a signal, not a
 * navigation surface. A follow-up can wire deep-links once the image-id
 * → enhancer-session mapping is plumbed.
 */
export function ClientActivityBanner(props: ClientActivityBannerProps) {
  const { projectId, limit = 5 } = props;
  const query = useQuery<ProjectChangeLogEntry[]>({
    queryKey: ['project-change-log', projectId, limit],
    queryFn: () => fetchProjectChangeLog(projectId, { limit: limit * 3 }),
    // Client activity is a low-urgency signal — 30s stale window avoids
    // hammering the endpoint when the photographer is actively editing.
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (query.isLoading) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <Skeleton variant="rounded" height={48} />
      </Box>
    );
  }

  if (query.isError) {
    return (
      <Alert severity="warning" sx={{ mx: 2, my: 1 }}>
        Kunne ikke hente klient-aktivitet.
      </Alert>
    );
  }

  const entries = clientOnly(query.data ?? []).slice(0, limit);
  if (entries.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        mx: 2,
        my: 1,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
        Klient-aktivitet
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {entries.map((entry) => {
          // Backend enriches asset.hearted / commented entries with the
          // hearted image's thumbnail URL so we can show the photographer
          // *which* picture — not just that something was liked.
          const payload = entry.payload as Record<string, unknown>;
          const thumb =
            typeof payload.thumbnailUrl === 'string' ? payload.thumbnailUrl : null;
          return (
            <Chip
              key={entry.id}
              size="small"
              avatar={
                thumb ? (
                  <Avatar
                    alt=""
                    src={thumb}
                    variant="rounded"
                    sx={{ width: 24, height: 24 }}
                  />
                ) : undefined
              }
              icon={thumb ? undefined : iconForKind(entry.kind)}
              label={`${humanizeChangeLogEntry(entry)} · ${relativeTime(entry.createdAt)}`}
              sx={{ maxWidth: '100%' }}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

function iconForKind(kind: ProjectChangeKind): React.ReactElement {
  switch (kind) {
    case 'asset.hearted':
      return <FavoriteIcon fontSize="small" />;
    case 'asset.commented':
      return <ChatIcon fontSize="small" />;
    case 'quote.signed':
      return <DescriptionIcon fontSize="small" />;
    case 'contract.signed':
      return <GavelIcon fontSize="small" />;
  }
}

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return `${diffSec}s siden`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m siden`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}t siden`;
  return `${Math.round(diffSec / 86400)}d siden`;
}
