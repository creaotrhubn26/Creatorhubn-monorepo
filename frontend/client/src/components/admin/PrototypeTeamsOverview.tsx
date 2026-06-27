/**
 * PrototypeTeamsOverview.tsx
 *
 * Admin-oversikt over prototype-tester-TEAM (master + medlemmer + status + ledige
 * plasser). Vises i Prototype-testere-fanen. Read-only — gir admin innsyn i teamene
 * etter godkjenning (masteren ser dette via «mitt team»).
 */

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Chip, Stack } from "@mui/material";
import { apiRequest } from "@/lib/queryClient";
import { AdminCard, StatusChip, AdminLoading } from "./design-system";

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  status: string;
  acceptedAt: string | null;
  invitedAt: string | null;
}
interface Team {
  masterId: string;
  masterEmail: string;
  masterName: string | null;
  masterStatus: string;
  maxTeamSize: number;
  usedSlots: number;
  slotsRemaining: number;
  programEndsAt: string | null;
  members: TeamMember[];
}

function statusChip(s: string) {
  const x = String(s || "").toLowerCase();
  const tone = x === "accepted" || x === "active" ? "success" : x === "pending" ? "warning" : "neutral";
  return <StatusChip tone={tone} label={s || "ukjent"} />;
}

export default function PrototypeTeamsOverview() {
  const q = useQuery<{ teams: Team[] }>({
    queryKey: ["/api/superadmin/prototype-tester-teams"],
    queryFn: () => apiRequest("/api/superadmin/prototype-tester-teams"),
  });
  const teams = Array.isArray(q.data?.teams) ? q.data.teams : [];

  if (q.isLoading) return <AdminLoading />;
  if (teams.length === 0) return null; // ingen team → ikke vis kortet

  return (
    <AdminCard title={`👥 Prototype-team (${teams.length})`}>
        <Stack spacing={1.5}>
          {teams.map((t) => (
            <Box
              key={t.masterId}
              sx={{ p: 1.5, borderRadius: 1, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {t.masterName || t.masterEmail}
                    <Chip size="small" label="master" sx={{ ml: 0.5 }} />
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{t.masterEmail}</Typography>
                </Box>
                <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                  {statusChip(t.masterStatus)}
                  <Chip size="small" variant="outlined" label={`${t.usedSlots}/${t.maxTeamSize} plasser`} />
                  {t.slotsRemaining > 0 ? (
                    <Chip size="small" variant="outlined" color="info" label={`${t.slotsRemaining} ledig`} />
                  ) : null}
                </Stack>
              </Stack>
              {t.members.length > 0 ? (
                <Box sx={{ mt: 1, pl: 1, borderLeft: "2px solid", borderColor: "divider" }}>
                  {t.members.map((m) => (
                    <Stack key={m.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.25 }}>
                      <Typography variant="caption" noWrap>{m.name || m.email}</Typography>
                      {statusChip(m.status)}
                    </Stack>
                  ))}
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Ingen medlemmer invitert ennå.
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
    </AdminCard>
  );
}
