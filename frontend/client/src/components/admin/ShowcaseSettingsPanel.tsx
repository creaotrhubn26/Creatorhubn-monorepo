import React, { useState, useEffect } from 'react';
import { useDynamicProfessions } from '../universal/hooks/useDynamicProfessions';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Divider,
  Button,
  Alert,
  Snackbar,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  TextField,
  Tabs,
  Tab,
  Stack,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  Settings,
  Save,
  Refresh,
  Visibility,
  VisibilityOff,
  Download,
  Favorite,
  Comment,
  CheckCircle,
  Fullscreen,
  ViewModule,
  Search,
  PhoneAndroid,
  Speed as Speed,
  Palette,
  TouchApp,
  DataUsage,
  Security,
  Notifications,
  Tune,
  Edit,
} from '@mui/icons-material';
import { useAuth } from '../../hooks/useAuth';
import { useEnhancedMasterIntegration } from '../../integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { AdminButton } from './design-system';

interface ShowcaseSettings {
  // Button Visibility
  showDownloadButton: boolean;
  showFavoriteButton: boolean;
  showCommentButton: boolean;
  showSelectionButton: boolean;
  showFullscreenButton: boolean;
  showEditButton: boolean;
  enableContextMenu: boolean;
  showStatusText: boolean;
  compactMode: boolean;
  
  // Visual Layout
  cardSize: 'small' | 'medium' | 'large' | 'extra-large';
  gridColumns: 1 | 2 | 3 | 4 | 5 | 6;
  cardSpacing: 'tight' | 'normal' | 'loose';
  imageAspectRatio: 'square' | '16:9' | '4:3' | '3:2' | 'original';
  cardBorderRadius: 'none' | 'small' | 'medium' | 'large';
  cardShadow: 'none' | 'subtle' | 'medium' | 'strong';
  
  // Mobile Responsive
  mobileColumns: 1 | 2 | 3;
  touchGestures: boolean;
  mobileButtonSize: 'small' | 'medium' | 'large';
  compactMobileView: boolean;
  
  // Search & Filter
  searchBarPosition: 'top' | 'bottom' | 'hidden';
  showFilterBar: boolean;
  defaultSortBy: 'date' | 'name' | 'size' | 'type' | 'views' | 'likes';
  defaultSortOrder: 'asc' | 'desc';
  showQuickFilters: boolean;
  
  // Data Display
  showFileSize: boolean;
  showUploadDate: boolean;
  showViewCount: boolean;
  showLikeCount: boolean;
  showProfessionBadge: boolean;
  showAITags: boolean;
  maxItemsPerPage: 10 | 20 | 50 | 100 | 999;
  
  // Theme & Styling
  cardBackground: 'dark' | 'light' | 'transparent' | 'custom';
  accentColorMode: 'auto' | 'custom' | 'random';
  customAccentColor: string;
  buttonStyle: 'filled' | 'outlined' | 'text' | 'icon-only';
  animationSpeed: 'slow' | 'normal' | 'fast' | 'disabled';
  
  // Interaction & Behavior
  clickAction: 'fullscreen' | 'download' | 'select' | 'custom';
  hoverEffects: 'none' | 'glow' | 'scale' | 'fade';
  doubleClickAction: 'fullscreen' | 'download' | 'select';
  keyboardShortcuts: boolean;
  autoPlayVideos: boolean;
  lazyLoading: boolean;
  
  // Performance
  imageQuality: 'low' | 'medium' | 'high' | 'original';
  thumbnailSize: 'small' | 'medium' | 'large';
  cacheDuration: '1h' | '1d' | '1w' | '1m';
  preloadImages: 'none' | 'next3' | 'next5' | 'all';
  backgroundSync: boolean;
  
  // Security & Privacy
  watermark: 'none' | 'text' | 'logo' | 'both';
  watermarkPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  watermarkText: string;
  watermarkOpacity: number;
  watermarkSize: 'small' | 'medium' | 'large';
  
  // Audio Watermarking (for music producers)
  audioWatermarkEnabled: boolean;
  audioWatermarkMethod: 'steganography' | 'frequency' | 'echo' | 'phase';
  audioWatermarkStrength: 'low' | 'medium' | 'high';
  audioWatermarkFrequency: 'low' | 'medium' | 'high';
  
  downloadProtection: 'none' | 'password' | 'timelimit';
  viewTracking: boolean;
  shareRestrictions: 'public' | 'private' | 'custom';
  clientAccess: 'full' | 'limited' | 'readonly';
  
  // Notifications
  newItemAlerts: 'email' | 'push' | 'inapp' | 'none';
  downloadNotifications: boolean;
  favoriteNotifications: boolean;
  commentNotifications: boolean;
  soundEffects: boolean;
  
  // Advanced Features
  bulkActions: boolean;
  dragAndDrop: boolean;
  keyboardNavigation: boolean;
  voiceCommands: boolean;
  aiSuggestions: boolean;
  analyticsTracking: boolean;
  
  // Profession Suites
  enableAudioEnhancementSuite: boolean;
  enablePhotoEnhancementSuite: boolean;
  enableVideoEnhancementSuite: boolean;
  enableStoryArcStudio: boolean;
  professionSuiteAccess: 'all' | 'limited' | 'none';
}

interface ProjectShowcaseSettingsPayload {
  downloadProtectionLevel: 'none' | 'watermark' | 'disabled';
  accessLevel: 'public' | 'restricted' | 'private';
  enableDownloadProtection: boolean;
  pinRequired: boolean;
  passwordRequired: boolean;
  watermarkEnabled: boolean;
  watermarkPosition: ShowcaseSettings['watermarkPosition'];
  watermarkText: string;
  watermarkOpacity: number;
  watermarkSize: ShowcaseSettings['watermarkSize'];
}

const defaultSettings: ShowcaseSettings = {
  // Button Visibility
  showDownloadButton: true,
  showFavoriteButton: true,
  showCommentButton: true,
  showSelectionButton: true,
  showFullscreenButton: false,
  showEditButton: true,
  enableContextMenu: true,
  showStatusText: true,
  compactMode: false,
  
  // Visual Layout
  cardSize: 'medium',
  gridColumns:  3,
  cardSpacing: 'normal',
  imageAspectRatio: '16:9',
  cardBorderRadius: 'medium',
  cardShadow: 'medium',
  
  // Mobile Responsive
  mobileColumns:  2,
  touchGestures: true,
  mobileButtonSize: 'medium',
  compactMobileView: false,
  
  // Search & Filter
  searchBarPosition: 'top',
  showFilterBar: true,
  defaultSortBy: 'date',
  defaultSortOrder: 'desc',
  showQuickFilters: true,
  
  // Data Display
  showFileSize: true,
  showUploadDate: true,
  showViewCount: true,
  showLikeCount: true,
  showProfessionBadge: true,
  showAITags: false,
  maxItemsPerPage:  20,
  
  // Theme & Styling
  cardBackground: 'dark',
  accentColorMode: 'auto',
  customAccentColor: '#FF6B30',
  buttonStyle: 'outlined',
  animationSpeed: 'normal',
  
  // Interaction & Behavior
  clickAction: 'fullscreen',
  hoverEffects: 'scale',
  doubleClickAction: 'download',
  keyboardShortcuts: true,
  autoPlayVideos: false,
  lazyLoading: true,
  
  // Performance
  imageQuality: 'high',
  thumbnailSize: 'medium',
  cacheDuration: '1d',
  preloadImages: 'next3',
  backgroundSync: true,
  
  // Security & Privacy
  watermark: 'none',
  watermarkPosition: 'bottom-right',
  watermarkText: 'CreatorHub',
  watermarkOpacity:  70,
  watermarkSize: 'small',
  
  // Audio Watermarking (for music producers)
  audioWatermarkEnabled: false,
  audioWatermarkMethod: 'steganography',
  audioWatermarkStrength: 'medium',
  audioWatermarkFrequency: 'medium',
  
  downloadProtection: 'none',
  viewTracking: true,
  shareRestrictions: 'public',
  clientAccess: 'full',
  
  // Notifications
  newItemAlerts: 'inapp',
  downloadNotifications: false,
  favoriteNotifications: false,
  commentNotifications: true,
  soundEffects: false,
  
  // Advanced Features
  bulkActions: true,
  dragAndDrop: true,
  keyboardNavigation: true,
  voiceCommands: false,
  aiSuggestions: false,
  analyticsTracking: true,
  
  // Profession Suites
  enableAudioEnhancementSuite: true,
  enablePhotoEnhancementSuite: true,
  enableVideoEnhancementSuite: true,
  enableStoryArcStudio: true,
  professionSuiteAccess: 'all'
};

