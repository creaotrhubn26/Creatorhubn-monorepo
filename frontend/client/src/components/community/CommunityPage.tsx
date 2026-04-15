// @ts-nocheck
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

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Alert,
  Switch,
} from '@mui/material';
import {
  Send,
  AttachFile,
  EmojiEmotions,
  MoreVert,
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
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import PrototypeFeedbackTool from '../feedback/PrototypeFeedbackTool';
import { useAuth } from '@/hooks/useAuth';
import { CommunityTutorial, useCommunityTutorial } from './CommunityTutorial';
import CommunityHomeDashboard from './CommunityHomeDashboard';
import {
  COMMUNITY_DIALOG_CLOSE_BUTTON_SX,
  COMMUNITY_DIALOG_CONTENT_SX,
  COMMUNITY_DIALOG_MUTED,
  COMMUNITY_DIALOG_PAPER_SX,
  COMMUNITY_DIALOG_SECONDARY_BUTTON_SX,
  COMMUNITY_DIALOG_SURFACE_SUBTLE_SX,
  COMMUNITY_DIALOG_SX,
  COMMUNITY_DIALOG_SWITCH_SX,
  COMMUNITY_DIALOG_TEXT,
  COMMUNITY_DIALOG_TITLE_SX,
} from './communityDialogStyles';

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

interface CommunityStats {
  messages: number;
  reactions: number;
  solutions: number;
}

interface NotificationPreferencesState {
  notify_mentions: boolean;
  notify_replies: boolean;
  notify_reactions: boolean;
  notify_badges: boolean;
  notify_moderation: boolean;
  notify_followed_threads: boolean;
  notify_daily_digest: boolean;
  notify_mentor_requests: boolean;
  notify_course_discussions: boolean;
}

interface CommunityNeedsHelpQuestion {
  id: string;
  content: string;
  user_name: string;
  user_avatar?: string;
  channel_name: string;
  channel_id?: string;
  created_at: string;
  hours_waiting: number;
}

interface CommunityProfilePreference {
  interests: string[];
  goals: string[];
  firstAction?: string;
}

const COMMUNITY_SHELL_BACKGROUND = `
  radial-gradient(circle at top right, rgba(245, 166, 35, 0.14), transparent 28%),
  radial-gradient(circle at bottom left, rgba(88, 122, 168, 0.18), transparent 32%),
  linear-gradient(180deg, #05070b 0%, #091019 52%, #06080c 100%)
`;
const COMMUNITY_PANEL_BACKGROUND =
  'linear-gradient(180deg, rgba(13, 18, 27, 0.94), rgba(8, 12, 18, 0.94))';
const COMMUNITY_PANEL_BORDER = '1px solid rgba(255,255,255,0.08)';
const COMMUNITY_PANEL_SHADOW = '0 24px 60px rgba(0, 0, 0, 0.36)';
const COMMUNITY_INSET_BACKGROUND = 'rgba(6, 9, 14, 0.58)';
const COMMUNITY_HOVER_BACKGROUND = 'rgba(255,255,255,0.04)';
const COMMUNITY_TEXT_PRIMARY = 'rgba(248, 241, 231, 0.92)';
const COMMUNITY_TEXT_MUTED = 'rgba(248, 241, 231, 0.64)';
const COMMUNITY_ACCENT = '#f5a623';
const COMMUNITY_PROFILE_STORAGE_KEY = 'creatorhub-community-onboarding-profile-v1';
const COMMUNITY_UPCOMING_EVENTS = [
  {
    id: 'mentor-office-hours',
    title: 'Mentortid',
    subtitle: '15-min raske sparringer på spørsmål som stopper progresjon.',
    dateLabel: 'Tirsdag 18:00',
    type: 'Mentor',
  },
  {
    id: 'academy-roundtable',
    title: 'Academy-rundebord',
    subtitle: 'Diskuter ukens leksjoner og hva som faktisk fungerer i praksis.',
    dateLabel: 'Onsdag 20:00',
    type: 'Academy',
  },
  {
    id: 'feedback-friday',
    title: 'Tilbakemeldingsfredag',
    subtitle: 'Del work-in-progress og få raske tilbakemeldinger fra community.',
    dateLabel: 'Fredag 16:30',
    type: 'Tilbakemelding',
  },
] as const;

export default function CommunityPage({ userId, profession }: CommunityPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { communication } = useEnhancedMasterIntegration();
  
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
  const [selectedView, setSelectedView] = useState<'home' | 'channel'>('home');
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userStats, setUserStats] = useState<CommunityStats>({
    messages: 0,
    reactions: 0,
    solutions: 0,
  });
  const [needsHelpQueue, setNeedsHelpQueue] = useState<CommunityNeedsHelpQuestion[]>([]);
  const [channelPreviewMessages, setChannelPreviewMessages] = useState<Record<string, CommunityMessage[]>>({});
  const [communityProfile, setCommunityProfile] = useState<CommunityProfilePreference>({
    interests: [],
    goals: [],
  });

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
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);
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
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferencesState>({
    notify_mentions: true,
    notify_replies: true,
    notify_reactions: true,
    notify_badges: true,
    notify_moderation: true,
    notify_followed_threads: true,
    notify_daily_digest: false,
    notify_mentor_requests: true,
    notify_course_discussions: true,
  });

  const loadCommunityProfile = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(COMMUNITY_PROFILE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setCommunityProfile({
        interests: Array.isArray(parsed?.interests) ? parsed.interests : [],
        goals: Array.isArray(parsed?.goals) ? parsed.goals : [],
        firstAction: typeof parsed?.firstAction === 'string' ? parsed.firstAction : undefined,
      });
    } catch (error) {
      console.error('Error loading community profile:', error);
    }
  }, []);

  useEffect(() => {
    fetchUserCommunityData();
    checkModeratorStatus();
    checkFirstTimeUser();
    fetchMentors();
    checkMentorEligibility();
    fetchUnreadNotificationCount();
    fetchNotificationPreferences();
    fetchCommunityStats();
    fetchNeedsHelpQueue();
    fetchPublishedPosts();
    loadCommunityProfile();
  }, [userId, profession, loadCommunityProfile]);

  // Track current community component for prototype feedback context
  useEffect(() => {
    if (votingBoardOpen) {
      setCurrentCommunityComponent('VotingBoard');
    } else if (mentorDashboardOpen) {
      setCurrentCommunityComponent('MentorDashboard');
    } else if (threadDialogOpen) {
      setCurrentCommunityComponent('ThreadViewDialog');
    } else if (advancedSearchOpen) {
      setCurrentCommunityComponent('AdvancedSearchDialog');
    } else if (profileModalOpen) {
      setCurrentCommunityComponent('UserProfileModal');
    } else if (notificationDrawerOpen) {
      setCurrentCommunityComponent('CommunityNotificationFeed');
    } else {
      setCurrentCommunityComponent('CommunityPage');
    }
  }, [votingBoardOpen, mentorDashboardOpen, threadDialogOpen, advancedSearchOpen, profileModalOpen, notificationDrawerOpen]);

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

  useEffect(() => {
    if (showCommunityTutorial && onboardingOpen) {
      setOnboardingOpen(false);
    }
  }, [showCommunityTutorial, onboardingOpen]);

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
          notify_followed_threads: response.preferences.notify_followed_threads ?? true,
          notify_daily_digest: response.preferences.notify_daily_digest ?? false,
          notify_mentor_requests: response.preferences.notify_mentor_requests ?? true,
          notify_course_discussions: response.preferences.notify_course_discussions ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    }
  };

  const fetchCommunityStats = async () => {
    try {
      const response = await apiRequest(`/api/community/user/${userId}/stats`, {
        method: 'GET',
      }) as { success: boolean; stats: CommunityStats };

      if (response.success && response.stats) {
        setUserStats({
          messages: Number(response.stats.messages || 0),
          reactions: Number(response.stats.reactions || 0),
          solutions: Number(response.stats.solutions || 0),
        });
      }
    } catch (error) {
      console.error('Error fetching community stats:', error);
    }
  };

  const fetchNeedsHelpQueue = async () => {
    try {
      const response = await apiRequest('/api/community/unanswered', {
        method: 'GET',
      }) as {
        success: boolean;
        unanswered?: CommunityNeedsHelpQuestion[];
        messages?: CommunityNeedsHelpQuestion[];
      };

      const queue = Array.isArray(response.unanswered)
        ? response.unanswered
        : Array.isArray(response.messages)
          ? response.messages
          : [];

      setNeedsHelpQueue(queue);
    } catch (error) {
      console.error('Error fetching needs-help queue:', error);
    }
  };

  const updateNotificationPreferences = async (preferences: NotificationPreferencesState) => {
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
            alert('🎓 Du er nå kvalifisert til å bli mentor! Klikk på "Bli Mentor" knappen for å komme i gang.');
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
    const localOnboardingComplete = (() => {
      try {
        return localStorage.getItem(`community-onboarding-complete-${userId}`) === 'true';
      } catch {
        return false;
      }
    })();

    if (localOnboardingComplete) {
      return;
    }

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

    // Initial fetch
    fetchChannelMessages(selectedChannel.id);

    // Connect to WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/events`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ Community WebSocket connected, ');
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
  }, [selectedChannel, userId, profession]);

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

  const resolveChannel = useCallback((channelIdentifier?: string | null) => {
    if (!channelIdentifier) return null;
    return channels.find((channel) =>
      channel.id === channelIdentifier
      || channel.display_name === channelIdentifier
      || channel.name === channelIdentifier,
    ) || null;
  }, [channels]);

  const openChannel = useCallback((channel: CommunityChannel | null) => {
    if (!channel) return;
    setSelectedChannel(channel);
    setSelectedView('channel');
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  }, [isMobile]);

  const openChannelByIdentifier = useCallback((channelIdentifier?: string | null) => {
    const channel = resolveChannel(channelIdentifier);
    if (channel) {
      openChannel(channel);
    }
  }, [openChannel, resolveChannel]);

  const fetchChannelPreviews = useCallback(async (nextChannels: CommunityChannel[]) => {
    try {
      const previewEntries = await Promise.all(
        nextChannels.slice(0, 4).map(async (channel) => {
          const response = await apiRequest(`/api/community/channels/${channel.id}/messages`, {
            method: 'GET',
          }) as { success: boolean; messages: CommunityMessage[] };

          return [
            channel.id,
            response.success ? response.messages : [],
          ] as const;
        }),
      );

      setChannelPreviewMessages((prev) => ({
        ...prev,
        ...Object.fromEntries(previewEntries),
      }));
    } catch (error) {
      console.error('Error fetching channel previews:', error);
    }
  }, []);

  const fetchUserCommunityData = async () => {
    try {
      setLoading(true);

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
      const response = await apiRequest(`/api/community/user/${userId}/channels?groupId=${groupId}`, {
        method: 'GET',
      }) as { success: boolean; channels: CommunityChannel[] };

      if (response.success) {
        setChannels(response.channels);
        void fetchChannelPreviews(response.channels);
        
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
      const response = await apiRequest(`/api/community/channels/${channelId}/messages`, {
        method: 'GET',
      }) as { success: boolean; messages: CommunityMessage[] };

      if (response.success) {
        setMessages(response.messages);
        setChannelPreviewMessages((prev) => ({
          ...prev,
          [channelId]: response.messages,
        }));
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

  const handleOpenEmojiPicker = (event: React.MouseEvent<HTMLElement>) => {
    setEmojiPickerAnchor(event.currentTarget);
  };

  const handleCloseEmojiPicker = () => {
    setEmojiPickerAnchor(null);
  };

  // Typing indicator with debouncing
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedChannel) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_indicator',
        userId,
        channelId: selectedChannel.id,
        isTyping,
      }));
    }
  }, [userId, selectedChannel]);

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
        alert('✅ Melding markert som løsning!');
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

  const allKnownMessages = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...messages, ...Object.values(channelPreviewMessages).flat()];
    return combined.filter((message) => {
      if (!message?.id || seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    });
  }, [messages, channelPreviewMessages]);

  const fallbackNeedsHelpQueue = useMemo<CommunityNeedsHelpQuestion[]>(() => {
    const now = Date.now();
    return allKnownMessages
      .filter((message) =>
        message.user_id !== userId
        && /\?/.test(message.content || '')
        && !message.is_solution
        && Number(message.thread_count || 0) === 0,
      )
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 6)
      .map((message) => ({
        id: message.id,
        content: message.content,
        user_name: message.user_name,
        user_avatar: message.user_avatar || undefined,
        channel_name: resolveChannel(message.channel_id)?.display_name || 'community',
        channel_id: message.channel_id,
        created_at: message.created_at,
        hours_waiting: Math.max(
          1,
          Math.round((now - new Date(message.created_at).getTime()) / (1000 * 60 * 60)),
        ),
      }));
  }, [allKnownMessages, resolveChannel, userId]);

  const effectiveNeedsHelpQueue = useMemo(
    () => (needsHelpQueue.length > 0 ? needsHelpQueue : fallbackNeedsHelpQueue),
    [needsHelpQueue, fallbackNeedsHelpQueue],
  );

  const yourThreads = useMemo(
    () =>
      allKnownMessages
        .filter((message) => message.user_id === userId)
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allKnownMessages, userId],
  );

  const knowledgeFeed = useMemo(
    () =>
      allKnownMessages
        .filter((message) => message.is_solution || Number(message.thread_count || 0) > 0)
        .slice()
        .sort((a, b) => {
          const solutionDelta = Number(Boolean(b.is_solution)) - Number(Boolean(a.is_solution));
          if (solutionDelta !== 0) return solutionDelta;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
    [allKnownMessages],
  );

  const academyAnnouncements = useMemo(
    () => allKnownMessages.filter((message) => message.message_type === 'course_announcement'),
    [allKnownMessages],
  );

  const mentorsOnline = useMemo(() => {
    const mentorMap = new Map<string, { id: string; name: string; avatar?: string | null }>();
    allKnownMessages.forEach((message) => {
      if (!mentorIds.has(message.user_id) || !onlineUsers.has(message.user_id)) return;
      mentorMap.set(message.user_id, {
        id: message.user_id,
        name: message.user_name,
        avatar: message.user_avatar,
      });
    });
    return Array.from(mentorMap.values());
  }, [allKnownMessages, mentorIds, onlineUsers]);

  const badgeTracks = useMemo(
    () => [
      {
        id: 'helpful',
        label: 'Hjelpsom responder',
        detail: 'Markerte løsninger bygger troverdighet og hjelper nye medlemmer raskere.',
        current: userStats.solutions,
        target: 5,
        accent: '#78df9c',
      },
      {
        id: 'builder',
        label: 'Samtalebygger',
        detail: 'Jevn aktivitet gjør deg lettere å finne og følge i community.',
        current: userStats.messages,
        target: 20,
        accent: '#7aa7ff',
      },
      {
        id: 'academy-bridge',
        label: 'Academy-brobygger',
        detail: 'Koble læring til praksis ved å starte diskusjoner rundt kurs og leksjoner.',
        current: academyAnnouncements.length + publishedPosts.length,
        target: 3,
        accent: '#f5a623',
      },
    ],
    [academyAnnouncements.length, publishedPosts.length, userStats.messages, userStats.solutions],
  );

  const composerSuggestions = useMemo(() => {
    const query = messageInput.trim().toLowerCase();
    if (query.length < 12) return [];
    const tokens = Array.from(
      new Set(
        query
          .split(/[^a-zA-Z0-9æøåÆØÅ]+/)
          .map((token) => token.trim())
          .filter((token) => token.length > 2),
      ),
    );
    if (tokens.length === 0) return [];

    return knowledgeFeed
      .map((message) => {
        const haystack = `${message.content} ${message.user_name}`.toLowerCase();
        const score = tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
        return { message, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.message.created_at).getTime() - new Date(a.message.created_at).getTime();
      })
      .slice(0, 3)
      .map((entry) => entry.message);
  }, [knowledgeFeed, messageInput]);

  const handleUsePromptTemplate = useCallback((prompt: string, channelId?: string) => {
    if (channelId) {
      openChannelByIdentifier(channelId);
    } else if (selectedChannel) {
      setSelectedView('channel');
    } else if (channels[0]) {
      openChannel(channels[0]);
    }
    setMessageInput(prompt);
  }, [channels, openChannel, openChannelByIdentifier, selectedChannel]);

  const handleOpenDiscussion = useCallback((channelId: string, messageId: string) => {
    openChannelByIdentifier(channelId);
    const target = allKnownMessages.find((message) => message.id === messageId);
    if (target && (target.thread_count || target.parent_message_id)) {
      setThreadMessageId(target.parent_message_id || target.id);
      setThreadDialogOpen(true);
    }
  }, [allKnownMessages, openChannelByIdentifier]);

  const handleSelectNeedsHelpQuestion = useCallback((question: CommunityNeedsHelpQuestion) => {
    openChannelByIdentifier(question.channel_id || question.channel_name);
    setThreadMessageId(question.id);
    setThreadDialogOpen(true);
  }, [openChannelByIdentifier]);

  const renderSidebar = () => (
    <Box
      sx={{
        width: isMobile ? 280 : 300,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: COMMUNITY_TEXT_PRIMARY,
      }}
    >
      {/* User Profile Header */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 4,
          background: COMMUNITY_PANEL_BACKGROUND,
          border: COMMUNITY_PANEL_BORDER,
          boxShadow: COMMUNITY_PANEL_SHADOW,
          color: COMMUNITY_TEXT_PRIMARY,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={user?.picture}
            sx={{
              width: 50,
              height: 50,
              bgcolor: 'rgba(245, 166, 35, 0.18)',
              color: COMMUNITY_ACCENT,
              border: '1px solid rgba(245, 166, 35, 0.2)',
            }}
          >
            {user?.name?.[0]}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: COMMUNITY_TEXT_PRIMARY }}>
              {user?.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {userBadges.slice(0, 3).map((badge) => (
                <Tooltip key={badge.id} title={badge.name}>
                  <Chip
                    label={badge.icon}
                    size="small"
                    sx={{
                      bgcolor: badge.color,
                      color: 'white',
                      fontSize: '10px',
                      height: 20}}
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
            const channel = resolveChannel(channelName);
            if (channel) {
              openChannel(channel);
              setThreadMessageId(questionId);
              setThreadDialogOpen(true);
            }
          }}
        />
      </Box>

      {/* Groups */}
      <Paper
        sx={{
          flex: 1,
          overflow: 'auto',
          borderRadius: 4,
          background: COMMUNITY_PANEL_BACKGROUND,
          border: COMMUNITY_PANEL_BORDER,
          boxShadow: COMMUNITY_PANEL_SHADOW,
          color: COMMUNITY_TEXT_PRIMARY,
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ color: COMMUNITY_TEXT_PRIMARY }}>
            Dine Grupper
          </Typography>
        </Box>
        <List>
          {groups.map((group) => (
            <ListItemButton
              key={group.id}
              selected={selectedGroup?.id === group.id}
              onClick={() => {
                setSelectedGroup(group);
                fetchGroupChannels(group.id);
                setSelectedView('home');
                if (isMobile) setMobileDrawerOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mx: 1,
                mb: 0.5,
                color: COMMUNITY_TEXT_PRIMARY,
                '& .MuiListItemIcon-root': {
                  color: COMMUNITY_TEXT_MUTED,
                  minWidth: 38,
                },
                '& .MuiListItemText-secondary': {
                  color: COMMUNITY_TEXT_MUTED,
                },
                '&.Mui-selected': {
                  background: 'rgba(245, 166, 35, 0.12)',
                  border: '1px solid rgba(245, 166, 35, 0.22)',
                  '& .MuiListItemIcon-root': {
                    color: COMMUNITY_ACCENT,
                  },
                  '&:hover': {
                    background: 'rgba(245, 166, 35, 0.16)',
                  },
                },
                '&:hover': {
                  background: COMMUNITY_HOVER_BACKGROUND,
                },
              }}
            >
              <ListItemIcon>
                <Typography fontSize="24px">{group.icon}</Typography>
              </ListItemIcon>
              <ListItemText
                primary={group.name}
                secondary={`${group.member_count} medlemmer`}
              />
            </ListItemButton>
          ))}
        </List>

        {/* Channels */}
        {selectedGroup && (
          <>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ color: COMMUNITY_TEXT_PRIMARY }}>
                Kanaler
              </Typography>
            </Box>
            <List>
              {channels.map((channel) => (
                <ListItemButton
                  key={channel.id}
                  selected={selectedChannel?.id === channel.id}
                  onClick={() => {
                    openChannel(channel);
                  }}
                  disabled={!!channel.requires_feature && !channel.is_default}
                  sx={{
                    borderRadius: 2,
                    mx: 1,
                    mb: 0.5,
                    color: COMMUNITY_TEXT_PRIMARY,
                    '& .MuiListItemIcon-root': {
                      color: COMMUNITY_TEXT_MUTED,
                      minWidth: 38,
                    },
                    '& .MuiListItemText-secondary': {
                      color: COMMUNITY_TEXT_MUTED,
                    },
                    '&.Mui-selected': {
                      background: 'rgba(245, 166, 35, 0.12)',
                      border: '1px solid rgba(245, 166, 35, 0.22)',
                      '& .MuiListItemIcon-root': {
                        color: COMMUNITY_ACCENT,
                      },
                      '&:hover': {
                        background: 'rgba(245, 166, 35, 0.16)',
                      },
                    },
                    '&.Mui-disabled': {
                      opacity: 0.5,
                    },
                    '&:hover': {
                      background: COMMUNITY_HOVER_BACKGROUND,
                    },
                  }}
                >
                  <ListItemIcon>
                    {channel.is_read_only ? (
                      <Announcement fontSize="small" />
                    ) : channel.requires_feature ? (
                      <Lock fontSize="small" color="disabled" />
                    ) : (
                      <Tag fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={`# ${channel.display_name}`}
                    secondary={channel.description}
                  />
                  {channel.unread_count && channel.unread_count > 0 && (
                    <Badge badgeContent={channel.unread_count} color="primary" />
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
          p: 1,
          borderRadius: 4,
          background: COMMUNITY_PANEL_BACKGROUND,
          border: COMMUNITY_PANEL_BORDER,
          boxShadow: COMMUNITY_PANEL_SHADOW,
        }}
      >
        <Stack spacing={1}>
          <Button
            fullWidth
            variant={selectedView === 'home' ? 'contained' : 'outlined'}
            startIcon={<DashboardIcon />}
            onClick={() => setSelectedView('home')}
            sx={{
              textTransform: 'none',
              justifyContent: 'flex-start',
              color: selectedView === 'home' ? '#05070b' : COMMUNITY_TEXT_PRIMARY,
              borderColor: 'rgba(255,255,255,0.1)',
              bgcolor: selectedView === 'home' ? COMMUNITY_ACCENT : 'transparent',
              '&:hover': {
                borderColor: 'rgba(245, 166, 35, 0.22)',
                bgcolor: selectedView === 'home' ? '#ffcd73' : 'rgba(245, 166, 35, 0.08)',
              },
            }}
          >
            Community-hjem
          </Button>
          {/* Back to Dashboard Button */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => {
              // Navigate back to UniversalDashboard
              window.history.back();
            }}
            sx={{
              textTransform: 'none',
              justifyContent: 'flex-start',
              color: COMMUNITY_TEXT_PRIMARY,
              borderColor: 'rgba(255,255,255,0.1)',
              '&:hover': {
                borderColor: 'rgba(245, 166, 35, 0.22)',
                bgcolor: 'rgba(245, 166, 35, 0.08)',
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
                color="secondary"
                startIcon={<School />}
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
                sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
              >
                Academy-oversikt
              </Button>

              {/* Publish Course Button */}
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                startIcon={<Announcement />}
                onClick={handleOpenPublishDialog}
                sx={{
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  color: COMMUNITY_TEXT_PRIMARY,
                  borderColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    borderColor: 'rgba(245, 166, 35, 0.22)',
                    bgcolor: 'rgba(245, 166, 35, 0.08)',
                  },
                }}
              >
                Publiser Kurs
              </Button>

              {/* Manage Published Posts Button */}
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                startIcon={<Edit />}
                onClick={handleOpenPublishedPosts}
                sx={{
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  color: COMMUNITY_TEXT_PRIMARY,
                  borderColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    borderColor: 'rgba(245, 166, 35, 0.22)',
                    bgcolor: 'rgba(245, 166, 35, 0.08)',
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
          gap: 2,
          p: 2,
          borderRadius: 3,
          color: COMMUNITY_TEXT_PRIMARY,
          background: isOwnMessage ? 'rgba(245, 166, 35, 0.04)' : 'transparent',
          '&:hover': {
            bgcolor: COMMUNITY_HOVER_BACKGROUND,
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
              boxShadow: '0 0 0 2px #0b1017',
              width: 12,
              height: 12,
              borderRadius: '50%','&::after': onlineUsers.has(message.user_id) ? {
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
            sx={{
              width: 40,
              height: 40,
              cursor: 'pointer',
              bgcolor: 'rgba(245, 166, 35, 0.18)',
              color: COMMUNITY_ACCENT,
              border: '1px solid rgba(245, 166, 35, 0.18)',
              '&:hover': { opacity: 0.8 },
            }}
            onClick={() => {
              setSelectedProfileUserId(message.user_id);
              setProfileModalOpen(true);
            }}
          >
            {message.user_name?.[0]}
          </Avatar>
        </Badge>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ color: COMMUNITY_TEXT_PRIMARY }}>
              {message.user_name}
            </Typography>
            {/* Mentor Badge */}
            {mentorIds.has(message.user_id) && (
              <Chip
                icon={<School sx={{ fontSize: 14 }} />}
                label="Mentor"
                size="small"
                color="secondary"
                sx={{
                  height: 20,
                  fontSize: '10px',
                  fontWeight: 600,
                  bgcolor: 'rgba(245, 166, 35, 0.14)',
                  color: COMMUNITY_ACCENT,
                  border: '1px solid rgba(245, 166, 35, 0.18)',
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
                      fontSize: '10px',
                      height: 18,
                      minWidth: 18}}
                  />
                </Tooltip>
              ) : null;
            })}
            <Typography variant="caption" sx={{ color: COMMUNITY_TEXT_MUTED }}>
              {formatDistanceToNow(new Date(message.created_at), {
                addSuffix: true,
                locale: nb,
              })}
            </Typography>
            <Box sx={{ ml: 'auto' }}>
              <IconButton
                size="small"
                onClick={(e) => handleOpenMessageMenu(e, message)}
                sx={{
                  opacity: 0.72,
                  color: COMMUNITY_TEXT_MUTED,
                  '&:hover': {
                    opacity: 1,
                    bgcolor: COMMUNITY_HOVER_BACKGROUND,
                  },
                }}
              >
                <MoreVert fontSize="small" />
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: COMMUNITY_TEXT_PRIMARY,
                    bgcolor: COMMUNITY_INSET_BACKGROUND,
                    borderRadius: 2.5,
                    '& fieldset': {
                      borderColor: 'rgba(255,255,255,0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(245, 166, 35, 0.24)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'rgba(245, 166, 35, 0.42)',
                    },
                  },
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => handleSaveEdit(message.id)}
                  sx={{
                    bgcolor: COMMUNITY_ACCENT,
                    color: '#05070b',
                    '&:hover': {
                      bgcolor: '#ffcd73',
                    },
                  }}
                >
                  Lagre
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleCancelEdit}
                  sx={{
                    color: COMMUNITY_TEXT_PRIMARY,
                    borderColor: 'rgba(255,255,255,0.12)',
                  }}
                >
                  Avbryt
                </Button>
              </Box>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: 'pre-wrap', flex: 1, color: COMMUNITY_TEXT_PRIMARY }}
                >
                  {message.content}
                  {message.is_edited && (
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ ml: 1, fontStyle: 'italic', color: COMMUNITY_TEXT_MUTED }}
                    >
                      (redigert)
                    </Typography>
                  )}
                </Typography>
                {/* Solution Badge */}
                {message.is_solution && (
                  <Chip
                    icon={<CheckCircle />}
                    label="Løsning"
                    size="small"
                    color="success"
                    sx={{
                      height: 24,
                      bgcolor: 'rgba(84, 181, 125, 0.14)',
                      color: '#78df9c',
                      border: '1px solid rgba(84, 181, 125, 0.2)',
                    }}
                  />
                )}
              </Box>

              {/* Course Announcement Card */}
              {message.message_type === 'course_announcement' && message.attachments?.[0]?.type === 'course' && (
                <Card
                  variant="outlined"
                  sx={{
                    mt: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: COMMUNITY_PANEL_BACKGROUND,
                    borderColor: 'rgba(255,255,255,0.08)',
                    '&:hover': {
                      boxShadow: COMMUNITY_PANEL_SHADOW,
                      transform: 'translateY(-2px)'
                    },
                  }}
                  onClick={() => {
                    const courseId = message.attachments[0].courseId;
                    window.location.href = `/academy/courses/${courseId}`;
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box sx={{ color: COMMUNITY_ACCENT }}>
                        {getCourseCategoryIcon(message.attachments[0].category)}
                      </Box>
                      <Typography variant="h6" sx={{ color: COMMUNITY_TEXT_PRIMARY }}>
                        {message.attachments[0].title}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                      <Chip
                        icon={getCourseLevelIcon(message.attachments[0].level) as any}
                        label={message.attachments[0].level}
                        size="small"
                      />
                      <Chip
                        icon={<AttachMoney />}
                        label={`${message.attachments[0].price} ${message.attachments[0].currency || 'NOK'}`}
                        size="small"
                        color="primary"
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
            <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
              {Object.entries(message.reactions).map(([emoji, users]) => (
                <Chip
                  key={emoji}
                  label={`${emoji} ${users.length}`}
                  size="small"
                  onClick={() => handleReaction(message.id, emoji)}
                  sx={{
                    fontSize: '12px',
                    height: 24,
                    color: COMMUNITY_TEXT_PRIMARY,
                    bgcolor: users.includes(userId)
                      ? 'rgba(245, 166, 35, 0.16)'
                      : 'rgba(255,255,255,0.06)',
                    border: users.includes(userId)
                      ? '1px solid rgba(245, 166, 35, 0.2)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              ))}
            </Box>
          )}

          {/* Quick Actions: Reply and Reactions */}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, alignItems: 'center' }}>
            {/* Reply Button */}
            <Button
              size="small"
              startIcon={<Reply />}
              onClick={() => {
                setThreadMessageId(message.id);
                setThreadDialogOpen(true);
              }}
              sx={{
                textTransform: 'none',
                minWidth: 'auto',
                color: COMMUNITY_TEXT_MUTED,
              }}
            >
              {(message.thread_count || 0) > 0 ? `${message.thread_count} svar` : 'Svar'}
            </Button>

            {/* Quick Reactions */}
            <IconButton
              size="small"
              onClick={() => handleReaction(message.id, '👍')}
              sx={{ color: COMMUNITY_TEXT_MUTED }}
            >
              <Favorite fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleReaction(message.id, '❤️')}
              sx={{ color: COMMUNITY_TEXT_MUTED }}
            >
              <EmojiEmotions fontSize="small" />
            </IconButton>
            <IconButton size="small" sx={{ color: COMMUNITY_TEXT_MUTED }}>
              <Reply fontSize="small" />
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COMMUNITY_SHELL_BACKGROUND,
          px: 2,
        }}
      >
        <Box
          sx={{
            width: 'min(420px, 100%)',
            p: 4,
            textAlign: 'center',
            borderRadius: 4,
            background: COMMUNITY_PANEL_BACKGROUND,
            border: COMMUNITY_PANEL_BORDER,
            boxShadow: COMMUNITY_PANEL_SHADOW,
          }}
        >
          <CircularProgress sx={{ color: COMMUNITY_ACCENT }} />
          <Typography variant="body1" sx={{ mt: 2, color: COMMUNITY_TEXT_MUTED }}>
            Laster community...
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <>
      {/* CSS Animation for typing indicator */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}
      </style>

      <Box sx={{ minHeight: '100vh', background: COMMUNITY_SHELL_BACKGROUND, py: { xs: 2, md: 3 } }}>
        <Container maxWidth={false} sx={{ px: { xs: 2, md: 3 }, height: 'calc(100vh - 48px)' }}>
          <Box sx={{ display: 'flex', height: '100%', gap: 2 }}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <IconButton
            onClick={() => setMobileDrawerOpen(true)}
            sx={{
              position: 'fixed',
              top: 80,
              left: 16,
              zIndex: 100,
              bgcolor: COMMUNITY_PANEL_BACKGROUND,
              color: COMMUNITY_TEXT_PRIMARY,
              border: COMMUNITY_PANEL_BORDER,
              boxShadow: COMMUNITY_PANEL_SHADOW,
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Sidebar - Desktop */}
        {!isMobile && renderSidebar()}

        {/* Sidebar - Mobile Drawer */}
        <Drawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              background: COMMUNITY_SHELL_BACKGROUND,
              p: 1,
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
            borderRadius: 4,
            background: COMMUNITY_PANEL_BACKGROUND,
            border: COMMUNITY_PANEL_BORDER,
            boxShadow: COMMUNITY_PANEL_SHADOW,
            color: COMMUNITY_TEXT_PRIMARY,
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', md: 'row' } }}>
              <Box>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Button
                    variant={selectedView === 'home' ? 'contained' : 'outlined'}
                    startIcon={<DashboardIcon />}
                    onClick={() => setSelectedView('home')}
                    sx={{
                      borderRadius: 999,
                      textTransform: 'none',
                      bgcolor: selectedView === 'home' ? COMMUNITY_ACCENT : 'transparent',
                      color: selectedView === 'home' ? '#05070b' : COMMUNITY_TEXT_PRIMARY,
                      borderColor: 'rgba(255,255,255,0.12)',
                    }}
                  >
                    Hjem
                  </Button>
                  {selectedChannel && (
                    <Button
                      variant={selectedView === 'channel' ? 'contained' : 'outlined'}
                      onClick={() => setSelectedView('channel')}
                      sx={{
                        borderRadius: 999,
                        textTransform: 'none',
                        bgcolor: selectedView === 'channel' ? 'rgba(245, 166, 35, 0.14)' : 'transparent',
                        color: COMMUNITY_TEXT_PRIMARY,
                        borderColor: 'rgba(255,255,255,0.12)',
                      }}
                    >
                      # {selectedChannel.display_name}
                    </Button>
                  )}
                </Stack>
                <Typography variant="body2" sx={{ mt: 1, color: COMMUNITY_TEXT_MUTED }}>
                  {selectedView === 'home'
                    ? 'Prioriter svar, kunnskap og Academy-broer fra ett sted.'
                    : selectedChannel?.description || 'Aktiv kanalvisning.'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={wsConnected ? 'Sanntidssynk' : 'Frakoblet'}
                  size="small"
                  sx={{
                    bgcolor: wsConnected ? 'rgba(84, 181, 125, 0.14)' : 'rgba(255,255,255,0.06)',
                    color: wsConnected ? '#78df9c' : COMMUNITY_TEXT_MUTED,
                    border: wsConnected
                      ? '1px solid rgba(84, 181, 125, 0.2)'
                      : '1px solid rgba(255,255,255,0.08)',
                  }}
                />
                {mentorEligible && !isMentor && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<School />}
                    onClick={() => setBecomeMentorDialogOpen(true)}
                    sx={{
                      textTransform: 'none',
                      bgcolor: COMMUNITY_ACCENT,
                      color: '#05070b',
                    }}
                  >
                    Bli Mentor
                  </Button>
                )}
                {isMentor && (
                  <Tooltip title="Mentoroversikt">
                    <IconButton
                      onClick={() => setMentorDashboardOpen(true)}
                      sx={{
                        color: COMMUNITY_TEXT_PRIMARY,
                        border: COMMUNITY_PANEL_BORDER,
                        bgcolor: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <Badge badgeContent="🎓" color="secondary">
                        <HelpOutline />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                )}
                {selectedGroup && (
                  <Tooltip title="Stemmebrett - funksjonsønsker">
                    <IconButton
                      onClick={() => setVotingBoardOpen(true)}
                      sx={{
                        color: COMMUNITY_TEXT_PRIMARY,
                        border: COMMUNITY_PANEL_BORDER,
                        bgcolor: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <HowToVote />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Varsler">
                  <IconButton
                    onClick={() => setNotificationDrawerOpen(true)}
                    sx={{
                      color: unreadNotificationCount > 0 ? '#ff8b8b' : COMMUNITY_TEXT_PRIMARY,
                      border: COMMUNITY_PANEL_BORDER,
                      bgcolor: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Badge badgeContent={unreadNotificationCount} color="error">
                      <Notifications />
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
                    sx={{
                      color: COMMUNITY_TEXT_PRIMARY,
                      border: COMMUNITY_PANEL_BORDER,
                      bgcolor: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Search />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Hjelp & Guide (⌘+?)">
                  <IconButton
                    onClick={openCommunityTutorial}
                    sx={{
                      color: COMMUNITY_TEXT_PRIMARY,
                      border: COMMUNITY_PANEL_BORDER,
                      bgcolor: 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <HelpOutline />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Box>

          {selectedView === 'home' ? (
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                p: { xs: 1.5, md: 2.5 },
                background: 'linear-gradient(180deg, rgba(7,10,16,0.36), rgba(6,8,14,0.76))',
              }}
            >
              <CommunityHomeDashboard
                userName={user?.name || userProfile?.display_name || 'Creator'}
                interests={communityProfile.interests}
                stats={userStats}
                needsHelp={effectiveNeedsHelpQueue}
                yourThreads={yourThreads}
                knowledgeFeed={knowledgeFeed}
                academyAnnouncements={academyAnnouncements}
                mentorsOnline={mentorsOnline}
                badgeTracks={badgeTracks}
                upcomingEvents={[...COMMUNITY_UPCOMING_EVENTS]}
                recommendedChannel={selectedChannel ? {
                  id: selectedChannel.id,
                  display_name: selectedChannel.display_name,
                  description: selectedChannel.description,
                  unread_count: selectedChannel.unread_count,
                } : undefined}
                onOpenChannel={(channelId) => openChannelByIdentifier(channelId)}
                onOpenDiscussion={handleOpenDiscussion}
                onSelectQuestion={handleSelectNeedsHelpQuestion}
                onUsePrompt={handleUsePromptTemplate}
                onOpenAcademy={() => {
                  window.location.href = '/academy';
                }}
                onOpenNotifications={() => setNotificationPreferencesOpen(true)}
                onOpenMentorDashboard={() => setMentorDashboardOpen(true)}
                onBecomeMentor={() => setBecomeMentorDialogOpen(true)}
                onOpenPublishDialog={handleOpenPublishDialog}
                isMentor={isMentor}
                mentorEligible={mentorEligible}
              />
            </Box>
          ) : (
            <>
              <Box
                sx={{
                  flex: 1,
                  overflow: 'auto',
                  p: 2,
                  background: 'linear-gradient(180deg, rgba(7,10,16,0.36), rgba(6,8,14,0.76))',
                }}
              >
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
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <Forum sx={{ fontSize: 60, color: COMMUNITY_ACCENT, mb: 2 }} />
                    <Typography variant="h6" sx={{ color: COMMUNITY_TEXT_PRIMARY }}>
                      Ingen meldinger ennå
                    </Typography>
                    <Typography variant="body2" sx={{ color: COMMUNITY_TEXT_MUTED }}>
                      Vær den første til å starte samtalen!
                    </Typography>
                  </Box>
                ) : (
                  <Virtuoso
                    ref={virtuosoRef}
                    data={messages}
                    itemContent={(index, message) => renderMessage(message)}
                    followOutput="smooth"
                    alignToBottom
                    style={{ height: '100%' }}
                  />
                )}
              </Box>

              {selectedChannel && !selectedChannel.is_read_only && (
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.2 }}>
                    <Chip
                      label="Spør om Academy-leksjon"
                      onClick={() =>
                        handleUsePromptTemplate(
                          'Jeg jobber med en Academy-leksjon akkurat nå og trenger sparring på dette: ',
                          selectedChannel.id,
                        )
                      }
                      sx={{ bgcolor: 'rgba(245, 166, 35, 0.12)', color: '#f5a623' }}
                    />
                    <Chip
                      label="Del takeaway"
                      onClick={() =>
                        handleUsePromptTemplate(
                          'Dette er det viktigste jeg tar med meg fra Academy i dag. Hvordan ville dere brukt dette i praksis? ',
                          selectedChannel.id,
                        )
                      }
                      sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: COMMUNITY_TEXT_PRIMARY }}
                    />
                    <Chip
                      label="Be om tilbakemelding"
                      onClick={() =>
                        handleUsePromptTemplate(
                          'Jeg vil gjerne ha tilbakemelding på denne ideen / leveransen før jeg går videre: ',
                          selectedChannel.id,
                        )
                      }
                      sx={{ bgcolor: 'rgba(255,255,255,0.06)', color: COMMUNITY_TEXT_PRIMARY }}
                    />
                  </Stack>

                  {composerSuggestions.length > 0 && (
                    <Box
                      sx={{
                        mb: 1.2,
                        p: 1.5,
                        borderRadius: 3,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: COMMUNITY_TEXT_MUTED }}>
                        Mulige svar før du poster
                      </Typography>
                      <Stack spacing={1} sx={{ mt: 1 }}>
                        {composerSuggestions.map((suggestion) => (
                          <Box key={suggestion.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ color: COMMUNITY_TEXT_PRIMARY, fontWeight: 700 }}>
                                {suggestion.user_name}
                              </Typography>
                              <Typography variant="body2" sx={{ color: COMMUNITY_TEXT_MUTED }}>
                                {suggestion.content.slice(0, 120)}...
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              sx={{ color: '#f5a623', flexShrink: 0 }}
                              onClick={() => handleOpenDiscussion(suggestion.channel_id, suggestion.id)}
                            >
                              Vis
                            </Button>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {typingUsers.size > 0 && (
                    <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontStyle: 'italic', color: COMMUNITY_TEXT_MUTED }}
                      >
                        {typingUsers.size === 1
                          ? 'Noen skriver...'
                          : `${typingUsers.size} personer skriver...`}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: COMMUNITY_TEXT_MUTED, animation: 'pulse 1.4s infinite' }} />
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: COMMUNITY_TEXT_MUTED, animation: 'pulse 1.4s infinite 0.2s' }} />
                        <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: COMMUNITY_TEXT_MUTED, animation: 'pulse 1.4s infinite 0.4s' }} />
                      </Box>
                    </Box>
                  )}
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder={`Send melding til # ${selectedChannel.display_name}`}
                    value={messageInput}
                    onChange={handleMessageInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                        sendTypingIndicator(false);
                      }
                    }}
                    disabled={sendingMessage}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: COMMUNITY_TEXT_PRIMARY,
                        background: COMMUNITY_INSET_BACKGROUND,
                        borderRadius: 3,
                        '& fieldset': {
                          borderColor: 'rgba(255,255,255,0.1)',
                        },
                        '&:hover fieldset': {
                          borderColor: 'rgba(245, 166, 35, 0.24)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'rgba(245, 166, 35, 0.42)',
                        },
                      },
                      '& .MuiInputBase-input::placeholder': {
                        color: COMMUNITY_TEXT_MUTED,
                        opacity: 1,
                      },
                      '& textarea::placeholder': {
                        color: COMMUNITY_TEXT_MUTED,
                        opacity: 1,
                      },
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <CommunityFileAttachment
                            userId={userId}
                            channelId={selectedChannel.id}
                            onFilesUploaded={handleFilesUploaded}
                            disabled={sendingMessage}
                          />
                          <Tooltip title="Legg til emoji">
                            <IconButton
                              size="small"
                              onClick={handleOpenEmojiPicker}
                              disabled={sendingMessage}
                              sx={{ color: COMMUNITY_TEXT_MUTED }}
                            >
                              <EmojiEmotions fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <IconButton
                            color="primary"
                            onClick={handleSendMessage}
                            disabled={(!messageInput.trim() && attachedFiles.length === 0) || sendingMessage}
                            sx={{ color: COMMUNITY_ACCENT }}
                          >
                            {sendingMessage ? (
                              <CircularProgress size={20} sx={{ color: COMMUNITY_ACCENT }} />
                            ) : (
                              <Send fontSize="small" />
                            )}
                          </IconButton>
                        </InputAdornment>
                      )}}
                  />
                </Box>
              )}

              {selectedChannel && selectedChannel.is_read_only && (
                <Box
                  sx={{
                    p: 2,
                    borderTop: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    bgcolor: 'rgba(245, 166, 35, 0.08)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Lock fontSize="small" sx={{ color: COMMUNITY_TEXT_MUTED }} />
                    <Typography variant="body2" sx={{ color: COMMUNITY_TEXT_MUTED }}>
                      Denne kanalen er skrivebeskyttet. Kun administratorer kan sende meldinger.
                    </Typography>
                  </Box>
                </Box>
              )}
            </>
          )}

          {/* Emoji Picker Popover */}
          <Popover
            open={emojiPickerOpen}
            anchorEl={emojiPickerAnchor}
            onClose={handleCloseEmojiPicker}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'center'}}
            transformOrigin={{
              vertical: 'bottom',
              horizontal: 'center'}}
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
      </Box>

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
                    alert('🆘 SOS varsel sendt til alle mentorer!');
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
              <ListItemText>🆘 Send SOS til mentorer</ListItemText>
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
          channelId={selectedChannel?.id}
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
        currentUserId={userId}
        defaultScope={searchScope}
        defaultScopeId={searchScopeId}
        defaultScopeName={searchScopeName}
        onSelectMessage={(messageId, channelId) => {
          handleOpenDiscussion(channelId, messageId);
        }}
        onSelectThread={(threadId, channelId) => {
          openChannelByIdentifier(channelId);
          setThreadMessageId(threadId);
          setThreadDialogOpen(true);
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
        open={onboardingOpen && !showCommunityTutorial}
        onClose={() => setOnboardingOpen(false)}
        userName={user?.name || 'Bruker'}
        onComplete={() => {
          try {
            localStorage.setItem(`community-onboarding-complete-${userId}`, 'true');
          } catch {
            // Ignore local persistence issues.
          }
        }}
      />

      {/* Badge Notification */}
      {earnedBadge && (
        <BadgeNotification
          open={badgeNotificationOpen}
          onClose={() => setBadgeNotificationOpen(false)}
          badgeName={earnedBadge.name}
          badgeIcon={earnedBadge.icon}
          badgeColor={earnedBadge.color}
          badgeDescription={earnedBadge.description}
        />
      )}

      {/* Become Mentor Dialog */}
      <BecomeMentorDialog
        open={becomeMentorDialogOpen}
        onClose={() => setBecomeMentorDialogOpen(false)}
        groupId={selectedGroup?.id || ''}
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
            openChannelByIdentifier(channelId);
            setThreadMessageId(messageId);
            setThreadDialogOpen(true);
          }}
        />
      )}

      {/* Voting Board Dialog */}
      <Dialog
        open={votingBoardOpen}
        onClose={() => setVotingBoardOpen(false)}
        maxWidth="lg"
        fullWidth
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: { ...COMMUNITY_DIALOG_PAPER_SX, minHeight: '80vh' } }}
      >
        <VotingBoard
          groupId={selectedGroup?.id ?? ''}
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
          sx={COMMUNITY_DIALOG_SX}
          PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
        >
          <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
                Administrer Kursinnlegg
              </Typography>
              <IconButton onClick={() => setShowPublishedPosts(false)} sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent sx={COMMUNITY_DIALOG_CONTENT_SX}>
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
                      <Card key={post.id} sx={COMMUNITY_DIALOG_SURFACE_SUBTLE_SX}>
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
                              <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }} gutterBottom>
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
                                sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}
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
                                sx={COMMUNITY_DIALOG_SECONDARY_BUTTON_SX}
                                onClick={() => {
                                  // Navigate to the message in the channel
                                  const channel = channels.find(c => c.id === post.channel_id);
                                  if (channel) {
                                    openChannel(channel);
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
        <Box sx={{ flex: 1, overflow: 'auto' }}>
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
        sx={COMMUNITY_DIALOG_SX}
        PaperProps={{ sx: COMMUNITY_DIALOG_PAPER_SX }}
      >
        <DialogTitle sx={COMMUNITY_DIALOG_TITLE_SX}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: COMMUNITY_DIALOG_TEXT }}>
              Varslingsinnstillinger
            </Typography>
            <IconButton onClick={() => setNotificationPreferencesOpen(false)} sx={COMMUNITY_DIALOG_CLOSE_BUTTON_SX}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent
          sx={{
            ...COMMUNITY_DIALOG_CONTENT_SX,
            '& .MuiSwitch-root': COMMUNITY_DIALOG_SWITCH_SX,
          }}
        >
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ color: COMMUNITY_DIALOG_MUTED }}>
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
                  <Typography variant="body1">💬 Svar</Typography>
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
                  <Typography variant="body1">❤️ Reaksjoner</Typography>
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
                  <Typography variant="body1">🏆 Merker</Typography>
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

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', py: 1 }}>
                <Box>
                  <Typography variant="body1">🧵 Fulgt tråd</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Når det skjer noe nytt i tråder du følger eller har deltatt i
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_followed_threads}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_followed_threads: e.target.checked,
                  })}
                />
              </Box>
              <Divider />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', py: 1 }}>
                <Box>
                  <Typography variant="body1">📬 Daglig digest</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Oppsummering av svar, åpne spørsmål og relevante diskusjoner
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_daily_digest}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_daily_digest: e.target.checked,
                  })}
                />
              </Box>
              <Divider />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', py: 1 }}>
                <Box>
                  <Typography variant="body1">🎓 Mentorforespørsler</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Når noen trenger mentorhjelp eller sender SOS i ditt fagområde
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_mentor_requests}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_mentor_requests: e.target.checked,
                  })}
                />
              </Box>
              <Divider />
            </Box>

            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent:'space-between', py: 1 }}>
                <Box>
                  <Typography variant="body1">🎬 Academy-diskusjoner</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Når kurs, leksjoner eller publiserte Academy-innlegg får aktivitet
                  </Typography>
                </Box>
                <Switch
                  checked={notificationPreferences.notify_course_discussions}
                  onChange={(e) => updateNotificationPreferences({
                    ...notificationPreferences,
                    notify_course_discussions: e.target.checked,
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
    </>
  );
}
