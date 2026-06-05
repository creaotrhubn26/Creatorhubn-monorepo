import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Comment as CommentIcon,
  AlternateEmail as MentionIcon,
  Mail as DmIcon,
  Favorite as ReactionIcon,
  Reply as ReplyIcon,
  Refresh as RefreshIcon,
  CheckCircleOutline as MarkReadIcon,
  MoveToInbox as InboxHeaderIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomSentimentLabel,
  type RoleRoomSocialEvent,
} from '../../services/roleRoomAgentService';

type FilterPlatform = 'all' | 'instagram' | 'facebook_page' | 'linkedin' | 'youtube';
type FilterKind = 'all' | 'comment' | 'reply' | 'mention' | 'dm' | 'reaction';
type FilterSentiment = 'all' | RoleRoomSentimentLabel;

const KIND_ICON: Record<string, React.ReactElement> = {
  comment: <CommentIcon fontSize="inherit" />,
  reply: <ReplyIcon fontSize="inherit" />,
  mention: <MentionIcon fontSize="inherit" />,
  dm: <DmIcon fontSize="inherit" />,
  reaction: <ReactionIcon fontSize="inherit" />,
};

const SENTIMENT_COLOR: Record<RoleRoomSentimentLabel, string> = {
  negative: '#f87171',
  neutral: '#94a3b8',
  positive: '#86efac',
  mixed: '#fbbf24',
};

const SENTIMENT_BG: Record<RoleRoomSentimentLabel, string> = {
  negative: 'rgba(248,113,113,0.18)',
  neutral: 'rgba(148,163,184,0.18)',
  positive: 'rgba(134,239,172,0.18)',
  mixed: 'rgba(251,191,36,0.18)',
};

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook_page: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  threads: 'Threads',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'akkurat nå';
  if (diffMin < 60) return `${diffMin}m siden`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}t siden`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d siden`;
  return d.toLocaleDateString('nb-NO');
}

