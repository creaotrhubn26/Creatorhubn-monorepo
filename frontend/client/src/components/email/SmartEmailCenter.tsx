import React, { useState, useEffect, useMemo } from 'react';
// Import dynamic profession system
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemAvatar,
  Badge,
  IconButton,
  Chip,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Divider,
  Stack,
  Card,
  CardContent,
  Fab,
  Menu,
  MenuItem,
  Switch,
  FormControlLabel,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  Email as EmailIcon,
  Inbox as InboxIcon,
  Drafts as DraftsIcon,
  Send as SendIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Search as SearchIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Attachment as AttachmentIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  MoreVert as MoreVertIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  Palette as PaletteIcon,
  Image as ImageIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  AutoAwesome as AutoAwesomeIcon,
  TrendingUp as TimelineIcon,
  Camera as CameraIcon,
  Event as EventIcon,
  Folder as FolderIcon,
  TrendingUp as TrendingUpIcon,
  Circle as CircleIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Group as GroupIcon,
  Warning as WarningIcon,
  Notifications,
  NotificationsActive,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

interface SmartEmailCenterProps {
  profession: string;
  userId: string;
  // Integration props for universal connectivity
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void
}

interface EmailMessage {
  id: string;
  messageId: string;
  threadId?: string;
  from: {
    name: string;
    email: string;
    avatar?: string;
};
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  htmlBody?: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labels: string[];
  projectId?: string;
  projectType?: string;
  category: 'client' | 'vendor' | 'system' | 'marketing' | 'personal' | 'inquiry';
  priority: 'high' | 'medium' | 'low';
  clientName?: string;
  projectTitle?: string;
  conversationCount?: number
}

