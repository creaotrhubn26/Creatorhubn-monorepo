/**
 * role-room-newsletter-ai-routes.ts
 *
 * Claude-assistert generering for Norwegian Casting Brief:
 *   POST /api/admin-room/newsletter/role-room/ai/subject-lines
 *     → returnerer 3-5 subject-forslag for et utkast
 *   POST /api/admin-room/newsletter/role-room/ai/first-draft
 *     → genererer block-array fra en kort prompt eller LinkedIn-post
 *   POST /api/admin-room/newsletter/role-room/ai/rewrite-block
 *     → omskriver én tekst-blokk (tone: shorter / sharper / friendlier)
 *   POST /api/admin-room/newsletter/role-room/ai/content-score
 *     → analyserer hele utkastet og gir score 0-100 + konkrete forbedringer
 *
 * Alle endpoints er admin-gated. Bruker eksisterende ANTHROPIC_API_KEY.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString } from "./_shared";

let cachedClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

const MODEL = process.env.NEWSLETTER_AI_MODEL || "claude-opus-4-7";

const SYSTEM_VOICE = `Du skriver for "Norwegian Casting Brief" — et ukentlig norskspråklig nyhetsbrev fra The Role Room (theroleroom.com) for filmskapere, castingansvarlige, regissører og produsenter i Norge.

TONE:
- Konkret, direkte, uten konsulent-jargong
- Gir alltid en eksempel-/case-/data-anker
- Aldri "passing thoughts" eller "tankevekkende refleksjoner"
- Bransje-intern stemme — antar leseren kjenner norske filmprodukseter, NFI, Skuda, NSF, casting-tekniske begreper

OUTPUT-KONTRAKT:
- Norsk bokmål (med mindre eksplisitt instruksjon om engelsk)
- Bruker bransje-termer riktig (cast-leder = casting director, ikke "casting-leder"; selvtape, ikke "selv-tape")
- Ingen emojis i body-tekst (kun i subject-lines hvis bedt om)
- Aldri overdrive ("denne ENDRER ALT!" → "denne flytter mønsteret")`;

interface NewsletterBlockOut {
  id: string;
  type: "header" | "text" | "image" | "cta" | "divider" | "quote";
  [key: string]: unknown;
}

function genId(): string {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function callClaude(args: { system?: string; user: string; maxTokens?: number; jsonMode?: boolean }): Promise<string> {
  const client = getAnthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: args.maxTokens ?? 2048,
    system: args.system ?? SYSTEM_VOICE,
    messages: [{ role: "user", content: args.user }],
  });
  const block = response.content[0];
  if (block?.type === "text") return block.text;
  return "";
}

function safeParseJson<T>(raw: string): T | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

export function setupNewsletterAiRoutes(deps: AdminRoomRoutesDeps): void {
  const { app, requireAdminRoomAccess } = deps;

  // 1. Subject lines — 5 forslag
  app.post("/api/admin-room/newsletter/role-room/ai/subject-lines", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title) ?? "";
    const summary = asString(body.summary) ?? asString(body.bodyMarkdown)?.slice(0, 2000) ?? "";
    if (!title && !summary) {
      res.status(400).json({ error: "title eller summary er påkrevd" });
      return;
    }
    try {
      const raw = await callClaude({
        user: `Generér 5 SUBJECT-LINES på norsk for denne newsletter-utgaven av Norwegian Casting Brief.
Hver maks 60 tegn. Variér tone: 1) tall/data-drevet, 2) provoserende spørsmål, 3) konkret nytte, 4) navngitt person/produksjon, 5) kontroversielt poeng.

UTGAVE-TITTEL: ${title}
SAMMENDRAG/UTKAST: ${summary.slice(0, 2000)}

Returnér KUN gyldig JSON: { "subjects": [{ "text": "...", "rationale": "kort begrunnelse på 1 setning" }, ...] }`,
        maxTokens: 800,
      });
      const parsed = safeParseJson<{ subjects: Array<{ text: string; rationale: string }> }>(raw);
      if (!parsed?.subjects) {
        res.status(502).json({ error: "Kunne ikke parse Claude-respons", raw });
        return;
      }
      res.json({ subjects: parsed.subjects.slice(0, 5) });
    } catch (err) {
      console.error("[newsletter-ai] subject-lines error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 2. First draft — generér block-array fra en prompt
  app.post("/api/admin-room/newsletter/role-room/ai/first-draft", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const prompt = asString(body.prompt) ?? "";
    if (!prompt) {
      res.status(400).json({ error: "prompt er påkrevd" });
      return;
    }
    try {
      const raw = await callClaude({
        user: `Skriv et førsteutkast til Norwegian Casting Brief basert på denne briefen fra Daniel:

"""
${prompt}
"""

STRUKTUR (følg eksakt):
1. Ett kort H1-header (utgavens tittel — 5-9 ord)
2. Én "lead"-tekstblokk (40-60 ord, skarp åpningstese)
3. H2 "The data point" + tekstblokk med 1 konkret statistikk fra norsk produksjon (oppfinn realistisk hvis ikke gitt)
4. H2 "Founder POV" + tekstblokk (60-100 ord — én tese, ett poeng)
5. H2 "Behind the cast" + quote-block (anonymt sitat 1-2 setninger)
6. H2 "The risk" + tekstblokk (1 juridisk/bransje-endring)
7. Divider
8. Tekstblokk med liten CTA-tekst som peker til theroleroom.com

Returnér KUN gyldig JSON med denne strukturen:
{
  "title": "tittel-string",
  "blocks": [
    { "type": "header", "level": 1, "text": "..." },
    { "type": "text", "markdown": "..." },
    { "type": "header", "level": 2, "text": "..." },
    { "type": "text", "markdown": "..." },
    { "type": "quote", "text": "...", "attribution": "..." },
    { "type": "divider" }
  ]
}`,
        maxTokens: 3000,
      });
      const parsed = safeParseJson<{ title: string; blocks: NewsletterBlockOut[] }>(raw);
      if (!parsed?.blocks) {
        res.status(502).json({ error: "Kunne ikke parse Claude-respons", raw });
        return;
      }
      const blocksWithIds = parsed.blocks.map((b) => ({ ...b, id: genId() }));
      res.json({ title: parsed.title, blocks: blocksWithIds });
    } catch (err) {
      console.error("[newsletter-ai] first-draft error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 3. Rewrite block — bytt tone på én tekstblokk
  app.post("/api/admin-room/newsletter/role-room/ai/rewrite-block", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const original = asString(body.text) ?? "";
    const tone = asString(body.tone) ?? "sharper";
    if (!original) {
      res.status(400).json({ error: "text er påkrevd" });
      return;
    }
    const toneInstructions: Record<string, string> = {
      shorter: "Halver lengden uten å miste hovedpoenget. Behold den konkrete forankringen.",
      sharper: "Gjør formuleringene mer direkte og bestemte. Fjern hedging-ord (kanskje, litt, ganske, etc).",
      friendlier: "Mer tilgjengelig tone, men ikke konsulent-aktig. Behold bransje-troverdighet.",
      stronger_hook: "Skriv en åpningssetning som scroll-stopper. Behold resten av brødteksten.",
    };
    try {
      const raw = await callClaude({
        user: `Omskriv denne tekstblokken med tone="${tone}".

INSTRUKSJON: ${toneInstructions[tone] || tone}

ORIGINAL:
"""
${original}
"""

Returnér KUN den omskrevne teksten — ingen forklaring, ingen kode-fences.`,
        maxTokens: 1000,
      });
      res.json({ rewritten: raw.trim() });
    } catch (err) {
      console.error("[newsletter-ai] rewrite error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // 4. Content score — analyse + forbedringer
  app.post("/api/admin-room/newsletter/role-room/ai/content-score", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title) ?? "";
    const subject = asString(body.subject) ?? "";
    const content = asString(body.content) ?? "";
    if (!content) {
      res.status(400).json({ error: "content er påkrevd" });
      return;
    }
    try {
      const raw = await callClaude({
        user: `Vurder denne newsletter-utgaven av Norwegian Casting Brief.

TITTEL: ${title}
SUBJECT: ${subject}
INNHOLD:
"""
${content.slice(0, 8000)}
"""

EVALUÉR PÅ FEM KRITERIER (hver 0-20 poeng):
1. Hook-kvalitet (åpningssetning)
2. Konkrethet (har den faktiske tall/eksempler/navn?)
3. Bransje-relevans (treffer den norsk filmbransje?)
4. Skarphet (uten hedging og konsulent-jargong)
5. Handlings-kraft (gir den leseren noe å gjøre/tenke på)

Returnér KUN gyldig JSON:
{
  "score": 0-100 (sum av de fem),
  "breakdown": { "hook": 0-20, "concrete": 0-20, "relevant": 0-20, "sharp": 0-20, "actionable": 0-20 },
  "strengths": ["kort punkt 1", "kort punkt 2"],
  "improvements": [
    { "issue": "konkret problem", "suggestion": "konkret fiks" },
    ...
  ]
}`,
        maxTokens: 1500,
      });
      const parsed = safeParseJson<{ score: number; breakdown: Record<string, number>; strengths: string[]; improvements: Array<{ issue: string; suggestion: string }> }>(raw);
      if (!parsed) {
        res.status(502).json({ error: "Kunne ikke parse Claude-respons", raw });
        return;
      }
      res.json(parsed);
    } catch (err) {
      console.error("[newsletter-ai] content-score error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });
}
