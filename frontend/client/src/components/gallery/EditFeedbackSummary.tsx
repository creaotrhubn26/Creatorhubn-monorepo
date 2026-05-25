// @ts-nocheck
/**
 * EditFeedbackSummary — Slice 9X.82 (produsent-side oversiktsvisning)
 *
 * Brukes i fotograf/videograf/musikkprodusent-admin: aggregert
 * tilbakemeldings-oversikt slik at de IKKE må lese gjennom hver enkelt
 * kommentar, men ser strukturert hva som må gjøres.
 *
 * Layout (Pic-Time editorial):
 *   - Header: total + brutt ned per priority (Må fikses · N, Ønske · N)
 *   - Per-kategori-seksjoner (Farge, Lyd, Klipping, ...) med count-badge
 *   - Innen hver: sortert etter prioritet, deretter timecode
 *   - Klikkbar timecode for å scrolle/seeke (callback)
 *   - Musikk-forslag rendres med ekstern-lenke-knapp + tidskode
 *   - "Eksporter som tekst"-knapp som kopierer formattert summary til
 *     utklippstavle (Bjarne kan ta den til Davinci/Premiere/FCP)
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Snackbar,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  OpenInNew as OpenIcon,
  CheckCircle as ResolvedIcon,
  MusicNote as MusicIcon,
  ColorLens as ColorIcon,
  VolumeUp as AudioIcon,
  ContentCut as EditIcon,
  AutoFixHigh as VfxIcon,
  ViewModule as StructureIcon,
  TextFields as TextIcon,
  MoreHoriz as OtherIcon,
  FileDownload as DownloadIcon,
  Movie as ResolveIcon,
  VideoSettings as PremiereIcon,
  Description as TextFileIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';

import {
  generateEDL,
  generateFCPXML,
  generateMarkersCSV,
  safeFilenameBase,
  downloadAsFile,
} from './nleExporters';
import NLEImportGuide from './NLEImportGuide';

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

export interface FeedbackEntry {
  id: string;
  timecodeSec: number;
  endTimecodeSec?: number | null;
  comment: string;
  category?: 'color' | 'audio' | 'edit' | 'vfx' | 'structure' | 'text' | 'other';
  priority?: 'must-fix' | 'nice-to-have' | 'suggestion';
  clientName?: string | null;
  clientEmail?: string | null;
  status?: 'open' | 'resolved' | 'archived';
  createdAt?: string | null;
  suggestedMediaUrl?: string | null;
  suggestedMediaLabel?: string | null;
  suggestedMediaFromSec?: number | null;
  suggestedMediaToSec?: number | null;
}

interface Props {
  entries: FeedbackEntry[];
  /** Hopp til tidskode i parent-player */
  onSeek?: (sec: number) => void;
  /** Tittel på oversikten (defaultes til "Edit-tilbakemelding") */
  title?: string;
  /** Klient-navn (vises i header) */
  clientName?: string | null;
  /** Galleri/prosjekt-tittel (for eksport-header) */
  projectTitle?: string | null;
  /** Admin-side: callback når Bjarne markerer kommentar som løst/åpen */
  onToggleResolved?: (commentId: string, nextStatus: 'open' | 'resolved') => void;
}

const CATEGORY_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  color: { label: 'Farge & grading', color: '#a855f7', icon: <ColorIcon sx={{ fontSize: 18 }} /> },
  audio: { label: 'Lyd & musikk', color: '#06b6d4', icon: <AudioIcon sx={{ fontSize: 18 }} /> },
  edit: { label: 'Klipping & timing', color: '#d97706', icon: <EditIcon sx={{ fontSize: 18 }} /> },
  vfx: { label: 'VFX & effekter', color: '#ec4899', icon: <VfxIcon sx={{ fontSize: 18 }} /> },
  structure: { label: 'Struktur & rekkefølge', color: '#10b981', icon: <StructureIcon sx={{ fontSize: 18 }} /> },
  text: { label: 'Tekst & undertekst', color: '#3b82f6', icon: <TextIcon sx={{ fontSize: 18 }} /> },
  other: { label: 'Annet', color: '#6b7280', icon: <OtherIcon sx={{ fontSize: 18 }} /> },
};

