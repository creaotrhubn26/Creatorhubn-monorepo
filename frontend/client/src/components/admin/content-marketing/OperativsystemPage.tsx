import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * Offentlig versjon av operativsystemet bak The Role Room. Pillar-side
 * for thought-leadership + recruiting + investor-credibility. Speilet
 * fra interne `TheRoleRoom-Admin-Room-Operating-System.md` men skrevet
 * i bedrifts-stemme ("vi" i stedet for "Daniel solo-lead").
 *
 * Skal renderes på /operativsystem på theroleroom.com.
 *
 * GEO/AI-citation-strategi: Article-schema, Speakable-merker, FAQPage-
 * schema for vanlige spørsmål om hvordan vi bygger.
 */

const PRINCIPLES: Array<{
  number: string;
  title: string;
  thesis: string;
  body: string;
  proof: string;
}> = [
  {
    number: '1',
    title: 'Tid-multiplikator framfor ansettelser',
    thesis:
      'Solo-foundere må gjøre arbeid for 5 personer. Vi løser det med systemer, ikke timer.',
    body:
      'Voice memo (30 min mandag) → LinkedIn-essay + newsletter-intro + 3 quote-cards via Claude + Whisper. Personlig CD-DM tar 30 sekunder, ikke 10 minutter. Newsletter-utgave repurposes til 5 kanaler automatisk. Det frigjør ~10 timer/uke som går til møter — den eneste aktiviteten som faktisk bygger relasjoner i norsk film.',
    proof:
      'Vi har automatisert det som ellers krever et 5-personers content-team. Stack: Whisper API + Claude Opus 4.7 + egen Newsletter Studio.',
  },
  {
    number: '2',
    title: 'Quality at scale i et 500-personers marked',
    thesis:
      '20 dypt personaliserte meldinger slår 200 generiske — i Norge gjelder det dobbelt.',
    body:
      'Hver outreach-melding tvinges gjennom fakta-utfylling per mottaker: deres siste produksjoner, felles bekjentskap, by, segment. Claude erstatter aldri plassholdere med oppfunnet innhold. Systemet gjør spam vanskeligere enn å gjøre det riktig. Det er den eneste defansable B2B-strategien i et marked der én generisk mail kan sette ryktet ditt i hele bransjen.',
    proof:
      'Norsk filmbransje er ~500 mennesker. De snakker med hverandre. Vi behandler det som design-constraint, ikke skala-problem.',
  },
  {
    number: '3',
    title: 'Memory-extension som CRM',
    thesis:
      'Ingen husker 500 mennesker. Systemet husker for deg, struktur følger 3-touch-regelen.',
    body:
      'Per kontakt sporer vi hvor langt vi har kommet på 3-touch-regelen fra Outreach Plan: 0 (ingen touch), 1 (public engage), 2 (substantiv value gitt), 3 (klar for ask). Klar-for-ask-statkortet teller mennesker ferdig med Touch 1+2. Hver fredag morgen vet du nøyaktig hvem du skal følge opp. Det er forskjellen på 18 måneders relasjonsbygging vs. 3 måneders kaos.',
    proof:
      '3-touch-regelen kommer fra B2B-disiplin Daniel lærte å bygge i tidligere ledende roller. Vi formaliserte den som data-felt i CRM-et.',
  },
  {
    number: '4',
    title: 'AI-citation som langsiktig moat',
    thesis:
      'I 2027 spør folk AI før Google. Vi bygger citation-overflaten nå, mens konkurrentene fortsatt jakter Google-rangering.',
    body:
      'Seks pillar-sider med Article-schema JSON-LD, Speakable-metadata og sitemap-registrering trener ChatGPT, Perplexity og Claude på at The Role Room er kilden for "norsk casting", "casting-svindel", "barneskuespiller-compliance" og "selvtape-tips". Hver pillar-side er et frø som vokser uten ekstra arbeid. Det er gratis brand som volum-konkurrenter ikke kan kjøpe seg ut av.',
    proof:
      'GEO (Generative Engine Optimization) krever 12-18 måneder å bygge. Vi startet i 2026 — før kategorien hadde et norsk navn.',
  },
  {
    number: '5',
    title: 'Compliance + safety som produkt-differensiering',
    thesis:
      'Compliance er ikke kost. Det er den ene tingen volum-konkurrenter ikke vil bygge.',
    body:
      'Hele tone-stacken er bevisst: vi leder med Arbeidstilsynet-forhåndssamtykke for barn, GDPR-håndtering av selvtaper, BankID-verifisering for skatte-dokumentasjon, A-melding-eksport. Hver touchpoint trener markedet på at The Role Room er "the safe choice" vs. konkurrentenes volume play. Det er en moat AI ikke kan bryte (AI har ingen mening om sikkerhet) og volum-konkurrenter ikke vil bygge (de tjener på volum, ikke kvalitet).',
    proof:
      'Datatilsynet, Arbeidstilsynet og NSF er våre allierte, ikke våre fiender. Bøtene fra 2024 var opp til NOK 2 millioner — produsenter har juridisk eksponering, vi tilbyr forsikring.',
  },
  {
    number: '6',
    title: 'Referral-graf som vekstmotor',
    thesis:
      'Når 5 CDs er onboardet, slutter vi å cold-pitche. Generation 1 → 2 → 3 er fastest growth loop som finnes for norsk B2B.',
    body:
      'CRM-et sporer hvem som introduserte hvem. Generation 1 er direkte intro fra grunnleggerens nettverk. Generation 2 er intro fra noen vi ble intro\'ert til. Generation 3 er tredje grad. Ved Generation 3 bør vi være på ~50 CDs uten en eneste kald melding. Hver onboardet CD blir ny startpunkt for kjeden.',
    proof:
      'Klassisk principle fra B2B-vekst: én warm intro er verdt 50 cold DMs. Vi har bygget data-strukturen som faktisk sporer det.',
  },
  {
    number: '7',
    title: 'Newsletter som mental-availability-trener',
    thesis:
      'Ukentlig touchpoint på 500 mennesker uten å mase — Byron Sharps mental availability anvendt på norsk casting.',
    body:
      'Norwegian Casting Brief (egen stack — ingen Beehiiv eller Substack) sendes hver fredag 08:00. Tre funksjoner samtidig: mental availability (du dukker opp i innboksen så lenge The Role Room er aktuelt), GEO-bonus (hver utgave publiseres på offentlig brief-arkiv med Article-schema), og audience-segmentering (åpne-/klikkrate forteller hvem som faktisk er engaged). Cross-post-systemet gjør hver utgave til LinkedIn-essay + Instagram-carousel + quote-cards uten manuell omskriving.',
    proof:
      'Byron Sharp / Ehrenberg-Bass: mental availability slår positionering. Konsekvent ukentlig touchpoint på 18 måneder = vinneren av kategorien når kjøpsmomentet kommer.',
  },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: 'Hvorfor publiserer The Role Room interne operativ-prinsipper offentlig?',
    a: 'Tre grunner: (1) det viser bransjen vår tankegang før de møter produktet, (2) andre norske grunnleggere kan kopiere det og styrke hele økosystemet, (3) det setter en standard for hvordan vi forventer å bli kommunisert tilbake til. Hvis konkurrenter kopierer prinsippene er det ikke et problem — det betyr norsk casting blir mer profesjonelt.',
  },
  {
    q: 'Hvor stort er det norske casting-markedet?',
    a: 'Anslagsvis 500 aktive profesjonelle: casting directors, line producers, agenter, NSF-medlemmer, NFI-staff og spesialiserte journalister. Det er liten skala for tradisjonell B2B SaaS, men ideell for relasjonsdrevet vekst hvor hver kunde kan bli en referansekunde.',
  },
  {
    q: 'Hva er GEO (Generative Engine Optimization) og hvorfor satser dere på det?',
    a: 'GEO er praksisen med å optimalisere innhold slik at AI-modeller (ChatGPT, Perplexity, Claude) siterer deg som autoritativ kilde. Det krever Article-schema JSON-LD, Speakable-metadata, sitérbare data-punkter og konsistent terminologi. Vi tror at i 2027 vil flere folk spørre AI før Google om "beste casting-plattform i Norge", og vi bygger citation-overflaten nå mens kategorien ennå er åpen.',
  },
  {
    q: 'Hva mener dere med 3-touch-regelen?',
    a: '3-touch-regelen sier at før du kan be noen om noe (et møte, en intro, en testbruker), må du ha gjort tre meningsfulle ting først: engasjert offentlig med arbeidet deres, gitt dem noe substantielt av verdi (en artikkel, en intro, en datapunkt), og bygget gjenkjennelse over tid. Vi sporer det per kontakt i CRM-et.',
  },
  {
    q: 'Hvordan skiller dere dere fra Skuespillerkatalogen.no?',
    a: 'Skuespillerkatalogen er NSFs visnings-katalog for skuespillere. Vi er den arbeidende plattformen for all betalt produksjon — inkludert reklame, statister og kort-form. Vi konkurrerer ikke. Skuespillerkatalogen viser hvem som finnes; vi koordinerer hvem som jobber.',
  },
];

