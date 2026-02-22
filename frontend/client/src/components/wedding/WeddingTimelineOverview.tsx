import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Chip,
  Avatar,
  Paper,
  Divider,
  Alert,
  Badge,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Event,
  Visibility,
  Comment,
  Edit,
  Send,
  Phone,
  Email,
  LocationOn,
  Notifications,
  Public,
  Lock,
  Person,
  AccessTime,
  CalendarToday,
  Group,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

interface TimelineOverviewProps {
  photographerId: string;
  // Integration props for universal workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

interface Timeline {
  id: number;
  project_id: string;
  wedding_id: string;
  couple_name: string;
  wedding_date: string;
  venue: string;
  cultural_type: string;
  client_access_enabled: boolean;
  client_access_code: string;
  photographer_message: string;
  client_notes: string;
  status: string;
  created_at: string;
  updated_at: string;
  project_name: string;
  project_client_name: string;
  client_email: string;
  client_phone: string;
  event_count: number;
  comment_count: number;
  latest_comment: string;
  client_last_activity: string
}

interface Comment {
  id: number;
  timeline_id: number;
  author_type: 'photographer' | 'client';
  author_name: string;
  message: string;
  is_private: boolean;
  created_at: string;
  updated_at: string
}

export default function WeddingTimelineOverview({ 
  photographerId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}: TimelineOverviewProps) {
  const [selectedTimeline, setSelectedTimeline] = useState<Timeline | null>(null);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isPrivateComment, setIsPrivateComment] = useState(false);
  const [notifyClient, setNotifyClient] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  
  const { toast } = useToast();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  const queryClient = useQueryClient();

  // Fetch all timelines
  const { data: timelinesData, isLoading: timelinesLoading } = useQuery({
    queryKey: [`/api/wedding-timeline/overview/${photographerId}`],
    queryFn: () => apiRequest(`/api/wedding-timeline/overview/${photographerId}`)
});

