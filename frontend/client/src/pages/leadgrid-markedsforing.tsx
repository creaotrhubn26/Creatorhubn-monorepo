/**
 * leadgrid-markedsforing.tsx — /leadgrid/markedsforing
 *
 * Leadgrid «Markedssjef-modus»: The Role Room-agentens markedsplan-motor
 * (kartlegging → strategi → pilarer → 30 poster) i Leadgrid-skall, for
 * markedssjefens EGEN organisasjon. Bygget som en vertikal oppå Leadgrid —
 * ingen eksisterende Leadgrid-side eller flyt endres, og siden er låst inntil
 * orgen har modulen `leadgrid:marketing` (module_feature_entitlements).
 *
 * UX-kontrakt (brukersentrert):
 *   - Siden er en tilstandsmaskin (marketingFlowState.ts). Hver tilstand har
 *     ÉN primærhandling; alt annet ligger i en overflow-meny.
 *   - Oppsett = vertikal stepper Kartlegg → Plan → Poster. Bare aktivt steg
 *     er utfoldet; fullførte steg viser én oppsummeringslinje.
 *   - Steady-state (aktiv plan med poster) = arbeidsflaten øverst, chatten
 *     kollapsbar, oppsettet som én kompakt linje.
 *   - Ærlig fremdrift: kartlegging via SSE (ekte steg), plan/poster via
 *     MarketingGenerationProgress, poster polles til de er ferdige.
 *   - Forebygg feil: org uten nettsted/org.nr. rettes inline (når rollen kan
 *     lagre), manglende felter fylles i et tekstfelt, «Ny plan» bekreftes.
 *
 * Måling: tid til første aktive plan (se docs/leadgrid/markedssjef-modus.md).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Collapse,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Popover,
  Snackbar,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import ChatIcon from "@mui/icons-material/Chat";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LockIcon from "@mui/icons-material/Lock";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PsychologyIcon from "@mui/icons-material/Psychology";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import { apiFetch } from "@/lib/queryClient";
import { useModuleFeature } from "@/hooks/useModuleFeature";
import { useAuth } from "@/hooks/useAuth";
import roleRoomAgentService, {
  MarketingPlanReadinessError,
  type MarketingPlan,
} from "@/components/role-room/services/roleRoomAgentService";
import { MarketingPlanWorkspace } from "@/components/role-room/components/producer/MarketingPlanWorkspace";
import { MarketingGenerationProgress } from "@/components/role-room/components/producer/MarketingGenerationProgress";
import ResearchProgressLive from "@/components/role-room/components/producer/ResearchProgressLive";
import { useResearchProgress } from "@/components/role-room/hooks/useResearchProgress";
import { RoleRoomAgentChatPanel } from "@/components/role-room/components/ai/RoleRoomAgentChatPanel";
import type { AiConsentGateCopy } from "@/components/role-room/components/ai/AiConsentGate";
import {
  LeadgridProjectSelect,
  readStoredProjectId,
  useLeadgridProjects,
} from "@/components/leadgrid/LeadgridProjectSelect";
import { LinkedInPublishCard } from "@/components/leadgrid/LinkedInPublishCard";
import { MarketingResultsLine } from "@/components/leadgrid/MarketingResultsLine";
import {
  deriveMarketingFlowState,
  describeMissingField,
  summarizeStep,
  type MarketingFlowAction,
  type MarketingFlowStatus,
  type MarketingFlowStep,
  type MarketingFlowView,
} from "@/components/leadgrid/marketingFlowState";

// ─────────────────────────────────────────────────────────────────────────────
// Kopi og konstanter
// ─────────────────────────────────────────────────────────────────────────────

const AGENT_SUGGESTED_PROMPTS: string[] = [
  "Hvilke tre poster bør jeg starte med på LinkedIn?",
  "Hva er utside-blikket på KPI-målene våre?",
  "Skriv en premortem for kampanjen",
  "Hvilket prinsipp passer best for pilaren om pris?",
];

/** Samtykke-kopi for markedssjefen — Role Rooms casting-vokabular passer ikke. */
const MARKETING_CONSENT_COPY: AiConsentGateCopy = {
  prompt:
    "Agenten er slått av til du samtykker til at organisasjonsprofil, kartlegging og plan kan sendes til AI-databehandleren.",
  promptCta: "Gi samtykke",
  title: "AI-samtykke for markedsføring",
  body:
    "Agenten bruker organisasjonsprofilen, kartleggingen og markedsplanen for å foreslå neste steg. Ingenting sendes før du samtykker, og du kan trekke samtykket tilbake når som helst.",
  scopeLabels: {
    brief_only: "Organisasjonsprofil",
    brief_and_reviews: "Organisasjonsprofil + kartlegging",
    full_context: "Organisasjonsprofil + kartlegging + markedsplan",
  },
  warning:
    "Kontaktpersoner (navn, e-post, telefon) pseudonymiseres automatisk før noe sendes. Originaldata forlater aldri vår server uten maskering.",
  defaultScope: "full_context",
};

