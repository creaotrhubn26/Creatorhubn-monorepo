/**
 * leadgrid-developers.tsx — offentlige dev-docs på /leadgrid/utviklere
 *
 * Dokumenterer kun den implementerte Public Leads API v1-kontrakten.
 * Interne Partner API-er og workflow-webhooks er bevisst ikke presentert
 * som del av den offentlige API-en.
 */

import React, { useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

const PALETTE = {
  bg: "#0a0512",
  accent: "#a78bfa",
  text: "#f4f0ff",
  textMuted: "rgba(244,240,255,0.72)",
  textFaint: "rgba(244,240,255,0.45)",
};

const API_BASE_URL = "https://creatorhub-backend-rtbl.onrender.com";

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/health",
    scope: "gyldig nøkkel",
    description: "Verifiser nøkkel, prosjektbinding, scopes og rate-limit.",
  },
  {
    method: "GET",
    path: "/api/v1/leads",
    scope: "leads.read",
    description: "List leads i nøkkelens Leadgrid-prosjekt.",
  },
  {
    method: "GET",
    path: "/api/v1/leads/{id}",
    scope: "leads.read",
    description: "Hent én lead innenfor samme prosjekt.",
  },
  {
    method: "POST",
    path: "/api/v1/leads",
    scope: "leads.write",
    description: "Opprett en lead i nøkkelens prosjekt.",
  },
  {
    method: "GET",
    path: "/api/v1/recommendations",
    scope: "recommendations.read",
    description: "List ventende Next Best Action-anbefalinger for prosjektet.",
  },
  {
    method: "POST",
    path: "/api/v1/projects/{projectId}/leads/{leadId}/outcome-events",
    scope: "outcomes.write",
    description: "Registrer et append-only prosjektresultat på én lead.",
  },
] as const;

const OUTCOME_SEMANTICS = [
  {
    eventType: "pilot_invited",
    meaning:
      "Pilotinvitasjonen ble faktisk sendt eller overlevert til klinikken.",
  },
  {
    eventType: "meeting_completed",
    meaning: "Møtet ble faktisk avholdt; en booking alene er ikke nok.",
  },
  {
    eventType: "profile_published",
    meaning: "Klinikkprofilen er publisert og live i Dentum.",
  },
  {
    eventType: "inquiry_received",
    meaning:
      "En kommersiell forespørsel er mottatt, uten person- eller pasientdata.",
  },
  {
    eventType: "booking_confirmed",
    meaning: "En reell booking er bekreftet.",
  },
  {
    eventType: "attendance_confirmed",
    meaning:
      "Det faktiske oppmøtet er bekreftet; en booking alene er ikke nok.",
  },
] as const;

const CODE_LIST_LEADS = `curl "${API_BASE_URL}/api/v1/leads?limit=50" \\
  -H "Authorization: Bearer lgk_live_..."`;

const CODE_CREATE_LEAD = `curl -X POST "${API_BASE_URL}/api/v1/leads" \\
  -H "Authorization: Bearer lgk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Grünerløkka Tannhelse",
    "company": "Grünerløkka Tannhelse AS",
    "city": "Oslo",
    "country": "NO",
    "lead_source": "dentum_clinic_pilot"
  }'`;

const CODE_OUTCOME = `PROJECT_ID="dentum-klinikkpilot-oslo"
LEAD_ID="11111111-1111-4111-8111-111111111111"

curl -X POST \\
  "${API_BASE_URL}/api/v1/projects/\${PROJECT_ID}/leads/\${LEAD_ID}/outcome-events" \\
  -H "Authorization: Bearer lgk_live_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: dentum-booking-book_01JABC123" \\
  -d '{
    "event_type": "booking_confirmed",
    "external_event_id": "dentum-booking-book_01JABC123",
    "occurred_at": "2026-09-05T12:00:00+02:00",
    "metadata": {
      "channel": "dentum",
      "campaign_ref": "klinikkpilot-oslo",
      "territory_code": "oslo",
      "quantity": 1
    }
  }'`;

