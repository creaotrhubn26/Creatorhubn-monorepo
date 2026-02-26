/**
 * ShotListGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Shot List Panel.
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
import { useVisualEditor } from '../admin/visual-editor/VisualEditorContext';
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
  PeopleAlt as PeopleIcon,
  MultipleStop as BatchIcon,
  SwapVert as ReorderIcon,
  FileDownload as ExportIcon,
  Wifi as RealtimeIcon,
  HelpOutline as HelpIcon,
  Videocam as VideoIcon,
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
  screenshot?: string; // future: path to real image asset
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
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6 }}>
        {children}
      </Typography>
    </Box>
  );
}

// ─── Inline Key ──────────────────────────────────────────────────────────────

function Key({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      sx={{
        display: 'inline-block',
        px: 0.75,
        py: 0.125,
        bgcolor: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.18)',
        borderRadius: 0.75,
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 1.6,
        mx: 0.25,
      }}
    >
      {children}
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
        color: '#e91e63',
        borderColor: 'rgba(233,30,99,0.4)',
        bgcolor: 'rgba(233,30,99,0.06)',
        '&:hover': {
          borderColor: '#e91e63',
          bgcolor: 'rgba(233,30,99,0.14)',
        },
      }}
    >
      {label}
    </Button>
  );
}

// ─── Step content ─────────────────────────────────────────────────────────────

function buildSteps(onAction?: (action: string) => void): Step[] {
  return [
  // ── 1 ─────────────────────────────────────────────────────────────────────
  {
    id: 'overview',
    label: 'Overview',
    icon: <HelpIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'What is the Shot List Panel?',
        screenshotLabel: 'Full panel — grid + sidebar + top bar',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The Shot List Panel lets you organise, assign and track every camera shot
              across all scenes in a project — replacing spreadsheets with a live,
              collaborative workspace.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The screen is split into four areas:
            </Typography>
            {[
              { label: 'Top Bar', desc: 'Breadcrumb, batch actions, New Shot List button, and a realtime connection indicator.' },
              { label: 'Filter Bar', desc: 'Mine / Unassigned toggles, Status, Scene, Sort, Search, and Grid / List view switch.' },
              { label: 'Card Grid', desc: 'One card per Shot List. Each card shows progress, assignees, status and time estimate — all computed live.' },
              { label: 'Crew Sidebar', desc: 'Searchable Cast & Crew list. Drag any person onto a card to assign them.' },
            ].map(({ label, desc }) => (
              <Box key={label} sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                <Chip
                  label={label}
                  size="small"
                  sx={{ bgcolor: '#e91e6322', color: '#e91e63', border: '1px solid #e91e6333', height: 22, fontSize: '0.68rem', flexShrink: 0 }}
                />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', lineHeight: 1.6, pt: 0.125 }}>
                  {desc}
                </Typography>
              </Box>
            ))}
            <CtaButton label="Utforsk panelet" action="explore-panel" onAction={onAction} icon={<HelpIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 2 ─────────────────────────────────────────────────────────────────────
  {
    id: 'viewing',
    label: 'Viewing the Grid',
    icon: <FilterIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Reading a Shot List Card',
        screenshotLabel: 'Close-up of a single card with annotations',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Every card shows a computed summary of the Shot List — nothing is stored, everything is calculated fresh from the underlying shots.
            </Typography>
            {[
              ['Top-left badges', 'INT / EXT and Day / Night — taken from the linked scene.'],
              ['Coloured dot', 'The optional colour tag (red, blue, green…) set when creating or editing the list.'],
              ['Title', 'Scene name or scene ID if no name is set.'],
              ['Progress bar', 'Percentage of shots marked Completed. Blue → Orange → Green as it fills.'],
              ['n / n count', 'Completed shots out of total shots.'],
              ['Orange warning', 'Number of shots with no assignee. Click the card to fix.'],
              ['Status badge', 'Not Started / Started / In Progress / Done — derived from completion %.'],
              ['⏱ Duration', 'Sum of all shot estimated times in the list.'],
              ['Avatars', 'Up to 4 most-assigned crew/cast — hover to see names.'],
            ].map(([key, val]) => (
              <Box key={String(key)} sx={{ display: 'flex', gap: 1, mb: 0.75, alignItems: 'flex-start' }}>
                <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 700, fontSize: '0.72rem', minWidth: 120, pt: 0.25 }}>
                  {key}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                  {val}
                </Typography>
              </Box>
            ))}
          </>
        ),
      },
      {
        heading: 'Using Filters',
        screenshotLabel: 'Filter bar — all controls visible, one active filter highlighted',
        body: (
          <>
            {[
              { ctrl: 'Mine', desc: 'Shows only lists where you appear as an assignee.' },
              { ctrl: 'Unassigned', desc: 'Shows only lists that still have shots without an assignee.' },
              { ctrl: 'Status ▾', desc: 'Filter by completion bracket: Not Started, In Progress, or Done.' },
              { ctrl: 'Scene ▾', desc: 'Filter to a single scene ID.' },
              { ctrl: 'Sort ▾', desc: 'Sort by name, shot count, progress %, last updated, or deadline.' },
              { ctrl: '🔍 Search', desc: 'Fuzzy-matches scene name as you type.' },
              { ctrl: '⊞ / ≡', desc: 'Toggle between card Grid view and compact List view.' },
            ].map(({ ctrl, desc }) => (
              <Box key={ctrl} sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                <Box sx={{ minWidth: 90 }}>
                  <Chip label={ctrl} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }} />
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                  {desc}
                </Typography>
              </Box>
            ))}
            <Callout color="#3b82f6">
              Active filters are shown in the filter bar with a filled style. The card count next to the search box updates as you filter.
            </Callout>
            <CtaButton label="Prøv filtrering" action="try-filters" onAction={onAction} icon={<FilterIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 3 ─────────────────────────────────────────────────────────────────────
  {
    id: 'creating',
    label: 'Creating a Shot List',
    icon: <AddIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'How to create a new Shot List',
        screenshotLabel: 'Create dialog — all fields visible, Scene name filled in',
        body: (
          <>
            {[
              ['1', 'Click', '+ New Shot List in the top-right of the bar.'],
              ['2', 'Enter', 'A Scene name (required). This appears as the card title.'],
              ['3', 'Optionally set', 'A Scene ID to link the list to a scene breakdown (for INT/EXT and location data).'],
              ['4', 'Choose', 'A Production context (Feature Film, Music Video, Wedding, etc.).'],
              ['5', 'Optionally set', 'A Deadline — shown as a sort option and on the card.'],
              ['6', 'Add', 'Any notes about the list (visible when editing).'],
              ['7', 'Click', 'Create. The card appears in the grid immediately.'],
            ].map(([num, action, rest]) => (
              <Box key={String(num)} sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'flex-start' }}>
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#e91e6322', border: '1px solid #e91e6344', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#e91e63', fontWeight: 700 }}>{num}</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                  <Box component="span" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{action} </Box>
                  {rest}
                </Typography>
              </Box>
            ))}
            <Callout color="#22c55e">
              After creating, add shots from within the Shot List detail view (click the card to open it).
            </Callout>
            <CtaButton label="Opprett ny shotliste" action="create-list" onAction={onAction} icon={<AddIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 4 ─────────────────────────────────────────────────────────────────────
  {
    id: 'assigning',
    label: 'Assigning Crew',
    icon: <PeopleIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Drag a person onto a card',
        screenshotLabel: 'Person being dragged from sidebar — card glowing with drop target overlay',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The right sidebar lists every cast and crew member in the project. You can assign any of them to a Shot List in one drag.
            </Typography>
            {[
              ['1', 'Find the person in the sidebar. Use the search box or Cast / Crew / role filter chips to narrow the list.'],
              ['2', 'Grab the ⠿ drag handle on the left of the person row.'],
              ['3', 'Drag across to any Shot List card. The card highlights with a dashed pink border when you hover over it.'],
              ['4', 'Release. The person is added as a default assignee on that list. Their initials appear in the card\'s avatar row instantly.'],
            ].map(([num, desc]) => (
              <Box key={String(num)} sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'flex-start' }}>
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#3b82f622', border: '1px solid #3b82f644', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 700 }}>{num}</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', lineHeight: 1.5 }}>{desc}</Typography>
              </Box>
            ))}
          </>
        ),
      },
      {
        heading: 'The "On Shot" section',
        screenshotLabel: 'Sidebar — "On Shot" section expanded with shot-count badges visible',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              People who are already assigned to at least one shot appear at the top of the sidebar under <strong>On Shot</strong>. Each row shows a pink badge with the number of shots they are assigned to. Collapse or expand this section by clicking the section header.
            </Typography>
            <Callout color="#a855f7">
              The sidebar shot count is aggregated across all shot lists in the project — not just the ones visible in the current filtered grid.
            </Callout>
            <CtaButton label="Tildel mannskap" action="assign-crew" onAction={onAction} icon={<PeopleIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 5 ─────────────────────────────────────────────────────────────────────
  {
    id: 'editing',
    label: 'Editing & Deleting',
    icon: <DoneIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Edit a Shot List',
        screenshotLabel: 'Card context menu open, Edit option highlighted',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1 }}>
              There are two ways to edit:
            </Typography>
            <Callout color="#f97316">
              <strong>Option A — Context menu:</strong> Click the ⋮ icon on any card → Edit. This opens the edit dialog pre-filled with the current scene name and ID.
            </Callout>
            <Callout color="#f97316">
              <strong>Option B — Select then Edit:</strong> Click the checkbox on a card to select it. When exactly one card is selected, an ✏ Edit button appears in the top bar's batch toolbar. Click it to open the same dialog.
            </Callout>
          </>
        ),
      },
      {
        heading: 'Delete a Shot List',
        screenshotLabel: 'Delete confirmation dialog — warning alert visible',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1 }}>
              Click ⋮ → Delete on a card, or select one or more cards and click 🗑 in the batch toolbar. A confirmation dialog will appear listing how many lists (and all their contained shots) will be permanently removed.
            </Typography>
            <Callout color="#ef4444">
              Deletion is permanent and cannot be undone. All shots inside the list are deleted along with it.
            </Callout>
            <CtaButton label="Rediger en liste" action="edit-list" onAction={onAction} icon={<DoneIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 6 ─────────────────────────────────────────────────────────────────────
  {
    id: 'multiselect',
    label: 'Multi-Select & Batch',
    icon: <BatchIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Selecting multiple cards',
        screenshotLabel: 'Four cards selected — pink checkboxes, batch toolbar visible in top bar',
        body: (
          <>
            {[
              ['Click a checkbox', 'The checkbox appears on hover (top-left of every card). Clicking it enters selection mode.'],
              ['Shift + Click', 'Select a range — click one card, then Shift-click another to select everything in between.'],
              ['Escape', 'Clears the entire selection at any time.'],
              ['Click the × chip', 'The "N selected" chip in the top bar has a × — click it to clear selection too.'],
            ].map(([action, desc]) => (
              <Box key={String(action)} sx={{ display: 'flex', gap: 1.5, mb: 1.25, alignItems: 'flex-start' }}>
                <Key>{action}</Key>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', lineHeight: 1.5, pt: 0.25 }}>
                  {desc}
                </Typography>
              </Box>
            ))}
          </>
        ),
      },
      {
        heading: 'Batch operations',
        screenshotLabel: 'Batch assign dialog — list name chips and person autocomplete visible',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Once cards are selected the top bar switches to batch mode, showing four action buttons:
            </Typography>
            {[
              { icon: '✏', label: 'Edit', desc: 'Opens the edit dialog. Only shown when exactly 1 list is selected.' },
              { icon: '👤', label: 'Assign', desc: 'Opens the Batch Assign dialog. Shows the selected list names as chips so you can confirm before assigning. Toggle "Inherit to all shots" to push the assignee down to every shot in each list.' },
              { icon: '⬇', label: 'Export', desc: 'Downloads a CSV of the selected lists.' },
              { icon: '🗑', label: 'Delete', desc: 'Permanently deletes all selected lists and their shots after confirmation.' },
            ].map(({ icon, label, desc }) => (
              <Box key={label} sx={{ display: 'flex', gap: 1.5, mb: 1.25, alignItems: 'flex-start' }}>
                <Box sx={{ minWidth: 60, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.85rem' }}>{icon}</Typography>
                  <Typography variant="caption" sx={{ color: '#e91e63', fontWeight: 700, fontSize: '0.72rem' }}>{label}</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                  {desc}
                </Typography>
              </Box>
            ))}
            <CtaButton label="Prøv flervalg" action="try-multiselect" onAction={onAction} icon={<BatchIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 7 ─────────────────────────────────────────────────────────────────────
  {
    id: 'reorder',
    label: 'Reordering Cards',
    icon: <ReorderIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Drag cards to reorder',
        screenshotLabel: 'Card being dragged to a new position — ghost overlay visible',
        body: (
          <>
            {/* Visual drag-handle demo */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 1.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1.5, border: '1px solid rgba(255,255,255,0.1)' }}>
              <DragIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.25)', cursor: 'grab', flexShrink: 0 }} />
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.78rem', lineHeight: 1.4 }}>
                Scene 42A — INT. OFFICE — 3/4 pg &nbsp;←&nbsp; grab the handle to reorder
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Drag any Shot List card to a new position in the grid. As you drag, a ghost of the card follows your cursor and the other cards shift to show the drop position.
            </Typography>
            <Callout color="#3b82f6">
              Cards can be reordered in both Grid view and List view. The new order is saved to the server as soon as you release.
            </Callout>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', lineHeight: 1.5, mt: 1 }}>
              Keyboard users: press <Key>Space</Key> to pick up a card, then <Key>↑</Key> / <Key>↓</Key> / <Key>←</Key> / <Key>→</Key> to move it, and <Key>Space</Key> again to drop.
            </Typography>
            <CtaButton label="Prøv dra-og-slipp" action="reorder-cards" onAction={onAction} icon={<ReorderIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 8 ─────────────────────────────────────────────────────────────────────
  {
    id: 'export',
    label: 'Exporting',
    icon: <ExportIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Export options',
        screenshotLabel: 'Export dialog — CSV and PDF buttons',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              There are three entry points for export:
            </Typography>
            {[
              ['⬇ Top-bar icon', 'Always visible. Exports every shot list in the project as one CSV file.'],
              ['⋮ → Export CSV', 'Card context menu. Exports only that single list.'],
              ['Batch toolbar Export', 'Exports only the selected lists.'],
            ].map(([src, desc]) => (
              <Box key={String(src)} sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
                <Chip label={src} size="small" sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                  {desc}
                </Typography>
              </Box>
            ))}
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1.5, mb: 0.5 }}>
              The CSV includes the following columns:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {['Scene', 'Total Shots', 'Completed', 'Unassigned', 'Duration (min)', 'Last Updated'].map((col) => (
                <Chip key={col} label={col} size="small" sx={{ height: 20, fontSize: '0.62rem', bgcolor: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }} />
              ))}
            </Box>
            <Callout color="#f97316">
              PDF export is available from the same export dialog and includes scene-level totals, completion, assignment state and timestamps.
            </Callout>
            <CtaButton label="Eksporter CSV" action="export-csv" onAction={onAction} icon={<ExportIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 9 ─────────────────────────────────────────────────────────────────────
  {
    id: 'realtime',
    label: 'Realtime Collaboration',
    icon: <RealtimeIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Working with your team in real time',
        screenshotLabel: 'Top bar — green realtime dot visible, card progress bar mid-update',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The Shot List Panel maintains a live WebSocket connection to the server while it is open. You and your team can work simultaneously — changes from other users are reflected on your screen within seconds with no page refresh.
            </Typography>

            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, mb: 0.75 }}>
              Connection status dot (top-right of bar):
            </Typography>
            {[
              ['🟢 Green', 'Connected — all changes are syncing in real time.'],
              ['🟠 Orange', 'Reconnecting — the connection was lost. The app retries automatically (1 s → 30 s backoff).'],
              ['Dot hidden', 'Offline mode or realtime disabled — changes are still saved locally but not broadcast.'],
            ].map(([state, desc]) => (
              <Box key={String(state)} sx={{ display: 'flex', gap: 1.5, mb: 0.75 }}>
                <Typography variant="caption" sx={{ minWidth: 90, color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', pt: 0.25 }}>{state}</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', lineHeight: 1.5 }}>{desc}</Typography>
              </Box>
            ))}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 2 }} />

            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, mb: 0.75 }}>
              What updates live:
            </Typography>
            {[
              ['Shot assigned', 'An assignee avatar appears on the card when anyone assigns a person to a shot.'],
              ['Shot status', 'The progress bar and status badge update the moment a shot status changes.'],
              ['New list created', 'A new card appears in the grid for all connected users.'],
            ].map(([event, desc]) => (
              <Box key={String(event)} sx={{ display: 'flex', gap: 1.5, mb: 0.75 }}>
                <Chip label={event} size="small" sx={{ height: 20, fontSize: '0.62rem', bgcolor: '#22c55e11', color: '#22c55e', border: '1px solid #22c55e22', flexShrink: 0 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', lineHeight: 1.5 }}>{desc}</Typography>
              </Box>
            ))}

            <Callout color="#22c55e">
              Updates are applied directly to the in-memory cache — no network re-fetch needed. The card refreshes in under 100 ms.
            </Callout>
            <CtaButton label="Se sanntidsstatus" action="see-realtime" onAction={onAction} icon={<RealtimeIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },
  ];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface ShotListGuideProps {
  open: boolean;
  onClose: () => void;
  /** If provided, the guide opens directly to this step. */
  initialStepId?: string;
  /** Callback fired when a CTA button is clicked. Receives an action id string. */
  onAction?: (action: string) => void;
}

export function ShotListGuide({ open, onClose, initialStepId, onAction }: ShotListGuideProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  // ── Admin guide config ──────────────────────────────────────────────
  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const guideConfig  = getGuideConfig('shot-list');
  const activeIds    = getActiveStepIds('shot-list');
  const steps = buildSteps(onAction);
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map(id => steps.find(s => s.id === id)).filter(Boolean) as Step[])
    : steps;

  const [activeStepId, setActiveStepId] = useState(initialStepId ?? visibleSteps[0].id);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeStep = visibleSteps.find((s) => s.id === activeStepId) ?? visibleSteps[0];
  const activeIdx  = visibleSteps.findIndex((s) => s.id === activeStepId);
  const stepOverride = getStepOverride('shot-list', activeStep.id);

  const goPrev = useCallback(() => {
    if (activeIdx > 0) setActiveStepId(visibleSteps[activeIdx - 1].id);
  }, [activeIdx, visibleSteps]);

  const goNext = useCallback(() => {
    if (activeIdx < visibleSteps.length - 1) setActiveStepId(visibleSteps[activeIdx + 1].id);
  }, [activeIdx, visibleSteps]);

  // Scroll content to top when step changes
  const handleStepSelect = useCallback((id: string) => {
    setActiveStepId(id);
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
        <HelpIcon sx={{ color: '#e91e63', fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Shot List Panel — How it works
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
                const ov = getStepOverride('shot-list', step.id);
                return (
                  <ListItemButton
                    key={step.id}
                    selected={isActive}
                    onClick={() => handleStepSelect(step.id)}
                    sx={{
                      px: 2,
                      py: 0.875,
                      borderRight: isActive ? '2px solid #e91e63' : '2px solid transparent',
                      bgcolor: isActive ? 'rgba(233,30,99,0.08)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      gap: 1.25,
                    }}
                  >
                    <Box
                      sx={{
                        color: isActive ? '#e91e63' : isPast ? '#22c55e' : 'rgba(255,255,255,0.3)',
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
                      <Box component="span" sx={{ ml: 0.5, px: 0.5, py: 0.125, bgcolor: '#e91e6322', color: '#e91e63', border: '1px solid #e91e6344', borderRadius: 0.5, fontSize: '0.55rem', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
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
                bgcolor: '#e91e6322',
                border: '1px solid #e91e6344',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e91e63',
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
                <Box component="span" sx={{ display: 'inline-block', width: 4, height: 14, bgcolor: guideConfig.accentColorOverride ?? '#e91e63', borderRadius: 1, flexShrink: 0 }} />
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

          {/* Admin note from Guide Editor */}
          {stepOverride.adminNote && (
            <Box sx={{ mt: 1.5, mb: 2, p: 1.5, borderLeft: `3px solid ${stepOverride.adminNoteColor ?? '#f59e0b'}`, bgcolor: `${stepOverride.adminNoteColor ?? '#f59e0b'}14`, borderRadius: '0 8px 8px 0' }}>
              <Typography variant="caption" sx={{ color: stepOverride.adminNoteColor ?? '#f59e0b', fontWeight: 700, display: 'block', fontSize: '0.7rem', mb: 0.5 }}>Merknad</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {stepOverride.adminNote}
              </Typography>
            </Box>
          )}

          {/* Mobile step nav */}
          {isNarrow && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 2 }}>
              {visibleSteps.map((s, i) => {
                const ov = getStepOverride('shot-list', s.id);
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
                      ? { bgcolor: '#e91e6322', color: '#e91e63', border: '1px solid #e91e6344' }
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
                  bgcolor: i === activeIdx ? '#e91e63' : i < activeIdx ? '#22c55e' : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  transition: 'width 0.2s, background-color 0.2s',
                  '&:hover': { bgcolor: i === activeIdx ? '#e91e63' : 'rgba(255,255,255,0.35)' },
                }}
              />
            </Tooltip>
          ))}
        </Box>

        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            gap: 1,
            bgcolor: 'transparent',
          }}
        >
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
                bgcolor: '#e91e63',
                '&:hover': { bgcolor: '#c2185b' },
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
