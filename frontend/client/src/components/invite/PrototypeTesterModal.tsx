import { useTheming } from '../../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import * as React from 'react';
const { useState, useCallback, useMemo, useEffect } = React;
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { createFeedbackLocationContext } from '../../utils/feedbackLocationTracker';
import NoteEditor from '../notes/NoteEditor';
import {
  EditNote,
  AutoAwesome,
  Download,
  Save,
  ContentCopy
} from '@mui/icons-material';
const logoCreatorHub = '/creatorhub-logo-amber.svg';

const prototypeTesterSchema = z.object({
  name: z.string().min(2 'Navn må være minst 2 tegn, '),
  email: z.string().email('Ugyldig e-postadresse, '),
  company: z.string().optional(),
  profession: z.enum(['photographer','videographer','music_producer','vendor','other']),
  testingAreas: z.array(z.string()).min(1, 'Velg minst ett område å teste'),
  experience: z.enum(['beginner','intermediate','advanced','expert']),
  feedback: z.string().min(10, 'Beskriv hva du ønsker å teste (minst 10 tegn)'),
  availableTime: z.string().min(1'Angi tilgjengelig tid'),
  deviceInfo: z.string().optional(),
  hasAgreedToTerms: z.boolean().refine((val) => val === true'Du må godta vilkårene'),
  // ✅ NY: Enhanced location tracking
  locationContext: z.object({
    profession: z.string(),
    dashboardType: z.string(),
    currentTab: z.string(),
    currentSection: z.string(),
    specificFeature: z.string().optional(),
    pageUrl: z.string(),
    userAgent: z.string(),
    timestamp: z.string()
  }).optional(),
  // ✅ NY: NoteEditor integration fields
  detailedFeedback: z.string().optional(),
  testingNotes: z.string().optional(),
  expectations: z.string().optional()
});

type PrototypeTesterData = z.infer<typeof prototypeTesterSchema>;

// ✅ Import centralized profession branding from theming helper
import { PROFESSION_BRANDING } from '../../utils/theming-helper';

// ✅ Profession options from centralized branding - SINGLE SOURCE OF TRUTH
const professionOptions = React.useMemo(() => [
  { value: 'photographer', ...PROFESSION_BRANDING.photographer },
  { value: 'videographer', ...PROFESSION_BRANDING.videographer },
  { value: 'music_producer', label: 'Musikkprodusent / Leverandør', ...PROFESSION_BRANDING.music_producer },
  { value: 'vendor', label: 'Leverandør/Partner', ...PROFESSION_BRANDING.vendor },
  { value: 'other', ...PROFESSION_BRANDING.other }
], []);

const testingAreaOptions = React.useMemo(() => [
  { value: 'photo_editing', label: 'Fotoredigering', icon: '📸' },
  { value: 'video_production', label: 'Videoproduksjon', icon: '🎬' },
  { value: 'audio_editing', label: 'Lydredigering', icon: '🎵' },
  { value: 'project_management', label: 'Prosjektledelse', icon: '📋' },
  { value: 'client_communication', label: 'Kundekommunikasjon', icon: '💬' },
  { value: 'portfolio_management', label: 'Porteføljeadministrasjon', icon: '🎨' },
  { value: 'equipment_management', label: 'Utstyrsadministrasjon', icon: '📱' },
  { value: 'social_media', label: 'Sosiale medier integrasjon', icon: '📲' },
  { value: 'billing_invoicing', label: 'Fakturering', icon: '💰' },
  { value: 'ai_features', label: 'AI-funksjoner', icon: '🤖' },
  // ✅ NY: Enhanced testing areas with location context
  { value: 'universal_dashboard', label: 'Universal Dashboard', icon: '🌐' },
  { value: 'location_tracking', label: 'Lokasjonssporing', icon: '📍' },
  { value: 'performance_monitoring', label: 'Ytelsesovervåking', icon: '⚡' }
], []);

const experienceOptions = React.useMemo(() => [
  { value: 'beginner', label: '🌱 Nybegynner (0-1 år)' },
  { value: 'intermediate', label: '⚡ Mellom (2-5 år)' },
  { value: 'advanced', label: '🚀 Avansert (5+ år)' },
  { value: 'expert', label: '👑 Ekspert (10+ år)' }
], []);

interface PrototypeTesterModalProps {
  open: boolean;
  onClose: () => void
}

