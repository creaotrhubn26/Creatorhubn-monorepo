/**
 * Intelligent Chat Widget with response suggestions.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Fade,
  IconButton,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {
  AttachMoney as AttachMoneyIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Info as InfoIcon,
  Psychology as PsychologyIcon,
  Schedule as ScheduleIcon,
  Send as SendIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'customer' | 'professional';
  timestamp: Date;
  leadId?: string;
}

interface ResponseSuggestion {
  id: string;
  content: string;
  tone: 'professional' | 'friendly' | 'detailed' | 'concise';
  confidence: number;
  category: 'pricing' | 'availability' | 'service' | 'technical' | 'general';
  estimatedPrice?: number;
  includesFollowUp: boolean;
}

interface AnalyzeResponse {
  suggestions?: ResponseSuggestion[];
}

interface QuickResponse {
  id?: string;
  text: string;
}

interface IntelligentChatWidgetProps {
  conversationId: string;
  leadId?: string;
  onSendMessage: (message: string) => void;
  messages: ChatMessage[];
  isCustomerTyping?: boolean;
}

export const IntelligentChatWidget: React.FC<IntelligentChatWidgetProps> = ({
  conversationId,
  leadId,
  onSendMessage,
  messages,
  isCustomerTyping = false,
}) => {
  const theming = useTheming('photographer');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [currentMessage, setCurrentMessage] = useState('');
  const [suggestions, setSuggestions] = useState<ResponseSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ResponseSuggestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  const analyzeMessageMutation = useMutation({
    mutationFn: async (message: ChatMessage) => {
      const response = await apiRequest('/api/chat/analyze-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          leadId,
          conversationId,
          conversationHistory: messages.slice(-8),
        }),
      });
      return response as AnalyzeResponse;
    },
    onSuccess: (response) => {
      const suggestionList = response.suggestions ?? [];
      setSuggestions(suggestionList);
      setShowSuggestions(suggestionList.length > 0);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (payload: {
      messageId: string;
      suggestionId: string;
      action: 'used' | 'modified' | 'dismissed';
      effectiveness?: number;
    }) => {
      return apiRequest('/api/chat/response-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, conversationId, leadId }),
      });
    },
  });

  const { data: quickResponses = [] } = useQuery({
    queryKey: ['quick-responses', conversationId],
    queryFn: async () => {
      const response = await apiRequest('/api/chat/quick-responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'general', conversationId, leadId }),
      });

      if (Array.isArray(response)) {
        return response as QuickResponse[];
      }

      if (Array.isArray(response?.responses)) {
        return response.responses as QuickResponse[];
      }

      return [] as QuickResponse[];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const lastCustomerMessage = useMemo(() => {
    const latest = [...messages].reverse().find((message) => message.sender === 'customer');
    return latest;
  }, [messages]);

  useEffect(() => {
    if (!lastCustomerMessage) {
      return;
    }
    analyzeMessageMutation.mutate(lastCustomerMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCustomerMessage?.id]);

  const handleSendMessage = () => {
    const trimmed = currentMessage.trim();
    if (!trimmed) {
      return;
    }

    onSendMessage(trimmed);
    setCurrentMessage('');
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleUseSuggestion = (suggestion: ResponseSuggestion) => {
    setCurrentMessage(suggestion.content);
    setSelectedSuggestion(suggestion);
    setShowSuggestions(false);

    if (lastCustomerMessage) {
      feedbackMutation.mutate({
        messageId: lastCustomerMessage.id,
        suggestionId: suggestion.id,
        action: 'used',
      });
    }
  };

  const handleEditSuggestion = (suggestion: ResponseSuggestion) => {
    setSelectedSuggestion(suggestion);
    setEditedContent(suggestion.content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editedContent.trim();
    if (!trimmed) {
      return;
    }

    setCurrentMessage(trimmed);
    setIsEditing(false);

    if (selectedSuggestion && lastCustomerMessage) {
      feedbackMutation.mutate({
        messageId: lastCustomerMessage.id,
        suggestionId: selectedSuggestion.id,
        action: 'modified',
      });
    }
  };

  const getCategoryIcon = (category: ResponseSuggestion['category']) => {
    switch (category) {
      case 'pricing':
        return <AttachMoneyIcon fontSize="small" />;
      case 'availability':
        return <ScheduleIcon fontSize="small" />;
      case 'technical':
        return <PsychologyIcon fontSize="small" />;
      case 'service':
        return <InfoIcon fontSize="small" />;
      default:
        return <SmartToyIcon fontSize="small" />;
    }
  };

  const getCategoryColor = (
    category: ResponseSuggestion['category'],
  ): 'default' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' => {
    switch (category) {
      case 'pricing':
        return 'success';
      case 'availability':
        return 'primary';
      case 'technical':
        return 'secondary';
      case 'service':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, borderRadius: 1, bgcolor: 'background.default' }}>
        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              mb: 1.5,
              display: 'flex',
              justifyContent: message.sender === 'professional' ? 'flex-end' : 'flex-start',
            }}
          >
            <Paper
              sx={{
                p: 1.5,
                maxWidth: '70%',
                bgcolor: message.sender === 'professional' ? 'primary.main' : 'grey.100',
                color: message.sender === 'professional' ? 'primary.contrastText' : 'text.primary',
                ...theming.getThemedCardSx(),
              }}
            >
              <Typography variant="body2">{message.content}</Typography>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.25, opacity: 0.72 }}>
                {new Date(message.timestamp).toLocaleTimeString('no-NO', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </Paper>
          </Box>
        ))}

        {isCustomerTyping && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1.5 }}>
            <Paper sx={{ p: 1.5, ...theming.getThemedCardSx() }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={14} />
                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                  Kunden skriver...
                </Typography>
              </Box>
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Fade in={showSuggestions && suggestions.length > 0} mountOnEnter unmountOnExit>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <SmartToyIcon color="primary" fontSize="small" />
            Foreslåtte svar
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {suggestions.slice(0, 3).map((suggestion) => (
              <Card key={suggestion.id} variant="outlined" sx={{ ...theming.getThemedCardSx() }}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 }, ...theming.getThemedCardSx() }}>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                    <Chip
                      size="small"
                      icon={getCategoryIcon(suggestion.category)}
                      label={suggestion.category}
                      color={getCategoryColor(suggestion.category)}
                      variant="outlined"
                    />
                    <Chip size="small" label={`${Math.round(suggestion.confidence * 100)}%`} variant="outlined" />
                    {typeof suggestion.estimatedPrice === 'number' && (
                      <Chip
                        size="small"
                        label={`${suggestion.estimatedPrice.toLocaleString('no-NO')} kr`}
                        color="success"
                        variant="outlined"
                      />
                    )}
                    <Chip size="small" label={suggestion.tone} variant="outlined" />
                  </Box>

                  <Typography variant="body2" sx={{ mb: 1.25 }}>
                    {suggestion.content}
                  </Typography>

                  <ButtonGroup size="small">
                    <Button onClick={() => handleUseSuggestion(suggestion)} startIcon={<SendIcon fontSize="small" />}>
                      Bruk
                    </Button>
                    <Button onClick={() => handleEditSuggestion(suggestion)} startIcon={<EditIcon fontSize="small" />}>
                      Rediger
                    </Button>
                  </ButtonGroup>
                </CardContent>
              </Card>
            ))}
          </Box>

          <Button size="small" sx={{ mt: 1 }} onClick={() => setShowSuggestions(false)} startIcon={<CloseIcon />}>
            Skjul forslag
          </Button>
        </Box>
      </Fade>

      {isEditing && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Rediger foreslått svar
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={editedContent}
            onChange={(event) => setEditedContent(event.target.value)}
            sx={{ mb: 1.25 }}
          />
          <ButtonGroup size="small">
            <Button onClick={handleSaveEdit}>Lagre</Button>
            <Button onClick={() => setIsEditing(false)}>Avbryt</Button>
          </ButtonGroup>
        </Box>
      )}

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={currentMessage}
            onChange={(event) => setCurrentMessage(event.target.value)}
            placeholder="Skriv ditt svar..."
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <IconButton
            color="primary"
            onClick={handleSendMessage}
            disabled={!currentMessage.trim()}
            aria-label="Send message"
          >
            <SendIcon />
          </IconButton>
        </Box>

        {!currentMessage.trim() && quickResponses.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {quickResponses.slice(0, 4).map((response, index) => (
              <Button
                key={response.id ?? `quick-${index}`}
                size="small"
                variant="outlined"
                onClick={() => setCurrentMessage(response.text)}
              >
                {response.text}
              </Button>
            ))}
          </Box>
        )}
      </Box>

      {analyzeMessageMutation.isPending && (
        <Alert severity="info" sx={{ m: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} />
            Analyserer melding for forslag...
          </Box>
        </Alert>
      )}
    </Box>
  );
};
