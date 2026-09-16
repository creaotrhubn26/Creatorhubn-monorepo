/**
 * role-room-eid-service.ts — norsk eID (BankID) via OIDC-broker.
 *
 * Bygget etter bankid-oidc-norsk-eid-ferdigheten, men for vår stack:
 * Express + Neon, ikke Supabase edge functions. Mønstrene er de samme —
 * PKCE, serverside state, binding på hash av fødselsnummer — koden er ikke.
 *
 * De fem reglene fra ferdigheten, og hvor de er håndhevet her:
 *
 *   1. Bind på fnr-hash, aldri leverandørens `sub`.
 *      → hashSsn() + eid_identities.ssn_hash. `sub` lagres kun til sporing.
 *   2. Opprett aldri ny bruker ved ukjent fnr.
 *      → denne tjenesten oppretter ingen brukere i det hele tatt. Den
 *        verifiserer en konto som allerede er innlogget.
 *   3. Sjekk at kontoen faktisk finnes før duplikat avvises.
 *      → findIdentityBySsn() slår opp mot users via join, ikke bare mot
 *        identitetstabellen; identitetsrader kan overleve en slettet bruker.
 *   4. Skriv aldri en svakere hash over en sterkere.
 *      → ssn_hash_kind + writeIdentity() nekter å degradere 'ssn' til
 *        'birthdate'.
 *   5. Logg hver autentisering.
 *      → eid_auth_events, med utfall og grunn.
 *
 * 🔑 Fødselsnummeret forlater aldri denne filen, og skrives aldri til logg
 * eller database. Vi logger `Object.keys(claims)`, aldri verdiene.
 */

import crypto from "node:crypto";
import type { Pool } from "pg";

export type EidProvider = "bankid" | "buypass";
export type EidIntent = "verify" | "sign";

export interface EidConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Serverside-pepper. Uten den er en fnr-hash trivielt å slå opp. */
  ssnPepper: string;
}

/**
 * Leser konfigurasjonen, eller null når den ikke finnes.
 *
 * Null er en normal tilstand, ikke en feil: i et miljø uten eID-konto skal
 * flaten vise «ikke tilgjengelig» i stedet for å krasje. Samme mønster som
 * Turnstile-tjenesten bruker.
 */
export function readEidConfig(): EidConfig | null {
  const issuer = process.env.EID_ISSUER?.trim();
  const clientId = process.env.EID_CLIENT_ID?.trim();
  const clientSecret = process.env.EID_CLIENT_SECRET?.trim();
  const redirectUri = process.env.EID_REDIRECT_URI?.trim();
  const ssnPepper = process.env.EID_SSN_PEPPER?.trim();

  if (!issuer || !clientId || !clientSecret || !redirectUri || !ssnPepper) return null;
  // En kort pepper gir falsk trygghet: fødselsnumre er et lite nok rom til at
  // en svak hemmelighet kan brute-forces.
  if (ssnPepper.length < 32) {
    console.warn("[eid] EID_SSN_PEPPER er kortere enn 32 tegn — avviser konfigurasjonen");
    return null;
  }
  return { issuer, clientId, clientSecret, redirectUri, ssnPepper };
}

/** Scopes og acr per leverandør. Fnr må I TILLEGG aktiveres i brokerens dashbord. */
export const PROVIDER_SETTINGS: Record<EidProvider, { scope: string; acrValues: string; ssnClaim: string }> = {
  bankid: {
    scope: "openid ssn",
    acrValues: "urn:grn:authn:no:bankid",
    ssnClaim: "socialno",
  },
  buypass: {
    scope: "openid profile bpid bpnnin",
    acrValues: "urn:grn:authn:no:buypass",
    ssnClaim: "bp_nnin_sub",
  },
};

/** HMAC av fødselsnummeret. Aldri reversibel, aldri lagret i klartekst. */
export function hashSsn(ssn: string, pepper: string): string {
  const normalized = ssn.replace(/\D/g, "");
  return crypto.createHmac("sha256", pepper).update(normalized).digest("hex");
}

/**
 * Fødselsår fra et norsk fødselsnummer.
 *
 * Nok til aldersgrenser — vi trenger å vite om noen er mindreårig, ikke
 * nøyaktig fødselsdato. Individsifrene avgjør århundret.
 */
export function birthYearFromSsn(ssn: string): number | null {
  const digits = ssn.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  const yy = Number(digits.slice(4, 6));
  const individual = Number(digits.slice(6, 9));
  if (!Number.isFinite(yy) || !Number.isFinite(individual)) return null;

  let century: number;
  if (individual < 500) century = 1900;
  else if (individual < 750 && yy >= 54) century = 1800;
  else if (individual < 1000 && yy < 40) century = 2000;
  else century = 1900;

  const year = century + yy;
  const now = new Date().getFullYear();
  return year >= 1880 && year <= now ? year : null;
}

