/**
 * CreatorHub Norge Community - Main Page
 * 
 * Full-featured community interface with:
 * - Group/channel navigation
 * - Real-time messaging
 * - User profiles and badges
 * - Pattern sharing
 * - Feature-gated channels
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  TextField,
  IconButton,
  Avatar,
  Chip,
  Badge,
  Divider,
  Menu,
  MenuItem,
  Tooltip,
  Card,
  CardContent,
  Button,
  Stack,
  Drawer,
  useMediaQuery,
  useTheme,
  InputAdornment,
  CircularProgress,
  Popover,
  Dialog,
  DialogTitle,
  DialogContent,
  CardMedia,
  Alert,
  Switch,
  Tabs,
  Tab,
  Grid,
  ImageList,
  ImageListItem,
} from '@mui/material';
// CreatorHub Logo Icon Component
const CreatorHubLogoIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    viewBox="0 0 40 40"
    width={size}
    height={size}
    style={{ display: 'block' }}
  >
    <defs>
      <linearGradient id="communityPageLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
    </defs>
    {/* Background circle */}
    <circle cx="20" cy="20" r="18" fill="url(#communityPageLogoGrad)" />
    {/* Creative Tools Icon */}
    <g transform="translate(8, 8)">
      {/* Central Pencil */}
      <path d="M12 4 L12 18 L10 20 L8 18 L8 16 L6 16 L6 6 L8 4 Z" fill="white" opacity="0.95"/>
      <polygon points="8,4 10,2 12,4" fill="rgba(255,255,255,0.7)"/>
      {/* Camera - top right */}
      <circle cx="18" cy="7" r="3" fill="white" opacity="0.9"/>
      <rect x="17" y="6" width="2" height="2" rx="0.3" fill="url(#communityPageLogoGrad)"/>
      <line x1="12" y1="8" x2="15" y2="7" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Video - top left */}
      <polygon points="5,7 2,5 2,9" fill="white" opacity="0.9"/>
      <line x1="8" y1="8" x2="5" y2="7" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Music - bottom right */}
      <circle cx="18" cy="17" r="2" fill="white" opacity="0.9"/>
      <rect x="18" y="14" width="1" height="3" fill="white" opacity="0.9"/>
      <line x1="12" y1="15" x2="16" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8"/>
      {/* Palette - bottom left */}
      <circle cx="5" cy="17" r="3" fill="white" opacity="0.9"/>
      <circle cx="4" cy="16" r="0.8" fill="url(#communityPageLogoGrad)"/>
      <circle cx="6" cy="16" r="0.8" fill="#f59e0b"/>
      <circle cx="5" cy="18" r="0.8" fill="#ea580c"/>
      <line x1="8" y1="15" x2="8" y2="17" stroke="white" strokeWidth="1.2" opacity="0.8"/>
    </g>
  </svg>
);

import {
  Send,
  AttachFile,
  EmojiEmotions,
  MoreVert,
  GifBox,
  Face,
  Search,
  Menu as MenuIcon,
  Lock,
  Star,
  Favorite,
  Reply,
  Tag,
  Lightbulb,
  Group,
  Announcement,
  Forum,
  TrendingUp,
  Close,
  Report,
  Edit,
  Delete,
  PushPin,
  CheckCircle,
  Bookmark,
  Search as SearchIcon,
  HelpOutline,
  School,
  Dashboard as DashboardIcon,
  ArrowBack,
  AccessTime,
  AttachMoney,
  Visibility,
  TouchApp,
  Notifications,
  Settings,
  HowToVote,
  PhotoCamera,
  VideoLibrary,
  LibraryMusic,
  Business,
  Palette,
  WorkspacePremium,
  AutoAwesome,
  Celebration,
  ThumbUp,
  LocalFireDepartment,
  Emergency,
} from '@mui/icons-material';
import { getCourseCategoryIcon, getCourseLevelIcon } from '@/utils/profession-icons';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import ReportDialog from './ReportDialog';
import { CommunityFileAttachment, CommunityFileDisplay } from './CommunityFileAttachment';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { GdprNotice } from '@/components/common/GdprNotice';
import CommunitySettingsSidebar from './CommunitySettingsSidebar';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../shared/PushNotificationSettings';
import ThreadViewDialog from './ThreadViewDialog';
import PinnedMessagesBar from './PinnedMessagesBar';
import UserProfileModal from './UserProfileModal';
import AdvancedSearchDialog from './AdvancedSearchDialog';
import BadgeNotification from './BadgeNotification';
import UnansweredQuestionsWidget from './UnansweredQuestionsWidget';
import WelcomeOnboardingDialog from './WelcomeOnboardingDialog';
import MentorDashboard from './MentorDashboard';
import CommunityNotificationFeed from './CommunityNotificationFeed';
import BecomeMentorDialog from './BecomeMentorDialog';
import VotingBoard from './VotingBoard';
import PublishToCommunityDialog from '../academy/PublishToCommunityDialog';
import EditPostDialog from '../academy/EditPostDialog';
import ScheduledPostsWidget from '../academy/ScheduledPostsWidget';
import CoursePostAnalyticsDialog from './CoursePostAnalyticsDialog';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import PrototypeFeedbackTool from '../feedback/PrototypeFeedbackTool';
import { useAuth } from '@/hooks/useAuth';
import { CommunityTutorial, useCommunityTutorial } from './CommunityTutorial';

interface CommunityGroup {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  profession_type: string;
  is_active: boolean;
  member_count: number;
}

interface CommunityChannel {
  id: string;
  group_id: string;
  name: string;
  display_name: string;
  description: string;
  channel_type: string;
  is_default: boolean;
  requires_feature: string | null;
  requires_subscription_tier: string | null;
  is_read_only: boolean;
  position: number;
  unread_count?: number;
}

interface CommunityMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  message_type: string;
  attachments: any[];
  reactions: Record<string, string[]>;
  reply_to_id: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_avatar: string | null;
  user_badges: string[];
  is_edited?: boolean;
  is_solution?: boolean;
  thread_count?: number;
  parent_message_id?: string | null;
  is_pinned?: boolean;
}

interface UserBadge {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  rarity: string;
}

interface CommunityPageProps {
  userId: string;
  profession: string;
}

