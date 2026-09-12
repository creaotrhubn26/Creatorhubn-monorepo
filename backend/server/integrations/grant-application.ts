/**
 * grant-application.ts — JARVIS søknads-modus (Innovasjon Norge)
 *
 * Daniels bestilling: «skriver jeg en søknad om Leadgrid eller The Role
 * Room, må JARVIS sjekke alt og hjelpe meg å skreddersy en god søknad.»
 *
 * To lag:
 *  1. LØSNINGS-BEVIS — plattformens egne data per løsning som nummerert
 *     dossier: markedsstørrelse (Enhetsreg.-segmenter), lønnsomhets-
 *     smerte (regnskaps-benchmark), markedsvekst (SSB-momentum),
 *     konkurransebilde (GEO-discovery), anbudsaktivitet. Kun det som
 *     FINNES, med dekning der relevant.
 *  2. SEKSJONS-UTKAST — IN-strukturen (researchet 2026-07-13 mot
 *     innovasjonnorge.no: Oppstartstilskudd 1 ≤100k/<3år m/ nyhetsverdi
 *     + int. vekstpotensial; Oppstartstilskudd 2/3 ≤700k/<5år m/ krav
 *     om kundetesting; alle søknader: gjennomføringsevne, kapitaltilgang,
 *     annen offentlig støtte) — sonnet skriver per seksjon med
 *     siterings-plikt mot beviset; fabrikkert [n] forkaster utkastet.
 *
 * Utkast er UTKAST: Daniel eier søknaden, og satser/kriterier skal
 * verifiseres mot innovasjonnorge.no før innsending.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import { recordAiUsage } from "./ai-usage.js";
import { getIndustryBenchmark } from "./industry-benchmark.js";

const GRANT_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export type SolutionKey = "leadgrid" | "theroleroom" | "creatorhub";

/** Løsning → plattform-koblinger (segmenter, prompt-sett, statisk kjerne). */
const SOLUTIONS: Record<SolutionKey, {
  name: string;
  segments: string[];
  setNamePatterns: string[];
  core: string[];
}> = {
  leadgrid: {
    name: "Leadgrid",
    segments: [],
    setNamePatterns: ["Leadgrid%"],
    core: [
      "CRM og feltsalg-plattform for små og store bedrifter: territorier, ruteplanlegging, leads, pipeline",
      "Innebygd markedsintelligens: anbuds-triggere (Doffin/TED), konkursvakt, regnskaps- og IP-berikelse per lead",
    ],
  },
  theroleroom: {
    name: "The Role Room",
    segments: ["film-tv", "danseundervisning"],
    setNamePatterns: ["The Role Room%"],
    core: [
      "Flerpilar-plattform for film/TV, dansestudioer og utdanningsinstitusjoner: casting, selvtape, crew-koordinering, produksjonsplanlegging",
      "AI-agent (beta) og GEO-synlighetsmåling som del av produktet",
    ],
  },
  creatorhub: {
    name: "CreatorHub",
    segments: ["fotografer"],
    setNamePatterns: ["CreatorHub%"],
    core: [
      "Administrasjonsplattform for fotografer/videografer/innholdsskapere: prosjekt, kundeoppfølging, leveranse, fakturering",
    ],
  },
};

