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
import { MEDSIDE_COLORS, MEDSIDE_LOGO_DATA_URL } from './medsideBrand';

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
  /** 2.5D perspektiv-preset (affint). Default 'none' (rett på). Watch ignorerer. */
  perspective?: import('./mockupPerspective').MockupPerspective;
  /** Speilrefleksjon under enheten (fader ut). */
  reflection?: boolean;
  /** Ren status-bar (09:41 + signal/wifi/batteri) over skjermbildet (kun telefoner). */
  cleanStatusBar?: boolean;
  /** Chat-skrive-animasjon OPPÅ skjermen (typing-prikker → tekst-for-tekst) —
   *  «noen chatter»-effekt inne i enhets-mocken. Samme mekanikk som
   *  MockupImageSlot.chatType, klippet til enhetens skjerm-rect (deviceScreenRect). */
  chatType?: ChatTypeConfig;
  /** Ekte 3D-render (WebGL, bakt til 2D-lag). Kun iphone/android i fase 1. Default av. */
  threeD?: {
    rotX: number; rotY: number; rotZ: number; light?: string; zoom?: number; kbLayout?: 'mac' | 'windows';
    /** Keyframe-graf: property → keyframes (t 0..1 over timeline, v = verdi). Overstyrer
     *  rotX/rotY/rotZ/zoom under avspilling (bezier-aktig smoothstep-interpolasjon). */
    kf?: Record<string, Keyframe[]>;
  };
  /**
   * Skrive-animasjon: teksten «skrives» tegn-for-tegn på skjermen mens riktig
   * tast trykkes (laptop = fysisk dekk; telefon/tablet = on-screen-tastatur).
   * Drives av animasjons-tidslinjen (anim.t). Tom/udefinert = ingen animasjon.
   */
  typeAnim?: TypeAnimCfg;
}

/** Skrive-animasjon: humanisert tempo + felt-kontekst + payoff. */
export type MockupFieldStyle = 'plain' | 'search' | 'chat' | 'url' | 'document' | 'code' | 'terminal';

/** Ett klipp på animasjons-timelinen (NLE-blokk på et spor). */
export interface TimelineClip {
  id: string;
  label: string;
  track: number;                 // rad-indeks (spor)
  start: number;                 // sekunder fra 0
  len: number;                   // varighet i sekunder
  kind: 'type' | 'reveal' | 'rig'; // skrive-animasjon, inntoning, eller figur-rigg-visning (read-only)
  ref?: string;                  // device/text-id klippet styrer
  ease?: 'linear' | 'smooth' | 'in' | 'out';
}
export interface MockupTimeline { duration: number; clips: TimelineClip[]; in?: number; out?: number; }

/** Per-keyframe retime-modus: interpolasjon på segmentet SOM FORLATER dette keyframet. */
export type KfEase = 'linear' | 'smooth' | 'in' | 'out' | 'hold';
export interface Keyframe { t: number; v: number; e?: KfEase }
const easeSeg = (mode: KfEase | undefined, p: number): number =>
  mode === 'linear' ? p
  : mode === 'in' ? p * p
  : mode === 'out' ? 1 - (1 - p) * (1 - p)
  : mode === 'hold' ? 0                       // step: hold verdien til neste keyframe
  : p * p * (3 - 2 * p);                       // smooth (default) = smoothstep

/** Interpolér en keyframe-kurve ved tid t (0..1). Ærer per-keyframe ease. Null hvis tom. */
export function sampleKf(kfs: Keyframe[] | undefined, t: number): number | null {
  if (!kfs || kfs.length === 0) return null;
  const s = [...kfs].sort((a, b) => a.t - b.t);
  if (t <= s[0].t) return s[0].v;
  if (t >= s[s.length - 1].t) return s[s.length - 1].v;
  for (let i = 0; i < s.length - 1; i++) {
    if (t >= s[i].t && t <= s[i + 1].t) {
      const p = (t - s[i].t) / Math.max(1e-6, s[i + 1].t - s[i].t);
      return s[i].v + (s[i + 1].v - s[i].v) * easeSeg(s[i].e, p);
    }
  }
  return s[s.length - 1].v;
}

/**
 * Lokal, eased progresjon (0..1) for et elements klipp ved global playhead-tid
 * tGlobal (0..1 over hele timelinen). Null hvis elementet ikke har et slikt klipp.
 */
export function clipLocalT(tl: MockupTimeline, ref: string, kind: TimelineClip['kind'], tGlobal: number): number | null {
  const clip = tl.clips.find((c) => c.ref === ref && c.kind === kind);
  if (!clip) return null;
  const local = Math.max(0, Math.min(1, (tGlobal * tl.duration - clip.start) / Math.max(0.01, clip.len)));
  const e = clip.ease ?? 'linear';
  return e === 'smooth' ? local * local * (3 - 2 * local) : e === 'in' ? local * local : e === 'out' ? 1 - (1 - local) * (1 - local) : local;
}

/**
 * Utled default-klipp fra dokumentets animerbare elementer (om ingen timeline).
 * Tekst FØRST, enheter ETTER: hook-og-avslør-rekkefølge (påstanden leses før
 * skjermbildet vises som bevis) — matcher 2026-praksis for social-annonser
 * (LinkedIn/Meta-video: hook i første 0-3s, ikke logo/produkt-først). Var
 * tidligere omvendt (enhet momentant, tekst fra 0.8s) — se docs/superpowers.
 */
