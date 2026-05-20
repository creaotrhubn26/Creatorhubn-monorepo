/**
 * nextrole-referrals.ts
 *
 * Referrals-system for NextRole. Hver bruker får én unik kode (8 tegn,
 * base32 fra første ledd av SHA-256(user_id) for å være deterministisk
 * og lett gjenskapbar). Når en annen bruker registrerer seg og deretter
 * fullfører Stripe-checkout med koden i metadata, får begge 1 mnd bonus.
 *
 * Bonus-utløsning:
 *   1. Bruker B lander på /nextrole?ref=ABC123
 *   2. Frontend lagrer koden i sessionStorage
 *   3. Når B starter trial eller checkout, sendes koden med
 *   4. /api/marketplace/next-role/referrals/redeem oppretter
 *      nextrole_referrals-rad (validerer at B ≠ A og B ikke har
 *      løst inn før)
 *   5. Webhook handleNextRoleCheckoutCompleted markerer
 *      reward_eligible_at + applyReferralRewards forlenger trial/
 *      sub-perioden til begge parter
 *
 * Bonus implementeres ved å skyve trial_ends_at og current_period_end
 * 30 dager fram. Betalende kunder får bonus_months_pending som vi kan
 * vekselslå mot Stripe-kupong i en framtidig iterasjon.
 */

import { createHash } from "crypto";
import type express from "express";
import type { Pool } from "pg";

export interface NextRoleReferralsDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string } | null;
}

// ── Kode-helper ─────────────────────────────────────────────────────
// Deterministisk: samme user_id gir alltid samme kode. 8 tegn, base32
// (Crockford-subsett) — utelater 0/O/1/I for lesbarhet på papir/SMS.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function deriveCodeFromUserId(userId: string): string {
  const hash = createHash("sha256").update(`nextrole-referral:${userId}`).digest();
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET[hash[i] % CODE_ALPHABET.length];
  }
  return out;
}

