/**
 * Vendor Messaging Component
 * Customer-vendor communication using chat infrastructure
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TextField,
  IconButton,
  Badge,
  Chip,
  Paper,
  Divider,
  Button,
  alpha
} from '@mui/material';
import {
  Send,
  ShoppingCart,
  Person
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getVendorTypeConfig } from '@shared/vendor-type-registry';

interface VendorMessagingProps {
  vendorType: string;
  vendorName: string;
  userId: string;
}

export default function VendorMessaging({
  vendorType,
  vendorName,
  userId
}: VendorMessagingProps) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  
  const vendorConfig = getVendorTypeConfig(vendorType);

  // Fetch conversations
  const { data: conversationsData } = useQuery({
    queryKey: ['/api/vendor-communication/conversations', vendorType, vendorName, userId],
    queryFn: () => apiRequest(`/api/vendor-communication/conversations/${vendorType}/${vendorName}/${userId}`),
    refetchInterval: 5000 // Poll every 5 seconds
  });

  // Fetch messages for selected conversation
  const { data: messagesData } = useQuery({
    queryKey: ['/api/vendor-communication/messages', selectedConversation],
    queryFn: () => apiRequest(`/api/vendor-communication/messages/${selectedConversation}`),
    enabled: !!selectedConversation,
    refetchInterval: 3000 // Poll every 3 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest('/api/vendor-communication/send-message', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: selectedConversation,
          content,
          messageType: 'text'
        }),
        headers: { 'Content-Type': 'application/json' }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendor-communication/messages'] });
      setMessageText('');
    }
  });

  const handleSendMessage = () => {
    if (messageText.trim() && selectedConversation) {
      sendMessageMutation.mutate(messageText);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesData]);

  const conversations = conversationsData?.conversations || [];
  const messages = messagesData?.messages || [];

  return (
    <Box component="main" role="main" aria-label="Meldinger" sx={{ height: '600px' }}>
      <Grid container sx={{ height: '100%' }}>
        {/* Conversations List */}
        <Grid item xs={12} md={4} sx={{ borderRight: 1, borderColor: 'divider', height: '100%', overflow: 'auto' }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              Meldinger
            </Typography>
          </Box>
          
          <List sx={{ p: 0 }}>
            {conversations.map((conv: any) => (
              <ListItemButton
                key={conv.id}
                selected={selectedConversation === conv.id}
                onClick={() => setSelectedConversation(conv.id)}
                sx={{
                  borderBottom: 1,
                  borderColor: 'divider',
                  '&.Mui-selected': {
                    bgcolor: alpha(vendorConfig?.color || '#2196f3', 0.1)
                  }
                }}
              >
                <ListItemAvatar>
                  <Badge badgeContent={conv.unread_count || 0} color="error">
                    <Avatar sx={{ bgcolor: vendorConfig?.color }} aria-hidden="true">
                      {conv.conversation_type === 'vendor_order' ? (
                        <ShoppingCart aria-hidden="true" />
                      ) : (
                        <Person aria-hidden="true" />
                      )}
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={conv.title || 'Samtale'}
                  secondary={conv.last_message || 'Ingen meldinger ennå'}
                  primaryTypographyProps={{ fontWeight: conv.unread_count > 0 ? 600 : 400 }}
                />
                <Chip
                  label={conv.conversation_type === 'vendor_order' ? 'Ordre' : 'Forespørsel'}
                  size="small"
                  sx={{ ml: 1 }}
                />
              </ListItemButton>
            ))}
            
            {conversations.length === 0 && (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Ingen meldinger ennå
                </Typography>
              </Box>
            )}
          </List>
        </Grid>

        {/* Messages Area */}
        <Grid item xs={12} md={8} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {selectedConversation ? (
            <>
              {/* Messages List */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <AnimatePresence>
                  {messages.map((message: any, index: number) => {
                    const isVendor = message.sender_id === userId;
                    
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: isVendor ? 'flex-end' : 'flex-start',
                            mb: 2
                          }}
                        >
                          <Paper
                            sx={{
                              p: 2,
                              maxWidth: '70%',
                              bgcolor: isVendor ? vendorConfig?.color : 'grey.100',
                              color: isVendor ? 'white' : 'text.primary'
                            }}
                          >
                            <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 0.5 }}>
                              {message.sender_name}
                            </Typography>
                            <Typography variant="body2">
                              {message.content}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mt: 0.5 }}>
                              {new Date(message.created_at).toLocaleString('nb-NO')}
                            </Typography>
                          </Paper>
                        </Box>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </Box>

              {/* Message Input */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    placeholder="Skriv melding..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    multiline
                    maxRows={3}
                    aria-label="Meldingstekst"
                  />
                  <IconButton
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                    aria-label="Send melding"
                    sx={{
                      bgcolor: vendorConfig?.color,
                      color: 'white',
                      minWidth: 48,
                      minHeight: 48,
                      '&:hover': { bgcolor: vendorConfig?.color, opacity: 0.9 },
                      '&:disabled': { bgcolor: 'grey.300' },
                      '&:focus-visible': {
                        outline: `3px solid ${vendorConfig?.color}`,
                        outlineOffset: '2px'
                      }
                    }}
                  >
                    <Send aria-hidden="true" />
                  </IconButton>
                </Box>
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Velg en samtale for å begynne
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}