export interface GrantFact {
  n: number;
  source: string;
  label: string;
  value: string;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("nb-NO", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export async function buildSolutionEvidence(
  pool: Pool,
  organizationId: string,
  solution: SolutionKey,
): Promise<GrantFact[]> {
  const def = SOLUTIONS[solution];
  const raw: Array<[string, string, string]> = [];

  for (const line of def.core) raw.push(["produkt", `${def.name} — kjerne`, line]);
  raw.push([
    "system",
    "Plattform-status",
    "I drift: 14 datakilder normalisert til ett skjema, 12 automatiske dagligsteg, innsiktsmotor m/ siterings-validering («No Fake Insights»)",
  ]);

  // Markedsstørrelse + benchmark per segment
  for (const segKey of def.segments) {
    const b = await getIndustryBenchmark(pool, segKey);
    if (!b) continue;
    raw.push([
      "enhetsregisteret",
      `Adresserbart marked (${b.displayName})`,
      `${fmt(b.segmentTotal)} registrerte virksomheter`,
    ]);
    if (b.medianOperatingMargin !== null) {
      raw.push([
        "regnskapsregisteret",
        `Bransje-lønnsomhet (${b.displayName})`,
        `median driftsmargin ${Math.round(b.medianOperatingMargin * 100 * 10) / 10} % (dekning ${Math.round(b.coverage * 100)} % av segmentet, vokser daglig)`,
      ]);
    }
  }

  // SSB-momentum (nyeste vs eldste indekspunkt per tema)
  const momentum = await pool.query<{ topic: string; first: number; last: number }>(
    `WITH pts AS (
       SELECT topic, metric_value, collected_at, period_start,
              ROW_NUMBER() OVER (PARTITION BY topic ORDER BY period_start ASC) AS rn_asc,
              ROW_NUMBER() OVER (PARTITION BY topic ORDER BY period_start DESC) AS rn_desc
         FROM normalized_signals
        WHERE organization_id = $1::uuid AND metric_type = 'industry_revenue_index'
     )
     SELECT a.topic, a.metric_value AS first, b.metric_value AS last
       FROM pts a JOIN pts b ON b.topic = a.topic AND b.rn_desc = 1
      WHERE a.rn_asc = 1`,
    [organizationId],
  );
  for (const m of momentum.rows) {
    if (!def.setNamePatterns.some((p) => m.topic.startsWith(p.replace("%", "")))) continue;
    raw.push([
      "ssb",
      `Markedsutvikling (${m.topic})`,
      `omsetningsindeks ${m.first} → ${m.last} siste 14 mnd (2021=100, sesongjustert)`,
    ]);
  }

  // Konkurransebilde fra GEO-settene
  const geo = await pool.query<{ name: string; competitor_brands: string[]; runs: number }>(
    `SELECT ps.name, ps.competitor_brands,
            (SELECT count(*) FROM geo_probe_runs r WHERE r.prompt_set_id = ps.id)::int AS runs
       FROM geo_prompt_sets ps
      WHERE ps.organization_id = $1::uuid AND ps.status = 'approved'
        AND (${def.setNamePatterns.map((_, i) => `ps.name LIKE $${i + 2}`).join(" OR ")})`,
    [organizationId, ...def.setNamePatterns],
  );
  for (const g of geo.rows) {
    const comp = (g.competitor_brands ?? []).slice(0, 6).join(", ");
    if (comp) raw.push(["geo-discovery", `Konkurrenter (${g.name})`, comp]);
    if (g.runs > 0) {
      raw.push(["geo-måling", `AI-synlighetsmåling (${g.name})`, `${g.runs} systematiske målinger gjennomført — metodikk i drift`]);
    }
  }

  // Anbudsaktivitet
  const tenders = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM trigger_events
      WHERE organization_id = $1::uuid AND kind IN ('tender','award')
        AND (${def.setNamePatterns.map((_, i) => `matched_topic LIKE $${i + 2}`).join(" OR ")})`,
    [organizationId, ...def.setNamePatterns],
  );
  if ((tenders.rows[0]?.n ?? 0) > 0) {
    raw.push(["doffin/ted", "Offentlig etterspørsel", `${tenders.rows[0].n} relevante anbud/tildelinger fanget i feltet`]);
  }

  return raw.map(([source, label, value], i) => ({ n: i + 1, source, label, value }));
}

/** IN-søknadens seksjoner — fra research mot innovasjonnorge.no 2026-07-13. */
export const IN_SECTIONS: Array<{ key: string; title: string; guidance: string }> = [
  { key: "problem", title: "Problemet og behovet", guidance: "Hvilket konkret problem løses, for hvem, og hvor stort er det? Bruk markeds- og lønnsomhetstall." },
  { key: "losning", title: "Løsningen og nyhetsverdien", guidance: "Hva er innovasjonshøyden UT OVER bransjestandard? IN vektlegger nyhetsverdi mot eksisterende løsninger." },
  { key: "marked", title: "Markedet og kundene", guidance: "Adresserbart marked med tall, kundesegmenter, og — for Oppstartstilskudd 2 — hva kundetesting har vist." },
  { key: "konkurrenter", title: "Konkurrenter og differensiering", guidance: "Hvem konkurrerer dere mot (dokumentert, ikke antatt) og hva er varig fortrinn?" },
  { key: "vekst", title: "Internasjonalt vekstpotensial", guidance: "IN-krav: betydelig internasjonalt potensial. Konkret ekspansjonsvei, ikke ambisjons-prosa." },
  { key: "gjennomforing", title: "Gjennomføringsevne og team", guidance: "IN-krav: kompetanse/erfaring til å gjennomføre + kapitaltilgang og eierinvolvering. Hva er allerede LEVERT?" },
  { key: "milepaler", title: "Milepæler og budsjett", guidance: "Hva pengene brukes til, milepælsatt — IN utbetaler mot milepæler. Oppgi annen offentlig støtte søkt/mottatt." },
];

export function validateGrantDraft(text: string, facts: GrantFact[]): boolean {
  const valid = new Set(facts.map((f) => f.n));
  const cited = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (cited.length < 2) return false;
  return cited.every((c) => valid.has(c));
}

const GRANT_SYSTEM = `Du er forretningsrådgiveren i Creatorhubns plattform og hjelper eieren å skrive søknad til Innovasjon Norge.
Du får: LØSNINGS-BEVIS (nummererte fakta fra plattformens egne data), SEKSJON med IN-veiledning, og eventuelt eierens egne notater.

Regler:
- Skriv seksjonen på norsk, saklig og konkret — søknadsspråk, ikke salgsspråk. Maks ~220 ord.
- Faktapåstander om marked/tall/konkurrenter MÅ sitere [n] fra beviset. ALDRI fabrikker tall eller referanser.
- Det du ikke har bevis for men som seksjonen trenger (f.eks. budsjettall, teamets CV), marker som [FYLL INN: ...] — eieren skal se hullene, ikke få dem gjettet.
- Der eierens notater gir informasjon, bruk dem — merket som eierens egne opplysninger.
- IN vektlegger nyhetsverdi, internasjonalt vekstpotensial og gjennomføringsevne — vinkle mot seksjonens veiledning.`;

export interface GrantDraft {
  solution: SolutionKey;
  section: string;
  text: string;
  facts: GrantFact[];
}

export async function draftGrantSection(
  pool: Pool,
  organizationId: string,
  args: { solution: SolutionKey; sectionKey: string; userNotes?: string },
): Promise<{ draft: GrantDraft } | { error: string; status: number }> {
  const section = IN_SECTIONS.find((s) => s.key === args.sectionKey);
  if (!section) return { error: "ukjent_seksjon", status: 400 };
  if (!SOLUTIONS[args.solution]) return { error: "ukjent_losning", status: 400 };

  const facts = await buildSolutionEvidence(pool, organizationId, args.solution);
  if (facts.length < 3) return { error: "for_tynt_bevisgrunnlag", status: 422 };

  const anthropic = getAnthropic();
  if (!anthropic) return { error: "anthropic_ikke_konfigurert", status: 503 };

  const response = await anthropic.messages.create({
    model: GRANT_MODEL,
    max_tokens: 800,
    system: GRANT_SYSTEM,
    messages: [{
      role: "user",
      content: [
        `SEKSJON: ${section.title}`,
        `IN-VEILEDNING: ${section.guidance}`,
        "",
        "LØSNINGS-BEVIS:",
        ...facts.map((f) => `[${f.n}] (${f.source}) ${f.label}: ${f.value}`),
        ...(args.userNotes?.trim() ? ["", `EIERENS NOTATER: ${args.userNotes.trim().slice(0, 1500)}`] : []),
      ].join("\n"),
    }],
  });
  if (response.usage) {
    await recordAiUsage(pool, {
      organizationId, provider: "anthropic", operation: "grant-application",
      calls: 1, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    });
  }
  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();

  if (!validateGrantDraft(text, facts)) {
    return { error: "utkast_besto_ikke_siterings_validering", status: 502 };
  }
  return { draft: { solution: args.solution, section: section.title, text, facts } };
}
