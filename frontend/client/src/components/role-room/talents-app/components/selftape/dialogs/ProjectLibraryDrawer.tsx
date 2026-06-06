/**
 * ProjectLibraryDrawer — sidedrawer som lister talentens prosjekter,
 * lar dem bytte aktivt prosjekt eller arkivere et utgått.
 */
import {
  Box, Drawer, IconButton, Stack, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { palette, radius } from '../../../theme';
import {
  archiveProject,
  type SelftapeProject,
} from '../../../../services/roleRoomSelfTapesService';

interface Props {
  open: boolean;
  projects: SelftapeProject[];
  activeProjectId: string | null;
  onClose: () => void;
  onSelect: (projectId: string) => void;
  onChanged: () => Promise<void> | void;
}

export default function ProjectLibraryDrawer({
  open, projects, activeProjectId, onClose, onSelect, onChanged,
}: Props) {
  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Arkiver dette prosjektet? Du kan ikke endre det senere.')) return;
    try {
      await archiveProject(id);
      await onChanged();
    } catch (err) {
      console.error('archiveProject failed', err);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          bgcolor: palette.bgShell,
          color: palette.textPrimary,
          borderLeft: `1px solid ${palette.border}`,
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Prosjekt-bibliotek</Typography>
        <IconButton onClick={onClose} sx={{ color: palette.textMuted }}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ p: 2, pt: 0 }}>
        {projects.length === 0 ? (
          <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
            Ingen prosjekter ennå. Trykk «Nytt prosjekt» for å starte.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {projects.map((p) => {
              const isActive = p.id === activeProjectId;
              return (
                <Box
                  key={p.id}
                  onClick={() => {
                    onSelect(p.id);
                    onClose();
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.2,
                    p: 1.4,
                    borderRadius: radius.sm,
                    bgcolor: isActive ? 'rgba(168,85,247,0.14)' : palette.bgCard,
                    border: `1px solid ${isActive ? palette.accentBright : palette.borderSubtle}`,
                    cursor: 'pointer',
                    transition: 'background-color 0.18s, border-color 0.18s',
                    '&:hover': { borderColor: palette.borderStrong },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 46,
                      borderRadius: 0.6,
                      bgcolor: p.poster_color ?? '#1e1b4b',
                      backgroundImage: p.poster_url ? `url(${p.poster_url})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }} noWrap>
                      {p.name}
                    </Typography>
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.75rem' }} noWrap>
                      {p.role_name ?? 'Ingen rolle'} · {p.takes_count ?? 0} takes
                    </Typography>
                  </Box>
                  {isActive ? (
                    <CheckCircleIcon sx={{ color: palette.accentBright, fontSize: 18 }} />
                  ) : null}
                  {p.status !== 'archived' ? (
                    <IconButton
                      size="small"
                      onClick={(e) => handleArchive(p.id, e)}
                      sx={{ color: palette.textMuted }}
                      title="Arkiver"
                    >
                      <ArchiveOutlinedIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
