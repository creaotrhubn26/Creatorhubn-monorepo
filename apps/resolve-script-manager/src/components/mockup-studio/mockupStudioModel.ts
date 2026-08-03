/**
 * mockupStudioModel.ts — datamodell for Mockup Studio (Post Agent-modul).
 *
 * Produktifiserer den manuelle Photoshop-one-pager-flyten: én URL/skjermbilder
 * → device-mockups (Mac/iPad/iPhone) + redigerbar tekst + accent-farger →
 * eksport (PNG i P1; PDF/PSD senere).
 *
 * `MockupDoc` er den ENE nye abstraksjonen: et fler-slot dokument (flere
 * enheter + tekster på ett lerret) som driver både live-preview (DOM/canvas)
 * og rasterisering (eksport). Ren/serialiserbar — ingen React, ingen Tauri —
 * så den kan lagres til localStorage og senere synkes til sky (samme mønster
 * som demoStudioModel).
 *
 * Enhets-variantene + skjerm-rektanglene gjenbrukes 1:1 fra demo-studio-modulen
 * (`deviceFrames.ts`) — samme rammer som Demo Studio og Guided Recorder bruker.
 */

import type { FrameVariant } from '../demo-studio/deviceFrames';

/**
 * Device-varianter = demo-studio-rammene (iphone/ipad/ipad_landscape/macbook)
 * + en syntetisk, kode-tegnet Apple Watch (ingen PNG → ingen lisens-spørsmål).
 */
export type MockupDeviceVariant = FrameVariant | 'watch';

/**
 * Ett device-slot på lerretet. Geometri i LERRET-piksler (base-oppløsning,
 * se MockupDoc.canvas). Høyden utledes fra rammens aspect — vi lagrer bare
 * bredden, så enheten aldri kan bli forvrengt.
 */
export interface MockupDeviceSlot {
  id: string;
  /** Binding til en mal-definert slot (slot-motor). Fri hvis udefinert. */
  slotId?: string;
  variant: MockupDeviceVariant;
  /** Øvre venstre hjørne i lerret-px. */
  x: number;
  y: number;
  /** Bredde i lerret-px (høyde = w / rammens aspect). */
  w: number;
  /** Rotasjon i grader (rundt senter). */
  rotation: number;
  /** Skjermbilde vist i skjerm-hullet (data-URL). Fit skjer ved tegning. */
  image?: string;
  /** Utsnitt: 'cover' (smart tilpassing, beskjærer) eller 'contain' (vis hele). */
  fit?: 'cover' | 'contain';
  /** Fokuspunkt for cover-beskjæring (0..1). Default midt (0.5, 0.5). */
  focusX?: number;
  focusY?: number;
  /** Myk kontaktskygge under enheten. */
  shadow: boolean;
}

export type MockupTextRole = 'eyebrow' | 'title' | 'body' | 'tag';
export type MockupTextAlign = 'left' | 'center' | 'right';

/** En redigerbar tekstblokk. Geometri i lerret-px; `w` styrer ombrekking. */
export interface MockupTextSlot {
  id: string;
  /** Binding til en mal-definert slot (slot-motor). Fri hvis udefinert. */
  slotId?: string;
  role: MockupTextRole;
  text: string;
  x: number;
  y: number;
  /** Maks bredde før ombrekking (lerret-px). */
  w: number;
  /** Font-størrelse i lerret-px. */
  size: number;
  weight: number;
  /** 'accent' → løses til canvas.accent; ellers en hex-farge. */
  color: string;
  align: MockupTextAlign;
  /** Linjehøyde som multiplum av size. */
  lineHeight: number;
  /** Bokstavavstand i px (for eyebrow/tag-caps). */
  tracking: number;
  uppercase: boolean;
}

/** Bakgrunns-modus (§1.3/§6): lys, mørk eller merkevare-tonet. */
export type MockupBackground = 'light' | 'dark' | 'brand';
/** Bakgrunns-stil: ren flate, gradient eller atmosfærisk (accent-glød). */
export type MockupBgStyle = 'clean' | 'gradient' | 'atmospheric';

/** Dekor-lag: designer-elementer bak innholdet (visuell dybde). */
export type MockupDecor =
  | 'none' | 'orbs' | 'mesh' | 'grid' | 'shapes'
  | 'rings' | 'stripes' | 'waves' | 'spotlight' | 'confetti' | 'halftone' | 'band';

export const DECOR_LABELS: Record<MockupDecor, string> = {
  none: 'Ingen', orbs: 'Glød-orber', mesh: 'Gradient-mesh', grid: 'Rutenett', shapes: 'Former',
  rings: 'Radar-ringer', stripes: 'Diagonale striper', waves: 'Bølger', spotlight: 'Spotlight',
  confetti: 'Konfetti', halftone: 'Halvtone', band: 'Diagonalt bånd',
};

/** Typografi-stil (kuraterte font-paringer, macOS-system-fonter). */
export type MockupTypographyId = 'moderne' | 'editorial' | 'teknisk' | 'geometrisk';

export const TYPOGRAPHY_STYLES: Record<MockupTypographyId, { label: string; display: string; body: string }> = {
  moderne: { label: 'Moderne', display: '"Avenir Next", system-ui, sans-serif', body: '"Avenir Next", system-ui, sans-serif' },
  editorial: { label: 'Editorial', display: 'Georgia, "Times New Roman", serif', body: '"Avenir Next", system-ui, sans-serif' },
  teknisk: { label: 'Teknisk', display: 'Menlo, "SF Mono", monospace', body: '"Helvetica Neue", system-ui, sans-serif' },
  geometrisk: { label: 'Geometrisk', display: 'Futura, "Century Gothic", sans-serif', body: '"Avenir Next", system-ui, sans-serif' },
};

/** Logo-slot (valgfri) — plasseres på lerretet, farge-nøytral. */
export interface MockupLogo {
  image: string; // data-URL
  x: number;
  y: number;
  w: number;
}

export interface MockupCanvasSpec {
  /** Base-oppløsning i px (all geometri er relativ til denne). */
  w: number;
  h: number;
  /** Accent 1 — primær merkevarefarge (CTA, tall, markører). */
  accent: string;
  /** Accent 2 — sekundær merkevarefarge (badges, gradient). */
  accent2: string;
  /** Bakgrunns-modus. */
  background: MockupBackground;
  /** Bakgrunns-stil. */
  bgStyle: MockupBgStyle;
  /** Typografi-stil (font-paring). Default 'moderne'. */
  typography?: MockupTypographyId;
  /** Dekor-lag bak innholdet. Default 'none'. */
  decor?: MockupDecor;
  /** Valgfri logo. */
  logo?: MockupLogo;
}

/** Font-familie for en tekst-rolle ut fra lerretets typografi-stil.
 *  Etikett/overskrift → display-font; brødtekst/tag → body-font. */
export function fontFamilyFor(role: MockupTextRole, canvas: MockupCanvasSpec): string {
  const t = TYPOGRAPHY_STYLES[canvas.typography ?? 'moderne'];
  return role === 'eyebrow' || role === 'title' ? t.display : t.body;
}

// ── Fargematematikk (delt av rasterisator + kvalitetskontroll) ───────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Bland to hex-farger (t=0 → a, t=1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  return rgbToHex(ca.r + (cb.r - ca.r) * t, ca.g + (cb.g - ca.g) * t, ca.b + (cb.b - ca.b) * t);
}

function channelLum(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relativ luminans (WCAG). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channelLum(r) + 0.7152 * channelLum(g) + 0.0722 * channelLum(b);
}

/** WCAG-kontrastforhold mellom to farger (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Er en farge mørk? (for kontrast-valg av tekst) */
export function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.35;
}

/** Løs den effektive bakgrunns-basisfargen fra modus + accenter. */
export function resolveBaseBg(canvas: MockupCanvasSpec): string {
  switch (canvas.background) {
    case 'light': return '#f4f5f7';
    case 'brand': return mixHex(canvas.accent, '#0a0b10', 0.82); // dyp merkevare-tone
    case 'dark':
    default: return '#0f1117';
  }
}

export type MockupProjectStatus = 'draft' | 'ready' | 'exported' | 'archived';

export const STATUS_LABELS: Record<MockupProjectStatus, string> = {
  draft: 'Kladd',
  ready: 'Klar',
  exported: 'Eksportert',
  archived: 'Arkivert',
};

