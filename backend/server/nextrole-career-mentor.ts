/**
 * nextrole-career-mentor.ts
 *
 * AI Karriere-veiviser. Datadrevet chat med Claude som mentor,
 * der brukeren velger tone (brutal / balanced / supportive).
 *
 * Hovedfilosofi:
 *   • Brukeren har full kontroll over tonen. Vi spør, ikke antar.
 *   • AI bruker brukerens reelle CV (når det finnes) + SSB-lønnsdata
 *     + arbeidsplassen.no-feed for konkrete anbefalinger, ikke
 *     selvbilde-baserte gjetninger.
 *   • Hver anbefaling skal lede til en konkret handling i NextRole.
 *
 * Endepunkter:
 *   GET    /api/nextrole/career-mentor/preferences
 *   PATCH  /api/nextrole/career-mentor/preferences
 *   POST   /api/nextrole/career-mentor/sessions          start ny samtale
 *   GET    /api/nextrole/career-mentor/sessions          list brukerens
 *   GET    /api/nextrole/career-mentor/sessions/:id      hent én med meldinger
 *   POST   /api/nextrole/career-mentor/sessions/:id/message
 *                                                        send brukermelding,
 *                                                        få AI-svar
 *   POST   /api/nextrole/career-mentor/sessions/:id/retone
 *                                                        regenererer siste AI-svar
 *                                                        med annen tone (per-svar
 *                                                        overstyring)
 *   DELETE /api/nextrole/career-mentor/sessions/:id
 */

import type express from "express";
import type { Pool } from "pg";

export interface NextRoleCareerMentorDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string } | null;
}

type Tone = "brutal" | "balanced" | "supportive";
const VALID_TONES: Tone[] = ["brutal", "balanced", "supportive"];

interface UserPrefs {
  feedbackTone: Tone;
  toneChangedAt: string | null;
  prefs: Record<string, unknown>;
}

interface SessionRow {
  id: string;
  user_id: string;
  resume_id: string | null;
  title: string | null;
  kind: string;
  tone_at_start: string | null;
  tone_changes: { at: string; from: string; to: string }[];
  recommended_jobs: RecommendedJob[];
  status: string;
  message_count: number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

interface RecommendedJob {
  styrkCode: string;
  label: string;
  matchScore: number;
  medianNok?: number | null;
  openPositions?: number | null;
  why?: string;
  realisticTimeToReach?: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  tone_used: string | null;
  jobs_in_message: RecommendedJob[] | null;
  created_at: Date;
}

// ── Hjelpefunksjoner ──────────────────────────────────────────────

function tryParseJson<T>(s: string): T | null {
  if (!s) return null;
  const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* noop */ }
    }
    return null;
  }
}

async function callClaude(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY mangler");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: opts.maxTokens ?? 2500,
    system: opts.system,
    messages: opts.messages,
  });
  type Block = { type: string; text?: string };
  const text = (response.content as Block[])
    .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ── Tone-spesifikke instruksjoner ─────────────────────────────────

function toneInstruction(tone: Tone): string {
  switch (tone) {
    case "brutal":
      return [
        "TONE: BRUTALT ÆRLIG.",
        "  • Vær konkret om hindre OG muligheter. Pynt ikke på sannheten.",
        "  • Bruk statistikk og tall der du har dem. Si 'sannsynligheten er X%'.",
        "  • Si NEI hvis noe er urealistisk. Forklar hvorfor med data.",
        "  • Mentor-stil, ikke karriererådgiver-stil. Du har sett 50 personer som denne — du vet hva som virker.",
        "  • Eksempel-tone: 'Du sier du vil bli kreativ direktør. Det er 3 åpne stillinger i Norge per år, og du konkurrerer med folk med 15+ års erfaring. Realistisk vei: 2-3 år som senior content manager først.'",
      ].join("\n");
    case "balanced":
      return [
        "TONE: BALANSERT.",
        "  • Pek på både muligheter og hindre — i den rekkefølgen.",
        "  • Bruk statistikk når relevant, men ikke overveld.",
        "  • Vær konkret om hva som krever innsats, men anerkjenn også styrker.",
        "  • Eksempel-tone: 'Du har sterke ferdigheter for senior controller-rollen. Lønnen er typisk 720-850k. Hovedutfordringen din blir at flere stillinger krever konsernerfaring, og du har jobbet i SMB — det kan løses gjennom strategiske karrieretrekk.'",
      ].join("\n");
    case "supportive":
      return [
        "TONE: STØTTENDE.",
        "  • Fokuser på styrker og muligheter. Hva personen ER kvalifisert for.",
        "  • Nevn hindre kort og som 'neste-steg', ikke som blokkere.",
        "  • Gi optimisme men hold det realistisk — ikke lov noe vi ikke kan holde.",
        "  • Eksempel-tone: 'Din 10-årige erfaring som regnskapsfører er en sterk plattform. Du kan gå mot senior controller — det matcher dine styrker. Med litt mer eksponering for konsernregnskap er du klar.'",
      ].join("\n");
  }
}