const PRIORITY_ORDER = { 'must-fix': 0, 'nice-to-have': 1, 'suggestion': 2 } as const;
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  'must-fix': { label: 'Må fikses', color: '#dc2626' },
  'nice-to-have': { label: 'Ønske', color: '#d97706' },
  'suggestion': { label: 'Forslag', color: '#5a4f42' },
};

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Bygg en YouTube-URL med t-parameter (start-sekund) hvis URL er youtube */
function buildMediaJumpUrl(url: string, startSec: number | null | undefined): string {
  if (!startSec || startSec <= 0) return url;
  if (/youtube\.com|youtu\.be/.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}t=${Math.floor(startSec)}s`;
  }
  if (/spotify\.com/.test(url)) {
    // Spotify har ikke offentlig timestamp-jump i URL; vi viser bare URL.
    return url;
  }
  return url;
}

function exportAsText(entries: FeedbackEntry[], projectTitle?: string | null, clientName?: string | null): string {
  const lines: string[] = [];
  lines.push(`EDIT-TILBAKEMELDING`);
  if (projectTitle) lines.push(`Prosjekt: ${projectTitle}`);
  if (clientName) lines.push(`Klient: ${clientName}`);
  lines.push(`Generert: ${new Date().toLocaleDateString('nb-NO', { day: '2-digit', month: 'long', year: 'numeric' })}`);
  lines.push('');

  // Grupper per kategori
  const grouped: Record<string, FeedbackEntry[]> = {};
  entries.forEach((e) => {
    const cat = e.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(e);
  });

  const orderedCats = Object.keys(grouped).sort((a, b) => {
    const aN = Object.keys(CATEGORY_META).indexOf(a);
    const bN = Object.keys(CATEGORY_META).indexOf(b);
    return aN - bN;
  });

  orderedCats.forEach((cat) => {
    const items = grouped[cat].sort((a, b) => {
      const pA = PRIORITY_ORDER[a.priority || 'suggestion'] ?? 2;
      const pB = PRIORITY_ORDER[b.priority || 'suggestion'] ?? 2;
      if (pA !== pB) return pA - pB;
      return a.timecodeSec - b.timecodeSec;
    });
    lines.push(`═══ ${(CATEGORY_META[cat]?.label || cat).toUpperCase()} (${items.length}) ═══`);
    lines.push('');
    items.forEach((e) => {
      const tc = e.endTimecodeSec ? `${fmtTime(e.timecodeSec)} → ${fmtTime(e.endTimecodeSec)}` : fmtTime(e.timecodeSec);
      const prio = PRIORITY_META[e.priority || 'suggestion']?.label || e.priority || '';
      const status = e.status === 'resolved' ? ' [LØST]' : '';
      lines.push(`[${tc}] ${prio.toUpperCase()}${status}`);
      lines.push(e.comment);
      if (e.suggestedMediaUrl) {
        const label = e.suggestedMediaLabel || 'Foreslått sang';
        const fromTo = e.suggestedMediaFromSec != null
          ? ` (${fmtTime(e.suggestedMediaFromSec)}${e.suggestedMediaToSec != null ? ' → ' + fmtTime(e.suggestedMediaToSec) : ''} inn i sangen)`
          : '';
        lines.push(`  🎵 ${label}${fromTo}`);
        lines.push(`  ${e.suggestedMediaUrl}`);
      }
      if (e.clientName) lines.push(`  — ${e.clientName}`);
      lines.push('');
    });
  });

  return lines.join('\n').trim();
}

const EditFeedbackSummary: React.FC<Props> = ({
  entries,
  onSeek,
  title = 'Edit-tilbakemelding',
  clientName,
  projectTitle,
  onToggleResolved,
}) => {
  const [copySnack, setCopySnack] = useState(false);
  const [downloadSnack, setDownloadSnack] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const stats = useMemo(() => {
    const mustFix = entries.filter((e) => e.priority === 'must-fix').length;
    const niceToHave = entries.filter((e) => e.priority === 'nice-to-have').length;
    const suggestion = entries.filter((e) => e.priority === 'suggestion' || !e.priority).length;
    const resolved = entries.filter((e) => e.status === 'resolved').length;
    return { total: entries.length, mustFix, niceToHave, suggestion, resolved };
  }, [entries]);

  const grouped = useMemo(() => {
    const map: Record<string, FeedbackEntry[]> = {};
    entries.forEach((e) => {
      const cat = e.category || 'other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(e);
    });
    // Sortér innenfor hver kategori
    Object.keys(map).forEach((cat) => {
      map[cat].sort((a, b) => {
        const pA = PRIORITY_ORDER[a.priority || 'suggestion'] ?? 2;
        const pB = PRIORITY_ORDER[b.priority || 'suggestion'] ?? 2;
        if (pA !== pB) return pA - pB;
        return a.timecodeSec - b.timecodeSec;
      });
    });
    return map;
  }, [entries]);

  const orderedCats = useMemo(
    () => Object.keys(grouped).sort((a, b) => {
      const aN = Object.keys(CATEGORY_META).indexOf(a);
      const bN = Object.keys(CATEGORY_META).indexOf(b);
      return (aN === -1 ? 999 : aN) - (bN === -1 ? 999 : bN);
    }),
    [grouped],
  );

  const handleCopy = async () => {
    setMenuAnchor(null);
    const text = exportAsText(entries, projectTitle, clientName);
    try {
      await navigator.clipboard.writeText(text);
      setCopySnack(true);
    } catch {
      // Fallback: åpne i en alert / window
      window.prompt('Kopier teksten manuelt:', text);
    }
  };

  const handleDownloadCSV = () => {
    setMenuAnchor(null);
    const csv = generateMarkersCSV(entries, { projectTitle, clientName });
    const base = safeFilenameBase(projectTitle, clientName);
    downloadAsFile(csv, `${base}-markers.csv`, 'text/csv');
    setDownloadSnack('CSV lastet ned — neste: åpne import-guiden');
  };

  const handleDownloadEDL = () => {
    setMenuAnchor(null);
    const edl = generateEDL(entries, { projectTitle, clientName });
    const base = safeFilenameBase(projectTitle, clientName);
    downloadAsFile(edl, `${base}.edl`, 'text/plain');
    setDownloadSnack('EDL lastet ned — neste: åpne import-guiden');
  };

  const handleDownloadFCPXML = () => {
    setMenuAnchor(null);
    const xml = generateFCPXML(entries, { projectTitle, clientName });
    const base = safeFilenameBase(projectTitle, clientName);
    downloadAsFile(xml, `${base}.fcpxml`, 'application/xml');
    setDownloadSnack('FCPXML lastet ned — neste: åpne import-guiden');
  };

  if (entries.length === 0) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          border: '1px dashed rgba(168, 149, 126, 0.42)',
          borderRadius: 1,
          bgcolor: '#fdfaf5',
          color: '#5a4f42',
        }}
      >
        <Typography sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '1.1rem' }}>
          Ingen tilbakemelding ennå
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          Klienten har ikke kommentert på denne leveransen ennå.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: '#fdfaf5',
        color: '#1a1612',
        borderRadius: 1,
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(26, 22, 18, 0.08)',
      }}
    >
      {/* ── Editorial header med stats ──────────────────────────────── */}
      <Box sx={{ p: { xs: 3, sm: 4 }, borderBottom: '1px solid rgba(168, 149, 126, 0.32)' }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.32em',
                color: '#a8957e',
                textTransform: 'uppercase',
                mb: 0.5,
              }}
            >
              · {clientName ? `Fra ${clientName}` : 'Tilbakemelding'} ·
            </Typography>
            <Typography
              component="h2"
              sx={{
                fontFamily: SERIF_STACK,
                fontWeight: 400,
                fontSize: { xs: '1.8rem', sm: '2.4rem' },
                lineHeight: 1.0,
                letterSpacing: '-0.025em',
                mb: 1.5,
              }}
            >
              {title}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label={`${stats.total} totalt`}
                size="small"
                sx={{ height: 24, bgcolor: '#1a1612', color: '#fdfaf5', fontWeight: 700, fontSize: '0.72rem' }}
              />
              {stats.mustFix > 0 && (
                <Chip
                  label={`Må fikses · ${stats.mustFix}`}
                  size="small"
                  sx={{ height: 24, bgcolor: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '0.72rem' }}
                />
              )}
              {stats.niceToHave > 0 && (
                <Chip
                  label={`Ønske · ${stats.niceToHave}`}
                  size="small"
                  sx={{ height: 24, bgcolor: '#d97706', color: '#fff', fontWeight: 700, fontSize: '0.72rem' }}
                />
              )}
              {stats.suggestion > 0 && (
                <Chip
                  label={`Forslag · ${stats.suggestion}`}
                  size="small"
                  sx={{ height: 24, color: '#5a4f42', border: '1px solid #5a4f42', fontWeight: 700, fontSize: '0.72rem' }}
                />
              )}
              {stats.resolved > 0 && (
                <Chip
                  label={`Løst · ${stats.resolved}`}
                  size="small"
                  icon={<ResolvedIcon sx={{ fontSize: '0.85rem !important' }} />}
                  sx={{ height: 24, bgcolor: 'rgba(16, 185, 129, 0.18)', color: '#10b981', fontWeight: 700, fontSize: '0.72rem' }}
                />
              )}
            </Stack>
          </Box>
          <Button
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            startIcon={<DownloadIcon />}
            variant="outlined"
            aria-label="Eksporter til NLE"
            sx={{
              borderColor: '#1a1612',
              color: '#1a1612',
              fontFamily: '"Inter", "Segoe UI", sans-serif',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: '0.7rem',
              px: 2,
              py: 1,
              borderRadius: 0,
              whiteSpace: 'nowrap',
              '&:hover': { borderColor: '#1a1612', bgcolor: 'rgba(26, 22, 18, 0.06)' },
            }}
          >
            Eksporter
          </Button>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            PaperProps={{
              sx: {
                bgcolor: '#fdfaf5',
                border: '1px solid rgba(168, 149, 126, 0.42)',
                borderRadius: 0,
                minWidth: 280,
                boxShadow: '0 6px 24px rgba(26, 22, 18, 0.18)',
              },
            }}
          >
            <Typography
              sx={{
                px: 2,
                pt: 1.5,
                pb: 0.5,
                fontSize: '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: '#a8957e',
              }}
            >
              Kopi / NLE-markører
            </Typography>
            <MenuItem onClick={handleCopy} sx={{ py: 1.2 }}>
              <ListItemIcon><CopyIcon sx={{ color: '#5a4f42' }} /></ListItemIcon>
              <ListItemText
                primary="Kopier som tekst"
                secondary="Inn i e-post, Slack, Notion"
                primaryTypographyProps={{ sx: { fontWeight: 600, fontSize: '0.9rem' } }}
                secondaryTypographyProps={{ sx: { fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.75rem' } }}
              />
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(168, 149, 126, 0.32)' }} />
            <MenuItem onClick={handleDownloadCSV} sx={{ py: 1.2 }}>
              <ListItemIcon><CsvIcon sx={{ color: '#10b981' }} /></ListItemIcon>
              <ListItemText
                primary="DaVinci Resolve — Markører (CSV)"
                secondary="Workflow Integration import"
                primaryTypographyProps={{ sx: { fontWeight: 600, fontSize: '0.9rem' } }}
                secondaryTypographyProps={{ sx: { fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.75rem' } }}
              />
            </MenuItem>
            <MenuItem onClick={handleDownloadEDL} sx={{ py: 1.2 }}>
              <ListItemIcon><ResolveIcon sx={{ color: '#d97706' }} /></ListItemIcon>
              <ListItemText
                primary="EDL (CMX 3600)"
                secondary="Resolve, Premiere, Avid, FCP 7"
                primaryTypographyProps={{ sx: { fontWeight: 600, fontSize: '0.9rem' } }}
                secondaryTypographyProps={{ sx: { fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.75rem' } }}
              />
            </MenuItem>
            <MenuItem onClick={handleDownloadFCPXML} sx={{ py: 1.2 }}>
              <ListItemIcon><PremiereIcon sx={{ color: '#a855f7' }} /></ListItemIcon>
              <ListItemText
                primary="FCPXML 1.9"
                secondary="Resolve 16+, Premiere CC, FCP X"
                primaryTypographyProps={{ sx: { fontWeight: 600, fontSize: '0.9rem' } }}
                secondaryTypographyProps={{ sx: { fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.75rem' } }}
              />
            </MenuItem>
            <Divider sx={{ borderColor: 'rgba(168, 149, 126, 0.32)' }} />
            <MenuItem onClick={() => { setMenuAnchor(null); setGuideOpen(true); }} sx={{ py: 1.2 }}>
              <ListItemIcon><TextFileIcon sx={{ color: '#1a1612' }} /></ListItemIcon>
              <ListItemText
                primary="Hvordan importere?"
                secondary="Steg-for-steg per NLE"
                primaryTypographyProps={{ sx: { fontWeight: 600, fontSize: '0.9rem' } }}
                secondaryTypographyProps={{ sx: { fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.75rem' } }}
              />
            </MenuItem>
          </Menu>
        </Stack>
      </Box>

      {/* ── Kategori-seksjoner ──────────────────────────────────────── */}
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {orderedCats.map((cat) => {
          const meta = CATEGORY_META[cat] || CATEGORY_META.other;
          const items = grouped[cat];
          const isCollapsed = collapsedCats.has(cat);
          return (
            <Box key={cat} sx={{ mb: 2 }}>
              <Box
                onClick={() =>
                  setCollapsedCats((prev) => {
                    const next = new Set(prev);
                    if (next.has(cat)) next.delete(cat);
                    else next.add(cat);
                    return next;
                  })
                }
                role="button"
                tabIndex={0}
                sx={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 1,
                  px: 1.5,
                  bgcolor: `${meta.color}10`,
                  borderLeft: `3px solid ${meta.color}`,
                  borderRadius: '2px',
                  '&:hover': { bgcolor: `${meta.color}1a` },
                }}
              >
                <Box sx={{ color: meta.color }}>{meta.icon}</Box>
                <Typography
                  sx={{
                    fontFamily: SERIF_STACK,
                    fontSize: '1.2rem',
                    fontWeight: 500,
                    color: '#1a1612',
                    flex: 1,
                  }}
                >
                  {meta.label}
                </Typography>
                <Chip
                  label={items.length}
                  size="small"
                  sx={{
                    height: 20,
                    minWidth: 28,
                    bgcolor: meta.color,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                  }}
                />
              </Box>
              {!isCollapsed && (
                <Stack spacing={1} sx={{ mt: 1, pl: { xs: 0, sm: 2 } }}>
                  {items.map((e) => {
                    const prio = PRIORITY_META[e.priority || 'suggestion'];
                    const isResolved = e.status === 'resolved';
                    const tcLabel = e.endTimecodeSec
                      ? `${fmtTime(e.timecodeSec)} → ${fmtTime(e.endTimecodeSec)}`
                      : fmtTime(e.timecodeSec);
                    return (
                      <Box
                        key={e.id}
                        sx={{
                          p: 1.8,
                          border: `1px solid ${isResolved ? 'rgba(16, 185, 129, 0.32)' : 'rgba(168, 149, 126, 0.32)'}`,
                          borderRadius: 0.5,
                          bgcolor: isResolved ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                          opacity: isResolved ? 0.7 : 1,
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          {/* Timecode-pill */}
                          <Box
                            onClick={() => onSeek?.(e.timecodeSec)}
                            role={onSeek ? 'button' : undefined}
                            tabIndex={onSeek ? 0 : undefined}
                            sx={{
                              flexShrink: 0,
                              px: 1.2,
                              py: 0.5,
                              borderRadius: 0.5,
                              bgcolor: '#1a1612',
                              color: '#fdfaf5',
                              fontFamily: '"Inter", "Segoe UI", sans-serif',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              letterSpacing: '0.04em',
                              minWidth: 50,
                              textAlign: 'center',
                              cursor: onSeek ? 'pointer' : 'default',
                              '&:hover': onSeek ? { bgcolor: '#d97706' } : {},
                            }}
                          >
                            {tcLabel}
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                              <Chip
                                label={prio.label}
                                size="small"
                                sx={{
                                  height: 20,
                                  bgcolor: prio.color,
                                  color: '#fff',
                                  fontWeight: 700,
                                  fontSize: '0.65rem',
                                }}
                              />
                              {isResolved && !onToggleResolved && (
                                <Chip
                                  size="small"
                                  icon={<ResolvedIcon sx={{ fontSize: '0.75rem !important' }} />}
                                  label="Løst"
                                  sx={{
                                    height: 20,
                                    bgcolor: 'rgba(16, 185, 129, 0.18)',
                                    color: '#10b981',
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                  }}
                                />
                              )}
                              {onToggleResolved && (
                                <Tooltip title={isResolved ? 'Marker som åpen' : 'Marker som løst'}>
                                  <Chip
                                    onClick={() => onToggleResolved(e.id, isResolved ? 'open' : 'resolved')}
                                    size="small"
                                    icon={<ResolvedIcon sx={{ fontSize: '0.75rem !important' }} />}
                                    label={isResolved ? 'Løst' : 'Marker løst'}
                                    sx={{
                                      height: 20,
                                      bgcolor: isResolved ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                                      color: isResolved ? '#10b981' : '#5a4f42',
                                      border: isResolved ? 'none' : '1px solid #5a4f42',
                                      fontWeight: 700,
                                      fontSize: '0.65rem',
                                      cursor: 'pointer',
                                      '&:hover': {
                                        bgcolor: isResolved ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.12)',
                                      },
                                    }}
                                  />
                                </Tooltip>
                              )}
                            </Stack>
                            <Typography
                              sx={{
                                fontSize: '0.95rem',
                                color: '#1a1612',
                                lineHeight: 1.5,
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {e.comment}
                            </Typography>
                            {/* Music-suggestion */}
                            {e.suggestedMediaUrl && (
                              <Box
                                sx={{
                                  mt: 1,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  px: 1.5,
                                  py: 0.8,
                                  borderRadius: 0.5,
                                  bgcolor: 'rgba(217, 119, 6, 0.12)',
                                  border: '1px solid rgba(217, 119, 6, 0.42)',
                                }}
                              >
                                <MusicIcon sx={{ color: '#d97706', fontSize: 18 }} />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1612' }}>
                                    {e.suggestedMediaLabel || 'Foreslått sang'}
                                  </Typography>
                                  {e.suggestedMediaFromSec != null && (
                                    <Typography sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.78rem', color: '#5a4f42' }}>
                                      {fmtTime(e.suggestedMediaFromSec)}
                                      {e.suggestedMediaToSec != null && ` → ${fmtTime(e.suggestedMediaToSec)}`} inn i sangen
                                    </Typography>
                                  )}
                                </Box>
                                <Tooltip title="Åpne sangen i nytt vindu">
                                  <IconButton
                                    component="a"
                                    href={buildMediaJumpUrl(e.suggestedMediaUrl, e.suggestedMediaFromSec)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    size="small"
                                    sx={{ color: '#d97706' }}
                                    aria-label="Åpne sang"
                                  >
                                    <OpenIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                            {e.clientName && (
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  mt: 0.5,
                                  fontFamily: SERIF_STACK,
                                  fontStyle: 'italic',
                                  color: '#5a4f42',
                                }}
                              >
                                — {e.clientName}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>

      <Snackbar
        open={copySnack}
        autoHideDuration={3000}
        onClose={() => setCopySnack(false)}
        message="Tilbakemelding kopiert — lim inn i NLE-en"
        ContentProps={{
          sx: {
            bgcolor: '#1a1612',
            color: '#fdfaf5',
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            fontWeight: 600,
            letterSpacing: '0.04em',
            fontSize: '0.82rem',
            borderRadius: 0,
          },
        }}
      />

      <Snackbar
        open={Boolean(downloadSnack)}
        autoHideDuration={5000}
        onClose={() => setDownloadSnack(null)}
        message={downloadSnack || ''}
        action={
          <Button
            size="small"
            onClick={() => { setDownloadSnack(null); setGuideOpen(true); }}
            sx={{
              color: '#d97706',
              fontFamily: '"Inter", "Segoe UI", sans-serif',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: '0.7rem',
            }}
          >
            Vis guide
          </Button>
        }
        ContentProps={{
          sx: {
            bgcolor: '#1a1612',
            color: '#fdfaf5',
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            fontWeight: 600,
            letterSpacing: '0.04em',
            fontSize: '0.82rem',
            borderRadius: 0,
          },
        }}
      />

      <NLEImportGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </Box>
  );
};

export default EditFeedbackSummary;
