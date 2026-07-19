/**
 * mermaidArch.ts — ren parser: Mermaid `graph`/`flowchart` → arkitektur-struktur.
 *
 * Trekker ut subgraph-grupper + noder (label, undertekst, privacy-flagg) fra en
 * Mermaid-diagramtekst. Ignorerer kanter (-->/-.->/---), classDef og styling.
 * Frittstående (ingen deps) så den er testbar + gjenbrukbar av render-malen.
 */

import { techLogoSlug } from './techLogos.js';

export interface ArchNode { id: string; label: string; sub: string; privacy: boolean; logo: string }
export interface ArchGroup { id: string; icon: string; name: string; logo: string; nodes: ArchNode[] }
export interface ArchDiagram { title: string; groups: ArchGroup[]; ungrouped: ArchNode[] }

// Ledende emoji-klynge i en tittel («🖥️ Klientlag» → «🖥️» + «Klientlag»).
const EMOJI = /^([\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}][\u{FE00}-\u{FE0F}\u{200D}]*)\s*(.*)$/u;
function splitIcon(s: string): { icon: string; name: string } {
  const m = s.match(EMOJI);
  return m ? { icon: m[1], name: m[2].trim() } : { icon: '', name: s.trim() };
}

// Node-tekst «Label<br/>(sub1)<br/>sub2» → label + sub (parenteser strippet, · som skille).
function splitLabel(raw: string): { label: string; sub: string } {
  const parts = raw.split(/<br\s*\/?>/i).map((p) => p.replace(/^\(+|\)+$/g, '').trim()).filter(Boolean);
  const { icon, name } = splitIcon(parts[0] ?? '');
  return { label: (icon ? icon + ' ' : '') + name, sub: parts.slice(1).join(' · ') };
}

const SUBGRAPH_RE = /^\s*subgraph\s+(\w+)\s*\["?(.+?)"?\]\s*$/i;
const SUBGRAPH_BARE_RE = /^\s*subgraph\s+"?(.+?)"?\s*$/i;
// Node: <id> etterfulgt av [...] / [(...)] / (...) / {...} / [[...]] med "tekst".
const NODE_RE = /(\b\w[\w-]*)\s*(?:\[\(|\(\[|\[\[|\[|\(|\{)+\s*"?(.+?)"?\s*(?:\)\]|\]\)|\]\]|\]|\)|\})+/;
const CLASS_RE = /^\s*class\s+([\w,\s]+?)\s+(\w+)\s*$/i;

/** Parse en Mermaid-diagramtekst til en arkitektur-struktur. */
export function parseMermaidArch(text: string, title = 'Systemarkitektur'): ArchDiagram {
  const lines = (text ?? '').split(/\r?\n/);
  const groups: ArchGroup[] = [];
  const ungrouped: ArchNode[] = [];
  const byId = new Map<string, ArchNode>();
  const privacyClasses = new Set<string>(); // classDef-navn som markerer privacy/fare
  let cur: ArchGroup | null = null;

  const addNode = (id: string, raw: string, group: ArchGroup | null) => {
    if (byId.has(id)) return byId.get(id)!;
    const { label, sub } = splitLabel(raw);
    const node: ArchNode = { id, label, sub, privacy: false, logo: techLogoSlug(`${label} ${sub}`) };
    byId.set(id, node);
    (group ? group.nodes : ungrouped).push(node);
    return node;
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t || /^(graph|flowchart)\b/i.test(t) || /^classDef\b/i.test(t)) {
      // Privacy-heuristikk: classDef med rødlig fill → behandles som fare/privacy-node.
      const cd = t.match(/^classDef\s+(\w+)\b/i);
      if (cd && /fill:\s*#(8[0-9a-f]|9[0-9a-f]|a[0-9a-f]|b[0-7]|c0|dc|e7|red|maroon)/i.test(t)) privacyClasses.add(cd[1]);
      continue;
    }
    const sg = t.match(SUBGRAPH_RE) ?? t.match(SUBGRAPH_BARE_RE);
    if (sg) {
      const raw = sg.length === 3 ? sg[2] : sg[1];
      const id = sg.length === 3 ? sg[1] : raw;
      const { icon, name } = splitIcon(raw);
      cur = { id, icon, name, logo: techLogoSlug(name), nodes: [] };
      groups.push(cur);
      continue;
    }
    if (/^end\b/i.test(t)) { cur = null; continue; }
    const cls = t.match(CLASS_RE);
    if (cls) {
      const isPrivacy = privacyClasses.has(cls[2]) || /priv|danger|warn|red|secure/i.test(cls[2]);
      if (isPrivacy) cls[1].split(',').map((s) => s.trim()).forEach((id) => { const n = byId.get(id); if (n) n.privacy = true; });
      continue;
    }
    // Node-definisjoner (kan stå alene ELLER i en kant-linje som `A --> B`).
    // Trekk ut ALLE node-def-forekomster på linjen.
    const re = new RegExp(NODE_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) addNode(m[1], m[2], cur);
  }

  // Fjern tomme grupper (f.eks. subgraph uten node-def på egne linjer).
  return { title, groups: groups.filter((g) => g.nodes.length > 0), ungrouped };
}
