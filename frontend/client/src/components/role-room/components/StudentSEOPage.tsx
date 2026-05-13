/**
 * StudentSEOPage.tsx
 *
 * SEO-landingssider rettet mot studenter som søker etter
 * relevante studier (filmskole, casting director, regi,
 * produksjonsledelse). Målet er å fange organisk trafikk
 * fra studie-søk og vise hvordan The Role Room kan brukes
 * som praksis-verktøy i studiet.
 *
 * Robust-prinsipper:
 *   - Én config-drevet komponent → alle ruter
 *   - Hver config har trygge fallbacks (ingen render-krasj ved
 *     manglende felt)
 *   - Studieliste markert med "indikativ" disclaimer — vi
 *     gjør ikke spesifikke claims om innhold på studiene
 *   - Path-parsing er tolerant (trailing-slash, case-insensitive)
 *   - JSON-LD `Course` schema injiseres for hver studie-relatert
 *     side for rich-snippet-boost
 *
 * SEO-strategi: hver side har H1 som matcher target-keyword.
 * Meta-tags settes via inline-skript i theroleroom.html FØR React
 * mounter, så Googlebot leser riktig title/description selv om
 * JS-rendering henger.
 */

import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { roleRoomAnalytics } from '../services/roleRoomAnalytics';
import { clarityTag, clarityEvent } from '@/lib/clarity';
import BlockRenderer from '../cms/BlockRenderer';
import { isBlockArray, type Block, type Locale, DEFAULT_LOCALE } from '../cms/blockSchema';
import MovieFilterIcon from '@mui/icons-material/MovieFilter';
import GroupsIcon from '@mui/icons-material/Groups';
import VideoCameraFrontIcon from '@mui/icons-material/VideoCameraFront';
import AssignmentIcon from '@mui/icons-material/Assignment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';

export type StudentPageKey =
  | 'for-studenter'
  | 'film-tv-utdanning'
  | 'casting-director-utdanning'
  | 'regissor-verktoy'
  | 'produksjonsledelse-studie'
  | 'innholdsprodusenter'
  | 'innholdsproduksjon-studie'
  | 'dansestudio';

interface UsageExample {
  title: string;
  body: string;
}

interface StudentPageConfig {
  key: StudentPageKey;
  h1: string;
  subtitle: string;
  intro: string;
  /** Vises i hero som chip. */
  audience: string;
  /** Konkrete eksempler på bruk i studiet. */
  usageExamples: UsageExample[];
  /** Optional liste over norske studier som er spesielt relevante. */
  relatedStudies?: { name: string; institution: string; note?: string }[];
  /** Hvilke The Role Room-features som er mest relevante for målgruppen. */
  highlightedFeatures: string[];
  /** CTA-knapp-tekst. */
  ctaLabel: string;
}

/* ──────────────────────────────────────────────────────────────────
 * Norske studier — indikativ liste basert på offentlig informasjon.
 * Vi gjør ikke claims om innhold; lar leser sjekke studiestedet selv.
 * ────────────────────────────────────────────────────────────────── */
const NORWEGIAN_FILM_STUDIES: { name: string; institution: string; note?: string }[] = [
  { name: 'Bachelor i film- og fjernsynsproduksjon', institution: 'Den Norske Filmskolen (HiNN, Lillehammer)' },
  { name: 'Film og TV', institution: 'NISS (Nordisk Institutt for Scene og Studio)' },
  { name: 'Filmproduksjon', institution: 'Høyskolen Kristiania (Westerdals)' },
  { name: 'Film- og videoproduksjon', institution: 'NTNU' },
  { name: 'Film og TV-fag', institution: 'Noroff' },
  { name: 'Bachelor i film og TV', institution: 'OsloMet — Storbyuniversitetet' },
];

/* ──────────────────────────────────────────────────────────────────
 * Konfigurasjon per route. Hver fyller en bestemt søk-intent.
 * ────────────────────────────────────────────────────────────────── */
