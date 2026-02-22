/**
 * AuditionGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Audition Schedule Panel.
 *
 * Covers all features:
 *   – Overview & panel layout
 *   – Creating audition slots (candidate, role, date, time, location, notes)
 *   – Grid / Table / Compact view modes
 *   – 6-status system (scheduled, confirmed, awaiting callback, completed, cancelled, pool)
 *   – Filtering & search (status, date, candidate, role, location, today-only, favorites)
 *   – Favourites — bookmark auditions, sort to top, tracked in statistics
 *   – Details Drawer — click any card to update status and add notes
 *   – Bulk actions — multi-select, bulk delete, bulk status change
 *   – Audition Pool — save templates, reuse across projects
 *   – Export CSV & keyboard shortcuts
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  CheckCircleOutline as DoneIcon,
  HelpOutline as HelpIcon,
  InterpreterMode as OverviewIcon,
  AddCircleOutline as CreateIcon,
  GridView as GridIcon,
  RadioButtonChecked as StatusIcon,
  FilterList as FilterIcon,
  StarBorder as FavIcon,
  LibraryAddCheck as BulkIcon,
  Bookmarks as PoolIcon,
  FileDownload as ExportIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';

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

// ─── Callout Box ──────────────────────────────────────────────────────────────

function Callout({
  color = '#ffb800',
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

// ─── Audition Status Pill ─────────────────────────────────────────────────────

const STATUS_PILLS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:         { label: 'Scheduled',         color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  confirmed:         { label: 'Confirmed',         color: '#3b82f6', bg: 'rgba(59,130,246,0.15)'  },
  awaiting_callback: { label: 'Awaiting Callback', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)'  },
  completed:         { label: 'Completed',         color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  cancelled:         { label: 'Cancelled',         color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
  pool:              { label: 'Unscheduled (Pool)', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)'  },
};

function StatusPill({ status }: { status: string }) {
  const p = STATUS_PILLS[status] ?? STATUS_PILLS['scheduled'];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 0.75,
        py: 0.125,
        borderRadius: '4px',
        bgcolor: p.bg,
        color: p.color,
        border: `1px solid ${p.color}55`,
        fontSize: '0.7rem',
        fontWeight: 700,
        mx: 0.25,
      }}
    >
      {p.label}
    </Box>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const ACCENT = '#ffb800';

const STEPS: Step[] = [
  // ── 1. Overview ──────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: <OverviewIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is the Audition Planner?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The Audition Planner is your central workspace for scheduling, tracking, and
              managing every audition in a casting project. It connects candidates, roles,
              dates, locations, and notes into a single live view — with real-time filters,
              keyboard shortcuts, and a built-in pool for reusable templates.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The panel breaks into two main modes you can toggle at the top:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Project view</strong> — shows audition
                  slots you have scheduled for the current project.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Pool view</strong> — shows reusable
                  audition templates saved from any project, ready to import.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Before creating your first audition slot you need at least one{' '}
              <strong>Candidate</strong> and one <strong>Role</strong> in the project —
              use the Candidates and Roles tabs to add them first.
            </Callout>
          </>
        ),
        screenshotLabel: 'Audition Planner — full panel overview',
      },
      {
        heading: 'Panel header at a glance',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The header bar always shows the live count of scheduled auditions and quick
              access to the three primary actions:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 0 }}>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2">
                  <strong>Export</strong> — download a CSV of the filtered visible list
                  (<Key>Ctrl</Key>+<Key>E</Key>).
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2">
                  <strong>Statistics</strong> — toggle a summary card showing totals by status.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong>+ New Schedule</strong> — open the create form (<Key>F</Key> or{' '}
                  <Key>N</Key> keyboard shortcuts).
                </Typography>
              </Box>
            </Box>
          </>
        ),
        screenshotLabel: 'Header bar with Export / Statistics / New Schedule buttons',
      },
    ],
  },

  // ── 2. Creating Audition Slots ────────────────────────────────────────────
  {
    id: 'creating-slots',
    label: 'Creating Slots',
    icon: <CreateIcon fontSize="small" />,
    sections: [
      {
        heading: 'Creating a new audition slot',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click <strong>+ New Schedule</strong> or press <Key>F</Key> / <Key>N</Key> to open the
              creation form. Fill in:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                ['Candidate', 'The person being auditioned — drawn from the Candidates list.'],
                ['Role', 'The role they are auditioning for — drawn from the Roles list.'],
                ['Date', 'Calendar date of the audition.'],
                ['Time', 'Start time of the slot.'],
                ['Location', 'Room, studio, or address where the audition takes place.'],
                ['Notes', 'Free-text notes visible in the Details Drawer.'],
              ].map(([field, desc]) => (
                <Box component="li" key={field} sx={{ mb: 0.75 }}>
                  <Typography variant="body2">
                    <strong style={{ color: ACCENT }}>{field}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              A new slot starts with status <StatusPill status="scheduled" /> and immediately
              appears in the list. You can change the status at any time from the Details Drawer.
            </Callout>
          </>
        ),
        screenshotLabel: 'Create audition slot form — all fields visible',
      },
      {
        heading: 'Editing an existing slot',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Click the <strong>Edit</strong> (pencil) icon on any card or row to reopen the same
            form with the existing data pre-filled. Changes are saved immediately.
          </Typography>
        ),
        screenshotLabel: 'Edit form open on existing audition slot',
      },
    ],
  },

  // ── 3. View Modes ─────────────────────────────────────────────────────────
  {
    id: 'view-modes',
    label: 'View Modes',
    icon: <GridIcon fontSize="small" />,
    sections: [
      {
        heading: 'Three ways to view your schedule',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Use the view-mode icons in the toolbar (above the filter chips) to switch between:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { name: 'Grid', icon: '⊞', desc: 'Cards in a responsive 2–4 column grid. Best for a visual overview at a glance.' },
                { name: 'Table', icon: '≡', desc: 'Sortable columns (candidate, role, date, time, location, status). Best for bulk comparison and sorting.' },
                { name: 'Compact', icon: '☰', desc: 'Dense single-line rows. Best when you have many auditions and want maximum density.' },
              ].map(m => (
                <Box key={m.name} sx={{ display: 'flex', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <Typography sx={{ fontSize: '1.1rem', lineHeight: 1, mt: 0.25, minWidth: 20 }}>{m.icon}</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: ACCENT }}>{m.name}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{m.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
            <Callout>
              In <strong>Table view</strong> click any column header to sort ascending/descending.
              The sort state persists as you change filters.
            </Callout>
          </>
        ),
        screenshotLabel: 'Grid / Table / Compact view mode switcher and example of each',
      },
    ],
  },

  // ── 4. Status Tracking ────────────────────────────────────────────────────
  {
    id: 'status-tracking',
    label: 'Status Tracking',
    icon: <StatusIcon fontSize="small" />,
    sections: [
      {
        heading: 'Six-status workflow',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Every audition slot carries one of six statuses, colour-coded throughout the panel:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {(Object.entries(STATUS_PILLS) as [string, { label: string; color: string; bg: string }][]).map(([key, _pill]) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, '&:last-child': { mb: 0 } }}>
                  <StatusPill status={key} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                    {key === 'scheduled'         && 'Default state — the slot is planned but not yet confirmed.'}
                    {key === 'confirmed'          && 'The candidate has accepted and the time is locked in.'}
                    {key === 'awaiting_callback'  && 'Audition complete — waiting for the candidate to follow up.'}
                    {key === 'completed'          && 'Audition done and notes/feedback filed.'}
                    {key === 'cancelled'          && 'The slot was cancelled (still visible for reporting).'}
                    {key === 'pool'               && 'Saved to the pool as a template — not yet scheduled.'}
                  </Typography>
                </Box>
              ))}
            </Paper>
            <Callout>
              Change a status from the <strong>Details Drawer</strong> (click any card) — or
              change many at once using <strong>Bulk Status Change</strong> (see Bulk Actions step).
            </Callout>
          </>
        ),
        screenshotLabel: 'Status filter chips showing all six statuses with colours',
      },
      {
        heading: 'Statistics banner',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Click <strong>Statistics</strong> in the header to reveal a summary row with live
              counts broken down by status:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
              {[
                { label: 'Total', color: '#ffb800' },
                { label: 'Upcoming', color: '#00d4ff' },
                { label: 'Scheduled', color: '#94a3b8' },
                { label: 'Completed', color: '#10b981' },
                { label: 'Cancelled', color: '#ef4444' },
                { label: 'Favourites', color: '#ffc107' },
              ].map(s => (
                <Chip
                  key={s.label}
                  label={s.label}
                  size="small"
                  sx={{ bgcolor: `${s.color}18`, color: s.color, border: `1px solid ${s.color}44`, fontWeight: 600, fontSize: '0.72rem' }}
                />
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, color: 'text.secondary' }}>
              Counts always reflect the <em>active filters</em> — so you can focus on today's
              sessions and see exactly how many are confirmed vs. still pending.
            </Typography>
          </>
        ),
        screenshotLabel: 'Statistics banner showing status counts',
      },
    ],
  },

  // ── 5. Filtering & Search ─────────────────────────────────────────────────
  {
    id: 'filters',
    label: 'Filtering',
    icon: <FilterIcon fontSize="small" />,
    sections: [
      {
        heading: 'Search bar',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The search bar matches across <strong>candidate name</strong>,{' '}
              <strong>role name</strong>, <strong>location</strong>, and <strong>notes</strong>{' '}
              simultaneously. Results update live as you type.
            </Typography>
            <Callout>
              Press <Key>Esc</Key> to clear the search, or click the × icon inside the field.
              Active search terms appear as removable chips below the toolbar.
            </Callout>
          </>
        ),
        screenshotLabel: 'Search bar with active query and chip badge below toolbar',
      },
      {
        heading: 'Status, date & dropdown filters',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Below the toolbar a row of filter controls lets you narrow down the list:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                ['Status chips', 'Click any status chip (Scheduled / Confirmed / Awaiting Callback / Completed / Cancelled) to show only that status.'],
                ['📅 Today only', "Toggle to show only auditions scheduled for today's date."],
                ['⭐ Favourites only', 'Toggle to show only bookmarked auditions.'],
                ['Date picker', 'Filter to a specific calendar date.'],
                ['Candidate dropdown', 'Show only auditions for a specific candidate.'],
                ['Role dropdown', 'Show only auditions for a specific role.'],
                ['Location dropdown', 'Show only auditions at a specific location.'],
              ].map(([name, desc]) => (
                <Box component="li" key={name} sx={{ mb: 0.75 }}>
                  <Typography variant="body2">
                    <strong style={{ color: ACCENT }}>{name}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              When any filter is active a <strong>Clear all filters</strong> button appears — click
              it to reset everything at once.
            </Callout>
          </>
        ),
        screenshotLabel: 'Filter row — status chips, today toggle, favourites toggle, dropdowns',
      },
      {
        heading: 'Active filter chips',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            Every active filter renders as a removable chip directly below the filter bar. Click the{' '}
            <strong>✕</strong> on any chip to remove just that filter without clearing the others.
            This makes it easy to drill down with multiple filters and peel them back one at a time.
          </Typography>
        ),
        screenshotLabel: 'Active filter chips visible — search term, date, role selected',
      },
    ],
  },

  // ── 6. Favourites ─────────────────────────────────────────────────────────
  {
    id: 'favourites',
    label: 'Favourites',
    icon: <FavIcon fontSize="small" />,
    sections: [
      {
        heading: 'Bookmarking auditions',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Every audition card and table row has a <strong>⭐ star icon</strong>. Click it to
              toggle the favourite state. Favourites are:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Sorted to the top</strong> of any list — they always appear before
                  unfavourited slots regardless of other sort settings.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Counted</strong> in the Statistics banner as a separate total.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong>Filterable</strong> — use the ⭐ Favourites Only toggle to see just
                  your bookmarked auditions.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong>Persisted per user</strong> to the server when you are signed in, so
                  they survive page refreshes and device switches.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Use favourites to flag the most important auditions in a busy day — for example
              top callbacks or time-sensitive slots — so they always stay visible at the top.
            </Callout>
          </>
        ),
        screenshotLabel: 'Card with star icon highlighted and favourites visible at top of list',
      },
    ],
  },

  // ── 7. Details Drawer ─────────────────────────────────────────────────────
  {
    id: 'details-drawer',
    label: 'Details Drawer',
    icon: <HelpIcon fontSize="small" />,
    sections: [
      {
        heading: 'Viewing and updating audition details',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click any audition card or row to open the <strong>Details Drawer</strong> — a
              slide-in panel on the right side of the screen. The drawer shows the full slot
              information and lets you:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Change the status with a single click (picks from the 6-status list).',
                'Read and edit the notes field for this audition.',
                'See the candidate name, role, date, time, and location at a glance.',
                'Navigate to the next/previous slot without closing the drawer.',
              ].map(item => (
                <Box component="li" key={item} sx={{ mb: 0.75 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              You can also open the drawer with the keyboard: press <Key>↑</Key> / <Key>↓</Key>{' '}
              to navigate rows and <Key>Enter</Key> to open the drawer for the focused row.
            </Callout>
          </>
        ),
        screenshotLabel: 'Details Drawer open with status selector and notes field',
      },
    ],
  },

  // ── 8. Bulk Actions ───────────────────────────────────────────────────────
  {
    id: 'bulk-actions',
    label: 'Bulk Actions',
    icon: <BulkIcon fontSize="small" />,
    sections: [
      {
        heading: 'Selecting multiple auditions',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Each card and table row has a checkbox. Check one to enter multi-select mode; a
              floating action bar appears at the bottom of the panel showing how many items are
              selected and the available bulk operations:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: '#ef4444' }}>Bulk Delete</strong> — permanently removes
                  all selected slots after a confirmation prompt. A brief undo window is shown
                  immediately after deletion.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Bulk Status Change</strong> — sets all selected
                  slots to the same new status in one operation. Useful for confirming a batch of
                  callbacks or marking a day's worth of auditions as completed.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Press <Key>Ctrl</Key>+<Key>D</Key> to delete the currently focused row directly —
              no need to check a checkbox first.
            </Callout>
          </>
        ),
        screenshotLabel: 'Floating bulk action bar with two items selected',
      },
      {
        heading: 'Undo delete',
        body: (
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            After any deletion a <strong>snackbar notification</strong> appears at the bottom of
            the screen with an <strong>Undo</strong> button. Click it within a few seconds to
            restore the deleted slot(s). Once the snackbar disappears the deletion is permanent.
          </Typography>
        ),
        screenshotLabel: 'Undo delete snackbar at bottom of screen',
      },
    ],
  },

  // ── 9. Audition Pool ──────────────────────────────────────────────────────
  {
    id: 'audition-pool',
    label: 'Audition Pool',
    icon: <PoolIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is the Audition Pool?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The Audition Pool is a cross-project library of audition templates. Instead of
              recreating the same slot from scratch for every project, you can:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              <Box component="li" sx={{ mb: 0.75 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Save to pool</strong> — on any existing
                  audition slot, click the <strong>Save to Pool</strong> action (from the row
                  context menu or the Details Drawer). The slot becomes a reusable template
                  in the pool.
                </Typography>
              </Box>
              <Box component="li" sx={{ mb: 0 }}>
                <Typography variant="body2">
                  <strong style={{ color: ACCENT }}>Import from pool</strong> — switch to
                  <strong> Pool view</strong> (toggle at the top of the panel). Browse the
                  templates, click <strong>Import</strong> on any card, pick the target project
                  and confirm. A new scheduled slot is created in that project instantly.
                </Typography>
              </Box>
            </Box>
            <Callout>
              Pool templates retain the original candidate, role, location, and notes so you only
              need to update the date and time after importing.
            </Callout>
          </>
        ),
        screenshotLabel: 'Pool view showing template cards with Import button',
      },
      {
        heading: 'Managing pool templates',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              In Pool view each template card shows:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1 }}>
              {[
                'Title — role name from the original slot.',
                'Time and location from when it was saved.',
                'A delete button to remove the template from the pool permanently.',
                'An import button to copy it into any project.',
              ].map(item => (
                <Box component="li" key={item} sx={{ mb: 0.5 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Use the search field in Pool view to filter templates by title.
            </Typography>
          </>
        ),
        screenshotLabel: 'Pool template card close-up — title, time, location, delete, import',
      },
    ],
  },

  // ── 10. Export & Keyboard Shortcuts ──────────────────────────────────────
  {
    id: 'export-shortcuts',
    label: 'Export & Shortcuts',
    icon: <ExportIcon fontSize="small" />,
    sections: [
      {
        heading: 'Export to CSV',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click <strong>Export</strong> (or press <Key>Ctrl</Key>+<Key>E</Key>) to download a
              CSV file of the <em>currently filtered</em> audition list. The export includes:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Candidate name',
                'Role name',
                'Date and time',
                'Location',
                'Status',
                'Notes',
              ].map(col => (
                <Box component="li" key={col} sx={{ mb: 0.5 }}>
                  <Typography variant="body2">{col}</Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              Apply filters <em>before</em> exporting to create targeted reports — for example
              export only today's confirmed auditions for a quick callsheet.
            </Callout>
          </>
        ),
        screenshotLabel: 'Download CSV button and resulting spreadsheet',
      },
      {
        heading: 'Keyboard shortcuts',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The panel is fully keyboard-navigable. All shortcuts are disabled while you are
              typing in an input field:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { keys: ['F', 'or', 'N'], desc: 'Open "New Schedule" form.' },
                { keys: ['Ctrl', '+', 'E'], desc: 'Export the filtered list to CSV.' },
                { keys: ['Ctrl', '+', 'D'], desc: 'Delete the currently focused row.' },
                { keys: ['↑', '↓'], desc: 'Move focus between rows.' },
                { keys: ['Enter'], desc: 'Open the Details Drawer for the focused row.' },
                { keys: ['Esc'], desc: 'Clear the search field.' },
              ].map(row => (
                <Box key={row.desc} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <Box sx={{ display: 'flex', gap: 0.5, minWidth: 120, flexWrap: 'wrap' }}>
                    {row.keys.map((k) =>
                      k === 'or' || k === '+' ? (
                        <Typography key={k} variant="body2" sx={{ color: 'text.secondary', mx: 0.25 }}>{k}</Typography>
                      ) : (
                        <Key key={k}>{k}</Key>
                      )
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                    {row.desc}
                  </Typography>
                </Box>
              ))}
            </Paper>
          </>
        ),
        screenshotLabel: 'Keyboard shortcut reference overlay',
      },
    ],
  },
];

// ─── Guide IDs ────────────────────────────────────────────────────────────────

const GUIDE_ID = 'audition' as const;

// ─── Main Component ───────────────────────────────────────────────────────────

interface AuditionGuideProps {
  open: boolean;
  onClose: () => void;
}

export function AuditionGuide({ open, onClose }: AuditionGuideProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Visual editor overrides (admin-only feature)
  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig = getGuideConfig(GUIDE_ID);
  const activeStepIds = getActiveStepIds(GUIDE_ID);

  // Resolve which steps are active (admin may hide some)
  const visibleSteps: Step[] = STEPS.filter(s =>
    activeStepIds === null || activeStepIds.includes(s.id)
  ).map(s => {
    const override = getStepOverride(GUIDE_ID, s.id);
    if (!override) return s;
    return { ...s, label: override.label ?? s.label };
  });

  const currentStep = visibleSteps[activeStepIndex] ?? visibleSteps[0];
  const stepOverride = getStepOverride(GUIDE_ID, currentStep?.id ?? '');

  const goTo = useCallback((index: number) => {
    setActiveStepIndex(Math.max(0, Math.min(index, visibleSteps.length - 1)));
    // Scroll content back to top when switching steps
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [visibleSteps.length]);

  const handlePrev = () => goTo(activeStepIndex - 1);
  const handleNext = () => goTo(activeStepIndex + 1);
  const handleDone = () => {
    onClose();
    setActiveStepIndex(0);
  };

  const isFirst = activeStepIndex === 0;
  const isLast  = activeStepIndex === visibleSteps.length - 1;

  const ACCENT_COLOR = guideConfig?.accentColor ?? ACCENT;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      aria-labelledby="audition-guide-title"
      PaperProps={{
        sx: {
          bgcolor: '#0f0f0f',
          backgroundImage: 'none',
        },
      }}
    >
      {/* ── Title bar ── */}
      <DialogTitle
        id="audition-guide-title"
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
            {guideConfig?.title ?? 'Audition Planner — Guide'}
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
        <DialogContent
          ref={contentRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2.5, sm: 4 },
            py: 3,
          }}
        >
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
                  <Typography
                    variant="h5"
                    sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2, fontSize: '1.2rem' }}
                  >
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
                    sx={{
                      fontWeight: 700,
                      color: ACCENT_COLOR,
                      mb: 1.25,
                      fontSize: '0.95rem',
                    }}
                  >
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
                  {si < currentStep.sections.length - 1 && (
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mt: 2 }} />
                  )}
                </Box>
              ))}


              {/* Admin note from Guide Editor */}
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
          sx={{
            borderColor: 'rgba(255,255,255,0.2)',
            color: '#fff',
            '&:disabled': { opacity: 0.3 },
          }}
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
            sx={{ bgcolor: ACCENT_COLOR, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#e6a600' } }}
          >
            Done ✓
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{ bgcolor: ACCENT_COLOR, color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#e6a600' } }}
          >
            Next →
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default AuditionGuide;
