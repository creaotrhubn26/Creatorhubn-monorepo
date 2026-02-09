import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import WorklogContextShortcuts from '../worklog/WorklogContextShortcuts';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  ListItemAvatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Alert,
  LinearProgress,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  Tooltip,
  InputAdornment,
  Checkbox,
  CircularProgress
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Image as ImageIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  Close as CloseIcon,
  Drafts as DraftIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  AutoAwesome as AutoAwesomeIcon,
  Folder as FolderIcon,
  Email as EmailIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatListNumbered as FormatListNumberedIcon,
  Description as TemplateIcon,
  Spellcheck as SpellcheckIcon,
  AutoFixHigh as AutoFixHighIcon,
  ContentCopy as ContentCopyIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  VideoCall as VideoCallIcon,
  Draw as SignatureIcon,
  Psychology as AIIcon,
  Translate as TranslateIcon,
  AccessTime as ScheduleSendIcon,
  Security as SecurityIcon,
  Event as EventIcon,
  Chat,
  Schedule,
  CloudUpload,
  Lock,
  Badge,
  NotificationImportant
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';

interface EmailComposerProps {
  profession: string;
  userId: string;
  initialTo?: string;
  initialSubject?: string;
  initialContent?: string;
  projectId?: string;
  onClose?: () => void;
  onSent?: (emailData: any) => void
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: string
}

