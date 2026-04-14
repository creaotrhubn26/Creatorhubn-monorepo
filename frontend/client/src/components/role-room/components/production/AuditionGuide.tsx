/**
 * AuditionGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Audition Schedule Panel.
 *
 * Covers all features:
 *   – Overview & panel layout
 *   – Creating audition slots (candidate, role, date, time, location, notes)
 *   – Grid / Table / Compact view modes
 *   – 6-status system (scheduled, confirmed, awaiting callback, completed, cancelled, pool)
 *   – Filtering & search (status, date, candidate, role, location, today-only, favorites)
 *   – Favourites — bookmark auditions, sort to top, tracked in statistics
 *   – Details Drawer — click any card to update status and add notes
 *   – Bulk actions — multi-select, bulk delete, bulk status change
 *   – Audition Pool — save templates, reuse across projects
 *   – Export CSV & keyboard shortcuts
 *
 * Renders as a full-screen Dialog with a two-column layout:
 *   Left  — sticky step navigator (clickable)
 *   Right — scrollable content with screenshot placeholders
 *
 * Screenshot placeholders are <ScreenshotPlaceholder label="…" /> boxes.
 * Replace each one with a real <img> or <video> when assets are ready.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useContext,
  createContext,
} from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  CheckCircleOutline as DoneIcon,
  HelpOutline as HelpIcon,
  InterpreterMode as OverviewIcon,
  AddCircleOutline as CreateIcon,
  GridView as GridIcon,
  RadioButtonChecked as StatusIcon,
  FilterList as FilterIcon,
  StarBorder as FavIcon,
  LibraryAddCheck as BulkIcon,
  Bookmarks as PoolIcon,
  FileDownload as ExportIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import { GuideAnnotatedScreenshot } from '../shared/guide/GuideAnnotationOverlay';
import type { GuideStepAnnotation } from '../admin/visual-editor/guideTypes';
import { PRODUCTION_STORAGE_KEYS } from './storageKeys';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepSection {
  heading: string;
  body: React.ReactNode;
  screenshotLabel: string;
  screenshotUrl?: string;
  videoUrl?: string;
  annotations?: GuideStepAnnotation[];
}

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  sections: StepSection[];
}

type GuideLanguage = 'no' | 'en';

const GuideLanguageContext = createContext<GuideLanguage>('no');

function useGuideLanguage() {
  return useContext(GuideLanguageContext);
}

// ─── Screenshot Placeholder ───────────────────────────────────────────────────

function ScreenshotPlaceholder({ label }: { label: string }) {
  const language = useGuideLanguage();
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 200,
        border: '2px dashed rgba(255,255,255,0.12)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.02)',
        my: 2,
        py: 3,
        cursor: 'default',
      }}
    >
      <ImageIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.15)' }} />
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.72rem',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2,
        }}
      >
        {language === 'no' ? '📸 Skjermbilde-plassholder' : '📸 Screenshot placeholder'} — {label}
      </Typography>
    </Box>
  );
}
// ─── Video Placeholder ───────────────────────────────────────────────────────

function VideoPlaceholder({ label }: { label: string }) {
  const language = useGuideLanguage();
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 130,
        border: '2px dashed rgba(255,255,255,0.09)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.01)',
        my: 1,
        py: 2.5,
        cursor: 'default',
      }}
    >
      <VideoIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.12)' }} />
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.25)',
          fontSize: '0.72rem',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2,
        }}
      >
        {language === 'no' ? '🎬 Video-plassholder' : '🎬 Video placeholder'} — {label}
      </Typography>
    </Box>
  );
}

// ─── Callout Box ──────────────────────────────────────────────────────────────

function Callout({
  color = '#ffb800',
  children,
}: {
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        borderLeft: `3px solid ${color}`,
        bgcolor: `${color}12`,
        borderRadius: '0 8px 8px 0',
        px: 2,
        py: 1.25,
        my: 1.5,
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
        {children}
      </Typography>
    </Box>
  );
}

// ─── Keyboard Key ─────────────────────────────────────────────────────────────

function Key({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        border: '1px solid rgba(255,255,255,0.2)',
        bgcolor: 'rgba(255,255,255,0.07)',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'text.primary',
        lineHeight: 1.4,
        mx: 0.25,
      }}
    >
      {children}
    </Box>
  );
}

// ─── Audition Status Pill ─────────────────────────────────────────────────────

const STATUS_PILLS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:         { label: 'Scheduled',         color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  confirmed:         { label: 'Confirmed',         color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  awaiting_callback: { label: 'Awaiting Callback', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  completed:         { label: 'Completed',         color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  cancelled:         { label: 'Cancelled',         color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  pool:              { label: 'Unscheduled (Pool)', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
};

function StatusPill({ status }: { status: string }) {
  const language = useGuideLanguage();
  const localizedLabels: Record<string, string> = language === 'no'
    ? {
      scheduled: 'Planlagt',
      confirmed: 'Bekreftet',
      awaiting_callback: 'Venter callback',
      completed: 'Fullført',
      cancelled: 'Avbrutt',
      pool: 'Ikke planlagt (Pool)',
    }
    : {};

  const p = STATUS_PILLS[status] ?? STATUS_PILLS['scheduled'];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.125,
        borderRadius: '4px',
        bgcolor: p.bg,
        color: p.color,
        border: `1px solid ${p.color}55`,
        fontSize: '0.7rem',
        fontWeight: 700,
        mx: 0.25,
      }}
    >
      {localizedLabels[status] ?? p.label}
    </Box>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const ACCENT = '#ffb800';
const LANGUAGE_STORAGE_KEY = PRODUCTION_STORAGE_KEYS.auditionGuideLanguage;

function ann(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color: string,
  labelPosition: GuideStepAnnotation['labelPosition'] = 'top-left',
): GuideStepAnnotation {
  return {
    id,
    style: 'precise-box',
    x,
    y,
    width,
    height,
    label,
    color,
    thickness: 3,
    radius: 12,
    opacity: 100,
    labelPosition,
  };
}

function annPx(
  id: string,
  imageWidth: number,
  imageHeight: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  color: string,
  labelPosition: GuideStepAnnotation['labelPosition'] = 'top-left',
): GuideStepAnnotation {
  return ann(
    id,
    Number(((x1 / imageWidth) * 100).toFixed(2)),
    Number(((y1 / imageHeight) * 100).toFixed(2)),
    Number((((x2 - x1) / imageWidth) * 100).toFixed(2)),
    Number((((y2 - y1) / imageHeight) * 100).toFixed(2)),
    label,
    color,
    labelPosition,
  );
}

const SECTION_ANNOTATION_PRESETS: Record<string, GuideStepAnnotation[]> = {
  'What is the Audition Planner?': [
    // overview-main.png (3760x1520)
    annPx('planner-guide', 3760, 1520, 2539, 223, 2715, 313, 'Guide', '#22c55e', 'top-center'),
    annPx('planner-export', 3760, 1520, 2813, 223, 3107, 313, 'Eksporter', '#60a5fa', 'top-center'),
    annPx('planner-stats', 3760, 1520, 3121, 223, 3399, 313, 'Statistikk', '#38bdf8', 'top-center'),
    annPx('planner-new', 3760, 1520, 3413, 223, 3686, 312, 'Ny avtale', '#f59e0b', 'top-center'),
    annPx('planner-project-btn', 3760, 1520, 74, 431, 447, 505, 'Prosjekt', '#f59e0b', 'top-center'),
    annPx('planner-pool-btn', 3760, 1520, 479, 431, 755, 505, 'Maler', '#a78bfa', 'top-center'),
    annPx('planner-standard-btn', 3760, 1520, 170, 571, 361, 645, 'Standard', '#60a5fa', 'top-center'),
    annPx('planner-pro-btn', 3760, 1520, 393, 571, 615, 645, 'Pro-visning', '#22c55e', 'top-center'),
  ],
  'Panel header at a glance': [
    // overview-header.png (3760x640)
    annPx('header-guide', 3760, 640, 2539, 223, 2715, 313, 'Guide', '#22c55e', 'top-center'),
    annPx('header-export', 3760, 640, 2813, 223, 3107, 313, 'Eksporter', '#60a5fa', 'top-center'),
    annPx('header-stats', 3760, 640, 3121, 223, 3399, 313, 'Statistikk', '#38bdf8', 'top-center'),
    annPx('header-new', 3760, 640, 3413, 223, 3686, 312, 'Ny avtale', '#f59e0b', 'top-center'),
    annPx('header-kbd', 3760, 640, 2739, 247, 2788, 289, 'Snarveier', '#a78bfa', 'top-center'),
  ],
  'Workspace modes: Standard vs Pro': [
    // standard-vs-pro.png (3760x1800)
    annPx('mode-project-btn', 3760, 1800, 74, 182, 447, 257, 'Prosjekt', '#f59e0b', 'top-center'),
    annPx('mode-pool-btn', 3760, 1800, 455, 182, 742, 257, 'Maler', '#a78bfa', 'top-center'),
    annPx('mode-standard-btn', 3760, 1800, 191, 323, 379, 397, 'Standard', '#60a5fa', 'top-center'),
    annPx('mode-pro-btn', 3760, 1800, 393, 323, 614, 396, 'Pro-visning', '#22c55e', 'top-center'),
    annPx('mode-pipeline-btn', 3760, 1800, 2289, 467, 2502, 548, 'Pipeline', '#a78bfa', 'top-center'),
    annPx('mode-timeline-btn', 3760, 1800, 2517, 467, 2733, 549, 'Timeline', '#38bdf8', 'top-center'),
  ],
  'Creating a new audition slot': [
    // creating-form.png (2240x2044)
    annPx('create-candidate', 2240, 2044, 121, 203, 1090, 315, 'Kandidat', '#22c55e', 'top-center'),
    annPx('create-role', 2240, 2044, 1146, 205, 2121, 315, 'Rolle', '#60a5fa', 'top-center'),
    annPx('create-date', 2240, 2044, 118, 365, 2121, 475, 'Dato', '#38bdf8', 'top-center'),
    annPx('create-time', 2240, 2044, 118, 525, 2121, 635, 'Tid', '#f59e0b', 'top-center'),
    annPx('create-location', 2240, 2044, 118, 685, 2121, 795, 'Lokasjon', '#22c55e', 'top-center'),
    annPx('create-notes', 2240, 2044, 115, 1199, 2124, 1733, 'Notater', '#a78bfa', 'top-center'),
    annPx('create-status', 2240, 2044, 118, 1733, 2121, 1783, 'Status', '#ef4444', 'top-center'),
    annPx('create-save', 2240, 2044, 1708, 1916, 1906, 2012, 'Lagre', '#60a5fa', 'top-center'),
  ],
  'Editing an existing slot': [
    // editing-form.png (2240x2044)
    annPx('edit-candidate-role', 2240, 2044, 118, 203, 2121, 315, 'Forhåndsutfylt kandidat/rolle', '#22c55e', 'top-center'),
    annPx('edit-date-time', 2240, 2044, 118, 365, 2121, 635, 'Dato og tid', '#60a5fa', 'top-center'),
    annPx('edit-location-scene', 2240, 2044, 118, 685, 2121, 1115, 'Lokasjon og scene', '#38bdf8', 'top-center'),
    annPx('edit-notes', 2240, 2044, 115, 1199, 2124, 1733, 'Notater', '#a78bfa', 'top-center'),
    annPx('edit-status', 2240, 2044, 118, 1733, 2121, 1783, 'Status', '#ef4444', 'top-center'),
    annPx('edit-save', 2240, 2044, 1708, 1916, 1906, 2012, 'Lagre endringer', '#f59e0b', 'top-center'),
  ],
  'Three ways to view your schedule': [
    // view-modes-switcher.png (3760x720)
    annPx('view-mode-group', 3760, 720, 3398, 404, 3708, 562, 'Visningsmodus', '#22c55e', 'top-center'),
    annPx('view-mode-list', 3760, 720, 3417, 404, 3508, 560, 'Compact', '#f59e0b', 'top-center'),
    annPx('view-mode-table', 3760, 720, 3513, 404, 3603, 560, 'Table', '#60a5fa', 'top-center'),
    annPx('view-mode-grid', 3760, 720, 3609, 404, 3699, 560, 'Grid', '#38bdf8', 'top-center'),
  ],
  'Six-status workflow': [
    // status-workflow.png (3760x1520)
    annPx('status-pool', 3760, 1520, 366, 769, 477, 819, 'Pool', '#94a3b8', 'top-center'),
    annPx('status-planned', 3760, 1520, 488, 769, 617, 819, 'Planlagt', '#f59e0b', 'top-center'),
    annPx('status-confirmed', 3760, 1520, 628, 769, 767, 819, 'Bekreftet', '#60a5fa', 'top-center'),
    annPx('status-callback', 3760, 1520, 778, 769, 989, 819, 'Tilbakemelding', '#38bdf8', 'top-center'),
    annPx('status-completed', 3760, 1520, 1000, 769, 1117, 819, 'Fullført', '#22c55e', 'top-center'),
    annPx('status-cancelled', 3760, 1520, 1128, 769, 1279, 819, 'Kansellert', '#ef4444', 'top-center'),
  ],
  'Statistics banner': [
    // statistics-banner.png (3760x1520)
    annPx('stats-banner', 3760, 1520, 22, 486, 3738, 764, 'Statistikkbanner', '#60a5fa', 'top-center'),
  ],
  'Conflict detection and priority scoring (Pro)': [
    // standard-vs-pro.png (3760x1800)
    annPx('pro-conflict-chip', 3760, 1800, 269, 475, 479, 541, 'Konflikt-chip', '#f59e0b', 'top-center'),
    annPx('pro-conflict-card', 3760, 1800, 2995, 593, 3721, 733, 'Konflikt-kort', '#ef4444', 'top-center'),
    annPx('pro-details', 3760, 1800, 2263, 763, 3721, 1645, 'Pro-detaljer', '#22c55e', 'top-center'),
  ],
  'Search bar': [
    // search-bar-active.png (3760x1520)
    annPx('search-input', 3760, 1520, 61, 947, 2682, 1039, 'Søkefelt', '#22c55e', 'top-center'),
    annPx('search-term-chip', 3760, 1520, 1290, 1101, 1510, 1151, 'Søk-chip', '#f59e0b', 'top-center'),
  ],
  'Status, date & dropdown filters': [
    // search-bar-active.png (3760x1520)
    annPx('filter-search', 3760, 1520, 61, 947, 2682, 1039, 'Søk', '#22c55e', 'top-center'),
    annPx('filter-date', 3760, 1520, 2697, 949, 3037, 1039, 'Dato', '#60a5fa', 'top-center'),
    annPx('filter-sort', 3760, 1520, 3051, 949, 3403, 1039, 'Sortering', '#38bdf8', 'top-center'),
    annPx('filter-view-list', 3760, 1520, 3417, 949, 3507, 1039, 'List', '#a78bfa', 'top-center'),
    annPx('filter-view-table', 3760, 1520, 3513, 949, 3603, 1039, 'Table', '#60a5fa', 'top-center'),
    annPx('filter-view-grid', 3760, 1520, 3609, 949, 3699, 1039, 'Grid', '#f59e0b', 'top-center'),
  ],
  'Active filter chips': [
    // active-filter-chips.png (3760x1520)
    annPx('active-chip-query', 3760, 1520, 1290, 1101, 1510, 1151, 'Søk-chip', '#f59e0b', 'top-center'),
    annPx('active-chip-clear', 3760, 1520, 1512, 1101, 1634, 1151, 'Fjern alle', '#ef4444', 'top-center'),
  ],
  'Bookmarking auditions': [
    // favourites-row.png (3760x1520)
    annPx('fav-chip', 3760, 1520, 58, 769, 227, 819, 'Favoritter', '#22c55e', 'top-center'),
  ],
  'Viewing and updating audition details': [
    // standard-vs-pro.png (3760x1800)
    annPx('details-panel', 3760, 1800, 2263, 763, 3721, 1645, 'Detaljpanel', '#60a5fa', 'top-center'),
  ],
  'Selecting multiple auditions': [
    // overview-main.png (3760x1520)
    annPx('select-col', 3760, 1520, 24, 1048, 96, 1438, 'Multi-select', '#22c55e', 'top-center'),
  ],
  'Undo delete': [
    // bulk-actions-bar.png (3760x1880)
    annPx('undo-zone', 3760, 1880, 1280, 1740, 2480, 1860, 'Undo snackbar', '#f59e0b', 'top-center'),
  ],
  'Pro tools: compare and bulk planning': [
    // standard-vs-pro.png (3760x1800)
    annPx('pipeline', 3760, 1800, 39, 763, 2225, 1645, 'Pipeline', '#22c55e', 'top-center'),
    annPx('pro-sort', 3760, 1800, 1408, 470, 1744, 546, 'Sorter', '#60a5fa', 'top-center'),
    annPx('pro-status-filter', 3760, 1800, 1768, 470, 2064, 546, 'Statusfilter', '#38bdf8', 'top-center'),
    annPx('pro-actions', 3760, 1800, 2750, 470, 3699, 549, 'Lagrede visninger/handlinger', '#f59e0b', 'top-center'),
    annPx('compare-bulk', 3760, 1800, 2263, 763, 3721, 1645, 'Pro-detaljer', '#60a5fa', 'top-center'),
  ],
  'What is the Audition Pool?': [
    // pool-view.png (3760x1880)
    annPx('pool-tab', 3760, 1880, 387, 127, 611, 204, 'Maler', '#f59e0b', 'top-center'),
    annPx('pool-info', 3760, 1880, 22, 768, 3738, 1120, 'Pool-info', '#a78bfa', 'top-center'),
    annPx('pool-area', 3760, 1880, 22, 1130, 3738, 1870, 'Pool-område', '#60a5fa', 'top-center'),
  ],
  'Managing pool templates': [
    // pool-template-closeup.png (3760x1520)
    annPx('pool-card', 3760, 1520, 1730, 1188, 2090, 1438, 'Template-kort', '#22c55e', 'top-center'),
  ],
  'Export to CSV': [
    // overview-header.png (3760x640)
    annPx('export-btn', 3760, 640, 2838, 115, 3133, 211, 'Eksporter', '#60a5fa', 'top-center'),
  ],
  'Keyboard shortcuts': [
    // keyboard-shortcuts-modal.png (3320x1800)
    annPx('kbd-modal-main', 3320, 1800, 420, 260, 2900, 1560, 'Snarvei-oversikt', '#f59e0b', 'top-center'),
  ],
  'Guide and shortcut discoverability': [
    // overview-header.png (3760x640)
    annPx('guide-btn', 3760, 640, 2563, 115, 2737, 211, 'Guide', '#22c55e', 'top-center'),
    annPx('kbd-trigger', 3760, 640, 2748, 115, 2828, 211, '?', '#60a5fa', 'top-center'),
  ],
};

function withDefaultSectionAnnotations(step: Step): Step {
  return {
    ...step,
    sections: step.sections.map(section => ({
      ...section,
      annotations: section.annotations ?? SECTION_ANNOTATION_PRESETS[section.heading],
    })),
  };
}

const STEP_LABELS_NO: Record<string, string> = {
  overview: 'Oversikt',
  'creating-slots': 'Opprette slots',
  'view-modes': 'Visningsmodi',
  'status-tracking': 'Statussporing',
  filters: 'Filtrering',
  favourites: 'Favoritter',
  'details-drawer': 'Detaljpanel',
  'bulk-actions': 'Massehandlinger',
  'audition-pool': 'Audition-pool',
  'export-shortcuts': 'Eksport og snarveier',
};

const SECTION_HEADINGS_NO: Record<string, string> = {
  'overview.What is the Audition Planner?': 'Hva er Audition Planner?',
  'overview.Panel header at a glance': 'Paneltopp i korte trekk',
  'creating-slots.Creating a new audition slot': 'Opprett en ny audition-slot',
  'creating-slots.Editing an existing slot': 'Rediger en eksisterende slot',
  'view-modes.Three ways to view your schedule': 'Tre måter å se planen på',
  'view-modes.Workspace modes: Standard vs Pro': 'Arbeidsmodus: Standard vs Pro',
  'status-tracking.Six-status workflow': 'Seks-status arbeidsflyt',
  'status-tracking.Statistics banner': 'Statistikkbanner',
  'status-tracking.Conflict detection and priority scoring (Pro)': 'Konfliktdeteksjon og prioritetspoeng (Pro)',
  'filters.Search bar': 'Søkefelt',
  'filters.Status, date & dropdown filters': 'Status-, dato- og nedtrekksfiltre',
  'filters.Active filter chips': 'Aktive filterbrikker',
  'favourites.Bookmarking auditions': 'Bokmerke auditions',
  'details-drawer.Viewing and updating audition details': 'Vis og oppdater auditiondetaljer',
  'bulk-actions.Selecting multiple auditions': 'Velg flere auditions',
  'bulk-actions.Undo delete': 'Angre sletting',
  'bulk-actions.Pro tools: compare and bulk planning': 'Pro-verktøy: sammenligning og bulk-planlegging',
  'audition-pool.What is the Audition Pool?': 'Hva er Audition-poolen?',
  'audition-pool.Managing pool templates': 'Administrer pool-maler',
  'export-shortcuts.Export to CSV': 'Eksporter til CSV',
  'export-shortcuts.Keyboard shortcuts': 'Tastatursnarveier',
  'export-shortcuts.Guide and shortcut discoverability': 'Guide og snarveier',
};

const UI_COPY = {
  no: {
    title: 'Audition Planner — Guide',
    prev: '← Forrige',
    next: 'Neste →',
    close: 'Lukk',
    done: 'Ferdig ✓',
    stepOf: 'Steg',
    of: 'av',
    noStepsFallback:
      'Ingen guide-steg er aktive i Guide Editor akkurat nå. Viser standardguiden som fallback.',
    langLabel: 'Språk',
    imageClickHint: 'Klikk bildet for å se større',
    closePreviewAriaLabel: 'Lukk forhåndsvisning',
  },
  en: {
    title: 'Audition Planner — Guide',
    prev: '← Prev',
    next: 'Next →',
    close: 'Close',
    done: 'Done ✓',
    stepOf: 'Step',
    of: 'of',
    noStepsFallback:
      'No guide steps are active in Guide Editor right now. Showing the default guide as fallback.',
    langLabel: 'Language',
    imageClickHint: 'Click image to enlarge',
    closePreviewAriaLabel: 'Close preview',
  },
} as const;

const SECTION_BODIES_NO: Record<string, React.ReactNode> = {
  'overview.What is the Audition Planner?': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Audition Planner er hovedverktøyet ditt for planlegging, oppfølging og koordinering av auditions
      i prosjektet. Her samles kandidat, rolle, dato, sted og notater i én live visning med filtre,
      snarveier og mal-pool for gjenbruk.
    </Typography>
  ),
  'overview.Panel header at a glance': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Toppfeltet gir deg rask tilgang til Guide (<Key>G</Key>), Eksport (<Key>Ctrl</Key>+<Key>E</Key>),
      Statistikk og <strong>+ New Schedule</strong>. Tastatur-ikonet åpner full snarvei-oversikt.
    </Typography>
  ),
  'creating-slots.Creating a new audition slot': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Opprett ny slot med <strong>+ New Schedule</strong> eller <Key>F</Key>/<Key>N</Key>.
      Fyll ut kandidat, rolle, dato, tid, sted og notater. Nye slots starter som{' '}
      <StatusPill status="scheduled" /> og kan oppdateres i detaljpanelet.
    </Typography>
  ),
  'creating-slots.Editing an existing slot': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Klikk rediger-ikonet på en rad/kort for å åpne samme skjema med eksisterende data.
      Endringer lagres fortløpende.
    </Typography>
  ),
  'view-modes.Three ways to view your schedule': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Bytt mellom <strong>Grid</strong>, <strong>Table</strong> og <strong>Compact</strong> avhengig av
      behov. Table er best for sortering/sammenligning, mens Compact gir høy tetthet ved mange auditions.
    </Typography>
  ),
  'view-modes.Workspace modes: Standard vs Pro': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      <strong>Standard</strong> passer daglig oppfølging. <strong>Pro</strong> gir pipeline/timeline,
      lagrede visninger, deling av oppsett og live-metrikker for konflikter/prioritering.
    </Typography>
  ),
  'status-tracking.Six-status workflow': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Hver audition har én av seks statuser: planlagt, bekreftet, venter callback, fullført, avbrutt
      eller pool. Status endres i detaljpanelet eller via masseoppdatering.
    </Typography>
  ),
  'status-tracking.Statistics banner': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Statistikk viser live tall basert på aktive filtre, slik at du raskt ser fordeling på status,
      kommende auditions og favoritter.
    </Typography>
  ),
  'status-tracking.Conflict detection and priority scoring (Pro)': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      I Pro-visning får du konfliktvarsler, prioritetsscore per audition og anbefalt neste handling
      for raskere triage.
    </Typography>
  ),
  'filters.Search bar': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Søk matcher kandidat, rolle, sted og notater samtidig. Bruk <Key>Esc</Key> for å tømme søk.
    </Typography>
  ),
  'filters.Status, date & dropdown filters': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Filtrer på status, dato, kandidat, rolle, sted, kun i dag og favoritter. Når filtre er aktive
      kan du nullstille alt med <strong>Clear all filters</strong>.
    </Typography>
  ),
  'filters.Active filter chips': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Aktive filtre vises som brikker under filterlinjen. Fjern enkeltfiltre med <strong>✕</strong>
      uten å påvirke resten.
    </Typography>
  ),
  'favourites.Bookmarking auditions': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Marker viktige auditions med stjerne. Favoritter løftes til toppen, kan filtreres separat
      og synkroniseres for innloggede brukere.
    </Typography>
  ),
  'details-drawer.Viewing and updating audition details': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Klikk en audition for å åpne detaljpanelet. Der kan du oppdatere status/notater, se all
      nøkkelinformasjon og navigere videre uten å lukke panelet.
    </Typography>
  ),
  'bulk-actions.Selecting multiple auditions': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Marker flere rader/kort med avkrysningsbokser for massehandlinger som sletting eller
      statusendring. Pro-modus gir i tillegg sammenligning og bulk-planlegging.
    </Typography>
  ),
  'bulk-actions.Undo delete': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Etter sletting vises en snackbar med <strong>Undo</strong> i en kort periode. Etter timeout
      blir slettingen permanent.
    </Typography>
  ),
  'bulk-actions.Pro tools: compare and bulk planning': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Pro-verktøy lar deg sammenligne kandidater side om side og planlegge dato/tid for mange
      auditions i én operasjon.
    </Typography>
  ),
  'audition-pool.What is the Audition Pool?': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Audition-pool er et malbibliotek på tvers av prosjekter. Lagre slots til pool og importer dem
      senere til nytt prosjekt for raskere oppsett.
    </Typography>
  ),
  'audition-pool.Managing pool templates': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      I pool-visning kan du søke, importere og slette maler. Hver mal viser rolle, tid, sted og
      nødvendige handlinger.
    </Typography>
  ),
  'export-shortcuts.Export to CSV': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Eksporter filtrert liste til CSV med <strong>Export</strong> eller <Key>Ctrl</Key>+<Key>E</Key>.
      Inkluderer kandidat, rolle, dato/tid, sted, status og notater.
    </Typography>
  ),
  'export-shortcuts.Keyboard shortcuts': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Viktige Pro-snarveier: <Key>J</Key>/<Key>K</Key> naviger, <Key>E</Key> rediger, <Key>F</Key>{' '}
      favoritt, <Key>B</Key> bekreft, <Key>V</Key> callback, <Key>A</Key> planlagt, <Key>X</Key>{' '}
      avbryt, <Key>Cmd/Ctrl</Key>+<Key>Enter</Key> fullført.
    </Typography>
  ),
  'export-shortcuts.Guide and shortcut discoverability': (
    <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
      Guiden åpnes fra header eller med <Key>G</Key>. Snarvei-modal åpnes via tastaturikon eller{' '}
      <Key>?</Key>.
    </Typography>
  ),
};

function localizeStepMeta(step: Step, language: GuideLanguage): Step {
  if (language === 'en') {
    return step;
  }

  return {
    ...step,
    label: STEP_LABELS_NO[step.id] ?? step.label,
    sections: step.sections.map(section => {
      const key = `${step.id}.${section.heading}`;
      return {
        ...section,
        heading: SECTION_HEADINGS_NO[key] ?? section.heading,
        body: SECTION_BODIES_NO[key] ?? section.body,
      };
    }),
  };
}

const STEPS_EN: Step[] = [
  // ── 1. Overview ──────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: <OverviewIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is the Audition Planner?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The Audition Planner is your central workspace for scheduling, tracking, and
              managing every audition in a casting project. It connects candidates, roles,
              dates, locations, and notes into a single live view — with real-time filters,
              keyboard shortcuts, and a built-in pool for reusable templates.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The panel breaks into two main modes you can toggle at the top:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Project view</strong> — shows audition
                  slots you have scheduled for the current project.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Pool view</strong> — shows reusable
                  audition templates saved from any project, ready to import.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Before creating your first audition slot you need at least one{' '}
              <strong>Candidate</strong> and one <strong>Role</strong> in the project —
              use the Candidates and Roles tabs to add them first.
            </Callout>
          </>
        ),
        screenshotLabel: 'Audition Planner — full panel overview',
        screenshotUrl: '/guide/audition/overview-main.png',
      },
      {
        heading: 'Panel header at a glance',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The header bar always shows the live count of scheduled auditions and quick
              access to the three primary actions:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 0 }}>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2">
                  <strong>Guide</strong> — opens this walkthrough at any time (<Key>G</Key>).
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2">
                  <strong>Export</strong> — download a CSV of the filtered visible list
                  (<Key>Ctrl</Key>+<Key>E</Key>).
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2">
                  <strong>Statistics</strong> — toggle a summary card showing totals by status.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong>+ New Schedule</strong> — open the create form (<Key>F</Key> or{' '}
                  <Key>N</Key> keyboard shortcuts).
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1 }}>
              The <strong>Keyboard</strong> icon opens a full shortcut modal with every key and
              scope, so the shortcuts are discoverable without using extra layout space.
            </Typography>
          </>
        ),
        screenshotLabel: 'Header bar with Export / Statistics / New Schedule buttons',
        screenshotUrl: '/guide/audition/overview-header.png',
      },
    ],
  },

  // ── 2. Creating Audition Slots ────────────────────────────────────────────
  {
    id: 'creating-slots',
    label: 'Creating Slots',
    icon: <CreateIcon fontSize="small" />,
    sections: [
      {
        heading: 'Creating a new audition slot',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click <strong>+ New Schedule</strong> or press <Key>F</Key> / <Key>N</Key> to open the
              creation form. Fill in:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                ['Candidate', 'The person being auditioned — drawn from the Candidates list.'],
                ['Role', 'The role they are auditioning for — drawn from the Roles list.'],
                ['Date', 'Calendar date of the audition.'],
                ['Time', 'Start time of the slot.'],
                ['Location', 'Room, studio, or address where the audition takes place.'],
                ['Notes', 'Free-text notes visible in the Details Drawer.'],
              ].map(([field, desc]) => (
                <Box component="li" key={field} sx={{ mb: 0.75 }}>
                  <Typography variant="body2">
                    <strong style={{ color: ACCENT }}>{field}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              A new slot starts with status <StatusPill status="scheduled" /> and immediately
              appears in the list. You can change the status at any time from the Details Drawer.
            </Callout>
          </>
        ),
        screenshotLabel: 'Create audition slot form — all fields visible',
        screenshotUrl: '/guide/audition/creating-form.png',
      },
      {
        heading: 'Editing an existing slot',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Click the <strong>Edit</strong> (pencil) icon on any card or row to reopen the same
            form with the existing data pre-filled. Changes are saved immediately.
          </Typography>
        ),
        screenshotLabel: 'Edit form open on existing audition slot',
        screenshotUrl: '/guide/audition/editing-form.png',
      },
    ],
  },

  // ── 3. View Modes ─────────────────────────────────────────────────────────
  {
    id: 'view-modes',
    label: 'View Modes',
    icon: <GridIcon fontSize="small" />,
    sections: [
      {
        heading: 'Three ways to view your schedule',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Use the view-mode icons in the toolbar (above the filter chips) to switch between:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { name: 'Grid', icon: '⊞', desc: 'Cards in a responsive 2–4 column grid. Best for a visual overview at a glance.' },
                { name: 'Table', icon: '≡', desc: 'Sortable columns (candidate, role, date, time, location, status). Best for bulk comparison and sorting.' },
                { name: 'Compact', icon: '☰', desc: 'Dense single-line rows. Best when you have many auditions and want maximum density.' },
              ].map(m => (
                <Box key={m.name} sx={{ display: 'flex', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <Typography sx={{ fontSize: '1.1rem', lineHeight: 1, mt: 0.25, minWidth: 20 }}>{m.icon}</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: ACCENT }}>{m.name}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{m.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
            <Callout>
              In <strong>Table view</strong> click any column header to sort ascending/descending.
              The sort state persists as you change filters.
            </Callout>
          </>
        ),
        screenshotLabel: 'Grid / Table / Compact view mode switcher',
        screenshotUrl: '/guide/audition/view-modes-switcher.png',
      },
      {
        heading: 'Workspace modes: Standard vs Pro',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              In Project view you can switch between <strong>Standard</strong> and{' '}
              <strong>Pro-visning</strong>. Pro mode is optimized for high-volume decision work:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Pipeline</strong> board with drag-and-drop
                  status updates across columns.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Timeline</strong> mode with day/week buckets
                  and focus-date filtering.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Saved views</strong> + <strong>Share/Import code</strong> for handing over
                  the same Pro setup between team members.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong>Live Pro metrics</strong> (high priority, callback queue, conflicts).
                </Typography>
              </Box>
            </Box>
            <Callout>
              Use Pro view when you need faster triage and coordination across many auditions; use
              Standard view for day-to-day list editing.
            </Callout>
          </>
        ),
        screenshotLabel: 'Standard vs Pro toggle with pipeline/timeline controls and saved views',
        screenshotUrl: '/guide/audition/standard-vs-pro.png',
      },
    ],
  },

  // ── 4. Status Tracking ────────────────────────────────────────────────────
  {
    id: 'status-tracking',
    label: 'Status Tracking',
    icon: <StatusIcon fontSize="small" />,
    sections: [
      {
        heading: 'Six-status workflow',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Every audition slot carries one of six statuses, colour-coded throughout the panel:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {(Object.entries(STATUS_PILLS) as [string, { label: string; color: string; bg: string }][]).map(([key, _pill]) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, '&:last-child': { mb: 0 } }}>
                  <StatusPill status={key} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                    {key === 'scheduled'         && 'Default state — the slot is planned but not yet confirmed.'}
                    {key === 'confirmed'          && 'The candidate has accepted and the time is locked in.'}
                    {key === 'awaiting_callback'  && 'Audition complete — waiting for the candidate to follow up.'}
                    {key === 'completed'          && 'Audition done and notes/feedback filed.'}
                    {key === 'cancelled'          && 'The slot was cancelled (still visible for reporting).'}
                    {key === 'pool'               && 'Saved to the pool as a template — not yet scheduled.'}
                  </Typography>
                </Box>
              ))}
            </Paper>
            <Callout>
              Change a status from the <strong>Details Drawer</strong> (click any card) — or
              change many at once using <strong>Bulk Status Change</strong> (see Bulk Actions step).
            </Callout>
          </>
        ),
        screenshotLabel: 'Status filter chips showing all six statuses with colours',
        screenshotUrl: '/guide/audition/status-workflow.png',
      },
      {
        heading: 'Statistics banner',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Click <strong>Statistics</strong> in the header to reveal a summary row with live
              counts broken down by status:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              {[
                { label: 'Total', color: '#ffb800' },
                { label: 'Upcoming', color: '#00d4ff' },
                { label: 'Scheduled', color: '#94a3b8' },
                { label: 'Completed', color: '#10b981' },
                { label: 'Cancelled', color: '#ef4444' },
                { label: 'Favourites', color: '#ffc107' },
              ].map(s => (
                <Chip
                  key={s.label}
                  label={s.label}
                  size="small"
                  sx={{ bgcolor: `${s.color}18`, color: s.color, border: `1px solid ${s.color}44`, fontWeight: 600, fontSize: '0.72rem' }}
                />
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, color: 'text.secondary' }}>
              Counts always reflect the <em>active filters</em> — so you can focus on today's
              sessions and see exactly how many are confirmed vs. still pending.
            </Typography>
          </>
        ),
        screenshotLabel: 'Statistics banner showing status counts',
        screenshotUrl: '/guide/audition/statistics-banner.png',
      },
      {
        heading: 'Conflict detection and priority scoring (Pro)',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Pro view adds a conflict and priority layer on top of status tracking:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Conflict chip</strong> at the top shows total and critical conflicts.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Per-card warning badges</strong> highlight overlaps and missing callback notes.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Priority score</strong> is visible on cards and broken down in Pro details
                  (status weight, urgency, notes, favourite and callback boost).
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong>Next recommended action</strong> helps you decide what to do first.
                </Typography>
              </Box>
            </Box>
          </>
        ),
        screenshotLabel: 'Pro conflict chip and priority score breakdown in details panel',
        screenshotUrl: '/guide/audition/standard-vs-pro.png',
      },
    ],
  },

  // ── 5. Filtering & Search ─────────────────────────────────────────────────
  {
    id: 'filters',
    label: 'Filtering',
    icon: <FilterIcon fontSize="small" />,
    sections: [
      {
        heading: 'Search bar',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The search bar matches across <strong>candidate name</strong>,{' '}
              <strong>role name</strong>, <strong>location</strong>, and <strong>notes</strong>{' '}
              simultaneously. Results update live as you type.
            </Typography>
            <Callout>
              Press <Key>Esc</Key> to clear the search, or click the × icon inside the field.
              Active search terms appear as removable chips below the toolbar.
            </Callout>
          </>
        ),
        screenshotLabel: 'Search bar with active query and chip badge below toolbar',
        screenshotUrl: '/guide/audition/search-bar-active.png',
      },
      {
        heading: 'Status, date & dropdown filters',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Below the toolbar a row of filter controls lets you narrow down the list:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                ['Status chips', 'Click any status chip (Scheduled / Confirmed / Awaiting Callback / Completed / Cancelled) to show only that status.'],
                ['📅 Today only', "Toggle to show only auditions scheduled for today's date."],
                ['⭐ Favourites only', 'Toggle to show only bookmarked auditions.'],
                ['Date picker', 'Filter to a specific calendar date.'],
                ['Candidate dropdown', 'Show only auditions for a specific candidate.'],
                ['Role dropdown', 'Show only auditions for a specific role.'],
                ['Location dropdown', 'Show only auditions at a specific location.'],
              ].map(([name, desc]) => (
                <Box component="li" key={name} sx={{ mb: 0.75 }}>
                  <Typography variant="body2">
                    <strong style={{ color: ACCENT }}>{name}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              When any filter is active a <strong>Clear all filters</strong> button appears — click
              it to reset everything at once.
            </Callout>
          </>
        ),
        screenshotLabel: 'Filter row — status chips, date/sort, and view toggles',
        screenshotUrl: '/guide/audition/search-bar-active.png',
      },
      {
        heading: 'Active filter chips',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Every active filter renders as a removable chip directly below the filter bar. Click the{' '}
            <strong>✕</strong> on any chip to remove just that filter without clearing the others.
            This makes it easy to drill down with multiple filters and peel them back one at a time.
          </Typography>
        ),
        screenshotLabel: 'Active filter chips visible — search term, date, role selected',
        screenshotUrl: '/guide/audition/search-bar-active.png',
      },
    ],
  },

  // ── 6. Favourites ─────────────────────────────────────────────────────────
  {
    id: 'favourites',
    label: 'Favourites',
    icon: <FavIcon fontSize="small" />,
    sections: [
      {
        heading: 'Bookmarking auditions',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Every audition card and table row has a <strong>⭐ star icon</strong>. Click it to
              toggle the favourite state. Favourites are:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Sorted to the top</strong> of any list — they always appear before
                  unfavourited slots regardless of other sort settings.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Counted</strong> in the Statistics banner as a separate total.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Filterable</strong> — use the ⭐ Favourites Only toggle to see just
                  your bookmarked auditions.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong>Persisted per user</strong> to the server when you are signed in, so
                  they survive page refreshes and device switches.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Use favourites to flag the most important auditions in a busy day — for example
              top callbacks or time-sensitive slots — so they always stay visible at the top.
            </Callout>
          </>
        ),
        screenshotLabel: 'Card with star icon highlighted and favourites visible at top of list',
        screenshotUrl: '/guide/audition/favourites-row.png',
      },
    ],
  },

  // ── 7. Details Drawer ─────────────────────────────────────────────────────
  {
    id: 'details-drawer',
    label: 'Details Drawer',
    icon: <HelpIcon fontSize="small" />,
    sections: [
      {
        heading: 'Viewing and updating audition details',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click any audition card or row to open the <strong>Details Drawer</strong> — a
              slide-in panel on the right side of the screen. The drawer shows the full slot
              information and lets you:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Change the status with a single click (picks from the 6-status list).',
                'Read and edit the notes field for this audition.',
                'See the candidate name, role, date, time, and location at a glance.',
                'Navigate to the next/previous slot without closing the drawer.',
              ].map(item => (
                <Box component="li" key={item} sx={{ mb: 0.75 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              You can also open the drawer with the keyboard: press <Key>↑</Key> / <Key>↓</Key>{' '}
              to navigate rows and <Key>Enter</Key> to open the drawer for the focused row.
            </Callout>
          </>
        ),
        screenshotLabel: 'Details Drawer open with status selector and notes field',
        screenshotUrl: '/guide/audition/standard-vs-pro.png',
      },
    ],
  },

  // ── 8. Bulk Actions ───────────────────────────────────────────────────────
  {
    id: 'bulk-actions',
    label: 'Bulk Actions',
    icon: <BulkIcon fontSize="small" />,
    sections: [
      {
        heading: 'Selecting multiple auditions',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Each card and table row has a checkbox. Check one to enter multi-select mode; a
              floating action bar appears at the bottom of the panel showing how many items are
              selected and the available bulk operations:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: '#ef4444' }}>Bulk Delete</strong> — permanently removes
                  all selected slots after a confirmation prompt. A brief undo window is shown
                  immediately after deletion.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Bulk Status Change</strong> — sets all selected
                  slots to the same new status in one operation. Useful for confirming a batch of
                  callbacks or marking a day's worth of auditions as completed.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Press <Key>Ctrl</Key>+<Key>D</Key> to delete the currently focused row directly —
              no need to check a checkbox first.
            </Callout>
          </>
        ),
        screenshotLabel: 'Floating bulk action bar with two items selected',
        screenshotUrl: '/guide/audition/overview-main.png',
      },
      {
        heading: 'Undo delete',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            After any deletion a <strong>snackbar notification</strong> appears at the bottom of
            the screen with an <strong>Undo</strong> button. Click it within a few seconds to
            restore the deleted slot(s). Once the snackbar disappears the deletion is permanent.
          </Typography>
        ),
        screenshotLabel: 'Undo delete snackbar at bottom of screen',
        screenshotUrl: '/guide/audition/bulk-actions-bar.png',
      },
      {
        heading: 'Pro tools: compare and bulk planning',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              In Pro view, multi-select unlocks two additional coordination tools:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Compare</strong> — mark auditions with the compare toggle and review them
                  side by side in the Pro details column.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong>Bulk planning</strong> — set date, start time and interval, then apply to
                  all selected auditions in one action.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Bulk planning is ideal after importing templates from pool, when many entries need a
              clean time distribution quickly.
            </Callout>
          </>
        ),
        screenshotLabel: 'Pro details column with Compare list and Bulk-planning controls',
        screenshotUrl: '/guide/audition/standard-vs-pro.png',
      },
    ],
  },

  // ── 9. Audition Pool ──────────────────────────────────────────────────────
  {
    id: 'audition-pool',
    label: 'Audition Pool',
    icon: <PoolIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is the Audition Pool?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The Audition Pool is a cross-project library of audition templates. Instead of
              recreating the same slot from scratch for every project, you can:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Save to pool</strong> — on any existing
                  audition slot, click the <strong>Save to Pool</strong> action (from the row
                  context menu or the Details Drawer). The slot becomes a reusable template
                  in the pool.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Import from pool</strong> — switch to
                  <strong> Pool view</strong> (toggle at the top of the panel). Browse the
                  templates, click <strong>Import</strong> on any card, pick the target project
                  and confirm. A new scheduled slot is created in that project instantly.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Pool templates retain the original candidate, role, location, and notes so you only
              need to update the date and time after importing.
            </Callout>
          </>
        ),
        screenshotLabel: 'Pool view showing template cards with Import button',
        screenshotUrl: '/guide/audition/pool-view.png',
      },
      {
        heading: 'Managing pool templates',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              In Pool view each template card shows:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1 }}>
              {[
                'Title — role name from the original slot.',
                'Time and location from when it was saved.',
                'A delete button to remove the template from the pool permanently.',
                'An import button to copy it into any project.',
              ].map(item => (
                <Box component="li" key={item} sx={{ mb: 0.5 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Use the search field in Pool view to filter templates by title.
            </Typography>
          </>
        ),
        screenshotLabel: 'Pool template card close-up — title, time, location, delete, import',
        screenshotUrl: '/guide/audition/pool-template-closeup.png',
      },
    ],
  },

  // ── 10. Export & Keyboard Shortcuts ──────────────────────────────────────
  {
    id: 'export-shortcuts',
    label: 'Export & Shortcuts',
    icon: <ExportIcon fontSize="small" />,
    sections: [
      {
        heading: 'Export to CSV',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click <strong>Export</strong> (or press <Key>Ctrl</Key>+<Key>E</Key>) to download a
              CSV file of the <em>currently filtered</em> audition list. The export includes:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Candidate name',
                'Role name',
                'Date and time',
                'Location',
                'Status',
                'Notes',
              ].map(col => (
                <Box component="li" key={col} sx={{ mb: 0.5 }}>
                  <Typography variant="body2">{col}</Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              Apply filters <em>before</em> exporting to create targeted reports — for example
              export only today's confirmed auditions for a quick callsheet.
            </Callout>
          </>
        ),
        screenshotLabel: 'Download CSV button and resulting spreadsheet',
        screenshotUrl: '/guide/audition/overview-header.png',
      },
      {
        heading: 'Keyboard shortcuts',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The panel is fully keyboard-navigable. All shortcuts are disabled while you are
              typing in an input field. In Pro view, use the fast triage keys below:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { combo: '/', desc: 'Focus search field.', scope: 'All views' },
                { combo: 'Ctrl/Cmd + N', desc: 'Open "New Schedule" form.', scope: 'All views' },
                { combo: 'Ctrl/Cmd + E', desc: 'Export the filtered list to CSV.', scope: 'All views' },
                { combo: 'Ctrl/Cmd + D', desc: 'Duplicate the focused row.', scope: 'All views' },
                { combo: '↑ / ↓', desc: 'Move focus between rows.', scope: 'All views' },
                { combo: 'Enter', desc: 'Open the details drawer for the focused row.', scope: 'All views' },
                { combo: 'Esc', desc: 'Close drawer or clear current row selection.', scope: 'All views' },
                { combo: '?', desc: 'Open the shortcuts modal.', scope: 'All views' },
                { combo: 'J / K', desc: 'Navigate between auditions.', scope: 'Pro view' },
                { combo: 'E', desc: 'Edit selected audition.', scope: 'Pro view' },
                { combo: 'F', desc: 'Toggle favourite.', scope: 'Pro view' },
                { combo: 'B', desc: 'Set status to Confirmed.', scope: 'Pro view' },
                { combo: 'V', desc: 'Set status to Callback.', scope: 'Pro view' },
                { combo: 'A', desc: 'Set status to Scheduled.', scope: 'Pro view' },
                { combo: 'X', desc: 'Set status to Avbryt (Cancelled).', scope: 'Pro view' },
                { combo: 'Cmd/Ctrl + Enter', desc: 'Set status to Completed.', scope: 'Pro view' },
              ].map(row => (
                <Box key={row.desc} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <Chip
                    size="small"
                    label={row.combo}
                    sx={{
                      minWidth: 128,
                      justifyContent: 'flex-start',
                      bgcolor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      '& .MuiChip-label': { fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: '0.72rem' },
                    }}
                  />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                    {row.desc}
                  </Typography>
                  <Chip
                    size="small"
                    label={row.scope}
                    sx={{
                      ml: 'auto',
                      bgcolor: row.scope === 'Pro view' ? 'rgba(184,107,255,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${row.scope === 'Pro view' ? 'rgba(184,107,255,0.45)' : 'rgba(255,255,255,0.15)'}`,
                      color: row.scope === 'Pro view' ? '#d8b4ff' : 'rgba(255,255,255,0.72)',
                    }}
                  />
                </Box>
              ))}
            </Paper>
          </>
        ),
        screenshotLabel: 'Keyboard shortcut reference overlay',
        screenshotUrl: '/guide/audition/keyboard-shortcuts-modal.png',
      },
      {
        heading: 'Guide and shortcut discoverability',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The panel now keeps guidance always reachable without clutter:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1 }}>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2">
                  Click <strong>Guide</strong> in the header, or press <Key>G</Key>, to open this walkthrough.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  Click the <strong>Keyboard</strong> icon (or press <Key>?</Key>) to open the full
                  shortcuts modal.
                </Typography>
              </Box>
            </Box>
          </>
        ),
        screenshotLabel: 'Guide button and keyboard-shortcuts modal trigger in the header',
        screenshotUrl: '/guide/audition/overview-header.png',
      },
    ],
  },
];

// ─── Guide IDs ────────────────────────────────────────────────────────────────

const GUIDE_ID = 'audition' as const;

// ─── Main Component ───────────────────────────────────────────────────────────

interface AuditionGuideProps {
  open: boolean;
  onClose: () => void;
}

export function AuditionGuide({ open, onClose }: AuditionGuideProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [language, setLanguage] = useState<GuideLanguage>(() => {
    if (typeof window === 'undefined') return 'no';
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'en' || stored === 'no' ? stored : 'no';
  });
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    alt: string;
    annotations?: GuideStepAnnotation[];
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Visual editor overrides (admin-only feature)
  const { isEditing, getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig = getGuideConfig(GUIDE_ID);
  const activeStepIds = getActiveStepIds(GUIDE_ID);
  const copy = UI_COPY[language];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  }, [language]);

  useEffect(() => {
    if (!imagePreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImagePreview(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imagePreview]);

  const localizedBaseSteps = useMemo(
    () => STEPS_EN.map(step => localizeStepMeta(withDefaultSectionAnnotations(step), language)),
    [language]
  );

  // Resolve all steps with label overrides first
  const stepsWithOverrides: Step[] = localizedBaseSteps.map(s => {
    const override = getStepOverride(GUIDE_ID, s.id);
    if (!override) return s;
    return { ...s, label: override.labelOverride ?? s.label };
  });

  // Then filter by active ids from visual editor; if this becomes empty,
  // keep the guide usable by falling back to full step set.
  const visibleSteps: Step[] = stepsWithOverrides.filter(s =>
    activeStepIds === null || activeStepIds.includes(s.id)
  );
  const resolvedVisibleSteps: Step[] =
    visibleSteps.length > 0 ? visibleSteps : stepsWithOverrides;

  const currentStep = resolvedVisibleSteps[activeStepIndex] ?? resolvedVisibleSteps[0];
  const stepOverride = getStepOverride(GUIDE_ID, currentStep?.id ?? '');
  const isUsingStepFallback = activeStepIds !== null && visibleSteps.length === 0;

  useEffect(() => {
    setActiveStepIndex(prev => {
      const maxIndex = Math.max(0, resolvedVisibleSteps.length - 1);
      return Math.min(prev, maxIndex);
    });
  }, [resolvedVisibleSteps.length]);

  const goTo = useCallback((index: number) => {
    setActiveStepIndex(Math.max(0, Math.min(index, resolvedVisibleSteps.length - 1)));
    // Scroll content back to top when switching steps
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [resolvedVisibleSteps.length]);

  const handlePrev = () => goTo(activeStepIndex - 1);
  const handleNext = () => goTo(activeStepIndex + 1);
  const handleDone = () => {
    onClose();
    setActiveStepIndex(0);
  };

  const isFirst = activeStepIndex === 0;
  const isLast  = activeStepIndex === resolvedVisibleSteps.length - 1;

  const ACCENT_COLOR = guideConfig?.accentColorOverride ?? ACCENT;

  return (
    <GuideLanguageContext.Provider value={language}>
      <Dialog
        open={open}
        onClose={onClose}
        fullScreen={isMobile}
        maxWidth="lg"
        fullWidth
        aria-labelledby="audition-guide-title"
        PaperProps={{
          sx: {
            bgcolor: '#12121e',
            backgroundImage: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: isMobile ? 0 : 2,
            height: isMobile ? '100dvh' : '88vh',
            maxHeight: '88vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
      {/* ── Title bar ── */}
      <DialogTitle
        id="audition-guide-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          px: 3,
          py: 1.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <HelpIcon sx={{ color: ACCENT_COLOR, fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>
            {copy.title}
          </Typography>
          <Chip
            label={`${activeStepIndex + 1} / ${resolvedVisibleSteps.length}`}
            size="small"
            sx={{
              bgcolor: `${ACCENT_COLOR}20`,
              color: ACCENT_COLOR,
              fontWeight: 700,
              fontSize: '0.7rem',
              height: 20,
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}
          >
            {copy.langLabel}
          </Typography>
          <Chip
            label="NO"
            size="small"
            onClick={() => setLanguage('no')}
            variant={language === 'no' ? 'filled' : 'outlined'}
            sx={{
              cursor: 'pointer',
              height: 22,
              bgcolor: language === 'no' ? `${ACCENT_COLOR}22` : 'transparent',
              color: language === 'no' ? ACCENT_COLOR : 'rgba(255,255,255,0.7)',
              borderColor: language === 'no' ? `${ACCENT_COLOR}66` : 'rgba(255,255,255,0.24)',
              fontWeight: 700,
            }}
          />
          <Chip
            label="EN"
            size="small"
            onClick={() => setLanguage('en')}
            variant={language === 'en' ? 'filled' : 'outlined'}
            sx={{
              cursor: 'pointer',
              height: 22,
              bgcolor: language === 'en' ? `${ACCENT_COLOR}22` : 'transparent',
              color: language === 'en' ? ACCENT_COLOR : 'rgba(255,255,255,0.7)',
              borderColor: language === 'en' ? `${ACCENT_COLOR}66` : 'rgba(255,255,255,0.24)',
              fontWeight: 700,
            }}
          />
          <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* ── Body ── */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left nav — hidden on mobile */}
        {!isMobile && (
          <Box
            sx={{
              width: 210,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              overflowY: 'auto',
              py: 1,
            }}
          >
            <List dense disablePadding>
              {resolvedVisibleSteps.map((step, i) => {
                const active = i === activeStepIndex;
                return (
                  <ListItemButton
                    key={step.id}
                    selected={active}
                    onClick={() => goTo(i)}
                    sx={{
                      mx: 1,
                      borderRadius: 1.5,
                      mb: 0.25,
                      '&.Mui-selected': {
                        bgcolor: `${ACCENT_COLOR}1A`,
                        '& .MuiListItemText-primary': { color: ACCENT_COLOR, fontWeight: 700 },
                      },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                    }}
                  >
                    <Box sx={{ mr: 1, color: active ? ACCENT_COLOR : 'rgba(255,255,255,0.3)', display: 'flex' }}>
                      {step.icon}
                    </Box>
                    <ListItemText
                      primary={step.label}
                      primaryTypographyProps={{
                        fontSize: '0.82rem',
                        color: active ? ACCENT_COLOR : 'rgba(255,255,255,0.7)',
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        {/* Right — Scrollable content */}
        <DialogContent
          ref={contentRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2.5, sm: 4 },
            py: 3,
          }}
        >
          {currentStep && (
            <Box sx={{ maxWidth: 780, mx: 'auto' }}>
              {isUsingStepFallback && (
                <Box
                  sx={{
                    mb: 2.5,
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    border: '1px solid rgba(245,158,11,0.45)',
                    bgcolor: 'rgba(245,158,11,0.12)',
                  }}
                >
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}
                  >
                    {copy.noStepsFallback}
                  </Typography>
                </Box>
              )}

              {/* Step heading */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: `${ACCENT_COLOR}20`,
                    border: `1px solid ${ACCENT_COLOR}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: ACCENT_COLOR,
                    flexShrink: 0,
                  }}
                >
                  {currentStep.icon}
                </Box>
                <Box>
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2, fontSize: '1.2rem' }}
                  >
                    {currentStep.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                    {copy.stepOf} {activeStepIndex + 1} {copy.of} {resolvedVisibleSteps.length}
                  </Typography>
                </Box>
              </Box>

              {/* Sections */}
              {currentStep.sections.map((section, si) => {
                const useStepMediaOverride = isEditing;
                const sectionVideoUrl = useStepMediaOverride
                  ? (stepOverride.videoUrl ?? section.videoUrl)
                  : section.videoUrl;
                const sectionScreenshotUrl = useStepMediaOverride
                  ? (stepOverride.screenshotUrl ?? section.screenshotUrl)
                  : section.screenshotUrl;
                const isUsingStepScreenshotOverride =
                  useStepMediaOverride &&
                  Boolean(stepOverride.screenshotUrl) &&
                  sectionScreenshotUrl === stepOverride.screenshotUrl;
                const isSameSourceAsDefaultSection =
                  isUsingStepScreenshotOverride &&
                  stepOverride.screenshotUrl === section.screenshotUrl;
                const sectionAnnotations = isUsingStepScreenshotOverride
                  ? (isSameSourceAsDefaultSection
                      ? stepOverride.annotations ?? section.annotations
                      : stepOverride.annotations)
                  : section.annotations;

                return (
                  <Box key={si} sx={{ mb: 4 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 700,
                        color: ACCENT_COLOR,
                        mb: 1.25,
                        fontSize: '0.95rem',
                      }}
                    >
                      {section.heading}
                    </Typography>
                    {section.body}
                    {sectionVideoUrl ? (
                      <Box
                        component="video"
                        src={sectionVideoUrl}
                        controls
                        sx={{
                          width: '100%',
                          borderRadius: 2,
                          border: '1px solid rgba(255,255,255,0.1)',
                          mt: 1.5,
                          display: 'block',
                        }}
                      />
                    ) : sectionScreenshotUrl ? (
                      <>
                        <GuideAnnotatedScreenshot
                          src={sectionScreenshotUrl}
                          alt={section.screenshotLabel}
                          annotations={sectionAnnotations}
                          onActivate={() =>
                            setImagePreview({
                              src: sectionScreenshotUrl,
                              alt: section.screenshotLabel,
                              annotations: sectionAnnotations,
                            })
                          }
                          containerSx={{
                            mt: 1.5,
                            borderRadius: 2,
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.1)',
                            bgcolor: 'rgba(0,0,0,0.35)',
                            '&:focus-visible': {
                              boxShadow: `0 0 0 2px ${ACCENT_COLOR}`,
                            },
                          }}
                          imageSx={{
                            maxHeight: 460,
                            objectFit: 'contain',
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{ display: 'block', mt: 0.75, color: 'rgba(255,255,255,0.5)' }}
                        >
                          {copy.imageClickHint}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <ScreenshotPlaceholder label={section.screenshotLabel} />
                        <VideoPlaceholder label={section.screenshotLabel} />
                      </>
                    )}
                  {si < currentStep.sections.length - 1 && (
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 2 }} />
                  )}
                  </Box>
                );
              })}


              {/* Admin note from Guide Editor */}
              {stepOverride.adminNote && (
                <Box
                  sx={{
                    mt: 1.5,
                    mb: 2,
                    p: 1.5,
                    borderLeft: `3px solid ${stepOverride.adminNoteColor ?? '#f59e0b'}`,
                    bgcolor: `${stepOverride.adminNoteColor ?? '#f59e0b'}14`,
                    borderRadius: '0 8px 8px 0',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: stepOverride.adminNoteColor ?? '#f59e0b', fontWeight: 700, display: 'block', fontSize: '0.7rem', mb: 0.5 }}
                  >
                    {language === 'no' ? 'Merknad' : 'Note'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {stepOverride.adminNote}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Box>

      {/* ── Footer ── */}
      <DialogActions
        sx={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          px: 3,
          py: 1.5,
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Button
          onClick={handlePrev}
          disabled={isFirst}
          variant="outlined"
          sx={{
            borderColor: 'rgba(255,255,255,0.2)',
            color: '#fff',
            '&:disabled': { opacity: 0.3 },
          }}
        >
          {copy.prev}
        </Button>
        <Button
          onClick={handleDone}
          variant="text"
          size="small"
          sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}
        >
          {copy.close}
        </Button>
        {isLast ? (
          <Button
            onClick={handleDone}
            variant="contained"
            startIcon={<DoneIcon />}
            sx={{ bgcolor: ACCENT_COLOR, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#e6a600' } }}
          >
            {copy.done}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{ bgcolor: ACCENT_COLOR, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#e6a600' } }}
          >
            {copy.next}
          </Button>
        )}
      </DialogActions>

      {imagePreview && (
        <Box
          role="dialog"
          aria-modal="true"
          aria-label={imagePreview.alt}
          onClick={() => setImagePreview(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: theme.zIndex.modal + 20,
            bgcolor: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 2, sm: 4 },
          }}
        >
          <IconButton
            onClick={() => setImagePreview(null)}
            aria-label={copy.closePreviewAriaLabel}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.08)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            onClick={(event) => event.stopPropagation()}
            sx={{
              width: 'min(1400px, calc(100vw - 32px))',
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 32px)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              bgcolor: '#000',
              overflow: 'hidden',
            }}
          >
            <GuideAnnotatedScreenshot
              src={imagePreview.src}
              alt={imagePreview.alt}
              annotations={imagePreview.annotations}
              containerSx={{ maxWidth: '100%', maxHeight: '100%' }}
              imageSx={{ maxHeight: '100%', objectFit: 'contain' }}
            />
          </Box>
        </Box>
      )}
      </Dialog>
    </GuideLanguageContext.Provider>
  );
}

export default AuditionGuide;
