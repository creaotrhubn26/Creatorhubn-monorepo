import React, { useState, useCallback, useMemo, useReducer } from 'react';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTheming } from '@/utils/theming-helper';
import { apiRequest } from '@/lib/queryClient';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Dialog,
  Stack,
  Alert,
  Tooltip,
  Divider,
  Chip,
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Preview as PreviewIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  DragIndicator as DragIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ComponentStyles {
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold' | '600';
  fontSize?: number;
  padding?: number;
  margin?: number;
  borderRadius?: number;
  width?: string;
  height?: string | number;
}

interface ComponentContent {
  text?: string;
  src?: string;
  alt?: string;
  url?: string;
}

interface EmailComponent {
  id: string;
  type: 'header' | 'text' | 'button' | 'image' | 'divider' | 'footer' | 'social' | 'spacer';
  content: ComponentContent;
  styles: ComponentStyles;
}

interface GlobalStyles {
  backgroundColor: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
  containerWidth: number;
}

interface EmailTemplate {
  id?: string;
  name: string;
  category: string;
  subject: string;
  preheader: string;
  components: EmailComponent[];
  globalStyles: GlobalStyles;
}

interface TemplateVariable {
  key: string;
  label: string;
  description: string;
  category: 'user' | 'project' | 'business' | 'custom';
  defaultValue: string;
  example: string;
}

interface EmailDesignerState {
  components: EmailComponent[];
  history: EmailComponent[][];
  historyIndex: number;
  selectedComponent: EmailComponent | null;
  globalStyles: GlobalStyles;
  templateName: string;
  subject: string;
  preheader: string;
  customVariables: Record<string, string>;
  showVariablesPanel: boolean;
}

// ============================================================================
// REDUCER FOR STATE MANAGEMENT
// ============================================================================

type Action =
  | { type: 'ADD_COMPONENT'; component: EmailComponent }
  | { type: 'UPDATE_COMPONENT'; id: string; updates: Partial<EmailComponent> }
  | { type: 'DELETE_COMPONENT'; id: string }
  | { type: 'REORDER_COMPONENTS'; components: EmailComponent[] }
  | { type: 'SELECT_COMPONENT'; component: EmailComponent | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'UPDATE_GLOBAL_STYLES'; styles: Partial<GlobalStyles> }
  | { type: 'SET_TEMPLATE_META'; field: 'templateName' | 'subject' | 'preheader'; value: string }
  | { type: 'LOAD_TEMPLATE'; template: EmailTemplate }
  | { type: 'SET_CUSTOM_VARIABLE'; key: string; value: string }
  | { type: 'TOGGLE_VARIABLES_PANEL' };