export default function EmailComposer({
  profession,
  userId,
  initialTo = '',
  initialSubject = '',
  initialContent = '',
  projectId,
  onClose,
  onSent
}: EmailComposerProps) {
  const { user } = useAuth();
  const { integration, communication, dataFlow, lifecycle } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('photographer');
  const [emailForm, setEmailForm] = useState({
    to: initialo,
    cc: '',
    bcc: '',
    subject: initialSubject,
    content: initialContent,
    html: '',
    priority: 'normal' as 'low' | 'normal' | 'high',
    scheduleDate: '',
    projectId: projectId ||'',
    templateId: ''
});

  const [showCcBcc, setShowCcBcc] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [spellCheckResults, setSpellCheckResults] = useState<string[]>([]);
  const [showSpellCheck, setShowSpellCheck] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTemplateVarsModal, setShowTemplateVarsModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showConfidentialModal, setShowConfidentialModal] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<any>(null);
  const [dragOver, setDragOver] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: ',',
    description: '',
    date: '',
    time: '',
    duration: '6',
    attendees: [] as string[],
    includeInEmail: true
});
  const [signatures, setSignatures] = useState([
    { id: 'business', name: 'Profesjonell', content: 'Med vennlig hilsen,\n[Navn]\n[Tittel]\n[Telefon]\n[E-post]' },
    { id: 'casual', name: 'Uformell', content: 'Ha en fin dag!\n[Navn]',},
    { id: 'project', name: 'Prosjekt', content: 'Med vennlig hilsen,\n[Navn]\n[Prosjektnavn]\n[Kontaktinfo]' }
  ]);
  const [selectedSignature, setSelectedSignature] = useState('business');
  
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Get email templates
  const { data: emailTemplatesData } = useQuery({
    queryKey: ['/api/email-templates', profession],
    queryFn: () => apiRequest(`/api/email-templates?profession=${profession}`),
    staleTime: 5 * 60 * 100,
});

  const emailTemplates = Array.isArray(emailTemplatesData) ? emailTemplatesData : [];

  // Get photographer projects for linking
  const { data: projectsData } = useQuery({
    queryKey: [`/api/submissions`, profession],
    queryFn: () => apiRequest(`/api/submissions/${profession}`),
    enabled: !!userd,
    staleTime: 2 * 60 * 100,
});

  // Get CRM contacts for email composition
  const { data: contactsData } = useQuery({
    queryKey: ['/api/crm/contacts', userId],
    queryFn: () => apiRequest(`/api/crm/contacts?userId=${userId}`),
    enabled: !!userd,
    staleTime: 5 * 60 * 100,
});

  // Fallback to email contacts if CRM contacts not available
  const { data: emailContactsData } = useQuery({
    queryKey: ['/api/emails/contacts', userId],
    queryFn: () => apiRequest(`/api/emails/contacts?userId=${userId}`),
    enabled: !!userId && !contactsData,
    staleTime: 5 * 60 * 100,
});

  const projects = Array.isArray(projectsData) ? projectsData : [];
  const recentContacts = Array.isArray(contactsData) ? contactsData : 
                        Array.isArray(emailContactsData) ? emailContactsData : [];


  // Register component with MasterIntegrationProvider
  React.useEffect(() => {
    lifecycle.registerComponent({
      id: 'EmailComposer',
      type: 'email-service',
      version: '1.0.0',
      capabilities: {
        data: ['email-form','attachments','templates','contacts'],
        events: ['email:sent','email: draft-saved', ],
        actions: ['email-compose','email-send','template-management','attachment-handling'],
        ui: ['email-composer','template-selector','attachment-manager'],
        system: ['google-drive-sync','google-contacts-integration']
    },
      dependencies:  [],
      lastActive: Date.now(),
      performance: {
        renderCount: 0,
        avgRenderTime:  0,
        memoryUsage: 0 }
  });

    // Set up data flow nodes
    dataFlow.registerNode({
      type: 'source',
      componentId: 'EmailComposer',
      dataKey: 'email-form',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'EmailComposer',
      dataKey: 'attachments',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'EmailComposer',
      dataKey: 'templates',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'EmailComposer',
      dataKey: 'contacts',
      transform: (data: any) => ({ ...data, lastUpdated: Date.now(),})
  });

    // Listen for email events
    communication.onMessageType('email:compose-request', (data: any) => {
      if (data.projectId === projectId) {
        setEmailForm(prev => ({ ...prev, ...data.emailData }));
    }
  });

    communication.onMessageType('email:template-apply', (data: any) => {
      if (data.template) {
        handleTemplateSelect(data.template);
  }
  });

    return () => {
      lifecycle.unregisterComponent('EmailComposer');
      // Note: dataFlow.unregisterNode would need the actual node IDs returned from registerNode
};
}, [emailForm, attachments, emailTemplates, recentContacts, projectId, profession, userId, lifecycle, dataFlow, communication]);

  // Writing helper functions
  const insertTextFormat = (startTag: string, endTag: string) => {
    const textarea = contentInputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = emailForm.content.substring(start, end);
    const beforeText = emailForm.content.substring(0, start);
    const afterText = emailForm.content.substring(end);
    
    const newText = `${beforeText}${startTag}${selectedText}${endTag}${afterText}`;
    setEmailForm({ ...emailForm, content: newText });
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + startTag.length + selectedText.length + endTag.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
  }, 0);
};

  const runSpellCheck = () => {
    // Simple Norwegian spell check suggestions
    const commonMistakes = {
      'takk':'tusen takk','hei':'Hei','mvh':'Med vennlig hilsen','telefon':'telefonnummer','epost':'e-post','mail' : 'e-post'
  };
    
    const words = emailForm.content.toLowerCase().split(/\s+/);
    const suggestions: string[] = [];
    
    words.forEach(word => {
      if (commonMistakes[word as keyof typeof commonMistakes]) {
        suggestions.push(`"${word}," → "${commonMistakes[word as keyof typeof commonMistakes]}, "`);
    }
  });
    
    setSpellCheckResults(suggestions);
    setShowSpellCheck(true);
};

  const improveWriting = () => {
    const improvements = [
      'Vurder å bruke mer formelt språk','Legg til en tydelig oppfordring til handling','Sjekk at alle detaljer er inkludert','Bruk aktivt språk fremfor passivt'
    ];
    
    // Simple text improvements
    let improvedContent = emailForm.content;
    
    // Capitalize sentences
    improvedContent = improvedContent.replace(/(^|\. )([a-zæøå])/g, (match, p1, p2) => p1 + p2.toUpperCase());
    
    // Add professional closing if missing
    if (!improvedContent.includes('hilsen') && !improvedContent.includes('regards')) {
      improvedContent += '\n\nMed vennlig hilsen';
  }
    
    setEmailForm({ ...emailForm, content: improvedContent });
};

  
  // Find selected contact based on email form 'to' field
  const selectedContact = recentContacts.find((contact: any) => 
    contact.email === emailForm.to || contact.name === emailForm.to
  );

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const formData = new FormData();
      
      // Add email data
      Object.keys(emailData).forEach(key => {
        if (emailData[key]) {
          formData.append(key, emailData[key]);
      }
    });

      // Add attachments
      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
    });

      if (projectId) {
        return apiRequest(`/api/project-emails/project/${projectId}/send-email`, {
          method: 'POST',
          headers: {
          "Content-Type" : "application/json"
    },
          body: formData
    });
    } else {
        return apiRequest('/api/gmail/send-email', {
          method: 'POST',
          headers: {
          "Content-Type" : "application/json"
    },
          body: formData
    });
    }
  },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails', ],});
      onSent?.(data);
      
      // Broadcast email sent event
      communication.sendBroadcast('email:sent', {
        emailData: data, 
        projectId, 
        profession
    });
      
      if (onClose) onClose();
      resetForm();
  }
});

  // Google Meet creation mutation
  const createMeetingMutation = useMutation({
    mutationFn: async (meetingData: any) => {
      const response = await fetch('/api/calendar/create-meeting', {
        method: 'POST',
        headers: { 
          ...auth, 'Content-Type' : 'application/json',
      },
        body: JSON.stringify(meetingData)
  });
      if (!response.ok) throw new Error('Failed to create meeting');
      return response.json();
  },
    onSuccess: (response) => {
      if (meetingForm.includeInEmail && response.data) {
        const meetingText = `\n\nMøtedetaljer:\n📅 ${meetingForm.title}\n🕐 ${meetingForm.date} kl. ${meetingForm.time}\n🔗 Google Meet: ${response.data.meetLink}\n\nVennlig hilsen`;
        setEmailForm(prev => ({ ...prev, content: prev.content + meetingText }));
    }
      setShowMeetingModal(false);
      setMeetingForm({
        title: '',
        description: '',
        date: '',
        time: '',
        duration: '6',
        attendees:  [],
        includeInEmail: true
  });
  }
});

  const handleCreateMeeting = () => {
    const startDateTime = new Date(`${meetingForm.date}T${meetingForm.time}`);
    const endDateTime = new Date(startDateTime.getTime() + parseInt(meetingForm.duration) * 60000);
    
    createMeetingMutation.mutate({
      summary: meetingForm.title,
      description: meetingForm.description,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
      attendees: [...meetingForm.attendees, selectedContact?.email].filter(Boolean)
  });
};

  // Quick Meet link insertion
  const insertMeetLink = async () => {
    try {
      // Generate instant Meet link
      const response = await fetch('/api/calendar/quick-meet', {
        method: 'POST',
        headers: { 
          ...auth, 'Content-Type' : 'application/json',
      },
        body: JSON.stringify({
          title: `Møte med ${selectedContact?.name || emailForm.to.split('@')[0]}`,
          instant: true
    })
    });
      
      if (response.ok) {
        const data = await response.json();
        const meetText = `\n\nGoogle Meet: ${data.meetLink}\n`;
        setEmailForm(prev => ({ ...prev, content: prev.content + meetText }));
    }
  } catch (error) {
      console.error('Failed to create quick Meet link: ', error);
  }
};

  // Smart availability checker
  const checkAvailability = async (date: string, time: string) => {
    if (!selectedContact?.email) return;
    
    try {
      const response = await fetch('/api/calendar/check-availability', {
        method: 'POST',
        headers: { 
          ...auth, 'Content-Type' : 'application/json',
      },
        body: JSON.stringify({
          attendees: [selectedContact.email],
          date,
          time,
          duration: meetingForm.duration
    })
    });
      
      return response.json();
  } catch (error) {
      console.error('Failed to check availability:', error);
      return null;
  }
};

  // AI-powered content improvement
  const improveWritingWithAI = async () => {
    try {
      const response = await fetch('/api/ai/improve-writing', {
        method: 'POST',
        headers: { 
          ...auth, 'Content-Type' : 'application/json',
      },
        body: JSON.stringify({
          content: emailForm.content,
          tone: 'professional',
          language: 'norwegian'
    })
    });
      
      if (response.ok) {
        const data = await response.json();
        setEmailForm(prev => ({ ...prev, content: data.improvedContent }));
    }
  } catch (error) {
      console.error('AI improvement failed:', error);
  }
};

  // Translation feature
  const translateContent = async () => {
    try {
      const response = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 
          ...auth, 'Content-Type' : 'application/json',
      },
        body: JSON.stringify({
          content: emailForm.content,
          targetLanguage: 'en' // Could be made selectable
    })
    });
      
      if (response.ok) {
        const data = await response.json();
        setEmailForm(prev => ({ ...prev, content: data.translatedContent }));
    }
  } catch (error) {
      console.error('Translation failed:', error);
  }
}

  // Google Chat Integration
  const startChatThread = async () => {
    try {
      const response = await fetch('/api/google/chat/start-thread', {
        method: 'POST',
        headers: { 
          ...auth, 'Content-Type' : 'application/json',
      },
        body: JSON.stringify({
          participants: [emailForm.to],
          subject: emailForm.subject,
          relatedEmail: emailForm.content.substring(0, 100) + '...'
      })
    });
      
      if (response.ok) {
        const data = await response.json();
        window.open(data.chatUrl, '_blank');
    }
  } catch (error) {
      console.error('Chat thread creation failed:', error);
  }
};

  // Insert Availability
  const insertAvailability = () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const availabilityText = `\n\nMine tilgjengelige tider: \n• I morgen (${tomorrow.toLocaleDateString('')}) kl. 10: 00-16:00\n• Neste uke (${nextWeek.toLocaleDateString(',')}) kl. 09: 00-17:00\n• Eller foreslå et annet tidspunkt som passer deg\n\nKlikk her for å velge tid: [Kalenderlenke]\n`;
    
    setEmailForm(prev => ({ ...prev, content: prev.content + availabilityText }));
};

  // Google Drive File Selector
  const openDriveSelector = () => {
    // This would integrate with Google Drive Picker API
    const driveText = `\n\n📁 Vedlegg fra Google Drive: \n[Filer vil bli lagt til her fra Drive-velgeren]\n`;
    setEmailForm(prev => ({ ...prev, content: prev.content + driveText }));
    alert('Google Drive-integrasjon: I produksjon vil dette åpne Drive-filvelgeren');
};

  // Template Variables
  const insertTemplateVariable = (variable: string) => {
    const variables: Record<string, string> = {
      'firstName':'{{firstName}}, ','lastName':'{{lastName}}, ','company':'{{company}}, ','projectName':'{{projectName}}, ','eventDate':'{{eventDate}}, ','location' : '{{location}}, '
  };
    
    const varText = variables[variable] || `{{${variable}}}`;
    setEmailForm(prev => ({ ...prev, content: prev.content + varText }));
};

  // Sensitive data detection
  const checkSensitiveData = () => {
    const sensitivePatterns = [
      /\b\d{11}\b/, // Norwegian personal number
      /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/, // Credit card
      /passord|password/i,
      /pin\s?kode|pin\s?code/i
    ];

    let foundSensitive = false;
    sensitivePatterns.forEach(pattern => {
      if (pattern.test(emailForm.content)) {
        foundSensitive = true;
    }
  });

    if (foundSensitive) {
      alert('⚠️ Mulig sensitiv informasjon oppdaget. Vurder å fjerne eller kryptere data før sending.');
  } else {
      alert('✅ Ingen sensitiv informasjon funnet.');
  }
};

  // Insert signature
  const insertSignature = (signatureId: string) => {
    const signature = signatures.find(s => s.id === signatureId);
    if (signature) {
      const signatureText = `\n\n${signature.content}`;
      setEmailForm(prev => ({ ...prev, content: prev.content + signatureText }));
      setShowSignatureModal(false);
  }
};

  // Save draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async (draftData: any) => {
      return apiRequest('/api/emails/drafts', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json',},
        body: JSON.stringify({ ...draftData, userId, profession })
    });
  },
    onSuccess: () => {
      setIsDraft(true);
      queryClient.invalidateQueries({ queryKey: ['/api/emails/drafts', ],});
  }
});

  const resetForm = () => {
    setEmailForm({
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      content: '',
      html: '',
      priority: 'normal',
      scheduleDate: '',
      projectId: '',
      templateId: ''
});
    setAttachments([]);
    setShowCcBcc(false);
    setShowSchedule(false);
    setIsDraft(false);
};

  const handleSendEmail = () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.content) {
      return;
  }

    const emailData = {
      ...emailForm,
      html: emailForm.content, // Convert to HTML if needed
      attachments: attachments.length,
      photographerId: userd,
      profession
  };

    sendEmailMutation.mutate(emailData);
};

  const handleSaveDraft = () => {
    saveDraftMutation.mutate(emailForm);
};

  const handleTemplateSelect = (template: EmailTemplate) => {
    setEmailForm({
      ...emailForm,
      subject: template.subject,
      content: template.content,
      templateId: template.id
});
    setShowTemplates(false);
};

  const handleFileAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
};

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
};

  const getProjectName = (projectId: string) => {
    const project = projects.find((p: any) => p.id === projectId);
    return project ? `${project.title || project.name} - ${project.eventType}` : projectId;
};

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column',  ...theming.getThemedCardSx() }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <AutoAwesomeIcon color="primary" />
            Smart E-post Komponering
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<DraftIcon />}
              onClick={handleSaveDraft}
              disabled={!emailForm.subject && !emailForm.content}
            >
              Lagre Utkast
            </Button>
            {onClose && (
              <IconButton onClick={onClose}>
                <CloseIcon />
              </IconButton>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Email Form */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p:  3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap:  3 }}>
          {/* Email Form - Full Width */}
          <Box>
            <Stack spacing={3}>
              {/* Project Selection - Always Show for Photographers */}
              <FormControl fullWidth>
                <InputLabel>Koble til prosjekt (valgfritt)</InputLabel>
                <Select
                  value={emailForm.projectId}
                  onChange={(e) => setEmailForm({ ...emailForm, projectId: e.target.value })}
                  label="Koble til prosjekt (valgfritt)"
                  startAdornment={
                    emailForm.projectId ? (
                      <InputAdornment position="start">
                        <FolderIcon color="primary" />
                      </InputAdornment>
                    ) : null
                }
                >
                  <MenuItem value="">Ingen prosjekt</MenuItem>
                  {projects.length === 0 ? (
                    <MenuItem disabled>
                      <Typography variant="body2" color="text.secondary">
                        Ingen prosjekter tilgjengelig
                      </Typography>
                    </MenuItem>
                  ) : (
                    projects.map((project: any) => (
                      <MenuItem key={project.d} value={project.id}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Avatar sx={{ width:  24, height:  24, fontSize: 12}}>
                            {project.eventType?.charAt(0).toUpperCase() || 'P'}
                          </Avatar>
                          <Box>
                            <Typography variant="body2">{project.title || project.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {project.eventDate || project.date} • {project.eventType}
                            </Typography>
                          </Box>
                        </Stack>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              {/* To Field with CRM Integration */}
              <Autocomplete
                freeSolo
                options={recentContacts}
                getOptionLabel={(option: any) => {
                  if (typeof option === 'string') return option;
                  return option.email || option.name || '';
            }}
                renderOption={(props, option) => {
                  const contact = typeof option === 'object' ? option : recentContacts.find((c: any) => c.email === option);
                  const displayName = contact?.firstName && contact?.lastName 
                    ? `${contact.firstName} ${contact.lastName}`
                    : contact?.name || contact?.email || option;
                  const displayEmail = contact?.email || option;
                  const displayCompany = contact?.company || contact?.organization || ', ';

                  return (
                    <li {...props}>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%'}}>
                        <Avatar sx={{ width:  32, height:  32, bgcolor: 'primary.main'}}>
                          {displayName?.charAt(0)?.toUpperCase() || displayEmail?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1, minWidth:  0 }}>
                          <Typography variant="body2" noWrap>
                            {displayName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {displayEmail}
                            {displayCompany && ` • ${displayCompany}`}
                          </Typography>
                        </Box>
                      </Stack>
                    </li>
                  );
              }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Til"
                    required
                    helperText="Skriv inn e-postadresse eller velg fra CRM-kontakter"
                    value={emailForm.to}
                    onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon color="primary" />
                        </InputAdornment>
                      )
                    }}
                  />
                )}
                onChange={(event, value) => {
                  if (value) {
                    const email = typeof value === 'object' ? (value.email || value.name) : value;
                    setEmailForm({ ...emailForm, to: email });
                }
              }}
              />

              {/* CC/BCC Toggle */}
              <Stack direction="row" spacing={2} alignItems="center">
                <Button
                  size="small"
                  onClick={() => setShowCcBcc(!showCcBcc)}
                  sx={{ textTransform: 'none'}}
                >
                  {showCcBcc ? 'Skjul CC/BCC' : 'Vis CC/BCC'}
                </Button>
                <Button
                  size="small"
                  onClick={() => setShowSchedule(!showSchedule)}
                  sx={{ textTransform: 'none'}}
                >
                  {showSchedule ? 'Send nå' : 'Planlegg'}
                </Button>
              </Stack>

              {/* CC/BCC Fields */}
              {showCcBcc && (
                <Stack spacing={2}>
                  <TextField
                    fullWidth
                    label="CC (kopi)"
                    value={emailForm.cc}
                    onChange={(e) => setEmailForm({ ...emailForm, cc: e.target.value })}
                    placeholder="flere@eksempel.no, enda@en.no"
                  />
                  <TextField
                    fullWidth
                    label="BCC (blindkopi)"
                    value={emailForm.bcc}
                    onChange={(e) => setEmailForm({ ...emailForm, bcc: e.target.value })}
                    placeholder="skjult@eksempel.no"
                  />
                </Stack>
              )}

              {/* Schedule Field */}
              {showSchedule && (
                <TextField
                  fullWidth
                  type="datetime-local"
                  label="Send senere"
                  value={emailForm.scheduleDate}
                  onChange={(e) => setEmailForm({ ...emailForm, scheduleDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ScheduleIcon />
                      </InputAdornment>
                    )
                  }}
                />
              )}

              {/* Subject */}
              <TextField
                fullWidth
                label="Emne"
                required
                value={emailForm.subject}
                onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })}
                placeholder="Skriv inn emnelinjen..."
              />

              {/* Priority and Template Buttons */}
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 120}}>
                  <InputLabel>Prioritet</InputLabel>
                  <Select
                    value={emailForm.priority}
                    label="Prioritet"
                    onChange={(e) => setEmailForm({ ...emailForm, priority: e.target.value as 'low' | 'normal' | 'high',})}
                  >
                    <MenuItem value="low">Lav</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="high">Høy</MenuItem>
                  </Select>
                </FormControl>
                
                <Button
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={() => setShowTemplates(true)}
                  sx={{ textTransform: 'none'}}
                >
                  Velg mal
                </Button>
              </Stack>

              {/* Worklog Context Shortcuts - Smart snarveier til relevante notater */}
              <WorklogContextShortcuts
                userId="daniel@creatorhubnorge.com"
                contextType="email"
                clientEmail={emailForm.to}
                projectId={emailForm.projectId}
                timeframe="week"
                onWorklogSelect={(worklog) => {
                  // Legg til worklog-innhold i e-post
                  const worklogText = `\n\n📝 Fra worklog: ${worklog.title}\n${worklog.description}${worklog.nextSteps ? '\n\nNeste steg: ' + worklog.nextSteps :', '}\n`;
                  setEmailForm(prev => ({ ...prev, content: prev.content + worklogText }));
              }}
                compact={true}
              />

              {/* Rich Text Editor with Writing Features */}
              <Card variant="outlined" sx={theming.getThemedCardSx()}>
                <CardContent sx={{ p:  2 ,  ...theming.getThemedCardSx() }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb:  2 }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      E-post Innhold
                    </Typography>
                    
                    {/* Text Formatting Toolbar */}
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Fet tekst (Ctrl+B)">
                        <IconButton size="small" onClick={() => insertTextFormat('**', '**')}>
                          <FormatBoldIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Kursiv tekst (Ctrl+I)">
                        <IconButton size="small" onClick={() => insertTextFormat('*', '*')}>
                          <FormatItalicIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Understreket">
                        <IconButton size="small" onClick={() => insertTextFormat('_', '_')}>
                          <FormatUnderlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Divider orientation="vertical" flexItem />
                      <Tooltip title="Punktliste">
                        <IconButton size="small" onClick={() => insertTextFormat('\n•', ',')}>
                          <FormatListBulletedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Nummerert liste">
                        <IconButton size="small" onClick={() => insertTextFormat('\n1.',',')}>
                          <FormatListNumberedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Divider orientation="vertical" flexItem />
                      <Tooltip title="Sett inn mal">
                        <IconButton size="small" onClick={() => setShowTemplateDialog(true)}>
                          <TemplateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Divider orientation="vertical" flexItem />
                      <Tooltip title="Planlegg Google Meet">
                        <IconButton 
                          size="small" 
                          onClick={() => setShowMeetingModal(true)}
                          color="primary"
                        >
                          <VideoCallIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Divider orientation="vertical" flexItem />
                      <Tooltip title="Signatur">
                        <IconButton 
                          size="small" 
                          onClick={() => setShowSignatureModal(true)}
                        >
                          <SignatureIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="AI-forbedring">
                        <IconButton 
                          size="small" 
                          onClick={() => improveWritingWithAI()}
                        >
                          <AIIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Oversett">
                        <IconButton 
                          size="small" 
                          onClick={() => translateContent()}
                        >
                          <TranslateIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sikkerhet">
                        <IconButton 
                          size="small" 
                          onClick={() => checkSensitiveData()}
                        >
                          <SecurityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Divider orientation="vertical" flexItem />
                      <Tooltip title="Google Chat">
                        <IconButton 
                          size="small" 
                          onClick={() => startChatThread()}
                          color="success"
                        >
                          <Chat fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Sett inn tilgjengelighet">
                        <IconButton 
                          size="small" 
                          onClick={() => insertAvailability()}
                          color="warning"
                        >
                          <Schedule fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Google Drive vedlegg">
                        <IconButton 
                          size="small" 
                          onClick={() => openDriveSelector()}
                          color="info"
                        >
                          <CloudUpload fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Konfidensielt modus">
                        <IconButton 
                          size="small" 
                          onClick={() => setShowConfidentialModal(true)}
                          color="error"
                        >
                          <Lock fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Mal variabler">
                        <IconButton 
                          size="small" 
                          onClick={() => setShowTemplateVarsModal(true)}
                        >
                          <Badge fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Oppfølging påminnelse">
                        <IconButton 
                          size="small" 
                          onClick={() => setShowFollowUpModal(true)}
                        >
                          <NotificationImportant fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <TextField
                    fullWidth
                    multiline
                    rows={14}
                    value={emailForm.content}
                    onChange={(e) => setEmailForm({ ...emailForm, content: e.target.value })}
                    placeholder="Skriv din e-post her...

