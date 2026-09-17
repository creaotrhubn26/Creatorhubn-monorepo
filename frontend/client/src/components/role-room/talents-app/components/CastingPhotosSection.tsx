/**
 * CastingPhotosSection.tsx — de tre bildene casting-byråer krever.
 *
 * UX-valgene her, og hvorfor:
 *
 *   Forebygg feil framfor å forklare dem. Kravene til hvert bilde står FØR
 *   opplasting, ikke som en feilmelding etterpå. Et avvist bilde koster
 *   skuespilleren en ny fotosesjon; en linje med «uten solbriller, nøytral
 *   bakgrunn» koster ingenting.
 *
 *   Progressiv avdekking. Hvert felt har én linje med det viktigste. Resten
 *   ligger bak «Hva casting ser etter», lukket som standard — det er
 *   referanse man leser én gang, ikke noe man trenger hver gang.
 *
 *   Alle tilstander, ikke bare happy path. Tom, laster opp, ferdig, mangler,
 *   komplett — og en teller som viser hvor langt man er kommet. Uten det vet
 *   ikke skuespilleren om hen er ferdig før byrået avviser profilen.
 *
 *   Konsistens. Selve opplastingen er MediaUploader, den samme som headshot,
 *   showreel og CV bruker. Ingen ny interaksjonsmodell for samme handling.
 */

import { Box, Chip, Collapse, Link as MuiLink, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';

import { REQUIRED_PHOTO_KINDS, type VocabularyLocale } from '../../../../../../shared/talent-physical-vocabulary';
import MediaUploader from './MediaUploader';
import { palette, radius } from '../theme';

type PhotoMap = Record<string, string>;

interface Props {
  locale: VocabularyLocale;
  value: PhotoMap;
  onChange: (next: PhotoMap) => void;
}

const t = (locale: VocabularyLocale, no: string, en: string) => (locale === 'en' ? en : no);

/** Én linje per bilde — det som oftest gjør at et bilde blir avvist. */
const SHORT_HINT: Record<string, { no: string; en: string }> = {
  face_front: {
    no: 'Rett forfra, nøytralt ansikt, ingen solbriller eller hatt.',
    en: 'Straight on, neutral expression, no sunglasses or hat.',
  },
  face_profile: {
    no: 'Hodet i ren profil, samme dag og lys som forfra-bildet.',
    en: 'Head in full profile, same day and lighting as the front shot.',
  },
  full_body_front: {
    no: 'Hele kroppen synlig, tettsittende klær, nøytral bakgrunn.',
    en: 'Full body visible, close-fitting clothes, neutral background.',
  },
};

const DETAILS: Array<{ no: string; en: string }> = [
  {
    no: 'Ingen filtre, ingen retusj. Byrået må se hvordan du faktisk ser ut i dag.',
    en: 'No filters, no retouching. The agency needs to see how you actually look today.',
  },
  {
    no: 'Dagslys eller jevnt lys forfra. Unngå hard skygge over halve ansiktet.',
    en: 'Daylight or even front light. Avoid hard shadow across half the face.',
  },
  {
    no: 'Nøytral bakgrunn — en vegg holder. Ikke andre personer i bildet.',
    en: 'Neutral background — a wall will do. No other people in the frame.',
  },
  {
    no: 'Ikke eldre enn seks måneder. Har du endret hårfarge eller -lengde, ta nye.',
    en: 'No older than six months. If your hair colour or length changed, retake them.',
  },
];

export default function CastingPhotosSection({ locale, value, onChange }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const done = REQUIRED_PHOTO_KINDS.filter((kind) => Boolean(value[kind.id])).length;
  const total = REQUIRED_PHOTO_KINDS.length;
  const complete = done === total;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
          {t(locale, 'Castingbilder', 'Casting photos')}
        </Typography>
        {/* Umiddelbar tilbakemelding: telleren endrer seg i samme øyeblikk et
            bilde er lastet opp, så det aldri er uklart om man er ferdig. */}
        <Chip
          size="small"
          icon={complete ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : undefined}
          label={complete ? t(locale, 'Komplett', 'Complete') : `${done}/${total}`}
          sx={{
            bgcolor: complete ? 'rgba(34,197,94,0.14)' : 'rgba(98, 73, 223,0.14)',
            color: complete ? palette.success : palette.accentBright,
            fontWeight: 700,
            '& .MuiChip-icon': { color: palette.success },
          }}
        />
      </Stack>

      <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1.4, lineHeight: 1.5 }}>
        {t(
          locale,
          'Alle tre kreves av de fleste byråer. De deles kun med partnere du har gitt media-tilgang.',
          'Most agencies require all three. They are shared only with partners you granted media access.',
        )}
      </Typography>

      <Stack spacing={1.8}>
        {REQUIRED_PHOTO_KINDS.map((kind) => (
          <MediaUploader
            key={kind.id}
            kind="alt_photo"
            label={kind[locale]}
            helperText={SHORT_HINT[kind.id][locale]}
            value={value[kind.id] ?? ''}
            onChange={(url) => {
              const next = { ...value };
              if (url) next[kind.id] = url;
              else delete next[kind.id];
              onChange(next);
            }}
          />
        ))}
      </Stack>

      {/* Progressiv avdekking: detaljkravene er referanse, ikke noe man
          trenger foran seg hver gang. */}
      <MuiLink
        component="button"
        type="button"
        onClick={() => setDetailsOpen((open) => !open)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.4,
          mt: 1.4,
          color: palette.accentBright,
          fontSize: '0.84rem',
          textDecoration: 'none',
        }}
      >
        {t(locale, 'Hva casting ser etter', 'What casting looks for')}
        <ExpandMoreIcon
          sx={{ fontSize: 18, transform: detailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 140ms' }}
        />
      </MuiLink>
      <Collapse in={detailsOpen}>
        <Box
          sx={{
            mt: 1,
            p: 1.6,
            bgcolor: palette.bgCardElevated,
            border: `1px solid ${palette.borderSubtle}`,
            borderRadius: radius.md,
          }}
        >
          <Stack component="ul" spacing={0.7} sx={{ m: 0, pl: 2.2 }}>
            {DETAILS.map((detail) => (
              <Typography
                key={detail.en}
                component="li"
                sx={{ color: palette.textSecondary, fontSize: '0.84rem', lineHeight: 1.5 }}
              >
                {detail[locale]}
              </Typography>
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
