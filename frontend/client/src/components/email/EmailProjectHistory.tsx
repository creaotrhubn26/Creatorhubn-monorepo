import { useTheming } from '../../utils/theming-helper';
import React, { useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Chip,
  Stack,
  Button,
  Card,
  CardContent
} from '@mui/material';
import {
  Email as EmailIcon,
  Send as SendIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
  Mouse as MouseIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';

interface EmailProjectHistoryProps {
  profession: string;
  showAll?: boolean;
  projectId?: string;
  // Integration props
  onMeetingCreate?: (meeting: EmailMeeting) => void;
  onProjectUpdate?: (project: EmailProjectUpdate) => void;
  onWorklogCreate?: (worklog: EmailWorklog) => void;
  selectedProject?: EmailProjectSelection | null;
  onProjectSelect?: (project: EmailProjectSelection | null) => void;
  userId?: string;
}

type StatusColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

interface EmailProjectSelection {
  id: string;
  name?: string;
}

interface EmailMeeting {
  id: string;
  title: string;
  agenda?: string;
  scheduledFor: string;
  projectId?: string;
  userId?: string;
}

interface EmailWorklog {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  projectId?: string;
  userId?: string;
}

interface EmailProjectUpdate {
  id?: string;
  status?: string;
  note?: string;
  updatedAt: string;
}

interface EmailActivityItem {
  trackingId?: string;
  subject: string;
  status?: string;
  opened?: boolean;
  clicks?: number;
  emailType?: string;
  sentAt?: string;
  openedAt?: string | null;
}

interface EmailActivityResponse {
  recentActivity: EmailActivityItem[];
  totalEmails?: number;
  deliveryStats?: {
    opened?: number;
    clicked?: number;
  };
  engagementRate?: number;
}

export default function EmailProjectHistory({
  profession, 
  showAll = true, 
  projectId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  userId
}: EmailProjectHistoryProps) {
  // Theming system
  const theming = useTheming(profession || 'photographer');

  const effectiveProjectId = projectId || selectedProject?.id || '';

  const createEventId = useCallback((prefix: string) => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  // Get recent email activity with tracking data
  const { data: emailActivity, isLoading } = useQuery<EmailActivityResponse>({
    queryKey: ['/api/projects', effectiveProjectId, 'email-activity', profession, userId],
    queryFn: async () => {
      if (!effectiveProjectId) {
        return { recentActivity: [], totalEmails: 0, deliveryStats: { opened: 0, clicked: 0 }, engagementRate: 0 };
      }
      return apiRequest(`/api/projects/${effectiveProjectId}/email-activity`);
    },
    staleTime: 30 * 1000, // 30 seconds for real-time feel
    enabled: !!effectiveProjectId
});

  const recentEmails = emailActivity?.recentActivity || [];
  const latestEmail = recentEmails[0];

  const handleCreateMeeting = useCallback(() => {
    if (!onMeetingCreate || !latestEmail) return;

    onMeetingCreate({
      id: createEventId('meeting'),
      title: `Oppfolging: ${latestEmail.subject}`,
      agenda: 'Gjennomga siste e-postdialog og neste steg.',
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      projectId: effectiveProjectId || undefined,
      userId
    });

    if (effectiveProjectId && onProjectUpdate) {
      onProjectUpdate({
        id: effectiveProjectId,
        status: 'email_followup_scheduled',
        note: `Oppfolging booket etter e-post: ${latestEmail.subject}`,
        updatedAt: new Date().toISOString()
      });
    }
  }, [createEventId, effectiveProjectId, latestEmail, onMeetingCreate, onProjectUpdate, userId]);

  const handleCreateWorklog = useCallback(() => {
    if (!onWorklogCreate || !latestEmail) return;

    const openedText = latestEmail.opened ? 'Aapnet' : 'Ikke aapnet';
    const clicksText = latestEmail.clicks ? `${latestEmail.clicks} klikk` : 'Ingen klikk';

    onWorklogCreate({
      id: createEventId('worklog'),
      title: `E-post logg: ${latestEmail.subject}`,
      description: `Status: ${latestEmail.status || 'ukjent'} • ${openedText} • ${clicksText}`,
      createdAt: new Date().toISOString(),
      projectId: effectiveProjectId || undefined,
      userId
    });

    if (effectiveProjectId && onProjectUpdate) {
      onProjectUpdate({
        id: effectiveProjectId,
        status: 'email_activity_logged',
        note: `E-postaktivitet logget for: ${latestEmail.subject}`,
        updatedAt: new Date().toISOString()
      });
    }
  }, [createEventId, effectiveProjectId, latestEmail, onProjectUpdate, onWorklogCreate, userId]);

  const handleUseSelectedProject = useCallback(() => {
    if (!selectedProject || !onProjectSelect) return;
    onProjectSelect(selectedProject);
  }, [onProjectSelect, selectedProject]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('no-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
});
};

  const getStatusColor = (email: EmailActivityItem): StatusColor => {
    if (email.status === 'failed') return 'error';
    if (email.clicks > 0) return 'success'; // Engaged
    if (email.opened) return 'primary'; // Opened
    if (email.status === 'sent') return 'info'; // Sent but not opened
    return 'default';
};

  const getAvatarBg = (email: EmailActivityItem, theme: any) => {
    const statusColor = getStatusColor(email);
    if (statusColor === 'default') return theme.palette.grey[100];
    return theme.palette[statusColor]?.main || theme.palette.grey[100];
  };

  const getStatusIcon = (email: EmailActivityItem) => {
    if (email.clicks > 0) return <MouseIcon />; // Has clicks
    if (email.opened) return <VisibilityIcon />; // Opened but no clicks
    if (email.status === 'sent') return <SendIcon />; // Sent
    return <ScheduleIcon />;
};

  const getStatusText = (email: EmailActivityItem) => {
    if (email.clicks > 0) return `Engasjert (${email.clicks} klikk)`;
    if (email.opened) return 'Åpnet';
    if (email.status === 'sent') return 'Sendt';
    return 'Ikke lest';
};

  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py:  3 }}>
        <Typography variant="body2" color="text.secondary">
          Laster e-post aktivitet...
        </Typography>
      </Box>
    );
}

  if (recentEmails.length === 0) {
    return (
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Box sx={{ textAlign: 'center', py:  4 }}>
            <EmailIcon sx={{ fontSize:  60, color: 'text.secondary', mb:  2 }} />
            <Typography variant="h6" color="text.secondary" sx={{  mb:  1  }}>
              Ingen e-post aktivitet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Send din første e-post for å se aktivitet her
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
}

  const displayEmails = showAll ? recentEmails : recentEmails.slice(0, 5);

  return (
    <Box>
      {/* Email Activity Summary */}
      {emailActivity && (
        <Card sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
          <CardContent sx={theming.getThemedCardSx()}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              📧 E-post Statistikk
            </Typography>
            <Stack direction="row" spacing={3} sx={{ mb:  2 }}>
              <Chip 
                label={`${emailActivity.totalEmails} totalt`}
                color="default" 
                variant="outlined" 
              />
              <Chip 
                label={`${emailActivity.deliveryStats?.opened || 0} åpnet`}
                color="primary" 
                variant="outlined"
                icon={<VisibilityIcon />}
              />
              <Chip 
                label={`${emailActivity.deliveryStats?.clicked || 0} klikket`}
                color="success" 
                variant="outlined"
                icon={<MouseIcon />}
              />
              <Chip 
                label={`${emailActivity.engagementRate || 0}% engasjement`}
                color="info" 
                variant="outlined"
                icon={<TrendingUpIcon />}
              />
            </Stack>
            {(onMeetingCreate || onWorklogCreate || (selectedProject && onProjectSelect)) && (
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                {selectedProject && onProjectSelect && (
                  <Button variant="outlined" onClick={handleUseSelectedProject}>
                    Bruk valgt prosjekt
                  </Button>
                )}
                {onMeetingCreate && latestEmail && (
                  <Button variant="contained" onClick={handleCreateMeeting}>
                    Planlegg oppfolging
                  </Button>
                )}
                {onWorklogCreate && latestEmail && (
                  <Button variant="outlined" onClick={handleCreateWorklog}>
                    Logg aktivitet
                  </Button>
                )}
              </Stack>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Email Timeline */}
      <Card sx={theming.getThemedCardSx()}>
        <CardContent sx={theming.getThemedCardSx()}>
        <Stack spacing={2}>
          <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <EmailIcon color="primary" />
            E-post Historikk
          </Typography>

          <List dense>
            {displayEmails.map((email, index) => (
              <ListItem key={email.trackingId || index} sx={{ px:  0 }}>
                <ListItemIcon>
                  <Avatar sx={{ 
                    bgcolor: theme => getAvatarBg(email, theme),
                    width:  40, 
                    height: 40 }}>
                    {getStatusIcon(email)}
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {email.subject}
                      </Typography>
                      {email.opened && (
                        <Chip 
                          size="small" 
                          label="Åpnet" 
                          color="primary" 
                          variant="outlined"
                          icon={<VisibilityIcon sx={{ fontSize: 14}} />}
                        />
                      )}
                      {email.clicks > 0 && (
                        <Chip 
                          size="small" 
                          label={`${email.clicks} klikk`}
                          color="success" 
                          variant="outlined"
                          icon={<MouseIcon sx={{ fontSize: 14}} />}
                        />
                      )}
                    </Box>
                }
                  secondary={
                    <Stack spacing={0.5}>
                      <Typography variant="caption">
                        Type: {email.emailType?.replace(/_/g, ' ') || 'Generell'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Sendt: {email.sentAt ? formatDate(email.sentAt) : 'Ukjent'}
                      </Typography>
                      {email.openedAt && (
                        <Typography variant="caption" color="primary">
                          Åpnet: {formatDate(email.openedAt)}
                        </Typography>
                      )}
                    </Stack>
                }
                />
                <Stack alignItems="center" spacing={0.5}>
                  <Chip
                    size="small"
                    label={getStatusText(email)}
                    color={getStatusColor(email)}
                    variant="outlined"
                  />
                  {email.trackingId && (
                    <Typography variant="caption" color="text.secondary">
                      ID: {email.trackingId.split('_').pop()}
                    </Typography>
                  )}
                </Stack>
              </ListItem>
            ))}
          </List>

          {!showAll && recentEmails.length > 5 && (
            <Button variant="outlined" fullWidth>
              Se alle {recentEmails.length} e-poster
            </Button>
          )}
        </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}