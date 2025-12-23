import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useExternalData } from '../../services/ExternalDataService';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Paper,
  Divider,
  Alert,
  Fab,
  Menu,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Badge,
  List,
  ListItem,
  ListItemAvatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Checkbox,
  RadioGroup,
  Radio,
  Snackbar,
  Drawer,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  Event,
  Add,
  Edit,
  Delete,
  Share,
  VideoCall,
  Photo,
  Facebook,
  Instagram,
  Twitter,
  WhatsApp,
  Email,
  Phone,
  LocationOn,
  Schedule,
  Visibility,
  VisibilityOff,
  PhotoLibrary,
  Launch,
  Settings,
  DragIndicator,
  SaveAlt,
  Chat,
  Notifications,
  CloudUpload,
  Assignment,
  CheckCircle,
  AccessTime,
  WbSunny,
  Navigation,
  QrCode,
  Send,
  AttachFile,
  Mic,
  Camera,
  ExpandMore,
  Close,
  Message,
  NotificationImportant,
  Bolt,
  Group,
  StarRate,
  ThumbUp,
  Update,
  Download,
  ContentCopy,
  Warning,
  Info,
  CheckBox,
  RadioButtonUnchecked,
  PlayArrow,
  Pause,
  Stop,
  VolumeUp,
  DirectionsCar
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface TimelineEvent {
  id: string;
  title: string;
  time: string;
  duration: number;
  description?: string;
  type: 'ceremony' | 'photos' | 'reception' | 'transport' | 'preparation' | 'custom';
  cultural_significance?: string;
  photographer_notes?: string;
  client_visible: boolean;
  order_index: number
}

interface CustomSection {
  id: string;
  title: string;
  type: 'social_media' | 'showcase' | 'meeting' | 'text' | 'image' | 'video' | 'custom';
  content: any;
  visible: boolean;
  order_index: number;
  photographer_only?: boolean
}

interface ContractDocument {
  id: string;
  title: string;
  status: 'draft' | 'sent' | 'signed' | 'completed';
  pdf_url: string;
  download_url?: string;
  file_size: string;
  signed_date?: string;
  created_date: string;
  version: string;
  google_drive_id?: string;
  google_drive_link?: string
}

interface ProjectInfo {
  id: string;
  project_name: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: string;
  created_at: string;
  estimated_hours: number;
  actual_hours: number;
  budget: number;
  expenses: number
}

interface TimelineData {
  id: number;
  couple_name: string;
  wedding_date: string;
  venue: string;
  cultural_type: string;
  photographer_message: string;
  client_notes: string;
  events: TimelineEvent[];
  custom_sections: CustomSection[];
  client_access_enabled: boolean;
  showcase_gallery_id?: string;
  contract_document?: ContractDocument;
  project_info?: ProjectInfo;
  previous_projects?: Array<{
    id: string;
    name: string;
    date: string;
    status: string;
}>;
}

interface Message {
  id: string;
  author: 'photographer' | 'client';
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'file' | 'voice' | 'quick_reply';
  read: boolean;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
}>;
}

interface Task {
  id: string;
  title: string;
  description: string;
  due_date: string;
  completed: boolean;
  assigned_to: 'photographer' | 'client' | 'both';
  priority: 'low' | 'medium' | 'high';
  category: 'preparation' | 'documentation' | 'communication' | 'logistics'
}

interface QuickTemplate {
  id: string;
  title: string;
  content: string;
  category: 'greeting' | 'reminder' | 'instruction' | 'thank_you' | 'emergency'
}

interface WeddingTimelineClientViewProps {
  timelineId: number;
  isPhotographer?: boolean;
  photographerId?: string
}

const socialMediaIcons = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  whatsapp: WhatsApp,
  email: Email,
  phone: Phone,
};

// Weather helper functions
const getWeatherDescription = (weatherData: any) => {
  if (!weatherData) return 'Delvis skyet';
  
  const temp = weatherData.temperature;
  const cloudCover = weatherData.cloudCover || 0;
  
  if (cloudCover < 20) return 'Klart';
  if (cloudCover < 50) return 'Delvis skyet';
  if (cloudCover < 80) return 'Skyet';
  return 'Overskyet';
};

const getWeatherSeverity = (weatherData: any) => {
  if (!weatherData) return 'success';
  
  const temp = weatherData.temperature;
  const windSpeed = weatherData.windSpeed || 0;
  const humidity = weatherData.humidity || 0;
  
  if (temp < 5 || temp > 30 || windSpeed > 15 || humidity > 90) {
    return 'warning';
}
  if (temp < 0 || windSpeed > 20) {
    return 'error';
}
  return 'success';
};

const getWeatherMessage = (weatherData: any) => {
  if (!weatherData) return 'Perfekt vær for utendørsfotografering! ☀️';
  
  const temp = weatherData.temperature;
  const windSpeed = weatherData.windSpeed || 0;
  const humidity = weatherData.humidity || 0;
  
  if (temp < 0) {
    return 'Kaldt vær - vær forberedt på kulde! ❄️';
}
  if (temp > 25) {
    return 'Varmt vær - husk solkrem og vann! ☀️';
}
  if (windSpeed > 15) {
    return 'Sterk vind - vær forsiktig med utstyr! 💨';
}
  if (humidity > 90) {
    return 'Høy luftfuktighet - beskytt utstyr! 💧';
}
  return 'Perfekt vær for utendørsfotografering! ☀️';
};

