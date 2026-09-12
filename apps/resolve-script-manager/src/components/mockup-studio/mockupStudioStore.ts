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
  makeImage,
  PRESENTATIONS,
  CHANNEL_FORMATS,
  colsForAspect,
  gridCells,
  type GridOpts,
  type MockupImageSlot,
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
import { rasterizeMockup } from './mockupRaster';
import { type LibraryMeta, idbAllMeta, idbDelete, idbPatchMeta, idbGetFull } from './mockupLibraryDb';

/** Hva som er valgt i editoren (styrer inspektør-panelet). */
export type Selection =
  | { kind: 'canvas' }
  | { kind: 'device'; id: string }
  | { kind: 'text'; id: string }
  | { kind: 'image'; id: string };

interface MockupStudioState {
  doc: MockupDoc;
  selection: Selection;
  /** Angre/gjør-om-stakker (fulle doc-snapshots). */
  past: MockupDoc[];
  future: MockupDoc[];
  /** Delt playhead (0..1, eller null = ikke i animert forhåndsvisning) — eid av MockupCanvas sin
   *  scrubber, lest av MockupKeyframeGraph i inspektøren så kurve-editoren følger playheaden i
   *  stedet for å stå isolert. Ephemeral UI-state, IKKE del av doc (ingen undo/redo/persistens). */
  playT: number | null;
  setPlayT: (t: number | null | ((prev: number | null) => number | null)) => void;

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

  // Frittstående bilde-elementer
  addImage: (image: string, partial?: Partial<MockupImageSlot>) => void;
  patchImage: (id: string, patch: Partial<MockupImageSlot>) => void;
  removeImage: (id: string) => void;
  duplicateImage: (id: string) => void;

  // Lag-rekkefølge (z): tegner i array-rekkefølge — flytt et element fram/bak.
  reorderElement: (kind: 'device' | 'text' | 'image', id: string, dir: 'up' | 'down') => void;
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
  /** Last full-res fra IDB → tildel valgt enhet, sett bakgrunn, ellers frittstående bilde (evt. på drop-posisjon). */
  placeLibraryImage: (id: string, target?: 'device' | 'background', at?: { x: number; y: number }) => Promise<void>;
  /** Legg flere bibliotek-bilder på lerretet i en valgt fremvisning (galleri): rutenett/rad/hero/kollasje/historie. */
  arrangeLibrary: (items: { assetId: string; label?: string; price?: string }[], presetId: string, opts?: GridOpts & { radius?: number; showLabels?: boolean; showPrices?: boolean; labelSize?: number; labelColor?: string }) => Promise<void>;
  /** Snarvei: fremvisning 'grid' (bakoverkompatibel). */
  arrangeLibraryGrid: (items: { assetId: string; label?: string; price?: string }[], opts?: GridOpts & { radius?: number; showLabels?: boolean; showPrices?: boolean; labelSize?: number; labelColor?: string }) => Promise<void>;
  /** Ett-klikk: bygg en komplett one-pager (grid m/ labels + overskrift + brand) fra valgte bilder. */
  buildOnePager: (items: { assetId: string; label?: string; price?: string }[], opts?: { title?: string; eyebrow?: string; accent?: string; titleColor?: string; labelColor?: string; showPrices?: boolean }) => Promise<void>;
  /** Live av/på for pris-delen i alle arrange-labels (uten å bygge på nytt). */
  setArrangeShowPrices: (on: boolean) => void;
  /** Ett-klikk «Craveable Reel»: 9:16 + warmth + push-in + beat-punch + 2-kol grid m/ pris-count-up. */
  buildCraveableReel: (items: { assetId: string; label?: string; price?: string }[], opts?: { title?: string; eyebrow?: string; accent?: string; titleColor?: string; labelColor?: string; showPrices?: boolean; bpm?: number }) => Promise<void>;
  /** «Én design → alle kanaler»: re-layout gjeldende design per kanal-format → PNG-dataURL per kanal. */
  renderChannelSet: () => Promise<{ id: string; label: string; w: number; h: number; dataUrl: string }[]>;
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
  playT: null,
  setPlayT: (v) => set((s) => ({ playT: typeof v === 'function' ? v(s.playT) : v })),

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

  // Frittstående bilde-elementer
  addImage: (image, partial) => {
    const n = get().doc.images?.length ?? 0;
    const off = (n % 8) * 36; // cascade så flere plasseringer ikke stables oppå hverandre
    const im = makeImage(image, { x: 200 + off, y: 200 + off, ...partial });
    commit(set, (d) => ({ ...d, images: [...(d.images ?? []), im] }));
    set({ selection: { kind: 'image', id: im.id } });
  },
  patchImage: (id, patch) => commit(set, (d) => ({ ...d, images: (d.images ?? []).map((im) => (im.id === id ? { ...im, ...patch } : im)) })),
  removeImage: (id) => { commit(set, (d) => ({ ...d, images: (d.images ?? []).filter((im) => im.id !== id) })); set({ selection: { kind: 'canvas' } }); },
  duplicateImage: (id) => {
    const src = get().doc.images?.find((im) => im.id === id);
    if (!src) return;
    const copy = { ...src, id: uid('img'), x: src.x + 32, y: src.y + 32 };
    commit(set, (d) => ({ ...d, images: [...(d.images ?? []), copy] }));
    set({ selection: { kind: 'image', id: copy.id } });
  },

