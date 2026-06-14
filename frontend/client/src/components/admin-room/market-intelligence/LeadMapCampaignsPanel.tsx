/**
 * LeadMapCampaignsPanel.tsx
 *
 * Lead Map som kampanje-motor — UI-en for Fase 7.
 *
 * Viser:
 *   - Aktive kampanjer m/ pipeline-visualisering (6-stage bar)
 *   - Per-stage count + konverterings-rater
 *   - Måloppnåelse (X/100 leads · Y/5 vunnet)
 *   - Re-engagement-alert (declined > 90d)
 *   - Ny kampanje-dialog (kategori + region + by + mål)
 *
 * Bestemor-vennlig kopi — hvert tall får en kontekst som forklarer hva det
 * betyr og hva neste handling er.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  LinearProgress, Snackbar, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  AddCircleOutline as AddIcon,
  Autorenew as ReEngageIcon,
  Campaign as CampaignIcon,
  CheckCircle as CheckIcon,
  LocationCity as CityIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";

type LeadStatus = "unvisited" | "visited" | "return" | "not_present" | "declined"
  | "interested" | "meeting_booked" | "proposal_sent" | "won" | "lost" | "do_not_contact";

interface LeadMapCampaign {
  id: string;
  name: string;
  description?: string | null;
  filterCategory?: string | null;
  filterRegion?: string | null;
  filterCity?: string | null;
  filterLeadStatus: LeadStatus[];
  targetTotalLeads: number;
  targetWonLeads: number;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  reEngagementDays: number;
  startedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CampaignAggregate {
  campaign: LeadMapCampaign;
  totalMatchingLeads: number;
  pipelineProgress: {
    unvisited: number;
    contacted: number;
    interested: number;
    meetingBooked: number;
    proposalSent: number;
    won: number;
    lost: number;
    declined: number;
  };
  conversionRate: {
    contactToInterested: number;
    interestedToMeeting: number;
    meetingToWon: number;
    totalConversion: number;
  };
  goalProgress: {
    totalLeadsPct: number;
    wonLeadsPct: number;
  };
  reEngagementCandidates: number;
}

interface CategoryStat {
  category: string;
  totalLeads: number;
  wonLeads: number;
  conversionRate: number;
  avgEstimatedValue: number;
}

interface AreaStat {
  area: string;
  totalLeads: number;
  contactedLeads: number;
  interestedLeads: number;
  responseRate: number;
}

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("rr_bearer") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Pipeline-stage-visualisering ──────────────────────────────────────
function PipelineBar({ agg }: { agg: CampaignAggregate }) {
  const p = agg.pipelineProgress;
  const stages = [
    { label: "Ikke kontaktet", count: p.unvisited, color: "#94a3b8", explain: "Leads vi ikke har snakket med ennå" },
    { label: "Kontaktet", count: p.contacted, color: "#60a5fa", explain: "Vi har vært i kontakt minst én gang" },
    { label: "Interessert", count: p.interested, color: "#a78bfa", explain: "Har vist interesse — varme leads" },
    { label: "Møte booket", count: p.meetingBooked, color: "#fbbf24", explain: "Møte i kalenderen" },
    { label: "Tilbud sendt", count: p.proposalSent, color: "#f59e0b", explain: "Konkret tilbud er gitt" },
    { label: "Vunnet", count: p.won, color: "#34d399", explain: "Betalende kunde" },
  ];
  const total = stages.reduce((s, x) => s + x.count, 0) || 1;

  return (
    <Box>
      {/* Bar */}
      <Stack direction="row" sx={{ height: 28, borderRadius: 1, overflow: "hidden", mb: 1 }}>
        {stages.map((s) => {
          const pct = (s.count / total) * 100;
          if (pct < 1) return null;
          return (
            <Tooltip key={s.label} title={`${s.label}: ${s.count} (${s.explain})`}>
              <Box sx={{
                width: `${pct}%`,
                bgcolor: s.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#0a0a0f",
                fontSize: 10, fontWeight: 700,
                minWidth: 24,
              }}>
                {s.count}
              </Box>
            </Tooltip>
          );
        })}
      </Stack>

      {/* Labels */}
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
        {stages.map((s) => (
          <Chip
            key={s.label}
            size="small"
            label={`${s.count} ${s.label.toLowerCase()}`}
            sx={{
              bgcolor: `${s.color}22`,
              color: s.color,
              fontSize: 10,
              height: 20,
            }}
          />
        ))}
      </Stack>

      {/* Conversion-rater */}
      <Stack direction="row" spacing={2} sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Kontakt → interessert
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "#a78bfa" }}>
            {agg.conversionRate.contactToInterested}%
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Interessert → møte
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "#fbbf24" }}>
            {agg.conversionRate.interestedToMeeting}%
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Møte → vunnet
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: "#34d399" }}>
            {agg.conversionRate.meetingToWon}%
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Total konvertering
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {agg.conversionRate.totalConversion}%
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

