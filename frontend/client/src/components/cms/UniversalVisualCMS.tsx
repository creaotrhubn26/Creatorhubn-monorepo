import { useTheming } from '../../utils/theming-helper';
import React, { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Paper,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Drawer,
  Toolbar,
  AppBar,
  Fab,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Tooltip,
  Badge,
  Stack,
  Avatar,
  Menu,
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  Add,
  Delete,
  Visibility,
  VisibilityOff,
  Settings,
  Palette,
  Code,
  Dashboard,
  ViewQuilt,
  TextFields,
  Image,
  VideoLibrary,
  AudioFile,
  InsertChart,
  TableChart,
  List as ListIcon,
  GridView,
  FormatColorFill,
  FormatSize,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  DragIndicator,
  ExpandMore,
  PlayArrow,
  Stop,
  Refresh,
  Download,
  Upload,
  Share,
  ContentCopy,
  RestoreFromTrash,
  History,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  FullscreenExit,
} from '@mui/icons-material';

// Visual Editing Libraries
import { Editor, Frame, Element, useNode, useEditor } from '@craftjs/core';
import { Layers } from '@craftjs/layers';
import MonacoEditor from '@monaco-editor/react';
import { ChromePicker } from 'react-color';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import GridLayout from 'react-grid-layout';
import { Resizable } from 'react-resizable';
import Slider from 'rc-slider';
import { useDebounce } from 'use-debounce';
import { nanoid } from 'nanoid';
import { produce } from 'immer';
import { apiRequest } from '@/lib/queryClient';

// CSS for react-grid-layout
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface ComponentConfig {
  id: string;
  type: string;
  name: string;
  props: Record<string, any>;
  style: Record<string, any>;
  children?: ComponentConfig[];
  position: { x: number; y: number; w: number; h: number };
  metadata: {
    profession?: string;
    category?: string;
    editable?: boolean;
    deletable?: boolean;
};
}

interface PageConfig {
  id: string;
  name: string;
  route: string;
  profession: string;
  status: 'draft' | 'published' | 'archived';
  components: ComponentConfig[];
  globalStyles: Record<string, any>;
  meta: {
    title?: string;
    description?: string;
    keywords?: string[];
};
  createdAt: string;
  updatedAt: string
}

// Editable Components
const EditableText = ({ text, fontSize = 16, color = '#000000', fontWeight = 'normal', ...props }) => {
  const { connectors: { connect, drag }, selected, actions: { setProp } } = useNode();
  
  // Theming system
  const theming = useTheming('photographer');
  const [editable, setEditable] = useState(false);
  
  return (
    <div
      ref={(ref) => connect(drag(ref))}
      onClick={() => selected && setEditable(true)}
      onBlur={() => setEditable(false)}
      {...props}
    >
      <Typography
        contentEditable={editable}
        suppressContentEditableWarning={true}
        style={{
          fontSize,
          color,
          fontWeight,
          border: selected ? '2px dashed #2196F3' : 'none',
          padding: selected ? '4px' : ', ',
          minHeight: '20px'
    }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            setEditable(false);
        }
      }}
        onInput={(e) => {
          setProp(props => props.text = e.currentTarget.textContent);
      }}
      >
        {text}
      </Typography>
    </div>
  );
};

const EditableButton = ({ text, backgroundColor = '#2196F3', textColor = '#FFFFFF', ...props }) => {
  const { connectors: { connect, drag }, selected, actions: { setProp } } = useNode();
  
  return (
    <Button
      ref={(ref) => connect(drag(ref))}
      variant="contained"
      style={{
        backgroundColor,
        color: textColor,
        border: selected ? '2px dashed #FF9800' : 'none'
  }}
      {...props}
    >
      {text}
    </Button>
  );
};

