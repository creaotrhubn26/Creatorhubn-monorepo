import { Box, Chip, Container, Stack, Typography } from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import NewsletterSignupBlock from './NewsletterSignupBlock';

/**
 * /produksjons-os — kjerneposisjoneringen-pillar. Fronter setningen fra
 * THE-ROLE-ROOM-PRODUKTDOKUMENTASJON.md sektion 1.1:
 *
 *   "The Role Room er operativsystemet for film- og innholdsproduksjoner
 *    — det tar en produksjon fra idé og planlegging, gjennom casting og
 *    gjennomføring, helt til den er distribuert og sett."
 *
 * Tre live vertikaler + AI-lag i beta. USPer fra sektion 6.5. Avgrensning
 * (hva produktet IKKE er) fra sektion 1.3. Article + Product schema.
 */

type Vertical = {
  badge: string;
  title: string;
  audience: string;
  pricing: string;
  description: string;
  modules: string[];
  color: string;
};

const VERTICALS: Vertical[] = [
  {
    badge: 'Live',
    title: 'Produksjons-OS',
    audience: 'Produksjonsteam (produsenter, regissører, casting directors, foto, manus)',
    pricing: '795 kr per sete per måned, minimum 3 seter',
    description:
      'Hjertet for produksjonsteam. Eier produksjonen fra første idé til distribuert og sett — med transparent økonomi- og godkjenningsflyt mellom leverandør og kunde.',
    modules: [
      'Casting & talent — prosjekter, roller, kandidatpool, scheduling, samtykke med signatur',
      'Produksjonsledelse — crew, lokasjoner, props, produksjonsdager, shot lists, utstyrsbooking',
      'Manus — versjonering, scene-breakdown (akter, INT/EXT, karakterliste), screenplay-format',
      'Klient & økonomi — faser, budsjett (estimat vs. faktisk i NOK), client reviews, intake-skjema',
    ],
    color: '#22d3ee',
  },
  {
    badge: 'Live',
    title: 'Innholdsprodusent-løsning',
    audience: 'Innholdsprodusenter (frilans og små team)',
    pricing: '495 kr per sete per måned, minimum 1 sete',
    description:
      'For den enkelte innholdsprodusenten som leverer digital markedsføring og innhold til klienter. Tre jobber: markedsføring, innholdsplanlegging, og samarbeidssystem mellom leverandør og kunde.',
    modules: [
      'Annonsering — Meta, Google, LinkedIn, TikTok i ett grensesnitt med spend-sync og KPI',
      'Content marketing — kampanjeplan, carousel-generator, feed-strategi',
      'Social publishing — direkte Instagram-publisering uten å hoppe mellom verktøy',
      'Klient-samarbeid — transparent godkjenningsflyt med kunden gjennom hele leveransen',
    ],
    color: '#a78bfa',
  },
  {
    badge: 'Live',
    title: 'Dansestudio-vertikal',
    audience: 'Profesjonelle dansere og dansestudio',
    pricing: 'Fra 149 kr/mnd (frilans) til 2 490+ kr/mnd (studio Pro)',
    description:
      'Egen vertikal for profesjonelle dansere og dansestudio. Booking, koreografi-planlegging, casting til oppdrag, medlemshåndtering, formasjonstrening, event-oversikt, skadelogg, øvingslogg.',
    modules: [
      'Booking av timer + klasser med automatisk konflikt-sjekk',
      'Koreografi & produksjon — planlegg dansenummer og forestillinger',
      'Casting til danseoppdrag + åpne auditions-oversikt',
      'Medlemshåndtering med formasjonstrening, skade- og øvingslogger',
    ],
    color: '#f472b6',
  },
];

type USP = {
  number: string;
  title: string;
  description: string;
};

