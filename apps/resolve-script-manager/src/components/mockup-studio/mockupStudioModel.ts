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
  variant: MockupDeviceVariant;
  /** Øvre venstre hjørne i lerret-px. */
  x: number;
  y: number;
  /** Bredde i lerret-px (høyde = w / rammens aspect). */
  w: number;
  /** Rotasjon i grader (rundt senter). */
  rotation: number;
  /** Skjermbilde vist i skjerm-hullet (data-URL). Cover-fit skjer ved tegning. */
  image?: string;
  /** Myk kontaktskygge under enheten. */
  shadow: boolean;
}

export type MockupTextRole = 'eyebrow' | 'title' | 'body' | 'tag';
export type MockupTextAlign = 'left' | 'center' | 'right';

/** En redigerbar tekstblokk. Geometri i lerret-px; `w` styrer ombrekking. */
export interface MockupTextSlot {
  id: string;
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

export interface MockupCanvasSpec {
  /** Base-oppløsning i px (all geometri er relativ til denne). */
  w: number;
  h: number;
  /** Bakgrunnsfarge (hex). */
  bg: string;
  /** Valgfri andre-farge → lineær gradient fra bg til bg2. */
  bg2?: string;
  /** Gradient-vinkel i grader (0 = topp→bunn). */
  bgAngle: number;
  /** Accent-farge (én-klikks re-farging av accent-tekst). */
  accent: string;
}

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
  updatedAt: number;
}

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

// ── Maler ────────────────────────────────────────────────────────────────

export interface MockupTemplate {
  id: string;
  name: string;
  description: string;
  build: () => MockupDoc;
}

function baseCanvas(partial: Partial<MockupCanvasSpec> = {}): MockupCanvasSpec {
  return { w: BASE_W, h: BASE_H, bg: '#0f1117', bg2: '#171a2b', bgAngle: 120, accent: '#22d3ee', ...partial };
}

function doc(name: string, template: string, canvas: MockupCanvasSpec, devices: MockupDeviceSlot[], texts: MockupTextSlot[]): MockupDoc {
  return { id: uid('doc'), name, version: 1, template, canvas, devices, texts, updatedAt: Date.now() };
}

export const MOCKUP_TEMPLATES: MockupTemplate[] = [
  {
    id: 'hero_mac_phone',
    name: 'Hero — Mac + iPhone',
    description: 'Klassisk produkt-one-pager: overskrift til venstre, MacBook med iPhone-overlapp til høyre.',
    build: () =>
      doc('Ny mockup', 'hero_mac_phone', baseCanvas(), [
        makeDevice('macbook', { x: 700, y: 250, w: 820, rotation: 0, shadow: true }),
        makeDevice('iphone', { x: 1210, y: 560, w: 250, rotation: 4, shadow: true }),
      ], [
        makeText('eyebrow', { text: 'PRODUKT', x: 120, y: 300, w: 520 }),
        makeText('title', { text: 'Overskrift som selger', x: 120, y: 345, w: 560 }),
        makeText('body', { text: 'Kort verdiløfte i én til to setninger. Bytt ut teksten og skjermbildene i panelet til høyre.', x: 120, y: 560, w: 520 }),
        makeText('tag', { text: 'creatorhubn.com', x: 120, y: 720, w: 520 }),
      ]),
  },
  {
    id: 'devices_trio',
    name: 'Trio — iPad + iPhone',
    description: 'To enheter side ved side under en sentrert overskrift — for app-fokusert markedsføring.',
    build: () =>
      doc('Ny mockup', 'devices_trio', baseCanvas({ accent: '#a78bfa' }), [
        makeDevice('ipad', { x: 470, y: 360, w: 470, rotation: -5, shadow: true }),
        makeDevice('iphone', { x: 900, y: 430, w: 250, rotation: 5, shadow: true }),
      ], [
        makeText('eyebrow', { text: 'APP', x: 0, y: 120, w: BASE_W, align: 'center' }),
        makeText('title', { text: 'Én app. Alt du trenger.', x: 0, y: 160, w: BASE_W, align: 'center', size: 68 }),
      ]),
  },
  {
    id: 'blank',
    name: 'Tomt lerret',
    description: 'Start uten elementer — legg til enheter og tekst selv.',
    build: () => doc('Ny mockup', 'blank', baseCanvas(), [], []),
  },
];

export function buildTemplate(id: string): MockupDoc {
  const t = MOCKUP_TEMPLATES.find((x) => x.id === id) ?? MOCKUP_TEMPLATES[0];
  return t.build();
}

// ── Persistering (localStorage, samme mønster som demoStudioModel) ──────────

const DOC_KEY = 'trrpa.mockup.doc';

export function saveDoc(d: MockupDoc): void {
  try {
    d.updatedAt = Date.now();
    localStorage.setItem(DOC_KEY, JSON.stringify(d));
  } catch {
    /* quota/serialization — ignorer, ikke krasj editoren */
  }
}

export function loadDoc(): MockupDoc | null {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockupDoc;
    if (!parsed || parsed.version !== 1 || !parsed.canvas) return null;
    // Defensiv: sørg for at arrayene finnes.
    parsed.devices = Array.isArray(parsed.devices) ? parsed.devices : [];
    parsed.texts = Array.isArray(parsed.texts) ? parsed.texts : [];
    return parsed;
  } catch {
    return null;
  }
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

/** Løs en tekstfarge: 'accent'-sentinel → lerretets accent, ellers literal. */
export function resolveColor(color: string, canvas: MockupCanvasSpec): string {
  return color === 'accent' ? canvas.accent : color;
}

/** Filnavn-trygt slug av dokumentnavn. */
export function safeDocName(name: string): string {
  return (name || 'mockup').trim().replace(/[^\p{L}\p{N}\-_ ]+/gu, '').replace(/\s+/g, '-').slice(0, 60) || 'mockup';
}
