/**
 * ContentCalendarTab — månedlig kalender med drafts + publiserte posts.
 *
 * Drag-drop fra unscheduled-sidepanel inn på dato-celle setter
 * suggestedPublishTime. Drag-drop mellom celler om-planlegger. Click på
 * post-tile åpner detail-drawer (samme edit-flyt som PostDraftsPanel).
 *
 * Følger AdminRoom-design (adminTokens). Platform-fargekoding, status-
 * badges, engagement-overlay for publiserte posts.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Drawer, IconButton, Stack, Tooltip, Typography, Divider, TextField,
  ToggleButton, ToggleButtonGroup, Menu, MenuItem,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import RefreshIcon from '@mui/icons-material/Refresh';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  addMonths, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, isPast, parseISO,
  setHours, setMinutes, formatISO,
} from 'date-fns';
import { nb } from 'date-fns/locale';
import { adminTokens, adminSx, statusChipSx } from './styles';

interface DraftPost {
  id: number;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'tiktok';
  status: 'draft' | 'edited' | 'published' | 'failed' | 'manual_copy';
  caption: string;
  hashtags: string[];
  imageBrief: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  sourceInsight: string | null;
  suggestedPublishTime: string | null;
  publishedAt: string | null;
  externalPostId: string | null;
  generatedAt: string;
  latestEngagement: {
    engagement_rate: number | null;
    reach: number | null;
    reactions_total: number | null;
    comments_count: number | null;
  } | null;
}

const PLATFORM_META: Record<DraftPost['platform'], { icon: React.ReactElement; color: string; bg: string }> = {
  facebook:  { icon: <FacebookIcon sx={{ fontSize: 12 }} />, color: adminTokens.platforms.facebook,  bg: 'rgba(96,165,250,0.18)' },
  instagram: { icon: <InstagramIcon sx={{ fontSize: 12 }} />, color: adminTokens.platforms.instagram, bg: 'rgba(236,72,153,0.18)' },
  linkedin:  { icon: <LinkedInIcon sx={{ fontSize: 12 }} />, color: adminTokens.platforms.linkedin,  bg: 'rgba(10,102,194,0.18)' },
  tiktok:    { icon: <MusicNoteIcon sx={{ fontSize: 12 }} />, color: adminTokens.platforms.tiktok,    bg: 'rgba(249,115,22,0.18)' },
};

const STATUS_META: Record<DraftPost['status'], { color: string; bg: string; label: string }> = {
  draft:       { color: '#94a3b8', bg: 'rgba(148,163,184,0.18)', label: 'Draft' },
  edited:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.18)',  label: 'Edited' },
  published:   { color: '#22c55e', bg: 'rgba(34,197,94,0.18)',   label: 'Publisert' },
  failed:      { color: '#ef4444', bg: 'rgba(239,68,68,0.18)',   label: 'Failed' },
  manual_copy: { color: '#fbbf24', bg: 'rgba(251,191,36,0.18)',  label: 'Manuell' },
};

// ─── Draggable post tile ──────────────────────────────────────────────────
function PostTile({ post, onClick, dense = false }: { post: DraftPost; onClick: () => void; dense?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `post-${post.id}`,
    data: { post },
  });
  const pmeta = PLATFORM_META[post.platform];
  const smeta = STATUS_META[post.status];
  const isPublished = post.status === 'published';
  const captionLine = post.caption.split('\n')[0].slice(0, dense ? 30 : 60);

  return (
    <Box
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      sx={{
        background: pmeta.bg,
        borderLeft: `3px solid ${pmeta.color}`,
        borderRadius: 0.5,
        px: 0.75, py: 0.4,
        cursor: 'grab',
        opacity: isDragging ? 0.35 : 1,
        '&:hover': { background: pmeta.bg.replace('0.18', '0.3') },
        transition: 'background 120ms',
        userSelect: 'none',
      }}
      data-testid={`post-tile-${post.id}`}
    >
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Box sx={{ color: pmeta.color, display: 'flex' }}>{pmeta.icon}</Box>
        {isPublished && <CheckCircleOutlineIcon sx={{ fontSize: 11, color: smeta.color }} />}
        {post.status === 'failed' && <ErrorOutlineIcon sx={{ fontSize: 11, color: smeta.color }} />}
        <Typography variant="caption" sx={{
          color: adminTokens.text.body,
          fontSize: dense ? '0.65rem' : '0.7rem',
          fontWeight: 600,
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {captionLine}
        </Typography>
      </Stack>
      {!dense && post.latestEngagement?.engagement_rate != null && (
        <Typography variant="caption" sx={{
          color: adminTokens.status.success.text, fontSize: '0.6rem', display: 'block', mt: 0.2,
        }}>
          ✓ ER {(post.latestEngagement.engagement_rate * 100).toFixed(1)}% · {post.latestEngagement.reach ?? '?'} reach
        </Typography>
      )}
    </Box>
  );
}

// ─── Droppable day cell ───────────────────────────────────────────────────
function DayCell({
  date, posts, isInCurrentMonth, onCellClick, onPostClick,
}: {
  date: Date;
  posts: DraftPost[];
  isInCurrentMonth: boolean;
  onCellClick: (date: Date) => void;
  onPostClick: (post: DraftPost) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${formatISO(date, { representation: 'date' })}`,
    data: { date: formatISO(date, { representation: 'date' }) },
  });
  const today = isToday(date);
  const past = isPast(date) && !today;

  return (
    <Box
      ref={setNodeRef}
      onClick={() => onCellClick(date)}
      sx={{
        background: isOver ? adminTokens.primary.soft : (today ? adminTokens.primary.softer : 'transparent'),
        border: `1px solid ${today ? adminTokens.border.accent : adminTokens.border.subtle}`,
        borderRadius: 0.5,
        p: 0.5,
        minHeight: 100,
        opacity: isInCurrentMonth ? 1 : 0.45,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 120ms',
        '&:hover .add-hint': { opacity: past ? 0 : 0.8 },
      }}
      data-testid={`day-${formatISO(date, { representation: 'date' })}`}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
        <Typography variant="caption" sx={{
          color: today ? adminTokens.primary.textLight : adminTokens.text.muted,
          fontWeight: today ? 800 : 500,
          fontSize: '0.7rem',
        }}>
          {format(date, 'd')}
        </Typography>
        {today && (
          <Chip label="I dag" size="small" sx={{
            background: adminTokens.primary.soft, color: adminTokens.primary.text,
            fontSize: '0.55rem', height: 14,
          }} />
        )}
      </Stack>
      <Stack spacing={0.3}>
        {posts.slice(0, 3).map((p) => (
          <PostTile key={p.id} post={p} onClick={() => onPostClick(p)} dense />
        ))}
        {posts.length > 3 && (
          <Typography variant="caption" sx={{ color: adminTokens.text.muted, fontSize: '0.6rem' }}>
            +{posts.length - 3} til
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

// ─── Detail-drawer (edit/publish/delete) ─────────────────────────────────
function PostDrawer({
  post, open, onClose, onSave, onPublish, onDelete, publishBusy,
}: {
  post: DraftPost | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: number, patch: Partial<DraftPost>) => Promise<void>;
  onPublish: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  publishBusy: boolean;
}) {
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (post) {
      setCaption(post.caption || '');
      setHashtags((post.hashtags || []).join(' '));
      setScheduledFor(post.suggestedPublishTime ? format(parseISO(post.suggestedPublishTime), "yyyy-MM-dd'T'HH:mm") : '');
    }
  }, [post]);

  if (!post) return null;
  const pmeta = PLATFORM_META[post.platform];
  const smeta = STATUS_META[post.status];

  return (
    <Drawer
      anchor="right" open={open} onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, background: adminTokens.bg.overlay, color: adminTokens.text.body } }}
    >
      <Box sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: pmeta.bg, color: pmeta.color }}>
            {pmeta.icon}
          </Avatar>
          <Typography sx={{ fontWeight: 800, color: adminTokens.text.primary, flex: 1 }}>
            {post.platform.toUpperCase()} · draft #{post.id}
          </Typography>
          <Chip label={smeta.label} size="small"
            sx={{ background: smeta.bg, color: smeta.color, fontWeight: 700, fontSize: '0.7rem' }} />
        </Stack>

        {post.sourceInsight && (
          <Typography variant="caption" sx={{
            color: adminTokens.text.muted, display: 'block', mb: 1.5, fontStyle: 'italic',
          }}>
            Fra: {post.sourceInsight}
          </Typography>
        )}

        <TextField
          label="Scheduled for"
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
          fullWidth size="small"
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 1.5, '& .MuiInputBase-root': { color: adminTokens.text.body } }}
        />

        <TextField
          label="Caption" multiline minRows={6} fullWidth value={caption}
          onChange={(e) => setCaption(e.target.value)}
          sx={{ mb: 1.5, '& .MuiInputBase-root': { color: adminTokens.text.body, fontFamily: 'monospace', fontSize: '0.82rem' } }}
        />
        <Typography variant="caption" sx={{ color: adminTokens.text.muted, display: 'block', mb: 1 }}>
          {caption.length} chars
        </Typography>

        <TextField
          label="Hashtags (space-separated)" fullWidth value={hashtags}
          onChange={(e) => setHashtags(e.target.value)} size="small"
          sx={{ mb: 1.5, '& .MuiInputBase-root': { color: adminTokens.text.body } }}
        />

        {post.imageBrief && (
          <Box sx={{ p: 1.2, background: adminTokens.bg.panel, borderRadius: 0.5, mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: adminTokens.text.muted, fontWeight: 700 }}>BILDE-BRIEF</Typography>
            <Typography variant="body2" sx={{ color: adminTokens.text.body, mt: 0.3 }}>{post.imageBrief}</Typography>
          </Box>
        )}

        {post.ctaText && post.ctaLink && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Chip label={post.ctaText} size="small" sx={statusChipSx('warning')} />
            <Typography variant="caption" sx={{ color: adminTokens.primary.textBright, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              → {post.ctaLink}
            </Typography>
          </Stack>
        )}

        {post.status === 'published' && post.latestEngagement && (
          <Box sx={{
            p: 1.5, background: 'rgba(34,197,94,0.08)',
            border: `1px solid ${adminTokens.status.success.border}`, borderRadius: 1, mb: 1.5,
          }}>
            <Typography variant="caption" sx={{ color: adminTokens.status.success.text, fontWeight: 700 }}>
              ENGAGEMENT
            </Typography>
            <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
              {post.latestEngagement.reach != null && (
                <Box><Typography variant="caption" sx={{ color: adminTokens.text.muted }}>Reach</Typography>
                <Typography sx={{ fontWeight: 700 }}>{post.latestEngagement.reach}</Typography></Box>
              )}
              {post.latestEngagement.reactions_total != null && (
                <Box><Typography variant="caption" sx={{ color: adminTokens.text.muted }}>Reactions</Typography>
                <Typography sx={{ fontWeight: 700 }}>{post.latestEngagement.reactions_total}</Typography></Box>
              )}
              {post.latestEngagement.comments_count != null && (
                <Box><Typography variant="caption" sx={{ color: adminTokens.text.muted }}>Comments</Typography>
                <Typography sx={{ fontWeight: 700 }}>{post.latestEngagement.comments_count}</Typography></Box>
              )}
              {post.latestEngagement.engagement_rate != null && (
                <Box><Typography variant="caption" sx={{ color: adminTokens.text.muted }}>ER</Typography>
                <Typography sx={{ fontWeight: 700, color: adminTokens.status.success.base }}>
                  {(post.latestEngagement.engagement_rate * 100).toFixed(2)}%
                </Typography></Box>
              )}
            </Stack>
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button
            variant="contained" startIcon={<EditIcon />}
            sx={adminSx.primaryButton}
            onClick={async () => {
              setBusy(true);
              try {
                const patch: Partial<DraftPost> & { suggestedPublishTime?: string | null } = {
                  caption,
                  hashtags: hashtags.split(/\s+/).filter(Boolean),
                };
                patch.suggestedPublishTime = scheduledFor ? new Date(scheduledFor).toISOString() : null;
                await onSave(post.id, patch);
              } finally { setBusy(false); }
            }}
            disabled={busy}
            data-testid="drawer-save"
          >
            {busy ? 'Lagrer…' : 'Lagre'}
          </Button>
          {post.status !== 'published' && (
            <Button
              variant="contained" startIcon={publishBusy ? <CircularProgress size={14} /> : <RocketLaunchIcon />}
              onClick={() => void onPublish(post.id)} disabled={publishBusy}
              data-testid="drawer-publish"
              sx={{ background: adminTokens.status.success.base, color: '#fff',
                '&:hover': { background: '#16a34a' }, textTransform: 'none', fontWeight: 700 }}
            >
              {publishBusy ? 'Publiserer…' : 'Publiser nå'}
            </Button>
          )}
          <Button
            startIcon={<DeleteOutlineIcon />}
            onClick={() => void onDelete(post.id)}
            sx={{ color: adminTokens.status.error.base, textTransform: 'none' }}
            data-testid="drawer-delete"
          >
            Slett
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}

// ─── Main calendar tab ────────────────────────────────────────────────────
export default function ContentCalendarTab() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [scheduled, setScheduled] = useState<DraftPost[]>([]);
  const [unscheduled, setUnscheduled] = useState<DraftPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerPost, setDrawerPost] = useState<DraftPost | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDragPost, setActiveDragPost] = useState<DraftPost | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<'all' | DraftPost['platform']>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'drafts' | 'published'>('all');
  const [publishBusy, setPublishBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const from = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
      const to = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
      const r = await fetch(
        `/api/role-room/marketing-cockpit/content-calendar?brandKey=theroleroom&from=${formatISO(from)}&to=${formatISO(to)}`,
        { credentials: 'include' },
      );
      if (!r.ok) throw new Error(`Status ${r.status}`);
      const d = await r.json();
      setScheduled(d.scheduled || []);
      setUnscheduled(d.unscheduled || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }, [currentMonth]);

  useEffect(() => { void load(); }, [load]);

  // Build calendar grid: Monday-start, 6 rows × 7 cols
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Filter posts client-side
  const filtered = useMemo(() => {
    return scheduled.filter((p) => {
      if (filterPlatform !== 'all' && p.platform !== filterPlatform) return false;
      if (filterStatus === 'drafts' && p.status === 'published') return false;
      if (filterStatus === 'published' && p.status !== 'published') return false;
      return true;
    });
  }, [scheduled, filterPlatform, filterStatus]);

  // Group posts by day (yyyy-MM-dd key)
  const postsByDay = useMemo(() => {
    const map = new Map<string, DraftPost[]>();
    for (const p of filtered) {
      const isoDate = p.publishedAt || p.suggestedPublishTime;
      if (!isoDate) continue;
      const key = formatISO(parseISO(isoDate), { representation: 'date' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return map;
  }, [filtered]);

  const handleDragStart = useCallback((event: { active: { data: { current?: { post?: DraftPost } } } }) => {
    const p = event.active.data.current?.post;
    if (p) setActiveDragPost(p);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveDragPost(null);
    const post = event.active.data.current?.post as DraftPost | undefined;
    const dateStr = event.over?.data.current?.date as string | undefined;
    if (!post || !dateStr) return;
    // Default to 09:00 in the target date (suggestedPublishTime)
    const targetDate = setMinutes(setHours(parseISO(dateStr), 9), 0);
    try {
      const r = await fetch(`/api/role-room/agent/post-drafts/${post.id}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestedPublishTime: targetDate.toISOString() }),
      });
      const d = await r.json();
      if (d.ok) {
        setNotice({ kind: 'success', msg: `Planlagt ${format(targetDate, 'd. MMM HH:mm', { locale: nb })}` });
        await load();
      } else {
        setNotice({ kind: 'error', msg: d.error || 'Schedule failed' });
      }
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    }
  }, [load]);

  const handleSave = useCallback(async (id: number, patch: Record<string, unknown>) => {
    const r = await fetch(`/api/role-room/agent/post-drafts/${id}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const d = await r.json();
    if (d.ok) {
      setNotice({ kind: 'success', msg: 'Lagret.' });
      setDrawerOpen(false);
      await load();
    } else {
      setNotice({ kind: 'error', msg: d.error || 'Save failed' });
    }
  }, [load]);

  const handlePublish = useCallback(async (id: number) => {
    setPublishBusy(id);
    try {
      const r = await fetch(`/api/role-room/agent/post-drafts/${id}/publish`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await r.json();
      if (d.ok && d.status === 'published') {
        setNotice({ kind: 'success', msg: `Publisert. ${d.permalink || ''}` });
      } else if (d.status === 'manual_copy') {
        setNotice({ kind: 'success', msg: d.message || 'Marker som manuell.' });
      } else {
        setNotice({ kind: 'error', msg: d.error || d.errorMessage || 'Publish failed' });
      }
      await load();
      setDrawerOpen(false);
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally { setPublishBusy(null); }
  }, [load]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Slett draft?')) return;
    try {
      const r = await fetch(`/api/role-room/agent/post-drafts/${id}`, { method: 'DELETE', credentials: 'include' });
      const d = await r.json();
      if (d.ok) { setNotice({ kind: 'success', msg: 'Slettet.' }); setDrawerOpen(false); await load(); }
      else setNotice({ kind: 'error', msg: d.error || 'Delete failed' });
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    }
  }, [load]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Stack spacing={2} data-testid="content-calendar-root">
        {/* Header bar */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <CalendarMonthIcon sx={{ color: adminTokens.primary.textBright, fontSize: 22 }} />
          <Typography sx={adminSx.sectionHeader}>Content-kalender</Typography>
          <Button size="small" startIcon={<TodayIcon />} sx={adminSx.secondaryButton}
            onClick={() => setCurrentMonth(new Date())} data-testid="cal-today">
            I dag
          </Button>
          <IconButton size="small" onClick={() => setCurrentMonth((d) => addMonths(d, -1))} data-testid="cal-prev">
            <ChevronLeftIcon sx={{ color: adminTokens.primary.textBright }} />
          </IconButton>
          <Typography sx={{ minWidth: 160, textAlign: 'center', fontWeight: 700, color: adminTokens.text.primary }}>
            {format(currentMonth, 'MMMM yyyy', { locale: nb })}
          </Typography>
          <IconButton size="small" onClick={() => setCurrentMonth((d) => addMonths(d, 1))} data-testid="cal-next">
            <ChevronRightIcon sx={{ color: adminTokens.primary.textBright }} />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => void load()}
            disabled={loading} sx={adminSx.secondaryButton} data-testid="cal-refresh">
            Refresh
          </Button>
        </Stack>

        {/* Filter row */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ color: adminTokens.text.muted }}>Plattform:</Typography>
          <ToggleButtonGroup
            value={filterPlatform} exclusive size="small"
            onChange={(_, v) => v && setFilterPlatform(v)}
            sx={{ '& .MuiToggleButton-root': {
              color: 'rgba(203,213,225,0.6)', textTransform: 'none',
              fontSize: '0.7rem', py: 0.2, px: 1,
              '&.Mui-selected': { background: adminTokens.primary.soft, color: adminTokens.primary.text },
            } }}>
            <ToggleButton value="all">Alle</ToggleButton>
            <ToggleButton value="facebook"><FacebookIcon sx={{ fontSize: 14, color: '#60a5fa' }} /></ToggleButton>
            <ToggleButton value="instagram"><InstagramIcon sx={{ fontSize: 14, color: '#ec4899' }} /></ToggleButton>
            <ToggleButton value="linkedin"><LinkedInIcon sx={{ fontSize: 14, color: '#0a66c2' }} /></ToggleButton>
            <ToggleButton value="tiktok"><MusicNoteIcon sx={{ fontSize: 14, color: '#f97316' }} /></ToggleButton>
          </ToggleButtonGroup>
          <Divider orientation="vertical" flexItem sx={{ borderColor: adminTokens.border.subtle }} />
          <Typography variant="caption" sx={{ color: adminTokens.text.muted }}>Status:</Typography>
          <ToggleButtonGroup
            value={filterStatus} exclusive size="small"
            onChange={(_, v) => v && setFilterStatus(v)}
            sx={{ '& .MuiToggleButton-root': {
              color: 'rgba(203,213,225,0.6)', textTransform: 'none',
              fontSize: '0.7rem', py: 0.2, px: 1,
              '&.Mui-selected': { background: adminTokens.primary.soft, color: adminTokens.primary.text },
            } }}>
            <ToggleButton value="all">Alle</ToggleButton>
            <ToggleButton value="drafts">Drafts</ToggleButton>
            <ToggleButton value="published">Publisert</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        {notice && (
          <Alert severity={notice.kind} onClose={() => setNotice(null)} data-testid="cal-notice">{notice.msg}</Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        {/* Main layout: calendar + side panel */}
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 280px' } }}>
          {/* Calendar grid */}
          <Card sx={adminSx.panel}>
            <CardContent sx={{ p: 1.5 }}>
              {/* Weekday header */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, mb: 0.5 }}>
                {['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'].map((d) => (
                  <Typography key={d} variant="caption" sx={{
                    color: adminTokens.text.muted, textAlign: 'center', fontWeight: 700,
                    fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    {d}
                  </Typography>
                ))}
              </Box>
              {/* Day cells */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
                {days.map((day) => {
                  const key = formatISO(day, { representation: 'date' });
                  const dayPosts = postsByDay.get(key) || [];
                  return (
                    <DayCell
                      key={key}
                      date={day}
                      posts={dayPosts}
                      isInCurrentMonth={isSameMonth(day, currentMonth)}
                      onCellClick={() => {/* future: open compose-for-day-flow */}}
                      onPostClick={(p) => { setDrawerPost(p); setDrawerOpen(true); }}
                    />
                  );
                })}
              </Box>
            </CardContent>
          </Card>

          {/* Side panel: unscheduled drafts */}
          <Card sx={adminSx.panel} data-testid="unscheduled-panel">
            <CardContent sx={{ p: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <EventBusyIcon sx={{ fontSize: 16, color: adminTokens.text.muted }} />
                <Typography sx={{ ...adminSx.sectionSubHeader, m: 0 }}>
                  Uplanlagte ({unscheduled.length})
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: adminTokens.text.muted, display: 'block', mb: 1 }}>
                Dra over på kalenderen for å planlegge.
              </Typography>
              {unscheduled.length === 0 && (
                <Typography variant="caption" sx={{ color: adminTokens.text.muted, fontStyle: 'italic' }}>
                  Ingen uplanlagte drafts.
                </Typography>
              )}
              <Stack spacing={0.5} sx={{ maxHeight: 600, overflowY: 'auto', pr: 0.5 }}>
                {unscheduled.map((p) => (
                  <PostTile key={p.id} post={p} onClick={() => { setDrawerPost(p); setDrawerOpen(true); }} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Box>

        <DragOverlay>
          {activeDragPost && (
            <Box sx={{ opacity: 0.85, transform: 'scale(1.05)' }}>
              <PostTile post={activeDragPost} onClick={() => {}} />
            </Box>
          )}
        </DragOverlay>

        <PostDrawer
          post={drawerPost}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSave={handleSave}
          onPublish={handlePublish}
          onDelete={handleDelete}
          publishBusy={publishBusy === drawerPost?.id}
        />
      </Stack>
    </DndContext>
  );
}
