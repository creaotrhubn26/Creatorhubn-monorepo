// client/src/components/notes/FeatureTogglePanel.tsx
import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Paper,
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Slider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  ExpandMore,
  Settings,
  Save,
  Restore,
  Info,
  Warning,
  CheckCircle,
  Cancel,
  AutoAwesome,
  Psychology,
  List as ListIcon,
  Search,
  RecordVoiceOver,
  Translate,
  Summarize,
  Code,
  Notes,
  Person,
  Folder,
  Description,
  Api,
  Article,
  Timeline,
  Speed as Speed,
  Style,
  Spellcheck as Grammar,
  Timeline as Flow,
  MenuBook as Vocabulary,
  AccountTree as Structure,
  TuneOutlined as Tone,
  Mic,
  VolumeUp as VolumeUpUp,
  Help,
  Refresh,
  Download,
  Upload,
} from '@mui/icons-material';

export interface FeatureToggleConfig {
  // Core Features
  enableMentions: boolean;
  enableTableOfContents: boolean;
  enableAIWritingSuggestions: boolean;
  enableSpeechRecognition: boolean;
  enableTextToSpeech: boolean;
  enableVoiceCommands: boolean;
  enableContextAwareMentions: boolean;
  
  // AI Features
  enableNeuralEngine: boolean;
  enableGrammarChecking: boolean;
  enableStyleEnhancement: boolean;
  enableFlowImprovement: boolean;
  enableVocabularyExpansion: boolean;
  enableAutoCompletion: boolean;
  enableSmartSuggestions: boolean;
  enableLearning: boolean;
  
  // Speech Features
  enableContinuousListening: boolean;
  enableAutoPunctuation: boolean;
  enableWordTimings: boolean;
  enableInterimResults: boolean;
  enableNoiseSuppression: boolean;
  enableEchoCancellation: boolean;
  enableVoiceFeedback: boolean;
  enableVoiceNavigation: boolean;
  
  // TOC Features
  enableAutoGeneration: boolean;
  enableReadingProgress: boolean;
  enableSmoothScroll: boolean;
  enableSearchInTOC: boolean;
  enableCollapse: boolean;
  enableMetadata: boolean;
  enableWordCount: boolean;
  enableReadingTime: boolean;
  
  // Mention Features
  enableAutoDetection: boolean;
  enableContextMatching: boolean;
  enableSmartSearch: boolean;
  enableCategoryFiltering: boolean;
  enableRecentMentions: boolean;
  enableFrequentMentions: boolean;
  enableMentionHistory: boolean;
  
  // UI Features
  enableFloatingPanels: boolean;
  enableKeyboardShortcuts: boolean;
  enableTooltips: boolean;
  enableAnimations: boolean;
  enableDarkMode: boolean;
  enableCompactMode: boolean;
  enableFullscreen: boolean;
  enableMultiWindow: boolean;
  
  // Advanced Features
  enableOfflineMode: boolean;
  enableSync: boolean;
  enableBackup: boolean;
  enableVersionControl: boolean;
  enableCollaboration: boolean;
  enableRealTimeEditing: boolean;
  enableConflictResolution: boolean;
  enableAuditLog: boolean
}

interface FeatureTogglePanelProps {
  config: FeatureToggleConfig;
  onConfigChange: (config: FeatureToggleConfig) => void;
  onResetToDefaults: () => void;
  onExportConfig: () => void;
  onImportConfig: (config: FeatureToggleConfig) => void;
  className?: string;
  variant?: 'sidebar' | 'floating' | 'embedded' | 'dialog';
  showAdvanced?: boolean;
  showDescriptions?: boolean
}

const DEFAULT_CONFIG: FeatureToggleConfig = {
  // Core Features
  enableMentions: true,
  enableTableOfContents: true,
  enableAIWritingSuggestions: true,
  enableSpeechRecognition: true,
  enableTextToSpeech: true,
  enableVoiceCommands: true,
  enableContextAwareMentions: true,
  
  // AI Features
  enableNeuralEngine: true,
  enableGrammarChecking: true,
  enableStyleEnhancement: true,
  enableFlowImprovement: true,
  enableVocabularyExpansion: true,
  enableAutoCompletion: true,
  enableSmartSuggestions: true,
  enableLearning: true,
  
  // Speech Features
  enableContinuousListening: false,
  enableAutoPunctuation: true,
  enableWordTimings: true,
  enableInterimResults: true,
  enableNoiseSuppression: true,
  enableEchoCancellation: true,
  enableVoiceFeedback: true,
  enableVoiceNavigation: true,
  
  // TOC Features
  enableAutoGeneration: true,
  enableReadingProgress: true,
  enableSmoothScroll: true,
  enableSearchInTOC: true,
  enableCollapse: true,
  enableMetadata: true,
  enableWordCount: true,
  enableReadingTime: true,
  
  // Mention Features
  enableAutoDetection: true,
  enableContextMatching: true,
  enableSmartSearch: true,
  enableCategoryFiltering: true,
  enableRecentMentions: true,
  enableFrequentMentions: true,
  enableMentionHistory: true,
  
  // UI Features
  enableFloatingPanels: true,
  enableKeyboardShortcuts: true,
  enableTooltips: true,
  enableAnimations: true,
  enableDarkMode: false,
  enableCompactMode: false,
  enableFullscreen: true,
  enableMultiWindow: false,
  
  // Advanced Features
  enableOfflineMode: false,
  enableSync: true,
  enableBackup: true,
  enableVersionControl: false,
  enableCollaboration: false,
  enableRealTimeEditing: false,
  enableConflictResolution: false,
  enableAuditLog: false,
};

