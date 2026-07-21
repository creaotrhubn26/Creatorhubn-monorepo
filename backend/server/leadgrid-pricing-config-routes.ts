/**
 * leadgrid-pricing-config-routes.ts
 *
 * Én sannhetskilde for Leadgrid-prising (tiers + tilleggsmoduler + bundle).
 * Erstatter de hardkodede prisene i leadgrid-landing.tsx.
 *
 *   GET  /api/leadgrid/pricing-config        — OFFENTLIG (landing leser)
 *   PUT  /api/leadgrid/pricing-config        — SUPER-ADMIN (iPad + web-admin skriver)
 *
 * Singleton-rad (mig 0403). Lat CREATE + seed av default så endepunktene
 * aldri 500-er før migrasjonen er kjørt på en gitt DB.
 * Gate-mønster speilet fra admin-lead-map-pricing-routes.
 *
 * ⚠️ FORM-SYNK: PricingConfig + DEFAULT_PRICING_CONFIG under er RUNTIME-kilden.
 * Andre build-targets kan ikke importere den, men MÅ speile samme camelCase-form:
 *   • frontend/shared/leadgridPricingConfig.ts  (kanonisk for frontend — landing + admin-editor)
 *   • ipad/.../Core/APIClient+LeadgridPricing.swift  (Codable-DTO-er)
 * Endrer du formen her: oppdater begge, + kontrakttesten
 * leadgrid-pricing-config.contract.test.ts (pinner nøkkel-formen → feiler ved drift).
 */
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

export interface PricingConfig {
  tiers: Array<{
    key: string;
    name: string;
    price: number;
    tagline: string;
    priceNote: string;
    popular: boolean;
    cta: string;
    features: string[];
  }>;
  modules: Array<{
    key: string;
    title: string;
    desc: string;
    priceSoloPro: number;
    priceAgency: number;
    accent: string;
    active: boolean;
  }>;
  bundle: { active: boolean; priceAgency: number; label: string };
}

// Default = dagens tiers + de research-forankrede modul-prisene (2026).
// Superadmin kan overstyre alt via PUT; dette er kun fallback/seed.
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  tiers: [
    {
      key: "free", name: "Solo Free", price: 0,
      tagline: "Gratis for solo-selgere. Kom i gang på 2 min.",
      priceNote: "Ingen kortkrav, ingen binding.",
      popular: false, cta: "Start gratis",
      features: [
        "1 kunde · 3 auto-onboards/mnd",
        "Kart, Kanban og filtre",
        "Native iPad-app",
        "Intelligence + Momentum Engine",
      ],
    },
    {
      key: "pro", name: "Solo Pro", price: 799,
      tagline: "Full Leadgrid for én selger, med alle AI-funksjonene.",
      priceNote: "Rimeligere ved årlig fakturering. Ingen binding.",
      popular: true, cta: "Start gratis",
      features: [
        "Alt i Solo Free",
        "Forecasting + Market Scan",
        "Voice Memo + AI-møtenotater",
        "1 000 AI-kall/mnd",
      ],
    },
    {
      key: "agency", name: "Agency", price: 2999,
      tagline: "For salgs-team med flere selgere.",
      priceNote: "Rimeligere ved årlig fakturering. Ingen binding.",
      popular: false, cta: "Kontakt oss",
      features: [
        "Alt i Solo Pro",
        "Multi-bruker (5 inkl.) + team-roller",
        "Territorie-grids m/ geofence",
        "White-label klient-portal",
      ],
    },
  ],
  modules: [
    {
      key: "dorsalg", title: "Dørsalg & verving",
      desc: "Adressekart, salg på døra med kundebekreftelse, dagsmål og team-oppfølging.",
      priceSoloPro: 490, priceAgency: 990, accent: "#c084fc", active: true,
    },
    {
      key: "kvalitet", title: "Kvalitet",
      desc: "Verifiseringskø, samtale-maler og kvalitetsgrad per selger. Stol på tallene.",
      priceSoloPro: 390, priceAgency: 790, accent: "#5eead4", active: true,
    },
    {
      key: "go", title: "Leadgrid Go",
      desc: "Automatisk kjørebok, kjøregodtgjørelse, flåte og bilbooking for hele teamet.",
      priceSoloPro: 249, priceAgency: 690, accent: "#7ab8ff", active: true,
    },
  ],
  bundle: { active: true, priceAgency: 1490, label: "Alle tre moduler på Agency" },
};

