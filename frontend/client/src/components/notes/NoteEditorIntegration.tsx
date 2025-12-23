// client/src/components/notes/NoteEditorIntegration.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import NoteEditor from './NoteEditor';
import { Email } from '@mui/icons-material';

interface NoteEditorIntegrationProps {
  selectedContact?: {
    id: string;
    name: string;
    email: string;
    type: 'client' | 'team' | 'support';
};
  communicationMode: 'chat' | 'email';
  onEmailSend?: (emailData: {
    to: string;
    subject: string;
    content: string;
    attachments?: File[];
}) => void;
}

export default function NoteEditorIntegration({
  selectedContact,
  communicationMode,
  onEmailSend,
}: NoteEditorIntegrationProps) {
  const [noteContent, setNoteContent] = useState('');
  
  // Theming system
  const theming = useTheming('photographer');

  const handleEmailSend = (emailData: {
    to: string;
    subject: string;
    content: string;
    attachments?: File[];
}) => {
    console.log('📧 Sending email: ', emailData);
    onEmailSend?.(emailData);
};

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Email Mode Header */}
      {communicationMode === 'email' && selectedContact && (
        <Paper 
          elevation={1}
          sx={{ 
            p: 2, 
            mb: 1, 
            bgcolor: '#9C27B0', 
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            ...theming.getThemedCardSx()
        }}>
          <Email />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            E-post til {selectedContact.name}
          </Typography>
        </Paper>
      )}

      {/* Note Editor with Email Integration */}
      <NoteEditor
        value={noteContent}
        onChange={setNoteContent}
        placeholder={
          communicationMode === 'email' && selectedContact
            ? `Skriv e-post til ${selectedContact.name}...`
            :'Skriv notatet her...'
      }
      />
    </Box>
  );
}

