import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Divider,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  HelpOutline as HelpIcon,
  Analytics as OverviewIcon,
  QueryStats as MetricsIcon,
  Edit as ManualIcon,
  Gavel as PermitIcon,
  Event as TimelineIcon,
  WarningAmber as RiskIcon,
  CameraAlt as TechIcon,
  Save as SaveIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import { GuideAnnotatedScreenshot } from '../shared/guide/GuideAnnotationOverlay';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
import type {
  GuideAnnotationLabelPosition,
  GuideStepAnnotation,
} from '../admin/visual-editor/guideTypes';

interface StepSection {
  heading: string;
  body: React.ReactNode;
  screenshotLabel: string;
}

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  sections: StepSection[];
}

interface SectionAsset {
  screenshotUrl: string;
  annotations: GuideStepAnnotation[];
}

function ann(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  color = '#22d3ee',
  labelPosition: GuideAnnotationLabelPosition = 'top-left',
): GuideStepAnnotation {
  return {
    id,
    style: 'rounded-box',
    x,
    y,
    width,
    height,
    label,
    color,
    thickness: 2,
    labelPosition,
  };
}

function ScreenshotPlaceholder({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 200,
        border: '2px dashed rgba(255,255,255,0.12)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.02)',
        my: 2,
        py: 3,
        cursor: 'default',
      }}
    >
      <ImageIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.15)' }} />
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.72rem',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2,
        }}
      >
        Screenshot placeholder - {label}
      </Typography>
    </Box>
  );
}

function VideoPlaceholder({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 130,
        border: '2px dashed rgba(255,255,255,0.09)',
        borderRadius: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        bgcolor: 'rgba(255,255,255,0.01)',
        my: 1,
        py: 2.5,
        cursor: 'default',
      }}
    >
      <VideoIcon sx={{ fontSize: 30, color: 'rgba(255,255,255,0.12)' }} />
      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255,255,255,0.25)',
          fontSize: '0.72rem',
          fontStyle: 'italic',
          textAlign: 'center',
          px: 2,
        }}
      >
        Video placeholder - {label}
      </Typography>
    </Box>
  );
}

function Callout({
  color = '#22d3ee',
  children,
}: {
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        borderLeft: `3px solid ${color}`,
        bgcolor: `${color}12`,
        borderRadius: '0 8px 8px 0',
        px: 2,
        py: 1.25,
        my: 1.5,
      }}
    >
      <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.7 }}>
        {children}
      </Typography>
    </Box>
  );
}