Tips for profesjonell e-post: • Bruk høflig og tydelig språk
• Inkluder alle relevante detaljer
• Avslutt med en klar oppfordring til handling
• Husk å korrekturlese før sending

Eksempel:
Hei [Navn],

Takk for henvendelsen angående fotografering av [prosjekt].

[Ditt innhold her]

Med vennlig hilsen,
[Ditt navn]"
                    variant="outlined"
                    required
                    inputRef={contentInputRef}
                    InputProps={{
                      sx: { 
                        fontFamily: 'Roboto, sans-serif',
                        fontSize: '1rem',
                        lineHeight: 1.7, '& .MuiInputBase-input': {
                          lineHeight: 1.7 }
                    }
                  }}
                  />
                  
                  {/* Writing Statistics and Tools */}
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {emailForm.content.length} tegn • {emailForm.content.split(', ').filter(word => word.length > 0).length} ord
                        {emailForm.content.split('\n').filter(line => line.trim().length > 0).length > 1 && 
                          ` • ${emailForm.content.split('\n').filter(line => line.trim().length > 0).length} avsnitt`}
                      </Typography>
                      
                      {emailForm.content.length > 0 && (
                        <Typography variant="caption" color={emailForm.content.length > 2000 ? 'error' : 'text.secondary'}>
                          {emailForm.content.length > 2000 ? 'Veldig lang e-post' : 
                           emailForm.content.length > 1000 ? 'Lang e-post' : 
                           emailForm.content.length > 500 ? 'Middels e-post' : 'Kort e-post'}
                        </Typography>
                      )}
                    </Stack>
                    
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        startIcon={<SpellcheckIcon />}
                        onClick={runSpellCheck}
                        variant="text"
                        sx={{ textTransform: 'none'}}
                      >
                        Stavekontroll
                      </Button>
                      <Button
                        size="small"
                        startIcon={<AutoFixHighIcon />}
                        onClick={improveWriting}
                        variant="text"
                        sx={{ textTransform: 'none'}}
                      >
                        Forbedre
                      </Button>
                    </Stack>
                  </Box>
                </CardContent>
              </Card>

              {/* Attachments */}
              <Box>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb:  2 }}>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileAttachment}
                    style={{ display: 'none'}}
                    id="file-attachment"
                  />
                  <label htmlFor="file-attachment">
                    <Button
                      component="span"
                      startIcon={<AttachFileIcon />}
                      variant="outlined"
                      size="small"
                    >
                      Legg til vedlegg
                    </Button>
                  </label>
                  {attachments.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {attachments.length} fil(er) vedlagt
                    </Typography>
                  )}
                </Stack>

                {attachments.length > 0 && (
                  <Box sx={{ maxHeight: 10, overflow: 'auto'}}>
                    <Stack spacing={1}>
                      {attachments.map((file, index) => (
                        <Chip
                          key={index}
                          label={`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`}
                          onDelete={() => removeAttachment(index)}
                          variant="outlined"
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>


        </Box>
      </Box>

      {/* Footer Actions */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider'}}>
        <Stack direction="row" spacing={2} justifyContent="flex-end">
          {isDraft && (
            <Alert severity="info" sx={{ flexGrow:  1 }}>
              Utkast lagret
            </Alert>
          )}
          
          <Button
            variant="outlined"
            onClick={handleSaveDraft}
            disabled={(!emailForm.subject && !emailForm.content) || saveDraftMutation.isPending}
            startIcon={saveDraftMutation.isPending ? <RefreshIcon /> : <DraftIcon />}
          >
            {saveDraftMutation.isPending ? 'Lagrer...' : 'Lagre Utkast'}
          </Button>
          
          <Button variant="contained"
            onClick={handleSendEmail}
            disabled={!emailForm.to || !emailForm.subject || !emailForm.content || sendEmailMutation.isPending}
            startIcon={sendEmailMutation.isPending ? <RefreshIcon sx={theming.getThemedButtonSx()} /> : <SendIcon />}
            sx={{ minWidth: 140}}
          >
            {sendEmailMutation.isPending ? 'Sender...' : showSchedule && emailForm.scheduleDate ? 'Planlegg' : 'Send E-post'}
          </Button>
        </Stack>
        
        {sendEmailMutation.isPending && (
          <LinearProgress sx={{ mt:  2 }} />
        )}
      </Box>

      {/* Templates Modal */}
      <Dialog 
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Velg e-post mal</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
            {emailTemplates.map((template: EmailTemplate) => (
              <Box key={template.d} sx={{ flex: '1 1 300px', minWidth: 250}}>
                <Card 
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover',} }}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardContent sx={theming.getThemedCardSx()}>
                    <Typography variant="h6" sx={{  mb:  1  }}>
                      {template.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  1 }}>
                      {template.category}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block'}}>
                      Emne: {template.subject}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplates(false)}>Avbryt</Button>
        </DialogActions>
      </Dialog>

      {/* Template Quick Insert Dialog */}
      <Dialog 
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Hurtig innsetting av mal</DialogTitle>
        <DialogContent>
          <List>
            <ListItemButton onClick={() => {
              setEmailForm({ ...emailForm, content: emailForm.content + '\n\nMed vennlig hilsen,\n[Ditt navn]\n[Tittel]\n[Telefon]\n[E-post]' });
              setShowTemplateDialog(false);
          }}>
              <ListItemText primary="Profesjonell avslutning" secondary="Med vennlig hilsen + kontaktinfo" />
            </ListItemButton>
            <ListItemButton onClick={() => {
              setEmailForm({ ...emailForm, content: emailForm.content + '\n\nTakk for henvendelsen. Jeg kommer tilbake til deg innen 24 timer.',});
              setShowTemplateDialog(false);
          }}>
              <ListItemText primary="Standard respons" secondary="Takk og tilbakemelding innen 24t" />
            </ListItemButton>
            <ListItemButton onClick={() => {
              setEmailForm({ ...emailForm, content: emailForm.content + '\n\nVennligst bekreft mottak av denne e-posten.\n\nTakk for samarbeidet!',});
              setShowTemplateDialog(false);
          }}>
              <ListItemText primary="Be om bekreftelse" secondary="Forespør om bekreftelse" />
            </ListItemButton>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Google Meet Creation Modal */}
      <Dialog 
        open={showMeetingModal}
        onClose={() => setShowMeetingModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <VideoCallIcon color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Opprett Google Meet møte</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt:  1 }}>
            <TextField
              fullWidth
              label="Møtetittel"
              value={meetingForm.title}
              onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
              placeholder="F.eks: Fotosesjon planlegging"
            />
            
            <TextField
              fullWidth
              label="Beskrivelse (valgfritt)"
              multiline
              rows={3}
              value={meetingForm.description}
              onChange={(e) => setMeetingForm({ ...meetingForm, description: e.target.value })}
              placeholder="Agenda, tema eller viktige punkter..."
            />
            
            <Box sx={{ display: 'flex', gap:  2 }}>
              <TextField
                fullWidth
                type="date"
                label="Dato"
                value={meetingForm.date}
                onChange={(e) => {
                  setMeetingForm({ ...meetingForm, date: e.target.value });
                  if (meetingForm.time) checkAvailability(e.target.value, meetingForm.time);
              }}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                type="time"
                label="Klokkeslett"
                value={meetingForm.time}
                onChange={(e) => {
                  setMeetingForm({ ...meetingForm, time: e.target.value });
                  if (meetingForm.date) checkAvailability(meetingForm.date, e.target.value);
              }}
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            
            {availabilityStatus && (
              <Alert 
                severity={availabilityStatus.available ? 'success' : 'warning'}
                variant="outlined"
              >
                {availabilityStatus.available 
                  ? '✅ Mottaker er tilgjengelig på dette tidspunktet'
                  : '⚠️ Mottaker kan være opptatt på dette tidspunktet'
              }
              </Alert>
            )}
            
            <FormControl fullWidth>
              <InputLabel>Varighet</InputLabel>
              <Select
                value={meetingForm.duration}
                label="Varighet"
                onChange={(e) => setMeetingForm({ ...meetingForm, duration: e.target.value })}
              >
                <MenuItem value="30">30 minutter</MenuItem>
                <MenuItem value="60">1 time</MenuItem>
                <MenuItem value="90">1.5 timer</MenuItem>
                <MenuItem value="120">2 timer</MenuItem>
              </Select>
            </FormControl>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={meetingForm.includeInEmail}
                  onChange={(e) => setMeetingForm({ ...meetingForm, includeInEmail: e.target.checked })}
                />
            }
              label="Inkluder møtedetaljer i e-posten automatisk"
            />
            
            <Alert severity="info">
              Møtet vil bli opprettet i Google Calendar med en Google Meet-link som automatisk genereres.
              {selectedContact && ` ${selectedContact.email || selectedContact.name} vil bli invitert.`}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowMeetingModal(false)}>
            Avbryt
          </Button>
          <Button onClick={handleCreateMeeting}
            variant="contained"
            disabled={!meetingForm.title || !meetingForm.date || !meetingForm.time || createMeetingMutation.isPending}
            startIcon={createMeetingMutation.isPending ? <CircularProgress size={16} sx={theming.getThemedButtonSx()} /> : <VideoCallIcon />}
          >
            {createMeetingMutation.isPending ? 'Oppretter...' : 'Opprett møte'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Signature Management Modal */}
      <Dialog 
        open={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SignatureIcon color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Velg signatur</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            {signatures.map((signature) => (
              <Box 
                key={signature.id}
                p={2}
                border={1}
                borderColor="divider"
                borderRadius={1}
                sx={{ 
                  cursor: 'pointer',
                  bgcolor: selectedSignature === signature.id ? 'action.selected' : 'transparent', '&:hover': { bgcolor: 'action.hover',}
              }}
                onClick={() => setSelectedSignature(signature.id)}
              >
                <Typography variant="subtitle2" fontWeight="bold">
                  {signature.name}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap'}}>
                  {signature.content}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSignatureModal(false)}>
            Avbryt
          </Button>
          <Button 
            onClick={() => insertSignature(selectedSignature)}
            variant="contained"
            startIcon={<SignatureIcon />}
          >
            Sett inn signatur
          </Button>
        </DialogActions>
      </Dialog>

      {/* Spell Check Dialog */}
      <Dialog 
        open={showSpellCheck}
        onClose={() => setShowSpellCheck(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Stavekontroll og forslag</DialogTitle>
        <DialogContent>
          {spellCheckResults.length === 0 ? (
            <Alert severity="success">
              Ingen stavefeil funnet! E-posten ser bra ut.
            </Alert>
          ) : (
            <Box>
              <Typography variant="body2" sx={{ mb:  2 }}>
                Fant {spellCheckResults.length} forslag til forbedringer: </Typography>
              <List>
                {spellCheckResults.map((suggestion, index) => (
                  <ListItem key={index}>
                    <ListItemText primary={suggestion} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSpellCheck(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Template Variables Modal */}
      <Dialog 
        open={showTemplateVarsModal}
        onClose={() => setShowTemplateVarsModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Mal Variabler</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb:  2 }}>
            Klikk for å sette inn variabler som automatisk fylles ut: </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap:  1 }}>
            {[
              { key: 'firstName', label: 'Fornavn', desc: '{{firstName}}' },
              { key: 'lastName', label: 'Etternavn', desc: '{{lastName}}' },
              { key: 'company', label: 'Firma', desc: '{{company}}' },
              { key: 'projectName', label: 'Prosjektnavn', desc: '{{projectName}}' },
              { key: 'eventDate', label: 'Dato', desc: '{{eventDate}}' },
              { key: 'location', label: 'Sted', desc: '{{location}}' }
            ].map((variable) => (
              <Box key={variable.key} sx={{ flex: '1 1 150px', minWidth: 120}}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    insertTemplateVariable(variable.key);
                    setShowTemplateVarsModal(false);
                }}
                  sx={{ textAlign: 'left', justifyContent:'flex-start'}}
                >
                  <Stack>
                    <Typography variant="body2">{variable.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {variable.desc}
                    </Typography>
                  </Stack>
                </Button>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplateVarsModal(false)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Confidential Mode Modal */}
      <Dialog 
        open={showConfidentialModal}
        onClose={() => setShowConfidentialModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Konfidensielt Modus</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Alert severity="info">
              Konfidensielt modus hindrer mottaker fra å videresende, kopiere eller skrive ut e-posten.
            </Alert>
            
            <FormControl fullWidth>
              <InputLabel>Utløpstid</InputLabel>
              <Select defaultValue="7">
                <MenuItem value="1">1 dag</MenuItem>
                <MenuItem value="3">3 dager</MenuItem>
                <MenuItem value="7">1 uke</MenuItem>
                <MenuItem value="30">1 måned</MenuItem>
                <MenuItem value="0">Ingen utløp</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Krev SMS-bekreftelse for åpning"
            />

            <FormControlLabel
              control={<Switch />}
              label="Hindre kopiering av tekst"
            />

            <FormControlLabel
              control={<Switch />}
              label="Hindre nedlasting av vedlegg"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfidentialModal(false)}>
            Avbryt
          </Button>
          <Button variant="contained" color="error" sx={theming.getThemedButtonSx()}>
            Aktiver konfidensielt modus
          </Button>
        </DialogActions>
      </Dialog>

      {/* Follow-up Reminder Modal */}
      <Dialog 
        open={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Oppfølging Påminnelse</DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Typography variant="body2">
              Få automatisk påminnelse hvis mottaker ikke svarer innen angitt tid.
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Påminn meg hvis ikke svar innen</InputLabel>
              <Select defaultValue="3">
                <MenuItem value="1">1 dag</MenuItem>
                <MenuItem value="3">3 dager</MenuItem>
                <MenuItem value="7">1 uke</MenuItem>
                <MenuItem value="14">2 uker</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Påminnelse tekst (valgfritt)"
              placeholder="Husk å følge opp angående..."
            />

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Send automatisk oppfølging e-post"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowFollowUpModal(false)}>
            Avbryt
          </Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()}>
            Sett påminnelse
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}