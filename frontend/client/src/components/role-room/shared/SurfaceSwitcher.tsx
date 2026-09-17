/**
 * SurfaceSwitcher — vei mellom appene i The Role Room.
 *
 * Talents, produksjon og utdanning er separate flater på samme domene, og
 * alle tre er allerede nåbare på URL. Problemet var at ingenting i
 * grensesnittet pekte på dem: en innlogget produsent fant aldri Talents, og
 * en talent kom seg ikke ut av sin egen app uten å logge ut.
 *
 * Komponenten viser bare flater sesjonen allerede har lov til å åpne — den
 * gir ingen ny tilgang. Admin Room er eneste unntak og krever produkteier,
 * bekreftet av serveren.
 */
import { useState } from 'react';
import { Box, Chip, ListItemIcon, Menu, MenuItem, Stack, Typography } from '@mui/material';
import MovieCreationOutlinedIcon from '@mui/icons-material/MovieCreationOutlined';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import AppsIcon from '@mui/icons-material/Apps';

import { useSuperAdminGate } from '../components/admin/useSuperAdminGate';
import { ROLE_ROOM_EDUCATION_PATH } from '../utils/runtime';

interface Surface {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  /** Sann når stien peker hit. */
  matches: (pathname: string, search: string) => boolean;
  superAdminOnly?: boolean;
}

const SURFACES: Surface[] = [
  {
    id: 'production',
    label: 'Produksjon',
    description: 'Prosjekter, team, opptaksdager og leveranser.',
    href: '/',
    icon: <MovieCreationOutlinedIcon fontSize="small" />,
    matches: (pathname, search) =>
      !pathname.startsWith('/talents')
      && !pathname.startsWith(ROLE_ROOM_EDUCATION_PATH)
      && !search.includes('lens=admin'),
  },
  {
    id: 'talents',
    label: 'Talents',
    description: 'Din profil, CV, self-tapes og hvem som har sett deg.',
    href: '/talents',
    icon: <PersonSearchOutlinedIcon fontSize="small" />,
    matches: (pathname) => pathname.startsWith('/talents'),
  },
  {
    id: 'education',
    label: 'Utdanning',
    description: 'Kull, studentproduksjoner og faglæreroversikt.',
    href: ROLE_ROOM_EDUCATION_PATH,
    icon: <SchoolOutlinedIcon fontSize="small" />,
    matches: (pathname) => pathname.startsWith(ROLE_ROOM_EDUCATION_PATH),
  },
  {
    id: 'admin',
    label: 'Admin Room',
    description: 'Tilgang, lagring og plattformstatus.',
    href: '/?lens=admin',
    icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
    matches: (_pathname, search) => search.includes('lens=admin'),
    superAdminOnly: true,
  },
];

export function SurfaceSwitcher(): JSX.Element | null {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { isSuperAdmin } = useSuperAdminGate();

  if (typeof window === 'undefined') return null;
  const pathname = (window.location.pathname || '').toLowerCase();
  const search = (window.location.search || '').toLowerCase();

  const visible = SURFACES.filter((surface) => !surface.superAdminOnly || isSuperAdmin);
  const current = visible.find((surface) => surface.matches(pathname, search)) ?? visible[0];

  return (
    <>
      <Chip
        icon={<AppsIcon sx={{ fontSize: 16 }} />}
        label={
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {current?.label ?? 'Flate'}
          </Typography>
        }
        onClick={(event) => setAnchorEl(event.currentTarget)}
        aria-haspopup="menu"
        aria-label="Bytt flate"
        sx={{
          bgcolor: 'rgba(148,163,184,0.14)',
          color: 'rgba(226,232,240,0.95)',
          border: '1px solid rgba(148,163,184,0.28)',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(148,163,184,0.22)' },
        }}
      />
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <Typography
          variant="caption"
          sx={{ px: 2, py: 1, display: 'block', color: 'rgba(148,163,184,0.85)' }}
        >
          BYTT FLATE
        </Typography>
        {visible.map((surface) => (
          <MenuItem
            key={surface.id}
            selected={surface.id === current?.id}
            onClick={() => {
              setAnchorEl(null);
              if (surface.id !== current?.id) window.location.assign(surface.href);
            }}
            sx={{ alignItems: 'flex-start', py: 1 }}
          >
            <ListItemIcon sx={{ mt: 0.3 }}>{surface.icon}</ListItemIcon>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {surface.label}
                </Typography>
                {surface.id === current?.id && (
                  <Typography variant="caption" sx={{ color: 'rgba(148,163,184,0.8)' }}>
                    du er her
                  </Typography>
                )}
              </Stack>
              <Typography variant="caption" sx={{ color: 'rgba(148,163,184,0.8)' }}>
                {surface.description}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export default SurfaceSwitcher;
