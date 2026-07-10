/**
 * geo-prompt-set-service.ts
 *
 * GEO Visibility MVP punkt 1 (docs/integration-audit/08): genererer norske
 * kjøpsintensjons-prompts for en bransje/region via Claude, lagret som
 * 'draft' til kunden godkjenner listen. Prompt-settet er produktinnhold —
 * det kjøres ALDRI mot motorene før status='approved'.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

export type GeoPromptIntent = "buying" | "comparison" | "howto" | "local";

export interface GeoPrompt {
  id: string;
  text: string;
  topic: string;
  intent: GeoPromptIntent;
  enabled: boolean;
  sortOrder: number;
}

export interface GeoPromptSet {
  id: string;
  organizationId: string | null;
  workspaceOwnerUserId: string;
  projectId: string | null;
  name: string;
  industry: string;
  region: string;
  targetBrand: string;
  targetDomain: string | null;
  competitorBrands: string[];
  status: "draft" | "approved" | "archived";
  createdAt: string;
  updatedAt: string;
}

const GENERATION_SYSTEM_PROMPT = `Du lager testspørsmål («prompts») som norske småbedrifts-kunder realistisk ville stilt en AI-assistent (ChatGPT/Claude/Perplexity) når de leter etter en løsning i en gitt bransje.

REGLER:
- Skriv naturlig norsk slik ekte folk spør — ikke markedsføringsspråk.
- ALDRI nevn målmerkevaren eller konkurrentene i selve spørsmålet — vi måler
  om AI-en nevner dem uoppfordret.
- Spre spørsmålene over fire intents:
  "buying"      → leter etter verktøy/tjeneste ("beste system for …")
  "comparison"  → sammenlikner alternativer ("hva bør jeg velge for …")
  "howto"       → vil løse problemet ("hvordan skaffe flere kunder som …")
  "local"       → norsk/lokal vinkling ("… i Norge", "… i Bergen")
- Grupper i 4-8 gjenbrukbare "topic"-nøkler i kebab-case (f.eks.
  "skaffe-leads", "velge-crm", "pris-og-verdi").

Returner KUN gyldig JSON:
{"prompts":[{"text":"...","topic":"...","intent":"buying"}]}`;

function tryParseJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

export interface GeneratePromptSetInput {
  workspaceOwnerUserId: string;
  organizationId?: string | null;
  projectId?: string | null;
  name?: string;
  industry: string;
  region?: string;
  targetBrand: string;
  targetDomain?: string | null;
  competitorBrands?: string[];
  /** Antall prompts (default 30, maks 50 per spec). */
  count?: number;
}

interface GeneratedPrompt {
  text: string;
  topic: string;
  intent: GeoPromptIntent;
}

/** Eksportert for test — ren validering/sanering av LLM-output. */
export function sanitizeGeneratedPrompts(
  raw: unknown,
  args: { targetBrand: string; competitorBrands: string[]; max: number },
): GeneratedPrompt[] {
  const parsed = raw as { prompts?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.prompts)) return [];
  const forbidden = [args.targetBrand, ...args.competitorBrands]
    .map((b) => b.trim().toLowerCase())
    .filter(Boolean);
  const validIntents = new Set(["buying", "comparison", "howto", "local"]);
  const seen = new Set<string>();
  const out: GeneratedPrompt[] = [];

  for (const p of parsed.prompts as Array<Record<string, unknown>>) {
    if (typeof p?.text !== "string" || typeof p?.topic !== "string") continue;
    const text = p.text.trim();
    const topic = p.topic.trim().toLowerCase()
      .replace(/[^a-z0-9æøå-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (text.length < 10 || text.length > 300 || !topic) continue;
    const lower = text.toLowerCase();
    // Regel: prompts skal ikke nevne merkevarene vi måler
    if (forbidden.some((b) => lower.includes(b))) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push({
      text,
      topic,
      intent: validIntents.has(String(p.intent)) ? (p.intent as GeoPromptIntent) : "buying",
    });
    if (out.length >= args.max) break;
  }
  return out;
}

export async function generatePromptSet(
  pool: Pool,
  input: GeneratePromptSetInput,
): Promise<{ promptSet: GeoPromptSet; prompts: GeoPrompt[] }> {
  const count = Math.min(Math.max(input.count ?? 30, 10), 50);
  const region = input.region?.trim() || "Norge";
  const competitorBrands = (input.competitorBrands ?? []).slice(0, 15);

  const client = getAnthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4000,
    system: GENERATION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content:
          `Bransje: ${input.industry}\nRegion: ${region}\n` +
          `Målmerkevare (skal IKKE nevnes i spørsmålene): ${input.targetBrand}\n` +
          (competitorBrands.length > 0
            ? `Konkurrenter (skal heller IKKE nevnes): ${competitorBrands.join(", ")}\n`
            : "") +
          `Lag ${count} spørsmål.`,
      },
    ],
  });

  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  const prompts = sanitizeGeneratedPrompts(tryParseJson(text), {
    targetBrand: input.targetBrand,
    competitorBrands,
    max: count,
  });
  if (prompts.length < 5) {
    throw new Error("geo_prompt_generation_insufficient");
  }

  const setRow = await pool.query<{ id: string; created_at: string; updated_at: string }>(
    `INSERT INTO geo_prompt_sets (
       organization_id, workspace_owner_user_id, project_id, name,
       industry, region, target_brand, target_domain, competitor_brands
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id::text, created_at::text, updated_at::text`,
    [
      input.organizationId ?? null,
      input.workspaceOwnerUserId,
      input.projectId ?? null,
      input.name?.trim() || `${input.industry} — AI-synlighet`,
      input.industry,
      region,
      input.targetBrand,
      input.targetDomain ?? null,
      JSON.stringify(competitorBrands),
    ],
  );
  const setId = setRow.rows[0].id;

  const saved: GeoPrompt[] = [];
  for (let i = 0; i < prompts.length; i++) {
    const p = prompts[i];
    const r = await pool.query<{ id: string }>(
      `INSERT INTO geo_prompts (prompt_set_id, text, topic, intent, sort_order)
       VALUES ($1::uuid, $2, $3, $4, $5) RETURNING id::text`,
      [setId, p.text, p.topic, p.intent, i],
    );
    saved.push({ id: r.rows[0].id, ...p, enabled: true, sortOrder: i });
  }

  return {
    promptSet: {
      id: setId,
      organizationId: input.organizationId ?? null,
      workspaceOwnerUserId: input.workspaceOwnerUserId,
      projectId: input.projectId ?? null,
      name: input.name?.trim() || `${input.industry} — AI-synlighet`,
      industry: input.industry,
      region,
      targetBrand: input.targetBrand,
      targetDomain: input.targetDomain ?? null,
      competitorBrands,
      status: "draft",
      createdAt: setRow.rows[0].created_at,
      updatedAt: setRow.rows[0].updated_at,
    },
    prompts: saved,
  };
}