// Helper function to get group icon component - matches landing-desktop.tsx theming
const getGroupIcon = (iconString: string, groupName: string) => {
  const nameLower = groupName.toLowerCase();
  
  // Fotograf - PhotoCamera, grønn (#2e7d32)
  if (iconString === '📸' || nameLower.includes('fotograf') || nameLower.includes('photographer')) {
    return (
      <Box
        sx={{
          width: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          height: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          borderRadius: { xs: '10px', sm: '12px', md: '14px' },
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
        }}
      >
        <PhotoCamera sx={{ color: 'white', fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} />
      </Box>
    );
  }
  
  // Videograf - VideoLibrary, blå (#1565c0)
  if (iconString === '🎥' || nameLower.includes('video') || nameLower.includes('videograf')) {
    return (
      <Box
        sx={{
          width: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          height: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          borderRadius: { xs: '10px', sm: '12px', md: '14px' },
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
        }}
      >
        <VideoLibrary sx={{ color: 'white', fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} />
      </Box>
    );
  }
  
  // Musikkprodusent - LibraryMusic, lilla (#7b1fa2)
  if (iconString === '🎵' || iconString === '🎶' || nameLower.includes('musikk') || nameLower.includes('music') || nameLower.includes('produsent') || nameLower.includes('producer')) {
    return (
      <Box
        sx={{
          width: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          height: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          borderRadius: { xs: '10px', sm: '12px', md: '14px' },
          background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(168,85,247,0.3)',
        }}
      >
        <LibraryMusic sx={{ color: 'white', fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} />
      </Box>
    );
  }
  
  // Leverandør/Vendor - Business, oransje (#ff8c00)
  if (nameLower.includes('leverandør') || nameLower.includes('vendor') || nameLower.includes('leverandor')) {
    return (
      <Box
        sx={{
          width: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          height: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          borderRadius: { xs: '10px', sm: '12px', md: '14px' },
          background: 'linear-gradient(135deg, #ff8c00 0%, #f59e0b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(255,140,0,0.3)',
        }}
      >
        <Business sx={{ color: 'white', fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} />
      </Box>
    );
  }
  
  // Designere - Palette, beholder amber for design
  if (iconString === '🎨' || nameLower.includes('design')) {
    return (
      <Box
        sx={{
          width: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          height: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
          borderRadius: { xs: '10px', sm: '12px', md: '14px' },
          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
        }}
      >
        <Palette sx={{ color: 'white', fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} />
      </Box>
    );
  }
  
  // Default icon - Group, amber
  return (
    <Box
      sx={{
        width: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
        height: { xs: 40, sm: 44, md: 48, lg: 52, xl: 56 },
        borderRadius: { xs: '10px', sm: '12px', md: '14px' },
        background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
      }}
    >
      <Group sx={{ color: 'white', fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} />
    </Box>
  );
};

// Mock data for preview mode
const getMockData = () => {

  const mockGroups: CommunityGroup[] = [
    {
      id: 'mock-group-1',
      name: 'Fotograf',
      icon: '📸', // Keep for backward compatibility, but will be replaced with icon
      description: 'Fellesskap for norske fotografer',
      member_count: 1247,
      position: 1,
    },
    {
      id: 'mock-group-2',
      name: 'Videografer',
      icon: '🎥', // Keep for backward compatibility, but will be replaced with icon
      description: 'Video og filmproduksjon',
      member_count: 856,
      position: 2,
    },
    {
      id: 'mock-group-3',
      name: 'Designere',
      icon: '🎨', // Keep for backward compatibility, but will be replaced with icon
      description: 'Grafisk design og kreativitet',
      member_count: 634,
      position: 3,
    },
  ];

  const mockChannels: CommunityChannel[] = [
    {
      id: 'mock-channel-1',
      group_id: 'mock-group-1',
      display_name: 'generelt',
      description: 'Generelle diskusjoner og spørsmål',
      is_read_only: false,
      requires_feature: false,
      is_default: true,
      position: 1,
      unread_count: 3,
    },
    {
      id: 'mock-channel-2',
      group_id: 'mock-group-1',
      display_name: 'tekniske-spørsmål',
      description: 'Tekniske spørsmål om fotografering',
      is_read_only: false,
      requires_feature: false,
      is_default: true,
      position: 2,
      unread_count: 0,
    },
    {
      id: 'mock-channel-3',
      group_id: 'mock-group-1',
      display_name: 'showcase',
      description: 'Del dine beste bilder',
      is_read_only: false,
      requires_feature: false,
      is_default: true,
      position: 3,
      unread_count: 12,
    },
    {
      id: 'mock-channel-4',
      group_id: 'mock-group-1',
      display_name: 'mentor-støtte',
      description: 'Få hjelp fra erfarne mentorer',
      is_read_only: false,
      requires_feature: false,
      is_default: true,
      position: 4,
      unread_count: 0,
    },
  ];

  const mockMessages: CommunityMessage[] = [
    {
      id: 'mock-msg-1',
      channel_id: 'mock-channel-1',
      user_id: 'mock-user-1',
      content: 'Hei alle sammen! Velkommen til CreatorHub Norge community. Dette er et sted hvor vi kan dele erfaringer, stille spørsmål og lære av hverandre.',
      message_type: 'text',
      attachments: [],
      reactions: { '👍': ['mock-user-2', 'mock-user-3'], '❤️': ['mock-user-4'] },
      reply_to_id: null,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      user_name: 'Ola Nordmann',
      user_avatar: null,
      user_badges: ['early-adopter'],
      is_edited: false,
      is_solution: false,
      thread_count: 5,
      parent_message_id: null,
      is_pinned: true,
    },
    {
      id: 'mock-msg-2',
      channel_id: 'mock-channel-1',
      user_id: 'mock-user-2',
      content: 'Tusen takk! Jeg har allerede lært så mye her. Spesielt tipsene om lyssetting har vært uvurderlige!',
      message_type: 'text',
      attachments: [],
      reactions: { '👍': ['mock-user-1', 'preview-user'] },
      reply_to_id: null,
      created_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
      user_name: 'Kari Hansen',
      user_avatar: null,
      user_badges: [],
      is_edited: false,
      is_solution: false,
      thread_count: 0,
      parent_message_id: null,
      is_pinned: false,
    },
    {
      id: 'mock-msg-3',
      channel_id: 'mock-channel-1',
      user_id: 'mock-user-3',
      content: 'Noen som har tips til beste kamera-innstillinger for portrettfotografering? Jeg sliter litt med å få riktig dybdeskarphet.',
      message_type: 'text',
      attachments: [],
      reactions: {},
      reply_to_id: null,
      created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      user_name: 'Erik Johansen',
      user_avatar: null,
      user_badges: [],
      is_edited: false,
      is_solution: false,
      thread_count: 3,
      parent_message_id: null,
      is_pinned: false,
    },
    {
      id: 'mock-msg-4',
      channel_id: 'mock-channel-1',
      user_id: 'mock-user-4',
      content: 'For portrettfotografering anbefaler jeg å bruke f/2.8 eller lavere for å få en fin bokeh-effekt. ISO bør holdes lavt (100-400) for best kvalitet, og shutter speed bør være minst 1/125 for å unngå bevegelsesuskarphet.',
      message_type: 'text',
      attachments: [],
      reactions: { '👍': ['mock-user-3', 'mock-user-5'], '❤️': ['mock-user-3'] },
      reply_to_id: 'mock-msg-3',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      user_name: 'Mentor Maria',
      user_avatar: null,
      user_badges: ['mentor', 'expert'],
      is_solution: true,
      thread_count: 0,
      parent_message_id: 'mock-msg-3',
      is_pinned: false,
    },
    {
      id: 'mock-msg-5',
      channel_id: 'mock-channel-3',
      user_id: 'mock-user-5',
      content: 'Sjekk ut dette bildet jeg tok i går!',
      message_type: 'showcase',
      attachments: [
        {
          type: 'image',
          url: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800',
          thumbnailUrl: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400',
        },
      ],
      reactions: { '👍': ['mock-user-1', 'mock-user-2', 'mock-user-3'], '❤️': ['mock-user-4'], '🔥': ['mock-user-6'] },
      reply_to_id: null,
      created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      user_name: 'Lise Andersen',
      user_avatar: null,
      user_badges: ['featured-creator'],
      is_edited: false,
      is_solution: false,
      thread_count: 8,
      parent_message_id: null,
      is_pinned: false,
    },
    {
      id: 'mock-msg-6',
      channel_id: 'mock-channel-2',
      user_id: 'mock-user-6',
      content: 'Hvordan redigerer dere RAW-filer? Jeg bruker Lightroom, men lurer på om det finnes bedre alternativer?',
      message_type: 'text',
      attachments: [],
      reactions: {},
      reply_to_id: null,
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      user_name: 'Tommy Berg',
      user_avatar: null,
      user_badges: [],
      is_edited: false,
      is_solution: false,
      thread_count: 2,
      parent_message_id: null,
      is_pinned: false,
    },
  ];

  const mockBadges: UserBadge[] = [
    {
      id: 'badge-1',
      name: 'Early Adopter',
      slug: 'early-adopter',
      icon: '', // Badge icon
      color: '#f59e0b',
    },
    {
      id: 'badge-2',
      name: 'Mentor',
      slug: 'mentor',
      icon: '', // Badge icon
      color: '#10b981',
    },
    {
      id: 'badge-3',
      name: 'Expert',
      slug: 'expert',
      icon: '', // Badge icon
      color: '#3b82f6',
    },
    {
      id: 'badge-4',
      name: 'Featured Creator',
      slug: 'featured-creator',
      icon: '✨', // Keep as emoji for badge display
      color: '#a855f7',
    },
  ];

  return {
    groups: mockGroups,
    channels: mockChannels,
    messages: mockMessages,
    badges: mockBadges,
  };
};

export default function CommunityPage({ userId, profession }: CommunityPageProps) {
  const isPreviewMode = userId === 'preview-user';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const { communication } = useEnhancedMasterIntegration();
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);
  
  // Auth for prototype testing access
  const { isPrototypeTester, isAdmin } = useAuth();
  
  // Track current community component for feedback context
  const [currentCommunityComponent, setCurrentCommunityComponent] = useState<string>('CommunityPage');

  // Community Tutorial - shows on first visit
  const { 
    showTutorial: showCommunityTutorial, 
    openTutorial: openCommunityTutorial, 
    closeTutorial: closeCommunityTutorial 
  } = useCommunityTutorial(userId);

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CommunityGroup[]>([]);
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);

  const [selectedGroup, setSelectedGroup] = useState<CommunityGroup | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<CommunityChannel | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Report dialog state
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportedMessage, setReportedMessage] = useState<CommunityMessage | null>(null);

  // Message menu state
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMessage, setSelectedMessage] = useState<CommunityMessage | null>(null);

  // File attachment state (URLs and fileIds from Google Drive)
  const [attachedFiles, setAttachedFiles] = useState<Array<{ url: string; fileId?: string }>>([]);

  // Emoji picker state
  const [emojiPickerAnchor, setEmojiPickerAnchor] = useState<null | HTMLElement>(null);
  const emojiPickerOpen = Boolean(emojiPickerAnchor);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'memojis' | 'memes'>('emojis');
  
  // Giphy API state
  const GIPHY_API_KEY = 'Cz4X23Bkaq6cdxylBCUxsbBQb7sa1yyB';
  const [gifs, setGifs] = useState<Array<{ id: string; url: string; title: string; preview: string }>>([]);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifsLoading, setGifsLoading] = useState(false);

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState('');

  // Settings sidebar state
  const [settingsSidebarCollapsed, setSettingsSidebarCollapsed] = useState(false);

  // Thread view state
  const [threadDialogOpen, setThreadDialogOpen] = useState(false);
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);

  // Moderator check
  const [isModerator, setIsModerator] = useState(false);

  // User profile modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

  // Search dialog state
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchScope, setSearchScope] = useState<'all' | 'channel' | 'thread'>('all');
  const [searchScopeId, setSearchScopeId] = useState<string | undefined>();
  const [searchScopeName, setSearchScopeName] = useState<string | undefined>();

  // Badge notification state
  const [badgeNotificationOpen, setBadgeNotificationOpen] = useState(false);
  const [earnedBadge, setEarnedBadge] = useState<{
    name: string;
    icon: string;
    color: string;
    description: string;
  } | null>(null);

  // Onboarding state
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Mentor dashboard state
  const [mentorDashboardOpen, setMentorDashboardOpen] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  const [mentorIds, setMentorIds] = useState<Set<string>>(new Set());
  const [becomeMentorDialogOpen, setBecomeMentorDialogOpen] = useState(false);

  // Voting board state
  const [votingBoardOpen, setVotingBoardOpen] = useState(false);
  const [mentorEligible, setMentorEligible] = useState(false);

  // Publish to community state
  const [publishToCommunityDialogOpen, setPublishToCommunityDialogOpen] = useState(false);
  const [publishedCourses, setPublishedCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Edit post state
  const [editPostDialogOpen, setEditPostDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

  // Published posts state (for viewing/managing)
  const [publishedPosts, setPublishedPosts] = useState<any[]>([]);
  const [showPublishedPosts, setShowPublishedPosts] = useState(false);

  // Analytics state
  const [showAnalyticsDialog, setShowAnalyticsDialog] = useState(false);
  const [analyticsPost, setAnalyticsPost] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // WebSocket state for real-time features
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // User profile state
  const [user, setUser] = useState<{ name?: string; picture?: string } | null>(null);
  const [userProfile, setUserProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);

  // Notification drawer state
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationPreferencesOpen, setNotificationPreferencesOpen] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({
    notify_mentions: true,
    notify_replies: true,
    notify_reactions: true,
    notify_badges: true,
    notify_moderation: true,
  });

  useEffect(() => {
    fetchUserCommunityData();
    if (!isPreviewMode) {
      checkModeratorStatus();
      checkFirstTimeUser();
      fetchMentors();
      checkMentorEligibility();
      fetchUnreadNotificationCount();
      fetchNotificationPreferences();
    } else {
      // Set some mock state for preview
      setIsMentor(false);
      setMentorEligible(true);
      setMentorIds(new Set(['mock-user-4']));
      setOnlineUsers(new Set(['mock-user-1', 'mock-user-2', 'mock-user-3', 'mock-user-4', 'preview-user']));
    }
  }, [userId, profession]);

  // Load messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      fetchChannelMessages(selectedChannel.id);
    }
  }, [selectedChannel?.id]);

  // Track current community component for prototype feedback context
  useEffect(() => {
    if (votingBoardOpen) {
      setCurrentCommunityComponent('VotingBoard');
    } else if (mentorDashboardOpen) {
      setCurrentCommunityComponent('MentorDashboard');
    } else if (threadDialogOpen) {
      setCurrentCommunityComponent('ThreadViewDialog');
    } else if (searchDialogOpen) {
      setCurrentCommunityComponent('AdvancedSearchDialog');
    } else if (profileModalOpen) {
      setCurrentCommunityComponent('UserProfileModal');
    } else if (notificationDrawerOpen) {
      setCurrentCommunityComponent('CommunityNotificationFeed');
    } else {
      setCurrentCommunityComponent('CommunityPage');
    }
  }, [votingBoardOpen, mentorDashboardOpen, threadDialogOpen, searchDialogOpen, profileModalOpen, notificationDrawerOpen]);

  // Keyboard shortcut for opening tutorial (⌘+? or Ctrl+?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '/') {
        e.preventDefault();
        openCommunityTutorial();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openCommunityTutorial]);

  const fetchUnreadNotificationCount = async () => {
    try {
      const response = await apiRequest(`/api/community/notifications/${userId}/unread-count`, {
        method: 'GET',
      }) as { success: boolean; count: number };

      if (response.success) {
        setUnreadNotificationCount(response.count);
      }
    } catch (error) {
      console.error('Error fetching unread notification count: ', error);
    }
  };

  const fetchNotificationPreferences = async () => {
    try {
      const response = await apiRequest(`/api/community/notifications/${userId}/preferences`, {
        method: 'GET',
      }) as { success: boolean; preferences: any };

      if (response.success && response.preferences) {
        setNotificationPreferences({
          notify_mentions: response.preferences.notify_mentions ?? true,
          notify_replies: response.preferences.notify_replies ?? true,
          notify_reactions: response.preferences.notify_reactions ?? true,
          notify_badges: response.preferences.notify_badges ?? true,
          notify_moderation: response.preferences.notify_moderation ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    }
  };

  const updateNotificationPreferences = async (preferences: any) => {
    try {
      const response = await apiRequest(`/api/community/notifications/${userId}/preferences`, {
        method: 'PUT',
        body: JSON.stringify(preferences),
      }) as { success: boolean };

      if (response.success) {
        setNotificationPreferences(preferences);
      }
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      alert('Kunne ikke oppdatere varslingsinnstillinger');
    }
  };

  const fetchMentors = async () => {
    try {
      const response = await apiRequest('/api/community/mentors');
      const mentorUserIds = new Set<string>(response.mentors.map((m: any) => String(m.id)));
      setMentorIds(mentorUserIds);
    } catch (error) {
      console.error('Error fetching mentors:', error);
    }
  };

  const checkMentorEligibility = async () => {
    try {
      const response = await apiRequest('/api/community/mentors/check-eligibility');
      setMentorEligible(response.eligible);

      // Show notification if user just became eligible
      if (response.eligible && !isMentor) {
        // Check if we've already shown this notification
        const notificationShown = localStorage.getItem(`mentor_eligible_notification_${userId}`);
        if (!notificationShown) {
          setTimeout(() => {
            alert('Du er nå kvalifisert til å bli mentor! Klikk på "Bli Mentor" knappen for å komme i gang.');
            localStorage.setItem(`mentor_eligible_notification_${userId}`, 'true');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error checking mentor eligibility:', error);
    }
  };

  const fetchPublishedCourses = async () => {
    setLoadingCourses(true);
    try {
      const response = await fetch('/api/academy/courses', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        // Filter only published courses
        const published = data.courses?.filter((c: any) => c.status === 'active' || c.isPublished) || [];
        setPublishedCourses(published);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleOpenPublishDialog = () => {
    fetchPublishedCourses();
    setPublishToCommunityDialogOpen(true);
  };

  const fetchPublishedPosts = async () => {
    try {
      const response = await fetch('/api/academy/courses/community-posts', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        setPublishedPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching published posts:', error);
    }
  };

  const handleOpenPublishedPosts = () => {
    fetchPublishedPosts();
    setShowPublishedPosts(true);
  };

  const fetchPostAnalytics = async (post: any) => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch(
        `/api/academy/courses/${post.course_id}/community-posts/${post.id}/analytics`,
        {
          credentials: 'include',
        }
      );
      const data = await response.json();
      if (response.ok) {
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleViewAnalytics = async (message: any) => {
    try {
      // Fetch the course post details
      const response = await fetch('/api/academy/courses/community-posts', {
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok) {
        // Find the post that matches this message
        const post = data.posts?.find((p: any) => p.message_id === message.id);
        if (post) {
          setAnalyticsPost(post);
          await fetchPostAnalytics(post);
          setShowAnalyticsDialog(true);
        }
      }
    } catch (error) {
      console.error('Error fetching post details:', error);
    }
  };

  const checkFirstTimeUser = async () => {
    try {
      // Check if user has completed onboarding
      const response = await apiRequest(`/api/user-kv/${userId}/community_onboarding_complete`);
      if (!response.value) {
        // Show onboarding for first-time users
        setTimeout(() => setOnboardingOpen(true), 1000);
      }
    } catch (error) {
      // If key doesn't exist, user hasn't completed onboarding
      setTimeout(() => setOnboardingOpen(true), 1000);
    }
  };

  // WebSocket connection for real-time messaging
  useEffect(() => {
    if (!selectedChannel || !userId) return;
    
    // Skip WebSocket connection in preview mode
    if (isPreviewMode) {
      // Initial fetch only (no WebSocket)
      fetchChannelMessages(selectedChannel.id);
      return;
    }

    // Initial fetch
    fetchChannelMessages(selectedChannel.id);

    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/events`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Community WebSocket connected');
        setWsConnected(true);

        // Send authentication and join channel
        wsRef.current?.send(JSON.stringify({
          type: 'auth',
          userId,
          channelId: selectedChannel.id,
          profession,
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'new_message':
              // Refresh messages when new message arrives
              if (data.channelId === selectedChannel.id) {
                fetchChannelMessages(selectedChannel.id);
              }
              break;

            case 'typing_indicator':
              // Update typing users
              if (data.channelId === selectedChannel.id && data.userId !== userId) {
                setTypingUsers(prev => {
                  const newSet = new Set(prev);
                  if (data.isTyping) {
                    newSet.add(data.userId);
                  } else {
                    newSet.delete(data.userId);
                  }
                  return newSet;
                });
              }
              break;

            case 'user_status':
              // Update online users
              setOnlineUsers(prev => {
                const newSet = new Set(prev);
                if (data.status === 'online') {
                  newSet.add(data.userId);
                } else {
                  newSet.delete(data.userId);
                }
                return newSet;
              });
              break;

            case 'community_notification':
              // Update unread notification count
              setUnreadNotificationCount(prev => prev + 1);
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedChannel, userId, profession, isPreviewMode]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkModeratorStatus = async () => {
    try {
      const response = await apiRequest(`/api/community/user/${userId}/roles`);
      const roles = response.roles || [];
      const isModOrAdmin = roles.some((role: any) =>
        role.name === 'Admin' || role.name === 'Moderator'
      );
      setIsModerator(isModOrAdmin);

      // Check if user is a mentor
      const isMentorRole = roles.some((role: any) => role.name === 'Mentor');
      setIsMentor(isMentorRole);
    } catch (error) {
      console.error('Error checking moderator status:', error);
    }
  };

  const fetchUserCommunityData = async () => {
    try {
      setLoading(true);

      // Use mock data in preview mode
      if (isPreviewMode) {
        const mockData = getMockData();
        setUser({ name: 'Preview Bruker', picture: null });
        setUserProfile({
          display_name: 'Preview Bruker',
          avatar_url: null,
        });
        setGroups(mockData.groups);
        setUserBadges(mockData.badges);
        
        // Auto-select first group
        if (mockData.groups.length > 0) {
          const firstGroup = mockData.groups[0];
          setSelectedGroup(firstGroup);
          // Set channels for first group
          const groupChannels = mockData.channels.filter(c => c.group_id === firstGroup.id);
          setChannels(groupChannels);
          if (groupChannels.length > 0) {
            setSelectedChannel(groupChannels[0]);
            // Set messages for first channel
            const channelMessages = mockData.messages.filter(m => m.channel_id === groupChannels[0].id);
            setMessages(channelMessages);
          }
        }
        setLoading(false);
        return;
      }

      // Fetch user profile
      try {
        const userResponse = await apiRequest(`/api/users/${userId}`, {
          method: 'GET',
        }) as any;
        if (userResponse) {
          setUser({ name: userResponse.name, picture: userResponse.picture });
          setUserProfile({
            display_name: userResponse.name || userResponse.display_name,
            avatar_url: userResponse.picture || userResponse.avatar_url
          });
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }

      // Fetch user's groups
      const groupsResponse = await apiRequest(`/api/community/user/${userId}/groups`, {
        method: 'GET',
      }) as { success: boolean; groups: CommunityGroup[] };

      if (groupsResponse.success) {
        setGroups(groupsResponse.groups);

        // Auto-select first group
        if (groupsResponse.groups.length > 0) {
          const firstGroup = groupsResponse.groups[0];
          setSelectedGroup(firstGroup);
          await fetchGroupChannels(firstGroup.id);
        }
      }

      // Fetch user's badges
      const badgesResponse = await apiRequest(`/api/community/user/${userId}/badges`, {
        method: 'GET',
      }) as { success: boolean; badges: UserBadge[] };

      if (badgesResponse.success) {
        setUserBadges(badgesResponse.badges);
      }
    } catch (error) {
      console.error('Error fetching community data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupChannels = async (groupId: string) => {
    try {
      // Use mock data in preview mode
      if (isPreviewMode) {
        const mockData = getMockData();
        const groupChannels = mockData.channels.filter(c => c.group_id === groupId);
        setChannels(groupChannels);
        
        // Auto-select first accessible channel
        if (groupChannels.length > 0) {
          const firstChannel = groupChannels[0];
          setSelectedChannel(firstChannel);
          // Load messages for selected channel
          const channelMessages = mockData.messages.filter(m => m.channel_id === firstChannel.id);
          setMessages(channelMessages);
        }
        return;
      }

      const response = await apiRequest(`/api/community/user/${userId}/channels?groupId=${groupId}`, {
        method: 'GET',
      }) as { success: boolean; channels: CommunityChannel[] };

      if (response.success) {
        setChannels(response.channels);
        
        // Auto-select first accessible channel
        if (response.channels.length > 0) {
          setSelectedChannel(response.channels[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

  const fetchChannelMessages = async (channelId: string) => {
    try {
      // Use mock data in preview mode
      if (isPreviewMode) {
        const mockData = getMockData();
        const channelMessages = mockData.messages.filter(m => m.channel_id === channelId);
        setMessages(channelMessages);
        return;
      }

      const response = await apiRequest(`/api/community/channels/${channelId}/messages`, {
        method: 'GET',
      }) as { success: boolean; messages: CommunityMessage[] };

      if (response.success) {
        setMessages(response.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleFilesUploaded = (files: Array<{ url: string; fileId?: string }>) => {
    setAttachedFiles(files);
  };

  const handleSendMessage = async () => {
    if ((!messageInput.trim() && attachedFiles.length === 0) || !selectedChannel || sendingMessage) return;

    try {
      setSendingMessage(true);

      const response = await apiRequest(`/api/community/channels/${selectedChannel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          content: messageInput.trim(),
          message_type: attachedFiles.length > 0 ? 'file' : 'text',
          attachments: attachedFiles.length > 0 ? attachedFiles : undefined,
        }),
      }) as { success: boolean; message: CommunityMessage };

      if (response.success) {
        setMessages([...messages, response.message]);
        setMessageInput('');
        setAttachedFiles([]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Kunne ikke sende melding');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await apiRequest(`/api/community/messages/${messageId}/react`, {
        method: 'POST',
        body: JSON.stringify({
          userId,
          emoji,
        }),
      });

      // Refresh messages
      if (selectedChannel) {
        fetchChannelMessages(selectedChannel.id);
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleEmojiSelect = (emoji: any) => {
    // Insert emoji at cursor position or append to end
    setMessageInput((prev) => prev + emoji.native);
    setEmojiPickerAnchor(null);
  };

  const handleMemojiSelect = (memoji: { url: string; name: string }) => {
    // Insert memoji as image markdown or URL
    setMessageInput((prev) => prev + ` ![${memoji.name}](${memoji.url}) `);
    setEmojiPickerAnchor(null);
  };

  const handleMemeSelect = (meme: { url: string; name: string }) => {
    // Insert meme as image markdown or URL
    setMessageInput((prev) => prev + ` ![${meme.name}](${meme.url}) `);
    setEmojiPickerAnchor(null);
  };

  // Fetch trending GIFs from Giphy
  const fetchTrendingGifs = useCallback(async () => {
    try {
      setGifsLoading(true);
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=24&rating=g`
      );
      const data = await response.json();
      if (data.data) {
        setGifs(
          data.data.map((gif: any) => ({
            id: gif.id,
            url: gif.images.original.url,
            title: gif.title || 'GIF',
            preview: gif.images.preview_gif.url || gif.images.fixed_height_small.url,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching trending GIFs:', error);
    } finally {
      setGifsLoading(false);
    }
  }, [GIPHY_API_KEY]);

  // Search GIFs from Giphy
  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }
    try {
      setGifsLoading(true);
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=24&rating=g`
      );
      const data = await response.json();
      if (data.data) {
        setGifs(
          data.data.map((gif: any) => ({
            id: gif.id,
            url: gif.images.original.url,
            title: gif.title || 'GIF',
            preview: gif.images.preview_gif.url || gif.images.fixed_height_small.url,
          }))
        );
      }
    } catch (error) {
      console.error('Error searching GIFs:', error);
    } finally {
      setGifsLoading(false);
    }
  }, [GIPHY_API_KEY, fetchTrendingGifs]);

  // Load trending GIFs when memes tab is opened
  useEffect(() => {
    if (pickerTab === 'memes' && emojiPickerOpen && gifs.length === 0 && !gifsLoading) {
      fetchTrendingGifs();
    }
  }, [pickerTab, emojiPickerOpen]); // Only depend on tab and open state

  const handleOpenEmojiPicker = (event: React.MouseEvent<HTMLElement>) => {
    setEmojiPickerAnchor(event.currentTarget);
  };

  const handleCloseEmojiPicker = () => {
    setEmojiPickerAnchor(null);
    // Reset GIF state when picker closes
    setGifs([]);
    setGifSearchQuery('');
  };

  // Typing indicator with debouncing
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    // Skip in preview mode
    if (isPreviewMode) return;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedChannel) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_indicator',
        userId,
        channelId: selectedChannel.id,
        isTyping,
      }));
    }
  }, [userId, selectedChannel, isPreviewMode]);

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    // Send typing indicator
    if (e.target.value.length > 0) {
      sendTypingIndicator(true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing indicator after 2 seconds
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(false);
      }, 2000);
    } else {
      sendTypingIndicator(false);
    }
  };

  const handleOpenMessageMenu = (event: React.MouseEvent<HTMLElement>, message: CommunityMessage) => {
    setMessageMenuAnchor(event.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageMenu = () => {
    setMessageMenuAnchor(null);
    setSelectedMessage(null);
  };

  const handleOpenReportDialog = () => {
    if (selectedMessage) {
      setReportedMessage(selectedMessage);
      setReportDialogOpen(true);
      handleCloseMessageMenu();
    }
  };

  const handleCloseReportDialog = () => {
    setReportDialogOpen(false);
    setReportedMessage(null);
  };

  const handleStartEdit = () => {
    if (selectedMessage) {
      setEditingMessageId(selectedMessage.id);
      setEditMessageContent(selectedMessage.content);
      handleCloseMessageMenu();
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditMessageContent('');
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editMessageContent.trim()) return;

    try {
      const response = await apiRequest(`/api/community/messages/${messageId}`, {
        method: 'PUT',
        body: JSON.stringify({
          userId,
          content: editMessageContent.trim(),
        }),
      }) as { success: boolean; message: CommunityMessage };

      if (response.success) {
        // Update message in local state
        setMessages(messages.map(m => m.id === messageId ? response.message : m));
        setEditingMessageId(null);
        setEditMessageContent('');
      }
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Kunne ikke redigere melding');
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;

    if (!confirm('Er du sikker på at du vil slette denne meldingen?')) {
      return;
    }

    try {
      await apiRequest(`/api/community/messages/${selectedMessage.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });

      // Remove message from local state or mark as deleted
      setMessages(messages.map(m =>
        m.id === selectedMessage.id
          ? { ...m, is_deleted: true, content: '[Melding slettet]', attachments: [] }
          : m
      ));
      handleCloseMessageMenu();
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Kunne ikke slette melding');
    }
  };

  const handlePinMessage = async (messageId: string, isPinned: boolean) => {
    try {
      await apiRequest(`/api/community/messages/${messageId}/pin`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userId, isPinned }),
      });

      // Update message in local state
      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, is_pinned: isPinned } : m
      ));
      handleCloseMessageMenu();
    } catch (error) {
      console.error('Error pinning message:', error);
      alert('Kunne ikke feste melding');
    }
  };

  const handleMarkSolution = async (messageId: string, isSolution: boolean) => {
    try {
      await apiRequest(`/api/community/messages/${messageId}/mark-solution`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ userId, isSolution }),
      });

      // Update message in local state
      setMessages(messages.map(m =>
        m.id === messageId ? { ...m, is_solution: isSolution } : m
      ));
      handleCloseMessageMenu();

      // Show success message
      if (isSolution) {
        alert('Melding markert som løsning!');
      }
    } catch (error) {
      console.error('Error marking solution:', error);
      alert('Kunne ikke markere som løsning');
    }
  };

  const handleBookmarkMessage = async (messageId: string) => {
    try {
      // Check if already bookmarked
      const bookmarksResponse = await apiRequest('/api/community/bookmarks');
      const isBookmarked = bookmarksResponse.bookmarks?.some((b: any) => b.message_id === messageId);

      if (isBookmarked) {
        // Remove bookmark
        await apiRequest(`/api/community/bookmarks/${messageId}`, {
          method: 'DELETE',
        });
        alert('🔖 Bokmerke fjernet');
      } else {
        // Add bookmark
        await apiRequest('/api/community/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type' : 'application/json' },
          body: JSON.stringify({ userId, messageId }),
        });
        alert('🔖 Melding lagret!');
      }

      handleCloseMessageMenu();
    } catch (error) {
      console.error('Error bookmarking message:', error);
      alert('Kunne ikke lagre melding');
    }
  };

  const renderSidebar = () => (
    <Box 
      component="nav"
      role="navigation"
      aria-label="Sidebar navigasjon"
      sx={{ width: { xs: 280, sm: 320, md: 340, lg: 360, xl: 380 }, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* User Profile Header */}
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5, md: 3, lg: 3.5 },
          mb: 2,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 88, 12, 0.08) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* CreatorHub Logo Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, mb: { xs: 2, sm: 2.5, md: 3 } }}>
          <Box
            sx={{
              width: { xs: 40, sm: 44, md: 48 },
              height: { xs: 40, sm: 44, md: 48 },
              borderRadius: '10px',
              background: 'rgba(26, 26, 46, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              p: 0.75,
            }}
          >
            <CreatorHubLogoIcon size={28} />
          </Box>
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{
                color: '#fff',
                fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                lineHeight: 1.2,
              }}
            >
              CreatorHub Norge
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
              }}
            >
              Community
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3 } }}>
          <Avatar
            src={user?.picture}
            alt={user?.name ? `Profilbilde for ${user.name}` : 'Profilbilde'}
            aria-label={user?.name ? `Bruker: ${user.name}` : 'Brukerprofil'}
            sx={{
              width: { xs: 48, sm: 52, md: 56, lg: 60, xl: 64 },
              height: { xs: 48, sm: 52, md: 56, lg: 60, xl: 64 },
              border: '2px solid rgba(245, 158, 11, 0.5)',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            {user?.name?.[0]}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              sx={{
                color: '#fff',
                mb: { xs: 0.25, sm: 0.5 },
                fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1rem', lg: '1.05rem', xl: '1.1rem' },
              }}
            >
              {user?.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: { xs: 0.4, sm: 0.5, md: 0.6, lg: 0.75 }, flexWrap: 'wrap', mt: { xs: 0.25, sm: 0.5 } }}>
              {userBadges.slice(0, 3).map((badge) => (
                <Tooltip key={badge.id} title={badge.name}>
                  <Chip
                    label={badge.icon}
                    size="small"
                    sx={{
                      bgcolor: badge.color,
                      color: 'white',
                      fontSize: '10px',
                      height: 22,
                      fontWeight: 600,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Unanswered Questions Widget */}
      <Box sx={{ mb: 2 }}>
        <UnansweredQuestionsWidget
          channelId={selectedChannel?.id}
          onSelectQuestion={(questionId, channelName) => {
            // Find the channel and navigate to it
            const channel = channels.find(c => c.display_name === channelName);
            if (channel) {
              setSelectedChannel(channel);
              // Scroll to the message (TODO: implement scroll to message)
            }
          }}
        />
      </Box>

      {/* Groups */}
      <Paper
        sx={{
          flex: 1,
          overflow: 'visible',
          background: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Box
          sx={{
            p: { xs: 2, sm: 2.5, md: 3 },
            borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 1.5 },
          }}
        >
          <Box
            sx={{
              width: { xs: 28, sm: 32, md: 36 },
              height: { xs: 28, sm: 32, md: 36 },
              borderRadius: '8px',
              background: 'rgba(26, 26, 46, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)',
              flexShrink: 0,
              p: 0.5,
            }}
          >
            <CreatorHubLogoIcon size={20} />
          </Box>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{
              color: '#f59e0b',
              fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem', lg: '1rem', xl: '1.05rem' },
            }}
          >
            Dine Grupper
          </Typography>
        </Box>
        <List sx={{ p: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 } }}>
          {groups.map((group) => (
            <ListItemButton
              key={group.id}
              selected={selectedGroup?.id === group.id}
              onClick={() => {
                setSelectedGroup(group);
                fetchGroupChannels(group.id);
                if (isMobile) setMobileDrawerOpen(false);
              }}
              aria-label={`Gruppe: ${group.name}, ${group.member_count} medlemmer`}
              aria-current={selectedGroup?.id === group.id ? 'true' : 'false'}
              sx={{
                borderRadius: '12px',
                mb: { xs: 0.4, sm: 0.5, md: 0.6, lg: 0.75 },
                minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px' },
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.1) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(234, 88, 12, 0.15) 100%)',
                  },
                },
                '&:hover': {
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: { xs: 48, sm: 52, md: 56, lg: 60 }, mr: { xs: 1.5, sm: 2, md: 2.5 } }}>
                <Box aria-hidden="true">
                  {getGroupIcon(group.icon, group.name)}
                </Box>
              </ListItemIcon>
              <ListItemText
                primary={group.name}
                secondary={`${group.member_count} medlemmer`}
                primaryTypographyProps={{
                  sx: {
                    color: '#fff',
                    fontWeight: selectedGroup?.id === group.id ? 700 : 500,
                    fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem', lg: '0.95rem', xl: '1rem' },
                  },
                }}
                secondaryTypographyProps={{
                  sx: {
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                  },
                }}
              />
            </ListItemButton>
          ))}
        </List>

        {/* Channels */}
        {selectedGroup && (
          <>
            <Divider sx={{ borderColor: 'rgba(245, 158, 11, 0.2)', my: 1 }} />
            <Box
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, transparent 100%)',
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{
                  color: '#f59e0b',
                  fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.95rem', lg: '1rem', xl: '1.05rem' },
                }}
              >
                Kanaler
              </Typography>
            </Box>
            <List sx={{ p: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 } }}>
              {channels.map((channel) => (
                <ListItemButton
                  key={channel.id}
                  selected={selectedChannel?.id === channel.id}
                  onClick={() => {
                    setSelectedChannel(channel);
                    if (isMobile) setMobileDrawerOpen(false);
                  }}
                  disabled={!!channel.requires_feature && !channel.is_default}
                  aria-label={`Kanal: ${channel.display_name}${channel.description ? `, ${channel.description}` : ''}`}
                  aria-current={selectedChannel?.id === channel.id ? 'true' : 'false'}
                  aria-disabled={!!channel.requires_feature && !channel.is_default}
                  sx={{
                    borderRadius: '12px',
                    mb: { xs: 0.4, sm: 0.5, md: 0.6, lg: 0.75 },
                    minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px' },
                    '&.Mui-selected': {
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.1) 100%)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(234, 88, 12, 0.15) 100%)',
                      },
                    },
                    '&:hover:not(.Mui-disabled)': {
                      background: 'rgba(245, 158, 11, 0.1)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                    },
                    '&.Mui-disabled': {
                      opacity: 0.4,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: { xs: 48, sm: 52, md: 56, lg: 60 }, mr: { xs: 1.5, sm: 2, md: 2.5 } }}>
                    {channel.is_read_only ? (
                      <Announcement sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24 }, color: '#f59e0b' }} />
                    ) : channel.requires_feature ? (
                      <Lock sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24 }, color: 'rgba(255, 255, 255, 0.4)' }} />
                    ) : (
                      <Tag sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24 }, color: '#f59e0b' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={`# ${channel.display_name}`}
                    secondary={channel.description}
                    primaryTypographyProps={{
                      sx: {
                        color: '#fff',
                        fontWeight: selectedChannel?.id === channel.id ? 700 : 500,
                        fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem', lg: '0.95rem', xl: '1rem' },
                      },
                    }}
                    secondaryTypographyProps={{
                      sx: {
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                      },
                    }}
                  />
                  {channel.unread_count && channel.unread_count > 0 && (
                    <Badge
                      badgeContent={channel.unread_count}
                      sx={{
                        '& .MuiBadge-badge': {
                          background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                          color: '#fff',
                          fontWeight: 700,
                        },
                      }}
                    />
                  )}
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </Paper>

      {/* Bottom Navigation - Dashboard & Academy */}
      <Paper
        sx={{
          mt: 2,
          p: { xs: 1.5, sm: 2, md: 2.5 },
          background: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Stack spacing={1}>
          {/* Back to Dashboard Button */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ArrowBack sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} />}
            onClick={() => {
              // Navigate back to UniversalDashboard
              window.history.back();
            }}
            sx={{
              textTransform: 'none',
              justifyContent: 'flex-start',
              borderColor: 'rgba(245, 158, 11, 0.3)',
              color: '#fff',
              minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
              fontSize: { xs: '14px', sm: '15px', md: '16px', lg: '17px', xl: '18px' },
              padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px', lg: '14px 28px', xl: '16px 32px' },
              borderRadius: { xs: '8px', sm: '10px', md: '12px', lg: '14px', xl: '16px' },
              '&:hover': {
                borderColor: 'rgba(245, 158, 11, 0.5)',
                background: 'rgba(245, 158, 11, 0.1)',
              },
            }}
          >
            Tilbake til Dashboard
          </Button>

          {/* Academy Dashboard Button - Only for Mentors */}
          {isMentor && (
            <>
              <Button
                fullWidth
                variant="contained"
                startIcon={<School sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} />}
                onClick={() => {
                  // Navigate to Academy Dashboard
                  // We'll use the router or window location to navigate
                  const currentPath = window.location.pathname;
                  if (currentPath.includes('/dashboard')) {
                    // If we're in dashboard context, trigger tab change
                    window.dispatchEvent(new CustomEvent('navigate-to-academy'));
                  } else {
                    // Otherwise navigate to dashboard with academy tab
                    window.location.href = '/dashboard?tab=academy';
                  }
                }}
                sx={{
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                  color: '#fff',
                  fontWeight: 600,
                  minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                  fontSize: { xs: '14px', sm: '15px', md: '16px', lg: '17px', xl: '18px' },
                  padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px', lg: '14px 28px', xl: '16px 32px' },
                  borderRadius: { xs: '8px', sm: '10px', md: '12px', lg: '14px', xl: '16px' },
                  '&:hover': {
                    background: 'linear-gradient(135deg, #d97706 0%, #c2410c 100%)',
                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                  },
                }}
              >
                Academy Dashboard
              </Button>

              {/* Publish Course Button */}
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Announcement sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} />}
                onClick={handleOpenPublishDialog}
                sx={{
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  color: '#f59e0b',
                  minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                  fontSize: { xs: '14px', sm: '15px', md: '16px', lg: '17px', xl: '18px' },
                  padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px', lg: '14px 28px', xl: '16px 32px' },
                  borderRadius: { xs: '8px', sm: '10px', md: '12px', lg: '14px', xl: '16px' },
                  '&:hover': {
                    borderColor: 'rgba(245, 158, 11, 0.5)',
                    background: 'rgba(245, 158, 11, 0.1)',
                  },
                }}
              >
                Publiser Kurs
              </Button>

              {/* Manage Published Posts Button */}
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Edit sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} />}
                onClick={handleOpenPublishedPosts}
                sx={{
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  color: '#f59e0b',
                  minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                  fontSize: { xs: '14px', sm: '15px', md: '16px', lg: '17px', xl: '18px' },
                  padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px', lg: '14px 28px', xl: '16px 32px' },
                  borderRadius: { xs: '8px', sm: '10px', md: '12px', lg: '14px', xl: '16px' },
                  '&:hover': {
                    borderColor: 'rgba(245, 158, 11, 0.5)',
                    background: 'rgba(245, 158, 11, 0.1)',
                  },
                }}
              >
                Administrer Innlegg
              </Button>
            </>
          )}
        </Stack>
      </Paper>
    </Box>
  );

  const renderMessage = (message: CommunityMessage) => {
    const isOwnMessage = message.user_id === userId;

    return (
      <Box
        key={message.id}
        sx={{
          display: 'flex',
          gap: { xs: 1.5, sm: 2, md: 2.5, lg: 3 },
          p: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 },
          borderRadius: '16px',
          mb: { xs: 1.5, sm: 2, md: 2.5, lg: 3 },
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          background: isOwnMessage 
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 88, 12, 0.06) 100%)'
            : 'rgba(26, 26, 46, 0.4)',
          border: isOwnMessage
            ? '1px solid rgba(245, 158, 11, 0.3)'
            : '1px solid rgba(245, 158, 11, 0.1)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          overflow: 'hidden',
          maxWidth: '100%',
          '&::before': isOwnMessage ? {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.5) 50%, transparent 100%)',
            borderRadius: '16px 16px 0 0',
          } : {},
          '&:hover': {
            background: isOwnMessage
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(234, 88, 12, 0.1) 100%)'
              : 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          },
        }}
      >
        <Badge
          overlap="circular"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          variant="dot"
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: onlineUsers.has(message.user_id) ? '#44b700' : '#bdbdbd',
              color: onlineUsers.has(message.user_id) ? '#44b700' : '#bdbdbd',
              boxShadow: '0 0 0 2px #fff',
              width: 12,
              height: 12,
              borderRadius: '50%',
              '&::after': onlineUsers.has(message.user_id) ? {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                animation: 'ripple 1.2s infinite ease-in-out',
                border: '1px solid currentColor',
                content: '""',
              } : {},
            }, '@keyframes ripple': {
              '0%': {
                transform: 'scale(.8)',
                opacity: 1,
              }, '100%': {
                transform: 'scale(2.4)',
                opacity: 0,
              },
            }}}
        >
          <Avatar
            src={message.user_avatar || undefined}
            alt={message.user_name ? `Profilbilde for ${message.user_name}` : 'Profilbilde'}
            aria-label={`Vis profil for ${message.user_name}`}
            role="button"
            tabIndex={0}
            sx={{
              width: { xs: 48, sm: 52, md: 56, lg: 60, xl: 64 },
              height: { xs: 48, sm: 52, md: 56, lg: 60, xl: 64 },
              cursor: 'pointer',
              border: '2px solid rgba(245, 158, 11, 0.4)',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              background: isOwnMessage
                ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(234, 88, 12, 0.2) 100%)',
              '&:hover': {
                border: '2px solid rgba(245, 158, 11, 0.8)',
                transform: 'scale(1.1)',
                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4)',
              },
              '&:focus': {
                outline: '3px solid #f59e0b',
                outlineOffset: '2px',
              },
            }}
            onClick={() => {
              setSelectedProfileUserId(message.user_id);
              setProfileModalOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedProfileUserId(message.user_id);
                setProfileModalOpen(true);
              }
            }}
          >
            {message.user_name?.[0]}
          </Avatar>
        </Badge>
          <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 2 }, mb: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, flexWrap: 'wrap' }}>
            <Typography
              variant="subtitle2"
              component="h3"
              fontWeight={700}
              sx={{
                color: isOwnMessage ? '#f59e0b' : '#fff',
                fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem', lg: '1.2rem', xl: '1.3rem' },
                textShadow: isOwnMessage ? '0 1px 2px rgba(245, 158, 11, 0.3)' : 'none',
              }}
            >
              {message.user_name}
              {isOwnMessage && (
                <Typography
                  component="span"
                  sx={{
                    ml: 0.75,
                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontWeight: 400,
                  }}
                >
                  (deg)
                </Typography>
              )}
            </Typography>
            {/* Mentor Badge */}
            {mentorIds.has(message.user_id) && (
              <Chip
                label="Mentor"
                size="small"
                sx={{
                  height: { xs: '24px', sm: '26px', md: '28px', lg: '30px', xl: '32px' },
                  fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem', lg: '0.9rem', xl: '0.95rem' },
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(124, 58, 237, 0.2) 100%)',
                  border: '1.5px solid rgba(139, 92, 246, 0.5)',
                  color: '#c4b5fd',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                  px: { xs: 1, sm: 1.25, md: 1.5 },
                  '&:hover': {
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.35) 0%, rgba(124, 58, 237, 0.3) 100%)',
                    borderColor: 'rgba(139, 92, 246, 0.7)',
                    boxShadow: '0 3px 12px rgba(139, 92, 246, 0.4)',
                  },
                  transition: 'all 0.2s ease',
                }}
              />
            )}
            {message.user_badges?.map((badgeSlug) => {
              const badge = userBadges.find((b) => b.slug === badgeSlug);
              return badge ? (
                <Tooltip key={badge.id} title={badge.name}>
                  <Chip
                    label={badge.icon}
                    size="small"
                    sx={{
                      bgcolor: badge.color,
                      color: 'white',
                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                      height: { xs: '18px', sm: '20px', md: '22px', lg: '24px', xl: '26px' },
                      minWidth: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 },
                    }}
                  />
                </Tooltip>
              ) : null;
            })}
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
              }}
            >
              {formatDistanceToNow(new Date(message.created_at), {
                addSuffix: true,
                locale: nb,
              })}
            </Typography>
            <Box sx={{ ml: 'auto' }}>
              <IconButton
                size="small"
                onClick={(e) => handleOpenMessageMenu(e, message)}
                aria-label={`Alternativer for melding fra ${message.user_name}`}
                aria-haspopup="true"
                aria-expanded={messageMenuAnchor !== null && selectedMessage?.id === message.id}
                sx={{
                  opacity: 0.6,
                  minWidth: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                  minHeight: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                  '&:hover': { opacity: 1 },
                  '&:focus': {
                    outline: '3px solid #f59e0b',
                    outlineOffset: '2px',
                  },
                }}
              >
                <MoreVert sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} aria-hidden="true" />
              </IconButton>
            </Box>
          </Box>
          {/* Message Content or Edit Input */}
          {editingMessageId === message.id ? (
              <Box sx={{ mt: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={editMessageContent}
                onChange={(e) => setEditMessageContent(e.target.value)}
                autoFocus
                size="small"
                label="Rediger melding"
                aria-label="Rediger melding"
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '14px', sm: '15px', md: '16px', lg: '17px', xl: '18px' },
                  },
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleSaveEdit(message.id)}
                  aria-label="Lagre redigert melding"
                  sx={{
                    minHeight: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                    fontSize: { xs: '14px', sm: '15px', md: '16px', lg: '17px', xl: '18px' },
                    padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px', lg: '14px 28px', xl: '16px 32px' },
                    '&:focus': {
                      outline: '3px solid #f59e0b',
                      outlineOffset: '2px',
                    },
                  }}
                >
                  Lagre
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleCancelEdit}
                  aria-label="Avbryt redigering"
                  sx={{
                    minHeight: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                    fontSize: { xs: '14px', sm: '15px', md: '16px', lg: '17px', xl: '18px' },
                    padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px', lg: '14px 28px', xl: '16px 32px' },
                    '&:focus': {
                      outline: '3px solid #f59e0b',
                      outlineOffset: '2px',
                    },
                  }}
                >
                  Avbryt
                </Button>
              </Box>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 2 }, mt: { xs: 0.5, sm: 0.75, md: 1 } }}>
                <Typography
                  variant="body1"
                  component="p"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    flex: 1,
                    color: isOwnMessage ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.9)',
                    lineHeight: 1.7,
                    fontSize: { xs: '0.9rem', sm: '0.95rem', md: '1.05rem', lg: '1.15rem', xl: '1.2rem' },
                    wordBreak: 'break-word',
                  }}
                >
                  {message.content}
                  {message.is_edited && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{
                        ml: 1,
                        fontStyle: 'italic',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                      }}
                    >
                      (redigert)
                    </Typography>
                  )}
                </Typography>
                {/* Solution Badge */}
                {message.is_solution && (
                  <Chip
                    icon={<CheckCircle sx={{ fontSize: { xs: 16, sm: 18, md: 20, lg: 22, xl: 24 } }} />}
                    label="Løsning"
                    size="small"
                    color="success"
                    sx={{
                      height: { xs: '22px', sm: '24px', md: '26px', lg: '28px', xl: '30px' },
                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                    }}
                  />
                )}
              </Box>

              {/* Course Announcement Card */}
              {message.message_type === 'course_announcement' && message.attachments?.[0]?.type === 'course' && (
                <Card
                  variant="outlined"
                  sx={{
                    mt: { xs: 1.5, sm: 2, md: 2.5, lg: 3 },
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-2px)',
                    },
                  }}
                  onClick={() => {
                    const courseId = message.attachments[0].courseId;
                    window.location.href = `/academy/courses/${courseId}`;
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 2.5, md: 3, lg: 3.5 } }}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box sx={{ color: 'primary.main' }}>
                        {getCourseCategoryIcon(message.attachments[0].category)}
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem', lg: '1.3rem', xl: '1.4rem' },
                        }}
                      >
                        {message.attachments[0].title}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      <Chip
                        icon={getCourseLevelIcon(message.attachments[0].level) as any}
                        label={message.attachments[0].level}
                        size="small"
                        sx={{
                          height: { xs: '22px', sm: '24px', md: '26px', lg: '28px', xl: '30px' },
                          fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                        }}
                      />
                      <Chip
                        icon={<AttachMoney sx={{ fontSize: { xs: 14, sm: 16, md: 18, lg: 20, xl: 22 } }} />}
                        label={`${message.attachments[0].price} ${message.attachments[0].currency || 'NOK'}`}
                        size="small"
                        color="primary"
                        sx={{
                          height: { xs: '22px', sm: '24px', md: '26px', lg: '28px', xl: '30px' },
                          fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                        }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              )}

              {/* File Attachments */}
              {message.message_type !== 'course_announcement' && (
                <CommunityFileDisplay
                  attachments={message.attachments || []}
                  userId={userId}
                  isOwner={message.user_id === userId}
                />
              )}
            </>
          )}

          {/* Reactions */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <Box sx={{ display: 'flex', gap: { xs: 0.4, sm: 0.5, md: 0.6, lg: 0.75 }, mt: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, flexWrap: 'wrap' }}>
              {Object.entries(message.reactions).map(([emoji, users]) => {
                // Map emojis to icons
                const getReactionIcon = (emojiStr: string) => {
                  switch (emojiStr) {
                    case '👍':
                      return <ThumbUp sx={{ fontSize: { xs: 14, sm: 15, md: 16, lg: 17, xl: 18 } }} />;
                    case '❤️':
                      return <Favorite sx={{ fontSize: { xs: 14, sm: 15, md: 16, lg: 17, xl: 18 } }} />;
                    case '🔥':
                      return <LocalFireDepartment sx={{ fontSize: { xs: 14, sm: 15, md: 16, lg: 17, xl: 18 } }} />;
                    case '✨':
                      return <AutoAwesome sx={{ fontSize: { xs: 14, sm: 15, md: 16, lg: 17, xl: 18 } }} />;
                    case '🎉':
                      return <Celebration sx={{ fontSize: { xs: 14, sm: 15, md: 16, lg: 17, xl: 18 } }} />;
                    default:
                      return null;
                  }
                };

                const reactionIcon = getReactionIcon(emoji);

                return (
                  <Chip
                    key={emoji}
                    icon={reactionIcon ? <Box aria-hidden="true">{reactionIcon}</Box> : undefined}
                    label={users.length}
                    size="small"
                    onClick={() => handleReaction(message.id, emoji)}
                    aria-label={`${emoji} reaksjon, ${users.length} personer${users.includes(userId) ? ', du har reagert' : ''}. Klikk for å ${users.includes(userId) ? 'fjerne' : 'legge til'} reaksjon`}
                    role="button"
                    tabIndex={0}
                    sx={{
                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                      height: { xs: '22px', sm: '24px', md: '26px', lg: '28px', xl: '30px' },
                      minHeight: { xs: '22px', sm: '24px', md: '26px', lg: '28px', xl: '30px' },
                      bgcolor: users.includes(userId) ? 'rgba(245, 158, 11, 0.2)' : 'rgba(26, 26, 46, 0.6)',
                      color: users.includes(userId) ? '#f59e0b' : 'rgba(255, 255, 255, 0.8)',
                      border: users.includes(userId) ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(245, 158, 11, 0.2)',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: users.includes(userId) ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.1)',
                        borderColor: 'rgba(245, 158, 11, 0.5)',
                      },
                      '&:focus': {
                        outline: '3px solid #f59e0b',
                        outlineOffset: '2px',
                      },
                      '& .MuiChip-icon': {
                        color: users.includes(userId) ? '#f59e0b' : 'rgba(255, 255, 255, 0.7)',
                      },
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleReaction(message.id, emoji);
                      }
                    }}
                  />
                );
              })}
            </Box>
          )}

          {/* Quick Actions: Reply and Reactions */}
          <Box sx={{ display: 'flex', gap: { xs: 0.4, sm: 0.5, md: 0.6, lg: 0.75 }, mt: { xs: 0.75, sm: 1, md: 1.25, lg: 1.5 }, alignItems: 'center' }}>
            {/* Reply Button */}
            <Button
              size="small"
              startIcon={<Reply sx={{ fontSize: { xs: 16, sm: 18, md: 20, lg: 22, xl: 24 } }} aria-hidden="true" />}
              onClick={() => {
                setThreadMessageId(message.id);
                setThreadDialogOpen(true);
              }}
              aria-label={`Svar på melding fra ${message.user_name}${(message.thread_count || 0) > 0 ? `, ${message.thread_count} eksisterende svar` : ''}`}
              sx={{
                textTransform: 'none',
                minWidth: 'auto',
                minHeight: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem', lg: '0.9rem', xl: '0.95rem' },
                padding: { xs: '6px 12px', sm: '8px 14px', md: '10px 16px', lg: '12px 18px', xl: '14px 20px' },
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.1)',
                },
                '&:focus': {
                  outline: '3px solid #f59e0b',
                  outlineOffset: '2px',
                },
              }}
            >
              {(message.thread_count || 0) > 0 ? `${message.thread_count} svar` : 'Svar'}
            </Button>

            {/* Quick Reactions */}
            <IconButton
              size="small"
              onClick={() => handleReaction(message.id, '👍')}
              aria-label="Legg til thumbs up reaksjon"
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                minWidth: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                minHeight: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                '&:hover': {
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.1)',
                },
                '&:focus': {
                  outline: '3px solid #f59e0b',
                  outlineOffset: '2px',
                },
              }}
            >
              <Favorite sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} aria-hidden="true" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleReaction(message.id, '❤️')}
              aria-label="Legg til hjerte reaksjon"
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                minWidth: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                minHeight: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                '&:hover': {
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.1)',
                },
                '&:focus': {
                  outline: '3px solid #f59e0b',
                  outlineOffset: '2px',
                },
              }}
            >
              <EmojiEmotions sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} aria-hidden="true" />
            </IconButton>
            <IconButton
              size="small"
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                minWidth: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                minHeight: { xs: '44px', sm: '44px', md: '48px', lg: '52px' },
                '&:hover': {
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.1)',
                },
              }}
            >
              <Reply sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          background: '#1a1a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ color: '#f59e0b' }} />
          <Typography
            variant="body1"
            sx={{
              mt: { xs: 1.5, sm: 2, md: 2.5, lg: 3 },
              color: '#fff',
              fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem', lg: '1.1rem', xl: '1.15rem' },
            }}
          >
            Laster community...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="main"
      id="main-content"
      role="main"
      aria-label="Community hovedinnhold"
      sx={{
        minHeight: '100vh',
        background: '#1a1a2e',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Skip Navigation Link - WCAG 2.2+ */}
      <Box
        component="a"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          const mainElement = document.getElementById('main-content');
          if (mainElement) {
            mainElement.focus();
            mainElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
        sx={{
          position: 'absolute',
          top: -40,
          left: 6,
          zIndex: 10000,
          bgcolor: '#f59e0b',
          color: '#fff',
          px: 2,
          py: 1,
          borderRadius: 1,
          textDecoration: 'none',
          fontSize: '0.875rem',
          fontWeight: 600,
          transition: 'top 0.2s ease-in-out',
          '&:focus': {
            top: 6,
            outline: '3px solid #fff',
            outlineOffset: '2px',
          },
        }}
      >
        Hopp til hovedinnhold
      </Box>

      {/* ARIA Live Region for announcements - WCAG 2.2+ */}
      <Box
        component="div"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
        id="community-announcer"
      />

      {/* Grid background pattern */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(rgba(245, 158, 11, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(245, 158, 11, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          zIndex: 0,
          pointerEvents: 'none',
          ariaHidden: true,
        }}
        aria-hidden="true"
      />
      
      {/* CSS Animation for typing indicator */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}
      </style>

      <Container
        maxWidth={{ xs: '100%', sm: '100%', md: '1200px', lg: '1400px', xl: '1600px' }}
        sx={{ py: 2, height: 'calc(100vh - 100px)', position: 'relative', zIndex: 1 }}
      >
        <Box sx={{ display: 'flex', height: '100%', gap: { xs: 1, sm: 1.5, md: 2, lg: 2.5, xl: 3 } }}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <IconButton
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Åpne navigasjonsmeny"
            aria-expanded={mobileDrawerOpen}
            aria-controls="mobile-navigation-drawer"
            sx={{
              position: 'fixed',
              top: 80,
              left: 16,
              zIndex: 100,
              bgcolor: 'rgba(26, 26, 46, 0.95)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#f59e0b',
              minWidth: '44px',
              minHeight: '44px',
              '&:hover': {
                bgcolor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
              },
              '&:focus': {
                outline: '3px solid #f59e0b',
                outlineOffset: '2px',
              },
            }}
          >
            <MenuIcon aria-hidden="true" />
          </IconButton>
        )}

        {/* Sidebar - Desktop */}
        {!isMobile && renderSidebar()}

        {/* Sidebar - Mobile Drawer */}
        <Drawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          id="mobile-navigation-drawer"
          role="navigation"
          aria-label="Navigasjonsmeny"
          PaperProps={{
            sx: {
              background: '#1a1a2e',
              borderRight: '1px solid rgba(245, 158, 11, 0.2)',
              width: 280,
            },
          }}
        >
          {renderSidebar()}
        </Drawer>

        {/* Main Content - Messages */}
        <Paper
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'rgba(26, 26, 46, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Channel Header */}
          {selectedChannel && (
            <Box
              component="header"
              role="banner"
              aria-label={`Kanal header for ${selectedChannel.display_name}`}
              sx={{
                p: { xs: 2.5, sm: 3, md: 3.5, lg: 4, xl: 4.5 },
                borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.12) 50%, rgba(245, 158, 11, 0.08) 100%)',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.6) 50%, transparent 100%)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: { xs: 2, sm: 2.5, md: 3 } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* CreatorHub Logo */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, mb: { xs: 1, sm: 1.5, md: 2 } }}>
                    <Box
                      sx={{
                        width: { xs: 32, sm: 36, md: 40 },
                        height: { xs: 32, sm: 36, md: 40 },
                        borderRadius: '8px',
                        background: 'rgba(26, 26, 46, 0.6)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                        p: 0.5,
                      }}
                    >
                      <CreatorHubLogoIcon size={24} />
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                        fontWeight: 600,
                      }}
                    >
                      CreatorHub Norge
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5, md: 2 }, mb: { xs: 0.75, sm: 1, md: 1.25 } }}>
                    <Box
                      sx={{
                        width: { xs: 40, sm: 44, md: 48, lg: 52 },
                        height: { xs: 40, sm: 44, md: 48, lg: 52 },
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                        flexShrink: 0,
                      }}
                    >
                      <Tag sx={{ color: '#fff', fontSize: { xs: 20, sm: 22, md: 24, lg: 26 } }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        component="h1"
                        variant="h6"
                        sx={{
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: { xs: '1.2rem', sm: '1.4rem', md: '1.6rem', lg: '1.8rem', xl: '2rem' },
                          lineHeight: 1.2,
                          mb: { xs: 0.5, sm: 0.75 },
                        }}
                      >
                        # {selectedChannel.display_name}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'rgba(255, 255, 255, 0.8)',
                          fontSize: { xs: '0.85rem', sm: '0.9rem', md: '1rem', lg: '1.1rem', xl: '1.2rem' },
                          lineHeight: 1.4,
                        }}
                      >
                        {selectedChannel.description}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: { xs: 1, sm: 1.25, md: 1.5, lg: 2 }, flexShrink: 0, alignItems: 'center' }}>
                  {/* Become Mentor Button */}
                  {mentorEligible && !isMentor && (
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<School sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 } }} aria-hidden="true" />}
                      onClick={() => setBecomeMentorDialogOpen(true)}
                      aria-label="Bli mentor"
                      sx={{
                        textTransform: 'none',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#fff',
                        fontWeight: 600,
                        minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                        fontSize: { xs: '14px', sm: '15px', md: '16px', lg: '17px', xl: '18px' },
                        padding: { xs: '8px 16px', sm: '10px 20px', md: '12px 24px', lg: '14px 28px', xl: '16px 32px' },
                        borderRadius: { xs: '8px', sm: '10px', md: '12px', lg: '14px', xl: '16px' },
                        '&:hover': {
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                        },
                      }}
                    >
                      Bli Mentor
                    </Button>
                  )}

                  {/* Mentor Dashboard Button */}
                  {isMentor && (
                    <Tooltip title="Mentor Dashboard">
                      <IconButton
                        onClick={() => setMentorDashboardOpen(true)}
                        color="secondary"
                        aria-label="Åpne mentor dashboard"
                        aria-expanded={mentorDashboardOpen}
                        aria-controls="mentor-dashboard-dialog"
                        sx={{
                          minWidth: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                          minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                          background: 'rgba(139, 92, 246, 0.1)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          color: '#8b5cf6',
                          '&:hover': {
                            background: 'rgba(139, 92, 246, 0.2)',
                            borderColor: '#8b5cf6',
                            transform: 'scale(1.05)',
                          },
                          '&:focus': {
                            outline: '3px solid #f59e0b',
                            outlineOffset: '2px',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Badge badgeContent={<School sx={{ fontSize: { xs: 14, sm: 16, md: 18 }, color: '#f59e0b' }} aria-hidden="true" />} color="secondary">
                          <HelpOutline sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} aria-hidden="true" />
                        </Badge>
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Voting Board Button */}
                  {selectedGroup && (
                    <Tooltip title="Stemmebrett - Feature Requests">
                      <IconButton
                        onClick={() => setVotingBoardOpen(true)}
                        color="primary"
                        aria-label="Åpne avstemmingsbrett"
                        aria-expanded={votingBoardOpen}
                        aria-controls="voting-board-dialog"
                        sx={{
                          minWidth: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                          minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          color: '#3b82f6',
                          '&:hover': {
                            background: 'rgba(59, 130, 246, 0.2)',
                            borderColor: '#3b82f6',
                            transform: 'scale(1.05)',
                          },
                          '&:focus': {
                            outline: '3px solid #f59e0b',
                            outlineOffset: '2px',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <HowToVote sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} aria-hidden="true" />
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Notification Bell */}
                  <Tooltip title="Varsler">
                    <IconButton
                      onClick={() => setNotificationDrawerOpen(true)}
                      color={unreadNotificationCount > 0 ? 'error' : 'default'}
                      aria-label={`Varsler${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} uleste` : ''}`}
                      aria-expanded={notificationDrawerOpen}
                      aria-controls="notification-drawer"
                      sx={{
                        minWidth: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                        minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                        background: unreadNotificationCount > 0 
                          ? 'rgba(239, 68, 68, 0.1)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        border: unreadNotificationCount > 0 
                          ? '1px solid rgba(239, 68, 68, 0.3)' 
                          : '1px solid rgba(245, 158, 11, 0.2)',
                        color: unreadNotificationCount > 0 ? '#ef4444' : 'rgba(255, 255, 255, 0.7)',
                        '&:hover': {
                          background: unreadNotificationCount > 0 
                            ? 'rgba(239, 68, 68, 0.2)' 
                            : 'rgba(245, 158, 11, 0.1)',
                          borderColor: unreadNotificationCount > 0 ? '#ef4444' : '#f59e0b',
                          color: unreadNotificationCount > 0 ? '#ef4444' : '#f59e0b',
                          transform: 'scale(1.05)',
                        },
                        '&:focus': {
                          outline: '3px solid #f59e0b',
                          outlineOffset: '2px',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Badge badgeContent={unreadNotificationCount} color="error" aria-label={`${unreadNotificationCount} uleste varsler`}>
                        <Notifications sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} aria-hidden="true" />
                      </Badge>
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Søk (⌘+K)">
                    <IconButton
                      onClick={() => {
                        setSearchScope('all');
                        setSearchScopeId(undefined);
                        setSearchScopeName(undefined);
                        setSearchDialogOpen(true);
                      }}
                      aria-label="Søk i meldinger"
                      aria-expanded={searchDialogOpen}
                      aria-controls="search-dialog"
                      sx={{
                        minWidth: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                        minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&:hover': {
                          background: 'rgba(245, 158, 11, 0.1)',
                          borderColor: '#f59e0b',
                          color: '#f59e0b',
                          transform: 'scale(1.05)',
                        },
                        '&:focus': {
                          outline: '3px solid #f59e0b',
                          outlineOffset: '2px',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Search sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} aria-hidden="true" />
                    </IconButton>
                  </Tooltip>

                  {/* Help / Tutorial Button */}
                  <Tooltip title="Hjelp & Guide (⌘+?)">
                    <IconButton
                      onClick={openCommunityTutorial}
                      color="primary"
                      aria-label="Åpne hjelp og opplæring"
                      aria-expanded={showCommunityTutorial}
                      aria-controls="community-tutorial"
                      sx={{
                        minWidth: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                        minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px', xl: '60px' },
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&:hover': {
                          background: 'rgba(245, 158, 11, 0.1)',
                          borderColor: '#f59e0b',
                          color: '#f59e0b',
                          transform: 'scale(1.05)',
                        },
                        '&:focus': {
                          outline: '3px solid #f59e0b',
                          outlineOffset: '2px',
                        },
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <HelpOutline sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} aria-hidden="true" />
                    </IconButton>
                  </Tooltip>

                  <IconButton
                    sx={{
                      minWidth: { xs: '44px', sm: '44px', md: '48px', lg: '52px', xl: '56px' },
                      minHeight: { xs: '44px', sm: '44px', md: '48px', lg: '52px', xl: '56px' },
                    }}
                  >
                    <MoreVert sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          )}

          {/* Messages Area */}
          <Box
            id="main-content"
            role="main"
            aria-label="Meldingsområde"
            sx={{
              flex: 1,
              overflow: 'hidden',
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(18, 18, 31, 0.4) 0%, rgba(26, 26, 46, 0.3) 100%)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.3) 50%, transparent 100%)',
              },
            }}
          >
            {/* Pinned Messages Bar */}
            {selectedChannel && (
              <PinnedMessagesBar
                channelId={selectedChannel.id}
                userId={userId}
                isModerator={isModerator}
                onUnpin={(messageId) => {
                  setMessages(messages.map(m =>
                    m.id === messageId ? { ...m, is_pinned: false } : m
                  ));
                }}
              />
            )}

            {messages.length === 0 ? (
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  py: { xs: 8, sm: 10, md: 12, lg: 14, xl: 16 },
                  px: { xs: 2, sm: 3, md: 4 },
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '100%',
                }}
              >
                <Box
                  sx={{
                    width: { xs: 80, sm: 96, md: 112, lg: 128, xl: 144 },
                    height: { xs: 80, sm: 96, md: 112, lg: 128, xl: 144 },
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: { xs: 3, sm: 4, md: 5 },
                    boxShadow: '0 8px 32px rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <Forum sx={{ fontSize: { xs: 40, sm: 48, md: 56, lg: 64, xl: 72 }, color: '#f59e0b' }} />
                </Box>
                <Typography
                  variant="h5"
                  component="h2"
                  sx={{
                    color: '#fff',
                    mb: { xs: 1.5, sm: 2 },
                    fontWeight: 700,
                    fontSize: { xs: '1.5rem', sm: '1.75rem', md: '2rem', lg: '2.25rem', xl: '2.5rem' },
                  }}
                >
                  Ingen meldinger ennå
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.375rem', xl: '1.5rem' },
                    maxWidth: { xs: '100%', sm: '500px', md: '600px' },
                    lineHeight: 1.6,
                  }}
                >
                  Vær den første til å starte samtalen i denne kanalen!
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  height: '100%',
                  p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                  overflow: 'hidden',
                  position: 'relative',
                  '& .virtuoso-scroller': {
                    paddingRight: { xs: 2, sm: 2.5, md: 3 },
                    paddingLeft: { xs: 1, sm: 1.5, md: 2 },
                    paddingTop: { xs: 1, sm: 1.5, md: 2 },
                    paddingBottom: { xs: 1, sm: 1.5, md: 2 },
                    overflow: 'hidden',
                    '&::-webkit-scrollbar': {
                      width: { xs: '8px', sm: '10px', md: '12px' },
                    },
                    '&::-webkit-scrollbar-track': {
                      background: 'rgba(26, 26, 46, 0.3)',
                      borderRadius: '10px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'rgba(245, 158, 11, 0.3)',
                      borderRadius: '10px',
                      '&:hover': {
                        background: 'rgba(245, 158, 11, 0.5)',
                      },
                    },
                  },
                }}
              >
                <Virtuoso
                  ref={virtuosoRef}
                  data={messages}
                  itemContent={(index, message) => renderMessage(message)}
                  followOutput="smooth"
                  alignToBottom
                  style={{ height: '100%' }}
                />
              </Box>
            )}
          </Box>

          {/* Message Input */}
          {selectedChannel && !selectedChannel.is_read_only && (
            <Box
              sx={{
                p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                borderTop: '1px solid rgba(245, 158, 11, 0.2)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, transparent 100%)',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
              }}
            >
              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontStyle: 'italic',
                      color: 'rgba(245, 158, 11, 0.8)',
                      fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem', lg: '0.85rem', xl: '0.9rem' },
                    }}
                  >
                    {typingUsers.size === 1
                      ? 'Noen skriver...'
                      : `${typingUsers.size} personer skriver...`}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Box sx={{ width: { xs: 6, sm: 7, md: 8, lg: 9, xl: 10 }, height: { xs: 6, sm: 7, md: 8, lg: 9, xl: 10 }, borderRadius: '50%', bgcolor: '#f59e0b', animation: 'pulse 1.4s infinite', opacity: 0.7 }} />
                    <Box sx={{ width: { xs: 6, sm: 7, md: 8, lg: 9, xl: 10 }, height: { xs: 6, sm: 7, md: 8, lg: 9, xl: 10 }, borderRadius: '50%', bgcolor: '#f59e0b', animation: 'pulse 1.4s infinite 0.2s', opacity: 0.7 }} />
                    <Box sx={{ width: { xs: 6, sm: 7, md: 8, lg: 9, xl: 10 }, height: { xs: 6, sm: 7, md: 8, lg: 9, xl: 10 }, borderRadius: '50%', bgcolor: '#f59e0b', animation: 'pulse 1.4s infinite 0.4s', opacity: 0.7 }} />
                  </Box>
                </Box>
              )}
              <TextField
                fullWidth
                multiline
                maxRows={4}
                placeholder={`Skriv melding til # ${selectedChannel.display_name}...`}
                value={messageInput}
                onChange={handleMessageInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                    sendTypingIndicator(false); // Stop typing indicator on send
                  }
                }}
                disabled={sendingMessage}
                aria-label={`Skriv melding til kanal ${selectedChannel.display_name}. Trykk Enter for å sende, Shift+Enter for ny linje.`}
                aria-describedby="message-input-help"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(26, 26, 46, 0.8)',
                    border: '1.5px solid rgba(245, 158, 11, 0.3)',
                    borderRadius: '16px',
                    color: '#fff',
                    minHeight: { xs: '52px', sm: '56px', md: '60px', lg: '64px', xl: '68px' },
                    fontSize: { xs: '15px', sm: '16px', md: '17px', lg: '18px', xl: '19px' },
                    padding: { xs: '12px 16px', sm: '14px 18px', md: '16px 20px', lg: '18px 22px', xl: '20px 24px' },
                    backdropFilter: 'blur(10px)',
                    '& fieldset': {
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(245, 158, 11, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#f59e0b',
                      borderWidth: '2px',
                      boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.1)',
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '15px', sm: '16px', md: '17px', lg: '18px', xl: '19px' },
                    lineHeight: 1.6,
                    color: '#fff',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    opacity: 1,
                    fontSize: { xs: '15px', sm: '16px', md: '17px', lg: '18px', xl: '19px' },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CommunityFileAttachment
                          userId={userId}
                          channelId={selectedChannel.id}
                          onFilesUploaded={handleFilesUploaded}
                          disabled={sendingMessage}
                        />
                      </Box>
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end" sx={{ gap: { xs: 0.5, sm: 1 }, ml: { xs: 0.5, sm: 1 } }}>
                      <Tooltip title="Legg til emoji">
                        <IconButton
                          size="small"
                          onClick={handleOpenEmojiPicker}
                          disabled={sendingMessage}
                          aria-label="Legg til emoji"
                          aria-expanded={emojiPickerOpen}
                          aria-controls="emoji-picker-popover"
                          sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            minWidth: { xs: '44px', sm: '48px', md: '52px', lg: '56px' },
                            minHeight: { xs: '44px', sm: '48px', md: '52px', lg: '56px' },
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            borderRadius: '10px',
                            '&:hover': {
                              color: '#f59e0b',
                              background: 'rgba(245, 158, 11, 0.2)',
                              borderColor: 'rgba(245, 158, 11, 0.4)',
                              transform: 'scale(1.05)',
                            },
                            '&:focus': {
                              outline: '3px solid #f59e0b',
                              outlineOffset: '2px',
                            },
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <EmojiEmotions sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} aria-hidden="true" />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        onClick={handleSendMessage}
                        disabled={(!messageInput.trim() && attachedFiles.length === 0) || sendingMessage}
                        aria-label={sendingMessage ? 'Sender melding...' : 'Send melding'}
                        sx={{
                          color: '#fff',
                          background: messageInput.trim() || attachedFiles.length > 0
                            ? 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)'
                            : 'rgba(245, 158, 11, 0.2)',
                          minWidth: { xs: '48px', sm: '52px', md: '56px', lg: '60px', xl: '64px' },
                          minHeight: { xs: '48px', sm: '52px', md: '56px', lg: '60px', xl: '64px' },
                          borderRadius: '12px',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          boxShadow: messageInput.trim() || attachedFiles.length > 0
                            ? '0 4px 12px rgba(245, 158, 11, 0.4)'
                            : 'none',
                          '&:hover:not(.Mui-disabled)': {
                            background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
                            boxShadow: '0 6px 16px rgba(245, 158, 11, 0.5)',
                            transform: 'scale(1.05)',
                          },
                          '&.Mui-disabled': {
                            background: 'rgba(245, 158, 11, 0.1)',
                            color: 'rgba(255, 255, 255, 0.3)',
                            borderColor: 'rgba(245, 158, 11, 0.2)',
                          },
                          '&:focus': {
                            outline: '3px solid #f59e0b',
                            outlineOffset: '2px',
                          },
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {sendingMessage ? (
                          <CircularProgress size={24} sx={{ color: '#fff' }} />
                        ) : (
                          <Send sx={{ fontSize: { xs: 20, sm: 22, md: 24, lg: 26, xl: 28 } }} aria-hidden="true" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}

          {/* Read-only Channel Notice */}
          {selectedChannel && selectedChannel.is_read_only && (
            <Box
              sx={{
                p: { xs: 2, sm: 2.5, md: 3, lg: 3.5, xl: 4 },
                borderTop: '1px solid rgba(245, 158, 11, 0.2)',
                background: 'rgba(245, 158, 11, 0.1)',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.25, sm: 1.5, md: 1.75, lg: 2 } }}>
                <Lock sx={{ fontSize: { xs: 18, sm: 20, md: 22, lg: 24, xl: 26 }, color: '#f59e0b' }} />
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: { xs: '0.875rem', sm: '0.9rem', md: '1rem', lg: '1.1rem', xl: '1.15rem' },
                  }}
                >
                  Denne kanalen er skrivebeskyttet. Kun administratorer kan sende meldinger.
                </Typography>
              </Box>
            </Box>
          )}

          {/* Emoji Picker Popover */}
          <Popover
            open={emojiPickerOpen}
            anchorEl={emojiPickerAnchor}
            onClose={handleCloseEmojiPicker}
            id="emoji-picker-popover"
            role="dialog"
            aria-label="Velg emoji"
            aria-modal="true"
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center',
            }}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
            PaperProps={{
              sx: {
                bgcolor: '#1a1a2e',
                backgroundImage: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(245, 158, 11, 0.1)',
                overflow: 'hidden',
                p: 1,
              },
            }}
          >
            <Box
              sx={{
                width: { xs: '320px', sm: '360px', md: '400px' },
                height: { xs: '400px', sm: '450px', md: '500px' },
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'rgba(18, 18, 31, 0.5)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              {/* Tabs */}
              <Tabs
                value={pickerTab}
                onChange={(_, newValue) => setPickerTab(newValue)}
                sx={{
                  borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                  minHeight: '48px',
                  '& .MuiTab-root': {
                    color: 'rgba(255, 255, 255, 0.6)',
                    textTransform: 'none',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    minHeight: '48px',
                    '&.Mui-selected': {
                      color: '#f59e0b',
                    },
                  },
                  '& .MuiTabs-indicator': {
                    backgroundColor: '#f59e0b',
                  },
                }}
              >
                <Tab 
                  icon={<EmojiEmotions sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                  iconPosition="start"
                  label="Emojis" 
                  value="emojis"
                />
                <Tab 
                  icon={<Face sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                  iconPosition="start"
                  label="Memojis" 
                  value="memojis"
                />
                <Tab 
                  icon={<GifBox sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                  iconPosition="start"
                  label="Memes" 
                  value="memes"
                />
              </Tabs>

              {/* Tab Content */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
                {pickerTab === 'emojis' && (
                  <Box
                    sx={{
                      height: '100%',
                      '& em-emoji-picker': {
                        '--rgb-background': '26, 26, 46',
                        '--rgb-input': '18, 18, 31',
                        '--rgb-color': '255, 255, 255',
                        '--rgb-accent': '245, 158, 11',
                        '--rgb-accent-50': '245, 158, 11, 0.5',
                        '--font-family': 'inherit',
                        '--font-size': '14px',
                        '--border-radius': '12px',
                        '--shadow': '0 4px 16px rgba(0, 0, 0, 0.3)',
                        '--category-icon-size': '20px',
                        '--category-icon-active-size': '24px',
                        height: '100%',
                        width: '100%',
                      },
                      '& em-emoji-picker .emoji-mart': {
                        background: 'transparent',
                      },
                      '& em-emoji-picker .emoji-mart-search': {
                        background: 'rgba(18, 18, 31, 0.6)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        color: '#fff',
                        '&:focus': {
                          borderColor: '#f59e0b',
                        },
                      },
                      '& em-emoji-picker .emoji-mart-category-label': {
                        color: '#f59e0b',
                        fontWeight: 600,
                      },
                      '& em-emoji-picker .emoji-mart-emoji': {
                        '&:hover': {
                          background: 'rgba(245, 158, 11, 0.2)',
                          borderRadius: '8px',
                        },
                      },
                    }}
                  >
                    <Picker
                      data={data}
                      onEmojiSelect={handleEmojiSelect}
                      theme="dark"
                      locale="nb"
                      previewPosition="none"
                      skinTonePosition="none"
                      navPosition="top"
                      searchPosition="sticky"
                      maxFrequentRows={2}
                      perLine={8}
                      emojiSize="24"
                      emojiButtonSize="36"
                    />
                  </Box>
                )}

                {pickerTab === 'memojis' && (
                  <Box sx={{ p: 1 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: 'rgba(255, 255, 255, 0.7)', 
                        mb: 2,
                        fontSize: { xs: '0.8rem', sm: '0.875rem' },
                      }}
                    >
                      Velg en memoji
                    </Typography>
                    <Grid container spacing={1}>
                      {/* Mock memojis - replace with actual API/data */}
                      {[
                        { url: 'https://via.placeholder.com/80/22c55e/ffffff?text=😊', name: 'Happy' },
                        { url: 'https://via.placeholder.com/80/3b82f6/ffffff?text=😎', name: 'Cool' },
                        { url: 'https://via.placeholder.com/80/f59e0b/ffffff?text=🤔', name: 'Thinking' },
                        { url: 'https://via.placeholder.com/80/ef4444/ffffff?text=❤️', name: 'Love' },
                        { url: 'https://via.placeholder.com/80/a855f7/ffffff?text=🎉', name: 'Celebrate' },
                        { url: 'https://via.placeholder.com/80/10b981/ffffff?text=👍', name: 'Thumbs Up' },
                      ].map((memoji, index) => (
                        <Grid item xs={4} sm={3} key={index}>
                          <Box
                            onClick={() => handleMemojiSelect(memoji)}
                            sx={{
                              aspectRatio: '1',
                              borderRadius: '12px',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              border: '2px solid rgba(245, 158, 11, 0.2)',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                borderColor: '#f59e0b',
                                transform: 'scale(1.05)',
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                              },
                            }}
                          >
                            <Box
                              component="img"
                              src={memoji.url}
                              alt={memoji.name}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}

                {pickerTab === 'memes' && (
                  <Box sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Search Bar */}
                    <TextField
                      fullWidth
                      placeholder="Søk etter GIFs..."
                      value={gifSearchQuery}
                      onChange={(e) => {
                        setGifSearchQuery(e.target.value);
                        const query = e.target.value.trim();
                        if (query) {
                          const timeoutId = setTimeout(() => searchGifs(query), 500);
                          return () => clearTimeout(timeoutId);
                        } else {
                          fetchTrendingGifs();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          searchGifs(gifSearchQuery);
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                          background: 'rgba(18, 18, 31, 0.6)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          borderRadius: '8px',
                          color: '#fff',
                          '& fieldset': {
                            borderColor: 'rgba(245, 158, 11, 0.3)',
                          },
                          '&:hover fieldset': {
                            borderColor: 'rgba(245, 158, 11, 0.5)',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#f59e0b',
                          },
                        },
                        '& .MuiInputBase-input': {
                          color: '#fff',
                          fontSize: { xs: '0.875rem', sm: '0.9rem' },
                          '&::placeholder': {
                            color: 'rgba(255, 255, 255, 0.4)',
                            opacity: 1,
                          },
                        },
                      }}
                    />

                    {/* Loading State */}
                    {gifsLoading && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress sx={{ color: '#f59e0b' }} />
                      </Box>
                    )}

                    {/* GIFs Grid */}
                    {!gifsLoading && gifs.length > 0 && (
                      <Box sx={{ flex: 1, overflow: 'auto' }}>
                        <Grid container spacing={1}>
                          {gifs.map((gif) => (
                            <Grid item xs={6} sm={4} key={gif.id}>
                              <Box
                                onClick={() => handleMemeSelect({ url: gif.url, name: gif.title })}
                                sx={{
                                  borderRadius: '12px',
                                  overflow: 'hidden',
                                  cursor: 'pointer',
                                  border: '2px solid rgba(245, 158, 11, 0.2)',
                                  transition: 'all 0.2s ease',
                                  position: 'relative',
                                  aspectRatio: '1',
                                  '&:hover': {
                                    borderColor: '#f59e0b',
                                    transform: 'scale(1.02)',
                                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                                  },
                                }}
                              >
                                <Box
                                  component="img"
                                  src={gif.preview}
                                  alt={gif.title}
                                  sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                  }}
                                  loading="lazy"
                                />
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}

                    {/* Empty State */}
                    {!gifsLoading && gifs.length === 0 && (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <GifBox sx={{ fontSize: 48, color: 'rgba(245, 158, 11, 0.5)', mb: 2 }} />
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'rgba(255, 255, 255, 0.6)',
                            fontSize: { xs: '0.875rem', sm: '0.9rem' },
                          }}
                        >
                          {gifSearchQuery ? 'Ingen resultater funnet' : 'Laster trending GIFs...'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          </Popover>
        </Paper>

        {/* Right Sidebar - Settings Panel (Desktop only) */}
        {!isMobile && (
          <CommunitySettingsSidebar
            userId={userId}
            userName={userProfile?.display_name || 'User'}
            userAvatar={userProfile?.avatar_url}
            isCollapsed={settingsSidebarCollapsed}
            onToggleCollapse={() => setSettingsSidebarCollapsed(!settingsSidebarCollapsed)}
          />
        )}
      </Box>
      </Container>

      {/* Message Context Menu */}
      <Menu
        anchorEl={messageMenuAnchor}
        open={Boolean(messageMenuAnchor)}
        onClose={handleCloseMessageMenu}
      >
        {/* Show Edit/Delete only for own messages */}
        {selectedMessage && selectedMessage.user_id === userId && (
          <>
            <MenuItem onClick={handleStartEdit}>
              <ListItemIcon>
                <Edit fontSize="small" />
              </ListItemIcon>
              <ListItemText>Rediger melding</ListItemText>
            </MenuItem>
            <MenuItem onClick={handleDeleteMessage}>
              <ListItemIcon>
                <Delete fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Slett melding</ListItemText>
            </MenuItem>
            <Divider />
          </>
        )}
        {/* Show Pin/Unpin for moderators */}
        {isModerator && selectedMessage && (
          <>
            <MenuItem
              onClick={() =>
                handlePinMessage(selectedMessage.id, !selectedMessage.is_pinned)
              }
            >
              <ListItemIcon>
                <PushPin fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>
                {selectedMessage.is_pinned ? 'Fjern festing' : 'Fest melding'}
              </ListItemText>
            </MenuItem>
            <Divider />
          </>
        )}
        {/* Show Mark as Solution for thread replies */}
        {selectedMessage && selectedMessage.parent_message_id && (
          <>
            <MenuItem
              onClick={() =>
                handleMarkSolution(selectedMessage.id, !selectedMessage.is_solution)
              }
            >
              <ListItemIcon>
                <CheckCircle fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText>
                {selectedMessage.is_solution ? 'Fjern løsning' : 'Marker som løsning'}
              </ListItemText>
            </MenuItem>
            <Divider />
          </>
        )}
        {/* Show Trigger SOS for unanswered questions */}
        {selectedMessage && !selectedMessage.parent_message_id && selectedMessage.thread_count === 0 && (
          <>
            <MenuItem
              onClick={async () => {
                if (selectedMessage) {
                  try {
                    await apiRequest(`/api/community/messages/${selectedMessage.id}/trigger-sos`, {
                      method: 'POST',
                    });
                        alert('SOS varsel sendt til alle mentorer!');
                    handleCloseMessageMenu();
                  } catch (error) {
                    console.error('Error triggering SOS:', error);
                    alert('Kunne ikke sende SOS varsel');
                  }
                }
              }}
            >
              <ListItemIcon>
                <HelpOutline fontSize="small" color="error" />
              </ListItemIcon>
                  <ListItemText>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Emergency sx={{ fontSize: 18, color: '#ef4444' }} />
                      Send SOS til mentorer
                    </Box>
                  </ListItemText>
            </MenuItem>
            <Divider />
          </>
        )}
        {/* Edit Course Post - Only for course announcements by the instructor */}
        {selectedMessage &&
         selectedMessage.message_type === 'course_announcement' &&
         selectedMessage.user_id === userId &&
         isMentor && (
          <>
            <MenuItem onClick={async () => {
              if (selectedMessage) {
                try {
                  // Fetch the course post details
                  const response = await fetch('/api/academy/courses/community-posts', {
                    credentials: 'include',
                  });
                  const data = await response.json();
                  if (response.ok) {
                    // Find the post that matches this message
                    const post = data.posts?.find((p: any) => p.message_id === selectedMessage.id);
                    if (post) {
                      setEditingPost(post);
                      setEditPostDialogOpen(true);
                    }
                  }
                } catch (error) {
                  console.error('Error fetching post details:', error);
                }
                handleCloseMessageMenu();
              }
            }}>
              <ListItemIcon>
                <Edit fontSize="small" color="secondary" />
              </ListItemIcon>
              <ListItemText>Rediger kursinnlegg</ListItemText>
            </MenuItem>
            <MenuItem onClick={async () => {
              if (selectedMessage) {
                await handleViewAnalytics(selectedMessage);
                handleCloseMessageMenu();
              }
            }}>
              <ListItemIcon>
                <TrendingUp fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>Vis statistikk</ListItemText>
            </MenuItem>
            <Divider />
          </>
        )}

        {/* Publish Course - Only for mentors */}
        {isMentor && (
          <>
            <MenuItem onClick={() => {
              handleOpenPublishDialog();
              handleCloseMessageMenu();
            }}>
              <ListItemIcon>
                <Announcement fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText>Publiser kurs her</ListItemText>
            </MenuItem>
            <Divider />
          </>
        )}

        {/* Bookmark message */}
        <MenuItem onClick={() => selectedMessage && handleBookmarkMessage(selectedMessage.id)}>
          <ListItemIcon>
            <Bookmark fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText>Lagre melding</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (selectedMessage) {
              setSearchScope('channel');
              setSearchScopeId(selectedMessage.channel_id);
              setSearchScopeName(selectedChannel?.display_name);
              setSearchDialogOpen(true);
              handleCloseMessageMenu();
            }
          }}
        >
          <ListItemIcon>
            <SearchIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Søk i denne kanalen</ListItemText>
        </MenuItem>
        {selectedMessage && selectedMessage.parent_message_id && (
          <MenuItem
            onClick={() => {
              if (selectedMessage) {
                setSearchScope('thread');
                setSearchScopeId(selectedMessage.parent_message_id || selectedMessage.id);
                setSearchScopeName('denne tråden');
                setSearchDialogOpen(true);
                handleCloseMessageMenu();
              }
            }}
          >
            <ListItemIcon>
              <Forum fontSize="small" />
            </ListItemIcon>
            <ListItemText>Søk i denne tråden</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={handleOpenReportDialog}>
          <ListItemIcon>
            <Report fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Rapporter melding</ListItemText>
        </MenuItem>
      </Menu>

      {/* Report Dialog */}
      {reportedMessage && (
        <ReportDialog
          open={reportDialogOpen}
          onClose={handleCloseReportDialog}
          reporterId={userId}
          reportedUserId={reportedMessage.user_id}
          reportedMessageId={reportedMessage.id}
          channelId={selectedChannel?.id}
        />
      )}

      {/* Thread View Dialog */}
      {threadMessageId && (
        <ThreadViewDialog
          open={threadDialogOpen}
          onClose={() => {
            setThreadDialogOpen(false);
            setThreadMessageId(null);
          }}
          messageId={threadMessageId}
          userId={userId}
          channelId={selectedChannel?.id || ', '}
        />
      )}

      {/* User Profile Modal */}
      {selectedProfileUserId && (
        <UserProfileModal
          open={profileModalOpen}
          onClose={() => {
            setProfileModalOpen(false);
            setSelectedProfileUserId(null);
          }}
          userId={selectedProfileUserId}
          currentUserId={userId}
          onStartDM={(targetUserId, targetUserName, targetUserAvatar) => {
            // Broadcast event to open DM (will be caught by CommunityDMProvider)
            communication.sendBroadcast('chat:open-dm', {
              conversationId: null,
              participantId: targetUserId,
              participantName: targetUserName,
              participantAvatar: targetUserAvatar,
            });
            // Close the profile modal
            setProfileModalOpen(false);
            setSelectedProfileUserId(null);
          }}
        />
      )}

      {/* Advanced Search Dialog */}
      <AdvancedSearchDialog
        open={searchDialogOpen}
        onClose={() => {
          setSearchDialogOpen(false);
          setSearchScope('all');
          setSearchScopeId(undefined);
          setSearchScopeName(undefined);
        }}
        defaultScope={searchScope}
        defaultScopeId={searchScopeId}
        defaultScopeName={searchScopeName}
        onSelectMessage={(messageId, channelId) => {
          const channel = channels.find((c) => c.id === channelId);
          if (channel) {
            setSelectedChannel(channel);
            // TODO: Scroll to specific message
          }
        }}
        onSelectThread={(threadId, channelId) => {
          const channel = channels.find((c) => c.id === channelId);
          if (channel) {
            setSelectedChannel(channel);
            setThreadMessageId(threadId);
            setThreadDialogOpen(true);
          }
        }}
        onSelectUser={(userId) => {
          setSelectedProfileUserId(userId);
          setProfileModalOpen(true);
        }}
        onSaveResult={(resultId) => {
          // TODO: Implement save functionality
          console.log('Save result:', resultId);
        }}
        onConvertToArticle={(messageId) => {
          // TODO: Implement convert to article
          console.log('Convert to article:', messageId);
        }}
      />

      {/* GDPR Cookie Consent Banner */}
      <GdprNotice position="bottom" />

      {/* Welcome Onboarding Dialog */}
      <WelcomeOnboardingDialog
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        userName={user?.name || 'Bruker'}
        onComplete={() => {
          // Mark onboarding as complete in user preferences
          // TODO: Save to backend
          console.log('Onboarding complete');
        }}
      />

      {/* Badge Notification */}
      {earnedBadge && (
        <BadgeNotification
          open={badgeNotificationOpen}
          onClose={() => setBadgeNotificationOpen(false)}
          badge={earnedBadge}
        />
      )}

      {/* Become Mentor Dialog */}
      <BecomeMentorDialog
        open={becomeMentorDialogOpen}
        onClose={() => setBecomeMentorDialogOpen(false)}
        groupId={selectedGroup?.id || ', '}
        onSuccess={() => {
          // Refresh mentor status
          checkModeratorStatus();
          fetchMentors();
          // Success message is now shown in the dialog with navigation buttons
        }}
      />

      {/* Mentor Dashboard */}
      {isMentor && (
        <MentorDashboard
          open={mentorDashboardOpen}
          onClose={() => setMentorDashboardOpen(false)}
          userId={userId}
          onSelectQuestion={(messageId, channelId) => {
            // Find the channel and navigate to it
            const channel = channels.find((c) => c.id === channelId);
            if (channel) {
              setSelectedChannel(channel);
              // TODO: Scroll to specific message
            }
          }}
        />
      )}

      {/* Voting Board Dialog */}
      <Dialog
        open={votingBoardOpen}
        onClose={() => setVotingBoardOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { minHeight: '80vh' } }}
      >
        <VotingBoard
          groupId={selectedGroup?.id || ', '}
          userId={userId}
          onClose={() => setVotingBoardOpen(false)}
        />
      </Dialog>

      {/* Publish to Community Dialog */}
      {isMentor && (
        <PublishToCommunityDialog
          open={publishToCommunityDialogOpen}
          onClose={() => {
            setPublishToCommunityDialogOpen(false);
            setPublishedCourses([]);
          }}
          allCourses={publishedCourses}
          onSuccess={() => {
            // Refresh messages to show the new course announcement
            console.log('Course published to community successfully');
          }}
        />
      )}

      {/* Edit Post Dialog */}
      {isMentor && editingPost && (
        <EditPostDialog
          open={editPostDialogOpen}
          onClose={() => {
            setEditPostDialogOpen(false);
            setEditingPost(null);
          }}
          post={editingPost}
          onSuccess={() => {
            console.log('Post updated successfully');
            // Optionally refresh messages
          }}
        />
      )}

      {/* Published Posts Management Dialog */}
      {isMentor && (
        <Dialog
          open={showPublishedPosts}
          onClose={() => setShowPublishedPosts(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Administrer Kursinnlegg</Typography>
              <IconButton onClick={() => setShowPublishedPosts(false)}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3}>
              {/* Scheduled Posts Widget */}
              <ScheduledPostsWidget />

              {/* Published Posts List */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Publiserte innlegg
                </Typography>
                {publishedPosts.length === 0 ? (
                  <Alert severity="info">
                    Ingen publiserte innlegg funnet.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {publishedPosts.map((post) => (
                      <Card key={post.id} variant="outlined">
                        <CardContent>
                          <Box display="flex" gap={2}>
                            {post.course_thumbnail && (
                              <Avatar
                                src={post.course_thumbnail}
                                variant="rounded"
                                sx={{ width: 80, height: 80 }}
                              />
                            )}
                            <Box flex={1}>
                              <Typography variant="h6" gutterBottom>
                                {post.course_title}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" gutterBottom>
                                Kanal: {post.channel_name}
                              </Typography>
                              <Box display="flex" gap={1} mt={1}>
                                <Chip
                                  icon={<Visibility />}
                                  label={`${post.views_count || 0} visninger`}
                                  size="small"
                                />
                                <Chip
                                  icon={<TouchApp />}
                                  label={`${post.clicks_count || 0} klikk`}
                                  size="small"
                                />
                                {post.edit_count > 0 && (
                                  <Chip
                                    label={`Redigert ${post.edit_count} gang(er)`}
                                    size="small"
                                    color="warning"
                                  />
                                )}
                              </Box>
                            </Box>
                            <Box display="flex" flexDirection="column" gap={1}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Edit />}
                                onClick={() => {
                                  setEditingPost(post);
                                  setEditPostDialogOpen(true);
                                }}
                              >
                                Rediger
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Visibility />}
                                onClick={() => {
                                  // Navigate to the message in the channel
                                  const channel = channels.find(c => c.id === post.channel_id);
                                  if (channel) {
                                    setSelectedChannel(channel);
                                    setShowPublishedPosts(false);
                                  }
                                }}
                              >
                                Vis
                              </Button>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Box>
            </Stack>
          </DialogContent>
        </Dialog>
      )}

      {/* Analytics Dialog */}
      {isMentor && (
        <CoursePostAnalyticsDialog
          open={showAnalyticsDialog}
          onClose={() => {
            setShowAnalyticsDialog(false);
            setAnalyticsPost(null);
            setAnalyticsData(null);
          }}
          post={analyticsPost}
          analyticsData={analyticsData}
          loading={loadingAnalytics}
        />
      )}

      {/* Notification Drawer */}
      <Drawer
        anchor="right"
        open={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: isMobile ? '100%': 400,
            maxWidth: '100%',
          }}}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">Varsler</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Innstillinger">
              <IconButton onClick={() => setNotificationPreferencesOpen(true)} size="small">
                <Settings />
              </IconButton>
            </Tooltip>
            <IconButton onClick={() => setNotificationDrawerOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'visible' }}>
          <CommunityNotificationFeed
            userId={userId}
            maxHeight={window.innerHeight - 100}
          />
        </Box>
      </Drawer>

      {/* Notification Preferences Dialog */}
      <Dialog
        open={notificationPreferencesOpen}
        onClose={() => setNotificationPreferencesOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Varslingsinnstillinger</Typography>
            <IconButton onClick={() => setNotificationPreferencesOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Velg hvilke typer varsler du vil motta fra fellesskapet.
            </Typography>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                <Box>
                  <Typography variant="body1">📢 Nevninger</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Når noen nevner deg med @brukernavn
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_mentions}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_mentions: e.target.checked,
                  })}
                />
              </Box>
              <Divider />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Reply sx={{ fontSize: 20, color: '#f59e0b' }} />
                    <Typography variant="body1">Svar</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Når noen svarer på meldingene dine
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_replies}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_replies: e.target.checked,
                  })}
                />
              </Box>
              <Divider />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Favorite sx={{ fontSize: 20, color: '#f59e0b' }} />
                    <Typography variant="body1">Reaksjoner</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Når noen reagerer på meldingene dine
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_reactions}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_reactions: e.target.checked,
                  })}
                />
              </Box>
              <Divider />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WorkspacePremium sx={{ fontSize: 20, color: '#f59e0b' }} />
                    <Typography variant="body1">Merker</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Når du tjener nye merker
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_badges}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_badges: e.target.checked,
                  })}
                />
              </Box>
              <Divider />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', py: 1 }}>
                <Box>
                  <Typography variant="body1">🛡️ Moderering</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Når moderatorer tar handling på innholdet ditt
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_moderation}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_moderation: e.target.checked,
                  })}
                />
              </Box>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Prototype Feedback Tool - Community Context Aware */}
      {(isPrototypeTester || isAdmin) && (
        <PrototypeFeedbackTool
          profession={profession}
          component={currentCommunityComponent}
          communityContext={true}
          communityComponent={currentCommunityComponent as any}
        />
      )}

      {/* Community Tutorial - Shows on first visit or via Help button */}
      <CommunityTutorial
        open={showCommunityTutorial}
        onClose={closeCommunityTutorial}
        profession={profession}
        onDismiss={closeCommunityTutorial}
      />
    </Box>
  );
}

