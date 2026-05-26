import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import CameraRollIcon from '@mui/icons-material/CameraRoll';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Innspillingsdag-koordinering — Industry Data-pillar for live-på-sett-
 * koordinering. Etablerer The Role Room som tankefigur for selve
 * opptaksdagen, ikke bare pre-prod og post-prod. Article-schema +
 * Speakable-merker for AI-citation.
 *
 * Skal renderes på /innspillingsdag-koordinering på theroleroom.com.
 */

type RoleDataPoint = {
  role: string;
  typical_count: string;
  primary_job: string;
};

const SET_ROLES: RoleDataPoint[] = [
  { role: '1st AD', typical_count: '1', primary_job: 'Kjører dagen — ansvar for tidsplan, sceneskifter, kommunikasjon mellom regi og crew' },
  { role: '2nd AD', typical_count: '1', primary_job: 'Koordinerer skuespillere og statister, samkjører garderobe og make-up med shoot-rekkefølge' },
  { role: '3rd AD / set runner', typical_count: '1-2', primary_job: 'Backup-koordinator, henter, varsler, fysisk koordinerings-fyrtårn på sett' },
  { role: 'Background coordinator', typical_count: '1', primary_job: 'Leder statister i sanntid — særlig kritisk i scener med 10+ personer' },
  { role: 'Intimacy coordinator', typical_count: '0-1', primary_job: 'Påkrevd for intime scener — koordinerer samtykke, demonstrer praksis, sikrer skuespillerens grenser' },
  { role: 'Stunt coordinator', typical_count: '0-1', primary_job: 'Planlegger og fasiliterer alle stunt-relaterte scener — risikovurdering, double-koordinering, sikkerhet' },
  { role: 'Set medic', typical_count: '1', primary_job: 'Sanitet på sett, første hjelp, har autoritet til å stoppe opptak ved arbeidsulykke' },
  { role: 'HMUA-team', typical_count: '2-5', primary_job: 'Hair og make-up under hele opptaket — touch-ups mellom takes, kontinuitet over uker' },
  { role: 'DIT', typical_count: '1', primary_job: 'Digital Imaging Technician — back of camera, sjekker bilde-kvalitet og overfører materialet sikkert' },
  { role: 'Location manager', typical_count: '1', primary_job: 'Ansvar for lokasjonen — tilgang, sikkerhet, kommunikasjon med eiere og naboer' },
  { role: 'DP + 1st AC + 2nd AC', typical_count: '3', primary_job: 'Kamera-avdeling — bildekvalitet, fokus, mediahåndtering' },
  { role: 'Sound mixer + boom operator', typical_count: '2', primary_job: 'Lyd-team — produksjons-lyd som ikke kan reddes i post' },
];

type PainPoint = {
  smerte: string;
  konsekvens: string;
  losning: string;
};

const COORDINATION_PAINS: PainPoint[] = [
  {
    smerte: 'Call sheet endres flere ganger per dag — versjons-kaos via walkie og tekstmelding',
    konsekvens: 'En 90-min forsinkelse fordi statist møtte på feil lokasjon koster typisk 25-40.000 NOK i overtid og ekstra cateringselger',
    losning: 'Sanntid call sheet med push-notification til alle på prosjektet — én kanonisk versjon, automatisk historikk',
  },
  {
    smerte: 'Statist-tilstedeværelse sjekkes manuelt mot Excel-liste',
    konsekvens: 'Hver missing statist forsinker hele scenen — bg coordinator bruker 30+ min/dag på å verifisere navn',
    losning: 'QR-basert innsjekking på sett, automatisk varsel ved manglende sjekk-inn 30 min før call time',
  },
  {
    smerte: 'Skuespiller-samtykke per scene-endring loggføres ikke konsistent',
    konsekvens: 'GDPR-eksponering hvis intim scene eller barne-scene endres på sett uten ny samtykke-bekreftelse',
    losning: 'Samtykke-versjonering i app: hver scene-endring trigger digital re-bekreftelse fra skuespiller (eller foresatt for barn)',
  },
  {
    smerte: 'Arbeidstid-rapportering skjer på papir og legges inn manuelt etter wrap',
    konsekvens: 'Når Arbeidstilsynet eller Skatt forespør dokumentasjon, må produsenten rekonstruere fra notater. Bøter ved feil opp til 2 mill (Datatilsynet 2024).',
    losning: 'Automatisk arbeidstid-logging basert på sjekk-inn/sjekk-ut + manuell overstyring ved unntak',
  },
  {
    smerte: 'Intimacy-koordinering avhenger av om noen "husket" å booke en koordinator',
    konsekvens: 'EU-samproduksjoner krever det dokumentert i forhåndsavtale — opptak uten kan kanselleres etter forhåndsvarsel',
    losning: 'Brief-flagger automatisk når scene-tagging indikerer intim eller fysisk-sensitiv scene — varsel om at intimacy coord må bookes',
  },
];