const FEATURE_CATEGORIES = [
  {
    id: 'core',
    title: 'Kjernefunksjoner',
    icon: theming.getThemedIcon(''),
    color: 'primary' as const,
    features: [
      { key: 'enableMentions', label: 'Nevn-system', description: 'Aktiver @ nevninger for sider, komponenter, notater, etc.' },
      { key: 'enableTableOfContents', label: 'Innholdsfortegnelse', description: 'Automatisk generert innholdsfortegnelse',},
      { key: 'enableAIWritingSuggestions', label: 'AI Skriveforslag', description: 'Intelligente forslag for tekstforbedring',},
      { key: 'enableSpeechRecognition', label: 'Talegjenkjenning', description: 'Konverter tale til tekst',},
      { key: 'enableTextToSpeech', label: 'Tekst til tale', description: 'Les tekst høyt',},
      { key: 'enableVoiceCommands', label: 'Stemmekommandoer', description: 'Kontroller applikasjonen med stemme',},
      { key: 'enableContextAwareMentions', label: 'Kontekstbevisste nevninger', description: 'Forstå naturlig språk for nevninger',},
    ],
},
  {
    id: 'ai',
    title: 'AI-funksjoner',
    icon: <Psychology />,
    color: 'secondary' as const,
    features: [
      { key: 'enableNeuralEngine', label: 'Neural Engine', description: 'Lærende AI-motor for skrivestil',},
      { key: 'enableGrammarChecking', label: 'Grammatikk-sjekk', description: 'Automatisk grammatikk-kontroll',},
      { key: 'enableStyleEnhancement', label: 'Stilforbedring', description: 'Forbedre skrivestil og tone',},
      { key: 'enableFlowImprovement', label: 'Flytforbedring', description: 'Forbedre tekstflyt og struktur',},
      { key: 'enableVocabularyExpansion', label: 'Ordforrådsutvidelse', description: 'Foreslå bedre ordvalg',},
      { key: 'enableAutoCompletion', label: 'Auto-fullføring', description: 'Automatisk fullføring av setninger',},
      { key: 'enableSmartSuggestions', label: 'Smarte forslag', description: 'Kontekstuelle AI-forslag',},
      { key: 'enableLearning', label: 'Læring', description: 'Lær fra brukerens skrivemønstre',},
    ],
},
  {
    id: 'speech',
    title: 'Stemme-funksjoner',
    icon: <RecordVoiceOver />,
    color: 'info' as const,
    features: [
      { key: 'enableContinuousListening', label: 'Kontinuerlig lytte', description: 'Lyt kontinuerlig uten å stoppe',},
      { key: 'enableAutoPunctuation', label: 'Automatisk tegnsetting', description: 'Legg til tegnsetting automatisk',},
      { key: 'enableWordTimings', label: 'Ord-timing', description: 'Vis timing for hvert ord',},
      { key: 'enableInterimResults', label: 'Mellomresultater', description: 'Vis resultater mens du snakker',},
      { key: 'enableNoiseSuppression', label: 'Støydemping', description: 'Reduser bakgrunnsstøy',},
      { key: 'enableEchoCancellation', label: 'Ekkokansellering', description: 'Fjern ekko fra lyd',},
      { key: 'enableVoiceFeedback', label: 'Stemme-tilbakemelding', description: 'Gi tilbakemelding med stemme',},
      { key: 'enableVoiceNavigation', label: 'Stemmenavigasjon', description: 'Naviger med stemmekommandoer',},
    ],
},
  {
    id: 'toc',
    title: 'Innholdsfortegnelse',
    icon: <ListIcon />,
    color: 'success' as const,
    features: [
      { key: 'enableAutoGeneration', label: 'Auto-generering', description: 'Generer TOC automatisk fra innhold',},
      { key: 'enableReadingProgress', label: 'Lesefremgang', description: 'Vis hvor langt du har lest',},
      { key: 'enableSmoothScroll', label: 'Smooth scroll', description: 'Glatt scrolling til seksjoner',},
      { key: 'enableSearchInTO', label: 'Søk i TO', description: 'Søk i innholdsfortegnelse',},
      { key: 'enableCollapse', label: 'Skjul/vis', description: 'Skjul og vis seksjoner',},
      { key: 'enableMetadata', label: 'Metadata', description: 'Vis ekstra informasjon om seksjoner',},
      { key: 'enableWordCount', label: 'Ordtelling', description: 'Vis antall ord per seksjon',},
      { key: 'enableReadingTime', label: 'Lesetid', description: 'Vis estimert lesetid',},
    ],
},
  {
    id: 'mentions',
    title: 'Nevn-system',
    icon: theming.getThemedIcon(''),
    color: 'warning' as const,
    features: [
      { key: 'enableAutoDetection', label: 'Auto-deteksjon', description: 'Detekter nevninger automatisk',},
      { key: 'enableContextMatching', label: 'Kontekstmatching', description: 'Match nevninger basert på kontekst',},
      { key: 'enableSmartSearch', label: 'Smart sø', description: 'Intelligent søk i nevninger',},
      { key: 'enableCategoryFiltering', label: 'Kategorifiltrering', description: 'Filtrer nevninger etter kategori',},
      { key: 'enableRecentMentions', label: 'Nylige nevninger', description: 'Vis nylig brukte nevninger',},
      { key: 'enableFrequentMentions', label: 'Hyppige nevninger', description: 'Vis ofte brukte nevninger',},
      { key: 'enableMentionHistory', label: 'Nevningshistorikk', description: 'Lagre historikk over nevninger',},
    ],
},
  {
    id: 'ui',
    title: 'Brukergrensesnitt',
    icon: <Style />,
    color: 'default' as const,
    features: [
      { key: 'enableFloatingPanels', label: 'Flytende paneler', description: 'La paneler flyte over innholdet',},
      { key: 'enableKeyboardShortcuts', label: 'Tastatursnarveier', description: 'Aktiver tastatursnarveier',},
      { key: 'enableTooltips', label: 'Verktøytips', description: 'Vis hjelpetekst på hover',},
      { key: 'enableAnimations', label: 'Animasjoner', description: 'Aktiver overganger og animasjoner',},
      { key: 'enableDarkMode', label: 'Mørk modus', description: 'Aktiver mørk tema',},
      { key: 'enableCompactMode', label: 'Kompakt modus', description: 'Kompakt visning for mindre skjermer',},
      { key: 'enableFullscreen', label: 'Fullskjerm', description: 'Aktiver fullskjerm-modus',},
      { key: 'enableMultiWindow', label: 'Flere vinduer', description: 'Støtt flere vinduer',},
    ],
},
  {
    id: 'advanced',
    title: 'Avanserte funksjoner',
    icon: <Code />,
    color: 'error' as const,
    features: [
      { key: 'enableOfflineMode', label: 'Offline-modus', description: 'Funger uten internett-tilkobling',},
      { key: 'enableSync', label: 'Synkronisering', description: 'Synkroniser data på tvers av enheter',},
      { key: 'enableBackup', label: 'Sikkerhetskopi', description: 'Automatisk sikkerhetskopi',},
      { key: 'enableVersionControl', label: 'Versjonskontroll', description: 'Spor endringer over tid',},
      { key: 'enableCollaboration', label: 'Samarbeid', description: 'Samarbeid i sanntid',},
      { key: 'enableRealTimeEditing', label: 'Sanntidsredigering', description: 'Rediger samtidig med andre',},
      { key: 'enableConflictResolution', label: 'Konfliktløsning', description: 'Løs redigeringskonflikter',},
      { key: 'enableAuditLog', label: 'Revisjonslogg', description: 'Logg alle endringer',},
    ],
},
];