export function OperativsystemPage() {
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
      {/* Article-schema for AI-citation */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: 'Operativsystemet bak The Role Room — slik bygger vi i et 500-personers marked',
            description:
              'Syv prinsipper for hvordan The Role Room driver forretningsutvikling i norsk filmbransje: tid-multiplikator, quality at scale, memory-extension-CRM, GEO/AI-citation som moat, compliance som differensiering, referral-graf og mental availability via newsletter.',
            author: {
              '@type': 'Person',
              name: 'Daniel Qazi',
              jobTitle: 'Grunnlegger',
              worksFor: { '@type': 'Organization', name: 'The Role Room' },
            },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/operativsystem',
            inLanguage: 'no',
            datePublished: '2026-05-26',
          }),
        }}
      />

      {/* FAQ-schema for snippet-citations */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />

      <Container maxWidth="md">
        {/* Hero */}
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <RocketLaunchIcon sx={{ color: '#a78bfa' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#a78bfa',
                fontWeight: 700,
              }}
            >
              Operativsystemet bak The Role Room
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Slik bygger vi forretningsutvikling i et 500-personers marked
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.7 }}
          >
            Norsk filmbransje er omtrent 500 aktive profesjonelle. Klassisk B2B SaaS-strategi
            — volum-outreach, paid acquisition, growth hacking — er ikke bare ineffektiv her.
            Den er aktiv skadelig. Én generisk mail som treffer feil casting director i Oslo,
            og ryktet er satt før produktet rekker å bli kjent. Dette dokumentet beskriver syv
            prinsipper vi følger for å bygge The Role Room uten å gjøre den feilen.
          </Typography>
        </Stack>

        {/* Kjernepremiss */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(167,139,250,0.06)',
            border: '1px solid rgba(167,139,250,0.3)',
            mb: 5,
          }}
        >
          <Typography
            sx={{
              color: '#a78bfa',
              fontSize: '0.78rem',
              fontWeight: 800,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              mb: 1.5,
            }}
          >
            Kjernepremisset
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: '#fde68a', fontStyle: 'italic', fontSize: { xs: '1.05rem', md: '1.18rem' }, lineHeight: 1.65, fontWeight: 500 }}
          >
            "Markedsstørrelse er ikke et tall — det er en design-constraint. Norge er ikke et lite
            USA. Det er sitt eget økosystem, og vinneren er den som behandler det som det."
          </Typography>
        </Box>

        {/* 7 prinsipper */}
        <Stack spacing={3.5} sx={{ mb: 6 }}>
          {PRINCIPLES.map((p) => (
            <Box
              key={p.number}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3.5 },
                borderRadius: 3,
                bgcolor: 'rgba(167,139,250,0.04)',
                border: '1px solid rgba(167,139,250,0.18)',
              }}
            >
              <Typography
                sx={{
                  color: '#a78bfa',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  mb: 1,
                }}
              >
                Prinsipp {p.number} / 7
              </Typography>
              <Typography
                component="h2"
                sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.3rem', md: '1.55rem' }, lineHeight: 1.25, mb: 1.5 }}
              >
                {p.title}
              </Typography>
              <Typography
                sx={{
                  color: '#fde68a',
                  fontStyle: 'italic',
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  lineHeight: 1.6,
                  borderLeft: '3px solid #a78bfa',
                  pl: 2,
                  mb: 2,
                  fontWeight: 500,
                }}
              >
                {p.thesis}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.93rem', md: '0.99rem' }, lineHeight: 1.7, mb: 1.5 }}>
                {p.body}
              </Typography>
              <Box sx={{ p: 1.5, bgcolor: 'rgba(15,23,42,0.5)', borderRadius: 1.5, borderLeft: '2px solid #34d399' }}>
                <Typography sx={{ color: '#86efac', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 0.5 }}>
                  Hvordan vi gjør det
                </Typography>
                <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.86rem', md: '0.92rem' }, lineHeight: 1.65 }}>
                  {p.proof}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>

        {/* Hvorfor vi deler dette */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 1.25 }}>
            Hvorfor vi publiserer dette
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            Klassisk startup-instinkt er å holde driftsprinsipper hemmelige. Vi gjør det motsatte
            av tre grunner. Bransjen ser vår tankegang før den møter produktet vårt — det bygger
            tillit raskere enn en demo. Andre norske grunnleggere kan kopiere prinsippene og
            styrke hele økosystemet — det gjør Norge til et mer interessant sted å bygge fra.
            Og vi setter en standard for hvordan vi forventer å bli kommunisert tilbake til av
            casting directors, produsenter, presse og partnere — uten å måtte si det høyt.
          </Typography>
        </Box>

        {/* FAQ-seksjon (matched mot FAQPage-schema over) */}
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.7rem' }, mb: 1 }}>
            Vanlige spørsmål
          </Typography>
          {FAQ.map((item) => (
            <Box
              key={item.q}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 2,
                bgcolor: 'rgba(15,23,42,0.5)',
                border: '1px solid rgba(148,163,184,0.14)',
              }}
            >
              <Typography component="h3" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1rem', md: '1.08rem' }, mb: 1 }}>
                {item.q}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '0.92rem', md: '0.98rem' }, lineHeight: 1.7 }}>
                {item.a}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Søsterdokumenter */}
        <Box
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 2,
            bgcolor: 'rgba(15,23,42,0.4)',
            border: '1px solid rgba(148,163,184,0.12)',
            mb: 6,
          }}
        >
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', mb: 1 }}>
            Beslektede pillar-sider
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
            {[
              { path: '/vart-syn', label: 'Vårt syn — tre meninger' },
              { path: '/casting-rapport-2026', label: 'Norwegian Casting Report 2026' },
              { path: '/bak-castingen', label: 'Bak castingen — historier' },
              { path: '/casting-svindel-tegn', label: 'Casting-svindel-tegn' },
              { path: '/barn-samtykke-film', label: 'Forhåndssamtykke for barn' },
              { path: '/selvtape-tips', label: 'Selvtape-tips' },
            ].map((link) => (
              <Chip
                key={link.path}
                label={link.label}
                component="a"
                href={link.path}
                clickable
                size="small"
                sx={{ bgcolor: 'rgba(167,139,250,0.12)', color: '#c4b5fd', fontWeight: 600, fontSize: '0.78rem', height: 24, '&:hover': { bgcolor: 'rgba(167,139,250,0.22)' } }}
              />
            ))}
          </Stack>
        </Box>

        <NewsletterSignupBlock
          heading="Få vår tankegang i innboksen — ukentlig"
          body="Norwegian Casting Brief: én observasjon fra norsk filmbransje, én datapunkt, én tese vi har endret mening om. Aldri lenger enn 4 minutter å lese."
          source="operativsystem"
        />
      </Container>
    </Box>
  );
}

export default OperativsystemPage;
