/**
 * LiveSetModeGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Live Set Mode panel.
 *
 * Covers all three tiers:
 *   MVP    — ROLL/CUT workflow, takes log, quick notes, activity feed
 *   Pro    — multi-camera metadata, exports (PDF + CSV), role permissions
 *   Studio — offline outbox, presence bar, realtime WebSocket sync
 *
 * Renders as a full-screen Dialog with a two-column layout:
 *   Left  — sticky step navigator (clickable)
 *   Right — scrollable content with screenshot placeholders
 *
 * Screenshot placeholders are <ScreenshotPlaceholder label="…" /> boxes.
 * Replace each one with a real <img> or <video> when assets are ready.
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
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  Videocam as RollIcon,
  Star as CircleIcon,
  PhotoCamera as CameraIcon,
  Notes as NotesIcon,
  Timeline as FeedIcon,
  Map as ScenePlanIcon,
  FileDownload as ExportIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  AdminPanelSettings as RolesIcon,
  WifiOff as OfflineIcon,
  Group as PresenceIcon,
  Lightbulb as TipIcon,
  LiveTv as LiveIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';

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
  color = '#F97316',
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

// ─── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: 'MVP' | 'Pro' | 'Studio' }) {
  const colors: Record<string, string> = {
    MVP:    '#10B981',
    Pro:    '#F97316',
    Studio: '#8B5CF6',
  };
  return (
    <Chip
      label={tier}
      size="small"
      sx={{
        height: 18,
        fontSize: '0.62rem',
        fontWeight: 700,
        bgcolor: `${colors[tier]}25`,
        color: colors[tier],
        border: `1px solid ${colors[tier]}50`,
        verticalAlign: 'middle',
        mx: 0.5,
      }}
    />
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
        color: '#F97316',
        borderColor: 'rgba(249,115,22,0.4)',
        bgcolor: 'rgba(249,115,22,0.06)',
        '&:hover': {
          borderColor: '#F97316',
          bgcolor: 'rgba(249,115,22,0.14)',
        },
      }}
    >
      {label}
    </Button>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

function buildSteps(onAction?: (action: string) => void): Step[] {
  return [
  // ── 1. Overview ───────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: <LiveIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is Live Set Mode?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              <strong>Live Set Mode</strong> is the on-set production tool built for the crew
              members who are physically on set during a shooting day. It gives the 1st AC,
              script supervisor, director, and producer a shared, real-time view of every
              take, continuity note, and setup change as they happen.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              The interface is intentionally full-screen and touch-friendly so it can be
              operated on a tablet clipped to a camera cart or director's chair.
            </Typography>
            <Callout>
              💡 Live Set Mode is available in three tiers.{' '}
              <TierBadge tier="MVP" /> covers core logging.{' '}
              <TierBadge tier="Pro" /> adds multi-camera metadata and PDF/CSV exports.{' '}
              <TierBadge tier="Studio" /> adds real-time WebSocket sync across the entire crew.
            </Callout>
          </>
        ),
        screenshotLabel: 'Live Set Mode — full-screen overview on set tablet',
      },
      {
        heading: 'Interface layout',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The screen is divided into three panels (on desktop; mobile shows the left
              panel only by default):
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Left panel', 'ROLL / CUT hero button, circular take timer, Scene & Take number boxes, grading buttons (GOD / CIRCLE / BAD), quick-note shortcuts, and "Next Scene" / "Setup Complete" controls'],
                ['Centre panel (md+)', 'Current scene heading, location, call time, and an upcoming-scenes list — hidden on small screens'],
                ['Right panel', 'Activity tabs: Takes Log (every logged take with grade & duration) and Notes (inline quick notes with timestamp)'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              The top bar shows the project title, your role, an Export button{' '}
              <TierBadge tier="Pro" />, the current network status (Live / Polling), and
              a presence avatar row{' '}
              <TierBadge tier="Studio" />.
            </Typography>
            <CtaButton label="Åpne Live Set" action="open-live-set" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Annotated 3-panel layout: left ROLL/CUT, centre scene info, right activity tabs',
      },
    ],
  },

  // ── 2. ROLL & CUT workflow ───────────────────────────────────────────────
  {
    id: 'roll-cut',
    label: 'ROLL & CUT',
    icon: <RollIcon fontSize="small" />,
    sections: [
      {
        heading: 'Starting a take — ROLL',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Press the large green <strong>● ROLL</strong> button to mark the start of a
              take. The button turns red and a live timer starts counting the take duration
              in real time. A status chip in the header switches to <em>"ROLLING"</em>.
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, mt: 0 }}>
              {[
                'Ensure scene number and shot number are correct in the header',
                'Press ROLL — the take timer starts',
                'Call "Action!" as normal',
              ].map((step, i) => (
                <Box key={i} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{step}</Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              When you are offline, pressing ROLL is saved to the <strong>offline outbox</strong>{' '}
              and replayed automatically the next time a network connection is restored.
            </Callout>
          </>
        ),
        screenshotLabel: 'ROLL button active — timer counting, status "ROLLING"',
      },
      {
        heading: 'Ending a take — CUT',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Press the red <strong>■ CUT</strong> button after the director calls cut.
              Choose one of the four outcome statuses in the confirmation dialog:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['OK', 'Take is good — printed/circled for editorial'],
                ['NG', 'No-good — not printed, will re-shoot'],
                ['HOLD', 'Hold for review before deciding'],
                ['FALSE START', 'Camera or sound issue — does not count'],
              ].map(([status, desc]) => (
                <Box key={status} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{status}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              After selecting a status, the take is appended to the <strong>Takes</strong>{' '}
              tab and the take counter auto-increments if that setting is on.
            </Typography>
          </>
        ),
        screenshotLabel: 'CUT dialog — 4 status buttons',
      },
      {
        heading: 'Circling a take',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              After a CUT, if the director calls <em>"Print it"</em> or the take is
              confirmed as a keeper, press the <strong>⭐ Circle</strong> button (or tap the
              star icon on any take row in the Takes log). A circled take is highlighted
              in the log and included in the <strong>Circle/Print PDF</strong> export.
            </Typography>
            <Callout color="#10B981">
              Circling a take is a non-destructive action and can be toggled off at any
              point during the shooting day.
            </Callout>
            <CtaButton label="Start opptak" action="start-roll" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Take row with star circled — highlighted in Takes log',
      },
    ],
  },

  // ── 3. Multi-camera Metadata ─────────────────────────────────────────────
  {
    id: 'multi-camera',
    label: 'Camera Metadata',
    icon: <CameraIcon fontSize="small" />,
    sections: [
      {
        heading: 'Multi-camera setup',
        body: (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
              <TierBadge tier="Pro" />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Pro tier feature
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              When the <strong>CUT dialog</strong> opens on a Pro tier project, there is a
              <em> Camera Metadata</em> accordion. Expand it to log camera body details for
              the take:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Camera ID', 'A / B / C / D — primary camera for this take'],
                ['Lens', 'e.g. "21mm Zeiss Master Prime"'],
                ['FPS', 'frame rate (24 / 25 / 48 / 60 / 120)'],
                ['ISO', 'e.g. 800'],
                ['ND Filter', 'e.g. "ND 0.9"'],
              ].map(([field, note]) => (
                <Box key={field} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{field}</strong> — {note}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Camera Metadata accordion inside CUT dialog',
      },
      {
        heading: 'Additional cameras',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              If multiple cameras are rolling simultaneously (B-cam, crash cam, etc.),
              toggle the extra camera chips in the <em>Additional Cameras</em> row inside
              the CUT dialog. Each selected camera ID is stored with the take record.
            </Typography>
            <Callout color="#F97316">
              Camera metadata is included in the <strong>CSV Takes export</strong> and in
              the PDF Daily Report — giving the DIT, editor, and DI team a complete record
              of every take's technical parameters.
            </Callout>
            <CtaButton label="Legg til kameradata" action="add-camera-metadata" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Additional camera chips B / C / D selected in CUT dialog',
      },
    ],
  },

  // ── 4. Takes Log ──────────────────────────────────────────────────────────
  {
    id: 'takes-log',
    label: 'Takes Log',
    icon: <CircleIcon fontSize="small" />,
    sections: [
      {
        heading: 'Reading the Takes tab',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The <strong>Takes</strong> tab (first tab, right panel) lists every logged
              take in reverse-chronological order. Each row shows:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Take #', 'auto-incremented number'],
                ['Scene / Shot', 'scene and shot identifiers'],
                ['Status badge', 'OK (green) / NG (red) / HOLD (amber) / False Start (grey)'],
                ['Duration', 'hh:mm:ss from ROLL to CUT'],
                ['Camera IDs', 'A / B / C / D chips (Pro)'],
                ['Circle star', 'tap to toggle circled/printed status'],
                ['Time', 'wall-clock time the CUT was pressed'],
              ].map(([field, note]) => (
                <Box key={field} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{field}</strong> — {note}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Takes tab — full take list with status badges and camera chips',
      },
      {
        heading: 'Auto-increment take numbers',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              In the <strong>Settings</strong> panel (gear icon at bottom of the left
              column), enable <em>Auto-increment take number</em>. When on, the take
              counter advances automatically after each CUT so the next ROLL starts on
              the correct take number.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              You can also manually edit the take counter field in the left panel header
              at any time — useful when correcting a mis-logged take or when matching
              numbers logged on a separate camera report.
            </Typography>
            <CtaButton label="Se opptakslogg" action="view-takes-log" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Take counter field in left panel — editable + auto-increment toggle',
      },
    ],
  },

  // ── 5. Quick Notes ───────────────────────────────────────────────────────
  {
    id: 'notes',
    label: 'Quick Notes',
    icon: <NotesIcon fontSize="small" />,
    sections: [
      {
        heading: 'Logging quick notes',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Notes</strong> tab (second tab) is a fast text log for anything
              that needs to be recorded without interrupting the shoot: prop continuity
              callouts, costume changes, actor requests, lighting adjustments in progress.
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, mt: 0 }}>
              {[
                'Type your note in the text field at the bottom of the Notes tab',
                'Press Enter or the Send button to append it to the log',
                'The note is tagged with the current wall-clock time automatically',
              ].map((step, i) => (
                <Box key={i} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{step}</Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              Notes are persisted to <code>localStorage</code> as a safety net so they
              survive accidental page refreshes. They are also sent to the backend on sync
              and included in the <strong>CSV Notes export</strong>.
            </Callout>
          </>
        ),
        screenshotLabel: 'Notes tab — timestamped note list with input field',
      },
      {
        heading: 'Continuity notes',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              A <strong>continuity note</strong> is a note tied to a specific take — for
              example: <em>"HB right hand — take 4, scene 5A, glass on right side of table"</em>.
              Long-press (or right-click) any take row in the Takes tab to add a tied
              continuity note. It appears indented under that take row and is exported
              alongside it in the PDF Daily Report.
            </Typography>
            <CtaButton label="Skriv notat" action="add-quick-note" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Continuity note indented under a take row',
      },
    ],
  },

  // ── 6. Activity Feed ─────────────────────────────────────────────────────
  {
    id: 'activity-feed',
    label: 'Activity Feed',
    icon: <FeedIcon fontSize="small" />,
    sections: [
      {
        heading: 'Unified activity timeline',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Activity Feed</strong> tab (third tab) interleaves all events
              from the shooting day into a single chronological timeline: takes, notes,
              setup changes, and — in Studio tier — actions from remote crew members.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Each event is shown with an icon colour-coded by type:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 1 }}>
              {[
                ['🎬 Green', 'Take rolled and cut (OK)'],
                ['🔴 Red', 'NG take'],
                ['⭐ Amber', 'Take circled / printed'],
                ['📝 Blue', 'Quick note added'],
                ['🔄 Purple', 'Setup change / next setup triggered'],
                ['👤 Teal', 'Remote crew action (Studio)'],
              ].map(([badge, desc]) => (
                <Box key={badge} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{badge}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <CtaButton label="Se aktivitetsstrøm" action="view-activity-feed" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Activity Feed tab — colour-coded event timeline',
      },
    ],
  },

  // ── 7. Scene Plan ────────────────────────────────────────────────────────
  {
    id: 'scene-plan',
    label: 'Scene Plan',
    icon: <ScenePlanIcon fontSize="small" />,
    sections: [
      {
        heading: 'Scene plan tab',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Scene Plan</strong> tab (fourth tab) shows the shot list for the
              current shooting day, pulled from the Stripboard and Shot List panels. Each
              row represents one shot with its scene number, shot description, estimated
              setup time, and completion status.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Use the <strong>Mark Setup Complete</strong> button in the left panel to
              advance through setups in sequence. The Scene Plan tab keeps a visual
              tick-list of completed setups for the day.
            </Typography>
            <Callout color="#8B5CF6">
              The Scene Plan is read-only in Live Set Mode — edits to shot order and scene
              content are made in the Stripboard and Shot List panels and reflected here
              automatically.
            </Callout>
            <CtaButton label="Åpne sceneplan" action="open-scene-plan" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Scene Plan tab — shot list with progress ticks',
      },
    ],
  },

  // ── 8. Export ────────────────────────────────────────────────────────────
  {
    id: 'export',
    label: 'Exports',
    icon: <ExportIcon fontSize="small" />,
    sections: [
      {
        heading: 'Export formats',
        body: (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
              <TierBadge tier="Pro" />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Pro tier feature
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Click the <strong>Export</strong> button in the top bar to open the export
              menu. Four formats are available:
            </Typography>
            <Paper
              elevation={0}
              sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 1.5,
                px: 2,
                py: 1.25,
                mt: 1,
              }}
            >
              <Box component="ul" sx={{ pl: 1.5, mt: 0, mb: 0 }}>
                {[
                  [<PdfIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} key="1" />, 'PDF Daily Report', 'full shooting-day summary with all takes, notes, camera metadata, and totals'],
                  [<PdfIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} key="2" />, 'PDF Circle/Print', 'editor-ready list of circled takes only — one line per take'],
                  [<CsvIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} key="3" />, 'CSV Takes', 'machine-readable spreadsheet of every take with all camera metadata fields'],
                  [<CsvIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} key="4" />, 'CSV Notes', 'timestamped notes list for the script supervisor or production report'],
                ].map(([icon, label, desc]) => (
                  <Box key={String(label)} component="li" sx={{ mb: 0.75 }}>
                    <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                      {icon}<strong>{label}</strong> — {desc}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </>
        ),
        screenshotLabel: 'Export dropdown menu with 4 format options',
      },
      {
        heading: 'Export all at once',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              At the bottom of the export dropdown is an <strong>Export All</strong> option
              that downloads all four files simultaneously as a ZIP archive named after the
              project title and shooting date. Use this at end-of-day wrap to produce a
              complete digital camera-report package in one click.
            </Typography>
            <CtaButton label="Eksporter rapport" action="export-report" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Export All — ZIP download progress indicator',
      },
    ],
  },

  // ── 9. Permissions & Roles ───────────────────────────────────────────────
  {
    id: 'permissions',
    label: 'Roles & Permissions',
    icon: <RolesIcon fontSize="small" />,
    sections: [
      {
        heading: 'Role-based access control',
        body: (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
              <TierBadge tier="Pro" />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Pro tier feature
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <code>userRole</code> prop passed when opening Live Set Mode determines
              which buttons are active. Disabled buttons show a tooltip explaining the
              permission requirement. The permission matrix across all 7 roles:
            </Typography>
            <Paper
              elevation={0}
              sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 1.5,
                overflow: 'hidden',
              }}
            >
              <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <Box component="thead">
                  <Box component="tr" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}>
                    {['Role', 'ROLL', 'CUT', 'Circle', 'Setup', 'Notes', 'Export'].map(h => (
                      <Box component="th" key={h} sx={{ p: 0.75, textAlign: 'left', color: 'rgba(255,255,255,0.6)', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {h}
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box component="tbody">
                  {[
                    ['admin',       '✅','✅','✅','✅','✅','✅'],
                    ['showrunner',  '✅','✅','✅','✅','✅','✅'],
                    ['director',    '✅','✅','✅','✅','✅','✅'],
                    ['script_sup',  '✅','✅','✅','🚫','✅','✅'],
                    ['ac',          '✅','✅','🚫','✅','✅','🚫'],
                    ['producer',    '🚫','🚫','🚫','🚫','✅','✅'],
                    ['guest',       '🚫','🚫','🚫','🚫','🚫','🚫'],
                  ].map(([role, ...perms]) => (
                    <Box component="tr" key={role} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' } }}>
                      <Box component="td" sx={{ p: 0.75, fontWeight: 600, color: '#F97316', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {role}
                      </Box>
                      {perms.map((p, i) => (
                        <Box component="td" key={i} sx={{ p: 0.75, textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          {p}
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Paper>
          </>
        ),
        screenshotLabel: 'Settings panel showing role label and disabled permissions',
      },
      {
        heading: 'Changing or viewing your role',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Your current role is shown in the <strong>Settings</strong> panel (gear icon
              at the bottom of the left column). If you believe your role is incorrectly
              assigned, contact the project admin — roles are set from the Crew Management
              panel, not from within Live Set Mode.
            </Typography>
            <CtaButton label="Se tilganger" action="view-permissions" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Settings panel — role label highlighted',
      },
    ],
  },

  // ── 10. Offline Outbox ───────────────────────────────────────────────────
  {
    id: 'offline-outbox',
    label: 'Offline Outbox',
    icon: <OfflineIcon fontSize="small" />,
    sections: [
      {
        heading: 'Working offline',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Live Set Mode keeps an <strong>offline outbox</strong> so you can continue
              logging on set even when the device has no network connectivity. Every ROLL,
              CUT, circle, and note is first written to the local outbox and then synced
              to the server when a connection is available.
            </Typography>
            <Callout color="#EF4444">
              🔴 <strong>Local</strong> — when you see a red dot badge labelled{' '}
              <em>"lokal"</em> (or a pending count chip), it means there are unsynced
              operations in the outbox. Do <strong>not</strong> clear your browser data
              until the badge disappears.
            </Callout>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              The outbox auto-flushes the moment the browser fires an <code>online</code>{' '}
              event. Failed requests are retried with exponential back-off (up to 5 attempts)
              before being flagged as permanently failed.
            </Typography>
          </>
        ),
        screenshotLabel: 'Top bar — offline indicator badge with pending count',
      },
      {
        heading: 'Sync failure',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              If an outbox entry fails all 5 retry attempts, it is marked as{' '}
              <strong>permanently failed</strong> and a red banner appears. This is rare
              (typically a server error). You can:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                'Take a screenshot of the Takes log for manual entry',
                'Export as CSV (which reads from local state, not the server)',
                'Contact a project admin who can replay or manually enter the data',
              ].map((item) => (
                <Box key={item} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{item}</Typography>
                </Box>
              ))}
            </Box>
            <CtaButton label="Sjekk offline-kø" action="check-offline-outbox" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Sync failure banner with retry options',
      },
    ],
  },

  // ── 11. Presence & Realtime ──────────────────────────────────────────────
  {
    id: 'presence-realtime',
    label: 'Presence & Realtime',
    icon: <PresenceIcon fontSize="small" />,
    sections: [
      {
        heading: 'Live presence bar',
        body: (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
              <TierBadge tier="Studio" />
              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                Studio tier feature
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              In the top-right corner, a row of avatar chips shows every crew member
              currently connected to the same{' '}
              <em>shooting day room</em> in real time. Hovering an avatar shows the crew
              member's name and role. Avatars that have been inactive for more than 3
              minutes are shown semi-transparent.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Next to the presence bar, a status chip shows the connection mode:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 1 }}>
              {[
                ['🟢 Live', 'WebSocket connected — changes appear on all devices within ~200 ms'],
                ['🟡 Polling', 'HTTP polling (5 s interval) — used when WebSocket unavailable'],
              ].map(([chip, desc]) => (
                <Box key={String(chip)} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{chip}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Top bar — presence avatars and Live/Polling chip',
      },
      {
        heading: 'Real-time broadcast events',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              When the WebSocket is connected, these events are broadcast to all connected
              crew members in the room:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                'ROLL started (green flash on all devices)',
                'CUT logged with status (take appears in all Takes logs)',
                'Take circled / uncircled',
                'Note added',
                'Setup complete / next setup advanced',
                'Cursor presence heartbeat (every 10 s)',
              ].map((event) => (
                <Box key={event} component="li" sx={{ mb: 0.4 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{event}</Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#8B5CF6">
              The WebSocket server routes messages to the{' '}
              <code>liveset:{'{'}projectId{'}'}:{'{'}shootingDayId{'}'}</code> room only —
              multiple productions can use the system simultaneously without interference.
            </Callout>
          </>
        ),
        screenshotLabel: 'Activity Feed showing remote crew actions in Studio mode',
      },
      {
        heading: 'Reconnection behaviour',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              The WebSocket client uses exponential back-off reconnection (100 ms → 1 s →
              5 s → 30 s cap). While disconnected the system falls back to HTTP polling.
              On reconnecting, a state snapshot is fetched from the server to close any
              gap in takes or notes that occurred while offline — so no data is lost even
              if a tablet briefly drops signal on set.
            </Typography>
            <CtaButton label="Se tilkoblede" action="view-presence" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Reconnecting indicator with Polling fallback chip',
      },
    ],
  },

  // ── 12. Settings ─────────────────────────────────────────────────────────
  {
    id: 'settings',
    label: 'Settings',
    icon: <TipIcon fontSize="small" />,
    sections: [
      {
        heading: 'On-set settings panel',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Open the settings panel with the <strong>⚙ gear icon</strong> at the bottom
              of the left column. Available toggles:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Auto-increment take number', 'advances the counter automatically after each CUT'],
                ['Dark mode', 'switches to a brighter theme for outdoor shooting'],
                ['Sound alerts', 'plays a beep when ROLL starts (useful for loud sets)'],
                ['Fullscreen', 'enters full-screen mode for tablet use — hides browser chrome'],
              ].map(([label, desc]) => (
                <Box key={label} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              All settings are stored in <code>localStorage</code> per device and persist
              across browser sessions — you do not need to re-configure when you return
              to the same tablet the next day.
            </Callout>
            <CtaButton label="Åpne innstillinger" action="open-settings" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Settings panel — 4 toggle rows',
      },
    ],
  },
  ];
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface LiveSetModeGuideProps {
  open: boolean;
  onClose: () => void;
  initialStepId?: string;
  onAction?: (action: string) => void;
}

const ACCENT = '#F97316';

export const LiveSetModeGuide: React.FC<LiveSetModeGuideProps> = ({
  open,
  onClose,
  initialStepId,
  onAction,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig = getGuideConfig('live-set-mode');
  const activeIds   = getActiveStepIds('live-set-mode');
  const steps = buildSteps(onAction);
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map(id => steps.find(s => s.id === id)).filter(Boolean) as Step[])
    : steps;

  const initialIndex = initialStepId
    ? Math.max(0, visibleSteps.findIndex((s) => s.id === initialStepId))
    : 0;

  const [activeStep, setActiveStep] = useState(initialIndex);
  const contentRef = useRef<HTMLDivElement>(null);

  const step = visibleSteps[activeStep] ?? visibleSteps[0];
  const stepOverride = getStepOverride('live-set-mode', step?.id ?? '');

  const scrollToTop = useCallback(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, []);

  const handleStepClick = useCallback(
    (index: number) => { setActiveStep(index); scrollToTop(); },
    [scrollToTop],
  );

  const handlePrev = useCallback(() => {
    setActiveStep((prev) => { const n = Math.max(0, prev - 1); scrollToTop(); return n; });
  }, [scrollToTop]);

  const handleNext = useCallback(() => {
    setActiveStep((prev) => { const n = Math.min(visibleSteps.length - 1, prev + 1); scrollToTop(); return n; });
  }, [scrollToTop, visibleSteps.length]);

  const isFirst = activeStep === 0;
  const isLast  = activeStep === visibleSteps.length - 1;

  const accentColor = guideConfig.accentColorOverride ?? ACCENT;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { bgcolor: '#12121e', color: 'text.primary' } }}
    >
      {/* ── Title bar ─────────────────────────────────────────────────── */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          py: 1.5,
          px: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LiveIcon sx={{ color: accentColor }} />
          <Typography variant="h6" fontWeight={700}>
            Live Set Mode Guide
          </Typography>
          <Chip
            label={`${activeStep + 1} / ${visibleSteps.length}`}
            size="small"
            sx={{ ml: 1, bgcolor: `${accentColor}25`, color: accentColor }}
          />
        </Box>
        <Tooltip title="Close guide">
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      {/* ── Admin intro banner ────────────────────────────────────────── */}
      {guideConfig.introBanner && (
        <Box sx={{ px: 2.5, py: 1, bgcolor: `${guideConfig.introBannerColor ?? accentColor}20`, borderBottom: `1px solid ${guideConfig.introBannerColor ?? accentColor}40` }}>
          <Typography variant="body2" sx={{ color: guideConfig.introBannerColor ?? accentColor }}>
            {guideConfig.introBanner}
          </Typography>
        </Box>
      )}

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <DialogContent sx={{ p: 0, display: 'flex', overflow: 'hidden', flex: 1 }}>
        {/* Left nav — hidden on mobile */}
        {!isMobile && (
          <Box
            sx={{
              width: 210,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              bgcolor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              overflowY: 'auto',
            }}
          >
            <Typography
              variant="overline"
              sx={{ px: 2, pt: 2, pb: 0.5, fontSize: '0.65rem', color: 'text.disabled', letterSpacing: '0.1em' }}
            >
              Sections
            </Typography>
            <List dense disablePadding>
              {visibleSteps.map((s, idx) => {
                const ov = getStepOverride('live-set-mode', s.id);
                return (
                  <ListItemButton
                    key={s.id}
                    selected={idx === activeStep}
                    onClick={() => handleStepClick(idx)}
                    sx={{
                      px: 2,
                      py: 0.75,
                      gap: 1,
                      borderRadius: 1,
                      mx: 0.5,
                      '&.Mui-selected': {
                        bgcolor: `${accentColor}20`,
                        '&:hover': { bgcolor: `${accentColor}30` },
                      },
                    }}
                  >
                    <Box sx={{ color: idx === activeStep ? accentColor : 'text.secondary', display: 'flex' }}>
                      {s.icon}
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <span>{ov.labelOverride ?? s.label}</span>
                          {ov.badge && (
                            <Chip label={ov.badge} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: `${accentColor}30`, color: accentColor }} />
                          )}
                        </Box>
                      }
                      primaryTypographyProps={{
                        fontSize: '0.8rem',
                        fontWeight: idx === activeStep ? 600 : 400,
                        color: idx === activeStep ? '#fde8d8' : 'text.secondary',
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        )}

        {/* Right scrollable content */}
        <Box
          ref={contentRef}
          sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 4 }, py: 3 }}
        >
          {/* Mobile step chips */}
          {isMobile && (
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.5 }}>
              {visibleSteps.map((s, idx) => {
                const ov = getStepOverride('live-set-mode', s.id);
                return (
                  <Chip
                    key={s.id}
                    label={ov.labelOverride ?? s.label}
                    size="small"
                    onClick={() => handleStepClick(idx)}
                    color={idx === activeStep ? 'primary' : 'default'}
                    sx={{ cursor: 'pointer' }}
                  />
                );
              })}
            </Box>
          )}

          {/* Step heading */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: `${accentColor}25`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
                flexShrink: 0,
              }}
            >
              {step.icon}
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.3 }}>
              {step.label}
            </Typography>
          </Box>

          {/* Sections */}
          {step.sections.map((section, idx) => (
            <Box key={idx} sx={{ mb: 4 }}>
              <Typography
                variant="subtitle1"
                fontWeight={600}
                sx={{ mb: 1.5, color: accentColor }}
              >
                {section.heading}
              </Typography>
              <Box sx={{ mb: 1 }}>{section.body}</Box>
              {stepOverride.videoUrl ? (
                <Box sx={{ width: '100%', my: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <video src={stepOverride.videoUrl} controls style={{ width: '100%', display: 'block' }} />
                </Box>
              ) : stepOverride.screenshotUrl ? (
                <Box sx={{ width: '100%', my: 2, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img src={stepOverride.screenshotUrl} alt={section.screenshotLabel} style={{ width: '100%', display: 'block' }} />
                </Box>
              ) : (
                <>
                  <ScreenshotPlaceholder label={section.screenshotLabel} />
                  <VideoPlaceholder label={section.screenshotLabel} />
                </>
              )}
              {idx < step.sections.length - 1 && (
                <Divider sx={{ mt: 3, borderColor: 'rgba(255,255,255,0.06)' }} />
              )}
            </Box>
          ))}

          {/* Admin note */}
          {stepOverride.adminNote && (
            <Box sx={{ mt: 3, p: 2, borderRadius: 2, border: `1px solid ${stepOverride.adminNoteColor ?? accentColor}40`, bgcolor: `${stepOverride.adminNoteColor ?? accentColor}15` }}>
              <Typography variant="caption" sx={{ color: stepOverride.adminNoteColor ?? accentColor, fontWeight: 600, display: 'block', mb: 0.5 }}>
                Admin Note
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>{stepOverride.adminNote}</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <DialogActions
        sx={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          px: 2.5,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {/* Progress dots */}
        <Box sx={{ display: 'flex', gap: 0.6, flex: 1, flexWrap: 'wrap' }}>
          {visibleSteps.map((_, idx) => (
            <Box
              key={idx}
              onClick={() => handleStepClick(idx)}
              sx={{
                width: idx === activeStep ? 20 : 8,
                height: 8,
                borderRadius: 4,
                bgcolor: idx === activeStep
                  ? accentColor
                  : idx < activeStep
                  ? `${accentColor}50`
                  : 'rgba(255,255,255,0.12)',
                cursor: 'pointer',
                transition: 'width 0.2s ease, background-color 0.2s ease',
              }}
            />
          ))}
        </Box>

        <Button
          variant="outlined"
          size="small"
          onClick={handlePrev}
          disabled={isFirst}
          sx={{ minWidth: 80, borderColor: 'rgba(255,255,255,0.12)', color: isFirst ? 'text.disabled' : 'text.primary' }}
        >
          ← Prev
        </Button>

        {isLast ? (
          <Button
            variant="contained"
            size="small"
            onClick={onClose}
            sx={{ minWidth: 80, bgcolor: accentColor, '&:hover': { bgcolor: '#ea6c10' } }}
          >
            Done ✓
          </Button>
        ) : (
          <Button
            variant="contained"
            size="small"
            onClick={handleNext}
            sx={{ minWidth: 80, bgcolor: accentColor, '&:hover': { bgcolor: '#ea6c10' } }}
          >
            Next →
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LiveSetModeGuide;
