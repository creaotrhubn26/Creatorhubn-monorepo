/**
 * env-validator — fail-fast boot-validering av environment-variabler.
 *
 * Stabilitetsaudit § 9.3: "Prod-instansen mangler en ny env-var, kunder ser
 * cryptic feil." Denne modulen kjøres ved boot — hvis kritiske vars mangler,
 * avsluttes prosessen med exit-kode 1 og en human-readable feilmelding.
 *
 * Bruk i index.ts:
 *   import { validateEnvOrExit } from './env-validator';
 *   validateEnvOrExit();    // ↓ kalles før pool/server-boot
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *
 * Tre nivåer:
 *   - REQUIRED   = manglende = exit 1
 *   - RECOMMENDED = manglende = warn (rød i logs), men boot fortsetter
 *   - OPTIONAL   = manglende = silent (informational only)
 */

interface EnvVar {
  name: string;
  description: string;
  /** Hvis satt: validér at verdien matcher mønstret. */
  pattern?: RegExp;
  /** Verdi-eksempel for feilmelding. */
  example?: string;
}

// ─────────────────────────────────────────────────────────
// Hva produksjonen ABSOLUTT ikke kan kjøre uten
// ─────────────────────────────────────────────────────────
const REQUIRED: EnvVar[] = [
  {
    name: "DATABASE_URL",
    description:
      "PostgreSQL connection string. Uten denne kan vi ikke lese eller skrive data.",
    pattern: /^postgres(ql)?:\/\//,
    example: "postgresql://user:pass@host:5432/dbname",
  },
];

// ─────────────────────────────────────────────────────────
// Ting som degraderer produktet hvis de mangler
// ─────────────────────────────────────────────────────────
const RECOMMENDED: EnvVar[] = [
  {
    name: "OPENAI_API_KEY",
    description:
      "OpenAI-tilgang. Uten denne feiler AI-funksjoner (story-arc, brief-generering, manus-AI) med 503.",
    pattern: /^sk-/,
    example: "sk-...",
  },
  {
    name: "ANTHROPIC_API_KEY",
    description:
      "Claude-API for Role Room Agent (alternativ til OpenAI). Minst én av OPENAI/ANTHROPIC bør være satt.",
    pattern: /^sk-ant-/,
    example: "sk-ant-...",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    description:
      "Google OAuth — uten dette feiler Google-innlogging og Google Workspace-funksjoner.",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    description: "Hører sammen med GOOGLE_CLIENT_ID.",
  },
  {
    name: "STRIPE_SECRET_KEY",
    description:
      "Stripe-betalinger. Uten denne feiler kommersielle flyter (Role Room billing, kjøp-abo).",
    pattern: /^sk_/,
  },
];

// ─────────────────────────────────────────────────────────
// Informasjonelt — vi forventer ikke at alle er satt
// ─────────────────────────────────────────────────────────
const OPTIONAL: EnvVar[] = [
  { name: "SENTRY_DSN", description: "Backend Sentry. Hvis satt, sendes alle uncaught errors hit." },
  { name: "VERCEL_URL", description: "Auto-satt av Vercel build-pipeline. Kun for build-time." },
  { name: "RENDER_EXTERNAL_URL", description: "Auto-satt av Render. Kun for build-time." },
  { name: "META_APP_ID", description: "Meta/Facebook OAuth. Påvirker Facebook-publishing." },
  { name: "META_APP_SECRET", description: "Hører sammen med META_APP_ID." },
  { name: "LINKEDIN_CLIENT_ID", description: "LinkedIn-innlogging." },
  { name: "LINKEDIN_CLIENT_SECRET", description: "Hører sammen med LINKEDIN_CLIENT_ID." },
  { name: "R2_ACCESS_KEY_ID", description: "Cloudflare R2 for storage (avatar, storyboard-bilder)." },
  { name: "R2_SECRET_ACCESS_KEY", description: "Hører sammen med R2_ACCESS_KEY_ID." },
  { name: "FIKEN_TOKEN", description: "Norsk regnskap-integrasjon." },
];