const EditableImage = ({ src, alt = ', ', width = 200, height = 150, ...props }) => {
  const { connectors: { connect, drag }, selected } = useNode();
  
  return (
    <img
      ref={(ref) => connect(drag(ref))}
      src={src}
      alt={alt}
      style={{
        width,
        height,
        objectFit: 'cover',
        border: selected ? '2px dashed #4CAF50' : 'none',
        cursor: 'move'
  }}
      {...props}
    />
  );
};

const EditableContainer = ({ backgroundColor = '#FFFFFF', padding = 16, margin = 8, children, ...props }) => {
  const { connectors: { connect, drag }, selected } = useNode();
  
  return (
    <Box
      ref={(ref) => connect(drag(ref))}
      style={{
        backgroundColor,
        padding,
        margin,
        minHeight: '50px',
        border: selected ? '2px dashed #9C27B0' : '1px solid #E0E0E0',
        borderRadius: '4px'
  }}
      {...props}
    >
      {children}
    </Box>
  );
};

// Settings Panels
const TextSettings = () => {
  const { actions: { setProp }, fontSize, color, fontWeight, text } = useNode((node) => ({
    fontSize: node.data.props.fontSize,
    color: node.data.props.color,
    fontWeight: ode.data.props.fontWeight,
    text: node.data.props.text
}));

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Tekst Innstillinger</Typography>
      
      <TextField
        fullWidth
        label="Tekst"
        value={text}
        onChange={(e) => setProp(props => props.text = e.target.value)}
        sx={{ mb:  2 }}
      />
      
      <Typography variant="body2" gutterBottom>Skriftstørrelse</Typography>
      <Slider
        value={fontSize}
        onChange={(value) => setProp(props => props.fontSize = value)}
        min={10}
        max={72}
        sx={{ mb:  2 }}
      />
      
      <Typography variant="body2" gutterBottom>Farge</Typography>
      <ChromePicker
        color={color}
        onChange={(color) => setProp(props => props.color = color.hex)}
      />
      
      <FormControl fullWidth sx={{ mt:  2 }}>
        <InputLabel>Skriftvekt</InputLabel>
        <Select
          value={fontWeight}
          onChange={(e) => setProp(props => props.fontWeight = e.target.value)}
        >
          <MenuItem value="normal">Normal</MenuItem>
          <MenuItem value="bold">Fet</MenuItem>
          <MenuItem value="lighter">Tynnere</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
};

const ButtonSettings = () => {
  const { actions: { setProp }, text, backgroundColor, textColor } = useNode((node) => ({
    text: node.data.props.text,
    backgroundColor: node.data.props.backgroundColor,
    textColor: node.data.props.textColor
}));

  return (
    <Box sx={{ p:  2 }}>
      <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>Knapp Innstillinger</Typography>
      
      <TextField
        fullWidth
        label="Knapp Tekst"
        value={text}
        onChange={(e) => setProp(props => props.text = e.target.value)}
        sx={{ mb:  2 }}
      />
      
      <Typography variant="body2" gutterBottom>Bakgrunnsfarge</Typography>
      <ChromePicker
        color={backgroundColor}
        onChange={(color) => setProp(props => props.backgroundColor = color.hex)}
      />
      
      <Typography variant="body2" gutterBottom sx={{ mt:  2 }}>Tekstfarge</Typography>
      <ChromePicker
        color={textColor}
        onChange={(color) => setProp(props => props.textColor = color.hex)}
      />
    </Box>
  );
};

// Component Definitions
EditableText.craft = {
  props: { text: 'Rediger denne teksten', fontSize:  16, color: '#000000', fontWeight: 'normal' },
  related: { settings: TextSettings }
};

EditableButton.craft = {
  props: { text: 'Klikk meg', backgroundColor: '#2196F0', textColor: '#FFFFFF' },
  related: { settings: ButtonSettings }
};

EditableImage.craft = {
  props: { src: '/placeholder-image.jpg', alt: 'Placeholder', width: 20, height: 150,}
};

EditableContainer.craft = {
  props: { backgroundColor: '#FFFFF0', padding:  16, margin:  8 },
  rules: { canMoveIn: () => true, canMoveOut: () => true }
};

