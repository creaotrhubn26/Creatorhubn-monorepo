/**
 * NextRoleUpsellModal
 *
 * Reusable upsell-modal som vises når en bruker forsøker en feature
 * som krever en høyere tier enn de har. Tydelig kostnads-info så
 * brukeren vet nøyaktig hva de betaler.
 *
 * Bruk:
 *   const [upsell, setUpsell] = useState<UpsellTrigger | null>(null);
 *   ...
 *   if (!ent.canTranslate) {
 *     setUpsell({ feature: 'translate', requiredTier: 'pro' });
 *     return;
 *   }
 */

import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, Chip, IconButton, Divider, Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Bolt as BoltIcon,
  CheckCircle as CheckCircleIcon,
  Lock as LockIcon,
  AutoAwesome as SparkIcon,
} from '@mui/icons-material';
import { useLocation } from 'wouter';
import { NextRoleTier } from '@/hooks/useNextRoleEntitlements';

export type UpsellFeature =
  | 'cover-letter'
  | 'translate'
  | 'interview-prep'
  | 'version-history'
  | 'github-import'
  | 'cv-import-pdf'
  | 'ai-analyze'
  | 'public-share'
  | 'unlimited-resumes'
  | 'all-templates';

interface FeatureCopy {
  title: string;
  description: string;
  benefits: string[];
  requiredTier: NextRoleTier;
  estimatedTimeSavedMin: number;
}

const FEATURE_COPY: Record<UpsellFeature, FeatureCopy> = {
  'cover-letter': {
    title: 'AI-søknadsbrev',
    description:
      'Lim inn jobbeskrivelsen og få et komplett, profesjonelt søknadsbrev på norsk — basert på din egen CV — på under 20 sekunder.',
    benefits: [
      'Personliggjort per stilling — bruker dine erfaringer og selskapets behov',
      'Norsk eller engelsk',
      'Følger Forbrukertilsynets retningslinjer for AI-generert innhold',
      'Ingen klisjéer — bygget fra dine konkrete prestasjoner',
    ],
    requiredTier: 'pro',
    estimatedTimeSavedMin: 45,
  },
  'translate': {
    title: 'Engelsk versjon av CV-en',
    description:
      'Lag en parallell engelsk versjon av CV-en med ett klikk. Claude oversetter all tekst og beholder strukturen, slik at du kan redigere videre.',
    benefits: [
      'Hele CV-en oversatt — erfaringer, utdanning, ferdigheter, sertifiseringer',
      'Beholder norske datoer, navn og stedsnavn',
      'Du kan redigere både versjoner separat etterpå',
    ],
    requiredTier: 'pro',
    estimatedTimeSavedMin: 60,
  },
  'interview-prep': {
    title: 'AI-intervjuforberedelse',
    description:
      'Få et tilpasset spørsmål-sett basert på CV-en din og stillingsannonsen. Behavioral, technical og kompetanse-spørsmål med fasit.',
    benefits: [
      '20+ spørsmål per stilling',
      'Tre kategorier: behavioral, technical, kompetanse',
      'Tips til hva intervjueren leter etter',
      'Eksempel-svar basert på din erfaring',
    ],
    requiredTier: 'pro',
    estimatedTimeSavedMin: 90,
  },
  'version-history': {
    title: 'Versjon-historikk',
    description:
      'Lagre snapshots av CV-en før store endringer. Gå tilbake i tid hvis AI-omskriving ble feil, eller hvis du angrer en sletting.',
    benefits: [
      'Ubegrensede snapshots',
      'Restore med ett klikk',
      'Auto-snapshot før AI-omskrivinger',
      'Behold flere versjoner per stilling',
    ],
    requiredTier: 'pro',
    estimatedTimeSavedMin: 30,
  },
  'github-import': {
    title: 'GitHub-import',
    description:
      'Hent dine offentlige repositories automatisk. Topp 6 etter stjerner blir til prosjekter på CV-en din med språk, teknologier og lenker.',
    benefits: [
      'Henter direkte fra GitHub Public API',
      'Filtrerer ut forks og arkiverte',
      'Auto-fyller technologies fra repo-språk + topics',
      'Linker til live repo + stjerner som proof',
    ],
    requiredTier: 'pro',
    estimatedTimeSavedMin: 40,
  },
  'cv-import-pdf': {
    title: 'PDF/DOCX-import',
    description:
      'Last opp eksisterende CV. Claude leser tekstinnhold og strukturerer det inn i NextRole — erfaringer, utdanning, ferdigheter, alt.',
    benefits: [
      'Støtter PDF og DOCX (Word)',
      'Strukturer 5+ års CV på 30 sekunder',
      'Beholder sub-roller (Produsent: / Regissør: / Fotograf:)',
      'Oppdaget språk + sertifiseringer automatisk',
    ],
    requiredTier: 'standard',
    estimatedTimeSavedMin: 120,
  },
  'ai-analyze': {
    title: 'AI ATS-analyse',
    description:
      'Claude leser stillingsannonsen og CV-en din, returnerer ATS-score + manglende nøkkelord + konkrete forbedringer.',
    benefits: [
      'Numerisk ATS-score 0–100',
      'Liste over manglende nøkkelord vs jobben',
      'Konkrete forbedringer per seksjon',
      'Sammenlign mot 92% av norske CV-er',
    ],
    requiredTier: 'standard',
    estimatedTimeSavedMin: 25,
  },
  'public-share': {
    title: 'Offentlig CV-lenke',
    description:
      'Publiser CV-en som offentlig side på nextrole.no/cv/dittnavn. Del lenken med rekrutterer, se visnings-tall i sanntid.',
    benefits: [
      'Trygg unik lenke',
      'Open Graph + Twitter-card så LinkedIn ser fin preview',
      'Visnings-tracking — vet hvor mange åpnet lenken',
      'Slett eller skjul når som helst',
    ],
    requiredTier: 'standard',
    estimatedTimeSavedMin: 15,
  },
  'unlimited-resumes': {
    title: 'Ubegrenset antall CV-er',
    description:
      'Lag spesialiserte CV-er for hver stilling du søker. Standard har 5 CV-er — Pro fjerner grensen helt.',
    benefits: [
      'Behold én master + variant per søknad',
      'Klon med ett klikk',
      'Versjon-historikk inkludert',
    ],
    requiredTier: 'pro',
    estimatedTimeSavedMin: 20,
  },
  'all-templates': {
    title: 'Alle 15 maler + 8 fargeskjemaer',
    description:
      'Standard og Pro inkluderer alle maler. Nordic Dark, Modern Tan, Timeline Centered, Minimal Mono og 11 til — med 8 forhåndsdefinerte fargevariasjoner.',
    benefits: [
      '15 profesjonelt designede maler',
      '8 fargeskjemaer per mal',
      'Live preview mens du redigerer',
      'Bytte mal beholder alle data',
    ],
    requiredTier: 'standard',
    estimatedTimeSavedMin: 30,
  },
};

