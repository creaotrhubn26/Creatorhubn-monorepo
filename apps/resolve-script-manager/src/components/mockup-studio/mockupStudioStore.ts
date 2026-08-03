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

  // Livssyklus
  newFromTemplate: (templateId: string) => void;
  setDocument: (doc: MockupDoc) => void;
  setName: (name: string) => void;

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
  return loadDoc() ?? buildTemplate('hero_mac_phone');
}

/** Sentral commit: skriv nytt doc til state + persister. */
function commit(set: (fn: (s: MockupStudioState) => Partial<MockupStudioState>) => void, mutate: (doc: MockupDoc) => MockupDoc) {
  set((s) => {
    const next = mutate(s.doc);
    saveDoc(next);
    return { doc: next };
  });
}

export const useMockupStudio = create<MockupStudioState>((set) => ({
  doc: initialDoc(),
  selection: { kind: 'canvas' },

  newFromTemplate: (templateId) => {
    const next = buildTemplate(templateId);
    saveDoc(next);
    set({ doc: next, selection: { kind: 'canvas' } });
  },

  setDocument: (next) => {
    saveDoc(next);
    set({ doc: next, selection: { kind: 'canvas' } });
  },

  setName: (name) => commit(set, (d) => ({ ...d, name })),

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
