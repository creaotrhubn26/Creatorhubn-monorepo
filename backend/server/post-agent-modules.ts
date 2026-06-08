/**
 * post-agent-modules.ts
 *
 * Delt logikk for Post Agent à la carte-modulene. Brukes av:
 *   - post-agent-modules-routes.ts  (checkout / entitlements / gated download)
 *   - post-agent-stripe-webhook.ts  (per-modul grant/revoke ved Stripe-events)
 *
 * Modulene er separate Stripe-produkter (opprettet 2026-06-08). Hver modul =
 * egen abonnements-checkout; bundle-planen ("The Role Room Post Agent" 299
 * kr/mnd) låser opp ALLE moduler samtidig.
 *
 * Price-ID-er leses fra env (single-key satt på Render), så de kan roteres
 * uten kodeendring.
 */

import type { Pool } from 'pg';

export type PostAgentModule = 'demo_studio' | 'marketing' | 'capture' | 'resolve';

export interface PostAgentModuleDef {
  /** Stabil nøkkel — matcher DB-kolonnen + Stripe metadata[module]. */
  key: PostAgentModule;
  /** Visningsnavn (norsk). */
  name: string;
  /** Kort beskrivelse til marketplace + checkout. */
  description: string;
  /** Månedspris i NOK (heltall) — kun for visning/validering. */
  priceNok: number;
  /** Env-var som holder Stripe price-ID for den månedlige planen. */
  priceEnvVar: string;
}

export const POST_AGENT_MODULES: PostAgentModuleDef[] = [
  {
    key: 'demo_studio',
    name: 'Demo Studio',
    description: 'Interaktive produktdemoer + Product Brain + publisering.',
    priceNok: 199,
    priceEnvVar: 'STRIPE_PRICE_POST_AGENT_DEMO_STUDIO',
  },
  {
    key: 'marketing',
    name: 'Marketing',
    description: 'Persona×funnel×kanal markedsmotor med 11 rammeverk.',
    priceNok: 199,
    priceEnvVar: 'STRIPE_PRICE_POST_AGENT_MARKETING',
  },
  {
    key: 'capture',
    name: 'Capture & iPad',
    description: 'Canon-tethering + AI-culling + iPad on-set + leveranse.',
    priceNok: 399,
    priceEnvVar: 'STRIPE_PRICE_POST_AGENT_CAPTURE',
  },
  {
    key: 'resolve',
    name: 'Resolve-bro',
    description: 'DaVinci Resolve + Photoshop/Firefly-bro, voiceover.',
    priceNok: 149,
    priceEnvVar: 'STRIPE_PRICE_POST_AGENT_RESOLVE',
  },
];

const MODULE_BY_KEY = new Map<string, PostAgentModuleDef>(
  POST_AGENT_MODULES.map((m) => [m.key, m]),
);

export function isPostAgentModule(value: unknown): value is PostAgentModule {
  return typeof value === 'string' && MODULE_BY_KEY.has(value);
}

export function getModuleDef(key: PostAgentModule): PostAgentModuleDef | undefined {
  return MODULE_BY_KEY.get(key);
}

/** Stripe price-ID for en modul (fra env), eller undefined hvis ikke satt. */
export function priceIdForModule(key: PostAgentModule): string | undefined {
  const def = MODULE_BY_KEY.get(key);
  return def ? process.env[def.priceEnvVar]?.trim() || undefined : undefined;
}

/**
 * Hvilke moduler en gitt Stripe price-ID gir tilgang til.
 *   - en modul-price → [den modulen]
 *   - bundle-price (POST_AGENT_MONTHLY/YEARLY) → ALLE moduler
 *   - ukjent → []
 */
