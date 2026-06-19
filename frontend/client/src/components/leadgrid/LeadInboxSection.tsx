/**
 * LeadInboxSection.tsx
 *
 * Wrapper rundt LeadInboxCard for å vise det som en seksjon i
 * Admin Room → Market Intelligence (markedssjefens primære flate).
 *
 * Inkluderer:
 *  - Header m/ teller (totalt + uleste hot)
 *  - Collapse/ekspander-funksjonalitet
 *  - Pulse-effekt på chip når nye leads har kommet inn
 *  - Auto-refresh hvert 30. sek
 *  - Lenke til "se alle" → superadmin/leadgrid-inbox
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Card, CardContent, Chip, Collapse, Divider, IconButton, Stack,
  Tooltip, Typography, Button,
} from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import InboxIcon from "@mui/icons-material/Inbox";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { LeadInboxCard } from "./LeadInboxCard";

interface InboxStats {
  total: number;
  hot: number;
  warm: number;
  cool: number;
  cold: number;
  awaiting_research: number;
}

export function LeadInboxSection() {
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch("/api/superadmin/leads/inbox", { credentials: "include" });
      if (!r.ok) return;
      const items: any[] = (await r.json()).items ?? [];
      const next: InboxStats = {
        total: items.length,
        hot:  items.filter((i) => i.claude_temperature === "hot").length,
        warm: items.filter((i) => i.claude_temperature === "warm").length,
        cool: items.filter((i) => i.claude_temperature === "cool").length,
        cold: items.filter((i) => i.claude_temperature === "cold").length,
        awaiting_research: items.filter((i) =>
          i.research_status === "running" || i.research_status === "pending"
        ).length,
      };
      setStats(next);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 30000);
    return () => clearInterval(id);
  }, [loadStats, refreshKey]);

  // Skjul hele seksjonen hvis tomt — ikke ta opp visuell plass
  if (stats && stats.total === 0) return null;

  return (
    <Card sx={{
      bgcolor: stats && stats.hot > 0
        ? "rgba(248,113,113,0.06)"
        : "rgba(167,139,250,0.04)",
      border: stats && stats.hot > 0
        ? "1px solid rgba(248,113,113,0.30)"
        : "1px solid rgba(167,139,250,0.20)",
    }}>
      <CardContent sx={{ pb: expanded ? undefined : "16px !important" }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{
            width: 36, height: 36, borderRadius: 1,
            bgcolor: stats && stats.hot > 0
              ? "rgba(248,113,113,0.20)"
              : "rgba(167,139,250,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {stats && stats.hot > 0 ? (
              <LocalFireDepartmentIcon sx={{ color: "#f87171" }} />
            ) : (
              <InboxIcon sx={{ color: "#a78bfa" }} />
            )}
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Innkommende leads
              {stats && stats.total > 0 && (
                <Chip size="small" label={stats.total}
                      sx={{ ml: 1, fontWeight: 700,
                            bgcolor: "rgba(167,139,250,0.20)", color: "#a78bfa" }} />
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {stats && stats.total > 0
                ? "Nye demo-/kontakt-forespørsler m/ ferdig Brreg- og Claude-research"
                : "Når kunder sender forespørsel ser du dem her klare for behandling"}
            </Typography>
          </Box>

          {/* Score-chips */}
          {stats && (
            <Stack direction="row" spacing={0.5}>
              {stats.hot > 0 && (
                <Tooltip title={`${stats.hot} hot leads — handle nå`}>
                  <Chip size="small" color="error"
                        icon={<LocalFireDepartmentIcon sx={{ fontSize: 14 }} />}
                        label={`${stats.hot} HOT`}
                        sx={{ fontWeight: 700,
                              animation: stats.hot > 0
                                ? "pulse 2s ease-in-out infinite" : "none",
                              "@keyframes pulse": {
                                "0%, 100%": { transform: "scale(1)" },
                                "50%": { transform: "scale(1.08)" },
                              }}} />
                </Tooltip>
              )}
              {stats.warm > 0 && (
                <Chip size="small" color="warning" label={`${stats.warm} warm`} />
              )}
              {stats.awaiting_research > 0 && (
                <Tooltip title="Research kjører i bakgrunnen">
                  <Chip size="small"
                        label={`${stats.awaiting_research} venter`}
                        sx={{ fontSize: 10 }} />
                </Tooltip>
              )}
            </Stack>
          )}

          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Åpne i Leadgrid Super-admin">
            <IconButton size="small" component="a" href="/superadmin#inbox" target="_blank">
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        <Collapse in={expanded}>
          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.10)" }} />
          <LeadInboxCard key={refreshKey} />
        </Collapse>
      </CardContent>
    </Card>
  );
}
