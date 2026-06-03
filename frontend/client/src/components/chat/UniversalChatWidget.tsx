// @ts-nocheck
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { chatEvents } from '@/utils/creatorhub-events';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import {
  clearCreatorHubGoogleIntentFromUrl,
  hasCreatorHubGoogleCallbackState,
  readCreatorHubGoogleCallbackIntent,
} from '@/lib/creatorhubGoogleAuth';
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
  Popover,
  Slide,
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
  useMediaQuery,
} from '@mui/material';
import {
  Chat,
  Send,
  Close,
  ExpandLess,
  ExpandMore,
  MoreVert,
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
  Search,
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
  DeleteOutline,
  CheckCircle,
  Schedule,
  Warning,
  Error as ErrorIcon,
  OpenInNew,
  Star,
  Category,
  Badge as BadgeIcon,
  Speed as Speed,
  Reply,
  RequestQuote,
  AttachFile,
  ImageOutlined,
  InsertDriveFile,
  SentimentSatisfiedAlt,
} from '@mui/icons-material';
import { apiRequest, queryClient } from '@/lib/queryClient';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import QuoteCreationModal from './QuoteCreationModal';
import FullscreenChatWidget from './FullscreenChatWidget';
import ChatWidgetErrorBoundary from './ChatWidgetErrorBoundary';
import { logChatWidgetEvent } from './chat-widget-logger';
import GoogleDriveAttachmentPicker, { type GoogleDriveAttachmentFile } from './GoogleDriveAttachmentPicker';
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
  medium: '#1976d2',
  high: '#f57c00',
  critical: '#9c27b0', 
};

const statusColors: Record<string, string> = {
  open: '#2196f3',
  in_progress: '#ff9800',
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
  layerZIndex?: number;
  workspaceTransitionState?: 'opening' | 'open' | 'closing';
  openLayout?: {
    width: number;
    height: number;
    x: number;
    y: number;
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
  externalEmailInquiry?: {
    token: string;
    id: string;
    subject: string;
    body?: string;
    timestamp: string;
    counterpartName: string;
    counterpartEmail?: string | null;
    priority?: 'low' | 'normal' | 'high';
    isRead?: boolean;
    isStarred?: boolean;
  } | null;
  requestedTab?: {
    tab: 'creatorhub' | 'google-chat' | 'email' | 'feedback' | 'evendi' | 'academy';
    token: string;
  } | null;
}

interface ChatPreview {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  avatar?: string;
  email?: string;
  phone?: string;
  status: 'online' | 'away' | 'offline';
  type: 'client' | 'team' | 'support'
}

interface PendingGoogleDriveAttachment {
  id: string;
  driveFileId: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  downloadUrl?: string;
  uploadedAt: string;
  contextLabel?: string;
  accessState?: 'private' | 'recipient' | 'domain' | 'link';
}

interface CrmCustomerSuggestion {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  profession?: string;
  projectType?: string;
  budget?: number | null;
  status: string;
  tags: string[];
  notes?: string;
  source?: string;
  projectId?: string | null;
  matchReason?: string;
  matchStrength?: number;
}

interface CrmConversationDeal {
  id: string;
  title: string;
  value?: number | null;
  currency?: string | null;
  stage: string;
  probability?: number | null;
  expectedCloseDate?: string | null;
  serviceType?: string | null;
  notes?: string;
}

interface CrmConversationActivity {
  id: string;
  type: string;
  subject: string;
  description?: string;
  scheduledAt?: string | null;
  direction?: string | null;
  outcome?: string | null;
  createdAt?: string | null;
}

interface CrmConversationTask {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string | null;
  priority: string;
  status: string;
  dueDate?: string | null;
  createdAt?: string | null;
}

interface ConversationCommercialQuote {
  id: string;
  quoteNumber: string;
  title: string;
  totalAmount?: number | null;
  currency?: string | null;
  status: string;
  validUntil?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
  respondedAt?: string | null;
  acceptedAt?: string | null;
  signatureStatus?: string | null;
  contractId?: string | null;
  googleDocUrl?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface ConversationCommercialContract {
  id: string;
  contractNumber: string;
  title: string;
  status: string;
  signatureStatus: string;
  totalAmount?: number | null;
  googleDocUrl?: string | null;
  signedAt?: string | null;
  sourceQuoteId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface ConversationCommercialTimelineEntry {
  id: string;
  kind: 'quote' | 'contract';
  label: string;
  timestamp: string;
  completed: boolean;
}

interface ConversationCrmContextResponse {
  provider: 'internal-chat' | 'google-chat' | 'gmail' | 'evendi';
  conversationId: string;
  relationshipState: 'linked' | 'match_available' | 'unlinked';
  conversation?: {
    id: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    avatar?: string | null;
    lastMessage?: string | null;
    lastMessageAt?: string | null;
  } | null;
  link?: {
    id: string;
    provider: string;
    conversationId: string;
    customerId?: string | null;
    dealId?: string | null;
    projectId?: string | null;
    confidence?: number;
    matchedBy?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
  customer?: CrmCustomerSuggestion | null;
  recommendedCustomer?: CrmCustomerSuggestion | null;
  suggestedCustomers?: CrmCustomerSuggestion[];
  activeDeal?: CrmConversationDeal | null;
  recentActivities?: CrmConversationActivity[];
  openTasks?: CrmConversationTask[];
  summary?: {
    nextFollowUp?: string | null;
    openTaskCount?: number;
    recentActivityCount?: number;
    pendingReplyHint?: boolean;
  } | null;
  commercial?: {
    quote?: ConversationCommercialQuote | null;
    contract?: ConversationCommercialContract | null;
    timeline?: ConversationCommercialTimelineEntry[];
    stage?: string;
    label?: string;
    detail?: string;
    nextAction?: string;
  } | null;
  drive?: {
    folderId?: string | null;
    folderName?: string | null;
    folderUrl?: string | null;
    folderStructure?: string[];
    source?: string | null;
    status?: 'ready' | 'missing';
  } | null;
}

interface GoogleChatSpacePreview {
  id: string;
  name: string;
  description: string;
  spaceType: 'SPACE' | 'DIRECT_MESSAGE';
  type: 'ROOM' | 'DM' | 'SPACE';
  threaded: boolean;
  lastActiveTime?: string | null;
  spaceUri?: string | null;
  memberCount?: number | null;
}

interface GoogleChatSpacesResponse {
  spaces?: Array<{
    name?: string;
    displayName?: string;
    spaceType?: 'SPACE' | 'DIRECT_MESSAGE';
    lastActiveTime?: string | null;
    spaceUri?: string | null;
    memberCount?: number | null;
    metadata?: {
      type?: 'ROOM' | 'DM' | 'SPACE';
      threaded?: boolean;
    };
    spaceDetails?: {
      description?: string;
    };
  }>;
}

interface GoogleChatMessagesResponse {
  messages?: Array<{
    id: string;
    senderId: string;
    content: string;
    timestamp: string;
    type?: string;
    status?: string;
    sender?: {
      displayName?: string;
      name?: string;
      type?: string;
    } | null;
    threadName?: string | null;
  }>;
}

interface GmailThreadPreview {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  counterpartName: string;
  counterpartEmail?: string | null;
  direction: 'inbound' | 'outbound';
  hasAttachments: boolean;
  labelIds: string[];
  messageCount: number;
  threadUrl?: string | null;
  source?: 'gmail' | 'customer-inquiry';
}

interface GmailThreadsResponse {
  threads?: GmailThreadPreview[];
}

interface GmailThreadMessagesResponse {
  thread?: {
    id: string;
    threadId: string;
    subject: string;
    counterpartName: string;
    counterpartEmail?: string | null;
    snippet?: string;
    timestamp?: string;
    threadUrl?: string | null;
  } | null;
  messages?: Array<{
    id: string;
    threadId: string;
    senderId: string;
    senderName: string;
    senderEmail: string;
    subject: string;
    content: string;
    snippet: string;
    timestamp: string;
    direction: 'inbound' | 'outbound';
    labelIds: string[];
    hasAttachments: boolean;
  }>;
}

interface CommunicationMessagesResponse {
  messages?: Array<{
    id: string;
    senderId: string;
    content: string;
    timestamp: string;
    type?: string;
    status?: string;
    metadata?: Record<string, unknown> | null;
  }>;
}

interface GoogleMeetCreateResponse {
  success?: boolean;
  meetLink?: string;
  title?: string;
  scheduledAt?: string;
  calendarEventId?: string | null;
  webViewUrl?: string | null;
  meetingNote?: {
    meetingId?: string | null;
    googleCalendarEventId?: string | null;
  } | null;
  notebookLmWorkspace?: {
    id?: string;
    title?: string;
    workspaceDocumentUrl?: string | null;
  } | null;
  notebookLmStatus?: {
    workspaceReady?: boolean;
    syncEligible?: boolean;
    reason?: string | null;
  } | null;
  meetingNotesContext?: {
    projectId?: string | null;
    clientId?: string | null;
    profession?: string | null;
    projectTitle?: string | null;
    clientName?: string | null;
    clientEmail?: string | null;
    suggestedMeetingTitle?: string | null;
    calendarEventId?: string | null;
  } | null;
}

type ConversationMeetingAction = 'call' | 'video' | 'follow-up';

const TAB_CREATORHUB = 0;
const TAB_GOOGLE_CHAT = 1;
const TAB_FEEDBACK = 2;
const TAB_EVENDI = 3;
const TAB_ACADEMY = 4;
const TAB_EMAIL = 5;

interface ResolvedConversationMeetingContext {
  action: ConversationMeetingAction;
  audience: 'client' | 'team' | 'support' | 'review' | 'internal';
  chatId: string;
  conversationName: string;
  title: string;
  description: string;
  durationMinutes: number;
  startDateTime: string;
  endDateTime: string;
  participants: string[];
  shareTarget: 'internal-chat' | 'google-chat' | 'none';
  googleSpaceId: string | null;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  clientEmail: string | null;
  projectContext: any;
  clientContext: any;
  noteContent: string;
  suggestOpenNotes: boolean;
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
  category: TicketFormData['category'];
  priority: TicketFormData['priority'];
  icon: React.ReactNode;
  color: string
}

const GOOGLE_WORKSPACE_SCOPE_ERROR_PATTERNS = [
  'insufficient authentication scopes',
  'insufficient permission',
  'gmail api svarte med 403',
  'google chat api svarte med 403',
  'mangler gmail-tilgang',
  'mangler gmail sendetilgang',
  'koble gmail på nytt',
  'google workspace er ikke koblet til',
  'unauthenticated',
];

const googleWorkspaceErrorNeedsReconnect = (message: string | null | undefined): boolean => {
  const normalized = message?.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return GOOGLE_WORKSPACE_SCOPE_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
};

// ⚠️ CHAT & COMMUNICATION PROTOKOLL: WebSocket connection management
interface WebSocketConnection {
  socket: WebSocket | null;
  isConnected: boolean;
  reconnectAttempts: number;
  maxReconnectAttempts: number
}

interface EvendiConversation {
  id: string;
  couple_name?: string;
  vendor_name?: string;
  project_id?: string;
  last_message?: string;
  last_message_at?: string;
  last_message_sender?: 'vendor' | 'couple';
  vendor_unread_count?: number;
}

interface EvendiMessage {
  id: string;
  body: string;
  created_at: string;
  sender_type: 'vendor' | 'couple';
}

interface EvendiDelivery {
  id: string;
  couple_name?: string;
  package_type?: string;
  status?: string;
}

type SelectedContextEntity = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeSelectedContext = (
  payload: unknown,
  entityType: 'project' | 'client'
): SelectedContextEntity | null => {
  if (!payload) {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const nestedEntity = payload[entityType];
  if (isRecord(nestedEntity)) {
    return nestedEntity;
  }

  const fallbackKey = entityType === 'project' ? 'projectData' : 'clientData';
  const fallbackEntity = payload[fallbackKey];
  if (isRecord(fallbackEntity)) {
    return fallbackEntity;
  }

  return payload;
};

const getRecordString = (
  source: SelectedContextEntity | null,
  keys: string[]
): string => {
  if (!source) {
    return '';
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getRecordNumber = (
  source: SelectedContextEntity | null,
  keys: string[]
): number | undefined => {
  if (!source) {
    return undefined;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(',', '.'));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const getStringArrayFromUnknown = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[>/|,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
};

const extractFolderStructureFromUnknown = (value: unknown): string[] => {
  if (!value || typeof value !== 'object') {
    return getStringArrayFromUnknown(value);
  }

  const record = value as Record<string, unknown>;
  return [
    ...getStringArrayFromUnknown(record.customStructure),
    ...getStringArrayFromUnknown(record.folders),
    ...getStringArrayFromUnknown(record.folderStructure),
  ].filter(Boolean);
};

const detectDriveFolderStructureFromKv = (userKvData: Record<string, unknown>): string[] => {
  const explicitKeys = [
    'folderStructure',
    'folder_structure',
    'folderStructureSettings',
    'dashboardFolderStructure',
    'googleDriveFolderStructure',
    'fileManagementFolderStructure',
  ];

  for (const key of explicitKeys) {
    const candidate = extractFolderStructureFromUnknown(userKvData[key]);
    if (candidate.length > 0) {
      return candidate;
    }
  }

  for (const [key, value] of Object.entries(userKvData)) {
    if (!/folder|drive|backup/i.test(key)) {
      continue;
    }
    const candidate = extractFolderStructureFromUnknown(value);
    if (candidate.length > 0) {
      return candidate;
    }
  }

  return [];
};

const detectArchiveFolderNameFromKv = (
  userKvData: Record<string, unknown>,
  documentType: 'quote' | 'contract',
): string | null => {
  const candidateKeys = documentType === 'quote'
    ? ['documentArchiveConfig_quote', 'quoteArchiveConfig']
    : ['documentArchiveConfig_contract', 'contractArchiveConfig'];

  for (const key of candidateKeys) {
    const value = userKvData[key];
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.baseFolderName === 'string' && record.baseFolderName.trim()) {
        return record.baseFolderName.trim();
      }
    }
  }

  return null;
};

const normalizeQuotePayload = (
  payload: Record<string, unknown>
): Record<string, unknown> => {
  if (isRecord(payload.data)) {
    return payload.data;
  }
  if (isRecord(payload.quote)) {
    return payload.quote;
  }
  return payload;
};

const getDefaultChatWidgetPosition = () => {
  if (typeof window === 'undefined') {
    return { x: 24, y: 140 };
  }

  const defaultWidth = 400;
  const defaultHeight = 550;
  const viewportPadding = 24;
  const reservedBottomSpace = 108;
  const x = Math.max(viewportPadding, window.innerWidth - defaultWidth - 32);
  const y = Math.max(88, window.innerHeight - defaultHeight - reservedBottomSpace);

  return { x, y };
};

const getChatWebSocketUrl = (
  userIdentifier?: string | null,
) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const configuredWsUrl = typeof import.meta.env.VITE_WS_URL === 'string'
    ? import.meta.env.VITE_WS_URL.trim()
    : '';
  const configuredApiTarget = typeof import.meta.env.VITE_API_PROXY_TARGET === 'string'
    ? import.meta.env.VITE_API_PROXY_TARGET.trim()
    : '';

  // Slice 9X.69 — Skip WS-connection i prod hvis ikke VITE_WS_URL er satt.
  // Vercel rewrite gjelder ikke /ws, så wss://creatorhubn.com/ws… går til
  // edge som ikke har WS-handler → spammer "WebSocket failed" i console.
  const isProd = !import.meta.env.DEV && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (isProd && !configuredWsUrl) {
    return null;
  }
  const baseUrl = configuredWsUrl
    || (configuredApiTarget || 'http://127.0.0.1:3003').replace(/^http/i, 'ws');

  try {
    const url = new URL(baseUrl);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/ws';
    }
    if (userIdentifier && userIdentifier.trim()) {
      url.searchParams.set('userId', userIdentifier.trim());
    }
    return url.toString();
  } catch {
    return null;
  }
};

export default function UniversalChatWidget({
  profession: professionProp,
  userEmail,
  userId,
  isOpen: propIsOpen = false,
  onClose,
  layerZIndex = 1200,
  workspaceTransitionState = 'open',
  openLayout,
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
  onCreateNote,
  externalEmailInquiry,
  requestedTab
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
  const isCompactViewport = useMediaQuery('(max-width:960px)');
  const workspaceOverlayZIndex = {
    menu: layerZIndex + 80,
    popover: layerZIndex + 100,
    dialog: layerZIndex + 120,
    select: layerZIndex + 140,
    snackbar: layerZIndex + 160,
  };
  const workspaceSelectMenuProps = {
    sx: { zIndex: workspaceOverlayZIndex.select },
    PaperProps: {
      sx: {
        borderRadius: 2,
        boxShadow: '0 20px 42px rgba(15, 23, 42, 0.18)',
      },
    },
  };
  const [isPageVisible, setIsPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible');
  const { status: communicationStatus, testGoogleChat } = useCommunicationStatus();
  const [isOpen, setIsOpen] = useState(propIsOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [selectedGoogleSpace, setSelectedGoogleSpace] = useState<string | null>(null);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [googleDriveAttachmentPickerOpen, setGoogleDriveAttachmentPickerOpen] = useState(false);
  const [googleDriveAttachmentPickerImagesOnly, setGoogleDriveAttachmentPickerImagesOnly] = useState(false);
  const [pendingGoogleDriveAttachments, setPendingGoogleDriveAttachments] = useState<PendingGoogleDriveAttachment[]>([]);
  const [internalContactPanelOpen, setInternalContactPanelOpen] = useState(false);
  const [emailContactPanelOpen, setEmailContactPanelOpen] = useState(false);
  const [crmLinkSearchTerm, setCrmLinkSearchTerm] = useState('');
  const [crmCreateFormOpen, setCrmCreateFormOpen] = useState(false);
  const [crmCreateDraft, setCrmCreateDraft] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });
  const [selectedProjectContext, setSelectedProjectContext] = useState<SelectedContextEntity | null>(() =>
    normalizeSelectedContext(selectedProject, 'project')
  );
  const [selectedClientContext, setSelectedClientContext] = useState<SelectedContextEntity | null>(() =>
    normalizeSelectedContext(selectedClient, 'client')
  );

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
      props: ['profession', 'userEmail', 'userId'],
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
      type: 'processor',
      dataKey: 'chat-messages',
    });

    return () => {
      communication.unregisterComponent('universal-chat-widget');
      componentRegistry.unregisterComponent('universal-chat-widget');
      dataFlow.unregisterNode(chatNodeId);
};
}, [communication, componentRegistry, integration, dataFlow, profession, userEmail, userId]);

  // Listen to global events and update accordingly
  useEffect(() => {
    const unsubscribe = communication.onMessage((message) => {
      const msgType = message.type as string;
      const msgData = message.data as Record<string, unknown> | undefined;
      if (msgType === 'project:selected' && msgData) {
        logChatWidgetEvent('UniversalChatWidget', 'debug', 'Received project selection event', { msgData });
        const projectSelection = normalizeSelectedContext(msgData, 'project');
        if (projectSelection) {
          setSelectedProjectContext(projectSelection);
          if (onProjectSelect) onProjectSelect(projectSelection);
          if (onProjectUpdate) onProjectUpdate(projectSelection);
        }
      }
      if (msgType === 'client:selected' && msgData) {
        logChatWidgetEvent('UniversalChatWidget', 'debug', 'Received client selection event', { msgData });
        const clientSelection = normalizeSelectedContext(msgData, 'client');
        if (clientSelection) {
          setSelectedClientContext(clientSelection);
          if (onClientSelect) onClientSelect(clientSelection);
          if (onClientUpdate) onClientUpdate(clientSelection);
        }
      }
      if (msgType === 'data:sync' && msgData) {
        if (msgData.dataKey === 'universal-dashboard:selectedProject') {
          const syncedProject = normalizeSelectedContext(msgData.data, 'project');
          if (syncedProject) {
            setSelectedProjectContext(syncedProject);
            if (onProjectSelect) onProjectSelect(syncedProject);
            if (onProjectUpdate) onProjectUpdate(syncedProject);
          }
        }
        if (msgData.dataKey === 'universal-dashboard:selectedClient') {
          const syncedClient = normalizeSelectedContext(msgData.data, 'client');
          if (syncedClient) {
            setSelectedClientContext(syncedClient);
            if (onClientSelect) onClientSelect(syncedClient);
            if (onClientUpdate) onClientUpdate(syncedClient);
          }
        }
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
          logChatWidgetEvent('UniversalChatWidget', 'warn', 'Failed to prefill chat', {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    });

    return unsubscribe;
}, [communication, onProjectSelect, onProjectUpdate, onClientSelect, onClientUpdate, onMeetingCreate, onWorklogCreate, onShowcaseCreate, onFileUpload, onFileDownload]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [mobileTabMenuAnchor, setMobileTabMenuAnchor] = useState<null | HTMLElement>(null);
  const [emojiPickerAnchor, setEmojiPickerAnchor] = useState<null | HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const internalMessagesContainerRef = useRef<HTMLDivElement>(null);
  const googleMessagesContainerRef = useRef<HTMLDivElement>(null);
  const emailMessagesContainerRef = useRef<HTMLDivElement>(null);
  const evendiMessagesContainerRef = useRef<HTMLDivElement>(null);
  const handledGoogleWorkspaceTransferRef = useRef<string | null>(null);
  const internalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const googleSearchInputRef = useRef<HTMLInputElement | null>(null);
  const emailSearchInputRef = useRef<HTMLInputElement | null>(null);
  const utilitySearchInputRef = useRef<HTMLInputElement | null>(null);
  // queryClient is now imported from lib/queryClient
  // Tab states for enhanced functionality
  const [activeTab, setActiveTab] = useState(TAB_CREATORHUB); // 0 = CreatorHub, 1 = Google Chat, 2 = Feedback, 3 = Evendi, 4 = Academy, 5 = E-post
  const [emailIntegrationEnabled, setEmailIntegrationEnabled] = useState(true);
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(false);
  const [mobileConversationMode, setMobileConversationMode] = useState<'list' | 'detail'>('list');
  const [internalInboxSection, setInternalInboxSection] = useState<'all' | 'direct' | 'unread' | 'team' | 'support' | 'archive'>('all');
  const [showInternalQuickTemplates, setShowInternalQuickTemplates] = useState(false);
  const [internalChatFilter, setInternalChatFilter] = useState('');
  const [googleSpaceFilter, setGoogleSpaceFilter] = useState('');
  const [emailThreadFilter, setEmailThreadFilter] = useState('');
  const [emailInboxSection, setEmailInboxSection] = useState<'all' | 'needs_reply' | 'unread' | 'attachments' | 'sent'>('all');
  const [mobileUtilityFilter, setMobileUtilityFilter] = useState('');
  const [googleChatMenuAnchor, setGoogleChatMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedEmailThread, setSelectedEmailThread] = useState<string | null>(null);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [meetingCreationPending, setMeetingCreationPending] = useState(false);
  const [googleWorkspaceOauthPending, setGoogleWorkspaceOauthPending] = useState(false);
  
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
  const showStatusToast = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };
  const invalidateConversationWorkflowContext = async (chatId?: string | null) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/contracts'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/price-administration/quotes'] }),
      chatId
        ? queryClient.invalidateQueries({ queryKey: ['/api/communication/messages', chatId] })
        : Promise.resolve(),
    ]);
  };

  // Feedback System State
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [feedbackStatusDialogOpen, setFeedbackStatusDialogOpen] = useState(false);
  const [feedbackDetailDialogOpen, setFeedbackDetailDialogOpen] = useState(false);
  const [newFeedbackStatus, setNewFeedbackStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  
  // Evendi Chat Bridge State
  const [evendiConversations, setEvendiConversations] = useState<EvendiConversation[]>([]);
  const [selectedEvendiConv, setSelectedEvendiConv] = useState<string | null>(null);
  const [evendiMessages, setEvendiMessages] = useState<EvendiMessage[]>([]);
  const [evendiReplyInput, setEvendiReplyInput] = useState('');
  const [evendiLoading, setEvendiLoading] = useState(false);
  const [evendiVendorName, setEvendiVendorName] = useState('');
  // Delivery notification state
  const [evendiDeliveries, setEvendiDeliveries] = useState<EvendiDelivery[]>([]);
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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsReconnectAttemptsRef = useRef(0);
  const wsManualCloseRef = useRef(false);
  const wsDisabledRef = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Sync with prop changes
  useEffect(() => {
    logChatWidgetEvent('UniversalChatWidget', 'debug', 'Chat widget open prop changed', { propIsOpen });
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

  // Mirror prop context into local widget context
  useEffect(() => {
    setSelectedProjectContext(normalizeSelectedContext(selectedProject, 'project'));
  }, [selectedProject]);

  useEffect(() => {
    setSelectedClientContext(normalizeSelectedContext(selectedClient, 'client'));
  }, [selectedClient]);

  // Sync selected project/client via data flow
  useEffect(() => {
    if (selectedProjectContext) {
      dataFlow.syncData('chat-selected-project', selectedProjectContext);
    }
    integration.setData('selectedProject', selectedProjectContext ?? null);
  }, [selectedProjectContext, dataFlow, integration]);

  useEffect(() => {
    if (selectedClientContext) {
      dataFlow.syncData('chat-selected-client', selectedClientContext);
    }
    integration.setData('selectedClient', selectedClientContext ?? null);
  }, [selectedClientContext, dataFlow, integration]);

  const clearGoogleWorkspaceIntentFromUrl = () => {
    if (typeof window === 'undefined') {
      return;
    }
    clearCreatorHubGoogleIntentFromUrl();
  };

  const buildGoogleWorkspaceReturnPath = () => {
    if (typeof window === 'undefined') {
      return '/';
    }

    const url = new URL(window.location.href);
    ['chGoogleStatus', 'chGoogleTransfer', 'chGoogleMode', 'chGoogleMessage'].forEach((param) => {
      url.searchParams.delete(param);
    });
    return `${url.pathname}${url.search}${url.hash}`;
  };

  const startGoogleWorkspaceReconnect = async (reason: 'google-chat' | 'gmail') => {
    if (typeof window === 'undefined') {
      return;
    }

    setGoogleWorkspaceOauthPending(true);
    try {
      const sharedGmailConnectionUserId = reason === 'gmail'
        ? (typeof gmailStatusResponse?.connection?.userId === 'string' ? gmailStatusResponse.connection.userId : null)
        : null;
      const sharedGmailConnectionEmail = reason === 'gmail'
        ? (
            typeof gmailStatusResponse?.connection?.googleEmail === 'string'
              ? gmailStatusResponse.connection.googleEmail
              : (typeof gmailStatusResponse?.connection?.roleRoomEmail === 'string'
                  ? gmailStatusResponse.connection.roleRoomEmail
                  : null)
          )
        : null;
      const shouldRefreshSharedWorkspaceConnection = Boolean(
        sharedGmailConnectionUserId
        && userId
        && sharedGmailConnectionUserId !== userId,
      );
      const response = await apiRequest('/api/creatorhub/google/oauth/start', {
        method: 'POST',
        body: {
          mode: 'link',
          returnPath: buildGoogleWorkspaceReturnPath(),
          browserOrigin: window.location.origin,
          ...(shouldRefreshSharedWorkspaceConnection
            ? {
                targetConnectionUserId: sharedGmailConnectionUserId,
                targetConnectionEmail: sharedGmailConnectionEmail,
              }
            : {}),
        },
      });

      const authorizationUrl = typeof response?.authorizationUrl === 'string'
        ? response.authorizationUrl
        : null;
      if (!authorizationUrl) {
        throw new Error('Google-SSO svarte uten en gyldig autorisasjonslenke.');
      }

      window.location.assign(authorizationUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke starte Google-SSO.';
      setGoogleWorkspaceOauthPending(false);
      setSnackbarMessage(
        reason === 'gmail'
          ? `❌ Kunne ikke aktivere Gmail via Google-SSO: ${message}`
          : `❌ Kunne ikke aktivere Google-SSO: ${message}`,
      );
      setSnackbarOpen(true);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const transferProcessingStorageKey = 'creatorhub:rr-google-processing';
    const syncGoogleWorkspaceOauthPending = () => {
      const params = new URLSearchParams(window.location.search);
      const hasGoogleWorkspaceCallbackState = hasCreatorHubGoogleCallbackState(params);
      const processingTransferKey = window.sessionStorage.getItem(transferProcessingStorageKey);

      if (!hasGoogleWorkspaceCallbackState) {
        if (processingTransferKey) {
          window.sessionStorage.removeItem(transferProcessingStorageKey);
        }
        handledGoogleWorkspaceTransferRef.current = null;
        setGoogleWorkspaceOauthPending(false);
        return;
      }
    };

    syncGoogleWorkspaceOauthPending();
    window.addEventListener('focus', syncGoogleWorkspaceOauthPending);
    window.addEventListener('pageshow', syncGoogleWorkspaceOauthPending);
    window.addEventListener('auth-changed', syncGoogleWorkspaceOauthPending);
    window.addEventListener('creatorhub-google-workspace-linked', syncGoogleWorkspaceOauthPending as EventListener);

    return () => {
      window.removeEventListener('focus', syncGoogleWorkspaceOauthPending);
      window.removeEventListener('pageshow', syncGoogleWorkspaceOauthPending);
      window.removeEventListener('auth-changed', syncGoogleWorkspaceOauthPending);
      window.removeEventListener('creatorhub-google-workspace-linked', syncGoogleWorkspaceOauthPending as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const transferProcessingStorageKey = 'creatorhub:rr-google-processing';
    const params = new URLSearchParams(window.location.search);
    const googleIntent = readCreatorHubGoogleCallbackIntent(params);
    const googleStatus = googleIntent.status;
    const googleTransferId = googleIntent.transferId;
    const googleMode = googleIntent.mode;
    const googleMessage = googleIntent.message;

    if (!googleStatus) {
      return;
    }

    if (googleStatus === 'error') {
      setGoogleWorkspaceOauthPending(false);
      setSnackbarMessage(`❌ ${googleMessage || 'Google-SSO feilet.'}`);
      setSnackbarOpen(true);
      clearGoogleWorkspaceIntentFromUrl();
      return;
    }

    if (googleStatus !== 'success' || googleMode !== 'link' || !googleTransferId) {
      return;
    }

    const transferKey = `${googleMode}:${googleTransferId}`;
    if (handledGoogleWorkspaceTransferRef.current === transferKey) {
      return;
    }
    if (window.sessionStorage.getItem(transferProcessingStorageKey) === transferKey) {
      return;
    }
    handledGoogleWorkspaceTransferRef.current = transferKey;

    let cancelled = false;

    void (async () => {
      try {
        let transfer: any = null;
        try {
          transfer = await apiRequest(`/api/creatorhub/google/oauth/session-result/${encodeURIComponent(googleTransferId)}`);
        } catch (sessionError) {
          const message = sessionError instanceof Error ? sessionError.message : String(sessionError ?? '');
          if (!/404/.test(message)) {
            throw sessionError;
          }

          clearGoogleWorkspaceIntentFromUrl();
          return;
        }
        if (cancelled) {
          return;
        }

        let linkedStatus: any = null;
        try {
          linkedStatus = await apiRequest('/api/creatorhub/google/link', {
            method: 'POST',
            body: { transferId: googleTransferId },
          });
        } catch (linkError) {
          const message = linkError instanceof Error ? linkError.message : String(linkError ?? '');
          if (!/404/.test(message)) {
            throw linkError;
          }

          clearGoogleWorkspaceIntentFromUrl();
          return;
        }
        if (cancelled) {
          return;
        }

        await testGoogleChat();
        queryClient.invalidateQueries({ queryKey: ['/api/google/chat/spaces'] });
        queryClient.invalidateQueries({ queryKey: ['/api/google/chat/messages'] });
        queryClient.invalidateQueries({ queryKey: ['/api/communication/email/status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/communication/email/threads'] });
        queryClient.invalidateQueries({ queryKey: ['/api/communication/email/messages'] });
        queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });

        const googleEmail = transfer?.google?.email
          || linkedStatus?.connection?.googleEmail
          || linkedStatus?.google?.email
          || 'Google Workspace';
        setSnackbarMessage(`✅ Google-SSO er aktivt for ${googleEmail}`);
        setSnackbarOpen(true);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error
          ? error.message
          : 'Kunne ikke fullføre Google-SSO.';
        setSnackbarMessage(`❌ ${message}`);
        setSnackbarOpen(true);
      } finally {
        if (!cancelled) {
          setGoogleWorkspaceOauthPending(false);
          clearGoogleWorkspaceIntentFromUrl();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [testGoogleChat]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeTab === TAB_CREATORHUB && internalMessagesContainerRef.current && messages.length > 0) {
      const container = internalMessagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [activeTab, messages]);

  // ⚠️ CHAT & COMMUNICATION PROTOKOLL: WebSocket connection with automatic reconnection
  useEffect(() => {
    if (isOpen) {
      wsManualCloseRef.current = false;
      wsDisabledRef.current = false;
      connectWebSocket();
    } else {
      wsManualCloseRef.current = true;
      disconnectWebSocket();
    }
    
    return () => {
      wsManualCloseRef.current = true;
      disconnectWebSocket();
    };
  }, [isOpen]);

  const connectWebSocket = () => {
    if (wsDisabledRef.current) return;
    if (
      wsConnection.socket?.readyState === WebSocket.OPEN
      || wsConnection.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    try {
      const wsUrl = getChatWebSocketUrl(userId || userEmail || 'anonymous');
      if (!wsUrl) {
        return;
      }

      const socket = new WebSocket(wsUrl);
      
      socket.onopen = () => {
        logChatWidgetEvent('UniversalChatWidget', 'info', 'Chat WebSocket connected');
        wsReconnectAttemptsRef.current = 0;
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
	          logChatWidgetEvent('UniversalChatWidget', 'warn', 'Invalid WebSocket message', {
            error: error instanceof Error ? error.message : String(error),
          });
	    }
	  };
      
	      socket.onclose = () => {
	        logChatWidgetEvent('UniversalChatWidget', 'info', 'Chat WebSocket disconnected');
        setWsConnection(prev => ({ ...prev, socket: null, isConnected: false }));

        if (wsManualCloseRef.current || wsDisabledRef.current) {
          return;
        }

        const nextAttempts = wsReconnectAttemptsRef.current + 1;
        wsReconnectAttemptsRef.current = nextAttempts;

        setWsConnection(prev => ({
          ...prev,
          reconnectAttempts: nextAttempts,
        }));

        if (nextAttempts > wsConnection.maxReconnectAttempts) {
          wsDisabledRef.current = true;
          logChatWidgetEvent('UniversalChatWidget', 'warn', 'Chat WebSocket disabled after repeated failures', {
            attempts: nextAttempts,
          });
          return;
        }

        const delay = Math.min(1000 * (2 ** (nextAttempts - 1)), 10000);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          if (!wsManualCloseRef.current && !wsDisabledRef.current) {
            connectWebSocket();
          }
        }, delay);
      };
      
	      socket.onerror = (error) => {
	        logChatWidgetEvent('UniversalChatWidget', 'error', 'Chat WebSocket error', {
            error: error instanceof Event ? 'Socket event error' : String(error),
          });
	  };
      
	} catch (error) {
	      logChatWidgetEvent('UniversalChatWidget', 'error', 'Failed to connect WebSocket', {
          error: error instanceof Error ? error.message : String(error),
        });
	}
};
  
  const disconnectWebSocket = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

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
        logChatWidgetEvent('UniversalChatWidget', 'debug', 'User presence update', {
          payload: message.payload,
        });
        break;
        
      default:
        logChatWidgetEvent('UniversalChatWidget', 'debug', 'Unhandled WebSocket message type', {
          type: message.type,
        });
}
};

  const buildPendingGoogleDriveAttachments = (): ChatMessageType['attachments'] =>
    pendingGoogleDriveAttachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      fileSize: Math.max(1, Math.min(attachment.fileSize || 1, 50 * 1024 * 1024)),
      mimeType: attachment.mimeType || 'application/octet-stream',
      virusScanStatus: 'clean',
      uploadedAt: attachment.uploadedAt,
      downloadUrl: attachment.downloadUrl,
    }));

  const buildAttachmentSummaryText = (attachments: PendingGoogleDriveAttachment[]) => {
    if (attachments.length === 0) {
      return '';
    }

    if (attachments.length === 1) {
      return `Delte vedlegg: ${attachments[0]?.filename ?? 'vedlegg'}`;
    }

    return `Delte ${attachments.length} vedlegg fra Google Drive`;
  };

  const buildRemoteAttachmentSection = (attachments: PendingGoogleDriveAttachment[]) => {
    if (attachments.length === 0) {
      return '';
    }

    return [
      'Vedlegg fra Google Drive:',
      ...attachments.map((attachment) => `- ${attachment.filename}: ${attachment.downloadUrl || 'Ingen lenke tilgjengelig'}`),
    ].join('\n');
  };

  const handleGoogleDriveAttachmentsSelected = async (files: GoogleDriveAttachmentFile[]) => {
    if (!Array.isArray(files) || files.length === 0) {
      return;
    }

    const recipientEmail =
      (activeTab === TAB_EMAIL
        ? selectedEmailThreadPreview?.counterpartEmail
        : selectedConversationHintEmail)
      || quoteClientData.email
      || undefined;
    const shareMode = activeTab === TAB_GOOGLE_CHAT
      ? 'domain'
      : recipientEmail
        ? 'recipient'
        : 'link';
    const customerId =
      (activeTab === TAB_EMAIL
        ? emailCrmConversationContext?.customer?.id
        : quoteClientData.crmCustomerId)
      || crmConversationContext?.customer?.id
      || selectedConversationHintCustomerId
      || undefined;
    const companyName =
      (activeTab === TAB_EMAIL
        ? emailCrmConversationContext?.customer?.company
        : crmConversationContext?.customer?.company)
      || getRecordString(selectedClientContext, ['company', 'companyName', 'businessName'])
      || undefined;

    const preparedFiles = await Promise.all(files.map(async (file) => {
      try {
        const sharedFile = await apiRequest(`/api/google/drive/files/${encodeURIComponent(file.id)}/share`, {
          method: 'POST',
          body: {
            ensureAccessible: true,
            shareMode,
            recipientEmail,
            customerId,
            customerName: activeTab === TAB_EMAIL
              ? selectedEmailThreadPreview?.counterpartName || quoteClientData.name
              : quoteClientData.name,
            companyName,
            projectId: quoteClientData.projectId,
            projectName: quoteClientData.projectName,
            conversationId: activeTab === TAB_GOOGLE_CHAT ? selectedGoogleSpace : activeTab === TAB_EMAIL ? selectedEmailThread : selectedChat,
            conversationName: activeTab === TAB_GOOGLE_CHAT ? selectedGoogleSpacePreview?.name : activeTab === TAB_EMAIL ? selectedEmailThreadPreview?.subject : selectedChatPreview?.name,
            contextType: activeTab === TAB_GOOGLE_CHAT ? 'google-chat' : activeTab === TAB_EMAIL ? 'email' : 'internal-chat',
          },
        }) as {
          webViewLink?: string | null;
          webContentLink?: string | null;
          accessState?: 'private' | 'recipient' | 'domain' | 'link';
        };

        return {
          ...file,
          webViewLink: sharedFile.webViewLink || file.webViewLink,
          webContentLink: sharedFile.webContentLink || file.webContentLink,
          contextLabel: file.contextLabel,
          accessState: sharedFile.accessState,
        };
      } catch (error) {
        logChatWidgetEvent('UniversalChatWidget', 'warn', 'Failed to pre-share Google Drive attachment', {
          fileId: file.id,
          error: error instanceof Error ? error.message : String(error),
        });

        return file;
      }
    }));

    setPendingGoogleDriveAttachments((previous) => {
      const next = [...previous];

      preparedFiles.forEach((file) => {
        const attachment: PendingGoogleDriveAttachment = {
          id: crypto.randomUUID(),
          driveFileId: file.id,
          filename: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
          fileSize: Number.isFinite(Number(file.size)) ? Number(file.size) : 1,
          downloadUrl: file.webViewLink || file.webContentLink || undefined,
          uploadedAt: new Date().toISOString(),
          contextLabel: file.contextLabel || undefined,
          accessState: file.accessState,
        };

        if (!next.find((entry) => entry.driveFileId === attachment.driveFileId)) {
          next.push(attachment);
        }
      });

      return next;
    });

    showStatusToast(preparedFiles.length === 1
      ? 'Drive-vedlegg lagt til i riktig kundekontekst.'
      : `${preparedFiles.length} Drive-vedlegg lagt til fra kundemappene.`);
  };

  const removePendingGoogleDriveAttachment = (attachmentId: string) => {
    setPendingGoogleDriveAttachments((previous) => previous.filter((attachment) => attachment.id !== attachmentId));
  };

  const openGoogleDriveAttachmentPicker = (options?: { imagesOnly?: boolean }) => {
    setGoogleDriveAttachmentPickerImagesOnly(Boolean(options?.imagesOnly));
    setGoogleDriveAttachmentPickerOpen(true);
  };

  // ⚠️ CHAT & COMMUNICATION PROTOKOLL: Type-safe message sending with validation
  const sendMessage = async (options?: { persistToApi?: boolean; clientMessageId?: string }) => {
    const trimmedMessage = messageInput.trim();
    const attachments = buildPendingGoogleDriveAttachments();
    const content = trimmedMessage || buildAttachmentSummaryText(pendingGoogleDriveAttachments);

    if (!content) return;
    chatEvents.messageSent('internal', content.length, attachments.length > 0);

    try {
      const messageData: ChatMessageType = {
        id: options?.clientMessageId || crypto.randomUUID(),
        conversationId: selectedChat || 'general',
        senderId: userEmail || 'anonymous',
        senderName: userEmail || 'Anonymous User',
        content,
        messageType: attachments.length > 0 ? 'file' : 'text',
        timestamp: new Date().toISOString(),
        status: 'sent',
        metadata: {
          platform: 'creatorhub',
          priority: 'normal',
          encryption: true,
          gdprCompliant: true,
          backupStatus: 'pending'
        },
        attachments,
      };

      const validatedMessage = chatMessageSchema.parse(messageData);

      sendWebSocketMessage({
        type: 'chat_message',
        payload: validatedMessage,
        timestamp: new Date().toISOString(),
        userId: userEmail || 'anonymous',
        conversationId: selectedChat || 'general'
      });

      if (options?.persistToApi !== false) {
        await apiRequest('/api/chat/messages', {
          headers: {
            'Content-Type': 'application/json',
            'X-User-Email': userEmail || 'anonymous'
          },
          method: 'POST',
          body: JSON.stringify(validatedMessage)
        });
      }

      setMessageInput('');

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
      logChatWidgetEvent('UniversalChatWidget', 'error', 'Failed to send message', {
        error: error instanceof Error ? error.message : String(error),
      });
      showStatusToast('Kunne ikke sende melding');
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

  const handleOpenFullscreen = () => {
    setIsFullscreen(true);
  };

  const handleCloseWidget = () => {
    onClose?.();
    setIsExpanded(false);
    setIsOpen(false);
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
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

  // Draggable widget state - Default to left side, away from SpeedDial
  const [widgetPosition, setWidgetPosition] = useState(getDefaultChatWidgetPosition);
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
  const conversationsRefetchInterval = isPageVisible ? 15000 : 60000;
  const { data: conversationsResponse } = useQuery({
    queryKey: ['/api/communication/conversations'],
    queryFn: () => apiRequest('/api/communication/conversations'),
    refetchInterval: isOpen ? conversationsRefetchInterval : false
  });

  const googleChatRefetchInterval = isPageVisible ? 12000 : 45000;
  const googleChatMessageRefetchInterval = isPageVisible ? 3500 : 10000;
  const isGoogleChatConnected = communicationStatus.googleChatStatus === 'connected';

  const { data: googleSpacesResponse, isLoading: googleChatSpacesLoading } = useQuery<GoogleChatSpacesResponse>({
    queryKey: ['/api/google/chat/spaces', 'universal-chat-widget'],
    queryFn: () => apiRequest('/api/google/chat/spaces'),
    enabled: isOpen && activeTab === TAB_GOOGLE_CHAT && isGoogleChatConnected,
    refetchInterval: isOpen && activeTab === TAB_GOOGLE_CHAT && isGoogleChatConnected ? googleChatRefetchInterval : false,
  });

  const googleChatSpaces: GoogleChatSpacePreview[] = (googleSpacesResponse?.spaces || []).map((space) => ({
    id: space.name || `spaces/${crypto.randomUUID()}`,
    name: space.displayName || 'Google Chat Space',
    description: space.spaceDetails?.description || '',
    spaceType: space.spaceType || 'SPACE',
    type: space.metadata?.type || 'SPACE',
    threaded: Boolean(space.metadata?.threaded),
    lastActiveTime: space.lastActiveTime || null,
    spaceUri: space.spaceUri || null,
    memberCount: typeof space.memberCount === 'number' ? space.memberCount : null,
  }));
  const normalizedGoogleSpaceFilter = googleSpaceFilter.trim().toLowerCase();
  const filteredGoogleChatSpaces = normalizedGoogleSpaceFilter
    ? googleChatSpaces.filter((space) =>
        [space.name, space.description, space.spaceType]
          .join(' ')
          .toLowerCase()
          .includes(normalizedGoogleSpaceFilter)
      )
    : googleChatSpaces;

  useEffect(() => {
    if (activeTab !== TAB_GOOGLE_CHAT) {
      return;
    }

    if (googleChatSpaces.length === 0) {
      setSelectedGoogleSpace(null);
      return;
    }

    const hasCurrentSelection = googleChatSpaces.some((space) => space.id === selectedGoogleSpace);
    if (!selectedGoogleSpace || !hasCurrentSelection) {
      setSelectedGoogleSpace(googleChatSpaces[0].id);
    }
  }, [activeTab, googleChatSpaces, selectedGoogleSpace]);

  const selectedGoogleSpacePreview = selectedGoogleSpace
    ? googleChatSpaces.find((space) => space.id === selectedGoogleSpace) ?? null
    : null;

  const { data: googleMessagesResponse, isLoading: googleMessagesLoading } = useQuery<GoogleChatMessagesResponse>({
    queryKey: ['/api/google/chat/messages', selectedGoogleSpace],
    queryFn: () => apiRequest(`/api/google/chat/messages?space=${encodeURIComponent(selectedGoogleSpace || '')}`),
    enabled: isOpen && activeTab === TAB_GOOGLE_CHAT && isGoogleChatConnected && Boolean(selectedGoogleSpace),
    refetchInterval:
      isOpen && activeTab === TAB_GOOGLE_CHAT && isGoogleChatConnected && selectedGoogleSpace
        ? googleChatMessageRefetchInterval
        : false,
  });

  const googleChatMessages = googleMessagesResponse?.messages || [];

  const gmailThreadsRefetchInterval = isPageVisible ? 15000 : 45000;
  const gmailThreadMessagesRefetchInterval = isPageVisible ? 5000 : 12000;
  const {
    data: gmailStatusResponse,
    error: gmailStatusError,
  } = useQuery<{
    connected?: boolean;
    status?: string;
    message?: string;
    source?: string;
    connection?: {
      userId?: string | null;
      googleEmail?: string | null;
      roleRoomEmail?: string | null;
      scopes?: string[];
    } | null;
  }>({
    queryKey: ['/api/communication/email/status'],
    queryFn: () => apiRequest('/api/communication/email/status'),
    enabled: isOpen && activeTab === TAB_EMAIL,
    refetchInterval: isOpen && activeTab === TAB_EMAIL ? gmailThreadsRefetchInterval : false,
    retry: false,
  });

  const gmailStatusMessage = gmailStatusError instanceof Error
    ? gmailStatusError.message
    : (typeof gmailStatusResponse?.message === 'string' ? gmailStatusResponse.message : null);
  const isGmailStatusConnected = Boolean(gmailStatusResponse?.connected);
  const hasActiveGoogleWorkspaceCallbackState = (() => {
    if (typeof window === 'undefined') {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    return hasCreatorHubGoogleCallbackState(params);
  })();
  const googleWorkspaceOauthUiBusy = googleWorkspaceOauthPending && !hasActiveGoogleWorkspaceCallbackState;
  const {
    data: gmailThreadsResponse,
    isLoading: gmailThreadsLoading,
    error: gmailThreadsError,
  } = useQuery<GmailThreadsResponse>({
    queryKey: ['/api/communication/email/threads', {
      search: emailThreadFilter.trim() || undefined,
      limit: 30,
    }],
    enabled: isOpen && activeTab === TAB_EMAIL && isGmailStatusConnected,
    refetchInterval: isOpen && activeTab === TAB_EMAIL && isGmailStatusConnected ? gmailThreadsRefetchInterval : false,
    retry: false,
  });

  const gmailThreads = gmailThreadsResponse?.threads || [];
  const syntheticEmailThread = useMemo<GmailThreadPreview | null>(() => {
    if (!externalEmailInquiry) {
      return null;
    }

    const trimmedBody = externalEmailInquiry.body?.trim() || '';
    const snippet = trimmedBody || externalEmailInquiry.subject;

    return {
      id: `customer-inquiry:${externalEmailInquiry.id}`,
      threadId: `customer-inquiry:${externalEmailInquiry.id}`,
      subject: externalEmailInquiry.subject || 'Kundeforespørsel',
      snippet,
      lastMessage: snippet,
      timestamp: externalEmailInquiry.timestamp || new Date().toISOString(),
      unreadCount: externalEmailInquiry.isRead ? 0 : 1,
      counterpartName: externalEmailInquiry.counterpartName || 'Kunde',
      counterpartEmail: externalEmailInquiry.counterpartEmail || null,
      direction: 'inbound',
      hasAttachments: false,
      labelIds: ['CUSTOMER_INQUIRY'],
      messageCount: 1,
      threadUrl: null,
      source: 'customer-inquiry',
    };
  }, [externalEmailInquiry]);
  const emailThreads = useMemo(() => {
    if (!syntheticEmailThread) {
      return gmailThreads;
    }

    const hasEquivalentThread = gmailThreads.some((thread) =>
      (thread.id === syntheticEmailThread.id)
      || (
        thread.counterpartEmail
        && syntheticEmailThread.counterpartEmail
        && thread.counterpartEmail.toLowerCase() === syntheticEmailThread.counterpartEmail.toLowerCase()
        && thread.subject === syntheticEmailThread.subject
      )
    );

    return hasEquivalentThread ? gmailThreads : [syntheticEmailThread, ...gmailThreads];
  }, [gmailThreads, syntheticEmailThread]);
  const normalizedEmailThreadFilter = emailThreadFilter.trim().toLowerCase();
  const filteredGmailThreads = normalizedEmailThreadFilter
    ? emailThreads.filter((thread) =>
        [
          thread.subject,
          thread.counterpartName,
          thread.counterpartEmail,
          thread.snippet,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedEmailThreadFilter)
      )
    : emailThreads;
  const emailThreadNeedsReply = (thread: GmailThreadPreview) => thread.unreadCount > 0 || thread.direction === 'inbound';
  const emailInboxSections = [
    {
      id: 'all',
      label: 'Alle',
      description: 'Hele inboxen',
      count: emailThreads.length,
      tone: '#334155',
    },
    {
      id: 'needs_reply',
      label: 'Klar for svar',
      description: 'Krever oppfølging',
      count: emailThreads.filter((thread) => emailThreadNeedsReply(thread)).length,
      tone: '#ea580c',
    },
    {
      id: 'unread',
      label: 'Uleste',
      description: 'Nye meldinger',
      count: emailThreads.filter((thread) => thread.unreadCount > 0).length,
      tone: '#2563eb',
    },
    {
      id: 'attachments',
      label: 'Vedlegg',
      description: 'Har filer',
      count: emailThreads.filter((thread) => thread.hasAttachments).length,
      tone: '#0f766e',
    },
    {
      id: 'sent',
      label: 'Fulgte opp',
      description: 'Siste svar sendt',
      count: emailThreads.filter((thread) => thread.direction === 'outbound').length,
      tone: '#64748b',
    },
  ] as const;
  const visibleGmailThreads = filteredGmailThreads.filter((thread) => {
    switch (emailInboxSection) {
      case 'needs_reply':
        return emailThreadNeedsReply(thread);
      case 'unread':
        return thread.unreadCount > 0;
      case 'attachments':
        return thread.hasAttachments;
      case 'sent':
        return thread.direction === 'outbound';
      default:
        return true;
    }
  });

  useEffect(() => {
    if (activeTab !== TAB_EMAIL) {
      return;
    }

    if (visibleGmailThreads.length === 0) {
      setSelectedEmailThread(null);
      return;
    }

    const hasCurrentSelection = visibleGmailThreads.some((thread) => thread.id === selectedEmailThread);
    if (!selectedEmailThread || !hasCurrentSelection) {
      setSelectedEmailThread(visibleGmailThreads[0].id);
    }
  }, [activeTab, visibleGmailThreads, selectedEmailThread]);

  useEffect(() => {
    if (!externalEmailInquiry) {
      return;
    }

    setActiveTab(TAB_EMAIL);
    setEmailInboxSection('all');
    setEmailThreadFilter('');
    setSelectedEmailThread(`customer-inquiry:${externalEmailInquiry.id}`);
    if (isCompactViewport) {
      setMobileConversationMode('detail');
    }
  }, [externalEmailInquiry?.token, externalEmailInquiry?.id, isCompactViewport]);

  useEffect(() => {
    if (!requestedTab?.token) {
      return;
    }

    const requestedTabMap = {
      'creatorhub': TAB_CREATORHUB,
      'google-chat': TAB_GOOGLE_CHAT,
      'email': TAB_EMAIL,
      'feedback': TAB_FEEDBACK,
      'evendi': TAB_EVENDI,
      'academy': TAB_ACADEMY,
    } as const;

    const nextTab = requestedTabMap[requestedTab.tab];
    if (typeof nextTab !== 'number') {
      return;
    }

    setActiveTab(nextTab);
    if (nextTab === TAB_EMAIL) {
      setEmailInboxSection('all');
      setEmailThreadFilter('');
      if (isCompactViewport) {
        setMobileConversationMode('list');
      }
    }
  }, [requestedTab?.tab, requestedTab?.token, isCompactViewport]);

  const selectedEmailThreadPreview = selectedEmailThread
    ? visibleGmailThreads.find((thread) => thread.id === selectedEmailThread) ?? filteredGmailThreads.find((thread) => thread.id === selectedEmailThread) ?? emailThreads.find((thread) => thread.id === selectedEmailThread) ?? null
    : null;
  const selectedEmailUsesLiveGmailThread = selectedEmailThreadPreview?.source !== 'customer-inquiry';

  const {
    data: gmailMessagesResponse,
    isLoading: gmailMessagesLoading,
    error: gmailMessagesError,
  } = useQuery<GmailThreadMessagesResponse>({
    queryKey: ['/api/communication/email/messages', { threadId: selectedEmailThread || undefined }],
    enabled: isOpen && activeTab === TAB_EMAIL && isGmailStatusConnected && Boolean(selectedEmailThread) && selectedEmailUsesLiveGmailThread,
    refetchInterval:
      isOpen && activeTab === TAB_EMAIL && isGmailStatusConnected && selectedEmailThread && selectedEmailUsesLiveGmailThread
        ? gmailThreadMessagesRefetchInterval
        : false,
    retry: false,
  });
  const gmailThreadMessages = selectedEmailUsesLiveGmailThread
    ? (gmailMessagesResponse?.messages || [])
    : (selectedEmailThreadPreview
        ? [{
            id: `customer-inquiry-message:${selectedEmailThreadPreview.id}`,
            threadId: selectedEmailThreadPreview.threadId,
            senderId: selectedEmailThreadPreview.counterpartEmail || selectedEmailThreadPreview.id,
            senderName: selectedEmailThreadPreview.counterpartName,
            senderEmail: selectedEmailThreadPreview.counterpartEmail || '',
            subject: selectedEmailThreadPreview.subject,
            content: externalEmailInquiry?.body || selectedEmailThreadPreview.snippet || 'Ingen meldingstekst tilgjengelig.',
            snippet: selectedEmailThreadPreview.snippet || '',
            timestamp: selectedEmailThreadPreview.timestamp,
            direction: 'inbound' as const,
            labelIds: selectedEmailThreadPreview.labelIds,
            hasAttachments: false,
          }]
        : []);
  const gmailSelectedThread = selectedEmailUsesLiveGmailThread
    ? (gmailMessagesResponse?.thread || null)
    : (selectedEmailThreadPreview ? {
        id: selectedEmailThreadPreview.id,
        threadId: selectedEmailThreadPreview.threadId,
        subject: selectedEmailThreadPreview.subject,
        counterpartName: selectedEmailThreadPreview.counterpartName,
        counterpartEmail: selectedEmailThreadPreview.counterpartEmail || undefined,
        snippet: selectedEmailThreadPreview.snippet,
        timestamp: selectedEmailThreadPreview.timestamp,
        threadUrl: selectedEmailThreadPreview.threadUrl || undefined,
      } : null);
  const gmailConnectionErrorMessage = gmailThreadsError instanceof Error ? gmailThreadsError.message : gmailStatusMessage;
  const gmailMessagesErrorMessage = gmailMessagesError instanceof Error ? gmailMessagesError.message : null;
  const gmailNeedsReconnect = googleWorkspaceErrorNeedsReconnect(gmailConnectionErrorMessage);
  const googleChatNeedsReconnect = googleWorkspaceErrorNeedsReconnect(communicationStatus.googleChatResponse);
  const isGmailConnected = (isGmailStatusConnected && !gmailThreadsError) || Boolean(syntheticEmailThread);

  // Fetch feedback data for feedback management tab
  const { data: feedbackList = [], isLoading: feedbackLoading } = useQuery<FeedbackItem[]>({
    queryKey: ['/api/prototype-testing/feedback'],
    queryFn: async () => {
	    const response = await apiRequest('/api/prototype-testing/feedback');
      return response.feedback || [];
    },
    enabled: activeTab === TAB_FEEDBACK,
    refetchInterval: activeTab === TAB_FEEDBACK ? (isPageVisible ? 30000 : 90000) : false,
    staleTime: 0 // Always fetch fresh data
  });

  // Fetch Evendi conversations for vendor users
  useEffect(() => {
    if (activeTab === TAB_EVENDI) {
      fetchEvendiConversations();
    }
  }, [activeTab]);

  const fetchEvendiConversations = async () => {
    try {
      setEvendiLoading(true);
      const data = await apiRequest('/api/evendi/conversations') as { conversations?: EvendiConversation[]; vendorName?: string };
      setEvendiConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setEvendiVendorName(data.vendorName || '');
    } catch (err) {
      logChatWidgetEvent('UniversalChatWidget', 'warn', 'Evendi conversations not available', {
        error: err instanceof Error ? err.message : String(err),
      });
      showStatusToast('Evendi-samtaler er midlertidig utilgjengelige');
      setEvendiConversations([]);
    } finally {
      setEvendiLoading(false);
    }
  };

  const fetchEvendiMessages = async (conversationId: string) => {
    try {
      setEvendiLoading(true);
      const data = await apiRequest(`/api/evendi/conversations/${conversationId}/messages`) as { messages?: EvendiMessage[] };
      setEvendiMessages(Array.isArray(data.messages) ? data.messages : []);
      setSelectedEvendiConv(conversationId);
    } catch (err) {
      logChatWidgetEvent('UniversalChatWidget', 'error', 'Failed to fetch Evendi messages', {
        conversationId,
        error: err instanceof Error ? err.message : String(err),
      });
      showStatusToast('Kunne ikke hente Evendi-meldinger');
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
      showStatusToast('Evendi-svar sendt');
    } catch (err) {
      logChatWidgetEvent('UniversalChatWidget', 'error', 'Failed to send Evendi message', {
        conversationId: selectedEvendiConv,
        error: err instanceof Error ? err.message : String(err),
      });
      showStatusToast('Kunne ikke sende Evendi-svar');
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
      showStatusToast('Leveringsvarsel sendt');
    } catch (err) {
      logChatWidgetEvent('UniversalChatWidget', 'error', 'Failed to send delivery notification', {
        deliveryId,
        error: err instanceof Error ? err.message : String(err),
      });
      showStatusToast('Kunne ikke sende leveringsvarsel');
    } finally {
      setEvendiLoading(false);
    }
  };

  // Fetch deliveries list for notification picker
  const fetchEvendiDeliveries = async () => {
    try {
      const data = await apiRequest('/api/evendi/delivery-project-bridge') as { deliveries?: EvendiDelivery[] };
      setEvendiDeliveries(Array.isArray(data.deliveries) ? data.deliveries : []);
    } catch (err) {
      logChatWidgetEvent('UniversalChatWidget', 'warn', 'Could not fetch Evendi deliveries', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Transform conversations to chat previews format
  const conversations = conversationsResponse?.conversations || [];
  const chatPreviews: ChatPreview[] = conversations.map((conv: { id?: string; d?: string; name?: string; email?: string; phone?: string; lastMessage?: { content?: string; timestamp?: string }; createdAt?: string; unreadCount?: number; avatar?: string; isOnline?: boolean; type?: string }) => ({
    id: conv.id || conv.d,
    name: conv.name || `Samtale ${conv.id || conv.d}`,
    lastMessage: conv.lastMessage?.content || 'Ingen meldinger ennå',
    timestamp: conv.lastMessage?.timestamp || conv.createdAt || new Date().toISOString(),
    unreadCount: conv.unreadCount || 0,
    avatar: conv.avatar,
    email: conv.email,
    phone: conv.phone,
    status: conv.isOnline ? 'online' : 'offline' as const,
    type: conv.type === 'group' ? 'team' : 'client' as const,
  }));
  const normalizedInternalChatFilter = internalChatFilter.trim().toLowerCase();
  const chatsBySection = {
    all: chatPreviews,
    direct: chatPreviews.filter((chat) => chat.type === 'client'),
    unread: chatPreviews.filter((chat) => chat.unreadCount > 0),
    team: chatPreviews.filter((chat) => chat.type === 'team'),
    support: chatPreviews.filter((chat) => /support/i.test(chat.name)),
    archive: chatPreviews.filter((chat) => chat.unreadCount === 0),
  };
  const filteredChatPreviews = (chatsBySection[internalInboxSection] || chatPreviews).filter((chat) =>
    normalizedInternalChatFilter
      ? [chat.name, chat.lastMessage, chat.type]
          .join(' ')
          .toLowerCase()
          .includes(normalizedInternalChatFilter)
      : true
  );
  const internalInboxSections = [
    { id: 'direct', label: 'Direkte', count: chatsBySection.direct.length, icon: <Person sx={{ fontSize: 16 }} /> },
    { id: 'unread', label: 'Uleste', count: chatsBySection.unread.length, icon: <Comment sx={{ fontSize: 16 }} /> },
    { id: 'all', label: 'Alle', count: chatsBySection.all.length, icon: <Chat sx={{ fontSize: 16 }} /> },
    { id: 'team', label: 'Team', count: chatsBySection.team.length, icon: <Group sx={{ fontSize: 16 }} /> },
    { id: 'support', label: 'Support', count: chatsBySection.support.length, icon: <Support sx={{ fontSize: 16 }} /> },
    { id: 'archive', label: 'Arkiv', count: chatsBySection.archive.length, icon: <Assignment sx={{ fontSize: 16 }} /> },
  ] as const;
  const teamRoster = chatPreviews.slice(0, 7);

  useEffect(() => {
    if (activeTab !== TAB_CREATORHUB) {
      return;
    }

    if (chatPreviews.length === 0) {
      setSelectedChat(null);
      return;
    }

    const hasCurrentSelection = chatPreviews.some((chat) => chat.id === selectedChat);
    if (!selectedChat || !hasCurrentSelection) {
      setSelectedChat(chatPreviews[0].id);
    }
  }, [activeTab, chatPreviews, selectedChat]);

  const internalMessagesRefetchInterval = isPageVisible ? 4000 : 12000;
  const { data: internalMessagesResponse, isLoading: internalMessagesLoading } = useQuery<CommunicationMessagesResponse>({
    queryKey: ['/api/communication/messages', selectedChat],
    queryFn: () => apiRequest(`/api/communication/messages/${encodeURIComponent(selectedChat || '')}`),
    enabled: isOpen && activeTab === TAB_CREATORHUB && Boolean(selectedChat),
    refetchInterval: isOpen && activeTab === TAB_CREATORHUB && selectedChat ? internalMessagesRefetchInterval : false,
  });

  const selectedChatPreview = selectedChat
    ? chatPreviews.find((chat) => chat.id === selectedChat) ?? null
    : null;
  const selectedConversationHintCustomerId =
    getRecordString(selectedClientContext, ['id', 'clientId', 'customerId']) || undefined;
  const selectedConversationHintName =
    getRecordString(selectedClientContext, ['name', 'clientName']) ||
    selectedChatPreview?.name ||
    undefined;
  const selectedConversationHintEmail =
    getRecordString(selectedClientContext, ['email', 'clientEmail']) ||
    selectedChatPreview?.email ||
    undefined;
  const selectedConversationHintPhone =
    getRecordString(selectedClientContext, ['phone', 'phoneNumber', 'mobile']) ||
    selectedChatPreview?.phone ||
    undefined;
  const selectedConversationHintProjectId =
    getRecordString(selectedProjectContext, ['id', 'projectId']) || undefined;
  const selectedConversationHintProjectName =
    getRecordString(selectedProjectContext, ['name', 'projectName']) ||
    getRecordString(selectedClientContext, ['projectName']) ||
    undefined;
  const persistedConversationMessages = internalMessagesResponse?.messages || [];
  const liveConversationMessages = messages.filter((message) => message.conversationId === selectedChat);
  const activeConversationMessages = useMemo(() => {
    const mergedMessages = [...persistedConversationMessages, ...liveConversationMessages];
    const deduped = new Map<string, typeof mergedMessages[number]>();

    mergedMessages.forEach((message) => {
      deduped.set(message.id, message);
    });

    return Array.from(deduped.values()).sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [liveConversationMessages, persistedConversationMessages]);

  useEffect(() => {
    if (activeTab === TAB_CREATORHUB && selectedChat && internalMessagesContainerRef.current && activeConversationMessages.length > 0) {
      const container = internalMessagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [activeConversationMessages.length, activeTab, selectedChat]);

  useEffect(() => {
    if (activeTab === TAB_GOOGLE_CHAT && selectedGoogleSpace && googleMessagesContainerRef.current && googleChatMessages.length > 0) {
      const container = googleMessagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [activeTab, googleChatMessages.length, selectedGoogleSpace]);

  useEffect(() => {
    if (activeTab === TAB_EMAIL && selectedEmailThread && emailMessagesContainerRef.current && gmailThreadMessages.length > 0) {
      const container = emailMessagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [activeTab, gmailThreadMessages.length, selectedEmailThread]);

  useEffect(() => {
    if (activeTab === TAB_EVENDI && selectedEvendiConv && evendiMessagesContainerRef.current && evendiMessages.length > 0) {
      const container = evendiMessagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
  }, [activeTab, evendiMessages.length, selectedEvendiConv]);

  const shouldLoadInternalCrmContext = isOpen && activeTab === TAB_CREATORHUB && Boolean(selectedChat);
  const { data: crmConversationContext, isLoading: crmConversationContextLoading } = useQuery<ConversationCrmContextResponse>({
    queryKey: ['/api/universal-crm/context/by-conversation', {
      provider: 'internal-chat',
      conversationId: selectedChat || undefined,
      customerId: selectedConversationHintCustomerId,
      hintName: selectedConversationHintName,
      hintEmail: selectedConversationHintEmail,
      hintPhone: selectedConversationHintPhone,
      projectId: selectedConversationHintProjectId,
      projectName: selectedConversationHintProjectName,
    }],
    enabled: shouldLoadInternalCrmContext,
    refetchInterval: shouldLoadInternalCrmContext && internalContactPanelOpen
      ? (isPageVisible ? 30000 : 90000)
      : false,
  });

  const shouldSearchCrmCustomers = isOpen
    && activeTab === TAB_CREATORHUB
    && internalContactPanelOpen
    && crmLinkSearchTerm.trim().length >= 2;
  const { data: crmSearchResults } = useQuery<{ customers?: CrmCustomerSuggestion[] }>({
    queryKey: ['/api/universal-crm/customers', {
      profession,
      search: crmLinkSearchTerm.trim() || undefined,
      limit: 8,
    }],
    enabled: shouldSearchCrmCustomers,
  });

  const shouldLoadEmailCrmContext = isOpen && activeTab === TAB_EMAIL && Boolean(selectedEmailThread);
  const { data: emailCrmConversationContext } = useQuery<ConversationCrmContextResponse>({
    queryKey: ['/api/universal-crm/context/by-conversation', {
      provider: 'gmail',
      conversationId: selectedEmailThread || undefined,
      hintName: selectedEmailThreadPreview?.counterpartName,
      hintEmail: selectedEmailThreadPreview?.counterpartEmail,
    }],
    enabled: shouldLoadEmailCrmContext,
    refetchInterval: shouldLoadEmailCrmContext ? (isPageVisible ? 30000 : 90000) : false,
  });

  const quoteClientData = useMemo(() => {
    const clientId =
      crmConversationContext?.customer?.id ||
      getRecordString(selectedClientContext, ['id', 'clientId']) ||
      selectedChat ||
      'unknown-client';
    const clientName =
      crmConversationContext?.customer?.name ||
      getRecordString(selectedClientContext, ['name', 'clientName']) ||
      selectedChatPreview?.name ||
      'Ukjent klient';
    const clientEmail =
      crmConversationContext?.customer?.email ||
      getRecordString(selectedClientContext, ['email', 'clientEmail']) ||
      selectedConversationHintEmail;
    const projectType =
      getRecordString(selectedProjectContext, ['projectType', 'type', 'category']) ||
      crmConversationContext?.customer?.projectType ||
      undefined;
    const budget =
      crmConversationContext?.customer?.budget ??
      getRecordNumber(selectedProjectContext, ['budget', 'projectBudget', 'estimate']) ??
      getRecordNumber(selectedClientContext, ['budget', 'estimatedBudget']);
    const projectId =
      getRecordString(selectedProjectContext, ['id', 'projectId']) ||
      crmConversationContext?.conversation?.projectId ||
      crmConversationContext?.customer?.projectId ||
      selectedConversationHintProjectId ||
      undefined;
    const projectName =
      getRecordString(selectedProjectContext, ['name', 'projectName', 'title']) ||
      crmConversationContext?.conversation?.projectName ||
      selectedConversationHintProjectName ||
      undefined;

    return {
      id: clientId,
      name: clientName,
      email: clientEmail,
      profession,
      projectType,
      budget,
      projectId,
      projectName,
      crmCustomerId: crmConversationContext?.customer?.id || undefined,
      crmDealId: crmConversationContext?.activeDeal?.id || undefined,
    };
  }, [
    crmConversationContext?.activeDeal?.id,
    crmConversationContext?.conversation?.projectId,
    crmConversationContext?.conversation?.projectName,
    crmConversationContext?.customer?.budget,
    crmConversationContext?.customer?.email,
    crmConversationContext?.customer?.id,
    crmConversationContext?.customer?.name,
    crmConversationContext?.customer?.projectId,
    crmConversationContext?.customer?.projectType,
    profession,
    selectedChat,
    selectedChatPreview,
    selectedClientContext,
    selectedConversationHintEmail,
    selectedConversationHintProjectId,
    selectedConversationHintProjectName,
    selectedProjectContext,
  ]);

  useEffect(() => {
    setCrmLinkSearchTerm('');
    setCrmCreateFormOpen(false);
    setCrmCreateDraft({
      name: activeTab === TAB_EMAIL
        ? selectedEmailThreadPreview?.counterpartName || selectedEmailThreadPreview?.counterpartEmail?.split('@')[0] || ''
        : selectedConversationHintName || '',
      email: activeTab === TAB_EMAIL
        ? selectedEmailThreadPreview?.counterpartEmail || ''
        : selectedConversationHintEmail || '',
      phone: activeTab === TAB_EMAIL ? '' : selectedConversationHintPhone || '',
      company:
        (activeTab === TAB_EMAIL
          ? emailCrmConversationContext?.customer?.company
          : null)
        || getRecordString(selectedClientContext, ['company', 'organization'])
        || '',
    });
  }, [
    activeTab,
    emailCrmConversationContext?.customer?.company,
    selectedEmailThreadPreview?.counterpartEmail,
    selectedEmailThreadPreview?.counterpartName,
    selectedChat,
    selectedConversationHintEmail,
    selectedConversationHintName,
    selectedConversationHintPhone,
    selectedClientContext,
  ]);

  // Get total unread count
  const totalUnreadCount = chatPreviews.reduce((total: number, chat: ChatPreview) =>
    total + (chat.unreadCount || 0), 0
  );
  const totalOnlineChats = chatPreviews.filter((chat) => chat.status === 'online').length;

  const getProfessionColor = () => {
    // Use profession color from dynamic system
    return professionColor;
  };

  const getColorWithAlpha = (color: string, alpha: number) => {
    if (color.startsWith('#')) {
      const raw = color.slice(1);
      const normalized = raw.length === 3
        ? raw.split('').map((c) => c + c).join('')
        : raw;
      if (normalized.length !== 6) return color;
      const num = Number.parseInt(normalized, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (color.startsWith('rgb(')) {
      return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }

    return color;
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

  const formatDetailedTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

  const formatDetailedDate = (timestamp: string) =>
    new Date(timestamp).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });

  const isOwnConversationMessage = (senderId?: string | null) =>
    Boolean(senderId && [userEmail, userId].filter(Boolean).includes(senderId));

  const getConversationSenderName = (message: { senderId?: string; senderName?: string; metadata?: Record<string, unknown> | null }) => {
    if (message.senderName && message.senderName.trim().length > 0) {
      return message.senderName;
    }

    if (isOwnConversationMessage(message.senderId)) {
      return 'Deg';
    }

    const metadataSenderName = typeof message.metadata?.senderName === 'string'
      ? message.metadata.senderName
      : null;

    if (metadataSenderName && metadataSenderName.trim().length > 0) {
      return metadataSenderName;
    }

    return selectedChatPreview?.name || 'Kontakt';
  };

  const handleToggleInternalContactPanel = () => {
    setInternalContactPanelOpen((current) => !current);
  };

  const handleToggleEmailContactPanel = () => {
    if (!selectedEmailThread && visibleGmailThreads[0]?.id) {
      setSelectedEmailThread(visibleGmailThreads[0].id);
    }
    setEmailContactPanelOpen((current) => !current);
  };

  const resolveSuggestedMeetingStart = (action: ConversationMeetingAction) => {
    const now = new Date();

    if (action === 'follow-up') {
      const scheduled = new Date(now);
      scheduled.setDate(scheduled.getDate() + 1);
      scheduled.setHours(9, 30, 0, 0);
      return scheduled;
    }

    return new Date(now.getTime() + 60 * 1000);
  };

  const resolveConversationMeetingContext = (
    action: ConversationMeetingAction,
    chatId: string,
  ): ResolvedConversationMeetingContext | null => {
    const activeConversation =
      selectedChatPreview
      ?? chatPreviews.find((chat) => chat.id === chatId)
      ?? null;

    if (!activeConversation) {
      return null;
    }

    const latestExternalMessage = [...activeConversationMessages]
      .reverse()
      .find((message) => !isOwnConversationMessage(message.senderId));
    const latestSignal = [
      activeConversation.name,
      activeConversation.lastMessage,
      latestExternalMessage?.content,
      getRecordString(selectedProjectContext, ['name', 'projectName']),
      getRecordString(selectedClientContext, ['name', 'clientName']),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const isSupportConversation =
      /support|helpdesk|ticket|feil|bug/.test(latestSignal);
    const isReviewConversation =
      /showcase|review|feedback|tilbakemelding|godkjenning|approval/.test(latestSignal);
    const isTeamConversation = activeConversation.type === 'team';
    const clientName = getRecordString(selectedClientContext, ['name', 'clientName']) || activeConversation.name;
    const clientEmail = getRecordString(selectedClientContext, ['email', 'clientEmail']) || activeConversation.email || null;
    const projectId = getRecordString(selectedProjectContext, ['id', 'projectId']);
    const projectName =
      getRecordString(selectedProjectContext, ['name', 'projectName'])
      || getRecordString(selectedClientContext, ['projectName'])
      || null;
    const participants = [...new Set(
      [activeConversation.email, clientEmail].filter((value): value is string => Boolean(value && value.includes('@')))
    )];

    const audience: ResolvedConversationMeetingContext['audience'] = isReviewConversation
      ? 'review'
      : isSupportConversation
        ? 'support'
        : isTeamConversation
          ? 'team'
          : participants.length > 0
            ? 'client'
            : 'internal';

    const durationMinutes = audience === 'review'
      ? 45
      : audience === 'support'
        ? 20
        : audience === 'team'
          ? 20
          : action === 'follow-up'
            ? 25
            : 30;
    const start = resolveSuggestedMeetingStart(action);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const title = audience === 'review'
      ? `${action === 'follow-up' ? 'Oppfølging' : 'Review'}${projectName ? `: ${projectName}` : ` med ${clientName}`}`
      : audience === 'support'
        ? `${action === 'follow-up' ? 'Oppfølging' : 'Supportmøte'} med ${clientName}`
        : audience === 'team'
          ? `${action === 'follow-up' ? 'Oppfølging' : 'Team sync'}: ${activeConversation.name}`
          : projectName
            ? `Møte om ${projectName}`
            : `Møte med ${clientName}`;

    const description = [
      `Opprettet fra CreatorHub-chat med ${activeConversation.name}.`,
      projectName ? `Prosjekt: ${projectName}` : null,
      clientName ? `Klient: ${clientName}` : null,
      latestExternalMessage?.content ? `Siste melding: ${latestExternalMessage.content}` : null,
      activeConversation.phone ? `Telefon: ${activeConversation.phone}` : null,
    ].filter(Boolean).join('\n');

    const noteContent = [
      title,
      `Møtetype: ${audience}`,
      projectName ? `Prosjekt: ${projectName}` : null,
      clientName ? `Klient: ${clientName}` : null,
      `Planlagt: ${start.toLocaleString('nb-NO')}`,
      latestExternalMessage?.content ? `Siste signal fra samtalen: ${latestExternalMessage.content}` : null,
    ].filter(Boolean).join('\n');

    return {
      action,
      audience,
      chatId,
      conversationName: activeConversation.name,
      title,
      description,
      durationMinutes,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      participants,
      shareTarget:
        activeTab === TAB_GOOGLE_CHAT && selectedGoogleSpace
          ? 'google-chat'
          : chatId
            ? 'internal-chat'
            : 'none',
      googleSpaceId: activeTab === TAB_GOOGLE_CHAT ? selectedGoogleSpace : null,
      projectId,
      projectName,
      clientName,
      clientEmail,
      projectContext: selectedProject ?? null,
      clientContext: selectedClient ?? null,
      noteContent,
      suggestOpenNotes: action === 'follow-up' || audience === 'review',
    };
  };

  const buildMeetingShareMessage = (
    meetingContext: ResolvedConversationMeetingContext,
    meetLink: string,
  ) => {
    const whenLabel = new Date(meetingContext.startDateTime).toLocaleString('nb-NO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    return [
      `${meetingContext.action === 'follow-up' ? 'Oppfølgingsmøte' : 'Google Meet'}: ${meetingContext.title}`,
      `🕒 ${whenLabel} · ${meetingContext.durationMinutes} min`,
      meetingContext.projectName ? `📁 ${meetingContext.projectName}` : null,
      meetingContext.clientName ? `👤 ${meetingContext.clientName}` : null,
      `🔗 ${meetLink}`,
    ].filter(Boolean).join('\n');
  };

  const shareMeetingBackToContext = async (
    meetingContext: ResolvedConversationMeetingContext,
    meetLink: string,
  ) => {
    const message = buildMeetingShareMessage(meetingContext, meetLink);

    if (meetingContext.shareTarget === 'internal-chat' && meetingContext.chatId) {
      await apiRequest('/api/communication/messages', {
        method: 'POST',
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
        body: {
          conversationId: meetingContext.chatId,
          content: message,
          messageType: 'text',
        },
      });
      queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/communication/messages', meetingContext.chatId] });
      return;
    }

    if (meetingContext.shareTarget === 'google-chat' && meetingContext.googleSpaceId) {
      await apiRequest('/api/google/chat/send', {
        method: 'POST',
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
        body: {
          space: meetingContext.googleSpaceId,
          message,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['/api/google/chat/messages', meetingContext.googleSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['/api/google/chat/spaces'] });
    }
  };

  const createContextualConversationMeeting = async (
    action: ConversationMeetingAction,
    chatId: string,
    options?: {
      openOnSuccess?: boolean;
    },
  ) => {
    if (!currentUserId) {
      showStatusToast('Logg inn med en koblet Google Workspace-bruker før du starter Google Meet.');
      return;
    }

    if (meetingCreationPending) {
      showStatusToast('Google Meet opprettes allerede.');
      return;
    }

    const meetingContext = resolveConversationMeetingContext(action, chatId);
    if (!meetingContext) {
      showStatusToast('Fant ikke samtalen som skal brukes til møtet.');
      return;
    }

    const shouldOpenMeet = options?.openOnSuccess ?? true;
    let pendingMeetWindow: Window | null = null;

    if (shouldOpenMeet && typeof window !== 'undefined') {
      pendingMeetWindow = window.open('', '_blank', 'width=1280,height=800');
      if (pendingMeetWindow) {
        pendingMeetWindow.document.title = 'CreatorHub Google Meet';
        pendingMeetWindow.document.body.style.margin = '0';
        pendingMeetWindow.document.body.style.fontFamily = 'system-ui, sans-serif';
        pendingMeetWindow.document.body.innerHTML =
          '<div style="display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f8fafc;color:#111827;">' +
          '<div style="text-align:center;max-width:320px;padding:24px;">' +
          '<div style="font-size:18px;font-weight:700;margin-bottom:8px;">Oppretter Google Meet</div>' +
          '<div style="font-size:14px;line-height:1.5;color:#475569;">CreatorHub bruker samtalekonteksten og åpner møtet automatisk.</div>' +
          '</div></div>';
      }
    }

    setMeetingCreationPending(true);
    showStatusToast(action === 'follow-up' ? 'Planlegger oppfølgingsmøte...' : 'Oppretter Google Meet...');

    try {
      const response = await apiRequest('/api/google-meet/create', {
        method: 'POST',
        body: {
          title: meetingContext.title,
          description: meetingContext.description,
          participants: meetingContext.participants,
          duration: meetingContext.durationMinutes,
          startDateTime: meetingContext.startDateTime,
          endDateTime: meetingContext.endDateTime,
          projectId: meetingContext.projectId,
          projectName: meetingContext.projectName,
          clientName: meetingContext.clientName,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userId: currentUserId,
        },
      }) as GoogleMeetCreateResponse;

      if (!response.meetLink) {
        throw new Error('Google Meet svarte uten en gyldig lenke.');
      }

      if (shouldOpenMeet) {
        if (pendingMeetWindow && !pendingMeetWindow.closed) {
          pendingMeetWindow.location.replace(response.meetLink);
        } else {
          window.open(response.meetLink, '_blank', 'noopener,noreferrer');
        }
      }

      let sharedBackToContext = false;
      try {
        await shareMeetingBackToContext(meetingContext, response.meetLink);
        sharedBackToContext = meetingContext.shareTarget !== 'none';
      } catch (shareError) {
        logChatWidgetEvent('UniversalChatWidget', 'warn', 'Meet created but contextual share failed', {
          chatId,
          action,
          error: shareError instanceof Error ? shareError.message : String(shareError),
        });
      }

      await logCrmConversationActivity({
        type: 'meeting',
        subject: meetingContext.title,
        description: `${meetingContext.description}\n\nMeet-lenke: ${response.meetLink}`,
        direction: 'outbound',
        outcome: 'successful',
        scheduledAt: meetingContext.startDateTime,
        task: action === 'follow-up'
          ? {
              title: `Forbered oppfølging: ${meetingContext.conversationName}`,
              description: `Møte planlagt ${new Date(meetingContext.startDateTime).toLocaleString('nb-NO')}.\n${response.meetLink}`,
              dueDate: meetingContext.startDateTime,
              priority: 'medium',
              status: 'pending',
            }
          : undefined,
        silentWhenUnlinked: true,
      });

      onMeetingCreate?.({
        ...response,
        type: action,
        provider: 'google-meet',
        chatId,
        conversationName: meetingContext.conversationName,
        participants: meetingContext.participants,
        durationMinutes: meetingContext.durationMinutes,
        projectId: meetingContext.projectId,
        projectName: meetingContext.projectName,
        clientName: meetingContext.clientName,
        clientEmail: meetingContext.clientEmail,
        audience: meetingContext.audience,
        noteContent: meetingContext.noteContent,
        projectContext: meetingContext.projectContext,
        clientContext: meetingContext.clientContext,
        shareTarget: meetingContext.shareTarget,
        sharedBackToContext,
        suggestOpenNotes: meetingContext.suggestOpenNotes,
        source: 'universal-chat-widget',
      });

      logChatWidgetEvent('UniversalChatWidget', 'info', 'Created Google Meet from conversation', {
        chatId,
        action,
        meetLink: response.meetLink,
        audience: meetingContext.audience,
        sharedBackToContext,
      });

      if (action === 'follow-up') {
        showStatusToast(sharedBackToContext
          ? (
            response.notebookLmStatus?.workspaceReady
              ? (
                response.meetingNote?.meetingId
                  ? 'Oppfølgingsmøte opprettet, delt tilbake i samtalen og koblet til møtenotat + NotebookLM workspace.'
                  : 'Oppfølgingsmøte opprettet, delt tilbake i samtalen og koblet til NotebookLM workspace.'
              )
              : 'Oppfølgingsmøte opprettet og delt tilbake i samtalen.'
          )
          : (
            response.notebookLmStatus?.workspaceReady
              ? (
                response.meetingNote?.meetingId
                  ? 'Oppfølgingsmøte opprettet og koblet til møtenotat + NotebookLM workspace.'
                  : 'Oppfølgingsmøte opprettet og koblet til NotebookLM workspace.'
              )
              : 'Oppfølgingsmøte opprettet.'
          ));
      } else {
        showStatusToast(sharedBackToContext
          ? (
            response.notebookLmStatus?.workspaceReady
              ? (
                response.meetingNote?.meetingId
                  ? 'Google Meet opprettet, delt tilbake i samtalen og koblet til møtenotat + NotebookLM.'
                  : 'Google Meet opprettet, delt tilbake i samtalen og klargjort for NotebookLM.'
              )
              : 'Google Meet opprettet, åpnet og delt tilbake i samtalen.'
          )
          : (
            response.notebookLmStatus?.workspaceReady
              ? (
                response.meetingNote?.meetingId
                  ? 'Google Meet opprettet og møtenotat + NotebookLM workspace er klart.'
                  : 'Google Meet opprettet og NotebookLM workspace er klart.'
              )
              : 'Google Meet opprettet og åpnes nå.'
          ));
      }
    } catch (error) {
      if (pendingMeetWindow && !pendingMeetWindow.closed) {
        pendingMeetWindow.close();
      }

      const message = error instanceof Error ? error.message : 'Kunne ikke opprette Google Meet.';
      logChatWidgetEvent('UniversalChatWidget', 'error', 'Failed to create Google Meet from conversation', {
        chatId,
        action,
        error: message,
      });
      showStatusToast(message);
    } finally {
      setMeetingCreationPending(false);
    }
  };

  const handleGoogleChatConnect = async () => {
    try {
      if (activeTab === TAB_EMAIL) {
        try {
          await apiRequest('/api/communication/email/threads?limit=1');
          queryClient.invalidateQueries({ queryKey: ['/api/communication/email/threads'] });
          queryClient.invalidateQueries({ queryKey: ['/api/communication/email/messages'] });
          setSnackbarMessage('✅ Gmail er tilkoblet');
          return;
        } catch (emailError) {
          const message = emailError instanceof Error ? emailError.message : 'Gmail er ikke koblet til ennå.';
          if (googleWorkspaceErrorNeedsReconnect(message)) {
            await startGoogleWorkspaceReconnect('gmail');
            return;
          }

          setSnackbarMessage(`❌ Kunne ikke hente Gmail: ${message}`);
          return;
        }
      }

      await testGoogleChat();
      const statusResult = await apiRequest('/api/communication/google-chat/status');
      const connected = Boolean(statusResult?.connected) || statusResult?.status === 'ok' || statusResult?.status === 'active';
      if (connected) {
        queryClient.invalidateQueries({ queryKey: ['/api/google/chat/spaces'] });
        queryClient.invalidateQueries({ queryKey: ['/api/communication/email/threads'] });
        setSnackbarMessage('✅ Google Chat er tilkoblet');
        return;
      }

      if (googleChatNeedsReconnect || googleWorkspaceErrorNeedsReconnect(statusResult?.message) || googleWorkspaceErrorNeedsReconnect(statusResult?.response)) {
        await startGoogleWorkspaceReconnect('google-chat');
        return;
      }

      setSnackbarMessage('⚠️ Google Chat er ikke tilkoblet ennå');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ukjent feil';
      if (googleWorkspaceErrorNeedsReconnect(message)) {
        await startGoogleWorkspaceReconnect('google-chat');
        return;
      }
      setSnackbarMessage(`❌ Kunne ikke koble til Google Chat: ${message}`);
    } finally {
      setSnackbarOpen(true);
    }
  };

  const handleCreateGoogleChatRoom = async () => {
    try {
      const generatedName = `${enhancedProfessionConfig?.displayName || profession} Team ${new Date().toLocaleDateString('no-NO')}`;
      const response = await apiRequest('/api/google/chat/create-space', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userEmail || 'anonymous',
        },
        body: JSON.stringify({
          displayName: generatedName,
          spaceType: 'SPACE',
          threaded: true,
          description: `Opprettet fra UniversalChatWidget for ${profession}`,
        }),
      });

      const createdSpaceName = typeof response?.space?.name === 'string' ? response.space.name : '';

      if (createdSpaceName) {
        setSelectedGoogleSpace(createdSpaceName);
      }
      setActiveTab(TAB_GOOGLE_CHAT);
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['/api/google/chat/spaces'] });
      setSnackbarMessage(`✅ Opprettet nytt chat-rom: ${generatedName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ukjent feil';
      setSnackbarMessage(`❌ Kunne ikke opprette chat-rom: ${message}`);
    } finally {
      setGoogleChatMenuAnchor(null);
      setSnackbarOpen(true);
    }
  };

  const handleGoogleMention = () => {
    const mentionTarget =
      activeTab === TAB_GOOGLE_CHAT
        ? selectedGoogleSpacePreview?.name || googleChatSpaces[0]?.name || 'team'
        : selectedChat
          ? chatPreviews.find((chat) => chat.id === selectedChat)?.name || chatPreviews[0]?.name || 'team'
          : chatPreviews[0]?.name || 'team';
    const mentionPrefix = `@${mentionTarget.split(' ')[0]} `;

    setMessageInput((prev) => (prev.startsWith(mentionPrefix) ? prev : `${mentionPrefix}${prev}`));
    setActiveTab(activeTab === TAB_GOOGLE_CHAT ? TAB_GOOGLE_CHAT : TAB_CREATORHUB);
    setGoogleChatMenuAnchor(null);
    setSnackbarMessage(`✅ La til mention: ${mentionPrefix.trim()}`);
    setSnackbarOpen(true);
  };

  const handleFocusInternalSearch = () => {
    setInternalInboxSection('all');
    internalSearchInputRef.current?.focus();
  };

  const handleInternalAttachmentAction = (
    type: 'attachment' | 'image' | 'email',
    chatId = selectedChatPreview?.id || selectedChat || ''
  ) => {
    if (type === 'attachment' || type === 'image') {
      openGoogleDriveAttachmentPicker({ imagesOnly: type === 'image' });
      return;
    }

    if (!chatId) {
      showStatusToast('Velg en samtale først.');
      return;
    }

    if (onFileUpload) {
      onFileUpload({ type, chatId });
      return;
    }

    showStatusToast(type === 'image' ? 'Bildeopplasting er ikke tilgjengelig her ennå.' : 'Vedlegg er ikke tilgjengelig her ennå.');
  };

  const handleStartConversationCall = async (
    type: 'call' | 'video',
    chatId = selectedChatPreview?.id || selectedChat || ''
  ) => {
    if (!chatId) {
      showStatusToast('Velg en samtale først.');
      return;
    }

    await createContextualConversationMeeting(type, chatId, { openOnSuccess: true });
  };

  const appendToMessageInput = (value: string) => {
    setMessageInput((current) => {
      if (!current.trim()) {
        return value;
      }

      const separator = current.endsWith(' ') || current.endsWith('\n') ? '' : ' ';
      return `${current}${separator}${value}`;
    });
  };

  const replaceMessageInput = (value: string, toastMessage?: string) => {
    setMessageInput(value);
    if (toastMessage) {
      showStatusToast(toastMessage);
    }
  };

  const handleInsertEmoji = (emoji = '🙂') => {
    appendToMessageInput(emoji);
  };

  const handleOpenEmojiPicker = (event: React.MouseEvent<HTMLElement>) => {
    setEmojiPickerAnchor(event.currentTarget);
  };

  const handleCloseEmojiPicker = () => {
    setEmojiPickerAnchor(null);
  };

  const handleEmojiSelect = (emoji: { native?: string }) => {
    if (!emoji.native) {
      return;
    }

    handleInsertEmoji(emoji.native);
  };

  const handleInsertEvendiQuickReply = () => {
    setEvendiReplyInput((current) => {
      if (current.trim()) {
        const separator = current.endsWith(' ') || current.endsWith('\n') ? '' : ' ';
        return `${current}${separator}Takk!`;
      }

      return 'Hei! Takk for meldingen din. Jeg følger opp dette straks.';
    });
  };

  const handleOpenGoogleSpace = () => {
    if (selectedGoogleSpacePreview?.spaceUri) {
      window.open(selectedGoogleSpacePreview.spaceUri, '_blank', 'noopener,noreferrer');
      return;
    }

    showStatusToast('Dette Google Chat-rommet mangler en ekstern lenke.');
  };

  const handleOpenEmailThread = () => {
    const targetUrl = selectedEmailThreadPreview?.threadUrl || gmailSelectedThread?.threadUrl;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const counterpartEmail = selectedEmailThreadPreview?.counterpartEmail;
    if (counterpartEmail) {
      const subject = encodeURIComponent(selectedEmailThreadPreview?.subject || 'Kundeforespørsel');
      window.open(`mailto:${encodeURIComponent(counterpartEmail)}?subject=${subject}`, '_blank', 'noopener,noreferrer');
      return;
    }

    showStatusToast('Fant ingen Gmail-lenke for denne tråden.');
  };

  const handleOpenGoogleSettings = () => {
    setActiveTab(TAB_GOOGLE_CHAT);
    setChatSettingsOpen(true);
    setGoogleChatMenuAnchor(null);
  };

  const handleOpenUniversalDashboard = () => {
    const targetPath = profession ? `/dashboard?profession=${encodeURIComponent(profession)}` : '/dashboard';
    window.location.assign(targetPath);
  };

  const logCrmConversationActivity = async (payload: {
    type: 'meeting' | 'note' | 'email' | 'proposal_sent' | 'task' | 'call';
    subject: string;
    description?: string;
    direction?: 'inbound' | 'outbound';
    outcome?: 'successful' | 'no_answer' | 'busy' | 'rescheduled' | 'cancelled';
    scheduledAt?: string;
    task?: {
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
      status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      dueDate?: string;
    };
    silentWhenUnlinked?: boolean;
  }) => {
    if (!selectedChat) {
      return false;
    }

    try {
      await apiRequest('/api/universal-crm/context/log-activity', {
        method: 'POST',
        body: {
          provider: 'internal-chat',
          conversationId: selectedChat,
          type: payload.type,
          subject: payload.subject,
          description: payload.description,
          direction: payload.direction,
          outcome: payload.outcome,
          scheduledAt: payload.scheduledAt,
          task: payload.task,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });
      return true;
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
      if (status === 409 && payload.silentWhenUnlinked !== false) {
        return false;
      }

      logChatWidgetEvent('UniversalChatWidget', 'warn', 'Failed to log CRM conversation activity', {
        type: payload.type,
        chatId: selectedChat,
        error: error instanceof Error ? error.message : String(error),
      });

      if (payload.silentWhenUnlinked === false) {
        showStatusToast(error instanceof Error ? error.message : 'Kunne ikke oppdatere CRM fra samtalen.');
      }
      return false;
    }
  };

  const handleCreateConversationTicket = () => {
    if (!selectedChatPreview) {
      showStatusToast('Velg en samtale først.');
      return;
    }

    setTicketFormData((current) => ({
      ...current,
      title: current.title || `Oppfølging: ${selectedChatPreview.name}`,
      description: current.description || `Opprettet fra chat med ${selectedChatPreview.name}.`,
      chatContext: selectedChatPreview.id,
    }));
    setShowTicketSuggestions(true);
    setTicketDialogOpen(true);
    showStatusToast('Supportsak-kladd åpnet fra chatten.');
  };

  const handleCreateEmailConversationTicket = () => {
    if (!selectedEmailThreadPreview) {
      showStatusToast('Velg en e-posttråd først.');
      return;
    }

    setTicketFormData((current) => ({
      ...current,
      title: current.title || `Oppfølging på e-post: ${selectedEmailThreadPreview.subject || 'forespørsel'}`,
      description: current.description || `Opprettet fra Gmail-tråden med ${selectedEmailThreadPreview.counterpartName || selectedEmailThreadPreview.counterpartEmail || 'ukjent kontakt'}.`,
      chatContext: selectedEmailThreadPreview.id,
    }));
    setShowTicketSuggestions(true);
    setTicketDialogOpen(true);
    showStatusToast('Supportsak-kladd åpnet fra e-posttråden.');
  };

  const handleCreateConversationNote = async () => {
    if (!selectedChatPreview) {
      showStatusToast('Velg en samtale først.');
      return;
    }

    const noteBody = [
      `Oppfølging for ${selectedChatPreview.name}`,
      selectedClientContext ? `Klient: ${getRecordString(selectedClientContext, ['name', 'clientName']) || selectedChatPreview.name}` : null,
      selectedProjectContext ? `Prosjekt: ${getRecordString(selectedProjectContext, ['name', 'projectName']) || 'Valgt prosjekt'}` : null,
      `Opprettet: ${new Date().toLocaleString('nb-NO')}`,
    ].filter(Boolean).join('\n');

    if (onCreateNote) {
      onCreateNote(noteBody);
    }

    const loggedToCrm = await logCrmConversationActivity({
      type: 'note',
      subject: `Notat: ${selectedChatPreview.name}`,
      description: noteBody,
      silentWhenUnlinked: true,
    });

    showStatusToast(loggedToCrm
      ? 'Oppfølgingsnotat lagret og koblet til CRM.'
      : onCreateNote
        ? 'Oppfølgingsnotat sendt til notater.'
        : 'Koble samtalen til CRM for å lagre notatet der.');
  };

  const handleCreateEmailConversationNote = async () => {
    if (!selectedEmailThreadPreview || !selectedEmailThread) {
      showStatusToast('Velg en e-posttråd først.');
      return;
    }

    const noteBody = [
      `Oppfølging for ${selectedEmailThreadPreview.counterpartName || selectedEmailThreadPreview.counterpartEmail || 'e-postkontakt'}`,
      `Emne: ${selectedEmailThreadPreview.subject || '(uten emne)'}`,
      selectedEmailThreadPreview.counterpartEmail ? `E-post: ${selectedEmailThreadPreview.counterpartEmail}` : null,
      emailCrmConversationContext?.customer?.name ? `CRM-kunde: ${emailCrmConversationContext.customer.name}` : null,
      `Opprettet: ${new Date().toLocaleString('nb-NO')}`,
    ].filter(Boolean).join('\n');

    if (onCreateNote) {
      onCreateNote(noteBody);
    }

    try {
      await apiRequest('/api/universal-crm/context/log-activity', {
        method: 'POST',
        body: {
          provider: 'gmail',
          conversationId: selectedEmailThread,
          type: 'note',
          subject: `Notat: ${selectedEmailThreadPreview.subject || selectedEmailThreadPreview.counterpartName || 'E-posttråd'}`,
          description: noteBody,
          direction: 'outbound',
          outcome: 'successful',
        },
      });
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });
      showStatusToast('Notat lagret og koblet til CRM-konteksten.');
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
      if (status === 409) {
        showStatusToast(onCreateNote
          ? 'Notat opprettet. Koble e-posttråden til CRM for å logge det der.'
          : 'Koble e-posttråden til CRM for å lagre notatet.');
        return;
      }

      showStatusToast(error instanceof Error ? error.message : 'Kunne ikke lagre notatet fra e-posttråden.');
    }
  };

  const handleScheduleConversationFollowUp = () => {
    if (!selectedChatPreview) {
      showStatusToast('Velg en samtale først.');
      return;
    }

    void createContextualConversationMeeting('follow-up', selectedChatPreview.id, {
      openOnSuccess: false,
    });
  };

  const handleScheduleEmailFollowUp = () => {
    if (!selectedEmailThreadPreview || !selectedEmailThread) {
      showStatusToast('Velg en e-posttråd først.');
      return;
    }

    void createContextualConversationMeeting('follow-up', selectedEmailThread, {
      openOnSuccess: false,
    });
  };

  const handleStartEmailMeeting = () => {
    if (!selectedEmailThreadPreview || !selectedEmailThread) {
      showStatusToast('Velg en e-posttråd først.');
      return;
    }

    void createContextualConversationMeeting('video', selectedEmailThread, {
      openOnSuccess: true,
    });
  };

  const handleMobileTabChange = (tabIndex: number) => {
    setActiveTab(tabIndex);
    if (isCompactViewport) {
      setMobileConversationMode('list');
    }
    setMobileTabMenuAnchor(null);
  };

  const handleSelectInternalChat = (chatId: string) => {
    setSelectedChat(chatId);
    if (isCompactViewport) {
      setMobileConversationMode('detail');
    }
  };

  const handleSelectGoogleSpace = (spaceId: string) => {
    setSelectedGoogleSpace(spaceId);
    if (isCompactViewport) {
      setMobileConversationMode('detail');
    }
  };

  const handleSelectEmailThread = (threadId: string) => {
    setSelectedEmailThread(threadId);
    if (isCompactViewport) {
      setMobileConversationMode('detail');
    }
  };

  const handleSelectEvendiConversation = async (conversationId: string) => {
    await fetchEvendiMessages(conversationId);
    if (isCompactViewport) {
      setMobileConversationMode('detail');
    }
  };

  const handleMobilePrimaryAction = () => {
    if (activeTab === TAB_GOOGLE_CHAT) {
      if (isGoogleChatConnected) {
        void handleCreateGoogleChatRoom();
      } else {
        void handleGoogleChatConnect();
      }
      return;
    }

    if (activeTab === TAB_EMAIL) {
      const targetThreadId = selectedEmailThreadPreview?.id || visibleGmailThreads[0]?.id || filteredGmailThreads[0]?.id;
      if (targetThreadId) {
        handleSelectEmailThread(targetThreadId);
      } else {
        void handleGoogleChatConnect();
      }
      return;
    }

    if (activeTab === TAB_CREATORHUB) {
      const targetChatId = selectedChatPreview?.id || filteredChatPreviews[0]?.id;
      if (targetChatId) {
        handleSelectInternalChat(targetChatId);
      } else {
        setSnackbarMessage('Ingen samtaler tilgjengelig ennå.');
        setSnackbarOpen(true);
      }
      return;
    }

    if (activeTab === TAB_EVENDI) {
      const targetConversationId = selectedEvendiConv || evendiConversations[0]?.id;
      if (targetConversationId) {
        void handleSelectEvendiConversation(targetConversationId);
      } else {
        window.location.assign('/evendi');
      }
      return;
    }

    if (activeTab === TAB_ACADEMY) {
      handleOpenAcademyPath('/academy');
      return;
    }

    if (activeTab === TAB_EVENDI) {
      window.location.assign('/evendi');
      return;
    }

    setSnackbarMessage('Velg en samtale eller kanal først.');
    setSnackbarOpen(true);
  };

  const handleOpenAcademyPath = (path: string) => {
    window.location.assign(path);
  };

  const handleOpenQuoteModal = () => {
    if (activeTab === TAB_EMAIL) {
      if (!selectedEmailThread) {
        showStatusToast('Velg en e-posttråd først for å opprette tilbud');
        return;
      }
      setQuoteModalOpen(true);
      return;
    }

    if (!selectedChat) {
      showStatusToast('Velg en samtale først for å sende tilbud');
      return;
    }
    setQuoteModalOpen(true);
  };

  const postQuoteSummaryToConversation = async (summary: string) => {
    if (!selectedChat) {
      return;
    }

    await apiRequest('/api/communication/messages', {
      headers: {
        'X-User-Email': userEmail || 'anonymous',
      },
      method: 'POST',
      body: JSON.stringify({
        conversationId: selectedChat,
        content: summary,
        messageType: 'text',
      }),
    });

    queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations'] });
  };

  const handleQuoteCreatedFromChat = async (quotePayload: Record<string, unknown>) => {
    const normalizedQuote = normalizeQuotePayload(quotePayload);
    const quoteId = getRecordString(normalizedQuote, ['id', 'quoteId']);
    const quoteNumber = getRecordString(normalizedQuote, ['quoteNumber', 'number']) || (quoteId ? `Tilbud #${quoteId}` : 'Nytt tilbud');
    const totalPrice = getRecordNumber(normalizedQuote, ['totalPrice', 'totalAmount', 'basePrice']);
    const documentUrl = getRecordString(normalizedQuote, ['googleDocUrl', 'google_doc_url', 'documentUrl', 'quoteUrl']);
    const formattedTotalPrice = typeof totalPrice === 'number'
      ? new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK' }).format(totalPrice)
      : '';
    const summaryMessage = formattedTotalPrice
      ? `📄 ${quoteNumber} opprettet (${formattedTotalPrice}).`
      : `📄 ${quoteNumber} opprettet.`;
    const emailDraftMessage = [
      `Hei ${selectedEmailThreadPreview?.counterpartName || 'der'},`,
      '',
      formattedTotalPrice
        ? `Jeg har laget tilbudet ${quoteNumber} på ${formattedTotalPrice}.`
        : `Jeg har laget tilbudet ${quoteNumber}.`,
      documentUrl ? `Du kan åpne dokumentet her: ${documentUrl}` : null,
      '',
      'Gi gjerne beskjed hvis du vil at jeg justerer noe, eller om vi skal gå videre til kontrakt.',
    ].filter(Boolean).join('\n');

    if (activeTab === TAB_EMAIL && selectedEmailThread) {
      try {
        await apiRequest('/api/universal-crm/context/log-activity', {
          method: 'POST',
          body: {
            provider: 'gmail',
            conversationId: selectedEmailThread,
            type: 'proposal_sent',
            subject: quoteNumber,
            description: summaryMessage,
            direction: 'outbound',
            outcome: 'successful',
          },
        });
      } catch (error) {
        const status = typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
        if (status !== 409) {
          logChatWidgetEvent('UniversalChatWidget', 'warn', 'Failed to log quote activity for email conversation', {
            error: error instanceof Error ? error.message : String(error),
            threadId: selectedEmailThread,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });
      replaceMessageInput(emailDraftMessage, 'Tilbud opprettet. Et e-postutkast med dokumentlenke er lagt i composer.');
      return;
    }

    try {
      await postQuoteSummaryToConversation(summaryMessage);
      await logCrmConversationActivity({
        type: 'proposal_sent',
        subject: quoteNumber,
        description: summaryMessage,
        direction: 'outbound',
        outcome: 'successful',
        silentWhenUnlinked: true,
      });

      communication.sendMessage({
        from: 'universal-chat-widget',
        to: 'all',
        type: 'quote:created',
        priority: 'high',
        data: {
          ...normalizedQuote,
          source: 'universal-chat-widget',
          conversationId: selectedChat || null,
          timestamp: new Date().toISOString(),
        },
      });
      communication.sendMessage({
        from: 'universal-chat-widget',
        to: 'contract-hub',
        type: 'quote:available-for-contract',
        priority: 'medium',
        data: normalizedQuote,
      });

      dataFlow.syncData('chat-generated-quote', {
        quote: normalizedQuote,
        conversationId: selectedChat || null,
        generatedAt: new Date().toISOString(),
      });

      await invalidateConversationWorkflowContext(selectedChat);
      showStatusToast('Tilbud opprettet og sendt i chat');
    } catch (error) {
      logChatWidgetEvent('UniversalChatWidget', 'error', 'Failed to share quote in chat', {
        error: error instanceof Error ? error.message : String(error),
      });
      showStatusToast('Tilbud opprettet, men kunne ikke deles i chat');
    }
  };

  const handleOpenCommercialDocument = () => {
    const targetUrl = commercialContract?.googleDocUrl || commercialQuote?.googleDocUrl || null;
    if (!targetUrl) {
      showStatusToast('Fant ingen dokumentlenke for denne flyten ennå.');
      return;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadContractPdfFromChat = async (contractId = commercialContract?.id || '') => {
    if (!contractId) {
      showStatusToast('Fant ingen kontrakt å laste ned.');
      return;
    }

    try {
      const response = await fetch(`/api/contracts/${contractId}/pdf`, {
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
      });

      if (!response.ok) {
        throw new Error('Kunne ikke laste ned kontrakten.');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = `contract-${contractId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showStatusToast('Kontrakten lastes ned.');
    } catch (error) {
      showStatusToast(error instanceof Error ? error.message : 'Kunne ikke laste ned kontrakten.');
    }
  };

  const handleFollowUpCommercialQuote = () => {
    if (!selectedChatPreview) {
      showStatusToast('Velg en samtale først.');
      return;
    }

    const quoteReference = commercialQuote?.quoteNumber ? `${commercialQuote.quoteNumber}` : 'tilbudet';
    const followUpMessage = `Hei ${selectedConversationFirstName}! Jeg følger opp ${quoteReference}. Gi meg gjerne beskjed hvis du vil at jeg justerer noe, eller om vi kan gå videre til kontrakt.`;
    replaceMessageInput(followUpMessage, 'Tilbudsoppfølging lagt i composer.');
  };

  const handlePrimaryCommercialAction = () => {
    switch (commercialWorkflow?.nextAction) {
      case 'create_quote':
        handleOpenQuoteModal();
        return;
      case 'follow_up_quote':
        handleFollowUpCommercialQuote();
        return;
      case 'send_contract':
        if (commercialContract?.id) {
          sendContractForSignatureMutation.mutate(commercialContract.id);
          return;
        }
        showStatusToast('Fant ingen kontrakt å sende.');
        return;
      case 'sync_contract':
        if (commercialContract?.id) {
          syncContractSignatureMutation.mutate(commercialContract.id);
          return;
        }
        showStatusToast('Fant ingen kontrakt å oppdatere.');
        return;
      case 'download_contract':
        void handleDownloadContractPdfFromChat(commercialContract?.id || '');
        return;
      case 'review_contract':
        if (commercialContract?.googleDocUrl || commercialQuote?.googleDocUrl) {
          handleOpenCommercialDocument();
          return;
        }
        showStatusToast('Kontrakten opprettes automatisk når tilbudet er godkjent.');
        return;
      default:
        handleOpenQuoteModal();
    }
  };

  const handleOpenEmailCommercialDocument = () => {
    const targetUrl = emailCommercialContract?.googleDocUrl || emailCommercialQuote?.googleDocUrl || null;
    if (!targetUrl) {
      showStatusToast('Fant ingen dokumentlenke for denne e-postflyten ennå.');
      return;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleFollowUpEmailCommercialQuote = () => {
    const quoteReference = emailCommercialQuote?.quoteNumber ? `${emailCommercialQuote.quoteNumber}` : 'tilbudet';
    const firstName = selectedEmailThreadPreview?.counterpartName?.split(' ')[0] || 'der';
    replaceMessageInput(
      `Hei ${firstName}! Jeg følger opp ${quoteReference}. Gi meg gjerne beskjed hvis du vil at jeg justerer noe, eller om vi kan gå videre til kontrakt.`,
      'Tilbudsoppfølging lagt i e-postfeltet.',
    );
  };

  const handlePrimaryEmailCommercialAction = () => {
    switch (emailCommercialWorkflow?.nextAction) {
      case 'create_quote':
        handleOpenQuoteModal();
        return;
      case 'follow_up_quote':
        handleFollowUpEmailCommercialQuote();
        return;
      case 'send_contract':
        if (emailCommercialContract?.id) {
          sendContractForSignatureMutation.mutate(emailCommercialContract.id);
          return;
        }
        showStatusToast('Fant ingen kontrakt å sende.');
        return;
      case 'sync_contract':
        if (emailCommercialContract?.id) {
          syncContractSignatureMutation.mutate(emailCommercialContract.id);
          return;
        }
        showStatusToast('Fant ingen kontrakt å oppdatere.');
        return;
      case 'download_contract':
        void handleDownloadContractPdfFromChat(emailCommercialContract?.id || '');
        return;
      case 'review_contract':
        if (emailCommercialContract?.googleDocUrl || emailCommercialQuote?.googleDocUrl) {
          handleOpenEmailCommercialDocument();
          return;
        }
        showStatusToast('Dokumentet er ikke klart ennå.');
        return;
      default:
        handleOpenQuoteModal();
    }
  };

  const getEmailCommercialPrimaryActionLabel = () => {
    switch (emailCommercialWorkflow?.nextAction) {
      case 'create_quote': return 'Opprett tilbud';
      case 'follow_up_quote': return 'Følg opp tilbud';
      case 'send_contract': return 'Send til signering';
      case 'sync_contract': return 'Oppdater signaturstatus';
      case 'download_contract': return 'Last ned kontrakt';
      case 'review_contract': return 'Åpne dokument';
      default: return 'Opprett tilbud';
    }
  };

  const academyQuickLinks = [
    {
      id: 'academy-home',
      title: 'Academy Hjem',
      description: 'Åpne CreatorHub Academy',
      path: '/academy',
      icon: <img src="/academy-favicon.svg" alt="" style={{ width: 18, height: 18 }} />,
    },
    {
      id: 'academy-courses',
      title: 'Kurs og Moduler',
      description: 'Gå til kursoversikt og læringsinnhold',
      path: '/academy/courses',
      icon: <Assignment sx={{ fontSize: 18 }} />,
    },
    {
      id: 'academy-dashboard',
      title: 'Academy Dashboard',
      description: 'Følg progresjon og elevaktivitet',
      path: '/academy-dashboard',
      icon: <Category sx={{ fontSize: 18 }} />,
    },
    {
      id: 'academy-analytics',
      title: 'Academy Analyse',
      description: 'Åpne analytics for Academy',
      path: '/academy/analytics',
      icon: <Speed sx={{ fontSize: 18 }} />,
    },
  ];

  // Load widget size/position (server first, fallback to localStorage)
  useEffect(() => {
    const shouldRestoreSavedLayout = !openLayout;

    fetch('/api/user/ui-preferences', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const cw = j?.data?.chat_widget;
        if (shouldRestoreSavedLayout) {
          if (cw?.size) setWidgetSize(cw.size);
          if (cw?.position) setWidgetPosition(cw.position);
        }

	        if (!cw && shouldRestoreSavedLayout) {
	          const savedSize = localStorage.getItem('chat-widget-size');
	          if (savedSize) {
	            try {
              setWidgetSize(JSON.parse(savedSize));
            } catch (e) {
              logChatWidgetEvent('UniversalChatWidget', 'warn', 'Invalid saved chat widget size', {
                error: e instanceof Error ? e.message : String(e),
              });
            }
	          }
	          const savedPosition = localStorage.getItem('chat-widget-position');
	          if (savedPosition) {
	            try {
              setWidgetPosition(JSON.parse(savedPosition));
            } catch (e) {
              logChatWidgetEvent('UniversalChatWidget', 'warn', 'Invalid saved chat widget position', {
                error: e instanceof Error ? e.message : String(e),
              });
            }
	          }
	        }
	      })
	      .catch(() => {
          if (!shouldRestoreSavedLayout) {
            return;
          }

	        const savedSize = localStorage.getItem('chat-widget-size');
	        if (savedSize) {
	          try {
            setWidgetSize(JSON.parse(savedSize));
          } catch (e) {
            logChatWidgetEvent('UniversalChatWidget', 'warn', 'Invalid saved chat widget size', {
              error: e instanceof Error ? e.message : String(e),
            });
          }
	        }
	        const savedPosition = localStorage.getItem('chat-widget-position');
	        if (savedPosition) {
	          try {
            setWidgetPosition(JSON.parse(savedPosition));
          } catch (e) {
            logChatWidgetEvent('UniversalChatWidget', 'warn', 'Invalid saved chat widget position', {
              error: e instanceof Error ? e.message : String(e),
            });
          }
	        }
	      });
	  }, [openLayout]);

  useEffect(() => {
    if (!propIsOpen || !openLayout || isCompactViewport) {
      return;
    }

    setWidgetSize({ width: openLayout.width, height: openLayout.height });
    setWidgetPosition({ x: openLayout.x, y: openLayout.y });
  }, [propIsOpen, openLayout, isCompactViewport]);

  useEffect(() => {
    if (!isCompactViewport) {
      return;
    }

    setMobileConversationMode('list');
    setMobileUtilityFilter('');
  }, [activeTab, isCompactViewport]);

  // Save widget size
  const saveWidgetSize = (newSize: { width: number; height: number }) => {
    setWidgetSize(newSize);
    localStorage.setItem('chat-widget-size', JSON.stringify(newSize));
	    fetch('/api/user/ui-preferences', {
	      method: 'POST', headers: { 'Content-Type' : 'application/json' },
	      credentials: 'include',
	      body: JSON.stringify({ chatWidget: { ...(typeof window !== 'undefined' ? { device: 'web' } : {}), size: newSize, position: widgetPosition } })
	    }).catch(() => {});
	  };

  // Save widget position
  const saveWidgetPosition = (newPosition: { x: number; y: number }) => {
    setWidgetPosition(newPosition);
    localStorage.setItem('chat-widget-position', JSON.stringify(newPosition));
	    fetch('/api/user/ui-preferences', {
	      method: 'POST', headers: { 'Content-Type' : 'application/json' },
	      credentials: 'include',
	      body: JSON.stringify({ chatWidget: { ...(typeof window !== 'undefined' ? { device: 'web' } : {}), size: widgetSize, position: newPosition } })
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
    if (isCompactViewport) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: widgetSize.width,
      height: widgetSize.height,
      posX: widgetPosition.x,
      posY: widgetPosition.y,
    });
};

  // Handle drag mouse events
  const handleDragStart = (e: React.MouseEvent) => {
    if (isCompactViewport) return;
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
    if (isCompactViewport) {
      setIsDragging(false);
      setIsResizing(false);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const deltaX = resizeStart.x - e.clientX;
        const deltaY = e.clientY - resizeStart.y;

        const minWidth = isWorkspacePanel ? 760 : 320;
        const maxWidth = Math.max(minWidth, Math.min(isWorkspacePanel ? 1480 : 800, window.innerWidth - 32));
        const minHeight = isWorkspacePanel ? 620 : 300;
        const maxHeight = Math.max(minHeight, Math.min(isWorkspacePanel ? 980 : 700, window.innerHeight - 24));
        const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.width + deltaX));
        const newHeight = Math.max(minHeight, Math.min(maxHeight, resizeStart.height + deltaY));

        if (isWorkspacePanel) {
          const widthDelta = newWidth - resizeStart.width;
          const nextX = Math.max(24, Math.min(window.innerWidth - newWidth - 24, resizeStart.posX - widthDelta));
          const nextY = Math.max(24, Math.min(window.innerHeight - newHeight - 24, resizeStart.posY));
          setWidgetPosition({ x: nextX, y: nextY });
        }

        setWidgetSize({ width: newWidth, height: newHeight });
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
	          logChatWidgetEvent('UniversalChatWidget', 'debug', 'Chat widget snapped to zone', {
              zone: snappedPosition.zoneName,
            });
	    }
  }
};

    if ((isResizing || isDragging) && !isCompactViewport) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
}

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
};
}, [isResizing, isDragging, isCompactViewport, resizeStart, dragStart, widgetSize, widgetPosition]);

  const sendQuickMessage = useMutation({
    mutationFn: async (data: { chatId: string; message: string; attachments?: ChatMessageType['attachments']; clientMessageId?: string }) => {
      return apiRequest('/api/communication/messages', {
        headers: {
	        'X-User-Email': userEmail || 'anonymous'
        },
        method: 'POST',
        body: {
          id: data.clientMessageId,
          conversationId: data.chatId,
          content: data.message,
          messageType: data.attachments && data.attachments.length > 0 ? 'file' : 'text',
          attachments: data.attachments || []
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations'] });
      if (selectedChat) {
        queryClient.invalidateQueries({ queryKey: ['/api/communication/messages', selectedChat] });
      }
      setMessageInput('');
      setPendingGoogleDriveAttachments([]);
    }
  });

  const sendGoogleChatMessage = useMutation({
    mutationFn: async (data: { space: string; message: string; attachments?: ChatMessageType['attachments'] }) => {
      return apiRequest('/api/google/chat/send', {
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
        method: 'POST',
        body: {
          space: data.space,
          message: data.message,
          attachments: data.attachments || [],
        },
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/google/chat/messages', variables.space] });
      queryClient.invalidateQueries({ queryKey: ['/api/google/chat/spaces'] });
      setMessageInput('');
      setPendingGoogleDriveAttachments([]);
    },
    onError: (error: Error) => {
      setSnackbarMessage(`❌ Kunne ikke sende Google Chat-melding: ${error.message}`);
      setSnackbarOpen(true);
    },
  });

  const deleteGoogleChatMessage = useMutation({
    mutationFn: async (data: { messageId: string; space: string }) => {
      return apiRequest(`/api/google/chat/messages/${encodeURIComponent(data.messageId)}`, {
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
        method: 'DELETE',
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/google/chat/messages', variables.space] });
      queryClient.invalidateQueries({ queryKey: ['/api/google/chat/spaces'] });
      setSnackbarMessage('✅ Google Chat-meldingen er slettet');
      setSnackbarOpen(true);
    },
    onError: (error: Error) => {
      setSnackbarMessage(`❌ Kunne ikke slette Google Chat-meldingen: ${error.message}`);
      setSnackbarOpen(true);
    },
  });

  const sendGmailReply = useMutation({
    mutationFn: async (data: { threadId: string; message: string; subject?: string; attachments?: ChatMessageType['attachments'] }) => {
      return apiRequest('/api/communication/email/reply', {
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
        method: 'POST',
        body: {
          threadId: data.threadId,
          message: data.message,
          subject: data.subject,
          attachments: data.attachments || [],
        },
      });
    },
    onSuccess: async (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication/email/threads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/communication/email/messages'] });
      setMessageInput('');
      setPendingGoogleDriveAttachments([]);

      try {
        await apiRequest('/api/universal-crm/context/log-activity', {
          method: 'POST',
          body: {
            provider: 'gmail',
            conversationId: variables.threadId,
            type: 'email',
            subject: variables.subject || selectedEmailThreadPreview?.subject || 'E-postsvar',
            description: variables.message,
            direction: 'outbound',
            outcome: 'successful',
          },
        });
      } catch (error) {
        const status = typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
        if (status !== 409) {
          logChatWidgetEvent('UniversalChatWidget', 'warn', 'Could not log CRM Gmail activity', {
            error: error instanceof Error ? error.message : String(error),
            threadId: variables.threadId,
          });
        }
      }
    },
    onError: (error: Error) => {
      showStatusToast(error.message || 'Kunne ikke sende Gmail-svar.');
    },
  });

  const handleDeleteGoogleChatMessage = useCallback((messageId: string) => {
    if (!selectedGoogleSpace) {
      return;
    }
    if (!window.confirm('Vil du slette denne Google Chat-meldingen?')) {
      return;
    }
    deleteGoogleChatMessage.mutate({
      messageId,
      space: selectedGoogleSpace,
    });
  }, [deleteGoogleChatMessage, selectedGoogleSpace]);

  const sendCustomerInquiryEmail = useMutation({
    mutationFn: async (data: { to: string; message: string; subject?: string; conversationId: string }) => {
      return apiRequest('/api/communication/email/send', {
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
        method: 'POST',
        body: {
          to: data.to,
          subject: data.subject,
          message: data.message,
          conversationId: data.conversationId,
        },
      });
    },
    onSuccess: async (_response, variables) => {
      setMessageInput('');
      setPendingGoogleDriveAttachments([]);
      queryClient.invalidateQueries({ queryKey: ['/api/emails/recent'] });

      try {
        await apiRequest('/api/universal-crm/context/log-activity', {
          method: 'POST',
          body: {
            provider: 'gmail',
            conversationId: variables.conversationId,
            type: 'email',
            subject: variables.subject || selectedEmailThreadPreview?.subject || 'Kundeforespørsel',
            description: variables.message,
            direction: 'outbound',
            outcome: 'successful',
          },
        });
      } catch (error) {
        const status = typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
        if (status !== 409) {
          logChatWidgetEvent('UniversalChatWidget', 'warn', 'Could not log CRM activity for customer inquiry email', {
            error: error instanceof Error ? error.message : String(error),
            conversationId: variables.conversationId,
          });
        }
      }

      showStatusToast('E-postutkast sendt fra kundeforespørselen.');
    },
    onError: (error: Error) => {
      showStatusToast(error.message || 'Kunne ikke sende e-post fra kundeforespørselen.');
    },
  });

  // E-post integrasjon
  const sendEmailMessage = useMutation({
    mutationFn: async (data: { chatId: string; message: string; subject?: string }) => {
      return apiRequest('/api/communication/email/send', {
        headers: {
	        'X-User-Email': userEmail || 'anonymous'
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
    onSuccess: async (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/communication/conversations'] });
      setMessageInput('');
      setPendingGoogleDriveAttachments([]);

      try {
        await apiRequest('/api/universal-crm/context/log-activity', {
          method: 'POST',
          body: {
            provider: 'internal-chat',
            conversationId: variables.chatId,
            type: 'email',
            subject: variables.subject || `Melding fra ${profession}`,
            description: variables.message,
            direction: 'outbound',
            outcome: 'successful',
          },
        });
        queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });
      } catch (error) {
        const status = typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : undefined;
        if (status !== 409) {
          logChatWidgetEvent('UniversalChatWidget', 'warn', 'Could not log CRM email activity', {
            error: error instanceof Error ? error.message : String(error),
            chatId: variables.chatId,
          });
        }
      }
    }
  });

  const ensureConversationDriveFolderMutation = useMutation({
    mutationFn: async (payload?: { customerId?: string | null; silent?: boolean }) => {
      const resolvedCustomerId =
        payload?.customerId
        || (activeTab === TAB_EMAIL ? emailCrmConversationContext?.customer?.id : null)
        || quoteClientData.crmCustomerId
        || crmConversationContext?.customer?.id
        || selectedConversationHintCustomerId;

      if (!resolvedCustomerId) {
        throw new Error('Ingen CRM-kunde er koblet til denne samtalen ennå.');
      }

      const kvResponse = await apiRequest('/api/user/kv') as { data?: Record<string, unknown> } | Record<string, unknown>;
      const userKvData =
        kvResponse && typeof kvResponse === 'object' && 'data' in kvResponse
          ? ((kvResponse as { data?: Record<string, unknown> }).data || {})
          : (kvResponse as Record<string, unknown>);
      const customStructure = detectDriveFolderStructureFromKv(userKvData || {});
      const quoteFolderName = detectArchiveFolderNameFromKv(userKvData || {}, 'quote');
      const contractFolderName = detectArchiveFolderNameFromKv(userKvData || {}, 'contract');

      return apiRequest('/api/universal-crm/context/drive-folder/ensure', {
        method: 'POST',
        body: {
          customerId: resolvedCustomerId,
          customerName:
            (activeTab === TAB_EMAIL
              ? selectedEmailThreadPreview?.counterpartName || emailCrmConversationContext?.customer?.name
              : null)
            || quoteClientData.name
            || crmConversationContext?.customer?.name
            || selectedConversationHintName,
          companyName:
            (activeTab === TAB_EMAIL
              ? emailCrmConversationContext?.customer?.company
              : null)
            || crmConversationContext?.customer?.company
            || getRecordString(selectedClientContext, ['company', 'companyName', 'businessName'])
            || undefined,
          profession,
          projectId: quoteClientData.projectId || selectedConversationHintProjectId,
          projectName: quoteClientData.projectName || selectedConversationHintProjectName,
          conversationName: activeTab === TAB_GOOGLE_CHAT ? selectedGoogleSpacePreview?.name : activeTab === TAB_EMAIL ? selectedEmailThreadPreview?.subject : selectedChatPreview?.name,
          customStructure,
          quoteFolderName,
          contractFolderName,
        },
      });
    },
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });
      if (!variables?.silent) {
        showStatusToast('Kundemappen er klar og synkronisert med CRM.');
      }
    },
    onError: (error: Error, variables) => {
      if (!variables?.silent) {
        showStatusToast(error.message || 'Kunne ikke klargjøre kundemappen i Google Drive.');
      }
    },
  });

  const linkConversationToCrmMutation = useMutation({
    mutationFn: async (payload: { customerId: string; matchedBy?: string }) => {
      const conversationId = activeTab === TAB_EMAIL ? selectedEmailThread : selectedChat;
      const provider = activeTab === TAB_EMAIL ? 'gmail' : 'internal-chat';
      if (!conversationId) {
        throw new Error(activeTab === TAB_EMAIL ? 'Velg en e-posttråd først.' : 'Velg en samtale først.');
      }

      return apiRequest('/api/universal-crm/context/link', {
        method: 'POST',
        body: {
          provider,
          conversationId,
          customerId: payload.customerId,
          matchedBy: payload.matchedBy || 'manual',
          projectId: quoteClientData.projectId || selectedConversationHintProjectId,
          metadata: {
            source: 'universal-chat-widget',
            selectedConversation:
              activeTab === TAB_EMAIL
                ? selectedEmailThreadPreview?.subject || selectedEmailThreadPreview?.counterpartName || null
                : selectedChatPreview?.name || null,
          },
        },
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/customers'] });
      const linkedCustomer = response?.context?.customer;
      if (linkedCustomer) {
        setSelectedClientContext(linkedCustomer);
        onClientSelect?.(linkedCustomer);
        onClientUpdate?.(linkedCustomer);
        ensureConversationDriveFolderMutation.mutate({ customerId: linkedCustomer.id, silent: true });
      }
      setCrmLinkSearchTerm('');
      setCrmCreateFormOpen(false);
      showStatusToast('Samtalen er koblet til CRM.');
    },
    onError: (error: Error) => {
      showStatusToast(error.message || 'Kunne ikke koble samtalen til CRM.');
    },
  });

  const createCrmCustomerFromConversationMutation = useMutation({
    mutationFn: async () => {
      const conversationId = activeTab === TAB_EMAIL ? selectedEmailThread : selectedChat;
      const provider = activeTab === TAB_EMAIL ? 'gmail' : 'internal-chat';
      if (!conversationId) {
        throw new Error(activeTab === TAB_EMAIL ? 'Velg en e-posttråd først.' : 'Velg en samtale først.');
      }

      return apiRequest('/api/universal-crm/context/create-customer-link', {
        method: 'POST',
        body: {
          provider,
          conversationId,
          name: crmCreateDraft.name.trim(),
          email: crmCreateDraft.email.trim() || undefined,
          phone: crmCreateDraft.phone.trim() || undefined,
          company: crmCreateDraft.company.trim() || undefined,
          profession,
          projectId: quoteClientData.projectId || selectedConversationHintProjectId,
          projectType: getRecordString(selectedProjectContext, ['projectType', 'type', 'category']) || undefined,
          notes:
            activeTab === TAB_EMAIL
              ? `Opprettet fra Gmail-tråd med ${selectedEmailThreadPreview?.counterpartName || selectedEmailThreadPreview?.counterpartEmail || 'ukjent kontakt'}.`
              : selectedChatPreview
                ? `Opprettet fra chat med ${selectedChatPreview.name}.`
                : 'Opprettet fra chat.',
          source: activeTab === TAB_EMAIL ? 'gmail-conversation' : 'chat-conversation',
          createdBy: userId || userEmail || undefined,
        },
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/customers'] });
      if (response?.customer) {
        setSelectedClientContext(response.customer);
        onClientSelect?.(response.customer);
        onClientUpdate?.(response.customer);
        ensureConversationDriveFolderMutation.mutate({ customerId: response.customer.id, silent: true });
      }
      setCrmCreateFormOpen(false);
      showStatusToast('Ny CRM-kunde opprettet og koblet til samtalen.');
    },
    onError: (error: Error) => {
      showStatusToast(error.message || 'Kunne ikke opprette CRM-kunde.');
    },
  });

  const unlinkConversationFromCrmMutation = useMutation({
    mutationFn: async () => {
      const conversationId = activeTab === TAB_EMAIL ? selectedEmailThread : selectedChat;
      const provider = activeTab === TAB_EMAIL ? 'gmail' : 'internal-chat';
      if (!conversationId) {
        throw new Error(activeTab === TAB_EMAIL ? 'Velg en e-posttråd først.' : 'Velg en samtale først.');
      }

      return apiRequest('/api/universal-crm/context/unlink', {
        method: 'POST',
        body: {
          provider,
          conversationId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/universal-crm/context/by-conversation'] });
      showStatusToast('CRM-koblingen ble fjernet fra samtalen.');
    },
    onError: (error: Error) => {
      showStatusToast(error.message || 'Kunne ikke koble samtalen fra CRM.');
    },
  });

  const sendContractForSignatureMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return apiRequest(`/api/contracts/${contractId}/google-signature/send`, {
        method: 'POST',
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
        body: {
          userId: currentUserId || undefined,
        },
      });
    },
    onSuccess: async () => {
      await invalidateConversationWorkflowContext(selectedChat);
      showStatusToast('Kontrakten er sendt til signering.');
    },
    onError: (error: Error) => {
      showStatusToast(error.message || 'Kunne ikke sende kontrakten til signering.');
    },
  });

  const syncContractSignatureMutation = useMutation({
    mutationFn: async (contractId: string) => {
      return apiRequest(`/api/contracts/${contractId}/google-signature/sync`, {
        method: 'POST',
        headers: {
          'X-User-Email': userEmail || 'anonymous',
        },
        body: {
          userId: currentUserId || undefined,
        },
      });
    },
    onSuccess: async (response) => {
      await invalidateConversationWorkflowContext(selectedChat);
      const contract = (response && typeof response === 'object' ? (response as Record<string, any>).contract : null) || null;
      const signatureStatus = typeof contract?.signatureStatus === 'string'
        ? contract.signatureStatus
        : typeof contract?.signature_status === 'string'
          ? contract.signature_status
          : '';
      if (signatureStatus === 'signed') {
        showStatusToast('Kontrakten er signert.');
      } else if (signatureStatus === 'viewed') {
        showStatusToast('Kontrakten er åpnet og venter på signatur.');
      } else {
        showStatusToast('Kontraktstatus er oppdatert.');
      }
    },
    onError: (error: Error) => {
      showStatusToast(error.message || 'Kunne ikke oppdatere kontraktstatus.');
    },
  });

  // Ticket creation mutation
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData: TicketFormData) => {
      return apiRequest('/api/helpdesk/tickets', {
        headers: {
          'X-User-Email': userEmail || 'anonymous',
          'Content-Type': 'application/json'
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
          'X-User-Email': userEmail || 'anonymous'
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
	        'X-User-Email': userEmail || 'anonymous'
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
    if (sendQuickMessage.isPending || sendEmailMessage.isPending || sendGoogleChatMessage.isPending || sendGmailReply.isPending || sendCustomerInquiryEmail.isPending) {
      return;
    }

    const trimmedMessage = messageInput.trim();
    const attachments = buildPendingGoogleDriveAttachments();
    const summaryMessage = buildAttachmentSummaryText(pendingGoogleDriveAttachments);
    const remoteAttachmentSection = buildRemoteAttachmentSection(pendingGoogleDriveAttachments);
    const remoteMessage = [trimmedMessage, remoteAttachmentSection].filter((part) => part.trim().length > 0).join('\n\n');
    const internalMessage = trimmedMessage || summaryMessage;

    if (activeTab === TAB_GOOGLE_CHAT) {
      if ((trimmedMessage || attachments.length > 0) && selectedGoogleSpace) {
        sendGoogleChatMessage.mutate({
          space: selectedGoogleSpace,
          message: trimmedMessage,
          attachments,
        });
      }
      return;
    }

    if (activeTab === TAB_EMAIL) {
      if ((trimmedMessage || attachments.length > 0) && selectedEmailThread) {
        if (selectedEmailThreadPreview?.source === 'customer-inquiry') {
          const counterpartEmail = selectedEmailThreadPreview.counterpartEmail?.trim();
          if (!counterpartEmail) {
            showStatusToast('Denne forespørselen mangler e-postadresse.');
            return;
          }

          const subject = selectedEmailThreadPreview.subject.toLowerCase().startsWith('re:')
            ? selectedEmailThreadPreview.subject
            : `Re: ${selectedEmailThreadPreview.subject}`;

          sendCustomerInquiryEmail.mutate({
            to: counterpartEmail,
            message: remoteMessage || internalMessage,
            subject,
            conversationId: selectedEmailThread,
          });
        } else {
          sendGmailReply.mutate({
            threadId: selectedEmailThread,
            message: remoteMessage || internalMessage,
            subject: selectedEmailThreadPreview?.subject,
            attachments,
          });
        }
      }
      return;
    }

    if ((trimmedMessage || attachments.length > 0) && selectedChat) {
      const clientMessageId = crypto.randomUUID();

      // Keep the optimistic/WebSocket experience, but persist internal chat
      // through the communication API in all cases so Drive attachments follow
      // the same storage path regardless of email integration.
      void sendMessage({ persistToApi: false, clientMessageId });

      sendQuickMessage.mutate({
        chatId: selectedChat,
        message: internalMessage,
        attachments,
        clientMessageId,
      });

      if (emailIntegrationEnabled) {
        sendEmailMessage.mutate({
          chatId: selectedChat,
          message: remoteMessage || internalMessage,
          subject: `Ny melding fra ${profession}`
        });
      }
    }
  };

  const isQuickReplyPending = sendQuickMessage.isPending || sendEmailMessage.isPending || sendGoogleChatMessage.isPending || sendGmailReply.isPending || sendCustomerInquiryEmail.isPending;

  // Ticket creation helper functions
  const resetTicketForm = () => {
    setTicketFormData({
      title: '',
      description: '',
      category: 'question',
      priority: 'medium',
      chatContext: ''
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
      category: suggestion.category,
      priority: suggestion.priority
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
        icon: <BugReport />,
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
      case 'technical_issue': return <BugReport />;
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
      closed: feedbackList.filter(f => f.status === 'closed').length,
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
        id: selectedFeedback.id,
        status: newFeedbackStatus,
        adminNotes
  });
}
};

  const openFeedbackStatusDialog = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    setNewFeedbackStatus(feedback.status);
    setAdminNotes(feedback.adminNotes || '');
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
  const normalizedUtilityFilter = mobileUtilityFilter.trim().toLowerCase();
  const filteredMobileFeedback = normalizedUtilityFilter
    ? feedbackList.filter((feedback) =>
        [
          feedback.title,
          feedback.description,
          feedback.feedbackType,
          feedback.priority,
          feedback.status,
          feedback.userName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedUtilityFilter)
      )
    : feedbackList;
  const totalEvendiUnread = evendiConversations.reduce((sum, conversation) => sum + (conversation.vendor_unread_count || 0), 0);
  const filteredEvendiConversations = normalizedUtilityFilter
    ? evendiConversations.filter((conversation) =>
        [
          conversation.couple_name,
          conversation.vendor_name,
          conversation.last_message,
          conversation.project_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedUtilityFilter)
      )
    : evendiConversations;
  const selectedEvendiConversation = selectedEvendiConv
    ? evendiConversations.find((conversation) => conversation.id === selectedEvendiConv) ?? null
    : null;
  const filteredAcademyLinks = normalizedUtilityFilter
    ? academyQuickLinks.filter((link) =>
        [link.title, link.description]
          .join(' ')
          .toLowerCase()
          .includes(normalizedUtilityFilter)
      )
    : academyQuickLinks;
  const widgetAccent = getProfessionColor();
  // Slice 9X.68 — Dark-mode-tilpasset chat-design så det matcher det
  // mørke dashboard-temaet i stedet for å vises som en lys "popup" på
  // mørk side. Aksent-fargen (widgetAccent) er fortsatt brukerens
  // profession-color (orange for fotograf), men shells og surfaces er
  // nå mørke med subtil glød fra accent-fargen.
  const chatWidgetDesign = {
    accent: widgetAccent,
    accentSoft: getColorWithAlpha(widgetAccent, 0.08),
    accentMuted: getColorWithAlpha(widgetAccent, 0.18),
    border: getColorWithAlpha(widgetAccent, 0.32),
    headerGradient: `linear-gradient(132deg, ${getColorWithAlpha(widgetAccent, 0.45)} 0%, ${getColorWithAlpha(widgetAccent, 0.15)} 60%, rgba(15,10,7,0.96) 140%)`,
    shellGradient: `radial-gradient(circle at top, ${getColorWithAlpha(widgetAccent, 0.14)} 0%, rgba(15,10,7,0.98) 38%, #0a0807 100%)`,
    shellShadow: `0 28px 64px ${getColorWithAlpha(widgetAccent, 0.32)}`,
    cardShadow: `0 12px 32px ${getColorWithAlpha(widgetAccent, 0.18)}`,
  };
  const isWorkspacePanel = !isCompactViewport && Boolean(openLayout);
  const isNarrowWorkspace = isWorkspacePanel && widgetSize.width < 620;
  const isCompactHeaderWorkspace = isWorkspacePanel && widgetSize.width < 760;
  const isMediumWorkspace = isWorkspacePanel && !isNarrowWorkspace && widgetSize.width < 1040;
  const workspaceDisplayName = enhancedProfessionConfig?.displayName || professionConfig?.displayName || 'CreatorHub';
  const workspaceShellBorder = `1px solid ${getColorWithAlpha(widgetAccent, 0.22)}`;
  const workspaceCardBorder = 'rgba(255,255,255,0.08)';
  const workspaceShellBackground = `radial-gradient(circle at top, ${getColorWithAlpha(widgetAccent, 0.12)} 0%, rgba(20,16,11,0.97) 40%, #0a0807 100%)`;
  const workspaceSurface = 'linear-gradient(180deg, rgba(30,24,17,0.95) 0%, rgba(20,16,11,0.95) 100%)';
  const workspaceMutedSurface = 'linear-gradient(180deg, rgba(24,19,13,0.95) 0%, rgba(18,14,9,0.95) 100%)';
  const workspacePanelShadow = '0 32px 72px rgba(0,0,0,0.55)';
  const workspaceCardShadow = '0 16px 34px rgba(0,0,0,0.32)';
  const workspaceHeaderText = '#fff5e8';
  const workspaceSubtleText = 'rgba(246,242,234,0.68)';
  const workspaceShellAnimation = isCompactViewport
    ? (workspaceTransitionState === 'closing'
        ? 'mobileChatWindowOut 240ms cubic-bezier(0.32, 0.02, 0.2, 1) forwards'
        : workspaceTransitionState === 'opening'
          ? 'mobileChatWindowIn 360ms cubic-bezier(0.2, 0.9, 0.24, 1)'
          : 'none')
    : isWorkspacePanel
      ? (workspaceTransitionState === 'closing'
          ? 'workspaceChatWindowOut 260ms cubic-bezier(0.4, 0.0, 0.2, 1) forwards'
          : workspaceTransitionState === 'opening'
            ? 'workspaceChatWindowIn 620ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'none')
      : (workspaceTransitionState === 'closing'
          ? 'floatingChatWindowOut 220ms cubic-bezier(0.32, 0.02, 0.2, 1) forwards'
          : workspaceTransitionState === 'opening'
            ? 'floatingChatWindowIn 320ms cubic-bezier(0.22, 0.8, 0.28, 1)'
            : 'none');
  const workspacePanelAuraAnimation = isWorkspacePanel
    ? (workspaceTransitionState === 'closing'
        ? 'workspacePanelAuraOut 180ms cubic-bezier(0.4, 0.0, 0.2, 1) both'
        : workspaceTransitionState === 'opening'
          ? 'workspacePanelAuraIn 620ms cubic-bezier(0.16, 1, 0.3, 1) 30ms both'
          : 'none')
    : 'none';
  const workspaceChromeAnimation = isWorkspacePanel
    ? (workspaceTransitionState === 'closing'
        ? 'workspaceChromeOut 170ms cubic-bezier(0.4, 0.0, 0.2, 1) both'
        : workspaceTransitionState === 'opening'
          ? 'workspaceChromeIn 440ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both'
          : 'none')
    : 'none';
  const workspaceTabsAnimation = isWorkspacePanel
    ? (workspaceTransitionState === 'closing'
        ? 'workspaceChromeOut 150ms cubic-bezier(0.4, 0.0, 0.2, 1) both'
        : workspaceTransitionState === 'opening'
          ? 'workspaceChromeIn 420ms cubic-bezier(0.16, 1, 0.3, 1) 130ms both'
          : 'none')
    : 'none';
  const workspaceContentAnimation = isWorkspacePanel
    ? (workspaceTransitionState === 'closing'
        ? 'workspaceContentOut 170ms cubic-bezier(0.4, 0.0, 0.2, 1) both'
        : workspaceTransitionState === 'opening'
          ? 'workspaceContentIn 520ms cubic-bezier(0.16, 1, 0.3, 1) 160ms both'
          : 'none')
    : 'none';
  const headerSurface = isWorkspacePanel
    ? workspaceSurface
    : chatWidgetDesign.headerGradient;
  const activeTabLabel = activeTab === TAB_CREATORHUB
    ? 'CREATORHUB'
    : activeTab === TAB_GOOGLE_CHAT
      ? 'GOOGLE CHAT'
      : activeTab === TAB_EMAIL
        ? 'E-POST'
        : activeTab === TAB_FEEDBACK
        ? 'FEEDBACK'
        : activeTab === TAB_EVENDI
          ? 'EVENDI'
          : 'ACADEMY';
  const activeTabShortLabel = activeTab === TAB_CREATORHUB
    ? 'Hub'
    : activeTab === TAB_GOOGLE_CHAT
      ? 'Google'
      : activeTab === TAB_EMAIL
        ? 'E-post'
        : activeTab === TAB_FEEDBACK
        ? 'Feedback'
        : activeTab === TAB_EVENDI
          ? 'Evendi'
          : 'Academy';
  const headerTitle = isWorkspacePanel
    ? (activeTab === TAB_GOOGLE_CHAT ? 'Google Chat' : activeTab === TAB_EMAIL ? 'E-post' : activeTab === TAB_CREATORHUB ? 'Inbox' : activeTabShortLabel)
    : activeTab === TAB_EMAIL
      ? 'Gmail Inbox'
      : activeTab === TAB_GOOGLE_CHAT
        ? 'Google Chat'
        : 'Kommunikasjon';
  const headerSubtitle = activeTab === TAB_GOOGLE_CHAT
    ? (isWorkspacePanel
        ? 'Bytt rom, følg tråder og svar direkte fra CreatorHub.'
        : 'Google Chat-rom, meldinger og oppfølging samlet i én arbeidsflate.')
    : activeTab === TAB_EMAIL
      ? (isWorkspacePanel
          ? 'E-postforespørsler fra Gmail samlet i samme inbox og arbeidsflyt.'
          : 'Få Gmail-tråder inn i CreatorHub og svar uten å forlate dashboardet.')
    : isWorkspacePanel
      ? 'En samlet arbeidsflate for teamchat, Google Chat og videre oppfølging.'
      : isNarrowWorkspace
      ? `${workspaceDisplayName}: meldinger, svar og oppfølging uten å forlate dashboardet`
      : `${workspaceDisplayName}: en samlet inbox for teamchat, Google Chat, feedback og videre oppfølging`;
  const headerPrimaryChipLabel = activeTab === TAB_CREATORHUB
    ? 'CreatorHub inbox'
    : activeTab === TAB_GOOGLE_CHAT
      ? (selectedGoogleSpacePreview?.name || 'Google Chat')
      : activeTab === TAB_EMAIL
        ? (selectedEmailThreadPreview?.counterpartName || 'Gmail')
      : activeTabShortLabel;
  const headerActionButtonSx = isWorkspacePanel
    ? {
        color: '#64748b',
        border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.9)}`,
        bgcolor: 'rgba(255,255,255,0.04)',
        '&:hover': {
          color: '#0f172a',
          bgcolor: 'rgba(255,255,255,0.04)',
          borderColor: getColorWithAlpha('#94a3b8', 0.85),
        },
      }
    : {
        color: 'white',
        border: '1px solid rgba(255, 255, 255, 0.22)',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.14)' },
      };
  const tabContentHeight = isCompactViewport
    ? 'calc(100% - 188px)'
    : Math.max(360, widgetSize.height - (isWorkspacePanel ? (isNarrowWorkspace ? 188 : 176) : (isNarrowWorkspace ? 236 : 200)));
  const panelWidth = isCompactViewport ? 'min(390px, calc(100vw - 24px))' : widgetSize.width;
  const panelHeight = isCompactViewport ? 'min(calc(100vh - 24px), 860px)' : widgetSize.height;
  const isMobileConversationTab = isCompactViewport && (activeTab === TAB_CREATORHUB || activeTab === TAB_GOOGLE_CHAT || activeTab === TAB_EMAIL || activeTab === TAB_EVENDI);
  const isMobileDetailView = isMobileConversationTab && mobileConversationMode === 'detail';
  const selectedGoogleLatestMessage = googleChatMessages.length > 0 ? googleChatMessages[googleChatMessages.length - 1] : null;
  const selectedGoogleLastActivity =
    selectedGoogleSpacePreview?.lastActiveTime
    || selectedGoogleLatestMessage?.timestamp
    || null;
  const selectedGoogleSpaceDescriptor = !selectedGoogleSpacePreview
    ? 'Velg et rom for å se hele samtalen og svare direkte fra arbeidsflaten.'
    : selectedGoogleSpacePreview.description
      || (
        selectedGoogleSpacePreview.spaceType === 'DIRECT_MESSAGE'
          ? 'Direktemelding synkronisert direkte fra Google Chat.'
          : selectedGoogleSpacePreview.threaded
            ? 'Trådet arbeidsrom for koordinering og oppfølging.'
            : 'Fellesrom for oppgaver, avklaringer og oppfølging.'
      );
  const googleChatConnectionLabel = isGoogleChatConnected ? 'API aktiv' : 'Koble til';
  const googleChatLastCheckLabel = communicationStatus.googleChatLastCheck
    ? communicationStatus.googleChatLastCheck.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
    : null;
  const googleSelectedMessageCount = googleChatMessages.length;
  const googleSpaceSearchResultsCount = filteredGoogleChatSpaces.length;
  const googleSelectedSpaceMembers = typeof selectedGoogleSpacePreview?.memberCount === 'number'
    ? `${selectedGoogleSpacePreview.memberCount} medlem${selectedGoogleSpacePreview.memberCount === 1 ? '' : 'mer'}`
    : 'Deltakere ukjent';
  const gmailSelectedMessageCount = gmailThreadMessages.length;
  const gmailUnreadThreadCount = emailThreads.filter((thread) => thread.unreadCount > 0).length;
  const gmailNeedsReplyCount = emailThreads.filter((thread) => emailThreadNeedsReply(thread)).length;
  const gmailThreadsWithAttachmentsCount = emailThreads.filter((thread) => thread.hasAttachments).length;
  const selectedEmailLastMessage = gmailThreadMessages[gmailThreadMessages.length - 1] ?? null;
  const selectedEmailCounterpartLabel =
    selectedEmailThreadPreview?.counterpartName
    || selectedEmailThreadPreview?.counterpartEmail
    || 'E-postkontakt';
  const selectedEmailActivityLabel = selectedEmailThreadPreview?.timestamp
    ? `Sist aktivitet ${formatDetailedDate(selectedEmailThreadPreview.timestamp)} · ${formatDetailedTime(selectedEmailThreadPreview.timestamp)}`
    : 'Ingen aktivitet ennå';
  const activeEmailInboxSection = emailInboxSections.find((section) => section.id === emailInboxSection) || emailInboxSections[0];
  const selectedEmailReplyState = !selectedEmailThreadPreview
    ? 'Velg en tråd'
    : ((selectedEmailLastMessage?.direction || selectedEmailThreadPreview.direction) === 'inbound'
      ? 'Venter på svar'
      : 'Fulgt opp');
  const selectedEmailReplyTone = !selectedEmailThreadPreview
    ? '#64748b'
    : ((selectedEmailLastMessage?.direction || selectedEmailThreadPreview.direction) === 'inbound'
      ? '#ea580c'
      : '#2563eb');
  const selectedEmailDescriptor = selectedEmailThreadPreview
    ? `${selectedEmailThreadPreview.subject || '(uten emne)'}`
    : 'Velg en e-posttråd for å lese og svare direkte fra CreatorHub.';
  const gmailMessagesWithDaySeparators = gmailThreadMessages.map((message, index) => {
    const previousMessage = index > 0 ? gmailThreadMessages[index - 1] : null;
    const currentDateLabel = formatDetailedDate(message.timestamp);
    const previousDateLabel = previousMessage ? formatDetailedDate(previousMessage.timestamp) : null;

    return {
      message,
      dayLabel: currentDateLabel,
      showDayDivider: currentDateLabel !== previousDateLabel,
    };
  });
  const selectedConversationStatusLabel = selectedChatPreview?.status === 'online'
    ? 'Aktiv nå'
    : selectedChatPreview?.timestamp
      ? `Sist aktiv ${formatTime(selectedChatPreview.timestamp)}`
      : 'Klar for svar';
  const selectedConversationContext = [
    selectedClientContext
      ? {
          label:
            (typeof selectedClientContext.name === 'string' && selectedClientContext.name) ||
            (typeof selectedClientContext.clientName === 'string' && selectedClientContext.clientName) ||
            'Klient',
          icon: <BadgeIcon sx={{ fontSize: 14 }} />,
        }
      : null,
    selectedProjectContext
      ? {
          label:
            (typeof selectedProjectContext.name === 'string' && selectedProjectContext.name) ||
            (typeof selectedProjectContext.projectName === 'string' && selectedProjectContext.projectName) ||
            'Prosjekt',
          icon: <Assignment sx={{ fontSize: 14 }} />,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; icon: React.ReactElement }>;
  const selectedConversationEmail = selectedConversationHintEmail || '';
  const selectedConversationPhone = selectedConversationHintPhone || '';
  const selectedConversationProject = selectedConversationHintProjectName || '';
  const selectedConversationBudget =
    getRecordNumber(selectedProjectContext, ['budget', 'projectBudget', 'estimate']) ??
    getRecordNumber(selectedClientContext, ['budget', 'estimatedBudget']) ??
    undefined;
  const selectedConversationFirstName = selectedChatPreview?.name.split(' ')[0] || 'der';
  const selectedConversationMetrics = useMemo(() => {
    const inboundMessages = activeConversationMessages.filter((message) => !isOwnConversationMessage(message.senderId));
    const outboundMessages = activeConversationMessages.filter((message) => isOwnConversationMessage(message.senderId));
    const lastInboundMessage = [...inboundMessages].reverse()[0] || null;
    const lastOutboundMessage = [...outboundMessages].reverse()[0] || null;
    const pendingReply = Boolean(
      lastInboundMessage
      && (!lastOutboundMessage || new Date(lastInboundMessage.timestamp).getTime() > new Date(lastOutboundMessage.timestamp).getTime())
    );

    return {
      totalMessages: activeConversationMessages.length,
      inboundMessages: inboundMessages.length,
      outboundMessages: outboundMessages.length,
      lastInboundMessage,
      lastOutboundMessage,
      pendingReply,
    };
  }, [activeConversationMessages, isOwnConversationMessage]);
  const formatCrmCustomerStatusLabel = (status: string) => {
    switch (status) {
      case 'lead': return 'Lead';
      case 'prospect': return 'Prospekt';
      case 'active': return 'Aktiv kunde';
      case 'completed': return 'Ferdigstilt';
      case 'archived': return 'Arkivert';
      case 'customer': return 'Kunde';
      default: return 'CRM-kontakt';
    }
  };
  const getCrmCustomerStatusTone = (status: string) => {
    switch (status) {
      case 'lead': return '#f59e0b';
      case 'prospect': return '#2563eb';
      case 'active':
      case 'customer':
        return '#16a34a';
      case 'completed': return '#0f766e';
      case 'archived': return '#64748b';
      default: return '#475569';
    }
  };
  const formatCrmDealStageLabel = (stage: string) => {
    switch (stage) {
      case 'prospecting': return 'Utforsker';
      case 'qualification': return 'Kvalifisering';
      case 'proposal': return 'Tilbud sendt';
      case 'negotiation': return 'Forhandling';
      case 'closed_won': return 'Vunnet';
      case 'closed_lost': return 'Tapt';
      default: return 'Pipeline';
    }
  };
  const getCrmDealStageTone = (stage: string) => {
    switch (stage) {
      case 'prospecting': return '#0f766e';
      case 'qualification': return '#2563eb';
      case 'proposal': return '#7c3aed';
      case 'negotiation': return '#ea580c';
      case 'closed_won': return '#16a34a';
      case 'closed_lost': return '#64748b';
      default: return '#475569';
    }
  };
  const formatCommercialQuoteStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Utkast';
      case 'pending': return 'Sendt';
      case 'accepted': return 'Godkjent';
      case 'rejected': return 'Avslått';
      case 'expired': return 'Utløpt';
      default: return 'Tilbud';
    }
  };
  const formatCommercialContractStatusLabel = (status: string, signatureStatus: string) => {
    if (signatureStatus === 'signed' || status === 'signed') {
      return 'Signert';
    }
    if (signatureStatus === 'viewed') {
      return 'Åpnet';
    }
    if (signatureStatus === 'sent' || status === 'pending_signatures') {
      return 'Til signering';
    }
    if (signatureStatus === 'prepared') {
      return 'Klargjort';
    }
    if (status === 'cancelled') {
      return 'Avbrutt';
    }
    if (status === 'rejected') {
      return 'Avvist';
    }
    return 'Kontrakt';
  };
  const getCommercialStageTone = (stage?: string | null) => {
    switch (stage) {
      case 'contract_signed': return '#16a34a';
      case 'contract_sent': return '#2563eb';
      case 'contract_ready': return '#ea580c';
      case 'quote_accepted': return '#0f766e';
      case 'quote_sent': return '#7c3aed';
      case 'quote_rejected': return '#dc2626';
      case 'quote_draft': return '#475569';
      default: return '#64748b';
    }
  };
  const formatCommercialAmount = (amount?: number | null, currency = 'NOK') => {
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return null;
    }
    return new Intl.NumberFormat('nb-NO', { style: 'currency', currency }).format(amount);
  };
  const commercialWorkflow = crmConversationContext?.commercial ?? null;
  const commercialQuote = commercialWorkflow?.quote ?? null;
  const commercialContract = commercialWorkflow?.contract ?? null;
  const commercialTimeline = Array.isArray(commercialWorkflow?.timeline) ? commercialWorkflow.timeline : [];
  const commercialStageTone = getCommercialStageTone(commercialWorkflow?.stage);
  const commercialFlowBusy = sendContractForSignatureMutation.isPending || syncContractSignatureMutation.isPending;
  const commercialPrimaryActionLabel = (() => {
    switch (commercialWorkflow?.nextAction) {
      case 'create_quote': return 'Opprett tilbud';
      case 'follow_up_quote': return 'Følg opp tilbud';
      case 'send_contract': return 'Send til signering';
      case 'sync_contract': return 'Oppdater signaturstatus';
      case 'download_contract': return 'Last ned kontrakt';
      case 'review_contract': return 'Åpne dokument';
      default: return 'Opprett tilbud';
    }
  })();
  const commercialSecondaryAction = (() => {
    if (commercialContract?.googleDocUrl || commercialQuote?.googleDocUrl) {
      return {
        label: commercialContract ? 'Åpne dokument' : 'Åpne tilbud',
        action: handleOpenCommercialDocument,
      };
    }

    if (commercialContract?.id) {
      return {
        label: 'PDF',
        action: () => { void handleDownloadContractPdfFromChat(commercialContract.id); },
      };
    }

    return null;
  })();
  const commercialValueLabel = formatCommercialAmount(
    commercialContract?.totalAmount ?? commercialQuote?.totalAmount ?? null,
    commercialQuote?.currency || 'NOK',
  );
  const commercialStatusChips = [
    commercialQuote
      ? {
          key: `quote-${commercialQuote.id}`,
          label: `Tilbud · ${formatCommercialQuoteStatusLabel(commercialQuote.status)}`,
          tone: commercialQuote.status === 'accepted'
            ? '#0f766e'
            : commercialQuote.status === 'rejected'
              ? '#dc2626'
              : commercialQuote.status === 'pending'
                ? '#7c3aed'
                : '#475569',
        }
      : null,
    commercialContract
      ? {
          key: `contract-${commercialContract.id}`,
          label: `Kontrakt · ${formatCommercialContractStatusLabel(commercialContract.status, commercialContract.signatureStatus)}`,
          tone: commercialContract.signatureStatus === 'signed' || commercialContract.status === 'signed'
            ? '#16a34a'
            : commercialContract.signatureStatus === 'sent' || commercialContract.signatureStatus === 'viewed' || commercialContract.status === 'pending_signatures'
              ? '#2563eb'
              : '#ea580c',
        }
      : null,
    commercialValueLabel
      ? {
          key: 'commercial-value',
          label: commercialValueLabel,
          tone: '#0f172a',
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; tone: string }>;
  const emailCrmCustomer = emailCrmConversationContext?.customer ?? null;
  const emailCrmSummary = emailCrmConversationContext?.summary ?? null;
  const emailCommercialWorkflow = emailCrmConversationContext?.commercial ?? null;
  const emailCommercialQuote = emailCommercialWorkflow?.quote ?? null;
  const emailCommercialContract = emailCommercialWorkflow?.contract ?? null;
  const emailCommercialTimeline = Array.isArray(emailCommercialWorkflow?.timeline) ? emailCommercialWorkflow.timeline : [];
  const emailCommercialStageTone = getCommercialStageTone(emailCommercialWorkflow?.stage);
  const emailCommercialValueLabel = formatCommercialAmount(
    emailCommercialContract?.totalAmount ?? emailCommercialQuote?.totalAmount ?? null,
    emailCommercialQuote?.currency || 'NOK',
  );
  const emailCommercialStatusChips = [
    emailCommercialQuote
      ? {
          key: `quote-${emailCommercialQuote.id}`,
          label: `Tilbud · ${formatCommercialQuoteStatusLabel(emailCommercialQuote.status)}`,
          tone: emailCommercialQuote.status === 'accepted'
            ? '#0f766e'
            : emailCommercialQuote.status === 'rejected'
              ? '#dc2626'
              : emailCommercialQuote.status === 'pending'
                ? '#7c3aed'
                : '#475569',
        }
      : null,
    emailCommercialContract
      ? {
          key: `contract-${emailCommercialContract.id}`,
          label: `Kontrakt · ${formatCommercialContractStatusLabel(emailCommercialContract.status, emailCommercialContract.signatureStatus)}`,
          tone: emailCommercialContract.signatureStatus === 'signed' || emailCommercialContract.status === 'signed'
            ? '#16a34a'
            : emailCommercialContract.signatureStatus === 'sent' || emailCommercialContract.signatureStatus === 'viewed' || emailCommercialContract.status === 'pending_signatures'
              ? '#2563eb'
              : '#ea580c',
        }
      : null,
    emailCommercialValueLabel
      ? {
          key: 'commercial-value',
          label: emailCommercialValueLabel,
          tone: '#0f172a',
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; tone: string }>;
  const emailDriveContext = emailCrmConversationContext?.drive ?? null;
  const emailRecentActivities = Array.isArray(emailCrmConversationContext?.recentActivities) ? emailCrmConversationContext.recentActivities : [];
  const emailOpenTasks = Array.isArray(emailCrmConversationContext?.openTasks) ? emailCrmConversationContext.openTasks : [];
  const linkedCrmCustomer = crmConversationContext?.customer ?? null;
  const linkedCrmDrive = crmConversationContext?.drive ?? null;
  const recommendedCrmCustomer = crmConversationContext?.recommendedCustomer ?? null;
  const selectedConversationLeadLabel = linkedCrmCustomer
    ? (crmConversationContext?.activeDeal
        ? formatCrmDealStageLabel(crmConversationContext.activeDeal.stage)
        : formatCrmCustomerStatusLabel(linkedCrmCustomer.status))
    : crmConversationContext?.relationshipState === 'match_available'
      ? 'Match klar'
      : selectedConversationMetrics.pendingReply
        ? 'Svar anbefales'
        : 'Ikke koblet';
  const selectedConversationLeadColor = linkedCrmCustomer
    ? (crmConversationContext?.activeDeal
        ? getCrmDealStageTone(crmConversationContext.activeDeal.stage)
        : getCrmCustomerStatusTone(linkedCrmCustomer.status))
    : crmConversationContext?.relationshipState === 'match_available'
      ? '#2563eb'
      : selectedConversationMetrics.pendingReply
        ? '#ea580c'
        : '#64748b';
  const selectedConversationNextFollowUp =
    crmConversationContext?.summary?.nextFollowUp
    || (selectedConversationMetrics.pendingReply
      ? 'Svar anbefales nå'
      : selectedConversationMetrics.lastOutboundMessage?.timestamp
        ? `Følg opp ${formatDetailedDate(selectedConversationMetrics.lastOutboundMessage.timestamp)}`
        : 'Ingen frist satt');
  const selectedConversationMessageTemplates = selectedChatPreview ? [
    {
      id: 'status',
      label: 'Statusoppdatering',
      content: `Hei ${selectedConversationFirstName}! Jeg følger opp dette nå og sender deg en oppdatering så snart alt er klart.`,
    },
    {
      id: 'booking',
      label: 'Book møte',
      content: `Hei ${selectedConversationFirstName}! Skal vi ta en kort gjennomgang i dag eller i morgen for å lande detaljene?`,
    },
    {
      id: 'quote',
      label: 'Tilbudsoppfølging',
      content: `Hei ${selectedConversationFirstName}! Jeg setter opp et tilbud basert på det vi har snakket om og deler det med deg her i tråden.`,
    },
    {
      id: 'more-info',
      label: 'Be om info',
      content: `Hei ${selectedConversationFirstName}! For å komme videre trenger jeg litt mer informasjon om omfang, ønsket dato og eventuelle prioriteringer.`,
    },
  ] : [];
  const selectedConversationSuggestions = useMemo(() => {
    if (!selectedConversationMetrics.lastInboundMessage || !selectedChatPreview) {
      return [];
    }

    const messageContent = selectedConversationMetrics.lastInboundMessage.content.toLowerCase();
    if (/(pris|tilbud|kost)/.test(messageContent)) {
      return [
        `Hei ${selectedConversationFirstName}! Jeg klargjør et tilbud nå og sender det her så snart det er ferdig.`,
        `For å prise dette riktig trenger jeg dato, omfang og eventuelle tillegg du ønsker.`,
      ];
    }

    if (/(ledig|tilgjeng|dato|når)/.test(messageContent)) {
      return [
        `Hei ${selectedConversationFirstName}! Jeg sjekker kapasiteten min og bekrefter tilgjengelighet om et øyeblikk.`,
        `Jeg har dette på blokka. Hvilket tidspunkt passer best for deg om vi skal ta en rask avklaring?`,
      ];
    }

    if (/(kontrakt|avtale|sign)/.test(messageContent)) {
      return [
        `Hei ${selectedConversationFirstName}! Jeg sender over neste steg og kontraktsgrunnlag i denne tråden.`,
        `Jeg samler alt vi trenger og deler en ryddig oppsummering med deg nå.`,
      ];
    }

    return [
      `Hei ${selectedConversationFirstName}! Takk for oppdateringen. Jeg følger dette opp videre nå.`,
      `Supert, ${selectedConversationFirstName}. Jeg oppdaterer deg straks med neste steg.`,
    ];
  }, [selectedConversationFirstName, selectedConversationMetrics.lastInboundMessage, selectedChatPreview]);
  const crmSuggestedCustomers = useMemo(() => {
    const source = crmLinkSearchTerm.trim().length >= 2
      ? (crmSearchResults?.customers || [])
      : (crmConversationContext?.suggestedCustomers || []);
    const seen = new Set<string>();
    return source.filter((customer) => {
      if (!customer?.id || customer.id === linkedCrmCustomer?.id || seen.has(customer.id)) {
        return false;
      }
      seen.add(customer.id);
      return true;
    }).slice(0, crmLinkSearchTerm.trim().length >= 2 ? 8 : 4);
  }, [crmConversationContext?.suggestedCustomers, crmLinkSearchTerm, crmSearchResults?.customers, linkedCrmCustomer?.id]);
  const selectedConversationCrmMetrics = linkedCrmCustomer ? [
    {
      label: 'CRM-status',
      value: crmConversationContext?.activeDeal
        ? formatCrmDealStageLabel(crmConversationContext.activeDeal.stage)
        : formatCrmCustomerStatusLabel(linkedCrmCustomer.status),
      tone: selectedConversationLeadColor,
    },
    {
      label: 'Verdi',
      value: typeof crmConversationContext?.activeDeal?.value === 'number'
        ? `${crmConversationContext.activeDeal.value.toLocaleString('nb-NO')} ${crmConversationContext.activeDeal.currency || 'NOK'}`
        : typeof selectedConversationBudget === 'number'
          ? `${selectedConversationBudget.toLocaleString('nb-NO')} kr`
          : 'Ukjent',
      tone: '#2563eb',
    },
    {
      label: 'Oppgaver',
      value: `${crmConversationContext?.openTasks?.length || 0}`,
      tone: '#0f766e',
    },
    {
      label: 'Svarbehov',
      value: selectedConversationMetrics.pendingReply ? 'Høyt' : 'Stabilt',
      tone: selectedConversationMetrics.pendingReply ? '#ea580c' : '#475569',
    },
  ] : [];
  const selectedConversationActionCards = selectedChatPreview ? [
    {
      id: 'meeting',
      label: 'Planlegg oppfølging',
      description: 'Setter opp møte og deler lenken tilbake i tråden.',
      icon: <Schedule sx={{ fontSize: 18, color: '#2563eb' }} />,
      action: () => { void handleScheduleConversationFollowUp(); },
    },
    {
      id: 'quote',
      label: 'Opprett tilbud',
      description: 'Starter tilbudsflow og deler oppsummering i chatten.',
      icon: <RequestQuote sx={{ fontSize: 18, color: '#ea580c' }} />,
      action: handleOpenQuoteModal,
    },
    {
      id: 'email',
      label: 'Send e-post',
      description: 'Åpner e-postflyten med kontaktkontekst.',
      icon: <Email sx={{ fontSize: 18, color: '#0f766e' }} />,
      action: () => handleInternalAttachmentAction('email'),
    },
    {
      id: 'ticket',
      label: 'Opprett supportsak',
      description: 'Lager sak med chat-kontekst og forslag.',
      icon: <Support sx={{ fontSize: 18, color: '#7c3aed' }} />,
      action: handleCreateConversationTicket,
    },
    {
      id: 'note',
      label: 'Lagre notat',
      description: 'Oppretter intern oppfølging fra dialogen.',
      icon: <Edit sx={{ fontSize: 18, color: '#0f766e' }} />,
      action: () => { void handleCreateConversationNote(); },
    },
  ] : [];
  const renderPendingGoogleDriveAttachments = (options?: { compact?: boolean }) => {
    if (pendingGoogleDriveAttachments.length === 0) {
      return null;
    }

    const compact = Boolean(options?.compact);

    return (
      <Box
        sx={{
          display: 'grid',
          gap: compact ? 0.6 : 0.75,
          mb: compact ? 0.8 : 0.9,
          p: compact ? 0.85 : 1,
          borderRadius: compact ? 2.4 : 2.8,
          border: `1px solid ${getColorWithAlpha('#2563eb', 0.18)}`,
          bgcolor: 'rgba(33,150,243,0.10)',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 800, color: '#1d4ed8' }}>
          Klar til sending fra Google Drive
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
          {pendingGoogleDriveAttachments.map((attachment) => (
            <Box
              key={`pending-drive-${attachment.id}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.6,
                minWidth: 0,
                maxWidth: compact ? '100%' : 300,
                px: 0.9,
                py: 0.65,
                borderRadius: 999,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(191,219,254,0.9)',
              }}
            >
              <InsertDriveFile sx={{ fontSize: 16, color: '#2563eb', flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#0f172a' }} noWrap>
                  {attachment.filename}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {attachment.contextLabel
                    ? `${attachment.contextLabel} · ${attachment.fileSize > 0 ? `${Math.max(1, attachment.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Drive-fil'}`
                    : attachment.fileSize > 0
                      ? `${Math.max(1, attachment.fileSize / 1024 / 1024).toFixed(1)} MB`
                      : 'Drive-fil'}
                </Typography>
              </Box>
              {attachment.accessState && attachment.accessState !== 'private' && (
                <Chip
                  size="small"
                  label={attachment.accessState === 'recipient'
                    ? 'Delt med mottaker'
                    : attachment.accessState === 'domain'
                      ? 'Delt i workspace'
                      : 'Lenkedeling'}
                  sx={{
                    height: 22,
                    bgcolor: 'rgba(37,99,235,0.08)',
                    color: '#1d4ed8',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                />
              )}
              {attachment.downloadUrl && (
                <IconButton
                  size="small"
                  component="a"
                  href={attachment.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ color: '#64748b', flexShrink: 0 }}
                >
                  <OpenInNew sx={{ fontSize: 15 }} />
                </IconButton>
              )}
              <IconButton
                size="small"
                onClick={() => removePendingGoogleDriveAttachment(attachment.id)}
                sx={{ color: '#94a3b8', flexShrink: 0 }}
              >
                <Close sx={{ fontSize: 15 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };
  const renderConversationMessageAttachments = (
    attachments: ChatMessageType['attachments'] | undefined,
    ownMessage: boolean,
  ) => {
    if (!Array.isArray(attachments) || attachments.length === 0) {
      return null;
    }

    return (
      <Box sx={{ display: 'grid', gap: 0.55, mt: 0.8 }}>
        {attachments.map((attachment) => (
          <Box
            key={`message-attachment-${attachment.id}`}
            component={attachment.downloadUrl ? 'a' : 'div'}
            href={attachment.downloadUrl}
            target={attachment.downloadUrl ? '_blank' : undefined}
            rel={attachment.downloadUrl ? 'noreferrer' : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.65,
              px: 0.8,
              py: 0.65,
              borderRadius: 2.2,
              textDecoration: 'none',
              bgcolor: ownMessage ? 'rgba(255,255,255,0.16)' : 'rgba(239,246,255,0.9)',
              border: ownMessage ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(191,219,254,0.9)',
            }}
          >
            <InsertDriveFile sx={{ fontSize: 16, color: ownMessage ? 'white' : '#2563eb', flexShrink: 0 }} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontWeight: 700,
                  color: ownMessage ? 'white' : '#0f172a',
                }}
                noWrap
              >
                {attachment.filename}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: ownMessage ? 'rgba(255,255,255,0.76)' : '#64748b',
                }}
              >
                Drive-vedlegg
              </Typography>
            </Box>
            {attachment.downloadUrl && (
              <OpenInNew sx={{ fontSize: 15, color: ownMessage ? 'rgba(255,255,255,0.86)' : '#64748b', flexShrink: 0 }} />
            )}
          </Box>
        ))}
      </Box>
    );
  };
  const commercialTimelinePreview = commercialTimeline.slice(-3);
  const selectedConversationCommercialStrip = commercialWorkflow?.label ? (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3.2,
        border: `1px solid ${getColorWithAlpha(commercialStageTone, 0.22)}`,
        bgcolor: 'rgba(255,255,255,0.04)',
        boxShadow: '0 14px 28px rgba(15,23,42,0.05)',
        px: 1.25,
        py: 1.05,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isCompactViewport || isCompactHeaderWorkspace ? '1fr' : 'minmax(0, 1fr) auto',
          gap: 1,
          alignItems: 'center',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" sx={{ display: 'block', color: commercialStageTone, fontWeight: 800, letterSpacing: '0.08em', lineHeight: 1 }}>
            Tilbud og kontrakt
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827', mt: 0.25 }}>
            {commercialWorkflow.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.5 }}>
            {commercialWorkflow.detail}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55, mt: 0.85 }}>
            {commercialStatusChips.map((chip) => (
              <Chip
                key={chip.key}
                size="small"
                label={chip.label}
                sx={{
                  bgcolor: getColorWithAlpha(chip.tone, 0.1),
                  color: chip.tone,
                  fontWeight: 700,
                }}
              />
            ))}
          </Box>
          {commercialTimelinePreview.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.8 }}>
              {commercialTimelinePreview.map((entry) => (
                <Box key={entry.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.45 }}>
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: entry.completed ? commercialStageTone : '#cbd5e1',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {entry.label} · {formatDetailedDate(entry.timestamp)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.65, flexWrap: 'wrap', justifyContent: isCompactViewport || isCompactHeaderWorkspace ? 'flex-start' : 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handlePrimaryCommercialAction}
            disabled={commercialFlowBusy}
            sx={{
              borderRadius: 999,
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: commercialStageTone,
              boxShadow: 'none',
              '&:hover': { bgcolor: commercialStageTone, boxShadow: 'none', opacity: 0.92 },
            }}
          >
            {commercialPrimaryActionLabel}
          </Button>
          {commercialSecondaryAction && (
            <Button
              variant="outlined"
              onClick={commercialSecondaryAction.action}
              sx={{
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 700,
                borderColor: getColorWithAlpha(commercialStageTone, 0.28),
                color: commercialStageTone,
              }}
            >
              {commercialSecondaryAction.label}
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  ) : null;
  const crmCommercialWorkflowCard = commercialWorkflow?.label ? (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3.25,
        border: `1px solid ${getColorWithAlpha(commercialStageTone, 0.18)}`,
        bgcolor: 'rgba(255,255,255,0.04)',
        p: 1.2,
        boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
            Kommersiell flyt
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: commercialStageTone, fontWeight: 800, mt: 0.25 }}>
            {commercialWorkflow.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.5 }}>
            {commercialWorkflow.detail}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={commercialWorkflow.stage === 'contract_signed' ? 'Fullført' : 'Aktiv'}
          sx={{
            bgcolor: getColorWithAlpha(commercialStageTone, 0.12),
            color: commercialStageTone,
            fontWeight: 700,
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55, mt: 0.9 }}>
        {commercialStatusChips.map((chip) => (
          <Chip
            key={`crm-${chip.key}`}
            size="small"
            label={chip.label}
            sx={{
              bgcolor: getColorWithAlpha(chip.tone, 0.1),
              color: chip.tone,
              fontWeight: 700,
            }}
          />
        ))}
      </Box>

      {commercialTimeline.length > 0 && (
        <Box sx={{ display: 'grid', gap: 0.6, mt: 1 }}>
          {commercialTimeline.slice(-4).map((entry) => (
            <Box key={`crm-flow-${entry.id}`} sx={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto', gap: 0.55, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: entry.completed ? commercialStageTone : '#cbd5e1',
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
                {entry.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDetailedDate(entry.timestamp)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, flexWrap: 'wrap', mt: 1 }}>
        <Button
          variant="contained"
          onClick={handlePrimaryCommercialAction}
          disabled={commercialFlowBusy}
          sx={{
            borderRadius: 2.4,
            textTransform: 'none',
            fontWeight: 700,
            bgcolor: commercialStageTone,
            '&:hover': { bgcolor: commercialStageTone, opacity: 0.92 },
          }}
        >
          {commercialPrimaryActionLabel}
        </Button>
        {commercialSecondaryAction && (
          <Button
            variant="outlined"
            onClick={commercialSecondaryAction.action}
            sx={{
              borderRadius: 2.4,
              textTransform: 'none',
              fontWeight: 700,
              borderColor: getColorWithAlpha(commercialStageTone, 0.28),
              color: commercialStageTone,
            }}
          >
            {commercialSecondaryAction.label}
          </Button>
        )}
      </Box>
    </Paper>
  ) : null;
  const shouldShowInternalCrmRailPanel = Boolean(selectedChatPreview) && internalContactPanelOpen && isWorkspacePanel && !isNarrowWorkspace;
  const shouldShowInternalActionDialog = Boolean(selectedChatPreview) && internalContactPanelOpen && !shouldShowInternalCrmRailPanel;
  const crmPanelBusy =
    linkConversationToCrmMutation.isPending
    || createCrmCustomerFromConversationMutation.isPending
    || unlinkConversationFromCrmMutation.isPending;
  const shouldShowEmailCrmRailPanel = Boolean(selectedEmailThreadPreview) && emailContactPanelOpen && isWorkspacePanel && !isNarrowWorkspace;
  const shouldShowEmailActionDialog = Boolean(selectedEmailThreadPreview) && emailContactPanelOpen && !shouldShowEmailCrmRailPanel;
  const emailActionPanelContent = selectedEmailThreadPreview ? (
    <Box sx={{ display: 'grid', gap: 1.05 }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3.25,
          border: `1px solid ${workspaceCardBorder}`,
          bgcolor: 'rgba(255,255,255,0.04)',
          p: 1.2,
          boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 1.1, alignItems: 'center' }}>
          <Avatar sx={{ width: 48, height: 48, bgcolor: getColorWithAlpha(selectedEmailReplyTone, 0.12), color: selectedEmailReplyTone, fontWeight: 800 }}>
            {(selectedEmailCounterpartLabel || 'E').slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
              {emailCrmCustomer?.name || selectedEmailCounterpartLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
              {selectedEmailThreadPreview.counterpartEmail || selectedEmailActivityLabel}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1.15 }}>
          <Chip
            size="small"
            label={selectedEmailReplyState}
            sx={{
              bgcolor: getColorWithAlpha(selectedEmailReplyTone, 0.12),
              color: selectedEmailReplyTone,
              fontWeight: 800,
            }}
          />
          <Chip
            size="small"
            label={emailCrmCustomer ? 'Koblet til CRM' : 'Ikke koblet'}
            sx={{
              bgcolor: emailCrmCustomer ? 'rgba(22,163,74,0.12)' : 'rgba(15,23,42,0.06)',
              color: emailCrmCustomer ? '#166534' : '#475569',
              fontWeight: 700,
            }}
          />
          {selectedEmailThreadPreview.hasAttachments && (
            <Chip
              size="small"
              label="Har vedlegg"
              sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#1d4ed8', fontWeight: 700 }}
            />
          )}
        </Box>

        <Box sx={{ display: 'grid', gap: 0.75, mt: 1.15 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
              Emne
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827' }} noWrap>
              {selectedEmailThreadPreview.subject || '(uten emne)'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
              Neste steg
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827' }}>
              {emailCrmSummary?.nextFollowUp
                ? `Følg opp ${formatDetailedDate(emailCrmSummary.nextFollowUp)}`
                : emailCommercialWorkflow?.label || selectedEmailReplyState}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
              Kundemappe
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827' }}>
              {emailDriveContext?.folderName || 'Ikke klargjort'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3.25,
          border: `1px solid ${workspaceCardBorder}`,
          bgcolor: 'rgba(255,255,255,0.04)',
          p: 1.2,
          boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
          Neste handlinger
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          Hold tilbud, møte og oppfølging i samme e-postflyt.
        </Typography>
        <Box sx={{ display: 'grid', gap: 0.7, mt: 0.95 }}>
          {[
            { id: 'quote', label: 'Opprett tilbud', description: 'Lag tilbud direkte fra e-posttråden.', icon: <RequestQuote sx={{ fontSize: 18, color: '#ea580c' }} />, action: handleOpenQuoteModal },
            { id: 'meeting', label: 'Start møte', description: 'Opprett Meet og del tilbake i tråden.', icon: <VideoCall sx={{ fontSize: 18, color: '#2563eb' }} />, action: handleStartEmailMeeting },
            { id: 'follow-up', label: 'Planlegg oppfølging', description: 'Legg inn neste steg og knytt det til tråden.', icon: <Schedule sx={{ fontSize: 18, color: '#7c3aed' }} />, action: handleScheduleEmailFollowUp },
            { id: 'note', label: 'Lag notat', description: 'Logg oppfølging i CRM fra denne tråden.', icon: <Edit sx={{ fontSize: 18, color: '#0f766e' }} />, action: () => { void handleCreateEmailConversationNote(); } },
            { id: 'ticket', label: 'Opprett supportsak', description: 'Konverter tråden til en supportsak.', icon: <Support sx={{ fontSize: 18, color: '#7c3aed' }} />, action: handleCreateEmailConversationTicket },
          ].map((action) => (
            <Button
              key={action.id}
              fullWidth
              variant="outlined"
              onClick={action.action}
              startIcon={action.icon}
              sx={{
                justifyContent: 'flex-start',
                borderRadius: 2.4,
                textTransform: 'none',
                color: '#111827',
                borderColor: getColorWithAlpha('#cbd5e1', 0.9),
                bgcolor: 'rgba(248,250,252,0.9)',
              }}
            >
              <Box sx={{ textAlign: 'left' }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {action.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {action.description}
                </Typography>
              </Box>
            </Button>
          ))}
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3.25,
          border: `1px solid ${workspaceCardBorder}`,
          bgcolor: 'rgba(255,255,255,0.04)',
          p: 1.2,
          boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
          Kommersiell flyt
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          Tilbud, kontrakt og dokumentstatus for denne forespørselen.
        </Typography>

        <Box sx={{ display: 'grid', gap: 0.75, mt: 0.95 }}>
          <Box
            sx={{
              p: 0.95,
              borderRadius: 2.4,
              bgcolor: getColorWithAlpha(emailCommercialStageTone, 0.08),
              border: `1px solid ${getColorWithAlpha(emailCommercialStageTone, 0.18)}`,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }}>
              {emailCommercialWorkflow?.label || 'Ingen kommersiell flyt ennå'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.55 }}>
              {emailCommercialWorkflow?.detail || 'Opprett tilbud når forespørselen er kvalifisert.'}
            </Typography>
          </Box>
          {emailCommercialStatusChips.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.45 }}>
              {emailCommercialStatusChips.map((item) => (
                <Chip key={item.key} size="small" label={item.label} sx={{ bgcolor: getColorWithAlpha(item.tone, 0.12), color: item.tone, fontWeight: 700 }} />
              ))}
            </Box>
          )}
          {emailCommercialTimeline.length > 0 && (
            <Box sx={{ display: 'grid', gap: 0.55 }}>
              {emailCommercialTimeline.slice(0, 3).map((entry, index) => (
                <Box
                  key={`${entry?.type || 'step'}-${entry?.id || index}`}
                  sx={{
                    p: 0.85,
                    borderRadius: 2.1,
                    bgcolor: 'rgba(248,250,252,0.96)',
                    border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.72)}`,
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: '#0f172a' }}>
                    {entry?.label || entry?.subject || 'Kommersiell oppdatering'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {entry?.timestamp ? formatDetailedDate(entry.timestamp) : entry?.detail || 'Nylig oppdatert'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55 }}>
            <Button
              size="small"
              variant="contained"
              onClick={handlePrimaryEmailCommercialAction}
              disabled={commercialFlowBusy}
              sx={{ borderRadius: 999, textTransform: 'none', bgcolor: emailCommercialStageTone, '&:hover': { bgcolor: emailCommercialStageTone } }}
            >
              {getEmailCommercialPrimaryActionLabel()}
            </Button>
            {(emailCommercialContract?.googleDocUrl || emailCommercialQuote?.googleDocUrl) && (
              <Button size="small" variant="outlined" onClick={handleOpenEmailCommercialDocument} sx={{ borderRadius: 999, textTransform: 'none' }}>
                Åpne dokument
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3.25,
          border: `1px solid ${workspaceCardBorder}`,
          bgcolor: 'rgba(255,255,255,0.04)',
          p: 1.2,
          boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
          Kundemappe og historikk
        </Typography>
        <Box sx={{ display: 'grid', gap: 0.65, mt: 0.9 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={emailDriveContext?.folderUrl ? <OpenInNew sx={{ fontSize: 16 }} /> : <AttachFile sx={{ fontSize: 16 }} />}
            onClick={() => {
              if (emailDriveContext?.folderUrl) {
                window.open(emailDriveContext.folderUrl, '_blank', 'noopener,noreferrer');
                return;
              }
              ensureConversationDriveFolderMutation.mutate();
            }}
            disabled={ensureConversationDriveFolderMutation.isPending || (!emailCrmCustomer && !emailDriveContext?.folderUrl)}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              borderRadius: 2.4,
              borderColor: getColorWithAlpha(getProfessionColor(), 0.28),
              color: getProfessionColor(),
            }}
          >
            {emailDriveContext?.folderUrl ? 'Åpne kundemappe' : 'Klargjør kundemappe'}
          </Button>
          {(emailOpenTasks.length > 0 || emailRecentActivities.length > 0) && (
            <Box sx={{ display: 'grid', gap: 0.55 }}>
              {emailOpenTasks.slice(0, 2).map((task) => (
                <Box key={task.id} sx={{ p: 0.9, borderRadius: 2.2, bgcolor: 'rgba(248,250,252,0.98)' }}>
                  <Typography variant="caption" sx={{ display: 'block', color: '#0f172a', fontWeight: 800 }}>
                    {task.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {task.status} · {task.dueDate ? formatDetailedDate(task.dueDate) : 'Ingen frist'}
                  </Typography>
                </Box>
              ))}
              {emailRecentActivities.slice(0, 2).map((activity) => (
                <Box key={activity.id} sx={{ p: 0.9, borderRadius: 2.2, bgcolor: 'rgba(248,250,252,0.98)' }}>
                  <Typography variant="caption" sx={{ display: 'block', color: '#0f172a', fontWeight: 800 }}>
                    {activity.subject}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activity.type} · {activity.createdAt ? formatDetailedDate(activity.createdAt) : 'Nylig'}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  ) : null;
  const internalActionPanelContent = selectedChatPreview ? (
    <Box sx={{ display: 'grid', gap: 1.05 }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3.25,
          border: `1px solid ${workspaceCardBorder}`,
          bgcolor: 'rgba(255,255,255,0.04)',
          p: 1.2,
          boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr)', gap: 1.1, alignItems: 'center' }}>
          <Avatar src={selectedChatPreview.avatar} sx={{ width: 48, height: 48, fontWeight: 800 }}>
            {selectedChatPreview.name.charAt(0)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
              {linkedCrmCustomer?.name || selectedChatPreview.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
              {linkedCrmCustomer?.email || selectedConversationEmail || selectedConversationStatusLabel}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1.15 }}>
          <Chip
            size="small"
            label={selectedConversationLeadLabel}
            sx={{
              bgcolor: getColorWithAlpha(selectedConversationLeadColor, 0.12),
              color: selectedConversationLeadColor,
              fontWeight: 800,
            }}
          />
          {linkedCrmCustomer ? (
            <Chip
              size="small"
              label="Koblet til CRM"
              sx={{ bgcolor: 'rgba(22,163,74,0.12)', color: '#166534', fontWeight: 700 }}
            />
          ) : (
            <Chip
              size="small"
              label={recommendedCrmCustomer ? 'Forslag klart' : 'Krever kobling'}
              sx={{
                bgcolor: recommendedCrmCustomer ? 'rgba(37,99,235,0.1)' : 'rgba(15,23,42,0.06)',
                color: recommendedCrmCustomer ? '#1d4ed8' : '#475569',
                fontWeight: 700,
              }}
            />
          )}
          {selectedConversationContext.map((context) => (
            <Chip
              key={`crm-${context.label}`}
              size="small"
              icon={context.icon}
              label={context.label}
              sx={{ bgcolor: 'rgba(255,255,255,0.04)', fontWeight: 700 }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'grid', gap: 0.75, mt: 1.15 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
              Telefon
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827' }}>
              {linkedCrmCustomer?.phone || selectedConversationPhone || 'Ikke registrert'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
              Prosjekt
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827' }}>
              {selectedConversationProject || crmConversationContext?.conversation?.projectName || 'Ikke valgt'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
              Neste steg
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827' }}>
              {selectedConversationNextFollowUp}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
              Kundemappe
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#111827' }}>
              {linkedCrmDrive?.folderName || 'Klargjøres ved første vedlegg'}
            </Typography>
          </Box>
        </Box>

        {linkedCrmCustomer ? (
          <>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75, mt: 1.15 }}>
              {selectedConversationCrmMetrics.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    p: 0.9,
                    borderRadius: 2.4,
                    bgcolor: 'rgba(248,250,252,0.95)',
                    border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.72)}`,
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontWeight: 700 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: item.tone, mt: 0.2 }}>
                    {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.7, mt: 1.15 }}>
              <Button
                variant="contained"
                startIcon={<VideoCall sx={{ fontSize: 18 }} />}
                onClick={() => handleStartConversationCall('video')}
                disabled={meetingCreationPending}
                sx={{
                  borderRadius: 2.4,
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: '#0f172a',
                  '&:hover': { bgcolor: '#111827' },
                }}
              >
                Start møte
              </Button>
              <Button
                variant="outlined"
                startIcon={linkedCrmDrive?.folderUrl ? <OpenInNew sx={{ fontSize: 16 }} /> : <AttachFile sx={{ fontSize: 16 }} />}
                onClick={() => {
                  if (linkedCrmDrive?.folderUrl) {
                    window.open(linkedCrmDrive.folderUrl, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  ensureConversationDriveFolderMutation.mutate({
                    customerId: linkedCrmCustomer.id,
                  });
                }}
                disabled={ensureConversationDriveFolderMutation.isPending}
                sx={{
                  borderRadius: 2.4,
                  borderColor: getColorWithAlpha(getProfessionColor(), 0.28),
                  color: getProfessionColor(),
                  textTransform: 'none',
                  fontWeight: 700,
                }}
              >
                {linkedCrmDrive?.folderUrl ? 'Åpne kundemappe' : 'Klargjør kundemappe'}
              </Button>
            </Box>
            <Button
              fullWidth
              variant="text"
              startIcon={<InsertDriveFile sx={{ fontSize: 16 }} />}
              onClick={() => openGoogleDriveAttachmentPicker()}
              sx={{
                mt: 0.7,
                justifyContent: 'flex-start',
                textTransform: 'none',
                fontWeight: 700,
                color: '#0f172a',
              }}
            >
              Legg ved fra kundemappe
            </Button>
          </>
        ) : (
          <Alert severity={recommendedCrmCustomer ? 'info' : 'warning'} sx={{ mt: 1.15, borderRadius: 2.6 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {recommendedCrmCustomer
                ? `Fant en god match: ${recommendedCrmCustomer.name}`
                : 'Samtalen er ikke koblet til UniversalCRM ennå.'}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.35 }}>
              {recommendedCrmCustomer
                ? 'Bekreft koblingen for å få aktiviteter, oppfølging og CRM-historikk direkte i venstrerailen.'
                : 'Koble en eksisterende kunde eller opprett en ny for å samle møte, notater, tilbud og oppfølging på ett sted.'}
            </Typography>
            {recommendedCrmCustomer && (
              <Button
                size="small"
                variant="contained"
                disabled={crmPanelBusy}
                onClick={() => linkConversationToCrmMutation.mutate({
                  customerId: recommendedCrmCustomer.id,
                  matchedBy: recommendedCrmCustomer.matchReason || 'suggested-match',
                })}
                sx={{
                  mt: 0.9,
                  borderRadius: 999,
                  textTransform: 'none',
                  bgcolor: '#0f172a',
                  '&:hover': { bgcolor: '#111827' },
                }}
              >
                Koble {recommendedCrmCustomer.name}
              </Button>
            )}
          </Alert>
        )}
      </Paper>

      {crmCommercialWorkflowCard}

      {linkedCrmCustomer ? (
        <>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3.25,
              border: `1px solid ${workspaceCardBorder}`,
              bgcolor: 'rgba(255,255,255,0.04)',
              p: 1.2,
              boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.9 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
                  Oppfølging og pipeline
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Alt som krever oppmerksomhet i CRM akkurat nå.
                </Typography>
              </Box>
              <Button
                size="small"
                variant="text"
                disabled={unlinkConversationFromCrmMutation.isPending}
                onClick={() => unlinkConversationFromCrmMutation.mutate()}
                sx={{ textTransform: 'none', fontWeight: 700, color: '#64748b' }}
              >
                Koble fra
              </Button>
            </Box>

            {crmConversationContext?.activeDeal && (
              <Box
                sx={{
                  p: 1,
                  borderRadius: 2.6,
                  bgcolor: 'rgba(248,250,252,0.92)',
                  border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.72)}`,
                  mb: 0.9,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }}>
                  {crmConversationContext.activeDeal.title}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55, mt: 0.6 }}>
                  <Chip
                    size="small"
                    label={formatCrmDealStageLabel(crmConversationContext.activeDeal.stage)}
                    sx={{
                      bgcolor: getColorWithAlpha(getCrmDealStageTone(crmConversationContext.activeDeal.stage), 0.12),
                      color: getCrmDealStageTone(crmConversationContext.activeDeal.stage),
                      fontWeight: 700,
                    }}
                  />
                  {typeof crmConversationContext.activeDeal.value === 'number' && (
                    <Chip
                      size="small"
                      label={`${crmConversationContext.activeDeal.value.toLocaleString('nb-NO')} ${crmConversationContext.activeDeal.currency || 'NOK'}`}
                      sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#1d4ed8', fontWeight: 700 }}
                    />
                  )}
                </Box>
              </Box>
            )}

            {crmConversationContext?.openTasks && crmConversationContext.openTasks.length > 0 ? (
              <Box sx={{ display: 'grid', gap: 0.65 }}>
                {crmConversationContext.openTasks.slice(0, 3).map((task) => (
                  <Box
                    key={task.id}
                    sx={{
                      p: 0.95,
                      borderRadius: 2.4,
                      border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.72)}`,
                      bgcolor: 'rgba(248,250,252,0.92)',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
                      {task.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      {task.dueDate
                        ? `Forfaller ${new Date(task.dueDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}`
                        : 'Ingen frist satt'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Ingen åpne CRM-oppgaver for denne samtalen.
              </Typography>
            )}

            {crmConversationContext?.recentActivities && crmConversationContext.recentActivities.length > 0 && (
              <Box sx={{ display: 'grid', gap: 0.65, mt: 0.95 }}>
                {crmConversationContext.recentActivities.slice(0, 3).map((activity) => (
                  <Box key={activity.id} sx={{ display: 'grid', gap: 0.2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
                      {activity.subject}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(activity.scheduledAt || activity.createdAt)
                        ? new Date(activity.scheduledAt || activity.createdAt || '').toLocaleString('nb-NO', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Uten tidspunkt'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 3.25,
              border: `1px solid ${workspaceCardBorder}`,
              bgcolor: 'rgba(255,255,255,0.04)',
              p: 1.2,
              boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Neste handlinger
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              Handlinger som samtidig oppdaterer CRM-konteksten.
            </Typography>
            <Box sx={{ display: 'grid', gap: 0.7, mt: 0.95 }}>
              {selectedConversationActionCards.map((action) => (
                <Button
                  key={action.id}
                  fullWidth
                  variant="outlined"
                  onClick={action.action}
                  startIcon={action.icon}
                  sx={{
                    justifyContent: 'flex-start',
                    borderRadius: 2.4,
                    textTransform: 'none',
                    color: '#111827',
                    borderColor: getColorWithAlpha('#cbd5e1', 0.9),
                    bgcolor: 'rgba(248,250,252,0.9)',
                  }}
                >
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {action.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {action.description}
                    </Typography>
                  </Box>
                </Button>
              ))}
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 3.25,
              border: `1px solid ${workspaceCardBorder}`,
              bgcolor: 'rgba(255,255,255,0.04)',
              p: 1.2,
              boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Meldingsmaler
            </Typography>
            <Box sx={{ display: 'grid', gap: 0.65, mt: 0.95 }}>
              {selectedConversationMessageTemplates.map((template) => (
                <Button
                  key={template.id}
                  fullWidth
                  variant="text"
                  onClick={() => replaceMessageInput(template.content, `${template.label} lagt i composer.`)}
                  sx={{
                    justifyContent: 'space-between',
                    px: 1,
                    py: 0.95,
                    textTransform: 'none',
                    borderRadius: 2.2,
                    color: '#0f172a',
                    bgcolor: 'rgba(248,250,252,0.92)',
                    border: `1px solid ${getColorWithAlpha('#e2e8f0', 0.92)}`,
                  }}
                >
                  <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {template.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {template.content}
                    </Typography>
                  </Box>
                  <Edit sx={{ fontSize: 16, color: '#64748b' }} />
                </Button>
              ))}
            </Box>

            {selectedConversationSuggestions.length > 0 && (
              <Box sx={{ display: 'grid', gap: 0.65, mt: 0.95 }}>
                {selectedConversationSuggestions.map((suggestion, index) => (
                  <Button
                    key={`suggestion-${index}`}
                    fullWidth
                    variant="outlined"
                    onClick={() => replaceMessageInput(suggestion, 'Svarforslag lagt i composer.')}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      borderRadius: 2.2,
                      borderColor: getColorWithAlpha('#f97316', 0.18),
                      color: '#111827',
                      bgcolor: 'rgba(255,250,245,0.95)',
                    }}
                  >
                    <Typography variant="body2" sx={{ textAlign: 'left', lineHeight: 1.45 }}>
                      {suggestion}
                    </Typography>
                  </Button>
                ))}
              </Box>
            )}
          </Paper>
        </>
      ) : (
        <>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 3.25,
              border: `1px solid ${workspaceCardBorder}`,
              bgcolor: 'rgba(255,255,255,0.04)',
              p: 1.2,
              boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Koble til UniversalCRM
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              Velg en eksisterende kunde eller opprett en ny uten å forlate chatten.
            </Typography>

            <TextField
              value={crmLinkSearchTerm}
              onChange={(event) => setCrmLinkSearchTerm(event.target.value)}
              size="small"
              placeholder="Søk etter kunde, e-post eller selskap"
              fullWidth
              sx={{ mt: 1.05 }}
            />

            <Box sx={{ display: 'grid', gap: 0.65, mt: 0.9 }}>
              {crmConversationContextLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Henter CRM-kontekst...
                </Typography>
              ) : crmSuggestedCustomers.length > 0 ? crmSuggestedCustomers.map((customer) => (
                <Button
                  key={customer.id}
                  fullWidth
                  variant="outlined"
                  disabled={crmPanelBusy}
                  onClick={() => linkConversationToCrmMutation.mutate({
                    customerId: customer.id,
                    matchedBy: customer.matchReason || 'manual',
                  })}
                  sx={{
                    justifyContent: 'space-between',
                    borderRadius: 2.4,
                    textTransform: 'none',
                    color: '#111827',
                    borderColor: getColorWithAlpha('#cbd5e1', 0.9),
                    bgcolor: 'rgba(248,250,252,0.92)',
                  }}
                >
                  <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                      {customer.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {[customer.email, customer.company, customer.matchReason].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                  <Chip size="small" label="Koble" sx={{ fontWeight: 700 }} />
                </Button>
              )) : (
                <Typography variant="body2" color="text.secondary">
                  Ingen eksisterende CRM-kunder matcher ennå.
                </Typography>
              )}
            </Box>

            <Button
              fullWidth
              variant="text"
              startIcon={<Add sx={{ fontSize: 18 }} />}
              onClick={() => setCrmCreateFormOpen((current) => !current)}
              sx={{ mt: 0.9, textTransform: 'none', fontWeight: 700 }}
            >
              {crmCreateFormOpen ? 'Skjul nytt kundefelt' : 'Opprett ny kunde'}
            </Button>

            <Collapse in={crmCreateFormOpen} unmountOnExit>
              <Box sx={{ display: 'grid', gap: 0.75, mt: 0.8 }}>
                <TextField
                  label="Navn"
                  size="small"
                  value={crmCreateDraft.name}
                  onChange={(event) => setCrmCreateDraft((current) => ({ ...current, name: event.target.value }))}
                />
                <TextField
                  label="E-post"
                  size="small"
                  value={crmCreateDraft.email}
                  onChange={(event) => setCrmCreateDraft((current) => ({ ...current, email: event.target.value }))}
                />
                <TextField
                  label="Telefon"
                  size="small"
                  value={crmCreateDraft.phone}
                  onChange={(event) => setCrmCreateDraft((current) => ({ ...current, phone: event.target.value }))}
                />
                <TextField
                  label="Selskap"
                  size="small"
                  value={crmCreateDraft.company}
                  onChange={(event) => setCrmCreateDraft((current) => ({ ...current, company: event.target.value }))}
                />
                <Button
                  variant="contained"
                  disabled={crmPanelBusy || !crmCreateDraft.name.trim()}
                  onClick={() => createCrmCustomerFromConversationMutation.mutate()}
                  sx={{
                    borderRadius: 2.4,
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: '#0f172a',
                    '&:hover': { bgcolor: '#111827' },
                  }}
                >
                  Opprett og koble
                </Button>
              </Box>
            </Collapse>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              borderRadius: 3.25,
              border: `1px solid ${workspaceCardBorder}`,
              bgcolor: 'rgba(255,255,255,0.04)',
              p: 1.2,
              boxShadow: '0 14px 30px rgba(15,23,42,0.05)',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Først koble, så jobbe videre
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.55 }}>
              Når denne samtalen er koblet til UniversalCRM får du oppgaver, aktivitetshistorikk og oppfølging direkte her i venstrerailen.
            </Typography>
          </Paper>
        </>
      )}
    </Box>
  ) : null;
  const internalCrmRailPanel = selectedChatPreview ? (
    <Box sx={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <Slide in={shouldShowInternalCrmRailPanel} direction="right" mountOnEnter unmountOnExit appear={false}>
        <Paper
          elevation={0}
          sx={{
            ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
            borderRadius: 4,
            border: `1px solid ${workspaceCardBorder}`,
            bgcolor: workspaceSurface,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            boxShadow: workspaceCardShadow,
          }}
        >
          <Box
            sx={{
              px: 1.35,
              py: 1.15,
              borderBottom: `1px solid ${workspaceCardBorder}`,
              background: workspaceMutedSurface,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={{ display: 'block', color: '#ea580c', fontWeight: 800, letterSpacing: '0.08em', lineHeight: 1 }}>
                CRM
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827', mt: 0.3 }}>
                Kontakt og oppfølging
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Skyves ut fra venstrerailen for valgt samtale.
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleToggleInternalContactPanel}
              aria-label="Lukk CRM-system"
              sx={{
                color: '#475569',
                border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.9)}`,
              }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.1, bgcolor: 'rgba(20,16,11,0.6)' }}>
            {internalActionPanelContent}
          </Box>
        </Paper>
      </Slide>
    </Box>
  ) : null;

  const internalInboxNavigation = (
    <Paper
      elevation={0}
      sx={{
        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
        borderRadius: 4,
        border: `1px solid ${workspaceCardBorder}`,
        bgcolor: workspaceSurface,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: workspaceCardShadow,
      }}
    >
      <Box sx={{ px: 1.5, py: 1.45, borderBottom: `1px solid ${workspaceCardBorder}`, background: workspaceMutedSurface }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', fontWeight: 800, color: '#ea580c', letterSpacing: '0.1em', lineHeight: 1 }}>
              Inbox
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827', mt: 0.35 }}>
              Kanaler og mapper
            </Typography>
          </Box>
          <IconButton size="small" sx={{ color: '#111827' }} onClick={handleFocusInternalSearch} aria-label="Søk i samtaler">
            <Search sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ px: 1, py: 1.05, display: 'grid', gap: 0.45 }}>
        {internalInboxSections.map((section) => {
          const selected = internalInboxSection === section.id;

          return (
            <Box
              key={section.id}
              onClick={() => setInternalInboxSection(section.id)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '18px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 1,
                px: 1.05,
                py: 0.92,
                borderRadius: 2.8,
                cursor: 'pointer',
                color: selected ? '#ea580c' : '#374151',
                bgcolor: selected ? 'rgba(249,115,22,0.1)' : 'transparent',
                borderLeft: selected ? '2px solid #f97316' : '2px solid transparent',
                transition: 'all 140ms ease',
                '&:hover': {
                  bgcolor: selected ? 'rgba(249,115,22,0.14)' : 'rgba(15,23,42,0.04)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {section.icon}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: selected ? 800 : 600 }}>
                {section.label}
              </Typography>
              <Typography variant="caption" color={selected ? '#ea580c' : 'text.secondary'} sx={{ fontWeight: 700 }}>
                {section.count}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Divider sx={{ borderColor: chatWidgetDesign.border }} />

      <Box sx={{ px: 1.4, py: 1.1, minHeight: 0, overflow: 'auto' }}>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: '#6b7280', mb: 1 }}>
          Ditt team
        </Typography>
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          {teamRoster.length > 0 ? teamRoster.map((chat) => (
            <Box
              key={`roster-${chat.id}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr)',
                alignItems: 'center',
                gap: 0.8,
              }}
            >
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <Box
                    sx={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      bgcolor: getStatusColor(chat.status),
                      border: '2px solid white',
                    }}
                  />
                }
              >
                <Avatar src={chat.avatar} sx={{ width: 30, height: 30, fontSize: '0.78rem' }}>
                  {chat.name.charAt(0)}
                </Avatar>
              </Badge>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {chat.name}
              </Typography>
            </Box>
          )) : (
            <Typography variant="body2" color="text.secondary">
              Ingen teammedlemmer tilgjengelig ennå.
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', px: 1.4, py: 1.2, borderTop: `1px solid ${chatWidgetDesign.border}` }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<OpenInNew sx={{ fontSize: 15 }} />}
          onClick={handleOpenUniversalDashboard}
          sx={{
            borderColor: getColorWithAlpha(getProfessionColor(), 0.28),
            color: getProfessionColor(),
            borderRadius: 2.4,
            textTransform: 'none',
            fontWeight: 700,
          }}
        >
          Åpne dashboard
        </Button>
      </Box>
    </Paper>
  );

  const internalConversationList = (
    <Paper
      elevation={0}
      sx={{
        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
        borderRadius: 4,
        border: `1px solid ${workspaceCardBorder}`,
        bgcolor: workspaceSurface,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: workspaceCardShadow,
      }}
    >
      <Box sx={{ px: 1.5, py: 1.35, borderBottom: `1px solid ${workspaceCardBorder}`, background: workspaceMutedSurface }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', lineHeight: 1 }}>
              Samtaler
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827', mt: 0.35 }}>
              {internalInboxSections.find((section) => section.id === internalInboxSection)?.label || 'Alle'}
            </Typography>
          </Box>
          <Chip
            size="small"
            label={`${filteredChatPreviews.length}`}
            sx={{ height: 24, bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 700 }}
          />
        </Box>
        <TextField
          fullWidth
          size="small"
          inputRef={internalSearchInputRef}
          value={internalChatFilter}
          onChange={(event) => setInternalChatFilter(event.target.value)}
          placeholder="Søk i samtaler"
          sx={{
            mt: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
              bgcolor: 'rgba(248,250,252,0.96)',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 0.9, display: 'grid', gap: 0.75 }}>
        {filteredChatPreviews.length > 0 ? filteredChatPreviews.map((chat) => {
          const isSelected = selectedChat === chat.id;

          return (
            <Box
              key={chat.id}
              onClick={() => setSelectedChat(chat.id)}
              sx={{
                cursor: 'pointer',
                p: 1.15,
                borderRadius: 3.2,
                border: `1px solid ${isSelected ? getColorWithAlpha('#f97316', 0.34) : getColorWithAlpha(chatWidgetDesign.border, 0.72)}`,
                background: isSelected
                  ? 'linear-gradient(180deg, rgba(249,115,22,0.1) 0%, rgba(255,255,255,0.98) 100%)'
                  : 'rgba(255,255,255,0.94)',
                boxShadow: isSelected ? '0 18px 34px rgba(249,115,22,0.12)' : '0 8px 20px rgba(15,23,42,0.04)',
                transition: 'all 140ms ease',
                '&:hover': {
                  borderColor: getColorWithAlpha('#f97316', 0.3),
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', alignItems: 'start', gap: 0.9 }}>
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
                        border: '2px solid white',
                      }}
                    />
                  }
                >
                  <Avatar src={chat.avatar} sx={{ width: 38, height: 38, fontSize: '0.9rem' }}>
                    {chat.name.charAt(0)}
                  </Avatar>
                </Badge>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                    {chat.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }} noWrap>
                    {chat.lastMessage}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', justifyItems: 'end', gap: 0.45 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(chat.timestamp)}
                  </Typography>
                  {chat.unreadCount > 0 ? (
                    <Chip
                      size="small"
                      label={chat.unreadCount}
                      sx={{
                        height: 20,
                        minWidth: 24,
                        bgcolor: '#f97316',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: '0.66rem',
                      }}
                    />
                  ) : (
                    <CheckCircle sx={{ fontSize: 14, color: '#10b981' }} />
                  )}
                </Box>
              </Box>
            </Box>
          );
        }) : (
          <Box sx={{ p: 2.2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
              Ingen samtaler funnet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Prøv et annet søk eller velg en annen mappe.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );

  const internalConversationPanel = (
    <Paper
      elevation={0}
      sx={{
        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
        borderRadius: 4,
        border: `1px solid ${workspaceCardBorder}`,
        bgcolor: workspaceSurface,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: '0 18px 38px rgba(15,23,42,0.07)',
      }}
    >
      {selectedChatPreview ? (
        <>
          <Box sx={{ px: 1.7, py: 1.35, borderBottom: `1px solid ${workspaceCardBorder}`, background: workspaceMutedSurface }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) auto', gap: 1, alignItems: 'center' }}>
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                badgeContent={
                  <Box
                    sx={{
                      width: 11,
                      height: 11,
                      borderRadius: '50%',
                      bgcolor: getStatusColor(selectedChatPreview.status),
                      border: '2px solid white',
                    }}
                  />
                }
              >
                <Avatar src={selectedChatPreview.avatar} sx={{ width: 42, height: 42 }}>
                  {selectedChatPreview.name.charAt(0)}
                </Avatar>
              </Badge>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                  {selectedChatPreview.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {selectedConversationStatusLabel}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <IconButton
                  size="small"
                  sx={{ color: '#111827', border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.92)}` }}
                  onClick={() => handleInternalAttachmentAction('email')}
                  aria-label="Send e-post"
                >
                  <Email sx={{ fontSize: 18 }} />
                </IconButton>
                <Button
                  size="small"
                  variant="contained"
                  disabled={meetingCreationPending}
                  onClick={() => handleStartConversationCall('video')}
                  startIcon={<VideoCall sx={{ fontSize: 16 }} />}
                  sx={{
                    borderRadius: 999,
                    textTransform: 'none',
                    px: 1.35,
                    bgcolor: '#0f172a',
                    boxShadow: 'none',
                    '&:hover': { bgcolor: '#111827', boxShadow: 'none' },
                  }}
                >
                  {isCompactHeaderWorkspace ? 'Møte' : 'Start møte'}
                </Button>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1 }}>
              <Chip
                size="small"
                label={selectedChatPreview.type === 'team' ? 'Teamchat' : 'Direktemelding'}
                sx={{ bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 700 }}
              />
              <Chip
                size="small"
                label={selectedChatPreview.unreadCount > 0 ? `${selectedChatPreview.unreadCount} uleste` : 'Oppdatert'}
                sx={{ bgcolor: 'rgba(249,115,22,0.1)', color: '#ea580c', fontWeight: 700 }}
              />
              <Chip
                size="small"
                clickable
                onClick={handleToggleInternalContactPanel}
                label={internalContactPanelOpen ? 'CRM-system åpnet' : 'CRM-system'}
                sx={{
                  bgcolor: internalContactPanelOpen ? getColorWithAlpha('#16a34a', 0.12) : 'rgba(15,23,42,0.06)',
                  color: internalContactPanelOpen ? '#166534' : '#334155',
                  fontWeight: 700,
                }}
              />
              <Chip
                size="small"
                label={selectedConversationLeadLabel}
                sx={{
                  bgcolor: getColorWithAlpha(selectedConversationLeadColor, 0.12),
                  color: selectedConversationLeadColor,
                  fontWeight: 700,
                }}
              />
              {commercialWorkflow?.label && (
                <Chip
                  size="small"
                  label={commercialWorkflow.label}
                  sx={{
                    bgcolor: getColorWithAlpha(commercialStageTone, 0.12),
                    color: commercialStageTone,
                    fontWeight: 700,
                  }}
                />
              )}
              {selectedConversationContext.map((context) => (
                <Chip
                  key={context.label}
                  size="small"
                  icon={context.icon}
                  label={context.label}
                  sx={{ bgcolor: 'rgba(255,255,255,0.04)' }}
                />
              ))}
            </Box>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: 1.1,
              p: 1.2,
              bgcolor: 'rgba(248,250,252,0.82)',
            }}
          >
            <Box sx={{ minHeight: 0, display: 'grid', gridTemplateRows: `${selectedConversationCommercialStrip ? 'auto ' : ''}minmax(0, 1fr) auto`, gap: 1.1 }}>
              {selectedConversationCommercialStrip}
              <Box
                ref={internalMessagesContainerRef}
                sx={{
                  minHeight: 0,
                  overflow: 'auto',
                  px: 1.8,
                  py: 1.55,
                  display: 'grid',
                  gap: 1.2,
                  borderRadius: 3.4,
                  border: `1px solid ${workspaceCardBorder}`,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  backgroundImage: 'radial-gradient(rgba(251,146,60,0.12) 0.8px, transparent 0.8px)',
                  backgroundSize: '22px 22px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
                }}
              >
                {internalMessagesLoading && activeConversationMessages.length === 0 ? (
                  <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      Henter meldinger...
                    </Typography>
                  </Box>
                ) : activeConversationMessages.length > 0 ? activeConversationMessages.map((message) => {
                  const ownMessage = isOwnConversationMessage(message.senderId);
                  const senderName = getConversationSenderName(message);

                  return (
                    <Box
                      key={message.id}
                      sx={{
                        display: 'flex',
                        justifyContent: ownMessage ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: ownMessage ? 'minmax(0, 1fr) 34px' : '34px minmax(0, 1fr)',
                          gap: 0.8,
                          alignItems: 'end',
                          maxWidth: '82%',
                        }}
                      >
                        {!ownMessage && (
                          <Avatar sx={{ width: 34, height: 34, bgcolor: getColorWithAlpha('#0f172a', 0.08), color: '#334155', fontSize: '0.78rem', fontWeight: 700 }}>
                            {senderName.charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: ownMessage ? 'flex-end' : 'flex-start', gap: 0.6, mb: 0.35 }}>
                            {!ownMessage && (
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#374151' }}>
                                {senderName}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {formatDetailedDate(message.timestamp)} {formatDetailedTime(message.timestamp)}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              px: 1.15,
                              py: 0.95,
                              borderRadius: ownMessage ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
                              bgcolor: ownMessage ? '#f97316' : 'rgba(255,255,255,0.98)',
                              color: ownMessage ? 'white' : '#111827',
                              border: ownMessage ? 'none' : `1px solid ${getColorWithAlpha(chatWidgetDesign.border, 0.8)}`,
                              boxShadow: ownMessage
                                ? '0 12px 24px rgba(249,115,22,0.2)'
                                : '0 10px 22px rgba(15,23,42,0.06)',
                            }}
                          >
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                              {message.content}
                            </Typography>
                            {renderConversationMessageAttachments(message.attachments, ownMessage)}
                          </Box>
                        </Box>
                        {ownMessage && (
                          <Avatar sx={{ width: 34, height: 34, bgcolor: getProfessionColor(), color: 'white', fontSize: '0.78rem', fontWeight: 700 }}>
                            {(userEmail || 'Du').charAt(0).toUpperCase()}
                          </Avatar>
                        )}
                      </Box>
                    </Box>
                  );
                }) : (
                  <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center', maxWidth: 340 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
                      Samtalen er klar
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      Ingen meldinger ennå. Start dialogen fra composer-feltet under.
                    </Typography>
                  </Box>
                )}

                {typingUsers.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Box
                      sx={{
                        px: 1,
                        py: 0.8,
                        borderRadius: '18px 18px 18px 6px',
                        bgcolor: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${getColorWithAlpha(chatWidgetDesign.border, 0.8)}`,
                        boxShadow: '0 10px 22px rgba(15,23,42,0.06)',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                        {typingUsers.join(', ')} skriver...
                      </Typography>
                    </Box>
                  </Box>
                )}

                <div ref={messagesEndRef} />
              </Box>

              <Box sx={{ px: 1.6, py: 1.25, borderRadius: 3.2, border: `1px solid ${workspaceCardBorder}`, bgcolor: 'rgba(255,255,255,0.04)', boxShadow: '0 16px 30px rgba(15,23,42,0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.9 }}>
                  <Box>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#ea580c' }}>
                      Svarer i {selectedChatPreview.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      CRM-panelet samler kontaktinfo, handlinger og maler uten å presse samtalen sammen.
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45 }}>
                    <Tooltip title="Hurtigsvar">
                      <IconButton
                        size="small"
                        onClick={() => setShowInternalQuickTemplates((current) => !current)}
                        sx={{
                          color: showInternalQuickTemplates ? '#ea580c' : '#6b7280',
                          border: `1px solid ${getColorWithAlpha('#f97316', showInternalQuickTemplates ? 0.28 : 0.14)}`,
                        }}
                      >
                        <Speed sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Legg til mention">
                      <IconButton
                        size="small"
                        onClick={handleGoogleMention}
                        sx={{ color: '#6b7280', border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.8)}` }}
                      >
                        <AlternateEmail sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Collapse in={showInternalQuickTemplates}>
                  <Box sx={{ mb: 0.9 }}>
                    <QuickMessageTemplates
                      onSelectTemplate={(msg) => setMessageInput(msg)}
                      profession={profession}
                      storageKey={`quick-msg-universal-${user?.id || 'anon'}`}
                      compact
                      overlayZIndexBase={workspaceOverlayZIndex.dialog}
                    />
                  </Box>
                </Collapse>

                <Box
                  sx={{
                    border: `1px solid ${getColorWithAlpha(chatWidgetDesign.border, 0.78)}`,
                    borderRadius: 3.2,
                    bgcolor: 'rgba(248,250,252,0.96)',
                    boxShadow: '0 16px 30px rgba(15,23,42,0.06)',
                    p: 0.9,
                  }}
                >
                  {renderPendingGoogleDriveAttachments()}
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    maxRows={6}
                    variant="standard"
                    placeholder={`Skriv til ${selectedChatPreview.name}...`}
                    value={messageInput}
                    onChange={(e) => {
                      setMessageInput(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleQuickReply();
                      }
                    }}
                    sx={{
                      '& .MuiInputBase-root': {
                        alignItems: 'flex-start',
                        px: 0.25,
                      },
                      '& .MuiInputBase-input': {
                        fontSize: '0.95rem',
                        lineHeight: 1.6,
                      }
                    }}
                    InputProps={{ disableUnderline: true }}
                  />

                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.9, flexWrap: 'wrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, flexWrap: 'wrap' }}>
                      <Tooltip title="Legg ved fil">
                        <IconButton
                          size="small"
                          sx={{ color: '#64748b' }}
                          onClick={() => handleInternalAttachmentAction('attachment')}
                          aria-label="Legg ved fil"
                        >
                          <AttachFile sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Legg ved bilde">
                        <IconButton
                          size="small"
                          sx={{ color: '#64748b' }}
                          onClick={() => handleInternalAttachmentAction('image')}
                          aria-label="Legg ved bilde"
                        >
                          <ImageOutlined sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Opprett tilbud">
                        <IconButton size="small" sx={{ color: '#64748b' }} onClick={handleOpenQuoteModal}>
                          <InsertDriveFile sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Emoji">
                        <IconButton
                          size="small"
                          sx={{ color: '#64748b' }}
                          onClick={handleOpenEmojiPicker}
                          aria-label="Sett inn emoji"
                        >
                          <SentimentSatisfiedAlt sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
                        Enter sender. Shift + Enter lager ny linje.
                      </Typography>
                      <Button
                        variant="contained"
                        endIcon={<Send />}
                        onClick={handleQuickReply}
                        disabled={(!messageInput.trim() && pendingGoogleDriveAttachments.length === 0) || isQuickReplyPending}
                        sx={{
                          minWidth: 140,
                          borderRadius: 999,
                          px: 2.2,
                          py: 1,
                          bgcolor: '#f97316',
                          boxShadow: '0 12px 26px rgba(249,115,22,0.24)',
                          '&:hover': { bgcolor: '#ea580c' },
                        }}
                      >
                        Send melding
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>

          </Box>
        </>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#111827' }}>
              Velg en samtale
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Samtalen åpnes her med meldinger og composer samlet i samme flate.
            </Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );

  const mobileListCardSx = {
    borderRadius: 3.2,
    border: `1px solid ${getColorWithAlpha('#e2e8f0', 0.92)}`,
    bgcolor: 'rgba(255,255,255,0.04)',
    boxShadow: '0 12px 24px rgba(15,23,42,0.06)',
  } as const;

  const mobileInternalListView = (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(20,16,11,0.6)' }}>
      <Box sx={{ px: 2, pt: 2.2, pb: 1.4, bgcolor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(226,232,240,0.9)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', color: '#f97316', fontWeight: 800, letterSpacing: '0.12em', lineHeight: 1 }}>
              CreatorHub
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mt: 0.35 }}>
              Chats
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <IconButton
              size="small"
              onClick={() => internalSearchInputRef.current?.focus()}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Search sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => setMobileTabMenuAnchor(e.currentTarget)}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <MoreVert sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => { onClose?.(); setIsExpanded(false); setIsOpen(false); }}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.7, mt: 1.4, overflowX: 'auto', pb: 0.2 }}>
          {internalInboxSections.slice(0, 4).map((section) => {
            const selected = internalInboxSection === section.id;

            return (
              <Chip
                key={`mobile-section-${section.id}`}
                label={`${section.label}${section.count > 0 ? ` · ${section.count}` : ''}`}
                onClick={() => setInternalInboxSection(section.id)}
                sx={{
                  height: 30,
                  borderRadius: 999,
                  fontWeight: 700,
                  color: selected ? 'white' : '#64748b',
                  bgcolor: selected ? '#f97316' : 'rgba(241,245,249,0.98)',
                  border: selected ? '1px solid #f97316' : '1px solid rgba(226,232,240,0.92)',
                  boxShadow: selected ? '0 10px 18px rgba(249,115,22,0.22)' : 'none',
                }}
              />
            );
          })}
        </Box>

        <TextField
          fullWidth
          size="small"
          inputRef={internalSearchInputRef}
          value={internalChatFilter}
          onChange={(event) => setInternalChatFilter(event.target.value)}
          placeholder="Søk i samtaler"
          sx={{
            mt: 1.3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              bgcolor: 'rgba(248,250,252,0.98)',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.35, py: 1.2, display: 'grid', gap: 0.95 }}>
        {filteredChatPreviews.length > 0 ? filteredChatPreviews.map((chat) => (
          <Box
            key={`mobile-chat-${chat.id}`}
            onClick={() => handleSelectInternalChat(chat.id)}
            sx={{
              ...mobileListCardSx,
              display: 'grid',
              gridTemplateColumns: '48px minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 1,
              px: 1.1,
              py: 1,
              cursor: 'pointer',
            }}
          >
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <Box
                  sx={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    bgcolor: getStatusColor(chat.status),
                    border: '2px solid white',
                  }}
                />
              }
            >
              <Avatar src={chat.avatar} sx={{ width: 44, height: 44, fontWeight: 700 }}>
                {chat.name.charAt(0)}
              </Avatar>
            </Badge>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                {chat.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }} noWrap>
                {chat.lastMessage}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', justifyItems: 'end', gap: 0.45 }}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {formatTime(chat.timestamp)}
              </Typography>
              {chat.unreadCount > 0 ? (
                <Chip
                  size="small"
                  label={chat.unreadCount}
                  sx={{
                    height: 20,
                    minWidth: 24,
                    bgcolor: '#f97316',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.66rem',
                  }}
                />
              ) : (
                <CheckCircle sx={{ fontSize: 14, color: '#10b981' }} />
              )}
            </Box>
          </Box>
        )) : (
          <Box sx={{ ...mobileListCardSx, p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Ingen samtaler funnet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Prøv et annet søk eller velg en annen mappe.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  const mobileInternalDetailView = selectedChatPreview ? (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,0.04)' }}>
      <Box
        sx={{
          px: 1.2,
          pt: 1.15,
          pb: 1.4,
          bgcolor: '#232323',
          color: 'white',
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          boxShadow: '0 18px 38px rgba(15,23,42,0.22)',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 44px minmax(0,1fr) auto', gap: 0.9, alignItems: 'center' }}>
          <IconButton size="small" onClick={() => setMobileConversationMode('list')} sx={{ color: 'white' }}>
            <Reply sx={{ fontSize: 18 }} />
          </IconButton>
          <Avatar src={selectedChatPreview.avatar} sx={{ width: 40, height: 40 }}>
            {selectedChatPreview.name.charAt(0)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
              {selectedChatPreview.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }} noWrap>
              {selectedConversationStatusLabel}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <IconButton
              size="small"
              sx={{ color: 'white' }}
              onClick={handleToggleInternalContactPanel}
              aria-label={internalContactPanelOpen ? 'Skjul CRM-system' : 'Vis CRM-system'}
            >
              <BadgeIcon sx={{ fontSize: 17 }} />
            </IconButton>
            <IconButton
              size="small"
              sx={{ color: 'white' }}
              disabled={meetingCreationPending}
              onClick={() => handleStartConversationCall('call')}
              aria-label="Start samtale"
            >
              <Phone sx={{ fontSize: 17 }} />
            </IconButton>
            <IconButton
              size="small"
              sx={{ color: 'white' }}
              disabled={meetingCreationPending}
              onClick={() => handleStartConversationCall('video')}
              aria-label="Start videosamtale"
            >
              <VideoCall sx={{ fontSize: 17 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Box
        ref={internalMessagesContainerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 1.1,
          py: 1.2,
          display: 'grid',
          gap: 1,
          backgroundColor: 'rgba(255,255,255,0.04)',
          backgroundImage: 'radial-gradient(rgba(251,146,60,0.08) 0.8px, transparent 0.8px)',
          backgroundSize: '18px 18px',
        }}
      >
        {selectedConversationCommercialStrip && (
          <Box sx={{ px: 0.15 }}>
            {selectedConversationCommercialStrip}
          </Box>
        )}
        {activeConversationMessages.length > 0 ? activeConversationMessages.map((message) => {
          const ownMessage = isOwnConversationMessage(message.senderId);
          const senderName = getConversationSenderName(message);

          return (
            <Box key={`mobile-message-${message.id}`} sx={{ display: 'flex', justifyContent: ownMessage ? 'flex-end' : 'flex-start' }}>
              <Box sx={{ maxWidth: '82%', minWidth: 0 }}>
                {!ownMessage && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontWeight: 700, mb: 0.35, px: 0.4 }}>
                    {senderName}
                  </Typography>
                )}
                <Box
                  sx={{
                    px: 1.15,
                    py: 0.95,
                    borderRadius: ownMessage ? '20px 20px 8px 20px' : '20px 20px 20px 8px',
                    bgcolor: ownMessage ? '#f97316' : '#ffffff',
                    color: ownMessage ? 'white' : '#111827',
                    boxShadow: ownMessage
                      ? '0 14px 28px rgba(249,115,22,0.2)'
                      : '0 10px 22px rgba(15,23,42,0.08)',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                    {message.content}
                  </Typography>
                  {renderConversationMessageAttachments(message.attachments, ownMessage)}
                </Box>
              </Box>
            </Box>
          );
        }) : (
          <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center', maxWidth: 260 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Samtalen er klar
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Ingen meldinger ennå. Start dialogen fra feltet under.
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 1.05, py: 1.05, bgcolor: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(226,232,240,0.9)' }}>
        {renderPendingGoogleDriveAttachments({ compact: true })}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) auto',
            alignItems: 'center',
            gap: 0.8,
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={`Message ${selectedChatPreview.name}...`}
            value={messageInput}
            onChange={(e) => {
              setMessageInput(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleQuickReply();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                bgcolor: 'rgba(248,250,252,0.96)',
                pr: 0.6,
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton size="small" sx={{ color: '#94a3b8' }} onClick={() => handleInternalAttachmentAction('attachment')} aria-label="Legg ved fil">
                    <Add sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <IconButton size="small" sx={{ color: '#94a3b8' }} onClick={() => handleInternalAttachmentAction('image')} aria-label="Legg ved bilde">
                      <ImageOutlined sx={{ fontSize: 17 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{ color: '#94a3b8' }}
                      onClick={handleOpenEmojiPicker}
                      aria-label="Sett inn emoji"
                    >
                      <SentimentSatisfiedAlt sx={{ fontSize: 17 }} />
                    </IconButton>
                  </Box>
                </InputAdornment>
              ),
            }}
          />
          <IconButton
            onClick={handleQuickReply}
            disabled={(!messageInput.trim() && pendingGoogleDriveAttachments.length === 0) || isQuickReplyPending}
            sx={{
              width: 44,
              height: 44,
              bgcolor: '#f97316',
              color: 'white',
              boxShadow: '0 14px 28px rgba(249,115,22,0.22)',
              '&:hover': { bgcolor: '#ea580c' },
              '&.Mui-disabled': { bgcolor: 'rgba(203,213,225,0.9)', color: 'white' },
            }}
          >
            <Send sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  ) : null;

  const emailCrmRailPanel = selectedEmailThreadPreview ? (
    <Box sx={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
      <Slide in={shouldShowEmailCrmRailPanel} direction="right" mountOnEnter unmountOnExit appear={false}>
        <Paper
          elevation={0}
          sx={{
            ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
            borderRadius: 4,
            border: `1px solid ${workspaceCardBorder}`,
            bgcolor: workspaceSurface,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            boxShadow: workspaceCardShadow,
          }}
        >
          <Box
            sx={{
              px: 1.35,
              py: 1.15,
              borderBottom: `1px solid ${workspaceCardBorder}`,
              background: workspaceMutedSurface,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" sx={{ display: 'block', color: '#2563eb', fontWeight: 800, letterSpacing: '0.08em', lineHeight: 1 }}>
                E-POST CRM
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827', mt: 0.3 }}>
                Kontakt og oppfølging
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Skyves ut fra venstrerailen for valgt e-posttråd.
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleToggleEmailContactPanel}
              aria-label="Lukk e-post CRM"
              sx={{
                color: '#475569',
                border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.9)}`,
              }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.1, bgcolor: 'rgba(20,16,11,0.6)' }}>
            {emailActionPanelContent}
          </Box>
        </Paper>
      </Slide>
    </Box>
  ) : null;

  const emailInboxNavigation = (
    <Paper
      elevation={0}
      sx={{
        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
        borderRadius: 4,
        border: `1px solid ${workspaceCardBorder}`,
        bgcolor: workspaceSurface,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: workspaceCardShadow,
      }}
    >
      <Box sx={{ px: 1.5, py: 1.45, borderBottom: `1px solid ${workspaceCardBorder}`, background: workspaceMutedSurface }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', fontWeight: 800, color: '#2563eb', letterSpacing: '0.1em', lineHeight: 1 }}>
              Inbox
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827', mt: 0.35 }}>
              E-postmapper
            </Typography>
          </Box>
          <IconButton size="small" sx={{ color: '#111827' }} onClick={() => emailSearchInputRef.current?.focus()} aria-label="Søk i e-post">
            <Search sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ px: 1, py: 1.05, display: 'grid', gap: 0.45 }}>
        {emailInboxSections.map((section) => {
          const selected = emailInboxSection === section.id;
          return (
            <Box
              key={section.id}
              onClick={() => setEmailInboxSection(section.id)}
              sx={{
                display: 'grid',
                gridTemplateColumns: '18px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 1,
                px: 1.05,
                py: 0.92,
                borderRadius: 2.8,
                cursor: 'pointer',
                color: selected ? '#2563eb' : '#374151',
                bgcolor: selected ? 'rgba(37,99,235,0.1)' : 'transparent',
                borderLeft: selected ? '2px solid #2563eb' : '2px solid transparent',
                transition: 'all 140ms ease',
                '&:hover': {
                  bgcolor: selected ? 'rgba(37,99,235,0.14)' : 'rgba(15,23,42,0.04)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {section.id === 'needs_reply' ? <Reply sx={{ fontSize: 16 }} /> :
                  section.id === 'unread' ? <Notifications sx={{ fontSize: 16 }} /> :
                  section.id === 'attachments' ? <AttachFile sx={{ fontSize: 16 }} /> :
                  section.id === 'sent' ? <Send sx={{ fontSize: 16 }} /> :
                  <Email sx={{ fontSize: 16 }} />}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: selected ? 800 : 600 }}>
                {section.label}
              </Typography>
              <Typography variant="caption" color={selected ? '#2563eb' : 'text.secondary'} sx={{ fontWeight: 700 }}>
                {section.count}
              </Typography>
            </Box>
          );
        })}
      </Box>

      <Divider sx={{ borderColor: chatWidgetDesign.border }} />

      <Box sx={{ px: 1.4, py: 1.1, minHeight: 0, overflow: 'auto' }}>
        <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: '#6b7280', mb: 1 }}>
          Status
        </Typography>
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          <Box sx={{ p: 0.95, borderRadius: 2.3, bgcolor: 'rgba(248,250,252,0.94)', border: `1px solid ${workspaceCardBorder}` }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
              {isGmailConnected ? 'Gmail aktiv' : gmailNeedsReconnect ? 'Krever reconnect' : 'Ikke koblet'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {gmailNeedsReconnect
                ? 'Forny Google-SSO for å hente tråder igjen.'
                : gmailConnectionErrorMessage || 'Gmail-tråder synkroniseres inn i inboxen via samme Google-økt som resten av arbeidsflaten.'}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: 'auto', px: 1.4, py: 1.2, borderTop: `1px solid ${chatWidgetDesign.border}` }}>
        <Button
          fullWidth
          variant="outlined"
          startIcon={gmailNeedsReconnect ? <Google sx={{ fontSize: 15 }} /> : <OpenInNew sx={{ fontSize: 15 }} />}
          onClick={gmailNeedsReconnect ? handleGoogleChatConnect : handleOpenEmailThread}
          disabled={gmailNeedsReconnect ? googleWorkspaceOauthUiBusy : (!selectedEmailThreadPreview?.threadUrl && !gmailSelectedThread?.threadUrl)}
          sx={{
            borderColor: getColorWithAlpha('#2563eb', 0.28),
            color: '#2563eb',
            borderRadius: 2.4,
            textTransform: 'none',
            fontWeight: 700,
          }}
        >
          {gmailNeedsReconnect ? 'Forny Google-SSO' : 'Åpne i Gmail'}
        </Button>
      </Box>
    </Paper>
  );

  const emailConversationList = (
    <Paper
      elevation={0}
      sx={{
        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
        borderRadius: 4,
        border: `1px solid ${workspaceCardBorder}`,
        bgcolor: workspaceSurface,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: workspaceCardShadow,
      }}
    >
      <Box sx={{ px: 1.5, py: 1.35, borderBottom: `1px solid ${workspaceCardBorder}`, background: workspaceMutedSurface }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', fontWeight: 800, color: '#64748b', letterSpacing: '0.08em', lineHeight: 1 }}>
              Tråder
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827', mt: 0.35 }}>
              {activeEmailInboxSection.label}
            </Typography>
          </Box>
          <Chip size="small" label={`${visibleGmailThreads.length}`} sx={{ height: 24, bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 700 }} />
        </Box>
        <TextField
          fullWidth
          size="small"
          inputRef={emailSearchInputRef}
          value={emailThreadFilter}
          onChange={(event) => setEmailThreadFilter(event.target.value)}
          placeholder="Søk i e-post"
          sx={{
            mt: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
              bgcolor: 'rgba(248,250,252,0.96)',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 0.9, display: 'grid', gap: 0.75 }}>
        {!isGmailConnected ? (
          <Box sx={{ p: 2.2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
              Aktiver Google-SSO først
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Når Google-økten er aktiv, dukker Gmail-trådene opp her automatisk.
            </Typography>
          </Box>
        ) : visibleGmailThreads.length > 0 ? visibleGmailThreads.map((thread) => {
          const isSelected = selectedEmailThread === thread.id;
          const needsReply = emailThreadNeedsReply(thread);

          return (
            <Box
              key={thread.id}
              onClick={() => setSelectedEmailThread(thread.id)}
              sx={{
                cursor: 'pointer',
                p: 1.15,
                borderRadius: 3.2,
                border: `1px solid ${isSelected ? getColorWithAlpha('#2563eb', 0.34) : getColorWithAlpha(chatWidgetDesign.border, 0.72)}`,
                background: isSelected
                  ? 'linear-gradient(180deg, rgba(37,99,235,0.1) 0%, rgba(255,255,255,0.98) 100%)'
                  : 'rgba(255,255,255,0.94)',
                boxShadow: isSelected ? '0 18px 34px rgba(37,99,235,0.12)' : '0 8px 20px rgba(15,23,42,0.04)',
                transition: 'all 140ms ease',
                '&:hover': {
                  borderColor: getColorWithAlpha('#2563eb', 0.3),
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) auto', alignItems: 'start', gap: 0.9 }}>
                <Avatar sx={{ width: 38, height: 38, fontSize: '0.9rem', bgcolor: needsReply ? 'rgba(249,115,22,0.12)' : 'rgba(37,99,235,0.12)', color: needsReply ? '#c2410c' : '#1d4ed8', fontWeight: 800 }}>
                  {(thread.counterpartName || thread.counterpartEmail || 'E').charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                    {thread.counterpartName || thread.counterpartEmail || 'Ukjent kontakt'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.25, fontWeight: 700, color: '#0f172a' }} noWrap>
                    {thread.subject || '(uten emne)'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.45 }} noWrap>
                    {thread.snippet || 'Ingen forhåndsvisning tilgjengelig'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', justifyItems: 'end', gap: 0.45 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(thread.timestamp)}
                  </Typography>
                  {thread.unreadCount > 0 ? (
                    <Chip size="small" label={thread.unreadCount} sx={{ height: 20, minWidth: 24, bgcolor: '#2563eb', color: 'white', fontWeight: 800, fontSize: '0.66rem' }} />
                  ) : (
                    <CheckCircle sx={{ fontSize: 14, color: '#10b981' }} />
                  )}
                </Box>
              </Box>
            </Box>
          );
        }) : (
          <Box sx={{ p: 2.2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
              Ingen e-posttråder funnet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Prøv et annet søk eller velg en annen mappe.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );

  const emailConversationPanel = (
    <Paper
      elevation={0}
      sx={{
        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
        borderRadius: 4,
        border: `1px solid ${workspaceCardBorder}`,
        bgcolor: workspaceSurface,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        boxShadow: '0 18px 38px rgba(15,23,42,0.07)',
      }}
    >
      {!isGmailConnected ? (
        <Box sx={{ flex: 1, minHeight: 0, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1.2, background: 'linear-gradient(180deg, rgba(248,250,252,0.88) 0%, rgba(255,255,255,0.98) 100%)' }}>
          <Email sx={{ fontSize: 48, color: '#2563eb' }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {gmailNeedsReconnect ? 'Forny Google-SSO for å åpne e-postkanalen' : 'Bruk Google-SSO for å åpne e-postkanalen'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            {gmailConnectionErrorMessage || 'Gmail bruker samme Google-økt som Drive, Meet og Chat. Følg Google-statusen i brukerfeltet over, så dukker nye forespørsler opp her automatisk.'}
          </Typography>
        </Box>
      ) : !selectedEmailThreadPreview ? (
        <Box sx={{ flex: 1, minHeight: 0, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1, background: 'linear-gradient(180deg, rgba(248,250,252,0.88) 0%, rgba(255,255,255,0.98) 100%)' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Velg en e-posttråd for å starte flyten
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            Her åpnes tråden med meldingshistorikk, handlinger og svarfelt samlet i én arbeidsflate.
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ px: 1.7, py: 1.35, borderBottom: `1px solid ${workspaceCardBorder}`, background: workspaceMutedSurface }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) auto', gap: 1, alignItems: 'center' }}>
              <Avatar sx={{ width: 42, height: 42, bgcolor: getColorWithAlpha(selectedEmailReplyTone, 0.12), color: selectedEmailReplyTone, fontWeight: 800 }}>
                {(selectedEmailCounterpartLabel || 'E').charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                  {selectedEmailCounterpartLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {selectedEmailActivityLabel}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.55, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <IconButton size="small" sx={{ color: '#111827', border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.92)}` }} onClick={() => openGoogleDriveAttachmentPicker()} aria-label="Legg ved fra Drive">
                  <AttachFile sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" sx={{ color: '#111827', border: `1px solid ${getColorWithAlpha('#cbd5e1', 0.92)}` }} onClick={handleOpenEmailThread} aria-label="Åpne tråden">
                  <Visibility sx={{ fontSize: 18 }} />
                </IconButton>
                <Button size="small" variant="contained" disabled={meetingCreationPending} onClick={handleStartEmailMeeting} startIcon={<VideoCall sx={{ fontSize: 16 }} />} sx={{ borderRadius: 999, textTransform: 'none', px: 1.35, bgcolor: '#0f172a', boxShadow: 'none', '&:hover': { bgcolor: '#111827', boxShadow: 'none' } }}>
                  {isCompactHeaderWorkspace ? 'Møte' : 'Start møte'}
                </Button>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 1 }}>
              <Chip size="small" label={selectedEmailReplyState} sx={{ bgcolor: getColorWithAlpha(selectedEmailReplyTone, 0.12), color: selectedEmailReplyTone, fontWeight: 700 }} />
              <Chip size="small" label={selectedEmailThreadPreview.unreadCount > 0 ? `${selectedEmailThreadPreview.unreadCount} uleste` : 'Oppdatert'} sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 700 }} />
              <Chip
                size="small"
                clickable
                onClick={handleToggleEmailContactPanel}
                label={emailContactPanelOpen ? 'CRM-system åpnet' : 'CRM-system'}
                sx={{
                  bgcolor: emailContactPanelOpen ? getColorWithAlpha('#16a34a', 0.12) : 'rgba(15,23,42,0.06)',
                  color: emailContactPanelOpen ? '#166534' : '#334155',
                  fontWeight: 700,
                }}
              />
              {emailCommercialWorkflow?.label && (
                <Chip size="small" label={emailCommercialWorkflow.label} sx={{ bgcolor: getColorWithAlpha(emailCommercialStageTone, 0.12), color: emailCommercialStageTone, fontWeight: 700 }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.95, lineHeight: 1.55 }}>
              {selectedEmailDescriptor}
            </Typography>
          </Box>

          <Box ref={emailMessagesContainerRef} sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.5, display: 'grid', gap: 1.1, bgcolor: 'rgba(255,255,255,0.04)' }}>
            {gmailMessagesLoading && gmailThreadMessages.length === 0 ? (
              <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Henter meldinger fra Gmail...
                </Typography>
              </Box>
            ) : gmailMessagesErrorMessage ? (
              <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center', maxWidth: 420 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.4 }}>
                  Kunne ikke hente tråden
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {gmailMessagesErrorMessage}
                </Typography>
              </Box>
            ) : gmailThreadMessages.length > 0 ? (
              gmailMessagesWithDaySeparators.map(({ message, dayLabel, showDayDivider }) => {
                const ownMessage = message.direction === 'outbound';
                return (
                  <React.Fragment key={message.id}>
                    {showDayDivider && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.2 }}>
                        <Chip size="small" label={dayLabel} sx={{ height: 24, bgcolor: 'rgba(15,23,42,0.06)', color: '#475569', fontWeight: 700 }} />
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: ownMessage ? 'flex-end' : 'flex-start' }}>
                      <Box sx={{ width: 'min(100%, 860px)', display: 'grid', gridTemplateColumns: ownMessage ? 'minmax(0,1fr)' : '40px minmax(0,1fr)', gap: 0.85, alignItems: 'start' }}>
                        {!ownMessage && (
                          <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(37,99,235,0.12)', color: '#1d4ed8', fontWeight: 800, fontSize: '0.9rem', mt: 0.3 }}>
                            {(message.senderName || selectedEmailCounterpartLabel || 'E').slice(0, 1).toUpperCase()}
                          </Avatar>
                        )}
                        <Box sx={{ p: 1.35, borderRadius: 3.2, border: `1px solid ${getColorWithAlpha(ownMessage ? '#2563eb' : chatWidgetDesign.border, ownMessage ? 0.22 : 0.76)}`, bgcolor: ownMessage ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.98)', boxShadow: ownMessage ? '0 12px 24px rgba(37,99,235,0.08)' : `0 10px 24px ${getColorWithAlpha('#0f172a', 0.06)}` }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.55 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              {ownMessage ? 'Deg' : message.senderName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDetailedTime(message.timestamp)}
                            </Typography>
                          </Box>
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#475569', mb: 0.55 }}>
                            {message.subject}
                          </Typography>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7 }}>
                            {message.content || message.snippet || 'Tom e-post'}
                          </Typography>
                          {message.hasAttachments && (
                            <Chip size="small" label="Har vedlegg" sx={{ mt: 0.8, bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 700 }} />
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </React.Fragment>
                );
              })
            ) : (
              <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center', maxWidth: 360, py: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.45 }}>
                  Tråden er klar
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ingen meldinger ennå. Skriv svar i composer-feltet under.
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ p: 1.5, borderTop: `1px solid ${chatWidgetDesign.border}`, bgcolor: 'rgba(255,255,255,0.04)' }}>
            {renderPendingGoogleDriveAttachments()}
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#2563eb', mb: 0.4 }}>
              Svarer til {selectedEmailThreadPreview.counterpartName || selectedEmailThreadPreview.counterpartEmail || 'kontakt'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Svaret sendes gjennom Gmail og blir liggende i samme e-posttråd.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: isNarrowWorkspace ? 'column' : 'row', alignItems: isNarrowWorkspace ? 'stretch' : 'flex-end', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                minRows={isNarrowWorkspace ? 4 : 3}
                maxRows={8}
                placeholder={`Svar ${selectedEmailThreadPreview.counterpartName || 'på e-post'}...`}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleQuickReply();
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.75,
                    bgcolor: 'rgba(248,250,252,0.98)',
                    alignItems: 'flex-start',
                    '& fieldset': { borderColor: chatWidgetDesign.border },
                    '&:hover fieldset': { borderColor: getColorWithAlpha('#2563eb', 0.5) },
                    '&.Mui-focused fieldset': { borderColor: '#2563eb' }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, pt: 0.35 }}>
                        <IconButton size="small" sx={{ color: '#64748b' }} onClick={() => openGoogleDriveAttachmentPicker()} aria-label="Legg ved fra Google Drive">
                          <AttachFile sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                endIcon={<Send />}
                onClick={handleQuickReply}
                disabled={(!messageInput.trim() && pendingGoogleDriveAttachments.length === 0) || sendGmailReply.isPending}
                sx={{ minWidth: isNarrowWorkspace ? '100%' : 160, height: isNarrowWorkspace ? 48 : 52, borderRadius: 2.75, bgcolor: '#2563eb', boxShadow: '0 12px 26px rgba(37,99,235,0.22)', '&:hover': { bgcolor: '#1d4ed8' } }}
              >
                {sendGmailReply.isPending ? 'Sender...' : 'Send e-post'}
              </Button>
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );

  const mobileGoogleListView = (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(20,16,11,0.6)' }}>
      <Box sx={{ px: 2, pt: 2.2, pb: 1.4, bgcolor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(226,232,240,0.9)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', color: '#4285F4', fontWeight: 800, letterSpacing: '0.12em', lineHeight: 1 }}>
              Google Workspace
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mt: 0.35 }}>
              Google Chat
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <IconButton
              size="small"
              onClick={() => googleSearchInputRef.current?.focus()}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Search sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => setMobileTabMenuAnchor(e.currentTarget)}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <MoreVert sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => { onClose?.(); setIsExpanded(false); setIsOpen(false); }}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.7, mt: 1.4, overflowX: 'auto', pb: 0.2 }}>
          <Chip label={googleChatConnectionLabel} sx={{ height: 30, borderRadius: 999, fontWeight: 700, bgcolor: isGoogleChatConnected ? 'rgba(66,133,244,0.12)' : 'rgba(254,226,226,0.92)', color: isGoogleChatConnected ? '#1d4ed8' : '#b91c1c' }} />
          <Chip label={`${googleChatSpaces.length} rom`} sx={{ height: 30, borderRadius: 999, fontWeight: 700, bgcolor: 'rgba(241,245,249,0.98)', color: '#475569' }} />
        </Box>

        <TextField
          fullWidth
          size="small"
          inputRef={googleSearchInputRef}
          value={googleSpaceFilter}
          onChange={(event) => setGoogleSpaceFilter(event.target.value)}
          placeholder="Søk etter rom eller person"
          sx={{
            mt: 1.3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              bgcolor: 'rgba(248,250,252,0.98)',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.35, py: 1.2, display: 'grid', gap: 0.95 }}>
        {filteredGoogleChatSpaces.length > 0 ? filteredGoogleChatSpaces.map((space) => (
          <Box
            key={`mobile-google-space-${space.id}`}
            onClick={() => handleSelectGoogleSpace(space.id)}
            sx={{
              ...mobileListCardSx,
              display: 'grid',
              gridTemplateColumns: '48px minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 1,
              px: 1.1,
              py: 1,
              cursor: 'pointer',
            }}
          >
            <Avatar sx={{ width: 44, height: 44, bgcolor: space.spaceType === 'DIRECT_MESSAGE' ? 'rgba(14,165,233,0.12)' : 'rgba(66,133,244,0.12)', color: space.spaceType === 'DIRECT_MESSAGE' ? '#0369a1' : '#1d4ed8', fontWeight: 800 }}>
              {space.spaceType === 'DIRECT_MESSAGE' ? 'DM' : '#'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                {space.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }} noWrap>
                {space.description || 'Google Chat-rom klart for oppfølging.'}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              {space.lastActiveTime ? formatTime(space.lastActiveTime) : 'Nå'}
            </Typography>
          </Box>
        )) : (
          <Box sx={{ ...mobileListCardSx, p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Ingen Google Chat-rom
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              Koble til Google Chat eller opprett et nytt rom.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  const mobileGoogleDetailView = selectedGoogleSpacePreview ? (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,0.04)' }}>
      <Box
        sx={{
          px: 1.2,
          pt: 1.15,
          pb: 1.4,
          bgcolor: '#1f2a44',
          color: 'white',
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          boxShadow: '0 18px 38px rgba(15,23,42,0.22)',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 44px minmax(0,1fr) auto', gap: 0.9, alignItems: 'center' }}>
          <IconButton size="small" onClick={() => setMobileConversationMode('list')} sx={{ color: 'white' }}>
            <Reply sx={{ fontSize: 18 }} />
          </IconButton>
          <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(255,255,255,0.16)', color: 'white', fontWeight: 800 }}>
            {selectedGoogleSpacePreview.spaceType === 'DIRECT_MESSAGE' ? 'DM' : '#'}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
              {selectedGoogleSpacePreview.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }} noWrap>
              {selectedGoogleSpaceDescriptor}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={handleOpenGoogleSpace}
            disabled={!selectedGoogleSpacePreview.spaceUri}
            sx={{ color: 'white' }}
            aria-label="Åpne Google Chat-rom"
          >
            <OpenInNew sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>
      </Box>

      <Box
        ref={googleMessagesContainerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 1.1,
          py: 1.2,
          display: 'grid',
          gap: 1,
          backgroundColor: 'rgba(33,150,243,0.08)',
          backgroundImage: 'radial-gradient(rgba(66,133,244,0.08) 0.8px, transparent 0.8px)',
          backgroundSize: '18px 18px',
        }}
      >
        {googleChatMessages.length > 0 ? googleChatMessages.map((message) => {
          const ownMessage = [userEmail, userId].filter(Boolean).includes(message.senderId);

          return (
            <Box key={`mobile-google-message-${message.id}`} sx={{ display: 'flex', justifyContent: ownMessage ? 'flex-end' : 'flex-start' }}>
              <Box sx={{ maxWidth: '84%', minWidth: 0 }}>
                {!ownMessage && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontWeight: 700, mb: 0.35, px: 0.4 }}>
                    {message.sender?.displayName || message.sender?.name || message.senderId}
                  </Typography>
                )}
                <Box
                  sx={{
                    px: 1.15,
                    py: 0.95,
                    borderRadius: ownMessage ? '20px 20px 8px 20px' : '20px 20px 20px 8px',
                    bgcolor: ownMessage ? '#4285F4' : '#ffffff',
                    color: ownMessage ? 'white' : '#111827',
                    boxShadow: ownMessage
                      ? '0 14px 28px rgba(66,133,244,0.22)'
                      : '0 10px 22px rgba(15,23,42,0.08)',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                    {message.content || 'Tom melding'}
                  </Typography>
                  <Box sx={{ mt: 0.55, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25 }}>
                    <Typography variant="caption" sx={{ color: ownMessage ? 'rgba(255,255,255,0.76)' : '#64748b' }}>
                      {formatTime(message.timestamp)}
                    </Typography>
                    <Tooltip title="Slett melding i Google Chat">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteGoogleChatMessage(message.id)}
                          disabled={deleteGoogleChatMessage.isPending}
                          sx={{ color: ownMessage ? 'rgba(255,255,255,0.82)' : '#64748b' }}
                          aria-label="Slett Google Chat-melding"
                        >
                          <DeleteOutline sx={{ fontSize: 15 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            </Box>
          );
        }) : (
          <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center', maxWidth: 260 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Rommet er klart
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Ingen meldinger ennå. Send første svar fra feltet under.
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 1.05, py: 1.05, bgcolor: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(226,232,240,0.9)' }}>
        {renderPendingGoogleDriveAttachments({ compact: true })}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) auto',
            alignItems: 'center',
            gap: 0.8,
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={`Message ${selectedGoogleSpacePreview.name}...`}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleQuickReply();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                bgcolor: 'rgba(248,250,252,0.96)',
                pr: 0.6,
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <IconButton size="small" sx={{ color: '#94a3b8' }} onClick={() => openGoogleDriveAttachmentPicker()} aria-label="Legg ved fra Google Drive">
                      <AttachFile sx={{ fontSize: 18 }} />
                    </IconButton>
                    <IconButton size="small" sx={{ color: '#94a3b8' }} onClick={handleGoogleMention} aria-label="Nevn noen i Google Chat">
                      <AlternateEmail sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </InputAdornment>
              ),
            }}
          />
          <IconButton
            onClick={handleQuickReply}
            disabled={(!messageInput.trim() && pendingGoogleDriveAttachments.length === 0) || sendGoogleChatMessage.isPending}
            sx={{
              width: 44,
              height: 44,
              bgcolor: '#4285F4',
              color: 'white',
              boxShadow: '0 14px 28px rgba(66,133,244,0.22)',
              '&:hover': { bgcolor: '#3367D6' },
              '&.Mui-disabled': { bgcolor: 'rgba(203,213,225,0.9)', color: 'white' },
            }}
          >
            <Send sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  ) : null;

  const mobileEvendiListView = (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(20,16,11,0.6)' }}>
      <Box sx={{ px: 2, pt: 2.2, pb: 1.4, bgcolor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(226,232,240,0.9)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', color: '#E91E63', fontWeight: 800, letterSpacing: '0.12em', lineHeight: 1 }}>
              Evendi
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mt: 0.35 }}>
              Meldinger
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <IconButton
              size="small"
              onClick={() => utilitySearchInputRef.current?.focus()}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Search sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => setMobileTabMenuAnchor(e.currentTarget)}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <MoreVert sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => { onClose?.(); setIsExpanded(false); setIsOpen(false); }}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.7, mt: 1.4, overflowX: 'auto', pb: 0.2 }}>
          <Chip label={`${evendiConversations.length} samtaler`} sx={{ height: 30, borderRadius: 999, fontWeight: 700, bgcolor: 'rgba(233,30,99,0.12)', color: '#be185d' }} />
          <Chip label={`${totalEvendiUnread} uleste`} sx={{ height: 30, borderRadius: 999, fontWeight: 700, bgcolor: totalEvendiUnread > 0 ? 'rgba(249,115,22,0.12)' : 'rgba(241,245,249,0.98)', color: totalEvendiUnread > 0 ? '#c2410c' : '#475569' }} />
          {evendiVendorName ? (
            <Chip label={evendiVendorName} sx={{ height: 30, borderRadius: 999, fontWeight: 700, bgcolor: 'rgba(248,250,252,0.98)', color: '#475569' }} />
          ) : null}
        </Box>

        <TextField
          fullWidth
          size="small"
          inputRef={utilitySearchInputRef}
          value={mobileUtilityFilter}
          onChange={(event) => setMobileUtilityFilter(event.target.value)}
          placeholder="Søk etter par eller melding"
          sx={{
            mt: 1.3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              bgcolor: 'rgba(248,250,252,0.98)',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.35, py: 1.2, display: 'grid', gap: 0.95 }}>
        {evendiLoading && evendiConversations.length === 0 ? (
          <Box sx={{ ...mobileListCardSx, p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Henter Evendi-samtaler
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Vi laster inn meldinger fra evendi.no.
            </Typography>
          </Box>
        ) : filteredEvendiConversations.length > 0 ? filteredEvendiConversations.map((conversation) => (
          <Box
            key={`mobile-evendi-${conversation.id}`}
            onClick={() => { void handleSelectEvendiConversation(conversation.id); }}
            sx={{
              ...mobileListCardSx,
              display: 'grid',
              gridTemplateColumns: '48px minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: 1,
              px: 1.1,
              py: 1,
              cursor: 'pointer',
            }}
          >
            <Avatar sx={{ width: 44, height: 44, bgcolor: 'rgba(233,30,99,0.1)' }}>
              <img src="/evendi-logo.png" alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                {conversation.couple_name || 'Evendi-par'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }} noWrap>
                {conversation.last_message_sender === 'vendor' ? 'Du: ' : ''}{conversation.last_message || 'Ingen meldinger ennå'}
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', justifyItems: 'end', gap: 0.45 }}>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                {conversation.last_message_at ? formatTime(conversation.last_message_at) : 'Nå'}
              </Typography>
              {conversation.vendor_unread_count ? (
                <Chip
                  size="small"
                  label={conversation.vendor_unread_count}
                  sx={{
                    height: 20,
                    minWidth: 24,
                    bgcolor: '#E91E63',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.66rem',
                  }}
                />
              ) : (
                <CheckCircle sx={{ fontSize: 14, color: '#10b981' }} />
              )}
            </Box>
          </Box>
        )) : (
          <Box sx={{ ...mobileListCardSx, p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Ingen Evendi-samtaler ennå
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Nye meldinger fra evendi.no vil dukke opp her i samme mobilflyt.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  const mobileEvendiDetailView = selectedEvendiConversation ? (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,0.04)' }}>
      <Box
        sx={{
          px: 1.2,
          pt: 1.15,
          pb: 1.4,
          bgcolor: '#2a1f28',
          color: 'white',
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          boxShadow: '0 18px 38px rgba(15,23,42,0.22)',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 44px minmax(0,1fr) auto', gap: 0.9, alignItems: 'center' }}>
          <IconButton size="small" onClick={() => setMobileConversationMode('list')} sx={{ color: 'white' }}>
            <Reply sx={{ fontSize: 18 }} />
          </IconButton>
          <Avatar sx={{ width: 40, height: 40, bgcolor: 'rgba(255,255,255,0.14)' }}>
            <img src="/evendi-logo.png" alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
              {selectedEvendiConversation.couple_name || 'Evendi-par'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }} noWrap>
              {evendiVendorName ? `Via ${evendiVendorName}` : 'Bookingdialog i Evendi'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => window.location.assign('/evendi')} sx={{ color: 'white' }} aria-label="Åpne Evendi">
            <OpenInNew sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>
      </Box>

      <Box
        ref={evendiMessagesContainerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 1.1,
          py: 1.2,
          display: 'grid',
          gap: 1,
          backgroundColor: 'rgba(255,255,255,0.04)',
          backgroundImage: 'radial-gradient(rgba(233,30,99,0.08) 0.8px, transparent 0.8px)',
          backgroundSize: '18px 18px',
        }}
      >
        {evendiMessages.length > 0 ? evendiMessages.map((message) => {
          const ownMessage = message.sender_type === 'vendor';

          return (
            <Box key={`mobile-evendi-message-${message.id}`} sx={{ display: 'flex', justifyContent: ownMessage ? 'flex-end' : 'flex-start' }}>
              <Box sx={{ maxWidth: '84%', minWidth: 0 }}>
                {!ownMessage && (
                  <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontWeight: 700, mb: 0.35, px: 0.4 }}>
                    {selectedEvendiConversation.couple_name || 'Evendi-par'}
                  </Typography>
                )}
                <Box
                  sx={{
                    px: 1.15,
                    py: 0.95,
                    borderRadius: ownMessage ? '20px 20px 8px 20px' : '20px 20px 20px 8px',
                    bgcolor: ownMessage ? '#E91E63' : '#ffffff',
                    color: ownMessage ? 'white' : '#111827',
                    boxShadow: ownMessage
                      ? '0 14px 28px rgba(233,30,99,0.2)'
                      : '0 10px 22px rgba(15,23,42,0.08)',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                    {message.body}
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        }) : (
          <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center', maxWidth: 260 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Samtalen er klar
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Ingen meldinger ennå. Svar direkte til paret fra feltet under.
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 1.05, py: 1.05, bgcolor: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(226,232,240,0.9)' }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) auto',
            alignItems: 'center',
            gap: 0.8,
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={`Svar ${selectedEvendiConversation.couple_name || 'i Evendi'}...`}
            value={evendiReplyInput}
            onChange={(e) => setEvendiReplyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendEvendiMessage();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                bgcolor: 'rgba(248,250,252,0.96)',
                pr: 0.6,
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton size="small" sx={{ color: '#94a3b8' }} onClick={handleInsertEvendiQuickReply} aria-label="Sett inn hurtigsvar">
                    <Add sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <IconButton
            onClick={sendEvendiMessage}
            disabled={!evendiReplyInput.trim() || evendiLoading}
            sx={{
              width: 44,
              height: 44,
              bgcolor: '#E91E63',
              color: 'white',
              boxShadow: '0 14px 28px rgba(233,30,99,0.22)',
              '&:hover': { bgcolor: '#C2185B' },
              '&.Mui-disabled': { bgcolor: 'rgba(203,213,225,0.9)', color: 'white' },
            }}
          >
            <Send sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  ) : null;

  const mobileEmailListView = (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(33,150,243,0.08)' }}>
      <Box sx={{ px: 2, pt: 2.1, pb: 1.5, bgcolor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(226,232,240,0.9)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', color: '#2563eb', fontWeight: 800, letterSpacing: '0.12em', lineHeight: 1 }}>
              CreatorHub Inbox
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mt: 0.35 }}>
              E-post
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45, maxWidth: 280, lineHeight: 1.5 }}>
              Nye forespørsler, oppfølging og svar i én samlet arbeidsflyt.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <IconButton
              size="small"
              onClick={() => emailSearchInputRef.current?.focus()}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Search sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => setMobileTabMenuAnchor(e.currentTarget)}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <MoreVert sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => { onClose?.(); setIsExpanded(false); setIsOpen(false); }}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.75, mt: 1.45 }}>
          {[
            { label: 'Klar for svar', value: gmailNeedsReplyCount, tone: '#ea580c', bg: 'rgba(249,115,22,0.12)' },
            { label: 'Uleste', value: gmailUnreadThreadCount, tone: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
            { label: 'Vedlegg', value: gmailThreadsWithAttachmentsCount, tone: '#0f766e', bg: 'rgba(15,118,110,0.12)' },
          ].map((metric) => (
            <Box
              key={`mobile-email-metric-${metric.label}`}
              sx={{
                p: 1,
                borderRadius: 2.5,
                border: '1px solid rgba(226,232,240,0.85)',
                bgcolor: metric.bg,
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', color: metric.tone, fontWeight: 800 }}>
                {metric.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', lineHeight: 1.1, mt: 0.2 }}>
                {metric.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <TextField
          fullWidth
          size="small"
          inputRef={emailSearchInputRef}
          value={emailThreadFilter}
          onChange={(event) => setEmailThreadFilter(event.target.value)}
          placeholder="Søk etter emne eller kontakt"
          sx={{
            mt: 1.35,
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              bgcolor: 'rgba(248,250,252,0.98)',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', gap: 0.65, mt: 1.15, overflowX: 'auto', pb: 0.2 }}>
          {emailInboxSections.map((section) => {
            const selected = emailInboxSection === section.id;
            return (
              <Button
                key={`mobile-email-section-${section.id}`}
                variant={selected ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setEmailInboxSection(section.id)}
                sx={{
                  minWidth: 'max-content',
                  borderRadius: 999,
                  px: 1.35,
                  py: 0.6,
                  borderColor: getColorWithAlpha(section.tone, selected ? 0 : 0.24),
                  color: selected ? 'white' : section.tone,
                  bgcolor: selected ? section.tone : 'rgba(255,255,255,0.92)',
                  boxShadow: selected ? `0 12px 24px ${getColorWithAlpha(section.tone, 0.22)}` : 'none',
                  '&:hover': {
                    borderColor: getColorWithAlpha(section.tone, 0.4),
                    bgcolor: selected ? section.tone : getColorWithAlpha(section.tone, 0.08),
                  },
                }}
              >
                {section.label} · {section.count}
              </Button>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.25, py: 1.25, display: 'grid', gap: 0.95 }}>
        {!isGmailConnected ? (
          <Box
            sx={{
              ...mobileListCardSx,
              p: 2.1,
              textAlign: 'center',
              border: '1px solid rgba(37,99,235,0.18)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(239,246,255,0.92) 100%)',
            }}
          >
            <Email sx={{ fontSize: 34, color: '#2563eb' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 900, mt: 0.8 }}>
              {gmailNeedsReconnect ? 'Forny Google-SSO' : 'Aktiver Google-SSO'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45, lineHeight: 1.55 }}>
              {gmailConnectionErrorMessage || 'Gmail bruker samme Google-økt som resten av plattformen. Se Google-statusen i brukerfeltet, så samles nye e-postforespørsler her i samme inboxflyt.'}
            </Typography>
          </Box>
        ) : visibleGmailThreads.length > 0 ? visibleGmailThreads.map((thread) => {
          const selected = selectedEmailThread === thread.id;
          const needsReply = emailThreadNeedsReply(thread);
          return (
            <Box
              key={`mobile-email-thread-${thread.id}`}
              onClick={() => handleSelectEmailThread(thread.id)}
              sx={{
                ...mobileListCardSx,
                cursor: 'pointer',
                p: 1.15,
                border: `1px solid ${selected ? getColorWithAlpha('#2563eb', 0.34) : 'rgba(226,232,240,0.95)'}`,
                background: selected
                  ? 'linear-gradient(180deg, rgba(239,246,255,0.98) 0%, rgba(255,255,255,0.98) 100%)'
                  : 'rgba(255,255,255,0.98)',
                boxShadow: selected ? '0 14px 26px rgba(37,99,235,0.12)' : '0 8px 18px rgba(15,23,42,0.06)',
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: '50px minmax(0,1fr) auto', gap: 1, alignItems: 'start' }}>
                <Avatar sx={{ width: 46, height: 46, bgcolor: needsReply ? 'rgba(249,115,22,0.12)' : 'rgba(37,99,235,0.12)', color: needsReply ? '#c2410c' : '#1d4ed8', fontWeight: 800 }}>
                  {(thread.counterpartName || thread.counterpartEmail || 'E').slice(0, 1).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 900, color: '#0f172a' }} noWrap>
                      {thread.counterpartName || thread.counterpartEmail || 'Ukjent avsender'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      {formatTime(thread.timestamp)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', color: '#0f172a', mt: 0.25, fontWeight: 800 }} noWrap>
                    {thread.subject}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.5 }} noWrap>
                    {thread.snippet || 'Ingen forhåndsvisning tilgjengelig'}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.45, mt: 0.8 }}>
                    {needsReply && (
                      <Chip size="small" label="Klar for svar" sx={{ height: 22, bgcolor: 'rgba(249,115,22,0.12)', color: '#c2410c', fontWeight: 800 }} />
                    )}
                    {thread.unreadCount > 0 && (
                      <Chip size="small" label={`${thread.unreadCount} uleste`} sx={{ height: 22, bgcolor: 'rgba(37,99,235,0.12)', color: '#1d4ed8', fontWeight: 800 }} />
                    )}
                    {thread.hasAttachments && (
                      <Chip size="small" label="Vedlegg" sx={{ height: 22, bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 700 }} />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'grid', justifyItems: 'end', gap: 0.4 }}>
                  <Chip size="small" label={thread.messageCount} sx={{ height: 22, minWidth: 24, bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 800 }} />
                  {thread.direction === 'outbound' ? (
                    <Reply sx={{ fontSize: 14, color: '#64748b', transform: 'scaleX(-1)' }} />
                  ) : null}
                </Box>
              </Box>
            </Box>
          );
        }) : (
          <Box sx={{ ...mobileListCardSx, p: 2.2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {gmailThreadsLoading ? 'Henter e-posttråder' : 'Ingen tråder i denne visningen'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, lineHeight: 1.55 }}>
              {gmailConnectionErrorMessage || 'Bytt filter eller vent på nye forespørsler i inboxen.'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  const mobileEmailDetailView = selectedEmailThreadPreview ? (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(33,150,243,0.08)' }}>
      <Box
        sx={{
          px: 1.2,
          pt: 1.15,
          pb: 1.2,
          bgcolor: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(226,232,240,0.92)',
          boxShadow: '0 10px 24px rgba(15,23,42,0.06)',
        }}
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 44px minmax(0,1fr) auto', gap: 0.85, alignItems: 'center' }}>
          <IconButton size="small" onClick={() => setMobileConversationMode('list')} sx={{ color: '#0f172a' }}>
            <Reply sx={{ fontSize: 18 }} />
          </IconButton>
          <Avatar sx={{ width: 40, height: 40, bgcolor: getColorWithAlpha(selectedEmailReplyTone, 0.12), color: selectedEmailReplyTone, fontWeight: 800 }}>
            {(selectedEmailThreadPreview.counterpartName || selectedEmailThreadPreview.counterpartEmail || 'E').slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 900, color: '#0f172a' }} noWrap>
              {selectedEmailThreadPreview.counterpartName || selectedEmailThreadPreview.counterpartEmail || 'E-post'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }} noWrap>
              {selectedEmailThreadPreview.subject}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={handleOpenEmailThread}
            sx={{ color: '#0f172a' }}
            aria-label="Åpne Gmail-tråd"
          >
            <OpenInNew sx={{ fontSize: 17 }} />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.55, mt: 1.05, overflowX: 'auto', pb: 0.2 }}>
          <Chip size="small" label={selectedEmailReplyState} sx={{ height: 24, bgcolor: getColorWithAlpha(selectedEmailReplyTone, 0.12), color: selectedEmailReplyTone, fontWeight: 800 }} />
          <Chip size="small" label={`${gmailSelectedMessageCount} meldinger`} sx={{ height: 24, bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 700 }} />
          {selectedEmailThreadPreview.hasAttachments && (
            <Chip size="small" label="Har vedlegg" sx={{ height: 24, bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 700 }} />
          )}
          {emailCrmCustomer && (
            <Chip size="small" label={`CRM · ${emailCrmCustomer.name}`} sx={{ height: 24, bgcolor: 'rgba(22,163,74,0.12)', color: '#166534', fontWeight: 800 }} />
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.7, mt: 1.05 }}>
          <Button size="small" variant="outlined" startIcon={<RequestQuote sx={{ fontSize: 16 }} />} onClick={handleOpenQuoteModal} sx={{ borderRadius: 999, fontWeight: 700 }}>
            Tilbud
          </Button>
          <Button size="small" variant="outlined" startIcon={<VideoCall sx={{ fontSize: 16 }} />} onClick={handleStartEmailMeeting} sx={{ borderRadius: 999, fontWeight: 700 }}>
            Møte
          </Button>
          <Button size="small" variant="outlined" startIcon={<Edit sx={{ fontSize: 16 }} />} onClick={() => { void handleCreateEmailConversationNote(); }} sx={{ borderRadius: 999, fontWeight: 700 }}>
            Notat
          </Button>
        </Box>
      </Box>

      <Box
        ref={emailMessagesContainerRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          px: 1.1,
          py: 1.2,
          display: 'grid',
          gap: 0.95,
          backgroundColor: 'rgba(33,150,243,0.08)',
        }}
      >
        {!!emailCommercialWorkflow && (
          <Box
            sx={{
              p: 1.1,
              borderRadius: 3,
              border: `1px solid ${getColorWithAlpha(emailCommercialStageTone, 0.22)}`,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
            }}
          >
            <Typography variant="caption" sx={{ display: 'block', color: emailCommercialStageTone, fontWeight: 800, letterSpacing: '0.08em' }}>
              KOMMERSIELL FLYT
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.3 }}>
              {emailCommercialWorkflow.label || 'Tilbud og kontrakt'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2, lineHeight: 1.5 }}>
              {emailCommercialWorkflow.detail || 'E-posttråden er koblet til tilbuds- og kontraktsflyten.'}
            </Typography>
          </Box>
        )}

        {gmailThreadMessages.length > 0 ? gmailMessagesWithDaySeparators.map(({ message, dayLabel, showDayDivider }) => {
          const ownMessage = message.direction === 'outbound';

          return (
            <React.Fragment key={`mobile-email-message-${message.id}`}>
              {showDayDivider && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.15 }}>
                  <Chip size="small" label={dayLabel} sx={{ height: 22, bgcolor: 'rgba(15,23,42,0.06)', color: '#475569', fontWeight: 700 }} />
                </Box>
              )}
              <Box sx={{ display: 'flex', justifyContent: ownMessage ? 'flex-end' : 'flex-start' }}>
                <Box
                  sx={{
                    width: 'min(100%, 88%)',
                    p: 1.15,
                    borderRadius: 3,
                    border: `1px solid ${getColorWithAlpha(ownMessage ? '#2563eb' : '#cbd5e1', ownMessage ? 0.22 : 0.92)}`,
                    bgcolor: ownMessage ? 'rgba(37,99,235,0.08)' : 'rgba(255,255,255,0.98)',
                    boxShadow: ownMessage ? '0 12px 22px rgba(37,99,235,0.1)' : '0 10px 20px rgba(15,23,42,0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {ownMessage ? 'Deg' : message.senderName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      {formatDetailedTime(message.timestamp)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', color: '#475569', fontWeight: 700, mb: 0.55 }}>
                    {message.subject}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, color: '#0f172a' }}>
                    {message.content || message.snippet || 'Tom e-post'}
                  </Typography>
                  {message.hasAttachments && (
                    <Chip size="small" label="Har vedlegg" sx={{ mt: 0.8, height: 22, bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 700 }} />
                  )}
                </Box>
              </Box>
            </React.Fragment>
          );
        }) : (
          <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center', maxWidth: 280 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
              Tråden er klar
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Ingen meldinger tilgjengelig ennå. Svar direkte fra feltet under.
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 1.05, py: 1.05, bgcolor: 'rgba(255,255,255,0.04)', borderTop: '1px solid rgba(226,232,240,0.9)' }}>
        {renderPendingGoogleDriveAttachments({ compact: true })}
        <Typography variant="caption" sx={{ display: 'block', color: '#2563eb', fontWeight: 800, mb: 0.55 }}>
          Svar til {selectedEmailThreadPreview.counterpartName || selectedEmailThreadPreview.counterpartEmail || 'kontakt'}
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) auto',
            alignItems: 'center',
            gap: 0.8,
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={5}
            placeholder={`Svar ${selectedEmailThreadPreview.counterpartName || 'på e-post'}...`}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleQuickReply();
              }
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
                bgcolor: 'rgba(248,250,252,0.98)',
                alignItems: 'flex-start',
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <IconButton size="small" sx={{ color: '#94a3b8', mt: 0.2 }} onClick={() => openGoogleDriveAttachmentPicker()} aria-label="Legg ved fra Google Drive">
                    <AttachFile sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <IconButton
            onClick={handleQuickReply}
            disabled={(!messageInput.trim() && pendingGoogleDriveAttachments.length === 0) || sendGmailReply.isPending}
            sx={{
              width: 46,
              height: 46,
              bgcolor: '#2563eb',
              color: 'white',
              boxShadow: '0 14px 28px rgba(37,99,235,0.22)',
              '&:hover': { bgcolor: '#1d4ed8' },
              '&.Mui-disabled': { bgcolor: 'rgba(203,213,225,0.9)', color: 'white' },
            }}
          >
            <Send sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  ) : null;

  const mobileUtilityMeta = activeTab === TAB_FEEDBACK
    ? {
        overline: 'CreatorHub',
        title: 'Feedback',
        accent: '#f97316',
        searchPlaceholder: 'Søk i feedback',
        chips: [
          { label: `Åpne · ${feedbackStats.open}`, accent: true },
          { label: `Pågår · ${feedbackStats.in_progress}` },
          { label: `Verifisert · ${feedbackStats.verified}` },
          { label: `Lukket · ${feedbackStats.closed}` },
        ],
      }
    : {
        overline: 'CreatorHub Academy',
        title: 'Academy',
        accent: '#0f766e',
        searchPlaceholder: 'Søk i kurs og lenker',
        chips: [
          { label: `${academyQuickLinks.length} snarveier`, accent: true },
          { label: 'Kursoversikt' },
          { label: 'Dashboard' },
          { label: 'Analyse' },
        ],
      };

  const mobileUtilityScreen = (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'rgba(20,16,11,0.6)' }}>
      <Box sx={{ px: 2, pt: 2.2, pb: 1.4, bgcolor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(226,232,240,0.9)' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ display: 'block', color: mobileUtilityMeta.accent, fontWeight: 800, letterSpacing: '0.12em', lineHeight: 1 }}>
              {mobileUtilityMeta.overline}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', mt: 0.35 }}>
              {mobileUtilityMeta.title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
            <IconButton
              size="small"
              onClick={() => utilitySearchInputRef.current?.focus()}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Search sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => setMobileTabMenuAnchor(e.currentTarget)}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <MoreVert sx={{ fontSize: 18 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => { onClose?.(); setIsExpanded(false); setIsOpen(false); }}
              sx={{ border: '1px solid rgba(226,232,240,0.95)', bgcolor: 'rgba(248,250,252,0.96)' }}
            >
              <Close sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.7, mt: 1.4, overflowX: 'auto', pb: 0.2 }}>
          {mobileUtilityMeta.chips.map((chip) => (
            <Chip
              key={`mobile-utility-chip-${chip.label}`}
              label={chip.label}
              sx={{
                height: 30,
                borderRadius: 999,
                fontWeight: 700,
                bgcolor: chip.accent ? getColorWithAlpha(mobileUtilityMeta.accent, 0.12) : 'rgba(241,245,249,0.98)',
                color: chip.accent ? mobileUtilityMeta.accent : '#475569',
              }}
            />
          ))}
        </Box>

        <TextField
          fullWidth
          size="small"
          inputRef={utilitySearchInputRef}
          value={mobileUtilityFilter}
          onChange={(event) => setMobileUtilityFilter(event.target.value)}
          placeholder={mobileUtilityMeta.searchPlaceholder}
          sx={{
            mt: 1.3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 999,
              bgcolor: 'rgba(248,250,252,0.98)',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 1.35, py: 1.2, display: 'grid', gap: 0.95 }}>
        {activeTab === TAB_FEEDBACK ? (
          feedbackLoading && feedbackList.length === 0 ? (
            <Box sx={{ ...mobileListCardSx, p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Henter feedback
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                Laster inn tilbakemeldinger fra dashboardet.
              </Typography>
            </Box>
          ) : filteredMobileFeedback.length > 0 ? (
            filteredMobileFeedback.map((feedback) => (
              <Box
                key={`mobile-feedback-card-${feedback.id}`}
                onClick={() => openFeedbackDetailDialog(feedback)}
                sx={{
                  ...mobileListCardSx,
                  display: 'grid',
                  gridTemplateColumns: '48px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.1,
                  py: 1,
                  cursor: 'pointer',
                }}
              >
                <Avatar sx={{ width: 44, height: 44, bgcolor: getColorWithAlpha(getFeedbackTypeColor(feedback.feedbackType), 0.12), color: getFeedbackTypeColor(feedback.feedbackType) }}>
                  {getFeedbackTypeIcon(feedback.feedbackType)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                    {feedback.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }} noWrap>
                    {feedback.description}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', justifyItems: 'end', gap: 0.45 }}>
                  <Chip
                    size="small"
                    label={feedback.priority}
                    sx={{
                      height: 20,
                      bgcolor: getColorWithAlpha(getFeedbackPriorityColor(feedback.priority), 0.12),
                      color: getFeedbackPriorityColor(feedback.priority),
                      fontWeight: 800,
                      textTransform: 'capitalize',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    {formatDetailedDate(feedback.createdAt)}
                  </Typography>
                </Box>
              </Box>
            ))
          ) : (
            <Box sx={{ ...mobileListCardSx, p: 2, textAlign: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Ingen feedback matcher søket
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                Prøv et annet søk eller åpne feedbackpanelet fra menyen.
              </Typography>
            </Box>
          )
        ) : filteredAcademyLinks.length > 0 ? (
          filteredAcademyLinks.map((link) => (
            <Box
              key={`mobile-academy-${link.id}`}
              onClick={() => handleOpenAcademyPath(link.path)}
              sx={{
                ...mobileListCardSx,
                display: 'grid',
                gridTemplateColumns: '48px minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 1,
                px: 1.1,
                py: 1,
                cursor: 'pointer',
              }}
            >
              <Avatar sx={{ width: 44, height: 44, bgcolor: 'rgba(15,118,110,0.12)', color: '#0f766e' }}>
                {link.icon}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#111827' }} noWrap>
                  {link.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }} noWrap>
                  {link.description}
                </Typography>
              </Box>
              <Chip
                size="small"
                label="Åpne"
                sx={{
                  height: 20,
                  bgcolor: 'rgba(15,118,110,0.12)',
                  color: '#0f766e',
                  fontWeight: 800,
                }}
              />
            </Box>
          ))
        ) : (
          <Box sx={{ ...mobileListCardSx, p: 2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Ingen Academy-lenker matcher søket
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              Prøv et annet søk eller åpne Academy direkte.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  const mobileBottomTabs = [
    { id: TAB_CREATORHUB, label: 'Chat', icon: <Chat sx={{ fontSize: 20 }} /> },
    { id: TAB_GOOGLE_CHAT, label: 'Google', icon: <Google sx={{ fontSize: 20 }} /> },
    { id: TAB_EMAIL, label: 'E-post', icon: <Email sx={{ fontSize: 20 }} /> },
    { id: TAB_FEEDBACK, label: 'Feedback', icon: <BugReport sx={{ fontSize: 20 }} /> },
  ] as const;

  const mobileShell = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', bgcolor: 'rgba(20,16,11,0.6)' }}>
      <Box sx={{ flex: 1, minHeight: 0, pb: isMobileDetailView ? 0 : 11 }}>
        {activeTab === TAB_CREATORHUB
          ? (isMobileDetailView ? mobileInternalDetailView : mobileInternalListView)
          : activeTab === TAB_GOOGLE_CHAT
            ? (isMobileDetailView ? mobileGoogleDetailView : mobileGoogleListView)
            : activeTab === TAB_EMAIL
              ? (isMobileDetailView ? mobileEmailDetailView : mobileEmailListView)
            : activeTab === TAB_EVENDI
              ? (isMobileDetailView ? mobileEvendiDetailView : mobileEvendiListView)
              : mobileUtilityScreen}
      </Box>

      {!isMobileDetailView && (
        <>
          <Fab
            color="primary"
            onClick={handleMobilePrimaryAction}
            sx={{
              position: 'absolute',
              bottom: 58,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 58,
              height: 58,
              bgcolor: '#f97316',
              boxShadow: '0 18px 36px rgba(249,115,22,0.28)',
              '&:hover': { bgcolor: '#ea580c' },
            }}
          >
            <Add />
          </Fab>

          <Box
            sx={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 14,
              bgcolor: '#1f1f1f',
              borderRadius: 999,
              px: 1,
              py: 0.9,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              alignItems: 'center',
              boxShadow: '0 18px 38px rgba(15,23,42,0.24)',
            }}
          >
            {mobileBottomTabs.map((item) => {
              const selected = activeTab === item.id;

              return (
                <IconButton
                  key={`mobile-tab-${item.id}`}
                  size="small"
                  onClick={() => handleMobileTabChange(item.id)}
                  sx={{
                    color: selected ? '#f97316' : 'rgba(255,255,255,0.78)',
                    justifySelf: 'center',
                  }}
                >
                  {item.icon}
                </IconButton>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <ChatWidgetErrorBoundary widgetName="UniversalChatWidget">
      <>
      {/* Chat Widget Panel */}
      {(isOpen || isExpanded) && (
        <Box sx={{
          position: 'fixed',
          top: isCompactViewport ? 12 : widgetPosition.y,
          left: isCompactViewport ? 0 : widgetPosition.x,
          right: isCompactViewport ? 0 : 'auto',
          bottom: isCompactViewport ? 12 : 'auto',
          zIndex: layerZIndex,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCompactViewport ? 'center' : 'flex-end',
          gap: 1
        }}>
          {/* Chat Preview Panel - Resizable */}
          <Paper elevation={0} sx={{
            ...(isWorkspacePanel || isCompactViewport ? {} : theming.getThemedCardSx()),
            width: panelWidth,
            maxWidth: '100%',
            height: panelHeight,
            borderRadius: isCompactViewport ? 4 : 5,
            overflow: 'hidden',
            border: isCompactViewport
              ? '1px solid rgba(226,232,240,0.9)'
              : isWorkspacePanel
                ? `1px solid ${workspaceShellBorder}`
                : `1px solid ${chatWidgetDesign.border}`,
            background: isCompactViewport
              ? `radial-gradient(circle at top, ${getColorWithAlpha(professionColor, 0.16)} 0%, rgba(15,10,7,0.97) 38%, #0a0807 100%)`
              : isWorkspacePanel
                ? workspaceShellBackground
                : chatWidgetDesign.shellGradient,
            boxShadow: isCompactViewport
              ? '0 26px 54px rgba(15,23,42,0.18)'
              : isWorkspacePanel
                ? workspacePanelShadow
                : chatWidgetDesign.shellShadow,
            backdropFilter: isCompactViewport ? 'none' : isWorkspacePanel ? 'none' : 'blur(8px)',
            mb: isWorkspacePanel ? 0 : 1,
            position: 'relative',
            transformOrigin: isCompactViewport ? 'bottom center' : isWorkspacePanel ? 'calc(100% - 32px) calc(100% - 28px)' : 'right bottom',
            cursor: isResizing ? 'nw-resize' : (isCompactViewport ? 'default' : 'grab'),
            userSelect: isResizing ? 'none' : 'auto',
            willChange: 'transform, opacity, box-shadow, filter',
            transformStyle: isWorkspacePanel ? 'preserve-3d' : undefined,
            animation: workspaceShellAnimation,
            '&::before': isWorkspacePanel ? {
              content: '""',
              position: 'absolute',
              inset: -1,
              pointerEvents: 'none',
              borderRadius: 'inherit',
              background: 'linear-gradient(140deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.2) 24%, rgba(255,255,255,0) 48%, rgba(255,255,255,0.16) 100%)',
              opacity: 0,
              mixBlendMode: 'screen',
              animation: workspacePanelAuraAnimation,
            } : undefined,
            '&::after': isWorkspacePanel ? {
              content: '""',
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 22%, rgba(255,255,255,0) 56%)',
              opacity: 0,
              mixBlendMode: 'screen',
              animation: workspaceTransitionState === 'closing'
                ? 'workspacePanelSheenOut 180ms ease forwards'
                : workspaceTransitionState === 'opening'
                  ? 'workspacePanelSheenIn 680ms cubic-bezier(0.16, 1, 0.3, 1) 40ms forwards'
                  : 'none',
            } : undefined,
            '@media (prefers-reduced-motion: reduce)': {
              animation: 'none',
              '&::before': {
                animation: 'none',
              },
              '&::after': {
                animation: 'none',
              },
            },
            '@keyframes workspaceChatWindowIn': {
              '0%': {
                opacity: 0,
                transform: 'translate3d(42px, 26px, 0) scale3d(0.948, 0.948, 1)',
                filter: 'saturate(0.92) brightness(0.985)',
                boxShadow: '0 18px 42px rgba(15,23,42,0.10)',
              },
              '38%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(1.016, 1.016, 1)',
                filter: 'saturate(1.01) brightness(1)',
                boxShadow: '0 42px 98px rgba(15,23,42,0.22)',
              },
              '62%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(0.996, 0.996, 1)',
                filter: 'saturate(1) brightness(1)',
              },
              '82%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(1.002, 1.002, 1)',
              },
              '100%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
                filter: 'saturate(1) brightness(1)',
                boxShadow: workspacePanelShadow,
              },
            },
            '@keyframes mobileChatWindowIn': {
              '0%': {
                opacity: 0,
                transform: 'translate3d(0, 20px, 0) scale3d(0.985, 0.985, 1)',
              },
              '100%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
              },
            },
            '@keyframes mobileChatWindowOut': {
              '0%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
              },
              '100%': {
                opacity: 0,
                transform: 'translate3d(0, 16px, 0) scale3d(0.988, 0.988, 1)',
              },
            },
            '@keyframes floatingChatWindowIn': {
              '0%': {
                opacity: 0,
                transform: 'translate3d(18px, 12px, 0) scale3d(0.975, 0.975, 1)',
              },
              '100%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
              },
            },
            '@keyframes workspaceChatWindowOut': {
              '0%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
                filter: 'saturate(1) brightness(1)',
                boxShadow: workspacePanelShadow,
              },
              '18%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(0.996, 0.996, 1)',
              },
              '100%': {
                opacity: 0,
                transform: 'translate3d(34px, 22px, 0) scale3d(0.962, 0.962, 1)',
                filter: 'saturate(0.94) brightness(0.99)',
                boxShadow: '0 18px 40px rgba(15,23,42,0.10)',
              },
            },
            '@keyframes workspaceChromeIn': {
              '0%': {
                opacity: 0,
                transform: 'translate3d(0, 18px, 0)',
              },
              '55%': {
                opacity: 1,
                transform: 'translate3d(0, -1px, 0)',
              },
              '100%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0)',
              },
            },
            '@keyframes workspaceChromeOut': {
              '0%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0)',
              },
              '100%': {
                opacity: 0,
                transform: 'translate3d(0, 8px, 0)',
              },
            },
            '@keyframes workspaceContentIn': {
              '0%': {
                opacity: 0,
                transform: 'translate3d(0, 24px, 0)',
              },
              '58%': {
                opacity: 1,
                transform: 'translate3d(0, -1px, 0)',
              },
              '100%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0)',
              },
            },
            '@keyframes workspaceContentOut': {
              '0%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0)',
              },
              '100%': {
                opacity: 0,
                transform: 'translate3d(0, 10px, 0)',
              },
            },
            '@keyframes workspacePanelSheenIn': {
              '0%': {
                opacity: 0,
                transform: 'translate3d(24px, 24px, 0) scale3d(0.98, 0.98, 1)',
              },
              '38%': {
                opacity: 0.42,
              },
              '100%': {
                opacity: 0.12,
                transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
              },
            },
            '@keyframes workspacePanelSheenOut': {
              '0%': {
                opacity: 0.12,
              },
              '100%': {
                opacity: 0,
              },
            },
            '@keyframes workspacePanelAuraIn': {
              '0%': {
                opacity: 0,
                transform: 'scale3d(0.985, 0.985, 1)',
              },
              '30%': {
                opacity: 0.38,
              },
              '100%': {
                opacity: 0.14,
                transform: 'scale3d(1, 1, 1)',
              },
            },
            '@keyframes workspacePanelAuraOut': {
              '0%': {
                opacity: 0.14,
              },
              '100%': {
                opacity: 0,
              },
            },
            '@keyframes floatingChatWindowOut': {
              '0%': {
                opacity: 1,
                transform: 'translate3d(0, 0, 0) scale3d(1, 1, 1)',
              },
              '100%': {
                opacity: 0,
                transform: 'translate3d(12px, 10px, 0) scale3d(0.978, 0.978, 1)',
              },
            },
          }}>
            {isCompactViewport ? mobileShell : (
              <>
            {/* Header with drag handle */}
            <Box
              onMouseDown={isWorkspacePanel ? undefined : handleDragStart}
              sx={{
                px: isWorkspacePanel ? 1.75 : 1.5,
                py: isWorkspacePanel ? 1.1 : 1.35,
                background: headerSurface,
                color: isWorkspacePanel ? workspaceHeaderText : 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'flex-start',
                gap: isWorkspacePanel ? 0.8 : 1,
                cursor: isCompactViewport || isWorkspacePanel ? 'default' : (isDragging ? 'grabbing' : 'grab'),
                userSelect: 'none',
                borderBottom: isWorkspacePanel ? `1px solid ${workspaceShellBorder}` : `1px solid ${chatWidgetDesign.accentMuted}`,
                boxShadow: isWorkspacePanel ? '0 1px 0 rgba(255,255,255,0.85)' : chatWidgetDesign.cardShadow,
                willChange: isWorkspacePanel ? 'transform, opacity' : undefined,
                animation: workspaceChromeAnimation,
              }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 1.2,
                  minWidth: 0,
                  flex: 1,
                  width: '100%'
                }}
              >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.05, minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    width: isWorkspacePanel ? 42 : 36,
                    height: isWorkspacePanel ? 42 : 36,
                    borderRadius: isWorkspacePanel ? 2.6 : 2.2,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: isWorkspacePanel ? '#f97316' : 'rgba(255,255,255,0.15)',
                    border: isWorkspacePanel ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: isWorkspacePanel
                      ? '0 12px 24px rgba(249,115,22,0.24)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.12)',
                    flexShrink: 0,
                  }}
                >
                  <Box sx={{ color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {activeTab === TAB_GOOGLE_CHAT ? <Google sx={{ fontSize: 22 }} /> : activeTab === TAB_EMAIL ? <Email sx={{ fontSize: 22 }} /> : professionIcon || <Chat sx={{ fontSize: 20 }} />}
                  </Box>
                </Box>
                <Box sx={{ minWidth: 0, mr: 0.5 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 800,
                      color: isWorkspacePanel ? workspaceHeaderText : 'white',
                      fontSize: isCompactViewport ? '0.9rem' : isNarrowWorkspace ? '1rem' : '1.04rem',
                      lineHeight: 1.08,
                      letterSpacing: '-0.01em'
                    }}
                  >
                    {headerTitle}
                  </Typography>
                  {(!isCompactViewport || isNarrowWorkspace) && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: isWorkspacePanel ? workspaceSubtleText : 'rgba(255,255,255,0.86)',
                        fontSize: isNarrowWorkspace ? '0.76rem' : '0.74rem',
                        lineHeight: 1.5,
                        mt: 0.4,
                        display: 'block',
                        maxWidth: isWorkspacePanel ? 520 : '100%',
                        whiteSpace: isCompactHeaderWorkspace ? 'normal' : 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {headerSubtitle}
                    </Typography>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.55, ml: isCompactHeaderWorkspace ? 0 : 1, flexShrink: 0, flexWrap: isCompactHeaderWorkspace ? 'wrap' : 'nowrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                {!isCompactViewport && (
                  <Button
                    size="small"
                    variant={isWorkspacePanel ? 'contained' : 'outlined'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFullscreen();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    startIcon={<OpenInNew fontSize="small" />}
                    sx={{
                      minHeight: 32,
                      px: 1.15,
                      borderRadius: 999,
                      textTransform: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      color: isWorkspacePanel ? 'white' : 'rgba(255,255,255,0.94)',
                      bgcolor: isWorkspacePanel ? '#f97316' : 'rgba(255,255,255,0.12)',
                      borderColor: isWorkspacePanel ? '#f97316' : 'rgba(255,255,255,0.28)',
                      boxShadow: isWorkspacePanel ? '0 10px 20px rgba(249,115,22,0.22)' : 'none',
                      '&:hover': {
                        bgcolor: isWorkspacePanel ? '#ea580c' : 'rgba(255,255,255,0.18)',
                        borderColor: isWorkspacePanel ? '#ea580c' : 'rgba(255,255,255,0.36)',
                      },
                    }}
                  >
                    Åpne full chat
                  </Button>
                )}
                {!isCompactViewport && (
                  <Tooltip title="Endre størrelse">
                    <IconButton
                      size="small"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e);
                      }}
                      sx={{
                        ...headerActionButtonSx,
                        cursor: 'nw-resize',
                      }}
                    >
                      <OpenWith fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {!isWorkspacePanel && !isCompactHeaderWorkspace && !isNarrowWorkspace && (
                  <Tooltip title="Opprett support-sak">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTicketDialogOpen(true);
                      setShowTicketSuggestions(true);
                }}
                    onMouseDown={(e) => e.stopPropagation()}
                    sx={{
                      ...headerActionButtonSx,
                      display: { xs: 'none', sm: 'inline-flex' }
                    }}
                  >
                    <Support />
                  </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Åpne CRM-system">
                  <IconButton
                    size="small"
                    sx={{
                      ...headerActionButtonSx
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(TAB_CREATORHUB);
                      if (!selectedChat && chatPreviews[0]?.id) {
                        setSelectedChat(chatPreviews[0].id);
                      }
                      handleToggleInternalContactPanel();
                }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <BadgeIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {activeTab === TAB_GOOGLE_CHAT && (
                  <IconButton
                    size="small"
                    aria-label="Google Chat-valg"
                    sx={{
                      ...headerActionButtonSx
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setGoogleChatMenuAnchor(e.currentTarget);
                }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <MoreVert fontSize="small" />
                  </IconButton>
                )}
                {!isCompactViewport && !isWorkspacePanel && isSupported && (
                  <Tooltip title="Push-varsler innstillinger">
                    <IconButton
                      size="small"
                      sx={{
                        ...headerActionButtonSx,
                        color: isWorkspacePanel ? '#64748b' : (pushEnabled ? 'rgba(255, 255, 255, 0.9)' : 'white'),
                      }}
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
                {!isCompactViewport && !isWorkspacePanel && (
                <IconButton
                  size="small"
                  sx={{
                    ...headerActionButtonSx
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
              }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Settings fontSize="small" />
                </IconButton>
                )}
                {!isCompactViewport && (
                  <Button
                    size="small"
                    variant="text"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleCloseWidget();
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    sx={{
                      minHeight: 32,
                      px: 1,
                      borderRadius: 999,
                      color: isWorkspacePanel ? '#64748b' : 'rgba(255,255,255,0.88)',
                      textTransform: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      '&:hover': {
                        bgcolor: getColorWithAlpha('#ef4444', 0.14),
                        color: isWorkspacePanel ? '#dc2626' : 'white',
                      },
                    }}
                  >
                    Lukk
                  </Button>
                )}
                <Tooltip title="Lukk chat">
                  <IconButton
                    size="small"
                    sx={{
                      ...headerActionButtonSx
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
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
                    <Close fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              </Box>
              {!isCompactViewport && (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 0.6,
                    width: '100%',
                    pt: 0.1,
                    '& > *': {
                      flexShrink: 0,
                    }
                  }}
                >
                  {activeTab === TAB_GOOGLE_CHAT ? (
                    <>
                      <Chip
                        icon={<Google sx={{ fontSize: 16 }} />}
                        label={headerPrimaryChipLabel}
                        size="small"
                        sx={{
                          color: isWorkspacePanel ? '#c2410c' : 'white',
                          border: isWorkspacePanel ? '1px solid rgba(249,115,22,0.24)' : '1px solid rgba(255, 255, 255, 0.28)',
                          bgcolor: isWorkspacePanel ? 'rgba(249,115,22,0.1)' : 'rgba(255, 255, 255, 0.18)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          height: 26,
                        }}
                      />
                      <Chip
                        label={`${googleChatSpaces.length} rom`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(15,23,42,0.25)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.32)',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          height: 26,
                        }}
                      />
                      {!isCompactHeaderWorkspace && selectedGoogleLastActivity && (
                        <Chip
                          label={`Sist aktiv ${formatTime(selectedGoogleLastActivity)}`}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.16)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.28)',
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            height: 26,
                          }}
                        />
                      )}
                    </>
                  ) : activeTab === TAB_EMAIL ? (
                    <>
                      <Chip
                        icon={<Email sx={{ fontSize: 16 }} />}
                        label={headerPrimaryChipLabel}
                        size="small"
                        sx={{
                          color: isWorkspacePanel ? '#1d4ed8' : 'white',
                          border: isWorkspacePanel ? '1px solid rgba(37,99,235,0.24)' : '1px solid rgba(255, 255, 255, 0.28)',
                          bgcolor: isWorkspacePanel ? 'rgba(37,99,235,0.1)' : 'rgba(255, 255, 255, 0.18)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          height: 26,
                        }}
                      />
                      <Chip
                        label={`${emailThreads.length} tråder`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(15,23,42,0.25)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.32)',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          height: 26,
                        }}
                      />
                      {!isCompactHeaderWorkspace && selectedEmailThreadPreview?.timestamp && (
                        <Chip
                          label={`Sist e-post ${formatTime(selectedEmailThreadPreview.timestamp)}`}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.16)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.28)',
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            height: 26,
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <Chip
                        icon={
                          activeTab === TAB_CREATORHUB ? <img src="/creatorhub-icon.png" alt="" style={{ width: 16, height: 16 }} /> :
                          activeTab === TAB_EVENDI ? <img src="/evendi-logo.png" alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} /> :
                          activeTab === TAB_ACADEMY ? <img src="/academy-favicon.svg" alt="" style={{ width: 16, height: 16 }} /> :
                          undefined
                        }
                        label={isWorkspacePanel ? headerPrimaryChipLabel : isCompactHeaderWorkspace ? activeTabShortLabel : isNarrowWorkspace ? activeTabShortLabel : activeTabLabel}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255, 255, 255, 0.18)',
                          color: 'white',
                          border: '1px solid rgba(255, 255, 255, 0.28)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          height: 26,
                          '& .MuiChip-icon': { ml: 0.5, opacity: 0.9 },
                        }}
                      />
                      {totalUnreadCount > 0 && (
                        <Chip
                          label={isCompactHeaderWorkspace ? `${totalUnreadCount}` : `${totalUnreadCount} uleste`}
                          size="small"
                          sx={{
                            bgcolor: isWorkspacePanel ? 'rgba(15,23,42,0.06)' : 'rgba(0, 0, 0, 0.24)',
                            color: isWorkspacePanel ? '#334155' : 'white',
                            fontWeight: 700,
                            height: 26,
                          }}
                        />
                      )}
                      {activeTab === TAB_CREATORHUB && totalOnlineChats > 0 && (
                        <Chip
                          icon={<Visibility sx={{ fontSize: 15 }} />}
                          label={isCompactHeaderWorkspace ? `${totalOnlineChats}` : `${totalOnlineChats} online`}
                          size="small"
                          sx={{
                            bgcolor: isWorkspacePanel ? 'rgba(15,23,42,0.06)' : 'rgba(0, 0, 0, 0.18)',
                            color: isWorkspacePanel ? '#0f172a' : 'white',
                            fontWeight: 700,
                            height: 26,
                            '& .MuiChip-icon': {
                              color: isWorkspacePanel ? '#16a34a' : '#86efac',
                            },
                          }}
                        />
                      )}
                    </>
                  )}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 0.9,
                      py: 0.42,
                      borderRadius: 999,
                      bgcolor: isWorkspacePanel ? 'rgba(255,255,255,0.86)' : 'rgba(15, 23, 42, 0.22)',
                      border: isWorkspacePanel ? `1px solid ${getColorWithAlpha('#cbd5e1', 0.9)}` : '1px solid rgba(255,255,255,0.28)',
                    }}
                  >
                    <Box
                      sx={{
                        width:  8,
                        height:  8,
                        borderRadius: '50%',
                        backgroundColor: communicationStatus.googleChatStatus === 'connected' ? '#4caf50' : '#ef4444',
                        border: '1px solid white'
                      }}
                      title={
                        communicationStatus.googleChatStatus === 'connected'
                          ? `Google Chat API: ${communicationStatus.googleChatResponse}`
                          : `Google Chat API: ${communicationStatus.googleChatResponse || 'Not tested'}`
                      }
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.9, fontWeight: 700 }}>
                      {communicationStatus.googleChatStatus === 'connected' ? 'API aktiv' : 'API'}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Google Chat Integration Tabs */}
            <Box sx={{
              borderBottom: isWorkspacePanel ? `1px solid ${workspaceShellBorder}` : `1px solid ${chatWidgetDesign.border}`,
              bgcolor: isWorkspacePanel ? 'transparent' : 'rgba(255,255,255,0.72)',
              px: isWorkspacePanel ? 1.4 : 1.25,
              pt: isWorkspacePanel ? 0.85 : 1,
              pb: isWorkspacePanel ? 0.25 : 0,
              willChange: isWorkspacePanel ? 'transform, opacity' : undefined,
              animation: workspaceTabsAnimation,
            }}>
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                variant={isWorkspacePanel || isNarrowWorkspace ? 'scrollable' : 'fullWidth'}
                scrollButtons={isWorkspacePanel || isNarrowWorkspace ? 'auto' : false}
                allowScrollButtonsMobile={isWorkspacePanel || isNarrowWorkspace}
                sx={{
                  minHeight: 54,
                  '& .MuiTabs-scrollButtons': {
                    width: 34,
                    color: '#475569',
                  },
                  '& .MuiTabs-flexContainer': {
                    gap: 0.5
                  },
                  '& .MuiTab-root': {
                    color: '#475569',
                    fontSize: isNarrowWorkspace ? '0.78rem' : isWorkspacePanel ? '0.76rem' : '0.8rem',
                    fontWeight: 700,
                    minHeight: isWorkspacePanel ? 38 : 42,
                    minWidth: isWorkspacePanel ? 118 : isNarrowWorkspace ? 120 : 0,
                    border: isWorkspacePanel ? `1px solid ${workspaceCardBorder}` : `1px solid ${getColorWithAlpha(chatWidgetDesign.border, 0.82)}`,
                    borderRadius: 999,
                    px: isWorkspacePanel ? 1.45 : isNarrowWorkspace ? 1.1 : 1,
                    py: isWorkspacePanel ? 0.6 : 0.85,
                    bgcolor: isWorkspacePanel ? 'rgba(255,255,255,0.84)' : 'transparent',
                    boxShadow: isWorkspacePanel ? '0 8px 18px rgba(15,23,42,0.04)' : 'none',
                    '&:hover': {
                      bgcolor: isWorkspacePanel ? 'rgba(255,255,255,0.96)' : getColorWithAlpha(chatWidgetDesign.accent, 0.08)
                    },
                    '&.Mui-selected': {
                      color: 'common.white',
                      bgcolor: isWorkspacePanel ? '#f97316' : chatWidgetDesign.accent,
                      boxShadow: isWorkspacePanel ? '0 12px 22px rgba(249,115,22,0.22)' : `0 10px 18px ${chatWidgetDesign.accentMuted}`,
                      border: isWorkspacePanel ? '1px solid #f97316' : `1px solid ${chatWidgetDesign.accent}`
                    }
                  }, '& .MuiTabs-indicator': {
                    display: 'none'
                  }
                }}
              >
                <Tab
                  value={TAB_CREATORHUB}
                  icon={<img src="/creatorhub-icon.png" alt="CreatorHub" style={{ width: 24, height: 24 }} />}
                  label={isNarrowWorkspace ? 'Hub' : 'CREATORHUB'}
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
                <Tab
                  value={TAB_GOOGLE_CHAT}
                  icon={<Google sx={{ fontSize: 24 }} />}
                  label={isNarrowWorkspace ? 'Google' : 'GOOGLE CHAT'}
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
                <Tab
                  value={TAB_EMAIL}
                  icon={<Email sx={{ fontSize: 24 }} />}
                  label={isNarrowWorkspace ? 'E-post' : 'E-POST'}
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
                <Tab
                  value={TAB_FEEDBACK}
                  icon={<BugReport sx={{ fontSize: 24 }} />}
                  label="FEEDBACK"
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
                <Tab
                  value={TAB_EVENDI}
                  icon={<img src="/evendi-logo.png" alt="Evendi" style={{ width: 24, height: 24, borderRadius: '50%' }} />}
                  label="EVENDI"
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
                <Tab
                  value={TAB_ACADEMY}
                  icon={<img src="/academy-favicon.svg" alt="Academy" style={{ width: 24, height: 24 }} />}
                  label={isNarrowWorkspace ? 'Academy' : 'ACADEMY'}
                  iconPosition="start"
                  sx={{ textTransform: 'none' }}
                />
              </Tabs>
            </Box>

            {/* Tab Content - Dynamic height based on widget size */}
            <Box sx={{
              height: tabContentHeight, // Subtract header, tabs and input areas
              overflow: 'auto',
              px: isWorkspacePanel ? 1.1 : 1.25,
              py: isWorkspacePanel ? 1.1 : 1,
              background: isWorkspacePanel
                ? 'linear-gradient(180deg, rgba(239,242,246,0.92) 0%, rgba(231,235,240,0.98) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(248,250,252,0.98) 100%)'
              ,
              willChange: isWorkspacePanel ? 'transform, opacity' : undefined,
              animation: workspaceContentAnimation,
            }}>
              {activeTab === TAB_CREATORHUB ? (
                // Internal Chat Tab
                <Box sx={{ height: '100%', minHeight: 0 }}>
                  {isNarrowWorkspace ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.1, minHeight: 0, height: '100%' }}>
                      <Box sx={{ display: 'grid', gap: 1.1, minHeight: 0 }}>
                        {internalConversationList}
                        {internalInboxNavigation}
                      </Box>
                      {internalConversationPanel}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: isMediumWorkspace
                          ? '72px minmax(300px, 340px) minmax(0, 1fr)'
                          : shouldShowInternalCrmRailPanel
                            ? '72px minmax(280px, 320px) minmax(300px, 360px) minmax(0, 1fr)'
                            : '72px minmax(210px, 240px) minmax(300px, 360px) minmax(0, 1fr)',
                        gap: 1.2,
                        minHeight: 0,
                        height: '100%',
                      }}
                    >
                      <Paper
                        elevation={0}
                        sx={{
                          ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
                          borderRadius: 4,
                          background: 'linear-gradient(180deg, #191919 0%, #111111 100%)',
                          color: 'white',
                          border: `1px solid ${getColorWithAlpha('#0f172a', 0.22)}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          py: 1.25,
                          px: 0.8,
                          boxShadow: '0 22px 38px rgba(15,23,42,0.18)',
                        }}
                      >
                        <Box sx={{ display: 'grid', gap: 0.85, justifyItems: 'center' }}>
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: 2,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: '#f97316',
                              boxShadow: '0 10px 22px rgba(249,115,22,0.32)',
                            }}
                          >
                            <Chat sx={{ fontSize: 18, color: 'white' }} />
                          </Box>
                          {[
                            { icon: <Comment sx={{ fontSize: 18 }} />, section: 'all', label: 'Alle samtaler' },
                            { icon: <Star sx={{ fontSize: 18 }} />, section: 'unread', label: 'Uleste samtaler' },
                            { icon: <Send sx={{ fontSize: 18 }} />, section: 'direct', label: 'Direktesamtaler' },
                            { icon: <Person sx={{ fontSize: 18 }} />, section: 'team', label: 'Teamsamtaler' },
                            { icon: <Assignment sx={{ fontSize: 18 }} />, section: 'archive', label: 'Arkiv' },
                          ].map((item, index) => {
                            const active = internalInboxSection === item.section;

                            return (
                              <IconButton
                                key={`rail-${index}`}
                                size="small"
                                onClick={() => setInternalInboxSection(item.section as typeof internalInboxSection)}
                                aria-label={item.label}
                                sx={{
                                  color: active ? '#f97316' : 'rgba(255,255,255,0.82)',
                                  bgcolor: active ? 'rgba(249,115,22,0.16)' : 'transparent',
                                  borderRadius: 2,
                                  '&:hover': { bgcolor: active ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.08)' },
                                }}
                              >
                                {item.icon}
                              </IconButton>
                            );
                          })}
                          <Tooltip title={internalContactPanelOpen ? 'Skjul CRM-system' : 'Åpne CRM-system'}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                if (!selectedChat && chatPreviews[0]?.id) {
                                  setSelectedChat(chatPreviews[0].id);
                                }
                                handleToggleInternalContactPanel();
                              }}
                              aria-label={internalContactPanelOpen ? 'Skjul CRM-system' : 'Åpne CRM-system'}
                              sx={{
                                color: internalContactPanelOpen ? '#f97316' : 'rgba(255,255,255,0.82)',
                                bgcolor: internalContactPanelOpen ? 'rgba(249,115,22,0.16)' : 'transparent',
                                borderRadius: 2,
                                '&:hover': {
                                  bgcolor: internalContactPanelOpen ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.08)',
                                },
                              }}
                            >
                              <BadgeIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        <Box sx={{ display: 'grid', gap: 0.85, justifyItems: 'center' }}>
                          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.82)' }} onClick={handleOpenGoogleSettings} aria-label="Åpne chatinnstillinger">
                            <Settings sx={{ fontSize: 18 }} />
                          </IconButton>
                          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.82)' }} onClick={() => setTicketDialogOpen(true)} aria-label="Åpne support">
                            <Support sx={{ fontSize: 18 }} />
                          </IconButton>
                          <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(255,255,255,0.14)', color: 'white', fontWeight: 700 }}>
                            {(userEmail || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                        </Box>
                      </Paper>

                      <Box sx={{ gridColumn: '2', minHeight: 0 }}>
                        {isMediumWorkspace
                          ? (shouldShowInternalCrmRailPanel ? internalCrmRailPanel : internalConversationList)
                          : (shouldShowInternalCrmRailPanel ? internalCrmRailPanel : internalInboxNavigation)}
                      </Box>
                      {!isMediumWorkspace && (
                        <Box sx={{ gridColumn: '3', minHeight: 0 }}>
                          {internalConversationList}
                        </Box>
                      )}
                      <Box sx={{ gridColumn: isMediumWorkspace ? '3' : '4', minHeight: 0 }}>
                        {internalConversationPanel}
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : activeTab === TAB_GOOGLE_CHAT ? (
                // Google Chat Tab
                <Box sx={{ p: 1.25, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
                  <Paper
                    elevation={0}
                      sx={{
                        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
                        p: isNarrowWorkspace ? 1.2 : 1.4,
                        borderRadius: 3.5,
                        border: `1px solid ${workspaceCardBorder}`,
                        background: workspaceSurface,
                        boxShadow: '0 14px 32px rgba(66,133,244,0.12)',
                      }}
                    >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: isNarrowWorkspace ? '1fr' : 'minmax(0, 1fr) auto',
                        gap: 1.25,
                        alignItems: 'start',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="overline" sx={{ color: '#1d4ed8', fontWeight: 800, letterSpacing: '0.08em' }}>
                          Google Chat Inbox
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75, mt: 0.15 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                            {selectedGoogleSpacePreview?.name || 'Velg et rom'}
                          </Typography>
                          <Chip
                            size="small"
                            label={googleChatConnectionLabel}
                            sx={{
                              height: 24,
                              bgcolor: isGoogleChatConnected ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.1)',
                              color: isGoogleChatConnected ? '#166534' : '#991b1b',
                              fontWeight: 700,
                            }}
                          />
                          <Chip
                            size="small"
                            label={`${googleChatSpaces.length} rom`}
                            sx={{
                              height: 24,
                              bgcolor: 'rgba(66,133,244,0.12)',
                              color: '#1d4ed8',
                              fontWeight: 700,
                            }}
                          />
                          {selectedGoogleLastActivity && (
                            <Chip
                              size="small"
                              label={`Sist aktiv ${formatTime(selectedGoogleLastActivity)}`}
                              sx={{
                                height: 24,
                                bgcolor: 'rgba(15,23,42,0.06)',
                                color: '#334155',
                                fontWeight: 600,
                              }}
                            />
                          )}
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.65, maxWidth: 620, lineHeight: 1.5 }}>
                          {selectedGoogleSpaceDescriptor}
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: isNarrowWorkspace ? 'flex-start' : 'flex-end',
                          gap: 0.75,
                        }}
                      >
                        <Button
                          variant="outlined"
                          startIcon={<Add />}
                          onClick={handleCreateGoogleChatRoom}
                          disabled={!isGoogleChatConnected}
                          sx={{
                            borderColor: getColorWithAlpha('#4285F4', 0.3),
                            color: '#1d4ed8',
                            bgcolor: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          Nytt rom
                        </Button>
                      </Box>
                    </Box>
                  </Paper>

                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: isNarrowWorkspace ? '1fr' : 'minmax(250px, 300px) minmax(0, 1fr)',
                      gap: 1.25,
                      minHeight: 0,
                      flex: 1,
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
                        borderRadius: 3.5,
                        border: `1px solid ${workspaceCardBorder}`,
                        bgcolor: workspaceSurface,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <Box sx={{ px: 1.35, py: 1.2, borderBottom: `1px solid ${chatWidgetDesign.border}` }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          Samtaler
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Bytt rom, følg aktivitet og hold flyten i samme panel.
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          value={googleSpaceFilter}
                          onChange={(event) => setGoogleSpaceFilter(event.target.value)}
                          placeholder="Søk etter rom eller person"
                          sx={{
                            mt: 1.15,
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2.5,
                              bgcolor: 'rgba(248,250,252,0.95)',
                            }
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Search sx={{ fontSize: 18, color: 'text.secondary' }} />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Box>

                      <Box
                        sx={{
                          px: 1.35,
                          py: 0.9,
                          borderBottom: `1px solid ${getColorWithAlpha(chatWidgetDesign.border, 0.65)}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          flexWrap: 'wrap',
                          bgcolor: 'rgba(248,250,252,0.8)',
                        }}
                      >
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                          <Chip
                            size="small"
                            label={googleChatConnectionLabel}
                            sx={{
                              height: 24,
                              bgcolor: isGoogleChatConnected ? 'rgba(34,197,94,0.14)' : 'rgba(239,68,68,0.1)',
                              color: isGoogleChatConnected ? '#166534' : '#991b1b',
                              fontWeight: 700,
                            }}
                          />
                          <Chip
                            size="small"
                            label={googleChatSpacesLoading ? 'Laster...' : `${googleSpaceSearchResultsCount} treff`}
                            sx={{ height: 24, bgcolor: getColorWithAlpha('#4285F4', 0.12), color: '#1d4ed8', fontWeight: 700 }}
                          />
                        </Box>
                        {googleChatLastCheckLabel && (
                          <Typography variant="caption" color="text.secondary">
                            Sjekket {googleChatLastCheckLabel}
                          </Typography>
                        )}
                      </Box>

                      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1, display: 'grid', gap: 0.9 }}>
                        {googleChatSpacesLoading ? (
                          <Box sx={{ px: 0.4, py: 0.8 }}>
                            <Typography variant="body2" color="text.secondary">
                              Henter spaces fra Google Chat...
                            </Typography>
                          </Box>
                        ) : filteredGoogleChatSpaces.length > 0 ? (
                          filteredGoogleChatSpaces.map((space) => {
                            const isSelectedSpace = selectedGoogleSpace === space.id;

                            return (
                              <Box
                                key={space.id}
                                onClick={() => setSelectedGoogleSpace(space.id)}
                                sx={{
                                  cursor: 'pointer',
                                  p: 1.2,
                                  borderRadius: 3,
                                  border: `1px solid ${isSelectedSpace ? getColorWithAlpha('#4285F4', 0.34) : getColorWithAlpha(chatWidgetDesign.border, 0.7)}`,
                                  background: isSelectedSpace
                                    ? 'linear-gradient(150deg, rgba(66,133,244,0.12) 0%, rgba(255,255,255,0.98) 100%)'
                                    : 'rgba(255,255,255,0.92)',
                                  boxShadow: isSelectedSpace ? '0 12px 24px rgba(66,133,244,0.12)' : 'none',
                                  transition: 'all 0.16s ease',
                                  '&:hover': {
                                    borderColor: getColorWithAlpha('#4285F4', 0.32),
                                    background: 'linear-gradient(150deg, rgba(66,133,244,0.08) 0%, rgba(255,255,255,0.98) 100%)',
                                  },
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                  <Avatar
                                    sx={{
                                      width: 38,
                                      height: 38,
                                      bgcolor: space.spaceType === 'DIRECT_MESSAGE' ? getColorWithAlpha('#0ea5e9', 0.14) : getColorWithAlpha('#16a34a', 0.12),
                                      color: space.spaceType === 'DIRECT_MESSAGE' ? '#0369a1' : '#166534',
                                      fontSize: '0.8rem',
                                      fontWeight: 800,
                                    }}
                                  >
                                    {space.spaceType === 'DIRECT_MESSAGE' ? 'DM' : '#'}
                                  </Avatar>
                                  <Box sx={{ minWidth: 0, flex: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }} noWrap>
                                        {space.name}
                                      </Typography>
                                      <Chip
                                        size="small"
                                        label={space.spaceType === 'DIRECT_MESSAGE' ? 'DM' : 'Rom'}
                                        sx={{
                                          height: 18,
                                          fontSize: '0.62rem',
                                          bgcolor: getColorWithAlpha('#0f172a', 0.06),
                                          color: '#334155',
                                        }}
                                      />
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.45, lineHeight: 1.45 }}>
                                      {space.description || 'Google Chat-rom klart for oppfølging.'}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.85 }}>
                                      {space.lastActiveTime && (
                                        <Chip
                                          size="small"
                                          label={`Aktiv ${formatTime(space.lastActiveTime)}`}
                                          sx={{
                                            height: 20,
                                            fontSize: '0.64rem',
                                            bgcolor: 'rgba(255,255,255,0.04)',
                                          }}
                                        />
                                      )}
                                      {space.threaded && (
                                        <Chip
                                          size="small"
                                          label="Trådet"
                                          sx={{
                                            height: 20,
                                            fontSize: '0.64rem',
                                            bgcolor: getColorWithAlpha('#4285F4', 0.1),
                                            color: '#1d4ed8',
                                          }}
                                        />
                                      )}
                                    </Box>
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })
                        ) : (
                          <Box sx={{ px: 0.4, py: 0.8 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              Ingen treff
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                              {normalizedGoogleSpaceFilter
                                ? 'Prøv et annet søk eller opprett et nytt rom.'
                                : 'Ingen Google Chat-rom funnet for denne brukeren.'}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Box
                        sx={{
                          borderTop: `1px solid ${chatWidgetDesign.border}`,
                          bgcolor: 'rgba(248,250,252,0.9)',
                        }}
                      >
                        <Box
                          sx={{
                            px: 1.35,
                            py: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                          onClick={() => setChatSettingsOpen((prev) => !prev)}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                              <Settings fontSize="small" />
                              Flytinnstillinger
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              API-status og automasjon for denne kanalen
                            </Typography>
                          </Box>
                          {chatSettingsOpen ? <ExpandLess /> : <ExpandMore />}
                        </Box>
                        <Collapse in={chatSettingsOpen}>
                          <Box sx={{ px: 1.35, pb: 1.15, display: 'grid', gap: 0.45 }}>
                            {communicationStatus.googleChatResponse && (
                              <Alert
                                severity={isGoogleChatConnected ? 'success' : 'warning'}
                                sx={{
                                  borderRadius: 2.5,
                                  '& .MuiAlert-message': { width: '100%' }
                                }}
                              >
                                <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.5 }}>
                                  {communicationStatus.googleChatResponse}
                                </Typography>
                              </Alert>
                            )}
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
                              <Alert severity="info" sx={{ mt: 0.35, borderRadius: 2.5 }}>
                                <Typography variant="caption">
                                  Automatiske svar er aktivert for denne kommunikasjonsflyten.
                                </Typography>
                              </Alert>
                            )}
                          </Box>
                        </Collapse>
                      </Box>
                    </Paper>

                    <Paper
                      elevation={0}
                      sx={{
                        ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
                        borderRadius: 3.5,
                        border: `1px solid ${workspaceCardBorder}`,
                        bgcolor: workspaceSurface,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                        overflow: 'hidden',
                      }}
                    >
                      {!isGoogleChatConnected ? (
                        <Box
                          sx={{
                            flex: 1,
                            minHeight: 0,
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: 1.2,
                            background: 'linear-gradient(180deg, rgba(248,250,252,0.88) 0%, rgba(255,255,255,0.98) 100%)',
                          }}
                        >
                          <Google sx={{ fontSize: 48, color: '#4285F4' }} />
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Koble til Google Chat for å åpne inboxen
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                            Når Chat er koblet til, får du romliste, meldingsflyt og composer i samme arbeidsflate.
                          </Typography>
                          <Button
                            variant="contained"
                            startIcon={<Google />}
                            onClick={handleGoogleChatConnect}
                            sx={{ bgcolor: '#4285F4', '&:hover': { bgcolor: '#3367D6' } }}
                          >
                            Koble til Google Chat
                          </Button>
                        </Box>
                      ) : !selectedGoogleSpace ? (
                        <Box
                          sx={{
                            flex: 1,
                            minHeight: 0,
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            gap: 1,
                            background: 'linear-gradient(180deg, rgba(248,250,252,0.88) 0%, rgba(255,255,255,0.98) 100%)',
                          }}
                        >
                          <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Velg et rom for å starte flyten
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                            Samtalen åpnes her med meldinger, status og svarfelt samlet i én arbeidsflate.
                          </Typography>
                        </Box>
                      ) : (
                        <>
                          <Box
                            sx={{
                              px: 1.5,
                              py: 1.2,
                              borderBottom: `1px solid ${chatWidgetDesign.border}`,
                              background: 'linear-gradient(180deg, rgba(248,250,252,0.92) 0%, rgba(255,255,255,0.98) 100%)',
                            }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 1,
                                flexWrap: 'wrap',
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                  {selectedGoogleSpacePreview?.name || 'Google Chat'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, maxWidth: 620 }}>
                                  {selectedGoogleSpaceDescriptor}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                                <Chip
                                  size="small"
                                  label={selectedGoogleSpacePreview?.spaceType === 'DIRECT_MESSAGE' ? 'Direktemelding' : 'Rom'}
                                  sx={{ bgcolor: getColorWithAlpha('#4285F4', 0.12), color: '#1d4ed8', fontWeight: 700 }}
                                />
                                <Chip
                                  size="small"
                                  label={googleSelectedSpaceMembers}
                                  sx={{ bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 600 }}
                                />
                                <Chip
                                  size="small"
                                  label={`${googleSelectedMessageCount} meldinger`}
                                  sx={{ bgcolor: 'rgba(15,23,42,0.06)', color: '#334155', fontWeight: 600 }}
                                />
                              </Box>
                            </Box>
                          </Box>

                          <Box
                            sx={{
                              px: 1.5,
                              py: 0.85,
                              borderBottom: `1px solid ${getColorWithAlpha(chatWidgetDesign.border, 0.7)}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1,
                              flexWrap: 'wrap',
                              bgcolor: 'rgba(248,250,252,0.78)',
                            }}
                          >
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                              {selectedGoogleLastActivity && (
                                <Chip
                                  size="small"
                                  label={`Sist aktivitet ${formatTime(selectedGoogleLastActivity)}`}
                                  sx={{ height: 22, bgcolor: 'rgba(255,255,255,0.04)' }}
                                />
                              )}
                              {selectedGoogleSpacePreview?.threaded && (
                                <Chip
                                  size="small"
                                  label="Trådet samtale"
                                  sx={{ height: 22, bgcolor: getColorWithAlpha('#4285F4', 0.1), color: '#1d4ed8' }}
                                />
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                              <Button
                                size="small"
                                variant="text"
                                startIcon={<AlternateEmail />}
                                onClick={handleGoogleMention}
                                sx={{ color: '#1d4ed8', fontWeight: 700 }}
                              >
                                @nevn
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                endIcon={<OpenInNew fontSize="small" />}
                                disabled={!selectedGoogleSpacePreview?.spaceUri}
                                onClick={handleOpenGoogleSpace}
                                sx={{ color: '#1d4ed8', fontWeight: 700 }}
                              >
                                Åpne i Chat
                              </Button>
                            </Box>
                          </Box>

                          <Box
                            ref={googleMessagesContainerRef}
                            sx={{
                              flex: 1,
                              minHeight: 0,
                              overflow: 'auto',
                              p: 1.5,
                              display: 'grid',
                              gap: 1.15,
                              bgcolor: 'linear-gradient(180deg, rgba(248,250,252,0.72) 0%, rgba(255,255,255,0.95) 100%)',
                            }}
                          >
                            {googleMessagesLoading && googleChatMessages.length === 0 ? (
                              <Box sx={{ alignSelf: 'center', justifySelf: 'center', textAlign: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                  Henter meldinger fra Google Chat...
                                </Typography>
                              </Box>
                            ) : googleChatMessages.length > 0 ? (
                              googleChatMessages.map((message) => (
                                <Box
                                  key={message.id}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 1,
                                    maxWidth: '100%',
                                  }}
                                >
                                  <Avatar
                                    sx={{
                                      width: 34,
                                      height: 34,
                                      bgcolor: getColorWithAlpha('#4285F4', 0.14),
                                      color: '#1d4ed8',
                                      fontSize: '0.8rem',
                                      fontWeight: 700,
                                      mt: 0.2,
                                    }}
                                  >
                                    {(message.sender?.displayName || message.sender?.name || message.senderId || '?').replace('users/', '').slice(0, 1).toUpperCase()}
                                  </Avatar>
                                  <Box
                                    sx={{
                                      flex: 1,
                                      minWidth: 0,
                                      p: 1.2,
                                      borderRadius: 3,
                                      border: `1px solid ${getColorWithAlpha(chatWidgetDesign.border, 0.74)}`,
                                      bgcolor: 'rgba(255,255,255,0.04)',
                                      boxShadow: `0 10px 24px ${getColorWithAlpha('#0f172a', 0.06)}`,
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.55 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                        {message.sender?.displayName || message.sender?.name || message.senderId}
                                      </Typography>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                                        <Typography variant="caption" color="text.secondary">
                                          {formatTime(message.timestamp)}
                                        </Typography>
                                        <Tooltip title="Slett melding i Google Chat">
                                          <span>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleDeleteGoogleChatMessage(message.id)}
                                              disabled={deleteGoogleChatMessage.isPending}
                                              sx={{ color: '#94a3b8' }}
                                              aria-label="Slett Google Chat-melding"
                                            >
                                              <DeleteOutline sx={{ fontSize: 15 }} />
                                            </IconButton>
                                          </span>
                                        </Tooltip>
                                      </Box>
                                    </Box>
                                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                                      {message.content || 'Tom melding'}
                                    </Typography>
                                  </Box>
                                </Box>
                              ))
                            ) : (
                              <Box
                                sx={{
                                  alignSelf: 'center',
                                  justifySelf: 'center',
                                  textAlign: 'center',
                                  maxWidth: 360,
                                  py: 2,
                                }}
                              >
                                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.45 }}>
                                  Rommet er klart
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Det finnes ingen meldinger ennå. Send første melding i composer-feltet under.
                                </Typography>
                              </Box>
                            )}
                          </Box>

                          <Box
                            sx={{
                              p: 1.5,
                              borderTop: `1px solid ${chatWidgetDesign.border}`,
                              bgcolor: 'rgba(255,255,255,0.04)',
                            }}
                          >
                            {renderPendingGoogleDriveAttachments()}
                            <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#1d4ed8', mb: 0.4 }}>
                              Svarer i {selectedGoogleSpacePreview?.name || 'Google Chat'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                              Meldingen sendes direkte til valgt Google Chat-rom.
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: isNarrowWorkspace ? 'column' : 'row',
                                alignItems: isNarrowWorkspace ? 'stretch' : 'flex-end',
                                gap: 1,
                              }}
                            >
                              <TextField
                                fullWidth
                                multiline
                                minRows={isNarrowWorkspace ? 3 : 2}
                                maxRows={5}
                                placeholder={`Skriv i ${selectedGoogleSpacePreview?.name || 'Google Chat'}...`}
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleQuickReply();
                                  }
                                }}
                                sx={{
                                  '& .MuiOutlinedInput-root': {
                                    borderRadius: 2.75,
                                    bgcolor: 'rgba(248,250,252,0.98)',
                                    alignItems: 'flex-start',
                                    '& fieldset': { borderColor: chatWidgetDesign.border },
                                    '&:hover fieldset': { borderColor: getColorWithAlpha('#4285F4', 0.5) },
                                    '&.Mui-focused fieldset': { borderColor: '#4285F4' }
                                  }
                                }}
                                InputProps={{
                                  startAdornment: (
                                    <InputAdornment position="start">
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, pt: 0.35 }}>
                                        <IconButton size="small" sx={{ color: '#64748b' }} onClick={() => openGoogleDriveAttachmentPicker()} aria-label="Legg ved fra Google Drive">
                                          <AttachFile sx={{ fontSize: 18 }} />
                                        </IconButton>
                                        <IconButton size="small" sx={{ color: '#64748b' }} onClick={handleGoogleMention} aria-label="Nevn noen i Google Chat">
                                          <AlternateEmail sx={{ fontSize: 18 }} />
                                        </IconButton>
                                      </Box>
                                    </InputAdornment>
                                  ),
                                }}
                              />
                              <Button
                                variant="contained"
                                endIcon={<Send />}
                                onClick={handleQuickReply}
                                disabled={(!messageInput.trim() && pendingGoogleDriveAttachments.length === 0) || sendGoogleChatMessage.isPending}
                                sx={{
                                  minWidth: isNarrowWorkspace ? '100%' : 140,
                                  height: isNarrowWorkspace ? 48 : 52,
                                  borderRadius: 2.75,
                                  bgcolor: '#4285F4',
                                  boxShadow: '0 12px 26px rgba(66,133,244,0.22)',
                                  '&:hover': { bgcolor: '#3367D6' }
                                }}
                              >
                                {sendGoogleChatMessage.isPending ? 'Sender...' : 'Send svar'}
                              </Button>
                            </Box>
                          </Box>
                        </>
                      )}
                    </Paper>
                  </Box>
                </Box>
              ) : activeTab === TAB_EMAIL ? (
                <Box sx={{ height: '100%', minHeight: 0 }}>
                  {isNarrowWorkspace ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.1, minHeight: 0, height: '100%' }}>
                      <Box sx={{ display: 'grid', gap: 1.1, minHeight: 0 }}>
                        {emailInboxNavigation}
                        {emailConversationList}
                      </Box>
                      {emailConversationPanel}
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: isMediumWorkspace
                          ? '72px minmax(320px, 360px) minmax(0, 1fr)'
                          : shouldShowEmailCrmRailPanel
                            ? '72px minmax(280px, 320px) minmax(300px, 360px) minmax(0, 1fr)'
                            : '72px minmax(210px, 240px) minmax(300px, 360px) minmax(0, 1fr)',
                        gap: 1.2,
                        minHeight: 0,
                        height: '100%',
                      }}
                    >
                      <Paper
                        elevation={0}
                        sx={{
                          ...(isWorkspacePanel ? {} : theming.getThemedCardSx()),
                          borderRadius: 4,
                          background: 'linear-gradient(180deg, #191919 0%, #111111 100%)',
                          color: 'white',
                          border: `1px solid ${getColorWithAlpha('#0f172a', 0.22)}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          py: 1.25,
                          px: 0.8,
                          boxShadow: '0 22px 38px rgba(15,23,42,0.18)',
                        }}
                      >
                        <Box sx={{ display: 'grid', gap: 0.85, justifyItems: 'center' }}>
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: 2,
                              display: 'grid',
                              placeItems: 'center',
                              bgcolor: '#2563eb',
                              boxShadow: '0 10px 22px rgba(37,99,235,0.32)',
                            }}
                          >
                            <Email sx={{ fontSize: 18, color: 'white' }} />
                          </Box>
                          {[
                            { icon: <Email sx={{ fontSize: 18 }} />, section: 'all', label: 'Alle tråder' },
                            { icon: <Reply sx={{ fontSize: 18 }} />, section: 'needs_reply', label: 'Klar for svar' },
                            { icon: <Notifications sx={{ fontSize: 18 }} />, section: 'unread', label: 'Uleste e-poster' },
                            { icon: <AttachFile sx={{ fontSize: 18 }} />, section: 'attachments', label: 'Med vedlegg' },
                            { icon: <Send sx={{ fontSize: 18 }} />, section: 'sent', label: 'Fulgte opp' },
                          ].map((item, index) => {
                            const active = emailInboxSection === item.section;
                            return (
                              <IconButton
                                key={`email-rail-${index}`}
                                size="small"
                                onClick={() => setEmailInboxSection(item.section as typeof emailInboxSection)}
                                aria-label={item.label}
                                sx={{
                                  color: active ? '#60a5fa' : 'rgba(255,255,255,0.82)',
                                  bgcolor: active ? 'rgba(37,99,235,0.16)' : 'transparent',
                                  borderRadius: 2,
                                  '&:hover': { bgcolor: active ? 'rgba(37,99,235,0.18)' : 'rgba(255,255,255,0.08)' },
                                }}
                              >
                                {item.icon}
                              </IconButton>
                            );
                          })}
                          <Tooltip title={emailContactPanelOpen ? 'Skjul CRM-system' : 'Åpne CRM-system'}>
                            <IconButton
                              size="small"
                              onClick={handleToggleEmailContactPanel}
                              aria-label={emailContactPanelOpen ? 'Skjul CRM-system' : 'Åpne CRM-system'}
                              sx={{
                                color: emailContactPanelOpen ? '#60a5fa' : 'rgba(255,255,255,0.82)',
                                bgcolor: emailContactPanelOpen ? 'rgba(37,99,235,0.16)' : 'transparent',
                                borderRadius: 2,
                                '&:hover': {
                                  bgcolor: emailContactPanelOpen ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.08)',
                                },
                              }}
                            >
                              <BadgeIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>

                        <Box sx={{ display: 'grid', gap: 0.85, justifyItems: 'center' }}>
                          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.82)' }} onClick={handleGoogleChatConnect} aria-label="Oppdater Gmail">
                            <Google sx={{ fontSize: 18 }} />
                          </IconButton>
                          <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.82)' }} onClick={handleOpenGoogleSettings} aria-label="Åpne chatinnstillinger">
                            <Settings sx={{ fontSize: 18 }} />
                          </IconButton>
                          <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(255,255,255,0.14)', color: 'white', fontWeight: 700 }}>
                            {(userEmail || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                        </Box>
                      </Paper>

                      <Box sx={{ gridColumn: '2', minHeight: 0 }}>
                        {isMediumWorkspace
                          ? (shouldShowEmailCrmRailPanel ? emailCrmRailPanel : emailConversationList)
                          : (shouldShowEmailCrmRailPanel ? emailCrmRailPanel : emailInboxNavigation)}
                      </Box>
                      {!isMediumWorkspace && (
                        <Box sx={{ gridColumn: '3', minHeight: 0 }}>
                          {emailConversationList}
                        </Box>
                      )}
                      <Box sx={{ gridColumn: isMediumWorkspace ? '3' : '4', minHeight: 0 }}>
                        {emailConversationPanel}
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : activeTab === TAB_FEEDBACK ? (
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
                      <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))', gap: 1 }}>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'rgba(33,150,243,0.08)', border: '1px solid #bfdbfe', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="primary" sx={{ color: theming.colors.primary }}>{feedbackStats.open}</Typography>
                          <Typography variant="caption">Åpne</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'rgba(255,186,108,0.08)', border: '1px solid #fed7aa', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="warning.main" sx={{ color: theming.colors.primary }}>{feedbackStats.in_progress}</Typography>
                          <Typography variant="caption">Pågår</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#e8f5e8', border: '1px solid #bbf7d0', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>{feedbackStats.resolved}</Typography>
                          <Typography variant="caption">Løst</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: '#dcfce7', border: '1px solid #86efac', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="success.main" sx={{ color: theming.colors.primary }}>{feedbackStats.verified}</Typography>
                          <Typography variant="caption">✅ Verifisert</Typography>
                        </Paper>
                        <Paper sx={{ p: 1, textAlign: 'center', bgcolor: 'rgba(244,67,54,0.10)', border: '1px solid rgba(244,67,54,0.24)', ...theming.getThemedCardSx() }}>
                          <Typography variant="h6" color="error.main" sx={{ color: theming.colors.primary }}>{feedbackStats.failed}</Typography>
                          <Typography variant="caption">❌ Feilet</Typography>
                        </Paper>
                      </Box>

                      {/* Feedback List */}
                      <List sx={{ p: 0, display: 'grid', gap: 0.8 }}>
                        {feedbackList.map((feedback: FeedbackItem) => (
                          <ListItem 
                            key={feedback.id}
                            sx={{
                              border: `1px solid ${getColorWithAlpha(getFeedbackStatusColor(feedback.status), 0.26)}`,
                              borderRadius: 2,
                              bgcolor: 'rgba(255,255,255,0.04)',
                              cursor: 'pointer',
                              transition: 'all 140ms ease',
                              '&:hover': {
                                bgcolor: getColorWithAlpha(getFeedbackStatusColor(feedback.status), 0.1),
                                transform: 'translateY(-1px)'
                          }
                        }}
                            onClick={() => openFeedbackDetailDialog(feedback)}
                          >
                            <ListItemText
                              disableTypography
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
                                sx={{ '&:hover': { bgcolor: getColorWithAlpha(getFeedbackStatusColor(feedback.status), 0.12) } }}
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
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                          <BugReport sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            Ingen feedback ennå
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              ) : activeTab === TAB_EVENDI ? (
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
                                bgcolor: msg.sender_type === 'vendor' ? '#E91E63' : 'rgba(255,255,255,0.04)',
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
                      <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(233,30,99,0.12)', borderRadius: 2, border: '1px solid #E91E6330' }}>
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
                          <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                            {evendiDeliveries.filter((d: any) => !d.chat_notified).map((d: any) => (
                              <Box
                                key={d.id}
                                sx={{
                                  p: 1, mb: 0.5, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 1, cursor: 'pointer',
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
                                disableTypography
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
              ) : (
                // Academy Tab
                <Box sx={{ p: 2.25 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.25,
                      borderRadius: 2,
                      border: `1px solid ${chatWidgetDesign.border}`,
                      bgcolor: 'rgba(255,255,255,0.04)',
                      ...theming.getThemedCardSx(),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.25, mb: 1.5 }}>
                      <img
                        src="/creatorhub-academy-logo.svg"
                        alt="CreatorHub Academy"
                        style={{ height: 32, width: 'auto' }}
                      />
                      <Chip
                        label="Academy"
                        size="small"
                        sx={{
                          bgcolor: getColorWithAlpha(getProfessionColor(), 0.14),
                          color: getProfessionColor(),
                          fontWeight: 700,
                        }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Egen Academy-fane med snarveier til kurs, dashboard og analyse.
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      {academyQuickLinks.map((link) => (
                        <Button
                          key={link.id}
                          variant="outlined"
                          fullWidth
                          startIcon={link.icon}
                          onClick={() => handleOpenAcademyPath(link.path)}
                          sx={{
                            justifyContent: 'flex-start',
                            textTransform: 'none',
                            borderColor: getColorWithAlpha(getProfessionColor(), 0.45),
                            color: 'text.primary',
                            py: 1.05,
                            '&:hover': {
                              borderColor: getProfessionColor(),
                              bgcolor: getColorWithAlpha(getProfessionColor(), 0.08),
                            },
                          }}
                        >
                          <Box sx={{ textAlign: 'left' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {link.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {link.description}
                            </Typography>
                          </Box>
                        </Button>
                      ))}
                    </Box>
                  </Paper>
                </Box>
              )}
            </Box>

            {/* Quick Reply */}
            {!isWorkspacePanel && ((activeTab === TAB_GOOGLE_CHAT ? selectedGoogleSpace : activeTab === TAB_EMAIL ? selectedEmailThread : selectedChat) && activeTab !== TAB_ACADEMY && activeTab !== TAB_GOOGLE_CHAT && activeTab !== TAB_CREATORHUB && activeTab !== TAB_EMAIL) && (
              <Box sx={{
                p: 1.5,
                borderTop: `1px solid ${chatWidgetDesign.border}`,
                bgcolor: 'rgba(255,255,255,0.04)'
              }}>
                {activeTab === TAB_CREATORHUB ? (
                  <QuickMessageTemplates
                    onSelectTemplate={(msg) => setMessageInput(msg)}
                    profession={profession}
                    storageKey={`quick-msg-universal-${user?.id || 'anon'}`}
                    compact
                    overlayZIndexBase={workspaceOverlayZIndex.dialog}
                  />
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      mb: 1,
                      px: 0.25,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#1d4ed8' }} noWrap>
                        Svarer i {selectedGoogleSpacePreview?.name || 'Google Chat'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        Meldingen sendes direkte til valgt Google Chat-rom.
                      </Typography>
                    </Box>
                    {selectedGoogleSpacePreview?.spaceUri ? (
                      <Tooltip title="Åpne rommet i Google Chat">
                        <IconButton
                          size="small"
                          onClick={() => window.open(selectedGoogleSpacePreview.spaceUri!, '_blank', 'noopener,noreferrer')}
                          sx={{
                            color: '#1d4ed8',
                            border: `1px solid ${getColorWithAlpha('#4285F4', 0.22)}`,
                            '&:hover': { bgcolor: getColorWithAlpha('#4285F4', 0.08) }
                          }}
                        >
                          <OpenInNew sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </Box>
                )}
                {renderPendingGoogleDriveAttachments({ compact: true })}
                <TextField
                  fullWidth
                  size="small"
                  placeholder={
                    activeTab === TAB_GOOGLE_CHAT
                      ? `Skriv i ${selectedGoogleSpacePreview?.name || 'Google Chat'}...`
                      : 'Skriv et raskt svar...'
                  }
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    if (activeTab === TAB_CREATORHUB) {
                      handleTyping();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleQuickReply();
                }
              }}
                  sx={{
                    mt: 1,
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'rgba(248,250,252,0.98)',
                      borderRadius: 2.5,
                      '& fieldset': { borderColor: chatWidgetDesign.border },
                      '&:hover fieldset': { borderColor: getColorWithAlpha(getProfessionColor(), 0.6) },
                      '&.Mui-focused fieldset': { borderColor: getProfessionColor() }
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                          <IconButton
                            size="small"
                            onClick={() => openGoogleDriveAttachmentPicker({ imagesOnly: false })}
                            sx={{ color: '#94a3b8' }}
                          >
                            <AttachFile sx={{ fontSize: 16 }} />
                          </IconButton>
                          {activeTab === TAB_GOOGLE_CHAT && (
                            <IconButton
                              size="small"
                              onClick={handleGoogleMention}
                              sx={{ color: '#94a3b8' }}
                            >
                              <AlternateEmail sx={{ fontSize: 16 }} />
                            </IconButton>
                          )}
                        </Box>
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title="Opprett tilbud">
                          <span>
                            <IconButton
                              size="small"
                              onClick={handleOpenQuoteModal}
                              disabled={activeTab !== TAB_CREATORHUB}
                              sx={{
                                mr: 0.5,
                                color: getProfessionColor(),
                                '&:hover': { bgcolor: getColorWithAlpha(getProfessionColor(), 0.12) },
                                '&:disabled': { color: 'grey.400' },
                              }}
                            >
                              <RequestQuote sx={{ fontSize: 16 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <IconButton
                          size="small"
                          onClick={handleQuickReply}
                          disabled={(!messageInput.trim() && pendingGoogleDriveAttachments.length === 0) || isQuickReplyPending}
                          sx={{
                            bgcolor: getProfessionColor(),
                            color: 'white',
                            boxShadow: `0 8px 18px ${getColorWithAlpha(getProfessionColor(), 0.32)}`,
                            '&:hover': { bgcolor: getProfessionColor(), filter: 'brightness(0.96)' },
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

            {!isWorkspacePanel && (
              <>
                <Divider sx={{ borderColor: chatWidgetDesign.border }} />
                {/* WebSocket connection status */}
                <Box sx={{
                  px: 2,
                  py: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: wsConnection.isConnected ? '#e8f5e9' : 'rgba(255,152,0,0.12)',
                  borderTop: `1px solid ${chatWidgetDesign.border}`
                }}>
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
                      <IconButton
                        size="small"
                        sx={{ '&:hover': { bgcolor: getColorWithAlpha(getProfessionColor(), 0.14) } }}
                        onClick={(e) => setAnchorEl(e.currentTarget)}
                      >
                        <MoreVert sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Lukk">
                      <IconButton
                        size="small"
                        sx={{ '&:hover': { bgcolor: getColorWithAlpha('#ef4444', 0.14) } }}
                        onClick={handleCloseWidget}
                      >
                        <Close sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <Box sx={{ p: 1.25, position: 'relative', bgcolor: 'rgba(255,255,255,0.04)' }}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleOpenFullscreen}
                    startIcon={<OpenInNew fontSize="small" />}
                    sx={{
                      mb: 1,
                      bgcolor: getProfessionColor(),
                      color: 'white',
                      textTransform: 'none',
                      borderRadius: 2,
                      fontWeight: 700,
                      boxShadow: `0 12px 24px ${getColorWithAlpha(getProfessionColor(), 0.22)}`,
                      '&:hover': {
                        bgcolor: getProfessionColor(),
                        filter: 'brightness(0.95)',
                      },
                    }}
                  >
                    Åpne full chat
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => {
                      setActiveTab(TAB_CREATORHUB);
                      if (!selectedChat && chatPreviews[0]?.id) {
                        setSelectedChat(chatPreviews[0].id);
                      }
                      setInternalContactPanelOpen(true);
                    }}
                    sx={{
                      color: getProfessionColor(),
                      textTransform: 'none',
                      borderColor: chatWidgetDesign.border,
                      borderRadius: 2,
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: getProfessionColor(),
                        bgcolor: getColorWithAlpha(getProfessionColor(), 0.09)
                      }
                    }}
                  >
                    Åpne CRM-system
                  </Button>
                  <Button
                    fullWidth
                    variant="text"
                    onClick={handleCloseWidget}
                    sx={{
                      mt: 0.75,
                      color: '#64748b',
                      textTransform: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Lukk
                  </Button>
                </Box>
              </>
            )}
              </>
            )}
          </Paper>
        </Box>
      )}

      {/* Options Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        sx={{ zIndex: workspaceOverlayZIndex.menu }}
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            boxShadow: '0 22px 48px rgba(15, 23, 42, 0.18)',
          },
        }}
      >
        <MenuItem onClick={() => {
          setActiveTab(TAB_CREATORHUB);
          if (!selectedChat && chatPreviews[0]?.id) {
            setSelectedChat(chatPreviews[0].id);
          }
          setInternalContactPanelOpen((current) => !current);
          setAnchorEl(null);
        }}>
          <BadgeIcon sx={{ mr: 1 }} />
          {internalContactPanelOpen ? 'Skjul CRM-system' : 'Vis CRM-system'}
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
        <MenuItem onClick={() => {
          setActiveTab(TAB_GOOGLE_CHAT);
          setChatSettingsOpen(true);
          setAnchorEl(null);
        }}>
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
        sx={{ zIndex: workspaceOverlayZIndex.menu }}
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            boxShadow: '0 22px 48px rgba(15, 23, 42, 0.18)',
          },
        }}
      >
        <MenuItem onClick={handleCreateGoogleChatRoom}>
          <Add sx={{ mr:  1 }} />
          Opprett nytt Chat-rom
        </MenuItem>
        <MenuItem onClick={handleGoogleMention}>
          <AlternateEmail sx={{ mr:  1 }} />
          @nevn noen
        </MenuItem>
        <MenuItem onClick={async () => {
          await testGoogleChat();
          setSnackbarMessage('✅ Google Chat API test fullført');
          setSnackbarOpen(true);
          setGoogleChatMenuAnchor(null);
    }}>
          <Speed sx={{ mr:  1 }} />
          Test Google Chat API
          <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.7}}>
            {communicationStatus.googleChatStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleOpenGoogleSettings}>
          <Settings sx={{ mr:  1 }} />
          Google Chat-innstillinger
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={mobileTabMenuAnchor}
        open={Boolean(mobileTabMenuAnchor)}
        onClose={() => setMobileTabMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        sx={{ zIndex: workspaceOverlayZIndex.menu }}
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            boxShadow: '0 22px 48px rgba(15, 23, 42, 0.18)',
          },
        }}
      >
        <MenuItem onClick={() => handleMobileTabChange(TAB_CREATORHUB)}>
          <Chat sx={{ mr: 1 }} />
          CreatorHub
        </MenuItem>
        {activeTab === TAB_CREATORHUB && selectedChatPreview && (
          <MenuItem onClick={() => {
            handleToggleInternalContactPanel();
            setMobileTabMenuAnchor(null);
          }}>
            <Person sx={{ mr: 1 }} />
            {internalContactPanelOpen ? 'Skjul CRM-system' : 'Vis CRM-system'}
          </MenuItem>
        )}
        <MenuItem onClick={() => handleMobileTabChange(TAB_GOOGLE_CHAT)}>
          <Google sx={{ mr: 1 }} />
          Google Chat
        </MenuItem>
        <MenuItem onClick={() => handleMobileTabChange(TAB_EMAIL)}>
          <Email sx={{ mr: 1 }} />
          E-post
        </MenuItem>
        <MenuItem onClick={() => handleMobileTabChange(TAB_FEEDBACK)}>
          <BugReport sx={{ mr: 1 }} />
          Feedback
        </MenuItem>
        <MenuItem onClick={() => handleMobileTabChange(TAB_EVENDI)}>
          <img src="/evendi-logo.png" alt="" style={{ width: 18, height: 18, borderRadius: '50%', marginRight: 8 }} />
          Evendi
        </MenuItem>
        <MenuItem onClick={() => handleMobileTabChange(TAB_ACADEMY)}>
          <img src="/academy-favicon.svg" alt="" style={{ width: 18, height: 18, marginRight: 8 }} />
          Academy
        </MenuItem>
      </Menu>

      <Dialog
        open={Boolean(internalActionPanelContent) && activeTab === TAB_CREATORHUB && shouldShowInternalActionDialog}
        onClose={() => setInternalContactPanelOpen(false)}
        fullWidth
        maxWidth="sm"
        sx={{ zIndex: workspaceOverlayZIndex.dialog }}
        PaperProps={{
          sx: {
            borderRadius: isCompactViewport ? 3 : 3.5,
            overflow: 'hidden',
            ...((isCompactViewport || !isWorkspacePanel) ? {} : {
              position: 'fixed',
              top: 40,
              right: 24,
              bottom: 24,
              m: 0,
              width: 'min(420px, calc(100vw - 48px))',
              maxWidth: 'min(420px, calc(100vw - 48px))',
              height: 'auto',
            }),
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: `1px solid ${workspaceCardBorder}`,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              CRM og kontaktflyt
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Kontaktinfo, neste steg og handlinger for valgt samtale.
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setInternalContactPanelOpen(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 1.2,
            bgcolor: 'rgba(20,16,11,0.6)',
            minHeight: 0,
          }}
        >
          {internalActionPanelContent}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(emailActionPanelContent) && activeTab === TAB_EMAIL && shouldShowEmailActionDialog}
        onClose={() => setEmailContactPanelOpen(false)}
        fullWidth
        maxWidth="sm"
        sx={{ zIndex: workspaceOverlayZIndex.dialog }}
        PaperProps={{
          sx: {
            borderRadius: isCompactViewport ? 3 : 3.5,
            overflow: 'hidden',
            ...((isCompactViewport || !isWorkspacePanel) ? {} : {
              position: 'fixed',
              top: 40,
              right: 24,
              bottom: 24,
              m: 0,
              width: 'min(420px, calc(100vw - 48px))',
              maxWidth: 'min(420px, calc(100vw - 48px))',
              height: 'auto',
            }),
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: `1px solid ${workspaceCardBorder}`,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              CRM og e-postflyt
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Kontaktinfo, tilbud og oppfølging for valgt e-posttråd.
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setEmailContactPanelOpen(false)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 1.2,
            bgcolor: 'rgba(20,16,11,0.6)',
            minHeight: 0,
          }}
        >
          {emailActionPanelContent}
        </DialogContent>
      </Dialog>

      <Popover
        open={Boolean(emojiPickerAnchor)}
        anchorEl={emojiPickerAnchor}
        onClose={handleCloseEmojiPicker}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          zIndex: workspaceOverlayZIndex.popover,
        }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(15, 23, 42, 0.22)',
            },
          },
        }}
      >
        <Picker
          data={data}
          onEmojiSelect={handleEmojiSelect}
          theme="light"
          locale="nb"
          previewPosition="none"
          skinTonePosition="none"
        />
      </Popover>

      <GoogleDriveAttachmentPicker
        open={googleDriveAttachmentPickerOpen}
        onClose={() => setGoogleDriveAttachmentPickerOpen(false)}
        onSelect={handleGoogleDriveAttachmentsSelected}
        allowMultiple
        onlyImages={googleDriveAttachmentPickerImagesOnly}
        zIndex={workspaceOverlayZIndex.dialog}
        conversationId={activeTab === TAB_GOOGLE_CHAT ? selectedGoogleSpace : activeTab === TAB_EMAIL ? selectedEmailThread : selectedChat}
        conversationName={activeTab === TAB_GOOGLE_CHAT ? selectedGoogleSpacePreview?.name : activeTab === TAB_EMAIL ? selectedEmailThreadPreview?.subject : selectedChatPreview?.name}
        customerId={activeTab === TAB_EMAIL ? emailCrmConversationContext?.customer?.id || null : quoteClientData.crmCustomerId || crmConversationContext?.customer?.id || null}
        customerName={activeTab === TAB_EMAIL ? selectedEmailThreadPreview?.counterpartName || quoteClientData.name : quoteClientData.name}
        companyName={(activeTab === TAB_EMAIL ? emailCrmConversationContext?.customer?.company : crmConversationContext?.customer?.company) || getRecordString(selectedClientContext, ['company', 'companyName', 'businessName']) || null}
        projectId={quoteClientData.projectId || null}
        projectName={quoteClientData.projectName || null}
        recipientEmail={activeTab === TAB_EMAIL ? selectedEmailThreadPreview?.counterpartEmail || null : selectedConversationHintEmail || quoteClientData.email || null}
        profession={profession}
        activeChannel={activeTab === TAB_GOOGLE_CHAT ? 'google-chat' : activeTab === TAB_EMAIL ? 'email' : 'internal-chat'}
      />

      {/* Ticket Creation Dialog */}
      <Dialog 
        open={ticketDialogOpen} 
        onClose={() => setTicketDialogOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{ zIndex: workspaceOverlayZIndex.dialog }}
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
                    MenuProps={workspaceSelectMenuProps}
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
                    MenuProps={workspaceSelectMenuProps}
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

      <QuoteCreationModal
        open={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        modalZIndex={workspaceOverlayZIndex.dialog}
        clientData={quoteClientData}
        onQuoteCreated={(quoteData) => {
          void handleQuoteCreatedFromChat(quoteData);
        }}
      />

      {/* Success/Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        sx={{ zIndex: workspaceOverlayZIndex.snackbar }}
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
        sx={{ zIndex: workspaceOverlayZIndex.dialog }}
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
                    MenuProps={workspaceSelectMenuProps}
                  >
                    <MenuItem value="open">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50%', bgcolor: '#2196f3'}} />
                        Åpen
                      </Box>
                    </MenuItem>
                    <MenuItem value="in_progress">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50%', bgcolor: '#ff9800'}} />
                        Pågår
                      </Box>
                    </MenuItem>
                    <MenuItem value="resolved">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50%', bgcolor: '#4caf50'}} />
                        Løst
                      </Box>
                    </MenuItem>
                    <MenuItem value="closed">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50%', bgcolor: '#757575'}} />
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
                    MenuProps={workspaceSelectMenuProps}
                  >
                    <MenuItem value="low">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50%', bgcolor: '#4caf50'}} />
                        Lav
                      </Box>
                    </MenuItem>
                    <MenuItem value="medium">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50%', bgcolor: '#ff9800'}} />
                        Medium
                      </Box>
                    </MenuItem>
                    <MenuItem value="high">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50%', bgcolor: '#f44336'}} />
                        Høy
                      </Box>
                    </MenuItem>
                    <MenuItem value="critical">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width:  12, height:  12, borderRadius: '50%', bgcolor: '#9c27b0'}} />
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
        sx={{ zIndex: workspaceOverlayZIndex.dialog }}
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
                <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)', ...theming.getThemedCardSx() }}>
                  <Typography variant="subtitle2" gutterBottom>Status</Typography>
                  <Chip
                    label={selectedFeedback.status}
                    sx={{
                      bgcolor: getFeedbackStatusColor(selectedFeedback.status),
                      color: 'white'
                    }}
                  />
                </Paper>
                <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)', ...theming.getThemedCardSx() }}>
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
                  <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.04)', ...theming.getThemedCardSx() }}>
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
                <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(156,39,176,0.10)', borderRadius: 1, border: '1px solid rgba(156,39,176,0.40)' }}>
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
                    <Paper key={fix.id} sx={{ p: 2, mb: 2, bgcolor: 'rgba(255,255,255,0.04)', ...theming.getThemedCardSx() }}>
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
        sx={{ zIndex: workspaceOverlayZIndex.dialog }}
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
      {!isOpen && (
        <Fab
          color="primary"
          aria-label="Åpne chat"
          onClick={() => { setIsOpen(true); setIsExpanded(true); }}
          sx={{
            position: 'fixed',
            bottom: isCompactViewport ? 16 : 24,
            left: isCompactViewport ? 16 : 24,
            width: 60,
            height: 60,
            bgcolor: professionColor,
            border: '3px solid rgba(255,255,255,0.75)',
            boxShadow: `0 16px 36px ${getColorWithAlpha(professionColor, 0.42)}`,
            '&:hover': {
              bgcolor: professionColor,
              filter: 'brightness(0.95)',
              transform: 'translateY(-1px)'
            },
            zIndex: Math.max(1000, layerZIndex - 100),
          }}
        >
          <Chat />
        </Fab>
      )}
      </>
    </ChatWidgetErrorBoundary>
  );
}
