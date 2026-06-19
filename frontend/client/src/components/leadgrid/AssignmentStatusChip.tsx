/**
 * AssignmentStatusChip.tsx
 *
 * Liten chip-cluster som viser status for hvem som er tildelt + om de har sett:
 *   ┌────────────────────────────────────────────────────────┐
 *   │ 👤 Anna H. (teamleder)  ✓ Sett kl 14:32               │
 *   │ 👤 Per O. (rep)          ⏰ Ikke sett enda             │
 *   └────────────────────────────────────────────────────────┘
 *
 * Pulls status fra /api/leadgrid/customers/:id/assignment-status.
 */

import React, { useEffect, useState } from "react";
import {
  Box, Stack, Typography, Avatar, Chip, Tooltip, IconButton, CircularProgress,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import EditIcon from "@mui/icons-material/Edit";

interface AssignmentStatus {
  assigned_team_leader_id: string | null;
  assigned_user_id: string | null;
  team_leader_first_opened_at: string | null;
  team_leader_last_seen_at: string | null;
  rep_first_opened_at: string | null;
  rep_last_seen_at: string | null;
  assigned_at: string | null;
  last_action_at: string | null;
  last_action_type: string | null;
  tl_first: string | null;
  tl_last: string | null;
  tl_avatar: string | null;
  tl_last_online: string | null;
  tl_current_route: string | null;
  rep_first: string | null;
  rep_last: string | null;
  rep_avatar: string | null;
  rep_last_online: string | null;
  rep_current_route: string | null;
}

interface Props {
  customerId: string;
  /** Hvis true, vis re-tildelings-knapp */
  canReassign?: boolean;
  onReassignClick?: (level: "team_leader" | "rep") => void;
  compact?: boolean;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nå";
  if (m < 60) return `${m} min siden`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} t siden`;
  const d = Math.floor(h / 24);
  return `${d}d siden`;
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 90_000;
}

export function AssignmentStatusChip({ customerId, canReassign, onReassignClick, compact }: Props) {
  const [status, setStatus] = useState<AssignmentStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leadgrid/customers/${customerId}/assignment-status`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then(setStatus)
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <CircularProgress size={14} />;
  if (!status) return null;
  if (!status.assigned_team_leader_id && !status.assigned_user_id) {
    return (
      <Chip size="small" label="Ikke tildelt" color="default"
            sx={{ fontSize: 11 }}
            onClick={canReassign ? () => onReassignClick?.("team_leader") : undefined}
            deleteIcon={canReassign ? <EditIcon sx={{ fontSize: 14 }} /> : undefined}
            onDelete={canReassign ? () => onReassignClick?.("team_leader") : undefined} />
    );
  }

  return (
    <Stack spacing={compact ? 0.5 : 1}>
      {status.assigned_team_leader_id && (
        <AssigneeRow
          name={[status.tl_first, status.tl_last].filter(Boolean).join(" ") || "Teamleder"}
          avatar={status.tl_avatar}
          isOnlineNow={isOnline(status.tl_last_online)}
          lastOnlineAt={status.tl_last_online}
          currentRoute={status.tl_current_route}
          role="Teamleder"
          firstOpenedAt={status.team_leader_first_opened_at}
          lastSeenAt={status.team_leader_last_seen_at}
          assignedAt={status.assigned_at}
          canReassign={canReassign}
          onReassign={() => onReassignClick?.("team_leader")}
          compact={compact}
        />
      )}
      {status.assigned_user_id && (
        <AssigneeRow
          name={[status.rep_first, status.rep_last].filter(Boolean).join(" ") || "Salgskonsulent"}
          avatar={status.rep_avatar}
          isOnlineNow={isOnline(status.rep_last_online)}
          lastOnlineAt={status.rep_last_online}
          currentRoute={status.rep_current_route}
          role="Rep"
          firstOpenedAt={status.rep_first_opened_at}
          lastSeenAt={status.rep_last_seen_at}
          assignedAt={status.assigned_at}
          canReassign={canReassign}
          onReassign={() => onReassignClick?.("rep")}
          compact={compact}
        />
      )}
    </Stack>
  );
}

