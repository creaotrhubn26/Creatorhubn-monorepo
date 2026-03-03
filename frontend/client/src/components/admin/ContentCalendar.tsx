/**
 * Content Calendar
 * Monthly content planning and scheduling interface
 */

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Button,
  Chip,
  Tooltip,
  Dialog,
  Grid,
  Badge,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Add as AddIcon,
  Event as EventIcon,
  VideoLibrary as VideoIcon,
  Article as ArticleIcon,
  Campaign as CampaignIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { nb } from 'date-fns/locale';
import MarketingWorkflowIntegration from './MarketingWorkflowIntegration';
import EventCreatorDialog from './EventCreatorDialog';

interface CalendarEvent {
  id: number;
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
}

const eventTypeConfig = {
  announcement: {
    icon: <EventIcon />,
    label: 'Kunngjøring',
    color: '#ff8c00',
  },
  video: {
    icon: <VideoIcon />,
    label: 'Video',
    color: '#f44336',
  },
  blog: {
    icon: <ArticleIcon />,
    label: 'Blogg',
    color: '#2196f3',
  },
  social: {
    icon: <PublicIcon />,
    label: 'Sosiale Medier',
    color: '#9c27b0',
  },
  campaign: {
    icon: <CampaignIcon />,
    label: 'Kampanje',
    color: '#4caf50',
  },
};

const statusConfig = {
  planned: { label: 'Planlagt', color: '#9e9e9e' },
  'in-progress': { label: 'Pågår', color: '#2196f3' },
  ready: { label: 'Klar', color: '#4caf50' },
  published: { label: 'Publisert', color: '#4caf50' },
  cancelled: { label: 'Avbrutt', color: '#f44336' },
};

export default function ContentCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  useTheming(currentProfession);

  // Fetch calendar events for current month
  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
      queryKey: ['/api/content-calendar', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const response = await fetch(
        `/api/content-calendar/events?month=${format(currentMonth, 'yyyy-MM')}`
      );
      if (!response.ok) throw new Error('Failed to fetch events');
      return (await response.json()) as CalendarEvent[];
    },
  });

  // Get calendar dates
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Group events by date
  const eventsByDate = events.reduce((acc: Record<string, CalendarEvent[]>, event: CalendarEvent) => {
    const dateKey = event.scheduled_date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {});

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setEventDialogOpen(true);
  };

  const handleCreateEvent = () => {
    setSelectedDate(new Date());
    setEventDialogOpen(true);
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          {professionIcon && (
            <Box sx={{ color: professionColor, display: 'flex', alignItems: 'center' }}>
              {professionIcon}
            </Box>
          )}
          <Typography variant="h5" sx={{ fontWeight: 600}}>
            {enhancedProfessionConfig?.displayName || professionConfig?.displayName
              ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Innholdskalender`
              : 'Innholdskalender'}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={handleToday}
            sx={{ borderColor: '#ff8c00', color: '#ff8c00' }}
          >
            I dag
          </Button>
        </Box>

        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            startIcon={<CampaignIcon />}
            onClick={() => setWorkflowDialogOpen(true)}
            sx={{ borderColor: '#ff8c00', color: '#ff8c00' }}
          >
            Marketing Workflow
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateEvent}
            sx={{
              bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' }}}
          >
            Ny hendelse
          </Button>
        </Box>
      </Box>

      {/* Month Navigation */}
      <Box display="flex" alignItems="center" justifyContent="center" gap={2} mb={3}>
        <IconButton onClick={handlePrevMonth}>
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
          {format(currentMonth, 'MMMM yyyy', { locale: nb })}
        </Typography>
        <IconButton onClick={handleNextMonth}>
          <ChevronRight />
        </IconButton>
      </Box>

      {/* Legend */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        {Object.entries(eventTypeConfig).map(([type, config]) => (
          <Box key={type} display="flex" alignItems="center" gap={1}>
            <Box sx={{ color: config.color }}>{config.icon}</Box>
            <Typography variant="caption">{config.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Calendar Grid */}
      <Card>
        <CardContent>
          {/* Weekday Headers */}
          <Grid container spacing={1} sx={{ mb: 1 }}>
            {['Man','Tir','Ons','Tor','Fre','Lør', 'Søn'].map((day) => (
              <Grid item xs={12 / 7} key={day}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 600, color: 'text.secondary', textAlign: 'center', display: 'block' }}
                >
                  {day}
                </Typography>
              </Grid>
            ))}
          </Grid>

          {/* Calendar Days */}
          <Grid container spacing={1}>
            {calendarDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] || [];
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);

              return (
                <Grid item xs={12 / 7} key={day.toString()}>
                  <Box
                    onClick={() => handleDateClick(day)}
                    sx={{
                      minHeight: 120,
                      p: 1,
                      border: '1px solid',
                      borderColor: isTodayDate ? '#ff8c00' : 'divider',
                      borderRadius: 1,
                      cursor: 'pointer',
                      bgcolor: isTodayDate ? '#fff5e6' : 'background.paper',
                      opacity: isCurrentMonth ? 1 : 0.5, '&:hover': {
                        bgcolor: '#f5f5f5',
                      },
                      transition: 'all 0.2s'}}
                  >
                    {/* Date Number */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isTodayDate ? 600 : 400,
                        color: isTodayDate ? '#ff8c00' : 'text.primary',
                        mb: 0.5}}
                    >
                        {format(day, 'd')}
                    </Typography>

                    {/* Events */}
                    <Box display="flex" flexDirection="column" gap={0.5}>
                      {dayEvents.slice(0, 3).map((event) => {
                        const typeConfig = eventTypeConfig[event.event_type];
                        return (
                          <Tooltip key={event.id} title={event.title}>
                            <Box
                              sx={{
                                bgcolor: typeConfig.color + '20',
                                border: `1px solid ${typeConfig.color}`,
                                borderRadius: 0.5,
                                px: 0.5,
                                py: 0.25,
                                fontSize: '0.7rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'}}
                            >
                              {event.title}
                            </Box>
                          </Tooltip>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{dayEvents.length - 3} mer
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <Grid container spacing={2} sx={{ mt: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ color: '#ff8c00', fontWeight: 600}}>
                {events.filter((e: CalendarEvent) => e.status === 'planned').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Planlagt
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ color: '#2196f3', fontWeight: 600}}>
                {events.filter((e: CalendarEvent) => e.status === 'in-progress').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Pågår
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 600}}>
                {events.filter((e: CalendarEvent) => e.status === 'ready').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Klar
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h4" sx={{ color: '#4caf50', fontWeight: 600}}>
                {events.filter((e: CalendarEvent) => e.status ==='published').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Publisert
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Event Creator Dialog */}
      <EventCreatorDialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        selectedDate={selectedDate}
        onEventCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/content-calendar'] });
        }}
      />

      {/* Marketing Workflow Integration */}
      <MarketingWorkflowIntegration
        open={workflowDialogOpen}
        onClose={() => setWorkflowDialogOpen(false)}
        onComplete={(result) => {
          setWorkflowDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ['/api/content-calendar'] });
        }}
      />
    </Box>
  );
}
