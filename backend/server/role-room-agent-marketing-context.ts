/**
 * role-room-agent-marketing-context.ts
 *
 * Lese-only kontekst-blokk som gjør The Role Room chat-agenten BEVISST på
 * markedsførings- og merkevare-systemene vi har bygd — Business DNA (brand-kit),
 * katalog, målgruppe-segmenter + ROAS, GEO-synlighet — så den grunner alt den
 * foreslår i dem.
 *
 * Passer propose-only-arkitekturen: agenten muterer ikke disse (de styres i
 * admin), men den skal rådgi på dem. Henter KUN den innloggedes egne data
 * (nøkkel-gated på userId/projectId → ingen kryss-lekkasje). Env-gated for
 * rollback (ROLE_ROOM_AGENT_MARKETING_CONTEXT=off). Kaster aldri.
 */

import type { Pool } from "pg";
import { getBrandKit } from "./brand-kit-service.js";
import { getSegmentPerformance, listSegments } from "./marketing-segments-service.js";
import { listCatalog } from "./marketing-catalog-service.js";

export async function buildMarketingContextBlock(
  pool: Pool,
  input: { userId: string; projectId: string },
): Promise<string | null> {
  if (process.env.ROLE_ROOM_AGENT_MARKETING_CONTEXT === "off") return null;
  if (!input?.userId || !input?.projectId) return null;

  try {
    const sections: string[] = [];

    // 1) Business DNA (prosjekt-scopet — trygt)
    const kit = await getBrandKit(pool, input.projectId).catch(() => null);
    if (kit) {
      const b = kit.effective;
      const colors = [b.colors?.primary, b.colors?.secondary, b.colors?.accent]
        .filter(Boolean)
        .join("/");
      const usps = Array.isArray(b.usps) ? b.usps.slice(0, 3).join("; ") : "";
      sections.push(
        `MERKEVARE (Business DNA): ${b.businessName} — «${b.tagline}». Tone: ${b.toneOfVoice}. ` +
          `Bransje: ${b.industry}. Målgruppe: ${b.targetAudience}.` +
          (colors ? ` Farger: ${colors}.` : "") +
          (usps ? ` USP: ${usps}.` : ""),
      );
    }

    // 2) Katalog (brukerens egne aktive produkter)
    const catalog = await listCatalog(pool, input.userId).catch(() => []);
    const active = catalog.filter((c) => c.active);
    if (active.length > 0) {
      sections.push(
        `KATALOG (${active.length} produkter kampanjer kan fokusere på): ` +
          `${active.slice(0, 12).map((c) => c.name).join(", ")}.`,
      );
    }

    // 3) Målgruppe-segmenter + ROAS (brukerens egne)
    const segments = await listSegments(pool, input.userId).catch(() => []);
    if (segments.length > 0) {
      const withPerf = await Promise.all(
        segments.slice(0, 8).map(async (s) => ({
          name: s.name,
          perf: await getSegmentPerformance(pool, s.id).catch(() => null),
        })),
      );
      const best = withPerf
        .filter((x) => x.perf && x.perf.roas !== null)
        .sort((a, b) => (b.perf?.roas ?? 0) - (a.perf?.roas ?? 0))[0];
      const line =
        `MÅLGRUPPER (${segments.length} segmenter → synkroniserte Google/Meta/LinkedIn-audiences): ` +
        `${segments.slice(0, 6).map((s) => s.name).join(", ")}.`;
      sections.push(
        best && best.perf ? `${line} Best avkastning: «${best.name}» (ROAS ${best.perf.roas}×).` : line,
      );
    }

    // 4) GEO-synlighet (lett teller — egen tabell, tåler at den ikke finnes)
    try {
      const geo = await pool.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM geo_prompt_sets
          WHERE workspace_owner_user_id = $1 AND status = 'approved'`,
        [input.userId],
      );
      const geoN = geo.rows[0]?.n ? Number(geo.rows[0].n) : 0;
      if (geoN > 0) {
        sections.push(
          `GEO-SYNLIGHET: ${geoN} godkjente prompt-sett spores ukentlig (AI-søk-synlighet i ChatGPT/Claude/Perplexity).`,
        );
      }
    } catch {
      /* geo-tabell finnes ikke i dette miljøet — hopp over */
    }

    if (sections.length === 0) return null;

    return (
      "## Markedsførings- og merkevare-kontekst (bruk aktivt)\n" +
      "Grunn ALT du foreslår (poster, tidslinjer, råd) i merkevarens tone, farger og USP-er. Referér relevante " +
      "katalog-produkter, målgrupper og GEO-innsikt når det er naturlig. Du kan IKKE mutere disse systemene fra " +
      "chatten (de styres i admin) — men du skal rådgi på dem og peke brukeren dit.\n\n" +
      sections.join("\n")
    );
  } catch {
    return null;
  }
}
