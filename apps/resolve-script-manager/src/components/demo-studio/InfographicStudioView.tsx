// InfographicStudioView — «Infographic Studio» inne i Product Demo.
// Multi-scene studio: flere scener i ett prosjekt (hver med egen mal + data +
// tidspunkt), galleri, live-preview, Brand Kit (logo + farge-forslag), og
// «Send to Resolve» som rendrer ALLE scener til transparent ProRes 4444 og
// legger dem på overlay-spor ved riktig tid. Brukeren rører ALDRI HTML.

import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { executeScript, systemOpen, playwrightStatus, setupPlaywright } from '../../api';
import { useDemoStudio } from './demoStudioStore';
import {
  INFOGRAPHIC_TEMPLATES, htmlForTemplate, rawTemplateHtml, buildInfographicConfig,
  isIconField, MATERIAL_ICONS, ALL_MATERIAL_ICONS,
  addCustomTemplate, removeCustomTemplate, isCustomTemplate, customTemplateIds,
  type InfographicTemplate,
} from './infographicStudio';
import { aiPickTemplate, aiInfographicFromSite, logoToDataUrl, recordAiFeedback, recordTemplateUsage, aiFeedbackCount } from './infographicAI';
import { syncCollective, modelSteps, modelWeights, fetchInsight, type CollectiveInsight } from './infographicLearning';
import { SOCIAL_TEMPLATE_IDS } from './infographicSocialTemplates';
import { scanDom, isCaptureAvailable } from '../../services/demoCaptureService';
import { analyzeProductEvidence, gatherSiteContext } from './demoStudioAI';
import CampaignDirectorView from './CampaignDirectorView';
import { materializePost } from './campaignDirector';
import SystemArchDialog from './SystemArchDialog';
import MotionStingDialog from './MotionStingDialog';
import { isAiConnected } from '../../services/claudeProxyService';
import { FONT_FACE_CSS } from './fontAssets.generated';
import { ROLE_ROOM_LOGO, CREATORHUB_LOGO } from './kitLogos.generated';
import { listInfographics, saveInfographic, deleteInfographic, canShareToTeam, shareToTeam, fetchTeamLibrary, fetchTeamSnapshot, unshareFromTeam, type SavedInfographic, type TeamInfographic } from './infographicLibrary';
// MUI-ikoner (erstatter emoji/glyfer i UI-et) — path-import tre-shaker best.
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import PauseIcon from '@mui/icons-material/Pause';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DatasetIcon from '@mui/icons-material/Dataset';
import GridViewIcon from '@mui/icons-material/GridView';
import BarChartIcon from '@mui/icons-material/BarChart';
import CampaignIcon from '@mui/icons-material/Campaign';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AnimationIcon from '@mui/icons-material/Animation';
import MovieIcon from '@mui/icons-material/Movie';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import WidgetsIcon from '@mui/icons-material/Widgets';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import EmojiSymbolsIcon from '@mui/icons-material/EmojiSymbols';
import PaletteIcon from '@mui/icons-material/Palette';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LanguageIcon from '@mui/icons-material/Language';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import SaveIcon from '@mui/icons-material/Save';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import SendIcon from '@mui/icons-material/Send';
import PlaceIcon from '@mui/icons-material/Place';
import GroupsIcon from '@mui/icons-material/Groups';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FastForwardIcon from '@mui/icons-material/FastForward';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
// Mockup-chrome (realistisk plattform-UI i format-forhåndsvisningen):
import FavoriteIcon from '@mui/icons-material/Favorite';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ReplyIcon from '@mui/icons-material/Reply';
import TuneIcon from '@mui/icons-material/Tune';
import RepeatIcon from '@mui/icons-material/Repeat';

const D = {
  bg: '#0e1320', panel: '#141b2b', panel2: '#1b2436', line: '#27314a',
  ink: '#e8eefc', soft: '#8a98b5', faint: '#5d6b88', accent: '#3b82f6', teal: '#2dd4bf',
};

// Maler som er «charts» (graf/data-viz) → egen Charts-fane i mockup-stil.
const CHART_IDS = new Set<string>([
  'donut', 'line-growth', 'radar-chart', 'stacked-bar', 'comparison-bars', 'funnel',
  'gauge', 'stat-trio-ring', 'heatmap-week', 'progress-goals', 'big-percent',
  'hud-stack', 'kpi-hud-tiles', 'ab-test', 'live-analytics',
  'area-chart', 'multi-line', 'bubble-chart', 'waterfall', 'rose-chart',
  'sparkline-grid', 'progress-donut-grid',
]);

const MARKETING_IDS = new Set<string>([
  'cta-banner', 'offer-badge', 'product-launch', 'limited-time',
  'feature-announce', 'social-promo', 'webinar-event', 'pricing',
  'countdown', 'logo-reveal',
]);

const FILMTV_IDS = new Set<string>([
  'name-lower-third', 'cinematic-title', 'location-title', 'chapter-title',
  'social-lower-third', 'topic-lower-third', 'quote-lower-third', 'minimal-title',
  'name-lowerthird', 'quote-fullscreen',
]);

const CALLOUT_IDS = new Set<string>([
  'callout-arrow', 'callout-marker', 'callout-tooltip', 'callout-label-line',
  'callout-feature-badge', 'callout-zoom-box', 'callout-step-card', 'callout-cursor-click',
]);

const UI_IDS = new Set<string>([
  'ui-notification', 'ui-browser-frame', 'ui-app-window', 'ui-button-press',
  'ui-toggle', 'ui-progress-loader', 'ui-modal', 'ui-search',
]);

const UX_LAYOUT_IDS = new Set<string>([
  'ux-user-flow', 'ux-wireframe', 'ux-journey-map', 'ux-sitemap',
  'ux-before-after', 'ux-ab-test', 'ux-screen-flow', 'ux-grid-guide',
]);

// Branded kits — palett + kuratert mal-sett per produkt.
const RR_KIT_IDS = new Set<string>([
  // casting
  'rr-casting-call', 'rr-role-announcement', 'rr-audition-info', 'rr-callback-status',
  'rr-callsheet', 'rr-shoot-schedule', 'rr-talent-spotlight', 'rr-location-card',
  // backdrops
  'rr-bd-intro', 'rr-bd-outro', 'rr-bd-section', 'rr-bd-quote', 'rr-bd-gradient', 'rr-bd-title-band',
  // produksjon
  'rr-project-status', 'rr-shot-list', 'rr-storyboard', 'rr-crew-call', 'rr-equipment',
  'rr-moodboard', 'rr-bts', 'rr-wrap',
  // øvrige produkt-flater
  'rr-budget', 'rr-approval', 'rr-delivery', 'rr-schedule', 'rr-contract',
  'rr-story-beat', 'rr-dance-formation', 'rr-milestone',
  // mer (batch 17)
  'rr-cast-list', 'rr-selftape', 'rr-scene-breakdown', 'rr-talent-profile',
  'rr-live-set', 'rr-premiere', 'rr-dance-piece', 'rr-feedback',
  // UI-elementer (batch 19-20)
  'rr-ui-button', 'rr-ui-notification', 'rr-ui-modal', 'rr-ui-toggle',
  'rr-ui-tabs', 'rr-ui-status-pills', 'rr-ui-avatar-chip',
  'rr-ui-dropdown', 'rr-ui-input', 'rr-ui-card', 'rr-ui-sidebar',
  'rr-ui-stepper', 'rr-ui-chips', 'rr-ui-rating',
  'rr-ui-table', 'rr-ui-calendar', 'rr-ui-command', 'rr-ui-upload',
  'rr-ui-pagination', 'rr-ui-breadcrumb', 'rr-ui-accordion',
  'rr-ui-kanban', 'rr-ui-chat', 'rr-ui-activity', 'rr-ui-slider',
  'rr-ui-progress-ring', 'rr-ui-empty', 'rr-ui-tooltip',
  // innholdsmaler (batch 25)
  'rr-story-arc', 'rr-storyboard-sequence', 'rr-project-brief', 'rr-audition-scorecard',
  'rr-shortlist', 'rr-shoot-day-detail', 'rr-dance-rehearsal', 'rr-client-review',
  // full-frame landingsside (batch 26)
  'rr-landing-hero', 'rr-landing-flow', 'rr-landing-verticals', 'rr-landing-pillars', 'rr-landing-cta',
  // The Role Room Agent (batch 27-28)
  'rr-agent-hero', 'rr-agent-chat', 'rr-agent-competitor', 'rr-agent-leadgen',
  'rr-agent-marketing', 'rr-agent-partner', 'rr-agent-insight', 'rr-agent-merch',
  'rr-agent-ads', 'rr-agent-content-calendar', 'rr-agent-lead-score', 'rr-agent-followup', 'rr-agent-pitch',
  // Agent-faner (batch 29)
  'rr-agent-workflow', 'rr-agent-connections', 'rr-agent-research', 'rr-agent-inbox',
  'rr-agent-analytics', 'rr-agent-discovery', 'rr-agent-feed-planner', 'rr-agent-mentions',
  // Agent-faner/verktøy (batch 30)
  'rr-agent-events', 'rr-agent-hashtag', 'rr-agent-publish', 'rr-agent-meta-page',
  'rr-agent-profile', 'rr-agent-approvals', 'rr-agent-kpi', 'rr-agent-brand-snapshot',
  // flere landing-seksjoner (batch 28)
  'rr-landing-manifest', 'rr-landing-pricing', 'rr-landing-blog',
]);
const CH_KIT_IDS = new Set<string>([
  'ch-kpi-cards', 'ch-revenue-trend', 'ch-client-pipeline', 'ch-project-card',
  'ch-showcase-portfolio', 'ch-pricing-package', 'ch-testimonial', 'ch-booking-cta',
  'ch-bd-intro', 'ch-bd-outro', 'ch-bd-section', 'ch-bd-stat-hero', 'ch-bd-gradient', 'ch-bd-title-band',
  // UI-elementer (batch 19-20)
  'ch-ui-button', 'ch-ui-notification', 'ch-ui-modal', 'ch-ui-toggle',
  'ch-ui-tabs', 'ch-ui-stat-pill', 'ch-ui-avatar-chip',
  'ch-ui-dropdown', 'ch-ui-input', 'ch-ui-card', 'ch-ui-sidebar',
  'ch-ui-stepper', 'ch-ui-segmented', 'ch-ui-banner',
  'ch-ui-table', 'ch-ui-calendar', 'ch-ui-command', 'ch-ui-upload',
  'ch-ui-pagination', 'ch-ui-breadcrumb', 'ch-ui-accordion',
  'ch-ui-kanban', 'ch-ui-chat', 'ch-ui-activity', 'ch-ui-slider',
  'ch-ui-progress-ring', 'ch-ui-empty', 'ch-ui-tooltip',
  // innholdsmaler (batch 23): Evendi/wedding, Photo Enhancer, Academy, Audio Showcase
  'ch-wedding-timeline', 'ch-wedding-hero', 'ch-photo-before-after', 'ch-photo-stats',
  'ch-academy-course', 'ch-academy-progress', 'ch-audio-review', 'ch-audio-release',
  // landingsside + flere områder (batch 31)
  'ch-landing-hero', 'ch-landing-modules', 'ch-landing-pricing', 'ch-landing-cta',
  'ch-professions', 'ch-invoice', 'ch-showcase-gallery', 'ch-academy-cert',
]);
const BRAND_KITS = [
  { id: 'kit-rr', name: 'The Role Room', accent: '#a78bfa', tagline: 'Casting · Roller · Produksjon', ids: RR_KIT_IDS, logo: ROLE_ROOM_LOGO },
  { id: 'kit-ch', name: 'Creatorhub', accent: '#ffba6c', tagline: 'Dashboard · Showcase', ids: CH_KIT_IDS, logo: CREATORHUB_LOGO },
] as const;

// Sosial-optimaliserte maler (vertikal/kvadrat) — egen kategori.
const SOCIAL_IDS = new Set<string>(SOCIAL_TEMPLATE_IDS);
const CATEGORY_IDS: Record<string, Set<string>> = {
  social: SOCIAL_IDS, charts: CHART_IDS, marketing: MARKETING_IDS, filmtv: FILMTV_IDS,
  callouts: CALLOUT_IDS, ui: UI_IDS, uxlayout: UX_LAYOUT_IDS,
};
// Brand-kits matcher på id-PREFIKS (rr-/ch-) så alle branded maler auto-inkluderes.
const kitPrefix = (sec: string): string | null => (sec === 'kit-rr' ? 'rr-' : sec === 'kit-ch' ? 'ch-' : null);
const inCategory = (sec: string, id: string): boolean => {
  if (sec === 'custom') return isCustomTemplate(id);
  const pre = kitPrefix(sec);
  if (pre) return id.startsWith(pre);
  // Hovedkategorien «Templates» viser innebygde maler (ikke egne — de har egen fane).
  if (sec === 'templates') return !isCustomTemplate(id);
  return CATEGORY_IDS[sec] ? CATEGORY_IDS[sec].has(id) : true;
};
const CATEGORY_LABEL: Record<string, string> = {
  templates: 'Templates', social: 'Social', charts: 'Charts', marketing: 'Marketing', filmtv: 'Film & TV',
  callouts: 'Callouts', ui: 'UI-elementer', uxlayout: 'Layout & UX', 'kit-rr': 'The Role Room', 'kit-ch': 'Creatorhub', custom: 'Mine maler',
};

// Kategori-ikon for en mal (erstatter malens tekst-glyf i galleri + scene-stripe).
function tplIcon(id: string, size = 16): React.ReactElement {
  const st: React.CSSProperties = { fontSize: size };
  if (SOCIAL_IDS.has(id)) return <PhoneIphoneIcon style={st} />;
  if (CHART_IDS.has(id)) return <BarChartIcon style={st} />;
  if (MARKETING_IDS.has(id)) return <CampaignIcon style={st} />;
  if (FILMTV_IDS.has(id)) return <MovieIcon style={st} />;
  if (CALLOUT_IDS.has(id)) return <CenterFocusStrongIcon style={st} />;
  if (UI_IDS.has(id)) return <WidgetsIcon style={st} />;
  if (UX_LAYOUT_IDS.has(id)) return <ViewQuiltIcon style={st} />;
  return <GridViewIcon style={st} />;
}

type EntranceKind = 'none' | 'fade' | 'fadeup' | 'scale' | 'slideL' | 'slideR';
type EasingKind = 'linear' | 'out' | 'inout' | 'outcubic';
interface Scene {
  id: string; tplId: string; values: Record<string, string>; atSec: number;
  bindings?: Record<string, string>; posX?: number; posY?: number;
  /** Per-scene overstyringer (faller tilbake til prosjekt-default når tomme). */
  durSec?: number; accent?: string; logo?: string;
  /** Exit: sekunder fade-ut på slutten (0/udefinert = hardt kutt). */
  exitSec?: number;
  /** Valgfritt scene-navn (vises i tidslinje/strip; faller tilbake til malnavn). */
  name?: string;
  /** Inngangs-animasjon (ytre wrapper-effekt på hele overlay-en). */
  entrance?: EntranceKind;
  /** Easing-kurve som remapper progresjonen (preview + render). */
  easing?: EasingKind;
}

// Easing-kurver (remapper 0..1). Speiles i render (MJS) via samme navn.
const EASINGS: Record<EasingKind, (p: number) => number> = {
  linear: (p) => p,
  out: (p) => 1 - (1 - p) * (1 - p),
  inout: (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
  outcubic: (p) => 1 - Math.pow(1 - p, 3),
};
const EASING_LABEL: Record<EasingKind, string> = { linear: 'Lineær', out: 'Ease Out', inout: 'Ease In-Out', outcubic: 'Ease Out Cubic' };
const easeVal = (k: EasingKind | undefined, p: number): number => (EASINGS[k || 'outcubic'] || EASINGS.outcubic)(Math.max(0, Math.min(1, p)));

// Inngangs-preset: CSS-transform + opacity ut fra «inne-faktor» ef (0=før, 1=inne).
const ENTRANCE_LABEL: Record<EntranceKind, string> = { none: 'Ingen', fade: 'Fade', fadeup: 'Fade opp', scale: 'Skalér inn', slideL: 'Skyv fra venstre', slideR: 'Skyv fra høyre' };
const ENTRANCE_ORDER: EntranceKind[] = ['none', 'fade', 'fadeup', 'scale', 'slideL', 'slideR'];
function entranceStyle(kind: EntranceKind | undefined, ef: number): { transform: string; opacity: number } {
  const e = Math.max(0, Math.min(1, ef));
  switch (kind) {
    case 'fade': return { transform: 'none', opacity: e };
    case 'fadeup': return { transform: `translateY(${((1 - e) * 40).toFixed(1)}px)`, opacity: e };
    case 'scale': return { transform: `scale(${(0.86 + 0.14 * e).toFixed(4)})`, opacity: e };
    case 'slideL': return { transform: `translateX(${((1 - e) * -60).toFixed(1)}px)`, opacity: e };
    case 'slideR': return { transform: `translateX(${((1 - e) * 60).toFixed(1)}px)`, opacity: e };
    default: return { transform: 'none', opacity: 1 };
  }
}
const ENTRANCE_DUR = 0.5; // sekunder inngangen tar
let _sid = 1;
const newScene = (tplId: string, atSec: number): Scene => ({ id: `s${_sid++}`, tplId, values: {}, atSec, bindings: {} });
// Høyeste «s<N>»-id i et scene-sett (0 om ingen) — brukes for å reseede _sid forbi
// restaurerte scener så nye scene-id-er ikke kolliderer med dem etter reload.
function maxSceneId(scenes: Scene[] | undefined): number {
  let mx = 0;
  for (const s of scenes || []) { const m = /^s(\d+)$/.exec(s?.id || ''); if (m) mx = Math.max(mx, parseInt(m[1], 10)); }
  return mx;
}

// ── Persistering: hele studio-tilstanden overlever reload (før: alt i useState
//    → tapt ved refresh). Nøklet pr. prosjekt så flere demoer holdes adskilt. ──
const LS_PREFIX = 'trrpa.infographicStudio.';
interface StudioState { scenes: Scene[]; sel: number; accent: string; logo: string; dataText: string; palette: string[]; liveUrl?: string }
function loadStudio(key: string): StudioState | null {
  try { const raw = localStorage.getItem(LS_PREFIX + key); return raw ? (JSON.parse(raw) as StudioState) : null; } catch { return null; }
}
function saveStudio(key: string, s: StudioState): void {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(s)); } catch { /* full/blokkert — ikke-kritisk */ }
}

/** Norsk tallformat: 1234567 → «1 234 567», 12.5 → «12,5», bevarer fortegn +
 *  suffiks (%, T, kr …). Rører ikke strenger uten ledende tall. */
function localizeNumberNb(s: string): string {
  const m = String(s ?? '').match(/^\s*([-+]?)(\d[\d\s.,]*\d|\d)(.*)$/);
  if (!m) return s;
  const sign = m[1], raw = m[2].replace(/\s/g, ''), suffix = m[3];
  // Skill heltall/desimal (siste , eller . med 1-2 sifre = desimal).
  const dm = raw.match(/^(\d+)(?:[.,](\d+))?$/);
  if (!dm) return s;
  const intPart = dm[1].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const dec = dm[2] ? ',' + dm[2] : '';
  return `${sign}${intPart}${dec}${suffix}`;
}

/** Multi-rad-parsing: JSON-array eller CSV med header + N verdi-rader →
 *  { headers, rows: Record<string,string>[] }. For «én scene per rad». */
// CSV-linje-splitt som respekterer doble anførselstegn (RFC-4180): «"Oslo, Norge"»
// forblir ÉN celle, «""» = escaped quote. Uten dette forskyver et innebygd komma/
// semikolon (vanlig i publiserte Google Sheets + norsk desimalkomma) ALLE
// etterfølgende kolonner → systematisk feilmappet data.
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') { q = true; }
    else if (c === sep) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseDataRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const t = (text || '').trim();
  if (!t) return { headers: [], rows: [] };
  try {
    const j = JSON.parse(t);
    if (Array.isArray(j) && j.length && typeof j[0] === 'object') {
      const headers = Object.keys(j[0] as Record<string, unknown>);
      const rows = (j as Record<string, unknown>[]).map((o) => {
        const r: Record<string, string> = {};
        headers.forEach((h) => { const v = o[h]; r[h] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''); });
        return r;
      });
      return { headers, rows };
    }
  } catch { /* CSV */ }
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2) {
    const sep = lines[0].includes(';') ? ';' : ',';
    // IKKE filter(Boolean) her — det komprimerer header-indeksene mens cellene
    // fortsatt er posisjonelle → alt etter en tom header mappes til feil kolonne.
    // Behold posisjon, hopp over tomme headere per celle (samme som parseDataSource).
    const headers = splitCsvLine(lines[0], sep);
    const rows = lines.slice(1).map((ln) => {
      const cells = splitCsvLine(ln, sep);
      const r: Record<string, string> = {};
      headers.forEach((h, i) => { if (h) r[h] = cells[i] ?? ''; });
      return r;
    });
    return { headers: headers.filter(Boolean), rows };
  }
  return { headers: [], rows: [] };
}

