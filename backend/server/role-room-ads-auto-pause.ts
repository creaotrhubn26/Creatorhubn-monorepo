/**
 * role-room-ads-auto-pause.ts
 *
 * Lag 3b: når kunden har slått på auto-pause OG perioden treffer budsjett-taket,
 * pauses aktive kampanjer automatisk i neste sweep — på tvers av Meta, Google,
 * og LinkedIn. Off by default; krever eksplisitt klient-toggle (§2.3).
 *
 * Designet for å være ærlig:
 *   • Vi MÅ pause faktisk på plattformen — å bare flippe lokal status uten å
 *     stoppe ekte spend hadde vært verre enn å ikke gjøre noe.
 *   • Vi flipper lokal status til 'paused' KUN etter at plattform-kallet
 *     lyktes (eller feilen er tolket som «allerede pauset»).
 *   • Token-mangel skip-es med tydelig grunn — vi prøver ikke å pause uten å
 *     kunne autentisere mot plattformen.
 *
 * Hele pause-dispatchen er injiserbar (PausePlatformDispatchers) så sweepen
 * kan unit-testes uten å treffe plattform-APIene.
 */

import type { Pool } from "pg";
import type { AdsCampaignRow } from "./role-room-ads-db.js";
import type { AdsPlatform } from "./role-room-ads-shared.js";
import {
  computeBudgetStatus,
  getBudget,
  listAutoPauseProjects,
} from "./role-room-ads-budget.js";
import { sumSpendForProjectPeriod, updateCampaignStatus } from "./role-room-ads-db.js";
import { parseCampaignResourceName } from "./role-room-google-ads.js";

export interface AutoPausedCampaign {
  campaignId: string;
  platform: AdsPlatform;
  externalCampaignId: string;
  status: "paused";
}

export interface AutoPauseSkipped {
  campaignId: string;
  reason: "no_token" | "no_external_id" | "platform_error" | "missing_dispatcher" | "missing_google_customer";
  detail?: string;
}

export interface AutoPauseProjectResult {
  projectId: string;
  paused: AutoPausedCampaign[];
  skipped: AutoPauseSkipped[];
}

export interface AutoPauseSweepSummary {
  period: string;
  scanned: number;          // antall prosjekter med auto_pause_on_cap = true
  overBudget: number;       // antall som faktisk var over taket
  pausedTotal: number;
  perProject: AutoPauseProjectResult[];
}

/** Per-platform pause-dispatchers. Injiseres så testene slipper ekte APIer. */
export interface PausePlatformDispatchers {
  meta: (accessToken: string, externalCampaignId: string) => Promise<void>;
  google: (
    accessToken: string,
    developerToken: string,
    customerId: string,
    campaignResourceName: string,
  ) => Promise<void>;
  linkedin: (accessToken: string, campaignUrn: string, apiVersion?: string) => Promise<void>;
}

export interface AutoPauseSweepDeps {
  resolveToken: (platform: AdsPlatform, userId: string) => Promise<string | null>;
  listActiveCampaignsForProject: (pool: Pool, projectId: string) => Promise<AdsCampaignRow[]>;
  dispatchers: PausePlatformDispatchers;
  googleDeveloperToken?: string | null;
  linkedinApiVersion?: string;
}

/** Pure-ish helper: should this project auto-pause? Used internally + testable. */
export function shouldAutoPause(input: {
  hasBudget: boolean;
  maxSpendNok: number;
  approvedOverageNok: number;
  actualSpendNok: number;
  autoPauseOnCap: boolean;
}): boolean {
  if (!input.autoPauseOnCap) return false;
  const status = computeBudgetStatus({
    hasBudget: input.hasBudget,
    maxSpendNok: input.maxSpendNok,
    approvedOverageNok: input.approvedOverageNok,
    actualSpendNok: input.actualSpendNok,
  });
  return status.isOverBudget;
}

async function pauseOneCampaign(
  pool: Pool,
  campaign: AdsCampaignRow,
  deps: AutoPauseSweepDeps,
): Promise<{ paused?: AutoPausedCampaign; skipped?: AutoPauseSkipped }> {
  if (!campaign.externalCampaignId) {
    return { skipped: { campaignId: campaign.id, reason: "no_external_id" } };
  }
  const token = await deps.resolveToken(campaign.platform, campaign.userId);
  if (!token) {
    return { skipped: { campaignId: campaign.id, reason: "no_token" } };
  }

  try {
    if (campaign.platform === "meta") {
      await deps.dispatchers.meta(token, campaign.externalCampaignId);
    } else if (campaign.platform === "google") {
      if (!deps.googleDeveloperToken) {
        return { skipped: { campaignId: campaign.id, reason: "missing_dispatcher", detail: "GOOGLE_ADS_DEVELOPER_TOKEN ikke satt" } };
      }
      const parsed = parseCampaignResourceName(campaign.externalCampaignId);
      if (!parsed) {
        return { skipped: { campaignId: campaign.id, reason: "missing_google_customer" } };
      }
      await deps.dispatchers.google(token, deps.googleDeveloperToken, parsed.customerId, campaign.externalCampaignId);
    } else if (campaign.platform === "linkedin") {
      await deps.dispatchers.linkedin(token, campaign.externalCampaignId, deps.linkedinApiVersion);
    } else {
      return { skipped: { campaignId: campaign.id, reason: "missing_dispatcher", detail: `plattform ${campaign.platform}` } };
    }
  } catch (error) {
    return { skipped: { campaignId: campaign.id, reason: "platform_error", detail: String(error) } };
  }

  // Plattform-kallet lyktes — flipp lokal status så UI + assertWithinBudget ser
  // den samme sannheten.
  await updateCampaignStatus(pool, campaign.id, "paused").catch(() => undefined);
  return {
    paused: {
      campaignId: campaign.id,
      platform: campaign.platform,
      externalCampaignId: campaign.externalCampaignId,
      status: "paused",
    },
  };
}

/**
 * Den hele sweep-en. Kalles etter spend-sweepen (attribution-tick) så
 * statusene leses mot ferskest spend.
 */
export async function runAdsAutoPauseSweep(
  pool: Pool,
  deps: AutoPauseSweepDeps,
  period: string,
): Promise<AutoPauseSweepSummary> {
  const candidates = await listAutoPauseProjects(pool, period);
  const perProject: AutoPauseProjectResult[] = [];
  let overBudget = 0;
  let pausedTotal = 0;

  for (const row of candidates) {
    const actualSpendNok = await sumSpendForProjectPeriod(pool, row.projectId, period);
    const status = computeBudgetStatus({
      hasBudget: true,
      maxSpendNok: row.maxSpendNok,
      approvedOverageNok: row.approvedOverageNok,
      actualSpendNok,
    });
    if (!status.isOverBudget) {
      perProject.push({ projectId: row.projectId, paused: [], skipped: [] });
      continue;
    }
    overBudget += 1;

    const campaigns = await deps.listActiveCampaignsForProject(pool, row.projectId);
    const paused: AutoPausedCampaign[] = [];
    const skipped: AutoPauseSkipped[] = [];
    for (const c of campaigns) {
      const result = await pauseOneCampaign(pool, c, deps);
      if (result.paused) {
        paused.push(result.paused);
        pausedTotal += 1;
      }
      if (result.skipped) skipped.push(result.skipped);
    }
    perProject.push({ projectId: row.projectId, paused, skipped });
  }

  return { period, scanned: candidates.length, overBudget, pausedTotal, perProject };
}
