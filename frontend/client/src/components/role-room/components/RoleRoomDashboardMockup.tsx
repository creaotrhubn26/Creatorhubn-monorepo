/**
 * RoleRoomDashboardMockup.tsx
 *
 * Realistisk-utseende CSS-mockup av Role Room-dashboardet for
 * bruk på landing-page. Tydelig MOCK-watermark slik at det er
 * synlig at det er prototype/preview-content.
 *
 * Komponenten har tre størrelse-varianter:
 *   - 'hero'    — stor, full-bredde, viser kanban + sidebar
 *   - 'feature' — medium, bare hovedpanel
 *   - 'compact' — liten, kun key metrics
 *
 * Brukes i CastingLandingPage for å konkretisere produkt-verdi.
 */

import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import EventIcon from '@mui/icons-material/Event';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CircleIcon from '@mui/icons-material/Circle';

export type MockupVariant = 'hero' | 'feature' | 'compact';

interface RoleRoomDashboardMockupProps {
  variant?: MockupVariant;
  scenario?: 'casting' | 'liveset' | 'overview';
}

const PURPLE = '#a78bfa';
const PURPLE_DARK = '#7c3aed';
const SLATE_BG = '#0f1018';
const SURFACE = 'rgba(255,255,255,0.04)';
const SURFACE_BORDER = 'rgba(255,255,255,0.08)';

const NAV_ITEMS = [
  { icon: <PersonSearchIcon fontSize="small" />, label: 'Casting', active: true, count: 12 },
  { icon: <PeopleAltIcon fontSize="small" />, label: 'Roller', count: 7 },
  { icon: <EventIcon fontSize="small" />, label: 'Auditions', count: 18 },
  { icon: <CalendarMonthIcon fontSize="small" />, label: 'Plan', count: 5 },
  { icon: <VideocamIcon fontSize="small" />, label: 'Live Set' },
  { icon: <LocationOnIcon fontSize="small" />, label: 'Lokasjoner' },
];

const KANBAN_COLUMNS = [
  {
    title: 'Søknader',
    color: '#94a3b8',
    cards: [
      { name: 'Ingvild B.', role: 'Hovedrolle Marie', tags: ['25-30', 'oslo'], status: 'ny' },
      { name: 'Trym Halvorsen', role: 'Bestevenn Eric', tags: ['20-25'], status: 'ny' },
      { name: 'Selma Wang', role: 'Hovedrolle Marie', tags: ['25-30'], status: 'ny' },
    ],
  },
  {
    title: 'Audition',
    color: '#fbbf24',
    cards: [
      { name: 'Sondre Lerche', role: 'Antagonist', tags: ['30-40', 'bergen'], status: 'i-prosess', highlight: true },
      { name: 'Aleksandra Wang', role: 'Hovedrolle Marie', tags: ['25-30', 'trondheim'], status: 'i-prosess' },
    ],
  },
  {
    title: 'Tilbakekalling',
    color: '#a78bfa',
    cards: [
      { name: 'Mathilde Holm', role: 'Hovedrolle Marie', tags: ['25-30', 'oslo'], status: 'shortlist', highlight: true },
      { name: 'Erik Strand', role: 'Bestevenn Eric', tags: ['20-25'], status: 'shortlist' },
    ],
  },
  {
    title: 'Tilbud',
    color: '#86efac',
    cards: [
      { name: 'Linnea Sørli', role: 'Hovedrolle Marie', tags: ['25-30', 'oslo'], status: 'tilbud', highlight: true },
    ],
  },
];

