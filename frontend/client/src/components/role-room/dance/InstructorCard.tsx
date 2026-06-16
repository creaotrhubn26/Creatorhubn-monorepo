/**
 * InstructorCard — visuelt instruktør-kort for "instructors"-fanen i
 * DanceWorkspace. Porter overlay-designet (rr-dance-instruktor): avatar,
 * navn, spesialitet, elevvurdering (stjerner) og neste klasse.
 *
 * Leser felter fra dance_instructor (mig 0153): specialtyText, avatarUrl,
 * ratingAvg, ratingCount, nextClassText. Faller pent tilbake når de er null
 * (initialer i stedet for avatar, skjuler rating/neste-klasse hvis tomt).
 */

import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarHalfRoundedIcon from '@mui/icons-material/StarHalfRounded';
import StarOutlineRoundedIcon from '@mui/icons-material/StarOutlineRounded';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { danceFlowColors } from './danceFlowTheme';
import type { DanceInstructor } from './danceStudioOpsService';

const ACCENT = danceFlowColors.lavender;
const GOLD = danceFlowColors.gold;
const MUTED = 'rgba(229,231,235,0.55)';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
}

function Stars({ value }: { value: number }): React.ReactElement {
  return (
    <Stack direction="row" spacing={0.25}>
      {[0, 1, 2, 3, 4].map((i) => {
        const diff = value - i;
        const Icon = diff >= 0.75 ? StarRoundedIcon : diff >= 0.25 ? StarHalfRoundedIcon : StarOutlineRoundedIcon;
        return <Icon key={i} sx={{ fontSize: 22, color: GOLD }} />;
      })}
    </Stack>
  );
}

export interface InstructorCardProps {
  instructor: DanceInstructor;
}

export function InstructorCard({ instructor }: InstructorCardProps): React.ReactElement {
  const rating = instructor.ratingAvg;

  return (
    <Box
      data-testid={`instructor-card-${instructor.id}`}
      sx={{
        position: 'relative',
        bgcolor: danceFlowColors.bgCard,
        border: `1px solid ${danceFlowColors.borderStrong}`,
        borderRadius: 3,
        p: 3,
        overflow: 'hidden',
        background: `radial-gradient(620px 280px at 90% -10%, rgba(167,139,250,0.10), transparent 60%), ${danceFlowColors.bgCard}`,
      }}
    >
      {/* Brand-rad */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${danceFlowColors.lavenderDeep}, ${ACCENT})`, color: '#fff', fontWeight: 800, fontSize: 20 }}>R</Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1 }}>THE ROLE ROOM</Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: ACCENT }}>DANS</Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ px: 1.5, py: 0.75, borderRadius: 99, border: `1px solid ${danceFlowColors.borderStrong}`, bgcolor: 'rgba(167,139,250,0.06)' }}>
          <SchoolOutlinedIcon sx={{ fontSize: 16, color: ACCENT }} />
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: ACCENT }}>INSTRUKTØR</Typography>
        </Stack>
      </Stack>

      {/* Avatar + hovedinfo */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Box
          sx={{
            width: 96, height: 96, borderRadius: 3, flex: 'none', overflow: 'hidden',
            display: 'grid', placeItems: 'center',
            background: instructor.avatarUrl ? 'transparent' : `linear-gradient(135deg, rgba(167,139,250,0.30), rgba(124,58,237,0.25))`,
            border: `1px solid ${danceFlowColors.borderStrong}`,
          }}
        >
          {instructor.avatarUrl
            ? <Box component="img" src={instructor.avatarUrl} alt={instructor.displayName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (instructor.displayName ? <Typography sx={{ fontSize: 34, fontWeight: 800, color: '#fff' }}>{initials(instructor.displayName)}</Typography>
              : <PersonOutlineIcon sx={{ fontSize: 44, color: MUTED }} />)}
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: ACCENT, mb: 0.25 }}>INSTRUKTØR</Typography>
          <Typography sx={{ fontSize: 30, fontWeight: 800, color: '#fff', lineHeight: 1.05 }}>{instructor.displayName}</Typography>
          {instructor.specialtyText ? (
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: danceFlowColors.lavenderLight, mt: 0.5 }}>{instructor.specialtyText}</Typography>
          ) : instructor.styles.length ? (
            <Typography sx={{ fontSize: 15, color: danceFlowColors.lavenderLight, mt: 0.5 }}>{instructor.styles.join(' · ')}</Typography>
          ) : null}
          {rating != null ? (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
              <Stars value={rating} />
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{rating.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Typography>
              <Typography sx={{ fontSize: 13, color: MUTED }}>
                elevvurdering{instructor.ratingCount ? ` · ${instructor.ratingCount}` : ''}
              </Typography>
            </Stack>
          ) : null}
        </Box>
      </Stack>

      {/* Neste klasse */}
      {instructor.nextClassText ? (
        <Stack
          direction="row" alignItems="center" spacing={1.5}
          sx={{ mt: 2.5, p: 1.75, borderRadius: 2, border: `1px solid ${danceFlowColors.borderStrong}`, bgcolor: 'rgba(167,139,250,0.05)' }}
        >
          <Box sx={{ width: 40, height: 40, borderRadius: 1.5, flex: 'none', display: 'grid', placeItems: 'center', bgcolor: 'rgba(167,139,250,0.16)', border: `1px solid ${danceFlowColors.borderStrong}` }}>
            <CalendarMonthOutlinedIcon sx={{ fontSize: 20, color: ACCENT }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', color: ACCENT }}>NESTE KLASSE</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{instructor.nextClassText}</Typography>
          </Box>
        </Stack>
      ) : null}
    </Box>
  );
}
