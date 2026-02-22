import { useTheming } from '../../utils/theming-helper';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card as MuiCard,
  CardContent,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Avatar,
  Button,
  Paper,
  Divider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Badge,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Keyboard,
  Apple,
  Computer,
  Star,
  ExpandMore,
  Launch,
  InfoOutlined,
  PhotoCamera as PhotoCameraAlt,
  Videocam as Videocamcam,
  LibraryMusic as LibraryMusicNote,
  Business as DirectionsBusiness,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';

interface Shortcut {
  id: string;
  softwareId: string;
  action: string;
  category: string;
  description?: string;
  macShortcut: string | null;
  windowsShortcut: string | null;
  linuxShortcut?: string | null;
  isEssential: boolean;
  frequency?: string;
  difficulty?: string;
  tags?: string[]
}

interface Software {
  id: string;
  name: string;
  category: string;
  version?: string;
  documentationUrl?: string
}

interface KeyboardShortcutsInterfaceProps {
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

const CATEGORY_TRANSLATIONS = {
  photo_editing: 'Fotoredigering',
  video_editing: 'Videoredigering',
  audio_production: 'Musikkproduksjon',
  business: 'Forretningsprogrammer',
};

const PROFESSION_ICONS = {
  photographer: PhotoCamera,
  videographer: Videocam,
  music_producer: theming.getThemedIcon(''),
  vendor: Business,
};

const SOFTWARE_LOGOS: Record<string, string> = {
  lightroom: '/software-logos/lightroom.svg','lightroom-cc' : '/software-logos/lightroom.svg',
  photoshop: '/software-logos/photoshop.svg','capture-one':'/software-logos/capture-one.svg','davinci-resolve':'/software-logos/davinci-resolve.svg','premiere-pro':'/software-logos/premiere-pro.svg','final-cut-pro':'/software-logos/final-cut-pro.svg','pro-tools':'/software-logos/pro-tools.svg','logic-pro' : '/software-logos/logic-pro.svg',
  cubase: '/software-logos/cubase.svg','ableton-live' : '/software-logos/ableton-live.svg',
};

const KeyboardShortcutsInterface: React.FC<KeyboardShortcutsInterfaceProps> = ({ profession }) => {
  const [selectedSoftware, setSelectedSoftware] = useState<string>(', ');
  const [platform, setPlatform] = useState<'mac' | 'windows'>('mac');
  const [searchQuery, setSearchQuery] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer,');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showEssentialOnly, setShowEssentialOnly] = useState(false);

  // Detect platform automatically
  useEffect(() => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Mac')) {
      setPlatform('mac');
  } else if (userAgent.includes('Windows')) {
      setPlatform('windows');
  }
}, []);

  // Fetch software based on profession
  const { data: software = [], isLoading: softwareLoading } = useQuery({
    queryKey: profession
      ? ['/api/keyboard-shortcuts/software', profession]
      : ['/api/keyboard-shortcuts/software'],
    queryFn: () =>
      profession
        ? apiRequest(`/api/keyboard-shortcuts/software/${profession}`)
        : apiRequest('/api/keyboard-shortcuts/software'),
});

  // Fetch shortcuts for selected software
  const { data: shortcuts = [], isLoading: shortcutsLoading } = useQuery({
    queryKey: [
      '/api/keyboard-shortcuts',
      selectedSoftware,
      platform,
      searchQuery,
      selectedCategory,
      showEssentialOnly,
    ],
    queryFn: () =>
      apiRequest(`/api/keyboard-shortcuts/${selectedSoftware}`, {
        params: {
          platform,
          search: searchQuery,
          category: selectedCategory,
          essentialOnly: showEssentialOnly,
      },
    }),
    enabled: !!selectedSoftware,
});

  const filteredSoftware = software.filter(
    (sw: Software) => !selectedSoftware || sw.id === selectedSoftware,
  );

  // Mock data removed - using database connection

  const getShortcutForPlatform = (shortcut: Shortcut) => {
    const shortcutValue = platform === 'mac' ? shortcut.macShortcut : shortcut.windowsShortcut;
    return shortcutValue || 'N/A';
};

  const getSoftwareLogo = (softwareId: string) => {
    return SOFTWARE_LOGOS[softwareId] || '/software-logos/default.svg';
};

  const getProfessionColor = () => {
    if (!profession) return 'primary';

    const colors = {
      photographer: '#FF6B30',
      videographer: '#9C27B0',
      music_producer: '#FF5720',
      vendor: '#2196F0',
  };

    return colors[profession] || '#FF6B35';
};

  return (
    <Box sx={{ p:  3, maxWidth: 120, mx: 'auto'}}>
      {/* Header */}
      <Box sx={{ mb:  4, textAlign: 'center'}}>
        <Typography variant="h3"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 'bold',
            background: 'linear-gradient(45deg, #FF6B35 30%, #F7931E 90%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            mb:  2}}
         sx={{ color: theming.colors.primary }}>
          <Keyboard sx={{ mr: 2, verticalAlign: 'middle', fontSize: '2rem'}} />
          Intelligente Hurtigtaster
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb:  3 }} sx={{ color: theming.colors.primary }}>
          Lær de mest effektive hurtigtastene for dine redigeringsprogrammer
        </Typography>

        <Alert severity="info" sx={{ mb:  3, maxWidth: 60, mx: 'auto'}}>
          <InfoOutlined sx={{ mr:  1 }} />
          Alle hurtigtaster er hentet fra offisielle kilder og oppdateres automatisk
        </Alert>
      </Box>

      {/* Controls */}
      <Paper elevation={2} sx={{ p:  3, mb:  4 ,  ...theming.getThemedCardSx() }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Programvare</InputLabel>
              <Select
                value={selectedSoftware}
                onChange={(e) => setSelectedSoftware(e.target.value)}
                label="Programvare"
              >
                <MenuItem value="">Alle programmer</MenuItem>
                {MOCK_SOFTWARE.map((software) => (
                  <MenuItem key={software.id} value={software.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center'}}>
                      <Avatar src={software.logoUrl} sx={{ width:  24, height:  24, mr:  1 }} />
                      {software.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Kategori</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Kategori"
              >
                <MenuItem value="all">Alle kategorier</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', gap:  1 }}>
              <Button
                variant={platform === 'mac' ? 'contained' : 'outlined'}
                onClick={() => setPlatform('mac')}
                startIcon={<Apple />}
                size="small"
              >
                Mac
              </Button>
              <Button
                variant={platform === 'windows' ? 'contained' : 'outlined'}
                onClick={() => setPlatform('windows')}
                startIcon={<Computer />}
                size="small"
              >
                Windows
              </Button>
            </Box>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              placeholder="Søk i hurtigtaster..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {theming.getThemedIcon(', ')}
                  </InputAdornment>
                )}}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap'}}>
          <Button
            variant={showEssentialOnly ? 'contained' : 'outlined'}
            onClick={() => setShowEssentialOnly(!showEssentialOnly)}
            startIcon={theming.getThemedIcon('star')}
            size="small"
          >
            Kun essensielle
          </Button>
        </Box>
      </Paper>

      {/* Software Cards */}
      <Grid container spacing={3}>
        {filteredSoftware.map((software) => {
          const shortcuts = filteredShortcuts(software.shortcuts);

          if (shortcuts.length === 0) return null;

          return (
            <Grid item xs={12} key={software.id}>
              <MuiCard elevation={3} sx={{ overflow: 'visible'}}>
                <CardContent sx={theming.getThemedCardSx()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb:  3 }}>
                    <Avatar src={software.logoUrl} sx={{ width:  48, height:  48, mr:  2 }} />
                    <Box sx={{ flexGrow:  1 }}>
                      <Typography variant="h5" component="h2" fontWeight="bold" sx={{ color: theming.colors.primary }}>
                        {software.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {shortcuts.length} hurtigtaster tilgjengelig
                      </Typography>
                    </Box>
                    <Chip
                      label={
                        software.category === 'photo_editing' ? 'Fotoredigering' : 'Videoredigering'
                    }
                      color="primary"
                      variant="outlined"
                    />
                  </Box>

                  <Grid container spacing={2}>
                    {shortcuts.map((shortcut) => (
                      <Grid item xs={12} sm={6} lg={4} key={shortcut.id}>
                        <Paper
                          elevation={1}
                          sx={{
                            p:  2,
                            height: '100%',
                            border: shortcut.isEssential ? '2px solid' : '1px solid',
                            borderColor: shortcut.isEssential ? 'warning.main' : 'divider',
                            position: 'relative', '&:hover': {
                              elevation:  3,
                              transform: 'translateY(-2px)',
                              transition: 'all 0.2s ease-in-out',
                          }}}
                         sx={theming.getThemedCardSx()}>
                          {shortcut.isEssential && (
                            <Chip
                              label="Essensiell"
                              color="warning"
                              size="small"
                              sx={{ position: 'absolute', top:  8, right:  8 }}
                            />
                          )}

                          <Typography variant="h6" component="h3" fontWeight="bold" sx={{ mb:  1 }} sx={{ color: theming.colors.primary }}>
                            {shortcut.action}
                          </Typography>

                          <Chip
                            label={shortcut.category}
                            size="small"
                            variant="outlined"
                            sx={{ mb:  2 }}
                          />

                          <Box
                            sx={{
                              backgroundColor: 'grey.10',
                              p:  1,
                              borderRadius:  1,
                              textAlign: 'center',
                              mb:  2}}
                          >
                            <Typography variant="h6"
                              component="code"
                              sx={{
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                color: 'primary.main'}}
                             sx={{ color: theming.colors.primary }}>
                              {getShortcutForPlatform(shortcut)}
                            </Typography>
                          </Box>

                          {shortcut.description && (
                            <Typography variant="body2" color="text.secondary">
                              {shortcut.description}
                            </Typography>
                          )}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </MuiCard>
            </Grid>
          );
      })}
      </Grid>

      {/* Help Section */}
      <Box sx={{ mt:  4 }}>
        <Accordion>
          <AccordionSummary expandIcon={theming.getThemedIcon('expandMore')}>
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>Hvordan bruke hurtigtastene?</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography sx={{ mb: 2 }}>
              <strong>For Mac-brukere: </strong> ⌘ = Command-tasten, ⌥ = Option/Alt-tasten, ⇧ =
              Shift-tasten
            </Typography>
            <Typography sx={{ mb: 2 }}>
              <strong>For Windows-brukere: </strong> Ctrl = Control-tasten, Alt = Alt-tasten, Shift =
              Shift-tasten
            </Typography>
            <Typography sx={{ mb: 2 }}>
              <strong>Tips: </strong> Start med de essensielle hurtigtastene (merket med stjerne) og
              bygg opp muskelminnene dine gradvis.
            </Typography>
          </AccordionDetails>
        </Accordion>
      </Box>
    </Box>
  )
};

export default KeyboardShortcutsInterface;
