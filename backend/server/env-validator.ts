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
  { name: "SENTRY_AUTH_TOKEN", description: "Sentry read-token (project:read/org:read). Lar Control Center LESE issues/feilrate tilbake. Uten den faller cockpiten tilbake på error_log." },
  { name: "SENTRY_ORG", description: "Sentry org-slug. Hører sammen med SENTRY_AUTH_TOKEN (Control Center)." },
  { name: "SENTRY_PROJECT", description: "Sentry project-slug. Hører sammen med SENTRY_AUTH_TOKEN (Control Center)." },
  { name: "RENDER_EXTERNAL_URL", description: "Auto-satt av Render. Kun for build-time." },
  { name: "RENDER_API_KEY", description: "Render lese-API. Lar Control Center vise Render-deploys (Fase 2). Sammen med RENDER_SERVICE_ID." },
  { name: "RENDER_SERVICE_ID", description: "Render service-ID (srv-…) for deploy-innsikt. Hører sammen med RENDER_API_KEY." },
  { name: "GITHUB_DEPLOY_TOKEN", description: "GitHub read-token (actions:read/repo). Lar Control Center vise GitHub Actions-kjøringer (Fase 2). Sammen med GITHUB_REPO." },
  { name: "GITHUB_REPO", description: "GitHub-repo 'owner/repo' for deploy-innsikt. Hører sammen med GITHUB_DEPLOY_TOKEN." },
  { name: "CONTROL_CENTER_FRONTEND_URL", description: "Frontend-URL som Control Center helse-prober (Fase 3). Default https://creatorhubn.com." },
  { name: "CONTROL_CENTER_UPLOADS_HEALTH_URL", description: "Valgfri fallback health-URL for lagring (Fase 3). Brukes kun hvis verken B2 (B2_APPLICATION_KEY_ID/-KEY) eller R2 (R2_ENDPOINT) er satt." },
  { name: "CONTROL_CENTER_REALTIME_HEALTH_URL", description: "Valgfri health-URL for realtime-tjenesten (Fase 3 health-ping). Mangler → status 'not_configured'." },
  { name: "CONTROL_CENTER_WORKERS_HEALTH_URL", description: "Valgfri health-URL for bakgrunns-workers (Fase 3 health-ping). Mangler → status 'not_configured'." },
  { name: "CONTROL_CENTER_LEDGERLY_HEALTH_URL", description: "Valgfri health-URL for Ledgerly regnskaps-appen (egen tjeneste/DB). Peker på appens /api/health. Mangler → status 'not_configured'." },
  { name: "META_APP_ID", description: "Meta/Facebook OAuth. Påvirker Facebook-publishing." },
  { name: "META_APP_SECRET", description: "Hører sammen med META_APP_ID." },
  { name: "LINKEDIN_CLIENT_ID", description: "LinkedIn-innlogging." },
  { name: "LINKEDIN_CLIENT_SECRET", description: "Hører sammen med LINKEDIN_CLIENT_ID." },
  { name: "R2_ACCESS_KEY_ID", description: "Cloudflare R2 for storage (avatar, storyboard-bilder)." },
  { name: "R2_SECRET_ACCESS_KEY", description: "Hører sammen med R2_ACCESS_KEY_ID." },
  { name: "FIKEN_TOKEN", description: "Norsk regnskap-integrasjon." },
  { name: "AI_USD_TO_NOK", description: "USD→NOK-kurs for å vise AI-kost i kroner i Control Center AI-margin (Fase A). Default 10.5." },
  { name: "AI_MARGIN_ALERT_NOK", description: "Terskel (NOK/mnd AI-kost per org) som flagger margin-risiko i Control Center AI-margin (Fase A). Default 500." },
  { name: "AI_OVERAGE_MARKUP", description: "Markup ganget på AI-overskridelse (leverandørkost over inkludert budsjett) for å få fakturabeløp (Fase B/C). Default 1.4." },
  { name: "AI_INCLUDED_BUDGET_NOK_BASIC", description: "Inkludert AI-budsjett (NOK leverandørkost/mnd) for Basic-planen (soft-cap Fase B). Default 30." },
  { name: "AI_INCLUDED_BUDGET_NOK_PROFESSIONAL", description: "Inkludert AI-budsjett (NOK leverandørkost/mnd) for Professional-planen (soft-cap Fase B). Default 75." },
  { name: "AI_INCLUDED_BUDGET_NOK_PREMIUM", description: "Inkludert AI-budsjett (NOK leverandørkost/mnd) for Premium-planen (soft-cap Fase B). Default 210." },
  { name: "AI_INCLUDED_BUDGET_NOK_ENTERPRISE", description: "Inkludert AI-budsjett (NOK leverandørkost/mnd) for Enterprise-planen (soft-cap Fase B). Default 840." },
  { name: "AI_OVERAGE_BILLING_ENABLED", description: "Master-bryter for Fase C: må være \"true\" for at AI-overage faktisk rapporteres til Stripe. Alt annet = dry-run (ingen fakturering)." },
  { name: "STRIPE_AI_OVERAGE_METER_EVENT_NAME", description: "Stripe Meter event_name for AI-overage metered billing (Fase C). Default \"ai_overage\" — må matche meteren i Stripe-dashbord." },
  { name: "AI_OVERAGE_METER_UNIT", description: "Enhet for Stripe meter-value: \"nok\" (default, 1 enhet=1 kr) eller \"oere\" (1 enhet=1 øre). Må matche meter-prisen i Stripe." },
  { name: "CREATORHUB_AI_OVERAGE_PRICE_ID", description: "Stripe usage-based price (knyttet til creatorhub_ai_overage-meteren) som legges som metered-linje på nye plattform-abonnement. 0 kr til bruk rapporteres. Uten env = ingen linje." },
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
      "Se rapport over. Sjekk Render/Netlify-dashboard og oppdater env-vars før restart.",
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
