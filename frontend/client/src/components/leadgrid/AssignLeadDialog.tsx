/**
 * AssignLeadDialog.tsx
 *
 * 2-stegs tildelings-dialog for en allerede persistert Leadgrid CRM-lead.
 * Agency inbox-leads må promoteres først; denne komponenten skal aldri motta
 * en agency_leads.id som customerId.
 *
 * Sorterer kandidater på workload (færrest aktive først) — auto-suggest.
 * Viser online-status, profilbilde, og antall aktive leads per person.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack,
  Typography, Avatar, Chip, TextField, MenuItem, Tab, Tabs, Alert,
  CircularProgress, Tooltip, Divider, FormControl, FormLabel, RadioGroup,
  Radio, FormControlLabel, IconButton,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import SortIcon from "@mui/icons-material/Sort";
import PersonIcon from "@mui/icons-material/Person";
import { buildAssignableUsersPath } from "./leadInboxPromotionContract";

interface AssignableUser {
  user_id: string;
  role: string;
  full_name: string;
  email: string;
  profile_image_url: string | null;
  active_leads: number;
  team_leader_leads: number;
  is_online: boolean;
}

type Mode = "assign" | "reassign";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Persisted crm_customers.id. Never an agency_leads.id. */
  customerId: string;
  /** Required for a newly promoted lead; checked against the persisted lead. */
  projectId?: string;
  /** Lead-data (vises i header) */
  lead?: { agency_name?: string; contact_name?: string; claude_temperature?: string };
  mode: Mode;
  /** Hvilket nivå skal tildeles? team_leader, rep, eller begge (markedssjef-flow) */
  level: "team_leader" | "rep" | "both";
  onComplete?: () => Promise<void> | void;
}

function authHeaders(): HeadersInit {
  const token = typeof window === "undefined"
    ? null
    : localStorage.getItem("rr_bearer");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.json().catch(() => ({}));
  const message = typeof body?.message === "string"
    ? body.message
    : typeof body?.error === "string"
      ? body.error
      : fallback;
  return new Error(message);
}

