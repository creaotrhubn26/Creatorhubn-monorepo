/**
 * AI JOURNEY CHAT DIALOG
 * Conversational AI for generating and refining customer journeys
 *
 * Features: * - Chat with Claude to design custom journeys
 * - Iterate and refine stages
 * - Ask questions about personas
 * - Generate multiple variations
 * - Save and compare journeys
 */

import React, { useState, useRef, useEffect } from 'react';
import { logger } from '../core/services/logger';

const log = logger.module('AIJourneyChat, ');
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  Avatar,
  Paper,
  Stack,
  Chip,
  IconButton,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
} from '@mui/material';
import {
  Psychology,
  Send,
  Close,
  Person,
  SmartToy,
  AutoAwesome,
  CheckCircle,
  ContentCopy,
  Refresh,
} from '@mui/icons-material';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface JourneyPreview {
  name: string;
  role: string;
  stages: number;
  preview: string;
}

interface AIJourneyChatDialogProps {
  open: boolean;
  onClose: () => void;
  onJourneyGenerated: (journey: unknown) => void;
}

export default function AIJourneyChatDialog({
  open,
  onClose,
  onJourneyGenerated,
}: AIJourneyChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hi! I\'m your AI journey designer powered by Claude 4.5 Sonnet. 🤖\n\nI\'ll help you create custom customer journeys for CreatorHub Virtual Studio. Just tell me:\n\n1. **Who** is your persona? (name, role, industry)\n2. **What** are their goals?\n3. **What** problems do they face?\n\nOr simply say something like:\n- "Create a journey for a wedding photographer"\n-"I need a journey for a real estate videographer"\n-"Generate a persona for someone doing product photography"\n\nWhat would you like to create?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [journeyPreviews, setJourneyPreviews] = useState<JourneyPreview[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth,' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  /**
   * Send message to Claude AI
   */
  const handleSendMessage = async () => {
    if (!input.trim() || generating) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput(', ');
    setGenerating(true);

    try {
      // Build conversation context
      const conversationContext = conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // System prompt for journey generation
      const systemPrompt = `You are a customer journey expert helping to design personalized journeys for CreatorHub Virtual Studio users.

**Your Role:**
- Help users design custom customer journey personas
- Ask clarifying questions to understand their needs
- Generate detailed 5-stage journeys when ready
- Iterate and refine based on feedback

**CreatorHub Virtual Studio Context:**
- 3D virtual photography/videography platform
- Real-time lighting simulation
- 627 professional LUTs
- Camera angle preview
- GPU-accelerated rendering
- AI-powered tools
- Virtual studio environments

**Journey Structure:**
Each journey should have 5 stages:
1. Pre-production/Planning
2. Scene Setup/Composition
3. Lighting/Technical Setup
4. Execution/Capture
5. Post-production/Delivery

**When to Generate JSON:**
Only output JSON when the user explicitly requests generation or you have enough information. Otherwise, have a natural conversation.

**JSON Format (when generating):**
\`\`\`json
{
  "name":"Persona Name","role":"Their Role","avatar" : "emoji","goals": ["goal1","goal2","goal3","goal4"]"painPoints": ["pain1","pain2","pain3","pain4"]"journey": [
    {
      "title":"Stage Name","problem":"Specific problem","solution":"How Virtual Studio solves it","features": ["feature1","feature2","feature3","feature4"]"benefits": ["benefit1","benefit2","benefit3","benefit4"]"timeEstimate":"X mins vs Y hours traditional","icon" : "EmojiObjects"
    }
  ]
}
\`\`\`

Be conversational, helpful, and ask follow-up questions to create the best journey.`;

      // Call Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages, ', {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json','x-api-key':
            import.meta.env.VITE_ANTHROPIC_API_KEY ||
            import.meta.env.REACT_APP_ANTHROPIC_API_KEY || ', ','anthropic-version' : '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [...conversationContext, { role: 'user', content: input }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data.content[0].text;

      // Check if response contains JSON journey
      const jsonMatch =
        assistantResponse.match(/```json\s*([\s\S]*?)```/) ||
        assistantResponse.match(/```\s*([\s\S]*?)```/);

      if (jsonMatch) {
        // Journey generated!
        const cleanJson = jsonMatch[1];
        try {
          const journeyData = JSON.parse(cleanJson);

          // Add preview
          setJourneyPreviews((prev) => [
            ...prev,
            {
              name: journeyData.name,
              role: journeyData.role,
              stages: journeyData.journey?.length || 0,
              preview: `${journeyData.goals?.length || 0} goals, ${journeyData.painPoints?.length || 0} pain points`,
            },
          ]);

          // Show confirmation message
          const confirmMessage: Message = {
            role: 'assistant',
            content: `✅ **Journey Created!**\n\n**${journeyData.name}** - ${journeyData.role}\n\nI've generated a ${journeyData.journey?.length || 5}-stage journey. You can:\n- **Use this journey** - Click "Use This Journey" below\n- **Refine it** - Tell me what to change\n- **Start over** - Create a different persona\n\nWhat would you like to do?`,
            timestamp: new Date(),
          };

          setMessages((prev) => [...prev, confirmMessage]);

          // Store journey for later use
          (window as any).lastGeneratedJourney = journeyData;
        } catch (error) {
          log.error('Failed to parse journey JSON: ', error);
          const errorMessage: Message = {
            role: 'assistant',
            content: `I generated a journey but had trouble formatting it. Let me try again. ${assistantResponse}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, errorMessage]);
        }
      } else {
        // Regular conversation
        const assistantMessage: Message = {
          role: 'assistant',
          content: assistantResponse,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Update conversation history
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: input },
        { role: 'assistant', content: assistantResponse },
      ]);
    } catch (error) {
      log.error('AI chat failed:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Use the last generated journey
   */
  const handleUseJourney = () => {
    const journey = (window as any).lastGeneratedJourney;
    if (journey) {
      // Convert icon strings to React components
      const iconMap: Record<string, React.ReactNode> = {
        EmojiObjects: <AutoAwesome />,
        ThreeDRotation: <AutoAwesome />,
        Palette: <AutoAwesome />,
        Share: <AutoAwesome />,
        AutoAwesome: <AutoAwesome />,
        Videocam: <AutoAwesome />,
        CameraAlt: <AutoAwesome />,
      };

      journey.journey = journey.journey.map((stage: unknown) => ({
        ...stage,
        icon: iconMap[stage.icon] || <AutoAwesome />,
      }));

      onJourneyGenerated(journey);
      handleClose();
    }
  };

  /**
   * Quick start prompts
   */
  const quickStarts = [
    'Create a journey for a wedding photographer','Generate a real estate videographer persona','I need a journey for product photography','Create a journey for a social media content creator',
  ];

  /**
   * Reset conversation
   */
  const handleReset = () => {
    setMessages([messages[0]]); // Keep initial greeting
    setConversationHistory([]);
    setJourneyPreviews([]);
    setInput('');
    delete (window as any).lastGeneratedJourney;
  };

  /**
   * Close dialog
   */
  const handleClose = () => {
    onClose();
    // Don't reset on close - keep conversation
  };

  /**
   * Handle Enter key
   */
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Psychology sx={{ color: '#8B5CF6' }} />
            <Typography variant="h6">AI Journey Designer</Typography>
            <Chip label="Claude 4.5 Sonnet" size="small" />
          </Box>
          <Box>
            <IconButton onClick={handleReset} size="small" title="Start over">
              <Refresh />
            </IconButton>
            <IconButton onClick={handleClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ height: '60vh', display: 'flex', flexDirection: 'column', p: 0 }}>
        {/* Messages */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          <Stack spacing={2}>
            {messages.map((message, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  gap: 2,
                  alignItems: 'flex-start',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'}}
              >
                {message.role === 'assistant' && (
                  <Avatar sx={{ bgcolor: '#8B5CF6', width: 36, height: 36 }}>
                    <SmartToy />
                  </Avatar>
                )}

                <Paper
                  sx={{
                    p: 2,
                    maxWidth: '75%',
                    bgcolor: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                    borderRadius: 2}}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      whiteSpace: 'pre-wrap','& strong': { fontWeight: 700}}}
                  >
                    {message.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 1, display: 'block' }}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </Typography>
                </Paper>

                {message.role === 'user' && (
                  <Avatar sx={{ bgcolor: '#2196f3', width: 36, height: 36 }}>
                    <Person />
                  </Avatar>
                )}
              </Box>
            ))}

            {generating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: '#8B5CF6', width: 36, height: 36 }}>
                  <SmartToy />
                </Avatar>
                <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Claude is thinking...
                    </Typography>
                  </Box>
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Stack>
        </Box>

        <Divider />

        {/* Quick Start Buttons */}
        {messages.length === 1 && (
          <Box sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Quick starts:{', '}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {quickStarts.map((prompt, index) => (
                <Chip
                  key={index}
                  label={prompt}
                  size="small"
                  onClick={() => {
                    setInput(prompt);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Journey Previews */}
        {journeyPreviews.length > 0 && (
          <Box sx={{ p: 2, bgcolor: '#f0f4ff' }}>
            <Typography variant="caption" fontWeight={600} gutterBottom>
              Generated Journeys ({journeyPreviews.length}):{''}
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              {journeyPreviews.map((preview, index) => (
                <Card key={index} sx={{ bgcolor: '#fff' }}>
                  <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'}}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {preview.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {preview.role} • {preview.stages} stages • {preview.preview}
                        </Typography>
                      </Box>
                      {index === journeyPreviews.length - 1 && (
                        <Chip label="Latest" size="small" color="primary" />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        {/* Input */}
        <Box sx={{ p: 2, bgcolor: '#fff', borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="Type your message... (Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={generating}
              inputRef={inputRef}
              size="small"
            />
            <IconButton
              color="primary"
              onClick={handleSendMessage}
              disabled={!input.trim() || generating}
              sx={{
                bgcolor: '#8B5CF6',
                color: '#fff', '&:hover': { bgcolor: '#7C3AED' }, '&:disabled': { bgcolor: '#ddd' }}}
            >
              <Send />
            </IconButton>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        {(window as any).lastGeneratedJourney && (
          <Button
            variant="contained"
            startIcon={<CheckCircle />}
            onClick={handleUseJourney}
            sx={{
              background: 'linear-gradient(135deg, #10b981, 0%, #059669, 100%)',
              color:'#fff'}}
          >
            Use This Journey
          </Button>
        )}
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
