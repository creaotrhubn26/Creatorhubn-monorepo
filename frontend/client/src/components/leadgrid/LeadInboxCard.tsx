/**
 * LeadInboxCard.tsx
 *
 * Card på markedssjef-/super-admin-dashboard som viser nye leads
 * med ferdig auto-research. "Godta som prosjekt"-knapp er den
 * sentrale CTA-en.
 */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Chip, Button, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Snackbar, Alert, CircularProgress, Divider,
} from "@mui/material";
import LocalFireDepartmentIcon from "@mui/icons-material/LocalFireDepartment";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import AcUnitIcon from "@mui/icons-material/AcUnit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

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

export function LeadInboxCard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [snack, setSnack] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/superadmin/leads/inbox", { credentials: "include" });
      if (r.ok) setLeads((await r.json()).items ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const accept = async (lead: Lead) => {
    const r = await fetch(`/api/superadmin/leads/${lead.id}/accept-as-project`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: "{}",
    });
    const j = await r.json();
    if (r.ok) {
      setSnack({ kind: "ok", msg: `${lead.agency_name} lagt til som prosjekt!` });
      setSelected(null);
      await load();
    } else {
      setSnack({ kind: "err", msg: j?.details ?? "Feilet" });
    }
  };

  const reject = async (lead: Lead) => {
    const reason = prompt("Hvorfor avvise denne leaden?");
    if (!reason) return;
    const r = await fetch(`/api/superadmin/leads/${lead.id}/reject`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (r.ok) { setSnack({ kind: "ok", msg: "Avvist" }); setSelected(null); load(); }
  };

  const retry = async (lead: Lead) => {
    await fetch(`/api/superadmin/leads/${lead.id}/retry-research`, {
      method: "POST", credentials: "include",
    });
    setSnack({ kind: "ok", msg: "Research re-trigget — sjekk igjen om noen sekunder" });
  };

  if (loading) {
    return <Card><CardContent sx={{ textAlign: "center", py: 4 }}><CircularProgress /></CardContent></Card>;
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary"
                      sx={{ textAlign: "center", py: 3 }}>
            Ingen nye leads med ferdig research akkurat nå.
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {leads.map((lead) => {
          const t = TEMP_CONFIG[lead.claude_temperature ?? "cool"];
          const isResearching = lead.research_status === "running" || lead.research_status === "pending";
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
                    <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
                      <Chip size="small" color={t.color} icon={t.icon as any}
                            label={t.label}
                            sx={{ fontWeight: 700 }} />
                      {lead.source === "book_demo" && (
                        <Chip size="small" label="Demo booket" color="primary" />
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
                            startIcon={<CheckCircleIcon />} onClick={() => accept(lead)}
                            disabled={isResearching}>
                      Godta som prosjekt
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
                            onAccept={() => accept(selected)}
                            onReject={() => reject(selected)} />
      )}

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert severity={snack?.kind === "ok" ? "success" : "error"}
               onClose={() => setSnack(null)}>{snack?.msg}</Alert>
      </Snackbar>
    </>
  );
}

function LeadDetailsDialog({ lead, onClose, onAccept, onReject }: {
  lead: Lead; onClose: () => void; onAccept: () => void; onReject: () => void;
}) {
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

        {lead.website && (
          <Box mb={2}>
            <Typography variant="caption" sx={{ display: "block" }}>
              <Box component="a" href={lead.website} target="_blank"
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
                startIcon={<CheckCircleIcon />}>
          Godta som prosjekt
        </Button>
      </DialogActions>
    </Dialog>
  );
}
