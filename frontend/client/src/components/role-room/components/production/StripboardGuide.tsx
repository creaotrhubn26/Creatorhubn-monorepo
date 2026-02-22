/**
 * StripboardGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Stripboard Panel.
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
  CheckCircleOutline as DoneIcon,
  DragIndicator as DragIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Theaters as TheatersIcon,
  CalendarToday as CalendarIcon,
  Place as PlaceIcon,
  TrendingUp as OptimizeIcon,
  MultipleStop as MultiSelectIcon,
  Download as ExportIcon,
  Print as PrintIcon,
  ViewModule as BoardViewIcon,
  Lightbulb as TipIcon,
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
  color = '#3b82f6',
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

// ─── Keyboard Key ─────────────────────────────────────────────────────────────

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

// ─── Steps ─────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <TheatersIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is the Stripboard?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Stripboard</strong> is a visual shooting schedule — the industry-standard
              tool used on every film and TV production. Each coloured strip represents one scene.
              By dragging strips into shooting days you build your production calendar.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              On the left you see <strong>groups</strong> (days or locations) and inside each
              group the individual scene strips. The header bar shows live stats: how many
              scenes have been shot, scheduled, or are still unplanned.
            </Typography>
            <Callout color="#7C3AED">
              💡 Think of it as a digital version of the physical pinboard hanging on the wall
              of a traditional production office — but automatically calculated, sortable, and
              exportable to PDF.
            </Callout>
          </>
        ),
        screenshotLabel: 'Stripboard panel – overview',
      },
      {
        heading: 'Quick stats at a glance',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The stats bar below the header shows:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Total scenes', 'all strips in the project'],
                ['Shot', 'scenes already filmed — shown in green when complete'],
                ['Scheduled', 'assigned to a shooting day but not yet shot'],
                ['Unplanned', 'not assigned to any day yet'],
                ['Pages progress bar', 'visual completion bar for script pages shot'],
              ].map(([term, desc]) => (
                <Box key={term} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{term}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Stats bar – scene counts and pages progress',
      },
    ],
  },
  {
    id: 'strips',
    label: 'Reading Strips',
    icon: <BoardViewIcon fontSize="small" />,
    sections: [
      {
        heading: 'Strip colour meaning',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Each strip has a background colour that encodes the scene type following the
              traditional industry colour system:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Yellow', 'Interior day scenes (INT. – DAY)'],
                ['Blue', 'Exterior day scenes (EXT. – DAY)'],
                ['Green', 'Interior night scenes (INT. – NIGHT)'],
                ['Red / Orange', 'Exterior night scenes (EXT. – NIGHT)'],
                ['White', 'Non-dialogue / action sequences'],
                ['Purple / Dark', 'Special effects or VFX-heavy scenes'],
              ].map(([color, meaning]) => (
                <Box key={color} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{color}</strong> — {meaning}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#F59E0B">
              The colour legend is always visible just below the header toolbar. Hover any
              chip in the legend for the full label.
            </Callout>
          </>
        ),
        screenshotLabel: 'Strip colour legend bar',
      },
      {
        heading: 'Strip data fields',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Each strip card displays:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 1 }}>
              {[
                ['Scene number', 'top-left badge'],
                ['Location', 'main label text'],
                ['Cast', 'avatar chips for assigned actors'],
                ['Pages', 'script page estimate (e.g. 2p)'],
                ['Estimated time', 'shoot duration in hours/minutes'],
                ['Status badge', 'not-scheduled / scheduled / shot / postponed'],
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
        screenshotLabel: 'Single strip card with field labels',
      },
    ],
  },
  {
    id: 'day-groups',
    label: 'Day Groups',
    icon: <CalendarIcon fontSize="small" />,
    sections: [
      {
        heading: 'Shooting day groups',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Strips are grouped into <strong>Shooting Days</strong> — purple header rows
              labelled <em>Day 1, Day 2, …</em>. Each day header shows the date, primary
              location, scene count, total pages, and estimated shoot duration.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Click the arrow (<strong>▸ / ▾</strong>) or anywhere on the day header to
              expand or collapse its strips. Use <strong>Expand All / Collapse All</strong>{' '}
              buttons (top-right of the legend bar) to toggle all groups at once.
            </Typography>
            <Callout color="#7C3AED">
              Scenes that have not been assigned to any day appear in the dashed
              <em> "Unplanned"</em> group at the top. When all scenes are planned this
              group shows a celebration message and hides itself.
            </Callout>
          </>
        ),
        screenshotLabel: 'Day group header expanded vs. collapsed',
      },
      {
        heading: 'Call Sheet button',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Each shooting day header has a <strong>Call Sheet</strong> button (visible on
            desktop). Clicking it triggers the <code>onGenerateCallSheet</code> callback so
            your production management system can generate a PDF call sheet for that day
            pre-populated with all cast and location data.
          </Typography>
        ),
        screenshotLabel: 'Call Sheet button on day header',
      },
    ],
  },
  {
    id: 'location-view',
    label: 'Location View',
    icon: <PlaceIcon fontSize="small" />,
    sections: [
      {
        heading: 'Switching to Location view',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the green <strong>📍 Location</strong> icon in the view-mode button
              group (top toolbar) to switch from Day grouping to Location grouping. Every
              unique shooting location becomes a collapsible group with a green header.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Each location header summarises:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 1 }}>
              {[
                'Scene count',
                'Total script pages',
                'Estimated shoot time',
                'INT vs. EXT scene split',
                'Which shooting days visit this location',
                'Full cast list (first 6 names + overflow count)',
              ].map((item) => (
                <Box key={item} component="li" sx={{ mb: 0.4 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#10B981">
              Location view is useful during location scouting and for scheduling
              shoot days to minimise company moves between locations.
            </Callout>
          </>
        ),
        screenshotLabel: 'Location group header with INT/EXT chips and cast list',
      },
      {
        heading: "Bird's-eye overview panel",
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            In Location view an <strong>overview panel</strong> appears at the top of the
            content area showing totals across all locations: unique location count, total
            scenes, unique actors, and combined shoot time.
          </Typography>
        ),
        screenshotLabel: 'Location overview panel',
      },
    ],
  },
  {
    id: 'drag-drop',
    label: 'Drag & Drop',
    icon: <DragIcon fontSize="small" />,
    sections: [
      {
        heading: 'Reordering strips with drag & drop',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              On desktop (tablet and above) you can drag a strip card and drop it onto a
              different <strong>shooting day header area</strong> to reassign the scene to
              that day. The system calls the back-end automatically and the strip updates
              in-place without a page reload.
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, mt: 0 }}>
              {[
                'Click and hold a strip card',
                'Drag it over the target day group',
                'The day group area highlights to indicate it can accept the drop',
                'Release — the strip moves and the day stats recalculate',
              ].map((step, i) => (
                <Box key={i} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#7C3AED">
              Drag & drop is disabled on mobile to avoid conflicts with touch scrolling.
              Use the <strong>Assign to Day</strong> dialog instead (see next section).
            </Callout>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              Keyboard alternative: focus a strip with <Key>Tab</Key>, hold{' '}
              <Key>Space</Key> to pick it up, press <Key>↑</Key> / <Key>↓</Key> to move
              between day groups, then press <Key>Enter</Key> to drop. Press{' '}
              <Key>Escape</Key> to cancel without moving.
            </Typography>
          </>
        ),
        screenshotLabel: 'Drag-and-drop strip being moved between days',
      },
    ],
  },
  {
    id: 'assign',
    label: 'Assign to Day',
    icon: <CalendarIcon fontSize="small" />,
    sections: [
      {
        heading: 'Assign strips to a shooting day',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Select one or more strips (click their checkbox{' '}
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', mx: 0.25 }}>
                <MultiSelectIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }} />
              </Box>
              ), then click the{' '}
              <strong>📅 calendar icon</strong> in the toolbar to open the
              <em> Assign to Day</em> dialog.
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, mt: 0 }}>
              {[
                'Select target strips — a blue badge shows how many are selected',
                'Click the calendar (assign) icon in the toolbar',
                'Choose a shooting day from the dropdown',
                'Select "Remove assignment" to return strips to Unplanned',
                'Click Confirm — all selected strips move at once',
              ].map((step, i) => (
                <Box key={i} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Assign to Day dialog with multi-select in progress',
      },
      {
        heading: 'Adding new strips',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Click the{' '}
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', mx: 0.25 }}>
                <AddIcon sx={{ fontSize: 15, color: '#10B981' }} />
              </Box>
              {' '}<strong>Add</strong> icon in the toolbar to create a new blank
              strip at the top of the Unplanned group. The strip is auto-numbered based on
              the current highest scene number. Edit its location and cast via the scene
              editor.
            </Typography>
            <Callout color="#10B981">
              Deleting strips is permanent. Select the strips and press the red{' '}
              <strong>🗑 Delete</strong> icon. A confirmation dialog is shown.
            </Callout>
          </>
        ),
        screenshotLabel: 'New strip added at top of Unplanned group',
      },
    ],
  },
  {
    id: 'optimization',
    label: 'Schedule Optimisation',
    icon: <OptimizeIcon fontSize="small" />,
    sections: [
      {
        heading: 'Optimisation suggestions',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The stripboard analyses your schedule and flags potential saving
              opportunities. When suggestions are available, an amber{' '}
              <strong>⬆ N tips</strong> chip appears in the header. Click it to slide
              open the <em>Optimisation Panel</em> on the left side of the content area.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Suggestion categories include:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 1 }}>
              {[
                'Location consolidation — group scenes at the same location on the same day',
                'Cast conflicts — actor needed in two places at once',
                'Day length overruns — estimated time exceeds a normal shoot day',
                'Unscheduled high-priority scenes — flagged as important but unplanned',
              ].map((tip) => (
                <Box key={tip} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    {tip}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Optimisation panel open with suggestion cards',
      },
      {
        heading: 'Optimisation dialog',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            On mobile, the optimisation panel is replaced by a full-screen dialog accessible
            from the <strong>☰ mobile menu → Optimisation suggestions</strong>. The dialog
            lists the same suggestions with one-tap actions like "Move scene to Day 3".
          </Typography>
        ),
        screenshotLabel: 'Optimisation dialog on mobile',
      },
    ],
  },
  {
    id: 'filters',
    label: 'Filters & Sort',
    icon: <FilterIcon fontSize="small" />,
    sections: [
      {
        heading: 'Filtering scenes',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The toolbar contains three filter controls:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Status filter', 'All / Not scheduled / Scheduled / Shot / Postponed'],
                ['Location filter', 'dropdown of all unique locations in the project'],
                ['Search box', 'free-text search on scene number and location name'],
              ].map(([label, desc]) => (
                <Box key={label} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#3b82f6">
              Filters stack: you can filter by status AND location AND a search term
              simultaneously. The strip count in each day header updates live to show only
              matching strips.
            </Callout>
          </>
        ),
        screenshotLabel: 'Filter controls with status and location dropdowns',
      },
      {
        heading: 'Group by & sort direction',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The <strong>Group By</strong> selector reorganises strips within each day:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {['Day (default)', 'Location', 'Cast', 'Status', 'INT/EXT'].map((g) => (
                <Box key={g} component="li" sx={{ mb: 0.3 }}>
                  <Typography variant="body2">{g}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1 }}>
              The <strong>↕ sort button</strong> toggles ascending / descending order within
              the selected grouping.
            </Typography>
          </>
        ),
        screenshotLabel: 'Group By selector and sort direction toggle',
      },
    ],
  },
  {
    id: 'export',
    label: 'Export & Print',
    icon: <PrintIcon fontSize="small" />,
    sections: [
      {
        heading: 'Exporting the stripboard',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Three export formats are available from the toolbar{' '}
              (<Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', mx: 0.25 }}>
                <ExportIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }} />
              </Box>):
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['JSON export (⬇)', 'Full data dump — can be re-imported to restore the schedule'],
                ['CSV export', 'Spreadsheet-friendly table of all strips and their day assignments'],
                ['Print / PDF (🖨)', 'Opens the Print Options dialog to configure which sections to include'],
              ].map(([label, desc]) => (
                <Box key={label} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Export and Print toolbar buttons',
      },
      {
        heading: 'Print options dialog',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The Print Options dialog lets you toggle individual sections:
            </Typography>
            <Paper
              elevation={0}
              sx={{
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 1.5,
                px: 2,
                py: 1,
                mt: 1,
              }}
            >
              <Box component="ul" sx={{ pl: 1.5, mt: 0, mb: 0 }}>
                {[
                  'Header (project title + logo)',
                  'Stats bar',
                  'Colour legend',
                  'Unplanned scenes section',
                  'Scheduled days section',
                  'Cast information',
                  'Notes',
                  'Page numbers',
                ].map((opt) => (
                  <Box key={opt} component="li" sx={{ mb: 0.3 }}>
                    <Typography variant="body2">{opt}</Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
            <Callout color="#7C3AED">
              The printed page includes a branded footer with the project title and
              generation date. The @media print CSS is baked into the component so any
              browser print function works correctly.
            </Callout>
          </>
        ),
        screenshotLabel: 'Print Options dialog with section toggles',
      },
      {
        heading: 'Importing JSON',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Click the <strong>⬆ Upload</strong> icon to import a previously exported JSON
            file. This replaces the current schedule with the imported data. Useful for
            sharing schedules between team members or restoring a saved state.
          </Typography>
        ),
        screenshotLabel: 'JSON import file picker',
      },
    ],
  },
  {
    id: 'compact-view',
    label: 'Compact & Mobile',
    icon: <TipIcon fontSize="small" />,
    sections: [
      {
        heading: 'Compact view',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>⊡ Compact</strong> toggle (amber when active) to switch
              between full and compact strip cards. In compact mode each strip takes
              roughly half the vertical space — useful when reviewing a large schedule at
              a glance.
            </Typography>
            <Callout color="#F59E0B">
              The compact icon turns amber to remind you that
              you are in compact mode. Click it again to return to full view.
            </Callout>
          </>
        ),
        screenshotLabel: 'Full vs. compact strip card comparison',
      },
      {
        heading: 'Mobile & responsive layout',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The stripboard adapts across 7 screen tiers (xs → 4K). On mobile:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                'Toolbar actions collapse into a ⋮ kebab menu',
                'Drag-and-drop is replaced by the Assign dialog',
                'Day headers show abbreviated information',
                'The optimisation panel opens as a full-screen dialog',
                'INT/EXT counts are hidden to save space',
              ].map((item) => (
                <Box key={item} component="li" sx={{ mb: 0.4 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
          </>
        ),
        screenshotLabel: 'Stripboard on mobile with kebab menu open',
      },
    ],
  },
];

// ─── Component ─────────────────────────────────────────────────────────────────

interface StripboardGuideProps {
  open: boolean;
  onClose: () => void;
  initialStepId?: string;
}

export const StripboardGuide: React.FC<StripboardGuideProps> = ({
  open,
  onClose,
  initialStepId,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig  = getGuideConfig('stripboard');
  const activeIds    = getActiveStepIds('stripboard');
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map(id => STEPS.find(s => s.id === id)).filter(Boolean) as Step[])
    : STEPS;

  const initialIndex = initialStepId
    ? Math.max(0, visibleSteps.findIndex((s) => s.id === initialStepId))
    : 0;

  const [activeStep, setActiveStep] = useState(initialIndex);
  const contentRef = useRef<HTMLDivElement>(null);

  const step = visibleSteps[activeStep] ?? visibleSteps[0];
  const stepOverride = getStepOverride('stripboard', step?.id ?? '');

  const scrollToTop = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, []);

  const handleStepClick = useCallback(
    (index: number) => {
      setActiveStep(index);
      scrollToTop();
    },
    [scrollToTop],
  );

  const handlePrev = useCallback(() => {
    setActiveStep((prev) => {
      const next = Math.max(0, prev - 1);
      scrollToTop();
      return next;
    });
  }, [scrollToTop]);

  const handleNext = useCallback(() => {
    setActiveStep((prev) => {
      const next = Math.min(visibleSteps.length - 1, prev + 1);
      scrollToTop();
      return next;
    });
  }, [scrollToTop, visibleSteps.length]);

  const isFirst = activeStep === 0;
  const isLast  = activeStep === visibleSteps.length - 1;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: '#12121e',
          color: 'text.primary',
        },
      }}
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
          <TheatersIcon sx={{ color: '#7C3AED' }} />
          <Typography variant="h6" fontWeight={700}>
            Stripboard Guide
          </Typography>
          <Chip
            label={`${activeStep + 1} / ${visibleSteps.length}`}
            size="small"
            sx={{ ml: 1, bgcolor: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}
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
        <Box sx={{ px: 2.5, py: 1, bgcolor: `${guideConfig.introBannerColor ?? '#7C3AED'}20`, borderBottom: `1px solid ${guideConfig.introBannerColor ?? '#7C3AED'}40` }}>
          <Typography variant="body2" sx={{ color: guideConfig.introBannerColor ?? '#a78bfa' }}>
            {guideConfig.introBanner}
          </Typography>
        </Box>
      )}

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <DialogContent
        sx={{ p: 0, display: 'flex', overflow: 'hidden', flex: 1 }}
      >
        {/* Left nav — hidden on mobile */}
        {!isMobile && (
          <Box
            sx={{
              width: 200,
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
              sx={{
                px: 2,
                pt: 2,
                pb: 0.5,
                fontSize: '0.65rem',
                color: 'text.disabled',
                letterSpacing: '0.1em',
              }}
            >
              Sections
            </Typography>
            <List dense disablePadding>
              {visibleSteps.map((s, idx) => {
                const ov = getStepOverride('stripboard', s.id);
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
                        bgcolor: 'rgba(124,58,237,0.15)',
                        '&:hover': { bgcolor: 'rgba(124,58,237,0.2)' },
                      },
                    }}
                  >
                    <Box sx={{ color: idx === activeStep ? '#a78bfa' : 'text.secondary', display: 'flex' }}>
                      {s.icon}
                    </Box>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                          <span>{ov.labelOverride ?? s.label}</span>
                          {ov.badge && (
                            <Chip label={ov.badge} size="small" sx={{ height: 16, fontSize: '0.6rem', bgcolor: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }} />
                          )}
                        </Box>
                      }
                      primaryTypographyProps={{
                        fontSize: '0.8rem',
                        fontWeight: idx === activeStep ? 600 : 400,
                        color: idx === activeStep ? '#e2d9f3' : 'text.secondary',
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
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2, sm: 4 },
            py: 3,
          }}
        >
          {/* Mobile step chips */}
          {isMobile && (
            <Box
              sx={{
                display: 'flex',
                gap: 0.75,
                flexWrap: 'wrap',
                mb: 2.5,
              }}
            >
              {visibleSteps.map((s, idx) => {
                const ov = getStepOverride('stripboard', s.id);
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
                bgcolor: 'rgba(124,58,237,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a78bfa',
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
                sx={{ mb: 1.5, color: guideConfig.accentColorOverride ?? '#a78bfa' }}
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
          {stepOverride.adminNote && (
            <Box sx={{ mt: 3, p: 2, borderRadius: 2, border: `1px solid ${stepOverride.adminNoteColor ?? '#7C3AED'}40`, bgcolor: `${stepOverride.adminNoteColor ?? '#7C3AED'}15` }}>
              <Typography variant="caption" sx={{ color: stepOverride.adminNoteColor ?? '#a78bfa', fontWeight: 600, display: 'block', mb: 0.5 }}>
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
        {/* Step dots */}
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
                  ? '#7C3AED'
                  : idx < activeStep
                  ? 'rgba(124,58,237,0.4)'
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
          sx={{ minWidth: 80, borderColor: 'rgba(255,255,255,0.12)' }}
        >
          ← Prev
        </Button>

        {isLast ? (
          <Button
            variant="contained"
            size="small"
            onClick={onClose}
            startIcon={<DoneIcon />}
            sx={{ minWidth: 90, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6d28d9' } }}
          >
            Done
          </Button>
        ) : (
          <Button
            variant="contained"
            size="small"
            onClick={handleNext}
            sx={{ minWidth: 80, bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6d28d9' } }}
          >
            Next →
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default StripboardGuide;
