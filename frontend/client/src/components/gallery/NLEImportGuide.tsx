// @ts-nocheck
/**
 * NLEImportGuide — Slice 9X.83
 *
 * Pic-Time-styled dialog som forklarer hvordan Bjarne importerer
 * den nedlastede marker-fila inn i DaVinci Resolve, Adobe Premiere
 * Pro eller Final Cut Pro X. Faner per NLE, steg-for-steg med
 * "tips" om common gotchas (frame rate, alignment, etc.).
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Stack,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Chip,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Lightbulb as TipIcon,
} from '@mui/icons-material';

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';
// Dashboard-konsistent mørk palett (tidligere cream/editorial-tokens).
// INK = primær tekstfarge, PAPER = dialog-bg, PAPER_DEEP = sekundær bg,
// ACCENT = aksent, MUTED = sekundær tekst, HAIRLINE = subtil border.
const INK = '#fff';
const PAPER = 'rgba(15,23,42,0.96)';
const PAPER_DEEP = 'rgba(255,255,255,0.04)';
const ACCENT = '#d97706';
const MUTED = 'rgba(255,255,255,0.7)';
const HAIRLINE = 'rgba(255,255,255,0.08)';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Step {
  title: string;
  body: string;
}

interface NLEGuide {
  key: string;
  label: string;
  subtitle: string;
  formats: { name: string; recommended?: boolean }[];
  steps: Step[];
  tips: string[];
}

const GUIDES: NLEGuide[] = [
  {
    key: 'resolve',
    label: 'DaVinci Resolve',
    subtitle: 'Versjon 16 og nyere — gratis-versjonen funker også',
    formats: [
      { name: 'Markører (CSV)', recommended: true },
      { name: 'EDL' },
      { name: 'FCPXML' },
    ],
    steps: [
      {
        title: 'Åpne timeline-en din',
        body:
          'Last opp master-rendret du sendte til klienten (eller åpne sequence-en du jobbet i). Pass på at frame rate-en på timeline matcher det vi eksporterte: 25 fps (PAL). Står den på 23.976 eller 29.97, må du justere først — ellers havner markørene på feil frame.',
      },
      {
        title: 'Åpne Markører-panelet',
        body:
          'Workspace > Show Page > Edit. Trykk så på tannhjul-ikonet over Inspector og slå på "Marker Index" — du får da en liste-visning av alle markører nederst i Edit-page.',
      },
      {
        title: 'Importer Marker List',
        body:
          'CSV: Bruk Resolve sin "Workflow Integration" (eks. Marker List Importer). Hvis du ikke har den installert, bruk EDL eller FCPXML i stedet.\n\nEDL: File > Import > Pre-Conformed EDL > velg .edl-fila. Resolve legger en V1-track med ett klipp per markør.\n\nFCPXML: File > Import > Timeline > velg .fcpxml. Du får et tomt placeholder-klipp med alle markørene plassert på riktig tidskode.',
      },
      {
        title: 'Align med rendret ditt',
        body:
          'Dra det importerte placeholder-klippet og snap det til starten av master-klippet ditt. Nå sitter alle klient-kommentarene som fargede markører på sin riktige timecode. Klikk på en markør for å se kommentar-teksten i Inspector.',
      },
    ],
    tips: [
      'Farger: RØDE = må fikses · GULE = ønske · GRØNNE = forslag · BLÅ = allerede løst.',
      'Hvis du har klipp-start på timecode 01:00:00:00 (broadcast-standard), offset markør-klippet med samme offset.',
      'For å gå til neste/forrige markør: Shift + Pil opp/ned i Edit-page.',
    ],
  },
  {
    key: 'premiere',
    label: 'Adobe Premiere Pro',
    subtitle: 'CC 2023 og nyere',
    formats: [
      { name: 'EDL', recommended: true },
      { name: 'FCPXML' },
      { name: 'Markører (CSV)', recommended: false },
    ],
    steps: [
      {
        title: 'Åpne prosjektet ditt',
        body:
          'Sørg for at sequence-en din står på 25 fps (Sequence > Sequence Settings). Hvis du jobber i en annen frame rate kan du fortsatt importere — markørene blir bare rundt til nærmeste frame.',
      },
      {
        title: 'Importer EDL',
        body:
          'File > Import > velg .edl-fila. Premiere lager en ny sequence med markører som comment-clips. Dra denne sequencen på toppen av master-clipet ditt (V2-track), så ser du tidskodene aligne seg.',
      },
      {
        title: 'Alternativt: FCPXML',
        body:
          'File > Import > velg .fcpxml. Premiere fra CC 2018 og oppover støtter dette via XMP-mapping. Du får et placeholder-klipp med tekst-markører.',
      },
      {
        title: 'Konverter til sequence-markører (anbefalt)',
        body:
          'Høyreklikk på det importerte placeholder-klippet → "Copy Clip Markers to Sequence Markers". Da settes alle CreatorHub-kommentarene som markører direkte på timeline-en din, og du kan slette placeholder-klippet.',
      },
      {
        title: 'Naviger til markørene',
        body:
          'Åpne Markers-panelet (Window > Markers). Du får liste med alle kommentarene + tidskode. Klikk for å hoppe til.',
      },
    ],
    tips: [
      'For CSV: Bruk panel-utvidelser som "Productive Editor" eller "Marker Importer" (Jarle Leirpoll) som leser samme format vi eksporterer.',
      'Shift + M = hopp til neste markør · Ctrl/Cmd + Shift + M = hopp til forrige.',
      'Hvis markørene ser ut til å ligge feil, sjekk at sequence-en din ikke har timecode-offset.',
    ],
  },
  {
    key: 'fcp',
    label: 'Final Cut Pro X',
    subtitle: 'Versjon 10.4 og nyere',
    formats: [
      { name: 'FCPXML', recommended: true },
      { name: 'EDL' },
    ],
    steps: [
      {
        title: 'Importer FCPXML',
        body:
          'File > Import > XML > velg .fcpxml-fila. FCP X lager en ny library / event med et placeholder-klipp som har alle markørene plassert riktig.',
      },
      {
        title: 'Dra placeholder over master',
        body:
          'Trekk det importerte placeholder-klippet på toppen av master-klippet ditt på timeline (connect storyline). Snap til start.',
      },
      {
        title: 'Konverter til timeline-markører',
        body:
          'Marker-tekstene følger placeholderen. For å feste dem til selve master-klippet: høyreklikk hver markør → "Move to Selected Clip". Eller behold placeholderen som referanse-spor.',
      },
      {
        title: 'Naviger og sjekk',
        body:
          'Window > Index > Tags-fanen. Du får full liste over alle CreatorHub-kommentarene med fargekoder og tidskoder. Klikk for å hoppe.',
      },
    ],
    tips: [
      'FCP X støtter markør-farger basert på "completed"-attributtet vi setter på resolved-kommentarer.',
      'Bruk Ctrl + M = legg til markør · M = neste markør i index.',
    ],
  },
];

const NLEImportGuide: React.FC<Props> = ({ open, onClose }) => {
  const [tab, setTab] = useState(0);
  const guide = GUIDES[tab];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: PAPER,
          backdropFilter: 'blur(8px)',
          color: INK,
          borderRadius: 0,
          border: `1px solid ${HAIRLINE}`,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: { xs: 3, sm: 4 },
          pb: { xs: 2, sm: 3 },
          borderBottom: `1px solid ${HAIRLINE}`,
          position: 'relative',
        }}
      >
        <IconButton
          onClick={onClose}
          aria-label="Lukk import-guide"
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: MUTED,
            '&:hover': { color: INK },
          }}
        >
          <CloseIcon />
        </IconButton>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.32em',
            color: ACCENT,
            textTransform: 'uppercase',
            mb: 0.5,
          }}
        >
          · Import-guide ·
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontFamily: SERIF_STACK,
            fontWeight: 400,
            fontSize: { xs: '1.8rem', sm: '2.4rem' },
            lineHeight: 1.05,
            letterSpacing: '-0.025em',
          }}
        >
          Klient-kommentarene rett inn på timeline-en din
        </Typography>
        <Typography
          sx={{
            fontFamily: SERIF_STACK,
            fontStyle: 'italic',
            fontSize: '1rem',
            color: MUTED,
            mt: 1,
          }}
        >
          Velg din NLE — du får steg-for-steg, ingen leting i UI-en.
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: `1px solid ${HAIRLINE}`, bgcolor: PAPER_DEEP }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="fullWidth"
          sx={{
            '& .MuiTab-root': {
              fontFamily: '"Inter", "Segoe UI", sans-serif',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              fontSize: '0.78rem',
              color: MUTED,
              minHeight: 56,
              '&.Mui-selected': { color: INK },
            },
            '& .MuiTabs-indicator': { backgroundColor: ACCENT, height: 3 },
          }}
        >
          {GUIDES.map((g) => (
            <Tab key={g.key} label={g.label} />
          ))}
        </Tabs>
      </Box>

      <DialogContent sx={{ p: { xs: 3, sm: 4 } }}>
        {/* NLE-header med subtitle og format-chips */}
        <Box sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontFamily: SERIF_STACK,
              fontSize: '1.4rem',
              lineHeight: 1.2,
              mb: 0.5,
            }}
          >
            {guide.label}
          </Typography>
          <Typography
            sx={{
              fontFamily: SERIF_STACK,
              fontStyle: 'italic',
              fontSize: '0.9rem',
              color: MUTED,
              mb: 1.5,
            }}
          >
            {guide.subtitle}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {guide.formats.map((f) => (
              <Chip
                key={f.name}
                label={f.recommended ? `${f.name} · anbefalt` : f.name}
                size="small"
                sx={{
                  height: 24,
                  fontWeight: 700,
                  fontSize: '0.7rem',
                  letterSpacing: '0.04em',
                  borderRadius: 0,
                  bgcolor: f.recommended ? ACCENT : 'transparent',
                  color: f.recommended ? '#fff' : MUTED,
                  border: f.recommended ? 'none' : `1px solid ${HAIRLINE}`,
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* Steg-liste */}
        <Stack spacing={2}>
          {guide.steps.map((step, idx) => (
            <Box
              key={step.title}
              sx={{
                display: 'flex',
                gap: 2,
                p: 2,
                bgcolor: PAPER_DEEP,
                border: `1px solid ${HAIRLINE}`,
              }}
            >
              <Box
                sx={{
                  flexShrink: 0,
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: ACCENT,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: SERIF_STACK,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                }}
                aria-hidden
              >
                {idx + 1}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontFamily: '"Inter", "Segoe UI", sans-serif',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: INK,
                    mb: 0.5,
                  }}
                >
                  {step.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.88rem',
                    color: MUTED,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {step.body}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>

        {/* Tips */}
        {guide.tips.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography
              sx={{
                fontSize: '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.28em',
                color: ACCENT,
                textTransform: 'uppercase',
                mb: 1,
              }}
            >
              · Tips ·
            </Typography>
            <Stack spacing={1}>
              {guide.tips.map((tip) => (
                <Box
                  key={tip}
                  sx={{
                    display: 'flex',
                    gap: 1,
                    alignItems: 'flex-start',
                    p: 1.5,
                    borderLeft: `3px solid ${ACCENT}`,
                    bgcolor: 'rgba(217, 119, 6, 0.06)',
                  }}
                >
                  <TipIcon sx={{ color: ACCENT, fontSize: 18, mt: 0.2 }} />
                  <Typography
                    sx={{
                      fontFamily: SERIF_STACK,
                      fontStyle: 'italic',
                      fontSize: '0.88rem',
                      color: INK,
                      lineHeight: 1.4,
                    }}
                  >
                    {tip}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        {/* Universal-footer */}
        <Alert
          icon={<CheckIcon fontSize="small" />}
          severity="success"
          sx={{
            mt: 3,
            borderRadius: 0,
            bgcolor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.32)',
            color: INK,
            '& .MuiAlert-icon': { color: '#10b981' },
            fontFamily: '"Inter", "Segoe UI", sans-serif',
            fontSize: '0.85rem',
          }}
        >
          <strong>Frame rate:</strong> Markør-filene er generert på 25&nbsp;fps
          (PAL-standard). Hvis ditt master-render er 23.976 eller 29.97&nbsp;fps
          kan markørene være ~1 frame av — Resolve og Premiere snapper til
          nærmeste frame automatisk, så det skal ikke være et problem i praksis.
        </Alert>
      </DialogContent>
    </Dialog>
  );
};

export default NLEImportGuide;
