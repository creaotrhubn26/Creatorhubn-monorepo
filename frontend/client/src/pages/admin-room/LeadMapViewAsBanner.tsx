/**
 * LeadMapViewAsBanner.tsx
 *
 * Flytende banner som lar admin forhåndsvise UI-en som en hvilken som
 * helst rolle. Brukes til å verifisere RBAC-gating uten å faktisk
 * endre admin's permissions.
 *
 * Layout:
 *   - Ikke admin-rolle: returner null (vis ingenting)
 *   - Admin uten preview: liten ikon-knapp i hjørne for å åpne picker
 *   - Admin i preview: stor advarsels-banner øverst som tydelig
 *     viser "Du forhåndsviser som <Rolle>" + Avslutt-knapp
 */

import { useState } from 'react';
import {
  Box, Button, Chip, Divider, Menu, MenuItem, Stack, Tooltip,
  Typography,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CloseIcon from '@mui/icons-material/Close';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import { usePermissions } from './usePermissions';
import LeadMapPermissionsMatrix from './LeadMapPermissionsMatrix';

const ROLE_OPTIONS: Array<{ key: string; label: string; description: string; color: string }> = [
  { key: 'salgssjef', label: 'Salgssjef', description: 'Leder hele salgsorganisasjonen', color: '#f97316' },
  { key: 'teamleder', label: 'Teamleder', description: 'Leder et salgs-team', color: '#fbbf24' },
  { key: 'salgskonsulent', label: 'Salgskonsulent', description: 'Selger leads, tilhører ett team', color: '#34d399' },
  { key: 'promotor', label: 'Promotør', description: 'Promoterer på event/feltarbeid', color: '#60a5fa' },
  { key: 'member', label: 'Medlem', description: 'Generisk skrive-tilgang', color: '#a78bfa' },
  { key: 'viewer', label: 'Leser', description: 'Kun lese-tilgang', color: '#9ca3af' },
];

export default function LeadMapViewAsBanner() {
  const { canPreview, viewAsRole, setViewAsRole, isPreviewing, permissions, roleDefaults } = usePermissions();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);

  if (!canPreview) return null;

  const previewMeta = ROLE_OPTIONS.find((r) => r.key === viewAsRole);

  if (isPreviewing && previewMeta) {
    return (
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1500,
          bgcolor: previewMeta.color,
          color: '#0a0a0f',
          py: 0.75, px: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
          <VisibilityOutlinedIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Du ser nå Lead Map som <strong>{previewMeta.label}</strong>
          </Typography>
          <Chip
            size="small"
            label={`${permissions.size} tillatelser`}
            sx={{
              bgcolor: 'rgba(0,0,0,0.15)',
              color: '#0a0a0f',
              fontWeight: 700,
              fontSize: '0.65rem',
            }}
          />
          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" sx={{ opacity: 0.85, display: { xs: 'none', sm: 'inline' } }}>
            Backend håndhever fortsatt din ekte rolle
          </Typography>
          <Button
            size="small"
            startIcon={<TableRowsOutlinedIcon />}
            onClick={() => setMatrixOpen(true)}
            sx={{
              color: '#0a0a0f',
              fontWeight: 700,
              borderColor: 'rgba(0,0,0,0.4)',
              bgcolor: 'rgba(255,255,255,0.15)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
            }}
            variant="outlined"
          >
            Sammenlign roller
          </Button>
          <Button
            size="small"
            startIcon={<CloseIcon />}
            onClick={() => setViewAsRole(null)}
            sx={{
              color: '#0a0a0f',
              fontWeight: 700,
              borderColor: 'rgba(0,0,0,0.4)',
              bgcolor: 'rgba(0,0,0,0.1)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.2)' },
            }}
            variant="outlined"
          >
            Tilbake til ekte rolle
          </Button>
        </Stack>
        <LeadMapPermissionsMatrix
          open={matrixOpen}
          onClose={() => setMatrixOpen(false)}
          highlightRole={viewAsRole}
        />
      </Box>
    );
  }

  // Leder uten preview: kompakt knapp øverst-høyre
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1, gap: 1 }}>
        <Tooltip title="Se hvilke tillatelser hver rolle har/ikke har">
          <Button
            startIcon={<TableRowsOutlinedIcon />}
            onClick={() => setMatrixOpen(true)}
            size="small"
            variant="outlined"
            sx={{
              color: 'rgba(203,213,225,0.7)',
              borderColor: 'rgba(203,213,225,0.3)',
              fontSize: '0.72rem',
              textTransform: 'none',
            }}
          >
            Sammenlign roller
          </Button>
        </Tooltip>
        <Tooltip title="Forhåndsvis Lead Map som en annen rolle">
          <Button
            startIcon={<VisibilityOutlinedIcon />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            size="small"
            variant="outlined"
            sx={{
              color: 'rgba(192,132,252,0.85)',
              borderColor: 'rgba(192,132,252,0.4)',
              fontSize: '0.72rem',
              textTransform: 'none',
            }}
          >
            Forhåndsvis som …
          </Button>
        </Tooltip>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
          slotProps={{ paper: { sx: { minWidth: 320 } } }}
        >
          <MenuItem disabled>
            <Stack>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Forhåndsvis Lead Map som …
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Du ser hva denne rollen ser. Backend håndhever fortsatt din ekte rolle.
              </Typography>
            </Stack>
          </MenuItem>
          <Divider />
          {ROLE_OPTIONS.map((r) => {
            const permCount = (roleDefaults[r.key] ?? []).length;
            return (
              <MenuItem
                key={r.key}
                onClick={() => {
                  setViewAsRole(r.key);
                  setAnchorEl(null);
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
                  <Box
                    sx={{
                      width: 10, height: 10, borderRadius: '50%',
                      bgcolor: r.color,
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <Stack flexGrow={1}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {r.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.description}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label={`${permCount}`}
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 18 }}
                  />
                </Stack>
              </MenuItem>
            );
          })}
          <Divider />
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              setMatrixOpen(true);
            }}
            sx={{ color: 'primary.main' }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <TableRowsOutlinedIcon fontSize="small" />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Se full sammenligning …
              </Typography>
            </Stack>
          </MenuItem>
        </Menu>
      </Box>
      <LeadMapPermissionsMatrix
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
      />
    </>
  );
}
