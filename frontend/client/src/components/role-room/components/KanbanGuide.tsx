/**
 * KanbanGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Kanban Board.
 *
 * Covers:
 *   – Overview & board layout
 *   – Columns & candidate statuses (pending → shortlist → selected → confirmed → rejected)
 *   – Adding candidates (per-column + toolbar button)
 *   – Drag & drop to move candidates between columns
 *   – Search & role filter
 *   – Bulk selection & bulk actions (move status, delete)
 *   – Role-based access (casting director vs director vs talent etc.)
 *   – Assign Audition Event from a card
 *   – Realtime collaboration indicator
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
  ViewKanban as OverviewIcon,
  TableChart as ColumnsIcon,
  PersonAdd as AddCandidateIcon,
  DragIndicator as DragIcon,
  Search as SearchIcon,
  CheckBox as BulkIcon,
  ManageAccounts as RoleAccessIcon,
  Event as EventIcon,
  Wifi as RealtimeIcon,
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
  color = '#84cc16',
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

// ─── Status Pill ─────────────────────────────────────────────────────────────

const KANBAN_STATUSES: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  shortlist: { label: 'Shortlist', color: '#ffb800', bg: 'rgba(255,184,0,0.15)'   },
  selected:  { label: 'Selected',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)'  },
  confirmed: { label: 'Confirmed', color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
  rejected:  { label: 'Rejected',  color: '#ef4444', bg: 'rgba(239,68,68,0.15)'   },
};

function StatusPill({ status }: { status: string }) {
  const p = KANBAN_STATUSES[status] ?? KANBAN_STATUSES['pending'];
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
        color: '#84cc16',
        borderColor: 'rgba(132,204,22,0.4)',
        bgcolor: 'rgba(132,204,22,0.06)',
        '&:hover': {
          borderColor: '#84cc16',
          bgcolor: 'rgba(132,204,22,0.14)',
        },
      }}
    >
      {label}
    </Button>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const ACCENT = '#84cc16';

function buildSteps(onAction?: (action: string) => void): Step[] {
  return [
  // ── 1. Overview ──────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: <OverviewIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is the Kanban board?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The Kanban board is a visual pipeline for tracking every candidate through
              the casting process. Each candidate appears as a card, and each column
              represents a stage in the pipeline. Moving a card to a new column
              instantly updates the candidate's status.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The board is embedded directly in the Dashboard and is also accessible
              from the Casting Planner. It updates in real-time — when a team member
              makes a change you will see it appear without refreshing.
            </Typography>
            <Callout>
              The board automatically adapts to your <strong>role</strong>. A Casting
              Director sees all columns and full controls. A Director sees only review
              columns. A Talent sees only their own progress. Open the
              <strong> Role-Based Access</strong> step in this guide to learn more.
            </Callout>
          </>
        ),
        screenshotLabel: 'Kanban board — full panel with all five columns',
      },
      {
        heading: 'Toolbar at a glance',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The compact toolbar above the board contains:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 0 }}>
              {[
                '<strong>Kanban</strong> title + role badge chip — shows your active role with matching colour from the login screen.',
                '<strong>Realtime dot</strong> — green when WebSocket is connected, grey when offline.',
                '<strong>Refresh</strong> button — manually reload all candidate data.',
                '<strong>+ Add Candidate</strong> button (casting directors & producers only).',
                '<strong>Search field</strong> — filter cards by candidate name.',
                '<strong>Role dropdown</strong> — show candidates for a single role only.',
                '<strong>+ New Roles</strong> link — jump to the Roles tab.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.6 }}>
                  <Typography variant="body2" dangerouslySetInnerHTML={{ __html: item }} />
                </Box>
              ))}
            </Box>
            <CtaButton label="Åpne Kanban-tavle" action="open-kanban-board" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Kanban toolbar — all controls labelled',
      },
    ],
  },

  // ── 2. Columns & Statuses ─────────────────────────────────────────────────
  {
    id: 'columns',
    label: 'Columns & Statuses',
    icon: <ColumnsIcon fontSize="small" />,
    sections: [
      {
        heading: 'Five pipeline stages',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The board has five columns from left to right, representing progression
              through the casting pipeline:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {(Object.entries(KANBAN_STATUSES) as [string, { label: string; color: string; bg: string }][]).map(([key]) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <StatusPill status={key} />
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                    {key === 'pending'   && 'New / unreviewed candidate — no action taken yet.'}
                    {key === 'shortlist' && 'Promising candidate — added to the shortlist for closer consideration.'}
                    {key === 'selected'  && 'Team has selected this candidate — awaiting final confirmation.'}
                    {key === 'confirmed' && 'Candidate is confirmed and cast in the role.'}
                    {key === 'rejected'  && 'Not selected for this project. Card stays visible for reference.'}
                  </Typography>
                </Box>
              ))}
            </Paper>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Each column header shows:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 0 }}>
              {[
                'The large column count (total candidates in that status).',
                'The column label in <em>label(n)</em> format next to the count.',
                'A colour-coded left border matching the status colour.',
                'A "Load more" link at the bottom when more than 10 cards exist.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.6 }}>
                  <Typography variant="body2" dangerouslySetInnerHTML={{ __html: item }} />
                </Box>
              ))}
            </Box>
            <CtaButton label="Se statuskolonner" action="view-columns" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Column headers — big count, label(n) format, colour borders',
      },
    ],
  },

  // ── 3. Adding Candidates ──────────────────────────────────────────────────
  {
    id: 'adding-candidates',
    label: 'Adding Candidates',
    icon: <AddCandidateIcon fontSize="small" />,
    sections: [
      {
        heading: 'Add directly from the board',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Casting directors, producers, and admins can add candidates without leaving
              the board. There are three entry points:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                '<strong>Toolbar "+ Add Candidate" button</strong> — creates a candidate and adds it to Pending by default.',
                '<strong>Top "+ Add Candidate" inside a column</strong> — creates the candidate directly in that column\'s status.',
                '<strong>Bottom "+ Add Candidate" inside a column</strong> — same as above, useful when the column is scrolled down far.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.75 }}>
                  <Typography variant="body2" dangerouslySetInnerHTML={{ __html: item }} />
                </Box>
              ))}
            </Box>
            <Callout color="#10b981">
              If your role does not have add permission (e.g., Director, Client), the
              Add Candidate buttons are hidden. Contact the Casting Director or Producer
              to add candidates.
            </Callout>
            <CtaButton label="Legg til kandidat" action="add-candidate" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Column with top and bottom Add Candidate buttons visible',
      },
    ],
  },

  // ── 4. Drag & Drop ────────────────────────────────────────────────────────
  {
    id: 'drag-drop',
    label: 'Drag & Drop',
    icon: <DragIcon fontSize="small" />,
    sections: [
      {
        heading: 'Move candidates by dragging',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Drag any candidate card horizontally to a different column to change their
              status instantly. The card snaps to the target column and the database is
              updated in the background — no save button needed.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Visual cues during a drag:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'The dragged card shows a dashed border ghost effect where it came from.',
                'The cursor changes to a grab hand while hovering a draggable card.',
                'Drop the card anywhere inside the target column — not just at the top.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.6 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#ffb800">
              Drag & drop is <strong>disabled</strong> for roles that only have view
              access (e.g., Director, Photographer, Client). Only Casting Directors,
              Producers, and Admins can move cards.
            </Callout>
            <CtaButton label="Prøv dra og slipp" action="try-drag-drop" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Card being dragged between Shortlist and Selected columns',
      },
    ],
  },

  // ── 5. Search & Filter ────────────────────────────────────────────────────
  {
    id: 'search-filter',
    label: 'Search & Filter',
    icon: <SearchIcon fontSize="small" />,
    sections: [
      {
        heading: 'Find candidates quickly',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The toolbar provides two filters that work
              <strong> across all columns simultaneously</strong>:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { name: 'Search field', desc: 'Type a candidate\'s name to filter all columns in real-time. Cards that don\'t match are hidden.' },
                { name: 'Role dropdown', desc: 'Select a specific role from the list to show only candidates assigned to that role. Appears only when the project has roles.' },
              ].map(f => (
                <Box key={f.name} sx={{ display: 'flex', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <Typography sx={{ fontSize: '1rem', lineHeight: 1, mt: 0.25, minWidth: 20 }}>🔍</Typography>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: ACCENT }}>{f.name}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{f.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              When a filter is active, a clear button (×) appears in the toolbar.
              Click it to reset both search and role filter at once.
            </Typography>
            <Callout>
              Filters apply live as you type — there is no need to press Enter.
              The column counts update to reflect only the filtered candidates.
            </Callout>
            <CtaButton label="Søk kandidater" action="search-candidates" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Toolbar search field and role dropdown in use — filtered columns',
      },
    ],
  },

  // ── 6. Bulk Actions ───────────────────────────────────────────────────────
  {
    id: 'bulk-actions',
    label: 'Bulk Actions',
    icon: <BulkIcon fontSize="small" />,
    sections: [
      {
        heading: 'Select multiple candidates',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              When you have bulk-action permission (Casting Director, Producer, Admin),
              you can select multiple cards and act on them all at once:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                'Hover a card — a checkbox appears in the top-left corner.',
                'Click the checkbox to select that card.',
                'Select more cards across any column by clicking their checkboxes.',
                'A <strong>Bulk Action Bar</strong> slides up from the bottom showing the count + actions.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.75 }}>
                  <Typography variant="body2" dangerouslySetInnerHTML={{ __html: item }} />
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Bulk Action Bar options:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { label: 'Move to status', desc: 'Opens a menu to move all selected cards to a new column in one action.' },
                { label: 'Assign event', desc: 'Opens the Assign Audition Event dialog for all selected candidates simultaneously.' },
                { label: 'Delete', desc: 'Permanently removes all selected candidates after a confirmation dialog.' },
                { label: 'Cancel (×)', desc: 'Clears the selection without taking any action.' },
              ].map(a => (
                <Box key={a.label} sx={{ display: 'flex', gap: 1.5, mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: ACCENT, flexShrink: 0, mt: 0.6 }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>{a.label}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{a.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
            <Callout color="#ef4444">
              <strong>Delete is permanent</strong> — deleted candidates cannot be
              recovered. Always double-check your selection before confirming.
            </Callout>
            <CtaButton label="Velg flere kandidater" action="select-bulk-candidates" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Bulk Action Bar visible at bottom — 3 cards selected across columns',
      },
    ],
  },

  // ── 7. Role-Based Access ─────────────────────────────────────────────────
  {
    id: 'role-access',
    label: 'Role-Based Access',
    icon: <RoleAccessIcon fontSize="small" />,
    sections: [
      {
        heading: 'What you see depends on your role',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The Kanban board automatically adjusts which columns and controls are
              visible based on the role you selected when you logged in. This keeps
              the board focused on what is relevant to your job.
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)', overflowX: 'auto' }}
            >
              <Box sx={{ display: 'flex', gap: 1, mb: 1.25, borderBottom: '1px solid rgba(255,255,255,0.08)', pb: 1 }}>
                {['Role', 'Visible columns', 'Add', 'Move', 'Bulk', 'Event'].map(h => (
                  <Typography key={h} variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.5)', minWidth: h === 'Role' ? 120 : h === 'Visible columns' ? 180 : 40, fontSize: '0.68rem' }}>
                    {h}
                  </Typography>
                ))}
              </Box>
              {[
                { role: 'Casting Director', cols: 'All 5', add: '✓', move: '✓', bulk: '✓', event: '✓', color: '#f59e0b' },
                { role: 'Producer', cols: 'All 5', add: '✓', move: '✓', bulk: '✓', event: '✓', color: '#10b981' },
                { role: 'Admin', cols: 'All 5', add: '✓', move: '✓', bulk: '✓', event: '✓', color: '#8b5cf6' },
                { role: 'Agent', cols: 'All 5', add: '✓', move: '—', bulk: '—', event: '—', color: '#00d4ff' },
                { role: 'Director', cols: 'Shortlist → Rejected', add: '—', move: '—', bulk: '—', event: '—', color: '#3b82f6' },
                { role: 'Talent', cols: 'Pending → Confirmed + Rejected', add: '—', move: '—', bulk: '—', event: '—', color: '#ec4899' },
                { role: 'Photographer', cols: 'Selected + Confirmed', add: '—', move: '—', bulk: '—', event: '—', color: '#f97316' },
                { role: 'Client', cols: 'Selected + Confirmed', add: '—', move: '—', bulk: '—', event: '—', color: '#a78bfa' },
                { role: 'Camera / Sound / Crew', cols: 'Confirmed only', add: '—', move: '—', bulk: '—', event: '—', color: '#6b7280' },
              ].map(row => (
                <Box key={row.role} sx={{ display: 'flex', gap: 1, mb: 0.75, alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: row.color, fontWeight: 600, minWidth: 120, fontSize: '0.75rem' }}>{row.role}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', minWidth: 180, fontSize: '0.72rem' }}>{row.cols}</Typography>
                  {[row.add, row.move, row.bulk, row.event].map((v, i) => (
                    <Typography key={i} variant="caption" sx={{ minWidth: 40, color: v === '✓' ? '#10b981' : 'rgba(255,255,255,0.25)', fontSize: '0.8rem', textAlign: 'center' }}>{v}</Typography>
                  ))}
                </Box>
              ))}
            </Paper>
            <Callout>
              The <strong>role badge chip</strong> in the Kanban toolbar shows your
              active role with the same icon and colour from the login screen.
              Hover the chip to see a description of your permissions.
            </Callout>
            <CtaButton label="Se rolletilganger" action="view-role-access" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Role badge chip in Kanban toolbar — Director view with limited columns',
      },
    ],
  },

  // ── 8. Assign Event ───────────────────────────────────────────────────────
  {
    id: 'assign-event',
    label: 'Assign Audition Event',
    icon: <EventIcon fontSize="small" />,
    sections: [
      {
        heading: 'Link candidates to an audition event',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Casting Directors, Producers, and Admins can assign candidates to a
              specific audition event directly from the Kanban board — no need to
              navigate to the Auditions tab.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Two ways to open the Assign Event dialog:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1.5 }}>
              {[
                '<strong>Single card:</strong> Hover a card — click the calendar icon (🗓) that appears bottom-left of the card.',
                '<strong>Bulk:</strong> Select multiple cards → click "Assign event" in the Bulk Action Bar at the bottom.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.75 }}>
                  <Typography variant="body2" dangerouslySetInnerHTML={{ __html: item }} />
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              In the dialog:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 1 }}>
              {[
                'Choose from upcoming audition slots already created in the Auditions tab.',
                'The assignment links back to the full audition schedule record.',
                'You can reassign a different event at any time.',
              ].map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.6 }}>
                  <Typography variant="body2">{item}</Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#8b5cf6">
              You need at least one audition slot in the Auditions tab before this
              dialog will show any options. Go to the <strong>Auditions</strong> tab
              to create slots first.
            </Callout>
            <CtaButton label="Tilknytt audition" action="assign-audition-event" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Assign Audition Event dialog — candidate selected, event list shown',
      },
    ],
  },

  // ── 9. Realtime Collaboration ─────────────────────────────────────────────
  {
    id: 'realtime',
    label: 'Realtime Updates',
    icon: <RealtimeIcon fontSize="small" />,
    sections: [
      {
        heading: 'Live collaboration via WebSocket',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The Kanban board is connected to a real-time WebSocket. When any team
              member moves a card, adds a candidate, or makes a change, every connected
              user's board updates automatically within seconds — no page refresh needed.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Connection status is shown by the dot in the toolbar, next to the Kanban title:
            </Typography>
            <Paper
              variant="outlined"
              sx={{ borderColor: 'rgba(255,255,255,0.1)', p: 2, mb: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
            >
              {[
                { dot: '#10b981', label: 'Green dot', desc: 'WebSocket connected — changes appear in real-time.' },
                { dot: 'rgba(255,255,255,0.25)', label: 'Grey dot', desc: 'Disconnected — board shows last known state. Click Refresh (↺) to manually reload.' },
              ].map(d => (
                <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1, '&:last-child': { mb: 0 } }}>
                  <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: d.dot, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', fontSize: '0.83rem' }}>{d.label}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{d.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
            <Callout>
              If the dot stays grey, check your internet connection. You can always
              click the <strong>↺ Refresh</strong> icon button to manually pull the
              latest data from the server.
            </Callout>
            <CtaButton label="Se tilkoblingsstatus" action="view-realtime-status" onAction={onAction} />
          </>
        ),
        screenshotLabel: 'Kanban toolbar — green realtime dot and refresh button',
      },
    ],
  },
  ];
}

// ─── Guide ID ─────────────────────────────────────────────────────────────────

const GUIDE_ID = 'kanban' as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface KanbanGuideProps {
  open: boolean;
  onClose: () => void;
  initialStepId?: string;
  onAction?: (action: string) => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

function KanbanGuide({ open, onClose, initialStepId, onAction }: KanbanGuideProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig = getGuideConfig(GUIDE_ID);
  const activeStepIds = getActiveStepIds(GUIDE_ID);

  const steps = buildSteps(onAction);
  const visibleSteps: Step[] = steps.filter(s =>
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
      aria-labelledby="kanban-guide-title"
      PaperProps={{ sx: { bgcolor: '#0f0f0f', backgroundImage: 'none' } }}
    >
      {/* ── Title bar ── */}
      <DialogTitle
        id="kanban-guide-title"
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
            {guideConfig?.title ?? 'Kanban Board — Guide'}
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
            sx={{ bgcolor: ACCENT_COLOR, color: '#000', fontWeight: 700, '&:hover': { filter: 'brightness(0.9)' } }}
          >
            Done ✓
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            variant="contained"
            sx={{ bgcolor: ACCENT_COLOR, color: '#000', fontWeight: 700, '&:hover': { filter: 'brightness(0.9)' } }}
          >
            Next →
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default KanbanGuide;
