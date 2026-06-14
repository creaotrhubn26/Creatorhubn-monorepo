/**
 * MarketIntelligenceSection.tsx
 *
 * Wrapper-komponent som binder Brand Kit + Overview + Detail-sider sammen
 * og kan mountes som én seksjon i MarketingCockpitTab.
 *
 * State: 'overview' (default) | 'detail' (når Daniel åpner en scan).
 */

import React, { useState } from "react";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import BrandKitPanel from "./BrandKitPanel";
import MarketIntelligenceOverviewPanel from "./MarketIntelligenceOverviewPanel";
import MarketScanDetailPanel from "./MarketScanDetailPanel";

interface Props {
  /** Aktivt prosjekt — brukes til Brand Kit + scans-isolering. */
  projectId: string;
  /** Defaultverdi for "scan ditt nettsted"-input. */
  defaultBrandScanUrl?: string;
}

export default function MarketIntelligenceSection({
  projectId,
  defaultBrandScanUrl,
}: Props) {
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  return (
    <Box>
      {/* Header */}
      <Divider sx={{ borderColor: "rgba(167, 139, 250, 0.32)", mb: 2 }}>
        <Chip
          label="MARKET INTELLIGENCE"
          size="small"
          sx={{
            background: "rgba(167, 139, 250, 0.18)",
            color: "#a78bfa",
            fontSize: "0.7rem",
            fontWeight: 700,
          }}
        />
      </Divider>

      {activeScanId ? (
        <MarketScanDetailPanel
          scanId={activeScanId}
          onBack={() => setActiveScanId(null)}
        />
      ) : (
        <Stack spacing={3}>
          <BrandKitPanel
            projectId={projectId}
            defaultScanUrl={defaultBrandScanUrl}
          />
          <MarketIntelligenceOverviewPanel
            projectId={projectId}
            onOpenScanDetail={setActiveScanId}
          />
        </Stack>
      )}
    </Box>
  );
}
