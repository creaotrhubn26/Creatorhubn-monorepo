/**
 * leadgrid-personvern.tsx — personvernerklæring for Leadgrid.
 *
 * Apple TestFlight + App Store krever offentlig privacy policy URL
 * før eksterne testere kan inviteres. Denne siden er deretter også
 * en lovpålagt erklæring under GDPR (artikkel 13/14) når Leadgrid
 * behandler personopplysninger om kontaktpersoner i kundebedrifter,
 * selgere som registrerer besøk, og endre-/sluttbrukere.
 *
 * Innholdet dekker:
 *   1. Behandlingsansvarlig (Creatorhub AS)
 *   2. Hva vi samler (kontaktinfo, GPS, visit-notater, voice)
 *   3. Hvorfor (rettslig grunnlag pr. kategori)
 *   4. Hvor data lagres (Render-EU, Backblaze B2 EU, Apple iCloud)
 *   5. Tredjepart-prosessering (Apple, Google Places, Anthropic/Claude)
 *   6. Lagringstid pr. datatype
 *   7. Brukerrettigheter (innsyn, sletting, dataportabilitet)
 *   8. Kontakt + kommerkommunikasjon m/ Datatilsynet
 *   9. Endringer i erklæringen
 *
 * Stil-konvensjon: matcher leadgrid-landing.tsx (mørk premium).
 */

import { useEffect } from 'react';
import {
  Box, Container, Typography, Stack, Divider,
} from '@mui/material';

const PALETTE = {
  bg: '#0b0518',
  bgAlt: '#13082b',
  card: 'rgba(167, 139, 250, 0.06)',
  cardBorder: 'rgba(167, 139, 250, 0.18)',
  accent: '#A78BFA',
  text: '#F4F0FF',
  textMuted: 'rgba(244, 240, 255, 0.78)',
  textFaint: 'rgba(244, 240, 255, 0.45)',
};

const LAST_UPDATED = '17. juni 2026';

