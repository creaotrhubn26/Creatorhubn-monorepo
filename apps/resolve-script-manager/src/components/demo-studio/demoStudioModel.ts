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

export interface DemoScene {
  id: string;
  index: number;
  title: string;
  device: DemoDevice;
  viewport: DemoViewport;
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
  /** Estimert/faktisk varighet i sekunder. */
  duration: number;
  status: SceneStatus;
  /**
   * Progresjons-modus per scene:
   *   - 'manual': opptaket venter på brukerens bekreftelse (default, spec-krav)
   *   - 'auto':   Playwright utfører required action automatisk og går videre
   */
  continueMode: 'manual' | 'auto';
  /** Sti til opptaksfil for denne scenen (settes av recorder). */
  recordingPath?: string | null;
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

export interface DemoProject {
  id: string;
  name: string;
  url: string;
  demoType: DemoType;
  language: string;
  devices: DemoDevice[];
  /** Global progresjons-modus (kan overstyres per scene). Default 'manual'. */
  continueMode?: 'manual' | 'auto';
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
  retake: 'Retake Needed',
  approved: 'Approved',
};

export const SCENE_STATUS_COLORS: Record<SceneStatus, string> = {
  pending: '#6b7280',
  in_progress: '#3b82f6',
  recording: '#ef4444',
  paused: '#f59e0b',
  done: '#10b981',
  retake: '#f97316',
  approved: '#a030c0',
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