export function AssignLeadDialog({
  open, onClose, customerId, projectId, lead, mode, level, onComplete,
}: Props) {
  const [step, setStep] = useState<"team_leader" | "rep">(
    level === "rep" ? "rep" : "team_leader"
  );
  const [teamLeaders, setTeamLeaders] = useState<AssignableUser[]>([]);
  const [reps, setReps] = useState<AssignableUser[]>([]);
  const [pickedTeamLeader, setPickedTeamLeader] = useState<string>("");
  const [pickedRep, setPickedRep] = useState<string>("");
  const [note, setNote] = useState("");
  const [sortBy, setSortBy] = useState<"workload" | "online" | "alphabet">("workload");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [teamLeaderAssigned, setTeamLeaderAssigned] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setStep(level === "rep" ? "rep" : "team_leader");
    setPickedTeamLeader("");
    setPickedRep("");
    setNote("");
    setLoadError(null);
    setSubmitError(null);
    setTeamLeaderAssigned(false);
    if (mode === "assign" && !projectId?.trim()) {
      setTeamLeaders([]);
      setReps([]);
      setLoading(false);
      setLoadError("Leadet mangler valgt Leadgrid-prosjekt. Tildeling er stoppet.");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const fetchUsers = async (role: "team_leader" | "rep") => {
      const url = projectId?.trim()
        ? buildAssignableUsersPath({
            role,
            crmLeadId: customerId,
            projectId,
          })
        : `/api/leadgrid/assignable-users?${new URLSearchParams({
            role,
            leadId: customerId,
          }).toString()}`;
      const response = await fetch(url, {
        credentials: "include",
        headers: authHeaders(),
        signal: controller.signal,
      });
      if (!response.ok) throw await responseError(response, "Kunne ikke hente teamet");
      return response.json();
    };
    Promise.all([
      fetchUsers("team_leader"),
      fetchUsers("rep"),
    ]).then(([tl, rep]) => {
      if (controller.signal.aborted) return;
      setTeamLeaders(tl.users ?? []);
      setReps(rep.users ?? []);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setTeamLeaders([]);
      setReps([]);
      setLoadError(error instanceof Error ? error.message : "Kunne ikke hente teamet");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [customerId, level, mode, open, projectId]);

  const sortedTeamLeaders = useMemo(() => sortUsers(teamLeaders, sortBy), [teamLeaders, sortBy]);
  const sortedReps = useMemo(() => sortUsers(reps, sortBy), [reps, sortBy]);

  const canNext = () => {
    if (step === "team_leader") return level === "team_leader" ? !!pickedTeamLeader : true;
    return !!pickedRep || level === "both";
  };

  const handleSubmit = async () => {
    if (loadError || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    let leaderPersisted = teamLeaderAssigned;
    try {
      if (
        (level === "team_leader" || level === "both") &&
        pickedTeamLeader &&
        !teamLeaderAssigned
      ) {
        const response = await fetch(
          `/api/leadgrid/customers/${encodeURIComponent(customerId)}/assign-team-leader`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ team_leader_user_id: pickedTeamLeader, note }),
          },
        );
        if (!response.ok) {
          throw await responseError(response, "Kunne ikke tildele teamleder");
        }
        leaderPersisted = true;
        setTeamLeaderAssigned(true);
      }
      if ((level === "rep" || level === "both") && pickedRep) {
        const response = await fetch(
          `/api/leadgrid/customers/${encodeURIComponent(customerId)}/assign-rep`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ rep_user_id: pickedRep, note }),
          },
        );
        if (!response.ok) {
          const cause = await responseError(response, "Kunne ikke tildele rep");
          throw new Error(
            leaderPersisted
              ? `Teamleder er lagret, men rep kunne ikke tildeles: ${cause.message}`
              : cause.message,
          );
        }
      }
      await onComplete?.();
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Tildeling feilet");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ flex: 1 }}>
            {mode === "assign" ? "Tildel nytt Leadgrid-lead" : "Re-tildel lead"}
            {lead?.agency_name && (
              <Typography variant="body2" color="text.secondary">
                {lead.agency_name}
                {lead.claude_temperature && (
                  <Chip size="small" sx={{ ml: 1, fontSize: 10 }}
                        label={lead.claude_temperature.toUpperCase()}
                        color={lead.claude_temperature === "hot" ? "error"
                              : lead.claude_temperature === "warm" ? "warning" : "default"} />
                )}
              </Typography>
            )}
          </Box>
          <Tooltip title="Sorter etter…">
            <IconButton size="small" onClick={() => {
              setSortBy((s) => s === "workload" ? "online" : s === "online" ? "alphabet" : "workload");
            }}>
              <SortIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" color="text.secondary">
            Sortert: {sortBy === "workload" ? "Minst arbeidsmengde"
                     : sortBy === "online" ? "Online først" : "Alfabetisk"}
          </Typography>
        </Stack>
      </DialogTitle>

      {level === "both" && (
        <Tabs value={step} onChange={(_, v) => setStep(v)}>
          <Tab label={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>1. Teamleder</span>
              {pickedTeamLeader && <CheckCircleIcon sx={{ fontSize: 14, color: "success.main" }} />}
            </Stack>
          } value="team_leader" />
          <Tab label={
            <Stack direction="row" spacing={1} alignItems="center">
              <span>2. Salgskonsulent / Promotør (valgfri)</span>
              {pickedRep && <CheckCircleIcon sx={{ fontSize: 14, color: "success.main" }} />}
            </Stack>
          } value="rep" disabled={!pickedTeamLeader} />
        </Tabs>
      )}

      <DialogContent dividers>
        {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        {loading ? (
          <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
        ) : step === "team_leader" ? (
          <UserList users={sortedTeamLeaders} picked={pickedTeamLeader}
                     onPick={setPickedTeamLeader} emptyText="Ingen teamledere i org-en ennå" />
        ) : (
          <>
            {level === "both" && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Valgfritt: la teamlederen selv tildele rep senere.
                Klikk "Hopp over" hvis du vil at de skal velge.
              </Alert>
            )}
            <UserList users={sortedReps} picked={pickedRep}
                       onPick={setPickedRep} emptyText="Ingen salgskonsulenter/promotører i org-en ennå" />
          </>
        )}

        <Divider sx={{ my: 2 }} />
        <TextField label="Notat til mottakeren (valgfri)"
                   value={note} onChange={(e) => setNote(e.target.value)}
                   fullWidth multiline rows={2} size="small"
                   placeholder="F.eks. 'Bør kontakte innen 24t — HOT lead'" />
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>Avbryt</Button>
        {level === "both" && step === "rep" && (
          <Button onClick={() => handleSubmit()}
                  disabled={submitting || loading || !!loadError || !pickedTeamLeader}>
            Hopp over rep (teamleder velger selv)
          </Button>
        )}
        {level === "both" && step === "team_leader" ? (
          <Button variant="contained" onClick={() => setStep("rep")} disabled={!pickedTeamLeader}>
            Neste: rep →
          </Button>
        ) : (
          <Button variant="contained" color="success" onClick={handleSubmit}
                  disabled={submitting || loading || !!loadError || !canNext()}
                  startIcon={<CheckCircleIcon />}>
            {submitting ? "Tildeler…" : "Tildel"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function sortUsers(users: AssignableUser[], by: string): AssignableUser[] {
  return [...users].sort((a, b) => {
    if (by === "workload") return a.active_leads - b.active_leads;
    if (by === "online") return Number(b.is_online) - Number(a.is_online);
    return a.full_name.localeCompare(b.full_name);
  });
}

function UserList({ users, picked, onPick, emptyText }: {
  users: AssignableUser[];
  picked: string;
  onPick: (id: string) => void;
  emptyText: string;
}) {
  if (users.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <PersonIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
        <Typography color="text.secondary">{emptyText}</Typography>
      </Box>
    );
  }
  return (
    <Stack spacing={1}>
      {users.map((u) => {
        const selected = picked === u.user_id;
        return (
          <Box key={u.user_id} onClick={() => onPick(u.user_id)}
               sx={{ display: "flex", alignItems: "center", gap: 2,
                      p: 1.5, borderRadius: 1, cursor: "pointer",
                      border: `1px solid ${selected ? "#a78bfa" : "transparent"}`,
                      bgcolor: selected ? "rgba(167,139,250,0.10)" : "transparent",
                      transition: "all 0.15s",
                      "&:hover": { bgcolor: selected ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)" } }}>
            <Box sx={{ position: "relative" }}>
              <Avatar src={u.profile_image_url ?? undefined} sx={{ width: 40, height: 40 }}>
                {u.full_name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
              </Avatar>
              {u.is_online && (
                <FiberManualRecordIcon sx={{
                  position: "absolute", bottom: -2, right: -2,
                  fontSize: 12, color: "#9be15d",
                  bgcolor: "background.paper", borderRadius: "50%",
                }} />
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {u.full_name || u.email}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={u.role} sx={{ fontSize: 10, height: 18 }} />
                <Typography variant="caption" color="text.secondary">
                  {u.active_leads} aktive lead{u.active_leads === 1 ? "" : "s"}
                  {u.team_leader_leads > 0 && ` · ${u.team_leader_leads} som teamleder`}
                </Typography>
              </Stack>
            </Box>
            {selected && (
              <CheckCircleIcon sx={{ color: "#a78bfa", fontSize: 24 }} />
            )}
          </Box>
        );
      })}
    </Stack>
  );
}