export default function FeatureTogglePanel({
  config,
  onConfigChange,
  onResetToDefaults,
  onExportConfig,
  onImportConfig,
  className,
  variant = 'sidebar',
  showAdvanced = false,
  showDescriptions = true,
}: FeatureTogglePanelProps) {
  const [localConfig, setLocalConfig] = useState<FeatureToggleConfig>(config);
  const [showImportDialog, setShowImportDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [importConfig, setImportConfig] = useState<string>(', ');
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['core', 'ai']);

  useEffect(() => {
    setLocalConfig(config);
    setHasChanges(false);
}, [config]);

  const handleToggle = (key: keyof FeatureToggleConfig, value: boolean) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    setHasChanges(true);
};

  const handleSave = () => {
    onConfigChange(localConfig);
    setHasChanges(false);
};

  const handleReset = () => {
    setLocalConfig(DEFAULT_CONFIG);
    setHasChanges(true);
};

  const handleCategoryToggle = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
};

  const handleImport = () => {
    try {
      const parsedConfig = JSON.parse(importConfig);
      onImportConfig(parsedConfig);
      setShowImportDialog(false);
      setImportConfig(', ');
  } catch (error) {
      console.error('Invalid config format: ', error);
  }
};

  const getEnabledCount = (categoryId: string) => {
    const category = FEATURE_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return 0;
    
    return category.features.filter(feature => 
      localConfig[feature.key as keyof FeatureToggleConfig]
    ).length;
};

  const getTotalEnabledCount = () => {
    return Object.values(localConfig).filter(Boolean).length;
};

  const renderFeatureToggle = (feature: any) => (
    <ListItem key={feature.key} sx={{ py: 0.5}}>
      <ListItemIcon>
        <Switch
          checked={localConfig[feature.key as keyof FeatureToggleConfig] as boolean}
          onChange={(e) => handleToggle(feature.key, e.target.checked)}
          size="small"
        />
      </ListItemIcon>
      <ListItemText
        primary={feature.label}
        secondary={showDescriptions ? feature.description : undefined}
        primaryTypographyProps={{ variant: 'body2'}}
        secondaryTypographyProps={{ variant: 'caption'}}
      />
    </ListItem>
  );

  const renderCategory = (category: any) => {
    const isExpanded = expandedCategories.includes(category.id);
    const enabledCount = getEnabledCount(category.id);
    const totalCount = category.features.length;

    return (
      <Accordion
        key={category.id}
        expanded={isExpanded}
        onChange={() => handleCategoryToggle(category.id)}
        sx={{ mb:  1 }}
      >
        <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%'}}>
            <Box sx={{ color: `${category.color}.main` }}>
              {category.icon}
            </Box>
            <Typography variant="subtitle1" sx={{ flex:  1 }}>
              {category.title}
            </Typography>
            <Chip
              label={`${enabledCount}/${totalCount}`}
              size="small"
              color={enabledCount === totalCount ? 'success' : enabledCount > 0 ? 'primary' : 'default'}
              sx={{ fontSize: '0.75rem', height: 24}}
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt:  0 }}>
          <List dense>
            {category.features.map(renderFeatureToggle)}
          </List>
        </AccordionDetails>
      </Accordion>
    );
};

  const filteredCategories = showAdvanced 
    ? FEATURE_CATEGORIES 
    : FEATURE_CATEGORIES.filter(c => c.id !== 'advanced');

  return (
    <>
      <Paper
        className={className}
        elevation={variant === 'floating' ? 8 : 2}
        sx={{
          maxHeight: variant === 'embedded' ? '100%' : 60,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          ...(variant === 'floating' && {
            position: 'fixed',
            top:  20,
            right:  20,
            zIndex: 10,
            minWidth: 40,
            maxWidth: 50,
          }),
          ...theming.getThemedCardSx(),
        }}
      >
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider'}}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Settings color="primary" />
              <Typography variant="h6" component="h2" sx={{ color: theming.colors.primary }}>
                Funksjonsinnstillinger
              </Typography>
            </Stack>
            <Chip
              label={`${getTotalEnabledCount()} aktive`}
              color="primary"
              size="small"
            />
          </Stack>

          {hasChanges && (
            <Alert severity="warning" sx={{ mt:  1 }}>
              <AlertTitle>Ulagrede endringer</AlertTitle>
              Du har ulagrede endringer. Husk å lagre.
            </Alert>
          )}
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p:  1 }}>
          {filteredCategories.map(renderCategory)}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: 1, borderColor:'divider'}}>
          <Stack direction="row" spacing={1} justifyContent="space-between">
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={handleReset}
                startIcon={<Restore />}
                color="warning"
              >
                Tilbakestill
              </Button>
              <Button
                size="small"
                onClick={() => setShowImportDialog(true)}
                startIcon={theming.getThemedIcon('upload')}
              >
                Importer
              </Button>
              <Button
                size="small"
                onClick={onExportConfig}
                startIcon={theming.getThemedIcon('download')}
              >
                Eksporter
              </Button>
            </Stack>
            <Button variant="contained"
              onClick={handleSave}
              disabled={!hasChanges}
              startIcon={theming.getThemedIcon('save')}
             sx={theming.getThemedButtonSx()}>
              Lagre
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onClose={() => setShowImportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importer innstillinger</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={10}
            value={importConfig}
            onChange={(e) => setImportConfig(e.target.value)}
            placeholder="Lim inn JSON-konfigurasjon her..."
            variant="outlined"
            sx={{ mt:  1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowImportDialog(false)}>Avbryt</Button>
          <Button onClick={handleImport} variant="contained" sx={theming.getThemedButtonSx()}>
            Importer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
