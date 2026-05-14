/**
 * EmptyProjectsHero — vises i Oversikt-tab når brukeren ikke har noen
 * prosjekter ennå. Hovedoppgaven er å gi en tydelig vei inn: "Opprett ditt
 * første prosjekt" som primær CTA, og en sekundær vei for å åpne demo-
 * prosjektet for å se hvordan ferdig data ser ut.
 */

import { Box, Typography, Button, Stack } from '@mui/material';
import {
  Add as AddIcon,
  AutoAwesome as SparkleIcon,
} from '@mui/icons-material';

interface EmptyProjectsHeroProps {
  workspaceName?: string;
  /** Trigger oppretting av nytt prosjekt. */
  onCreateProject: () => void;
  /** Valgfri: åpne demo-prosjekt om bruker vil utforske før de oppretter. */
  onOpenDemo?: () => void;
}

export const EmptyProjectsHero = ({
  workspaceName = 'Casting Planner',
  onCreateProject,
  onOpenDemo,
}: EmptyProjectsHeroProps) => {
  return (
    <Box
      role="region"
      aria-label="Kom i gang"
      sx={{
        width: '100%',
        minHeight: 320,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: { xs: 3, sm: 5 },
      }}
    >
      <Box
        sx={{
          maxWidth: 560,
          textAlign: 'center',
          p: { xs: 3, sm: 5 },
          bgcolor: 'rgba(184,107,255,0.06)',
          border: '1px dashed rgba(184,107,255,0.32)',
          borderRadius: 3,
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            bgcolor: 'rgba(184,107,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2.5,
          }}
        >
          <SparkleIcon sx={{ fontSize: 36, color: '#b86bff' }} />
        </Box>

        <Typography
          variant="h5"
          sx={{
            color: '#fff',
            fontWeight: 700,
            mb: 1,
            fontSize: { xs: '1.2rem', sm: '1.4rem' },
          }}
        >
          Velkommen til {workspaceName}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: 'rgba(255,255,255,0.78)',
            mb: 3,
            fontSize: { xs: '0.92rem', sm: '1rem' },
            lineHeight: 1.5,
          }}
        >
          Start med å opprette ditt første prosjekt. Du kan legge til roller,
          kandidater og planlegge auditions etterpå — vi guider deg gjennom
          stegene.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={onCreateProject}
            sx={{
              bgcolor: '#b86bff',
              color: '#fff',
              fontWeight: 700,
              px: 3.5,
              py: 1.5,
              fontSize: '1rem',
              minHeight: 48,
              '&:hover': { bgcolor: '#a855f7', transform: 'translateY(-1px)' },
              transition: 'all 0.18s',
            }}
          >
            Opprett ditt første prosjekt
          </Button>
          {onOpenDemo && (
            <Button
              variant="outlined"
              size="large"
              onClick={onOpenDemo}
              sx={{
                color: '#b86bff',
                borderColor: 'rgba(184,107,255,0.5)',
                fontWeight: 600,
                px: 3.5,
                py: 1.5,
                fontSize: '0.95rem',
                minHeight: 48,
                '&:hover': {
                  borderColor: '#b86bff',
                  bgcolor: 'rgba(184,107,255,0.08)',
                },
              }}
            >
              Se demo-prosjekt
            </Button>
          )}
        </Stack>

        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 2.5,
            color: 'rgba(255,255,255,0.48)',
            fontSize: '0.78rem',
          }}
        >
          💡 Tips: Trykk Cmd+K (eller Ctrl+K) for hurtigsøk over alt.
        </Typography>
      </Box>
    </Box>
  );
};

export default EmptyProjectsHero;