// Profession-specific watermark defaults
const getProfessionWatermarkDefaults = (profession: string): Partial<ShowcaseSettings> => {
  switch (profession) {
    case 'photographer':
      return {
        watermark: 'text',
        watermarkPosition: 'bottom-right',
        watermarkText: 'Fotograf: CreatorHub',
        watermarkOpacity:  60,
        watermarkSize: 'small'
  };
    case 'videographer':
      return {
        watermark: 'both',
        watermarkPosition: 'bottom-left',
        watermarkText: 'Videograf: CreatorHub',
        watermarkOpacity:  80,
        watermarkSize: 'medium'
  };
    case 'music_producer':
      return {
        watermark: 'none', // No visual watermark for music producers
        watermarkPosition: 'center',
        watermarkText: 'Musikprodusent: CreatorHub',
        watermarkOpacity:  70,
        watermarkSize: 'large',
        // Audio watermarking settings
        audioWatermarkEnabled: true,
        audioWatermarkMethod: 'steganography',
        audioWatermarkStrength: 'medium',
        audioWatermarkFrequency: 'high'
  };
    case 'vendor':
      return {
        watermark: 'text',
        watermarkPosition: 'top-right',
        watermarkText: 'Leverandør: CreatorHub',
        watermarkOpacity:  50,
        watermarkSize: 'small'
  };
    default: return {
        watermark: 'none',
        watermarkPosition: 'bottom-right',
        watermarkText: 'CreatorHub',
        watermarkOpacity:  70,
        watermarkSize: 'small'
  };
}
};

interface ShowcaseSettingsPanelProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

