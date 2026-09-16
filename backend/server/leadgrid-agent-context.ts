/**
 * leadgrid-agent-context.ts
 *
 * Lese-only kontekstblokk for The Role Room-agentens chat når prosjektet er et
 * Leadgrid-prosjekt (leadgrid-agent-access.ts). Speiler mønsteret i
 * role-room-agent-marketing-context.ts: best-effort, aggregert, kaster aldri,
 * env-gatet for rollback (LEADGRID_AGENT_CONTEXT=off).
 *
 *   leadgrid_marketing → organisasjonsprofil (organizations), selskapsprofil
 *                        fra kartleggingen (role_room_research_versions med
 *                        lg-nøkkel) og aktiv markedsplan (kanaler, posisjonering,
 *                        pilarnavn).
 *   leadgrid_sales     → antall leads per status og forfalte oppfølginger for
 *                        prosjektet (crm_customers, org+prosjekt-scopet). Kun tall.
 *
 * Ingen navn, e-post eller telefon — agentens persona henviser brukeren til
 * Leadgrid-fanene for enkelt-leads.
 */

import type { Pool } from "pg";
import type { LeadgridAgentProject } from "./leadgrid-agent-access.js";
import { fetchActiveMarketingPlan } from "./role-room-marketing-plan.js";
import { loadLatestResearchVersion } from "./role-room-research-versions.js";

const HEADER = "### Leadgrid-kontekst (aggregert, sanntid)";

function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => clip(v, 120))
    .filter((v): v is string => Boolean(v))
    .slice(0, max);
}

async function buildMarketingSection(
  pool: Pool,
  project: LeadgridAgentProject,
): Promise<string[]> {
  const lines: string[] = [];

  const org = await pool
    .query<{
      name: string | null;
      website: string | null;
      nace_code: string | null;
      nace_description: string | null;
      city: string | null;
    }>(
      `SELECT name, website, nace_code, nace_description, city
         FROM organizations
        WHERE id = $1::uuid
        LIMIT 1`,
      [project.organizationId],
    )
    .then((r) => r.rows[0] ?? null)
    .catch(() => null);
  if (org) {
    const parts = [
      org.name ? `Organisasjon: ${org.name}` : null,
      org.website ? `nettsted: ${org.website}` : null,
      org.nace_code ? `NACE ${org.nace_code}${org.nace_description ? ` (${org.nace_description})` : ""}` : null,
      org.city ? `hovedsete: ${org.city}` : null,
    ].filter(Boolean);
    if (parts.length) lines.push(`ORGANISASJON: ${parts.join(" · ")}.`);
  }

  const latest = await loadLatestResearchVersion(pool, project.projectKey).catch(() => null);
  const result = (latest?.serializedResult ?? null) as Record<string, unknown> | null;
  const profile = (result?.companyProfile ?? null) as Record<string, unknown> | null;
  if (profile) {
    const summary = clip(profile.summary ?? profile.description, 400);
    const offerings = stringList(profile.offerings, 5);
    const audience = stringList(profile.targetAudience, 4);
    const industry = clip(profile.industry, 80);
    const model = clip(profile.businessModel, 40);
    const bits = [
      industry ? `bransje: ${industry}` : null,
      model ? `forretningsmodell: ${model}` : null,
      summary ? `sammendrag: ${summary}` : null,
      offerings.length ? `tilbud: ${offerings.join("; ")}` : null,
      audience.length ? `målgrupper: ${audience.join("; ")}` : null,
    ].filter(Boolean);
    if (bits.length) {
      lines.push(`KARTLEGGING (versjon ${latest?.versionNumber ?? "?"}): ${bits.join(" · ")}.`);
    }
  }

  const plan = await fetchActiveMarketingPlan(pool, project.projectKey).catch(() => null);
  if (plan) {
    const cs = plan.strategy?.channelStrategy;
    const pos = plan.strategy?.positioning;
    const pillars = (plan.pillars ?? [])
      .map((p) => clip((p as { name?: unknown }).name, 80))
      .filter((n): n is string => Boolean(n))
      .slice(0, 6);
    const bits = [
      `status: ${plan.status}`,
      cs?.primary ? `primærkanal: ${cs.primary}${cs.secondary?.length ? ` (sekundært: ${cs.secondary.join(", ")})` : ""}` : null,
      typeof cs?.cadencePerWeek === "number" ? `${cs.cadencePerWeek} poster/uke` : null,
      pos?.valueProp ? `verdiløfte: ${clip(pos.valueProp, 200)}` : null,
      pillars.length ? `pilarer: ${pillars.join(" | ")}` : null,
    ].filter(Boolean);
    lines.push(`MARKEDSPLAN: ${bits.join(" · ")}.`);
  } else {
    lines.push("MARKEDSPLAN: ingen aktiv plan ennå — foreslå å kartlegge organisasjonen og generere plan på /leadgrid/markedsforing.");
  }

  return lines;
}

async function buildSalesSection(
  pool: Pool,
  project: LeadgridAgentProject,
): Promise<string[]> {
  const lines: string[] = [];
  const byStatus = await pool
    .query<{ lead_status: string | null; n: number }>(
      `SELECT lead_status, COUNT(*)::int AS n
         FROM crm_customers
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND archived_at IS NULL
        GROUP BY lead_status
        ORDER BY n DESC`,
      [project.organizationId, project.leadgridProjectId],
    )
    .then((r) => r.rows)
    .catch(() => []);
  if (byStatus.length) {
    const total = byStatus.reduce((acc, row) => acc + Number(row.n), 0);
    const parts = byStatus.map((row) => `${row.lead_status ?? "ukjent"}=${row.n}`);
    lines.push(`PIPELINE (${total} leads): ${parts.join(", ")}.`);
  } else {
    lines.push("PIPELINE: ingen leads registrert i prosjektet ennå.");
  }

  const overdue = await pool
    .query<{ overdue: number; due_today: number }>(
      `SELECT COUNT(*) FILTER (WHERE next_follow_up_at < NOW())::int AS overdue,
              COUNT(*) FILTER (WHERE next_follow_up_at::date = CURRENT_DATE)::int AS due_today
         FROM crm_customers
        WHERE organization_id = $1::uuid
          AND project_id = $2
          AND archived_at IS NULL
          AND next_follow_up_at IS NOT NULL`,
      [project.organizationId, project.leadgridProjectId],
    )
    .then((r) => r.rows[0] ?? null)
    .catch(() => null);
  if (overdue) {
    lines.push(`OPPFØLGING: ${overdue.overdue} forfalte, ${overdue.due_today} forfaller i dag.`);
  }
  return lines;
}

export async function buildLeadgridAgentContextBlock(
  pool: Pool,
  input: { project: LeadgridAgentProject },
): Promise<string | null> {
  if (process.env.LEADGRID_AGENT_CONTEXT === "off") return null;
  const { project } = input;
  try {
    const lines =
      project.kind === "leadgrid_marketing"
        ? await buildMarketingSection(pool, project)
        : await buildSalesSection(pool, project);
    if (lines.length === 0) return null;
    return [
      HEADER,
      `Prosjekt: ${project.projectName} (modus: ${project.kind === "leadgrid_marketing" ? "markedssjef" : "salg"}).`,
      ...lines,
    ].join("\n");
  } catch (err) {
    console.warn("[leadgrid-agent-context] failed (omitted)", err instanceof Error ? err.message : err);
    return null;
  }
}