export function deriveTimeline(doc: MockupDoc): MockupTimeline {
  if (doc.timeline?.clips.length) return doc.timeline;
  const clips: TimelineClip[] = [];
  doc.texts.forEach((tx, i) => clips.push({ id: `rev_${tx.id}`, label: 'tekst inn', track: 2, start: i * 0.2, len: 0.7, kind: 'reveal', ref: tx.id }));
  const textsEnd = doc.texts.length ? (doc.texts.length - 1) * 0.2 + 0.7 : 0;
  let t = textsEnd + 0.15;
  doc.devices.forEach((d, i) => {
    const devStart = t + i * 0.25, devLen = 0.8;
    clips.push({ id: `rev_${d.id}`, label: `${d.variant} inn`, track: 0, start: devStart, len: devLen, kind: 'reveal', ref: d.id });
    if (d.typeAnim?.text && d.threeD) {
      const len = Math.max(1.2, d.typeAnim.text.length * 0.14);
      clips.push({ id: `type_${d.id}`, label: `skriv: ${d.typeAnim.text.slice(0, 16)}`, track: 1, start: t + 0.6, len, kind: 'type', ref: d.id, ease: 'smooth' });
      t += len + 0.4;
    }
    // Chat-typing på skjermen (uavhengig av 3D-typeAnim ovenfor) — starter etter enhetens egen avsløring.
    if (d.chatType?.turns?.length) {
      clips.push({ id: `chat_${d.id}`, label: `chat: ${d.chatType.turns[0]?.question.slice(0, 16) ?? ''}`, track: 4, start: devStart + devLen + 0.15, len: chatClipDuration(d.chatType), kind: 'type', ref: d.id, ease: 'linear' });
    }
  });
  if (doc.canvas.scene?.typeAnim?.text) {
    const len = Math.max(1.2, doc.canvas.scene.typeAnim.text.length * 0.14);
    clips.push({ id: 'type_scene', label: `skriv: ${doc.canvas.scene.typeAnim.text.slice(0, 16)}`, track: 1, start: t + 0.4, len, kind: 'type', ref: 'scene', ease: 'smooth' });
  }
  // Frie bilder (grid/collage): stagger-reveal fra start → «reel»-inntoning av
  // menyen (ingen konkurrerende hook-tekst i den komposisjonstypen — uendret).
  (doc.images ?? []).forEach((im, i) => {
    const revStart = 0.1 + i * 0.12, revLen = 0.7;
    clips.push({ id: `rev_${im.id}`, label: 'bilde inn', track: 3, start: revStart, len: revLen, kind: 'reveal', ref: im.id });
    // Chat-typing: starter ETTER at bildet/kortet er avslørt (typing-prikker → tekst).
    if (im.chatType?.turns?.length) {
      clips.push({ id: `chat_${im.id}`, label: `chat: ${im.chatType.turns[0]?.question.slice(0, 16) ?? ''}`, track: 4, start: revStart + revLen + 0.15, len: chatClipDuration(im.chatType), kind: 'type', ref: im.id, ease: 'linear' });
    }
    // Figur-rigg (person-laptop m/ keyframe-kurver): read-only visnings-klipp — kurvene selv er
    // keyet mot global t (0..1), ikke klipp-relativ tid, så klippet kan IKKE dras/trimmes ennå.
    // Spenner fra scene-start til der resten av scenen ender så langt, som en enkel indikasjon
    // på at figuren «er med» gjennom klippet.
    if (im.illustration === 'person-laptop' && im.kf && Object.keys(im.kf).length) {
      const knownEnd = Math.max(3, ...clips.map((c) => c.start + c.len));
      clips.push({ id: `rig_${im.id}`, label: 'rigg: figur', track: 5, start: 0, len: knownEnd, kind: 'rig', ref: im.id });
    }
  });
  const duration = Math.max(3, ...clips.map((c) => c.start + c.len)) + 0.5;
  return { duration, clips };
}

/** Ett-klikks skrive-scenarier (setter tekst + felt + payoff ferdig). */
export const TYPE_PRESETS: { id: string; label: string; cfg: TypeAnimCfg }[] = [
  { id: 'search', label: 'Søk → resultat', cfg: { text: 'beste leads i oslo', field: 'search', placeholder: 'Søk…', payoff: true } },
  { id: 'message', label: 'Send melding', cfg: { text: 'Hei! Klar for møtet?', field: 'chat', payoff: true, keyPop: true } },
  { id: 'url', label: 'Åpne side', cfg: { text: 'creatorhubn.com', field: 'url', payoff: true } },
  { id: 'code', label: 'Skriv kode', cfg: { text: 'const leads = await api.fetch();', field: 'code', keyPop: true } },
  { id: 'terminal', label: 'Terminal', cfg: { text: 'npm run deploy', field: 'terminal', payoff: true } },
  { id: 'form', label: 'Skriv i felt', cfg: { text: 'daniel@creatorhubn.com', field: 'plain', placeholder: 'E-post', correct: true } },
];
export interface TypeAnimCfg {
  text: string;
  keyPop?: boolean;
  /** Felt-kontekst (søkefelt/chat/URL/dokument/kode/terminal). Default 'plain'. */
  field?: MockupFieldStyle;
  /** Grå placeholder-tekst før skriving. */
  placeholder?: string;
  /** Payoff-øyeblikk etter skriving (Enter → resultat). */
  payoff?: boolean;
  /** Menneskelig korreksjon (typo → slett → korriger). */
  correct?: boolean;
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
  /** Eid av en galleri-fremvisning (arrangeLibrary pris/navn-label). Ryddes ved neste fremvisning. */
  genArrange?: boolean;
  /** For arrange-labels: navn og pris lagret separat → «Med priser»-bryteren kan skru pris av/på live. */
  baseText?: string;
  priceText?: string;
}

