/**
 * LanguageSelector Component
 * Language selection and i18n management component
 */

import { useTheming } from '../../../utils/theming-helper';
import React, { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Chip, 
  Tooltip, 
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Divider,
  Alert,
  AlertTitle,
  Grid,
  Card,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  Language,
  Translate,
  Public,
  Settings,
  Refresh,
  Warning,
  CheckCircle,
  Error,
  Info,
  Search,
  FilterList,
  Sort,
  ViewList,
  ViewModule,
  ViewComfy,
  KeyboardArrowDown,
  KeyboardArrowUp,
  ExpandMore,
  ExpandLess,
  Flag,
  Book,
  School,
  Work,
  Home,
  Person,
  Group,
  PublicOff,
  Sync,
  SyncProblem,
  CloudOff,
  CloudDone,
  CloudSync
} from '@mui/icons-material';
import { useI18n, UseI18nOptions } from '../../../hooks/useI18n';
import { I18nConfig, TranslationOptions } from '../../../utils/i18nManager';

interface LanguageSelectorProps {
  showDetails?: boolean;
  showSettings?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  showSorting?: boolean;
  variant?: 'minimal' | 'detailed' | 'full';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  onLanguageChange?: (language: string) => void;
  onSettingsClick?: () => void;
  className?: string;
  style?: React.CSSProperties
}

