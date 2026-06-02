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

/**
 * Standard-flow basert på screen_recording-agentens kapittel-taksonomi.
 * Gir brukeren et fornuftig utgangspunkt ("automatisk forslag til scener").
 */
export function defaultSceneFlow(device: DemoDevice = 'macbook'): DemoScene[] {
  const chapters: Array<{ title: string; narration: string; action: string; dur: number }> = [
    { title: 'Intro', narration: 'Kort intro: hva er produktet og hvem er det for.', action: 'Vis forsiden.', dur: 6 },
    { title: 'Homepage', narration: 'Rask oversikt over hovedverdien.', action: 'Scroll gjennom forsiden.', dur: 12 },
    { title: 'Main Feature', narration: 'Demonstrer kjernefunksjonen — aha-øyeblikket.', action: 'Klikk deg inn på hovedfunksjonen.', dur: 18 },
    { title: 'Mobile Flow', narration: 'Vis at det funker på mobil.', action: 'Bytt til iPhone-visning.', dur: 12 },
    { title: 'CTA', narration: 'Oppfordre til handling.', action: 'Vis registrerings-/kjøps-knappen.', dur: 8 },
    { title: 'Outro', narration: 'Avslutt med logo og oppsummering.', action: 'Vis avslutningsbildet.', dur: 6 },
  ];
  return chapters.map((c, i) => ({
    ...makeScene(i, c.title === 'Mobile Flow' ? 'iphone' : device),
    title: c.title,
    narration: c.narration,
    requiredAction: c.action,
    duration: c.dur,
  }));
}

export function makeProject(url: string, demoType: DemoType = 'product_demo'): DemoProject {
  const now = new Date().toISOString();
  return {
    id: makeId('demo'),
    name: 'Untitled Demo',
    url,
    demoType,
    language: 'no',
    devices: ['macbook', 'iphone'],
    format: '16:9',
    scriptMeta: { tone: 'professional', audience: 'Healthcare Professionals', language: 'English', length: 'medium' },
    scenes: defaultSceneFlow('macbook'),
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
