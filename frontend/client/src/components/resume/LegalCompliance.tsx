/**
 * Legal Compliance Components
 * GDPR, WCAG, Terms & Conditions, Privacy Policy
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Alert,
  Divider,
  Stack,
  Link,
  Paper,
  Container,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PrivacyTip as PrivacyIcon,
  Gavel as GavelIcon,
  Cookie as CookieIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

// ============================================================================
// TERMS & CONDITIONS
// ============================================================================

export const TermsAndConditionsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
}> = ({ open, onClose, onAccept }) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle id="terms-title">Vilkår for Bruk - CreatorHub Norge</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            1. Aksept av Vilkår
          </Typography>
          <Typography variant="body2" paragraph>
            Ved å bruke CreatorHub Norge CV-builder ("Tjenesten"), godtar du disse vilkårene fullt ut. 
            Hvis du ikke er enig i disse vilkårene, vennligst bruk ikke Tjenesten.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            2. Bruk av Tjenesten
          </Typography>
          <Typography variant="body2" paragraph>
            Du godtar å bruke Tjenesten kun for lovlige formål og på en måte som ikke:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ ml: 2 }} paragraph>
            <li>Krenkler rettighetene til andre personer</li>
            <li>Inneholder malware, virus eller skadelig kode</li>
            <li>Gjør uautorisert tilgang til systemene våre</li>
            <li>Forstyrrer normal drift av Tjenesten</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            3. Brukerinnhold
          </Typography>
          <Typography variant="body2" paragraph>
            Du er ansvarlig for alt innhold du laster opp. Du garanterer at du har alle nødvendige 
            rettigheter til innholdet og at det ikke krenkler opphavsretten eller andre rettigheter.
            Du beholder all eiendomsrett til ditt innhold, men gir oss lisensen til å lagre og behandle 
            det for å levere Tjenesten.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            4. Intellektuell Eiendom
          </Typography>
          <Typography variant="body2" paragraph>
            CreatorHub Norge, inkludert alle originale innhold, funksjoner og funksjonalitet, 
            er eiendom av CreatorHub og er beskyttet av opphavsrett og andre lover.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            5. Ansvarsfraskrivelse
          </Typography>
          <Typography variant="body2" paragraph>
            Tjenesten leveres "som den er". Vi gir ingen garantier, verken eksplisitte eller implisitte. 
            Vi fraskriver oss ansvaret for tap av data, inntekter eller annen indirekte skade.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            6. Ansvarsbegrensning
          </Typography>
          <Typography variant="body2" paragraph>
            I intet tilfelle skal CreatorHub være ansvarlig for skader som overstiger beløpet du har 
            betalt for Tjenesten (hvis noen).
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            7. Endringer av Vilkår
          </Typography>
          <Typography variant="body2" paragraph>
            Vi forbeholder oss retten til å endre disse vilkårene når som helst. Fortsatt bruk av 
            Tjenesten etter endringer utgjør aksept av nye vilkår.
          </Typography>

          <Divider sx={{ my: 2 }} />
          <FormControlLabel
            control={<Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />}
            label="Jeg godtar vilkårene for bruk"
            aria-label="Godta vilkår for bruk"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="contained"
          onClick={onAccept}
          disabled={!accepted}
          aria-label="Godta vilkår og fortsett"
        >
          Godta og Fortsett
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// PRIVACY POLICY
// ============================================================================

export const PrivacyPolicyDialog: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle id="privacy-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrivacyIcon />
          Personvernerklæring - CreatorHub Norge
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            1. Innledning
          </Typography>
          <Typography variant="body2" paragraph>
            CreatorHub Norge ("vi", "oss") er forpliktet til å beskytte ditt personvern. 
            Denne erklæringen forklarer hvordan vi samler inn, bruker og beskytter dine personlige opplysninger 
            i samsvar med GDPR (REGULATION (EU) 2016/679).
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            2. Databehandler
          </Typography>
          <Typography variant="body2" paragraph>
            <strong>Navn:</strong> CreatorHub Norge AS<br />
            <strong>Epostadresse:</strong> privacy@creatorhubnorge.no<br />
            <strong>Adresse:</strong> [Selskapsadresse]
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            3. Hva slags data samler vi inn?
          </Typography>
          <Typography variant="body2" paragraph>
            Vi samler inn følgende personlige opplysninger:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ ml: 2 }} paragraph>
            <li><strong>Kontoinformasjon:</strong> Navn, e-postadresse, passordhash</li>
            <li><strong>Profil:</strong> Telefon, adresse, LinkedIn/GitHub profiler</li>
            <li><strong>CV-data:</strong> Arbeidserfaringer, utdanning, ferdigheter, prosjekter</li>
            <li><strong>Jobbsøkingsdata:</strong> Jobbapplikasjoner, frister, intervjuer</li>
            <li><strong>Bruksdata:</strong> IP-adresse, enhetsinformasjon, bruksmønstre</li>
            <li><strong>Cookies:</strong> For sessjon og preferanser</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            4. Juridisk Grunnlag
          </Typography>
          <Typography variant="body2" paragraph>
            Vi behandler dine personlige opplysninger basert på:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ ml: 2 }} paragraph>
            <li>Ditt samtykke (f.eks. ved registrering)</li>
            <li>Oppfyllelse av kontrakt (levering av Tjenesten)</li>
            <li>Oppfyllelse av juridiske forpliktelser</li>
            <li>Våre legitime interesser</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            5. Deling av Data
          </Typography>
          <Typography variant="body2" paragraph>
            Vi deler dine data med:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ ml: 2 }} paragraph>
            <li><strong>Tjenesteleverandører:</strong> Hosting, sikkerhet, analyse</li>
            <li><strong>Offentlige myndigheter:</strong> Når lovpålagt</li>
            <li><strong>Andre brukere:</strong> Kun hvis du deler CV offentlig</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            6. Dine Rettigheter
          </Typography>
          <Typography variant="body2" paragraph>
            Du har rett til:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ ml: 2 }} paragraph>
            <li>Tilgang til dine personlige opplysninger</li>
            <li>Retting av unøyaktige data</li>
            <li>Sletting av dine data ("retten til å bli glemt")</li>
            <li>Begrensning av behandling</li>
            <li>Dataportabilitet (få data i strukturert format)</li>
            <li>Innsigelserett</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            7. Datalagring
          </Typography>
          <Typography variant="body2" paragraph>
            Vi lagrer dine data så lenge som nødvendig for:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ ml: 2 }} paragraph>
            <li>Tjenestens drift (aktivt brukerinnhold)</li>
            <li>Oppfyllelse av juridiske forpliktelser (minimum 5 år)</li>
            <li>Løsning av tvister (inntil foreldelsesfristen utløper)</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            8. Sikkerhet
          </Typography>
          <Typography variant="body2" paragraph>
            Vi bruker moderne sikkerhetstiltak inkludert:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ ml: 2 }} paragraph>
            <li>SSL/TLS kryptering av data i transit</li>
            <li>Kryptering av følsomme data ved lagring</li>
            <li>Regelmessige sikkerhetsvurderinger</li>
            <li>Minimering av data</li>
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            9. Endringer
          </Typography>
          <Typography variant="body2" paragraph>
            Vi kan oppdatere denne personvernerklæringen. Vi vil varsle deg om vesentlige endringer.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            10. Kontakt
          </Typography>
          <Typography variant="body2" paragraph>
            Har du spørsmål om dine data, kontakt: privacy@creatorhubnorge.no
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Lukk
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// COOKIE CONSENT
// ============================================================================

export const CookieConsentDialog: React.FC<{
  open: boolean;
  onConsent: () => void;
  onReject: () => void;
}> = ({ open, onConsent, onReject }) => {
  return (
    <Dialog open={open} onClose={() => {}} maxWidth="sm" fullWidth>
      <DialogTitle id="cookie-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CookieIcon />
          Informasjon om Cookies
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Vi bruker cookies for å forbedre brukeropplevelsen og analysere trafikk.
          </Alert>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="essential-content" id="essential-header">
              <Typography variant="subtitle2">Essensielle Cookies</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Nødvendig for grunnleggende funksjonalitet som autentisering og sesjonshåndtering. 
                Disse kan ikke slås av.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="analytics-content" id="analytics-header">
              <Typography variant="subtitle2">Analytics Cookies</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Brukes til å forstå hvordan du bruker siden. Hjelper oss å forbedre Tjenesten. 
                Du kan velge å ikke akseptere disse.
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="marketing-content" id="marketing-header">
              <Typography variant="subtitle2">Marketing Cookies</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2">
                Brukes for personlig annonsering. Du kan velge å ikke akseptere disse.
              </Typography>
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onReject} aria-label="Avvis alle cookies">
          Avvis
        </Button>
        <Button onClick={onConsent} variant="contained" aria-label="Aksepter alle cookies">
          Aksepter Alt
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// DATA MANAGEMENT (GDPR Rights)
// ============================================================================

export const DataManagementDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onExportData: () => void;
  onDeleteData: () => void;
}> = ({ open, onClose, onExportData, onDeleteData }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle id="data-management-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GavelIcon />
          Dine Data
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Disse handlingene er permanente og kan ikke angres.
          </Alert>

          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: 'info.light' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DownloadIcon fontSize="small" />
                Eksporter Dine Data
              </Typography>
              <Typography variant="body2" paragraph>
                Last ned alle dine personlige data i JSON-format (GDPR-rettighet til dataportabilitet).
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={onExportData}
                fullWidth
                aria-label="Eksporter alle mine data"
              >
                Eksporter Data
              </Button>
            </Paper>

            <Paper sx={{ p: 2, bgcolor: 'error.light' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DeleteIcon fontSize="small" />
                Slett Kontoen Din Permanent
              </Typography>
              <Typography variant="body2" paragraph>
                Dette sletter all data knyttet til din konto (GDPR-rettighet til sletting). 
                Denne handlingen kan ikke reverseres.
              </Typography>
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={onDeleteData}
                fullWidth
                aria-label="Slett min konto permanent"
              >
                Slett Konto Permanent
              </Button>
            </Paper>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// WCAG COMPLIANCE NOTICE
// ============================================================================

export const AccessibilityNotice: React.FC = () => {
  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
      role="region"
      aria-label="Tilgjengelighetsinformasjon"
    >
      <Typography variant="subtitle2" gutterBottom>
        Tilgjengelighet
      </Typography>
      <Typography variant="body2" paragraph>
        CreatorHub Norge er designet for å være tilgjengelig for alle. Vi følger WCAG 2.1 Level AA-standarder.
      </Typography>
      <Typography variant="body2" component="ul" sx={{ ml: 2 }}>
        <li>Fullt tastaturnavigasjon</li>
        <li>Skjermleserkompatibilitet</li>
        <li>Höy kontrastforhold</li>
        <li>Tilgjengeligemeldinger</li>
      </Typography>
      <Typography variant="caption" paragraph sx={{ mt: 1, display: 'block' }}>
        Hvis du møter problemer, kontakt oss:{' '}
        <Link href="mailto:accessibility@creatorhubnorge.no">accessibility@creatorhubnorge.no</Link>
      </Typography>
    </Box>
  );
};
