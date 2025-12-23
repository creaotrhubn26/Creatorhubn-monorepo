/**
 * ENHANCEMENT RATING DIALOG
 * Reusable component for collecting user feedback on AI enhancements
 * Used by: CreatorHubPhotoEnhancer, AudioEnhancementSuite, StoryArcStudio
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Rating,
  TextField,
  Typography,
  Box,
  Stack,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Star,
  StarBorder,
  ThumbUp,
  Send,
  Close,
} from '@mui/icons-material';

interface EnhancementRatingDialogProps {
  open: boolean;
  onClose: () => void;
  enhancementType: 'photo' | 'video' | 'audio';
  originalUrl?: string;
  enhancedUrl?: string;
  onSubmitRating: (rating: number, feedback: string) => Promise<void>;
  title?: string;
  description?: string;
}

const EnhancementRatingDialog: React.FC<EnhancementRatingDialogProps> = ({
  open,
  onClose,
  enhancementType,
  originalUrl,
  enhancedUrl,
  onSubmitRating,
  title,
  description,
}) => {
  const [rating, setRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      return; // Require at least 1 star
    }

    setIsSubmitting(true);
    try {
      await onSubmitRating(rating, feedback);
      setSubmitted(true);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      console.error('Error submitting rating: ', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setFeedback(', ');
    setSubmitted(false);
    onClose();
  };

  const getTypeLabel = () => {
    switch (enhancementType) {
      case 'photo': return 'Bildeforbedring';
      case 'audio': return 'Lydforbedring';
      case 'video': return 'Videoredigering';
      default: return 'Forbedring';
    }
  };

  const getTypeColor = () => {
    switch (enhancementType) {
      case 'photo': return '#ff8c00';
      case 'audio': return '#9333ea';
      case 'video': return '#e74c3c';
      default: return '#3b82f6';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: `2px solid ${getTypeColor()}40`,
        }
      }}
    >
      <DialogTitle sx={{ 
        background: `linear-gradient(135deg, ${getTypeColor()}20 0%, ${getTypeColor()}10 100%)`,
        borderBottom: `1px solid ${getTypeColor()}20`}}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ThumbUp sx={{ color: getTypeColor() }} />
          <Typography variant="h6" sx={{ fontWeight: 600}}>
            {title || `Vurder ${getTypeLabel()}`}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {submitted ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            ✅ Takk for tilbakemeldingen! Dette hjelper oss å forbedre AI-modellene.
          </Alert>
        ) : (
          <Stack spacing={3}>
            {description && (
              <Typography variant="body2" color="text.secondary">
                {description}
              </Typography>
            )}

            {/* Star Rating */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                Hvor fornøyd er du med resultatet?
              </Typography>
              <Rating
                value={rating}
                onChange={(_, newValue) => setRating(newValue || 0)}
                size="large"
                icon={<Star fontSize="inherit" />}
                emptyIcon={<StarBorder fontSize="inherit" />}
                sx={{
                  '& .MuiRating-iconFilled': {
                    color: getTypeColor(),
                  }, '& .MuiRating-iconHover': {
                    color: getTypeColor(),
                  }}}
              />
              {rating > 0 && (
                <Chip 
                  label={
                    rating === 5 ? 'Utmerket!' :
                    rating === 4 ? 'Veldig bra' :
                    rating === 3 ? 'Bra' :
                    rating === 2 ? 'OK' : 'Trenger forbedring'
                  }
                  size="small"
                  sx={{ 
                    mt: 1,
                    bgcolor: `${getTypeColor()}20`,
                    color: getTypeColor(),
                    fontWeight: 600}}
                />
              )}
            </Box>

            {/* Optional Feedback */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                Tilbakemelding (valgfritt)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Hva kan forbedres? (f.eks. 'for skarp','farger litt off', 'perfekt!')"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': {
                      borderColor: getTypeColor(),
                    },
                  }}}
              />
            </Box>

            {/* Info */}
            <Alert severity="info" sx={{ fontSize: '0.875rem' }}>
              💡 Din tilbakemelding brukes til å trene AI-modellene slik at de blir bedre for norske fotografer og kreative!
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button
          onClick={handleClose}
          disabled={isSubmitting}
          startIcon={<Close />}
        >
          {submitted ? 'Lukk' : 'Avbryt'}
        </Button>
        {!submitted && (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={rating === 0 || isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : <Send />}
            sx={{
              bgcolor: getTypeColor(),
              '&:hover': {
                bgcolor: getTypeColor(),
                opacity: 0.9,
              },
              '&:disabled': {
                bgcolor: '#ccc',
              }
            }}
          >
            {isSubmitting ? 'Sender...' : 'Send vurdering'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EnhancementRatingDialog;

