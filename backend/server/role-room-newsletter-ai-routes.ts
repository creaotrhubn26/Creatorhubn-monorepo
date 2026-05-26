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
  const { app, pool, requireAdminRoomAccess } = deps;

  // ── Weekly Insights — aggregert data + Claude-forslag for ukens utgave ──
  app.get("/api/admin-room/newsletter/role-room/ai/weekly-insights", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      // Parallell-aggregering av relevante datakilder
      const [
        signupTrendRes,
        tier1ActivityRes,
        topClicksRes,
        topOpenedRes,
        recentSubjectsRes,
      ] = await Promise.all([
        pool.query(
          `SELECT source,
                  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS last_7d,
                  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days' AND created_at <= NOW() - INTERVAL '7 days')::int AS prev_7d
             FROM role_room_newsletter_signups
            WHERE created_at > NOW() - INTERVAL '14 days'
            GROUP BY source
            ORDER BY last_7d DESC`,
        ),
        pool.query(
          `SELECT e.kind, e.summary, t.full_name, t.tier, t.segment, e.occurred_at
             FROM role_room_industry_engagements e
             JOIN role_room_industry_targets t ON t.id = e.target_id
            WHERE e.user_id = $1
              AND e.occurred_at > NOW() - INTERVAL '7 days'
              AND t.tier IN ('T1', 'T2')
            ORDER BY e.occurred_at DESC
            LIMIT 20`,
          [session.userId],
        ),
        pool.query(
          `SELECT destination_url, COUNT(*)::int AS total_clicks
             FROM role_room_newsletter_issue_clicks
            WHERE clicked_at > NOW() - INTERVAL '30 days'
            GROUP BY destination_url
            ORDER BY total_clicks DESC
            LIMIT 5`,
        ),
        pool.query(
          `SELECT i.title, i.subject, i.unique_open_count, i.sent_count, i.published_at
             FROM role_room_newsletter_issues i
            WHERE i.status = 'sent' AND i.sent_count > 0
            ORDER BY (i.unique_open_count::float / NULLIF(i.sent_count, 0)) DESC NULLS LAST
            LIMIT 5`,
        ),
        pool.query(
          `SELECT title, subject FROM role_room_newsletter_issues
            WHERE status = 'sent'
            ORDER BY sent_at DESC NULLS LAST
            LIMIT 4`,
        ),
      ]);

      const signupTrend = signupTrendRes.rows;
      const tier1Activity = tier1ActivityRes.rows;
      const topClicks = topClicksRes.rows;
      const topOpened = topOpenedRes.rows;
      const recentSubjects = recentSubjectsRes.rows;

      // Bygg en kompakt JSON-snapshot for Claude
      const snapshot = {
        period: "siste 7 dager",
        signups: signupTrend.slice(0, 8).map((s: { source: string; last_7d: number; prev_7d: number }) => ({
          source: s.source,
          last_7d: s.last_7d,
          prev_7d: s.prev_7d,
          change_pct: s.prev_7d > 0 ? Math.round(((s.last_7d - s.prev_7d) / s.prev_7d) * 100) : null,
        })),
        tier1Activity: tier1Activity.slice(0, 10).map((a: { kind: string; full_name: string; tier: string; segment: string; summary: string | null }) => ({
          kind: a.kind,
          name: a.full_name,
          tier: a.tier,
          segment: a.segment,
          note: a.summary,
        })),
        topClickedLinks: topClicks.map((c: { destination_url: string; total_clicks: number }) => ({
          url: c.destination_url,
          clicks: c.total_clicks,
        })),
        bestPerformingIssues: topOpened.map((i: { title: string; subject: string; unique_open_count: number; sent_count: number }) => ({
          title: i.title,
          subject: i.subject,
          open_rate_pct: i.sent_count > 0 ? Math.round((i.unique_open_count / i.sent_count) * 100) : null,
        })),
        recentSubjects: recentSubjects.map((r: { title: string; subject: string }) => ({ title: r.title, subject: r.subject })),
      };

      let suggestion: { topic: string; why: string; dataAnchor: string; draftHook: string; angleAlternatives: string[] } | null = null;
      let suggestionError: string | null = null;
      try {
        const raw = await callClaude({
          user: `Analyser denne ukens data fra Norwegian Casting Brief-systemet og foreslå EN konkret topic-vinkel for ukens utgave.

UKENS DATA (JSON):
${JSON.stringify(snapshot, null, 2)}

OPPGAVE:
- Foreslå én skarp topic-vinkel som kombinerer minst ETT signal fra dataen
- Vinkelen skal være konkret, ikke generisk ("AI i casting" er generisk; "Hva tre norske CDs sa om AI-selvtape denne uka" er konkret)
- Hvis tier1Activity er tom: foreslå en topic basert på signups/clicks
- Hvis ingenting er nytt: foreslå "kontroversiell mening Daniel ikke har sagt enda"

UNNGÅ:
- Tema som overlapper med recentSubjects
- Konsulent-jargong ("flytte mønsteret", "nye dimensjoner")
- Hedging ("kanskje", "kan tenkes")

Returnér KUN gyldig JSON:
{
  "topic": "kort tittel — 5-10 ord",
  "why": "1 setning om hvorfor dette akkurat nå",
  "dataAnchor": "1 konkret tall eller observasjon fra snapshot",
  "draftHook": "1 åpningssetning som scroll-stopper",
  "angleAlternatives": ["alt-vinkel 1 — 5-10 ord", "alt-vinkel 2 — 5-10 ord"]
}`,
          maxTokens: 1500,
        });
        const parsed = safeParseJson<typeof suggestion>(raw);
        if (parsed) suggestion = parsed;
        else suggestionError = "Claude returnerte ikke gyldig JSON";
      } catch (err) {
        suggestionError = (err as Error).message;
      }

      res.json({
        snapshot,
        suggestion,
        suggestionError,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[newsletter-ai] weekly-insights error", err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

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

  // 5. Repurpose — én newsletter-utgave til LinkedIn-essay + IG-carousel + quote-cards
  app.post("/api/admin-room/newsletter/role-room/issues/:id/repurpose", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const issueRes = await pool.query(
        `SELECT title, subject, preheader, body_html, body_markdown, body_blocks, slug, published_to_web
           FROM role_room_newsletter_issues
          WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      const issue = issueRes.rows[0];
      if (!issue) {
        res.status(404).json({ error: "Utgave ikke funnet" });
        return;
      }

      // Flatten blocks til lesbar tekst for Claude
      const blocks: Array<Record<string, unknown>> = Array.isArray(issue.body_blocks) ? issue.body_blocks : [];
      const flattenedContent = blocks.length > 0
        ? blocks.map((b) => {
            if (b.type === "header") return `## ${b.text ?? ""}`;
            if (b.type === "text") return String(b.markdown ?? "");
            if (b.type === "quote") return `> ${b.text ?? ""}${b.attribution ? ` — ${b.attribution}` : ""}`;
            if (b.type === "cta") return `[${b.label ?? ""}](${b.url ?? ""})`;
            return "";
          }).filter(Boolean).join("\n\n")
        : issue.body_markdown || "";

      const briefUrl = issue.published_to_web
        ? `https://theroleroom.com/brief/${issue.slug}`
        : "https://theroleroom.com";

      const raw = await callClaude({
        user: `Du skal "repurpose" en utgave av Norwegian Casting Brief til 3 andre formater for distribusjon på LinkedIn og Instagram. Dette er 1-piece-to-10-outputs-prinsippet fra Daniels Content Marketing-plan.

UTGAVE-TITTEL: ${issue.title}
SUBJECT: ${issue.subject}
URL HVIS PUBLISERT: ${briefUrl}

INNHOLD:
"""
${flattenedContent.slice(0, 8000)}
"""

GENERER 3 FORMATER:

1. **LinkedIn-essay** (norsk, profesjonell tone, 700-1100 tegn inkludert linjeskift):
   - Start med en scroll-stopper-setning som matcher utgavens kjernetese
   - 3-5 korte avsnitt med konkrete eksempler/data fra utgaven
   - Ikke konsulent-jargong
   - Avslutt med invitasjon til kommentar ELLER lenke til briefen
   - LinkedIn-formattering: bruk linjeskift, ingen markdown-headers

2. **Instagram-carousel** (4-6 slides, hver maks 140 tegn):
   - Slide 1: hook med stor tese
   - Slide 2-N: ett konkret poeng/data per slide
   - Siste slide: CTA ("Få hele briefen — link i bio")
   - Slides skal kunne stå alene som visuelle kort

3. **3 quote-cards** (sitérbare for Twitter/LinkedIn/Instagram-post som standalone-bilde):
   - Hver må være ≤200 tegn
   - Selvstendig poeng — krever ingen kontekst
   - Liker "sniteringer du kan poste 6 måneder fra nå og fortsatt slå"

Returnér KUN gyldig JSON:
{
  "linkedinEssay": "tekst på 700-1100 tegn med linjeskift",
  "instagramCarousel": [
    { "slideNumber": 1, "headline": "kort header", "body": "1-2 setninger maks 140 tegn" },
    ...
  ],
  "quoteCards": [
    { "quote": "selvstendig sitat maks 200 tegn", "attribution": "Norwegian Casting Brief" },
    ...
  ]
}`,
        maxTokens: 3000,
      });
      const parsed = safeParseJson<{
        linkedinEssay: string;
        instagramCarousel: Array<{ slideNumber: number; headline: string; body: string }>;
        quoteCards: Array<{ quote: string; attribution: string }>;
      }>(raw);
      if (!parsed) {
        res.status(502).json({ error: "Kunne ikke parse Claude-respons", raw });
        return;
      }
      res.json(parsed);
    } catch (err) {
      console.error("[newsletter-ai] repurpose error", err);
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