/** Parse limt inn data (JSON-objekt eller CSV med header+verdi-rad) → flat
 *  key→value-kart for data-binding. */
function parseDataSource(text: string): Record<string, string> {
  const t = (text || '').trim();
  if (!t) return {};
  try {
    const j = JSON.parse(t);
    if (j && typeof j === 'object' && !Array.isArray(j)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(j)) out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return out;
    }
    if (Array.isArray(j) && j.length && typeof j[0] === 'object') {
      const out: Record<string, string> = {};
      Object.entries(j[0] as Record<string, unknown>).forEach(([k, v]) => { out[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? ''); });
      return out;
    }
  } catch { /* ikke JSON — prøv CSV */ }
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2) {
    const sep = lines[0].includes(';') ? ';' : ',';
    const heads = splitCsvLine(lines[0], sep);
    const vals = splitCsvLine(lines[1], sep);
    const out: Record<string, string> = {};
    heads.forEach((h, i) => { if (h) out[h] = vals[i] ?? ''; });
    return out;
  }
  // ev. "key: value" per linje
  const out: Record<string, string> = {};
  for (const l of lines) { const m = l.match(/^([^:=]+)[:=](.*)$/); if (m) out[m[1].trim()] = m[2].trim(); }
  return out;
}

/** Visuell Material-ikon-velger (søk + rutenett) — ingen teknisk skriving. */
function IconField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  // Kuratert sett vises uten søk; søk dekker HELE katalogen (2195 ikoner).
  const list = q ? ALL_MATERIAL_ICONS.filter((i) => i.includes(q.toLowerCase())).slice(0, 120) : MATERIAL_ICONS;
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 7, border: `1px solid ${D.line}`, background: D.bg, color: D.ink, cursor: 'pointer', fontSize: 12.5 }}>
        <span className="material-icons-outlined" style={{ fontSize: 20, color: D.accent }}>{value || 'help_outline'}</span>
        <span style={{ flex: 1, textAlign: 'left', color: value ? D.ink : D.faint }}>{value || 'velg ikon'}</span>
        <span style={{ color: D.faint }}>▾</span>
      </button>
      {open && (
        <div style={{ marginTop: 6, border: `1px solid ${D.line}`, borderRadius: 9, background: D.panel2, padding: 8 }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Søk ikon …"
            style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: `1px solid ${D.line}`, background: D.bg, color: D.ink, colorScheme: 'dark', marginBottom: 8 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {list.map((ic) => (
              <button key={ic} title={ic} onClick={() => { onChange(ic); setOpen(false); setQ(''); }}
                style={{ display: 'grid', placeItems: 'center', height: 34, borderRadius: 7, cursor: 'pointer', border: `1px solid ${value === ic ? D.accent : 'transparent'}`, background: value === ic ? D.bg : 'transparent', color: value === ic ? D.accent : D.soft }}>
                <span className="material-icons-outlined" style={{ fontSize: 19 }}>{ic}</span>
              </button>
            ))}
            {!list.length && <div style={{ gridColumn: '1/-1', fontSize: 11, color: D.faint, padding: 6 }}>Ingen treff</div>}
          </div>
        </div>
      )}
    </div>
  );
}

async function dominantColor(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const s = 28; const cv = document.createElement('canvas'); cv.width = s; cv.height = s;
        const ctx = cv.getContext('2d'); if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, s, s);
        const d = ctx.getImageData(0, 0, s, s).data;
        const bins: Record<string, { n: number; r: number; g: number; b: number }> = {};
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]; if (a < 160) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          if (mx > 244 && mn > 240) continue; if (mx < 24) continue;
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const bn = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
          bn.n++; bn.r += r; bn.g += g; bn.b += b;
        }
        let best: { r: number; g: number; b: number; score: number } | null = null;
        for (const k in bins) {
          const bn = bins[k]; const r = bn.r / bn.n, g = bn.g / bn.n, b = bn.b / bn.n;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          const score = bn.n * (1 + sat / 40);
          if (!best || score > best.score) best = { r, g, b, score };
        }
        if (!best) { resolve(''); return; }
        resolve('#' + [best.r, best.g, best.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join(''));
      } catch { resolve(''); }
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });
}

/** Analyser en logo (data-URL): dimensjoner, sideforhold og «luft» (andel
 *  transparent/near-hvit ramme rundt innholdet). Brukes til å foreslå
 *  lower-third-vennlig beskjæring. Null ved feil/tainted canvas. */
async function analyzeLogo(dataUrl: string): Promise<{ w: number; h: number; aspect: number; padRatio: number; box: { x: number; y: number; w: number; h: number } } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { resolve(null); return; }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, w, h).data;
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4, a = d[i + 3];
          const nearWhite = d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244;
          if (a > 24 && !nearWhite) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        if (maxX < 0) { resolve(null); return; } // tomt
        const bw = maxX - minX + 1, bh = maxY - minY + 1;
        const padRatio = 1 - (bw * bh) / (w * h);
        resolve({ w, h, aspect: bw / Math.max(1, bh), padRatio, box: { x: minX, y: minY, w: bw, h: bh } });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** Beskjær transparent/hvit luft rundt logoen (+ liten margin) → data-URL.
 *  Gjør en «for stor» logo lower-third-vennlig (tett, ingen tomrom). */
async function trimLogoWhitespace(dataUrl: string): Promise<string> {
  const a = await analyzeLogo(dataUrl);
  if (!a) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const m = Math.round(Math.max(a.box.w, a.box.h) * 0.06); // 6 % pust
        const cw = a.box.w + m * 2, ch = a.box.h + m * 2;
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        const ctx = cv.getContext('2d'); if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, a.box.x, a.box.y, a.box.w, a.box.h, m, m, a.box.w, a.box.h);
        resolve(cv.toDataURL('image/png'));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// JSON for injeksjon i inline <script> (window.__CFG__=…). Escaper `<` (hindrer at
// «</script>» eller «<!--» i et felt lukker skriptet) + linjeseparatorene U+2028/
// U+2029 (gyldige i JSON, men bryter en JS-streng). Uten dette taper et felt som
// inneholder «</script>» ALL scene-data i preview OG render (__CFG__ blir udefinert).
function cfgScript(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Lett live-thumbnail av en mal i galleriet: lazy iframe (kun når synlig),
 *  rå HTML u/ font-injeksjon, skalert til å passe + frosset ved p=1. */
// Selvstendig fit-skript injisert i preview/thumbnail-iframen. Måler #wrap og
// skalerer det til å passe iframens EGEN viewport (= canvas/thumb-boks),
// sentrerer, og tvinger html+body transparent. Kjører INNE i iframen → robust i
// WKWebView (ingen kryss-dokument-manipulering fra foreldre, som feilet før).
// window.__igFreeze=1 → frys ved setProgress(1) (thumbnails uten play-animasjon).
const FIT_SCRIPT = `(function(){
  // fitTo(vw,vh): skalér #wrap inn i en boks. Foreldre gir iframens EKTE størrelse
  // (iframe.clientWidth/Height) via __igFitTo — en srcdoc-iframe kan i WKWebView
  // IKKE måle sin egen viewport pålitelig (window.innerHeight kan bli 0 → negativ
  // scale → blankt lerret, eller for stor → innhold skjøvet ut av syne). Selv-mål
  // (innerWidth/Height) er fallback for Chromium/på-lasting.
  function fitTo(vw,vh){
    try{
      document.documentElement.style.background='transparent';
      var b=document.body; if(b){b.style.margin='0';b.style.overflow='hidden';b.style.background='transparent';b.style.position='relative';}
      if(window.__igFreeze && typeof window.setProgress==='function'){ try{window.setProgress(1);}catch(e){} }
      var w=document.getElementById('wrap'); if(!w) return;
      // Grid-sentrering feiler når #wrap er bredere enn viewporten. Posisjonér
      // absolutt + translate-sentrer den SKALERTE størrelsen (transform-origin top-left).
      w.style.position='absolute'; w.style.top='0'; w.style.left='0';
      w.style.transformOrigin='top left'; w.style.transform='none';
      vw = vw || window.innerWidth || document.documentElement.clientWidth || 1;
      vh = vh || window.innerHeight || document.documentElement.clientHeight || 1;
      var ww=w.scrollWidth||w.offsetWidth||1, wh=w.scrollHeight||w.offsetHeight||1;
      var k=Math.min(1,(vw-16)/ww,(vh-16)/wh);
      if(!(k>0)) k=Math.min(1,(vw-16)/ww); // vh upålitelig → fall tilbake til bredde-fit
      if(!(k>0)) k=1;                       // fortsatt ugyldig → ingen skalering (aldri blankt)
      var tx=(vw-ww*k)/2, ty=Math.max(0,(vh-wh*k)/2);
      w.style.transform='translate('+tx.toFixed(1)+'px,'+ty.toFixed(1)+'px) scale('+k.toFixed(4)+')';
    }catch(e){}
  }
  function fit(){ fitTo(0,0); }
  if(document.readyState==='complete') fit(); else window.addEventListener('load',fit);
  [80,250,600,1100].forEach(function(d){setTimeout(fit,d);});
  window.addEventListener('resize',fit);
  window.__igFit=fit;
  window.__igFitTo=fitTo;
  // Inngangs-/exit-bevegelse settes via denne funksjonen (kall på contentWindow),
  // IKKE ved at foreldre skriver til iframe-DOM-en — det feiler stille i WKWebView.
  // body bærer inngangs-transformen (komponerer med #wrap sin fit-scale), #wrap
  // bærer opacity (inngang × exit).
  window.__igMotion=function(tf,op){try{
    var b=document.body; if(b){b.style.transform=tf||'none'; b.style.transformOrigin='center center';}
    var w=document.getElementById('wrap'); if(w){ w.style.opacity=String(op); }
  }catch(e){}};
})();`;

function TemplateThumb({ tpl, accent, values, height = 88 }: { tpl: InfographicTemplate; accent: string; values?: Record<string, string>; height?: number }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el); return () => io.disconnect();
  }, []);
  const src = useMemo(() => {
    const cfg = buildInfographicConfig(tpl, values || {}, { accent, ink: '#1f2d4a' });
    // __igFreeze=1: frys ved setProgress(1) (ingen play-animasjon i thumbnail).
    // FIT_SCRIPT måler + skalerer INNE i iframen (robust i WKWebView).
    return `<script>window.__CFG__=${cfgScript(cfg)};window.__igFreeze=1;</script>` + rawTemplateHtml(tpl) + `<script>${FIT_SCRIPT}</script>`;
  }, [tpl, accent, values]);
  // Nudge det injiserte fit-skriptet (kjører uansett selv på load + retries).
  const fit = () => { try { const el = frameRef.current; const w = el?.contentWindow as unknown as { __igFitTo?: (w: number, h: number) => void; __igFit?: () => void } | null | undefined; if (w?.__igFitTo && el) w.__igFitTo(el.clientWidth, el.clientHeight); else w?.__igFit?.(); } catch { /* */ } };
  return (
    <div ref={boxRef} style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden', background: 'linear-gradient(135deg,#10182a,#0b1120)', marginBottom: 8 }}>
      {visible && <iframe ref={frameRef} title="" srcDoc={src} onLoad={() => { window.setTimeout(fit, 120); window.setTimeout(fit, 480); }} style={{ width: '100%', height: '100%', border: 0, background: 'transparent', pointerEvents: 'none' }} />}
    </div>
  );
}

// Enhets-mockup ut fra forhold: portrett = telefon, kvadrat/4:5 = feed-innlegg,
// bredt = nettleser/desktop.
type DeviceKind = 'phone' | 'post' | 'browser';
function deviceForAspect(aspect: number): DeviceKind {
  if (aspect < 0.9) return 'phone';
  if (aspect > 1.1) return 'browser';
  return 'post';
}

// Plasserings-anbefaling ut fra mal-kategori + format (trygge soner der plattform-
// UI/caption ligger). Kort, handlingsrettet.
function placementAdviceFor(id: string, aspect: number): string {
  const tall = aspect < 0.9;
  if (FILMTV_IDS.has(id)) return tall ? 'Lower-third: nedre tredjedel, men over plattform-UI (~15 % fra bunn).' : 'Lower-third: nedre venstre, klar av nedre tredjedel.';
  if (CALLOUT_IDS.has(id)) return 'Callout: pek mot elementet; hold pil + boks i midtre 80 %.';
  if (CHART_IDS.has(id)) return tall ? 'Graf: sentrer vertikalt; unngå øvre 10 % og nedre 20 %.' : 'Graf: sentrer — god plass i bredformat.';
  if (MARKETING_IDS.has(id)) return tall ? 'Hook øvre-midtre, CTA i nedre trygge sone.' : 'Sentrer; hold tekst i midtre 80 %.';
  return tall ? 'Hold i midtre 80 % — unngå topp/bunn (status + caption/UI).' : 'Sentrer i trygg sone (midtre 90 %).';
}

// Plattform-UI-soner: der TikTok/Instagram/YouTube legger EGNE elementer oppå
// videoen (fraksjoner av rammen). Brukes til å tegne sonene + advare når
// infographic-en havner under dem. Koordinatene følger publiserte «safe area»-
// spesifikasjoner for 1080×1920 (TikTok/Reels/Stories) og 1920×1080 (YouTube):
// TikTok ~topp 130px, bunn ~483px, høyre ~120px. Estimater — lett å finjustere.
interface UiZone { x: number; y: number; w: number; h: number; label: string }
interface SocialPlatform { id: string; name: string; sub: string; aspect: number; fmt: 'native' | '9:16' | '4:5' | '1:1' | '16:9'; zones: UiZone[] }
const PLATFORMS: SocialPlatform[] = [
  { id: 'tiktok', name: 'TikTok', sub: '9:16', aspect: 9 / 16, fmt: '9:16', zones: [
    // Handlingsrad (like/kommentar/del/lyd) ~høyre 120px, y ~925–1720 av 1920.
    { x: 0.89, y: 0.48, w: 0.11, h: 0.42, label: 'Handlinger' },
    // Caption/brukernavn/musikk-ticker — nedre ~25 % (≈483px), venstre for raden.
    { x: 0, y: 0.75, w: 0.88, h: 0.25, label: 'Caption · musikk' },
    // For You/Følger-faner øverst (~topp 130px = 7 %).
    { x: 0.28, y: 0.01, w: 0.44, h: 0.055, label: 'Faner' },
  ] },
  { id: 'reels', name: 'IG Reels', sub: '9:16', aspect: 9 / 16, fmt: '9:16', zones: [
    { x: 0.88, y: 0.50, w: 0.12, h: 0.38, label: 'Handlinger' },
    // Caption + lyd-ticker + fremdrift nederst ~20 %.
    { x: 0, y: 0.80, w: 0.82, h: 0.20, label: 'Caption · lyd' },
  ] },
  { id: 'stories', name: 'IG Stories', sub: '9:16', aspect: 9 / 16, fmt: '9:16', zones: [
    // Progress-linjer + profil øverst ~250px (13 %); «send melding» nederst ~14 %.
    { x: 0, y: 0, w: 1, h: 0.13, label: 'Profil · linjer' },
    { x: 0, y: 0.86, w: 1, h: 0.14, label: 'Send melding' },
  ] },
  { id: 'feed45', name: 'IG Feed', sub: '4:5 portrett', aspect: 4 / 5, fmt: '4:5', zones: [] },
  { id: 'feed11', name: 'IG Feed', sub: '1:1 kvadrat', aspect: 1, fmt: '1:1', zones: [] },
  { id: 'youtube', name: 'YouTube', sub: '16:9', aspect: 16 / 9, fmt: '16:9', zones: [
    // Kontroller/fremdrift nederst ~10 % (vises ved hover/pause).
    { x: 0, y: 0.90, w: 1, h: 0.10, label: 'Kontroller' },
  ] },
];

// Side-ved-side format-forhåndsvisning: samme innhold komponert inn i ett
// sosialt forhold, frosset ved sluttbildet (p=1) — akkurat slik render-en
// legger #wrap inn i lerretet. Tegner plattformens UI-soner, oppdager kollisjon
// (advarer når innholdet havner under UI), enhets-mockup + anbefaling. Klikkbar.
// Realistisk plattform-UI-chrome oppå format-forhåndsvisningen: i stedet for bare
// røde faresoner tegner vi det FAKTISKE TikTok/IG/YouTube-grensesnittet rundt
// infographic-en, så man ser hvordan den ser ut i ekte app-kontekst. `hot(label)`
// gir rød ring på et element når innholdet faktisk kolliderer med den sonen.
function PlatformChrome({ id, hot }: { id: string; hot: (label: string) => boolean }) {
  const shell: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', color: '#fff' };
  const ring = (on: boolean): React.CSSProperties => (on ? { boxShadow: '0 0 0 2px rgba(240,104,95,.95)', borderRadius: 10 } : {});
  const ico: React.CSSProperties = { fontSize: 15, color: '#fff' };
  const railBtn = (icon: React.ReactNode, txt: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ width: 26, height: 26, borderRadius: 13, background: 'rgba(255,255,255,.18)', display: 'grid', placeItems: 'center' }}>{icon}</div>
      <span style={{ fontSize: 7.5, fontWeight: 600 }}>{txt}</span>
    </div>
  );

  if (id === 'tiktok' || id === 'reels') {
    const isTk = id === 'tiktok';
    return (
      <div style={shell}>
        {isTk && (
          <div style={{ position: 'absolute', top: '2%', left: 0, right: 0, display: 'flex', gap: 12, justifyContent: 'center', fontSize: 9, fontWeight: 600, ...ring(hot('Faner')) }}>
            <span style={{ opacity: .6 }}>Følger</span>
            <span style={{ borderBottom: '1.5px solid #fff', paddingBottom: 1 }}>For deg</span>
          </div>
        )}
        <div style={{ position: 'absolute', right: '3%', bottom: '15%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, ...ring(hot('Handlinger')) }}>
          <div style={{ position: 'relative', width: 28, height: 28, borderRadius: 14, background: 'linear-gradient(135deg,#ff8c5d,#a855f7)', border: '1.5px solid #fff' }}>
            <span style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: 6, background: '#ff4060', color: '#fff', fontSize: 10, lineHeight: '12px', textAlign: 'center', fontWeight: 700 }}>+</span>
          </div>
          {railBtn(<FavoriteIcon style={ico} />, '12,4t')}
          {railBtn(<ChatBubbleOutlineIcon style={ico} />, '843')}
          {isTk && railBtn(<BookmarkBorderIcon style={ico} />, '1,1t')}
          {railBtn(isTk ? <ReplyIcon style={{ ...ico, transform: 'scaleX(-1)' }} /> : <SendIcon style={ico} />, 'Del')}
          {isTk && <div style={{ width: 26, height: 26, borderRadius: 13, background: 'conic-gradient(#333,#111,#333)', border: '3px solid #0a0a0a' }} />}
        </div>
        <div style={{ position: 'absolute', left: '4%', right: '24%', bottom: '4%', ...ring(hot(isTk ? 'Caption · musikk' : 'Caption · lyd')) }}>
          <div style={{ fontSize: 10, fontWeight: 700 }}>@dentum.no</div>
          <div style={{ fontSize: 8.5, lineHeight: 1.3, marginTop: 2, opacity: .95, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>3 av 4 pasienter fullfører digital innsjekk 📈</div>
          <div style={{ fontSize: 8, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3, opacity: .9 }}><MusicNoteIcon style={{ fontSize: 10 }} /> Original lyd — dentum.no</div>
        </div>
      </div>
    );
  }

  if (id === 'stories') {
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', top: '2.5%', left: '4%', right: '4%', ...ring(hot('Profil · linjer')) }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[1, 0.35, 0, 0].map((f, i) => (
              <div key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,.35)', overflow: 'hidden' }}>
                <div style={{ width: `${f * 100}%`, height: '100%', background: '#fff' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: 'linear-gradient(135deg,#ff8c5d,#a855f7)', border: '1.5px solid #fff' }} />
            <span style={{ fontSize: 9, fontWeight: 700 }}>dentum.no</span>
            <span style={{ fontSize: 8, opacity: .7 }}>2t</span>
          </div>
        </div>
        <div style={{ position: 'absolute', left: '4%', right: '4%', bottom: '3.5%', display: 'flex', alignItems: 'center', gap: 6, ...ring(hot('Send melding')) }}>
          <div style={{ flex: 1, height: 22, borderRadius: 11, border: '1.5px solid rgba(255,255,255,.6)', display: 'flex', alignItems: 'center', paddingLeft: 9, fontSize: 8.5, opacity: .8 }}>Send melding</div>
          <FavoriteBorderIcon style={{ fontSize: 15 }} />
          <SendIcon style={{ fontSize: 15 }} />
        </div>
      </div>
    );
  }

  if (id === 'youtube') {
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '22%', background: 'linear-gradient(to top, rgba(0,0,0,.55), transparent)', ...ring(hot('Kontroller')) }}>
          <div style={{ position: 'absolute', left: '3%', right: '3%', bottom: '32%', height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,.3)' }}>
            <div style={{ width: '38%', height: '100%', background: '#ff0033', borderRadius: 2, position: 'relative' }}>
              <div style={{ position: 'absolute', right: -4, top: -3, width: 8, height: 8, borderRadius: 4, background: '#ff0033' }} />
            </div>
          </div>
          <div style={{ position: 'absolute', left: '3%', bottom: '7%', display: 'flex', alignItems: 'center', gap: 8 }}>
            <PlayArrowIcon style={{ fontSize: 16 }} />
            <span style={{ fontSize: 8.5, opacity: .95 }}>1:24 / 3:40</span>
          </div>
          <FullscreenIcon style={{ position: 'absolute', right: '3%', bottom: '7%', fontSize: 15 }} />
        </div>
      </div>
    );
  }

  return null;
}

