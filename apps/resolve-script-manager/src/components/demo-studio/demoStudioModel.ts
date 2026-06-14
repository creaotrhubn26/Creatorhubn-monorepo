/**
 * demoStudioModel.ts — datamodell for Product Demo Studio (Story-fanen i
 * CreativeEditorView). Scene-basert produktdemo: URL → mockup-preview →
 * scener med manus + handling → guided opptak → eksport.
 *
 * Ingen nye avhengigheter: state holdes i React + localStorage (samme mønster
 * som resten av CreativeEditorView). Modellen er ren/serialiserbar.
 *
 * Speiler brukerens spesifikasjon (Scene/Action/Project) og gjenbruker
 * device-variantene fra mockup-video-modulen.
 */

export type DemoDevice = 'macbook' | 'ipad' | 'iphone';
export type DemoViewport = 'desktop' | 'tablet' | 'mobile';

export type DemoType =
  | 'product_demo'
  | 'tutorial'
  | 'onboarding'
  | 'sales_video'
  | 'investor_demo'
  | 'social_clip'
  | 'support_guide'
  | 'feature_walkthrough';

/** Stegstatus for guided recorder (manuell progresjon). */
export type SceneStatus =
  | 'pending'
  | 'in_progress'
  | 'recording'
  | 'paused'
  | 'done'
  | 'needs_review'
  | 'retake'
  | 'approved';

/** Browser-handlinger en scene kan utføre på nettsiden. */
export type DemoActionType =
  | 'open_url'
  | 'wait'
  | 'scroll'
  | 'click'
  | 'hover'
  | 'type'
  | 'navigate_back'
  | 'navigate_forward'
  | 'switch_device'
  | 'highlight'
  | 'zoom';

export interface DemoAction {
  type: DemoActionType;
  /** Mål-element (tekst/selector) for click/hover/highlight/zoom. */
  target?: string;
  /** For scroll. */
  direction?: 'up' | 'down';
  amount?: number;
  /** For type. */
  text?: string;
  /** Varighet i sekunder (wait/scroll/zoom). */
  duration?: number;
}

/** UI-metadata for required action-typer (Guided Recorder + Script Builder). */
export const ACTION_META: Record<DemoActionType, { label: string; icon: string; verb: string }> = {
  open_url:          { label: 'Open URL',     icon: '🌐', verb: 'Åpne' },
  wait:             { label: 'Wait',         icon: '◷',  verb: 'Vent' },
  scroll:           { label: 'Scroll',       icon: '↕',  verb: 'Scroll til' },
  click:            { label: 'Click',        icon: '☞',  verb: 'Klikk' },
  hover:            { label: 'Hover',        icon: '⤚',  verb: 'Hold over' },
  type:             { label: 'Type',         icon: '⌨',  verb: 'Skriv i' },
  navigate_back:    { label: 'Tilbake',      icon: '←',  verb: 'Naviger tilbake' },
  navigate_forward: { label: 'Fremover',     icon: '→',  verb: 'Naviger fremover' },
  switch_device:    { label: 'Switch Device', icon: '⇄', verb: 'Bytt til' },
  highlight:        { label: 'Highlight',    icon: '◎',  verb: 'Fremhev' },
  zoom:             { label: 'Zoom',         icon: '⊕',  verb: 'Zoom inn på' },
};

/** Virtuell kamera-bevegelse per scene (autonom video). 'auto' = veksle automatisk. */
export type CameraMove = 'auto' | 'push_in' | 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'section_snap' | 'parallax';
/** Overgang inn til scenen. */
export type SceneTransition = 'auto' | 'whip' | 'none';
export const CAMERA_MOVE_LABELS: Record<CameraMove, string> = {
  auto: 'Auto (varier)', push_in: 'Zoom inn (push-in)', zoom_in: 'Zoom inn', zoom_out: 'Zoom ut',
  pan_left: 'Panorer venstre', pan_right: 'Panorer høyre', section_snap: 'Snap til seksjon', parallax: 'Parallax (dybde-drift)',
};
export const SCENE_TRANSITION_LABELS: Record<SceneTransition, string> = {
  auto: 'Auto', whip: 'Whip (rask sveip)', none: 'Ingen (rolig)',
};

export interface DemoScene {
  id: string;
  index: number;
  title: string;
  device: DemoDevice;
  viewport: DemoViewport;
  /** Manuell kamera-bevegelse (overstyrer auto-syklus i autonom video). */
  cameraMove?: CameraMove;
  /** Manuell overgang inn til scenen. */
  transition?: SceneTransition;
  /** Skjerm-orientering. Relevant for iPad (stående/liggende). Default 'portrait'. */
  orientation?: 'portrait' | 'landscape';
  /** Manus / teleprompter-tekst som leses opp. */
  narration: string;
  /** Visuell instruks: hva som skal vises/fokuseres på (Script Builder rad 2). */
  visualInstruction?: string;
  /** Menneske-lesbar instruks om hva som skal gjøres. */
  requiredAction: string;
  /** Primær handlingstype for required action (Script Builder dropdown). */
  actionType?: DemoActionType;
  /** Navn på mål-elementet handlingen gjelder, f.eks. «Start free trial button». */
  targetLabel?: string;
  /** CSS-selector for mål-elementet (fylles av capture) — brukes til validering. */
  targetSelector?: string;
  /**
   * Multi-strategi-locators for mål-elementet (resilient replay). Flere uavhengige
   * fingeravtrykk (id/testid/aria/text/css) prøves i rekkefølge ved replay/verify,
   * så scenen overlever re-renders, hashede CSS-klasser og A/B-varianter.
   */
  targetLocators?: TargetLocator[];
  /**
   * Detektert selector — hva som FAKTISK ble interagert med (fylles av capture
   * eller en verifiserings-runde). Sammenlignes med targetSelector (Expected ↔
   * Detected → Match/Warning).
   */
  detectedSelector?: string;
  /** CTA-type for mål-elementet (fra CTA-banken) — brukes til prioritering/innsikt. */
  ctaType?: CtaType;
  /**
   * Hvor sikker bindingen til mål-elementet er (aktiv læring):
   *   - 'high':   bundet til ekte skannet element ELLER en lært korreksjon
   *   - 'medium': AI ga targetLabel + omtrentlig hotspot (ikke verifisert)
   *   - 'low':    ingen/uklart mål — AI bør spørre brukeren hvor elementet er
   */
  bindingConfidence?: 'high' | 'medium' | 'low';
  /** Marker scenen som et kritisk steg (fremheves i Script Builder/recorder). */
  critical?: boolean;
  /** Valideringsregel — når regnes handlingen som utført (f.eks. «Vent til modal åpnes»). */
  validationRule?: string;
  /** Hva skjer hvis handlingen ikke skjer / validering feiler. */
  fallback?: 'retake' | 'manual' | 'skip';
  /**
   * Interaktivt mål (hotspot) på siden — rektangel i VIEWPORT-PROSENT (0–1) av
   * skjermflaten, så det rendres device-uavhengig over enhver preview. Fremheves
   * i Guided Recorder + preview (cursor/touch/highlight). Fylles av manuell
   * plassering, AI-forslag eller capture-laget (klikk-gjennom).
   */
  hotspot?: { x: number; y: number; w: number; h: number };
  /** AI Director → Fusion: eksplisitte motion-graphics-effekter for denne scenen
   *  (CTA-highlight, callout, cursor, card, …). Overstyrer hotspot-avledning når
   *  satt. Tom/undefined ⇒ effekter avledes automatisk fra hotspot. */
  fusionEffects?: Array<Record<string, unknown>>;
  /** Strukturerte browser-handlinger (valgfritt, for automasjon). */
  actions: DemoAction[];
  /** Tekst-overlay vist i videoen. */
  overlayText?: string;
  /** Stil på tekst-overlay (minimal/callout/lower-third/...). */
  overlayStyle?: string;
  /** Interne notater / pause-cue (Script Builder rad 5). */
  notes?: string;
  /** Pause i sekunder etter scenens handling. */
  pauseSec?: number;
  /**
   * Start scenen etter å ha scrollet N% ned på siden (0–100). Settes typisk av
   * Responsive Check («start mobilscene etter 20% scroll») og brukes av
   * capture/recorder til å posisjonere siden før opptak.
   */
  startScrollPct?: number;
  /** Estimert/faktisk varighet i sekunder. */
  duration: number;
  status: SceneStatus;
  /**
   * Progresjons-modus per scene:
   *   - 'manual':   opptaket venter på brukerens bekreftelse (default, spec-krav)
   *   - 'assisted': bruker utfører, systemet verifiserer handlingen (detected)
   *   - 'auto':     systemet utfører required action automatisk og går videre
   */
  continueMode: 'manual' | 'assisted' | 'auto';
  /** Sti til opptaksfil for denne scenen (settes av recorder). */
  recordingPath?: string | null;
  /** Frosset skjermbilde (dataURL) for scene-kortet — fylles av en framtidig
   *  capture-screenshot. Når tomt viser kortet en live mini-preview. */
  thumbnailDataUrl?: string;
}

