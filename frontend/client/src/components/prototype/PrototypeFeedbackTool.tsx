import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Fab,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Rating,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Accessibility,
  BugReport,
  Chat,
  Close,
  Feedback as FeedbackIcon,
  Lightbulb,
  Palette,
  Send,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';

const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature_request', 'usability', 'ui_ux', 'general']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(3, 'Tittel må være minst 3 tegn'),
  description: z.string().min(10, 'Beskrivelse må være minst 10 tegn'),
  rating: z.number().min(1).max(5),
  tags: z.array(z.string()).default([]),
  currentUrl: z.string().optional(),
  deviceInfo: z.string().optional(),
  anonymous: z.boolean().default(false),
});

type FeedbackForm = z.infer<typeof feedbackSchema>;

interface PrototypeFeedbackToolProps {
  isVisible?: boolean;
  profession?: string;
  component?: string;
  communityContext?: boolean;
  communityComponent?: string;
}

const feedbackTypes = [
  {
    value: 'bug' as const,
    label: 'Bug',
    icon: <BugReport fontSize="small" />,
    description: 'Noe fungerer ikke som forventet.',
    color: '#ef4444',
  },
  {
    value: 'feature_request' as const,
    label: 'Feature',
    icon: <Lightbulb fontSize="small" />,
    description: 'Forslag til ny funksjon eller forbedring.',
    color: '#f59e0b',
  },
  {
    value: 'usability' as const,
    label: 'Usability',
    icon: <Accessibility fontSize="small" />,
    description: 'Arbeidsflyt/brukervennlighet kan forbedres.',
    color: '#3b82f6',
  },
  {
    value: 'ui_ux' as const,
    label: 'UI/UX',
    icon: <Palette fontSize="small" />,
    description: 'Visuelle eller interaksjonsrelaterte forbedringer.',
    color: '#8b5cf6',
  },
  {
    value: 'general' as const,
    label: 'General',
    icon: <Chat fontSize="small" />,
    description: 'Generell tilbakemelding.',
    color: '#10b981',
  },
];

const priorityLevels = [
  { value: 'low' as const, label: 'Lav', color: '#9ca3af' },
  { value: 'medium' as const, label: 'Medium', color: '#3b82f6' },
  { value: 'high' as const, label: 'Høy', color: '#f59e0b' },
  { value: 'critical' as const, label: 'Kritisk', color: '#ef4444' },
];

const commonTags = [
  'timeline',
  'program-monitor',
  'drag-drop',
  'captions',
  'rendering',
  'performance',
  'keyboard-shortcuts',
  'workspace',
  'audio-sync',
  'stability',
];