export interface MockupDoc {
  id: string;
  name: string;
  /** Skjema-versjon for framtidig migrering. */
  version: 1;
  /** Malen dokumentet ble laget fra (metadata/analyse). */
  template: string;
  canvas: MockupCanvasSpec;
  devices: MockupDeviceSlot[];
  texts: MockupTextSlot[];
  /** Illustrasjons-lag (callout/lupe/markør). Valgfri — tomt/udefinert = ingen. */
  annotations?: MockupAnnotation[];
  /** Produkt-mind map (Mermaid `mindmap`-syntaks). Satt → lerretet er en mind
   *  map-slide (rendres native i merkevarens farger, ikke enheter/tekst). */
  mindmap?: string;
  updatedAt: number;
  /** Prosjektstatus (§ prosjektoversikt). Default 'draft'. */
  status?: MockupProjectStatus;
  /** Mal-definerte slots (slot-motor): kanonisk geometri + begrensninger. */
  slots?: SlotDef[];
  /**
   * Pikselperfekte per-format-layouter: format-id → slot-id → plassering.
   * Overstyrer auto-reflow når man bytter til det formatet. Tomt = auto.
   */
  formatLayouts?: Record<string, Record<string, SlotPlacement>>;
}

/** Én slot-plassering i et bestemt format (pikselperfekt override). */
export interface SlotPlacement {
  x: number;
  y: number;
  w?: number;
  rotation?: number;
  size?: number; // for tekst
}

// ── Slot-motor (§1.1 struktur før frihet) ───────────────────────────────────

export type SlotKind = 'device' | 'text';

/** En mal-definert slot: kanonisk sone + begrensninger. Elementer bindes via slotId. */
export interface SlotDef {
  id: string;
  kind: SlotKind;
  label: string;
  /** Kanonisk geometri (lerret-px). w for tekst = ombrekk-bredde. */
  zone: { x: number; y: number; w: number; rotation?: number };
  /** For tekst-slots: rollen (styrer typografi + grenser). */
  role?: MockupTextRole;
  /** For device-slots: tillatte enhets-varianter (bytt-device er begrenset). */
  allowedVariants?: MockupDeviceVariant[];
}

export type LayoutVariantId = 'default' | 'mirror';

export const LAYOUT_VARIANTS: { id: LayoutVariantId; label: string }[] = [
  { id: 'default', label: 'Standard' },
  { id: 'mirror', label: 'Speilvendt' },
];

// ── Fabrikker ──────────────────────────────────────────────────────────────

let _seq = 0;
function uid(prefix: string): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

/** Standard base-lerret: 16:10 one-pager. */
export const BASE_W = 1600;
export const BASE_H = 1000;

/** Ramme-aspect (frameW/frameH) per variant — for å utlede høyde uten å laste PNG. */
export const FRAME_ASPECT: Record<MockupDeviceVariant, number> = {
  iphone: 1086 / 1448,
  ipad: 1086 / 1448,
  ipad_landscape: 1448 / 1086,
  macbook: 1586 / 992,
  watch: 0.84, // ~45mm-kasse (litt høyere enn bred)
};

/** Høyde til et device-slot ut fra bredden + rammens aspect. */
export function deviceHeight(slot: Pick<MockupDeviceSlot, 'variant' | 'w'>): number {
  return slot.w / FRAME_ASPECT[slot.variant];
}

// ── Illustrasjons-lag (callout / lupe / markør) ─────────────────────────────
//
// Gjør en mockup om fra «bilde av appen» til «forklaring av hva appen gjør».
// En annotasjon festes til en enhets SKJERM (fx/fy 0..1 i skjerm-hullet) så den
// følger produktskjermen; uten deviceId er den lerret-relativ. Tegnes øverst av
// kompositoren og følger med i alle eksporter.

export type MockupAnnotationKind = 'callout' | 'loupe' | 'marker';
export type MockupCalloutSide = 'left' | 'right' | 'top' | 'bottom';

export interface MockupAnnotation {
  id: string;
  kind: MockupAnnotationKind;
  /** Enhet hvis skjerm ankeret er relativt til (skjerm-fraksjon). Tom → lerret. */
  deviceId?: string;
  /** Ankerpunkt (0..1) i enhetens skjerm, ellers i lerretet. */
  fx: number;
  fy: number;
  // callout
  n?: number;
  label?: string;
  side?: MockupCalloutSide;
  // lupe: forstørrelse + hvor sirkelen tegnes (lerret-fraksjon) + radius (lerret-px)
  zoom?: number;
  lensX?: number;
  lensY?: number;
  radius?: number;
  // markør (uthev-rektangel): bredde/høyde i skjerm-fraksjon
  fw?: number;
  fh?: number;
}

/** Lag en ny annotasjon med fornuftige standardverdier. */
export function makeAnnotation(kind: MockupAnnotationKind, deviceId: string | undefined, n = 1): MockupAnnotation {
  const base: MockupAnnotation = { id: uid('ann'), kind, deviceId, fx: 0.5, fy: 0.4 };
  if (kind === 'callout') return { ...base, n, label: 'Ny funksjon', side: 'right' };
  if (kind === 'loupe') return { ...base, fx: 0.5, fy: 0.5, zoom: 2.4, lensX: 0.86, lensY: 0.82, radius: 150 };
  return { ...base, fx: 0.4, fy: 0.35, fw: 0.22, fh: 0.14 }; // marker
}

export function makeDevice(variant: MockupDeviceVariant, partial: Partial<MockupDeviceSlot> = {}): MockupDeviceSlot {
  const defW: Record<MockupDeviceVariant, number> = {
    macbook: 820,
    ipad: 460,
    ipad_landscape: 620,
    iphone: 240,
    watch: 170,
  };
  return {
    id: uid('dev'),
    variant,
    x: 120,
    y: 260,
    w: defW[variant],
    rotation: 0,
    shadow: true,
    ...partial,
  };
}

export function makeText(role: MockupTextRole, partial: Partial<MockupTextSlot> = {}): MockupTextSlot {
  const presets: Record<MockupTextRole, Partial<MockupTextSlot>> = {
    eyebrow: { size: 26, weight: 700, color: 'accent', tracking: 3, uppercase: true, lineHeight: 1.2 },
    title: { size: 76, weight: 800, color: '#ffffff', tracking: -1, uppercase: false, lineHeight: 1.05 },
    body: { size: 30, weight: 400, color: '#c7cbd8', tracking: 0, uppercase: false, lineHeight: 1.45 },
    tag: { size: 22, weight: 600, color: '#9aa0b4', tracking: 1, uppercase: false, lineHeight: 1.3 },
  };
  return {
    id: uid('txt'),
    role,
    text: '',
    x: 120,
    y: 120,
    w: 640,
    align: 'left',
    size: 30,
    weight: 400,
    color: '#ffffff',
    tracking: 0,
    uppercase: false,
    lineHeight: 1.35,
    ...presets[role],
    ...partial,
  };
}

// ── Elementer (forhåndsgodkjente moduler §1.1/§2) ───────────────────────────

export type MockupElementKind = 'stat' | 'cta' | 'feature_row' | 'badge';

export const ELEMENT_LABELS: Record<MockupElementKind, string> = {
  stat: 'Nøkkeltall',
  cta: 'CTA-knapp',
  feature_row: 'Feature-rad',
  badge: 'Badge',
};

/**
 * Bygg en forhåndsgodkjent modul som ett eller flere tekst-slots. Ikke et
 * generelt objektbibliotek — bare kuraterte, on-brand byggeklosser.
 */
export function makeElement(kind: MockupElementKind): MockupTextSlot[] {
  switch (kind) {
    case 'stat':
      return [
        makeText('title', { text: '42 %', x: 160, y: 640, w: 420, size: 104, color: 'accent', lineHeight: 1 }),
        makeText('body', { text: 'bedre resultat', x: 160, y: 770, w: 420 }),
      ];
    case 'cta':
      return [makeText('tag', { text: 'Kom i gang →', x: 160, y: 820, w: 380, size: 30, weight: 700, color: 'accent' })];
    case 'feature_row':
      return [
        makeText('tag', { text: '✓ Rask', x: 160, y: 820, w: 300, size: 26, weight: 600, color: 'accent2' }),
        makeText('tag', { text: '✓ Sikker', x: 480, y: 820, w: 300, size: 26, weight: 600, color: 'accent2' }),
        makeText('tag', { text: '✓ On-brand', x: 800, y: 820, w: 340, size: 26, weight: 600, color: 'accent2' }),
      ];
    case 'badge':
      return [makeText('eyebrow', { text: 'NYHET', x: 160, y: 170, w: 260, color: 'accent2' })];
  }
}

