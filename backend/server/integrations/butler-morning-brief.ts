/**
 * butler-morning-brief.ts — JARVIS J1: morgenbriefen
 *
 * Kjøres av daglig-cronen ETTER detektorer+diagnoser: samler nattens
 * materiale (nye innsikter, frister, risiko, målinger) som nummerert
 * faktaliste og lar butleren skrive dagens brief — med samme
 * siterings-plikt som alt annet.
 *
 * Redelighet:
 *  - Stille natt = deterministisk kort melding, INGEN LLM-kall (null
 *    tokens for å si «ingenting skjedde»).
 *  - Hver påstand i generert brief siterer [n]; fabrikkert → forkastes
 *    og en deterministisk fallback-brief lagres i stedet (butleren får
 *    aldri diktet seg inn i morgenkaffen din).
 *  - Én brief per dag (PK org+dato) — re-kjøring er no-op.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import { recordAiUsage } from "./ai-usage.js";

const BRIEF_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface BriefFact {
  n: number;
  category: string;
  text: string;
}

/** Nattens materiale som fakta (ren aggregering — enhetstestbar SQL-form). */
export async function collectBriefFacts(pool: Pool, organizationId: string): Promise<BriefFact[]> {
  const rows: Array<{ category: string; text: string }> = [];

  const insights = await pool.query<{ severity: string; title: string; n: number }>(
    `SELECT severity, title, count(*) OVER (PARTITION BY severity)::int AS n
       FROM insights
      WHERE organization_id = $1::uuid AND detected_at > now() - interval '26 hours'
        AND status = 'new'
      ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'important' THEN 1 ELSE 2 END,
               detected_at DESC
      LIMIT 12`,
    [organizationId],
  );
  for (const r of insights.rows) {
    rows.push({ category: `innsikt/${r.severity}`, text: r.title.slice(0, 150) });
  }

  const deadlines = await pool.query<{ title: string; deadline: string }>(
    `SELECT title, raw->>'deadline' AS deadline FROM trigger_events
      WHERE organization_id = $1::uuid AND kind = 'tender'
        AND (raw->>'deadline')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 3
      ORDER BY (raw->>'deadline')::date LIMIT 3`,
    [organizationId],
  );
  for (const d of deadlines.rows) {
    rows.push({ category: "frist", text: `${d.deadline}: ${d.title.slice(0, 120)}` });
  }

  const runs = await pool.query<{ name: string; status: string; answers_total: number }>(
    `SELECT ps.name, r.status, r.answers_total
       FROM geo_probe_runs r JOIN geo_prompt_sets ps ON ps.id = r.prompt_set_id
      WHERE ps.organization_id = $1::uuid AND r.started_at > now() - interval '26 hours'
      ORDER BY r.started_at DESC LIMIT 6`,
    [organizationId],
  );
  for (const r of runs.rows) {
    rows.push({ category: "måling", text: `${r.name}: ${r.status} (${r.answers_total} svar)` });
  }

  const risk = await pool.query<{ c: number }>(
    `SELECT count(*)::int AS c FROM trigger_events
      WHERE organization_id = $1::uuid AND kind = 'risk'
        AND created_at > now() - interval '26 hours'`,
    [organizationId],
  );
  if (risk.rows[0]?.c === 0) {
    rows.push({ category: "risiko", text: "Konkursvakten: ingen nye risikofunn i porteføljen" });
  }

  return rows.map((r, i) => ({ n: i + 1, ...r }));
}

/** Kun stille-natt hvis det VERKEN finnes innsikter, frister eller målinger. */
export function isQuietNight(facts: BriefFact[]): boolean {
  return !facts.some((f) => f.category !== "risiko");
}

export function validateBriefText(text: string, facts: BriefFact[]): boolean {
  const valid = new Set(facts.map((f) => f.n));
  const cited = [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
  if (cited.length < 2) return false;
  return cited.every((c) => valid.has(c));
}

const BRIEF_SYSTEM = `Du er butleren som skriver morgenbriefen til eieren av en markedsintelligens-plattform (norsk).
Du får nattens fakta som nummerert liste. Skriv en kort brief (maks ~130 ord):
- Start med det viktigste (kritisk > viktig > resten).
- HVER påstand siterer [n]. Ingen fakta utenfor listen.
- Avslutt med ÉN anbefalt handling for dagen (kan stå usitert, men må følge av fakta).
- Tonen er rolig og presis — en butler, ikke en selger. Ingen utropstegn.`;

export interface MorningBriefResult {
  organizations: number;
  generated: number;
  quiet: number;
  skippedExisting: number;
  errors: string[];
}

export async function runMorningBriefs(pool: Pool): Promise<MorningBriefResult> {
  const orgs = await pool.query<{ id: string }>(
    `SELECT DISTINCT organization_id::text AS id FROM geo_prompt_sets
      WHERE status = 'approved' AND organization_id IS NOT NULL`,
  );
  let generated = 0;
  let quiet = 0;
  let skippedExisting = 0;
  const errors: string[] = [];

  for (const org of orgs.rows) {
    try {
      const exists = await pool.query(
        `SELECT 1 FROM morning_briefs WHERE organization_id = $1::uuid AND brief_date = CURRENT_DATE`,
        [org.id],
      );
      if ((exists.rowCount ?? 0) > 0) {
        skippedExisting += 1;
        continue;
      }

      const facts = await collectBriefFacts(pool, org.id);
      let content: string;
      let kind: "generated" | "quiet";

      if (isQuietNight(facts)) {
        kind = "quiet";
        content =
          "Stille natt: ingen nye innsikter, frister eller målinger. " +
          (facts.some((f) => f.category === "risiko")
            ? "Konkursvakten melder alt friskt i porteføljen."
            : "");
      } else {
        const anthropic = getAnthropic();
        if (!anthropic) {
          errors.push(`${org.id}: ANTHROPIC_API_KEY mangler`);
          continue;
        }
        const response = await anthropic.messages.create({
          model: BRIEF_MODEL,
          max_tokens: 450,
          system: BRIEF_SYSTEM,
          messages: [{
            role: "user",
            content: facts.map((f) => `[${f.n}] (${f.category}) ${f.text}`).join("\n"),
          }],
        });
        if (response.usage) {
          await recordAiUsage(pool, {
            organizationId: org.id,
            provider: "anthropic",
            operation: "morning-brief",
            calls: 1,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          });
        }
        const raw = response.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n")
          .trim();

        if (validateBriefText(raw, facts)) {
          kind = "generated";
          content = raw;
        } else {
          // Butleren diktet — deterministisk fallback i stedet
          kind = "quiet";
          content =
            `Natten ga ${facts.length} nye punkter (se innsikts-feeden) — ` +
            "briefen besto ikke siterings-valideringen og ble holdt tilbake.";
        }
      }

      await pool.query(
        `INSERT INTO morning_briefs (organization_id, brief_date, content, facts, kind)
         VALUES ($1::uuid, CURRENT_DATE, $2, $3::jsonb, $4)
         ON CONFLICT (organization_id, brief_date) DO NOTHING`,
        [org.id, content, JSON.stringify(facts), kind],
      );
      if (kind === "generated") generated += 1;
      else quiet += 1;
    } catch (err) {
      errors.push(`${org.id}: ${String(err).slice(0, 100)}`);
    }
  }

  return { organizations: orgs.rows.length, generated, quiet, skippedExisting, errors };
}