const STUDENT_PAGE_CONFIGS: Record<StudentPageKey, StudentPageConfig> = {
  'for-studenter': {
    key: 'for-studenter',
    h1: 'The Role Room for filmstudenter',
    subtitle: 'Praksis-verktøy for casting, regi og produksjonsledelse-studenter',
    audience: 'Filmstudenter · Mediestudier · Praktikum',
    intro:
      'The Role Room er en gratis casting- og produksjonsplattform du kan bruke i studie-oppgaver, eksamensprosjekter og masteroppgaver. Bygg en realistisk casting-pipeline, planlegg auditions, lag shotlist og storyboard — akkurat slik bransjen jobber.',
    usageExamples: [
      {
        title: 'Bachelor-/masteroppgaven i casting',
        body: 'Bygg en komplett casting-pipeline for en filmidé. Dokumenter prosess-valg (rolle-krav → kandidat-pool → audition → cast) med skjermbilder rett fra The Role Room.',
      },
      {
        title: 'Produksjonsledelse-øvelse',
        body: 'Planlegg en fiktiv 5-dagers opptaksperiode med crew, lokasjoner og utstyr. Gantt-visning og konflikt-deteksjon viser deg hvor planen knekker.',
      },
      {
        title: 'Studio-prosjekter med medstudenter',
        body: 'Inviter klassekamerater til samme prosjekt-arbeidsrom. Del kandidater, audition-opptak og storyboard i sanntid — øv på koordinering som i ekte produksjon.',
      },
      {
        title: 'Shotlist + storyboard for regi-oppgaver',
        body: 'Tegn storyboard rett i nettleseren, link hver shot til manus-rad, og send hele pakka til kameraman som PDF — komplett pre-produksjonsmappe på minutter.',
      },
    ],
    relatedStudies: NORWEGIAN_FILM_STUDIES,
    highlightedFeatures: [
      'Casting-pipeline med kanban',
      'Audition-planlegging',
      'Storyboard & shotlist',
      'Produksjonsplan & call-sheet',
      'Crew & lokasjon-koordinering',
      'Talentportal (skuespiller-database)',
    ],
    ctaLabel: 'Opprett gratis student-prosjekt',
  },
  'film-tv-utdanning': {
    key: 'film-tv-utdanning',
    h1: 'Film- og TV-utdanning i Norge',
    subtitle: 'Oversikt over relevante studier — og verktøy for praksis',
    audience: 'Studie-søkere · Rådgivere · Bransje-nettverk',
    intro:
      'Norge har flere anerkjente studier innen film- og TV-produksjon. Felles for dem alle: det forventes at studenter kjenner verktøyene bransjen faktisk bruker. The Role Room samler casting, audition, crew, lokasjon, shotlist og produksjonsplan i ett arbeidsrom — gratis å bruke gjennom hele studiet.',
    usageExamples: [
      {
        title: 'Komme i gang før studiet starter',
        body: 'Bygg en mini-portfolio: 1-2 kort-prosjekter i The Role Room som viser at du forstår hvordan en produksjon er strukturert.',
      },
      {
        title: 'Bruk i klasseromsundervisning',
        body: 'Foreleseren kan dele et arbeidsrom med hele klassen for å demonstrere et reelt prosjekt-flow uten å investere i full Hollywood-stack.',
      },
      {
        title: 'Avgangs- og masterprosjekt',
        body: 'Dokumenter hele produksjonen — fra første rolle-utlysning til siste opptaksdag — med skjermbilder og eksport-PDF fra The Role Room.',
      },
    ],
    relatedStudies: NORWEGIAN_FILM_STUDIES,
    highlightedFeatures: [
      'Casting-pipeline',
      'Audition-planlegging',
      'Storyboard & shotlist',
      'Produksjonsplan',
      'Crew & lokasjon',
    ],
    ctaLabel: 'Test plattformen som student',
  },
  'casting-director-utdanning': {
    key: 'casting-director-utdanning',
    h1: 'Bli casting director — utdanning og verktøy',
    subtitle: 'Yrkesvei, sentrale ferdigheter, og verktøyene bransjen bruker',
    audience: 'Aspirerende casting directors · Manusforfattere · Regissører',
    intro:
      'Casting director er et bransjeyrke uten én fastsatt utdanningsvei i Norge. De fleste bygger seg opp gjennom kombinasjon av filmstudier, audition-assistent-jobber og praktisk casting-arbeid. The Role Room er bygget av norske casting-folk og gir deg en realistisk arbeidsflate du kan bygge mappe på.',
    usageExamples: [
      {
        title: 'Bygge en casting-mappe',
        body: 'Dokumenter dine egne casting-prosjekter — selv øvelser fra studiet — i The Role Room. Eksporter til PDF når du skal vise mappa di til en produsent.',
      },
      {
        title: 'Praktikum hos casting director',
        body: 'De fleste casting-byrå i Norge bruker enten Excel, Casting Networks, eller egne systemer. The Role Room er en gratis sandkasse hvor du kan øve på flyten før du går i jobb.',
      },
      {
        title: 'Talent-database for kortfilm',
        body: 'Bygg din egen kandidat-pool over tid — ta vare på skuespillere du har sett, link til selvtape-opptak, kategoriser på alder/type/erfaring.',
      },
    ],
    highlightedFeatures: [
      'Casting-pipeline med 7 statuser',
      'Audition-planlegging',
      'Kandidat-pool og talent-database',
      'Selvtape-opptak fra skuespillere',
      'Kontrakter og samtykkeskjemaer',
    ],
    ctaLabel: 'Start din casting-mappe',
  },
  'regissor-verktoy': {
    key: 'regissor-verktoy',
    h1: 'Verktøy for filmregi-studenter',
    subtitle: 'Fra manus til opptak — alt en regissør trenger i pre-produksjon',
    audience: 'Regi-studenter · Manusforfattere · Filmstudenter',
    intro:
      'En regissørs pre-produksjon handler om å oversette manus til et konkret opptaksplan. The Role Room dekker hele kjeden: skriv manus, organiser scener i historiestruktur, tegn storyboard, bygg shotlist, og koordiner med kameraman + lyd + lokasjon.',
    usageExamples: [
      {
        title: 'Storyboard direkte i nettleseren',
        body: 'Tegn shot-for-shot uten å investere i tegnenotat eller skannere. Eksporter som PDF til kameraman.',
      },
      {
        title: 'Manus-til-shotlist-flow',
        body: 'Importer manus, marker hver scene/shot, og bygg shotlist med kameravinkel, brennvidde og lengde — alt knyttet til samme prosjekt.',
      },
      {
        title: 'Casting-samarbeid',
        body: 'Som regissør jobber du tett med casting director. The Role Room gir delt arbeidsflate hvor du kan se selvtape-opptak, gi notater, og signere av på finale cast.',
      },
    ],
    highlightedFeatures: [
      'Manus med filmatisk formatering',
      'Beatboard (historiestruktur)',
      'Storyboard-tegne-verktøy',
      'Shotlist med AI-foreslåtte vinkler',
      'Casting-pipeline',
      'Produksjonsplan',
    ],
    ctaLabel: 'Lag ditt første regi-prosjekt',
  },
  'produksjonsledelse-studie': {
    key: 'produksjonsledelse-studie',
    h1: 'Produksjonsledelse — studie og verktøy',
    subtitle: 'Crew, lokasjon, utstyr, økonomi, call-sheet — alt på ett sted',
    audience: 'Produksjonsledelse-studenter · Line producer-aspiranter · Prosjektledere',
    intro:
      'Produksjonsledelse i film og TV handler om å holde plan, budsjett og crew sammen mens kreative valg endrer seg fra dag til dag. The Role Room samler bookings, samtykker, call-sheets og krise-håndtering i ett arbeidsrom så ingenting faller mellom stoler.',
    usageExamples: [
      {
        title: 'Produksjonsplan for studieprosjekt',
        body: 'Bygg en uke-til-uke plan med crew-tilgjengelighet og lokasjons-booking. Konflikt-deteksjon advarer når en crew-rolle dobbel-bookes.',
      },
      {
        title: 'Call-sheet på minutter',
        body: 'Generer komplett call-sheet med alle crew-roller, kontaktinfo, lokasjon, vær-data og tidsplan — eksporter PDF eller send som e-post.',
      },
      {
        title: 'Utstyr- og lokasjons-bookinger',
        body: 'Spor kamera- og lyd-utstyr med tilgjengelighet over tid. Lokasjoner med kart, kontaktperson, og permit-status.',
      },
    ],
    highlightedFeatures: [
      'Crew-koordinering med Gantt',
      'Utstyr-booking',
      'Lokasjons-administrasjon',
      'Call-sheet generering',
      'Konflikt-deteksjon',
      'Kontrakter og samtykker',
    ],
    ctaLabel: 'Test produksjons-planen',
  },
  'innholdsprodusenter': {
    key: 'innholdsprodusenter',
    h1: 'The Role Room for innholdsprodusenter',
    subtitle: 'For YouTube-skapere, podcastere, TikTok- og Instagram-produsenter',
    audience: 'Innholdsprodusenter · Content creators · Sosiale-medier-skapere',
    intro:
      'Innholdsproduksjon på YouTube, TikTok, Instagram og podcast krever like mye koordinering som tradisjonell film — bare i raskere takt. The Role Room samler manus, idébank, skuespiller-/gjest-pool, opptaksplan og publiserings-kalender i ett arbeidsrom så du kan produsere mer uten å miste oversikten.',
    usageExamples: [
      {
        title: 'YouTube-serie med faste medvirkende',
        body: 'Bygg en kandidat-/gjeste-pool. Spor hvem som har deltatt i hvilke episoder, hvilke avtaler som er signert, og hvem som er kontaktet for kommende episoder.',
      },
      {
        title: 'Podcast-produksjon med gjeste-flyt',
        body: 'Hold styr på gjeste-pipeline (invitert → bekreftet → spilt inn → publisert). Audition-pool funker som gjeste-research-bank.',
      },
      {
        title: 'TikTok/Instagram-skapere med crew',
        body: 'Når du jobber med fotograf, redigerer eller stylist — koordiner opptaksdager, lokasjoner og utstyr uten å falle tilbake til SMS-tråder.',
      },
      {
        title: 'Branded content med avtaler',
        body: 'Bygg kontrakt og samtykkeskjema for medvirkende. Spor signeringer per prosjekt. Profesjonelt nivå uten å trenge advokat for hver kampanje.',
      },
    ],
    highlightedFeatures: [
      'Manus + idébank',
      'Gjeste- og kandidat-pool',
      'Produksjonskalender',
      'Crew- og utstyrs-booking',
      'Kontrakter og samtykker',
      'Storyboard for video',
    ],
    ctaLabel: 'Start ditt skaper-prosjekt',
  },
  'innholdsproduksjon-studie': {
    key: 'innholdsproduksjon-studie',
    h1: 'Innholdsproduksjon — studie og verktøy',
    subtitle: 'For studenter som studerer digital innholdsproduksjon, sosiale medier og merkevarekommunikasjon',
    audience: 'Studenter i digital kommunikasjon · Markedsføring · Sosiale medier',
    intro:
      'Innholdsproduksjon-studier dekker både den kreative og strategiske siden av digital kommunikasjon. The Role Room gir deg en gratis profesjonell arbeidsflate hvor du kan øve på hele kjeden — fra idé og manus til opptak, gjeste-/medvirkende-koordinering, publisering og rapportering.',
    usageExamples: [
      {
        title: 'Case-oppgave i digital kommunikasjon',
        body: 'Bygg en komplett kampanje-plan for en fiktiv (eller ekte) merkevare. Dokumenter prosessen med skjermbilder rett fra The Role Room.',
      },
      {
        title: 'Klassesamarbeid på student-podcast',
        body: 'Inviter klassekamerater til samme arbeidsrom. Roter rolle-ansvar (produsent, redigerer, gjeste-koordinator) for å øve på hele kjeden.',
      },
      {
        title: 'Praksisplass-prosjekt',
        body: 'Bruk The Role Room som dokumentasjon når du går i praksis hos et byrå eller media-hus — vis hvordan du strukturerte prosjekter du var med på.',
      },
    ],
    relatedStudies: [
      { name: 'Digital kommunikasjon og markedsføring', institution: 'Høyskolen Kristiania' },
      { name: 'Bachelor i sosiale medier og kommunikasjon', institution: 'Høyskolen Kristiania' },
      { name: 'Mediedesign og kommunikasjon', institution: 'NTNU' },
      { name: 'Multimediedesign', institution: 'Noroff' },
      { name: 'Bachelor i film og TV', institution: 'OsloMet' },
    ],
    highlightedFeatures: [
      'Manus + idébank',
      'Storyboard og shotlist',
      'Produksjonskalender',
      'Kandidat-/gjeste-pool',
      'Kontrakter og samtykker',
    ],
    ctaLabel: 'Bygg ditt student-prosjekt',
  },
  'dansestudio': {
    key: 'dansestudio',
    h1: 'The Role Room for danse-studio og koreografer',
    subtitle: 'Audition, ensemble-administrasjon, prøveplan — bygget for moderne dans og scenekunst',
    audience: 'Danse-studio · Koreografer · Ensemble-ledere · Dansere',
    intro:
      'Danse-studio og koreografer trenger samme strukturerte arbeidsflate som filmproduksjoner — bare med fokus på audition-runder, prøve-perioder, kostyme/teknisk og forestillings-koordinering. The Role Room dekker hele flyten med spesifikk støtte for dans-prosjekter.',
    usageExamples: [
      {
        title: 'Audition-runde for ny forestilling',
        body: 'Sett opp audition-slots, send invitasjoner, ta opp selv-tape fra dansere, og bygg shortlist sammen med koreograf-kollegaer. Sammen-vurder kandidater i samme arbeidsrom.',
      },
      {
        title: 'Ensemble-administrasjon',
        body: 'Hold styr på faste dansere, gjeste-dansere, og roterende roller. Tilgjengelighets-kalender hindrer dobbel-booking når flere produksjoner går parallelt.',
      },
      {
        title: 'Prøveplan og forestillings-koordinering',
        body: 'Planlegg prøver, generalprøve og forestillinger i samme kalender. Konflikt-deteksjon når en danser er booket på to studio samtidig.',
      },
      {
        title: 'Kostyme-/utstyrs-booking',
        body: 'Spor kostymer per danser og forestilling. Utstyr (sko, sokker, kostymer) tilgjengelighets-sjekkes per prøvedag.',
      },
    ],
    highlightedFeatures: [
      'Audition-flow med selvtape',
      'Ensemble-/danser-pool',
      'Prøve- og forestillings-kalender',
      'Kostyme-/utstyrs-booking',
      'Kontrakter og samtykker',
      'Crew-koordinering (lys/lyd/teknisk)',
    ],
    ctaLabel: 'Bygg ditt danse-prosjekt',
  },
};