// ── Maler ────────────────────────────────────────────────────────────────

export type MockupTemplateCategory =
  | 'produktoversikt'
  | 'funksjonslansering'
  | 'salgspitch'
  | 'nokkeltall'
  | 'kundecase';

export const CATEGORY_LABELS: Record<MockupTemplateCategory, string> = {
  produktoversikt: 'Produktoversikt',
  funksjonslansering: 'Funksjonslansering',
  salgspitch: 'Salgspitch',
  nokkeltall: 'Nøkkeltall',
  kundecase: 'Kundecase',
};

/** Formål → anbefalte kategorier (onboarding §3-skjerm 2). */
export const PURPOSE_CATEGORIES: { id: string; label: string; categories: MockupTemplateCategory[] }[] = [
  { id: 'product', label: 'Presentere et produkt', categories: ['produktoversikt', 'funksjonslansering'] },
  { id: 'feature', label: 'Selge en funksjon', categories: ['funksjonslansering', 'salgspitch'] },
  { id: 'offer', label: 'Oppsummere et tilbud', categories: ['salgspitch', 'nokkeltall'] },
  { id: 'case', label: 'Vise en kundecase', categories: ['kundecase', 'produktoversikt'] },
  { id: 'launch', label: 'Annonsere en lansering', categories: ['funksjonslansering', 'produktoversikt'] },
];

export interface MockupTemplate {
  id: string;
  name: string;
  category: MockupTemplateCategory;
  variant: 'light' | 'dark';
  /** Antall device-slots (merking + maks-devices-grense). */
  devices: number;
  description: string;
  build: () => MockupDoc;
}

function baseCanvas(partial: Partial<MockupCanvasSpec> = {}): MockupCanvasSpec {
  return { w: BASE_W, h: BASE_H, accent: '#22d3ee', accent2: '#a78bfa', background: 'dark', bgStyle: 'gradient', typography: 'moderne', decor: 'orbs', ...partial };
}

function doc(name: string, template: string, canvas: MockupCanvasSpec, devices: MockupDeviceSlot[], texts: MockupTextSlot[]): MockupDoc {
  return { id: uid('doc'), name, version: 1, template, canvas, devices, texts, updatedAt: Date.now() };
}

/** Tekstfarger tilpasset lys/mørk variant (kontrast-trygge). */
function ink(variant: 'light' | 'dark') {
  return variant === 'light'
    ? { title: '#101317', body: '#414651', tag: '#6b7280' }
    : { title: '#ffffff', body: '#c7cbd8', tag: '#9aa0b4' };
}

export const MOCKUP_TEMPLATES: MockupTemplate[] = [
  {
    id: 'hero_mac_phone_dark', name: 'Hero — Mac + iPhone', category: 'produktoversikt', variant: 'dark', devices: 2,
    description: 'Overskrift til venstre, MacBook med iPhone-overlapp til høyre. Mørk.',
    build: () => { const t = ink('dark'); return doc('Produktoversikt', 'hero_mac_phone_dark', baseCanvas(), [
      makeDevice('macbook', { x: 700, y: 250, w: 820, shadow: true }),
      makeDevice('iphone', { x: 1210, y: 560, w: 250, rotation: 4, shadow: true }),
    ], [
      makeText('eyebrow', { text: 'PRODUKT', x: 120, y: 300, w: 520 }),
      makeText('title', { text: 'Overskrift som selger', x: 120, y: 345, w: 560, color: t.title }),
      makeText('body', { text: 'Kort verdiløfte i én til to setninger. Bytt ut teksten og skjermbildene.', x: 120, y: 560, w: 520, color: t.body }),
      makeText('tag', { text: 'creatorhubn.com', x: 120, y: 720, w: 520, color: t.tag }),
    ]); },
  },
  {
    id: 'hero_mac_phone_light', name: 'Hero — Mac + iPhone (lys)', category: 'produktoversikt', variant: 'light', devices: 2,
    description: 'Samme hero-komposisjon på lys bakgrunn.',
    build: () => { const t = ink('light'); return doc('Produktoversikt', 'hero_mac_phone_light', baseCanvas({ background: 'light', bgStyle: 'clean' }), [
      makeDevice('macbook', { x: 700, y: 250, w: 820, shadow: true }),
      makeDevice('iphone', { x: 1210, y: 560, w: 250, rotation: 4, shadow: true }),
    ], [
      makeText('eyebrow', { text: 'PRODUKT', x: 120, y: 300, w: 520 }),
      makeText('title', { text: 'Overskrift som selger', x: 120, y: 345, w: 560, color: t.title }),
      makeText('body', { text: 'Kort verdiløfte i én til to setninger.', x: 120, y: 560, w: 520, color: t.body }),
      makeText('tag', { text: 'creatorhubn.com', x: 120, y: 720, w: 520, color: t.tag }),
    ]); },
  },
  {
    id: 'feature_trio_dark', name: 'Funksjoner — iPad + iPhone', category: 'funksjonslansering', variant: 'dark', devices: 2,
    description: 'Sentrert overskrift over to enheter, med tre funksjons-punkter.',
    build: () => { const t = ink('dark'); return doc('Funksjonslansering', 'feature_trio_dark', baseCanvas({ accent: '#a78bfa', accent2: '#22d3ee' }), [
      makeDevice('ipad', { x: 470, y: 380, w: 470, rotation: -5, shadow: true }),
      makeDevice('iphone', { x: 900, y: 450, w: 250, rotation: 5, shadow: true }),
    ], [
      makeText('eyebrow', { text: 'NYTT', x: 0, y: 120, w: BASE_W, align: 'center' }),
      makeText('title', { text: 'Én app. Alt du trenger.', x: 0, y: 160, w: BASE_W, align: 'center', size: 68, color: t.title }),
      makeText('body', { text: 'Rask · Sikker · On-brand', x: 0, y: 270, w: BASE_W, align: 'center', color: t.body }),
    ]); },
  },
  {
    id: 'sales_pitch_dark', name: 'Salgspitch — MacBook + CTA', category: 'salgspitch', variant: 'dark', devices: 1,
    description: 'Stor MacBook, kraftig overskrift og tydelig CTA-linje.',
    build: () => { const t = ink('dark'); return doc('Salgspitch', 'sales_pitch_dark', baseCanvas({ background: 'brand', bgStyle: 'atmospheric', decor: 'none' }), [
      makeDevice('macbook', { x: 620, y: 300, w: 900, shadow: true }),
    ], [
      makeText('eyebrow', { text: 'FOR SALGSTEAM', x: 120, y: 320, w: 460 }),
      makeText('title', { text: 'Lukk flere avtaler', x: 120, y: 365, w: 480, size: 72, color: t.title }),
      makeText('body', { text: 'Ett verktøy fra første møte til signert kontrakt.', x: 120, y: 560, w: 440, color: t.body }),
      makeText('tag', { text: 'Book en demo →', x: 120, y: 690, w: 440, color: 'accent', size: 28, weight: 700 }),
    ]); },
  },
  {
    id: 'stats_dark', name: 'Nøkkeltall — iPhone', category: 'nokkeltall', variant: 'dark', devices: 1,
    description: 'iPhone til høyre, tre store nøkkeltall i accent-farger til venstre.',
    build: () => { const t = ink('dark'); return doc('Nøkkeltall', 'stats_dark', baseCanvas({ typography: 'geometrisk' }), [
      makeDevice('iphone', { x: 1120, y: 250, w: 300, rotation: 3, shadow: true }),
    ], [
      makeText('eyebrow', { text: 'RESULTATER', x: 120, y: 200, w: 500 }),
      makeText('title', { text: '42 %', x: 120, y: 260, w: 500, size: 120, color: 'accent' }),
      makeText('body', { text: 'raskere onboarding', x: 120, y: 400, w: 500, color: t.body }),
      makeText('title', { text: '3×', x: 120, y: 480, w: 500, size: 120, color: 'accent2' }),
      makeText('body', { text: 'mer effektivt salg', x: 120, y: 620, w: 500, color: t.body }),
    ]); },
  },
  {
    id: 'case_study_light', name: 'Kundecase — MacBook (lys)', category: 'kundecase', variant: 'light', devices: 1,
    description: 'Lys, redaksjonell kundecase med sitat og MacBook.',
    build: () => { const t = ink('light'); return doc('Kundecase', 'case_study_light', baseCanvas({ background: 'light', bgStyle: 'clean', typography: 'editorial' }), [
      makeDevice('macbook', { x: 700, y: 300, w: 820, shadow: true }),
    ], [
      makeText('eyebrow', { text: 'KUNDECASE', x: 120, y: 300, w: 500 }),
      makeText('title', { text: '«Vi sparte 12 timer i uka»', x: 120, y: 350, w: 520, size: 56, color: t.title }),
      makeText('body', { text: '— Kari Nordmann, driftsleder', x: 120, y: 560, w: 500, color: t.body }),
    ]); },
  },
  {
    id: 'watch_focus_dark', name: 'Watch + iPhone', category: 'produktoversikt', variant: 'dark', devices: 2,
    description: 'Apple Watch og iPhone side ved side — for helse/aktivitet-apper.',
    build: () => { const t = ink('dark'); return doc('Produktoversikt', 'watch_focus_dark', baseCanvas({ accent: '#22c55e', accent2: '#22d3ee' }), [
      makeDevice('iphone', { x: 760, y: 330, w: 280, rotation: -4, shadow: true }),
      makeDevice('watch', { x: 1060, y: 430, w: 220, rotation: 6, shadow: true }),
    ], [
      makeText('eyebrow', { text: 'PÅ HÅNDLEDDET', x: 120, y: 320, w: 460 }),
      makeText('title', { text: 'Alltid med deg', x: 120, y: 365, w: 480, color: t.title }),
      makeText('body', { text: 'iPhone og Apple Watch, sømløst synkronisert.', x: 120, y: 540, w: 440, color: t.body }),
    ]); },
  },
  {
    id: 'feature_launch_light', name: 'Lansering — iPad (lys)', category: 'funksjonslansering', variant: 'light', devices: 1,
    description: 'Lys lanserings-layout: sentrert iPad med kort budskap.',
    build: () => { const t = ink('light'); return doc('Funksjonslansering', 'feature_launch_light', baseCanvas({ background: 'light', bgStyle: 'gradient' }), [
      makeDevice('ipad', { x: 560, y: 380, w: 480, shadow: true }),
    ], [
      makeText('eyebrow', { text: 'LANSERING', x: 0, y: 150, w: BASE_W, align: 'center' }),
      makeText('title', { text: 'Nå tilgjengelig', x: 0, y: 195, w: BASE_W, align: 'center', size: 72, color: t.title }),
      makeText('body', { text: 'Den nye versjonen er her.', x: 0, y: 310, w: BASE_W, align: 'center', color: t.body }),
    ]); },
  },
];