export default function LeadgridPersonvern() {
  useEffect(() => {
    document.title = 'Personvern — Leadgrid';
    const desc = document.querySelector('meta[name="description"]');
    const content = 'Personvernerklæring for Leadgrid. Hvilke opplysninger vi samler, hvorfor, hvor de lagres, og dine rettigheter under GDPR.';
    if (desc) desc.setAttribute('content', content);
  }, []);

  return (
    <Box sx={{
      bgcolor: PALETTE.bg,
      color: PALETTE.text,
      minHeight: '100vh',
      fontFamily: '-apple-system, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif',
    }}>
      <MiniHeader />

      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        <Typography sx={{
          fontSize: 13, color: PALETTE.accent, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', mb: 2,
        }}>
          Personvern
        </Typography>
        <Typography component="h1" sx={{
          fontSize: { xs: 36, md: 52 },
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          mb: 3,
        }}>
          Personvern­erklæring
        </Typography>
        <Typography sx={{ color: PALETTE.textMuted, fontSize: 17, lineHeight: 1.6, mb: 1 }}>
          Slik behandler Leadgrid personopplysninger — hva vi samler,
          hvorfor vi samler det, hvor vi lagrer det, og hvilke rettigheter
          du har som bruker.
        </Typography>
        <Typography sx={{ color: PALETTE.textFaint, fontSize: 13, mb: 6 }}>
          Sist oppdatert {LAST_UPDATED}
        </Typography>

        <Divider sx={{ borderColor: PALETTE.cardBorder, mb: 6 }} />

        <Section title="1. Behandlingsansvarlig">
          <P>
            <strong>Creatorhub AS</strong> (org.nr. 933 728 169) er
            behandlingsansvarlig for personopplysninger i Leadgrid.
            Kontakt: <Link href="mailto:personvern@creatorhubn.com">personvern@creatorhubn.com</Link>.
          </P>
        </Section>

        <Section title="2. Hva slags opplysninger vi samler inn">
          <P>
            Leadgrid er en kartbasert CRM som hjelper salgsteam med å finne,
            organisere og følge opp kundeleads. Følgende kategorier av
            opplysninger behandles:
          </P>
          <Bullets items={[
            <><strong>Brukerkonto:</strong> navn, e-postadresse, telefon, profilbilde, rolle i organisasjonen, push-token (APNs).</>,
            <><strong>Lead-data:</strong> bedriftsnavn, adresse, kontaktperson, telefon, e-post, bransje, åpen kildeinformasjon (Google Places, BRREG).</>,
            <><strong>Posisjonsdata (GPS):</strong> selgerens nåværende posisjon når app-en er aktiv (for «leads i nærheten»), og automatisk koordinat-fanging ved logging av fysiske besøk. Background-sporing skjer kun for «nær-lead»-varsling og krever eksplisitt samtykke.</>,
            <><strong>Visit-logg:</strong> tidsstempel, kontaktperson, samtale-sammendrag, neste handling, oppfølgings­dato. Stemme-dikterte notater behandles på enheten av Apple Speech og lagres som transkribert tekst på vår server.</>,
            <><strong>Visittkort-skanning:</strong> kameraet brukes lokalt på enheten via Apple VisionKit; bildet sendes ikke til oss — kun ekstrahert tekst lagres.</>,
            <><strong>Pitch Deck-bruk:</strong> hvilke slides som vises, Apple Pencil-annotasjoner, utfalls-status etter presentasjon.</>,
            <><strong>Telemetri:</strong> krash-rapporter, build-versjon, OS-versjon, anonymisert bruksstatistikk for å forbedre app-en.</>,
          ]} />
        </Section>

        <Section title="3. Hvorfor vi behandler opplysningene">
          <P>
            Rettslig grunnlag pr. behandling:
          </P>
          <Bullets items={[
            <><strong>Avtaleoppfyllelse</strong> (GDPR art. 6(1)(b)): drift av Leadgrid-tjenesten for kunden vår — kartvisning, lead-CRM, pitch-deck-bygging.</>,
            <><strong>Berettiget interesse</strong> (GDPR art. 6(1)(f)): kart-visualisering av kontaktinfo registrert offentlig (BRREG, Google Places), funksjons-forbedring basert på anonymisert telemetri.</>,
            <><strong>Samtykke</strong> (GDPR art. 6(1)(a)): bakgrunns-GPS for «nær-lead»-varsling, push-notifikasjoner, lokasjons-deling mellom team-medlemmer.</>,
            <><strong>Lovpålagt</strong> (GDPR art. 6(1)(c)): bokførings­plikt for fakturerings­data (5 år iflg. bokføringsloven).</>,
          ]} />
        </Section>

        <Section title="4. Hvor data lagres og hvem som kan se det">
          <P>
            All produksjonsdata lagres på servere i <strong>EU/EØS</strong>:
          </P>
          <Bullets items={[
            <><strong>Render Inc.</strong> (Frankfurt) — vår primære app-server og PostgreSQL-database. Render er prosessor i henhold til standard­kontrakts­klausuler.</>,
            <><strong>Backblaze B2</strong> (Amsterdam, region eu-central-003) — fil-lagring for mockups, deck-eksporter og iPad-foto. Tilgang via signed URLs med 10 minutters levetid.</>,
            <><strong>Apple Push Notification service</strong> — push-leveranse. Apple lagrer kun device-token og ikke meldingsinnholdet over tid.</>,
            <><strong>Apple iCloud Keychain</strong> (på din egen enhet) — bearer-tokens for sesjon. Aldri tilgjengelig for oss.</>,
          ]} />
          <P>
            Tilgang til lead-data inne i din organisasjon styres av
            rollebaserte tillatelser (RBAC). Brukere ser kun data scoped
            til sin egen organisasjon, og enkelt-tillatelser kan overstyres
            per bruker av organisasjonens administrator.
          </P>
        </Section>

        <Section title="5. Tredjepart-prosessorer">
          <P>
            Følgende tjenester behandler personopplysninger på vegne av oss
            etter databehandler-avtaler:
          </P>
          <Bullets items={[
            <><strong>Apple Inc.</strong> — App Store, TestFlight, APNs, iCloud Keychain.</>,
            <><strong>Google LLC</strong> — Google Places API (geo-oppslag av bedriftsnavn). Sender kun søke-streng + brukerens grov-region, ikke andre personopplysninger.</>,
            <><strong>Anthropic PBC</strong> — Claude AI for pitch-deck-generering, brief-generering og tale-analyse av visit-notater. Vi sender kun det som er strengt nødvendig for spørringen; ingen treningsbruk per Anthropic's API-avtale.</>,
            <><strong>Twilio Ireland</strong> — SMS-utsending (kun ved aktivt salgs-flyt-bruk).</>,
            <><strong>Resend, Inc.</strong> — Transaksjons-e-poster.</>,
            <><strong>Stripe Payments Europe Ltd.</strong> — Betalings­behandling for abonnement.</>,
          ]} />
        </Section>

        <Section title="6. Hvor lenge vi oppbevarer data">
          <Bullets items={[
            'Brukerkonti: så lenge du har et aktivt abonnement, deretter inaktiveres innen 90 dager.',
            'Lead-data: så lenge organisasjonen din opprettholder abonnementet. Du kan slette enkelt-leads umiddelbart.',
            'GPS-posisjon: brukeren sin nåværende posisjon overskrives kontinuerlig; visit-koordinat lagres som del av besøks-loggen.',
            'Voice-notater: transkribert tekst lagres så lenge visit-loggen eksisterer; lyd-data lagres aldri på server.',
            'Pitch-deck-eksporter (PDF): 30 dager, deretter slettes B2-objektet automatisk.',
            'Telemetri: 12 måneder.',
            'Faktureringsdata: 5 år (bokføringspliktig).',
          ]} />
        </Section>

        <Section title="7. Dine rettigheter">
          <P>
            Som registrert har du følgende rettigheter under GDPR:
          </P>
          <Bullets items={[
            <><strong>Innsyn:</strong> få vite hvilke opplysninger vi har om deg.</>,
            <><strong>Retting:</strong> få feilaktige opplysninger korrigert.</>,
            <><strong>Sletting:</strong> få opplysningene slettet («retten til å bli glemt»).</>,
            <><strong>Dataportabilitet:</strong> få utlevert opplysningene i et maskinlesbart format (JSON/CSV).</>,
            <><strong>Begrensning:</strong> få behandlingen begrenset i påvente av tvist.</>,
            <><strong>Innsigelse:</strong> protestere mot behandling basert på berettiget interesse.</>,
            <><strong>Tilbakekalle samtykke:</strong> trekke tilbake samtykke til background-GPS, push eller lokasjons-deling når som helst i app-en under Org-fanen → Personvern.</>,
          ]} />
          <P>
            Henvendelser om dine rettigheter kan rettes til{' '}
            <Link href="mailto:personvern@creatorhubn.com">personvern@creatorhubn.com</Link>.
            Vi svarer innen 30 dager.
          </P>
        </Section>

        <Section title="8. Klage til tilsynsmyndigheten">
          <P>
            Hvis du mener at vi behandler dine personopplysninger i strid
            med personvern­regelverket, har du rett til å klage til{' '}
            <Link href="https://www.datatilsynet.no/">Datatilsynet</Link>.
            Vi setter pris på om du kontakter oss først så vi får mulighet
            til å rette opp.
          </P>
        </Section>

        <Section title="9. Sikkerhet">
          <P>
            All trafikk mellom enhet og våre servere er kryptert med TLS 1.3.
            Data i ro krypteres med AES-256 (Render PostgreSQL og Backblaze
            B2). Lokale data på iPad er beskyttet av Apple Data Protection.
            Bearer-tokens lagres i Apple Keychain og roteres ved utlogging.
          </P>
        </Section>

        <Section title="10. Endringer i denne erklæringen">
          <P>
            Vi kan endre denne personvernerklæringen for å reflektere nye
            funksjoner eller endringer i lovgivningen. Vesentlige endringer
            varsles via app-en eller e-post minst 14 dager før de trer i kraft.
            Datoen for siste oppdatering vises øverst på siden.
          </P>
        </Section>

        <Divider sx={{ borderColor: PALETTE.cardBorder, mt: 8, mb: 4 }} />

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ color: PALETTE.textFaint, fontSize: 13 }}>
            Creatorhub AS · Org.nr. 933 728 169
          </Typography>
          <Link href="/leadgrid">← Tilbake til Leadgrid</Link>
        </Stack>
      </Container>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Mini-header (lett uten full nav)