  // Fetch comments for selected timeline
  const { data: commentsData, isLoading: commentsLoading } = useQuery({
    queryKey: [`/api/wedding-timeline/${selectedTimeline?.id}/comments`],
    queryFn: () => apiRequest(`/api/wedding-timeline/${selectedTimeline?.id}/comments`),
    enabled: !!selectedTimeline?.id
});

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (commentData: { timelineId: number; message: string; isPrivate: boolean; notifyClient: boolean }) => {
      return apiRequest(`/api/wedding-timeline/${commentData.timelineId}/comments`, {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: {
          message: commentData.message,
          isPrivate: commentData.isPrivate,
          notifyClient: commentData.notifyClient
    }
    });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/wedding-timeline/${selectedTimeline?.id}/comments`] 
    });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/wedding-timeline/overview/${photographerId}`] 
    });
      setNewComment('');
      toast({
        title: "Kommentar lagt til",
        description: notifyClient && !isPrivateComment ? "Klient blir varslet om endringen" : "Kommentar lagret",
    });
  },
    onError: (error) => {
      toast({
        title: "Feil",
        description: "Kunne ikke legge til kommentar",
        variant: "destructive",
    });
  }
});

  const handleAddComment = () => {
    if (!selectedTimeline || !newComment.trim()) return;
    
    addCommentMutation.mutate({
      timelineId: selectedTimeline.id,
      message: newComment.trim(),
      isPrivate: isPrivateComment,
      notifyClient: notifyClient && !isPrivateComment
});
};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#4caf50';
      case 'completed': return '#2196f3';
      case 'draft': return '#ff9800';
      default: return '#757575';
}
};

  const timelines = timelinesData?.timelines || [];
  const comments = commentsData?.comments || [];

  if (timelinesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p:  3 }}>
        <Typography>Laster bryllupstidslinjer...</Typography>
      </Box>
    );
}

  return (
    <Box>
      <Typography variant="h5" sx={{  mb: 3, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1  }}>
        <Event sx={{ color: '#E91E63'}} />
        Bryllupstidslinjer Oversikt
        <Chip 
          label={`${timelines.length} tidslinjer`}
          color="primary"
          size="small"
        />
      </Typography>

      {timelines.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Ingen bryllupstidslinjer enda</Typography>
          <Typography variant="body2">
            Opprett ditt første bryllupsprojekt med tidslinje-integrasjon for å se oversikten her.
          </Typography>
        </Alert>
      ) : (
        <Grid container spacing={3}>
	          {timelines.map((timeline) => (
	            <Grid item xs={12} md={6} lg={4} key={timeline.id}>
	              <Card 
	                sx={{ 
	                  height: '100%',
	                  borderLeft: `4px solid ${getStatusColor(timeline.status)}`, '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
	                  transition: 'all 0.2s ease-in-out',
	                  ...theming.getThemedCardSx()}}
	              >
                <CardContent sx={theming.getThemedCardSx()}>
                  {/* Header with couple info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,mb: 2 }}>
                    <Avatar sx={{ bgcolor: '#E91E60', width:  40, height: 40}}>
                      <Group fontSize="small" />
                    </Avatar>
                    <Box sx={{ flex:  1 }}>
                      <Typography variant="h6" sx={{  fontWeight: 600,fontSize: '1rem' }}>
                        {timeline.couple_name || timeline.project_client_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {timeline.project_name}
                      </Typography>
                    </Box>
                    <Chip 
                      label={timeline.cultural_type}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                  </Box>

                  {/* Wedding details */}
                  <Box sx={{ mb: 2 }}>
	                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,mb: 1 }}>
	                      <CalendarToday fontSize="small" color="primary" />
	                      <Typography variant="body2">
	                        {timeline.wedding_date
	                          ? format(new Date(timeline.wedding_date), 'dd. MMMM yyyy', { locale: nb })
	                          : 'Dato ikke satt'}
	                      </Typography>
                    </Box>
                    {timeline.venue && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,mb: 1 }}>
                        <LocationOn fontSize="small" color="primary" />
                        <Typography variant="body2" sx={{ fontSize: '0.8rem'}}>
                          {timeline.venue}
                        </Typography>
                      </Box>
                    )}
                    {timeline.client_email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,mb: 1 }}>
                        <Email fontSize="small" color="primary" />
                        <Typography variant="body2" sx={{ fontSize: '0.8rem'}}>
                          {timeline.client_email}
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Stats */}
                  <Box sx={{ display: 'flex', gap: 1,mb: 2 }}>
                    <Chip
                      icon={<Event />}
                      label={`${timeline.event_count} events`}
                      size="small"
                      variant="outlined"
                    />
                    <Badge badgeContent={timeline.comment_count} color="error" max={99}>
                      <Chip
                        icon={<Comment />}
                        label="Kommentarer"
                        size="small"
                        variant="outlined"
                      />
                    </Badge>
                  </Box>

                  {/* Latest activity */}
                  {timeline.latest_comment && (
                    <Box sx={{ mb: 2,p: 1, bgcolor: 'grey.10', borderRadius:  1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Siste kommentar: </Typography>
                      <Typography variant="body2" sx={{ 
                        fontSize: '0.8rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                  }}>
                        {timeline.latest_comment}
                      </Typography>
                    </Box>
                  )}

                  {/* Access status */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,mb: 2 }}>
                    {timeline.client_access_enabled ? (
                      <Chip
                        icon={<Public />}
                        label="Klient har tilgang"
                        size="small"
                        color="success"
                      />
	                    ) : (
	                      <Chip
	                        icon={<Lock />}
	                        label="Privat"
	                        size="small"
	                        color="default"
	                      />
	                    )}
	                    {timeline.client_last_activity && (
	                      <Chip
	                        icon={<AccessTime />}
	                        label={`Sist aktiv: ${format(new Date(timeline.client_last_activity), 'dd.MM', { locale: nb })}`}
	                        size="small"
	                        variant="outlined"
	                      />
	                    )}
                  </Box>

                  {/* Action buttons */}
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="contained"
                      size="small"
                      startIcon={theming.getThemedIcon('visibility')}
                      onClick={() => {
                        setSelectedTimeline(timeline);
                        setCommentsDialogOpen(true);
                    }}
                      sx={{ 
                        bgcolor: '#E91E60', '&:hover': { bgcolor: '#C2185B',},
                        flex: 1 }}
                    >
                      Se detaljer
                    </Button>
                    <IconButton
                      size="small"
                      sx={{ 
                        bgcolor: 'primary.light','&:hover': { bgcolor: 'primary.main', color: 'white',}
                    }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Comments Dialog */}
      <Dialog 
        open={commentsDialogOpen}
        onClose={() => setCommentsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          bgcolor: '#E91E60', 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1 }}>
          <Event />
          {selectedTimeline?.couple_name || selectedTimeline?.project_client_name}
          <Chip 
            label={selectedTimeline?.cultural_type}
            size="small"
            sx={{ bgcolor: 'rgba(25,255,255,0.2)', color: 'white'}}
          />
        </DialogTitle>
        
        <DialogContent sx={{ p:  0 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Oversikt" />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Kommentarer
                  <Badge badgeContent={comments.length} color="error" max={99} />
                </Box>
            }
            />
            <Tab label="Klientinformasjon" />
          </Tabs>

	          {/* Tab 0: Overview */}
          {tabValue === 0 && (
            <Box sx={{ p:  3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Prosjektdetaljer</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Prosjektnavn" 
                        secondary={selectedTimeline?.project_name}
                      />
                    </ListItem>
	                    <ListItem>
	                      <ListItemText 
	                        primary="Bryllupsdato" 
	                        secondary={selectedTimeline?.wedding_date
	                          ? format(new Date(selectedTimeline.wedding_date), 'dd. MMMM yyyy', { locale: nb })
	                          : 'Ikke satt'}
	                      />
	                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Lokasjon" 
                        secondary={selectedTimeline?.venue || 'Ikke spesifisert'}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Kulturell type" 
                        secondary={selectedTimeline?.cultural_type}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText 
                        primary="Antall events" 
                        secondary={`${selectedTimeline?.event_count || 0} hendelser`}
                      />
                    </ListItem>
                  </List>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Tilgangsstatus</Typography>
                  <List dense>
                    <ListItem>
                      <ListItemText 
                        primary="Klienttilgang" 
                        secondary={
                          <Chip
                            icon={selectedTimeline?.client_access_enabled ? <Public /> : theming.getThemedIcon('lock')}
                            label={selectedTimeline?.client_access_enabled ? 'Aktivert' : 'Deaktivert'}
                            size="small"
                            color={selectedTimeline?.client_access_enabled ? 'success' : 'default'}
                          />
                      }
                      />
                    </ListItem>
                    {selectedTimeline?.client_access_enabled && (
                      <ListItem>
                        <ListItemText 
                          primary="Tilgangskode" 
                          secondary={selectedTimeline?.client_access_code}
                        />
                      </ListItem>
                    )}
	                    {selectedTimeline?.client_last_activity && (
	                      <ListItem>
	                        <ListItemText 
	                          primary="Sist aktiv" 
	                          secondary={format(
	                            new Date(selectedTimeline.client_last_activity),
	                            'dd. MMMM yyyy HH:mm',
	                            { locale: nb }
	                          )}
	                        />
	                      </ListItem>
	                    )}
                  </List>
                </Grid>
              </Grid>

              {selectedTimeline?.photographer_message && (
                <Box sx={{ mt:  3 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Din besked til klienten</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'info.light',  ...theming.getThemedCardSx() }}>
                    <Typography variant="body2">
                      {selectedTimeline.photographer_message}
                    </Typography>
                  </Paper>
                </Box>
              )}

              {selectedTimeline?.client_notes && (
                <Box sx={{ mt:  3 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Klientens notater</Typography>
                  <Paper sx={{ p: 2, bgcolor: 'warning.light',  ...theming.getThemedCardSx() }}>
                    <Typography variant="body2">
                      {selectedTimeline.client_notes}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          )}

	          {/* Tab 1: Comments */}
          {tabValue === 1 && (
            <Box sx={{ p:  3 }}>
              {/* Comments list */}
              <Box sx={{ maxHeight: 40, overflow: 'auto', mb: 3 }}>
                {comments.length === 0 ? (
                  <Alert severity="info">
                    Ingen kommentarer enda. Legg til den første kommentaren nedenfor.
                  </Alert>
                ) : (
                  comments.map((comment) => (
                    <Box 
                      key={comment.id}
                      sx={{ 
                        mb: 2,
                        p: 2,
                        bgcolor: comment.author_type === 'photographer' ? 'primary.light' : 'grey.10',
                        borderRadius:  1,
                        borderLeft: `4px solid ${comment.author_type === 'photographer' ? '#1976d2' : '#757570'}`
                    }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ 
                            width:  24, 
                            height:  24, 
                            bgcolor: comment.author_type === 'photographer' ? 'primary.main' : 'grey.500' 
                      }}>
                            {comment.author_type === 'photographer' ? theming.getThemedIcon('person') : theming.getThemedIcon('group')}
                          </Avatar>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {comment.author_name}
                          </Typography>
	                          {comment.is_private && (
	                            <Chip 
	                              icon={<Lock />}
	                              label="Privat"
	                              size="small"
	                              color="warning"
	                            />
	                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
	                          {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: nb })}
                        </Typography>
                      </Box>
                      <Typography variant="body2">
                        {comment.message}
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>

              {/* Add new comment */}
              <Divider sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Legg til kommentar</Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Din kommentar"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 2,mb: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isPrivateComment}
                      onChange={(e) => setIsPrivateComment(e.target.checked)}
                    />
                }
                  label="Privat kommentar (kun synlig for deg)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={notifyClient && !isPrivateComment}
                      onChange={(e) => setNotifyClient(e.target.checked)}
                      disabled={isPrivateComment}
                    />
                }
                  label="Varsle klient om endringen"
                />
              </Box>
              <Button variant="contained"
                startIcon={<Send />}
                onClick={handleAddComment}
                disabled={!newComment.trim() || addCommentMutation.isPending}
                sx={{ bgcolor: '#E91E60', '&:hover': { bgcolor: '#C2185B'}}}
              >
                {addCommentMutation.isPending ? 'Legger til...' : 'Legg til kommentar'}
              </Button>
            </Box>
	          )}
	
	          {/* Tab 2: Client Information */}
          {tabValue === 2 && (
            <Box sx={{ p:  3 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Klientinformasjon</Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <List>
                    <ListItem>
                      <ListItemText 
                        primary="Klientnavn" 
                        secondary={selectedTimeline?.project_client_name || selectedTimeline?.couple_name}
                      />
                    </ListItem>
                    {selectedTimeline?.client_email && (
                      <ListItem>
                        <ListItemText 
                          primary="E-post" 
                          secondary={selectedTimeline.client_email}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" href={`mailto: ${selectedTimeline.client_email}`}>
                            {theming.getThemedIcon('email')}
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    )}
                    {selectedTimeline?.client_phone && (
                      <ListItem>
                        <ListItemText 
                          primary="Telefon" 
                          secondary={selectedTimeline.client_phone}
                        />
                        <ListItemSecondaryAction>
                          <IconButton edge="end" href={`tel: ${selectedTimeline.client_phone}`}>
                            {theming.getThemedIcon('phone')}
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    )}
                  </List>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Handlinger</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      variant="outlined"
                      startIcon={theming.getThemedIcon('email')}
                      href={`mailto: ${selectedTimeline?.client_email}`}
                      disabled={!selectedTimeline?.client_email}
                    >
                      Send e-post
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={theming.getThemedIcon('phone')}
                      href={`tel: ${selectedTimeline?.client_phone}`}
                      disabled={!selectedTimeline?.client_phone}
                    >
                      Ring klient
                    </Button>
                    <Button variant="contained"
                      startIcon={theming.getThemedIcon('notifications')}
                      sx={{ bgcolor: '#E91E60', '&:hover': { bgcolor: '#C2185B'}, ...theming.getThemedButtonSx() }}>
                      Informer om endringer
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setCommentsDialogOpen(false)}>
            Lukk
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}