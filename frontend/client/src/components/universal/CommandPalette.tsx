import React, { useState, useEffect, useMemo } from 'react';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';
import { useDynamicProfessions } from './hooks/useDynamicProfessions';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Box,
  Typography,
  Chip,
  InputAdornment,
  Paper,
  Divider,
  alpha,
} from '@mui/material';
import {
  Search,
  FolderOpen,
  Collections,
  FilterList,
  Archive,
  CloudDownload,
  DriveFileMove,
  FindInPage,
  Undo,
  Redo,
  GridView,
  ViewList,
  Dashboard,
  Label,
  ContentCopy,
  Share,
  PlayArrow,
  Movie,
  MusicNote,
  PhotoLibrary,
  Store,
  AutoFixHigh,
  Psychology,
  Timeline,
  SubtitlesOutlined,
  Instagram,
  YouTube,
  Facebook,
  Twitter,
  Star,
  Bookmark,
  VideoLibrary,
  Settings,
  Colorize,
  Crop,
  RotateRight,
  FilterVintage,
  WaterDrop,
  CloudUpload,
  AttachMoney,
  Inventory,
  Category,
  LocalOffer,
  Analytics,
  Equalizer,
  GraphicEq,
  LibraryMusic,
  RecordVoiceOver,
  Speed as Speed,
  VolumeDown,
  VolumeOff,
} from '@mui/icons-material';

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'view' | 'action' | 'filter' | 'batch' | 'ai' | 'export' | 'social' | 'settings';
  shortcut?: string;
  action: () => void;
  profession?: string[]
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onCommand: (command: string) => void;
  profession: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise'
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onCommand,
  profession
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Master Integration Provider
  const { integration, communication, dataFlow, componentRegistry } = useEnhancedMasterIntegration();
  
  // Profession system hooks
  const { professionConfigs, getUserProfessionColor } = useDynamicProfessions();
  const { professionConfigs: apiProfessionConfigs } = useProfessionConfigs();
  const professionAdapter = useProfessionAdapter();
  const currentProfession = (profession as string) || professionAdapter.profession || 'photographer';
  const professionIcon = getProfessionIcon(currentProfession);
  const professionConfig = professionConfigs?.[currentProfession];
  const enhancedProfessionConfig = apiProfessionConfigs?.[currentProfession] || professionConfig;
  const professionColor = getUserProfessionColor(currentProfession) || '#FF6B35';
  
  // Theming system - use dynamic profession
  const theming = useTheming(currentProfession);

  const commands: Command[] = useMemo(() => [
    // View commands (Universal)
    {
      id: 'grid-view',
      label: 'Rutenettvisning',
      description: 'Bytt til rutenettvisning',
      icon: <GridView />,
      category: 'view',
      shortcut: '⌘G',
      action: () => onCommand('grid-view')
    },
    {
      id: 'masonry-view',
      label: 'Masonry visning',
      description: 'Bytt til masonry layout',
      icon: <Dashboard />,
      category: 'view',
      shortcut: '⌘M',
      action: () => onCommand('masonry-view')
    },
    {
      id: 'list-view',
      label: 'Listevisning',
      description: 'Bytt til listevisning',
      icon: <ViewList />,
      category: 'view',
      shortcut: '⌘L',
      action: () => onCommand('list-view')
    },
    
    // Action commands (Universal)
    {
      id: 'new-collection',
      label: 'Ny samling',
      description: 'Opprett ny samling',
      icon: <Collections />,
      category: 'action',
      shortcut: '⌘N',
      action: () => onCommand('new-collection')
    },
    {
      id: 'batch-select',
      label: 'Batch-modus',
      description: 'Aktiver batch-valg',
      icon: <Collections />,
      category: 'batch',
      shortcut: '⌘B',
      action: () => onCommand('batch-select')
    },
    {
      id: 'filter',
      label: 'Filter',
      description: 'Åpne filterpanel',
      icon: <FilterList />,
      category: 'filter',
      shortcut: '⌘F',
      action: () => onCommand('filter')
    },
    {
      id: 'duplicate-detection',
      label: 'Finn duplikater',
      description: 'Finn og merk duplikater',
      icon: <FindInPage />,
      category: 'action',
      action: () => onCommand('duplicate-detection')
    },
    
    // Batch operations (Universal)
    {
      id: 'batch-archive',
      label: 'Arkiver valgte',
      description: 'Arkiver alle valgte elementer',
      icon: <Archive />,
      category: 'batch',
      action: () => onCommand('batch-archive')
    },
    {
      id: 'batch-download',
      label: 'Last ned valgte',
      description: 'Last ned alle valgte elementer',
      icon: <CloudDownload />,
      category: 'batch',
      action: () => onCommand('batch-download')
    },
    {
      id: 'batch-move',
      label: 'Flytt valgte',
      description: 'Flytt valgte til annen samling',
      icon: <DriveFileMove />,
      category: 'batch',
      action: () => onCommand('batch-move')
    },
    {
      id: 'batch-share',
      label: 'Del valgte',
      description: 'Del valgte elementer',
      icon: <Share />,
      category: 'batch',
      action: () => onCommand('batch-share')
    },
    
    // AI commands
    {
      id: 'auto-tag',
      label: 'Auto-tagging med AI',
      description: 'Generer tags automatisk basert på innhold',
      icon: <Psychology />,
      category: 'ai',
      action: () => onCommand('auto-tag'),
      profession: ['photographer','videographer']
    },
    {
      id: 'auto-curate',
      label: 'AI-kurering',
      description: 'La AI velge de beste bildene/videoene',
      icon: <Star />,
      category: 'ai',
      action: () => onCommand('auto-curate'),
      profession: ['photographer','videographer']
    },
    {
      id: 'ai-enhance',
      label: 'AI-forbedring',
      description: 'Forbedre bilder/videoer med AI',
      icon: <AutoFixHigh />,
      category: 'ai',
      action: () => onCommand('ai-enhance'),
      profession: ['photographer','videographer']
    },

    // Photographer-specific commands
    {
      id: 'quick-enhance',
      label: 'Rask forbedring',
      description: 'Rask AI-forbedring av bilder',
      icon: <AutoFixHigh />,
      category: 'action',
      action: () => onCommand('quick-enhance'),
      profession: ['photographer']
    },
    {
      id: 'apply-watermark',
      label: 'Legg til vannmerke',
      description: 'Legg til vannmerke på bilder',
      icon: <WaterDrop />,
      category: 'action',
      action: () => onCommand('apply-watermark'),
      profession: ['photographer']
    },
    {
      id: 'color-grade',
      label: 'Fargekorrigering',
      description: 'Fargekorriger bilder',
      icon: <Colorize />,
      category: 'action',
      action: () => onCommand('color-grade'),
      profession: ['photographer']
    },
    {
      id: 'crop-image',
      label: 'Beskjær bilde',
      description: 'Beskjær og juster bilder',
      icon: <Crop />,
      category: 'action',
      action: () => onCommand('crop-image'),
      profession: ['photographer']
    },
    {
      id: 'rotate-image',
      label: 'Roter bilde',
      description: 'Roter bilder 90 grader',
      icon: <RotateRight />,
      category: 'action',
      action: () => onCommand('rotate-image'),
      profession: ['photographer']
    },
    {
      id: 'apply-preset',
      label: 'Bruk preset',
      description: 'Bruk fargepreset på bilder',
      icon: <FilterVintage />,
      category: 'action',
      action: () => onCommand('apply-preset'),
      profession: ['photographer']
    },
    {
      id: 'export-instagram',
      label: 'Eksporter til Instagram',
      description: 'Optimaliser for Instagram (4:5)',
      icon: <Instagram />,
      category: 'social',
      action: () => onCommand('export-instagram'),
      profession: ['photographer']
    },
    {
      id: 'export-facebook',
      label: 'Eksporter til Facebook',
      description: 'Optimaliser for Facebook',
      icon: <Facebook />,
      category: 'social',
      action: () => onCommand('export-facebook'),
      profession: ['photographer']
    },

    // Videographer-specific commands
    {
      id: 'generate-thumbnails',
      label: 'Generer thumbnails',
      description: 'Auto-generer video thumbnails',
      icon: <Movie />,
      category: 'action',
      action: () => onCommand('generate-thumbnails'),
      profession: ['videographer']
    },
    {
      id: 'add-chapters',
      label: 'Legg til kapitler',
      description: 'Marker kapitler i video',
      icon: <Bookmark />,
      category: 'action',
      action: () => onCommand('add-chapters'),
      profession: ['videographer']
    },
    {
      id: 'add-subtitles',
      label: 'Legg til undertekster',
      description: 'Importer SRT/VTT undertekster',
      icon: <SubtitlesOutlined />,
      category: 'action',
      action: () => onCommand('add-subtitles'),
      profession: ['videographer']
    },
    {
      id: 'export-youtube',
      label: 'Eksporter til YouTube',
      description: 'Optimaliser for YouTube (16:9)',
      icon: <YouTube />,
      category: 'social',
      action: () => onCommand('export-youtube'),
      profession: ['videographer']
    },
    {
      id: 'export-tiktok',
      label: 'Eksporter til TikTok',
      description: 'Optimaliser for TikTok (9:16)',
      icon: <VideoLibrary />,
      category: 'social',
      action: () => onCommand('export-tiktok'),
      profession: ['videographer']
    },
    {
      id: 'timeline-editor',
      label: 'Åpne tidslinje',
      description: 'Åpne video tidslinje editor',
      icon: <Timeline />,
      category: 'action',
      action: () => onCommand('timeline-editor'),
      profession: ['videographer']
    },
    {
      id: 'proxy-generate',
      label: 'Generer proxy',
      description: 'Generer proxy filer for rask redigering',
      icon: <Speed />,
      category: 'action',
      action: () => onCommand('proxy-generate'),
      profession: ['videographer']
    },

    // Music Producer-specific commands
    {
      id: 'extract-stems',
      label: 'Ekstraher stems',
      description: 'Ekstraher instrumentstems fra lyd',
      icon: <GraphicEq />,
      category: 'action',
      action: () => onCommand('extract-stems'),
      profession: ['music_producer']
    },
    {
      id: 'set-bpm',
      label: 'Sett BPM',
      description: 'Sett beats per minute',
      icon: <Speed />,
      category: 'action',
      action: () => onCommand('set-bpm'),
      profession: ['music_producer']
    },
    {
      id: 'set-key',
      label: 'Sett toneart',
      description: 'Sett musikalsk toneart',
      icon: <MusicNote />,
      category: 'action',
      action: () => onCommand('set-key'),
      profession: ['music_producer']
    },
    {
      id: 'normalize-audio',
      label: 'Normaliser lyd',
      description: 'Normaliser lydnivå',
      icon: <Equalizer />,
      category: 'action',
      action: () => onCommand('normalize-audio'),
      profession: ['music_producer']
    },
    {
      id: 'apply-eq',
      label: 'Bruk EQ',
      description: 'Bruk equalizer på lyd',
      icon: <Equalizer />,
      category: 'action',
      action: () => onCommand('apply-eq'),
      profession: ['music_producer']
    },
    {
      id: 'add-effects',
      label: 'Legg til effekter',
      description: 'Legg til lydeffekter',
      icon: <LibraryMusic />,
      category: 'action',
      action: () => onCommand('add-effects'),
      profession: ['music_producer']
    },
    {
      id: 'record-audio',
      label: 'Spill inn lyd',
      description: 'Start lydopptak',
      icon: <RecordVoiceOver />,
      category: 'action',
      action: () => onCommand('record-audio'),
      profession: ['music_producer']
    },
    {
      id: 'mute-track',
      label: 'Demp spor',
      description: 'Demp eller aktiver spor',
      icon: <VolumeOff />,
      category: 'action',
      action: () => onCommand('mute-track'),
      profession: ['music_producer']
    },
    {
      id: 'adjust-volume',
      label: 'Juster volum',
      description: 'Juster sporvolum',
      icon: <VolumeDown />,
      category: 'action',
      action: () => onCommand('adjust-volume'),
      profession: ['music_producer']
    },

    // Vendor-specific commands
    {
      id: 'new-product',
      label: 'Nytt produkt',
      description: 'Opprett nytt produkt',
      icon: <Store />,
      category: 'action',
      shortcut: '⌘N',
      action: () => onCommand('new-product'),
      profession: ['vendor']
    },
    {
      id: 'edit-pricing',
      label: 'Rediger prising',
      description: 'Rediger produktpriser',
      icon: <AttachMoney />,
      category: 'action',
      action: () => onCommand('edit-pricing'),
      profession: ['vendor']
    },
    {
      id: 'update-inventory',
      label: 'Oppdater lager',
      description: 'Oppdater lagerbeholdning',
      icon: <Inventory />,
      category: 'action',
      action: () => onCommand('update-inventory'),
      profession: ['vendor']
    },
    {
      id: 'add-variants',
      label: 'Legg til varianter',
      description: 'Legg til produktvarianter',
      icon: <Category />,
      category: 'action',
      action: () => onCommand('add-variants'),
      profession: ['vendor']
    },
    {
      id: 'add-to-bundle',
      label: 'Legg til i pakke',
      description: 'Opprett eller legg til i pakke',
      icon: <Collections />,
      category: 'action',
      action: () => onCommand('add-to-bundle'),
      profession: ['vendor']
    },
    {
      id: 'edit-tags',
      label: 'Rediger tags',
      description: 'Rediger produkt tags',
      icon: <LocalOffer />,
      category: 'action',
      action: () => onCommand('edit-tags'),
      profession: ['vendor']
    },
    {
      id: 'edit-categories',
      label: 'Rediger kategorier',
      description: 'Rediger produktkategorier',
      icon: <Category />,
      category: 'action',
      action: () => onCommand('edit-categories'),
      profession: ['vendor']
    },
    {
      id: 'view-analytics',
      label: 'Vis statistikk',
      description: 'Vis produkstatistikk',
      icon: <Analytics />,
      category: 'action',
      action: () => onCommand('view-analytics'),
      profession: ['vendor']
    },
    {
      id: 'bulk-upload',
      label: 'Masseopplasting',
      description: 'Last opp flere produkter',
      icon: <CloudUpload />,
      category: 'action',
      action: () => onCommand('bulk-upload'),
      profession: ['vendor']
    },
    {
      id: 'export-products',
      label: 'Eksporter produkter',
      description: 'Eksporter produktdata',
      icon: <CloudDownload />,
      category: 'export',
      action: () => onCommand('export-products'),
      profession: ['vendor']
    },

    // General commands (Universal)
    {
      id: 'undo',
      label: 'Angre',
      description: 'Angre siste handling',
      icon: <Undo />,
      category: 'action',
      shortcut: '⌘Z',
      action: () => onCommand('undo')
    },
    {
      id: 'redo',
      label: 'Gjør om',
      description: 'Gjør om siste angring',
      icon: <Redo />,
      category: 'action',
      shortcut: '⌘⇧Z',
      action: () => onCommand('redo')
    },
    {
      id: 'settings',
      label: 'Innstillinger',
      description: 'Åpne innstillinger',
      icon: <Settings />,
      category: 'action',
      shortcut: '⌘,',
      action: () => onCommand('settings')
    }
  ], [onCommand, profession, theming]);

  // Filter commands based on profession and search
  const filteredCommands = useMemo(() => {
    return commands
      .filter(cmd => {
        // Filter by profession if specified
        if (cmd.profession && !cmd.profession.includes(profession)) {
          return false;
      }
        // Filter by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            cmd.label.toLowerCase().includes(query) ||
            cmd.description.toLowerCase().includes(query) ||
            cmd.category.toLowerCase().includes(query)
          );
      }
        return true;
      })
      .sort((a, b) => {
        // Sort by category then alphabetically
        if (a.category !== b.category) {
          const categoryOrder = ['view','action','filter','batch','ai','export','social','settings'];
          return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        }
        return a.label.localeCompare(b.label);
      });
  }, [commands, searchQuery, profession]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          const command = filteredCommands[selectedIndex];

          // Broadcast command execution event
          communication.broadcast('command:executed', {
            type: 'command_executed',
            data: { commandId: command.id, commandLabel: command.label },
            component: 'CommandPalette'
          });

          command.action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredCommands, onClose, communication]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
}, [searchQuery]);

  // Register component with MasterIntegrationProvider
  useEffect(() => {
    componentRegistry.registerComponent('CommandPalette', {
      type: 'command',
      capabilities: ['command-execution','search','navigation'],
      dataFlow: {
        sources: ['commands','search-query'],
        destinations: ['user-interface','admin-dashboard'],
        processors: ['command-processing','search-processing']
      }
    });

    // Set up data flow nodes
    dataFlow.registerNode('commands', {
      type: 'source',
      data: commands,
      metadata: { component: 'CommandPalette', type: 'commands' }
    });

    dataFlow.registerNode('search-query', {
      type: 'source',
      data: { searchQuery, selectedIndex },
      metadata: { component: 'CommandPalette', type: 'search-query' }
    });

    // Listen for command events
    if (typeof communication?.subscribe === 'function') {
    communication.subscribe('command:execute', (data) => {
      if (data.commandId) {
        const command = commands.find(cmd => cmd.id === data.commandId);
        if (command) {
          command.action();
        }
      }
    });

    communication.subscribe('command: search', (data) => {
      if (data.query !== undefined) {
        setSearchQuery(data.query);
    }
  });
    }

    return () => {
      componentRegistry.unregisterComponent('CommandPalette');
      dataFlow.unregisterNode('commands');
      dataFlow.unregisterNode('search-query');
  };
}, [commands, searchQuery, selectedIndex, componentRegistry, dataFlow, communication]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'view': return '#4CAF50';
      case 'action': return '#2196F3';
      case 'filter': return '#FF9800';
      case 'batch': return '#9C27B0';
      case 'ai': return '#FF5722';
      case 'export': return '#00BCD4';
      case 'social': return '#E91E63';
      case 'settings': return '#607D8B';
      default: return '#757575';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'view': return 'Visning';
      case 'action': return 'Handling';
      case 'filter': return 'Filter';
      case 'batch': return 'Batch';
      case 'ai': return 'AI';
      case 'export': return 'Eksport';
      case 'social': return 'Sosiale medier';
      case 'settings': return 'Innstillinger';
      default: return category;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a10',
          backgroundImage: 'none',
          borderRadius:  2,
          border: '1px solid rgba(25, 107, 53, 0.2)',
          maxHeight: '70vh'
    }
    }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column'}}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(25, 255, 255, 0.1)' }}>
          {/* Header with profession branding */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            {professionIcon && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  color: professionColor,
                  fontSize: '1.2rem'
                }}
              >
                {professionIcon}
              </Box>
            )}
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              {enhancedProfessionConfig?.displayName ? `${enhancedProfessionConfig.displayName} Command Palette` : 'Command Palette'}
            </Typography>
          </Box>
          <TextField
            fullWidth
            autoFocus
            placeholder="Søk etter kommandoer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                </InputAdornment>
              ),
              sx: {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                color: '#fff','& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'transparent'
                }, '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 107, 53, 0.3)'
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#ff6b35'
                }
              }
            }}
          />
        </Box>

        <List sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          {filteredCommands.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Ingen kommandoer funnet
              </Typography>
            </Box>
          ) : (
            filteredCommands.map((command, index) => (
              <ListItem
                key={command.id}
                selected={index === selectedIndex}
                onClick={() => {
                  command.action();
                  onClose();
                }}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  bgcolor: index === selectedIndex ? 'rgba(255, 107, 53, 0.1)' : 'transparent',
                  '&:hover': {
                    bgcolor: 'rgba(255, 107, 53, 0.05)'
                  },
                  '&.Mui-selected': {
                    bgcolor: 'rgba(255, 107, 53, 0.1)', '&:hover': {
                      bgcolor: 'rgba(255, 107, 53, 0.15)'
                    }
                  }
                }}
              >
                <ListItemIcon sx={{ color: getCategoryColor(command.category), minWidth: 40 }}>
                  {command.icon}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" sx={{ color: '#fff' }}>
                        {command.label}
                      </Typography>
                      <Chip
                        label={getCategoryLabel(command.category)}
                        size="small"
                        sx={{
                          height: 20,
                          bgcolor: alpha(getCategoryColor(command.category), 0.2),
                          color: getCategoryColor(command.category),
                          fontSize: '0.7rem'
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                      {command.description}
                    </Typography>
                }
                />
                {command.shortcut && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(25, 255, 255, 0.3)',
                      bgcolor: 'rgba(25, 255, 255, 0.05)',
                      px:  1,
                      py: 0.5,
                      borderRadius: 0.5 }}
                  >
                    {command.shortcut}
                  </Typography>
                )}
              </ListItem>
            ))
          )}
        </List>

        <Box sx={{
          p: 1,
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            ↑↓ Naviger • Enter Velg • Esc Lukk
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
            {filteredCommands.length} kommandoer
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;