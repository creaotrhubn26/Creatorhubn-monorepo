/**
 * MobileNavDrawer — hele workspace-navigasjonen på mobil.
 *
 * Sidebaren skjules under 768 px, og bunn-navigasjonen har plass til
 * fem oppføringer. Den femte het «Meny», men navigerte til
 * Innstillinger — så på mobil fantes det bokstavelig talt ingen vei til
 * Saker, Kalender, Prosjekter, Dokumenter, HR eller noe annet. 27 av 32
 * flater var uten inngang.
 *
 * Drawer-en leser samme `buildNavSections` som sidebaren, slik at de to
 * ikke kan komme i utakt igjen.
 */

import {
  Badge,
  Box,
  Chip,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { BRAND } from './brand';
import { buildNavSections } from './navSections';
import { ADMIN_PRODUCTS, type AdminProductId, type WorkspaceItemId } from './workspaceItems';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  selected: WorkspaceItemId;
  onSelect: (id: WorkspaceItemId) => void;
  inboxBadge: number;
  product: AdminProductId;
  onProductChange: (p: AdminProductId) => void;
  onOpenPalette: () => void;
}

export function MobileNavDrawer({
  open,
  onClose,
  selected,
  onSelect,
  inboxBadge,
  product,
  onProductChange,
  onOpenPalette,
}: MobileNavDrawerProps) {
  const sections = buildNavSections(inboxBadge);

  const pick = (id: WorkspaceItemId) => {
    onSelect(id);
    onClose();
  };

  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: 280,
            bgcolor: BRAND.sidebarBg,
            backgroundImage: 'none',
            borderRight: `1px solid ${BRAND.border}`,
          },
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BRAND.border}` }}
      >
        <Box>
          <Typography sx={{ color: BRAND.text, fontWeight: 800, fontSize: '0.94rem' }}>
            Creatorhub AS
          </Typography>
          <Typography sx={{ color: BRAND.textDim, fontSize: '0.72rem' }}>
            Admin workspace
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Lukk meny" sx={{ color: BRAND.textMuted }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Produkt-velger — samme kontroll som på desktop */}
      <Stack spacing={0.75} sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${BRAND.border}` }}>
        <Typography
          sx={{
            color: BRAND.textDim,
            fontSize: '0.66rem',
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          Produkt
        </Typography>
        <Stack direction="row" spacing={0.5}>
          {ADMIN_PRODUCTS.map((p) => {
            const isActive = p.id === product;
            return (
              <Chip
                key={p.id}
                label={p.label}
                onClick={() => onProductChange(p.id)}
                size="small"
                sx={{
                  flex: 1,
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  color: isActive ? '#fff' : BRAND.textMuted,
                  bgcolor: isActive ? p.color : 'transparent',
                  border: `1px solid ${isActive ? p.color : BRAND.border}`,
                }}
              />
            );
          })}
        </Stack>
      </Stack>

      {/* Hopp-til: paletten er tastatur-drevet på desktop, men trengs
          like mye her når listen er lang. */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        component="button"
        onClick={() => {
          onClose();
          onOpenPalette();
        }}
        sx={{
          mx: 2,
          my: 1.5,
          px: 1.25,
          py: 0.75,
          borderRadius: 1.5,
          cursor: 'pointer',
          bgcolor: 'rgba(167, 139, 250, 0.06)',
          border: `1px solid ${BRAND.border}`,
          color: BRAND.textDim,
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        <SearchOutlinedIcon sx={{ fontSize: 16 }} />
        <Typography sx={{ fontSize: '0.8rem' }}>Hopp til flate…</Typography>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', pb: 2 }}>
        {sections.map((section) => (
          <Box key={section.id} sx={{ mb: 1 }}>
            {section.label ? (
              <Typography
                sx={{
                  color: BRAND.textDim,
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  px: 2,
                  py: 0.5,
                }}
              >
                {section.label}
              </Typography>
            ) : null}
            {section.items.map((item) => {
              const isSelected = item.id === selected;
              return (
                <Stack
                  key={item.id}
                  component="button"
                  direction="row"
                  alignItems="center"
                  spacing={1.25}
                  onClick={() => pick(item.id)}
                  aria-current={isSelected ? 'page' : undefined}
                  sx={{
                    width: 'calc(100% - 16px)',
                    mx: 1,
                    px: 1.5,
                    py: 1,
                    border: 'none',
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                    color: isSelected ? BRAND.text : BRAND.textMuted,
                    bgcolor: isSelected ? BRAND.selectedBg : 'transparent',
                    '& svg': { fontSize: 20 },
                  }}
                >
                  {item.icon}
                  <Typography sx={{ flex: 1, fontSize: '0.88rem', fontWeight: isSelected ? 700 : 500 }}>
                    {item.label}
                  </Typography>
                  {item.badge && item.badge > 0 ? (
                    <Badge
                      badgeContent={item.badge > 99 ? '99+' : item.badge}
                      sx={{
                        mr: 1,
                        '& .MuiBadge-badge': {
                          position: 'static',
                          transform: 'none',
                          bgcolor: BRAND.accentStrong,
                          color: '#fff',
                          fontSize: '0.64rem',
                        },
                      }}
                    />
                  ) : null}
                </Stack>
              );
            })}
          </Box>
        ))}

        <Box sx={{ borderTop: `1px solid ${BRAND.border}`, mt: 1, pt: 1 }}>
          <Stack
            component="button"
            direction="row"
            alignItems="center"
            spacing={1.25}
            onClick={() => pick('settings')}
            aria-current={selected === 'settings' ? 'page' : undefined}
            sx={{
              width: 'calc(100% - 16px)',
              mx: 1,
              px: 1.5,
              py: 1,
              border: 'none',
              borderRadius: 1.5,
              cursor: 'pointer',
              font: 'inherit',
              textAlign: 'left',
              color: selected === 'settings' ? BRAND.text : BRAND.textMuted,
              bgcolor: selected === 'settings' ? BRAND.selectedBg : 'transparent',
              '& svg': { fontSize: 20 },
            }}
          >
            <SettingsOutlinedIcon />
            <Typography sx={{ fontSize: '0.88rem' }}>Innstillinger</Typography>
          </Stack>
        </Box>
      </Box>
    </Drawer>
  );
}

export default MobileNavDrawer;
