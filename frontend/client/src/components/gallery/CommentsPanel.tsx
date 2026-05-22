// @ts-nocheck
/**
 * CommentsPanel — Slice 9X.82 (system-flate for timecode-review)
 *
 * Shared liste-komponent for video- og audio-timecode-kommentarer.
 * Bygget på Pic-Time 2.0 / Filepass-mønster:
 *
 *   - layout="under"  → rendres horisontalt rett under video-player.
 *                       Hver kommentar i kolonne med timestamp-pill +
 *                       klient-navn + tekst + status-badge.
 *
 *   - layout="side"   → rendres vertikalt ved siden av audio-player.
 *                       Kompakt scroll-liste, kollapserer på mobile.
 *
 * Klikk på en kommentar = seek til timecode (parent player får
 * onSeek-callback).
 *
 * Filter-tabs: "Alle" / "Åpne". Resolved kommentarer er sekundære.
 *
 * Klient-side har bare lese + seek (ikke resolve-action — det er en
 * produsent-side handling i admin-portalen senere).
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Collapse,
  useMediaQuery,
} from '@mui/material';
import {
  ChatBubbleOutline as CommentIcon,
  CheckCircle as ResolvedIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

export interface CommentEntry {
  id: string;
  timecodeSec: number;
  comment: string;
  clientName?: string | null;
  clientEmail?: string | null;
  status?: 'open' | 'resolved' | 'archived';
  createdAt?: string | null;
}

interface Props {
  comments: CommentEntry[];
  onSeek: (sec: number) => void;
  /** Aktiv timecode i parent-player (markerer "her er du nå") */
  currentTime?: number;
  /** "under" for video, "side" for audio */
  layout?: 'under' | 'side';
  /** Default-tittel for headeren */
  title?: string;
  /** Skjul filter-tabs hvis du ikke vil ha dem */
  hideFilters?: boolean;
  /** Initielt kollapset på mobile (kun "side"-layout) */
  defaultCollapsed?: boolean;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtRelative(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diffMin = Math.floor((Date.now() - t) / 60_000);
  if (diffMin < 1) return 'nå';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}t`;
  return `${Math.floor(diffMin / 1440)}d`;
}

const CommentsPanel: React.FC<Props> = ({
  comments,
  onSeek,
  currentTime = 0,
  layout = 'under',
  title = 'Kommentarer',
  hideFilters = false,
  defaultCollapsed = false,
}) => {
  const isMobile = useMediaQuery('(max-width: 600px)');
  const [filter, setFilter] = useState<'all' | 'open'>('all');
  const [collapsed, setCollapsed] = useState(defaultCollapsed && isMobile);

  const sorted = useMemo(
    () => [...(comments || [])].sort((a, b) => a.timecodeSec - b.timecodeSec),
    [comments],
  );
  const filtered = useMemo(
    () => (filter === 'open' ? sorted.filter((c) => (c.status || 'open') === 'open') : sorted),
    [sorted, filter],
  );

  const openCount = sorted.filter((c) => (c.status || 'open') === 'open').length;
  const resolvedCount = sorted.length - openCount;

  if (comments.length === 0) {
    return (
      <Box
        sx={{
          mt: layout === 'under' ? 2 : 0,
          p: 3,
          textAlign: 'center',
          border: '1px dashed rgba(253, 250, 245, 0.18)',
          borderRadius: 1,
          bgcolor: 'rgba(253, 250, 245, 0.02)',
        }}
      >
        <CommentIcon sx={{ color: 'rgba(253, 250, 245, 0.3)', fontSize: 32, mb: 1 }} />
        <Typography
          sx={{
            fontFamily: SERIF_STACK,
            fontStyle: 'italic',
            fontSize: '1rem',
            color: 'rgba(253, 250, 245, 0.55)',
          }}
        >
          Ingen kommentarer ennå
        </Typography>
        <Typography
          variant="caption"
          sx={{ color: 'rgba(253, 250, 245, 0.4)', display: 'block', mt: 0.5 }}
        >
          Trykk på chat-ikonet under spilleren for å legge til den første.
        </Typography>
      </Box>
    );
  }

  // ── Comment-rad (gjenbrukes på begge layouts) ─────────────────────
  const renderComment = (c: CommentEntry, isLastInList: boolean) => {
    const isActiveTime = Math.abs(currentTime - c.timecodeSec) < 1.2;
    const isResolved = c.status === 'resolved';
    const initials = (c.clientName || c.clientEmail || '?').trim().charAt(0).toUpperCase();
    return (
      <Box
        key={c.id}
        onClick={() => onSeek(c.timecodeSec)}
        role="button"
        tabIndex={0}
        aria-label={`Hopp til ${fmtTime(c.timecodeSec)}: ${c.comment}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSeek(c.timecodeSec);
          }
        }}
        sx={{
          cursor: 'pointer',
          p: 1.8,
          borderRadius: 1,
          border: `1px solid ${isActiveTime ? 'rgba(217, 119, 6, 0.5)' : 'rgba(253, 250, 245, 0.08)'}`,
          bgcolor: isActiveTime ? 'rgba(217, 119, 6, 0.08)' : 'rgba(253, 250, 245, 0.02)',
          opacity: isResolved ? 0.55 : 1,
          transition: 'all 0.2s',
          '&:hover': {
            bgcolor: 'rgba(217, 119, 6, 0.10)',
            borderColor: 'rgba(217, 119, 6, 0.42)',
          },
          '&:focus-visible': { outline: '2px solid #d97706', outlineOffset: 2 },
          mb: isLastInList ? 0 : 1,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          {/* Timecode-pill (klikkbar visuell anchor) */}
          <Box
            sx={{
              flexShrink: 0,
              px: 1.2,
              py: 0.5,
              borderRadius: 0.5,
              bgcolor: '#d97706',
              color: '#fdfaf5',
              fontFamily: '"Inter", "Segoe UI", sans-serif',
              fontWeight: 700,
              fontSize: '0.75rem',
              letterSpacing: '0.04em',
              minWidth: 50,
              textAlign: 'center',
            }}
          >
            {fmtTime(c.timecodeSec)}
          </Box>
          {/* Innhold */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(253, 250, 245, 0.15)',
                  color: '#fdfaf5',
                  fontWeight: 700,
                }}
              >
                {initials}
              </Avatar>
              <Typography
                sx={{
                  fontFamily: SERIF_STACK,
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                  color: 'rgba(253, 250, 245, 0.78)',
                  letterSpacing: '0.02em',
                }}
                noWrap
              >
                {c.clientName || c.clientEmail || 'Klient'}
              </Typography>
              {c.createdAt && (
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(253, 250, 245, 0.4)', fontSize: '0.7rem' }}
                >
                  · {fmtRelative(c.createdAt)}
                </Typography>
              )}
              {isResolved && (
                <Chip
                  size="small"
                  icon={<ResolvedIcon sx={{ fontSize: '0.75rem !important' }} />}
                  label="Løst"
                  sx={{
                    ml: 'auto',
                    height: 18,
                    fontSize: '0.65rem',
                    bgcolor: 'rgba(16, 185, 129, 0.18)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    '& .MuiChip-icon': { color: '#10b981' },
                  }}
                />
              )}
            </Stack>
            <Typography
              sx={{
                fontSize: '0.9rem',
                color: 'rgba(253, 250, 245, 0.92)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {c.comment}
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  };

  // ── Header med filter-tabs ────────────────────────────────────────
  const renderHeader = () => (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ mb: 1.5 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="baseline">
        <CommentIcon sx={{ color: 'rgba(253, 250, 245, 0.7)', fontSize: 20 }} />
        <Typography
          sx={{
            fontFamily: SERIF_STACK,
            fontWeight: 400,
            fontSize: '1.4rem',
            color: '#fdfaf5',
            letterSpacing: '-0.015em',
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontFamily: SERIF_STACK,
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: 'rgba(253, 250, 245, 0.5)',
          }}
        >
          {comments.length}
        </Typography>
      </Stack>
      {!hideFilters && resolvedCount > 0 && (
        <Stack direction="row" spacing={0.5}>
          <Chip
            size="small"
            label={`Alle · ${sorted.length}`}
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'filled' : 'outlined'}
            sx={
              filter === 'all'
                ? {
                    height: 24,
                    bgcolor: '#fdfaf5',
                    color: '#0a0807',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    '&:hover': { bgcolor: '#fff' },
                  }
                : {
                    height: 24,
                    color: 'rgba(253, 250, 245, 0.7)',
                    borderColor: 'rgba(253, 250, 245, 0.32)',
                    fontSize: '0.7rem',
                    '&:hover': { bgcolor: 'rgba(253, 250, 245, 0.06)' },
                  }
            }
          />
          <Chip
            size="small"
            label={`Åpne · ${openCount}`}
            onClick={() => setFilter('open')}
            variant={filter === 'open' ? 'filled' : 'outlined'}
            sx={
              filter === 'open'
                ? {
                    height: 24,
                    bgcolor: '#d97706',
                    color: '#fdfaf5',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    '&:hover': { bgcolor: '#b45309' },
                  }
                : {
                    height: 24,
                    color: '#d97706',
                    borderColor: 'rgba(217, 119, 6, 0.42)',
                    fontSize: '0.7rem',
                    '&:hover': { bgcolor: 'rgba(217, 119, 6, 0.08)' },
                  }
            }
          />
        </Stack>
      )}
    </Stack>
  );

  // ── Side-layout (audio): kollapserbart på mobile ──────────────────
  if (layout === 'side') {
    return (
      <Box
        sx={{
          width: { xs: '100%', md: 360 },
          maxHeight: { xs: collapsed ? 'auto' : '60vh', md: '70vh' },
          overflowY: 'auto',
          p: { xs: 2, md: 2.5 },
          bgcolor: 'rgba(10, 8, 7, 0.6)',
          border: '1px solid rgba(253, 250, 245, 0.08)',
          borderRadius: 1,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {renderHeader()}
          {isMobile && (
            <IconButton
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Vis kommentarer' : 'Skjul kommentarer'}
              sx={{ color: '#fdfaf5', ml: 1 }}
            >
              {collapsed ? <ExpandIcon /> : <CollapseIcon />}
            </IconButton>
          )}
        </Stack>
        <Collapse in={!collapsed || !isMobile}>
          <Stack spacing={0}>
            {filtered.map((c, i) => renderComment(c, i === filtered.length - 1))}
            {filtered.length === 0 && (
              <Typography
                sx={{
                  fontFamily: SERIF_STACK,
                  fontStyle: 'italic',
                  fontSize: '0.9rem',
                  color: 'rgba(253, 250, 245, 0.5)',
                  textAlign: 'center',
                  py: 3,
                }}
              >
                Ingen åpne kommentarer
              </Typography>
            )}
          </Stack>
        </Collapse>
      </Box>
    );
  }

  // ── Under-layout (video): horisontal scroll-liste under spilleren ─
  return (
    <Box
      sx={{
        mt: 2,
        p: { xs: 2, sm: 3 },
        bgcolor: 'rgba(10, 8, 7, 0.6)',
        border: '1px solid rgba(253, 250, 245, 0.08)',
        borderRadius: 1,
        backdropFilter: 'blur(8px)',
      }}
    >
      {renderHeader()}
      <Stack spacing={1}>
        {filtered.map((c, i) => renderComment(c, i === filtered.length - 1))}
        {filtered.length === 0 && (
          <Typography
            sx={{
              fontFamily: SERIF_STACK,
              fontStyle: 'italic',
              fontSize: '0.9rem',
              color: 'rgba(253, 250, 245, 0.5)',
              textAlign: 'center',
              py: 3,
            }}
          >
            Ingen åpne kommentarer
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default CommentsPanel;