export default function LeadgridDevelopersPage() {
  useEffect(() => {
    document.title = "Leadgrid Developers: Public Leads API v1";
  }, []);

  return (
    <Box
      sx={{
        bgcolor: PALETTE.bg,
        color: PALETTE.text,
        minHeight: "100vh",
        py: 8,
        fontFamily:
          '-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <Container maxWidth="md">
        <Typography
          variant="overline"
          sx={{ color: PALETTE.accent, letterSpacing: 2 }}
        >
          Leadgrid Developers
        </Typography>
        <Typography variant="h2" sx={{ fontWeight: 800, mb: 2 }}>
          Public Leads API v1
        </Typography>
        <Typography variant="h6" sx={{ color: PALETTE.textMuted, mb: 3 }}>
          Les og opprett leads, hent anbefalinger og send kildesystem-bekreftede
          prosjektresultater tilbake til Leadgrid.
        </Typography>

        <Alert
          severity="info"
          sx={{
            mb: 4,
            bgcolor: "rgba(122,184,255,0.10)",
            color: PALETTE.text,
            border: "1px solid rgba(122,184,255,0.25)",
          }}
        >
          API v1 har foreløpig ingen generell lead-oppdateringsrute og ingen
          offentlig utgående webhook-katalog. Ferdigpakkede CRM- og
          automasjonsconnectorer er derfor merket som planlagt.
        </Alert>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={6}>
          <Button
            variant="contained"
            size="large"
            href="/leadgrid/utviklere/soknad"
            sx={{
              bgcolor: PALETTE.accent,
              color: "#0a0512",
              fontWeight: 700,
              px: 4,
              borderRadius: 999,
              "&:hover": { bgcolor: "#9171e6" },
            }}
          >
            Søk om API-tilgang
          </Button>
          <Button
            variant="outlined"
            size="large"
            href="/api/v1/docs"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              color: PALETTE.text,
              borderColor: "rgba(255,255,255,0.2)",
              px: 4,
              borderRadius: 999,
            }}
          >
            Åpne Swagger UI
          </Button>
        </Stack>

        <Section title="Autentisering og nøkkeltilgang">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Alle kall bruker Bearer-token. Live-nøkler starter med{" "}
            <code>lgk_live_</code>; testnøkler starter med{" "}
            <code>lgk_test_</code>.
          </Typography>
          <CodeBlock>{`Authorization: Bearer lgk_live_...`}</CodeBlock>
          <Typography sx={{ mt: 2, color: PALETTE.textMuted }}>
            Den offentlige siden har ikke selvbetjent nøkkelopprettelse. Bruk
            søknadsskjemaet over; en autorisert Leadgrid-administrator utsteder
            nøkkelen ved innvilget tilgang. Klartekstnøkkelen vises bare én
            gang, så den må lagres som en hemmelighet.
          </Typography>
        </Section>

        <Section title="Prosjektgrensen">
          <Stack spacing={2}>
            <Typography sx={{ color: PALETTE.textMuted }}>
              Nye API-nøkler er bundet til ett aktivt Leadgrid-prosjekt som
              standard. Datakall avgrenses både på organisasjon og prosjekt. For
              en prosjektbundet nøkkel kan <code>project_id</code> utelates;
              hvis det sendes, må det samsvare med nøkkelens binding.
            </Typography>
            <Typography sx={{ color: PALETTE.textMuted }}>
              Organisasjonsomfattende nøkler er et eksplisitt unntak som bare en
              organisasjonsadministrator kan opprette. De må angi{" "}
              <code>project_id</code> på hvert datakall. Outcome-ruten har
              alltid prosjekt-ID i path og avviser prosjekter utenfor nøkkelens
              scope.
            </Typography>
          </Stack>
        </Section>

        <Section title="Scopes">
          <Stack direction="row" spacing={1} flexWrap="wrap" rowGap={1}>
            {[
              "leads.read",
              "leads.write",
              "recommendations.read",
              "outcomes.write",
            ].map((scope) => (
              <Chip
                key={scope}
                label={scope}
                size="small"
                sx={{
                  bgcolor: "rgba(155,225,93,0.10)",
                  color: "#9be15d",
                  fontFamily: "monospace",
                }}
              />
            ))}
          </Stack>
        </Section>

        <Section title="Implementerte endepunkter">
          <Stack spacing={1}>
            {ENDPOINTS.map((endpoint) => (
              <Box
                key={endpoint.path + endpoint.method}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  flexWrap="wrap"
                >
                  <Chip
                    label={endpoint.method}
                    size="small"
                    sx={{
                      bgcolor:
                        endpoint.method === "GET" ? "#7ab8ff" : "#9be15d",
                      color: "#0a0512",
                      fontWeight: 700,
                      minWidth: 56,
                    }}
                  />
                  <Box
                    sx={{
                      fontFamily: "monospace",
                      fontSize: 13,
                      color: "#fff",
                      flex: 1,
                    }}
                  >
                    {endpoint.path}
                  </Box>
                  <Chip
                    label={endpoint.scope}
                    size="small"
                    sx={{
                      bgcolor: "rgba(155,225,93,0.10)",
                      color: "#9be15d",
                      fontFamily: "monospace",
                    }}
                  />
                </Stack>
                <Typography
                  variant="caption"
                  sx={{
                    color: PALETTE.textMuted,
                    mt: 0.5,
                    display: "block",
                  }}
                >
                  {endpoint.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Section>

        <Section title="Les leads">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Eksemplet bruker en prosjektbundet nøkkel. Bruk <code>limit</code>{" "}
            og <code>offset</code> for paginering.
          </Typography>
          <CodeBlock>{CODE_LIST_LEADS}</CodeBlock>
        </Section>

        <Section title="Opprett en lead">
          <CodeBlock>{CODE_CREATE_LEAD}</CodeBlock>
          <Alert
            severity="warning"
            sx={{
              mt: 2,
              bgcolor: "rgba(255,184,107,0.10)",
              color: PALETTE.text,
              border: "1px solid rgba(255,184,107,0.25)",
            }}
          >
            <code>POST /api/v1/leads</code> har ikke en dokumentert
            idempotensgaranti. Unngå blind automatisk retry etter et tapt svar;
            les tilbake og dedupliser før du forsøker igjen.
          </Alert>
        </Section>

        <Section title="Send Dentum-resultater tilbake">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Kildesystemet, for eksempel Dentum, bekrefter at utfallet faktisk
            skjedde. Leadgrid validerer struktur, prosjekt-/lead-scope,
            metadata-allowlist og idempotens, men verifiserer ikke uavhengig at
            et møte, en booking eller et oppmøte fant sted.
          </Typography>
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Outcome-ruten er append-only og krever <code>outcomes.write</code>.
            Bruk samme stabile <code>Idempotency-Key</code> og{" "}
            <code>external_event_id</code> ved retry. Identifikatorene må være
            1–255 tegn og kan bare inneholde bokstaver, tall, punktum,
            understrek, kolon og bindestrek. Et identisk nytt forsøk returnerer
            den eksisterende hendelsen; samme identifikator med annet innhold
            gir HTTP 409.
          </Typography>
          <CodeBlock>{CODE_OUTCOME}</CodeBlock>
          <Typography sx={{ mt: 3, mb: 1.5, color: PALETTE.textMuted }}>
            Autoritativ betydning per hendelse:
          </Typography>
          <Stack spacing={1.25}>
            {OUTCOME_SEMANTICS.map((outcome) => (
              <Box
                key={outcome.eventType}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  alignItems: "center",
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,0.035)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Chip
                  label={outcome.eventType}
                  size="small"
                  sx={{
                    bgcolor: "rgba(167,139,250,0.12)",
                    color: PALETTE.accent,
                    fontFamily: "monospace",
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ color: PALETTE.textMuted }}>
                  {outcome.meaning}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Typography sx={{ mt: 2, color: PALETTE.textMuted }}>
            Metadata er en streng allowlist: <code>channel</code>,{" "}
            <code>campaign_ref</code>, <code>territory_code</code>,{" "}
            <code>quantity</code>, <code>value_minor</code> og{" "}
            <code>currency</code>. Beløp og valuta må sendes sammen. Ikke send
            pasientdata, kontaktopplysninger eller fritekst.
          </Typography>

          <Typography sx={{ mt: 2, color: PALETTE.textMuted }}>
            <code>occurred_at</code> er tidspunktet hendelsen faktisk skjedde,
            med eksplisitt tidssone; verdier mer enn fem minutter frem i tid
            avvises. Ikke send Discovery profile-, run- eller candidate-ID-er.
            Leadgrid utleder uforanderlig first-touch-attribusjon på serveren
            fra den første godkjente kandidaten som faktisk importerte leadet
            før hendelsen. Attribusjonen er tom for leads uten
            Discovery-opprinnelse.
          </Typography>
        </Section>

        <Section title="Rate-limit og feil">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            Rate-limit konfigureres per nøkkel og oppgis av{" "}
            <code>GET /api/v1/health</code> som <code>rate_limit_rpm</code>. Ved
            overskridelse svarer API-et med HTTP 429 og feltene{" "}
            <code>limit_rpm</code> og <code>retry_after_seconds</code>.
          </Typography>
          <Typography sx={{ color: PALETTE.textMuted }}>
            Vanlige svar er 400 for ugyldig input, 401 for manglende eller
            ugyldig nøkkel, 403 for manglende scope, 404 for ressurser utenfor
            prosjektgrensen og 409 for idempotenskonflikt på outcome-hendelser.
          </Typography>
        </Section>

        <Section title="Maskinlesbar kontrakt">
          <Typography sx={{ mb: 2, color: PALETTE.textMuted }}>
            OpenAPI 3.1-spesifikasjonen er den autoritative, maskinlesbare
            kontrakten for tilgjengelige ruter og payloads.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              variant="outlined"
              href="/api/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: PALETTE.text, borderColor: "rgba(255,255,255,0.2)" }}
            >
              Swagger UI
            </Button>
            <Button
              variant="outlined"
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: PALETTE.text, borderColor: "rgba(255,255,255,0.2)" }}
            >
              OpenAPI JSON
            </Button>
          </Stack>
        </Section>

        <Divider sx={{ my: 6, borderColor: "rgba(255,255,255,0.08)" }} />

        <Typography variant="caption" sx={{ color: PALETTE.textFaint }}>
          Spørsmål? Send e-post til{" "}
          <a
            href="mailto:daniel@creatorhubn.com"
            style={{ color: PALETTE.accent }}
          >
            daniel@creatorhubn.com
          </a>
          .
        </Typography>
      </Container>
    </Box>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      sx={{
        bgcolor: "rgba(255,255,255,0.03)",
        color: "#fff",
        mb: 4,
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <Box
      component="pre"
      sx={{
        p: 2.5,
        bgcolor: "#000",
        borderRadius: 2,
        fontSize: 13,
        lineHeight: 1.6,
        color: "#e5e2f0",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        overflowX: "auto",
        border: "1px solid rgba(255,255,255,0.08)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {children}
    </Box>
  );
}