// ────────────────────────────────────────────────────────────

function MiniHeader() {
  return (
    <Box
      component="header"
      sx={{
        borderBottom: `1px solid ${PALETTE.cardBorder}`,
        bgcolor: 'rgba(11, 5, 24, 0.95)',
      }}
    >
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Stack
          component="a"
          href="/leadgrid"
          direction="row"
          alignItems="center"
          spacing={1.5}
          sx={{
            textDecoration: 'none', color: PALETTE.text, width: 'fit-content',
          }}
        >
          <Box
            component="img"
            src="/leadgrid/logo.png"
            alt=""
            sx={{ width: 32, height: 32, borderRadius: 1 }}
          />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1 }}>
              Leadgrid
            </Typography>
            <Typography sx={{ fontSize: 11, color: PALETTE.textFaint, lineHeight: 1 }}>
              by The Role Room
            </Typography>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Tekst-byggeklosser
// ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 5 }}>
      <Typography component="h2" sx={{
        fontWeight: 700, fontSize: { xs: 22, md: 26 },
        mb: 2.5, letterSpacing: '-0.01em',
      }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontSize: 16, lineHeight: 1.7, color: PALETTE.textMuted, mb: 2,
    }}>
      {children}
    </Typography>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <Box component="ul" sx={{ pl: 3, mb: 2 }}>
      {items.map((item, i) => (
        <Box
          component="li"
          key={i}
          sx={{
            mb: 1.2,
            fontSize: 16,
            lineHeight: 1.65,
            color: PALETTE.textMuted,
            '&::marker': { color: PALETTE.accent },
          }}
        >
          {item}
        </Box>
      ))}
    </Box>
  );
}

function Link({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Box
      component="a"
      href={href}
      sx={{
        color: PALETTE.accent,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(167, 139, 250, 0.4)',
        '&:hover': { textDecorationColor: PALETTE.accent },
      }}
    >
      {children}
    </Box>
  );
}
