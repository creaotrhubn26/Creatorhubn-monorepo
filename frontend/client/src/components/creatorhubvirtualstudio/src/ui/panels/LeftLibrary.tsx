import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import WbSunnyOutlinedIcon from '@mui/icons-material/WbSunnyOutlined';
import HighlightOutlinedIcon from '@mui/icons-material/HighlightOutlined';
import FlashOnOutlinedIcon from '@mui/icons-material/FlashOnOutlined';
import BlurCircularOutlinedIcon from '@mui/icons-material/BlurCircularOutlined';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import { useActions } from '@/state/selectors';
import { Button } from '@/ui/components/Button';
import { colors, spacing } from '@/styles/designTokens';

const EntryButton: React.FC<{ label: string; icon: React.ReactNode; onClick?: () => void }> = ({
  label,
  icon,
  onClick,
}) => (
  <Button
    onClick={onClick}
    variant="secondary"
    size="medium"
    sx={{
      justifyContent: 'flex-start',
      width: '100%',
      mb: spacing.sm,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
      {icon}
      <Typography fontWeight={600} fontSize={13}>{label}</Typography>
    </Box>
  </Button>
);

export default function LeftLibrary() {
  const { addNode } = useActions();
  return (
    <Box sx={{ p: 2, bgcolor: '#1a1a1a' }}>
      <Typography fontWeight={600} fontSize={14} color="#ffffff" gutterBottom>
        Lighting
      </Typography>
      <Stack spacing={1.5}>
        <EntryButton
          label="Softbox"
          icon={<WbSunnyOutlinedIcon />}
          onClick={() =>
            addNode({
              type: 'softbox',
              light: { power: 0.5, beam: 30, modifier: 'softbox', modifierSize: [0.6, 0.6] },
            })
          }
        />
        <EntryButton
          label="Umbrella"
          icon={<HighlightOutlinedIcon />}
          onClick={() =>
            addNode({
              type: 'umbrella',
              light: { power: 0.5, modifier: 'umbrella', modifierSize: [0.8, 0.8] },
            })
          }
        />
        <EntryButton
          label="Spot"
          icon={<FlashOnOutlinedIcon />}
          onClick={() =>
            addNode({
              type: 'spot',
              light: { power: 0.4, beam: 20, modifier: 'spot', modifierSize: [0.2, 0.2] },
            })
          }
        />
        <EntryButton
          label="Reflector"
          icon={<BlurCircularOutlinedIcon />}
          onClick={() =>
            addNode({
              type: 'reflector',
              light: { power: 0.5, modifier: 'reflector', modifierSize: [0.18, 0.18] },
            })
          }
        />
      </Stack>
      <Typography fontWeight={600} fontSize={14} color={colors.text.primary} sx={{ mt: spacing.md }} gutterBottom>
        Camera
      </Typography>
      <EntryButton
        label="Camera"
        icon={<CameraAltOutlinedIcon />}
        onClick={() =>
          addNode({
            type: 'camera',
            camera: {
              sensor: [36, 24],
              focalLength: 50,
              aperture: 2.8,
              iso: 100,
              shutter: 1 / 125,
            },
          })
        }
      />
      <Typography fontWeight={600} fontSize={14} color={colors.text.primary} sx={{ mt: spacing.md }} gutterBottom>
        Model
      </Typography>
      <EntryButton
        label="Model"
        icon={<PersonOutlinedIcon />}
        onClick={() => addNode({ type: 'model' })}
      />
    </Box>
  );
}
