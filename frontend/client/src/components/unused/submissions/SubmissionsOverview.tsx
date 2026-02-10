// @ts-nocheck
// This file is in the unused directory and may have outdated imports
/**
 * CreatorHub Norge - Submissions Overview Component
 * Comprehensive client submissions management with Material UI
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { getAuthHeader } from '@/lib/google/impersonation';
import { apiRequest } from '@/lib/queryClient';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useQuery } from '@tanstack/react-query';
import { getAuthHeader } from '@/lib/google/impersonation';
import { useAuth } from '@/hooks/useAuth';
import { getAuthHeader } from '@/lib/google/impersonation';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Button,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Badge,
  Stack,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Event as EventIcon,
  LocationOn as LocationIcon,
  AttachMoney as MoneyIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Priority as PriorityIcon,
  Notifications as NotificationsIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  People as ContactIcon,
  Notes as NotesIcon,
  Edit as EditIcon,
  Visibility as VisibilityIcon,
  AddCircle as AddIcon,
  SentimentSatisfied as WavingIcon,
  RequestQuote as QuoteIcon,
  VerifiedUser as ConfirmIcon,
  QuestionAnswer as FollowUpIcon,
  Psychology as BrainIcon,
  Create as WriteIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { ClientSubmission, SubmissionFollowUp } from '@shared/schema';
import { getAuthHeader } from '@/lib/google/impersonation';

interface SubmissionStats {
  total: number;
  new: number;
  contacted: number;
  quoteSent: number;
  booked: number;
  todayCount: number;
  urgentCount: number
}

const statusColors = {
  new: '#',
  contacted: '#',
  quote_sent: '#',
  booked: '#',
  completed: '#',
  declined: '#DDA0D0' } as const;

const priorityColors = {
  low: '#',
  medium: '#',
  high: '#E74C30',
  urgent: '#8E44A0' } as const;

interface SubmissionsOverviewProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  // Integration props
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  userId?: string
}

export default function SubmissionsOverview({ 
  profession = 'photographer,',
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  userId
}: SubmissionsOverviewProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedSubmission, setSelectedSubmission] = useState<ClientSubmission | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubmission, setEmailSubmission] = useState<ClientSubmission | null>(null);
  const [emailSubmissionId, setEmailSubmissionId] = useState<string | null>(null); // Track submission ID to persist dialog
  const [emailType, setEmailType] = useState<'initial_contact' | 'quote_sent' | 'booking_confirmation' | 'follow_up'>('initial_contact');
  const [customMessage, setCustomMessage] = useState('');
  const [estimatedHours, setEstimatedHours] = useState<number>(0);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  
  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');

  // Profession-specific project type mapping
  const getProfessionProjectTypes = (profession: string) => {
    switch (profession) {
      case 'photographer':
        return ['bryllup','portrett','business','produkt','event','familie'];
      case 'videographer':
        return ['bryllup','corporate','musikkvideo','event','dokumentar','reklame'];
      case 'music_producer':
        return ['musikk','album','single','podcast','lyddesign','mastering'];
      case 'vendor':
        return ['utstyr','catering','dekor','transport','teknisk','service'];
      default: return [];
}
};

  // Fetch submissions data filtered by profession with error handling
  const { data: submissions = [], isLoading: submissionsLoading, error: submissionsError } = useQuery<ClientSubmission[]>({
    queryKey: ['/api/submissions', profession],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/submissions?profession=${profession}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
        return await response.json();
  } catch (error) {
        console.error('Failed to fetch submissions: ', error);
        return [];
  }
},
    refetchInterval: emailDialogOpen ? false : 3000, // Pause refresh when email dialog is open
    retry:  1,
    staleTime: 6000, // Consider data fresh for 1 minute
});

  // Restore email dialog state after data refresh if submission ID is set
  useEffect(() => {
    if (emailSubmissionId && submissions.length > 0 && !emailSubmission) {
      const submission = submissions.find(s => s.id === emailSubmissionId);
      if (submission) {
        setEmailSubmission(submission);
        setEmailDialogOpen(true);
  }
}
}, [submissions, emailSubmissionId, emailSubmission]);

  // Fetch submission statistics with error handling
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<SubmissionStats>({
    queryKey: ['/api/submissions/stats', ],
    queryFn: async () => {
      try {
        const response = await fetch('/api/submissions/stats');
        if (!response.ok) {
          // Return default stats if API is not available
          return {
            total: 0,
            new:  0,
            contacted:  0,
            quoteSent:  0,
            booked:  0,
            todayCount:  0,
            urgentCount: 0 };
    }
        return await response.json();
  } catch (error) {
        console.error('Failed to fetch submission stats:', error);
        // Return default stats
        return {
          total:  0,
          new:  0,
          contacted:  0,
          quoteSent:  0,
          booked:  0,
          todayCount:  0,
          urgentCount: 0 };
  }
},
    refetchInterval: emailDialogOpen ? false : 6000, // Pause refresh when email dialog is open
    retry:  1,
    staleTime: 6000,
});

  // Update submission status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ , idstatus, internalNotes, followUpDate }: {
      id: string;
      status: string;
      internalNotes?: string;
      followUpDate?: string;
}) => {
      const response = await const auth = await getAuthHeader();
 fetch(`/api/submissions/${id}/status`, {
   headers: auth,
        headers: {
  },
        
        method: 'PU',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ status, internalNotes, followUpDate }),
  });
      return response.json();
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/submissions', ],});
      queryClient.invalidateQueries({ queryKey: ['/api/submissions/stats', ],});
},
});

  // Send email response mutation
  const sendEmailMutation = useMutation({
    mutationFn: async ({ 
      submissiond, 
      responseType, 
      customMessage, 
      estimatedHours, 
      estimatedPrice 
}: {
      submissionId: string;
      responseType: string;
      customMessage?: string;
      estimatedHours?: number;
      estimatedPrice?: number;
}) => {
      const response = await const auth = await getAuthHeader();
 fetch(`/api/submissions/${submissionId}/send-email`, {
   headers: auth,
        headers: {
  },
        
        method: 'POS',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ responseType, customMessage, estimatedHours, estimatedPrice }),
  });
      if (!response.ok) {
        throw new Error('Failed to send email');
  }
      return response.json();
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/submissions', ],});
      setEmailDialogOpen(false);
      setEmailSubmission(null);
      setEmailSubmissionId(null); // Clear submission ID to fully reset dialog state
      setCustomMessage('');
      setEstimatedHours(0);
      setEstimatedPrice(0);
},
});

  // Filter submissions based on selected filters
  const filteredSubmissions = submissions.filter(submission => {
    if (statusFilter !== 'all' && submission.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && submission.priority !== priorityFilter) return false;
    return true;
});

  // Separate submissions by tabs
  const newSubmissions = submissions.filter(s => s.status === 'new');
  const inProgressSubmissions = submissions.filter(s => ['contacted','quote_sent'].includes(s.status || ','));
  const bookedSubmissions = submissions.filter(s => s.status === 'booked');

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      new: 'Ny forespørsel',
      contacted: 'Kontaktet',
      quote_sent: 'Tilbud sendt',
      booked: 'Bestilt',
      completed: 'Fullført',
      declined: 'Avslått' };
    return statusMap[status] || status;
};

  const getPriorityText = (priority: string) => {
    const priorityMap: Record<string, string> = {
      low: 'Lav',
      medium: 'Medium',
      high: 'Hø',
      urgent: 'Kritisk' };
    return priorityMap[priority] || priority;
};

  const formatCurrency = (amount: string | number | null) => {
    if (!amount) return 'Ikke oppgitt';
    return `NOK ${Number(amount).toLocaleString('')}`;
};

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Ikke satt';
    return new Date(dateString).toLocaleDateString('no-NO');
};

  const handleStatusUpdate = (submission: ClientSubmission, newStatus: string) => {
    updateStatusMutation.mutate({
      id: submission.id,
      status: newStatus,
});
};

  // Quick action handlers for integration workflow
  const handleAcceptSubmission = (submission: ClientSubmission) => {
    updateStatusMutation.mutate({
      id: submission.id,
      status: 'accepted',
      internalNotes: `AKSEPTERT: Auto-oppretter prosjekt "${submission.name} - ${submission.projectType}, " | Estimert timer: basert på beskrivelse | Dato: ${new Date().toLocaleDateString('')}`
});
};

  const handleContactClient = (submission: ClientSubmission) => {
    updateStatusMutation.mutate({
      id: submission.id,
      status: 'contacted',
      internalNotes: `KONTAKTET: Oppfølging sendt til ${submission.email} | Dato: ${new Date().toLocaleDateString('')}`
});
};

  const handleBookSubmission = (submission: ClientSubmission) => {
    updateStatusMutation.mutate({
      id: submission.id,
      status: 'booked',
      internalNotes: `BESTILT: Prosjekt bekreftet og bestilt | Auto-oppretter kontrakt | Dato: ${new Date().toLocaleDateString('')}`
});
};

  // Email response handlers
  const handleEmailClient = (submission: ClientSubmission, type: 'initial_contact' | 'quote_sent' | 'booking_confirmation' | 'follow_up') => {
    setEmailSubmission(submission);
    setEmailSubmissionId(submission.id); // Store ID to persist dialog through refresh
    setEmailType(type);
    setEmailDialogOpen(true);
    
    // Auto-calculate estimates based on submission
    const baseHours = calculateEstimatedHoursForSubmission(submission);
    const basePrice = calculateEstimatedPriceForSubmission(submission, baseHours);
    setEstimatedHours(baseHours);
    setEstimatedPrice(basePrice);
};

  const calculateEstimatedHoursForSubmission = (submission: ClientSubmission): number => {
    const baseHours: Record<string, number> = {
      bryllup: 8,
      portrett: 2,
      business: 4,
      produkt: 3,
      event: 6,
      familie: 2,
      musikk: 6,
      video: 8,
    };
    
    let hours = baseHours[submission.projectType] || 4;
    
    if (submission.description && submission.description.length > 200) {
      hours += 1;
    }
    
    if (submission.specialRequests && submission.specialRequests.length > 0) {
      hours += 0.5;
    }
    
    return Math.round(hours * 2) / 2;
};

  const calculateEstimatedPriceForSubmission = (submission: ClientSubmission, hours: number): number => {
    const hourlyRates: Record<string, number> = {
      bryllup: 1200,
      business: 1000,
      portrett: 800,
      produkt: 1100,
      event: 900,
      familie: 700,
      musikk: 1500,
      video: 1300,
    };

    const rate = hourlyRates[submission.projectType] || 1000;
    const subtotal = hours * rate;
    return Math.round(subtotal * 1.25); // Add 25% Norwegian VAT
  };

  const handleSendEmail = () => {
    if (!emailSubmission) return;
    
    sendEmailMutation.mutate({
      submissionId: emailSubmission.id,
      responseType: emailType,
      customMessage: customMessage || undefined,
      estimatedHours: estimatedHours || undefined,
      estimatedPrice: estimatedPrice || undefined
    });
  };

  const renderSubmissionCard = (submission: ClientSubmission) => (
    <Card
      key={submission.id}
      sx={{
        mb:  2,
        position: 'relative', '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow:  4,
    },
        transition: 'all 0.2s ease-in-out' }}
     sx={theming.getThemedCardSx()}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h6" component="h3" sx={{ color: theming.colors.primary }}>
            <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {submission.name}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Chip
              label={getStatusText(submission.status || 'new')}
              size="small"
              sx={{
                backgroundColor: statusColors[submission.status as keyof typeof statusColors] || '#',
                color: 'white',
                fontWeight: 'bold' }}
            />
            <Chip
              label={getPriorityText(submission.priority || 'medium')}
              size="small"
              variant="outlined"
              sx={{
                borderColor: priorityColors[submission.priority as keyof typeof priorityColors] || '#',
                color: priorityColors[submission.priority as keyof typeof priorityColors] || '#'}}
            />
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }} sm={6}>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                <EmailIcon sx={{ fontSize:  16, mr: 1, verticalAlign: 'middle' }} />
                {submission.email}
              </Typography>
              {submission.phone && (
                <Typography variant="body2" color="text.secondary">
                  <PhoneIcon sx={{ fontSize:  16, mr: 1, verticalAlign: 'middle' }} />
                  {submission.phone}
                </Typography>
              )}
              {submission.company && (
                <Typography variant="body2" color="text.secondary">
                  <BusinessIcon sx={{ fontSize:  16, mr: 1, verticalAlign: 'middle' }} />
                  {submission.company}
                </Typography>
              )}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }} sm={6}>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                <AssignmentIcon sx={{ fontSize:  16, mr: 1, verticalAlign: 'middle' }} />
                {submission.projectType}
              </Typography>
              {submission.eventDate && (
                <Typography variant="body2" color="text.secondary">
                  <EventIcon sx={{ fontSize:  16, mr: 1, verticalAlign: 'middle' }} />
                  {formatDate(submission.eventDate)}
                </Typography>
              )}
              {submission.budget && (
                <Typography variant="body2" color="text.secondary">
                  <MoneyIcon sx={{ fontSize:  16, mr: 1, verticalAlign: 'middle' }} />
                  {formatCurrency(submission.budget)}
                </Typography>
              )}
            </Stack>
          </Grid>
        </Grid>

        {submission.description && (
          <Box mt={2}>
            <Typography variant="body2" color="text.secondary">
              <strong>Beskrivelse: </strong> {submission.description.substring(0, 150)}
              {submission.description.length > 150 && '...'}
            </Typography>
          </Box>
        )}

        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            Mottatt: {formatDate(submission.submittedAt || ', ')}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 ,  ...theming.getThemedCardSx() }}>
        {/* Quick Action Buttons - Integration Workflow */}
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => setSelectedSubmission(submission)}
          >
            Detaljer
          </Button>
          
          {/* AKSEPTER BUTTON - Auto-creates project */}
          {submission.status === 'new' && (
            <Button size="small"
              variant="contained"
              startIcon={<CheckCircleIcon />}
              color="success"
              onClick={() => handleAcceptSubmission(submission)}
              disabled={updateStatusMutation.isPending}
              sx={{ 
                background: 'linear-gradient(135deg, #96CEB4 0%, #7FB069 100%)','&:hover': { background: 'linear-gradient(135deg, #7FB069 0%, #6BA04A 100%)' }
          }}
            >
              Aksepter & Opprett Prosjekt
            </Button>
          )}
          
          {/* KONTAKT BUTTON */}
          {['new','contacted'].includes(submission.status || 'new') && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<PhoneIcon />}
              color="primary"
              onClick={() => handleContactClient(submission)}
              disabled={updateStatusMutation.isPending}
            >
              Kontakt klient
            </Button>
          )}

          {/* SVAR KUNDE BUTTON - Send professional email */}
          <Button size="small"
            variant="contained"
            startIcon={<EmailIcon />}
            onClick={() => handleEmailClient(submission, 'initial_contact')}
            disabled={sendEmailMutation.isPending}
            sx={{ 
              background: 'linear-gradient(135deg, #4ECDC4 0%, #36C7B8 100%)',
              color: 'white','&:hover': { background: 'linear-gradient(135deg, #36C7B8 0%, #2EA89A 100%)' }
        }}
          >
            Svar kunde
          </Button>
          
          {/* BESTILL BUTTON - Creates contract */}
          {['contacted','quote_sent'].includes(submission.status || 'new') && (
            <Button size="small"
              variant="contained"
              startIcon={<BusinessIcon />}
              color="primary"
              onClick={() => handleBookSubmission(submission)}
              disabled={updateStatusMutation.isPending}
              sx={{ 
                background: 'linear-gradient(135deg, #45B7D1 0%, #2E86AB 100%)','&:hover': { background: 'linear-gradient(135deg, #2E86AB 0%, #1E5F7F 100%)' }
          }}
            >
              Bestill & Opprett Kontrakt
            </Button>
          )}
        </Stack>
        
        {/* Status Dropdown */}
        <FormControl size="small" sx={{ minWidth: 120}}>
          <Select
            value={submission.status || 'new'}
            onChange={(e) => handleStatusUpdate(submission, e.target.value)}
            variant="outlined"
            disabled={updateStatusMutation.isPending}
          >
            <MenuItem value="new">Ny</MenuItem>
            <MenuItem value="contacted">Kontaktet</MenuItem>
            <MenuItem value="quote_sent">Tilbud sendt</MenuItem>
            <MenuItem value="accepted">Akseptert</MenuItem>
            <MenuItem value="booked">Bestilt</MenuItem>
            <MenuItem value="completed">Fullført</MenuItem>
            <MenuItem value="declined">Avslått</MenuItem>
          </Select>
        </FormControl>
      </CardActions>
    </Card>
);

  if (submissionsLoading || statsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
  );
}

  return (
    <Box sx={{ p:  3 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: theming.colors.primary }}>
          <ContactIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          Kundeforespørsler
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Administrer alle innkommende forespørsler fra potensielle kunder
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)', color: 'white' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats?.total || 0}</Typography>
                  <Typography variant="body2">Totalt</Typography>
                </Box>
                <AssignmentIcon sx={{ fontSize:  40, opacity: 0.8}} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #4ECDC4 0%, #36C7B8 100%)', color: 'white' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats?.new || 0}</Typography>
                  <Typography variant="body2">Nye i dag</Typography>
                </Box>
                <NotificationsIcon sx={{ fontSize:  40, opacity: 0.8}} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #45B7D1 0%, #2E86AB 100%)', color: 'white' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats?.quoteSent || 0}</Typography>
                  <Typography variant="body2">Tilbud sendt</Typography>
                </Box>
                <EmailIcon sx={{ fontSize:  40, opacity: 0.8}} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }} sm={6} md={3}>
          <Card sx={{ background: 'linear-gradient(135deg, #96CEB4 0%, #7FB069 100%)', color: 'white' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" sx={{ color: theming.colors.primary }}>{stats?.booked || 0}</Typography>
                  <Typography variant="body2">Bestilt</Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize:  40, opacity: 0.8}} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 ,  ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="subtitle1">Filtre: </Typography>
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="new">Nye</MenuItem>
              <MenuItem value="contacted">Kontaktet</MenuItem>
              <MenuItem value="quote_sent">Tilbud sendt</MenuItem>
              <MenuItem value="booked">Bestilt</MenuItem>
              <MenuItem value="completed">Fullført</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120}}>
            <InputLabel>Prioritet</InputLabel>
            <Select
              value={priorityFilter}
              label="Prioritet"
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="urgent">Kritisk</MenuItem>
              <MenuItem value="high">Høy</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Lav</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Tabs for different views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}>
        <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
          <Tab
            label={
              <Badge badgeContent={newSubmissions.length} color="error">
                Nye forespørsler
              </Badge>
        }
          />
          <Tab
            label={
              <Badge badgeContent={inProgressSubmissions.length} color="primary">
                Pågående
              </Badge>
        }
          />
          <Tab
            label={
              <Badge badgeContent={bookedSubmissions.length} color="success">
                Bestilt
              </Badge>
        }
          />
          <Tab label="Alle forespørsler" />
        </Tabs>
      </Box>

      {/* Submissions List */}
      <Box>
        {selectedTab === 0 && newSubmissions.map(renderSubmissionCard)}
        {selectedTab === 1 && inProgressSubmissions.map(renderSubmissionCard)}
        {selectedTab === 2 && bookedSubmissions.map(renderSubmissionCard)}
        {selectedTab === 3 && filteredSubmissions.map(renderSubmissionCard)}

        {filteredSubmissions.length === 0 && (
          <Alert severity="info" sx={{ mt:  2 }}>
            Ingen forespørsler funnet med de valgte filtrene.
          </Alert>
        )}
      </Box>

      {/* Submission Detail Dialog */}
      <Dialog
        open={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedSubmission && (
          <>
            <DialogTitle>
              Forespørsel fra {selectedSubmission.name}
            </DialogTitle>
            <DialogContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Kontaktinformasjon</Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Navn: </strong> {selectedSubmission.name}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>E-post: </strong> {selectedSubmission.email}
                  </Typography>
                  {selectedSubmission.phone && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Telefon: </strong> {selectedSubmission.phone}
                    </Typography>
                  )}
                  {selectedSubmission.company && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Firma: </strong> {selectedSubmission.company}
                    </Typography>
                  )}
                </Grid>
                <Grid size={{ xs: 12 }} sm={6}>
                  <Typography variant="subtitle2" gutterBottom>Prosjektdetaljer</Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Type: </strong> {selectedSubmission.projectType}
                  </Typography>
                  {selectedSubmission.eventDate && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Dato: </strong> {formatDate(selectedSubmission.eventDate)}
                    </Typography>
                  )}
                  {selectedSubmission.location && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Sted: </strong> {selectedSubmission.location}
                    </Typography>
                  )}
                  {selectedSubmission.budget && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Budsjett: </strong> {formatCurrency(selectedSubmission.budget)}
                    </Typography>
                  )}
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" gutterBottom>Beskrivelse</Typography>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {selectedSubmission.description}
                  </Typography>
                  {selectedSubmission.specialRequests && (
                    <>
                      <Typography variant="subtitle2" gutterBottom>Spesielle ønsker</Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        {selectedSubmission.specialRequests}
                      </Typography>
                    </>
                  )}
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedSubmission(null)}>Lukk</Button>
              <Button variant="contained" startIcon={<EmailIcon />}>
                Send e-post
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Advanced Email Response Dialog */}
      <Dialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            borderRadius:  3,
            boxShadow: '0 24px 48px rgba(0,0,0,0.15)',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }
    }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #4ECDC4 0%, #36C7B8 100%)',
            color: 'white',
            p:  3,
            display: 'flex',
            alignItems: 'center',
            gap: 2 }}
        >
          <EmailIcon sx={{ fontSize: 28}} />
          <Box>
            <Typography variant="h5" component="div" fontWeight="bold" sx={{ color: theming.colors.primary }}>
              Profesjonell e-post til {emailSubmission?.name}
            </Typography>
            <Typography variant="subtitle2" sx={{ opacity: 0.9}}>
              Intelligent kommunikasjon med automatisk estimering
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p:  0 }}>
          <Grid container>
            {/* Left Panel - Email Configuration */}
            <Grid size={{ xs: 12 }} md={7} sx={{ p:  3 }}>
              <Stack spacing={3}>
                {/* Email Type with Visual Cards */}
                <Box>
                  <Typography variant="h6" gutterBottom sx={{  color: 'text.primary', fontWeight: 600}}>
                    <EmailIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    E-post type
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs:  6 }}>
                      <Card
                        onClick={() => setEmailType('initial_contact')}
                        sx={{
                          cursor: 'pointer',
                          border: emailType === 'initial_contact' ? '2px solid #4ECDC4' : '2px solid transparent',
                          background: emailType === 'initial_contact' 
                            ? 'linear-gradient(135deg, #4ECDC415 0%, #4ECDC425 100%)'
                            : 'white',
                          transition: 'all 0.3s ease','&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px #4ECDC430'
                    }
                    }}
                      >
                        <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                          <WavingIcon sx={{ fontSize:  32, mb: 1, color: '#4ECDC4' }} />
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            Første kontakt
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Velkommen og innledende informasjon
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid size={{ xs:  6 }}>
                      <Card
                        onClick={() => setEmailType('quote_sent')}
                        sx={{
                          cursor: 'pointer',
                          border: emailType === 'quote_sent' ? '2px solid #45B7D1' : '2px solid transparent',
                          background: emailType === 'quote_sent' 
                            ? 'linear-gradient(135deg, #45B7D115 0%, #45B7D125 100%)'
                            : 'white',
                          transition: 'all 0.3s ease','&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px #45B7D130'
                    }
                    }}
                      >
                        <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                          <QuoteIcon sx={{ fontSize:  32, mb: 1, color: '#45B7D1' }} />
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            Send tilbud
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Detaljert tilbud med priser
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid size={{ xs:  6 }}>
                      <Card
                        onClick={() => setEmailType('booking_confirmation')}
                        sx={{
                          cursor: 'pointer',
                          border: emailType === 'booking_confirmation' ? '2px solid #96CEB4' : '2px solid transparent',
                          background: emailType === 'booking_confirmation' 
                            ? 'linear-gradient(135deg, #96CEB415 0%, #96CEB425 100%)'
                            : 'white',
                          transition: 'all 0.3s ease','&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px #96CEB430'
                    }
                    }}
                      >
                        <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                          <ConfirmIcon sx={{ fontSize:  32, mb: 1, color: '#96CEB4' }} />
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            Bekreftelse
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Bekrefter bestilling og detaljer
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>

                    <Grid size={{ xs:  6 }}>
                      <Card
                        onClick={() => setEmailType('follow_up')}
                        sx={{
                          cursor: 'pointer',
                          border: emailType === 'follow_up' ? '2px solid #FF6B35' : '2px solid transparent',
                          background: emailType === 'follow_up' 
                            ? 'linear-gradient(135deg, #FF6B3515 0%, #FF6B3525 100%)'
                            : 'white',
                          transition: 'all 0.3s ease', '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 24px #FF6B3530'
                    }
                    }}
                      >
                        <CardContent sx={{ p: 2, textAlign: 'center' ,  ...theming.getThemedCardSx() }}>
                          <FollowUpIcon sx={{ fontSize:  32, mb: 1, color: '#FF6B35' }} />
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            Oppfølging
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Påminnelse og oppfølging
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                </Box>

                {/* Smart Estimation Section */}
                <Paper
                  sx={{
                    p:  3,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    border: '1px solid #e2e8f0'
            }}
                 sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{  color: 'text.primary', fontWeight: 600}}>
                    <BrainIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Intelligent estimering
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }} sm={6}>
                      <TextField
                        fullWidth
                        label="Estimerte timer"
                        type="number"
                        value={estimatedHours}
                        onChange={(e) => setEstimatedHours(Number(e.target.value))}
                        inputProps={{ min: 0, step: 0.5}}
                        InputProps={{
                          startAdornment: <TimeIcon sx={{ mr: 1, color: 'text.secondary' }} />}}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            background: 'white',
                            borderRadius: 2 }
                    }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Automatisk beregnet basert på prosjekttype
                      </Typography>
                    </Grid>
                    
                    <Grid size={{ xs: 12 }} sm={6}>
                      <TextField
                        fullWidth
                        label="Estimert pris (NOK)"
                        type="number"
                        value={estimatedPrice}
                        onChange={(e) => setEstimatedPrice(Number(e.target.value))}
                        inputProps={{ min:  0 }}
                        InputProps={{
                          startAdornment: <MoneyIcon sx={{ mr: 1, color: 'text.secondary' }} />}}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            background: 'white',
                            borderRadius: 2 }
                    }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Inkludert 25% MVA
                      </Typography>
                    </Grid>
                  </Grid>

                  {/* Price Breakdown */}
                  <Box sx={{ mt: 2, p: 2, background: 'white', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" gutterBottom>Prisoppdeling: </Typography>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Timer ({estimatedHours}h):</Typography>
                      <Typography variant="body2">NOK {Math.round((estimatedPrice / 1.25)).toLocaleString('no-NO')}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">MVA (25%):</Typography>
                      <Typography variant="body2">NOK {Math.round(estimatedPrice - (estimatedPrice / 1.25)).toLocaleString('no-NO')}</Typography>
                    </Stack>
                    <Divider sx={{ my:  1 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle2" fontWeight="bold">Total: </Typography>
                      <Typography variant="subtitle2" fontWeight="bold" color="primary">
                        NOK {estimatedPrice.toLocaleString('')}
                      </Typography>
                    </Stack>
                  </Box>
                </Paper>

                {/* Custom Message */}
                <Box>
                  <Typography variant="h6" gutterBottom sx={{  color: 'text.primary', fontWeight: 600}}>
                    <WriteIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Personlig melding
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Tilpasset melding (valgfritt)"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Legg til en personlig hilsen eller spesifikke detaljer..."
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        background: 'white',
                        borderRadius: 2 }
                }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Dette legges til den profesjonelle e-post malen
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            {/* Right Panel - Customer Info & Preview */}
            <Grid 
              item 
              xs={12}
              md={5}
              sx={{ 
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                borderLeft: '1px solid #e2e8f0'
        }}
            >
              <Box sx={{ p:  3, height: '100%' }}>
                <Typography variant="h6" gutterBottom sx={{  color: 'text.primary', fontWeight: 600}}>
                  <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Kundeinformasjon
                </Typography>
                
                {emailSubmission && (
                  <Stack spacing={3}>
                    {/* Customer Card */}
                    <Card sx={{ background: 'white', border: '1px solid #e2e8f0' ,  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Stack spacing={2}>
                          <Box display="flex" alignItems="center" gap={2}>
                            <Box
                              sx={{
                                width:  48,
                                height:  48,
                                borderRadius: '50, %',
                                background: 'linear-gradient(135deg, #4ECDC4 0%, #36C7B8 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '20px',
                                fontWeight: 'bold'
                        }}
                            >
                              {emailSubmission.name.charAt(0)}
                            </Box>
                            <Box>
                              <Typography variant="h6" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                                {emailSubmission.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {emailSubmission.email}
                              </Typography>
                            </Box>
                          </Box>
                          
                          <Divider />
                          
                          <Grid container spacing={2}>
                            <Grid size={{ xs:  6 }}>
                              <Typography variant="caption" color="text.secondary">TELEFON</Typography>
                              <Typography variant="body2">{emailSubmission.phone || 'Ikke oppgitt'}</Typography>
                            </Grid>
                            <Grid size={{ xs:  6 }}>
                              <Typography variant="caption" color="text.secondary">FIRMA</Typography>
                              <Typography variant="body2">{emailSubmission.company || 'Privat'}</Typography>
                            </Grid>
                          </Grid>
                        </Stack>
                      </CardContent>
                    </Card>

                    {/* Project Details */}
                    <Card sx={{ background: 'white', border: '1px solid #e2e8f0' ,  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          <AssignmentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          Prosjektdetaljer
                        </Typography>
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">PROSJEKTTYPE</Typography>
                            <Chip 
                              label={emailSubmission.projectType}
                              size="small" 
                              sx={{ 
                                ml:  1,
                                background: 'linear-gradient(135deg, #4ECDC4 0%, #36C7B8 100%)',
                                color: 'white'
                        }}
                            />
                          </Box>
                          
                          {emailSubmission.eventDate && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">DATO</Typography>
                              <Typography variant="body2">{formatDate(emailSubmission.eventDate)}</Typography>
                            </Box>
                          )}
                          
                          {emailSubmission.location && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">LOKASJON</Typography>
                              <Typography variant="body2">{emailSubmission.location}</Typography>
                            </Box>
                          )}
                          
                          {emailSubmission.budget && (
                            <Box>
                              <Typography variant="caption" color="text.secondary">KUNDENS BUDSJETT</Typography>
                              <Typography variant="body2" color="primary" fontWeight="bold">
                                {formatCurrency(emailSubmission.budget)}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>

                    {/* Email Preview Summary */}
                    <Card sx={{ background: 'linear-gradient(135deg, #4ECDC4 0%, #36C7B8 100%)', color: 'white' ,  ...theming.getThemedCardSx() }}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          <EmailIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                          E-post sammendrag
                        </Typography>
                        <Stack spacing={1}>
                          <Typography variant="body2">
                            <strong>Type: </strong> {emailType === 'initial_contact' ? 'Første kontakt' : 
                                                   emailType === 'quote_sent' ? 'Send tilbud' :
                                                   emailType === 'booking_confirmation' ? 'Bestillingsbekreftelse' : 'Oppfølging'}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Estimat: </strong> {estimatedHours}h - NOK {estimatedPrice.toLocaleString('no-NO')}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Melding: </strong> {customMessage ? 'Personlig melding inkludert' : 'Standard mal'}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p:  3, background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Button 
            onClick={() => setEmailDialogOpen(false)}
            disabled={sendEmailMutation.isPending}
            sx={{ color: 'text.secondary' }}
          >
            Avbryt
          </Button>
          <Button
            variant="contained"
            onClick={handleSendEmail}
            disabled={sendEmailMutation.isPending || !emailSubmission}
            startIcon={
              sendEmailMutation.isPending ? (
                <CircularProgress size={16} sx={theming.getThemedButtonSx()} />
              ) : (
                <EmailIcon />
              )
            }
            sx={{
              background: 'linear-gradient(135deg, #4ECDC4 0%, #36C7B8 100%)',
              px: 4,
              py: 1.5,
              borderRadius: 3,
              fontWeight: 'bold',
              fontSize: '1.1rem',
              '&:hover': {
                background: 'linear-gradient(135deg, #36C7B8 0%, #2EA89A 100%)',
                transform: 'translateY(-1px)',
                boxShadow: '0 8px 24px rgba(8, 205, 196, 0.3)',
              },
            }}
          >
            {sendEmailMutation.isPending
              ? 'Sender e-post...'
              : 'Send profesjonell e-post'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
);
}