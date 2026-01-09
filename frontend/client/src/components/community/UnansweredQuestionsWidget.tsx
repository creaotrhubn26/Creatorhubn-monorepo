/**
 * CreatorHub Norge Community - Unanswered Questions Widget
 * 
 * Shows questions that need help (no replies yet)
 * Solves: "No one replies to me" problem
 */

import React, { useState, useEffect } from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { HelpOutline, AccessTime } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { nb } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';

interface UnansweredQuestion {
  id: string;
  content: string;
  user_name: string;
  user_avatar?: string;
  channel_name: string;
  created_at: string;
  hours_waiting: number;
}

interface UnansweredQuestionsWidgetProps {
  channelId?: string;
  onSelectQuestion: (questionId: string, channelId: string) => void;
}

export default function UnansweredQuestionsWidget({
  channelId,
  onSelectQuestion,
}: UnansweredQuestionsWidgetProps) {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnansweredQuestions();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchUnansweredQuestions, 120000);
    return () => clearInterval(interval);
  }, [channelId]);

  const fetchUnansweredQuestions = async () => {
    try {
      setLoading(true);
      const params = channelId ? `?channelId=${channelId}` : '';
      const response = await apiRequest(`/api/community/unanswered${params}`);
      setQuestions(response.unanswered || []);
    } catch (error) {
      console.error('Error fetching unanswered questions: ', error);
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (hoursWaiting: number) => {
    if (hoursWaiting > 48) return 'error';
    if (hoursWaiting > 24) return 'warning';
    return 'info';
  };

  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={30} />
        </Box>
      </Paper>
    );
  }

  if (questions.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutline fontSize="small" />
          Spørsmål som trenger hjelp
        </Typography>
        <Alert severity="success" sx={{ mt: 1 }}>
          🎉 Alle spørsmål har fått svar!
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HelpOutline fontSize="small" />
        Spørsmål som trenger hjelp ({questions.length})
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Hjelp andre medlemmer ved å svare på deres spørsmål
      </Typography>
      <List dense>
        {questions.slice(0, 5).map((question) => (
          <ListItem
            key={question.id}
            disablePadding
            sx={{ mb: 1 }}
          >
            <ListItemButton
              onClick={() => onSelectQuestion(question.id, question.channel_name)}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1, '&:hover': { bgcolor: 'action.hover' }}}
            >
              <ListItemAvatar>
                <Avatar src={question.user_avatar} sx={{ width: 32, height: 32 }}>
                  {question.user_name?.[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body2" noWrap>
                    {question.content.substring(0, 60)}...
                  </Typography>
                }
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {question.user_name} • #{question.channel_name}
                    </Typography>
                    <Chip
                      icon={<AccessTime sx={{ fontSize: 12 }} />}
                      label={formatDistanceToNow(new Date(question.created_at), {
                        addSuffix: true,
                        locale: nb,
                      })}
                      size="small"
                      color={getUrgencyColor(question.hours_waiting)}
                      sx={{ height: 18, fontSize:'0.65rem' }}
                    />
                  </Box>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}