/** Manus-meta på prosjektnivå (Script Builder Tone/Audience/Language/Length). */
export type ScriptTone = 'professional' | 'warm' | 'investor' | 'technical' | 'sales' | 'educational' | 'concise';
export type ScriptLength = 'short' | 'medium' | 'long';
export interface ScriptMeta {
  tone: ScriptTone;
  audience: string;
  language: string;
  length: ScriptLength;
}
export const SCRIPT_TONE_LABELS: Record<ScriptTone, string> = {
  professional: 'Professional', warm: 'Varm og menneskelig', investor: 'Investor-orientert',
  technical: 'Teknisk', sales: 'Salgsorientert', educational: 'Pedagogisk', concise: 'Kort og direkte',
};
export const SCRIPT_LENGTH_LABELS: Record<ScriptLength, string> = { short: 'Short', medium: 'Medium', long: 'Long' };

/**
 * Visnings-/render-innstillinger for demoen. Påvirker både live-preview,
 * guided opptak og eksport (video + interaktiv guide).
 */
export interface DemoRenderOptions {
  /** Vis et syntetisk muspeker-overlay (desktop). */
  showCursor: boolean;
  /** Vis tap-ringer der brukeren trykker (mobil/tablet). */
  showTouchPoints: boolean;
  /** Fremhev elementet som interageres med (spotlight/puls). */
  highlightInteractions: boolean;
  /** Respekter enhetens safe-area (notch/home-indikator), særlig for 9:16. */
  safeArea: boolean;
  /** Push-in (auto-zoom/pan) mot scenens hotspot for fokus på handlingen. */
  autoZoom: boolean;
}

export const RENDER_OPTION_LABELS: Record<keyof DemoRenderOptions, string> = {
  showCursor: 'Show Cursor',
  showTouchPoints: 'Show Touch Points',
  highlightInteractions: 'Highlight Interactions',
  safeArea: 'Safe Area',
  autoZoom: 'Auto-zoom mot hotspot',
};

export function defaultRenderOptions(): DemoRenderOptions {
  return { showCursor: true, showTouchPoints: true, highlightInteractions: true, safeArea: true, autoZoom: false };
}

/** Merkevare/white-label for sluttproduktet. */
export interface DemoBranding {
  brandName?: string;
  /** Aksent-/merkefarge (hex) brukt i interaktiv guide. */
  brandColor?: string;
  /** Logo (URL eller data:image) vist i guide-headeren. */
  logoUrl?: string;
  /** White-label: skjul «Powered by»-vannmerke (typisk betalt tier). */
  hidePoweredBy?: boolean;
}

// ── Responsive Check (§ sjekk siden i desktop/tablet/mobil) ──
export type ResponsiveStatus = 'ok' | 'warning' | 'error';

/** Strukturert, anvendbar auto-fiks fra Responsive Check. */
export interface ResponsiveFix {
  kind: 'start_scroll' | 'switch_device' | 'set_format';
  /** Indeks på scenen som justeres (for start_scroll/switch_device). */
  sceneIndex?: number;
  /** For start_scroll: scroll-prosent før scenen starter. */
  startScrollPct?: number;
  /** For switch_device. */
  device?: DemoDevice;
  /** For set_format. */
  format?: DemoProject['format'];
  /** Menneske-lesbar oppsummering: «Start mobile scene after scrolling 20% down.» */
  summary: string;
}

export interface ResponsiveViewportResult {
  device: DemoDevice;
  status: ResponsiveStatus;
  /** Kort status: «All good» / «CTA button is slightly low on mobile view.» */
  message: string;
  /** Anbefaling i klartekst (vises under message ved warning/error). */
  recommendation?: string;
  /** Anvendbar fiks (når status != ok). */
  fix?: ResponsiveFix;
}

export interface ResponsiveReport {
  results: ResponsiveViewportResult[];
  createdAt: string;
}

export const RESPONSIVE_STATUS_LABELS: Record<ResponsiveStatus, string> = {
  ok: 'All good', warning: 'Warning', error: 'Issue',
};
export const RESPONSIVE_STATUS_COLORS: Record<ResponsiveStatus, string> = {
  ok: '#10b981', warning: '#f59e0b', error: '#ef4444',
};

export interface DemoProject {
  id: string;
  name: string;
  url: string;
  demoType: DemoType;
  language: string;
  devices: DemoDevice[];
  /** Visnings-/render-innstillinger (cursor, touch points, highlight, safe area). */
  render?: DemoRenderOptions;
  /** Konverteringsmål for demoen (mål-drevet AI Director). F.eks. «få flere til å booke demo». */
  goal?: string;
  /** Spesifikk oppgave/prosess veiledningen skal vise. F.eks. «hele innloggings-prosessen». */
  task?: string;
  /** Product Brain: ekstrahert tekst fra en produkt-PDF (one-pager) som AI
   *  Director leser for å forstå produktet dypere enn nettsiden alene. */
  productDoc?: string;
  productDocName?: string;
  /** URL-en scenene/manuset sist ble GENERERT for. Brukes til å oppdage at
   *  manuset er utdatert (URL byttet) → unngå forrige manus på ny video. */
  scenesUrl?: string;
  /** Valgt Resolve AI-stemme for voiceover (VoiceModel). Default «Female 1». */
  voiceModel?: string;
  /** Merkevare/white-label for output (interaktiv guide + video). */
  branding?: DemoBranding;
  /** Fase 1b: viewport-screenshots fra scan, per scroll-bånd. Brukes til presis
   *  preview-render (riktig del av siden + hotspot oppå, perfekt align). */
  scanShots?: Array<{ scrollPct: number; dataUrl: string }>;
  /** Global progresjons-modus (kan overstyres per scene). Default 'manual'. */
  continueMode?: 'manual' | 'assisted' | 'auto';
  /**
   * Hva som tas opp: 'web' (iframe/getDisplayMedia, default), eller en native
   * capture-kilde. For App Store-apper: 'ios_device' (kablet enhet).
   */
  captureKind?: 'web' | 'mac_screen' | 'ios_device' | 'ios_simulator' | 'iphone_mirroring';
  /** AVFoundation-indeks eller simulator-UDID når captureKind != 'web'. */
  captureSourceId?: string;
  captureSourceLabel?: string;
  /** Eksport-format (aspect ratio). */
  format: '16:9' | '9:16' | '1:1' | '4:5';
  /** Manus-meta (Script Builder Tone/Audience/Language/Length). */
  scriptMeta?: ScriptMeta;
  /** Arbeidsmodus: 'demo' (feature-tur) eller 'marketing' (målrettet budskap). */
  mode?: 'demo' | 'marketing';
  /** Marketing-brief (Marketing mode): persona, funnel-steg, kanal, rammeverk. */
  marketingBrief?: MarketingBrief;
  scenes: DemoScene[];
  createdAt: string;
  updatedAt: string;
}

export const DEMO_TYPE_LABELS: Record<DemoType, string> = {
  product_demo: 'Product Demo',
  tutorial: 'Tutorial',
  onboarding: 'Onboarding',
  sales_video: 'Sales Video',
  investor_demo: 'Investor Demo',
  social_clip: 'Social Media Clip',
  support_guide: 'Support Guide',
  feature_walkthrough: 'Feature Walkthrough',
};

export const SCENE_STATUS_LABELS: Record<SceneStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  recording: 'Recording',
  paused: 'Paused',
  done: 'Done',
  needs_review: 'Needs Review',
  retake: 'Retake Needed',
  approved: 'Approved',
};

export const SCENE_STATUS_COLORS: Record<SceneStatus, string> = {
  pending: '#6b7280',
  in_progress: '#3b82f6',
  recording: '#ef4444',
  paused: '#f59e0b',
  done: '#10b981',
  needs_review: '#f59e0b',
  retake: '#f97316',
  approved: '#a030c0',
};

// ── Validation (§7: Expected ↔ Detected → Match/Warning) ──
export type ActionMatch = 'match' | 'warning' | 'unverified';

export const ACTION_MATCH_LABELS: Record<ActionMatch, string> = {
  match: 'Match', warning: 'Warning', unverified: 'Ikke verifisert',
};
export const ACTION_MATCH_COLORS: Record<ActionMatch, string> = {
  match: '#10b981', warning: '#f59e0b', unverified: '#9a9186',
};

function normalizeSelector(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Sammenlign forventet (targetSelector) mot detektert (detectedSelector):
 *   - unverified: ingen detektert handling ennå
 *   - match:      detektert == forventet (riktig element ble aktivert)
 *   - warning:    detektert avviker fra forventet (eller mangler forventet)
 */
export function sceneActionMatch(s: DemoScene): ActionMatch {
  const detected = (s.detectedSelector || '').trim();
  if (!detected) return 'unverified';
  const expected = (s.targetSelector || '').trim();
  if (!expected) return 'warning';
  return normalizeSelector(expected) === normalizeSelector(detected) ? 'match' : 'warning';
}

/** Menneske-lesbar «Expected action»-tekst for en scene. */
export function expectedActionText(s: DemoScene): string {
  const verb = ACTION_META[s.actionType ?? 'click'].verb;
  const target = s.targetLabel || s.targetSelector || '';
  return target ? `${verb} ${target}` : (s.requiredAction || '(ingen handling)');
}

/**
 * Readiness-validering: er Required Action-broen komplett (handlingstype +
 * target + manus + varighet)? Returnerer hvilke felter som mangler.
 */
export function validateScene(s: DemoScene): { ready: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!s.narration || !s.narration.trim()) issues.push('Mangler manus');
  if (!s.actionType) issues.push('Mangler handlingstype');
  if (!(s.targetLabel && s.targetLabel.trim()) && !(s.targetSelector && s.targetSelector.trim()) && !s.hotspot) issues.push('Mangler target / hotspot');
  if (!s.duration || s.duration <= 0) issues.push('Ugyldig varighet');
  return { ready: issues.length === 0, issues };
}