export interface StartedAuth {
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** Oppretter og lagrer en engangs-state. PKCE-verifier blir liggende serverside. */
export async function createAuthState(
  pool: Pool,
  input: { userId: string; provider: EidProvider; intent: EidIntent; returnPath?: string | null },
): Promise<StartedAuth> {
  const state = crypto.randomBytes(32).toString("base64url");
  const nonce = crypto.randomBytes(32).toString("base64url");
  const codeVerifier = crypto.randomBytes(48).toString("base64url");

  await pool.query(
    `INSERT INTO eid_auth_states (state, user_id, provider, nonce, code_verifier, intent, return_path, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '15 minutes')`,
    [state, input.userId, input.provider, nonce, codeVerifier, input.intent, input.returnPath ?? null],
  );

  await logAuthEvent(pool, {
    userId: input.userId,
    provider: input.provider,
    intent: input.intent,
    outcome: "started",
  });

  return { state, nonce, codeVerifier };
}

export interface ConsumedState {
  user_id: string;
  provider: EidProvider;
  nonce: string;
  code_verifier: string;
  intent: EidIntent;
  return_path: string | null;
}

/**
 * Henter og forbruker en state. Returnerer null hvis den er ukjent, utløpt
 * eller allerede brukt — alle tre skal behandles likt av kallstedet, så en
 * angriper ikke kan skille dem fra hverandre.
 */
export async function consumeAuthState(pool: Pool, state: string): Promise<ConsumedState | null> {
  const r = await pool.query(
    `UPDATE eid_auth_states
        SET used_at = now()
      WHERE state = $1
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id, provider, nonce, code_verifier, intent, return_path`,
    [state],
  );
  return (r.rows[0] as ConsumedState | undefined) ?? null;
}

export async function logAuthEvent(
  pool: Pool,
  input: {
    userId: string | null;
    provider: EidProvider;
    intent: EidIntent;
    outcome: "started" | "completed" | "failed";
    failureReason?: string;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO eid_auth_events (user_id, provider, intent, outcome, failure_reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.userId, input.provider, input.intent, input.outcome, input.failureReason ?? null],
    );
  } catch (err) {
    // Sporing skal aldri velte selve verifiseringen, men den skal synes.
    console.error("[eid] klarte ikke å logge autentiseringshendelse", err);
  }
}

export interface WriteIdentityInput {
  userId: string;
  provider: EidProvider;
  ssnHash: string;
  ssnHashKind: "ssn" | "birthdate";
  providerSub: string | null;
  verifiedName: string | null;
  birthYear: number | null;
}

export type WriteIdentityResult =
  | { ok: true }
  | { ok: false; reason: "ssn_taken" | "weaker_hash" };

/**
 * Skriver identiteten.
 *
 * Feilhåndteringen er eksplisitt med vilje: stille feil i en autentiseringsflyt
 * er den verste kategorien, fordi brukeren kommer «inn» og feilen først viser
 * seg senere. ON CONFLICT-målet matcher den unike indeksen fra migrasjon 0614.
 */
export async function writeIdentity(
  pool: Pool,
  input: WriteIdentityInput,
): Promise<WriteIdentityResult> {
  // Regel 3: sjekk mot en EKSISTERENDE bruker, ikke bare mot identitetsraden.
  // Identitetsrader kan overleve en slettet konto.
  const taken = await pool.query(
    `SELECT i.user_id
       FROM eid_identities i
       JOIN users u ON u.id = i.user_id
      WHERE i.ssn_hash = $1 AND i.user_id <> $2
      LIMIT 1`,
    [input.ssnHash, input.userId],
  );
  if (taken.rowCount) return { ok: false, reason: "ssn_taken" };

  // Regel 4: en fødselsdato-hash skal aldri overskrive en fnr-hash.
  if (input.ssnHashKind === "birthdate") {
    const existing = await pool.query(
      `SELECT ssn_hash_kind FROM eid_identities WHERE user_id = $1 AND provider = $2 LIMIT 1`,
      [input.userId, input.provider],
    );
    if (existing.rows[0]?.ssn_hash_kind === "ssn") return { ok: false, reason: "weaker_hash" };
  }

  await pool.query(
    `INSERT INTO eid_identities
       (user_id, provider, ssn_hash, ssn_hash_kind, provider_sub, verified_name, birth_year, verified_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
     ON CONFLICT (user_id, provider) DO UPDATE
        SET ssn_hash = EXCLUDED.ssn_hash,
            ssn_hash_kind = EXCLUDED.ssn_hash_kind,
            provider_sub = EXCLUDED.provider_sub,
            verified_name = COALESCE(EXCLUDED.verified_name, eid_identities.verified_name),
            birth_year = COALESCE(EXCLUDED.birth_year, eid_identities.birth_year),
            verified_at = now(),
            updated_at = now()`,
    [
      input.userId,
      input.provider,
      input.ssnHash,
      input.ssnHashKind,
      input.providerSub,
      input.verifiedName,
      input.birthYear,
    ],
  );

  return { ok: true };
}

/** Setter merket byråene ser. Talent-raden bærer flagget, ikke identiteten. */
export async function markTalentVerified(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    `UPDATE talents
        SET identity_verified = TRUE, identity_verified_at = now(), updated_at = now()
      WHERE owner_user_id = $1`,
    [userId],
  );
}
