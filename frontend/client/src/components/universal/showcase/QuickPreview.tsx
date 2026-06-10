// @ts-nocheck
/**
 * QuickPreview — Cinematic detail view
 * ────────────────────────────────────────────────────────────────────────
 * Fullscreen, content-first detail experience for the Universal Showcase.
 * The media owns the stage; a collapsible sidebar keeps the comment thread
 * ALWAYS visible (the primary collaborative surface), while purely technical
 * metadata (EXIF, file stats) lives behind an "info" toggle so it never
 * competes with the content.
 *
 * Opened via Space / "," from the grid. Keyboard navigation fully wired
 * (← → navigate, Esc close, C toggle sidebar, I toggle metadata, +/- zoom).
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Chip,
  Stack,
  Tooltip,
  Fade,
  Avatar,
  TextField,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Close,
  ArrowBack,
  ArrowForward,
  Download,
  Favorite,
  FavoriteBorder,
  Edit,
  Info,
  InfoOutlined,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ChevronLeft,
  Comment as CommentIcon,
  Send,
  CheckCircle,
  RadioButtonUnchecked,
  ThumbUpAltOutlined,
  MusicNote as MusicNoteIcon,
  PhotoCamera as PhotoCameraIcon,
  CameraEnhance as LensIcon,
  Straighten as StraightenIcon,
  Timer as TimerIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { CINE, CINE_FONT, CINE_FONT_DISPLAY, withAlpha, metaLabelSx, scrimGradientTop } from '../showcaseCinematic';

interface ShowcaseItem {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  fileUrl?: string;
  fileType: 'video' | 'photo' | 'audio' | 'document' | 'design';
  tags?: string[];
  stats?: { views?: number; likes?: number; downloads?: number; };
  exif?: {
    camera?: string; lens?: string; focalLength?: string;
    aperture?: string; shutterSpeed?: string; iso?: string;
  };
}

interface QuickPreviewProps {
  open: boolean;
  items: ShowcaseItem[];
  currentIndex: number;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  accentColor: string;
  onClose: () => void;
  onNavigate: (direction: 'next' | 'prev') => void;
  onDownload: (item: ShowcaseItem) => void;
  onFavorite: (itemId: string) => void;
  onEdit: (item: ShowcaseItem) => void;
  favorites: Set<string>;
  // Cinematic detail extras (all optional → backward compatible)
  clientMode?: boolean;
  clientSelections?: string[];
  onSelect?: (itemId: string) => void;
  comments?: any[];
  commentsLoading?: boolean;
  onAddComment?: (itemId: string, text: string) => void | Promise<void>;
  onLikeComment?: (commentId: string) => void;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const QuickPreview: React.FC<QuickPreviewProps> = ({
  open,
  items,
  currentIndex,
  profession,
  accentColor,
  onClose,
  onNavigate,
  onDownload,
  onFavorite,
  onEdit,
  favorites,
  clientMode,
  clientSelections = [],
  onSelect,
  comments = [],
  commentsLoading = false,
  onAddComment,
  onLikeComment,
}) => {
  const { professionConfigs, getUserProfessionColor, getProfessionIcon } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const accent = getUserProfessionColor(currentProfession) || accentColor || CINE.accent;

  const [sidebarOpen, setSidebarOpen] = useState(true);   // comments always visible by default
  const [showMetadata, setShowMetadata] = useState(false); // technical metadata hidden by default
  const [imageZoom, setImageZoom] = useState(1);
  const [newComment, setNewComment] = useState('');
  const currentItem = items[currentIndex];
  const imageRef = useRef<HTMLImageElement>(null);
  const reduced = prefersReducedMotion();

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't hijack typing in the comment field
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }
      switch (e.key) {
        case 'Escape':
          e.preventDefault(); onClose(); break;
        case 'ArrowRight':
          e.preventDefault(); onNavigate('next'); break;
        case 'ArrowLeft':
          e.preventDefault(); onNavigate('prev'); break;
        case 'c': case 'C':
          e.preventDefault(); setSidebarOpen((s) => !s); break;
        case 'i': case 'I':
          e.preventDefault(); setShowMetadata((s) => !s); break;
        case 'd': case 'D':
          e.preventDefault(); if (currentItem) onDownload(currentItem); break;
        case 'e': case 'E':
          e.preventDefault(); if (currentItem) onEdit(currentItem); break;
        case 'f': case 'F':
          e.preventDefault(); if (currentItem) onFavorite(currentItem.id); break;
        case '+': case '=':
          e.preventDefault(); setImageZoom((z) => Math.min(z + 0.5, 5)); break;
        case '-': case '_':
          e.preventDefault(); setImageZoom((z) => Math.max(z - 0.5, 0.5)); break;
        case '0':
          e.preventDefault(); setImageZoom(1); break;
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [open, currentItem, onClose, onNavigate, onDownload, onEdit, onFavorite]);

  // Preload adjacent images
  useEffect(() => {
    if (!open || !items.length) return;
    if (currentIndex < items.length - 1) {
      const nextImg = new Image();
      nextImg.src = items[currentIndex + 1].fileUrl || items[currentIndex + 1].thumbnailUrl || '';
    }
    if (currentIndex > 0) {
      const prevImg = new Image();
      prevImg.src = items[currentIndex - 1].fileUrl || items[currentIndex - 1].thumbnailUrl || '';
    }
  }, [open, currentIndex, items]);

  useEffect(() => { setImageZoom(1); }, [currentIndex]);

  if (!open || !currentItem) return null;

  const isFavorite = favorites.has(currentItem.id);
  const isSelected = clientSelections.includes(currentItem.id);
  const SIDEBAR_W = 372;

  const submitComment = async () => {
    const text = newComment.trim();
    if (!text || !onAddComment) return;
    await onAddComment(currentItem.id, text);
    setNewComment('');
  };

  // Defensive comment field accessors (API shape varies)
  const commentAuthor = (c: any) => c.userName || c.authorName || c.author || c.name || 'Gjest';
  const commentText = (c: any) => c.comment || c.text || c.message || '';
  const commentDate = (c: any) => c.createdAt || c.timestamp || c.created_at;
  const commentLikes = (c: any) => c.likes ?? c.likeCount ?? c.likesCount ?? 0;
  const commentId = (c: any) => c.id || c.commentId || c._id;

  return (
    <Fade in={open} timeout={reduced ? 0 : 240}>
      <Box
        sx={{
          position: 'fixed', inset: 0, zIndex: 1300,
          bgcolor: CINE.bgDeep,
          background: `radial-gradient(circle at 30% 20%, ${withAlpha(accent, 0.12)}, rgba(5,7,11,0) 55%), ${CINE.bgDeep}`,
          display: 'flex', flexDirection: 'column',
          fontFamily: CINE_FONT,
        }}
      >
        {/* Top Bar */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          px: 3, py: 2, zIndex: 3,
          background: scrimGradientTop,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {professionIcon && (
              <Box sx={{ color: accent, display: 'flex', alignItems: 'center' }}>{professionIcon}</Box>
            )}
            <Typography sx={{
              fontFamily: CINE_FONT_DISPLAY, color: CINE.textPrimary, fontWeight: 700,
              fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentItem.title}
            </Typography>
            <Chip
              label={`${currentIndex + 1} / ${items.length}`}
              size="small"
              sx={{
                bgcolor: withAlpha(accent, 0.16), color: CINE.textPrimary,
                border: `1px solid ${withAlpha(accent, 0.4)}`, fontWeight: 600, fontSize: '0.7rem',
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={`${sidebarOpen ? 'Skjul' : 'Vis'} detaljer & kommentarer (C)`}>
              <IconButton onClick={() => setSidebarOpen((s) => !s)} sx={{ color: sidebarOpen ? accent : CINE.textSecondary }}>
                {sidebarOpen ? <ChevronRight /> : <CommentIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Lukk (Esc)">
              <IconButton onClick={onClose} sx={{ color: CINE.textSecondary, '&:hover': { color: CINE.textPrimary } }}>
                <Close />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Stage + Sidebar */}
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Content stage */}
          <Box sx={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minWidth: 0 }}>
            {/* Nav arrows */}
            <IconButton
              onClick={() => onNavigate('prev')}
              disabled={currentIndex === 0}
              sx={{
                position: 'absolute', left: 20, zIndex: 2,
                bgcolor: 'rgba(7,7,7,0.55)', color: '#fff', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.12)',
                '&:hover': { bgcolor: withAlpha(accent, 0.85), transform: reduced ? 'none' : 'scale(1.08)' },
                '&:disabled': { opacity: 0.25 },
              }}
            >
              <ArrowBack />
            </IconButton>

            <Box sx={{ maxWidth: '92%', maxHeight: '92%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {currentItem.fileType === 'video' ? (
                <video src={currentItem.fileUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: 8 }} />
              ) : currentItem.fileType === 'audio' ? (
                <Box sx={{ width: 'min(680px, 80vw)', p: 4, ...{
                  bgcolor: CINE.surfaceElevated, borderRadius: '18px',
                  border: `1px solid ${withAlpha(accent, 0.4)}`,
                  boxShadow: `0 30px 80px rgba(0,0,0,0.6)`,
                } }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'center', mb: 3 }}>
                    <MusicNoteIcon sx={{ color: accent }} />
                    <Typography sx={{ fontFamily: CINE_FONT_DISPLAY, color: CINE.textPrimary, fontWeight: 700, textAlign: 'center' }} variant="h5">
                      {currentItem.title}
                    </Typography>
                  </Stack>
                  <audio src={currentItem.fileUrl} controls autoPlay style={{ width: '100%' }} />
                </Box>
              ) : (currentItem.fileType === 'photo' || currentItem.fileType === 'design') ? (
                <img
                  ref={imageRef}
                  src={currentItem.fileUrl || currentItem.thumbnailUrl}
                  alt={currentItem.title}
                  style={{
                    maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain',
                    transform: `scale(${imageZoom})`,
                    transition: reduced ? 'none' : 'transform 0.2s ease',
                    cursor: imageZoom > 1 ? 'grab' : 'default',
                    borderRadius: 8,
                  }}
                />
              ) : (
                <img
                  src={currentItem.fileUrl || currentItem.thumbnailUrl}
                  alt={currentItem.title}
                  style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 8 }}
                />
              )}
            </Box>

            <IconButton
              onClick={() => onNavigate('next')}
              disabled={currentIndex === items.length - 1}
              sx={{
                position: 'absolute', right: 20, zIndex: 2,
                bgcolor: 'rgba(7,7,7,0.55)', color: '#fff', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.12)',
                '&:hover': { bgcolor: withAlpha(accent, 0.85), transform: reduced ? 'none' : 'scale(1.08)' },
                '&:disabled': { opacity: 0.25 },
              }}
            >
              <ArrowForward />
            </IconButton>

            {/* Zoom controls (photos) */}
            {(currentItem.fileType === 'photo' || currentItem.fileType === 'design') && (
              <Stack direction="row" spacing={0.5} sx={{
                position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                bgcolor: 'rgba(7,7,7,0.6)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '999px', px: 1, py: 0.5,
                alignItems: 'center',
              }}>
                <IconButton size="small" onClick={() => setImageZoom((z) => Math.max(z - 0.5, 0.5))} sx={{ color: CINE.textSecondary, '&:hover': { color: accent } }}><ZoomOut fontSize="small" /></IconButton>
                <Typography
                  onClick={() => setImageZoom(1)}
                  sx={{ color: CINE.textPrimary, fontSize: '0.75rem', fontWeight: 600, minWidth: 42, textAlign: 'center', cursor: 'pointer' }}
                >
                  {Math.round(imageZoom * 100)}%
                </Typography>
                <IconButton size="small" onClick={() => setImageZoom((z) => Math.min(z + 0.5, 5))} sx={{ color: CINE.textSecondary, '&:hover': { color: accent } }}><ZoomIn fontSize="small" /></IconButton>
              </Stack>
            )}
          </Box>

          {/* Sidebar — comments always visible, metadata behind toggle */}
          <Box sx={{
            width: sidebarOpen ? SIDEBAR_W : 0,
            flexShrink: 0,
            overflow: 'hidden',
            transition: reduced ? 'none' : 'width 0.32s cubic-bezier(0.22,0.61,0.36,1)',
            borderLeft: sidebarOpen ? `1px solid ${CINE.border}` : 'none',
            bgcolor: CINE.surfaceElevated,
            backdropFilter: 'blur(22px)',
            display: 'flex', flexDirection: 'column',
          }}>
            <Box sx={{ width: SIDEBAR_W, display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Item header + primary actions */}
              <Box sx={{ p: 2.5, borderBottom: `1px solid ${CINE.border}` }}>
                <Typography sx={{ ...metaLabelSx, color: withAlpha(accent, 0.9) }}>
                  {enhancedProfessionConfig?.displayName || professionConfig?.displayName || 'Showcase'}
                </Typography>
                <Typography sx={{ fontFamily: CINE_FONT_DISPLAY, color: CINE.textPrimary, fontWeight: 700, fontSize: '1.25rem', mt: 0.5, lineHeight: 1.2 }}>
                  {currentItem.title}
                </Typography>
                {currentItem.description && (
                  <Typography sx={{ color: CINE.textSecondary, fontSize: '0.85rem', mt: 1, lineHeight: 1.5 }}>
                    {currentItem.description}
                  </Typography>
                )}

                {/* Functionality, surfaced elegantly */}
                <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                  {/* Velg/pick is a client-session feature (writes to client-selections
                      with sessionId+email). Only show it in client view so the owner
                      doesn't get a dead button. */}
                  {clientMode && onSelect && (
                    <Tooltip title={isSelected ? 'Fjern fra valg (S)' : 'Velg (S)'}>
                      <IconButton onClick={() => onSelect(currentItem.id)} sx={{
                        color: isSelected ? '#fff' : CINE.textSecondary,
                        bgcolor: isSelected ? accent : 'transparent',
                        border: `1px solid ${isSelected ? accent : CINE.border}`,
                        borderRadius: '10px',
                        '&:hover': { bgcolor: isSelected ? accent : withAlpha(accent, 0.14), color: isSelected ? '#fff' : accent },
                      }}>
                        {isSelected ? <CheckCircle /> : <RadioButtonUnchecked />}
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Favoritt (F)">
                    <IconButton onClick={() => onFavorite(currentItem.id)} sx={{
                      color: isFavorite ? CINE.danger : CINE.textSecondary,
                      border: `1px solid ${CINE.border}`, borderRadius: '10px',
                      '&:hover': { color: CINE.danger, bgcolor: withAlpha(CINE.danger, 0.12) },
                    }}>
                      {isFavorite ? <Favorite /> : <FavoriteBorder />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Last ned (D)">
                    <IconButton onClick={() => onDownload(currentItem)} sx={{
                      color: CINE.textSecondary, border: `1px solid ${CINE.border}`, borderRadius: '10px',
                      '&:hover': { color: accent, bgcolor: withAlpha(accent, 0.12) },
                    }}>
                      <Download />
                    </IconButton>
                  </Tooltip>
                  {!clientMode && (
                    <Tooltip title="Rediger (E)">
                      <IconButton onClick={() => onEdit(currentItem)} sx={{
                        color: CINE.textSecondary, border: `1px solid ${CINE.border}`, borderRadius: '10px',
                        '&:hover': { color: accent, bgcolor: withAlpha(accent, 0.12) },
                      }}>
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title={`${showMetadata ? 'Skjul' : 'Vis'} teknisk info (I)`}>
                    <IconButton onClick={() => setShowMetadata((s) => !s)} sx={{
                      color: showMetadata ? accent : CINE.textSecondary,
                      border: `1px solid ${showMetadata ? withAlpha(accent, 0.5) : CINE.border}`, borderRadius: '10px',
                    }}>
                      {showMetadata ? <Info /> : <InfoOutlined />}
                    </IconButton>
                  </Tooltip>
                </Stack>

                {/* Technical metadata (hidden by default) */}
                {showMetadata && (
                  <Fade in={showMetadata} timeout={reduced ? 0 : 200}>
                    <Box sx={{ mt: 2, p: 1.75, bgcolor: CINE.surface, borderRadius: '12px', border: `1px solid ${CINE.border}` }}>
                      {profession === 'photographer' && currentItem.exif && (
                        <>
                          <Typography sx={{ ...metaLabelSx, mb: 1 }}>EXIF</Typography>
                          <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                            {currentItem.exif.camera && <MetaRow icon={<PhotoCameraIcon sx={{ fontSize: 14 }} />} value={currentItem.exif.camera} />}
                            {currentItem.exif.lens && <MetaRow icon={<LensIcon sx={{ fontSize: 14 }} />} value={currentItem.exif.lens} />}
                            {currentItem.exif.focalLength && <MetaRow icon={<StraightenIcon sx={{ fontSize: 14 }} />} value={currentItem.exif.focalLength} />}
                            {currentItem.exif.shutterSpeed && <MetaRow icon={<TimerIcon sx={{ fontSize: 14 }} />} value={currentItem.exif.shutterSpeed} />}
                            {currentItem.exif.aperture && <MetaRow value={`ƒ/${currentItem.exif.aperture}`} />}
                            {currentItem.exif.iso && <MetaRow value={`ISO ${currentItem.exif.iso}`} />}
                          </Stack>
                        </>
                      )}
                      {currentItem.stats && (
                        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                          {currentItem.stats.views !== undefined && <MetaRow icon={<VisibilityIcon sx={{ fontSize: 14 }} />} value={`${currentItem.stats.views}`} />}
                          {currentItem.stats.likes !== undefined && <MetaRow icon={<Favorite sx={{ fontSize: 14 }} />} value={`${currentItem.stats.likes}`} />}
                          {currentItem.stats.downloads !== undefined && <MetaRow icon={<Download sx={{ fontSize: 14 }} />} value={`${currentItem.stats.downloads}`} />}
                        </Stack>
                      )}
                      {currentItem.tags && currentItem.tags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
                          {currentItem.tags.map((tag) => (
                            <Chip key={tag} label={tag} size="small" sx={{ bgcolor: withAlpha(accent, 0.14), color: accent, fontSize: '0.66rem', height: 22 }} />
                          ))}
                        </Box>
                      )}
                      {!currentItem.exif && !currentItem.stats && !(currentItem.tags?.length) && (
                        <Typography sx={{ color: CINE.textMuted, fontSize: '0.8rem' }}>Ingen teknisk metadata.</Typography>
                      )}
                    </Box>
                  </Fade>
                )}
              </Box>

              {/* Comments — ALWAYS visible */}
              <Box sx={{ px: 2.5, pt: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CommentIcon sx={{ fontSize: 18, color: accent }} />
                <Typography sx={{ fontFamily: CINE_FONT, fontWeight: 700, color: CINE.textPrimary, fontSize: '0.92rem' }}>
                  Kommentarer
                </Typography>
                {comments.length > 0 && (
                  <Chip label={comments.length} size="small" sx={{ height: 20, fontSize: '0.66rem', bgcolor: withAlpha(accent, 0.16), color: accent }} />
                )}
              </Box>

              <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1, minHeight: 0 }}>
                {commentsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={22} sx={{ color: accent }} />
                  </Box>
                ) : comments.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
                    <CommentIcon sx={{ fontSize: 30, color: CINE.textMuted, mb: 1 }} />
                    <Typography sx={{ color: CINE.textSecondary, fontSize: '0.85rem' }}>
                      Ingen kommentarer enda.
                    </Typography>
                    <Typography sx={{ color: CINE.textMuted, fontSize: '0.78rem', mt: 0.5 }}>
                      {clientMode ? 'Legg igjen tilbakemelding nedenfor.' : 'Start samtalen om dette innholdet.'}
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {comments.map((c: any, idx: number) => (
                      <Box key={commentId(c) || idx} sx={{ display: 'flex', gap: 1.25 }}>
                        <Avatar sx={{ width: 30, height: 30, bgcolor: withAlpha(accent, 0.22), color: accent, fontSize: '0.8rem', fontWeight: 700 }}>
                          {String(commentAuthor(c)).charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="baseline">
                            <Typography sx={{ color: CINE.textPrimary, fontWeight: 600, fontSize: '0.82rem' }}>
                              {commentAuthor(c)}
                            </Typography>
                            {commentDate(c) && (
                              <Typography sx={{ color: CINE.textMuted, fontSize: '0.68rem' }}>
                                {new Date(commentDate(c)).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })}
                              </Typography>
                            )}
                          </Stack>
                          <Typography sx={{ color: CINE.textSecondary, fontSize: '0.84rem', mt: 0.25, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {commentText(c)}
                          </Typography>
                          {onLikeComment && (
                            <Box
                              onClick={() => onLikeComment(commentId(c))}
                              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, cursor: 'pointer', color: CINE.textMuted, '&:hover': { color: accent } }}
                            >
                              <ThumbUpAltOutlined sx={{ fontSize: 14 }} />
                              <Typography sx={{ fontSize: '0.7rem' }}>{commentLikes(c) || ''}</Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Add comment */}
              {onAddComment && (
                <Box sx={{ p: 2, borderTop: `1px solid ${CINE.border}` }}>
                  <Stack direction="row" spacing={1} alignItems="flex-end">
                    <TextField
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); }
                      }}
                      placeholder={clientMode ? 'Skriv en tilbakemelding…' : 'Skriv en kommentar…'}
                      multiline
                      maxRows={4}
                      size="small"
                      fullWidth
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          color: CINE.textPrimary, bgcolor: CINE.surface, borderRadius: '12px', fontSize: '0.85rem',
                          '& fieldset': { borderColor: CINE.border },
                          '&:hover fieldset': { borderColor: CINE.borderStrong },
                          '&.Mui-focused fieldset': { borderColor: accent },
                        },
                        '& .MuiInputBase-input::placeholder': { color: CINE.textMuted, opacity: 1 },
                      }}
                    />
                    <IconButton
                      onClick={submitComment}
                      disabled={!newComment.trim()}
                      sx={{
                        bgcolor: newComment.trim() ? accent : CINE.surface,
                        color: newComment.trim() ? '#fff' : CINE.textMuted,
                        borderRadius: '12px', width: 40, height: 40,
                        '&:hover': { bgcolor: newComment.trim() ? withAlpha(accent, 0.85) : CINE.surface },
                        '&.Mui-disabled': { color: CINE.textMuted },
                      }}
                    >
                      <Send sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Stack>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

// Small metadata row used in the info panel
const MetaRow: React.FC<{ icon?: React.ReactNode; value: string }> = ({ icon, value }) => (
  <Stack direction="row" spacing={0.75} alignItems="center">
    {icon && <Box sx={{ color: CINE.textMuted, display: 'flex' }}>{icon}</Box>}
    <Typography sx={{ color: CINE.textSecondary, fontSize: '0.8rem' }}>{value}</Typography>
  </Stack>
);

export default QuickPreview;