/**
 * Integritets-gate før eksport (D): vurder hele flowen.
 *   - blocking  → kan ikke produsere meningsfull output (blokkerer eksport)
 *   - warnings  → degradert kvalitet (tillatt, men flagget)
 */
export interface ExportIssue { index: number; title: string; issue: string }
export interface ExportReadiness { ready: boolean; blocking: ExportIssue[]; warnings: ExportIssue[] }
export function exportReadiness(scenes: DemoScene[]): ExportReadiness {
  const blocking: ExportIssue[] = [];
  const warnings: ExportIssue[] = [];
  if (!scenes.length) { blocking.push({ index: -1, title: '', issue: 'Ingen scener i demoen' }); return { ready: false, blocking, warnings }; }
  scenes.forEach((s, i) => {
    const title = s.title || `Scene ${i + 1}`;
    if (!s.duration || s.duration <= 0) blocking.push({ index: i, title, issue: 'Ugyldig varighet' });
    if (!s.narration?.trim() && !s.overlayText?.trim()) warnings.push({ index: i, title, issue: 'Ingen manus eller overlay' });
    const hasTarget = !!(s.targetLabel?.trim() || s.targetSelector?.trim() || s.hotspot);
    if (s.actionType && s.actionType !== 'wait' && !hasTarget) warnings.push({ index: i, title, issue: 'Handling uten target/hotspot' });
    if (s.actionType && s.actionType !== 'wait' && s.detectedSelector && s.targetSelector && s.detectedSelector !== s.targetSelector) {
      warnings.push({ index: i, title, issue: 'Uverifisert handling (detected ≠ expected)' });
    }
  });
  return { ready: blocking.length === 0, blocking, warnings };
}

export const DEVICE_LABELS: Record<DemoDevice, string> = {
  macbook: 'MacBook', ipad: 'iPad', iphone: 'iPhone',
};

export function viewportForDevice(device: DemoDevice): DemoViewport {
  return device === 'macbook' ? 'desktop' : device === 'ipad' ? 'tablet' : 'mobile';
}

/** Enkel, kollisjonssikker-nok id uten eksterne deps (Math.random unngås ikke
 *  her — dette er nettleser-runtime, ikke et workflow-skript). */