const USPS: USP[] = [
  {
    number: '01',
    title: 'Eier hele flyten — fra idé til sett',
    description:
      'De fleste verktøy stopper når filmen er ferdig. The Role Room fortsetter til den er distribuert og sett. Annonsering, content marketing og publisering er andre halvdel av løftet — ikke påheng.',
  },
  {
    number: '02',
    title: 'Eier starten — idéen',
    description:
      'Idéer forsvinner ikke. Plattformen løser en reell flaskehals: gode idéer som går tapt mellom produksjoner. Idé-pipeline gjør bruken kontinuerlig, ikke episodisk — også når ingen produksjon ruller.',
  },
  {
    number: '03',
    title: 'Integrer, ikke angrip',
    description:
      'NSF, NFI, NRK, TV2, foto.no — partnere, ikke konkurrenter. Vi blir infrastrukturen de etablerte aktørene selv ønsker å bruke, ikke det som forsøker å fortrenge dem. Det åpner samarbeid som ellers ville vært umulig.',
  },
  {
    number: '04',
    title: 'Norsk- og EU-native',
    description:
      'EU-datalagring, EHF-faktura, NAV-rapport, BRREG-oppslag, norsk juridisk data, BankID på vei. Passer det lokale markedet på en måte internasjonale verktøy ikke gjør.',
  },
  {
    number: '05',
    title: 'Transparens og "alle i loop"',
    description:
      'Delt sannhet mellom leverandør og kunde gjennom hele produksjonen. Klient ser samme budsjett-tall som produsent. Godkjenninger logges. Ingen "har du fått min e-post?"-spørsmål.',
  },
  {
    number: '06',
    title: 'AI-lag på toppen (beta)',
    description:
      'The Role Room Agent — drevet av Claude — kobler kundens virksomhet til konkurrentanalyse, partner-discovery, merch-leverandører og ads-strategi. Testes internt, skipes når den er beviselig nyttig.',
  },
];

type NotThis = {
  not: string;
  why: string;
};

const NOT_THIS: NotThis[] = [
  {
    not: 'En castingplattform',
    why: 'Casting er inngangsdøra, ikke sentrum. Å redusere oss til "en castingplattform" er som å kalle et operativsystem "en fil-utforsker".',
  },
  {
    not: 'En talent-markedsplass',
    why: 'Systemet er bygget rundt produksjonen (prosjektet), ikke rundt enkeltpersoners karrierer. Vi er ikke en "LinkedIn for skuespillere".',
  },
  {
    not: 'Et verktøy som slutter når filmen er ferdig',
    why: 'Løftet strekker seg fra "ferdig produsert" til "distribuert og sett". Markedsføring og annonser er andre halvdel av løftet.',
  },
  {
    not: 'Et regnskaps- eller lønnssystem',
    why: 'Vi gir økonomisk oversikt, men fører ikke regnskap. A-melding, lønnskjøring og rapportering ligger i regnskapssystemet ditt.',
  },
  {
    not: 'Et finansieringsverktøy',
    why: 'Vi hjelper deg modne idéen fram til den er klar til å søke (NFI, tilskudd, investorer). Selve finansieringen skjer utenfor produktet.',
  },
  {
    not: 'Et generisk prosjektstyringsverktøy',
    why: 'Spesialisert for film- og innholdsproduksjon — ikke et tomt Kanban-brett. Forstår rollene: regissør, produsent, casting director, foto, manus.',
  },
];

