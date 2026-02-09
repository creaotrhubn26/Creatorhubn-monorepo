import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Avatar,
  Chip,
  Alert,
  IconButton,
  Snackbar,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Send as SendIcon,
  Save as SaveIcon,
  Cloud as CloudIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import { ChatPrivacyConsent } from './ChatPrivacyConsent';

interface ChatMessage {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: Date;
  isOperator: boolean
}

interface ChatWithPrivacyProps {
  customerId: string;
  customerName: string;
  projectId?: string;
  projectName?: string;
  operatorName: string;
  onChatBackup?: (chatData: any) => void
}

export const ChatWithPrivacy: React.FC<ChatWithPrivacyProps> = ({
  customerd,
  customerName,
  projectId,
  projectName,
  operatorName,
  onChatBackup
}) => {
  const [consentGiven, setConsentGiven] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [showConsentDialog, setShowConsentDialog] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatStartTime] = useState(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [driveUrl, setDriveUrl] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-scroll til bunnen ved nye meldinger
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth',});
}, [messages]);

  // Auto-lagre chat hvert 2. minutt
  useEffect(() => {
    if (consentGiven && messages.length > 0) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
    }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleAutoSave();
    }, 120000); // 2 minutter
  }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
    }
  };
}, [messages, consentGiven]);

  const handleConsentAccept = () => {
    setConsentGiven(true);
    setShowConsentDialog(false);
    
    // Vis bekreftelsemelding
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 3000);
};

  const handleConsentDecline = () => {
    // Redirect eller vis alternativ
    alert('Chat-funksjonen er ikke tilgjengelig uten samtykke til datalagring.');
};

  const handleSendMessage = () => {
    if (!newMessage.trim() || !consentGiven) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      sender: operatorName,
      senderName: operatorName,
      content: newMessage.trim(),
      timestamp: new Date(),
      isOperator: true
};

    setMessages(prev => [...prev, message]);
    setNewMessage(', ');

    // Trigger auto-save etter ny melding
    handleAutoSave();
};

  const handleAutoSave = async () => {
    if (!consentGiven || messages.length === 0) return;

    setIsSaving(true);
    setSaveStatus('saving');

    try {
      const chatData = {
        customerId,
        customerName,
        projectId,
        projectName,
        operatorName,
        startTime: chatStartTime,
        endTime: new Date(),
        messages: messages.map(msg => ({
          sender: msg.senderName,
          content: msg.content,
          timestamp: msg.timestamp,
          isOperator: msg.isOperator
    })),
        summary: `Chat-samtale med ${customerName} - ${messages.length} meldinger`,
        actionItems: [] // Kan utvides med oppgaver fra chat
  };

      const response = await fetch('/api/backup/chat', {
        headers: {
          ...auth, 'Content-Type' : 'application/json',
      },
        method: 'POS',
        body: JSON.stringify({
          userId: 'current-user', // Erstatt med faktisk bruker-ID
          chatData
      }),
    });

      const result = await response.json();

      if (result.success) {
        setLastSaved(new Date());
        setSaveStatus('saved');
        setDriveUrl(result.googleDocsUrl);
        
        if (onChatBackup) {
          onChatBackup(result);
      }
    } else {
        setSaveStatus('error');
    }
  } catch (error) {
      console.error('Feil ved lagring av chat: ', error);
      setSaveStatus('error');
  } finally {
      setIsSaving(false);
  }
};

  const getStatusColor = () => {
    switch (saveStatus) {
      case 'saving': return 'info';
      case 'saved': return 'success';
      case 'error': return 'error';
      default: return 'default';
}
};

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving': return 'Lagrer til Google Drive...';
      case 'saved': return `Lagret ${lastSaved?.toLocaleTimeString('no-NO')}`;
      case 'error': return 'Lagringsfeil';
      default: return 'Chat dokumenteres automatisk';
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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column'}}>
      {/* Chat Header med lagringsstatus */}
      <Paper sx={{ p: 2, borderRadius: '12px 12px 0 0', bgcolor: 'primary.main', color: 'white',  ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  2 }}>
            <Avatar sx={{ bgcolor: 'secondary.main'}}>
              {customerName.charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>{customerName}</Typography>
              {projectName && (
                <Typography variant="body2" sx={{ opacity: 0.9}}>
                  {projectName}
                </Typography>
              )}
            </Box>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
            <Tooltip title={driveUrl ? "Åpne i Google Drive" : "Drive URL ikke tilgjengelig"}>
              <IconButton
                size="small"
                sx={{ color: 'white'}}
                onClick={() => driveUrl && window.open(driveUrl, ','_blank')}
                disabled={!driveUrl}
              >
                <FolderIcon />
              </IconButton>
            </Tooltip>
            <Chip
              icon={saveStatus === 'saving' ? <CloudIcon /> : <CheckCircleIcon />}
              label={getStatusText()}
              size="small"
              color={getStatusColor()}
              variant="outlined"
              sx={{ 
                color: 'white', 
                borderColor: 'white', '& .MuiChip-icon': { color: 'white',}
            }}
            />
          </Box>
        </Box>
      </Paper>

      {/* GDPR Info Alert */}
      <Alert 
        severity="info" 
        sx={{ borderRadius:  0 }}
        action={
          driveUrl && (
            <Button 
              color="inherit" 
              size="small"
              onClick={() => window.open(driveUrl, ', '_blank')}
            >
              Se i Drive
            </Button>
          )
      }
      >
        <Typography variant="body2">
          🔒 Chat lagres automatisk i Google Drive for dokumentasjon (GDPR-compliant)
        </Typography>
      </Alert>

      {/* Lagringsprogress */}
      {isSaving && <LinearProgress />}

      {/* Chat-meldinger */}
      <Box sx={{ 
        flex: 1
       , overflow: 'auto', 
        p: 2, bgcolor: 'grey.5',
        maxHeight: '400px'
  }}>
        {messages.length === 0 ? (
          <Box sx={{ textAlign: 'center', py:  4, color: 'text.secondary'}}>
            <Typography variant="body2">
              Ingen meldinger ennå. Start samtalen!
            </Typography>
          </Box>
        ) : (
          messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.isOperator ? 'flex-end' : 'flex-start',
                mb: 1 }}
            >
              <Paper
                sx={{
                  p: 1.5,
                  maxWidth: '70, %',
                  bgcolor: message.isOperator ? 'primary.main' : 'white',
                  color: message.isOperator ? 'white' : 'text.primary',
                  borderRadius: message.isOperator ? '12px 12px 4px 12px' : '12px 12px 12px 4px'
            }}
               sx={theming.getThemedCardSx()}>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5}}>
                  {message.senderName}
                </Typography>
                <Typography variant="body1">{message.content}</Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'block', 
                    mt: 0, .
                    opacity: 0.7,
                    textAlign: 'right'
              }}
                >
                  {message.timestamp.toLocaleTimeString('no-NO', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
              })}
                </Typography>
              </Paper>
            </Box>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input-felt */}
      <Paper sx={{ p: 2, borderRadius: '0 0 12px 12px',  ...theming.getThemedCardSx() }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end'}}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Skriv en melding..."
            variant="outlined"
            size="small"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
          }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '20px'
          }
          }}
          />
          <Tooltip title="Send melding">
            <Button onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              variant="contained"
              sx={{
                minWidth: '48px',
                height: '48px',
                borderRadius: '50, %',
                p: 0 }}
             sx={theming.getThemedButtonSx()}>
              <SendIcon />
            </Button>
          </Tooltip>
          <Tooltip title="Lagre chat manuelt">
            <Button
              onClick={handleAutoSave}
              disabled={messages.length === 0 || isSaving}
              variant="outlined"
              sx={{
                minWidth: '48px',
                height: '48px',
                borderRadius: '50, %',
                p: 0 }}
            >
              <SaveIcon />
            </Button>
          </Tooltip>
        </Box>
      </Paper>

      {/* Status Snackbar */}
      <Snackbar
        open={saveStatus ==='error'}
        autoHideDuration={6000}
        onClose={() => setSaveStatus('idle')}
      >
        <Alert severity="error" onClose={() => setSaveStatus('idle')}>
          Kunne ikke lagre chat. Prøv igjen senere.
        </Alert>
      </Snackbar>
    </Box>
  );
};