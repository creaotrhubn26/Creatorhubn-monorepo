/**
 * SelfTapeProjectInfoCard — poster + role/scene/sides + "Se brief"
 */
import { Box, Button, Stack, Typography } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { palette, radius } from '../../theme';
import type { SelftapeProject } from '../../../services/roleRoomSelfTapesService';

interface Props {
  project: SelftapeProject;
  onBriefClick: () => void;
}

export default function SelfTapeProjectInfoCard({ project, onBriefClick }: Props) {
  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: 2.4,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 64,
            height: 80,
            borderRadius: 1,
            bgcolor: project.poster_color ?? '#1e1b4b',
            backgroundImage: project.poster_url ? `url(${project.poster_url})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textAlign: 'center',
            px: 0.4,
          }}
        >
          {!project.poster_url && project.name?.toUpperCase().slice(0, 16)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Prosjekt
          </Typography>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 0.3, mb: 0.8 }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.1rem' }} noWrap>
              {project.name}
            </Typography>
            {project.status === 'active' ? (
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.6,
                  bgcolor: 'rgba(52,211,153,0.16)',
                  color: '#34d399',
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  px: 1,
                  py: 0.3,
                  borderRadius: 999,
                }}
              >
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#34d399' }} />
                Aktiv
              </Box>
            ) : null}
          </Stack>
          <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', gap: 1.4 }}>
            {project.role_name ? (
              <Stat label="Rolle" value={project.role_name} />
            ) : null}
            {project.scene_label ? (
              <Stat label="Scene" value={project.scene_label} />
            ) : null}
            {project.sides_pages ? (
              <Stat label="Sides" value={`${project.sides_pages} sider`} />
            ) : null}
          </Stack>
        </Box>
        <Button
          onClick={onBriefClick}
          startIcon={<DescriptionOutlinedIcon />}
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            color: palette.textPrimary,
            border: `1px solid ${palette.borderStrong}`,
            borderRadius: radius.sm,
            px: 1.6,
            py: 0.8,
            '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
          }}
        >
          Se brief
        </Button>
      </Stack>
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.7rem' }}>{label}</Typography>
      <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.88rem' }}>
        {value}
      </Typography>
    </Box>
  );
}