interface PromptSetRow {
  id: string;
  organization_id: string | null;
  workspace_owner_user_id: string;
  project_id: string | null;
  name: string;
  industry: string;
  region: string;
  target_brand: string;
  target_domain: string | null;
  competitor_brands: string[];
  status: GeoPromptSet["status"];
  created_at: string;
  updated_at: string;
}

function rowToSet(r: PromptSetRow): GeoPromptSet {
  return {
    id: r.id,
    organizationId: r.organization_id,
    workspaceOwnerUserId: r.workspace_owner_user_id,
    projectId: r.project_id,
    name: r.name,
    industry: r.industry,
    region: r.region,
    targetBrand: r.target_brand,
    targetDomain: r.target_domain,
    competitorBrands: Array.isArray(r.competitor_brands) ? r.competitor_brands : [],
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SET_COLUMNS = `id::text, organization_id::text, workspace_owner_user_id,
  project_id, name, industry, region, target_brand, target_domain,
  competitor_brands, status, created_at::text, updated_at::text`;

export async function getPromptSet(
  pool: Pool,
  setId: string,
  workspaceOwnerUserId: string,
): Promise<{ promptSet: GeoPromptSet; prompts: GeoPrompt[] } | null> {
  const r = await pool.query<PromptSetRow>(
    `SELECT ${SET_COLUMNS} FROM geo_prompt_sets
      WHERE id = $1::uuid AND workspace_owner_user_id = $2`,
    [setId, workspaceOwnerUserId],
  );
  if (!r.rows[0]) return null;
  const p = await pool.query<{
    id: string;
    text: string;
    topic: string;
    intent: GeoPromptIntent;
    enabled: boolean;
    sort_order: number;
  }>(
    `SELECT id::text, text, topic, intent, enabled, sort_order
       FROM geo_prompts WHERE prompt_set_id = $1::uuid ORDER BY sort_order`,
    [setId],
  );
  return {
    promptSet: rowToSet(r.rows[0]),
    prompts: p.rows.map((row) => ({
      id: row.id,
      text: row.text,
      topic: row.topic,
      intent: row.intent,
      enabled: row.enabled,
      sortOrder: row.sort_order,
    })),
  };
}

export async function listPromptSets(
  pool: Pool,
  workspaceOwnerUserId: string,
): Promise<GeoPromptSet[]> {
  const r = await pool.query<PromptSetRow>(
    `SELECT ${SET_COLUMNS} FROM geo_prompt_sets
      WHERE workspace_owner_user_id = $1
      ORDER BY created_at DESC LIMIT 50`,
    [workspaceOwnerUserId],
  );
  return r.rows.map(rowToSet);
}

export async function approvePromptSet(
  pool: Pool,
  setId: string,
  workspaceOwnerUserId: string,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE geo_prompt_sets SET status = 'approved', updated_at = now()
      WHERE id = $1::uuid AND workspace_owner_user_id = $2 AND status = 'draft'`,
    [setId, workspaceOwnerUserId],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function setPromptEnabled(
  pool: Pool,
  setId: string,
  promptId: string,
  workspaceOwnerUserId: string,
  enabled: boolean,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE geo_prompts gp SET enabled = $4
       FROM geo_prompt_sets gps
      WHERE gp.id = $2::uuid AND gp.prompt_set_id = $1::uuid
        AND gps.id = gp.prompt_set_id AND gps.workspace_owner_user_id = $3`,
    [setId, promptId, workspaceOwnerUserId, enabled],
  );
  return (r.rowCount ?? 0) > 0;
}