const STEPS: Step[] = [
  {
    id: 'overview',
    label: 'Oversikt',
    icon: <OverviewIcon fontSize="small" />,
    sections: [
      {
        heading: 'Hva lokasjonsanalyse gir deg',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Location Analysis kombinerer data for foto-spotter, drone, vaer, tilgang og tillatelser
            i en samlet risikovurdering. Dialogen hjelper teamet med beslutninger for opptak, sikkerhet
            og logistikk.
          </Typography>
        ),
        screenshotLabel: 'Lokasjonsanalyse - hovedvisning',
      },
      {
        heading: 'Arbeidsmodus i dialogen',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Bruk preset og operasjonelt filter for a fokusere pa det som haster: klarhet, risiko,
            kost eller handlinger som mangler.
          </Typography>
        ),
        screenshotLabel: 'Preset/filter kontroll i lokasjonsanalyse',
      },
    ],
  },
  {
    id: 'score-filters',
    label: 'Score og filtre',
    icon: <MetricsIcon fontSize="small" />,
    sections: [
      {
        heading: 'Klarhet, risiko og tiltakspunkter',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            KPI-feltet viser readiness-score, risiko-score, estimert kost, tillatelsesstatus og antall
            tiltakspunkter. Dette gir prioritering uten at du trenger a lese hele analysen.
          </Typography>
        ),
        screenshotLabel: 'KPI-kort for readiness, risiko, kost og tiltak',
      },
      {
        heading: 'Operasjonelt filter',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Filtrer pa "Klar", "Krever tiltak", "Risiko" eller "Kost" for a se riktig del av analysen
            for riktig mote eller rolle.
          </Typography>
        ),
        screenshotLabel: 'Filterknapper for operasjonell visning',
      },
    ],
  },
  {
    id: 'manual-edit',
    label: 'Manuell overstyring',
    icon: <ManualIcon fontSize="small" />,
    sections: [
      {
        heading: 'Rediger analyse hvis API-data ikke stemmer',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Aapne "Rediger analyse" for a overstyre drone, vaer, tilgjengelighet og interne notater.
            Endringene lagres tilbake pa lokasjonen og blir del av videre vurdering.
          </Typography>
        ),
        screenshotLabel: 'Manuell redigering av analysefelter',
      },
      {
        heading: 'Kvalitetssikring for teamet',
        body: (
          <Callout>
            Bruk manuell overstyring nar feltobservasjoner avviker fra ekstern datakilde. Da holder du
            analysen relevant for faktisk produksjonssituasjon.
          </Callout>
        ),
        screenshotLabel: 'Lagre manuelle endringer i lokasjonsanalyse',
      },
    ],
  },
  {
    id: 'permits-contacts',
    label: 'Tillatelser og kontakter',
    icon: <PermitIcon fontSize="small" />,
    sections: [
      {
        heading: 'Hvem ma kontaktes',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Basert pa aktivitet og lokasjon foreslar systemet relevante myndigheter og kontaktpunkter,
            med begrunnelse, behandlingstid og lead-days.
          </Typography>
        ),
        screenshotLabel: 'Kontaktliste for tillatelser med myndigheter',
      },
      {
        heading: 'Status pa soknadsflyt',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Oppdater status per kontakt (utkast, sendt, under behandling, godkjent, avslatt). Dette
            oppdaterer fremdrift og risiko automatisk.
          </Typography>
        ),
        screenshotLabel: 'Tillatelsesstatus per kontakt',
      },
    ],
  },
  {
    id: 'permit-timeline',
    label: 'Frister og tidslinje',
    icon: <TimelineIcon fontSize="small" />,
    sections: [
      {
        heading: 'Beregning av frister',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Sett planlagt opptaksdato for a beregne anbefalte frister bakover fra opptaksdag.
            Systemet markerer hastegrad, overskridelser og kritiske tillatelser.
          </Typography>
        ),
        screenshotLabel: 'Frister beregnet mot opptaksdato',
      },
      {
        heading: 'Progressbar og tiltak',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Progressbar viser hvor langt teamet har kommet. Tiltakslisten prioriterer neste steg
            slik at produksjonen ikke stopper pa grunn av manglende godkjenninger.
          </Typography>
        ),
        screenshotLabel: 'Fremdrift og tiltak i permit workflow',
      },
    ],
  },
  {
    id: 'risk-fallback',
    label: 'Risiko og fallback',
    icon: <RiskIcon fontSize="small" />,
    sections: [
      {
        heading: 'Risikoniva og eskalering',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Hoy risiko trigger tydelige varsler for tiltak, eskalering og reserveplan. Dette gir
            produksjonsleder et klart beslutningsgrunnlag.
          </Typography>
        ),
        screenshotLabel: 'Risikoindikator med hoy/moderat/lav niva',
      },
      {
        heading: 'Forslag til fallback-planer',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Dialogen foreslar konkrete alternativer som reserve-lokasjon, alternativ shot-plan uten drone,
            eller justert opptaksdato ved behandlingstidspress.
          </Typography>
        ),
        screenshotLabel: 'Fallback-forslag ved tillatelsesrisiko',
      },
    ],
  },
  {
    id: 'technical-sections',
    label: 'Tekniske seksjoner',
    icon: <TechIcon fontSize="small" />,
    sections: [
      {
        heading: 'Foto, drone, vaer og tilgang',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Under hovedkortene finner du fagseksjoner for fotografispotter, drone-restriksjoner,
            vaer-eksponering og tilgangsanalyse med kollektiv/parkering.
          </Typography>
        ),
        screenshotLabel: 'Tekniske seksjoner i lokasjonsanalyse',
      },
      {
        heading: 'Relevans for teknisk team',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Disse feltene brukes direkte av foto, grip, lys og produksjon for a validere gjennomforbarhet
            pa location før opptaksdag.
          </Typography>
        ),
        screenshotLabel: 'Tilgang, vaer og drone-data for teknisk vurdering',
      },
    ],
  },
  {
    id: 'save-sync',
    label: 'Lagre og synk',
    icon: <SaveIcon fontSize="small" />,
    sections: [
      {
        heading: 'Lagring tilbake til lokasjon',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Nar du lagrer tillatelsesstatus eller manuelle overstyringer, oppdateres lokasjonsdata slik at
            pro-visningen i Location Management viser samme status.
          </Typography>
        ),
        screenshotLabel: 'Lagre tillatelsesstatus tilbake til lokasjon',
      },
      {
        heading: 'Anbefalt arbeidsflyt',
        body: (
          <Callout color="#a855f7">
            Arbeid i denne rekkefolgen: KPI/filtre, manuell kvalitetssikring, tillatelser/kontakter,
            deretter lagre. Da holder du analyse og operativ plan i synk.
          </Callout>
        ),
        screenshotLabel: 'Anbefalt arbeidsflyt i analyse-dialogen',
      },
    ],
  },
];

