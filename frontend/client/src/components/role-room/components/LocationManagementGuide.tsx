/**
 * LocationManagementGuide.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * In-app walkthrough guide for the Location Management Panel.
 *
 * Renders as a full-screen Dialog with a two-column layout:
 *   Left  — sticky step navigator (clickable)
 *   Right — scrollable content with screenshot placeholders
 *
 * 10 steps covering: overview, adding locations, grid/table views,
 * categories sidebar, search & filters, statistics, favorites,
 * bulk operations, status workflow, and export & shortcuts.
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
  Place as PlaceIcon,
  Add as AddIcon,
  ViewModule as GridIcon,
  Category as CategoryIcon,
  Search as SearchIcon,
  BarChart as StatsIcon,
  Star as FavIcon,
  SelectAll as BulkIcon,
  CheckCircle as StatusFlowIcon,
  FileDownload as ExportIcon,
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
  color = '#4caf50',
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
        color: '#4caf50',
        borderColor: 'rgba(76,175,80,0.4)',
        bgcolor: 'rgba(76,175,80,0.06)',
        '&:hover': {
          borderColor: '#4caf50',
          bgcolor: 'rgba(76,175,80,0.14)',
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

const ACCENT = '#4caf50';

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
        heading: 'What is the Location Management Panel?',
        screenshotLabel: 'Full panel — header, stats, grid cards',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The <strong>Location Management Panel</strong> (Produksjonssteder) is where you manage
              all filming locations for your project. Each location stores its name, address,
              type, capacity, facilities, contact info, status, notes, and assigned scenes.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              The panel offers <strong>grid</strong> and <strong>table</strong> view modes,
              a collapsible <strong>statistics panel</strong>, a <strong>categories sidebar</strong>,
              full-text <strong>search &amp; filters</strong>, <strong>favorites</strong>,
              <strong>bulk operations</strong>, <strong>status workflow</strong>,
              <strong>address validation</strong> via Kartverket, and <strong>PDF export</strong>.
            </Typography>
            <CtaButton label="Vis statistikkpanelet" action="toggle-stats" onAction={onAction} icon={<StatsIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Panel layout',
        screenshotLabel: 'Header bar with title, stats toggle, and add button',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1 }}>
              The panel is organised top-to-bottom:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Header row</strong> — title, print button, stats toggle, "Legg til lokasjon" button</li>
              <li><strong>Statistics panel</strong> — collapsible bar with KPI cards</li>
              <li><strong>Search &amp; filter bar</strong> — text search, category toggle, filter toggle, view mode</li>
              <li><strong>Categories sidebar</strong> — optional left panel with type/status filters &amp; favorite count</li>
              <li><strong>Main content</strong> — grid or table of location cards</li>
              <li><strong>Bulk action bar</strong> — sticky bottom bar when items are selected</li>
              <li><strong>Footer indicators</strong> — security &amp; status badges</li>
            </Box>
          </>
        ),
      },
    ],
  },

  // ── 2 · Adding locations ──────────────────────────────────────────────────
  {
    id: 'adding-locations',
    label: 'Adding Locations',
    icon: <AddIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Creating a new location',
        screenshotLabel: 'Create location dialog — form fields',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Click the green <strong>"Legg til lokasjon"</strong> button (or press <Key>Ctrl</Key>+<Key>N</Key>)
              to open the creation dialog. Fill in:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Navn</strong> (required) — the location name</li>
              <li><strong>Adresse</strong> — street address, with a <em>Valider adresse</em> button that calls the Kartverket API to resolve coordinates and property ID</li>
              <li><strong>Type</strong> — Studio, Outdoor, Indoor, Virtual, or Other</li>
              <li><strong>Status</strong> — Vurderes (Evaluating), Godkjent (Approved), or Avvist (Rejected)</li>
              <li><strong>Beskrivelse</strong> — freeform description</li>
              <li><strong>Nettside</strong> — URL for the location's website</li>
              <li><strong>Kapasitet</strong> — person capacity</li>
              <li><strong>Fasiliteter</strong> — toggle checkboxes for Parking, Restrooms, Catering, Wi-Fi, Power, Dressing rooms</li>
              <li><strong>Kontakt</strong> — name &amp; phone number</li>
              <li><strong>Notater</strong> — additional notes</li>
            </Box>
          </>
        ),
      },
      {
        heading: 'Editing & duplicating',
        screenshotLabel: 'Edit dialog with pre-filled fields, duplicate button on card',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Click the <strong>edit</strong> icon on any card or table row to re-open the dialog
              with pre-filled data. Changes are saved optimistically — the card updates
              instantly without a full refetch.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              The <strong>duplicate</strong> button clones a location with a new ID and appends
              "(kopi)" to its name. Useful for creating variants of the same venue.
            </Typography>
            <Callout>
              Address validation via Kartverket also resolves GPS coordinates. These are
              used later by the <em>Location Analysis</em> for weather, drone, and access reports.
            </Callout>
            <CtaButton label="Legg til en lokasjon nå" action="open-add-dialog" onAction={onAction} icon={<AddIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 3 · Grid & Table views ────────────────────────────────────────────────
  {
    id: 'views',
    label: 'Grid & Table Views',
    icon: <GridIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Grid view (cards)',
        screenshotLabel: 'Grid of location cards with type-coloured headers',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The default <strong>grid view</strong> shows a responsive card layout
              (1 col mobile, 2 tablet, 3 desktop, 4 large). Each card displays:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li>Gradient header with <strong>type-specific colour</strong></li>
              <li>Selection checkbox (top-left)</li>
              <li>Name, type chip, capacity, <strong>status chip</strong> (Evaluating/Approved/Rejected)</li>
              <li>Address with <strong>copy-to-clipboard</strong> button</li>
              <li>Coordinates, facility icons (Wi-Fi, parking, etc.), website link</li>
              <li>Assigned scenes count</li>
              <li><strong>Expandable section</strong> — notes, contact name &amp; phone (clickable <code>tel:</code> link)</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1 }}>
              Card action buttons: <strong>Info</strong> (expand/collapse), <strong>Analyze</strong> (opens analysis dialog),
              <strong>Duplicate</strong>, <strong>Edit</strong>, <strong>Delete</strong>.
            </Typography>
            <CtaButton label="Bytt til rutenettvisning" action="switch-grid" onAction={onAction} icon={<GridIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Table view',
        screenshotLabel: 'Table view with sortable columns and row actions',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Toggle to <strong>table view</strong> using the table icon in the toolbar.
              The table has <strong>sortable columns</strong>:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Navn</strong> (Name)</li>
              <li><strong>Type</strong> — with coloured chip</li>
              <li><strong>Adresse</strong> (Address)</li>
              <li><strong>Kapasitet</strong> (Capacity)</li>
              <li><strong>Scener</strong> (Assigned Scenes count)</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1 }}>
              Click any column header to sort ascending/descending. Each row has a checkbox
              for bulk selection and action buttons for <strong>favourite toggle</strong>,
              <strong>duplicate</strong>, <strong>edit</strong>, and <strong>delete</strong>.
            </Typography>
            <CtaButton label="Bytt til tabellvisning" action="switch-table" onAction={onAction} />
          </>
        ),
      },
    ],
  },

  // ── 4 · Categories sidebar ────────────────────────────────────────────────
  {
    id: 'categories-sidebar',
    label: 'Categories Sidebar',
    icon: <CategoryIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Type filters',
        screenshotLabel: 'Categories sidebar — type filter buttons with counts',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Toggle the <strong>categories sidebar</strong> using the label icon in the toolbar.
              The sidebar shows a vertical list of <strong>type filter</strong> buttons, each
              displaying the location type and a count badge:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Alle typer</strong> (All types) — shows total</li>
              <li><strong>Studio</strong>, <strong>Utendørs</strong>, <strong>Innendørs</strong>, <strong>Virtuell</strong>, <strong>Annet</strong> — each with count</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1 }}>
              Click any type to filter the main view to only that type.
              The active type is highlighted with its accent colour.
            </Typography>
            <CtaButton label="Åpne kategori-sidepanelet" action="show-categories" onAction={onAction} icon={<CategoryIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Status filters & favorites count',
        screenshotLabel: 'Sidebar — status section and favorites badge',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Below the type filters, a <strong>status filter</strong> section offers:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Alle statuser</strong> — no status filter</li>
              <li><strong>Vurderes</strong> (Evaluating) — orange, count badge</li>
              <li><strong>Godkjent</strong> (Approved) — green, count badge</li>
              <li><strong>Avvist</strong> (Rejected) — red, count badge</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1 }}>
              At the bottom, a <strong>favorites count</strong> badge shows how many locations
              you have starred. Both type and status filters can be combined with the
              search query for precise filtering.
            </Typography>
          </>
        ),
      },
    ],
  },

  // ── 5 · Search & Filters ──────────────────────────────────────────────────
  {
    id: 'search-filters',
    label: 'Search & Filters',
    icon: <SearchIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Full-text search',
        screenshotLabel: 'Search bar with type-ahead matching',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The search field matches against <strong>name</strong>, <strong>address</strong>,
              <strong>type</strong>, <strong>notes</strong>, and <strong>description</strong>
              simultaneously. Results update in real-time as you type.
            </Typography>
            <Callout>
              Search is case-insensitive and matches partial strings. Favourited locations
              always sort to the top of the results.
            </Callout>
            <CtaButton label="Åpne filterpanelet" action="open-filters" onAction={onAction} icon={<SearchIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Filter panel',
        screenshotLabel: 'Collapsible filter panel with type dropdown',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Click the <strong>filter icon</strong> to expand the inline filter panel.
              Use the <strong>type dropdown</strong> to filter by Studio, Outdoor, Indoor,
              Virtual, Other, or Alle (all).
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              The <strong>"Nullstill"</strong> (Reset) button clears all active filters and search in one click.
              You can also use the categories sidebar for the same filtering with a more visual layout.
            </Typography>
          </>
        ),
      },
    ],
  },

  // ── 6 · Statistics panel ──────────────────────────────────────────────────
  {
    id: 'statistics',
    label: 'Statistics Panel',
    icon: <StatsIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'At-a-glance KPIs',
        screenshotLabel: 'Statistics bar — Total, Capacity, Coordinates, Favorites, Assessed, type breakdown',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The collapsible statistics panel shows six key metrics:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Totalt</strong> — total number of locations</li>
              <li><strong>Total kapasitet</strong> — sum of all location capacities</li>
              <li><strong>Med koordinater</strong> — locations with GPS coordinates</li>
              <li><strong>Favoritter</strong> — starred locations</li>
              <li><strong>Vurdert</strong> — locations with a definitive status (Approved + Rejected)</li>
              <li><strong>Per-type breakdown</strong> — up to 4 type counts on desktop</li>
            </Box>
            <Callout>
              Toggle the statistics panel on/off with the chart icon button in the header.
              All values update live as you add, edit, or delete locations.
            </Callout>
            <CtaButton label="Vis/skjul statistikk" action="toggle-stats" onAction={onAction} icon={<StatsIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 7 · Favorites ─────────────────────────────────────────────────────────
  {
    id: 'favorites',
    label: 'Favorites',
    icon: <FavIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Starring locations',
        screenshotLabel: 'Card with star icon highlighted',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Click the <strong>star icon</strong> on any card or table row to favourite
              a location. Favourited locations are sorted to the <strong>top</strong> of the
              list in both grid and table views.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              The categories sidebar shows a <strong>favorites count</strong>, and the
              statistics panel tracks the number as a KPI.
            </Typography>
            <CtaButton label="Merk din første favoritt" action="toggle-favorite" onAction={onAction} icon={<FavIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Persistence & sync',
        screenshotLabel: 'Footer indicator — "Debounced favorittlagring"',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Favorites are <strong>dual-persisted</strong>: saved to the database via the
              Favorites API and cached locally via the settings service. A <strong>500 ms
              debounce</strong> prevents excessive writes while toggling rapidly.
            </Typography>
            <Callout>
              The footer status indicator shows "Debounced favorittlagring" with a green
              dot when idle and an orange dot ("Lagrer...") while a save is in-flight.
            </Callout>
          </>
        ),
      },
    ],
  },

  // ── 8 · Bulk operations ───────────────────────────────────────────────────
  {
    id: 'bulk-operations',
    label: 'Bulk Operations',
    icon: <BulkIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Selecting items',
        screenshotLabel: 'Grid with checkboxes selected, bulk bar visible at bottom',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Check the <strong>checkbox</strong> on individual cards (top-left) or table
              rows to select them. The sticky <strong>bulk action bar</strong> appears at
              the bottom showing:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Velg alle / Fjern alle</strong> — select or deselect all visible locations</li>
              <li><strong>Sett status</strong> — batch-change status to Evaluating/Approved/Rejected</li>
              <li><strong>Fjern N</strong> — delete all selected locations with confirmation</li>
              <li><strong>Tilknytt hendelse</strong> — assign selected locations to a project event</li>
              <li><strong>Eksporter PDF</strong> — export selected locations as a printable PDF</li>
            </Box>
            <CtaButton label="Velg alle lokasjoner" action="select-all" onAction={onAction} icon={<BulkIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Bulk delete with undo',
        screenshotLabel: 'Footer area — Undo last / Undo all / Retry failed buttons',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Bulk deletions use <code>Promise.allSettled</code> for parallel execution.
              The system tracks <strong>succeeded</strong> and <strong>failed</strong> deletions
              separately and stores an <strong>undo history</strong> (up to 20 records).
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              After a bulk delete, footer controls appear:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Angre siste</strong> — undo the most recent batch</li>
              <li><strong>Angre alle</strong> — undo all batches in history</li>
              <li><strong>Prøv igjen</strong> — retry only the failed deletions</li>
            </Box>
          </>
        ),
      },
      {
        heading: 'Single delete with undo',
        screenshotLabel: 'Snackbar with undo button after single delete',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              Deleting a single location shows a <strong>snackbar</strong> with an <strong>Angre</strong> (Undo)
              button. Click it within the timeout to restore the location immediately.
            </Typography>
            <Callout color="#ff9800">
              Both single and bulk undo restore the full location object, including coordinates,
              facilities, and assigned scenes — nothing is lost.
            </Callout>
          </>
        ),
      },
    ],
  },

  // ── 9 · Status workflow ───────────────────────────────────────────────────
  {
    id: 'status-workflow',
    label: 'Status Workflow',
    icon: <StatusFlowIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'Three-state workflow',
        screenshotLabel: 'Status chips on cards — Evaluating, Approved, Rejected',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Every location has a <strong>status</strong> field with three states:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong style={{ color: '#ff9800' }}>Vurderes</strong> (Evaluating) — default status for new locations, shown as an orange chip</li>
              <li><strong style={{ color: '#4caf50' }}>Godkjent</strong> (Approved) — location is confirmed, green chip</li>
              <li><strong style={{ color: '#f44336' }}>Avvist</strong> (Rejected) — location is rejected, red chip</li>
            </Box>
          </>
        ),
      },
      {
        heading: 'Changing status',
        screenshotLabel: 'Set Status dialog with three radio options',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Status can be set in two ways:
            </Typography>
            <Box component="ol" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><strong>Edit dialog</strong> — select a status from the dropdown when creating or editing a location</li>
              <li><strong>Bulk action bar</strong> — select multiple locations, click "Sett status", and choose a status to apply to all selected</li>
            </Box>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mt: 1 }}>
              The sidebar's <strong>status filter</strong> section lets you quickly view
              only locations in a specific status. Great for reviewing all "Vurderes"
              locations before a production meeting.
            </Typography>
            <CtaButton label="Filtrer etter 'Vurderes'" action="filter-evaluating" onAction={onAction} icon={<StatusFlowIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
    ],
  },

  // ── 10 · Export & Shortcuts ───────────────────────────────────────────────
  {
    id: 'export-shortcuts',
    label: 'Export & Shortcuts',
    icon: <ExportIcon sx={{ fontSize: 16 }} />,
    sections: [
      {
        heading: 'PDF export',
        screenshotLabel: 'Print preview window with styled location table',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              The <strong>"Skriv ut lokasjoner"</strong> button (or <Key>Ctrl</Key>+<Key>E</Key>)
              generates a complete HTML document with:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li>Project name and generation date</li>
              <li>Summary cards (total, with coordinates, with scenes, total capacity)</li>
              <li>Full location table with type, address, capacity, facilities, and scenes</li>
              <li>Print-optimised CSS (page breaks, compact fonts)</li>
            </Box>
            <Callout>
              All exported text uses HTML entity escaping for security — no risk of
              script injection. The footer indicator "Sikre PDF-eksporter" confirms this.
            </Callout>
            <CtaButton label="Eksporter PDF nå" action="export-pdf" onAction={onAction} icon={<ExportIcon sx={{ fontSize: 16 }} />} />
          </>
        ),
      },
      {
        heading: 'Keyboard shortcuts',
        screenshotLabel: 'Keyboard shortcut reference card',
        body: (
          <>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, mb: 1.5 }}>
              Available keyboard shortcuts:
            </Typography>
            <Box component="ul" sx={{ pl: 2.5, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.8, m: 0 }}>
              <li><Key>Ctrl</Key>+<Key>N</Key> — open the "New Location" dialog</li>
              <li><Key>Ctrl</Key>+<Key>E</Key> — trigger PDF export</li>
              <li><Key>Escape</Key> — close the active dialog</li>
            </Box>
          </>
        ),
      },
    ],
  },
]
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface LocationManagementGuideProps {
  open: boolean;
  onClose: () => void;
  /** If provided, the guide opens directly to this step. */
  initialStepId?: string;
  /** Called when the user clicks a "Try it now" CTA button inside a step. */
  onAction?: (action: string) => void;
}

export function LocationManagementGuide({ open, onClose, initialStepId, onAction }: LocationManagementGuideProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));

  // ── Admin guide config ──────────────────────────────────────────────
  const { getGuideConfig, getStepOverride, getActiveStepIds } = useVisualEditor();
  const steps = buildSteps(onAction);
  const guideConfig  = getGuideConfig('location-management');
  const activeIds    = getActiveStepIds('location-management');
  const visibleSteps = activeIds.length > 0
    ? (activeIds.map(id => steps.find(s => s.id === id)).filter(Boolean) as Step[])
    : steps;

  const [activeStepId, setActiveStepId] = useState(initialStepId ?? visibleSteps[0].id);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeStep = visibleSteps.find((s) => s.id === activeStepId) ?? visibleSteps[0];
  const activeIdx  = visibleSteps.findIndex((s) => s.id === activeStepId);
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
        <PlaceIcon sx={{ color: accentColor, fontSize: 20 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>
            Location Management — How it works
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
                const ov = getStepOverride('location-management', step.id);
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
                const ov = getStepOverride('location-management', s.id);
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
                '&:hover': { bgcolor: '#388e3c' },
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
