// @ts-nocheck
/**
 * Community Integration Widgets
 * 
 * Ready-to-use widgets for integrating community features into other dashboards:
 * - TopFeatureRequestsWidget
 * - PendingQuestionsWidget  
 * - MentorAvailabilityWidget
 * - ProductRoadmapWidget
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Avatar,
  Button,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  ThumbUp,
  HelpOutline,
  Schedule,
  CheckCircle,
  Build,
  Lightbulb,
  School,
  ArrowForward,
  Refresh,
  OpenInNew,
  QuestionAnswer,
  AccessTime,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import type {
  VotingItem,
  MentorInfo,
  PendingQuestion} from '@/hooks/useCommunityIntegration';
import { 
  useVotingBoardIntegration, 
  useMentorIntegration
} from '@/hooks/useCommunityIntegration';

// ============================================
// TOP FEATURE REQUESTS WIDGET
// ============================================

interface TopFeatureRequestsWidgetProps {
  groupId?: string;
  limit?: number;
  onViewAll?: () => void;
  onItemClick?: (item: VotingItem) => void;
}

export function TopFeatureRequestsWidget({
  groupId,
  limit = 5,
  onViewAll,
  onItemClick,
}: TopFeatureRequestsWidgetProps) {
  const { topFeatureRequests, loading, fetchTopRequests } = useVotingBoardIntegration(groupId);

  useEffect(() => {
    fetchTopRequests(limit);
  }, [fetchTopRequests, limit]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'planned': return <Schedule fontSize="small" color="secondary" />;
      case 'in_progress': return <Build fontSize="small" color="warning" />;
      case 'completed': return <CheckCircle fontSize="small" color="success" />;
      default: return <Lightbulb fontSize="small" color="primary" />;
    }
  };

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUp color="primary" />
          Top Feature Requests
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={() => fetchTopRequests(limit)}>
              <Refresh />
            </IconButton>
          </Tooltip>
          {onViewAll && (
            <Tooltip title="View All">
              <IconButton size="small" onClick={onViewAll}>
                <OpenInNew />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : topFeatureRequests.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No feature requests yet
        </Typography>
      ) : (
        <List dense disablePadding>
          {topFeatureRequests.slice(0, limit).map((item, index) => (
            <ListItem
              key={item.id}
              sx={{ 
                cursor: onItemClick ? 'pointer' : 'default',
                borderRadius: 1 , '&:hover': onItemClick ? { bgcolor: 'action.hover' } : {}}}
              onClick={() => onItemClick?.(item)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Badge
                  badgeContent={index + 1}
                  color="primary"
                  sx={{ '& .MuiBadge-badge': { fontSize: 10 } }}
                >
                  {statusIcon(item.status)}
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={item.title}
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ThumbUp sx={{ fontSize: 12 }} />
                    <span>{item.score}</span>
                  </Box>
                }
                primaryTypographyProps={{ 
                  noWrap: true, 
                  fontSize: 14,
                  fontWeight: ndex < 3 ? 600 : 400}}
              />
              <ListItemSecondaryAction>
                <Chip
                  label={item.status.replace('_', ', ')}
                  size="small"
                  sx={{ fontSize: 10 }}
                />
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}

// ============================================
// PRODUCT ROADMAP WIDGET
// ============================================

interface ProductRoadmapWidgetProps {
  groupId?: string;
  onViewFull?: () => void;
}

export function ProductRoadmapWidget({ groupId, onViewFull }: ProductRoadmapWidgetProps) {
  const { plannedFeatures, loading, fetchTopRequests } = useVotingBoardIntegration(groupId);

  useEffect(() => {
    fetchTopRequests(50); // Fetch more to get planned items
  }, [fetchTopRequests]);

  const statusConfig: Record<string, { label: string; color: string; progress: number }> = {
    planned: { label: 'Planned', color: '#9c27b0', progress: 25 },
    in_progress: { label: 'In Progress', color: '#ff9800', progress: 60 },
    completed: { label: 'Completed', color: '#4caf50', progress: 100 },
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule color="secondary" />
          Product Roadmap
        </Typography>
        {onViewFull && (
          <Button size="small" endIcon={<ArrowForward />} onClick={onViewFull}>
            Full Roadmap
          </Button>
        )}
      </Box>

      {loading ? (
        <CircularProgress size={24} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {plannedFeatures.slice(0, 6).map((item) => {
            const config = statusConfig[item.status] || statusConfig.planned;
            return (
              <Box key={item.id}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, mr: 2 }}>
                    {item.title}
                  </Typography>
                  <Chip 
                    label={config.label} 
                    size="small" 
                    sx={{ bgcolor: config.color, color: 'white', fontSize: 10 }} 
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={config.progress} 
                  sx={{ 
                    height: 6, 
                    borderRadius: 3,
                    bgcolor: `${config.color}20`,
                    '& .MuiLinearProgress-bar': { bgcolor: config.color }
                  }}
                />
              </Box>
            );
          })}
        </Box>
      )}
    </Paper>
  );
}

// ============================================
// PENDING QUESTIONS WIDGET (FOR MENTORS)
// ============================================

interface PendingQuestionsWidgetProps {
  userId: string;
  groupId?: string;
  limit?: number;
  onQuestionClick?: (question: PendingQuestion) => void;
  onViewAll?: () => void;
}

export function PendingQuestionsWidget({
  userId,
  groupId,
  limit = 5,
  onQuestionClick,
  onViewAll,
}: PendingQuestionsWidgetProps) {
  const { pendingQuestions, isMentor, loading, fetchPendingQuestions } = useMentorIntegration(userId, groupId);

  useEffect(() => {
    if (isMentor) {
      fetchPendingQuestions();
    }
  }, [isMentor, fetchPendingQuestions]);

  if (!isMentor) {
    return null; // Only show for mentors
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={pendingQuestions.length} color="error">
            <QuestionAnswer color="primary" />
          </Badge>
          Pending Questions
        </Typography>
        {onViewAll && (
          <Button size="small" onClick={onViewAll}>
            View All
          </Button>
        )}
      </Box>

      {loading ? (
        <CircularProgress size={24} />
      ) : pendingQuestions.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No pending questions
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {pendingQuestions.slice(0, limit).map((question) => (
            <ListItem
              key={question.id}
              sx={{ 
                cursor: 'pointer',
                borderRadius: 1, '&:hover': { bgcolor: 'action.hover' },
                borderLeft: 3,
                borderColor: 'warning.main',
                mb: 1}}
              onClick={() => onQuestionClick?.(question)}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                  {question.userName?.[0]}
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={question.content.slice(0, 60) + '...'}
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Chip label={question.channelName} size="small" sx={{ fontSize: 10 }} />
                    <Typography variant="caption" color="text.secondary">
                      <AccessTime sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                      {question.waitTime}
                    </Typography>
                  </Box>
                }
                primaryTypographyProps={{ fontSize: 13 }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}

// ============================================
// MENTOR AVAILABILITY WIDGET
// ============================================

interface MentorAvailabilityWidgetProps {
  userId: string;
  groupId?: string;
  onRequestSession?: (mentor: MentorInfo) => void;
}

export function MentorAvailabilityWidget({
  userId,
  groupId,
  onRequestSession,
}: MentorAvailabilityWidgetProps) {
  const { mentors, loading, fetchMentors } = useMentorIntegration(userId, groupId);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const availableMentors = mentors.filter(m => m.isAvailable);

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <School color="secondary" />
          Available Mentors
        </Typography>
        <Chip 
          label={`${availableMentors.length} online`} 
          color="success" 
          size="small" 
        />
      </Box>

      {loading ? (
        <CircularProgress size={24} />
      ) : availableMentors.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          No mentors available right now
        </Typography>
      ) : (
        <List dense disablePadding>
          {availableMentors.slice(0, 5).map((mentor) => (
            <ListItem key={mentor.id} sx={{ px: 0 }}>
              <ListItemIcon sx={{ minWidth: 48 }}>
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: 'success.main',
                        border: '2px solid white'}}
                    />
                  }
                >
                  <Avatar src={mentor.avatar} sx={{ width: 36, height: 36 }}>
                    {mentor.name?.[0]}
                  </Avatar>
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={mentor.name}
                secondary={
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {mentor.topics.slice(0, 2).map((topic) => (
                      <Chip key={topic} label={topic} size="small" sx={{ fontSize: 10, height: 18 }} />
                    ))}
                  </Box>
                }
                primaryTypographyProps={{ fontSize: 14, fontWeight: 500}}
              />
              <ListItemSecondaryAction>
                {onRequestSession && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onRequestSession(mentor)}
                    sx={{ fontSize: 11 }}
                  >
                    Request
                  </Button>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}

// ============================================
// EXPORTS
// ============================================

export default {
  TopFeatureRequestsWidget,
  ProductRoadmapWidget,
  PendingQuestionsWidget,
  MentorAvailabilityWidget,
};