const DEFAULT_SECTION_ASSETS: Record<string, SectionAsset> = {
  'overview.0': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('ao-title', 13, 6.1, 9.5, 3, 'Dialog', '#22d3ee'),
      ann('ao-kpi-row', 12.4, 14.5, 75.7, 8.5, 'Analyse-KPI', '#a855f7'),
      ann('ao-guide', 82.8, 7, 4.2, 3.1, 'Guide', '#34d399', 'top-right'),
    ],
  },
  'overview.1': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('ao-presets', 14.2, 20.8, 12.2, 3.1, 'Preset-filter', '#22d3ee'),
      ann('ao-ops-filter', 14.7, 23.6, 10.1, 3.1, 'Operasjonelt filter', '#a855f7'),
      ann('ao-risk-mode', 21.6, 23.7, 2.8, 2.8, 'Risiko-modus', '#f59e0b'),
    ],
  },
  'score-filters.0': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('sf-ready', 12.6, 14.8, 14.2, 6.8, 'Klarhet', '#34d399'),
      ann('sf-risk', 27.8, 14.8, 14.2, 6.8, 'Risiko', '#ef4444'),
      ann('sf-cost', 58.2, 14.8, 14.2, 6.8, 'Kost', '#22d3ee'),
      ann('sf-actions', 73.4, 14.8, 14.2, 6.8, 'Tiltak', '#a855f7'),
    ],
  },
  'score-filters.1': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('sf-op-filter-row', 14.6, 23.6, 15.2, 3.1, 'Klar / tiltak / risiko', '#22d3ee'),
      ann('sf-tech-scout', 14.4, 20.9, 4.1, 2.5, 'Tech Scout', '#a855f7'),
      ann('sf-permits', 18.4, 20.9, 3.8, 2.5, 'Tillatelser', '#34d399'),
    ],
  },
  'manual-edit.0': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('me-manual', 12.1, 31.8, 20.2, 3.3, 'Manuell kvalitetssikring', '#22d3ee'),
      ann('me-edit-btn', 80.9, 32.5, 7, 3, 'Rediger analyse', '#34d399', 'top-right'),
    ],
  },
  'manual-edit.1': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('me-edit-flow', 80.9, 32.5, 7, 3, 'Start overstyring', '#34d399', 'top-right'),
      ann('me-permit-section', 14.5, 42.2, 20.4, 3.1, 'Tillatelser og kontakter', '#a855f7'),
    ],
  },
  'permits-contacts.0': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('pc-section', 14.5, 42.2, 20.4, 3.1, 'Kontaktmodul', '#22d3ee'),
      ann('pc-dovre', 12.5, 60.5, 7.4, 2.1, 'Dovre kommune', '#34d399'),
      ann('pc-luftfart', 12.5, 79.9, 6.8, 2.1, 'Luftfartstilsynet', '#a855f7'),
    ],
  },
  'permits-contacts.1': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('pc-save-status', 80.2, 42.9, 7.6, 3, 'Lagre tillatelsesstatus', '#34d399', 'top-right'),
      ann('pc-status-select', 12.5, 69.7, 8.2, 3.1, 'Status', '#22d3ee'),
      ann('pc-copy-template', 16.7, 73.1, 4.2, 2.5, 'Kopier mal', '#a855f7'),
    ],
  },
  'permit-timeline.0': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('pt-planned-date', 12.7, 54, 5, 2, 'Planlagt opptaksdato', '#22d3ee'),
      ann('pt-chip-public', 25, 54.8, 5.9, 2.8, 'Offentlig område', '#a855f7'),
      ann('pt-chip-drone', 30.8, 54.8, 3.5, 2.8, 'Drone', '#34d399'),
      ann('pt-chip-traffic', 34.2, 54.8, 3.6, 2.8, 'Trafikk', '#f59e0b'),
    ],
  },
  'permit-timeline.1': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('pt-timeline', 57.2, 70.2, 30.4, 19.4, 'Fristlinje', '#22d3ee'),
      ann('pt-critical', 21.6, 66.1, 2.4, 1.8, 'Kritisk', '#ef4444'),
    ],
  },
  'risk-fallback.0': {
    screenshotUrl: '/guide/location/analysis-bottom.png',
    annotations: [
      ann('rf-fallback-card', 57, 10.1, 30.8, 13.2, 'Fallback ved høy risiko', '#ef4444'),
      ann('rf-fallback-tasks', 57.2, 12.8, 30.2, 9.8, 'Tiltaksliste', '#f59e0b'),
    ],
  },
  'risk-fallback.1': {
    screenshotUrl: '/guide/location/analysis-bottom.png',
    annotations: [
      ann('rf-fallback-actions', 57, 10.1, 30.8, 13.2, 'Reserveplaner', '#ef4444'),
      ann('rf-permit-cards', 12.4, 0.2, 44.1, 42.4, 'Tillatelseskontakter', '#a855f7'),
    ],
  },
  'technical-sections.0': {
    screenshotUrl: '/guide/location/analysis-technical.png',
    annotations: [
      ann('ts-photo', 15.1, 14.1, 7.1, 2.9, 'Fotografispotter', '#22d3ee'),
      ann('ts-drone', 15.1, 42.4, 68.4, 2.9, 'Drone-restriksjoner', '#34d399'),
      ann('ts-weather', 15.1, 76.1, 10.6, 2.9, 'Vær-eksponering', '#f59e0b'),
    ],
  },
  'technical-sections.1': {
    screenshotUrl: '/guide/location/analysis-technical.png',
    annotations: [
      ann('ts-max-height', 13, 55, 74, 4, 'Maks høyde', '#22d3ee'),
      ann('ts-drone-allowed', 84.7, 43.5, 3.2, 2.3, 'Tillatt', '#34d399', 'top-right'),
      ann('ts-tech-card', 12.3, 39.8, 75.5, 20.6, 'Teknisk vurdering', '#a855f7'),
    ],
  },
  'save-sync.0': {
    screenshotUrl: '/guide/location/analysis-top.png',
    annotations: [
      ann('ss-save-status', 80.2, 42.9, 7.6, 3, 'Lagre tillatelsesstatus', '#34d399', 'top-right'),
      ann('ss-sync-pane', 14.5, 42.2, 73.4, 47.2, 'Data synkes tilbake til lokasjon', '#22d3ee'),
    ],
  },
  'save-sync.1': {
    screenshotUrl: '/guide/location/analysis-technical.png',
    annotations: [
      ann('ss-close', 83.4, 89.2, 5.6, 4.2, 'Lukk / fullfør', '#a855f7', 'top-right'),
      ann('ss-check', 12.3, 12.8, 75.6, 74.6, 'Kjør kvalitetssjekk før lagring', '#22d3ee'),
    ],
  },
};