export function makeId(prefix = 'scene'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function makeScene(index: number, device: DemoDevice = 'macbook'): DemoScene {
  return {
    id: makeId('scene'),
    index,
    title: `Scene ${index + 1}`,
    device,
    viewport: viewportForDevice(device),
    narration: '',
    requiredAction: '',
    actions: [],
    overlayText: '',
    duration: 10,
    status: 'pending',
    continueMode: 'manual',
    recordingPath: null,
  };
}

/** Én scene-rad i en demo-type-mal (før den blir til en DemoScene). */
interface TemplateScene {
  title: string;
  narration: string;
  action: string;
  dur: number;
  /** Overstyr device for denne scenen (ellers malens default-device). */
  device?: DemoDevice;
  /** Primær handlingstype — kobler malen til det interaktive steg-systemet. */
  actionType?: DemoActionType;
}

export interface DemoTypeTemplate {
  /** Standard manus-tone for denne demo-typen. */
  tone: ScriptTone;
  /** Standard manus-lengde. */
  length: ScriptLength;
  /** Mål-varighet for hele demoen (sekunder) — mater AI Director + UI-hint. */
  targetSeconds: number;
  /** Anbefalt eksport-format (social = 9:16 osv.). */
  format: DemoProject['format'];
  /** Default-enhet malen bygges for. */
  device: DemoDevice;
  scenes: TemplateScene[];
}

/**
 * Per-demo-type maler. Hver type gir en EGEN scene-flow + tone/lengde/format,
 * så «Demo-typer»-knappene faktisk reformer demoen (ikke bare en label).
 * Ren data — deterministisk, ingen backend. AI Director kan deretter skrive om
 * manuset på toppen av disse stegene.
 */
/** Bestemor-vennlige norske etiketter + én-setnings-forklaring per type. */
export const DEMO_TYPE_FRIENDLY: Record<DemoType, { label: string; desc: string }> = {
  product_demo: { label: 'Vis frem produktet', desc: 'En kort video som viser hva nettsiden/produktet ditt gjør.' },
  tutorial: { label: 'Lær bort hvordan', desc: 'Steg-for-steg-veiledning for hvordan man bruker det.' },
  onboarding: { label: 'Velkommen for nye', desc: 'Hva nye brukere ser og gjør når de starter.' },
  sales_video: { label: 'Selg det inn', desc: 'Kort og fengende: problem → løsning → kom i gang.' },
  investor_demo: { label: 'Pitch til investorer', desc: 'Marked, produkt og hvorfor det er verdt å satse på.' },
  social_clip: { label: 'Kort klipp for sosiale medier', desc: '15–30 sek vertikal video for Instagram/TikTok.' },
  support_guide: { label: 'Hjelp kunder selv', desc: '«Slik løser du dette» – en rolig hjelpevideo.' },
  feature_walkthrough: { label: 'Vis én funksjon i detalj', desc: 'Dybde-demo av én bestemt funksjon.' },
};

export const DEMO_TYPE_TEMPLATES: Record<DemoType, DemoTypeTemplate> = {
  product_demo: {
    tone: 'professional', length: 'medium', targetSeconds: 75, format: '16:9', device: 'macbook',
    scenes: [
      { title: 'Intro', narration: 'Kort intro: hva er produktet og hvem er det for.', action: 'Vis forsiden.', dur: 6, actionType: 'open_url' },
      { title: 'Homepage', narration: 'Rask oversikt over hovedverdien.', action: 'Scroll gjennom forsiden.', dur: 12, actionType: 'scroll' },
      { title: 'Main Feature', narration: 'Demonstrer kjernefunksjonen — aha-øyeblikket.', action: 'Klikk deg inn på hovedfunksjonen.', dur: 18, actionType: 'click' },
      { title: 'Mobile Flow', narration: 'Vis at det funker på mobil.', action: 'Bytt til iPhone-visning.', dur: 12, device: 'iphone', actionType: 'switch_device' },
      { title: 'CTA', narration: 'Oppfordre til handling.', action: 'Vis registrerings-/kjøps-knappen.', dur: 8, actionType: 'highlight' },
      { title: 'Outro', narration: 'Avslutt med logo og oppsummering.', action: 'Vis avslutningsbildet.', dur: 6, actionType: 'open_url' },
    ],
  },
  tutorial: {
    tone: 'educational', length: 'medium', targetSeconds: 90, format: '16:9', device: 'macbook',
    scenes: [
      { title: 'Mål', narration: 'Forklar hva brukeren skal få til i denne veiledningen.', action: 'Vis startpunktet.', dur: 7, actionType: 'open_url' },
      { title: 'Steg 1', narration: 'Første steg — gjør det enkelt å følge med.', action: 'Klikk på første knapp/lenke.', dur: 14, actionType: 'click' },
      { title: 'Steg 2', narration: 'Andre steg — bygg videre på forrige.', action: 'Fyll inn / velg det som trengs.', dur: 16, actionType: 'type' },
      { title: 'Steg 3', narration: 'Tredje steg — fullfør hovedoppgaven.', action: 'Bekreft / lagre.', dur: 14, actionType: 'click' },
      { title: 'Oppsummering', narration: 'Oppsummer hva som ble gjort og hva som er neste.', action: 'Vis resultatet.', dur: 8, actionType: 'highlight' },
    ],
  },
  onboarding: {
    tone: 'warm', length: 'medium', targetSeconds: 80, format: '16:9', device: 'macbook',
    scenes: [
      { title: 'Velkommen', narration: 'Ønsk velkommen og sett forventningen.', action: 'Vis velkomst-skjermen.', dur: 7, actionType: 'open_url' },
      { title: 'Opprett konto', narration: 'Vis hvor enkelt det er å komme i gang.', action: 'Klikk «Registrer deg».', dur: 14, actionType: 'click' },
      { title: 'Første oppsett', narration: 'Guide gjennom det viktigste oppsettet.', action: 'Fyll inn de første feltene.', dur: 16, actionType: 'type' },
      { title: 'Første verdi', narration: 'Få brukeren til sin første aha-handling.', action: 'Utfør kjernehandlingen.', dur: 16, actionType: 'click' },
      { title: 'Neste steg', narration: 'Pek mot hva de bør gjøre videre.', action: 'Vis dashboard/neste-steg.', dur: 8, actionType: 'highlight' },
    ],
  },
  sales_video: {
    tone: 'sales', length: 'short', targetSeconds: 60, format: '16:9', device: 'macbook',
    scenes: [
      { title: 'Hook', narration: 'Start med problemet kunden kjenner seg igjen i.', action: 'Vis et relaterbart skjermbilde.', dur: 6, actionType: 'open_url' },
      { title: 'Løsning', narration: 'Introduser løsningen i én tydelig setning.', action: 'Vis kjerneproduktet.', dur: 12, actionType: 'highlight' },
      { title: 'Bevis', narration: 'Vis verdien — tall, resultat eller demo.', action: 'Demonstrer hovedfordelen.', dur: 14, actionType: 'click' },
      { title: 'Demonstrasjon', narration: 'Kort, konkret demo av aha-øyeblikket.', action: 'Kjør gjennom kjerneflyten.', dur: 16, actionType: 'click' },
      { title: 'Tilbud', narration: 'Tydelig CTA med lav terskel.', action: 'Vis tilbud/registrer-knapp.', dur: 8, actionType: 'highlight' },
    ],
  },
  investor_demo: {
    tone: 'investor', length: 'medium', targetSeconds: 120, format: '16:9', device: 'macbook',
    scenes: [
      { title: 'Problem & marked', narration: 'Ramme inn problemet og markedsstørrelsen.', action: 'Vis problem-konteksten.', dur: 15, actionType: 'open_url' },
      { title: 'Produkt', narration: 'Vis produktet som løser problemet.', action: 'Demonstrer kjerneproduktet.', dur: 20, actionType: 'click' },
      { title: 'Traction', narration: 'Vis bevis: brukere, vekst, inntekt.', action: 'Vis tall/dashboard.', dur: 18, actionType: 'highlight' },
      { title: 'Forretningsmodell', narration: 'Hvordan tjener dere penger og skalerer.', action: 'Vis pris/modell.', dur: 15, actionType: 'scroll' },
      { title: 'Ask', narration: 'Hva dere ber om og hva det muliggjør.', action: 'Vis avslutnings-slide.', dur: 12, actionType: 'open_url' },
    ],
  },
  social_clip: {
    tone: 'concise', length: 'short', targetSeconds: 25, format: '9:16', device: 'iphone',
    scenes: [
      { title: 'Hook', narration: 'Fang oppmerksomheten i de første 2 sekundene.', action: 'Vis det mest iøynefallende.', dur: 3, actionType: 'open_url' },
      { title: 'Aha', narration: 'Lever poenget umiddelbart.', action: 'Vis kjernefunksjonen.', dur: 8, actionType: 'click' },
      { title: 'Payoff', narration: 'Vis resultatet/verdien raskt.', action: 'Vis sluttresultatet.', dur: 8, actionType: 'highlight' },
      { title: 'CTA', narration: 'Kort oppfordring — følg/prøv.', action: 'Vis CTA-tekst.', dur: 4, actionType: 'highlight' },
    ],
  },
  support_guide: {
    tone: 'educational', length: 'short', targetSeconds: 60, format: '16:9', device: 'macbook',
    scenes: [
      { title: 'Problemet', narration: 'Beskriv kort hva brukeren prøver å løse.', action: 'Vis utgangspunktet.', dur: 8, actionType: 'open_url' },
      { title: 'Naviger', narration: 'Vis hvor de skal gå.', action: 'Klikk deg til riktig sted.', dur: 14, actionType: 'click' },
      { title: 'Utfør', narration: 'Gjør selve handlingen som løser problemet.', action: 'Utfør handlingen.', dur: 16, actionType: 'click' },
      { title: 'Verifiser', narration: 'Vis hvordan de ser at det funket.', action: 'Vis bekreftelsen.', dur: 8, actionType: 'highlight' },
    ],
  },
  feature_walkthrough: {
    tone: 'professional', length: 'medium', targetSeconds: 70, format: '16:9', device: 'macbook',
    scenes: [
      { title: 'Funksjonen', narration: 'Introduser funksjonen og hvorfor den er nyttig.', action: 'Vis funksjonen.', dur: 8, actionType: 'open_url' },
      { title: 'Hvor finne den', narration: 'Vis hvor brukeren finner funksjonen.', action: 'Naviger til funksjonen.', dur: 12, actionType: 'click' },
      { title: 'Bruk den', narration: 'Demonstrer funksjonen i bruk.', action: 'Bruk funksjonen steg for steg.', dur: 20, actionType: 'click' },
      { title: 'Tips', narration: 'Del et nyttig tips eller en snarvei.', action: 'Vis det avanserte trikset.', dur: 12, actionType: 'hover' },
      { title: 'Avslutt', narration: 'Oppsummer verdien kort.', action: 'Vis oppsummering.', dur: 6, actionType: 'open_url' },
    ],
  },
};

/** Bygg en konkret scene-flow for en gitt demo-type. */
export function flowForDemoType(demoType: DemoType, deviceOverride?: DemoDevice): DemoScene[] {
  const tpl = DEMO_TYPE_TEMPLATES[demoType] ?? DEMO_TYPE_TEMPLATES.product_demo;
  const baseDevice = deviceOverride ?? tpl.device;
  return tpl.scenes.map((c, i) => ({
    ...makeScene(i, c.device ?? baseDevice),
    title: c.title,
    narration: c.narration,
    requiredAction: c.action,
    actionType: c.actionType,
    duration: c.dur,
  }));
}

/** Bakoverkompatibel alias — product_demo-flowen. */
export function defaultSceneFlow(device: DemoDevice = 'macbook'): DemoScene[] {
  return flowForDemoType('product_demo', device);
}

/** Locator-strategi for resilient element-gjenfinning ved replay. */
export type LocatorStrategy = 'id' | 'testid' | 'aria' | 'text' | 'css';
export interface TargetLocator { strategy: LocatorStrategy; value: string }

// ── CTA-bank: klassifiser knapper/lenker etter intensjon (NO + EN, bred) ──
export type CtaType =
  | 'trial' | 'signup' | 'purchase' | 'demo' | 'contact' | 'download' | 'subscribe'
  | 'login' | 'learn' | 'quote' | 'waitlist' | 'apply' | 'schedule' | 'watch'
  | 'donate' | 'share' | 'invite' | 'refer' | 'search' | 'submit' | 'install'
  | 'reserve' | 'gift' | 'enroll' | 'chat' | 'feedback' | 'next' | 'menu';

export const CTA_LABELS: Record<CtaType, string> = {
  trial: 'Prøveperiode', signup: 'Registrering', purchase: 'Kjøp', demo: 'Book demo',
  contact: 'Kontakt', download: 'Nedlasting', subscribe: 'Abonnement', login: 'Innlogging',
  learn: 'Les mer', quote: 'Få tilbud', waitlist: 'Venteliste', apply: 'Søk', schedule: 'Book møte',
  watch: 'Se video', donate: 'Doner', share: 'Del', invite: 'Inviter', refer: 'Verv',
  search: 'Søk', submit: 'Send inn', install: 'Installer', reserve: 'Reserver', gift: 'Gave',
  enroll: 'Meld på', chat: 'Chat', feedback: 'Tilbakemelding', next: 'Neste', menu: 'Meny',
};

// Mest spesifikke mønstre først (rekkefølge teller — første treff vinner).
const CTA_BANK: Array<{ type: CtaType; re: RegExp }> = [
  { type: 'trial', re: /free trial|prøv gratis|start (free|trial)|try (it )?free|gratis prøve|start.*gratis|\d+[- ]?day(s)? free|gratis i \d+/i },
  { type: 'demo', re: /book (a |en )?demo|request (a )?demo|se demo|get a demo|bestill demo|watch (a )?demo/i },
  { type: 'schedule', re: /book (a |et )?(call|meeting|møte|samtale)|schedule|avtal(e)? (et )?møte|sett opp møte|book (en )?tid|reserver tid/i },
  { type: 'quote', re: /get (a )?quote|request (a )?quote|få (et )?tilbud|be om tilbud|pristilbud|get pricing/i },
  { type: 'waitlist', re: /wait ?list|venteliste|join the list|early access|tidlig tilgang|notify me|varsle meg/i },
  { type: 'purchase', re: /\bbuy\b|kjøp|add to (cart|bag)|legg i (kurv|handlekurv)|checkout|kasse|\border\b|bestill|pricing|priser|upgrade|oppgrader|subscribe now|velg plan|choose plan/i },
  { type: 'signup', re: /sign ?up|get started|kom i gang|registrer|opprett (en )?konto|create (an )?account|\bjoin\b|bli med|start now|start nå/i },
  { type: 'apply', re: /apply( now)?|søk( nå| her)?|send (en )?søknad|application/i },
  { type: 'enroll', re: /enroll|meld (deg )?på|påmelding|register for|sign up for the course/i },
  { type: 'reserve', re: /reserve|reserver|book (a )?(table|room|seat)|book (bord|rom|plass)/i },
  { type: 'contact', re: /contact|kontakt|talk to (us|sales)|snakk med|\bsales\b|salg|get in touch|ta kontakt/i },
  { type: 'chat', re: /chat( with us| now)?|live ?chat|start (a )?chat|prat med oss|åpne chat/i },
  { type: 'download', re: /download|last ned|get the app|app store|google play|installer|hent appen/i },
  { type: 'install', re: /install|installer|add to chrome|legg til i|get extension/i },
  { type: 'subscribe', re: /subscribe|abonner|newsletter|nyhetsbrev|følg oss/i },
  { type: 'donate', re: /donate|doner|gi (et )?bidrag|støtt|support us|fund/i },
  { type: 'gift', re: /gift|gave(kort)?|send (a )?gift/i },
  { type: 'refer', re: /refer (a friend)?|verv (en )?venn|referral|invitasjonskode/i },
  { type: 'invite', re: /invite|inviter|send invite|legg til medlem/i },
  { type: 'share', re: /\bshare\b|\bdel\b|share this|del denne|dele/i },
  { type: 'watch', re: /watch( video| now)?|se video|play( video)?|spill av|se filmen/i },
  { type: 'feedback', re: /feedback|tilbakemelding|rate (us|this)|gi vurdering|review us/i },
  { type: 'login', re: /log ?in|logg (deg )?inn|sign in/i },
  { type: 'search', re: /\bsearch\b|\bsøk\b|finn|look up/i },
  { type: 'submit', re: /\bsubmit\b|send inn|send (skjema|melding)|lever/i },
  { type: 'next', re: /\bnext\b|\bneste\b|continue|fortsett|proceed|gå videre/i },
  // Meny-/navigasjonsknapper (anker mot hele label så CTA-er ikke stjeles).
  { type: 'menu', re: /^(menu|meny|☰|≡|products?|produkter|solutions?|løsninger|resources?|ressurser|company|selskap|features?|funksjoner|about( us)?|om( oss)?|blog|docs|documentation|dokumentasjon|support|home|hjem|overview|oversikt|use cases|customers|kunder|integrations|integrasjoner|platform|plattform)$/i },
  { type: 'learn', re: /learn more|les mer|read more|find out|se mer|utforsk|explore|how it works|slik virker/i },
];

/** Statisk klassifisering (kun innebygde mønstre). */
export function classifyCtaStatic(label: string): CtaType | null {
  const t = (label || '').trim();
  if (!t) return null;
  for (const e of CTA_BANK) if (e.re.test(t)) return e.type;
  return null;
}

// ── Selvlærende CTA-bank (auto-utvider seg fra skannede elementer) ──
const LEARNED_CTA_KEY = 'trrpa.demoStudio.ctaBank';
function normCta(s: string): string { return s.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60); }
function loadLearnedCtas(): Record<string, CtaType> {
  try { return JSON.parse(localStorage.getItem(LEARNED_CTA_KEY) || '{}') as Record<string, CtaType>; } catch { return {}; }
}
function saveLearnedCtas(m: Record<string, CtaType>): void {
  try { localStorage.setItem(LEARNED_CTA_KEY, JSON.stringify(m)); } catch { /* full/blokkert */ }
}

