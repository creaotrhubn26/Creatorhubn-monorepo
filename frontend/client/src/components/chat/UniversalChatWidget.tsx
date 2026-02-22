import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useCommunicationStatus } from '../../contexts/CommunicationStatusContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import QuickMessageTemplates from './QuickMessageTemplates';
import { chatMessageSchema, webSocketMessageSchema, type ChatMessageType, type WebSocketMessageType } from '../../../../shared/communication-schema';
import RichTextEditor from '../RichTextEditor';
import 'quill/dist/quill.snow.css';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Badge,
  Chip,
  Divider,
  Fab,
  Collapse,
  InputAdornment,
  Tooltip,
  Menu,
  MenuItem,
  Button,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Snackbar,
  Rating,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Chat,
  Send,
  Close,
  ExpandLess,
  ExpandMore,
  MoreVert,
  Fullscreen,
  MinimizeRounded,
  Person,
  Group,
  Support,
  Notifications,
  NotificationsActive,
  OpenWith,
  Email,
  Phone,
  VideoCall,
  Google,
  Add,
  AlternateEmail,
  Settings,
  BugReport,
  Help,
  Assignment,
  PriorityHigh,
  Lightbulb,
  Psychology,
  ThumbUp,
  Comment,
  Visibility,
  Edit,
  CheckCircle,
  Schedule,
  Warning,
  Error as ErrorIcon,
  OpenInNew,
  Star,
  CalendarToday,
  Category,
  Flag,
  Badge as BadgeIcon,
  Speed as Speed,
  Reply,
} from '@mui/icons-material';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation } from '@tanstack/react-query';
import FullscreenChatWidget from './FullscreenChatWidget';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';

// Feedback System Interfaces and Constants
interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  coverage?: number;
}

interface ValidationRequest {
  sentAt: string;
  expiresAt: string;
  validationUrl: string;
}

interface UserResponse {
  validatedAt: string;
  userConfirmed: boolean;
  userComments: string;
  userRating: number;
}

interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  totalEndpoints: number;
  successfulEndpoints: number;
  failedEndpoints: number;
  averageResponseTime: number;
  checks: Array<{
    endpoint: string;
    status: number;
    responseTime: number;
    success: boolean;
    error?: string;
}>;
}

interface HealthCheckResult {
  endpoint: string;
  statusChange: number;
  responseTimeChange: number;
}

interface FeedbackVerification {
  automatedTests: {
    status: 'pending' | 'running' | 'passed' | 'failed';
    testResults: TestResult[];
    coverage: number;
};
  regressionTests: {
    status: 'pending' | 'running' | 'passed' | 'failed';
    affectedComponents: string[];
    testResults: TestResult[];
};
  userValidation: {
    status: 'pending' | 'sent' | 'validated' | 'failed';
    validationRequest?: ValidationRequest;
    userResponse?: UserResponse;
};
  systemHealth: {
    preDeployment: SystemHealthStatus;
    postDeployment: SystemHealthStatus;
    healthCheckResults: HealthCheckResult[];
};
}

interface FeedbackItem {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  profession: string;
  dashboardType: string;
  feedbackType: 'bug' | 'feature' | 'usability' | 'general' | 'ui_ux';
  title: string;
  description: string;
  rating: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component?: string;
  tags: string[];
  isAnonymous: boolean;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  adminNotes?: string;
  screenshotUrl?: string;
  verification?: FeedbackVerification;
  aiAnalysis?: {
    suggestedFixes: Array<{
      id: string;
      type: 'code_fix' | 'ui_improvement' | 'feature_addition' | 'performance_optimization';
      description: string;
      confidence: number;
      estimatedTime: string;
      deploymentRequired: boolean;
      filesToModify: string[];
      dependenciesToAdd: string[];
      problemSolved?: string;
      specificIssuesAddressed?: string[];
      expectedOutcome?: string;
      testingInstructions?: string[];
}>;
    autoFixAvailable: boolean;
    riskLevel: 'low' | 'medium' | 'high';
};
}

const feedbackTypeIcons: Record<string, any> = {
  bug: BugReport,
  feature: Lightbulb,
  usability: ThumbUp,
  ui_ux: Psychology,
  general: Comment
};

const feedbackTypeColors: Record<string, string> = {
  bug: '#f44336',
  feature: '#ff9800',
  usability: '#4caf50',
  ui_ux: '#9c27b0',
  general: '#2196f3', 
};

const priorityColors: Record<string, string> = {
  low: '#4caf50',
  medium: '#',
  high: '#',
  critical: '#9c27b0', 
};

const statusColors: Record<string, string> = {
  open: '#',
  in_progress: '#',
  resolved: '#4caf50',
  closed: '#757575', 
};

// Admin note templates for consistent responses
const adminNoteTemplates = [
  {
    label: 'Problembeskrivelse',
    content: '<h3>Problembeskrivelse:</h3><p>[Beskriv problemet detaljert]</p><h3>Planlagt løsning:</h3><p>[Hvordan problemet skal løses]</p><h3>Estimert, tid:</h3><p>[Forventet tid for løsning]</p>'
},
  {
    label: 'Forbedring implementert', 
    content: '<h3>Forbedring implementert ✅</h3><p><strong>Dato:</strong> ' + new Date().toLocaleDateString('no-NO') + '</p><p><strong>Endringer:</strong></p><ul><li>[Endre 1]</li><li>[Endring 2]</li></ul><p><strong>Testing:</strong> [Testet og verifisert]</p>'
},
  {
    label: 'Behov for mer informasjon',
    content: '<h3>Trenger mer informasjon ℹ️</h3><p><strong>Spørsmål til, bruker:</strong></p><ol><li>[Spørsmål 1]</li><li>[Spørsmål 2]</li></ol><p><strong>Kontaktinfo:</strong> [E-post/telefon]</p>'
},
  {
    label: 'Lukket - Løst',
    content: '<h3>Tilbakemelding løst ✅</h3><p><strong>Løsningsdato:</strong> ' + new Date().toLocaleDateString('no-NO') + '</p><p><strong>Implementerte løsninger:</strong></p><p>[Detaljert beskrivelse av løsningen]</p><p><strong>Oppfølging:</strong> [Ingen ytterligere handling nødvendig]</p>'
}
];

interface UniversalChatWidgetProps {
  profession?: string;
  userEmail?: string;
  userId?: string;
  isOpen?: boolean;
  onClose?: () => void;
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
  onSettingsUpdate?: (settings: any) => void;
  onNotificationCreate?: (notification: any) => void;
  // Feedback system integration props
  onFeedbackUpdate?: (feedback: any) => void;
  // CommunicationHubV2 integration props
  context?: {
    emailSubject?: string;
    emailBody?: string;
    noteTitle?: string;
    noteContent?: string;
    meetingTopic?: string;
  };
  onCreateNote?: (content: string) => void;
}

interface ChatPreview {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  type: 'client' | 'team' | 'support'
}

interface TicketFormData {
  title: string;
  description: string;
  category: 'bug' | 'feature_request' | 'question' | 'technical_issue' | 'account' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  chatContext?: string
}

interface TicketSuggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  icon: React.ReactNode;
  color: string
}

// ⚠️ CHAT & COMMUNICATION PROTOKOLL: WebSocket connection management
interface WebSocketConnection {
  socket: WebSocket | null;
  isConnected: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number
}

