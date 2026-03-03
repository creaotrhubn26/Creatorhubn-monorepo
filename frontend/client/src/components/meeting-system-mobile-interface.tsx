import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  CalendarToday,
  Phone,
  Settings,
  Share,
  Videocam,
  People,
  AccessTime,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useAuth } from '@/hooks/useAuth';
import { useMobile } from '@/hooks/use-mobile';
import SettingsPage from '@/components/SettingsPage';

interface MeetingSystemMobileInterfaceProps {
  children: React.ReactNode;
}

type MobileTab = 'moter' | 'kalender' | 'opptak' | 'instillinger';

interface MobileMeeting {
  id: string;
  title: string;
  client: string;
  time: string;
  type: 'video' | 'phone';
  status: 'upcoming' | 'live';
}

const mockMeetings: MobileMeeting[] = [
  {
    id: 'mobile-meet-1',
    title: 'Bryllup-konsultasjon',
    client: 'Emma & Lars',
    time: '14:00 - 15:00',
    type: 'video',
    status: 'upcoming',
  },
  {
    id: 'mobile-meet-2',
    title: 'Portfolio review',
    client: 'Bergen Music AS',
    time: '16:30 - 17:30',
    type: 'video',
    status: 'upcoming',
  },
  {
    id: 'mobile-meet-3',
    title: 'Statusmøte',
    client: 'Norsk Film Studio',
    time: '19:00 - 19:30',
    type: 'phone',
    status: 'live',
  },
];

export const MeetingSystemMobileInterface: React.FC<MeetingSystemMobileInterfaceProps> = ({
  children,
}) => {
  const isMobile = useMobile();
  const theming = useTheming('prototype_tester');
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<MobileTab>('moter');
  const [showQuickActions, setShowQuickActions] = useState(false);

  const todayCount = mockMeetings.length;
  const liveCount = useMemo(
    () => mockMeetings.filter((meeting) => meeting.status === 'live').length,
    [],
  );

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ p: 2, pb: 10, minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Møtesystem
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isAuthenticated ? `Logget inn som ${user?.email ?? 'bruker'}` : 'Ikke logget inn'}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setShowQuickActions(true)}>
          Hurtigvalg
        </Button>
      </Box>

      {activeTab === 'moter' && (
        <Box>
          <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ color: theming.colors.primary }}>
                Dagens oversikt
              </Typography>
              <Box display="flex" justifyContent="space-between" mt={1}>
                <Stat label="I dag" value={todayCount} />
                <Stat label="Live" value={liveCount} />
                <Stat label="Planlagt" value={todayCount - liveCount} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={theming.getThemedCardSx()}>
            <CardHeader title="Dagens møter" />
            <CardContent>
              <List>
                {mockMeetings.map((meeting) => (
                  <ListItem key={meeting.id} divider>
                    <ListItemIcon>
                      {meeting.type === 'video' ? <Videocam color="primary" /> : <Phone color="success" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={meeting.title}
                      secondary={`${meeting.client} • ${meeting.time}`}
                    />
                    <ListItemSecondaryAction>
                      <Button size="small" variant="outlined">
                        Bli med
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      )}

      {activeTab === 'kalender' && (
        <Card sx={theming.getThemedCardSx()}>
          <CardHeader title="Møtekalender" />
          <CardContent>
            {['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'].map((day, index) => (
              <Box key={day} display="flex" justifyContent="space-between" alignItems="center" py={1}>
                <Box>
                  <Typography variant="body2">{day}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Uke {30 + index}
                  </Typography>
                </Box>
                <Chip size="small" label={`${(index % 3) + 1} møter`} />
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'opptak' && (
        <Card sx={theming.getThemedCardSx()}>
          <CardHeader title="Opptak" />
          <CardContent>
            <List>
              {[
                { title: 'Kickoff-opptak', date: '18. juli 2026', duration: '45 min', size: '280 MB' },
                { title: 'Review-opptak', date: '17. juli 2026', duration: '32 min', size: '195 MB' },
              ].map((recording) => (
                <ListItem key={recording.title} divider>
                  <ListItemIcon>
                    <Videocam />
                  </ListItemIcon>
                  <ListItemText
                    primary={recording.title}
                    secondary={`${recording.date} • ${recording.duration} • ${recording.size}`}
                  />
                  <Button size="small">Åpne</Button>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {activeTab === 'instillinger' && (
        <Card sx={theming.getThemedCardSx()}>
          <CardHeader title="Innstillinger" />
          <CardContent>
            <SettingsPage />
          </CardContent>
        </Card>
      )}

      <Divider sx={{ my: 2 }} />

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: '1px solid #dbe5f1',
          backgroundColor: '#ffffff',
          zIndex: 10,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value as MobileTab)}
          variant="fullWidth"
        >
          <Tab value="moter" icon={<Videocam />} label="Møter" />
          <Tab value="kalender" icon={<CalendarToday />} label="Kalender" />
          <Tab value="opptak" icon={<AccessTime />} label="Opptak" />
          <Tab value="instillinger" icon={<Settings />} label="Innst." />
        </Tabs>
      </Box>

      <Dialog open={showQuickActions} onClose={() => setShowQuickActions(false)} fullWidth>
        <DialogTitle>Hurtighandlinger</DialogTitle>
        <DialogContent>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} py={1}>
            <QuickButton icon={<Videocam />} label="Start møte" />
            <QuickButton icon={<CalendarToday />} label="Planlegg" />
            <QuickButton icon={<People />} label="Gruppemøte" />
            <QuickButton icon={<Share />} label="Del skjerm" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowQuickActions(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

function Stat({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <Box textAlign="center">
      <Typography variant="h6">{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

function QuickButton({ icon, label }: { icon: React.ReactNode; label: string }): JSX.Element {
  return (
    <Button variant="outlined" sx={{ minHeight: 72, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <IconButton size="small">{icon}</IconButton>
      <Typography variant="caption">{label}</Typography>
    </Button>
  );
}

export default MeetingSystemMobileInterface;
