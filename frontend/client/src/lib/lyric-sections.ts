/**
 * lyric-sections.ts
 * ───────────────────────────────────────────────────────────────────────────
 * Seksjons-modell for tekst, portet 1:1 fra EaseVerse (lib/lyrics-sections.ts +
 * app/(tabs)/lyrics.tsx). Samme header-tokens + auto-nummerering, slik at en
 * tekst skrevet i CreatorHub-studioet parses identisk i EaseVerse og omvendt.
 *
 * Tokens lagres på engelsk ([Verse]/[Chorus]/…) for kryss-app-kompatibilitet;
 * UI-en kan vise norske etiketter via NB_LABELS.
 */

export type SectionType =
  | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'final-chorus' | 'intro' | 'outro';

export const SECTION_BASE_LABELS: Record<SectionType, string> = {
  verse: 'Verse', 'pre-chorus': 'Pre-Chorus', chorus: 'Chorus', bridge: 'Bridge',
  'final-chorus': 'Final Chorus', intro: 'Intro', outro: 'Outro',
};

// Norske visnings-etiketter (lagret token forblir engelsk for kompatibilitet).
export const NB_LABELS: Record<SectionType, string> = {
  verse: 'Vers', 'pre-chorus': 'Pre-refreng', chorus: 'Refreng', bridge: 'Bro',
  'final-chorus': 'Siste refreng', intro: 'Intro', outro: 'Outro',
};

export const SECTION_COLORS: Record<SectionType, string> = {
  intro: '#d6457f', verse: '#3fa7d6', 'pre-chorus': '#8aa0b6', chorus: '#FF6B35',
  bridge: '#e0a955', 'final-chorus': '#e0606a', outro: '#5fb88a',
};

export const INSERT_SECTION_OPTIONS: { type: SectionType }[] = [
  { type: 'verse' }, { type: 'pre-chorus' }, { type: 'chorus' }, { type: 'bridge' },
  { type: 'final-chorus' }, { type: 'intro' }, { type: 'outro' },
];

const REPEATABLE = new Set<SectionType>(['verse', 'pre-chorus', 'chorus', 'bridge']);
const HEADER_PATTERN = /^(verse|pre[- ]?chorus|chorus|bridge|final[- ]?chorus|intro|outro)(?:\s+(\d+))?$/i;

export function parseSectionHeaderToken(line: string): { type: SectionType; explicitNumber: number | null } | null {
  let token = line.trim();
  if (!token) return null;
  if (token.startsWith('[') && token.endsWith(']')) token = token.slice(1, -1).trim();
  token = token.replace(/[:\-]+$/, '').trim();
  const match = token.match(HEADER_PATTERN);
  if (!match) return null;
  const raw = match[1].toLowerCase().replace(/\s+/g, '-');
  const type = (raw === 'prechorus' ? 'pre-chorus' : raw === 'finalchorus' ? 'final-chorus' : raw) as SectionType;
  if (!(type in SECTION_BASE_LABELS)) return null;
  return { type, explicitNumber: typeof match[2] === 'string' ? Number.parseInt(match[2], 10) : null };
}

export type SectionAnchor = {
  id: string; label: string; nbLabel: string; type: SectionType;
  cursor: number;      // tegn-offset til header-linjen
  lineIndex: number;   // 0-basert linjenummer for header
};

/** Parser eksplisitte [Section]-headere til ankere (med tegn-offset for scroll/seleksjon). */
export function buildSectionAnchors(text: string): SectionAnchor[] {
  const rawLines = text.split('\n');
  const hasHeaders = rawLines.some((l) => parseSectionHeaderToken(l) !== null);
  if (!hasHeaders) return [];

  const counters: Record<SectionType, number> = {
    verse: 0, 'pre-chorus': 0, chorus: 0, bridge: 0, 'final-chorus': 0, intro: 0, outro: 0,
  };
  const anchors: SectionAnchor[] = [];
  let cursor = 0;
  for (let i = 0; i < rawLines.length; i += 1) {
    const header = parseSectionHeaderToken(rawLines[i]);
    if (header) {
      const count = header.explicitNumber !== null ? header.explicitNumber : counters[header.type] + 1;
      counters[header.type] = Math.max(counters[header.type], count);
      const base = SECTION_BASE_LABELS[header.type];
      const nbBase = NB_LABELS[header.type];
      const suffix = REPEATABLE.has(header.type) && count > 1 ? ` ${count}` : '';
      anchors.push({
        id: `${header.type}-${count}-${cursor}`, label: `${base}${suffix}`, nbLabel: `${nbBase}${suffix}`,
        type: header.type, cursor, lineIndex: i,
      });
    }
    cursor += rawLines[i].length + (i < rawLines.length - 1 ? 1 : 0);
  }
  return anchors;
}

export type ParsedSection = { id: string; type: SectionType; label: string; nbLabel: string; lines: string[] };

/** Strukturert seksjonsliste (for «Struktur»-visning) — lik EaseVerse parseSongSections. */
export function parseSongSections(text: string): ParsedSection[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const hasHeaders = lines.some((l) => parseSectionHeaderToken(l) !== null);
  let idc = 0; const id = () => `s${idc++}`;

  if (hasHeaders) {
    const sections: ParsedSection[] = [];
    const counters: Record<SectionType, number> = { verse: 0, 'pre-chorus': 0, chorus: 0, bridge: 0, 'final-chorus': 0, intro: 0, outro: 0 };
    let curType: SectionType | null = null, curLabel = '', curNb = '', cur: string[] = [];
    const flush = () => { if (curType && cur.length) { sections.push({ id: id(), type: curType, label: curLabel, nbLabel: curNb, lines: [...cur] }); cur = []; } };
    for (const line of lines) {
      const h = parseSectionHeaderToken(line);
      if (h) {
        flush(); curType = h.type;
        const count = h.explicitNumber !== null ? (counters[h.type] = Math.max(counters[h.type], h.explicitNumber)) : (counters[h.type] += 1);
        const suffix = REPEATABLE.has(h.type) && count > 1 ? ` ${count}` : '';
        curLabel = `${SECTION_BASE_LABELS[h.type]}${suffix}`; curNb = `${NB_LABELS[h.type]}${suffix}`;
        continue;
      }
      if (!curType) { curType = 'verse'; counters.verse += 1; curLabel = counters.verse > 1 ? `Verse ${counters.verse}` : 'Verse'; curNb = counters.verse > 1 ? `Vers ${counters.verse}` : 'Vers'; }
      cur.push(line);
    }
    flush();
    return sections;
  }

  // Ingen eksplisitte headere → grupper hver 4. linje (vers/refreng/bro), som EaseVerse.
  const sections: ParsedSection[] = [];
  let cur: string[] = [], n = 0, v = 0;
  for (let i = 0; i < lines.length; i += 1) {
    cur.push(lines[i]);
    if (cur.length === 4 || i === lines.length - 1) {
      n += 1;
      const type: SectionType = n % 3 === 2 ? 'chorus' : n % 3 === 0 ? 'bridge' : 'verse';
      let label = SECTION_BASE_LABELS[type], nb = NB_LABELS[type];
      if (type === 'verse') { v += 1; label = v > 1 ? `Verse ${v}` : 'Verse'; nb = v > 1 ? `Vers ${v}` : 'Vers'; }
      sections.push({ id: id(), type, label, nbLabel: nb, lines: [...cur] });
      cur = [];
    }
  }
  return sections;
}

/** Token som settes inn i teksten (engelsk, EaseVerse-kompatibel). */
export function sectionInsertToken(type: SectionType): string {
  return `[${SECTION_BASE_LABELS[type]}]`;
}
