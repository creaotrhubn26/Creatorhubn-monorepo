// infographicLearning — ekte modelltrening for mal-velgeren: en ONLINE
// logistisk regresjon som lærer hvor mye hvert signal (tekst-match, egen aksept,
// egen bruk, KOLLEKTIV aksept fra alle brukere) forutsier at brukeren vil
// akseptere en mal. Vektene oppdateres per feedback (SGD) og lagres lokalt.
//
// Kollektiv del: signaler pushes anonymisert til backend og aggregater hentes
// INKREMENTELT (since-cursor) → modellen forbedres kontinuerlig av alle brukere,
// og henter kun det NYE.

import { loadSettings } from '../SettingsModal';

// ── Feature-vektor: [tekst-match, egen-aksept, egen-bruk, kollektiv-aksept] ──
export const FEATURE_DIM = 4;
export type Features = [number, number, number, number];

interface Model { w: number[]; b: number; n: number }
const MODEL_KEY = 'trrpa.infographicStudio.reranker';
// Fornuftige start-vekter (tekst-match teller mest) så modellen er nyttig FØR
// den har lært noe — og finjusteres av data over tid.
const DEFAULT_MODEL: Model = { w: [1.0, 0.5, 0.4, 0.3], b: 0, n: 0 };

function loadModel(): Model {
  try { const raw = localStorage.getItem(MODEL_KEY); if (raw) { const m = JSON.parse(raw) as Model; if (Array.isArray(m.w) && m.w.length === FEATURE_DIM) return m; } }
  catch { /* */ }
  return { ...DEFAULT_MODEL, w: [...DEFAULT_MODEL.w] };
}
function saveModel(m: Model): void { try { localStorage.setItem(MODEL_KEY, JSON.stringify(m)); } catch { /* */ } }

function sigmoid(z: number): number { return 1 / (1 + Math.exp(-z)); }

/** Lært aksept-sannsynlighet for en feature-vektor (0–1). */
export function learnedScore(f: Features): number {
  const m = loadModel();
  let z = m.b;
  for (let i = 0; i < FEATURE_DIM; i++) z += m.w[i] * f[i];
  return sigmoid(z);
}

/** Ett online SGD-steg: oppdater vektene mot label (1 = akseptert, 0 = avvist).
 *  L2-regularisering holder vektene stabile; lav learning rate = jevn læring. */
export function trainOnline(f: Features, label: number, lr = 0.08, l2 = 0.001): void {
  const m = loadModel();
  let z = m.b;
  for (let i = 0; i < FEATURE_DIM; i++) z += m.w[i] * f[i];
  const err = sigmoid(z) - label; // dL/dz for logistisk tap
  for (let i = 0; i < FEATURE_DIM; i++) m.w[i] -= lr * (err * f[i] + l2 * m.w[i]);
  m.b -= lr * err;
  m.n += 1;
  saveModel(m);
}

/** Hvor mange treningssteg modellen har sett (UI-indikator). */
export function modelSteps(): number { return loadModel().n; }

/** Navngitte features + gjeldende vs. start-vekt — for «Innsikt»-flaten så
 *  brukeren SER at modellen har lært (vektene har flyttet seg fra start). */
export function modelWeights(): { label: string; weight: number; base: number }[] {
  const m = loadModel();
  const labels = ['Tekst-match', 'Din aksept', 'Din bruk', 'Kollektiv aksept'];
  return labels.map((label, i) => ({ label, weight: m.w[i], base: DEFAULT_MODEL.w[i] }));
}

/** Topp-maler etter lokal kollektiv-vekt (leaderboard i «Innsikt»). */
export function collectiveLeaderboard(n = 8): { tplId: string; net: number }[] {
  return Object.entries(loadCollective())
    .map(([tplId, net]) => ({ tplId, net }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net))
    .slice(0, n);
}

export interface CollectiveInsight {
  total: number; contributors: number; templates: number; liked: number; disliked: number;
  top: { tplId: string; net: number; n: number }[]; now: string;
}
/** Hent aggregert bevis fra backend på at modellen lærer i drift (på tvers av
 *  ALLE brukere). Null når ikke innlogget / offline. */
