/**
 * Registrer en bedrift manuelt — ni siffer, og kontoen står klar.
 *
 * Ment for møtet der du sitter hos kunden. Derfor er det ett felt som
 * betyr noe: organisasjonsnummeret. BRREG fyller resten, og du bekrefter
 * at det er riktig bedrift FØR noe opprettes — et org.nr med én tastefeil
 * er et helt annet selskap, og det oppdager du bare hvis navnet vises.
 *
 * Progressiv avdekking: e-postfeltet kommer først når bedriften er bekreftet.
 * Å be om alt på én gang ville gjort skjemaet lengre enn jobben.
 */
import React, { useCallback, useState } from "react";
import {
  Alert, AlertTitle, Box, Button, Chip, CircularProgress, Divider,
  Stack, TextField, Typography,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { apiRequest } from "@/lib/queryClient";

interface BrregFirma {
  name: string;
  orgNr: string;
  naceCode: string | null;
  naceDescription: string | null;
  employees: number | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  website: string | null;
  isBankrupt: boolean;
}

interface Registrering {
  organization: {
    id: string; name: string; org_number: string;
    nace_code: string | null; city: string | null; reused: boolean;
  };
  admin: { id: string; email: string; reused: boolean };
  project: { id: string; name: string };
  trial: { hard_expires_at: string; starts_on_first_discovery: boolean };
}

function sifre(v: string): string {
  return v.replace(/\D/g, "").slice(0, 9);
}

export function ManualCompanyRegistration() {
  const [orgNr, setOrgNr] = useState("");
  const [firma, setFirma] = useState<BrregFirma | null>(null);
  const [slårOpp, setSlårOpp] = useState(false);
  const [epost, setEpost] = useState("");
  const [prosjekt, setProsjekt] = useState("");
  const [oppretter, setOppretter] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<Registrering | null>(null);

  const slåOpp = useCallback(async () => {
    const nr = sifre(orgNr);
    if (nr.length !== 9) {
      setFeil("Organisasjonsnummeret må være ni siffer.");
      return;
    }
    setSlårOpp(true);
    setFeil(null);
    setFirma(null);
    try {
      const svar = (await apiRequest(
        `/api/admin-room/lead-map/company-lookup?q=${nr}`,
      )) as { found: boolean; company?: BrregFirma };
      if (!svar.found || !svar.company) {
        setFeil(`Fant ingen bedrift med organisasjonsnummer ${nr} i Enhetsregisteret.`);
        return;
      }
      setFirma(svar.company);
      if (!prosjekt) setProsjekt(svar.company.name);
    } catch (error) {
      setFeil((error as Error).message || "Oppslaget mot Enhetsregisteret feilet.");
    } finally {
      setSlårOpp(false);
    }
  }, [orgNr, prosjekt]);

  const opprett = useCallback(async () => {
    setOppretter(true);
    setFeil(null);
    try {
      const svar = (await apiRequest("/api/leadgrid/registrering/manuell", {
        method: "POST",
        body: {
          organization_number: sifre(orgNr),
          admin_email: epost.trim(),
          project_name: prosjekt.trim() || undefined,
        },
      })) as Registrering;
      setResultat(svar);
    } catch (error) {
      setFeil((error as Error).message || "Registreringen feilet.");
    } finally {
      setOppretter(false);
    }
  }, [orgNr, epost, prosjekt]);

  if (resultat) {
    return <Ferdig resultat={resultat} onNy={() => {
      setResultat(null); setOrgNr(""); setFirma(null); setEpost(""); setProsjekt("");
    }} />;
  }

  const epostGyldig = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost.trim());

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
      <Box>
        <Typography variant="h6">Registrer bedrift</Typography>
        <Typography variant="body2" color="text.secondary">
          Skriv organisasjonsnummeret. Vi henter resten fra Enhetsregisteret.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label="Organisasjonsnummer"
          value={orgNr}
          onChange={(e) => { setOrgNr(e.target.value); setFirma(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void slåOpp(); }}
          placeholder="986 330 682"
          inputMode="numeric"
          fullWidth
          autoFocus
          helperText="Ni siffer. Mellomrom og punktum går fint."
        />
        <Button
          variant="outlined"
          onClick={slåOpp}
          disabled={sifre(orgNr).length !== 9 || slårOpp}
          sx={{ minHeight: 56, whiteSpace: "nowrap" }}
        >
          {slårOpp ? <CircularProgress size={18} /> : "Slå opp"}
        </Button>
      </Stack>

      {feil && <Alert severity="error">{feil}</Alert>}

      {firma && firma.isBankrupt && (
        <Alert severity="error">
          <AlertTitle>{firma.name} er registrert som konkurs</AlertTitle>
          Sjekk nummeret — dette er nesten alltid en tastefeil.
        </Alert>
      )}

      {firma && !firma.isBankrupt && (
        <>
          <Alert severity="success" icon={<BusinessIcon />}>
            <AlertTitle>{firma.name}</AlertTitle>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {firma.city && <Chip size="small" label={firma.city} />}
              {firma.naceCode && (
                <Chip size="small" label={`${firma.naceCode} ${firma.naceDescription ?? ""}`.trim()} />
              )}
              {firma.employees != null && (
                <Chip size="small" label={`${firma.employees} ansatte`} />
              )}
            </Stack>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Er dette riktig bedrift? Et nummer med én tastefeil er et helt annet selskap.
            </Typography>
          </Alert>

          <TextField
            label="E-post til admin"
            value={epost}
            onChange={(e) => setEpost(e.target.value)}
            type="email"
            fullWidth
            placeholder="fornavn@bedrift.no"
            helperText="Adressen de logger inn med via Google eller LinkedIn. Ingen e-post sendes herfra."
          />

          <TextField
            label="Navn på kundeprosjektet"
            value={prosjekt}
            onChange={(e) => setProsjekt(e.target.value)}
            fullWidth
            helperText="Tomt gir bedriftsnavnet."
          />

          <Divider />

          <Box>
            <Button
              variant="contained"
              size="large"
              onClick={opprett}
              disabled={!epostGyldig || oppretter}
              endIcon={oppretter ? <CircularProgress size={16} /> : undefined}
            >
              {oppretter ? "Oppretter …" : `Opprett ${firma.name}`}
            </Button>
            <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
              Oppretter organisasjon, admin, medlemskap og første kundeprosjekt.
              Prøveperioden starter først når de kjører sitt første søk.
            </Typography>
          </Box>
        </>
      )}
    </Stack>
  );
}