  reorderElement: (kind, id, dir) => commit(set, (d) =>
    kind === 'device'
      ? { ...d, devices: reorder(d.devices, id, dir) }
      : kind === 'image'
        ? { ...d, images: reorder(d.images ?? [], id, dir) }
        : { ...d, texts: reorder(d.texts, id, dir) }),

  duplicateSelected: () => {
    const s = get().selection;
    if (s.kind === 'device') get().duplicateDevice(s.id);
    else if (s.kind === 'text') get().duplicateText(s.id);
    else if (s.kind === 'image') get().duplicateImage(s.id);
  },

  addAnnotation: (kind, deviceId) => {
    const dev = deviceId ?? get().doc.devices[0]?.id;
    commit(set, (d) => {
      const nextN = (d.annotations?.filter((x) => x.kind === kind).length ?? 0) + 1;
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

  // ── Prosjekt-bibliotek ─────────────────────────────────────────────────────  // (test-modus-eksponering nederst i fila)
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
  placeLibraryImage: async (id, target, at) => {
    const full = await idbGetFull(id);
    if (!full) return;
    const sel = get().selection;
    if (target === 'background') get().patchCanvas({ bgImage: full });
    else if (!at && sel.kind === 'device') get().setDeviceImage(sel.id, full);
    else get().addImage(full, at ? { x: Math.round(at.x - 260), y: Math.round(at.y - 180) } : undefined); // frittstående (senter på drop-punkt)
  },

  // Legg N bibliotek-bilder på lerretet i en valgt fremvisning (galleri). Ett kall bygger alt.
  arrangeLibrary: async (items, presetId, opts) => {
    if (!items.length) return;
    const preset = PRESENTATIONS.find((pr) => pr.id === presetId) ?? PRESENTATIONS[0];
    // Rydd forrige galleri-arrangement (genArrange-eide bilder + labels) → ingen stabling ved bytte.
    const cur = get().doc;
    get().pushHistory();
    get().setDocSilent({ ...cur, images: (cur.images ?? []).filter((im) => !im.genArrange), texts: cur.texts.filter((t) => !t.genArrange) });
    const canvas = get().doc.canvas;
    const cells = preset.layout(items.length, canvas.w, canvas.h, opts);
    const showLabels = opts?.showLabels ?? items.some((it) => !!it.label || !!it.price);
    const showPrices = opts?.showPrices ?? true;
    const labelSize = opts?.labelSize ?? 30;
    const labelH = showLabels ? Math.round(labelSize * 1.35) : 0;
    for (let i = 0; i < items.length; i++) {
      const c = cells[i]; if (!c) continue;
      const rotated = c.rotation != null;
      await get().placeLibraryImage(items[i].assetId); // legger fritt bilde + selecter det
      const sel = get().selection;
      if (sel.kind === 'image') get().patchImage(sel.id, { x: c.x, y: c.y, w: c.w, h: rotated ? c.h : c.h - labelH, radius: opts?.radius ?? 18, shadow: true, fit: 'cover', rotation: c.rotation ?? 0, genArrange: true });
      const base = items[i].label, price = items[i].price;
      if (!rotated && labelH && (base || price)) {
        const text = (base ?? '') + (showPrices && price ? ` · ${price}` : '');
        get().addText('tag');
        const ts = get().selection;
        if (ts.kind === 'text') get().patchText(ts.id, { text, baseText: base, priceText: price, x: c.x, y: c.y + (c.h - labelH) + 6, w: c.w, size: labelSize, weight: 700, color: opts?.labelColor ?? '#1A1A1A', align: 'left', genArrange: true });
      }
    }
    get().select({ kind: 'canvas' });
  },
  arrangeLibraryGrid: (items, opts) => get().arrangeLibrary(items, 'grid', opts),

  // Live av/på for pris-delen i alle arrange-labels (bruker lagret baseText/priceText).
  setArrangeShowPrices: (on) => commit(set, (d) => ({
    ...d,
    texts: d.texts.map((t) => (t.genArrange && t.baseText != null
      ? { ...t, text: t.baseText + (on && t.priceText ? ` · ${t.priceText}` : '') }
      : t)),
  })),

  // Én design → alle kanaler: re-layout innholdet per format (kolonner etter aspekt) → PNG per kanal.
  renderChannelSet: async () => {
    const doc = get().doc;
    const arrangeImgs = (doc.images ?? []).filter((im) => im.genArrange);
    const src = arrangeImgs.length ? arrangeImgs : (doc.images ?? []);
    const labels = doc.texts.filter((t) => t.genArrange && t.baseText != null);
    const title = doc.texts.find((t) => t.role === 'title' && !t.genArrange);
    const eyebrow = doc.texts.find((t) => t.role === 'eyebrow' && !t.genArrange);
    const out: { id: string; label: string; w: number; h: number; dataUrl: string }[] = [];
    for (const fmt of CHANNEL_FORMATS) {
      const cols = colsForAspect(fmt.w, fmt.h);
      const top = Math.round(fmt.h * (title ? 0.2 : 0.06));
      const cells = gridCells(src.length, fmt.w, fmt.h, { top, cols });
      const labelH = labels.length ? Math.round(Math.min(fmt.w, fmt.h) * 0.03) : 0;
      const images: MockupImageSlot[] = src.map((im, i) => (cells[i] ? { ...im, x: cells[i].x, y: cells[i].y, w: cells[i].w, h: cells[i].h - labelH, rotation: 0 } : im));
      const texts: MockupTextSlot[] = [];
      if (eyebrow) texts.push({ ...eyebrow, x: Math.round(fmt.w * 0.05), y: Math.round(fmt.h * 0.05), w: Math.round(fmt.w * 0.7) });
      if (title) texts.push({ ...title, x: Math.round(fmt.w * 0.05), y: Math.round(fmt.h * 0.085), w: Math.round(fmt.w * 0.9), size: Math.round(Math.min(fmt.w, fmt.h) * 0.08) });
      labels.forEach((lb, i) => { if (cells[i]) texts.push({ ...lb, x: cells[i].x, y: cells[i].y + (cells[i].h - labelH) + 6, w: cells[i].w, size: Math.max(14, Math.round(labelH * 0.6)) }); });
      const cdoc: MockupDoc = { ...doc, canvas: { ...doc.canvas, w: fmt.w, h: fmt.h }, images, texts, timeline: undefined };
      const scale = Math.min(1, 1200 / Math.max(fmt.w, fmt.h));
      const cv = await rasterizeMockup(cdoc, scale);
      out.push({ id: fmt.id, label: fmt.label, w: fmt.w, h: fmt.h, dataUrl: cv.toDataURL('image/png') });
    }
    return out;
  },

  // Ett-klikk one-pager: brand + grid m/ pris-labels + eyebrow + tittel.
  buildOnePager: async (items, opts) => {
    const H = get().doc.canvas.h;
    get().patchCanvas(opts?.accent ? { background: 'light', accent: opts.accent } : { background: 'light' });
    await get().arrangeLibrary(items, 'grid', { top: Math.round(H * 0.22), showLabels: true, showPrices: opts?.showPrices ?? true, labelColor: opts?.labelColor ?? '#1A1A1A' });
    if (opts?.eyebrow) {
      get().addText('eyebrow');
      const s = get().selection;
      if (s.kind === 'text') get().patchText(s.id, { text: opts.eyebrow, x: 60, y: Math.round(H * 0.06), w: 1000, size: 30, color: 'accent' });
    }
    get().addText('title');
    const st = get().selection;
    if (st.kind === 'text') get().patchText(st.id, { text: opts?.title ?? 'Meny', x: 60, y: Math.round(H * 0.10), w: 1200, size: 88, weight: 800, color: opts?.titleColor ?? '#1A1A1A' });
    get().select({ kind: 'canvas' });
  },

  // Ett-klikk «Craveable Reel»: 9:16 + craveable motion-resept + 2-kol grid m/ pris-count-up.
  buildCraveableReel: async (items, opts) => {
    if (!items.length) return;
    const story = MOCKUP_FORMATS.find((f) => f.id === 'story') ?? { id: 'story', label: 'Story', w: 1080, h: 1920 };
    get().applyFormat(story);
    const W = get().doc.canvas.w, H = get().doc.canvas.h;
    get().patchCanvas({ background: 'light', warmth: 0.6, pushIn: 0.5, bpm: opts?.bpm ?? 120, beatPunch: 0.6, ...(opts?.accent ? { accent: opts.accent } : {}) });
    await get().arrangeLibrary(items, 'grid', { cols: 2, top: Math.round(H * 0.16), showLabels: true, showPrices: opts?.showPrices ?? true, labelColor: opts?.labelColor ?? '#1A1A1A' });
    if (opts?.eyebrow) {
      get().addText('eyebrow');
      const s = get().selection;
      if (s.kind === 'text') get().patchText(s.id, { text: opts.eyebrow, x: Math.round(W * 0.05), y: Math.round(H * 0.05), w: Math.round(W * 0.85), size: 34, color: 'accent' });
    }
    get().addText('title');
    const st = get().selection;
    if (st.kind === 'text') get().patchText(st.id, { text: opts?.title ?? 'Meny', x: Math.round(W * 0.05), y: Math.round(H * 0.085), w: Math.round(W * 0.9), size: Math.round(W * 0.095), weight: 800, color: opts?.titleColor ?? '#1A1A1A' });
    get().select({ kind: 'canvas' });
  },
}));

// Test-modus: eksponer storen for Playwright-E2E (programmatisk oppbygging av dokumenter).
// Umulig i native/prod (browserTauriShim setter aldri __BROWSER_TEST__ der ekte Tauri finnes).
if (typeof window !== 'undefined' && (window as unknown as { __BROWSER_TEST__?: boolean }).__BROWSER_TEST__) {
  (window as unknown as { __mockupStore?: typeof useMockupStudio }).__mockupStore = useMockupStudio;
}