const LanguageSelector: React.FC<LanguageSelectorProps> = memo(({
  showDetails = true,
  showSettings = true,
  showSearch = false,
  showFilters = false,
  showSorting = false,
  variant = 'minimal',
  position = 'top-right',
  onLanguageChange,
  onSettingsClick,
  className,
  style
}) => {
  const [showLanguageDialog, setShowLanguageDialog] = useState(false);
  
  // Theming system
  const theming = useTheming('prototype_tester');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  // i18n options
  const i18nOptions: UseI18nOptions = useMemo(() => ({
    onLanguageChanged: (language: string) => {
      if (onLanguageChange) {
        onLanguageChange(language);
  }
  },
    onLanguageLoaded: (language: string, namespace: string) => {
      // Handle language loaded
},
    onError: (error: string) => {
      console.error('i18n error:', error);
  },
    onReady: () => {
      // Handle i18n ready
}
}), [onLanguageChange]);

  // Use i18n hook
  const {
    t,
    changeLanguage,
    getCurrentLanguage,
    getSupportedLanguages,
    isLanguageLoaded,
    getLoadedLanguages,
    getLoadedNamespaces,
    isRTL,
    state,
    config,
    updateConfig,
    clearAllData,
    isLoading,
    isReady,
    hasError,
    error,
    currentLanguage,
    supportedLanguages,
    loadedLanguages,
    loadedNamespaces
} = useI18n(i18nOptions);

  // Handle language change
  const handleLanguageChange = useCallback(async (language: string) => {
    if (language === currentLanguage) return;
    
    setIsChanging(true);
    try {
      await changeLanguage(language);
      setSelectedLanguage(language);
      setShowLanguageDialog(false);
} catch (error) {
      console.error('Failed to change language:', error);
  } finally {
      setIsChanging(false);
  }
}, [changeLanguage, currentLanguage]);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    if (onSettingsClick) {
      onSettingsClick();
  } else {
      setShowSettingsDialog(true);
  }
}, [onSettingsClick]);

  // Get language display name
  const getLanguageDisplayName = useCallback((code: string) => {
    const names: Record<string, string> = {
      'en':'English','es':'Español','fr':'Français','de':'Deutsch','it':'Italiano','pt':'Português','ru':'Русский','zh':'中文','ja':'日本語','ko' : '한국어'
  };
    return names[code] || code;
}, []);

  // Get language flag
  const getLanguageFlag = useCallback((code: string) => {
    const flags: Record<string, string> = {
      'en':'🇺🇸','es':'🇪🇸','fr':'🇫🇷','de':'🇩🇪','it':'🇮🇹','pt':'🇵🇹','ru':'🇷🇺','zh':'🇨🇳','ja':'🇯🇵', 'ko' : '🇰🇷'
  };
    return flags[code] || '🌐';
}, []);

  // Get status color
  const getStatusColor = useCallback(() => {
    if (hasError) return 'error';
    if (isLoading) return 'info';
    if (isReady) return 'success';
    return 'default';
}, [hasError, isLoading, isReady]);

  // Get status icon
  const getStatusIcon = useCallback(() => {
    if (hasError) return theming.getThemedIcon('error');
    if (isLoading) return <CircularProgress size={16} />;
    if (isReady) return theming.getThemedIcon('checkCircle');
    return theming.getThemedIcon('warning');
}, [hasError, isLoading, isReady]);

  // Get status text
  const getStatusText = useCallback(() => {
    if (hasError) return 'Error';
    if (isLoading) return 'Loading...';
    if (isReady) return 'Ready';
    return 'Unknown';
}, [hasError, isLoading, isReady]);

  // Get position styles
  const getPositionStyles = useCallback(() => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 100,
};

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top:  16, left: 16,};
      case 'top-right':
        return { ...baseStyles, top:  16, right: 16,};
      case 'bottom-left':
        return { ...baseStyles, bottom:  16, left: 16,};
      case 'bottom-right':
        return { ...baseStyles, bottom:  16, right: 16,};
      case 'top-center':
        return { ...baseStyles, top:  16, left: '50%', transform: 'translateX(-50%)',};
      case 'bottom-center':
        return { ...baseStyles, bottom:  16, left: '50%', transform: 'translateX(-50%)',};
      default: return { ...baseStyles, top:  16, right: 16,};
  }
}, [position]);

  // Render minimal variant
  const renderMinimal = () => (
    <Tooltip title={`${getLanguageDisplayName(currentLanguage)} (${currentLanguage})`}>
      <Chip
        icon={<Language />}
        label={getLanguageFlag(currentLanguage)}
        color={getStatusColor()}
        size="small"
        onClick={() => setShowLanguageDialog(true)}
        sx={{ cursor: 'pointer'}}
      />
    </Tooltip>
  );

  // Render detailed variant
  const renderDetailed = () => (
    <Paper elevation={2} sx={{ p: 1, minWidth: 200,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <Language color={getStatusColor() + '.main'} />
          <Typography variant="body2" color={getStatusColor() + '.main'}>
            {getLanguageDisplayName(currentLanguage)}
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <IconButton size="small" onClick={() => setShowLanguageDialog(true)}>
            <KeyboardArrowDown />
          </IconButton>
          
          {showSettings && (
            <IconButton size="small" onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      {showDetails && (
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            {loadedLanguages.length} loaded
          </Typography>
          {isRTL() && (
            <Typography variant="caption" color="info.main" sx={{ ml:  1 }}>
              RTL
            </Typography>
          )}
        </Box>
      )}
    </Paper>
  );

  // Render full variant
  const renderFull = () => (
    <Paper elevation={3} sx={{ p: 2, minWidth: 300,  ...theming.getThemedCardSx() }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <Language color="primary" />
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Language Settings
          </Typography>
        </Box>
        
        <Box display="flex" gap={1}>
          <Button
            startIcon={<Language />}
            onClick={() => setShowLanguageDialog(true)}
            variant="outlined"
            size="small"
          >
            Change
          </Button>
          
          {showSettings && (
            <IconButton onClick={handleSettingsClick}>
              {theming.getThemedIcon('settings')}
            </IconButton>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Current Language
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h4" sx={{ color: theming.colors.primary }}>
                  {getLanguageFlag(currentLanguage)}
                </Typography>
                <Box>
                  <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                    {getLanguageDisplayName(currentLanguage)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentLanguage}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Loaded Languages
              </Typography>
              <Typography variant="h4" color="primary" sx={{ color: theming.colors.primary }}>
                {loadedLanguages.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={6}>
          <Card sx={theming.getThemedCardSx()}>
            <CardContent sx={theming.getThemedCardSx()}>
              <Typography variant="subtitle2" gutterBottom>
                Status
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                {getStatusIcon()}
                <Typography variant="body2" color={getStatusColor() + '.main'}>
                  {getStatusText()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {isRTL() && (
        <Box mt={2}>
          <Chip
            label="Right-to-Left"
            color="info"
            size="small"
            icon={<Translate />}
          />
        </Box>
      )}
    </Paper>
  );

  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return renderMinimal();
      case 'detailed':
        return renderDetailed();
      case 'full':
        return renderFull();
      default: return renderMinimal();
}
};

  return (
    <>
      <Box
        className={className}
        style={{
          ...getPositionStyles(),
          ...style
      }}
      >
        {renderContent()}
      </Box>

      {/* Language Dialog */}
      <Dialog open={showLanguageDialog} onClose={() => setShowLanguageDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Language />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Select Language</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {showSearch && (
            <TextField
              fullWidth
              placeholder="Search languages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {theming.getThemedIcon('search')}
                  </InputAdornment>
                )
            }}
              sx={{ mb:  2 }}
            />
          )}
          
          <List>
            {supportedLanguages
              .filter(lang => 
                !searchQuery || 
                getLanguageDisplayName(lang).toLowerCase().includes(searchQuery.toLowerCase()) ||
                lang.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((language) => (
                <ListItem
                  key={language}
                  button
                  onClick={() => handleLanguageChange(language)}
                  selected={language === currentLanguage}
                  disabled={isChanging}
                >
                  <ListItemIcon>
                    <Typography variant="h6" sx={{ color: theming.colors.primary }}>
                      {getLanguageFlag(language)}
                    </Typography>
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={getLanguageDisplayName(language)}
                    secondary={language}
                  />
                  
                  <ListItemSecondaryAction>
                    {language === currentLanguage && (
                      <CheckCircle color="primary" />
                    )}
                    {isLanguageLoaded(language) && (
                      <Chip
                        label="Loaded"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
          </List>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowLanguageDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            {theming.getThemedIcon('settings')}
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>i18n Settings</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Default Language</InputLabel>
                <Select
                  value={config.defaultLanguage}
                  onChange={(e) => updateConfig({ defaultLanguage: e.target.value })}
                  label="Default Language"
                >
                  {supportedLanguages.map(lang => (
                    <MenuItem key={lang} value={lang}>
                      {getLanguageFlag(lang)} {getLanguageDisplayName(lang)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Fallback Language</InputLabel>
                <Select
                  value={config.fallbackLanguage}
                  onChange={(e) => updateConfig({ fallbackLanguage: e.target.value })}
                  label="Fallback Language"
                >
                  {supportedLanguages.map(lang => (
                    <MenuItem key={lang} value={lang}>
                      {getLanguageFlag(lang)} {getLanguageDisplayName(lang)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableAutoDetection}
                    onChange={(e) => updateConfig({ enableAutoDetection: e.target.checked })}
                  />
              }
                label="Enable Auto Detection"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableLocalStorage}
                    onChange={(e) => updateConfig({ enableLocalStorage: e.target.checked })}
                  />
              }
                label="Enable Local Storage"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableRTL}
                    onChange={(e) => updateConfig({ enableRTL: e.target.checked })}
                  />
              }
                label="Enable RTL Support"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enablePluralization}
                    onChange={(e) => updateConfig({ enablePluralization: e.target.checked })}
                  />
              }
                label="Enable Pluralization"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableInterpolation}
                    onChange={(e) => updateConfig({ enableInterpolation: e.target.checked })}
                  />
              }
                label="Enable Interpolation"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableLazyLoading}
                    onChange={(e) => updateConfig({ enableLazyLoading: e.target.checked })}
                  />
              }
                label="Enable Lazy Loading"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.enableDebug}
                    onChange={(e) => updateConfig({ enableDebug: e.target.checked })}
                  />
              }
                label="Enable Debug Mode"
              />
            </Grid>
          </Grid>
          
          <Box mt={2}>
            <Button
              onClick={clearAllData}
              variant="outlined"
              color="error"
              startIcon={theming.getThemedIcon('refresh')}
              fullWidth
            >
              Clear All i18n Data
            </Button>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

LanguageSelector.displayName ='LanguageSelector';

export default LanguageSelector;





