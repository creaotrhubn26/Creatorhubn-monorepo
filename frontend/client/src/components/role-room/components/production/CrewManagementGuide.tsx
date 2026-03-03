/**
 * CrewManagementGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Crew Management Panel.
 *
 * Covers all features:
 *   – Department sidebar & overview stats
 *   – Adding and inviting crew members
 *   – Grid / table views, status badges, availability dots
 *   – Search, status filter chips, role filter panel
 *   – Multi-select & bulk actions
 *   – Days Out Of Days (DOOD) mini strip + overview panel
 *   – Callsheet generator drawer
 *   – Cost calculator & CSV export
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
  HelpOutline as HelpIcon,
  Groups as OverviewIcon,
  PersonAdd as InviteIcon,
  Category as DeptIcon,
  Badge as CardIcon,
  FilterList as FilterIcon,
  LibraryAddCheck as BulkIcon,
  TableChart as DoodIcon,
  Assignment as CallsheetIcon,
  Calculate as CostIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import { GuideAnnotatedScreenshot } from '../shared/guide/GuideAnnotationOverlay';
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

// ─── Status pill (mirrors StatusBadge in the real panel) ─────────────────────

const STATUS_PILLS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed:   { label: 'Confirmed',   color: '#10b981', bg: 'rgba(16,185,129,0.18)' },
  pending:     { label: 'Pending',     color: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
  invited:     { label: 'Invited',     color: '#3b82f6', bg: 'rgba(59,130,246,0.18)' },
  unavailable: { label: 'Unavailable', color: '#ef4444', bg: 'rgba(239,68,68,0.18)'  },
};

function StatusPill({ status }: { status: string }) {
  const p = STATUS_PILLS[status] ?? STATUS_PILLS['pending'];
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

// ─── DOOD Code Cell ───────────────────────────────────────────────────────────

const DOOD_CODES: Record<string, { bg: string; text: string; meaning: string }> = {
  W:  { bg: '#1e3a1e', text: '#4ade80', meaning: 'Work day'   },
  H:  { bg: '#2a2a0f', text: '#facc15', meaning: 'Hold day'   },
  T:  { bg: '#1a2a3a', text: '#60a5fa', meaning: 'Travel day' },
  SW: { bg: '#2d1e1e', text: '#f87171', meaning: 'Start/Work' },
  FW: { bg: '#2d1e1e', text: '#f87171', meaning: 'Finish/Work'},
};

function DoodCell({ code }: { code: string }) {
  const c = DOOD_CODES[code] ?? { bg: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.4)', meaning: code };
  return (
    <Tooltip title={c.meaning}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 18,
          borderRadius: 0.5,
          bgcolor: c.bg,
          mx: 0.25,
        }}
      >
        <Typography sx={{ fontSize: 8, fontWeight: 800, color: c.text, fontFamily: 'monospace' }}>
          {code}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  // ── 1. Overview ──────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: <OverviewIcon fontSize="small" />,
    sections: [
      {
        heading: 'What is Crew Management?',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The <strong>Crew Management</strong> panel is the central hub for organising
              every person on your production. It lets you add, invite, and track all crew
              members — from the director to the wardrobe assistant — with per-person
              availability, status, day rate, and shoot-day assignments.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              It connects directly to the Stripboard (production days), the Callsheet
              generator, and the Days Out of Days (DOOD) tracker so everything stays in
              sync without manual re-entry.
            </Typography>
            <Callout>
              💡 The panel supports both photographers and videographers. Crew roles and
              department groupings adjust automatically based on the project type.
            </Callout>
          </>
        ),
        screenshotLabel: 'Crew Management panel — full view with sidebar and grid',
      },
      {
        heading: 'Panel layout & stats',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The panel is divided into three zones:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Department sidebar (left)', 'Collapsible list of departments — click one to filter the crew grid instantly. Shows member count and favourite-star count per department.'],
                ['Crew list (centre)', 'Grid or table of all crew members matching the active filters. Toggle between views with the grid/table icons in the header.'],
                ['Header toolbar (top)', 'Stats bar, search, status chips, export, DOOD, Callsheet, Cost Calculator, Invite, and Add buttons.'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              The <strong>Stats bar</strong> (collapsible from the ↕ icon) shows total
              crew count, available-now count, and the sum of all daily rates.
            </Typography>
            <Callout color="#10b981">
              An amber{' '}
              <Box component="span" sx={{ color: '#ef4444', fontWeight: 700 }}>⚠ N conflicts</Box>
              {' '}badge appears in the header when one or more crew members have
              scheduling conflicts across shoot days.
            </Callout>
          </>
        ),
        screenshotLabel: 'Annotated layout — sidebar / crew grid / header toolbar / stats bar',
      },
    ],
  },

  // ── 2. Adding & Inviting Crew ─────────────────────────────────────────────
  {
    id: 'adding-crew',
    label: 'Adding & Inviting',
    icon: <InviteIcon fontSize="small" />,
    sections: [
      {
        heading: 'Adding a crew member directly',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>+ Add</strong> button (top right) to open the crew member
              form dialog. Fill in:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Name', 'Full name — required.'],
                ['Role', 'Select from 25 + production roles (Director, Cinematographer, Gaffer, etc.). Determines which department the member is placed in.'],
                ['Status', <><StatusPill status="confirmed" /> <StatusPill status="pending" /> <StatusPill status="invited" /> <StatusPill status="unavailable" /></>],
                ['Day rate', 'Daily fee in NOK. Used by the Cost Calculator and split-sheet percentage.'],
                ['Availability (Mon–Fri)', 'Toggle which days of the week this person is available. Shown as coloured dots on the card.'],
                ['Contact info', 'Email and phone number — optional but useful for the Callsheet.'],
                ['Notes', 'Free-text notes visible in the expanded card view.'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" component="div" sx={{ lineHeight: 1.7 }}>
                    <strong>{label as string}</strong> — <>{desc}</>
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              💡 The split-sheet percentage auto-calculates as <em>rate ÷ total budget × 100</em> when
              a project budget is set.
            </Callout>
          </>
        ),
        screenshotLabel: 'Add crew member dialog — all fields filled in',
      },
      {
        heading: 'Inviting via email / phone',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click <strong>Invite</strong> (<Key>F</Key>) to open the lighter invite
              dialog. Provide a name, role, and optionally an email or phone number.
              The member is created with <StatusPill status="invited" /> status — they
              appear on the board immediately so you can track the invitation.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Once they accept and are confirmed, update their status to{' '}
              <StatusPill status="confirmed" /> in the edit dialog or via bulk status
              change.
            </Typography>
            <Callout color="#3b82f6">
              💡 Invited members still show on the DOOD board so you can plan around
              them while waiting for confirmation.
            </Callout>
          </>
        ),
        screenshotLabel: 'Invite crew dialog — name, role, email, and phone fields',
      },
    ],
  },

  // ── 3. Department Sidebar ─────────────────────────────────────────────────
  {
    id: 'dept-sidebar',
    label: 'Department Sidebar',
    icon: <DeptIcon fontSize="small" />,
    sections: [
      {
        heading: 'Filtering by department',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              The left sidebar lists every department that has at least one crew member.
              Each row shows the department name, member count, and a star count (how
              many members are marked as favourites in that department).
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Departments include:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0, columns: 2 }}>
              {[
                'Direction', 'Camera', 'Lighting', 'Sound', 'Post-Production',
                'Production', 'Art & Costume', 'Other',
              ].map(d => (
                <Box key={d} component="li" sx={{ mb: 0.25 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{d}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              Click a department to instantly filter the crew grid. Click <strong>All</strong>{' '}
              (top of the list) to reset. The sidebar can be hidden on mobile or
              collapsed via the <strong>‹ / ›</strong> icon in the header on desktop.
            </Typography>
            <Callout color="#00d4ff">
              💡 Department colours match the crew card accent — Camera is teal,
              Lighting is amber, Post is violet, and so on — making cards visually
              scannable.
            </Callout>
          </>
        ),
        screenshotLabel: 'Department sidebar with Camera selected — grid shows only camera crew',
      },
    ],
  },

  // ── 4. Crew Cards & Views ─────────────────────────────────────────────────
  {
    id: 'crew-cards',
    label: 'Crew Cards & Views',
    icon: <CardIcon fontSize="small" />,
    sections: [
      {
        heading: 'Grid view — card anatomy',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Each crew card shows at a glance:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Avatar + name', 'Initials avatar with a department-coloured border, full name and role label.'],
                ['Status badge', 'Colour-coded pill: Confirmed (green) · Pending (amber) · Invited (blue) · Unavailable (red).'],
                ['Availability dots', 'Mon – Fri coloured dots showing which days the person is available this week. An amber triangle appears if there is a shoot-day conflict.'],
                ['Day rate', 'Daily fee (NOK), shown in the card footer alongside the ★ favourite icon.'],
                ['DOOD mini strip', 'A compact row of W / H / T / SW / FW code cells showing shoot-day assignments across all production days. Only visible when productionDays are loaded from the Stripboard.'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              Click the <strong>expand arrow</strong> on a card to reveal contact info,
              notes, assigned scenes, and the full shoot-day assignment list.
            </Typography>
          </>
        ),
        screenshotLabel: 'Crew card in grid view — expanded to show contact info and DOOD strip',
      },
      {
        heading: 'Table view',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>table icon</strong> in the header to switch to table view.
              The table shows all crew in a sortable, scrollable grid with columns for:
              Name, Role, Status, Day Rate, Availability, and DOOD assignment count.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              Click any column header to sort ascending / descending. Sortable fields:
              Name, Role, Day Rate, and Availability.
            </Typography>
            <Callout>
              💡 Table view is ideal for large crews (20 + members) when you need to
              compare rates or scan statuses quickly without scrolling a card grid.
            </Callout>
          </>
        ),
        screenshotLabel: 'Table view — sortable columns with status and rate visible',
      },
    ],
  },

  // ── 5. Search & Filters ───────────────────────────────────────────────────
  {
    id: 'search-filters',
    label: 'Search & Filters',
    icon: <FilterIcon fontSize="small" />,
    sections: [
      {
        heading: 'Search bar and quick-filter chips',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The search box (debounced 300 ms) filters crew by name, email, or phone
              number as you type.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              The status filter chips below the search narrow results by member status:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
              {['confirmed', 'pending', 'invited', 'unavailable'].map(s => (
                <StatusPill key={s} status={s} />
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Two additional quick-filter chips:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Available now', 'Shows only crew whose current-week availability includes today.'],
                ['Assigned today', 'Shows only crew with a shoot-day assignment on today\'s date (requires Stripboard data). Only visible when production days are loaded.'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              All active filters are reflected as deletable chips below the toolbar.
              Click the amber <strong>Reset</strong> chip to clear everything at once.
            </Typography>
          </>
        ),
        screenshotLabel: 'Filter toolbar — search, status chips, and active filter chips visible',
      },
      {
        heading: 'Role filter panel',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>filter icon</strong> (<Key>Ctrl</Key>+<Key>F</Key>) to
              toggle the Role Filter panel. It shows a dropdown listing every crop role
              for the project type. Selecting a role narrows the grid to only crew with
              that exact role.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              A blue badge on the filter icon counts how many filters are currently
              active so you never lose track of what is applied.
            </Typography>
            <Callout>
              Filters stack — you can combine Status + Department + Role + Search + Available
              Now all at the same time.
            </Callout>
          </>
        ),
        screenshotLabel: 'Role filter panel open — Cinematographer selected',
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
        heading: 'Selecting crew members',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1 }}>
              Each card has a checkbox (appears on hover) in the top-left corner. Click
              it to enter selection mode. Once one card is selected, checkboxes stay
              visible on all cards.
            </Typography>
            {[
              ['Click checkbox', 'Select / deselect a single member.'],
              ['Shift + Click', 'Range-select all members between the last clicked and the new click.'],
              ['Select All chip', 'Click "Select All" in the bulk bar to select every currently visible (filtered) member.'],
              ['Escape', 'Clears the entire selection.'],
            ].map(([key, desc]) => (
              <Box key={key as string} sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'flex-start' }}>
                <Key>{key}</Key>
                <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, pt: 0.25 }}>
                  {desc}
                </Typography>
              </Box>
            ))}
          </>
        ),
        screenshotLabel: 'Three crew cards selected — bulk action bar visible at bottom',
      },
      {
        heading: 'Bulk operations',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              When one or more members are selected, a bulk action bar appears at the
              bottom of the panel with four actions:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Change Status', 'Sets all selected members to Confirmed, Pending, Invited, or Unavailable in one click.'],
                ['Assign to Shoot Day', 'Opens the Assign Shoot Day dialog — pick a production day and unit (A / B) to schedule all selected members at once. Their DOOD strips update immediately.'],
                ['Export selected', 'Downloads a CSV of the selected members only (falls back to full CSV if none selected).'],
                ['Delete', 'Permanently removes all selected members after a confirmation step.'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#ef4444">
              Deletion is permanent. All shoot-day assignments and DOOD data for
              deleted members are also removed.
            </Callout>
          </>
        ),
        screenshotLabel: 'Bulk action bar — Status dropdown open with Confirmed option highlighted',
      },
    ],
  },

  // ── 7. DOOD ───────────────────────────────────────────────────────────────
  {
    id: 'dood',
    label: 'Days Out Of Days',
    icon: <DoodIcon fontSize="small" />,
    sections: [
      {
        heading: 'DOOD codes on crew cards',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              When shoot days are loaded from the Stripboard, each crew card displays a
              <strong> DOOD mini strip</strong> — a row of small colour-coded cells, one
              per production day:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {Object.entries(DOOD_CODES).map(([code, { meaning }]) => (
                <Box key={code} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <DoodCell code={code} />
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>
                    {meaning}
                  </Typography>
                </Box>
              ))}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 28, height: 18, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 0.5 }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>
                  Not assigned
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
              To assign a member to a shoot day, click the <strong>calendar icon</strong>{' '}
              on their card — or use the bulk "Assign to Shoot Day" action for multiple
              members at once.
            </Typography>
          </>
        ),
        screenshotLabel: 'Crew card showing DOOD mini strip — W / H / T cells across 8 shoot days',
      },
      {
        heading: 'DOOD Overview panel',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>DOOD icon</strong> in the header toolbar to open the full
              DOOD Overview. This is a horizontally scrollable table with:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Left column (sticky)', 'Member name and role.'],
                ['Day columns', 'One column per production day, showing the DOOD code cell for that member on that day.'],
                ['W column (rightmost)', 'Total Work days for the production.'],
                ['H column', 'Total Hold days.'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              💡 The DOOD overview is the standard industry report shared with
              production managers and unions showing each crew member's contracted days.
            </Callout>
          </>
        ),
        screenshotLabel: 'DOOD Overview drawer — full grid with all crew × all shoot days',
      },
    ],
  },

  // ── 8. Callsheet Generator ────────────────────────────────────────────────
  {
    id: 'callsheet',
    label: 'Callsheet Generator',
    icon: <CallsheetIcon fontSize="small" />,
    sections: [
      {
        heading: 'Generating a callsheet',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>callsheet icon</strong> in the header to open the
              Callsheet Generator drawer (700 – 800 px wide side panel). It pre-fills
              with:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                'All confirmed crew members and their contact details',
                'All scenes scheduled for the selected production day',
                'Location, call time, and shoot day number from the Stripboard',
              ].map(item => (
                <Box key={item} component="li" sx={{ mb: 0.4 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>{item}</Typography>
                </Box>
              ))}
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1.5 }}>
              If the project has multiple production days, use the day picker in the
              drawer header to switch between them.
            </Typography>
            <Callout color="#00d4ff">
              💡 The callsheet is rendered by{' '}
              <strong>CallSheetGenerator</strong> and supports PDF export — click
              the print / download button inside the drawer.
            </Callout>
          </>
        ),
        screenshotLabel: 'Callsheet Generator drawer — day 1 pre-filled with crew and scenes',
      },
    ],
  },

  // ── 9. Cost Calculator & Export ───────────────────────────────────────────
  {
    id: 'cost-export',
    label: 'Cost & Export',
    icon: <CostIcon fontSize="small" />,
    sections: [
      {
        heading: 'Cost Calculator',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>calculator icon</strong> in the header to toggle the Cost
              Calculator. Set a <strong>From</strong> and <strong>To</strong> date and
              the panel instantly calculates:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Days', 'Number of shoot days in the date range.'],
                ['Crew', 'Number of crew members included (or selected, if a multi-select is active).'],
                ['Total', 'Sum of all selected crew daily rates × number of days, shown in NOK.'],
              ].map(([label, desc]) => (
                <Box key={label as string} component="li" sx={{ mb: 0.75 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <strong>{label}</strong> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout>
              💡 Select specific crew members first, then open the Cost Calculator to get
              a budget estimate for only that subset — useful for comparing department
              costs.
            </Callout>
          </>
        ),
        screenshotLabel: 'Cost Calculator expanded — date range set, total cost displayed',
      },
      {
        heading: 'CSV export & keyboard shortcuts',
        body: (
          <>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 1.5 }}>
              Click the <strong>download icon</strong> in the header (or press{' '}
              <Key>Ctrl</Key>+<Key>E</Key>) to export all visible crew to a CSV file.
              The export respects the current filters — if a department or status filter
              is active, only the matching members are exported.
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.8, mb: 0.5 }}>
              <strong>All keyboard shortcuts:</strong>
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, mt: 0 }}>
              {[
                ['Ctrl + E', 'Export current view to CSV'],
                ['Ctrl + F', 'Toggle role filter panel'],
                ['F',        'Open Invite crew dialog'],
              ].map(([key, desc]) => (
                <Box key={key as string} component="li" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.7 }}>
                    <Key>{key}</Key> — {desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Callout color="#10b981">
              💡 An offline outbox automatically queues any changes made while offline
              and syncs them the next time a network connection is detected. A banner
              shows the number of pending actions.
            </Callout>
          </>
        ),
        screenshotLabel: 'Exported CSV open in spreadsheet — name, role, status, rate columns',
      },
    ],
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export interface CrewManagementGuideProps {
  open: boolean;
  onClose: () => void;
  /** If provided the guide opens directly to this step id. */
  initialStepId?: string;
}