export function modulesForPriceId(priceId: string | undefined): PostAgentModule[] {
  if (!priceId) return [];
  const id = priceId.trim();
  const bundleMonthly = process.env.STRIPE_PRICE_POST_AGENT_MONTHLY?.trim();
  const bundleYearly = process.env.STRIPE_PRICE_POST_AGENT_YEARLY?.trim();
  if (id === bundleMonthly || id === bundleYearly) {
    return POST_AGENT_MODULES.map((m) => m.key);
  }
  for (const m of POST_AGENT_MODULES) {
    if (process.env[m.priceEnvVar]?.trim() === id) return [m.key];
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* DB-helpers — post_agent_module_entitlements (migrasjon 259)        */
/* ------------------------------------------------------------------ */

const ADMIN_EMAILS = new Set([
  (process.env.ADMIN_ROOM_OWNER_EMAIL || 'daniel@creatorhubn.com').trim().toLowerCase(),
]);
const ADMIN_ROLES = new Set(['admin', 'super_admin', 'owner']);

/**
 * Admin/eier → full tilgang til alle moduler uten kjøp. Matcher det øvrige
 * admin-mønsteret i koden (ADMIN_ROOM_OWNER_EMAIL + users.role).
 */
export async function isPostAgentAdmin(pool: Pool, userId: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT email, role FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const u = rows[0] as { email?: string; role?: string } | undefined;
    if (!u) return false;
    const email = String(u.email || '').trim().toLowerCase();
    const role = String(u.role || '').trim().toLowerCase();
    return ADMIN_EMAILS.has(email) || ADMIN_ROLES.has(role);
  } catch {
    return false;
  }
}

/** Aktive moduler en bruker har (inkl. 'bundle' ekspandert til alle). */
export async function getUserModules(pool: Pool, userId: string): Promise<PostAgentModule[]> {
  // Admin/eier → alle moduler (ingen kjøp nødvendig).
  if (await isPostAgentAdmin(pool, userId)) {
    return POST_AGENT_MODULES.map((m) => m.key);
  }
  const { rows } = await pool.query(
    `SELECT module FROM post_agent_module_entitlements
     WHERE user_id = $1 AND status = 'active' AND revoked_at IS NULL`,
    [userId],
  );
  const set = new Set<PostAgentModule>();
  for (const r of rows as Array<{ module: string }>) {
    if (r.module === 'bundle') {
      POST_AGENT_MODULES.forEach((m) => set.add(m.key));
    } else if (isPostAgentModule(r.module)) {
      set.add(r.module);
    }
  }
  return [...set];
}

/** Idempotent grant av én modul (eller 'bundle'). */
export async function grantModule(
  pool: Pool,
  userId: string,
  module: PostAgentModule | 'bundle',
  opts: { subscriptionId?: string; priceId?: string; source?: 'stripe' | 'bundle' | 'admin_grant'; notes?: string } = {},
): Promise<void> {
  await pool.query(
    `INSERT INTO post_agent_module_entitlements
       (user_id, module, status, source, stripe_subscription_id, stripe_price_id, notes)
     VALUES ($1, $2, 'active', $3, $4, $5, $6)
     ON CONFLICT (user_id, module) WHERE revoked_at IS NULL
     DO UPDATE SET status = 'active', updated_at = now(),
       stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, post_agent_module_entitlements.stripe_subscription_id),
       stripe_price_id = COALESCE(EXCLUDED.stripe_price_id, post_agent_module_entitlements.stripe_price_id)`,
    [
      userId,
      module,
      opts.source ?? (module === 'bundle' ? 'bundle' : 'stripe'),
      opts.subscriptionId ?? null,
      opts.priceId ?? null,
      opts.notes ?? null,
    ],
  );
}

/** Trekk tilbake én modul (eller 'bundle') for en bruker. */
export async function revokeModule(
  pool: Pool,
  userId: string,
  module: PostAgentModule | 'bundle',
  reason: string,
): Promise<void> {
  await pool.query(
    `UPDATE post_agent_module_entitlements
     SET status = 'revoked', revoked_at = now(), updated_at = now(),
         notes = COALESCE(notes, '') || E'\nRevoked: ' || $3
     WHERE user_id = $1 AND module = $2 AND revoked_at IS NULL`,
    [userId, module, reason],
  );
}

/** Trekk tilbake ALLE moduler knyttet til et abonnement (ved cancel). */
export async function revokeModulesForSubscription(
  pool: Pool,
  subscriptionId: string,
  reason: string,
): Promise<void> {
  await pool.query(
    `UPDATE post_agent_module_entitlements
     SET status = 'revoked', revoked_at = now(), updated_at = now(),
         notes = COALESCE(notes, '') || E'\nRevoked: ' || $2
     WHERE stripe_subscription_id = $1 AND revoked_at IS NULL`,
    [subscriptionId, reason],
  );
}
