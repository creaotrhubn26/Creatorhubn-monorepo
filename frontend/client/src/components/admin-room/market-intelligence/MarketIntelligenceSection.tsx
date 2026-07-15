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
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";

/** Én panel-krasj skal aldri hvitskjerme hele AdminRoom (lærdom 14.07:
 *  marketQuery-null felte alt). Boundary per seksjon, ærlig feilmelding. */
class MiErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 2, border: "1px solid rgba(248,113,113,0.4)", borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ color: "#f87171", fontWeight: 700 }}>
            Market Intelligence krasjet — resten av AdminRoom virker.
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
            {String(this.state.error)}
          </Typography>
        </Box>
      );
    }
    return this.props.children;
  }
}

import BrandKitPanel from "./BrandKitPanel";
import MarketIntelligenceOverviewPanel from "./MarketIntelligenceOverviewPanel";
import MarketScanDetailPanel from "./MarketScanDetailPanel";
import AgentContextPreviewPanel from "./AgentContextPreviewPanel";
import LeadMapCampaignsPanel from "./LeadMapCampaignsPanel";
import MorningBriefCard from "./MorningBriefCard";
import ButlerChatPanel from "./ButlerChatPanel";
import InsightsFeedPanel from "./InsightsFeedPanel";
import OpportunityScorePanel from "./OpportunityScorePanel";
import TenderIntelPanel from "./TenderIntelPanel";
import GrantWorkspacePanel from "./GrantWorkspacePanel";
import SocialQueuePanel from "./SocialQueuePanel";
import ProspectsPanel from "./ProspectsPanel";
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

function MarketIntelligenceSectionInner({
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
            <ErrorBoundary componentName="market-intelligence-leadgrid">
            <Suspense fallback={null}>
              {/* Innkommende Leadgrid-leads — øverst, høyest urgency */}
              <LeadInboxSection />

              {/* Won/Lost-dashboard — KPI + MoM + funnel */}
              <WonLostDashboard />

              {/* Schedulerte rapporter — ukentlig PDF på e-post */}
              <ScheduledReportsPanel />
            </Suspense>
            </ErrorBoundary>
          )}

          <MorningBriefCard />

          <ButlerChatPanel />

          <InsightsFeedPanel />

          <OpportunityScorePanel />

          <TenderIntelPanel />

          <GrantWorkspacePanel />

          <SocialQueuePanel />

          <ProspectsPanel />

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


export default function MarketIntelligenceSection(props: Parameters<typeof MarketIntelligenceSectionInner>[0]) {
  return (
    <MiErrorBoundary>
      <MarketIntelligenceSectionInner {...props} />
    </MiErrorBoundary>
  );
}