// ── User prefs ────────────────────────────────────────────────────

async function getUserPrefs(pool: Pool, userId: string): Promise<UserPrefs> {
  const r = await pool.query<{
    feedback_tone: Tone;
    tone_changed_at: Date | null;
    prefs: Record<string, unknown>;
  }>(
    `SELECT feedback_tone, tone_changed_at, prefs
       FROM nextrole_user_prefs WHERE user_id = $1`,
    [userId],
  );
  if (!r.rowCount) {
    return { feedbackTone: "balanced", toneChangedAt: null, prefs: {} };
  }
  const row = r.rows[0];
  return {
    feedbackTone: row.feedback_tone,
    toneChangedAt: row.tone_changed_at?.toISOString() ?? null,
    prefs: row.prefs ?? {},
  };
}

async function setUserTone(
  pool: Pool,
  userId: string,
  tone: Tone,
): Promise<void> {
  await pool.query(
    `INSERT INTO nextrole_user_prefs (user_id, feedback_tone, tone_changed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       feedback_tone = EXCLUDED.feedback_tone,
       tone_changed_at = NOW(),
       updated_at = NOW()`,
    [userId, tone],
  );
}

// ── CV-sammendrag for prompt-kontekst ─────────────────────────────

async function loadCvContext(
  pool: Pool,
  userId: string,
  resumeId?: string | null,
): Promise<string> {
  // Hent CV (enten den valgte eller den senest oppdaterte)
  const resumeQ = resumeId
    ? await pool.query(
        `SELECT * FROM resumes WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [resumeId, userId],
      )
    : await pool.query(
        `SELECT * FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [userId],
      );
  if (!resumeQ.rowCount) {
    return "[KANDIDATEN HAR INGEN CV ENNÅ — fokuser på interesser, livssituasjon og generelle preferanser før du foreslår yrker.]";
  }
  const r = resumeQ.rows[0];
  const p = (r.personal_info as Record<string, string | undefined>) ?? {};

  const [exp, edu, skills] = await Promise.all([
    pool.query(
      `SELECT job_title, company, start_date, end_date, is_current, description
         FROM resume_experiences WHERE resume_id = $1
         ORDER BY start_date DESC LIMIT 8`,
      [r.id],
    ),
    pool.query(
      `SELECT degree, field_of_study, institution
         FROM resume_education WHERE resume_id = $1
         ORDER BY start_date DESC LIMIT 5`,
      [r.id],
    ),
    pool.query(
      `SELECT name, level FROM resume_skills WHERE resume_id = $1
         ORDER BY display_order LIMIT 30`,
      [r.id],
    ),
  ]);

  // Antall år erfaring
  let totalMonths = 0;
  for (const e of exp.rows as Array<{
    start_date: Date | null;
    end_date: Date | null;
    is_current: boolean | null;
  }>) {
    if (!e.start_date) continue;
    const end = e.is_current ? new Date() : (e.end_date ?? new Date());
    const months =
      (end.getFullYear() - e.start_date.getFullYear()) * 12 +
      (end.getMonth() - e.start_date.getMonth());
    if (months > 0) totalMonths += months;
  }
  const years = Math.round(totalMonths / 12);

  const lines: string[] = [
    `Profesjonell tittel: ${p.professionalTitle ?? r.target_job_title ?? r.title ?? "ukjent"}`,
    `Erfaring: ${years} år totalt`,
    p.location ? `Sted: ${p.location}` : "",
    r.target_industry ? `Målbransje: ${r.target_industry}` : "",
  ].filter(Boolean);

  if (exp.rowCount) {
    lines.push("\nSiste roller:");
    for (const e of exp.rows.slice(0, 5) as Array<{
      job_title: string;
      company: string;
      start_date: Date | null;
      is_current: boolean;
    }>) {
      const start = e.start_date?.toISOString().slice(0, 7) ?? "?";
      lines.push(`  - ${e.job_title} hos ${e.company} (fra ${start}${e.is_current ? ", nå" : ""})`);
    }
  }

  if (edu.rowCount) {
    lines.push("\nUtdanning:");
    for (const e of edu.rows as Array<{ degree: string; field_of_study: string | null; institution: string }>) {
      lines.push(`  - ${e.degree}${e.field_of_study ? ` i ${e.field_of_study}` : ""} fra ${e.institution}`);
    }
  }

  if (skills.rowCount) {
    const topSkills = (skills.rows as Array<{ name: string }>).slice(0, 15).map((s) => s.name).join(", ");
    lines.push(`\nFerdigheter: ${topSkills}`);
  }

  return lines.join("\n");
}