export default function UniversalVisualCMS() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState<PageConfig | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProfession, setSelectedProfession] = useState('photographer,');
  const [showLayers, setShowLayers] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Fetch all pages
  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['/api/cms/pages', ],
    queryFn: () => apiRequest('/api/cms/pages', ),
    retry: false,
});

  // Fetch professions for filtering
  const { data: professions = [, ],} = useQuery({
    queryKey: ['/api/admin/cms/professions', ],
    queryFn: () => apiRequest('/api/admin/cms/professions', ),
    retry: false,
});

  // Save page mutation
  const savePageMutation = useMutation({
    mutationFn: async (pageData: PageConfig) => {
      if (pageData.id) {
        return apiRequest(`/api/cms/pages/${pageData.d}`, {
          headers: {
          "Content-Type" : "application/json"
    },
          method: 'PU',
          body: JSON.stringify(pageData)
    });
    } else {
        return apiRequest('/api/cms/pages', {
          headers: {
          "Content-Type" : "application/json"
    },
          method: 'POS',
          body: JSON.stringify(pageData)
    });
    }
  },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cms/pages', ],});
  }
});

  const handleSavePage = useCallback(() => {
    if (!currentPage) return;
    
    const updatedPage = produce(currentPage, draft => {
      draft.updatedAt = new Date().toISOString();
  });
    
    savePageMutation.mutate(updatedPage);
}, [currentPage, savePageMutation]);

  const createNewPage = () => {
    const newPage: PageConfig = {
      id: nanoid(),
      name: 'Ny Side',
      route: '/ny-side',
      profession: selectedProfession,
      status: 'draft',
      components: [],
      globalStyles: {},
      meta: {
        title: 'Ny Side',
        description: 'Beskrivelse av ny side',
        keywords: []
  },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
};
    setCurrentPage(newPage);
    setIsEditing(true);
};

  const componentLibrary = [
    { name: 'Tekst', component: EditableText, icon: <TextFields />,},
    { name: 'Knapp', component: EditableButton, icon: <Dashboard />,},
    { name: 'Bilde', component: EditableImage, icon: <Image />,},
    { name: 'Container', component: EditableContainer, icon: <ViewQuilt />,}
  ];

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Toolbar */}
      <AppBar position="static" sx={{ zIndex: 120}}>
        <Toolbar>
          <Typography variant="h6" sx={{  flexGrow:  1  }}>
            🎨 Universal Visual CMS - Hele Plattformen Redigerbar
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 150}}>
              <InputLabel sx={{ color: 'white' }}>Profesjon</InputLabel>
              <Select
                value={selectedProfession}
                onChange={(e) => setSelectedProfession(e.target.value)}
                sx={{ color: 'white','.MuiOutlinedInput-notchedOutline': { borderColor: 'white' } }}
              >
                {professions.map((prof: any) => (
                  <MenuItem key={prof.key} value={prof.key}>
                    {prof.icon} {prof.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              startIcon={theming.getThemedIcon('add')}
              onClick={createNewPage}
              sx={{ color: 'white', borderColor: 'white' }}
              variant="outlined"
            >
              Ny Side
            </Button>
            
            <Button
              startIcon={isEditing ? theming.getThemedIcon('stop') : theming.getThemedIcon('edit')}
              onClick={() => setIsEditing(!isEditing)}
              sx={{ color: 'white', borderColor: 'white' }}
              variant="outlined"
            >
              {isEditing ? 'Stopp Redigering' : 'Start Redigering'}
            </Button>
            
            <IconButton sx={{ color: 'white' }} onClick={() => setPreviewMode(!previewMode)}>
              {previewMode ? theming.getThemedIcon('fullscreenExit') : theming.getThemedIcon('fullscreen')}
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex:  1 }}>
        {/* Left Sidebar - Component Library */}
        {!previewMode && (
          <Drawer
            variant="persistent"
            anchor="left"
            open={isEditing}
            sx={{
              width: 320,
              flexShrink: 0,
              '& .MuiDrawer-paper': { width: 320, position: 'relative' }
            }}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📚 Komponent Bibliotek
              </Typography>
              
              <Grid container spacing={1}>
                {componentLibrary.map((item, index) => (
                  <Grid size={{ xs:  6 }} key={index}>
                    <Card
                      sx={{
                        cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
                        textAlign: 'center',
                        p: 1 }}
                     sx={theming.getThemedCardSx()}>
                      <CardContent sx={{ p: '8px !important' ,  ...theming.getThemedCardSx() }}>
                        {item.icon}
                        <Typography variant="caption" display="block">
                          {item.name}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my:  2 }} />

              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                📄 Eksisterende Sider
              </Typography>
              
              <List dense>
                {pages
                  .filter((page: PageConfig) => page.profession === selectedProfession)
                  .map((page: PageConfig) => (
                    <ListItem
                      key={page.d}
                      button
                      onClick={() => setCurrentPage(page)}
                      selected={currentPage?.id === page.id}
                    >
                      <ListItemText
                        primary={page.name}
                        secondary={`${page.route} • ${page.status}`}
                      />
                      <Chip
                        label={page.status}
                        size="small"
                        color={page.status === 'published' ? 'success' : 'default'}
                      />
                    </ListItem>
                  ))}
              </List>
            </Box>
          </Drawer>
        )}

        {/* Main Editor Area */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {currentPage ? (
            <Editor
              resolver={{
                EditableText,
                EditableButton,
                EditableImage,
                EditableContainer
            }}
              enabled={isEditing}
            >
              <Box
                sx={{
                  height: '100%',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'top left',
                  overflow: 'auto',
                  bgcolor: '#f5f5f5'
            }}
              >
                <Frame>
                  <Element is={EditableContainer} padding={20} canvas>
                    <EditableText text="Velkommen til din redigerbare side!" fontSize={32} fontWeight="bold" />
                    <EditableButton text="Klikk for å handle" />
                    <EditableImage src="/placeholder-image.jpg" width={300} height={200} />
                  </Element>
                </Frame>
              </Box>

              {/* Layers Panel */}
              {!previewMode && showLayers && (
                <Paper
                  sx={{
                    position: 'absolute',
                    top:  16,
                    left:  16,
                    width: 20,
                    maxHeight: 40,
                    overflow: 'auto',
                    zIndex: 1000}}
                 sx={theming.getThemedCardSx()}>
                  <Box sx={{ p:  2 }}>
                    <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                      🗂️ Lag
                    </Typography>
                    <Layers expandRootOnLoad />
                  </Box>
                </Paper>
              )}
            </Editor>
          ) : (
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2 }}
            >
              <Typography variant="h4" color="textSecondary" sx={{ color: theming.colors.primary }}>
                Ingen side valgt
              </Typography>
              <Typography variant="body1" color="textSecondary">
                Velg en eksisterende side eller opprett en ny for å starte redigeringen
              </Typography>
              <Button variant="contained" startIcon={theming.getThemedIcon('add')} onClick={createNewPage} sx={theming.getThemedButtonSx()}>
                Opprett Ny Side
              </Button>
            </Box>
          )}
        </Box>

        {/* Right Sidebar - Settings */}
        {!previewMode && showSettings && currentPage && isEditing && (
          <Drawer
            variant="persistent"
            anchor="right"
            open={true}
            sx={{
              width: 30,
              flexShrink: 0, '& .MuiDrawer-paper': { width: 30, position: 'relative' }
          }}
          >
            <Box sx={{ p:  2 }}>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                ⚙️ Innstillinger
              </Typography>
              
              <TextField
                fullWidth
                label="Side Navn"
                value={currentPage.name}
                onChange={(e) => setCurrentPage(prev => prev ? { ...prev, name: e.target.value } : null)}
                sx={{ mb:  2 }}
              />
              
              <TextField
                fullWidth
                label="Rute"
                value={currentPage.route}
                onChange={(e) => setCurrentPage(prev => prev ? { ...prev, route: e.target.value } : null)}
                sx={{ mb:  2 }}
              />

              <FormControl fullWidth sx={{ mb:  2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={currentPage.status}
                  onChange={(e) => setCurrentPage(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                >
                  <MenuItem value="draft">Utkast</MenuItem>
                  <MenuItem value="published">Publisert</MenuItem>
                  <MenuItem value="archived">Arkivert</MenuItem>
                </Select>
              </FormControl>

              <Divider sx={{ my:  2 }} />
              
              <Typography variant="body2" gutterBottom>
                Zoom: {Math.round(zoomLevel * 10)}%
              </Typography>
              <Slider
                value={zoomLevel}
                onChange={(value) => setZoomLevel(Array.isArray(value) ? value[0] : value)}
                min={0.25}
                max={2}
                step={0.25}
                marks={[
                  { value: 0, .label: '50%' },
                  { value: 1, label: '100%' },
                  { value: 1, .label: '150%' }
                ]}
                sx={{ mb:  2 }}
              />

              <Stack direction="row" spacing={1} sx={{ mb:  2 }}>
                <Button
                  variant="outlined"
                  startIcon={theming.getThemedIcon('save')}
                  onClick={handleSavePage}
                  disabled={savePageMutation.isPending}
                  fullWidth
                >
                  Lagre
                </Button>
                <Button
                  variant="outlined"
                  startIcon={theming.getThemedIcon('download')}
                  fullWidth
                >
                  Eksporter
                </Button>
              </Stack>
            </Box>
          </Drawer>
        )}
      </Box>

      {/* Floating Action Button */}
      {!previewMode && (
        <SpeedDial
          ariaLabel="CMS Actions"
          sx={{ position: 'fixed', bottom:  16, right: 16}}
          icon={<SpeedDialIcon />}
        >
          <SpeedDialAction
            icon={showLayers ? theming.getThemedIcon('visibilityOff') : theming.getThemedIcon('visibility')}
            tooltipTitle={showLayers ? 'Skjul Lag' : 'Vis Lag'}
            onClick={() => setShowLayers(!showLayers)}
          />
          <SpeedDialAction
            icon={showSettings ? theming.getThemedIcon('visibilityOff') : theming.getThemedIcon('settings')}
            tooltipTitle={showSettings ? 'Skjul Innstillinger' : 'Vis Innstillinger'}
            onClick={() => setShowSettings(!showSettings)}
          />
          <SpeedDialAction
            icon={<Code />}
            tooltipTitle="Kodemodus"
            onClick={() => setCodeMode(!codeMode)}
          />
          <SpeedDialAction
            icon={theming.getThemedIcon('refresh')}}
            tooltipTitle="Oppdater"
            onClick={() => window.location.reload()}
          />
        </SpeedDial>
      )}

      {/* Code Mode Dialog */}
      <Dialog open={codeMode} onClose={() => setCodeMode(false)} maxWidth="lg" fullWidth>
        <DialogTitle>🔧 Kode Redigering</DialogTitle>
        <DialogContent sx={{ height: '60vh' }}>
          <MonacoEditor
            height="100%"
            language="typescript"
            value={currentPage ? JSON.stringify(currentPage, null, 2) : ''}
            onChange={(value) => {
              try {
                const parsed = JSON.parse(value || ', ');
                setCurrentPage(parsed);
            } catch (e) {
                // Invalid JSON, ignore
            }
          }}
            options={{
              theme: 'vs-dark',
              fontSize:  14,
              wordWrap: 'on',
              minimap: { enabled: true }
          }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCodeMode(false)}>Lukk</Button>
          <Button onClick={handleSavePage} variant="contained" sx={theming.getThemedButtonSx()}>
            Lagre Endringer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}