const AGENT_EMPTY_STATE_TEXT =
  "Spør om planen, pilarene eller neste post. Agenten foreslår — du bekrefter. Ingen tall uten kilde.";

const ACTION_LABELS: Record<MarketingFlowAction, string> = {
  edit_org_profile: "Lagre og kartlegg",
  map: "Kartlegg organisasjonen",
  remap: "Kartlegg på nytt",
  retry_map: "Prøv kartleggingen igjen",
  generate_plan: "Generer markedsplan",
  retry_plan: "Prøv igjen",
  activate_plan: "Aktiver og generer 30 poster",
  new_plan: "Ny plan",
  open_chat: "Spør agenten",
};

const STEPS: Array<{ key: MarketingFlowStep; label: string; unlockHint: string }> = [
  { key: "map", label: "Kartlegg organisasjonen", unlockHint: "" },
  { key: "plan", label: "Markedsplan", unlockHint: "Låses opp når kartleggingen er klar" },
  { key: "posts", label: "Poster", unlockHint: "Låses opp når planen er generert" },
];

const PRINCIPLES: Array<{ title: string; body: string }> = [
  { title: "Kognitiv letthet", body: "Én idé per post, konkrete ord, hook som leses på ett sekund." },
  { title: "Tapsaversjon", body: "Hva kunden taper i dag ved å la problemet ligge — ærlig, aldri oppdiktet." },
  { title: "Forankring", body: "Start med referansepunktet (et tall, en før-tilstand) kunden skal sammenligne mot." },
  { title: "Utside-blikk", body: "Base rates og navngitte resultater fremfor adjektiver. Ingen tall uten kilde." },
  { title: "Loven om små tall", body: "KPI-mål sier hvor mange observasjoner som trengs før strategien endres." },
];

const POSTS_EXPECTED_DEFAULT = 30;
const POSTS_POLL_MS = 4000;

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

// ─────────────────────────────────────────────────────────────────────────────
// Typer for backend-status
// ─────────────────────────────────────────────────────────────────────────────

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
    can_edit_profile: boolean;
    org_number_editable: boolean;
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

type PostsProgress = { generated: number; expected: number; complete: boolean };

type Toast = { kind: "ok" | "error"; msg: string; href?: string | null };

async function readStatusError(response: Response): Promise<StatusError> {
  const body = (await response.json().catch(() => ({}))) as Partial<StatusError>;
  return {
    status: response.status,
    error: body.error ?? "ukjent_feil",
    ...(body.module ? { module: body.module } : {}),
    ...(body.required ? { required: body.required } : {}),
  };
}

function toFlowStatus(status: MarketingStatus): MarketingFlowStatus {
  const org = status.organization;
  return {
    organization: org
      ? {
          name: org.name,
          website: org.website,
          orgNumber: org.org_number,
          naceCode: org.nace_code,
          naceDescription: org.nace_description,
          industry: org.industry,
          canBootstrap: org.can_bootstrap,
          canEditProfile: org.can_edit_profile,
          orgNumberEditable: org.org_number_editable,
        }
      : null,
    bootstrap: {
      available: status.bootstrap.available,
      versionNumber: status.bootstrap.version_number ?? null,
      generatedAt: status.bootstrap.generated_at ?? null,
      // Uten readiness-objekt (ingen kartlegging) er den ikke klar.
      ready: Boolean(status.bootstrap.readiness?.ready),
      missingFields: status.bootstrap.readiness?.missingFields ?? [],
    },
    plan: status.plan.exists
      ? { exists: true, id: status.plan.id, status: status.plan.status, horizonDays: status.plan.horizon_days }
      : { exists: false },
  };
}

