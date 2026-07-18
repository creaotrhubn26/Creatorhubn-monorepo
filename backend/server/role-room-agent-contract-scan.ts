/**
 * role-room-agent-contract-scan.ts — kontrakt-skann (Daniels bestilling:
 * «last inn en signert kontrakt og kjør den som et eget skann, sjekk at
 * hele det økonomiske oppsettet er fylt inn»).
 *
 * LLM-en EKSTRAHERER strukturerte økonomiske vilkår fra kontraktteksten;
 * redeligheten håndheves deterministisk etterpå:
 *
 *   1. VERBATIM-VAKT: beløp og datoer modellen påstår må faktisk finnes
 *      i kontraktteksten (siffer-normalisert substring-sjekk). Verdier
 *      som ikke gjenfinnes DROPPES og rapporteres som forkastet — en
 *      hallusinert sum skal aldri bli fakturagrunnlag.
 *   2. MANGLER-SJEKKLISTE: et komplett økonomisk oppsett krever totalsum,
 *      betalingsplan, forfall, fakturamåte, MVA-håndtering, leveranser og
 *      bruksrettigheter — det som ikke ble funnet listes eksplisitt som
 *      hull som må avklares med klienten, aldri fylles med gjetting.
 *
 * Samme mønster som tender-strategy: on-demand (koster tokens), forbruk
 * bokføres via recordAiUsage.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Pool } from "pg";
import { recordAiUsage } from "./integrations/ai-usage.js";

const SCAN_MODEL = "claude-sonnet-5";
const MAX_CONTRACT_CHARS = 60_000;

let client: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// ─────────────────────────────────────────────────────────────────────
// Struktur
// ─────────────────────────────────────────────────────────────────────

export interface ContractPaymentTerm {
  label: string;
  /** Beløp i NOK (eller kontraktens valuta) — verbatim-validert. */
  amount: string | null;
  /** Utløser/forfall slik kontrakten beskriver det. */
  trigger: string | null;
}

export interface ContractEconomics {
  supplier: string | null;
  client: string | null;
  totalAmount: string | null;
  currency: string | null;
  vatHandling: string | null;
  paymentTerms: ContractPaymentTerm[];
  invoicing: string | null;
  deliverables: string[];
  usageRights: string | null;
  deadlines: string[];
  terminationTerms: string | null;
}

