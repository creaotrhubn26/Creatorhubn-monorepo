/**
 * LocationAnalysisGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Location Analysis Dialog.
 *
 * Renders as a full-screen Dialog with a two-column layout:
 *   Left  — sticky step navigator (clickable)
 *   Right — scrollable content with screenshot placeholders
 *
 * 6 steps covering: overview, photography spots, drone restrictions,
 * weather exposure, access analysis, and saving results.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback } from 'react';
import { useVisualEditor } from './admin/visual-editor/VisualEditorContext';
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
  Paper,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  CheckCircleOutline as DoneIcon,
  HelpOutline as HelpIcon,
  Videocam as VideoIcon,
  CameraAlt as CameraIcon,
  Flight as DroneIcon,
  WbSunny as WeatherIcon,
  Accessible as AccessIcon,
  Save as SaveIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
  sections: StepSection[];
}

interface StepSection {
  heading: string;
  body: React.ReactNode;
  screenshot?: string;
  screenshotLabel: string;
}

// ─── Screenshot Placeholder ───────────────────────────────────────────────────

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
        📸 Screenshot placeholder — {label}
      </Typography>
    </Box>
  );
}

// ─── Video Placeholder ───────────────────────────────────────────────────────

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
        🎬 Video placeholder — {label}
      </Typography>
    </Box>
  );
}

// ─── Callout Box ─────────────────────────────────────────────────────────────

function Callout({
  color = '#00d4ff',
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
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6 }}>
        {children}
      </Typography>
    </Box>
  );
}

// ─── CTA Button ──────────────────────────────────────────────────────────────

function CtaButton({
  label,
  action,
  onAction,
  icon,
}: {
  label: string;
  action: string;
  onAction?: (action: string) => void;
  icon?: React.ReactNode;
}) {
  if (!onAction) return null;
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={() => onAction(action)}
      startIcon={icon}
      sx={{
        mt: 1.5,
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.78rem',
        color: '#00d4ff',
        borderColor: 'rgba(0,212,255,0.4)',
        bgcolor: 'rgba(0,212,255,0.06)',
        '&:hover': {
          borderColor: '#00d4ff',
          bgcolor: 'rgba(0,212,255,0.14)',
        },
        borderRadius: 1.5,
        px: 2,
        py: 0.5,
      }}
    >
      {label}
    </Button>
  );
}

// ─── Accent colour ───────────────────────────────────────────────────────────

const ACCENT = '#00d4ff';

// ─── Step content ─────────────────────────────────────────────────────────────

function buildSteps(onAction?: (action: string) => void): Step[] {
return [
  // ── 1 · Overview ──────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: <HelpIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'What is the Location Analysis?',
        screenshotLabel: 'Analysis dialog — full view with all sections',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The <strong>Location Analysis</strong> dialog provides an automated, data-driven
              report for any production location. It uses the location's <strong>property ID</strong>
              (resolved via Kartverket address validation) to query external services and
              build a comprehensive assessment covering:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Photography spots</strong> — best angles, accessibility, restrictions</li>
              <li><strong>Drone restrictions</strong> — flight permits, altitude limits, no-fly zones</li>
              <li><strong>Weather exposure</strong> — wind, sun, shelter options, drone safety</li>
              <li><strong>Access analysis</strong> — parking, public transport, EV charging, accessibility</li>
            </Box>
          </>
        ),
      },
      {
        heading: 'How to trigger an analysis',
        screenshotLabel: 'Card action button — "Analyze" icon highlighted',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Open an analysis by clicking the <strong>analytics icon</strong> on any location card
              in the grid view. The dialog opens and automatically begins fetching data.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              If the location has a <strong>property ID</strong> (from address validation),
              analysis data is fetched directly. Otherwise the system first resolves the
              address through the <strong>Kartverket API</strong> to obtain a property ID, then
              proceeds with the analysis.
            </Typography>
            <Callout>
              A stale request guard ensures only the most recent API response is rendered — 
              if you switch between locations quickly, outdated responses are silently discarded.
            </Callout>
            <CtaButton label="Kjør en analyse nå" action="run-analysis" onAction={onAction} icon={<AnalyticsIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 2 · Photography Spots ─────────────────────────────────────────────────
  {
    id: 'photography-spots',
    label: 'Photography Spots',
    icon: <CameraIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Spot cards',
        screenshotLabel: 'Photography spots grid — spot cards with accessibility chips',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The <strong>Photography Spots</strong> section displays a grid of identified
              camera positions. Each spot card shows:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Spot number</strong> — e.g. "Punkt 1", "Punkt 2"</li>
              <li><strong>Accessibility level</strong> — colour-coded chip:
                <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0.5 }}>
                  <li><strong style={{ color: '#4caf50' }}>Enkel</strong> (Easy) — green</li>
                  <li><strong style={{ color: '#ff9800' }}>Moderat</strong> (Moderate) — orange</li>
                  <li><strong style={{ color: '#f44336' }}>Vanskelig</strong> (Difficult) — red</li>
                </Box>
              </li>
              <li><strong>Description</strong> — what makes this spot useful</li>
              <li><strong>Restrictions</strong> — chips listing constraints (e.g. time-of-day, permits)</li>
              <li><strong>GPS coordinates</strong> — latitude &amp; longitude for navigation</li>
            </Box>
          </>
        ),
      },
      {
        heading: 'Spot count header',
        screenshotLabel: 'Camera icon header with "N fotografispotter funnet"',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              The section header shows a camera icon and a count badge
              (e.g. <em>"4 fotografispotter funnet"</em>). The count helps you quickly
              assess how many viable camera positions exist at this location.
            </Typography>
            <CtaButton label="Se fotografiseksjonen" action="scroll-photography" onAction={onAction} icon={<CameraIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 3 · Drone Restrictions ────────────────────────────────────────────────
  {
    id: 'drone-restrictions',
    label: 'Drone Restrictions',
    icon: <DroneIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Flight status',
        screenshotLabel: 'Drone section — Tillatt/Ikke tillatt chip and altitude',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The <strong>Drone Restrictions</strong> section opens with a clear
              <strong> status chip</strong>:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong style={{ color: '#4caf50' }}>Tillatt</strong> (Allowed) — drone flights are permitted</li>
              <li><strong style={{ color: '#f44336' }}>Ikke tillatt</strong> (Not allowed) — drone flights are prohibited</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1 }}>
              When flights are allowed, the <strong>maximum altitude</strong> (in metres) is displayed.
            </Typography>
          </>
        ),
      },
      {
        heading: 'Restrictions & no-fly zones',
        screenshotLabel: 'Restrictions list and no-fly zone count',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Below the status, two sub-sections detail the specifics:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Restriction list</strong> — individual items styled with warning colours, describing specific constraints (e.g. "Must maintain line-of-sight", "No flights above 120 m")</li>
              <li><strong>No-fly zones</strong> — count of identified zones in the area, styled with danger coloring for high visibility</li>
            </Box>
            <Callout color="#ff9800">
              Always verify drone restrictions with local authorities before flying.
              The analysis provides guidance, not legal clearance.
            </Callout>
            <CtaButton label="Se drone-seksjonen" action="scroll-drone" onAction={onAction} icon={<DroneIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 4 · Weather Exposure ──────────────────────────────────────────────────
  {
    id: 'weather-exposure',
    label: 'Weather Exposure',
    icon: <WeatherIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Wind & sun conditions',
        screenshotLabel: 'Two-column layout — wind and sun exposure details',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The <strong>Weather Exposure</strong> section uses a two-column layout:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Wind Exposure</strong> — level chip (Lav/Moderat/Høy), wind speed (km/h + m/s), direction (degrees), and a <strong>Drone Safety</strong> assessment:
                <Box component="ul" sx={{ pl: 2, mt: 0.5, mb: 0.5 }}>
                  <li><strong style={{ color: '#4caf50' }}>Trygt</strong> — safe to fly</li>
                  <li><strong style={{ color: '#ff9800' }}>Vanskelig</strong> — challenging conditions</li>
                  <li><strong style={{ color: '#f44336' }}>Farlig</strong> — dangerous, do not fly</li>
                </Box>
              </li>
              <li><strong>Sun Exposure</strong> — period chip (Morgen/Ettermiddag/Hele dagen), sunrise &amp; sunset times, daylight hours, description of lighting conditions</li>
            </Box>
          </>
        ),
      },
      {
        heading: 'Shelter options',
        screenshotLabel: 'Shelter chips — trees, buildings, overhangs, etc.',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              Below the wind/sun cards, a row of <strong>shelter option chips</strong> lists
              available cover at the location (e.g. trees, buildings, overhangs).
              This is critical for planning outdoor shoots in variable weather.
            </Typography>
            <Callout>
              The drone safety assessment cross-references wind speed with drone
              manufacturer guidelines. Conditions above 40 km/h are flagged as dangerous.
            </Callout>
            <CtaButton label="Se værseksjonen" action="scroll-weather" onAction={onAction} icon={<WeatherIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 5 · Access Analysis ───────────────────────────────────────────────────
  {
    id: 'access-analysis',
    label: 'Access Analysis',
    icon: <AccessIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Parking & navigation',
        screenshotLabel: 'Parking spots list with Google Maps navigation links',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The <strong>Access Analysis</strong> section starts with <strong>parking information</strong>:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li>Nearby parking spots with <strong>distance</strong>, <strong>number of spaces</strong>, and <strong>description</strong></li>
              <li>Each spot is <strong>clickable</strong> — opens Google Maps with directions from the location</li>
              <li><strong>Accessibility status</strong> — wheelchair-accessible / limited / not accessible</li>
            </Box>
          </>
        ),
      },
      {
        heading: 'Public transport',
        screenshotLabel: 'Transit section — bus lines as chips, walking distance',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The <strong>public transport</strong> sub-section lists:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Bus/transit lines</strong> — shown as chips with line numbers</li>
              <li><strong>Total line count</strong></li>
              <li><strong>Walking distance</strong> to nearest stop</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1 }}>
              This helps coordinators plan crew transport and determine whether a location
              is accessible without private vehicles.
            </Typography>
          </>
        ),
      },
      {
        heading: 'EV parking & charging',
        screenshotLabel: 'EV section — charging stations with navigation links',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              A dedicated <strong>EV Parking &amp; Charging</strong> sub-section shows:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>EV parking spots</strong> — with distance, description, and Google Maps navigation</li>
              <li><strong>Charging stations</strong> — nearby chargers with distance, provider info, and navigation links</li>
            </Box>
            <Callout>
              All parking and charging locations are navigable — click any item to open
              turn-by-turn directions in Google Maps from the production location.
            </Callout>
            <CtaButton label="Se tilgangsseksjonen" action="scroll-access" onAction={onAction} icon={<AccessIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 6 · Saving Results ────────────────────────────────────────────────────
  {
    id: 'saving-results',
    label: 'Saving Results',
    icon: <SaveIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Persisting analysis data',
        screenshotLabel: 'Dialog footer — Oppdater, Lukk, and Lagre analyse buttons',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The dialog footer has three actions:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Oppdater</strong> (Refresh) — re-fetches the analysis from scratch</li>
              <li><strong>Lukk</strong> (Close) — closes the dialog without saving</li>
              <li><strong>Lagre analyse</strong> (Save Analysis) — appears only when new data has been fetched but not yet persisted. Saves all four analysis sections (photography, drone, weather, access) to the location record</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1 }}>
              The <strong>"Lagre analyse"</strong> button uses a <strong>dirty flag</strong> — 
              it only appears when the analysis data differs from what was previously saved.
              Once saved, the analysis results are available whenever you re-open the dialog.
            </Typography>
            <Callout color="#4caf50">
              Saved analysis data is persisted to the location record via the casting service.
              Next time you open the dialog, the cached results load instantly without re-fetching.
            </Callout>
            <CtaButton label="Oppdater analysen" action="refresh-analysis" onAction={onAction} icon={<RefreshIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },
]
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface LocationAnalysisGuideProps {
  open: boolean;
  onClose: () => void;
  /** If provided, the guide opens directly to this step. */
  initialStepId?: string;
  /** Called when the user clicks a "Try it now" CTA button inside a step. */
  onAction?: (action: string) => void;
}

