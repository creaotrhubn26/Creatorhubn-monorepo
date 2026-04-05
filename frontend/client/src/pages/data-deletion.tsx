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
  Alert,
  Link,
} from '@mui/material';
import {
  DeleteForever,
  Security,
  ContactMail,
  CheckCircle,
  FacebookRounded,
  Info,
  Instagram,
  Warning,
  AccessTime,
} from '@mui/icons-material';
import { useLocation } from 'wouter';

const CREATORHUB_INSTAGRAM_URL = 'https://www.instagram.com/creatorhubn/';
const CREATORHUB_FACEBOOK_URL = 'https://www.facebook.com/creatorhubn/';

const DataDeletion: React.FC = () => {
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
              <DeleteForever sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
                Sletting av brukerdata
              </Typography>
              <Typography variant="body1" sx={{ color: '#6b7280', mt: 1 }}>
                CreatorHub Norge - Data Deletion Instructions
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Chip
              icon={<Security />}
              label="GDPR Compliant"
              color="success"
              variant="outlined"
            />
            <Chip
              icon={<AccessTime />}
              label="30 dagers frist"
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<Info />}
              label="Facebook/Instagram"
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
          {/* Important Notice */}
          <Alert severity="warning" sx={{ mb: 4 }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Viktig informasjon om datasletting
            </Typography>
            <Typography variant="body2">
              Når du sletter din konto vil alle dine personopplysninger og data permanent fjernes fra
              våre systemer innen 30 dager. Denne handlingen kan ikke angres.
            </Typography>
          </Alert>

          {/* Section 1 */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              Hvordan slette dine data fra CreatorHub Norge
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              Du har full kontroll over dine personopplysninger. Det finnes to måter å slette dataene dine:
            </Typography>
          </Box>

          {/* Method 1 */}
          <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f0f9ff', border: '1px solid #0ea5e9' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#0c4a6e', mb: 2 }}>
              Metode 1: Slett fra din profil (Anbefalt)
            </Typography>
            <List>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText
                  primary="Logg inn på CreatorHub Norge"
                  secondary="Gå til creatorhubn.com og logg inn med din konto"
                />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText
                  primary="Gå til Innstillinger"
                  secondary="Klikk på profilbildet ditt og velg 'Innstillinger'"
                />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText
                  primary="Velg 'Konto og personvern'"
                  secondary="Finn seksjonen for kontoinnstillinger"
                />
              </ListItem>
              <ListItem>
                <CheckCircle sx={{ color: '#4caf50', mr: 2 }} />
                <ListItemText
                  primary="Klikk 'Slett min konto', "
                  secondary="Følg instruksjonene for å bekrefte sletting"
                />
              </ListItem>
            </List>
            <Button
              variant="contained"
              color="primary"
              sx={{ mt: 2 }}
              onClick={() => setLocation('/settings')}
            >
              Gå til innstillinger
            </Button>
          </Paper>

          {/* Method 2 */}
          <Paper sx={{ p: 3, mb: 3, backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#78350f', mb: 2 }}>
              Metode 2: Send forespørsel via e-post
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', mb: 2, lineHeight: 1.8 }}>
              Hvis du ikke har tilgang til kontoen din, kan du sende en e-post til oss:
            </Typography>
            <Paper sx={{ p: 3, backgroundColor: '#fff', border: '1px solid #d97706' }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>E-postadresse:</strong>{' '}
                <Link href="mailto:hello@creatorhubn.com" sx={{ color: '#ff8c00' }}>
                  hello@creatorhubn.com
                </Link>
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Emne:</strong> Forespørsel om sletting av brukerdata
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Inkluder følgende informasjon i e-posten:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText primary="• Ditt fulle navn" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• E-postadressen registrert på kontoen" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Eventuell tilknyttet Facebook/Instagram konto" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="• Bekreftelse: 'Jeg ønsker å slette all min data fra CreatorHub Norge'" />
                </ListItem>
              </List>
            </Paper>
          </Paper>

          <Divider sx={{ my: 4 }} />

          {/* Section 2: What data is deleted */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              Hvilke data blir slettet?
            </Typography>
            <Typography variant="body1" sx={{ color: '#374151', lineHeight: 1.8, mb: 2 }}>
              Ved sletting av kontoen din, vil følgende data bli permanent fjernet:
            </Typography>
            <List>
              <ListItem>
                <DeleteForever sx={{ color: '#ef4444', mr: 2 }} />
                <ListItemText
                  primary="Profilinformasjon"
                  secondary="Navn, e-postadresse, telefonnummer, profilbilde"
                />
              </ListItem>
              <ListItem>
                <DeleteForever sx={{ color: '#ef4444', mr: 2 }} />
                <ListItemText
                  primary="Portfolioinnhold"
                  secondary="Alle bilder, videoer og andre filer lastet opp"
                />
              </ListItem>
              <ListItem>
                <DeleteForever sx={{ color: '#ef4444', mr: 2 }} />
                <ListItemText
                  primary="Bedriftsinformasjon"
                  secondary="Organisasjonsnummer, firmanavn og bedriftsdetaljer"
                />
              </ListItem>
              <ListItem>
                <DeleteForever sx={{ color: '#ef4444', mr: 2 }} />
                <ListItemText
                  primary="Aktivitetsdata"
                  secondary="Logghistorikk, søkehistorikk og bruksstatistikk"
                />
              </ListItem>
              <ListItem>
                <DeleteForever sx={{ color: '#ef4444', mr: 2 }} />
                <ListItemText
                  primary="Tilkoblinger til tredjepart"
                  secondary="Facebook, Instagram, Google og andre integrerte kontoer"
                />
              </ListItem>
              <ListItem>
                <DeleteForever sx={{ color: '#ef4444', mr: 2 }} />
                <ListItemText
                  primary="Abonnementsinformasjon"
                  secondary="Betalingshistorikk og abonnementsdetaljer (faktura oppbevares i 5 år iht. regnskapsloven)"
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 3: Timeline */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              Tidsramme for sletting
            </Typography>
            <List>
              <ListItem>
                <AccessTime sx={{ color: '#0ea5e9', mr: 2 }} />
                <ListItemText
                  primary="Umiddelbar deaktivering"
                  secondary="Din konto deaktiveres straks etter bekreftelse"
                />
              </ListItem>
              <ListItem>
                <AccessTime sx={{ color: '#0ea5e9', mr: 2 }} />
                <ListItemText
                  primary="30 dagers angrerett"
                  secondary="Du kan gjenopprette kontoen innen 30 dager ved å logge inn igjen"
                />
              </ListItem>
              <ListItem>
                <AccessTime sx={{ color: '#0ea5e9', mr: 2 }} />
                <ListItemText
                  primary="Permanent sletting etter 30 dager"
                  secondary="All data slettes permanent fra våre systemer etter 30 dager"
                />
              </ListItem>
              <ListItem>
                <AccessTime sx={{ color: '#0ea5e9', mr: 2 }} />
                <ListItemText
                  primary="Bekreftelse via e-post"
                  secondary="Du mottar en bekreftelse når dataene er permanent slettet"
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Section 4: Exceptions */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              Unntak fra sletting
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                I henhold til norsk lov må vi beholde visse data for regnskapsmessige og juridiske formål:
              </Typography>
            </Alert>
            <List>
              <ListItem>
                <Info sx={{ color: '#0ea5e9', mr: 2 }} />
                <ListItemText
                  primary="Fakturaer og betalingsinformasjon"
                  secondary="Oppbevares i 5 år iht. bokføringsloven"
                />
              </ListItem>
              <ListItem>
                <Info sx={{ color: '#0ea5e9', mr: 2 }} />
                <ListItemText
                  primary="Kontrakter og avtaler"
                  secondary="Oppbevares i 3 år iht. foreldelsesloven"
                />
              </ListItem>
              <ListItem>
                <Info sx={{ color: '#0ea5e9', mr: 2 }} />
                <ListItemText
                  primary="Anonymiserte statistikkdata"
                  secondary="Kan brukes til aggregert analyse uten personlig identifikasjon"
                />
              </ListItem>
            </List>
          </Box>

          <Divider sx={{ my: 4 }} />

          {/* Contact Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff8c00', mb: 2 }}>
              Har du spørsmål?
            </Typography>
            <Paper sx={{ p: 3, backgroundColor: '#fff8e6', border: '1px solid #ff8c00' }}>
              <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2 }}>
                Kontakt oss
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151', mb: 1 }}>
                <strong>E-post:</strong>{', '}
                <Link href="mailto:hello@creatorhubn.com" sx={{ color: '#ff8c00' }}>
                  hello@creatorhubn.com
                </Link>
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151', mb: 1 }}>
                <strong>Telefon:</strong> +47 97 95 92 94
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151', mb: 1 }}>
                <strong>Adresse:</strong> Søsterveien 11, 1474 LØRENSKOG
              </Typography>
              <Typography variant="body2" sx={{ color: '#374151', mt: 2 }}>
                Vi svarer normalt innen 2 virkedager.
              </Typography>
            </Paper>
            <Box sx={{ mt: 2.2, pt: 2, borderTop: '1px solid rgba(255,140,0,0.16)' }}>
              <Typography variant="body2" sx={{ color: '#374151', fontWeight: 'bold', mb: 1 }}>
                Følg CreatorHub
              </Typography>
              <Typography variant="body2" sx={{ color: '#6b7280', mb: 1.6 }}>
                Offentlige kanaler for viktige oppdateringer om plattformen og brukerkontoer.
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  component="a"
                  href={CREATORHUB_INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<Instagram sx={{ fontSize: 18 }} />}
                  variant="outlined"
                  sx={{ textTransform: 'none', borderRadius: '999px' }}
                >
                  Instagram
                </Button>
                <Button
                  component="a"
                  href={CREATORHUB_FACEBOOK_URL}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<FacebookRounded sx={{ fontSize: 18 }} />}
                  variant="outlined"
                  sx={{ textTransform: 'none', borderRadius: '999px' }}
                >
                  Facebook
                </Button>
              </Stack>
            </Box>
          </Box>

          {/* Footer */}
          <Box sx={{ mt: 4, pt: 4, borderTop: '1px solid #e5e7eb' }}>
            <Typography variant="body2" sx={{ color: '#6b7280', textAlign: 'center' }}>
              QAZI FOTOREEL - Organisasjonsnummer: 833038222
              <br />
              Sist oppdatert: Januar 2025
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default DataDeletion;
