// Instagram Direct-message inbox — the unified social inbox in the CRM.
// Customers/candidates who DM the connected IG Business account land here so
// the team can reply where the conversation started, alongside SMS/email.
// Inbound messages are fed by the Meta webhook; live Graph sync is best-effort
// (gated behind instagram_manage_messages until App Review approves it).
import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogTitle, DialogContent, Box, Stack, Typography, Chip, Button,
  List, ListItemButton, ListItemText, ListItemAvatar, Avatar, TextField,
  CircularProgress, Alert, Divider, Paper, IconButton, Select, MenuItem,
} from '@mui/material';
import { Instagram as InstagramIcon, Send as SendIcon, Close as CloseIcon } from '@mui/icons-material';
import { BrandScope } from './crm-brand';

interface Props { open: boolean; onClose: () => void; brandColor?: string; }

interface IgConnection {
  id: string;
  igUsername: string | null;
  igBusinessAccountId: string;
  facebookPageName: string | null;
  profilePictureUrl: string | null;
  hasMessagingScope: boolean;
}

interface IgConversation {
  id: string;
  participantIgsid: string;
  participantUsername: string | null;
  participantName: string | null;
  lastMessageAt: string | null;
  lastMessageSnippet: string | null;
  unreadCount: number;
}

interface IgMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  body: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  createdAt: string;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return ''; }
}

