/**
 * leadgrid-markedsforing.tsx — /leadgrid/markedsforing
 *
 * Leadgrid «Markedssjef-modus»: The Role Room-agentens markedsplan-motor
 * (bootstrap → strategi → pilarer → 30 poster) i Leadgrid-skall, for
 * markedssjefens EGEN organisasjon. Bygget som en vertikal oppå Leadgrid —
 * ingen eksisterende Leadgrid-side eller flyt endres, og siden er låst inntil
 * orgen har modulen `leadgrid:marketing` (module_feature_entitlements).
 *
 * Flyt:
 *   1. Bootstrap orgen  → POST /api/leadgrid/marketing/bootstrap
 *      (Brreg + nettsted + Places for organizations.website/org_number)
 *   2. Generer plan     → POST /api/role-room/marketing-plan/generate
 *      med projectId = `lg-<leadgrid-prosjekt>` (broen i backend slipper
 *      Leadgrid-sesjoner gjennom for lg-nøkler); aktiver → 30 poster
 *   3. Arbeidsflate     → MarketingPlanWorkspace (gjenbrukt uendret)
 *
 * Strategi-linse: beslutningspsykologi (Kahneman) er standard for lg-
 * prosjekter — pilarene merkes «Prinsipp: …» i begrunnelsen.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import LockIcon from "@mui/icons-material/Lock";
import PsychologyIcon from "@mui/icons-material/Psychology";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { useModuleFeature } from "@/hooks/useModuleFeature";
import roleRoomAgentService, {
  MarketingPlanReadinessError,
  type MarketingPlan,
} from "@/components/role-room/services/roleRoomAgentService";
import { MarketingPlanWorkspace } from "@/components/role-room/components/producer/MarketingPlanWorkspace";
import { RoleRoomAgentChatPanel } from "@/components/role-room/components/ai/RoleRoomAgentChatPanel";
import { useAuth } from "@/hooks/useAuth";
import ChatIcon from "@mui/icons-material/Chat";

const AGENT_SUGGESTED_PROMPTS: string[] = [
  "Hvilke tre poster bør jeg starte med på LinkedIn?",
  "Hva er utside-blikket på KPI-målene våre?",
  "Skriv en premortem for kampanjen",
  "Hvilket prinsipp passer best for pilaren om pris?",
];

interface ProjectOption {
  id: string;
  name: string;
}

interface MarketingStatus {
  module: string;
  project_id: string;
  project_key: string;
  project_name: string;
  role: string;
  organization: {
    id: string;
    name: string | null;
    website: string | null;
    org_number: string | null;
    industry: string | null;
    nace_code: string | null;
    nace_description: string | null;
    city: string | null;
    can_bootstrap: boolean;
  } | null;
  bootstrap: {
    available: boolean;
    research_id?: string;
    version_number?: number;
    generated_at?: string;
    readiness: { ready: boolean; missingFields: string[] } | null;
    result: unknown;
  };
  plan: { exists: false } | { exists: true; id: string; status: string; horizon_days: number };
}

type StatusError = { status: number; error: string; module?: string; required?: string };

// Samme mørke palett som resten av Leadgrid-flatene (#9be15d aksent, #a78bfa
// primær). Role Room-panelene har hardkodede mørke farger, så de trenger et
// mørkt MUI-tema rundt seg (presedens: MarketingCockpitTab.tsx).
const leadgridDarkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#a78bfa" },
    secondary: { main: "#9be15d" },
    background: { default: "#0a0e1a", paper: "rgba(15,23,42,0.72)" },
    text: { primary: "#e2e8f0", secondary: "rgba(203,213,225,0.68)" },
  },
});

const PRINCIPLES: Array<{ title: string; body: string }> = [
  { title: "Kognitiv letthet", body: "Én idé per post, konkrete ord, hook som leses på ett sekund." },
  { title: "Tapsaversjon", body: "Hva kunden taper i dag ved å la problemet ligge — ærlig, aldri oppdiktet." },
  { title: "Forankring", body: "Start med referansepunktet (et tall, en før-tilstand) kunden skal sammenligne mot." },
  { title: "Utside-blikk", body: "Base rates og navngitte resultater fremfor adjektiver. Ingen tall uten kilde." },
  { title: "Loven om små tall", body: "KPI-mål sier hvor mange observasjoner som trengs før strategien endres." },
];

async function readStatusError(response: Response): Promise<StatusError> {
  const body = (await response.json().catch(() => ({}))) as Partial<StatusError>;
  return {
    status: response.status,
    error: body.error ?? "ukjent_feil",
    ...(body.module ? { module: body.module } : {}),
    ...(body.required ? { required: body.required } : {}),
  };
}

export default function LeadgridMarkedsforingPage(): JSX.Element {
  const queryClient = useQueryClient();
  const moduleFeature = useModuleFeature("leadgrid", "marketing");
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ? String(authUser.id) : null;
  const [projectId, setProjectId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem("rr_lead_map_active_project"),
  );
  const [reloadSignal, setReloadSignal] = useState(0);
  const [flowError, setFlowError] = useState<string | null>(null);

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{
    projects: ProjectOption[];
  }>({
    queryKey: ["leadgrid-projects-for-marketing"],
    queryFn: () => apiRequest("/api/admin-room/lead-map/projects"),
  });
  const projects = useMemo(() => projectsData?.projects ?? [], [projectsData]);

  useEffect(() => {
    if (!projectsData) return;
    const nextProjectId = projects.some((project) => project.id === projectId)
      ? projectId
      : projects[0]?.id ?? null;
    if (nextProjectId !== projectId) setProjectId(nextProjectId);
    if (typeof window !== "undefined") {
      if (nextProjectId) localStorage.setItem("rr_lead_map_active_project", nextProjectId);
      else localStorage.removeItem("rr_lead_map_active_project");
    }
  }, [projectId, projects, projectsData]);

  const statusQueryKey = useMemo(() => ["leadgrid-marketing-status", projectId], [projectId]);
  const statusQuery = useQuery<MarketingStatus, StatusError>({
    queryKey: statusQueryKey,
    queryFn: async () => {
      const response = await apiFetch(
        `/api/leadgrid/marketing/status?projectId=${encodeURIComponent(projectId ?? "")}`,
      );
      if (!response.ok) throw await readStatusError(response);
      return (await response.json()) as MarketingStatus;
    },
    enabled: Boolean(projectId) && moduleFeature.enabled,
    retry: false,
  });

  const refreshStatus = async () => {
    await queryClient.invalidateQueries({ queryKey: statusQueryKey });
    setReloadSignal((n) => n + 1);
  };

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/leadgrid/marketing/bootstrap", {
        method: "POST",
        body: { projectId },
      });
      if (!response.ok) {
        const err = await readStatusError(response);
        throw new Error(
          err.error === "org_profile_incomplete"
            ? "Organisasjonen mangler nettsted og organisasjonsnummer. Legg inn ett av dem under organisasjonsinnstillinger først."
            : `Bootstrap feilet (${err.error}).`,
        );
      }
      return response.json();
    },
    onSuccess: () => {
      setFlowError(null);
      void refreshStatus();
    },
    onError: (err: Error) => setFlowError(err.message),
  });

  const generateMutation = useMutation({
    mutationFn: async (): Promise<MarketingPlan> => {
      const status = statusQuery.data;
      if (!status?.bootstrap.available || !status.bootstrap.result) {
        throw new Error("Kjør bootstrap først.");
      }
      const plan = await roleRoomAgentService.generateMarketingPlan({
        projectId: status.project_key,
        bootstrap: status.bootstrap.result,
        horizonDays: 30,
      });
      // Aktivering låser planen og starter generering av 30 poster i
      // bakgrunnen (samme flyt som Role Room).
      const activated = await roleRoomAgentService.activateMarketingPlan(plan.id, status.project_key);
      return activated ?? plan;
    },
    onSuccess: () => {
      setFlowError(null);
      void refreshStatus();
    },
    onError: (err: unknown) => {
      if (err instanceof MarketingPlanReadinessError) {
        const missing = err.readiness?.missingFields ?? [];
        setFlowError(
          `Bootstrapen mangler felter for en meningsfull plan: ${missing.join(", ") || "ukjent"}. Kjør bootstrap på nytt etter at organisasjonsprofilen er fylt ut.`,
        );
        return;
      }
      setFlowError(err instanceof Error ? err.message : "Kunne ikke generere markedsplan.");
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const status = statusQuery.data;
      if (!status?.plan.exists) throw new Error("Ingen plan å aktivere.");
      return roleRoomAgentService.activateMarketingPlan(status.plan.id, status.project_key);
    },
    onSuccess: () => {
      setFlowError(null);
      void refreshStatus();
    },
    onError: (err: Error) => setFlowError(err.message),
  });

  const status = statusQuery.data;
  const statusError = statusQuery.error;
  const moduleLocked =
    (!moduleFeature.isLoading && !moduleFeature.enabled)
    || statusError?.error === "module_locked";
  const busy = bootstrapMutation.isPending || generateMutation.isPending || activateMutation.isPending;

  return (
    <ThemeProvider theme={leadgridDarkTheme}>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
        <Container maxWidth={false} sx={{ py: 4 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            spacing={2}
            sx={{ mb: 3 }}
          >
            <Box>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CampaignIcon sx={{ color: "#9be15d", fontSize: 32 }} />
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  Markedsføring
                </Typography>
                <Chip
                  size="small"
                  icon={<PsychologyIcon sx={{ fontSize: 14 }} />}
                  label="Markedssjef-modus"
                  sx={{ bgcolor: "rgba(167,139,250,0.18)", color: "#c4b5fd", fontWeight: 600 }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Strategi, innholdspilarer og 30 dagers kanalplan for din egen organisasjon —
                LinkedIn og andre kanaler, formet av beslutningspsykologi.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 260 } }}>
              <InputLabel id="lg-marketing-project-label">Kundeprosjekt</InputLabel>
              <Select
                labelId="lg-marketing-project-label"
                label="Kundeprosjekt"
                value={projectId ?? ""}
                disabled={projectsLoading}
                onChange={(event) => setProjectId(String(event.target.value) || null)}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {moduleFeature.isLoading || projectsLoading ? (
            <Box sx={{ p: 6, textAlign: "center" }}>
              <CircularProgress />
            </Box>
          ) : moduleLocked ? (
            <LockedModuleCard />
          ) : !projectId ? (
            <Alert severity="info">Velg et Leadgrid-kundeprosjekt for å komme i gang.</Alert>
          ) : statusQuery.isLoading ? (
            <Box sx={{ p: 6, textAlign: "center" }}>
              <CircularProgress />
            </Box>
          ) : statusError ? (
            <Alert severity="error">
              {statusError.error === "mangler_tillatelse"
                ? `Du mangler tillatelsen ${statusError.required ?? "marketing.content.brief"} i denne organisasjonen. Be en administrator gi deg rollen markedssjef.`
                : statusError.error === "ikke_medlem_av_org"
                  ? "Du er ikke medlem av organisasjonen som eier dette prosjektet."
                  : `Kunne ikke hente status (${statusError.error}).`}
            </Alert>
          ) : status ? (
            <Stack spacing={3}>
              {flowError && (
                <Alert severity="error" onClose={() => setFlowError(null)}>
                  {flowError}
                </Alert>
              )}

              <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
                {/* Steg 1 — organisasjonsprofil + bootstrap */}
                <Card sx={{ flex: 1, border: "1px solid rgba(155,225,93,0.20)" }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <TravelExploreIcon sx={{ color: "#9be15d" }} />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        1. Kartlegg organisasjonen
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Agenten leser Brønnøysundregistrene, nettstedet og Google Places for{" "}
                      <strong>{status.organization?.name ?? "organisasjonen"}</strong> og bygger
                      selskapsprofil, konkurrentbilde og anbefalt kanaloppsett fra bransje (NACE) og geografi.
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                      <Chip size="small" label={status.organization?.website ?? "Nettsted mangler"} variant="outlined" />
                      <Chip size="small" label={status.organization?.org_number ? `Org.nr. ${status.organization.org_number}` : "Org.nr. mangler"} variant="outlined" />
                      {status.organization?.nace_code && (
                        <Chip size="small" label={`NACE ${status.organization.nace_code}`} variant="outlined" />
                      )}
                      {status.bootstrap.available && (
                        <Chip
                          size="small"
                          color="secondary"
                          label={`Kartlagt v${status.bootstrap.version_number ?? 1} · ${status.bootstrap.generated_at ? new Date(status.bootstrap.generated_at).toLocaleDateString("nb-NO") : ""}`}
                        />
                      )}
                    </Stack>
                    {status.bootstrap.readiness && !status.bootstrap.readiness.ready && (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        Kartleggingen mangler: {status.bootstrap.readiness.missingFields.join(", ")}.
                        Fyll ut organisasjonsprofilen og kjør på nytt.
                      </Alert>
                    )}
                    <Button
                      variant={status.bootstrap.available ? "outlined" : "contained"}
                      color="secondary"
                      disabled={busy || !status.organization?.can_bootstrap}
                      onClick={() => bootstrapMutation.mutate()}
                      startIcon={bootstrapMutation.isPending ? <CircularProgress size={16} /> : <TravelExploreIcon />}
                    >
                      {status.bootstrap.available ? "Kartlegg på nytt" : "Kartlegg organisasjonen"}
                    </Button>
                    {!status.organization?.can_bootstrap && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Legg inn nettsted eller organisasjonsnummer på organisasjonen først.
                      </Typography>
                    )}
                  </CardContent>
                </Card>

                {/* Steg 2 — generer / aktiver plan */}
                <Card sx={{ flex: 1, border: "1px solid rgba(167,139,250,0.25)" }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      <RocketLaunchIcon sx={{ color: "#a78bfa" }} />
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        2. Markedsplan
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Kanalstrategi, tone, posisjonering, KPI-mål og 3–5 innholdspilarer — deretter
                      30 dagers poster klare for LinkedIn, Instagram eller TikTok.
                    </Typography>
                    {status.plan.exists ? (
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          color={status.plan.status === "active" ? "secondary" : "default"}
                          label={status.plan.status === "active" ? "Aktiv plan" : `Plan: ${status.plan.status}`}
                        />
                        <Chip size="small" variant="outlined" label={`${status.plan.horizon_days} dager`} />
                        {status.plan.status === "draft" && (
                          <Button
                            size="small"
                            variant="contained"
                            disabled={busy}
                            onClick={() => activateMutation.mutate()}
                          >
                            Aktiver og generer poster
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={busy || !status.bootstrap.readiness?.ready}
                          onClick={() => generateMutation.mutate()}
                        >
                          Generer ny plan
                        </Button>
                      </Stack>
                    ) : (
                      <Button
                        variant="contained"
                        disabled={busy || !status.bootstrap.readiness?.ready}
                        onClick={() => generateMutation.mutate()}
                        startIcon={generateMutation.isPending ? <CircularProgress size={16} /> : <RocketLaunchIcon />}
                      >
                        Generer markedsplan
                      </Button>
                    )}
                    {generateMutation.isPending && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Bygger strategi og pilarer (30–60 sekunder) …
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Stack>

              {/* Beslutningspsykologi-linsen */}
              <Card sx={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <PsychologyIcon sx={{ color: "#c4b5fd" }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Strategi-linse: beslutningspsykologi
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Planen formes etter hvordan kunder faktisk tar beslutninger (Kahneman, <em>Tenke, fort og
                    langsomt</em>). Hver pilar oppgir prinsippet den bruker. Ingen falsk knapphet, ingen
                    oppdiktede tall.
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {PRINCIPLES.map((p) => (
                      <Chip
                        key={p.title}
                        size="small"
                        variant="outlined"
                        label={p.title}
                        title={p.body}
                        sx={{ borderColor: "rgba(196,181,253,0.4)", color: "#e2e8f0" }}
                      />
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

              {/* Steg 3 — arbeidsflaten (gjenbrukt uendret fra Role Room) */}
              {status.plan.exists ? (
                <MarketingPlanWorkspace projectId={status.project_key} reloadSignal={reloadSignal} />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
                  Arbeidsflaten med pilarer, kalender og poster vises her når planen er generert.
                </Typography>
              )}

              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

              {/* Steg 4 — markedssjef-agenten (Role Room-chatten i markedssjef-modus).
                  Samtykke-gaten ligger inne i panelet; lg-nøkkelen autoriseres av
                  leadgrid-agent-access.ts i backend. */}
              <Card sx={{ border: "1px solid rgba(196,181,253,0.25)" }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <ChatIcon sx={{ color: "#c4b5fd" }} />
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      4. Spør markedssjef-agenten
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Agenten kjenner organisasjonen, kartleggingen og den aktive planen. Den foreslår —
                    du bekrefter. Ingen tall uten kilde, ingen enkeltpersoner.
                  </Typography>
                  {currentUserId ? (
                    <Box sx={{ minHeight: 420, display: "flex", flexDirection: "column" }}>
                      <RoleRoomAgentChatPanel
                        projectId={status.project_key}
                        currentUserId={currentUserId}
                        entitlementExempt
                        suggestedPrompts={AGENT_SUGGESTED_PROMPTS}
                      />
                    </Box>
                  ) : (
                    <Alert severity="info">Logg inn på nytt for å bruke agenten.</Alert>
                  )}
                </CardContent>
              </Card>
            </Stack>
          ) : null}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

function LockedModuleCard(): JSX.Element {
  return (
    <Card sx={{ border: "1px solid rgba(255,255,255,0.10)", maxWidth: 720 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <LockIcon sx={{ color: "rgba(226,232,240,0.6)" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Markedssjef-modus er ikke aktivert for organisasjonen
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Dette er en tilleggsmodul oppå Leadgrid: AI-generert markedsstrategi, innholdspilarer og
          30 dagers kanalplan for din egen bedrift, bygget på samme motor som The Role Room bruker
          for produksjonsselskaper. Ingenting annet i Leadgrid endres når den skrus på.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Kontakt Leadgrid for å aktivere modulen (<code>leadgrid:marketing</code>) — tilgang gis
          til rollen markedssjef.
        </Typography>
      </CardContent>
    </Card>
  );
}
