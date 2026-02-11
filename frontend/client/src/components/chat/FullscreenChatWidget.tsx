import { useTheming } from '../../utils/theming-helper';
import QuickMessageTemplates from './QuickMessageTemplates';
import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { apiRequest } from '../../lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Box,
  Typography,
  IconButton,
  TextField,
  InputAdornment,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Badge,
  Chip,
  Paper,
  Tabs,
  Tab,
  Divider,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Switch,
  FormControlLabel,
  Portal,
  Popover,
  ListItemIcon
} from '@mui/material';
import {
  Close,
  Search,
  Search as SearchIcon,
  MoreVert,
  Send,
  AttachFile,
  EmojiEmotions,
  Phone,
  VideoCall,
  Info,
  Person,
  Archive,
  Delete,
  Email,
  Chat,
  Google,
  Add,
  AlternateEmail,
  Settings,
  PersonAdd,
  Sync,
  AdminPanelSettings,
  Notifications,
  NotificationsActive,
  CheckCircle,
  Warning,
  Campaign,
  Speed,
  Announcement,
  AutoAwesome,
  Psychology,
  Build,
  Security,
  CampaignOutlined as Broadcast,
  Groups,
  Schedule,
  Analytics,
  Psychology as SentimentIcon,
  Timer,
  SmartToy,
  HelpOutline,
  TrendingUp,
  Star,
  Note,
  Language,
  Block,
  PersonOutline,
  Assignment,
  Backup,
  Download,
  Translate,
  History
} from '@mui/icons-material';
import {
  LinearProgress
} from '@mui/material';
	// Import dynamic profession system
	import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
	import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
	import getProfessionIcon from '@/utils/profession-icons';
	import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
	import { useAuth } from '../../hooks/useAuth';
	import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
	import { useCommunicationStatus } from '../../contexts/CommunicationStatusContext';
	import { usePushNotifications } from '../../hooks/usePushNotifications';
	import { PushNotificationSettings } from '../shared/PushNotificationSettings';

interface FullscreenChatWidgetProps {
  open: boolean;
  onClose: () => void;
  profession?: string; // Now supports dynamic profession types
  userEmail?: string;
  supportTicketId?: string; // For support chat integration
  initialChatType?: 'client' | 'team' | 'support'
}

interface ChatContact {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  type: 'client' | 'team' | 'support'
}

interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'file' | 'image';
  status: 'sent' | 'delivered' | 'read';
  attachments?: Array<{
    name: string;
    size: string;
    type: string;
    url: string;
}>;
}

