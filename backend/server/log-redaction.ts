// Log redaction — global maskering av kjente sensitive mønstre i alt
// som passerer console.{log,warn,error,info}.
//
// Defense-in-depth: vi forsøker IKKE å logge headers eller secrets med vilje,
// men selv én feilplassert `console.error("ctx:", req)` kan dumpe en
// Authorization-header eller Stripe-signatur til Render-logger. Denne
// modulen sørger for at slike strenger maskeres FØR de når terminal/log-aggregator.
//
// Aktiveres på opp-start via `installSecretRedactor()`. Idempotent.

type AnyConsoleFn = (...args: unknown[]) => void;

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  // Stripe
  { name: "stripe_secret_key", pattern: /sk_live_[A-Za-z0-9]{20,}/g, replacement: "sk_live_***REDACTED***" },
  { name: "stripe_test_key", pattern: /sk_test_[A-Za-z0-9]{20,}/g, replacement: "sk_test_***REDACTED***" },
  { name: "stripe_webhook_secret", pattern: /whsec_[A-Za-z0-9]{20,}/g, replacement: "whsec_***REDACTED***" },
  { name: "stripe_restricted", pattern: /rk_live_[A-Za-z0-9]{20,}/g, replacement: "rk_live_***REDACTED***" },
  // Render
  { name: "render_api_key", pattern: /rnd_[A-Za-z0-9]{20,}/g, replacement: "rnd_***REDACTED***" },
  // OpenAI / Anthropic
  { name: "openai_key", pattern: /sk-[A-Za-z0-9]{32,}/g, replacement: "sk-***REDACTED***" },
  { name: "anthropic_key", pattern: /sk-ant-[A-Za-z0-9_-]{30,}/g, replacement: "sk-ant-***REDACTED***" },
  // Bearer tokens etter "Authorization:" eller "Bearer "
  {
    name: "bearer_token",
    pattern: /(Bearer\s+)[A-Za-z0-9._\-+/=]{20,}/g,
    replacement: "$1***REDACTED***",
  },
  // JWTs (eyJ...eyJ...)
  {
    name: "jwt",
    pattern: /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
    replacement: "***JWT_REDACTED***",
  },
  // GitHub PAT
  { name: "github_pat", pattern: /ghp_[A-Za-z0-9]{30,}/g, replacement: "ghp_***REDACTED***" },
  // Cloudflare API token (32+ hex)
  // (litt liberal — kan også matche andre hex-strenger. Aksepterbar trade-off.)
  { name: "cloudflare_token", pattern: /[A-Za-z0-9_-]{40}\.[A-Za-z0-9_-]{40}/g, replacement: "***CF_TOKEN_REDACTED***" },
];

// Felt-navn som ALDRI skal loggges rått, uansett verdi
const SENSITIVE_FIELD_NAMES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-stripe-signature",
  "x-render-signature",
  "x-hub-signature",
  "x-webhook-secret",
  "stripe_secret_key",
  "stripeSecretKey",
  "stripeKey",
  "secret",
  "secret_key",
  "secretKey",
  "api_key",
  "apiKey",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "password",
  "passwd",
  "session_secret",
  "encryption_key",
  "client_secret",
  "private_key",
]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const redactString = (input: string): string => {
  let out = input;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
};

const MAX_DEPTH = 6;

export const redactSecrets = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_DEPTH) return "[REDACTION_DEPTH_LIMIT]";
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1));
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    };
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_FIELD_NAMES.has(k) || SENSITIVE_FIELD_NAMES.has(lower)) {
        out[k] = "***REDACTED***";
      } else {
        out[k] = redactSecrets(v, depth + 1);
      }
    }
    return out;
  }
  // Funksjoner, Symbols, etc — ikke logg
  return "[non-serializable]";
};

let installed = false;

/**
 * Wrap console.{log,warn,error,info,debug} så alle argumenter går gjennom
 * redactSecrets() før de når terminal/Render-logger.
 *
 * Idempotent — kaller du den to ganger får du fortsatt kun ett lag wrapping.
 *
 * Kan slås av via env LOG_REDACTION_DISABLED=1 (kun for lokal debugging).
 */
export const installSecretRedactor = (): void => {
  if (installed) return;
  if (process.env.LOG_REDACTION_DISABLED === "1") {
    console.warn("[log-redaction] disabled via LOG_REDACTION_DISABLED=1");
    installed = true;
    return;
  }

  const wrap = (orig: AnyConsoleFn): AnyConsoleFn => {
    return (...args: unknown[]) => {
      try {
        const redacted = args.map((a) => redactSecrets(a));
        orig(...redacted);
      } catch {
        // Hvis selve redaction-funksjonen feiler, fall tilbake til
        // orig — bedre å logge enn å miste logger.
        orig(...args);
      }
    };
  };

  // eslint-disable-next-line no-console
  console.log = wrap(console.log.bind(console));
  console.warn = wrap(console.warn.bind(console));
  console.error = wrap(console.error.bind(console));
  console.info = wrap(console.info.bind(console));
  console.debug = wrap(console.debug.bind(console));

  installed = true;
  // Bruker den nye wrap'ede console for å bekrefte at den er aktiv.
  // (Dette vil IKKE inneholde noe hemmelig, men hvis det gjorde det
  // hadde det blitt maskert.)
  console.log("[log-redaction] installed — sensitive patterns will be masked in all console output");
};