export function PrototypeFeedbackTool({
  isVisible = true,
  profession = 'unknown',
  component = 'Unknown',
  communityContext = false,
  communityComponent,
}: PrototypeFeedbackToolProps): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      type: 'general',
      priority: 'medium',
      title: '',
      description: '',
      rating: 3,
      tags: [],
      currentUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      anonymous: false,
    },
  });

  const selectedTypeMeta = useMemo(
    () => feedbackTypes.find((item) => item.value === 'general') ?? feedbackTypes[0],
    [],
  );

  const submitFeedbackMutation = useMutation({
    mutationFn: async (data: FeedbackForm) => {
      const payload = {
        ...data,
        tags: selectedTags,
        submittedAt: new Date().toISOString(),
        metadata: {
          profession,
          component,
          communityContext,
          communityComponent: communityComponent ?? null,
        },
      };

      return apiRequest('/api/prototype/feedback', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setSubmitSuccess(true);
      setSelectedTags([]);
      reset({
        type: 'general',
        priority: 'medium',
        title: '',
        description: '',
        rating: 3,
        tags: [],
        currentUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        anonymous: false,
      });
    },
  });

  const handleTagToggle = (tag: string): void => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const onSubmit = (data: FeedbackForm): void => {
    setSubmitSuccess(false);
    submitFeedbackMutation.mutate({ ...data, tags: selectedTags });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <Fab
        color="primary"
        aria-label="open feedback tool"
        onClick={() => setIsOpen(true)}
        sx={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 1300,
          background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #e67c00 0%, #cc7000 100%)',
          },
        }}
      >
        <FeedbackIcon />
      </Fab>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FeedbackIcon color="primary" />
              <Box>
                <Typography variant="h6">Prototype Feedback</Typography>
                <Typography variant="body2" color="text.secondary">
                  Component: {component} • Profession: {profession}
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={() => setIsOpen(false)} aria-label="close feedback dialog">
              <Close />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2.5}>
              {communityContext ? (
                <Alert severity="info">
                  Community context enabled{communityComponent ? ` (${communityComponent})` : ''}.
                </Alert>
              ) : null}

              <Grid container spacing={1.5}>
                {feedbackTypes.map((type) => (
                  <Grid item xs={12} sm={6} md={4} key={type.value}>
                    <Controller
                      name="type"
                      control={control}
                      render={({ field }) => (
                        <Card
                          variant="outlined"
                          sx={{
                            cursor: 'pointer',
                            borderColor: field.value === type.value ? type.color : 'divider',
                            backgroundColor:
                              field.value === type.value ? `${type.color}14` : 'transparent',
                          }}
                          onClick={() => field.onChange(type.value)}
                        >
                          <CardContent sx={{ py: 1.5 }}>
                            <Stack spacing={0.5}>
                              <Stack direction="row" spacing={1} alignItems="center" color={type.color}>
                                {type.icon}
                                <Typography variant="subtitle2">{type.label}</Typography>
                              </Stack>
                              <Typography variant="caption" color="text.secondary">
                                {type.description}
                              </Typography>
                            </Stack>
                          </CardContent>
                        </Card>
                      )}
                    />
                  </Grid>
                ))}
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="priority"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth>
                        <InputLabel id="feedback-priority-label">Prioritet</InputLabel>
                        <Select
                          {...field}
                          labelId="feedback-priority-label"
                          label="Prioritet"
                        >
                          {priorityLevels.map((priority) => (
                            <MenuItem key={priority.value} value={priority.value}>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    backgroundColor: priority.color,
                                  }}
                                />
                                <Typography variant="body2">{priority.label}</Typography>
                              </Stack>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Vurdering
                  </Typography>
                  <Controller
                    name="rating"
                    control={control}
                    render={({ field }) => (
                      <Rating
                        value={field.value}
                        onChange={(_event, value) => {
                          if (value !== null) {
                            field.onChange(value);
                          }
                        }}
                        size="large"
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Tittel"
                    fullWidth
                    error={Boolean(errors.title)}
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
                    label="Detaljert beskrivelse"
                    fullWidth
                    multiline
                    rows={4}
                    error={Boolean(errors.description)}
                    helperText={errors.description?.message}
                  />
                )}
              />

              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Tags
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {commonTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      clickable
                      color={selectedTags.includes(tag) ? 'primary' : 'default'}
                      onClick={() => handleTagToggle(tag)}
                    />
                  ))}
                </Stack>
              </Box>

              <Controller
                name="anonymous"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Checkbox checked={field.value} onChange={field.onChange} />}
                    label="Send anonymt"
                  />
                )}
              />

              {submitFeedbackMutation.isError ? (
                <Alert severity="error">Kunne ikke sende feedback. Prøv igjen.</Alert>
              ) : null}
              {submitSuccess ? (
                <Alert severity="success">Takk. Tilbakemeldingen ble sendt.</Alert>
              ) : null}

              <Button
                type="submit"
                variant="contained"
                disabled={submitFeedbackMutation.isPending}
                startIcon={
                  submitFeedbackMutation.isPending ? (
                    <CircularProgress size={18} color="inherit" />
                  ) : (
                    <Send />
                  )
                }
              >
                {submitFeedbackMutation.isPending ? 'Sender...' : 'Send Feedback'}
              </Button>

              <Typography variant="caption" color="text.secondary">
                Default type: {selectedTypeMeta.label}
              </Typography>
            </Stack>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PrototypeFeedbackTool;
