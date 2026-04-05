import React from 'react';
import { useTheming } from '../utils/theming-helper';
import {
  Box,
  Container,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  Button,
  Chip,
  Stack,
} from '@mui/material';
import {
  Gavel,
  Security,
  ContactMail,
  CheckCircle,
  Info,
  Warning,
  CreditCard,
  Cancel,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import PublicSocialLinks from '@/components/common/PublicSocialLinks';
import { getPublicSocialProfiles, PUBLIC_BRAND_LINKS } from '@/lib/publicBrandLinks';

const creatorhubSocialLinks = getPublicSocialProfiles('creatorhub');

const TermsAndConditions: React.FC = () => {
  const [, setLocation] = useLocation();
  const theming = useTheming('photographer');

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          linear-gradient(135deg, #fff5e6 0%, #ffedd5 25%, #fed7aa 50%, #fdba74 75%, #f59e0b 100%),
          radial-gradient(circle at 20% 80%, rgba(255,140,0,0.3) 0%, transparent 50%)
        `,
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Paper
          elevation={3}
          sx={{
            p: 4,
            mb: 4,
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            ...theming.getThemedCardSx(),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 3,
              }}
            >
              <Gavel sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#1f2937', ...theming.colors }}>
                Vilkår og Betingelser
              </Typography>
              <Typography variant="body1" sx={{ color: '#6b7280', mt: 1 }}>
                CreatorHub Norge - Sist oppdatert: 9. januar 2025
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              icon={<Gavel />}
              label="Juridisk bindende"
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<Security />}
              label="Norsk lovgivning"
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<Info />}
              label="Forbrukerrettigheter"
              color="info"
              variant="outlined"
            />
          </Stack>
        </Paper>

        {/* Content */}
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: '16px',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            ...theming.getThemedCardSx(),
          }}
        >
          {/* Introduction */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              Velkommen til CreatorHub Norge. Ved å bruke vår plattform aksepterer du disse vilkårene og betingelsene
              i sin helhet. Hvis du ikke er enig i disse vilkårene, må du ikke bruke tjenesten.
            </Typography>
            <Paper sx={{ p: 3, backgroundColor: '#fff3e0', border: '1px solid #ff8c00' }}>
              <Typography variant="body2" sx={{ color: '#374151' }}>
                <strong>⚠️ Viktig:</strong> Disse vilkårene utgjør en juridisk bindende avtale mellom deg og QAZI FOTOREEL
                (org.nr. 833038222). Les nøye gjennom før du bruker tjenesten.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 1 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              1. Definisjoner
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Tjenesten"
                  secondary="CreatorHub Norge plattformen, inkludert alle funksjoner, verktøy og innhold tilgjengelig via creatorhubn.com"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Bruker"
                  secondary="Enhver person eller juridisk enhet som registrerer seg og bruker Tjenesten"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Innhold"
                  secondary="Alle data, bilder, videoer, tekst, filer og annet materiale lastet opp av Brukeren"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Abonnement"
                  secondary="Betalt tilgang til Tjenesten med ulike funksjonsnivåer (Basic, Pro, Enterprise)"
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Vi/Oss"
                  secondary="QAZI FOTOREEL, organisasjonsnummer 833038222"
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 2 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              2. Aksept av vilkår
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              Ved å opprette en konto, bruke Tjenesten eller klikke "Jeg aksepterer" bekrefter du at:
            </Typography>
            <List>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Du er minst 18 år gammel eller har samtykke fra foresatte" />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Du har lest og forstått disse vilkårene" />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Du har juridisk kapasitet til å inngå bindende avtaler" />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Du vil overholde alle gjeldende lover og forskrifter" />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Informasjonen du oppgir er korrekt og oppdatert" />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 3 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              3. Brukerregistrering og konto
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              For å bruke Tjenesten må du opprette en konto:
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="3.1 Kontoinformasjon"
                  secondary="Du må oppgi korrekt og fullstendig informasjon ved registrering, inkludert navn, e-post, telefonnummer og profesjon."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="3.2 Kontosikkerhet"
                  secondary="Du er ansvarlig for å holde ditt passord hemmelig og for all aktivitet som skjer under din konto. Varsle oss umiddelbart ved mistanke om uautorisert tilgang."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="3.3 Én konto per bruker"
                  secondary="Du kan kun ha én aktiv konto. Opprettelse av flere kontoer for å omgå begrensninger er forbudt."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="3.4 Bedriftskontoer"
                  secondary="Hvis du registrerer deg på vegne av en bedrift, bekrefter du at du har fullmakt til å binde bedriften til disse vilkårene."
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 4 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              4. Abonnement og betaling
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              CreatorHub Norge tilbyr ulike abonnementsnivåer:
            </Typography>
            <List>
              <ListItem>
                <CreditCard sx={{ color: '#ff8c00', mr: 2 }} />
                <ListItemText
                  primary="4.1 Abonnementstyper"
                  secondary="Basic (299 NOK/mnd), Pro (599 NOK/mnd), Enterprise (999 NOK/mnd). Alle priser er oppgitt inkludert MVA."
                />
              </ListItem>
              <ListItem>
                <CreditCard sx={{ color: '#ff8c00', mr: 2 }} />
                <ListItemText
                  primary="4.2 Gratis prøveperiode"
                  secondary="Nye brukere får 14 dagers gratis prøveperiode. Ingen kredittkort kreves for prøveperioden. Du kan avbryte når som helst før prøveperioden utløper uten kostnad."
                />
              </ListItem>
              <ListItem>
                <CreditCard sx={{ color: '#ff8c00', mr: 2 }} />
                <ListItemText
                  primary="4.3 Automatisk fornyelse"
                  secondary="Abonnementet fornyes automatisk hver måned med mindre du avbryter før neste faktureringsdato. Du vil motta varsel 7 dager før fornyelse."
                />
              </ListItem>
              <ListItem>
                <CreditCard sx={{ color: '#ff8c00', mr: 2 }} />
                <ListItemText
                  primary="4.4 Betalingsmetoder"
                  secondary="Vi aksepterer betalingskort (Visa, Mastercard) via Stripe og Google Pay. All betalingsinformasjon krypteres og håndteres sikkert."
                />
              </ListItem>
              <ListItem>
                <CreditCard sx={{ color: '#ff8c00', mr: 2 }} />
                <ListItemText
                  primary="4.5 Prisendringer"
                  secondary="Vi forbeholder oss retten til å endre priser med 30 dagers varsel. Eksisterende abonnenter beholder sin pris til neste fornyelse."
                />
              </ListItem>
              <ListItem>
                <CreditCard sx={{ color: '#ff8c00', mr: 2 }} />
                <ListItemText
                  primary="4.6 Faktura og kvittering"
                  secondary="Du mottar automatisk faktura/kvittering via e-post etter hver betaling. Fakturaer er tilgjengelige i din konto under 'Fakturering'."
                />
              </ListItem>
            </List>
            <Paper sx={{ p: 2, mt: 2, backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
              <Typography variant="body2" sx={{ color: '#1565c0', fontWeight: 'bold' }}>
                💳 Mislykket betaling:
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151', mt: 1 }}>
                Ved mislykket betaling vil vi forsøke å trekke beløpet 3 ganger over 7 dager. Hvis betalingen fortsatt
                mislykkes, vil kontoen din bli suspendert inntil betalingen er gjennomført.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 5 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              5. Oppsigelse og refusjon
            </Typography>
            <List>
              <ListItem>
                <Cancel sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText
                  primary="5.1 Oppsigelse av abonnement"
                  secondary="Du kan når som helst si opp abonnementet via 'Innstillinger' > 'Fakturering'. Oppsigelsen trer i kraft ved neste faktureringsdato."
                />
              </ListItem>
              <ListItem>
                <Cancel sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText
                  primary="5.2 Tilgang etter oppsigelse"
                  secondary="Du beholder tilgang til Tjenesten til slutten av den betalte perioden. Etter dette vil kontoen din bli nedgradert til gratis nivå (hvis tilgjengelig) eller deaktivert."
                />
              </ListItem>
              <ListItem>
                <Cancel sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText
                  primary="5.3 Refusjonspolicy"
                  secondary="I henhold til norsk angrerett har du 14 dagers angrerett fra kjøpsdato. Refusjon gis ikke for allerede brukte perioder. Kontakt hello@creatorhubn.com for refusjon."
                />
              </ListItem>
              <ListItem>
                <Cancel sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText
                  primary="5.4 Vår rett til oppsigelse"
                  secondary="Vi kan suspendere eller avslutte din konto ved brudd på disse vilkårene, mistenkelig aktivitet, eller ved misbruk av Tjenesten. Du vil motta varsel via e-post."
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 6 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              6. Bruk av tjenesten
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              Du forplikter deg til å bruke Tjenesten på en ansvarlig og lovlig måte:
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f2937', mt: 3, mb: 2 }}>
              ✅ Tillatt bruk:
            </Typography>
            <List>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Administrere dine kreative prosjekter og klienter" />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Laste opp og dele ditt eget innhold" />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Samarbeide med andre brukere" />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText primary="Bruke integrasjoner (Google Workspace, etc.)" />
              </ListItem>
            </List>

            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#d32f2f', mt: 3, mb: 2 }}>
              ❌ Forbudt bruk:
            </Typography>
            <List>
              <ListItem>
                <Warning sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText primary="Laste opp ulovlig, støtende eller opphavsrettsbeskyttet innhold" />
              </ListItem>
              <ListItem>
                <Warning sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText primary="Hacke, reverse-engineere eller forsøke å omgå sikkerhetstiltak" />
              </ListItem>
              <ListItem>
                <Warning sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText primary="Bruke automatiserte verktøy (bots, scrapers) uten tillatelse" />
              </ListItem>
              <ListItem>
                <Warning sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText primary="Dele kontoinformasjon eller la andre bruke din konto" />
              </ListItem>
              <ListItem>
                <Warning sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText primary="Sende spam, phishing eller skadelig programvare" />
              </ListItem>
              <ListItem>
                <Warning sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText primary="Trakassere, mobbe eller true andre brukere" />
              </ListItem>
              <ListItem>
                <Warning sx={{ color: '#f44336', mr: 2 }} />
                <ListItemText primary="Bruke Tjenesten til kommersielle formål utover din profesjonelle virksomhet" />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 7 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              7. Innhold og opphavsrett
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="7.1 Ditt innhold"
                  secondary="Du beholder alle rettigheter til innholdet du laster opp. Ved å laste opp innhold gir du oss en begrenset lisens til å lagre, vise og behandle innholdet for å levere Tjenesten."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="7.2 Ansvar for innhold"
                  secondary="Du er alene ansvarlig for innholdet du laster opp. Du garanterer at du har nødvendige rettigheter og tillatelser for alt innhold."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="7.3 Vårt innhold"
                  secondary="Tjenesten, inkludert design, logo, kode og funksjonalitet, er beskyttet av opphavsrett og tilhører QAZI FOTOREEL. Du får kun en begrenset, ikke-eksklusiv lisens til å bruke Tjenesten."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="7.4 Fjerning av innhold"
                  secondary="Vi forbeholder oss retten til å fjerne innhold som bryter med disse vilkårene, norsk lov, eller som vi anser som upassende."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="7.5 Backup og tap av data"
                  secondary="Vi tar regelmessige backups, men du er ansvarlig for å ta egne sikkerhetskopier av viktig innhold. Vi er ikke ansvarlige for tap av data."
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 8 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              8. Ansvarsbegrensning
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              I den grad det er tillatt under norsk lov:
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="8.1 Tjenesten leveres 'som den er'"
                  secondary="Vi garanterer ikke at Tjenesten vil være feilfri, uavbrutt eller sikker til enhver tid."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="8.2 Ingen garanti for resultater"
                  secondary="Vi garanterer ikke spesifikke resultater fra bruk av Tjenesten (f.eks. økt inntekt, flere klienter)."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="8.3 Begrensning av erstatningsansvar"
                  secondary="Vårt totale ansvar overfor deg er begrenset til beløpet du har betalt for Tjenesten de siste 12 månedene."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="8.4 Indirekte tap"
                  secondary="Vi er ikke ansvarlige for indirekte tap, tapt fortjeneste, tap av data eller andre konsekvenstap."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="8.5 Tredjepartstjenester"
                  secondary="Vi er ikke ansvarlige for tjenester levert av tredjeparter (Google Workspace, Stripe, etc.)."
                />
              </ListItem>
            </List>
            <Paper sx={{ p: 2, mt: 2, backgroundColor: '#fff3e0', border: '1px solid #ff8c00' }}>
              <Typography variant="body2" sx={{ color: '#374151' }}>
                <strong>⚖️ Forbrukerrettigheter:</strong> Denne ansvarsbegrensningen påvirker ikke dine lovfestede
                rettigheter som forbruker under norsk lov, inkludert reklamasjonsrett ved mangler.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 9 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              9. Personvern og GDPR
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              Din bruk av Tjenesten er også underlagt vår{', '}
              <Button
                variant="text"
                sx={{ textTransform: 'none', color: '#ff8c00', p: 0, minWidth: 'auto', fontWeight: 'bold' }}
                onClick={() => setLocation('/privacy-policy')}
              >
                Personvernerklæring
              </Button>
              , som beskriver hvordan vi samler inn, bruker og beskytter dine personopplysninger i henhold til GDPR
              og norsk personvernlovgivning.
            </Typography>
            <Paper sx={{ p: 3, backgroundColor: '#e8f5e9', border: '1px solid #4caf50' }}>
              <Typography variant="body2" sx={{ color: '#374151' }}>
                Vi tar personvern på alvor og overholder alle krav i GDPR. Du har rett til innsyn, retting, sletting
                og portabilitet av dine data. Kontakt hello@creatorhubn.com for å utøve dine rettigheter.
              </Typography>
            </Paper>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 10 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              10. Endringer i vilkårene
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              Vi kan oppdatere disse vilkårene fra tid til annen:
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="10.1 Varsling om endringer"
                  secondary="Ved vesentlige endringer vil vi varsle deg via e-post minst 30 dager før endringene trer i kraft."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="10.2 Mindre endringer"
                  secondary="Mindre endringer (f.eks. grammatikk, formatering) kan gjøres uten varsel. Sist oppdatert-dato vil alltid vises øverst."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="10.3 Fortsatt bruk"
                  secondary="Ved å fortsette å bruke Tjenesten etter at endringene trer i kraft, aksepterer du de nye vilkårene."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="10.4 Rett til å avvise"
                  secondary="Hvis du ikke aksepterer de nye vilkårene, kan du si opp abonnementet før endringene trer i kraft."
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 11 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              11. Tvisteløsning og lovvalg
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="11.1 Lovvalg"
                  secondary="Disse vilkårene er underlagt norsk lov og skal tolkes i samsvar med denne."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="11.2 Verneting"
                  secondary="Eventuelle tvister skal løses ved Oslo tingrett, med mindre du som forbruker velger ditt lokale tingrett."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="11.3 Forbrukertvistutvalget"
                  secondary="Som forbruker kan du bringe tvisten inn for Forbrukertvistutvalget (www.forbrukertvistutvalget.no) for mekling."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="11.4 Kontakt oss først"
                  secondary="Vi oppfordrer deg til å kontakte oss først ved eventuelle problemer eller tvister. Vi vil gjøre vårt beste for å løse saken på en god måte."
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 12 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              12. Diverse bestemmelser
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="12.1 Hele avtalen"
                  secondary="Disse vilkårene, sammen med Personvernerklæringen, utgjør hele avtalen mellom deg og oss."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="12.2 Overdragelse"
                  secondary="Du kan ikke overføre dine rettigheter eller plikter under disse vilkårene uten vårt skriftlige samtykke. Vi kan overføre våre rettigheter til en tredjepart."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="12.3 Delbarhet"
                  secondary="Hvis noen bestemmelse i disse vilkårene anses ugyldig, skal de øvrige bestemmelsene fortsatt gjelde."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="12.4 Ingen fraskrivelse"
                  secondary="Vår manglende håndhevelse av noen bestemmelse skal ikke anses som en fraskrivelse av den bestemmelsen."
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="12.5 Force majeure"
                  secondary="Vi er ikke ansvarlige for forsinkelser eller manglende oppfyllelse forårsaket av omstendigheter utenfor vår kontroll (naturkatastrofer, krig, strømbrudd, etc.)."
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Contact Section */}
          <Paper
            sx={{
              p: 3,
              backgroundColor: '#fff8e6',
              border: '2px solid #ff8c00',
              borderRadius: '12px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <ContactMail sx={{ fontSize: 32, color: '#ff8c00', mr: 2 }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                Har du spørsmål om vilkårene?
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: '#374151', mb: 2 }}>
              Vi er her for å hjelpe deg med alle spørsmål om våre vilkår og betingelser.
            </Typography>
            <Paper sx={{ p: 2, mb: 2, backgroundColor: 'white' }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                QAZI FOTOREEL
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151' }}>
                Organisasjonsnummer: 833038222
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151' }}>
                E-post: hello@creatorhubn.com
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151' }}>
                Telefon: +47 97 95 92 94
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151' }}>
                Adresse: Søsterveien 11, 1474 LØRENSKOG
              </Typography>
            </Paper>
            <PublicSocialLinks
              label="Følg CreatorHub"
              body="Offentlige kanaler for oppdateringer om plattform, produkter og community."
              links={creatorhubSocialLinks}
              tone="legal"
              sx={{ my: 2.2 }}
              showTopDivider
            />
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                startIcon={<ContactMail />}
                href={`mailto:${PUBLIC_BRAND_LINKS.creatorhub.email}`}
                sx={{
                  ...theming.getThemedButtonSx(),
                  background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
                }}
              >
                Kontakt support
              </Button>
              <Button variant="outlined" onClick={() => setLocation('/')}>
                Tilbake til forsiden
              </Button>
            </Stack>
          </Paper>

          {/* Version Info */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#6b7280', fontStyle: 'italic' }}>
              Versjon 1.0 - Sist oppdatert: 09. oktober 2025
            </Typography>
            <Typography variant="caption" sx={{ color: '#9ca3af', display: 'block', mt: 1 }}>
              Disse vilkårene er utarbeidet i samsvar med norsk lov, GDPR og forbrukerkjøpsloven.
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default TermsAndConditions;
