import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';

interface AddProjectTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: { name: string; icon: string; color: string; description: string }) => void;
}

const AddProjectTypeDialog: React.FC<AddProjectTypeDialogProps> = ({
  open,
  onClose,
  onAdd,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#10b981');

  const handleSubmit = () => {
    if (name.trim()) {
      onAdd({
        name: name.trim(),
        icon: 'folder',
        color,
        description: description.trim(),
      });
      setName('');
      setDescription('');
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a2e',
          color: '#fff',
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6">Legg til prosjekttype</Typography>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.87)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Navn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            }}
          />
          <TextField
            label="Beskrivelse"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              },
              '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.87)' },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              Farge:
            </Typography>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 40, height: 40, border: 'none', borderRadius: 8, cursor: 'pointer' }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.87)' }}>
          Avbryt
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={<AddIcon />}
          disabled={!name.trim()}
          sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
        >
          Legg til
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddProjectTypeDialog;
