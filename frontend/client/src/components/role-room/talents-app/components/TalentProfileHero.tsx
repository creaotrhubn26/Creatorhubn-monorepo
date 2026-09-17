/**
 * TalentProfileHero.tsx — toppen av profilen, etter mockupen.
 *
 * Headshot, navn, nøkkelfakta casting leser først (by, spille-alder, høyde,
 * språk, byrå), og profilstyrken som en ring i stedet for en tynn stripe.
 *
 * Handlingsknappene er bevisst begrenset til det som finnes: rediger og del.
 * «Download CV» og «Apply to Casting» fra mockupen er ikke bygget ennå, og en
 * knapp som ikke gjør noe er verre enn ingen knapp.
 */

import { Avatar, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import CakeOutlinedIcon from '@mui/icons-material/CakeOutlined';
import HeightOutlinedIcon from '@mui/icons-material/HeightOutlined';
import TranslateOutlinedIcon from '@mui/icons-material/Translate';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';

import type { RoleRoomTalent } from '../../services/roleRoomTalentsService';
import { calcProfileStrength } from '../profileStrength';
import { palette, radius } from '../theme';

interface TalentProfileHeroProps {
  talent: RoleRoomTalent;
  creditCount: number;
  onEdit: () => void;
  onShare: () => void;
}

function Fact({ Icon, children }: { Icon: React.ComponentType<{ sx?: object }>; children: React.ReactNode }) {
  return (
    <Stack direction="row" spacing={0.8} alignItems="center">
      <Icon sx={{ color: palette.textMuted, fontSize: 17 }} />
      <Typography sx={{ color: palette.textSecondary, fontSize: '0.88rem' }}>{children}</Typography>
    </Stack>
  );
}

/** Ring med prosent i midten. */
function StrengthRing({ score }: { score: number }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={78}
        thickness={3.5}
        sx={{ color: 'rgba(98, 73, 223,0.16)' }}
      />
      <CircularProgress
        variant="determinate"
        value={score}
        size={78}
        thickness={3.5}
        sx={{ color: palette.accentBright, position: 'absolute', left: 0 }}
      />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.05rem' }}>
          {score}%
        </Typography>
      </Box>
    </Box>
  );
}

export default function TalentProfileHero({
  talent,
  creditCount,
  onEdit,
  onShare,
}: TalentProfileHeroProps) {
  const strength = calcProfileStrength(talent, creditCount);
  const languages = Array.isArray(talent.languages)
    ? talent.languages
        .map((l) => (typeof l === 'string' ? l : (l as { label?: string }).label))
        .filter(Boolean)
        .slice(0, 4)
        .join(', ')
    : '';

  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: { xs: 2.2, md: 3 },
        mb: 2.4,
      }}
    >
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2.4, md: 3 }}>
        <Avatar
          src={talent.headshot_url ?? undefined}
          sx={{
            width: { xs: 96, md: 132 },
            height: { xs: 96, md: 132 },
            borderRadius: radius.md,
            bgcolor: 'rgba(98, 73, 223,0.18)',
            color: palette.accentBright,
          }}
          variant="rounded"
        >
          {talent.headshot_url ? null : <PersonOutlineIcon sx={{ fontSize: 54 }} />}
        </Avatar>

        <Stack spacing={1.2} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box>
            <Typography
              sx={{
                color: palette.accentBright,
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Skuespiller
            </Typography>
            <Typography
              sx={{ color: palette.textPrimary, fontSize: { xs: '1.7rem', md: '2.1rem' }, fontWeight: 800, lineHeight: 1.1 }}
            >
              {talent.display_name}
            </Typography>
          </Box>

          <Stack direction="row" spacing={2.4} flexWrap="wrap" useFlexGap>
            <Fact Icon={PlaceOutlinedIcon}>
              {talent.city ? `${talent.city}, ${talent.country ?? 'NO'}` : 'By ikke satt'}
            </Fact>
            {talent.playing_age_min && talent.playing_age_max ? (
              <Fact Icon={CakeOutlinedIcon}>
                Spille-alder {talent.playing_age_min}–{talent.playing_age_max}
              </Fact>
            ) : null}
            {talent.height_cm ? <Fact Icon={HeightOutlinedIcon}>{talent.height_cm} cm</Fact> : null}
          </Stack>

          <Stack direction="row" spacing={2.4} flexWrap="wrap" useFlexGap>
            {languages ? <Fact Icon={TranslateOutlinedIcon}>{languages}</Fact> : null}
            {talent.agency_name ? <Fact Icon={BusinessOutlinedIcon}>{talent.agency_name}</Fact> : null}
            <Chip
              size="small"
              label={`${creditCount} ${creditCount === 1 ? 'kreditering' : 'krediteringer'}`}
              sx={{ bgcolor: 'rgba(98, 73, 223,0.14)', color: palette.accentBright, fontWeight: 600 }}
            />
          </Stack>

          <Stack direction="row" spacing={1.2} sx={{ pt: 0.6 }} flexWrap="wrap" useFlexGap>
            <Button
              startIcon={<EditOutlinedIcon />}
              onClick={onEdit}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                px: 2.2,
                borderRadius: radius.sm,
                background: palette.accentGradient,
                color: '#fff',
              }}
            >
              Rediger profil
            </Button>
            <Button
              startIcon={<IosShareOutlinedIcon />}
              onClick={onShare}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                px: 2.2,
                borderRadius: radius.sm,
                color: palette.textPrimary,
                border: `1px solid ${palette.borderStrong}`,
              }}
            >
              Del profil
            </Button>
          </Stack>
        </Stack>

        <Stack spacing={1} alignItems="center" sx={{ flexShrink: 0, minWidth: 160 }}>
          <StrengthRing score={strength.score} />
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>
            Profilstyrke
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem', textAlign: 'center', lineHeight: 1.45 }}>
            {strength.missing.length === 0
              ? 'Profilen er komplett.'
              : `Mangler: ${strength.missing.slice(0, 2).join(', ')}${strength.missing.length > 2 ? ` +${strength.missing.length - 2}` : ''}`}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