export function registerLeadgridPricingConfigRoutes(deps: {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
  isAdminEmail: (email: string | undefined) => boolean;
}) {
  const { app, pool, activeSessions, isAdminEmail } = deps;

  let tableEnsured = false;
  async function ensureTable(): Promise<void> {
    if (tableEnsured) return;
    await pool.query(
      `CREATE TABLE IF NOT EXISTS leadgrid_pricing_config (
         id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
         config JSONB NOT NULL,
         updated_by VARCHAR(255),
         updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
       )`,
    );
    tableEnsured = true;
  }

  async function loadConfig(): Promise<PricingConfig> {
    await ensureTable();
    const r = await pool.query("SELECT config FROM leadgrid_pricing_config WHERE id = 1");
    if (r.rows.length === 0) return DEFAULT_PRICING_CONFIG;
    return r.rows[0].config as PricingConfig;
  }

  function sessionFor(req: Request): SessionData | null {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      return activeSessions.get(auth.slice(7).trim()) ?? null;
    }
    return null;
  }

  // Basic strukturvalidering — nok til å hindre at PUT lagrer søppel som
  // feller landingssiden. Ikke uttømmende; superadmin er betrodd.
  function validate(c: unknown): c is PricingConfig {
    const o = c as PricingConfig;
    if (!o || typeof o !== "object") return false;
    if (!Array.isArray(o.tiers) || !Array.isArray(o.modules)) return false;
    const tierOk = o.tiers.every(
      (t) => typeof t.key === "string" && typeof t.name === "string" &&
        typeof t.price === "number" && Array.isArray(t.features),
    );
    const modOk = o.modules.every(
      (m) => typeof m.key === "string" && typeof m.title === "string" &&
        typeof m.priceSoloPro === "number" && typeof m.priceAgency === "number" &&
        typeof m.active === "boolean",
    );
    const bundleOk = o.bundle && typeof o.bundle.priceAgency === "number" &&
      typeof o.bundle.active === "boolean";
    return tierOk && modOk && !!bundleOk;
  }

  // OFFENTLIG — landingssiden leser dette (ingen auth).
  app.get("/api/leadgrid/pricing-config", async (_req, res) => {
    try {
      const config = await loadConfig();
      res.set("Cache-Control", "public, max-age=60");
      return res.json(config);
    } catch (err) {
      // Aldri felle landingssiden — server default ved feil.
      console.error("[leadgrid-pricing-config] get feilet:", (err as Error).message);
      return res.json(DEFAULT_PRICING_CONFIG);
    }
  });

  // SUPER-ADMIN — iPad + web-admin skriver.
  app.put("/api/leadgrid/pricing-config", async (req, res) => {
    const session = sessionFor(req);
    if (!session || !isAdminEmail(session.email)) {
      return res.status(403).json({ error: "not_super_admin" });
    }
    try {
      await ensureTable();
      const body = (req.body ?? {}) as { config?: unknown };
      if (!validate(body.config)) {
        return res.status(400).json({ error: "ugyldig_config" });
      }
      await pool.query(
        `INSERT INTO leadgrid_pricing_config (id, config, updated_by, updated_at)
         VALUES (1, $1, $2, NOW())
         ON CONFLICT (id) DO UPDATE
           SET config = EXCLUDED.config,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()`,
        [JSON.stringify(body.config), session.email ?? session.userId],
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error("[leadgrid-pricing-config] put feilet:", (err as Error).message);
      return res.status(500).json({ error: "internal_error" });
    }
  });
}