/** Menneske-lesbar posisjon fra hotspot-rect (viewport-prosent) — så instrukser/
 *  manus refererer DER elementet FAKTISK er. Gjelder ethvert element, ikke bare CTA. */
export function describePosition(h?: { x: number; y: number; w: number; h: number }): string {
  if (!h) return '';
  const cx = h.x + h.w / 2, cy = h.y + h.h / 2;
  const vert = cy < 0.33 ? 'øverst' : cy > 0.66 ? 'nederst' : 'på midten';
  const horiz = cx < 0.33 ? 'til venstre' : cx > 0.66 ? 'til høyre' : 'i midten';
  return (vert === 'på midten' && horiz === 'i midten') ? 'midt på skjermen' : `${vert} ${horiz}`;
}

/** Klassifiser et label: innebygd bank → lært bank. */
export function classifyCta(label: string): CtaType | null {
  const stat = classifyCtaStatic(label);
  if (stat) return stat;
  const n = normCta(label || '');
  return n ? (loadLearnedCtas()[n] ?? null) : null;
}

/**
 * Auto-utvid banken fra skannede elementer: knapper/CTA-aktige lenker som ikke
 * matcher de innebygde mønstrene lagres (som 'learn' om typen er ukjent), så de
 * gjenkjennes neste gang. Returnerer antall nye lærte CTA-er.
 */
export function learnCtas(elements: Array<{ label?: string; tag?: string; actionType?: string }>): number {
  const learned = loadLearnedCtas();
  let added = 0;
  for (const e of elements) {
    const lab = (e.label || '').trim();
    if (!lab || lab.length > 40) continue;
    const n = normCta(lab);
    if (learned[n]) continue;
    const known = classifyCtaStatic(lab);
    const structural = e.tag === 'button' || (e.actionType === 'click' && e.tag === 'a');
    if (known) { learned[n] = known; added++; }
    else if (structural) { learned[n] = 'learn'; added++; }
  }
  if (added) saveLearnedCtas(learned);
  return added;
}

export function learnedCtaCount(): number { return Object.keys(loadLearnedCtas()).length; }

// ── Lærte mål-korreksjoner (brukeren lærer opp AI-en) ──
// Når brukeren manuelt plasserer hotspot / fikser target, husker vi det per
// side+label og overstyrer AI-ens gjetting neste gang på samme side.
const LEARNED_TARGETS_KEY = 'trrpa.demoStudio.learnedTargets';
export interface LearnedTarget {
  label: string;
  selector?: string;
  hotspot?: { x: number; y: number; w: number; h: number };
  /** Action-type-retting (AI sa click, det er egentlig type/scroll). */
  actionType?: DemoActionType;
  /** Label-retting (AI kalte den «Sign in», ekte tekst er «Logg inn»). */
  correctLabel?: string;
  /** Negative: selectors brukeren har avvist for dette elementet. */
  rejectSelectors?: string[];
  /** Hvordan den ble lært. */
  source: 'manual' | 'capture';
  /** Hvor mange ganger forsterket (manuell + capture). */
  count: number;
  /** ISO-tidsstempel for siste oppdatering (forvaltning/drift). */
  updatedAt: string;
}
function hostOf(url: string): string { try { return new URL(url).host; } catch { return (url || '').slice(0, 80); } }
function loadLearnedTargets(): Record<string, LearnedTarget> {
  try { return JSON.parse(localStorage.getItem(LEARNED_TARGETS_KEY) || '{}') as Record<string, LearnedTarget>; } catch { return {}; }
}
function saveLearnedTargets(m: Record<string, LearnedTarget>): void {
  try { localStorage.setItem(LEARNED_TARGETS_KEY, JSON.stringify(m)); } catch { /* */ }
}
function learnedKey(url: string, label: string): string { return `${hostOf(url)}|${normCta(label)}`; }

/**
 * Husk en korreksjon for et element på en side. Slår sammen med eksisterende
 * (forsterker count, beholder felt som ikke overstyres). source='capture' når
 * brukeren viste flowen («vis meg én gang»), 'manual' ved hotspot-plassering.
 */
