/**
 * geo-experiments.ts — eksperimentloggen (forbedringsidé 3)
 *
 * «Hva endret vi når» koblet til «hva skjedde i neste måling»:
 * dokumentert årsak-virkning for AI-synlighet. Effektberegningen er
 * deterministisk: target-SOV per tema før vs. etter eksperimentdatoen
 * — og «for tidlig å måle» er et ærlig svar når ingen måling har
 * kjørt etter endringen.
 */

import type { Pool } from "pg";

export interface ExperimentWithEffect {
  id: string;
  experimentDate: string;
  description: string;
  topic: string | null;
  url: string | null;
  effect:
    | { status: "measured"; targetMentionsBefore: number; targetMentionsAfter: number; delta: number }
    | { status: "too_early"; note: string }
    | { status: "no_topic"; note: string };
}

export async function addExperiment(
  pool: Pool,
  organizationId: string,
  args: { experimentDate: string; description: string; topic?: string; url?: string },
): Promise<{ id: string }> {
  const r = await pool.query<{ id: string }>(
    `INSERT INTO geo_experiments (organization_id, experiment_date, description, topic, url)
     VALUES ($1::uuid, $2::date, $3, $4, $5) RETURNING id::text`,
    [organizationId, args.experimentDate, args.description.slice(0, 1000),
     args.topic?.slice(0, 200) ?? null, args.url?.slice(0, 500) ?? null],
  );
  return { id: r.rows[0].id };
}

export async function listExperimentsWithEffect(
  pool: Pool,
  organizationId: string,
): Promise<ExperimentWithEffect[]> {
  const experiments = await pool.query<{
    id: string; experiment_date: string; description: string; topic: string | null; url: string | null;
  }>(
    `SELECT id::text, experiment_date::text, description, topic, url
       FROM geo_experiments WHERE organization_id = $1::uuid
      ORDER BY experiment_date DESC LIMIT 30`,
    [organizationId],
  );

  const out: ExperimentWithEffect[] = [];
  for (const e of experiments.rows) {
    let effect: ExperimentWithEffect["effect"];
    if (!e.topic) {
      effect = { status: "no_topic", note: "eksperimentet har ikke tema — effekt kan ikke kobles til måling" };
    } else {
      // Target-omtaler (ai_mention der subjektet er målmerket) nærmest før/etter
      const r = await pool.query<{ when_: string; value: number }>(
        `SELECT CASE WHEN collected_at::date <= $3::date THEN 'before' ELSE 'after' END AS when_,
                metric_value AS value
           FROM (
             SELECT metric_value, collected_at,
                    ROW_NUMBER() OVER (
                      PARTITION BY (collected_at::date <= $3::date)
                      ORDER BY CASE WHEN collected_at::date <= $3::date
                               THEN -extract(epoch FROM collected_at)
                               ELSE extract(epoch FROM collected_at) END
                    ) AS rn
               FROM normalized_signals
              WHERE organization_id = $1::uuid AND metric_type = 'ai_mention'
                AND subject_type = 'own_property' AND topic ILIKE '%' || $2 || '%'
           ) x WHERE rn = 1`,
        [organizationId, e.topic, e.experiment_date],
      );
      const before = r.rows.find((x) => x.when_ === "before");
      const after = r.rows.find((x) => x.when_ === "after");
      if (!after) {
        effect = { status: "too_early", note: "ingen måling har kjørt etter eksperimentet ennå" };
      } else {
        const b = Number(before?.value ?? 0);
        const a = Number(after.value);
        effect = { status: "measured", targetMentionsBefore: b, targetMentionsAfter: a, delta: a - b };
      }
    }
    out.push({
      id: e.id, experimentDate: e.experiment_date, description: e.description,
      topic: e.topic, url: e.url, effect,
    });
  }
  return out;
}
