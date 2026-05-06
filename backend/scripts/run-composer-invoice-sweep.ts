#!/usr/bin/env tsx
/**
 * Manuell trigger for Pressroom-fakturaløpet.
 *
 * Bruk:
 *   STRIPE_SECRET_KEY=sk_live_... DATABASE_URL=postgres://... \
 *     npx tsx backend/scripts/run-composer-invoice-sweep.ts
 *
 *   # tørr-kjøring (ingen Stripe-calls + ingen UPDATE):
 *   npx tsx backend/scripts/run-composer-invoice-sweep.ts --dry-run
 *
 *   # spesifikk billing-periode:
 *   npx tsx backend/scripts/run-composer-invoice-sweep.ts --period 2026-04
 *
 *   # begge:
 *   npx tsx backend/scripts/run-composer-invoice-sweep.ts --dry-run --period 2026-04
 *
 * Default billing_period = forrige kalendermåned (UTC).
 *
 * Idempotent: re-kjøring plukker bare opp rader hvor
 * stripe_invoice_item_id IS NULL.
 */

import pg from "pg";
import {
  previousBillingPeriod,
  runComposerMonthlyInvoiceSweep,
} from "../server/composer-invoice-runner.js";

interface CliArgs {
  dryRun: boolean;
  period?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run" || a === "--dryRun") {
      out.dryRun = true;
    } else if (a === "--period" || a === "-p") {
      const v = argv[i + 1];
      if (!v) {
        console.error("ERROR: --period krever en YYYY-MM-verdi.");
        process.exit(2);
      }
      if (!/^\d{4}-\d{2}$/.test(v)) {
        console.error(`ERROR: --period må være YYYY-MM, fikk "${v}".`);
        process.exit(2);
      }
      out.period = v;
      i += 1;
    } else if (a.startsWith("--period=")) {
      const v = a.slice("--period=".length);
      if (!/^\d{4}-\d{2}$/.test(v)) {
        console.error(`ERROR: --period må være YYYY-MM, fikk "${v}".`);
        process.exit(2);
      }
      out.period = v;
    } else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Bruk: npx tsx backend/scripts/run-composer-invoice-sweep.ts [--dry-run] [--period YYYY-MM]",
          "",
          "Env:",
          "  STRIPE_SECRET_KEY  påkrevd (med mindre --dry-run)",
          "  DATABASE_URL       påkrevd",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      console.error(`ERROR: ukjent argument "${a}". Bruk --help.`);
      process.exit(2);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL må være satt.");
    process.exit(1);
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey && !args.dryRun) {
    console.error(
      "ERROR: STRIPE_SECRET_KEY må være satt (eller bruk --dry-run).",
    );
    process.exit(1);
  }

  const period = args.period ?? previousBillingPeriod();
  console.log(
    `[composer-invoice] starting sweep period=${period} dryRun=${args.dryRun}`,
  );

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const summary = await runComposerMonthlyInvoiceSweep(pool, {
      stripeApiKey: stripeKey,
      dryRun: args.dryRun,
      billingPeriod: period,
    });
    console.log("\n=== SWEEP SUMMARY ===");
    console.log(JSON.stringify(summary, null, 2));
    if (summary.failures > 0) {
      console.error(
        `\n[composer-invoice] ${summary.failures} failure(s) — exit 1`,
      );
      process.exit(1);
    }
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error("[composer-invoice] fatal:", err);
  process.exit(1);
});
