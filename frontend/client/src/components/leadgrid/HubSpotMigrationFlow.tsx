/**
 * «Skal du migrere fra HubSpot til Leadgrid? Slik gjør du det.»
 *
 * Fire steg, og kunden vet hele veien hva som skjer og hva som ikke har
 * skjedd ennå:
 *
 *   1 Nøkkel      hvor den lages, hvilke tilganger, og hva vi gjør med den
 *   2 Henter      tall per datatype etter hvert som de lander
 *   3 Se over     hva som kommer inn, hva som slås sammen, hva som IKKE kommer
 *   4 Ferdig      hva som faktisk havnet i Leadgrid
 *
 * Ingenting skrives før kunden trykker i steg 3. Det er hele poenget med å
 * ha et steg 3.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, AlertTitle, Box, Button, Chip, CircularProgress, Divider,
  LinearProgress, Link, List, ListItem, ListItemText, Stack, Step,
  StepLabel, Stepper, TextField, Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { apiRequest } from "@/lib/queryClient";

interface JobbStatus {
  id: string;
  fase: "sjekker" | "henter" | "planlegger" | "klar" | "skriver" | "ferdig" | "feilet";
  hentet: Array<{ navn: string; antall: number }>;
  melding: string;
  plan?: {
    counts: Record<string, number>;
    issues: Array<{ code: string; message: string; silentLoss: boolean }>;
    mergedIntoExisting: Array<{ hubspotId: string; mergesWith: string; on: string }>;
    eksempler: Array<{ name: string; stage: string; email: string | null }>;
  };
  resultat?: {
    customers: number; deals: number; contacts: number;
    products: number; lineItems: number; updated: number;
  };
  feil?: {
    kode: string;
    melding: string;
    manglendeScopes?: Array<{ navn: string; scope: string }>;
  };
  advarsler: string[];
}

const SCOPES = [
  "crm.objects.companies.read",
  "crm.objects.contacts.read",
  "crm.objects.deals.read",
  "crm.objects.owners.read",
  "crm.objects.products.read",
  "crm.objects.line_items.read",
  "crm.schemas.deals.read",
];

const STEG = ["Nøkkel", "Henter", "Se over", "Ferdig"];

function stegFor(jobb: JobbStatus | null): number {
  if (!jobb) return 0;
  if (jobb.fase === "ferdig") return 3;
  if (jobb.fase === "klar" || jobb.fase === "skriver") return 2;
  if (jobb.fase === "feilet") return jobb.plan ? 2 : 1;
  return 1;
}

export function HubSpotMigrationFlow({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [nøkkel, setNøkkel] = useState("");
  const [jobb, setJobb] = useState<JobbStatus | null>(null);
  const [starter, setStarter] = useState(false);
  const [skriver, setSkriver] = useState(false);
  const [startfeil, setStartfeil] = useState<string | null>(null);
  const polling = useRef<number | null>(null);

  const stoppPolling = useCallback(() => {
    if (polling.current) {
      window.clearInterval(polling.current);
      polling.current = null;
    }
  }, []);

  useEffect(() => stoppPolling, [stoppPolling]);

  const start = useCallback(async () => {
    setStarter(true);
    setStartfeil(null);
    try {
      const svar = await apiRequest<JobbStatus>("/api/leadgrid/import/hubspot/jobs", {
        method: "POST",
        body: { project_id: projectId, service_key: nøkkel.trim() },
      });
      // Nøkkelen er sendt. Den skal ikke ligge igjen i skjemaet etterpå.
      setNøkkel("");
      setJobb(svar);
      polling.current = window.setInterval(async () => {
        try {
          const neste = await apiRequest<JobbStatus>(
            `/api/leadgrid/import/hubspot/jobs/${svar.id}?project_id=${encodeURIComponent(projectId)}`,
          );
          setJobb(neste);
          if (["klar", "ferdig", "feilet"].includes(neste.fase)) stoppPolling();
        } catch {
          // Et tapt poll-kall er ikke en feil i migreringen; neste forsøk tar det.
        }
      }, 1500);
    } catch (error) {
      setStartfeil((error as Error).message || "Fikk ikke startet migreringen.");
    } finally {
      setStarter(false);
    }
  }, [nøkkel, projectId, stoppPolling]);

  const bekreft = useCallback(async () => {
    if (!jobb) return;
    setSkriver(true);
    try {
      const svar = await apiRequest<JobbStatus>(
        `/api/leadgrid/import/hubspot/jobs/${jobb.id}/commit`,
        { method: "POST", body: { project_id: projectId } },
      );
      setJobb(svar);
    } finally {
      setSkriver(false);
    }
  }, [jobb, projectId]);

  const steg = stegFor(jobb);

  return (
    <Stack spacing={3}>
      <Stepper activeStep={steg} alternativeLabel>
        {STEG.map((navn) => (
          <Step key={navn}><StepLabel>{navn}</StepLabel></Step>
        ))}
      </Stepper>

      {!jobb && (
        <NøkkelSteg
          nøkkel={nøkkel}
          setNøkkel={setNøkkel}
          onStart={start}
          starter={starter}
          feil={startfeil}
          projectName={projectName}
        />
      )}

      {jobb && ["sjekker", "henter", "planlegger"].includes(jobb.fase) && (
        <HenterSteg jobb={jobb} />
      )}

      {jobb?.fase === "klar" && jobb.plan && (
        <SeOverSteg
          jobb={jobb}
          projectName={projectName}
          onBekreft={bekreft}
          skriver={skriver}
        />
      )}

      {jobb?.fase === "skriver" && (
        <Stack spacing={2}>
          <LinearProgress />
          <Typography variant="body2">
            Skriver til Leadgrid. Ikke lukk vinduet.
          </Typography>
        </Stack>
      )}

      {jobb?.fase === "ferdig" && jobb.resultat && (
        <FerdigSteg resultat={jobb.resultat} projectName={projectName} />
      )}

      {jobb?.fase === "feilet" && jobb.feil && (
        <FeilSteg feil={jobb.feil} onPrøvIgjen={() => setJobb(null)} />
      )}
    </Stack>
  );
}

function NøkkelSteg({
  nøkkel, setNøkkel, onStart, starter, feil, projectName,
}: {
  nøkkel: string;
  setNøkkel: (v: string) => void;
  onStart: () => void;
  starter: boolean;
  feil: string | null;
  projectName: string;
}) {
  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Migrer fra HubSpot til Leadgrid
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Vi henter bedrifter, kontakter, avtaler, produkter og ordrelinjer.
          Du får se nøyaktig hva som kommer inn før noe lagres, og alt havner
          i kundeprosjektet <strong>{projectName}</strong>.
        </Typography>
      </Box>

      <Alert severity="info" icon={false}>
        <AlertTitle>Slik lager du nøkkelen</AlertTitle>
        <Typography variant="body2" component="div">
          I HubSpot: <strong>Innstillinger → Integrasjoner → Service Keys →
          Create service key</strong>. Huk av disse sju lesetilgangene:
          <Box component="ul" sx={{ pl: 2.5, mt: 1, mb: 1 }}>
            {SCOPES.map((scope) => (
              <li key={scope}>
                <code style={{ fontSize: "0.85em" }}>{scope}</code>
              </li>
            ))}
          </Box>
          Bare lesing — vi skriver aldri til HubSpot.{" "}
          <Link
            href="https://app.hubspot.com/settings/integrations/service-keys"
            target="_blank"
            rel="noopener noreferrer"
          >
            Åpne HubSpot-innstillingene
          </Link>
        </Typography>
      </Alert>

      <TextField
        label="Service Key"
        value={nøkkel}
        onChange={(e) => setNøkkel(e.target.value)}
        type="password"
        fullWidth
        autoComplete="off"
        placeholder="pat-eu1-…"
        helperText="Nøkkelen brukes bare mens vi henter, og lagres ikke. Slett den gjerne i HubSpot når migreringen er ferdig."
      />

      {feil && <Alert severity="error">{feil}</Alert>}

      <Box>
        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          disabled={!nøkkel.trim() || starter}
          endIcon={starter ? <CircularProgress size={16} /> : <ArrowForwardIcon />}
        >
          {starter ? "Starter …" : "Hent fra HubSpot"}
        </Button>
        <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
          Dette lagrer ingenting. Neste steg viser hva som ville blitt overført.
        </Typography>
      </Box>
    </Stack>
  );
}

function HenterSteg({ jobb }: { jobb: JobbStatus }) {
  return (
    <Stack spacing={2}>
      <LinearProgress />
      <Typography variant="body1">{jobb.melding}</Typography>
      {jobb.hentet.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {jobb.hentet.map((rad) => (
            <Chip
              key={rad.navn}
              icon={<CheckCircleIcon />}
              color="success"
              variant="outlined"
              label={`${rad.navn}: ${rad.antall}`}
            />
          ))}
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary">
        Store HubSpot-kontoer tar noen minutter. Vi holder oss under HubSpots
        grenser med vilje, så kontoen deres ikke blir midlertidig stengt.
      </Typography>
    </Stack>
  );
}

function SeOverSteg({
  jobb, projectName, onBekreft, skriver,
}: {
  jobb: JobbStatus;
  projectName: string;
  onBekreft: () => void;
  skriver: boolean;
}) {
  const c = jobb.plan!.counts;
  const stilleTap = jobb.plan!.issues.filter((i) => i.silentLoss);
  const notiser = jobb.plan!.issues.filter((i) => !i.silentLoss);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" gutterBottom>Dette blir overført</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip color="primary" label={`${c.customers} bedrifter`} />
          <Chip color="primary" label={`${c.deals} avtaler`} />
          <Chip color="primary" label={`${c.contacts} kontakter`} />
          {c.products > 0 && <Chip label={`${c.products} produkter`} />}
          {c.lineItems > 0 && <Chip label={`${c.lineItems} ordrelinjer`} />}
        </Stack>
      </Box>

      {c.merged > 0 && (
        <Alert severity="info">
          <AlertTitle>{c.merged} slås sammen med bedrifter du alt har</AlertTitle>
          Vi matcher på e-postadresse, så du ikke får dubletter i {projectName}.
        </Alert>
      )}

      {jobb.advarsler.map((advarsel) => (
        <Alert severity="warning" key={advarsel}>{advarsel}</Alert>
      ))}

      {stilleTap.length > 0 && (
        <Alert severity="warning">
          <AlertTitle>{stilleTap.length} ting kommer ikke med</AlertTitle>
          <List dense disablePadding>
            {stilleTap.slice(0, 5).map((i, n) => (
              <ListItem key={`${i.code}-${n}`} disablePadding>
                <ListItemText primary={i.message} />
              </ListItem>
            ))}
          </List>
          {stilleTap.length > 5 && (
            <Typography variant="caption">
              … og {stilleTap.length - 5} til av samme type.
            </Typography>
          )}
        </Alert>
      )}

      {notiser.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {notiser.length} mindre avvik er notert og påvirker ikke innholdet.
        </Typography>
      )}

      <Box>
        <Typography variant="subtitle2" gutterBottom>
          De første bedriftene
        </Typography>
        <List dense>
          {jobb.plan!.eksempler.map((e) => (
            <ListItem key={e.name} disablePadding>
              <ListItemText
                primary={e.name}
                secondary={[e.stage, e.email].filter(Boolean).join(" · ")}
              />
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider />

      <Box>
        <Button
          variant="contained"
          size="large"
          onClick={onBekreft}
          disabled={skriver}
          endIcon={skriver ? <CircularProgress size={16} /> : undefined}
        >
          {skriver
            ? "Skriver …"
            : `Overfør ${c.customers} bedrifter til ${projectName}`}
        </Button>
        <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
          Ingenting er skrevet ennå. Kjører du migreringen på nytt senere, blir
          de samme radene oppdatert — ikke duplisert.
        </Typography>
      </Box>
    </Stack>
  );
}

function FerdigSteg({
  resultat, projectName,
}: {
  resultat: NonNullable<JobbStatus["resultat"]>;
  projectName: string;
}) {
  return (
    <Stack spacing={2}>
      <Alert severity="success" icon={<CheckCircleIcon />}>
        <AlertTitle>Migreringen er ferdig</AlertTitle>
        {resultat.customers} bedrifter, {resultat.deals} avtaler og{" "}
        {resultat.contacts} kontakter ligger nå i {projectName}.
        {resultat.updated > 0 && ` ${resultat.updated} fantes fra før og ble oppdatert.`}
      </Alert>
      <Typography variant="body2" color="text.secondary">
        Slett gjerne Service Key-en i HubSpot nå — den trengs ikke lenger.
      </Typography>
      <Box>
        <Button variant="outlined" href="/leadgrid/leads">
          Se leadene
        </Button>
      </Box>
    </Stack>
  );
}

function FeilSteg({
  feil, onPrøvIgjen,
}: {
  feil: NonNullable<JobbStatus["feil"]>;
  onPrøvIgjen: () => void;
}) {
  return (
    <Stack spacing={2}>
      <Alert severity="error">
        <AlertTitle>Migreringen stoppet</AlertTitle>
        {feil.melding}
        {feil.manglendeScopes && feil.manglendeScopes.length > 0 && (
          <Box component="ul" sx={{ pl: 2.5, mt: 1 }}>
            {feil.manglendeScopes.map((m) => (
              <li key={m.scope}>
                <code style={{ fontSize: "0.85em" }}>{m.scope}</code> — {m.navn}
              </li>
            ))}
          </Box>
        )}
      </Alert>
      <Typography variant="body2" color="text.secondary">
        Ingenting ble skrevet til Leadgrid.
      </Typography>
      <Box>
        <Button variant="contained" onClick={onPrøvIgjen}>
          Prøv igjen
        </Button>
      </Box>
    </Stack>
  );
}
