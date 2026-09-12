/**
 * role-room-agent-workspace-context.ts
 *
 * Builds a compact, AGGREGATE-ONLY "workspace status" block that is injected
 * into the chat agent's prompt as a FRESH (uncached) system block — so the
 * agent can answer operational questions across all six producer tabs (Inbox,
 * Leads, Analytics, Feed) without the producer pasting numbers in.
 *
 * Privacy posture (agreed): aggregates only. This block carries counts,
 * distributions, sentiment tallies, ROI figures and feed-status counts —
 * NEVER third-party names, e-mails, phone numbers or message bodies. The
 * per-item detail in the snapshots (coldLeads[], topNegative[]) is deliberately
 * reduced to counts here. For specifics the agent points the producer to the
 * relevant tab.
 *
 * Kept out of the cached system prefix on purpose: these numbers change often,
 * so they live in a separate uncached block to avoid busting the 5-minute
 * prompt cache that protects the (stable) project context.
 */

import type { Pool } from "pg";
import {
  getAnalyticsSnapshot,
  getFeedStatusSnapshot,
  getInboxSnapshot,
  getLeadFunnelSnapshot,
} from "./role-room-agent-workspace-data.js";

export interface WorkspaceContextInput {
  userId: string;
  projectId: string;
}

function dist(record: Record<string, number>): string {
  const entries = Object.entries(record).filter(([, n]) => n > 0);
  if (entries.length === 0) return "ingen";
  return entries.map(([k, n]) => `${k}: ${n}`).join(", ");
}

/**
 * Assemble the aggregate workspace-status text, or null when there is nothing
 * worth telling the agent (all surfaces empty) so we don't spend tokens on a
 * block of zeroes. Never throws — each snapshot already fails into a safe
 * empty shape, and any unexpected error here returns null.
 */
export async function buildWorkspaceContextBlock(
  pool: Pool,
  input: WorkspaceContextInput,
): Promise<string | null> {
  if (process.env.ROLE_ROOM_AGENT_WORKSPACE_CONTEXT === "off") return null;
  if (!input?.userId || !input?.projectId) return null;

  try {
    const [inbox, leads, analytics, feed] = await Promise.all([
      getInboxSnapshot(pool, input.userId),
      getLeadFunnelSnapshot(pool, input.userId),
      getAnalyticsSnapshot(pool, input.userId),
      getFeedStatusSnapshot(pool, input.projectId),
    ]);

    const sections: string[] = [];

    if (inbox.totalEvents > 0) {
      const neg = inbox.sentimentBreakdown.negative ?? 0;
      sections.push(
        `Inbox: ${inbox.totalEvents} hendelser (${inbox.unread} uleste). ` +
          `Plattform — ${dist(inbox.byPlatform)}. Stemning — ${dist(inbox.sentimentBreakdown)}.` +
          (neg > 0 ? ` ${neg} negative.` : ""),
      );
    }

    if (leads.totalLeads > 0) {
      const cold = leads.coldLeads.length;
      sections.push(
        `Leads: ${leads.totalLeads} totalt. Segment — ${dist(leads.bySegment)}. ` +
          `Stadium — ${dist(leads.byStage)}.` +
          (cold > 0 ? ` ${cold} varme leads uten oppfølging.` : "") +
          ` ROI — brukt ${leads.roi.spendKr} kr, inntekt ${leads.roi.revenueKr} kr, ` +
          `kost/kunde ${leads.roi.costPerCustomerKr} kr.`,
      );
    }

    const analyticsActive =
      analytics.events.last30d.total > 0 ||
      analytics.followers.length > 0 ||
      analytics.publishCadence.published30d > 0;
    if (analyticsActive) {
      const followerTotal = analytics.followers.reduce(
        (sum, f) => sum + (typeof f.count === "number" ? f.count : 0),
        0,
      );
      sections.push(
        `Analytics: ${analytics.events.last7d.total} hendelser siste 7d ` +
          `(${analytics.events.last30d.total} siste 30d). ` +
          `Stemning 30d — positiv ${analytics.sentiment.positive}, nøytral ${analytics.sentiment.neutral}, ` +
          `negativ ${analytics.sentiment.negative}.` +
          (analytics.followers.length > 0 ? ` Følgere totalt ~${followerTotal}.` : "") +
          ` Publisert 30d — ${analytics.publishCadence.published30d}, ` +
          `planlagt ${analytics.publishCadence.scheduled30d}.`,
      );
    }

    const feedActive =
      Object.keys(feed.byApprovalState).length > 0 ||
      feed.awaitingClientOverdue > 0 ||
      feed.needsChanges > 0;
    if (feedActive) {
      sections.push(
        `Feed: ${dist(feed.byApprovalState)}.` +
          (feed.awaitingClientOverdue > 0
            ? ` ${feed.awaitingClientOverdue} poster forbi kunde-frist.`
            : "") +
          (feed.needsChanges > 0 ? ` ${feed.needsChanges} trenger endring.` : ""),
      );
    }

    if (sections.length === 0) return null;

    return (
      "### Arbeidsflate-status (aggregert, sanntid)\n" +
      "Dette er aggregerte signaler på tvers av fanene Inbox, Leads, Analytics og Feed " +
      "for dette prosjektet/kontoene. Bruk dem til å svare på operative spørsmål og " +
      "foreslå neste steg. Det finnes BEVISST ingen navn, e-post eller meldingstekst her " +
      "— for enkelt-elementer, henvis produsenten til den aktuelle fanen.\n" +
      sections.map((s) => `- ${s}`).join("\n")
    );
  } catch {
    return null;
  }
}
