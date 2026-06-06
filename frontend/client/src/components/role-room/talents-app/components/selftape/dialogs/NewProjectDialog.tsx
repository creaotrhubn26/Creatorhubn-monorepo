/**
 * NewProjectDialog — opprett nytt self-tape-prosjekt.
 *
 * Felt: navn (påkrevd) + rolle + scene + sides_pages + sides_content.
 * Kaller createProject() og returnerer det nye prosjekt-id til parent.
 */
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, TextField,
} from '@mui/material';
import { useState } from 'react';

import { palette, radius } from '../../../theme';
import { createProject } from '../../../../services/roleRoomSelfTapesService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => Promise<void> | void;
}

export default function NewProjectDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [sceneLabel, setSceneLabel] = useState('');
  const [sidesPages, setSidesPages] = useState<number | ''>('');
  const [sidesContent, setSidesContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName(''); setRoleName(''); setSceneLabel(''); setSidesPages(''); setSidesContent('');
    setError(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Navn er påkrevd');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { project } = await createProject({
        name: name.trim(),
        role_name: roleName.trim() || undefined,
        scene_label: sceneLabel.trim() || undefined,
        sides_pages: typeof sidesPages === 'number' ? sidesPages : undefined,
        sides_content: sidesContent.trim() || undefined,
      });
      reset();
      onClose();
      await onCreated(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å opprette prosjekt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          bgcolor: palette.bgShell,
          color: palette.textPrimary,
          border: `1px solid ${palette.border}`,
          borderRadius: radius.lg,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800 }}>Nytt self-tape-prosjekt</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Prosjektnavn *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            autoFocus
            InputLabelProps={{ sx: { color: palette.textMuted } }}
            sx={inputSx}
          />
          <TextField
            label="Rolle"
            value={roleName}
            onChange={(e) => setRoleName(e.target.value)}
            fullWidth
            placeholder="f.eks. Anna, hovedrolle"
            InputLabelProps={{ sx: { color: palette.textMuted } }}
            sx={inputSx}
          />
          <TextField
            label="Scene-merke"
            value={sceneLabel}
            onChange={(e) => setSceneLabel(e.target.value)}
            fullWidth
            placeholder="f.eks. Scene 14B"
            InputLabelProps={{ sx: { color: palette.textMuted } }}
            sx={inputSx}
          />
          <TextField
            label="Antall sider"
            type="number"
            value={sidesPages}
            onChange={(e) => setSidesPages(e.target.value === '' ? '' : Number(e.target.value))}
            fullWidth
            inputProps={{ min: 1, max: 99 }}
            InputLabelProps={{ sx: { color: palette.textMuted } }}
            sx={inputSx}
          />
          <TextField
            label="Manus / dialog"
            value={sidesContent}
            onChange={(e) => setSidesContent(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            maxRows={10}
            placeholder="**ANNA**\nDialogen din her ..."
            InputLabelProps={{ sx: { color: palette.textMuted } }}
            sx={inputSx}
          />
          {error ? (
            <Box sx={{ color: '#f87171', fontSize: '0.86rem' }}>{error}</Box>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: palette.textMuted, textTransform: 'none' }}>
          Avbryt
        </Button>
        <Button
          onClick={handleCreate}
          disabled={saving || !name.trim()}
          sx={{
            background: palette.accentGradient,
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            px: 2.4,
            '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            '&.Mui-disabled': { background: 'rgba(168,85,247,0.32)', color: 'rgba(255,255,255,0.6)' },
          }}
        >
          {saving ? 'Oppretter …' : 'Opprett prosjekt'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const inputSx = {
  '& .MuiInputBase-input': { color: palette.textPrimary },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderSubtle },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: palette.borderStrong },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: palette.accentBright },
} as const;
