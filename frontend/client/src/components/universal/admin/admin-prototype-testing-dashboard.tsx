import React, { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccessTime, Analytics, Assessment, BugReport, Feedback, Lightbulb, Person, Psychology, ThumbUp, TrendingUp } from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { trackButtonClick, useActionTracker } from '@/hooks/useActionTracker';
import { useTheming } from '../../../utils/theming-helper';

interface FeedbackLastAction {
  type: string;
  element: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

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
  lastAction?: FeedbackLastAction;
}

interface ActionSummaryEntry {
  action: string;
  count: number;
}

interface ProfessionSummaryEntry {
  profession: string;
  count: number;
}

interface ActionSummary {
  totalActions: number;
  recentActions: number;
  topActions: ActionSummaryEntry[];
  professionBreakdown: ProfessionSummaryEntry[];
}

function parseFeedbackData(raw: unknown): FeedbackEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is FeedbackEntry => typeof entry === 'object' && entry !== null && 'id' in entry);
}

function parseActionSummary(raw: unknown): ActionSummary {
  if (typeof raw !== 'object' || raw === null) {
    return {
      totalActions: 0,
      recentActions: 0,
      topActions: [],
      professionBreakdown: [],
    };
  }

  const data = raw as Partial<ActionSummary>;
  return {
    totalActions: typeof data.totalActions === 'number' ? data.totalActions : 0,
    recentActions: typeof data.recentActions === 'number' ? data.recentActions : 0,
    topActions: Array.isArray(data.topActions) ? data.topActions : [],
    professionBreakdown: Array.isArray(data.professionBreakdown) ? data.professionBreakdown : [],
  };
}