export function recordLearnedTarget(
  url: string,
  label: string,
  data: {
    selector?: string;
    hotspot?: { x: number; y: number; w: number; h: number };
    actionType?: DemoActionType;
    correctLabel?: string;
    rejectSelector?: string;
    source?: 'manual' | 'capture';
  },
): void {
  const lab = (label || '').trim();
  if (!lab) return;
  if (!data.hotspot && !data.selector && !data.actionType && !data.correctLabel && !data.rejectSelector) return;
  const m = loadLearnedTargets();
  const key = learnedKey(url, lab);
  const prev = m[key];
  const rejects = new Set(prev?.rejectSelectors ?? []);
  if (data.rejectSelector) rejects.add(data.rejectSelector);
  m[key] = {
    label: lab,
    selector: data.selector ?? prev?.selector,
    hotspot: data.hotspot ?? prev?.hotspot,
    actionType: data.actionType ?? prev?.actionType,
    correctLabel: data.correctLabel ?? prev?.correctLabel,
    rejectSelectors: rejects.size ? Array.from(rejects) : undefined,
    source: data.source ?? prev?.source ?? 'manual',
    count: (prev?.count ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  saveLearnedTargets(m);
  // #1 delt lærings-lager: push til backend (fire-and-forget) så læringen
  // komponerer på tvers av demoer/brukere.
  pushLearnedToBackend(url, lab, m[key]);
}

// ── Delt lærings-lager (backend-sync) ──
function pwSettings(): { base: string; token: string | null } {
  try {
    const s = JSON.parse(localStorage.getItem('trrpa.settings') || '{}');
    return {
      base: (s.RR_POST_AGENT_BASE_URL || 'https://creatorhubn.com/api/post-agent').replace(/\/$/, ''),
      token: (s.RR_BEARER_TOKEN || '').trim() || null,
    };
  } catch { return { base: 'https://creatorhubn.com/api/post-agent', token: null }; }
}
function pushLearnedToBackend(url: string, label: string, t: LearnedTarget): void {
  const { base, token } = pwSettings();
  if (!token) return;
  void fetch(`${base}/learned-targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      host: hostOf(url), label,
      selector: t.selector, hotspot: t.hotspot, actionType: t.actionType,
      correctLabel: t.correctLabel, rejectSelectors: t.rejectSelectors,
    }),
  }).catch(() => { /* fire-and-forget */ });
}
/** Hent delte lærte targets for en host fra backend + flett inn lokalt. Kalles
 *  når en demo åpnes, så healing/AI bruker kollektiv kunnskap. */
export async function syncLearnedTargetsFromBackend(url: string): Promise<number> {
  const { base } = pwSettings();
  try {
    const res = await fetch(`${base}/learned-targets?host=${encodeURIComponent(hostOf(url))}`);
    if (!res.ok) return 0;
    const data = (await res.json()) as { targets?: Array<Partial<LearnedTarget>> };
    const m = loadLearnedTargets();
    let merged = 0;
    for (const t of data.targets ?? []) {
      const lab = (t.label || '').trim();
      if (!lab) continue;
      const key = learnedKey(url, lab);
      const prev = m[key];
      // Backend som kilde, men ikke overskriv nyere lokal læring.
      if (!prev || ((t.updatedAt || '') > (prev.updatedAt || ''))) {
        m[key] = {
          label: lab, selector: t.selector, hotspot: t.hotspot, actionType: t.actionType,
          correctLabel: t.correctLabel, rejectSelectors: t.rejectSelectors,
          source: 'capture', count: t.count ?? 1, updatedAt: t.updatedAt || new Date().toISOString(),
        };
        merged++;
      }
    }
    if (merged) saveLearnedTargets(m);
    return merged;
  } catch { return 0; }
}
/** Hent en lært korreksjon for et element på en side (eller null). */
export function getLearnedTarget(url: string, label: string): LearnedTarget | null {
  const lab = (label || '').trim();
  if (!lab) return null;
  return loadLearnedTargets()[learnedKey(url, lab)] ?? null;
}
export function learnedTargetCount(): number { return Object.keys(loadLearnedTargets()).length; }

// ── Forvaltning & tillit (D) ──
/** List alle lærte korreksjoner (nyeste først). */
export function listLearnedTargets(): LearnedTarget[] {
  return Object.values(loadLearnedTargets()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
/** List lærte korreksjoner for én vert (nøkkel-host-prefiks). */
export function listLearnedTargetsForHost(url: string): LearnedTarget[] {
  const h = hostOf(url);
  const m = loadLearnedTargets();
  return Object.entries(m)
    .filter(([k]) => k.startsWith(`${h}|`))
    .map(([, v]) => v)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
/** Glem én lært korreksjon. */
export function removeLearnedTarget(url: string, label: string): void {
  const m = loadLearnedTargets();
  delete m[learnedKey(url, label)];
  saveLearnedTargets(m);
}
/** Glem alle lærte korreksjoner (evt. kun for én vert). */
export function clearLearnedTargets(url?: string): void {
  if (!url) { saveLearnedTargets({}); return; }
  const h = hostOf(url);
  const m = loadLearnedTargets();
  for (const k of Object.keys(m)) if (k.startsWith(`${h}|`)) delete m[k];
  saveLearnedTargets(m);
}
/**
 * Drift-deteksjon: en lært korreksjon er «utdatert» når dens selector ikke
 * lenger finnes blant skannede elementer OG labelen ikke matcher noen. Da bør
 * brukeren læres opp på nytt (siden er trolig redesignet).
 */
export function detectLearnedDrift(url: string, elements: ScannedElement[]): LearnedTarget[] {
  const learned = listLearnedTargetsForHost(url);
  if (!learned.length || !elements.length) return [];
  const selectors = new Set(elements.map((e) => e.selector));
  const labels = new Set(elements.map((e) => normCta(e.label || '')));
  return learned.filter((t) => {
    const selOk = t.selector ? selectors.has(t.selector) : false;
    const labOk = labels.has(normCta(t.correctLabel || t.label));
    return !selOk && !labOk;
  });
}

// ════════════════════════════════════════════════════════════════════
//  MARKETING MODE — målrettet innhold (persona × funnel × kanal × rammeverk)
// ════════════════════════════════════════════════════════════════════

/** Funnel-steg: hvor i kjøpsreisen publikum er. */
export type FunnelStage = 'tofu' | 'mofu' | 'bofu';
export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  tofu: 'Oppmerksomhet (TOFU)',
  mofu: 'Vurdering (MOFU)',
  bofu: 'Beslutning (BOFU)',
};
/** Hva hvert funnel-steg skal oppnå + hvilken CTA-energi som passer. */
export const FUNNEL_INTENT: Record<FunnelStage, { goal: string; ctaHint: string }> = {
  tofu: { goal: 'skape oppmerksomhet og nysgjerrighet rundt problemet', ctaHint: 'lav-terskel («Se hvordan», «Lær mer»)' },
  mofu: { goal: 'vise hvordan produktet løser problemet bedre enn alternativene', ctaHint: 'vurdering («Sammenlign», «Prøv gratis», «Se demo»)' },
  bofu: { goal: 'fjerne siste tvil og utløse handling', ctaHint: 'beslutning («Book demo», «Start nå», «Kom i gang»)' },
};

/** Distribusjonskanal — styrer format, lengde, tone og caption-grammatikk. */
export type MarketingChannel = 'reels' | 'tiktok' | 'youtube' | 'linkedin' | 'email' | 'landing' | 'sales_demo';
export interface ChannelPreset {
  label: string;
  format: DemoProject['format'];
  maxSeconds: number;
  captions: boolean;
  hookSeconds: number;
  toneHint: string;
  /** Foretrukket rammeverk for denne kanalen. */
  framework: MarketingFramework;
}
export const CHANNEL_PRESETS: Record<MarketingChannel, ChannelPreset> = {
  reels:      { label: 'Instagram Reels', format: '9:16', maxSeconds: 30, captions: true,  hookSeconds: 3, toneHint: 'rask, energisk, hook i første 3 sek, store captions', framework: 'pas' },
  tiktok:     { label: 'TikTok',          format: '9:16', maxSeconds: 35, captions: true,  hookSeconds: 2, toneHint: 'rå, autentisk, pattern-interrupt-hook', framework: 'pas' },
  youtube:    { label: 'YouTube',         format: '16:9', maxSeconds: 90, captions: false, hookSeconds: 8, toneHint: 'fortellende, dypere, tydelig verdiløfte tidlig', framework: 'aida' },
  linkedin:   { label: 'LinkedIn',        format: '1:1',  maxSeconds: 45, captions: true,  hookSeconds: 4, toneHint: 'autoritativ, innsikts-drevet, B2B-troverdig', framework: 'bab' },
  email:      { label: 'E-post',          format: '16:9', maxSeconds: 40, captions: false, hookSeconds: 5, toneHint: 'personlig, én tydelig CTA, lav friksjon', framework: 'aida' },
  landing:    { label: 'Landingsside',    format: '16:9', maxSeconds: 60, captions: false, hookSeconds: 5, toneHint: 'verdiløfte + bevis + CTA, konverteringsrettet', framework: 'pas' },
  sales_demo: { label: 'Salgsdemo',       format: '16:9', maxSeconds: 120, captions: false, hookSeconds: 10, toneHint: 'konsultativ, tilpasset innvendinger, ROI-fokus', framework: 'bab' },
};

/** Markedsførings-rammeverk (metode) for scene-dramaturgi. */
export type MarketingFramework =
  | 'pas' | 'aida' | 'bab' | 'problem_solution'
  | 'fab' | 'storybrand' | 'quest' | 'fourps' | 'pastor' | 'star' | 'jtbd';
export const FRAMEWORKS: Record<MarketingFramework, { label: string; beats: string[]; bestFor: string }> = {
  pas:              { label: 'PAS (Problem · Agiter · Løs)', beats: ['Problem', 'Agiter smerten', 'Løsning', 'Bevis', 'CTA'], bestFor: 'kort, smerte-drevet innhold (Reels/ads)' },
  aida:             { label: 'AIDA (Oppmerksomhet · Interesse · Begjær · Handling)', beats: ['Oppmerksomhet/hook', 'Interesse', 'Begjær/verdi', 'Bevis', 'Handling/CTA'], bestFor: 'klassisk salgsfortelling, video' },
  bab:              { label: 'BAB (Før · Etter · Bro)', beats: ['Før (dagens smerte)', 'Etter (ønsket tilstand)', 'Bro (produktet)', 'Bevis', 'CTA'], bestFor: 'transformasjon/ROI, B2B' },
  problem_solution: { label: 'Problem → Løsning', beats: ['Problem', 'Løsning', 'Hvordan det virker', 'Bevis', 'CTA'], bestFor: 'enkle produkt-forklaringer' },
  fab:              { label: 'FAB (Feature · Advantage · Benefit)', beats: ['Funksjon', 'Fordel', 'Gevinst for kunden', 'Bevis', 'CTA'], bestFor: 'feature-tunge produkter, sammenligning' },
  storybrand:       { label: 'StoryBrand SB7 (kunden er helten)', beats: ['Helt (kunden) vil noe', 'Problem', 'Guide (produktet) forstår', 'Plan', 'Kall til handling', 'Suksess vs. fiasko'], bestFor: 'merkevare-fortelling, landingssider' },
  quest:            { label: 'QUEST (Qualify · Understand · Educate · Stimulate · Transition)', beats: ['Kvalifiser publikum', 'Vis forståelse', 'Lær bort', 'Stimuler begjær', 'Overgang til CTA'], bestFor: 'lengre nurture/utdannende innhold' },
  fourps:           { label: '4 P-er (Promise · Picture · Proof · Push)', beats: ['Løfte', 'Mal bildet', 'Bevis', 'Push (CTA)'], bestFor: 'punchy ads + e-post' },
  pastor:           { label: 'PASTOR (Problem · Amplify · Story · Testimony · Offer · Response)', beats: ['Problem', 'Forsterk', 'Historie/løsning', 'Testimonial', 'Tilbud', 'Respons (CTA)'], bestFor: 'høy-konvertering salgsdemo' },
  star:             { label: 'STAR (Situation · Task · Action · Result)', beats: ['Situasjon', 'Oppgave', 'Handling', 'Resultat', 'CTA'], bestFor: 'case studies / kundehistorier' },
  jtbd:             { label: 'Jobs-to-be-done', beats: ['Jobben kunden vil ha gjort', 'Dagens dårlige løsning', 'Hvordan produktet gjør jobben', 'Bevis', 'CTA'], bestFor: 'innovasjon/onboarding, ny kategori' },
};

/** Hvilket markedsførings-rammeverk hver demo-type følger (og verifiseres mot).
 *  investor_demo har egen bespoke pitch-rekkefølge i generatoren, mappes til
 *  pastor for QA. tutorial/support følger enkel prosess, ikke salgs-arc. */
export const DEMO_TYPE_FRAMEWORK: Record<DemoType, MarketingFramework> = {
  product_demo: 'aida',
  tutorial: 'problem_solution',
  onboarding: 'jtbd',
  sales_video: 'pas',
  investor_demo: 'pastor',
  social_clip: 'pas',
  support_guide: 'problem_solution',
  feature_walkthrough: 'fab',
};

/** Markedsføringsmål — hva du vil oppnå. Anbefaler funnel-steg + metode + kanaler. */
export type MarketingObjective =
  | 'awareness' | 'lead_gen' | 'conversion' | 'activation' | 'retention' | 'expansion' | 'advocacy'
  | 'abm' | 'webinar' | 'freemium';
export interface ObjectiveSpec {
  label: string;
  description: string;
  funnelStage: FunnelStage;
  framework: MarketingFramework;
  channels: MarketingChannel[];
}
export const MARKETING_OBJECTIVES: Record<MarketingObjective, ObjectiveSpec> = {
  awareness:  { label: 'Bygg oppmerksomhet', description: 'Nå nye folk, skap nysgjerrighet rundt problemet', funnelStage: 'tofu', framework: 'pas', channels: ['reels', 'tiktok', 'youtube'] },
  lead_gen:   { label: 'Generer leads', description: 'Få kvalifiserte interessenter til å melde seg', funnelStage: 'mofu', framework: 'quest', channels: ['linkedin', 'landing', 'email'] },
  conversion: { label: 'Konverter til kunde', description: 'Få vurderende kjøpere til å handle', funnelStage: 'bofu', framework: 'pastor', channels: ['landing', 'sales_demo', 'email'] },
  activation: { label: 'Aktiver / onboard', description: 'Få nye brukere til første verdi-øyeblikk', funnelStage: 'mofu', framework: 'jtbd', channels: ['email', 'youtube'] },
  retention:  { label: 'Behold kunder', description: 'Vis verdi, reduser frafall, dyp bruk', funnelStage: 'bofu', framework: 'bab', channels: ['email', 'youtube'] },
  expansion:  { label: 'Mersalg / oppgrader', description: 'Få eksisterende kunder til å utvide', funnelStage: 'bofu', framework: 'fab', channels: ['email', 'sales_demo'] },
  advocacy:   { label: 'Skap ambassadører', description: 'Få fornøyde kunder til å anbefale', funnelStage: 'bofu', framework: 'star', channels: ['linkedin', 'reels'] },
  abm:        { label: 'ABM (navngitte kontoer)', description: 'Skreddersydd demo mot spesifikke målkontoer/beslutningstakere', funnelStage: 'bofu', framework: 'pastor', channels: ['linkedin', 'sales_demo', 'email'] },
  webinar:    { label: 'Webinar-funnel', description: 'Driv påmeldinger + varm opp før/etter et webinar', funnelStage: 'mofu', framework: 'quest', channels: ['email', 'landing', 'youtube'] },
  freemium:   { label: 'Freemium-aktivering', description: 'Få gratis-brukere til «aha» og oppgradering', funnelStage: 'mofu', framework: 'jtbd', channels: ['email', 'youtube', 'landing'] },
};

/** Marketing-brief: AI-ens forståelse av markedsføreren og målgruppen. */
export interface MarketingBrief {
  /** Hva du vil oppnå — anbefaler funnel-steg + metode + kanaler. */
  objective?: MarketingObjective;
  /** ICP / persona, f.eks. «markedssjef i SMB-byrå». */
  persona: string;
  /** Jobs-to-be-done — hva personaen prøver å oppnå. */
  jobToBeDone?: string;
  /** Smertepunkter. */
  painPoints: string[];
  /** Verdiløfter produktet leverer. */
  valueProps: string[];
  /** Bevis (tall, logoer, sitater). */
  proof?: string[];
  /** Hovedinnvending som skal slås. */
  objection?: string;
  funnelStage: FunnelStage;
  channel: MarketingChannel;
  framework: MarketingFramework;
  /** Ønsket handling (CTA-intensjon). */
  desiredAction?: string;
  /** Konkurrent-URLer/navn — gir skarpere posisjonering/differensiering. */
  competitors?: string[];
}
export function emptyMarketingBrief(): MarketingBrief {
  return { objective: 'conversion', persona: '', painPoints: [], valueProps: [], funnelStage: 'mofu', channel: 'reels', framework: 'pas' };
}
/** Velg et mål → sett anbefalt funnel-steg, metode og standardkanal (kan overstyres). */
export function applyObjectiveToBrief(brief: MarketingBrief, objective: MarketingObjective): MarketingBrief {
  const o = MARKETING_OBJECTIVES[objective];
  return { ...brief, objective, funnelStage: o.funnelStage, framework: o.framework, channel: o.channels[0] ?? brief.channel };
}

/**
 * Produkt-bevis-inventar: AI leser produktet inn i typede artefakter, slik at
 * hver rammeverk-beat kan festes til en KONKRET del av produktet (ikke generisk
 * prat). En funksjon løser en smerte; et bevis underbygger et løfte; en seksjon
 * er stedet å navigere til. Brukes av generateMarketingFlow til beat→bevis-binding.
 */
export interface ProductFeature {
  /** Funksjonens navn slik den heter i produktet. */
  name: string;
  /** Hvilken smerte / hvilket behov den løser. */
  solves: string;
  /** Label på det interaktive elementet som demonstrerer den (matcher katalogen). */
  elementLabel?: string;
}
export interface ProductProof {
  /** Selve påstanden/beviset, f.eks. «3 200 byråer» eller «sparer 8 t/uke». */
  claim: string;
  type: 'metric' | 'testimonial' | 'logo' | 'award' | 'guarantee' | 'other';
}
export interface ProductSection {
  /** Seksjonens navn, f.eks. «Priser» / «Slik fungerer det». */
  label: string;
  /** Hva seksjonen er til for (hvorfor en beat vil vise den). */
  purpose: string;
}
export interface ProductEvidence {
  /** Kort oppsummering av hva produktet er. */
  summary: string;
  features: ProductFeature[];
  proof: ProductProof[];
  sections: ProductSection[];
}

/**
 * PRODUCT BRAIN — tankekart som kobler en one-pager mot virkeligheten.
 * AI parser one-pageren til påstander, krysser dem mot det vi skanner live, og
 * merker hver node verifisert/ikke funnet/ekstra. Gir en dekningssti («hva må vi
 * gjennom») + anbefalt mål/metode med begrunnelse. Fase 1 = verifisert
 * disposisjon; et dra-bart node-kart kan rendres av samme data senere.
 */
export type BrainNodeKind = 'feature' | 'value' | 'proof' | 'cta' | 'audience' | 'integration';
export type VerificationStatus = 'verified' | 'unverified' | 'extra';
export const BRAIN_KIND_LABELS: Record<BrainNodeKind, string> = {
  feature: 'Funksjoner', value: 'Verdiløfter', proof: 'Bevis', cta: 'CTA-er', audience: 'Målgrupper', integration: 'Integrasjoner',
};
export const VERIFICATION_META: Record<VerificationStatus, { label: string; icon: string; color: string }> = {
  verified:   { label: 'Verifisert', icon: '✓', color: '#2e7d32' },
  unverified: { label: 'Ikke funnet på siden', icon: '!', color: '#9a6516' },
  extra:      { label: 'På siden, ikke i one-pager', icon: '+', color: '#2a5bd7' },
};
export interface BrainNode {
  kind: BrainNodeKind;
  text: string;
  status: VerificationStatus;
  /** Hva den ble verifisert mot (element-label / seksjon / bevis-tekst). */
  matchedOn?: string;
}
export interface CoverageStep {
  /** Hva som skal vises/gjøres i dette steget. */
  label: string;
  /** Ekte element/seksjon å navigere til (matcher katalogen om mulig). */
  elementLabel?: string;
}
export interface ProductBrain {
  summary: string;
  nodes: BrainNode[];
  /** «Hva må vi gjennom» — ordnet sti for å demonstrere produktet ende-til-ende. */
  coveragePath: CoverageStep[];
  /** Gap: hevdet i one-pager men ikke verifiserbart på siden. */
  gaps: string[];
  recommendedObjective?: MarketingObjective;
  recommendedFramework: MarketingFramework;
  /** Hvorfor denne metoden passer, gitt grafens form. */
  reasoning: string;
}

// ── Stemme-/tone-læring (G): innholdsprodusentens stemme læres over tid ──
const VOICE_PREFS_KEY = 'trrpa.demoStudio.voicePrefs';
export interface VoicePrefs { liked: string[]; disliked: string[] }
function loadVoicePrefs(): Record<string, VoicePrefs> {
  try { return JSON.parse(localStorage.getItem(VOICE_PREFS_KEY) || '{}') as Record<string, VoicePrefs>; } catch { return {}; }
}
/** Lær produsentens stemme: tommel opp/ned på en manus-linje, lagret pr. vert. */
export function recordVoicePref(url: string, line: string, liked: boolean): void {
  const text = (line || '').trim();
  if (!text) return;
  const m = loadVoicePrefs();
  const h = hostOf(url);
  const p: VoicePrefs = m[h] ?? { liked: [], disliked: [] };
  const add = liked ? p.liked : p.disliked;
  const remove = liked ? p.disliked : p.liked;
  if (!add.includes(text)) add.unshift(text);
  const ri = remove.indexOf(text); if (ri >= 0) remove.splice(ri, 1);
  p.liked = p.liked.slice(0, 12); p.disliked = p.disliked.slice(0, 12);
  m[h] = p;
  try { localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(m)); } catch { /* */ }
}
export function getVoicePrefs(url: string): VoicePrefs {
  return loadVoicePrefs()[hostOf(url)] ?? { liked: [], disliked: [] };
}

/** Et interaktivt element katalogisert av DOM-skannet (AI-binding). */
export interface ScannedElement {
  selector: string;
  label: string;
  tag: string;
  actionType: string;
  belowFold: boolean;
  hotspot: { x: number; y: number; w: number; h: number };
  /** Multi-strategi-locators (resilient replay). */
  locators?: TargetLocator[];
  /** CTA-klassifisering fra CTA-banken (om elementet er en CTA). */
  ctaType?: CtaType;
  /** Hvor på siden (0–1) elementet sees best — hotspot er viewport-relativ DER.
   *  Render/Guided Recorder scroller til scrollPct før hotspot tegnes. */
  scrollPct?: number;
  /** Viktighets-rang fra scan (button/CTA > heading > input) — AI prioriterer. */
  importance?: number;
}

/** Resultat av et DOM-skann av en side. */
export interface DomScanResult {
  url: string;
  title: string;
  elements: ScannedElement[];
  /** JS-rendret synlig tekst (rikere AI-kontekst enn anonym reqwest). */
  pageText?: string;
  /** Auto-uthentet merkevare fra siden (navn/logo/farger). */
  branding?: DemoBranding & { palette?: string[] };
  /** Fase 1b: viewport-screenshots per scroll-bånd (presis preview-render). */
  shots?: Array<{ scrollPct: number; dataUrl: string }>;
  viewport?: { w: number; h: number };
  docHeight?: number;
}

/** Velg screenshot-båndet nærmest en scenes scrollPct (0–1) for preview-render. */
export function pickShot(
  shots: Array<{ scrollPct: number; dataUrl: string }> | undefined,
  scrollPct: number | undefined,
): string | null {
  if (!shots || !shots.length) return null;
  const target = Math.max(0, Math.min(1, (scrollPct ?? 0)));
  let best = shots[0], bestD = Infinity;
  for (const s of shots) {
    const d = Math.abs(s.scrollPct - target);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best.dataUrl;
}

/** Ett innsamlet klikk-steg fra «klikk-gjennom»-capture (Fase 2). */
export interface CapturedStepLike {
  url: string;
  selector?: string;
  targetLabel?: string;
  actionType?: string;
  hotspot?: { x: number; y: number; w: number; h: number };
  scrollPct?: number;
  locators?: TargetLocator[];
}

/**
 * Konverter innsamlede capture-steg til scener. Hvert klikk blir én scene med
 * hotspot + targetLabel + selector + actionType + start-scroll, klar for
 * Guided Recorder. Manus (narration) fylles av AI Director etterpå.
 */
export function captureStepsToScenes(steps: CapturedStepLike[], device: DemoDevice = 'macbook'): DemoScene[] {
  const valid = Object.keys(ACTION_META) as DemoActionType[];
  return steps.map((s, i) => {
    const at: DemoActionType = valid.includes(s.actionType as DemoActionType) ? (s.actionType as DemoActionType) : 'click';
    const label = (s.targetLabel || '').trim();
    return {
      ...makeScene(i, device),
      title: label ? label.slice(0, 40) : `Steg ${i + 1}`,
      requiredAction: `${ACTION_META[at].verb} ${label || 'elementet'}`.trim(),
      actionType: at,
      targetLabel: label || undefined,
      targetSelector: s.selector || undefined,
      targetLocators: s.locators && s.locators.length ? s.locators : undefined,
      ctaType: classifyCta(label) ?? undefined,
      // Capture = brukeren klikket faktisk elementet → detektert == forventet.
      detectedSelector: s.selector || undefined,
      hotspot: s.hotspot,
      startScrollPct: s.scrollPct != null ? Math.round(s.scrollPct * 100) : undefined,
      duration: 8,
      status: 'in_progress',
    };
  });
}

/**
 * Har brukeren gjort reelt opptaks-arbeid på disse scenene? Brukes til å
 * avgjøre om en mal-bytte trygt kan re-seede flowen eller må bekreftes.
 */
export function hasRecordedWork(scenes: DemoScene[]): boolean {
  return scenes.some(
    (s) => s.recordingPath || s.status === 'done' || s.status === 'approved' || s.status === 'recording',
  );
}

export function makeProject(url: string, demoType: DemoType = 'product_demo'): DemoProject {
  const now = new Date().toISOString();
  const tpl = DEMO_TYPE_TEMPLATES[demoType] ?? DEMO_TYPE_TEMPLATES.product_demo;
  return {
    id: makeId('demo'),
    name: 'Untitled Demo',
    url,
    demoType,
    language: 'no',
    devices: [...new Set<DemoDevice>([tpl.device, 'iphone'])],
    render: defaultRenderOptions(),
    format: tpl.format,
    scriptMeta: { tone: tpl.tone, audience: 'General', language: 'Norsk', length: tpl.length },
    scenes: flowForDemoType(demoType),
    createdAt: now,
    updatedAt: now,
  };
}

// ── localStorage-persistens (per project-nøkkel) ──
const LS_PREFIX = 'trrpa.demoStudio.';

export function saveProject(p: DemoProject): void {
  try {
    localStorage.setItem(LS_PREFIX + p.id, JSON.stringify({ ...p, updatedAt: new Date().toISOString() }));
    // Hold en peker til sist åpnede prosjekt.
    localStorage.setItem(LS_PREFIX + 'last', p.id);
  } catch {
    /* localStorage kan være full/blokkert — ikke-kritisk */
  }
}

export function loadProject(id: string): DemoProject | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + id);
    return raw ? (JSON.parse(raw) as DemoProject) : null;
  } catch {
    return null;
  }
}

export function loadLastProject(): DemoProject | null {
  try {
    const id = localStorage.getItem(LS_PREFIX + 'last');
    return id ? loadProject(id) : null;
  } catch {
    return null;
  }
}

export function totalDuration(scenes: DemoScene[]): number {
  return scenes.reduce((s, sc) => s + (sc.duration || 0), 0);
}

/** Resolve AI Speech Generator-stemmer (VoiceModel). Engelske modeller i 21.x;
 *  «Custom Voice» bruker en egen stemme-fil. */
export const VOICE_MODELS: Array<{ id: string; label: string }> = [
  { id: 'Female 1', label: 'Kvinne 1' },
  { id: 'Female 2', label: 'Kvinne 2' },
  { id: 'Male 1', label: 'Mann 1' },
  { id: 'Male 2', label: 'Mann 2' },
];

// ── Lesbarhet (LIX — norsk standard) ──
export interface Readability { lix: number; label: string }

/** LIX-lesbarhetsindeks: ord/setninger + (lange ord × 100)/ord. Lavere = lettere. */
export function readabilityScore(text: string): Readability {
  const t = (text || '').trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (!words.length) return { lix: 0, label: '—' };
  const sentences = Math.max(1, (t.match(/[.!?]+/g) || []).length);
  const longWords = words.filter((w) => w.replace(/[^\p{L}]/gu, '').length > 6).length;
  const lix = Math.round(words.length / sentences + (longWords * 100) / words.length);
  const label = lix < 30 ? 'Veldig lett' : lix < 40 ? 'Lett' : lix < 50 ? 'Middels' : lix < 60 ? 'Vanskelig' : 'Veldig vanskelig';
  return { lix, label };
}

// ── Director Critic (AI selv-kritikk av hele demoen) ──
export type CritiqueSeverity = 'high' | 'medium' | 'low';
export interface CritiqueIssue { severity: CritiqueSeverity; area: string; message: string; sceneIndex?: number }
export interface DirectorCritique { score: number; summary: string; issues: CritiqueIssue[] }

export const CRITIQUE_SEVERITY_COLORS: Record<CritiqueSeverity, string> = {
  high: '#ef4444', medium: '#f59e0b', low: '#6b7280',
};