async function ensureReferralCode(pool: Pool, userId: string): Promise<string> {
  // Sjekk om brukeren allerede har en kode.
  const existing = await pool.query<{ code: string }>(
    `SELECT code FROM nextrole_referral_codes WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (existing.rowCount) return existing.rows[0].code;

  // Generer deterministisk fra user_id, men håndter teoretisk kollisjon
  // (~1 av 2³⁸) ved å legge til ett ekstra tegn fra hash til vi får unik.
  const base = deriveCodeFromUserId(userId);
  let code = base;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await pool.query(
        `INSERT INTO nextrole_referral_codes (user_id, code) VALUES ($1, $2)`,
        [userId, code],
      );
      return code;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Konflikt på user_id (race) → return den eksisterende
      if (/nextrole_referral_codes_pkey/.test(msg)) {
        const r = await pool.query<{ code: string }>(
          `SELECT code FROM nextrole_referral_codes WHERE user_id = $1`,
          [userId],
        );
        return r.rows[0].code;
      }
      // Konflikt på code (annen bruker fikk samme kode) → permuter
      if (/nextrole_referral_codes_code_key/.test(msg) || /unique/i.test(msg)) {
        code =
          base.slice(0, 7) +
          CODE_ALPHABET[(attempt + 1) % CODE_ALPHABET.length];
        continue;
      }
      throw err;
    }
  }
  throw new Error("could_not_allocate_referral_code");
}

// ── Webhook-utløsning ───────────────────────────────────────────────

/**
 * Kalles fra handleNextRoleCheckoutCompleted etter at installasjonen
 * er upsertet. Hvis brukeren har en innløst referral som ikke har fått
 * bonus enda, marker den som eligible og forleng trial/period for både
 * referrer og redeemer 30 dager.
 */
export async function applyReferralRewardsOnCheckout(
  pool: Pool,
  redeemerUserId: string,
): Promise<{ applied: boolean; referrerUserId?: string }> {
  const pending = await pool.query<{
    id: string;
    referrer_user_id: string;
    reward_applied_redeemer_at: Date | null;
  }>(
    `SELECT id, referrer_user_id, reward_applied_redeemer_at
       FROM nextrole_referrals
      WHERE redeemed_by_user_id = $1
        AND reward_applied_redeemer_at IS NULL
      LIMIT 1`,
    [redeemerUserId],
  );
  if (!pending.rowCount) return { applied: false };
  const ref = pending.rows[0];

  // Marker referral som eligible + applied for redeemer
  await pool.query(
    `UPDATE nextrole_referrals
        SET reward_eligible_at = COALESCE(reward_eligible_at, NOW()),
            reward_applied_redeemer_at = NOW()
      WHERE id = $1`,
    [ref.id],
  );

  // Skyv trial_ends_at og current_period_end 30 dager fram for redeemer.
  await pool.query(
    `UPDATE marketplace_installations
        SET trial_ends_at = COALESCE(trial_ends_at, NOW()) + INTERVAL '30 days',
            current_period_end = COALESCE(current_period_end, NOW()) + INTERVAL '30 days',
            settings = settings || jsonb_build_object(
              'referralBonusAppliedAt', to_jsonb(NOW()::text),
              'referralBonusFromReferrer', to_jsonb($1::text)
            ),
            status_updated_at = NOW()
      WHERE user_id = $2 AND app_id = 'next-role'`,
    [ref.referrer_user_id, redeemerUserId],
  );

  // Skyv referrer-en sin trial/period 30 dager fram også.
  await pool.query(
    `UPDATE marketplace_installations
        SET trial_ends_at = COALESCE(trial_ends_at, NOW()) + INTERVAL '30 days',
            current_period_end = COALESCE(current_period_end, NOW()) + INTERVAL '30 days',
            settings = settings || jsonb_build_object(
              'referralBonusAppliedAt', to_jsonb(NOW()::text),
              'referralBonusFromRedeemer', to_jsonb($1::text)
            ),
            status_updated_at = NOW()
      WHERE user_id = $2 AND app_id = 'next-role'`,
    [redeemerUserId, ref.referrer_user_id],
  );

  await pool.query(
    `UPDATE nextrole_referrals
        SET reward_applied_referrer_at = NOW()
      WHERE id = $1`,
    [ref.id],
  );

  return { applied: true, referrerUserId: ref.referrer_user_id };
}

// ── Routes ──────────────────────────────────────────────────────────

export function setupNextRoleReferralRoutes(
  deps: NextRoleReferralsDeps,
): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  // GET min kode + statistikk
  app.get("/api/marketplace/next-role/referrals/me", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    try {
      const code = await ensureReferralCode(pool, session.userId);
      const stats = await pool.query<{
        invited_count: string;
        rewards_earned: string;
      }>(
        `SELECT
           COUNT(*)::text AS invited_count,
           COUNT(*) FILTER (WHERE reward_applied_referrer_at IS NOT NULL)::text AS rewards_earned
         FROM nextrole_referrals
         WHERE referrer_user_id = $1`,
        [session.userId],
      );
      const recent = await pool.query<{
        redeemed_at: Date;
        reward_applied_referrer_at: Date | null;
      }>(
        `SELECT redeemed_at, reward_applied_referrer_at
           FROM nextrole_referrals
          WHERE referrer_user_id = $1
          ORDER BY redeemed_at DESC
          LIMIT 25`,
        [session.userId],
      );
      const s = stats.rows[0];
      res.json({
        code,
        shareUrl: buildShareUrl(code),
        invitedCount: Number(s?.invited_count ?? "0"),
        rewardsEarned: Number(s?.rewards_earned ?? "0"),
        bonusMonthsEarned: Number(s?.rewards_earned ?? "0"),
        recentRedemptions: recent.rows.map((r) => ({
          redeemedAt: r.redeemed_at.toISOString(),
          rewardApplied: r.reward_applied_referrer_at !== null,
        })),
      });
    } catch (err) {
      console.error("[nextrole-referrals] me failed", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // POST løs inn kode
  // Body: { code: string }
  app.post("/api/marketplace/next-role/referrals/redeem", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return;
    }
    const rawCode = String(req.body?.code ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (rawCode.length < 6 || rawCode.length > 16) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }

    try {
      // Slå opp eier av koden
      const owner = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM nextrole_referral_codes WHERE code = $1`,
        [rawCode],
      );
      if (!owner.rowCount) {
        res.status(404).json({ error: "code_not_found" });
        return;
      }
      const referrerId = owner.rows[0].user_id;
      if (referrerId === session.userId) {
        res.status(400).json({ error: "cannot_redeem_own_code" });
        return;
      }

      // UNIQUE-constraint sikrer at hver bruker bare kan løse inn én kode
      try {
        await pool.query(
          `INSERT INTO nextrole_referrals (code, referrer_user_id, redeemed_by_user_id)
           VALUES ($1, $2, $3)`,
          [rawCode, referrerId, session.userId],
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (/redeemed_by_user_id/.test(msg) || /unique/i.test(msg)) {
          res.status(409).json({ error: "already_redeemed" });
          return;
        }
        throw err;
      }

      res.json({
        redeemed: true,
        referrerId,
        note: "Bonus aktiveres når abonnementet ditt blir betalende eller du fullfører trialen.",
      });
    } catch (err) {
      console.error("[nextrole-referrals] redeem failed", err);
      res.status(500).json({ error: "internal_error" });
    }
  });
}

// Helper: bygg delelig URL — frontend kan utvide med UTM osv.
function buildShareUrl(code: string): string {
  const base = (
    process.env.CREATORHUB_PUBLIC_URL ?? "https://app.creatorhubn.com"
  ).replace(/\/$/, "");
  return `${base}/nextrole?ref=${code}`;
}