export default function FullscreenChatWidget({ 
  open, 
  onClose, 
  profession,
  userEmail,
  supportTicketId,
  initialChatType = 'client'
}: FullscreenChatWidgetProps) {
  // Get user and profession context with dynamic system
	  const { user } = useAuth();
	  const { auth } = useEnhancedMasterIntegration();
	  
  const { status: communicationStatus, testGoogleChat } = useCommunicationStatus();
  const { getCurrentUserProfession, professionConfigs, isLoading: professionsLoading } = useDynamicProfessions();
  const userProfession = profession || (user as any)?.profession || getCurrentUserProfession();
  const professionConfig = professionConfigs?.[userProfession];
  
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(userProfession);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [activeTab, setActiveTab] = useState(initialChatType === 'support,' ? 2 : 0); // Default to support tab if support ticket

  // Evendi Chat Bridge State
  const [evendiConvs, setEvendiConvs] = useState<any[]>([]);
  const [selEvendiConv, setSelEvendiConv] = useState<string | null>(null);
  const [evendiMsgs, setEvendiMsgs] = useState<any[]>([]);
  const [evendiInput, setEvendiInput] = useState('');
  const [evendiBusy, setEvendiBusy] = useState(false);

  const fetchEvendiConvsFull = async () => {
    try {
      setEvendiBusy(true);
      const data = await apiRequest('/api/evendi/conversations');
      setEvendiConvs(data.conversations || []);
    } catch { setEvendiConvs([]); }
    finally { setEvendiBusy(false); }
  };
  const fetchEvendiMsgsFull = async (cid: string) => {
    try {
      setEvendiBusy(true);
      const data = await apiRequest(`/api/evendi/conversations/${cid}/messages`);
      setEvendiMsgs(data.messages || []);
      setSelEvendiConv(cid);
    } catch {}
    finally { setEvendiBusy(false); }
  };
  const sendEvendiMsgFull = async () => {
    if (!evendiInput.trim() || !selEvendiConv) return;
    try {
      await apiRequest(`/api/evendi/conversations/${selEvendiConv}/messages`, {
        method: 'POST', body: JSON.stringify({ body: evendiInput.trim() }),
        headers: { 'Content-Type': 'application/json' }
      });
      setEvendiInput('');
      fetchEvendiMsgsFull(selEvendiConv);
      fetchEvendiConvsFull();
    } catch {}
  };
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
	  // Real data API queries for admin
	  const { data: adminUsers } = useQuery({
	    queryKey: ['/api/admin/communication/users'],
	    queryFn: async () => {
	      return apiRequest('/api/admin/communication/users');
	    },
	    enabled: userEmail === user?.email,
	  });

	  const { data: chatStats } = useQuery({
	    queryKey: ['/api/admin/communication/stats'],
	    queryFn: async () => {
	      return apiRequest('/api/admin/communication/stats');
	    },
	    enabled: userEmail === user?.email,
	  });

	  const { data: businessData } = useQuery({
	    queryKey: ['/api/admin/analytics/business'],
	    queryFn: async () => {
	      return apiRequest('/api/admin/analytics/business');
	    },
	    enabled: userEmail === user?.email,
	  });

	  const { data: leadsData } = useQuery({
	    queryKey: ['/api/crm/analytics/leads'],
	    queryFn: async () => {
	      return apiRequest('/api/crm/analytics/leads');
	    },
	    enabled: userEmail === user?.email,
	  });

	  const { data: salesData } = useQuery({
	    queryKey: ['/api/crm/analytics/sales'],
	    queryFn: async () => {
	      return apiRequest('/api/crm/analytics/sales');
	    },
	    enabled: userEmail === user?.email,
	  });
  
  // Admin-specific features
  const isAdmin = userEmail === user?.email;
  const [showAdminQuickActions, setShowAdminQuickActions] = useState(false);
  const [adminTemplatesOpen, setAdminTemplatesOpen] = useState(false);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [chatStatsOpen, setChatStatsOpen] = useState(false);
  const [userModerationOpen, setUserModerationOpen] = useState(false);
  const [automationPanelOpen, setAutomationPanelOpen] = useState(false);
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(true);
  const [faqBotEnabled, setFaqBotEnabled] = useState(true);
  const [biPanelOpen, setBiPanelOpen] = useState(false);
  const [workflowPanelOpen, setWorkflowPanelOpen] = useState(false);
  const [securityPanelOpen, setSecurityPanelOpen] = useState(false);
  const [internationalizationPanelOpen, setInternationalizationPanelOpen] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const currentUserId = user?.id || user?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(currentUserId);

  // Admin message templates
  const adminMessageTemplates = [
    {
      category: 'Funksjon Aktivert',
      icon: <CheckCircle sx={{ color: '#4CAF50' }} />,
      templates: [
        'Hei! Vi har nå aktivert funksjonen du forespurte. Den er tilgjengelig i ditt dashboard.','Funksjonaliteten er nå aktiv på din konto. Du finner den under innstillinger.','Den nye funksjonen er klar til bruk! Sjekk ut [FEATURE] fanen i dashboardet ditt.'
      ]
    },
    {
      category: 'System Oppdateringer',
      icon: <Notifications sx={{ color: '#ff8c00' }} />,
      templates: [
        'Systemoppdatering fullført! Nye funksjoner er nå tilgjengelige.','Vi har oppdatert plattformen med forbedringer basert på din tilbakemelding.','Sikkerheitsoppdatering installert. Alle systemer kjører optimalt.'
      ]
    },
    {
      category: 'Teknisk Support',
      icon: <Build sx={{ color: '#2196F3' }} />,
      templates: [
        'Jeg ser problemet. La meg ordne det for deg umiddelbart.','Takk for rapporten. Feilen er nå rettet i ditt system.','Teknisk team har løst problemet. Prøv å refreshe siden.'
      ]
},
    {
      category: 'Hastesaker',
      icon: <Warning sx={{ color: '#f44336' }} />,
      templates: [
        'HASTESAK: Kritisk oppdatering påkrevd. Kontakt oss øyeblikkelig.','Viktig sikkerhetsmelding: Vennligst oppdater passord umiddelbart.','Din konto trenger øyeblikkelig oppmerksomhet. Ring 41234567.'
      ]
    },
    {
      category: 'Positive Meldinger',
      icon: <AutoAwesome sx={{ color: '#9C27B0' }} />,
      templates: [
        'Gratulerer! Du har nådd ny milepæl på plattformen!','Flott arbeid! Ditt prosjekt har mottatt utmerkelser fra andre brukere.','Du har nå blitt premium-medlem med alle avanserte funksjoner!'
      ]
    },
    {
      category: 'Kundeservice',
      icon: <Psychology sx={{ color: '#607D8B' }} />,
      templates: [
        'Takk for henvendelsen. Jeg hjelper deg gjerne med dette.','La meg sjekke kontoen din og komme tilbake med svar.','Dette kan jeg løse for deg. Gir beskjed når det er ferdig.'
      ]
    }
  ];

  // Admin quick actions
  const adminQuickActions = [
    {
      label: 'Aktiver Premium',
      icon: <Speed sx={{ color: '#FFD700'}} />,
      action: (contactName: string) => `Hei ${contactName}! Premium-funksjonene er nå aktivert på din konto. Velkommen til CreatorHub Norge Premium! 🌟`
},
    {
      label: 'Ny Funksjon Tilgjengelig', 
      icon: <Announcement sx={{ color: '#ff8c00'}} />,
      action: (contactName: string) => `${contactName}, vi har lagt til nye AI-funksjoner i ditt dashboard. Sjekk dem ut under "Avanserte Verktøy"!`
},
    {
      label: 'Problem Løst',
      icon: <CheckCircle sx={{ color: '#4CAF50'}} />,
      action: (contactName: string) => `Hei ${contactName}! Problemet du rapporterte er nå fullstendig løst. Alt skal fungere som normalt.`
},
    {
      label: 'Sikkerhet O',
      icon: <Security sx={{ color: '#2196F3'}} />,
      action: (contactName: string) => `${contactName}, sikkerhetstjekken er fullført. Din konto er sikker og alle systemer fungerer normalt.`
},
    {
      label: 'Gratis Upgrade',
      icon: <Campaign sx={{ color: '#9C27B0'}} />,
      action: (contactName: string) => `Spesielt tilbud for ${contactName}! Du har fått gratis upgrade til neste abonnementsnivå. Aktiv nå! 🎁`
}
  ];

  // Advanced admin functions
  const adminAdvancedActions = [
    {
      label: 'Broadcast Melding',
      icon: <Broadcast sx={{ color: '#ff6b6b'}} />,
      description: 'Send melding til alle brukere',
      action: () => setBroadcastModalOpen(true)
},
    {
      label: 'Chat Statistikk',
      icon: <Analytics sx={{ color: '#4ecdc4'}} />,
      description: 'Vis detaljert chat-analyse',
      action: () => setChatStatsOpen(true)
},
    {
      label: 'Bruker Moderering',
      icon: <PersonOutline sx={{ color: '#45b7d1'}} />,
      description: 'Moderer brukere og samtaler',
      action: () => setUserModerationOpen(true)
},
    {
      label: 'Smart Automatisering',
      icon: <SmartToy sx={{ color: '#9C27B0'}} />,
      description: 'AI auto-svar og FAQ-bot',
      action: () => setAutomationPanelOpen(true)
},
    {
      label: 'Business Intelligence',
      icon: <TrendingUp sx={{ color: '#4CAF50'}} />,
      description: 'CRM-integrasjon og lead-tracking',
      action: () => setBiPanelOpen(true)
},
    {
      label: 'Arbeidsflyt-optimalisering',
      icon: <Build sx={{ color: '#ff8c00'}} />,
      description: 'Chat-routing og oppgave-generering',
      action: () => setWorkflowPanelOpen(true)
},
    {
      label: 'Data & Sikkerhet',
      icon: <Security sx={{ color: '#f44336'}} />,
      description: 'GDPR-compliance og backup',
      action: () => setSecurityPanelOpen(true)
},
    {
      label: 'Internasjonalisering',
      icon: <Language sx={{ color: '#673AB7'}} />,
      description: 'Oversettelse og språkstøtte',
      action: () => setInternationalizationPanelOpen(true)
}
  ];
  
  // Google Chat with sales integration and CRM features
  const [salesMode, setSalesMode] = useState(false);
  const [currentLead, setCurrentLead] = useState<any>(null);
  const [googleChatMenuAnchor, setGoogleChatMenuAnchor] = useState<null | HTMLElement>(null);
  const [googleChatSpaces, setGoogleChatSpaces] = useState<any[]>([]);
  const [isConnectedToGoogle, setIsConnectedToGoogle] = useState(false); // Real connection status

  // Initialize Google Chat spaces when connected
  useEffect(() => {
    if (isConnectedToGoogle && googleChatSpaces.length === 0) {
      // Fetch project-related spaces from the enhanced API
      fetch('/api/google-chat/project-spaces/current-user')
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const formattedSpaces = data.spaces.map(space => ({
              id: space.spaced,
              name: space.spaceName,
              spaceName: space.spaceName,
              email: `${space.projectType}@creatorhubn.com`,
              avatar: null,
              status: space.status === 'active' ? 'online' as const : 'away' as const,
              lastMessage: `Prosjekt: ${space.projectName} - ${space.clientName}`,
              lastMessageTime: space.lastActivity,
              unreadCount: space.unreadCount,
              type: space.projectType === 'bryllup' ? 'client' as const : 'team' as const,
              isGoogleSpace: true,
              projectData: {
                projectName: space.projectName,
                clientName: space.clientName,
                projectType: space.projectType,
                milestones: space.milestones,
                memberCount: space.memberCount
        }
        }));
            setGoogleChatSpaces(formattedSpaces);
      }
    })
        .catch((error) => {
          console.error('❌ Failed to fetch Google Chat spaces: ', error);
          setGoogleChatSpaces([]);
    });
}
}, [isConnectedToGoogle, googleChatSpaces.length]);
  
  // CRM suggestion system states
  const [needsHelpMessage, setNeedsHelpMessage] = useState<any>(null);
  const [showHelpIndicator, setShowHelpIndicator] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

	  // Create a project space for current user's active project
	  const handleCreateProjectSpace = async () => {
	    try {
	      // Generate project ID based on user and timestamp
	      const projectId = `${userEmail?.split('@')[0]}_${Date.now()}`;
	      
	      console.log('🚀 Creating project space for user: ', {
	        projectId,
	        userId: userEmail,
	        profession: profession,
	      });

	      const authHeaders = await auth.getAuthHeader();
	      
	      const response = await fetch('/api/google/chat/create-project-space', {
	        method: 'POST',
	        headers: {
	          ...authHeaders, 'Content-Type' : 'application/json',
	        },
	        body: JSON.stringify({
	          projectId,
	          userId: userEmail || user?.id || user?.email || 'unknown-user',
	          profession: userProfession,
	        }),
	      });
	      
	      console.log('📡 API Response Status:', response.status, response.statusText);
	      console.log('📡 Response headers:', response.headers);
	      
	      if (!response.ok) {
	        const errorText = await response.text();
	        console.error('❌ API Error Response:', errorText);
	        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	      }
	      
	      const responseText = await response.text();
	      console.log('📡 Raw response:', responseText.substring(0, 200) + '...');
	      
	      let data;
	      try {
	        data = JSON.parse(responseText);
	      } catch (parseError) {
	        console.error('❌ JSON Parse Error:', parseError);
	        console.error('❌ Response was not JSON. Got:', responseText.substring(0, 500));
	        throw new Error('Server returned HTML instead of JSON - possible routing issue');
	      }
	      
	      console.log('🚀 Project space creation result:', data);
	      
	      // Refresh project spaces to show the new space
	      if (data.success) {
	        console.log('✅ Project space created successfully! Refreshing spaces...');
	        setGoogleChatSpaces([]);
	        // Refresh spaces list
	        queryClient.invalidateQueries({ queryKey: ['/api/google-chat/project-spaces'] });
	      } else {
	        console.error('❌ Project space creation failed:', data);
	      }
	    } catch (error) {
	      console.error('💥 Error creating project space:', error);
	      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
	    }
	  };

  // Get profession color dynamically
  const getProfessionColor = () => {
    return (professionConfig as any)?.color || '#ff8c00';
};

  // Fetch conversations - only real data from database
  const { data: conversationsResponse } = useQuery({
    queryKey: ['/api/communication/conversations', userEmail],
    queryFn: () => apiRequest(`/api/communication/conversations?userEmail=${userEmail}`),
    enabled: open && !!userEmail,
    refetchInterval: 30000 });

  const contacts: ChatContact[] = (conversationsResponse?.conversations || []).map((conv: any) => ({
    id: conv.id,
    name: conv.clientName || conv.name || `Samtale ${conv.id}`,
    email: conv.email || 'ukjent@email.com',
    avatar: conv.avatar,
    status: conv.isOnline ? 'online' : 'offline',
    lastMessage: conv.lastMessage?.content || 'Ingen meldinger',
    lastMessageTime: conv.lastMessage?.timestamp || conv.createdAt,
    unreadCount: conv.unreadCount ?? 0,
    type: conv.type === 'group' ? 'team' : 'client'
}));

	  // Fetch sales leads for CRM integration
	  const { data: salesLeads } = useQuery({
	    queryKey: ['/api/sales/leads'],
	    queryFn: () => apiRequest('/api/sales/leads'),
	    enabled: open && salesMode,
	    refetchInterval: 60000,
	  });
	
	  // Smart response suggestions based on message analysis
	  const analyzeMessageMutation = useMutation({
	    mutationFn: async (messageData: any) => {
	      return apiRequest('/api/chat/analyze-message', {
	        method: 'POST',
	        headers: {
	          'Content-Type' : 'application/json',
	        },
	        body: JSON.stringify(messageData),
	      });
	    },
	    onSuccess: (data) => {
	      console.log('Message analysis result:', data);
	      setResponseSuggestions(data);
	    },
	  });

  const handleMessageInputChange = (value: string) => {
    setMessageInput(value);
};

  const [responseSuggestions, setResponseSuggestions] = useState<any>(null);

	  // Fetch messages for selected contact
	  const { data: messagesResponse } = useQuery({
	    queryKey: ['/api/communication/messages', selectedContact?.id],
	    queryFn: () => apiRequest(`/api/communication/messages/${selectedContact?.id}`),
	    enabled: !!selectedContact,
	  });

  const messages: ChatMessage[] = (messagesResponse?.messages || []).map((msg: any) => ({
    id: msg.id,
    senderId: msg.senderId,
    content: msg.content,
    timestamp: msg.timestamp,
    type: msg.type || 'text',
    status: msg.status || 'sent',
    attachments: msg.attachments || []
}));

  // Check if user might need help responding to a message
  const checkIfNeedsHelp = useCallback((messages: any[]) => {
    if (!messages || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    
    // Show help indicator if the last message is from customer and no response yet
    if (lastMessage.senderId !== 'current-user') {
      // Check if customer asked complex questions that might need smart responses
	      const content = lastMessage.content.toLowerCase();
	      const complexKeywords = [
	        'pris','koster','tilgjengelighet','ledig','hvor lang tid','når','pakke','inkludert','detaljer','bestille','book','kontrakt','leveringstid','betaling','avbestilling','endring',
	      ];
      
      const containsComplexQuestion = complexKeywords.some(keyword => 
        content.includes(keyword)
    );
      
      if (containsComplexQuestion) {
        setNeedsHelpMessage(lastMessage);
        setShowHelpIndicator(true);
  } else {
        setShowHelpIndicator(false);
  }
} else {
      setShowHelpIndicator(false);
}
}, []);

  // Analyze customer messages for smart response suggestions (manual trigger)
  const analyzeCustomerMessages = useCallback(() => {
    if (!selectedContact || !messages || !messages.length) return;
    
    // Find recent customer messages (not from current user)
    const customerMessages = messages
      .filter(msg => msg.senderId !== 'current-user')
      .slice(-3); // Last 3 customer messages
      
    if (customerMessages.length > 0) {
      const latestCustomerMessage = customerMessages[customerMessages.length - 1];
      
      analyzeMessageMutation.mutate({
        customerMessage: latestCustomerMessage,
        conversationHistory: messages.slice(-1), // Last 10 messages for full context
        leadId: currentLead?.d,
        customerProfile: {
          name: selectedContact.name,
          email: selectedContact.email,
          type: selectedContact.type
  }
  });
      
      setShowSuggestions(true);
      setShowHelpIndicator(false);
}
}, [selectedContact, messages, analyzeMessageMutation, currentLead?.id]);

  // Check for help indicators when messages change
  useEffect(() => {
    if (selectedContact && messages) {
      checkIfNeedsHelp(messages);
}
}, [selectedContact, messages, checkIfNeedsHelp]);

	  // Send message mutation
	  const sendMessageMutation = useMutation({
	    mutationFn: async (messageData: { content: string; conversationId: string }) =>
	      apiRequest('/api/communication/messages', {
	        method: 'POST',
	        body: JSON.stringify(messageData),
	      }),
	    onSuccess: () => {
	      setMessageInput('');
	      queryClient.invalidateQueries({ queryKey: ['/api/communication/messages'] });
	      queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations'] });
	    },
	  });
	
	  // Send email mutation
	  const sendEmailMutation = useMutation({
	    mutationFn: async (emailData: {
	      to: string;
	      subject: string;
	      content: string;
	      fromEmail?: string;
	    }) =>
	      apiRequest('/api/communication/email/send', {
	        method: 'POST',
	        body: JSON.stringify(emailData),
	      }),
	    onSuccess: () => {
	      setMessageInput('');
	    },
	  });

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedContact) return;

    if (activeTab === 0) {
      // Send chat message
      sendMessageMutation.mutate({
        content: messageInput,
        conversationId: selectedContact.id
});
} else {
      // Send email
      sendEmailMutation.mutate({
        to: selectedContact.email,
        subject: `Melding fra ${(professionConfig as any)?.displayName || profession}`,
        content: messageInput,
        fromEmail: userEmail
});
}
};

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
}
};

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.email.toLowerCase().includes(searchQuery.toLowerCase())
);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('no-N', { hour: '2-digit', minute: '2-digit',});
}
    return date.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit',});
};

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{ zIndex: 140}}
      PaperProps={{
        sx: {
          height: '90vh',
          bgcolor: 'background.paper',
          backgroundImage: 'none'
  }
  }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', height: '100%'}}>
        {/* Chat Sidebar */}
        <Box sx={{ 
          width: 30, 
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column'
  }}>
          {/* Header with Google Chat */}
          <Box sx={{ bgcolor: getProfessionColor(), color: 'white'}}>
            <Box sx={{ 
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
      }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
                <Google sx={{ fontSize: 28}} />
                <Typography variant="h6" sx={{  fontWeight: 600}}>
                  Google Chat Professional
                </Typography>
                <Chip 
                  label={isConnectedToGoogle ? "TILKOBLET" : "FRAKOBLET"}
                  size="small" 
                  sx={{ 
                    bgcolor: isConnectedToGoogle ? '#4CAF50' : '#', 
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
            }}
                />
                {/* Google Chat API Status Indicator */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    ml: 1}}
                >
                  <Box
                    sx={{
                      width:  8,
                      height:  8,
                      borderRadius: '50, %',
                      backgroundColor: communicationStatus.googleChatStatus === 'connected' ? '#4caf50' : '#',
                      border: '1px solid white'
              }}
                    title={
                      communicationStatus.googleChatStatus === 'connected' 
                        ? `Google Chat API: ${communicationStatus.googleChatResponse}` 
                        : `Google Chat API: ${communicationStatus.googleChatResponse || 'Not tested'}`
                }
                  />
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9}}>
                    API
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                {isSupported && (
                  <Tooltip title="Push-varsler innstillinger">
                    <IconButton 
                      onClick={() => setPushSettingsOpen(true)}
                      sx={{ 
                        color: pushEnabled ? 'rgba(255, 255, 255, 0.9)' : 'white', '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.1)'
                        }
                      }}
                    >
                      {pushEnabled ? <NotificationsActive /> : <Notifications />}
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton 
                  ref={(el) => {
                    if (el && !googleChatMenuAnchor) {
                      // Store reference for menu positioning
                }
              }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    console.log('Google Chat menu button clicked! Current state:', Boolean(googleChatMenuAnchor));
                    if (googleChatMenuAnchor) {
                      console.log('Closing menu');
                      setGoogleChatMenuAnchor(null);
                } else {
                      console.log('Opening menu');
                      console.log('Setting anchor element immediately');
                      console.log('Target element:', target.nodeName, target.getBoundingClientRect());
                      setGoogleChatMenuAnchor(target);
                }
              }}
                  sx={{ 
                    color: 'white',
                    border: '2px solid rgba(25,255,255,0.5)',
                    bgcolor: googleChatMenuAnchor ? 'rgba(25,255,255,0.2)' : 'transparent','&:hover': {
                      bgcolor: 'rgba(25,255,255,0.15)',
                      transform: 'scale(1.05, )',
                      border: '2px solid rgba(25,255,255,0.8)'
                }
              }}
                >
                  {theming.getThemedIcon('moreVert')}
                </IconButton>
                <IconButton 
                  onClick={onClose}
                  sx={{ color: 'white'}}
                >
                  {theming.getThemedIcon('close')}
                </IconButton>
              </Box>
            </Box>
            
            {/* Status Bar */}
            <Box sx={{ 
              px: 2,
              pb: 2,
              display: 'flex', 
              alignItems: 'center', 
              gap:  2,
              fontSize: '0.85rem'
      }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                <Person sx={{ fontSize: 16}} />
                <Typography variant="caption">
                  {googleChatSpaces.length} Spaces
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                <Chat sx={{ fontSize: 16}} />
                <Typography variant="caption">
                  CRM Integration Active
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Sales Mode Toggle with Google Chat Integration */}
          <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default'}}>
            <Button
              fullWidth
              variant={salesMode ? 'contained' : 'outlined'}
              onClick={() => setSalesMode(!salesMode)}
              sx={{
                color: salesMode ? 'white' : getProfessionColor(),
                borderColor: getProfessionColor(),
                bgcolor: salesMode ? getProfessionColor() : 'transparent','&:hover': {
                  bgcolor: salesMode ? getProfessionColor() : `${getProfessionColor()}10`,
            }
          }}
            >
              {salesMode ? '💼 CRM Aktiv' : '🎯 Aktiver CRM'}
            </Button>
          </Box>

          {/* Connection Status - Always show as connected for demo */}
          {true && (
            <>
              {/* Search Google Chat Spaces */}
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={salesMode ? "Søk i Google Chat spaces og CRM leads..." : "Søk i Google Chat spaces..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        {theming.getThemedIcon('')}
                      </InputAdornment>
                    )
              }}
                />
                
                {/* Google Chat API Status */}
                <Box sx={{ 
                  mt: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: communicationStatus.googleChatStatus === 'connected' ? '#e8f5e8' : '#ffebee',
                  border: `1px solid ${communicationStatus.googleChatStatus === 'connected' ? '#4caf50' : '#'}20`
            }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                      <Box
                        sx={{
                          width:  8,
                          height:  8,
                          borderRadius: '50, %',
                          backgroundColor: communicationStatus.googleChatStatus === 'connected' ? '#4caf50' : '#f44336'
                  }}
                      />
                      <Typography variant="caption" sx={{ fontWeight: 500}}>
                        Google Chat API: {communicationStatus.googleChatStatus === 'connected' ? 'Connected' : 'Disconnected'}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {communicationStatus.googleChatResponse || 'Not tested'}
                    </Typography>
                  </Box>
                  {communicationStatus.googleChatLastCheck && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5}}>
                      Last check: {communicationStatus.googleChatLastCheck.toLocaleTimeString('no-NO')}
                    </Typography>
                  )}
                </Box>
              </Box>
            </>
          )}

          {/* Google Chat Spaces and Contacts List */}
          <List sx={{ flex: 1, overflow: 'auto', p: 0}}>
            {isConnectedToGoogle ? (
              // Show Google Chat spaces when connected
              [...(salesMode ? salesLeads || [] : []), ...filteredContacts, ...googleChatSpaces]
                .filter(item =>
                  item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.spaceName?.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((contact, index) => (
                  <ListItem
                    key={contact.id}
                onClick={() => setSelectedContact(contact)}
                sx={{
	                  borderBottom: 1,
	                  borderColor: 'divider',
	                  py: 2,
	                  px: 2,
	                  position: 'relative',
	                  transition: 'all 0.2s ease','&:hover': {
	                    bgcolor: `${getProfessionColor()}08`,
	                    transform: 'translateX(4px)',
	                  }, '&.Mui-selected': {
	                    bgcolor: `${getProfessionColor()}15`,
	                    borderLeft: `4px solid ${getProfessionColor()}`, '&:before': {
	                      content: '""',
	                      position: 'absolute',
	                      top: 0,
	                      right: 0,
	                      width: '4px',
	                      height: '100%',
                      background: `linear-gradient(to bottom, ${getProfessionColor()}, transparent)`,
                      borderRadius: '2px 0 0 2px'
              }
              }
            }}
              >
                <ListItemAvatar sx={{ minWidth: 48}}>
                  <Badge
                    color={contact.status === 'online' ? 'success' : 'default'}
                    variant="dot"
                    overlap="circular"
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right'}}
                  >
                    <Avatar 
                      src={contact.avatar}
	                      sx={{
	                        width:  44,
	                        height:  44,
	                        border: `2px solid ${contact.status === 'online' ? '#4CAF50' : 'transparent'}`,
	                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
	                  }}
                    >
                      {contact.name.charAt(0)}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                
                <ListItemText
                  sx={{ pr:  1 }}
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5}}>
                      <Typography 
                        variant="subtitle2" 
                        sx={{ 
                          fontWeight: ontact.unreadCount > 0 ? 700 : 500,
                          color: selectedContact?.id === contact.id ? getProfessionColor() : 'inherit'
                  }}
                      >
                        {contact.name}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                        {contact.lastMessageTime && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ fontSize: '0.7rem'}}
                          >
                            {formatTime(contact.lastMessageTime)}
                          </Typography>
                        )}
                        {contact.unreadCount && contact.unreadCount > 0 && (
	                          <Chip 
	                            label={contact.unreadCount}
	                            size="small"
	                            sx={{ 
	                              bgcolor: getProfessionColor(),
	                              color: 'white',
	                              fontSize: '0.7rem',
	                              height:  18,
	                              minWidth: 18, '& .MuiChip-label': { px: 0.5, }}}
	                          />
                        )}
                      </Box>
                    </Box>
              }
                  secondary={
                    <Box>
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        noWrap
                        sx={{ 
                          fontSize: '0.85rem',
                          fontWeight: ontact.unreadCount > 0 ? 500 : 400,
                          opacity: contact.unreadCount > 0 ? 1 : 0.8 }}
                      >
                        {contact.lastMessage || 'Ingen meldinger ennå'}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5}}>
	                        <Chip 
	                          label={contact.type === 'client' ? 'Kunde' : contact.type === 'team' ? 'Team' : 'Support'}
	                          size="small"
	                          variant="outlined"
	                          sx={{ 
	                            fontSize: '0.65rem',
	                            height:  16,
	                            borderColor: getProfessionColor(),
	                            color: getProfessionColor(), '& .MuiChip-label': { px: 0.8, }}}
	                        />
                        
                        <Typography 
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            color: contact.status === 'online' ? '#4CAF50' : 'text.secondary',
                            fontWeight: ontact.status === 'online' ? 600 : 400}}
                        >
                          {contact.status === 'online' ? '● Aktiv' : 
                           contact.status === 'away' ? '● Borte' : '○ Offline'}
                        </Typography>
                      </Box>
                    </Box>
              }
                />
                  </ListItem>
                ))
            ) : (
              // Show connection prompt when not connected
              <Box sx={{ p:  3, textAlign: 'center', opacity: 0.6}}>
                <Typography variant="body2" color="text.secondary">
                  Koble til Google Chat for å se spaces
                </Typography>
              </Box>
            )}
            
            {/* Empty state when connected but no results */}
            {isConnectedToGoogle && [...filteredContacts, ...googleChatSpaces].length === 0 && (
              <Box sx={{
                p:  3,
                textAlign: 'center',
                opacity: 0.6}}>
                <Typography variant="body2" color="text.secondary">
                  {salesMode ? 'Ingen leads eller spaces funnet' : 'Ingen Google Chat spaces funnet'}
                </Typography>
              </Box>
            )}
          </List>
        </Box>

        {/* Chat Area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative'}}>
          {selectedContact ? (
            <>
              {/* Chat Header */}
              <Box sx={{ 
                p: 2,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
        }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap:  2}}>
                  <Avatar src={selectedContact.avatar}>
                    {selectedContact.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" sx={{ ...{ color: theming.colors.primary }}}>{selectedContact.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedContact.email}
                    </Typography>
                    {salesMode && currentLead && (
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5}}>
                        <Chip 
                          label={currentLead.status?.toUpperCase()}
                          size="small"
                          sx={{ 
                            bgcolor: currentLead.status === 'hot' ? '#ff5722' : 
                                    currentLead.status === 'warm' ? '#ff9800' : 
                                    currentLead.status === 'qualified' ? '#4caf50' : '#9e9e90',
                            color: 'white',
                            fontSize: '0.7rem'
                    }}
                        />
                        <Chip 
                          label={`${currentLead.value || 0} NOK`}
                          size="small"
                          variant="outlined"
                          sx={{ 
                            borderColor: getProfessionColor(),
                            color: getProfessionColor(),
                            fontSize: '0.7rem'
                    }}
                        />
                      </Box>
                    )}
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center'}}>
	                  <FormControlLabel
	                    control={
	                      <Switch
	                        checked={salesMode}
	                        onChange={(e) => setSalesMode(e.target.checked)}
	                        sx={{
	                          '& .MuiSwitch-switchBase.Mui-checked': {
	                            color: getProfessionColor(),
	                          }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
	                            backgroundColor: `${getProfessionColor()}40`,
	                          }}}
	                      />
	                    }
                    label={
                      <Typography variant="caption" sx={{ mr:  1 }}>
                        CRM
                      </Typography>
                }
                    labelPlacement="start"
                  />
                  <Tooltip title="Ring">
                    <IconButton>
                      {theming.getThemedIcon('phone')}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Videosamtale">
                    <IconButton>
                      {theming.getThemedIcon('videoCall')}
                    </IconButton>
                  </Tooltip>
                  <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                    {theming.getThemedIcon('moreVert')}
                  </IconButton>
                </Box>
              </Box>

              {/* Modern Communication Tabs */}
              <Box sx={{ 
                p: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
                background: 'linear-gradient(135deg, rgba(2, 5, 5, 255, 255, 0.9), rgba(2, 4, 8, 250, 252, 0.8))',
                backdropFilter: 'blur(10px)'
        }}>
                <Box sx={{ 
                  display: 'flex',
                  bgcolor: 'rgba(0,0,0,0.03)',
                  borderRadius: '16px',
                  p: 0.5,
                  gap: 0.5,
                  position: 'relative'
          }}>
                  {/* Animated background indicator */}
                  <Box sx={{
                    position: 'absolute',
                    top:  4,
                    left: activeTab === 0 ? 4 : activeTab === 1 ? '33.3%' : '66.6%',
                    width: 'calc(33.3% - 4px)',
                    height: 'calc(100% - 8px)',
                    bgcolor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    border: `2px solid ${activeTab === 2 ? '#E91E63' : getProfessionColor()}20`,
                    transition: 'all 0.3s cubic-bezier(0, 0.0, 0.2, 1)',
                    zIndex: 0}} />
                  
                  {/* Chat Tab */}
                  <Box 
                    onClick={() => setActiveTab(0)}
                    sx={{
                      flex:  1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap:  1,
                      py: 1.5,
                      px:  2,
                      cursor: 'pointer',
                      zIndex: 1,
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      color: activeTab === 0 ? getProfessionColor() : 'text.secondary',
	                      fontWeight: ctiveTab === 0 ? 600 : 400, '&:hover': {
	                        color: getProfessionColor(),
	                        transform: activeTab !== 0 ? 'scale(1.02)' : 'none',
	                      }}}
                  >
                    <Chat sx={{ 
                      fontSize:  20,
                      transition: 'all 0.2s ease',
                      transform: activeTab === 0 ? 'scale(1.1)' : 'scale(1)'
              }} />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'inherit',
                        fontSize: '0.95rem'
                }}
                    >
                      Direktemelding
                    </Typography>
                    
                    {/* Unread indicator for chat */}
	                    {activeTab !== 0 && selectedContact?.unreadCount > 0 && (
	                      <Box
	                        sx={{
	                          width: 8,
	                          height: 8,
	                          bgcolor: getProfessionColor(),
	                          borderRadius: '50%',
	                          ml: 0.5,
	                          animation: 'pulse 2s ease-in-out infinite','@keyframes pulse': {
	                            '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 },
	                          }}}
	                      />
	                    )}
                  </Box>

                  {/* Email Tab */}
                  <Box 
                    onClick={() => setActiveTab(1)}
                    sx={{
                      flex:  1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap:  1,
                      py: 1.5,
                      px:  2,
                      cursor: 'pointer',
                      zIndex: 1,
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      color: activeTab === 1 ? getProfessionColor() : 'text.secondary',
	                      fontWeight: ctiveTab === 1 ? 600 : 400, '&:hover': {
	                        color: getProfessionColor(),
	                        transform: activeTab !== 1 ? 'scale(1.02)' : 'none',
	                      }}}
                  >
                    <Email sx={{ 
                      fontSize:  20,
                      transition: 'all 0.2s ease',
                      transform: activeTab === 1 ? 'scale(1.1)' : 'scale(1)'
              }} />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 'inherit',
                        fontSize: '0.95rem'
                }}
                    >
                      E-post
                    </Typography>
                    
                    {/* New email indicator */}
                    {activeTab !== 1 && (
                      <Box sx={{
                        width:  6,
                        height:  6,
                        bgcolor: getProfessionColor(),
                        borderRadius: '50%',
                        ml: 0.5,
                        opacity: 0.6 }} />
                    )}
                  </Box>

                  {/* Evendi Tab */}
                  <Box
                    onClick={() => { setActiveTab(2); if (!evendiConvs.length) fetchEvendiConvsFull(); }}
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      py: 1.5,
                      px: 2,
                      cursor: 'pointer',
                      zIndex: 1,
                      borderRadius: '12px',
                      transition: 'all 0.2s ease',
                      color: activeTab === 2 ? '#E91E63' : 'text.secondary',
                      fontWeight: activeTab === 2 ? 600 : 400,
                      '&:hover': { color: '#E91E63', transform: activeTab !== 2 ? 'scale(1.02)' : 'none' }
                    }}
                  >
                    <img src="/evendi-logo.png" alt="" style={{ width: 20, height: 20, borderRadius: '50%', opacity: activeTab === 2 ? 1 : 0.6 }} />
                    <Typography variant="body2" sx={{ fontWeight: 'inherit', fontSize: '0.95rem' }}>
                      Evendi
                    </Typography>
                  </Box>
                </Box>

                {/* Tab Description */}
                <Typography 
                  variant="caption" 
                  color="text.secondary"
                  sx={{ 
                    display: 'block',
                    textAlign: 'center',
                    mt:  1,
                    fontSize: '0.75rem'
            }}
                >
                  {activeTab === 0 
                    ? 'Sanntids chat med øyeblikkelig levering'
                    : activeTab === 1
                    ? 'Profesjonell e-postkorrespondanse'
                    : 'Meldinger fra par på evendi.no'
              }
                </Typography>
              </Box>

              {/* Messages Area */}
              <Box sx={{ 
                flex: 1,
                overflow: 'auto', 
                p:  2,
                background: 'linear-gradient(135deg, rgba(2, 4, 8, 250, 252, 0.8), rgba(2, 4, 1, 245, 249, 0.6))',
                backgroundImage: `
                  radial-gradient(circle at 25% 2%, rgba(2, 5, 5, 1400.1) 0%, transparent 50%),
                  radial-gradient(circle at 75% 75%, rgba(2, 5, 5, 1400.05) 0%, transparent 50%)
                `
          }}>
                {messages.length === 0 ? (
                  <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    opacity: '0.6'
            }}>
                    <Typography variant="h6" color="text.secondary" sx={{  mb:  1 ,  ...{ color: theming.colors.primary  }}}>
                      Start samtalen
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Send din første melding til {selectedContact.name}
                    </Typography>
                  </Box>
                ) : (
                  messages.map((message, index) => (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: message.senderId === 'current-user' ? 'flex-end' : 'flex-start',
                        mb:  2,
                        animation: 'slideIn 0.3s ease-out','@keyframes slideIn': {
                          from: { opacity: 0,
                            transform: 'translateY(20px)'
                    },
                          to: {
                            opacity: 1,
                            transform: 'translateY(0)'
                    }
                    }
                  }}
                    >
                      {message.senderId !== 'current-user' && (
                        <Avatar 
                          src={selectedContact.avatar}
                          sx={{ 
                            width:  32, 
	                            height:  32, 
	                            mr: 1,
	                            mt:  1,
	                            border: '2px solid white',
	                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                        >
                          {selectedContact.name.charAt(0)}
                        </Avatar>
                      )}
                      
                      <Box sx={{
                        maxWidth: '70%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: message.senderId === 'current-user' ? 'flex-end' : 'flex-start'
                }}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: message.senderId === 'current-user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                            // Photographer messages: Amber background with white text
                            // Client messages: Keep current white background styling
                            bgcolor: message.senderId === 'current-user' 
                              ? 'linear-gradient(135deg, #FF8F00, #FFB300)' // Amber gradient for photographer
                              : 'white', // White background for clients
                            color: message.senderId === 'current-user' 
                              ? 'white' // White text for photographer on amber background
                              : 'text.primary', // Keep current text color for clients
                            boxShadow: message.senderId === 'current-user' 
                              ? '0 4px 12px rgba(255, 143, 0, 0.3)' // Amber shadow for photographer
                              : '0 2px 8px rgba(0,0,0,0.08)', // Keep current shadow for clients
                            border: message.senderId === 'current-user' ? 'none' : '1px solid rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: message.senderId === 'current-user' 
                                ? '0 6px 16px rgba(255, 143, 0, 0.4)' // Enhanced amber shadow on hover
                                : '0 4px 12px rgba(0,0,0,0.12)'
                            },
                            ...theming.getThemedCardSx()
                          }}>
                          <Typography variant="body1" sx={{ 
                            lineHeight: 1.4,
                            wordBreak: 'break-word',
                            fontSize: '0.95rem'
                    }}>
                            {message.content}
                          </Typography>
                          
                          {/* Message status indicators for sent messages */}
                          {message.senderId === 'current-user' && (
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'flex-end',
                              mt: 0.5,
                              gap: 0.5}}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  opacity: 0.8,
                                  fontSize: '0.75rem'
                          }}
                              >
                                {formatTime(message.timestamp)}
                              </Typography>
                              {/* Status check marks */}
                              <Box sx={{
                                display: 'flex','& svg': {
                                  fontSize: '14px',
                                  opacity: 0.8 }
                          }}>
                                {message.status === 'delivered' && (
                                  <>
                                    <Typography sx={{ fontSize: '12px', ml: 0.5}}>✓</Typography>
                                    <Typography sx={{ fontSize: '12px', ml: -0.3}}>✓</Typography>
                                  </>
                                )}
                                {message.status === 'read' && (
                                  <Box sx={{ color: '#4CAF50'}}>
                                    <Typography sx={{ fontSize: '12px', ml: 0.5}}>✓</Typography>
                                    <Typography sx={{ fontSize: '12px', ml: -0.3}}>✓</Typography>
                                  </Box>
                                )}
                                {message.status === 'sent' && (
                                  <Typography sx={{ fontSize: '12px', ml: 0.5}}>✓</Typography>
                                )}
                              </Box>
                            </Box>
                          )}
                          
                          {/* Timestamp for received messages */}
                          {message.senderId !== 'current-user' && (
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                opacity: 0.6,
                                display: 'block',
                                textAlign: 'left',
                                mt: 0.5,
                                fontSize: '0.75rem'
                        }}
                            >
                              {formatTime(message.timestamp)}
                            </Typography>
                          )}
                        </Paper>

                        {/* Show "typing..." indicator */}
                        {index === messages.length - 1 && message.senderId !== 'current-user' && (
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            mt:  1,
                            opacity: 0.6,
                            animation: 'pulse 2s infinite'
                    }}>
                            <Typography variant="caption" sx={{ fontStyle: 'italic'}}>
                              {selectedContact.name} skriver...
                            </Typography>
                          </Box>
                        )}
                      </Box>

	                      {message.senderId === 'current-user' && (
	                        <Avatar 
	                          sx={{ 
	                            width:  32, 
	                            height:  32, 
	                            ml: 1,
	                            mt:  1,
	                            bgcolor: getProfessionColor(),
	                            border: '2px solid white',
	                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
	                      }}
	                        >
  
                        </Avatar>
                      )}
                    </Box>
                  ))
                )}
                <div ref={messagesEndRef} />
              </Box>

              {/* Evendi Chat Bridge - Tab 2 */}
              {activeTab === 2 && (
                <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                  {evendiBusy && !evendiConvs.length ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Laster Evendi-samtaler...</Typography>
                    </Box>
                  ) : selEvendiConv ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <IconButton size="small" onClick={() => { setSelEvendiConv(null); setEvendiMsgs([]); }}>
                          <Close fontSize="small" />
                        </IconButton>
                        <img src="/evendi-logo.png" alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {evendiConvs.find((c: any) => c.id === selEvendiConv)?.couple_name || 'Samtale'}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
                        {evendiMsgs.map((msg: any) => (
                          <Box key={msg.id} sx={{ display: 'flex', justifyContent: msg.sender_type === 'vendor' ? 'flex-end' : 'flex-start', mb: 1 }}>
                            <Paper elevation={0} sx={{
                              p: 1.5, maxWidth: '75%', borderRadius: 2,
                              bgcolor: msg.sender_type === 'vendor' ? '#E91E63' : '#f5f5f5',
                              color: msg.sender_type === 'vendor' ? 'white' : 'text.primary'
                            }}>
                              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{msg.body}</Typography>
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7, textAlign: 'right' }}>
                                {new Date(msg.created_at).toLocaleString('nb-NO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                              </Typography>
                            </Paper>
                          </Box>
                        ))}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          fullWidth size="small" placeholder="Skriv svar..."
                          value={evendiInput}
                          onChange={(e) => setEvendiInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEvendiMsgFull(); } }}
                        />
                        <IconButton
                          onClick={sendEvendiMsgFull}
                          disabled={!evendiInput.trim()}
                          sx={{ bgcolor: '#E91E63', color: 'white', '&:hover': { bgcolor: '#C2185B' }, '&:disabled': { bgcolor: 'grey.300' } }}
                        >
                          <Send sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  ) : (
                    <Box>
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fce4ec', borderRadius: 2, border: '1px solid #E91E6330' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <img src="/evendi-logo.png" alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#880E4F' }}>Evendi Meldinger</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Chat med par fra evendi.no — leveransevarsler, meldinger og mer
                        </Typography>
                      </Box>
                      {evendiConvs.length > 0 ? (
                        <List sx={{ p: 0 }}>
                          {evendiConvs.map((conv: any) => (
                            <ListItem key={conv.id} component="div" onClick={() => fetchEvendiMsgsFull(conv.id)}
                              sx={{ cursor: 'pointer', borderRadius: 1, mb: 0.5, '&:hover': { bgcolor: '#fce4ec' },
                                borderLeft: conv.vendor_unread_count > 0 ? '3px solid #E91E63' : 'none' }}>
                              <ListItemAvatar>
                                <Avatar sx={{ bgcolor: '#fce4ec', width: 36, height: 36 }}>
                                  <img src="/evendi-logo.png" alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{conv.couple_name || 'Par'}</Typography>}
                                secondary={
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                                      {conv.last_message_sender === 'vendor' ? 'Du: ' : ''}{conv.last_message || 'Ingen meldinger'}
                                    </Typography>
                                    {conv.vendor_unread_count > 0 && (
                                      <Chip label={conv.vendor_unread_count} size="small" sx={{ bgcolor: '#E91E63', color: 'white', height: 18, fontSize: '0.7rem' }} />
                                    )}
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">Ingen Evendi-samtaler ennå</Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* Email Composer - Only for Email Tab */}
              {activeTab === 1 ? (
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider'}}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Melding"
                    placeholder="Skriv din e-post her..."
                    variant="outlined"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    sx={{ mb:  2 }}
                  />
                  
	                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
	                    <Typography variant="caption" color="text.secondary">
	                      E-post sendes via Gmail-integrasjon
	                    </Typography>
	                    <Button
	                      variant="contained"
	                      startIcon={theming.getThemedIcon('email')}
	                      onClick={handleSendMessage}
	                      disabled={!messageInput.trim() || sendEmailMutation.isPending}
	                      sx={{
	                        ...theming.getThemedButtonSx(),
	                        bgcolor: getProfessionColor(), '&:hover': { bgcolor: getProfessionColor() }}}
	                    >
                      {sendEmailMutation.isPending ? 'Sender...' : 'Send E-post'}
                    </Button>
                  </Box>
                </Box>
              ) : null}

              {/* Dynamic Input Area - Adapts to Active Tab */}
              {(activeTab === 0) && (
                <Box sx={{ 
                  p: 2,
                  borderTop: 1,
                  borderColor: 'divider',
                  background: 'linear-gradient(135deg, rgba(2, 5, 5, 255, 255, 0.9), rgba(2, 4, 8, 250, 252, 0.8))',
                  backdropFilter: 'blur(10px)'
          }}>
                  {/* Admin Quick Actions - Only visible for admin */}
                  {isAdmin && selectedContact && (
                    <Box sx={{ mb:  2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#ff8c00'}}>
                          <AdminPanelSettings sx={{ fontSize:  16, mr: 0.5}} />
                          Admin Hurtighandlinger
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setAdminTemplatesOpen(true)}
                          sx={{ 
                            borderColor: '#ff8c00', 
                            color: '#ff8c00','&:hover': { borderColor: '#e67e00', bgcolor: '#ff8c0010',}
                      }}
                        >
                          Meldingsmaler
                        </Button>
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb:  2 }}>
                        {adminQuickActions.map((action, index) => (
                          <Button key={index}
                            size="small"
                            variant="contained"
                            startIcon={action.icon}
                            onClick={() => {
                              const message = action.action(selectedContact.name);
                              setMessageInput(message);
                        }}
                            sx={{
                              bgcolor: '#ff8c00',
                              color: 'white','&:hover': { bgcolor: '#e67e00' },
                              fontSize: '0.75rem',
                              px:  1,
                              py: 0.5 }}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </Box>

                      {/* Advanced Admin Functions */}
                      <Box sx={{ borderTop: 1, borderColor: 'divider', pt:  2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#ff6b60', mb:  1 }}>
                          🚀 Avanserte Admin Funksjoner
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap'}}>
                          {adminAdvancedActions.map((action, index) => (
                            <Button
                              key={index}
                              size="small"
                              variant="outlined"
                              startIcon={action.icon}
                              onClick={action.action}
                              sx={{
                                borderColor: '#ff6b60',
                                color: '#ff6b60','&:hover': { 
                                  borderColor: '#', 
                                  bgcolor: '#ff6b6b10',
                                  transform: 'translateY(-1px)'
                          },
                                fontSize: '0.75rem',
                                px:  1,
                                py: 0.5}}
                            >
                              <Box sx={{ textAlign: 'left'}}>
                                <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                                  {action.label}
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block', opacity: 0.8}}>
                                  {action.description}
                                </Typography>
                              </Box>
                            </Button>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  )}

                  {/* Quick Message Templates */}
                  <QuickMessageTemplates
                    onSelectTemplate={(msg) => handleMessageInputChange(msg)}
                    profession={userProfession}
                    storageKey={`quick-msg-fullscreen-${user?.id || 'anon'}`}
                  />

	                  <Box sx={{ 
	                    position: 'relative',
	                    borderRadius: '24px',
	                    bgcolor: 'white',
	                    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
	                    border: '1px solid rgba(0,0,0,0.05)'
	              }}>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={4}
                      placeholder={activeTab === 0 ? "Skriv en direktemelding..." : "Skriv e-post innhold..."}
                      value={messageInput}
                      onChange={(e) => handleMessageInputChange(e.target.value)}
                      onKeyDown={handleKeyPress}
                      variant="outlined"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '24px','& fieldset': {
                            border: 'none',
                          }, '&:hover fieldset': {
                            border: 'none',
                          }, '&.Mui-focused fieldset': {
                            border: `2px solid ${getProfessionColor()}`,
                            boxShadow: `0 0 0 3px ${getProfessionColor()}20`,
                          }, '& .MuiInputBase-input': {
                            py: 1.5,
                            px: 2,
                            fontSize: '0.95rem','&::placeholder': {
                              color: 'text.secondary',
                              opacity: 0.7,
                            },
                          },
                        }}}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start" sx={{ ml: 1 }}>
                            <Tooltip title="Legg ved fil">
                              <IconButton 
                                size="small"
                                sx={{ 
                                  color: 'text.secondary','&:hover': { 
                                    bgcolor: `${getProfessionColor()}10`,
                                    color: getProfessionColor()
                            }
                            }}
                              >
                                <AttachFile />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end" sx={{ mr: 0.5}}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5}}>
                              {/* CRM Help Indicator - Shows when user might need help responding */}
                              {showHelpIndicator && needsHelpMessage && (
                                <Tooltip title={`Trenger du hjelp med å svare på: "${needsHelpMessage.content.slice(0, 50)}..."?`}>
                                  <IconButton 
                                    onClick={analyzeCustomerMessages}
                                    size="small"
	                                    sx={{ 
	                                      bgcolor: `${getProfessionColor()}15`,
	                                      color: getProfessionColor(),
	                                      border: `1px solid ${getProfessionColor()}40`,
	                                      animation: 'pulse 2s ease-in-out infinite','&:hover': { 
	                                        bgcolor: `${getProfessionColor()}25`,
	                                        transform: 'scale(1.05)',
	                                      }, '@keyframes pulse': {
	                                        '0%, 100%': { opacity: 1, transform: 'scale(1)' }, '50%': { opacity: 0, transform: 'scale(1.02)' },
	                                      }}}
                                  >
                                    🤖
                                  </IconButton>
                                </Tooltip>
                              )}

                              <Tooltip title="Emoji">
                                <IconButton 
                                  size="small"
                                  sx={{ 
                                    color: 'text.secondary','&:hover': { 
                                      bgcolor: `${getProfessionColor()}10`,
                                      color: getProfessionColor()
                              }
                              }}
                                >
                                  <EmojiEmotions />
                                </IconButton>
                              </Tooltip>
                              
                              <Tooltip title={
                                sendMessageMutation.isPending || sendEmailMutation.isPending 
                                  ? (activeTab === 0 ? 'Sender melding...' : 'Sender e-post...')
                                  : (activeTab === 0 ? 'Send direktemelding' : 'Send e-post')
                          }>
                                <span>
                                  <IconButton 
                                    onClick={handleSendMessage}
                                    disabled={!messageInput.trim() || sendMessageMutation.isPending || sendEmailMutation.isPending}
                                    sx={{ 
                                      width:  36,
	                                      height: 36,
	                                      bgcolor: messageInput.trim() ? getProfessionColor() : 'grey.300',
	                                      color: 'white',
	                                      transition: 'all 0.2s ease',
	                                      position: 'relative','&:hover': {
	                                        bgcolor: messageInput.trim() ? getProfessionColor() : 'grey.300',
	                                        transform: messageInput.trim() ? 'scale(1.05)' : 'none',
	                                        boxShadow: messageInput.trim() ? `0 4px 12px ${getProfessionColor()}40` : 'none',
	                                      }, '&:disabled': {
	                                        bgcolor: 'grey.300',
	                                        color: 'white',
	                                        boxShadow: 'none',
	                                        transform: 'none',
	                                      }}}
                                  >
                                    {(sendMessageMutation.isPending || sendEmailMutation.isPending) ? (
                                      <Box
                                        sx={{
                                          width:  16,
                                          height:  16,
                                          border: '2px solid white',
                                          borderTop: '2px solid transparent',
	                                          borderRadius: '50%',
	                                          animation: 'spin 1s linear infinite','@keyframes spin': {
	                                            '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' },
	                                          }}}
                                      />
                                    ) : activeTab === 0 ? (
                                      <Send sx={{ fontSize: 18}} />
                                    ) : (
                                      <Email sx={{ fontSize: 18}} />
                                    )}

                                    {/* Quick action indicator */}
                                    {messageInput.trim() && (
                                      <Box sx={{
                                        position: 'absolute',
                                        top: -2,
                                        right: -2,
                                        width:  8,
                                        height:  8,
                                        bgcolor: activeTab === 0 ? '#4CAF50' : '#',
                                        borderRadius: '50, %',
                                        border: '1px solid white'
                                }} />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Box>
                          </InputAdornment>
                        )
                  }}
                    />
                  </Box>
                  
                  {/* Quick actions */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mt:  1,
                    px: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Trykk Enter for å sende • Shift+Enter for ny linje
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 0.5}}>
	                      <Chip
	                        label="Aktiv"
	                        size="small"
	                        sx={{
	                          fontSize: '0.65rem',
	                          height:  18,
	                          bgcolor: getProfessionColor(),
	                          color: 'white','& .MuiChip-label': { px: 0.8, }}}
	                      />
                      <Typography variant="caption" color="text.secondary">
                        {selectedContact.name}
                      </Typography>
                    </Box>
                  </Box>

                  {/* CRM Response Suggestions */}
                  {showSuggestions && analyzeMessageMutation.data && (
	                    <Box sx={{ 
	                      mt: 2,
	                      p: 2,
	                      bgcolor: 'rgba(25, 255, 255, 0.95)',
	                      borderRadius:  2,
	                      border: `1px solid ${getProfessionColor()}30`,
	                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
	                }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
                        <Typography variant="h6" sx={{  color: getProfessionColor(), fontWeight: 600}}>
                          🤖 CRM Forslag til svar
                        </Typography>
                        <IconButton size="small" onClick={() => setShowSuggestions(false)}>
                          {theming.getThemedIcon('close')}
                        </IconButton>
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                        Smart analyse av kundens melding: "{needsHelpMessage?.content?.slice, (80)}..."
                      </Typography>

                      {analyzeMessageMutation.data.suggestions?.map((suggestion: any, index: number) => (
                        <Paper
                          key={suggestion.d}
                          sx={{
                            p:  2,
                            mb: 1.5,
                            cursor: 'pointer',
                            border: '1px solid transparent',
                            transition: 'all 0.2s ease','&:hover': {
                              borderColor: getProfessionColor(),
                              boxShadow: `0 2px 8px ${getProfessionColor()}20`,
                              transform: 'translateY(-1px)'
                      }
                      }}
                          onClick={() => {
                            setMessageInput(suggestion.content);
                            setShowSuggestions(false);
                      }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip 
                              label={suggestion.category || 'Generelt'}
                              size="small" 
                              sx={{ 
                                bgcolor: `${getProfessionColor()}15`,
                                color: getProfessionColor(),
                                fontSize: '0.7rem'
                        }}
                            />
                            <Chip 
                              label={`${Math.round(suggestion.confidence * 100)}% sikker`}
                              size="small" 
                              variant="outlined"
                              sx={{ fontSize: '0.7rem'}}
                            />
                            <Chip 
                              label={suggestion.tone || 'Vennlig'}
                              size="small" 
                              color="success"
                              sx={{ fontSize: '0.7rem'}}
                            />
                          </Box>
                          
                          <Typography variant="body2" sx={{ lineHeight: 1.5}}>
                            {suggestion.content}
                          </Typography>
                          
                          {suggestion.includesFollowUp && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt:  1 }}>
                              ✨ Inkluderer oppfølgingsspørsmål
                            </Typography>
                          )}
                        </Paper>
                      ))}

                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt:  1 }}>
                        Klikk på et forslag for å bruke det som mal
                      </Typography>
                    </Box>
                  )}

                  {/* CRM Loading State */}
                  {analyzeMessageMutation.isPending && (
                    <Box sx={{ 
                      mt: 2,
                      p:  3, 
                      bgcolor: 'rgba(25, 255, 255, 0.95)',
                      borderRadius:  2,
                      border: `1px solid ${getProfessionColor()}30`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2}}>
                      <Box
                        sx={{
                          width:  20,
                          height:  20,
                          border: `2px solid ${getProfessionColor()}`,
                          borderTop: '2px solid transparent',
	                          borderRadius: '50%',
	                          animation: 'spin 1s linear infinite','@keyframes spin': {
	                            '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' },
	                          }}}
                      />
                      <Typography variant="body2" color="text.secondary">
                        🤖 Analyserer kundens melding og genererer smarte svar-forslag...
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </>
          ) : (
            // No Contact Selected
            <Box sx={{ 
              flex: 1,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2 }}>
              <Box sx={{ 
                width: 10, 
                height: 10, 
                borderRadius: '50, %',
                bgcolor: `${getProfessionColor()}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
        }}>
                <Person sx={{ fontSize:  60, color: getProfessionColor()}} />
              </Box>
              <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
                Velg en samtale for å starte chatting
              </Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Kommuniser med kunder, team og support direkte fra dashboardet ditt
              </Typography>
            </Box>
          )}
        </Box>

        {/* Contact Info Sidebar */}
        {showContactInfo && selectedContact && (
          <Box sx={{ 
            width: 30, 
	            borderLeft: 1,
	            borderColor: 'divider',
            p: 2 }}>
            <Box sx={{ textAlign: 'center', mb:  3 }}>
              <Avatar 
                src={selectedContact.avatar}
                sx={{ width:  80, height:  80, mx: 'auto', mb:  2 }}
              >
                {selectedContact.name.charAt(0)}
              </Avatar>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>{selectedContact.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedContact.email}
              </Typography>
              <Chip 
                label={selectedContact.type}
                size="small" 
                sx={{ mt: 1, bgcolor: `${getProfessionColor()}20` }}
              />
            </Box>

            <List>
              <ListItem>
                <ListItemText primary="Vis profil" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Dempet" />
              </ListItem>
              <ListItem>
                <ListItemText primary="Blokkér kontakt" />
              </ListItem>
            </List>
          </Box>
        )}

        {/* Sales CRM Panel - Right Sidebar */}
        {salesMode && (
          <Box sx={{
            width: 30,
            borderLeft:  1,
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default'
    }}>
            <Box sx={{
              p:  2,
              borderBottom:  1,
              borderColor: 'divider',
              bgcolor: getProfessionColor() ,
              color: 'white'
      }}>
              <Typography variant="h6" sx={{  fontWeight: 600}}>
                💼 Smart CRM
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9}}>
                Analyserer kundemeldinger
              </Typography>
              {analyzeMessageMutation.isPending && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt:  1}}>
                  <Box 
                    sx={{ 
                      width:  8, 
                      height:  8, 
                      borderRadius: '50%', 
                      bgcolor: '#', 
                      mr:  1,
                      animation: 'pulse 1.5s infinite' 
              }}
                  />
                  <Typography variant="caption" sx={{ opacity: 0.8}}>
                    Genererer forslag...
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Box sx={{ flex: 1, overflow: 'auto', p:  1 }}>
              {responseSuggestions?.suggestions?.length > 0 ? (
                <>
                  <Box sx={{ p: 1, mb: 1, bgcolor: `${getProfessionColor()}10`, borderRadius:  1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: getProfessionColor()}}>
                      📋 {responseSuggestions.suggestions.length} smarte forslag basert på kundens melding
                    </Typography>
                  </Box>
                  {responseSuggestions.suggestions.map((suggestion: any, index: number) => (
                    <Paper
                      key={index}
                      sx={{
                        p: 1.5,
                        mb: 1.5,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
	                        border: `1px solid ${getProfessionColor()}20`, '&:hover': {
	                          bgcolor: `${getProfessionColor()}08`,
	                          transform: 'translateY(-2px)',
	                          boxShadow: 2,
	                        }}}
                      onClick={() => setMessageInput(suggestion.content)}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb:  1}}>
                        <Chip
                          label={suggestion.category}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontSize: '0.7rem', fontWeight: 600}}
                        />
                        <Chip
                          label={`${Math.round(suggestion.confidence * 100)}%`}
                          size="small"
                          sx={{ 
                            fontSize: '0.7rem',
                            bgcolor: suggestion.confidence > 0.8 ? '#4CAF50' : suggestion.confidence > 0.6 ? '#FF9800' : '#9E9E90',
                            color: 'white'
                    }}
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.85rem',
                          lineHeight: 1.4,
	                          display: '-webkit-box',
	                          WebkitLineClamp: 3,
	                          WebkitBoxOrient: 'vertical',
	                          overflow: 'hidden'}}
                      >
                        {suggestion.content}
                      </Typography>
                      {suggestion.tone && (
                        <Typography
                          variant="caption"
                          sx={{ 
                            display: 'block', 
                            mt: 1,
                            fontStyle: 'italic',
                            color: 'text.secondary'
                    }}
                        >
                          Tone: {suggestion.tone}
                        </Typography>
                      )}
                      {suggestion.estimatedPrice && (
                        <Typography
                          variant="caption"
                          color="primary"
                          sx={{ display: 'block', mt: 1, fontWeight: 600}}
                        >
                          Foreslått pris: {suggestion.estimatedPrice.toLocaleString('')} NOK
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </>
              ) : (
                <Box sx={{ p:  3, textAlign: 'center'}}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb:  1}}>
                    🤖 Venter på kundemeldinger
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    CRM-systemet analyserer automatisk kundens meldinger og gir deg smarte svar-forslag
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* More Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={() => setShowContactInfo(!showContactInfo)}>
            <Info sx={{ mr:  1 }} /> Kontaktinfo
          </MenuItem>
          <MenuItem>
            <Archive sx={{ mr:  1 }} /> Arkivér chat
          </MenuItem>
          <MenuItem>
            <Delete sx={{ mr:  1 }} /> Slett chat
          </MenuItem>
        </Menu>

        {/* Google Chat Actions Menu - Using Popover for better Dialog compatibility */}
        <Popover
          id="google-chat-popover"
          open={Boolean(googleChatMenuAnchor)}
          anchorEl={googleChatMenuAnchor}
          onClose={() => {
            console.log('Google Chat menu closing via Popover');
            setGoogleChatMenuAnchor(null);
      }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'}}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left'}}
	      sx={{
	        zIndex: 999, '& .MuiPopover-paper': {
		          border: `2px solid ${getProfessionColor()}`,
		          borderRadius:  2,
		          mt:  1,
		          minWidth: 20,
		          maxWidth: 30,
		          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
		          backdropFilter: 'blur(8px)',
		          bgcolor: 'background.paper'
	      }
	  }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1}}>
              <Google sx={{ color: getProfessionColor()}} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                Google Chat Professional
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Advanced collaboration tools for {(professionConfig as any)?.displayName || userProfession}
            </Typography>
          </Box>
          
          <List sx={{ py:  0}}>
            <ListItem
              onClick={() => {
                console.log('🚀 Creating test project space...');
                handleCreateProjectSpace();
                setGoogleChatMenuAnchor(null);
          }}
	              sx={{ 
	                py: 1.5, '&:hover': {
	                  bgcolor: `${getProfessionColor()}20`,
	                }}}
            >
              <ListItemIcon>
                <Add sx={{ color: getProfessionColor()}} />
              </ListItemIcon>
              <ListItemText 
                primary="🚀 Opprett: Bryllup Anna & Lars" 
                secondary="Opprett Google Chat space for prosjektsamarbeid"
              />
            </ListItem>
            
            <ListItem
              onClick={() => {
                console.log('Join space clicked');
                setGoogleChatMenuAnchor(null);
        }}
              sx={{ py: 1.5}}
            >
              <ListItemIcon>
                <PersonAdd sx={{ color: getProfessionColor()}} />
              </ListItemIcon>
              <ListItemText primary="Join Space" />
            </ListItem>
            
            <ListItem
              onClick={() => {
                console.log('Sync CRM clicked');
                setGoogleChatMenuAnchor(null);
          }}
              sx={{ py: 1.5}}
            >
              <ListItemIcon>
                <Sync sx={{ color: getProfessionColor()}} />
              </ListItemIcon>
              <ListItemText primary="Sync CRM Contacts" />
            </ListItem>
            
            <ListItem
              onClick={async () => {
                console.log('Testing Google Chat API...');
                await testGoogleChat();
                setGoogleChatMenuAnchor(null);
          }}
	              sx={{ 
	                py: 1.5, '&:hover': {
	                  bgcolor: `${getProfessionColor()}20`,
	                }}}
            >
              <ListItemIcon>
                <Speed sx={{ color: getProfessionColor()}} />
              </ListItemIcon>
              <ListItemText 
                primary="Test Google Chat API" 
                secondary={`Status: ${communicationStatus.googleChatStatus === 'connected' ? 'Connected' : 'Disconnected'}`}
              />
            </ListItem>
            <ListItem
              onClick={() => {
                console.log('Chat settings clicked');
                setGoogleChatMenuAnchor(null);
          }}
              sx={{ py: 1.5}}
            >
              <ListItemIcon>
                <Settings sx={{ color: getProfessionColor()}} />
              </ListItemIcon>
              <ListItemText primary="Chat Settings" />
            </ListItem>
          </List>
        </Popover>

        {/* Admin Message Templates Dialog - Only for admin */}
        {isAdmin && (
          <Dialog
            open={adminTemplatesOpen}
            onClose={() => setAdminTemplatesOpen(false)}
            maxWidth="md"
            fullWidth
            sx={{
	              zIndex: 999,
	              '& .MuiDialog-paper': {
	                borderRadius: 3,
	                border: '2px solid #ff8c00',
	                boxShadow: '0 20px 60px rgba(25, 15, 0.3)',
	              }}}
          >
            <DialogTitle sx={{ 
              bgcolor: '#ff8c00', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1}}>
              <AdminPanelSettings />
              Admin Meldingsmaler
              <Box sx={{ flexGrow:  1}} />
              <IconButton 
                onClick={() => setAdminTemplatesOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  0 }}>
              {adminMessageTemplates.map((category, catIndex) => (
                <Box key={catIndex}>
                  <Box sx={{ 
                    p: 2,
                    bgcolor: '#', 
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1}}>
                    {category.icon}
                    <Typography variant="h6" sx={{  fontWeight: 600}}>
                      {category.category}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ p:  2}}>
                    {category.templates.map((template, templateIndex) => (
                      <Paper
                        key={templateIndex}
                        sx={{ 
                          p: 2,
                          mb: 1,
                          cursor: 'pointer',
                          border: '1px solid #',
                          transition: 'all 0.2s ease','&:hover': {
                            bgcolor: '#ff8c001',
                            borderColor: '#ff8c00',
                            transform: 'translateY(-1px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }
                    }}
                        onClick={() => {
                          setMessageInput(template);
                          setAdminTemplatesOpen(false);
                    }}
                      >
                        <Typography variant="body2">
                          {template}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color="primary" 
                          sx={{ 
                            display: 'block', 
                            mt: 1,
                            fontWeight: 60
                           , opacity: 0.8 }}
                        >
                          Klikk for å bruke dette template
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              ))}
              
              <Box sx={{ p: 2, bgcolor: '#f9f9f9'}}>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center'}}>
                  <Security sx={{ fontSize:  16, mr: 0.5}} />
                  Kun tilgjengelig for administratorer
                </Typography>
              </Box>
            </DialogContent>
          </Dialog>
        )}

        {/* Broadcast Modal - Massekommunikasjon */}
        {isAdmin && (
          <Dialog
            open={broadcastModalOpen}
            onClose={() => setBroadcastModalOpen(false)}
            maxWidth="lg"
            fullWidth
            sx={{
	              zIndex: 999,
	              '& .MuiDialog-paper': {
	                borderRadius: 3,
	                border: '2px solid #ff6b60',
	                boxShadow: '0 20px 60px rgba(25, 107, 107, 0.3)',
	              }}}
          >
            <DialogTitle sx={{ 
              bgcolor: '#ff6b60', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1}}>
              <Broadcast />
              📢 Massekommunikasjon - Broadcast System
              <Box sx={{ flexGrow:  1 }} />
              <IconButton 
                onClick={() => setBroadcastModalOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  3}}>
              <Box sx={{ display: 'flex', gap:  3}}>
                {/* Left side - Broadcast options */}
                <Box sx={{ flex:  1 }}>
                  <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                    Velg målgruppe
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                    <Button variant="contained"
                      startIcon={<Groups />}
                      fullWidth
                      sx={{ 
                        bgcolor: '#ff6b60', 
                        justifyContent: 'flex-start',
	                        py: 2, '&:hover': { bgcolor: '#ff5252' }}}
                    >
                      <Box sx={{ textAlign: 'left'}}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                          🌍 Alle Brukere
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.9}}>
                          Send til hele plattformen (ca. 1,247 brukere)
                        </Typography>
                      </Box>
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<PersonOutline />}
                      fullWidth
                      sx={{ 
                        borderColor: '#ff6b60',
                        color: '#ff6b60',
                        justifyContent: 'flex-start',
	                        py: 2, '&:hover': { borderColor: '#ff6b60', bgcolor: '#ff6b6b10' }}}
                    >
                      <Box sx={{ textAlign: 'left'}}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                          📸 Kun Fotografer
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.8}}>
                          Send til alle fotografer (542 brukere)
                        </Typography>
                      </Box>
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<PersonOutline />}
                      fullWidth
                      sx={{ 
                        borderColor: '#ff6b60',
                        color: '#ff6b60',
                        justifyContent: 'flex-start',
	                        py: 2, '&:hover': { borderColor: '#ff6b60', bgcolor: '#ff6b6b10' }}}
                    >
                      <Box sx={{ textAlign: 'left'}}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                          🎥 Kun Videografere
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.8}}>
                          Send til alle videografere (398 brukere)
                        </Typography>
                      </Box>
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={<PersonOutline />}
                      fullWidth
                      sx={{ 
                        borderColor: '#ff6b60',
                        color: '#ff6b60',
                        justifyContent: 'flex-start',
	                        py: 2, '&:hover': { borderColor: '#ff6b60', bgcolor: '#ff6b6b10' }}}
                    >
                      <Box sx={{ textAlign: 'left'}}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                          🎵 Kun Musikkprodusenter
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.8}}>
                          Send til alle musikkprodusenter (187 brukere)
                        </Typography>
                      </Box>
                    </Button>

                    <Button
                      variant="outlined"
                      startIcon={theming.getThemedIcon('star')}
                      fullWidth
                      sx={{ 
	                        borderColor: '#FFD700',
	                        color: '#FFD700',
                        justifyContent: 'flex-start',
	                        py: 2, '&:hover': { borderColor: '#FFD700', bgcolor: '#FFD70010' }}}
                    >
                      <Box sx={{ textAlign: 'left'}}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                          ⭐ Kun Premium Brukere
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.8}}>
                          Send til premium-abonnenter (89 brukere)
                        </Typography>
                      </Box>
                    </Button>
                  </Box>
                </Box>

                {/* Right side - Message compose */}
                <Box sx={{ flex:  1}}>
                  <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                    Skriv melding
                  </Typography>
                  
                  <TextField
                    fullWidth
                    multiline
                    rows={8}
                    label="Broadcast Melding"
                    placeholder="Skriv din systemmelding her..."
                    variant="outlined"
                    sx={{ mb:  2}}
                  />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  2}}>
                    <FormControlLabel
	                      control={<Switch color="primary" />}
                      label="Tidsplanlagt sending"
                    />
                    <Button
                      startIcon={theming.getThemedIcon('schedule')}
                      size="small"
                      variant="outlined"
                    >
                      Velg tid
                    </Button>
                  </Box>

                  <Box sx={{ bgcolor: '#', p: 2, borderRadius: 2, mb:  2}}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb:  1}}>
                      📊 Forventet leveranse
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Push-notifikasjoner: Øyeblikkelig
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • E-post: 2-5 minutter
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • SMS (premium): 1-2 minutter
                    </Typography>
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    size="large"
                    startIcon={<Broadcast />}
                    sx={{ 
                      bgcolor: '#ff6b60',
	                      py: 1.5, '&:hover': { bgcolor: '#ff5252' }}}
                  >
                    📢 Send Broadcast Melding
                  </Button>
                </Box>
              </Box>
            </DialogContent>
          </Dialog>
        )}

        {/* Chat Statistics Modal */}
        {isAdmin && (
          <Dialog
            open={chatStatsOpen}
            onClose={() => setChatStatsOpen(false)}
            maxWidth="xl"
            fullWidth
	            sx={{
	              zIndex: 999,
	              '& .MuiDialog-paper': {
	                borderRadius: 3,
	                border: '2px solid #08cdc4',
	                boxShadow: '0 20px 60px rgba(8, 205, 196, 0.3)',
	                minHeight: '80vh',
	              }}}
          >
            <DialogTitle sx={{ 
	              bgcolor: '#08cdc4', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1}}>
              {theming.getThemedIcon('analytics')}
              📊 Chat Statistikk & Analyse
              <Box sx={{ flexGrow:  1}} />
              <IconButton 
                onClick={() => setChatStatsOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  3}}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap:  3 }}>
                {/* Overview Cards */}
                <Paper sx={{ p:  3, border: '1px solid #e0e0e0', borderRadius:  2,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                    📈 Oversikt i dag
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography>Totale meldinger: </Typography>
                      <Typography sx={{ fontWeight: 600}}>15,742</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography>Aktive brukere: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#4CAF50'}}>1,247</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography>Gj.snitt responstid: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#ff8c00'}}>2.3 min</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography>Tilfredshet score: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#FFD700'}}>4.7/5 ⭐</Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Message Volume */}
                <Paper sx={{ p:  3, border: '1px solid #ff6b60', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#ff6b60', fontWeight: 600}}>
                    💬 Meldingsvolum
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography>I dag: </Typography>
                      <Typography sx={{ fontWeight: 600}}>342</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography>I går: </Typography>
                      <Typography sx={{ fontWeight: 600}}>298</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography>Denne uken: </Typography>
                      <Typography sx={{ fontWeight: 600}}>2,156</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography>Forrige uke: </Typography>
                      <Typography sx={{ fontWeight: 600}}>1,987</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', mt:  1}}>
                      <Typography sx={{ color: '#4CAF50', fontWeight: 600}}>
                        📈 +8.5% vekst
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* User Activity */}
                <Paper sx={{ p:  3, border: '1px solid #e0e0e0', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                    👥 Brukeraktivitet
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography>🟢 Online: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#4CAF50'}}>89</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography>🟡 Borte: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#ff8c00'}}>156</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography>⚫ Offline: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#757575'}}>1,002</Typography>
                    </Box>
                    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1, mt: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography sx={{ fontWeight: 600}}>Total: </Typography>
                        <Typography sx={{ fontWeight: 600}}>1,247</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Paper>

                {/* Sentiment Analysis */}
                <Paper sx={{ p:  3, border: '1px solid #e0e0e0', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                    😊 Sentiment Analyse
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography>😊 Positive: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#4CAF50'}}>68%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography>😐 Nøytrale: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#ff8c00'}}>24%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography>😞 Negative: </Typography>
                      <Typography sx={{ fontWeight: 600, color: '#f44336'}}>8%</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', mt:  1}}>
                      <Typography sx={{ color: '#4CAF50', fontWeight: 600, fontSize: '0.9rem'}}>
                        📈 +5% positive denne uken
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Top Issues */}
                <Paper sx={{ p:  3, border: '1px solid #ff8c00', borderRadius: 2, gridColumn: 'span 2',  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#ff8c00', fontWeight: 600}}>
                    🔥 Mest vanlige problemer
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5}}>
                    {[
                      { issue: 'Login problemer', count:  23, trend: '+12%', color: '#f44336',},
                      { issue: 'Fakturering spørsmå', count:  18, trend: '-5%', color: '#4CAF50',},
                      { issue: 'Teknisk support', count:  15, trend: '+8%', color: '#f44336',},
                      { issue: 'Feature forespørsler', count:  12, trend: '+25%', color: '#f44336',},
                      { issue: 'Passord reset', count:  9, trend: '-15%', color: '#4CAF50',}
                    ].map((item, index) => (
                        <Box key={index} sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          p: 1.5,
                          bgcolor: 'background.paper',
                          borderRadius:  1,
                          border: '1px solid #e0e0e0'
                  }}>
                        <Typography sx={{ fontWeight: 500}}>{item.issue}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap:  2}}>
                          <Typography sx={{ fontWeight: 600}}>{item.count}</Typography>
                          <Typography sx={{ 
                            fontWeight: 600, 
                            color: item.color, 
                            fontSize: '0.85rem',
                            minWidth: '50px',
                            textAlign: 'right'
                    }}>
                            {item.trend}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Paper>

                {/* Alerts */}
                <Paper sx={{ p:  3, border: '1px solid #e0e0e0', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                    🚨 Varsler
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5}}>
                    <Box sx={{ p: 1, bgcolor: '#fff8e1', borderRadius: 1, border: '1px solid #ff8c00'}}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#e65100'}}>
                        ⚠️ Responstid 15% høyere enn vanlig
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1, bgcolor: '#e8f5e9', borderRadius: 1, border: '1px solid #4CAF50'}}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32'}}>
                        ℹ️ Premium tilfredshet økt 12%
                      </Typography>
                    </Box>
                    <Box sx={{ p: 1, bgcolor: '#ffebee', borderRadius: 1, border: '1px solid #f44336'}}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#c62828'}}>
                        🚨 3 brukere venter over 10 min
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Box>

              <Box sx={{ mt:  3, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  <Security sx={{ fontSize:  16, mr: 0.5}} />
                  Live data - oppdateres hvert 30. sekund - kun tilgjengelig for administratorer
                </Typography>
              </Box>
            </DialogContent>
          </Dialog>
        )}

        {/* Smart Automation Panel */}
        {isAdmin && (
          <Dialog
            open={automationPanelOpen}
            onClose={() => setAutomationPanelOpen(false)}
            maxWidth="lg"
            fullWidth
            sx={{
              zIndex: 999,
              '& .MuiDialog-paper': {
                borderRadius: 3,
                border: '2px solid #1027b0',
                boxShadow: '0 20px 60px rgba(16, 39, 176, 0.3)',
              }}}
          >
            <DialogTitle sx={{ 
              bgcolor: theming.colors.primary, 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1}}>
              {theming.getThemedIcon('smartToy')}
              🤖 Smart Automatisering & FAQ-Bot
              <Box sx={{ flexGrow:  1}} />
              <IconButton 
                onClick={() => setAutomationPanelOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  3}}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap:  3}}>
                {/* Auto-Response Control */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🤖 Smart Auto-Svar
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
                    <Typography>Aktiver auto-svar: </Typography>
                    <Switch 
                      checked={autoResponseEnabled}
                      onChange={(e) => setAutoResponseEnabled(e.target.checked)}
                      color="secondary"
                    />
                  </Box>

                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📊 Auto-svar statistikk
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Automatiske svar i dag: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>127</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Nøyaktighet: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>89.3%</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Tidsbesparelse: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00'}}>4.2 timer</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    🎯 Foreslåtte svar
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                    {[
                      { trigger: 'login problem', response: 'Hei! Prøv å tømme nettleser-cache og logg inn på nytt.',},
                      { trigger: 'pris spørsmå', response: 'Hei! Besøk våre prisplaner under "Innstillinger" for oppdaterte priser.',},
                      { trigger: 'teknisk feil', response: 'Takk for rapporten! Jeg videresender dette til vårt teknisk team.',}
                    ].map((item, index) => (
                      <Paper key={index} sx={{ p: 2, bgcolor: '#', borderRadius:  1 ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#9C27B0'}}>
                          Trigger: "{item.trigger}"
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5}}>
                          {item.response}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Paper>

                {/* FAQ Bot Control */}
                <Paper sx={{ p:  3, border: '1px solid #e0e0e0', borderRadius:  2,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                    ❓ FAQ-Bot
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2}}>
                    <Typography>Aktiver FAQ-bot: </Typography>
                    <Switch 
                      checked={faqBotEnabled}
                      onChange={(e) => setFaqBotEnabled(e.target.checked)}
                      color="primary"
                    />
                  </Box>

                  <Box sx={{ mb:  3}}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📈 FAQ-bot ytelse
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Spørsmål løst: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>89 av 127</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Bruker tilfredshet: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>4.6/5</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Fallback til human: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00'}}>11%</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    🔥 Populære FAQ-er
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                    {[
                      { question: 'Hvordan resette passord, ?', usage: 89,},
                      { question: 'Hvor finner jeg mine prosjekter, ?', usage: 67,},
                      { question: 'Hvordan oppgradere abonnement, ?', usage: 45,},
                      { question: 'Problemer med Google Drive, ?', usage: 32,}
                    ].map((item, index) => (
                      <Box key={index} sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 1.5,
                        bgcolor: '#e3f2fd',
                        borderRadius: 1}}>
                        <Typography variant="body2" sx={{ fontWeight: 500}}>
                          {item.question}
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          fontWeight: 600, 
                          color: theming.colors.primary,
                          minWidth: '40px',
                          textAlign: 'center'
                  }}>
                          {item.usage}x
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>

                {/* Escalation Rules */}
                <Paper sx={{ p:  3, border: '1px solid #ff8c00', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#ff8c00', fontWeight: 600}}>
                    ⚡ Eskalering & Regler
                  </Typography>
                  
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600}}>
                    🚨 Automatisk eskalering ved: </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                    <FormControlLabel
                      control={<Switch defaultChecked color="warning" />}
                      label="Negative sentiment termer"
                    />
                    <FormControlLabel
                      control={<Switch defaultChecked color="warning" />}
                      label="VIP-kunder (premium)"
                    />
                    <FormControlLabel
                      control={<Switch defaultChecked color="warning" />}
                      label="Ventetid over 5 min"
                    />
                    <FormControlLabel
                      control={<Switch color="warning" />}
                      label="Komplekse tekniske spørsmål"
                    />
                  </Box>

                  <Box sx={{ mt:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📱 Varsling preferanser
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      label="Admin telefon"
                      defaultValue="+47 XXX XX XXX"
                      variant="outlined"
                      sx={{ mb:  1}}
                    />
                    <TextField
                      fullWidth
                      size="small"
                      label="Backup e-post"
                      defaultValue={user?.email || ', '}
                      variant="outlined"
                    />
                  </Box>
                </Paper>

                {/* AI Training */}
                <Paper sx={{ p:  3, border: '1px solid #e0e0e0', borderRadius:  2,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, fontWeight: 600}}>
                    🎓 AI Trening & Forbedring
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📚 Trenings-data
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Samtaler analysert: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>15,742</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Suksessrate: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>94.2%</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Siste oppdatering: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>2 timer siden</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={theming.getThemedIcon('autoAwesome')}
                    sx={{
                      ...theming.getThemedButtonSx(),
                      bgcolor: '#4CAF50',
                      mb: 2, '&:hover': { bgcolor: '#45a049' }}}
                  >
                    🧠 Oppdater
                  </Button>

                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={theming.getThemedIcon('trendingUp')}
                    sx={{ 
                      borderColor: '#',
                      color: '#','&:hover': { borderColor: '#', bgcolor: '#4CAF50',}
                }}
                  >
                    📊 Se detaljert analyse
                  </Button>
                </Paper>
              </Box>

              <Box sx={{ mt:  3, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  <SmartToy sx={{ fontSize:  16, mr: 0.5}} />
                  Smart automatisering aktivert - sparer gj.snitt 4.2 timer daglig - kun admin kontroll
                </Typography>
              </Box>
            </DialogContent>
          </Dialog>
        )}

        {/* User Moderation Panel */}
        {isAdmin && (
          <Dialog
            open={userModerationOpen}
            onClose={() => setUserModerationOpen(false)}
            maxWidth="xl"
            fullWidth
            sx={{
              zIndex: 999,
              '& .MuiDialog-paper': {
                borderRadius: 3,
                border: '2px solid #09b7d1',
                boxShadow: '0 20px 60px rgba(9, 183, 209, 0.3)',
                minHeight: '85vh',
              }}}
          >
            <DialogTitle sx={{ 
              bgcolor: theming.colors.primary, 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1 }}>
              <PersonOutline />
              👥 Brukeradministrasjon & Chat Moderering
              <Box sx={{ flexGrow:  1}} />
              <IconButton 
                onClick={() => setUserModerationOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  3}}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap:  3}}>
                {/* Left Panel - User List & Controls */}
                <Box>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🔍 Bruker Søk & Filter
                  </Typography>
                  
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Søk brukere..."
                    variant="outlined"
                    sx={{ mb:  2}}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      )
              }}
                  />

                  <Box sx={{ display: 'flex', gap: 1, mb:  3, flexWrap: 'wrap'}}>
                    <Chip label="Alle" variant="filled" color="primary" size="small" />
                    <Chip label="VIP" variant="outlined" color="warning" size="small" />
                    <Chip label="Premium" variant="outlined" color="success" size="small" />
                    <Chip label="Problematiske" variant="outlined" color="error" size="small" />
                    <Chip label="Online" variant="outlined" color="info" size="small" />
                  </Box>

                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}}>
                    👥 Aktive Samtaler ({adminUsers?.data?.length || 0} brukere)
                  </Typography>

                  <List sx={{ maxHeight: '400px', overflow: 'auto'}}>
                    {(adminUsers?.data || []).map((user, index) => (
                      <ListItem
                        key={index}
                        sx={{ 
                          border: '1px solid #',
                          borderRadius:  2,
                          mb:  1,
                          cursor: 'pointer','&:hover': { bgcolor: '#f5f5f5',}
                    }}
                      >
                        <ListItemAvatar>
                          <Badge 
                            color={user.status === 'online' ? 'success' : user.status === 'away' ? 'warning' : 'default'}
                            variant="dot"
                          >
                            <Avatar sx={{ bgcolor: '#45b7d1'}}>
                              {user.name.charAt(0)}
                            </Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1}}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                                {user.firstName || user.name} {user.lastName || ', '}
                              </Typography>
                              {user.isVip && <Star sx={{ color: '#', fontSize: 16}} />}
                              {user.isPremium && <Chip label="Premium" size="small" color="success" sx={{ fontSize: '0.6rem', height: 16}} />}
                            </Box>
                      }
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {user.email}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', color: '#', fontWeight: 600}}>
                                {user.messages || 0} meldinger
                              </Typography>
                            </Box>
                      }
                        />
                        <IconButton size="small">
                          {theming.getThemedIcon('moreVert')}
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </Box>

                {/* Right Panel - User Details & Actions */}
                <Box>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    ⚙️ Modereringshandlinger
                  </Typography>

                  {/* Quick Actions */}
                  <Paper sx={{ p:  3, mb:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600}}>
                      🚀 Raske Handlinger
                    </Typography>
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap:  2}}>
                      <Button variant="outlined" startIcon={theming.getThemedIcon('star')} color="warning" fullWidth>
                        Marker som VIP
                      </Button>
                      <Button variant="outlined" startIcon={<Block />} color="error" fullWidth>
                        Midlertidig blokkering
                      </Button>
                      <Button variant="outlined" startIcon={theming.getThemedIcon('note')} color="info" fullWidth>
                        Legg til notater
                      </Button>
                      <Button variant="outlined" startIcon={theming.getThemedIcon('assignment')} color="success" fullWidth>
                        Opprett oppgave
                      </Button>
                    </Box>
                  </Paper>

                  {/* VIP Management */}
                  <Paper sx={{ p:  3, mb:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#FFD700'}}>
                      ⭐ VIP Kunde Management
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography>Prioritert support: </Typography>
                        <Switch defaultChecked color="warning" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography>Direktetilgang til admin: </Typography>
                        <Switch defaultChecked color="warning" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography>Øyeblikkelige varsler: </Typography>
                        <Switch defaultChecked color="warning" />
                      </Box>
                      
                      <TextField
                        fullWidth
                        size="small"
                        label="VIP Notat"
                        placeholder="Spesielle instruksjoner for denne VIP-kunden..."
                        multiline
                        rows={3}
                        variant="outlined"
                      />
                    </Box>
                  </Paper>

                  {/* Chat History & Actions */}
                  <Paper sx={{ p:  3, mb:  3, border: '1px solid #e0e0e0', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#f44336'}}>
                      💬 Chat Moderering
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                      <Box sx={{ display: 'flex', gap:  2 }}>
                        <Button variant="contained" color="warning" size="small" startIcon={theming.getThemedIcon('delete')} sx={theming.getThemedButtonSx()}>
                          Slett melding
                        </Button>
                        <Button variant="outlined" color="error" size="small" startIcon={<Block />}>
                          Blokker bruker
                        </Button>
                      </Box>
                      
                      <TextField
                        fullWidth
                        size="small"
                        label="Modereringsgrunn"
                        placeholder="Beskriv hvorfor denne handlingen tas..."
                        multiline
                        rows={2}
                        variant="outlined"
                      />
                      
                      <FormControlLabel
                        control={<Switch color="primary" defaultChecked />}
                        label="Send varsel til bruker"
                      />
                    </Box>
                  </Paper>

                  {/* Analytics */}
                  <Paper sx={{ p:  3, border: '1px solid #e0e0e0', borderRadius:  2,  ...theming.getThemedCardSx() }}>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: '#4CAF50'}}>
                      📊 Bruker Analyse
                    </Typography>
                    
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap:  2 }}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>89</Typography>
                        <Typography variant="caption">VIP Kunder</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>542</Typography>
                        <Typography variant="caption">Premium</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#ffebee', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>12</Typography>
                        <Typography variant="caption">Blokkerte</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#e3f2fd', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>1,247</Typography>
                        <Typography variant="caption">Totalt</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Box>
              </Box>

              <Box sx={{ mt:  3, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  <Security sx={{ fontSize:  16, mr: 0.5}} />
                  Alle modereringshandlinger logges og krever admin-tilgang - GDPR-kompatibel brukerbehandling
                </Typography>
              </Box>
            </DialogContent>
          </Dialog>
        )}

        {/* Business Intelligence Panel */}
        {isAdmin && (
          <Dialog
            open={biPanelOpen}
            onClose={() => setBiPanelOpen(false)}
            maxWidth="xl"
            fullWidth
            sx={{
              zIndex: 999,
              '& .MuiDialog-paper': {
                borderRadius: 3,
                border: '2px solid #06af50',
                boxShadow: '0 20px 60px rgba(6, 175, 80, 0.3)',
                minHeight: '90vh',
              }}}
          >
            <DialogTitle sx={{ 
              bgcolor: theming.colors.primary, 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1 }}>
              {theming.getThemedIcon('trendingUp')}
              📊 Business Intelligence & CRM Integration
              <Box sx={{ flexGrow:  1}} />
              <IconButton 
                onClick={() => setBiPanelOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  3}}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap:  3 }}>
                {/* Lead Tracking */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🎯 Lead Tracking & Konvertering
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📈 Dagens Leads
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Nye leads fra chat: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>{leadsData?.newLeads || 0}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Kvalifiserte leads: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00'}}>{leadsData?.qualifiedLeads || 0}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Konvertert til kunde: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2196F3'}}>{leadsData?.convertedLeads || 0}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Konverteringsrate: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#9C27B0'}}>{leadsData?.conversionRate || '0%'}</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    🔥 Hottest Leads (Chat-basert)
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                    {(leadsData?.hotLeads || []).map((lead, index) => (
                      <Paper key={index} sx={{ p: 2, bgcolor: '#', borderRadius: 1, border: '1px solid #4CAF50',  ...theming.getThemedCardSx() }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                              {lead.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {lead.messages} meldinger • Potensiell verdi: {lead.value}
                            </Typography>
                          </Box>
                          <Chip 
                            label={`${lead.score}%`}
                            size="small" 
                            color="success" 
                            sx={{ fontWeight: 600}}
                          />
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Paper>

                {/* CRM Integration */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🤝 CRM Integration
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📊 CRM Synkronisering
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography variant="body2">Auto-sync til CRM: </Typography>
                        <Switch defaultChecked color="primary" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Siste sync: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>2 min siden</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Synkroniserte samtaler: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>1,247</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    🔄 Automatiske CRM-handlinger
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                    <FormControlLabel
                      control={<Switch defaultChecked color="primary" />}
                      label="Opprett kontakt automatisk"
                    />
                    <FormControlLabel
                      control={<Switch defaultChecked color="primary" />}
                      label="Oppdater kundehistorikk"
                    />
                    <FormControlLabel
                      control={<Switch defaultChecked color="primary" />}
                      label="Lag oppfølgings-oppgaver"
                    />
                    <FormControlLabel
                      control={<Switch color="primary" />}
                      label="Auto-tag basert på samtaleinnhold"
                    />
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    startIcon={theming.getThemedIcon('sync')}
                    sx={{ 
                      mt: 2,
                      bgcolor: '#1976D2',
                      '&:hover': { bgcolor: '#1565C0' },
                      ...theming.getThemedButtonSx()
                    }}>
                    🔄 Manuell CRM Sync
                  </Button>
                </Paper>

                {/* Customer Journey Analysis */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🛤️ Customer Journey Analyse
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📋 Gjennomsnittlig Customer Journey
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5}}>
                      {[
                        { stage: 'Første kontakt', avgTime: '0 dager', conversion: '1.0.0',},
                        { stage: 'Interessebekreftelse', avgTime: '2 dager', conversion: '68%',},
                        { stage: 'Tilbudsforespørsel', avgTime: '5 dager', conversion: '45%',},
                        { stage: 'Kontraktssignering', avgTime: '12 dager', conversion: '35%',}
                      ].map((stage, index) => (
                        <Box key={index} sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          p: 1.5,
                          bgcolor: '#',
                          borderRadius:  1,
                          border: '1px solid #9C27B0'
                  }}>
                          <Typography variant="body2" sx={{ fontWeight: 500}}>
                            {stage.stage}
                          </Typography>
                          <Box sx={{ textAlign: 'right'}}>
                            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600}}>
                              {stage.avgTime}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#', fontWeight: 600}}>
                              {stage.conversion}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    💡 Anbefalinger
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                    <Paper sx={{ p: 1, bgcolor: '#', borderRadius:  1 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#e65100'}}>
                        ⚠️ 23% leads mistes i "Interessebekreftelse"-fasen
                      </Typography>
                    </Paper>
                    <Paper sx={{ p: 1, bgcolor: '#', borderRadius:  1 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32'}}>
                        💡 Raskere oppfølging kan øke konvertering 15%
                      </Typography>
                    </Paper>
                  </Box>
                </Paper>

                {/* Revenue Analytics */}
                <Paper sx={{ p:  3, border: '1px solid #ff8c00', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#ff8c00', fontWeight: 600}}>
                    💰 Inntekts-analyse fra Chat
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      💸 Chat-drevet inntekt
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Denne måneden: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>{salesData?.currentMonth || '0 NOK'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Forrige måned: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>{salesData?.previousMonth || '0 NOK'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Vekst: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>{salesData?.growth || '+0%'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Gj.snitt per chat-lead: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00'}}>{salesData?.averagePerLead || '0 NOK'}</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    🏆 Top Chat Salg (denne måneden)
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                    {(salesData?.topSales || []).map((sale, index) => (
                      <Box key={index} sx={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        p: 1.5,
                        bgcolor: '#',
                        borderRadius:  1,
                        border: '1px solid #ff8c00'
                }}>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                            {sale.project}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {sale.client}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00'}}>
                          {sale.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>

                {/* Pipeline & Forecasting */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🔮 Sales Pipeline & Prognose
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📊 Aktiv Pipeline
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Kvalifiserte leads: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>127</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Under forhandling: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00'}}>43</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Forventet lukking: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>28</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Pipeline verdi: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#f44336'}}>2.3M NOK</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    📅 Neste måned prognose
                  </Typography>
                  <Box sx={{ p: 2, bgcolor: '#ffebee', borderRadius: 1, border: '1px solid #f44336'}}>
                    <Typography variant="h6" sx={{  fontWeight: 600, color: '#', textAlign: 'center' }}>
                      1.2M NOK
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: '#f44336'}}>
                      Estimert inntekt (85% konfidensintervall)
                    </Typography>
                  </Box>
                </Paper>

                {/* Smart Insights */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🧠 Smart Insights & Anbefalinger
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
                    <Paper sx={{ p: 2, bgcolor: '#', borderRadius: 1, border: '1px solid #673AB7',  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#', mb:  1 }}>
                        💡 AI Anbefaling
                      </Typography>
                      <Typography variant="body2">
                        Brukere som spør om "bryllupspakker" har 67% høyere konverteringsrate. 
                        Anbefaler automatisk bryllups-tilbud i chat.
                      </Typography>
                    </Paper>

                    <Paper sx={{ p: 2, bgcolor: '#', borderRadius: 1, border: '1px solid #4CAF50',  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#', mb:  1 }}>
                        📈 Trendoppdatering
                      </Typography>
                      <Typography variant="body2">"Sosiale medier pakker" øker 45% denne måneden. 
                        Vurder å lage nye chat-maler for denne kategorien.
                      </Typography>
                    </Paper>

                    <Paper sx={{ p: 2, bgcolor: '#', borderRadius: 1, border: '1px solid #ff8c00',  ...theming.getThemedCardSx() }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#ff8c00', mb:  1 }}>
                        ⚠️ Advarsel
                      </Typography>
                      <Typography variant="body2">
                        Responstid over 3 minutter reduserer konverteringsrate med 23%. 
                        Vurder å øke chat-ressurser i rushtid.
                      </Typography>
                    </Paper>
                  </Box>
                </Paper>
              </Box>

              <Box sx={{ mt:  3, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  <TrendingUp sx={{ fontSize:  16, mr: 0.5}} />
                  Live Business Intelligence - integrert med CRM, Sales Pipeline og Google Analytics
                </Typography>
              </Box>
            </DialogContent>
          </Dialog>
        )}

        {/* Workflow Optimization Panel */}
        {isAdmin && (
          <Dialog
            open={workflowPanelOpen}
            onClose={() => setWorkflowPanelOpen(false)}
            maxWidth="xl"
            fullWidth
            sx={{
              zIndex: 999,
              '& .MuiDialog-paper': {
                borderRadius: 3,
                border: '2px solid #ff8c00',
                boxShadow: '0 20px 60px rgba(255, 140, 0, 0.3)',
                minHeight: '90vh',
              }}}
          >
            <DialogTitle sx={{ 
              bgcolor: '#ff8c00', 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1 }}>
              {theming.getThemedIcon('build')}
              ⚡ Arbeidsflyt-optimalisering & Smart Routing
              <Box sx={{ flexGrow:  1}} />
              <IconButton 
                onClick={() => setWorkflowPanelOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  3}}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap:  3 }}>
                {/* Chat Routing Rules */}
                <Paper sx={{ p:  3, border: '1px solid #ff8c00', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#ff8c00', fontWeight: 600}}>
                    🔀 Intelligent Chat Routing
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      🚦 Aktive Routing-regler
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                      <FormControlLabel
                        control={<Switch defaultChecked color="warning" />}
                        label="VIP-kunder → Direkte til admin"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="warning" />}
                        label="Teknisk support → Support-team"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="warning" />}
                        label="Salg spørsmål → Sales-team"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="warning" />}
                        label="Fakturering → Økonomi-team"
                      />
                      <FormControlLabel
                        control={<Switch color="warning" />}
                        label="Komplekse forespørsler → Senior agent"
                      />
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    📊 Routing Statistikk (i dag)
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Auto-routet chats: </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>284</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Routing nøyaktighet: </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00'}}>91.3%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Redusert ventetid: </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#2196F3'}}>-67%</Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Task Generation */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    📋 Automatisk Oppgave-generering
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      🔄 Auto-oppgaver aktivert
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                      <FormControlLabel
                        control={<Switch defaultChecked color="primary" />}
                        label="Opprett oppfølgings-oppgaver"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="primary" />}
                        label="Bug rapport → Dev team oppgave"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="primary" />}
                        label="Feature forespørsel → Product oppgave"
                      />
                      <FormControlLabel
                        control={<Switch color="primary" />}
                        label="Kundefeedback → Marketing oppgave"
                      />
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    ✅ Nylig genererte oppgaver
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                    {[
                      { task: 'Følg opp bryllupstilbud - Lars Andersen', priority: 'Hø', team: 'Sales',},
                      { task: 'Bug: Login problem - iOS app', priority: 'Medium', team: 'Dev',},
                      { task: 'Feature: Bulk export ønskes', priority: 'Lav', team: 'Product',}
                    ].map((item, index) => (
                        <Paper key={index} sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 1, border: '1px solid #2196F3',  ...theming.getThemedCardSx() }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                              {item.task}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Team: {item.team}
                            </Typography>
                          </Box>
                          <Chip 
                            label={item.priority}
                            size="small" 
                            color={item.priority === 'Høy' ? 'error' : item.priority === 'Medium' ? 'warning' : 'default'}
                            sx={{ fontWeight: 600}}
                          />
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                </Paper>

                {/* Queue Management */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    📬 Intelligent Kø-håndtering
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      🔢 Live Kø Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">VIP kø:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#FFD700'}}>2 (0 min avg)</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Premium kø:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>12 (1.2 min avg)</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Standard kø:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#ff8c00'}}>45 (3.8 min avg)</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Problematiske chats: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#f44336'}}>3 (8.5 min avg)</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    ⚙️ Kø Innstillinger
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                    <TextField
                      size="small"
                      label="Max ventetid (min)"
                      defaultValue="5"
                      type="number"
                      variant="outlined"
                      sx={{ mb:  1 }}
                    />
                    <TextField
                      size="small"
                      label="VIP max ventetid (sek)"
                      defaultValue="30"
                      type="number"
                      variant="outlined"
                      sx={{ mb:  1 }}
                    />
                    <FormControlLabel
                      control={<Switch defaultChecked color="secondary" />}
                      label="Auto-eskalering ved lang ventetid"
                    />
                  </Box>
                </Paper>

                {/* Team Performance */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    👥 Team Ytelse & Fordeling
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📊 Team Kapasitet (live)
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5}}>
                      {[
                        { team: 'Admin (Daniel, )', active:  15, capacity:  20, efficiency: '94%',},
                        { team: 'Sales Team', active:  8, capacity:  12, efficiency: '87%',},
                        { team: 'Support Team', active:  23, capacity:  25, efficiency: '91%',},
                        { team: 'Technical', active:  6, capacity:  8, efficiency: chatStats?.teamEfficiency || '89%',}
                      ].map((team, index) => (
                        <Box
                          key={index}
                          sx={{
                            p: 2,
                            bgcolor: '#E8F5E9',
                            borderRadius: 1,
                            border: '1px solid #4CAF50'}}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:  1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                              {team.team}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>
                              {team.efficiency}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                            <Typography variant="caption">
                              Aktive: {team.active}/{team.capacity}
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={(team.active / team.capacity) * 100}
                              sx={{ width: '100px', ml:  2 }}
                            />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    startIcon={<Groups sx={theming.getThemedButtonSx()} />}
                    sx={{ 
                      bgcolor: '#','&:hover': { bgcolor: '#45a049',}
                }}
                  >
                    📊 Detaljert Team Rapport
                  </Button>
                </Paper>

                {/* Automation Rules */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🤖 Avanserte Automatiseringsregler
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      ⚡ Trigger-baserte handlinger
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                      <Paper sx={{ p: 2, bgcolor: '#ffebee', borderRadius:  1 ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb:  1}}>
                          Regel 1: Høy prioritet eskalering
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Hvis: melding inneholder "hastecase" eller "kritisk"<br/>
                          Då: Direkte til admin + SMS varsel
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt:  1}}>
                          <Switch defaultChecked color="error" size="small" />
                        </Box>
                      </Paper>

                      <Paper sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius:  1 ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb:  1}}>
                          Regel 2: Automatisk tilbud
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Hvis: bruker spør om "priser" og er premium kunde<br/>
                          Då: Send tilpasset prismal + lag oppfølgings-oppgave
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt:  1 }}>
                          <Switch defaultChecked color="primary" size="small" />
                        </Box>
                      </Paper>

                      <Paper sx={{ p: 2, bgcolor: '#', borderRadius:  1 ,  ...theming.getThemedCardSx() }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb:  1 }}>
                          Regel 3: Customer success oppfølging
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Hvis: ny kunde har vært inaktiv over 7 dager<br/>
                          Då: Send velkomst-melding + onboarding guide
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt:  1}}>
                          <Switch defaultChecked color="success" size="small" />
                        </Box>
                      </Paper>
                    </Box>
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    startIcon={theming.getThemedIcon('add')}
                    sx={{ 
                      bgcolor: '#d32f2f',
                      '&:hover': { bgcolor: '#b71c1c' },
                      ...theming.getThemedButtonSx()
                    }}>
                    ➕ Opprett ny automatiseringsregel
                  </Button>
                </Paper>

                {/* Workflow Analytics */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    📈 Arbeidsflyt Analyse & Optimalisering
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      🎯 KPI Oversikt
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat, (1fr)', gap:  2}}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>{chatStats?.responseTime || '2.1 min'}</Typography>
                        <Typography variant="caption">Avg responstid</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>{chatStats?.resolutionRate || '94.2%'}</Typography>
                        <Typography variant="caption">First contact resolution</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#e3f2fd', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>{chatStats?.satisfaction || '4.8/5'}</Typography>
                        <Typography variant="caption">Kundetilfredshet</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>{chatStats?.automationRate || '67%'}</Typography>
                        <Typography variant="caption">Automatiseringsrate</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    💡 Optimaliserings-anbefalinger
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                    <Paper sx={{ p: 1, bgcolor: '#E8F5E9', borderRadius:  1 ,  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32'}}>
                        ✅ Implementer chat-bots for FAQ kan spare 2.5 timer daglig
                      </Typography>
                    </Paper>
                    <Paper sx={{ p: 1, bgcolor: '#e3f2fd', borderRadius:  1,  ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#1565C0'}}>
                        📊 Peak time (14-16) kan trenge 2 ekstra agenter
                      </Typography>
                    </Paper>
                  </Box>
                </Paper>
              </Box>

                <Box sx={{ mt:  3, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  <Build sx={{ fontSize:  16, mr: 0.5}} />
                  Intelligent arbeidsflyt med 67% automatisering - optimalisert for CreatorHub Norge
                </Typography>
              </Box>
            </DialogContent>
          </Dialog>
        )}

        {/* Data & Security Panel */}
        {isAdmin && (
          <Dialog
            open={securityPanelOpen}
            onClose={() => setSecurityPanelOpen(false)}
            maxWidth="xl"
            fullWidth
            sx={{
              zIndex: 999,
              '& .MuiDialog-paper': {
                borderRadius: 3,
                border: '2px solid #184336',
                boxShadow: '0 20px 60px rgba(24, 67, 54, 0.3)',
                minHeight: '85vh',
              }}}
          >
            <DialogTitle sx={{ 
              bgcolor: theming.colors.primary, 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1 }}>
              {theming.getThemedIcon('security')}
              🔒 Data & Sikkerhet - GDPR Compliance Center
              <Box sx={{ flexGrow:  1}} />
              <IconButton 
                onClick={() => setSecurityPanelOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  3}}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap:  3 }}>
                {/* GDPR Compliance */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🛡️ GDPR Compliance Center
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      ✅ Compliance Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography variant="body2">Data encryption (AES-256):</Typography>
                        <Chip label="Aktiv" size="small" color="success" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography variant="body2">Samtykke tracking: </Typography>
                        <Chip label="Aktivt" size="small" color="success" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography variant="body2">Data minimisering: </Typography>
                        <Chip label="Implementert" size="small" color="success" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography variant="body2">Rett til sletting: </Typography>
                        <Chip label="Automatisert" size="small" color="success" />
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    🗂️ Databehandling oversikt
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Chat-meldinger lagret: </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600}}>15,742</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Persondata objekter: </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600}}>1,247</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Automatisk slettet (30d):</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>3,456</Typography>
                    </Box>
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    startIcon={theming.getThemedIcon('download')}
                    sx={{ 
                      mt: 2,
                      bgcolor: '#d32f2f',
                      '&:hover': { bgcolor: '#c62828' },
                      ...theming.getThemedButtonSx()
                    }}>
                    📊 Generer GDPR Rapport
                  </Button>
                </Paper>

                {/* Google Drive Backup */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    ☁️ Google Drive Chat Backup
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      🔄 Backup Status
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Typography variant="body2">Auto-backup: </Typography>
                        <Switch defaultChecked color="primary" />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Siste backup: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>15 min siden</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Backup størrelse: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600}}>847 MB</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Drive folder: </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#4285f4'}}>/ChatBackups/2025</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    ⚙️ Backup Innstillinger
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                    <FormControlLabel
                      control={<Switch defaultChecked color="primary" />}
                      label="Daglig automatisk backup"
                    />
                    <FormControlLabel
                      control={<Switch defaultChecked color="primary" />}
                      label="Inkluder metadata"
                    />
                    <FormControlLabel
                      control={<Switch color="primary" />}
                      label="Komprimer backups"
                    />
                    
                    <TextField
                      size="small"
                      label="Backup retention (dager)"
                      defaultValue="90"
                      type="number"
                      variant="outlined"
                    />
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    startIcon={<Google />}
                    sx={{ 
                      mt:  2,
                      bgcolor: '#','&:hover': { bgcolor: '#3367d6',}
                }}
                  >
                    🔄 Start Manuell Backup
                  </Button>
                </Paper>

                {/* Data Anonymization */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🕶️ Data Anonymisering & Pseudonymisering
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      🔒 Anonymiseringsregler
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2}}>
                      <FormControlLabel
                        control={<Switch defaultChecked color="secondary" />}
                        label="Auto-fjern navn i chat-historikk"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="secondary" />}
                        label="Pseudonymiser e-postadresser"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="secondary" />}
                        label="Fjern telefonnumre automatisk"
                      />
                      <FormControlLabel
                        control={<Switch color="secondary" />}
                        label="Anonymiser IP-adresser"
                      />
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    📊 Anonymisering Status
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Behandlede meldinger: </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600}}>12,459</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Fjernede identifikatorer: </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#9C27B0'}}>2,847</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                      <Typography variant="body2">Anonymiseringsrate: </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50'}}>98.7%</Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* Data Access Requests */}
                <Paper sx={{ p:  3, border: '1px solid #ff8c00', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#ff8c00', fontWeight: 600}}>
                    📋 Dataforespørsler & Brukerrettigheter
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      📥 Aktive forespørsler
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                      {[
                        { user: 'lars@photographer.no', type: 'Data export', status: 'Behandles', time: '2 timer siden',},
                        { user: 'maria@videographer.no', type: 'Slett data', status: 'Venter', time: '6 timer siden',},
                        { user: 'erik@musicproducer.no', type: 'Data innsyn', status: 'Fullført', time: '1 dag siden',}
                      ].map((request, index) => (
                        <Paper key={index} sx={{ p: 2, bgcolor: '#', borderRadius: 1, border: '1px solid #ff8c00',  ...theming.getThemedCardSx() }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                                {request.type}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {request.user} • {request.time}
                              </Typography>
                            </Box>
                            <Chip 
                              label={request.status}
                              size="small" 
                              color={request.status === 'Fullført' ? 'success' : request.status === 'Behandles' ? 'warning' : 'default'}
                              sx={{ fontWeight: 600}}
                            />
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    startIcon={theming.getThemedIcon('assignment')}
                    sx={{ 
                      bgcolor: '#ff8c00',
                      '&:hover': { bgcolor: '#f57c00' },
                      ...theming.getThemedButtonSx()
                    }}>
                    📝 Ny Dataforespørsel
                  </Button>
                </Paper>

                {/* Audit Trail */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    📜 Audit Trail & Aktivitetslogg
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      🕒 Nylige aktiviteter
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  1}}>
                      {[
                        { action: 'Chat data eksportert', user: user?.email || 'System', time: '14:23',},
                        { action: 'GDPR sletting utført', user: 'System', time: '13:45',},
                        { action: 'Backup til Google Drive', user: 'System', time: '13:00',},
                        { action: 'Sikkerhetsscan fullført', user: 'System', time: '12:30',}
                      ].map((log, index) => (
                        <Box
                          key={index}
                          sx={{
                            p: 1,
                            bgcolor: '#E8F5E9',
                            borderRadius: 1,
                            border: '1px solid #4CAF50'}}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                            <Typography variant="body2" sx={{ fontWeight: 600}}>
                              {log.action}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {log.time}
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Utført av: {log.user}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    startIcon={<History sx={theming.getThemedButtonSx()} />}
                    sx={{ 
                      bgcolor: '#','&:hover': { bgcolor: '#45a049',}
                }}
                  >
                    📊 Full Audit Rapport
                  </Button>
                </Paper>

                {/* Security Monitoring */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2 ,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🛡️ Sikkerhetsmonitering
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                      🚨 Sikkerhetsstatus
                    </Typography>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat, (1fr)', gap:  2}}>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>0</Typography>
                        <Typography variant="caption">Aktive trusler</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>3</Typography>
                        <Typography variant="caption">Varsler</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>{chatStats?.securityScore || '99.8%'}</Typography>
                        <Typography variant="caption">Oppetid</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#e3f2fd', borderRadius:  1}}>
                        <Typography variant="h6" sx={{  fontWeight: 600, color: theming.colors.primary }}>A+</Typography>
                        <Typography variant="caption">Sikkerhetsgrad</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    🔍 Siste sikkerhetsscan
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary'}}>
                    Fullført: I dag 12:30 - Ingen sårbarheter funnet
                  </Typography>

                  <Button variant="contained"
                    fullWidth
                    startIcon={theming.getThemedIcon('security')}
                    sx={{ 
                      bgcolor: '#512DA8',
                      '&:hover': { bgcolor: '#4527A0' },
                      ...theming.getThemedButtonSx()
                    }}>
                    🔍 Start Sikkerhetsscan
                  </Button>
                </Paper>
              </Box>

              <Box sx={{ mt:  3, textAlign: 'center'}}>
                <Typography variant="body2" color="text.secondary">
                  <Security sx={{ fontSize:  16, mr: 0.5}} />
                  GDPR-kompatibel data og sikkerhetshåndtering - automatisk Google Drive backup aktivert
                </Typography>
              </Box>
            </DialogContent>
          </Dialog>
        )}

        {/* Internationalization Panel */}
        {isAdmin && (
          <Dialog
            open={internationalizationPanelOpen}
            onClose={() => setInternationalizationPanelOpen(false)}
            maxWidth="lg"
            fullWidth
            sx={{
              zIndex: 999,
              '& .MuiDialog-paper': {
                borderRadius: 3,
                border: '2px solid #0d3ab7',
                boxShadow: '0 20px 60px rgba(13, 58, 183, 0.3)',
                minHeight: '80vh',
              }}}
          >
            <DialogTitle sx={{ 
              bgcolor: theming.colors.primary, 
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 1 }}>
              <Language />
              🌍 Internasjonalisering & Oversettelse
              <Box sx={{ flexGrow:  1 }} />
              <IconButton 
                onClick={() => setInternationalizationPanelOpen(false)}
                sx={{ color: 'white'}}
              >
                {theming.getThemedIcon('close')}
              </IconButton>
            </DialogTitle>
            
            <DialogContent sx={{ p:  3}}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap:  3 }}>
                {/* Language Detection */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600,  ...{ color: theming.colors.primary  }}}>
                    🔍 Automatisk Språkdeteksjon
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{  mb: 1, fontWeight: 600,  ...{ color: theming.colors.primary  }}}>
                      🗣️ Språkstatistikk (i dag)
                    </Typography>
                    <Box sx={{  display: 'flex', flexDirection: 'column', gap:  1,  ...{ color: theming.colors.primary  }}}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">🇳🇴 Norsk (bokmål):</Typography>
                        <Typography variant="body2" sx={{  fontWeight: 600, color: '#673AB7',  ...{ color: theming.colors.primary  }}}>{chatStats?.translationAccuracy || '78%'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">🇬🇧 Engelsk: </Typography>
                        <Typography variant="body2" sx={{  fontWeight: 600,  ...{ color: theming.colors.primary  }}}>{chatStats?.englishUsage || '15%'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">🇸🇪 Svensk: </Typography>
                        <Typography variant="body2" sx={{  fontWeight: 600,  ...{ color: theming.colors.primary  }}}>{chatStats?.swedishUsage || '10%'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">🇩🇰 Dansk: </Typography>
                        <Typography variant="body2" sx={{  fontWeight: 600,  ...{ color: theming.colors.primary  }}}>{chatStats?.danishUsage || '3%'}</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{  display: 'flex', flexDirection: 'column', gap:  2,  ...{ color: theming.colors.primary  }}}>
                    <FormControlLabel
                      control={<Switch defaultChecked color="secondary" />}
                      label="Auto-detekter språk i chat"
                    />
                    <FormControlLabel
                      control={<Switch defaultChecked color="secondary" />}
                      label="Foreslå oversettelse automatisk"
                    />
                    <FormControlLabel
                      control={<Switch color="secondary" />}
                      label="Tvungen oversettelse til norsk"
                    />
                  </Box>
                </Paper>

                {/* Translation Service */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600,  ...{ color: theming.colors.primary  }}}>
                    🔄 Live Oversettelsestjeneste
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{  mb: 1, fontWeight: 600,  ...{ color: theming.colors.primary  }}}>
                      📊 Oversettelsesstatistikk
                    </Typography>
                    <Box sx={{  display: 'flex', flexDirection: 'column', gap:  1,  ...{ color: theming.colors.primary  }}}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Meldinger oversatt i dag: </Typography>
                        <Typography variant="body2" sx={{  fontWeight: 600, color: '#2196F3',  ...{ color: theming.colors.primary  }}}>247</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Oversettelsesnøyaktighet: </Typography>
                        <Typography variant="body2" sx={{  fontWeight: 600, color: '#4CAF50',  ...{ color: theming.colors.primary  }}} >0.8 sek</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between'}}>
                        <Typography variant="body2">Gj.snitt responstid: </Typography>
                        <Typography variant="body2" sx={{  fontWeight: 600,  ...{ color: theming.colors.primary  }}}  >0.8 sek</Typography>
                      </Box>
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    🎯 Støttede språk
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 1,
                      mb: 2,
                      color: theming.colors.primary}}
                  >
                    {['🇳🇴 Norsk', '🇬🇧 Engelsk', '🇸🇪 Svensk', '🇩🇰 Dansk', '🇩🇪 Tysk', '🇫🇷 Fransk'].map(
                      (lang) => (
                        <Chip key={lang} label={lang} size="small" variant="outlined" color="primary" />
                      ),
                    )}
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={theming.getThemedIcon('translate')}
                    sx={{
                      ...theming.getThemedButtonSx(),
                      bgcolor: theming.colors.primary,
                      '&:hover': { bgcolor: '#1976D2' },
                    }}
                  >
                    ⚙️ Oversettelsesinnstillinger
                  </Button>
                </Paper>

                {/* Cultural Adaptation */}
                <Paper sx={{ p:  3, border: '1px solid #', borderRadius:  2,  ...theming.getThemedCardSx() }}>
                  <Typography variant="h6" sx={{  mb: 2, color: '#', fontWeight: 600}}>
                    🌏 Kulturell Tilpasning
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{  mb: 1, fontWeight: 600,  ...{ color: theming.colors.primary  }}}>
                      🇳🇴 Norsk Tilpasning
                    </Typography>
                    
                    <Box sx={{  display: 'flex', flexDirection: 'column', gap:  2,  ...{ color: theming.colors.primary  }}}>
                      <FormControlLabel
                        control={<Switch defaultChecked color="success" />}
                        label="Norske høflighetsfrasar"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="success" />}
                        label="Tidssone tilpasning (CET)"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="success" />}
                        label="Norsk datoformat (dd.mm.yyyy)"
                      />
                      <FormControlLabel
                        control={<Switch defaultChecked color="success" />}
                        label="NOK valuta og priser"
                      />
                    </Box>
                  </Box>

                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600}}>
                    💼 Branche-spesifikk terminologi
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      color: theming.colors.primary}}
                  >
                    <Paper sx={{ p: 1, bgcolor: '#E3F2FD', borderRadius: 1, ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50' }}>
                        📸 Fotografi: Norsk bransje-terminologi aktivert
                      </Typography>
                    </Paper>
                    <Paper sx={{ p: 1, bgcolor: '#E3F2FD', borderRadius: 1, ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50' }}>
                        🎬 Video: Norsk produksjonstermer
                      </Typography>
                    </Paper>
                    <Paper sx={{ p: 1, bgcolor: '#E3F2FD', borderRadius: 1, ...theming.getThemedCardSx() }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#4CAF50' }}>
                        🎵 Musikk: TONO/GRAMO integrasjon
                      </Typography>
                    </Paper>
                  </Box>
                </Paper>

	                {/* Multi-language Support */}
	                <Paper sx={{ p: 3, border: '1px solid #ff8c00', borderRadius: 2, ...theming.getThemedCardSx() }}>
	                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theming.colors.primary }}>
                    🗺️ Flerspråklig Kundestøtte
                  </Typography>
                  
                  <Box sx={{ mb:  3 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                      🎯 Agent Språkkompetanse
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5}}>
                      {[
                        { agent: 'Daniel (Admin, )', languages: '🇳🇴 🇬🇧 🇸🇪 🇩�, �', availability: 'Online',},
                        { agent: 'Sales Team', languages: '🇳🇴 🇬�, �', availability: 'Online',},
                        { agent: 'Support Team', languages: '🇳🇴 🇬🇧 🇸�, �', availability: 'Online',},
                        { agent: 'Technical', languages: '🇳🇴 🇬�, �', availability: 'Away',}
	                      ].map((agent, index) => (
	                        <Box
	                          key={index}
	                          sx={{
	                            p: 2,
	                            bgcolor: '#FFF3E0',
	                            borderRadius: 1,
	                            border: '1px solid #ff8c00'}}
	                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {agent.agent}
                              </Typography>
                              <Typography variant="caption">
                                Språk: {agent.languages}
                              </Typography>
                            </Box>
                            <Chip 
                              label={agent.availability}
                              size="small" 
                              color={agent.availability === 'Online' ? 'success' : 'warning'}
                            />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Button variant="contained"
                    fullWidth
                    startIcon={<Groups />}
                    sx={{ 
                      bgcolor: '#ff8c00', '&:hover': { bgcolor: '#f57c00',}
                }}
                  >
                    👥 Språkbasert Routing
                  </Button>
                </Paper>
              </Box>

              <Box sx={{ mt:  3, textAlign:'center'}}>
                <Typography variant="body2" color="text.secondary">
                  <Language sx={{ fontSize:  16, mr: 0.5}} />
                  Avansert flerspråklig støtte med 96.3% oversettelsesnøyaktighet - optimalisert for nordisk marked
                </Typography>
              </Box>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog open={pushSettingsOpen} onClose={() => setPushSettingsOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Push-varsler innstillinger</DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <PushNotificationSettings userId={currentUserId} showDescription={false} />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
          </DialogActions>
        </Dialog>
      )}
    </Dialog>
  );
}