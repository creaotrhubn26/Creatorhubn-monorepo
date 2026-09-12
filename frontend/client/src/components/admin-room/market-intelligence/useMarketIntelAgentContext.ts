/**
 * useMarketIntelAgentContext.ts
 *
 * Frontend-hook som henter den kompakte MI-konteksten klar for å injectes
 * inn i Role Room Agent-prompt.
 *
 * Returnerer:
 *   - promptInjectionText (string å limes inn i system-prompt)
 *   - structured (objekter for tools-bruk)
 *   - loading/error
 *
 * Brukes av:
 *   - Eksisterende Role Room Agent-chat når den åpnes i Marketing Cockpit-
 *     kontekst — injecter MI-context automatisk.
 *   - Fremtidige "Send til Agent"-knapper i MarketScanDetailPanel.
 */

import { useCallback, useEffect, useState } from "react";

interface BrandKitBaseline {
  brandName: string;
  industry: string;
  toneOfVoice: string;
  targetAudience: string;
  primaryCTA: string;
  usps: string[];
  primaryColor: string;
  accentColor: string;
}

interface MarketIntelAgentContextData {
  brandKit: BrandKitBaseline | null;
  recentScans: Array<{
    id: string;
    name: string;
    marketQuery: string;
    totalCompetitors: number;
    totalOpportunities: number;
    confidenceSummary: string;
  }>;
  topOpportunities: Array<{
    id: string;
    marketScanId: string;
    title: string;
    simpleSummary: string;
    impact: string;
    confidence: string;
    recommendedAction: string;
  }>;
  activeWorkflows: Array<{
    id: string;
    currentStatus: string;
    initiatingAction: string;
    campaignDraftId?: number | null;
    contentPackDraftIds: number[];
    nextRecommendedAction?: string | null;
  }>;
  promptInjectionText: string;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("rr_bearer") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useMarketIntelAgentContext(projectId: string) {
  const [context, setContext] = useState<MarketIntelAgentContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/role-room/agent/market-intel-context?projectId=${encodeURIComponent(projectId)}`,
        {
          credentials: "include",
          headers: authHeaders(),
        },
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      const body = await r.json();
      setContext(body.context);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchContext();
  }, [fetchContext]);

  return { context, loading, error, refetch: fetchContext };
}
