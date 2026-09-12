/**
 * Event Creator Dialog
 * Create and edit calendar events
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Box,
  Typography,
  Chip,
  Alert,
} from '@mui/material';
import {
  Event as EventIcon,
  VideoLibrary as VideoIcon,
  Article as ArticleIcon,
  Campaign as CampaignIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { AdminButton, useIsMobile } from './design-system';

interface EventCreatorDialogProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  editEvent?: CalendarEvent | null;
  onEventCreated?: (event: CalendarEvent) => void;
}

interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  event_type: 'announcement' | 'video' | 'blog' | 'social' | 'campaign';
  status: 'planned' | 'in-progress' | 'ready' | 'published' | 'cancelled';
  scheduled_date: string;
  scheduled_time?: string;
  marketing_purpose?: string;
  target_audience?: string[];
  assigned_to?: string;
  progress_percentage?: number;
  metadata?: any;
}

const eventTypeOptions = [
  { value: 'announcement', label: 'Kunngjøring', icon: <EventIcon />, color: '#ff8c00' },
  { value: 'video', label: 'Video', icon: <VideoIcon />, color: '#f44336' },
  { value: 'blog', label: 'Blogg', icon: <ArticleIcon />, color: '#2196f3' },
  { value: 'social', label: 'Sosiale Medier', icon: <PublicIcon />, color: '#ce93d8' },
  { value: 'campaign', label: 'Kampanje', icon: <CampaignIcon />, color: '#4caf50' },
];

const statusOptions = [
  { value: 'planned', label: 'Planlagt' },
  { value: 'in-progress', label: 'Pågår' },
  { value: 'ready', label: 'Klar' },
  { value: 'published', label: 'Publisert' },
  { value: 'cancelled', label: 'Avbrutt' },
];

const marketingPurposeOptions = [
  'brand-awareness',
  'lead-generation',
  'seo',
  'education',
  'sales',
  'engagement',
];

export default function EventCreatorDialog({
  open,
  onClose,
  selectedDate,
  editEvent,
  onEventCreated,
}: EventCreatorDialogProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const isEdit = !!editEvent;

  const [form, setForm] = useState<Partial<CalendarEvent>>({
    title: editEvent?.title || '',
    description: editEvent?.description || '',
    event_type: editEvent?.event_type || 'announcement',
    status: editEvent?.status || 'planned',
    scheduled_date: editEvent?.scheduled_date || (selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ','),
    scheduled_time: editEvent?.scheduled_time || '12:00',
    marketing_purpose: editEvent?.marketing_purpose || 'brand-awareness',
    target_audience: editEvent?.target_audience || [],
    assigned_to: editEvent?.assigned_to || '',
    progress_percentage: editEvent?.progress_percentage || 0,
  });

  const [audienceInput, setAudienceInput] = useState('');

  const createMutation = useMutation({
    mutationFn: async (event: Partial<CalendarEvent>) => {
      const url = isEdit ? `/api/content-calendar/events/${editEvent.id}` : '/api/content-calendar/events';
      const method = isEdit ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(event),
      });
      
      if (!response.ok) throw new Error('Failed to save event, ');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/content-calendar'] });
      if (onEventCreated) {
        onEventCreated(data);
      }
      handleClose();
    },
  });

  const handleChange = (field: keyof CalendarEvent, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddAudience = () => {
    if (audienceInput.trim()) {
      handleChange('target_audience', [...(form.target_audience || []), audienceInput.trim()]);
      setAudienceInput('');
    }
  };

  const handleRemoveAudience = (audience: string) => {
    handleChange(
      'target_audience',
      (form.target_audience || []).filter((a) => a !== audience)
    );
  };

  const handleSubmit = () => {
    if (!form.title || !form.scheduled_date) {
      return;
    }
    createMutation.mutate(form);
  };

  const handleClose = () => {
    setForm({
      title: ', ',
      description: ', ',
      event_type: 'announcement',
      status: 'planned',
      scheduled_date: ', ',
      scheduled_time: '12:00',
      marketing_purpose: 'brand-awareness',
      target_audience: [],
      assigned_to: ', ',
      progress_percentage: 0,
    });
    setAudienceInput(', ');
    onClose();
  };

  const selectedEventType = eventTypeOptions.find((opt) => opt.value === form.event_type);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth fullScreen={isMobile}>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={2}>
          {selectedEventType?.icon}
          <Typography variant="h6">
            {isEdit ? 'Rediger Hendelse' : 'Opprett Ny Hendelse'}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            {/* Title */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Tittel"
                required
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </Grid>

            {/* Description */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beskrivelse"
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
            </Grid>

            {/* Event Type */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Hendelsestype</InputLabel>
                <Select
                  value={form.event_type}
                  label="Hendelsestype"
                  onChange={(e) => handleChange('event_type', e.target.value)}
                >
                  {eventTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {option.icon}
                        {option.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Status */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={form.status}
                  label="Status"
                  onChange={(e) => handleChange('status', e.target.value)}
                >
                  {statusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Scheduled Date */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Dato"
                required
                value={form.scheduled_date}
                onChange={(e) => handleChange('scheduled_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Scheduled Time */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="time"
                label="Tid"
                value={form.scheduled_time}
                onChange={(e) => handleChange('scheduled_time', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            {/* Marketing Purpose */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Markedsføringsformål</InputLabel>
                <Select
                  value={form.marketing_purpose}
                  label="Markedsføringsformål"
                  onChange={(e) => handleChange('marketing_purpose', e.target.value)}
                >
                  {marketingPurposeOptions.map((purpose) => (
                    <MenuItem key={purpose} value={purpose}>
                      {purpose}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Assigned To */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Tildelt til"
                value={form.assigned_to}
                onChange={(e) => handleChange('assigned_to', e.target.value)}
                placeholder="E-post eller navn"
              />
            </Grid>

            {/* Target Audience */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Målgruppe"
                value={audienceInput}
                onChange={(e) => setAudienceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAudience();
                  }
                }}
                placeholder="Legg til målgruppe og trykk Enter"
              />
              <Box mt={1} display="flex" flexWrap="wrap" gap={1}>
                {(form.target_audience || []).map((audience) => (
                  <Chip
                    key={audience}
                    label={audience}
                    onDelete={() => handleRemoveAudience(audience)}
                    size="small"
                  />
                ))}
              </Box>
            </Grid>

            {/* Progress (for in-progress events) */}
            {form.status === 'in-progress' && (
              <Grid item xs={12}>
                <Typography gutterBottom>Fremdrift: {form.progress_percentage}%</Typography>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form.progress_percentage}
                  onChange={(e) => handleChange('progress_percentage', parseInt(e.target.value))}
                  style={{ width: '100%' }}
                  aria-label="Fremdrift i prosent"
                />
              </Grid>
            )}
          </Grid>

          {createMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              En feil oppstod: {createMutation.error?.message}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <AdminButton tone="ghost" onClick={handleClose} disabled={createMutation.isPending}>
          Avbryt
        </AdminButton>
        <AdminButton
          tone="primary"
          onClick={handleSubmit}
          loading={createMutation.isPending}
          disabled={!form.title || !form.scheduled_date}
        >
          {isEdit ? 'Oppdater' : 'Opprett'}
        </AdminButton>
      </DialogActions>
    </Dialog>
  );
}
