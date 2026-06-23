/**
 * TerritoryGridChip.tsx
 *
 * Myk "utenfor din sone"-indikator for en lead. Spør
 * /api/leadgrid/territories/check?leadId=… og viser en advarsels-chip
 * KUN når innlogget selger har en grid (enforced) og lead-en faller
 * utenfor den. Blokkerer ingenting — ren synlig påminnelse.
 *
 * Rendrer ingenting hvis lead-en er innenfor sonen, hvis brukeren ikke
 * har en grid, eller mens kallet laster.
 */

import React, { useEffect, useState } from "react";
import { Chip, Tooltip } from "@mui/material";
import WrongLocationIcon from "@mui/icons-material/WrongLocation";

interface CheckResult {
  in_grid: boolean;
  enforced: boolean;
  matched_territory_id: string | null;
  conflicting_user_id: string | null;
}

interface Props {
  leadId: string;
  size?: "small" | "medium";
}

export function TerritoryGridChip({ leadId, size = "small" }: Props) {
  const [result, setResult] = useState<CheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/leadgrid/territories/check?leadId=${encodeURIComponent(leadId)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CheckResult | null) => { if (!cancelled) setResult(d); })
      .catch(() => { /* stille — chip vises bare ved tydelig brudd */ });
    return () => { cancelled = true; };
  }, [leadId]);

  if (!result || !result.enforced || result.in_grid) return null;

  return (
    <Tooltip title="Denne lead-en ligger utenfor ditt tildelte område. Sjekk med teamleder før du følger den opp.">
      <Chip
        size={size}
        icon={<WrongLocationIcon sx={{ fontSize: 16 }} />}
        label="Utenfor din sone"
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: "#ff6b6b",
          borderColor: "#ff6b6b",
          bgcolor: "rgba(255,107,107,0.08)",
        }}
        variant="outlined"
      />
    </Tooltip>
  );
}