const DEV_LABEL: Record<MockupDeviceVariant, string> = { macbook: 'MacBook', ipad: 'iPad', ipad_landscape: 'iPad', iphone: 'iPhone', watch: 'Apple Watch' };
const ROLE_LABEL: Record<MockupTextRole, string> = { eyebrow: 'Etikett', title: 'Overskrift', body: 'Brødtekst', tag: 'Liten tekst' };

/** Enhets-varianter i samme orientering (tillatt device-bytte i en slot). */
export function orientationGroup(v: MockupDeviceVariant): MockupDeviceVariant[] {
  const landscape: MockupDeviceVariant[] = ['macbook', 'ipad_landscape'];
  const portrait: MockupDeviceVariant[] = ['iphone', 'ipad', 'watch'];
  return landscape.includes(v) ? landscape : portrait;
}

/** Tildel deterministiske slot-id-er (dev_i / txt_i) til elementene. */
function assignSlotIds(doc: MockupDoc): MockupDoc {
  doc.devices.forEach((d, i) => { d.slotId = `dev_${i}`; });
  doc.texts.forEach((t, i) => { t.slotId = `txt_${i}`; });
  return doc;
}

/** Utled mal-slots (kanonisk geometri + begrensninger) fra et bygget dokument. */
function slotsFromDoc(doc: MockupDoc): SlotDef[] {
  const slots: SlotDef[] = [];
  doc.devices.forEach((d) => { if (d.slotId) slots.push({ id: d.slotId, kind: 'device', label: DEV_LABEL[d.variant], zone: { x: d.x, y: d.y, w: d.w, rotation: d.rotation }, allowedVariants: orientationGroup(d.variant) }); });
  doc.texts.forEach((t) => { if (t.slotId) slots.push({ id: t.slotId, kind: 'text', role: t.role, label: ROLE_LABEL[t.role], zone: { x: t.x, y: t.y, w: t.w } }); });
  return slots;
}

export function buildTemplate(id: string): MockupDoc {
  const t = MOCKUP_TEMPLATES.find((x) => x.id === id) ?? MOCKUP_TEMPLATES[0];
  const doc = assignSlotIds(t.build());
  doc.slots = slotsFromDoc(doc);
  return doc;
}

/**
 * Snap komposisjonen til en layout-variant. Posisjonene kommer fra malens
 * slots (kanonisk geometri) — element-STØRRELSER + innhold beholdes. 'mirror'
 * speilvender horisontalt (bytter tekst/enhet-side).
 */
export function applyLayout(doc: MockupDoc, id: LayoutVariantId): MockupDoc {
  if (!doc.slots || doc.slots.length === 0) return doc;
  const W = doc.canvas.w;
  const zoneOf = (slotId?: string) => doc.slots!.find((s) => s.id === slotId)?.zone;
  const devices = doc.devices.map((d) => {
    const z = zoneOf(d.slotId);
    if (!z) return d;
    return id === 'mirror'
      ? { ...d, x: W - z.x - d.w, y: z.y, rotation: z.rotation != null ? -z.rotation : d.rotation }
      : { ...d, x: z.x, y: z.y, rotation: z.rotation ?? d.rotation };
  });
  const texts = doc.texts.map((t) => {
    const z = zoneOf(t.slotId);
    if (!z) return t;
    return id === 'mirror' ? { ...t, x: W - z.x - t.w, y: z.y } : { ...t, x: z.x, y: z.y };
  });
  return { ...doc, devices, texts };
}

export interface MalbytteReport {
  kept: string[];
  replaced: string[];
  dropped: string[];
  doc: MockupDoc;
}

/**
 * Bytt mal med innholds-bevaring (§7): skjermbilder mappes til nye device-slots
 * (samme variant → samme orientering → hvilken som helst), tekst mappes på rolle,
 * merkevare beholdes. Returnerer kompatibilitets-rapport.
 */
export function switchTemplate(oldDoc: MockupDoc, newTemplateId: string): MalbytteReport {
  const next = buildTemplate(newTemplateId);
  const kept: string[] = [], replaced: string[] = [], dropped: string[] = [];

  const oldDevices = oldDoc.devices.filter((d) => d.image);
  next.devices.forEach((nd) => {
    let idx = oldDevices.findIndex((od) => od.variant === nd.variant);
    let good = idx >= 0; // samme variant → rent treff
    if (idx < 0) { idx = oldDevices.findIndex((od) => orientationGroup(od.variant).includes(nd.variant)); good = idx >= 0; }
    if (idx < 0 && oldDevices.length) { idx = 0; good = false; } // kryss-orientering → må justeres
    if (idx >= 0) {
      const od = oldDevices.splice(idx, 1)[0];
      nd.image = od.image; nd.fit = od.fit; nd.focusX = od.focusX; nd.focusY = od.focusY;
      (good ? kept : replaced).push(`${DEV_LABEL[nd.variant]}-skjermbilde`);
    }
  });
  oldDevices.forEach((od) => replaced.push(`${DEV_LABEL[od.variant]}-skjermbilde`));

  const oldTexts = oldDoc.texts.filter((t) => t.text.trim());
  next.texts.forEach((nt) => {
    const idx = oldTexts.findIndex((ot) => ot.role === nt.role);
    if (idx >= 0) { const ot = oldTexts.splice(idx, 1)[0]; nt.text = ot.text; nt.uppercase = ot.uppercase; kept.push(ROLE_LABEL[nt.role]); }
  });
  oldTexts.forEach((ot) => dropped.push(`${ROLE_LABEL[ot.role]}: «${ot.text.slice(0, 20)}»`));

  next.canvas.accent = oldDoc.canvas.accent;
  next.canvas.accent2 = oldDoc.canvas.accent2;
  next.canvas.background = oldDoc.canvas.background;
  next.canvas.bgStyle = oldDoc.canvas.bgStyle;
  next.canvas.logo = oldDoc.canvas.logo ? { ...oldDoc.canvas.logo } : undefined;
  next.name = oldDoc.name;
  return { kept, replaced, dropped, doc: next };
}

