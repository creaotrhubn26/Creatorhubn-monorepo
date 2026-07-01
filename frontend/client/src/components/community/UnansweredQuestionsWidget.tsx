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
      setQuestions(response.unanswered || response.messages || []);
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

  const panelSx = {
    p: 2,
    borderRadius: 4,
    background:
      'linear-gradient(180deg, rgba(13, 18, 27, 0.94), rgba(8, 12, 18, 0.94))',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.36)',
    color: 'rgba(255, 255, 255, 0.92)',
  } as const;

  const titleSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    color: 'rgba(255, 255, 255, 0.92)',
    fontWeight: 700,
  } as const;

  if (loading) {
    return (
      <Paper sx={panelSx}>
        <Typography variant="subtitle2" gutterBottom sx={titleSx}>
          <HelpOutline fontSize="small" sx={{ color: '#ff8c00' }} />
          Spørsmål som trenger hjelp
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={30} sx={{ color: '#ff8c00' }} />
        </Box>
      </Paper>
    );
  }

  if (questions.length === 0) {
    return (
      <Paper sx={panelSx}>
        <Typography variant="subtitle2" gutterBottom sx={titleSx}>
          <HelpOutline fontSize="small" sx={{ color: '#ff8c00' }} />
          Spørsmål som trenger hjelp
        </Typography>
        <Alert
          severity="success"
          sx={{
            mt: 1,
            borderRadius: 3,
            bgcolor: 'rgba(84, 181, 125, 0.14)',
            color: '#d8f8e4',
            border: '1px solid rgba(84, 181, 125, 0.2)',
            '& .MuiAlert-icon': {
              color: '#78df9c',
            },
          }}
        >
          🎉 Alle spørsmål har fått svar!
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={panelSx}>
      <Typography variant="subtitle2" gutterBottom sx={titleSx}>
        <HelpOutline fontSize="small" sx={{ color: '#ff8c00' }} />
        Spørsmål som trenger hjelp ({questions.length})
      </Typography>
      <Typography
        variant="caption"
        sx={{ mb: 2, display: 'block', color: 'rgba(255, 255, 255, 0.64)' }}
      >
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
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 2.5,
                background: 'rgba(255,255,255,0.03)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
            
              <ListItemAvatar>
                <Avatar
                  src={question.user_avatar}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: 'rgba(255, 140, 0, 0.18)',
                    color: '#ff8c00',
                    border: '1px solid rgba(255, 140, 0, 0.18)',
                  }}
                >
                  {question.user_name?.[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography variant="body2" noWrap sx={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    {question.content.substring(0, 60)}...
                  </Typography>
                }
                secondary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
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
