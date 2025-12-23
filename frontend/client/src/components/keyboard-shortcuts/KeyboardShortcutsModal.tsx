import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  Box,
  Typography,
  Fade,
  Backdrop
} from '@mui/material';
import {
  Close,
  Keyboard,
  PhotoCamera,
  Videocam,
  LibraryMusic,
  Business
} from '@mui/icons-material';
import UniversalKeyboardShortcuts from './UniversalKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor'
}

const PROFESSION_ICONS = {
  photographer: PhotoCamera,
  videographer: Videocam,
  music_producer: theming.getThemedIcon(''),
  vendor: Business
};

const PROFESSION_COLORS = {
  photographer: '#FF6B30',
  videographer: '#9C27B0', 
  music_producer: '#FF5720',
  vendor: '#2196F3', 
};

// PROFESSION_NAMES is now handled by useDynamicProfessions hook

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  open,
  onClose,
  profession
}) => {
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  const ProfessionIcon = profession ? PROFESSION_ICONS[profession] : Keyboard;
  const professionColor = profession ? PROFESSION_COLORS[profession] : '#FF6B35';
  const professionName = profession ? getProfessionDisplayName(profession) : 'Generell';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      TransitionComponent={Fade}
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 50,
        sx: {
          backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)'
    }
    }}
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(2, 5, 5,255,255,0.95) 0%, rgba(2, 5, 5,255,255,0.9) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(25,255,255,0.2)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          minHeight: '80vh',
          maxHeight: '90vh'
    }
    }}
    >
      <DialogTitle sx={{ 
        pb:  2,
        background: `linear-gradient(135deg, ${professionColor}15 0%, ${professionColor}05 100%)`,
        borderBottom: '1px solid rgba(0,0,0,0.08)'
    }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between' 
    }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <ProfessionIcon sx={{ 
              fontSize: '2rem', 
              color: professionColor,
              background: `${professionColor}20`,
              borderRadius: '50, %',
              p: 1 }} />
            <Box>
              <Typography variant="h5" sx={{  
                fontWeight: 'bold',
                color: professionColor,
                mb: 0.5  }}>
                Intelligente Hurtigtaster
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {professionName} Dashboard - Tilpassede hurtigtaster
              </Typography>
            </Box>
          </Box>
          <IconButton 
            onClick={onClose}
            sx={{ 
              color: 'text.secondary', '&:hover': {
                backgroundColor: `${professionColor}10`,
                color: professionColor
          }
          }}
          >
            {theming.getThemedIcon('close')}
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ 
        p:  0,
        overflow: 'hidden'
  }}>
        <Box sx={{ 
          height: '100%',
          overflow: 'auto', '&::-webkit-scrollbar': {
            width: '8px',
        }, '&::-webkit-scrollbar-track': {
            background: 'rgba(0,0,0,0.05)',
        }, '&::-webkit-scrollbar-thumb': {
            background: professionColor,
            borderRadius: '4px',
            opacity: 0.7 }, '&::-webkit-scrollbar-thumb: hover': {
            opacity: 1 }
      }}>
          <UniversalKeyboardShortcuts profession={profession} />
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p:  3,
        borderTop: '1px solid rgba(0,0,0,0.08)',
        background: `linear-gradient(135deg, ${professionColor}08 0%, ${professionColor}03 100%)`
    }}>
        <Button onClick={onClose}
          variant="contained"
          sx={{ 
            bgcolor: professionColor'&:hover': {
              bgcolor: professionColor,
              opacity: 0.9 },
            borderRadius:  2,
            px: 4 }}
         sx={theming.getThemedButtonSx()}>
          Lukk
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default KeyboardShortcutsModal;