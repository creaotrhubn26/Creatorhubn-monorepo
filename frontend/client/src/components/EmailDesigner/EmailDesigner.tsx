import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card as MuiCard,
  CardContent,
  CardActions,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Tooltip,
  Fab,
  Stack,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Palette as PaletteIcon,
  TextFields as TextFieldsIcon,
  Image as ImageIcon,
  Code as CodeIcon,
  Preview as PreviewIcon,
  Save as SaveIcon,
  Send as SendIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  DragIndicator as DragIcon,
  Settings as SettingsIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type EmailComponentType =
  | 'header'
  | 'text'
  | 'button'
  | 'image'
  | 'divider'
  | 'footer'
  | 'social'
  | 'spacer';

interface EmailComponent {
  id: string;
  type: EmailComponentType;
  content: any;
  styles: any; 
}

interface EmailDesignerProps {
  context?: 'showcase' | 'wedding-timeline' | 'general' | 'invitation';
  projectId?: string;
  onSave?: (template: EmailTemplate) => void;
  // Integration props for universal workflow connectivity
  profession?: string;
  userId?: string;
  onMeetingCreate?: (meeting: any) => void;
  onProjectUpdate?: (project: any) => void;
  onWorklogCreate?: (worklog: any) => void;
  selectedProject?: any;
  onProjectSelect?: (project: any) => void;
  // Invitation-specific props
  invitationData?: {
    recipientEmail: string;
    recipientName: string;
    role: string;
    profession: string;
    token?: string;
    testingAreas?: string[];
    experience?: string;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  preheader: string;
  context?: 'showcase' | 'wedding-timeline' | 'general' | 'invitation';
  components: EmailComponent[];
  globalStyles: {
    backgroundColor: string;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    textColor: string;
    linkColor: string;
    containerWidth: number;
};
}

const defaultGlobalStyles = {
  backgroundColor: '#f5f5f0',
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,
  lineHeight: 1.6,
  textColor: '#333330',
  linkColor: '#ff6b30',
  containerWidth: 600
};

const componentTypes = [
  { id: 'header', name: 'Overskrift', icon: <TextFieldsIcon />, color: '#ff6b35',},
  { id: 'text', name: 'Tekst', icon: <TextFieldsIcon />, color: '#2196f3',},
  { id: 'button', name: 'Knapp', icon: <BusinessIcon />, color: '#4caf50',},
  { id: 'image', name: 'Bilde', icon: <ImageIcon />, color: '#ff9800',},
  { id: 'divider', name: 'Skillestrek', icon: <DragIcon />, color: '#9c27b0',},
  { id: 'social', name: 'Sosiale medier', icon: <PhoneIcon />, color: '#e91e63',},
  { id: 'spacer', name: 'Avstand', icon: <DragIcon />, color: '#607d8b',},
  { id: 'footer', name: 'Bunntekst', icon: <EmailIcon />, color: '#795548',}
];

function isEmailComponentType(type: string): type is EmailComponentType {
  return componentTypes.some((componentType) => componentType.id === type);
}

const SortableComponent: React.FC<{ 
  component: EmailComponent; 
  onEdit: (component: EmailComponent) => void;
  onDelete: (id: string) => void
}> = ({ component, onEdit, onDelete }) => {
  const theming = useTheming('photographer');

  const renderComponent = () => {
    switch (component.type) {
      case 'header':
        return (
          <Typography variant="h4" 
            style={{ 
              color: component.styles?.color || '#333333',
              textAlign: component.styles?.textAlign || 'left',
              fontWeight: component.styles?.fontWeight || 'bold',
              marginBottom: component.styles?.marginBottom || 16 }}
           sx={{ color: theming.colors.primary }}>
            {component.content?.text || 'Overskrift'}
          </Typography>
        );
      case 'text':
        return (
          <Typography 
            variant="body1" 
            style={{ 
              color: component.styles?.color || '#333333',
              textAlign: component.styles?.textAlign || 'left',
              marginBottom: component.styles?.marginBottom || 16 }}
          >
            {component.content?.text || 'Dette er en tekstkomponent.'}
          </Typography>
        );
      case 'button':
        return (
          <Button variant="contained"
            style={{
              backgroundColor: component.styles?.backgroundColor || '#ff6b30',
              color: component.styles?.color || '#ffffff',
              borderRadius: component.styles?.borderRadius || 8,
              padding: `${component.styles?.paddingY || 12}px ${component.styles?.paddingX || 24}px`,
              fontSize: component.styles?.fontSize || 16,
              fontWeight: component.styles?.fontWeight || 'bold',
              textTransform: 'none',
              marginBottom: component.styles?.marginBottom || 16
            }}
            sx={theming.getThemedButtonSx()}>
            {component.content?.text || 'Klikk her'}
          </Button>
        );
      case 'image':
        return (
          <Box
            component="img"
            src={component.content?.src || '/api/placeholder/400/200'}
            alt={component.content?.alt || 'Bilde'}
            style={{
              width: component.styles?.width || '100%',
              height: 'auto',
              borderRadius: component.styles?.borderRadius || 0,
              marginBottom: component.styles?.marginBottom || 16 }}
          />
        );
      case 'divider':
        return (
          <Divider
            style={{
              backgroundColor: component.styles?.color || '#e0e0e0',
              height: component.styles?.height || 1,
              marginTop: component.styles?.marginTop || 16,
              marginBottom: component.styles?.marginBottom || 16
            }}
          />
        );
      case 'spacer':
        return (
          <Box
            style={{
              height: component.styles?.height || 20,
              backgroundColor: 'transparent'
        }}
          />
        );
      case 'social':
        return (
          <Stack direction="row" spacing={2} justifyContent={component.styles?.alignment || 'center'}>
            <IconButton style={{ color: '#1877f2'}}><EmailIcon /></IconButton>
            <IconButton style={{ color: '#1da1f2'}}><PhoneIcon /></IconButton>
            <IconButton style={{ color: '#0a66c2'}}><BusinessIcon /></IconButton>
          </Stack>
        );
      case 'footer':
        return (
          <Typography
            variant="caption"
            style={{
              color: component.styles?.color || '#666666',
              textAlign: component.styles?.textAlign || 'center',
              fontSize: component.styles?.fontSize || 12,
              marginTop: component.styles?.marginTop || 24 }}
          >
            {component.content?.text || 'CreatorHub Norge - user?.email'}
          </Typography>
        );
      default:
        return <Box>Ukjent komponent</Box>;
    }
  };

  return (
    <Paper
      elevation={2}
      sx={{
        ...theming.getThemedCardSx(),
        p: 2,
        mb: 2,
        position: 'relative',
        border: '2px dashed transparent',
        '&:hover': {
          border: '2px dashed #ff6b30',
          backgroundColor: '#fff3e0'
        },
        '&:hover .component-actions': {
          opacity: 1
        }
      }}>
      <Box
        sx={{
          position: 'absolute',
          top:  8,
          left:  8,
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          gap:  1,
          opacity: 0.5, '&:hover': { opacity:  1 }
      }}
      >
        <DragIcon fontSize="small" />
        <Typography variant="caption" sx={{ textTransform: 'capitalize'}}>
          {componentTypes.find(t => t.id === component.type)?.name}
        </Typography>
      </Box>

      <Box sx={{ mt:  3 }}>
        {renderComponent()}
      </Box>

      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          gap: 1,
          opacity: 0
        }}
        className="component-actions"
      >
        <IconButton size="small" onClick={() => onEdit(component)}>
          <SettingsIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => onDelete(component.id)} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
};