// ─────────────────────────────────────────────────────────
// Validation entry
// ─────────────────────────────────────────────────────────

interface ValidationReport {
  required: { name: string; status: "ok" | "missing" | "invalid"; message?: string }[];
  recommended: { name: string; status: "ok" | "missing" | "invalid"; message?: string }[];
  optional: { name: string; status: "ok" | "missing" }[];
  hasBlockingErrors: boolean;
}

function checkVar(envVar: EnvVar): { status: "ok" | "missing" | "invalid"; message?: string } {
  const raw = process.env[envVar.name];
  if (!raw || raw.trim().length === 0) {
    return { status: "missing" };
  }
  if (envVar.pattern && !envVar.pattern.test(raw)) {
    return {
      status: "invalid",
      message: `Verdien matcher ikke forventet mønster (${envVar.pattern}). Eksempel: ${envVar.example ?? "—"}`,
    };
  }
  return { status: "ok" };
}

export function validateEnv(): ValidationReport {
  const required = REQUIRED.map((v) => {
    const result = checkVar(v);
    return { name: v.name, ...result };
  });
  const recommended = RECOMMENDED.map((v) => {
    const result = checkVar(v);
    return { name: v.name, ...result };
  });
  const optional = OPTIONAL.map((v) => {
    const result = checkVar(v);
    return { name: v.name, status: result.status === "ok" ? ("ok" as const) : ("missing" as const) };
  });

  const hasBlockingErrors = required.some(
    (r) => r.status === "missing" || r.status === "invalid",
  );

  return { required, recommended, optional, hasBlockingErrors };
}

export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("=".repeat(64));
  lines.push("  Environment-validering — The Role Room backend");
  lines.push("=".repeat(64));
  lines.push("");

  lines.push("REQUIRED (manglende = boot blokkert):");
  for (const r of report.required) {
    const def = REQUIRED.find((v) => v.name === r.name)!;
    const icon = r.status === "ok" ? "✅" : "🔴";
    lines.push(`  ${icon} ${r.name.padEnd(24)} ${r.status === "ok" ? "OK" : (r.message ?? "MANGLER")}`);
    if (r.status !== "ok") {
      lines.push(`     ${def.description}`);
      if (def.example) lines.push(`     Eksempel: ${def.example}`);
    }
  }
  lines.push("");

  lines.push("RECOMMENDED (degradert funksjonalitet hvis mangler):");
  for (const r of report.recommended) {
    const def = RECOMMENDED.find((v) => v.name === r.name)!;
    const icon = r.status === "ok" ? "✅" : "⚠️ ";
    lines.push(`  ${icon} ${r.name.padEnd(24)} ${r.status === "ok" ? "OK" : (r.message ?? "MANGLER")}`);
    if (r.status === "missing") lines.push(`     ${def.description}`);
  }
  lines.push("");

  const okOptional = report.optional.filter((r) => r.status === "ok").length;
  lines.push(`OPTIONAL: ${okOptional}/${report.optional.length} satt`);
  lines.push("");
  lines.push("=".repeat(64));
  return lines.join("\n");
}

/**
 * Validate, log report, og avbryt prosessen hvis REQUIRED-vars mangler.
 * Kalles ved boot i index.ts.
 */
export function validateEnvOrExit(): void {
  const report = validateEnv();
  // eslint-disable-next-line no-console
  console.log(formatValidationReport(report));

  if (report.hasBlockingErrors) {
    // eslint-disable-next-line no-console
    console.error(
      "🔴 BOOT BLOKKERT — kritiske environment-variabler mangler eller er ugyldige. " +
      "Se rapport over. Sjekk Render/Vercel-dashboard og oppdater env-vars før restart.",
    );
    process.exit(1);
  }

  const missingRecommended = report.recommended.filter((r) => r.status !== "ok");
  if (missingRecommended.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  ${missingRecommended.length} anbefalt env-variabel mangler — ` +
      "noen funksjoner vil feile med 503/cryptic feil for brukere.",
    );
  }
}