export function ShowcaseSettingsPanel({ profession = 'photographer' }: ShowcaseSettingsPanelProps) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ShowcaseSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  
  // Master Integration Provider
  const { features } = useEnhancedMasterIntegration();
  
  // Theming system
  const theming = useTheming('prototype_tester');
  
  // Dynamic profession system
  const { getProfessionDisplayName } = useDynamicProfessions();
  
  // Comprehensive Feature System for profession suites
  const audioSuiteAccess = features.checkFeatureAccess('audio-enhancement-suite');
  const photoSuiteAccess = features.checkFeatureAccess('photo-enhancement-suite');
  const videoSuiteAccess = features.checkFeatureAccess('video-enhancement-suite');
  const storyArcAccess = features.checkFeatureAccess('story-arc-studio');
  const professionSuitesAccess = features.checkFeatureAccess('profession-suites');
  
  const isAudioSuiteEnabled = audioSuiteAccess.hasAccess;
  const isPhotoSuiteEnabled = photoSuiteAccess.hasAccess;
  const isVideoSuiteEnabled = videoSuiteAccess.hasAccess;
  const isStoryArcEnabled = storyArcAccess.hasAccess;
  const isProfessionSuitesEnabled = professionSuitesAccess.hasAccess;
  
  // Load project-level showcase settings as defaults
  const loadProjectShowcaseSettings = () => {
    try {
      // Try to get project showcase settings from localStorage or context
      const projectShowcaseSettings = localStorage.getItem('project-showcase-settings');
      if (projectShowcaseSettings) {
        const projectSettings = JSON.parse(projectShowcaseSettings);
        return {
          ...defaultSettings,
          // Map project-level settings to UI settings
          downloadProtection: (projectSettings.downloadProtectionLevel === 'none' ? 'none' :
                             projectSettings.downloadProtectionLevel === 'watermark' ? 'password' :
                             projectSettings.downloadProtectionLevel === 'disabled' ? 'timelimit' : 'none') as 'none' | 'password' | 'timelimit',
          watermark: (projectSettings.downloadProtectionLevel === 'watermark' ? 'both' : 'none') as 'none' | 'text' | 'logo' | 'both',
          watermarkPosition: 'bottom-right' as const,
          watermarkText: 'CreatorHub',
          watermarkOpacity:  70,
          watermarkSize: 'small' as const,
          // Use project access level to determine client access
          clientAccess: (projectSettings.accessLevel === 'public' ? 'full' :
                       projectSettings.accessLevel === 'restricted' ? 'limited' :
                       projectSettings.accessLevel === 'private' ? 'readonly' : 'full') as 'full' | 'limited' | 'readonly'
    };
    }
  } catch (error) {
      console.error('Failed to load project showcase settings:', error);
  }
    return defaultSettings;
};

  // Load settings from server (fallback to localStorage), with project and profession defaults
  useEffect(() => {
    const load = async () => {
      const professionDefaults = getProfessionWatermarkDefaults(profession);

      // Load project defaults server-first
      let projectDefaults = loadProjectShowcaseSettings();
      try {
        const resProj = await fetch('/api/user/kv/project-showcase-settings', { credentials: 'include' });
        const jProj = resProj.ok ? await resProj.json().catch(() => null) : null;
        const vProj = jProj && typeof jProj === 'object' && 'value' in jProj ? jProj.value : jProj;
        if (vProj) projectDefaults = { ...projectDefaults, ...vProj };
      } catch {
        try {
          const ls = localStorage.getItem('project-showcase-settings');
          if (ls) projectDefaults = { ...projectDefaults, ...JSON.parse(ls) };
        } catch {}
      }

      // Load user settings server-first
      let userSettings: Partial<ShowcaseSettings> | null = null;
      try {
        const res = await fetch('/api/user/kv/showcase-settings', { credentials: 'include' });
        const j = res.ok ? await res.json().catch(() => null) : null;
        const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
        if (v) userSettings = v;
      } catch {
        try {
          const savedSettings = localStorage.getItem('showcase-settings');
          if (savedSettings) userSettings = JSON.parse(savedSettings);
        } catch {}
      }

      setSettings({
        ...defaultSettings,
        ...professionDefaults,
        ...projectDefaults,
        ...(userSettings || {}),
      });

      // Track feature usage
      features.trackFeatureUsage('profession-suites', 'showcase_settings_opened', {
        timestamp: Date.now(),
        profession: profession,
        userId: user?.id,
        component: 'ShowcaseSettingsPanel'
      });
    };
    load();
  }, [profession]);

  // Save settings to server-backed KV (with local fallback) and sync project settings mapping
  const saveSettings = async () => {
    setLoading(true);
    try {
      // Sync showcase-specific settings back to project context
      const projectShowcaseSettings: ProjectShowcaseSettingsPayload = {
        downloadProtectionLevel:
          settings.downloadProtection === 'none' ? 'none' :
          settings.downloadProtection === 'password' ? 'watermark' :
          settings.downloadProtection === 'timelimit' ? 'disabled' : 'none',
        accessLevel:
          settings.clientAccess === 'full' ? 'public' :
          settings.clientAccess === 'limited' ? 'restricted' :
          settings.clientAccess === 'readonly' ? 'private' : 'public',
        enableDownloadProtection: settings.downloadProtection !== 'none',
        pinRequired: settings.downloadProtection === 'password',
        passwordRequired: settings.downloadProtection === 'password',
        watermarkEnabled: settings.watermark !== 'none',
        watermarkPosition: settings.watermarkPosition,
        watermarkText: settings.watermarkText,
        watermarkOpacity: settings.watermarkOpacity,
        watermarkSize: settings.watermarkSize,
      };

      // Save to server KV
      await fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'showcase-settings', value: settings })
      }).catch(() => {});
      await fetch('/api/user/kv', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ key: 'project-showcase-settings', value: projectShowcaseSettings })
      }).catch(() => {});

      // Local fallback
      localStorage.setItem('showcase-settings', JSON.stringify(settings));
      localStorage.setItem('project-showcase-settings', JSON.stringify(projectShowcaseSettings));

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset to defaults
  const resetSettings = () => {
    setSettings(defaultSettings);
};

  // Update individual setting
  const updateSetting = (
    key: keyof ShowcaseSettings,
    value: ShowcaseSettings[keyof ShowcaseSettings],
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
};

  const tabs = [
    { label: 'Knapper', icon: <Tune />, value:  0 },
    { label: 'Layout', icon: <ViewModule />, value:  1 },
    { label: 'Mobil', icon: <PhoneAndroid />, value:  2 },
    { label: 'Søk', icon: <Search />, value:  3 },
    { label: 'Data', icon: <DataUsage />, value:  4 },
    { label: 'Design', icon: <Palette />, value:  5 },
    { label: 'Interaksjon', icon: <TouchApp />, value:  6 },
    { label: 'Ytelse', icon: <Speed />, value:  7 },
    { label: 'Sikkerhet', icon: <Security />, value:  8 },
    { label: 'Varsler', icon: <Notifications />, value:  9 },
    { label: 'Profesjons Suiter', icon: <Settings />, value: 10},
    { label: 'Avansert', icon: <Settings />, value: 11}
  ];

  return (
    <Box sx={{ p:  3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb:  3 }}>
        <Typography variant="h4" component="h2" sx={{  display: 'flex', alignItems: 'center', gap:  1  }}>
          {theming.getThemedIcon('settings')}
          Showcase Innstillinger
        </Typography>
        
        {/* Feature Analytics Display */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
          <Typography variant="caption" color="text.secondary">
            Features: {features.getFeatureAnalytics().enabledFeatures}/{features.getFeatureAnalytics().totalFeatures}
          </Typography>
          <Chip 
            label={`${Math.round(features.getFeatureAnalytics().featureAdoptionRate * 100)}%`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '10px', height: 20}}
          />
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb:  3 }}>
        Konfigurer alle aspekter av showcase-visningen. Endringene gjelder for både klient- og eier-modus.
      </Alert>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb:  3 }}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.value}
            label={tab.label}
            icon={tab.icon}
            iconPosition="start"
            value={tab.value}
          />
        ))}
      </Tabs>

      <Grid container spacing={3}>
        {/* Main Settings Content */}
        <Grid size={{ xs:  12, md:  8 }}>
          {activeTab === 0 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('tune')}
                  Knapp-visning
                </Typography>
                
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showDownloadButton}
                        onChange={(e) => updateSetting('showDownloadButton', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Download sx={{ color: '#4CAF50'}} />
                        <Box>
                          <Typography variant="body1">Last ned-knapp</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis download-knapp på hver showcase-item
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showFavoriteButton}
                        onChange={(e) => updateSetting('showFavoriteButton', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Favorite sx={{ color: '#F44336'}} />
                        <Box>
                          <Typography variant="body1">Favoritt-knapp</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis favoritt-knapp på hver showcase-item
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showCommentButton}
                        onChange={(e) => updateSetting('showCommentButton', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Comment sx={{ color: '#2196F3'}} />
                        <Box>
                          <Typography variant="body1">Kommentar-knapp</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis kommentar-knapp på hver showcase-item
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showSelectionButton}
                        onChange={(e) => updateSetting('showSelectionButton', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <CheckCircle sx={{ color: '#FF9800'}} />
                        <Box>
                          <Typography variant="body1">Valg-knapp</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis valg-knapp for å velge items
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showFullscreenButton}
                        onChange={(e) => updateSetting('showFullscreenButton', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Fullscreen sx={{ color: '#9C27B0'}} />
                        <Box>
                          <Typography variant="body1">Fullskjerm-knapp</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis fullskjerm-knapp på hver showcase-item
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showEditButton}
                        onChange={(e) => updateSetting('showEditButton', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Edit sx={{ color: '#FF9800'}} />
                        <Box>
                          <Typography variant="body1">Rediger-knapp</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis rediger-knapp i høyreklikk-meny
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.enableContextMenu}
                        onChange={(e) => updateSetting('enableContextMenu', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Visibility sx={{ color: '#607D8B'}} />
                        <Box>
                          <Typography variant="body1">Høyreklikk-meny</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Aktiver høyreklikk-meny på showcase-items
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showStatusText}
                        onChange={(e) => updateSetting('showStatusText', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <Visibility sx={{ color: '#795548'}} />
                        <Box>
                          <Typography variant="body1">Status-tekst</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis status-tekst under hver showcase-item
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.compactMode}
                        onChange={(e) => updateSetting('compactMode', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                        <VisibilityOff sx={{ color: '#9E9E9E'}} />
                        <Box>
                          <Typography variant="body1">Kompakt modus</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Vis færre knapper for en renere utseende
                          </Typography>
                        </Box>
                      </Box>
                  }
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {activeTab === 1 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <ViewModule />
                  Layout & Visuell Design
                </Typography>
                
                <Stack spacing={3}>
                  {/* Card Size */}
                  <FormControl fullWidth>
                    <InputLabel>Kort-størrelse</InputLabel>
                    <Select
                      value={settings.cardSize}
                      onChange={(e) => updateSetting('cardSize', e.target.value)}
                      label="Kort-størrelse"
                    >
                      <MenuItem value="small">Liten</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="large">Stor</MenuItem>
                      <MenuItem value="extra-large">Ekstra stor</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Grid Columns */}
                  <FormControl fullWidth>
                    <InputLabel>Antall kolonner</InputLabel>
                    <Select
                      value={settings.gridColumns}
                      onChange={(e) =>
                        updateSetting('gridColumns', Number(e.target.value) as ShowcaseSettings['gridColumns'])
                      }
                      label="Antall kolonner"
                    >
                      <MenuItem value={1}>1 kolonne</MenuItem>
                      <MenuItem value={2}>2 kolonner</MenuItem>
                      <MenuItem value={3}>3 kolonner</MenuItem>
                      <MenuItem value={4}>4 kolonner</MenuItem>
                      <MenuItem value={5}>5 kolonner</MenuItem>
                      <MenuItem value={6}>6 kolonner</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Card Spacing */}
                  <FormControl fullWidth>
                    <InputLabel>Kort-avstand</InputLabel>
                    <Select
                      value={settings.cardSpacing}
                      onChange={(e) => updateSetting('cardSpacing', e.target.value)}
                      label="Kort-avstand"
                    >
                      <MenuItem value="tight">Tett</MenuItem>
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="loose">Løs</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Image Aspect Ratio */}
                  <FormControl fullWidth>
                    <InputLabel>Bilde-forhold</InputLabel>
                    <Select
                      value={settings.imageAspectRatio}
                      onChange={(e) => updateSetting('imageAspectRatio', e.target.value)}
                      label="Bilde-forhold"
                    >
                      <MenuItem value="square">Kvadratisk (1: 1)</MenuItem>
                      <MenuItem value="16:9">Widescreen (16:9)</MenuItem>
                      <MenuItem value="4:3">Standard (4:3)</MenuItem>
                      <MenuItem value="3:2">Foto (3:2)</MenuItem>
                      <MenuItem value="original">Original</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Card Border Radius */}
                  <FormControl fullWidth>
                    <InputLabel>Kant-runding</InputLabel>
                    <Select
                      value={settings.cardBorderRadius}
                      onChange={(e) => updateSetting('cardBorderRadius', e.target.value)}
                      label="Kant-runding"
                    >
                      <MenuItem value="none">Ingen</MenuItem>
                      <MenuItem value="small">Liten</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="large">Stor</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Card Shadow */}
                  <FormControl fullWidth>
                    <InputLabel>Skygge</InputLabel>
                    <Select
                      value={settings.cardShadow}
                      onChange={(e) => updateSetting('cardShadow', e.target.value)}
                      label="Skygge"
                    >
                      <MenuItem value="none">Ingen</MenuItem>
                      <MenuItem value="subtle">Subtil</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="strong">Sterk</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Mobile Settings Tab */}
          {activeTab === 2 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  <PhoneAndroid />
                  Mobil Responsivitet
                </Typography>
                
                <Stack spacing={3}>
                  {/* Mobile Columns */}
                  <FormControl fullWidth>
                    <InputLabel>Mobil kolonner</InputLabel>
                    <Select
                      value={settings.mobileColumns}
                      onChange={(e) =>
                        updateSetting('mobileColumns', Number(e.target.value) as ShowcaseSettings['mobileColumns'])
                      }
                      label="Mobil kolonner"
                    >
                      <MenuItem value={1}>1 kolonne</MenuItem>
                      <MenuItem value={2}>2 kolonner</MenuItem>
                      <MenuItem value={3}>3 kolonner</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Touch Gestures */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.touchGestures}
                        onChange={(e) => updateSetting('touchGestures', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box>
                        <Typography variant="body1">Berøring-gestikk</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Aktiver swipe og touch-gestikk på mobil
                        </Typography>
                      </Box>
                  }
                  />

                  {/* Mobile Button Size */}
                  <FormControl fullWidth>
                    <InputLabel>Mobil knapp-størrelse</InputLabel>
                    <Select
                      value={settings.mobileButtonSize}
                      onChange={(e) => updateSetting('mobileButtonSize', e.target.value)}
                      label="Mobil knapp-størrelse"
                    >
                      <MenuItem value="small">Liten</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="large">Stor</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Compact Mobile View */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.compactMobileView}
                        onChange={(e) => updateSetting('compactMobileView', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box>
                        <Typography variant="body1">Kompakt mobil-visning</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Reduser plassering for bedre mobil-opplevelse
                        </Typography>
                      </Box>
                  }
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Search & Filter Settings Tab */}
          {activeTab === 3 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('search')}
                  Søk & Filtrering
                </Typography>
                
                <Stack spacing={3}>
                  {/* Search Bar Position */}
                  <FormControl fullWidth>
                    <InputLabel>Søkebar-posisjon</InputLabel>
                    <Select
                      value={settings.searchBarPosition}
                      onChange={(e) => updateSetting('searchBarPosition', e.target.value)}
                      label="Søkebar-posisjon"
                    >
                      <MenuItem value="top">Topp</MenuItem>
                      <MenuItem value="bottom">Bunn</MenuItem>
                      <MenuItem value="hidden">Skjult</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Filter Bar */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showFilterBar}
                        onChange={(e) => updateSetting('showFilterBar', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box>
                        <Typography variant="body1">Vis filterbar</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Vis filtrerings-alternativer
                        </Typography>
                      </Box>
                  }
                  />

                  {/* Default Sort By */}
                  <FormControl fullWidth>
                    <InputLabel>Standard sortering</InputLabel>
                    <Select
                      value={settings.defaultSortBy}
                      onChange={(e) => updateSetting('defaultSortBy', e.target.value)}
                      label="Standard sortering"
                    >
                      <MenuItem value="date">Dato</MenuItem>
                      <MenuItem value="name">Navn</MenuItem>
                      <MenuItem value="size">Størrelse</MenuItem>
                      <MenuItem value="type">Type</MenuItem>
                      <MenuItem value="views">Visninger</MenuItem>
                      <MenuItem value="likes">Likes</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Default Sort Order */}
                  <FormControl fullWidth>
                    <InputLabel>Sorterings-rekkefølge</InputLabel>
                    <Select
                      value={settings.defaultSortOrder}
                      onChange={(e) => updateSetting('defaultSortOrder', e.target.value)}
                      label="Sorterings-rekkefølge"
                    >
                      <MenuItem value="asc">Stigende (A-Z)</MenuItem>
                      <MenuItem value="desc">Synkende (Z-A)</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Quick Filters */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showQuickFilters}
                        onChange={(e) => updateSetting('showQuickFilters', e.target.checked)}
                        color="primary"
                      />
                  }
                    label={
                      <Box>
                        <Typography variant="body1">Hurtig-filtrer</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Vis knapper for hurtig filtrering
                        </Typography>
                      </Box>
                  }
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Data Display Settings Tab */}
          {activeTab === 4 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('dataUsage')}
                  Data-visning
                </Typography>
                
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showFileSize}
                        onChange={(e) => updateSetting('showFileSize', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Vis filstørrelse"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showUploadDate}
                        onChange={(e) => updateSetting('showUploadDate', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Vis opplastingsdato"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showViewCount}
                        onChange={(e) => updateSetting('showViewCount', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Vis visning-antall"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showLikeCount}
                        onChange={(e) => updateSetting('showLikeCount', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Vis like-antall"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showProfessionBadge}
                        onChange={(e) => updateSetting('showProfessionBadge', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Vis yrkes-merke"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.showAITags}
                        onChange={(e) => updateSetting('showAITags', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Vis AI-merkelapper"
                  />

                  {/* Max Items Per Page */}
                  <FormControl fullWidth>
                    <InputLabel>Maks items per side</InputLabel>
                    <Select
                      value={settings.maxItemsPerPage}
                      onChange={(e) =>
                        updateSetting('maxItemsPerPage', Number(e.target.value) as ShowcaseSettings['maxItemsPerPage'])
                      }
                      label="Maks items per side"
                    >
                      <MenuItem value={10}>10 items</MenuItem>
                      <MenuItem value={20}>20 items</MenuItem>
                      <MenuItem value={50}>50 items</MenuItem>
                      <MenuItem value={100}>100 items</MenuItem>
                      <MenuItem value={999}>Alle items</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Theme & Styling Tab */}
          {activeTab === 5 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('palette')}
                  Design & Tema
                </Typography>
                
                <Stack spacing={3}>
                  {/* Card Background */}
                  <FormControl fullWidth>
                    <InputLabel>Kort-bakgrunn</InputLabel>
                    <Select
                      value={settings.cardBackground}
                      onChange={(e) => updateSetting('cardBackground', e.target.value)}
                      label="Kort-bakgrunn"
                    >
                      <MenuItem value="dark">Mørk</MenuItem>
                      <MenuItem value="light">Lys</MenuItem>
                      <MenuItem value="transparent">Gjennomsiktig</MenuItem>
                      <MenuItem value="custom">Tilpasset</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Accent Color Mode */}
                  <FormControl fullWidth>
                    <InputLabel>Accent-farge modus</InputLabel>
                    <Select
                      value={settings.accentColorMode}
                      onChange={(e) => updateSetting('accentColorMode', e.target.value)}
                      label="Accent-farge modus"
                    >
                      <MenuItem value="auto">Automatisk (yrke)</MenuItem>
                      <MenuItem value="custom">Tilpasset</MenuItem>
                      <MenuItem value="random">Tilfeldig</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Custom Accent Color */}
                  {settings.accentColorMode === 'custom' && (
                    <TextField
                      fullWidth
                      label="Tilpasset accent-farge"
                      value={settings.customAccentColor}
                      onChange={(e) => updateSetting('customAccentColor', e.target.value)}
                      placeholder="#FF6B35"
                      helperText="Hex-farge kode (f.eks. #FF6B35)"
                    />
                  )}

                  {/* Button Style */}
                  <FormControl fullWidth>
                    <InputLabel>Knapp-stil</InputLabel>
                    <Select
                      value={settings.buttonStyle}
                      onChange={(e) => updateSetting('buttonStyle', e.target.value)}
                      label="Knapp-stil"
                    >
                      <MenuItem value="filled">Fylt</MenuItem>
                      <MenuItem value="outlined">Omriss</MenuItem>
                      <MenuItem value="text">Tekst</MenuItem>
                      <MenuItem value="icon-only">Kun ikon</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Animation Speed */}
                  <FormControl fullWidth>
                    <InputLabel>Animasjons-hastighet</InputLabel>
                    <Select
                      value={settings.animationSpeed}
                      onChange={(e) => updateSetting('animationSpeed', e.target.value)}
                      label="Animasjons-hastighet"
                    >
                      <MenuItem value="slow">Langsom</MenuItem>
                      <MenuItem value="normal">Normal</MenuItem>
                      <MenuItem value="fast">Rask</MenuItem>
                      <MenuItem value="disabled">Deaktivert</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Interaction & Behavior Tab */}
          {activeTab === 6 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('touch')}
                  Interaksjon & Oppførsel
                </Typography>
                
                <Stack spacing={3}>
                  {/* Click Action */}
                  <FormControl fullWidth>
                    <InputLabel>Klikk-handling</InputLabel>
                    <Select
                      value={settings.clickAction}
                      onChange={(e) => updateSetting('clickAction', e.target.value)}
                      label="Klikk-handling"
                    >
                      <MenuItem value="fullscreen">Fullskjerm</MenuItem>
                      <MenuItem value="download">Last ned</MenuItem>
                      <MenuItem value="select">Velg</MenuItem>
                      <MenuItem value="custom">Tilpasset</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Hover Effects */}
                  <FormControl fullWidth>
                    <InputLabel>Hover-effekter</InputLabel>
                    <Select
                      value={settings.hoverEffects}
                      onChange={(e) => updateSetting('hoverEffects', e.target.value)}
                      label="Hover-effekter"
                    >
                      <MenuItem value="none">Ingen</MenuItem>
                      <MenuItem value="glow">Glød</MenuItem>
                      <MenuItem value="scale">Skalering</MenuItem>
                      <MenuItem value="fade">Fading</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Double Click Action */}
                  <FormControl fullWidth>
                    <InputLabel>Dobbeltklikk-handling</InputLabel>
                    <Select
                      value={settings.doubleClickAction}
                      onChange={(e) => updateSetting('doubleClickAction', e.target.value)}
                      label="Dobbeltklikk-handling"
                    >
                      <MenuItem value="fullscreen">Fullskjerm</MenuItem>
                      <MenuItem value="download">Last ned</MenuItem>
                      <MenuItem value="select">Velg</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.keyboardShortcuts}
                        onChange={(e) => updateSetting('keyboardShortcuts', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Tastatur-snarveier"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.autoPlayVideos}
                        onChange={(e) => updateSetting('autoPlayVideos', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Auto-spill videoer"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.lazyLoading}
                        onChange={(e) => updateSetting('lazyLoading', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Lazy loading"
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Performance Tab */}
          {activeTab === 7 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('speed')}
                  Ytelse
                </Typography>
                
                <Stack spacing={3}>
                  {/* Image Quality */}
                  <FormControl fullWidth>
                    <InputLabel>Bildekvalitet</InputLabel>
                    <Select
                      value={settings.imageQuality}
                      onChange={(e) => updateSetting('imageQuality', e.target.value)}
                      label="Bildekvalitet"
                    >
                      <MenuItem value="low">Lav</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">Høy</MenuItem>
                      <MenuItem value="original">Original</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Thumbnail Size */}
                  <FormControl fullWidth>
                    <InputLabel>Miniatyr-størrelse</InputLabel>
                    <Select
                      value={settings.thumbnailSize}
                      onChange={(e) => updateSetting('thumbnailSize', e.target.value)}
                      label="Miniatyr-størrelse"
                    >
                      <MenuItem value="small">Liten</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="large">Stor</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Cache Duration */}
                  <FormControl fullWidth>
                    <InputLabel>Cache-varighet</InputLabel>
                    <Select
                      value={settings.cacheDuration}
                      onChange={(e) => updateSetting('cacheDuration', e.target.value)}
                      label="Cache-varighet"
                    >
                      <MenuItem value="1h">1 time</MenuItem>
                      <MenuItem value="1d">1 dag</MenuItem>
                      <MenuItem value="1w">1 uke</MenuItem>
                      <MenuItem value="1m">1 måned</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Preload Images */}
                  <FormControl fullWidth>
                    <InputLabel>Forhåndslast bilder</InputLabel>
                    <Select
                      value={settings.preloadImages}
                      onChange={(e) => updateSetting('preloadImages', e.target.value)}
                      label="Forhåndslast bilder"
                    >
                      <MenuItem value="none">Ingen</MenuItem>
                      <MenuItem value="next3">Neste 3</MenuItem>
                      <MenuItem value="next5">Neste 5</MenuItem>
                      <MenuItem value="all">Alle</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.backgroundSync}
                        onChange={(e) => updateSetting('backgroundSync', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Bakgrunns-synkronisering"
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Security & Privacy Tab */}
          {activeTab === 8 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('security')}
                  Sikkerhet & Personvern
                  <Chip 
                    label={getProfessionDisplayName(profession)}
                    size="small" 
                    color="primary" 
                    sx={{ ml:  1 }}
                  />
                </Typography>
                
                <Alert severity="info" sx={{ mb:  2 }}>
                  <Typography variant="body2">
                    Vannmerke-innstillingene er tilpasset for <strong>{profession === 'photographer' ? 'fotografer' : 
                    profession === 'videographer' ? 'videografer' :
                    profession === 'music_producer' ? 'musikprodusenter' :
                    profession === 'vendor' ? 'leverandører' : 'brukere'}</strong>. 
                    Standardinnstillingene er optimalisert for din profesjon, men du kan tilpasse dem etter behov.
                  </Typography>
                </Alert>

                <Stack spacing={3}>
                  {/* Watermark */}
                  <FormControl fullWidth>
                    <InputLabel>Vannmerke</InputLabel>
                    <Select
                      value={settings.watermark}
                      onChange={(e) => updateSetting('watermark', e.target.value)}
                      label="Vannmerke"
                    >
                      <MenuItem value="none">Ingen</MenuItem>
                      <MenuItem value="text">Tekst</MenuItem>
                      <MenuItem value="logo">Logo</MenuItem>
                      <MenuItem value="both">Begge</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Watermark Customization - Only show when watermark is enabled */}
                  {settings.watermark !== 'none' && (
                    <>
                      {/* Custom Text Input */}
                      <TextField
                        fullWidth
                        label="Egendefinert tekst"
                        value={settings.watermarkText}
                        onChange={(e) => updateSetting('watermarkText', e.target.value)}
                        placeholder="Skriv inn vannmerke-tekst"
                        helperText="Tekst som vises i vannmerket"
                        disabled={settings.watermark === 'logo'}
                      />

                      {/* Position */}
                      <FormControl fullWidth>
                        <InputLabel>Posisjon</InputLabel>
                        <Select
                          value={settings.watermarkPosition}
                          onChange={(e) => updateSetting('watermarkPosition', e.target.value)}
                          label="Posisjon"
                        >
                          <MenuItem value="bottom-right">Nederst til høyre</MenuItem>
                          <MenuItem value="bottom-left">Nederst til venstre</MenuItem>
                          <MenuItem value="top-right">Øverst til høyre</MenuItem>
                          <MenuItem value="top-left">Øverst til venstre</MenuItem>
                          <MenuItem value="center">Senter</MenuItem>
                        </Select>
                      </FormControl>

                      {/* Size */}
                      <FormControl fullWidth>
                        <InputLabel>Størrelse</InputLabel>
                        <Select
                          value={settings.watermarkSize}
                          onChange={(e) => updateSetting('watermarkSize', e.target.value)}
                          label="Størrelse"
                        >
                          <MenuItem value="small">Liten</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="large">Stor</MenuItem>
                        </Select>
                      </FormControl>

                      {/* Opacity Slider */}
                      <Box>
                        <Typography gutterBottom>
                          Gjennomsiktighet: {settings.watermarkOpacity}%
                        </Typography>
                        <Slider
                          aria-label="Vannmerke gjennomsiktighet"
                          value={settings.watermarkOpacity}
                          onChange={(_event, value) =>
                            updateSetting(
                              'watermarkOpacity',
                              Array.isArray(value) ? value[0] : value,
                            )
                          }
                          min={10}
                          max={100}
                          step={10}
                          marks={[
                            { value:  10, label: '10%'},
                            { value:  50, label: '50%'},
                            { value: 100, label: '100%'}
                          ]}
                          valueLabelDisplay="auto"
                          valueLabelFormat={(value) => `${value}%`}
                        />
                      </Box>

                      {/* Preview */}
                      <Box sx={{ 
                        p: 2, border: '1px dashed #ccc', 
                        borderRadius:  1,
                        bgcolor: '#f5f5f0',
                        position: 'relative',
                        height: 120,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                  }}>
                        <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', top:  8, left:  8 }}>
                          Forhåndsvisning: </Typography>
                        
                        {/* Watermark Preview */}
                        <Box sx={{
                          position: 'absolute',
                          [settings.watermarkPosition.includes('top') ? 'top' : 'bottom']: 8,
                          [settings.watermarkPosition.includes('left') ? 'left' : 'right']: 8,
                          ...(settings.watermarkPosition === 'center' && {
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)'
                        }),
                          bgcolor: `rgba(0, 0, 0, ${settings.watermarkOpacity / 100})`,
                          color: '#fff',
                          px:  1,
                          py: 0.5,
                          borderRadius:  1,
                          fontSize: settings.watermarkSize === 'small' ? '0.7rem' : 
                                   settings.watermarkSize === 'medium' ? '0.9rem' : '1.1rem',
                          fontWeight: 500,
                          backdropFilter: 'blur(4px)',
                          zIndex: 2}}>
                          {settings.watermark === 'text' ? settings.watermarkText :
                           settings.watermark === 'logo' ? '🏢' :
                           settings.watermark === 'both' ? `🏢 ${settings.watermarkText}` : ''}
                        </Box>
                      </Box>
                    </>
                  )}

                  {/* Audio Watermarking - Only for music producers */}
                  {profession === 'music_producer' && (
                    <>
                      <Divider sx={{ my:  2 }}>
                        <Typography variant="subtitle2" color="primary">
                          Lyd-vannmerke
                        </Typography>
                      </Divider>

                      <Alert severity="info" sx={{ mb:  2 }}>
                        <Typography variant="body2">
                          Lyd-vannmerke innebygger digitale signaturer i lydfilene dine som er umulige å høre, 
                          men kan brukes til å identifisere og beskytte ditt arbeid.
                        </Typography>
                      </Alert>

                      {/* Enable Audio Watermark */}
                      <FormControlLabel
                        control={
                          <Switch
                            checked={settings.audioWatermarkEnabled}
                            onChange={(e) => updateSetting('audioWatermarkEnabled', e.target.checked)}
                          />
                      }
                        label="Aktiver lyd-vannmerke"
                      />

                      {settings.audioWatermarkEnabled && (
                        <Stack spacing={3} sx={{ mt: 2, pl: 2, borderLeft: '2px solid', borderColor: 'primary.main'}}>
                          {/* Audio Watermark Method */}
                          <FormControl fullWidth>
                            <InputLabel>Vannmerke-metode</InputLabel>
                            <Select
                              value={settings.audioWatermarkMethod}
                              onChange={(e) => updateSetting('audioWatermarkMethod', e.target.value)}
                              label="Vannmerke-metode"
                            >
                              <MenuItem value="steganography">Steganografi (anbefalt)</MenuItem>
                              <MenuItem value="frequency">Frekvensmodulasjon</MenuItem>
                              <MenuItem value="echo">Ekkoteknikk</MenuItem>
                              <MenuItem value="phase">Fasemodulasjon</MenuItem>
                            </Select>
                          </FormControl>

                          {/* Audio Watermark Strength */}
                          <FormControl fullWidth>
                            <InputLabel>Styrke</InputLabel>
                            <Select
                              value={settings.audioWatermarkStrength}
                              onChange={(e) => updateSetting('audioWatermarkStrength', e.target.value)}
                              label="Styrke"
                            >
                              <MenuItem value="low">Lav (minimal påvirkning)</MenuItem>
                              <MenuItem value="medium">Medium (balansert)</MenuItem>
                              <MenuItem value="high">Høy (maksimal beskyttelse)</MenuItem>
                            </Select>
                          </FormControl>

                          {/* Audio Watermark Frequency */}
                          <FormControl fullWidth>
                            <InputLabel>Frekvens</InputLabel>
                            <Select
                              value={settings.audioWatermarkFrequency}
                              onChange={(e) => updateSetting('audioWatermarkFrequency', e.target.value)}
                              label="Frekvens"
                            >
                              <MenuItem value="low">Lav (sjeldne markeringer)</MenuItem>
                              <MenuItem value="medium">Medium (moderate markeringer)</MenuItem>
                              <MenuItem value="high">Høy (hyppige markeringer)</MenuItem>
                            </Select>
                          </FormControl>

                          {/* Audio Watermark Info */}
                          <Alert severity="success">
                            <Typography variant="body2">
                              <strong>Steganografi</strong>: Innebygger data i lydspekteret uten hørbar påvirkning.<br/>
                              <strong>Frekvensmodulasjon</strong>: Bruker frekvensendringer for å kode informasjon.<br/>
                              <strong>Ekkoteknikk</strong>: Legger til subtile ekkoer som bærer informasjon.<br/>
                              <strong>Fasemodulasjon</strong>: Modifiserer faseinformasjon for å kode data.
                            </Typography>
                          </Alert>
                        </Stack>
                      )}
                    </>
                  )}

                  {/* Download Protection */}
                  <FormControl fullWidth>
                    <InputLabel>Nedlastings-beskyttelse</InputLabel>
                    <Select
                      value={settings.downloadProtection}
                      onChange={(e) => updateSetting('downloadProtection', e.target.value)}
                      label="Nedlastings-beskyttelse"
                    >
                      <MenuItem value="none">Ingen</MenuItem>
                      <MenuItem value="password">Passord</MenuItem>
                      <MenuItem value="timelimit">Tidsbegrensning</MenuItem>
                    </Select>
                  </FormControl>

                  {/* View Tracking */}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.viewTracking}
                        onChange={(e) => updateSetting('viewTracking', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Visning-sporing"
                  />

                  {/* Share Restrictions */}
                  <FormControl fullWidth>
                    <InputLabel>Delings-begrensninger</InputLabel>
                    <Select
                      value={settings.shareRestrictions}
                      onChange={(e) => updateSetting('shareRestrictions', e.target.value)}
                      label="Delings-begrensninger"
                    >
                      <MenuItem value="public">Offentlig</MenuItem>
                      <MenuItem value="private">Privat</MenuItem>
                      <MenuItem value="custom">Tilpasset</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Client Access */}
                  <FormControl fullWidth>
                    <InputLabel>Klient-tilgang</InputLabel>
                    <Select
                      value={settings.clientAccess}
                      onChange={(e) => updateSetting('clientAccess', e.target.value)}
                      label="Klient-tilgang"
                    >
                      <MenuItem value="full">Full</MenuItem>
                      <MenuItem value="limited">Begrenset</MenuItem>
                      <MenuItem value="readonly">Kun lesing</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 9 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('notifications')}
                  Varsler & Notifikasjoner
                </Typography>
                
                <Stack spacing={3}>
                  {/* New Item Alerts */}
                  <FormControl fullWidth>
                    <InputLabel>Nye item-varsler</InputLabel>
                    <Select
                      value={settings.newItemAlerts}
                      onChange={(e) => updateSetting('newItemAlerts', e.target.value)}
                      label="Nye item-varsler"
                    >
                      <MenuItem value="email">E-post</MenuItem>
                      <MenuItem value="push">Push</MenuItem>
                      <MenuItem value="inapp">I app</MenuItem>
                      <MenuItem value="none">Ingen</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.downloadNotifications}
                        onChange={(e) => updateSetting('downloadNotifications', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Nedlastings-varsler"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.favoriteNotifications}
                        onChange={(e) => updateSetting('favoriteNotifications', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Favoritt-varsler"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.commentNotifications}
                        onChange={(e) => updateSetting('commentNotifications', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Kommentar-varsler"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.soundEffects}
                        onChange={(e) => updateSetting('soundEffects', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Lyd-effekter"
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Profession Suites Tab */}
          {activeTab === 10 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('settings')}
                  Profesjons Suiter
                  {!isProfessionSuitesEnabled && (
                    <Chip 
                      label="Deaktivert av admin" 
                      size="small" 
                      color="error" 
                      sx={{ ml:  1 }}
                    />
                  )}
                </Typography>
                
                {!isProfessionSuitesEnabled ? (
                  <Alert severity="warning" sx={{ mb:  2 }}>
                    <Typography variant="body2">
                      Profesjons suiter er deaktivert av systemadministratoren. 
                      Kontakt din admin for å aktivere disse funksjonene.
                    </Typography>
                  </Alert>
                ) : (
                  <Stack spacing={3}>
                    <Alert severity="info" sx={{ mb:  2 }}>
                      <Typography variant="body2">
                        Konfigurer tilgang til profesjons-spesifikke suiter. 
                        Disse innstillingene påvirker hvilke verktøy som er tilgjengelige for brukere.
                      </Typography>
                    </Alert>

                    {/* Suite Access Level */}
                    <FormControl fullWidth>
                      <InputLabel>Tilgangsnivå for suiter</InputLabel>
                      <Select
                        value={settings.professionSuiteAccess}
                        onChange={(e) => updateSetting('professionSuiteAccess', e.target.value)}
                        label="Tilgangsnivå for suiter"
                      >
                        <MenuItem value="all">Alle suiter tilgjengelig</MenuItem>
                        <MenuItem value="limited">Begrenset tilgang</MenuItem>
                        <MenuItem value="none">Ingen suiter</MenuItem>
                      </Select>
                    </FormControl>

                    {/* Individual Suite Controls */}
                    <Box sx={{ 
                      p: 2, border: '1px solid #e0e0e0', 
                      borderRadius:  1,
                      bgcolor: '#f8f9fa'
                }}>
                      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                        Individuell Suite-kontroll
                      </Typography>
                      
                      <Stack spacing={2}>
                        {/* Audio Enhancement Suite */}
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enableAudioEnhancementSuite}
                              onChange={(e) => updateSetting('enableAudioEnhancementSuite', e.target.checked)}
                              disabled={!isAudioSuiteEnabled || settings.professionSuiteAccess === 'none'}
                              color="primary"
                            />
                        }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Box sx={{ 
                                width:  20, 
                                height:  20, 
                                borderRadius: '50%', 
                                bgcolor: isAudioSuiteEnabled ? '#3f51b5' : '#ccc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                          }}>
                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold'}}>
                                  🎵
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="body1">Audio Enhancement Suite</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  AI-drevet lydforbedring med RNNoise, DCCRN og Demucs
                                  {!isAudioSuiteEnabled && ' (Deaktivert av admin)'}
                                </Typography>
                              </Box>
                            </Box>
                        }
                        />

                        {/* Photo Enhancement Suite */}
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enablePhotoEnhancementSuite}
                              onChange={(e) => updateSetting('enablePhotoEnhancementSuite', e.target.checked)}
                              disabled={!isPhotoSuiteEnabled || settings.professionSuiteAccess === 'none'}
                              color="primary"
                            />
                        }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Box sx={{ 
                                width:  20, 
                                height:  20, 
                                borderRadius: '50%', 
                                bgcolor: isPhotoSuiteEnabled ? '#e74c3c' : '#ccc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                          }}>
                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold'}}>
                                  📸
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="body1">Photo Enhancement Suite</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  AI-drevet fotoforbedring med GFPGAN, CodeFormer og Real-ESRGAN
                                  {!isPhotoSuiteEnabled && ' (Deaktivert av admin)'}
                                </Typography>
                              </Box>
                            </Box>
                        }
                        />

                        {/* Video Enhancement Suite */}
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enableVideoEnhancementSuite}
                              onChange={(e) => updateSetting('enableVideoEnhancementSuite', e.target.checked)}
                              disabled={!isVideoSuiteEnabled || settings.professionSuiteAccess === 'none'}
                              color="primary"
                            />
                        }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Box sx={{ 
                                width:  20, 
                                height:  20, 
                                borderRadius: '50%', 
                                bgcolor: isVideoSuiteEnabled ? '#9b59b6' : '#ccc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                          }}>
                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold'}}>
                                  🎬
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="body1">Video Enhancement Suite</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Avansert videobehandling med automatisk klipping og sosiale medier optimalisering
                                  {!isVideoSuiteEnabled && ' (Deaktivert av admin)'}
                                </Typography>
                              </Box>
                            </Box>
                        }
                        />

                        {/* Story Arc Studio */}
                        <FormControlLabel
                          control={
                            <Switch
                              checked={settings.enableStoryArcStudio}
                              onChange={(e) => updateSetting('enableStoryArcStudio', e.target.checked)}
                              disabled={!isStoryArcEnabled || settings.professionSuiteAccess === 'none'}
                              color="primary"
                            />
                        }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap:  1 }}>
                              <Box sx={{ 
                                width:  20, 
                                height:  20, 
                                borderRadius: '50%', 
                                bgcolor: isStoryArcEnabled ? '#f39c12' : '#ccc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                          }}>
                                <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold'}}>
                                  📝
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="body1">Story Arc Studio</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Profesjonell historiefortelling med DaVinci Resolve integrasjon
                                  {!isStoryArcEnabled && ' (Deaktivert av admin)'}
                                </Typography>
                              </Box>
                            </Box>
                        }
                        />
                      </Stack>
                    </Box>

                    {/* Current Profession Info */}
                    <Box sx={{ 
                      p: 2, border: '1px solid #4caf50', 
                      borderRadius:  1,
                      bgcolor: '#f1f8e9'
                }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: '#2e7d30', fontWeight: 600 }}>
                        Aktuell Profesjon: {getProfessionDisplayName(profession)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Suitene som er aktiverte vil være tilgjengelige for brukere med denne profesjonen.
                        Endre profesjon i hovedinnstillingene for å påvirke andre brukere.
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </CardContent>
            </Card>
          )}

          {/* Advanced Features Tab */}
          {activeTab === 11 && (
            <Card sx={theming.getThemedCardSx()}>
              <CardContent sx={theming.getThemedCardSx()}>
                <Typography variant="h6" component="h3" sx={{  mb: 2, display: 'flex', alignItems: 'center', gap:  1  }}>
                  {theming.getThemedIcon('settings')}
                  Avanserte Funksjoner
                </Typography>
                
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.bulkActions}
                        onChange={(e) => updateSetting('bulkActions', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Masse-handlinger"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.dragAndDrop}
                        onChange={(e) => updateSetting('dragAndDrop', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Drag & Drop"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.keyboardNavigation}
                        onChange={(e) => updateSetting('keyboardNavigation', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Tastatur-navigasjon"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.voiceCommands}
                        onChange={(e) => updateSetting('voiceCommands', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Stemme-kommandoer"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.aiSuggestions}
                        onChange={(e) => updateSetting('aiSuggestions', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="AI-forslag"
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.analyticsTracking}
                        onChange={(e) => updateSetting('analyticsTracking', e.target.checked)}
                        color="primary"
                      />
                  }
                    label="Analyse-sporing"
                  />
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Preview & Actions */}
        <Grid size={{ xs:  12, md:  4 }}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" component="h3" sx={{  mb:  2  }}>
                Forhåndsvisning
              </Typography>
              
              <Box sx={{ 
                p: 2, bgcolor: 'rgba(6, 13, 26, 0.8)', 
                borderRadius: settings.cardBorderRadius === 'none' ? 0 : 
                           settings.cardBorderRadius === 'small' ? 1 : 
                           settings.cardBorderRadius === 'medium' ? 2 : 3,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: settings.cardShadow === 'none' ? 'none' :
                          settings.cardShadow === 'subtle' ? '0 1px 3px rgba(0,0,0,0.12)' :
                          settings.cardShadow === 'medium' ? '0 4px 6px rgba(0,0,0,0.1)' :
                          '0 8px 15px rgba(0,0,0,0.2)',
                width: settings.cardSize === 'small' ? 200 :
                       settings.cardSize === 'medium' ? 250 :
                       settings.cardSize === 'large' ? 300 : 350,
                maxWidth: '100%' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)', mb: 1, display: 'block'}}>
                  Eksempel showcase-item ({settings.cardSize})
                </Typography>
                
                <Box sx={{ 
                  aspectRatio: settings.imageAspectRatio === 'square' ? '1/1' :
                              settings.imageAspectRatio === '16:9' ? '16/9' :
                              settings.imageAspectRatio === '4:3' ? '4/3' :
                              settings.imageAspectRatio === '3:2' ? '3/2' : 'auto',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  borderRadius:  1,
                  mb:  1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
            }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.56)' }}>
                    {settings.imageAspectRatio}
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap'}}>
                  {settings.showSelectionButton && (
                    <Chip 
                      icon={<CheckCircle />} 
                      label="Valg" 
                      size="small" 
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {settings.showFavoriteButton && (
                    <Chip 
                      icon={<Favorite />} 
                      label="Favoritt" 
                      size="small" 
                      color="error"
                      variant="outlined"
                    />
                  )}
                  {settings.showCommentButton && (
                    <Chip 
                      icon={<Comment />} 
                      label="Kommentar" 
                      size="small" 
                      color="info"
                      variant="outlined"
                    />
                  )}
                  {settings.showDownloadButton && (
                    <Chip 
                      icon={<Download />} 
                      label="Last ned" 
                      size="small" 
                      color="success"
                      variant="outlined"
                    />
                  )}
                  {settings.showFullscreenButton && (
                    <Chip 
                      icon={<Fullscreen />} 
                      label="Fullskjerm" 
                      size="small" 
                      color="secondary"
                      variant="outlined"
                    />
                  )}
                  {settings.showEditButton && (
                    <Chip 
                      icon={<Edit />} 
                      label="Rediger" 
                      size="small" 
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </Box>
                
                {settings.showStatusText && (
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.56)' }}>
                    Valgt • Favoritt • 5 likes
                  </Typography>
                )}
              </Box>
              
              <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary'}}>
                Kolonner: {settings.gridColumns} • Avstand: {settings.cardSpacing}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mt:  2 ,  ...theming.getThemedCardSx() }}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="h6" component="h3" sx={{  mb:  2  }}>
                Handlinger
              </Typography>
              
              <Stack spacing={1}>
                <Button variant="contained"
                  startIcon={<Save />}
                  onClick={saveSettings}
                  disabled={loading}
                  fullWidth
                 sx={theming.getThemedButtonSx()}>
                  {loading ? 'Lagrer...' : 'Lagre innstillinger'}
                </Button>
                
                <AdminButton
                  tone="secondary"
                  startIcon={<Refresh />}
                  onClick={resetSettings}
                  fullWidth
                >
                  Tilbakestill
                </AdminButton>

                <AdminButton
                  tone="ghost"
                  startIcon={<Settings />}
                  onClick={() => setActiveTab(0)}
                  fullWidth
                >
                  Gå til knapper
                </AdminButton>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={saved}
        autoHideDuration={3000}
        onClose={() => setSaved(false)}
      >
        <Alert severity="success" onClose={() => setSaved(false)}>
          Innstillinger lagret!
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ShowcaseSettingsPanel;
