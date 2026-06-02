/**
 * RoleRoomAgentIcon — det branded agent-ikonet (lilla neon).
 *
 * `working` slår på en pulserende glød + lett scale slik at ikonet «lever»
 * mens agenten jobber (research/generering). Brukes både i dialog-headeren og
 * som start-ikon på launch-knappene.
 */
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import roleRoomAgentIcon from '@/assets/role-room-agent-icon.png';

export function RoleRoomAgentIcon({
  size = 24,
  working = false,
  sx,
}: {
  size?: number;
  working?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      component="img"
      src={roleRoomAgentIcon}
      alt="The Role Room Agent"
      sx={{
        width: size,
        height: size,
        borderRadius: `${Math.round(size * 0.22)}px`,
        objectFit: 'cover',
        display: 'block',
        flexShrink: 0,
        ...(working
          ? {
              animation: 'rrAgentWorking 1.5s ease-in-out infinite',
              '@keyframes rrAgentWorking': {
                '0%, 100%': {
                  filter: 'drop-shadow(0 0 2px rgba(168,85,247,0.45))',
                  transform: 'scale(1)',
                },
                '50%': {
                  filter: 'drop-shadow(0 0 11px rgba(192,96,241,0.95))',
                  transform: 'scale(1.07)',
                },
              },
            }
          : { filter: 'drop-shadow(0 0 3px rgba(168,85,247,0.3))' }),
        ...sx,
      }}
    />
  );
}

export default RoleRoomAgentIcon;
