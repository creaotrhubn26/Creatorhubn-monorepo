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
import {
  COMMUNITY_DIALOG_ACTIONS_SX,
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_MUTED,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_PRIMARY_BUTTON_SX,
  COMMUNITY_DIALOG_SECONDARY_BUTTON_SX,
  COMMUNITY_DIALOG_SURFACE_SX,
  COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
  COMMUNITY_DIALOG_SWITCH_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_TAB_SX,
  COMMUNITY_DIALOG_TABS_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

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
      <Card sx={COMMUNITY_DIALOG_SURFACE_SUBTLE_SX}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle color="success" />
            <Box>
              <Typography variant="h4" sx={{ color: COMMUNITY_DIALOG_TEXT }}>
                {stats?.questions_answered || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                Spørsmål besvart
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={COMMUNITY_DIALOG_SURFACE_SUBTLE_SX}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schedule color="primary" />
            <Box>
              <Typography variant="h4" sx={{ color: COMMUNITY_DIALOG_TEXT }}>
                {stats?.avg_response_time ? `${Math.round(parseFloat(stats.avg_response_time) / 60)}m` : 'Ikke satt'}
              </Typography>
              <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                Gj.snitt responstid
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={COMMUNITY_DIALOG_SURFACE_SUBTLE_SX}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUp color="success" />
            <Box>
              <Typography variant="h4" sx={{ color: COMMUNITY_DIALOG_TEXT }}>
                {stats?.solutions_marked || 0}
              </Typography>
              <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                Løsninger markert
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card sx={COMMUNITY_DIALOG_SURFACE_SUBTLE_SX}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4" sx={{ color: COMMUNITY_DIALOG_TEXT }}>
              ⭐ {stats?.help_rating?.toFixed(1) || '0.0'}
            </Typography>
            <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
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
                ...COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
                borderRadius: 2,
                mb: 1,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                  borderColor: 'rgba(255, 140, 0, 0.24)',
                },
              }}
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
                    <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                      {question.author_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
                      • {question.channel_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={COMMUNITY_DIALOG_SX}
      PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
    >
      <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <School sx={{ color: '#ffd27a' }} />
            <Typography variant="h6" sx={{ fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
              Mentoroversikt
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isSupported && (
              <Tooltip title="Push-varsler innstillinger">
                <IconButton
                  onClick={() => setPushSettingsOpen(true)}
                  size="small"
                  sx={{
                    ...COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
                    color: pushEnabled ? '#ffd27a' : COMMUNITY_DIALOG_TEXT,
                  }}
                >
                  {pushEnabled ? <NotificationsActive /> : <Notifications />}
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={onClose} size="small" sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX}>
        {/* Stats Section */}
        {stats && renderStats()}

        <Divider sx={{ my: 2 }} />

        {/* Tabs for different views */}
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ ...COMMUNITY_DIALOG_TABS_SX, mb: 2 }}>
          <Tab
            sx={COMMUNITY_DIALOG_TAB_SX}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <HelpOutline fontSize="small" />
                Tildelte ({assignedQuestions.length})
              </Box>
            }
          />
          <Tab
            sx={COMMUNITY_DIALOG_TAB_SX}
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
          <Button variant="outlined" onClick={fetchDashboardData} disabled={loading} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>
            Oppdater
          </Button>
        </Box>
      </DialogContent>
      <DialogActions sx={COMMUNITY_DIALOG_ACTIONS_SX}>
        <Button onClick={onClose} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>
          Lukk
        </Button>
      </DialogActions>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog
          open={pushSettingsOpen}
          onClose={() => setPushSettingsOpen(false)}
          maxWidth="sm"
          fullWidth
          sx={COMMUNITY_DIALOG_SX}
          PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
        >
          <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>Push-varsler innstillinger</DialogTitle>
          <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX}>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={userId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions sx={COMMUNITY_DIALOG_ACTIONS_SX}>
            <Button onClick={() => setPushSettingsOpen(false)} sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}>
              Lukk
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Dialog>
  );
};

export default MentorDashboard;
