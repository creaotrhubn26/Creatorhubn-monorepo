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

export default function CommunityPage({ userId, profession }: CommunityPageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down( 'md,'));
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
    checkModeratorStatus();
    checkFirstTimeUser();
    fetchMentors();
    checkMentorEligibility();
    fetchUnreadNotificationCount();
    fetchNotificationPreferences();
  }, [userId, profession]);

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
    } else if (showUserProfile) {
      setCurrentCommunityComponent('UserProfileModal');
    } else if (notificationDrawerOpen) {
      setCurrentCommunityComponent('CommunityNotificationFeed');
    } else {
      setCurrentCommunityComponent('CommunityPage');
    }
  }, [votingBoardOpen, mentorDashboardOpen, threadDialogOpen, advancedSearchOpen, showUserProfile, notificationDrawerOpen]);

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

  const renderSidebar = () => (
    <Box sx={{ width: isMobile ? 280 : 300, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* User Profile Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar src={user?.picture} sx={{ width: 50, height: 50 }}>
            {user?.name?.[0]}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={600}>
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
      <Paper sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600}>
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
                if (isMobile) setMobileDrawerOpen(false);
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
            <Divider />
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                Kanaler
              </Typography>
            </Box>
            <List>
              {channels.map((channel) => (
                <ListItemButton
                  key={channel.id}
                  selected={selectedChannel?.id === channel.id}
                  onClick={() => {
                    setSelectedChannel(channel);
                    if (isMobile) setMobileDrawerOpen(false);
                  }}
                  disabled={!!channel.requires_feature && !channel.is_default}
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
      <Paper sx={{ mt: 2, p: 1 }}>
        <Stack spacing={1}>
          {/* Back to Dashboard Button */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => {
              // Navigate back to UniversalDashboard
              window.history.back();
            }}
            sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
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
                Academy Dashboard
              </Button>

              {/* Publish Course Button */}
              <Button
                fullWidth
                variant="outlined"
                color="primary"
                startIcon={<Announcement />}
                onClick={handleOpenPublishDialog}
                sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
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
                sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
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
          p: 2, '&:hover': { bgcolor: 'action.hover' }}}
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
              borderRadius: '50%','&::after': onlineUsers.has(message.user_id) ? {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                animation: 'ripple 1.2s infinite ease-in-out',
                border: '1px solid currentColor',
                content: ', ""',
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
              cursor: 'pointer','&:hover': { opacity: 0.8 }}}
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
            <Typography variant="subtitle2" fontWeight={600}>
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
                  fontWeight: 600}}
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
            <Typography variant="caption" color="text.secondary">
              {formatDistanceToNow(new Date(message.created_at), {
                addSuffix: true,
                locale: nb,
              })}
            </Typography>
            <Box sx={{ ml: 'auto' }}>
              <IconButton
                size="small"
                onClick={(e) => handleOpenMessageMenu(e, message)}
                sx={{ opacity: 0.6, '&:hover': { opacity: 1 } }}
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
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button size="small" variant="contained" onClick={() => handleSaveEdit(message.id)}>
                  Lagre
                </Button>
                <Button size="small" variant="outlined" onClick={handleCancelEdit}>
                  Avbryt
                </Button>
              </Box>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', flex: 1 }}>
                  {message.content}
                  {message.is_edited && (
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1, fontStyle: 'italic' }}
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
                    sx={{ height: 24 }}
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
                    transition: 'all 0.2s','&:hover': {
                      boxShadow: 3,
                      transform: 'translateY(-2px)'
                    }
                  }}
                  onClick={() => {
                    const courseId = message.attachments[0].courseId;
                    window.location.href = `/academy/courses/${courseId}`;
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Box sx={{ color: 'primary.main' }}>
                        {getCourseCategoryIcon(message.attachments[0].category)}
                      </Box>
                      <Typography variant="h6">
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
                    bgcolor: users.includes(userId) ? 'primary.light' : 'action.hover'}}
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
              sx={{ textTransform: 'none', minWidth: 'auto' }}
            >
              {(message.thread_count || 0) > 0 ? `${message.thread_count} svar` : 'Svar'}
            </Button>

            {/* Quick Reactions */}
            <IconButton size="small" onClick={() => handleReaction(message.id, '👍')}>
              <Favorite fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => handleReaction(message.id, '❤️')}>
              <EmojiEmotions fontSize="small" />
            </IconButton>
            <IconButton size="small">
              <Reply fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Laster community...
        </Typography>
      </Container>
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

      <Container maxWidth="xl" sx={{ py: 2, height: 'calc(100vh - 100px)' }}>
        <Box sx={{ display: 'flex', height: '100%', gap: 2 }}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <IconButton
            onClick={() => setMobileDrawerOpen(true)}
            sx={{ position: 'fixed', top: 80, left: 16, zIndex: 100, bgcolor: 'background.paper' }}
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
        >
          {renderSidebar()}
        </Drawer>

        {/* Main Content - Messages */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Channel Header */}
          {selectedChannel && (
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h6">
                    # {selectedChannel.display_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedChannel.description}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {/* Become Mentor Button */}
                  {mentorEligible && !isMentor && (
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      startIcon={<School />}
                      onClick={() => setBecomeMentorDialogOpen(true)}
                      sx={{ textTransform: 'none' }}
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
                      >
                        <Badge badgeContent="🎓" color="secondary">
                          <HelpOutline />
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
                      >
                        <HowToVote />
                      </IconButton>
                    </Tooltip>
                  )}

                  {/* Notification Bell */}
                  <Tooltip title="Varsler">
                    <IconButton
                      onClick={() => setNotificationDrawerOpen(true)}
                      color={unreadNotificationCount > 0 ? 'error' : 'default'}
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
                    >
                      <Search />
                    </IconButton>
                  </Tooltip>

                  {/* Help / Tutorial Button */}
                  <Tooltip title="Hjelp & Guide (⌘+?)">
                    <IconButton
                      onClick={openCommunityTutorial}
                      color="primary"
                    >
                      <HelpOutline />
                    </IconButton>
                  </Tooltip>

                  <IconButton>
                    <MoreVert />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          )}

          {/* Messages Area */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
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
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Forum sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  Ingen meldinger ennå
                </Typography>
                <Typography variant="body2" color="text.secondary">
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

          {/* Message Input */}
          {selectedChannel && !selectedChannel.is_read_only && (
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {typingUsers.size === 1
                      ? 'Noen skriver...'
                      : `${typingUsers.size} personer skriver...`}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.secondary', animation: 'pulse 1.4s infinite' }} />
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.secondary', animation: 'pulse 1.4s infinite 0.2s' }} />
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'text.secondary', animation: 'pulse 1.4s infinite 0.4s' }} />
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
                    sendTypingIndicator(false); // Stop typing indicator on send
                  }
                }}
                disabled={sendingMessage}
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
                        >
                          <EmojiEmotions fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <IconButton
                        color="primary"
                        onClick={handleSendMessage}
                        disabled={(!messageInput.trim() && attachedFiles.length === 0) || sendingMessage}
                      >
                        {sendingMessage ? (
                          <CircularProgress size={20} />
                        ) : (
                          <Send fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  )}}
              />
            </Box>
          )}

          {/* Read-only Channel Notice */}
          {selectedChannel && selectedChannel.is_read_only && (
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lock fontSize="small" color="disabled" />
                <Typography variant="body2" color="text.secondary">
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
          </Stack>
        </DialogContent>
      </Dialog>
      </Container>

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

