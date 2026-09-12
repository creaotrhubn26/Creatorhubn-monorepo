/**
 * LeadInboxCard.tsx
 *
 * Card på markedssjef-/super-admin-dashboard som viser nye leads
 * med ferdig auto-research. Kildeleaden promoteres til en CRM-lead i et
 * eksplisitt kundeprosjekt før en separat tildelingsflyt kan åpnes.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Chip, Button, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress, Divider, TextField, MenuItem,
} from "@mui/material";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { AssignLeadDialog } from "./AssignLeadDialog";
import {
  buildAgencyLeadPromotionBody,
  parseAgencyLeadPromotion,
  type LeadgridProjectOption,
  type PromotedLeadReference,
} from "./leadInboxPromotionContract";

interface Lead {
  id: string;
  agency_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  org_number: string | null;
  source: string;
  created_at: string;
  consent_research_given: boolean;
  research_status: string | null;
  research_completed_at: string | null;
  claude_summary: string | null;
  claude_temperature: "hot" | "warm" | "cool" | "cold" | null;
  claude_talking_points: string[] | null;
  claude_next_action: string | null;
  brreg_data: any;
  website_scrape_data: any;
}

const TEMP_CONFIG: Record<string, { color: any; icon: React.ReactNode; label: string; bg: string }> = {
  hot:  { color: "error",   icon: <LocalFireDepartmentIcon />, label: "HOT lead", bg: "rgba(248,113,113,0.15)" },
  warm: { color: "warning", icon: <WhatshotIcon />, label: "WARM lead",        bg: "rgba(255,184,107,0.15)" },
  cool: { color: "info",    icon: <AcUnitIcon />,   label: "COOL lead",        bg: "rgba(86,156,214,0.15)" },
  cold: { color: "default", icon: <AcUnitIcon />,   label: "COLD lead",        bg: "rgba(155,155,155,0.10)" },
};

function safeExternalWebsite(value: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`,
    );
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function LeadInboxCard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<LeadgridProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : localStorage.getItem("rr_lead_map_active_project") ?? "",
  );
  const [selected, setSelected] = useState<Lead | null>(null);
  const [assigningLead, setAssigningLead] = useState<{
    source: Lead;
    promotion: PromotedLeadReference;
  } | null>(null);
  const [promotingLeadId, setPromotingLeadId] = useState<string | null>(null);
  const promotionInFlight = useRef(false);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const selectedProject = projects.find((project) => project.id === projectId) ?? null;

  const authHeaders = (): HeadersInit => {
    const token = typeof window === "undefined"
      ? null
      : localStorage.getItem("rr_bearer");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/superadmin/leads/inbox", {
        credentials: "include",
        headers: authHeaders(),
      });
      if (r.ok) setLeads((await r.json()).items ?? []);
      else setSnack({ kind: "err", msg: "Kunne ikke hente innboksen" });
    } catch {
      setSnack({ kind: "err", msg: "Kunne ikke hente innboksen" });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadProjects = async () => {
      setProjectsLoading(true);
      setProjectError(null);
      try {
        const organizationId = typeof window === "undefined"
          ? null
          : localStorage.getItem("rr_lead_map_active_org");
        const query = new URLSearchParams();
        if (organizationId) query.set("organization_id", organizationId);
        const response = await fetch(
          `/api/admin-room/lead-map/projects${query.size ? `?${query}` : ""}`,
          {
            credentials: "include",
            headers: authHeaders(),
            signal: controller.signal,
          },
        );
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.message ?? body?.error ?? "Kunne ikke hente prosjekter");
        }
        const nextProjects: LeadgridProjectOption[] = Array.isArray(body.projects)
          ? body.projects.filter((project: unknown): project is LeadgridProjectOption => {
              if (!project || typeof project !== "object") return false;
              const row = project as Record<string, unknown>;
              return typeof row.id === "string" &&
                typeof row.organizationId === "string" &&
                typeof row.name === "string";
            })
          : [];
        setProjects(nextProjects);
        setProjectId((current) => {
          if (nextProjects.some((project) => project.id === current)) return current;
          return nextProjects.length === 1 ? nextProjects[0].id : "";
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setProjects([]);
          setProjectError(
            error instanceof Error ? error.message : "Kunne ikke hente prosjekter",
          );
        }
      } finally {
        if (!controller.signal.aborted) setProjectsLoading(false);
      }
    };
    void loadProjects();
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (projectId) localStorage.setItem("rr_lead_map_active_project", projectId);
    else localStorage.removeItem("rr_lead_map_active_project");
  }, [projectId]);

  const accept = async (lead: Lead, openAssignment = false) => {
    if (promotionInFlight.current) return;
    if (!selectedProject) {
      setSnack({ kind: "err", msg: "Velg et Leadgrid-prosjekt først" });
      return;
    }
    const targetProjectId = selectedProject.id;
    promotionInFlight.current = true;
    setPromotingLeadId(lead.id);
    try {
      const response = await fetch(
        `/api/superadmin/leads/${encodeURIComponent(lead.id)}/accept-as-project`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(buildAgencyLeadPromotionBody(targetProjectId)),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message ?? body?.error ?? "Kunne ikke legge til leadet");
      }
      const promotion = parseAgencyLeadPromotion(body, {
        agencyLeadId: lead.id,
        projectId: targetProjectId,
      });
      setSelected(null);
      if (openAssignment) {
        setAssigningLead({ source: lead, promotion });
        setSnack({
          kind: "ok",
          msg: `${lead.agency_name} er lagret i ${selectedProject.name}. Velg team.`,
        });
      } else {
        setSnack({
          kind: "ok",
          msg: `${lead.agency_name} er lagt til i ${selectedProject.name}.`,
        });
        await load();
      }
    } catch (error) {
      setSnack({
        kind: "err",
        msg: error instanceof Error ? error.message : "Kunne ikke legge til leadet",
      });
    } finally {
      promotionInFlight.current = false;
      setPromotingLeadId(null);
    }
  };

  const reject = async (lead: Lead) => {
    const reason = prompt("Hvorfor avvise denne leaden?");
    if (!reason) return;
    const r = await fetch(`/api/superadmin/leads/${lead.id}/reject`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ reason }),
    });
    if (r.ok) {
      setSnack({ kind: "ok", msg: "Avvist" });
      setSelected(null);
      void load();
    } else {
      setSnack({ kind: "err", msg: "Kunne ikke avvise leadet" });
    }
  };

  const retry = async (lead: Lead) => {
    await fetch(`/api/superadmin/leads/${lead.id}/retry-research`, {
      method: "POST", credentials: "include",
      headers: authHeaders(),
    });
    setSnack({ kind: "ok", msg: "Research re-trigget — sjekk igjen om noen sekunder" });
  };

  return (
    <>
      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}
                   alignItems={{ md: "center" }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Målprosjekt i Leadgrid
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Leadet persisteres i dette prosjektet før tildeling kan åpnes.
                </Typography>
              </Box>
              <TextField
                select
                size="small"
                label="Aktivt kundeprosjekt"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={projectsLoading || projects.length === 0 || !!promotingLeadId}
                sx={{ minWidth: { xs: "100%", md: 280 } }}
              >
                <MenuItem value="" disabled>Velg prosjekt</MenuItem>
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
                ))}
              </TextField>
            </Stack>
            {projectsLoading && (
              <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                <CircularProgress size={14} />
                <Typography variant="caption">Henter tilgjengelige prosjekter…</Typography>
              </Stack>
            )}
            {!projectsLoading && (projectError || projects.length === 0) && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {projectError ?? "Ingen tilgjengelige Leadgrid-prosjekter. Opprett eller få tilgang til et prosjekt først."}
              </Alert>
            )}
            {!projectsLoading && projects.length > 1 && !selectedProject && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Velg hvilket kundeprosjekt leadet skal tilhøre. Vi velger aldri automatisk mellom flere prosjekter.
              </Alert>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <Card><CardContent sx={{ textAlign: "center", py: 4 }}><CircularProgress /></CardContent></Card>
        ) : leads.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary"
                          sx={{ textAlign: "center", py: 3 }}>
                Ingen nye leads med ferdig research akkurat nå.
              </Typography>
            </CardContent>
          </Card>
        ) : leads.map((lead) => {
          const t = TEMP_CONFIG[lead.claude_temperature ?? "cool"];
          const isResearching = lead.research_status === "running" || lead.research_status === "pending";
          const isPromoting = promotingLeadId === lead.id;
          return (
            <Card key={lead.id} sx={{
              bgcolor: t.bg,
              border: `1px solid ${lead.claude_temperature === "hot" ? "#f87171"
                                  : lead.claude_temperature === "warm" ? "#ffb86b"
                                  : "rgba(255,255,255,0.10)"}`,
            }}>
              <CardContent>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  {/* Hovedinfo */}
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" mb={1.5} flexWrap="wrap" rowGap={0.5}>
                      <Chip size="small" color={t.color} icon={t.icon as any}
                            label={t.label}
                            sx={{ fontWeight: 700 }} />
                      {lead.source === "book_demo" && (
                        <Chip size="small" label="Demo booket" color="primary" />
                      )}
                      {lead.consent_research_given && (
                        <Tooltip title="Lead har eksplisitt samtykket til automatisk Brreg-/web-research">
                          <Chip size="small" color="success"
                                icon={<VerifiedUserIcon sx={{ fontSize: 14 }} />}
                                label="GDPR-consent gitt"
                                sx={{ fontWeight: 600, fontSize: 10 }} />
                        </Tooltip>
                      )}
                      {isResearching && (
                        <Chip size="small" label="Research pågår…"
                              icon={<CircularProgress size={12} sx={{ color: "white" }} />} />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ fontSize: 11, letterSpacing: 1,
                                                       color: "rgba(255,255,255,0.5)",
                                                       textTransform: "uppercase" }}>
                      Du har fått en lead
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#fff" }}>
                      {lead.agency_name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
                      {lead.contact_name} · {lead.email}
                      {lead.phone && ` · ${lead.phone}`}
                    </Typography>
                    {lead.claude_summary && (
                      <Box sx={{ mt: 1.5, p: 1.5,
                                  bgcolor: "rgba(0,0,0,0.20)", borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)",
                                                              display: "block", mb: 0.5 }}>
                          Claude-sammendrag
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#fff", fontStyle: "italic" }}>
                          "{lead.claude_summary}"
                        </Typography>
                      </Box>
                    )}
                    {lead.claude_next_action && (
                      <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                          Anbefalt:
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#9be15d", fontWeight: 600 }}>
                          {lead.claude_next_action}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Handlinger */}
                  <Stack spacing={1} sx={{ minWidth: { md: 200 } }}>
                    <Button variant="contained" color="success"
                            startIcon={<CheckCircleIcon />}
                            onClick={() => void accept(lead, true)}
                            disabled={isResearching || !!promotingLeadId || !selectedProject}>
                      {isPromoting ? "Legger til…" : "Legg til + tildel"}
                    </Button>
                    <Button variant="outlined" size="small"
                            onClick={() => void accept(lead)}
                            disabled={isResearching || !!promotingLeadId || !selectedProject}>
                      Legg til uten tildeling
                    </Button>
                    <Button variant="outlined" size="small"
                            onClick={() => setSelected(lead)}>
                      Se detaljer
                    </Button>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Re-trigg research">
                        <IconButton size="small" onClick={() => retry(lead)}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Avvis lead">
                        <IconButton size="small" color="error" onClick={() => reject(lead)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      {selected && (
        <LeadDetailsDialog lead={selected} onClose={() => setSelected(null)}
                            onAccept={() => void accept(selected)}
                            onReject={() => reject(selected)}
                            canAccept={!!selectedProject}
                            accepting={promotingLeadId === selected.id} />
      )}

      {assigningLead && (
        <AssignLeadDialog open
          onClose={() => {
            setAssigningLead(null);
            void load();
          }}
          customerId={assigningLead.promotion.crmLeadId}
          projectId={assigningLead.promotion.projectId}
          lead={{
            agency_name: assigningLead.source.agency_name,
            contact_name: assigningLead.source.contact_name,
            claude_temperature: assigningLead.source.claude_temperature ?? undefined,
          }}
          mode="assign" level="both"
          onComplete={() => {
            setSnack({
              kind: "ok",
              msg: `${assigningLead.source.agency_name} er lagt til og tildelt.`,
            });
          }} />
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.kind === "ok" ? "success" : "error"}
               onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>
    </>
  );
}

function LeadDetailsDialog({ lead, onClose, onAccept, onReject, canAccept, accepting }: {
  lead: Lead;
  onClose: () => void;
  onAccept: () => void;
  onReject: () => void;
  canAccept: boolean;
  accepting: boolean;
}) {
  const website = safeExternalWebsite(lead.website);
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {lead.agency_name}
        <Typography variant="body2" color="text.secondary">
          {lead.contact_name} · {lead.email}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {lead.brreg_data && (
          <Box mb={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Brreg-data
            </Typography>
            <Box component="pre" sx={{
              fontSize: 11, fontFamily: "monospace",
              bgcolor: "#0a0512", color: "#9be15d", p: 2, borderRadius: 1,
              maxHeight: 200, overflow: "auto",
            }}>
              {JSON.stringify(lead.brreg_data, null, 2)}
            </Box>
          </Box>
        )}

        {lead.website_scrape_data && (
          <Box mb={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Hjemmeside-scrape
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="caption"><strong>Tittel:</strong> {lead.website_scrape_data.title}</Typography>
              <Typography variant="caption"><strong>Beskrivelse:</strong> {lead.website_scrape_data.description}</Typography>
              {lead.website_scrape_data.og_image && (
                <Box>
                  <Typography variant="caption"><strong>OG-bilde:</strong></Typography>
                  <Box component="img" src={lead.website_scrape_data.og_image}
                       sx={{ maxWidth: 200, mt: 0.5, border: "1px solid #ddd" }} />
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {lead.claude_talking_points && lead.claude_talking_points.length > 0 && (
          <Box mb={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Talking points for møtet
            </Typography>
            <Stack spacing={1}>
              {lead.claude_talking_points.map((tp, i) => (
                <Box key={i} sx={{ p: 1.5, bgcolor: "#f0f0ff", borderRadius: 1 }}>
                  <Typography variant="body2">{i + 1}. {tp}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {website && (
          <Box mb={2}>
            <Typography variant="caption" sx={{ display: "block" }}>
              <Box component="a" href={website} target="_blank" rel="noreferrer"
                   sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                Åpne hjemmesiden <OpenInNewIcon sx={{ fontSize: 14 }} />
              </Box>
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onReject}>Avvis</Button>
        <Button onClick={onClose}>Lukk</Button>
        <Button variant="contained" color="success" onClick={onAccept}
                disabled={!canAccept || accepting}
                startIcon={<CheckCircleIcon />}>
          {accepting ? "Legger til…" : "Legg til i Leadgrid"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
