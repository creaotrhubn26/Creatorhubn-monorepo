import React, { useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBackOutlined,
  ErrorOutlineOutlined,
  KeyOutlined,
  MapOutlined,
  MenuBookOutlined,
  OpenInNewOutlined,
} from '@mui/icons-material';
import type { LeadgridStatusRouteKind } from '@/lib/leadgridNavigation';

type Props = {
  kind: LeadgridStatusRouteKind;
  requestedConnector?: string;
};

const CONNECTOR_LABELS: Record<string, string> = {
  zapier: 'Zapier',
  make: 'Make',
  slack: 'Slack',
  'github-actions': 'GitHub Actions',
  webhooks: 'webhooks',
};

export default function LeadgridRouteStatusPage({ kind, requestedConnector }: Props) {
  const connectorLabel = requestedConnector
    ? (CONNECTOR_LABELS[requestedConnector] ?? requestedConnector)
    : 'denne connectoren';

  const config = kind === 'map'
    ? {
        icon: <MapOutlined sx={{ fontSize: 44 }} />,
        eyebrow: 'Leadgrid-kartet',
        title: 'Kartet er foreløpig en app-flate',
        description:
          'Leads du importerer blir lagret, men en ordinær kartflate for organisasjonsbrukere er ikke koblet til web ennå. Åpne Leadgrid på iPhone eller iPad for å arbeide i kartet.',
        notice: 'Vi sender deg ikke videre til Admin Room, fordi den flaten er eierstyrt og ikke riktig inngang for en vanlig Leadgrid-organisasjon.',
        primary: { label: 'Tilbake til import', href: '/leadgrid/import' },
        secondary: { label: 'Om Leadgrid', href: '/leadgrid' },
      }
    : kind === 'api_keys'
      ? {
          icon: <KeyOutlined sx={{ fontSize: 44 }} />,
          eyebrow: 'API-tilgang',
          title: 'API-nøkler utstedes etter godkjenning',
          description:
            'Selvbetjent opprettelse av produksjonsnøkler er ikke åpen ennå. Søk om API-tilgang først; godkjente integrasjonspartnere får sandbox- og produksjonstilgang gjennom partnerprosessen.',
          notice: 'Dette er en tilgangsbegrensning, ikke en innloggingsfeil.',
          primary: { label: 'Søk om API-tilgang', href: '/leadgrid/utviklere/soknad' },
          secondary: { label: 'Les API-dokumentasjonen', href: '/leadgrid/utviklere' },
        }
      : kind === 'connector_docs'
        ? {
            icon: <MenuBookOutlined sx={{ fontSize: 44 }} />,
            eyebrow: 'Connector-dokumentasjon',
            title: `Oppskriften for ${connectorLabel} er ikke publisert ennå`,
            description:
              'Den generelle API- og webhook-kontrakten er tilgjengelig nå. Den connector-spesifikke steg-for-steg-oppskriften er fortsatt under arbeid.',
            notice: 'Bruk OpenAPI-spesifikasjonen som teknisk sannhetskilde inntil connector-guiden er publisert.',
            primary: { label: 'Åpne Swagger UI', href: '/api/v1/docs', external: true },
            secondary: { label: 'Les utviklerguiden', href: '/leadgrid/utviklere' },
          }
        : {
            icon: <ErrorOutlineOutlined sx={{ fontSize: 44 }} />,
            eyebrow: 'Leadgrid',
            title: 'Denne siden finnes ikke',
            description:
              'Lenken peker ikke til en aktiv Leadgrid-flate. Bruk en av inngangene under i stedet.',
            notice: 'Ingen data er endret.',
            primary: { label: 'Til Leadgrid', href: '/leadgrid' },
            secondary: { label: 'Se connectors', href: '/leadgrid/connectors' },
          };

  useEffect(() => {
    document.title = `${config.title} · Leadgrid`;
  }, [config.title]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0b0518',
        color: '#f4f0ff',
        display: 'flex',
        alignItems: 'center',
        py: 8,
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            bgcolor: 'rgba(167,139,250,0.07)',
            color: '#f4f0ff',
            border: '1px solid rgba(167,139,250,0.22)',
            borderRadius: 4,
            boxShadow: '0 28px 80px rgba(0,0,0,0.35)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Stack spacing={3}>
              <Box sx={{ color: '#a78bfa' }}>{config.icon}</Box>
              <Box>
                <Typography variant="overline" sx={{ color: '#a78bfa', letterSpacing: 1.8 }}>
                  {config.eyebrow}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 34, sm: 44 }, mt: 0.5 }}>
                  {config.title}
                </Typography>
              </Box>
              <Typography sx={{ color: 'rgba(244,240,255,0.74)', fontSize: 17, lineHeight: 1.65 }}>
                {config.description}
              </Typography>
              <Alert severity="info" sx={{ bgcolor: 'rgba(122,184,255,0.10)' }}>
                {config.notice}
              </Alert>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  component="a"
                  href={config.primary.href}
                  target={'external' in config.primary && config.primary.external ? '_blank' : undefined}
                  rel={'external' in config.primary && config.primary.external ? 'noopener noreferrer' : undefined}
                  variant="contained"
                  endIcon={'external' in config.primary && config.primary.external ? <OpenInNewOutlined /> : undefined}
                  sx={{ bgcolor: '#a78bfa', color: '#16072d', fontWeight: 750, '&:hover': { bgcolor: '#c084fc' } }}
                >
                  {config.primary.label}
                </Button>
                <Button
                  component="a"
                  href={config.secondary.href}
                  variant="outlined"
                  startIcon={<ArrowBackOutlined />}
                  sx={{ color: '#f4f0ff', borderColor: 'rgba(244,240,255,0.28)' }}
                >
                  {config.secondary.label}
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
