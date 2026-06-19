/**
 * OnboardingTour.tsx — Floating in-app guide for nye Leadgrid-brukere.
 *
 * Henter state fra /api/leadgrid/onboarding/state ved mount.
 * Hvis eligible + not completed/skipped → vis floating-card i hjørnet.
 *
 * Steps:
 *   welcome → add_first_customer → see_portal → try_playbook → view_apis → completed
 */

import React, { useEffect, useState } from "react";
import {
  Box, Card, CardContent, Stack, Typography, Button, IconButton,
  LinearProgress, Chip, Slide, Snackbar,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface TourState {
  current_step: string;
  steps_completed: string[];
}

const STEP_CONTENT: Record<string, {
  title: string; body: string; cta: string; cta_href?: string;
}> = {
  welcome: {
    title: "Velkommen til Leadgrid 👋",
    body: "Vi tar deg gjennom de 4 viktigste tingene du må vite. Tar 2 minutter.",
    cta: "Start tour",
  },
  add_first_customer: {
    title: "Legg til din første kunde",
    body: "Trykk på + i Prosjekter-fanen. Skriv inn website + e-post → Leadgrid gjør resten på 30 sekunder.",
    cta: "Vis meg →",
    cta_href: "/role-room",
  },
  see_portal: {
    title: "Hver kunde får en egen portal",
    body: "Når kunden klikker lenken i e-posten ser de score, behov og leveranser real-time. Ingen pålogging.",
    cta: "Hvordan ser den ut?",
    cta_href: "/leadgrid",
  },
  try_playbook: {
    title: "Markedsfører-playbooks",
    body: "Når kunden ber om fokus, får du en steg-for-steg-playbook for Meta Pixel, GA4, Google Ads osv.",
    cta: "Vis playbooks",
  },
  view_apis: {
    title: "Vil dere integrere?",
    body: "Vi har et fullt Partners API + webhooks for å koble Leadgrid mot egne systemer.",
    cta: "Se developer-docs",
    cta_href: "/leadgrid/utviklere",
  },
  completed: {
    title: "Du er klar! ✓",
    body: "Du har nå sett de viktigste delene. Lykke til!",
    cta: "Avslutt",
  },
};

const STEPS_ORDER = [
  "welcome", "add_first_customer", "see_portal",
  "try_playbook", "view_apis", "completed",
];

export function OnboardingTour() {
  const [state, setState] = useState<TourState | null>(null);
  const [visible, setVisible] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leadgrid/onboarding/state", { credentials: "include" })
      .then((r) => r.ok ? r.json() : { state: null, eligible: false })
      .then((d) => {
        if (d.eligible && d.state &&
            d.state.current_step !== "completed" &&
            d.state.current_step !== "skipped") {
          setState(d.state);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!state || !visible) return null;

  const cur = STEP_CONTENT[state.current_step];
  if (!cur) return null;
  const curIdx = STEPS_ORDER.indexOf(state.current_step);
  const totalSteps = STEPS_ORDER.length - 1; // exklusiv 'completed'
  const progressPct = (curIdx / totalSteps) * 100;

  const advance = async () => {
    const r = await fetch("/api/leadgrid/onboarding/advance", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromStep: state.current_step }),
    });
    if (r.ok) {
      const d = await r.json();
      if (d.next_step === "completed") {
        setSnack("Onboarding fullført!");
        setVisible(false);
      } else {
        setState({ ...state, current_step: d.next_step,
                    steps_completed: [...state.steps_completed, state.current_step] });
      }
    }
  };

  const skip = async () => {
    await fetch("/api/leadgrid/onboarding/skip", {
      method: "POST", credentials: "include",
    });
    setVisible(false);
  };

  return (
    <>
      <Slide direction="up" in={visible}>
        <Box sx={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999,
                    maxWidth: 360 }}>
          <Card sx={{
            bgcolor: "rgba(10, 5, 18, 0.96)",
            color: "#fff",
            border: "1px solid rgba(167, 139, 250, 0.30)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
          }}>
            <Box sx={{ position: "absolute", top: 8, right: 8 }}>
              <IconButton size="small" onClick={skip}
                          sx={{ color: "rgba(255,255,255,0.5)" }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <Chip size="small" label={`${curIdx + 1}/${totalSteps}`}
                      sx={{ bgcolor: "rgba(167,139,250,0.20)", color: "#a78bfa",
                            fontWeight: 600 }} />
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                  Leadgrid-onboarding
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={progressPct}
                              sx={{ mb: 2, height: 3, borderRadius: 2,
                                    bgcolor: "rgba(255,255,255,0.08)",
                                    "& .MuiLinearProgress-bar": { bgcolor: "#a78bfa" } }} />
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                {cur.title}
              </Typography>
              <Typography variant="body2"
                          sx={{ color: "rgba(255,255,255,0.75)", mb: 2, lineHeight: 1.5 }}>
                {cur.body}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button variant="contained" endIcon={<ArrowForwardIcon />}
                        onClick={() => {
                          if (cur.cta_href) window.open(cur.cta_href, "_blank");
                          advance();
                        }}
                        sx={{ bgcolor: "#a78bfa", color: "#0a0512", fontWeight: 700,
                              flex: 1, "&:hover": { bgcolor: "#9171e6" } }}>
                  {cur.cta}
                </Button>
                <Button size="small" onClick={skip}
                        sx={{ color: "rgba(255,255,255,0.5)" }}>
                  Hopp over
                </Button>
              </Stack>

              {state.steps_completed.length > 0 && (
                <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)",
                              display: "block", mb: 0.5 }}>
                    Fullført:
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
                    {state.steps_completed.map((s) => (
                      <Chip key={s} size="small"
                            icon={<CheckCircleIcon sx={{ fontSize: 12 }} />}
                            label={STEP_CONTENT[s]?.title.substring(0, 20) ?? s}
                            sx={{ bgcolor: "rgba(155,225,93,0.10)", color: "#9be15d",
                                  height: 18, fontSize: 10 }} />
                    ))}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Slide>
      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)}
                message={snack} />
    </>
  );
}
