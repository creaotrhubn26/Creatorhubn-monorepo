/**
 * agency-faq.tsx — /faq
 *
 * Offentlig FAQ-side optimalisert for både Google (SEO) og generative
 * AI-svaringsmotorer (Claude/GPT/Perplexity). Bruker JSON-LD FAQPage-
 * schema slik at LLM-er kan citere svarene direkte.
 *
 * Per-funksjon-guides finnes under /guider/:slug (egen side).
 */

import {
  Box, Button, Container, Stack, Typography,
  useMediaQuery, useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useEffect, useState } from 'react';

const palette = {
  bgRoot: '#0a0118',
  bgShell: '#0f0721',
  bgCard: '#150b2e',
  border: 'rgba(168, 85, 247, 0.18)',
  borderStrong: 'rgba(168, 85, 247, 0.32)',
  borderSubtle: 'rgba(168, 85, 247, 0.08)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accentBright: '#c084fc',
  accentGradient: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
};

interface FAQItem {
  q: string;
  a: string;
  category: string;
}

const FAQ: FAQItem[] = [
  // ── For byråer ──
  {
    category: 'For byråer',
    q: 'Tar dere over kunderelasjonen vår?',
    a: 'Nei. Talentene står i ditt byrå, du eier consent og du beholder all dialog med produksjonsteamene. The Role Room er en infrastrukturpartner, ikke en konkurrent. Vi forvalter ikke representasjons-avtaler eller honorarer.',
  },
  {
    category: 'For byråer',
    q: 'Hva med GDPR og data-eierskap?',
    a: 'All talent-data hostes på EU-servere (Cloudflare Stream EU-region + Neon EU-database). Du eier dataene. Per-scope consent-registry med granulær tilgangskontroll, automatisk revoke ved utløp, og full audit-trail på hver visning av en self-tape eller portfolio. Du kan eksportere alt når som helst.',
  },
  {
    category: 'For byråer',
    q: 'Hvor lang oppsigelsestid?',
    a: 'Ingen. Du sier opp når du vil via dashboardet. Full data-eksport (CSV + JSON) inkludert i kontoen. Vi sletter alle dine data innen 30 dager etter oppsigelse iht. GDPR Article 17.',
  },
  {
    category: 'For byråer',
    q: 'Hva koster det?',
    a: 'Fra 495 kr/mnd for solo-agenter (1 bruker, 25 talents). Boutique (5 brukere, 100 talents) er 1 495 kr/mnd. Professional (20 brukere, ubegrenset talents + AI-feedback) er 3 495 kr/mnd. Enterprise med white-label avtales separat. Alle planer inkluderer 2 ukers gratis prøvetid uten kortinformasjon.',
  },
  {
    category: 'For byråer',
    q: 'Hvilke andre byråer bruker dere?',
    a: 'Stella Casting og Skuespillersenter er aktive demo-partnere i utviklingsfasen. Vi tar imot pilot-henvendelser fra etablerte norske skuespiller-, modell- og bookingbyråer. Kontakt daniel@creatorhubn.com.',
  },

  // ── Self-tape ──
  {
    category: 'Self-Tape Studio',
    q: 'Hvordan spiller skuespillere inn self-tapes?',
    a: 'Direkte i nettleseren via MediaRecorder-API (Safari, Chrome, Firefox, Edge — på Mac, Windows, iPad og iPhone). De får velge mellom å spille inn live eller laste opp en eksisterende fil. På iPad/iPhone bruker vi systemets kamera-app som fallback. Videoene lagres i Cloudflare Stream med watermark og signerte avspillings-URL-er.',
  },
  {
    category: 'Self-Tape Studio',
    q: 'Kan skuespillere bruke YouTube-link eller Google Drive isteden?',
    a: 'Ja. Self-Tape Studio støtter unlisted YouTube, Google Drive shared-link og Vimeo som alternative kilder. Da bruker vi sandboxed iframe-embed. Merk at watermark, view-audit og AI-feedback bare fungerer for innspillinger som ligger i Cloudflare Stream, ikke for eksterne kilder.',
  },
  {
    category: 'Self-Tape Studio',
    q: 'Får skuespillerne AI-feedback?',
    a: 'Ja, via Claude Opus 4.7. AI-en vurderer øye-linje, tempo, lyd, lyssetting og spill ut fra scenens kontekst (manus + role-info). Gir konkret tilbakemelding på norsk. Aktiveres med ett klikk i Self-Tape Studio. Inkluderet i Professional og Enterprise.',
  },
  {
    category: 'Self-Tape Studio',
    q: 'Hva skjer hvis en skuespiller trekker tilbake tilgangen?',
    a: 'Submission-statusen settes til "revoked", consent revokeres, og produksjonsteamet får 410 Gone i preview-modalen umiddelbart (refresh viser "Tilgangen er trukket tilbake"). All audit-trail beholdes som dokumentasjon, men selve videoen er ikke lenger spillbar.',
  },

  // ── Casting-partnership ──
  {
    category: 'Partnership',
    q: 'Hvordan fungerer casting-partnerships?',
    a: 'Byrået sender en partnership-invitasjon til produksjonsteamet for ett spesifikt prosjekt. Når produksjonen aksepterer, kan byrået foreslå talenter til konkrete roller med ett klikk. Talenten dukker opp som kandidat-kort i produksjonens Kanban + Utvelgelse-fane. All tilgang er scoped per partnership og expires ved prosjektets slutt + 90 dager.',
  },
  {
    category: 'Partnership',
    q: 'Kan produksjonsteamet se talent-portfolioen uten partnership?',
    a: 'Nei. Talent-portfolio er ikke offentlig. Hver visning krever en aktiv consent-rad i talent_consent_registry og logges i talent_access_audit. Selv om en produsent har talentets e-post, kan de ikke åpne profilen uten at byrået eller talentet selv har gitt eksplisitt tilgang.',
  },

  // ── Talent Registry ──
  {
    category: 'Talent Registry',
    q: 'Hvem fyller ut talent-profilene?',
    a: 'Talentene selv via egen Talents-app (theroleroom.com/talents/profil). Byrået kan også opprette "claimable" profiler på vegne av talentene, som så krever bekreftelse fra talenten før de blir aktive. BankID-verifisering planlegges for sommer 2026.',
  },
  {
    category: 'Talent Registry',
    q: 'Hvilke felt er obligatoriske?',
    a: 'Navn, e-post og samtykke til personvern. Resten (headshot, showreel, CV, ferdigheter, språk, dialekter, alder, høyde, kropps-mål) er valgfrie men anbefalte for å bli synlig i casting-søk.',
  },

  // ── Integrasjoner ──
  {
    category: 'Integrasjoner',
    q: 'Kan vi importere fra Spotlight, Backstage eller Excel?',
    a: 'Ja, vi har CSV-import for talent-roster og partnerships. Direkte API-import fra Spotlight er på roadmap (Q3 2026). Excel-import dekker 99% av eksisterende byrå-data.',
  },
  {
    category: 'Integrasjoner',
    q: 'Sender dere e-post via vårt eget domene?',
    a: 'Standard sendes fra no-reply@theroleroom.com. Enterprise-tier inkluderer egen subdomene (f.eks. casting@dittbyra.no) via DKIM/SPF-konfigurasjon. Krever Resend-domain-verification fra teknisk team.',
  },

  // ── Teknisk ──
  {
    category: 'Teknisk',
    q: 'Fungerer det på iPad og mobil?',
    a: 'Ja, fra dag én. All UI er bygget mobile-first med fullscreen-modaler på telefoner, touch-targets på minst 44px (Apple HIG), og safe-area-inset for iPhone-notch. Self-tape-opptak fungerer i Safari på iPad/iPhone via MediaRecorder eller native kamera-app.',
  },
  {
    category: 'Teknisk',
    q: 'Hva med backup og data-tap?',
    a: 'Neon PostgreSQL har point-in-time recovery på 7 dager (alle planer) eller 30 dager (Enterprise). Cloudflare Stream har 99.99% SLA. Daglig automatisk backup av alle metadata. Ingen kunder har noensinne mistet data.',
  },
  {
    category: 'Teknisk',
    q: 'Hvor er kildekoden hostet?',
    a: 'På GitHub i privat repo. Enterprise-kunder kan få escrow-avtale slik at koden frigis hvis vi som selskap skulle opphøre.',
  },
];