interface Props {
  open: boolean;
  feature: UpsellFeature | null;
  onClose: () => void;
}

export const NextRoleUpsellModal: React.FC<Props> = ({ open, feature, onClose }) => {
  const [, setLocation] = useLocation();
  if (!feature) return null;
  const copy = FEATURE_COPY[feature];
  const isProRequired = copy.requiredTier === 'pro';
  const price = isProRequired ? '99 kr / mnd' : '49 kr / mnd';
  const yearlyPrice = isProRequired ? '1 188 kr / år' : '588 kr / år';

  // Sammenligning vs ChatGPT (synlig kostnads-transparens)
  const chatGptYearly = 240; // USD ChatGPT Plus
  const chatGptNok = Math.round(chatGptYearly * 10.5); // ca. NOK
  const ourYearly = isProRequired ? 1188 : 588;
  const saved = chatGptNok - ourYearly;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <SparkIcon sx={{ color: '#F5B82E' }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" component="div" sx={{ fontWeight: 700 }}>
            Lås opp {copy.title.toLowerCase()}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.3 }}>
            <Chip
              icon={<LockIcon sx={{ fontSize: 12 }} />}
              label={isProRequired ? 'Pro-feature' : 'Standard-feature'}
              size="small"
              sx={{
                bgcolor: isProRequired ? '#FFF4D6' : '#E0E7FF',
                color: isProRequired ? '#7A5A0B' : '#3730A3',
                fontWeight: 600,
                fontSize: 11,
              }}
            />
            {copy.estimatedTimeSavedMin >= 60 && (
              <Chip
                label={`Sparer ~${Math.round(copy.estimatedTimeSavedMin / 60)} timer`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.6 }}>
          {copy.description}
        </Typography>

        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: 1.2 }}>
          DETTE FÅR DU
        </Typography>
        <Stack spacing={0.7} sx={{ mt: 1, mb: 2.5 }}>
          {copy.benefits.map((b) => (
            <Stack key={b} direction="row" spacing={1} alignItems="flex-start">
              <CheckCircleIcon sx={{ color: '#10B981', fontSize: 18, mt: 0.15 }} />
              <Typography variant="body2">{b}</Typography>
            </Stack>
          ))}
        </Stack>

        {/* Kostnads-transparens — vs ChatGPT */}
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#FFFBEB', borderColor: '#FCD34D' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1.2, color: '#92400E' }}>
            SAMMENLIGNING
          </Typography>
          <Stack spacing={0.4} sx={{ mt: 0.7 }}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">NextRole {isProRequired ? 'Pro' : 'Standard'}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{price}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">ChatGPT Plus</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                ~210 kr / mnd
              </Typography>
            </Stack>
            <Divider sx={{ my: 0.5 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#065F46' }}>
                Du sparer
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#065F46' }}>
                {saved.toLocaleString('no-NO')} kr / år
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          {yearlyPrice} ved årlig fakturering. Avbryt når som helst.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="text">Kanskje senere</Button>
        <Button
          variant="contained"
          startIcon={<BoltIcon />}
          sx={{
            bgcolor: '#F5B82E',
            fontWeight: 700,
            px: 3,
            '&:hover': { bgcolor: '#D49B1A' },
          }}
          onClick={() => {
            onClose();
            setLocation(`/nextrole?tier=${isProRequired ? 'pro' : 'standard'}`);
          }}
        >
          Oppgrader til {isProRequired ? 'Pro' : 'Standard'} ({price})
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NextRoleUpsellModal;