export function ProduksjonsOSPage() {
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
            headline: 'Produksjons-OS — operativsystemet for film- og innholdsproduksjon i Norge',
            description:
              'The Role Room er operativsystemet for film- og innholdsproduksjoner. Tre live vertikaler: Produksjons-OS for produksjonsteam, innholdsprodusent-løsning og dansestudio. Tar produksjonen fra idé til distribuert og sett.',
            author: { '@type': 'Organization', name: 'The Role Room' },
            publisher: {
              '@type': 'Organization',
              name: 'The Role Room',
              logo: { '@type': 'ImageObject', url: 'https://theroleroom.com/logo.png' },
            },
            mainEntityOfPage: 'https://theroleroom.com/produksjons-os',
            inLanguage: 'no',
            datePublished: '2026-05-28',
          }),
        }}
      />

      {/* SoftwareApplication-schema for Google + AI product-discovery */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'The Role Room',
            description:
              'Operativsystemet for film- og innholdsproduksjon. Casting, manus, produksjonsledelse, klient-samarbeid, annonsering og distribusjon i ett system.',
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Web',
            offers: [
              {
                '@type': 'Offer',
                name: 'Produksjonsteam',
                price: '795',
                priceCurrency: 'NOK',
                description: 'Per sete per måned, minimum 3 seter',
              },
              {
                '@type': 'Offer',
                name: 'Innholdsprodusent',
                price: '495',
                priceCurrency: 'NOK',
                description: 'Per sete per måned, minimum 1 sete',
              },
              {
                '@type': 'Offer',
                name: 'Dansestudio',
                price: '149',
                priceCurrency: 'NOK',
                description: 'Fra 149 kr/mnd (frilans) til 2 490+ kr/mnd (studio Pro)',
              },
            ],
            inLanguage: 'no',
          }),
        }}
      />

      <Container maxWidth="md">
        {/* Hero */}
        <Stack spacing={2.5} sx={{ mb: 5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <HubIcon sx={{ color: '#22d3ee' }} />
            <Typography
              sx={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: { xs: '0.84rem', md: '0.92rem' },
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                color: '#22d3ee',
                fontWeight: 700,
              }}
            >
              Produktposisjon · The Role Room
            </Typography>
          </Stack>
          <Typography
            component="h1"
            sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '2rem', md: '2.8rem' }, lineHeight: 1.15 }}
          >
            Operativsystemet for film- og innholdsproduksjon
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1.02rem', md: '1.15rem' }, lineHeight: 1.7 }}
          >
            The Role Room er operativsystemet for film- og innholdsproduksjoner — det tar
            en produksjon fra idé og planlegging, gjennom casting og gjennomføring, helt til
            den er distribuert og sett av et publikum. Casting er inngangsdøra. Produktet
            eier reisen videre.
          </Typography>
        </Stack>

        {/* Pullquote — manifest */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.3)',
            mb: 6,
          }}
        >
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{
              color: '#fde68a',
              fontStyle: 'italic',
              fontSize: { xs: '1.1rem', md: '1.3rem' },
              lineHeight: 1.55,
              fontWeight: 500,
            }}
          >
            "Hver god fortelling starter med de rette menneskene i de rette rollene."
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.82rem', mt: 1, fontWeight: 600 }}>
            — Manifest, The Role Room
          </Typography>
        </Box>

        {/* Tre vertikaler */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 2 }}>
          Tre live vertikaler + et AI-lag i beta
        </Typography>
        <Stack spacing={3} sx={{ mb: 6 }}>
          {VERTICALS.map((v) => (
            <Box
              key={v.title}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3.5 },
                borderRadius: 3,
                bgcolor: `${v.color}0d`,
                border: `1px solid ${v.color}38`,
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
                <Chip
                  label={v.badge}
                  size="small"
                  sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#86efac', fontWeight: 800, fontSize: '0.72rem', letterSpacing: '0.1em' }}
                />
                <Typography component="h3" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.3rem', md: '1.5rem' } }}>
                  {v.title}
                </Typography>
              </Stack>
              <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.85rem', fontWeight: 600, mb: 0.5 }}>
                For: {v.audience}
              </Typography>
              <Typography sx={{ color: v.color, fontSize: '0.85rem', fontWeight: 700, mb: 2 }}>
                {v.pricing}
              </Typography>
              <Typography
                sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.95rem', md: '1rem' }, lineHeight: 1.65, mb: 2 }}
              >
                {v.description}
              </Typography>
              <Stack spacing={0.75}>
                {v.modules.map((m) => (
                  <Stack key={m} direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircleIcon sx={{ color: v.color, fontSize: 18, mt: 0.25, flexShrink: 0 }} />
                    <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                      {m}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          ))}

          {/* AI-lag beta */}
          <Box
            sx={{
              p: { xs: 2.5, md: 3 },
              borderRadius: 3,
              bgcolor: 'rgba(251,191,36,0.06)',
              border: '1px dashed rgba(251,191,36,0.4)',
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
              <Chip
                label="Beta — ikke skipet"
                size="small"
                sx={{ bgcolor: 'rgba(251,191,36,0.2)', color: '#fde68a', fontWeight: 800, fontSize: '0.7rem' }}
              />
              <Typography component="h3" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.2rem', md: '1.4rem' } }}>
                The Role Room Agent
              </Typography>
            </Stack>
            <Typography sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.94rem', lineHeight: 1.65 }}>
              AI-lag drevet av Claude. Testes internt — ikke et live kundeprodukt ennå.
              Når den skipes leverer den konkurrentanalyse, partner-discovery, merch-
              kobling og ads-strategi for kundens virksomhet. Med transparent oversikt
              mellom leverandør og kunde.
            </Typography>
          </Box>
        </Stack>

        {/* USPer */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 2 }}>
          Den unike posisjonen
        </Typography>
        <Stack spacing={2.5} sx={{ mb: 6 }}>
          {USPS.map((u) => (
            <Box
              key={u.number}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                bgcolor: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.18)',
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Typography
                  sx={{
                    color: 'rgba(167,139,250,0.4)',
                    fontWeight: 800,
                    fontSize: { xs: '1.8rem', md: '2.2rem' },
                    lineHeight: 1,
                    fontFamily: '"Courier New", Courier, monospace',
                  }}
                >
                  {u.number}
                </Typography>
                <Box>
                  <Typography component="h3" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 0.75 }}>
                    {u.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.85)', fontSize: { xs: '0.94rem', md: '0.98rem' }, lineHeight: 1.65 }}>
                    {u.description}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Avgrensning — hva vi IKKE er */}
        <Typography component="h2" sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: '1.5rem', md: '1.8rem' }, mb: 1 }}>
          Hva The Role Room IKKE er
        </Typography>
        <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.92rem', mb: 3 }}>
          Avgrensningen er like viktig som definisjonen. Det vi ikke er, definerer hva vi faktisk er.
        </Typography>
        <Stack spacing={1.5} sx={{ mb: 6 }}>
          {NOT_THIS.map((n) => (
            <Box
              key={n.not}
              className="geo-speakable"
              data-speakable="true"
              sx={{
                p: { xs: 2, md: 2.5 },
                borderRadius: 2,
                bgcolor: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <CancelIcon sx={{ color: 'rgba(248,113,113,0.7)', fontSize: 20, mt: 0.25, flexShrink: 0 }} />
                <Box>
                  <Typography sx={{ color: '#fca5a5', fontWeight: 700, fontSize: { xs: '0.98rem', md: '1.05rem' }, mb: 0.5 }}>
                    Ikke {n.not}
                  </Typography>
                  <Typography sx={{ color: 'rgba(229,231,235,0.78)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {n.why}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Status-ærlighet (linje 30 fra dokumentet) */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            borderRadius: 3,
            bgcolor: 'rgba(167,139,250,0.06)',
            border: '1px solid rgba(167,139,250,0.3)',
            mb: 6,
          }}
        >
          <Typography component="h2" sx={{ color: '#fff', fontWeight: 700, fontSize: { xs: '1.1rem', md: '1.25rem' }, mb: 1.5 }}>
            Ærlig status — hva vi er og hva vi ikke er ennå
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{ color: 'rgba(229,231,235,0.82)', fontSize: { xs: '0.94rem', md: '1rem' }, lineHeight: 1.7 }}
          >
            Pre-revenue. I stor grad solo-drevet. Privacy/compliance (DPA, BankID) er i pipeline,
            ikke fullført. Den største visjonen forutsetter partnerskap, kapital, teknologi og team
            — bygd opp gjennom 2026 og 2027. Vi sier dette åpent fordi The Role Room blir
            infrastruktur, og infrastruktur tåler ingen marketing-overdrivelse.
          </Typography>
        </Box>

        {/* Ambisjon */}
        <Box
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 3,
            bgcolor: 'rgba(34,211,238,0.06)',
            border: '1px solid rgba(34,211,238,0.3)',
            mb: 6,
          }}
        >
          <Typography sx={{ color: '#22d3ee', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1.5 }}>
            10-årsvisjonen
          </Typography>
          <Typography
            className="geo-speakable"
            data-speakable="true"
            sx={{
              color: '#fde68a',
              fontStyle: 'italic',
              fontSize: { xs: '1.05rem', md: '1.2rem' },
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            "Det foretrukne systemet som gjør at produksjon og prosjektstyring blir en fryd
            — ikke en byrde eller flaskehals. Bindevevet for film- og innholdsproduksjon."
          </Typography>
        </Box>

        <NewsletterSignupBlock
          heading="Få produkt-utvikling + bransje-data i innboksen"
          body="Norwegian Casting Brief — én bransje-observasjon, ett konkret datapunkt, én ting verdt å vite. 4 minutter."
          source="produksjons-os"
        />
      </Container>
    </Box>
  );
}

export default ProduksjonsOSPage;
