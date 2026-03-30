import { useTheming } from '../../utils/theming-helper';
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Grid,
  Alert,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  Email as EmailIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  CameraAlt as CameraIcon,
  Videocam as VideocamIcon,
  LibraryMusic as MusicIcon,
  Store as StoreIcon,
  Reply as ReplyIcon,
  Add as AddIcon,
  AddCircle as AddCircleIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  PriorityHigh as PriorityIcon,
  Send as SendIcon,
  Inbox as InboxIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import SmartEmailComposer from './SmartEmailComposer';
// Import dynamic profession system
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';

interface CustomerInquiryCenterProps {
  profession?: string; // Made optional since we'll use dynamic professions
  userId: string;
  customBranding?: {
    color: string;
    businessName: string;
};
  // Integration props for unified workflow connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  onClientSelect?: (client: any) => void;
  onClientUpdate?: (client: any) => void;
  onShowcaseCreate?: (showcase: any) => void;
  onFileUpload?: (file: any) => void;
  onFileDownload?: (file: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  selectedClient?: any;
  onCreateProjectFromSubmission?: (data: any) => void;
  onOpenInquiryInChat?: (email: EmailMessage) => void;
}

export interface EmailMessage {
  id: string;
  subject: string;
  from: { name: string; email: string };
  timestamp: string;
  isRead: boolean;
  isStarred: boolean;
  category: 'inquiry' | 'project' | 'general';
  priority: 'low' | 'normal' | 'high';
  isCustomerInquiry?: boolean;
  body?: string;
  eventDate?: string | null;
  budget?: number | null;
  location?: string;
}

function TabPanel({ children, value, index, ...other }: any) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`inquiry-tabpanel-${index}`}
      aria-labelledby={`inquiry-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default function CustomerInquiryCenter({ 
  profession, 
  userId, 
  customBranding,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  onClientSelect,
  onClientUpdate,
  onShowcaseCreate,
  onFileUpload,
  onFileDownload,
  selectedProject,
  onProjectSelect,
  selectedClient,
  onCreateProjectFromSubmission,
  onOpenInquiryInChat,
}: CustomerInquiryCenterProps) {
  // Dynamic profession system hooks
  const { user } = useAuth();
  
  // Theming system
  const theming = useTheming('photographer');
  const { 
    professions, 
    loading: professionsLoading, 
    error: professionsError,
    getProfessionConfig 
} = useDynamicProfessions();
  
  const userProfession = profession || 'photographer';
  const professionConfig = getProfessionConfig(userProfession || '');
  const brandColor = customBranding?.color || '#ff8c00';
  const hasResolvedUser = typeof userId === 'string' && userId.trim().length > 0 && userId !== 'guest';

  const [selectedTab, setSelectedTab] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'replied' | 'starred'>('new');
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState('10:00');
  const [meetingNotes, setMeetingNotes] = useState('');

  const queryClient = useQueryClient();

  // Fetch comprehensive data for customer inquiries and submissions
  const { data: emails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ['/api/emails/recent', userId],
    queryFn: () => apiRequest(`/api/emails/recent?userId=${userId}`),
    enabled: hasResolvedUser,
    refetchInterval: hasResolvedUser ? 30000 : false,
  });

  const { data: emailStats } = useQuery({
    queryKey: ['/api/emails/stats', userId],
    queryFn: () => apiRequest(`/api/emails/stats?userId=${userId}`),
    enabled: hasResolvedUser,
    refetchInterval: hasResolvedUser ? 60000 : false,
  });

  const { data: emailContacts = [] } = useQuery({
    queryKey: ['/api/emails/contacts', userId],
    queryFn: () => apiRequest(`/api/emails/contacts?userId=${userId}`),
    enabled: hasResolvedUser,
  });

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['/api/submissions', userProfession],
    queryFn: () => apiRequest(`/api/submissions?profession=${userProfession}`),
    enabled: !!userProfession && !professionsLoading && hasResolvedUser,
  });

  // Handle compose actions
  const handleReply = (email: EmailMessage) => {
    // Set up email for Smart Composer with proper reply formatting
    const replyEmail = {
      ...email,
      subject: email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`,
      originalMessage: `
På ${email.timestamp} skrev ${email.from.name} <${email.from.email}>:

${email.subject}

---
Dette er en forespørsel fra ${email.from.name}.
Svar med profesjonell og vennlig tone.
      `.trim()
  };
    
    setSelectedEmail(replyEmail);
    setReplyOpen(true);
};

  const buildSubmissionEmailMessage = (submission: any): EmailMessage => ({
    id: submission.id,
    subject: submission.projectType || submission.project_type
      ? `Forespørsel: ${submission.projectType || submission.project_type} - ${submission.name || submission.email || 'Kunde'}`
      : `Ny kundeforespørsel fra ${submission.name || submission.email || 'Kunde'}`,
    from: {
      name: submission.name || 'Kunde',
      email: submission.email || '',
    },
    timestamp: submission.createdAt || submission.created_at || new Date().toISOString(),
    isRead: false,
    isStarred: false,
    category: 'inquiry',
    priority: submission.priority === 'urgent' || submission.priority === 'high' ? 'high' : 'normal',
    isCustomerInquiry: true,
    body: submission.description || submission.message || '',
    eventDate: submission.eventDate || submission.event_date || null,
    budget: submission.budget || null,
    location: submission.location || '',
  });

  const handleOpenInquiry = (email: EmailMessage) => {
    if (onOpenInquiryInChat) {
      onOpenInquiryInChat(email);
      return;
    }

    handleReply(email);
  };



  // Get profession icon using dynamic profession config
  const getProfessionIcon = () => {
    if (!professionConfig) return PersonIcon;
    
    // Map profession types to icons
    switch (userProfession) {
      case 'photographer': return CameraIcon;
      case 'videographer': return VideocamIcon;
      case 'music_producer': return MusicIcon;
      case 'vendor': return StoreIcon;
      default: return PersonIcon;
}
};

  const ProfessionIcon = getProfessionIcon();

  // Categorize inquiries with intelligent filtering  
  const customerInquiries = useMemo(() => {
    return (Array.isArray(emails) ? emails : []).filter((email: EmailMessage) => {
      // Mark as customer inquiry based on keywords and context
      const isInquiry = email.subject.toLowerCase().includes('forespørsel') ||
                       email.subject.toLowerCase().includes('booking') ||
                       email.subject.toLowerCase().includes('pris') ||
                       email.subject.toLowerCase().includes('tilgjengelig') ||
                       email.subject.toLowerCase().includes('interessert') ||
                       (profession === 'photographer' && (
                         email.subject.toLowerCase().includes('bryllup') ||
                         email.subject.toLowerCase().includes('fotografering') ||
                         email.subject.toLowerCase().includes('portrett')
                       )) ||
                       (profession === 'videographer' && (
                         email.subject.toLowerCase().includes('video') ||
                         email.subject.toLowerCase().includes('filming') ||
                         email.subject.toLowerCase().includes('produksjon')
                       ));
      
      return isInquiry || email.category === 'inquiry';
});
}, [emails, profession]);

  // Filter inquiries based on status
  const filteredInquiries = useMemo(() => {
    return customerInquiries.filter((email: EmailMessage) => {
      switch (filterStatus) {
        case 'new': return !email.isRead;
        case 'replied': return email.isRead;
        case 'starred': return email.isStarred;
        default: return true;
  }
  });
}, [customerInquiries, filterStatus]);

  // Calculate stats
  const stats = useMemo(() => {
    const newInquiries = customerInquiries.filter((email: EmailMessage) => !email.isRead).length;
    const repliedInquiries = customerInquiries.filter((email: EmailMessage) => email.isRead).length;
    const highPriority = customerInquiries.filter((email: EmailMessage) => email.priority === 'high' || email.isStarred).length;
    
    return { newInquiries, repliedInquiries, highPriority };
}, [customerInquiries]);



  const handleCreateProject = (email: EmailMessage) => {
    // Integration with project creation system — trigger ProjectCreationWithMemoryCards
    const linkedClient = {
      name: email.from?.name || selectedClient?.name || '',
      email: email.from?.email || selectedClient?.email || '',
      source: 'customer-inquiry',
      inquiryId: email.id,
    };
    const projectData = {
      projectName: `${(email as any).projectType || 'Prosjekt'} - ${email.from?.name || 'Ukjent'}`,
      clientName: email.from?.name || '',
      clientEmail: email.from?.email || '',
      clientPhone: (email as any).phone || '',
      description: (email as any).body || email.subject || '',
      projectType: (email as any).projectType || 'wedding',
      budget: (email as any).budget || null,
      eventDate: (email as any).eventDate || '',
      location: (email as any).location || '',
      submissionId: email.id,
      ownerId: user?.id || userId,
      linkedProjectId: selectedProject?.id || null,
    };

    onClientSelect?.(linkedClient);
    onClientUpdate?.({ ...linkedClient, lastProjectProposalAt: new Date().toISOString() });
    onProjectSelect?.({ id: projectData.linkedProjectId, name: projectData.projectName, fromInquiryId: email.id });
    onProjectUpdate?.({ ...projectData, status: 'draft-from-inquiry' });
    onWorklogCreate?.({
      type: 'inquiry-conversion',
      inquiryId: email.id,
      title: `Opprettet prosjektforslag fra ${email.from?.name || 'kunde'}`,
      createdAt: new Date().toISOString(),
    });
    onShowcaseCreate?.({
      type: 'inquiry-highlight',
      inquiryId: email.id,
      title: email.subject,
    });
    onFileUpload?.({
      type: 'inquiry-payload',
      inquiryId: email.id,
      payload: projectData,
    });
    onFileDownload?.({
      type: 'inquiry-summary',
      inquiryId: email.id,
      summary: `${email.subject} (${email.from?.email || 'ukjent e-post'})`,
    });

    if (onCreateProjectFromSubmission) {
      onCreateProjectFromSubmission(projectData);
    } else {
      console.log('Creating project from inquiry:', projectData);
    }
  };

  const handleToggleStar = (emailId: string) => {
    // Update star status locally and persist to backend
    const emailsArray = Array.isArray(emails) ? emails : [];
    const updatedEmails = emailsArray.map((email: any) => 
      email.id === emailId ? { ...email, isStarred: !email.isStarred } : email
    );

    queryClient.setQueryData(['/api/emails/recent', userId], updatedEmails);
    
    // Would trigger API call to update email star status
    apiRequest('/api/emails/star', {
      method: 'PATCH',
      body: JSON.stringify({ emailId, starred: !emailsArray.find((e: any) => e.id === emailId)?.isStarred })
  }).catch((err) => {
      console.log('Star toggle pending', err);
      queryClient.invalidateQueries({ queryKey: ['/api/emails/recent', userId] });
    });
    
    console.log('Toggling star for email:', emailId);
};

  const handleScheduleMeeting = () => {
    const primaryInquiry = filteredInquiries[0];
    onMeetingCreate?.({
      title: `Oppfølgingsmøte ${professionConfig?.displayName || 'Kunde'}`,
      date: meetingDate,
      time: meetingTime,
      notes: meetingNotes,
      customerEmail: primaryInquiry?.from?.email || null,
      customerName: primaryInquiry?.from?.name || null,
      source: 'customer-inquiry-center',
    });
    setMeetingDialogOpen(false);
    setMeetingNotes('');
  };

  // Loading state for profession data
  if (professionsLoading) {
    return (
      <Box sx={{ p:  3, textAlign: 'center'}}>
        <Typography>Laster kundehenvendelser for {professionConfig?.displayName || 'din profesjon'}...</Typography>
      </Box>
    );
}

  return (
    <Box>
      {professionsError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Kunne ikke hente alle profesjonsinnstillinger. Standardoppsett brukes.
        </Alert>
      )}

      {/* Comprehensive Dashboard Stats */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {/* Email Stats */}
        <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
          <Card sx={{ 
            background: `linear-gradient(45deg, ${customBranding?.color || '#ff8c00'}20, ${customBranding?.color || '#ff8c00'}10)`,
            border: `1px solid ${customBranding?.color || '#ff8c00'}30`,
            height: '100%'
      ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <InboxIcon sx={{ color: customBranding?.color || '#ff8c00', fontSize:  28, mb:  1 }} />
              <Typography variant="h4" sx={{  color: customBranding?.color || '#ff8c00', fontWeight: 700 }}>
                {stats.newInquiries}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Nye Forespørsler
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
          <Card sx={{ 
            background: 'rgba(6, 175, 80, 0.1)',
            border: '1px solid rgba(6, 175, 80, 0.3)',
            height: '100%'
      ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <ReplyIcon sx={{ color: '#4caf50', fontSize:  28, mb:  1 }} />
              <Typography variant="h4" sx={{  color: '#4caf50', fontWeight: 700 }}>
                {stats.repliedInquiries}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Besvarte
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        {/* Submissions Stats */}
        <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
          <Card sx={{ 
            background: 'rgba(3, 150, 243, 0.1)',
            border: '1px solid rgba(3, 150, 243, 0.3)',
            height: '100%'
      ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <AssignmentIcon sx={{ color: '#2196f0', fontSize:  28, mb:  1 }} />
              <Typography variant="h4" sx={{  color: '#2196f0', fontWeight: 700 }}>
                {submissions.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {professionConfig ? `${professionConfig.displayName} Forespørsler` : 'Kundeforespørsler'}
              </Typography>
            </CardContent>
          </Card>
        </Box>
        
        <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
          <Card sx={{ 
            background: 'rgba(25, 1520.1)',
            border: '1px solid rgba(25, 1520.3)',
            height: '100%'
      ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={{ p: 2, textAlign: 'center',  ...theming.getThemedCardSx() }}>
              <TrendingUpIcon sx={{ color: '#ff9800', fontSize:  28, mb:  1 }} />
              <Typography variant="h4" sx={{  color: '#ff9800', fontWeight: 700 }}>
                {stats.highPriority}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Høy Prioritet
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Enhanced Filter Tabs with more functionality */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb:  2 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb:  1 }}>
          <Typography variant="h6" sx={{  color: customBranding?.color || '#ff8c00' }}>
            Kundeforespørsler & Kommunikasjon
          </Typography>
          <Chip size="small" label={`${professions.length} profesjoner`} />
          {selectedProject?.name && <Chip size="small" color="primary" label={`Prosjekt: ${selectedProject.name}`} />}
          {selectedClient?.name && <Chip size="small" color="secondary" label={`Klient: ${selectedClient.name}`} />}
          <Button size="small"
            variant="contained"
            startIcon={<AddCircleIcon />}
            onClick={() => {
              setSelectedEmail(null);
              setReplyOpen(true);
          }}
            sx={{ 
              bgcolor: customBranding?.color || '#ff8c00', '&:hover': { bgcolor: customBranding?.color || '#ff8c00' + 'dd',}
          }}
          >
            Ny E-post
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ScheduleIcon />}
            onClick={() => setMeetingDialogOpen(true)}
          >
            Planlegg møte
          </Button>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Filterstatus</InputLabel>
            <Select
              value={filterStatus}
              label="Filterstatus"
              onChange={(event) => setFilterStatus(event.target.value as 'all' | 'new' | 'replied' | 'starred')}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="new">Nye</MenuItem>
              <MenuItem value="replied">Besvarte</MenuItem>
              <MenuItem value="starred">Stjernemerket</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary">
            Trykk på stjerneikonet for å prioritere viktige henvendelser.
          </Typography>
        </Stack>
        <Divider />
        
        <Tabs 
          value={selectedTab}
          onChange={(e, newValue) => setSelectedTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            '& .MuiTab-root': {
              fontSize: '0.8rem',
              minHeight: 40,
              textTransform: 'none'
            }, '& .MuiTabs-indicator': {
              backgroundColor: customBranding?.color || '#ff8c00'
            }
          }}
        >
          <Tab 
            label={
              <Badge badgeContent={stats.newInquiries} color="error">
                Nye Forespørsler
              </Badge>
          }
            onClick={() => setFilterStatus('new')}
          />
          <Tab 
            label="Alle E-poster"
            onClick={() => setFilterStatus('all')}
          />
          <Tab 
            label={
              profession === 'photographer' ? 'Booking Forespørsler' :
              profession === 'videographer' ? 'Video Bestillinger' :
              profession === 'music_producer' ? 'Musikk Forespørsler' :
              'Kundeforespørsler'
          }
          />
          <Tab 
            label="Kontakter"
          />
          <Tab 
            label="Statistikk"
          />
        </Tabs>
      </Box>

      {/* Multi-tab Content */}
      <Box>
        <TabPanel value={selectedTab} index={0}>
          {emailsLoading ? (
            <Box>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>Laster inn forespørsler...</Typography>
            </Box>
          ) : filteredInquiries.length > 0 ? (
            <List dense>
              {filteredInquiries.map((email: EmailMessage) => (
                <ListItem
                  key={email.id}
                  component="div"
                  onClick={() => handleOpenInquiry(email)}
                  sx={{
                    mb: 1,
                    border: `1px solid ${email.isRead ? '#e0e0e0' : `${brandColor}55`}`,
                    borderRadius: 2,
                    bgcolor: email.isRead ? '#f9f9f9' : `${brandColor}11`,
                    cursor: 'pointer',
                  }}
                >
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: email.isRead ? '#9e9e9e' : brandColor, width: 32, height: 32 }}>
                      <ProfessionIcon sx={{ fontSize: '1rem' }} />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    secondaryTypographyProps={{ component: 'div' }}
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: email.isRead ? 400 : 600, flex: 1 }}>
                          {email.subject}
                        </Typography>
                        {email.priority === 'high' && <PriorityIcon sx={{ color: '#f44336', fontSize: '1rem' }} />}
                        <Tooltip title={email.isStarred ? 'Fjern stjerne' : 'Marker som viktig'}>
                          <IconButton
                            size="small"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleStar(email.id);
                            }}
                            sx={{ color: email.isStarred ? '#ffb400' : '#9e9e9e' }}
                          >
                            {email.isStarred ? <StarIcon /> : <StarBorderIcon />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    }
                    secondary={
                      <Stack direction="row" spacing={2} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                        <Typography variant="caption" color="text.secondary">
                          {email.from.name} • {email.timestamp}
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<ReplyIcon />}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenInquiry(email);
                            }}
                            sx={{ borderColor: brandColor, color: brandColor }}
                          >
                            Svar
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCreateProject(email);
                            }}
                            sx={{ bgcolor: brandColor }}
                          >
                            Opprett Prosjekt
                          </Button>
                        </Stack>
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Card sx={{ textAlign: 'center', py: 3, ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <ProfessionIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  {filterStatus === 'new' ? 'Ingen nye kundeforespørsler' : 'Ingen forespørsler funnet'}
                </Typography>
              </CardContent>
            </Card>
          )}
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          <List dense>
            {(Array.isArray(emails) ? emails : []).map((email: any) => (
              <ListItem
                key={email.id}
                component="div"
                onClick={() => handleOpenInquiry(email)}
                sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1, cursor: 'pointer' }}
              >
                <ListItemIcon><EmailIcon /></ListItemIcon>
                <ListItemText primary={email.subject} secondary={`${email.from?.name || 'Ukjent'} • ${email.timestamp}`} />
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={selectedTab} index={2}>
          {submissionsLoading ? (
            <Box>
              <LinearProgress sx={{ mb: 2 }} />
              <Typography>Laster inn kundeforespørsler...</Typography>
            </Box>
          ) : (
            <List dense>
              {submissions.map((submission: any) => {
                const submissionEmail = buildSubmissionEmailMessage(submission);

                return (
                <ListItem
                  key={submission.id}
                  component="div"
                  onClick={() => handleOpenInquiry(submissionEmail)}
                  sx={{
                    mb: 1,
                    border: `1px solid ${brandColor}55`,
                    borderRadius: 2,
                    bgcolor: `${brandColor}11`,
                    cursor: 'pointer',
                  }}
                >
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: brandColor, width: 32, height: 32 }}>
                      <ProfessionIcon sx={{ fontSize: '1rem' }} />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={submission.name || submission.title || submission.email}
                    secondary={`${submission.email || ''} • ${submission.projectType || submission.project_type || 'Prosjekt'}`}
                  />
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ReplyIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenInquiry(submissionEmail);
                      }}
                    >
                      Svar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleCreateProject(submission);
                      }}
                      sx={{ bgcolor: brandColor }}
                    >
                      Opprett Prosjekt
                    </Button>
                  </Stack>
                </ListItem>
                );
              })}
            </List>
          )}
        </TabPanel>

        <TabPanel value={selectedTab} index={3}>
          <List dense>
            {(Array.isArray(emailContacts) ? emailContacts : []).map((contact: any) => (
              <ListItem key={contact.id || contact.email} sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <ListItemIcon><PersonAddIcon /></ListItemIcon>
                <ListItemText primary={contact.name || contact.email} secondary={contact.email} />
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={selectedTab} index={4}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>E-post Statistikk</Typography>
                  <Stack spacing={1}>
                    <Typography>Totale e-poster: {emailStats?.total || 0}</Typography>
                    <Typography>Uleste: {emailStats?.unread || 0}</Typography>
                    <Typography>Denne uken: {emailStats?.thisWeek || 0}</Typography>
                    <Typography>Kontakter: {(Array.isArray(emailContacts) ? emailContacts.length : 0)}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={theming.getThemedCardSx()}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                    Forespørsel Statistikk
                  </Typography>
                  <Stack spacing={1}>
                    <Typography>Totale forespørsler: {submissions.length}</Typography>
                    <Typography>
                      Denne måneden: {submissions.filter((submission: any) => new Date(submission.createdAt || submission.created_at || 0) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Box>

      <Dialog open={meetingDialogOpen} onClose={() => setMeetingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Planlegg oppfølgingsmøte</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Dato"
              type="date"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Tidspunkt"
              type="time"
              value={meetingTime}
              onChange={(event) => setMeetingTime(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Notater"
              value={meetingNotes}
              onChange={(event) => setMeetingNotes(event.target.value)}
              multiline
              rows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMeetingDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" startIcon={<SendIcon />} onClick={handleScheduleMeeting}>
            Opprett møte
          </Button>
        </DialogActions>
      </Dialog>

      {/* Smart Email Composer for Replies */}
      <SmartEmailComposer
        open={replyOpen}
        onClose={() => {
          setReplyOpen(false);
          setSelectedEmail(null);
      }}
        profession={profession || 'photographer'}
        userId={userId}
        replyToEmail={selectedEmail}
        initialTo={selectedEmail?.from?.email}
        initialSubject={selectedEmail?.subject?.startsWith('Re:') ? selectedEmail?.subject || '' : `Re: ${selectedEmail?.subject || ''}`}
      />
    </Box>
  );
}
