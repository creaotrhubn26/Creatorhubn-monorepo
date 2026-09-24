/**
 * Avtalesignering — les, bekreft, signer.
 *
 * Tre avtaler må på plass før tjenesten kan brukes lovlig. De vises én om
 * gangen, med teksten synlig — ikke bak en lenke. En avtale ingen har lest
 * er ikke signert i noen meningsfull forstand, og databehandleravtalen er
 * den kunden faktisk må kunne vise fram hvis Datatilsynet spør.
 *
 * Fakturaopplysningene bekreftes på intensjonsavtalen, fordi det er der
 * kunden uansett leser gjennom og signerer noe. Å be om det i et eget steg
 * ville vært ett skjema for mye.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, AlertTitle, Box,
  Button, Chip, CircularProgress, Divider, Stack, TextField, Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GavelIcon from "@mui/icons-material/Gavel";
import { apiRequest } from "@/lib/queryClient";
import { SignaturFelt, type SignaturStil } from "./Signatur";

interface Dokument {
  type: string;
  title: string;
  version: string;
  summary: string;
  required: boolean;
  confirmsBilling: boolean;
  body: string;
  signed: boolean;
  signed_at: string | null;
  signed_by: string | null;
}

interface Fakturaopplysninger {
  name: string;
  org_number: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  billing_email: string | null;
}

export function AgreementSigning({ projectId }: { projectId: string }) {
  const [dokumenter, setDokumenter] = useState<Dokument[]>([]);
  const [faktura, setFaktura] = useState<Fakturaopplysninger | null>(null);
  const [laster, setLaster] = useState(true);
  const [åpen, setÅpen] = useState<string | false>(false);
  const [navn, setNavn] = useState("");
  const [rolle, setRolle] = useState("");
  const [epost, setEpost] = useState("");
  const [signatur, setSignatur] = useState("");
  const [stil, setStil] = useState<SignaturStil>("flyt");
  const [signerer, setSignerer] = useState<string | null>(null);
  const [kvittering, setKvittering] = useState<string | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const hent = useCallback(async () => {
    setLaster(true);
    try {
      const svar = (await apiRequest(
        `/api/leadgrid/avtaler/dokumenter?project_id=${encodeURIComponent(projectId)}`,
      )) as { documents: Dokument[]; billing: Fakturaopplysninger | null };
      setDokumenter(svar.documents);
      setFaktura(svar.billing);
      const neste = svar.documents.find((d) => d.required && !d.signed);
      setÅpen(neste?.type ?? false);
    } catch (error) {
      setFeil((error as Error).message || "Fikk ikke hentet avtalene.");
    } finally {
      setLaster(false);
    }
  }, [projectId]);

  useEffect(() => { void hent(); }, [hent]);

  const signer = useCallback(async (doc: Dokument) => {
    setSignerer(doc.type);
    setFeil(null);
    try {
      await apiRequest("/api/leadgrid/avtaler/signer", {
        method: "POST",
        body: {
          project_id: projectId,
          agreement_type: doc.type,
          document_version: doc.version,
          document_text: doc.body,
          signer_name: navn.trim(),
          signer_title: rolle.trim() || null,
          signer_email: epost.trim(),
          signature_text: signatur.trim(),
          signature_style: stil,
          confirmed_billing: doc.confirmsBilling && faktura ? faktura : null,
        },
      });
      setKvittering(epost.trim());
      await hent();
    } catch (error) {
      setFeil((error as Error).message || "Signeringen feilet.");
    } finally {
      setSignerer(null);
    }
  }, [projectId, navn, rolle, epost, signatur, stil, faktura, hent]);

  if (laster) return <CircularProgress />;

  const gjenstår = dokumenter.filter((d) => d.required && !d.signed);
  const normaliser = (t: string) => t.trim().replace(/\s+/g, " ").toLowerCase();
  const kanSignere =
    navn.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(epost.trim()) &&
    normaliser(signatur) === normaliser(navn);

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Box>
        <Typography variant="h6" gutterBottom>Avtaler</Typography>
        {gjenstår.length === 0 ? (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            Alle påkrevde avtaler er signert.
          </Alert>
        ) : (
          <Alert severity="warning" icon={<GavelIcon />}>
            <AlertTitle>{gjenstår.length} avtale{gjenstår.length === 1 ? "" : "r"} gjenstår</AlertTitle>
            Databehandleravtalen må være signert før tjenesten tas i bruk — den
            er påkrevd etter personvernforordningen artikkel 28.
          </Alert>
        )}
      </Box>

      {feil && <Alert severity="error">{feil}</Alert>}

      {gjenstår.length > 0 && (
        <Stack spacing={2}>
          <Typography variant="subtitle2">Hvem signerer?</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Fullt navn" value={navn}
              onChange={(e) => {
                // Underskriften følger navnet så lenge kunden ikke har rørt
                // den selv. Å skrive samme navn to ganger er ikke seremoni,
                // det er dobbeltarbeid.
                if (normaliser(signatur) === normaliser(navn)) setSignatur(e.target.value);
                setNavn(e.target.value);
              }} fullWidth
            />
            <TextField
              label="Rolle" value={rolle} placeholder="Daglig leder"
              onChange={(e) => setRolle(e.target.value)} fullWidth
            />
          </Stack>
          <TextField
            label="E-post" type="email" value={epost}
            onChange={(e) => setEpost(e.target.value)} fullWidth
            helperText="Kvitteringen sendes hit, og e-posten lagres sammen med signaturen som bevis på hvem som forpliktet seg."
          />
          <SignaturFelt
            verdi={signatur} onVerdi={setSignatur}
            stil={stil} onStil={setStil}
            forventetNavn={navn}
            låst={signerer !== null}
          />
        </Stack>
      )}

      {kvittering && (
        <Alert severity="success" onClose={() => setKvittering(null)}>
          Signert. Kvittering er sendt til {kvittering}.
        </Alert>
      )}

      {dokumenter.map((doc) => (
        <Accordion
          key={doc.type}
          expanded={åpen === doc.type}
          onChange={() => setÅpen(åpen === doc.type ? false : doc.type)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: "100%" }}>
              <Typography sx={{ fontWeight: 600, flex: 1 }}>{doc.title}</Typography>
              {doc.signed ? (
                <Chip size="small" color="success" icon={<CheckCircleIcon />}
                      label={`Signert av ${doc.signed_by ?? "ukjent"}`} />
              ) : doc.required ? (
                <Chip size="small" color="warning" label="Må signeres" />
              ) : (
                <Chip size="small" variant="outlined" label="Valgfri" />
              )}
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">{doc.summary}</Typography>

              <Box
                sx={{
                  maxHeight: 340, overflowY: "auto", p: 2, borderRadius: 1,
                  bgcolor: "action.hover", fontSize: "0.85rem",
                  whiteSpace: "pre-wrap", fontFamily: "inherit",
                }}
              >
                {doc.body}
              </Box>

              {doc.confirmsBilling && faktura && (
                <Alert severity="info">
                  <AlertTitle>Bekreft opplysningene</AlertTitle>
                  <Typography variant="body2" component="div">
                    {faktura.name}
                    {faktura.org_number && <> · org.nr {faktura.org_number}</>}
                    <br />
                    {[faktura.address_line, faktura.postal_code, faktura.city]
                      .filter(Boolean).join(", ") || "Adresse mangler"}
                    <br />
                    Faktura til: {faktura.billing_email || "ikke satt"}
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    Stemmer dette ikke, si fra før du signerer — det er disse
                    opplysningene fakturaen sendes til.
                  </Typography>
                </Alert>
              )}

              {doc.signed ? (
                <Typography variant="caption" color="text.secondary">
                  Signert {doc.signed_at ? new Date(doc.signed_at).toLocaleString("nb-NO") : ""}
                  {" "}· versjon {doc.version}
                </Typography>
              ) : (
                <Box>
                  <Button
                    variant="contained"
                    onClick={() => void signer(doc)}
                    disabled={!kanSignere || signerer === doc.type}
                    endIcon={signerer === doc.type ? <CircularProgress size={16} /> : undefined}
                  >
                    {signerer === doc.type ? "Signerer …" : `Signer ${doc.title.toLowerCase()}`}
                  </Button>
                  {!kanSignere && (
                    <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                      Fyll inn navn, e-post og underskrift over for å kunne signere.
                    </Typography>
                  )}
                </Box>
              )}
            </Stack>
          </AccordionDetails>
        </Accordion>
      ))}

      <Divider />
      <Typography variant="caption" color="text.secondary">
        Avtalene inngås med Creatorhub AS, org.nr 937 518 684. Signaturen lagrer
        navn, rolle, underskrift, tidspunkt, IP-adresse og en kryptografisk
        sjekksum av den nøyaktige teksten du leste. Kvittering sendes på
        e-post, og avtalen ligger tilgjengelig under «Mine avtaler».
      </Typography>
    </Stack>
  );
}