/* ──────────────────────────────────────────────────────────────────
 * Path-parser — tolerant for trailing-slash og case.
 * ────────────────────────────────────────────────────────────────── */
export function parseStudentPageFromPath(pathname: string): StudentPageKey | null {
  if (!pathname) return null;
  const normalized = pathname.replace(/\/+$/, '').toLowerCase().slice(1); // strip leading '/'
  if (normalized in STUDENT_PAGE_CONFIGS) {
    return normalized as StudentPageKey;
  }
  return null;
}

/* ──────────────────────────────────────────────────────────────────
 * JSON-LD injection — hver student-side får Course-schema for
 * Google rich-snippet. Defensive: ryddes opp ved unmount.
 * ────────────────────────────────────────────────────────────────── */
function useCourseSchema(config: StudentPageConfig) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const schemaId = `roleroom-course-schema-${config.key}`;
    document.querySelector(`script[data-schema-id="${schemaId}"]`)?.remove();

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Course',
      '@id': `https://theroleroom.com/${config.key}#course`,
      name: config.h1,
      description: config.intro.slice(0, 280),
      provider: { '@id': 'https://theroleroom.com/#organization' },
      educationalLevel: 'Higher education',
      audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
      inLanguage: 'no-NO',
      isAccessibleForFree: true,
      teaches: config.highlightedFeatures,
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-schema-id', schemaId);
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.querySelector(`script[data-schema-id="${schemaId}"]`)?.remove();
    };
  }, [config.key, config.h1, config.intro, config.highlightedFeatures]);
}

