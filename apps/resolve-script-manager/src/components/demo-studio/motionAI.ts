/**
 * motionAI.ts — «Make it move»: la AI velge motion-arketype + skrive en slående
 * caption fra scene-data. Bruker den eksisterende claudeProxyService. Faller
 * ALLTID tilbake til heuristikken (pickArchetype) om AI ikke er koblet/feiler,
 * så knappen aldri blir en blindvei.
 */
import { claudeProxyService, isAiConnected } from '../../services/claudeProxyService';
import { pickArchetype, type Archetype } from './motionReveal.js';

const ARCHETYPES: Archetype[] = ['sting', 'stat', 'quote', 'compare', 'list'];

export interface MotionSuggestion {
  archetype: Archetype;
  caption?: string;
  eyebrow?: string;
  /** true om forslaget kom fra AI (ikke bare heuristikk-fallback). */
  fromAi: boolean;
}

/** Robust JSON-uttrekk (fence-strip + balansert klammeparser). */
function extractJson<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fence ? fence[1] : text).trim();
  try { return JSON.parse(body) as T; } catch { /* fall through */ }
  const start = body.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { try { return JSON.parse(body.slice(start, i + 1)) as T; } catch { return null; } } }
  }
  return null;
}

/**
 * Bygg AI-prompten (ren funksjon → testbar). Lister feltene + arketype-forklaring.
 */
export function buildMotionSuggestPrompt(values: Record<string, string>): string {
  const fields = Object.entries(values)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${String(v).trim()}`)
    .join('\n') || '(ingen felt)';
  return `Scene-data (felt → verdi):
${fields}

Velg BESTE motion-arketype for å animere disse dataene, og skriv en kort, slående caption (norsk, maks 6 ord). Dikt ALDRI opp tall.
Arketyper:
- sting: hero-tall + funnel (flere tall med stort sprang)
- stat: ETT stort tall + delta (én nøkkelmetrikk)
- quote: sitat + kilde (sitat-tekst)
- compare: barer som racer (2–4 sammenlignbare tall)
- list: punkter som kaskader (liste/tekst-tunge felt uten reelle tall)

Svar med KUN ett JSON-objekt: { "archetype": "sting|stat|quote|compare|list", "caption": "kort caption", "eyebrow": "valgfri liten label" }`;
}

/**
 * La AI foreslå arketype + caption. Fallback = pickArchetype-heuristikk.
 */
export async function aiSuggestMotion(
  values: Record<string, string>,
  ctx: { templateId?: string } = {},
): Promise<MotionSuggestion> {
  const fallback: MotionSuggestion = { archetype: pickArchetype(ctx.templateId || '', values), fromAi: false };
  if (!isAiConnected()) return fallback;
  try {
    const raw = await claudeProxyService.send({
      systemPrompt: 'Du er en data-visualiserings-regissør. Velg riktig animasjons-form for tall/tekst og skriv slående, ærlige captions. Dikt ALDRI opp tall. Svar ALLTID med kun ett JSON-objekt.',
      messages: [{ role: 'user', content: buildMotionSuggestPrompt(values) }],
      maxTokens: 220,
    });
    const p = extractJson<{ archetype?: string; caption?: string; eyebrow?: string }>(raw);
    const archetype = ARCHETYPES.includes(p?.archetype as Archetype) ? (p!.archetype as Archetype) : fallback.archetype;
    return {
      archetype,
      caption: (p?.caption || '').trim() || undefined,
      eyebrow: (p?.eyebrow || '').trim() || undefined,
      fromAi: true,
    };
  } catch {
    return fallback;
  }
}
