/**
 * Client Activity & Deadline Panel
 * Focused widget showing critical client interactions
 * - Upcoming deadlines from ProjectTimeline
 * - Client downloads/selections from database
 * - Client comments from showcase system
 * - Client viewing activity
 * 
 * CONNECTED TO:
 * - database-persistence-schema.ts (projects, clientProofingSessions, clientImageComments, showcaseComments)
 * - DemoModeContext.tsx (demo/production mode support)
 * - ProjectTimeline.tsx (deadline data)
 * - ProjectCreationWithMemoryCards.tsx (project data)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useDemoMode, useDemoModeData } from '@/contexts/DemoModeContext';
import { usePushNotifications } from '../../../hooks/usePushNotifications';
import { PushNotificationSettings } from '../../shared/PushNotificationSettings';
import { useDynamicProfessions } from '../../universal/hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useTheming } from '@/utils/theming-helper';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  IconButton,
  Collapse,
  Button,
  Divider,
  Badge,
  Stack,
  Tooltip,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Schedule,
  Download,
  Comment,
  Visibility,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  ExpandMore,
  ExpandLess,
  Notifications,
  AccessTime,
  Person,
  PhotoLibrary,
  VideoLibrary,
  MusicNote,
  Business,
  TrendingUp,
  Favorite,
  StarBorder,
  Star,
  PhotoCamera,
  Videocam
} from '@mui/icons-material';

interface ClientActivity {
  id: string;
  type: 'deadline' | 'download' | 'comment' | 'selection' | 'view' | 'submission' | 'timeline_event' | 'timeline_change';
  clientName: string;
  clientEmail?: string;
  itemName: string;
  itemType: 'photo' | 'video' | 'audio' | 'product';
  timestamp: Date;
  deadline?: Date;
  urgency?: 'high' | 'medium' | 'low';
  message?: string;
  count?: number;
  rating?: number;
  submissionType?: string;
  submissionStatus?: 'pending' | 'reviewed' | 'approved' | 'rejected';
  eventType?: string; // For timeline events: 'ceremony','photo_session','meeting', etc.
  eventTime?: string; // HH:MM format
  eventLocation?: string;
  source?: 'project' | 'wedding_timeline' | 'timeline_event';
  changeType?: 'time_change' | 'venue_change' | 'event_addition' | 'event_removal' | 'comment';
  changeStatus?: 'pending' | 'approved' | 'rejected';
  originalValue?: string;
  requestedValue?: string;
}

interface ClientActivityPanelProps {
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
  accentColor: string;
  userId?: string;
  onActivityClick?: (activity: ClientActivity) => void;
  onCreateProjectFromSubmission?: (submissionData: any) => void;
  onAcceptTimelineChanges?: (changes: ClientActivity[], worklogData: any) => void;
}

export const ClientActivityPanel: React.FC<ClientActivityPanelProps> = ({
  profession,
  accentColor,
  userId,
  onActivityClick,
  onCreateProjectFromSubmission,
  onAcceptTimelineChanges
	}) => {
	  // Profession system hooks
	  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
	  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
	  const professionAdapter = useProfessionAdapter();
	  const currentProfession = professionAdapter.profession || profession || 'photographer';
	  const professionIcon = getProfessionIcon(currentProfession);
	  const professionConfig = professionConfigs?.[currentProfession];
	  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
	  const professionColor = getUserProfessionColor(currentProfession) || accentColor || '#FF6B35';
	  const theming = useTheming(currentProfession);
	  
	  const [expandedSections, setExpandedSections] = useState<Set<string>>(
	    new Set(['timeline_changes,', 'submissions','deadlines'])
	  ); // Expand timeline changes by default
  const { isDemoMode, getDemoData } = useDemoMode();
  const [acceptingChanges, setAcceptingChanges] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  
  // Push notifications
  const { pushEnabled, isSupported } = usePushNotifications(userId);

  // Fetch projects with upcoming deadlines from database
  const { data: projectsData = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects,', { userId, profession, withDeadlines: true }],
    queryFn: async () => {
      const projects = await apiRequest(`/api/projects?userId=${userId}&profession=${profession}&withDeadlines=true`);
      return projects;
    },
    enabled: !!userId && !isDemoMode
  });

  // Fetch client proofing sessions (client selections) from database
  const { data: proofingSessions = [], isLoading: proofingLoading } = useQuery({
    queryKey: ['/api/client-proofing-sessions', { userId }],
    queryFn: async () => {
      const sessions = await apiRequest(`/api/client-proofing-sessions?userId=${userId}`);
      return sessions;
    },
    enabled: !!userId && !isDemoMode
  });

  // Fetch client comments from database (showcaseComments + clientImageComments)
  const { data: commentsData = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['/api/client-comments', { userId }],
    queryFn: async () => {
      const comments = await apiRequest(`/api/client-comments?userId=${userId}`);
      return comments;
    },
    enabled: !!userId && !isDemoMode
  });

  // Fetch image downloads from database
  const { data: downloadsData = [], isLoading: downloadsLoading } = useQuery({
    queryKey: ['/api/client-downloads', { userId }],
    queryFn: async () => {
      const downloads = await apiRequest(`/api/client-downloads?userId=${userId}`);
      return downloads;
    },
    enabled: !!userId && !isDemoMode
  });

  // Fetch client submissions from database (contact forms, project requests, feedback)
  const { data: submissionsData = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['/api/client-submissions', { userId }],
    queryFn: async () => {
      const submissions = await apiRequest(`/api/client-submissions?userId=${userId}`);
      return submissions;
    },
    enabled: !!userId && !isDemoMode
  });

  // Fetch upcoming timeline events (ceremony, meetings, photo sessions, etc.)
  const { data: timelineEventsData = [], isLoading: timelineEventsLoading } = useQuery({
    queryKey: ['/api/timeline-events/upcoming', { userId }],
    queryFn: async () => {
      const events = await apiRequest(`/api/timeline-events/upcoming?userId=${userId}`);
      return events;
    },
    enabled: !!userId && !isDemoMode
  });

  // Fetch pending timeline changes from clients (client requested changes to timeline)
  const { data: timelineChangesData = [], isLoading: timelineChangesLoading } = useQuery({
    queryKey: ['/api/timeline-changes/pending', { userId }],
    queryFn: async () => {
      const changes = await apiRequest(`/api/timeline-changes/pending?userId=${userId}`);
      return changes;
    },
    enabled: !!userId && !isDemoMode,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Demo mode fallback data
  const demoActivities = useMemo(() => {
    if (!isDemoMode) return [];
    
    return [
      // DEADLINES from demo data
      {
        id: 'd1',
        type: 'deadline' as const,
        clientName: 'Emma & Jonas',
        itemName: 'Wedding Photo Selection',
        itemType: 'photo' as const,
        timestamp: new Date(),
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        urgency: 'high' as const,
        count: 15 },
      {
        id: 'd2',
        type: 'deadline' as const,
        clientName: 'Kari & Ole Hansen',
        itemName: 'Portrait Session Review',
        itemType: 'photo' as const,
        timestamp: new Date(),
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        urgency: 'medium' as const,
        count: 8 },

      // DOWNLOADS from demo data
      {
        id: 'dl1',
        type: 'download' as const,
        clientName: 'Emma & Jonas',
        clientEmail: 'emma@email.com',
        itemName: 'Wedding-001.jpg',
        itemType: 'photo' as const,
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        count: 1 },

      // COMMENTS from demo data
      {
        id: 'c1',
        type: 'comment' as const,
        clientName: 'Emma & Jonas',
        itemName: 'Wedding-025.jpg',
        itemType: 'photo' as const,
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        message: 'Love this shot! Can we get it in high resolution?'
      },
      {
        id: 'c2',
        type: 'comment' as const,
        clientName: 'Sofie Eriksen',
        itemName: 'Portrait-Final.jpg',
        itemType: 'photo' as const,
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
        message: 'These look amazing! Thank you so much!'
      },

      // SELECTIONS from demo data
      {
        id: 's1',
        type: 'selection' as const,
        clientName: 'Kari & Ole Hansen',
        itemName: 'Portrait Session',
        itemType: 'photo' as const,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        count: 5,
        rating: 5 },
      
      // SUBMISSIONS from demo data
      {
        id: 'sub1',
        type: 'submission' as const,
        clientName: 'New Client Inquiry',
        clientEmail: 'newclient@email.com',
        itemName: 'Wedding Photography Request',
        itemType: 'photo' as const,
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        submissionType: 'contact_form',
        submissionStatus: 'pending' as const,
        message: 'Interested in wedding photography for August 2026'
      },
      {
        id: 'sub2',
        type: 'submission' as const,
        clientName: 'Potential Client',
        clientEmail: 'inquiry@email.com',
        itemName: 'Video Production Quote Request',
        itemType: 'video' as const,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        submissionType: 'quote_request',
        submissionStatus: 'pending' as const
      },
      
      // TIMELINE CHANGES from demo data (client-requested changes)
      {
        id: 'tc1',
        type: 'timeline_change' as const,
        clientName: 'Emma & Jonas',
        clientEmail: 'emma@email.com',
        itemName: 'Ceremony Time Change Request',
        itemType: 'photo' as const,
        timestamp: new Date(Date.now() - 10 * 60 * 1000),
        changeType: 'time_change',
        changeStatus: 'pending' as const,
        originalValue: '02:00 PM',
        requestedValue: '02:30 PM',
        message: 'Can we move ceremony 30 minutes later? Makeup is running behind.'
      },
      {
        id: 'tc2',
        type: 'timeline_change' as const,
        clientName: 'Emma & Jonas',
        itemName: 'First Dance Song Selection',
        itemType: 'photo' as const,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        changeType: 'comment' as any,
        changeStatus: 'pending' as const,
        message: 'We changed our first dance song to "Perfect" by Ed Sheeran - please plan for 3:45 duration'
      }
    ] as ClientActivity[];
  }, []);

  // Transform database data to ClientActivity format
  const activities = useMemo(() => {
    if (isDemoMode) {
      return demoActivities;
    }

    const transformed: ClientActivity[] = [];

    // Helper to safely convert API response to array
    const toArray = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      if (data?.data && Array.isArray(data.data)) return data.data;
      if (data?.projects && Array.isArray(data.projects)) return data.projects;
      if (data?.sessions && Array.isArray(data.sessions)) return data.sessions;
      if (data?.comments && Array.isArray(data.comments)) return data.comments;
      if (data?.downloads && Array.isArray(data.downloads)) return data.downloads;
      if (data?.submissions && Array.isArray(data.submissions)) return data.submissions;
      if (data?.events && Array.isArray(data.events)) return data.events;
      if (data?.changes && Array.isArray(data.changes)) return data.changes;
      return [];
    };

    // Safely convert all data to arrays
    const projects = toArray(projectsData);
    const sessions = toArray(proofingSessions);
    const comments = toArray(commentsData);
    const downloads = toArray(downloadsData);
    const submissions = toArray(submissionsData);
    const timelineEvents = toArray(timelineEventsData);
    const timelineChanges = toArray(timelineChangesData);

    // 1. DEADLINES from projects (database: projects table)
    projects.forEach((project: any) => {
      if (project.eventDate) {
        const deadline = new Date(project.eventDate);
        const hoursUntil = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
        
        // Only show upcoming deadlines (not past)
        if (hoursUntil > 0 && hoursUntil < 30 * 24) { // Next 30 days
          const urgency: 'high' | 'medium' | 'low' = 
            hoursUntil < 24 ? 'high' :
            hoursUntil < 72 ? 'medium' : 'low';

          transformed.push({
            id: `deadline-${project.id}`,
            type: 'deadline',
            clientName: project.clientName || 'Unknown Client',
            itemName: project.title || project.name,
            itemType: profession === 'photographer' ? 'photo' :
                      profession === 'videographer' ? 'video' :
                      profession === 'music_producer' ? 'audio' : 'product',
            timestamp: new Date(project.createdAt || Date.now()),
            deadline: deadline,
            urgency: urgency,
            count: project.projectData?.clientSelections?.length
          });
        }
      }
    });

    // 2. CLIENT SELECTIONS from proofing sessions (database: clientProofingSessions)
    sessions.forEach((session: any) => {
      if (session.status === 'awaiting_feedback' || session.status === 'completed') {
        const approvedCount = session.approvedImages?.length || 0;
        
        if (approvedCount > 0) {
          transformed.push({
            id: `selection-${session.id}`,
            type: 'selection',
            clientName: session.clientName || 'Client',
            itemName: session.sessionName,
            itemType: 'photo',
            timestamp: new Date(session.updatedAt || Date.now()),
            count: approvedCount,
            rating: 5 // Could be from session feedback
          });
        }
      }
    });

    // 3. CLIENT COMMENTS from database (clientImageComments + showcaseComments)
    comments.forEach((comment: any) => {
      transformed.push({
        id: `comment-${comment.id}`,
        type: 'comment',
        clientName: comment.clientName || comment.userName || 'Client',
        clientEmail: comment.clientEmail || comment.userEmail,
        itemName: comment.imageTitle || comment.showcaseTitle || 'Item',
        itemType: 'photo', // Could be enhanced with type detection
        timestamp: new Date(comment.createdAt || Date.now()),
        message: comment.comment || comment.content
      });
    });

    // 4. DOWNLOADS from database (images table with downloadCount)
    downloads.forEach((download: any) => {
      if (download.downloadCount > 0) {
        transformed.push({
          id: `download-${download.id}`,
          type: 'download',
          clientName: download.clientName || 'Client',
          clientEmail: download.clientEmail,
          itemName: download.fileName,
          itemType: download.mimeType?.startsWith('image') ? 'photo' :
                    download.mimeType?.startsWith('video') ? 'video' :
                    download.mimeType?.startsWith('audio') ? 'audio' : 'photo',
          timestamp: new Date(download.updatedAt || Date.now()),
          count: download.downloadCount
        });
      }
    });

    // 5. SUBMISSIONS from database (clientSubmissions + submissions tables)
    submissions.forEach((submission: any) => {
      transformed.push({
        id: `submission-${submission.id}`,
        type: 'submission',
        clientName: submission.clientName || submission.data?.name || 'New Inquiry',
        clientEmail: submission.clientEmail || submission.data?.email,
        itemName: submission.title || submission.submissionType || 'Client Submission',
        itemType: 'photo', // Could be enhanced based on submissionType
        timestamp: new Date(submission.submittedAt || submission.createdAt || Date.now()),
        submissionType: submission.submissionType,
        submissionStatus: submission.status,
        message: submission.data?.message || submission.content
      });
    });

    // 6. TIMELINE EVENTS from database (upcoming ceremony, meetings, photo sessions)
    timelineEvents.forEach((event: any) => {
      const eventDateTime = event.eventTime 
        ? new Date(`${event.eventDate}T${event.eventTime}`)
        : new Date(event.eventDate);
      
      const hoursUntil = (eventDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
      
      // Only show events happening in next 7 days
      if (hoursUntil > 0 && hoursUntil < 7 * 24) {
        const urgency: 'high' | 'medium' | 'low' = 
          hoursUntil < 2 ? 'high' :     // Event in less than 2 hours!
          hoursUntil < 24 ? 'medium' :  // Event today
          'low';                         // Event this week

        transformed.push({
          id: `timeline-event-${event.id}`,
          type: 'timeline_event',
          clientName: event.projectData?.clientName || event.clientName || 'Event',
          itemName: event.title,
          itemType: 'photo',
          timestamp: new Date(event.createdAt || Date.now()),
          deadline: eventDateTime,
          urgency: urgency,
          eventType: event.type,
          eventTime: event.eventTime,
          eventLocation: event.location,
          message: event.description,
          source: event.source || 'timeline_event'
        });
      }
    });

    // 7. TIMELINE CHANGES from database (client-requested changes to wedding timeline)
    timelineChanges.forEach((change: any) => {
      transformed.push({
        id: `timeline-change-${change.id}`,
        type: 'timeline_change',
        clientName: change.clientName || change.requestedBy || 'Client',
        itemName: change.timelineTitle || 'Wedding Timeline Change',
        itemType: 'photo',
        timestamp: new Date(change.requestedAt || change.createdAt || Date.now()),
        changeType: change.changeType,
        changeStatus: change.status,
        originalValue: change.changeData?.originalValue,
        requestedValue: change.changeData?.requestedValue,
        message: change.requestReason || change.changeData?.reason,
        urgency: 'high' // Client timeline changes are always high priority
      });
    });

    // Sort by timestamp (most recent first)
    return transformed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [isDemoMode, demoActivities, projectsData, proofingSessions, commentsData, downloadsData, submissionsData, timelineEventsData, timelineChangesData, profession]);

  const isLoading = projectsLoading || proofingLoading || commentsLoading || downloadsLoading || submissionsLoading || timelineEventsLoading || timelineChangesLoading;

  // Group activities by type
  const deadlines = activities.filter(a => a.type === 'deadline').sort((a, b) => 
    (a.deadline?.getTime() || 0) - (b.deadline?.getTime() || 0)
  );
  const timelineEvents = activities.filter(a => a.type === 'timeline_event').sort((a, b) => 
    (a.deadline?.getTime() || 0) - (b.deadline?.getTime() || 0)
  );
  const timelineChanges = activities.filter(a => a.type === 'timeline_change');
  const comments = activities.filter(a => a.type === 'comment');
  const downloads = activities.filter(a => a.type === 'download');
  const selections = activities.filter(a => a.type === 'selection');
  const views = activities.filter(a => a.type === 'view');
  const submissions = activities.filter(a => a.type === 'submission');

  // Calculate urgency stats
  const urgentDeadlines = deadlines.filter(d => d.urgency === 'high').length;
  const urgentTimelineEvents = timelineEvents.filter(e => e.urgency === 'high').length;
  const totalComments = comments.length;
  const totalDownloads = downloads.reduce((sum, d) => sum + (d.count || 1), 0);

  // Toggle section
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Format time ago
  const timeAgo = (date: Date) => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Alias for formatTimestamp
  const formatTimestamp = timeAgo;

  // Helper function to create project from submission
  const handleCreateProjectFromSubmission = useCallback((activity: ClientActivity) => {
    if (!onCreateProjectFromSubmission) return;
    
    // Extract submission data and transform to project data
    const submissionData = {
      clientName: activity.clientName,
      clientEmail: activity.clientEmail,
      projectName: activity.itemName,
      description: activity.message || ', ',
      submissionType: activity.submissionType,
      submissionId: activity.id,
      // Auto-detect project type from submission
      projectType: activity.submissionType?.includes('wedding') ? 'wedding' :
                   activity.submissionType?.includes('portrait') ? 'portrait' :
                   activity.submissionType?.includes('video') ? 'video' :
                   activity.submissionType?.includes('commercial') ? 'commercial' :
                   'event'
    };
    
    onCreateProjectFromSubmission(submissionData);
  }, [onCreateProjectFromSubmission]);

  // Helper function to accept all timeline changes and add to worklog
  const handleAcceptAllTimelineChanges = useCallback(async () => {
    if (!onAcceptTimelineChanges || timelineChanges.length === 0) return;
    
    setAcceptingChanges(true);
    
    try {
      // Create worklog entry summarizing all changes
      const worklogData = {
        title: `Client Timeline Changes - ${timelineChanges.length} requests reviewed`,
        description: `Reviewed and accepted ${timelineChanges.length} timeline change request(s) from client:\n\n` +
	          timelineChanges.map((change, index) => 
	            `${index + 1}. ${change.itemName}\n` +
	            `   Type: ${change.changeType?.replace('_',', ')}\n` +
            (change.originalValue && change.requestedValue ? 
              `   Change: ${change.originalValue} → ${change.requestedValue}\n` : ', ') +
            (change.message ? `   Reason: "${change.message},"\n` : ', ') +
            `   Client: ${change.clientName}\n`
          ).join('\n') +
          `\n💡 Next Steps: Discuss these changes in next client meeting and update all vendors accordingly.`,
        category: 'client_meeting',
        timeSpent: timelineChanges.length * 5, // 5 minutes per change reviewed
        nextSteps: `• Confirm all changes with client in next meeting\n` +
                   `• Update vendors about timeline modifications\n` +
                   `• Adjust equipment/location plans if needed\n` +
                   `• Update Google Calendar invites`,
        isPrivate: false,
        projectId: userId, // This should be the actual project ID from timeline
        mood: 'productive'
      };
      
      // Call the accept handler with changes and worklog data
      await onAcceptTimelineChanges(timelineChanges, worklogData);
      
      setAcceptingChanges(false);
    } catch (error) {
      console.error('Error accepting timeline changes: ', error);
      setAcceptingChanges(false);
    }
  }, [timelineChanges, onAcceptTimelineChanges, userId]);

  // Format deadline countdown
  const deadlineCountdown = (deadline: Date) => {
    const hours = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 0) return 'OVERDUE';
    if (hours < 24) return `${hours}h left`;
    return `${days}d left`;
  };

  // Get urgency color
  const getUrgencyColor = (urgency?: 'high' | 'medium' | 'low', deadline?: Date) => {
    if (!deadline) return '#95A5A6';
    
    const hours = (deadline.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hours < 0) return '#E74C3C'; // Overdue - Red
    if (hours < 24) return '#E74C3C'; // < 24h - Red
    if (hours < 72) return '#F39C12'; // < 3 days - Orange
    return '#27AE60'; // Green
  };

  // Get item type icon
  const getItemTypeIcon = (type: 'photo' | 'video' | 'audio' | 'product') => {
    switch (type) {
      case 'photo': return <PhotoLibrary fontSize="small" />;
      case 'video': return <VideoLibrary fontSize="small" />;
      case 'audio': return <MusicNote fontSize="small" />;
      case 'product': return <Business fontSize="small" />;
    }
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 2, bgcolor: 'rgba(2, 5, 5,255,255,0.03)', border: '1px solid rgba(2, 5, 5,255,255,0.1)' }}>
        <LinearProgress sx={{ bgcolor: 'rgba(2, 5, 5,255,255,0.1)','& .MuiLinearProgress-bar': { bgcolor: accentColor } }} />
      </Paper>
    );
  }

  return (
    <Box sx={{ 
      background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.95) 0%, rgba(25, 25, 45, 0.9) 100%)',
      backdropFilter: 'blur(20px)',
      borderRadius: 3,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      {/* Enhanced Header with Gradient */}
      <Box sx={{ 
        p: 3,
        background: `linear-gradient(135deg, ${accentColor}30 0%, ${accentColor}15 100%)`,
        borderBottom: `2px solid ${accentColor}60`,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at top right, ${accentColor}20 0%, transparent 70%)`,
          pointerEvents: 'none'
        }
      }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {professionIcon && (
              <Box sx={{ 
                color: professionColor, 
                display: 'flex', 
                alignItems: 'center',
                bgcolor: `${professionColor}20`,
                p: 1,
                borderRadius: 2,
                border: `1px solid ${professionColor}40`
              }}>
                {professionIcon}
              </Box>
            )}
            <Box sx={{
              bgcolor: `${accentColor}30`,
              p: 1,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              border: `1px solid ${accentColor}50`
            }}>
              <Notifications sx={{ color: accentColor, fontSize: 24 }} />
            </Box>
            <Typography variant="h6" fontWeight="700" sx={{ 
              color: 'white',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              {enhancedProfessionConfig?.displayName || professionConfig?.displayName
                ? `${enhancedProfessionConfig?.displayName || professionConfig.displayName} Aktivitet`
                : 'Klientaktivitet'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            {isSupported && (
              <Tooltip title="Innstillinger for push-varsler">
                <IconButton
                  size="small"
                  onClick={() => setPushSettingsOpen(true)}
                  sx={{ 
                    color: pushEnabled ? accentColor : 'rgba(255,255,255,0.6)',
                    bgcolor: pushEnabled ? `${accentColor}20` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${pushEnabled ? accentColor + '40' : 'rgba(255,255,255,0.1)'}`,
                    '&:hover': {
                      bgcolor: pushEnabled ? `${accentColor}30` : 'rgba(255,255,255,0.1)',
                      transform: 'scale(1.05)'
                    },
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  <Notifications fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {timelineChanges.length > 0 && (
              <Chip 
                label={`${timelineChanges.length} ${timelineChanges.length === 1 ? 'endring' : 'endringer'}`}
                size="small"
                icon={<Warning fontSize="small" />}
                sx={{ 
                  bgcolor: '#FF4081',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  height: 28,
                  boxShadow: '0 4px 12px rgba(255, 64, 129, 0.4)',
                  animation: 'pulse 2s infinite',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  '@keyframes pulse': {
                    '0%, 100%': { 
                      boxShadow: '0 4px 12px rgba(255, 64, 129, 0.4)',
                      transform: 'scale(1)'
                    },
                    '50%': { 
                      boxShadow: '0 4px 20px rgba(255, 64, 129, 0.6)',
                      transform: 'scale(1.02)'
                    }
                  }
                }}
              />
            )}
            {urgentTimelineEvents > 0 && (
              <Chip 
                label={`${urgentTimelineEvents} kommende`}
                size="small"
                icon={<Schedule fontSize="small" />}
                sx={{ 
                  bgcolor: '#9C27B0',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  height: 28,
                  boxShadow: '0 4px 12px rgba(156, 39, 176, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              />
            )}
            {urgentDeadlines > 0 && (
              <Chip 
                label={`${urgentDeadlines} haster`}
                size="small"
                icon={<Warning fontSize="small" />}
                sx={{ 
                  bgcolor: '#E74C3C',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  height: 28,
                  boxShadow: '0 4px 12px rgba(231, 76, 60, 0.4)',
                  animation: 'pulse 2s infinite',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              />
            )}
            {totalComments > 0 && (
              <Badge 
                badgeContent={totalComments} 
                color="error"
                sx={{
                  '& .MuiBadge-badge': {
                    boxShadow: '0 2px 8px rgba(244, 67, 54, 0.5)',
                    fontWeight: 700
                  }
                }}
              >
                <Comment sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
              </Badge>
            )}
          </Stack>
        </Box>
      </Box>

      {/* TIMELINE CHANGES Section - CLIENT REQUESTS (HIGHEST PRIORITY) */}
      {timelineChanges.length > 0 && (
        <>
          <Box>
            <Box 
              sx={{ 
                p: 2,
                background: 'linear-gradient(135deg, rgba(255, 64, 129, 0.15) 0%, rgba(255, 64, 129, 0.08) 100%)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                borderLeft: '4px solid #FF4081',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  background: 'linear-gradient(135deg, rgba(255, 64, 129, 0.25) 0%, rgba(255, 64, 129, 0.15) 100%)',
                  transform: 'translateX(4px)',
                  boxShadow: '0 4px 16px rgba(255, 64, 129, 0.3)'
                }
              }}
              onClick={() => toggleSection('timeline_changes')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                <Box sx={{
                  bgcolor: '#FF408130',
                  p: 1,
                  borderRadius: 2,
                  display: 'flex',
                  border: '1px solid #FF408150'
                }}>
                  <Warning sx={{ color: '#FF4081', fontSize: 22 }} />
                </Box>
                <Typography variant="subtitle2" fontWeight="700" sx={{ color: 'white', fontSize: '0.95rem' }}>
                  Klientens tidslinjeforespørsler
                </Typography>
                <Chip 
                  label={timelineChanges.length}
                  size="small"
                  sx={{ 
                    bgcolor: '#FF4081',
                    color: 'white',
                    height: 24,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    minWidth: 24,
                    boxShadow: '0 2px 8px rgba(255, 64, 129, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}
                />
                <Chip 
                  label="GJENNOMGANG NØDVENDIG"
                  size="small"
                  sx={{ 
                    bgcolor: '#F44336',
                    color: 'white',
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    px: 1,
                    boxShadow: '0 2px 6px rgba(244, 67, 54, 0.3)'
                  }}
                />
                {onAcceptTimelineChanges && timelineChanges.length > 0 && (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={acceptingChanges}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcceptAllTimelineChanges();
                    }}
                    sx={{
                      ml: 'auto',
                      bgcolor: '#4CAF50',
                      color: 'white',
                      fontSize: '0.7rem',
                      height: 32,
                      px: 2,
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        bgcolor: '#45a049',
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 16px rgba(76, 175, 80, 0.5)'
                      },
                      '&:active': {
                        transform: 'translateY(0)'
                      }
                    }}
                  >
                    {acceptingChanges ? 'Behandler...' : 'Godta alle og legg til i arbeidslogg'}
                  </Button>
                )}
              </Box>
              <IconButton 
                size="small" 
                sx={{ 
                  color: 'white',
                  transition: 'transform 0.2s',
                  transform: expandedSections.has('timeline_changes') ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              >
                <ExpandMore />
              </IconButton>
            </Box>

            <Collapse in={expandedSections.has('timeline_changes')}>
              <List dense sx={{ p: 0 }}>
                {timelineChanges.map((activity, index) => (
                  <ListItem 
                    key={activity.id}
                    sx={{ 
                      px: 3,
                      py: 2.5,
                      borderBottom: index < timelineChanges.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                      background: 'rgba(255, 64, 129, 0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: 'rgba(255, 64, 129, 0.15)',
                        transform: 'translateX(8px)',
                        boxShadow: 'inset 4px 0 0 #FF4081'
                      }
                    }}
                    onClick={() => onActivityClick?.(activity)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ 
                        bgcolor: '#FF408120',
                        color: '#FF4081',
                        width: 48,
                        height: 48,
                        border: '2px solid #FF4081',
                        boxShadow: '0 4px 12px rgba(255, 64, 129, 0.3)'
                      }}>
                        <Warning fontSize="medium" />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="body2" fontWeight="700" sx={{ color: 'white', fontSize: '0.95rem' }}>
                            {activity.clientName}
                          </Typography>
                          <Chip 
                            label="KLIENTFORESPØRSEL" 
                            size="small" 
                            sx={{ 
                              height: 18, 
                              fontSize: '0.65rem', 
                              bgcolor: '#FF4081', 
                              color: 'white',
                              fontWeight: 700,
                              px: 1
                            }} 
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" display="block" sx={{ 
                            color: 'rgba(255, 255, 255, 0.95)', 
                            fontWeight: 600,
                            mb: 1
                          }}>
                            {activity.itemName}
                          </Typography>
                          {activity.changeType && (
                            <Chip 
                              label={activity.changeType.replace('_', ' ').toUpperCase()}
                              size="small"
                              sx={{ 
                                height: 20, 
                                fontSize: '0.65rem', 
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                mt: 0.5,
                                mr: 1,
                                fontWeight: 600,
                                border: '1px solid rgba(255, 255, 255, 0.2)'
                              }}
                            />
                          )}
                          {activity.originalValue && activity.requestedValue && (
                            <Box sx={{ 
                              mt: 1.5,
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: 'rgba(0, 0, 0, 0.2)',
                              border: '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                              <Typography variant="caption" display="block" sx={{ 
                                color: 'rgba(255, 255, 255, 0.6)',
                                fontSize: '0.7rem',
                                mb: 0.5
                              }}>
                                ORIGINAL
                              </Typography>
                              <Typography variant="body2" sx={{ 
                                color: 'rgba(255, 255, 255, 0.8)',
                                fontWeight: 600,
                                mb: 1
                              }}>
                                {activity.originalValue}
                              </Typography>
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1,
                                my: 1
                              }}>
                                <Box sx={{ 
                                  flex: 1, 
                                  height: '2px', 
                                  bgcolor: '#FF4081' 
                                }} />
                                <Typography sx={{ 
                                  color: '#FF4081',
                                  fontSize: '0.75rem',
                                  fontWeight: 700
                                }}>
                                  FORESPURT ENDRING
                                </Typography>
                                <Box sx={{ 
                                  flex: 1, 
                                  height: '2px', 
                                  bgcolor: '#FF4081' 
                                }} />
                              </Box>
                              <Typography variant="caption" display="block" sx={{ 
                                color: 'rgba(255, 255, 255, 0.6)',
                                fontSize: '0.7rem',
                                mb: 0.5
                              }}>
                                NY VERDI
                              </Typography>
                              <Typography variant="body2" sx={{ 
                                color: '#4CAF50',
                                fontWeight: 700,
                                fontSize: '0.95rem'
                              }}>
                                {activity.requestedValue}
                              </Typography>
                            </Box>
                          )}
                          {activity.message && (
                            <Box sx={{ 
                              mt: 1.5,
                              p: 1.5,
                              bgcolor: 'rgba(255, 255, 255, 0.05)',
                              borderRadius: 2,
                              borderLeft: '3px solid #FF4081'
                            }}>
                              <Typography variant="caption" sx={{ 
                                color: 'rgba(255, 255, 255, 0.6)',
                                display: 'block',
                                mb: 0.5,
                                fontSize: '0.7rem',
                                fontWeight: 600
                              }}>
                                💬 KLIENTMELDING
                              </Typography>
                              <Typography variant="body2" sx={{ 
                                color: 'rgba(255, 255, 255, 0.9)', 
                                fontStyle: 'italic',
                                lineHeight: 1.5
                              }}>
                                "{activity.message}"
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1.5, 
                            mt: 2,
                            pt: 1.5,
                            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                          }}>
                            <Typography variant="caption" sx={{ 
                              color: 'rgba(255, 255, 255, 0.5)',
                              fontSize: '0.7rem'
                            }}>
                              🕐 {formatTimestamp(activity.timestamp)}
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={(e) => {
                                e.stopPropagation();
                                onActivityClick?.(activity);
                              }}
                              sx={{
                                ml: 'auto',
                                borderColor: '#FF4081',
                                color: '#FF4081',
                                fontSize: '0.7rem',
                                height: 28,
                                px: 2,
                                fontWeight: 700,
                                transition: 'all 0.2s',
                                '&:hover': {
                                  borderColor: '#FF4081',
                                  bgcolor: 'rgba(255, 64, 129, 0.15)',
                                  transform: 'translateY(-2px)',
                                  boxShadow: '0 4px 12px rgba(255, 64, 129, 0.3)'
                                }
                              }}
                            >
                              Gjennomgå endring →
                            </Button>
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>

          <Divider sx={{ borderColor: 'rgba(2, 5, 5,255,255,0.1)' }} />
        </>
      )}

      {/* SUBMISSIONS Section - HIGHEST PRIORITY */}
      <Box>
        <Box 
          sx={{ 
            p: 2,
            background: submissions.length > 0 
              ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.15) 0%, rgba(255, 152, 0, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            borderLeft: submissions.length > 0 ? '4px solid #FF9800' : '4px solid transparent',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: submissions.length > 0
                ? 'linear-gradient(135deg, rgba(255, 152, 0, 0.25) 0%, rgba(255, 152, 0, 0.15) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)',
              transform: 'translateX(4px)',
              boxShadow: submissions.length > 0 ? '0 4px 16px rgba(255, 152, 0, 0.2)' : 'none'
            }
          }}
          onClick={() => toggleSection('submissions')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              bgcolor: '#FF980030',
              p: 1,
              borderRadius: 2,
              display: 'flex',
              border: '1px solid #FF980050'
            }}>
              <Person sx={{ color: '#FF9800', fontSize: 22 }} />
            </Box>
            <Typography variant="subtitle2" fontWeight="700" sx={{ color: 'white', fontSize: '0.95rem' }}>
              Nye innsendinger
            </Typography>
            {submissions.length > 0 && (
              <>
                <Chip 
                  label={submissions.length}
                  size="small"
                  sx={{ 
                    bgcolor: '#FF9800',
                    color: 'white',
                    height: 24,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    minWidth: 24,
                    boxShadow: '0 2px 8px rgba(255, 152, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    animation: 'pulse 2s infinite'
                  }}
                />
                <Chip 
                  label="HANDLING KREVES"
                  size="small"
                  sx={{ 
                    bgcolor: '#F44336',
                    color: 'white',
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    px: 1,
                    boxShadow: '0 2px 6px rgba(244, 67, 54, 0.3)'
                  }}
                />
              </>
            )}
          </Box>
          <IconButton 
            size="small" 
            sx={{ 
              color: 'white',
              transition: 'transform 0.2s',
              transform: expandedSections.has('submissions') ? 'rotate(180deg)' : 'rotate(0deg)'
            }}
          >
            <ExpandMore />
          </IconButton>
        </Box>

        <Collapse in={expandedSections.has('submissions')}>
          <List dense sx={{ p: 0 }}>
            {submissions.length === 0 ? (
              <ListItem sx={{ 
                py: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Person sx={{ 
                  fontSize: 48, 
                  color: 'rgba(255, 255, 255, 0.2)',
                  mb: 2
                }} />
                <Typography variant="body2" sx={{ 
                  color: 'rgba(255, 255, 255, 0.5)', 
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  Ingen nye innsendinger
                </Typography>
                <Typography variant="caption" sx={{ 
                  color: 'rgba(255, 255, 255, 0.3)',
                  textAlign: 'center',
                  mt: 0.5
                }}>
                  Klientforespørsler vil vises her
                </Typography>
              </ListItem>
            ) : (
              submissions.map((activity, index) => (
                <ListItem 
                  key={activity.id}
                  sx={{ 
                    px: 3,
                    py: 2.5,
                    borderBottom: index < submissions.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                    background: activity.submissionStatus === 'pending' 
                      ? 'rgba(255, 152, 0, 0.05)' 
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      background: 'rgba(255, 152, 0, 0.15)',
                      transform: 'translateX(8px)',
                      boxShadow: 'inset 4px 0 0 #FF9800'
                    }
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      bgcolor: '#FF980020',
                      color: '#FF9800',
                      width: 48,
                      height: 48,
                      border: '2px solid #FF9800',
                      boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)'
                    }}>
                      <Person fontSize="medium" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="body2" fontWeight="700" sx={{ color: 'white', fontSize: '0.95rem' }}>
                          {activity.clientName}
                        </Typography>
                        {activity.submissionStatus === 'pending' && (
                          <Chip 
                            label="NY" 
                            size="small" 
                            sx={{ 
                              height: 18, 
                              fontSize: '0.65rem', 
                              bgcolor: '#FF9800', 
                              color: 'white',
                              fontWeight: 700,
                              px: 1,
                              animation: 'pulse 1.5s infinite'
                            }} 
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" display="block" sx={{ 
                          color: 'rgba(255, 255, 255, 0.95)', 
                          fontWeight: 600,
                          mb: 1
                        }}>
                          {activity.itemName}
                        </Typography>
                        {activity.submissionType && (
                          <Chip 
                            label={activity.submissionType.replace('_', ' ').toUpperCase()}
                            size="small"
                            sx={{ 
                              height: 20, 
                              fontSize: '0.65rem',
                              bgcolor: 'rgba(255, 255, 255, 0.1)',
                              color: 'white',
                              fontWeight: 600,
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              mb: 1
                            }}
                          />
                        )}
                        {activity.clientEmail && (
                          <Typography variant="caption" display="block" sx={{ 
                            color: 'rgba(255, 255, 255, 0.6)',
                            mb: 1
                          }}>
                            ✉️ {activity.clientEmail}
                          </Typography>
                        )}
                        {activity.message && (
                          <Box sx={{ 
                            mt: 1.5,
                            p: 1.5,
                            bgcolor: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: 2,
                            borderLeft: '3px solid #FF9800'
                          }}>
                            <Typography variant="caption" sx={{ 
                              color: 'rgba(255, 255, 255, 0.6)',
                              display: 'block',
                              mb: 0.5,
                              fontSize: '0.7rem',
                              fontWeight: 600
                            }}>
                              💬 MELDING
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              color: 'rgba(255, 255, 255, 0.9)', 
                              fontStyle: 'italic',
                              lineHeight: 1.5
                            }}>
                              "{activity.message}"
                            </Typography>
                          </Box>
                        )}
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1.5, 
                          mt: 2,
                          pt: 1.5,
                          borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <Typography variant="caption" sx={{ 
                            color: 'rgba(255, 255, 255, 0.5)',
                            fontSize: '0.7rem'
                          }}>
                            🕐 {formatTimestamp(activity.timestamp)}
                          </Typography>
                          {activity.submissionStatus === 'pending' && onCreateProjectFromSubmission && (
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<PhotoCamera fontSize="small" />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateProjectFromSubmission(activity);
                              }}
                              sx={{
                                ml: 'auto',
                                bgcolor: accentColor,
                                color: 'white',
                                fontSize: '0.7rem',
                                height: 32,
                                px: 2,
                                fontWeight: 700,
                                boxShadow: `0 4px 12px ${accentColor}60`,
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                  bgcolor: `${accentColor}dd`,
                                  transform: 'translateY(-2px)',
                                  boxShadow: `0 6px 16px ${accentColor}80`
                                },
                                '&:active': {
                                  transform: 'translateY(0)'
                                }
                              }}
                            >
                              Opprett prosjekt →
                            </Button>
                          )}
                        </Box>
                      </Box>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Collapse>
      </Box>

      <Divider sx={{ borderColor: 'rgba(2, 5, 5,255,255,0.1)' }} />

      {/* TIMELINE EVENTS Section (Upcoming ceremony, meetings, photo sessions) */}
      {timelineEvents.length > 0 && (
        <>
          <Box>
            <Box 
              sx={{ 
                p: 1.5, 
                bgcolor: urgentTimelineEvents > 0 ? 'rgba(1, 5, 6, 39, 176, 0.08)' : 'rgba(2, 5, 5,255,255,0.03)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                border: urgentTimelineEvents > 0 ? '1px solid rgba(1, 5, 6, 39, 176, 0.3)' : 'none','&:hover': {
                  bgcolor: 'rgba(1, 5, 6, 39, 176, 0.12)'
                }
              }}
              onClick={() => toggleSection('timeline_events')}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule sx={{ color: '#9C27B0', fontSize: 22 }} />
                <Typography variant="subtitle2" fontWeight="600" sx={{ color: 'white' }}>
                  Upcoming Timeline Events
                </Typography>
                {timelineEvents.length > 0 && (
                  <Chip 
                    label={timelineEvents.length}
                    size="small"
                    sx={{ 
                      bgcolor: urgentTimelineEvents > 0 ? '#9C27B0' : '#9C27B030',
                      color: urgentTimelineEvents > 0 ? 'white' : '#9C27B0',
                      height: 20,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      animation: urgentTimelineEvents > 0 ? 'pulse 2s infinite' : 'none'
                    }}
                  />
                )}
              </Box>
              <IconButton size="small" sx={{ color: 'white' }}>
                {expandedSections.has('timeline_events') ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>

            <Collapse in={expandedSections.has('timeline_events')}>
              <List dense sx={{ p: 0 }}>
                {timelineEvents.map((activity) => {
                  const hoursUntil = activity.deadline 
                    ? (activity.deadline.getTime() - Date.now()) / (1000 * 60 * 60)
                    : 999;
                  const urgencyColor = hoursUntil < 2 ? '#9C27B0' : hoursUntil < 24 ? '#FF9800' : '#4CAF50';

                  return (
                    <ListItem 
                      key={activity.id}
                      sx={{ 
                        px: 2,
                        py: 2,
                        borderBottom: '1px solid rgba(2, 5, 5,255,255,0.05)',
                        bgcolor: hoursUntil < 2 ? 'rgba(1, 5, 6, 39, 176, 0.08)' : 'transparent','&:hover': {
                          bgcolor: 'rgba(1, 5, 6, 39, 176, 0.15)',
                          cursor: 'pointer'
                        }
                      }}
                      onClick={() => onActivityClick?.(activity)}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ 
                          bgcolor: `${urgencyColor}30`,
                          color: urgencyColor,
                          width: 40,
                          height: 40,
                          border: `2px solid ${urgencyColor}`
                        }}>
                          <Schedule />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="body2" fontWeight="600" sx={{ color: 'white' }}>
                              {activity.itemName}
                            </Typography>
                            {hoursUntil < 2 && (
                              <Chip 
                                label="SNART!" 
                                size="small" 
                                sx={{ 
                                  height: 16, 
                                  fontSize: '0.6rem', 
                                  bgcolor: '#9C27B0', 
                                  color: 'white',
                                  fontWeight: 700,
                                  animation: 'pulse 2s infinite'
                                }} 
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block" sx={{ color: 'rgba(2, 5, 5,255,255,0.8)', fontWeight: 500}}>
                              {activity.clientName}
                              {activity.eventType && ` • ${activity.eventType}`}
                            </Typography>
                            {activity.eventLocation && (
                              <Typography variant="caption" display="block" sx={{ color: 'rgba(2, 5, 5,255,255,0.6)' }}>
                                📍 {activity.eventLocation}
                              </Typography>
                            )}
                            {activity.message && (
                              <Typography variant="caption" display="block" sx={{ 
                                color: 'rgba(2, 5, 5,255,255,0.7)', 
                                fontStyle: 'italic',
                                mt: 0.5 }}>
                                {activity.message}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              {activity.deadline && (
                                <Chip
                                  label={
                                    activity.eventTime 
                                      ? `${new Date(activity.deadline).toLocaleDateString('no-NO', { weekday: 'short', month: 'short', day: 'numeric' })} at ${activity.eventTime}`
                                      : deadlineCountdown(activity.deadline)
                                  }
                                  size="small"
                                  sx={{
                                    bgcolor: urgencyColor,
                                    color: 'white',
                                    height: 18,
                                    fontSize: '0.65rem',
                                    fontWeight: 700}}
                                />
                              )}
                              <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)', ml: 'auto' }}>
                                {hoursUntil < 1 ? 'Mindre enn 1 time!' :
                                 hoursUntil < 24 ? `Om ${Math.round(hoursUntil)} timer` :
                                 `Om ${Math.round(hoursUntil / 24)} dager`}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Collapse>
          </Box>

          <Divider sx={{ borderColor: 'rgba(2, 5, 5,255,255,0.1)' }} />
        </>
      )}

      {/* DEADLINES Section */}
      <Box>
        <Box 
          sx={{ 
            p: 1.5, 
            bgcolor: 'rgba(2, 5, 5,255,255,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer','&:hover': {
              bgcolor: 'rgba(2, 5, 5,255,255,0.05)'
            }
          }}
          onClick={() => toggleSection('deadlines')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Schedule sx={{ color: '#E74C3C', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight="600" sx={{ color: 'white' }}>
              Frister
            </Typography>
            {deadlines.length > 0 && (
              <Chip 
                label={deadlines.length}
                size="small"
                sx={{ 
                  bgcolor: '#E74C3C20',
                  color: '#E74C3C',
                  height: 20,
                  fontSize: '0.7rem'
                }}
              />
            )}
          </Box>
          <IconButton size="small" sx={{ color: 'white' }}>
            {expandedSections.has('deadlines') ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={expandedSections.has('deadlines')}>
          <List dense sx={{ p: 0 }}>
            {deadlines.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)', fontStyle: 'italic' }}>
                      Ingen kommende frister
                    </Typography>
                  }
                />
              </ListItem>
            ) : (
              deadlines.map((activity) => {
                const urgencyColor = getUrgencyColor(activity.urgency, activity.deadline);
                const isOverdue = activity.deadline && activity.deadline.getTime() < Date.now();
                const isUrgent = activity.deadline && (activity.deadline.getTime() - Date.now()) < 24 * 60 * 60 * 1000;

                return (
                  <ListItem 
                    key={activity.id}
                    sx={{ 
                      px: 2,
                      py: 1.5,
                      borderLeft: `4px solid ${urgencyColor}`,
                      borderBottom: '1px solid rgba(2, 5, 5,255,255,0.05)',
                      bgcolor: isOverdue || isUrgent ? `${urgencyColor}10` : 'transparent','&:hover': {
                        bgcolor: `${urgencyColor}15`,
                        cursor: 'pointer'
                      }
                    }}
                    onClick={() => onActivityClick?.(activity)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ 
                        bgcolor: `${urgencyColor}30`,
                        color: urgencyColor,
                        width: 40,
                        height: 40,
                        border: `2px solid ${urgencyColor}`
                      }}>
                        {isOverdue ? <ErrorIcon /> : <Schedule />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" fontWeight="600" sx={{ color: 'white' }}>
                            {activity.clientName}
                          </Typography>
                          {getItemTypeIcon(activity.itemType)}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.7)', display: 'block' }}>
                            {activity.itemName}
                          </Typography>
                          {activity.count !== undefined && (
                            <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.6)', display: 'block' }}>
                              {activity.count} elementer valgt
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                            <Chip
                              label={activity.deadline ? deadlineCountdown(activity.deadline) : 'Ingen frist'}
                              size="small"
                              sx={{
                                bgcolor: urgencyColor,
                                color: 'white',
                                height: 18,
                                fontSize: '0.65rem',
                                fontWeight: 700}}
                            />
                            {isOverdue && (
                              <Chip
                                label="FORFALT"
                                size="small"
                                sx={{
                                  bgcolor: '#E74C3C',
                                  color: 'white',
                                  height: 18,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  animation: 'pulse 2s infinite'
                                }}
                              />
                            )}
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })
            )}
          </List>
        </Collapse>
      </Box>

      <Divider sx={{ borderColor: 'rgba(2, 5, 5,255,255,0.1)' }} />

      {/* COMMENTS Section */}
      <Box>
        <Box 
          sx={{ 
            p: 1.5, 
            bgcolor: 'rgba(2, 5, 5,255,255,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer','&:hover': {
              bgcolor: 'rgba(2, 5, 5,255,255,0.05)'
            }
          }}
          onClick={() => toggleSection('comments')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Comment sx={{ color: '#9C27B0', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight="600" sx={{ color: 'white' }}>
              Klientkommentarer
            </Typography>
            {comments.length > 0 && (
              <Badge badgeContent={comments.length} color="error" />
            )}
          </Box>
          <IconButton size="small" sx={{ color: 'white' }}>
            {expandedSections.has('comments') ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={expandedSections.has('comments')}>
          <List dense sx={{ p: 0 }}>
            {comments.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)', fontStyle: 'italic' }}>
                      Ingen nye kommentarer
                    </Typography>
                  }
                />
              </ListItem>
            ) : (
              comments.map((activity) => (
                <ListItem 
                  key={activity.id}
                  sx={{ 
                    px: 2,
                    py: 1.5,
                    borderBottom: '1px solid rgba(2, 5, 5,255,255,0.05)','&:hover': {
                      bgcolor: 'rgba(1, 5, 6, 39, 176, 0.1)',
                      cursor: 'pointer'
                    }
                  }}
                  onClick={() => onActivityClick?.(activity)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      bgcolor: '#9C27B030',
                      color: '#9C27B0',
                      width: 36,
                      height: 36 }}>
                      <Comment fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="600" sx={{ color: 'white' }}>
                          {activity.clientName}
                        </Typography>
                        {getItemTypeIcon(activity.itemType)}
                        <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)' }}>
                          {timeAgo(activity.timestamp)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.6)', display: 'block', mb: 0.5 }}>
                          på: {activity.itemName}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'rgba(2, 5, 5,255,255,0.9)',
                            fontStyle: 'italic',
                            bgcolor: 'rgba(1, 5, 6, 39, 176, 0.1)',
                            p: 1,
                            borderRadius: 1,
                            borderLeft: '2px solid #9C27B0'
                          }}
                        >
                          "{activity.message}"
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Collapse>
      </Box>

      <Divider sx={{ borderColor: 'rgba(2, 5, 5,255,255,0.1)' }} />

      {/* DOWNLOADS Section */}
      <Box>
        <Box 
          sx={{ 
            p: 1.5, 
            bgcolor: 'rgba(2, 5, 5,255,255,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer','&:hover': {
              bgcolor: 'rgba(2, 5, 5,255,255,0.05)'
            }
          }}
          onClick={() => toggleSection('downloads')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Download sx={{ color: '#2196F3', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight="600" sx={{ color: 'white' }}>
              Nedlastinger
            </Typography>
            {totalDownloads > 0 && (
              <Chip 
                label={totalDownloads}
                size="small"
                sx={{ 
                  bgcolor: '#2196F320',
                  color: '#2196F3',
                  height: 20,
                  fontSize: '0.7rem'
                }}
              />
            )}
          </Box>
          <IconButton size="small" sx={{ color: 'white' }}>
            {expandedSections.has('downloads') ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={expandedSections.has('downloads')}>
          <List dense sx={{ p: 0 }}>
            {downloads.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)', fontStyle: 'italic' }}>
                      Ingen nedlastinger ennå
                    </Typography>
                  }
                />
              </ListItem>
            ) : (
              downloads.map((activity) => (
                <ListItem 
                  key={activity.id}
                  sx={{ 
                    px: 2,
                    py: 1,
                    borderBottom: '1px solid rgba(2, 5, 5,255,255,0.05)','&:hover': {
                      bgcolor: 'rgba(33, 150, 243, 0.1)',
                      cursor: 'pointer'
                    }
                  }}
                  onClick={() => onActivityClick?.(activity)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      bgcolor: '#2196F330',
                      color: '#2196F3',
                      width: 32,
                      height: 32 }}>
                      <Download fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ color: 'white' }}>
                        {activity.clientName}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.6)' }}>
                          {activity.itemName}
                        </Typography>
                        {activity.count && activity.count > 1 && (
                          <Chip 
                            label={`+${activity.count - 1} flere`}
                            size="small"
                            sx={{ height: 16, fontSize: '0.65rem' }}
                          />
                        )}
                        <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)', ml: 'auto' }}>
                          {timeAgo(activity.timestamp)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Collapse>
      </Box>

      <Divider sx={{ borderColor: 'rgba(2, 5, 5,255,255,0.1)' }} />

      {/* SELECTIONS/FAVORITES Section */}
      <Box>
        <Box 
          sx={{ 
            p: 1.5, 
            bgcolor: 'rgba(2, 5, 5,255,255,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'rgba(2, 5, 5,255,255,0.05)'
            }
          }}
          onClick={() => toggleSection('selections')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Favorite sx={{ color: '#FF4081', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight="600" sx={{ color: 'white' }}>
              Klientvalg
            </Typography>
            {selections.length > 0 && (
              <Chip 
                label={selections.length}
                size="small"
                sx={{ 
                  bgcolor: '#FF408120',
                  color: '#FF4081',
                  height: 20,
                  fontSize: '0.7rem'
                }}
              />
            )}
          </Box>
          <IconButton size="small" sx={{ color: 'white' }}>
            {expandedSections.has('selections') ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        <Collapse in={expandedSections.has('selections')}>
          <List dense sx={{ p: 0 }}>
            {selections.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary={
                    <Typography variant="body2" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)', fontStyle: 'italic' }}>
                      Ingen valg ennå
                    </Typography>
                  }
                />
              </ListItem>
            ) : (
              selections.map((activity) => (
                <ListItem 
                  key={activity.id}
                  sx={{ 
                    px: 2,
                    py: 1,
                    borderBottom: '1px solid rgba(2, 5, 5,255,255,0.05)', '&:hover': {
                      bgcolor: 'rgba(2, 5, 5, 64, 129, 0.1)',
                      cursor: 'pointer'
                    }
                  }}
                  onClick={() => onActivityClick?.(activity)}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ 
                      bgcolor: '#FF408130',
                      color: '#FF4081',
                      width: 32,
                      height: 32 }}>
                      {activity.rating ? <Star fontSize="small" /> : <Favorite fontSize="small" />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white' }}>
                          {activity.clientName}
                        </Typography>
                        {activity.rating && (
                          <Box sx={{ display: 'flex', gap: 0.25 }}>
                            {Array.from({ length: activity.rating }).map((_, i) => (
                              <Star key={i} sx={{ fontSize: 12, color: '#FFD700' }} />
                            ))}
                          </Box>
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.6)' }}>
                          {activity.count} elementer fra {activity.itemName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(2, 5, 5,255,255,0.5)', ml: 'auto' }}>
                          {timeAgo(activity.timestamp)}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))
            )}
          </List>
        </Collapse>
      </Box>

      {/* Enhanced Summary Footer */}
      <Box sx={{ 
        p: 3,
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AccessTime sx={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.4)' }} />
          <Typography variant="caption" sx={{ 
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '0.75rem'
          }}>
            Sist oppdatert: {new Date().toLocaleTimeString('nb-NO', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Typography>
        </Box>
        <Button 
          size="small"
          startIcon={<TrendingUp fontSize="small" />}
          sx={{ 
            color: accentColor,
            fontSize: '0.75rem',
            fontWeight: 700,
            px: 2,
            height: 32,
            bgcolor: `${accentColor}15`,
            border: `1px solid ${accentColor}40`,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              bgcolor: `${accentColor}25`,
              transform: 'translateY(-2px)',
              boxShadow: `0 4px 12px ${accentColor}40`
            }
          }}
          onClick={() => {
            // Refresh data - React Query will handle loading states
            window.location.reload();
          }}
        >
          Oppdater data
        </Button>
      </Box>

      {/* CSS Animation for pulse */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.8;
              transform: scale(0.98);
            }
          }
        `}
      </style>

      {/* Push Notification Settings Dialog */}
      {isSupported && (
        <Dialog 
          open={pushSettingsOpen} 
          onClose={() => setPushSettingsOpen(false)} 
          maxWidth="sm" 
          fullWidth
          PaperProps={{
            sx: {
              background: 'linear-gradient(135deg, rgba(15, 15, 35, 0.95) 0%, rgba(25, 25, 45, 0.9) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }
          }}
        >
          <DialogTitle sx={{ 
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'white',
            fontWeight: 700
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Notifications sx={{ color: accentColor }} />
              Push-varsler innstillinger
            </Box>
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <PushNotificationSettings userId={userId} showDescription={false} />
          </DialogContent>
          <DialogActions sx={{ 
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            p: 2
          }}>
            <Button 
              onClick={() => setPushSettingsOpen(false)}
              sx={{
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            >
              Lukk
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default ClientActivityPanel;

