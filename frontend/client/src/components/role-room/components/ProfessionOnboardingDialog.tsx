import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Fade,
  Slide,
  Avatar,
  Chip,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  Movie as MovieIcon,
  CameraAlt as CameraIcon,
  Brush as ArtIcon,
  MusicNote as MusicIcon,
  Videocam as VideocamIcon,
  Search as SearchIcon,
  Assignment as TaskIcon,
  Timeline as TimelineIcon,
  CheckCircle as CheckIcon,
  Lightbulb as TipIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import settingsService from '../services/settingsService';
import { TeamIcon as GroupsIcon, ShareCustomIcon as ShareIcon } from './icons/CastingIcons';

export type ProfessionType = 
  | 'director' 
  | 'photographer' 
  | 'cinematographer' 
  | 'producer' 
  | 'art_director' 
  | 'music_video' 
  | 'commercial' 
  | 'documentary'
  | 'general';

interface OnboardingSlide {
  title: string;
  subtitle?: string;
  content: string;
  features?: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
  }>;
  tips?: string[];
  illustration?: React.ReactNode;
}

interface ProfessionOnboardingContent {
  welcomeTitle: string;
  welcomeSubtitle: string;
  professionIcon: React.ReactNode;
  professionColor: string;
  slides: OnboardingSlide[];
}

