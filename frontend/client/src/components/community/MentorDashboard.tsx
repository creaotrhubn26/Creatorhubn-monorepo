import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  Button,
  Divider,
  Alert,
  Tooltip,
  DialogActions,
} from '@mui/material';
import {
  Close,
  HelpOutline,
  Notifications,
  NotificationsActive,
  School,
  Warning,
  CheckCircle,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface MentorDashboardProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSelectQuestion: (messageId: string, channelId: string) => void;
}

interface MentorStats {
  questions_answered: number;
  avg_response_time: string;
  solutions_marked: number;
  help_rating: number;
}

interface Question {
  id: string;
  content: string;
  author_name: string;
  author_avatar: string;
  channel_name: string;
  channel_id: string;
  hours_waiting: number;
  created_at: string;
}

const MentorDashboard: React.FC<MentorDashboardProps> = ({
  open,
  onClose,
  userId,
  onSelectQuestion,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<MentorStats | null>(null);
  const [assignedQuestions, setAssignedQuestions] = useState<Question[]>([]);
  const [sosAlerts, setSosAlerts] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  useEffect(() => {
    if (open) {
      fetchDashboardData();
    }
  }, [open]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await apiRequest('/api/community/mentors/dashboard');
      setStats(response.stats);
      setAssignedQuestions(response.assignedQuestions || []);
      setSosAlerts(response.sosAlerts || []);
    } catch (error) {
      console.error('Error fetching mentor dashboard: ', error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (hoursWaiting: number) => {
    if (hoursWaiting > 48) return 'error';
    if (hoursWaiting > 24) return 'warning';
    return 'info';
  };

  const renderStats = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="success" />
            <Box>
              <Typography variant="h4">{stats?.questions_answered || 0}</Typography>
              <Typography variant="caption" color="text.secondary">
                Spørsmål besvart
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schedule color="primary" />
            <Box>
              <Typography variant="h4">
                {stats?.avg_response_time ? `${Math.round(parseFloat(stats.avg_response_time) / 60)}m` : 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gj.snitt responstid
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="success" />
            <Box>
              <Typography variant="h4">{stats?.solutions_marked || 0}</Typography>
              <Typography variant="caption" color="text.secondary">
                Løsninger markert
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4">⭐ {stats?.help_rating?.toFixed(1) || '0.0'}</Typography>
            <Typography variant="caption" color="text.secondary">
              Hjelpsomhetsrating
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );

  const renderQuestionsList = (questions: Question[], title: string, emptyMessage: string) => (
    <Box>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
        {title}
      </Typography>
      {questions.length === 0 ? (
        <Alert severity="info">{emptyMessage}</Alert>
      ) : (
        <List>
          {questions.map((question) => (
            <ListItem
              key={question.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }}}
              onClick={() => {
                onSelectQuestion(question.id, question.channel_id);
                onClose();
              }}
            >
              <ListItemAvatar>
                <Avatar src={question.author_avatar}>{question.author_name?.[0]}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {question.content.substring(0, 100)}
                      {question.content.length > 100 && '...'}
                    </Typography>
                    <Chip
                      label={`${Math.round(question.hours_waiting)}t`}
                      size="small"
                      color={getUrgencyColor(question.hours_waiting)}
                    />
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {question.author_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      • {question.channel_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      • {formatDistanceToNow(new Date(question.created_at), { addSuffix: true, locale: nb })}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <School color="primary" />
            <Typography variant="h6">Mentor Dashboard</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isSupported && (
              <Tooltip title="Push-varsler innstillinger">
                <IconButton onClick={() => setPushSettingsOpen(true)} size="small" color={pushEnabled ? 'primary' : 'default'}>
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Stats Section */}
        {stats && renderStats()}

        <Divider sx={{ my: 2 }} />

        {/* Tabs for different views */}
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HelpOutline fontSize="small" />
                Tildelte ({assignedQuestions.length})
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning fontSize="small" />
                SOS Varsler ({sosAlerts.length})
              </Box>
            }
          />
        </Tabs>

        {/* Tab Content */}
        {activeTab === 0 &&
          renderQuestionsList(
            assignedQuestions, 'Dine tildelte spørsmål', 'Du har ingen tildelte spørsmål akkurat nå. Bra jobbet!'
          )}

        {activeTab === 1 &&
          renderQuestionsList(
            sosAlerts, 'SOS Varsler - Trenger hjelp nå!', 'Ingen SOS varsler akkurat nå. Alt er under kontroll!'
          )}

        {/* Refresh Button */}
        <Box sx={{ display: 'flex', justifyContent:'center', mt: 3 }}>
          <Button variant="outlined" onClick={fetchDashboardData} disabled={loading}>
            Oppdater
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
      </DialogActions>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Dialog>
  );
};

export default MentorDashboard;