export async function fetchInsight(): Promise<CollectiveInsight | null> {
  const b = bearer();
  if (!b) return null;
  try {
    const res = await fetch(`${baseUrl()}/api/role-room/infographic-signals/insight`, {
      headers: { Authorization: `Bearer ${b}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as CollectiveInsight;
  } catch { return null; }
}

// ── Kollektiv aksept (aggregert fra alle brukere, hentet inkrementelt) ──
const COLLECTIVE_KEY = 'trrpa.infographicStudio.collective';
const PUSH_QUEUE_KEY = 'trrpa.infographicStudio.pushQueue';
const PULL_CURSOR_KEY = 'trrpa.infographicStudio.pullCursor';

interface CollectiveMap { [tplId: string]: number } // netto-vekt per mal
function loadCollective(): CollectiveMap {
  try { const raw = localStorage.getItem(COLLECTIVE_KEY); return raw ? (JSON.parse(raw) as CollectiveMap) : {}; } catch { return {}; }
}
/** Normalisert kollektiv aksept for en mal (~−1..1) — feature til re-rangereren. */
export function collectiveScore(tplId: string): number {
  const net = loadCollective()[tplId] || 0;
  return Math.tanh(net / 5); // mettes så virale maler ikke dominerer
}

interface QueuedSignal { tplId: string; liked: boolean; weight: number; descHash?: string; sigId?: string }
function loadQueue(): QueuedSignal[] {
  try { const raw = localStorage.getItem(PUSH_QUEUE_KEY); return raw ? (JSON.parse(raw) as QueuedSignal[]) : []; } catch { return []; }
}
function saveQueue(q: QueuedSignal[]): void { try { localStorage.setItem(PUSH_QUEUE_KEY, JSON.stringify(q.slice(-500))); } catch { /* */ } }

/** Legg et signal i push-køen (sendes ved neste sync — inkrementelt). Tildeler en
 *  stabil sigId så en nettverks-retry (svar tapt → køen tømmes ikke) ikke dobbelt-
 *  teller signalet i det kollektive aggregatet (backend: ON CONFLICT DO NOTHING). */
export function queueSignal(s: QueuedSignal): void {
  const q = loadQueue();
  const sigId = s.sigId || `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  q.push({ ...s, sigId });
  saveQueue(q);
}

function baseUrl(): string {
  const s = loadSettings();
  const base = s.RR_POST_AGENT_BASE_URL || 'https://creatorhubn.com/api/post-agent';
  return base.replace(/\/api\/post-agent\/?$/, '');
}
function bearer(): string | null { return loadSettings().RR_BEARER_TOKEN?.trim() || null; }

/**
 * Synk med backend: (1) push køede signaler (kun det nye), (2) hent kollektive
 * aggregater INKREMENTELT (since forrige pull-cursor) og flett inn. Stille
 * no-op når ikke innlogget. Kalles ved studio-åpning + etter feedback.
 */
export async function syncCollective(): Promise<void> {
  const b = bearer();
  if (!b) return;
  const headers = { Authorization: `Bearer ${b}`, 'Content-Type': 'application/json' };
  const base = baseUrl();
  // 1) Push nye signaler i BATCHER på ≤200 (backendens MAX_BATCH — sender vi mer
  //    inserter den kun de første 200 men svarer ok → resten ville gått tapt). Etter
  //    hver vellykkede batch fjerner vi KUN de sendte (re-les kø + slice), så
  //    signaler som ble køet UNDER POST-en ikke overskrives av en blank saveQueue([]).
  const PUSH_BATCH = 200;
  try {
    for (let guard = 0; guard < 10; guard++) {
      const q = loadQueue();
      if (!q.length) break;
      const batch = q.slice(0, PUSH_BATCH);
      const res = await fetch(`${base}/api/role-room/infographic-signals`, { method: 'POST', headers, body: JSON.stringify({ signals: batch }) });
      if (!res.ok) break; // prøver igjen neste sync — behold hele køen
      saveQueue(loadQueue().slice(batch.length)); // fjern de sendte; behold evt. nye fra under POST-en
      if (batch.length < PUSH_BATCH) break; // køen var tømt
    }
  } catch { /* prøver igjen neste sync */ }
  // 2) Pull kollektive aggregater siden forrige cursor (inkrementelt).
  try {
    const since = (() => { try { return localStorage.getItem(PULL_CURSOR_KEY) || ''; } catch { return ''; } })();
    const url = `${base}/api/role-room/infographic-signals/collective${since ? `?since=${encodeURIComponent(since)}` : ''}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return;
    const json = (await res.json()) as { signals: Array<{ tplId: string; net: number }>; now: string };
    const map = loadCollective();
    for (const s of json.signals || []) map[s.tplId] = (map[s.tplId] || 0) + (Number(s.net) || 0);
    try { localStorage.setItem(COLLECTIVE_KEY, JSON.stringify(map)); if (json.now) localStorage.setItem(PULL_CURSOR_KEY, json.now); } catch { /* */ }
  } catch { /* */ }
}
