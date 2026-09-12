/** Project- and role-scoped product guide for authenticated Leadgrid pages. */

import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  LinearProgress,
  Slide,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloseIcon from "@mui/icons-material/Close";

interface TourState {
  current_step: string;
  steps_completed: string[];
  organization_id: string;
  project_id: string;
  role_track: string;
  onboarding_version: number;
}

interface StateResponse {
  state: TourState | null;
  eligible: boolean;
}

interface AdvanceResponse {
  next_step: string;
  state: TourState;
}

const STEP_CONTENT: Record<string, {
  title: string;
  body: string;
  action: string;
  href?: string;
}> = {
  welcome: {
    title: "Bli trygg i Leadgrid",
    body: "Denne korte guiden viser veien fra søk til oppfølging. Fremdriften gjelder bare det valgte kundeprosjektet og rollen din der.",
    action: "Start guiden",
  },
  choose_project: {
    title: "Sjekk kundeprosjektet",
    body: "Prosjektvelgeren bestemmer hvor leads, Discovery-profiler, maler og aktiviteter lagres. Kontroller den før du begynner.",
    action: "Prosjektet er riktig",
  },
  find_candidates: {
    title: "Finn riktige bedrifter",
    body: "Bruk «Hva vil du finne?» i iPad-appen for et enkelt Discovery-søk. På web kan du importere en eksisterende, prosjektavgrenset liste.",
    action: "Åpne import",
    href: "/leadgrid/import",
  },
  approve_candidates: {
    title: "Godkjenn før noe lagres",
    body: "Discovery-resultater er forslag. Først når du godkjenner et treff blir det et CRM-lead under Leads og på kartet.",
    action: "Jeg forstår",
  },
  work_leads: {
    title: "Arbeid med godkjente leads",
    body: "Leads er CRM-flaten. Leadbook brukes til maler, Pondus og opplæring – ikke som lagringssted for leads.",
    action: "Åpne pipeline",
    href: "/leadgrid/deals",
  },
  follow_up: {
    title: "Avtal neste steg",
    body: "Sett en konkret oppfølging på leadet. Workflows kan automatisere interne varsler og sikre at avtalen ikke blir glemt.",
    action: "Fullfør guiden",
    href: "/leadgrid/workflows",
  },
};

const STEPS = [
  "welcome",
  "choose_project",
  "find_candidates",
  "approve_candidates",
  "work_leads",
  "follow_up",
];

function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem("creatorhub_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function OnboardingTour({ projectId }: { projectId: string | null }) {
  const [state, setState] = useState<TourState | null>(null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    setState(null);
    setVisible(false);
    if (!projectId) return;
    const controller = new AbortController();
    fetch(
      `/api/leadgrid/onboarding/state?projectId=${encodeURIComponent(projectId)}`,
      { credentials: "include", headers: authHeaders(), signal: controller.signal },
    )
      .then(async (response) => response.ok
        ? response.json() as Promise<StateResponse>
        : { state: null, eligible: false })
      .then((data) => {
        if (data.eligible && data.state
            && data.state.current_step !== "completed"
            && data.state.current_step !== "skipped") {
          setState(data.state);
          setVisible(true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [projectId]);

  if (!projectId || !state || !visible) return null;
  const current = STEP_CONTENT[state.current_step];
  if (!current) return null;
  const index = Math.max(0, STEPS.indexOf(state.current_step));

  const advance = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/leadgrid/onboarding/advance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ fromStep: state.current_step, projectId }),
      });
      if (!response.ok) throw new Error("advance_failed");
      const data = await response.json() as AdvanceResponse;
      if (data.next_step === "completed") {
        setSnack("Leadgrid-guiden er fullført");
        setVisible(false);
      } else {
        setState(data.state);
      }
      if (current.href) window.location.assign(current.href);
    } catch {
      setSnack("Kunne ikke lagre fremdriften. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/leadgrid/onboarding/skip", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error("skip_failed");
      setVisible(false);
    } catch {
      setSnack("Kunne ikke avslutte guiden. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Slide direction="up" in={visible}>
        <Box sx={{
          position: "fixed",
          right: { xs: 12, md: 24 },
          bottom: { xs: 12, md: 24 },
          zIndex: 1400,
          width: { xs: "calc(100vw - 24px)", sm: 380 },
        }}>
          <Card sx={{
            bgcolor: "rgba(10, 5, 18, 0.97)",
            color: "#fff",
            border: "1px solid rgba(167, 139, 250, 0.32)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
            backdropFilter: "blur(12px)",
          }}>
            <IconButton
              aria-label="Avslutt Leadgrid-guiden"
              disabled={busy}
              onClick={() => { void skip(); }}
              sx={{ position: "absolute", top: 8, right: 8, color: "rgba(255,255,255,0.7)" }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <Chip
                  size="small"
                  label={`${index + 1}/${STEPS.length}`}
                  sx={{ bgcolor: "rgba(167,139,250,0.20)", color: "#c4b5fd", fontWeight: 700 }}
                />
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.58)" }}>
                  Prosjektguide · {state.role_track}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={(index / STEPS.length) * 100}
                sx={{
                  mb: 2,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.08)",
                  "& .MuiLinearProgress-bar": { bgcolor: "#a78bfa" },
                }}
              />
              <Typography variant="h6" fontWeight={750} mb={1} pr={3}>
                {current.title}
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.76)", lineHeight: 1.55, mb: 2 }}>
                {current.body}
              </Typography>
              <Button
                fullWidth
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                disabled={busy}
                onClick={() => { void advance(); }}
                sx={{ bgcolor: "#a78bfa", color: "#10081c", fontWeight: 750, minHeight: 44 }}
              >
                {current.action}
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Slide>
      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        message={snack}
      />
    </>
  );
}
