/**
 * MarketIntelligenceSection.tsx
 *
 * Wrapper-komponent som binder Brand Kit + Overview + Detail-sider sammen
 * og kan mountes som én seksjon i MarketingCockpitTab.
 *
 * State: 'overview' (default) | 'detail' (når Daniel åpner en scan).
 *
 * Leadgrid-panelene (LeadInbox/WonLost/ScheduledReports) er gatet bak
 * module_feature_entitlements (CTO-audit P1, Migration Plan steg 3) — MI
 * skal fungere fullt ut med Leadgrid deaktivert for org-en. Komponentene
 * lazy-importeres så de hverken mountes eller fyrer API-kall når modulen
 * er låst.
 */

import React, { Suspense, useState } from "react";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import BrandKitPanel from "./BrandKitPanel";
import MarketIntelligenceOverviewPanel from "./MarketIntelligenceOverviewPanel";
import MarketScanDetailPanel from "./MarketScanDetailPanel";
import AgentContextPreviewPanel from "./AgentContextPreviewPanel";
import LeadMapCampaignsPanel from "./LeadMapCampaignsPanel";
import InsightsFeedPanel from "./InsightsFeedPanel";
import OpportunityScorePanel from "./OpportunityScorePanel";
import GeoVisibilityPanel from "./GeoVisibilityPanel";
import AiTrafficPanel from "./AiTrafficPanel";
import { useModuleFeature } from "@/hooks/useModuleFeature";

const LeadInboxSection = React.lazy(() =>
  import("@/components/leadgrid/LeadInboxSection").then((m) => ({
    default: m.LeadInboxSection,
  })),
);
const WonLostDashboard = React.lazy(() =>
  import("@/components/leadgrid/WonLostDashboard").then((m) => ({
    default: m.WonLostDashboard,
  })),
);
const ScheduledReportsPanel = React.lazy(() =>
  import("@/components/leadgrid/ScheduledReportsPanel").then((m) => ({
    default: m.ScheduledReportsPanel,
  })),
);

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
  const { enabled: leadgridEnabled } = useModuleFeature("leadgrid");

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
          projectId={projectId}
          brandKey="theroleroom"
          onBack={() => setActiveScanId(null)}
        />
      ) : (
        <Stack spacing={3}>
          {leadgridEnabled && (
            <Suspense fallback={null}>
              {/* Innkommende Leadgrid-leads — øverst, høyest urgency */}
              <LeadInboxSection />

              {/* Won/Lost-dashboard — KPI + MoM + funnel */}
              <WonLostDashboard />

              {/* Schedulerte rapporter — ukentlig PDF på e-post */}
              <ScheduledReportsPanel />
            </Suspense>
          )}

          <InsightsFeedPanel />

          <OpportunityScorePanel />

          <BrandKitPanel
            projectId={projectId}
            defaultScanUrl={defaultBrandScanUrl}
          />
          <MarketIntelligenceOverviewPanel
            projectId={projectId}
            onOpenScanDetail={setActiveScanId}
          />
          <GeoVisibilityPanel />
          <AiTrafficPanel />
          <LeadMapCampaignsPanel />
          <AgentContextPreviewPanel projectId={projectId} />
        </Stack>
      )}
    </Box>
  );
}
