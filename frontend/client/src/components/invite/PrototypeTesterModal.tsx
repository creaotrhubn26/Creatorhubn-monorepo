// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { AutoAwesome, EditNote } from '@mui/icons-material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { createFeedbackLocationContext } from '../../utils/feedbackLocationTracker';
import NoteEditor from '../notes/NoteEditor';
import { useTheming } from '../../utils/theming-helper';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';

type ProfessionValue = 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'other';
type ExperienceValue = 'beginner' | 'intermediate' | 'advanced' | 'expert';

type LocationContext = ReturnType<typeof createFeedbackLocationContext>;

const prototypeTesterSchema = z.object({
  name: z.string().min(2, 'Navn ma vaere minst 2 tegn'),
  email: z.string().email('Ugyldig e-postadresse'),
  company: z.string().optional(),
  profession: z.enum(['photographer', 'videographer', 'music_producer', 'vendor', 'other']),
  testingAreas: z.array(z.string()).min(1, 'Velg minst ett omrade a teste'),
  experience: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  feedback: z.string().min(10, 'Beskriv hva du onsker a teste (minst 10 tegn)'),
  availableTime: z.string().min(1, 'Angi tilgjengelig tid'),
  deviceInfo: z.string().optional(),
  hasAgreedToTerms: z.boolean().refine((value) => value, 'Du ma godta vilkarene'),
  locationContext: z
    .object({
      profession: z.string(),
      dashboardType: z.string(),
      currentTab: z.string(),
      currentSection: z.string(),
      specificFeature: z.string().optional(),
      pageUrl: z.string(),
      userAgent: z.string(),
      timestamp: z.string(),
    })
    .optional(),
  detailedFeedback: z.string().optional(),
  testingNotes: z.string().optional(),
  expectations: z.string().optional(),
});

type PrototypeTesterData = z.infer<typeof prototypeTesterSchema>;

const professionOptions: Array<{ value: ProfessionValue; label: string; color: string }> = [
  { value: 'photographer', label: 'Fotograf', color: '#FF6B35' },
  { value: 'videographer', label: 'Videograf', color: '#9C27B0' },
  { value: 'music_producer', label: 'Musikkprodusent', color: '#FF5722' },
  { value: 'vendor', label: 'Leverandor', color: '#2196F3' },
  { value: 'other', label: 'Annet', color: '#607D8B' },
];

const testingAreaOptions = [
  { value: 'photo_editing', label: 'Fotoredigering', icon: '📸' },
  { value: 'video_production', label: 'Videoproduksjon', icon: '🎬' },
  { value: 'audio_editing', label: 'Lydredigering', icon: '🎵' },
  { value: 'project_management', label: 'Prosjektledelse', icon: '📋' },
  { value: 'client_communication', label: 'Kundekommunikasjon', icon: '💬' },
  { value: 'portfolio_management', label: 'Portefoljeadministrasjon', icon: '🎨' },
  { value: 'equipment_management', label: 'Utstyrsadministrasjon', icon: '📱' },
  { value: 'social_media', label: 'Sosiale medier', icon: '📲' },
  { value: 'billing_invoicing', label: 'Fakturering', icon: '💰' },
  { value: 'ai_features', label: 'AI-funksjoner', icon: '🤖' },
  { value: 'universal_dashboard', label: 'Universal Dashboard', icon: '🌐' },
  { value: 'location_tracking', label: 'Lokasjonssporing', icon: '📍' },
  { value: 'performance_monitoring', label: 'Ytelsesovervaking', icon: '⚡' },
];

const experienceOptions: Array<{ value: ExperienceValue; label: string }> = [
  { value: 'beginner', label: 'Nybegynner (0-1 ar)' },
  { value: 'intermediate', label: 'Mellom (2-5 ar)' },
  { value: 'advanced', label: 'Avansert (5+ ar)' },
  { value: 'expert', label: 'Ekspert (10+ ar)' },
];

interface PrototypeTesterModalProps {
  open: boolean;
  onClose: () => void;
}

const logoCreatorHub = '/creatorhub-icon.png';