function AssigneeRow({
  name, avatar, isOnlineNow, lastOnlineAt, currentRoute,
  role, firstOpenedAt, lastSeenAt, assignedAt,
  canReassign, onReassign, compact,
}: {
  name: string; avatar: string | null;
  isOnlineNow: boolean; lastOnlineAt: string | null; currentRoute: string | null;
  role: string;
  firstOpenedAt: string | null; lastSeenAt: string | null; assignedAt: string | null;
  canReassign?: boolean; onReassign?: () => void; compact?: boolean;
}) {
  const hasSeen = !!firstOpenedAt;
  const minutesSinceAssign = assignedAt
    ? Math.floor((Date.now() - new Date(assignedAt).getTime()) / 60000) : null;

  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={0.5}>
      <Box sx={{ position: "relative" }}>
        <Avatar src={avatar ?? undefined} sx={{ width: 24, height: 24, fontSize: 11 }}>
          {name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
        </Avatar>
        {isOnlineNow && (
          <FiberManualRecordIcon sx={{
            position: "absolute", bottom: -2, right: -2, fontSize: 8,
            color: "#9be15d", bgcolor: "background.paper", borderRadius: "50%",
          }} />
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: "#fff",
                                              whiteSpace: "nowrap", overflow: "hidden",
                                              textOverflow: "ellipsis", maxWidth: 140 }}>
          {name}
        </Typography>
        {!compact && (
          <Typography variant="caption" sx={{ display: "block",
                                                color: "rgba(255,255,255,0.5)", fontSize: 10 }}>
            {role}
          </Typography>
        )}
      </Box>

      {/* Online-status */}
      {isOnlineNow ? (
        <Tooltip title={currentRoute
          ? `Online nå · er på ${currentRoute}`
          : "Online akkurat nå"}>
          <Chip size="small" color="success"
                icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
                label="Online"
                sx={{ fontSize: 10, height: 20, fontWeight: 600 }} />
        </Tooltip>
      ) : lastOnlineAt ? (
        <Tooltip title={`Var online ${new Date(lastOnlineAt).toLocaleString("no-NO")}`}>
          <Chip size="small" variant="outlined"
                label={`Sist online ${formatTimeAgo(lastOnlineAt)}`}
                sx={{ fontSize: 10, height: 20, color: "rgba(255,255,255,0.6)" }} />
        </Tooltip>
      ) : (
        <Chip size="small" variant="outlined" label="Aldri online"
              sx={{ fontSize: 10, height: 20, color: "rgba(255,255,255,0.4)" }} />
      )}

      {/* Sett-status */}
      {hasSeen ? (
        <Tooltip title={`Først åpnet ${formatTimeAgo(firstOpenedAt)} · Sist sett ${formatTimeAgo(lastSeenAt)}`}>
          <Chip size="small" color="success" icon={<VisibilityIcon sx={{ fontSize: 12 }} />}
                label={`Sett ${formatTimeAgo(firstOpenedAt)}`}
                sx={{ fontSize: 10, height: 20 }} />
        </Tooltip>
      ) : (
        <Tooltip title={
          minutesSinceAssign !== null && minutesSinceAssign > 60
            ? `Tildelt ${minutesSinceAssign / 60 | 0}t siden men ikke åpnet ennå`
            : "Mottakeren har ikke åpnet leaden ennå"
        }>
          <Chip size="small"
                color={minutesSinceAssign !== null && minutesSinceAssign > 240 ? "error" : "warning"}
                icon={<AccessTimeIcon sx={{ fontSize: 12 }} />}
                label="Ikke sett"
                sx={{ fontSize: 10, height: 20 }} />
        </Tooltip>
      )}

      {canReassign && onReassign && (
        <Tooltip title="Re-tildel">
          <IconButton size="small" onClick={onReassign}>
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}