// ── Main panel ────────────────────────────────────────────────────────
export default function LeadMapCampaignsPanel() {
  const [campaigns, setCampaigns] = useState<LeadMapCampaign[]>([]);
  const [aggregates, setAggregates] = useState<Map<string, CampaignAggregate>>(new Map());
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [areaStats, setAreaStats] = useState<AreaStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [reEngaging, setReEngaging] = useState(false);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    filterCategory: "",
    filterRegion: "Norge",
    filterCity: "",
    targetTotalLeads: 100,
    targetWonLeads: 5,
    reEngagementDays: 90,
  });
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [campResp, catResp, areaResp] = await Promise.all([
        fetch("/api/lead-map/campaigns", { credentials: "include", headers: authHeaders() }),
        fetch("/api/lead-map/analytics/category-conversion", { credentials: "include", headers: authHeaders() }),
        fetch("/api/lead-map/analytics/area-response", { credentials: "include", headers: authHeaders() }),
      ]);
      if (!campResp.ok) {
        const body = await campResp.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${campResp.status}`);
        return;
      }
      const campBody = await campResp.json();
      const list: LeadMapCampaign[] = campBody.campaigns ?? [];
      setCampaigns(list);

      // Hent aggregate for hver kampanje parallelt
      const aggMap = new Map<string, CampaignAggregate>();
      await Promise.all(list.map(async (c) => {
        const r = await fetch(`/api/lead-map/campaigns/${c.id}/aggregate`, {
          credentials: "include", headers: authHeaders(),
        });
        if (r.ok) {
          const data = await r.json();
          aggMap.set(c.id, data);
        }
      }));
      setAggregates(aggMap);

      if (catResp.ok) setCategoryStats((await catResp.json()).stats ?? []);
      if (areaResp.ok) setAreaStats((await areaResp.json()).stats ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setSnack("Navn er påkrevd");
      return;
    }
    setCreating(true);
    try {
      const r = await fetch("/api/lead-map/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          filterCategory: form.filterCategory.trim() || undefined,
          filterRegion: form.filterRegion.trim() || undefined,
          filterCity: form.filterCity.trim() || undefined,
          targetTotalLeads: form.targetTotalLeads,
          targetWonLeads: form.targetWonLeads,
          reEngagementDays: form.reEngagementDays,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        setSnack(`Feil: ${body.error ?? r.status}`);
      } else {
        setSnack(`Kampanje "${body.campaign.name}" opprettet`);
        setCreateOpen(false);
        setForm({
          name: "", description: "", filterCategory: "", filterRegion: "Norge",
          filterCity: "", targetTotalLeads: 100, targetWonLeads: 5, reEngagementDays: 90,
        });
        await fetchData();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleReEngage = async () => {
    setReEngaging(true);
    try {
      const r = await fetch("/api/lead-map/cron/re-engagement", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
      });
      const body = await r.json();
      if (!r.ok) {
        setSnack(`Re-engagement feilet: ${body.error ?? r.status}`);
      } else {
        setSnack(`Re-engagement kjørt: ${body.leadsReactivated} leads re-aktivert i ${body.campaignsProcessed} kampanjer`);
        await fetchData();
      }
    } finally {
      setReEngaging(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CampaignIcon sx={{ color: "#fbbf24" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Lead Map-kampanjer
          </Typography>
          <Chip
            size="small"
            label="Fase 7 av MI"
            sx={{ bgcolor: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", fontSize: 10, fontWeight: 700 }}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<RefreshIcon />} onClick={fetchData}>
            Oppdater
          </Button>
          <Button
            size="small"
            startIcon={reEngaging ? <CircularProgress size={14} /> : <ReEngageIcon />}
            onClick={handleReEngage}
            disabled={reEngaging}
            sx={{ color: "#a78bfa" }}
          >
            Kjør re-engagement
          </Button>
          <Button
            size="small" variant="contained" startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ bgcolor: "#fbbf24", color: "#0a0a0f", "&:hover": { bgcolor: "#f59e0b" } }}
          >
            Ny kampanje
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lag målbare kampanjer ut av Lead Map. Filtrer på kategori (f.eks.
        "restaurant"), område og status — så følger systemet pipeline-en
        automatisk: hvor mange er ikke kontaktet, hvor mange er interessert,
        hvor mange ble vunnet. Declined leads våkner opp igjen etter N dager.
      </Typography>

      {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={2}>
          {/* Kampanje-kort */}
          {campaigns.length === 0 ? (
            <Alert severity="info">
              Ingen kampanjer ennå. Klikk «Ny kampanje» for å lage din første.
            </Alert>
          ) : (
            campaigns.map((c) => {
              const agg = aggregates.get(c.id);
              return (
                <Card key={c.id}>
                  <CardContent>
                    {/* Header */}
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.5 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {c.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                          {c.filterCategory && (
                            <Chip size="small" label={`Kategori: ${c.filterCategory}`} sx={{ height: 18, fontSize: 10 }} />
                          )}
                          {c.filterRegion && (
                            <Chip size="small" label={`Region: ${c.filterRegion}`} sx={{ height: 18, fontSize: 10 }} />
                          )}
                          {c.filterCity && (
                            <Chip size="small" icon={<CityIcon sx={{ fontSize: 12 }} />} label={c.filterCity} sx={{ height: 18, fontSize: 10 }} />
                          )}
                        </Stack>
                      </Box>
                      <Chip
                        size="small"
                        label={c.status}
                        sx={{
                          bgcolor: c.status === "active" ? "rgba(52, 211, 153, 0.2)" : "rgba(148, 163, 184, 0.15)",
                          color: c.status === "active" ? "#34d399" : "#94a3b8",
                          fontWeight: 700,
                        }}
                      />
                    </Stack>

                    {agg ? (
                      <>
                        {/* Goal progress */}
                        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                Leads i pipeline ({agg.totalMatchingLeads}/{c.targetTotalLeads})
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "#a78bfa" }}>
                                {agg.goalProgress.totalLeadsPct}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(agg.goalProgress.totalLeadsPct, 100)}
                              sx={{
                                height: 6, borderRadius: 3,
                                "& .MuiLinearProgress-bar": { bgcolor: "#a78bfa" },
                              }}
                            />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                Vunnet ({agg.pipelineProgress.won}/{c.targetWonLeads})
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "#34d399" }}>
                                {agg.goalProgress.wonLeadsPct}%
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(agg.goalProgress.wonLeadsPct, 100)}
                              sx={{
                                height: 6, borderRadius: 3,
                                "& .MuiLinearProgress-bar": { bgcolor: "#34d399" },
                              }}
                            />
                          </Box>
                        </Stack>

                        {/* Pipeline */}
                        <PipelineBar agg={agg} />

                        {/* Re-engagement alert */}
                        {agg.reEngagementCandidates > 0 && (
                          <Alert
                            severity="warning"
                            sx={{ mt: 2 }}
                            icon={<ReEngageIcon />}
                            action={
                              <Button size="small" onClick={handleReEngage} disabled={reEngaging}>
                                Re-aktiver nå
                              </Button>
                            }
                          >
                            <strong>{agg.reEngagementCandidates}</strong> declined leads er klare for re-engagement
                            (har vært inaktive over {c.reEngagementDays} dager).
                          </Alert>
                        )}
                      </>
                    ) : (
                      <Alert severity="info">Henter pipeline-data…</Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Cross-campaign analytics */}
          {(categoryStats.length > 0 || areaStats.length > 0) && (
            <Stack direction="row" spacing={2}>
              {/* Top kategorier */}
              {categoryStats.length > 0 && (
                <Card sx={{ flex: 1 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <TrendingUpIcon sx={{ color: "#34d399", fontSize: 18 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Beste kategorier (konvertering)
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                      Hvilke bransjer som faktisk konverterer best — på tvers av alle dine leads.
                    </Typography>
                    <Stack spacing={0.75}>
                      {categoryStats.slice(0, 6).map((s) => (
                        <Stack key={s.category} direction="row" alignItems="center" spacing={1}>
                          <Typography variant="caption" sx={{ minWidth: 100 }}>
                            {s.category}
                          </Typography>
                          <Box sx={{ flex: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(s.conversionRate, 100)}
                              sx={{ height: 4, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: "#34d399" } }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ minWidth: 50, textAlign: "right", fontWeight: 700, color: "#34d399" }}>
                            {s.conversionRate}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: "right" }}>
                            {s.wonLeads}/{s.totalLeads}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* Top områder */}
              {areaStats.length > 0 && (
                <Card sx={{ flex: 1 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <CityIcon sx={{ color: "#60a5fa", fontSize: 18 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Beste områder (respons-rate)
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                      Hvor mange av de kontaktede leadsene som faktisk responderer.
                    </Typography>
                    <Stack spacing={0.75}>
                      {areaStats.slice(0, 6).map((s) => (
                        <Stack key={s.area} direction="row" alignItems="center" spacing={1}>
                          <Typography variant="caption" sx={{ minWidth: 80 }}>
                            {s.area}
                          </Typography>
                          <Box sx={{ flex: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(s.responseRate, 100)}
                              sx={{ height: 4, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: "#60a5fa" } }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ minWidth: 50, textAlign: "right", fontWeight: 700, color: "#60a5fa" }}>
                            {s.responseRate}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, textAlign: "right" }}>
                            {s.interestedLeads}/{s.contactedLeads}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </Stack>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ny Lead Map-kampanje</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
            Lag en målbar kampanje: filtrer kategori og område, sett et mål,
            og systemet sporer pipeline-en automatisk.
          </Alert>
          <Stack spacing={2}>
            <TextField
              label="Navn på kampanjen"
              fullWidth required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="F.eks. «Restauranter i Oslo Q2 2026»"
            />
            <TextField
              label="Beskrivelse (valgfritt)"
              fullWidth multiline rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Hva er målet med denne kampanjen?"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Kategori"
                fullWidth
                value={form.filterCategory}
                onChange={(e) => setForm({ ...form, filterCategory: e.target.value })}
                placeholder="F.eks. «restaurant»"
                helperText="Må matche lead_category i Lead Map"
              />
              <TextField
                label="Region"
                fullWidth
                value={form.filterRegion}
                onChange={(e) => setForm({ ...form, filterRegion: e.target.value })}
              />
            </Stack>
            <TextField
              label="By (valgfritt)"
              fullWidth
              value={form.filterCity}
              onChange={(e) => setForm({ ...form, filterCity: e.target.value })}
              placeholder="F.eks. «Oslo»"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Mål-antall leads"
                type="number" fullWidth
                value={form.targetTotalLeads}
                onChange={(e) => setForm({ ...form, targetTotalLeads: Number(e.target.value) })}
              />
              <TextField
                label="Mål-antall vunnet"
                type="number" fullWidth
                value={form.targetWonLeads}
                onChange={(e) => setForm({ ...form, targetWonLeads: Number(e.target.value) })}
              />
              <TextField
                label="Re-engagement (dager)"
                type="number" fullWidth
                value={form.reEngagementDays}
                onChange={(e) => setForm({ ...form, reEngagementDays: Number(e.target.value) })}
                helperText="Declined leads våkner opp etter N dager"
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={14} /> : <AddIcon />}
            sx={{ bgcolor: "#fbbf24", color: "#0a0a0f", "&:hover": { bgcolor: "#f59e0b" } }}
          >
            Opprett kampanje
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={6000}
        onClose={() => setSnack(null)}
        message={snack}
      />
    </Box>
  );
}
