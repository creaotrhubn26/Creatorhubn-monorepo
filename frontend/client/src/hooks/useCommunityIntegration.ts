/**
 * Community Integration Hooks
 * 
 * Provides hooks for integrating community features across the application:
 * - VotingBoard integration
 * - MentorDashboard integration
 * - File sharing integration
 * - Event bus integration
 */

import { useState, useEffect, useCallback } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { apiRequest } from '@/lib/queryClient';

// ============================================
// TYPES
// ============================================

export interface VotingItem {
  id: string;
  board_id: string;
  title: string;
  description?: string;
  status: 'open' | 'under_review' | 'planned' | 'in_progress' | 'completed' | 'declined' | 'duplicate';
  priority: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
  admin_response?: string;
}

export interface MentorInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  topics: string[];
  rating: number;
  responseTime: string;
  isAvailable: boolean;
}

export interface PendingQuestion {
  id: string;
  content: string;
  channelId: string;
  channelName: string;
  userId: string;
  userName: string;
  createdAt: string;
  waitTime: string;
}

export interface CommunityFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  driveFileId?: string;
  thumbnailUrl?: string;
}

// ============================================
// VOTING BOARD INTEGRATION
// ============================================

export function useVotingBoardIntegration(groupId?: string) {
  const { communication } = useEnhancedMasterIntegration();
  const [topFeatureRequests, setTopFeatureRequests] = useState<VotingItem[]>([]);
  const [plannedFeatures, setPlannedFeatures] = useState<VotingItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch top feature requests across all boards
  const fetchTopRequests = useCallback(async (limit = 10) => {
    try {
      setLoading(true);
      const response = await apiRequest(
        `/api/community/voting/boards?groupId=${groupId || 'all'}&status=active`
      );
      
      if (response.success && response.boards) {
        const allItems: VotingItem[] = [];
        
        for (const board of response.boards) {
          const boardResponse = await apiRequest(
            `/api/community/voting/boards/${board.id}?sortBy=score`
          );
          if (boardResponse.success && boardResponse.items) {
            allItems.push(...boardResponse.items);
          }
        }
        
        // Sort by score and take top items
        const sorted = allItems.sort((a, b) => b.score - a.score).slice(0, limit);
        setTopFeatureRequests(sorted);
        
        // Filter planned features for roadmap
        const planned = allItems.filter(
          item => ['planned','in_progress'].includes(item.status)
        );
        setPlannedFeatures(planned);
      }
    } catch (error) {
      console.error('Error fetching voting data: ', error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  // Convert feedback to voting item
  const convertFeedbackToVotingItem = useCallback(async (
    feedbackId: string,
    boardId: string,
    userId: string
  ) => {
    try {
      // Get feedback details
      const feedbackResponse = await apiRequest(`/api/prototype-testing/feedback/${feedbackId}`);
      
      if (feedbackResponse.success && feedbackResponse.feedback) {
        const feedback = feedbackResponse.feedback;
        
        // Create voting item from feedback
        const response = await apiRequest('/api/community/voting/items', {
          method: 'POST',
          body: JSON.stringify({
            userId,
            boardId,
            title: feedback.title,
            description: `${feedback.description}\n\n---\nConverted from feedback #${feedbackId}`,
            category: feedback.feedbackType,
          }),
        });

        if (response.success) {
          // Broadcast event
          communication.sendBroadcast('voting:item-from-feedback', {
            feedbackId,
            itemId: response.item.id,
            boardId,
          });
          
          return response.item;
        }
      }
    } catch (error) {
      console.error('Error converting feedback to voting item:', error);
    }
    return null;
  }, [communication]);

  // Subscribe to voting events
  useEffect(() => {
    const unsubscribe = communication.onMessage((msg: any) => {
      if (msg.type === 'voting:item-created' || msg.type === 'voting:status-changed') {
        fetchTopRequests();
      }
    });
    
    return unsubscribe;
  }, [communication, fetchTopRequests]);

  return {
    topFeatureRequests,
    plannedFeatures,
    loading,
    fetchTopRequests,
    convertFeedbackToVotingItem,
  };
}

// ============================================
// MENTOR DASHBOARD INTEGRATION
// ============================================

export function useMentorIntegration(userId: string, groupId?: string) {
  const { communication } = useEnhancedMasterIntegration();
  const [mentors, setMentors] = useState<MentorInfo[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [isMentor, setIsMentor] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch available mentors
  const fetchMentors = useCallback(async (topic?: string) => {
    try {
      setLoading(true);
      const url = groupId 
        ? `/api/community/mentors?groupId=${groupId}${topic ? `&topic=${topic}` : ', '}`
        : `/api/community/mentors${topic ? `?topic=${topic}` : ', '}`;
        
      const response = await apiRequest(url);
      
      if (response.success) {
        setMentors(response.mentors || []);
        setIsMentor(response.mentors?.some((m: MentorInfo) => m.id === userId) || false);
      }
    } catch (error) {
      console.error('Error fetching mentors:', error);
    } finally {
      setLoading(false);
    }
  }, [groupId, userId]);

  // Fetch pending questions for mentors
  const fetchPendingQuestions = useCallback(async () => {
    if (!isMentor) return;
    
    try {
      const response = await apiRequest(
        `/api/community/mentor/${userId}/pending-questions${groupId ? `?groupId=${groupId}` : ', '}`
      );
      
      if (response.success) {
        setPendingQuestions(response.questions || []);
      }
    } catch (error) {
      console.error('Error fetching pending questions:', error);
    }
  }, [userId, groupId, isMentor]);

  // Request mentor session (booking integration)
  const requestMentorSession = useCallback(async (
    mentorId: string,
    topic: string,
    preferredDate?: Date
  ) => {
    try {
      const response = await apiRequest('/api/community/mentor/request-session', {
        method: 'POST',
        body: JSON.stringify({
          mentorId,
          studentId: userId,
          topic,
          preferredDate: preferredDate?.toISOString(),
          groupId,
        }),
      });

      if (response.success) {
        // Broadcast for calendar integration
        communication.sendBroadcast('mentor:session-requested', {
          mentorId,
          studentId: userId,
          topic,
          sessionId: response.session?.id,
        });
        
        return response.session;
      }
    } catch (error) {
      console.error('Error requesting mentor session:', error);
    }
    return null;
  }, [userId, groupId, communication]);

  // Escalate help desk ticket to mentor
  const escalateToMentor = useCallback(async (
    ticketId: string,
    mentorId: string,
    reason: string
  ) => {
    try {
      const response = await apiRequest('/api/community/mentor/escalate', {
        method: 'POST',
        body: JSON.stringify({
          ticketId,
          mentorId,
          escalatedBy: userId,
          reason,
        }),
      });

      if (response.success) {
        communication.sendBroadcast('mentor:ticket-escalated', {
          ticketId,
          mentorId,
          escalatedBy: userId,
        });
        
        return true;
      }
    } catch (error) {
      console.error('Error escalating to mentor:', error);
    }
    return false;
  }, [userId, communication]);

  // Answer question (for mentors)
  const answerQuestion = useCallback(async (
    questionId: string,
    channelId: string,
    answer: string
  ) => {
    try {
      const response = await apiRequest('/api/community/mentor/answer', {
        method: 'POST',
        body: JSON.stringify({
          questionId,
          channelId,
          mentorId: userId,
          answer,
        }),
      });

      if (response.success) {
        // Remove from pending
        setPendingQuestions(prev => prev.filter(q => q.id !== questionId));
        
        communication.sendBroadcast('mentor:question-answered', {
          questionId,
          channelId,
          mentorId: userId,
        });
        
        return true;
      }
    } catch (error) {
      console.error('Error answering question:', error);
    }
    return false;
  }, [userId, communication]);

  // Subscribe to mentor events
  useEffect(() => {
    const unsubscribe = communication.onMessage((msg: any) => {
      if (msg.type === 'community:new-question' && isMentor) {
        fetchPendingQuestions();
      }
      if (msg.type === 'mentor:session-requested' && msg.data?.mentorId === userId) {
        // Notify mentor of new session request
        communication.sendBroadcast('notification:new', {
          type: 'mentor_session',
          title: 'New Mentor Session Request',
          message: `A student has requested a session on "${msg.data.topic}"`,
        });
      }
    });
    
    return unsubscribe;
  }, [communication, isMentor, userId, fetchPendingQuestions]);

  return {
    mentors,
    pendingQuestions,
    isMentor,
    loading,
    fetchMentors,
    fetchPendingQuestions,
    requestMentorSession,
    escalateToMentor,
    answerQuestion,
  };
}

// ============================================
// FILE SHARING INTEGRATION
// ============================================

export function useCommunityFileIntegration(userId: string) {
  const { communication } = useEnhancedMasterIntegration();
  const [recentFiles, setRecentFiles] = useState<CommunityFile[]>([]);

  // Share project file to community
  const shareProjectFile = useCallback(async (
    fileId: string,
    channelId: string,
    message?: string
  ) => {
    try {
      const response = await apiRequest('/api/community/files/share', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          fileId,
          channelId,
          message,
          source: 'project',
        }),
      });

      if (response.success) {
        communication.sendBroadcast('community:file-shared', {
          fileId,
          channelId,
          sharedBy: userId,
        });
        
        return response.message;
      }
    } catch (error) {
      console.error('Error sharing project file:', error);
    }
    return null;
  }, [userId, communication]);

  // Share portfolio item for feedback
  const shareForFeedback = useCallback(async (
    portfolioItemId: string,
    channelId: string,
    feedbackRequest: string
  ) => {
    try {
      const response = await apiRequest('/api/community/files/share-for-feedback', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          portfolioItemId,
          channelId,
          feedbackRequest,
        }),
      });

      if (response.success) {
        communication.sendBroadcast('community:feedback-requested', {
          portfolioItemId,
          channelId,
          requestedBy: userId,
        });
        
        return response.post;
      }
    } catch (error) {
      console.error('Error sharing for feedback:', error);
    }
    return null;
  }, [userId, communication]);

  // Import file from Google Drive to community
  const importFromDrive = useCallback(async (
    driveFileId: string,
    channelId: string
  ) => {
    try {
      const response = await apiRequest('/api/community/files/import-drive', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          driveFileId,
          channelId,
        }),
      });

      if (response.success) {
        return response.file;
      }
    } catch (error) {
      console.error('Error importing from Drive:', error);
    }
    return null;
  }, [userId]);

  // Export community file to project
  const exportToProject = useCallback(async (
    communityFileId: string,
    projectId: string
  ) => {
    try {
      const response = await apiRequest('/api/community/files/export-to-project', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          communityFileId,
          projectId,
        }),
      });

      if (response.success) {
        communication.sendBroadcast('project:file-added', {
          fileId: response.file?.id,
          projectId,
          source: 'community',
        });
        
        return response.file;
      }
    } catch (error) {
      console.error('Error exporting to project:', error);
    }
    return null;
  }, [userId, communication]);

  return {
    recentFiles,
    shareProjectFile,
    shareForFeedback,
    importFromDrive,
    exportToProject,
  };
}

