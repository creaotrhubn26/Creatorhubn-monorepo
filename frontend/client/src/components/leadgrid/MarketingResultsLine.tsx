/**
 * MarketingResultsLine — «Likes 12 · Kommentarer 3 (siste 30 dager)» for den
 * aktive planen. Kjører kpi-sync én gang per plan per sidelast (LinkedIn
 * likes/kommentarer for poster publisert herfra), og viser summen fra
 * kpi-summary. Ingen tall → ingen linje (ærlig tom-tilstand).
 *
 * Dette er det som gjør at neste «Ny plan» lærer av forrige: motoren leser
 * de samme snapshotene som previousPlanKpiContext.
 */
import { useEffect, useState } from "react";
import { Stack, Typography } from "@mui/material";
import InsightsIcon from "@mui/icons-material/Insights";
import roleRoomAgentService from "@/components/role-room/services/roleRoomAgentService";

interface Props {
  planId: string;
  /** Bump etter en publisering for å hente tall på nytt. */
  refreshKey?: number;
  sinceDays?: number;
}

interface Totals {
  impressions: number | null;
  likes: number;
  comments: number;
  posts: number;
}

export function MarketingResultsLine({ planId, refreshKey, sinceDays = 30 }: Props) {
  const [totals, setTotals] = useState<Totals | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Sync er best-effort: uten LinkedIn-lesetilgang skrives ingenting, og
      // linjen forblir skjult i stedet for å vise 0.
      await roleRoomAgentService.syncKpis(planId).catch(() => null);
      const summary = await roleRoomAgentService.fetchKpiSummary(planId, sinceDays).catch(() => null);
      if (cancelled) return;
      const linkedin = summary?.aggregates.byPlatform.find((row) => row.key === "linkedin");
      if (!summary || summary.snapshotCount === 0 || !linkedin) {
        setTotals(null);
        return;
      }
      const impressions = linkedin.sumByMetric.impressions;
      setTotals({
        impressions: typeof impressions === "number" && impressions > 0 ? Math.round(impressions) : null,
        likes: Math.round(linkedin.sumByMetric.likes ?? 0),
        comments: Math.round(linkedin.sumByMetric.comments ?? 0),
        posts: linkedin.postCount,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, refreshKey, sinceDays]);

  if (!totals) return null;
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" data-testid="marketing-results-line">
      <InsightsIcon sx={{ fontSize: 16, color: "#0a66c2" }} />
      <Typography variant="body2" color="text.secondary">
        LinkedIn siste {sinceDays} dager:{" "}
        {totals.impressions !== null ? `${totals.impressions.toLocaleString("nb-NO")} visninger · ` : ""}
        {totals.likes} likes · {totals.comments} kommentarer på {totals.posts}{" "}
        {totals.posts === 1 ? "post" : "poster"}
      </Typography>
    </Stack>
  );
}

export default MarketingResultsLine;
