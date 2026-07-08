/**
 * ImpersonationBanner.tsx
 *
 * Global, alltid-synlig banner når en super_admin «ser som» en annen bruker.
 * Poller impersonation-status; viser hvem man ser som + «Avslutt». Monteres i
 * App-roten så den vises på ALLE flater (også målbrukerens workspace).
 */

import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Box, Button, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { apiRequest } from "@/lib/queryClient";

interface Status { active: boolean; targetName?: string; targetEmail?: string; targetRole?: string; impersonatorEmail?: string; expiresAt?: number }

export default function ImpersonationBanner() {
  const { data } = useQuery<Status>({
    queryKey: ["/api/superadmin/impersonation-status"],
    queryFn: () => apiRequest("/api/superadmin/impersonation-status"),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const end = useMutation({
    mutationFn: () => apiRequest("/api/superadmin/end-impersonation-user", { method: "POST" }),
    onSuccess: () => { window.location.href = "/admin"; },
  });

  if (!data?.active) return null;

  return (
    <Box
      sx={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 2147483000,
        bgcolor: "#c62828", color: "#fff", px: 2, py: 0.75,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, flexWrap: "wrap",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}
    >
      <VisibilityIcon sx={{ fontSize: 18 }} />
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Du ser som <b>{data.targetName}</b>{data.targetEmail ? ` (${data.targetEmail})` : ""} — handlinger utføres som denne brukeren.
      </Typography>
      <Button
        size="small"
        variant="contained"
        onClick={() => end.mutate()}
        disabled={end.isPending}
        sx={{ bgcolor: "#fff", color: "#c62828", fontWeight: 700, "&:hover": { bgcolor: "#f5f5f5" } }}
      >
        {end.isPending ? "Avslutter…" : "Avslutt"}
      </Button>
    </Box>
  );
}