// ============================================
// MASTER EVENT BUS INTEGRATION
// ============================================

export interface CommunityEvent {
  type: string;
  data: any;
  timestamp: string;
  source: string;
}

export function useCommunityEventBus() {
  const { communication } = useEnhancedMasterIntegration();
  const [eventLog, setEventLog] = useState<CommunityEvent[]>([]);

  // Event types
  const COMMUNITY_EVENTS = {
    // Messaging
    MESSAGE_SENT: 'community:message-sent',
    MESSAGE_EDITED: 'community:message-edited',
    MESSAGE_DELETED: 'community:message-deleted',
    REACTION_ADDED: 'community:reaction-added',
    
    // Users
    USER_MENTIONED: 'community:user-mentioned',
    USER_JOINED_GROUP: 'community:user-joined-group',
    USER_LEFT_GROUP: 'community:user-left-group',
    
    // Direct Messages
    DM_OPENED: 'chat:open-dm',
    DM_MESSAGE_SENT: 'dm:message-sent',
    
    // Voting
    VOTING_ITEM_CREATED: 'voting:item-created',
    VOTING_ITEM_VOTED: 'voting:item-voted',
    VOTING_STATUS_CHANGED: 'voting:status-changed',
    
    // Mentorship
    MENTOR_SESSION_REQUESTED: 'mentor:session-requested',
    MENTOR_QUESTION_ANSWERED: 'mentor:question-answered',
    MENTOR_TICKET_ESCALATED: 'mentor:ticket-escalated',
    
    // Files
    FILE_SHARED: 'community:file-shared',
    FEEDBACK_REQUESTED: 'community:feedback-requested',
    
    // Badges
    BADGE_EARNED: 'community:badge-earned',
    
    // Notifications
    NEW_NOTIFICATION: 'notification:new',
  } as const;

  // Emit event
  const emit = useCallback((type: string, data: any, source = 'community') => {
    const event: CommunityEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
      source,
    };
    
    communication.sendBroadcast(type, data);
    setEventLog(prev => [...prev.slice(-99), event]); // Keep last 100 events
    
    return event;
  }, [communication]);

  // Subscribe to events
  const subscribe = useCallback((
    eventTypes: string | string[],
    callback: (event: CommunityEvent) => void
  ) => {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    
    return communication.onMessage((msg: any) => {
      if (types.includes(msg.type) || types.includes('*')) {
        callback({
          type: msg.type,
          data: msg.data || msg,
          timestamp: new Date().toISOString(),
          source: msg.source ||'unknown',
        });
      }
    });
  }, [communication]);

  // Subscribe to all community events
  const subscribeToAll = useCallback((callback: (event: CommunityEvent) => void) => {
    return subscribe(Object.values(COMMUNITY_EVENTS), callback);
  }, [subscribe]);

  return {
    COMMUNITY_EVENTS,
    emit,
    subscribe,
    subscribeToAll,
    eventLog,
  };
}

// ============================================
// COMBINED INTEGRATION HOOK
// ============================================

export function useCommunityIntegration(userId: string, groupId?: string) {
  const voting = useVotingBoardIntegration(groupId);
  const mentor = useMentorIntegration(userId, groupId);
  const files = useCommunityFileIntegration(userId);
  const eventBus = useCommunityEventBus();

  return {
    voting,
    mentor,
    files,
    eventBus,
  };
}

export default useCommunityIntegration;

