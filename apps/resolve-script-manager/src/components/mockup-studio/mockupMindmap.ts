/**
 * mockupMindmap.ts — produkt-mind map (Mermaid-syntaks → tre → native render).
 *
 * «Setter hele perspektivet»: en mind map av produktet (sentral node → områder →
 * funksjoner) hjelper både brukeren og AI-en å forstå produktet. Vi bruker
 * Mermaid `mindmap`-syntaks som FORMAT (portabelt — kan limes inn i et hvilket
 * som helst Mermaid-verktøy), men RENDRER selv i merkevarens farger på lerretet
 * (ingen tung mermaid.js-avhengighet; følger med i alle eksporter).
 *
 * Parseren er ren/deterministisk (testbar uten AI).
 */

export interface MindNode {
  label: string;
  children: MindNode[];
}

/** Fjern Mermaid-node-dekor: `root((Tekst))`, `id[Tekst]`, `id(Tekst)`, `{Tekst}`. */
function cleanLabel(raw: string): string {
  let s = raw.trim();
  // id((label)) / id[label] / id(label) / id{label} → label
  const m = s.match(/^[\w-]*\s*[([{]{1,2}\s*([^)\]}]+?)\s*[)\]}]{1,2}$/);
  if (m) return m[1].trim();
  // ren tekst — dropp evt. ledende id-token «id text»? behold hele (mindmap tillater ren tekst)
  s = s.replace(/^["']|["']$/g, '');
  return s.trim();
}

/** Antall innrykk-nivåer (2 mellomrom eller tab = ett nivå). */
function indentOf(line: string): number {
  const m = line.match(/^(\s*)/);
  const ws = m ? m[1] : '';
  let cols = 0;
  for (const ch of ws) cols += ch === '\t' ? 2 : 1;
  return Math.floor(cols / 2);
}

/**
 * Parse Mermaid `mindmap`-syntaks til et tre. Robust mot manglende header,
 * varierende innrykk og node-dekor. Returnerer null hvis ingen noder.
 */
export function parseMermaidMindmap(src: string): MindNode | null {
  if (!src) return null;
  const lines = src.replace(/```mermaid/gi, '').replace(/```/g, '').split('\n')
    .filter((l) => l.trim() && !/^\s*mindmap\s*$/i.test(l) && !/^\s*%%/.test(l));
  if (lines.length === 0) return null;

  // Normaliser innrykk til nivåer (minste innrykk = rot-nivå).
  const rows = lines.map((l) => ({ level: indentOf(l), label: cleanLabel(l) })).filter((r) => r.label);
  if (rows.length === 0) return null;
  const minLevel = Math.min(...rows.map((r) => r.level));
  rows.forEach((r) => (r.level -= minLevel));

  // Første rad = rot. Bygg tre med innrykk-stakk.
  const root: MindNode = { label: rows[0].label, children: [] };
  const stack: { node: MindNode; level: number }[] = [{ node: root, level: rows[0].level }];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const node: MindNode = { label: r.label, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].level >= r.level) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, level: r.level });
  }
  return root;
}

/** Antall løv (for layout-vurdering). */
export function countLeaves(n: MindNode): number {
  return n.children.length === 0 ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0);
}

// ── AI: generér produkt-mind map fra en URL ─────────────────────────────────

import { claudeProxyService, isAiConnected, type ClaudeContentBlock } from '../../services/claudeProxyService';
import { gatherSiteContext } from '../demo-studio/demoStudioAI';
import { captureSiteShots, type CapturedShot } from './mockupCapture';

function imageBlock(dataUrl: string): ClaudeContentBlock | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/s);
  if (!m) return null;
  const media_type: 'image/png' | 'image/jpeg' = m[1] === 'image/png' ? 'image/png' : 'image/jpeg';
  return { type: 'image', source: { type: 'base64', media_type, data: m[2] } };
}

/** Trekk ut ren Mermaid-`mindmap`-kildekode fra en Claude-respons. */
export function extractMindmapSrc(text: string): string | null {
  if (!text) return null;
  let s = text.replace(/```mermaid/gi, '').replace(/```/g, '').trim();
  const i = s.search(/^\s*mindmap\b/im);
  if (i >= 0) s = s.slice(i);
  return /mindmap/i.test(s) || s.split('\n').length >= 2 ? s.trim() : null;
}

export function mindmapAiAvailable(): boolean {
  return isAiConnected();
}

/**
 * Be Claude lage en produkt-mind map (Mermaid `mindmap`) fra en URL: rot =
 * produktnavn, nivå 1 = hovedområder/moduler, nivå 2 = nøkkelfunksjoner. Leser
 * både skjermbilde (vision) og tekst. Returnerer ren Mermaid-kildekode.
 */
export async function aiProductMindmap(url: string, onStep?: (s: string) => void): Promise<string> {
  if (!isAiConnected()) {
    throw new Error('AI-proxyen er ikke tilkoblet. Logg inn (RR-token) i Innstillinger.');
  }
  onStep?.('Leser nettsiden…');
  const [ctxRes, shots] = await Promise.all([
    gatherSiteContext(url).catch(() => ({ context: '', pages: [] as string[] })),
    captureSiteShots(url).catch(() => [] as CapturedShot[]),
  ]);
  const context = (ctxRes.context || '').trim();
  const shot = shots.find((s) => s.viewport === 'desktop') ?? shots[0];
  if (context.length < 60 && !shot) {
    throw new Error('Fikk verken tekst eller skjermbilde fra nettsiden.');
  }

  onStep?.('Bygger mind map…');
  const prompt =
    `Lag en PRODUKT-MIND MAP av produktet basert på ` +
    (shot ? 'SKJERMBILDET' : 'teksten') + (context.length >= 60 ? ' og tekst-utdraget under' : '') + '.\n' +
    `Struktur: rot = produktnavn; nivå 1 = 4–6 hovedområder/moduler; nivå 2 = 1–3 ` +
    `nøkkelfunksjoner per område. KORTE norske etiketter (1–3 ord).\n\n` +
    (context.length >= 60 ? `TEKST-UTDRAG:\n${context.slice(0, 4000)}\n\n` : '') +
    `Svar med KUN gyldig Mermaid \`mindmap\`-kode (ingen forklaring, ingen code-fence), f.eks.:\n` +
    `mindmap\n  root((Produktnavn))\n    Område A\n      Funksjon 1\n      Funksjon 2\n    Område B\n      Funksjon 3`;

  const content: ClaudeContentBlock[] = [];
  if (shot) { const b = imageBlock(shot.dataUrl); if (b) content.push(b); }
  content.push({ type: 'text', text: prompt });

  const raw = await claudeProxyService.send({
    systemPrompt: 'Du lager knappe, presise produkt-mind maps i Mermaid mindmap-syntaks. Du kan lese en nettside fra et skjermbilde. Svar ALLTID med kun gyldig Mermaid-kode som starter med "mindmap".',
    messages: [{ role: 'user', content }],
    maxTokens: 500,
  });
  const src = extractMindmapSrc(raw);
  if (!src || !parseMermaidMindmap(src)) throw new Error('AI-svaret kunne ikke tolkes som en mind map.');
  onStep?.('Ferdig');
  return src;
}
