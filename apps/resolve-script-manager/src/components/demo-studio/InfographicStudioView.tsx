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
  type InfographicTemplate,
} from './infographicStudio';
import { FONT_FACE_CSS } from './fontAssets.generated';
import { ROLE_ROOM_LOGO, CREATORHUB_LOGO } from './kitLogos.generated';

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

const CATEGORY_IDS: Record<string, Set<string>> = {
  charts: CHART_IDS, marketing: MARKETING_IDS, filmtv: FILMTV_IDS,
  callouts: CALLOUT_IDS, ui: UI_IDS, uxlayout: UX_LAYOUT_IDS,
};
// Brand-kits matcher på id-PREFIKS (rr-/ch-) så alle branded maler auto-inkluderes.
const kitPrefix = (sec: string): string | null => (sec === 'kit-rr' ? 'rr-' : sec === 'kit-ch' ? 'ch-' : null);
const inCategory = (sec: string, id: string): boolean => {
  const pre = kitPrefix(sec);
  if (pre) return id.startsWith(pre);
  return CATEGORY_IDS[sec] ? CATEGORY_IDS[sec].has(id) : true;
};
const CATEGORY_LABEL: Record<string, string> = {
  templates: 'Templates', charts: 'Charts', marketing: 'Marketing', filmtv: 'Film & TV',
  callouts: 'Callouts', ui: 'UI-elementer', uxlayout: 'Layout & UX', 'kit-rr': 'The Role Room', 'kit-ch': 'Creatorhub',
};

interface Scene {
  id: string; tplId: string; values: Record<string, string>; atSec: number;
  bindings?: Record<string, string>; posX?: number; posY?: number;
  /** Per-scene overstyringer (faller tilbake til prosjekt-default når tomme). */
  durSec?: number; accent?: string; logo?: string;
  /** Exit: sekunder fade-ut på slutten (0/udefinert = hardt kutt). */
  exitSec?: number;
}
let _sid = 1;
const newScene = (tplId: string, atSec: number): Scene => ({ id: `s${_sid++}`, tplId, values: {}, atSec, bindings: {} });