export interface LocationAnalysisGuideProps {
  open: boolean;
  onClose: () => void;
  initialStepId?: string;
}

export function LocationAnalysisGuide({ open, onClose, initialStepId }: LocationAnalysisGuideProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig = getGuideConfig('location-analysis');
  const activeIds = getActiveStepIds('location-analysis');
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map((id) => STEPS.find((s) => s.id === id)).filter(Boolean) as Step[])
    : STEPS;

  const [activeStepId, setActiveStepId] = useState(initialStepId ?? visibleSteps[0].id);
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    alt: string;
    annotations?: GuideStepAnnotation[];
  } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const preferred =
      initialStepId && visibleSteps.some((step) => step.id === initialStepId)
        ? initialStepId
        : visibleSteps[0].id;
    setActiveStepId(preferred);
  }, [open, initialStepId, visibleSteps]);

  useEffect(() => {
    if (!visibleSteps.some((step) => step.id === activeStepId)) {
      setActiveStepId(visibleSteps[0].id);
    }
  }, [activeStepId, visibleSteps]);

  useEffect(() => {
    if (!imagePreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImagePreview(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imagePreview]);

  useEffect(() => {
    if (!open) setImagePreview(null);
  }, [open]);

  const activeStep = visibleSteps.find((s) => s.id === activeStepId) ?? visibleSteps[0];
  const activeIdx = visibleSteps.findIndex((s) => s.id === activeStepId);
  const stepOverride = getStepOverride('location-analysis', activeStep.id);

  const goPrev = useCallback(() => {
    if (activeIdx > 0) setActiveStepId(visibleSteps[activeIdx - 1].id);
  }, [activeIdx, visibleSteps]);

  const goNext = useCallback(() => {
    if (activeIdx < visibleSteps.length - 1) setActiveStepId(visibleSteps[activeIdx + 1].id);
  }, [activeIdx, visibleSteps]);

  const handleStepSelect = useCallback((id: string) => {
    setActiveStepId(id);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const accent = guideConfig.accentColorOverride ?? '#22d3ee';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isNarrow}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#12121e',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: isNarrow ? 0 : 2,
          height: isNarrow ? '100dvh' : '88vh',
          maxHeight: '88vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 1.5,
          flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          gap: 1.5,
        }}
      >
        <HelpIcon sx={{ color: accent, fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Location Analysis - Guide
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>
            Steg {activeIdx + 1} av {visibleSteps.length}
          </Typography>
        </Box>
        <Tooltip title="Lukk guide">
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      {guideConfig.introBanner && (
        <Box
          sx={{
            mx: 2.5,
            mt: 1.25,
            mb: 0.25,
            p: 1.25,
            borderLeft: `3px solid ${guideConfig.introBannerColor ?? accent}`,
            bgcolor: `${guideConfig.introBannerColor ?? accent}18`,
            borderRadius: '0 8px 8px 0',
          }}
        >
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            {guideConfig.introBanner}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {!isNarrow && (
          <Box
            sx={{
              width: 280,
              borderRight: '1px solid rgba(255,255,255,0.07)',
              bgcolor: 'rgba(255,255,255,0.02)',
              overflowY: 'auto',
            }}
          >
            <Box sx={{ p: 1.25 }}>
              <List disablePadding>
                {visibleSteps.map((step, idx) => {
                  const done = idx < activeIdx;
                  const current = step.id === activeStepId;
                  const ov = getStepOverride('location-analysis', step.id);
                  return (
                    <ListItemButton
                      key={step.id}
                      onClick={() => handleStepSelect(step.id)}
                      sx={{
                        mb: 0.5,
                        borderRadius: 1,
                        px: 1.1,
                        py: 0.75,
                        border: '1px solid transparent',
                        ...(current
                          ? {
                              bgcolor: `${accent}22`,
                              borderColor: `${accent}55`,
                            }
                          : done
                          ? { bgcolor: '#22c55e12' }
                          : { bgcolor: 'transparent' }),
                      }}
                    >
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 1,
                          bgcolor: current ? `${accent}2b` : done ? '#22c55e20' : 'rgba(255,255,255,0.06)',
                          color: current ? accent : done ? '#22c55e' : 'rgba(255,255,255,0.45)',
                          border: `1px solid ${
                            current ? `${accent}70` : done ? '#22c55e66' : 'rgba(255,255,255,0.1)'
                          }`,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </Box>

                      <ListItemText
                        primary={
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              fontWeight: current ? 700 : 500,
                              color: current
                                ? accent
                                : done
                                ? 'rgba(255,255,255,0.75)'
                                : 'rgba(255,255,255,0.55)',
                              lineHeight: 1.3,
                            }}
                          >
                            {ov.labelOverride ?? step.label}
                          </Typography>
                        }
                      />

                      {ov.badge && (
                        <Box
                          component="span"
                          sx={{
                            ml: 0.5,
                            px: 0.5,
                            py: 0.125,
                            bgcolor: `${accent}22`,
                            color: accent,
                            border: `1px solid ${accent}44`,
                            borderRadius: 0.5,
                            fontSize: '0.55rem',
                            fontWeight: 700,
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ov.badge}
                        </Box>
                      )}
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          </Box>
        )}

        <DialogContent
          ref={contentRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2.5, md: 4 },
            py: 3,
            '&.MuiDialogContent-root': { p: 0 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: `${accent}22`,
                border: `1px solid ${accent}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accent,
                flexShrink: 0,
              }}
            >
              {activeStep.icon}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'rgba(255,255,255,0.92)' }}>
              {activeStep.label}
            </Typography>
          </Box>

          {activeStep.sections.map((section, sectionIndex) => (
            <Box key={sectionIndex} sx={{ mb: 4 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  color: 'rgba(255,255,255,0.85)',
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    width: 4,
                    height: 14,
                    bgcolor: accent,
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
                {section.heading}
              </Typography>

              {section.body}

              {(() => {
                const sectionKey = `${activeStep.id}.${sectionIndex}`;
                const fallbackAsset = DEFAULT_SECTION_ASSETS[sectionKey];
                const resolvedScreenshot = stepOverride.screenshotUrl ?? fallbackAsset?.screenshotUrl;
                const resolvedAnnotations = stepOverride.annotations ?? fallbackAsset?.annotations;

                if (stepOverride.videoUrl) {
                  return (
                    <Box
                      component="video"
                      src={stepOverride.videoUrl}
                      controls
                      sx={{
                        width: '100%',
                        borderRadius: 2,
                        border: '1px solid rgba(255,255,255,0.1)',
                        mt: 1.5,
                        display: 'block',
                      }}
                    />
                  );
                }

                if (resolvedScreenshot) {
                  return (
                    <>
                      <GuideAnnotatedScreenshot
                        src={resolvedScreenshot}
                        alt={section.screenshotLabel}
                        annotations={resolvedAnnotations}
                        onActivate={() =>
                          setImagePreview({
                            src: resolvedScreenshot,
                            alt: section.screenshotLabel,
                            annotations: resolvedAnnotations,
                          })
                        }
                        containerSx={{
                          mt: 1.5,
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: '1px solid rgba(255,255,255,0.1)',
                          bgcolor: 'rgba(0,0,0,0.35)',
                          '&:focus-visible': {
                            boxShadow: `0 0 0 2px ${accent}`,
                          },
                        }}
                        imageSx={{ objectFit: 'contain' }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', mt: 0.75, color: 'rgba(255,255,255,0.5)' }}
                      >
                        Klikk bildet for stor visning.
                      </Typography>
                    </>
                  );
                }

                return (
                  <>
                    <ScreenshotPlaceholder label={section.screenshotLabel} />
                    <VideoPlaceholder label={section.screenshotLabel} />
                  </>
                );
              })()}

              {sectionIndex < activeStep.sections.length - 1 && (
                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 3 }} />
              )}
            </Box>
          ))}

          {stepOverride.adminNote && (
            <Box
              sx={{
                mt: 1.5,
                mb: 2,
                p: 1.5,
                borderLeft: `3px solid ${stepOverride.adminNoteColor ?? '#f59e0b'}`,
                bgcolor: `${stepOverride.adminNoteColor ?? '#f59e0b'}14`,
                borderRadius: '0 8px 8px 0',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: stepOverride.adminNoteColor ?? '#f59e0b',
                  fontWeight: 700,
                  display: 'block',
                  fontSize: '0.7rem',
                  mb: 0.5,
                }}
              >
                Merknad
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.75)',
                  fontSize: '0.82rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {stepOverride.adminNote}
              </Typography>
            </Box>
          )}

          {isNarrow && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
              {visibleSteps.map((step, idx) => {
                const ov = getStepOverride('location-analysis', step.id);
                return (
                  <Chip
                    key={step.id}
                    label={ov.labelOverride ?? step.label}
                    size="small"
                    clickable
                    onClick={() => handleStepSelect(step.id)}
                    sx={{
                      height: 24,
                      fontSize: '0.68rem',
                      ...(step.id === activeStepId
                        ? { bgcolor: `${accent}22`, color: accent, border: `1px solid ${accent}44` }
                        : idx < activeIdx
                        ? { bgcolor: '#22c55e14', color: '#22c55e' }
                        : { bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.45)' }),
                    }}
                  />
                );
              })}
            </Box>
          )}
        </DialogContent>
      </Box>

      <DialogActions
        sx={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          px: 2,
          py: 1.25,
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Box>
          {activeIdx > 0 && (
            <Button onClick={goPrev} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem' }}>
              ← Forrige
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem' }}>
            Lukk
          </Button>
          {activeIdx < visibleSteps.length - 1 ? (
            <Button
              variant="contained"
              onClick={goNext}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.76rem',
                bgcolor: accent,
                '&:hover': { filter: 'brightness(1.08)' },
              }}
            >
              Neste →
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={onClose}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.76rem',
                bgcolor: accent,
                '&:hover': { filter: 'brightness(1.08)' },
              }}
            >
              Ferdig ✓
            </Button>
          )}
        </Box>
      </DialogActions>

      {imagePreview && (
        <Box
          role="dialog"
          aria-modal="true"
          aria-label={imagePreview.alt}
          onClick={() => setImagePreview(null)}
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: theme.zIndex.modal + 20,
            bgcolor: 'rgba(0,0,0,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 2, sm: 4 },
          }}
        >
          <IconButton
            onClick={() => setImagePreview(null)}
            aria-label="Lukk forhåndsvisning"
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.08)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          <Box
            onClick={(event) => event.stopPropagation()}
            sx={{
              width: 'min(1400px, calc(100vw - 32px))',
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 32px)',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
              bgcolor: '#000',
              overflow: 'hidden',
            }}
          >
            <GuideAnnotatedScreenshot
              src={imagePreview.src}
              alt={imagePreview.alt}
              annotations={imagePreview.annotations}
              containerSx={{ maxWidth: '100%', maxHeight: '100%' }}
              imageSx={{ maxHeight: '100%', objectFit: 'contain' }}
            />
          </Box>
        </Box>
      )}
    </Dialog>
  );
}

export default LocationAnalysisGuide;
