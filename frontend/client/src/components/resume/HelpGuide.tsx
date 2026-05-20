/**
 * Hjelp- og guide-system for ResumeBuilder
 * Gir kontekstuell hjelp, tooltips og guidede gjennomganger
 *
 * All brukervendt tekst skal være på norsk (bokmål) for å matche
 * resten av CreatorHub. Kategori-IDer beholdes som diskrete strenger.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Stack,
  Paper,
} from '@mui/material';
import {
  Help as HelpIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  TipsAndUpdates as TipsIcon,
  Lightbulb as LightbulbIcon,
  Info as InfoIcon,
  School as SchoolIcon,
  Work as WorkIcon,
  Star as SkillIcon,
  EmojiEvents as CertIcon,
  Folder as ProjectIcon,
  AutoAwesome as AIIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

// ============================================================================
// HJELPE-INNHOLD
// ============================================================================

type HelpCategory =
  | 'Kom i gang'
  | 'CV-seksjoner'
  | 'AI-funksjoner'
  | 'Jobbsporing'
  | 'Publisering'
  | 'Tips';

interface HelpTopic {
  id: string;
  title: string;
  category: HelpCategory;
  icon: React.ReactNode;
  description: string;
  steps?: string[];
  tips?: string[];
  example?: string;
  relatedFeatures?: string[];
}

const HELP_TOPICS: HelpTopic[] = [
  // Kom i gang
  {
    id: 'getting-started',
    title: 'Kom i gang med NextRole',
    category: 'Kom i gang',
    icon: <HelpIcon />,
    description: 'Lær de grunnleggende stegene for å lage din første CV.',
    steps: [
      'Klikk "Lag ny CV" for å starte en ny CV',
      'Skriv inn en tittel (f.eks. "Senior fotograf-CV")',
      'Fyll inn dine personlige opplysninger',
      'Velg en mal og fargevalg',
      'Begynn å fylle ut seksjonene',
    ],
    tips: [
      'Du kan ha flere CV-er for ulike stillinger',
      'Endringer lagres automatisk hvert 30. sekund',
      'Bruk søkefeltet for å finne og filtrere CV-ene dine',
    ],
  },

  // CV-seksjoner
  {
    id: 'personal-info',
    title: 'Personlige opplysninger',
    category: 'CV-seksjoner',
    icon: <InfoIcon />,
    description:
      'Legg til de profesjonelle detaljene som vises øverst på CV-en din.',
    steps: [
      'Skriv inn fullt navn',
      'Legg til profesjonell e-post og telefon',
      'Oppgi sted (by/land)',
      'Legg til lenker: nettside, LinkedIn, GitHub, portefølje',
      'Skriv en profesjonell tittel eller sammendrag (2–3 setninger)',
      'Last opp et profesjonelt bilde (valgfritt)',
    ],
    tips: [
      'Bruk et profesjonelt portrettbilde',
      'E-postadressen bør være profesjonell (unngå kallenavn)',
      'LinkedIn-lenke hjelper rekrutterer å verifisere profilen din',
      'GitHub-lenke viser fram prosjektene dine',
    ],
    example:
      'F.eks.: «Full-stack-utvikler med 8+ års erfaring i å bygge skalerbare web-applikasjoner»',
  },

  {
    id: 'work-experience',
    title: 'Arbeidserfaring',
    category: 'CV-seksjoner',
    icon: <WorkIcon />,
    description: 'Vis fram din profesjonelle bakgrunn og dine resultater.',
    steps: [
      'Klikk "Legg til erfaring"',
      'Skriv inn stillingstittel og bedriftsnavn',
      'Legg til sted og ansettelses-datoer',
      'Huk av "Nåværende jobb" hvis du fortsatt jobber der',
      'Skriv 3–5 prestasjoner med aktive verb',
      'Inkluder tall og resultater',
    ],
    tips: [
      'Bruk handlingsverb: Ledet, Utviklet, Implementerte, Økte, Forvaltet',
      'Tallfest prestasjoner (f.eks. "Økte salget med 30 %")',
      'List nyeste jobb først',
      'Fokuser på effekt, ikke bare oppgaver',
      'Tilpass beskrivelsene til nøkkelord i stillingsannonsen',
    ],
    example:
      'F.eks.: «Ledet team på 5 utviklere som leverte 3 hovedfunksjoner i tide, og økte kundebevaring med 25 %»',
  },

  {
    id: 'education',
    title: 'Utdanning og kvalifikasjoner',
    category: 'CV-seksjoner',
    icon: <SchoolIcon />,
    description: 'Legg til akademiske kvalifikasjoner og sertifiseringer.',
    steps: [
      'Klikk "Legg til utdanning"',
      'Skriv inn grad/kvalifikasjon',
      'Legg til fagretning og institusjon',
      'Inkluder uteksamineringsdato',
      'Legg til karaktersnitt hvis det var 3,5 eller høyere',
      'Legg gjerne til notater om prestasjoner',
    ],
    tips: [
      'Start med høyeste grad (master/bachelor først)',
      'Inkluder relevante emner hvis du nylig er uteksaminert',
      'Nevn utmerkelser/stipend som er verdt å fremheve',
      'Bruk Vitnemålsportalen-import for automatisk uthenting',
    ],
  },

  {
    id: 'skills',
    title: 'Ferdigheter og kompetanse',
    category: 'CV-seksjoner',
    icon: <SkillIcon />,
    description: 'Fremhev tekniske og personlige ferdigheter.',
    steps: [
      'Klikk "Legg til ferdighet"',
      'Skriv inn ferdighet (f.eks. "Lightroom", "Ledelse")',
      'Velg kategori (Teknisk, Språk, Personlige)',
      'Sett nivå (1–5)',
      'Legg til 10–15 relevante ferdigheter totalt',
    ],
    tips: [
      'Match ferdigheter til nøkkelord i stillingsannonsen',
      'Sett de viktigste ferdighetene først',
      'Inkluder en blanding av tekniske og personlige',
      'Vær ærlig om nivå',
      'Bruk AI for å foreslå ferdigheter ut fra erfaringen din',
    ],
    example: 'Lightroom (5), Photoshop (4), Ledelse (4), Prosjektledelse (3)',
  },

  {
    id: 'certifications',
    title: 'Sertifiseringer og kurs',
    category: 'CV-seksjoner',
    icon: <CertIcon />,
    description: 'Legg til profesjonelle sertifiseringer og lisenser.',
    steps: [
      'Klikk "Legg til sertifisering"',
      'Skriv inn sertifiseringens navn',
      'Legg til utstedende organisasjon',
      'Inkluder utstedelsesdato og evt. utløpsdato',
      'Legg til ID og verifikasjons-URL hvis tilgjengelig',
    ],
    tips: [
      'Inkluder kun relevante og gyldige sertifiseringer',
      'Legg til direkte lenke for verifikasjon',
      'Inkluder ID for verifikasjon',
      'LinkedIn-import kan hente mange sertifiseringer automatisk',
    ],
  },

  {
    id: 'projects',
    title: 'Prosjekter og portefølje',
    category: 'CV-seksjoner',
    icon: <ProjectIcon />,
    description: 'Vis fram dine beste arbeider og sideprosjekter.',
    steps: [
      'Klikk "Legg til prosjekt"',
      'Skriv inn prosjektnavn og beskrivelse',
      'List opp teknologier som ble brukt',
      'Legg til prosjekt-datoer',
      'Inkluder lenke til prosjektet eller GitHub-repo',
      'Legg gjerne til skjermbilder fra Google Drive',
    ],
    tips: [
      'Inkluder 3–5 av dine beste prosjekter',
      'Fokuser på prosjekter som er relevante for stillingen',
      'Inkluder GitHub-lenker for kodeverifikasjon',
      'Legg til skjermbilder for visuelt sterke prosjekter',
      'Importer direkte fra GitHub for automatisk formatering',
    ],
  },

  // AI-funksjoner
  {
    id: 'ai-resume-generation',
    title: 'Generer CV med AI',
    category: 'AI-funksjoner',
    icon: <AIIcon />,
    description:
      'La Claude hjelpe deg å skrive profesjonelle beskrivelser og prestasjoner.',
    steps: [
      'Klikk "Generer CV med AI"',
      'Oppgi stillingstittel og antall års erfaring',
      'List opp nøkkelferdighetene du vil fremheve',
      'Gi et kort sammendrag av bakgrunnen din',
      'Gå gjennom AI-forslagene',
      'Tilpass og rediger etter behov',
      'Klikk "Inkluder i CV" for å legge til',
    ],
    tips: [
      'Bruk AI til førsteutkast, og finpuss selv etterpå',
      'Behold spesifikke tall AI foreslår',
      'Tilpass AI-teksten med dine egne eksempler',
      'Legg til målbare resultater fra egen erfaring',
    ],
    example:
      'Input: «Senior fotograf, 8 år». AI genererer: «Ledet produksjon av høykvalitets bryllups- og portrettfotografering for over 200 klienter ...»',
  },

  {
    id: 'ai-cover-letter',
    title: 'Generer søknadsbrev med AI',
    category: 'AI-funksjoner',
    icon: <AIIcon />,
    description: 'Lag personlige søknadsbrev til spesifikke stillinger.',
    steps: [
      'Klikk "Generer søknadsbrev med AI"',
      'Skriv inn stillingstittel og selskapsnavn',
      'List opp 3–5 mest relevante ferdigheter',
      'Gå gjennom det genererte brevet',
      'Tilpass med spesifikke eksempler',
      'Lagre til jobbsøknaden',
    ],
    tips: [
      'Bruk det genererte brevet som mal, og tilpass det selv',
      'Legg til spesifikke prosjekter som er relevante for selskapet',
      'Undersøk selskapets kultur og referer til den',
      'Hold søknadsbrevet kort (1 side)',
    ],
  },

  {
    id: 'ai-rewrite',
    title: 'AI-tekstforbedring',
    category: 'AI-funksjoner',
    icon: <AIIcon />,
    description: 'Forbedre skrivekvalitet og profesjonalitet i enhver seksjon.',
    steps: [
      'Velg tekst i et beskrivelses-felt',
      'Klikk AI-omskriv-knappen (blyantikon)',
      'Gå gjennom den forbedrede versjonen',
      'Aksepter eller prøv en annen stil',
      'Juster manuelt etter behov',
    ],
    tips: [
      'Bruk for stillingsbeskrivelser og prestasjoner',
      'Prøv ulike forslag',
      'Kombiner AI-forslagene med egne eksempler',
      'Behold autentisk stemme og forbedre tydeligheten',
    ],
  },

  // Jobbsporing
  {
    id: 'job-import',
    title: 'Importer jobber fra finn.no',
    category: 'Jobbsporing',
    icon: <WorkIcon />,
    description: 'Spor jobbsøknader og koble dem mot stillingsannonser.',
    steps: [
      'Finn jobben på finn.no',
      'Kopier stillings-URL-en',
      'Klikk "Legg til søknad" i jobbtrackeren',
      'Lim inn URL og klikk "Importer fra finn.no"',
      'Systemet henter ut: tittel, selskap, søknadsfrist',
      'Verifiser og lagre',
    ],
    tips: [
      'Systemet finner søknadsfristen automatisk',
      'Bruk alltid full URL, ikke kortet versjon',
      'Importer så snart du søker',
      'Legg til notater om hvorfor du søkte',
    ],
  },

  {
    id: 'job-analysis',
    title: 'Analyser jobb mot CV',
    category: 'Jobbsporing',
    icon: <SpeedIcon />,
    description:
      'Få AI-analyse av hvor godt CV-en din matcher en stillingsannonse.',
    steps: [
      'Etter import, klikk "Analyser jobb og få AI-forslag"',
      'Systemet sammenligner stillingens krav med CV-en din',
      'Se match-prosent og kompetansegap',
      'Se anbefalte nøkkelord å legge til',
      'Oppdater CV-en basert på forslagene',
      'Kjør analysen på nytt for å se forbedret match',
    ],
    tips: [
      'Sikt på 70 % match eller mer før du søker',
      'Oppdater CV med manglende nøkkelord',
      'Fokuser på harde ferdigheter nevnt i stillingen',
      'Legg til relevant erfaring selv om tittelen er ulik',
    ],
  },

  {
    id: 'interview-prep',
    title: 'Intervjuforberedelse',
    category: 'Jobbsporing',
    icon: <CheckIcon />,
    description: 'Forbered intervjuer med AI-generert veiledning.',
    steps: [
      'Sett jobbstatus til "Intervju"',
      'Sett intervjudato og -tid',
      'Klikk "Forbered intervju"',
      'Gå gjennom AI-genererte spørsmål og svar',
      'Studer nøkkelpunkter om rollen og selskapet',
      'Sjekk forberedelses-listen',
      'Øv før intervjudatoen',
    ],
    tips: [
      'Bruk STAR-metoden (Situasjon, Oppgave, Handling, Resultat)',
      'Undersøk selskapet før intervjuet',
      'Forbered 2–3 spørsmål til intervjueren',
      'Øv på å forklare prosjekter høyt',
    ],
  },

  {
    id: 'deadline-tracking',
    title: 'Frist-varsling',
    category: 'Jobbsporing',
    icon: <SpeedIcon />,
    description: 'Mister aldri en søknadsfrist med visuelle varsler.',
    steps: [
      'Importer jobb fra finn.no (frist hentes automatisk)',
      'Oransje varsel vises for jobber innen 7 dager',
      'Rødt varsel for frister i dag eller i morgen',
      'Klikk varselet for å redigere og søke',
      'Oppdater status etter at du har søkt',
    ],
    tips: [
      'Søk tidlig i frist-vinduet',
      'Bruk varsler som motivasjon',
      'Sett telefon-påminnelser for intervjuer',
      'Oppdater status så du ikke mister oversikten',
    ],
  },

  // Publisering
  {
    id: 'template-selection',
    title: 'Velg CV-mal',
    category: 'Publisering',
    icon: <InfoIcon />,
    description: 'Velg og tilpass CV-mal og utseende.',
    steps: [
      'Klikk "Velg CV-mal"',
      'Forhåndsvis hver mal',
      'Sjekk ATS-score per mal (høyere er bedre)',
      'Velg foretrukket mal',
      'Endre fargeskjema etter ønske',
      'Forhåndsvis sluttresultatet',
    ],
    tips: [
      'ATS-optimaliserte maler er best for automatisk screening',
      'Moderne mal passer godt for portefølje-roller',
      'Klassisk mal passer i tradisjonelle bransjer',
      'Velg lesbar font og god kontrast',
    ],
  },

  {
    id: 'public-resume',
    title: 'Publiser CV offentlig',
    category: 'Publisering',
    icon: <SecurityIcon />,
    description: 'Del CV-en din offentlig med arbeidsgivere og rekrutterere.',
    steps: [
      'Klikk "Publiser CV"',
      'Slå på "Gjør CV offentlig"',
      'Klikk "Kopier lenke"',
      'Del lenken med arbeidsgivere',
      'Visnings-teller viser besøk (hvis aktivert)',
      'Slå av når som helst for å avpublisere',
    ],
    tips: [
      'Offentlig CV viser ikke jobbsøknadene dine',
      'Viser kun: erfaring, ferdigheter, prosjekter, kontakt',
      'Du kan publisere/avpublisere når som helst',
      'Hold den offentlige CV-en profesjonell og oppdatert',
      'Spor visninger for å se interesse fra rekrutterere',
    ],
  },

  {
    id: 'export-cv',
    title: 'Eksporter CV',
    category: 'Publisering',
    icon: <InfoIcon />,
    description: 'Last ned CV-en i flere formater.',
    steps: [
      'Klikk "Eksporter"',
      'Velg format: PDF, Word, tekst eller JSON',
      'Last ned filen',
      'Bruk til søknader eller utskrift',
    ],
    tips: [
      'PDF er det mest universelle formatet',
      'Word-format for videre redigering',
      'Noen selskaper ber om spesifikt format — gi dem det de ber om',
      'Eksporter alltid før store endringer som sikkerhetskopi',
    ],
  },

  // Tips
  {
    id: 'ats-optimization',
    title: 'ATS-optimalisering',
    category: 'Tips',
    icon: <LightbulbIcon />,
    description: 'Få CV-en gjennom Applicant Tracking Systems.',
    steps: [
      'Bruk ATS-optimalisert mal',
      'Inkluder nøkkelord fra stillingsannonsen',
      'Bruk tydelige seksjonsoverskrifter',
      'Unngå grafikk i erfaringsseksjonen',
      'Bruk vanlige fonter',
      'Inkluder eksakte stillingstitler og selskapsnavn',
    ],
    tips: [
      'ATS-systemer skanner etter spesifikke nøkkelord',
      'Speil språket i stillingsannonsen',
      'Bruk vanlige bransjebegreper',
      'Unngå kreativ formatering',
      'Test ATS-scoren til malen du har valgt',
    ],
  },

  {
    id: 'cv-best-practices',
    title: 'Beste praksis for CV',
    category: 'Tips',
    icon: <LightbulbIcon />,
    description: 'Generelle retningslinjer for en sterk CV.',
    steps: [
      'Hold deg til 1–2 sider (maks 3 for svært erfarne)',
      'Bruk konsistent formatering',
      'Inkluder kun relevant informasjon',
      'Tilpass til stillingsannonsen',
      'Korrekturles nøye for skrivefeil',
      'Fremhev nyere erfaring',
    ],
    tips: [
      'Det viktigste: målbare resultater',
      'Fokuser på hva du oppnådde, ikke bare oppgavene',
      'Bruk handlingsverb og spesifikke tall',
      'Hold beskrivelsene konsise',
      'Bruk profesjonell e-post og telefon',
    ],
  },

  {
    id: 'common-mistakes',
    title: 'Unngå vanlige feil',
    category: 'Tips',
    icon: <LightbulbIcon />,
    description: 'Feil som kan skade sjansene dine.',
    steps: [
      'Ikke bruk uprofesjonell e-post',
      'Ikke ta med utdatert informasjon',
      'Ikke lyv om ferdigheter eller erfaring',
      'Ikke bruk inkonsistent formatering',
      'Ikke ha skrive- eller grammatikkfeil',
      'Ikke gjør CV-en for lang eller rotete',
    ],
    tips: [
      'Test hver lenke og kontaktinfo',
      'Be noen om å korrekturlese',
      'Bruk stavekontroll',
      'Behold konsistent spacing og font',
      'Oppdater datoer regelmessig',
    ],
  },
];

// ============================================================================
// KONTEKSTUELL HJELP TIL SKJEMA-FELT
// ============================================================================

export const FIELD_HELP_TEXT = {
  fullName:
    'Ditt fulle profesjonelle navn slik det fremgår av offisielle dokumenter.',
  email:
    'Profesjonell e-postadresse. Arbeidsgivere vil kontakte deg her.',
  phone:
    'Telefonnummer du kan nås på. Inkluder landskode (+47 for Norge).',
  location: 'By og land. F.eks. «Oslo, Norge».',
  summary:
    'Profesjonell tittel eller sammendrag. 1–3 setninger om din kompetanse.',
  jobTitle:
    'Din stillingstittel i denne rollen. F.eks. «Senior fotograf».',
  company: 'Selskap du jobbet i.',
  startDate: 'Dato du startet i stillingen (DD.MM.ÅÅÅÅ).',
  endDate:
    'Dato du sluttet i stillingen. La stå blank hvis du fortsatt er ansatt.',
  description:
    'List 3–5 nøkkelprestasjoner eller -oppgaver med aktive verb.',
  skills:
    'Legg til 10–15 relevante ferdigheter. Inkluder tekniske og personlige.',
  certificationName: 'Offisielt navn på sertifisering eller lisens.',
  certificationOrg: 'Organisasjon som utstedte sertifiseringen.',
  projectName: 'Navn på prosjekt (privat eller profesjonelt).',
  projectDescription:
    'Kort beskrivelse av hva prosjektet gjør og hvilken rolle du hadde.',
  github: 'Lenke til GitHub-profil: https://github.com/dittnavn',
  linkedin: 'Lenke til LinkedIn-profil.',
};

// ============================================================================
// KOMPONENTER
// ============================================================================

interface HelpGuideProps {
  open: boolean;
  onClose: () => void;
}

export const HelpGuideDialog: React.FC<HelpGuideProps> = ({ open, onClose }) => {
  const [expandedTopic, setExpandedTopic] = useState<string | false>(false);
  const [selectedCategory, setSelectedCategory] = useState<
    'Alle' | HelpCategory
  >('Alle');

  const filteredTopics =
    selectedCategory === 'Alle'
      ? HELP_TOPICS
      : HELP_TOPICS.filter((t) => t.category === selectedCategory);

  const categories: ('Alle' | HelpCategory)[] = [
    'Alle',
    'Kom i gang',
    'CV-seksjoner',
    'AI-funksjoner',
    'Jobbsporing',
    'Publisering',
    'Tips',
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HelpIcon />
        Hjelp og guide for NextRole
        <Box sx={{ flexGrow: 1 }} />
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {/* Kategori-filter */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <Chip
                key={cat}
                label={cat}
                onClick={() => setSelectedCategory(cat)}
                variant={selectedCategory === cat ? 'filled' : 'outlined'}
                color={selectedCategory === cat ? 'primary' : 'default'}
              />
            ))}
          </Box>

          <Divider />

          {/* Hjelpe-emner */}
          <Box>
            {filteredTopics.map((topic) => (
              <Accordion
                key={topic.id}
                expanded={expandedTopic === topic.id}
                onChange={() =>
                  setExpandedTopic(expandedTopic === topic.id ? false : topic.id)
                }
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ color: 'primary.main' }}>{topic.icon}</Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {topic.title}
                      </Typography>
                      <Chip
                        label={topic.category}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ pt: 0 }}>
                  <Stack spacing={2}>
                    <Typography variant="body2" color="textSecondary">
                      {topic.description}
                    </Typography>

                    {topic.steps && (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, mb: 1 }}
                        >
                          Slik gjør du:
                        </Typography>
                        <List dense>
                          {topic.steps.map((step, idx) => (
                            <ListItem key={idx} disableGutters>
                              <ListItemIcon sx={{ minWidth: 32 }}>
                                <Typography
                                  variant="caption"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {idx + 1}.
                                </Typography>
                              </ListItemIcon>
                              <ListItemText primary={step} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {topic.tips && (
                      <Paper
                        sx={{
                          p: 1.5,
                          bgcolor: 'info.lighter',
                          border: '1px solid',
                          borderColor: 'info.light',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            alignItems: 'flex-start',
                          }}
                        >
                          <TipsIcon
                            sx={{
                              mt: 0.5,
                              color: 'info.main',
                              flexShrink: 0,
                            }}
                          />
                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 0.5 }}
                            >
                              Tips:
                            </Typography>
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              {topic.tips.map((tip, idx) => (
                                <li key={idx}>
                                  <Typography variant="caption">{tip}</Typography>
                                </li>
                              ))}
                            </ul>
                          </Box>
                        </Box>
                      </Paper>
                    )}

                    {topic.example && (
                      <Paper
                        sx={{
                          p: 1.5,
                          bgcolor: 'success.lighter',
                          border: '1px solid',
                          borderColor: 'success.light',
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <CheckIcon
                            sx={{ color: 'success.main', flexShrink: 0 }}
                          />
                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ fontWeight: 600, mb: 0.5 }}
                            >
                              Eksempel:
                            </Typography>
                            <Typography variant="caption">
                              {topic.example}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Forstått
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Hjelp-ikon med tooltip — brukes for kontekstuell hjelp.
 */
interface ContextualHelpProps {
  title: string;
  content?: string;
  size?: 'small' | 'medium';
}

export const ContextualHelp: React.FC<ContextualHelpProps> = ({
  title,
  content,
  size = 'small',
}) => {
  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            {title}
          </Typography>
          {content && <Typography variant="caption">{content}</Typography>}
        </Box>
      }
      arrow
      placement="top"
    >
      <HelpIcon
        sx={{
          fontSize: size === 'small' ? 18 : 24,
          color: 'info.main',
          cursor: 'help',
        }}
      />
    </Tooltip>
  );
};

/**
 * Felt-hjelp tooltip
 */
export const FieldHelper: React.FC<{ fieldKey: keyof typeof FIELD_HELP_TEXT }> = ({
  fieldKey,
}) => {
  const helpText = FIELD_HELP_TEXT[fieldKey];
  return <ContextualHelp title={fieldKey} content={helpText} size="small" />;
};

/**
 * Tips-varsel — viser nyttige tips øverst i seksjoner.
 */
interface TipAlertProps {
  title: string;
  content: string;
  onDismiss?: () => void;
}

export const TipAlert: React.FC<TipAlertProps> = ({
  title,
  content,
  onDismiss,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Alert
      severity="info"
      onClose={() => {
        setDismissed(true);
        onDismiss?.();
      }}
      icon={<LightbulbIcon />}
      sx={{ mb: 2 }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2">{content}</Typography>
    </Alert>
  );
};

/**
 * Hurtigtips-sidekolonne — viser kontekst-spesifikke tips på siden.
 */
interface QuickTipsProps {
  tips: string[];
  title?: string;
}

export const QuickTips: React.FC<QuickTipsProps> = ({
  tips,
  title = 'Hurtigtips',
}) => {
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'warning.lighter',
        border: '1px solid',
        borderColor: 'warning.light',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
        <TipsIcon sx={{ color: 'warning.main', flexShrink: 0, mt: 0.5 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>

      <List dense>
        {tips.map((tip, idx) => (
          <ListItem key={idx} disableGutters sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <CheckIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            </ListItemIcon>
            <ListItemText
              primary={tip}
              primaryTypographyProps={{ variant: 'caption' }}
              sx={{ m: 0 }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

/**
 * Flytende hjelp-knapp
 */
interface HelpButtonProps {
  onClick: () => void;
}

export const HelpButton: React.FC<HelpButtonProps> = ({ onClick }) => {
  return (
    <Tooltip title="Åpne hjelp og guide" placement="left">
      <IconButton
        onClick={onClick}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          bgcolor: 'primary.main',
          color: 'white',
          '&:hover': {
            bgcolor: 'primary.dark',
          },
          boxShadow: 2,
        }}
      >
        <HelpIcon />
      </IconButton>
    </Tooltip>
  );
};