/** Pen-formater et bibliotek-filnavn til label: «kebab-detroit» → «Kebab Detroit». */
export function prettyName(s: string): string {
  return s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Bakgrunns-modus (§1.3/§6): lys, mørk eller merkevare-tonet. */
export type MockupBackground = 'light' | 'dark' | 'brand';
/** Bakgrunns-stil: ren flate, gradient eller atmosfærisk (accent-glød). */
export type MockupBgStyle = 'clean' | 'gradient' | 'atmospheric';

/** Dekor-lag: designer-elementer bak innholdet (visuell dybde). */
export type MockupDecor =
  | 'none' | 'orbs' | 'mesh' | 'grid' | 'shapes'
  | 'rings' | 'stripes' | 'waves' | 'spotlight' | 'confetti' | 'halftone' | 'band' | 'arc';

export const DECOR_LABELS: Record<MockupDecor, string> = {
  none: 'Ingen', orbs: 'Glød-orber', mesh: 'Gradient-mesh', grid: 'Rutenett', shapes: 'Former',
  rings: 'Radar-ringer', stripes: 'Diagonale striper', waves: 'Bølger', spotlight: 'Spotlight',
  confetti: 'Konfetti', halftone: 'Halvtone', band: 'Diagonalt bånd', arc: 'Myk bue',
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
  /** Warmth-grade (0..1): varm WB + metnings-løft → craveable mat-look (statisk synlig). */
  warmth?: number;
  /** Push-in (0..1): global kamera-zoom under avspilling → kinematisk hero-inntoning. */
  pushIn?: number;
  /** Tempo (BPM) for beat-markører + zoom-punch-synk. Default undefined = av. */
  bpm?: number;
  /** Zoom-punch (0..1): rask skala-puls på hver beat → retention-rytme synket til musikk. */
  beatPunch?: number;
  /** Lyd-spor (mp3/m4a dataURL eller sti) → muxes inn i MP4-eksporten (musicPath). Sett BPM = sporets tempo for beat-synk. */
  audio?: { src: string; name?: string };
  /** Valgfri AI-generert bakgrunnsbilde (data-URL, cover-fylt bak dekor). */
  bgImage?: string;
  /** Lifestyle-scene: fotografisk bakgrunn + skjermbilde warpet i perspektiv-quad.
   * typeAnim = valgfri skrive-animasjon komponert på skjermbildet (on-screen-tastatur). */
  scene?: { id: string; shot?: string; typeAnim?: TypeAnimCfg };
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
  /** Frittstående bilde-elementer (mat-foto/collage rett på lerretet, uten enhet-ramme). */
  images?: MockupImageSlot[];
  /** Gjeldende layout-variant: er komposisjonen speilvendt? (styrer reversibel speiling av
   *  frie elementer som ikke har slot-sone). */
  mirrored?: boolean;
  /** Illustrasjons-lag (callout/lupe/markør). Valgfri — tomt/udefinert = ingen. */
  annotations?: MockupAnnotation[];
  /** Produkt-mind map (Mermaid `mindmap`-syntaks). Satt → lerretet er en mind
   *  map-slide (rendres native i merkevarens farger, ikke enheter/tekst). */
  mindmap?: string;
  updatedAt: number;
  /** Prosjektstatus (§ prosjektoversikt). Default 'draft'. */
  status?: MockupProjectStatus;
  /** Multi-spor animasjons-timeline (NLE): klipp arrangert på spor over tid. */
  timeline?: MockupTimeline;
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
  h?: number;    // for frie bilde-element
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
export function uid(prefix: string): string {
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
  android: 621 / 1378,
  browser: 1342 / 959,
  tablet: 780 / 987,
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

export type MockupAnnotationKind = 'callout' | 'loupe' | 'marker' | 'step' | 'connector' | 'pill';
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
  // connector: andre endepunkt (lerret-fraksjon) — fx/fy er første endepunkt.
  fx2?: number;
  fy2?: number;
  /** connector: sidelengs bue-forskyvning (-1..1, lerret-bredde-fraksjon) — 0 = rett strek. */
  curve?: number;
  // pill: ikon-glyph (unicode) + tittel (label) + undertekst (label2), sentrert på fx/fy.
  glyph?: string;
  label2?: string;
}

/** Lag en ny annotasjon med fornuftige standardverdier. */
export function makeAnnotation(kind: MockupAnnotationKind, deviceId: string | undefined, n = 1): MockupAnnotation {
  const base: MockupAnnotation = { id: uid('ann'), kind, deviceId, fx: 0.5, fy: 0.4 };
  if (kind === 'callout') return { ...base, n, label: 'Ny funksjon', side: 'right' };
  if (kind === 'loupe') return { ...base, fx: 0.5, fy: 0.5, zoom: 2.4, lensX: 0.86, lensY: 0.82, radius: 150 };
  if (kind === 'marker') return { ...base, fx: 0.4, fy: 0.35, fw: 0.22, fh: 0.14 };
  if (kind === 'step') return { ...base, deviceId: undefined, fx: 0.035, fy: 0.035, n };
  if (kind === 'pill') return { ...base, deviceId: undefined, fx: 0.5, fy: 0.9, glyph: '✓', label: 'Ny pill', label2: 'Kort forklaring' };
  return { ...base, deviceId: undefined, fx: 0.3, fy: 0.6, fx2: 0.5, fy2: 0.55, curve: 0.04 }; // connector
}

export function makeDevice(variant: MockupDeviceVariant, partial: Partial<MockupDeviceSlot> = {}): MockupDeviceSlot {
  const defW: Record<MockupDeviceVariant, number> = {
    macbook: 820,
    ipad: 460,
    ipad_landscape: 620,
    iphone: 240,
    watch: 170,
    android: 240,
    browser: 820,
    tablet: 460,
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

/** Frittstående bilde-element (mat-foto/collage direkte på lerretet). */
export interface MockupImageSlot {
  id: string;
  image: string;          // dataURL (også poster/first-frame når video er satt)
  /** Seedance i2v-klipp (mp4-sti): craveable bevegelse (cheese-pull/damp) generert FRA `image`.
   *  Preview spiller klippet i posisjon; statisk render/eksport bruker `image` som poster. */
  video?: string;
  /** Sprite-sekvens (transparente PNG-rammer, f.eks. fra Sorceress 3D Studio sitt 3D→2D-verktøy,
   *  eller et hvilket som helst ekte 3D-render eksportert som frame-sekvens) — ekte 3D-animasjon
   *  avspilt som stillbilde-frames i stedet for video. `image` bør være frames[0] som statisk
   *  fallback/poster. Rammene bytter kun under videoeksport (opts.videoTime); statisk visning = frame 0. */
  sprite?: { frames: string[]; fps: number };
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;         // hjørne-radius (lerret-px)
  fit: 'cover' | 'contain';
  rotation: number;       // grader
  shadow: boolean;
  /** Eid av en galleri-fremvisning (arrangeLibrary). Ryddes ved neste fremvisning → ingen stabling. */
  genArrange?: boolean;
  /** Chat-skrive-animasjon OPPÅ bildet (typing-prikker → tekst-for-tekst) —
   *  «noen chatter»-effekt for skjermbilde-/kort-elementer uten en 3D-enhet å
   *  feste typeAnim til. Kjøres av animasjons-tidslinjen (egen 'type'-klipp). */
  chatType?: ChatTypeConfig;
  /** Prosedural flat-illustrasjon tegnet direkte på canvas (Storyset-aktig figur) — ingen
   *  ekstern asset, `image` ignoreres når satt. 'office-backdrop'/'waiting-room-backdrop' er
   *  BAKGRUNNER (tegnes alltid bak personer uansett doc.images-rekkefølge, se rasterizeMockup). */
  illustration?: 'person-laptop' | 'office-backdrop' | 'waiting-room-backdrop';
  /** After Effects-aktige keyframe-kurver (samme motor som enhetenes 3D-rotasjon, se sampleKf) —
   *  x/y/rotation/scale/opacity for hele elementet, pluss rigg-egenskaper når illustration er satt
   *  (armSwing/blink/headTilt, se PERSON_RIG_PROPS i mockupRaster.ts). Mangler en egenskap sin
   *  kurve → faller tilbake på statisk verdi (evt. automatisk idle-animasjon for rigg-egenskaper). */
  kf?: Record<string, Keyframe[]>;
  /** Farge-overstyring for person-laptop-illustrasjonen (klær/hud/hår/aksent) — mangler felt → standardpalett. */
  personStyle?: PersonStyle;
  /** Satt → dette bildet er et generert falsk-app-skjermbilde (previsitUiCardImage) —
   *  `image` er en KOPI av siste genererte SVG (kjørt gjennom `renderPreVisitCard`);
   *  redigering av feltene her og re-generering holder dem i sync. Uten dette
   *  feltet er `image` en vanlig statisk bilde-URL uten inspektør-redigering. */
  cardContent?: PreVisitCardContent;
}

export type PreVisitStepState = 'done' | 'active' | 'todo';
export interface PreVisitCardContent {
  title: string;
  subtitle: string;
  buttonText: string;
  steps: { label: string; state: PreVisitStepState }[];
}

/** Farge-tilpasning for person-laptop-figuren. Alle felt valgfrie — mangler felt bruker standardpaletten. */
export interface PersonStyle {
  skin?: string;
  hair?: string;
  /** Klær-farge. */
  shirt?: string;
  /** Aksent (pult-kant + skjerm-markør). */
  accent?: string;
  /** Antrekk-silhuett — mangler felt → 'genser'. legefrakk/sykepleier gir egen silhuett
   *  (hvit åpen frakk+stetoskop / scrubs+lue), ikke bare farge, så roller skiller seg visuelt. */
  outfit?: 'genser' | 'skjorte' | 'hettegenser' | 'legefrakk' | 'sykepleier';
  /** Hår-silhuett — mangler felt → 'kort'. */
  hairStyle?: 'kort' | 'buffert' | 'krøller';
  /** Tilbehør — mangler felt → 'ingen'. */
  accessory?: 'ingen' | 'briller' | 'hodetelefoner' | 'munnbind' | 'id-kort' | 'stetoskop';
  /** Scenario — hva figuren gjør (armmål+rekvisitt endres, IK løser albuebøyen for hver).
   *  'walk' viser hele kroppen (bein) og går; øvrige er beskåret ved hoftehøyde.
   *  Mangler felt → 'laptop' (dagens standardscene, uendret). */
  scenario?: 'laptop' | 'stand' | 'phone' | 'presenter' | 'walk';
}

export const PERSON_SCENARIO_LABELS: Record<NonNullable<PersonStyle['scenario']>, string> = {
  laptop: 'Ved laptop', stand: 'Stående', phone: 'På telefon', presenter: 'Presenterer', walk: 'Går inn',
};

export const PERSON_OUTFIT_LABELS: Record<NonNullable<PersonStyle['outfit']>, string> = {
  genser: 'Genser', skjorte: 'Skjorte', hettegenser: 'Hettegenser', legefrakk: 'Legefrakk', sykepleier: 'Sykepleier',
};

/** Navngitt, kollisjonsfri plassering i en bakgrunn (fx/fy/fw/fh = 0..1 av bakgrunnens egen boks) —
 *  løser at figurer havner oppå møbler man ikke ser koordinatene til (f.eks. bokhylla i kontoret).
 *  «Plasser ved anker» i inspektøren skriver disse om til faktiske px basert på bakgrunnens x/y/w/h
 *  i det gjeldende dokumentet. */
export interface BackdropAnchor { id: string; label: string; fx: number; fy: number; fw: number; fh: number; }
export const BACKDROP_ANCHORS: Record<'office-backdrop' | 'waiting-room-backdrop', BackdropAnchor[]> = {
  'office-backdrop': [
    { id: 'desk', label: 'Ved pulten', fx: 0.0, fy: 0.22, fw: 0.22, fh: 0.62 },
    { id: 'seated', label: 'Sittende (åpen vegg)', fx: 0.42, fy: 0.15, fw: 0.22, fh: 0.8 },
    { id: 'window', label: 'Ved vinduet', fx: 0.68, fy: 0.1, fw: 0.26, fh: 0.85 },
    { id: 'door', label: 'Ved døra', fx: 0.2, fy: 0.15, fw: 0.24, fh: 0.8 },
  ],
  'waiting-room-backdrop': [
    { id: 'chair1', label: 'Stol 1', fx: 0.02, fy: 0.4, fw: 0.18, fh: 0.5 },
    { id: 'chair2', label: 'Stol 2', fx: 0.13, fy: 0.4, fw: 0.18, fh: 0.5 },
    { id: 'chair3', label: 'Stol 3', fx: 0.24, fy: 0.4, fw: 0.18, fh: 0.5 },
    { id: 'reception', label: 'Resepsjon', fx: 0.4, fy: 0.1, fw: 0.24, fh: 0.85 },
    { id: 'entrance', label: 'Inngang', fx: 0.72, fy: 0.08, fw: 0.26, fh: 0.9 },
  ],
};

/** Rolle-snarveier — setter en hel antrekk+farge-bunt samlet (fortsatt overstyrbart etterpå per felt),
 *  samme mønster som EXPRESSION_PRESETS. Gjør figurene visuelt forskjellige (pasient/lege/sykepleier),
 *  ikke bare samme silhuett i ny farge. */
export const PERSON_ROLE_PRESETS: { id: string; label: string; style: PersonStyle }[] = [
  { id: 'pasient', label: 'Pasient', style: { outfit: 'genser', shirt: '#1b294b', accessory: 'ingen' } },
  { id: 'lege', label: 'Lege', style: { outfit: 'legefrakk', shirt: '#ffffff', accessory: 'id-kort' } },
  { id: 'sykepleier', label: 'Sykepleier', style: { outfit: 'sykepleier', shirt: '#5fb8c9', accessory: 'id-kort' } },
];
export const PERSON_HAIR_LABELS: Record<NonNullable<PersonStyle['hairStyle']>, string> = {
  kort: 'Kort', buffert: 'Buffert', krøller: 'Krøller',
};
export const PERSON_ACCESSORY_LABELS: Record<NonNullable<PersonStyle['accessory']>, string> = {
  ingen: 'Ingen', briller: 'Briller', hodetelefoner: 'Hodetelefoner',
  munnbind: 'Munnbind', 'id-kort': 'ID-kort', stetoskop: 'Stetoskop',
};

/** Rigg-parametre for person-laptop-illustrasjonen (mockupRaster.ts sin drawPersonLaptop) —
 *  hver enkelt keyframebar via MockupImageSlot.kf, samme kurve-motor som enhetenes 3D-rotasjon. */
export interface PersonRigPose {
  /** -1 (hender nede/hvile) .. 1 (hender oppe) — kontinuerlig, ikke bare 2 faste posisjoner. */
  armSwing: number;
  /** 0 (øyne åpne) .. 1 (øyne lukket/blunk). */
  blink: number;
  /** Hode-vipp i grader, roterer hode+hår rundt nakke-pivot. */
  headTilt: number;
  /** 0..1 loop-fase for fingertapping (hver finger faseforskjøvet). */
  fingerTap: number;
  /** 0..1 loop-fase for skjerm-innhold (linje-bredder + blinkende markør). */
  screenActivity: number;
  /** -1 (bekymret/frown) .. 1 (smil) — munn-kurvatur, 0 = nøytral rett strek. Tenner vises når > 0.2. */
  mouthCurve: number;
  /** Øye-størrelse, multiplikator på basis-radius (1 = standard). */
  eyeSize: number;
  /** 0..1 loop-fase for gange (bein+armer svinger motfase) — kun tegnet/synlig ved scenario 'walk'. */
  legSwing: number;
  /** Kropp-bob (idle pust/sway), px y-forskyvning av torso+hode. */
  bodyBob: number;
  /** Overkropp-lene i grader, roterer torso+hode rundt hofte-pivot. */
  leanX: number;
  /** Øyenbryn-løft, -1 (rynket) .. 1 (overrasket). */
  browRaise: number;
  /** 0..1 — tåre-dråpe under øyet (frustrasjon/gråt), 0 = ingen. */
  tears: number;
}

/** Keyframebare rigg-egenskaper for person-laptop-illustrasjonen, brukt av MockupKeyframeGraph
 *  (samme kurve-editor som enhetenes 3D-rotasjon) — After Effects-aktig per-del-animasjon. */
export const PERSON_RIG_PROPS: { id: keyof PersonRigPose; label: string; min: number; max: number }[] = [
  { id: 'armSwing', label: 'Hender (skriving)', min: -1, max: 1 },
  { id: 'fingerTap', label: 'Fingre (tapping)', min: 0, max: 1 },
  { id: 'screenActivity', label: 'Skjerm-innhold', min: 0, max: 1 },
  { id: 'blink', label: 'Blunk', min: 0, max: 1 },
  { id: 'headTilt', label: 'Hode-vipp', min: -20, max: 20 },
  { id: 'mouthCurve', label: 'Uttrykk (munn)', min: -1, max: 1 },
  { id: 'eyeSize', label: 'Øye-størrelse', min: 0.5, max: 2 },
  { id: 'bodyBob', label: 'Kropp-bob', min: -8, max: 8 },
  { id: 'leanX', label: 'Overkropp-lene', min: -10, max: 10 },
  { id: 'browRaise', label: 'Øyenbryn', min: -1, max: 1 },
  { id: 'tears', label: 'Tårer', min: 0, max: 1 },
  { id: 'legSwing', label: 'Gange (bein)', min: 0, max: 1 },
];

/** Rolig hvilepose — brukt av PersonThumbnail som basisverdi før preset/keyframe-overstyring. */
export const DEFAULT_RIG_POSE: PersonRigPose = {
  armSwing: -1, fingerTap: 0, screenActivity: 0, blink: 0, headTilt: 0,
  mouthCurve: 1, eyeSize: 1, bodyBob: 0, leanX: 0, browRaise: 0, tears: 0, legSwing: 0,
};

/** Navngitte uttrykk — setter flere rigg-egenskaper samtidig som ETT klikk, fortsatt overstyrbart
 *  etterpå per egenskap i keyframe-grafen (skriver bare enkelt-keyframe ved t=0, ikke en kurve). */
export const EXPRESSION_PRESETS: { id: string; label: string; values: Partial<PersonRigPose> }[] = [
  { id: 'noytral', label: 'Nøytral', values: { mouthCurve: 0, browRaise: 0, eyeSize: 1, tears: 0 } },
  { id: 'glad', label: 'Glad', values: { mouthCurve: 1, browRaise: 0.3, eyeSize: 1, tears: 0 } },
  { id: 'fokusert', label: 'Fokusert', values: { mouthCurve: 0.1, browRaise: -0.3, eyeSize: 0.85, tears: 0 } },
  { id: 'frustrert', label: 'Frustrert', values: { mouthCurve: -0.6, browRaise: -0.6, eyeSize: 0.9, tears: 0.3 } },
  { id: 'overrasket', label: 'Overrasket', values: { mouthCurve: 0.2, browRaise: 1, eyeSize: 1.5, tears: 0 } },
];

/** Keyframebare transform-egenskaper for ETHVERT bilde-element (offset fra base x/y/rotation,
 *  multiplikator for scale, absolutt for opacity) — samme mekanisme som PERSON_RIG_PROPS. */
export const IMAGE_TRANSFORM_PROPS: { id: string; label: string; min: number; max: number }[] = [
  { id: 'x', label: 'X-forskyvning', min: -200, max: 200 },
  { id: 'y', label: 'Y-forskyvning', min: -200, max: 200 },
  { id: 'rotation', label: 'Rotasjon', min: -45, max: 45 },
  { id: 'scale', label: 'Skalering', min: 0.5, max: 1.5 },
  { id: 'opacity', label: 'Synlighet', min: 0, max: 1 },
];

/** Skrivehastighet-presets (tegn/sek) for chatType. */
export type ChatTypeSpeed = 'slow' | 'normal' | 'fast';
export const CHAT_TYPE_SPEEDS: Record<ChatTypeSpeed, number> = { slow: 7, normal: 13, fast: 20 };
export const CHAT_TYPE_SPEED_LABELS: Record<ChatTypeSpeed, string> = { slow: 'Sakte', normal: 'Normal', fast: 'Rask' };

/** Ett spørsmål-svar-par i en chatType-samtale. `reply` valgfri (spørsmål uten svar = venter). */
export interface ChatTurn { question: string; reply?: string; }

/** Chat-typing-konfig, delt av MockupImageSlot og MockupDeviceSlot. Flere
 *  `turns` spilles av etter hverandre (som medside.no sitt PreVisit-intervju:
 *  «SPØRSMÅL 1 AV 9» osv.) — kortet auto-scroller så aktiv runde alltid er
 *  synlig, akkurat som en ekte chat. */
export interface ChatTypeConfig {
  turns: ChatTurn[];
  speed: ChatTypeSpeed;
  /** Hode-rad-tekst. Default 'PreVisit-assistent' — overstyr for gjenbruk utafor chat-kontekst (f.eks. «Anamnesenotat» for en notat-genereringsscene). */
  label?: string;
}

export const CHAT_TURN_GAP = 0.35; // pause (sek) mellom runder

/** Varighet (sek) for ÉN runde: prikker → spørsmål → (pause → svar). MÅ speile fase-inndelingen i mockupRaster.ts. */
export function chatTurnDuration(turn: ChatTurn, cps: number): number {
  const dotsLen = 0.6;
  const qLen = Math.max(0.5, turn.question.length / cps);
  const pauseLen = turn.reply ? 0.3 : 0;
  const replyLen = turn.reply ? Math.max(0.4, turn.reply.length / cps) : 0;
  return dotsLen + qLen + pauseLen + replyLen;
}

/** Total klipp-varighet (sek) for alle runder i en chatType-animasjon. */
function chatClipDuration(chat: ChatTypeConfig): number {
  const cps = CHAT_TYPE_SPEEDS[chat.speed] ?? CHAT_TYPE_SPEEDS.normal;
  return chat.turns.reduce((sum, turn, i) => sum + chatTurnDuration(turn, cps) + (i > 0 ? CHAT_TURN_GAP : 0), 0);
}

export function makeImage(image: string, partial: Partial<MockupImageSlot> = {}): MockupImageSlot {
  return { id: uid('img'), image, x: 200, y: 200, w: 520, h: 360, radius: 18, fit: 'cover', rotation: 0, shadow: true, ...partial };
}

export interface GridOpts {
  cols?: number;    // default: ~kvadratisk (ceil(sqrt(n)))
  margin?: number;  // ytre marg (default 3.7% av bredden)
  gap?: number;     // mellomrom mellom celler (default 1.9% av bredden)
  top?: number;     // topp-forskyvning (plass til overskrift; default = margin)
  bottom?: number;  // bunn-forskyvning (default = margin)
}

export interface LayoutCell { x: number; y: number; w: number; h: number; rotation?: number }
type LayoutFn = (n: number, canvasW: number, canvasH: number, opts?: GridOpts) => LayoutCell[];

const bounds = (W: number, _H: number, o: GridOpts) => {
  const m = o.margin ?? Math.round(W * 0.037), gap = o.gap ?? Math.round(W * 0.019);
  return { m, gap, top: o.top ?? m, bottom: o.bottom ?? m };
};

/** Rutenett: n celler jevnt fordelt (auto ~kvadratisk, eller opts.cols). */
export const gridCells: LayoutFn = (n, W, H, opts = {}) => {
  if (n <= 0) return [];
  const { m, gap, top, bottom } = bounds(W, H, opts);
  const cols = Math.max(1, opts.cols ?? Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  const cw = (W - 2 * m - gap * (cols - 1)) / cols;
  const ch = (H - top - bottom - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    return { x: Math.round(m + c * (cw + gap)), y: Math.round(top + r * (ch + gap)), w: Math.round(cw), h: Math.round(ch) };
  });
};

/** Rad: én horisontal rekke, full høyde (filmstrip). */
export const rowCells: LayoutFn = (n, W, H, opts = {}) => {
  if (n <= 0) return [];
  const { m, gap, top, bottom } = bounds(W, H, opts);
  const cw = (W - 2 * m - gap * (n - 1)) / n, ch = H - top - bottom;
  return Array.from({ length: n }, (_, i) => ({ x: Math.round(m + i * (cw + gap)), y: Math.round(top), w: Math.round(cw), h: Math.round(ch) }));
};

/** Historie: vertikal stabel, full bredde (story/portrett). */
export const columnCells: LayoutFn = (n, W, H, opts = {}) => {
  if (n <= 0) return [];
  const { m, gap, top, bottom } = bounds(W, H, opts);
  const ch = (H - top - bottom - gap * (n - 1)) / n, cw = W - 2 * m;
  return Array.from({ length: n }, (_, i) => ({ x: Math.round(m), y: Math.round(top + i * (ch + gap)), w: Math.round(cw), h: Math.round(ch) }));
};

/** Hero + galleri: første bilde stort til venstre, resten i kolonne til høyre. */
export const heroCells: LayoutFn = (n, W, H, opts = {}) => {
  if (n <= 0) return [];
  if (n === 1) return gridCells(1, W, H, opts);
  const { m, gap, top, bottom } = bounds(W, H, opts);
  const heroW = Math.round((W - 2 * m - gap) * 0.62), restW = W - 2 * m - gap - heroW;
  const rest = n - 1, rch = (H - top - bottom - gap * (rest - 1)) / rest;
  const cells: LayoutCell[] = [{ x: m, y: top, w: heroW, h: H - top - bottom }];
  for (let i = 0; i < rest; i++) cells.push({ x: Math.round(m + heroW + gap), y: Math.round(top + i * (rch + gap)), w: Math.round(restW), h: Math.round(rch) });
  return cells;
};

/** Kollasje: rutenett med lett rotasjon + krymp (oppslåtte foto-look). Deterministisk. */
export const collageCells: LayoutFn = (n, W, H, opts = {}) => {
  return gridCells(n, W, H, opts).map((c, i) => {
    const sh = Math.round(Math.min(c.w, c.h) * 0.06); // krymp så roterte hjørner ikke klippes
    return { x: c.x + sh, y: c.y + sh, w: c.w - sh * 2, h: c.h - sh * 2, rotation: ((i * 53) % 11) - 5 };
  });
};

/** Bento/mosaikk: masonry med varierte høyder, pakket i korteste kolonne, skalert til å fylle høyden. */
export const bentoCells: LayoutFn = (n, W, H, opts = {}) => {
  if (n <= 0) return [];
  const { m, gap, top, bottom } = bounds(W, H, opts);
  const cols = Math.max(2, opts.cols ?? (n >= 6 ? 3 : 2));
  const cw = (W - 2 * m - gap * (cols - 1)) / cols;
  const colH = new Array(cols).fill(top);
  const cells: LayoutCell[] = [];
  for (let i = 0; i < n; i++) {
    const col = colH.indexOf(Math.min(...colH)); // korteste kolonne
    const h = cw * (i % 3 === 0 ? 0.98 : 0.6);    // deterministisk stor/liten
    cells.push({ x: Math.round(m + col * (cw + gap)), y: Math.round(colH[col]), w: Math.round(cw), h: Math.round(h) });
    colH[col] += h + gap;
  }
  // Skaler vertikalt så alt fyller [top, H-bottom] uten overflyt.
  const maxB = Math.max(...cells.map((c) => c.y + c.h)), avail = H - bottom;
  if (maxB > top) {
    const f = (avail - top) / (maxB - top);
    cells.forEach((c) => { c.y = Math.round(top + (c.y - top) * f); c.h = Math.round(c.h * f); });
  }
  return cells;
};

/** Sirkulær: bildene i en ring rundt sentrum. */
export const circleCells: LayoutFn = (n, W, H, opts = {}) => {
  if (n <= 0) return [];
  if (n === 1) return [{ x: Math.round(W * 0.3), y: Math.round(H * 0.3), w: Math.round(W * 0.4), h: Math.round(W * 0.4) }];
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.33, size = Math.min(W, H) * (opts.cols ? 0.2 : 0.24);
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: Math.round(cx + R * Math.cos(a) - size / 2), y: Math.round(cy + R * Math.sin(a) - size / 2), w: Math.round(size), h: Math.round(size), rotation: Math.round((a * 180 / Math.PI + 90) / 4) };
  });
};

/** Diagonal: overlappende kaskade fra øvre venstre mot nedre høyre, lett rotasjon. */
export const diagonalCells: LayoutFn = (n, W, H, opts = {}) => {
  if (n <= 0) return [];
  const { m } = bounds(W, H, opts);
  const size = Math.min(W, H) * 0.42;
  const stepX = (W - 2 * m - size) / Math.max(1, n - 1);
  const stepY = (H - 2 * m - size) / Math.max(1, n - 1);
  return Array.from({ length: n }, (_, i) => ({ x: Math.round(m + i * stepX), y: Math.round(m + i * stepY), w: Math.round(size), h: Math.round(size), rotation: ((i * 47) % 9) - 4 }));
};

/** Kanal-formater for «én design → alle kanaler». */
export const CHANNEL_FORMATS: { id: string; label: string; w: number; h: number }[] = [
  { id: 'ig-feed', label: 'IG feed 4:5', w: 1080, h: 1350 },
  { id: 'ig-story', label: 'Story/Reel/TikTok 9:16', w: 1080, h: 1920 },
  { id: 'fb-event', label: 'FB event', w: 1920, h: 1005 },
  { id: 'square', label: 'Kvadrat 1:1', w: 1080, h: 1080 },
];
/** Velg antall kolonner ut fra lerret-aspekt (bredt = 3, ellers 2). */
export const colsForAspect = (w: number, h: number): number => (w > h * 1.25 ? 3 : 2);

/** Registry av fremvisninger (galleri). */
export const PRESENTATIONS: { id: string; label: string; layout: LayoutFn; rotated?: boolean }[] = [
  { id: 'grid', label: 'Rutenett', layout: gridCells },
  { id: 'row', label: 'Rad', layout: rowCells },
  { id: 'hero', label: 'Hero', layout: heroCells },
  { id: 'bento', label: 'Bento', layout: bentoCells },
  { id: 'collage', label: 'Kollasje', layout: collageCells, rotated: true },
  { id: 'circle', label: 'Sirkel', layout: circleCells, rotated: true },
  { id: 'diagonal', label: 'Diagonal', layout: diagonalCells, rotated: true },
  { id: 'story', label: 'Historie', layout: columnCells },
];

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
  | 'kundecase'
  | 'kampanje';

export const CATEGORY_LABELS: Record<MockupTemplateCategory, string> = {
  produktoversikt: 'Produktoversikt',
  funksjonslansering: 'Funksjonslansering',
  salgspitch: 'Salgspitch',
  nokkeltall: 'Nøkkeltall',
  kundecase: 'Kundecase',
  kampanje: 'Kampanje',
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
  {
    id: 'chat_hook_laptop', name: 'Chat-hook — MacBook', category: 'kundecase', variant: 'light', devices: 1,
    description: 'Sitat-drevet hook: en flerrunders chat-samtale (hode + spørsmål/svar-bobler, auto-scroll) som skriver seg selv inn — prikker → tegn-for-tegn — inni en ekte MacBook-mock. Overskrift/brødtekst til venstre. God for bruker-/kunde-sitat-annonser (se chatType på enheten for fart-presets og flere runder).',
    build: () => {
      const t = ink('light');
      return doc('Chat-hook', 'chat_hook_laptop', baseCanvas({ background: 'light', bgStyle: 'clean', accent: '#b5793a', accent2: '#faf6ee', typography: 'editorial' }), [
        makeDevice('macbook', {
          x: 700, y: 250, w: 820, shadow: true,
          chatType: { speed: 'normal', turns: [{ question: 'Skriv spørsmålet som skal "skrives" inn på skjermen…', reply: 'Skriv svaret her (valgfritt)…' }] },
        }),
      ], [
        makeText('eyebrow', { text: 'DET DE IKKE FIKK SAGT', x: 120, y: 300, w: 520, color: '#b5793a' }),
        makeText('title', { text: 'Overskrift som selger', x: 120, y: 345, w: 560, color: t.title }),
        makeText('body', { text: 'Kort verdiløfte i én til to setninger.', x: 120, y: 560, w: 520, color: t.body }),
        makeText('tag', { text: 'creatorhubn.com', x: 120, y: 720, w: 520, color: t.tag }),
      ]);
    },
  },
  {
    id: 'previsit_campaign_1', name: 'PreVisit kampanje — foto + UI-kort', category: 'kampanje', variant: 'light', devices: 0,
    description: 'Kvadratisk (1080×1080) sosial annonse: nummerert steg-badge, MedSide-logo, serif-overskrift m/ gull-aksent, foto-plassholder + rundet UI-kort koblet med en prikket linje, bunn-pill med kort forklaring. Bytt ut foto-plassholderne med ekte bilder.',
    build: () => {
      const canvas = baseCanvas({
        w: 1080, h: 1080,
        accent: MEDSIDE_COLORS.navy, accent2: MEDSIDE_COLORS.gold,
        background: 'light', bgStyle: 'clean', decor: 'arc', typography: 'editorial',
        logo: { image: MEDSIDE_LOGO_DATA_URL, x: 860, y: 44, w: 176 },
      });
      const base = doc('PreVisit kampanje', 'previsit_campaign_1', canvas, [], [
        makeText('title', { text: 'Timen starter', x: 70, y: 150, w: 700, size: 56, color: MEDSIDE_COLORS.navy }),
        makeText('title', { text: 'før pasienten', x: 70, y: 216, w: 700, size: 56, color: MEDSIDE_COLORS.gold }),
        makeText('title', { text: 'kommer inn.', x: 70, y: 282, w: 700, size: 56, color: MEDSIDE_COLORS.navy }),
      ]);
      return {
        ...base,
        images: [
          // Foto-bleed: kant-til-kant (ingen marg/avrunding) som i referanse-annonsene —
          // IKKE flytende avrundede kort. De to møtes midt på (x=540), skillelinjen
          // under legges over som et eget, like redigerbart bilde-element.
          makeImage(placeholderImage('PASIENT-FOTO', MEDSIDE_COLORS.cream, MEDSIDE_COLORS.navy), { x: 0, y: 420, w: 540, h: 660, radius: 0 }),
          makeImage(placeholderImage('LEGE-FOTO', MEDSIDE_COLORS.cream, MEDSIDE_COLORS.navy), { x: 540, y: 420, w: 540, h: 660, radius: 0 }),
          makeImage(placeholderImage('', '#ffffff', '#ffffff'), { x: 538, y: 420, w: 4, h: 660, radius: 0, shadow: false }),
          makeImage(previsitUiCardImage(DEFAULT_PREVISIT_CARD_CONTENT), { x: 350, y: 540, w: 380, h: 340, radius: 20, cardContent: DEFAULT_PREVISIT_CARD_CONTENT }),
        ],
        annotations: [
          { id: uid('ann'), kind: 'step', fx: 0.035, fy: 0.035, n: 1 },
          // to connector-linjer: hvert foto → sin nærmeste kort-kant. Ankrene MÅ ligge
          // utenfor kortets eget rektangel (x:350-730,y:540-880) — forrige versjon endte
          // begge punktene inni kortet (dermed usynlig "i" knappen), fikset her.
          { id: uid('ann'), kind: 'connector', fx: 0.231, fy: 0.602, fx2: 0.324, fy2: 0.546, curve: 0.035 },
          { id: uid('ann'), kind: 'connector', fx: 0.787, fy: 0.602, fx2: 0.676, fy2: 0.546, curve: -0.035 },
          // bunn-pills, én pr. foto (ikke én sentrert pill).
          { id: uid('ann'), kind: 'pill', fx: 0.25, fy: 0.945, glyph: '⌂', label: 'Pasienten fyller ut', label2: '– hjemme i ro og fred' },
          { id: uid('ann'), kind: 'pill', fx: 0.75, fy: 0.945, glyph: '✓', label: 'Klinikeren er forberedt', label2: '– før pasienten kommer' },
        ],
      };
    },
  },
];

/** UTF-8-trygg base64 (btoa alene feiler på ikke-Latin1-tegn som "→"/norske bokstaver). */
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

/** Enkel plassholder-bakgrunn (SVG data-URL) — sentrert label på flatfarge, ingen ekstern fil.
 *  Brukes til «bytt ut senere»-foto-slots i kampanje-maler. */
export function placeholderImage(label: string, bg: string, ink: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <rect width="600" height="600" fill="${bg}"/>
    <text x="300" y="300" font-family="-apple-system,system-ui,sans-serif" font-size="30" font-weight="600"
      fill="${ink}" fill-opacity="0.55" text-anchor="middle" dominant-baseline="middle">${label}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}

export const DEFAULT_PREVISIT_CARD_CONTENT: PreVisitCardContent = {
  title: 'Spørreskjema',
  subtitle: 'Del din helseinformasjon',
  buttonText: 'Start PreVisit',
  steps: [
    { label: 'Invitasjon', state: 'done' },
    { label: 'Spørreskjema', state: 'done' },
    { label: 'Forberedelser', state: 'active' },
    { label: 'Klar', state: 'todo' },
  ],
};

/** Enkel XML-escaping for tekst satt inn i genererte SVG-er (bruker-redigerbare felt). */
function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Falsk PreVisit-app-skjermbilde (SVG data-URL): logo-mark, N-stegs fremdriftsrad,
 *  overskrift+undertekst, CTA-knapp — samme «kort inni foto»-look som referanse-annonsene.
 *  Redigerbar via `content` (se PreVisitCardContent) — regenereres når inspektøren endrer felt.
 *  Ikke en ekte app-eksport, men leser riktig i miniatyr; bytt ut med ekte skjermbilde senere. */
export function previsitUiCardImage(content: PreVisitCardContent = DEFAULT_PREVISIT_CARD_CONTENT): string {
  const navy = MEDSIDE_COLORS.navy, gold = MEDSIDE_COLORS.gold;
  const n = Math.max(1, content.steps.length);
  const margin = 76;
  const usable = 600 - margin * 2;
  const steps = content.steps.map((s, i) => ({ ...s, cx: n === 1 ? 300 : margin + (usable * i) / (n - 1) }));
  const stepCircle = (s: (typeof steps)[number]) => {
    const fill = s.state === 'todo' ? '#ffffff' : s.state === 'active' ? gold : navy;
    const stroke = s.state === 'todo' ? '#d1d5db' : fill;
    const mark = s.state === 'done'
      ? `<path d="M${s.cx - 6} 150 l5 5 l9 -10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : '';
    return `<circle cx="${s.cx}" cy="150" r="15" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${mark}
      <text x="${s.cx}" y="182" font-family="-apple-system,system-ui,sans-serif" font-size="13" fill="#6b7280" text-anchor="middle">${escXml(s.label)}</text>`;
  };
  const connectorLines = steps.slice(0, -1).map((s, i) => {
    const next = steps[i + 1];
    const done = s.state === 'done';
    return `<line x1="${s.cx + 15}" y1="150" x2="${next.cx - 15}" y2="150" stroke="${done ? navy : '#d1d5db'}" stroke-width="2"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="536">
    <rect width="600" height="536" fill="#ffffff"/>
    <circle cx="40" cy="46" r="10" fill="${navy}"/>
    <path d="M40 36 l16 10 l-16 10 z" fill="${gold}" opacity="0.9"/>
    <text x="64" y="53" font-family="Georgia,'Iowan Old Style',serif" font-size="24" font-weight="700" fill="${navy}">PreVisit</text>
    ${connectorLines}
    ${steps.map(stepCircle).join('')}
    <text x="60" y="240" font-family="-apple-system,system-ui,sans-serif" font-size="24" font-weight="700" fill="#101317">${escXml(content.title)}</text>
    <text x="60" y="270" font-family="-apple-system,system-ui,sans-serif" font-size="16" fill="#6b7280">${escXml(content.subtitle)}</text>
    <rect x="60" y="320" width="480" height="56" rx="28" fill="${navy}"/>
    <text x="300" y="354" font-family="-apple-system,system-ui,sans-serif" font-size="18" font-weight="700" fill="#ffffff" text-anchor="middle">${escXml(content.buttonText)}  &#8594;</text>
  </svg>`;
  return `data:image/svg+xml;base64,${utf8ToBase64(svg)}`;
}

const DEV_LABEL: Record<MockupDeviceVariant, string> = { macbook: 'MacBook', ipad: 'iPad', ipad_landscape: 'iPad', iphone: 'iPhone', watch: 'Apple Watch', android: 'Android', browser: 'Nettleser', tablet: 'Nettbrett' };
const ROLE_LABEL: Record<MockupTextRole, string> = { eyebrow: 'Etikett', title: 'Overskrift', body: 'Brødtekst', tag: 'Liten tekst' };

/** Enhets-varianter i samme orientering (tillatt device-bytte i en slot). */
export function orientationGroup(v: MockupDeviceVariant): MockupDeviceVariant[] {
  const landscape: MockupDeviceVariant[] = ['macbook', 'ipad_landscape', 'browser'];
  const portrait: MockupDeviceVariant[] = ['iphone', 'ipad', 'watch', 'android', 'tablet'];
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
  // Frie elementer (uten slot-sone) speiles kun når mirror-TILSTANDEN endres → reversibelt,
  // og forblir konsistente med slot-baserte enheter/tekst uansett bytte-rekkefølge.
  const wantMirror = id === 'mirror';
  const flipFree = !!doc.mirrored !== wantMirror;
  const texts = doc.texts.map((t) => {
    const z = zoneOf(t.slotId);
    if (!z) return flipFree ? { ...t, x: W - t.x - t.w } : t; // fritt tekst-element (f.eks. pris-label)
    return wantMirror ? { ...t, x: W - z.x - t.w, y: z.y } : { ...t, x: z.x, y: z.y };
  });
  const images = (doc.images ?? []).map((im) => (flipFree ? { ...im, x: W - im.x - im.w } : im));
  return { ...doc, devices, texts, images, mirrored: wantMirror };
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

/** App Store / Google Play skjermbilde-dimensjoner (portrett). Reflowes via applyFormat. */
export const APPSTORE_FORMATS: MockupFormat[] = [
  { id: 'ios_6_9', label: 'App Store iPhone 6.9″', w: 1290, h: 2796 },
  { id: 'ios_6_5', label: 'App Store iPhone 6.5″', w: 1242, h: 2688 },
  { id: 'ios_5_5', label: 'App Store iPhone 5.5″', w: 1242, h: 2208 },
  { id: 'ios_ipad_13', label: 'App Store iPad 13″', w: 2048, h: 2732 },
  { id: 'play_phone', label: 'Play telefon', w: 1080, h: 1920 },
  { id: 'play_tablet', label: 'Play nettbrett', w: 1600, h: 2560 },
];

// Lazy singleton 2D-kontekst for EKTE tekst-måling i reflow-stabling — unngår
// at estTextHeight sitt char-count-anslag bommer på bredere/serif-fonter
// (Editorial/Georgia) og lar neste tekstblokk overlappe forrige (observert bug).
let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

/** Reelt ombrukket linje-antall — speiler wrapLines() i mockupRaster.ts (samme greedy ordbrekk). */
function wrapLineCount(ctx: CanvasRenderingContext2D, text: string, maxW: number): number {
  let n = 0;
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) { n += 1; continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`;
      if (ctx.measureText(test).width > maxW && line) { n += 1; line = words[i]; }
      else line = test;
    }
    n += 1;
  }
  return n;
}