const professionContent: Record<ProfessionType, ProfessionOnboardingContent> = {
  director: {
    welcomeTitle: 'Velkommen, Regissør!',
    welcomeSubtitle: 'Din visjon fortjener de rette verktøyene',
    professionIcon: <MovieIcon sx={{ fontSize: 48 }} />,
    professionColor: '#e91e63',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Din digitale produksjonsassistent',
        content: 'The Role Room er et komplett planleggingsverktøy designet for å hjelpe deg med å organisere, visualisere og gjennomføre produksjoner på en effektiv måte. Fra casting til ferdig shot list - alt på ett sted.',
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Casting', 'Shot List', 'Storyboard', 'Team'].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(233,30,99,0.1)',
                  border: '1px solid rgba(233,30,99,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#e91e63', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: 'Som regissør får du...',
        subtitle: 'Verktøy skreddersydd for din arbeidsprosess',
        content: 'The Role Room gir deg full oversikt over produksjonen din, fra første idé til siste opptak.',
        features: [
          {
            icon: <VideocamIcon sx={{ color: '#e91e63' }} />,
            title: 'Visuell Shot List',
            description: 'Planlegg hver scene med detaljerte shot-beskrivelser, kameravinkler og referansebilder',
          },
          {
            icon: <GroupsIcon sx={{ color: '#e91e63' }} />,
            title: 'Casting-oversikt',
            description: 'Organiser auditions, sammenlign kandidater og ta informerte beslutninger om rollebesetning',
          },
          {
            icon: <TimelineIcon sx={{ color: '#e91e63' }} />,
            title: 'AI-generert Storyboard',
            description: 'La AI visualisere scenene dine basert på beskrivelsene du skriver',
          },
        ],
      },
      {
        title: 'Hvordan finne ting',
        subtitle: 'Navigasjon i The Role Room',
        content: 'Alt du trenger er organisert i logiske faner øverst i applikasjonen.',
        features: [
          {
            icon: <SearchIcon sx={{ color: '#10b981' }} />,
            title: 'Søkefunksjon',
            description: 'Bruk søkefeltet for å finne scener, roller, kandidater eller opptak raskt',
          },
          {
            icon: <TaskIcon sx={{ color: '#10b981' }} />,
            title: 'Faner og paneler',
            description: 'Bytt mellom Oversikt, Shot List, Roller, Kandidater og Team med ett klikk',
          },
          {
            icon: <MovieIcon sx={{ color: '#10b981' }} />,
            title: 'Scener-visning',
            description: 'Bruk Scener-fanen for å se alle opptak organisert etter scene og lokasjon',
          },
        ],
        tips: [
          'Bruk Ctrl/Cmd + F for rask søk',
          'Høyreklikk på elementer for hurtigmenyer',
          'Dra og slipp for å omorganisere shots',
        ],
      },
      {
        title: 'Del ansvar med teamet',
        subtitle: 'Samarbeid gjort enkelt',
        content: 'Inviter teammedlemmer og tildel oppgaver basert på deres rolle i produksjonen.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Del prosjektet',
            description: 'Inviter fotografer, produsenter og andre ved å dele en link eller sende invitasjoner',
          },
          {
            icon: <TaskIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Tildel oppgaver',
            description: 'Marker shots med ansvarlig person og følg fremdriften i sanntid',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Kanban-tavle',
            description: 'Bruk Team Dashboard for å se hvem som jobber med hva og hva som gjenstår',
          },
        ],
        tips: [
          'Bruk @-nevninger for å varsle teammedlemmer',
          'Sett frister på kritiske shots',
          'Bruk kommentarfeltet for diskusjoner',
        ],
      },
    ],
  },
  photographer: {
    welcomeTitle: 'Velkommen, Fotograf!',
    welcomeSubtitle: 'Planlegg det perfekte bildet',
    professionIcon: <CameraIcon sx={{ fontSize: 48 }} />,
    professionColor: '#10b981',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Ditt digitale planleggingsverktøy',
        content: 'The Role Room hjelper deg å organisere fotoshoots, holde oversikt over modeller og planlegge hver eneste shot før du trykker på utløseren.',
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Moodboard', 'Shot List', 'Modeller', 'Utstyr'].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#10b981', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: 'Som fotograf får du...',
        subtitle: 'Verktøy for profesjonell planlegging',
        content: 'Fra mood boards til ferdig shot list - planlegg effektivt og lever konsistent kvalitet.',
        features: [
          {
            icon: <CameraIcon sx={{ color: '#10b981' }} />,
            title: 'Detaljert Shot List',
            description: 'Spesifiser linse, blender, lyssetting og komposisjon for hver shot',
          },
          {
            icon: <GroupsIcon sx={{ color: '#10b981' }} />,
            title: 'Modell-database',
            description: 'Hold oversikt over modeller, deres mål og tidligere samarbeid',
          },
          {
            icon: <TimelineIcon sx={{ color: '#10b981' }} />,
            title: 'Tidsplanlegging',
            description: 'Estimer tid per shot og lag realistiske tidsplaner for shootet',
          },
        ],
      },
      {
        title: 'Hvordan finne ting',
        subtitle: 'Rask navigasjon',
        content: 'Finn det du trenger med intuitive søk og filterverktøy.',
        features: [
          {
            icon: <SearchIcon sx={{ color: '#10b981' }} />,
            title: 'Smart søk',
            description: 'Søk etter modeller, locations eller spesifikke shots',
          },
          {
            icon: <TaskIcon sx={{ color: '#10b981' }} />,
            title: 'Kategorier',
            description: 'Organiser shots etter type: portrett, produkt, editorial, etc.',
          },
          {
            icon: <CameraIcon sx={{ color: '#10b981' }} />,
            title: 'Referansebilder',
            description: 'Last opp inspirasjon og referanser direkte til hver shot',
          },
        ],
        tips: [
          'Bruk filtre for å vise kun visse shot-typer',
          'Legg til tags for enklere søk senere',
          'Eksporter shot list som PDF for shootet',
        ],
      },
      {
        title: 'Samarbeid med teamet',
        subtitle: 'Profesjonelt teamarbeid',
        content: 'Del planene med stylister, makeup-artister og assistenter.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Del moodboards',
            description: 'Gi teamet tilgang til visjonen din før shootet',
          },
          {
            icon: <TaskIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Sjekklister',
            description: 'Opprett sjekklister for utstyr, styling og location',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Rollefordeling',
            description: 'Tildel ansvar til hvert teammedlem for smidig gjennomføring',
          },
        ],
      },
    ],
  },
  cinematographer: {
    welcomeTitle: 'Velkommen, Filmfotograf!',
    welcomeSubtitle: 'Visualiser historien din',
    professionIcon: <VideocamIcon sx={{ fontSize: 48 }} />,
    professionColor: '#f59e0b',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Profesjonell pre-produksjon',
        content: 'The Role Room er designet for å hjelpe filmfotografer med å planlegge kamerabevegelser, lyssetting og visuelle stilvalg før innspilling starter.',
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Kamera', 'Lys', 'Bevegelse', 'Farge'].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: 'Som filmfotograf får du...',
        subtitle: 'Tekniske verktøy for visuell historiefortelling',
        content: 'Planlegg hvert bilde med presisjon og kommuniser visjonen din effektivt.',
        features: [
          {
            icon: <VideocamIcon sx={{ color: '#f59e0b' }} />,
            title: 'Kamerabevegelser',
            description: 'Dokumenter dolly, crane, steadicam og drone-shots i detalj',
          },
          {
            icon: <TipIcon sx={{ color: '#f59e0b' }} />,
            title: 'Lysdesign',
            description: 'Planlegg lyssetting med referansebilder og tekniske notater',
          },
          {
            icon: <TimelineIcon sx={{ color: '#f59e0b' }} />,
            title: 'Storyboard',
            description: 'Visualiser sekvenser med AI-genererte storyboard-frames',
          },
        ],
      },
      {
        title: 'Hvordan finne ting',
        subtitle: 'Effektiv arbeidsflyt',
        content: 'Alt er organisert for rask tilgang under hektiske produksjoner.',
        features: [
          {
            icon: <SearchIcon sx={{ color: '#f59e0b' }} />,
            title: 'Scenebasert søk',
            description: 'Finn shots basert på scene, lokasjon eller tid på dagen',
          },
          {
            icon: <TaskIcon sx={{ color: '#f59e0b' }} />,
            title: 'Tekniske spesifikasjoner',
            description: 'Filtrer etter linse, kameratype eller bevegelsestype',
          },
          {
            icon: <VideocamIcon sx={{ color: '#f59e0b' }} />,
            title: 'Utstyrssjekkliste',
            description: 'Se hvilke shots som krever spesialutstyr',
          },
        ],
      },
      {
        title: 'Kommuniser med teamet',
        subtitle: 'Sømløst samarbeid',
        content: 'Del den visuelle planen med regissør, gaffer og kamerateam.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Del lookbook',
            description: 'Gi hele teamet tilgang til visuelle referanser',
          },
          {
            icon: <TaskIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Lys-planer',
            description: 'Del detaljerte lysoppsett med gaffer og elektriker',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Kamera-team',
            description: 'Koordiner med focus puller, dolly grip og assistenter',
          },
        ],
      },
    ],
  },
  producer: {
    welcomeTitle: 'Velkommen, Innholdsprodusent!',
    welcomeSubtitle: 'Planlegg, produser og lever innhold med flyt',
    professionIcon: <TaskIcon sx={{ fontSize: 48 }} />,
    professionColor: '#8b5cf6',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Innholdsproduksjon samlet på ett sted',
        content: 'The Role Room gir deg oversikt over idé, storyboard, media, klientsamarbeid og levering, slik at du kan drive hele innholdsproduksjonen fra én arbeidsflate.',
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Storyboard', 'Media', 'Tidslinje', 'Levering'].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#8b5cf6', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: 'Som innholdsprodusent får du...',
        subtitle: 'Arbeidsflyt for innhold og leveranser',
        content: 'Hold styr på fremdrift, versjoner, leveranser og samarbeid uten å hoppe mellom flere verktøy.',
        features: [
          {
            icon: <TimelineIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Tidslinje og status',
            description: 'Se hvor produksjonen står, hva som gjenstår og hva som er klart for levering',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Klientsamarbeid',
            description: 'Samle tilbakemeldinger, del materiale og hold kunden oppdatert i samme flyt',
          },
          {
            icon: <TaskIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Eksport og levering',
            description: 'Klargjør filer, overleveringer og produksjonsgrunnlag uten ekstra mellomledd',
          },
        ],
      },
      {
        title: 'Hvordan finne ting',
        subtitle: 'Rask tilgang til riktig workspace',
        content: 'Fanene i toppen er bygget for innholdsprodusentflyten, slik at du raskt kommer til storyboard, media, økonomi og levering.',
        features: [
          {
            icon: <SearchIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Storyboard og plan',
            description: 'Start i storyboardet og bygg opp innhold, shot-behov og struktur før opptak',
          },
          {
            icon: <TaskIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Media og økonomi',
            description: 'Bytt raskt mellom mediebibliotek, leveranser og økonomi uten å miste kontekst',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Klient og eksport',
            description: 'Finn alt som handler om godkjenning, deling og sluttlevering i egne dedikerte faner',
          },
        ],
      },
      {
        title: 'Koordiner leveransen',
        subtitle: 'Effektiv flyt fra idé til ferdig levering',
        content: 'Bruk The Role Room til å holde team, kunde og leveranser samlet rundt én tydelig produksjonsflyt.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#10b981' }} />,
            title: 'Del riktig materiale',
            description: 'Gi tilgang til storyboard, filer og leveranser uten å eksponere unødvendige arbeidsflater',
          },
          {
            icon: <TaskIcon sx={{ color: '#10b981' }} />,
            title: 'Hold produksjonen i bevegelse',
            description: 'Bruk tidslinje og statusvisning for å sikre at innholdet går fremover uten flaskehalser',
          },
          {
            icon: <CheckIcon sx={{ color: '#10b981' }} />,
            title: 'Samle godkjenninger',
            description: 'Bruk klientsamarbeid og eksportflyten til å få innspill og levere ferdig materiale raskere',
          },
        ],
      },
    ],
  },
  art_director: {
    welcomeTitle: 'Velkommen, Art Director!',
    welcomeSubtitle: 'Skap den visuelle identiteten',
    professionIcon: <ArtIcon sx={{ fontSize: 48 }} />,
    professionColor: '#ec4899',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Visuell planlegging',
        content: 'The Role Room hjelper deg å definere og kommunisere den visuelle retningen for produksjonen.',
        features: [
          {
            icon: <ArtIcon sx={{ color: '#ec4899' }} />,
            title: 'Mood boards',
            description: 'Samle referanser og inspirasjon på ett sted',
          },
          {
            icon: <CameraIcon sx={{ color: '#ec4899' }} />,
            title: 'Stilguider',
            description: 'Dokumenter fargepaletter, teksturer og rekvisitter',
          },
          {
            icon: <GroupsIcon sx={{ color: '#ec4899' }} />,
            title: 'Teamkommunikasjon',
            description: 'Del visjonen med rekvisittør og scenograf',
          },
        ],
      },
      {
        title: 'Hvordan finne ting',
        content: 'Bruk søk og kategorier for å finne referanser og spesifikasjoner raskt.',
        features: [
          {
            icon: <SearchIcon sx={{ color: '#ec4899' }} />,
            title: 'Visuelt søk',
            description: 'Finn referansebilder og mood boards',
          },
          {
            icon: <TaskIcon sx={{ color: '#ec4899' }} />,
            title: 'Scenebasert',
            description: 'Se art direction-notater per scene',
          },
        ],
      },
      {
        title: 'Del med teamet',
        content: 'Koordiner med scenografi, rekvisitt og kostyme.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Del stilguide',
            description: 'Gi alle tilgang til den visuelle retningen',
          },
          {
            icon: <TaskIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Sjekklister',
            description: 'Opprett lister for rekvisitter og sceneelementer',
          },
        ],
      },
    ],
  },
  music_video: {
    welcomeTitle: 'Velkommen, Musikkvideo-skaper!',
    welcomeSubtitle: 'Visualiser musikken',
    professionIcon: <MusicIcon sx={{ fontSize: 48 }} />,
    professionColor: '#06b6d4',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Planlegging for musikkvideoer',
        content: 'The Role Room er perfekt for å synkronisere visuelle elementer med musikk og planlegge dynamiske sekvenser.',
        features: [
          {
            icon: <MusicIcon sx={{ color: '#06b6d4' }} />,
            title: 'Beat-synkronisering',
            description: 'Planlegg shots etter musikkens struktur',
          },
          {
            icon: <VideocamIcon sx={{ color: '#06b6d4' }} />,
            title: 'Dynamiske sekvenser',
            description: 'Visualiser raske klipp og overganger',
          },
          {
            icon: <GroupsIcon sx={{ color: '#06b6d4' }} />,
            title: 'Artist-koordinering',
            description: 'Hold oversikt over artisten og dansere',
          },
        ],
      },
      {
        title: 'Hvordan det hjelper deg',
        content: 'Planlegg effektivt og maksimer opptaksdagen.',
        features: [
          {
            icon: <TimelineIcon sx={{ color: '#06b6d4' }} />,
            title: 'Storyboard',
            description: 'Visualiser hele videoen før opptak',
          },
          {
            icon: <TaskIcon sx={{ color: '#06b6d4' }} />,
            title: 'Shot-liste',
            description: 'Organiser etter vers, refreng og bridge',
          },
        ],
      },
      {
        title: 'Teamarbeid',
        content: 'Koordiner med koreograf, stylist og artist.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Del konseptet',
            description: 'Gi alle tilgang til visjonen',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Rolleoversikt',
            description: 'Hold styr på alle involverte',
          },
        ],
      },
    ],
  },
  commercial: {
    welcomeTitle: 'Velkommen, Reklamefilm-skaper!',
    welcomeSubtitle: 'Lever budskapet effektivt',
    professionIcon: <PlayIcon sx={{ fontSize: 48 }} />,
    professionColor: '#f97316',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Profesjonell reklameplanlegging',
        content: 'The Role Room hjelper deg å planlegge kommersielle produksjoner med fokus på budskap, merkevare og effektivitet.',
        features: [
          {
            icon: <PlayIcon sx={{ color: '#f97316' }} />,
            title: 'Konseptutvikling',
            description: 'Fra brief til ferdig shot list',
          },
          {
            icon: <GroupsIcon sx={{ color: '#f97316' }} />,
            title: 'Casting',
            description: 'Finn de rette ansiktene for merkevaren',
          },
          {
            icon: <TaskIcon sx={{ color: '#f97316' }} />,
            title: 'Klientpresentasjon',
            description: 'Del storyboard og konsept med kunden',
          },
        ],
      },
      {
        title: 'Effektiv planlegging',
        content: 'Maksimer produksjonsdagen og hold budsjett.',
        features: [
          {
            icon: <TimelineIcon sx={{ color: '#f97316' }} />,
            title: 'Tidsplan',
            description: 'Planlegg hvert opptak ned til minutter',
          },
          {
            icon: <CheckIcon sx={{ color: '#f97316' }} />,
            title: 'Sjekklister',
            description: 'Sikre at alle elementer er på plass',
          },
        ],
      },
      {
        title: 'Samarbeid',
        content: 'Koordiner med byrå, kunde og produksjonsteam.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Del med klient',
            description: 'Gi kunden innsyn i planleggingen',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Byrå-samarbeid',
            description: 'Hold byrået oppdatert på fremdrift',
          },
        ],
      },
    ],
  },
  documentary: {
    welcomeTitle: 'Velkommen, Dokumentarfilmskaper!',
    welcomeSubtitle: 'Fortell de viktige historiene',
    professionIcon: <MovieIcon sx={{ fontSize: 48 }} />,
    professionColor: '#84cc16',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Planlegging for dokumentar',
        content: 'The Role Room hjelper deg å strukturere research, intervjuer og opptak for dokumentarprosjekter.',
        features: [
          {
            icon: <MovieIcon sx={{ color: '#84cc16' }} />,
            title: 'Research-organisering',
            description: 'Samle kilder, intervjuobjekter og fakta',
          },
          {
            icon: <GroupsIcon sx={{ color: '#84cc16' }} />,
            title: 'Intervjuoversikt',
            description: 'Hold styr på alle intervjuobjekter',
          },
          {
            icon: <TimelineIcon sx={{ color: '#84cc16' }} />,
            title: 'Narrativ struktur',
            description: 'Planlegg historiens bue og sekvenser',
          },
        ],
      },
      {
        title: 'Fleksibel planlegging',
        content: 'Dokumentar krever fleksibilitet - The Role Room tilpasser seg.',
        features: [
          {
            icon: <TaskIcon sx={{ color: '#84cc16' }} />,
            title: 'Løst strukturert',
            description: 'Planlegg uten å låse deg til rigid shot list',
          },
          {
            icon: <SearchIcon sx={{ color: '#84cc16' }} />,
            title: 'Søk i research',
            description: 'Finn raskt tilbake til kilder og notater',
          },
        ],
      },
      {
        title: 'Teamkoordinering',
        content: 'Samarbeid med research-team og redigerere.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Del research',
            description: 'Gi teamet tilgang til alle kilder',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Produksjonsteam',
            description: 'Koordiner feltopptak og intervjuer',
          },
        ],
      },
    ],
  },
  general: {
    welcomeTitle: 'Velkommen til The Role Room!',
    welcomeSubtitle: 'Din komplette planleggingsløsning',
    professionIcon: <MovieIcon sx={{ fontSize: 48 }} />,
    professionColor: '#6366f1',
    slides: [
      {
        title: 'Hva er The Role Room?',
        subtitle: 'Alt-i-ett produksjonsplanlegging',
        content: 'The Role Room er et komplett verktøy for å planlegge, organisere og gjennomføre film-, foto- og videoproduksjoner.',
        illustration: (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: 2, 
            flexWrap: 'wrap',
            py: 2 
          }}>
            {['Casting', 'Shot List', 'Storyboard', 'Team'].map((item, i) => (
              <Paper
                key={item}
                elevation={3}
                sx={{
                  p: 2,
                  bgcolor: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 2,
                  minWidth: 80,
                  textAlign: 'center',
                  animation: `fadeInUp 0.5s ease ${i * 0.1}s both`,
                  '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#6366f1', fontWeight: 600 }}>
                  {item}
                </Typography>
              </Paper>
            ))}
          </Box>
        ),
      },
      {
        title: 'Hovedfunksjoner',
        subtitle: 'Alt du trenger for produksjonen',
        content: 'Fra første idé til ferdig opptak - The Role Room følger deg hele veien.',
        features: [
          {
            icon: <GroupsIcon sx={{ color: '#6366f1' }} />,
            title: 'Casting',
            description: 'Organiser roller, kandidater og auditions',
          },
          {
            icon: <VideocamIcon sx={{ color: '#6366f1' }} />,
            title: 'Shot List',
            description: 'Planlegg hvert opptak med detaljer og referanser',
          },
          {
            icon: <TimelineIcon sx={{ color: '#6366f1' }} />,
            title: 'AI Storyboard',
            description: 'La AI visualisere scenene basert på beskrivelser',
          },
        ],
      },
      {
        title: 'Hvordan finne ting',
        subtitle: 'Enkel navigasjon',
        content: 'Alt er organisert i logiske faner og paneler.',
        features: [
          {
            icon: <SearchIcon sx={{ color: '#6366f1' }} />,
            title: 'Søk',
            description: 'Finn alt med kraftig søkefunksjon',
          },
          {
            icon: <TaskIcon sx={{ color: '#6366f1' }} />,
            title: 'Faner',
            description: 'Bytt mellom Oversikt, Shots, Roller og Team',
          },
          {
            icon: <MovieIcon sx={{ color: '#6366f1' }} />,
            title: 'Scener',
            description: 'Se opptak organisert etter scene',
          },
        ],
        tips: [
          'Bruk Ctrl/Cmd + F for rask søk',
          'Dra og slipp for å omorganisere',
          'Høyreklikk for hurtigmenyer',
        ],
      },
      {
        title: 'Teamsamarbeid',
        subtitle: 'Jobb sammen effektivt',
        content: 'Inviter teammedlemmer og del ansvaret.',
        features: [
          {
            icon: <ShareIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Del prosjektet',
            description: 'Inviter via link eller e-post',
          },
          {
            icon: <TaskIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Oppgaver',
            description: 'Tildel shots til teammedlemmer',
          },
          {
            icon: <GroupsIcon sx={{ color: '#8b5cf6' }} />,
            title: 'Kanban',
            description: 'Følg fremdriften i sanntid',
          },
        ],
      },
    ],
  },
};

