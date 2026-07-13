// design-suggest.ts — AI-drevne design-forslag for ett element (CreatorHub Design).
// Kaller Claude med element-konteksten og returnerer strukturerte forslag. Hver `apply` valideres
// mot samme prop/verdi-allowlist som per-element-editoren, så forslag er TRYGGE + forhåndsvisbare.
import Anthropic from '@anthropic-ai/sdk';
import { logAIUsage } from './ai-usage-tracker.js';

const MODEL = process.env.DESIGN_SUGGEST_MODEL || 'claude-haiku-4-5-20251001';

let cachedClient: Anthropic | null | undefined;
function getAnthropic(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  cachedClient = apiKey && apiKey.trim() ? new Anthropic({ apiKey }) : null;
  return cachedClient;
}

// Samme trygge props/verdier som elementEdits → et forslags `apply` kan brukes direkte.
const ALLOWED_PROPS = new Set(['color', 'background-color', 'background', 'font-size', 'font-weight',
  'border-radius', 'padding', 'margin', 'letter-spacing', 'text-align', 'box-shadow', 'border', 'opacity']);
const VAL_RE = /^[A-Za-z0-9#,.()%\-\s/]{0,120}$/;

export type ElementContext = {
  tag?: string; role?: string; text?: string; workspace?: string; accent?: string;
  color?: string; background?: string; fontSize?: string; fontWeight?: string; borderRadius?: string; padding?: string;
  width?: number; height?: number;
};
export type DesignSuggestion = { text: string; apply?: { prop: string; value: string } };

export type SlotInput = { id: string; label: string };
export type SourceInput = { key: string; label?: string; type?: string };

/** AI-slot-mapping: koble en komponents data-slots til de best passende datakildene (semantisk match).
 *  Validerer at hver mappet nøkkel finnes i den oppgitte kilde-lista — aldri blind tillit til LLM. */
export async function mapSlotsToSources(slots: SlotInput[], sources: SourceInput[]): Promise<{ mapping: Record<string, string>; error?: string }> {
  const client = getAnthropic();
  if (!client) return { mapping: {}, error: 'AI utilgjengelig (mangler ANTHROPIC_API_KEY).' };
  if (!slots.length || !sources.length) return { mapping: {} };
  const validKeys = new Set(sources.map((s) => s.key));
  const prompt = `Du kobler data-slots i en design-komponent til datakilder. Velg den BESTE kilden for hvert slot basert på semantisk match (navn/etikett/type).

Slots:
${slots.map((s) => `- ${s.id}: "${s.label}"`).join('\n')}

Tilgjengelige kilder:
${sources.map((s) => `- ${s.key}${s.label ? ` (${s.label})` : ''}${s.type ? ` [${s.type}]` : ''}`).join('\n')}

Svar KUN med JSON, ingen tekst utenfor: {"mapping":{"<slot-id>":"<kilde-nøkkel>"}}. Bruk KUN kilde-nøkler fra lista. Utelat slots uten en god match.`;
  try {
    const response = await client.messages.create({ model: MODEL, max_tokens: 500, temperature: 0.2, messages: [{ role: 'user', content: prompt }] });
    logAIUsage(response as any, { feature: 'creatorhub-design/map-slots' }).catch(() => undefined);
    const block = response.content[0];
    if (!block || block.type !== 'text') return { mapping: {} };
    const raw = block.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { mapping: {}, error: 'Kunne ikke tolke AI-svaret.' }; }
    const m = (parsed as { mapping?: Record<string, unknown> }).mapping || {};
    const out: Record<string, string> = {};
    for (const [slotId, key] of Object.entries(m)) {
      if (typeof key === 'string' && validKeys.has(key) && /^[A-Za-z0-9_-]{1,40}$/.test(slotId)) out[slotId] = key;
    }
    return { mapping: out };
  } catch (e) {
    return { mapping: {}, error: e instanceof Error ? e.message : 'AI-feil' };
  }
}

export async function generateDesignSuggestions(ctx: ElementContext): Promise<{ suggestions: DesignSuggestion[]; error?: string }> {
  const client = getAnthropic();
  if (!client) return { suggestions: [], error: 'AI utilgjengelig (mangler ANTHROPIC_API_KEY).' };

  const text = (ctx.text || '').slice(0, 200);
  const prompt = `Du er en senior UI/UX-designer. Vurder ETT element på en ${ctx.workspace || 'CreatorHub'}-flate og foreslå konkrete forbedringer (visuelt hierarki, kontrast, spacing, typografi, CTA-styrke, merkevare-koherens).

Element:
- tag: ${ctx.tag || '?'}${ctx.role ? ` (role=${ctx.role})` : ''}
- tekst: "${text}"
- farge: ${ctx.color || '?'} / bakgrunn: ${ctx.background || '?'}
- font: ${ctx.fontSize || '?'} vekt ${ctx.fontWeight || '?'} / radius: ${ctx.borderRadius || '?'} / padding: ${ctx.padding || '?'}
- størrelse: ${ctx.width || '?'}×${ctx.height || '?'}px
- merkevare-aksent: ${ctx.accent || '?'}

Gi maks 5 forslag. Svar KUN med gyldig JSON, ingen tekst utenfor:
{"suggestions":[{"text":"kort norsk forklaring på HVA og HVORFOR","apply":{"prop":"css-prop","value":"css-verdi"}}]}
"apply" er VALGFRI — ta den kun med når forslaget kan uttrykkes som ÉN konkret CSS-endring. Tillatte prop: color, background-color, font-size, font-weight, border-radius, padding, letter-spacing, box-shadow, border. For rene copy/hierarki-råd, dropp "apply".`;

  try {
    const response = await client.messages.create({
      model: MODEL, max_tokens: 800, temperature: 0.4,
      messages: [{ role: 'user', content: prompt }],
    });
    logAIUsage(response as any, { feature: 'creatorhub-design/suggest' }).catch(() => undefined);
    const block = response.content[0];
    if (!block || block.type !== 'text') return { suggestions: [] };
    // Trekk ut JSON (strip evt. ```-gjerder).
    const raw = block.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return { suggestions: [], error: 'Kunne ikke tolke AI-svaret.' }; }
    const arr = (parsed as { suggestions?: unknown }).suggestions;
    if (!Array.isArray(arr)) return { suggestions: [] };
    const out: DesignSuggestion[] = [];
    for (const s of arr.slice(0, 6)) {
      const so = s as { text?: unknown; apply?: { prop?: unknown; value?: unknown } };
      if (typeof so.text !== 'string' || !so.text.trim()) continue;
      const item: DesignSuggestion = { text: so.text.slice(0, 240) };
      const ap = so.apply;
      if (ap && typeof ap.prop === 'string' && ALLOWED_PROPS.has(ap.prop)
        && typeof ap.value === 'string' && VAL_RE.test(ap.value) && !/url\(/i.test(ap.value)) {
        item.apply = { prop: ap.prop, value: ap.value };
      }
      out.push(item);
    }
    return { suggestions: out };
  } catch (e) {
    return { suggestions: [], error: e instanceof Error ? e.message : 'AI-feil' };
  }
}
