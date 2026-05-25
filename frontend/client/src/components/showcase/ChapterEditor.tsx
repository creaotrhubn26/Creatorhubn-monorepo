// @ts-nocheck
/**
 * ChapterEditor — Slice 9X.84
 *
 * Admin-UI for å redigere `photographer_client_galleries.gallery_settings.chapters[]`.
 * Brukes av Stine (bilder), Bjarne (video) og Michael (lyd) for å bygge en
 * Pic-Time-stil story-flyt. Patches via /api/photographer/galleries/:id/settings
 * (`chapters` er allerede i ALLOWED-listen på backend).
 *
 * Funksjoner:
 *   - Dra og slipp for å reordne kapitler (@dnd-kit)
 *   - Tre type-templates: bilder / video / lyd
 *   - Per kapittel: tittel, intro, roman-numeral (auto-default)
 *   - Bilder: klikkbar grid med eksisterende gallery-bilder for å velge/avvelge
 *   - Video: URL + poster
 *   - Lyd: URL + cover + credits
 *   - Markørene/seksjonene per video/audio er ikke i v1 (kan legges til senere)
 *
 * Designet matcher GallerySettingsDialog (MUI + standard admin-stil).
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Alert,
  Tooltip,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Image as ImageIcon,
  Videocam as VideoIcon,
  MusicNote as AudioIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface VideoMarker {
  startSec: number;
  title: string;
  intro?: string | null;
  romanNumeral?: string | null;
}

interface AudioSection {
  startSec: number;
  title: string;
  romanNumeral?: string | null;
}

interface GalleryChapterPayload {
  id: string;
  title: string;
  intro?: string | null;
  romanNumeral?: string | null;
  imageIds?: string[];
  videoUrl?: string | null;
  videoPoster?: string | null;
  videoMarkers?: VideoMarker[];
  audioUrl?: string | null;
  audioCover?: string | null;
  audioCredits?: string | null;
  audioSections?: AudioSection[];
}

/** "mm:ss" → sekunder, eller null hvis ugyldig */
function parseTimecode(raw: string): number | null {
  const m = String(raw).trim().match(/^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const minutes = Number(m[1]);
  const seconds = Number(m[2]);
  const millis = m[3] ? Number(m[3].padEnd(3, '0')) / 1000 : 0;
  return minutes * 60 + seconds + millis;
}

function fmtTimecode(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface GalleryImage {
  id: string;
  title: string;
  thumbnailUrl: string;
  fullSizeUrl: string;
}

interface Props {
  open: boolean;
  galleryId: string;
  onClose: () => void;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function nextChapterId(): string {
  return `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function chapterKind(ch: GalleryChapterPayload): 'images' | 'video' | 'audio' {
  if (ch.videoUrl) return 'video';
  if (ch.audioUrl) return 'audio';
  return 'images';
}

const KIND_META = {
  images: { label: 'Bilder', color: '#3b82f6', icon: <ImageIcon sx={{ fontSize: 18 }} /> },
  video: { label: 'Video', color: '#d97706', icon: <VideoIcon sx={{ fontSize: 18 }} /> },
  audio: { label: 'Lyd', color: '#a855f7', icon: <AudioIcon sx={{ fontSize: 18 }} /> },
} as const;

/* ── Sub-component: tidskode-markører/seksjoner ─────────────────── */
const MarkersEditor: React.FC<{
  label: string;
  items: Array<{ startSec: number; title: string; intro?: string | null; romanNumeral?: string | null }>;
  withIntro?: boolean;
  onChange: (next: Array<{ startSec: number; title: string; intro?: string | null; romanNumeral?: string | null }>) => void;
}> = ({ label, items, withIntro = false, onChange }) => {
  const [tcDraft, setTcDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [tcError, setTcError] = useState<string | null>(null);

  const add = () => {
    const sec = parseTimecode(tcDraft);
    if (sec == null) {
      setTcError('Bruk format mm:ss (f.eks. 1:32)');
      return;
    }
    if (!titleDraft.trim()) {
      setTcError('Tittel kreves');
      return;
    }
    setTcError(null);
    const sorted = [...items, { startSec: sec, title: titleDraft.trim() }].sort(
      (a, b) => a.startSec - b.startSec,
    );
    onChange(sorted);
    setTcDraft('');
    setTitleDraft('');
  };

  const update = (idx: number, patch: Partial<{ startSec: number; title: string; intro: string; romanNumeral: string }>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
        {label}
      </Typography>

      {items.length > 0 && (
        <Stack spacing={0.8} sx={{ mb: 1.5 }}>
          {items.map((it, idx) => (
            <Stack key={idx} direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                label={fmtTimecode(it.startSec)}
                sx={{ fontFamily: 'monospace', minWidth: 60 }}
              />
              <TextField
                size="small"
                value={it.title}
                onChange={(e) => update(idx, { title: e.target.value })}
                placeholder="Tittel"
                sx={{ flex: 1 }}
              />
              {withIntro && (
                <TextField
                  size="small"
                  value={it.intro || ''}
                  onChange={(e) => update(idx, { intro: e.target.value })}
                  placeholder="Intro (valgfri)"
                  sx={{ flex: 1 }}
                />
              )}
              <IconButton size="small" onClick={() => remove(idx)} color="error" aria-label="Slett markør">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          size="small"
          value={tcDraft}
          onChange={(e) => { setTcDraft(e.target.value); setTcError(null); }}
          placeholder="0:00"
          sx={{ width: 90, '& input': { fontFamily: 'monospace' } }}
          error={Boolean(tcError && tcError.includes('mm:ss'))}
        />
        <TextField
          size="small"
          value={titleDraft}
          onChange={(e) => { setTitleDraft(e.target.value); setTcError(null); }}
          placeholder="Tittel"
          sx={{ flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={add}>
          Legg til
        </Button>
      </Stack>
      {tcError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
          {tcError}
        </Typography>
      )}
    </Box>
  );
};

/* ── Sortable chapter card ──────────────────────────────────────── */
const SortableChapter: React.FC<{
  chapter: GalleryChapterPayload;
  index: number;
  images: GalleryImage[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: GalleryChapterPayload) => void;
  onDelete: () => void;
}> = ({ chapter, index, images, expanded, onToggle, onChange, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: chapter.id,
  });

  const kind = chapterKind(chapter);
  const meta = KIND_META[kind];
  const selectedIds = new Set(chapter.imageIds || []);
  const selectedCount = kind === 'images' ? selectedIds.size : 0;

  const toggleImage = (imgId: string) => {
    const current = new Set(chapter.imageIds || []);
    if (current.has(imgId)) current.delete(imgId);
    else current.add(imgId);
    onChange({ ...chapter, imageIds: Array.from(current) });
  };

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        mb: 1.5,
      }}
    >
      {/* Header row — drag, kind-chip, title, expand, delete */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ p: 1.2, borderBottom: expanded ? '1px solid' : 'none', borderColor: 'divider' }}
      >
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
          aria-label="Dra for å reordne"
        >
          <DragIcon />
        </IconButton>
        <Chip
          icon={meta.icon as React.ReactElement}
          label={meta.label}
          size="small"
          sx={{
            bgcolor: `${meta.color}1a`,
            color: meta.color,
            fontWeight: 700,
            border: `1px solid ${meta.color}42`,
            '& .MuiChip-icon': { color: meta.color },
          }}
        />
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: 'text.secondary', minWidth: 28, textAlign: 'center' }}
        >
          {chapter.romanNumeral || ROMAN[index] || String(index + 1)}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {chapter.title || <em style={{ opacity: 0.5 }}>(uten tittel)</em>}
        </Typography>
        {kind === 'images' && (
          <Chip
            size="small"
            label={`${selectedCount} ${selectedCount === 1 ? 'bilde' : 'bilder'}`}
            variant="outlined"
          />
        )}
        <Tooltip title={expanded ? 'Lukk' : 'Rediger'}>
          <IconButton size="small" onClick={onToggle}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Slett kapittel">
          <IconButton size="small" onClick={onDelete} color="error">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="Tittel"
                value={chapter.title}
                onChange={(e) => onChange({ ...chapter, title: e.target.value })}
                size="small"
                fullWidth
              />
              <TextField
                label="Romersk-tall"
                value={chapter.romanNumeral || ''}
                onChange={(e) => onChange({ ...chapter, romanNumeral: e.target.value })}
                size="small"
                placeholder={ROMAN[index]}
                sx={{ width: 110 }}
                helperText="Auto hvis tom"
              />
            </Stack>
            <TextField
              label="Introduksjon (valgfri)"
              value={chapter.intro || ''}
              onChange={(e) => onChange({ ...chapter, intro: e.target.value })}
              size="small"
              fullWidth
              multiline
              rows={2}
              placeholder="Kort tekst som vises før kapittel-innholdet"
            />

            {/* Type-specific felter */}
            {kind === 'video' && (
              <>
                <TextField
                  label="Video-URL"
                  value={chapter.videoUrl || ''}
                  onChange={(e) => onChange({ ...chapter, videoUrl: e.target.value })}
                  size="small"
                  fullWidth
                  placeholder="https://… (mp4, R2-link, etc.)"
                />
                <TextField
                  label="Poster-bilde URL (valgfri)"
                  value={chapter.videoPoster || ''}
                  onChange={(e) => onChange({ ...chapter, videoPoster: e.target.value })}
                  size="small"
                  fullWidth
                  placeholder="https://… (vises før play)"
                />
                <MarkersEditor
                  label="Kapittel-markører på videoen (klikkbar tidskode i klient-spilleren)"
                  items={chapter.videoMarkers || []}
                  withIntro
                  onChange={(next) => onChange({ ...chapter, videoMarkers: next as VideoMarker[] })}
                />
              </>
            )}

            {kind === 'audio' && (
              <>
                <TextField
                  label="Lyd-URL"
                  value={chapter.audioUrl || ''}
                  onChange={(e) => onChange({ ...chapter, audioUrl: e.target.value })}
                  size="small"
                  fullWidth
                  placeholder="https://… (mp3, wav, etc.)"
                />
                <TextField
                  label="Cover-bilde URL (valgfri)"
                  value={chapter.audioCover || ''}
                  onChange={(e) => onChange({ ...chapter, audioCover: e.target.value })}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Credits (valgfri)"
                  value={chapter.audioCredits || ''}
                  onChange={(e) => onChange({ ...chapter, audioCredits: e.target.value })}
                  size="small"
                  fullWidth
                  placeholder="Produsert av Michael Larsen · 2026"
                />
                <MarkersEditor
                  label="Seksjoner i lyd-sporet (intro, vers, refreng, …)"
                  items={chapter.audioSections || []}
                  onChange={(next) => onChange({ ...chapter, audioSections: next as AudioSection[] })}
                />
              </>
            )}

            {kind === 'images' && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Klikk bilder for å inkludere i dette kapittelet ({selectedCount} valgt)
                </Typography>
                {images.length === 0 ? (
                  <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
                    Last opp bilder til galleriet først.
                  </Alert>
                ) : (
                  <ImageList cols={4} gap={6} sx={{ maxHeight: 320, m: 0 }}>
                    {images.map((img) => {
                      const isSelected = selectedIds.has(img.id);
                      return (
                        <ImageListItem
                          key={img.id}
                          onClick={() => toggleImage(img.id)}
                          sx={{
                            cursor: 'pointer',
                            position: 'relative',
                            border: '2px solid',
                            borderColor: isSelected ? 'primary.main' : 'transparent',
                            borderRadius: 1,
                            overflow: 'hidden',
                            opacity: isSelected ? 1 : 0.65,
                            transition: 'all 120ms',
                            '&:hover': { opacity: 1 },
                          }}
                        >
                          <img
                            src={img.thumbnailUrl || img.fullSizeUrl}
                            alt={img.title || ''}
                            loading="lazy"
                            style={{ display: 'block', width: '100%', height: 80, objectFit: 'cover' }}
                          />
                          {isSelected && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                bgcolor: 'primary.main',
                                color: 'primary.contrastText',
                                borderRadius: '50%',
                                width: 22,
                                height: 22,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <CheckIcon sx={{ fontSize: 16 }} />
                            </Box>
                          )}
                        </ImageListItem>
                      );
                    })}
                  </ImageList>
                )}
              </Box>
            )}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
};

/* ── Main editor ────────────────────────────────────────────────── */
const ChapterEditor: React.FC<Props> = ({ open, galleryId, onClose }) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{
    gallery: { settings: { chapters?: GalleryChapterPayload[] } };
    images: GalleryImage[];
  }>({
    queryKey: ['/api/photographer/galleries', galleryId],
    queryFn: () => apiRequest(`/api/photographer/galleries/${galleryId}`),
    enabled: open && Boolean(galleryId),
  });

  const [chapters, setChapters] = useState<GalleryChapterPayload[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [dirty, setDirty] = useState(false);

  // Synk fra server når dataene laster
  useEffect(() => {
    if (data?.gallery?.settings) {
      const existing = data.gallery.settings.chapters || [];
      setChapters(existing.map((c) => ({ ...c, imageIds: c.imageIds || [] })));
      setDirty(false);
    }
  }, [data]);

  const images = data?.images || [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setChapters((prev) => {
      const oldIdx = prev.findIndex((c) => c.id === active.id);
      const newIdx = prev.findIndex((c) => c.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      setDirty(true);
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const addChapter = (kind: 'images' | 'video' | 'audio') => {
    setAddMenuAnchor(null);
    const idx = chapters.length;
    const base: GalleryChapterPayload = {
      id: nextChapterId(),
      title: '',
      intro: '',
      romanNumeral: ROMAN[idx] || String(idx + 1),
      imageIds: [],
    };
    if (kind === 'video') base.videoUrl = '';
    if (kind === 'audio') base.audioUrl = '';
    setChapters((prev) => [...prev, base]);
    setExpandedId(base.id);
    setDirty(true);
  };

  const updateChapter = (id: string, next: GalleryChapterPayload) => {
    setChapters((prev) => prev.map((c) => (c.id === id ? next : c)));
    setDirty(true);
  };

  const deleteChapter = (id: string) => {
    setChapters((prev) => prev.filter((c) => c.id !== id));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleaned = chapters.map((c) => {
        const kind = chapterKind(c);
        const base: GalleryChapterPayload = {
          id: c.id,
          title: (c.title || '').trim(),
          intro: (c.intro || '').trim() || null,
          romanNumeral: (c.romanNumeral || '').trim() || null,
          imageIds: kind === 'images' ? (c.imageIds || []) : [],
        };
        if (kind === 'video') {
          base.videoUrl = (c.videoUrl || '').trim();
          base.videoPoster = (c.videoPoster || '').trim() || null;
          base.videoMarkers = (c.videoMarkers || []).map((m) => ({
            startSec: Number(m.startSec) || 0,
            title: (m.title || '').trim(),
            intro: (m.intro || '').trim() || null,
            romanNumeral: (m.romanNumeral || '').trim() || null,
          }));
        }
        if (kind === 'audio') {
          base.audioUrl = (c.audioUrl || '').trim();
          base.audioCover = (c.audioCover || '').trim() || null;
          base.audioCredits = (c.audioCredits || '').trim() || null;
          base.audioSections = (c.audioSections || []).map((s) => ({
            startSec: Number(s.startSec) || 0,
            title: (s.title || '').trim(),
            romanNumeral: (s.romanNumeral || '').trim() || null,
          }));
        }
        return base;
      });
      return apiRequest(`/api/photographer/galleries/${galleryId}/settings`, {
        method: 'PATCH',
        body: JSON.stringify({ chapters: cleaned }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries'] });
      queryClient.invalidateQueries({ queryKey: ['/api/photographer/galleries', galleryId] });
      setDirty(false);
      onClose();
    },
  });

  const stats = useMemo(() => {
    const counts = { images: 0, video: 0, audio: 0 };
    chapters.forEach((c) => {
      counts[chapterKind(c)]++;
    });
    return counts;
  }, [chapters]);

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (dirty && !window.confirm('Du har ulagrede endringer. Lukk uten å lagre?')) return;
        onClose();
      }}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            Kapittel-struktur
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Bygg Pic-Time-flyt med kapitler for bilder, video og lyd.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {stats.images > 0 && <Chip size="small" icon={<ImageIcon sx={{ fontSize: 16 }} />} label={`${stats.images} bilde-kap.`} />}
            {stats.video > 0 && <Chip size="small" icon={<VideoIcon sx={{ fontSize: 16 }} />} label={`${stats.video} video-kap.`} />}
            {stats.audio > 0 && <Chip size="small" icon={<AudioIcon sx={{ fontSize: 16 }} />} label={`${stats.audio} lyd-kap.`} />}
          </Stack>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ minHeight: 360 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : chapters.length === 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Ingen kapitler ennå. Klikk <strong>+ Legg til kapittel</strong> for å starte —
            Pic-Time-flyten bygges fra topp til bunn i den rekkefølgen kapitlene står her.
          </Alert>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {chapters.map((ch, idx) => (
                <SortableChapter
                  key={ch.id}
                  chapter={ch}
                  index={idx}
                  images={images}
                  expanded={expandedId === ch.id}
                  onToggle={() => setExpandedId((prev) => (prev === ch.id ? null : ch.id))}
                  onChange={(next) => updateChapter(ch.id, next)}
                  onDelete={() => {
                    if (!window.confirm(`Slett kapittel "${ch.title || 'uten tittel'}"?`)) return;
                    deleteChapter(ch.id);
                  }}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}

        <Divider sx={{ my: 2 }} />

        <Button
          onClick={(e) => setAddMenuAnchor(e.currentTarget)}
          startIcon={<AddIcon />}
          variant="outlined"
          fullWidth
        >
          Legg til kapittel
        </Button>
        <Menu
          anchorEl={addMenuAnchor}
          open={Boolean(addMenuAnchor)}
          onClose={() => setAddMenuAnchor(null)}
        >
          <MenuItem onClick={() => addChapter('images')}>
            <ListItemIcon><ImageIcon sx={{ color: KIND_META.images.color }} /></ListItemIcon>
            <ListItemText
              primary="Bilder"
              secondary="Velg bilder fra galleriet (Stine)"
            />
          </MenuItem>
          <MenuItem onClick={() => addChapter('video')}>
            <ListItemIcon><VideoIcon sx={{ color: KIND_META.video.color }} /></ListItemIcon>
            <ListItemText
              primary="Video"
              secondary="CinematicVideoPlayer + Frame.io-kommentarer (Bjarne)"
            />
          </MenuItem>
          <MenuItem onClick={() => addChapter('audio')}>
            <ListItemIcon><AudioIcon sx={{ color: KIND_META.audio.color }} /></ListItemIcon>
            <ListItemText
              primary="Lyd"
              secondary="CinematicAudioPlayer med waveform (Michael)"
            />
          </MenuItem>
        </Menu>

        {saveMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {String((saveMutation.error as Error)?.message ?? 'Kunne ikke lagre')}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !dirty}
          variant="contained"
        >
          {saveMutation.isPending ? 'Lagrer…' : dirty ? 'Lagre endringer' : 'Lagret'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ChapterEditor;