export default function IgDmInbox({ open, onClose, brandColor }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const [replyText, setReplyText] = useState('');

  // Connected IG accounts (account-picker).
  const { data: connData, isLoading: connLoading } = useQuery<{ connections: IgConnection[] }>({
    queryKey: ['ig-dm-connections'],
    enabled: open,
    queryFn: () => apiRequest('/api/role-room/instagram/messaging/connections'),
  });
  const connections = connData?.connections || [];

  // Auto-select first connection when opening.
  useEffect(() => {
    if (open && !connectionId && connections.length > 0) setConnectionId(connections[0].id);
  }, [open, connectionId, connections]);

  // Conversations for the selected account (DB-first; polls for new ones).
  const { data: convData, isLoading: convLoading } = useQuery<{
    conversations: IgConversation[]; totalUnread: number; syncError: string | null;
  }>({
    queryKey: ['ig-dm-conversations', connectionId],
    enabled: open && !!connectionId,
    // Only poll while the dialog is actually open — avoids a 60s background
    // request firing forever after the inbox is closed.
    refetchInterval: open ? 60_000 : false,
    queryFn: () => apiRequest(`/api/role-room/instagram/messaging/conversations?connectionId=${encodeURIComponent(connectionId)}`),
  });
  const conversations = convData?.conversations || [];

  // Messages of the selected conversation.
  const { data: msgData, isLoading: msgLoading } = useQuery<{
    messages: IgMessage[]; syncError: string | null;
  }>({
    queryKey: ['ig-dm-messages', conversationId],
    enabled: open && !!conversationId && !!connectionId,
    refetchInterval: open && conversationId ? 30_000 : false,
    queryFn: () => apiRequest(
      `/api/role-room/instagram/messaging/conversations/${encodeURIComponent(conversationId)}/messages?connectionId=${encodeURIComponent(connectionId)}`,
    ),
  });
  const messages = msgData?.messages || [];

  // Opening a thread marks it read server-side; reflect that in the list.
  useEffect(() => {
    if (msgData) queryClient.invalidateQueries({ queryKey: ['ig-dm-conversations', connectionId] });
  }, [msgData, connectionId, queryClient]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) || null,
    [conversations, conversationId],
  );

  const replyMutation = useMutation({
    mutationFn: async (text: string) => apiRequest(
      `/api/role-room/instagram/messaging/conversations/${encodeURIComponent(conversationId)}/reply`,
      { method: 'POST', body: JSON.stringify({ connectionId, text }) },
    ),
    onSuccess: () => {
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['ig-dm-messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['ig-dm-conversations', connectionId] });
      toast({ title: 'Svar sendt', variant: 'success' });
    },
    onError: (e: any) => toast({
      title: 'Kunne ikke sende',
      description: e?.message || 'Sjekk at instagram_manage_messages er godkjent og at 24-timersvinduet er åpent.',
      variant: 'destructive',
    }),
  });

  const displayName = (c: IgConversation) =>
    c.participantUsername ? `@${c.participantUsername}` : (c.participantName || c.participantIgsid);

  // True when an account is connected but WITHOUT instagram_manage_messages —
  // it must be re-authorized before the inbox can read/reply.
  const needsMessagingReauth =
    connections.length > 0 && connections.every((c) => !c.hasMessagingScope);

  // (Re)connect Instagram via OAuth — opens Meta's consent in a popup. Used
  // both for first connect and to re-authorize an account for messaging.
  const connectInstagram = async () => {
    try {
      const res = await apiRequest('/api/role-room/instagram/oauth/start');
      const url = (res as { url?: string })?.url;
      if (url) {
        window.open(url, 'ig-oauth', 'width=720,height=820,resizable=yes');
      } else {
        toast({ title: 'Kunne ikke starte Instagram-tilkobling', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Kunne ikke starte tilkobling', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <BrandScope brandColor={brandColor}>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-label="Instagram Direct-meldinger"
      PaperProps={{ sx: { height: { xs: '92dvh', sm: '80vh' }, m: { xs: 1, sm: 4 } } }}
    >
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <InstagramIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Instagram-innboks</Typography>
          {convData?.totalUnread ? <Chip size="small" color="error" label={convData.totalUnread} /> : null}
          <Box sx={{ flex: 1 }} />
          {connections.length > 1 && (
            <Select
              size="small"
              value={connectionId}
              onChange={(e) => { setConnectionId(String(e.target.value)); setConversationId(''); }}
              sx={{ minWidth: 180 }}
            >
              {connections.map((c) => (
                <MenuItem key={c.id} value={c.id}>@{c.igUsername || c.igBusinessAccountId}</MenuItem>
              ))}
            </Select>
          )}
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {connLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
        ) : connections.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Ingen Instagram-konto er koblet til ennå. Koble en Instagram Business-konto for å
              motta og svare på DM-er her.
            </Alert>
            <Button variant="contained" startIcon={<InstagramIcon />} onClick={connectInstagram}>
              Koble Instagram
            </Button>
          </Box>
        ) : needsMessagingReauth ? (
          <Box sx={{ p: 4 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Instagram-kontoen er koblet til, men mangler <strong>meldings-tilgang</strong>
              (instagram_manage_messages). Koble til på nytt og la «manage messages» stå på i
              Meta-dialogen for å aktivere innboksen.
            </Alert>
            <Button variant="contained" startIcon={<InstagramIcon />} onClick={connectInstagram}>
              Koble Instagram på nytt
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '40% 60%', sm: '260px 1fr', md: '300px 1fr' }, minHeight: 0, flex: 1 }}>
            {/* Conversation list */}
            <Box sx={{ borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto' }}>
              {convData?.syncError ? (
                <Alert severity="info" sx={{ m: 1, fontSize: 12 }}>
                  Live-synk venter (instagram_manage_messages). Innkommende meldinger lagres via webhook.
                </Alert>
              ) : null}
              {convLoading ? (
                <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
              ) : conversations.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Alert severity="info" sx={{ fontSize: 13 }}>
                    Innboksen er klar. Meldinger dukker opp her når noen sender DM til kontoen.
                    {convData?.syncError ? ' (Live-henting venter på godkjenning av instagram_manage_messages; innkommende meldinger lagres via webhook.)' : ''}
                  </Alert>
                </Box>
              ) : (
                <List disablePadding>
                  {conversations.map((c) => (
                    <ListItemButton
                      key={c.id}
                      selected={c.id === conversationId}
                      onClick={() => setConversationId(c.id)}
                    >
                      <ListItemAvatar>
                        <Avatar>{(c.participantUsername || c.participantName || '?').slice(0, 1).toUpperCase()}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={displayName(c)}
                        secondary={c.lastMessageSnippet || fmtTime(c.lastMessageAt)}
                        primaryTypographyProps={{ noWrap: true, fontWeight: c.unreadCount ? 700 : 400 }}
                        secondaryTypographyProps={{ noWrap: true }}
                      />
                      {c.unreadCount > 0 && <Chip size="small" color="error" label={c.unreadCount} />}
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>

            {/* Thread */}
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {!conversationId ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                  <Typography variant="body2">Velg en samtale</Typography>
                </Box>
              ) : (
                <>
                  <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {selectedConversation ? displayName(selectedConversation) : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'background.default' }}>
                    {msgLoading && messages.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress size={22} /></Box>
                    ) : messages.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                        Ingen meldinger ennå.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {messages.map((m) => (
                          <Box key={m.id} sx={{ display: 'flex', justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start' }}>
                            <Paper
                              elevation={0}
                              sx={{
                                px: 1.5, py: 1, maxWidth: '72%', borderRadius: 2,
                                bgcolor: m.direction === 'outbound' ? 'primary.main' : 'action.hover',
                                color: m.direction === 'outbound' ? 'primary.contrastText' : 'text.primary',
                              }}
                            >
                              {m.body && <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body}</Typography>}
                              {m.attachmentUrl && (
                                <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                                  [{m.attachmentType || 'vedlegg'}]
                                </Typography>
                              )}
                              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                                {fmtTime(m.createdAt)}
                              </Typography>
                            </Paper>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <Divider />
                  <Stack direction="row" spacing={1} sx={{ p: 1.5 }}>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      maxRows={4}
                      placeholder="Skriv et svar…"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (replyText.trim()) replyMutation.mutate(replyText.trim());
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      endIcon={<SendIcon />}
                      disabled={replyMutation.isPending || !replyText.trim()}
                      onClick={() => replyMutation.mutate(replyText.trim())}
                    >
                      Send
                    </Button>
                  </Stack>
                </>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
    </BrandScope>
  );
}