export function InnspillingsdagKoordineringPage() {
  return (
    <Box
      component="article"
      sx={{
        width: '100%',
        minHeight: '100vh',
        bgcolor: '#0a0a0f',
        color: '#e2e8f0',
        py: { xs: 5, md: 8 },
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'Innspillingsdag-koordinering — hvem er på sett og hva som faktisk koster når noe glipper',
            description:
              'En typisk norsk produksjons-dag har 20-40 mennesker på sett fordelt over 12+ roller. Når koordineringen glipper koster det 25-40k NOK per 90-minutters forsinkelse. Fem konkrete smerter og hva The Role Room gjør med dem.',
            author: { '@type': 'Organization', name: 'The Role Room' },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/innspillingsdag-koordinering',
            inLanguage: 'no',
            datePublished: '2026-05-26',
          }),
        }}
      />

      <Container maxWidth="md">
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <CameraRollIcon sx={{ color: '#fb923c' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#fb923c',
                fontWeight: 700,
              }}
            >
              Industry data · live-på-sett
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Innspillingsdag-koordinering — der koordineringen brenner i sanntid
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            En typisk norsk produksjons-dag har 20-40 mennesker på sett fordelt over 12+
            spesialiserte roller. AD-er kjører dagen. HMUA-teamet jobber mellom takes.
            Intimacy coordinator sikrer samtykke. Sett-medic har autoritet til å stoppe
            opptaket. Når koordineringen glipper koster det typisk 25-40.000 NOK per
            90-minutters forsinkelse — pluss skjult regulatorisk eksponering.
          </Typography>
        </Stack>

        {/* Live-på-sett-roller */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2 }}>
          Hvem er på sett en typisk dag
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 5 }}>
          {SET_ROLES.map((r) => (
            <Box
              key={r.role}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 2,
                bgcolor: 'rgba(251,146,60,0.05)',
                border: '1px solid rgba(251,146,60,0.2)',
              }}
            >
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mb: 0.5 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', md: '1.08rem' } }}>
                  {r.role}
                </Typography>
                <Chip
                  label={`×${r.typical_count}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(251,146,60,0.18)', color: '#fdba74', fontWeight: 800, fontSize: '0.78rem', height: 22 }}
                />
              </Stack>
              <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.95rem' }, lineHeight: 1.6 }}>
                {r.primary_job}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Koordinerings-smerter */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 2 }}>
          Fem koordinerings-smerter som koster penger og risiko
        </Typography>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {COORDINATION_PAINS.map((p, idx) => (
            <Box
              key={p.smerte}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
                <Chip
                  label={`#${idx + 1}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(244,114,182,0.18)', color: '#f9a8d4', fontWeight: 800, fontSize: '0.74rem', height: 22, minWidth: 32 }}
                />
                <Typography component="h3" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.05rem', md: '1.18rem' }, lineHeight: 1.3, flex: 1 }}>
                  {p.smerte}
                </Typography>
              </Stack>
              <Stack spacing={1.25}>
                <Box>
                  <Typography sx={{ color: 'rgba(248,113,113,0.85)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                    Konsekvens
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.96rem' }, lineHeight: 1.6 }}>
                    {p.konsekvens}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ color: '#86efac', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                    Vår tilnærming
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.9rem', md: '0.96rem' }, lineHeight: 1.6 }}>
                    {p.losning}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* CTA */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.2rem' }, mb: 1 }}>
            Er du AD eller line producer i Norge?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.65 }}>
            Vi vil høre hva dere faktisk gjør for å holde shoot-dagen flytende — og hvor det
            mest av tiden går tapt. Skriv til <code style={{ color: '#67e8f9', fontSize: '0.88rem' }}>daniel@creatorhubn.com</code>{' '}
            for 20 minutter kaffe. Vi bygger innspillingsdag-modulen sammen med dem som skal bruke den.
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få bransje-data + on-set-research i innboksen"
          body="Norwegian Casting Brief — hver fredag inkluderer ukens viktigste bransje-bevegelse + én konkret datapunkt. 4 minutter."
          source="innspillingsdag-koordinering"
        />
      </Container>
    </Box>
  );
}

export default InnspillingsdagKoordineringPage;