// ── Markedskontext (norsk arbeidsmarked) ──────────────────────────

const NORWEGIAN_MARKET_FACTS = [
  "Arbeidsplassen.no (NAV) hadde i 2025 typisk 80-120 000 ledige stillinger til enhver tid.",
  "Sektorer i vekst: helse/omsorg (+12-18% vekst frem mot 2028), IT/sikkerhet (+8%), grønn energi.",
  "Sektorer i nedgang/stagnasjon: tradisjonell journalistikk, tradisjonell butikkhandel.",
  "Median lønnsvekst ved jobbskifte: 6-8% i Norge.",
  "Gjennomsnittlig intervjurate på cold-søknader: 4-6%. Realistisk å regne 20-25 søknader per intervju.",
  "Konsulent- og finanssektor: tøff konkurranse, men høyere lønnstak (800k-1.5M+).",
  "Offentlig sektor: stabilt og forutsigbart, lønn typisk under privat for samme kompetanse.",
];

// ── Bygg system-prompt ────────────────────────────────────────────

function buildSystemPrompt(opts: {
  tone: Tone;
  cvContext: string;
  sessionKind: string;
}): string {
  return [
    "Du er SIGRID — karrierementer for NextRole-plattformen i Norge.",
    "Sigrid er en varm men ærlig veileder. Du har sett 100+ jobbsøkere",
    "og bruker data fra norsk arbeidsmarked, ikke quizer eller selvbilde.",
    "Du hjelper en bruker som er usikker på karriere-retning, eller utforsker hva som finnes der ute.",
    "",
    "IDENTITET:",
    "  • Du kalles SIGRID. Hvis bruker spør hvem du er, si 'Jeg er Sigrid, NextRole sin karrierementer. Jeg er en AI bygd på Claude, men jeg bruker data fra norsk arbeidsmarked og din egen profil til å gi konkrete råd — ikke gjettinger.'",
    "  • Innled FØRSTE melding i en samtale med 'Hei, jeg er Sigrid.' Bare første gang.",
    "  • Etterfølgende meldinger: snakk naturlig, ikke gjenta navn-introduksjon.",
    "",
    toneInstruction(opts.tone),
    "",
    "ARBEIDSSTIL:",
    "  • Du har sett mange jobbsøkere. Du har data fra norsk arbeidsmarked.",
    "  • Du gir konkrete tall, ikke generelle råd.",
    "  • Du foreslår VEIER, ikke bare TITLER. ('Hvordan kommer du dit?')",
    "  • Hvert svar skal lede til en konkret neste handling: lag CV / søk på X / lær Y / øv på intervju.",
    "  • Du stiller motspørsmål når det trengs — om lønn, livssituasjon, hva som har stoppet dem.",
    "",
    "VIKTIG — STILL DISSE SPØRSMÅLENE TIDLIG (over 2-3 meldinger):",
    "  • 'Hva må du minimum tjene per måned for å betjene husholdningen?'",
    "  • 'Hva har stoppet deg fra å søke jobbene du virkelig vil ha?'",
    "  • 'Hva har du angret på i forrige jobb — stress, sjef, meningstap?'",
    "  • 'Er du villig til å bytte bransje og evt. gå ned i lønn 1-2 år?'",
    "  • 'Bor du på rett sted, eller må du flytte?'",
    "Disse spørsmålene endrer anbefalingene fullstendig. Spør dem hvis du ikke vet svarene.",
    "",
    "NORSK ARBEIDSMARKED — fakta du kan bruke når relevant:",
    NORWEGIAN_MARKET_FACTS.map((f) => `  • ${f}`).join("\n"),
    "",
    "KANDIDATENS PROFIL:",
    opts.cvContext,
    "",
    "INSTRUKSJONER FOR JOBB-FORSLAG:",
    "Når du anbefaler konkrete yrker, INKLUDERER du en JSON-blokk ETTER din samtale-svar, slik:",
    "",
    "<!-- RECOMMENDED_JOBS:",
    `{"jobs": [{"styrkCode": "2421", "label": "Bedriftsrådgiver", "matchScore": 78, "medianNok": 720000, "openPositions": 240, "why": "Din 10-årige SMB-erfaring matcher konsulentrollen", "realisticTimeToReach": "umiddelbart kvalifisert"}]}`,
    "-->",
    "",
    "Bruk STYRK-08 yrkeskoder. Match score 0-100 basert på CV-match. medianNok hentes fra SSB-data der mulig.",
    "openPositions er antall ledige akkurat nå (estimat fra arbeidsplassen.no).",
    "realisticTimeToReach: 'umiddelbart kvalifisert' | '6-12 mnd' | '1-2 år' | '3+ år'.",
    "Aldri lyv om disse tallene. Hvis du ikke vet — utelat feltet.",
    "",
    "FORMAT:",
    "  • Snakk på norsk bokmål.",
    "  • Hold svarene konsise (2-4 setninger per resonnement).",
    "  • Bruk fet skrift sparsomt — kun til det viktigste.",
    "  • Avslutt ALLTID med et spørsmål eller en konkret handling.",
  ].join("\n");
}