interface EmailActivity {
  totalEmails: number;
  unreadCount: number;
  todayEmails: number;
  weekEmails: number;
  responseRate: number;
  averageResponseTime: string;
  topClients: Array<{
    name: string;
    email: string;
    emailCount: number;
    lastContact: string;
}>;
  recentActivity: Array<{
    type: 'sent' | 'received' | 'draft' | 'scheduled';
    subject: string;
    contact: string;
    time: string;
    projectId?: string;
}>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`smart-email-tabpanel-${index}`}
      aria-labelledby={`smart-email-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p:  2 }}>{children}</Box>}
    </div>
);
}

const SmartEmailCenter: React.FC<SmartEmailCenterProps> = ({ 
  profession, 
  userId, 
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect
}) => {
  // Dynamic profession system hooks  
  const { user } = useAuth();
  const { 
    professions, 
    loading: professionsLoading, 
    error: professionsError,
    getProfessionConfig 
} = useDynamicProfessions();
  
  const userProfession = profession;
  const professionConfig = getProfessionConfig(userProfession || ',');

  // Enhanced Master Integration
  const { integration, communication, dataFlow, componentRegistry, analytics, features } = useEnhancedMasterIntegration();
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(userProfession);

  // Comprehensive Feature System for Smart Email Center
  const emailCenterAccess = features.checkFeatureAccess('smart-email-center,');
  const emailManagementAccess = features.checkFeatureAccess('email-management');
  const emailCompositionAccess = features.checkFeatureAccess('email-composition');
  const emailTemplatesAccess = features.checkFeatureAccess('email-templates');
  const emailAnalyticsAccess = features.checkFeatureAccess('email-analytics');
  const emailIntegrationAccess = features.checkFeatureAccess('email-integration');
  const emailAutomationAccess = features.checkFeatureAccess('email-automation');
  const emailSchedulingAccess = features.checkFeatureAccess('email-scheduling');

  // Track feature usage
  useEffect(() => {
    features.trackFeatureUsage('smart-email-center', 'opened', {
      timestamp: Date.now(),
      component: 'SmartEmailCenter',
      profession: profession,
      userId: userId
});
}, [features, profession, userId]);

  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [emailFilter, setEmailFilter] = useState<'all' | 'unread' | 'starred' | 'project'>('all');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [overageDialogOpen, setOverageDialogOpen] = useState(false);
  const [selectedShowcaseData, setSelectedShowcaseData] = useState<any>(null);
  const [shareShowcaseDialogOpen, setShareShowcaseDialogOpen] = useState(false);
  const [availableShowcases, setAvailableShowcases] = useState<any[]>([]);
  const [prefilledClient, setPrefilledClient] = useState<{ email: string; name: string } | undefined>(undefined);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Fetch email messages with intelligent categorization using profession-aware queries
  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/emails/smart', userProfession, userId, filterCategory, emailFilter],
    queryFn: async () => {
      const response = await apiRequest(`/api/emails/smart?profession=${userProfession}&userId=${userId}&category=${filterCategory}&filter=${emailFilter}&search=${encodeURIComponent(searchQuery)}`);
      return response || [];
},
    refetchInterval: 3000, // Refresh every 30 seconds
    enabled: !!userProfession && !professionsLoading
});

  // Filter emails based on current settings
  const filteredEmails = useMemo(() => {
    if (!emails) return [];
    
    return emails.filter((email: EmailMessage) => {
      const matchesCategory = filterCategory === 'all' || email.category === filterCategory;
      const matchesFilter = emailFilter === 'all' || 
        (emailFilter === 'unread' && !email.isRead) ||
        (emailFilter === 'starred' && email.isStarred) ||
        (emailFilter === 'project' && email.projectTitle);
      const matchesSearch = !searchQuery || 
        email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.from.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesCategory && matchesFilter && matchesSearch;
});
}, [emails, filterCategory, emailFilter, searchQuery]);

  // Fetch email activity analytics with profession context
  const { data: emailActivity } = useQuery({
    queryKey: ['/api/emails/activity', userProfession, userId],
    queryFn: async () => {
      const response = await apiRequest(`/api/emails/activity?profession=${userProfession}&userId=${userId}`);
      return response || {
        totalEmails:  0,
        unreadCount:  0,
        todayEmails:  0,
        weekEmails:  0,
        responseRate:  0,
        averageResponseTime: '0',
        topClients:  [],
        recentActivity: []
};
},
    refetchInterval: 6000, // Refresh every minute
    enabled: !!userProfession && !professionsLoading
}) as { data: EmailActivity | undefined };

  // Fetch project context for email linking with profession-aware data
  const { data: projects = [, ],} = useQuery({
    queryKey: ['/api/dashboard', userProfession, userId],
    queryFn: async () => {
      const response = await apiRequest(`/api/dashboard/${userProfession}/${userId}`);
      return response?.projects || [];
},
    enabled: !!userProfession && !professionsLoading
});

  // Fetch available showcases for sharing
  const { data: showcases = [], refetch: refetchShowcases } = useQuery({
    queryKey: ['/api/showcases', userProfession, userId],
    queryFn: async () => {
      const response = await apiRequest(`/api/showcases?profession=${userProfession}&userId=${userId}`);
      return response || [];
},
    enabled: !!userProfession && !professionsLoading
});

  // Loading state for profession data
  if (professionsLoading) {
    return (
      <Box sx={{ p:  3, textAlign: 'center'}}>
        <Typography>Laster e-postsystem for {professionConfig?.displayName || 'din profesjon'}...</Typography>
      </Box>
  );
}

  // Smart compose mutation with project linking
  const composeMutation = useMutation({
    mutationFn: async (emailData: any) => {
      return apiRequest('/api/emails/smart/send', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({
          ...emailData,
          profession,
          userId,
          timestamp: new Date().toISOString()
  })
  });
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails', ],});
      setComposeOpen(false);
      refetch();
}
});

  // Overage email generation mutation
  const overageEmailMutation = useMutation({
    mutationFn: async (overageData: {
      showcaseId: string;
      clientEmail: string;
      clientName: string;
      projectName: string;
      totalImages: number;
      contractLimit: number;
      pricePerImage: number;
}) => {
      return apiRequest('/api/showcase/send-overage-email', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(overageData)
});
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails', ],});
}
});

  // Share showcase email mutation
  const shareShowcaseMutation = useMutation({
    mutationFn: async (shareData: {
      showcaseId: string;
      clientEmail: string;
      clientName: string;
      message?: string;
      photographerName: string;
      photographerCompany: string;
}) => {
      return apiRequest('/api/showcase/email', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify(shareData)
});
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails', ],});
      refetchShowcases();
}
});

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (emailIds: string[]) => {
      return apiRequest('/api/emails/mark-read', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ emailI, dsuserId })
  });
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails', ],});
      refetch();
}
});

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'I dag';
    if (diffDays === 2) return 'I går';
    if (diffDays <= 7) return `${diffDays} dager siden`;
    
    return date.toLocaleDateString('no-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
});
};

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'client': return '#2196f3';
      case 'vendor': return '#4caf50';
      case 'system': return '#ff9800';
      case 'marketing': return '#9c27b0';
      case 'personal': return '#607d8b';
      case 'overage': return '#ff6f00';
      default: return '#757575';
}
};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'client': return <PersonIcon />;
      case 'vendor': return <BusinessIcon />;
      case 'system': return <SettingsIcon />;
      case 'marketing': return <TrendingUpIcon />;
      case 'personal': return <EmailIcon />;
      case 'overage': return <WarningIcon />;
      default: return <EmailIcon />;
}
};

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
}
};


  // Showcase sharing component
  const ShowcaseSharingDialog = ({ 
    open, 
    onClose,
    prefilledClient 
}: {
    open: boolean;
    onClose: () => void;
    prefilledClient?: { email: string; name: string };
}) => {
    const [shareForm, setShareForm] = useState({
      selectedShowcase: '',
      clientEmail: prefilledClient?.email ||'',
      clientName: prefilledClient?.name ||'',
      message: prefilledClient ? `Hei ${prefilledClient.name}! Takk for din interesse. Her er ditt fotogalleri som du kan se og laste ned.` : '',
      photographerName: user?.name || professionConfig?.displayName ||'',
      photographerCompany: professionConfig?.displayName || ''
});

    const handleShareShowcase = async () => {
      try {
        const showcase = showcases.find((s: any) => s.id === shareForm.selectedShowcase);
        if (!showcase) return;

        await shareShowcaseMutation.mutateAsync({
          showcaseId: shareForm.selectedShowcase,
          clientEmail: shareForm.clientEmail,
          clientName: shareForm.clientName,
          message: shareForm.message,
          photographerName: shareForm.photographerName,
          photographerCompany: shareForm.photographerCompany,
    });
        
        onClose();
        setShareForm({
          selectedShowcase: '',
          clientEmail: '',
          clientName: '',
          message: '',
          photographerName: user?.name || professionConfig?.displayName ||'',
          photographerCompany: professionConfig?.displayName || ', '
  });
  } catch (error) {
        console.error('Error sharing showcase: ', error);
  }
};

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <ImageIcon color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Share Showcase with Client</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt:  2 }}>
            {/* Showcase Selection */}
            <Box sx={{ mb:  3 }}>
              <FormControl fullWidth>
                <InputLabel>Select Showcase</InputLabel>
                <Select
                  value={shareForm.selectedShowcase}
                  label="Select Showcase"
                  onChange={(e) => setShareForm(prev => ({ ...prev, selectedShowcase: e.target.value }))}
                >
                  {showcases.map((showcase: any) => (
                    <MenuItem key={showcase.d} value={showcase.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                        <Avatar sx={{ bgcolor: '#ff8c00', width:  32, height: 32}}>
                          <CameraIcon fontSize="small" />
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2">{showcase.title || `Showcase ${showcase.id.slice(-8)}`}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {showcase.photos?.length || 0} photos • {formatDate(showcase.createdAt)}
                          </Typography>
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Client Information */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                <TextField
                  fullWidth
                  label="Client Email"
                  type="email"
                  value={shareForm.clientEmail}
                  onChange={(e) => setShareForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                <TextField
                  fullWidth
                  label="Client Name"
                  value={shareForm.clientName}
                  onChange={(e) => setShareForm(prev => ({ ...prev, clientName: e.target.value }))}
                  required
                />
              </Box>
            </Box>

            {/* Photographer Information */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                <TextField
                  fullWidth
                  label="Photographer Name"
                  value={shareForm.photographerName}
                  onChange={(e) => setShareForm(prev => ({ ...prev, photographerName: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                <TextField
                  fullWidth
                  label="Company Name"
                  value={shareForm.photographerCompany}
                  onChange={(e) => setShareForm(prev => ({ ...prev, photographerCompany: e.target.value }))}
                  required
                />
              </Box>
            </Box>

            {/* Custom Message */}
            <TextField
              fullWidth
              label="Custom Message (Optional)"
              multiline
              rows={3}
              value={shareForm.message}
              onChange={(e) => setShareForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Add a personal message to include with the showcase..."
              sx={{ mb:  2 }}
            />

            {/* Preview */}
            {shareForm.selectedShowcase && (
              <Paper sx={{ p: 2, bgcolor: '#f5f5f5',  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview: </Typography>
                <Typography variant="body2" color="text.secondary">
                  {shareForm.message || 'Your showcase is ready! Click the link below to view your photos.'}
                </Typography>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleShareShowcase}
            variant="contained"
            color="primary"
            disabled={shareShowcaseMutation.isPending || !shareForm.selectedShowcase || !shareForm.clientEmail || !shareForm.clientName}
            sx={{ 
              bgcolor: '#ff8c00', 
              '&:hover': { bgcolor: '#e67c00' },
              ...theming.getThemedButtonSx()
            }}>
            {shareShowcaseMutation.isPending ? 'Sending...' : 'Share Showcase'}
          </Button>
        </DialogActions>
      </Dialog>
  );
};

  // Overage management component
  const OverageManagementDialog = ({ 
    open, 
    onClose, 
    showcaseData 
}: {
    open: boolean;
    onClose: () => void;
    showcaseData?: any;
}) => {
    const [overageForm, setOverageForm] = useState({
      clientEmail: ', ',
      clientName: ', ',
      projectName: ', ',
      totalImages:  0,
      contractLimit:  50,
      pricePerImage: 30,
      customMessage: ', '
});

    useEffect(() => {
      if (showcaseData) {
        setOverageForm(prev => ({
          ...prev,
          clientEmail: showcaseData.clientEmail ||', ',
          clientName: showcaseData.clientName ||', ',
          projectName: showcaseData.projectName ||', ',
          totalImages: showcaseData.totalImages || 0,
          contractLimit: showcaseData.contractLimit || 50,
          pricePerImage: showcaseData.pricePerImage || 300 }));
  }
}, [showcaseData]);

    const handleSendOverageEmail = async () => {
      try {
        await overageEmailMutation.mutateAsync({
          showcaseId: showcaseData?.showcaseId || 'temp',
          clientEmail: overageForm.clientEmail,
          clientName: overageForm.clientName,
          projectName: overageForm.projectName,
          totalImages: overageForm.totalImages,
          contractLimit: overageForm.contractLimit,
          pricePerImage: overageForm.pricePerImage,
    });
        onClose();
  } catch (error) {
        console.error('Error sending overage email:', error);
  }
};

    const overageImages = Math.max(0, overageForm.totalImages - overageForm.contractLimit);
    const totalOverageCost = overageImages * overageForm.pricePerImage;

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Send Overage Notification</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt:  2 }}>
            {/* Contract Summary */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: '#', border: '1px solid #ff6f00',  ...theming.getThemedCardSx() }}>
              <Typography variant="h6" color="#ff6f00" gutterBottom sx={{ color: theming.colors.primary }}>
                📊 Contract Summary
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  2 }}>
                <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                  <Typography variant="body2" color="text.secondary">
                    Total Images Delivered: </Typography>
                  <Typography variant="h6" color="#ff6f00" sx={{ color: theming.colors.primary }}>
                    {overageForm.totalImages}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                  <Typography variant="body2" color="text.secondary">
                    Contract Limit: </Typography>
                  <Typography variant="h6" color="text.primary" sx={{ color: theming.colors.primary }}>
                    {overageForm.contractLimit}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200 }}>
                  <Typography variant="body2" color="text.secondary">
                    Overage Images:
                  </Typography>
                  <Typography variant="h6" sx={{ color: overageImages > 0 ? "#e65100" : "#4caf50" }}>
                    {overageImages}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                  <Typography variant="body2" color="text.secondary">
                    Total Overage Cost: </Typography>
                  <Typography variant="h6" color="#e65100" sx={{ color: theming.colors.primary }}>
                    NOK {totalOverageCost}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {/* Form Fields */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  2 }}>
              <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                <TextField
                  fullWidth
                  label="Client Email"
                  type="email"
                  value={overageForm.clientEmail}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                <TextField
                  fullWidth
                  label="Client Name"
                  value={overageForm.clientName}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, clientName: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 100, %', minWidth: '100%'}}>
                <TextField
                  fullWidth
                  label="Project Name"
                  value={overageForm.projectName}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, projectName: e.target.value }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                <TextField
                  fullWidth
                  label="Total Images"
                  type="number"
                  value={overageForm.totalImages}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, totalImages: parseInt(e.target.value) || 0 }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                <TextField
                  fullWidth
                  label="Contract Limit"
                  type="number"
                  value={overageForm.contractLimit}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, contractLimit: parseInt(e.target.value) || 0 }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                <TextField
                  fullWidth
                  label="Price per Image (NOK)"
                  type="number"
                  value={overageForm.pricePerImage}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, pricePerImage: parseInt(e.target.value) || 300 }))}
                  required
                />
              </Box>
              <Box sx={{ flex: '1 1 100%', minWidth: '100%' }}>
                <TextField
                  fullWidth
                  label="Custom Message (Optional)"
                  multiline
                  rows={3}
                  value={overageForm.customMessage}
                  onChange={(e) => setOverageForm(prev => ({ ...prev, customMessage: e.target.value }))}
                  placeholder="Add any custom message to include in the email..."
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={handleSendOverageEmail}
            variant="contained"
            color="warning"
            disabled={overageEmailMutation.isPending || !overageForm.clientEmail || !overageForm.clientName}
           sx={theming.getThemedButtonSx()}>
            {overageEmailMutation.isPending ? 'Sending...' : 'Send Overage Email'}
          </Button>
        </DialogActions>
      </Dialog>
  );
};

  return (
    <Box sx={{ height: 'calc(100vh - 120px, )', display: 'flex', flexDirection: 'column'}}>
      {/* Smart Email Header */}
      <Paper sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap'}}>
          <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: '#ff8c00'}}>
                <AutoAwesomeIcon />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{  fontWeight: 600}}>
                  {professionConfig?.displayName} E-post Senter
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Intelligent e-post administrasjon for {professionConfig?.displayName?.toLowerCase() || 'profesjonelle'}
                </Typography>
                {professionsLoading && <Typography variant="caption">Laster profesjonsdata...</Typography>}
                
                {/* Feature Analytics Display */}
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1, mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
                  </Typography>
                  <Chip 
                    label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '10px', height: 18}}
                  />
                </Box>
              </Box>
            </Stack>
          </Box>
          
          <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {isSupported && (
                <Tooltip title="Push-varsler innstillinger">
                  <IconButton onClick={() => setPushSettingsOpen(true)} color={pushEnabled ? 'primary' : 'default'}>
                    {pushEnabled ? <NotificationsActive /> : <Notifications />}
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Vis aktivitetsanalyse">
                <IconButton onClick={() => setShowAnalytics(!showAnalytics)}>
                  <TrendingUpIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Oppdater e-poster">
                <IconButton onClick={() => refetch()}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Share showcase with client">
                <Button
                  variant="outlined"
                  startIcon={<ImageIcon />}
                  onClick={() => {
                    setPrefilledClient(undefined);
                    setShareShowcaseDialogOpen(true);
              }}
                  sx={{ 
                    borderColor: '#', 
                    color: '#','&:hover': { 
                      borderColor: '#', 
                      bgcolor: '#e3f2fd' 
              } 
              }}
                >
                  Share Showcase
                </Button>
              </Tooltip>
              <Tooltip title="Send overage notification">
                <Button
                  variant="outlined"
                  startIcon={<WarningIcon />}
                  onClick={() => {
                    setSelectedShowcaseData(null);
                    setOverageDialogOpen(true);
              }}
                  sx={{ 
                    borderColor: '#ff6f00', 
                    color: '#ff6f00','&:hover': { 
                      borderColor: '#', 
                      bgcolor: '#fff3e0' 
              } 
              }}
                >
                  Overage Email
                </Button>
              </Tooltip>
              <Button variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setComposeOpen(true)}
                sx={{ bgcolor: '#ff8c00','&:hover': { bgcolor: '#e67c00',} }}
              >
                Ny E-post
              </Button>
            </Stack>
          </Box>
        </Box>

        {/* Quick Stats */}
        {emailActivity && (
          <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap'}}>
            <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p: 1.5,  ...theming.getThemedCardSx() }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Badge badgeContent={emailActivity.unreadCount} color="error">
                      <InboxIcon color="primary" />
                    </Badge>
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{emailActivity.totalEmails}</Typography>
                      <Typography variant="caption">Totale E-poster</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p: 1.5,  ...theming.getThemedCardSx() }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ScheduleIcon color="success" />
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{emailActivity.todayEmails}</Typography>
                      <Typography variant="caption">I dag</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p: 1.5,  ...theming.getThemedCardSx() }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ReplyIcon color="info" />
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{emailActivity.responseRate}%</Typography>
                      <Typography variant="caption">Svarrate</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p: 1.5,  ...theming.getThemedCardSx() }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TimelineIcon color="secondary" />
                    <Box>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>{emailActivity.averageResponseTime}</Typography>
                      <Typography variant="caption">Gj.sn. Responstid</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Email Tabs */}
      <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
          <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
            <Tab icon={<InboxIcon />} label="Innboks" />
            <Tab icon={<PersonIcon />} label="Kundeforespørsler" />
            <Tab icon={<TrendingUpIcon />} label="Aktivitet" />
            <Tab icon={<FolderIcon />} label="Prosjekt E-poster" />
            <Tab icon={<StarIcon />} label="Viktige" />
            <Tab icon={<DraftsIcon />} label="Utkast" />
            <Tab icon={<SettingsIcon />} label="Innstillinger" />
          </Tabs>
        </Box>

        {/* Search and Filter Controls */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap'}}>
            <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
              <TextField
                fullWidth
                size="small"
                placeholder="Søk i e-poster..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  )}}
              />
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
              <FormControl size="small" fullWidth>
                <InputLabel>Kategori</InputLabel>
                <Select
                  value={filterCategory}
                  label="Kategori"
                  onChange={(e: any) => setFilterCategory(e.target.value)}
                >
                  <MenuItem value="all">Alle</MenuItem>
                  <MenuItem value="inquiry">Nye Forespørsler</MenuItem>
                  <MenuItem value="client">Eksisterende Kunder</MenuItem>
                  <MenuItem value="vendor">Leverandører</MenuItem>
                  <MenuItem value="system">System</MenuItem>
                  <MenuItem value="marketing">Markedsføring</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
              <ToggleButtonGroup
                size="small"
                value={emailFilter}
                exclusive
                onChange={(e: React.MouseEvent<HTMLElement>, newFilter: string) => newFilter && setEmailFilter(newFilter as any)}
              >
                <ToggleButton value="all">Alle</ToggleButton>
                <ToggleButton value="unread">Ulest</ToggleButton>
                <ToggleButton value="starred">Stjernet</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </Box>

        {/* Tab Content */}
        <Box sx={{ flexGrow: 1, overflow: 'hidden'}}>
          {/* Inbox Tab */}
          <TabPanel value={selectedTab} index={0}>
            <Box sx={{ height: '100%', overflow: 'auto'}}>
              {isLoading ? (
                <Box sx={{ p:  3 }}>
                  <LinearProgress />
                  <Typography variant="body2" sx={{ mt:  2 }}>
                    Laster intelligente e-poster...
                  </Typography>
                </Box>
              ) : (
                <List dense>
                  {filteredEmails.length === 0 ? (
                    <ListItem>
                      <ListItemText
                        primary="Ingen e-poster funnet"
                        secondary="Prøv å justere søkekriteriene dine"
                      />
                    </ListItem>
                  ) : (
                    filteredEmails.map((email: EmailMessage) => (
              <ListItem
                key={email.d}
                onClick={() => setSelectedEmail(email)}
                        sx={{
                          border:  1,
                          borderColor: 'divider',
                          borderRadius:  1,
                          mb:  1,
                          bgcolor: email.isRead ? 'background.paper' : 'action.hover','&:hover': { bgcolor: 'action.selected',}
                    }}
                      >
                        <ListItemAvatar>
                          <Badge
                            overlap="circular"
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right'}}
                            badgeContent={
                              <CircleIcon
                                sx={{
                                  color: getCategoryColor(email.category),
                                  fontSize: 12 }}
                              />
                        }
                          >
                            <Avatar
                              src={email.from.avatar}
                              sx={{ width:  40, height: 40}}
                            >
                              {email.from.name.charAt(0).toUpperCase()}
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>

                        <ListItemText
                          primary={
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  fontWeight: mail.isRead ? 400 : 60,
                                  flexGrow: 1 }}
                                noWrap
                              >
                                {email.from.name}
                              </Typography>
                              {email.priority === 'high' && (
                                <CircleIcon sx={{ color: '#', fontSize:  8 }} />
                              )}
                              {email.hasAttachments && (
                                <AttachmentIcon fontSize="small" color="action" />
                              )}
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(email.date)}
                              </Typography>
                            </Stack>
                      }
                          secondary={
                            <Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  fontWeight: mail.isRead ? 400 : 50,
                                  color: email.isRead ? 'text.secondary' : 'text.primary'
                          }}
                                noWrap
                              >
                                {email.subject}
                              </Typography>
                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5}}>
                                <Chip
                                  size="small"
                                  icon={getCategoryIcon(email.category)}
                                  label={email.category === 'client' ? 'Kunde' : 
                                         email.category === 'vendor' ? 'Leverandør' :
                                         email.category === 'system' ? 'System' :
                                         email.category === 'marketing' ? 'Markedsføring' : 'Personlig'}
                                  sx={{
                                    bgcolor: getCategoryColor(email.category),
                                    color: 'white',
                                    fontSize: '10px',
                                    height: 20 }}
                                />
                                {email.projectTitle && (
                                  <Chip
                                    size="small"
                                    icon={<CameraIcon />}
                                    label={email.projectTitle}
                                    variant="outlined"
                                    sx={{ fontSize: '10px', height: 20}}
                                  />
                                )}
                                {email.conversationCount && email.conversationCount > 1 && (
                                  <Chip
                                    size="small"
                                    label={`${email.conversationCount} meldinger`}
                                    variant="outlined"
                                    sx={{ fontSize: '10px', height: 20}}
                                  />
                                )}
                              </Stack>
                            </Box>
                      }
                        />

                        <ListItemIcon>
                          <Stack>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Toggle starred
                          }}
                            >
                              {email.isStarred ? (
                                <StarIcon color="warning" fontSize="small" />
                              ) : (
                                <StarBorderIcon fontSize="small" />
                              )}
                            </IconButton>
                            <IconButton size="small">
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </ListItemIcon>
                      </ListItem>
                    ))
                  )}
                </List>
              )}
            </Box>
          </TabPanel>

          {/* Customer Inquiries Tab */}
          <TabPanel value={selectedTab} index={1}>
            <Box sx={{ height: '100%', overflow: 'auto'}}>
              <Typography variant="h6" sx={{  mb: 2, color: '#ff6f00', fontWeight: 600}}>
                🎯 Kundeforespørsler - Smart Behandling
              </Typography>
              
              {/* Quick Stats for Inquiries */}
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap'}}>
                <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                  <Paper sx={{ 
                    p: 2, background: 'linear-gradient(135deg, #ff6f0015 0%, #ff8f0020 100%)',
                    border: '1px solid #ff6f0040' 
            ,  ...theming.getThemedCardSx() }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PersonIcon sx={{ color: '#ff6f00'}} />
                      <Box>
                        <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                          {emails.filter((e: EmailMessage) => e.category === 'inquiry' && !e.isRead).length}
                        </Typography>
                        <Typography variant="caption">Nye Forespørsler</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                  <Paper sx={{ 
                    p: 2, background: 'linear-gradient(135deg, #4caf5015 0%, #66bb6a20 100%)',
                    border: '1px solid #4caf5040' 
            ,  ...theming.getThemedCardSx() }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircleIcon sx={{ color: '#4caf50'}} />
                      <Box>
                        <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                          {emails.filter((e: EmailMessage) => e.category === 'inquiry' && e.isRead).length}
                        </Typography>
                        <Typography variant="caption">Behandlede</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                  <Paper sx={{ 
                    p: 2, background: 'linear-gradient(135deg, #2196f315 0%, #42a5f520 100%)',
                    border: '1px solid #2196f340' 
            ,  ...theming.getThemedCardSx() }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ScheduleIcon sx={{ color: '#2196f3'}} />
                      <Box>
                        <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                          {emails.filter((e: EmailMessage) => e.category === 'inquiry' && e.priority === 'high').length}
                        </Typography>
                        <Typography variant="caption">Høy Prioritet</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 1 200px', minWidth: 200}}>
                  <Paper sx={{ 
                    p: 2, background: 'linear-gradient(135deg, #9c27b015 0%, #ba68c820 100%)',
                    border: '1px solid #9c27b040' 
            ,  ...theming.getThemedCardSx() }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <TrendingUpIcon sx={{ color: '#9c27b0'}} />
                      <Box>
                        <Typography variant="h6" sx={{  color: theming.colors.primary }}>
                          {Math.round((emails.filter((e: EmailMessage) => e.category === 'inquiry' && e.isRead).length / Math.max(emails.filter((e: EmailMessage) => e.category === 'inquiry').length, 1)) * 100)}%
                        </Typography>
                        <Typography variant="caption">Behandlingsrate</Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>
              </Box>

              {/* Customer Inquiry List with Actions */}
              <Paper sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap:  1 }}>
                  <GroupIcon sx={{ color: '#ff6f00'}} />
                  Kundeforespørsler med Handlingsknapper
                </Typography>
                
                <List dense>
                  {emails.filter((email: EmailMessage) => 
                    email.category === 'inquiry' || 
                    email.category === 'client' ||
                    (email.subject && (
                      email.subject.toLowerCase().includes('fotogra') ||
                      email.subject.toLowerCase().includes('pris') ||
                      email.subject.toLowerCase().includes('tilbud') ||
                      email.subject.toLowerCase().includes('bryllup') ||
                      email.subject.toLowerCase().includes('portrett') ||
                      email.subject.toLowerCase().includes('session')
                    ))
                  ).map((email: EmailMessage) => (
                    <ListItem
                      key={email.d}
                      sx={{
                        border: '1px solid',
                        borderColor: email.isRead ? 'divider' : '#ff6f006',
                        borderRadius:  2,
                        mb:  2,
                        bgcolor: email.isRead ? 'background.paper' : '#fff3e01','&:hover': { bgcolor: 'action.selected',},
                        transition: 'all 0.2s'
                }}
                    >
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right'}}
                          badgeContent={
                            !email.isRead ? (
                              <CircleIcon sx={{ color: '#ff6f00', fontSize: 12}} />
                            ) : (
                              <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 12}} />
                            )
                      }
                        >
                          <Avatar
                            src={email.from.avatar}
                            sx={{ 
                              width:  50, 
                              height:  50,
                              border: !email.isRead ? '2px solid #ff6f00' : '2px solid #4caf50'
                      }}
                          >
                            {email.from.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>

                      <ListItemText
                        primary={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: mail.isRead ? 500 : 70,
                                color: email.isRead ? 'text.primary' : '#ff6f00',
                                flexGrow: 1 }}
                            >
                              {email.from.name}
                            </Typography>
                            {email.priority === 'high' && (
                              <Chip
                                size="small"
                                label="VIKTIG"
                                sx={{
                                  bgcolor: '#d32f2f',
                                  color: 'white',
                                  fontWeight: 600,
                                  fontSize: '10px',
                                  height: 20 }}
                              />
                            )}
                          </Stack>
                    }
                        secondary={
                          <Box sx={{ mt:  1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: mail.isRead ? 400 : 60,
                                color: email.isRead ? 'text.secondary' : 'text.primary',
                                mb: 1 }}
                            >
                              {email.subject}
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.5}}>
                              <Chip
                                size="small"
                                icon={<PersonIcon />}
                                label="Kundeforespørsel"
                                sx={{
                                  bgcolor: '#ff6f00',
                                  color: 'white',
                                  fontSize: '10px',
                                  height: 22 }}
                              />
                              <Chip
                                size="small"
                                label={formatDate(email.date)}
                                variant="outlined"
                                sx={{ fontSize: '10px', height: 22}}
                              />
                              {email.hasAttachments && (
                                <Chip
                                  size="small"
                                  icon={<AttachmentIcon />}
                                  label="Vedlegg"
                                  variant="outlined"
                                  sx={{ fontSize: '10px', height: 22}}
                                />
                              )}
                            </Stack>
                          </Box>
                    }
                      />

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, ml: 2 }}>
                        <Button size="small"
                          variant="contained"
                          startIcon={<ReplyIcon />}
                          sx={{
                            bgcolor: '#ff6f00',
                            color: 'white',
                            minWidth: 10,
                            fontSize: '11px','&:hover': { bgcolor: '#e65100',}
                      }}
                          onClick={() => {
                            setSelectedEmail(email);
                            setComposeOpen(true);
                      }}
                        >
                          Svar
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AddIcon />}
                          sx={{
                            color: '#4caf50',
                            borderColor: '#4caf50',
                            minWidth: 10,
                            fontSize: '11px','&:hover': { 
                              bgcolor: '#4caf501',
                              borderColor: '#4caf50' 
                      }
                      }}
                          onClick={() => {
                            // Create project from email inquiry
                            if (onProjectUpdate && onProjectSelect) {
                              const newProject = {
                                id: `project_${Date.now()}`,
                                title: `Prosjekt for ${email.from.name}`,
                                clientName: email.from.name,
                                clientEmail: email.from.email,
                                status: 'planning',
                                createdAt: new Date().toISOString(),
                                source: 'email_inquiry',
                                emailId: email.d,
                                priority: email.priority || 'medium'
                        };
                              
                              console.log('🎯 Creating project from email: ', newProject);
                              onProjectUpdate(newProject);
                              onProjectSelect(newProject);
                              
                              // Mark email as processed
                              markAsReadMutation.mutate([email.id]);
                        }
                      }}
                        >
                          Opprett Prosjekt
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EventIcon />}
                          sx={{
                            color: '#',
                            borderColor: '#',
                            minWidth: 10,
                            fontSize: '11px','&:hover': { 
                              bgcolor: '#2196f31',
                              borderColor: '#2196f3' 
                      }
                      }}
                          onClick={() => {
                            // Create meeting from email inquiry
                            if (onMeetingCreate) {
                              const newMeeting = {
                                id: `meeting_${Date.now()}`,
                                title: `Møte med ${email.from.name}`,
                                clientName: email.from.name,
                                clientEmail: email.from.email,
                                type: 'consultation',
                                status: 'scheduled',
                                scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                                source: 'email_inquiry',
                                emailId: email.d,
                                priority: email.priority || 'medium'
                        };
                              
                              console.log('📅 Creating meeting from email:', newMeeting);
                              onMeetingCreate(newMeeting);
                        }
                      }}
                        >
                          Planlegg Møte
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ImageIcon />}
                          sx={{
                            color: '#',
                            borderColor: '#',
                            minWidth: 10,
                            fontSize: '11px','&:hover': { 
                              bgcolor: '#9c27b01',
                              borderColor: '#9c27b0' 
                      }
                      }}
                          onClick={() => {
                            // Open showcase sharing dialog with pre-filled client info
                            setPrefilledClient({
                              email: email.from.email,
                              name: email.from.name
                      });
                            setShareShowcaseDialogOpen(true);
                      }}
                        >
                          Share Showcase
                        </Button>
                      </Box>
                    </ListItem>
                  ))}
                </List>

                {emails.filter((email: EmailMessage) => 
                  email.category === 'inquiry' || 
                  email.category === 'client' ||
                  (email.subject && (
                    email.subject.toLowerCase().includes('fotogra') ||
                    email.subject.toLowerCase().includes('pris') ||
                    email.subject.toLowerCase().includes('tilbud')
                  ))
                ).length === 0 && (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py:  4,
                    background: 'linear-gradient(135deg, #ff6f0008 0%, #ff8f0015 100%)',
                    borderRadius:  2,
                    border: '1px dashed #ff6f0040'
            }}>
                    <PersonIcon sx={{ fontSize:  48, color: '#ff6f006', mb:  2 }} />
                    <Typography variant="h6" sx={{  color: '#ff6f00', mb:  1  }}>
                      Ingen kundeforespørsler funnet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Nye forespørsler vil vises her når de ankommer
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Box>
          </TabPanel>

          {/* Activity Tab */}
          <TabPanel value={selectedTab} index={2}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap:  3 }}>
              {emailActivity && (
                <>
                  <Box>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      E-post Aktivitetsoversikt
                    </Typography>
                  </Box>
                  
                  <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                          Topp Kunder (Siste 30 dager)
                        </Typography>
                        <List dense>
                          {emailActivity.topClients.map((client: any, index: number) => (
                            <ListItem key={index}>
                              <ListItemAvatar>
                                <Avatar>{client.name.charAt(0).toUpperCase()}</Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={client.name}
                                secondary={`${client.emailCount} e-poster • Sist: ${formatDate(client.lastContact)}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Box>

                  <Box sx={{ flex: '1 1 300px', minWidth: 300}}>
                    <Card sx={theming.getThemedCardSx()}>
                      <CardContent sx={theming.getThemedCardSx()}>
                        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                          Nylig Aktivitet
                        </Typography>
                        <List dense>
                          {emailActivity.recentActivity.map((activity, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                {activity.type === 'sent' && <SendIcon color="success" />}
                                {activity.type === 'received' && <InboxIcon color="primary" />}
                                {activity.type === 'draft' && <DraftsIcon color="warning" />}
                                {activity.type === 'scheduled' && <ScheduleIcon color="info" />}
                              </ListItemIcon>
                              <ListItemText
                                primary={activity.subject}
                                secondary={`${activity.contact} • ${activity.time}`}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Box>
                </>
              )}
            </Box>
          </TabPanel>

          {/* Project Emails Tab */}
          <TabPanel value={selectedTab} index={3}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Prosjekt E-poster
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              E-poster organisert etter prosjekt og kunde
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap'}}>
              {projects.map((project: any) => (
                <Box sx={{ flex: '1 1 300px', minWidth: 300}} key={project.id}>
                  <Card sx={theming.getThemedCardSx()}>
                    <CardContent sx={theming.getThemedCardSx()}>
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Avatar sx={{ bgcolor: '#ff8c00'}}>
                          <CameraIcon />
                        </Avatar>
                        <Box sx={{ flexGrow:  1 }}>
                          <Typography variant="subtitle1">{project.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {project.clientName}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={`${project.emailCount || 0} e-poster`}
                          color="primary"
                          variant="outlined"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          </TabPanel>

          {/* Starred Tab */}
          <TabPanel value={selectedTab} index={4}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Viktige E-poster</Typography>
            <Typography>Stjernemerkede e-poster kommer snart...</Typography>
          </TabPanel>
          
          {/* Drafts Tab */}
          <TabPanel value={selectedTab} index={5}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Utkast</Typography>
            <Typography>Utkast kommer snart...</Typography>
          </TabPanel>
          
          {/* Settings Tab */}
          <TabPanel value={selectedTab} index={6}>
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>E-post Innstillinger</Typography>
            <Typography>Innstillinger kommer snart...</Typography>
          </TabPanel>
        </Box>
      </Paper>

      {/* Compose Dialog */}
      <Dialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Ny E-post
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt:  1 }}>
            <TextField
              fullWidth
              label="Til"
              placeholder="Skriv e-postadresse..."
            />
            <TextField
              fullWidth
              label="Emne"
              placeholder="Skriv emne..."
            />
            <TextField
              fullWidth
              multiline
              rows={8}
              label="Melding"
              placeholder="Skriv din melding..."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComposeOpen(false)}>
            Avbryt
          </Button>
          <Button variant="contained"
            startIcon={<SendIcon />}
            sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor:'#e67c00',} }}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Detail Dialog */}
      <Dialog
        open={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedEmail && (
          <>
            <DialogTitle>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Avatar src={selectedEmail.from.avatar}>
                  {selectedEmail.from.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flexGrow:  1 }}>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedEmail.subject}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fra: {selectedEmail.from.name} &lt;{selectedEmail.from.email}&gt;
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(selectedEmail.date)}
                </Typography>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Box
                sx={{ mt: 2 }}
                dangerouslySetInnerHTML={{
                  __html: selectedEmail.htmlBody || selectedEmail.body.replace(/\n/g, '<br>')
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button startIcon={<ReplyIcon />}>Svar</Button>
              <Button startIcon={<ForwardIcon />}>Videresend</Button>
              <Button startIcon={<DeleteIcon />} color="error">Slett</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Overage Management Dialog */}
      <OverageManagementDialog
        open={overageDialogOpen}
        onClose={() => setOverageDialogOpen(false)}
        showcaseData={selectedShowcaseData}
      />

      {/* Showcase Sharing Dialog */}
      <ShowcaseSharingDialog
        open={shareShowcaseDialogOpen}
        onClose={() => {
          setShareShowcaseDialogOpen(false);
          setPrefilledClient(undefined);
    }}
        prefilledClient={prefilledClient}
      />

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
    </Box>
);
};

export default SmartEmailCenter;