function emailDesignerReducer(state: EmailDesignerState, action: Action): EmailDesignerState {
  switch (action.type) {
    case 'ADD_COMPONENT': const newComponents = [...state.components, action.component];
      return {
        ...state,
        components: newComponents,
        history: [...state.history.slice(0, state.historyIndex + 1), newComponents],
        historyIndex: state.historyIndex + 1 };

    case 'UPDATE_COMPONENT': const updatedComponents = state.components.map(c =>
        c.id === action.id ? { ...c, ...action.updates } : c
      );
      return {
        ...state,
        components: updatedComponents,
        history: [...state.history.slice(0, state.historyIndex + 1), updatedComponents],
        historyIndex: state.historyIndex + 1 };

    case 'DELETE_COMPONENT': const filteredComponents = state.components.filter(c => c.id !== action.id);
      return {
        ...state,
        components: filteredComponents,
        selectedComponent: state.selectedComponent?.id === action.id ? null : state.selectedComponent,
        history: [...state.history.slice(0, state.historyIndex + 1), filteredComponents],
        historyIndex: state.historyIndex + 1 };

    case 'REORDER_COMPONENTS': return {
        ...state,
        components: action.components,
        history: [...state.history.slice(0, state.historyIndex + 1), action.components],
        historyIndex: state.historyIndex + 1 };

    case 'SELECT_COMPONENT': return { ...state, selectedComponent: action.component };

    case 'UNDO': if (state.historyIndex > 0) {
        return {
          ...state,
          components: state.history[state.historyIndex - 1],
          historyIndex: state.historyIndex - 1 };
      }
      return state;

    case 'REDO': if (state.historyIndex < state.history.length - 1) {
        return {
          ...state,
          components: state.history[state.historyIndex + 1],
          historyIndex: state.historyIndex + 1 };
      }
      return state;

    case 'UPDATE_GLOBAL_STYLES': return {
        ...state,
        globalStyles: { ...state.globalStyles, ...action.styles }
      };

    case 'SET_TEMPLATE_META': return { ...state, [action.field]: action.value };

    case 'LOAD_TEMPLATE': return {
        ...state,
        components: action.template.components,
        globalStyles: action.template.globalStyles,
        templateName: action.template.name,
        subject: action.template.subject,
        preheader: action.template.preheader,
        history: [action.template.components],
        historyIndex: 0 };

    case 'SET_CUSTOM_VARIABLE': return {
        ...state,
        customVariables: { ...state.customVariables, [action.key]: action.value }
      };

    case 'TOGGLE_VARIABLES_PANEL': return { ...state, showVariablesPanel: !state.showVariablesPanel };

    default: return state;
  }
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_GLOBAL_STYLES: GlobalStyles = {
  backgroundColor: '#f5f5f5',
  fontFamily: 'Arial, sans-serif',
  fontSize: 14,
  lineHeight: 1.6
  textColor: '#333333',
  linkColor: '#ff6b35',
  containerWidth: 600 };

const COMPONENT_TYPES = [
  { id: 'header', name: 'Overskrift', icon: '📝', description: 'Store overskrifter' },
  { id: 'text', name: 'Tekst', icon: '📄', description: 'Brødtekst og avsnitt' },
  { id: 'button', name: 'Knapp', icon: '🔘', description: 'Call-to-action knapp' },
  { id: 'image', name: 'Bilde', icon: '🖼️', description: 'Bilder og grafikk' },
  { id: 'divider', name: 'Linje', icon: '➖', description: 'Horisontal skillelinje' },
  { id: 'social', name: 'Sosiale', icon: '📱', description: 'Sosiale medier lenker' },
  { id: 'spacer', name: 'Avstand', icon: '⬜', description: 'Vertikal spacing' },
  { id: 'footer', name: 'Footer', icon: '👣', description: 'Bunntekst' }
] as const;

// Template Variables System
const TEMPLATE_VARIABLES: TemplateVariable[] = [
  // User Variables
  { key: 'user_name', label: 'Bruker Navn', description: 'Fullt navn', category: 'user', defaultValue: 'Navn Navnesen', example: 'Ola Nordmann' },
  { key: 'user_first_name', label: 'Fornavn', description: 'Brukerens fornavn', category: 'user', defaultValue: 'Navn', example: 'Ola' },
  { key: 'user_last_name', label: 'Etternavn', description: 'Brukerens etternavn', category: 'user', defaultValue: 'Navnesen', example: 'Nordmann' },
  { key: 'user_email', label: 'E-post', description: 'Brukerens e-postadresse', category: 'user', defaultValue: 'epost@example.com', example: 'ola@example.com' },
  { key: 'user_phone', label: 'Telefon', description: 'Brukerens telefonnummer', category: 'user', defaultValue: '+47 123 45 678', example: '+47 987 65 432' },
  
  // Project Variables
  { key: 'project_name', label: 'Prosjektnavn', description: 'Navn på prosjektet', category: 'project', defaultValue: 'Mitt Prosjekt', example: 'Bryllup 2025' },
  { key: 'project_date', label: 'Prosjektdato', description: 'Dato for prosjektet', category: 'project', defaultValue: '15. Juni 2025', example: '20. August 2025' },
  { key: 'project_location', label: 'Sted', description: 'Lokasjon for prosjektet', category: 'project', defaultValue: 'Oslo', example: 'Bergen' },
  { key: 'project_type', label: 'Prosjekttype', description: 'Type prosjekt', category: 'project', defaultValue: 'Bryllup', example: 'Portrettfotografering' },
  { key: 'delivery_date', label: 'Leveringsdato', description: 'Når bildene leveres', category: 'project', defaultValue: '1. Juli 2025', example: '30. September 2025' },
  { key: 'gallery_link', label: 'Galleri-lenke', description: 'Link til bildegalleri', category: 'project', defaultValue: 'https://gallery.example.com', example: 'https://gallery.example.com/abc123' },
  
  // Business Variables
  { key: 'business_name', label: 'Bedriftsnavn', description: 'Navn på fotografbedriften', category: 'business', defaultValue: 'Mitt Fotofirma', example: 'Nordisk Foto AS' },
  { key: 'business_phone', label: 'Bedrift Telefon', description: 'Bedriftens telefonnummer', category: 'business', defaultValue: '+47 123 45 678', example: '+47 456 78 901' },
  { key: 'business_email', label: 'Bedrift E-post', description: 'Bedriftens e-postadresse', category: 'business', defaultValue: 'kontakt@firma.no', example: 'post@nordiskfoto.no' },
  { key: 'business_address', label: 'Adresse', description: 'Bedriftens adresse', category: 'business', defaultValue: 'Gateveien 1, 0123 Oslo', example: 'Storgata 15, 5015 Bergen' },
  { key: 'business_website', label: 'Nettside', description: 'Bedriftens nettside', category: 'business', defaultValue: 'www.firma.no', example: 'www.nordiskfoto.no' },
  { key: 'photographer_name', label: 'Fotograf Navn', description: 'Navnet på fotografen', category: 'business', defaultValue: 'Fotograf Fotografsen', example: 'Kari Fotograf' },
  
  // Norwegian Specific
  { key: 'org_number', label: 'Org.nr', description: 'Organisasjonsnummer', category: 'business', defaultValue: '123 456 789', example: '987 654 321' },
  { key: 'vat_number', label: 'MVA-nummer', description: 'MVA-registrert nummer', category: 'business', defaultValue: 'NO123456789MVA', example: 'NO987654321MVA' },
  
  // Common Phrases
  { key: 'greeting', label: 'Hilsen', description: 'Hilsen i starten', category: 'custom', defaultValue: 'Hei', example: 'Kjære' },
  { key: 'closing', label: 'Avslutning', description: 'Avslutningshilsen', category: 'custom', defaultValue: 'Med vennlig hilsen', example: 'Beste hilsener' },
  { key: 'signature', label: 'Signatur', description: 'Signaturlinje', category: 'custom', defaultValue: 'Fotograf Fotografsen', example: 'Kari Nordmann, Fotograf' }
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface EmailDesignerImprovedProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function EmailDesignerImproved({ 
  profession = 'photographer,' 
}: EmailDesignerImprovedProps) {
  const { user } = useAuth();
  const userProfession = profession || (user as any)?.profession || 'photographer';
  // Theming system - use dynamic profession instead of hardcoded value
  const theming = useTheming(userProfession);
  const queryClient = useQueryClient();

  const [state, dispatch] = useReducer(emailDesignerReducer, {
    components: [],
    history: [[]],
    historyIndex: 0,
    selectedComponent: null,
    globalStyles: DEFAULT_GLOBAL_STYLES,
    templateName: 'Ny mal',
    subject: '',
    preheader: '',
    customVariables: {},
    showVariablesPanel: false
  });

  const [showPreview, setShowPreview] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  // Replace template variables in text
  const replaceVariables = useCallback((text: string, variables: Record<string, string>) => {
    let result = text;
    TEMPLATE_VARIABLES.forEach(variable => {
      const value = variables[variable.key] || variable.defaultValue;
      result = result.replace(new RegExp(`{{${variable.key}}`, 'g,'), value);
    });
    return result;
  }, []);

  // ============================================================================
  // COMPONENT ACTIONS
  // ============================================================================

  const addComponent = useCallback((type: EmailComponent['type']) => {
    const newComponent: EmailComponent = {
      id: `component-${Date.now()}-${Math.random()}`,
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type)
    };
    dispatch({ type: 'ADD_COMPONENT', component: newComponent });
  }, []);

  const updateComponent = useCallback((id: string, updates: Partial<EmailComponent>) => {
    dispatch({ type: 'UPDATE_COMPONENT', id, updates });
  }, []);

  const deleteComponent = useCallback((id: string) => {
    dispatch({ type: 'DELETE_COMPONENT', id });
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(state.components);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    dispatch({ type: 'REORDER_COMPONENTS', components: items });
  }, [state.components]);

  // ============================================================================
  // SAVE & EXPORT
  // ============================================================================

  const saveMutation = useMutation({
    mutationFn: async () => {
      const template: EmailTemplate = {
        name: state.templateName,
        category: 'custom',
        subject: state.subject,
        preheader: state.preheader,
        components: state.components,
        globalStyles: state.globalStyles
      };
      return await apiRequest('/api/email-templates', {
        method: 'POST',
        body: JSON.stringify(template)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-templates'] });
      setShowSaveDialog(false);
    }
  });

  const exportAsHTML = useCallback(() => {
    const html = generateHTML(state.components, state.globalStyles);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.templateName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.components, state.globalStyles, state.templateName]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#fafafa' }}>
      {/* Toolbar */}
      <Paper elevation={2}, sx={{ p: 2, borderRadius: 0 }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Email Designer
            </Typography>
            <Chip label={`${state.components.length} komponenter`} size="small" />
          </Stack>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Angre (Ctrl+Z)">
              <span>
                <IconButton
                  size="small"
                  onClick={() => dispatch({ type: 'UNDO' })}
                  disabled={!canUndo}
                >
                  <UndoIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Gjør om (Ctrl+Y)">
              <span>
                <IconButton
                  size="small"
                  onClick={() => dispatch({ type: 'REDO' })}
                  disabled={!canRedo}
                >
                  <RedoIcon />
                </IconButton>
              </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            <Button
              startIcon={<PreviewIcon />}
              onClick={() => setShowPreview(!showPreview)}
              variant="outlined"
              size="small"
            >
              Forhåndsvisning
            </Button>

            <Button
              startIcon={<SaveIcon />}
              onClick={() => setShowSaveDialog(true)}
              variant="contained"
              size="small"
              sx={theming.getThemedButtonSx()}
            >
              Lagre
            </Button>

            <Button
              onClick={exportAsHTML}
              variant="outlined"
              size="small"
            >
              Eksporter HTML
            </Button>

            <Divider orientation="vertical" flexItem />

            <Tooltip title="Variabler">
              <IconButton
                size="small"
                onClick={() => dispatch({ type: 'TOGGLE_VARIABLES_PANEL' })}
                color={state.showVariablesPanel ? 'primary' : 'default'}
              >
                <CodeIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Component Palette */}
        <Paper sx={{ width: 250, p: 2, overflow: 'auto', borderRadius: 0 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
            Komponenter
          </Typography>
          <Stack spacing={1}>
            {COMPONENT_TYPES.map((type) => (
              <Tooltip key={type.id} title={type.description} placement="right">
                <Button
                  variant="outlined"
                  startIcon={<span>{type.icon}</span>}
                  onClick={() => addComponent(type.id as EmailComponent['type'])}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                  fullWidth
                >
                  {type.name}
                </Button>
              </Tooltip>
            ))}
          </Stack>
        </Paper>

        {/* Canvas */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: '#e0e0e0' }}>
          <Paper
            sx={{
              width: state.globalStyles.containerWidth,
              mx: 'auto',
              p: 3,
              minHeight: 500,
              bgcolor: state.globalStyles.backgroundColor
            }}>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="email-components">
                {(provided) => (
                  <Box
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    {state.components.length === 0 ? (
                      <Box
                        sx={{
                          p: 4,
                          textAlign: 'center',
                          border: '2px dashed #ccc',
                          borderRadius: 2,
                          color: '#666'}}>
                        <Typography variant="body2">
                          Dra komponenter hit for å begynne
                        </Typography>
                      </Box>
                    ) : (
                      state.components.map((component, index) => (
                        <Draggable
                          key={component.id}
                          draggableId={component.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <ComponentPreview
                              component={component}
                              provided={provided}
                              isDragging={snapshot.isDragging}
                              isSelected={state.selectedComponent?.id === component.id}
                              onSelect={() => dispatch({ type: 'SELECT_COMPONENT', component })}
                              onDelete={() => deleteComponent(component.id)}
                              theming={theming}
                            />
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </DragDropContext>
          </Paper>
        </Box>

        {/* Properties Panel */}
        {state.selectedComponent && (
          <Paper sx={{ width: 300, p: 2, overflow: 'auto', borderRadius: 0 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600}}>
              Egenskaper
            </Typography>
            <ComponentProperties
              component={state.selectedComponent}
              onUpdate={(updates) => updateComponent(state.selectedComponent!.id, updates)}
            />
          </Paper>
        )}

        {/* Variables Panel */}
        {state.showVariablesPanel && (
          <Paper sx={{ width: 350, p: 2, overflow: 'auto', borderRadius: 0 }}>
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600}}>
                  Template Variabler
                </Typography>
                <IconButton size="small" onClick={() => dispatch({ type: 'TOGGLE_VARIABLES_PANEL' })}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>

              <Alert severity="info" sx={{ fontSize: 12 }}>
                Bruk {{'{{'}variabel_navn{{'},'} i teksten din for å sette inn dynamisk innhold.
              </Alert>

              {['user', 'project', 'business','custom'].map(category => (
                <Box key={category}>
                  <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', color: 'text.secondary' }}>
                    {category === 'user' && '👤 Bruker'}
                    {category === 'project' && '📁 Prosjekt'}
                    {category === 'business' && '🏢 Bedrift'}
                    {category === 'custom' && '✨ Tilpasset'}
                  </Typography>
                  <Stack spacing={0.5}, sx={{ mt: 1 }}>
                    {TEMPLATE_VARIABLES.filter(v => v.category === category).map(variable => (
                      <Tooltip key={variable.key} title={variable.description} placement="left">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            // Copy variable syntax to clipboard
                            navigator.clipboard.writeText(`{{${variable.key}`);
                          }}

                          sx={{
                            justifyContent: 'space-between',
                            textTransform: 'none',
                            fontSize: 11 }}
                          fullWidth
                        >
                          <span>{variable.label}</span>
                          <Chip
                            label={`{{${variable.key}}`}
                            size="small"
                            sx={{ fontSize: 9, height: 18 }} />
                        </Button>
                      </Tooltip>
                    ))}
                  </Stack>
                </Box>
              ))}

              <Divider />

              <Typography variant="caption" sx={{ fontWeight: 600}}>
                Eksempel: </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f5f5f5' }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                  Hei {{'{{'}user_first_name{{'},'},<br />
                  Takk for din interesse i {{'{{'}project_type{{'},'}<br />
                  Dato: {{'{{'}project_date{{'},'}<br />
                  <br />
                  {{'{{'}closing{{'},'}<br />
                  {{'{{'}photographer_name{{'}'}
                </Typography>
              </Paper>
            </Stack>
          </Paper>
        )}
      </Box>
    </Box>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ComponentPreview = React.memo(({ component, provided, isDragging, isSelected, onSelect, onDelete, theming }: any) => {
  return (
    <Paper
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      elevation={isDragging ? 8 : isSelected ? 4 : 1}
      onClick={onSelect}
      sx={{
        p: 2,
        mb: 2,
        position: 'relative',
        cursor: 'pointer',
        border: isSelected ? `2px solid ${theming.colors.primary}` : '2px solid transparent','&:hover': {
          borderColor: theming.colors.primary'& .actions': { opacity: 1 }
        }}
      }
    >
      <Box className="actions" sx={{ position: 'absolute', top: 8, right: 8, opacity: 0, transition: 'opacity 0.2s' }}>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
      <RenderComponent component={component} />
    </Paper>
  );
});

const RenderComponent = ({ component }: { component: EmailComponent }) => {
  // Detect if text contains template variables
  const hasVariables = (text: string) => /{{\w+}/.test(text || ', ');
  
  const renderText = (text: string) => {
    if (hasVariables(text) {
      return (
        <Box component="span">
          {text.split(/({{\w+})/).map((part, i) => {
            if (part.match(/{{\w+}/) {
              return (
                <Chip
                  key={i}
                  label={part}
                  size="small"
                  sx={{ fontSize: 10, height: 18, mx: 0.5 }
                  color="primary"
                  variant="outlined"
                />
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </Box>
      );
    }
    return text;
  };

  // Simplified render logic
  switch (component.type) {
    case 'header': return <Typography variant="h4" style={{ ...component.styles }}>{renderText(component.content.text || 'Overskrift')}</Typography>;
    case 'text': return <Typography variant="body1" style={{ ...component.styles }}>{renderText(component.content.text || 'Tekst')}</Typography>;
    case 'button': return <Button variant="contained" style={{ ...component.styles }}>{renderText(component.content.text || 'Knapp')}</Button>;
    default: return <Box>Component: {component.type}</Box>;
  }
};

const ComponentProperties = ({ component, onUpdate }: any) => {
  return (
    <Stack spacing={2}>
      <TextField
        label="Tekst"
        value={component.content.text || ', '}
        onChange={(e) => onUpdate({ content: { ...component.content, text: e.target.value } })}}
        fullWidth
        size="small"
      />
      <TextField
        label="Farge"
        type="color"
        value={component.styles.color || '#333333'}
        onChange={(e) => onUpdate({ styles: { ...component.styles, color: e.target.value } })}}
        fullWidth
        size="small"
      />
    </Stack>
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultContent(type: EmailComponent['type']): ComponentContent {
  const defaults: Record<EmailComponent['type'], ComponentContent> = {
    header: { text: 'Overskrift' },
    text: { text: 'Dette er en tekstboks.' },
    button: { text: 'Klikk her', url: '#' },
    image: { src: '/api/placeholder/400/200', alt: 'Bilde' },
    divider: {},
    social: {},
    spacer: {},
    footer: { text: '© 2025 CreatorHub Norge' }
  };
  return defaults[type];
}

function getDefaultStyles(type: EmailComponent['type']): ComponentStyles {
  const defaults: Record<EmailComponent['type'], ComponentStyles> = {
    header: { color: '#333', fontSize: 24, fontWeight: 'bold', textAlign: 'left' },
    text: { color: '#333', fontSize: 14, textAlign: 'left' },
    button: { backgroundColor: '#ff6b35', color: '#ffffff', borderRadius: 8, padding: 12 },
    image: { width: '100%' },
    divider: { backgroundColor: '#e0e0e0', height: 1 },
    social: {},
    spacer: { height: 20 },
    footer: { color: '#666', fontSize: 12, textAlign: 'center' }
  };
  return defaults[type];
}

function generateHTML(components: EmailComponent[], globalStyles: GlobalStyles): string {
  // Simplified HTML generation
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: ${globalStyles.fontFamily}; background-color: ${globalStyles.backgroundColor}; }
  </style>
</head>
<body>
  <div style="max-width: ${globalStyles.containerWidth}px; margin: 0 auto;">
    ${components.map(c => `<div>${c.content.text ||', '}</div>`).join('\n')}
  </div>
</body>
</html>`;
}
