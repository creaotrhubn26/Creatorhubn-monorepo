/**
 * TerritoryManagerDashboard.tsx
 *
 * Leder-oversikt over sone-ytelse per selger: brudd (lead/gps/besøk), besøk
 * in-grid vs ute, leads in-grid vs ute, og «utenfor sonen nå» (live GPS).
 * Komplementerer salgs-leaderboardet med territorie-vinkelen.
 *
 * Data: GET /api/leadgrid/territories/dashboard?period=
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Box, Stack, Typography, Card, CardContent, CircularProgress, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import WrongLocationIcon from "@mui/icons-material/WrongLocation";

interface SellerStats {
  userId: string;
  displayName: string | null;
  role: string | null;
  teamName: string | null;
  hasGrid: boolean;
  breaches: { leadAccess: number; gps: number; visit: number; total: number };
  visits: { total: number; inGrid: number; outOfGrid: number };
  leads: { total: number; inGrid: number; outOfGrid: number };
  live: { lat: number; lng: number; currentlyOutOfGrid: boolean } | null;
}

type Period = "this_month" | "last_30d" | "ytd";
const PERIOD_LABEL: Record<Period, string> = {
  this_month: "Denne mnd", last_30d: "Siste 30d", ytd: "I år",
};

export function TerritoryManagerDashboard({ organizationId }: { organizationId?: string }) {
  const [sellers, setSellers] = useState<SellerStats[]>([]);
  const [period, setPeriod] = useState<Period>("last_30d");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (organizationId) params.set("organization_id", organizationId);
    try {
      const r = await fetch(`/api/leadgrid/territories/dashboard?${params}`, { credentials: "include" });
      if (r.ok) setSellers((await r.json()).sellers ?? []);
    } finally {
      setLoading(false);
    }
  }, [organizationId, period]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" rowGap={1}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Sone-ytelse per selger</Typography>
        <ToggleButtonGroup size="small" exclusive value={period}
          onChange={(_, v) => v && setPeriod(v)}>
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <ToggleButton key={p} value={p}>{PERIOD_LABEL[p]}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {loading ? (
        <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>
      ) : sellers.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Ingen selgere å vise.</Typography>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Selger</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="center">Sone-brudd</TableCell>
                  <TableCell align="center">Besøk (i/ute)</TableCell>
                  <TableCell align="center">Leads (i/ute)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sellers.map((s) => (
                  <TableRow key={s.userId} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {s.displayName ?? s.userId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[s.role, s.teamName].filter(Boolean).join(" · ") || "—"}
                        {!s.hasGrid && " · ingen grid"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {s.live?.currentlyOutOfGrid ? (
                        <Chip size="small" color="error" icon={<WrongLocationIcon sx={{ fontSize: 14 }} />}
                          label="Ute nå" />
                      ) : s.live ? (
                        <Chip size="small" color="success" variant="outlined" label="I sonen" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">offline</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {s.breaches.total === 0 ? (
                        <Typography variant="caption" color="text.secondary">0</Typography>
                      ) : (
                        <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                          {s.breaches.gps > 0 && <Chip size="small" label={`GPS ${s.breaches.gps}`} color="warning" />}
                          {s.breaches.visit > 0 && <Chip size="small" label={`Besøk ${s.breaches.visit}`} color="warning" />}
                          {s.breaches.leadAccess > 0 && <Chip size="small" label={`Lead ${s.breaches.leadAccess}`} />}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <span style={{ color: "#9be15d" }}>{s.visits.inGrid}</span>
                      {" / "}
                      <span style={{ color: s.visits.outOfGrid > 0 ? "#ff6b6b" : undefined }}>{s.visits.outOfGrid}</span>
                    </TableCell>
                    <TableCell align="center">
                      <span style={{ color: "#9be15d" }}>{s.leads.inGrid}</span>
                      {" / "}
                      <span style={{ color: s.leads.outOfGrid > 0 ? "#ff6b6b" : undefined }}>{s.leads.outOfGrid}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