function MockBrowserChrome({ children, url = 'app.theroleroom.com/casting' }: { children: React.ReactNode; url?: string }) {
  return (
    <Box
      sx={{
        bgcolor: SLATE_BG,
        borderRadius: 2.5,
        border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
        boxShadow: '0 32px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.16)',
      }}
    >
      {/* Browser-chrome */}
      <Stack
        direction="row"
        spacing={1.2}
        alignItems="center"
        sx={{
          px: 1.6,
          py: 1,
          bgcolor: 'rgba(0,0,0,0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Stack direction="row" spacing={0.6}>
          <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: '#ef4444', opacity: 0.65 }} />
          <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: '#f59e0b', opacity: 0.65 }} />
          <Box sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: '#22c55e', opacity: 0.65 }} />
        </Stack>
        <Box
          sx={{
            flex: 1,
            ml: 1,
            px: 1.2,
            py: 0.4,
            bgcolor: 'rgba(255,255,255,0.04)',
            borderRadius: 1,
            border: '1px solid rgba(255,255,255,0.06)',
            fontSize: '0.74rem',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            color: 'rgba(203,213,225,0.7)',
          }}
        >
          {url}
        </Box>
      </Stack>
      {children}
    </Box>
  );
}

function MockSidebar() {
  return (
    <Box
      sx={{
        width: 180,
        flexShrink: 0,
        bgcolor: 'rgba(0,0,0,0.32)',
        borderRight: `1px solid ${SURFACE_BORDER}`,
        py: 1.6,
        px: 1.2,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.6, mb: 2 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 0.8,
            background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
          }}
        />
        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.86rem' }}>
          The Role Room
        </Typography>
      </Stack>
      <Stack spacing={0.4}>
        {NAV_ITEMS.map((item) => (
          <Stack
            key={item.label}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              px: 1,
              py: 0.7,
              borderRadius: 0.8,
              bgcolor: item.active ? 'rgba(167,139,250,0.16)' : 'transparent',
              color: item.active ? '#ddd6fe' : 'rgba(203,213,225,0.7)',
              fontSize: '0.78rem',
              transition: 'background 0.15s',
            }}
          >
            {item.icon}
            <Typography sx={{ flex: 1, fontSize: '0.8rem', fontWeight: item.active ? 600 : 500 }}>
              {item.label}
            </Typography>
            {item.count ? (
              <Box
                sx={{
                  bgcolor: item.active ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.06)',
                  color: item.active ? '#ddd6fe' : 'rgba(203,213,225,0.7)',
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  px: 0.7,
                  py: 0.15,
                  borderRadius: 0.5,
                }}
              >
                {item.count}
              </Box>
            ) : null}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function MockKanbanCard({ card }: { card: typeof KANBAN_COLUMNS[number]['cards'][number] }) {
  return (
    <Box
      sx={{
        p: 1.2,
        borderRadius: 1,
        bgcolor: card.highlight ? 'rgba(167,139,250,0.08)' : SURFACE,
        border: card.highlight ? `1px solid ${PURPLE}40` : `1px solid ${SURFACE_BORDER}`,
        cursor: 'default',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${PURPLE}, ${PURPLE_DARK})`,
            fontSize: '0.66rem',
            color: '#fff',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {card.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </Box>
        <Typography sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.72rem', flex: 1 }}>
          {card.name}
        </Typography>
      </Stack>
      <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.66rem', mb: 0.6 }}>
        {card.role}
      </Typography>
      <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
        {card.tags.map((tag) => (
          <Box
            key={tag}
            sx={{
              px: 0.6,
              py: 0.1,
              bgcolor: 'rgba(255,255,255,0.06)',
              color: 'rgba(203,213,225,0.7)',
              fontSize: '0.6rem',
              borderRadius: 0.4,
            }}
          >
            {tag}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function MockKanbanColumn({ column }: { column: typeof KANBAN_COLUMNS[number] }) {
  return (
    <Box sx={{ flex: 1, minWidth: 140 }}>
      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
        <CircleIcon sx={{ fontSize: 8, color: column.color }} />
        <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 }}>
          {column.title}
        </Typography>
        <Typography sx={{ color: 'rgba(203,213,225,0.5)', fontSize: '0.7rem', fontWeight: 600 }}>
          {column.cards.length}
        </Typography>
      </Stack>
      <Stack spacing={0.6}>
        {column.cards.map((card, i) => (
          <MockKanbanCard key={i} card={card} />
        ))}
      </Stack>
    </Box>
  );
}

function MockTopBar() {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        px: 2,
        py: 1.2,
        borderBottom: `1px solid ${SURFACE_BORDER}`,
        bgcolor: 'rgba(0,0,0,0.16)',
      }}
    >
      <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.92rem' }}>
        Bjørnemor 2026 · Casting
      </Typography>
      <Chip
        label="OPPTAK 17. JUNI"
        size="small"
        sx={{
          bgcolor: 'rgba(167,139,250,0.18)',
          color: '#ddd6fe',
          fontWeight: 700,
          fontSize: '0.62rem',
          letterSpacing: 0.5,
          height: 18,
        }}
      />
      <Box sx={{ flex: 1 }} />
      <Box
        sx={{
          px: 1.2,
          py: 0.4,
          bgcolor: SURFACE,
          border: `1px solid ${SURFACE_BORDER}`,
          borderRadius: 1,
          fontSize: '0.7rem',
          color: 'rgba(203,213,225,0.6)',
        }}
      >
        🔍 Søk kandidater …
      </Box>
      <Stack direction="row" spacing={0.6}>
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            border: '2px solid #0f1018',
          }}
        />
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
            border: '2px solid #0f1018',
            ml: -0.8,
          }}
        />
        <Box
          sx={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #34d399, #10b981)',
            border: '2px solid #0f1018',
            ml: -0.8,
          }}
        />
      </Stack>
    </Stack>
  );
}

function MockAgentToast() {
  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        maxWidth: 280,
        bgcolor: 'rgba(15,16,24,0.96)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${PURPLE}50`,
        borderRadius: 1.5,
        p: 1.4,
        boxShadow: '0 12px 32px rgba(167,139,250,0.24)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <AutoAwesomeIcon sx={{ color: PURPLE, fontSize: 18, mt: 0.2 }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ color: '#f8fafc', fontSize: '0.74rem', fontWeight: 700, mb: 0.4 }}>
            Role Room Agent
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.7rem', lineHeight: 1.45 }}>
            Mathilde matcher 8/10 kriterier — anbefaler tilbakekalling med Sondre i samme scene.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function MockWatermark() {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 5,
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          px: 1.2,
          py: 0.4,
          background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
          color: '#fff',
          fontSize: '0.62rem',
          fontWeight: 900,
          letterSpacing: 1,
          borderRadius: 0.6,
          textTransform: 'uppercase',
          boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
        }}
      >
        Mock preview
      </Box>
    </Box>
  );
}

export default function RoleRoomDashboardMockup({
  variant = 'hero',
}: RoleRoomDashboardMockupProps) {
  if (variant === 'compact') {
    return (
      <MockBrowserChrome url="app.theroleroom.com">
        <Box sx={{ position: 'relative' }}>
          <MockTopBar />
          <Box sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1}>
              {KANBAN_COLUMNS.slice(0, 3).map((col) => (
                <MockKanbanColumn key={col.title} column={col} />
              ))}
            </Stack>
          </Box>
          <MockWatermark />
        </Box>
      </MockBrowserChrome>
    );
  }

  if (variant === 'feature') {
    return (
      <MockBrowserChrome>
        <Box sx={{ position: 'relative' }}>
          <MockTopBar />
          <Box sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1}>
              {KANBAN_COLUMNS.map((col) => (
                <MockKanbanColumn key={col.title} column={col} />
              ))}
            </Stack>
          </Box>
          <MockWatermark />
        </Box>
      </MockBrowserChrome>
    );
  }

  return (
    <MockBrowserChrome>
      <Box sx={{ position: 'relative', display: 'flex' }}>
        <MockSidebar />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <MockTopBar />
          <Box sx={{ p: 1.8, position: 'relative', minHeight: 360 }}>
            <Stack direction="row" spacing={1.4}>
              {KANBAN_COLUMNS.map((col) => (
                <MockKanbanColumn key={col.title} column={col} />
              ))}
            </Stack>
            <MockAgentToast />
          </Box>
        </Box>
        <MockWatermark />
      </Box>
    </MockBrowserChrome>
  );
}
