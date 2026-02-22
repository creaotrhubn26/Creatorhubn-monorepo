/**
 * DashboardGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Dashboard Panel.
 *
 * Covers:
 *   – Overview & layout
 *   – Statistics cards (roles, candidates, upcoming schedules)
 *   – Casting progress bar & status distribution
 *   – Quick Actions (New Role, New Candidate, New Schedule)
 *   – Inline editing (project title & description)
 *   – Sharing a project with the team
 *   – The embedded Kanban board overview
 *
 * Renders as a full-screen Dialog with a two-column layout:
 *   Left  — sticky step navigator (clickable)
 *   Right — scrollable content with screenshot / video placeholders
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useRef, useCallback } from 'react';
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  CheckCircleOutline as DoneIcon,
  HelpOutline as HelpIcon,
  Dashboard as OverviewIcon,
  BarChart as StatsIcon,
  TrendingUp as ProgressIcon,
  FlashOn as ActionsIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  ViewKanban as KanbanIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import { useVisualEditor } from './admin/visual-editor/VisualEditorContext';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Callout ─────────────────────────────────────────────────────────────────

function Callout({
  color = '#8b5cf6',
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

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.125,
        borderRadius: '4px',
        bgcolor: `${color}20`,
        color,
        border: `1px solid ${color}55`,
        fontSize: '0.7rem',
        fontWeight: 700,
        mx: 0.25,
      }}
    >
      {label}
    </Box>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const ACCENT = '#8b5cf6';

const STEPS: Step[] = [
  // ── 1. Overview ──────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: <OverviewIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is the Dashboard?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The Dashboard is your central command centre for every casting project.
              It gives you a live snapshot of the project's health — how many roles are
              open, how many candidates are in the pipeline, and what auditions are coming
              up — without having to switch between tabs.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              It is split into five main zones:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                ['Project header', 'Name, description, and Share button at the top.'],
                ['Statistics cards', '4 clickable cards giving at-a-glance totals.'],
                ['Casting Progress', 'Colour-coded progress bar across all candidate statuses.'],
                ['Quick Actions', 'One-click buttons: New Role, New Candidate, New Schedule.'],
                ['Kanban board', 'An embedded Kanban view for visual candidate tracking.'],
              ].map(([title, desc]) => (
                <Box component="li" key={title} sx={{ mb: 0.75 }}>
                  <Typography variant="body2">
                    <strong style={{ color: ACCENT }}>{title}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              Every number on the Dashboard is <strong>live</strong> — it updates
              automatically as you add or change roles and candidates.
            </Callout>
          </>
        ),
        screenshotLabel: 'Dashboard — full panel overview with all sections visible',
      },
    ],
  },

  // ── 2. Statistics Cards ───────────────────────────────────────────────────
  {
    id: 'stats-cards',
    label: 'Statistics Cards',
    icon: <StatsIcon fontSize="small" />,
    sections: [
      {
        heading: 'The four at-a-glance cards',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The top row of the Dashboard shows four count cards. Each card is
              <strong> clickable</strong> and will navigate you directly to the
              relevant tab in the project.
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { label: 'Roller totalt', color: '#f48fb1', tab: 'Roles tab', desc: 'Total number of roles created in this project.' },
                { label: 'Åpne roller', color: '#10b981', tab: 'Roles tab', desc: 'Roles with status "open" or "casting" — still looking for talent.' },
                { label: 'Kandidater', color: '#10b981', tab: 'Candidates tab', desc: 'Total candidates across all statuses.' },
                { label: 'Kommende avtaler', color: '#ffb800', tab: 'Auditions tab', desc: 'Audition slots scheduled from today onwards.' },
              ].map(card => (
                <Box key={card.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <StatPill label={card.label} color={card.color} />
                  <Box>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {card.desc}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem' }}>
                      → navigates to <strong style={{ color: 'rgba(255,255,255,0.5)' }}>{card.tab}</strong>
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
            <Callout color="#10b981">
              Click any stat card to jump directly to the relevant section instead of
              using the tab bar manually.
            </Callout>
          </>
        ),
        screenshotLabel: 'Statistics cards row — all four cards with live counts',
      },
    ],
  },

  // ── 3. Casting Progress ───────────────────────────────────────────────────
  {
    id: 'casting-progress',
    label: 'Casting Progress',
    icon: <ProgressIcon fontSize="small" />,
    sections: [
      {
        heading: 'Progress bar & status distribution',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Below the stat cards, the <strong>Casting Progress</strong> card appears
              whenever at least one candidate exists. It gives you a visual breakdown of
              how your candidate pipeline is distributed across all statuses.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The segmented bar is divided proportionally by status count:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { color: '#10b981', label: 'Bekreftet', desc: 'Cast confirmed and locked in.' },
                { color: '#8b5cf6', label: 'Valgt', desc: 'Selected by the team, pending confirmation.' },
                { color: '#ffb800', label: 'Shortlist', desc: 'On the shortlist for consideration.' },
                { color: '#00d4ff', label: 'Forespurt', desc: 'An offer or request has been sent.' },
                { color: '#6b7280', label: 'Venter', desc: 'No action taken yet.' },
                { color: '#ef4444', label: 'Avvist', desc: 'Not selected for this project.' },
              ].map(s => (
                <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, '&:last-child': { mb: 0 } }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                    <strong style={{ color: s.color }}>{s.label}</strong> — {s.desc}
                  </Typography>
                </Box>
              ))}
            </Paper>
            <Callout>
              Hover any segment of the progress bar to see the exact candidate count
              in a tooltip. The <strong>% fullført</strong> chip in the top-right shows
              how many roles have been filled (status = "filled").
            </Callout>
          </>
        ),
        screenshotLabel: 'Casting Progress card — segmented bar and status legend',
      },
    ],
  },

  // ── 4. Quick Actions ─────────────────────────────────────────────────────
  {
    id: 'quick-actions',
    label: 'Quick Actions',
    icon: <ActionsIcon fontSize="small" />,
    sections: [
      {
        heading: 'One-click shortcuts',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Hurtighandlinger</strong> (Quick Actions) card sits below the
              progress bar and provides three primary buttons for the most common workflows:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { label: 'Ny rolle', color: '#00d4ff', desc: 'Opens the role creation form. Add a character name, gender notes, and casting status.' },
                { label: 'Ny kandidat', color: '#10b981', desc: 'Opens the candidate form. Add name, contact details, and attach to a role.' },
                { label: 'Ny timeplan', color: '#8b5cf6', desc: 'Opens the audition scheduler. Requires at least one role and one candidate to be created first.' },
              ].map(a => (
                <Box key={a.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: a.color,
                      flexShrink: 0,
                      mt: 0.5,
                    }}
                  />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: a.color, fontSize: '0.85rem' }}>
                      {a.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {a.desc}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
            <Callout color="#ffb800">
              <strong>Ny timeplan</strong> is disabled (greyed out) until you have added
              at least one role and one candidate — hover the button to see the tooltip
              explaining why.
            </Callout>
          </>
        ),
        screenshotLabel: 'Quick Actions card — three buttons (Ny rolle, Ny kandidat, Ny timeplan)',
      },
    ],
  },

  // ── 5. Editing Project Details ────────────────────────────────────────────
  {
    id: 'editing-details',
    label: 'Editing Details',
    icon: <EditIcon fontSize="small" />,
    sections: [
      {
        heading: 'Inline title and description editing',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The project title and description at the top of the Dashboard are
              <strong> inline-editable</strong> — no separate settings page required.
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Click the <strong>pencil icon</strong> next to the project title to rename it.',
                'Press <strong>Enter</strong> to save or <strong>Escape</strong> to cancel.',
                'Click the smaller pencil icon next to the description to update it.',
                'The description supports multi-line text — press <strong>Shift+Enter</strong> for a new line.',
                'Changes are saved to the server immediately on confirm.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.75 }}>
                  <Typography
                    variant="body2"
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                </Box>
              ))}
            </Box>
            <Callout>
              The title is used throughout the app (tab titles, share links, exports)
              so keeping it clear and concise helps the whole team.
            </Callout>
          </>
        ),
        screenshotLabel: 'Inline title edit active — TextField with Save / Cancel icons',
      },
    ],
  },

  // ── 6. Sharing ────────────────────────────────────────────────────────────
  {
    id: 'sharing',
    label: 'Sharing',
    icon: <ShareIcon fontSize="small" />,
    sections: [
      {
        heading: 'Share the project with your team',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Del prosjekt</strong> (Share project) button in the top-right
              corner of the Dashboard opens the sharing panel. From there you can:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Invite team members by email with different access levels.',
                'Generate a shareable invite link.',
                'Manage existing collaborators (view, edit, or remove access).',
                'See who currently has access to the project.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.75 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#00d4ff">
              On mobile the button shows only the share icon — on desktop the full
              "Del prosjekt" label is visible.
            </Callout>
          </>
        ),
        screenshotLabel: 'Share panel open — invite form and collaborator list',
      },
    ],
  },

  // ── 7. Kanban Overview ───────────────────────────────────────────────────
  {
    id: 'kanban-overview',
    label: 'Kanban Board',
    icon: <KanbanIcon fontSize="small" />,
    sections: [
      {
        heading: 'The embedded Kanban board',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Directly below the Quick Actions card you will find a full Kanban board
              embedded in the Dashboard. It shows all your candidates organised into
              status columns so you can see the casting pipeline at a glance and take
              action without leaving the Dashboard.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Key Kanban features available from the Dashboard:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Drag a candidate card to a different column to change their status instantly.',
                'Click <strong>+ Add Candidate</strong> inside any column to create one directly.',
                'Use the search field to filter cards by candidate name.',
                'Use the role dropdown to show candidates for a single role.',
                'Select multiple cards to bulk-move or bulk-delete them.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.75 }}>
                  <Typography
                    variant="body2"
                    dangerouslySetInnerHTML={{ __html: item }}
                  />
                </Box>
              ))}
            </Box>
            <Callout>
              For a full walkthrough of every Kanban feature, open the dedicated Kanban
              Guide using the <strong>?</strong> help button in the Kanban toolbar.
            </Callout>
          </>
        ),
        screenshotLabel: 'Kanban board embedded in Dashboard — columns with candidate cards',
      },
    ],
  },
];

// ─── Guide ID ─────────────────────────────────────────────────────────────────

const GUIDE_ID = 'dashboard' as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface DashboardGuideProps {
  open: boolean;
  onClose: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function DashboardGuide({ open, onClose }: DashboardGuideProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig = getGuideConfig(GUIDE_ID);
  const activeStepIds = getActiveStepIds(GUIDE_ID);

  const visibleSteps: Step[] = STEPS.filter(s =>
    activeStepIds === null || activeStepIds.includes(s.id)
  ).map(s => {
    const override = getStepOverride(GUIDE_ID, s.id);
    if (!override) return s;
    return { ...s, label: override.label ?? s.label };
  });

  const currentStep = visibleSteps[activeStepIndex] ?? visibleSteps[0];
  const stepOverride = getStepOverride(GUIDE_ID, currentStep?.id ?? '');

  const goTo = useCallback(
    (index: number) => {
      setActiveStepIndex(Math.max(0, Math.min(index, visibleSteps.length - 1)));
      if (contentRef.current) contentRef.current.scrollTop = 0;
    },
    [visibleSteps.length]
  );

  const handlePrev = () => goTo(activeStepIndex - 1);
  const handleNext = () => goTo(activeStepIndex + 1);
  const handleDone = () => {
    onClose();
    setActiveStepIndex(0);
  };

  const isFirst = activeStepIndex === 0;
  const isLast = activeStepIndex === visibleSteps.length - 1;

  const ACCENT_COLOR = guideConfig?.accentColor ?? ACCENT;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      aria-labelledby="dashboard-guide-title"
      PaperProps={{ sx: { bgcolor: '#0f0f0f', backgroundImage: 'none' } }}
    >
      {/* ── Title bar ── */}
      <DialogTitle
        id="dashboard-guide-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          px: 3,
          py: 1.5,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <HelpIcon sx={{ color: ACCENT_COLOR, fontSize: 22 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', fontSize: '1.05rem' }}>
            {guideConfig?.title ?? 'Dashboard — Guide'}
          </Typography>
          <Chip
            label={`${activeStepIndex + 1} / ${visibleSteps.length}`}
            size="small"
            sx={{
              bgcolor: `${ACCENT_COLOR}20`,
              color: ACCENT_COLOR,
              fontWeight: 700,
              fontSize: '0.7rem',
              height: 20,
            }}
          />
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* ── Body ── */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left nav — hidden on mobile */}
        {!isMobile && (
          <Box
            sx={{
              width: 210,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              overflowY: 'auto',
              py: 1,
            }}
          >
            <List dense disablePadding>
              {visibleSteps.map((step, i) => {
                const active = i === activeStepIndex;
                return (
                  <ListItemButton
                    key={step.id}
                    selected={active}
                    onClick={() => goTo(i)}
                    sx={{
                      mx: 1,
                      borderRadius: 1.5,
                      mb: 0.25,
                      '&.Mui-selected': {
                        bgcolor: `${ACCENT_COLOR}1A`,
                        '& .MuiListItemText-primary': { color: ACCENT_COLOR, fontWeight: 700 },
                      },
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                    }}
                  >
                    <Box sx={{ mr: 1, color: active ? ACCENT_COLOR : 'rgba(255,255,255,0.3)', display: 'flex' }}>
                      {step.icon}
                    </Box>
                    <ListItemText
                      primary={step.label}
                      primaryTypographyProps={{
                        fontSize: '0.82rem',
                        color: active ? ACCENT_COLOR : 'rgba(255,255,255,0.7)',
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        {/* Right — Scrollable content */}
        <DialogContent ref={contentRef} sx={{ flex: 1, overflowY: 'auto', px: { xs: 2.5, sm: 4 }, py: 3 }}>
          {currentStep && (
            <Box sx={{ maxWidth: 780, mx: 'auto' }}>
              {/* Step heading */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    bgcolor: `${ACCENT_COLOR}20`,
                    border: `1px solid ${ACCENT_COLOR}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: ACCENT_COLOR,
                    flexShrink: 0,
                  }}
                >
                  {currentStep.icon}
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2, fontSize: '1.2rem' }}>
                    {currentStep.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                    Step {activeStepIndex + 1} of {visibleSteps.length}
                  </Typography>
                </Box>
              </Box>

              {/* Sections */}
              {currentStep.sections.map((section, si) => (
                <Box key={si} sx={{ mb: 4 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: ACCENT_COLOR, mb: 1.25, fontSize: '0.95rem' }}
                  >
                    {section.heading}
                  </Typography>
                  {section.body}
                  {stepOverride?.videoUrl ? (
                    <Box
                      component="video"
                      src={stepOverride.videoUrl}
                      controls
                      sx={{ width: '100%', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', mt: 1.5, display: 'block' }}
                    />
                  ) : stepOverride?.screenshotUrl ? (
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
                  {si < currentStep.sections.length - 1 && (
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 2 }} />
                  )}
                </Box>
              ))}

              {/* Admin note from Guide Editor */}
              {stepOverride?.adminNote && (
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
                    sx={{ color: stepOverride.adminNoteColor ?? '#f59e0b', fontWeight: 700, display: 'block', fontSize: '0.7rem', mb: 0.5 }}
                  >
                    Merknad
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {stepOverride.adminNote}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Box>

      {/* ── Footer ── */}
      <DialogActions
        sx={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          px: 3,
          py: 1.5,
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Button
          onClick={handlePrev}
          disabled={isFirst}
          variant="outlined"
          sx={{ borderColor: 'rgba(255,255,255,0.2)', color: '#fff', '&:disabled': { opacity: 0.3 } }}
        >
          ← Prev
        </Button>
        <Button
          onClick={handleDone}
          variant="text"
          size="small"
          sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}
        >
          Close
        </Button>
        {isLast ? (
          <Button
            onClick={handleDone}
            variant="contained"
            startIcon={<DoneIcon />}
            sx={{ bgcolor: ACCENT_COLOR, color: '#fff', fontWeight: 700, '&:hover': { filter: 'brightness(1.15)' } }}
          >
            Done ✓
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{ bgcolor: ACCENT_COLOR, color: '#fff', fontWeight: 700, '&:hover': { filter: 'brightness(1.15)' } }}
          >
            Next →
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default DashboardGuide;