// ── Sosiale formater (flerflate-utdata) ─────────────────────────────────────

export interface MockupFormat { id: string; label: string; w: number; h: number; }

export const MOCKUP_FORMATS: MockupFormat[] = [
  { id: 'onepager', label: 'One-pager 16:10', w: 1600, h: 1000 },
  { id: 'square', label: 'Kvadrat 1:1', w: 1080, h: 1080 },
  { id: 'story', label: 'Story/Reel 9:16', w: 1080, h: 1920 },
  { id: 'portrait', label: 'Portrett 4:5', w: 1080, h: 1350 },
  { id: 'landscape', label: 'Landskap 16:9', w: 1280, h: 720 },
  { id: 'linkedin', label: 'LinkedIn 1.91:1', w: 1200, h: 628 },
];

/** Sosiale formater for pakke-eksport (uten one-pager-kilden). */
export const SOCIAL_FORMATS = MOCKUP_FORMATS.filter((f) => f.id !== 'onepager');

/** Grovt anslag på tekst-høyde (px) uten canvas (for reflow-stabling). */
function estTextHeight(t: MockupTextSlot, w: number): number {
  const hard = Math.max(1, t.text.split('\n').length);
  const wrapped = Math.max(hard, Math.ceil((t.text.length * t.size * 0.5) / Math.max(1, w)));
  return wrapped * t.size * t.lineHeight;
}

/**
 * Auto-reflow (rolle-basert) — fallback når formatet ikke har en lagret layout:
 * - landskap → tekst-kolonne venstre, enheter høyre;
 * - portrett/kvadrat → tekst øverst, enheter under (sentrert).
 */
function reflowAuto(doc: MockupDoc, fmt: MockupFormat): MockupDoc {
  const W = fmt.w, H = fmt.h;
  // 3 orienteringer: landskap (tekst v./enheter rad h.), høy (tekst topp/enheter
  // stablet vertikalt for å FYLLE høyden), kvadratisk (tekst topp/enheter rad).
  const orient = W > H * 1.15 ? 'landscape' : H > W * 1.2 ? 'tall' : 'square';
  const m = Math.min(W, H) * 0.07;
  const landscape = orient === 'landscape';

  // Tekst-kolonne: venstre i landskap, full bredde ellers.
  const txX = m;
  const txW = landscape ? W * 0.4 - m : W - 2 * m;
  const align: MockupTextAlign = landscape ? 'left' : 'center';

  // Legg ut tekst FØRST (topp-forankret) og mål bunnen — så device-sonen blir
  // ADAPTIV og tekst aldri renner ned i enhetene (fiks for tekst-tunge maler).
  const fscale = Math.max(0.5, Math.min(1.1, txW / 620));
  let ty = m;
  const texts = doc.texts.map((t) => {
    const size = Math.max(11, Math.round(t.size * fscale));
    const nt: MockupTextSlot = { ...t, x: Math.round(txX), w: Math.round(txW), align, size, y: Math.round(ty) };
    ty += estTextHeight(nt, txW) + size * 0.35;
    return nt;
  });
  const textBottom = ty;

  // Device-sone: høyre kolonne i landskap; ellers under teksten (adaptivt).
  let deviceZone: { x: number; y: number; w: number; h: number };
  const stack = orient === 'tall';
  if (landscape) {
    deviceZone = { x: W * 0.42, y: m, w: W * 0.58 - m, h: H - 2 * m };
  } else {
    const zoneTop = textBottom + m * 0.5;
    deviceZone = { x: m, y: zoneTop, w: W - 2 * m, h: Math.max(120, H - zoneTop - m) };
  }

  let devices: MockupDeviceSlot[];
  if (stack) {
    // Vertikal kolonne: hver enhet får ~lik høyde-andel (klemt til bredden),
    // stablet og sentrert → fyller høye formater (story/portrett).
    const N = doc.devices.length;
    const gap = deviceZone.h * 0.045;
    const hPer = (deviceZone.h - gap * Math.max(0, N - 1)) / Math.max(1, N);
    const sized = doc.devices.map((d) => {
      const h = Math.min(hPer, deviceZone.w / FRAME_ASPECT[d.variant]);
      return { h, w: h * FRAME_ASPECT[d.variant] };
    });
    const totalH = sized.reduce((a, s) => a + s.h, 0) + gap * Math.max(0, N - 1);
    let dy = deviceZone.y + (deviceZone.h - totalH) / 2;
    const cx = deviceZone.x + deviceZone.w / 2;
    devices = doc.devices.map((d, i) => {
      const s = sized[i];
      const nd: MockupDeviceSlot = { ...d, w: Math.round(s.w), x: Math.round(cx - s.w / 2), y: Math.round(dy), rotation: 0 };
      dy += s.h + gap;
      return nd;
    });
  } else {
    // Horisontal rad: felles høyde, skalert ned ved overflow, sentrert.
    const targetH = deviceZone.h * 0.92;
    const gap = deviceZone.w * 0.03;
    const rawW = doc.devices.map((d) => targetH * FRAME_ASPECT[d.variant]);
    const totalW = rawW.reduce((a, b) => a + b, 0) + gap * Math.max(0, doc.devices.length - 1);
    const shrink = totalW > deviceZone.w ? deviceZone.w / totalW : 1;
    const w2 = rawW.map((w) => w * shrink);
    const rowW = w2.reduce((a, b) => a + b, 0) + gap * shrink * Math.max(0, doc.devices.length - 1);
    let dx = deviceZone.x + (deviceZone.w - rowW) / 2;
    const cy = deviceZone.y + deviceZone.h / 2;
    devices = doc.devices.map((d, i) => {
      const dw = w2[i];
      const dh = dw / FRAME_ASPECT[d.variant];
      const nd: MockupDeviceSlot = { ...d, w: Math.round(dw), x: Math.round(dx), y: Math.round(cy - dh / 2), rotation: 0 };
      dx += dw + gap * shrink;
      return nd;
    });
  }

  return { ...doc, canvas: { ...doc.canvas, w: W, h: H }, devices, texts };
}

/** Gjeldende format-id fra lerret-dimensjonene (null = egendefinert). */
export function currentFormatId(doc: MockupDoc): string | null {
  return MOCKUP_FORMATS.find((f) => f.w === doc.canvas.w && f.h === doc.canvas.h)?.id ?? null;
}

/** Har formatet en pikselperfekt lagret layout? */
export function hasFormatLayout(doc: MockupDoc, fmtId: string): boolean {
  const l = doc.formatLayouts?.[fmtId];
  return !!l && Object.keys(l).length > 0;
}

/** Fang gjeldende element-plasseringer som en per-format layout. */
function captureLayout(doc: MockupDoc): Record<string, SlotPlacement> {
  const out: Record<string, SlotPlacement> = {};
  doc.devices.forEach((d) => { if (d.slotId) out[d.slotId] = { x: d.x, y: d.y, w: d.w, rotation: d.rotation }; });
  doc.texts.forEach((t) => { if (t.slotId) out[t.slotId] = { x: t.x, y: t.y, w: t.w, size: t.size }; });
  return out;
}

/**
 * Bytt lerret-format. Bruker en PIKSELPERFEKT lagret layout for formatet hvis
 * den finnes; ellers rolle-basert auto-reflow. Oppdaterer slots.
 */
