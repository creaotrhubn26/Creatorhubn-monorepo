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
  TextField,
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
  AutoAwesome as DraftReplyIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomSentimentLabel,
  type RoleRoomSocialEvent,
} from '../../services/roleRoomAgentService';
import { useSequencedFetch } from '../../hooks/useSequencedFetch';
import { LoadingSkeleton, PanelHeader, EmptyState, ErrorAlert } from './ui';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

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

// Kinds that represent something a producer can actually reply to. Reactions
// (likes etc) have no body, so we don't offer a draft-reply action for them.
const REPLYABLE_KINDS = new Set(['comment', 'reply', 'mention', 'dm']);

interface DraftReplyState {
  loading: boolean;
  draft: string;
  model?: string;
  error?: string;
  copied?: boolean;
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook_page: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  x: 'X',
  threads: 'Threads',
};

function formatTimestamp(t: TFn, iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return t('socialInbox.s038');
  if (diffMin < 60) return t('socialInbox.p03', { v0: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('socialInbox.p04', { v0: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return t('socialInbox.p02', { v0: diffD });
  return d.toLocaleDateString('nb-NO');
}

export default function SocialInboxPanel(): React.ReactElement {
  const { t } = useT();
  const [events, setEvents] = useState<RoleRoomSocialEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<FilterPlatform>('all');
  const [kindFilter, setKindFilter] = useState<FilterKind>('all');
  const [sentimentFilter, setSentimentFilter] = useState<FilterSentiment>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  // Per-event reply drafts (Phase 2b). Keyed by event id so each row owns its
  // own draft/loading/error without affecting the rest of the list.
  const [drafts, setDrafts] = useState<Record<string, DraftReplyState>>({});

  // The 30s auto-poll overlaps with filter changes and manual refreshes, so
  // responses can arrive out of order — without guarding, a slow stale response
  // could overwrite the freshly-filtered list (or flip `loading` off while a
  // newer request is still in flight). useSequencedFetch applies only the
  // latest request's result and skips post-unmount updates.
  const sequencedFetch = useSequencedFetch();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    await sequencedFetch(
      () =>
        roleRoomAgentService.listSocialInbox({
          platform: platformFilter === 'all' ? undefined : platformFilter,
          kind: kindFilter === 'all' ? undefined : kindFilter,
          sentiment: sentimentFilter === 'all' ? undefined : sentimentFilter,
          unread: unreadOnly,
          limit: 100,
        }),
      (result) => {
        if (result.error) setError(result.error);
        setEvents(result.events);
        setLoading(false);
      },
    );
  }, [platformFilter, kindFilter, sentimentFilter, unreadOnly, sequencedFetch]);

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

  const handleDraftReply = async (eventId: string) => {
    setDrafts((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], loading: true, error: undefined, draft: prev[eventId]?.draft ?? '' },
    }));
    const result = await roleRoomAgentService.draftInboxReply(eventId);
    setDrafts((prev) => ({
      ...prev,
      [eventId]: result.error
        ? { ...prev[eventId], loading: false, error: result.error, draft: prev[eventId]?.draft ?? '' }
        : { loading: false, draft: result.draft ?? '', model: result.model },
    }));
  };

  const handleDraftChange = (eventId: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], draft: value, copied: false },
    }));
  };

  const handleCopyDraft = async (eventId: string) => {
    const text = drafts[eventId]?.draft ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setDrafts((prev) => ({ ...prev, [eventId]: { ...prev[eventId], copied: true } }));
      setTimeout(() => {
        setDrafts((prev) =>
          prev[eventId] ? { ...prev, [eventId]: { ...prev[eventId], copied: false } } : prev,
        );
      }, 1800);
    } catch {
      setDrafts((prev) => ({
        ...prev,
        [eventId]: { ...prev[eventId], error: t('socialInbox.s022') },
      }));
    }
  };

  const handleDismissDraft = (eventId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
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
      <PanelHeader
        icon={<InboxHeaderIcon />}
        title="Inbox"
        subtitle={t('socialInbox.p01', { v0: events.length, v1: counts.unread > 0 ? t('socialInbox.p00', { v0: counts.unread }) : '' })}
        actions={
          <Tooltip title={t('socialInbox.s030')}>
            <IconButton size="small" aria-label={t('socialInbox.s031')} onClick={() => void refresh()} disabled={loading}>
              <RefreshIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} />
            </IconButton>
          </Tooltip>
        }
      />

      <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap>
        <ToggleButtonGroup
          size="small"
          value={platformFilter}
          exclusive
          onChange={(_, v) => v && setPlatformFilter(v)}
          data-testid="inbox-platform-filter"
        >
          <ToggleButton value="all">{t('socialInbox.s006')}</ToggleButton>
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
          inputProps={{ 'aria-label': t('socialInbox.s012') }}
          sx={{ minWidth: 130, fontSize: '0.78rem' }}
        >
          <MenuItem value="all">{t('socialInbox.s008')}</MenuItem>
          <MenuItem value="comment">{t('socialInbox.s018')}</MenuItem>
          <MenuItem value="reply">{t('socialInbox.s036')}</MenuItem>
          <MenuItem value="mention">{t('socialInbox.s029')}</MenuItem>
          <MenuItem value="dm">{t('socialInbox.s010')}</MenuItem>
          <MenuItem value="reaction">{t('socialInbox.s033')}</MenuItem>
        </Select>

        <Select
          size="small"
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value as FilterSentiment)}
          data-testid="inbox-sentiment-filter"
          inputProps={{ 'aria-label': t('socialInbox.s011') }}
          sx={{ minWidth: 130, fontSize: '0.78rem' }}
        >
          <MenuItem value="all">{t('socialInbox.s007')}</MenuItem>
          <MenuItem value="negative">{t('socialInbox.s026')}</MenuItem>
          <MenuItem value="neutral">{t('socialInbox.s028')}</MenuItem>
          <MenuItem value="positive">{t('socialInbox.s032')}</MenuItem>
          <MenuItem value="mixed">{t('socialInbox.s009')}</MenuItem>
        </Select>

        <ToggleButton
          size="small"
          value="unread"
          selected={unreadOnly}
          onChange={() => setUnreadOnly((v) => !v)}
          data-testid="inbox-unread-toggle"
        >
          {t('socialInbox.s021')}
        </ToggleButton>
      </Stack>

      {error ? <ErrorAlert message={error} onRetry={() => void refresh()} /> : null}

      {loading && events.length === 0 ? (
        <LoadingSkeleton variant="list" />
      ) : events.length === 0 ? (
        <EmptyState
          title={t('socialInbox.s017')}
          description={t('socialInbox.s027')}
          hintsLabel={t('socialInbox.s035')}
          hints={[
            { label: t('socialInbox.s003'), tone: 'accent' },
            { label: t('socialInbox.s004'), tone: 'positive' },
            { label: t('socialInbox.s005'), tone: 'neutral' },
          ]}
        />
      ) : (
        <Stack spacing={1} data-testid="inbox-event-list">
          {events.map((e) => {
            const draftState = drafts[e.id];
            const canReply =
              REPLYABLE_KINDS.has(e.kind) && Boolean(e.body && e.body.trim());
            return (
            <Box
              key={e.id}
              data-testid="inbox-event-wrap"
              sx={{
                borderRadius: 1.4,
                bgcolor: e.isRead ? 'rgba(15,23,42,0.4)' : 'rgba(34,211,238,0.06)',
                border: '1px solid rgba(148,163,184,0.18)',
                opacity: e.isRead ? 0.85 : 1,
              }}
            >
            <Stack
              direction="row"
              spacing={1.2}
              data-testid="inbox-event"
              data-platform={e.platform}
              data-kind={e.kind}
              data-sentiment={e.sentimentLabel ?? 'pending'}
              sx={{ p: 1.2 }}
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
                        : t('socialInbox.s000')}
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
                              ? 'var(--role-cyan, #7dd3fc)'
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
                    <Tooltip title={t('socialInbox.s034')}>
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
                    {formatTimestamp(t, e.occurredAt ?? e.receivedAt)}
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
                  {e.body ?? <em style={{ opacity: 0.5 }}>{t('socialInbox.s001')}</em>}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.2} alignItems="flex-start">
                {canReply ? (
                  <Tooltip title={t('socialInbox.s014')}>
                    <IconButton
                      size="small"
                      onClick={() => void handleDraftReply(e.id)}
                      disabled={draftState?.loading}
                      data-testid="inbox-draft-reply"
                      aria-label={t('socialInbox.s013')}
                      sx={{ color: 'rgba(34,211,238,0.9)' }}
                    >
                      {draftState?.loading ? (
                        <CircularProgress size={16} sx={{ color: 'rgba(34,211,238,0.9)' }} />
                      ) : (
                        <DraftReplyIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                ) : null}
                {!e.isRead ? (
                  <Tooltip title={t('socialInbox.s025')}>
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
            </Stack>
            {draftState && (draftState.loading || draftState.draft || draftState.error) ? (
              <Box
                data-testid="inbox-draft-area"
                sx={{
                  px: 1.2,
                  pb: 1.2,
                  pt: 0.2,
                  borderTop: '1px dashed rgba(148,163,184,0.16)',
                }}
              >
                {draftState.error ? (
                  <Alert
                    severity="error"
                    sx={{ mt: 1, bgcolor: 'rgba(239,68,68,0.08)', color: '#fecaca' }}
                  >
                    {draftState.error}
                  </Alert>
                ) : null}
                {draftState.draft ? (
                  <>
                    <TextField
                      multiline
                      fullWidth
                      minRows={2}
                      maxRows={8}
                      size="small"
                      value={draftState.draft}
                      onChange={(ev) => handleDraftChange(e.id, ev.target.value)}
                      data-testid="inbox-draft-text"
                      inputProps={{ 'aria-label': t('socialInbox.s037') }}
                      sx={{
                        mt: 1,
                        '& .MuiInputBase-root': {
                          bgcolor: 'rgba(15,23,42,0.55)',
                          color: '#e2e8f0',
                          fontSize: '0.82rem',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(148,163,184,0.25)',
                        },
                      }}
                    />
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ mt: 0.8 }}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CopyIcon fontSize="small" />}
                        onClick={() => void handleCopyDraft(e.id)}
                        data-testid="inbox-draft-copy"
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.74rem',
                          bgcolor: 'rgba(34,211,238,0.18)',
                          color: 'var(--role-cyan, #22d3ee)',
                          boxShadow: 'none',
                          '&:hover': { bgcolor: 'rgba(34,211,238,0.28)', boxShadow: 'none' },
                        }}
                      >
                        {draftState.copied ? t('socialInbox.s020') : t('socialInbox.s019')}
                      </Button>
                      <Button
                        size="small"
                        onClick={() => void handleDraftReply(e.id)}
                        disabled={draftState.loading}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.74rem',
                          color: 'rgba(226,232,240,0.7)',
                        }}
                      >
                        {t('socialInbox.s015')}
                      </Button>
                      <Button
                        size="small"
                        onClick={() => handleDismissDraft(e.id)}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.74rem',
                          color: 'rgba(226,232,240,0.5)',
                        }}
                      >
                        {t('socialInbox.s024')}
                      </Button>
                      <Typography sx={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.68rem' }}>
                        {t('socialInbox.s023')} {PLATFORM_LABEL[e.platform] ?? e.platform}{t('socialInbox.s002')}
                      </Typography>
                    </Stack>
                  </>
                ) : null}
              </Box>
            ) : null}
            </Box>
            );
          })}
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
        {loading ? t('socialInbox.s016') : t('socialInbox.s030')}
      </Button>
    </Stack>
  );
}
