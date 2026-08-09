/**
 * mockupStudioStore.ts — Zustand-store for Mockup Studio.
 *
 * Holder hele MockupDoc + UI-utvalg. Hver mutasjon autolagres til localStorage
 * (samme mønster som demoStudioStore: plain `create` + saveDoc). Alle endringer
 * går gjennom actions her, så preview + eksport alltid leser samme sannhet.
 */

import { create } from 'zustand';
import {
  type MockupDoc,
  type MockupDeviceSlot,
  type MockupTextSlot,
  type MockupTextRole,
  type MockupCanvasSpec,
  type MockupDeviceVariant,
  type MockupAnnotation,
  type MockupAnnotationKind,
  makeDevice,
  makeText,
  makeAnnotation,
  uid,
  buildTemplate,
  loadDoc,
  saveDoc,
  applyLayout as modelApplyLayout,
  applyFormat as modelApplyFormat,
  saveFormatLayout as modelSaveFormatLayout,
  clearFormatLayout as modelClearFormatLayout,
  currentFormatId as modelCurrentFormatId,
  MOCKUP_FORMATS,
  type LayoutVariantId,
  type MockupFormat,
} from './mockupStudioModel';
import { computeSmartFocus } from './mockupSmartCrop';
import { reorder } from './mockupArrange';
import { type LibraryMeta, idbAllMeta, idbDelete, idbPatchMeta, idbGetFull } from './mockupLibraryDb';

/** Hva som er valgt i editoren (styrer inspektør-panelet). */
export type Selection =
  | { kind: 'canvas' }
  | { kind: 'device'; id: string }
  | { kind: 'text'; id: string };

interface MockupStudioState {
  doc: MockupDoc;
  selection: Selection;
  /** Angre/gjør-om-stakker (fulle doc-snapshots). */
  past: MockupDoc[];
  future: MockupDoc[];

  // Livssyklus
  newFromTemplate: (templateId: string) => void;
  setDocument: (doc: MockupDoc) => void;
  setName: (name: string) => void;
  undo: () => void;
  redo: () => void;

  // Direktemanipulasjon (dra/tastatur): push ÉN historikk-oppføring ved start,
  // deretter stille live-oppdateringer uten å flomme angre-stakken.
  pushHistory: () => void;
  setDocSilent: (doc: MockupDoc) => void;

  // Utvalg
  select: (sel: Selection) => void;

  // Lerret
  patchCanvas: (patch: Partial<MockupCanvasSpec>) => void;

  // Slot-motor
  applyLayout: (id: LayoutVariantId) => void;
  applyFormat: (fmt: MockupFormat) => void;
  saveFormatLayout: () => void;
  clearFormatLayout: (fmtId: string) => void;

  // Enheter
  addDevice: (variant: MockupDeviceVariant) => void;
  patchDevice: (id: string, patch: Partial<MockupDeviceSlot>) => void;
  setDeviceImage: (id: string, image: string | undefined) => void;
  removeDevice: (id: string) => void;
  duplicateDevice: (id: string) => void;

  // Tekst
  addText: (role: MockupTextRole) => void;
  addTexts: (texts: MockupTextSlot[]) => void;
  patchText: (id: string, patch: Partial<MockupTextSlot>) => void;
  removeText: (id: string) => void;
  duplicateText: (id: string) => void;

  // Lag-rekkefølge (z): tegner i array-rekkefølge — flytt et element fram/bak.
  reorderElement: (kind: 'device' | 'text', id: string, dir: 'up' | 'down') => void;
  duplicateSelected: () => void;

  // Illustrasjons-lag (callout/lupe/markør)
  addAnnotation: (kind: MockupAnnotationKind, deviceId?: string) => void;
  patchAnnotation: (id: string, patch: Partial<MockupAnnotation>) => void;
  removeAnnotation: (id: string) => void;
  setAnnotations: (anns: MockupAnnotation[]) => void;
  setMindmap: (src: string | undefined) => void;

  // Prosjekt-bibliotek (media pool, IndexedDB-backet)
  library: LibraryMeta[];
  libraryLoaded: boolean;
  loadLibrary: () => Promise<void>;
  addLibraryMeta: (meta: LibraryMeta) => void;
  removeLibraryAssets: (ids: string[]) => Promise<void>;
  patchLibraryMeta: (id: string, patch: Partial<LibraryMeta>) => Promise<void>;
  /** Last full-res fra IDB → tildel valgt enhet sin skjerm, ellers sett som lerret-bakgrunn. */
  placeLibraryImage: (id: string, target?: 'device' | 'background') => Promise<void>;
}