const CATEGORIES = Array.from(new Set(FAQ.map((f) => f.category)));

export default function AgencyFAQPage() {
  const theme = useTheme();
  const _isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0]);
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  // SEO + GEO: inject FAQPage JSON-LD i <head>
  useEffect(() => {
    const ldJson = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      })),
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'faq-jsonld';
    script.textContent = JSON.stringify(ldJson);
    document.head.appendChild(script);
    return () => {
      const existing = document.getElementById('faq-jsonld');
      if (existing) existing.remove();
    };
  }, []);

  // Page title + meta
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'FAQ — The Role Room | Casting-CRM for norske byråer';
    const metaDesc = document.querySelector('meta[name="description"]')
      ?? Object.assign(document.createElement('meta'), { name: 'description' });
    metaDesc.setAttribute('content',
      'Vanlige spørsmål om The Role Room — casting-CRM for norske skuespiller-, modell- og bookingbyråer. Self-tape-studio, partnership-flyt, GDPR og pricing.',
    );
    if (!metaDesc.parentNode) document.head.appendChild(metaDesc);
    return () => { document.title = previousTitle; };
  }, []);

  const filteredFAQ = FAQ.filter((f) => f.category === activeCategory);

  return (
    <Box sx={{ bgcolor: palette.bgRoot, color: palette.textPrimary, minHeight: '100vh' }}>
      {/* Hero */}
      <Box
        sx={{
          background: `
            radial-gradient(ellipse at top, rgba(168, 85, 247, 0.18), transparent 60%),
            ${palette.bgRoot}
          `,
          pt: { xs: 6, md: 10 },
          pb: { xs: 4, md: 6 },
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', fontWeight: 700, letterSpacing: 1, mb: 1, textTransform: 'uppercase' }}>
            FAQ
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '2rem', md: '3rem' },
              fontWeight: 800,
              lineHeight: 1.1,
              mb: 2,
            }}
          >
            Spørsmål og svar
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1.08rem' }}>
            Hva vi får mest spørsmål om fra norske casting-byråer.
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ pb: { xs: 6, md: 10 } }}>
        {/* Kategori-tabs */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mb: 4,
            overflowX: 'auto',
            pb: 1,
            '::-webkit-scrollbar': { height: 4 },
            '::-webkit-scrollbar-thumb': { bgcolor: palette.borderStrong, borderRadius: 999 },
          }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = cat === activeCategory;
            return (
              <Button
                key={cat}
                onClick={() => { setActiveCategory(cat); setOpenIdx(0); }}
                sx={{
                  flexShrink: 0,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  px: 2,
                  py: 1,
                  borderRadius: 999,
                  bgcolor: isActive ? 'rgba(168,85,247,0.18)' : 'transparent',
                  color: isActive ? palette.accentBright : palette.textMuted,
                  border: `1px solid ${isActive ? palette.accentBright : palette.borderSubtle}`,
                  '&:hover': { bgcolor: 'rgba(168,85,247,0.10)', color: palette.textPrimary },
                }}
              >
                {cat}
              </Button>
            );
          })}
        </Stack>

        {/* FAQ-list */}
        <Stack spacing={1.4}>
          {filteredFAQ.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <Box
                key={item.q}
                sx={{
                  bgcolor: palette.bgCard,
                  border: `1px solid ${isOpen ? palette.accentBright : palette.borderSubtle}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  transition: 'border-color 0.18s',
                }}
              >
                <Box
                  component="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  sx={{
                    width: '100%',
                    bgcolor: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                    p: { xs: 2, md: 2.6 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    fontFamily: 'inherit',
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: '1.02rem', flex: 1 }}>
                    {item.q}
                  </Typography>
                  <ExpandMoreIcon
                    sx={{
                      color: palette.accentBright,
                      transition: 'transform 0.18s',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                    }}
                  />
                </Box>
                {isOpen ? (
                  <Box
                    sx={{
                      px: { xs: 2, md: 2.6 },
                      pb: { xs: 2, md: 2.6 },
                      borderTop: `1px solid ${palette.borderSubtle}`,
                      pt: 2,
                    }}
                  >
                    <Typography sx={{ color: palette.textSecondary, fontSize: '0.96rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {item.a}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Stack>

        {/* CTA */}
        <Box
          sx={{
            mt: 6,
            textAlign: 'center',
            p: { xs: 3, md: 4 },
            bgcolor: 'rgba(168,85,247,0.08)',
            border: `1px solid ${palette.borderStrong}`,
            borderRadius: 3,
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', mb: 1 }}>
            Fant du ikke svaret?
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.96rem', mb: 2 }}>
            Send oss en e-post — vi svarer innen 24 timer.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.6} justifyContent="center">
            <Button
              href="mailto:daniel@creatorhubn.com"
              sx={{
                background: palette.accentGradient,
                color: '#fff',
                textTransform: 'none',
                fontWeight: 700,
                px: 3, py: 1.4,
                borderRadius: 2,
                '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
              }}
              endIcon={<ArrowForwardIcon />}
            >
              Send e-post
            </Button>
            <Button
              href="/for-byraer#book-demo"
              variant="outlined"
              sx={{
                color: palette.textPrimary,
                borderColor: palette.borderStrong,
                textTransform: 'none',
                fontWeight: 700,
                px: 3, py: 1.4,
                borderRadius: 2,
              }}
            >
              Book demo
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