function FormatPreview(
  { srcDoc, aspect, label, sub, bg, active, mockup, advice, zones, platform, onClick }:
  { srcDoc: string; aspect: number; label: string; sub: string; bg: string; active: boolean; mockup: boolean; advice: string; zones: UiZone[]; platform: string; onClick: () => void },
) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [warn, setWarn] = useState<string[]>([]);
  const fit = () => {
    // Sentrering + skalering gjøres av det injiserte FIT_SCRIPT INNE i iframen
    // (robust i WKWebView). Her: frys ved sluttbildet + les den faktisk rendrede
    // innholds-boksen for kollisjons-sjekk (best-effort — degraderer til «ingen
    // advarsel» hvis kryss-dokument-lesing er blokkert).
    try {
      const ifr = ref.current;
      // Send iframens EKTE størrelse inn (funksjonskall → WKWebView-robust), FØR
      // den valgfrie kryss-dokument-lesingen (kan være blokkert i WKWebView).
      if (ifr) { (ifr.contentWindow as unknown as { __igFitTo?: (w: number, h: number) => void })?.__igFitTo?.(ifr.clientWidth, ifr.clientHeight); }
      const doc = ifr?.contentDocument;
      const w = doc?.getElementById('wrap') as HTMLElement | null;
      if (!ifr || !doc || !w) return;
      (ifr.contentWindow as unknown as { setProgress?: (p: number) => void })?.setProgress?.(1);
      const cw = ifr.clientWidth || 1, ch = ifr.clientHeight || 1;
      const r = w.getBoundingClientRect();
      const cb = { x: r.left / cw, y: r.top / ch, w: r.width / cw, h: r.height / ch };
      const area = (cb.w * cb.h) || 1;
      const hit = zones.filter((z) => {
        const ix = Math.max(0, Math.min(cb.x + cb.w, z.x + z.w) - Math.max(cb.x, z.x));
        const iy = Math.max(0, Math.min(cb.y + cb.h, z.y + z.h) - Math.max(cb.y, z.y));
        return (ix * iy) / area > 0.05;
      }).map((z) => z.label);
      setWarn(hit);
    } catch { /* */ }
  };
  const device = deviceForAspect(aspect);
  // Skjerm = selve infographic-forholdet (bakgrunn + iframe + plattform-soner).
  const screen = (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', height: '100%', aspectRatio: String(aspect), background: bg ? '#000' : 'linear-gradient(135deg,#10182a,#0b1120)', borderRadius: mockup && device === 'phone' ? 26 : 6 }}>
      {bg && <img src={bg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />}
      <iframe ref={ref} title={label} srcDoc={srcDoc} onLoad={() => { window.setTimeout(fit, 200); window.setTimeout(fit, 800); }} style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', border: 0, background: 'transparent', pointerEvents: 'none' }} />
      {/* Mockup PÅ → realistisk plattform-chrome (ekte TikTok/IG/YT-UI, rød ring
          der innholdet kolliderer). Mockup AV → analytiske safe-soner (rå bokser). */}
      {mockup
        ? <PlatformChrome id={platform} hot={(label) => warn.includes(label)} />
        : zones.map((z, i) => {
            const collides = warn.includes(z.label);
            return (
              <div key={i} style={{ position: 'absolute', left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%`, zIndex: 2, background: collides ? 'rgba(240,104,95,.30)' : 'rgba(240,104,95,.12)', border: `1px ${collides ? 'solid' : 'dashed'} rgba(240,104,95,${collides ? 0.9 : 0.5})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 8, color: 'rgba(255,220,215,.9)', fontWeight: 600, textAlign: 'center', lineHeight: 1 }}>{z.label}</span>
              </div>
            );
          })}
      {/* Enhets-chrome oppå skjermen. */}
      {mockup && device === 'phone' && <>
        <div style={{ position: 'absolute', top: 7, left: '50%', transform: 'translateX(-50%)', width: '34%', height: 12, borderRadius: 8, background: '#05070c', zIndex: 4 }} />
        <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: '30%', height: 4, borderRadius: 3, background: 'rgba(255,255,255,.6)', zIndex: 4 }} />
      </>}
    </div>
  );
  const framed =
    mockup && device === 'phone'
      ? <div style={{ height: '100%', padding: 5, borderRadius: 30, background: '#0b0e14', border: `2px solid ${active ? '#3b82f6' : '#2a3350'}`, boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>{screen}</div>
      : mockup && device === 'browser'
        ? <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', border: `2px solid ${active ? '#3b82f6' : '#2a3350'}`, background: '#0b0e14' }}>
            <div style={{ height: 16, display: 'flex', alignItems: 'center', gap: 4, padding: '0 7px', background: '#141b2b', flex: 'none' }}>
              {['#f0685f', '#f6bd3b', '#4fc76b'].map((c) => <span key={c} style={{ width: 6, height: 6, borderRadius: 3, background: c }} />)}
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>{screen}</div>
          </div>
        : mockup /* post */
          ? <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', border: `2px solid ${active ? '#3b82f6' : '#2a3350'}`, background: '#141b2b' }}>
              <div style={{ height: 20, display: 'flex', alignItems: 'center', gap: 5, padding: '0 7px', flex: 'none' }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: 'linear-gradient(135deg,#f0685f,#a855f7)' }} />
                <span style={{ width: 44, height: 5, borderRadius: 3, background: '#2a3350' }} />
              </div>
              <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>{screen}</div>
              <div style={{ height: 16, display: 'flex', alignItems: 'center', gap: 6, padding: '0 7px', flex: 'none', color: '#8a98b5' }}>
                <FavoriteBorderIcon style={{ fontSize: 11 }} /><ChatBubbleOutlineIcon style={{ fontSize: 11 }} /><SendIcon style={{ fontSize: 11 }} />
              </div>
            </div>
          : <div style={{ height: '100%', borderRadius: 8, overflow: 'hidden', border: `2px solid ${active ? '#3b82f6' : '#27314a'}` }}>{screen}</div>;
  return (
    <div onClick={onClick} title={`Velg ${label}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', cursor: 'pointer', flex: 'none', maxWidth: 260 }}>
      <div style={{ flex: 1, minHeight: 0 }}>{framed}</div>
      <div style={{ textAlign: 'center', maxWidth: 190 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: active ? '#e8eefc' : '#8a98b5' }}>{label} <span style={{ fontWeight: 500, color: '#5d6b88' }}>· {sub}</span></div>
        {warn.length > 0
          ? <div style={{ fontSize: 9.5, color: '#f0a89f', lineHeight: 1.35, marginTop: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}><WarningAmberIcon style={{ fontSize: 11 }} /> Dekkes av {warn.join(' + ')} — flytt innhold</div>
          : <div style={{ fontSize: 9.5, color: '#7c8bad', lineHeight: 1.35, marginTop: 2 }}>{advice}</div>}
      </div>
    </div>
  );
}

export function InfographicStudioView(
  { onNav, standalone = false, onOpenDemoStudio }:
  { onNav: (id: string) => void; standalone?: boolean; onOpenDemoStudio?: () => void },
) {
  const project = useDemoStudio((s) => s.project);
  const storeKey = project?.id || 'standalone';
  // Gjenopprett lagret studio-tilstand (én gang) — ellers starter alt tomt ved reload.
  const initial = useRef<StudioState | null>(loadStudio(storeKey));
  // Reseed scene-id-telleren forbi de restaurerte scenene (som beholder sine gamle
  // «s1», «s2» …). Uten dette lager addScene/duplicateScene id-er som kolliderer.
  const seededSid = useRef(false);
  if (!seededSid.current) { seededSid.current = true; _sid = Math.max(_sid, maxSceneId(initial.current?.scenes) + 1); }
  const [scenes, setScenes] = useState<Scene[]>(() => initial.current?.scenes?.length ? initial.current.scenes : [newScene(INFOGRAPHIC_TEMPLATES[0].id, 0)]);
  const [sel, setSel] = useState(() => Math.min(initial.current?.sel ?? 0, (initial.current?.scenes?.length ?? 1) - 1));
  const scene = scenes[sel] || scenes[0];
  const tpl: InfographicTemplate = useMemo(
    () => INFOGRAPHIC_TEMPLATES.find((t) => t.id === scene.tplId) || INFOGRAPHIC_TEMPLATES[0], [scene.tplId]);

  // Prosjekt-default brand; per-scene kan overstyre (scene.accent/scene.logo).
  const [accent, setAccent] = useState<string>(initial.current?.accent || project?.branding?.brandColor || '#3b82f6');
  const [logo, setLogo] = useState<string>(() => { if (initial.current?.logo) return initial.current.logo; const u = project?.branding?.logoUrl; return u && u.startsWith('data:') ? u : ''; });
  const sceneAccent = (sc: Scene) => sc.accent || accent;
  const sceneLogo = (sc: Scene) => sc.logo ?? logo;
  const effDur = (sc: Scene, t: InfographicTemplate) => (sc.durSec != null && sc.durSec > 0 ? sc.durSec : t.durationSec);
  // Sosialt format → eksakte lerret-dimensjoner («WxH») eller 'native'. Kvalitets-
  // multiplikator fra oppløsnings-valget (1080p→×1, 1440p→×1.5, 4K→×2).
  const frameArg = (): string => {
    if (fmt === 'native') return 'native';
    const base = fmt === '9:16' ? [1080, 1920] : fmt === '4:5' ? [1080, 1350] : fmt === '1:1' ? [1080, 1080] : [1920, 1080];
    const mult = scale >= 4 ? 2 : scale >= 3 ? 1.5 : 1;
    return `${Math.round(base[0] * mult)}x${Math.round(base[1] * mult)}`;
  };
  const fmtAspect = (): number => (fmt === '9:16' ? 9 / 16 : fmt === '4:5' ? 4 / 5 : fmt === '16:9' ? 16 / 9 : 1);
  // «Innsikt»: hent aggregert bevis fra backend på at modellen lærer i drift.
  const loadInsight = async () => {
    setInsightBusy(true);
    try {
      const r = await fetchInsight();
      setInsight(r);
      if (!r) setMsg('Ingen innsikt tilgjengelig (krever innlogging, eller ingen signaler enda).');
    } finally { setInsightBusy(false); }
  };
  const [suggested, setSuggested] = useState('');
  const [rightTab, setRightTab] = useState<'Design' | 'Animate' | 'Data'>('Data');
  const [leftSec, setLeftSec] = useState<'templates' | 'social' | 'charts' | 'marketing' | 'filmtv' | 'callouts' | 'ui' | 'uxlayout' | 'kit-rr' | 'kit-ch' | 'custom' | 'library' | 'insight' | 'brand' | 'data' | 'export'>('templates');
  const [tplQuery, setTplQuery] = useState('');
  const [dataText, setDataText] = useState(initial.current?.dataText || '');
  // Live datakilde: URL (JSON/CSV) hentet via Rust (ingen CORS) → dataText.
  const [liveUrl, setLiveUrl] = useState(initial.current?.liveUrl || '');
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const dataMap = useMemo(() => parseDataSource(dataText), [dataText]);
  const dataKeys = useMemo(() => Object.keys(dataMap), [dataMap]);
  const [palette, setPalette] = useState<string[]>(initial.current?.palette?.length ? initial.current.palette : ['#2dd4bf', '#3b82f6', '#ffffff', '#1f2d4a', '#f59e0b', '#a855f7']);
  const [busy, setBusy] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ done: number; total: number } | null>(null);
  const [needsPlaywright, setNeedsPlaywright] = useState(false);
  // Render/eksport-innstillinger (bølge 2): oppløsning, fps, tallformat,
  // fil-eksport-format, Resolve-overlay-spor.
  const [scale, setScale] = useState(2); // deviceScaleFactor: 2≈1080p, 4≈4K
  const [fps, setFps] = useState(30);
  const [localizeNb, setLocalizeNb] = useState(false);
  const [exportFmt, setExportFmt] = useState<'prores' | 'mp4' | 'gif' | 'apng' | 'png'>('mp4');
  const [exportBusy, setExportBusy] = useState(false);
  const [overlayTrack, setOverlayTrack] = useState(2);
  // Polish: bygg metadata inn i eksportfila, sammenleggbar rail, loop-avspilling,
  // autolagret-indikator (relativ tid, oppdateres av nowTick).
  const [includeMeta, setIncludeMeta] = useState(true);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [loopAll, setLoopAll] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(0);
  // Sosialt format-preset: styrer lerret-forholdet på rendret/eksportert overlay.
  // 'native' = malens naturlige størrelse (bakoverkompatibelt). Ellers komponeres
  // innholdet inn i 9:16 / 1:1 / 16:9 og PNG-en får eksakt de dimensjonene.
  const [fmt, setFmt] = useState<'native' | '9:16' | '4:5' | '1:1' | '16:9'>('native');
  // «Alle formater»: side-ved-side-forhåndsvisning av alle sosiale forhold.
  const [multiPreview, setMultiPreview] = useState(false);
  const [showCampaign, setShowCampaign] = useState(false);
  const [showSystemArch, setShowSystemArch] = useState(false);
  const [showMotion, setShowMotion] = useState(false);
  // Enhets-mockup (iPhone/feed/nettleser) i side-ved-side-visningen.
  const [mockup, setMockup] = useState(true);
  // «Innsikt»: aggregert bevis fra backend på at modellen lærer i drift.
  const [insight, setInsight] = useState<CollectiveInsight | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  // Composite-preview: still fra videoen bak den transparente overlay-en, så du
  // ser hvordan den lander over ekte film (kontrast/lesbarhet). Kun preview.
  const [bgImage, setBgImage] = useState('');
  // Bølge 4: AI-mal-valg + egne maler.
  const [aiDesc, setAiDesc] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  // Siste AI-anbefaling → tommel opp/ned mater lærings-loopen (few-shot + re-rangering).
  const [aiLastPick, setAiLastPick] = useState<{ desc: string; tplId: string } | null>(null);
  // Logo fra nettside: flere kandidater → velg; «for stor» → foreslå trimming.
  const [logoChoices, setLogoChoices] = useState<string[]>([]);
  const [logoHint, setLogoHint] = useState<string | null>(null);
  // Dypere Brand Kit: farger + fonter hentet fra siden (vises som «Merke fra nettside»).
  const [siteBrand, setSiteBrand] = useState<{ palette: string[]; fonts: string[] } | null>(null);

  /** Sett en logo (embed som data-URL) + sjekk om den er lower-third-vennlig →
   *  foreslå trimming ved mye tomrom / ekstremt sideforhold. */
  const applyLogo = async (url: string) => {
    setLogoChoices([]);
    const dl = await logoToDataUrl(url).catch(() => url);
    setLogo(dl);
    const a = await analyzeLogo(dl).catch(() => null);
    if (a && (a.padRatio > 0.32 || a.aspect > 4 || a.aspect < 0.45)) {
      setLogoHint(a.aspect > 4 ? 'Logoen er veldig bred for en lower-third' : a.aspect < 0.45 ? 'Logoen er veldig høy/smal' : 'Logoen har mye tomrom rundt seg');
    } else setLogoHint(null);
  };
  const trimLogo = async () => {
    if (!logo) return;
    const dl = await trimLogoWhitespace(logo).catch(() => logo);
    setLogo(dl); setLogoHint(null); setMsg('Logo beskåret — se preview.');
  };
  const [importName, setImportName] = useState('');
  const [importHtml, setImportHtml] = useState('');
  const [customTick, setCustomTick] = useState(0); // tving re-render etter mal-import/-slett
  void customTick;
  // «Mine infographics»: globalt bibliotek av ferdige infographics → start fra en
  // tidligere i stedet for blank mal (åpne, dupliser, bygg videre).
  const [libTick, setLibTick] = useState(0);
  const [libName, setLibName] = useState('');
  const savedList = useMemo<SavedInfographic[]>(() => listInfographics(), [libTick, leftSec]);
  /** Lagre gjeldende studio-tilstand som gjenbrukbar infographic i biblioteket. */
  const saveCurrentToLibrary = () => {
    const name = libName.trim() || `${project?.name || 'Infographic'} · ${scenes.length} scene(r)`;
    const tpl0 = INFOGRAPHIC_TEMPLATES.find((x) => x.id === scenes[0]?.tplId) || INFOGRAPHIC_TEMPLATES[0];
    const saved = saveInfographic({
      name, fromProject: project?.name,
      scenes: scenes.map((s) => ({ ...s })), accent, logo, dataText, palette, liveUrl,
      // Miniatyren rendrer FØRSTE scene → previewTplId MÅ være scene 0s mal, og
      // previewValues = de BINDING-OPPLØSTE verdiene (fieldVals) så kortet viser de
      // faktiske tallene, ikke rå placeholders.
      previewTplId: scenes[0]?.tplId || INFOGRAPHIC_TEMPLATES[0].id,
      previewValues: scenes[0] ? fieldVals(scenes[0], tpl0) : {},
    });
    setLibName(''); setLibTick((n) => n + 1);
    setMsg(saved
      ? `Lagret «${name}» i biblioteket — gjenbruk den i ethvert prosjekt.`
      : 'Kunne ikke lagre — lokal lagring er full. Slett noen tidligere infographics og prøv igjen.');
  };
  /** Åpne et lagret snapshot inn i studioet (erstatter gjeldende scener). Scene-
   *  id-er regenereres så de ikke kolliderer med nye scener. */
  const loadSnapshot = (s: SavedInfographic) => {
    const fresh = s.scenes.map((sc) => ({ ...sc, id: `s${_sid++}` })) as Scene[];
    setScenes(fresh.length ? fresh : [newScene(INFOGRAPHIC_TEMPLATES[0].id, 0)]);
    setSel(0);
    setAccent(s.accent || accent);
    setLogo(s.logo || '');
    setDataText(s.dataText || '');
    setLiveUrl(s.liveUrl || ''); // gjenopprett kildens URL — og NULLSTILL den om snapshotet ikke har en (ellers henger forrige datakilde igjen)
    if (s.palette?.length) setPalette(s.palette);
    setLeftSec('templates');
    setMsg(`Åpnet «${s.name}» — bygg videre og send til Resolve.`);
  };
  // Team-delt bibliotek (backend): del egne + bla i det hele teamet har delt.
  const [teamList, setTeamList] = useState<TeamInfographic[]>([]);
  const [teamBusy, setTeamBusy] = useState(false);
  const loadTeamLibrary = async () => {
    if (!canShareToTeam()) return;
    setTeamBusy(true);
    try { setTeamList(await fetchTeamLibrary()); } finally { setTeamBusy(false); }
  };
  // Åpne en team-delt infographic: hent hele snapshotet lazy (listen bærer kun et
  // lett preview), og last det inn i studioet.
  const openTeam = async (s: TeamInfographic) => {
    setMsg(`Henter «${s.name}» …`);
    const full = await fetchTeamSnapshot(s.id);
    if (full) loadSnapshot(full); else setMsg('Kunne ikke hente den delte infographic-en — prøv igjen.');
  };
  const shareEntry = async (s: SavedInfographic) => {
    if (!canShareToTeam()) { setMsg('Deling krever innlogging (Role Room-token i Innstillinger).'); return; }
    setMsg(`Deler «${s.name}» med teamet …`);
    const ok = await shareToTeam(s);
    setMsg(ok ? `Delte «${s.name}» — nå synlig for hele teamet.` : 'Feil ved deling — prøv igjen.');
    if (ok) void loadTeamLibrary();
  };
  const cancelRef = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  // Undertrykk enkelt-scene-autoplay ved iframe-last når vi spiller HELE sekvensen
  // eller nettopp scrubbet — ellers starter en konkurrerende rAF fra p=0 som slåss
  // mot playAll og overskriver scrub-posisjonen (to rAF-løkker på samme iframe).
  const playingAllRef = useRef(false);
  const recentScrubRef = useRef(0);

  // Autolagre (debounced) — hele tilstanden overlever reload. Setter lastSavedAt
  // for «Autolagret»-indikatoren i toppen.
  useEffect(() => {
    const h = setTimeout(() => { saveStudio(storeKey, { scenes, sel, accent, logo, dataText, palette, liveUrl }); setLastSavedAt(Date.now()); }, 400);
    return () => clearTimeout(h);
  }, [scenes, sel, accent, logo, dataText, palette, liveUrl, storeKey]);
  // Tikk hvert 20. sekund så «autolagret»-teksten («… siden») holdes fersk.
  useEffect(() => { const id = window.setInterval(() => setNowTick((t) => t + 1), 20000); return () => window.clearInterval(id); }, []);
  const savedAgo = useMemo(() => {
    void nowTick; if (!lastSavedAt) return null;
    const s = Math.floor((Date.now() - lastSavedAt) / 1000);
    if (s < 5) return 'nå'; if (s < 60) return `${s}s siden`; const m = Math.floor(s / 60);
    return m < 60 ? `${m} min siden` : `${Math.floor(m / 60)} t siden`;
  }, [lastSavedAt, nowTick]);
  // Hent live datakilde (JSON/CSV) via Rust → fyll dataText. Ingen CORS.
  const fetchLiveData = async () => {
    const url = liveUrl.trim();
    if (!/^https?:\/\//i.test(url)) { setMsg('Skriv en gyldig http(s)-URL til datakilden.'); return; }
    setLiveBusy(true); setMsg(`Henter data fra ${(() => { try { return new URL(url).host; } catch { return url; } })()} …`);
    try {
      const data = await invoke<{ text: string; truncated: boolean }>('fetch_live_data', { url });
      const trimmed = (data?.text || '').trim();
      // Prøv å pretty-printe JSON; ellers behold rå (CSV håndteres av parserne).
      let out = trimmed;
      try { const j = JSON.parse(trimmed); out = JSON.stringify(j, null, 2); } catch { /* CSV/tekst */ }
      setDataText(out);
      const keys = Object.keys(parseDataSource(out));
      const rows = parseDataRows(out).rows.length;
      setLiveAt(new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }));
      if (data?.truncated) {
        // Avkuttet ved 512K tegn → resten mangler (og avkuttet JSON blir ugyldig).
        setMsg('⚠ Datakilden ble avkuttet ved 512K tegn — bruk et filtrert API-uttrekk eller et mindre datasett. Dataen under er ufullstendig.');
      } else {
        setMsg(keys.length ? `Hentet ${keys.length} felt fra datakilden — bind dem til feltene.` : rows >= 2 ? `Hentet ${rows} rader — «Lag scener» eller bind kolonner.` : 'Hentet data — sjekk formatet (JSON-objekt eller CSV med header).');
      }
    } catch (e) {
      setMsg('Feil ved henting: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setLiveBusy(false); }
  };

  // Total timeline-lengde (for scrubber/«spill alt»).
  const totalDur = useMemo(() => scenes.reduce((mx, sc) => {
    const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
    return Math.max(mx, sc.atSec + effDur(sc, t));
  }, 0) || 1, [scenes]);

  const updateScene = (patch: Partial<Scene>) => setScenes((ss) => ss.map((s, i) => (i === sel ? { ...s, ...patch } : s)));
  const setValue = (k: string, v: string) => updateScene({ values: { ...scene.values, [k]: v } });
  const setBinding = (k: string, dataKey: string) => {
    const b = { ...(scene.bindings || {}) };
    if (dataKey) b[k] = dataKey; else delete b[k];
    updateScene({ bindings: b });
  };
  const pickTemplate = (id: string) => {
    // Implisitt læring: byttet brukeren MANUELT bort fra en fersk AI-anbefaling
    // (på samme scene, før bruk)? Da var anbefalingen feil → svakt negativt signal.
    if (aiLastPick && aiLastPick.tplId === scene.tplId && id !== aiLastPick.tplId) {
      recordAiFeedback(aiLastPick.desc, aiLastPick.tplId, false, 0.5);
      setAiLastPick(null);
    }
    updateScene({ tplId: id });
  };
  const addScene = () => {
    const last = scenes[scenes.length - 1];
    const lastTpl = INFOGRAPHIC_TEMPLATES.find((t) => t.id === last.tplId) || INFOGRAPHIC_TEMPLATES[0];
    const at = last.atSec + effDur(last, lastTpl);
    setScenes((ss) => [...ss, newScene(INFOGRAPHIC_TEMPLATES[0].id, at)]);
    setSel(scenes.length);
  };
  const deleteScene = (i: number) => {
    if (scenes.length <= 1) return;
    setScenes((ss) => ss.filter((_, j) => j !== i));
    // Behold BRUKERENS valgte scene: sletter vi en scene FØR den, rykker den ned én
    // plass (s-1). Sletter vi den valgte selv, tar neste scene plassen (samme indeks).
    setSel((s) => { const ns = i < s ? s - 1 : s; return Math.max(0, Math.min(ns, scenes.length - 2)); });
  };
  const duplicateScene = (i: number) => {
    const src = scenes[i]; if (!src) return;
    const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === src.tplId) || INFOGRAPHIC_TEMPLATES[0];
    const copy: Scene = { ...src, id: `s${_sid++}`, atSec: src.atSec + effDur(src, t), values: { ...src.values }, bindings: { ...(src.bindings || {}) }, name: src.name ? `${src.name} (kopi)` : undefined };
    setScenes((ss) => { const n = [...ss]; n.splice(i + 1, 0, copy); return n; });
    setSel(i + 1);
  };
  const moveScene = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= scenes.length) return;
    setScenes((ss) => { const n = [...ss]; const [x] = n.splice(i, 1); n.splice(j, 0, x); return n; });
    setSel(j);
  };

  // ── Angre/gjenta (undo/redo): snapshot av redigerbar tilstand, debouncet så en
  //    redigerings-«burst» blir ÉN oppføring. histRestoring-flagget hindrer at en
  //    undo/redo selv lager ny historikk (stabilt sammen med autosave). ──
  const editKey = JSON.stringify({ scenes, accent, logo, dataText, palette, liveUrl });
  const histPast = useRef<string[]>([]);
  const histFuture = useRef<string[]>([]);
  const histRestoring = useRef(false);
  const histPrev = useRef<string>('');
  const [histTick, setHistTick] = useState(0);
  useEffect(() => {
    if (!histPrev.current) { histPrev.current = editKey; return; }
    if (histRestoring.current) { histRestoring.current = false; histPrev.current = editKey; return; }
    if (editKey === histPrev.current) return;
    const before = histPrev.current;
    const h = window.setTimeout(() => {
      histPast.current.push(before);
      if (histPast.current.length > 80) histPast.current.shift();
      histFuture.current = [];
      histPrev.current = editKey;
      setHistTick((t) => t + 1);
    }, 450);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editKey]);
  const applyHist = (json: string) => {
    try {
      const s = JSON.parse(json) as { scenes: Scene[]; accent: string; logo: string; dataText: string; palette: string[]; liveUrl?: string };
      histRestoring.current = true;
      setScenes(s.scenes); setAccent(s.accent); setLogo(s.logo); setDataText(s.dataText); setPalette(s.palette); setLiveUrl(s.liveUrl || '');
      setSel((cur) => Math.min(cur, Math.max(0, (s.scenes?.length || 1) - 1)));
    } catch { histRestoring.current = false; }
  };
  const canUndo = useMemo(() => histPast.current.length > 0, [histTick]);
  const canRedo = useMemo(() => histFuture.current.length > 0, [histTick]);
  const undo = () => { if (!histPast.current.length) return; histFuture.current.push(histPrev.current); const prev = histPast.current.pop() as string; histPrev.current = prev; applyHist(prev); setHistTick((t) => t + 1); };
  const redo = () => { if (!histFuture.current.length) return; histPast.current.push(histPrev.current); const next = histFuture.current.pop() as string; histPrev.current = next; applyHist(next); setHistTick((t) => t + 1); };
  // Tastatur: Cmd/Ctrl+Z angre, Cmd/Ctrl+Shift+Z gjenta — men ikke mens man skriver i felt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fieldVals = (sc: Scene, t: InfographicTemplate) => {
    const out: Record<string, string> = { ...t.defaults };
    for (const f of t.fields) if (sc.values[f.key] !== undefined) out[f.key] = sc.values[f.key];
    // Data-binding overstyrer: bundet felt henter verdi fra datakilden.
    const b = sc.bindings || {};
    for (const f of t.fields) {
      const bk = b[f.key];
      if (bk && dataMap[bk] !== undefined) out[f.key] = dataMap[bk];
    }
    // Norsk tallformat (valgfritt) på tall-felt (ikke ikon-felt).
    if (localizeNb) for (const f of t.fields) if (!isIconField(f.key) && out[f.key]) out[f.key] = localizeNumberNb(out[f.key]);
    return out;
  };
  const config = useMemo(() => buildInfographicConfig(tpl, fieldVals(scene, tpl), { accent: sceneAccent(scene), ink: '#1f2d4a', logo: sceneLogo(scene) || undefined }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tpl, scene, accent, logo, localizeNb, dataMap]);
  const srcDoc = useMemo(() => `<script>window.__CFG__=${cfgScript(config)}</script>` + htmlForTemplate(tpl) + `<script>${FIT_SCRIPT}</script>`, [config, tpl]);
  // «Alle formater»-kortene skal fryse ved sluttbildet. __igFreeze=1 → FIT_SCRIPT
  // kaller setProgress(1) INNE i iframen (robust i WKWebView) i stedet for at
  // foreldre må lese contentDocument (som feiler → kortene sto frosset på p=0).
  const formatSrcDoc = useMemo(() => `<script>window.__CFG__=${cfgScript(config)};window.__igFreeze=1;</script>` + htmlForTemplate(tpl) + `<script>${FIT_SCRIPT}</script>`, [config, tpl]);

  const previewWin = () => iframeRef.current?.contentWindow as (Window & { setProgress?: (p: number) => void }) | null | undefined;
  const setPreviewProgress = (p: number) => { const w = previewWin(); if (w && typeof w.setProgress === 'function') { try { w.setProgress(Math.max(0, Math.min(1, p))); } catch { /* */ } } };

  // Skaler malens innhold (#wrap, natural-bredde) så det passer i canvasen —
  // før overflommet flerkorts-maler og ble klippet. Kjøres på load + resize.
  const fitPreview = () => {
    // Send iframens EKTE størrelse (målt fra foreldre) inn via __igFitTo — en
    // srcdoc-iframe kan i WKWebView ikke måle sin egen viewport pålitelig. Fall
    // tilbake til self-fit (__igFit) om funksjonen ikke finnes ennå.
    try {
      const el = iframeRef.current;
      const win = previewWin() as unknown as { __igFitTo?: (w: number, h: number) => void; __igFit?: () => void } | null | undefined;
      if (win?.__igFitTo && el) win.__igFitTo(el.clientWidth, el.clientHeight);
      else win?.__igFit?.();
    } catch { /* */ }
  };

  // Simuler exit-fade i preview ved å sette #wrap-opacity (rendret klipp bruker
  // ffmpeg alfa-fade — dette speiler det visuelt).
  // Inngangs-bevegelse (body-transform) × opacity (#wrap = inngang × exit). Body
  // bærer inngangs-transformen så den komponerer med #wrap sin fit-scale.
  const setPreviewMotion = (sc: Scene, elapsedSec: number, exitOpacity: number) => {
    // Kall __igMotion INNE i iframen (via contentWindow) i stedet for å skrive til
    // iframe-DOM-en fra foreldre — sistnevnte er stille upålitelig i WKWebView, så
    // inngangs-/exit-bevegelsen ville aldri vist i preview (men gjør det i render).
    const ef = easeVal('out', ENTRANCE_DUR > 0 ? elapsedSec / ENTRANCE_DUR : 1);
    const en = entranceStyle(sc.entrance, ef);
    const op = Math.max(0, Math.min(1, en.opacity * exitOpacity));
    try { (previewWin() as unknown as { __igMotion?: (tf: string, op: number) => void } | null | undefined)?.__igMotion?.(en.transform, op); } catch { /* */ }
  };
  // Sett ett scrub-bilde: eased progresjon + inngang/exit ved lokal p.
  const applyScrubFrame = (sc: Scene, p: number) => {
    const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
    const durS = effDur(sc, t);
    setPreviewProgress(easeVal(sc.easing, p));
    const exitS = Math.max(0, Math.min(sc.exitSec ?? 0, durS));
    const exitStartP = durS > 0 ? (durS - exitS) / durS : 1;
    const exitOpacity = exitS > 0 && p >= exitStartP ? Math.max(0, 1 - (p - exitStartP) / ((exitS / durS) || 1)) : 1;
    setPreviewMotion(sc, p * durS, exitOpacity);
  };
  const play = (durSecOverride?: number) => {
    const win = previewWin();
    if (!win || typeof win.setProgress !== 'function') return;
    const durS = durSecOverride ?? effDur(scene, tpl);
    const dur = Math.max(1, durS) * 1000, t0 = performance.now();
    const exitMs = Math.max(0, Math.min(scene.exitSec ?? 0, durS)) * 1000;
    const exitStart = dur - exitMs;
    const tick = (now: number) => {
      const elMs = now - t0;
      const p = Math.min(1, elMs / dur);
      try { win.setProgress!(easeVal(scene.easing, p)); } catch { /* */ }
      const exitOpacity = exitMs > 0 && elMs >= exitStart ? Math.max(0, 1 - (elMs - exitStart) / exitMs) : 1;
      setPreviewMotion(scene, elMs / 1000, exitOpacity);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };
  const onIframeLoad = () => {
    // Sentrer tidlig, og re-fit når innholdet (async chart-tegning) har satt seg.
    [60, 250, 550, 1000].forEach((d) => window.setTimeout(fitPreview, d));
    // Autoplay KUN når brukeren nettopp valgte en scene — ikke midt i «Spill alt»
    // eller rett etter en scrub (der posisjonen styres av playAll/scrub-effekten).
    window.setTimeout(() => {
      if (playingAllRef.current || performance.now() - recentScrubRef.current < 700) return;
      play();
    }, 250);
  };
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  // Kollektiv læring: hent kollektive aggregater (inkrementelt) ved åpning +
  // push evt. køede signaler. Stille no-op når ikke innlogget.
  useEffect(() => { void syncCollective(); }, []);
  // Auto-hent kollektiv innsikt første gang «Innsikt»-fanen åpnes.
  useEffect(() => { if (leftSec === 'insight' && !insight && !insightBusy) void loadInsight(); }, [leftSec]); // eslint-disable-line react-hooks/exhaustive-deps
  // Auto-hent team-biblioteket når «Mine infographics» åpnes.
  useEffect(() => { if (leftSec === 'library') void loadTeamLibrary(); }, [leftSec]); // eslint-disable-line react-hooks/exhaustive-deps
  // Re-fit ved endring av canvas-størrelse.
  useEffect(() => {
    const el = canvasRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitPreview()); ro.observe(el); return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Tidslinje-scrubbing + «Spill alt»: se hele overlay-SEKVENSEN (scenene i
  //    atSec-rekkefølge over tid) før Send to Resolve, ikke bare én scene. ──
  const [scrubT, setScrubT] = useState(0);
  const [playingAll, setPlayingAll] = useState(false);
  const playAllRef = useRef<number | null>(null);
  // Finn hvilken scene som er aktiv på tidspunkt t, og dens lokale progresjon.
  const sceneAtTime = (t: number): { index: number; p: number } => {
    for (let i = scenes.length - 1; i >= 0; i--) {
      const sc = scenes[i]; const tp = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
      const d = effDur(sc, tp);
      if (t >= sc.atSec && t <= sc.atSec + d) return { index: i, p: d > 0 ? (t - sc.atSec) / d : 1 };
    }
    // Ingen scene akkurat her → nærmeste tidligere.
    let best = 0; for (let i = 0; i < scenes.length; i++) if (scenes[i].atSec <= t) best = i;
    return { index: best, p: 1 };
  };
  const scrubTo = (t: number) => {
    recentScrubRef.current = performance.now(); // marker: undertrykk autoplay ved evt. iframe-reload
    setScrubT(t); const { index, p } = sceneAtTime(t);
    if (index !== sel) setSel(index); else applyScrubFrame(scenes[index], p);
  };
  // Når scrub bytter scene, vent på ny iframe-load og sett progresjonen (m/ easing+inngang).
  useEffect(() => { if (playingAll || scrubT > 0) { const { p } = sceneAtTime(scrubT); const h = setTimeout(() => applyScrubFrame(scene, p), 60); return () => clearTimeout(h); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);
  const stopPlayAll = () => { if (playAllRef.current) cancelAnimationFrame(playAllRef.current); playAllRef.current = null; playingAllRef.current = false; setPlayingAll(false); };
  const playAll = () => {
    stopPlayAll(); playingAllRef.current = true; setPlayingAll(true);
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } // stopp enkelt-scene-loop
    let t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      if (t >= totalDur) {
        if (loopAll) { t0 = performance.now(); scrubTo(0); playAllRef.current = requestAnimationFrame(tick); return; }
        scrubTo(totalDur); stopPlayAll(); return;
      }
      scrubTo(t);
      playAllRef.current = requestAnimationFrame(tick);
    };
    playAllRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stopPlayAll(), []);
  // ── Rik multi-scene-tidslinje: zoom (px/s), transport, dra-flytt/-endre ──
  const [tlZoom, setTlZoom] = useState(90);
  const fmtTC = (s: number) => { const m = Math.floor(Math.max(0, s) / 60); const sec = Math.max(0, s) - m * 60; return `${m}:${sec.toFixed(1).padStart(4, '0')}`; };
  const jumpScene = (dir: 1 | -1) => {
    const order = scenes.map((s, i) => ({ t: s.atSec, i })).sort((a, b) => a.t - b.t);
    const target = dir > 0 ? order.find((o) => o.t > scrubT + 0.05) : [...order].reverse().find((o) => o.t < scrubT - 0.05);
    if (target) { setSel(target.i); scrubTo(target.t); } else scrubTo(dir > 0 ? totalDur : 0);
  };
  // Dra en scene-klipp: body = flytt atSec, høyre kant = endre varighet.
  const onClipDrag = (e: React.PointerEvent, i: number, mode: 'move' | 'resize') => {
    e.stopPropagation(); e.preventDefault();
    const sc = scenes[i]; const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
    const startX = e.clientX, atSec0 = sc.atSec, dur0 = effDur(sc, t), z = tlZoom;
    setSel(i);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / z;
      if (mode === 'move') { const at = Math.max(0, Math.round((atSec0 + dx) * 10) / 10); setScenes((ss) => ss.map((s, idx) => (idx === i ? { ...s, atSec: at } : s))); }
      else { const dur = Math.max(1, Math.round((dur0 + dx) * 10) / 10); setScenes((ss) => ss.map((s, idx) => (idx === i ? { ...s, durSec: dur } : s))); }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  // Bundlede fonter for ikon-velgeren i studio-UI-et — offline-robust (før:
  // Google Fonts-CDN-lenke som brøt ikonene offline).
  useEffect(() => {
    const id = 'infographic-bundled-fonts';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id; s.textContent = FONT_FACE_CSS;
      document.head.appendChild(s);
    }
  }, []);

  const pickLogo = (file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const url = typeof r.result === 'string' ? r.result : ''; setLogo(url);
      void dominantColor(url).then((hex) => { if (hex && hex.toLowerCase() !== accent.toLowerCase()) setSuggested(hex); });
    };
    r.readAsDataURL(file);
  };

  const doSetupPlaywright = async () => {
    setNeedsPlaywright(false); setMsg('Setter opp Playwright (engangs — kan ta et par minutter) …');
    try { await setupPlaywright(); setMsg('Playwright satt opp — trykk «Send to Resolve» igjen.'); }
    catch (e) { setMsg('Feil ved oppsett: ' + (e instanceof Error ? e.message : String(e))); }
  };

  const sendToResolve = async () => {
    if (busy) return;
    setBusy(true); setNeedsPlaywright(false); cancelRef.current = false;
    setRenderProgress({ done: 0, total: scenes.length });
    try {
      // Sjekk Playwright FØR vi begynner → tydelig «Sett opp»-utvei i stedet for
      // en kryptisk feil midt i rendringen.
      const st = await playwrightStatus().catch(() => null);
      if (st && !st.playwrightInstalled) { setNeedsPlaywright(true); setMsg('Playwright-runtime mangler — sett det opp for å rendre.'); return; }
      const overlays: Array<Record<string, unknown>> = [];
      for (let i = 0; i < scenes.length; i++) {
        if (cancelRef.current) { setMsg(`Avbrutt etter ${i} av ${scenes.length} scener.`); return; }
        const sc = scenes[i];
        const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
        const dur = effDur(sc, t);
        const cfg = buildInfographicConfig(t, fieldVals(sc, t), { accent: sceneAccent(sc), ink: '#1f2d4a', logo: sceneLogo(sc) || undefined });
        const html = `<script>window.__CFG__=${cfgScript(cfg)}</script>` + htmlForTemplate(t);
        setRenderProgress({ done: i, total: scenes.length });
        setMsg(`Rendrer scene ${i + 1}/${scenes.length} (${t.name}) …`);
        const out = await invoke<string>('render_infographic', { html, durationSec: dur, name: `${t.id}-${sc.id}-${Date.now()}`, fps, scale, exitSec: sc.exitSec ?? 0, frame: frameArg(), easing: sc.easing ?? 'outcubic', entrance: sc.entrance ?? 'none' });
        // fps = klippets EGEN bildefrekvens (.mov ble rendret med denne). place_overlay
        // MÅ bruke den for source-out-punktet — ikke timeline-fps — ellers kuttes/
        // overskytes alfa-klippet på alle ikke-30fps-timelines.
        overlays.push({ path: out, atSec: sc.atSec, durationSec: dur, track: overlayTrack, posX: sc.posX ?? 50, posY: sc.posY ?? 50, fps });
        recordTemplateUsage(t.id); // implisitt: brukt mal = smak-signal (uten klikk)
      }
      setRenderProgress({ done: scenes.length, total: scenes.length });
      setMsg('Sender alle scener til Resolve …');
      const summary = await executeScript('place_overlay', { overlays });
      const errEvt = summary.events.find((e) => e.type === 'error');
      if (!summary.succeeded || errEvt) {
        setMsg('Rendret, men kunne ikke legges i Resolve: ' + ((errEvt?.value as { message?: string } | undefined)?.message || 'er Resolve åpen med en timeline?'));
        if (overlays[0]?.path) void systemOpen(String(overlays[0].path)).catch(() => {});
      } else {
        setMsg(`${scenes.length} scene(r) sendt til Resolve, plassert på overlay-spor til riktig tid.`);
        // Implisitt aksept: ble en AI-anbefalt mal faktisk sendt? Da traff den.
        if (aiLastPick && scenes.some((s) => s.tplId === aiLastPick.tplId)) {
          recordAiFeedback(aiLastPick.desc, aiLastPick.tplId, true, 0.5); setAiLastPick(null);
        }
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/playwright|chromium|node/i.test(m)) { setNeedsPlaywright(true); setMsg('Feil: ' + m + ' — krever Playwright-runtime.'); }
      else setMsg('Feil: ' + m);
    } finally { setBusy(false); setRenderProgress(null); }
  };

  // Eksporter GJELDENDE scene til en frittstående fil (utenfor Resolve):
  // ProRes/MP4/GIF/APNG/PNG — for social, web, e-post, slides.
  const exportFile = async () => {
    if (exportBusy) return;
    setExportBusy(true); setNeedsPlaywright(false);
    const fmtLabel: Record<string, string> = { prores: 'ProRes (.mov)', mp4: 'MP4', gif: 'GIF', apng: 'animert PNG', png: 'stillbilde (PNG)' };
    setMsg(`Eksporterer ${tpl.name} som ${fmtLabel[exportFmt]} …`);
    try {
      const st = await playwrightStatus().catch(() => null);
      if (st && !st.playwrightInstalled) { setNeedsPlaywright(true); setMsg('Playwright-runtime mangler — sett det opp for å eksportere.'); return; }
      const cfg = buildInfographicConfig(tpl, fieldVals(scene, tpl), { accent: sceneAccent(scene), ink: '#1f2d4a', logo: sceneLogo(scene) || undefined });
      const html = `<script>window.__CFG__=${cfgScript(cfg)}</script>` + htmlForTemplate(tpl);
      const metaTitle = includeMeta ? (scene.name || `${project?.name || 'Infographic'} · ${tpl.name}`) : '';
      const out = await invoke<string>('export_infographic', { html, durationSec: effDur(scene, tpl), name: `${tpl.id}-${scene.id}-${Date.now()}`, format: exportFmt, fps, scale, exitSec: scene.exitSec ?? 0, frame: frameArg(), easing: scene.easing ?? 'outcubic', entrance: scene.entrance ?? 'none', metadata: metaTitle });
      setMsg(`Eksportert: ${out}`);
      recordTemplateUsage(tpl.id);
      if (aiLastPick && aiLastPick.tplId === tpl.id) { recordAiFeedback(aiLastPick.desc, aiLastPick.tplId, true, 0.5); setAiLastPick(null); }
      void systemOpen(out).catch(() => {});
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/playwright|chromium|node/i.test(m)) { setNeedsPlaywright(true); setMsg('Feil: ' + m + ' — krever Playwright-runtime.'); }
      else setMsg('Feil ved eksport: ' + m);
    } finally { setExportBusy(false); }
  };

  // «Én scene per rad»: multi-rad-data → generér N scener av gjeldende mal, med
  // hver kolonne bundet til malens felt i rekkefølge (spar manuelt arbeid).
  // AI-mal-valg: beskriv → Claude velger beste mal + fyller feltene på gjeldende scene.
  const runAiPick = async () => {
    if (aiBusy || !aiDesc.trim()) return;
    if (!isAiConnected()) { setMsg('AI ikke koblet til (mangler Role Room-token i Innstillinger).'); return; }
    setAiBusy(true); setMsg('AI velger mal og fyller inn …');
    try {
      const r = await aiPickTemplate({ description: aiDesc.trim(), templates: INFOGRAPHIC_TEMPLATES });
      updateScene({ tplId: r.tplId, values: r.values, bindings: {} });
      setAiLastPick({ desc: aiDesc.trim(), tplId: r.tplId });
      const picked = INFOGRAPHIC_TEMPLATES.find((t) => t.id === r.tplId);
      setMsg(`Valgte «${picked?.name || r.tplId}»${r.reason ? ` — ${r.reason}` : ''}`);
    } catch (e) {
      setMsg('Feil ved AI-valg: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setAiBusy(false); }
  };

  // «Fra nettside»: scan siden → hent LOGO + merkefarge fra branding, la AI
  // velge mal + fylle med EKTE data fra siden (firmanavn, tall, tagline).
  const runFromSite = async () => {
    if (aiBusy) return;
    if (!isCaptureAvailable()) { setMsg('«Fra nettside» krever Tauri-appen (skann av siden).'); return; }
    if (!isAiConnected()) { setMsg('AI ikke koblet til (mangler Role Room-token i Innstillinger).'); return; }
    const url = project?.url?.trim();
    if (!url) { setMsg('Prosjektet mangler en URL — åpne en demo med nettadresse først.'); return; }
    setAiBusy(true); setMsg(`Skanner ${url} …`);
    try {
      const scan = await scanDom(url).catch(() => null);
      const brand = scan?.branding;
      // LOGO fra siden: flere kandidater → la brukeren velge; ellers bruk den ene
      // (embed + sjekk lower-third-vennlighet via applyLogo). + merkefarge = aksent.
      if (brand?.logoCandidates && brand.logoCandidates.length > 1) setLogoChoices(brand.logoCandidates);
      else if (brand?.logoUrl) { setMsg('Henter logo …'); await applyLogo(brand.logoUrl); }
      if (brand?.brandColor && /^#[0-9a-fA-F]{3,8}$/.test(brand.brandColor)) setAccent(brand.brandColor);
      // Dypere Brand Kit: bruk HELE paletten fra siden (ikke bare aksenten) +
      // fang fontene så brukeren ser hva siden bruker.
      const sitePalette = (brand?.palette || []).filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c));
      if (sitePalette.length >= 2) setPalette((prev) => Array.from(new Set([...sitePalette, ...prev])).slice(0, 8));
      const siteFonts = (brand?.fonts || []).filter(Boolean);
      if (sitePalette.length || siteFonts.length) setSiteBrand({ palette: sitePalette, fonts: siteFonts });
      const pageText = scan?.pageText || '';
      if (!pageText.trim()) { setMsg('Fant lite lesbar tekst på siden (SPA/innlogget?). Prøv en beskrivelse i stedet.'); return; }
      // Forstå hva bedriften LEVERER: multi-side-kontekst (/tjenester, /priser …)
      // + strukturert bevis-inventar (funksjoner, tall, tagline).
      setMsg('Forstår produkter/tjenester …');
      const gathered = await gatherSiteContext(url, { mainText: pageText, maxPages: 4 }).catch(() => null);
      const ctx = gathered?.context || pageText;
      const evidence = await analyzeProductEvidence({ url, siteContext: ctx, elements: scan?.elements || [] }).catch(() => null);
      setMsg('AI lager infographic fra tjenestene …');
      const labels = (scan?.elements || []).map((e) => e.label).filter(Boolean).slice(0, 25);
      const r = await aiInfographicFromSite({ siteText: ctx, brandName: brand?.brandName, elementLabels: labels, evidence: evidence ?? undefined, templates: INFOGRAPHIC_TEMPLATES });
      updateScene({ tplId: r.tplId, values: r.values, bindings: {} });
      setAiLastPick({ desc: `nettside: ${brand?.brandName || url}`, tplId: r.tplId });
      const picked = INFOGRAPHIC_TEMPLATES.find((t) => t.id === r.tplId);
      const nFeat = evidence?.features?.length || 0;
      setMsg(`«${picked?.name || r.tplId}» fylt fra ${brand?.brandName || url}${nFeat ? ` (${nFeat} tjenester forstått)` : ''}${brand?.logoUrl ? ' + logo' : ''}${sitePalette.length >= 2 ? ` + ${sitePalette.length}-farge palett` : brand?.brandColor ? ' + merkefarge' : ''}${siteFonts.length ? ` + font «${siteFonts[0]}»` : ''}${r.reason ? ` — ${r.reason}` : ''}`);
    } catch (e) {
      setMsg('Feil ved «Fra nettside»: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setAiBusy(false); }
  };

  // Importer egen HTML-mal → «Mine maler».
  const doImportTemplate = () => {
    if (!importHtml.trim()) { setMsg('Lim inn eller last opp HTML-mal først.'); return; }
    if (!/setProgress/.test(importHtml)) { setMsg('Malen bør definere window.setProgress(p) for animasjon — importerer likevel.'); }
    const t = addCustomTemplate(importName || 'Egen mal', importHtml);
    setImportName(''); setImportHtml(''); setCustomTick((n) => n + 1);
    updateScene({ tplId: t.id, values: {}, bindings: {} });
    setMsg(`Importert «${t.name}» (${t.fields.length} felt funnet) — valgt på scene ${sel + 1}.`);
  };

  const batchFromRows = () => {
    const { headers, rows } = parseDataRows(dataText);
    if (rows.length < 2) { setMsg('Trenger minst 2 datarader (JSON-array eller CSV med flere verdi-rader).'); return; }
    const fields = tpl.fields.filter((f) => !isIconField(f.key));
    const built: Scene[] = rows.map((row, i) => {
      const bindings: Record<string, string> = {};
      // Bind malens felt til kolonner i rekkefølge (så mange som finnes).
      fields.forEach((f, j) => { if (headers[j]) bindings[f.key] = headers[j]; });
      const values: Record<string, string> = {};
      fields.forEach((f, j) => { if (headers[j]) values[f.key] = row[headers[j]] ?? ''; });
      const at = i * effDur(scene, tpl);
      return { id: `s${_sid++}`, tplId: tpl.id, values, atSec: at, bindings };
    });
    setScenes(built); setSel(0);
    setMsg(`Laget ${built.length} scener — én per datarad (${tpl.name}).`);
  };

  // To-linjers rail-element (ikon + tittel + undertekst + valgfri teller), med
  // kollaps-modus (ikon alene). `nav=false` = ikke-navigerende info-rad.
  const railBtn = (sec: string, icon: React.ReactNode, title: string, sub: string, count?: number | null, onExtra?: () => void, nav = true) => {
    const active = nav && leftSec === sec;
    return (
      <div key={sec + title} onClick={() => { if (nav) (setLeftSec as (s: string) => void)(sec); onExtra?.(); }}
        title={railCollapsed ? `${title}${sub ? ' · ' + sub : ''}` : (sub || undefined)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: railCollapsed ? '9px 0' : '7px 14px', justifyContent: railCollapsed ? 'center' : 'flex-start', cursor: nav ? 'pointer' : 'default', color: active ? D.ink : D.soft, background: active ? D.panel2 : 'transparent', borderLeft: `3px solid ${active ? D.accent : 'transparent'}` }}>
        <span style={{ display: 'inline-flex', flex: 'none' }}>{icon}</span>
        {!railCollapsed && (<>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.1 }}>{title}</div>
            {sub && <div style={{ fontSize: 9, color: D.faint, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
          </div>
          {count != null && <span style={{ fontSize: 10, color: active ? D.teal : D.faint, flex: 'none' }}>{count}</span>}
        </>)}
      </div>
    );
  };
  const topBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: `1px solid ${D.line}`, background: D.panel2, color: D.ink, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 };
  const inp: React.CSSProperties = { width: '100%', fontSize: 12.5, padding: '7px 9px', borderRadius: 7, border: `1px solid ${D.line}`, background: D.bg, color: D.ink, colorScheme: 'dark' };
  const tabBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '7px 0', textAlign: 'center', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: active ? D.ink : D.soft, background: active ? D.panel2 : 'transparent', borderBottom: `2px solid ${active ? D.accent : 'transparent'}` });

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minWidth: 0, background: D.bg, color: D.ink, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {showCampaign && (
        <CampaignDirectorView
          evidenceText={[project?.name, liveUrl, dataText, ...scenes.map((s) => Object.values(s.values).join(' · '))].filter(Boolean).join('\n')}
          brand={{ accent, ink: '#1f2d4a', logo: logo || undefined }}
          brandName={project?.name || 'Merkevare'}
          onClose={() => setShowCampaign(false)}
          onUsePosts={(c) => {
            // Materialiser hver post → en on-brand scene (riktig sosial-mal per pilar),
            // sekvensielt i tid. Erstatter scenene (som batch-fra-data), rediger + Send to Resolve.
            const built = c.posts.map((p, i) => {
              const m = materializePost(p, project?.name || 'Merkevare');
              const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === m.tplId) || INFOGRAPHIC_TEMPLATES[0];
              return { ...newScene(t.id, i * effDur(scene, t)), values: m.values, accent, logo };
            });
            setScenes(built); setSel(0); setShowCampaign(false);
            setMsg(`Kampanje materialisert: ${built.length} on-brand scener — rediger + Send to Resolve.`);
          }}
        />
      )}
      {showSystemArch && (
        <SystemArchDialog accent={accent} brandName={project?.name || 'System'} onClose={() => setShowSystemArch(false)} />
      )}
      {showMotion && (
        <MotionStingDialog
          values={fieldVals(scene, tpl)}
          order={tpl.fields.map((f) => f.key)}
          brandName={project?.name || 'Merkevare'}
          accent={sceneAccent(scene)}
          onClose={() => setShowMotion(false)}
        />
      )}
      {/* flexWrap: header-knappene (Preview/Spill alt/New Scene/Send to Resolve) tvang
          ellers studioet bredere enn smale vinduer → høyre Data-panel ble klippet. Wrap
          lar knappene bryte til ny linje i stedet, og minWidth:0 lar studioet krympe. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${D.line}`, background: D.panel, flexWrap: 'wrap', rowGap: 6 }}>
        <button style={{ ...topBtn, border: 'none', background: 'transparent', color: D.soft }} title={standalone ? 'Tilbake til Home' : 'Tilbake til Flow Builder'} onClick={() => onNav('flow')}><ArrowBackIcon style={{ fontSize: 18 }} /></button>
        <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><DashboardCustomizeIcon style={{ fontSize: 18, color: D.accent }} /> Infographic Studio</div>
        {standalone && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: D.teal, border: `1px solid ${D.line}`, borderRadius: 999, padding: '2px 8px' }}>Egen løsning</span>}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: D.soft }}>{project?.name || (standalone ? 'Frittstående' : 'Uten navn')} · {scenes.length} scene(r)</span>
          {savedAgo && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: D.faint }}><CheckCircleOutlineIcon style={{ fontSize: 13, color: D.teal }} /> Autolagret · {savedAgo}</span>}
        </div>
        {standalone && onOpenDemoStudio && (
          <button style={topBtn} title="Åpne Product Demo Studio — Infographic Studio er også en add-on der" onClick={onOpenDemoStudio}><OpenInNewIcon style={{ fontSize: 15 }} /> Product Demo</button>
        )}
        <button style={topBtn} onClick={() => play()} title="Spill den valgte scenen"><PlayArrowIcon style={{ fontSize: 16 }} /> Preview</button>
        <button style={topBtn} onClick={() => (playingAll ? stopPlayAll() : playAll())} title="Spill HELE sekvensen (alle scener i tid)">{playingAll ? <><PauseIcon style={{ fontSize: 16 }} /> Stopp</> : <><SlideshowIcon style={{ fontSize: 16 }} /> Spill alt</>}</button>
        <button style={topBtn} onClick={addScene}><AddIcon style={{ fontSize: 16 }} /> New Scene</button>
        <button style={topBtn} onClick={() => setShowCampaign(true)} title="Kampanje-regissør — mål-drevet, on-brand kampanje fra nettside-bevis"><CampaignIcon style={{ fontSize: 16 }} /> Kampanje</button>
        <button style={topBtn} onClick={() => setShowSystemArch(true)} title="System-arkitektur — Mermaid → merkevaret arkitektur-infographic med ekte system-logoer"><AccountTreeIcon style={{ fontSize: 16 }} /> Arkitektur</button>
        <button style={topBtn} onClick={() => setShowMotion(true)} title="Motion — samme scene-data som en animert data-sting (still + motion fra ett data-objekt)"><AnimationIcon style={{ fontSize: 16 }} /> Motion</button>
        {busy ? (
          <button style={{ ...topBtn, background: '#7a2530', border: 'none' }} onClick={() => { cancelRef.current = true; }} title="Avbryt etter gjeldende scene">
            <CloseIcon style={{ fontSize: 15 }} /> Avbryt{renderProgress ? ` (${renderProgress.done}/${renderProgress.total})` : ''}
          </button>
        ) : (
          <button style={{ ...topBtn, background: D.accent, border: 'none' }} onClick={() => void sendToResolve()}><AutoAwesomeIcon style={{ fontSize: 16 }} /> Send to Resolve</button>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Rail */}
        <div style={{ width: railCollapsed ? 54 : 178, transition: 'width .15s', borderRight: `1px solid ${D.line}`, background: D.panel, paddingTop: 8, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {railBtn('data', <DatasetIcon style={{ fontSize: 17 }} />, 'Data Sources', dataKeys.length ? `${dataKeys.length} tilkoblet` : 'lim inn / URL', dataKeys.length || null)}
          {railBtn('templates', <GridViewIcon style={{ fontSize: 17 }} />, 'Templates', 'innebygde maler', INFOGRAPHIC_TEMPLATES.length)}
          {railBtn('social', <PhoneIphoneIcon style={{ fontSize: 17 }} />, 'Social', 'vertikal / kvadrat', INFOGRAPHIC_TEMPLATES.filter((t) => SOCIAL_IDS.has(t.id)).length)}
          {railBtn('charts', <BarChartIcon style={{ fontSize: 17 }} />, 'Charts', 'graf & data-viz', INFOGRAPHIC_TEMPLATES.filter((t) => CHART_IDS.has(t.id)).length)}
          {railBtn('marketing', <CampaignIcon style={{ fontSize: 17 }} />, 'Marketing', 'kampanje & CTA', INFOGRAPHIC_TEMPLATES.filter((t) => MARKETING_IDS.has(t.id)).length)}
          {railBtn('filmtv', <MovieIcon style={{ fontSize: 17 }} />, 'Film & TV', 'lower-thirds', INFOGRAPHIC_TEMPLATES.filter((t) => FILMTV_IDS.has(t.id)).length)}
          {railBtn('callouts', <CenterFocusStrongIcon style={{ fontSize: 17 }} />, 'Callouts', 'peker & merke', INFOGRAPHIC_TEMPLATES.filter((t) => CALLOUT_IDS.has(t.id)).length)}
          {railBtn('ui', <WidgetsIcon style={{ fontSize: 17 }} />, 'UI', 'grensesnitt', INFOGRAPHIC_TEMPLATES.filter((t) => UI_IDS.has(t.id)).length)}
          {railBtn('uxlayout', <ViewQuiltIcon style={{ fontSize: 17 }} />, 'Layout & UX', 'oppsett', INFOGRAPHIC_TEMPLATES.filter((t) => UX_LAYOUT_IDS.has(t.id)).length)}
          {railBtn('custom', <StarBorderIcon style={{ fontSize: 17 }} />, 'Mine maler', 'egne HTML-maler', customTemplateIds().length)}
          {railBtn('library', <CollectionsBookmarkIcon style={{ fontSize: 17 }} />, 'Mine infographics', 'lagret & delt', savedList.length)}
          {railBtn('insight', <QueryStatsIcon style={{ fontSize: 17 }} />, 'Innsikt', 'ML-læring', modelSteps() || null)}
          {railBtn('__icons', <EmojiSymbolsIcon style={{ fontSize: 17 }} />, 'Icons', 'i Data-fanen', ALL_MATERIAL_ICONS.length, undefined, false)}
          {!railCollapsed && <div style={{ fontSize: 9.5, fontWeight: 700, color: D.faint, textTransform: 'uppercase', letterSpacing: 0.6, padding: '10px 14px 4px' }}>Brand Kits</div>}
          {BRAND_KITS.map((k) => railBtn(k.id, <img src={k.logo} alt="" style={{ width: 17, height: 17, objectFit: 'contain' }} />, k.name, k.tagline, INFOGRAPHIC_TEMPLATES.filter((t) => inCategory(k.id, t.id)).length, () => { setAccent(k.accent); setLogo(k.logo); }))}
          {railBtn('brand', <PaletteIcon style={{ fontSize: 17 }} />, 'Brand Kit', 'farge + logo', null)}
          {railBtn('export', <FileDownloadIcon style={{ fontSize: 17 }} />, 'Export', 'media & innstillinger', null)}
          <div style={{ flex: 1, minHeight: 8 }} />
          {/* Prosjekt-metadata-kort */}
          {!railCollapsed && (
            <div style={{ margin: '8px 10px', padding: 8, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
              <TemplateThumb tpl={INFOGRAPHIC_TEMPLATES.find((t) => t.id === scenes[0]?.tplId) || INFOGRAPHIC_TEMPLATES[0]} accent={sceneAccent(scenes[0] || scene)} values={fieldVals(scenes[0] || scene, INFOGRAPHIC_TEMPLATES.find((t) => t.id === scenes[0]?.tplId) || INFOGRAPHIC_TEMPLATES[0])} height={50} />
              <div style={{ fontSize: 12, fontWeight: 700, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project?.name || 'Untitled Demo'}</div>
              <div style={{ fontSize: 9.5, color: D.faint, marginTop: 1 }}>{fmt === 'native' ? 'Naturlig' : fmt} · {fps} fps · {scenes.length} scene(r)</div>
              <div style={{ fontSize: 9.5, color: D.faint }}>{totalDur.toFixed(1)}s total{project?.url ? ` · ${(() => { try { return new URL(project.url).host; } catch { return ''; } })()}` : ''}</div>
              <button style={{ ...topBtn, width: '100%', justifyContent: 'center', fontSize: 11, marginTop: 6 }} onClick={() => setLeftSec('export')}><TuneIcon style={{ fontSize: 14 }} /> Prosjekt-innstillinger</button>
            </div>
          )}
          <div onClick={() => setRailCollapsed((c) => !c)} title={railCollapsed ? 'Utvid' : 'Legg sammen'} style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', cursor: 'pointer', color: D.faint, borderTop: `1px solid ${D.line}` }}>{railCollapsed ? <ChevronRightIcon style={{ fontSize: 18 }} /> : <ChevronLeftIcon style={{ fontSize: 18 }} />}</div>
        </div>

        {/* Sekundær-panel */}
        <div style={{ width: 280, borderRight: `1px solid ${D.line}`, overflowY: 'auto', padding: 14, background: D.panel }}>
          {(leftSec === 'templates' || leftSec in CATEGORY_IDS || leftSec === 'kit-rr' || leftSec === 'kit-ch' || leftSec === 'custom') && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{CATEGORY_LABEL[leftSec] || 'Templates'} <span style={{ color: D.faint, fontWeight: 500 }}>· endrer scene {sel + 1}</span></div>
            {/* AI-mal-valg: beskriv → Claude velger beste mal + fyller feltene. */}
            {leftSec !== 'custom' && (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
                <div style={{ fontSize: 10.5, color: D.teal, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><AutoAwesomeIcon style={{ fontSize: 13 }} /> AI: beskriv det du vil ha</div>
                <textarea value={aiDesc} onChange={(e) => setAiDesc(e.target.value)}
                  placeholder="f.eks. «tre KPI-er for Q2: 124 pasienter, 76% digital innsjekk, −18% ventetid»"
                  style={{ width: '100%', height: 48, fontSize: 11.5, padding: 8, borderRadius: 7, border: `1px solid ${D.line}`, background: D.panel2, color: D.ink, colorScheme: 'dark', resize: 'vertical', marginBottom: 6 }} />
                <button style={{ ...topBtn, width: '100%', justifyContent: 'center', fontSize: 11.5, opacity: aiBusy || !aiDesc.trim() ? 0.6 : 1 }} disabled={aiBusy || !aiDesc.trim()} onClick={() => void runAiPick()}>
                  {aiBusy ? 'AI velger …' : 'Velg mal + fyll inn'}
                </button>
                {/* «Fra nettside»: scan project.url → logo + merkefarge + ekte data. */}
                {project?.url && (
                  <button style={{ ...topBtn, width: '100%', justifyContent: 'center', fontSize: 11.5, marginTop: 6, opacity: aiBusy ? 0.6 : 1 }} disabled={aiBusy}
                    title={`Skanner ${project.url} — henter logo, merkefarge og ekte tall, og fyller en mal`}
                    onClick={() => void runFromSite()}>
                    <LanguageIcon style={{ fontSize: 14 }} /> Fra nettside {(() => { try { return `(${new URL(project.url).host})`; } catch { return ''; } })()}
                  </button>
                )}
                {/* Flere logoer funnet → velg hvilken. */}
                {logoChoices.length > 1 && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: D.panel2, border: `1px solid ${D.line}` }}>
                    <div style={{ fontSize: 10.5, color: D.soft, marginBottom: 6 }}>Fant {logoChoices.length} logoer — velg én:</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {logoChoices.map((u) => (
                        <button key={u} onClick={() => void applyLogo(u)} title={u}
                          style={{ width: 54, height: 40, borderRadius: 6, border: `1px solid ${D.line}`, background: '#fff', display: 'grid', placeItems: 'center', overflow: 'hidden', cursor: 'pointer', padding: 3 }}>
                          <img src={u} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Logo «for stor» / mye luft → foreslå lower-third-vennlig trimming. */}
                {logoHint && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: '#2a2417', border: '1px solid #4a3f22' }}>
                    <div style={{ fontSize: 10.5, color: '#f0d9a8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><WarningAmberIcon style={{ fontSize: 13 }} /> {logoHint}. Beskjære for lower-third?</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11, background: D.accent, border: 'none' }} onClick={() => void trimLogo()}>Gjør lower-third-vennlig</button>
                      <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11 }} onClick={() => setLogoHint(null)}>Behold</button>
                    </div>
                  </div>
                )}
                {/* Dypere Brand Kit: farger + fonter hentet fra siden. */}
                {siteBrand && (siteBrand.palette.length > 0 || siteBrand.fonts.length > 0) && (
                  <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: D.panel2, border: `1px solid ${D.line}` }}>
                    <div style={{ fontSize: 10.5, color: D.teal, fontWeight: 700, marginBottom: 6 }}>Merke fra nettside</div>
                    {siteBrand.palette.length > 0 && (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: siteBrand.fonts.length ? 7 : 0 }}>
                        {siteBrand.palette.map((c) => (
                          <button key={c} onClick={() => setAccent(c)} title={`Bruk ${c} som aksent`}
                            style={{ width: 24, height: 24, borderRadius: 6, background: c, border: `2px solid ${accent.toLowerCase() === c.toLowerCase() ? D.ink : D.line}`, cursor: 'pointer' }} />
                        ))}
                      </div>
                    )}
                    {siteBrand.fonts.length > 0 && (
                      <div style={{ fontSize: 10, color: D.soft, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <TextFieldsIcon style={{ fontSize: 13 }} /> {siteBrand.fonts.join(' · ')}
                      </div>
                    )}
                  </div>
                )}
                {/* Lærings-loop: tommel opp/ned på siste anbefaling → few-shot + re-rangering. */}
                {aiLastPick && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 10.5, color: D.faint, flex: 1 }}>Traff den? AI lærer av svaret.</span>
                    <button style={{ ...topBtn, padding: '3px 9px', fontSize: 12, color: D.teal }} title="God match — lær dette"
                      onClick={() => { recordAiFeedback(aiLastPick.desc, aiLastPick.tplId, true); setAiLastPick(null); setMsg('Lærte: denne malen passer for slike beskrivelser.'); }}><ThumbUpAltIcon style={{ fontSize: 15 }} /></button>
                    <button style={{ ...topBtn, padding: '3px 9px', fontSize: 12, color: '#f08a82' }} title="Dårlig match — unngå"
                      onClick={() => { recordAiFeedback(aiLastPick.desc, aiLastPick.tplId, false); setAiLastPick(null); setMsg('Lærte: unngå denne malen for slike beskrivelser.'); }}><ThumbDownAltIcon style={{ fontSize: 15 }} /></button>
                  </div>
                )}
                {(aiFeedbackCount() > 0 || modelSteps() > 0) && <div style={{ fontSize: 9.5, color: D.faint, marginTop: 6 }}>Modellen har lært av {aiFeedbackCount()} signal{aiFeedbackCount() === 1 ? '' : 'er'} ({modelSteps()} treningssteg) — tomler, det du bruker, og alle brukere.</div>}
              </div>
            )}
            {/* «Mine maler»: import av egen HTML-mal. */}
            {leftSec === 'custom' && (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
                <div style={{ fontSize: 10.5, color: D.soft, fontWeight: 700, marginBottom: 6 }}>Importer HTML-mal</div>
                <div style={{ fontSize: 10, color: D.faint, lineHeight: 1.4, marginBottom: 6 }}>Malen skal lese <code>window.__CFG__</code> (felter utledes fra CFG.-referanser) og definere <code>window.setProgress(p)</code> for animasjon.</div>
                <input value={importName} onChange={(e) => setImportName(e.target.value)} placeholder="Navn på mal" style={{ ...inp, marginBottom: 6 }} />
                <textarea value={importHtml} onChange={(e) => setImportHtml(e.target.value)} placeholder="Lim inn HTML …"
                  style={{ width: '100%', height: 90, fontSize: 10.5, fontFamily: 'ui-monospace,monospace', padding: 8, borderRadius: 7, border: `1px solid ${D.line}`, background: D.panel2, color: D.ink, colorScheme: 'dark', resize: 'vertical', marginBottom: 6 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <label style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11 }}>Last opp .html<input type="file" accept=".html,text/html" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; if (!importName) setImportName(f.name.replace(/\.html?$/i, '')); const r = new FileReader(); r.onload = () => setImportHtml(typeof r.result === 'string' ? r.result : ''); r.readAsText(f); }} /></label>
                  <button style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11, background: D.accent, border: 'none' }} onClick={doImportTemplate}>+ Legg til</button>
                </div>
              </div>
            )}
            {/* Mal-søk — 512 maler; søk går på tvers av ALLE kategorier når query er satt. */}
            <input value={tplQuery} onChange={(e) => setTplQuery(e.target.value)} placeholder="🔍 Søk maler …"
              style={{ ...inp, marginBottom: 10 }} />
            {(() => {
              const q = tplQuery.trim().toLowerCase();
              const list = q
                ? INFOGRAPHIC_TEMPLATES.filter((t) => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.id.includes(q))
                : INFOGRAPHIC_TEMPLATES.filter((t) => inCategory(leftSec, t.id));
              return (<>
                {q && <div style={{ fontSize: 10.5, color: D.faint, marginBottom: 8 }}>{list.length} treff på tvers av alle kategorier</div>}
                <div style={{ display: 'grid', gap: 9 }}>
                  {list.map((t) => {
                    const selT = t.id === scene.tplId;
                    return (
                      <button key={t.id} onClick={() => pickTemplate(t.id)} style={{ textAlign: 'left', padding: 11, borderRadius: 10, cursor: 'pointer', border: `1.5px solid ${selT ? D.accent : D.line}`, background: selT ? D.panel2 : D.bg, color: D.ink, position: 'relative' }}>
                        <TemplateThumb tpl={t} accent={accent} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ display: 'inline-flex', color: t.style === 'hud' ? D.teal : D.accent }}>{tplIcon(t.id, 15)}</span>
                          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{t.name}</div>
                        </div>
                        <div style={{ fontSize: 11, color: D.soft, marginTop: 5, lineHeight: 1.35 }}>{t.desc}</div>
                        {isCustomTemplate(t.id) && (
                          <span role="button" title="Slett egen mal" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Slette «${t.name}»?`)) { removeCustomTemplate(t.id); if (scene.tplId === t.id) updateScene({ tplId: INFOGRAPHIC_TEMPLATES[0].id }); setCustomTick((n) => n + 1); } }}
                            style={{ position: 'absolute', top: 8, right: 9, color: D.faint, cursor: 'pointer', lineHeight: 1, display: 'inline-flex' }}><CloseIcon style={{ fontSize: 13 }} /></span>
                        )}
                      </button>
                    );
                  })}
                  {!list.length && <div style={{ fontSize: 11, color: D.faint, padding: 6 }}>Ingen maler matcher «{tplQuery}».</div>}
                </div>
              </>);
            })()}
          </>)}
          {leftSec === 'brand' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Brand Kit</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 64, height: 44, borderRadius: 8, border: `1px solid ${D.line}`, background: D.bg, display: 'grid', placeItems: 'center', overflow: 'hidden', flex: 'none' }}>
                {logo ? <img src={logo} alt="" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ fontSize: 10, color: D.faint }}>ingen</span>}
              </div>
              <label style={{ ...topBtn, fontSize: 12 }}>Last opp logo<input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickLogo(e.target.files?.[0] || null)} /></label>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 36, height: 28, border: `1px solid ${D.line}`, borderRadius: 6, background: D.bg, padding: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: 12, color: D.soft }}>Brand-farge <b style={{ color: D.ink }}>{accent}</b></span>
            </label>
            {suggested && suggested.toLowerCase() !== accent.toLowerCase() && (
              <div style={{ border: `1px solid ${D.line}`, background: D.bg, borderRadius: 9, padding: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 5, background: suggested, flex: 'none' }} />
                  <div style={{ fontSize: 11, color: D.soft, lineHeight: 1.35 }}>Logoen bruker <b style={{ color: D.ink }}>{suggested}</b>. La designet støtte den?</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button style={{ ...topBtn, padding: '4px 11px', fontSize: 11.5, background: suggested, border: 'none' }} onClick={() => { setAccent(suggested); setSuggested(''); }}>Bruk farge</button>
                  <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11.5 }} onClick={() => setSuggested('')}>Behold</button>
                </div>
              </div>
            )}
          </>)}
          {leftSec === 'data' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Data Sources</div>
            {/* Live datakilde: hent JSON/CSV fra en URL (API eller publisert Google Sheet). */}
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
              <div style={{ fontSize: 10.5, color: D.teal, fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><CloudDownloadIcon style={{ fontSize: 13 }} /> Live datakilde</div>
              <div style={{ fontSize: 10, color: D.faint, lineHeight: 1.4, marginBottom: 6 }}>URL til JSON-API eller publisert Google Sheet (CSV). Hentes uten CORS.</div>
              <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://… (JSON eller CSV)" style={{ ...inp, marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11.5, background: D.accent, border: 'none', opacity: liveBusy || !liveUrl.trim() ? 0.6 : 1 }} disabled={liveBusy || !liveUrl.trim()} onClick={() => void fetchLiveData()}>
                  <CloudDownloadIcon style={{ fontSize: 14 }} /> {liveBusy ? 'Henter …' : liveAt ? 'Oppdater' : 'Hent'}
                </button>
                {liveAt && <span style={{ fontSize: 9.5, color: D.faint }}>sist {liveAt}</span>}
              </div>
            </div>
            <div style={{ fontSize: 11, color: D.faint, lineHeight: 1.45, marginBottom: 8 }}>… eller lim inn JSON-objekt eller CSV (header-rad + verdi-rad). Bind så felter til kolonnene i Data-fanen — tallene fylles automatisk.</div>
            <textarea value={dataText} onChange={(e) => setDataText(e.target.value)}
              placeholder={'{"total_twh":"24.8T","renewable":"18.6%"}\n\neller CSV:\ntotal_twh,renewable\n24.8T,18.6%'}
              style={{ width: '100%', height: 150, fontSize: 11.5, fontFamily: 'ui-monospace,monospace', padding: 9, borderRadius: 8, border: `1px solid ${D.line}`, background: D.bg, color: D.ink, colorScheme: 'dark', resize: 'vertical' }} />
            {/* Norsk tallformat: 1234567 → «1 234 567», 12.5 → «12,5». */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: D.soft, margin: '10px 0 4px', cursor: 'pointer' }}>
              <input type="checkbox" checked={localizeNb} onChange={(e) => setLocalizeNb(e.target.checked)} />
              Norsk tallformat (1 234 567 · 12,5)
            </label>
            {dataKeys.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10.5, color: D.teal, fontWeight: 700, marginBottom: 6 }}>{dataKeys.length} felt funnet</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {dataKeys.map((k) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: D.soft, background: D.bg, borderRadius: 6, padding: '5px 8px' }}>
                      <span style={{ color: D.ink, fontWeight: 600 }}>{k}</span><span>{dataMap[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Multi-rad → én scene per rad (leaderboard, tabell osv.) */}
            {(() => { const rc = parseDataRows(dataText).rows.length; return rc >= 2 ? (
              <button style={{ ...topBtn, width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={batchFromRows}
                title="Lag én scene av gjeldende mal per datarad — kolonnene bindes til feltene i rekkefølge">
                <ContentCopyIcon style={{ fontSize: 15 }} /> Lag {rc} scener — én per rad
              </button>
            ) : null; })()}
          </>)}
          {leftSec === 'library' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Mine infographics <span style={{ color: D.faint, fontWeight: 500 }}>· gjenbruk på tvers av prosjekter</span></div>
            {/* Lagre gjeldende studio-tilstand som gjenbrukbar infographic. */}
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
              <div style={{ fontSize: 10.5, color: D.soft, fontWeight: 700, marginBottom: 6 }}>Lagre denne ({scenes.length} scene(r))</div>
              <input value={libName} onChange={(e) => setLibName(e.target.value)} placeholder={`${project?.name || 'Infographic'} …`} style={{ ...inp, marginBottom: 6 }} />
              <button style={{ ...topBtn, width: '100%', justifyContent: 'center', fontSize: 11.5, background: D.accent, border: 'none' }} onClick={saveCurrentToLibrary}><SaveIcon style={{ fontSize: 15 }} /> Lagre i biblioteket</button>
            </div>
            {savedList.length === 0
              ? <div style={{ fontSize: 11, color: D.faint, lineHeight: 1.5, padding: '8px 2px' }}>Ingen lagrede ennå. Lag en infographic og lagre den her — så kan du åpne og bygge videre på den i ethvert prosjekt.</div>
              : savedList.map((s) => {
                  const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === s.previewTplId) || INFOGRAPHIC_TEMPLATES[0];
                  const firstVals = s.previewValues || s.scenes[0]?.values || {};
                  return (
                    <div key={s.id} style={{ marginBottom: 10, padding: 8, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
                      <TemplateThumb tpl={t} accent={s.accent || accent} values={firstVals} />
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 9.5, color: D.faint, marginBottom: 6 }}>{s.scenes.length} scene(r){s.fromProject ? ` · ${s.fromProject}` : ''}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => loadSnapshot(s)}><FolderOpenIcon style={{ fontSize: 14 }} /> Åpne</button>
                        <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11 }} title="Del med teamet — synlig for alle innloggede" onClick={() => void shareEntry(s)}><GroupsIcon style={{ fontSize: 15 }} /></button>
                        <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11, color: '#f08a82' }} title="Slett fra biblioteket" onClick={() => { deleteInfographic(s.id); setLibTick((n) => n + 1); }}><DeleteOutlineIcon style={{ fontSize: 15 }} /></button>
                      </div>
                    </div>
                  );
                })}
            {/* Team-bibliotek: delt av alle innloggede (backend). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0 8px' }}>
              <GroupsIcon style={{ fontSize: 15, color: D.teal }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5 }}>Team-bibliotek</span>
              <div style={{ flex: 1 }} />
              <button style={{ ...topBtn, padding: '3px 8px', fontSize: 10.5, opacity: teamBusy ? 0.6 : 1 }} disabled={teamBusy} onClick={() => void loadTeamLibrary()} title="Oppdater"><RefreshIcon style={{ fontSize: 13 }} /></button>
            </div>
            {!canShareToTeam()
              ? <div style={{ fontSize: 10.5, color: D.faint, lineHeight: 1.5 }}>Logg inn (Role Room-token i Innstillinger) for å dele og se teamets bibliotek.</div>
              : teamList.length === 0
                ? <div style={{ fontSize: 10.5, color: D.faint, lineHeight: 1.5 }}>{teamBusy ? 'Henter …' : 'Ingen delte ennå. Trykk gruppe-ikonet på en av dine for å dele med teamet.'}</div>
                : teamList.map((s) => {
                    const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === s.previewTplId) || INFOGRAPHIC_TEMPLATES[0];
                    const firstVals = s.previewValues || {};
                    return (
                      <div key={s.id} style={{ marginBottom: 10, padding: 8, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
                        <TemplateThumb tpl={t} accent={s.accent || accent} values={firstVals} />
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 9.5, color: D.faint, marginBottom: 6 }}>{s.authorName ? `delt av ${s.authorName}` : 'delt'}{s.mine ? ' · deg' : ''} · {s.sceneCount || 0} scene(r)</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => void openTeam(s)}><FolderOpenIcon style={{ fontSize: 14 }} /> Åpne</button>
                          {s.mine && <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11, color: '#f08a82' }} title="Avdel fra teamet" onClick={async () => { await unshareFromTeam(s.id); void loadTeamLibrary(); }}><DeleteOutlineIcon style={{ fontSize: 15 }} /></button>}
                        </div>
                      </div>
                    );
                  })}
          </>)}
          {leftSec === 'insight' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Innsikt <span style={{ color: D.faint, fontWeight: 500 }}>· lærer modellen?</span></div>
            {/* Lokale lærte vekter vs. start — bevis på at modellen har flyttet seg. */}
            <div style={{ marginBottom: 12, padding: 10, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
              <div style={{ fontSize: 10.5, color: D.teal, fontWeight: 700, marginBottom: 8 }}>Din modell · {modelSteps()} treningssteg</div>
              {modelWeights().map((w) => {
                const moved = Math.abs(w.weight - w.base) > 0.02;
                const pct = Math.max(4, Math.min(100, (w.weight / 2.5) * 100));
                return (
                  <div key={w.label} style={{ marginBottom: 7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: D.soft, marginBottom: 2 }}>
                      <span>{w.label}</span>
                      <span style={{ color: moved ? D.teal : D.faint }}>{w.weight.toFixed(2)}{moved ? ` (start ${w.base.toFixed(1)})` : ''}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: D.panel2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: moved ? D.teal : D.accent }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 9.5, color: D.faint, marginTop: 4, lineHeight: 1.4 }}>Vektene starter likt for alle og forskyves når du gir tommel opp/ned, bruker og bytter maler.</div>
            </div>
            <button style={{ ...topBtn, width: '100%', justifyContent: 'center', fontSize: 11.5, marginBottom: 10, opacity: insightBusy ? 0.6 : 1 }} disabled={insightBusy} onClick={() => void loadInsight()}>
              <RefreshIcon style={{ fontSize: 15 }} /> {insightBusy ? 'Henter …' : 'Hent kollektiv innsikt'}
            </button>
            {insight && (
              <div style={{ padding: 10, borderRadius: 9, border: `1px solid ${D.line}`, background: D.bg }}>
                <div style={{ fontSize: 10.5, color: D.teal, fontWeight: 700, marginBottom: 6 }}>På tvers av alle brukere</div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {([['Signaler', insight.total], ['Bidragsytere', insight.contributors], ['Maler', insight.templates]] as const).map(([l, v]) => (
                    <div key={l} style={{ flex: 1, textAlign: 'center', padding: '6px 0', borderRadius: 7, background: D.panel2 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: D.ink }}>{v}</div>
                      <div style={{ fontSize: 9, color: D.faint }}>{l}</div>
                    </div>
                  ))}
                </div>
                {insight.top.length > 0 && (<>
                  <div style={{ fontSize: 9.5, color: D.faint, marginBottom: 5 }}>Mest brukte maler (kollektivt)</div>
                  {insight.top.slice(0, 8).map((t) => {
                    const tpl = INFOGRAPHIC_TEMPLATES.find((x) => x.id === t.tplId);
                    return (
                      <div key={t.tplId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: D.soft, padding: '3px 0' }}>
                        <span style={{ display: 'inline-flex', color: t.net >= 0 ? D.teal : '#f08a82' }}>{tplIcon(t.tplId, 13)}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl?.name || t.tplId}</span>
                        <span style={{ color: D.faint }}>{t.n}×</span>
                      </div>
                    );
                  })}
                </>)}
              </div>
            )}
            {!insight && !insightBusy && <div style={{ fontSize: 10.5, color: D.faint, lineHeight: 1.5 }}>Krever innlogging (Role Room-token). Henter anonymiserte aggregater fra backend — antall signaler, bidragsytere og topp-maler på tvers av alle brukere.</div>}
          </>)}
          {leftSec === 'export' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Format &amp; kvalitet</div>
            <div style={{ fontSize: 10.5, color: D.faint, marginBottom: 6 }}>Sosialt format</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {(['native', '9:16', '4:5', '1:1', '16:9'] as const).map((f) => (
                <button key={f} onClick={() => setFmt(f)} title={f === 'native' ? 'Malens naturlige størrelse (transparent overlay)' : `Komponer inn i ${f}`}
                  style={{ ...topBtn, justifyContent: 'center', fontSize: 11.5, padding: '7px 0', background: fmt === f ? D.accent : D.panel2, border: `1px solid ${fmt === f ? D.accent : D.line}` }}>
                  {f === 'native' ? 'Naturlig' : f === '9:16' ? '9:16 story' : f === '4:5' ? '4:5 feed' : f === '1:1' ? '1:1 kvadrat' : '16:9 wide'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: D.faint, marginBottom: 6 }}>Oppløsning</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[[2, '1080p'], [3, '1440p'], [4, '4K']].map(([sc, lbl]) => (
                <button key={String(sc)} onClick={() => setScale(sc as number)} style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11.5, padding: '6px 0', background: scale === sc ? D.accent : D.panel2, border: `1px solid ${scale === sc ? D.accent : D.line}` }}>{lbl}</button>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: D.faint, marginBottom: 6 }}>Bildefrekvens</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[24, 30, 60].map((f) => (
                <button key={f} onClick={() => setFps(f)} style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11.5, padding: '6px 0', background: fps === f ? D.accent : D.panel2, border: `1px solid ${fps === f ? D.accent : D.line}` }}>{f}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Eksporter fil</div>
            <div style={{ fontSize: 10.5, color: D.faint, marginBottom: 8, lineHeight: 1.4 }}>Gjeldende scene ({tpl.name}) → frittstående fil for social, web, e-post, slides. Havner i ~/Movies/Post Agent Infographics/.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
              {([['prores', 'ProRes (.mov, alfa)'], ['mp4', 'MP4 (svart bakgrunn)'], ['gif', 'GIF (transparent)'], ['apng', 'Animert PNG (alfa)'], ['png', 'Stillbilde (PNG)']] as const).map(([id, lbl]) => (
                <button key={id} onClick={() => setExportFmt(id)} title={lbl} style={{ ...topBtn, justifyContent: 'flex-start', fontSize: 11, padding: '7px 9px', background: exportFmt === id ? D.panel2 : D.bg, border: `1px solid ${exportFmt === id ? D.accent : D.line}` }}>{lbl}</button>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: D.soft, margin: '2px 0 10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeMeta} onChange={(e) => setIncludeMeta(e.target.checked)} />
              Bygg inn metadata (tittel + verktøy) i fila
            </label>
            <button style={{ ...topBtn, width: '100%', justifyContent: 'center', background: D.accent, border: 'none', opacity: exportBusy ? 0.6 : 1, marginBottom: 18 }} disabled={exportBusy} onClick={() => void exportFile()}>
              <FileDownloadIcon style={{ fontSize: 15 }} /> {exportBusy ? 'Eksporterer …' : 'Eksporter fil'}
            </button>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Resolve-overlay</div>
            <div style={{ fontSize: 10.5, color: D.faint, marginBottom: 6 }}>Overlay-spor</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[2, 3, 4].map((tr) => (
                <button key={tr} onClick={() => setOverlayTrack(tr)} style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11.5, padding: '6px 0', background: overlayTrack === tr ? D.accent : D.panel2, border: `1px solid ${overlayTrack === tr ? D.accent : D.line}` }}>V{tr}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: D.soft, lineHeight: 1.5 }}>Alle {scenes.length} scener rendres ({scale === 4 ? '4K' : scale === 3 ? '1440p' : '1080p'}, {fps}fps) + plasseres på spor V{overlayTrack} ved riktig tid med <b style={{ color: D.ink }}>Send to Resolve</b>.</div>
          </>)}
        </div>

        {/* Center */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, padding: 18, display: 'flex', flexDirection: 'column' }}>
            {/* flexWrap: verktøylinja (format-preset + Alle formater + Guides/Bakgrunn) tvang
                ellers midtkolonnen bredere enn ~600px → hele appen ble bredere enn smale
                vinduer → høyre Data-panel ble kuttet. Wrap lar den brytes og kolonnen krympe. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap', rowGap: 6 }}>
              <span style={{ fontSize: 11, color: D.faint }}>Canvas · scene {sel + 1} av {scenes.length} ({tpl.name}) · transparent overlay{playingAll ? ` · spiller sekvens ${scrubT.toFixed(1)}s / ${totalDur.toFixed(1)}s` : ''}</span>
              {/* Sosialt format-preset — ett klikk til 9:16 / 1:1 / 16:9. */}
              <div style={{ display: 'flex', gap: 3, marginLeft: 10, background: D.panel2, borderRadius: 8, padding: 2, border: `1px solid ${D.line}`, alignItems: 'center' }}>
                <AspectRatioIcon style={{ fontSize: 15, color: D.faint, margin: '0 2px 0 4px' }} />
                {(['native', '9:16', '4:5', '1:1', '16:9'] as const).map((f) => (
                  <button key={f} onClick={() => setFmt(f)} title={f === 'native' ? 'Malens naturlige størrelse (transparent overlay)' : `Komponer inn i ${f} for sosiale medier`}
                    style={{ padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: fmt === f ? D.accent : 'transparent', color: fmt === f ? '#fff' : D.soft }}>
                    {f === 'native' ? 'Naturlig' : f}
                  </button>
                ))}
              </div>
              <button onClick={() => setMultiPreview((v) => !v)} title="Se samme infographic i alle sosiale formater side ved side"
                style={{ ...topBtn, padding: '4px 10px', fontSize: 11, marginLeft: 8, background: multiPreview ? D.accent : D.panel2, border: `1px solid ${multiPreview ? D.accent : D.line}`, color: multiPreview ? '#fff' : D.ink }}>
                <ViewColumnIcon style={{ fontSize: 14 }} /> Alle formater
              </button>
              {multiPreview && (
                <button onClick={() => setMockup((v) => !v)} title="Vis i enhets-mockup (iPhone / feed-innlegg / nettleser)"
                  style={{ ...topBtn, padding: '4px 10px', fontSize: 11, marginLeft: 6, background: mockup ? D.accent : D.panel2, border: `1px solid ${mockup ? D.accent : D.line}`, color: mockup ? '#fff' : D.ink }}>
                  <PhoneIphoneIcon style={{ fontSize: 14 }} /> Mockup
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11, background: showGuides ? D.panel2 : 'transparent', border: `1px solid ${showGuides ? D.accent : D.line}` }} onClick={() => setShowGuides((v) => !v)} title="Vis/skjul linjaler + safe-frame"><TuneIcon style={{ fontSize: 14 }} /> Guides</button>
              {/* Composite: legg en still fra videoen bak overlay-en. */}
              <label style={{ ...topBtn, padding: '4px 10px', fontSize: 11 }} title="Legg et stillbilde fra videoen bak overlay-en for å se hvordan den lander">
                <ImageOutlinedIcon style={{ fontSize: 14 }} /> {bgImage ? 'Bytt bakgrunn' : 'Bakgrunn'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setBgImage(typeof r.result === 'string' ? r.result : ''); r.readAsDataURL(f); }} />
              </label>
              {bgImage && <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11 }} onClick={() => setBgImage('')}><CloseIcon style={{ fontSize: 14 }} /></button>}
            </div>
            {/* Plasserings-anbefaling for valgt sosialt format (enkelt-visning). */}
            {!multiPreview && fmt !== 'native' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 11, color: D.soft, background: D.panel2, border: `1px solid ${D.line}`, borderRadius: 8, padding: '5px 10px' }}>
                <PlaceIcon style={{ fontSize: 14, color: D.teal }} /> <b style={{ color: D.ink }}>{fmt}:</b> {placementAdviceFor(tpl.id, fmtAspect())}
              </div>
            )}
            {multiPreview ? (
              // Side-ved-side: alle sosiale formater av samme infographic (frosset
              // ved sluttbildet). Klikk et kort → velg det formatet for render/eksport.
              <div style={{ position: 'relative', flex: 1, borderRadius: 12, overflow: 'hidden', border: `1px solid ${D.line}`, background: '#0b1120', padding: 16 }}>
                <div style={{ display: 'flex', gap: 18, height: '100%', justifyContent: 'flex-start', alignItems: 'center', overflowX: 'auto', padding: '0 4px' }}>
                  {PLATFORMS.map((pf) => (
                    <FormatPreview key={pf.id} srcDoc={formatSrcDoc} aspect={pf.aspect} label={pf.name} sub={pf.sub} bg={bgImage}
                      active={fmt === pf.fmt} mockup={mockup} advice={placementAdviceFor(tpl.id, pf.aspect)} zones={pf.zones} platform={pf.id}
                      onClick={() => { setFmt(pf.fmt); setMultiPreview(false); }} />
                  ))}
                </div>
              </div>
            ) : (
            <div ref={canvasRef} style={{ position: 'relative', flex: 1, borderRadius: 12, overflow: 'hidden', border: `1px solid ${D.line}`, background: '#0b1120', display: 'grid', placeItems: 'center', padding: fmt === 'native' ? 0 : 14 }}>
              {/* Ramme: naturlig = fyll boksen; ellers vis eksakt sosialt forhold. */}
              <div style={{ position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', background: bgImage ? '#000' : 'linear-gradient(135deg,#10182a,#0b1120)', ...(fmt === 'native' ? { width: '100%', height: '100%' } : { height: '100%', maxWidth: '100%', aspectRatio: String(fmtAspect()), borderRadius: 8, boxShadow: `0 0 0 1px ${D.line}` }) }}>
                {bgImage && <img src={bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }} />}
                <iframe ref={iframeRef} title="preview" srcDoc={srcDoc} onLoad={onIframeLoad} style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', minHeight: fmt === 'native' ? 140 : 0, border: 0, background: 'transparent' }} />
                {/* Scene-brødsmule (som konseptets «Scene 03 · Main Stats»). */}
                <div style={{ position: 'absolute', top: 8, left: 10, zIndex: 3, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 6, background: 'rgba(11,17,32,0.7)', border: `1px solid ${D.line}`, fontSize: 10.5, color: D.soft, pointerEvents: 'none' }}>
                  <span style={{ display: 'inline-flex', color: tpl.style === 'hud' ? D.teal : D.accent }}>{tplIcon(tpl.id, 12)}</span>
                  Scene {sel + 1} · {scene.name || tpl.name}
                </div>
                {/* Linjaler + safe-frame (stiplet) for presis plassering. */}
                {showGuides && <>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, zIndex: 2, pointerEvents: 'none', background: 'repeating-linear-gradient(90deg, rgba(130,150,190,0.22) 0 1px, transparent 1px 40px)' }} />
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 12, zIndex: 2, pointerEvents: 'none', background: 'repeating-linear-gradient(180deg, rgba(130,150,190,0.22) 0 1px, transparent 1px 40px)' }} />
                  <div style={{ position: 'absolute', inset: '5%', border: '1px dashed rgba(130,150,190,0.4)', borderRadius: 3, zIndex: 2, pointerEvents: 'none' }} />
                </>}
              </div>
            </div>
            )}
          </div>
          {/* Rik multi-scene-tidslinje: transport + timecode + zoom + dra scener
              som klipp (body = flytt, høyre kant = endre varighet). */}
          <div style={{ borderTop: `1px solid ${D.line}`, background: D.panel, padding: '8px 16px 6px' }}>
            {(() => {
              const spans = scenes.map((sc) => { const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0]; return { a: sc.atSec, b: sc.atSec + effDur(sc, t) }; });
              const overlap = spans.some((s, i) => spans.some((o, j) => j !== i && s.a < o.b && o.a < s.b));
              const px = tlZoom;
              const innerW = Math.max(320, totalDur * px + 60);
              const rowH = 24;
              const tickStep = px < 55 ? 2 : 1;
              const ticks: number[] = []; for (let s = 0; s <= Math.ceil(totalDur); s += tickStep) ticks.push(s);
              return (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                  <button style={{ ...topBtn, padding: '3px 6px' }} onClick={() => scrubTo(0)} title="Til start"><SkipPreviousIcon style={{ fontSize: 16 }} /></button>
                  <button style={{ ...topBtn, padding: '3px 6px' }} onClick={() => jumpScene(-1)} title="Forrige scene"><FastRewindIcon style={{ fontSize: 16 }} /></button>
                  <button style={{ ...topBtn, padding: '3px 9px' }} onClick={() => (playingAll ? stopPlayAll() : playAll())} title="Spill / pause">{playingAll ? <PauseIcon style={{ fontSize: 16 }} /> : <PlayArrowIcon style={{ fontSize: 16 }} />}</button>
                  <button style={{ ...topBtn, padding: '3px 6px' }} onClick={() => jumpScene(1)} title="Neste scene"><FastForwardIcon style={{ fontSize: 16 }} /></button>
                  <button style={{ ...topBtn, padding: '3px 6px' }} onClick={() => scrubTo(totalDur)} title="Til slutt"><SkipNextIcon style={{ fontSize: 16 }} /></button>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: D.ink, marginLeft: 8, fontWeight: 600 }}>{fmtTC(scrubT)} <span style={{ color: D.faint, fontWeight: 400 }}>/ {fmtTC(totalDur)}</span></span>
                  {overlap && <span style={{ fontSize: 10.5, color: '#f0a882', display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 8 }}><WarningAmberIcon style={{ fontSize: 12 }} /> overlapp</span>}
                  <div style={{ flex: 1 }} />
                  <button style={{ ...topBtn, padding: '3px 6px', background: loopAll ? D.accent : D.panel2, border: `1px solid ${loopAll ? D.accent : D.line}`, color: loopAll ? '#fff' : D.ink }} onClick={() => setLoopAll((v) => !v)} title="Loop hele sekvensen"><RepeatIcon style={{ fontSize: 15 }} /></button>
                  <ZoomOutIcon style={{ fontSize: 15, color: D.faint, marginLeft: 4 }} />
                  <input type="range" min={30} max={260} value={tlZoom} onChange={(e) => setTlZoom(parseInt(e.target.value, 10))} style={{ width: 90 }} title="Zoom tidslinje" />
                  <ZoomInIcon style={{ fontSize: 15, color: D.faint }} />
                </div>
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 148 }}>
                  <div style={{ position: 'relative', width: innerW }}>
                    {/* Linjal — klikk for å scrubbe. */}
                    <div onMouseDown={(e) => { const r = e.currentTarget.getBoundingClientRect(); scrubTo(Math.max(0, Math.min(totalDur, (e.clientX - r.left) / px))); }}
                      style={{ position: 'relative', height: 16, borderBottom: `1px solid ${D.line}`, cursor: 'pointer' }}>
                      {ticks.map((s) => (
                        <div key={s} style={{ position: 'absolute', left: s * px, top: 0, bottom: 0, borderLeft: `1px solid ${D.line}`, paddingLeft: 3, fontSize: 8.5, color: D.faint }}>{s}s</div>
                      ))}
                    </div>
                    {/* Én rad per scene som dragbart klipp. */}
                    <div style={{ position: 'relative', paddingTop: 4 }}>
                      {scenes.map((sc, i) => {
                        const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
                        const left = sc.atSec * px, w = Math.max(16, effDur(sc, t) * px);
                        const active = i === sel;
                        return (
                          <div key={sc.id} style={{ position: 'relative', height: rowH, marginBottom: 3 }}>
                            <div onPointerDown={(e) => onClipDrag(e, i, 'move')} onClick={() => setSel(i)}
                              title={`${sc.name || t.name} · ${sc.atSec.toFixed(1)}–${(sc.atSec + effDur(sc, t)).toFixed(1)}s`}
                              style={{ position: 'absolute', left, width: w, top: 0, height: rowH, borderRadius: 5, background: active ? D.accent : D.panel2, border: `1px solid ${active ? D.accent : D.line}`, display: 'flex', alignItems: 'center', gap: 5, padding: '0 8px', overflow: 'hidden', cursor: 'grab', color: active ? '#fff' : D.soft, fontSize: 10.5, whiteSpace: 'nowrap', userSelect: 'none', touchAction: 'none' }}>
                              <span style={{ display: 'inline-flex', flex: 'none' }}>{tplIcon(sc.tplId, 12)}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sc.name || t.name}</span>
                              <div onPointerDown={(e) => onClipDrag(e, i, 'resize')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 7, cursor: 'ew-resize', background: 'rgba(255,255,255,0.14)' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Playhead. */}
                    <div style={{ position: 'absolute', left: scrubT * px, top: 0, bottom: 0, width: 2, background: D.teal, pointerEvents: 'none', zIndex: 5 }} />
                  </div>
                </div>
              </>);
            })()}
          </div>
          {/* Scener: verktøylinje (angre/gjenta/dupliser/slett) + filmstrip m/ ekte
              thumbnails, dupliser + flytt (rekkefølge). */}
          <div style={{ borderTop: `1px solid ${D.line}`, background: D.panel, padding: '8px 16px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5 }}>Scener <span style={{ color: D.faint }}>· {scenes.length}</span></span>
              <button style={{ ...topBtn, padding: '3px 7px', marginLeft: 6, opacity: canUndo ? 1 : 0.4 }} disabled={!canUndo} onClick={undo} title="Angre (⌘Z)"><UndoIcon style={{ fontSize: 15 }} /></button>
              <button style={{ ...topBtn, padding: '3px 7px', opacity: canRedo ? 1 : 0.4 }} disabled={!canRedo} onClick={redo} title="Gjenta (⇧⌘Z)"><RedoIcon style={{ fontSize: 15 }} /></button>
              <div style={{ width: 1, height: 15, background: D.line, margin: '0 3px' }} />
              <button style={{ ...topBtn, padding: '3px 7px' }} onClick={() => duplicateScene(sel)} title="Dupliser valgt scene"><ContentCopyIcon style={{ fontSize: 15 }} /></button>
              <button style={{ ...topBtn, padding: '3px 7px', opacity: scenes.length > 1 ? 1 : 0.4 }} disabled={scenes.length <= 1} onClick={() => deleteScene(sel)} title="Slett valgt scene"><DeleteOutlineIcon style={{ fontSize: 15 }} /></button>
              <button style={{ ...topBtn, padding: '3px 7px' }} onClick={() => play()} title="Spill valgt scene"><PlayArrowIcon style={{ fontSize: 15 }} /></button>
              <div style={{ flex: 1 }} />
              <input value={scene.name ?? ''} onChange={(e) => updateScene({ name: e.target.value })} placeholder={tpl.name} title="Scene-navn" style={{ ...inp, width: 140, flex: 'none' }} />
              <label style={{ fontSize: 12, color: D.soft, display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>ved
                <input style={{ ...inp, width: 58 }} type="number" min="0" step="0.5" value={scene.atSec} onChange={(e) => updateScene({ atSec: parseFloat(e.target.value) || 0 })} /> s</label>
              {CALLOUT_IDS.has(scene.tplId) && (
                <label style={{ fontSize: 12, color: D.soft, display: 'flex', alignItems: 'center', gap: 5, flex: 'none' }} title="Hvor callouten peker (% av ramme)"><CenterFocusStrongIcon style={{ fontSize: 14 }} />
                  <input style={{ ...inp, width: 50 }} type="number" min="0" max="100" value={scene.posX ?? 50} onChange={(e) => updateScene({ posX: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} />
                  <input style={{ ...inp, width: 50 }} type="number" min="0" max="100" value={scene.posY ?? 50} onChange={(e) => updateScene({ posY: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} /></label>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {scenes.map((sc, i) => {
                const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
                const active = i === sel;
                return (
                  <div key={sc.id} onClick={() => setSel(i)} style={{ width: 132, flex: 'none', borderRadius: 9, border: `2px solid ${active ? D.accent : D.line}`, background: active ? D.panel2 : D.bg, cursor: 'pointer', padding: 7, position: 'relative' }}>
                    <TemplateThumb tpl={t} accent={sceneAccent(sc)} values={fieldVals(sc, t)} height={40} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-flex', color: t.style === 'hud' ? D.teal : D.accent, flex: 'none' }}>{tplIcon(sc.tplId, 12)}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name || t.name}</span>
                    </div>
                    <div style={{ fontSize: 9, color: D.faint, marginTop: 1 }}>{i + 1} · {sc.atSec}s</div>
                    <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2 }}>
                      <button onClick={(e) => { e.stopPropagation(); duplicateScene(i); }} title="Dupliser" style={{ border: 'none', background: 'rgba(0,0,0,0.35)', borderRadius: 4, color: '#cdd6ea', cursor: 'pointer', lineHeight: 1, padding: 2, display: 'inline-flex' }}><ContentCopyIcon style={{ fontSize: 11 }} /></button>
                      {scenes.length > 1 && <button onClick={(e) => { e.stopPropagation(); deleteScene(i); }} title="Slett" style={{ border: 'none', background: 'rgba(0,0,0,0.35)', borderRadius: 4, color: '#f0a89f', cursor: 'pointer', lineHeight: 1, padding: 2, display: 'inline-flex' }}><CloseIcon style={{ fontSize: 12 }} /></button>}
                    </div>
                    {scenes.length > 1 && (
                      <div style={{ position: 'absolute', bottom: 6, right: 5, display: 'flex', gap: 1 }}>
                        {i > 0 && <button onClick={(e) => { e.stopPropagation(); moveScene(i, -1); }} title="Flytt venstre" style={{ border: 'none', background: 'rgba(0,0,0,0.3)', borderRadius: 3, color: '#cdd6ea', cursor: 'pointer', padding: 0, display: 'inline-flex' }}><ChevronLeftIcon style={{ fontSize: 14 }} /></button>}
                        {i < scenes.length - 1 && <button onClick={(e) => { e.stopPropagation(); moveScene(i, 1); }} title="Flytt høyre" style={{ border: 'none', background: 'rgba(0,0,0,0.3)', borderRadius: 3, color: '#cdd6ea', cursor: 'pointer', padding: 0, display: 'inline-flex' }}><ChevronRightIcon style={{ fontSize: 14 }} /></button>}
                      </div>
                    )}
                  </div>
                );
              })}
              <div onClick={addScene} style={{ width: 56, flex: 'none', borderRadius: 9, border: `1px dashed ${D.line}`, display: 'grid', placeItems: 'center', color: D.faint, cursor: 'pointer' }} title="Ny scene"><AddIcon style={{ fontSize: 22 }} /></div>
            </div>
          </div>
          {(msg || renderProgress) && (
            <div style={{ padding: '8px 16px', borderTop: `1px solid ${D.line}`, background: D.panel }}>
              {renderProgress && (
                <div style={{ height: 4, borderRadius: 2, background: D.bg, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${Math.round((renderProgress.done / Math.max(1, renderProgress.total)) * 100)}%`, background: D.accent, transition: 'width .3s' }} />
                </div>
              )}
              {msg && <div style={{ fontSize: 12, color: msg.startsWith('Feil') ? '#f08a82' : D.soft, display: 'flex', alignItems: 'center', gap: 8 }}>
                {msg.startsWith('Feil') ? <ErrorOutlineIcon style={{ fontSize: 15 }} /> : <CheckCircleOutlineIcon style={{ fontSize: 15, color: D.teal }} />}
                <span style={{ flex: 1 }}>{msg}</span>
                {needsPlaywright && <button style={{ ...topBtn, padding: '4px 11px', fontSize: 11.5 }} onClick={() => void doSetupPlaywright()}>Sett opp Playwright</button>}
              </div>}
            </div>
          )}
        </div>

        {/* Høyre: Design / Animate / Data */}
        <div style={{ width: 280, borderLeft: `1px solid ${D.line}`, background: D.panel, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${D.line}` }}>
            {(['Design', 'Animate', 'Data'] as const).map((t) => <div key={t} style={tabBtn(rightTab === t)} onClick={() => setRightTab(t)}>{t}</div>)}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {rightTab === 'Data' && (<>
              {/* Data-binding-sammendrag: kilde + bundne felt (fremhevet, som konseptets Source→Value). */}
              {(() => {
                const bound = Object.entries(scene.bindings || {}).filter(([, v]) => v);
                const sourceLabel = liveUrl.trim() ? (() => { try { return new URL(liveUrl).host; } catch { return 'live'; } })() : (dataKeys.length ? 'limt inn data' : 'ingen');
                return (
                  <div style={{ marginBottom: 12, padding: 10, borderRadius: 9, border: `1px solid ${bound.length ? D.teal : D.line}`, background: D.bg }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: bound.length ? 7 : 0 }}>
                      <DatasetIcon style={{ fontSize: 14, color: bound.length ? D.teal : D.faint }} />
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: D.soft }}>Datakilde</span>
                      <span style={{ fontSize: 10.5, color: bound.length ? D.teal : D.faint, marginLeft: 'auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{sourceLabel}{dataKeys.length ? ` · ${dataKeys.length} felt` : ''}</span>
                    </div>
                    {bound.length > 0 ? bound.map(([k, v]) => {
                      const f = tpl.fields.find((x) => x.key === k);
                      return (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, padding: '2px 0' }}>
                          <span style={{ color: D.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f?.label || k}</span>
                          <span style={{ color: D.faint }}>→</span>
                          <span style={{ color: D.teal, fontWeight: 600 }}>{v}</span>
                          <button onClick={() => setBinding(k, '')} title="Fjern binding" style={{ border: 'none', background: 'transparent', color: D.faint, cursor: 'pointer', padding: 0, display: 'inline-flex' }}><CloseIcon style={{ fontSize: 12 }} /></button>
                        </div>
                      );
                    }) : <div style={{ fontSize: 9.5, color: D.faint, marginTop: 6, lineHeight: 1.4 }}>Bind felt til datakilde-kolonner nedenfor — verdiene fylles automatisk og oppdateres når kilden endres.</div>}
                  </div>
                );
              })()}
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 10 }}>Innhold · scene {sel + 1}</div>
              <div style={{ display: 'grid', gap: 9 }}>
                {tpl.fields.map((f) => {
                  const bound = scene.bindings?.[f.key];
                  return (
                    <div key={f.key} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: D.soft }}>{f.label}</span>
                        {dataKeys.length > 0 && !isIconField(f.key) && (
                          <select value={bound || ''} onChange={(e) => setBinding(f.key, e.target.value)}
                            title="Bind til datakilde"
                            style={{ fontSize: 10, padding: '1px 4px', borderRadius: 5, border: `1px solid ${bound ? D.teal : D.line}`, background: D.bg, color: bound ? D.teal : D.faint, colorScheme: 'dark' }}>
                            <option value="">bind…</option>
                            {dataKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                          </select>
                        )}
                      </div>
                      {bound
                        ? <input style={{ ...inp, borderColor: D.teal, color: D.teal }} readOnly value={dataMap[bound] ?? ''} title={`Bundet til ${bound}`} />
                        : isIconField(f.key)
                          ? <IconField value={scene.values[f.key] ?? tpl.defaults[f.key] ?? ''} onChange={(v) => setValue(f.key, v)} />
                          : <input style={inp} placeholder={f.placeholder} value={scene.values[f.key] ?? tpl.defaults[f.key] ?? ''} onChange={(e) => setValue(f.key, e.target.value)} />}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', margin: '16px 0 8px' }}>Transparency / Export</div>
              <div style={{ fontSize: 12, color: D.soft, lineHeight: 1.5 }}>Background: <b style={{ color: D.ink }}>Transparent</b> · Format: <b style={{ color: D.ink }}>ProRes 4444</b></div>
            </>)}
            {rightTab === 'Design' && (<>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 8 }}>Color Palette <span style={{ color: D.faint, fontWeight: 500 }}>· prosjekt-default</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {palette.map((c, i) => (
                  <button key={i} onClick={() => setAccent(c)} title={c} style={{ width: 30, height: 30, borderRadius: 8, background: c, border: `2px solid ${accent.toLowerCase() === c.toLowerCase() ? D.ink : D.line}`, cursor: 'pointer' }} />
                ))}
                <label style={{ width: 30, height: 30, borderRadius: 8, border: `1px dashed ${D.line}`, display: 'grid', placeItems: 'center', color: D.soft, cursor: 'pointer' }}><AddIcon style={{ fontSize: 16 }} />
                  <input type="color" style={{ display: 'none' }} onChange={(e) => { setPalette((p) => [...p, e.target.value]); setAccent(e.target.value); }} />
                </label>
              </div>
              {/* Per-scene brand-overstyring (før: brand var globalt for alle scener). */}
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 8 }}>Denne scenen · brand</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <input type="color" value={sceneAccent(scene)} onChange={(e) => updateScene({ accent: e.target.value })} style={{ width: 36, height: 28, border: `1px solid ${D.line}`, borderRadius: 6, background: D.bg, padding: 0, cursor: 'pointer' }} />
                <span style={{ fontSize: 12, color: D.soft }}>Farge {scene.accent ? <b style={{ color: D.ink }}>{scene.accent}</b> : <span style={{ color: D.faint }}>(arver {accent})</span>}</span>
              </label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {scene.accent && <button style={{ ...topBtn, padding: '4px 10px', fontSize: 11.5 }} onClick={() => updateScene({ accent: undefined, logo: undefined })}>Nullstill til default</button>}
                <button style={{ ...topBtn, padding: '4px 10px', fontSize: 11.5 }} onClick={() => setScenes((ss) => ss.map((s) => ({ ...s, accent: sceneAccent(scene), logo: sceneLogo(scene) || undefined })))} title="Bruk denne scenens brand på alle scener">Bruk på alle</button>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 8 }}>Typography</div>
              <div style={{ fontSize: 12, color: D.soft }}>Inter · Semi Bold</div>
            </>)}
            {rightTab === 'Animate' && (<>
              {/* Ekte kontroll: varighet per scene styrer både preview OG rendret
                  klipp-lengde (før var varigheten låst til malen). */}
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', marginBottom: 8 }}>Varighet · scene {sel + 1}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <input type="range" min={1} max={20} step={0.5} value={effDur(scene, tpl)} onChange={(e) => updateScene({ durSec: parseFloat(e.target.value) })} style={{ flex: 1 }} />
                <input style={{ ...inp, width: 64 }} type="number" min={1} step={0.5} value={effDur(scene, tpl)} onChange={(e) => updateScene({ durSec: Math.max(1, parseFloat(e.target.value) || tpl.durationSec) })} /><span style={{ fontSize: 12, color: D.soft }}>s</span>
              </div>
              {scene.durSec != null && <button style={{ ...topBtn, padding: '4px 10px', fontSize: 11.5, marginBottom: 12 }} onClick={() => updateScene({ durSec: undefined })}>Tilbakestill til mal ({tpl.durationSec}s)</button>}
              {/* Inngang: ytre wrapper-effekt på hele overlay-en (preview + render). */}
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', margin: '4px 0 8px' }}>Inngang</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                {ENTRANCE_ORDER.map((en) => {
                  const active = (scene.entrance || 'none') === en;
                  return (
                    <button key={en} onClick={() => { updateScene({ entrance: en }); window.setTimeout(() => play(), 30); }}
                      style={{ ...topBtn, justifyContent: 'center', fontSize: 11, padding: '6px 0', background: active ? D.accent : D.panel2, border: `1px solid ${active ? D.accent : D.line}` }}>
                      {ENTRANCE_LABEL[en]}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 9.5, color: D.faint, lineHeight: 1.4, marginBottom: 14 }}>Bevegelsen (skyv/skalér) vises i preview; i render brukes easing + mykt fade-inn.</div>
              {/* Easing: remapper progresjonen (både preview og render). */}
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', margin: '4px 0 8px' }}>Easing <span style={{ color: D.faint, fontWeight: 500 }}>· kurve</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                {(['linear', 'out', 'inout', 'outcubic'] as EasingKind[]).map((ek) => {
                  const active = (scene.easing || 'outcubic') === ek;
                  return (
                    <button key={ek} onClick={() => { updateScene({ easing: ek }); window.setTimeout(() => play(), 30); }}
                      style={{ ...topBtn, justifyContent: 'center', fontSize: 11, padding: '6px 0', background: active ? D.accent : D.panel2, border: `1px solid ${active ? D.accent : D.line}` }}>
                      {EASING_LABEL[ek]}
                    </button>
                  );
                })}
              </div>
              {/* Exit: fade ut på slutten (ekte alfa-fade i render + speilet i preview). */}
              <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', margin: '4px 0 8px' }}>Utgang</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button onClick={() => updateScene({ exitSec: 0 })} style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11.5, padding: '6px 0', background: (scene.exitSec ?? 0) === 0 ? D.accent : D.panel2, border: `1px solid ${(scene.exitSec ?? 0) === 0 ? D.accent : D.line}` }}>Hardt kutt</button>
                <button onClick={() => updateScene({ exitSec: scene.exitSec && scene.exitSec > 0 ? scene.exitSec : 0.5 })} style={{ ...topBtn, flex: 1, justifyContent: 'center', fontSize: 11.5, padding: '6px 0', background: (scene.exitSec ?? 0) > 0 ? D.accent : D.panel2, border: `1px solid ${(scene.exitSec ?? 0) > 0 ? D.accent : D.line}` }}>Fade ut</button>
              </div>
              {(scene.exitSec ?? 0) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <input type="range" min={0.2} max={2} step={0.1} value={scene.exitSec ?? 0.5} onChange={(e) => updateScene({ exitSec: parseFloat(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: D.soft, minWidth: 34 }}>{(scene.exitSec ?? 0.5).toFixed(1)}s</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, margin: '10px 0 12px' }}>
                <button style={{ ...topBtn, flex: 1, justifyContent: 'center' }} onClick={() => play()}><PlayArrowIcon style={{ fontSize: 16 }} /> Spill scene</button>
                <button style={{ ...topBtn, flex: 1, justifyContent: 'center' }} onClick={() => (playingAll ? stopPlayAll() : playAll())}>{playingAll ? <><PauseIcon style={{ fontSize: 16 }} /> Stopp</> : <><SlideshowIcon style={{ fontSize: 16 }} /> Spill alt</>}</button>
              </div>
              <div style={{ fontSize: 10.5, color: D.faint, lineHeight: 1.45 }}>Bevegelsen (count-up, søyle-vekst, stagger, fade/slide) er designet inn i hver mal og kjøres deterministisk av <code style={{ color: D.soft }}>setProgress</code> — derfor ser den alltid proff ut. Varighet styrer hvor lenge den spilles av.</div>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