export interface ContractScanResult {
  economics: ContractEconomics;
  /** Sjekkliste-hull: må avklares med klienten — aldri gjettes. */
  missingPoints: string[];
  /** Verdier LLM-en påsto men som ikke fantes i teksten — droppet. */
  rejectedValues: string[];
  model: string;
  scannedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// Verbatim-vakt (enhetstestet)
// ─────────────────────────────────────────────────────────────────────

/** Normaliser sifferstrenger: fjern mellomrom/punktum-tusenskille o.l. */
function digitsOf(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/**
 * Finnes beløpet/datoen i kontraktteksten? Sifferbasert: «120 000», i
 * kontrakt som «kr 120.000,-» matcher (samme siffersekvens). Korte tall
 * (< 3 siffer) godtas uten sjekk — de er ikke identifiserende nok til å
 * verifiseres meningsfullt (f.eks. «14 dager»).
 */
export function valueAppearsInText(value: string, contractText: string): boolean {
  const digits = digitsOf(value);
  if (digits.length < 3) return true;
  return digitsOf(contractText).includes(digits);
}

/** Dropp beløp/datoer som ikke gjenfinnes; returner hva som ble forkastet. */
export function enforceVerbatim(
  economics: ContractEconomics,
  contractText: string,
): { economics: ContractEconomics; rejected: string[] } {
  const rejected: string[] = [];
  const checked = (value: string | null, label: string): string | null => {
    if (value === null) return null;
    if (valueAppearsInText(value, contractText)) return value;
    rejected.push(`${label}: «${value}»`);
    return null;
  };
  return {
    economics: {
      ...economics,
      totalAmount: checked(economics.totalAmount, "totalsum"),
      paymentTerms: economics.paymentTerms.map((t) => ({
        ...t,
        amount: checked(t.amount, `betalingsplan «${t.label}»`),
      })),
      deadlines: economics.deadlines.filter((d) => {
        // En «frist» uten ett eneste siffer er ikke en frist (fanget i
        // medside-testen: en output-vakts [BLOCKED]-markør slapp gjennom
        // fordi verbatim-sjekken godtar korte/sifferløse verdier).
        if (digitsOf(d).length === 0) {
          rejected.push(`frist uten dato: «${d}»`);
          return false;
        }
        if (valueAppearsInText(d, contractText)) return true;
        rejected.push(`frist: «${d}»`);
        return false;
      }),
    },
    rejected,
  };
}

/** Sjekklisten for et komplett økonomisk oppsett (doc: avtale → fakturagrunnlag). */
export function findMissingPoints(economics: ContractEconomics): string[] {
  const missing: string[] = [];
  if (!economics.totalAmount) missing.push("Totalsum — ikke funnet i kontrakten");
  if (economics.paymentTerms.length === 0) missing.push("Betalingsplan/milepæler — ikke funnet");
  if (!economics.paymentTerms.some((t) => t.trigger)) {
    if (economics.paymentTerms.length > 0) missing.push("Forfall/utløsere for betalingene — ikke funnet");
  }
  if (!economics.invoicing) missing.push("Fakturamåte (EHF/e-post) og betalingsfrist — ikke funnet");
  if (!economics.vatHandling) missing.push("MVA-håndtering — ikke funnet");
  if (economics.deliverables.length === 0) missing.push("Leveranser — ikke spesifisert");
  if (!economics.usageRights) missing.push("Bruksrettigheter til materialet — ikke funnet");
  if (!economics.terminationTerms) missing.push("Avbestillings-/termineringsvilkår — ikke funnet");
  return missing;
}

// ─────────────────────────────────────────────────────────────────────
// Skann
// ─────────────────────────────────────────────────────────────────────

const SCAN_SYSTEM = `Du leser en SIGNERT kontrakt for en norsk produksjonsleverandør og trekker ut de økonomiske vilkårene.

Svar KUN med gyldig JSON (ingen markdown) med nøyaktig disse feltene:
{
  "supplier": string|null,        // leverandør-parten slik den står i kontrakten
  "client": string|null,          // kunde-parten
  "totalAmount": string|null,     // totalsum SLIK DEN STÅR i kontrakten (f.eks. "120 000")
  "currency": string|null,
  "vatHandling": string|null,     // eks/inkl MVA slik kontrakten sier det
  "paymentTerms": [{"label": string, "amount": string|null, "trigger": string|null}],
  "invoicing": string|null,       // fakturamåte og betalingsfrist
  "deliverables": [string],
  "usageRights": string|null,
  "deadlines": [string],          // datoer/frister slik de står
  "terminationTerms": string|null
}

ABSOLUTT REGEL: skriv beløp og datoer NØYAKTIG slik de står i kontrakten — de valideres maskinelt mot teksten, og verdier som ikke gjenfinnes forkastes. Finner du ikke et felt: null/tom liste. ALDRI gjett.`;

export async function scanContract(
  pool: Pool,
  opts: { projectId: string; contractText: string; userLabel: string },
): Promise<{ ok: true; result: ContractScanResult } | { ok: false; error: string; status: number }> {
  const text = opts.contractText.trim();
  if (text.length < 200) {
    return { ok: false, error: "kontraktteksten_er_for_kort_til_et_aerlig_skann", status: 422 };
  }
  const anthropic = getAnthropic();
  if (!anthropic) return { ok: false, error: "anthropic_ikke_konfigurert", status: 503 };

  const response = await anthropic.messages.create({
    model: SCAN_MODEL,
    max_tokens: 1500,
    system: SCAN_SYSTEM,
    messages: [{ role: "user", content: text.slice(0, MAX_CONTRACT_CHARS) }],
  });
  if (response.usage) {
    await recordAiUsage(pool, {
      organizationId: opts.projectId,
      provider: "anthropic",
      operation: "contract-scan",
      calls: 1,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    }).catch(() => undefined);
  }

  const raw = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "");

  let parsed: ContractEconomics;
  try {
    const json = JSON.parse(raw) as Partial<ContractEconomics>;
    parsed = {
      supplier: json.supplier ?? null,
      client: json.client ?? null,
      totalAmount: json.totalAmount ?? null,
      currency: json.currency ?? null,
      vatHandling: json.vatHandling ?? null,
      paymentTerms: Array.isArray(json.paymentTerms)
        ? json.paymentTerms.map((t) => ({
            label: String(t?.label ?? ""),
            amount: t?.amount != null ? String(t.amount) : null,
            trigger: t?.trigger != null ? String(t.trigger) : null,
          }))
        : [],
      invoicing: json.invoicing ?? null,
      deliverables: Array.isArray(json.deliverables) ? json.deliverables.map(String) : [],
      usageRights: json.usageRights ?? null,
      deadlines: Array.isArray(json.deadlines) ? json.deadlines.map(String) : [],
      terminationTerms: json.terminationTerms ?? null,
    };
  } catch {
    return { ok: false, error: "skann_svaret_var_ikke_gyldig_json", status: 502 };
  }

  const { economics, rejected } = enforceVerbatim(parsed, text);
  const result: ContractScanResult = {
    economics,
    missingPoints: findMissingPoints(economics),
    rejectedValues: rejected,
    model: SCAN_MODEL,
    scannedAt: new Date().toISOString(),
  };

  // Persister siste skann per prosjekt (30 dager) — gjenåpning av
  // dialogen skal ikke kreve nytt LLM-kall.
  try {
    await pool.query(
      `INSERT INTO role_room_research_cache (project_id, cache_key, payload, fetched_at, expires_at)
       VALUES ($1, 'contract_scan', $2::jsonb, now(), now() + interval '30 days')
       ON CONFLICT (project_id, cache_key) DO UPDATE SET
         payload = EXCLUDED.payload, fetched_at = EXCLUDED.fetched_at, expires_at = EXCLUDED.expires_at`,
      [opts.projectId, JSON.stringify(result)],
    );
  } catch {
    // cache er best effort — skannet returneres uansett
  }

  return { ok: true, result };
}

export async function getLatestContractScan(
  pool: Pool,
  projectId: string,
): Promise<ContractScanResult | null> {
  try {
    const r = await pool.query<{ payload: ContractScanResult }>(
      `SELECT payload FROM role_room_research_cache
        WHERE project_id = $1 AND cache_key = 'contract_scan' AND expires_at > now()
        LIMIT 1`,
      [projectId],
    );
    return r.rows[0]?.payload ?? null;
  } catch {
    return null;
  }
}
