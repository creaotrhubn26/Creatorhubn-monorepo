/**
 * SceneRoleCardsDialog — inngangen til scenebyggeren fra en produksjonsdag.
 *
 * En dag har flere scener, og rollekortene hører til scenen, ikke til dagen.
 * Dialogen står derfor mellom de to: velg scene, bygg kortene.
 *
 * Hopper over valget når dagen bare har én scene. Et valg med ett alternativ
 * er ikke et valg, det er et ekstra klikk.
 */

import {
  Box, Button, Dialog, DialogContent, DialogTitle, IconButton, List, ListItemButton,
  Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MovieIcon from '@mui/icons-material/MovieCreationOutlined';
import { useEffect, useState } from 'react';

import SceneBlockingEditor from './SceneBlockingEditor';
import { palette, radius } from '../../talents-app/theme';

export interface SceneValg {
  id: string;
  title: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: string;
  scenes: SceneValg[];
  /** Dagen kortene hører til, kun til overskriften. */
  dayLabel?: string;
  /** Samme dag, som id: kortene trenger den for å vite hvor folk skal møte. */
  dayId?: string;
}

export default function SceneRoleCardsDialog({ open, onClose, projectId, scenes, dayLabel, dayId }: Props) {
  const [valgt, setValgt] = useState<SceneValg | null>(null);

  // Med én scene er valget bare et ekstra klikk.
  useEffect(() => {
    if (open) setValgt(scenes.length === 1 ? scenes[0] : null);
  }, [open, scenes]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{ sx: { bgcolor: palette.bgShell, border: `1px solid ${palette.border}`, borderRadius: radius.lg } }}
    >
      <DialogTitle sx={{ color: palette.textPrimary, fontWeight: 800, pr: 6 }}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          {valgt && scenes.length > 1 && (
            <IconButton size="small" onClick={() => setValgt(null)} sx={{ color: palette.textMuted }} aria-label="Tilbake til scenevalg">
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Box>
            Rollekort{dayLabel ? ` — ${dayLabel}` : ''}
            <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem', fontWeight: 400, mt: 0.2 }}>
              Hver person får sin egen lenke og ser bare sitt eget kort.
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12, color: palette.textMuted }} aria-label="Lukk">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        {scenes.length === 0 ? (
          // Dagen har ingen scener ennå. Da er rollekort et steg for tidlig,
          // og det skal stå her framfor en tom scenebygger.
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>
              Ingen scener på denne dagen ennå
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.92rem', mt: 0.8, mx: 'auto', maxWidth: '44ch' }}>
              Legg scener på dagen først. Rollekortene henger på scenen, fordi det er scenen som bestemmer hvor folk står.
            </Typography>
            <Button onClick={onClose} sx={{ mt: 2.4, textTransform: 'none', color: palette.accentBright }}>
              Lukk
            </Button>
          </Box>
        ) : valgt ? (
          <SceneBlockingEditor projectId={projectId} sceneId={valgt.id} sceneTitle={valgt.title} productionDayId={dayId} />
        ) : (
          <>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.9rem', mb: 1.4 }}>
              Hvilken scene?
            </Typography>
            <List disablePadding>
              {scenes.map((s) => (
                <ListItemButton
                  key={s.id}
                  onClick={() => setValgt(s)}
                  sx={{
                    borderRadius: radius.md,
                    border: `1px solid ${palette.border}`,
                    mb: 1,
                    bgcolor: palette.bgCard,
                    '&:hover': { borderColor: palette.accentBright },
                  }}
                >
                  <MovieIcon sx={{ color: palette.accentBright, mr: 1.4, fontSize: 20 }} />
                  <Typography sx={{ color: palette.textPrimary, fontWeight: 600 }}>{s.title}</Typography>
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
