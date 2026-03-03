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
  Place as PlaceIcon,
  QueryStats as StatsIcon,
  ViewModule as ViewModeIcon,
  Map as MapIcon,
  HomeWork as BasecampIcon,
  Link as LinkIcon,
  Collections as MediaIcon,
  FactCheck as ConsistencyIcon,
  Analytics as AnalysisIcon,
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
  color = '#a855f7',
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

function Key({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        border: '1px solid rgba(255,255,255,0.2)',
        bgcolor: 'rgba(255,255,255,0.07)',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'text.primary',
        lineHeight: 1.4,
        mx: 0.25,
      }}
    >
      {children}
    </Box>
  );
}

const STEPS: Step[] = [
  {
    id: 'overview',
    label: 'Oversikt',
    icon: <PlaceIcon fontSize="small" />,
    sections: [
      {
        heading: 'Hva panelet brukes til',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.2 }}>
              Location Management er kontrollsenteret for alle produksjonssteder i prosjektet.
              Panelet samler lokasjonsdata, kapasitet, fasiliteter, kontaktinformasjon og koblinger
              til scener, shot list og storyboard i ett sted.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Du kan jobbe i kortvisning, tabell eller pro-visning avhengig av om du trenger rask
              oversikt eller dypere operativ planlegging.
            </Typography>
          </>
        ),
        screenshotLabel: 'Location Management panel - hovedoversikt',
      },
      {
        heading: 'Toppfelt og raske handlinger',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Headeren gir deg rask tilgang til:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1 }}>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2"><strong>Guide</strong> - åpnes med <Key>G</Key>.</Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2"><strong>Eksporter</strong> - CSV av synlige lokasjoner.</Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2"><strong>Statistikk</strong> - vis/skjul KPI-kort.</Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2"><strong>Ny lokasjon</strong> - oppretter lokasjon raskt.</Typography>
              </Box>
            </Box>
            <Callout>
              Hurtigtaster: <Key>Ctrl</Key>+<Key>N</Key> oppretter ny lokasjon, <Key>Ctrl</Key>+<Key>E</Key>
              eksporterer listen, og <Key>G</Key> åpner guiden.
            </Callout>
          </>
        ),
        screenshotLabel: 'Header med Guide, Eksporter, Statistikk og Ny lokasjon',
      },
    ],
  },
  {
    id: 'stats-filters',
    label: 'Statistikk og filtre',
    icon: <StatsIcon fontSize="small" />,
    sections: [
      {
        heading: 'KPI-kort og typefordeling',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Statistikkpanelet viser totaler, kapasitet, koordinatdekning, favoritter og fordeling per
            lokasjonstype. Dette gir rask innsikt i hva som er klart og hva som mangler.
          </Typography>
        ),
        screenshotLabel: 'Statistikkpanel med totaler og typefordeling',
      },
      {
        heading: 'Sok, typefilter og sortering',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.2 }}>
              Bruk sokefeltet for navn/adresse/type/notater, kombiner med typefilter og sorter etter
              navn, kapasitet, type eller antall scener.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Filtrering gjelder i alle visningsmoduser og styrer også hvilke lokasjoner som vises i kartet.
            </Typography>
          </>
        ),
        screenshotLabel: 'Filterlinje med sok, typefilter og sortering',
      },
    ],
  },
  {
    id: 'view-modes',
    label: 'Visningsmoduser',
    icon: <ViewModeIcon fontSize="small" />,
    sections: [
      {
        heading: 'Kort, tabell og pro-visning',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.2 }}>
              Bytt mellom tre moduser:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 0 }}>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2"><strong>Kort</strong> - visuell gjennomgang per lokasjon.</Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2"><strong>Tabell</strong> - tettere sammenligning og sortering.</Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2"><strong>Pro</strong> - operativ visning med kart, readiness, konsistens og arbeidsflyt.</Typography>
              </Box>
            </Box>
          </>
        ),
        screenshotLabel: 'Brytere for kort, tabell og pro-visning',
      },
      {
        heading: 'Lagrede pro-visninger',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            I pro-modus kan du lagre egne visninger med preset, filter og sortering. Dette gjør det enkelt
            å bytte mellom for eksempel Tech Scout, Tillatelser og Lavt budsjett.
          </Typography>
        ),
        screenshotLabel: 'Pro-visning med lagrede visninger og presets',
      },
    ],
  },
  {
    id: 'map-cards',
    label: 'Kart og kort',
    icon: <MapIcon fontSize="small" />,
    sections: [
      {
        heading: 'Kart + kort 60/40',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.2 }}>
              Pro-visning kan vise kart og kort samtidig slik at du ser geografi og operativ status i samme layout.
              Lokasjoner med koordinater blir synlige som pins.
            </Typography>
            <Callout color="#22d3ee">
              Når du filtrerer listen, oppdateres kartpins automatisk slik at kart og kort alltid er synkronisert.
            </Callout>
          </>
        ),
        screenshotLabel: 'Split layout med kart til venstre og lokasjonskort til hoyre',
      },
      {
        heading: 'Pin-synk og fokus',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Klikk på lokasjon i listen for å fokusere pin i kartet. Klikk på pin for å aktivere samme
            lokasjon i listen, slik at hele teamet jobber på samme kontekst.
          </Typography>
        ),
        screenshotLabel: 'Aktiv pin markert i kart med samsvarende kort valgt',
      },
    ],
  },
  {
    id: 'pro-operations',
    label: 'Pro-operasjoner',
    icon: <BasecampIcon fontSize="small" />,
    sections: [
      {
        heading: 'Basecamp-markering og load-flow',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Merk basecamp-lokasjon og planlegg load-in, shoot-start, wrap og load-out. Disse feltene gir
            tydelig operativ status for logistikk og riggflyt per lokasjon.
          </Typography>
        ),
        screenshotLabel: 'Pro-kort med basecamp-status og load-in/load-out felter',
      },
      {
        heading: 'Teknisk readiness og risiko',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Hver lokasjon får readiness-score, risikoniva, budsjettindikator og dekning av tekniske roller.
            Bruk dette for prioritering av rekognosering og beslutninger i produksjonsmoter.
          </Typography>
        ),
        screenshotLabel: 'Readiness/risiko KPI i pro-kort',
      },
    ],
  },
  {
    id: 'scene-links',
    label: 'Scene-koblinger',
    icon: <LinkIcon fontSize="small" />,
    sections: [
      {
        heading: 'Hvilke scener filmes her',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Knytt scener direkte til lokasjon slik at du ser shot-behov, callback-avhengigheter og crew-touchpoints
            i samme panel. Dette reduserer avvik mellom planlegging og gjennomforing.
          </Typography>
        ),
        screenshotLabel: 'Scene-link modul i pro-kort',
      },
      {
        heading: 'Utstyr og storyboard-kontekst',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Scene-koblingen viser hvilket utstyr som trengs og hvor mange storyboard-referanser som er knyttet til
            lokasjonen. Dermed ser teknisk avdeling og regi samme sannhet.
          </Typography>
        ),
        screenshotLabel: 'Scene insight med utstyrsliste og storyboard-antall',
      },
    ],
  },
  {
    id: 'media-storyboard',
    label: 'Media og storyboard',
    icon: <MediaIcon fontSize="small" />,
    sections: [
      {
        heading: 'Lokasjonsbilder og storyboard-bilder',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Last opp eller lim inn URL for lokasjonsbilder og storyboard-referanser direkte på lokasjonen.
            Hvert bilde kan merkes med caption og valgte scener.
          </Typography>
        ),
        screenshotLabel: 'Media-seksjon med opplasting av lokasjonsbilder og storyboard',
      },
      {
        heading: 'Redigering i samme flyt',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Kontaktdata, scene-koblinger, load-flow og media kan redigeres inline uten å forlate pro-visning.
            Dette reduserer kontekstbytte og holder teamet i samme arbeidsflate.
          </Typography>
        ),
        screenshotLabel: 'Inline redigering av kontakt, media og scene-kobling',
      },
    ],
  },
  {
    id: 'consistency-workflow',
    label: 'Konsistens og CTA',
    icon: <ConsistencyIcon fontSize="small" />,
    sections: [
      {
        heading: 'Konsistenssjekk med indikasjon',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Pro-visning varsler når viktig data mangler, for eksempel kontaktinfo, tillatelser,
            load-flow eller scene-koblinger. Varslene vises som tydelige funn per lokasjon.
          </Typography>
        ),
        screenshotLabel: 'Konsistensfunn med mangler markert',
      },
      {
        heading: 'CTA som apner riktig redigeringsflyt',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.2 }}>
              Hvert funn har CTA-knapp som apner riktig seksjon og starter redigering direkte. Seksjonen
              un-collapses automatisk slik at brukeren lander der problemet faktisk er.
            </Typography>
            <Callout>
              Bruk dette som kvalitetssluse for hele teamet: identifiser avvik, hopp direkte til riktig felt,
              og lukk avvik uten ekstra navigasjon.
            </Callout>
          </>
        ),
        screenshotLabel: 'CTA fra konsistensfunn som apner riktig seksjon i redigering',
      },
    ],
  },
  {
    id: 'analysis-handoff',
    label: 'Lokasjonsanalyse',
    icon: <AnalysisIcon fontSize="small" />,
    sections: [
      {
        heading: 'Apen lokasjonsanalyse fra kort eller tabell',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Fra hver lokasjon kan du apne Location Analysis Dialog for dypere innsikt i tillatelser,
            risiko, vaer, tilgjengelighet og kontaktflyt. Guiden for analyse finnes inne i dialogen.
          </Typography>
        ),
        screenshotLabel: 'Handling for apning av lokasjonsanalyse fra lokasjonskort',
      },
    ],
  },
];

