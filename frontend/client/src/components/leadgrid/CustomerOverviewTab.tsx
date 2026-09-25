/**
 * Kundeoversikt — én rad per bedrift, og det som faktisk betyr noe.
 *
 * Rekkefølgen er valgt: det du må gjøre noe med står øverst og i rødt, resten
 * er sammenleggbart. En oversikt som viser alt like tydelig viser ingenting.
 *
 * «Fått» og «tatt i bruk» står ved siden av hverandre med vilje. En kunde som
 * har fått fire tjenester og bruker én er ikke en fornøyd kunde, det er en
 * oppsigelse som ikke har skjedd ennå.
 */
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip,
  CircularProgress, Divider, LinearProgress, Stack, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { apiRequest } from "@/lib/queryClient";
import { StripeConfigCard } from "./StripeConfigCard";

interface Kunde {
  organization_id: string;
  name: string;
  org_number: string | null;
  city: string | null;
  plan: string | null;
  created_at: string;
  admin_email: string | null;
  members: number;
  trial: {
    state: "not_started" | "active" | "expired" | "paid";
    days_left: number | null;
    read_only: boolean;
    message: string;
  };
  agreements: {
    signed: Array<{ type: string; label: string; signed_at: string; signer_name: string }>;
    missing: Array<{ type: string; label: string }>;
  };
  services: { granted: string[]; activated: string[] };
  activity: {
    projects: number; discovery_runs: number; leads: number;
    decisions: number; last_activity_at: string | null;
  };
  usage: {
    month: string; discovery_runs: number; candidates_reserved: number;
    candidate_limit: number | null; ai_calls: number; ai_cost_usd: number;
    storage_mb: number; billable_events: number;
  };
  flags: string[];
}

const TRIAL_FARGE: Record<Kunde["trial"]["state"], "default" | "success" | "warning" | "error"> = {
  paid: "success",
  active: "default",
  not_started: "default",
  expired: "error",
};

function dato(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("nb-NO") : "aldri";
}

function Nøkkeltall({ merkelapp, verdi, hint }: { merkelapp: string; verdi: React.ReactNode; hint?: string }) {
  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="caption" color="text.secondary" display="block">{merkelapp}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{verdi}</Typography>
      {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
    </Box>
  );
}

export function CustomerOverviewTab() {
  const { data, isLoading, error } = useQuery<{ customers: Kunde[] }>({
    queryKey: ["leadgrid-kundeoversikt"],
    queryFn: () => apiRequest("/api/leadgrid/kundeoversikt"),
    retry: false,
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{(error as Error).message}</Alert>;

  const kunder = data?.customers ?? [];
  if (kunder.length === 0) {
    return <Alert severity="info">Ingen kunder registrert ennå.</Alert>;
  }

  const medAvvik = kunder.filter((k) => k.flags.length > 0).length;

  return (
    <Stack spacing={2}>
      <StripeConfigCard />
      {medAvvik > 0 && (
        <Alert severity="warning" icon={<WarningAmberIcon />}>
          {medAvvik} av {kunder.length} kunder har noe som må håndteres.
        </Alert>
      )}

      {kunder.map((k) => {
        const kvote = k.usage.candidate_limit;
        const brukt = kvote ? Math.min(100, (k.usage.candidates_reserved / kvote) * 100) : null;
        return (
          <Accordion key={k.organization_id} defaultExpanded={k.flags.length > 0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems={{ sm: "center" }}
                sx={{ width: "100%", pr: 2 }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{k.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[k.org_number && `org.nr ${k.org_number}`, k.city, k.admin_email]
                      .filter(Boolean).join(" · ")}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={TRIAL_FARGE[k.trial.state]}
                  label={
                    k.trial.state === "paid" ? (k.plan ?? "betalende")
                      : k.trial.state === "expired" ? "utløpt"
                      : k.trial.days_left != null ? `${k.trial.days_left} d igjen`
                      : "ikke startet"
                  }
                />
                {k.flags.length > 0 && (
                  <Chip size="small" color="warning" label={`${k.flags.length} avvik`} />
                )}
              </Stack>
            </AccordionSummary>

            <AccordionDetails>
              <Stack spacing={2.5}>
                {k.flags.length > 0 && (
                  <Alert severity="warning">
                    <Stack component="ul" sx={{ m: 0, pl: 2 }} spacing={0.5}>
                      {k.flags.map((f) => (
                        <Typography component="li" variant="body2" key={f}>{f}</Typography>
                      ))}
                    </Stack>
                  </Alert>
                )}

                <Box>
                  <Typography variant="overline" color="text.secondary">Forbruk {k.usage.month}</Typography>
                  <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    <Nøkkeltall merkelapp="Discovery-kjøringer" verdi={k.usage.discovery_runs} />
                    <Nøkkeltall
                      merkelapp="Kandidater"
                      verdi={kvote ? `${k.usage.candidates_reserved} / ${kvote}` : k.usage.candidates_reserved}
                    />
                    <Nøkkeltall
                      merkelapp="AI-kall"
                      verdi={k.usage.ai_calls}
                      hint={k.usage.ai_cost_usd > 0 ? `$${k.usage.ai_cost_usd.toFixed(2)}` : undefined}
                    />
                    <Nøkkeltall merkelapp="Lagring" verdi={`${k.usage.storage_mb.toFixed(1)} MB`} />
                    <Nøkkeltall merkelapp="Fakturerbare hendelser" verdi={k.usage.billable_events} />
                  </Stack>
                  {brukt !== null && (
                    <LinearProgress
                      variant="determinate" value={brukt}
                      color={brukt > 90 ? "warning" : "primary"}
                      sx={{ mt: 1.5, height: 6, borderRadius: 3 }}
                    />
                  )}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="overline" color="text.secondary">Tjenester</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {k.services.granted.length === 0 && (
                      <Typography variant="body2" color="text.secondary">Ingen tildelt.</Typography>
                    )}
                    {k.services.granted.map((s) => (
                      <Chip
                        key={s} size="small" label={s}
                        color={k.services.activated.includes(s) ? "success" : "default"}
                        variant={k.services.activated.includes(s) ? "filled" : "outlined"}
                      />
                    ))}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Fylt = tatt i bruk. Åpen = tildelt, men aldri brukt.
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="overline" color="text.secondary">Avtaler</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {k.agreements.signed.map((a) => (
                      <Chip
                        key={a.type} size="small" color="success"
                        label={`${a.label} · ${a.signer_name} · ${dato(a.signed_at)}`}
                      />
                    ))}
                    {k.agreements.missing.map((a) => (
                      <Chip key={a.type} size="small" color="error" variant="outlined" label={`${a.label} mangler`} />
                    ))}
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="overline" color="text.secondary">Aktivitet</Typography>
                  <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    <Nøkkeltall merkelapp="Prosjekter" verdi={k.activity.projects} />
                    <Nøkkeltall merkelapp="Leads" verdi={k.activity.leads} />
                    <Nøkkeltall
                      merkelapp="Beslutninger" verdi={k.activity.decisions}
                      hint="godkjent eller avvist"
                    />
                    <Nøkkeltall merkelapp="Brukere" verdi={k.members} />
                    <Nøkkeltall merkelapp="Sist aktiv" verdi={dato(k.activity.last_activity_at)} />
                  </Stack>
                </Box>
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}

export default CustomerOverviewTab;
