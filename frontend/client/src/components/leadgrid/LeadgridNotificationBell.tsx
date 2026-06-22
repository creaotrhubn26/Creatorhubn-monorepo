/**
 * LeadgridNotificationBell.tsx
 *
 * Bell-ikon m/ unread-counter for Leadgrid-tildelings-notifikasjoner.
 * Dropdown viser siste 10 varsler + "mark all as read" + lenke til
 * full inbox + lenke til varslings-prefs.
 *
 * Polling hvert 30s. Real-time SSE kommer i fase 2.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Badge, Box, IconButton, Menu, MenuItem, Typography, Stack, Divider,
  Button, Chip, CircularProgress, Tooltip,
} from "@mui/material";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import SettingsIcon from "@mui/icons-material/Settings";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import WrongLocationIcon from "@mui/icons-material/WrongLocation";

interface Notif {
  id: string;
  event_type: string;
  title: string;
  body: string;
  lead_id: string;
  deep_link: string | null;
  meta: { tier?: string; note?: string } | null;
  read_at: string | null;
  created_at: string;
  by_first: string | null;
  by_last: string | null;
}

const EVENT_ICONS: Record<string, React.ReactNode> = {
  lead_assigned_as_team_leader: <NotificationsActiveIcon sx={{ color: "#a78bfa" }} />,
  lead_assigned_as_rep:         <NotificationsActiveIcon sx={{ color: "#9be15d" }} />,
  lead_assigned_on_accept:      <NotificationsActiveIcon sx={{ color: "#a78bfa" }} />,
  lead_won:                     <NotificationsActiveIcon sx={{ color: "#9be15d" }} />,
  lead_status_change:           <NotificationsActiveIcon sx={{ color: "#ffb86b" }} />,
  territory_breach:             <WrongLocationIcon sx={{ color: "#ff6b6b" }} />,
};

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "nå";
  if (m < 60) return `${m} min siden`;
  if (m < 1440) return `${Math.floor(m / 60)} t siden`;
  return `${Math.floor(m / 1440)}d siden`;
}

export function LeadgridNotificationBell({ onOpenPrefs }: { onOpenPrefs?: () => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/leadgrid/my-notifications", { credentials: "include" });
      if (!r.ok) return;
      const j = await r.json();
      setItems(j.items ?? []);
      setUnread(j.unread_count ?? 0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const markAllRead = async () => {
    await fetch("/api/leadgrid/my-notifications/mark-read", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [] }),
    });
    await load();
  };

  const handleNotifClick = async (n: Notif) => {
    if (!n.read_at) {
      await fetch("/api/leadgrid/my-notifications/mark-read", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [n.id] }),
      });
    }
    if (n.deep_link) {
      window.location.href = n.deep_link;
    }
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title={unread > 0 ? `${unread} uleste varsler` : "Varsler"}>
        <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
          <Badge badgeContent={unread} color="error" max={99}>
            {unread > 0 ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}
            slotProps={{ paper: { sx: { width: 380, maxHeight: 560 } } }}>
        <Box sx={{ p: 1.5, display: "flex", alignItems: "center" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
            Varsler
            {unread > 0 && (
              <Chip size="small" label={unread} color="error"
                    sx={{ ml: 1, height: 18, fontSize: 10, fontWeight: 700 }} />
            )}
          </Typography>
          <Tooltip title="Marker alle som lest">
            <span>
              <IconButton size="small" disabled={unread === 0} onClick={markAllRead}>
                <MarkEmailReadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {onOpenPrefs && (
            <Tooltip title="Varsels-innstillinger">
              <IconButton size="small" onClick={() => { setAnchor(null); onOpenPrefs(); }}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        <Divider />
        {loading && items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress size={24} /></Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              Ingen varsler ennå
            </Typography>
          </Box>
        ) : (
          items.map((n) => {
            const tier = n.meta?.tier;
            const isUnread = !n.read_at;
            return (
              <MenuItem key={n.id} onClick={() => handleNotifClick(n)}
                        sx={{
                          py: 1.25, alignItems: "flex-start",
                          bgcolor: isUnread ? "rgba(167,139,250,0.06)" : "transparent",
                          borderLeft: isUnread ? "3px solid #a78bfa" : "3px solid transparent",
                        }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ width: "100%" }}>
                  <Box>
                    {tier === "hot" ? <LocalFireDepartmentIcon sx={{ color: "#f87171" }} />
                     : tier === "warm" ? <WhatshotIcon sx={{ color: "#ffb86b" }} />
                     : EVENT_ICONS[n.event_type] ?? <NotificationsNoneIcon />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: isUnread ? 700 : 500,
                                                       lineHeight: 1.3,
                                                       whiteSpace: "normal" }}>
                      {n.title}
                    </Typography>
                    {n.body && (
                      <Typography variant="caption" sx={{ color: "text.secondary",
                                                            mt: 0.3,
                                                            whiteSpace: "normal",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            display: "-webkit-box",
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: "vertical" }}>
                        {n.body}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                      <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10 }}>
                        {timeAgo(n.created_at)}
                      </Typography>
                      {(n.by_first || n.by_last) && (
                        <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10 }}>
                          · av {[n.by_first, n.by_last].filter(Boolean).join(" ")}
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                  {isUnread && (
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%",
                                bgcolor: "#a78bfa", flexShrink: 0, mt: 1 }} />
                  )}
                </Stack>
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
}