const DEFAULT_SECTION_ASSETS: Record<string, SectionAsset> = {
  'overview.0': {
    screenshotUrl: '/guide/location/management-standard.png',
    annotations: [
      ann('ov-panel', 4.6, 18.1, 12.2, 3.5, 'Panel', '#a855f7'),
      ann('ov-kpi', 1.4, 23.5, 97.2, 12.1, 'KPI-oversikt', '#22d3ee'),
      ann('ov-cards', 1.4, 44.6, 97.2, 53.8, 'Lokasjonskort', '#34d399'),
    ],
  },
  'overview.1': {
    screenshotUrl: '/guide/location/management-standard.png',
    annotations: [
      ann('ov-export', 74.7, 18.6, 7.5, 4.2, 'Eksporter', '#22d3ee'),
      ann('ov-stats-toggle', 82.2, 18.6, 2.9, 4.2, 'Statistikk', '#f59e0b'),
      ann('ov-guide', 85.2, 18.6, 5.2, 4.2, 'Guide', '#a855f7', 'top-right'),
      ann('ov-new-location', 90.4, 18.6, 8, 4.2, 'Ny lokasjon', '#34d399', 'top-right'),
    ],
  },
  'stats-filters.0': {
    screenshotUrl: '/guide/location/management-standard.png',
    annotations: [
      ann('sf-kpi-row', 1.4, 23.5, 97.2, 12.1, 'Statistikkrad', '#22d3ee'),
      ann('sf-kpi-total', 6.8, 26.6, 3.5, 7.2, 'Total', '#a855f7'),
      ann('sf-kpi-cap', 19.8, 26.6, 6.2, 7.2, 'Kapasitet', '#22d3ee'),
      ann('sf-kpi-fav', 48, 26.6, 4.6, 7.2, 'Favoritter', '#f59e0b'),
    ],
  },
  'stats-filters.1': {
    screenshotUrl: '/guide/location/management-standard.png',
    annotations: [
      ann('sf-search', 3.2, 38.5, 85.2, 3.5, 'Søk', '#22d3ee'),
      ann('sf-filter-toggle', 88.5, 38.4, 2.6, 3.6, 'Filter', '#a855f7'),
      ann('sf-sort-views', 91.1, 38.4, 7.3, 3.6, 'Visningsbytte', '#34d399', 'top-right'),
    ],
  },
  'view-modes.0': {
    screenshotUrl: '/guide/location/management-standard.png',
    annotations: [
      ann('vm-mode-group', 91.1, 38.4, 7.3, 3.6, 'Kort / Tabell / Pro', '#22d3ee', 'top-right'),
      ann('vm-card', 91.2, 38.6, 2.2, 3.2, '', '#22d3ee'),
      ann('vm-table', 93.7, 38.6, 2.2, 3.2, '', '#a855f7'),
      ann('vm-pro', 96.2, 38.6, 2.2, 3.2, '', '#34d399'),
    ],
  },
  'view-modes.1': {
    screenshotUrl: '/guide/location/management-pro.png',
    annotations: [
      ann('vm-presets', 4.2, 49.1, 16.8, 2.7, 'Presets', '#a855f7'),
      ann('vm-save-view', 86.8, 52.1, 6.2, 3.5, 'Lagre view', '#22d3ee', 'top-right'),
    ],
  },
  'map-cards.0': {
    screenshotUrl: '/guide/location/management-pro.png',
    annotations: [
      ann('mc-map-title', 2.1, 59.5, 58.1, 2.2, 'Kart + kort', '#22d3ee'),
      ann('mc-map', 2.1, 62, 35.5, 18.5, 'Kart', '#22d3ee'),
      ann('mc-right-panel', 62, 59.5, 36, 18.7, 'Operativt panel', '#a855f7'),
    ],
  },
  'map-cards.1': {
    screenshotUrl: '/guide/location/management-pro.png',
    annotations: [
      ann('mc-map-focus', 2.1, 62, 35.5, 18.5, 'Pin-område', '#22d3ee'),
      ann('mc-list-sync', 20.2, 62.4, 17.1, 17.7, 'Synket lokasjonsliste', '#34d399'),
      ann('mc-map-controls', 2.6, 63.1, 1.6, 4.4, 'Kartkontroll', '#f59e0b'),
    ],
  },
  'pro-operations.0': {
    screenshotUrl: '/guide/location/management-pro-detail.png',
    annotations: [
      ann('po-worklist', 2.1, 59, 58.3, 40.2, 'Pro-arbeidsliste', '#22d3ee'),
      ann('po-basecamp-row', 2.1, 74.7, 58.3, 4.2, 'Basecamp + load-flow', '#a855f7'),
      ann('po-set-basecamp', 48.5, 75.8, 4.4, 2.5, 'Sett basecamp', '#34d399'),
    ],
  },
  'pro-operations.1': {
    screenshotUrl: '/guide/location/management-pro-detail.png',
    annotations: [
      ann('po-kpi-row', 1.5, 17.6, 97, 6.6, 'Klarhet / risiko KPI', '#22d3ee'),
      ann('po-missing-permit', 18.1, 19.1, 4.3, 2.2, 'Mangler tillatelse', '#f59e0b'),
      ann('po-budget-panel', 62, 55.1, 36, 12.8, 'Budsjett-intelligens', '#a855f7'),
    ],
  },
  'scene-links.0': {
    screenshotUrl: '/guide/location/management-pro-detail.png',
    annotations: [
      ann('sl-scene-row', 2.1, 78.6, 58.3, 4.2, 'Scene-kobling', '#22d3ee'),
      ann('sl-connect-scenes', 52.7, 79.9, 4, 2.5, 'Koble scener', '#34d399'),
      ann('sl-crew-shotlist', 62, 34.6, 36, 18.8, 'Crew + ShotList', '#a855f7'),
    ],
  },
  'scene-links.1': {
    screenshotUrl: '/guide/location/management-pro-detail.png',
    annotations: [
      ann('sl-shotlist-metric', 66.7, 19.1, 3.1, 2.1, 'Har shotlist', '#22d3ee'),
      ann('sl-crew-panel', 62, 34.6, 36, 18.8, 'Teknisk hull / shotlist-kobling', '#a855f7'),
      ann('sl-worklist-context', 2.1, 59, 58.3, 14.7, 'Scenekontekst i arbeidsliste', '#34d399'),
    ],
  },
  'media-storyboard.0': {
    screenshotUrl: '/guide/location/management-pro-detail.png',
    annotations: [
      ann('ms-media-row', 2.1, 82.8, 58.3, 4.2, 'Lokasjonsbilder + storyboard', '#22d3ee'),
      ann('ms-edit-media', 52.3, 83.9, 4.5, 2.5, 'Rediger media', '#34d399'),
    ],
  },
  'media-storyboard.1': {
    screenshotUrl: '/guide/location/management-pro-detail.png',
    annotations: [
      ann('ms-contact-row', 2.1, 86.7, 58.3, 4.2, 'Kontaktinfo', '#22d3ee'),
      ann('ms-edit-contact', 52.1, 87.9, 4.8, 2.5, 'Rediger kontakt', '#34d399'),
      ann('ms-inline-flow', 2.1, 74.7, 58.3, 16.2, 'Inline redigeringsflyt', '#a855f7'),
    ],
  },
  'consistency-workflow.0': {
    screenshotUrl: '/guide/location/management-pro-detail.png',
    annotations: [
      ann('cw-panel', 62, 66, 36, 31.8, 'Konsistenssjekk', '#22d3ee'),
      ann('cw-findings', 62.3, 71, 35.3, 23.2, 'Mangler per lokasjon', '#a855f7'),
    ],
  },
  'consistency-workflow.1': {
    screenshotUrl: '/guide/location/management-pro-detail.png',
    annotations: [
      ann('cw-panel-cta', 62, 66, 36, 31.8, 'Feilfunn + CTA', '#22d3ee'),
      ann('cw-cta-load-flow', 92, 71.1, 5.5, 2.5, 'Gå til load-flow', '#34d399', 'top-right'),
    ],
  },
  'analysis-handoff.0': {
    screenshotUrl: '/guide/location/management-standard.png',
    annotations: [
      ann('ah-card-row', 3, 80.3, 21, 5.4, 'Korthandlinger', '#22d3ee'),
      ann('ah-analyze', 14.6, 81.2, 2.2, 3.8, 'Åpne analyse', '#34d399'),
    ],
  },
};

export interface LocationManagementGuideProps {
  open: boolean;
  onClose: () => void;
  initialStepId?: string;
}

export function LocationManagementGuide({ open, onClose, initialStepId }: LocationManagementGuideProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig = getGuideConfig('location-management');
  const activeIds = getActiveStepIds('location-management');
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
  const stepOverride = getStepOverride('location-management', activeStep.id);

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

  const accent = guideConfig.accentColorOverride ?? '#a855f7';

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
            Location Management - Guide
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
                  const ov = getStepOverride('location-management', step.id);
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
                const ov = getStepOverride('location-management', step.id);
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

export default LocationManagementGuide;