export const EmailDesigner: React.FC<EmailDesignerProps> = ({ 
  context = 'general', 
  projectId, 
  onSave,
  profession,
  userId,
  onMeetingCreate,
  onProjectUpdate,
  onWorklogCreate,
  selectedProject,
  onProjectSelect,
  invitationData
}) => {
  const [template, setTemplate] = useState<EmailTemplate>({
    id: 'new-template',
    name: 'Ny E-postmal',
    category: 'general',
    subject: 'CreatorHub Norge - Viktig melding',
    preheader: 'Se de siste oppdateringene fra CreatorHub Norge',
    context: context,
    components:  [],
    globalStyles: defaultGlobalStyles
});

  const [selectedComponent, setSelectedComponent] = useState<EmailComponent | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const queryClient = useQueryClient();
  
  // Theming system
  const theming = useTheming('photographer');
  
  // Auto-load invitation template when context is 'invitation'
  React.useEffect(() => {
    if (context === 'invitation' && invitationData) {
            const registrationUrl = invitationData.token 
              ? `https://creatorhubn.com/register?invitation=${invitationData.token}`
              : `https://creatorhubn.com/register?email=${invitationData.recipientEmail}`;
      
      // Create personalized invitation template
      const invitationTemplate: EmailTemplate = {
        id: 'prototype-tester-invitation',
        name: `Invitation - ${invitationData.recipientName}`,
        category: 'invitation',
        subject: `Velkommen til CreatorHub Norge - Prototype Tester (${invitationData.profession})`,
        preheader: `Du er godkjent til å teste ${invitationData.profession}`,
        context: 'invitation',
        components: [
          {
            id: 'header-1',
            type: 'header',
            content: { text: `Velkommen, ${invitationData.recipientName}!` },
            styles: { color: '#e65100', textAlign: 'center', fontSize: 28, fontWeight: 'bold', marginBottom: 24 }
          },
          {
            id: 'text-1',
            type: 'text',
            content: { text: `Du er godkjent som Prototype Tester for ${invitationData.profession}!` },
            styles: { color: '#333333', textAlign: 'center', fontSize: 16, marginBottom: 16 }
          },
          {
            id: 'button-1',
            type: 'button',
            content: { text: 'Opprett Min Konto', url: registrationUrl },
            styles: { backgroundColor: '#e65100', color: '#ffffff', borderRadius: 8, paddingX: 32, paddingY: 12, fontSize: 16, fontWeight: 'bold', marginBottom: 24 }
          },
          {
            id: 'text-2',
            type: 'text',
            content: { 
              text: `Du vil, teste: ${invitationData.profession}\n\nTesting områder: ${invitationData.testingAreas?.join('') || 'All features'}\n\nErfaring: ${invitationData.experience || 'Not specified'}`
            },
            styles: { color: '#333333', textAlign: 'left', fontSize: 14, marginBottom: 16 }
          },
          {
            id: 'footer-1',
            type: 'footer',
            content: { text: 'CreatorHub Norge Testing Team | kontakt@creatorhubn.com' },
            styles: { color: '#666666', textAlign: 'center', fontSize: 12, marginTop: 32 }
          }
        ],
        globalStyles: {
          ...defaultGlobalStyles,
          backgroundColor: '#f5f5f5',
          containerWidth: 600 }
      };
      
      setTemplate(invitationTemplate);
    }
  }, [context, invitationData]);

  // Load email templates from backend
  const { data: emailTemplates, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/email/templates'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => apiRequest('/api/email/templates'),
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (templateData: EmailTemplate) => {
      return apiRequest('/api/email/templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email/templates'] });
    },
  });

  // @hello-pangea/dnd doesn't need sensors configuration

  const addComponent = (type: string) => {
    if (!isEmailComponentType(type)) {
      return;
    }

    const newComponent: EmailComponent = {
      id: `${type}-${Date.now()}`,
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type)
    };

    setTemplate(prev => ({
      ...prev,
      components: [...prev.components, newComponent]
  }));
};

  const getDefaultContent = (type: string) => {
    switch (type) {
      case 'header':
        return { text: 'Velkommen til CreatorHub Norge',};
      case 'text':
        return { text: 'Dette er en tekstkomponent som du kan tilpasse etter dine behov.',};
      case 'button':
        return { text: 'Klikk her', url: 'https://creatorhubn.com',};
      case 'image':
        return { src: '', alt: 'Beskrivelse av bildet',};
      case 'footer':
        return { text: 'CreatorHub Norge - Utviklet av Daniel Qazi | user?.email',};
      default: return {};
  }
};

  const getDefaultStyles = (type: string) => {
    switch (type) {
      case 'header':
        return { color: '#ff6b30', textAlign: 'center', fontSize:  28, fontWeight: 'bold', marginBottom: 24,};
      case 'text':
        return { color: '#333330', textAlign: 'left', fontSize:  16, marginBottom: 16,};
      case 'button':
        return { 
          backgroundColor: '#ff6b30', 
          color: '#ffffff', 
          borderRadius:  8, 
          paddingX:  32, 
          paddingY:  12,
          fontSize:  16,
          fontWeight: 'bold',
          marginBottom: 24 };
      case 'image':
        return { width: '100%', borderRadius:  8, marginBottom: 16,};
      case 'divider':
        return { color: '#e0e0e0', height: 2, marginTop:  24, marginBottom: 24,};
      case 'spacer':
        return { height: 32,};
      case 'social':
        return { alignment: 'center', marginBottom: 24 };
      case 'footer':
        return { color: '#666660', textAlign: 'center', fontSize: 12, marginTop: 32 };
      default:
        return {};
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex !== destinationIndex) {
      setTemplate(prev => {
        const newComponents = [...prev.components];
        const [movedComponent] = newComponents.splice(sourceIndex, 1);
        if (movedComponent) {
          newComponents.splice(destinationIndex, 0, movedComponent);
        }
        
        return { ...prev, components: newComponents };
    });
  }
};

  const editComponent = (component: EmailComponent) => {
    setSelectedComponent(component);
    setEditDialog(true);
};

  const deleteComponent = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      components: prev.components.filter(c => c.id !== id)
}));
};

  const updateComponent = (updatedComponent: EmailComponent) => {
    setTemplate(prev => ({
      ...prev,
      components: prev.components.map(c => 
        c.id === updatedComponent.id ? updatedComponent : c
      )
}));
    setEditDialog(false);
    setSelectedComponent(null);
};

  const loadTemplate = (templateData: any) => {
    // Convert database template to our format
    const loadedTemplate: EmailTemplate = {
      id: templateData.id || 'loaded-template',
      name: templateData.name || 'Lastet mal',
      category: templateData.template_type || 'general',
      subject: templateData.subject || 'Emnelinje',
      preheader: templateData.preheader || 'Preheader',
      context: context,
      components: parseHTMLToComponents(templateData.html_content || ''),
      globalStyles: defaultGlobalStyles
};
    
    setTemplate(loadedTemplate);
    setActiveTab(0); // Switch to components tab
};

  const parseHTMLToComponents = (html: string): EmailComponent[] => {
    // Simple HTML parsing - in a real implementation, you'd use a proper HTML parser
    const components: EmailComponent[] = [];
    
    if (html.includes('<h1>') || html.includes('<h2>')) {
      components.push({
        id: `header-${Date.now()}`,
        type: 'header',
        content: { text: 'Velkommen til CreatorHub Norge!',},
        styles: getDefaultStyles('header')
  });
  }
    
    if (html.includes('<p>')) {
      components.push({
        id: `text-${Date.now()}`,
        type: 'text',
        content: { text: 'Dette er en tekstkomponent som du kan tilpasse.',},
        styles: getDefaultStyles('text')
  });
  }
    
    if (html.includes('<a') && html.includes('button')) {
      components.push({
        id: `button-${Date.now()}`,
        type: 'button',
        content: { text: 'Klikk her', url: 'https://creatorhubn.com',},
        styles: getDefaultStyles('button')
  });
  }
    
    return components;
};

  const saveTemplate = () => {
    saveTemplateMutation.mutate(template);
};

  const generateHTML = () => {
    const componentsHTML = template.components.map(component => {
      switch (component.type) {
        case 'header':
          return `
            <h1 style="
              color: ${component.styles.color}; 
              text-align: ${component.styles.textAlign}; 
              font-size: ${component.styles.fontSize}px;
              font-weight: ${component.styles.fontWeight};
              margin-bottom: ${component.styles.marginBottom}px;
              font-family: ${template.globalStyles.fontFamily};
            ">
              ${component.content.text}
            </h1>
          `;
        case 'text':
          return `
            <p style="
              color: ${component.styles.color}; 
              text-align: ${component.styles.textAlign}; 
              font-size: ${component.styles.fontSize}px;
              margin-bottom: ${component.styles.marginBottom}px;
              line-height: ${template.globalStyles.lineHeight};
              font-family: ${template.globalStyles.fontFamily};
            ">
              ${component.content.text}
            </p>
          `;
        case 'button':
          return `
            <div style="text-align: center; margin-bottom: ${component.styles.marginBottom}px;">
              <a href="${component.content.url || '#'}" style="
                display: inline-block;
                background-color: ${component.styles.backgroundColor};
                color: ${component.styles.color};
                padding: ${component.styles.paddingY}px ${component.styles.paddingX}px;
                text-decoration: none;
                border-radius: ${component.styles.borderRadius}px;
                font-size: ${component.styles.fontSize}px;
                font-weight: ${component.styles.fontWeight};
                font-family: ${template.globalStyles.fontFamily};
              ">
                ${component.content.text}
              </a>
            </div>
          `;
        case 'image':
          return `
            <img src="${component.content.src}" alt="${component.content.alt}" style="
              width: ${component.styles.width};
              border-radius: ${component.styles.borderRadius}px;
              margin-bottom: ${component.styles.marginBottom}px;
              display: block;
            ">
          `;
        case 'divider':
          return `
            <hr style="
              border: none;
              background-color: ${component.styles.color};
              height: ${component.styles.height}px;
              margin: ${component.styles.marginTop}px 0 ${component.styles.marginBottom}px 0;
            ">
          `;
        case 'spacer':
          return `<div style="height: ${component.styles.height}px;"></div>`;
        case 'footer':
          return `
            <div style="
              color: ${component.styles.color};
              text-align: ${component.styles.textAlign};
              font-size: ${component.styles.fontSize}px;
              margin-top: ${component.styles.marginTop}px;
              font-family: ${template.globalStyles.fontFamily};
            ">
              ${component.content.text}
            </div>
          `;
        default:
          return '';
  }
  }).join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${template.subject}</title>
        <style>
          body { 
            font-family: ${template.globalStyles.fontFamily}; 
            line-height: ${template.globalStyles.lineHeight}; 
            color: ${template.globalStyles.textColor}; 
            background-color: ${template.globalStyles.backgroundColor};
            margin: 0;
            padding: 20px;
      }
          .email-container {
            max-width: ${template.globalStyles.containerWidth}px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow: hidden;
            padding: 30px;
      }
          a { color: ${template.globalStyles.linkColor}; }
        </style>
      </head>
      <body>
        <div class="email-container">
          ${componentsHTML}
        </div>
      </body>
      </html>
    `;
};

  if (previewMode) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column'}}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>📧 Forhåndsvisning: {template.name}</Typography>
          <Button variant="outlined" onClick={() => setPreviewMode(false)}>
            Tilbake til redigering
          </Button>
        </Box>
        <Box sx={{ flex: 1, p: 2, backgroundColor: '#f5f5f5' }}>
          <Box
            dangerouslySetInnerHTML={{ __html: generateHTML() }}
            sx={{ height: '100%', overflow: 'auto' }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column'}}>
      {/* Top Toolbar */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0, ...theming.getThemedCardSx() }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Typography variant="h5" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
            <EmailIcon sx={{ color: 'primary.main'}} />
            E-postdesigner
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <IconButton><UndoIcon /></IconButton>
            <IconButton><RedoIcon /></IconButton>
            <Divider orientation="vertical" flexItem />
            <Button
              startIcon={<PreviewIcon />}
              variant="outlined"
              onClick={() => setPreviewMode(true)}
            >
              Forhåndsvis
            </Button>
            <Button
              startIcon={<SaveIcon />}
              variant="contained"
              color="primary"
              disabled={saveTemplateMutation.isPending}
              onClick={saveTemplate}
            >
              {saveTemplateMutation.isPending ? 'Lagrer...' : 'Lagre mal'}
            </Button>
            <Button
              startIcon={<SendIcon />}
              variant="contained"
              color="success"
            >
              Send test
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, display: 'flex'}}>
        {/* Left Panel - Components & Settings */}
        <Paper sx={{ width: 300, borderRadius: 0, ...theming.getThemedCardSx() }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider'}}>
            <Tab label="Komponenter" />
            <Tab label="Innstillinger" />
            <Tab label="Maler" />
          </Tabs>

          {/* Components Tab */}
          {activeTab === 0 && (
            <Box sx={{ p:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Legg til komponenter
              </Typography>
              <Grid container spacing={2}>
                {componentTypes.map((type) => (
                  <Grid item xs={6} key={type.id}>
                    <MuiCard
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'all 0.2','&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 4 }
                    }}
                      onClick={() => addComponent(type.id)}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2,...theming.getThemedCardSx() }}>
                        <Box sx={{ color: type.color, mb:  1 }}>
                          {type.icon}
                        </Box>
                        <Typography variant="caption" display="block">
                          {type.name}
                        </Typography>
                      </CardContent>
                    </MuiCard>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Settings Tab */}
          {activeTab === 1 && (
            <Box sx={{ p:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Global innstillinger
              </Typography>
              
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>E-postinfo</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Malnavn"
                      value={template.name}
                      onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <TextField
                      fullWidth
                      label="Emnelinje"
                      value={template.subject}
                      onChange={(e) => setTemplate(prev => ({ ...prev, subject: e.target.value }))}
                    />
                    <TextField
                      fullWidth
                      label="Preheader tekst"
                      value={template.preheader}
                      onChange={(e) => setTemplate(prev => ({ ...prev, preheader: e.target.value }))}
                    />
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Design</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      label="Bakgrunnsfarge"
                      type="color"
                      value={template.globalStyles.backgroundColor}
                      onChange={(e) => setTemplate(prev => ({
                        ...prev,
                        globalStyles: { ...prev.globalStyles, backgroundColor: e.target.value }
                    }))}
                    />
                    <TextField
                      fullWidth
                      label="Tekstfarge"
                      type="color"
                      value={template.globalStyles.textColor}
                      onChange={(e) => setTemplate(prev => ({
                        ...prev,
                        globalStyles: { ...prev.globalStyles, textColor: e.target.value }
                    }))}
                    />
                    <TextField
                      fullWidth
                      label="Lenkefarge"
                      type="color"
                      value={template.globalStyles.linkColor}
                      onChange={(e) => setTemplate(prev => ({
                        ...prev,
                        globalStyles: { ...prev.globalStyles, linkColor: e.target.value }
                    }))}
                    />
                    <FormControl fullWidth>
                      <InputLabel>Fontfamilie</InputLabel>
                      <Select
                        value={template.globalStyles.fontFamily}
                        onChange={(e) => setTemplate(prev => ({
                          ...prev,
                          globalStyles: { ...prev.globalStyles, fontFamily: e.target.value }
                      }))}
                      >
                        <MenuItem value="Arial, sans-serif">Arial</MenuItem>
                        <MenuItem value="Georgia, serif">Georgia</MenuItem>
                        <MenuItem value="'Helvetica Neue', sans-serif">Helvetica</MenuItem>
                        <MenuItem value="'Times New Roman', serif">Times New Roman</MenuItem>
                        <MenuItem value="Verdana, sans-serif">Verdana</MenuItem>
                      </Select>
                    </FormControl>
                    <Box>
                      <Typography gutterBottom>Fontstørrelse: {template.globalStyles.fontSize}px</Typography>
                      <Slider
                        value={template.globalStyles.fontSize}
                        onChange={(_, value) => setTemplate(prev => ({
                          ...prev,
                          globalStyles: { ...prev.globalStyles, fontSize: value as number }
                      }))}
                        min={10}
                        max={24}
                        step={1}
                      />
                    </Box>
                    <Box>
                      <Typography gutterBottom>Container bredde: {template.globalStyles.containerWidth}px</Typography>
                      <Slider
                        value={template.globalStyles.containerWidth}
                        onChange={(_, value) => setTemplate(prev => ({
                          ...prev,
                          globalStyles: { ...prev.globalStyles, containerWidth: value as number }
                      }))}
                        min={400}
                        max={800}
                        step={20}
                      />
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}

          {/* Templates Tab */}
          {activeTab === 2 && (
            <Box sx={{ p:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                E-postmaler ({emailTemplates?.length || 0})
              </Typography>
              <Alert severity="info" sx={{ mb:  2 }}>
                Velg en mal for å komme i gang raskt
              </Alert>
              
              {templatesLoading ? (
                <Box sx={{ textAlign: 'center', py:  4 }}>
                  <Typography>Laster maler...</Typography>
                </Box>
              ) : emailTemplates && emailTemplates.length > 0 ? (
                <Stack spacing={2}>
                  {emailTemplates.slice(0, 10).map((template: any, index: number) => (
                    <MuiCard 
                      key={template.id || index}
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'all 0.2', '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: 2 }
                    }}
                      onClick={() => loadTemplate(template)}
                    >
                      <CardContent sx={{ p: 2,...theming.getThemedCardSx() }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {template.name || `Template ${index + 1}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block'}}>
                          {template.subject || 'Ingen emnelinje'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px'}}>
                          Type: {template.template_type || 'general'}
                        </Typography>
                      </CardContent>
                    </MuiCard>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Ingen maler tilgjengelig
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        {/* Main Canvas */}
        <Box sx={{ flex: 1, p: 3, backgroundColor: '#f8f9fa', overflow: 'auto' }}>
          <Paper
            elevation={3}
            sx={{
              ...theming.getThemedCardSx(),
              maxWidth: template.globalStyles.containerWidth,
              margin: '0 auto',
              backgroundColor: 'white',
              borderRadius: 2,
              p: 4,
              minHeight: 600
            }}>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="email-components">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef}>
                {template.components.length === 0 ? (
                  <Box
                    sx={{
                      textAlign: 'center',
                      py:  8,
                      color: 'text.secondary',
                      border: '2px dashed',
                      borderColor: 'divider',
                      borderRadius: 2 }}
                  >
                    <EmailIcon sx={{ fontSize:  48, mb: 2, opacity: 0.5}} />
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      Start med å legge til komponenter
                    </Typography>
                    <Typography variant="body2">
                      Dra komponenter fra venstre panel for å bygge din e-post
                    </Typography>
                  </Box>
                ) : (
                  template.components.map((component, index) => (
                    <Draggable key={component.id} draggableId={component.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <SortableComponent
                            component={component}
                            onEdit={editComponent}
                            onDelete={deleteComponent}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))
                )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </Paper>
        </Box>
      </Box>

      {/* Component Edit Dialog */}
      <Dialog
        open={editDialog}
        onClose={() => setEditDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Rediger komponent: {componentTypes.find(t => t.id === selectedComponent?.type)?.name}
        </DialogTitle>
        <DialogContent>
          {selectedComponent && (
            <ComponentEditor
              component={selectedComponent}
              onChange={setSelectedComponent}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>
            Avbryt
          </Button>
          <Button
            variant="contained"
            sx={theming.getThemedButtonSx()}
            onClick={() => selectedComponent && updateComponent(selectedComponent)}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Buttons */}
      <Box
        sx={{
          position: 'fixed',
          bottom:  20,
          right:  20,
          display: 'flex',
          flexDirection: 'column',
          gap: 1 }}
      >
        <Fab
          color="primary"
          size="medium"
          onClick={() => setPreviewMode(true)}
        >
          <PreviewIcon />
        </Fab>
        <Fab
          color="secondary"
          size="medium"
          onClick={() => navigator.clipboard.writeText(generateHTML())}
        >
          <CodeIcon />
        </Fab>
      </Box>
    </Box>
  );
};

// Component Editor for detailed editing
const ComponentEditor: React.FC<{
  component: EmailComponent;
  onChange: (component: EmailComponent) => void
}> = ({ component, onChange }) => {
  const theming = useTheming('photographer');

  const updateContent = (key: string, value: any) => {
    onChange({
      ...component,
      content: { ...component.content, [key]: value }
  });
};

  const updateStyle = (key: string, value: any) => {
    onChange({
      ...component,
      styles: { ...component.styles, [key]: value }
  });
};

  return (
    <Stack spacing={3} sx={{ mt:  2 }}>
      {/* Content Settings */}
      <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Innhold
        </Typography>
        {(component.type === 'header' || component.type === 'text' || component.type === 'button' || component.type === 'footer') && (
          <TextField
            fullWidth
            label="Tekst"
            multiline={component.type === 'text'}
            rows={component.type === 'text' ? 3 : 1}
            value={component.content?.text || ''}
            onChange={(e) => updateContent('text', e.target.value)}
            sx={{ mb:  2 }}
          />
        )}
        
        {component.type === 'button' && (
          <TextField
            fullWidth
            label="Lenke URL"
            value={component.content?.url || ''}
            onChange={(e) => updateContent('url', e.target.value)}
          />
        )}

        {component.type === 'image' && (
          <>
            <TextField
              fullWidth
              label="Bilde URL"
              value={component.content?.src || ''}
              onChange={(e) => updateContent('src', e.target.value)}
              sx={{ mb:  2 }}
            />
            <TextField
              fullWidth
              label="Alt tekst"
              value={component.content?.alt || ''}
              onChange={(e) => updateContent('alt', e.target.value)}
            />
          </>
        )}
      </Paper>

      {/* Style Settings */}
      <Paper sx={{ p: 2,...theming.getThemedCardSx() }}>
        <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
          Design
        </Typography>
        
        <Grid container spacing={2}>
          {(component.type === 'header' || component.type === 'text' || component.type === 'footer') && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Farge"
                  type="color"
                  value={component.styles?.color || '#333333'}
                  onChange={(e) => updateStyle('color', e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Tekstjustering</InputLabel>
                  <Select
                    value={component.styles?.textAlign || 'left'}
                    onChange={(e) => updateStyle('textAlign', e.target.value)}
                  >
                    <MenuItem value="left">Venstre</MenuItem>
                    <MenuItem value="center">Sentrert</MenuItem>
                    <MenuItem value="right">Høyre</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          {component.type === 'button' && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Bakgrunnsfarge"
                  type="color"
                  value={component.styles?.backgroundColor || '#ff6b35'}
                  onChange={(e) => updateStyle('backgroundColor', e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Tekstfarge"
                  type="color"
                  value={component.styles?.color ||'#ffffff'}
                  onChange={(e) => updateStyle('color', e.target.value)}
                />
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <Typography gutterBottom>
              Margin bunn: {component.styles?.marginBottom || 16}px
            </Typography>
            <Slider
              value={component.styles?.marginBottom || 16}
              onChange={(_, value) => updateStyle('marginBottom', value as number)}
              min={0}
              max={60}
              step={4}
            />
          </Grid>
        </Grid>
      </Paper>
    </Stack>
  );
};

export default EmailDesigner;