export default function UniversalChatWidget({
  profession: professionProp,
  userEmail,
  userId,
  isOpen: propIsOpen = false,
  onClose,
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
  onSettingsUpdate,
  onNotificationCreate,
  onFeedbackUpdate,
  context,
  onCreateNote
}: UniversalChatWidgetProps) {
  // Master integration system for "everything interacts with everything"
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Use dynamic profession system
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  
  // Use profession configs hook for additional profession data
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  
  // Use profession adapter for profession-specific adapters
  const professionAdapter = useProfessionAdapter();
  
  // Get current profession (from prop or dynamic system)
  const currentUserProfession = professionAdapter.profession || professionProp || 'photographer';
  const profession = currentUserProfession;
  
  // Get profession icon
  const professionIcon = getProfessionIcon(profession);
  
  // Get profession config
  const professionConfig = professionConfigs?.[profession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[profession] || professionConfig;
  
  // Get profession color from dynamic system
  const professionColor = getUserProfessionColor(profession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(profession);
  const { status: communicationStatus, testGoogleChat } = useCommunicationStatus();
  const [isOpen, setIsOpen] = useState(propIsOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);

  // Register this component in the integration system
  useEffect(() => {
    communication.registerComponent('universal-chat-widget','widget', [
      'message:send','message:receive','event:emit','event:listen','ui:update'
    ]);

    // Register in component registry for discoverability
    componentRegistry.registerComponent({
      id: 'universal-chat-widget',
      name: 'UniversalChatWidget',
      type: 'widget',
      category: 'communication',
      profession: profession,
      version: '2.1',
      capabilities: ['chat', 'email', 'feedback', 'evendi-bridge', 'ticket-creation'],
      props: { profession, userEmail, userId },
    });

    // Register integration actions for cross-component communication
    integration.registerAction('chat:sendMessage', (msg: Record<string, unknown>) => {
      if (msg.content && typeof msg.content === 'string') {
        setMessageInput(msg.content);
        setIsOpen(true);
        setIsExpanded(true);
      }
    });
    integration.registerAction('chat:openConversation', (data: Record<string, unknown>) => {
      if (data.conversationId && typeof data.conversationId === 'string') {
        setSelectedChat(data.conversationId);
        setIsOpen(true);
        setIsExpanded(true);
      }
    });

    // Register data flow node for chat data syncing
    const chatNodeId = dataFlow.registerNode({
      componentId: 'universal-chat-widget',
      type: 'both',
      dataKey: 'chat-messages',
      label: 'Chat Widget Data',
    });

    return () => {
      communication.unregisterComponent('universal-chat-widget');
      componentRegistry.unregisterComponent('universal-chat-widget');
      dataFlow.unregisterNode(chatNodeId);
};
}, [communication, componentRegistry, integration, dataFlow, profession, userEmail, userId]);

  // Listen to global events and update accordingly
  useEffect(() => {
    const unsubscribe = communication.onMessage((message: Record<string, unknown>) => {
      const msgType = message.type as string;
      const msgData = message.data as Record<string, unknown> | undefined;
      if (msgType === 'project:selected' && msgData) {
        console.log('Chat received project selection: ', msgData);
        if (onProjectSelect) onProjectSelect(msgData);
        if (onProjectUpdate) onProjectUpdate(msgData);
      }
      if (msgType === 'client:selected' && msgData) {
        console.log('Chat received client selection: ', msgData);
        if (onClientSelect) onClientSelect(msgData);
        if (onClientUpdate) onClientUpdate(msgData);
      }
      if (msgType === 'meeting:created' && msgData && onMeetingCreate) {
        onMeetingCreate(msgData);
      }
      if (msgType === 'worklog:created' && msgData && onWorklogCreate) {
        onWorklogCreate(msgData);
      }
      if (msgType === 'showcase:created' && msgData && onShowcaseCreate) {
        onShowcaseCreate(msgData);
      }
      if (msgType === 'file:uploaded' && msgData && onFileUpload) {
        onFileUpload(msgData);
      }
      if (msgType === 'file:downloaded' && msgData && onFileDownload) {
        onFileDownload(msgData);
      }
      if (msgType === 'chat:prefill' && (message.data as Record<string, unknown>)?.message) {
        try {
          setIsOpen(true);
          setIsExpanded(true);
          const prefillData = message.data as Record<string, unknown>;
          setMessageInput(prefillData.message as string);
          if (prefillData.selectConversationId) {
            setSelectedChat(prefillData.selectConversationId as string);
          }
        } catch (e) {
          console.warn('Failed to prefill chat:', e);
        }
      }
    });

    return unsubscribe;
}, [communication, onProjectSelect, onProjectUpdate, onClientSelect, onClientUpdate, onMeetingCreate, onWorklogCreate, onShowcaseCreate, onFileUpload, onFileDownload]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // queryClient is now imported from lib/queryClient
  // Tab states for enhanced functionality
  const [activeTab, setActiveTab] = useState(0); // 0 = Internal Chat, 1 = Google Chat, 2 = Feedback Management, 3 = Evendi
  const [emailIntegrationEnabled, setEmailIntegrationEnabled] = useState(true);
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(false);
  const [googleChatMenuAnchor, setGoogleChatMenuAnchor] = useState<null | HTMLElement>(null);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  
  // Push notifications
  const { user } = useAuth();
  const currentUserId = userId || user?.id || user?.sub;
  const { pushEnabled, isSupported } = usePushNotifications(currentUserId);
  
  // Ticket creation states
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketFormData, setTicketFormData] = useState<TicketFormData>({
    title: '',
    description: '',
    category: 'question',
    priority: 'medium',
    chatContext: ''
});
  const [showTicketSuggestions, setShowTicketSuggestions] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Feedback System State
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [feedbackStatusDialogOpen, setFeedbackStatusDialogOpen] = useState(false);
  const [feedbackDetailDialogOpen, setFeedbackDetailDialogOpen] = useState(false);
  const [newFeedbackStatus, setNewFeedbackStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  
  // Evendi Chat Bridge State
  const [evendiConversations, setEvendiConversations] = useState<any[]>([]);
  const [selectedEvendiConv, setSelectedEvendiConv] = useState<string | null>(null);
  const [evendiMessages, setEvendiMessages] = useState<any[]>([]);
  const [evendiReplyInput, setEvendiReplyInput] = useState('');
  const [evendiLoading, setEvendiLoading] = useState(false);
  const [evendiVendorName, setEvendiVendorName] = useState('');
  // Delivery notification state
  const [evendiDeliveries, setEvendiDeliveries] = useState<any[]>([]);
  const [showDeliveryNotify, setShowDeliveryNotify] = useState(false);  
  // ⚠️ CHAT & COMMUNICATION PROTOKOLL: Real-time WebSocket state
  const [wsConnection, setWsConnection] = useState<WebSocketConnection>({
    socket: null,
    isConnected: false,
    reconnectAttempts:  0,
    maxReconnectAttempts: 5 });
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync with prop changes
  useEffect(() => {
    console.log('🔄 Chat widget prop changed:', propIsOpen);
    setIsOpen(propIsOpen);
    if (!propIsOpen) {
      setIsExpanded(false);
}
}, [propIsOpen]);

  // Wire context prop for prefilling ticket/note content
  useEffect(() => {
    if (context) {
      if (context.emailSubject || context.emailBody) {
        setTicketFormData(prev => ({
          ...prev,
          title: context.emailSubject || prev.title,
          description: context.emailBody || prev.description,
        }));
      }
      if (context.noteContent && onCreateNote) {
        // Auto-create note when context provides note content
        onCreateNote(context.noteContent);
      }
    }
  }, [context, onCreateNote]);

  // Wire settings update callback when email/auto-response settings change
  useEffect(() => {
    if (onSettingsUpdate) {
      onSettingsUpdate({
        emailIntegrationEnabled,
        autoResponseEnabled,
        pushEnabled,
        pushSettingsOpen,
        profession,
        timestamp: new Date().toISOString(),
      });
    }
  }, [emailIntegrationEnabled, autoResponseEnabled, pushEnabled, pushSettingsOpen, onSettingsUpdate, profession]);

  // Sync selected project/client via data flow
  useEffect(() => {
    if (selectedProject) {
      dataFlow.syncData('chat-selected-project', selectedProject);
      integration.setData('selectedProject', selectedProject);
    }
  }, [selectedProject, dataFlow, integration]);

  useEffect(() => {
    if (selectedClient) {
      dataFlow.syncData('chat-selected-client', selectedClient);
      integration.setData('selectedClient', selectedClient);
    }
  }, [selectedClient, dataFlow, integration]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ⚠️ CHAT & COMMUNICATION PROTOKOLL: WebSocket connection with automatic reconnection
  useEffect(() => {
    if (isOpen) {
      connectWebSocket();
} else {
      disconnectWebSocket();
}
    
    return () => {
      disconnectWebSocket();
};
}, [isOpen]);

  const connectWebSocket = () => {
    if (wsConnection.socket?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        console.log('🔗 Chat WebSocket connected');
        setWsConnection(prev => ({
          ...prev,
          socket,
          isConnected: true,
          reconnectAttempts: 0 }));
        
        // Send initial connection message
        sendWebSocketMessage({
          type: 'presence_update',
          payload: { status: 'online' },
          timestamp: new Date().toISOString(),
          userId: userEmail || 'anonymous'
        });
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const validatedMessage = webSocketMessageSchema.parse(data);
          handleWebSocketMessage(validatedMessage);
    } catch (error) {
          console.error('🚨 Invalid WebSocket message:', error);
    }
  };
      
      socket.onclose = () => {
        console.log('🔗 Chat WebSocket disconnected');
        setWsConnection(prev => ({ ...prev, socket: null, isConnected: false }));
        
        // Automatic reconnection with exponential backoff
        if (wsConnection.reconnectAttempts < wsConnection.maxReconnectAttempts) {
          const delay = Math.pow(2, wsConnection.reconnectAttempts) * 1000;
          setTimeout(() => {
            setWsConnection(prev => ({ ...prev, reconnectAttempts: prev.reconnectAttempts + 1 }));
            connectWebSocket();
      }, delay);
    }
  };
      
      socket.onerror = (error) => {
        console.error('🚨 Chat WebSocket error:', error);
  };
      
} catch (error) {
      console.error('🚨 Failed to connect WebSocket:', error);
}
};
  
  const disconnectWebSocket = () => {
    if (wsConnection.socket) {
      wsConnection.socket.close();
      setWsConnection(prev => ({ ...prev, socket: null, isConnected: false }));
}
};
  
  const sendWebSocketMessage = (message: WebSocketMessageType) => {
    if (wsConnection.socket?.readyState === WebSocket.OPEN) {
      wsConnection.socket.send(JSON.stringify(message));
}
};
  
  const handleWebSocketMessage = (message: WebSocketMessageType) => {
    switch (message.type) {
      case 'chat_message': {
        const validatedChatMessage = chatMessageSchema.safeParse(message.payload);
        if (validatedChatMessage.success) {
          setMessages(prev => [...prev, validatedChatMessage.data]);
    }
        break;
      }
        
      case 'typing_indicator':
        if (message.payload.isTyping) {
          setTypingUsers(prev => [...prev.filter(u => u !== message.userId), message.userId]);
    } else {
          setTypingUsers(prev => prev.filter(u => u !== message.userId));
    }
        break;
        
      case 'presence_update':
        // Handle user presence updates
        console.log('👥 User presence update:', message.payload);
        break;
        
      default: console.log('🔄 Unhandled WebSocket message, :', message.type);
}
};

  // ⚠️ CHAT & COMMUNICATION PROTOKOLL: Type-safe message sending with validation
  const sendMessage = async () => {
    if (!messageInput.trim()) return;
    
    try {
      const messageData: ChatMessageType = {
        id: crypto.randomUUID(),
        conversationId: selectedChat || 'general',
        senderId: userEmail || 'anonymous',
        senderName: userEmail || 'Anonymous User',
        content: messageInput.trim(),
        messageType: 'text',
        timestamp: new Date().toISOString(),
        status: 'sent',
        metadata: {
          platform: 'creatorhub',
          priority: 'normal',
          encryption: true,
          gdprCompliant: true,
          backupStatus: 'pending'
  },
        attachments: []
};
      
      // Validate message before sending
      const validatedMessage = chatMessageSchema.parse(messageData);
      
      // Send via WebSocket for real-time delivery
      sendWebSocketMessage({
        type: 'chat_message',
        payload: validatedMessage,
        timestamp: new Date().toISOString(),
        userId: userEmail || 'anonymous',
        conversationId: selectedChat || 'general'
      });

      // Also persist to database via API
      await apiRequest('/api/chat/messages', {
        headers: {
          'Content-Type' : 'application/json','X-User-Email': userEmail || ','
        },
        method: 'POST',
        body: JSON.stringify(validatedMessage)
      });

      setMessageInput('');

      // Stop typing indicator
      if (isTyping) {
        setIsTyping(false);
        sendWebSocketMessage({
          type: 'typing_indicator',
          payload: { isTyping: false },
          timestamp: new Date().toISOString(),
          userId: userEmail || 'anonymous',
          conversationId: selectedChat || 'general'
        });
      }
      
} catch (error) {
      console.error('🚨 Failed to send message:', error);
}
};
  
  // Handle typing indicator with debouncing
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      sendWebSocketMessage({
        type: 'typing_indicator',
        payload: { isTyping: true },
        timestamp: new Date().toISOString(),
        userId: userEmail || 'anonymous',
        conversationId: selectedChat || 'general'
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendWebSocketMessage({
        type: 'typing_indicator',
        payload: { isTyping: false },
        timestamp: new Date().toISOString(),
        userId: userEmail || 'anonymous',
        conversationId: selectedChat || 'general'
      });
    }, 2000);
  };

  // Sync prop changes with local state
  useEffect(() => {
    setIsOpen(propIsOpen);
    if (propIsOpen) {
      setIsExpanded(true);
    }
  }, [propIsOpen]);

  // Resizable widget state
  const [widgetSize, setWidgetSize] = useState({ width: 400, height: 550 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });

  // Draggable widget state - Default to left side, away from SpeedDial
  const [widgetPosition, setWidgetPosition] = useState({ x: 24, y: 140 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startX: 0, startY: 0 });

  // Snap zones for positioning - Prefer left side positions
  const snapZones = [
    { name: 'Nederst venstre', x: () => 24, y: () => window.innerHeight - widgetSize.height - 24 },
    { name: 'Øverst venstre', x: () => 24, y: () => 24 },
    { name: 'Midt venstre', x: () => 24, y: () => (window.innerHeight - widgetSize.height) / 2 },
    { name: 'Standard (venstre)', x: () => 24, y: () => 140 },
    { name: 'Nederst høyre', x: () => window.innerWidth - widgetSize.width - 24, y: () => window.innerHeight - widgetSize.height - 24 },
    { name: 'Øverst høyre', x: () => window.innerWidth - widgetSize.width - 24, y: () => 24 },
    { name: 'Midt høyre', x: () => window.innerWidth - widgetSize.width - 24, y: () => (window.innerHeight - widgetSize.height) / 2 }
  ];

  // Fetch conversations from real API - NO MOCK DATA
  const { data: conversationsResponse } = useQuery({
    queryKey: ['/api/communication/conversations'],
    queryFn: () => apiRequest('/api/communication/conversations'),
    refetchInterval: 30000 // Refetch every 30 seconds for real-time updates
  });

  // Fetch feedback data for feedback management tab
  const { data: feedbackList = [], isLoading: feedbackLoading } = useQuery<FeedbackItem[]>({
    queryKey: ['/api/prototype-testing/feedback'],
    queryFn: async () => {
	    const response = await apiRequest('/api/prototype-testing/feedback');
      return response.feedback || [];
    },
    enabled: false, // Disabled - endpoint not implemented
    refetchInterval: 30000, // Reduced from 3s to 30s to reduce spam
    staleTime: 0 // Always fetch fresh data
  });

  // Fetch Evendi conversations for vendor users
  useEffect(() => {
    if (activeTab === 3) {
      fetchEvendiConversations();
    }
  }, [activeTab]);

  const fetchEvendiConversations = async () => {
    try {
      setEvendiLoading(true);
      const data = await apiRequest('/api/evendi/conversations');
      setEvendiConversations(data.conversations || []);
      setEvendiVendorName(data.vendorName || '');
    } catch (err) {
      console.warn('Evendi conversations not available:', err);
      setEvendiConversations([]);
    } finally {
      setEvendiLoading(false);
    }
  };

  const fetchEvendiMessages = async (conversationId: string) => {
    try {
      setEvendiLoading(true);
      const data = await apiRequest(`/api/evendi/conversations/${conversationId}/messages`);
      setEvendiMessages(data.messages || []);
      setSelectedEvendiConv(conversationId);
    } catch (err) {
      console.error('Failed to fetch evendi messages:', err);
    } finally {
      setEvendiLoading(false);
    }
  };

  const sendEvendiMessage = async () => {
    if (!evendiReplyInput.trim() || !selectedEvendiConv) return;
    try {
      await apiRequest(`/api/evendi/conversations/${selectedEvendiConv}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: evendiReplyInput.trim() }),
        headers: { 'Content-Type': 'application/json' }
      });
      setEvendiReplyInput('');
      // Refresh messages
      fetchEvendiMessages(selectedEvendiConv);
      // Refresh conversation list to update last message
      fetchEvendiConversations();
    } catch (err) {
      console.error('Failed to send evendi message:', err);
    }
  };

  // Send delivery notification via chat
  const sendDeliveryNotification = async (deliveryId: string) => {
    try {
      setEvendiLoading(true);
      const result = await apiRequest('/api/evendi/delivery-notify-chat', {
        method: 'POST',
        body: JSON.stringify({ deliveryId }),
        headers: { 'Content-Type': 'application/json' }
      });
      setShowDeliveryNotify(false);
      // Refresh conversations to show the new message
      fetchEvendiConversations();
      if (result.conversationId) {
        fetchEvendiMessages(result.conversationId);
      }
    } catch (err) {
      console.error('Failed to send delivery notification:', err);
    } finally {
      setEvendiLoading(false);
    }
  };

  // Fetch deliveries list for notification picker
  const fetchEvendiDeliveries = async () => {
    try {
      const data = await apiRequest('/api/evendi/delivery-project-bridge');
      setEvendiDeliveries(data.deliveries || []);
    } catch (err) {
      console.warn('Could not fetch deliveries:', err);
    }
  };

  // Transform conversations to chat previews format
  const conversations = conversationsResponse?.conversations || [];
  const chatPreviews = conversations.map((conv: { id?: string; d?: string; name?: string; lastMessage?: { content?: string; timestamp?: string }; createdAt?: string; unreadCount?: number; avatar?: string; isOnline?: boolean; type?: string }) => ({
    id: conv.id || conv.d,
    name: conv.name || `Samtale ${conv.id || conv.d}`,
    lastMessage: conv.lastMessage?.content || 'Ingen meldinger ennå',
    timestamp: conv.lastMessage?.timestamp || conv.createdAt || new Date().toISOString(),
    unreadCount: conv.unreadCount || 0,
    avatar: conv.avatar,
    status: conv.isOnline ? 'online' : 'offline' as const,
    type: conv.type === 'group' ? 'team' : 'client' as const,
  }));

  // Get total unread count
  const totalUnreadCount = chatPreviews.reduce((total: number, chat: ChatPreview) =>
    total + (chat.unreadCount || 0), 0
  );

  const getProfessionColor = () => {
    // Use profession color from dynamic system
    return professionColor;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'away': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'nå';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}t`;
    return date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short',});
};

  const handleOpenFullscreen = () => {
    setIsFullscreen(true);
    setIsOpen(false);
};

  // Load widget size/position (server first, fallback to localStorage)
  useEffect(() => {
    fetch('/api/user/ui-preferences', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const cw = j?.data?.chat_widget;
        if (cw?.size) setWidgetSize(cw.size);
        if (cw?.position) setWidgetPosition(cw.position);

        if (!cw) {
          const savedSize = localStorage.getItem('chat-widget-size');
          if (savedSize) {
            try { setWidgetSize(JSON.parse(savedSize)); } catch (e) { console.warn('Invalid saved chat widget size:', e); }
          }
          const savedPosition = localStorage.getItem('chat-widget-position');
          if (savedPosition) {
            try { setWidgetPosition(JSON.parse(savedPosition)); } catch (e) { console.warn('Invalid saved chat widget position:', e); }
          }
        }
      })
      .catch(() => {
        const savedSize = localStorage.getItem('chat-widget-size');
        if (savedSize) {
          try { setWidgetSize(JSON.parse(savedSize)); } catch (e) { console.warn('Invalid saved chat widget size:', e); }
        }
        const savedPosition = localStorage.getItem('chat-widget-position');
        if (savedPosition) {
          try { setWidgetPosition(JSON.parse(savedPosition)); } catch (e) { console.warn('Invalid saved chat widget position:', e); }
        }
      });
  }, []);

  // Save widget size
  const saveWidgetSize = (newSize: { width: number; height: number }) => {
    setWidgetSize(newSize);
    localStorage.setItem('chat-widget-size', JSON.stringify(newSize));
    fetch('/api/user/ui-preferences', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ chatWidget: { ...(typeof (window as any) !== 'undefined' ? { device: 'web' } : {}), size: newSize, position: widgetPosition } })
    }).catch(() => {});
  };

  // Save widget position
  const saveWidgetPosition = (newPosition: { x: number; y: number }) => {
    setWidgetPosition(newPosition);
    localStorage.setItem('chat-widget-position', JSON.stringify(newPosition));
    fetch('/api/user/ui-preferences', {
      method: 'POST', headers: { 'Content-Type' : 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ chatWidget: { ...(typeof (window as any) !== 'undefined' ? { device: 'web' } : {}), size: widgetSize, position: newPosition } })
    }).catch(() => {});
  };

  // Find closest snap zone
  const findClosestSnapZone = (x: number, y: number) => {
    let closestZone = snapZones[0];
    let closestDistance = Infinity;

    snapZones.forEach(zone => {
      const zoneX = zone.x();
      const zoneY = zone.y();
      const distance = Math.sqrt(Math.pow(x - zoneX, 2) + Math.pow(y - zoneY, 2));
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestZone = zone;
  }
});

    return { zone: closestZone, distance: closestDistance };
};

  // Snap to closest zone if within threshold
  const snapToZone = (x: number, y: number) => {
    const { zone, distance } = findClosestSnapZone(x, y);
    const snapThreshold = 80; // pixels

    if (distance < snapThreshold) {
      return { x: zone.x(), y: zone.y(), snapped: true, zoneName: zone.name };
    }
    return { x, y, snapped: false, zoneName: null };
  };

  // Handle resize mouse events
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY });
};

  // Handle drag mouse events
  const handleDragStart = (e: React.MouseEvent) => {
    if (isResizing) return; // Don't start drag if we're resizing
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ 
      x: e.clientX, 
      y: e.clientY, 
      startX: widgetPosition.x,
      startY: widgetPosition.y 
    });
};

  // Handle resize and drag mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = resizeStart.x - e.clientX;
        const deltaY = e.clientY - resizeStart.y;
        
        const newWidth = Math.max(30, Math.min(800, widgetSize.width + deltaX));
        const newHeight = Math.max(300, Math.min(700, widgetSize.height + deltaY));
        
        setWidgetSize({ width: newWidth, height: newHeight });
        setResizeStart({ x: e.clientX, y: e.clientY });
  } else if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        
        const newX = Math.max(0, Math.min(window.innerWidth - widgetSize.width, dragStart.startX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - widgetSize.height, dragStart.startY + deltaY));
        
        setWidgetPosition({ x: newX, y: newY });
  }
};

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        saveWidgetSize(widgetSize);
  }
      if (isDragging) {
        setIsDragging(false);
        // Apply snap-to-zone when releasing drag
        const snappedPosition = snapToZone(widgetPosition.x, widgetPosition.y);
        const finalPosition = snappedPosition.snapped ? { x: snappedPosition.x, y: snappedPosition.y } : widgetPosition;
        setWidgetPosition(finalPosition);
        saveWidgetPosition(finalPosition);
        
        // Show snap feedback if snapped
        if (snappedPosition.snapped) {
          console.log(`Chat snappet til: ${snappedPosition.zoneName}`);
    }
  }
};

    if (isResizing || isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
}

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
};
}, [isResizing, isDragging, resizeStart, dragStart, widgetSize, widgetPosition]);

  const sendQuickMessage = useMutation({
    mutationFn: async (data: { chatId: string; message: string }) => {
      return apiRequest('/api/communication/send-message', {
        headers: {
	        'X-User-Email': userEmail || ','
        },
        method: 'POST',
        body: JSON.stringify({
          conversationId: data.chatId,
          content: data.message,
          messageType: 'text'
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations'] });
      setMessageInput('');
    }
  });

  // E-post integrasjon
  const sendEmailMessage = useMutation({
    mutationFn: async (data: { chatId: string; message: string; subject?: string }) => {
      return apiRequest('/api/emails/send', {
        headers: {
	        'X-User-Email': userEmail || ','
        },
        method: 'POST',
        body: JSON.stringify({
          to: selectedChat ? chatPreviews.find((c: ChatPreview) => c.id === selectedChat)?.name : '',
          subject: data.subject || 'Melding fra CreatorHub Norge',
          message: data.message,
          conversationId: data.chatId
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations'] });
      setMessageInput('');
    }
  });

  // Ticket creation mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: TicketFormData) => {
      return apiRequest('/api/helpdesk/tickets', {
        headers: {
          'X-User-Email': userEmail || ',','Content-Type' : 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
          title: ticketData.title,
          description: ticketData.description,
          category: ticketData.category,
          priority: ticketData.priority,
          userEmail: userEmail || 'anonymous',
          userId: userId || 'anonymous',
          profession: profession,
          chatContext: ticketData.chatContext,
          dashboardFeature: 'chat-widget'
        })
      });
    },
    onSuccess: (response: { ticket?: { id?: string } }) => {
      setSnackbarMessage(`🎫 Support-sak opprettet! Ticket ID: ${response.ticket?.id || 'N/A'}`);
      setSnackbarOpen(true);
      setTicketDialogOpen(false);
      resetTicketForm();

      // Broadcast ticket creation event
      communication.sendBroadcast('helpdesk:ticket-created', {
        type: 'ticket_created',
        data: response.ticket,
        component: 'UniversalChatWidget'
      });
    },
    onError: (error: Error) => {
      setSnackbarMessage(`❌ Feil ved opprettelse av support-sak: ${error.message}`);
      setSnackbarOpen(true);
    }
  });

  // Feedback update mutation
  const updateFeedbackStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes: string }) => {
      return apiRequest(`/api/prototype-testing/feedback/${id}`, {
        headers: {
          'X-User-Email': userEmail || ','
        },
        method: 'PUT',
        body: JSON.stringify({ status, adminNotes })
      });
    },
    onSuccess: (_data: unknown, variables: { id: string; status: string; adminNotes: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/prototype-testing/feedback'] });
      setFeedbackStatusDialogOpen(false);
      setSelectedFeedback(null);

      // Trigger unified workflow events
      if (onNotificationCreate) {
        onNotificationCreate({
          id: `feedback_status_updated_${Date.now()}`,
          type: 'feedback_status_updated',
          title: 'Feedback Status Updated',
          message: `Feedback status changed to ${variables.status}`,
          priority: 'medium',
          timestamp: new Date().toISOString(),
          source: 'universal_chat_widget'
        });
      }

      if (onFeedbackUpdate && selectedFeedback) {
        onFeedbackUpdate({
          id: selectedFeedback.id,
          status: variables.status,
          adminNotes: variables.adminNotes,
          updatedBy: userEmail || 'admin',
          updatedAt: new Date().toISOString(),
          source: 'universal_chat_widget'
        });
      }
    },
    onError: (error: Error) => {
      setSnackbarMessage(`❌ Feil ved oppdatering av feedback: ${error.message}`);
      setSnackbarOpen(true);
    }
  });

  // Deployment tracking mutation for verification workflow
  const deployFeedbackFixMutation = useMutation({
    mutationFn: async ({ feedbackId, fixId }: { feedbackId: string; fixId: string }) => {

      // Start deployment with verification workflow
	    const deploymentResult = await apiRequest(`/api/deployment/feedback-deploy`, {
	      headers: {
	        'X-User-Email': userEmail || ','
	      },
	      method: 'POST',
	      body: JSON.stringify({
	        feedbackId,
	        fixId,
	        verificationWorkflow: true,
	        chatContext: selectedChat || 'chat-widget'
	      })
	    });

      return deploymentResult;
    },
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['/api/prototype-testing/feedback'] });

      // Show success notification
      setSnackbarMessage(`🚀 Fix deployed with verification workflow! Check status in feedback tab.`);
      setSnackbarOpen(true);

      // Broadcast deployment event
      communication.sendBroadcast('deployment:feedback-fix-deployed', {
        type: 'deployment_completed',
        data: data,
        component: 'UniversalChatWidget'
      });
    },
    onError: (error: Error) => {
      setSnackbarMessage(`❌ Deployment failed: ${error.message}`);
      setSnackbarOpen(true);
    }
  });

  const handleQuickReply = () => {
    if (messageInput.trim() && selectedChat) {
      // Also send via WebSocket for real-time delivery
      sendMessage();
      if (activeTab === 1 && emailIntegrationEnabled) {
        // Send as email
        sendEmailMessage.mutate({
          chatId: selectedChat,
          message: messageInput.trim(),
          subject: `Ny melding fra ${profession}`
        });
      } else {
        // Send as chat message
        sendQuickMessage.mutate({
          chatId: selectedChat,
          message: messageInput.trim()
        });
      }
    }
  };

  // Ticket creation helper functions
  const resetTicketForm = () => {
    setTicketFormData({
      title: ', ',
      description: ', ',
      category: 'question',
      priority: 'medium',
      chatContext: ', '
    });
  };

  const handleCreateTicket = () => {
    if (!ticketFormData.title.trim() || !ticketFormData.description.trim()) {
      setSnackbarMessage('❌ Tittel og beskrivelse er påkrevd');
      setSnackbarOpen(true);
      return;
    }

    createTicketMutation.mutate(ticketFormData);
  };

  const handleTicketSuggestion = (suggestion: TicketSuggestion) => {
    setTicketFormData({
      ...ticketFormData,
      title: suggestion.title,
      description: suggestion.description,
      category: suggestion.category as 'bug' | 'feature' | 'question' | 'other',
      priority: suggestion.priority as 'low' | 'medium' | 'high' | 'urgent'
    });
    setShowTicketSuggestions(false);
  };

  const getTicketSuggestions = (): TicketSuggestion[] => {
    return [
      {
        id: 'bug-report',
        title: 'Rapporter en feil',
        description: 'Jeg har oppdaget en feil i systemet som trenger å bli fikset.',
        category: 'bug',
        priority: 'high',
        icon: <BugReport />,
        color: '#f44336'
},
      {
        id: 'feature-request',
        title: 'Foreslå ny funksjonalitet',
        description: 'Jeg har en idé til en ny funksjonalitet som kunne forbedre systemet.',
        category: 'feature_request',
        priority: 'medium',
        icon: <Lightbulb />,
        color: '#2196f3'
},
      {
        id: 'technical-issue',
        title: 'Teknisk problem',
        description: 'Jeg har problemer med å bruke en teknisk funksjonalitet.',
        category: 'technical_issue',
        priority: 'medium',
        icon: theming.getThemedIcon(''),
        color: '#ff9800'
},
      {
        id: 'account-help',
        title: 'Kontohjelp',
        description: 'Jeg trenger hjelp med kontoinnstillinger eller tilgang.',
        category: 'account',
        priority: 'medium',
        icon: <Help />,
        color: '#4caf50'
},
      {
        id: 'general-question',
        title: 'Generelt spørsmå',
        description: 'Jeg har et spørsmål om hvordan jeg bruker systemet.',
        category: 'question',
        priority: 'low',
        icon: <Help />,
        color: '#9c27b0'
}
    ];
};

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'bug': return <BugReport />;
      case 'feature_request': return <Lightbulb />;
      case 'technical_issue': return theming.getThemedIcon(', ');
      case 'account': return <Help />;
      case 'question': return <Help />;
      default: return <Help />;
}
};

  // Get priority icon for high/critical priorities
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <ErrorIcon sx={{ color: '#d32f2f' }} />;
      case 'high': return <PriorityHigh sx={{ color: '#f57c00' }} />;
      case 'medium': return <Warning sx={{ color: '#1976d2' }} />;
      case 'low': return <CheckCircle sx={{ color: '#388e3c' }} />;
      default: return <Schedule sx={{ color: '#757575' }} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#d32f2f';
      case 'high': return '#f57c00';
      case 'medium': return '#1976d2';
      case 'low': return '#388e3c';
      default: return '#1976d2';
}
};

  // Verification status helper functions
  const getVerificationStatus = (feedback: FeedbackItem): 'pending' | 'verified' | 'failed' | 'in-progress' => {
    if (!feedback.verification) return 'pending';
    
    const { automatedTests, regressionTests, userValidation } = feedback.verification;
    
    // Check if all verification steps are complete and passed
    if (automatedTests.status === 'passed' && 
        regressionTests.status === 'passed' && 
        userValidation.status === 'validated') {
      return 'verified';
}
    
    // Check if any step failed
    if (automatedTests.status === 'failed' || 
        regressionTests.status === 'failed' || 
        userValidation.status === 'failed') {
      return 'failed';
}
    
    // Check if any step is in progress
    if (automatedTests.status === 'running' || 
        regressionTests.status === 'running' || 
        userValidation.status === 'sent') {
      return 'in-progress';
}
    
    return 'pending';
};

  // Feedback helper functions
  const getFeedbackStats = () => {
    const stats = {
      total: feedbackList.length,
      open: feedbackList.filter(f => f.status === 'open').length,
      in_progress: feedbackList.filter(f => f.status === 'in_progress').length,
      resolved: feedbackList.filter(f => f.status === 'resolved').length,
      critical: feedbackList.filter(f => f.priority === 'critical').length,
      high: feedbackList.filter(f => f.priority === 'high').length,
      verified: feedbackList.filter(f => getVerificationStatus(f) === 'verified').length,
      failed: feedbackList.filter(f => getVerificationStatus(f) === 'failed').length,
      avgRating: feedbackList.length > 0 ? 
        feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length : 0 };
    return stats;
};

  const handleFeedbackStatusUpdate = () => {
    if (selectedFeedback && newFeedbackStatus) {
      updateFeedbackStatusMutation.mutate({
        id: selectedFeedback.d,
        status: newFeedbackStatus,
        adminNotes
  });
}
};

  const openFeedbackStatusDialog = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    setNewFeedbackStatus(feedback.status);
    setAdminNotes(feedback.adminNotes || ', ');
    setFeedbackStatusDialogOpen(true);
};

  const openFeedbackDetailDialog = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    setFeedbackDetailDialogOpen(true);
};

  const getFeedbackTypeIcon = (type: string) => {
    const IconComponent = feedbackTypeIcons[type] || Comment;
    return <IconComponent />;
};

  const getFeedbackTypeColor = (type: string) => {
    return feedbackTypeColors[type] || '#2196f3';
};

  const getFeedbackPriorityColor = (priority: string) => {
    return priorityColors[priority] || '#ff9800';
};

  const getFeedbackStatusColor = (status: string) => {
    return statusColors[status] || '#2196f3';
};

  const feedbackStats = getFeedbackStats();

  return (
    <>
      {/* Chat Widget Panel */}
      {(isOpen || isExpanded) && (
        <Box sx={{
          position: 'fixed',
          top: widgetPosition.y,
          left: widgetPosition.x,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1
        }}>
          {/* Chat Preview Panel - Resizable */}
          <Paper elevation={8} sx={{
            width: widgetSize.width,
            height: widgetSize.height,
            borderRadius: 3,
            overflow: 'hidden',
            border: `2px solid ${getProfessionColor()}`,
            mb: 1,
            position: 'relative',
            cursor: isResizing ? 'nw-resize' : 'default',
            userSelect: isResizing ? 'none' : 'auto',
            ...theming.getThemedCardSx()
          }}>
            {/* Header with drag handle */}
            <Box
              onMouseDown={handleDragStart}
              sx={{
                p: 2,
                bgcolor: getProfessionColor(),
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none'
              }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Resize Handle - øverst til venstre */}
                <Tooltip title="Endre størrelse">
                  <IconButton
                    size="small"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleResizeStart(e);
                    }}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      cursor: 'nw-resize',
                      p: 0.5,
                      mr: 0.5, '&:hover': {
                        color: 'white',
                        bgcolor: 'rgba(255, 255, 255, 0.1)'
                      }
                    }}
                  >
                    <OpenWith fontSize="small" />
                  </IconButton>
                </Tooltip>
                {professionIcon && (
                  <Box sx={{ color: 'white', display: 'flex', alignItems: 'center', mr: 0.5 }}>
                    {professionIcon}
                  </Box>
                )}
                {theming.getThemedIcon('chat')}
                <Typography variant="h6" sx={{ fontWeight: 600, color: theming.colors.primary }}>
                  {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                    ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} - Google Chat Integration v2.1`
                    : 'Google Chat Integration v2.1'}
                </Typography>
                <Chip
                  icon={
                    activeTab === 0 ? <img src="/creatorhub-logo-amber.svg" alt="" style={{ width: 16, height: 16 }} /> :
                    activeTab === 3 ? <img src="/evendi-logo.png" alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} /> :
                    undefined
                  }
                  label={activeTab === 0 ? "CREATORHUB" : activeTab === 1 ? "GOOGLE CHAT" : activeTab === 2 ? "FEEDBACK" : "EVENDI"}
                  size="small"
                  sx={{
                    bgcolor: activeTab === 0 ? '#FF5722' : activeTab === 1 ? '#4285F4' : activeTab === 2 ? '#9C27B0' : '#E91E63',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    '& .MuiChip-icon': { ml: 0.5 }
                  }}
                />
                {totalUnreadCount > 0 && (
                  <Chip
                    label={totalUnreadCount}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      fontWeight: 'bold'
                    }}
                  />
                )}
                {/* Google Chat API Status Indicator */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    ml: 1 }}
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
              <Box sx={{ display: 'flex', gap: 0.5}}>
                <Tooltip title="Opprett support-sak">
                  <IconButton 
                    size="small" 
                    sx={{ color: 'white'}}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTicketDialogOpen(true);
                      setShowTicketSuggestions(true);
                }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Support />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Åpne i fullskjerm">
                  <IconButton 
                    size="small" 
                    sx={{ color: 'white'}}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFullscreen();
                }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {theming.getThemedIcon('fullscreen')}
                  </IconButton>
                </Tooltip>
{activeTab === 1 && (
                  <IconButton 
                    size="small" 
                    sx={{ color: 'white'}}
                    onClick={(e) => {
                      e.stopPropagation();
                      setGoogleChatMenuAnchor(e.currentTarget);
                }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {theming.getThemedIcon('moreVert')}
                  </IconButton>
                )}
                {isSupported && (
                  <Tooltip title="Push-varsler innstillinger">
                    <IconButton 
                      size="small" 
                      sx={{ color: pushEnabled ? 'rgba(255, 255, 255, 0.9)' : 'white' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPushSettingsOpen(true);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {pushEnabled ? <NotificationsActive /> : <Notifications />}
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton 
                  size="small" 
                  sx={{ color: 'white'}}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
              }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {theming.getThemedIcon('settings')}
                </IconButton>
                <Tooltip title="Lukk chat">
                  <IconButton 
                    size="small" 
                    sx={{ color: 'white'}}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log('🔴 X-knapp klikket - lukker chat, onClose:', !!onClose);
                      // Call parent close first
                      onClose?.();
                      // Then update internal states
                      setIsExpanded(false);
                      setIsOpen(false);
                }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                }}
                  >
                    {theming.getThemedIcon('close')}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Google Chat Integration Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(255, 255, 255, 0.1)' }}>
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                variant="fullWidth"
                sx={{
                  minHeight: 60,
                  '& .MuiTab-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    minHeight: 60,
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 2,
                    mx: 0.5, '&:hover': {
                      bgcolor: 'rgba(255, 255, 255, 0.1)'
                    }, '&.Mui-selected': {
                      color: 'white !important',
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      border: '2px solid white'
                    }
                  }, '& .MuiTabs-indicator': {
                    display: 'none'
                  }
                }}
              >
                <Tab
                  icon={<img src="/creatorhub-logo-amber.svg" alt="CreatorHub" style={{ width: 24, height: 24 }} />}
                  label="CREATORHUB"
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
                <Tab
                  icon={<Google sx={{ fontSize: 24 }} />}
                  label="GOOGLE CHAT"
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
                <Tab
                  icon={<BugReport sx={{ fontSize: 24 }} />}
                  label="FEEDBACK"
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
                <Tab
                  icon={<img src="/evendi-logo.png" alt="Evendi" style={{ width: 24, height: 24, borderRadius: '50%' }} />}
                  label="EVENDI"
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
              </Tabs>
            </Box>

            {/* Tab Content - Dynamic height based on widget size */}
            <Box sx={{
              height: widgetSize.height - 200, // Subtract header, tabs and input areas
              overflow: 'auto'
            }}>
              {activeTab === 0 ? (
                // Internal Chat Tab
                <>
                  {/* Selected project/client context display */}
                  {selectedProject && (
                    <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Assignment fontSize="small" sx={{ color: professionColor }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Prosjekt: {selectedProject?.name || 'Valgt prosjekt'}
                      </Typography>
                      <CalendarToday sx={{ fontSize: 14, ml: 'auto', color: 'text.secondary' }} />
                    </Box>
                  )}
                  {selectedClient && (
                    <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BadgeIcon fontSize="small" sx={{ color: professionColor }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        Klient: {selectedClient?.name || 'Valgt klient'}
                      </Typography>
                      <Category sx={{ fontSize: 14, ml: 'auto', color: 'text.secondary' }} />
                    </Box>
                  )}
                  {/* Quick Actions when chat selected */}
                  {selectedChat && (
                    <Box sx={{ px: 2, py: 1, bgcolor: `${professionColor}08`, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title="E-post">
                        <IconButton size="small" onClick={() => { if (onFileUpload) onFileUpload({ type: 'email', chatId: selectedChat }); }}>
                          <Email fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Ring">
                        <IconButton size="small" onClick={() => { if (onMeetingCreate) onMeetingCreate({ type: 'call', chatId: selectedChat }); }}>
                          <Phone fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Videosamtale">
                        <IconButton size="small" onClick={() => { if (onMeetingCreate) onMeetingCreate({ type: 'video', chatId: selectedChat }); }}>
                          <VideoCall fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Divider orientation="vertical" flexItem />
                      <Tooltip title="Favoritt">
                        <IconButton size="small">
                          <Star fontSize="small" sx={{ color: '#ff9800' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Flagg">
                        <IconButton size="small">
                          <Flag fontSize="small" sx={{ color: '#f44336' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Opprett notat">
                        <IconButton size="small" onClick={() => { if (onCreateNote) onCreateNote(`Notat fra samtale ${selectedChat}`); }}>
                          <Assignment fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                  {chatPreviews.length > 0 ? (
                <List sx={{ p: 0 }}>
                  {chatPreviews.map((chat: ChatPreview) => (
                    <ListItem
                      key={chat.id}
                      component="div"
                      onClick={() => setSelectedChat(chat.id)}
                      sx={{
                        borderLeft: selectedChat === chat.id ? 3 : 0,
                        borderColor: getProfessionColor(),
                        bgcolor: selectedChat === chat.id ? `${getProfessionColor()}10` : 'transparent'
                      }}
                    >
                      <ListItemAvatar>
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          badgeContent={
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: getStatusColor(chat.status),
                                border: '2px solid white'
                              }}
                            />
                          }
                        >
                          <Avatar src={chat.avatar} sx={{ width:  36, height: 36}}>
                            {chat.name.charAt(0)}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {chat.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(chat.timestamp)}
                            </Typography>
                          </Box>
                    }
                        secondary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <Typography 
                              variant="caption" 
                              color="text.secondary"
                              sx={{ 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 180 }}
                            >
                              {chat.lastMessage}
                            </Typography>
                            {chat.unreadCount > 0 && (
                              <Chip
                                label={chat.unreadCount}
                                size="small"
                                sx={{
                                  bgcolor: getProfessionColor(),
                                  color: 'white',
                                  height:  18,
                                  fontSize: '0.7rem'
                          }}
                              />
                            )}
                          </Box>
                    }
                      />
                    </ListItem>
                  ))}
                </List>
                ) : (
                  <Box sx={{ p:  3, textAlign: 'center'}}>
                    <img src="/creatorhub-logo-amber.svg" alt="CreatorHub" style={{ width: 48, height: 48, opacity: 0.5, marginBottom: 8 }} />
                    <Typography variant="body2" color="text.secondary">
                      Ingen nye meldinger
                    </Typography>
                  </Box>
                )}
                  {/* WebSocket real-time messages */}
                  {selectedChat && messages.length > 0 && (
                    <Box sx={{ px: 2, py: 1 }}>
                      <Divider sx={{ mb: 1 }}>
                        <Chip icon={<Chat />} label="Live meldinger" size="small" />
                      </Divider>
                      {messages.slice(-5).map((msg) => (
                        <Box key={msg.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, bgcolor: professionColor }}>
                            {msg.senderId === userEmail ? <Person sx={{ fontSize: 14 }} /> : <Group sx={{ fontSize: 14 }} />}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>{msg.senderName}</Typography>
                            <Typography variant="body2">{msg.content}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                              <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">{formatTime(msg.timestamp)}</Typography>
                              {msg.status === 'delivered' && <Visibility sx={{ fontSize: 12, color: '#4caf50' }} />}
                              {msg.status === 'sent' && <CheckCircle sx={{ fontSize: 12, color: 'text.secondary' }} />}
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {/* Typing indicator */}
                  {typingUsers.length > 0 && (
                    <Box sx={{ px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <MinimizeRounded sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {typingUsers.join(', ')} skriver...
                      </Typography>
                    </Box>
                  )}
                  <div ref={messagesEndRef} />
                </>
              ) : activeTab === 1 ? (
                // Google Chat Tab
                <Box sx={{ p:  3 }}>
                  <Box sx={{ textAlign: 'center', mb: 3 }}>
                    <Google sx={{ fontSize:  64, color: '#', mb: 2 }} />
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Google Chat Integration</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                      Connect with your Google Chat spaces and colleagues directly from CreatorHub Norge
                    </Typography>
                    <Button variant="contained" 
                      startIcon={<Google />}
                      sx={{ bgcolor: '#','&:hover': { bgcolor: '#3367D6',} }}
                      onClick={() => console.log('Google Chat authorization')}
                    >
                      Connect Google Chat
                    </Button>
                  </Box>
                  
                  {/* Email & Auto-Response Settings */}
                  <Box sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', p: 1.5, '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}
                      onClick={() => setChatSettingsOpen(prev => !prev)}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Settings fontSize="small" />
                        Kommunikasjonsinnstillinger
                      </Typography>
                      {chatSettingsOpen ? <ExpandLess /> : <ExpandMore />}
                    </Box>
                    <Collapse in={chatSettingsOpen}>
                      <Box sx={{ px: 2, pb: 2 }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={emailIntegrationEnabled}
                              onChange={(e) => setEmailIntegrationEnabled(e.target.checked)}
                              color="primary"
                            />
                          }
                          label="E-post integrasjon"
                        />
                        <FormControlLabel
                          control={
                            <Switch
                              checked={autoResponseEnabled}
                              onChange={(e) => setAutoResponseEnabled(e.target.checked)}
                              color="primary"
                            />
                          }
                          label="Automatisk svar"
                        />
                        {autoResponseEnabled && (
                          <Alert severity="info" sx={{ mt: 1 }}>
                            <Typography variant="caption">
                              Automatisk svar er aktivert. Innkommende meldinger vil motta et standardsvar.
                            </Typography>
                          </Alert>
                        )}
                      </Box>
                    </Collapse>
                  </Box>

                  {/* Google Chat API Status */}
                  <Box sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: communicationStatus.googleChatStatus === 'connected' ? '#e8f5e8' : '#ffebee',
                    border: `1px solid ${communicationStatus.googleChatStatus === 'connected' ? '#4caf50' : '#f44336'}20`,
                    mb: 2
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            backgroundColor: communicationStatus.googleChatStatus === 'connected' ? '#4caf50' : '#f44336'
                          }}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                          Google Chat API Status
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => await testGoogleChat()}
                        sx={{ fontSize: '0.7rem', py: 0.5 }}
                      >
                        Test API
                      </Button>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Status: {communicationStatus.googleChatStatus === 'connected' ? 'Connected' : 'Disconnected'}
                    </Typography>
                    {communicationStatus.googleChatResponse && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        Response: {communicationStatus.googleChatResponse}
                      </Typography>
                    )}
                    {communicationStatus.googleChatLastCheck && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Last check: {communicationStatus.googleChatLastCheck.toLocaleTimeString()}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ) : activeTab === 2 ? (
                // Feedback Management Tab
                <Box sx={{ p: 2 }}>
                  {feedbackLoading ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Laster feedback...
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      {/* Feedback Stats */}
                      <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#e3f2fd', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>{feedbackStats.open}</Typography>
                          <Typography variant="caption">Åpne</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#fff3e0', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>{feedbackStats.in_progress}</Typography>
                          <Typography variant="caption">Pågår</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#e8f5e8', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>{feedbackStats.resolved}</Typography>
                          <Typography variant="caption">Løst</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#e8f5e8', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>{feedbackStats.verified}</Typography>
                          <Typography variant="caption">✅ Verifisert</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#ffebee', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="error.main" sx={{ color: theming.colors.primary }}>{feedbackStats.failed}</Typography>
                          <Typography variant="caption">❌ Feilet</Typography>
                        </Paper>
                      </Box>

                      {/* Feedback List */}
                      <List sx={{ p:  0 }}>
                        {feedbackList.map((feedback: FeedbackItem) => (
                          <ListItem 
                            key={feedback.d}
                            sx={{
                              border: `1px solid ${getFeedbackStatusColor(feedback.status)}20`,
                              borderRadius:  1,
                              mb: 1,
                              bgcolor: 'background.paper',
                              cursor: 'pointer','&:hover': {
                                bgcolor: `${getFeedbackStatusColor(feedback.status)}10`
                          }
                        }}
                            onClick={() => openFeedbackDetailDialog(feedback)}
                          >
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1,mb: 0.5}}>
                                  <Box sx={{ color: getFeedbackTypeColor(feedback.feedbackType, )}}>
                                    {getFeedbackTypeIcon(feedback.feedbackType)}
                                  </Box>
                                  <Typography variant="body2" sx={{ fontWeight: 600, flex:  1 }}>
                                    {feedback.title}
                                  </Typography>
                                  <Chip
                                    label={feedback.status}
                                    size="small"
                                    sx={{
                                      bgcolor: getFeedbackStatusColor(feedback.status),
                                      color: 'white',
                                      fontSize: '0.7rem',
                                      height: 20 }}
                                  />
                                </Box>
                          }
                              secondary={
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                  <Typography variant="caption" color="text.secondary">
                                    {feedback.userEmail || 'Anonym'} • {new Date(feedback.createdAt).toLocaleDateString('no-NO')}
                                  </Typography>
                                  <Chip
                                    label={feedback.priority}
                                    size="small"
                                    sx={{
                                      bgcolor: getFeedbackPriorityColor(feedback.priority),
                                      color: 'white',
                                      fontSize: '0.7rem',
                                      height: 18 }}
                                  />
                                  {/* Verification Status Chip */}
                                  <Chip
                                    label={(() => {
                                      const verificationStatus = getVerificationStatus(feedback);
                                      switch (verificationStatus) {
                                        case 'verified': return '✅ Verified';
                                        case 'failed': return '❌ Failed';
                                        case 'in-progress': return '🔄 Verifying';
                                        default: return '⏳ Pending';
                                }
                                })()}
                                    size="small"
                                    sx={{
                                      bgcolor: (() => {
                                        const verificationStatus = getVerificationStatus(feedback);
                                        switch (verificationStatus) {
                                          case 'verified': return '#4caf50';
                                          case 'failed': return '#f44336';
                                          case 'in-progress': return '#ff9800';
                                          default: return '#757575';
                                  }
                                  })(),
                                      color: 'white',
                                      fontSize: '0.7rem',
                                      height:  18,
                                      fontWeight: 'bold'
                              }}
                                  />
                                </Box>
                          }
                            />
                            <ListItemSecondaryAction>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openFeedbackStatusDialog(feedback);
                            }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>

                      {feedbackList.length === 0 && (
                        <Box sx={{ p:  3, textAlign: 'center'}}>
                          <BugReport sx={{ fontSize:  48, color: 'grey.40', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            Ingen feedback ennå
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              ) : (
                // Evendi Chat Bridge Tab
                <Box sx={{ p: 2, height: '100%' }}>
                  {evendiLoading && !evendiConversations.length ? (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Laster Evendi-samtaler...
                      </Typography>
                    </Box>
                  ) : selectedEvendiConv ? (
                    // Message view for selected conversation
                    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {/* Back button + conversation header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <IconButton size="small" onClick={() => { setSelectedEvendiConv(null); setEvendiMessages([]); }}>
                          <Reply sx={{ transform: 'scaleX(-1)' }} />
                        </IconButton>
                        <img src="/evendi-logo.png" alt="Evendi" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {evendiConversations.find(c => c.id === selectedEvendiConv)?.couple_name || 'Samtale'}
                        </Typography>
                      </Box>

                      {/* Messages list */}
                      <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
                        {evendiMessages.map((msg: any) => (
                          <Box
                            key={msg.id}
                            sx={{
                              display: 'flex',
                              justifyContent: msg.sender_type === 'vendor' ? 'flex-end' : 'flex-start',
                              mb: 1
                            }}
                          >
                            <Paper
                              elevation={0}
                              sx={{
                                p: 1.5,
                                maxWidth: '75%',
                                borderRadius: 2,
                                bgcolor: msg.sender_type === 'vendor' ? '#E91E63' : '#f5f5f5',
                                color: msg.sender_type === 'vendor' ? 'white' : 'text.primary'
                              }}
                            >
                              <Typography variant="body2">{msg.body}</Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: 'block',
                                  mt: 0.5,
                                  opacity: 0.7,
                                  textAlign: 'right'
                                }}
                              >
                                {new Date(msg.created_at).toLocaleString('nb-NO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                              </Typography>
                            </Paper>
                          </Box>
                        ))}
                      </Box>

                      {/* Reply input */}
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Skriv svar til paret..."
                          value={evendiReplyInput}
                          onChange={(e) => setEvendiReplyInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              sendEvendiMessage();
                            }
                          }}
                        />
                        <IconButton
                          onClick={sendEvendiMessage}
                          disabled={!evendiReplyInput.trim()}
                          sx={{ bgcolor: '#E91E63', color: 'white', '&:hover': { bgcolor: '#C2185B' }, '&:disabled': { bgcolor: 'grey.300' } }}
                        >
                          <Send sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  ) : (
                    // Conversation list
                    <>
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fce4ec', borderRadius: 2, border: '1px solid #E91E6330' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <img src="/evendi-logo.png" alt="Evendi" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#880E4F' }}>
                            Evendi Meldinger
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Meldinger fra par på evendi.no {evendiVendorName && `• ${evendiVendorName}`}
                        </Typography>
                      </Box>

                      {/* Delivery Notification Button */}
                      <Box sx={{ mb: 2 }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          size="small"
                          startIcon={<span style={{ fontSize: 16 }}>📦</span>}
                          onClick={() => {
                            setShowDeliveryNotify(!showDeliveryNotify);
                            if (!showDeliveryNotify) fetchEvendiDeliveries();
                          }}
                          sx={{
                            borderColor: '#E91E6340',
                            color: '#880E4F',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { borderColor: '#E91E63', bgcolor: '#fce4ec' }
                          }}
                        >
                          Send leveransebeskjed
                        </Button>

                        {showDeliveryNotify && evendiDeliveries.length > 0 && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                            {evendiDeliveries.filter((d: any) => !d.chat_notified).map((d: any) => (
                              <Box
                                key={d.id}
                                sx={{
                                  p: 1, mb: 0.5, bgcolor: 'white', borderRadius: 1, cursor: 'pointer',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  '&:hover': { bgcolor: '#fce4ec' }
                                }}
                                onClick={() => sendDeliveryNotification(d.id)}
                              >
                                <Box>
                                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{d.title}</Typography>
                                  <Typography variant="caption" display="block" color="text.secondary">{d.couple_name}</Typography>
                                </Box>
                                <Chip label="Varsle" size="small" sx={{ bgcolor: '#E91E63', color: 'white', height: 22, fontSize: '0.65rem' }} />
                              </Box>
                            ))}
                            {evendiDeliveries.filter((d: any) => !d.chat_notified).length === 0 && (
                              <Typography variant="caption" color="text.secondary" sx={{ p: 1 }}>
                                Alle leveranser er allerede varslet ✓
                              </Typography>
                            )}
                          </Box>
                        )}
                      </Box>

                      {evendiConversations.length > 0 ? (
                        <List sx={{ p: 0 }}>
                          {evendiConversations.map((conv: any) => (
                            <ListItem
                              key={conv.id}
                              component="div"
                              onClick={() => fetchEvendiMessages(conv.id)}
                              sx={{
                                cursor: 'pointer',
                                borderRadius: 1,
                                mb: 0.5,
                                '&:hover': { bgcolor: '#fce4ec' },
                                borderLeft: conv.vendor_unread_count > 0 ? '3px solid #E91E63' : 'none'
                              }}
                            >
                              <ListItemAvatar>
                                <Avatar sx={{ bgcolor: '#fce4ec', width: 36, height: 36 }}>
                                  <img src="/evendi-logo.png" alt="Evendi" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                                </Avatar>
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                      {conv.couple_name || 'Par'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString('nb-NO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : ''}
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}
                                    >
                                      {conv.last_message_sender === 'vendor' ? 'Du: ' : ''}{conv.last_message || 'Ingen meldinger'}
                                    </Typography>
                                    {conv.vendor_unread_count > 0 && (
                                      <Chip
                                        label={conv.vendor_unread_count}
                                        size="small"
                                        sx={{ bgcolor: '#E91E63', color: 'white', height: 18, fontSize: '0.7rem' }}
                                      />
                                    )}
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                          <img src="/evendi-logo.png" alt="Evendi" style={{ width: 48, height: 48, borderRadius: '50%', opacity: 0.5, marginBottom: 8 }} />
                          <Typography variant="body2" color="text.secondary">
                            Ingen Evendi-samtaler ennå
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Par som kontakter deg via evendi.no vil vises her
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}
            </Box>

            {/* Quick Reply */}
            {selectedChat && (
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider'}}>
                <QuickMessageTemplates
                  onSelectTemplate={(msg) => setMessageInput(msg)}
                  profession={profession}
                  storageKey={`quick-msg-universal-${user?.id || 'anon'}`}
                  compact
                />
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Skriv et raskt svar..."
                  value={messageInput}
                  onChange={(e) => { setMessageInput(e.target.value); handleTyping(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleQuickReply();
                }
              }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={handleQuickReply}
                          disabled={!messageInput.trim() || sendQuickMessage.isPending}
                          sx={{
                            bgcolor: getProfessionColor(),
                            color: 'white',
                            '&:hover': { bgcolor: getProfessionColor() },
                            '&:disabled': { bgcolor: 'grey.300' }
                          }}
                        >
                          <Send sx={{ fontSize: 16 }} />
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            )}

            <Divider />
            {/* WebSocket connection status */}
            <Box sx={{ px: 2, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: wsConnection.isConnected ? '#e8f5e9' : '#fff3e0' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {wsConnection.isConnected ? (
                  <CheckCircle sx={{ fontSize: 12, color: '#4caf50' }} />
                ) : (
                  <Warning sx={{ fontSize: 12, color: '#ff9800' }} />
                )}
                <Typography variant="caption" color="text.secondary">
                  {wsConnection.isConnected ? 'Tilkoblet' : 'Frakoblet'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Flere valg">
                  <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                    <MoreVert sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Lukk">
                  <IconButton size="small" onClick={() => { onClose?.(); setIsExpanded(false); setIsOpen(false); }}>
                    <Close sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Box sx={{ p: 1, position: 'relative' }}>
              <Button
                fullWidth
                variant="text"
                onClick={handleOpenFullscreen}
                sx={{ color: getProfessionColor(), textTransform: 'none' }}
              >
                Åpne full chat
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Options Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          handleOpenFullscreen();
          setAnchorEl(null);
        }}>
          <Fullscreen sx={{ mr: 1 }} />
          Fullskjerm
        </MenuItem>
        <MenuItem onClick={() => {
          saveWidgetSize({ width: 400, height: 550 });
          setAnchorEl(null);
        }}>
          <OpenWith sx={{ mr: 1 }} />
          Tilbakestill størrelse
        </MenuItem>
        <MenuItem onClick={() => {
          const standardPosition = { x: 24, y: 140 };
          saveWidgetPosition(standardPosition);
          setAnchorEl(null);
        }}>
          <OpenWith sx={{ mr: 1 }} />
          Standard posisjon (venstre)
        </MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>
          <Notifications sx={{ mr: 1 }} />
          Innstillinger
        </MenuItem>
      </Menu>

      {/* Google Chat Actions Menu */}
      <Menu
        anchorEl={googleChatMenuAnchor}
        open={Boolean(googleChatMenuAnchor)}
        onClose={() => setGoogleChatMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom'}}
      >
        <MenuItem onClick={() => {
          console.log('Create Google Chat Space');
          setGoogleChatMenuAnchor(null);
    }}>
          <Add sx={{ mr:  1 }} />
          Opprett nytt Chat-rom
        </MenuItem>
        <MenuItem onClick={() => {
          console.log('Mention Someone in Google Chat');
          setGoogleChatMenuAnchor(null);
    }}>
          <AlternateEmail sx={{ mr:  1 }} />
          @nevn noen
        </MenuItem>
        <MenuItem onClick={async () => {
          console.log('Testing Google Chat API...');
          await testGoogleChat();
          setGoogleChatMenuAnchor(null);
    }}>
          <Speed sx={{ mr:  1 }} />
          Test Google Chat API
          <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.7}}>
            {communicationStatus.googleChatStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </Typography>
        </MenuItem>
        <MenuItem onClick={() => {
          console.log('Google Chat Settings');
          setGoogleChatMenuAnchor(null);
    }}>
          <Settings sx={{ mr:  1 }} />
          Google Chat-innstillinger
        </MenuItem>
      </Menu>

      {/* Ticket Creation Dialog */}
      <Dialog 
        open={ticketDialogOpen} 
        onClose={() => setTicketDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `2px solid ${getProfessionColor()}`
      }
    }}
      >
        <DialogTitle sx={{ 
          bgcolor: getProfessionColor(), 
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1 }}>
          <Support />
          Opprett Support-sak
        </DialogTitle>
        
        <DialogContent sx={{ p:  3 }}>
          {/* Ticket Suggestions */}
          {showTicketSuggestions && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{  display: 'flex', alignItems: 'center', gap: 1  }}>
                <Lightbulb />
                Velg en type support-sak
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                {getTicketSuggestions().map((suggestion) => (
                  <Paper
                    key={suggestion.id}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: `2px solid ${suggestion.color}`,
                      borderRadius: 2,
                      transition: 'all 0.2s','&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 4,
                        border: `3px solid ${suggestion.color}`
                      },
                      ...theming.getThemedCardSx()
                    }}
                    onClick={() => handleTicketSuggestion(suggestion)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{ color: suggestion.color }}>
                        {suggestion.icon}
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
                        {suggestion.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {suggestion.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Chip
                        label={suggestion.category}
                        size="small"
                        sx={{ bgcolor: `${suggestion.color}20`, color: suggestion.color }}
                      />
                      <Chip
                        label={suggestion.priority}
                        size="small"
                        sx={{ bgcolor: getPriorityColor(suggestion.priority), color: 'white' }}
                      />
                    </Box>
                  </Paper>
                ))}
              </Box>
              <Button
                variant="outlined"
                onClick={() => setShowTicketSuggestions(false)}
                sx={{ mt: 2 }}
              >
                Eller fyll ut manuelt
              </Button>
            </Box>
          )}

          {/* Manual Ticket Form */}
          {!showTicketSuggestions && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                fullWidth
                label="Tittel"
                value={ticketFormData.title}
                onChange={(e) => setTicketFormData({ ...ticketFormData, title: e.target.value })}
                placeholder="Beskriv kort hva problemet handler om"
                required
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Beskrivelse"
                value={ticketFormData.description}
                onChange={(e) => setTicketFormData({ ...ticketFormData, description: e.target.value })}
                placeholder="Beskriv problemet i detalj. Hva skjedde, når skjedde det, og hva forventet du skulle skje?"
                required
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Kategori</InputLabel>
                  <Select
                    value={ticketFormData.category}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, category: e.target.value as TicketFormData['category'] })}
                    label="Kategori"
                  >
                    <MenuItem value="bug">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getCategoryIcon('bug')}
                        Feil/Problem
                      </Box>
                    </MenuItem>
                    <MenuItem value="feature_request">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getCategoryIcon('feature_request')}
                        Forespørsel om ny funksjonalitet
                      </Box>
                    </MenuItem>
                    <MenuItem value="technical_issue">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getCategoryIcon('technical_issue')}
                        Teknisk problem
                      </Box>
                    </MenuItem>
                    <MenuItem value="account">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getCategoryIcon('account')}
                        Konto/Tilgang
                      </Box>
                    </MenuItem>
                    <MenuItem value="question">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getCategoryIcon('question')}
                        Generelt spørsmål
                      </Box>
                    </MenuItem>
                    <MenuItem value="other">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getCategoryIcon('other')}
                        Annet
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Prioritet</InputLabel>
                  <Select
                    value={ticketFormData.priority}
                    onChange={(e) => setTicketFormData({ ...ticketFormData, priority: e.target.value as TicketFormData['priority'] })}
                    label="Prioritet"
                  >
                    <MenuItem value="low">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPriorityIcon('low')}
                        Lav
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPriorityIcon('medium')}
                        Medium
                      </Box>
                    </MenuItem>
                    <MenuItem value="high">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPriorityIcon('high')}
                        Høy
                      </Box>
                    </MenuItem>
                    <MenuItem value="critical">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getPriorityIcon('critical')}
                        Kritisk
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Chat Context */}
              {selectedChat && (
                <TextField
                  fullWidth
                  label="Chat-kontekst (valgfritt)"
                  value={ticketFormData.chatContext}
                  onChange={(e) => setTicketFormData({ ...ticketFormData, chatContext: e.target.value })}
                  placeholder="Beskriv hva som ble diskutert i chatten som ledet til denne support-saken"
                  multiline
                  rows={2}
                />
              )}

              <Alert severity="info" sx={{ mt:  2 }}>
                <Typography variant="body2">
                  <strong>💡 Tips: </strong> Jo mer detaljert beskrivelse du gir, jo raskere kan vi hjelpe deg. 
                  Inkluder gjerne skjermbilder eller steg-for-steg beskrivelser av problemet.
                </Typography>
              </Alert>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p:  3, gap: 1 }}>
          <Button onClick={() => setTicketDialogOpen(false)}>
            Avbryt
          </Button>
          {showTicketSuggestions && (
            <Button 
              onClick={() => setShowTicketSuggestions(false)}
              variant="outlined"
            >
              Fyll ut manuelt
            </Button>
          )}
          {!showTicketSuggestions && (
            <Button
              onClick={handleCreateTicket}
              variant="contained"
              disabled={createTicketMutation.isPending || !ticketFormData.title.trim() || !ticketFormData.description.trim()}
              sx={{
                bgcolor: getProfessionColor(),
                '&:hover': { bgcolor: getProfessionColor() },
                ...theming.getThemedButtonSx()
              }}
            >
              {createTicketMutation.isPending ? 'Oppretter...' : 'Opprett Support-sak'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarMessage.includes('❌') ? 'error' : 'success'}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Feedback Status Update Dialog */}
      <Dialog
        open={feedbackStatusDialogOpen}
        onClose={() => setFeedbackStatusDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `2px solid ${getProfessionColor()}`
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: getProfessionColor(),
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          {theming.getThemedIcon('edit')}
          Oppdater Feedback Status
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {selectedFeedback && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                fullWidth
                label="Tittel"
                value={selectedFeedback.title}
                disabled
                variant="outlined"
              />

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Beskrivelse"
                value={selectedFeedback.description}
                disabled
                variant="outlined"
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={newFeedbackStatus}
                    onChange={(e) => setNewFeedbackStatus(e.target.value)}
                    label="Status"
                  >
                    <MenuItem value="open">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50, %', bgcolor: '#2196f3'}} />
                        Åpen
                      </Box>
                    </MenuItem>
                    <MenuItem value="in_progress">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50, %', bgcolor: '#ff9800'}} />
                        Pågår
                      </Box>
                    </MenuItem>
                    <MenuItem value="resolved">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50, %', bgcolor: '#4caf50'}} />
                        Løst
                      </Box>
                    </MenuItem>
                    <MenuItem value="closed">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50, %', bgcolor: '#757575'}} />
                        Lukket
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>Prioritet</InputLabel>
                  <Select
                    value={selectedFeedback.priority}
                    disabled
                    label="Prioritet"
                  >
                    <MenuItem value="low">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50, %', bgcolor: '#4caf50'}} />
                        Lav
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50, %', bgcolor: '#ff9800'}} />
                        Medium
                      </Box>
                    </MenuItem>
                    <MenuItem value="high">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50, %', bgcolor: '#f44336'}} />
                        Høy
                      </Box>
                    </MenuItem>
                    <MenuItem value="critical">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50, %', bgcolor: '#9c27b0'}} />
                        Kritisk
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2">Admin Notater</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1,mb: 1 }}>
                  {adminNoteTemplates.map((template, index) => (
                    <Button
                      key={index}
                      size="small"
                      variant="outlined"
                      onClick={() => setAdminNotes(template.content)}
                      sx={{ fontSize: '0.75rem'}}
                    >
                      {template.label}
                    </Button>
                  ))}
                </Box>
                <RichTextEditor
                  value={adminNotes}
                  onChange={setAdminNotes}
                  placeholder="Legg til admin notater..."
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold','italic','underline'],
                      [{ 'list':'ordered' }, { 'list' : 'bullet' }],
                      ['link'],
                      ['clean']
                    ]
                  }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setFeedbackStatusDialogOpen(false)}>
            Avbryt
          </Button>
          <Button
            onClick={handleFeedbackStatusUpdate}
            variant="contained"
            disabled={updateFeedbackStatusMutation.isPending || !newFeedbackStatus}
            sx={{
              bgcolor: getProfessionColor(),
              '&:hover': { bgcolor: getProfessionColor() },
              ...theming.getThemedButtonSx()
            }}
          >
            {updateFeedbackStatusMutation.isPending ? 'Oppdaterer...' : 'Oppdater Status'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Detail Dialog */}
      <Dialog
        open={feedbackDetailDialogOpen}
        onClose={() => setFeedbackDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `2px solid ${getProfessionColor()}`
          }
        }}
      >
        <DialogTitle sx={{
          bgcolor: getProfessionColor(),
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          {selectedFeedback && getFeedbackTypeIcon(selectedFeedback.feedbackType)}
          Feedback Detaljer
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {selectedFeedback && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Paper sx={{ p: 2, bgcolor: '#f5f5f5', ...theming.getThemedCardSx() }}>
                  <Typography variant="subtitle2" gutterBottom>Status</Typography>
                  <Chip
                    label={selectedFeedback.status}
                    sx={{
                      bgcolor: getFeedbackStatusColor(selectedFeedback.status),
                      color: 'white'
                    }}
                  />
                </Paper>
                <Paper sx={{ p: 2, bgcolor: '#f5f5f5', ...theming.getThemedCardSx() }}>
                  <Typography variant="subtitle2" gutterBottom>Prioritet</Typography>
                  <Chip
                    label={selectedFeedback.priority}
                    sx={{
                      bgcolor: getFeedbackPriorityColor(selectedFeedback.priority),
                      color: 'white'
              }}
                  />
                </Paper>
              </Box>

              <TextField
                fullWidth
                label="Tittel"
                value={selectedFeedback.title}
                disabled
                variant="outlined"
              />
              
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Beskrivelse"
                value={selectedFeedback.description}
                disabled
                variant="outlined"
              />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <TextField
                  label="Bruker"
                  value={selectedFeedback.userEmail || 'Anonym'}
                  disabled
                  variant="outlined"
                />
                <TextField
                  label="Opprettet"
                  value={new Date(selectedFeedback.createdAt).toLocaleString('no-NO')}
                  disabled
                  variant="outlined"
                />
              </Box>

              {selectedFeedback.adminNotes && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Admin Notater</Typography>
                  <Paper sx={{ p: 2, bgcolor: '#f5f5f5', ...theming.getThemedCardSx() }}>
                    <div dangerouslySetInnerHTML={{ __html: selectedFeedback.adminNotes }} />
                  </Paper>
                </Box>
              )}

              {selectedFeedback.tags && selectedFeedback.tags.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Tags</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedFeedback.tags.map((tag, index) => (
                      <Chip key={index} label={tag} size="small" />
                    ))}
                  </Box>
                </Box>
              )}

              {/* AI Analysis Section */}
              {selectedFeedback.aiAnalysis && (
                <Box sx={{ mt: 3, p: 2, bgcolor: '#f3e5f5', borderRadius: 1, border: '1px solid #9c27b0' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#9c27b0', fontWeight: 600}}>
                    🤖 AI Analysis Results:
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      label={`Risk: ${selectedFeedback.aiAnalysis.riskLevel}`}
                      size="small"
                      sx={{
                        bgcolor: selectedFeedback.aiAnalysis.riskLevel === 'low' ? '#4caf50' : 
                                 selectedFeedback.aiAnalysis.riskLevel === 'medium' ? '#ff9800' : '#f44336',
                        color: 'white'
                      }}
                    />
                    <Chip
                      label={`Auto Fix: ${selectedFeedback.aiAnalysis.autoFixAvailable ? 'Available' : 'Not Available'}`}
                      size="small"
                      sx={{
                        bgcolor: selectedFeedback.aiAnalysis.autoFixAvailable ? '#4caf50' : '#9e9e9e',
                        color: 'white'
                      }}
                    />
                    <Chip
                      label={`${selectedFeedback.aiAnalysis.suggestedFixes.length} Fixes`}
                      size="small"
                      color="primary"
                    />
                  </Box>

                  {selectedFeedback.aiAnalysis.suggestedFixes.map((fix, index) => (
                    <Paper key={fix.id} sx={{ p: 2, mb: 2, bgcolor: 'white', ...theming.getThemedCardSx() }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                          Fix #{index + 1}: {fix.description}
                        </Typography>
                        <Chip
                          label={`${fix.confidence}% confidence`}
                          size="small"
                          sx={{
                            bgcolor: fix.confidence >= 80 ? '#4caf50' : 
                                     fix.confidence >= 60 ? '#ff9800' : '#f44336',
                            color: 'white'
                          }}
                        />
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Type: {fix.type} • Time: {fix.estimatedTime}
                      </Typography>
                      
                      {fix.problemSolved && (
                        <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                          Problem Solved: {fix.problemSolved}
                        </Typography>
                      )}
                      
                      {fix.expectedOutcome && (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Expected Outcome: {fix.expectedOutcome}
                        </Typography>
                      )}
                      
                      {fix.filesToModify.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Files to modify: {fix.filesToModify.join(', ')}
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Box>
              )}

              {/* Verification Status Section */}
              {selectedFeedback.verification && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(255, 140, 0, 0.05)', borderRadius: 1, border: '1px solid rgba(255, 140, 0, 0.2)' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#ff8c00', fontWeight: 600}}>
                    🔍 Verification Status:
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      label={`Automated Tests: ${selectedFeedback.verification.automatedTests.status}`}
                      size="small"
                      sx={{
                        bgcolor: selectedFeedback.verification.automatedTests.status === 'passed' ? '#4caf50' : 
                                 selectedFeedback.verification.automatedTests.status === 'failed' ? '#f44336' : '#9e9e9e',
                        color: 'white'
                      }}
                    />
                    <Chip
                      label={`Regression Tests: ${selectedFeedback.verification.regressionTests.status}`}
                      size="small"
                      sx={{
                        bgcolor: selectedFeedback.verification.regressionTests.status === 'passed' ? '#4caf50' : 
                                 selectedFeedback.verification.regressionTests.status === 'failed' ? '#f44336' : '#9e9e9e',
                        color: 'white'
                      }}
                    />
                    <Chip
                      label={`User Validation: ${selectedFeedback.verification.userValidation.status}`}
                      size="small"
                      sx={{
                        bgcolor: selectedFeedback.verification.userValidation.status === 'validated' ? '#4caf50' : 
                                 selectedFeedback.verification.userValidation.status === 'failed' ? '#f44336' : '#9e9e9e',
                        color: 'white'
                      }}
                    />
                  </Box>
                  
                  {/* Test Coverage */}
                  {selectedFeedback.verification.automatedTests.coverage > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Test Coverage: {selectedFeedback.verification.automatedTests.coverage}%
                    </Typography>
                  )}
                  
                  {/* User Rating */}
                  {selectedFeedback.verification.userValidation.userResponse?.userRating && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        User Rating:
                      </Typography>
                      <Rating
                        value={selectedFeedback.verification.userValidation.userResponse.userRating}
                        readOnly
                        size="small"
                      />
                    </Box>
                  )}

                  {/* User Comments */}
                  {selectedFeedback.verification.userValidation.userResponse?.userComments && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                      "{selectedFeedback.verification.userValidation.userResponse.userComments}"
                    </Typography>
                  )}

                  {/* Validation URL */}
                  {selectedFeedback.verification.userValidation.validationRequest && (
                    <Box sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<OpenInNew />}
                        onClick={() => window.open(selectedFeedback.verification?.userValidation?.validationRequest?.validationUrl, '_blank')}
                        sx={{ fontSize: '0.75rem' }}
                      >
                        Open Validation Link
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setFeedbackDetailDialogOpen(false)}>
            Lukk
          </Button>
          <Button
            onClick={() => {
              setFeedbackDetailDialogOpen(false);
              if (selectedFeedback) {
                openFeedbackStatusDialog(selectedFeedback);
              }
            }}
            variant="outlined"
            sx={{
              borderColor: getProfessionColor(),
              color: getProfessionColor(),
              '&:hover': {
                borderColor: getProfessionColor(),
                bgcolor: `${getProfessionColor()}10`
              }
            }}
          >
            Oppdater Status
          </Button>
          {/* Deploy Fix Button - Only show if feedback has AI analysis */}
          {selectedFeedback?.aiAnalysis && (
            <Button
              onClick={() => {
                if (selectedFeedback) {
                  // Trigger deployment for the first suggested fix
                  const firstFix = selectedFeedback.aiAnalysis?.suggestedFixes[0];
                  if (firstFix) {
                    deployFeedbackFixMutation.mutate({
                      feedbackId: selectedFeedback.id,
                      fixId: firstFix.id
                    });
                  }
                }
                setFeedbackDetailDialogOpen(false);
              }}
              variant="contained"
              disabled={deployFeedbackFixMutation.isPending}
              sx={{
                bgcolor: '#ff8c00', '&:hover': { bgcolor: '#e67e00' }
              }}
            >
              {deployFeedbackFixMutation.isPending ? 'Deploying & Verifying...' : '🚀 Deploy & Verify Fix'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Fullscreen Chat Widget */}
      <FullscreenChatWidget
        open={isFullscreen}
        onClose={() => setIsFullscreen(false)}
        profession={profession}
        userEmail={userEmail}
      />

      {/* Push Notification Settings Dialog */}
      <Dialog
        open={pushSettingsOpen}
        onClose={() => setPushSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, border: `2px solid ${professionColor}` }
        }}
      >
        <DialogTitle sx={{
          bgcolor: professionColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationsActive />
            Push-varsler innstillinger
          </Box>
          <IconButton size="small" sx={{ color: 'white' }} onClick={() => setPushSettingsOpen(false)}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <PushNotificationSettings
            userId={currentUserId}
            contextId={selectedChat || undefined}
            showDescription={true}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPushSettingsOpen(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button - Chat Toggle */}
      {!isOpen && !isFullscreen && (
        <Fab
          color="primary"
          aria-label="Åpne chat"
          onClick={() => { setIsOpen(true); setIsExpanded(true); }}
          sx={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            bgcolor: professionColor,
            '&:hover': { bgcolor: professionColor, filter: 'brightness(0.9)' },
            zIndex: 1000,
          }}
        >
          <Chat />
        </Fab>
      )}
    </>
  );
}