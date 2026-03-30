import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTheming } from '../../utils/theming-helper';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Settings,
  FolderOpen,
  ColorLens,
  Description as VideographyIconDescription,
  MusicNote as MusicProductionIcon,
  Movie,
  Business as CorporateIcon,
  AutoFixHigh,
  ExpandMore,
  Info,
  CheckCircle,
  Error,
  Warning,
  Refresh,
  Download,
  Upload,
  Save,
  Edit,
  Delete,
  Add,
  Search,
  FilterList as FilterListList,
  VideoFile,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface ScriptBankManagerProps {
  onScriptExecuted?: (result: any) => void;
  projectId?: string;
  onProjectCreated?: (project: any) => void
}

interface Script {
  name: string;
  description: string;
  parameters: string[];
  category: string;
  icon?: string;
  estimatedTime?: string;
  complexity?: 'easy' | 'medium' | 'advanced'
}

interface ScriptCategory {
  [key: string]: Script
}

interface ScriptBank {
  workflow: ScriptCategory;
  color: ScriptCategory;
  export: ScriptCategory;
  wedding: ScriptCategory;
  corporate: ScriptCategory;
  music_video: ScriptCategory;
  documentary: ScriptCategory
}

type ScriptBankCategoryKey = keyof ScriptBank;

export default function ScriptBankManager({ 
  onScriptExecuted, 
  projectId, 
  onProjectCreated 
}: ScriptBankManagerProps) {
  const theming = useTheming('videographer');
  const [activeTab, setActiveTab] = useState(0);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [scriptParameters, setScriptParameters] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Fetch available scripts
  const { data: scriptBank, isLoading: isLoadingScripts, refetch: refetchScripts } = useQuery<ScriptBank>({
    queryKey: ['/api/davinci-resolve/script-bank,', ],
    queryFn: () => apiRequest('/api/davinci-resolve/script-bank', ),
    refetchInterval: 3000,
});

  // Execute script mutation
  const executeScript = useMutation({
    mutationFn: async ({ category, scriptName, parameters }: { 
      category: string; 
      scriptName: string; 
      parameters: Record<string, any> 
  }) => {
      return apiRequest('/api/davinci-resolve/script-bank/execute', {
        headers: {
          "Content-Type" : "application/json"
    },
        method: 'POST',
        body: JSON.stringify({ category, scriptName, parameters }),
    });
  },
    onSuccess: (data: unknown) => {
      console.log('✅ Script executed successfully, :', data);
      onScriptExecuted?.(data);
      setShowScriptDialog(false);
      setScriptParameters({});
  },
    onError: (error: unknown) => {
      console.error('❌ Script execution failed, :', error);
  },
});

  // Get script categories for tabs
  const scriptCategories: Array<{
    key: ScriptBankCategoryKey;
    label: string;
    icon: React.ReactElement;
    color: string;
  }> = [
    { key: 'workflow', label: 'Workflow', icon: <PlayArrow />, color: '#2196f3',},
    { key: 'color', label: 'Color Grading', icon: <ColorLens />, color: '#ff9800',},
    { key: 'export', label: 'Export & Delivery', icon: <VideoFile />, color: '#4caf50',},
    { key: 'wedding', label: 'Wedding', icon: <AutoFixHigh />, color: '#e91e63',},
    { key: 'corporate', label: 'Corporate', icon: <CorporateIcon />, color: '#9c27b0',},
    { key: 'music_video', label: 'Music Video', icon: <MusicProductionIcon />, color: '#f44336',},
    { key: 'documentary', label: 'Documentary', icon: <Movie />, color: '#795548',},
  ];

  const getScriptIcon = (category: string) => {
    const categoryInfo = scriptCategories.find(cat => cat.key === category);
    return categoryInfo?.icon || theming.getThemedIcon('');
};

  const getScriptColor = (category: string) => {
    const categoryInfo = scriptCategories.find(cat => cat.key === category);
    return categoryInfo?.color || '#666';
};

  const handleScriptSelect = useCallback((script: Script, category: string) => {
    setSelectedScript(script);
    
    // Pre-fill parameters with project data if available
    const defaultParams: Record<string, any> = {};
    
    if (projectId) {
      defaultParams.project_id = projectId;
  }
    
    // Add category-specific defaults
    if (category === 'wedding') {
      defaultParams.client_info = {
        bride_name: '',
        groom_name: '',
        wedding_date: new Date().toLocaleDateString(),
    };
  } else if (category === 'corporate') {
      defaultParams.client_info = {
        company_name: '',
        project_type: '',
        date: new Date().toLocaleDateString(),
    };
  } else if (category === 'music_video') {
      defaultParams.music_info = {
        artist: '',
        song_title: '',
        date: new Date().toLocaleDateString(),
        song_duration: 20,
    };
  } else if (category === 'documentary') {
      defaultParams.doc_info = {
        title: '',
        subject: '',
        date: new Date().toLocaleDateString(),
        full_duration: 360,
    };
  }
    
    setScriptParameters(defaultParams);
    setShowScriptDialog(true);
}, [projectId]);

  const handleExecuteScript = useCallback(() => {
    if (!selectedScript) return;
    
    const category = scriptCategories[activeTab]?.key;
    if (!category) return;
    
    executeScript.mutate({
      category,
      scriptName: Object.keys(scriptBank?.[category] || {}).find(
        (key) => scriptBank?.[category]?.[key]?.name === selectedScript.name
      ) || '',
      parameters: scriptParameters,
  });
}, [selectedScript, activeTab, scriptParameters, scriptBank, executeScript]);

  const filteredScripts = React.useMemo(() => {
    if (!scriptBank) return {};
    
    const category = scriptCategories[activeTab]?.key;
    if (!category || !scriptBank[category]) return {};
    
    let scripts: ScriptCategory = scriptBank[category];
    
    // Filter by search term
    if (searchTerm) {
      const filtered: ScriptCategory = {};
      Object.entries(scripts).forEach(([key, script]) => {
        if (
          script.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          script.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          script.category.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          filtered[key] = script;
      }
    });
      scripts = filtered;
  }
    
    return scripts;
}, [scriptBank, activeTab, searchTerm]);

  if (isLoadingScripts) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p:  4 }}>
        <CircularProgress />
        <Typography variant="body2" sx={{ ml:  2 }}>
          Loading Script Bank...
        </Typography>
      </Box>
    );
}

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column'}}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb:  2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center'}}>
            <ColorLens sx={{ color: '#3b82f0', mr:  1 }} />
            <Typography variant="h5" sx={{  fontWeight: 'bold', color: theming.colors.primary }}>
              DaVinci Resolve Script Bank
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap:  1 }}>
            <Button
              startIcon={theming.getThemedIcon('refresh')}
              onClick={() => refetchScripts()}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>
          </Box>
        </Box>
        
        {/* Search and Filter */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center'}}>
          <TextField
            placeholder="Search scripts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex:  1 }}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary'}} />}}
          />
        </Box>
      </Box>

      {/* Script Categories Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider'}}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {scriptCategories.map((category, index) => (
            <Tab
              key={category.key}
              icon={category.icon}
              label={category.label}
              sx={{
                minHeight: 48, '&.Mui-selected': { color: category.color,
              }}}
            />
          ))}
        </Tabs>
      </Box>

      {/* Scripts List */}
      <Box sx={{ flex: 1, overflow: 'auto', p:  2 }}>
        {Object.keys(filteredScripts).length === 0 ? (
          <Box sx={{ textAlign: 'center', py:  4 }}>
            <Typography variant="h6" color="text.secondary" sx={{ color: theming.colors.primary }}>
              No scripts found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your search or select a different category
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {Object.entries(filteredScripts).map(([key, script]) => (
              <Grid item xs={12} key={key}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.2', '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow:  3,
                  }}}
                  onClick={() => handleScriptSelect(script, scriptCategories[activeTab].key)}
                >
                  <CardContent sx={{ flex:  1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb:  1 }}>
                      <Box
                        sx={{
                          color: getScriptColor(scriptCategories[activeTab].key),
                          mr:  1}}
                      >
                        {getScriptIcon(scriptCategories[activeTab].key)}
                      </Box>
                      <Typography variant="h6" sx={{  fontWeight: 'bold', flex:  1  }}>
                        {script.name}
                      </Typography>
                      <Chip
                        label={script.complexity || 'medium'}
                        size="small"
                        color={
                          script.complexity === 'easy' ? 'success' :
                          script.complexity === 'advanced' ? 'error' : 'default'
                      }
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb:  2 }}>
                      {script.description}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0,mb:  2 }}>
                      <Chip
                        label={script.category}
                        size="small"
                        variant="outlined"
                        icon={<FolderOpen />}
                      />
                      {script.estimatedTime && (
                        <Chip
                          label={script.estimatedTime}
                          size="small"
                          variant="outlined"
                          icon={<PlayArrow fontSize="small" />}
                        />
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <Typography variant="caption" color="text.secondary">
                        {script.parameters.length} parameters
                      </Typography>
                      <Button
                        size="small"
                        startIcon={theming.getThemedIcon('play')}
                        sx={{ color: getScriptColor(scriptCategories[activeTab].key) }}
                      >
                        Execute
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Script Execution Dialog */}
      <Dialog
        open={showScriptDialog}
        onClose={() => setShowScriptDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center'}}>
            {selectedScript && getScriptIcon(scriptCategories[activeTab].key)}
            <Box sx={{ ml:  1 }}>
              <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                {selectedScript?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedScript?.description}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedScript && (
            <Box sx={{ mt:  2 }}>
              {/* Dynamic parameter inputs based on script type */}
              {scriptCategories[activeTab].key === 'wedding' && (
                <WeddingParametersForm
                  parameters={scriptParameters}
                  onChange={setScriptParameters}
                />
              )}
              
              {scriptCategories[activeTab].key === 'corporate' && (
                <CorporateParametersForm
                  parameters={scriptParameters}
                  onChange={setScriptParameters}
                />
              )}
              
              {scriptCategories[activeTab].key === 'music_video' && (
                <MusicVideoParametersForm
                  parameters={scriptParameters}
                  onChange={setScriptParameters}
                />
              )}
              
              {scriptCategories[activeTab].key === 'documentary' && (
                <DocumentaryParametersForm
                  parameters={scriptParameters}
                  onChange={setScriptParameters}
                />
              )}
              
              {/* Generic parameters for other script types */}
              {(scriptCategories[activeTab].key === 'workflow' || 
                scriptCategories[activeTab].key === 'color' || 
                scriptCategories[activeTab].key === 'export') && (
                <GenericParametersForm
                  script={selectedScript}
                  parameters={scriptParameters}
                  onChange={setScriptParameters}
                />
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowScriptDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleExecuteScript}
            variant="contained"
            disabled={executeScript.isPending}
            startIcon={
              executeScript.isPending ? (
                <CircularProgress size={16} sx={theming.getThemedButtonSx()} />
              ) : (
                theming.getThemedIcon('play')
              )
            }
            sx={{
              background: getScriptColor(scriptCategories[activeTab].key),
              '&:hover': {
                background: getScriptColor(scriptCategories[activeTab].key),
                opacity: 0.9,
              },
            }}
          >
            {executeScript.isPending ? 'Executing...': 'Execute Script'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Parameter Form Components
interface ParametersFormProps {
  parameters: Record<string, any>;
  onChange: (parameters: Record<string, any>) => void;
}

const WeddingParametersForm: React.FC<ParametersFormProps> = ({ parameters, onChange }) => {
  const theming = useTheming('videographer');
  const clientInfo = parameters.client_info || {};
  
  const handleClientInfoChange = (field: string, value: any) => {
    onChange({
      ...parameters,
      client_info: {
        ...clientInfo,
        [field]: value,
    },
  });
};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
      <Typography variant="h6" sx={{ color: theming.colors.primary }}>Wedding Information</Typography>
      
      <TextField
        label="Bride Name"
        value={clientInfo.bride_name || ''}
        onChange={(e) => handleClientInfoChange('bride_name', e.target.value)}
        fullWidth
      />
      
      <TextField
        label="Groom Name"
        value={clientInfo.groom_name || ''}
        onChange={(e) => handleClientInfoChange('groom_name', e.target.value)}
        fullWidth
      />
      
      <TextField
        label="Wedding Date"
        type="date"
        value={clientInfo.wedding_date || ''}
        onChange={(e) => handleClientInfoChange('wedding_date', e.target.value)}
        fullWidth
        InputLabelProps={{ shrink: true }}
      />
    </Box>
  );
};

const CorporateParametersForm: React.FC<ParametersFormProps> = ({ parameters, onChange }) => {
  const theming = useTheming('videographer');
  const clientInfo = parameters.client_info || {};
  
  const handleClientInfoChange = (field: string, value: any) => {
    onChange({
      ...parameters,
      client_info: {
        ...clientInfo,
        [field]: value,
    },
  });
};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
      <Typography variant="h6" sx={{ color: theming.colors.primary }}>Corporate Information</Typography>
      
      <TextField
        label="Company Name"
        value={clientInfo.company_name || ''}
        onChange={(e) => handleClientInfoChange('company_name', e.target.value)}
        fullWidth
      />
      
      <TextField
        label="Project Type"
        value={clientInfo.project_type || ', '}
        onChange={(e) => handleClientInfoChange('project_type', e.target.value)}
        fullWidth
      />
      
      <TextField
        label="Project Date"
        type="date"
        value={clientInfo.date || ', '}
        onChange={(e) => handleClientInfoChange('date', e.target.value)}
        fullWidth
        InputLabelProps={{ shrink: true }}
      />
    </Box>
  );
};

const MusicVideoParametersForm: React.FC<ParametersFormProps> = ({ parameters, onChange }) => {
  const theming = useTheming('videographer');
  const musicInfo = parameters.music_info || {};
  
  const handleMusicInfoChange = (field: string, value: any) => {
    onChange({
      ...parameters,
      music_info: {
        ...musicInfo,
        [field]: value,
    },
  });
};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
      <Typography variant="h6" sx={{ color: theming.colors.primary }}>Music Information</Typography>
      
      <TextField
        label="Artist"
        value={musicInfo.artist || ', '}
        onChange={(e) => handleMusicInfoChange('artist', e.target.value)}
        fullWidth
      />
      
      <TextField
        label="Song Title"
        value={musicInfo.song_title || ', '}
        onChange={(e) => handleMusicInfoChange('song_title', e.target.value)}
        fullWidth
      />
      
      <TextField
        label="Song Duration (seconds)"
        type="number"
        value={musicInfo.song_duration || 240}
        onChange={(e) => handleMusicInfoChange('song_duration', parseInt(e.target.value))}
        fullWidth
      />
      
      <TextField
        label="Project Date"
        type="date"
        value={musicInfo.date || ', '}
        onChange={(e) => handleMusicInfoChange('date', e.target.value)}
        fullWidth
        InputLabelProps={{ shrink: true }}
      />
    </Box>
  );
};

const DocumentaryParametersForm: React.FC<ParametersFormProps> = ({ parameters, onChange }) => {
  const theming = useTheming('videographer');
  const docInfo = parameters.doc_info || {};
  
  const handleDocInfoChange = (field: string, value: any) => {
    onChange({
      ...parameters,
      doc_info: {
        ...docInfo,
        [field]: value,
    },
  });
};

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
      <Typography variant="h6" sx={{ color: theming.colors.primary }}>Documentary Information</Typography>
      
      <TextField
        label="Documentary Title"
        value={docInfo.title || ', '}
        onChange={(e) => handleDocInfoChange('title', e.target.value)}
        fullWidth
      />
      
      <TextField
        label="Subject"
        value={docInfo.subject || ', '}
        onChange={(e) => handleDocInfoChange('subject', e.target.value)}
        fullWidth
      />
      
      <TextField
        label="Full Duration (seconds)"
        type="number"
        value={docInfo.full_duration || 3600}
        onChange={(e) => handleDocInfoChange('full_duration', parseInt(e.target.value))}
        fullWidth
      />
      
      <TextField
        label="Project Date"
        type="date"
        value={docInfo.date || ', '}
        onChange={(e) => handleDocInfoChange('date', e.target.value)}
        fullWidth
        InputLabelProps={{ shrink: true }}
      />
    </Box>
  );
};

const GenericParametersForm: React.FC<ParametersFormProps & { script: Script }> = ({
  script, 
  parameters, 
  onChange 
}) => {
  const theming = useTheming('videographer');
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap:  2 }}>
      <Typography variant="h6" sx={{ color: theming.colors.primary }}>Script Parameters</Typography>
      
      {script.parameters.map((param) => (
        <TextField
          key={param}
          label={param.replace(/_/g, '').replace(/\b\w/g, l => l.toUpperCase())}
          value={parameters[param] ||''}
          onChange={(e) => onChange({ ...parameters, [param]: e.target.value })}
          fullWidth
        />
      ))}
    </Box>
  );
};