/**
 * Tekst-høyde (px) for reflow-stabling. Måler EKTE ombrekking via canvas når
 * `canvas`-specen er gitt (nøyaktig — matcher faktisk rendering). Faller
 * tilbake til et grovt char-count-anslag uten canvas (SSR/test-miljø).
 */
function estTextHeight(t: MockupTextSlot, w: number, canvas?: MockupCanvasSpec): number {
  const ctx = canvas ? getMeasureCtx() : null;
  if (ctx) {
    ctx.font = `${t.weight} ${t.size}px ${fontFamilyFor(t.role, canvas!)}`;
    const lines = wrapLineCount(ctx, t.uppercase ? t.text.toUpperCase() : t.text, w);
    return lines * t.size * t.lineHeight;
  }
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
    ty += estTextHeight(nt, txW, doc.canvas) + size * 0.35;
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
  // Frie elementer (uten slot): id-nøklet så per-format-layout kan gjenopprette dem eksakt.
  (doc.images ?? []).forEach((im) => { out[`img:${im.id}`] = { x: im.x, y: im.y, w: im.w, h: im.h }; });
  doc.texts.forEach((t) => { if (!t.slotId) out[`txt:${t.id}`] = { x: t.x, y: t.y, w: t.w, size: t.size }; });
  return out;
}

