/**
 * SelfTapeSubmissionTargets — 3 target-cards (Agency direct / Private link / Role-specific)
 *
 * Hver card viser: ikon + label + sekundærtekst + "Send"-knapp (eller
 * "Sendt"-pille hvis allerede sendt).
 *
 * Fase B: viser kun listen + lokal "kopier-link" handler.
 * Fase D: kobler "Send" til /submissions/:id/send.
 */
import { Box, Stack, Typography } from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import RecordVoiceOverOutlinedIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { palette, radius } from '../../theme';
import {
  sendSubmission,
  type SelftapeSubmission,
} from '../../../services/roleRoomSelfTapesService';

interface Props {
  submissions: SelftapeSubmission[];
  onChange: () => Promise<void> | void;
}

function iconForType(type: string) {
  if (type === 'agency_direct') return BusinessOutlinedIcon;
  if (type === 'private_link') return LinkOutlinedIcon;
  return RecordVoiceOverOutlinedIcon;
}

function labelForSubmission(t: SelftapeSubmission): { title: string; sub: string } {
  if (t.target_type === 'agency_direct') {
    return {
      title: t.agency_name ?? 'Mitt byrå',
      sub: t.agency_preferred ? 'Foretrukket · sendes direkte' : 'Send direkte til byrå-team',
    };
  }
  if (t.target_type === 'private_link') {
    return {
      title: 'Privat lenke',
      sub: t.private_token ? 'Aktiv lenke · klikk for å kopiere' : 'Generer lenke',
    };
  }
  return {
    title: t.casting_project_name ?? 'Spesifikk rolle',
    sub: 'Send som offisiell søknad',
  };
}

export default function SelfTapeSubmissionTargets({ submissions, onChange }: Props) {
  const handleSend = async (t: SelftapeSubmission) => {
    try {
      await sendSubmission(t.id);
      await onChange();
    } catch (err) {
      console.error('sendSubmission failed', err);
    }
  };

  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: 2.2,
      }}
    >
      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem', mb: 1.6 }}>
        Send til
      </Typography>
      <Stack spacing={1}>
        {submissions.map((t) => {
          const Icon = iconForType(t.target_type);
          const { title, sub } = labelForSubmission(t);
          const isSubmitted = !!t.submitted_at || t.status === 'submitted'
            || t.status === 'viewed' || t.status === 'shortlisted';
          return (
            <Box
              key={t.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.4,
                p: 1.2,
                borderRadius: radius.sm,
                border: `1px solid ${palette.borderSubtle}`,
                transition: 'background-color 0.18s, border-color 0.18s',
                '&:hover': { bgcolor: 'rgba(168,85,247,0.06)', borderColor: palette.borderStrong },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: 'rgba(168,85,247,0.16)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ color: palette.accentBright, fontSize: 'small' }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.88rem' }} noWrap>
                  {title}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }} noWrap>
                  {sub}
                </Typography>
              </Box>
              {isSubmitted ? (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.4}
                  sx={{
                    bgcolor: 'rgba(52,211,153,0.16)',
                    color: '#34d399',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    px: 1,
                    py: 0.3,
                    borderRadius: 999,
                  }}
                >
                  <CheckCircleOutlineIcon sx={{ fontSize: 12 }} />
                  Sendt
                </Stack>
              ) : (
                <Box
                  component="button"
                  onClick={() => handleSend(t)}
                  sx={{
                    background: palette.accentGradient,
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    px: 1.6,
                    py: 0.6,
                    borderRadius: radius.sm,
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  }}
                >
                  Send
                </Box>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