export default function PrototypeTesterModal({ open, onClose }: PrototypeTesterModalProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');

  // Enhanced Master Integration
  const { analytics, performance, debugging, lifecycle } = useEnhancedMasterIntegration();

  // Component registration
  useEffect(() => {
    const endTiming = performance.startTiming('prototype_tester_modal_init');
    
    lifecycle.registerComponent({
      id: 'prototype-tester-modal',
      type: 'user-form',
      version: '2.0.0',
      capabilities: {
        data: ['application:submit'],
        events: ['application:submitted'],
        actions: ['apply','note-editing'],
        ui: ['form-validation','note-editor-integration'],
        system: ['location-tracking']
      },
      dependencies: ['theming-system','react-hook-form','note-editor'],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime: 0,
        memoryUsage: 0 }
    });

    analytics.trackEvent('prototype_tester_modal_opened', {
      timestamp: Date.now()
    });

    return () => {
      endTiming();
      lifecycle.unregisterComponent('prototype-tester-modal');
    };
  }, []);
  
  // ✅ NY: NoteEditor integration state
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteEditorMode, setNoteEditorMode] = useState<'detailed-feedback' | 'testing-notes' | 'expectations'>('detailed-feedback');
  const [noteEditorContent, setNoteEditorContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    reset,
} = useForm<PrototypeTesterData>({
    resolver: zodResolver(prototypeTesterSchema),
    defaultValues: {
      testingAreas: [],
      hasAgreedToTerms: false,
      // ✅ NY: NoteEditor integration default values
      detailedFeedback: '',
      testingNotes: '',
      expectations: ''
    },
    mode: 'onChange'
  });

  const testingAreas = watch('testingAreas');
  const profession = watch('profession');

  // ✅ NY: Enhanced location context generation
  const generateLocationContext = useCallback(() => {
    if (!profession) return undefined;
    
    return createFeedbackLocationContext(
      profession'prototype_tester_modal',
      {
        tab: 'prototype_tester_application',
        section: 'application_form',
        feature: 'tester_registration',
        component: 'PrototypeTesterModal'
  }
    );
}, [profession]);

  const submitPrototypeTesterMutation = useMutation({
    mutationFn: (data: PrototypeTesterData) =>
      apiRequest('/api/invites/prototype-tester', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type' : 'application/json'
        }
      }),
    onSuccess: () => {
      setIsSubmitted(true);
    }
  });

  // ✅ NY: Enhanced submit with location context and analytics
  const onSubmit = useCallback((data: PrototypeTesterData) => {
    const endTiming = performance.startTiming('prototype_tester_application_submit');
    
    const enhancedData = {
      ...data,
      locationContext: generateLocationContext()
    };
    
    analytics.trackEvent('prototype_tester_application_submitted', {
      profession: data.profession,
      testingAreasCount: data.testingAreas.length,
      testingAreas: data.testingAreas,
      experience: data.experience,
      hasDetailedFeedback: !!data.detailedFeedback,
      hasTestingNotes: !!data.testingNotes,
      hasExpectations: !!data.expectations,
      timestamp: Date.now()
    });
    
    debugging.logIntegration('info', 'Prototype Tester Application Submitted, ', {
      user: data.name,
      profession: data.profession,
      testingAreas: data.testingAreas
    });
    
    submitPrototypeTesterMutation.mutate(enhancedData);
    endTiming();
  }, [generateLocationContext, submitPrototypeTesterMutation, analytics, performance, debugging]);

  // ✅ NY: Memoized callback functions for performance
  const handleClose = useCallback(() => {
    reset();
    setIsSubmitted(false);
    onClose();
}, [reset, onClose]);

  const handleTestingAreaToggle = useCallback((area: string, currentAreas: string[]) => {
    if (currentAreas.includes(area)) {
      return currentAreas.filter((item) => item !== area);
    } else {
      return [...currentAreas, area];
    }
  }, []);

  // ✅ NY: NoteEditor handler functions
  const handleNoteEditorSave = useCallback(async () => {
    try {
      // Save the note editor content to the form
      const currentValues = watch();
      const updatedData = {
        ...currentValues,
        [noteEditorMode]: noteEditorContent
      };
      
      console.log('💾 Saving NoteEditor content: ', {
        mode: noteEditorMode,
        content: noteEditorContent,
        updatedData
      });
      
      setIsDirty(false);
      setLastSaved(new Date());
      setShowNoteEditor(false);
    } catch (error) {
      console.error('❌ Error saving NoteEditor content: ', error);
    }
  }, [noteEditorMode, noteEditorContent, watch]);

  const handleNoteEditorChange = useCallback((value: string) => {
    setNoteEditorContent(value);
    setIsDirty(true);
}, []);

  const handleAIEnhance = useCallback((type: 'improve' | 'summarize' | 'translate' | 'grammar') => {
    console.log(`🤖 AI Enhancement: ${type}`, { 
      mode: noteEditorMode,
      content: noteEditorContent,
      type 
    });
    // Implement AI enhancement logic for prototype tester applications
  }, [noteEditorMode, noteEditorContent]);

  const handleExport = useCallback((format: 'pdf' | 'docx' | 'html' | 'txt') => {
    console.log(`📤 Export as ${format}`, { 
      mode: noteEditorMode,
      content: noteEditorContent,
      format 
    });
    // Implement export logic for prototype tester documentation
  }, [noteEditorMode, noteEditorContent]);

  const openNoteEditor = useCallback((mode: 'detailed-feedback' | 'testing-notes' | 'expectations') => {
    setNoteEditorMode(mode);
    
    // Load existing content based on mode
    const currentValues = watch();
    let existingContent = '';
    
    switch (mode) {
      case 'detailed-feedback':
        existingContent = currentValues.detailedFeedback || ', ';
        break;
      case 'testing-notes':
        existingContent = currentValues.testingNotes || ', ';
        break;
      case 'expectations':
        existingContent = currentValues.expectations || ', ';
        break;
    }
    
    setNoteEditorContent(existingContent);
    setIsDirty(false);
    setShowNoteEditor(true);
  }, [watch]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          background: 'linear-gradient(145deg, rgba(2, 5, 5,255,255,0.95) 0%, rgba(2, 4, 8,250,252,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(25,140,0,0.1)',
          boxShadow: '0 25px 50px -12px blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.25), 0 0 0 1px rgba(2, 5, 5,140,0,0.05)',
          maxHeight: '90vh' }}}
    >
      <DialogTitle
        sx={{
          textAlign: 'center',
          pb:  2,
          background: 'linear-gradient(135deg, rgba(2, 5, 5,140,0,0.03) 0%, rgba(2, 5, 5,248,235,0.05) 100%)',
          borderBottom: '1px solid rgba(25,140,0,0.1)' }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap:  2,
            py:  2}}
        >
          <Box
            sx={{
              p:  2,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(2, 5, 5,140,0,0.1) 0%, rgba(2, 5, 5,248,235,0.2) 100%)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(25,140,0,0.15)',
              border: '1px solid rgba(25,140,0,0.2)',
              position: 'relative',
              overflow: 'hidden', '&::before': {
                content: '","',
                position: 'absolute',
                top:  0,
                left:  0,
                right:  0,
                bottom:  0,
                background: 'linear-gradient(45deg, transparent 30%, rgba(2, 5, 5,255,255,0.1) 50%, transparent 70%)',
                transform: 'translateX(-100%)',
                transition: 'transform 0.6s ease-in-out' }, '&:hover: :before': {
                transform: 'translateX(100%, )' }}}
          >
            <img
              src={logoCreatorHub}
              alt="CreatorHub Norge Logo"
              style={{
                width: '280px',
                height: '84px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 4px 12px rgba(25,140,0,0.3))' }}
            />
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5"
              sx={{ 
                color: '#1f2937',
                fontWeight: 'bold',
                mb:  1 }}>
              🧪 Prototype Tester Program
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#6b7280',
                maxWidth: '500px',
                mx: 'auto',
                lineHeight: 1.6}}
            >
              Hjelp oss å forbedre CreatorHub Norge ved å teste nye funksjoner og gi verdifull
              tilbakemelding
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p:  3 }}>
        {!isSubmitted ? (
          <form onSubmit={handleSubmit(onSubmit)}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  3 }}>
              {/* Personal Information */}
              <Box
                sx={{
                  p:  3,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(2, 5, 5,140,0,0.02) 0%, rgba(2, 5, 5,248,235,0.03) 100%)',
                  border: '1px solid rgba(25,140,0,0.1)' }}
              >
                <Typography variant="h6" sx={{  mb: 2, color: '#1f2937', fontWeight: 'bold'  }}>
                  📝 Personlig Informasjon
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap:  2,
                    mb:  2}}
                >
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Fullt navn"
                        error={!!errors.name}
                        helperText={errors.name?.message}
                      />
                    )}
                  />

                  <Controller
                    name="email"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        type="email"
                        label="E-postadresse"
                        error={!!errors.email}
                        helperText={errors.email?.message}
                      />
                    )}
                  />
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap:  2}}
                >
                  <Controller
                    name="company"
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} fullWidth label="Bedrift (valgfritt)" />
                    )}
                  />

                  <Controller
                    name="profession"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.profession}>
                        <InputLabel>Profesjon</InputLabel>
                        <Select {...field} label="Profesjon">
                          {professionOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </Box>
              </Box>

              {/* ✅ NY: Enhanced Testing Areas with Performance Focus , *, /}
              <Box
                sx={{
                  p:  3,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.02) 0%, rgba(2, 1, 9,234,254,0.03) 100%)',
                  border: '1px solid rgba(9,130,246,0.1)' }}
              >
                <Typography variant="h6" sx={{  mb: 2, color: '#1f2937', fontWeight: 'bold'  }}>
                  🎯 Hva ønsker du å teste?
                </Typography>
                
                {/* ✅ NY: Performance Focus Notice , *, /}
                <Box sx={{ 
                  mb: 2
                 , p: 2, borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(2, 5, 5,140,0,0.05) 0%, rgba(2, 5, 5,248,235,0.1) 100%)',
                  border: '1px solid rgba(25,140,0,0.2)' }}>
                  <Typography variant="body2" sx={{ color: '#ff8c00', fontWeight: 600}>
                    ⚡ Fokus på ytelse og brukeropplevelse: Vi søker spesielt etter testere som kan hjelpe oss med å optimalisere systemets ytelse og identifisere forbedringsområder.
                  </Typography>
                </Box>

                <Controller
                  name="testingAreas"
                  control={control}
                  render={({ field }) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5}}>
                      {testingAreaOptions.map((area) => (
                        <Chip
                          key={area.value}
                          label={`${area.icon} ${area.label}`}
                          variant={field.value.includes(area.value) ? 'filled' : 'outlined'}
                          onClick={() => {
                            const newAreas = handleTestingAreaToggle(area.value, field.value);
                            field.onChange(newAreas);
                        }}
                          sx={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease','&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: '0 4px 8px blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.1)' },
                            ...(field.value.includes(area.value) && {
                              backgroundColor: '#ff8c00',
                              color: 'white','&:hover': {
                                backgroundColor: '#e67e00' },
                          })}}
                        />
                      ))}
                    </Box>
                  )}
                />
                {errors.testingAreas && (
                  <Typography color="error" variant="body2" sx={{ mt:  1 }}>
                    {errors.testingAreas.message}
                  </Typography>
                )}
              </Box>

              {/* Experience & Details */}
              <Box
                sx={{
                  p:  3,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.02) 0%, rgba(2, 3, 6,253,245,0.03) 100%)',
                  border: '1px solid rgba(6,185,129,0.1)' }}
              >
                <Typography variant="h6" sx={{  mb: 2, color: '#1f2937', fontWeight: 'bold'  }}>
                  💼 Erfaring & Tilgjengelighet
                </Typography>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap:  2,
                    mb:  2}}
                >
                  <Controller
                    name="experience"
                    control={control}
                    render={({ field }) => (
                      <FormControl fullWidth error={!!errors.experience}>
                        <InputLabel>Erfaringsnivå</InputLabel>
                        <Select {...field} label="Erfaringsnivå">
                          {experienceOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />

                  <Controller
                    name="availableTime"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Tilgjengelig tid per uke"
                        placeholder="f.eks. 2-3 timer"
                        error={!!errors.availableTime}
                        helperText={errors.availableTime?.message}
                      />
                    )}
                  />
                </Box>

                <Controller
                  name="deviceInfo"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Enheter du vil teste på (valgfritt)"
                      placeholder="f.eks. MacBook Pro, iPhone 14, Windows PC"
                      sx={{ mb:  2 }}
                    />
                  )}
                />

                <Controller
                  name="feedback"
                  control={control}
                  render={({ field }) => (
                    <Box>
                      <TextField
                        {...field}
                        fullWidth
                        multiline
                        rows={3}
                        label="Beskriv hva du ønsker å teste og dine forventninger"
                        placeholder="Fortell oss om dine interesser og hva du håper å oppnå ved å teste plattformen..."
                        error={!!errors.feedback}
                        helperText={errors.feedback?.message}
                      />
                      
                      {/* ✅ NY: NoteEditor Integration Buttons , *, /}
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EditNote />}
                          onClick={() => openNoteEditor('detailed-feedback')}
                          sx={{
                            borderColor: '#ff8c00',
                            color: '#ff8c00','&:hover': {
                              borderColor: '#e67e00',
                              backgroundColor: 'rgba(25, 1400.05)' }}}
                        >
                          Detaljert Feedback
                        </Button>
                        
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={theming.getThemedIcon('contentCopy')}
                          onClick={() => openNoteEditor('testing-notes')}
                          sx={{
                            borderColor: '#2196f3',
                            color: '#2196f3','&:hover': {
                              borderColor: '#1976d2',
                              backgroundColor: 'rgba(3, 150, 243, 0.05)' }}}
                        >
                          Testing Notater
                        </Button>
                        
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={theming.getThemedIcon('autoAwesome')}
                          onClick={() => openNoteEditor('expectations')}
                          sx={{
                            borderColor: '#9c27b0',
                            color: '#9c27b0','&:hover': {
                              borderColor: '#7b1fa2',
                              backgroundColor: 'rgba(16, 39, 176, 0.05)' }}}
                        >
                          Forventninger
                        </Button>
                      </Box>
                      
                      {/* ✅ NY: Quick Info , *, /}
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        💡 Bruk de avanserte verktøyene ovenfor for å skrive detaljerte notater med AI-assistanse og rik tekstformatering.
                      </Typography>
                    </Box>
                  )}
                />
              </Box>

              {/* Terms */}
              <Box
                sx={{
                  p:  3,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(1, 0, 7,114,128,0.02) 0%, rgba(2, 4, 3,244,246,0.03) 100%)',
                  border: '1px solid rgba(17,114,128,0.1)' }}
              >
                <Controller
                  name="hasAgreedToTerms"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Checkbox
                          {...field}
                          checked={field.value}
                          sx={{
                            color: '#ff8c00','&.Mui-checked': {
                              color: '#ff8c00' }}}
                        />
                    }
                      label={
                        <Typography variant="body2" sx={{ color: '#374151' }}>
                          Jeg godtar å delta som prototype tester og forstår at jeg vil få tilgang
                          til uferdig programvare for testing og tilbakemelding. Jeg vil motta
                          beskjed om godkjenning gjennom invitasjonssystemet.
                        </Typography>
                    }
                    />
                  )}
                />
                {errors.hasAgreedToTerms && (
                  <Typography color="error" variant="body2" sx={{ mt:  1 }}>
                    {errors.hasAgreedToTerms.message}
                  </Typography>
                )}
              </Box>
            </Box>
          </form>
        ) : (
          // ✅ NY: Enhanced Success State with Performance Focus
          <Box sx={{ textAlign: 'center', py:  4 }}>
            <Typography variant="h3" sx={{  mb: 2, fontSize: '4rem'  }}>
              🎉
            </Typography>
            <Typography variant="h5" sx={{  mb: 2, color: '#1f2937', fontWeight: 'bold'  }}>
              Takk for din interesse!
            </Typography>
            <Typography
              variant="body1"
              sx={{ mb:  3, color: '#6b7280', maxWidth: '500px', mx: 'auto' }}
            >
              Vi har mottatt din søknad om å bli prototype tester. Du vil få beskjed om godkjenning
              gjennom vårt invitasjonssystem innen 2-3 virkedager.
            </Typography>
            
            {/* ✅ NY: Performance Testing Notice , *, /}
            <Box sx={{ 
              mb:  3, 
              p: 2, borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.05) 0%, rgba(2, 3, 6,253,245,0.1) 100%)',
              border: '1px solid rgba(6,185,129,0.2)' }}>
              <Typography variant="body2" sx={{ color: '#059669', fontWeight: 600}>
                🚀 Som prototype tester vil du få tilgang til avanserte ytelsesovervåkingsverktøy og kan bidra til å optimalisere plattformen for alle brukere.
              </Typography>
            </Box>
            
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              Vi kontakter deg på den oppgitte e-postadressen når du får tilgang til testområdene.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          p:  3,
          justifyContent: isSubmitted ? 'center' : 'space-between',
          background: 'linear-gradient(145deg, rgba(2, 5, 5,140,0,0.02) 0%, rgba(2, 5, 5,248,235,0.03) 100%)',
          borderTop: '1px solid rgba(25,140,0,0.08)' }}
      >
        {!isSubmitted ? (
          <>
            <Button
              onClick={handleClose}
              variant="outlined"
              sx={{
                borderColor: 'rgba(17,114,128,0.3)',
                color: '#6b7280','&:hover': {
                  borderColor: 'rgba(25,140,0,0.4)',
                  backgroundColor: 'rgba(25,140,0,0.05)',
                  color: '#ff8c00' }}}
            >
              Avbryt
            </Button>

            <Button type="submit"
              variant="contained"
              disabled={!isValid || submitPrototypeTesterMutation.isPending}
              onClick={handleSubmit(onSubmit)}
              sx={{
                background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)','&:hover': {
                  background: 'linear-gradient(135deg, #e67c00 0%, #d97706 100%)' }, '&:disabled': {
                  background: 'rgba(17,114,128,0.2)' }}}
             sx={theming.getThemedButtonSx()}>
              {submitPrototypeTesterMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                '🚀 Send Søknad som Prototype Tester'
              )}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #ff8c00 0%, #e67c00 100%)',
              px:  4,
              py: 1.5, '&:hover': { background: 'linear-gradient(135deg, #e67c00 0%, #d97706 100%)' }}}
           sx={theming.getThemedButtonSx()}>
            Ferdig
          </Button>
        )}
      </DialogActions>

      {/* ✅ NY: Full-Screen NoteEditor Dialog , *, /}
      <Dialog
        open={showNoteEditor}
        onClose={() => setShowNoteEditor(false)}
        maxWidth="xl"
        fullWidth
        fullScreen
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <EditNote sx={{ color: '#ff8c00' }} />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Professional Note Editor</Typography>
            <Typography variant="body2" color="text.secondary">
              {noteEditorMode === 'detailed-feedback' && 'Detaljert Feedback'}
              {noteEditorMode === 'testing-notes' && 'Testing Notater'}
              {noteEditorMode === 'expectations' && 'Forventninger'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, height: 'calc(100vh - 120px)' }}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Mode Selection */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, py: 1 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ mr: 2, fontWeight: 600}>
                  Mode: </Typography>
                <Button
                  size="small"
                  variant={noteEditorMode === 'detailed-feedback' ? 'contained' : 'outlined'}
                  onClick={() => setNoteEditorMode('detailed-feedback')}
                  sx={{
                    bgcolor: noteEditorMode === 'detailed-feedback' ? '#ff8c00' : 'transparent',
                    color: noteEditorMode === 'detailed-feedback' ? 'white' : '#ff8c00','&:hover': { bgcolor: noteEditorMode === 'detailed-feedback' ? '#e67e00' : 'rgba(25, 1400.1)' }}}
                >
                  Detaljert Feedback
                </Button>
                <Button
                  size="small"
                  variant={noteEditorMode === 'testing-notes' ? 'contained' : 'outlined'}
                  onClick={() => setNoteEditorMode('testing-notes')}
                  sx={{
                    bgcolor: noteEditorMode === 'testing-notes' ? '#2196f3' : 'transparent',
                    color: noteEditorMode === 'testing-notes' ? 'white' : '#2196f3','&:hover': { bgcolor: noteEditorMode === 'testing-notes' ? '#1976d2' : 'rgba(3, 150, 243, 0.1)' }}}
                >
                  Testing Notater
                </Button>
                <Button
                  size="small"
                  variant={noteEditorMode === 'expectations' ? 'contained' : 'outlined'}
                  onClick={() => setNoteEditorMode('expectations')}
                  sx={{
                    bgcolor: noteEditorMode === 'expectations' ? '#9c27b0' : 'transparent',
                    color: noteEditorMode === 'expectations' ? 'white' : '#9c27b0', '&:hover': { bgcolor: noteEditorMode === 'expectations' ? '#7b1fa2' : 'rgba(16, 39, 176, 0.1)' }}}
                >
                  Forventninger
                </Button>
              </Box>
            </Box>

            {/* NoteEditor Content */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <NoteEditor
                value={noteEditorContent}
                onChange={handleNoteEditorChange}
                placeholder={
                  noteEditorMode === 'detailed-feedback'
                    ? 'Skriv detaljert feedback her... Beskriv spesifikke funksjoner du ønsker å teste og hvordan du planlegger å evaluere dem.'
                    : noteEditorMode === 'testing-notes'
                    ? 'Skriv testing notater her... Dokumenter dine testplaner, metodikk og observasjoner.' : 'Skriv dine forventninger her... Beskriv hva du håper å oppnå og lære gjennom prototype testing.'
              }
                onSave={handleNoteEditorSave}
                onAIEnhance={handleAIEnhance}
                onExport={handleExport}
                lastSaved={lastSaved || undefined}
                isDirty={isDirty}
                showToolbar={true}
                showStatusBar={true}
                showWordCount={true}
                showReadingTime={true}
                enableAutoSave={true}
                autoSaveInterval={1000}
                templates={
                  noteEditorMode === 'detailed-feedback'
                    ? [
                        {
                          id: 'detailed-feedback-template',
                          name: 'Detaljert Feedback Template',
                          description: 'Strukturert template for detaljert feedback',
                          content: '<h2>Detaljert Feedback Plan</h2><h3>Funksjoner å teste:</h3><ul><li>[Funksjon 1] - Beskrivelse</li><li>[Funksjon 2] - Beskrivelse</li><li>[Funksjon 3] - Beskrivelse</li></ul><h3>Testmetodikk:</h3><p>[Beskriv hvordan du planlegger å teste hver funksjon]</p><h3>Forventede, resultater:</h3><p>[Beskriv hva du forventer å finne]</p><h3>Rapportering:</h3><p>[Hvordan du planlegger å rapportere resultatene]</p>',
                          tags: ['feedback', 'testing','prototype'],
                          category: 'testing',
                          isPublic: true,
                          createdBy: 'system',
                          createdAt: new Date().toISOString(),
                          usageCount: 0 }
                      ]
                    : noteEditorMode === 'testing-notes'
                    ? [
                        {
                          id: 'testing-notes-template',
                          name: 'Testing Notater Template',
                          description: 'Template for strukturerte testing notater',
                          content: '<h2>Testing Notater</h2><h3>Test Session:</h3><p><strong>Dato:</strong> [Dato]</p><p><strong>Varighet:</strong> [Tid]</p><p><strong>Fokusområde:</strong> [Område]</p><h3>Observasjoner:</h3><ul><li>[Observasjon 1]</li><li>[Observasjon 2]</li><li>[Observasjon 3]</li></ul><h3>Problemer, identifisert:</h3><ul><li>[Problem 1] - Beskrivelse og påvirkning</li><li>[Problem 2] - Beskrivelse og påvirkning</li></ul><h3>Anbefalinger:</h3><p>[Dine anbefalinger for forbedringer]</p>',
                          tags: ['notes', 'testing','observations'],
                          category: 'testing',
                          isPublic: true,
                          createdBy: 'system',
                          createdAt: new Date().toISOString(),
                          usageCount: 0 }
                      ]
                    : [
                        {
                          id: 'expectations-template',
                          name: 'Forventninger Template',
                          description: 'Template for å strukturere dine forventninger',
                          content: '<h2>Mine Forventninger</h2><h3>Hva jeg håper å lære:</h3><ul><li>[Læringsmål 1]</li><li>[Læringsmål 2]</li><li>[Læringsmål 3]</li></ul><h3>Funksjoner jeg er mest interessert i:</h3><ul><li>[Funksjon 1] - Hvorfor</li><li>[Funksjon 2] - Hvorfor</li></ul><h3>Hvordan jeg planlegger å, bidra:</h3><p>[Beskriv hvordan du planlegger å bidra til testing og forbedring]</p><h3>Langsiktige mål:</h3><p>[Dine langsiktige mål med å være prototype tester]</p>',
                          tags: ['expectations','goals', 'testing'],
                          category: 'testing',
                          isPublic: true,
                          createdBy: 'system',
                          createdAt: new Date().toISOString(),
                          usageCount: 0 }
                      ]
              }
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setShowNoteEditor(false)}>
            Close
          </Button>
          <Button variant="contained"
            onClick={handleNoteEditorSave}
            disabled={!isDirty}
            sx={{
              bgcolor: '#ff8c00','&:hover': { bgcolor:'#e67e00' }}}
           sx={theming.getThemedButtonSx()}>
            Save Notes
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
