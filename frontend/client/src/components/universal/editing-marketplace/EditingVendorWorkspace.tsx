/**
 * EditingVendorWorkspace.tsx
 *
 * Redigeringsvendorens arbeidsområde med egne faner: Oppdrag, Compliance,
 * Priskatalog, Kommunikasjon. FULLSTENDIG TOSPRÅKLIG — for utenlandske vendors
 * (is_foreign / land≠NO) settes locale='en' og hele arbeidsområdet vises på engelsk.
 *
 * Sikker filflyt: opplasting via presignert PUT til Creatorhub staging-B2;
 * server-side overføring til fotografens B2 skjer ved «marker som levert».
 */

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Stack,
  Divider,
  Tabs,
  Tab,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Alert,
  Snackbar,
  LinearProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SendIcon from "@mui/icons-material/Send";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { apiRequest } from "@/lib/queryClient";
import EditingJobChat from "./EditingJobChat";
import PartnerProgramDashboard from "./PartnerProgramDashboard";
import EditingVendorCatalog from "./EditingVendorCatalog";
import VendorNdaCard from "./VendorNdaCard";
import VendorPayoutCard from "./VendorPayoutCard";
import VendorPrototypeFeedbackTool from "./VendorPrototypeFeedbackTool";
import {
  t,
  pillarLabel,
  localeForVendor,
  type Locale,
} from "./editingMarketplaceStrings";

interface MeResponse {
  hasProfile: boolean;
  isEditingVendor: boolean;
  vendorName: string | null;
  approvalStatus: string;
  country: string;
  isForeign: boolean;
  compliance: {
    isForeign: boolean;
    isEea: boolean;
    requiresExtraGdpr: boolean;
    cleared: boolean;
    pillars: Record<string, { status: string }>;
    badges: string[];
    missing: string[];
  };
  // From /api/editing/vendor/me — prototype=true only for partner_type='prototype'
  // within prototype_until (0% fee). Standard partners have prototype=false.
  platformFee?: { pct?: number; prototype?: boolean; prototypeUntil?: string | null };
  // Prototype-feedback-ansvar (kun for aktive prototype-testere).
  feedback?: {
    lastAt: string | null;
    daysSince: number | null;
    everGiven: boolean;
    overdue: boolean;
    escalation: "ok" | "due" | "warning";
    overdueDays: number;
    warnDays: number;
  } | null;
}

interface EditingJob {
  id: string;
  project_title: string | null;
  status: string;
  brief: string | null;
  amount_cents: number;
  currency: string;
}

interface Props {
  userId: string;
}

function requiredFor(isForeign: boolean, requiresExtraGdpr: boolean): string[] {
  const base = ["standard", "quality", "storage", "gdpr", "delivery", "payment", "dpa", "nda", "no_subcontractors", "no_portfolio_use"];
  if (isForeign && requiresExtraGdpr) base.push("scc", "tia");
  return base;
}

// Improvement C — lett, aldri-blokkerende atferds-beacon. Registrerer hva
// prototype-testeren faktisk gjør (åpner workspace, bytter fane, leverer, gir
// feedback) så admin ser engasjement fra dag 1. Svelger alle feil.
function sendSignal(
  eventType: string,
  surface?: string,
  detail?: Record<string, unknown>,
): void {
  void apiRequest("/api/prototype-testing/signal", {
    method: "POST",
    body: { eventType, surface, detail },
  }).catch(() => {
    /* beacon skal aldri forstyrre */
  });
}