export function LocationAnalysisGuide({ open, onClose, initialStepId, onAction }: LocationAnalysisGuideProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  // ── Admin guide config ──────────────────────────────────────────────
  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const steps = buildSteps(onAction);
  const guideConfig  = getGuideConfig('location-analysis');
  const activeIds    = getActiveStepIds('location-analysis');
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map(id => steps.find(s => s.id === id)).filter(Boolean) as Step[])
    : steps;

  const [activeStepId, setActiveStepId] = useState(initialStepId ?? visibleSteps[0].id);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeStep = visibleSteps.find((s) => s.id === activeStepId) ?? visibleSteps[0];
  const activeIdx  = visibleSteps.findIndex((s) => s.id === activeStepId);
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

  const accentColor = guideConfig.accentColorOverride ?? ACCENT;

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
      {/* ── Header ── */}
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
        <AnalyticsIcon sx={{ color: accentColor, fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Location Analysis — How it works
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem' }}>
            Step {activeIdx + 1} of {visibleSteps.length}
          </Typography>
        </Box>
        <Tooltip title="Close guide">
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      {/* ── Admin intro banner (set via Guide Editor) ── */}
      {guideConfig.introBanner && (
        <Box sx={{ px: 3, py: 1.25, bgcolor: `${guideConfig.introBannerColor ?? '#f59e0b'}18`, borderBottom: `1px solid ${guideConfig.introBannerColor ?? '#f59e0b'}33`, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ width: 3, height: '100%', minHeight: 16, bgcolor: guideConfig.introBannerColor ?? '#f59e0b', borderRadius: 1, flexShrink: 0, mt: 0.5 }} />
          <Typography variant="caption" sx={{ color: guideConfig.introBannerColor ?? '#f59e0b', fontSize: '0.78rem', lineHeight: 1.6 }}>
            {guideConfig.introBanner}
          </Typography>
        </Box>
      )}

      {/* ── Body ── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left nav */}
        {!isNarrow && (
          <Box
            sx={{
              width: 200,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.07)',
              overflowY: 'auto',
              pt: 1,
              pb: 2,
            }}
          >
            <List dense disablePadding>
              {visibleSteps.map((step, idx) => {
                const isActive = step.id === activeStepId;
                const isPast = idx < activeIdx;
                const ov = getStepOverride('location-analysis', step.id);
                return (
                  <ListItemButton
                    key={step.id}
                    selected={isActive}
                    onClick={() => handleStepSelect(step.id)}
                    sx={{
                      px: 2,
                      py: 0.875,
                      borderRight: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                      bgcolor: isActive ? `${accentColor}14` : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      gap: 1.25,
                    }}
                  >
                    <Box
                      sx={{
                        color: isActive ? accentColor : isPast ? '#22c55e' : 'rgba(255,255,255,0.3)',
                        display: 'flex',
                        flexShrink: 0,
                      }}
                    >
                      {isPast ? <DoneIcon sx={{ fontSize: 16 }} /> : step.icon}
                    </Box>
                    <ListItemText
                      primary={ov.labelOverride ?? step.label}
                      primaryTypographyProps={{
                        sx: {
                          fontSize: '0.78rem',
                          fontWeight: isActive ? 700 : 400,
                          color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
                          lineHeight: 1.3,
                        },
                      }}
                    />
                    {ov.badge && (
                      <Box component="span" sx={{ ml: 0.5, px: 0.5, py: 0.125, bgcolor: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44`, borderRadius: 0.5, fontSize: '0.55rem', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {ov.badge}
                      </Box>
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        {/* Content */}
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
          {/* Step heading */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, pt: 3, px: { xs: 2.5, md: 4 } }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: `${accentColor}22`,
                border: `1px solid ${accentColor}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
                flexShrink: 0,
              }}
            >
              {activeStep.icon}
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'rgba(255,255,255,0.92)' }}>
              {activeStep.label}
            </Typography>
          </Box>

          {/* Sections */}
          <Box sx={{ px: { xs: 2.5, md: 4 }, pb: 3 }}>
            {activeStep.sections.map((section, sIdx) => (
              <Box key={sIdx} sx={{ mb: 4 }}>
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
                  <Box component="span" sx={{ display: 'inline-block', width: 4, height: 14, bgcolor: accentColor, borderRadius: 1, flexShrink: 0 }} />
                  {section.heading}
                </Typography>

                {section.body}

                {stepOverride.videoUrl ? (
                  <Box component="video" src={stepOverride.videoUrl} controls
                    sx={{ width: '100%', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', mt: 1.5, display: 'block' }} />
                ) : stepOverride.screenshotUrl ? (
                  <Box
                    component="img"
                    src={stepOverride.screenshotUrl}
                    alt={section.screenshotLabel}
                    sx={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', mt: 1.5 }}
                  />
                ) : (
                  <>
                    <ScreenshotPlaceholder label={section.screenshotLabel} />
                    <VideoPlaceholder label={section.screenshotLabel} />
                  </>
                )}

                {sIdx < activeStep.sections.length - 1 && (
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 3 }} />
                )}
              </Box>
            ))}
          </Box>

          {/* Admin note from Guide Editor */}
          {stepOverride.adminNote && (
            <Box sx={{ mx: { xs: 2.5, md: 4 }, mt: 1.5, mb: 2, p: 1.5, borderLeft: `3px solid ${stepOverride.adminNoteColor ?? '#f59e0b'}`, bgcolor: `${stepOverride.adminNoteColor ?? '#f59e0b'}14`, borderRadius: '0 8px 8px 0' }}>
              <Typography variant="caption" sx={{ color: stepOverride.adminNoteColor ?? '#f59e0b', fontWeight: 700, display: 'block', fontSize: '0.7rem', mb: 0.5 }}>Merknad</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {stepOverride.adminNote}
              </Typography>
            </Box>
          )}

          {/* Mobile step nav */}
          {isNarrow && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2, px: 2.5 }}>
              {visibleSteps.map((s, i) => {
                const ov = getStepOverride('location-analysis', s.id);
                return (
                  <Chip
                    key={s.id}
                    label={ov.labelOverride ?? s.label}
                    size="small"
                    clickable
                    onClick={() => handleStepSelect(s.id)}
                    sx={{
                      height: 24,
                      fontSize: '0.68rem',
                      ...(s.id === activeStepId
                        ? { bgcolor: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }
                        : i < activeIdx
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

      {/* ── Footer nav ── */}
      <DialogActions
        sx={{
          flexShrink: 0,
          px: 3,
          py: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          justifyContent: 'flex-start',
        }}
      >
        {/* Step dots */}
        <Box sx={{ flex: 1, display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {visibleSteps.map((s, i) => (
            <Tooltip key={s.id} title={s.label}>
              <Box
                onClick={() => handleStepSelect(s.id)}
                sx={{
                  width: i === activeIdx ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: i === activeIdx ? accentColor : i < activeIdx ? '#22c55e' : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  transition: 'width 0.2s, background-color 0.2s',
                  '&:hover': { bgcolor: i === activeIdx ? accentColor : 'rgba(255,255,255,0.35)' },
                }}
              />
            </Tooltip>
          ))}
        </Box>

        <Paper elevation={0} sx={{ display: 'flex', gap: 1, bgcolor: 'transparent' }}>
          <Button
            size="small"
            disabled={activeIdx === 0}
            onClick={goPrev}
            sx={{ textTransform: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem' }}
          >
            ← Prev
          </Button>

          {activeIdx < visibleSteps.length - 1 ? (
            <Button
              size="small"
              variant="contained"
              onClick={goNext}
              sx={{
                bgcolor: accentColor,
                '&:hover': { bgcolor: '#0097b2' },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                px: 2,
              }}
            >
              Next →
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              onClick={onClose}
              sx={{
                bgcolor: '#22c55e',
                '&:hover': { bgcolor: '#16a34a' },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                px: 2,
              }}
            >
              Done ✓
            </Button>
          )}
        </Paper>
      </DialogActions>
    </Dialog>
  );
}
