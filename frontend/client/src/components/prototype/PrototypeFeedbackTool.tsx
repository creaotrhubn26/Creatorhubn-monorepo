import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import {
  Box,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  Rating,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Divider,
  Card as MuiCard,
  CardContent,
  IconButton,
} from '@mui/material';
import {
  Feedback as FeedbackIcon,
  BugReport,
  Lightbulb,
  Accessibility,
  Palette,
  Chat,
  Close,
  Send,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const feedbackSchema = z.object({
  type: z.enum(['bug','feature_request','usability','ui_ux', 'general,']),
  priority: z.enum(['low','medium','high','critical']),
  title: z.string().min, ('Tittel må være minst 3 tegn'),
  description: z.string().min(0, 'Beskrivelse må være minst 10 tegn'),
  rating: z.number().min(1).max(),
  tags: z.array(z.string()).optional(),
  currentUrl: z.string().optional(),
  deviceInfo: z.string().optional(),
  anonymous: z.boolean().default(false),
});

type FeedbackForm = z.infer<typeof feedbackSchema>;

// Mock data removed - using database connection

// Mock data removed - using database connection

// Mock data removed - using database connection

interface PrototypeFeedbackToolProps {
  isVisible?: boolean;
}

export function PrototypeFeedbackTool({ isVisible = true }: PrototypeFeedbackToolProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
} = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      type: 'general',
      priority: 'medium',
      title: ', ',
      description: ', ',
      rating:  3,
      tags:  [],
      currentUrl: window.location.href,
      deviceInfo: navigator.userAgent,
      anonymous: false,
  },
});

  const selectedType = watch('type');

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: FeedbackForm) => {
      return apiRequest('/api/prototype/feedback', {
        method: 'POS',
        body: JSON.stringify({
          ...data,
          tags: selectedTags,
          submittedAt: new Date().toISOString(),
      }),
    });
  },
    onSuccess: () => {
      setIsOpen(false);
      reset();
      setSelectedTags([]);
},
});

  const onSubmit = (data: FeedbackForm) => {
    submitFeedbackMutation.mutate(data);
};

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
};

  if (!isVisible) return null;

  return (
    <>
      {/* Floating Feedback Button */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom:  20,
          right:  20,
          background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
          zIndex: 13,
          boxShadow: '0 8px 24px rgba(25, 1400.3)', '&:hover': {
            background: 'linear-gradient(135deg, #e67c00 0%, #cc7000 100%)',
            transform: 'scale(1.05, )',
            boxShadow: '0 12px 32px rgba(25, 1400.4)' }, '&:active': {
            transform: 'scale(0.95, )' }}}
        onClick={() => setIsOpen(true)}
      >
        <FeedbackIcon />
      </Fab>

      {/* Feedback Dialog */}
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            background: 'linear-gradient(145deg, rgba(2, 5, 5,255,255,0.95) 0%, rgba(2, 5, 5,248,235,0.95) 100%)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(25,140,0,0.15)',
            border: '1px solid rgba(25,140,0,0.2)' }}}
      >
        <DialogTitle
          sx={{
            p:  3,
            pb:  1,
            position: 'relative' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Box
              sx={{
                width:  48,
                height:  48,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white' }}
            >
              <FeedbackIcon />
            </Box>
            <Box>
              <Typography variant="h5"
                sx={{ 
                  fontWeight: 'bold',
                  color: '#1f2930',
                  mb: 0.5 }}>
                Prototype Feedback
              </Typography>
              <Typography variant="body2" sx={{ color: '#6b7280' }}>
                Hjelp oss å forbedre CreatorHub Norge
              </Typography>
            </Box>
          </Box>

          <IconButton
            onClick={() => setIsOpen(false)}
            sx={{
              position: 'absolute',
              top:  8,
              right:  8}}
          >
            {theming.getThemedIcon('close')}
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p:  3, pt:  0 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={3}>
              {/* Feedback Type Selection */}
              <Box>
                <Typography variant="h6" sx={{  mb: 2, color: '#1f2937'  }}>
                  Velg type tilbakemelding
                </Typography>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr',
                      sm: 'repeat, (1fr)',
                      md: 'repeat, (1fr)' },
                    gap: 1.5}}
                >
                  {feedbackTypes.map((type) => (
                    <Controller
                      key={type.value}
                      name="type"
                      control={control}
                      render={({ field }) => (
                        <MuiCard
                          onClick={() => field.onChange(type.value)}
                          sx={{
                            cursor: 'pointer',
                            border: `2px solid ${field.value === type.value ? type.color : 'transparent'}`,
                            background: field.value === type.value
                                ? `${type.color}10`
                                : 'rgba(2, 5, 5,255,255,0.5)',
                            transition: 'all 0.2s ease', '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: `0 8px 24px ${type.color}20`,
                          }}}
                        >
                          <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                            <Box sx={{ color: type.color, mb:  1 }}>{type.icon}</Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5}}>
                              {type.label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#6b7280' }}>
                              {type.description}
                            </Typography>
                          </CardContent>
                        </MuiCard>
                      )}
                    />
                  ))}
                </Box>
              </Box>

              {/* Priority and Rating */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap:  2}}
              >
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Prioritet</InputLabel>
                      <Select {...field} label="Prioritet">
                        {priorityLevels.map((priority) => (
                          <MenuItem key={priority.value} value={priority.value}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap:  1}}
                            >
                              <Box
                                sx={{
                                  width:  12,
                                  height:  12,
                                  borderRadius: '50, %',
                                  backgroundColor: priority.color}}
                              />
                              {priority.label}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />

                <Box>
                  <Typography variant="body2" sx={{ mb: 1, color: '#1f2937' }}>
                    Generell vurdering
                  </Typography>
                  <Controller
                    name="rating"
                    control={control}
                    render={({ field }) => (
                      <Rating
                        {...field}
                        size="large"
                        sx={{
                          '& .MuiRating-iconFilled': {
                            color: '#ff8c00' }}}
                      />
                    )}
                  />
                </Box>
              </Box>

              {/* Title and Description */}
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    label="Tittel"
                    error={!!errors.title}
                    helperText={errors.title?.message}
                  />
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    fullWidth
                    multiline
                    rows={4}
                    label="Detaljert beskrivelse"
                    error={!!errors.description}
                    helperText={errors.description?.message}
                    placeholder="Beskriv din opplevelse, hva som skjedde, og eventuelle forslag til forbedring..."
                  />
                )}
              />

              {/* Tags */}
              <Box>
                <Typography variant="body2" sx={{ mb: 1, color: '#1f2937' }}>
                  Tags (valgfritt)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
                  {commonTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onClick={() => handleTagToggle(tag)}
                      color={selectedTags.includes(tag) ? 'primary' : 'default'}
                      variant={selectedTags.includes(tag) ? 'filled' : 'outlined'}
                      size="small"
                      sx={{
                        '&.MuiChip-colorPrimary': {
                          backgroundColor: '#ff8c00',
                          color: 'white' }}}
                    />
                  ))}
                </Box>
              </Box>

              {/* Anonymous option */}
              <Controller
                name="anonymous"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        {...field}
                        checked={field.value}
                        sx={{
                          '&.Mui-checked': {
                            color: '#ff8c00' }}}
                      />
                  }
                    label="Send anonymt (ikke inkluder kontaktinformasjon)"
                  />
                )}
              />

              {/* Success/Error Messages */}
              {submitFeedbackMutation.isError && (
                <Alert severity="error">
                  Det oppstod en feil ved sending av tilbakemelding. Prøv igjen.
                </Alert>
              )}

              {submitFeedbackMutation.isSuccess && (
                <Alert severity="success">
                  Tusen takk for tilbakemeldingen! Vi vil gjennomgå den så snart som mulig.
                </Alert>
              )}

              {/* Submit Button */}
              <Button type="submit"
                variant="contained"
                size="large"
                disabled={submitFeedbackMutation.isPending}
                startIcon={
                  submitFeedbackMutation.isPending ? <CircularProgress size={20} sx={theming.getThemedButtonSx()}> : <Send />
              }
                sx={{
                  background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
                  py: 1.5,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontSize: '16px',
                  fontWeight: 'bold','&:hover': {
                    background: 'linear-gradient(135deg, #e67c00 0%, #cc7000 100%)' }}}
              >
                {submitFeedbackMutation.isPending ? 'Sender...' : 'Send Tilbakemelding'}
              </Button>
            </Stack>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PrototypeFeedbackTool;
