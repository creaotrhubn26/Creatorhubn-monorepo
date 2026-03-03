import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cloud as CloudIcon,
  Folder as FolderIcon,
  Save as SaveIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { ChatPrivacyConsent } from './ChatPrivacyConsent';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isOperator: boolean;
}

interface ChatBackupResult {
  success: boolean;
  googleDocsUrl?: string;
}

export interface ChatWithPrivacyProps {
  customerId: string;
  customerName: string;
  projectId?: string;
  projectName?: string;
  operatorName: string;
  onChatBackup?: (chatData: ChatBackupResult) => void;
}

function createMessage(senderId: string, senderName: string, content: string, isOperator: boolean): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId,
    senderName,
    content,
    timestamp: new Date(),
    isOperator,
  };
}

function statusText(status: 'idle' | 'saving' | 'saved' | 'error', lastSavedAt: Date | null): string {
  if (status === 'saving') {
    return 'Saving chat backup…';
  }

  if (status === 'saved') {
    return `Saved ${lastSavedAt ? lastSavedAt.toLocaleTimeString('nb-NO') : 'just now'}`;
  }

  if (status === 'error') {
    return 'Backup failed';
  }

  return 'Chat is auto-documented';
}

function statusColor(status: 'idle' | 'saving' | 'saved' | 'error'): 'default' | 'info' | 'success' | 'error' {
  if (status === 'saving') {
    return 'info';
  }

  if (status === 'saved') {
    return 'success';
  }

  if (status === 'error') {
    return 'error';
  }

  return 'default';
}

export const ChatWithPrivacy: FC<ChatWithPrivacyProps> = ({
  customerId,
  customerName,
  projectId,
  projectName,
  operatorName,
  onChatBackup,
}) => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatStartTime] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [driveUrl, setDriveUrl] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!consentGiven || messages.length === 0) {
      return;
    }

    if (autoSaveRef.current) {
      clearTimeout(autoSaveRef.current);
    }

    autoSaveRef.current = setTimeout(() => {
      void handleSaveChat();
    }, 120000);

    return () => {
      if (autoSaveRef.current) {
        clearTimeout(autoSaveRef.current);
      }
    };
  }, [messages, consentGiven]);

  const saveStatusLabel = useMemo(() => statusText(saveStatus, lastSavedAt), [saveStatus, lastSavedAt]);

  const handleConsentAccept = () => {
    setConsentGiven(true);
    setShowConsentDialog(false);
    setSaveStatus('saved');

    setTimeout(() => {
      setSaveStatus('idle');
    }, 2500);
  };

  const handleConsentDecline = () => {
    setConsentGiven(false);
    setShowConsentDialog(true);
    setMessages([]);
    setNewMessage('');
  };

  const handleSendMessage = () => {
    const trimmed = newMessage.trim();
    if (!consentGiven || trimmed.length === 0) {
      return;
    }

    const operatorMessage = createMessage(operatorName, operatorName, trimmed, true);
    setMessages((current) => [...current, operatorMessage]);
    setNewMessage('');
  };

  const handleSaveChat = async () => {
    if (!consentGiven || messages.length === 0) {
      return;
    }

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const payload = {
        customerId,
        customerName,
        projectId,
        projectName,
        operatorName,
        startTime: chatStartTime.toISOString(),
        endTime: new Date().toISOString(),
        messages: messages.map((message) => ({
          senderId: message.senderId,
          senderName: message.senderName,
          content: message.content,
          timestamp: message.timestamp.toISOString(),
          isOperator: message.isOperator,
        })),
      };

      const response = (await apiRequest('/api/backup/chat', {
        method: 'POST',
        body: payload,
      })) as ChatBackupResult;

      if (response.success) {
        setSaveStatus('saved');
        setLastSavedAt(new Date());

        if (response.googleDocsUrl) {
          setDriveUrl(response.googleDocsUrl);
        }

        if (onChatBackup) {
          onChatBackup(response);
        }
      } else {
        setSaveStatus('error');
        setShowErrorToast(true);
      }
    } catch {
      setSaveStatus('error');
      setShowErrorToast(true);
    } finally {
      setIsSaving(false);
    }
  };

  if (!consentGiven) {
    return (
      <ChatPrivacyConsent
        open={showConsentDialog}
        customerName={customerName}
        projectName={projectName}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
      />
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, borderRadius: '12px 12px 0 0' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar>{customerName.charAt(0).toUpperCase()}</Avatar>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {customerName}
              </Typography>
              {projectName ? (
                <Typography variant="body2" color="text.secondary">
                  {projectName}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Tooltip title={driveUrl.length > 0 ? 'Open backup document' : 'Backup link not available yet'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (driveUrl.length > 0) {
                      window.open(driveUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  disabled={driveUrl.length === 0}
                >
                  <FolderIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Chip
              icon={saveStatus === 'saving' ? <CloudIcon /> : <CheckCircleIcon />}
              label={saveStatusLabel}
              color={statusColor(saveStatus)}
              size="small"
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Paper>

      <Alert severity="info" sx={{ borderRadius: 0 }}>
        Chat is auto-backed up to Google Drive with GDPR consent and timestamped history.
      </Alert>

      {isSaving ? <LinearProgress /> : null}

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'grey.100', minHeight: 280 }}>
        {messages.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
            No messages yet. Start the conversation.
          </Typography>
        ) : (
          messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.isOperator ? 'flex-end' : 'flex-start',
                mb: 1,
              }}
            >
              <Paper
                sx={{
                  p: 1.5,
                  maxWidth: '70%',
                  bgcolor: message.isOperator ? 'primary.main' : 'white',
                  color: message.isOperator ? 'primary.contrastText' : 'text.primary',
                  borderRadius: message.isOperator ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                }}
              >
                <Typography variant="body2" fontWeight={700}>
                  {message.senderName}
                </Typography>
                <Typography variant="body1">{message.content}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.75, display: 'block', textAlign: 'right' }}>
                  {message.timestamp.toLocaleTimeString('nb-NO', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Typography>
              </Paper>
            </Box>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Paper sx={{ p: 2, borderRadius: '0 0 12px 12px' }}>
        <Stack direction="row" spacing={1} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            placeholder="Write a message…"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSendMessage();
              }
            }}
          />

          <Tooltip title="Send message">
            <span>
              <Button
                variant="contained"
                onClick={handleSendMessage}
                disabled={newMessage.trim().length === 0}
                sx={{ minWidth: 48, height: 48, borderRadius: '50%', p: 0 }}
              >
                <SendIcon />
              </Button>
            </span>
          </Tooltip>

          <Tooltip title="Save chat now">
            <span>
              <Button
                variant="outlined"
                onClick={() => {
                  void handleSaveChat();
                }}
                disabled={messages.length === 0 || isSaving}
                sx={{ minWidth: 48, height: 48, borderRadius: '50%', p: 0 }}
              >
                <SaveIcon />
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      <Snackbar
        open={showErrorToast}
        autoHideDuration={5000}
        onClose={() => {
          setShowErrorToast(false);
          if (saveStatus === 'error') {
            setSaveStatus('idle');
          }
        }}
      >
        <Alert severity="error" onClose={() => setShowErrorToast(false)}>
          Could not save chat backup. Please try again.
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ChatWithPrivacy;
