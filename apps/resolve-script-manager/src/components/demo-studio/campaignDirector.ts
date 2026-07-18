/**
 * campaignDirector.ts — «Kampanje-regissør».
 *
 * Nettside-bevis → en MÅL-DREVET, on-brand kampanje av N sosiale innlegg.
 * I motsetning til «lag 15 kort» regisserer dette en sesong: hver post har en
 * innholds-PILAR, PLATTFORM/format, en uke i en narrativ bue, ett verifisert
 * KPI-tall, navngitte HOOK-varianter (persuasjons-lever), caption + hashtags + CTA.
 *
 * Denne modulen er REN orkestrering (LLM + validering). Visuell brand (aksent/
 * logo/font) påføres når en post materialiseres til en infographic-scene — se
 * `campaignPostBrandCfg`. Frikoblet fra evidence-typen: tar en bevis-TEKST inn.
 */

import { claudeProxyService } from '../../services/claudeProxyService.js';
import type { InfographicBrand } from './infographicStudio.js';

export type CampaignGoal = 'awareness' | 'leads' | 'bookings' | 'trust';
export type ContentPillar = 'proof' | 'education' | 'social_proof' | 'offer' | 'story';
export type PostPlatform = 'tiktok' | 'reels' | 'stories' | 'feed' | 'youtube' | 'linkedin';
export type PostFormat = '9:16' | '4:5' | '1:1' | '16:9';

export const GOAL_LABELS: Record<CampaignGoal, string> = {
  awareness: 'Kjennskap', leads: 'Leads', bookings: 'Bookinger', trust: 'Tillit',
};
export const PILLAR_LABELS: Record<ContentPillar, string> = {
  proof: 'Bevis', education: 'Lærdom', social_proof: 'Sosialt bevis', offer: 'Tilbud', story: 'Story',
};
export const PLATFORM_LABELS: Record<PostPlatform, string> = {
  tiktok: 'TikTok', reels: 'IG Reels', stories: 'IG Stories', feed: 'IG Feed', youtube: 'YouTube', linkedin: 'LinkedIn',
};
// Native format per plattform (kan overstyres per post).
const PLATFORM_FORMAT: Record<PostPlatform, PostFormat> = {
  tiktok: '9:16', reels: '9:16', stories: '9:16', feed: '1:1', youtube: '16:9', linkedin: '4:5',
};

// Mål → hvilke pilarer som skal vektes tyngst (styrer miksen mot målet).
const GOAL_GUIDE: Record<CampaignGoal, string> = {
  awareness: 'Vekt oppmerksomhets-hooks og story; bred rekkevidde før konvertering.',
  leads: 'Vekt bevis + lærdom som viser verdi; hver post ender i en myk CTA.',
  bookings: 'Vekt tilbud + sosialt bevis; tydelig booking-CTA og hastverk mot slutten.',
  trust: 'Vekt sosialt bevis + story; bygg troverdighet før du ber om noe.',
};

export interface HookVariant { text: string; lever: string }
export interface CampaignPost {
  angle: string;                       // kort intern tittel
  pillar: ContentPillar;
  platform: PostPlatform;
  format: PostFormat;
  week: number;                        // 1..weeks (narrativ bue)
  kpi: { label: string; value: string }; // hoved-tallet — MÅ komme fra bevis-teksten
  hooks: HookVariant[];                // 1..3 varianter, lever-navngitt
  caption: string;
  hashtags: string[];
  cta: string;
}
export interface Campaign {
  goal: CampaignGoal;
  weeks: number;
  posts: CampaignPost[];
  pillarMix: Array<{ pillar: ContentPillar; share: number }>; // andel 0..1, synker
}

const PILLARS: ContentPillar[] = ['proof', 'education', 'social_proof', 'offer', 'story'];
const PLATFORMS_ALL: PostPlatform[] = ['tiktok', 'reels', 'stories', 'feed', 'youtube', 'linkedin'];

function clampInt(v: unknown, lo: number, hi: number, def: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : def;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], def: T): T {
  return (typeof v === 'string' && (allowed as readonly string[]).includes(v)) ? v as T : def;
}