export function applyFormat(doc: MockupDoc, fmt: MockupFormat): MockupDoc {
  let next = reflowAuto(doc, fmt);
  const saved = doc.formatLayouts?.[fmt.id];
  if (saved) {
    next = {
      ...next,
      devices: next.devices.map((d) => {
        const p = d.slotId ? saved[d.slotId] : undefined;
        return p ? { ...d, x: p.x, y: p.y, w: p.w ?? d.w, rotation: p.rotation ?? d.rotation } : d;
      }),
      texts: next.texts.map((t) => {
        const p = t.slotId ? saved[t.slotId] : undefined;
        return p ? { ...t, x: p.x, y: p.y, w: p.w ?? t.w, size: p.size ?? t.size } : t;
      }),
    };
  }
  next.slots = slotsFromDoc(next);
  return next;
}

/** Lagre gjeldende plassering som pikselperfekt layout for gjeldende format. */
export function saveFormatLayout(doc: MockupDoc): MockupDoc {
  const fid = currentFormatId(doc);
  if (!fid) return doc;
  return { ...doc, formatLayouts: { ...(doc.formatLayouts ?? {}), [fid]: captureLayout(doc) } };
}

/** Fjern lagret layout for et format (→ auto-reflow neste gang formatet velges). */
export function clearFormatLayout(doc: MockupDoc, fmtId: string): MockupDoc {
  if (!doc.formatLayouts?.[fmtId]) return doc;
  const next = { ...doc.formatLayouts };
  delete next[fmtId];
  return { ...doc, formatLayouts: next };
}

// ── Persistering (localStorage, samme mønster som demoStudioModel) ──────────

const PROJECTS_KEY = 'trrpa.mockup.projects';
const CURRENT_KEY = 'trrpa.mockup.current';

function readProjects(): MockupDoc[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as MockupDoc[];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

function writeProjects(list: MockupDoc[]): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
  } catch {
    /* quota — ignorer, ikke krasj editoren */
  }
}

function validDoc(d: MockupDoc | undefined | null): MockupDoc | null {
  if (!d || d.version !== 1 || !d.canvas || !d.canvas.accent2 || !d.canvas.background) return null;
  d.devices = Array.isArray(d.devices) ? d.devices : [];
  d.texts = Array.isArray(d.texts) ? d.texts : [];
  return d;
}

/** Alle prosjekter (nyeste først), inkl. arkiverte. */
export function listProjects(): MockupDoc[] {
  return readProjects()
    .map(validDoc)
    .filter((d): d is MockupDoc => d !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Autolagre: upsert gjeldende dokument inn i prosjekt-registeret + peker. */
export function saveDoc(d: MockupDoc): void {
  d.updatedAt = Date.now();
  const list = readProjects();
  const i = list.findIndex((p) => p.id === d.id);
  if (i >= 0) list[i] = d; else list.unshift(d);
  writeProjects(list);
  try { localStorage.setItem(CURRENT_KEY, d.id); } catch { /* ignore */ }
}

/** Last gjeldende prosjekt (peker → nyeste ikke-arkiverte → null). */
export function loadDoc(): MockupDoc | null {
  const list = listProjects();
  if (list.length === 0) return null;
  const cur = (() => { try { return localStorage.getItem(CURRENT_KEY); } catch { return null; } })();
  return list.find((p) => p.id === cur) ?? list.find((p) => p.status !== 'archived') ?? null;
}

/** Bygg et nytt mind map-dokument (egen slide) med gitt Mermaid-kilde + merkevare. */
export function buildMindmapDoc(mermaid: string, opts?: { accent?: string; accent2?: string; background?: MockupBackground; typography?: MockupTypographyId; name?: string }): MockupDoc {
  const base = buildTemplate('hero_mac_phone_dark');
  const doc: MockupDoc = {
    ...base, id: uid('doc'), name: opts?.name || 'Produkt-mind map',
    devices: [], texts: [], slots: [], annotations: [], mindmap: mermaid,
    status: 'draft', updatedAt: Date.now(),
  };
  doc.canvas = { ...doc.canvas };
  if (opts?.accent) doc.canvas.accent = opts.accent;
  if (opts?.accent2) doc.canvas.accent2 = opts.accent2;
  if (opts?.background) doc.canvas.background = opts.background;
  if (opts?.typography) doc.canvas.typography = opts.typography;
  return doc;
}

export function createProject(templateId: string): MockupDoc {
  const d = buildTemplate(templateId);
  d.status = 'draft';
  saveDoc(d);
  return d;
}

export function duplicateProject(id: string): MockupDoc | null {
  const p = listProjects().find((x) => x.id === id);
  if (!p) return null;
  const clone: MockupDoc = { ...(JSON.parse(JSON.stringify(p)) as MockupDoc), id: uid('doc'), name: `${p.name} (kopi)`, status: 'draft', updatedAt: Date.now() };
  saveDoc(clone);
  return clone;
}

export function renameProject(id: string, name: string): void {
  const list = readProjects();
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) { list[i].name = name; writeProjects(list); }
}

export function setProjectStatus(id: string, status: MockupProjectStatus): void {
  const list = readProjects();
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) { list[i].status = status; writeProjects(list); }
}

export function deleteProject(id: string): void {
  writeProjects(readProjects().filter((x) => x.id !== id));
}

// ── Brand kits (gjenbrukbar merkevare §1.3) ────────────────────────────────

export interface MockupBrandKit {
  id: string;
  name: string;
  accent: string;
  accent2: string;
  background: MockupBackground;
  bgStyle: MockupBgStyle;
  logo?: MockupLogo;
}

const BRANDKITS_KEY = 'trrpa.mockup.brandkits';

