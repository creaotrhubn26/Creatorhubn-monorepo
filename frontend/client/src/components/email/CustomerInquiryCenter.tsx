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
  Divider
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
  PersonAdd as PersonAddIcon
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
}

interface EmailMessage {
  id: string;
  subject: string;
  from: { name: string; email: string };
  timestamp: string;
  isRead: boolean;
  isStarred: boolean;
  category: 'inquiry' | 'project' | 'general';
  priority: 'low' | 'normal' | 'high';
  isCustomerInquiry?: boolean
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
  const professionConfig = getProfessionConfig(userProfession || ',');

  const [selectedTab, setSelectedTab] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'replied' | 'starred'>('new');
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);

  const queryClient = useQueryClient();

  // Fetch comprehensive data for customer inquiries and submissions
  const { data: emails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ['/api/emails/recent', userId],
    queryFn: () => apiRequest(`/api/emails/recent?userId=${userId}`),
    refetchInterval: 30000 });

  const { data: emailStats } = useQuery({
    queryKey: ['/api/emails/stats', userId],
    queryFn: () => apiRequest(`/api/emails/stats?userId=${userId}`),
    refetchInterval: 60000 });

  const { data: emailContacts = [, ],} = useQuery({
    queryKey: ['/api/emails/contacts', userId],
    queryFn: () => apiRequest(`/api/emails/contacts?userId=${userId}`)
});

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['/api/submissions', userProfession],
    queryFn: () => apiRequest(`/api/submissions?profession=${userProfession}`),
    enabled: !!userProfession && !professionsLoading
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
    };
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
    
    // Would trigger API call to update email star status
    apiRequest('/api/emails/star', {
      method: 'PATCH',
      body: JSON.stringify({ emailId, starred: !emailsArray.find((e: any) => e.id === emailId)?.isStarred })
  }).catch(err => console.log('Star toggle pending'));
    
    console.log('Toggling star for email:', emailId);
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
        </Stack>
        
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
        {/* Tab 0: New Inquiries , *, /}
        {selectedTab === 0 && (
          <Box sx={{ maxHeight: 40, overflow: 'auto'}}>
            {emailsLoading ? (
              <Box>
                <LinearProgress sx={{ mb:  2 }} />
                <Typography>Laster inn forespørsler...</Typography>
              </Box>
            ) : filteredInquiries.length > 0 ? (
          <List dense>
            {filteredInquiries.map((email: EmailMessage) => (
              <ListItem
                key={email.d}
                sx={{
                  mb:  1,
                  border: `1px solid ${email.isRead ? '#e0e0e0' : customBranding?.color || '#ff8c00' + '4'}`,
                  borderRadius:  2,
                  backgroundColor: email.isRead ? '#f9f9f9' : customBranding?.color || '#ff8c00' + '0','&:hover': { backgroundColor: customBranding?.color || '#ff8c00' + '10',}
              }}
              >
                <ListItemIcon>
                  <Avatar sx={{ 
                    bgcolor: email.isRead ? '#ccc', : customBranding?.color || '#ff8c00',
                    width:  32,
                    height: 32 }}>
                    <ProfessionIcon sx={{ fontSize: '1rem'}} />
                  </Avatar>
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: mail.isRead ? 400 : 60,
                          flex: 1 }}
                      >
                        {email.subject}
                      </Typography>
                      {email.priority === 'high' && (
                        <PriorityIcon sx={{ color: '#f44330', fontSize: '1rem'}} />
                      )}
                      <IconButton 
                        size="small"
                        onClick={() => handleToggleStar(email.id)}
                        sx={{ color: email.isStarred ? '#ffb400' : '#ccc', '}}
                      >
                        {email.isStarred ? <StarIcon /> : <StarBorderIcon />}
                      </IconButton>
                    </Box>
                }
                  secondary={
                    <Stack direction="row" spacing={2} sx={{ mt: 0.5}}>
                      <Typography variant="caption" color="text.secondary">
                        {email.from.name} • {email.timestamp}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ReplyIcon />}
                          onClick={() => handleReply(email)}
                          sx={{ 
                            fontSize: '0.7rem',
                            py: 0.5,
                            px:  1,
                            borderColor: customBranding?.color || '#ff8c00',
                            color: customBranding?.color || '#ff8c00','&:hover': { 
                              backgroundColor: customBranding?.color || '#ff8c00' + '1',
                              borderColor: customBranding?.color || '#ff8c00'
                        }
                        }}
                        >
                          Svar
                        </Button>
                        <Button size="small"
                          variant="contained"
                          startIcon={<AddIcon />}
                          onClick={() => handleCreateProject(email)}
                          sx={{ 
                            fontSize: '0.7rem',
                            py: 0.5,
                            px:  1,
                            bgcolor: customBranding?.color || '#ff8c00','&:hover': { bgcolor: customBranding?.color || '#ff8c00' + 'dd',}
                        }}
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
          <Card sx={{ textAlign: 'center', py:  3, backgroundColor: '#f5f5f5',  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <ProfessionIcon sx={{ fontSize:  48, color: '#ccc', mb:  2 }} />
              <Typography variant="body1" color="text.secondary">
                {filterStatus === 'new' ? 'Ingen nye kundeforespørsler' : 'Ingen forespørsler funnet'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt:  1 }}>
                {filterStatus === 'new' 
                  ? 'Nye forespørsler vil vises her når de ankommer'
                  : 'Prøv å justere filteret for å se flere forespørsler'
              }
              </Typography>
            </CardContent>
          </Card>
        )}
          </Box>
        )}
        
        {/* Tab 1: All Emails , *, /}
        {selectedTab === 1 && (
          <Box sx={{ maxHeight: 40, overflow: 'auto'}}>
            <List dense>
              {(Array.isArray(emails) ? emails : []).map((email: any) => (
                <ListItem key={email.d} sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius:  1 }}>
                  <ListItemIcon>
                    <EmailIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={email.subject}
                    secondary={`${email.from?.name || 'Ukjent'} • ${email.timestamp}`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        
        {/* Tab 2: Booking/Orders , *, /}
        {selectedTab === 2 && (
          <Box sx={{ maxHeight: 40, overflow: 'auto'}}>
            {submissionsLoading ? (
              <Box>
                <LinearProgress sx={{ mb:  2 }} />
                <Typography>
                  Laster inn {profession === 'photographer' ? 'bookinger' :
                             profession === 'videographer' ? 'bestillinger' :
                             profession === 'music_producer' ? 'forespørsler' :
                             'forespørsler'}...
                </Typography>
              </Box>
            ) : (
              <List dense>
                {submissions.map((submission: any) => (
                  <ListItem 
                    key={submission.d}
                    sx={{ 
                      mb: 1, border: `1px solid ${customBranding?.color || '#ff8c00' + '4'}`, 
                      borderRadius:  2,
                      backgroundColor: customBranding?.color || '#ff8c00' + '0','&:hover': { backgroundColor: customBranding?.color || '#ff8c00' + '10',}
                  }}
                  >
                    <ListItemIcon>
                      <Avatar sx={{ 
                        bgcolor: customBranding?.color || '#ff8c00',
                        width:  32,
                        height: 32 }}>
                        <ProfessionIcon sx={{ fontSize: '1rem'}} />
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 60
                             , flex: 1 }}
                          >
                            {submission.name || submission.title}
                          </Typography>
                          <IconButton 
                            size="small"
                            onClick={() => handleToggleStar(submission.id)}
                            sx={{ color: submission.isStarred ? '#ffb400' : '#ccc', '}}
                          >
                            {submission.isStarred ? <StarIcon /> : <StarBorderIcon />}
                          </IconButton>
                        </Box>
                    }
                      secondary={
                        <Stack direction="row" spacing={2} sx={{ mt: 0.5}}>
                          <Typography variant="caption" color="text.secondary">
                            {submission.email} • {submission.projectType} • {submission.eventDate}
                          </Typography>
                          <Stack direction="row" spacing={0.5}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ReplyIcon />}
                              onClick={() => {
                                setSelectedEmail({
                                  ...submission,
                                  from: { name: submission.name, email: submission.email },
                                  subject: `Re: ${profession === 'photographer' ? 'Booking forespørsel' : 
                                           profession === 'videographer' ? 'Video bestilling' : 
                                           'Forespørsel'} - ${submission.projectType}`
                              });
                                setReplyOpen(true);
                            }}
                              sx={{ 
                                fontSize: '0.7rem',
                                py: 0.5,
                                px:  1,
                                borderColor: customBranding?.color || '#ff8c00',
                                color: customBranding?.color || '#ff8c00', '&:hover': { 
                                  backgroundColor: customBranding?.color || '#ff8c00' + '1',
                                  borderColor: customBranding?.color || '#ff8c00'
                            }
                            }}
                            >
                              Svar
                            </Button>
                            <Button size="small"
                              variant="contained"
                              startIcon={<AddIcon />}
                              onClick={() => handleCreateProject(submission)}
                              sx={{ 
                                fontSize: '0.7rem',
                                py: 0.5,
                                px:  1,
                                bgcolor: customBranding?.color || '#ff8c00', '&:hover': { bgcolor: customBranding?.color || '#ff8c00' + 'dd',}
                            }}
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
            )}
          </Box>
        )}
        
        {/* Tab 3: Contacts , *, /}
        {selectedTab === 3 && (
          <Box sx={{ maxHeight: 40, overflow: 'auto'}}>
            <List dense>
              {emailContacts.map((contact: any) => (
                <ListItem key={contact.d} sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius:  1 }}>
                  <ListItemIcon>
                    <PersonAddIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={contact.name}
                    secondary={contact.email}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        
        {/* Tab 4: Statistics */}
        {selectedTab === 4 && (
          <Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  2 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>E-post Statistikk</Typography>
                    {emailStats && (
                      <Stack spacing={1}>
                        <Typography>Totale e-poster: {emailStats.total || 0}</Typography>
                        <Typography>Uleste: {emailStats.unread || 0}</Typography>
                        <Typography>Denne uken: {emailStats.thisWeek || 0}</Typography>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                <Card sx={theming.getThemedCardSx()}>
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {profession === 'photographer' ? 'Booking Statistikk' :
                       profession === 'videographer' ? 'Video Bestilling Statistikk' :
                       profession === 'music_producer' ? 'Musikk Forespørsel Statistikk' :
                       'Forespørsel Statistikk'}
                    </Typography>
                    <Stack spacing={1}>
                      <Typography>
                        Totale {profession === 'photographer' ? 'bookinger' :
                                profession === 'videographer' ? 'bestillinger' :
                                profession === 'music_producer' ? 'forespørsler' : 'forespørsler'}: {submissions.length}
                      </Typography>
                      <Typography>
                        Denne måneden: {submissions.filter((s: any) => new Date(s.createdAt) > new Date(Date.now() - 30*24*60*60*1000)).length}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

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
        initialSubject={selectedEmail?.subject?.startsWith('Re:') ? selectedEmail?.subject ||',' : `Re: ${selectedEmail?.subject ||''}`}
      />
    </Box>
  );
}