/* ──────────────────────────────────────────────────────────────────
 * Visning per konfig.
 * ────────────────────────────────────────────────────────────────── */
function PageView({ config }: { config: StudentPageConfig }) {
  useCourseSchema(config);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
      <Stack spacing={4}>
        {/* Hero */}
        <Stack spacing={2} sx={{ maxWidth: 820 }}>
          <Chip
            icon={<SchoolIcon sx={{ color: '#ddd6fe !important' }} />}
            label={config.audience}
            size="small"
            sx={{
              alignSelf: 'flex-start',
              bgcolor: 'rgba(167,139,250,0.16)',
              color: '#ddd6fe',
              fontWeight: 600,
              '& .MuiChip-icon': { color: '#ddd6fe' },
            }}
          />
          <Typography
            component="h1"
            sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.8rem', md: '2.6rem' }, lineHeight: 1.15 }}
          >
            {config.h1}
          </Typography>
          <Typography
            sx={{ color: 'rgba(203,213,225,0.86)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.6 }}
          >
            {config.subtitle}
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.96rem', lineHeight: 1.7 }}>
            {config.intro}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
            <Button
              href="/"
              variant="contained"
              size="large"
              sx={{
                bgcolor: '#a78bfa',
                color: '#0b1120',
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: '#c4b5fd' },
              }}
            >
              {config.ctaLabel}
            </Button>
            <Button
              href="/for-studenter"
              variant="outlined"
              size="large"
              sx={{
                color: 'rgba(203,213,225,0.92)',
                borderColor: 'rgba(148,163,184,0.32)',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': { borderColor: 'rgba(203,213,225,0.6)', bgcolor: 'rgba(148,163,184,0.06)' },
              }}
            >
              Andre studie-ressurser
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)' }} />

        {/* Slik bruker du The Role Room i studiet */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <EmojiObjectsIcon sx={{ color: '#fbbf24' }} />
            <Typography
              component="h2"
              sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.8rem' } }}
            >
              Slik bruker du The Role Room i studiet
            </Typography>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            }}
          >
            {config.usageExamples.map((ex) => (
              <Card
                key={ex.title}
                sx={{
                  bgcolor: 'rgba(2,6,23,0.42)',
                  border: '1px solid rgba(148,163,184,0.16)',
                  height: '100%',
                }}
              >
                <CardContent>
                  <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.05rem', mb: 1 }}>
                    {ex.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.93rem', lineHeight: 1.6 }}>
                    {ex.body}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Box>

        {/* Relevante features */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <AssignmentIcon sx={{ color: '#a78bfa' }} />
            <Typography
              component="h2"
              sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.8rem' } }}
            >
              Mest relevante funksjoner
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {config.highlightedFeatures.map((f) => (
              <Chip
                key={f}
                label={f}
                sx={{
                  bgcolor: 'rgba(167,139,250,0.10)',
                  color: '#ddd6fe',
                  border: '1px solid rgba(167,139,250,0.32)',
                  fontWeight: 500,
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* Norske studier */}
        {config.relatedStudies && config.relatedStudies.length > 0 ? (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <SchoolIcon sx={{ color: '#22d3ee' }} />
              <Typography
                component="h2"
                sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.8rem' } }}
              >
                Aktuelle norske studier
              </Typography>
            </Stack>
            <Alert
              severity="info"
              sx={{
                mb: 2,
                bgcolor: 'rgba(59,130,246,0.08)',
                color: 'rgba(203,213,225,0.92)',
                border: '1px solid rgba(59,130,246,0.24)',
                '& .MuiAlert-icon': { color: '#60a5fa' },
              }}
            >
              Listen er indikativ basert på offentlig studie-informasjon. Sjekk studiestedets egne sider for oppdaterte opptak-krav, søknadsfrister og emne-innhold.
            </Alert>
            <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
              {config.relatedStudies.map((study, idx) => (
                <Stack
                  key={`${study.name}-${idx}`}
                  direction="row"
                  spacing={1.5}
                  alignItems="flex-start"
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: '1px solid rgba(148,163,184,0.14)',
                    bgcolor: 'rgba(2,6,23,0.34)',
                  }}
                >
                  <MovieFilterIcon sx={{ color: '#22d3ee', mt: 0.3, fontSize: 20 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.95rem' }}>
                      {study.name}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.82rem' }}>
                      {study.institution}
                    </Typography>
                    {study.note ? (
                      <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.78rem', mt: 0.5 }}>
                        {study.note}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>
              ))}
            </Box>
          </Box>
        ) : null}

        {/* CTA */}
        <Card
          sx={{
            bgcolor: 'rgba(167,139,250,0.10)',
            border: '1px solid rgba(167,139,250,0.32)',
            mt: 2,
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: 'center' }}>
            <Typography
              component="h2"
              sx={{ color: '#f8fafc', fontWeight: 800, fontSize: { xs: '1.4rem', md: '1.6rem' }, mb: 1 }}
            >
              Gratis for studenter
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.86)', mb: 2.5 }}>
              Opprett ditt første studie-prosjekt på minutter. Ingen kredittkort, ingen tidsbegrensning.
            </Typography>
            <Button
              href="/"
              variant="contained"
              size="large"
              sx={{
                bgcolor: '#a78bfa',
                color: '#0b1120',
                textTransform: 'none',
                fontWeight: 700,
                px: 4,
                '&:hover': { bgcolor: '#c4b5fd' },
              }}
            >
              {config.ctaLabel}
            </Button>
          </CardContent>
        </Card>

        {/* Krysslenker til andre student-sider */}
        <Box>
          <Typography sx={{ color: 'rgba(148,163,184,0.85)', fontSize: '0.86rem', mb: 1.5 }}>
            Også relevant:
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {Object.values(STUDENT_PAGE_CONFIGS)
              .filter((c) => c.key !== config.key)
              .map((c) => (
                <Button
                  key={c.key}
                  href={`/${c.key}`}
                  size="small"
                  variant="outlined"
                  endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    color: 'rgba(203,213,225,0.85)',
                    borderColor: 'rgba(148,163,184,0.24)',
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.82rem',
                    '&:hover': { borderColor: 'rgba(167,139,250,0.48)', bgcolor: 'rgba(167,139,250,0.06)' },
                  }}
                >
                  {c.h1}
                </Button>
              ))}
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}

export interface StudentSEOPageProps {
  pageKey: StudentPageKey;
  locale?: Locale;
}

/**
 * Henter CMS-content fra /api/cms/pages/:slug og merger den inn over
 * hardkodet default. CMS-content er KUN partial-override — slik at
 * AdminRoom kan endre title/intro uten å miste struktur eller
 * usage-examples som ikke er overstyrt.
 *
 * Ved API-feil eller 404 brukes hardkodet default — siden viser
 * alltid noe selv om backend er nede.
 */
function mergeOverrides(defaults: StudentPageConfig, overrides: Partial<StudentPageConfig>): StudentPageConfig {
  return {
    ...defaults,
    ...(typeof overrides.h1 === 'string' && overrides.h1 ? { h1: overrides.h1 } : {}),
    ...(typeof overrides.subtitle === 'string' && overrides.subtitle ? { subtitle: overrides.subtitle } : {}),
    ...(typeof overrides.intro === 'string' && overrides.intro ? { intro: overrides.intro } : {}),
    ...(typeof overrides.audience === 'string' && overrides.audience ? { audience: overrides.audience } : {}),
    ...(typeof overrides.ctaLabel === 'string' && overrides.ctaLabel ? { ctaLabel: overrides.ctaLabel } : {}),
    ...(Array.isArray(overrides.usageExamples) && overrides.usageExamples.length > 0
      ? { usageExamples: overrides.usageExamples }
      : {}),
    ...(Array.isArray(overrides.highlightedFeatures) && overrides.highlightedFeatures.length > 0
      ? { highlightedFeatures: overrides.highlightedFeatures }
      : {}),
    ...(Array.isArray(overrides.relatedStudies)
      ? { relatedStudies: overrides.relatedStudies }
      : {}),
  };
}

interface CmsRenderState {
  blocks: Block[] | null;
  config: StudentPageConfig;
}

function useCmsContent(pageKey: StudentPageKey): CmsRenderState {
  const defaults = STUDENT_PAGE_CONFIGS[pageKey] ?? STUDENT_PAGE_CONFIGS['for-studenter'];
  const [merged, setMerged] = useState<StudentPageConfig>(defaults);
  const [blocks, setBlocks] = useState<Block[] | null>(null);

  // Server-content (cached, 5-min CDN)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cms/pages/${pageKey}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.success || !data?.page?.content) return;
        const content = data.page.content as Record<string, unknown>;
        if (isBlockArray(content.blocks)) {
          setBlocks(content.blocks);
          return;
        }
        setMerged(mergeOverrides(defaults, content as Partial<StudentPageConfig>));
      })
      .catch(() => {
        // Stillegående fallback til defaults — vi viser fortsatt siden.
      });
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  // Live preview: hør på postMessage fra AdminRoom CMS-editor.
  // Lar editoren oppdatere innholdet sanntid uten API-roundtrip.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const msg = event.data as { type?: string; pageKey?: string; content?: Record<string, unknown> };
      if (msg.type !== 'roleroom-cms-preview') return;
      if (msg.pageKey !== pageKey) return;
      if (!msg.content || typeof msg.content !== 'object') return;
      if (isBlockArray(msg.content.blocks)) {
        setBlocks(msg.content.blocks);
        return;
      }
      setBlocks(null);
      setMerged(mergeOverrides(defaults, msg.content as Partial<StudentPageConfig>));
    };
    window.addEventListener('message', handler);
    // Annonsér at preview er klar — editoren sender da current state
    window.parent?.postMessage({ type: 'roleroom-cms-preview-ready', pageKey }, '*');
    return () => window.removeEventListener('message', handler);
  }, [pageKey, defaults]);

  return { blocks, config: merged };
}

export default function StudentSEOPage({ pageKey, locale = DEFAULT_LOCALE }: StudentSEOPageProps) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
      // Lagre referral-slug så login-flow kan attribuere innlogging til SEO-side
      try {
        sessionStorage.setItem('roleroom_seo_referral', JSON.stringify({
          type: 'student',
          slug: pageKey,
          capturedAt: Date.now(),
        }));
      } catch {
        // Ignorer storage-feil
      }
    }
    roleRoomAnalytics.seoPageViewed({
      page_type: 'student',
      page_slug: pageKey,
    });
    // Clarity custom-tags lar oss filtrere session-replays per side-type
    clarityTag('page_type', 'student-seo');
    clarityTag('page_slug', pageKey);
    clarityEvent('seo_page_viewed');
  }, [pageKey]);

  const { blocks, config } = useCmsContent(pageKey);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b1120', color: '#e2e8f0' }}>
      {blocks ? <BlockRenderer blocks={blocks} locale={locale} /> : <PageView config={config} />}
    </Box>
  );
}

/** Export defaults så AdminRoom kan vise hardkodet content side-by-side med CMS-overrides. */
export { STUDENT_PAGE_CONFIGS };