export default function SocialInboxPanel(): React.ReactElement {
  const [events, setEvents] = useState<RoleRoomSocialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<FilterPlatform>('all');
  const [kindFilter, setKindFilter] = useState<FilterKind>('all');
  const [sentimentFilter, setSentimentFilter] = useState<FilterSentiment>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await roleRoomAgentService.listSocialInbox({
      platform: platformFilter === 'all' ? undefined : platformFilter,
      kind: kindFilter === 'all' ? undefined : kindFilter,
      sentiment: sentimentFilter === 'all' ? undefined : sentimentFilter,
      unread: unreadOnly,
      limit: 100,
    });
    if (result.error) setError(result.error);
    setEvents(result.events);
    setLoading(false);
  }, [platformFilter, kindFilter, sentimentFilter, unreadOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-refresh every 30s når synlig
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleMarkRead = async (eventId: string) => {
    const ok = await roleRoomAgentService.markSocialEventRead(eventId);
    if (ok) {
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, isRead: true } : e)),
      );
    }
  };

  const counts = useMemo(() => {
    const byPlatform = new Map<string, number>();
    const bySentiment = new Map<string, number>();
    let unread = 0;
    for (const e of events) {
      byPlatform.set(e.platform, (byPlatform.get(e.platform) ?? 0) + 1);
      if (e.sentimentLabel) {
        bySentiment.set(e.sentimentLabel, (bySentiment.get(e.sentimentLabel) ?? 0) + 1);
      }
      if (!e.isRead) unread += 1;
    }
    return { byPlatform, bySentiment, unread };
  }, [events]);

  return (
    <Stack
      spacing={2}
      data-testid="social-inbox-panel"
      sx={{
        p: { xs: 1.5, sm: 2 },
        bgcolor: 'rgba(15,23,42,0.55)',
        border: '1px solid rgba(148,163,184,0.18)',
        borderRadius: 2,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <InboxHeaderIcon sx={{ color: '#22d3ee' }} />
          <Box>
            <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>Inbox</Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.84rem' }}>
              {events.length} hendelser{counts.unread > 0 ? ` · ${counts.unread} ulest` : ''}
            </Typography>
          </Box>
        </Stack>
        <Tooltip title="Oppdater">
          <IconButton size="small" aria-label="Oppdater inbox" onClick={() => void refresh()} disabled={loading}>
            <RefreshIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup
          size="small"
          value={platformFilter}
          exclusive
          onChange={(_, v) => v && setPlatformFilter(v)}
          data-testid="inbox-platform-filter"
        >
          <ToggleButton value="all">Alle</ToggleButton>
          <ToggleButton value="instagram">Instagram</ToggleButton>
          <ToggleButton value="facebook_page">Facebook</ToggleButton>
          <ToggleButton value="linkedin">LinkedIn</ToggleButton>
          <ToggleButton value="youtube">YouTube</ToggleButton>
        </ToggleButtonGroup>

        <Select
          size="small"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as FilterKind)}
          data-testid="inbox-kind-filter"
          inputProps={{ 'aria-label': 'Filtrer etter type' }}
          sx={{ minWidth: 130, fontSize: '0.78rem' }}
        >
          <MenuItem value="all">Alle typer</MenuItem>
          <MenuItem value="comment">Kommentarer</MenuItem>
          <MenuItem value="reply">Svar</MenuItem>
          <MenuItem value="mention">Omtaler</MenuItem>
          <MenuItem value="dm">DM-er</MenuItem>
          <MenuItem value="reaction">Reaksjoner</MenuItem>
        </Select>

        <Select
          size="small"
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value as FilterSentiment)}
          data-testid="inbox-sentiment-filter"
          inputProps={{ 'aria-label': 'Filtrer etter sentiment' }}
          sx={{ minWidth: 130, fontSize: '0.78rem' }}
        >
          <MenuItem value="all">Alle stemninger</MenuItem>
          <MenuItem value="negative">Negativ</MenuItem>
          <MenuItem value="neutral">Nøytral</MenuItem>
          <MenuItem value="positive">Positiv</MenuItem>
          <MenuItem value="mixed">Blandet</MenuItem>
        </Select>

        <ToggleButton
          size="small"
          value="unread"
          selected={unreadOnly}
          onChange={() => setUnreadOnly((v) => !v)}
          data-testid="inbox-unread-toggle"
        >
          Kun ulest
        </ToggleButton>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#fecaca' }}>
          {error}
        </Alert>
      ) : null}

      {loading && events.length === 0 ? (
        <Stack alignItems="center" sx={{ py: 4 }}>
          <CircularProgress size={20} />
        </Stack>
      ) : events.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 4,
            px: 2,
            color: 'rgba(226,232,240,0.7)',
            bgcolor: 'rgba(15,23,42,0.4)',
            borderRadius: 2,
            border: '1px dashed rgba(148,163,184,0.25)',
          }}
        >
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, mb: 0.5 }}>
            Ingen events ennå
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', mb: 1.5, opacity: 0.85 }}>
            Når koblede plattformer mottar comments, mentions, eller DMs, lander de her med
            sentiment-score og avsender-info.
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            justifyContent="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1.5, fontSize: '0.74rem' }}
          >
            <Typography sx={{ color: 'rgba(226,232,240,0.55)', fontSize: '0.74rem' }}>
              Sjekk:
            </Typography>
            <Chip
              size="small"
              label="1. Kontoer koblet (bar øverst)"
              sx={{
                fontSize: '0.7rem',
                bgcolor: 'rgba(34,211,238,0.12)',
                color: '#22d3ee',
                border: '1px solid rgba(34,211,238,0.3)',
              }}
            />
            <Chip
              size="small"
              label="2. Webhook subscribed (skjer auto ved connect)"
              sx={{
                fontSize: '0.7rem',
                bgcolor: 'rgba(134,239,172,0.12)',
                color: '#86efac',
                border: '1px solid rgba(134,239,172,0.3)',
              }}
            />
            <Chip
              size="small"
              label="3. Posts publisert (Plan-fase)"
              sx={{
                fontSize: '0.7rem',
                bgcolor: 'rgba(236,72,153,0.12)',
                color: '#f9a8d4',
                border: '1px solid rgba(236,72,153,0.3)',
              }}
            />
          </Stack>
        </Box>
      ) : (
        <Stack spacing={1} data-testid="inbox-event-list">
          {events.map((e) => (
            <Stack
              key={e.id}
              direction="row"
              spacing={1.2}
              data-testid="inbox-event"
              data-platform={e.platform}
              data-kind={e.kind}
              data-sentiment={e.sentimentLabel ?? 'pending'}
              sx={{
                p: 1.2,
                borderRadius: 1.4,
                bgcolor: e.isRead ? 'rgba(15,23,42,0.4)' : 'rgba(34,211,238,0.06)',
                border: '1px solid rgba(148,163,184,0.18)',
                opacity: e.isRead ? 0.75 : 1,
              }}
            >
              <Avatar
                src={e.authorAvatarUrl ?? undefined}
                alt={e.authorDisplayName ?? e.authorUsername ?? 'avatar'}
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: 'rgba(148,163,184,0.2)',
                  color: '#cbd5e1',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                }}
              >
                {(e.authorDisplayName ?? e.authorUsername ?? '?')[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.8} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.82rem' }}>
                    {/* Prioriter ekte navn (LinkedIn /v2/people, IG profile-fetch).
                        Faller tilbake til @username (IG handle) eller URN-suffix.  */}
                    {e.authorDisplayName
                      ? e.authorDisplayName
                      : e.authorUsername
                        ? `@${e.authorUsername}`
                        : '(anonym)'}
                  </Typography>
                  <Chip
                    size="small"
                    icon={KIND_ICON[e.kind] ?? undefined}
                    label={e.kind}
                    sx={{
                      height: 18,
                      fontSize: '0.62rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontWeight: 700,
                      bgcolor: 'rgba(148,163,184,0.15)',
                      color: '#cbd5e1',
                      '& .MuiChip-label': { px: 0.7 },
                      '& .MuiChip-icon': { fontSize: '0.86rem', color: '#94a3b8' },
                    }}
                  />
                  <Chip
                    size="small"
                    label={PLATFORM_LABEL[e.platform] ?? e.platform}
                    sx={{
                      height: 18,
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      bgcolor:
                        e.platform === 'instagram'
                          ? 'rgba(236,72,153,0.18)'
                          : e.platform === 'facebook_page'
                            ? 'rgba(59,130,246,0.18)'
                            : e.platform === 'linkedin'
                              ? 'rgba(10,102,194,0.22)'
                              : e.platform === 'youtube'
                                ? 'rgba(239,68,68,0.20)'
                                : 'rgba(148,163,184,0.18)',
                      color:
                        e.platform === 'instagram'
                          ? '#f9a8d4'
                          : e.platform === 'facebook_page'
                            ? '#93c5fd'
                            : e.platform === 'linkedin'
                              ? '#7dd3fc'
                              : e.platform === 'youtube'
                                ? '#fca5a5'
                                : '#cbd5e1',
                      '& .MuiChip-label': { px: 0.7 },
                    }}
                  />
                  {e.sentimentLabel ? (
                    <Chip
                      size="small"
                      label={e.sentimentLabel}
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        bgcolor: SENTIMENT_BG[e.sentimentLabel],
                        color: SENTIMENT_COLOR[e.sentimentLabel],
                        '& .MuiChip-label': { px: 0.7 },
                      }}
                    />
                  ) : (
                    <Tooltip title="Sentiment-scoring pågår">
                      <Chip
                        size="small"
                        label="…"
                        sx={{
                          height: 18,
                          fontSize: '0.62rem',
                          bgcolor: 'rgba(148,163,184,0.12)',
                          color: '#94a3b8',
                          '& .MuiChip-label': { px: 0.7 },
                        }}
                      />
                    </Tooltip>
                  )}
                  <Typography sx={{ color: 'rgba(226,232,240,0.45)', fontSize: '0.7rem' }}>
                    {formatTimestamp(e.occurredAt ?? e.receivedAt)}
                  </Typography>
                </Stack>
                <Typography
                  sx={{
                    color: '#e2e8f0',
                    fontSize: '0.82rem',
                    mt: 0.4,
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {e.body ?? <em style={{ opacity: 0.5 }}>(ingen tekst)</em>}
                </Typography>
              </Box>
              {!e.isRead ? (
                <Tooltip title="Marker som lest">
                  <IconButton
                    size="small"
                    onClick={() => void handleMarkRead(e.id)}
                    data-testid="inbox-mark-read"
                    sx={{ color: 'rgba(134,239,172,0.85)' }}
                  >
                    <MarkReadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Stack>
          ))}
          {loading ? (
            <Stack direction="row" justifyContent="center" sx={{ py: 1 }}>
              <CircularProgress size={14} />
            </Stack>
          ) : null}
        </Stack>
      )}

      {events.length > 0 ? (
        <Box>
          <Divider sx={{ borderColor: 'rgba(148,163,184,0.12)', mb: 1 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Array.from(counts.byPlatform.entries()).map(([platform, n]) => (
              <Chip
                key={platform}
                size="small"
                label={`${PLATFORM_LABEL[platform] ?? platform}: ${n}`}
                sx={{
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(148,163,184,0.12)',
                  color: '#cbd5e1',
                }}
              />
            ))}
            {Array.from(counts.bySentiment.entries()).map(([sentiment, n]) => (
              <Chip
                key={sentiment}
                size="small"
                label={`${sentiment}: ${n}`}
                sx={{
                  fontSize: '0.7rem',
                  bgcolor: SENTIMENT_BG[sentiment as RoleRoomSentimentLabel] ?? 'rgba(148,163,184,0.12)',
                  color: SENTIMENT_COLOR[sentiment as RoleRoomSentimentLabel] ?? '#cbd5e1',
                }}
              />
            ))}
          </Stack>
        </Box>
      ) : null}

      <Button
        size="small"
        variant="outlined"
        onClick={() => void refresh()}
        disabled={loading}
        sx={{
          alignSelf: 'flex-start',
          fontSize: '0.74rem',
          textTransform: 'none',
          color: 'rgba(226,232,240,0.75)',
          borderColor: 'rgba(148,163,184,0.3)',
        }}
        data-testid="inbox-refresh-button"
      >
        {loading ? 'Henter…' : 'Oppdater'}
      </Button>
    </Stack>
  );
}
