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
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { HelpOutline, AccessTime, CheckCircle } from '@mui/icons-material';
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
    if (hoursWaiting > 48) return '#ef4444'; // red
    if (hoursWaiting > 24) return '#f59e0b'; // amber
    return '#3b82f6'; // blue
  };

  const getUrgencyBgColor = (hoursWaiting: number) => {
    if (hoursWaiting > 48) return 'rgba(239, 68, 68, 0.2)';
    if (hoursWaiting > 24) return 'rgba(245, 158, 11, 0.2)';
    return 'rgba(59, 130, 246, 0.2)';
  };

  if (loading) {
    return (
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5, md: 3 },
          background: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', py: { xs: 3, sm: 4, md: 5 } }}>
          <CircularProgress sx={{ color: '#f59e0b' }} size={isMobile ? 28 : 32} />
        </Box>
      </Paper>
    );
  }

  if (questions.length === 0) {
    return (
      <Paper
        sx={{
          p: { xs: 2, sm: 2.5, md: 3 },
          background: 'rgba(26, 26, 46, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, sm: 1.5 },
            mb: 2,
          }}
        >
          <Box
            sx={{
              p: 1,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.1) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HelpOutline sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 24, md: 28 } }} />
          </Box>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#fff',
              fontWeight: 700,
              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
            }}
          >
            Spørsmål som trenger hjelp
          </Typography>
        </Box>
        <Paper
          sx={{
            p: { xs: 1.5, sm: 2 },
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            mt: 1,
          }}
        >
          <Alert
            severity="success"
            icon={false}
            sx={{
              bgcolor: 'transparent',
              p: 0,
              '& .MuiAlert-message': {
                color: 'rgba(255, 255, 255, 0.9)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle sx={{ fontSize: { xs: 20, sm: 22, md: 24 }, color: '#10b981', mr: 0.5 }} />
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                }}
              >
                Alle spørsmål har fått svar!
              </Typography>
            </Box>
          </Alert>
        </Paper>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5, md: 3 },
        background: 'rgba(26, 26, 46, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: { xs: 2, sm: 2.5 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
          <Box
            sx={{
              p: 1,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(234, 88, 12, 0.1) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HelpOutline sx={{ color: '#f59e0b', fontSize: { xs: 20, sm: 24, md: 28 } }} />
          </Box>
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                color: '#fff',
                fontWeight: 700,
                fontSize: { xs: '0.95rem', sm: '1rem', md: '1.1rem' },
                mb: 0.25,
              }}
            >
              Spørsmål som trenger hjelp
            </Typography>
            <Chip
              label={questions.length}
              size="small"
              sx={{
                bgcolor: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                height: { xs: '20px', sm: '22px', md: '24px' },
                fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.8rem' },
                fontWeight: 600,
              }}
            />
          </Box>
        </Box>
      </Box>

      <Typography
        variant="caption"
        sx={{
          color: 'rgba(255, 255, 255, 0.7)',
          mb: { xs: 2, sm: 2.5 },
          display: 'block',
          fontSize: { xs: '0.8rem', sm: '0.85rem', md: '0.9rem' },
        }}
      >
        Hjelp andre medlemmer ved å svare på deres spørsmål
      </Typography>

      <List sx={{ '& .MuiListItem-root': { mb: { xs: 1, sm: 1.5 }, px: 0 } }}>
        {questions.slice(0, 5).map((question) => (
          <ListItem key={question.id} disablePadding>
            <ListItemButton
              onClick={() => onSelectQuestion(question.id, question.channel_name)}
              sx={{
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '12px',
                background: 'rgba(26, 26, 46, 0.6)',
                p: { xs: 1.5, sm: 2 },
                minHeight: { xs: '64px', sm: '72px', md: '80px' },
                transition: 'all 0.2s ease',
                '&:hover': {
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  transform: 'translateX(4px)',
                },
              }}
            >
              <ListItemAvatar>
                <Avatar
                  src={question.user_avatar}
                  sx={{
                    width: { xs: 40, sm: 44, md: 48 },
                    height: { xs: 40, sm: 44, md: 48 },
                    border: '2px solid rgba(245, 158, 11, 0.3)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  {question.user_name?.[0]}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#fff',
                      fontWeight: 500,
                      fontSize: { xs: '0.875rem', sm: '0.9rem', md: '0.95rem' },
                      mb: 0.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.4,
                    }}
                  >
                    {question.content.length > 80
                      ? `${question.content.substring(0, 80)}...`
                      : question.content}
                  </Typography>
                }
                secondary={
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: { xs: 0.75, sm: 1 },
                      mt: 0.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: { xs: '0.75rem', sm: '0.8rem', md: '0.85rem' },
                      }}
                    >
                      {question.user_name} • #{question.channel_name}
                    </Typography>
                    <Chip
                      icon={
                        <AccessTime
                          sx={{
                            fontSize: { xs: 12, sm: 13, md: 14 },
                            color: getUrgencyColor(question.hours_waiting),
                          }}
                        />
                      }
                      label={formatDistanceToNow(new Date(question.created_at), {
                        addSuffix: true,
                        locale: nb,
                      })}
                      size="small"
                      sx={{
                        height: { xs: '20px', sm: '22px', md: '24px' },
                        fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
                        bgcolor: getUrgencyBgColor(question.hours_waiting),
                        color: getUrgencyColor(question.hours_waiting),
                        border: `1px solid ${getUrgencyColor(question.hours_waiting)}40`,
                        fontWeight: 600,
                      }}
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