// Førstegangs-opplevelse for nye prototype-testere: en varm, tydelig velkomst
// som forklarer avtalen + hvordan man gir feedback. Vises én gang (localStorage
// per bruker) når Orbit & co. logger inn etter godkjenning.
function PrototypeWelcome({
  userId,
  vendorName,
  locale,
  onStartGuide,
}: {
  userId: string;
  vendorName: string | null;
  locale: "no" | "en";
  onStartGuide?: () => void;
}) {
  const en = locale === "en";
  const key = `ch_prototype_welcome_${userId}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, [key]);

  const close = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    sendSignal("welcome_seen");
    setOpen(false);
  };

  const points: Array<[string, string]> = en
    ? [
        ["🟢 0% platform fee", "You keep 100% of every job during the prototype period."],
        ["💬 Your feedback runs the show", "After each delivered job a quick 👍/👎 — plus the “Give feedback” button anytime. We read all of it."],
        ["🔁 You'll see what changed", "“My feedback — you said → we did” shows the status and our response to each thing you raise."],
        ["🤝 The agreement", "Regular feedback in exchange for 0% — that's how we make the tool you'll keep using better, together."],
      ]
    : [
        ["🟢 0 % plattformgebyr", "Du beholder 100 % av hver jobb i prototype-perioden."],
        ["💬 Din feedback styrer", "Etter hver levert jobb et raskt 👍/👎 — pluss «Gi tilbakemelding» når som helst. Vi leser alt."],
        ["🔁 Du ser hva som skjedde", "«Mine tilbakemeldinger — du sa → vi gjorde» viser status og vårt svar på alt du tar opp."],
        ["🤝 Avtalen", "Jevnlig tilbakemelding i bytte mot 0 % — slik gjør vi verktøyet du skal bruke videre bedre, sammen."],
      ];

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {en ? `Welcome, ${vendorName || "partner"} 👋` : `Velkommen, ${vendorName || "partner"} 👋`}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" sx={{ mb: 2 }}>
          {en
            ? "You're one of the first to shape Creatorhub — as a prototype tester. Here's how it works:"
            : "Du er blant de aller første som former Creatorhub — som prototype-tester. Slik fungerer det:"}
        </Typography>
        <Stack spacing={1.5}>
          {points.map(([h, b], i) => (
            <Box key={i}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {h}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {b}
              </Typography>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close}>{en ? "Maybe later" : "Senere"}</Button>
        <Button
          variant="contained"
          onClick={() => {
            close();
            onStartGuide?.();
          }}
        >
          {en ? "Show me how to give feedback" : "Vis meg hvordan jeg gir tilbakemelding"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Improvement B — micro-feedback per leverte jobb. Lett friksjon (👍/👎 + valgfri
// linje) rett etter levering, kun for prototype-testere. Gjenbruker det eksisterende
// /api/prototype-testing/feedback-endepunktet (syntetiserer tittel/beskrivelse).
function JobMicroFeedback({
  jobId,
  projectTitle,
  locale,
}: {
  jobId: string;
  projectTitle: string | null;
  locale: "no" | "en";
}) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  if (sent) {
    return (
      <Typography variant="caption" color="success.main" sx={{ mt: 1, display: "block" }}>
        {locale === "en" ? "Thanks — this shapes the next iteration." : "Takk — dette former neste iterasjon."}
      </Typography>
    );
  }

  const submit = async (rating: number) => {
    if (busy) return;
    setBusy(true);
    const positive = rating >= 4;
    const ctx = projectTitle ? ` (${projectTitle})` : "";
    try {
      await apiRequest("/api/prototype-testing/feedback", {
        method: "POST",
        body: {
          title:
            (positive
              ? locale === "en" ? "Job workflow worked well" : "Jobb-arbeidsflyt fungerte bra"
              : locale === "en" ? "Job workflow had friction" : "Jobb-arbeidsflyt hadde friksjon") + ctx,
          description:
            note.trim() ||
            (positive
              ? locale === "en" ? "Delivery flow felt smooth." : "Leveringsflyten føltes smidig."
              : locale === "en" ? "Something in the delivery flow slowed me down." : "Noe i leveringsflyten bremset meg."),
          feedbackType: "usability",
          priority: positive ? "low" : "medium",
          rating,
          component: "editing-job",
          projectId: jobId,
          dashboardType: "editing_vendor",
          tags: ["micro-feedback", "post-delivery"],
        },
      });
      sendSignal("feedback_submitted", "jobs", { jobId, rating: r });
      setSent(true);
    } catch {
      // stille — micro-feedback skal aldri blokkere arbeidsflyten
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
      <Typography variant="caption" sx={{ display: "block", mb: 1, fontWeight: 600 }}>
        {locale === "en"
          ? "30 sec: how was this job's workflow? (prototype feedback)"
          : "30 sek: hvordan var arbeidsflyten på denne jobben? (prototype-tilbakemelding)"}
      </Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          placeholder={locale === "en" ? "Optional: what stood out?" : "Valgfritt: hva stakk seg ut?"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          sx={{ flex: 1 }}
        />
        <Button size="small" variant="outlined" disabled={busy} onClick={() => submit(5)}>
          👍
        </Button>
        <Button size="small" variant="outlined" color="warning" disabled={busy} onClick={() => submit(2)}>
          👎
        </Button>
      </Stack>
    </Box>
  );
}

interface MyFeedbackItem {
  id: string;
  title: string;
  description: string;
  status: string;
  adminNotes: string | null;
  rating: number;
  createdAt: string;
  updatedAt: string;
}

// Improvements E (incentive), F (agreement + graduation path) and A (close-the-loop).
// One cohesive prototype-status card: shows the deal + value delivered at 0% fee,
// the graduation path, and an expandable "you said → we did" list of the tester's
// OWN feedback with admin responses (the GET is now privacy-scoped server-side).
function PrototypeTesterPanel({
  me,
  jobs,
  locale,
}: {
  me: MeResponse;
  jobs: EditingJob[];
  locale: "no" | "en";
}) {
  const [showLoop, setShowLoop] = useState(false);
  const en = locale === "en";

  const myFeedback = useQuery<MyFeedbackItem[]>({
    queryKey: ["/api/prototype-testing/feedback", "mine"],
    queryFn: async () => {
      const r = await apiRequest("/api/prototype-testing/feedback?limit=100");
      return (r?.feedback ?? []) as MyFeedbackItem[];
    },
    enabled: showLoop,
    staleTime: 30000,
  });

  const delivered = jobs.filter(
    (j) => j.status === "delivered" || j.status === "delivered_to_client",
  );
  const totalCents = delivered.reduce((s, j) => s + (j.amount_cents || 0), 0);
  const currency = delivered[0]?.currency || "NOK";
  const totalValue = (totalCents / 100).toLocaleString(en ? "en-US" : "nb-NO", {
    maximumFractionDigits: 0,
  });

  const untilRaw = me.platformFee?.prototypeUntil;
  const until = untilRaw ? new Date(untilRaw) : null;
  const untilStr =
    until && !Number.isNaN(until.getTime())
      ? until.toLocaleDateString(en ? "en-US" : "nb-NO", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "primary.light",
        bgcolor: "action.hover",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Chip color="primary" size="small" label={en ? "Prototype tester" : "Prototype-tester"} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {en ? "0% platform fee" : "0 % plattformgebyr"}
        </Typography>
      </Stack>

      {/* E — incentive: value delivered at 0% */}
      <Typography variant="body2" sx={{ mb: 1 }}>
        {delivered.length > 0
          ? en
            ? `You've delivered ${delivered.length} job(s) worth ${totalValue} ${currency} — all at 0% platform fee.`
            : `Du har levert ${delivered.length} jobb(er) til en verdi av ${totalValue} ${currency} — alt med 0 % plattformgebyr.`
          : en
            ? "As a prototype tester you keep 100% — no platform fee while the program runs."
            : "Som prototype-tester beholder du 100 % — ingen plattformgebyr mens programmet varer."}
      </Typography>

      {/* F — agreement + graduation path */}
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        {en
          ? `The deal: regular feedback in exchange for the 0% fee${untilStr ? ` (prototype period through ${untilStr})` : ""}. When the period ends you graduate to a Creatorhub partner on the standard fee — your testing shapes the tool you'll keep using.`
          : `Avtalen: jevnlig tilbakemelding i bytte mot 0 %-gebyret${untilStr ? ` (prototype-periode ut ${untilStr})` : ""}. Når perioden er over blir du Creatorhub-partner på standard gebyr — testingen din former verktøyet du selv skal bruke videre.`}
      </Typography>

      {/* A — close the loop */}
      <Button size="small" variant="text" onClick={() => setShowLoop((v) => !v)} sx={{ px: 0 }}>
        {showLoop
          ? en
            ? "Hide my feedback"
            : "Skjul mine tilbakemeldinger"
          : en
            ? "My feedback — you said → we did"
            : "Mine tilbakemeldinger — du sa → vi gjorde"}
      </Button>

      {showLoop ? (
        <Box sx={{ mt: 1 }}>
          {myFeedback.isLoading ? (
            <Typography variant="caption">{en ? "Loading…" : "Laster…"}</Typography>
          ) : (myFeedback.data?.length ?? 0) === 0 ? (
            <Typography variant="caption" color="text.secondary">
              {en
                ? "No feedback yet — your input here directly shapes the product."
                : "Ingen tilbakemelding ennå — innspillene dine her former produktet direkte."}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {(myFeedback.data ?? []).map((f) => {
                const st = String(f.status || "").toLowerCase();
                const resolved =
                  st === "resolved" || st === "closed" || st === "completed" || st === "done";
                const inProgress =
                  st === "in_progress" ||
                  st === "in-progress" ||
                  st === "planned" ||
                  st === "acknowledged";
                return (
                  <Box
                    key={f.id}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: "background.paper",
                      border: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {f.title}
                      </Typography>
                      <Chip
                        size="small"
                        color={resolved ? "success" : inProgress ? "info" : "default"}
                        label={
                          resolved
                            ? en
                              ? "Done"
                              : "Løst"
                            : inProgress
                              ? en
                                ? "In progress"
                                : "Underveis"
                              : en
                                ? "Received"
                                : "Mottatt"
                        }
                      />
                    </Stack>
                    {f.adminNotes ? (
                      <Typography variant="caption" color="success.main" sx={{ display: "block", mt: 0.5 }}>
                        {en ? "Our response: " : "Vårt svar: "}
                        {f.adminNotes}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      ) : null}
    </Box>
  );
}

export default function EditingVendorWorkspace({ userId }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  // Interaktiv feedback-guide: bumping tokenet åpner feedback-verktøyet, guided=true
  // viser steg-for-steg-anvisning inni. Tilgjengelig for ALLE prototype-testere.
  const [feedbackOpenToken, setFeedbackOpenToken] = useState(0);
  const [feedbackGuided, setFeedbackGuided] = useState(false);
  const startFeedbackGuide = () => {
    setFeedbackGuided(true);
    setFeedbackOpenToken((t) => t + 1);
  };
  const [snack, setSnack] = useState<{ msg: string; sev: "success" | "error" } | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [uploadingJob, setUploadingJob] = useState<string | null>(null);
  const [commJobId, setCommJobId] = useState<string | null>(null);

  const meQuery = useQuery<MeResponse>({
    queryKey: ["/api/editing/vendor/me"],
    queryFn: () => apiRequest("/api/editing/vendor/me"),
  });
  const me = meQuery.data;
  const locale: Locale = me ? localeForVendor({ isForeign: me.isForeign, country: me.country }) : "no";

  const jobsQuery = useQuery<{ jobs: EditingJob[] }>({
    queryKey: ["/api/editing/vendor/jobs"],
    queryFn: () => apiRequest("/api/editing/vendor/jobs"),
  });
  const jobs = jobsQuery.data?.jobs ?? [];

  // Improvement C — atferds-beacon (kun aktive prototype-testere).
  const isPrototype = !!me?.platformFee?.prototype;
  useEffect(() => {
    if (isPrototype) sendSignal("workspace_open");
  }, [isPrototype]);
  useEffect(() => {
    if (!isPrototype) return;
    const surfaces = ["jobs", "compliance", "catalog", "communication"];
    sendSignal("tab_view", surfaces[tab] || String(tab));
  }, [tab, isPrototype]);

  const acceptMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest(`/api/editing/jobs/${jobId}/accept`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] });
      setSnack({ msg: t("ws_accept", locale), sev: "success" });
    },
    onError: () => setSnack({ msg: "Error", sev: "error" }),
  });

  const declineMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest(`/api/editing/jobs/${jobId}/decline`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] }),
  });

  const deliverMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest(`/api/editing/jobs/${jobId}/deliver`, { method: "POST" }),
    onSuccess: (_data, jobId) => {
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] });
      setSnack({ msg: t("ws_mark_delivered", locale), sev: "success" });
      if (me?.platformFee?.prototype) sendSignal("job_delivered", "jobs", { jobId });
    },
    onError: () => setSnack({ msg: "Error", sev: "error" }),
  });

  const complianceMutation = useMutation({
    mutationFn: (payload: { country: string; isForeign: boolean; acceptedRequirements: string[] }) =>
      apiRequest("/api/editing/vendor/compliance/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/me"] });
      setSnack({ msg: t("comp_cleared", locale), sev: "success" });
    },
    onError: () => setSnack({ msg: t("comp_must_accept", locale), sev: "error" }),
  });

  async function uploadFiles(jobId: string, files: FileList) {
    setUploadingJob(jobId);
    try {
      for (const file of Array.from(files)) {
        const resp = (await apiRequest(`/api/editing/jobs/${jobId}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }),
        })) as { uploadUrl: string; key: string };
        await fetch(resp.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
      }
      qc.invalidateQueries({ queryKey: ["/api/editing/vendor/jobs"] });
      setSnack({ msg: t("ws_upload_files", locale), sev: "success" });
    } catch {
      setSnack({ msg: "Error", sev: "error" });
    } finally {
      setUploadingJob(null);
    }
  }

  if (meQuery.isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Self-gating: vis kun for redigeringsvendors (vendor_type='editing')
  if (me && !me.isEditingVendor) return null;

  const compliance = me?.compliance;
  const required = requiredFor(compliance?.isForeign ?? false, compliance?.requiresExtraGdpr ?? false);
  const allChecked = required.every((r) => checked[r]);

  const statusChip = (status: string) => (
    <Chip
      size="small"
      label={t(`jobstatus.${status}`, locale)}
      color={status === "approved" || status === "delivered_to_client" ? "success" : status === "delivered" ? "info" : "default"}
    />
  );

  return (
    <Box>
      {/* Partnerprogram-/verifiserings-dashboard — alltid øverst */}
      <PartnerProgramDashboard me={me} locale={locale} onStartVerification={() => setTab(1)} />

      {/* Prototype-avtale-nudge: 0%-fordelen forutsetter jevnlig tilbakemelding. */}
      {me?.platformFee?.prototype && me?.feedback?.overdue ? (
        <Alert severity={me.feedback.escalation === "warning" ? "error" : "warning"} sx={{ mb: 2 }}>
          <strong>{locale === "en" ? "Feedback is overdue." : "Tilbakemelding mangler."}</strong>{" "}
          {me.feedback.everGiven
            ? (locale === "en"
                ? `Last given ${me.feedback.daysSince} days ago. `
                : `Sist gitt for ${me.feedback.daysSince} dager siden. `)
            : (locale === "en"
                ? "You haven't given any feedback yet. "
                : "Du har ikke gitt tilbakemelding ennå. ")}
          {locale === "en"
            ? "The prototype agreement (0% platform fee) requires you to help improve the system with regular feedback — use the “Give feedback” button below."
            : "Prototype-avtalen (0 % plattformgebyr) forutsetter at du hjelper oss å forbedre systemet med jevnlig tilbakemelding — bruk «Gi tilbakemelding»-knappen nedenfor."}
          {me.feedback.escalation === "warning"
            ? (locale === "en"
                ? " The 0% benefit may be withdrawn if no input arrives soon."
                : " 0 %-fordelen kan trekkes hvis det ikke kommer innspill snart.")
            : ""}
        </Alert>
      ) : null}

      {me?.platformFee?.prototype ? (
        <>
          <PrototypeWelcome userId={userId} vendorName={me?.vendorName ?? null} locale={locale === "en" ? "en" : "no"} onStartGuide={startFeedbackGuide} />
          <PrototypeTesterPanel me={me} jobs={jobs} locale={locale === "en" ? "en" : "no"} />
        </>
      ) : null}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {t("ws_title", locale)}
        </Typography>
        {me?.platformFee?.prototype ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" variant="text" onClick={startFeedbackGuide}>
              {locale === "en" ? "How does feedback work?" : "Slik gir du tilbakemelding"}
            </Button>
            <VendorPrototypeFeedbackTool
              locale={locale}
              vendorName={me?.vendorName}
              autoOpenToken={feedbackOpenToken}
              guided={feedbackGuided}
            />
          </Stack>
        ) : null}
      </Box>

      {compliance && !compliance.cleared && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("comp_intro", locale)}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" allowScrollButtonsMobile>
        <Tab label={t("ws_tab_jobs", locale)} />
        <Tab label={t("ws_tab_compliance", locale)} />
        <Tab label={t("ws_tab_catalog", locale)} />
        <Tab label={t("ws_tab_communication", locale)} />
      </Tabs>

      {/* ── Oppdrag ── */}
      {tab === 0 && (
        <Stack spacing={2}>
          <Typography variant="caption" color="text.secondary">
            <VerifiedUserIcon sx={{ fontSize: 14, verticalAlign: "middle", mr: 0.5 }} />
            {t("ws_upload_hint", locale)}
          </Typography>
          {jobsQuery.isLoading ? (
            <CircularProgress size={24} />
          ) : jobs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("ws_no_jobs", locale)}
            </Typography>
          ) : (
            jobs.map((j) => (
              <Card key={j.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontWeight: 600 }}>{j.project_title || "—"}</Typography>
                    {statusChip(j.status)}
                  </Box>
                  {j.brief && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {t("ws_brief", locale)}: {j.brief}
                    </Typography>
                  )}
                  {j.amount_cents > 0 && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {t("ws_amount", locale)}: {(j.amount_cents / 100).toFixed(0)} {j.currency}
                    </Typography>
                  )}
                  {uploadingJob === j.id && <LinearProgress sx={{ mt: 1 }} />}
                  <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap" }}>
                    {j.status === "requested" && (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!compliance?.cleared || acceptMutation.isPending}
                          onClick={() => acceptMutation.mutate(j.id)}
                        >
                          {t("ws_accept", locale)}
                        </Button>
                        <Button size="small" color="inherit" onClick={() => declineMutation.mutate(j.id)}>
                          {t("ws_decline", locale)}
                        </Button>
                      </>
                    )}
                    {j.status === "in_progress" && (
                      <>
                        <Button size="small" variant="outlined" component="label" startIcon={<CloudUploadIcon />} disabled={uploadingJob === j.id}>
                          {uploadingJob === j.id ? t("ws_uploading", locale) : t("ws_upload_files", locale)}
                          <input
                            type="file"
                            hidden
                            multiple
                            onChange={(e) => e.target.files && uploadFiles(j.id, e.target.files)}
                          />
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<SendIcon />}
                          disabled={deliverMutation.isPending}
                          onClick={() => deliverMutation.mutate(j.id)}
                        >
                          {deliverMutation.isPending ? t("ws_transferring", locale) : t("ws_mark_delivered", locale)}
                        </Button>
                      </>
                    )}
                  </Stack>
                  {me?.platformFee?.prototype &&
                  (j.status === "delivered" || j.status === "delivered_to_client") ? (
                    <JobMicroFeedback jobId={j.id} projectTitle={j.project_title} locale={locale === "en" ? "en" : "no"} />
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {/* ── Compliance ── */}
      {tab === 1 && compliance && (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            {t("comp_title", locale)}
          </Typography>
          {/* Pilar-status */}
          <Stack spacing={1} sx={{ mb: 2 }}>
            {Object.entries(compliance.pillars).map(([key, p]) => (
              <Box key={key} sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2">{pillarLabel(key, locale)}</Typography>
                <Chip
                  size="small"
                  color={p.status === "approved" || p.status === "automatic" || p.status === "not_allowed" ? "success" : "default"}
                  label={
                    p.status === "approved"
                      ? t("status_approved", locale)
                      : p.status === "automatic"
                        ? t("status_deletion_auto", locale)
                        : p.status === "not_allowed"
                          ? t("status_subcontractors_no", locale)
                          : t("status_pending", locale)
                  }
                />
              </Box>
            ))}
          </Stack>

          {compliance.cleared ? (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              {t("comp_cleared", locale)}
            </Alert>
          ) : (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {t("comp_intro", locale)}
                </Typography>
                {compliance.requiresExtraGdpr && (
                  <Alert severity="info" sx={{ mb: 1 }}>
                    {t("comp_non_eea_notice", locale)}
                  </Alert>
                )}
                <Divider sx={{ my: 1 }} />
                <Stack>
                  {required.map((r) => (
                    <FormControlLabel
                      key={r}
                      control={
                        <Checkbox
                          checked={!!checked[r]}
                          onChange={(e) => setChecked((c) => ({ ...c, [r]: e.target.checked }))}
                        />
                      }
                      label={<Typography variant="body2">{t(`req.${r}`, locale)}</Typography>}
                    />
                  ))}
                </Stack>
                <Button
                  variant="contained"
                  sx={{ mt: 1 }}
                  disabled={!allChecked || complianceMutation.isPending}
                  onClick={() =>
                    complianceMutation.mutate({
                      country: me?.country || "NO",
                      isForeign: !!me?.isForeign,
                      acceptedRequirements: required,
                    })
                  }
                >
                  {t("comp_accept_all", locale)}
                </Button>
                {!allChecked && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    {t("comp_must_accept", locale)}
                  </Typography>
                )}
              </CardContent>
            </Card>
          )}
          <VendorPayoutCard locale={locale === "en" ? "en" : "no"} />
          <VendorNdaCard locale={locale === "en" ? "en" : "no"} />
        </Box>
      )}

      {/* ── Priskatalog ── */}
      {tab === 2 && (
        <Box>
          <EditingVendorCatalog locale={locale === "en" ? "en" : "no"} country={me?.country} />
        </Box>
      )}

      {/* ── Kommunikasjon ── */}
      {tab === 3 && (() => {
        const commJobs = jobs.filter((j) =>
          ["in_progress", "delivered", "approved", "delivered_to_client"].includes(j.status),
        );
        if (commJobs.length === 0) {
          return <Alert severity="info">{t("comm_placeholder", locale)}</Alert>;
        }
        const active = commJobId || commJobs[0].id;
        return (
          <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap" }}>
              {commJobs.map((j) => (
                <Chip
                  key={j.id}
                  label={j.project_title || j.id.slice(0, 6)}
                  color={active === j.id ? "primary" : "default"}
                  onClick={() => setCommJobId(j.id)}
                />
              ))}
            </Stack>
            <Card variant="outlined">
              <CardContent>
                <EditingJobChat jobId={active} selfRole="vendor" locale={locale} />
              </CardContent>
            </Card>
          </Box>
        );
      })()}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}>
        {snack ? (
          <Alert severity={snack.sev} onClose={() => setSnack(null)}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