// ── Persistering: hele studio-tilstanden overlever reload (før: alt i useState
//    → tapt ved refresh). Nøklet pr. prosjekt så flere demoer holdes adskilt. ──
const LS_PREFIX = 'trrpa.infographicStudio.';
interface StudioState { scenes: Scene[]; sel: number; accent: string; logo: string; dataText: string; palette: string[] }
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
    const headers = lines[0].split(sep).map((s) => s.trim()).filter(Boolean);
    const rows = lines.slice(1).map((ln) => {
      const cells = ln.split(sep).map((s) => s.trim());
      const r: Record<string, string> = {};
      headers.forEach((h, i) => { r[h] = cells[i] ?? ''; });
      return r;
    });
    return { headers, rows };
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
      Object.entries(j[0] as Record<string, unknown>).forEach(([k, v]) => { out[k] = String(v); });
      return out;
    }
  } catch { /* ikke JSON — prøv CSV */ }
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2) {
    const sep = lines[0].includes(';') ? ';' : ',';
    const heads = lines[0].split(sep).map((s) => s.trim());
    const vals = lines[1].split(sep).map((s) => s.trim());
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

/** Lett live-thumbnail av en mal i galleriet: lazy iframe (kun når synlig),
 *  rå HTML u/ font-injeksjon, skalert til å passe + frosset ved p=1. */
function TemplateThumb({ tpl, accent }: { tpl: InfographicTemplate; accent: string }) {
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
    const cfg = buildInfographicConfig(tpl, {}, { accent, ink: '#1f2d4a' });
    return `<script>window.__CFG__=${JSON.stringify(cfg)}</script>` + rawTemplateHtml(tpl);
  }, [tpl, accent]);
  const fit = () => {
    try {
      const box = boxRef.current, ifr = frameRef.current, doc = ifr?.contentDocument;
      const wrap = doc?.getElementById('wrap') as HTMLElement | null;
      if (!box || !doc || !wrap) return;
      if (doc.body) doc.body.style.cssText = 'margin:0;height:100%;display:grid;place-items:center;overflow:hidden;background:transparent';
      wrap.style.transform = 'none';
      const k = Math.min((box.clientWidth - 8) / (wrap.scrollWidth || 1), (box.clientHeight - 8) / (wrap.scrollHeight || 1), 1);
      wrap.style.transformOrigin = 'center center';
      wrap.style.transform = `scale(${k.toFixed(4)})`;
      (ifr!.contentWindow as unknown as { setProgress?: (p: number) => void })?.setProgress?.(1);
    } catch { /* */ }
  };
  return (
    <div ref={boxRef} style={{ width: '100%', height: 52, borderRadius: 8, overflow: 'hidden', background: 'linear-gradient(135deg,#10182a,#0b1120)', marginBottom: 8 }}>
      {visible && <iframe ref={frameRef} title="" srcDoc={src} onLoad={() => window.setTimeout(fit, 120)} style={{ width: '100%', height: '100%', border: 0, background: 'transparent', pointerEvents: 'none' }} />}
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
  const [suggested, setSuggested] = useState('');
  const [rightTab, setRightTab] = useState<'Design' | 'Animate' | 'Data'>('Data');
  const [leftSec, setLeftSec] = useState<'templates' | 'charts' | 'marketing' | 'filmtv' | 'callouts' | 'ui' | 'uxlayout' | 'kit-rr' | 'kit-ch' | 'brand' | 'data' | 'export'>('templates');
  const [tplQuery, setTplQuery] = useState('');
  const [dataText, setDataText] = useState(initial.current?.dataText || '');
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
  // Composite-preview: still fra videoen bak den transparente overlay-en, så du
  // ser hvordan den lander over ekte film (kontrast/lesbarhet). Kun preview.
  const [bgImage, setBgImage] = useState('');
  const cancelRef = useRef(false);
  const [msg, setMsg] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Autolagre (debounced) — hele tilstanden overlever reload.
  useEffect(() => {
    const h = setTimeout(() => saveStudio(storeKey, { scenes, sel, accent, logo, dataText, palette }), 400);
    return () => clearTimeout(h);
  }, [scenes, sel, accent, logo, dataText, palette, storeKey]);

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
  const pickTemplate = (id: string) => updateScene({ tplId: id });
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
    setSel((s) => Math.max(0, Math.min(s, scenes.length - 2)));
  };

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
  const srcDoc = useMemo(() => `<script>window.__CFG__=${JSON.stringify(config)}</script>` + htmlForTemplate(tpl), [config, tpl]);

  const previewWin = () => iframeRef.current?.contentWindow as (Window & { setProgress?: (p: number) => void }) | null | undefined;
  const setPreviewProgress = (p: number) => { const w = previewWin(); if (w && typeof w.setProgress === 'function') { try { w.setProgress(Math.max(0, Math.min(1, p))); } catch { /* */ } } };

  // Skaler malens innhold (#wrap, natural-bredde) så det passer i canvasen —
  // før overflommet flerkorts-maler og ble klippet. Kjøres på load + resize.
  const fitPreview = () => {
    try {
      const ifr = iframeRef.current; const canvas = canvasRef.current;
      const doc = ifr?.contentDocument; const wrap = doc?.getElementById('wrap');
      if (!ifr || !canvas || !doc || !wrap) return;
      if (doc.body) { doc.body.style.margin = '0'; doc.body.style.height = '100%'; doc.body.style.display = 'grid'; doc.body.style.placeItems = 'center'; doc.body.style.overflow = 'hidden'; }
      (wrap as HTMLElement).style.transform = 'none';
      const cw = canvas.clientWidth - 24, ch = canvas.clientHeight - 24;
      const ww = (wrap as HTMLElement).scrollWidth || 1, wh = (wrap as HTMLElement).scrollHeight || 1;
      const k = Math.min(1, cw / ww, ch / wh);
      (wrap as HTMLElement).style.transformOrigin = 'center center';
      (wrap as HTMLElement).style.transform = `scale(${k.toFixed(4)})`;
    } catch { /* cross-doc kan feile — best-effort */ }
  };

  // Simuler exit-fade i preview ved å sette #wrap-opacity (rendret klipp bruker
  // ffmpeg alfa-fade — dette speiler det visuelt).
  const setPreviewOpacity = (o: number) => {
    try { const w = iframeRef.current?.contentDocument?.getElementById('wrap') as HTMLElement | null; if (w) w.style.opacity = String(o); } catch { /* */ }
  };
  const play = (durSecOverride?: number) => {
    const win = previewWin();
    if (!win || typeof win.setProgress !== 'function') return;
    const durS = durSecOverride ?? effDur(scene, tpl);
    const dur = Math.max(1, durS) * 1000, t0 = performance.now();
    const exitMs = Math.max(0, Math.min(scene.exitSec ?? 0, durS)) * 1000;
    const exitStart = dur - exitMs;
    setPreviewOpacity(1);
    const tick = (now: number) => {
      const el = now - t0;
      const p = Math.min(1, el / dur);
      try { win.setProgress!(p); } catch { /* */ }
      if (exitMs > 0) setPreviewOpacity(el >= exitStart ? Math.max(0, 1 - (el - exitStart) / exitMs) : 1);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };
  const onIframeLoad = () => { window.setTimeout(() => { fitPreview(); play(); }, 250); };
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
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
    setScrubT(t); const { index, p } = sceneAtTime(t);
    if (index !== sel) setSel(index); else setPreviewProgress(p);
  };
  // Når scrub bytter scene, vent på ny iframe-load og sett progresjonen.
  useEffect(() => { if (playingAll || scrubT > 0) { const { p } = sceneAtTime(scrubT); const h = setTimeout(() => setPreviewProgress(p), 60); return () => clearTimeout(h); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);
  const stopPlayAll = () => { if (playAllRef.current) cancelAnimationFrame(playAllRef.current); playAllRef.current = null; setPlayingAll(false); };
  const playAll = () => {
    stopPlayAll(); setPlayingAll(true);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      if (t >= totalDur) { scrubTo(totalDur); stopPlayAll(); return; }
      scrubTo(t);
      playAllRef.current = requestAnimationFrame(tick);
    };
    playAllRef.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stopPlayAll(), []);
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
    try { await setupPlaywright(); setMsg('✓ Playwright satt opp — trykk «Send to Resolve» igjen.'); }
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
        const html = `<script>window.__CFG__=${JSON.stringify(cfg)}</script>` + htmlForTemplate(t);
        setRenderProgress({ done: i, total: scenes.length });
        setMsg(`Rendrer scene ${i + 1}/${scenes.length} (${t.name}) …`);
        const out = await invoke<string>('render_infographic', { html, durationSec: dur, name: `${t.id}-${sc.id}-${Date.now()}`, fps, scale, exitSec: sc.exitSec ?? 0 });
        overlays.push({ path: out, atSec: sc.atSec, durationSec: dur, track: overlayTrack, posX: sc.posX ?? 50, posY: sc.posY ?? 50 });
      }
      setRenderProgress({ done: scenes.length, total: scenes.length });
      setMsg('Sender alle scener til Resolve …');
      const summary = await executeScript('place_overlay', { overlays });
      const errEvt = summary.events.find((e) => e.type === 'error');
      if (!summary.succeeded || errEvt) {
        setMsg('Rendret, men kunne ikke legges i Resolve: ' + ((errEvt?.value as { message?: string } | undefined)?.message || 'er Resolve åpen med en timeline?'));
        if (overlays[0]?.path) void systemOpen(String(overlays[0].path)).catch(() => {});
      } else { setMsg(`✓ ${scenes.length} scene(r) sendt til Resolve, plassert på overlay-spor til riktig tid.`); }
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
      const html = `<script>window.__CFG__=${JSON.stringify(cfg)}</script>` + htmlForTemplate(tpl);
      const out = await invoke<string>('export_infographic', { html, durationSec: effDur(scene, tpl), name: `${tpl.id}-${scene.id}-${Date.now()}`, format: exportFmt, fps, scale, exitSec: scene.exitSec ?? 0 });
      setMsg(`✓ Eksportert: ${out}`);
      void systemOpen(out).catch(() => {});
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      if (/playwright|chromium|node/i.test(m)) { setNeedsPlaywright(true); setMsg('Feil: ' + m + ' — krever Playwright-runtime.'); }
      else setMsg('Feil ved eksport: ' + m);
    } finally { setExportBusy(false); }
  };

  // «Én scene per rad»: multi-rad-data → generér N scener av gjeldende mal, med
  // hver kolonne bundet til malens felt i rekkefølge (spar manuelt arbeid).
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
    setMsg(`✓ Laget ${built.length} scener — én per datarad (${tpl.name}).`);
  };

  const railItem = (active: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', color: active ? D.ink : D.soft, background: active ? D.panel2 : 'transparent', borderLeft: `3px solid ${active ? D.accent : 'transparent'}`, fontSize: 13 });
  const topBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 8, border: `1px solid ${D.line}`, background: D.panel2, color: D.ink, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 };
  const inp: React.CSSProperties = { width: '100%', fontSize: 12.5, padding: '7px 9px', borderRadius: 7, border: `1px solid ${D.line}`, background: D.bg, color: D.ink, colorScheme: 'dark' };
  const tabBtn = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '7px 0', textAlign: 'center', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: active ? D.ink : D.soft, background: active ? D.panel2 : 'transparent', borderBottom: `2px solid ${active ? D.accent : 'transparent'}` });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: D.bg, color: D.ink, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${D.line}`, background: D.panel }}>
        <button style={{ ...topBtn, border: 'none', background: 'transparent', color: D.soft }} title={standalone ? 'Tilbake til Home' : 'Tilbake til Flow Builder'} onClick={() => onNav('flow')}>←</button>
        <div style={{ fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: D.accent }}>▥</span> Infographic Studio</div>
        {standalone && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: D.teal, border: `1px solid ${D.line}`, borderRadius: 999, padding: '2px 8px' }}>Egen løsning</span>}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: D.soft }}>{project?.name || (standalone ? 'Frittstående' : 'Uten navn')} · {scenes.length} scene(r)</div>
        {standalone && onOpenDemoStudio && (
          <button style={topBtn} title="Åpne Product Demo Studio — Infographic Studio er også en add-on der" onClick={onOpenDemoStudio}>⧉ Product Demo</button>
        )}
        <button style={topBtn} onClick={() => play()} title="Spill den valgte scenen">▶ Preview</button>
        <button style={topBtn} onClick={() => (playingAll ? stopPlayAll() : playAll())} title="Spill HELE sekvensen (alle scener i tid)">{playingAll ? '⏸ Stopp' : '⏵ Spill alt'}</button>
        <button style={topBtn} onClick={addScene}>＋ New Scene</button>
        {busy ? (
          <button style={{ ...topBtn, background: '#7a2530', border: 'none' }} onClick={() => { cancelRef.current = true; }} title="Avbryt etter gjeldende scene">
            ✕ Avbryt{renderProgress ? ` (${renderProgress.done}/${renderProgress.total})` : ''}
          </button>
        ) : (
          <button style={{ ...topBtn, background: D.accent, border: 'none' }} onClick={() => void sendToResolve()}>✦ Send to Resolve</button>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Rail */}
        <div style={{ width: 178, borderRight: `1px solid ${D.line}`, background: D.panel, paddingTop: 8, display: 'flex', flexDirection: 'column' }}>
          <div style={railItem(leftSec === 'data')} onClick={() => setLeftSec('data')}>⛁ Data Sources{dataKeys.length ? <span style={{ marginLeft: 'auto', fontSize: 10, color: D.teal }}>{dataKeys.length}</span> : null}</div>
          <div style={railItem(leftSec === 'templates')} onClick={() => setLeftSec('templates')}>▦ Templates <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.length}</span></div>
          <div style={railItem(leftSec === 'charts')} onClick={() => setLeftSec('charts')}>▤ Charts <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.filter((t) => CHART_IDS.has(t.id)).length}</span></div>
          <div style={railItem(leftSec === 'marketing')} onClick={() => setLeftSec('marketing')}>✷ Marketing <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.filter((t) => MARKETING_IDS.has(t.id)).length}</span></div>
          <div style={railItem(leftSec === 'filmtv')} onClick={() => setLeftSec('filmtv')}>▶ Film &amp; TV <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.filter((t) => FILMTV_IDS.has(t.id)).length}</span></div>
          <div style={railItem(leftSec === 'callouts')} onClick={() => setLeftSec('callouts')}>⌖ Callouts <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.filter((t) => CALLOUT_IDS.has(t.id)).length}</span></div>
          <div style={railItem(leftSec === 'ui')} onClick={() => setLeftSec('ui')}>▭ UI <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.filter((t) => UI_IDS.has(t.id)).length}</span></div>
          <div style={railItem(leftSec === 'uxlayout')} onClick={() => setLeftSec('uxlayout')}>▥ Layout &amp; UX <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.filter((t) => UX_LAYOUT_IDS.has(t.id)).length}</span></div>
          <div style={railItem(false)} title="Velg ikoner i Data-fanen per felt">◷ Icons <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{ALL_MATERIAL_ICONS.length}</span></div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: D.faint, textTransform: 'uppercase', letterSpacing: 0.6, padding: '12px 14px 4px' }}>Brand Kits</div>
          {BRAND_KITS.map((k) => (
            <div key={k.id} style={railItem(leftSec === k.id)} onClick={() => { setLeftSec(k.id); setAccent(k.accent); setLogo(k.logo); }} title={`${k.name} — ${k.tagline}`}>
              <img src={k.logo} alt="" style={{ width: 16, height: 16, objectFit: 'contain', marginRight: 2 }} />{k.name}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: D.faint }}>{INFOGRAPHIC_TEMPLATES.filter((t) => inCategory(k.id, t.id)).length}</span>
            </div>
          ))}
          <div style={railItem(leftSec === 'brand')} onClick={() => setLeftSec('brand')}>◆ Brand Kit</div>
          <div style={railItem(leftSec === 'export')} onClick={() => setLeftSec('export')}>⤓ Export</div>
          <div style={{ flex: 1 }} />
          {logo && <img src={logo} alt="" style={{ maxWidth: 120, maxHeight: 40, margin: '0 auto 14px', opacity: 0.9 }} />}
        </div>

        {/* Sekundær-panel */}
        <div style={{ width: 280, borderRight: `1px solid ${D.line}`, overflowY: 'auto', padding: 14, background: D.panel }}>
          {(leftSec === 'templates' || leftSec in CATEGORY_IDS || leftSec === 'kit-rr' || leftSec === 'kit-ch') && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{CATEGORY_LABEL[leftSec] || 'Templates'} <span style={{ color: D.faint, fontWeight: 500 }}>· endrer scene {sel + 1}</span></div>
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
                          <span style={{ fontSize: 15, color: t.style === 'hud' ? D.teal : D.accent }}>{t.glyph}</span>
                          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{t.name}</div>
                        </div>
                        <div style={{ fontSize: 11, color: D.soft, marginTop: 5, lineHeight: 1.35 }}>{t.desc}</div>
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
            <div style={{ fontSize: 11, color: D.faint, lineHeight: 1.45, marginBottom: 8 }}>Lim inn JSON-objekt eller CSV (header-rad + verdi-rad). Bind så felter til kolonnene i Data-fanen — tallene fylles automatisk.</div>
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
                ⧉ Lag {rc} scener — én per rad
              </button>
            ) : null; })()}
          </>)}
          {leftSec === 'export' && (<>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.soft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Kvalitet</div>
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
            <button style={{ ...topBtn, width: '100%', justifyContent: 'center', background: D.accent, border: 'none', opacity: exportBusy ? 0.6 : 1, marginBottom: 18 }} disabled={exportBusy} onClick={() => void exportFile()}>
              ⤓ {exportBusy ? 'Eksporterer …' : 'Eksporter fil'}
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
          <div style={{ flex: 1, minHeight: 0, padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: D.faint }}>Canvas · scene {sel + 1} av {scenes.length} ({tpl.name}) · transparent overlay{playingAll ? ` · spiller sekvens ${scrubT.toFixed(1)}s / ${totalDur.toFixed(1)}s` : ''}</span>
              <div style={{ flex: 1 }} />
              {/* Composite: legg en still fra videoen bak overlay-en. */}
              <label style={{ ...topBtn, padding: '4px 10px', fontSize: 11 }} title="Legg et stillbilde fra videoen bak overlay-en for å se hvordan den lander">
                🎬 {bgImage ? 'Bytt bakgrunn' : 'Bakgrunn'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setBgImage(typeof r.result === 'string' ? r.result : ''); r.readAsDataURL(f); }} />
              </label>
              {bgImage && <button style={{ ...topBtn, padding: '4px 9px', fontSize: 11 }} onClick={() => setBgImage('')}>✕</button>}
            </div>
            <div ref={canvasRef} style={{ position: 'relative', flex: 1, borderRadius: 12, overflow: 'hidden', border: `1px solid ${D.line}`, background: bgImage ? '#000' : 'linear-gradient(135deg,#10182a,#0b1120)', display: 'grid', placeItems: 'center' }}>
              {bgImage && <img src={bgImage} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: 0 }} />}
              <iframe ref={iframeRef} title="preview" srcDoc={srcDoc} onLoad={onIframeLoad} style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', minHeight: 280, border: 0, background: 'transparent' }} />
            </div>
          </div>
          {/* Tidslinje-scrubber: scenene plassert i tid (atSec + varighet), med
              playhead. Klikk/dra scrubber for å inspisere sekvensen; overlappende
              scener markeres rødt. */}
          <div style={{ borderTop: `1px solid ${D.line}`, background: D.panel, padding: '8px 16px 2px' }}>
            {(() => {
              // Oppdag overlapp for varsel.
              const spans = scenes.map((sc) => { const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0]; return { a: sc.atSec, b: sc.atSec + effDur(sc, t) }; });
              const overlap = spans.some((s, i) => spans.some((o, j) => j !== i && s.a < o.b && o.a < s.b));
              const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
                const r = e.currentTarget.getBoundingClientRect();
                scrubTo(Math.max(0, Math.min(totalDur, ((e.clientX - r.left) / r.width) * totalDur)));
              };
              return (<>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10.5, color: D.faint }}>Tidslinje · {totalDur.toFixed(1)}s</span>
                  {overlap && <span style={{ fontSize: 10.5, color: '#f0a882' }}>⚠ scener overlapper i tid</span>}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 10.5, color: D.faint }}>{scrubT.toFixed(1)}s</span>
                </div>
                <div onMouseDown={onScrub} style={{ position: 'relative', height: 26, borderRadius: 6, background: D.bg, border: `1px solid ${D.line}`, cursor: 'pointer', overflow: 'hidden' }}>
                  {scenes.map((sc, i) => {
                    const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
                    const left = (sc.atSec / totalDur) * 100, w = Math.max(2, (effDur(sc, t) / totalDur) * 100);
                    return <div key={sc.id} onClick={(e) => { e.stopPropagation(); setSel(i); }} title={`Scene ${i + 1}: ${t.name} (${sc.atSec}–${(sc.atSec + effDur(sc, t)).toFixed(1)}s)`}
                      style={{ position: 'absolute', left: `${left}%`, width: `${w}%`, top: 3, bottom: 3, borderRadius: 4, background: i === sel ? D.accent : D.panel2, border: `1px solid ${i === sel ? D.accent : D.line}`, display: 'flex', alignItems: 'center', paddingLeft: 5, overflow: 'hidden', fontSize: 9.5, color: i === sel ? '#fff' : D.soft, whiteSpace: 'nowrap' }}>{i + 1}</div>;
                  })}
                  <div style={{ position: 'absolute', left: `${(scrubT / totalDur) * 100}%`, top: 0, bottom: 0, width: 2, background: D.teal, pointerEvents: 'none' }} />
                </div>
              </>);
            })()}
          </div>
          {/* Scene-stripe (multi-scene) */}
          <div style={{ borderTop: `1px solid ${D.line}`, background: D.panel, padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button style={topBtn} onClick={() => play()} title="Spill valgt scene">▶</button>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1, paddingBottom: 2 }}>
                {scenes.map((sc, i) => {
                  const t = INFOGRAPHIC_TEMPLATES.find((x) => x.id === sc.tplId) || INFOGRAPHIC_TEMPLATES[0];
                  const active = i === sel;
                  return (
                    <div key={sc.id} onClick={() => setSel(i)} style={{ width: 104, flex: 'none', borderRadius: 9, border: `2px solid ${active ? D.accent : D.line}`, background: active ? D.panel2 : D.bg, cursor: 'pointer', padding: '8px 9px', position: 'relative' }}>
                      <div style={{ fontSize: 10, color: D.faint }}>Scene {i + 1} · {sc.atSec}s</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: 15, color: t.style === 'hud' ? D.teal : D.accent }}>{t.glyph}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: D.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                      </div>
                      {scenes.length > 1 && <button onClick={(e) => { e.stopPropagation(); deleteScene(i); }} style={{ position: 'absolute', top: 4, right: 5, border: 'none', background: 'transparent', color: D.faint, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>}
                    </div>
                  );
                })}
                <div onClick={addScene} style={{ width: 56, flex: 'none', borderRadius: 9, border: `1px dashed ${D.line}`, display: 'grid', placeItems: 'center', fontSize: 20, color: D.faint, cursor: 'pointer' }} title="Ny scene">＋</div>
              </div>
              <label style={{ fontSize: 12, color: D.soft, display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>Dukker opp ved
                <input style={{ ...inp, width: 64 }} type="number" min="0" step="0.5" value={scene.atSec} onChange={(e) => updateScene({ atSec: parseFloat(e.target.value) || 0 })} /> s</label>
              {CALLOUT_IDS.has(scene.tplId) && (
                <label style={{ fontSize: 12, color: D.soft, display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }} title="Hvor i bildet callouten peker (% av ramme; 50/50 = sentrert)">⌖ Plassering
                  <input style={{ ...inp, width: 54 }} type="number" min="0" max="100" step="1" value={scene.posX ?? 50} onChange={(e) => updateScene({ posX: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} />X
                  <input style={{ ...inp, width: 54 }} type="number" min="0" max="100" step="1" value={scene.posY ?? 50} onChange={(e) => updateScene({ posY: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) })} />Y%</label>
              )}
            </div>
          </div>
          {(msg || renderProgress) && (
            <div style={{ padding: '8px 16px', borderTop: `1px solid ${D.line}`, background: D.panel }}>
              {renderProgress && (
                <div style={{ height: 4, borderRadius: 2, background: D.bg, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${Math.round((renderProgress.done / Math.max(1, renderProgress.total)) * 100)}%`, background: D.accent, transition: 'width .3s' }} />
                </div>
              )}
              {msg && <div style={{ fontSize: 12, color: msg.startsWith('Feil') ? '#f08a82' : D.soft, display: 'flex', alignItems: 'center', gap: 10 }}>
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
                            <option value="">⛁ bind…</option>
                            {dataKeys.map((k) => <option key={k} value={k}>{k}</option>)}
                          </select>
                        )}
                      </div>
                      {bound
                        ? <input style={{ ...inp, borderColor: D.teal, color: D.teal }} readOnly value={`⛁ ${dataMap[bound] ?? ''}`} title={`Bundet til ${bound}`} />
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
                <label style={{ width: 30, height: 30, borderRadius: 8, border: `1px dashed ${D.line}`, display: 'grid', placeItems: 'center', color: D.soft, cursor: 'pointer' }}>＋
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
                <button style={{ ...topBtn, flex: 1, justifyContent: 'center' }} onClick={() => play()}>▶ Spill scene</button>
                <button style={{ ...topBtn, flex: 1, justifyContent: 'center' }} onClick={() => (playingAll ? stopPlayAll() : playAll())}>{playingAll ? '⏸ Stopp' : '⏵ Spill alt'}</button>
              </div>
              <div style={{ fontSize: 10.5, color: D.faint, lineHeight: 1.45 }}>Bevegelsen (count-up, søyle-vekst, stagger, fade/slide) er designet inn i hver mal og kjøres deterministisk av <code style={{ color: D.soft }}>setProgress</code> — derfor ser den alltid proff ut. Varighet styrer hvor lenge den spilles av.</div>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