interface ProfessionOnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  profession: ProfessionType;
  userName?: string;
}

const ONBOARDING_NAMESPACE = 'roleRoom_onboardingCompleted';
const LEGACY_ONBOARDING_NAMESPACE = 'virtualStudio_onboardingCompleted';

export function ProfessionOnboardingDialog({
  open,
  onClose,
  profession,
  userName,
}: ProfessionOnboardingDialogProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');
  
  const content = professionContent[profession] || professionContent.general;
  const slides = content.slides;
  const totalSlides = slides.length;
  const progress = ((currentSlide + 1) / totalSlides) * 100;

  useEffect(() => {
    if (open) {
      setCurrentSlide(0);
    }
  }, [open]);

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setSlideDirection('left');
      setCurrentSlide(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setSlideDirection('right');
      setCurrentSlide(prev => prev - 1);
    }
  };

  const markCompleted = async () => {
    const cached =
      (await settingsService.getSetting<Record<string, boolean>>(ONBOARDING_NAMESPACE))
      || (await settingsService.getSetting<Record<string, boolean>>(LEGACY_ONBOARDING_NAMESPACE))
      || {};
    const updated = { ...cached, [profession]: true };
    await settingsService.setSetting(ONBOARDING_NAMESPACE, updated);
    await settingsService.deleteSetting(LEGACY_ONBOARDING_NAMESPACE);
  };

  const handleComplete = () => {
    void markCompleted();
    onClose();
  };

  const handleSkip = () => {
    void markCompleted();
    onClose();
  };

  const currentSlideData = slides[currentSlide];

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a2e',
          backgroundImage: `radial-gradient(circle at top right, ${content.professionColor}15 0%, transparent 50%)`,
          border: `1px solid ${content.professionColor}40`,
          borderRadius: 3,
          overflow: 'hidden',
          maxHeight: '90vh',
        },
      }}
    >
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 4,
          bgcolor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': {
            bgcolor: content.professionColor,
          },
        }}
      />

      <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
        <IconButton
          onClick={handleSkip}
          size="small"
          aria-label="Lukk onboarding"
          sx={{ color: 'rgba(255,255,255,0.87)', '&:hover': { color: 'white' } }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        {currentSlide === 0 && (
          <Fade in timeout={500}>
            <Box
              sx={{
                textAlign: 'center',
                py: 4,
                px: 3,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  bgcolor: `${content.professionColor}20`,
                  color: content.professionColor,
                  mx: 'auto',
                  mb: 2,
                  border: `2px solid ${content.professionColor}`,
                }}
              >
                {content.professionIcon}
              </Avatar>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: 'white',
                  mb: 1,
                }}
              >
                {userName ? `${content.welcomeTitle.replace('!', `, ${userName}!`)}` : content.welcomeTitle}
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{ color: 'rgba(255,255,255,0.87)' }}
              >
                {content.welcomeSubtitle}
              </Typography>
            </Box>
          </Fade>
        )}

        <Box sx={{ p: 4, minHeight: 400 }}>
          <Slide direction={slideDirection} in key={currentSlide} timeout={300}>
            <Box>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: 'white',
                  mb: 1,
                }}
              >
                {currentSlideData.title}
              </Typography>

              {currentSlideData.subtitle && (
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: content.professionColor,
                    mb: 2,
                    fontWeight: 600,
                  }}
                >
                  {currentSlideData.subtitle}
                </Typography>
              )}

              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.8)',
                  mb: 3,
                  lineHeight: 1.7,
                }}
              >
                {currentSlideData.content}
              </Typography>

              {currentSlideData.illustration && (
                <Box sx={{ mb: 3 }}>
                  {currentSlideData.illustration}
                </Box>
              )}

              {currentSlideData.features && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                  {currentSlideData.features.map((feature, index) => (
                    <Fade in timeout={500} style={{ transitionDelay: `${index * 100}ms` }} key={feature.title}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 2,
                          bgcolor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 2,
                          transition: 'all 0.2s',
                          '&:hover': {
                            bgcolor: 'rgba(255,255,255,0.08)',
                            borderColor: `${content.professionColor}40`,
                          },
                        }}
                      >
                        <Box
                          sx={{
                            p: 1,
                            bgcolor: `${content.professionColor}15`,
                            borderRadius: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {feature.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, color: 'white', mb: 0.5 }}
                          >
                            {feature.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: 'rgba(255,255,255,0.87)' }}
                          >
                            {feature.description}
                          </Typography>
                        </Box>
                      </Paper>
                    </Fade>
                  ))}
                </Box>
              )}

              {currentSlideData.tips && currentSlideData.tips.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: `${content.professionColor}10`,
                    border: `1px solid ${content.professionColor}30`,
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <TipIcon sx={{ color: content.professionColor, fontSize: 20 }} />
                    <Typography
                      variant="subtitle2"
                      sx={{ color: content.professionColor, fontWeight: 600 }}
                    >
                      Tips
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {currentSlideData.tips.map((tip, index) => (
                      <Chip
                        key={index}
                        label={tip}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.9)',
                          '& .MuiChip-label': { px: 1.5 },
                        }}
                      />
                    ))}
                  </Box>
                </Paper>
              )}
            </Box>
          </Slide>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 3,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            bgcolor: 'rgba(0,0,0,0.2)',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            {slides.map((_, index) => (
              <Box
                key={index}
                onClick={() => {
                  setSlideDirection(index > currentSlide ? 'left' : 'right');
                  setCurrentSlide(index);
                }}
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: index === currentSlide ? content.professionColor : 'rgba(255,255,255,0.3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: index === currentSlide ? content.professionColor : 'rgba(255,255,255,0.5)',
                    transform: 'scale(1.2)',
                  },
                }}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            {currentSlide > 0 && (
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handlePrevious}
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: 'white',
                  '&:hover': {
                    borderColor: 'rgba(255,255,255,0.5)',
                    bgcolor: 'rgba(255,255,255,0.05)',
                  },
                }}
              >
                Tilbake
              </Button>
            )}

            <Button
              variant="contained"
              endIcon={currentSlide === totalSlides - 1 ? <CheckIcon /> : <ArrowForwardIcon />}
              onClick={handleNext}
              sx={{
                bgcolor: content.professionColor,
                '&:hover': {
                  bgcolor: content.professionColor,
                  filter: 'brightness(1.1)',
                },
              }}
            >
              {currentSlide === totalSlides - 1 ? 'Kom i gang' : 'Neste'}
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export function useProfessionOnboarding(profession: ProfessionType | null) {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (profession) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const checkStatus = async () => {
        const cached =
          (await settingsService.getSetting<Record<string, boolean>>(ONBOARDING_NAMESPACE))
          || (await settingsService.getSetting<Record<string, boolean>>(LEGACY_ONBOARDING_NAMESPACE));
        if (cached && !(await settingsService.getSetting<Record<string, boolean>>(ONBOARDING_NAMESPACE))) {
          await settingsService.setSetting(ONBOARDING_NAMESPACE, cached);
          await settingsService.deleteSetting(LEGACY_ONBOARDING_NAMESPACE);
        }
        if (cached?.[profession]) return;

        timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 500);
      };
      void checkStatus();
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
    return undefined;
  }, [profession]);

  const triggerOnboarding = () => {
    setShowOnboarding(true);
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
  };

  const resetOnboarding = (prof?: ProfessionType) => {
    const target = prof || profession;
    if (!target) return;
    const reset = async () => {
      const cached =
        (await settingsService.getSetting<Record<string, boolean>>(ONBOARDING_NAMESPACE))
        || (await settingsService.getSetting<Record<string, boolean>>(LEGACY_ONBOARDING_NAMESPACE))
        || {};
      if (cached[target]) {
        const updated = { ...cached };
        delete updated[target];
        await settingsService.setSetting(ONBOARDING_NAMESPACE, updated);
        await settingsService.deleteSetting(LEGACY_ONBOARDING_NAMESPACE);
      }
    };
    void reset();
  };

  return {
    showOnboarding,
    triggerOnboarding,
    closeOnboarding,
    resetOnboarding,
  };
}
