import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Stack,
  Typography,
  Button,
  Alert,
} from '@mui/material';
import {
  Movie as ProductionIcon,
  PhotoCamera as PhotographerIcon,
  Edit as ContentProducerIcon,
  Bolt as ContentCreatorIcon,
  School as DanceStudioIcon,
  EmojiPeople as DanceFreelanceIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import {
  ALL_PROFESSION_MODES,
  getActiveProfessionMode,
  setActiveProfessionMode,
  type ProfessionMode,
} from '../config/professionMode';

interface ModeMeta {
  label: string;
  description: string;
  icon: React.ReactElement;
  accent: string;
  beta?: boolean;
}

const MODE_META: Record<ProfessionMode, ModeMeta> = {
  production: {
    label: 'Produksjon (film/video)',
    description: 'Standardmodus for produksjonsteam — manus, opptaksdager, plan, scener.',
    icon: <ProductionIcon />,
    accent: '#1976d2',
  },
  photographer: {
    label: 'Fotograf',
    description: 'Foto-prosjekter — capture, foto-enhancer, klientgalleri.',
    icon: <PhotographerIcon />,
    accent: '#0288d1',
  },
  content_producer: {
    label: 'Innholdsprodusent',
    description: 'Markedsinnhold, kampanjer, redaksjonell planlegging.',
    icon: <ContentProducerIcon />,
    accent: '#7b1fa2',
  },
  content_creator: {
    label: 'Innholdsskaper',
    description: 'Solo-creator-flyt — kortform, kanaler, planlegging.',
    icon: <ContentCreatorIcon />,
    accent: '#f57c00',
  },
  dance_studio: {
    label: 'Dansestudio',
    description: 'Studioeier-vertikalen — koreografi, formasjoner, repertoar, kursplan.',
    icon: <DanceStudioIcon />,
    accent: '#8b5cf6',
    beta: true,
  },
  dance_freelance: {
    label: 'Dans — frilans',
    description: 'Frilansdanser — bookinger, auditions, ferdighetsprofil, tilgjengelighet.',
    icon: <DanceFreelanceIcon />,
    accent: '#8b5cf6',
    beta: true,
  },
};

export default function ProfessionModeSwitcher(): React.ReactElement {
  const initialMode = useMemo(() => getActiveProfessionMode(), []);
  const [selected, setSelected] = useState<ProfessionMode>(initialMode);
  const dirty = selected !== initialMode;

  const apply = () => {
    setActiveProfessionMode(selected);
    // URL ?mode= takes precedence in getActiveProfessionMode, so rewrite
    // the URL to match the new selection (or strip it to fall through to
    // localStorage). We keep ?mode=<selected> so the choice survives a
    // bookmark of the current view.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', selected);
      window.history.replaceState({}, '', url.toString());
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Profesjonsmodus
        </Typography>
        <Chip
          label={`Aktiv: ${MODE_META[initialMode].label}`}
          size="small"
          sx={{ bgcolor: 'grey.200', fontWeight: 600 }}
        />
      </Stack>

      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Velg hvilken vertikal The Role Room skal kjøre i. Dette bytter faner,
        terminologi og tilgjengelige verktøy. Endring tar effekt umiddelbart
        (siden lastes på nytt). Eksisterende prosjekter er upåvirket — kun
        ditt eget UI-perspektiv endres.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
          },
        }}
      >
        {ALL_PROFESSION_MODES.map((mode) => {
          const meta = MODE_META[mode];
          const isSelected = selected === mode;
          const isCurrent = initialMode === mode;
          return (
            <Card
              key={mode}
              elevation={isSelected ? 4 : 1}
              sx={{
                borderRadius: 2,
                border: '2px solid',
                borderColor: isSelected ? meta.accent : 'transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <CardActionArea
                onClick={() => setSelected(mode)}
                sx={{ p: 2, height: '100%', alignItems: 'flex-start' }}
              >
                <Stack spacing={1.5} sx={{ width: '100%' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: `${meta.accent}1a`,
                        color: meta.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {meta.icon}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, lineHeight: 1.2 }}
                      >
                        {meta.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
                      >
                        {mode}
                      </Typography>
                    </Box>
                    {isSelected && (
                      <CheckIcon sx={{ color: meta.accent }} />
                    )}
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {meta.description}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    {isCurrent && (
                      <Chip
                        label="Aktiv nå"
                        size="small"
                        sx={{
                          bgcolor: 'success.light',
                          color: 'success.dark',
                          fontWeight: 600,
                          height: 22,
                        }}
                      />
                    )}
                    {meta.beta && (
                      <Chip
                        label="Beta"
                        size="small"
                        sx={{
                          bgcolor: `${meta.accent}1a`,
                          color: meta.accent,
                          fontWeight: 600,
                          height: 22,
                        }}
                      />
                    )}
                  </Stack>
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      {dirty && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          Du har valgt <strong>{MODE_META[selected].label}</strong>. Trykk
          «Bytt modus» for å bytte og laste siden på nytt.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
        <Button
          variant="text"
          onClick={() => setSelected(initialMode)}
          disabled={!dirty}
        >
          Tilbakestill
        </Button>
        <Button
          variant="contained"
          onClick={apply}
          disabled={!dirty}
          sx={{
            bgcolor: MODE_META[selected].accent,
            '&:hover': { bgcolor: MODE_META[selected].accent, opacity: 0.9 },
          }}
        >
          Bytt modus
        </Button>
      </Stack>
    </Box>
  );
}