export default function WeddingTimelineClientView({ 
  timelineId, 
  isPhotographer = false, 
  photographerId 
}: WeddingTimelineClientViewProps) {
  const [editMode, setEditMode] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<CustomSection | null>(null);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [newSectionType, setNewSectionType] = useState<CustomSection['type']>('text');
  
  // Enhanced photographer features
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [messageTemplateOpen, setMessageTemplateOpen] = useState(false);
  const [fileUploadOpen, setFileUploadOpen] = useState(false);
  const [editTitleOpen, setEditTitleOpen] = useState(false);
  const [statusUpdateOpen, setStatusUpdateOpen] = useState(false);
  const [weatherInfoOpen, setWeatherInfoOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [quickReplyOpen, setQuickReplyOpen] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<QuickTemplate | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const { toast } = useToast();
  const { profession } = useProfessionAdapter();
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer,');
  const queryClient = useQueryClient();
  
  // External data service for weather information
  const { getCurrentWeather, getWeatherForecast } = useExternalData();
  
  // Fetch weather data for wedding location
  const fetchWeatherData = async () => {
    if (!timeline?.wedding_location) return;
    
    setWeatherLoading(true);
    try {
      const weather = await getCurrentWeather({ location: timeline.wedding_location });
      setWeatherData(weather);
} catch (error) {
      console.error('Failed to fetch weather data: ', error);
      // Keep fallback data
} finally {
      setWeatherLoading(false);
}
};
  
  // Fetch weather when dialog opens
  useEffect(() => {
    if (weatherInfoOpen && !weatherData) {
      fetchWeatherData();
}
}, [weatherInfoOpen]);

  // Quick message templates
  const messageTemplates: QuickTemplate[] = [
    {
      id: 'greeting',
      title: 'Velkommen',
      content: 'Hei! Vi gleder oss til å være fotografere på deres spesielle dag. La oss vite hvis dere har spørsmål, !',
      category: 'greeting'
},
    {
      id: 'reminder_timeline',
      title: 'Tidsplan-påminnelse',
      content: 'Husk å se gjennom tidsplanen for i morgen. Viktig at vi holder tidsplanen!',
      category: 'reminder'
},
    {
      id: 'weather_update',
      title: 'Værmelding',
      content: 'Værmelding for bryllupsdagen ser bra ut! ☀️ Perfekt for utendørsfotografering.',
      category: 'reminder'
},
    {
      id: 'preparation_reminder',
      title: 'Forberedelser',
      content: 'Husk: Ring i god tid, sørg for at koordinator og brudeparet har telefonen tilgjengelig, og nyt dagen! 💍',
      category: 'instruction'
},
    {
      id: 'emergency',
      title: 'Akutt',
      content: '🚨 VIKTIG: Ring oss umiddelbart på [telefon] hvis det oppstår endringer, !',
      category: 'emergency'
},
    {
      id: 'thank_you',
      title: 'Tusen Takk',
      content: 'Tusen takk for en fantastisk bryllupsdag! Bildene kommer innen [tid]. ❤, ️',
      category: 'thank_you'
}
  ];

  // Fetch timeline data
  const { data: timelineData, isLoading } = useQuery({
    queryKey: [`/api/wedding-timeline/${timelineId}/client-view`],
    queryFn: () => apiRequest(`/api/wedding-timeline/${timelineId}/client-view${isPhotographer ? '?photographer=true' : ','}`)
});

  // Update timeline
  const updateTimelineMutation = useMutation({
    mutationFn: async (updates: Partial<TimelineData>) => {
      return apiRequest(`/api/wedding-timeline/${timelineId}`, {
        headers: {
          "Content-Type" : "application/json"
  },
        method: 'PATCH',
        body: JSON.stringify(updates)
});
},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/wedding-timeline/${timelineId}/client-view`] });
      toast({
        title: "Tidslinje oppdatert",
        description: "Endringene er lagret",
  });
}
});

  // Create Google Meet
  const createMeetingMutation = useMutation({
    mmutationFn: async (meetingData: { title: string; datetime: string; attendees: string[] }) => {
      return apiRequest('/api/google/meet/create', {
        headers: {
          "Content-Type" : "application/json"
  },
        method: 'POST',
        body: JSON.stringify(meetingData)
});
},
    onSuccess: (meetingData) => {
      toast({
        title: "Møte opprettet",
        description: `Google Meet-link: ${meetingData.hangoutLink}`,
  });
      setMeetingDialogOpen(false);
}
});

  const timeline = timelineData?.timeline;
  const events = timeline?.events || [];
  const customSections = timeline?.custom_sections || [];

  const handleDragEnd = (result: any) => {
    if (!result.destination || !isPhotographer || !editMode) return;

    const items = Array.from(events);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order indices
    const updatedEvents = items.map((event, index) => ({
      ...event,
      order_index: index
}));

    updateTimelineMutation.mutate({ events: updatedEvents });
};

  const handleAddCustomSection = (sectionData: Partial<CustomSection>) => {
    const newSection: CustomSection = {
      id: `section_${Date.now()}`,
      title: sectionData.title || 'Ny seksjon',
      type: newSectionType,
      content: sectionData.content || {},
      visible: true,
      order_index: customSections.length,
      photographer_only: sectionData.photographer_only || false,
      ...sectionData
};

    updateTimelineMutation.mutate({
      custom_sections: [...customSections, newSection]
});
    setSectionDialogOpen(false);
};

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    const message: Message = {
      id: `msg_${Date.now()}`,
      author: isPhotographer ? 'photographer' : 'client',
      content: newMessage,
      timestamp: new Date().toISOString(),
      type: 'text',
      read: false
};
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
    
    toast({
      title: "Melding sendt",
      description: "Meldingen er levert",
});
};

  const handleSendTemplate = (template: QuickTemplate) => {
    const message: Message = {
      id: `msg_${Date.now()}`,
      author: 'photographer',
      content: template.content,
      timestamp: new Date().toISOString(),
      type: 'quick_reply',
      read: false
};
    
    setMessages(prev => [...prev, message]);
    setMessageTemplateOpen(false);
    
    toast({
      title: "Hurtigmelding sendt",
      description: template.title,
});
};

  const handleAddTask = (taskData: Partial<Task>) => {
    const newTask: Task = {
      id: `task_${Date.now()}`,
      title: taskData.title ||', ',
      description: taskData.description ||', ',
      due_date: taskData.due_date ||', ',
      completed: false,
      assigned_to: taskData.assigned_to || 'client',
      priority: taskData.priority || 'medium',
      category: taskData.category || 'preparation',
      ...taskData
};
    
    setTasks(prev => [...prev, newTask]);
    setTaskDialogOpen(false);
    
    toast({
      title: "Oppgave opprettet",
      description: newTask.title,
});
};

  const handleUpdateTitle = (newTitle: string) => {
    updateTimelineMutation.mutate({
      couple_name: newTitle
});
    setEditTitleOpen(false);
};

  const handleSendNotification = (type: 'reminder' | 'update' | 'urgent', message: string) => {
    // Send push notification or SMS
    toast({
      title: "Notifikasjon sendt",
      description: message,
});
    setNotificationOpen(false);
};

  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach(file => {
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          const message: Message = {
            id: `msg_${Date.now()}`,
            author: 'photographer',
            content: `Fil, delt: ${file.name}`,
            timestamp: new Date().toISOString(),
            type: 'file',
            read: false,
            attachments: [{
              name: file.name,
              url: URL.createObjectURL(file),
              type: file.type
      }]
      };
          setMessages(prev => [...prev, message]);
          setUploadProgress(0);
          setFileUploadOpen(false);
    }
  }, 200);
});
};

  const renderCustomSection = (section: CustomSection) => {
    if (section.photographer_only && !isPhotographer) return null;

    switch (section.type) {
      case 'social_media':
        return (
          <Card key={section.d} sx={{ mb: 2, bgcolor: 'rgba(3, 150, 243, 0.05)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <Share sx={{ color: '#2196F3'}} />
                {section.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                {section.content.platforms?.map((platform: any) => {
                  const IconComponent = socialMediaIcons[platform.type as keyof typeof socialMediaIcons];
                  return (
                    <Button
                      key={platform.type}
                      variant="outlined"
                      startIcon={<IconComponent />}
                      href={platform.url}
                      target="_blank"
                      sx={{ borderRadius:  2 }}
                    >
                      {platform.label}
                    </Button>
                );
            })}
              </Box>
            </CardContent>
          </Card>
      );

      case 'showcase':
        return (
          <Card key={section.id} sx={{ mb: 2, bgcolor: 'rgba(23, 30, 99, 0.05)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <PhotoLibrary sx={{ color: '#E91E63'}} />
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                {section.content.description}
              </Typography>
              <Button variant="contained"
                startIcon={theming.getThemedIcon('launch')}
                href={`/showcase/${section.content.gallery_id}`}
                target="_blank"
                sx={{ 
                  bgcolor: '#C2185B',
                  '&:hover': { bgcolor: '#AD1457' },
                  ...theming.getThemedButtonSx()
                }}>
                Se bildegalleri
              </Button>
            </CardContent>
          </Card>
      );

      case 'meeting':
        return (
          <Card key={section.id} sx={{ mb: 2, bgcolor: 'rgba(6, 175, 80, 0.05)' ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
                <VideoCall sx={{ color: '#4CAF50'}} />
                {section.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                {section.content.description}
              </Typography>
              <Button variant="contained"
                startIcon={theming.getThemedIcon('videoCall')}
                href={section.content.meeting_link}
                target="_blank"
                sx={{ 
                  bgcolor: '#388E3C',
                  '&:hover': { bgcolor: '#2E7D32' },
                  ...theming.getThemedButtonSx()
                }}>
                Bli med i møte
              </Button>
            </CardContent>
          </Card>
      );

      case 'text':
        return (
          <Card key={section.id} sx={{ mb:  2 ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                {section.title}
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap'}}>
                {section.content.text}
              </Typography>
            </CardContent>
          </Card>
      );

      default: return null;
}
};

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p:  3 }}>
        <Typography>Laster tidslinje...</Typography>
      </Box>
  );
}

  if (!timeline) {
    return (
      <Alert severity="error">
        Fant ikke tidslinjen
      </Alert>
  );
}

  return (
    <Box sx={{ maxWidth: 120, mx: 'auto', p:  3 }}>
      {/* Header */}
      <Box sx={{ mb:  4, textAlign: 'center'}}>
        <Typography variant="h3" sx={{  
          fontWeight: 7,
          background: 'linear-gradient(135deg, #E91E63, #FF8C00)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          mb: 1  }}>
          {timeline.couple_name}
        </Typography>
	        <Typography variant="h5" color="text.secondary" sx={{  mb:  1  }}>
	          {format(new Date(timeline.wedding_date), 'EEEE, dd. MMMM yyyy', { locale: nb })}
	        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
          {timeline.venue}
        </Typography>
        <Chip 
          label={timeline.cultural_type}
          color="primary"
          sx={{ mt:  2 }}
        />
      </Box>

      {/* Project & Contract Information */}
      {(timeline?.contract_document || timeline?.project_info) && (
        <Grid container spacing={3} sx={{ mb:  4 }}>
          {/* Contract Document Preview */}
          {timeline?.contract_document && (
            <Grid item xs={12} md={6}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))',
                border: '1px solid rgba(6, 175, 80, 0.2)'
          ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{  
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, mb:  2,
                    color: '#4CAF50'
             }}>
                    {theming.getThemedIcon('assignment')}
                    Kontrakt
                    <Chip 
                      label={timeline.contract_document.status === 'signed' ? 'Signert' : 
                             timeline.contract_document.status === 'sent' ? 'Sendt' : 'Utkast'}
                      color={timeline.contract_document.status === 'signed' ? 'success' : 
                             timeline.contract_document.status === 'sent' ? 'info' : 'warning'}
                      size="small"
                    />
                  </Typography>
                  
	                  {/* PDF Preview */}
	                  <Box
	                    sx={{
	                      bgcolor: 'rgba(0,0,0,0.05)',
	                      borderRadius: 2,
	                      p: 2,
	                      mb: 2,
	                      textAlign: 'center',
	                      border: '2px dashed rgba(6, 175, 80, 0.3)'}}
	                  >
	                    <Photo sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      PDF Forhåndsvisning
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {timeline.contract_document.title}
                    </Typography>
                    
	                    {/* Mock PDF preview */}
	                    <Box
	                      sx={{
	                        bgcolor: 'white',
	                        border: '1px solid #ddd',
	                        borderRadius: 1,
	                        height: 20,
	                        display: 'flex',
	                        alignItems: 'center',
	                        justifyContent: 'center',
	                        mb: 2,
	                        backgroundImage:
	                          'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
	                        backgroundSize: '20px 20px',
	                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'}}
	                    >
	                      <Box sx={{ textAlign: 'center' }}>
	                        <Typography
	                          variant="h6"
	                          sx={{ mb: 1, color: theming.colors.primary }}
	                        >
                          📄 Bryllupskontrakt
                        </Typography>
	                        <Typography variant="body2" sx={{ color: '#999' }}>
                          {timeline.contract_document.file_size} • Versjon {timeline.contract_document.version}
                        </Typography>
                      </Box>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap'}}>
                      <Button variant="contained"
                        startIcon={theming.getThemedIcon('launch')}
                        href={timeline.contract_document.google_drive_link || timeline.contract_document.pdf_url}
                        target="_blank"
                        sx={{ 
                          bgcolor: '#388E3C',
                          '&:hover': { bgcolor: '#2E7D32' },
                          ...theming.getThemedButtonSx()
                        }}>
                        Åpne i Drive
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={theming.getThemedIcon('visibility')}
                        href={timeline.contract_document.pdf_url}
                        target="_blank"
                      >
                        Forhåndsvis
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={theming.getThemedIcon('download')}
                        href={timeline.contract_document.download_url || timeline.contract_document.pdf_url}
                        target="_blank"
                      >
                        Last ned
                      </Button>
                    </Box>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Opprettet
                      </Typography>
	                      <Typography variant="body1">
	                        {format(
	                          new Date(timeline.contract_document.created_date),
	                          'dd. MMM yyyy',
	                          { locale: nb }
	                        )}
	                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Status
                      </Typography>
                      <Typography variant="body1">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {timeline.contract_document.status === 'signed' ? (
                            <>
                              <CheckCircle sx={{ fontSize: '1rem', color: 'success.main' }} />
                              <span>Signert</span>
                            </>
                          ) : timeline.contract_document.status === 'sent' ? (
                            <>
                              <Email sx={{ fontSize: '1rem', color: 'info.main' }} />
                              <span>Sendt til signering</span>
                            </>
                          ) : (
                            <>
                              <Edit sx={{ fontSize: '1rem', color: 'warning.main' }} />
                              <span>Under utarbeidelse</span>
                            </>
                          )}
                        </Box>
                      </Typography>
                    </Grid>
                    {timeline.contract_document.signed_date && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary">
                          Signert dato
                        </Typography>
	                        <Typography variant="body1" sx={{ color: 'success.main', fontWeight: 600 }}>
	                          {format(
	                            new Date(timeline.contract_document.signed_date),
	                            'dd. MMMM yyyy',
	                            { locale: nb }
	                          )}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Project Information */}
          {timeline?.project_info && (
            <Grid item xs={12} md={6}>
              <Card sx={{ 
                background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(33, 150, 243, 0.05))',
                border: '1px solid rgba(3, 150, 243, 0.2)'
          ,  ...theming.getThemedCardSx() }}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Typography variant="h6" sx={{  
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1, mb:  2,
                    color: '#2196F3'
             }}>
                    {theming.getThemedIcon('info')}
                    Prosjektinformasjon
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Kontaktinformasjon
                      </Typography>
                      <Typography variant="body1">
                        {timeline.project_info.client_email}
                      </Typography>
                      <Typography variant="body1">
                        {timeline.project_info.client_phone}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Estimerte timer
                      </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {timeline.project_info.estimated_hours || 0}t
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Faktiske timer
                      </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {timeline.project_info.actual_hours || 0}t
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Budsjett
                      </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {timeline.project_info.budget?.toLocaleString('no-NO') || 0} kr
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Utgifter
                      </Typography>
                      <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                        {timeline.project_info.expenses?.toLocaleString('no-NO') || 0} kr
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">
                        Opprettet
                      </Typography>
	                      <Typography variant="body1">
	                        {timeline.project_info.created_at
	                          ? format(
	                              new Date(timeline.project_info.created_at),
	                              'dd. MMMM yyyy',
	                              { locale: nb }
	                            )
	                          : 'Ukjent'}
	                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Enhanced Photographer Controls */}
      {isPhotographer && (
        <>
          <Box sx={{ mb:  3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap'}}>
            <FormControlLabel
              control={
                <Switch
                  checked={editMode}
                  onChange={(e) => setEditMode(e.target.checked)}
                />
          }
              label="Redigeringsmodus"
            />
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('edit')}
              onClick={() => setEditTitleOpen(true)}
            >
              Endre tittel
            </Button>
            <Button
              variant="outlined"
              startIcon={<Badge badgeContent={unreadCount} color="error">{theming.getThemedIcon('chat')}</Badge>}
              onClick={() => setChatDrawerOpen(true)}
            >
              Chat ({messages.length})
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('assignment')}
              onClick={() => setTaskDialogOpen(true)}
            >
              Oppgaver ({tasks.filter(t => !t.completed).length})
            </Button>
            <Button
              variant="outlined"
              startIcon={<Bolt />}
              onClick={() => setMessageTemplateOpen(true)}
            >
              Hurtigmeldinger
            </Button>
          </Box>

          <Box sx={{ mb:  3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap'}}>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('cloudUpload')}
              onClick={() => setFileUploadOpen(true)}
            >
              Del filer
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('notifications')}
              onClick={() => setNotificationOpen(true)}
            >
              Send varsel
            </Button>
            <Button
              variant="outlined"
              startIcon={<QrCode />}
              onClick={() => setQrCodeOpen(true)}
            >
              QR-kode
            </Button>
            <Button
              variant="outlined"
              startIcon={theming.getThemedIcon('wbSunny')}
              onClick={() => setWeatherInfoOpen(true)}
            >
              Værinfo
            </Button>
            <Button
              variant="outlined"
              startIcon={<Update />}
              onClick={() => setStatusUpdateOpen(true)}
            >
              Statusoppdatering
            </Button>
            {isSupported && userId && (
              <Button
                variant="outlined"
                startIcon={pushEnabled ? <NotificationsActive /> : <Notifications />}
                onClick={() => setPushSettingsOpen(true)}
                color={pushEnabled ? 'primary' : 'default'}
              >
                Push-varsler {pushEnabled ? 'Aktivert' : ', '}
              </Button>
            )}
          </Box>
        </>
      )}

      {/* Photographer message */}
      {timeline.photographer_message && (
        <Alert severity="info" sx={{ mb:  3 }}>
          <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Viktig informasjon fra fotografen</Typography>
          <Typography variant="body2">
            {timeline.photographer_message}
          </Typography>
        </Alert>
      )}

      {/* Custom sections */}
      {customSections
        .sort((a, b) => a.order_index - b.order_index)
        .map(renderCustomSection)}

      {/* Timeline */}
      <Card sx={{ mb:  3 ,  ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Typography variant="h5" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <Schedule sx={{ color: '#E91E63'}} />
            Tidsplan for dagen
          </Typography>
          
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="timeline">
              {(provided) => (
                <Timeline ref={provided.innerRef} {...provided.droppableProps}>
                  {events
                    .filter(event => event.client_visible || isPhotographer)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((event, index) => (
                      <Draggable 
                        key={event.id}
                        draggableId={event.id}
                        index={index}
                        isDragDisabled={!isPhotographer || !editMode}
                      >
                        {(provided, snapshot) => (
                          <TimelineItem
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            sx={{ 
                              opacity: event.client_visible ? 1 : 0.6,
                              bgcolor: snapshot.isDragging ? 'blur\(\s*([0-9]+px)\s*,\s*\), 0,0,0,0.1)' : 'transparent'
                        }}
                          >
                            <TimelineOppositeContent sx={{ flex: 0.3}}>
                              <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>
                                {event.time}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {event.duration} min
                              </Typography>
                            </TimelineOppositeContent>
                            
                            <TimelineSeparator>
                              <TimelineDot 
                                color={event.type === 'ceremony' ? 'primary' : 'secondary'}
                                {...(isPhotographer && editMode ? provided.dragHandleProps : {})}
                              >
                                {isPhotographer && editMode ? <DragIndicator /> : <Event />}
                              </TimelineDot>
                              <TimelineConnector />
                            </TimelineSeparator>
                            
                            <TimelineContent>
                              <Paper sx={{ p: 2, bgcolor: 'rgba(25,255,255,0.9)' ,  ...theming.getThemedCardSx() }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb:  1 }}>
                                  <Typography variant="h6" sx={{  fontWeight: 600}}>
                                    {event.title}
                                  </Typography>
                                  {isPhotographer && editMode && (
                                    <Box>
                                      <IconButton 
                                        size="small"
                                        onClick={() => {
                                          setSelectedEvent(event);
                                          setEventDialogOpen(true);
                                    }}
                                      >
                                        <Edit fontSize="small" />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          const updatedEvents = events.map(e => 
                                            e.id === event.id 
                                              ? { ...e, client_visible: !e.client_visible }
                                              : e
                                        );
                                          updateTimelineMutation.mutate({ events: updatedEvents });
                                    }}
                                      >
                                        {event.client_visible ? theming.getThemedIcon('visibility') : theming.getThemedIcon('visibilityOff')}
                                      </IconButton>
                                    </Box>
                                  )}
                                </Box>
                                {event.description && (
                                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                                    {event.description}
                                  </Typography>
                                )}
                                {event.cultural_significance && (
                                  <Typography variant="body2" sx={{ 
                                    fontStyle: 'italic',
                                    color: '#',
                                    mb: 1 }}>
                                    💫 {event.cultural_significance}
                                  </Typography>
                                )}
                                {isPhotographer && event.photographer_notes && (
                                  <Alert severity="warning" sx={{ mt: 1, fontSize: '0.8rem'}}>
                                    <Typography variant="caption">
                                      📝 Fotograf-notater: {event.photographer_notes}
                                    </Typography>
                                  </Alert>
                                )}
                              </Paper>
                            </TimelineContent>
                          </TimelineItem>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </Timeline>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>

      {/* Client notes and Previous Projects */}
      <Grid container spacing={3}>
        {timeline.client_notes && (
          <Grid item xs={12} md={8}>
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Notater fra bryllupsparet</Typography>
                <Typography variant="body1">
                  {timeline.client_notes}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Previous Projects */}
        {timeline?.previous_projects && timeline.previous_projects.length > 0 && (
          <Grid item xs={12} md={4}>
            <Card sx={{ 
              background: 'linear-gradient(135deg, rgba(2, 3, 3, 30, 99, 0.1), rgba(2, 3, 3, 30, 99, 0.05))',
              border: '1px solid rgba(23, 30, 99, 0.2)'
        ,  ...theming.getThemedCardSx() }}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" sx={{  
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1, mb:  2,
                  color: '#E91E63'
           }}>
                  <StarRate />
                  Tidligere prosjekter
                </Typography>
                {timeline.previous_projects.map((project) => (
                  <Box key={project.id} sx={{ 
                    p: 2, mb: 1, bgcolor: 'rgba(25,255,255,0.7)', 
                    borderRadius: 1,
                    border: '1px solid rgba(23, 30, 99, 0.1)'
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {project.name}
                    </Typography>
	                    <Typography variant="caption" color="text.secondary">
	                      {format(new Date(project.date), 'dd. MMM yyyy', { locale: nb })}
	                    </Typography>
                    <Chip 
                      label={project.status}
                      size="small"
                      color={project.status === 'completed' ? 'success' : 'primary'}
                      sx={{ ml: 1, fontSize: '0.7rem', height: 20}}
                    />
                  </Box>
                ))}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block'}}>
                  Totalt {timeline.previous_projects.length} tidligere prosjekt{timeline.previous_projects.length !== 1 ? 'er' : ', '}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Add Section Dialog */}
      <Dialog open={sectionDialogOpen} onClose={() => setSectionDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Legg til ny seksjon</DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Type seksjon</InputLabel>
                <Select
                  value={newSectionType}
                  onChange={(e) => setNewSectionType(e.target.value as CustomSection['type'])}
                >
                  <MenuItem value="text">Tekst</MenuItem>
                  <MenuItem value="social_media">Sosiale medier</MenuItem>
                  <MenuItem value="showcase">Bildegalleri</MenuItem>
                  <MenuItem value="meeting">Møte</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {newSectionType === 'social_media' && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Sosiale medier-knapper</Typography>
                <Button variant="contained"
                  onClick={() => handleAddCustomSection({
                    title: 'Del ditt bryllup',
                    type: 'social_media',
                    content: {
                      platforms: [
                        { type: 'facebook', label: 'Facebook', url: '#',},
                        { type: 'instagram', label: 'Instagram', url: '#',},
                        { type: 'whatsapp', label: 'WhatsApp', url: '#',}
                      ]
                }
              })}
                >
                  Legg til sosiale medier
                </Button>
              </Grid>
            )}

            {newSectionType === 'showcase' && (
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Bildegalleri</Typography>
                <Button variant="contained"
                  onClick={() => handleAddCustomSection({
                    title: 'Ditt bryllupsgalleri',
                    type: 'showcase',
                    content: {
                      description: 'Se alle bildene fra deres spesielle dag',
                      gallery_id: timeline.showcase_gallery_id || 'default'
              }
              })}
                >
                  Legg til galleri
                </Button>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSectionDialogOpen(false)}>Avbryt</Button>
        </DialogActions>
      </Dialog>

      {/* Google Meet Dialog */}
      <Dialog open={meetingDialogOpen} onClose={() => setMeetingDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Opprett Google Meet-møte</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Møtetittel"
            defaultValue={`Bryllupsmøte - ${timeline.couple_name}`}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Dato og tid"
            type="datetime-local"
            sx={{ mb:  2 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="E-post til deltagere (kommaseparert)"
            placeholder="kunde@example.com, assistent@example.com"
            sx={{ mb:  2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMeetingDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained"
            startIcon={theming.getThemedIcon('videoCall')}
            onClick={() => {
              // Create meeting logic here
              setMeetingDialogOpen(false);
              toast({
                title: "Møte opprettet",
                description: "Google Meet-link er sendt til deltagerne",
          });
        }}
          >
            Opprett møte
          </Button>
        </DialogActions>
      </Dialog>

      {/* Enhanced SpeedDial for Photographers */}
	      {isPhotographer && (
	        <SpeedDial
	          ariaLabel="Fotograf-verktøy"
	          sx={{ position: 'fixed', bottom: 20, right: 20 }}
	          icon={<SpeedDialIcon openIcon={theming.getThemedIcon('close')} />}
	          FabProps={{
	            sx: {
	              bgcolor: '#C2185B','&:hover': { bgcolor: '#AD1457' },
	            }}}
	        >
	        <SpeedDialAction
	          icon={theming.getThemedIcon('chat')}
            tooltipTitle="Åpne chat"
            onClick={() => setChatDrawerOpen(true)}
          />
          <SpeedDialAction
            icon={<Template />}
            tooltipTitle="Hurtigmeldinger"
            onClick={() => setMessageTemplateOpen(true)}
          />
	        <SpeedDialAction
	          icon={theming.getThemedIcon('assignment')}
            tooltipTitle="Ny oppgave"
            onClick={() => setTaskDialogOpen(true)}
          />
	        <SpeedDialAction
	          icon={theming.getThemedIcon('cloudUpload')}
            tooltipTitle="Last opp fil"
            onClick={() => setFileUploadOpen(true)}
          />
          <SpeedDialAction
            icon={<NotificationImportant />}
            tooltipTitle="Send varsel"
            onClick={() => setNotificationOpen(true)}
          />
	        <SpeedDialAction
	          icon={theming.getThemedIcon('videoCall')}
            tooltipTitle="Opprett møte"
            onClick={() => setMeetingDialogOpen(true)}
          />
        </SpeedDial>
      )}

      {/* Chat Drawer */}
      <Drawer
        anchor="right"
        open={chatDrawerOpen}
        onClose={() => setChatDrawerOpen(false)}
        sx={{ zIndex: 130}}
      >
        <Box sx={{ width: 40, height: '100%', display: 'flex', flexDirection: 'column'}}>
          <AppBar position="static" sx={{ bgcolor: '#E91E63'}}>
            <Toolbar>
              <Chat sx={{ mr:  2 }} />
              <Typography variant="h6" sx={{  flexGrow:  1  }}>
                Chat med {timeline?.couple_name}
              </Typography>
              <IconButton color="inherit" onClick={() => setChatDrawerOpen(false)}>
                {theming.getThemedIcon('close')}
              </IconButton>
            </Toolbar>
          </AppBar>
          
          <Box sx={{ flex: 1, overflow: 'auto', p:  2 }}>
            {messages.map((message) => (
              <Paper
                key={message.id}
                sx={{
                  p:  2,
                  mb:  1,
                  bgcolor: message.author === 'photographer' ? '#E3F2FD' : '#',
                  ml: message.author === 'photographer' ? 2 : 0,
                  mr: message.author === 'client' ? 2 : 0,
                  ...theming.getThemedCardSx()
                }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {message.author === 'photographer' ? 'Du' : timeline?.couple_name}
                </Typography>
                <Typography variant="body1">{message.content}</Typography>
                {message.attachments && (
                  <Box sx={{ mt:  1 }}>
                    {message.attachments.map((attachment, index) => (
                      <Chip
                        key={index}
                        icon={<AttachFile />}
                        label={attachment.name}
                        size="small"
                        clickable
                        sx={{ mr:  1 }}
                      />
                    ))}
                  </Box>
                )}
	                <Typography variant="caption" color="text.secondary">
	                  {format(new Date(message.timestamp), 'HH:mm', { locale: nb })}
	                </Typography>
              </Paper>
            ))}
          </Box>
          
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider'}}>
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                fullWidth
                size="small"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Skriv en melding..."
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <IconButton 
                color="primary"
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <Send />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <IconButton size="small" onClick={() => setMessageTemplateOpen(true)}>
                <Template />
              </IconButton>
              <IconButton size="small" onClick={() => setFileUploadOpen(true)}>
                <AttachFile />
              </IconButton>
              <IconButton 
                size="small" 
                color={isRecording ? 'error' : 'default'}
                onClick={() => setIsRecording(!isRecording)}
              >
                {theming.getThemedIcon('mic')}
              </IconButton>
              <IconButton size="small">
                <Camera />
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* Edit Title Dialog */}
      <Dialog open={editTitleOpen} onClose={() => setEditTitleOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Endre bryllupstittel</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Ny tittel"
            defaultValue={timeline?.couple_name}
            sx={{ mt:  1 }}
            placeholder="Ola & Kari"
          />
          <TextField
            fullWidth
            label="Venue"
            defaultValue={timeline?.venue}
            sx={{ mt:  2 }}
            placeholder="Holmenkollen Park Hotel"
          />
          <TextField
            fullWidth
            label="Kulturell type"
            defaultValue={timeline?.cultural_type}
            sx={{ mt:  2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTitleOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => handleUpdateTitle('Ny tittel')}>
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Message Templates Dialog */}
      <Dialog open={messageTemplateOpen} onClose={() => setMessageTemplateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Hurtigmeldinger</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {messageTemplates.map((template) => (
              <Grid item xs={12} md={6} key={template.id}>
                <Card 
                  sx={{ 
                    cursor: 'pointer', '&:hover': { bgcolor: 'rgba(23, 30, 99, 0.05)' }
              }}
                  onClick={() => handleSendTemplate(template)}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      {template.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {template.content}
                    </Typography>
                    <Chip 
                      label={template.category}
                      size="small"
                      sx={{ mt:  1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMessageTemplateOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Task Management Dialog */}
      <Dialog open={taskDialogOpen} onClose={() => setTaskDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Oppgaveadministrasjon</DialogTitle>
        <DialogContent>
          <Tabs value={0}>
            <Tab label="Opprett ny" />
            <Tab label={`Aktive (${tasks.filter(t => !t.completed).length})`} />
            <Tab label={`Fullførte (${tasks.filter(t => t.completed).length})`} />
          </Tabs>
          
          <Box sx={{ mt:  2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Oppgavetittel"
                  sx={{ mb:  2 }}
                />
                <TextField
                  fullWidth
                  label="Beskrivelse"
                  multiline
                  rows={3}
                  sx={{ mb:  2 }}
                />
                <TextField
                  fullWidth
                  label="Forfallsdato"
                  type="datetime-local"
                  InputLabelProps={{ shrink: true }}
                  sx={{ mb:  2 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Tildelt til</InputLabel>
                  <Select defaultValue="client">
                    <MenuItem value="client">Bryllupsparet</MenuItem>
                    <MenuItem value="photographer">Meg (fotograf)</MenuItem>
                    <MenuItem value="both">Begge</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth sx={{ mb:  2 }}>
                  <InputLabel>Prioritet</InputLabel>
                  <Select defaultValue="medium">
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select defaultValue="preparation">
                    <MenuItem value="preparation">Forberedelse</MenuItem>
                    <MenuItem value="documentation">Dokumentasjon</MenuItem>
                    <MenuItem value="communication">Kommunikasjon</MenuItem>
                    <MenuItem value="logistics">Logistikk</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskDialogOpen(false)}>Avbryt</Button>
          <Button variant="contained" onClick={() => handleAddTask({})}>
            Opprett oppgave
          </Button>
        </DialogActions>
      </Dialog>

      {/* File Upload Dialog */}
      <Dialog open={fileUploadOpen} onClose={() => setFileUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Del filer med bryllupsparet</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', p:  3 }}>
            <CloudUpload sx={{ fontSize:  64, color: '#', mb:  2 }} />
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Velg filer å dele
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
              Bilder, dokumenter, kontrakter, etc.
            </Typography>
            <input
              type="file"
              multiple
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              style={{ display: 'none'}}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="contained" component="span" sx={{ mb:  2 ,  ...theming.getThemedButtonSx() }}>
                Velg filer
              </Button>
            </label>
            {uploadProgress > 0 && (
              <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt:  2 }} />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileUploadOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Notification Dialog */}
      <Dialog open={notificationOpen} onClose={() => setNotificationOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send varsel til bryllupsparet</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Type varsel</InputLabel>
            <Select defaultValue="reminder">
              <MenuItem value="reminder">Påminnelse</MenuItem>
              <MenuItem value="update">Oppdatering</MenuItem>
              <MenuItem value="urgent">Akutt</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Melding"
            multiline
            rows={4}
            placeholder="Skriv varselet her..."
            sx={{ mb:  2 }}
          />
          <FormControlLabel
            control={<Checkbox defaultChecked />}
            label="Send SMS i tillegg til app-varsel"
          />
          <FormControlLabel
            control={<Checkbox />}
            label="Send e-post kopi"
          />
        </DialogContent>
	        <DialogActions>
	          <Button onClick={() => setNotificationOpen(false)}>Avbryt</Button>
	          <Button
	            variant="contained"
	            onClick={() => handleSendNotification('reminder', 'Test')}
	          >
	            Send varsel
	          </Button>
	        </DialogActions>
      </Dialog>

      {/* Push Notification Settings Dialog */}
      <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Push-varsler innstillinger</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <PushNotificationSettings userId={userId} contextId={timelineId} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrCodeOpen} onClose={() => setQrCodeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>QR-kode for enkel tilgang</DialogTitle>
        <DialogContent sx={{ textAlign: 'center'}}>
          <Box sx={{ p:  3 }}>
            <QrCode sx={{ fontSize: 10, color: '#', mb:  2 }} />
            <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
              Del denne QR-koden med bryllupsparet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb:  3 }}>
              De kan skanne koden for å få direkte tilgang til tidslinjen
            </Typography>
            <Button variant="outlined" startIcon={theming.getThemedIcon('contentCopy')}>
              Kopier link
            </Button>
            <Button variant="outlined" startIcon={theming.getThemedIcon('download')} sx={{ ml:  1 }}>
              Last ned QR
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrCodeOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Weather Info Dialog */}
      <Dialog open={weatherInfoOpen} onClose={() => setWeatherInfoOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Værmelding for bryllupsdagen</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', p: 2 }}>
            {weatherLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                <CircularProgress />
                <Typography variant="body1" sx={{ ml: 2 }}>
                  Henter værmelding...
                </Typography>
              </Box>
            ) : (
              <>
                <WbSunny sx={{ fontSize: 64, color: '#FF9800', mb: 2 }} />
                <Typography variant="h5" gutterBottom sx={{ color: theming.colors.primary }}>
                  {weatherData ? `${weatherData.temperature}°C - ${getWeatherDescription(weatherData)}` : '22°C - Delvis skyet'}
                </Typography>
	                <Typography variant="body1" sx={{ mb: 2 }}>
	                  {timeline?.wedding_date
	                    ? format(new Date(timeline.wedding_date), 'EEEE, dd. MMMM', {
	                        locale: nb,
	                      })
	                    : null}
	                </Typography>
                <Grid container spacing={2} sx={{ mt: 2 }}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Nedbør: {weatherData ? `${Math.round(weatherData.humidity)}%` : '10%'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Vind: {weatherData ? `${weatherData.windSpeed} m/s` : '5 m/s'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Luftfuktighet: {weatherData ? `${weatherData.humidity}%` : '65%'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Sikt: {weatherData ? `${weatherData.visibility} km` : '10 km'}
                    </Typography>
                  </Grid>
                </Grid>
                <Alert severity={getWeatherSeverity(weatherData)} sx={{ mt: 2 }}>
                  {getWeatherMessage(weatherData)}
                </Alert>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeatherInfoOpen(false)}>Lukk</Button>
          <Button variant="contained" onClick={() => {
            const weatherMessage = weatherData 
              ? `Værmelding for bryllupsdagen: ${weatherData.temperature}°C og ${getWeatherDescription(weatherData).toLowerCase()}. ${getWeatherMessage(weatherData)}`
              : 'Fantastisk vær for bryllupsdagen! 22°C og sol. Perfekt for bilder! ☀️';
            
            handleSendTemplate({
              id: 'weather',
              title: 'Værmelding',
              content: weatherMessage,
              category:'reminder'
        });
            setWeatherInfoOpen(false);
      }}>
            Del med paret
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
);
}