export default function PrototypeTesterModal({ open, onClose }: PrototypeTesterModalProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteEditorMode, setNoteEditorMode] = useState<'detailedFeedback' | 'testingNotes' | 'expectations'>('detailedFeedback');
  const { profession: activeProfession } = useProfessionAdapter();
  const theming = useTheming(activeProfession ?? 'photographer');
  const masterIntegration = useEnhancedMasterIntegration();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isValid },
  } = useForm<PrototypeTesterData>({
    resolver: zodResolver(prototypeTesterSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      company: '',
      profession: 'photographer',
      testingAreas: [],
      experience: 'intermediate',
      feedback: '',
      availableTime: '',
      deviceInfo: '',
      hasAgreedToTerms: false,
      detailedFeedback: '',
      testingNotes: '',
      expectations: '',
    },
  });

  const selectedProfession = watch('profession');
  const testingAreas = watch('testingAreas');
  const noteEditorValue = watch(noteEditorMode);

  const selectedProfessionColor = useMemo(() => {
    return professionOptions.find((entry) => entry.value === selectedProfession)?.color ?? '#FF6B35';
  }, [selectedProfession]);

  const submitPrototypeTesterMutation = useMutation({
    mutationFn: async (data: PrototypeTesterData) => {
      return await apiRequest('/api/invites/prototype-tester', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      setIsSubmitted(true);
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    masterIntegration.analytics.trackEvent('prototype_tester_modal_opened', {
      timestamp: Date.now(),
      profession: activeProfession ?? 'unknown',
    });
  }, [activeProfession, masterIntegration.analytics, open]);

  const onSubmit = (data: PrototypeTesterData) => {
    const locationContext: LocationContext = createFeedbackLocationContext(data.profession, 'prototype_tester_modal', {
      tab: 'prototype_tester_application',
      section: 'application_form',
      feature: 'tester_registration',
      component: 'PrototypeTesterModal',
    });

    const payload: PrototypeTesterData = {
      ...data,
      locationContext,
    };

    masterIntegration.analytics.trackEvent('prototype_tester_application_submitted', {
      profession: data.profession,
      testingAreasCount: data.testingAreas.length,
      experience: data.experience,
      timestamp: Date.now(),
    });

    submitPrototypeTesterMutation.mutate(payload);
  };

  const handleClose = () => {
    setShowNoteEditor(false);
    setIsSubmitted(false);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box component="img" src={logoCreatorHub} alt="CreatorHub" sx={{ width: 36, height: 36 }} />
          <Box>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Prototype Tester Application
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hjelp oss teste nye funksjoner med profesjonell feedback.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {isSubmitted ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              Takk for soknaden!
            </Typography>
            <Typography color="text.secondary">
              Vi kontakter deg snart med neste steg for prototype-testing.
            </Typography>
          </Box>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Navn" fullWidth error={Boolean(errors.name)} helperText={errors.name?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="E-post"
                      type="email"
                      fullWidth
                      error={Boolean(errors.email)}
                      helperText={errors.email?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="company"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Firma (valgfritt)" fullWidth />}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="profession"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={Boolean(errors.profession)}>
                      <InputLabel id="profession-label">Profesjon</InputLabel>
                      <Select {...field} labelId="profession-label" label="Profesjon">
                        {professionOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Testomrader
                </Typography>
                <Controller
                  name="testingAreas"
                  control={control}
                  render={({ field }) => (
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                      {testingAreaOptions.map((area) => {
                        const selected = field.value.includes(area.value);
                        return (
                          <Chip
                            key={area.value}
                            label={`${area.icon} ${area.label}`}
                            color={selected ? 'primary' : 'default'}
                            onClick={() => {
                              const next = selected
                                ? field.value.filter((value) => value !== area.value)
                                : [...field.value, area.value];
                              field.onChange(next);
                            }}
                            sx={selected ? { bgcolor: selectedProfessionColor, color: '#fff' } : undefined}
                          />
                        );
                      })}
                    </Stack>
                  )}
                />
                {errors.testingAreas ? (
                  <Typography variant="caption" color="error">
                    {errors.testingAreas.message}
                  </Typography>
                ) : null}
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="experience"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel id="experience-label">Erfaring</InputLabel>
                      <Select {...field} labelId="experience-label" label="Erfaring">
                        {experienceOptions.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="availableTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Tilgjengelig tid"
                      placeholder="f.eks. 3-5 timer per uke"
                      fullWidth
                      error={Boolean(errors.availableTime)}
                      helperText={errors.availableTime?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Controller
                  name="feedback"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Hva onsker du a teste?"
                      multiline
                      rows={4}
                      fullWidth
                      error={Boolean(errors.feedback)}
                      helperText={errors.feedback?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Controller
                  name="deviceInfo"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Enhet / OS (valgfritt)"
                      fullWidth
                      placeholder="f.eks. MacBook Pro, macOS 15, Chrome 145"
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Button
                    size="small"
                    variant={showNoteEditor ? 'contained' : 'outlined'}
                    startIcon={<EditNote />}
                    onClick={() => setShowNoteEditor((prev) => !prev)}
                  >
                    {showNoteEditor ? 'Skjul NoteEditor' : 'Apen NoteEditor'}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AutoAwesome />}
                    onClick={() => {
                      setNoteEditorMode('detailedFeedback');
                      setShowNoteEditor(true);
                    }}
                  >
                    Detaljert feedback
                  </Button>
                </Stack>

                {showNoteEditor ? (
                  <Stack spacing={1}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="note-mode-label">Notatfelt</InputLabel>
                      <Select
                        labelId="note-mode-label"
                        value={noteEditorMode}
                        label="Notatfelt"
                        onChange={(event) =>
                          setNoteEditorMode(
                            event.target.value as 'detailedFeedback' | 'testingNotes' | 'expectations',
                          )
                        }
                      >
                        <MenuItem value="detailedFeedback">Detaljert feedback</MenuItem>
                        <MenuItem value="testingNotes">Testing-notater</MenuItem>
                        <MenuItem value="expectations">Forventninger</MenuItem>
                      </Select>
                    </FormControl>

                    <NoteEditor
                      value={noteEditorValue ?? ''}
                      onChange={(html) => {
                        setValue(noteEditorMode, html, { shouldDirty: true, shouldValidate: true });
                      }}
                    />
                  </Stack>
                ) : null}
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Controller
                  name="hasAgreedToTerms"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={field.value}
                          onChange={(event) => field.onChange(event.target.checked)}
                        />
                      }
                      label="Jeg godtar at feedback brukes til produktforbedring"
                    />
                  )}
                />
                {errors.hasAgreedToTerms ? (
                  <Typography variant="caption" color="error">
                    {errors.hasAgreedToTerms.message}
                  </Typography>
                ) : null}
              </Grid>
            </Grid>
          </form>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Lukk</Button>
        {!isSubmitted ? (
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={!isValid || submitPrototypeTesterMutation.isPending || testingAreas.length === 0}
            sx={theming.getThemedButtonSx('primary')}
          >
            {submitPrototypeTesterMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Send soknad'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