export function listBrandKits(): MockupBrandKit[] {
  try {
    const r = localStorage.getItem(BRANDKITS_KEY);
    if (!r) return [];
    const a = JSON.parse(r) as MockupBrandKit[];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function saveBrandKit(name: string, canvas: MockupCanvasSpec): { ok: boolean; error?: string } {
  const kit: MockupBrandKit = {
    id: uid('bk'), name: name.trim() || 'Merkevare',
    accent: canvas.accent, accent2: canvas.accent2, background: canvas.background, bgStyle: canvas.bgStyle,
    logo: canvas.logo ? { ...canvas.logo } : undefined,
  };
  try {
    localStorage.setItem(BRANDKITS_KEY, JSON.stringify([kit, ...listBrandKits().filter((k) => k.name !== kit.name)].slice(0, 20)));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Kunne ikke lagre brand kit.' };
  }
}

export function deleteBrandKit(id: string): void {
  try {
    localStorage.setItem(BRANDKITS_KEY, JSON.stringify(listBrandKits().filter((k) => k.id !== id)));
  } catch {
    /* ignore */
  }
}

/** Canvas-patch som anvender et brand kit (accenter + bakgrunn + logo). */
export function brandKitPatch(id: string): Partial<MockupCanvasSpec> | null {
  const k = listBrandKits().find((x) => x.id === id);
  if (!k) return null;
  return { accent: k.accent, accent2: k.accent2, background: k.background, bgStyle: k.bgStyle, logo: k.logo ? { ...k.logo } : undefined };
}

// ── Kits (lagrede oppsett i localStorage) ────────────────────────────────

/** Et lagret «kit» = et navngitt, gjenbrukbart MockupDoc-oppsett. */
export interface MockupKit {
  id: string;
  name: string;
  savedAt: number;
  doc: MockupDoc;
}

const KITS_KEY = 'trrpa.mockup.kits';

export function listKits(): MockupKit[] {
  try {
    const raw = localStorage.getItem(KITS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as MockupKit[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** Lagre gjeldende dokument som et navngitt kit (nyeste først, maks 30). */
export function saveKit(name: string, doc: MockupDoc): { ok: boolean; error?: string } {
  const kit: MockupKit = {
    id: uid('kit'),
    name: name.trim() || 'Kit',
    savedAt: Date.now(),
    doc: JSON.parse(JSON.stringify(doc)) as MockupDoc,
  };
  const next = [kit, ...listKits()].slice(0, 30);
  try {
    localStorage.setItem(KITS_KEY, JSON.stringify(next));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Kunne ikke lagre kit (for stort? slett noen kits eller skjermbilder).' };
  }
}

export function deleteKit(id: string): void {
  try {
    localStorage.setItem(KITS_KEY, JSON.stringify(listKits().filter((k) => k.id !== id)));
  } catch {
    /* ignore */
  }
}

/** Hent et kit som et FRISKT dokument (ny id) klart til redigering. */
export function loadKitDoc(id: string): MockupDoc | null {
  const kit = listKits().find((k) => k.id === id);
  if (!kit) return null;
  const clone = JSON.parse(JSON.stringify(kit.doc)) as MockupDoc;
  return { ...clone, id: uid('doc'), updatedAt: Date.now() };
}

// ── Versjoner (ikke-destruktiv historikk §1.4) ─────────────────────────────

export interface MockupVersion {
  id: string;
  name: string;
  at: number;
  doc: MockupDoc;
}

const VERSIONS_KEY = 'trrpa.mockup.versions';

export function listVersions(): MockupVersion[] {
  try {
    const r = localStorage.getItem(VERSIONS_KEY);
    if (!r) return [];
    const a = JSON.parse(r) as MockupVersion[];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function saveVersion(name: string, doc: MockupDoc): { ok: boolean; error?: string } {
  const v: MockupVersion = { id: uid('ver'), name: name.trim() || `Versjon ${listVersions().length + 1}`, at: Date.now(), doc: JSON.parse(JSON.stringify(doc)) as MockupDoc };
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify([v, ...listVersions()].slice(0, 20)));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Kunne ikke lagre versjon (for stort).' };
  }
}

export function deleteVersion(id: string): void {
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(listVersions().filter((v) => v.id !== id)));
  } catch {
    /* ignore */
  }
}

export function loadVersionDoc(id: string): MockupDoc | null {
  const v = listVersions().find((x) => x.id === id);
  if (!v) return null;
  const clone = JSON.parse(JSON.stringify(v.doc)) as MockupDoc;
  return { ...clone, id: uid('doc'), updatedAt: Date.now() };
}

// ── Eksport-historikk ────────────────────────────────────────────────────

export interface MockupExportRecord {
  id: string;
  name: string;
  format: string; // 'PNG 2×' | 'PDF' | 'PSD' | 'PSD ✎'
  at: number;
  path: string;
}

const EXPORTS_KEY = 'trrpa.mockup.exports';

export function listExports(): MockupExportRecord[] {
  try {
    const r = localStorage.getItem(EXPORTS_KEY);
    if (!r) return [];
    const a = JSON.parse(r) as MockupExportRecord[];
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function addExport(name: string, format: string, path: string): void {
  const rec: MockupExportRecord = { id: uid('exp'), name, format, path, at: Date.now() };
  try {
    localStorage.setItem(EXPORTS_KEY, JSON.stringify([rec, ...listExports()].slice(0, 40)));
  } catch {
    /* ignore */
  }
}

/** Løs en tekstfarge: 'accent'/'accent2'-sentinel → lerretets accenter, ellers literal. */
export function resolveColor(color: string, canvas: MockupCanvasSpec): string {
  if (color === 'accent') return canvas.accent;
  if (color === 'accent2') return canvas.accent2;
  return color;
}

/** Filnavn-trygt slug av dokumentnavn. */
export function safeDocName(name: string): string {
  return (name || 'mockup').trim().replace(/[^\p{L}\p{N}\-_ ]+/gu, '').replace(/\s+/g, '-').slice(0, 60) || 'mockup';
}

// ── Design-galleri (ferdig-stylede presets §3) ─────────────────────────────
//
// En preset = mal (device-layout) × typografi × dekor × palett × bakgrunn. Gir
// ikke-designeren et komplett, gjennomtenkt utgangspunkt i ett klikk — ikke bare
// en tom struktur. Alle bygger på eksisterende maler; kun stil-laget varierer.

export type DesignTone = 'mork' | 'lys';

/** Gjenbrukbar fargepalett (accent-par) for hurtig ny-farging i galleriet. */
export interface MockupPalette { id: string; label: string; accent: string; accent2: string; }

export const MOCKUP_PALETTES: MockupPalette[] = [
  { id: 'midnatt', label: 'Midnatt', accent: '#22d3ee', accent2: '#a78bfa' },
  { id: 'aurora', label: 'Aurora', accent: '#2dd4bf', accent2: '#8b5cf6' },
  { id: 'neon', label: 'Neon', accent: '#f472b6', accent2: '#22d3ee' },
  { id: 'kobber', label: 'Kobber', accent: '#f59e0b', accent2: '#b45309' },
  { id: 'skog', label: 'Skog', accent: '#34d399', accent2: '#2dd4bf' },
  { id: 'rubin', label: 'Rubin', accent: '#fb7185', accent2: '#fb923c' },
  { id: 'indigo', label: 'Indigo', accent: '#6366f1', accent2: '#3b82f6' },
  { id: 'grafitt', label: 'Grafitt', accent: '#38bdf8', accent2: '#94a3b8' },
  { id: 'mono', label: 'Mono', accent: '#e5e7eb', accent2: '#9ca3af' },
  { id: 'smaragd', label: 'Smaragd', accent: '#10b981', accent2: '#059669' },
  { id: 'ember', label: 'Ember', accent: '#f97316', accent2: '#ef4444' },
  { id: 'lavendel', label: 'Lavendel', accent: '#a78bfa', accent2: '#c084fc' },
  { id: 'havbla', label: 'Havblå', accent: '#0ea5e9', accent2: '#06b6d4' },
  { id: 'plakat', label: 'Plakat', accent: '#d946ef', accent2: '#7c3aed' },
  { id: 'volt', label: 'Volt', accent: '#a3e635', accent2: '#22d3ee' },
  { id: 'gull', label: 'Gull', accent: '#fbbf24', accent2: '#f59e0b' },
  { id: 'prisme', label: 'Prisme', accent: '#6366f1', accent2: '#ec4899' },
];

export interface MockupDesignPreset {
  id: string;
  label: string;
  blurb: string;
  templateId: string;
  typography: MockupTypographyId;
  decor: MockupDecor;
  background: MockupBackground;
  bgStyle: MockupBgStyle;
  accent: string;
  accent2: string;
  tone: DesignTone;
}

export const DESIGN_PRESETS: MockupDesignPreset[] = [
  // ── Mørke ──────────────────────────────────────────────────────────────
  { id: 'midnatt', label: 'Midnatt', blurb: 'Kjølig cyan-glød, ren og moderne', templateId: 'hero_mac_phone_dark', typography: 'moderne', decor: 'orbs', background: 'brand', bgStyle: 'gradient', accent: '#22d3ee', accent2: '#a78bfa', tone: 'mork' },
  { id: 'aurora', label: 'Aurora', blurb: 'Mesh-gradient i teal og fiolett', templateId: 'hero_mac_phone_dark', typography: 'geometrisk', decor: 'mesh', background: 'brand', bgStyle: 'atmospheric', accent: '#2dd4bf', accent2: '#8b5cf6', tone: 'mork' },
  { id: 'neon-pitch', label: 'Neon', blurb: 'Magenta-cyan salgspitch med punch', templateId: 'sales_pitch_dark', typography: 'geometrisk', decor: 'mesh', background: 'dark', bgStyle: 'atmospheric', accent: '#f472b6', accent2: '#22d3ee', tone: 'mork' },
  { id: 'kobber-stats', label: 'Kobber', blurb: 'Varm amber, redaksjonelle tall', templateId: 'stats_dark', typography: 'editorial', decor: 'shapes', background: 'dark', bgStyle: 'gradient', accent: '#f59e0b', accent2: '#b45309', tone: 'mork' },
  { id: 'skog-feature', label: 'Skog', blurb: 'Grønt rutenett, rolig og teknisk', templateId: 'feature_trio_dark', typography: 'moderne', decor: 'grid', background: 'dark', bgStyle: 'gradient', accent: '#34d399', accent2: '#2dd4bf', tone: 'mork' },
  { id: 'grafitt-watch', label: 'Grafitt', blurb: 'Nøktern mono-teknisk på grafitt', templateId: 'watch_focus_dark', typography: 'teknisk', decor: 'grid', background: 'dark', bgStyle: 'clean', accent: '#38bdf8', accent2: '#94a3b8', tone: 'mork' },
  { id: 'rubin', label: 'Rubin', blurb: 'Rosa-oransje glød, energisk', templateId: 'stats_dark', typography: 'geometrisk', decor: 'orbs', background: 'brand', bgStyle: 'gradient', accent: '#fb7185', accent2: '#fb923c', tone: 'mork' },
  { id: 'mono', label: 'Mono', blurb: 'Minimalistisk, ren og tekst-drevet', templateId: 'sales_pitch_dark', typography: 'teknisk', decor: 'none', background: 'dark', bgStyle: 'clean', accent: '#e5e7eb', accent2: '#9ca3af', tone: 'mork' },
  { id: 'indigo-hero', label: 'Indigo', blurb: 'Dyp indigo-mesh, produktfokus', templateId: 'hero_mac_phone_dark', typography: 'moderne', decor: 'mesh', background: 'brand', bgStyle: 'atmospheric', accent: '#6366f1', accent2: '#3b82f6', tone: 'mork' },
  { id: 'ember', label: 'Ember', blurb: 'Glødende oransje-rød hero', templateId: 'hero_mac_phone_dark', typography: 'geometrisk', decor: 'orbs', background: 'brand', bgStyle: 'gradient', accent: '#f97316', accent2: '#ef4444', tone: 'mork' },
  { id: 'smaragd', label: 'Smaragd', blurb: 'Dyp grønn mesh-pitch', templateId: 'sales_pitch_dark', typography: 'moderne', decor: 'mesh', background: 'brand', bgStyle: 'atmospheric', accent: '#10b981', accent2: '#059669', tone: 'mork' },
  { id: 'kobolt', label: 'Kobolt', blurb: 'Klar blå, klokke i fokus', templateId: 'watch_focus_dark', typography: 'moderne', decor: 'orbs', background: 'dark', bgStyle: 'gradient', accent: '#3b82f6', accent2: '#0ea5e9', tone: 'mork' },
  { id: 'nordlys', label: 'Nordlys', blurb: 'Grønn-fiolett mesh, nøkkeltall', templateId: 'stats_dark', typography: 'geometrisk', decor: 'mesh', background: 'brand', bgStyle: 'atmospheric', accent: '#34d399', accent2: '#8b5cf6', tone: 'mork' },
  { id: 'karbon', label: 'Karbon', blurb: 'Teknisk mørk med rutenett', templateId: 'feature_trio_dark', typography: 'teknisk', decor: 'grid', background: 'dark', bgStyle: 'clean', accent: '#38bdf8', accent2: '#64748b', tone: 'mork' },
  // ── Modige / kreative (nye virkemidler) ──────────────────────────────────
  { id: 'plakat', label: 'Plakat', blurb: 'Diagonalt fargebånd, plakat-look', templateId: 'hero_mac_phone_dark', typography: 'geometrisk', decor: 'band', background: 'brand', bgStyle: 'atmospheric', accent: '#d946ef', accent2: '#7c3aed', tone: 'mork' },
  { id: 'radar', label: 'Radar', blurb: 'Konsentriske ringer, teknisk puls', templateId: 'hero_mac_phone_dark', typography: 'teknisk', decor: 'rings', background: 'dark', bgStyle: 'clean', accent: '#22d3ee', accent2: '#0ea5e9', tone: 'mork' },
  { id: 'rytme', label: 'Rytme', blurb: 'Flytende bølger, rolig og elegant', templateId: 'hero_mac_phone_dark', typography: 'moderne', decor: 'waves', background: 'brand', bgStyle: 'gradient', accent: '#2dd4bf', accent2: '#22d3ee', tone: 'mork' },
  { id: 'rampelys', label: 'Rampelys', blurb: 'Dramatisk spotlight på tallene', templateId: 'stats_dark', typography: 'editorial', decor: 'spotlight', background: 'dark', bgStyle: 'clean', accent: '#fbbf24', accent2: '#f59e0b', tone: 'mork' },
  { id: 'volt', label: 'Volt', blurb: 'Elektriske striper, maks energi', templateId: 'stats_dark', typography: 'geometrisk', decor: 'stripes', background: 'dark', bgStyle: 'clean', accent: '#a3e635', accent2: '#22d3ee', tone: 'mork' },
  { id: 'puls', label: 'Puls', blurb: 'Radar-ringer i rosa, energisk', templateId: 'stats_dark', typography: 'geometrisk', decor: 'rings', background: 'brand', bgStyle: 'atmospheric', accent: '#fb7185', accent2: '#f472b6', tone: 'mork' },
  // ── Lyse ───────────────────────────────────────────────────────────────
  { id: 'kritt', label: 'Kritt', blurb: 'Lys og luftig med indigo-orber', templateId: 'hero_mac_phone_light', typography: 'moderne', decor: 'orbs', background: 'light', bgStyle: 'gradient', accent: '#6366f1', accent2: '#3b82f6', tone: 'lys' },
  { id: 'redaksjon', label: 'Redaksjon', blurb: 'Serif-tittel, ren kundecase', templateId: 'case_study_light', typography: 'editorial', decor: 'none', background: 'light', bgStyle: 'clean', accent: '#111827', accent2: '#b45309', tone: 'lys' },
  { id: 'pastell', label: 'Pastell', blurb: 'Myk rosa-fiolett lansering', templateId: 'feature_launch_light', typography: 'geometrisk', decor: 'mesh', background: 'light', bgStyle: 'gradient', accent: '#ec4899', accent2: '#8b5cf6', tone: 'lys' },
  { id: 'sitrus', label: 'Sitrus', blurb: 'Friske former i oransje og rosa', templateId: 'feature_launch_light', typography: 'moderne', decor: 'shapes', background: 'light', bgStyle: 'clean', accent: '#f97316', accent2: '#ec4899', tone: 'lys' },
  { id: 'luft', label: 'Luft', blurb: 'Nøytralt rutenett, blå aksent', templateId: 'hero_mac_phone_light', typography: 'teknisk', decor: 'grid', background: 'light', bgStyle: 'clean', accent: '#2563eb', accent2: '#64748b', tone: 'lys' },
  { id: 'lavendel', label: 'Lavendel', blurb: 'Myk lilla serif-kundecase', templateId: 'case_study_light', typography: 'editorial', decor: 'orbs', background: 'light', bgStyle: 'gradient', accent: '#8b5cf6', accent2: '#c084fc', tone: 'lys' },
  { id: 'havbla', label: 'Havblå', blurb: 'Frisk cyan lansering', templateId: 'feature_launch_light', typography: 'moderne', decor: 'mesh', background: 'light', bgStyle: 'gradient', accent: '#0ea5e9', accent2: '#06b6d4', tone: 'lys' },
  { id: 'presse', label: 'Presse', blurb: 'Redaksjonell navy hero', templateId: 'hero_mac_phone_light', typography: 'editorial', decor: 'grid', background: 'light', bgStyle: 'clean', accent: '#1e3a8a', accent2: '#b45309', tone: 'lys' },
  { id: 'prisme', label: 'Prisme', blurb: 'Lyst fargebånd, moderne plakat', templateId: 'hero_mac_phone_light', typography: 'moderne', decor: 'band', background: 'light', bgStyle: 'gradient', accent: '#6366f1', accent2: '#ec4899', tone: 'lys' },
  { id: 'fest', label: 'Fest', blurb: 'Konfetti-lansering, leken', templateId: 'feature_launch_light', typography: 'geometrisk', decor: 'confetti', background: 'light', bgStyle: 'gradient', accent: '#ec4899', accent2: '#f59e0b', tone: 'lys' },
  { id: 'trykk', label: 'Trykk', blurb: 'Halvtone-raster, retro redaksjon', templateId: 'case_study_light', typography: 'teknisk', decor: 'halftone', background: 'light', bgStyle: 'clean', accent: '#111827', accent2: '#ef4444', tone: 'lys' },
  { id: 'donning', label: 'Dønning', blurb: 'Rolige bølger, seriøs kundecase', templateId: 'case_study_light', typography: 'editorial', decor: 'waves', background: 'light', bgStyle: 'clean', accent: '#0ea5e9', accent2: '#2dd4bf', tone: 'lys' },
];

/** Bygg et MockupDoc fra en design-preset: mal + fullt stil-lag. */
export function buildPreset(id: string): MockupDoc {
  const p = DESIGN_PRESETS.find((x) => x.id === id) ?? DESIGN_PRESETS[0];
  const doc = buildTemplate(p.templateId);
  doc.canvas.typography = p.typography;
  doc.canvas.decor = p.decor;
  doc.canvas.background = p.background;
  doc.canvas.bgStyle = p.bgStyle;
  doc.canvas.accent = p.accent;
  doc.canvas.accent2 = p.accent2;
  doc.name = p.label;
  return doc;
}