/** Robust JSON-uttrekk (array- ELLER objekt-rot) fra en LLM-respons. */
export function extractJson<T>(text: string): T | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fence ? fence[1] : text).trim();
  try { return JSON.parse(body) as T; } catch { /* fall through */ }
  const sa = body.indexOf('['); const so = body.indexOf('{');
  const start = sa >= 0 && (so < 0 || sa < so) ? sa : so;
  if (start < 0) return null;
  const open = body[start]; const close = open === '[' ? ']' : '}';
  let depth = 0; let inStr = false; let esc = false;
  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { try { return JSON.parse(body.slice(start, i + 1)) as T; } catch { return null; } } }
  }
  return null;
}

/** Kvalitets-vokter: normaliser + dedup råe LLM-poster til gyldige CampaignPost. */
export function normalizePosts(raw: unknown, weeks: number): CampaignPost[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: CampaignPost[] = [];
  for (const r0 of arr) {
    const r = (r0 && typeof r0 === 'object') ? r0 as Record<string, unknown> : {};
    const kpi = (r.kpi && typeof r.kpi === 'object') ? r.kpi as Record<string, unknown> : {};
    const value = String(kpi.value ?? '').trim();
    const label = String(kpi.label ?? '').trim();
    if (!value || !label) continue; // ingen verifisert tall → drop (ikke dikt opp)
    const key = (label + '|' + value).toLowerCase();
    if (seen.has(key)) continue;    // dedup samme fakta
    seen.add(key);
    const platform = oneOf<PostPlatform>(r.platform, PLATFORMS_ALL, 'feed');
    const hooksRaw = Array.isArray(r.hooks) ? r.hooks : [];
    const hooks: HookVariant[] = hooksRaw
      .map((h) => (h && typeof h === 'object') ? h as Record<string, unknown> : {})
      .map((h) => ({ text: String(h.text ?? '').trim(), lever: String(h.lever ?? 'Hook').trim() }))
      .filter((h) => h.text)
      .slice(0, 3);
    if (!hooks.length) hooks.push({ text: String(r.angle ?? label).trim() || label, lever: 'Hook' });
    out.push({
      angle: String(r.angle ?? label).trim() || label,
      pillar: oneOf<ContentPillar>(r.pillar, PILLARS, 'proof'),
      platform,
      format: oneOf<PostFormat>(r.format, ['9:16', '4:5', '1:1', '16:9'], PLATFORM_FORMAT[platform]),
      week: clampInt(r.week, 1, weeks, 1),
      kpi: { label, value },
      hooks,
      caption: String(r.caption ?? '').trim(),
      hashtags: (Array.isArray(r.hashtags) ? r.hashtags : [])
        .map((t) => String(t).trim().replace(/^#?/, '#')).filter((t) => t.length > 1).slice(0, 6),
      cta: String(r.cta ?? '').trim(),
    });
  }
  return out;
}

/** Andel per pilar (0..1), synkende — for miks-baren. */
export function computePillarMix(posts: CampaignPost[]): Campaign['pillarMix'] {
  const n = posts.length || 1;
  const counts = new Map<ContentPillar, number>();
  for (const p of posts) counts.set(p.pillar, (counts.get(p.pillar) ?? 0) + 1);
  return [...counts.entries()]
    .map(([pillar, c]) => ({ pillar, share: c / n }))
    .sort((a, b) => b.share - a.share);
}

/** Visuell brand-config for en post (påføres når den materialiseres til scene). */
export function campaignPostBrandCfg(brand: InfographicBrand): { accent: string; ink: string; logo?: string } {
  return { accent: brand.accent, ink: brand.ink, logo: brand.logo };
}

export interface MaterializedPost { tplId: string; values: Record<string, string> }

/** Pilar → riktig sosial-mal + felt-verdier. Ren mapping (testbar); UI-en lager
 *  en scene fra dette og påfører brand (aksent/logo). Ukjente felt-nøkler
 *  ignoreres av malen, så over-setting er trygt. */
export function materializePost(p: CampaignPost, brandName = 'Merkevare'): MaterializedPost {
  const hook = (p.hooks[0]?.text || p.angle || p.kpi.label).replace(/^«|»$/g, '');
  switch (p.pillar) {
    case 'offer':
      return { tplId: 'social-announce', values: { kicker: 'TILBUD', title: p.angle || hook, subtitle: p.caption || hook, cta: p.cta || 'Book nå →' } };
    case 'social_proof':
      return { tplId: 'social-quote', values: { quote: p.caption || hook, author: brandName, role: '' } };
    case 'education':
      return { tplId: 'social-tips', values: { title: p.angle || hook, t1: hook, t2: p.caption, t3: p.cta } };
    default: // proof, story → stort tall
      return { tplId: 'social-stat', values: { kicker: p.kpi.label, value: p.kpi.value, label: p.angle || hook, support: p.caption } };
  }
}

export interface DeriveCampaignParams {
  /** Bevis-tekst fra nettside-analysen (Product Brain / one-pager). ENESTE tall-kilde. */
  evidenceText: string;
  brandName: string;
  /** Merkevare-stemme (tone-ord) — captions skal HØRES ut som dette. */
  brandVoice?: string;
  goal: CampaignGoal;
  count?: number;         // antall innlegg (default 15)
  weeks?: number;         // sesong-lengde (default 4)
  platforms?: PostPlatform[]; // plattform-miks (default alle)
  signal?: AbortSignal;
}

/** Generer en mål-drevet kampanje fra nettside-bevis. */
export async function deriveCampaign(params: DeriveCampaignParams): Promise<Campaign> {
  const count = clampInt(params.count, 3, 30, 15);
  const weeks = clampInt(params.weeks, 1, 8, 4);
  const platforms = (params.platforms && params.platforms.length ? params.platforms : PLATFORMS_ALL);

  const system = 'Du er en senior sosiale-medier-strateg. Du svarer ALLTID med KUN et gyldig JSON-array, ingen forklaring, ingen markdown-fence. Du dikter ALDRI opp tall — hvert KPI-tall må finnes i bevis-teksten.';
  const user = `Lag en MÅL-DREVET kampanje på ${count} sosiale innlegg over ${weeks} uker for «${params.brandName}».

MÅL: ${GOAL_LABELS[params.goal]} — ${GOAL_GUIDE[params.goal]}
MERKEVARE-STEMME (captions skal høres slik ut): ${params.brandVoice || 'tydelig, varm, konkret, norsk'}
TILLATTE PLATTFORMER: ${platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}

BEVIS (bruk KUN tall herfra — ikke dikt opp noe):
${params.evidenceText.slice(0, 3500)}

Krav til HVER post (JSON-objekt):
- "angle": kort intern tittel
- "pillar": én av proof|education|social_proof|offer|story (fordel så miksen passer målet)
- "platform": én av ${platforms.join('|')}
- "format": 9:16|4:5|1:1|16:9 (native for plattformen)
- "week": 1..${weeks} — bygg en narrativ bue: tidlig=teaser/oppmerksomhet, midt=bevis+story, sent=tilbud/konvertering
- "kpi": { "label": kort etikett, "value": tallet MED enhet — MÅ komme fra bevis }
- "hooks": 1–3 { "text": scroll-stoppende åpning på norsk, "lever": persuasjons-lever (f.eks. «Nysgjerrighets-gap», «Tap-aversjon», «Sosialt bevis», «Spesifisitet», «Mønsterbrudd») }
- "caption": kort caption i merkevare-stemmen
- "hashtags": 2–5 relevante
- "cta": tydelig oppfordring som passer målet

VIKTIG: ${count} DISTINKTE vinkler — hver post et UNIKT tall/vinkel, ingen gjentakelser. Svar med KUN JSON-array.`;

  const raw = await claudeProxyService.send({
    systemPrompt: system,
    messages: [{ role: 'user', content: user }],
    maxTokens: 4000,
    signal: params.signal,
  });
  let posts = normalizePosts(extractJson(raw), weeks);
  if (!posts.length) {
    // Én korrigerende retry — modeller pakker av og til i prosa/markdown.
    const raw2 = await claudeProxyService.send({
      systemPrompt: system,
      messages: [
        { role: 'user', content: user },
        { role: 'assistant', content: raw.slice(0, 300) },
        { role: 'user', content: 'Svaret var ikke et gyldig JSON-array av poster. Returner KUN JSON-arrayet, ingenting annet.' },
      ],
      maxTokens: 4000,
      signal: params.signal,
    });
    posts = normalizePosts(extractJson(raw2), weeks);
  }
  if (!posts.length) throw new Error('Kampanje-generering feilet — modellen returnerte ingen gyldige poster (prøv igjen).');

  posts = posts.slice(0, count).sort((a, b) => a.week - b.week);
  return { goal: params.goal, weeks, posts, pillarMix: computePillarMix(posts) };
}