/** Oversetter SSE-handshake-/streamfeil fra kartleggingen til én setning. */
function describeMapError(raw: string | null): string {
  const text = raw ?? "";
  if (text.includes("org_profile_incomplete")) {
    return "Organisasjonen mangler nettsted og organisasjonsnummer. Legg inn ett av dem, så kartlegger vi.";
  }
  if (text.includes("rate_limited") || text.includes(" 429 ")) {
    return "Kartleggingen kan kjøres tre ganger per ti minutter. Vent litt og prøv igjen.";
  }
  if (text.includes(" 403 ")) {
    return "Du har ikke tilgang til å kartlegge dette prosjektet.";
  }
  return "Kartleggingen stoppet før den ble ferdig. Ingenting er lagret — prøv igjen.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Siden
// ─────────────────────────────────────────────────────────────────────────────

export default function LeadgridMarkedsforingPage(): JSX.Element {
  const queryClient = useQueryClient();
  const moduleFeature = useModuleFeature("leadgrid", "marketing");
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ? String(authUser.id) : null;

  const { projects, isLoading: projectsLoading, isError: projectsError, loaded: projectsLoaded } =
    useLeadgridProjects();
  const [projectId, setProjectId] = useState<string | null>(readStoredProjectId);

  const [reloadSignal, setReloadSignal] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [extraContext, setExtraContext] = useState("");
  const [confirmNewPlan, setConfirmNewPlan] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [postsProgress, setPostsProgress] = useState<PostsProgress | null>(null);
  const lastProgressRef = useRef<PostsProgress | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  // ── Status ────────────────────────────────────────────────────────────
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
  const status = statusQuery.data ?? null;

  // Holder «kjører»-tilstanden til statusen er hentet på nytt etter en
  // mutasjon, så primærknappen ikke blinker tilbake (dobbeltklikk-vern).
  const [pendingRefresh, setPendingRefresh] = useState<null | "plan" | "activate">(null);
  const refreshStatus = useCallback(
    async (after: null | "plan" | "activate" = null) => {
      if (after) setPendingRefresh(after);
      try {
        await queryClient.invalidateQueries({ queryKey: statusQueryKey });
      } finally {
        if (after) setPendingRefresh(null);
      }
      setReloadSignal((n) => n + 1);
    },
    [queryClient, statusQueryKey],
  );

  // ── Steg 1: kartlegging (SSE med ekte steg) ───────────────────────────
  const mapping = useResearchProgress({
    endpoint: "/api/leadgrid/marketing/bootstrap/stream",
    persistSnapshot: false,
  });
  const { reset: resetMapping, start: startMappingStream, status: mappingStatus } = mapping;

  // Etter `done`: hold «kartlegger»-tilstanden til statusen er hentet på nytt,
  // ellers blinker siden innom en foreldet tilstand.
  useEffect(() => {
    if (mappingStatus !== "done") return;
    let cancelled = false;
    (async () => {
      await queryClient.invalidateQueries({ queryKey: statusQueryKey });
      if (cancelled) return;
      setExtraContext("");
      setReloadSignal((n) => n + 1);
      resetMapping();
      setToast({ kind: "ok", msg: "Kartleggingen er ferdig." });
    })();
    return () => {
      cancelled = true;
    };
  }, [mappingStatus, queryClient, statusQueryKey, resetMapping]);

  const mappingError = mapping.error;
  useEffect(() => {
    if (mappingStatus === "error") setToast({ kind: "error", msg: describeMapError(mappingError) });
  }, [mappingStatus, mappingError]);

  // ── Steg 2: plan ──────────────────────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: async (): Promise<MarketingPlan> => {
      if (!status?.bootstrap.available || !status.bootstrap.result) {
        throw new Error("Kartlegg organisasjonen først.");
      }
      return roleRoomAgentService.generateMarketingPlan({
        projectId: status.project_key,
        bootstrap: status.bootstrap.result,
        horizonDays: 30,
      });
    },
    onSuccess: () => {
      setToast({ kind: "ok", msg: "Markedsplanen er klar som utkast. Se gjennom pilarene og aktiver." });
      void refreshStatus("plan");
    },
    onError: (err: unknown) => {
      if (err instanceof MarketingPlanReadinessError) {
        // Backend sier kartleggingen mangler felt — status-refetch flytter
        // brukeren tilbake til steg 1 med feltlisten.
        setToast({ kind: "error", msg: "Kartleggingen mangler felt for en meningsfull plan." });
        void refreshStatus();
        return;
      }
      setToast({
        kind: "error",
        msg: err instanceof Error && err.message ? err.message : "Kunne ikke generere markedsplan.",
      });
    },
  });
  const { reset: resetGenerate } = generateMutation;

  // ── Steg 3: aktivering + poster i bakgrunnen ──────────────────────────
  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!status?.plan.exists) throw new Error("Ingen plan å aktivere.");
      return roleRoomAgentService.activateMarketingPlan(status.plan.id, status.project_key);
    },
    onSuccess: () => {
      // Umiddelbar tilbakemelding: vis «0 av 30» før første poll-svar.
      const initial: PostsProgress = { generated: 0, expected: POSTS_EXPECTED_DEFAULT, complete: false };
      lastProgressRef.current = initial;
      setPostsProgress(initial);
      setToast({ kind: "ok", msg: "Planen er aktiv. Postene genereres i bakgrunnen." });
      void refreshStatus("activate");
    },
    onError: (err: Error) =>
      setToast({ kind: "error", msg: err.message || "Kunne ikke aktivere planen." }),
  });

  const activePlanId = status?.plan.exists && status.plan.status === "active" ? status.plan.id : null;

  useEffect(() => {
    if (!activePlanId) {
      lastProgressRef.current = null;
      setPostsProgress(null);
      return;
    }
    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      const next = await roleRoomAgentService.checkMarketingPlanPostsProgress(activePlanId);
      if (cancelled) return;
      if (!next) {
        // Ukjent fremdrift (f.eks. eldre plan uten jobb) — ikke blokker flaten.
        lastProgressRef.current = null;
        setPostsProgress(null);
        return;
      }
      const wasIncomplete = lastProgressRef.current ? !lastProgressRef.current.complete : false;
      lastProgressRef.current = next;
      setPostsProgress(next);
      if (next.complete) {
        if (wasIncomplete) {
          setReloadSignal((n) => n + 1);
          setToast({ kind: "ok", msg: `${next.generated} poster er klare.` });
        }
        return;
      }
      timer = window.setTimeout(() => void tick(), POSTS_POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [activePlanId]);

  // ── Tilstandsmaskin ───────────────────────────────────────────────────
  const view: MarketingFlowView = useMemo(
    () =>
      deriveMarketingFlowState({
        moduleLoading: moduleFeature.isLoading || projectsLoading,
        moduleEnabled: moduleFeature.enabled,
        projectId,
        statusLoading: statusQuery.isLoading,
        statusError: statusQuery.error ?? null,
        status: status ? toFlowStatus(status) : null,
        mapping: mappingStatus === "streaming" || mappingStatus === "done",
        mapFailed: mappingStatus === "error",
        planning: generateMutation.isPending || pendingRefresh === "plan",
        planFailed: generateMutation.isError,
        activating: activateMutation.isPending || pendingRefresh === "activate",
        postsProgress,
      }),
    [
      moduleFeature.isLoading,
      moduleFeature.enabled,
      projectsLoading,
      projectId,
      statusQuery.isLoading,
      statusQuery.error,
      status,
      mappingStatus,
      generateMutation.isPending,
      generateMutation.isError,
      activateMutation.isPending,
      pendingRefresh,
      postsProgress,
    ],
  );
  const flowStatus = useMemo(() => (status ? toFlowStatus(status) : null), [status]);

  const startMapping = useCallback(() => {
    if (!projectId) return;
    resetGenerate();
    const context = extraContext.trim();
    startMappingStream({ projectId, ...(context ? { extraContext: context } : {}) });
  }, [projectId, extraContext, resetGenerate, startMappingStream]);

  const openChat = useCallback(() => {
    setChatOpen(true);
    window.setTimeout(() => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  const runAction = useCallback(
    (action: MarketingFlowAction) => {
      switch (action) {
        case "map":
        case "remap":
        case "retry_map":
          startMapping();
          return;
        case "generate_plan":
        case "retry_plan":
          generateMutation.mutate();
          return;
        case "new_plan":
          setConfirmNewPlan(true);
          return;
        case "activate_plan":
          activateMutation.mutate();
          return;
        case "open_chat":
          openChat();
          return;
        case "edit_org_profile":
          // Håndteres av skjemaet i steg 1.
          return;
        default:
          return;
      }
    },
    [startMapping, generateMutation, activateMutation, openChat],
  );

  const busy =
    view.state.kind === "mapping"
    || view.state.kind === "planning"
    || activateMutation.isPending
    || pendingRefresh !== null;

  // Chatten er tilgjengelig så snart agenten har noe å stå på (kartlegging).
  const chatAvailable = Boolean(currentUserId && status?.bootstrap.available);

  return (
    <ThemeProvider theme={leadgridDarkTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          color: "text.primary",
          // Role Room-komponentene leser --role-cyan for aksent; Leadgrid-lilla her.
          "--role-cyan": "#a78bfa",
        }}
      >
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
                Strategi, innholdspilarer og 30 dagers kanalplan for din egen organisasjon.
              </Typography>
            </Box>
            <LeadgridProjectSelect
              value={projectId}
              onChange={setProjectId}
              projects={projects}
              loaded={projectsLoaded}
              disabled={busy}
            />
          </Stack>

          {projectsError ? (
            <Alert severity="error">Kunne ikke hente kundeprosjektene. Last siden på nytt.</Alert>
          ) : (
            <FlowBody
              view={view}
              status={status}
              flowStatus={flowStatus}
              mapping={mapping}
              extraContext={extraContext}
              onExtraContextChange={setExtraContext}
              onAction={runAction}
              onProfileSaved={() => {
                setToast({ kind: "ok", msg: "Profilen er lagret. Kartlegger …" });
                void queryClient.invalidateQueries({ queryKey: statusQueryKey });
                startMapping();
              }}
              onProfileError={(msg) => setToast({ kind: "error", msg })}
              reloadSignal={reloadSignal}
              chatAvailable={chatAvailable}
              chatOpen={chatOpen}
              onToggleChat={() => (chatOpen ? setChatOpen(false) : openChat())}
              chatRef={chatRef}
              currentUserId={currentUserId}
              projectKey={status?.project_key ?? null}
              onPublished={(permalink) => {
                setToast({ kind: "ok", msg: "Posten er publisert på LinkedIn.", href: permalink });
                setReloadSignal((n) => n + 1);
              }}
              onNotice={(kind, msg) => setToast({ kind, msg })}
            />
          )}
        </Container>

        <Dialog open={confirmNewPlan} onClose={() => setConfirmNewPlan(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Lage en ny markedsplan?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Den nye planen blir et utkast ved siden av dagens plan. Aktive poster slettes ikke, og
              agenten tar med resultatene fra forrige plan når den finnes. Tidligere utkast arkiveres.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setConfirmNewPlan(false)}>Avbryt</Button>
            <Button
              variant="contained"
              onClick={() => {
                setConfirmNewPlan(false);
                generateMutation.mutate();
              }}
            >
              Lag ny plan
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={toast?.kind === "error" ? 8000 : 4000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            severity={toast?.kind === "ok" ? "success" : "error"}
            variant="filled"
            onClose={() => setToast(null)}
            action={
              toast?.href ? (
                <Button color="inherit" size="small" href={toast.href} target="_blank" rel="noreferrer">
                  Åpne posten
                </Button>
              ) : undefined
            }
          >
            {toast?.msg}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kroppen: én rendering per tilstand
// ─────────────────────────────────────────────────────────────────────────────

interface FlowBodyProps {
  view: MarketingFlowView;
  status: MarketingStatus | null;
  flowStatus: MarketingFlowStatus | null;
  mapping: ReturnType<typeof useResearchProgress>;
  extraContext: string;
  onExtraContextChange: (value: string) => void;
  onAction: (action: MarketingFlowAction) => void;
  onProfileSaved: () => void;
  onProfileError: (msg: string) => void;
  reloadSignal: number;
  chatAvailable: boolean;
  chatOpen: boolean;
  onToggleChat: () => void;
  chatRef: React.MutableRefObject<HTMLDivElement | null>;
  currentUserId: string | null;
  projectKey: string | null;
  onPublished: (permalink: string | null) => void;
  onNotice: (kind: "ok" | "error", message: string) => void;
}

function FlowBody(props: FlowBodyProps): JSX.Element | null {
  const { view, status, flowStatus, reloadSignal, chatAvailable, chatOpen, onToggleChat, chatRef, currentUserId, projectKey, onPublished, onNotice } = props;
  const { state } = view;

  if (state.kind === "loading") {
    return (
      <Box sx={{ p: 6, textAlign: "center" }} aria-busy="true">
        <CircularProgress />
      </Box>
    );
  }
  if (state.kind === "locked") return <LockedModuleCard />;
  if (state.kind === "no_project") {
    return <Alert severity="info">Velg et kundeprosjekt øverst til høyre for å komme i gang.</Alert>;
  }
  if (state.kind === "access_denied") {
    return (
      <Alert severity="error">
        {state.reason === "mangler_tillatelse"
          ? `Du mangler tillatelsen ${state.required ?? "marketing.content.brief"} i denne organisasjonen. Be en administrator gi deg rollen markedssjef.`
          : state.reason === "ikke_medlem_av_org"
            ? "Du er ikke medlem av organisasjonen som eier dette prosjektet."
            : `Kunne ikke hente status (${state.error}).`}
      </Alert>
    );
  }
  if (!status || !flowStatus || !projectKey) return null;

  const chat = chatAvailable && currentUserId ? (
    <Card ref={chatRef} sx={{ border: "1px solid rgba(196,181,253,0.25)" }}>
      <CardContent sx={{ "&:last-child": { pb: chatOpen ? 2 : 1.5 } }}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <ChatIcon sx={{ color: "#c4b5fd" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Markedssjef-agenten
            </Typography>
          </Stack>
          <Button
            size="small"
            variant={chatOpen ? "text" : "contained"}
            onClick={onToggleChat}
            endIcon={chatOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            aria-expanded={chatOpen}
          >
            {chatOpen ? "Skjul" : ACTION_LABELS.open_chat}
          </Button>
        </Stack>
        <Collapse in={chatOpen} unmountOnExit>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            Kjenner organisasjonen, kartleggingen og planen. Den foreslår — du bekrefter.
          </Typography>
          <Box sx={{ minHeight: 420, display: "flex", flexDirection: "column" }}>
            <RoleRoomAgentChatPanel
              projectId={projectKey}
              currentUserId={currentUserId}
              entitlementExempt
              suggestedPrompts={AGENT_SUGGESTED_PROMPTS}
              consentCopy={MARKETING_CONSENT_COPY}
              emptyStateText={AGENT_EMPTY_STATE_TEXT}
            />
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  ) : null;

  // Publiseringskortet (fase 1b): vises så snart planen er aktiv — også mens
  // postene fortsatt genereres, så de første kan publiseres med en gang.
  const activePlanId = status.plan.exists && status.plan.status === "active" ? status.plan.id : null;
  const publishCard = activePlanId ? (
    <LinkedInPublishCard
      projectKey={projectKey}
      planId={activePlanId}
      reloadSignal={reloadSignal}
      onPublished={(_post, permalink) => onPublished(permalink)}
      onNotice={onNotice}
    />
  ) : null;

  // ── Steady-state: planen er jobben, oppsettet er én linje ─────────────
  if (view.steady) {
    return (
      <Stack spacing={3}>
        <Card sx={{ border: "1px solid rgba(155,225,93,0.20)" }}>
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <CheckCircleIcon sx={{ color: "#9be15d" }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Oppsett fullført
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {[summarizeStep("map", flowStatus), summarizeStep("plan", flowStatus)]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
              {activePlanId && <MarketingResultsLine planId={activePlanId} refreshKey={reloadSignal} />}
              <Box sx={{ flex: 1 }} />
              {view.primaryAction === "open_chat" && !chatOpen && (
                <Button size="small" variant="contained" startIcon={<ChatIcon />} onClick={onToggleChat}>
                  {ACTION_LABELS.open_chat}
                </Button>
              )}
              <SecondaryActionsMenu actions={view.secondaryActions} onAction={props.onAction} />
            </Stack>
          </CardContent>
        </Card>
        {publishCard}
        <MarketingPlanWorkspace projectId={projectKey} reloadSignal={reloadSignal} />
        {chat}
      </Stack>
    );
  }

  // ── Oppsett: stepper med bare aktivt steg utfoldet ────────────────────
  const activeIndex = view.activeStep ? STEPS.findIndex((s) => s.key === view.activeStep) : 0;
  return (
    <Stack spacing={3}>
      <Card sx={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <CardContent>
          <Stepper orientation="vertical" activeStep={activeIndex}>
            {STEPS.map((step, index) => {
              const completed = view.completedSteps.includes(step.key);
              const upcoming = index > activeIndex;
              const summary = completed ? summarizeStep(step.key, flowStatus) : "";
              return (
                <Step key={step.key} completed={completed}>
                  <StepLabel
                    optional={
                      completed && summary ? (
                        <Typography variant="caption" color="text.secondary">
                          {summary}
                        </Typography>
                      ) : upcoming && step.unlockHint ? (
                        <Typography variant="caption" color="text.secondary">
                          {step.unlockHint}
                        </Typography>
                      ) : undefined
                    }
                  >
                    <Typography sx={{ fontWeight: 700 }}>{step.label}</Typography>
                  </StepLabel>
                  <StepContent>
                    <StepBody {...props} step={step.key} />
                  </StepContent>
                </Step>
              );
            })}
          </Stepper>
        </CardContent>
      </Card>

      {publishCard}
      {status.plan.exists && (
        <MarketingPlanWorkspace projectId={projectKey} reloadSignal={reloadSignal} />
      )}
      {chat}
    </Stack>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Innholdet i det aktive steget
// ─────────────────────────────────────────────────────────────────────────────

function StepBody(props: FlowBodyProps & { step: MarketingFlowStep }): JSX.Element | null {
  const { view, status, mapping, extraContext, onExtraContextChange, onAction, onProfileSaved, onProfileError, step } = props;
  const { state } = view;
  const org = status?.organization ?? null;

  const primaryAction = view.primaryAction;
  const primary = primaryAction ? (
    <Button
      variant="contained"
      color={step === "map" ? "secondary" : "primary"}
      onClick={() => onAction(primaryAction)}
      startIcon={step === "map" ? <TravelExploreIcon /> : <RocketLaunchIcon />}
    >
      {ACTION_LABELS[primaryAction]}
    </Button>
  ) : null;

  const actionRow = (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
      {primary}
      <SecondaryActionsMenu actions={view.secondaryActions} onAction={onAction} />
    </Stack>
  );

  // ── Steg 1 ────────────────────────────────────────────────────────────
  if (step === "map") {
    if (state.kind === "org_incomplete") {
      return state.canEdit && org ? (
        <OrgProfileForm
          organizationId={org.id}
          orgName={org.name}
          website={org.website}
          orgNumber={org.org_number}
          orgNumberEditable={state.orgNumberEditable}
          onSaved={onProfileSaved}
          onError={onProfileError}
        />
      ) : (
        <CannotEditNotice orgName={org?.name ?? null} />
      );
    }
    if (state.kind === "mapping") {
      return (
        <Box aria-live="polite">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Leser Brønnøysundregistrene, nettstedet og Google Places. Tar vanligvis ett til to minutter.
          </Typography>
          <ResearchProgressLive status={mapping.status} stages={mapping.stages} error={mapping.error} />
        </Box>
      );
    }
    if (state.kind === "map_failed") {
      return (
        <Box>
          <Alert severity="error" sx={{ mb: 1 }}>
            {describeMapError(mapping.error)}
          </Alert>
          {actionRow}
        </Box>
      );
    }
    if (state.kind === "mapped_incomplete") {
      return (
        <Box>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Kartleggingen fant ikke alt som trengs for en meningsfull plan. Fyll inn det som mangler,
            så tas det med i neste kartlegging.
          </Typography>
          <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, mt: 0, mb: 2 }}>
            {state.missing.map((key) => {
              const field = describeMissingField(key);
              return (
                <Typography component="li" variant="body2" key={key}>
                  <strong>{field.label}</strong> — {field.hint}
                </Typography>
              );
            })}
          </Stack>
          <TextField
            label="Det som mangler (valgfritt)"
            placeholder="F.eks. målgruppe, tone, forretningsmål …"
            value={extraContext}
            onChange={(event) => onExtraContextChange(event.target.value.slice(0, 2000))}
            multiline
            minRows={3}
            fullWidth
            helperText={`${extraContext.length}/2000`}
          />
          {actionRow}
        </Box>
      );
    }
    // ready_to_map
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          Agenten leser Brønnøysundregistrene, nettstedet og Google Places for{" "}
          <strong>{org?.name ?? "organisasjonen"}</strong> og bygger selskapsprofil, konkurrentbilde og
          anbefalt kanaloppsett.
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          {[
            org?.website ? `Nettsted: ${org.website}` : null,
            org?.org_number ? `Org.nr.: ${org.org_number}` : null,
            org?.nace_description ? `Bransje: ${org.nace_description}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Typography>
        {actionRow}
      </Box>
    );
  }

  // ── Steg 2 ────────────────────────────────────────────────────────────
  if (step === "plan") {
    if (state.kind === "planning") {
      return (
        <Box aria-live="polite">
          <MarketingGenerationProgress active mode="plan" />
        </Box>
      );
    }
    return (
      <Box>
        {state.kind === "plan_failed" && (
          <Alert severity="error" sx={{ mb: 1.5 }}>
            Planen ble ikke generert. Ingenting er lagret — prøv igjen.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary">
          Kanalstrategi, tone, posisjonering, KPI-mål og 3–5 innholdspilarer for de neste 30 dagene.
        </Typography>
        <LensLine />
        {actionRow}
      </Box>
    );
  }

  // ── Steg 3 ────────────────────────────────────────────────────────────
  if (state.kind === "planning" || state.kind === "generating_posts") {
    const progress = state.kind === "generating_posts" ? state : null;
    const pct =
      progress && progress.expected > 0
        ? Math.min(100, Math.round((progress.generated / progress.expected) * 100))
        : 0;
    return (
      <Box aria-live="polite">
        <MarketingGenerationProgress active mode="posts" />
        {progress && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {progress.generated} av {progress.expected || POSTS_EXPECTED_DEFAULT} poster
            </Typography>
            <LinearProgress variant="determinate" value={pct} color="secondary" />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Du kan spørre agenten mens postene lages.
            </Typography>
          </Box>
        )}
      </Box>
    );
  }
  // plan_draft
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        Planen er klar som utkast. Se gjennom pilarene under, og aktiver når du er fornøyd. Aktivering
        lager 30 dagers poster for LinkedIn og de andre kanalene.
      </Typography>
      {actionRow}
    </Box>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Byggeklosser
// ─────────────────────────────────────────────────────────────────────────────

function SecondaryActionsMenu({
  actions,
  onAction,
}: {
  actions: MarketingFlowAction[];
  onAction: (action: MarketingFlowAction) => void;
}): JSX.Element | null {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (actions.length === 0) return null;
  return (
    <>
      <IconButton
        size="small"
        aria-label="Flere handlinger"
        aria-haspopup="menu"
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)}>
        {actions.map((action) => (
          <MenuItem
            key={action}
            onClick={() => {
              setAnchor(null);
              onAction(action);
            }}
          >
            {ACTION_LABELS[action]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** Én setning om strategi-linsen, med prinsippene bak «Hvorfor?». */
function LensLine(): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
      <PsychologyIcon sx={{ color: "#c4b5fd", fontSize: 18 }} />
      <Typography variant="body2" color="text.secondary">
        Planen formes av beslutningspsykologi — hver pilar oppgir prinsippet den bruker.
      </Typography>
      <IconButton size="small" aria-label="Hvorfor beslutningspsykologi?" onClick={(e) => setAnchor(e.currentTarget)}>
        <HelpOutlineIcon fontSize="small" />
      </IconButton>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box sx={{ p: 2, maxWidth: 380 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Fem prinsipper fra <em>Tenke, fort og langsomt</em>
          </Typography>
          <Stack spacing={1}>
            {PRINCIPLES.map((p) => (
              <Typography key={p.title} variant="body2">
                <strong>{p.title}.</strong> {p.body}
              </Typography>
            ))}
            <Typography variant="caption" color="text.secondary">
              Ingen falsk knapphet, ingen oppdiktede tall.
            </Typography>
          </Stack>
        </Box>
      </Popover>
    </Stack>
  );
}

function normalizeWebsiteInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeOrgNumberInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 9);
}

/** Inline-skjema: rett feilen der den oppstår, og gå rett videre til kartlegging. */
function OrgProfileForm({
  organizationId,
  orgName,
  website,
  orgNumber,
  orgNumberEditable,
  onSaved,
  onError,
}: {
  organizationId: string;
  orgName: string | null;
  website: string | null;
  orgNumber: string | null;
  orgNumberEditable: boolean;
  onSaved: () => void;
  onError: (msg: string) => void;
}): JSX.Element {
  const [websiteValue, setWebsiteValue] = useState(website ?? "");
  const [orgNumberValue, setOrgNumberValue] = useState(orgNumber ?? "");

  const normalizedWebsite = normalizeWebsiteInput(websiteValue);
  const websiteLooksValid = !normalizedWebsite || /^https?:\/\/[^\s/]+\.[^\s/]{2,}/i.test(normalizedWebsite);
  const orgNumberComplete = orgNumberValue.length === 9;
  const orgNumberPartial = orgNumberValue.length > 0 && !orgNumberComplete;
  const canSave = websiteLooksValid && !orgNumberPartial && (Boolean(normalizedWebsite) || orgNumberComplete);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (normalizedWebsite) body.website = normalizedWebsite;
      if (orgNumberEditable && orgNumberComplete && orgNumberValue !== (orgNumber ?? "")) {
        body.org_number = orgNumberValue;
      }
      const response = await apiFetch(
        `/api/admin-room/lead-map/organizations/${encodeURIComponent(organizationId)}/profile`,
        { method: "PATCH", body },
      );
      if (!response.ok) {
        const err = await readStatusError(response);
        throw new Error(
          err.error === "kun_admin_kan_endre_profil"
            ? "Bare organisasjonens administrator kan endre profilen."
            : err.error === "kun_eier_kan_endre_dette_feltet"
              ? "Bare eieren av organisasjonen kan endre organisasjonsnummeret."
              : "Kunne ikke lagre profilen. Prøv igjen.",
        );
      }
    },
    onSuccess: onSaved,
    onError: (err: Error) => onError(err.message),
  });

  return (
    <Box
      component="form"
      onSubmit={(event: React.FormEvent) => {
        event.preventDefault();
        if (canSave && !save.isPending) save.mutate();
      }}
    >
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        Kartleggingen trenger nettstedet eller organisasjonsnummeret til{" "}
        <strong>{orgName ?? "organisasjonen"}</strong>. Ett av dem holder.
      </Typography>
      <Stack spacing={1.5} sx={{ maxWidth: 480 }}>
        <TextField
          label="Nettsted"
          placeholder="firma.no"
          value={websiteValue}
          onChange={(event) => setWebsiteValue(event.target.value)}
          error={!websiteLooksValid}
          helperText={websiteLooksValid ? "Vi legger til https:// automatisk." : "Skriv et domene, f.eks. firma.no"}
          fullWidth
          autoFocus
          disabled={save.isPending}
        />
        <TextField
          label="Organisasjonsnummer"
          placeholder="9 siffer"
          value={orgNumberValue}
          onChange={(event) => setOrgNumberValue(normalizeOrgNumberInput(event.target.value))}
          inputProps={{ inputMode: "numeric", maxLength: 9 }}
          error={orgNumberPartial}
          helperText={
            !orgNumberEditable
              ? "Bare eieren av organisasjonen kan endre organisasjonsnummeret."
              : orgNumberPartial
                ? `${orgNumberValue.length} av 9 siffer`
                : "Gir bransje (NACE) automatisk fra Brønnøysund."
          }
          fullWidth
          disabled={!orgNumberEditable || save.isPending}
        />
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
        <Button
          type="submit"
          variant="contained"
          color="secondary"
          disabled={!canSave || save.isPending}
          startIcon={save.isPending ? <CircularProgress size={16} color="inherit" /> : <TravelExploreIcon />}
        >
          {ACTION_LABELS.edit_org_profile}
        </Button>
      </Stack>
    </Box>
  );
}

function CannotEditNotice({ orgName }: { orgName: string | null }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const request = `Hei! Kan du legge inn nettsted eller organisasjonsnummer på ${orgName ?? "organisasjonen"} i Leadgrid (Organisasjon → Profil)? Da kan jeg kartlegge og lage markedsplanen.`;
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 1.5 }}>
        Kartleggingen trenger nettsted eller organisasjonsnummer. Bare organisasjonens administrator kan
        legge det inn i organisasjonsprofilen.
      </Alert>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ContentCopyIcon />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(request);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Kopiert" : "Kopier forespørsel til administrator"}
      </Button>
    </Box>
  );
}

/** Låst-tilstand som selger: tre konkrete utfall, hvem som kan aktivere, én CTA. */
function LockedModuleCard(): JSX.Element {
  return (
    <Card sx={{ border: "1px solid rgba(255,255,255,0.10)", maxWidth: 720 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <LockIcon sx={{ color: "rgba(226,232,240,0.6)" }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Markedssjef-modus er ikke aktivert
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Tilleggsmodul for organisasjoner som vil markedsføre seg selv uten markedsavdeling. Ingenting
          annet i Leadgrid endres når den skrus på.
        </Typography>
        <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, mt: 0, mb: 2 }}>
          <Typography component="li" variant="body2">
            <strong>30 dagers LinkedIn-plan på tre minutter</strong> — fra org.nr. eller nettsted til ferdige poster.
          </Typography>
          <Typography component="li" variant="body2">
            <strong>Pilarer merket med beslutningsprinsipp</strong> — hvorfor hver post virker, ikke bare hva den sier.
          </Typography>
          <Typography component="li" variant="body2">
            <strong>En agent som kjenner planen</strong> — spør om neste post, KPI-mål eller en premortem.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button variant="contained" href="/leadgrid/priser">
            Se priser og aktiver
          </Button>
          <Typography variant="caption" color="text.secondary">
            Aktiveres av organisasjonens administrator. Tilgang gis til rollen markedssjef.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
