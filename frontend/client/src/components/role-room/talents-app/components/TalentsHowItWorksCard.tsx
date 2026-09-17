/**
 * TalentsHowItWorksCard.tsx
 *
 * Det første en fersk skuespiller møter på Hjem. Uten dette landet hen på et
 * tomt dashbord med menypunktene «Partnere», «Partnerships» og «Hvem har sett
 * meg?» — begreper fra et talent-register hen aldri har brukt — og måtte selv
 * gjette seg fram til wizarden via tre klikk.
 *
 * To tilstander, fordi spørsmålet endrer seg underveis:
 *   ingen/ufullstendig profil → «slik funker det» + sett i gang
 *   profil klar, ingen partnere → «du er klar, dette skjer nå»
 *
 * Kortet kan lukkes permanent per bruker (localStorage), og forsvinner av seg
 * selv når talenten har fått sin første partner.
 */

import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useCallback, useState } from 'react';

import { palette, radius } from '../theme';

const DISMISS_KEY = 'talents_how_it_works_dismissed';

/** Signal til ProfilePage om å åpne wizarden med én gang. */
export const OPEN_WIZARD_KEY = 'talents_open_wizard';

interface TalentsHowItWorksCardProps {
  /** Hvor langt profilen er kommet (0–100). */
  completeness: number;
  /** Antall partnere med tilgang — over null er talenten i gang. */
  activePartners: number;
  onNavigate: (page: 'profiles' | 'partners') => void;
}

const STEPS = [
  {
    icon: EditNoteIcon,
    title: 'Du fyller ut profilen',
    body: 'Bio, headshot, showreel, ferdigheter. Tar rundt fem minutter, og du kan fylle ut resten senere.',
  },
  {
    icon: HandshakeIcon,
    title: 'Byråer ber om tilgang',
    body: 'Casting-byråer og produsenter kan foreslå deg til sitt register. Du får spørsmålet før noe deles.',
  },
  {
    icon: LockOpenIcon,
    title: 'Du bestemmer hva de ser',
    body: 'Per byrå, per del av profilen. Ingen ser deg før du sier ja, og du kan trekke tilgangen når som helst.',
  },
];

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export default function TalentsHowItWorksCard({
  completeness,
  activePartners,
  onNavigate,
}: TalentsHowItWorksCardProps) {
  const [dismissed, setDismissed] = useState(readDismissed);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignorer storage-feil — kortet forsvinner uansett for denne økten.
    }
  }, []);

  const startWizard = useCallback(() => {
    try {
      window.sessionStorage.setItem(OPEN_WIZARD_KEY, '1');
    } catch {
      // ProfilePage viser da «Sett opp profil»-knappen som før.
    }
    onNavigate('profiles');
  }, [onNavigate]);

  // Har talenten først fått en partner, er systemet forklart av seg selv.
  if (dismissed || activePartners > 0) return null;

  const profileReady = completeness >= 100;

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.borderStrong}`,
        borderRadius: radius.lg,
        p: { xs: 2.2, md: 2.8 },
        mb: 2.4,
      }}
    >
      <IconButton
        onClick={dismiss}
        aria-label="Skjul forklaringen"
        size="small"
        sx={{ position: 'absolute', top: 10, right: 10, color: palette.textMuted }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <Typography
        sx={{
          color: palette.accentBright,
          fontSize: '0.74rem',
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          mb: 0.8,
        }}
      >
        Slik funker Talents
      </Typography>

      <Typography sx={{ color: palette.textPrimary, fontWeight: 800, fontSize: '1.25rem', mb: 0.6, pr: 4 }}>
        {profileReady ? 'Profilen din er klar — dette skjer nå' : 'Tre steg, så er du synlig for casting'}
      </Typography>
      <Typography sx={{ color: palette.textSecondary, fontSize: '0.95rem', lineHeight: 1.6, mb: 2.2 }}>
        {profileReady
          ? 'Du er fortsatt usynlig for byråer til du deler noe. Enten foreslår et byrå deg — da får du spørsmålet her — eller du inviterer et byrå selv fra Partnere.'
          : 'The Role Room Talents er et register der casting-byråer finner skuespillere. Du eier profilen, og ingenting deles uten at du sier ja.'}
      </Typography>

      {!profileReady && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 1.6, md: 2.4 }} sx={{ mb: 2.4 }}>
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Stack key={step.title} direction="row" spacing={1.4} sx={{ flex: 1 }} alignItems="flex-start">
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: 'rgba(99, 102, 241,0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon sx={{ color: palette.accentBright, fontSize: 19 }} />
                </Box>
                <Box>
                  <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>
                    {index + 1}. {step.title}
                  </Typography>
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', lineHeight: 1.5, mt: 0.3 }}>
                    {step.body}
                  </Typography>
                </Box>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button
          onClick={profileReady ? () => onNavigate('partners') : startWizard}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            px: 2.4,
            py: 1,
            borderRadius: radius.sm,
            background: palette.accentGradient,
            color: '#fff',
          }}
        >
          {profileReady ? 'Inviter et byrå' : 'Sett opp profilen — 5 min'}
        </Button>
        <Button onClick={dismiss} sx={{ textTransform: 'none', color: palette.textMuted }}>
          Ikke vis dette igjen
        </Button>
      </Stack>
    </Box>
  );
}
