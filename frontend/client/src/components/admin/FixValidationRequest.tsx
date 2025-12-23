import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Rating,
  Alert,
  CircularProgress,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import {
  CheckCircle,
  Error,
  ThumbUp,
  ThumbDown,
  Send
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface FeedbackItem {
  id: string;
  title: string;
  description: string;
  feedbackType: 'bug' | 'feature' | 'usability' | 'general' | 'ui_ux';
  priority: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  createdAt: string;
}

interface ValidationData {
  userConfirmed: boolean;
  userComments: string;
  userRating: number;
}

interface FixValidationRequestProps {
  feedbackId: string;
  fixId: string;
  feedback: FeedbackItem;
  onValidationSubmitted?: (validation: ValidationData) => void;
}

export default function FixValidationRequest({
  feedbackId,
  fixId,
  feedback,
  onValidationSubmitted
}: FixValidationRequestProps) {
  const [validation, setValidation] = useState<ValidationData>({
    userConfirmed: false,
    userComments: '',
    userRating: 0 });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const { auth } = useEnhancedMasterIntegration();

  // Theming system
  const theming = useTheming('prototype_tester');

  const submitValidationMutation = useMutation({
    mutationFn: async (validationData: ValidationData) => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/feedback/validate-fix`, {
        headers: {
          ...headers,
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify({
          feedbackId,
          fixId,
          validation: validationData
    })
    });
  },
    onSuccess: () => {
      setIsSubmitted(true);
      if (onValidationSubmitted) {
        onValidationSubmitted(validation);
  }
  },
    onError: (error) => {
      console.error('Failed to submit validation:', error);
  }
});

  const handleSubmit = async () => {
    if (validation.userRating === 0) {
      alert('Please provide a rating before submitting');
      return;
  }
    
    await submitValidationMutation.mutateAsync(validation);
};

  if (isSubmitted) {
    return (
      <Card sx={{ p:  3, maxWidth: 60, mx: 'auto', mt:  4, textAlign: 'center',  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <CheckCircle sx={{ fontSize:  64, color: 'success.main', mb:  2 }} />
          <Typography variant="h5" gutterBottom sx={{  color: theming.colors.primary }}>
            ✅ Validation Submitted Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Thank you for helping us verify this fix. Your feedback is invaluable for improving our platform.
          </Typography>
          
          <Box sx={{ mt:  3, p: 2, bgcolor: 'success.light', borderRadius:  1 }}>
            <Typography variant="subtitle2" gutterBottom>
              Your Validation Summary: </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center'}}>
              {validation.userConfirmed ? (
                <Chip icon={<ThumbUp />} label="Fix Confirmed" color="success" />
              ) : (
                <Chip icon={<ThumbDown />} label="Fix Failed" color="error" />
              )}
              <Rating value={validation.userRating} readOnly />
            </Box>
            {validation.userComments && (
              <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic'}}>
                "{validation.userComments}"
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    );
}

  return (
    <Card sx={{ p:  3, maxWidth: 60, mx: 'auto', mt:  4 ,  ...theming.getThemedCardSx() }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Typography variant="h5" gutterBottom sx={{  color: '#ff8c00', fontWeight: 'bold' }}>
          🔍 Verify Fix for Your Feedback
        </Typography>
        
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50',  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Original Issue: </Typography>
          <Typography variant="body1" sx={{ mb: 1 }}>
            <strong>{feedback.title}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
            {feedback.description}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
            <Chip 
              label={feedback.feedbackType.toUpperCase()} 
              size="small" 
              color="primary" 
            />
            <Chip 
              label={feedback.priority.toUpperCase()} 
              size="small" 
              sx={{ 
                bgcolor: feedback.priority === 'critical' ? '#f44336' : 
                        feedback.priority === 'high' ? '#ff9800' : '#4caf50',
                color: 'white'
          }} 
            />
            {feedback.component && (
              <Chip label={feedback.component} size="small" variant="outlined" />
            )}
          </Box>
        </Paper>

        <Alert severity="info" sx={{ mb:  3 }}>
          <Typography variant="body2">
            We've deployed a fix for the issue you reported. Please test it thoroughly and let us know if the problem has been resolved.
          </Typography>
        </Alert>

        <Box sx={{ mb:  3 }}>
          <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            {validation.userConfirmed ? <CheckCircle color="success" /> : <Error color="error" />}
            Did this fix resolve your original problem?
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb:  2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={validation.userConfirmed}
                  onChange={(e) => setValidation(prev => ({ ...prev, userConfirmed: e.target.checked }))}
                  color={validation.userConfirmed ? "success" : "error"}
                />
            }
              label={
                <Typography variant="body1" sx={{ fontWeight: 600}>
                  {validation.userConfirmed ? "Yes, it's fixed! ✅" : "No, still broken ❌"}
                </Typography>
            }
            />
          </Box>

          <Typography variant="body2" color="text.secondary">
            {validation.userConfirmed 
              ? "Great! Please rate the quality of the fix below." : "We're sorry the fix didn't work. Please describe what's still wrong so we can improve it."
          }
          </Typography>
        </Box>

        <Divider sx={{ my:  3 }} />

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Additional comments"
          placeholder={
            validation.userConfirmed 
              ? "Describe what you tested and any improvements you noticed..." : "Describe what's still wrong, what you tested, and any error messages you see..."
        }
          value={validation.userComments}
          onChange={(e) => setValidation(prev => ({ ...prev, userComments: e.target.value }))}
          sx={{ mb:  3 }}
        />

        <Box sx={{ mb:  3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
            Rate the fix quality: </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Rating
              value={validation.userRating}
              onChange={(_, value) => setValidation(prev => ({ ...prev, userRating: value || 0 }))}
              size="large"
            />
            <Typography variant="body2" color="text.secondary">
              {validation.userRating === 0 ? "Please provide a rating" :
               validation.userRating <= 2 ? "Poor" :
               validation.userRating <= 3 ? "Fair" :
               validation.userRating <= 4 ? "Good" : "Excellent"}
            </Typography>
          </Box>
        </Box>

        <Button variant="contained"
          onClick={handleSubmit}
          disabled={submitValidationMutation.isPending || validation.userRating === 0}
          fullWidth
          size="large"
          startIcon={submitValidationMutation.isPending ? <CircularProgress size={20}, sx={theming.getThemedButtonSx()}> : <Send />}
          sx={{
            bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00'},
            py: 1.5 }}
        >
          {submitValidationMutation.isPending ? 'Submitting...' : 'Submit Validation'}
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', textAlign: 'center'}}>
          Your validation helps us ensure fixes are working correctly and improve our development process.
        </Typography>
      </CardContent>
    </Card>
  );
}