export default function AdminPrototypeTestingDashboard() {
  const queryClient = useQueryClient();
  const theming = useTheming('prototype_tester');

  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackEntry | null>(null);
  const [filterProfession, setFilterProfession] = useState<string>('all');
  const [showAnalytics, setShowAnalytics] = useState(false);

  const { lastAction, recentActions } = useActionTracker();

  const {
    data: feedbackData = [],
    isLoading: feedbackLoading,
  } = useQuery<FeedbackEntry[]>({
    queryKey: ['/api/prototype-feedback'],
    queryFn: async () => parseFeedbackData(await apiRequest('/api/prototype-feedback')),
    retry: false,
    refetchInterval: 3000,
  });

  const {
    data: actionAnalytics = {
      totalActions: 0,
      recentActions: 0,
      topActions: [],
      professionBreakdown: [],
    },
    isLoading: analyticsLoading,
  } = useQuery<ActionSummary>({
    queryKey: ['/api/action-analytics'],
    queryFn: async () => parseActionSummary(await apiRequest('/api/action-analytics')),
    retry: false,
    refetchInterval: 6000,
  });

  const resolveFeedbackMutation = useMutation({
    mutationFn: async (feedbackId: string) =>
      apiRequest(`/api/prototype-feedback/${feedbackId}/resolve`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/prototype-feedback'] });
      setSelectedFeedback(null);
    },
  });

  const filteredFeedback = useMemo(
    () =>
      feedbackData.filter(
        (feedback) => filterProfession === 'all' || feedback.profession === filterProfession,
      ),
    [feedbackData, filterProfession],
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return '#f44336';
      case 'high':
        return '#ff9800';
      case 'medium':
        return '#2196f3';
      case 'low':
        return '#4caf50';
      default:
        return '#757575';
    }
  };

  const getFeedbackTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <BugReport sx={{ color: '#f44336' }} />;
      case 'feature':
        return <Lightbulb sx={{ color: '#ff9800' }} />;
      case 'usability':
        return <ThumbUp sx={{ color: '#4caf50' }} />;
      default:
        return <Feedback sx={{ color: '#2196f3' }} />;
    }
  };

  const handleViewDetails = (feedback: FeedbackEntry) => {
    trackButtonClick('admin_feedback_details', {
      feedbackId: feedback.id,
      profession: feedback.profession,
      component: 'admin_prototype_dashboard',
    });
    setSelectedFeedback(feedback);
  };

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main', mb: 1 }}>
          🔬 Admin Prototype Testing Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Intelligent feedback tracking med action analytics for CreatorHub Norge
        </Typography>
      </Box>

      {lastAction && (
        <Alert
          severity="info"
          sx={{ mb: 3, border: '1px solid rgba(3, 150, 243, 0.3)' }}
          icon={theming.getThemedIcon('autoAwesome')}
        >
          <strong>Siste brukerhandling:</strong> {lastAction.element} (
          {Math.round((Date.now() - lastAction.timestamp) / 1000)} sekunder siden)
          {lastAction.context?.profession && ` • Profesjon: ${String(lastAction.context.profession)}`}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Psychology sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                {feedbackData.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Feedback
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <TrendingUp sx={{ fontSize: 40, color: '#f57c00', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                {actionAnalytics.totalActions}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Tracked Actions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <Assessment sx={{ fontSize: 40, color: '#388e3c', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                {feedbackData.filter((f) => f.rating >= 4).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Positive Feedback
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={{ textAlign: 'center', ...theming.getThemedCardSx() }}>
              <AccessTime sx={{ fontSize: 40, color: '#c2185b', mb: 1 }} />
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: theming.colors.primary }}>
                {recentActions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Recent Actions
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2, mb: 3, ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Filter:
          </Typography>
          {['all', 'photographer', 'videographer', 'music_producer', 'vendor'].map((prof) => (
            <Chip
              key={prof}
              label={prof === 'all' ? 'Alle' : prof.replace('_', ' ')}
              onClick={() => {
                trackButtonClick('admin_filter_profession', {
                  profession: prof,
                  component: 'admin_dashboard',
                });
                setFilterProfession(prof);
              }}
              color={filterProfession === prof ? 'primary' : 'default'}
              variant={filterProfession === prof ? 'filled' : 'outlined'}
            />
          ))}
          <Button
            startIcon={<Analytics />}
            onClick={() => {
              trackButtonClick('admin_analytics_toggle', {
                component: 'admin_dashboard',
              });
              setShowAnalytics((prev) => !prev);
            }}
            variant={showAnalytics ? 'contained' : 'outlined'}
          >
            Analytics
          </Button>
        </Stack>
      </Paper>

      {showAnalytics && (
        <Paper sx={{ p: 3, mb: 3, ...theming.getThemedCardSx() }}>
          <Typography variant="h6" sx={{ mb: 2, color: theming.colors.primary }}>
            📊 Action Analytics
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Top Handlinger:
              </Typography>
              <List dense>
                {actionAnalytics.topActions.map((action) => (
                  <ListItem key={action.action}>
                    <ListItemIcon>
                      <TrendingUp fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={action.action} secondary={`${action.count} ganger`} />
                  </ListItem>
                ))}
              </List>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                Profesjon Fordeling:
              </Typography>
              <List dense>
                {actionAnalytics.professionBreakdown.map((prof) => (
                  <ListItem key={prof.profession}>
                    <ListItemIcon>
                      <Person fontSize="small" />
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

      <Paper sx={{ overflow: 'hidden', ...theming.getThemedCardSx() }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tittel</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Profesjon</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Prioritet</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Rating</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Tidspunkt</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Handlinger</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredFeedback.map((feedback) => (
                <TableRow key={feedback.id} hover>
                  <TableCell>{getFeedbackTypeIcon(feedback.feedbackType)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {feedback.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {feedback.component}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={feedback.profession} size="small" color="secondary" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={feedback.priority}
                      size="small"
                      sx={{
                        bgcolor: getPriorityColor(feedback.priority),
                        color: 'white',
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">{feedback.rating}/5</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(feedback.rating / 5) * 100}
                        sx={{ width: 60 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(feedback.timestamp).toLocaleString('no-NO')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleViewDetails(feedback)}>
                      Detaljer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {(feedbackLoading || analyticsLoading) && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
        </Box>
      )}

      <Dialog open={Boolean(selectedFeedback)} onClose={() => setSelectedFeedback(null)} maxWidth="md" fullWidth>
        {selectedFeedback && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                <Grid item xs={12}>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedFeedback.description}
                  </Typography>
                </Grid>

                {selectedFeedback.lastAction && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        🎯 Kontekst - Siste Brukerhandling:
                      </Typography>
                      <Typography variant="body2">
                        <strong>Element:</strong> {selectedFeedback.lastAction.element}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Type:</strong> {selectedFeedback.lastAction.type}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Tidspunkt:</strong>{' '}
                        {new Date(selectedFeedback.lastAction.timestamp).toLocaleString('no-NO')}
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedFeedback(null)}>Lukk</Button>
              <Button
                variant="contained"
                onClick={() => {
                  trackButtonClick('admin_resolve_feedback', {
                    feedbackId: selectedFeedback.id,
                    component: 'admin_dashboard',
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
