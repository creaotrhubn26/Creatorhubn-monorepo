// @ts-nocheck
// This file is in the unused directory and may have outdated imports
import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Stack,
} from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useActionTracker, trackButtonClick } from '@/hooks/useActionTracker';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Psychology,
  TrendingUp,
  Assessment,
  Feedback,
  AutoAwesome,
  AccessTime,
  Person,
  BugReport,
  Lightbulb,
  ThumbUp,
  Timeline,
  Analytics,
  Dashboard,
  Settings,
  Refresh,
  FilterList,
} from '@mui/icons-material';

interface FeedbackEntry {
  id: string;
  userId: string;
  profession: string;
  dashboardType: string;
  feedbackType: string;
  title: string;
  description: string;
  rating: number;
  priority: string;
  component: string;
  timestamp: string;
  userEmail?: string;
  isAnonymous: boolean;
  lastAction?: {
    type: string;
    element: string;
    timestamp: number;
    context: any;
};
}

interface ActionSummary {
  totalActions: number;
  recentActions: number;
  topActions: { action: string; count: number }[];
  professionBreakdown: { profession: string; count: number }[];
}

export default function AdminPrototypeTestingDashboard() {
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null);
  const [filterProfession, setFilterProfession] = useState<string>('all');
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Get intelligent action tracking data
  const { lastAction, recentActions, generateContextualQuestion } = useActionTracker();

  // Fetch feedback data
  const { data: feedbackData = [], isLoading: feedbackLoading } = useQuery<FeedbackEntry[]>({
    queryKey: ['/api/prototype-feedback', ],
    queryFn: () => apiRequest('/api/prototype-feedback,', ),
    retry: false,
    refetchInterval: 30000 // Refresh every 30 seconds
});

  // Fetch action tracking analytics
  const { data: actionAnalytics, isLoading: analyticsLoading } = useQuery<ActionSummary>({
    queryKey: ['/api/action-analytics', ],
    queryFn: () => apiRequest('/api/action-analytics', ),
    retry: false,
    refetchInterval: 60000 // Refresh every minute
});

  // Mark feedback as resolved
  const resolveFeedbackMutation = useMutation({
    mutationFn: async (feedbackId: string) => {
      const auth = await getAuthHeader();
      return apiRequest(`/api/prototype-feedback/${feedbackd}/resolve`, {
        headers: auth,
        method: 'POST'
  });
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prototype-feedback', ],});
      setSelectedFeedback(null);
  }
});

  const handleViewDetails = (feedback: FeedbackEntry) => {
    trackButtonClick('admin_feedback_details', {
      feedbackId: feedback.d,
      profession: feedback.profession,
      component: 'admin_prototype_dashboard'
});
    setSelectedFeedback(feedback);
};

  const filteredFeedback = feedbackData.filter(feedback => 
    filterProfession === 'all' || feedback.profession === filterProfession
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#f44336';
      case 'high': return '#ff9800';
      case 'medium': return '#2196f3';
      case 'low': return '#4caf50';
      default: return '#757575';
}
};

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return <BugReport sx={{ color: '#f44336'}} />;
      case 'feature': return <Lightbulb sx={{ color: '#ff9800'}} />;
      case 'usability': return <ThumbUp sx={{ color: '#4caf50'}} />;
      default: return <Feedback sx={{ color: '#2196f3'}} />;
  }
};

  return (
    <Box sx={{ p:  3, bgcolor: 'background.default', minHeight: '100vh'}}>
      {/* Header */}
      <Box sx={{ mb:  4 }}>
        <Typography variant="h4" sx={{  fontWeight: 'bold', color: 'primary.main', mb:  1  }}>
          🔬 Admin Prototype Testing Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Intelligent feedback tracking med action analytics for CreatorHub Norge
        </Typography>
      </Box>

      {/* Current Action Tracking Info */}
      {lastAction && (
        <Alert 
          severity="info" 
          sx={{ mb:  3, border: '1px solid rgba(3, 150, 243, 0.3)' }}
          icon={theming.getThemedIcon('autoAwesome')}
        >
          <strong>Siste brukerhandling: </strong> {lastAction.element}
          ({Math.round((Date.now() - lastAction.timestamp) / 1000)} sekunder siden)
          {lastAction.context?.profession && ` • Profesjon: ${lastAction.context.profession}`}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb:  4 }}>
        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={{ bgcolor: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Psychology sx={{ fontSize:  40, color: '#1976d0', mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
                {feedbackData.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Feedback
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={{ bgcolor: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <TrendingUp sx={{ fontSize:  40, color: '#f57c00', mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
                {actionAnalytics?.totalActions || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tracked Actions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={{ bgcolor: 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <Assessment sx={{ fontSize:  40, color: '#388e30', mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
                {feedbackData.filter(f => f.rating >= 4).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Positive Feedback
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={{ bgcolor: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <AccessTime sx={{ fontSize:  40, color: '#c21850', mb:  1 }} />
              <Typography variant="h4" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
                {recentActions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Recent Actions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 3 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold'}}>
            Filter: </Typography>
          {['all', 'photographer', 'videographer', 'music_producer','vendor'].map((prof) => (
            <Chip
              key={prof}
              label={prof === 'all' ? 'Alle' : prof.replace('_', ',')}
              onClick={() => {
                trackButtonClick('admin_filter_profession', { profession: prof, component: 'admin_dashboard',});
                setFilterProfession(prof);
            }}
              color={filterProfession === prof ? 'primary' : 'default'}
              variant={filterProfession === prof ? 'filled' : 'outlined'}
            />
          ))}
          <Button
            startIcon={theming.getThemedIcon('analytics')}
            onClick={() => {
              trackButtonClick('admin_analytics_toggle', { component: 'admin_dashboard',});
              setShowAnalytics(!showAnalytics);
          }}
            variant={showAnalytics ? 'contained' : 'outlined'}
          >
            Analytics
          </Button>
        </Stack>
      </Paper>

      {/* Analytics Panel */}
      {showAnalytics && actionAnalytics && (
        <Paper sx={{ p:  3, mb:  3, bgcolor: 'rgba(3, 150, 243, 0.05)' ,  ...theming.getThemedCardSx() }}>
          <Typography variant="h6" sx={{  mb: 2, color: theming.colors.primary }}>
            📊 Action Analytics
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold'}}>
                Top Handlinger: </Typography>
              <List dense>
                {actionAnalytics.topActions?.map((action, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Timeline sx={{ fontSize: 20}} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={action.action}
                      secondary={`${action.count} ganger`}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
            <Grid size={{ xs: 12 }} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold'}}>
                Profesjon Fordeling: </Typography>
              <List dense>
                {actionAnalytics.professionBreakdown?.map((prof, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Person sx={{ fontSize: 20}} />
                    </ListItemIcon>
                    <ListItemText 
                      primary={prof.profession}
                      secondary={`${prof.count} handlinger`}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Feedback Table */}
      <Paper sx={{ overflow: 'hidden',  ...theming.getThemedCardSx() }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main'}}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold'}}>Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold'}}>Tittel</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold'}}>Profesjon</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold'}}>Prioritet</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold'}}>Rating</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold'}}>Timestamp</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold'}}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFeedback.map((feedback) => (
                <TableRow key={feedback.id} hover>
                  <TableCell>
                    {getFeedbackTypeIcon(feedback.feedbackType)}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold'}}>
                      {feedback.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {feedback.component}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={feedback.profession}
                      size="small" 
                      color="secondary"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={feedback.priority}
                      size="small"
                      sx={{ 
                        bgcolor: getPriorityColor(feedback.priority),
                        color: 'white'
                  }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Typography variant="body2">
                        {feedback.rating}/5
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={(feedback.rating / 5) * 100}
                        sx={{ width: 60}}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(feedback.timestamp).toLocaleString('no-NO')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => handleViewDetails(feedback)}
                      sx={{ mr:  1 }}
                    >
                      Detaljer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Loading States */}
      {(feedbackLoading || analyticsLoading) && (
        <Box sx={{ mt:  2 }}>
          <LinearProgress />
        </Box>
      )}

      {/* Feedback Details Modal */}
      <Dialog
        open={!!selectedFeedback}
        onClose={() => setSelectedFeedback(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedFeedback && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                {getFeedbackTypeIcon(selectedFeedback.feedbackType)}
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {selectedFeedback.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {selectedFeedback.component} • {selectedFeedback.profession}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body1" sx={{ mb:  2 }}>
                    {selectedFeedback.description}
                  </Typography>
                </Grid>
                
                {selectedFeedback.lastAction && (
                  <Grid size={{ xs: 12 }}>
                    <Paper sx={{ p: 2, bgcolor: 'rgba(3, 150, 243, 0.05)' ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb:  1 }}>
                        🎯 Kontekst - Siste Brukerhandling: </Typography>
                      <Typography variant="body2">
                        <strong>Element:</strong> {selectedFeedback.lastAction.element}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Type: </strong> {selectedFeedback.lastAction.type}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Tidspunkt: </strong> {new Date(selectedFeedback.lastAction.timestamp).toLocaleString(', ')}
                      </Typography>
                      {selectedFeedback.lastAction.context && (
                        <Typography variant="body2">
                          <strong>Ekstra kontekst: </strong> {JSON.stringify(selectedFeedback.lastAction.context, null, 2)}
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                )}

                <Grid size={{ xs:  6 }}>
                  <Typography variant="subtitle2">Rating: </Typography>
                  <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                    {selectedFeedback.rating}/5
                  </Typography>
                </Grid>
                <Grid size={{ xs:  6 }}>
                  <Typography variant="subtitle2">Prioritet: </Typography>
                  <Chip 
                    label={selectedFeedback.priority}
                    sx={{ 
                      bgcolor: getPriorityColor(selectedFeedback.priority),
                      color: 'white',
                      fontWeight: 'bold'
                }}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedFeedback(null)}>
                Lukk
              </Button>
              <Button variant="contained"
                onClick={() => {
                  trackButtonClick('admin_resolve_feedback', { 
                    feedbackId: selectedFeedback.d,
                    component: 'admin_dashboard'
              });
                  resolveFeedbackMutation.mutate(selectedFeedback.id);
              }}
                disabled={resolveFeedbackMutation.isPending}
              >
                Marker som løst
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}