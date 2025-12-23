/**
 * Rate Cloned Project Dialog
 * 
 * Prompts users to rate a cloned virtual studio setup after they've tested it.
 * Helps improve recommendations and gives credit to original authors.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Rating,
  TextField,
  Stack,
  Divider,
  FormControlLabel,
  Checkbox,
  Alert,
  IconButton,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Close,
  Star,
  ThumbUp,
  Send,
  Person,
} from '@mui/icons-material';

interface RateClonedProjectDialogProps {
  open: boolean;
  onClose: () => void;
  clonedProjectId: string;
  publishedStudioId: string;
  originalTitle: string;
  authorName?: string;
  onRatingSubmitted?: () => void;
}

export const RateClonedProjectDialog: React.FC<RateClonedProjectDialogProps> = ({
  open,
  onClose,
  clonedProjectId,
  publishedStudioId,
  originalTitle,
  authorName,
  onRatingSubmitted,
}) => {
  const [loading, setLoading] = useState(false);
  
  // Ratings
  const [overallRating, setOverallRating] = useState<number>(0);
  const [easeOfUseRating, setEaseOfUseRating] = useState<number>(0);
  const [qualityRating, setQualityRating] = useState<number>(0);
  const [accuracyRating, setAccuracyRating] = useState<number>(0);
  
  // Feedback
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [pros, setPros] = useState('');
  const [cons, setCons] = useState('');
  const [usedFor, setUsedFor] = useState('');
  const [modificationsMade, setModificationsMade] = useState(', ');
  const [wouldRecommend, setWouldRecommend] = useState(true);

  const handleSubmit = async () => {
    if (overallRating === 0) {
      alert('Please provide an overall rating');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/virtual-studio/rate', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          clonedProjectId,
          publishedStudioId,
          overallRating,
          easeOfUseRating: easeOfUseRating || null,
          qualityRating: qualityRating || null,
          accuracyRating: accuracyRating || null,
          reviewTitle: reviewTitle.trim() || null,
          reviewText: reviewText.trim() || null,
          pros: pros.trim() || null,
          cons: cons.trim() || null,
          usedFor: usedFor.trim() || null,
          modificationsMade: modificationsMade.trim() || null,
          wouldRecommend,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      alert('Thank you for your feedback! Your rating helps the community.');
      onRatingSubmitted?.();
      onClose();
    } catch (error) {
      console.error('Error submitting rating: ', error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Rate This Setup</Typography>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Header */}
          <Alert severity="info" icon={<ThumbUp />}>
            <Typography variant="body2" fontWeight="bold" gutterBottom>
              Now that you've tested "{originalTitle},"
            </Typography>
            <Typography variant="caption">
              Your feedback helps {authorName || 'the author'} and other users improve their projects!
            </Typography>
          </Alert>

          {/* Author Attribution */}
          {authorName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Person fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Created by <strong>{authorName}</strong>
              </Typography>
            </Box>
          )}

          <Divider />

          {/* Overall Rating */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Overall Rating *
            </Typography>
            <Rating
              value={overallRating}
              onChange={(_, value) => setOverallRating(value || 0)}
              size="large"
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              How would you rate this setup overall?
            </Typography>
          </Box>

          {/* Detailed Ratings */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Detailed Ratings (Optional)
            </Typography>
            
            <Stack spacing={2}>
              {/* Ease of Use */}
              <Box>
                <Typography variant="body2" gutterBottom>
                  Ease of Use
                </Typography>
                <Rating
                  value={easeOfUseRating}
                  onChange={(_, value) => setEaseOfUseRating(value || 0)}
                  size="small"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  How easy was it to set up and use?
                </Typography>
              </Box>

              {/* Quality */}
              <Box>
                <Typography variant="body2" gutterBottom>
                  Quality
                </Typography>
                <Rating
                  value={qualityRating}
                  onChange={(_, value) => setQualityRating(value || 0)}
                  size="small"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  How good were the results?
                </Typography>
              </Box>

              {/* Accuracy */}
              <Box>
                <Typography variant="body2" gutterBottom>
                  Accuracy
                </Typography>
                <Rating
                  value={accuracyRating}
                  onChange={(_, value) => setAccuracyRating(value || 0)}
                  size="small"
                />
                <Typography variant="caption" color="text.secondary" display="block">
                  How accurate was the description vs actual results?
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Divider />

          {/* Review Title */}
          <TextField
            label="Review Title (Optional)"
            value={reviewTitle}
            onChange={(e) => setReviewTitle(e.target.value)}
            fullWidth
            placeholder="e.g.'Perfect for portrait photography'"
          />

          {/* Review Text */}
          <TextField
            label="Your Review (Optional)"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            fullWidth
            multiline
            rows={3}
            placeholder="Share your experience with this setup..."
          />

          {/* Pros */}
          <TextField
            label="What Worked Well? (Optional)"
            value={pros}
            onChange={(e) => setPros(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="e.g.'Great lighting balance, easy to adjust', "
          />

          {/* Cons */}
          <TextField
            label="What Could Be Improved? (Optional)"
            value={cons}
            onChange={(e) => setCons(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="e.g.'Could use more detailed instructions', "
          />

          {/* Used For */}
          <TextField
            label="What Did You Use It For? (Optional)"
            value={usedFor}
            onChange={(e) => setUsedFor(e.target.value)}
            fullWidth
            placeholder="e.g.'Product photography for my online store', "
          />

          {/* Modifications */}
          <TextField
            label="What Changes Did You Make? (Optional)"
            value={modificationsMade}
            onChange={(e) => setModificationsMade(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="e.g.'Added an extra fill light on the left side'"
          />

          {/* Would Recommend */}
          <FormControlLabel
            control={
              <Checkbox
                checked={wouldRecommend}
                onChange={(e) => setWouldRecommend(e.target.checked)}
              />
            }
            label="I would recommend this setup to others"
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Skip for Now
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || overallRating === 0}
          startIcon={loading ? <CircularProgress size={20} /> : <Send />}
        >
          {loading ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