export function CrewManagementGuide({ open, onClose, initialStepId }: CrewManagementGuideProps) {
  const theme   = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  // ── Admin guide config ────────────────────────────────────────────────────
  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig  = getGuideConfig('crew-management');
  const activeIds    = getActiveStepIds('crew-management');
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map(id => STEPS.find(s => s.id === id)).filter(Boolean) as Step[])
    : STEPS;

  const [activeStepId, setActiveStepId] = useState(initialStepId ?? visibleSteps[0].id);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeStep   = visibleSteps.find(s => s.id === activeStepId) ?? visibleSteps[0];
  const activeIdx    = visibleSteps.findIndex(s => s.id === activeStepId);
  const stepOverride = getStepOverride('crew-management', activeStep.id);

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

  const ACCENT = guideConfig.accentColorOverride ?? '#00d4ff';

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
        <HelpIcon sx={{ color: ACCENT, fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Crew Management — How it works
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

      {/* ── Admin intro banner ── */}
      {guideConfig.introBanner && (
        <Box
          sx={{
            px: 3,
            py: 1.25,
            bgcolor: `${guideConfig.introBannerColor ?? '#f59e0b'}18`,
            borderBottom: `1px solid ${guideConfig.introBannerColor ?? '#f59e0b'}33`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 3,
              minHeight: 16,
              bgcolor: guideConfig.introBannerColor ?? '#f59e0b',
              borderRadius: 1,
              flexShrink: 0,
              mt: 0.5,
            }}
          />
          <Typography
            variant="caption"
            sx={{ color: guideConfig.introBannerColor ?? '#f59e0b', fontSize: '0.78rem', lineHeight: 1.6 }}
          >
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
                const isPast   = idx < activeIdx;
                const ov       = getStepOverride('crew-management', step.id);
                return (
                  <ListItemButton
                    key={step.id}
                    selected={isActive}
                    onClick={() => handleStepSelect(step.id)}
                    sx={{
                      px: 2,
                      py: 0.875,
                      borderRight: isActive ? `2px solid ${ACCENT}` : '2px solid transparent',
                      bgcolor: isActive ? `${ACCENT}14` : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      gap: 1.25,
                    }}
                  >
                    <Box
                      sx={{
                        color: isActive ? ACCENT : isPast ? '#22c55e' : 'rgba(255,255,255,0.3)',
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
                      <Box
                        component="span"
                        sx={{
                          ml: 0.5,
                          px: 0.5,
                          py: 0.125,
                          bgcolor: `${ACCENT}22`,
                          color: ACCENT,
                          border: `1px solid ${ACCENT}44`,
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                bgcolor: `${ACCENT}22`,
                border: `1px solid ${ACCENT}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: ACCENT,
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
                <Box
                  component="span"
                  sx={{ display: 'inline-block', width: 4, height: 14, bgcolor: ACCENT, borderRadius: 1, flexShrink: 0 }}
                />
                {section.heading}
              </Typography>

              {section.body}

              {stepOverride.videoUrl ? (
                <Box component="video" src={stepOverride.videoUrl} controls
                  sx={{ width: '100%', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', mt: 1.5, display: 'block' }} />
              ) : stepOverride.screenshotUrl ? (
                <GuideAnnotatedScreenshot
                  src={stepOverride.screenshotUrl}
                  alt={section.screenshotLabel}
                  annotations={stepOverride.annotations}
                  containerSx={{ mt: 1.5, borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}
                  imageSx={{ maxHeight: 320, objectFit: 'cover' }}
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
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}
              >
                {stepOverride.adminNote}
              </Typography>
            </Box>
          )}

          {/* Mobile step nav */}
          {isNarrow && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
              {visibleSteps.map((s, i) => {
                const ov = getStepOverride('crew-management', s.id);
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
                        ? { bgcolor: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44` }
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
                  bgcolor: i === activeIdx ? ACCENT : i < activeIdx ? '#22c55e' : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  transition: 'width 0.2s, background-color 0.2s',
                  '&:hover': { bgcolor: i === activeIdx ? ACCENT : 'rgba(255,255,255,0.35)' },
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
              sx={{ bgcolor: ACCENT, '&:hover': { filter: 'brightness(0.9)' }, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', px: 2 }}
            >
              Next →
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              onClick={onClose}
              sx={{ bgcolor: '#22c55e', '&:hover': { bgcolor: '#16a34a' }, textTransform: 'none', fontWeight: 600, fontSize: '0.78rem', px: 2 }}
            >
              Done ✓
            </Button>
          )}
        </Paper>
      </DialogActions>
    </Dialog>
  );
}

export default CrewManagementGuide;
