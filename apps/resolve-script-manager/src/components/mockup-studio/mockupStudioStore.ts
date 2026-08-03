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
  makeDevice,
  makeText,
  buildTemplate,
  loadDoc,
  saveDoc,
} from './mockupStudioModel';

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

  // Utvalg
  select: (sel: Selection) => void;

  // Lerret
  patchCanvas: (patch: Partial<MockupCanvasSpec>) => void;

  // Enheter
  addDevice: (variant: MockupDeviceVariant) => void;
  patchDevice: (id: string, patch: Partial<MockupDeviceSlot>) => void;
  setDeviceImage: (id: string, image: string | undefined) => void;
  removeDevice: (id: string) => void;

  // Tekst
  addText: (role: MockupTextRole) => void;
  patchText: (id: string, patch: Partial<MockupTextSlot>) => void;
  removeText: (id: string) => void;
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

export const useMockupStudio = create<MockupStudioState>((set) => ({
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

  setDeviceImage: (id, image) =>
    commit(set, (d) => ({
      ...d,
      devices: d.devices.map((dv) => (dv.id === id ? { ...dv, image } : dv)),
    })),

  removeDevice: (id) => {
    commit(set, (d) => ({ ...d, devices: d.devices.filter((dv) => dv.id !== id) }));
    set((s) => (s.selection.kind === 'device' && s.selection.id === id ? { selection: { kind: 'canvas' } } : {}));
  },

  addText: (role) => {
    const t = makeText(role, { text: role === 'title' ? 'Ny overskrift' : role === 'body' ? 'Ny tekst' : 'Tekst', x: 120, y: 120 });
    commit(set, (d) => ({ ...d, texts: [...d.texts, t] }));
    set({ selection: { kind: 'text', id: t.id } });
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
}));