function Ferdig({ resultat, onNy }: { resultat: Registrering; onNy: () => void }) {
  const frist = resultat.trial.hard_expires_at
    ? new Date(resultat.trial.hard_expires_at).toLocaleDateString("nb-NO")
    : null;
  return (
    <Stack spacing={2} sx={{ maxWidth: 560 }}>
      <Alert severity="success" icon={<CheckCircleIcon />}>
        <AlertTitle>{resultat.organization.name} er klar</AlertTitle>
        Kundeprosjektet «{resultat.project.name}» er opprettet, og{" "}
        {resultat.admin.email} er admin.
        {resultat.organization.reused && " Organisasjonen fantes fra før og ble gjenbrukt."}
        {resultat.admin.reused && " Brukeren fantes fra før."}
      </Alert>

      <Alert severity="info">
        <AlertTitle>Slik kommer de inn</AlertTitle>
        De logger inn med Google eller LinkedIn på <strong>{resultat.admin.email}</strong>.
        Ingen e-post er sendt — gjør det mens du sitter sammen med dem.
      </Alert>

      <Typography variant="body2" color="text.secondary">
        Prøveperioden på sju dager starter ved første Discovery-kjøring.
        {frist && ` Uansett utløper tilgangen ${frist} hvis de aldri kommer i gang.`}
      </Typography>

      <Box>
        <Button variant="outlined" onClick={onNy}>Registrer en til</Button>
      </Box>
    </Stack>
  );
}