function initialDoc(): MockupDoc {
  return loadDoc() ?? buildTemplate('hero_mac_phone_dark');
}

const HISTORY_CAP = 30;

/** Sentral commit: skriv nytt doc til state + persister + push til angre-stakk. */
function commit(set: (fn: (s: MockupStudioState) => Partial<MockupStudioState>) => void, mutate: (doc: MockupDoc) => MockupDoc) {
  set((s) => {
    const next = mutate(s.doc);
    saveDoc(next);
    return { doc: next, past: [...s.past, s.doc].slice(-HISTORY_CAP), future: [] };
  });
}

export const useMockupStudio = create<MockupStudioState>((set, get) => ({
  doc: initialDoc(),
  selection: { kind: 'canvas' },
  past: [],
  future: [],

  newFromTemplate: (templateId) => {
    const next = buildTemplate(templateId);
    saveDoc(next);
    set((s) => ({ doc: next, selection: { kind: 'canvas' }, past: [...s.past, s.doc].slice(-HISTORY_CAP), future: [] }));
  },

  setDocument: (next) => {
    saveDoc(next);
    set((s) => ({ doc: next, selection: { kind: 'canvas' }, past: [...s.past, s.doc].slice(-HISTORY_CAP), future: [] }));
  },

  setName: (name) => commit(set, (d) => ({ ...d, name })),

  pushHistory: () => set((s) => ({ past: [...s.past, s.doc].slice(-HISTORY_CAP), future: [] })),
  // KONTRAKT: kall pushHistory() ÉN gang ved gest-start (dra/nudge) FØR første setDocSilent.
  // setDocSilent rører bevisst ikke past/future (høyfrekvent, én angre per gest). pushHistory
  // tømmer future, så redo er allerede invalidert; kall aldri setDocSilent alene etter en undo.
  setDocSilent: (next) => { saveDoc(next); set({ doc: next }); },

  undo: () => set((s) => {
    if (!s.past.length) return {};
    const prev = s.past[s.past.length - 1];
    saveDoc(prev);
    return { doc: prev, past: s.past.slice(0, -1), future: [s.doc, ...s.future].slice(0, HISTORY_CAP), selection: { kind: 'canvas' } };
  }),

  redo: () => set((s) => {
    if (!s.future.length) return {};
    const nxt = s.future[0];
    saveDoc(nxt);
    return { doc: nxt, future: s.future.slice(1), past: [...s.past, s.doc].slice(-HISTORY_CAP), selection: { kind: 'canvas' } };
  }),

  select: (selection) => set({ selection }),

  patchCanvas: (patch) => commit(set, (d) => ({ ...d, canvas: { ...d.canvas, ...patch } })),

  applyLayout: (id) => commit(set, (d) => modelApplyLayout(d, id)),

  applyFormat: (fmt) => commit(set, (d) => modelApplyFormat(d, fmt)),

  saveFormatLayout: () => commit(set, (d) => modelSaveFormatLayout(d)),

  clearFormatLayout: (fmtId) => commit(set, (d) => {
    const cleared = modelClearFormatLayout(d, fmtId);
    const fmt = MOCKUP_FORMATS.find((f) => f.id === fmtId);
    return fmt && modelCurrentFormatId(cleared) === fmtId ? modelApplyFormat(cleared, fmt) : cleared;
  }),

  addDevice: (variant) => {
    const dev = makeDevice(variant, { x: 480, y: 300 });
    commit(set, (d) => ({ ...d, devices: [...d.devices, dev] }));
    set({ selection: { kind: 'device', id: dev.id } });
  },

  patchDevice: (id, patch) =>
    commit(set, (d) => ({
      ...d,
      devices: d.devices.map((dv) => (dv.id === id ? { ...dv, ...patch } : dv)),
    })),

  setDeviceImage: (id, image) => {
    commit(set, (d) => ({
      ...d,
      devices: d.devices.map((dv) => (dv.id === id ? { ...dv, image } : dv)),
    }));
    // Innholds-bevisst fokuspunkt (async) — beskjær mot innholdet, ikke senter.
    if (image) {
      void computeSmartFocus(image).then((f) => {
        if (!f) return;
        const cur = get().doc.devices.find((dv) => dv.id === id);
        if (cur && cur.image === image) get().patchDevice(id, { fit: 'cover', focusX: f.focusX, focusY: f.focusY });
      });
    }
  },

  removeDevice: (id) => {
    commit(set, (d) => ({ ...d, devices: d.devices.filter((dv) => dv.id !== id) }));
    set((s) => (s.selection.kind === 'device' && s.selection.id === id ? { selection: { kind: 'canvas' } } : {}));
  },

  duplicateDevice: (id) => {
    const src = get().doc.devices.find((dv) => dv.id === id);
    if (!src) return;
    const copy = { ...src, id: uid('dev'), x: src.x + 40, y: src.y + 40 };
    commit(set, (d) => ({ ...d, devices: [...d.devices, copy] }));
    set({ selection: { kind: 'device', id: copy.id } });
  },

  addText: (role) => {
    const t = makeText(role, { text: role === 'title' ? 'Ny overskrift' : role === 'body' ? 'Ny tekst' : 'Tekst', x: 120, y: 120 });
    commit(set, (d) => ({ ...d, texts: [...d.texts, t] }));
    set({ selection: { kind: 'text', id: t.id } });
  },

  addTexts: (texts) => {
    if (texts.length === 0) return;
    commit(set, (d) => ({ ...d, texts: [...d.texts, ...texts] }));
    set({ selection: { kind: 'text', id: texts[0].id } });
  },

  patchText: (id, patch) =>
    commit(set, (d) => ({
      ...d,
      texts: d.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  removeText: (id) => {
    commit(set, (d) => ({ ...d, texts: d.texts.filter((t) => t.id !== id) }));
    set((s) => (s.selection.kind === 'text' && s.selection.id === id ? { selection: { kind: 'canvas' } } : {}));
  },

  duplicateText: (id) => {
    const src = get().doc.texts.find((t) => t.id === id);
    if (!src) return;
    const copy = { ...src, id: uid('txt'), x: src.x + 40, y: src.y + 40 };
    commit(set, (d) => ({ ...d, texts: [...d.texts, copy] }));
    set({ selection: { kind: 'text', id: copy.id } });
  },

  reorderElement: (kind, id, dir) => commit(set, (d) =>
    kind === 'device'
      ? { ...d, devices: reorder(d.devices, id, dir) }
      : { ...d, texts: reorder(d.texts, id, dir) }),

  duplicateSelected: () => {
    const s = get().selection;
    if (s.kind === 'device') get().duplicateDevice(s.id);
    else if (s.kind === 'text') get().duplicateText(s.id);
  },

  addAnnotation: (kind, deviceId) => {
    const dev = deviceId ?? get().doc.devices[0]?.id;
    commit(set, (d) => {
      const nextN = (d.annotations?.filter((x) => x.kind === 'callout').length ?? 0) + 1;
      const a = makeAnnotation(kind, dev, nextN);
      return { ...d, annotations: [...(d.annotations ?? []), a] };
    });
  },

  patchAnnotation: (id, patch) =>
    commit(set, (d) => ({
      ...d,
      annotations: (d.annotations ?? []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  removeAnnotation: (id) =>
    commit(set, (d) => ({ ...d, annotations: (d.annotations ?? []).filter((a) => a.id !== id) })),

  setAnnotations: (anns) => commit(set, (d) => ({ ...d, annotations: anns })),

  setMindmap: (src) => commit(set, (d) => ({ ...d, mindmap: src && src.trim() ? src : undefined })),

  // ── Prosjekt-bibliotek ─────────────────────────────────────────────────────
  library: [],
  libraryLoaded: false,
  loadLibrary: async () => {
    if (get().libraryLoaded) return;
    try { const metas = await idbAllMeta(); set({ library: metas, libraryLoaded: true }); }
    catch (e) { console.error('[mockup-studio] loadLibrary', e); set({ libraryLoaded: true }); }
  },
  addLibraryMeta: (meta) => set((s) => ({ library: [meta, ...s.library.filter((m) => m.id !== meta.id)] })),
  removeLibraryAssets: async (ids) => {
    set((s) => ({ library: s.library.filter((m) => !ids.includes(m.id)) }));
    try { await idbDelete(ids); } catch (e) { console.error('[mockup-studio] removeLibraryAssets', e); }
  },
  patchLibraryMeta: async (id, patch) => {
    set((s) => ({ library: s.library.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    try { await idbPatchMeta(id, patch); } catch (e) { console.error('[mockup-studio] patchLibraryMeta', e); }
  },
  placeLibraryImage: async (id, target) => {
    const full = await idbGetFull(id);
    if (!full) return;
    const sel = get().selection;
    if (target === 'background' || sel.kind !== 'device') get().patchCanvas({ bgImage: full });
    else get().setDeviceImage(sel.id, full);
  },
}));
