/**
 * LeadStatusHistory.tsx
 *
 * Timeline-visning av alle status-endringer på en lead.
 */

import React, { useEffect, useState } from "react";
import {
  Box, Stack, Typography, Avatar, Chip, Divider, CircularProgress,
} from "@mui/material";

interface HistoryRow {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  metadata: any;
  changed_at: string;
  changed_by_user_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Ny", contacted: "Kontaktet", meeting_booked: "Møte booket",
  proposal_sent: "Forslag sendt", negotiating: "I forhandling",
  won: "Vunnet 🎉", lost: "Tapt", paused: "Pauset", archived: "Arkivert",
  active: "Aktiv", lead: "Lead",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#888", contacted: "#60a5fa", meeting_booked: "#a78bfa",
  proposal_sent: "#fbbf24", negotiating: "#ffb86b",
  won: "#9be15d", lost: "#f87171", paused: "#888", archived: "#888",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("no-NO", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export function LeadStatusHistory({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leadgrid/customers/${customerId}/status-history`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : { history: [] })
      .then((d) => setItems(d.history ?? []))
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <CircularProgress size={20} />;
  if (items.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        Ingen status-endringer registrert
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {items.map((h, i) => {
        const fullName = [h.first_name, h.last_name].filter(Boolean).join(" ") || "Bruker";
        const initials = fullName.split(" ").map((s) => s[0]).slice(0, 2).join("");
        const isLast = i === items.length - 1;
        return (
          <Box key={h.id} sx={{ display: "flex", gap: 1.5, position: "relative" }}>
            {/* Tråd */}
            {!isLast && (
              <Box sx={{ position: "absolute", left: 11, top: 28, bottom: -8,
                          width: 2, bgcolor: "rgba(255,255,255,0.10)" }} />
            )}
            {/* Prikk */}
            <Box sx={{ width: 24, display: "flex", justifyContent: "center" }}>
              <Box sx={{
                width: 12, height: 12, borderRadius: "50%",
                bgcolor: STATUS_COLORS[h.to_status] ?? "#888",
                border: "2px solid #0a0512",
                mt: 0.5, zIndex: 1,
              }} />
            </Box>
            <Box sx={{ flex: 1, pb: isLast ? 0 : 1.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.3}>
                {h.from_status && (
                  <>
                    <Chip size="small" label={STATUS_LABELS[h.from_status] ?? h.from_status}
                          variant="outlined"
                          sx={{ fontSize: 10, height: 18,
                                color: STATUS_COLORS[h.from_status] ?? "#888",
                                borderColor: STATUS_COLORS[h.from_status] ?? "#888" }} />
                    <Typography variant="caption" color="text.disabled">→</Typography>
                  </>
                )}
                <Chip size="small" label={STATUS_LABELS[h.to_status] ?? h.to_status}
                      sx={{ fontSize: 10, height: 18, fontWeight: 700,
                            bgcolor: STATUS_COLORS[h.to_status] ?? "#888",
                            color: "#0a0512" }} />
              </Stack>
              {h.note && (
                <Typography variant="body2" sx={{ color: "#fff", mb: 0.3, fontStyle: "italic" }}>
                  "{h.note}"
                </Typography>
              )}
              {h.to_status === "won" && h.metadata?.won_amount_oere && (
                <Typography variant="body2" sx={{ color: "#9be15d", fontWeight: 700 }}>
                  💰 {(Number(h.metadata.won_amount_oere) / 100).toLocaleString("no-NO")} kr
                  {h.metadata.won_recurring_oere ? (
                    <> + {(Number(h.metadata.won_recurring_oere) / 100).toLocaleString("no-NO")} kr/mnd</>
                  ) : null}
                </Typography>
              )}
              {h.to_status === "lost" && h.metadata?.lost_reason && (
                <Typography variant="caption" sx={{ color: "#f87171" }}>
                  Årsak: {h.metadata.lost_reason}
                  {h.metadata.lost_reason_detail ? ` — ${h.metadata.lost_reason_detail}` : ""}
                </Typography>
              )}
              <Stack direction="row" spacing={1} alignItems="center" mt={0.3}>
                <Avatar src={h.profile_image_url ?? undefined} sx={{ width: 16, height: 16, fontSize: 9 }}>
                  {initials}
                </Avatar>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  {fullName} · {formatTime(h.changed_at)}
                </Typography>
              </Stack>
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}