/**
 * Bytt lerret-format. Bruker en PIKSELPERFEKT lagret layout for formatet hvis
 * den finnes; ellers rolle-basert auto-reflow. Oppdaterer slots.
 */
export function applyFormat(doc: MockupDoc, fmt: MockupFormat): MockupDoc {
  let next = reflowAuto(doc, fmt);
  // Frittstående bilder har ingen slot-sone → skaler proporsjonalt med canvas-endringen
  // (fra doc.canvas til fmt) så de holder plassen relativt til komposisjonen.
  if (doc.images?.length) {
    const sx = fmt.w / doc.canvas.w, sy = fmt.h / doc.canvas.h;
    next = { ...next, images: doc.images.map((im) => ({ ...im, x: Math.round(im.x * sx), y: Math.round(im.y * sy), w: Math.round(im.w * sx), h: Math.round(im.h * sy) })) };
  }
  const saved = doc.formatLayouts?.[fmt.id];
  if (saved) {
    next = {
      ...next,
      devices: next.devices.map((d) => {
        const p = d.slotId ? saved[d.slotId] : undefined;
        return p ? { ...d, x: p.x, y: p.y, w: p.w ?? d.w, rotation: p.rotation ?? d.rotation } : d;
      }),
      texts: next.texts.map((t) => {
        const p = (t.slotId ? saved[t.slotId] : saved[`txt:${t.id}`]);
        return p ? { ...t, x: p.x, y: p.y, w: p.w ?? t.w, size: p.size ?? t.size } : t;
      }),
      // Frie bilder: gjenopprett eksakt lagret plassering (overstyrer proporsjonal skalering).
      images: (next.images ?? []).map((im) => {
        const p = saved[`img:${im.id}`];
        return p ? { ...im, x: p.x, y: p.y, w: p.w ?? im.w, h: p.h ?? im.h } : im;
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