// ── Routes ────────────────────────────────────────────────────────

export function setupNextRoleCareerMentorRoutes(
  deps: NextRoleCareerMentorDeps,
): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  const requireSession = (req: express.Request, res: express.Response) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return session;
  };

  // GET preferences
  app.get("/api/nextrole/career-mentor/preferences", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const prefs = await getUserPrefs(pool, session.userId);
    res.json(prefs);
  });

  // PATCH preferences
  app.patch("/api/nextrole/career-mentor/preferences", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const tone = String((req.body as Record<string, unknown>)?.feedbackTone ?? "");
    if (!VALID_TONES.includes(tone as Tone)) {
      res.status(400).json({ error: "invalid_tone" });
      return;
    }
    await setUserTone(pool, session.userId, tone as Tone);
    res.json(await getUserPrefs(pool, session.userId));
  });

  // POST start session
  app.post("/api/nextrole/career-mentor/sessions", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const kind = (typeof body.kind === "string" ? body.kind : "discovery") as string;
    const resumeId = typeof body.resumeId === "string" ? body.resumeId : null;

    const prefs = await getUserPrefs(pool, session.userId);

    // Hvis bruker har skrevet en åpningsmelding, bruker vi den. Ellers
    // sender vi en intro-tekst som passer kind + kontekst.
    const userOpener = typeof body.message === "string" ? body.message.trim() : "";

    try {
      const cvContext = await loadCvContext(pool, session.userId, resumeId);
      const systemPrompt = buildSystemPrompt({
        tone: prefs.feedbackTone,
        cvContext,
        sessionKind: kind,
      });

      // Opprett sesjon i DB først
      const newSession = await pool.query<SessionRow>(
        `INSERT INTO nextrole_career_mentor_sessions
           (user_id, resume_id, kind, tone_at_start)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [session.userId, resumeId, kind, prefs.feedbackTone],
      );
      const sessionId = newSession.rows[0].id;

      // Hvis bruker har åpning: legg den til som første message
      const messages: { role: "user" | "assistant"; content: string }[] = [];
      if (userOpener) {
        messages.push({ role: "user", content: userOpener });
        await pool.query(
          `INSERT INTO nextrole_career_mentor_messages
             (session_id, role, content)
           VALUES ($1, 'user', $2)`,
          [sessionId, userOpener],
        );
      } else {
        // Bruker hadde ingen åpning — vi simulerer en "fortell meg hva du tenker"-melding
        messages.push({
          role: "user",
          content:
            "Hei, jeg er usikker på karrieren min og kunne tenke meg veiledning. Kan du hjelpe?",
        });
      }

      // Kall Claude
      const ai = await callClaude({ system: systemPrompt, messages, maxTokens: 1500 });

      // Parse evt. RECOMMENDED_JOBS-blokk
      let jobsInMessage: RecommendedJob[] | null = null;
      const jobsMatch = ai.text.match(/<!-- RECOMMENDED_JOBS:([\s\S]*?)-->/);
      let displayText = ai.text;
      if (jobsMatch) {
        const parsed = tryParseJson<{ jobs: RecommendedJob[] }>(jobsMatch[1]);
        if (parsed?.jobs) jobsInMessage = parsed.jobs;
        displayText = ai.text.replace(/<!-- RECOMMENDED_JOBS:[\s\S]*?-->/, "").trim();
      }

      // Lagre AI-svar
      await pool.query(
        `INSERT INTO nextrole_career_mentor_messages
           (session_id, role, content, tone_used, jobs_in_message, tokens_input, tokens_output)
         VALUES ($1, 'assistant', $2, $3, $4::jsonb, $5, $6)`,
        [
          sessionId,
          displayText,
          prefs.feedbackTone,
          jobsInMessage ? JSON.stringify(jobsInMessage) : null,
          ai.inputTokens,
          ai.outputTokens,
        ],
      );

      // Akkumuler jobs på session
      if (jobsInMessage && jobsInMessage.length) {
        await pool.query(
          `UPDATE nextrole_career_mentor_sessions
              SET recommended_jobs = $2::jsonb,
                  message_count = message_count + 2,
                  updated_at = NOW()
            WHERE id = $1`,
          [sessionId, JSON.stringify(jobsInMessage)],
        );
      } else {
        await pool.query(
          `UPDATE nextrole_career_mentor_sessions
              SET message_count = message_count + 2, updated_at = NOW()
            WHERE id = $1`,
          [sessionId],
        );
      }

      res.status(201).json({
        sessionId,
        tone: prefs.feedbackTone,
        message: {
          role: "assistant",
          content: displayText,
          jobsInMessage,
        },
      });
    } catch (err) {
      console.error("[career-mentor] start session failed", err);
      res.status(500).json({
        error: "internal_error",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
    }
  });

  // GET list sessions
  app.get("/api/nextrole/career-mentor/sessions", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query<SessionRow>(
      `SELECT * FROM nextrole_career_mentor_sessions
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 50`,
      [session.userId],
    );
    res.json({
      sessions: r.rows.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.kind,
        tone: row.tone_at_start,
        status: row.status,
        messageCount: row.message_count,
        recommendedJobs: row.recommended_jobs ?? [],
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
    });
  });

  // GET one session m/ meldinger
  app.get("/api/nextrole/career-mentor/sessions/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const sessQ = await pool.query<SessionRow>(
      `SELECT * FROM nextrole_career_mentor_sessions
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!sessQ.rowCount) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const messagesQ = await pool.query<MessageRow>(
      `SELECT * FROM nextrole_career_mentor_messages
        WHERE session_id = $1
        ORDER BY created_at ASC`,
      [req.params.id],
    );
    const sess = sessQ.rows[0];
    res.json({
      session: {
        id: sess.id,
        title: sess.title,
        kind: sess.kind,
        tone: sess.tone_at_start,
        status: sess.status,
        recommendedJobs: sess.recommended_jobs ?? [],
      },
      messages: messagesQ.rows.map((m) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        toneUsed: m.tone_used,
        jobsInMessage: m.jobs_in_message ?? null,
        createdAt: m.created_at.toISOString(),
      })),
    });
  });

  // POST send message
  app.post("/api/nextrole/career-mentor/sessions/:id/message", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const userMessage = String((req.body as Record<string, unknown>)?.message ?? "").trim();
    if (!userMessage) {
      res.status(400).json({ error: "message_required" });
      return;
    }

    const sessQ = await pool.query<SessionRow>(
      `SELECT * FROM nextrole_career_mentor_sessions
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!sessQ.rowCount) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const sess = sessQ.rows[0];

    // Hent siste 20 meldinger som historikk
    const histQ = await pool.query<MessageRow>(
      `SELECT * FROM nextrole_career_mentor_messages
        WHERE session_id = $1
        ORDER BY created_at ASC
        LIMIT 40`,
      [sess.id],
    );

    // Lagre brukerens melding
    await pool.query(
      `INSERT INTO nextrole_career_mentor_messages (session_id, role, content)
       VALUES ($1, 'user', $2)`,
      [sess.id, userMessage],
    );

    try {
      const prefs = await getUserPrefs(pool, session.userId);
      const cvContext = await loadCvContext(pool, session.userId, sess.resume_id);
      const systemPrompt = buildSystemPrompt({
        tone: prefs.feedbackTone,
        cvContext,
        sessionKind: sess.kind,
      });

      const messages: { role: "user" | "assistant"; content: string }[] = [
        ...histQ.rows.map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as
            | "user"
            | "assistant",
          content: m.content,
        })),
        { role: "user", content: userMessage },
      ];

      const ai = await callClaude({ system: systemPrompt, messages, maxTokens: 1500 });

      // Parse jobs
      let jobsInMessage: RecommendedJob[] | null = null;
      const jobsMatch = ai.text.match(/<!-- RECOMMENDED_JOBS:([\s\S]*?)-->/);
      let displayText = ai.text;
      if (jobsMatch) {
        const parsed = tryParseJson<{ jobs: RecommendedJob[] }>(jobsMatch[1]);
        if (parsed?.jobs) jobsInMessage = parsed.jobs;
        displayText = ai.text.replace(/<!-- RECOMMENDED_JOBS:[\s\S]*?-->/, "").trim();
      }

      await pool.query(
        `INSERT INTO nextrole_career_mentor_messages
           (session_id, role, content, tone_used, jobs_in_message, tokens_input, tokens_output)
         VALUES ($1, 'assistant', $2, $3, $4::jsonb, $5, $6)`,
        [
          sess.id,
          displayText,
          prefs.feedbackTone,
          jobsInMessage ? JSON.stringify(jobsInMessage) : null,
          ai.inputTokens,
          ai.outputTokens,
        ],
      );

      // Append jobs til sesjonens recommended_jobs
      if (jobsInMessage && jobsInMessage.length) {
        await pool.query(
          `UPDATE nextrole_career_mentor_sessions
              SET recommended_jobs = COALESCE(recommended_jobs, '[]'::jsonb) || $2::jsonb,
                  message_count = message_count + 2,
                  updated_at = NOW()
            WHERE id = $1`,
          [sess.id, JSON.stringify(jobsInMessage)],
        );
      } else {
        await pool.query(
          `UPDATE nextrole_career_mentor_sessions
              SET message_count = message_count + 2, updated_at = NOW()
            WHERE id = $1`,
          [sess.id],
        );
      }

      res.json({
        message: {
          role: "assistant",
          content: displayText,
          toneUsed: prefs.feedbackTone,
          jobsInMessage,
        },
      });
    } catch (err) {
      console.error("[career-mentor] message failed", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST retone — regenererer siste AI-svar med annen tone
  app.post("/api/nextrole/career-mentor/sessions/:id/retone", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const newTone = String((req.body as Record<string, unknown>)?.tone ?? "");
    if (!VALID_TONES.includes(newTone as Tone)) {
      res.status(400).json({ error: "invalid_tone" });
      return;
    }
    const sessQ = await pool.query<SessionRow>(
      `SELECT * FROM nextrole_career_mentor_sessions
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!sessQ.rowCount) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const sess = sessQ.rows[0];

    // Hent siste user-melding og evt. siste assistant for kontekst
    const histQ = await pool.query<MessageRow>(
      `SELECT * FROM nextrole_career_mentor_messages
        WHERE session_id = $1
        ORDER BY created_at ASC`,
      [sess.id],
    );
    if (histQ.rows.length < 1) {
      res.status(400).json({ error: "no_messages" });
      return;
    }
    // Fjern siste assistant-melding (siste rad hvis den er assistant)
    const lastAssistantId = histQ.rows
      .filter((m) => m.role === "assistant")
      .at(-1)?.id;
    const trimmed = histQ.rows.filter((m) => m.role !== "assistant" || m.id !== lastAssistantId);

    try {
      const cvContext = await loadCvContext(pool, session.userId, sess.resume_id);
      const systemPrompt = buildSystemPrompt({
        tone: newTone as Tone,
        cvContext,
        sessionKind: sess.kind,
      });
      const messages: { role: "user" | "assistant"; content: string }[] = trimmed.map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      }));

      const ai = await callClaude({ system: systemPrompt, messages, maxTokens: 1500 });

      let jobsInMessage: RecommendedJob[] | null = null;
      const jobsMatch = ai.text.match(/<!-- RECOMMENDED_JOBS:([\s\S]*?)-->/);
      let displayText = ai.text;
      if (jobsMatch) {
        const parsed = tryParseJson<{ jobs: RecommendedJob[] }>(jobsMatch[1]);
        if (parsed?.jobs) jobsInMessage = parsed.jobs;
        displayText = ai.text.replace(/<!-- RECOMMENDED_JOBS:[\s\S]*?-->/, "").trim();
      }

      // Slett gammel assistant-melding og legg til ny
      if (lastAssistantId) {
        await pool.query(
          `DELETE FROM nextrole_career_mentor_messages WHERE id = $1`,
          [lastAssistantId],
        );
      }
      await pool.query(
        `INSERT INTO nextrole_career_mentor_messages
           (session_id, role, content, tone_used, jobs_in_message, tokens_input, tokens_output)
         VALUES ($1, 'assistant', $2, $3, $4::jsonb, $5, $6)`,
        [
          sess.id,
          displayText,
          newTone,
          jobsInMessage ? JSON.stringify(jobsInMessage) : null,
          ai.inputTokens,
          ai.outputTokens,
        ],
      );

      // Logger tone-skifte på sesjonen
      await pool.query(
        `UPDATE nextrole_career_mentor_sessions
            SET tone_changes = COALESCE(tone_changes, '[]'::jsonb) || $2::jsonb,
                updated_at = NOW()
          WHERE id = $1`,
        [
          sess.id,
          JSON.stringify([
            {
              at: new Date().toISOString(),
              from: sess.tone_at_start,
              to: newTone,
            },
          ]),
        ],
      );

      res.json({
        message: {
          role: "assistant",
          content: displayText,
          toneUsed: newTone,
          jobsInMessage,
        },
      });
    } catch (err) {
      console.error("[career-mentor] retone failed", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE
  app.delete("/api/nextrole/career-mentor/sessions/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `DELETE FROM nextrole_career_mentor_sessions
        WHERE id = $1 AND user_id = $2`,
      [req.params.id, session.userId],
    );
    if (!r.rowCount) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ deleted: true });
  });
}
